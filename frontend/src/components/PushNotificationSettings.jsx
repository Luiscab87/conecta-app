
import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { FirebaseMessaging } from '@capacitor-firebase/messaging'
import { supabase } from '../lib/supabase'

const DEVICE_PUSH_KEY = 'conecta_android_push_enabled'

const DEFAULT_PREFERENCES = {
  push_enabled: false,
  messages: true,
  registration_requests: true,
  registration_decisions: true,
  activity_updates: true,
  admin_notices: true,
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)

  return Uint8Array.from(
    [...rawData].map((char) => char.charCodeAt(0))
  )
}

export default function PushNotificationSettings({ userId }) {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES)
  const [devicePushEnabled, setDevicePushEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const isAndroid =
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === 'android'

  const supported = isAndroid || (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )

  useEffect(() => {
    if (!userId) return

    let active = true

    async function loadPreferences() {
      setLoading(true)
      setError('')

      try {
        const { data, error: loadError } = await supabase
          .from('notification_preferences')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle()

        if (loadError) throw loadError

        if (!active) return

        if (data) {
          setPreferences({
            ...DEFAULT_PREFERENCES,
            ...data,
          })
        }

        if (isAndroid) {
          const savedDevicePreference =
            localStorage.getItem(DEVICE_PUSH_KEY) === 'true'

          const { token } = await FirebaseMessaging.getToken()

          if (!token) {
            throw new Error('No pudimos obtener el token del dispositivo.')
          }

          const { data: device, error: deviceError } = await supabase
            .from('android_push_tokens')
            .select('push_enabled')
            .eq('user_id', userId)
            .eq('fcm_token', token)
            .maybeSingle()

          if (deviceError) throw deviceError

          if (device) {
            localStorage.setItem(
              DEVICE_PUSH_KEY,
              String(device.push_enabled)
            )

            if (active) {
              setDevicePushEnabled(device.push_enabled)
            }
          } else if (savedDevicePreference) {
            // Recuperar la vinculación después de iniciar sesión.
            const { error: registerError } = await supabase
              .from('android_push_tokens')
              .upsert(
                {
                  user_id: userId,
                  fcm_token: token,
                  device_label: 'Android - Conectá',
                  push_enabled: true,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: 'fcm_token' }
              )

            if (registerError) throw registerError

            if (active) {
              setDevicePushEnabled(true)
            }
          } else if (active) {
            setDevicePushEnabled(false)
          }
        }
      } catch (err) {
        console.error('Error cargando preferencias:', err)

        if (active) {
          setError('No pudimos cargar la configuración de notificaciones.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadPreferences()

    return () => {
      active = false
    }
  }, [userId, isAndroid])

  async function savePreferences(nextPreferences) {
    const dataToSave = {
      ...nextPreferences,
      user_id: userId,
      updated_at: new Date().toISOString(),
    }

    const { error: saveError } = await supabase
      .from('notification_preferences')
      .upsert(dataToSave, { onConflict: 'user_id' })

    if (saveError) throw saveError

    setPreferences(nextPreferences)
  }

  async function handleCategoryChange(category, checked) {
    setError('')
    setMessage('')

    const nextPreferences = {
      ...preferences,
      [category]: checked,
    }

    try {
      await savePreferences(nextPreferences)
      setMessage('Preferencias guardadas.')
    } catch (err) {
      console.error(err)
      setError('No pudimos guardar el cambio. Intentá nuevamente.')
    }
  }

  async function enableAndroidPush() {
    setWorking(true)
    setError('')
    setMessage('')

    try {
      const permission = await FirebaseMessaging.requestPermissions()

      if (permission.receive !== 'granted') {
        throw new Error(
          'No se otorgó permiso para enviar notificaciones.'
        )
      }

      const { token } = await FirebaseMessaging.getToken()

      if (!token) {
        throw new Error('Firebase no pudo generar el token del dispositivo.')
      }

      const { error: subscriptionError } = await supabase
        .from('android_push_tokens')
        .upsert(
          {
            user_id: userId,
            fcm_token: token,
            device_label: 'Android - Conectá',
            push_enabled: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'fcm_token' }
        )

      if (subscriptionError) throw subscriptionError

      localStorage.setItem(DEVICE_PUSH_KEY, 'true')
      setDevicePushEnabled(true)
      setMessage('¡Notificaciones activadas en este dispositivo!')
    } catch (err) {
      console.error('Error activando FCM:', err)
      setError(err.message || 'No pudimos activar las notificaciones.')
    } finally {
      setWorking(false)
    }
  }

  async function disableAndroidPush() {
    setWorking(true)
    setError('')
    setMessage('')

    try {
      const { token } = await FirebaseMessaging.getToken()

      const { error: updateError } = await supabase
        .from('android_push_tokens')
        .update({
          push_enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('fcm_token', token)

      if (updateError) throw updateError

      localStorage.setItem(DEVICE_PUSH_KEY, 'false')
      setDevicePushEnabled(false)
      setMessage('Notificaciones desactivadas en este dispositivo.')
    } catch (err) {
      console.error('Error desactivando FCM:', err)
      setError('No pudimos desactivar las notificaciones correctamente.')
    } finally {
      setWorking(false)
    }
  }

  async function enableWebPush() {
    setWorking(true)
    setError('')
    setMessage('')

    try {
      if (!supported) {
        throw new Error(
          'Este navegador no permite notificaciones push.'
        )
      }

      if (!window.isSecureContext) {
        throw new Error(
          'Las notificaciones requieren una conexión segura HTTPS.'
        )
      }

      if (Notification.permission === 'denied') {
        throw new Error(
          'El navegador bloqueó las notificaciones. Habilitalas desde los ajustes del navegador.'
        )
      }

      const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY

      if (!publicKey) {
        throw new Error('Falta configurar la clave pública de notificaciones.')
      }

      const permission = await Notification.requestPermission()

      if (permission !== 'granted') {
        throw new Error('No se otorgó permiso para enviar notificaciones.')
      }

      const registration = await navigator.serviceWorker.ready

      let subscription = await registration.pushManager.getSubscription()

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        })
      }

      const subscriptionData = subscription.toJSON()
      const p256dh = subscriptionData.keys?.p256dh
      const auth = subscriptionData.keys?.auth

      if (!subscriptionData.endpoint || !p256dh || !auth) {
        throw new Error('No pudimos obtener los datos de la suscripción.')
      }

      const { error: subscriptionError } = await supabase
        .from('push_subscriptions')
        .upsert(
          {
            user_id: userId,
            endpoint: subscriptionData.endpoint,
            p256dh,
            auth,
            device_label: 'Navegador actual',
            expiration_time: subscription.expirationTime
              ? Math.floor(subscription.expirationTime)
              : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'endpoint' }
        )

      if (subscriptionError) throw subscriptionError

      await savePreferences({
        ...preferences,
        push_enabled: true,
      })

      setMessage('¡Notificaciones activadas en este dispositivo!')
    } catch (err) {
      console.error('Error activando Web Push:', err)
      setError(err.message || 'No pudimos activar las notificaciones.')
    } finally {
      setWorking(false)
    }
  }

  async function disableWebPush() {
    setWorking(true)
    setError('')
    setMessage('')

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        const endpoint = subscription.endpoint

        const { error: deleteError } = await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('endpoint', endpoint)

        if (deleteError) throw deleteError

        await subscription.unsubscribe()
      }

      await savePreferences({
        ...preferences,
        push_enabled: false,
      })

      setMessage('Notificaciones desactivadas en este dispositivo.')
    } catch (err) {
      console.error('Error desactivando Web Push:', err)
      setError('No pudimos desactivar las notificaciones correctamente.')
    } finally {
      setWorking(false)
    }
  }

  async function handleToggle(checked) {
    if (isAndroid) {
      if (checked) {
        await enableAndroidPush()
      } else {
        await disableAndroidPush()
      }
    } else {
      if (checked) {
        await enableWebPush()
      } else {
        await disableWebPush()
      }
    }
  }

  if (!userId) return null

  if (loading) {
    return <p>Cargando preferencias de notificaciones...</p>
  }

  const pushEnabled = isAndroid
    ? devicePushEnabled
    : preferences.push_enabled

  const categories = [
    { key: 'messages', label: 'Mensajes y respuestas' },
    { key: 'registration_requests', label: 'Solicitudes de participación' },
    { key: 'registration_decisions', label: 'Inscripciones aceptadas o rechazadas' },
    { key: 'activity_updates', label: 'Novedades de actividades' },
    { key: 'admin_notices', label: 'Avisos de administración' },
  ]

  return (
    <section className="push-settings">
      <h3>Notificaciones en tu dispositivo</h3>

      <p>
        Elegí si querés recibir avisos de Conectá aunque no tengas la página
        abierta.
      </p>

      {!supported && (
        <p>
          Tu navegador no parece ser compatible con las notificaciones push.
        </p>
      )}

      <div className="push-main-toggle">
        <label>
          <input
            type="checkbox"
            checked={pushEnabled}
            disabled={working || !supported}
            onChange={(event) => handleToggle(event.target.checked)}
          />
          <strong>Activar notificaciones push</strong>
        </label>
      </div>

      <div className="push-categories">
        <p><strong>¿Qué avisos querés recibir?</strong></p>

        {categories.map((category) => (
          <label key={category.key} className="push-category">
            <input
              type="checkbox"
              checked={Boolean(preferences[category.key])}
              disabled={working}
              onChange={(event) =>
                handleCategoryChange(category.key, event.target.checked)
              }
            />
            {category.label}
          </label>
        ))}
      </div>

      {working && <p>Actualizando configuración...</p>}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}

      <small>
        La campanita de Conectá seguirá funcionando independientemente de
        esta configuración.
      </small>
    </section>
  )
}
