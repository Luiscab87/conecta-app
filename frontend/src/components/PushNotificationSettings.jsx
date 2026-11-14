
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

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
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

function arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return window.btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export default function PushNotificationSettings({ userId }) {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const supported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window

  useEffect(() => {
    if (!userId) return

    async function loadPreferences() {
      setLoading(true)
      setError('')

      const { data, error: loadError } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (loadError) {
        setError('No pudimos cargar tus preferencias.')
      } else if (data) {
        setPreferences({
          ...DEFAULT_PREFERENCES,
          ...data,
        })
      }

      setLoading(false)
    }

    loadPreferences()
  }, [userId])

  async function savePreferences(nextPreferences) {
    const dataToSave = {
      ...nextPreferences,
      user_id: userId,
      updated_at: new Date().toISOString(),
    }

    const { error: saveError } = await supabase
      .from('notification_preferences')
      .upsert(dataToSave, { onConflict: 'user_id' })

    if (saveError) {
      throw saveError
    }

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
      setError('No pudimos guardar el cambio. Intentá nuevamente.')
    }
  }

  async function enablePush() {
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
      console.log('¿Se cargó la clave VAPID?', Boolean(publicKey))

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

      if (subscriptionError) {
        throw subscriptionError
      }

      await savePreferences({
        ...preferences,
        push_enabled: true,
      })

      setMessage('¡Notificaciones activadas en este dispositivo!')
    } catch (err) {
      console.error('Error activando notificaciones:', err)
      setError(err.message || 'No pudimos activar las notificaciones.')
    } finally {
      setWorking(false)
    }
  }

  async function disablePush() {
    setWorking(true)
    setError('')
    setMessage('')

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        const endpoint = subscription.endpoint

        await subscription.unsubscribe()

        const { error: deleteError } = await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('endpoint', endpoint)

        if (deleteError) {
          throw deleteError
        }
      }

      await savePreferences({
        ...preferences,
        push_enabled: false,
      })

      setMessage('Notificaciones desactivadas en este dispositivo.')
    } catch (err) {
      console.error('Error desactivando notificaciones:', err)
      setError('No pudimos desactivar las notificaciones correctamente.')
    } finally {
      setWorking(false)
    }
  }

  if (!userId) return null

  if (loading) {
    return <p>Cargando preferencias de notificaciones...</p>
  }

  const categories = [
    {
      key: 'messages',
      label: 'Mensajes y respuestas',
    },
    {
      key: 'registration_requests',
      label: 'Solicitudes de participación',
    },
    {
      key: 'registration_decisions',
      label: 'Inscripciones aceptadas o rechazadas',
    },
    {
      key: 'activity_updates',
      label: 'Novedades de actividades',
    },
    {
      key: 'admin_notices',
      label: 'Avisos de administración',
    },
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
            checked={preferences.push_enabled}
            disabled={working || !supported}
            onChange={(event) => {
              if (event.target.checked) {
                enablePush()
              } else {
                disablePush()
              }
            }}
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
              checked={preferences[category.key]}
              disabled={!preferences.push_enabled || working}
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
