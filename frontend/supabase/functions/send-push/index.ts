
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const webhookSecret = Deno.env.get("SEND_PUSH_WEBHOOK_SECRET")!;
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
const vapidSubject =
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:conecta@localhost";

const supabase = createClient(supabaseUrl, serviceRoleKey);

webpush.setVapidDetails(
  vapidSubject,
  vapidPublicKey,
  vapidPrivateKey,
);

const preferenceByType: Record<string, string> = {
  activity_post: "messages",
  new_comment: "messages",
  comment_reply: "messages",
  registration_requested: "registration_requests",
  registration_approved: "registration_decisions",
  registration_rejected: "registration_decisions",
  activity_updated: "activity_updates",
  participant_removed: "activity_updates",
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  if (!webhookSecret || req.headers.get("x-webhook-secret") !== webhookSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await req.json();
    const notification = payload.record;

    if (!notification?.recipient_id || !notification?.type) {
      return Response.json(
        { error: "Invalid notification payload" },
        { status: 400 },
      );
    }

    const preferenceField = preferenceByType[notification.type];

    if (!preferenceField) {
      return Response.json({
        success: true,
        skipped: true,
        reason: "Unknown notification type",
      });
    }

    // Consultar las preferencias del destinatario.
    const { data: preferences, error: preferencesError } = await supabase
      .from("notification_preferences")
      .select(
        "push_enabled, messages, registration_requests, registration_decisions, activity_updates, admin_notices",
      )
      .eq("user_id", notification.recipient_id)
      .maybeSingle();

    if (preferencesError) {
      throw preferencesError;
    }

    // Si todavía no existe una fila de preferencias, se aplican
    // los valores iniciales acordados: todo habilitado.
    if (
      preferences &&
      (
        preferences.push_enabled === false ||
        preferences[preferenceField] === false
      )
    ) {
      return Response.json({
        success: true,
        skipped: true,
        reason: "Push disabled by user preferences",
      });
    }

    // Buscar todos los dispositivos registrados del usuario.
    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", notification.recipient_id);

    if (subscriptionsError) {
      throw subscriptionsError;
    }

    if (!subscriptions?.length) {
      return Response.json({
        success: true,
        sent: 0,
        reason: "No registered devices",
      });
    }

    const pushPayload = JSON.stringify({
      title: notification.title || "Conectá",
      body: notification.body || "Tenés una nueva notificación",
      url: "/",
      notificationId: notification.id,
    });

    let sent = 0;
    let failed = 0;
    let removed = 0;

    for (const item of subscriptions) {
      const subscription = {
        endpoint: item.endpoint,
        keys: {
          p256dh: item.p256dh,
          auth: item.auth,
        },
      };

      try {
        await webpush.sendNotification(subscription, pushPayload);
        sent++;
      } catch (error) {
        failed++;

        const statusCode =
          typeof error === "object" && error !== null &&
          "statusCode" in error
            ? Number(error.statusCode)
            : 0;

        // 404 y 410 indican que la suscripción ya no es válida.
        if (statusCode === 404 || statusCode === 410) {
          const { error: deleteError } = await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", item.endpoint);

          if (!deleteError) {
            removed++;
          }
        } else {
          console.error("Error enviando push:", statusCode);
        }
      }
    }

    return Response.json({
      success: true,
      sent,
      failed,
      removed,
    });
  } catch (error) {
    console.error("Error en send-push:", error);

    return Response.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
});
