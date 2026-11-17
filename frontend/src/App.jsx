
import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { FirebaseMessaging } from '@capacitor-firebase/messaging'
import { Link, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { supabase } from './lib/supabase'
import MeetingPointPicker from './components/MeetingPointPicker'
import DateTimePicker from './components/DateTimePicker'
import './App.css'
import PushNotificationSettings from './components/PushNotificationSettings'


const categories = [
  'Lectura y literatura',
  'Deportes y actividad física',
  'Aire libre y naturaleza',
  'Cultura y arte',
  'Música',
  'Café y gastronomía',
  'Aprendizaje y formación',
  'Juegos y entretenimiento',
  'Voluntariado',
  'Otros'
]

// Imagen fija para cada categoría. Los archivos se guardan en public/category-images.
const categoryImages = {
  'Lectura y literatura': '/category-images/01-lectura-y-literatura.webp',
  'Deportes y actividad física': '/category-images/02-deportes-y-actividad-fisica.webp',
  'Aire libre y naturaleza': '/category-images/03-aire-libre-y-naturaleza.webp',
  'Cultura y arte': '/category-images/04-cultura-y-arte.webp',
  'Música': '/category-images/05-musica.webp',
  'Café y gastronomía': '/category-images/06-cafe-y-gastronomia.webp',
  'Aprendizaje y formación': '/category-images/07-aprendizaje-y-formacion.webp',
  'Juegos y entretenimiento': '/category-images/08-juegos-y-entretenimiento.webp',
  'Voluntariado': '/category-images/09-voluntariado.webp',
  'Otros': '/category-images/10-otros.webp'
}


const emptyActivity = {
  title: '',
  description: '',
  category: '',
  starts_at: '',
  ends_at: '',
  city: 'Alta Gracia',
  meeting_point: '',
  meeting_latitude: null,
  meeting_longitude: null,
  is_paid: false,
  price_amount: '',
  price_details: '',
  capacity: '',
  min_participants: 1,
  registration_mode: 'automatic',
  signup_deadline: ''
}

function getActivityTimelineStatus(activity, now = new Date()) {
  const start = new Date(activity.starts_at).getTime()
  const end = new Date(activity.ends_at).getTime()
  const current = now.getTime()

  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'upcoming'
  if (current < start) return 'upcoming'
  if (current < end) return 'in_progress'
  return 'finished'
}

function PasswordEyeIcon({ visible }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {visible ? (
        <>
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a15.8 15.8 0 0 1-3.1 3.9" />
          <path d="M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7c1.4 0 2.7-.3 3.8-.8" />
        </>
      )}
    </svg>
  )
}

function App() {
  const navigate = useNavigate()
  const [activities, setActivities] = useState([])
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [activeSection, setActiveSection] = useState('home')
  const [publicActivityCounts, setPublicActivityCounts] = useState({})

  // Buscador y filtros de actividades
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedActivityTab, setSelectedActivityTab] = useState('upcoming')
  const [selectedCategories, setSelectedCategories] = useState([])
  const [selectedCity, setSelectedCity] = useState('')
  const [datePreset, setDatePreset] = useState('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [myRegistrations, setMyRegistrations] = useState([])
  const [myActivitiesTab, setMyActivitiesTab] = useState('upcoming')
  const [cancelledMyActivities, setCancelledMyActivities] = useState([])
  const [receivedRegistrations, setReceivedRegistrations] = useState([])
  const [registrationProfiles, setRegistrationProfiles] = useState({})
  const [registrationMessage, setRegistrationMessage] = useState('')
  const [registrationLoading, setRegistrationLoading] = useState(false)
  const [session, setSession] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [showAuth, setShowAuth] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showCreateActivity, setShowCreateActivity] = useState(false)
  const [expandedActivityId, setExpandedActivityId] = useState(null)
  const [editingActivityId, setEditingActivityId] = useState(null)
  const [editActivityForm, setEditActivityForm] = useState(emptyActivity)
  const [adminMessage, setAdminMessage] = useState('')
  const [adminLoading, setAdminLoading] = useState(false)
  const [cancellationTarget, setCancellationTarget] = useState(null)
  const [cancellationReason, setCancellationReason] = useState('')

  const [loading, setLoading] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [profileMessage, setProfileMessage] = useState('')
  const [activityMessage, setActivityMessage] = useState('')
  const [shareFeedbackActivityId, setShareFeedbackActivityId] = useState(null)

  // Actualizar la hora periódicamente para que la línea temporal avance sola.
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(new Date())
    }, 30000)

    return () => window.clearInterval(intervalId)
  }, [])

  // Recuperación de contraseña
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [recoveryMessage, setRecoveryMessage] = useState('')

  // Autenticación
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  // Mostrar u ocultar contraseñas
const [showPassword, setShowPassword] = useState(false)
const [showConfirmPassword, setShowConfirmPassword] = useState(false)
const [showNewPassword, setShowNewPassword] = useState(false)
const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false)

  // Perfil
  const [profileName, setProfileName] = useState('')
  const [city, setCity] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [profileSex, setProfileSex] = useState('neutral')

  // Centro de notificaciones
  const [notifications, setNotifications] = useState([])
  const [notificationProfiles, setNotificationProfiles] = useState({})
  const [showNotifications, setShowNotifications] = useState(false)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationError, setNotificationError] = useState('')

  // Nueva actividad
  const [activityForm, setActivityForm] = useState(emptyActivity)


  // Flecha atrás nativa de Android: primero cierra la interfaz abierta;
  // si no hay nada abierto, vuelve a la sección anterior o sale desde Inicio.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let listener
    let disposed = false

    CapacitorApp.addListener('backButton', () => {
      if (showAuth) {
        setShowAuth(false)
        return
      }

      if (showNotifications) {
        setShowNotifications(false)
        return
      }

      if (showCreateActivity) {
        setShowCreateActivity(false)
        return
      }

      if (cancellationTarget) {
        setCancellationTarget(null)
        setCancellationReason('')
        return
      }

      if (showProfile || activeSection === 'profile') {
        setShowProfile(false)
        setActiveSection('home')
        return
      }

      if (expandedActivityId) {
        setExpandedActivityId(null)
        return
      }

      if (activeSection !== 'home') {
        setActiveSection('home')
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }

      const historyIndex = window.history.state?.idx ?? 0
      if (historyIndex > 0) {
        navigate(-1)
      } else {
        CapacitorApp.exitApp()
      }
    }).then(handle => {
      if (disposed) {
        handle.remove()
      } else {
        listener = handle
      }
    }).catch(error => {
      console.error('No se pudo registrar la navegación atrás de Android:', error)
    })

    return () => {
      disposed = true
      listener?.remove()
    }
  }, [
    navigate,
    showAuth,
    showNotifications,
    showCreateActivity,
    cancellationTarget,
    showProfile,
    activeSection,
    expandedActivityId
  ])


  // Cargar notificaciones del usuario
  async function loadNotifications(currentSession = session) {
    if (!currentSession?.user) {
      setNotifications([])
      setNotificationProfiles({})
      setNotificationsLoading(false)
      return
    }

    setNotificationsLoading(true)
    setNotificationError('')

    const { data, error } = await supabase
      .from('notifications')
      .select('id, recipient_id, actor_id, activity_id, type, title, body, created_at, read_at')
      .eq('recipient_id', currentSession.user.id)
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) {
      console.error('Error cargando notificaciones:', error.message)
      setNotificationError('No se pudieron cargar las notificaciones.')
      setNotificationsLoading(false)
      return
    }

    const rows = data || []
    setNotifications(rows)

    const actorIds = [...new Set(rows.map(item => item.actor_id).filter(Boolean))]
    if (actorIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', actorIds)

      if (profilesError) {
        console.warn('No se pudieron cargar los autores de las notificaciones:', profilesError.message)
        setNotificationProfiles({})
      } else {
        const profileMap = {}
        ;(profiles || []).forEach(profile => {
          profileMap[profile.id] = profile
        })
        setNotificationProfiles(profileMap)
      }
    } else {
      setNotificationProfiles({})
    }

    setNotificationsLoading(false)
  }

  async function markNotificationAsRead(notificationId) {
    const readAt = new Date().toISOString()

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: readAt })
      .eq('id', notificationId)
      .eq('recipient_id', session.user.id)

    if (error) {
      console.error('Error marcando notificación como leída:', error.message)
      setNotificationError('No se pudo marcar la notificación como leída.')
      return false
    }

    setNotifications(previous =>
      previous.map(item =>
        item.id === notificationId ? { ...item, read_at: readAt } : item
      )
    )
    return true
  }

  async function handleNotificationClick(notification) {
    if (!notification.read_at) {
      await markNotificationAsRead(notification.id)
    }

    setShowNotifications(false)

    if (notification.activity_id) {
      navigate(`/actividad/${notification.activity_id}`)
    }
  }

  // Eliminar una notificación únicamente del centro del usuario que la recibe
  async function deleteNotification(notificationId) {
    if (!session?.user?.id) return

    const { data: deletedRows, error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('recipient_id', session.user.id)
      .select('id')

    if (error) {
      console.error('Error eliminando notificación:', error.message)
      setNotificationError('No se pudo eliminar la notificación. Revisá los permisos de eliminación.')
      return
    }

    // Supabase puede devolver cero filas si RLS no permite DELETE.
    // No la quitamos visualmente si no se confirmó la eliminación real.
    if (!deletedRows || deletedRows.length === 0) {
      setNotificationError('La notificación no se eliminó en la base de datos. Hay que habilitar el permiso DELETE para tus propias notificaciones en Supabase.')
      return
    }

    setNotifications(previous => previous.filter(item => item.id !== notificationId))
    setNotificationError('')
  }

  async function markAllNotificationsAsRead() {
    const unreadIds = notifications.filter(item => !item.read_at).map(item => item.id)
    if (unreadIds.length === 0 || !session?.user) return

    const readAt = new Date().toISOString()
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: readAt })
      .eq('recipient_id', session.user.id)
      .is('read_at', null)

    if (error) {
      console.error('Error marcando todas las notificaciones:', error.message)
      setNotificationError('No se pudieron marcar todas como leídas.')
      return
    }

    setNotifications(previous =>
      previous.map(item => item.read_at ? item : { ...item, read_at: readAt })
    )
  }

  // Cargar actividades
  async function loadActivities() {
    const { data, error } = await supabase
      .from('activities')
      .select(`
        id,
        organizer_id,
        title,
        description,
        category,
        starts_at,
        ends_at,
        city,
        meeting_point,
        meeting_latitude,
        meeting_longitude,
        is_paid,
        price_amount,
        price_details,
        capacity,
        min_participants,
        registration_mode,
        status
      `)
      .in('status', ['open', 'confirmed', 'completed'])
      .order('starts_at', { ascending: true })

    if (error) {
      console.error('Error cargando actividades:', error.message)
      return
    }

    let combinedActivities = data || []

    // Recuperar el historial básico de actividades antiguas en las que participé.
    // La RPC solo devuelve actividades para las que mi inscripción fue confirmed.
    if (session?.user) {
      const { data: historyData, error: historyError } = await supabase.rpc(
        'get_my_expired_activity_history'
      )

      if (historyError) {
        console.error('Error cargando mi historial de actividades:', historyError.message)
      } else if (Array.isArray(historyData) && historyData.length > 0) {
        const existingIds = new Set(combinedActivities.map(item => item.id))
        const expiredHistory = historyData
          .map(item => typeof item === 'string' ? JSON.parse(item) : item)
          .filter(item => item?.id && !existingIds.has(item.id))
        combinedActivities = [...combinedActivities, ...expiredHistory]
      }
    }

    setActivities(combinedActivities)
  } 
  // Cargar cantidades públicas de participantes
useEffect(() => {
  async function loadPublicActivityCounts() {
    if (activities.length === 0) {
      setPublicActivityCounts({})
      return
    }

    const activityIds = activities.map(activity => activity.id)

    const { data, error } = await supabase.rpc(
      'get_public_activity_counts',
      { p_activity_ids: activityIds }
    )

    if (error) {
      console.error('Error cargando cantidades públicas:', error.message)
      return
    }

    const counts = {}

    ;(data || []).forEach(item => {
      counts[item.activity_id] = Number(item.participant_count)
    })

    setPublicActivityCounts(counts)
  }

  loadPublicActivityCounts()
}, [activities])

  // Cargar inscripciones propias y solicitudes recibidas por el organizador
  async function loadRegistrations(currentSession = session, currentActivities = activities) {
    if (!currentSession?.user) {
      setMyRegistrations([])
      setCancelledMyActivities([])
      setReceivedRegistrations([])
      setRegistrationProfiles({})
      return
    }

    const userId = currentSession.user.id

    const { data: mine, error: mineError } = await supabase
      .from('registrations')
      .select('id, activity_id, user_id, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (mineError) {
      console.error('Error cargando mis inscripciones:', mineError.message)
      setRegistrationMessage('No se pudieron cargar tus inscripciones.')
      return
    }

    const organizerActivityIds = currentActivities
      .filter(activity => activity.organizer_id === userId)
      .map(activity => activity.id)

    let received = []
    if (organizerActivityIds.length > 0) {
      const { data, error } = await supabase
        .from('registrations')
        .select('id, activity_id, user_id, status, created_at')
        .in('activity_id', organizerActivityIds)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error cargando solicitudes recibidas:', error.message)
        setRegistrationMessage('No se pudieron cargar las solicitudes recibidas.')
      } else {
        received = data || []
      }
    }

    setMyRegistrations(mine || [])
    setReceivedRegistrations(received)

    // Cargar únicamente las actividades canceladas vinculadas a mis inscripciones.
    const myActivityIds = [...new Set((mine || []).map(item => item.activity_id).filter(Boolean))]

    if (myActivityIds.length > 0) {
      const { data: cancelled, error: cancelledError } = await supabase
        .from('activities')
        .select('id, title, starts_at, ends_at, status')
        .in('id', myActivityIds)
        .eq('status', 'cancelled')

      if (cancelledError) {
        console.error('Error cargando actividades canceladas:', cancelledError.message)
        setCancelledMyActivities([])
      } else {
        setCancelledMyActivities(cancelled || [])
      }
    } else {
      setCancelledMyActivities([])
    }
  }


  async function handleJoinActivity(activity) {
    if (!session?.user) {
      setAuthMode('login')
      setShowAuth(true)
      setMessage('Ingresá o registrate para solicitar participar.')
      return
    }

    if (activity.organizer_id === session.user.id) {
      setRegistrationMessage('Esta es tu actividad: no necesitás inscribirte.')
      return
    }

    setRegistrationLoading(true)
    setRegistrationMessage('')

    try {
      const { data, error } = await supabase.rpc(
        'request_activity_registration',
        { p_activity_id: activity.id }
      )

      if (error) throw error

      const status = typeof data === 'string' ? data : data?.request_activity_registration
      setRegistrationMessage(
        status === 'accepted'
          ? `¡Ya estás confirmado/a para "${activity.title}"!`
          : `Tu solicitud para "${activity.title}" fue enviada. El organizador debe aprobarla.`
      )
      await loadRegistrations(session, activities)
    } catch (error) {
      setRegistrationMessage(error.message || 'No se pudo completar la inscripción.')
    } finally {
      setRegistrationLoading(false)
    }
  }

  async function handleManageRegistration(registrationId, newStatus) {
    setRegistrationLoading(true)
    setRegistrationMessage('')

    try {
      const { data, error } = await supabase.rpc(
        'manage_activity_registration',
        {
          p_registration_id: registrationId,
          p_new_status: newStatus
        }
      )

      if (error) throw error

      setRegistrationMessage(
        newStatus === 'accepted'
          ? 'Inscripción aceptada correctamente.'
          : 'Solicitud rechazada.'
      )
      await loadRegistrations(session, activities)
    } catch (error) {
      setRegistrationMessage(error.message || 'No se pudo actualizar la solicitud.')
    } finally {
      setRegistrationLoading(false)
    }
  }

  function toDateTimeLocal(value) {
    if (!value) return ''
    const date = new Date(value)
    const offset = date.getTimezoneOffset()
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16)
  }

  function toggleActivityManagement(activity) {
    const nextId = expandedActivityId === activity.id ? null : activity.id
    setExpandedActivityId(nextId)
    setEditingActivityId(null)
    setAdminMessage('')
  }

  function startEditingActivity(activity) {
    if (getActivityTimelineStatus(activity, currentTime) !== 'upcoming') {
      setAdminMessage('Esta actividad ya comenzó y no se puede editar.')
      return
    }

    setEditActivityForm({
      title: activity.title || '',
      description: activity.description || '',
      category: activity.category || '',
      starts_at: toDateTimeLocal(activity.starts_at),
      ends_at: toDateTimeLocal(activity.ends_at),
      city: activity.city || '',
      meeting_point: activity.meeting_point || '',
      meeting_latitude: activity.meeting_latitude ?? null,
      meeting_longitude: activity.meeting_longitude ?? null,
      is_paid: Boolean(activity.is_paid),
      price_amount: activity.price_amount ?? '',
      price_details: activity.price_details || '',
      capacity: activity.capacity ?? '',
      min_participants: activity.min_participants ?? 1,
      registration_mode: activity.registration_mode || 'automatic',
      signup_deadline: toDateTimeLocal(activity.signup_deadline)
    })
    setEditingActivityId(activity.id)
    setAdminMessage('')
  }

  function updateEditActivityField(field, value) {
    setEditActivityForm(previous => ({ ...previous, [field]: value }))
  }

  async function saveEditedActivity(event, activity) {
    console.log('[Conectá] Entró a saveEditedActivity', { activityId: activity?.id, title: activity?.title })
    event.preventDefault()
    setAdminMessage('')
    if (!activity || getActivityTimelineStatus(activity, new Date()) !== 'upcoming') {
      setEditingActivityId(null)
      setAdminMessage('Esta actividad ya comenzó y no se puede editar.')
      return
    }
    if (!editActivityForm.title.trim() || !editActivityForm.description.trim() ||
        !editActivityForm.category || !editActivityForm.starts_at ||
        !editActivityForm.ends_at ||
        !editActivityForm.city.trim() || !editActivityForm.meeting_point.trim()) {
      setAdminMessage('Completá todos los campos obligatorios.')
      return
    }
    if (editActivityForm.meeting_latitude == null || editActivityForm.meeting_longitude == null ||
        !Number.isFinite(Number(editActivityForm.meeting_latitude)) ||
        !Number.isFinite(Number(editActivityForm.meeting_longitude))) {
      setAdminMessage('Ubicá el punto de encuentro en el mapa antes de guardar.')
      return
    }
    const start = new Date(editActivityForm.starts_at)
    const end = new Date(editActivityForm.ends_at)
    if (Number.isNaN(start.getTime())) {
      setAdminMessage('Revisá la fecha de inicio.')
      return
    }
    if (Number.isNaN(end.getTime())) {
      setAdminMessage('Revisá la fecha de finalización.')
      return
    }
    if (end <= start) {
      setAdminMessage('La finalización debe ser posterior al inicio.')
      return
    }
    const capacity = editActivityForm.capacity === '' ? null : Number(editActivityForm.capacity)
    const minimum = Number(editActivityForm.min_participants)
    const price = editActivityForm.is_paid ? Number(editActivityForm.price_amount) : null
    if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) {
      setAdminMessage('La capacidad debe ser un número mayor que cero.')
      return
    }
    if (!Number.isInteger(minimum) || minimum < 1 || (capacity !== null && minimum > capacity)) {
      setAdminMessage('Revisá la cantidad mínima y la capacidad máxima.')
      return
    }
    if (editActivityForm.is_paid && (!Number.isFinite(price) || price <= 0)) {
      setAdminMessage('Ingresá un precio válido.')
      return
    }

    const updatedValues = {
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      city: editActivityForm.city.trim(),
      meeting_point: editActivityForm.meeting_point.trim(),
      meeting_latitude: Number(editActivityForm.meeting_latitude),
      meeting_longitude: Number(editActivityForm.meeting_longitude),
      is_paid: editActivityForm.is_paid,
      price_amount: price,
      price_details: editActivityForm.is_paid ? editActivityForm.price_details.trim() || null : null,
    }

    // Comparar las fechas en formato local, igual al que muestra el formulario.
    // Esto evita diferencias de conversión entre datetime-local y UTC.
    const originalStartLocal = toDateTimeLocal(activity.starts_at)
    const originalEndLocal = toDateTimeLocal(activity.ends_at)
    const newStartLocal = editActivityForm.starts_at || ''
    const newEndLocal = editActivityForm.ends_at || ''

    const changedItems = []

    if (
      originalStartLocal !== newStartLocal ||
      originalEndLocal !== newEndLocal
    ) {
      changedItems.push('fecha y horario')
    }

    console.group('[Conectá] Diagnóstico de edición')
    console.log('Actividad:', activity.id, activity.title)
    console.log('Fecha inicio original:', originalStartLocal)
    console.log('Fecha inicio nueva:', newStartLocal)
    console.log('Fecha fin original:', originalEndLocal)
    console.log('Fecha fin nueva:', newEndLocal)
    console.log('Cambios detectados:', changedItems)
    console.groupEnd()

    if (
      (activity.city || '').trim() !== updatedValues.city ||
      (activity.meeting_point || '').trim() !== updatedValues.meeting_point ||
      Number(activity.meeting_latitude) !== updatedValues.meeting_latitude ||
      Number(activity.meeting_longitude) !== updatedValues.meeting_longitude
    ) {
      changedItems.push('ubicación y punto de encuentro')
    }

    const oldPriceDetails = activity.is_paid ? (activity.price_details || '').trim() || null : null
    if (
      Boolean(activity.is_paid) !== updatedValues.is_paid ||
      (activity.is_paid && Number(activity.price_amount) !== updatedValues.price_amount) ||
      oldPriceDetails !== updatedValues.price_details
    ) {
      changedItems.push('costo de la actividad')
    }

    setAdminLoading(true)
    try {
      const { error } = await supabase.from('activities').update({
        title: editActivityForm.title.trim(),
        description: editActivityForm.description.trim(),
        category: editActivityForm.category,
        ...updatedValues,
        capacity,
        min_participants: minimum,
        registration_mode: editActivityForm.registration_mode,
        signup_deadline: editActivityForm.signup_deadline
          ? new Date(editActivityForm.signup_deadline).toISOString()
          : null
      }).eq('id', activity.id).eq('organizer_id', session.user.id)
      if (error) throw error

      let notificationWarning = ''
      if (changedItems.length > 0) {
        console.info('[Conectá] Ejecutando RPC notify_activity_updated', {
          activityId: activity.id,
          changes: changedItems
        })

        const { data: notifiedCount, error: notificationError } = await supabase.rpc(
          'notify_activity_updated',
          {
            p_activity_id: activity.id,
            p_changes: changedItems.join(', ')
          }
        )
        if (notificationError) {
          console.error('La actividad se guardó, pero no se pudieron enviar las notificaciones:', notificationError)
          notificationWarning = ' La actividad se guardó, pero hubo un error al notificar: ' + notificationError.message
        } else if (Number(notifiedCount) === 0) {
          console.warn('La función de notificaciones no encontró participantes elegibles para esta actividad.', {
            activityId: activity.id,
            changes: changedItems,
            notifiedCount
          })
          notificationWarning = ' La actividad se guardó, pero la función no encontró participantes para notificar (0 notificaciones).'
        } else {
          console.info(`Notificaciones de actualización creadas: ${notifiedCount}`)
        }
      }

      await loadActivities()
      setEditingActivityId(null)
      setAdminMessage('La actividad se actualizó correctamente.' + notificationWarning)
    } catch (error) {
      setAdminMessage('No se pudo guardar: ' + error.message)
    } finally {
      setAdminLoading(false)
    }
  }

  function openCancellationDialog(activity) {
    setCancellationTarget(activity)
    setCancellationReason('')
    setAdminMessage('')
  }

  async function handleCancelActivity() {
    if (!cancellationTarget || adminLoading) return

    const reason = cancellationReason.trim()
    if (reason.length > 1000) {
      setAdminMessage('El motivo no puede superar los 1000 caracteres.')
      return
    }

    setAdminLoading(true)
    setAdminMessage('')
    try {
      const { data, error } = await supabase.rpc('cancel_activity', {
        p_activity_id: cancellationTarget.id,
        p_reason: reason || null
      })
      if (error) throw error
      if (data?.success === false) {
        throw new Error(data.message || 'La actividad no pudo cancelarse.')
      }

      const activityId = cancellationTarget.id
      setActivities(previous => previous.filter(item => item.id !== activityId))
      setReceivedRegistrations(previous => previous.filter(item => item.activity_id !== activityId))
      setExpandedActivityId(null)
      setEditingActivityId(null)
      setCancellationTarget(null)
      setCancellationReason('')
      await loadActivities()
      await loadRegistrations(session)
      setAdminMessage('La actividad se canceló correctamente. Se notificó a las personas confirmadas.')
    } catch (error) {
      setAdminMessage('No se pudo cancelar la actividad: ' + (error.message || 'Error desconocido.'))
    } finally {
      setAdminLoading(false)
    }
  }

function registrationStatusLabel(status) {
  if (status === 'accepted' || status === 'confirmed') {
    return '¡Ya sos parte de esta actividad!'
  }
  if (status === 'pending') return 'Pendiente de aprobación'
  if (status === 'rejected' || status === 'cancelled') return 'No aceptada'
  return status || 'Sin inscripción'
}

  // Sesión y autenticación
  useEffect(() => {
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)

      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true)
        setShowAuth(true)
        setShowProfile(false)
        setRecoveryMessage('')
      }
    })

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error(error.message)
      setSession(data.session)
    })

    loadActivities()

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session && !recoveryMode) {
      loadActivities()
    }
  }, [session, recoveryMode])

  useEffect(() => {
    if (session && !recoveryMode) {
      loadRegistrations(session, activities)
    } else {
      setMyRegistrations([])
      setCancelledMyActivities([])
      setReceivedRegistrations([])
      setRegistrationProfiles({})
    }
  }, [session, activities, recoveryMode])

  // Mantener actualizado el centro de notificaciones
  useEffect(() => {
    if (!session?.user || recoveryMode) {
      setNotifications([])
      setNotificationProfiles({})
      setShowNotifications(false)
      return
    }

    loadNotifications(session)
    const refreshId = window.setInterval(() => {
      loadNotifications(session)
    }, 30000)

    return () => window.clearInterval(refreshId)
  }, [session, recoveryMode])

  // Cargar perfil
  useEffect(() => {
    let active = true

    async function loadProfile() {
      if (!session?.user || recoveryMode) return

      setProfileLoading(true)

      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, city, bio, avatar_url')
        .eq('id', session.user.id)
        .single()

      if (!active) return

      if (error) {
        console.error('Error cargando perfil:', error.message)
        setProfileMessage('No se pudo cargar el perfil.')
      } else {
        setProfileName(data.display_name || '')
        setCity(data.city || '')
        setBio(data.bio || '')
        setAvatarUrl(data.avatar_url || '')
        setAvatarFile(null)
        const { data: preferences, error: preferencesError } = await supabase
  .from('profile_preferences')
  .select('sex')
  .eq('user_id', session.user.id)
  .maybeSingle()

if (preferencesError) {
  console.error('Error cargando preferencias:', preferencesError.message)
  setProfileSex('neutral')
} else {
  setProfileSex(preferences?.sex || 'neutral')
}
      }

      setProfileLoading(false)
    }

    if (session && !recoveryMode) {
      loadProfile()
    } else if (!session) {
      setProfileName('')
      setCity('')
      setBio('')
      setAvatarUrl('')
      setAvatarFile(null)
      setShowProfile(false)
    }

    return () => {
      active = false
    }
  }, [session, recoveryMode])

  // Registro e inicio de sesión
  async function handleAuth(event) {
    event.preventDefault()
    setMessage('')

    if (authMode === 'register' && !name.trim()) {
      setMessage('Ingresá tu nombre.')
      return
    }

    if (authMode === 'register' && password !== confirmPassword) {
      setMessage('Las contraseñas no coinciden.')
      return
    }

    if (password.length < 8) {
      setMessage('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    setLoading(true)

    try {
      if (authMode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: name.trim() }
          }
        })

        if (error) throw error

        if (data.session) {
          setMessage('¡Bienvenido a Conectá!')
          setShowAuth(false)
        } else {
          setMessage('¡Registro iniciado! Revisá tu correo para confirmar la cuenta.')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        })

        if (error) throw error

        setMessage('¡Bienvenido nuevamente!')
        setShowAuth(false)
      }

      setPassword('')
      setConfirmPassword('')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  // Recuperar contraseña
  async function handleForgotPassword() {
    setMessage('')

    if (!email.trim()) {
      setMessage('Primero ingresá tu correo electrónico.')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: window.location.origin }
      )

      if (error) throw error

      setMessage('Te enviamos un correo para recuperar tu contraseña.')
    } catch (error) {
      setMessage('No se pudo enviar el correo: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // Guardar nueva contraseña
  async function handlePasswordRecovery(event) {
    event.preventDefault()
    setRecoveryMessage('')

    if (newPassword.length < 8) {
      setRecoveryMessage('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    if (newPassword !== confirmNewPassword) {
      setRecoveryMessage('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error

      setNewPassword('')
      setConfirmNewPassword('')
      setRecoveryMode(false)
      setShowAuth(false)
      setMessage('¡Contraseña actualizada! Ya podés ingresar a Conectá.')
      setRecoveryMessage('')
    } catch (error) {
      setRecoveryMessage('No se pudo actualizar la contraseña: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

 
// Cerrar sesión
async function handleLogout() {
  // La limpieza de notificaciones es secundaria: nunca debe impedir
  // que Supabase cierre la sesión, especialmente en Android.
  let user = session?.user || null

  try {
    const { data, error: userError } = await supabase.auth.getUser()

    if (userError) {
      console.warn('No se pudo consultar el usuario antes de cerrar sesión:', userError.message)
    } else if (data?.user) {
      user = data.user
    }
  } catch (error) {
    console.warn('No se pudo identificar el usuario antes de cerrar sesión:', error)
  }

  // Android: intentar desvincular el token FCM sin bloquear el logout.
  if (
    user &&
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === 'android'
  ) {
    try {
      const { token } = await FirebaseMessaging.getToken()

      if (token) {
        const { error: deleteAndroidError } = await supabase
          .from('android_push_tokens')
          .delete()
          .eq('user_id', user.id)
          .eq('fcm_token', token)

        if (deleteAndroidError) {
          console.warn('No se pudo desvincular el token Android:', deleteAndroidError.message)
        }
      }
    } catch (error) {
      console.warn('No se pudo limpiar el token Android antes del logout:', error)
    }
  }

  // Navegador: intentar desvincular la suscripción Web Push.
  // En la APK puede no existir serviceWorker; eso no debe bloquear el cierre.
  if (user && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration()

      if (registration) {
        const subscription = await registration.pushManager.getSubscription()

        if (subscription) {
          const { error: deleteError } = await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', user.id)
            .eq('endpoint', subscription.endpoint)

          if (deleteError) {
            console.warn('No se pudo desvincular la suscripción Web Push:', deleteError.message)
          } else {
            await subscription.unsubscribe()
          }
        }
      }
    } catch (error) {
      console.warn('No se pudo limpiar la suscripción Web Push antes del logout:', error)
    }
  }

  // El cierre de sesión se ejecuta aunque haya fallado alguna limpieza.
  try {
    const { error } = await supabase.auth.signOut()

    if (error) throw error

    setMessage('Cerraste sesión correctamente.')
    setShowProfile(false)
    setShowCreateActivity(false)
    setShowNotifications(false)
    setRecoveryMode(false)
  } catch (error) {
    console.error('Error al cerrar sesión:', error)
    setMessage(error.message || 'No pudimos cerrar la sesión correctamente.')
  }
}

  // Abrir formulario de creación
  function openActivityForm() {
    if (!session) {
      setAuthMode('login')
      setShowAuth(true)
      setMessage('Ingresá o registrate para poder crear una actividad.')
      return
    }

    setActivityForm({
      ...emptyActivity,
      city: city || 'Alta Gracia'
    })
    setActivityMessage('')
    setShowProfile(false)
    setShowCreateActivity(true)

    document.getElementById('crear-actividad')?.scrollIntoView({
      behavior: 'smooth'
    })
  }

  // Actualizar campos del formulario
  function updateActivityField(field, value) {
    setActivityForm(previous => ({
      ...previous,
      [field]: value
    }))
  }

  // Crear actividad en Supabase
  async function handleCreateActivity(event) {
    event.preventDefault()
    setActivityMessage('')

    if (!session?.user) {
      setActivityMessage('Necesitás iniciar sesión.')
      return
    }

    if (!activityForm.title.trim() ||
        !activityForm.description.trim() ||
        !activityForm.category ||
        !activityForm.starts_at ||
        !activityForm.ends_at ||
        !activityForm.city.trim() ||
        !activityForm.meeting_point.trim()) {
      setActivityMessage('Completá todos los campos obligatorios.')
      return
    }

    if (
      activityForm.meeting_latitude === null ||
      activityForm.meeting_latitude === undefined ||
      activityForm.meeting_longitude === null ||
      activityForm.meeting_longitude === undefined ||
      !Number.isFinite(Number(activityForm.meeting_latitude)) ||
      !Number.isFinite(Number(activityForm.meeting_longitude))
    ) {
      setActivityMessage('Seleccioná el punto de encuentro en el mapa.')
      return
    }

    const startDate = new Date(activityForm.starts_at)

    if (Number.isNaN(startDate.getTime()) || startDate <= new Date()) {
      setActivityMessage('La fecha de inicio debe ser futura.')
      return
    }

    const endDate = new Date(activityForm.ends_at)
    if (Number.isNaN(endDate.getTime())) {
      setActivityMessage('Revisá la fecha de finalización.')
      return
    }

    if (endDate <= startDate) {
      setActivityMessage('La finalización debe ser posterior al inicio.')
      return
    }

    const capacity = activityForm.capacity
      ? Number(activityForm.capacity)
      : null

    const minParticipants = Number(activityForm.min_participants)

    if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) {
      setActivityMessage('La capacidad debe ser un número mayor que cero.')
      return
    }

    if (!Number.isInteger(minParticipants) || minParticipants < 1) {
      setActivityMessage('Los participantes mínimos deben ser al menos uno.')
      return
    }

    if (capacity !== null && minParticipants > capacity) {
      setActivityMessage('El mínimo de participantes no puede superar la capacidad.')
      return
    }

    const priceAmount = activityForm.is_paid
      ? Number(activityForm.price_amount)
      : null

    if (activityForm.is_paid && (!Number.isFinite(priceAmount) || priceAmount <= 0)) {
      setActivityMessage('Ingresá un precio válido para la actividad.')
      return
    }

    const payload = {
      organizer_id: session.user.id,
      title: activityForm.title.trim(),
      description: activityForm.description.trim(),
      category: activityForm.category,
      starts_at: startDate.toISOString(),
      ends_at: endDate.toISOString(),
      city: activityForm.city.trim(),
      meeting_point: activityForm.meeting_point.trim(),
      meeting_latitude: Number(activityForm.meeting_latitude),
      meeting_longitude: Number(activityForm.meeting_longitude),
      is_paid: activityForm.is_paid,
      price_amount: priceAmount,
      price_details: activityForm.is_paid
        ? activityForm.price_details.trim() || null
        : null,
      capacity,
      min_participants: minParticipants,
      registration_mode: activityForm.registration_mode,
      signup_deadline: activityForm.signup_deadline
        ? new Date(activityForm.signup_deadline).toISOString()
        : null,
      status: 'open'
    }

    setLoading(true)

    try {
      const { error } = await supabase
        .from('activities')
        .insert(payload)

      if (error) throw error

      await loadActivities()

      setActivityForm(emptyActivity)
      setShowCreateActivity(false)
      setActivityMessage('')
      setMessage('¡Tu actividad se publicó correctamente!')

      document.getElementById('actividades')?.scrollIntoView({
        behavior: 'smooth'
      })
    } catch (error) {
      console.error('Error publicando actividad:', error)
      setActivityMessage('No se pudo publicar: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // Subir fotografía
  async function uploadAvatar() {
    if (!avatarFile || !session?.user) return

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(avatarFile.type)) {
      setProfileMessage('Elegí una imagen JPG, PNG o WebP.')
      return
    }

    if (avatarFile.size > 2 * 1024 * 1024) {
      setProfileMessage('La fotografía no puede superar los 2 MB.')
      return
    }

    setProfileLoading(true)
    setProfileMessage('Subiendo fotografía...')

    try {
      const fileExt = avatarFile.name.split('.').pop().toLowerCase()
      const filePath = `${session.user.id}/avatar.${fileExt}`

      const { error } = await supabase.storage
        .from('avatars')
        .upload(filePath, avatarFile, {
          upsert: true,
          contentType: avatarFile.type
        })

      if (error) throw error

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      const publicUrl = data.publicUrl

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', session.user.id)

      if (updateError) throw updateError

      setAvatarUrl(publicUrl)
      setAvatarFile(null)
      setProfileMessage('¡Fotografía actualizada correctamente!')
    } catch (error) {
      setProfileMessage('Error al subir la fotografía: ' + error.message)
    } finally {
      setProfileLoading(false)
    }
  }

  // Guardar perfil
  
async function saveProfile(event) {
  event.preventDefault()

  if (!session?.user) return

  if (!profileName.trim()) {
    setProfileMessage('El nombre no puede estar vacío.')
    return
  }

  setProfileLoading(true)
  setProfileMessage('')

  try {
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        display_name: profileName.trim(),
        city: city.trim(),
        bio: bio.trim()
      })
      .eq('id', session.user.id)

    if (profileError) throw profileError

    const { error: preferencesError } = await supabase
      .from('profile_preferences')
      .upsert({
        user_id: session.user.id,
        sex: profileSex
      }, {
        onConflict: 'user_id'
      })

    if (preferencesError) throw preferencesError

    setProfileMessage('¡Tu perfil se actualizó correctamente!')
  } catch (error) {
    setProfileMessage('Error al guardar: ' + error.message)
  } finally {
    setProfileLoading(false)
  }
}


  function formatDate(date) {
    return new Date(date).toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  function formatTime(date) {
    return new Date(date).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  async function shareActivity(activity) {
    const url = `${window.location.origin}/actividad/${activity.id}`
    const shareData = {
      title: activity.title || 'Actividad en Conectá',
      text: `Mirá esta actividad en Conectá: ${activity.title || 'Una experiencia para compartir'}`,
      url
    }

    try {
      if (navigator.share) {
        await navigator.share(shareData)
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        setShareFeedbackActivityId(activity.id)
      } else {
        window.prompt('Copiá el enlace para compartir esta actividad:', url)
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        console.error('No se pudo compartir la actividad:', error)
        setShareFeedbackActivityId(`error-${activity.id}`)
      }
    }
  }

  const editingActivity = activities.find(item => item.id === editingActivityId)
  useEffect(() => {
    if (!editingActivityId) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [editingActivityId])

  // Localidades disponibles, obtenidas de las actividades publicadas.
  const availableCities = [...new Set(
    activities
      .map(activity => (activity.city || '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'es'))
  )]

  function toggleSearchCategory(category) {
    setSelectedCategories(previous =>
      previous.includes(category)
        ? previous.filter(item => item !== category)
        : [...previous, category]
    )
  }

  function clearActivityFilters() {
    setSearchQuery('')
    setSelectedCategories([])
    setSelectedCity('')
    setDatePreset('all')
    setCustomStartDate('')
    setCustomEndDate('')
  }

  function getLocalDateKey(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const normalizedSearch = searchQuery
    .trim()
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  const today = new Date()
  const todayKey = getLocalDateKey(today)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowKey = getLocalDateKey(tomorrow)

  const weekStart = new Date(today)
  const mondayOffset = (today.getDay() + 6) % 7
  weekStart.setDate(today.getDate() - mondayOffset)
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1)

  const filteredActivities = activities.filter(activity => {
    const activityDate = new Date(activity.starts_at)
    const activityDateKey = getLocalDateKey(activityDate)
    const searchableText = `${activity.title || ''} ${activity.description || ''} ${activity.category || ''}`
      .toLocaleLowerCase('es')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')

    if (normalizedSearch && !searchableText.includes(normalizedSearch)) return false

    // Varias categorías funcionan con OR: alcanza con coincidir con una.
    if (
      selectedCategories.length > 0 &&
      !selectedCategories.includes(activity.category)
    ) return false

    if (
      selectedCity &&
      (activity.city || '').trim().toLocaleLowerCase('es') !== selectedCity.toLocaleLowerCase('es')
    ) return false

    if (datePreset === 'today' && activityDateKey !== todayKey) return false
    if (datePreset === 'tomorrow' && activityDateKey !== tomorrowKey) return false
    if (datePreset === 'week' && !(activityDate >= weekStart && activityDate < weekEnd)) return false
    if (datePreset === 'month' && !(activityDate >= monthStart && activityDate < nextMonthStart)) return false

    if (datePreset === 'custom') {
      if (customStartDate && activityDateKey < customStartDate) return false
      if (customEndDate && activityDateKey > customEndDate) return false
    }

    return true
  }).sort((a, b) => {
    const priority = {
      in_progress: 0,
      upcoming: 1,
      finished: 2
    }

    const statusA = getActivityTimelineStatus(a, currentTime)
    const statusB = getActivityTimelineStatus(b, currentTime)

    if (priority[statusA] !== priority[statusB]) {
      return priority[statusA] - priority[statusB]
    }

    if (statusA === 'finished') {
      return new Date(b.ends_at).getTime() - new Date(a.ends_at).getTime()
    }

    return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  })

  const upcomingActivities = filteredActivities.filter(
    activity => getActivityTimelineStatus(activity, currentTime) === 'upcoming'
  )
  const inProgressActivities = filteredActivities.filter(
    activity => getActivityTimelineStatus(activity, currentTime) === 'in_progress'
  )
  const finishedActivities = filteredActivities.filter(
    activity => getActivityTimelineStatus(activity, currentTime) === 'finished'
  )

  const visibleActivitiesByTab = {
    upcoming: upcomingActivities,
    in_progress: inProgressActivities,
    finished: finishedActivities
  }
  const visibleActivities = visibleActivitiesByTab[selectedActivityTab] || upcomingActivities

  // Separar Mis actividades por estado de la actividad, no por el estado de la inscripción.
  const activeMyRegistrations = myRegistrations.filter(
    registration => ['pending', 'accepted', 'confirmed'].includes(registration.status)
  )

  const myUpcomingActivities = activeMyRegistrations
    .map(registration => ({
      registration,
      activity: activities.find(item => item.id === registration.activity_id)
    }))
    .filter(item => item.activity && new Date(item.activity.ends_at).getTime() >= currentTime.getTime())
    .sort((a, b) => new Date(a.activity.starts_at) - new Date(b.activity.starts_at))

  const myFinishedActivities = activeMyRegistrations
    .map(registration => ({
      registration,
      activity: activities.find(item => item.id === registration.activity_id)
    }))
    .filter(item => item.activity && new Date(item.activity.ends_at).getTime() < currentTime.getTime())
    .sort((a, b) => new Date(b.activity.ends_at) - new Date(a.activity.ends_at))

  const myCancelledActivities = cancelledMyActivities
    .map(activity => ({
      activity,
      registration: myRegistrations.find(item => item.activity_id === activity.id)
    }))
    .sort((a, b) => new Date(b.activity.starts_at) - new Date(a.activity.starts_at))

  const myActivitiesByTab = {
    upcoming: myUpcomingActivities,
    finished: myFinishedActivities,
    cancelled: myCancelledActivities
  }
  const visibleMyActivities = myActivitiesByTab[myActivitiesTab] || myUpcomingActivities

  const activeFilterCount =
    selectedCategories.length +
    (selectedCity ? 1 : 0) +
    (datePreset !== 'all' ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0)

  return (
    <>
    <div className="app">
      <header className="navbar">
        <button
          type="button"
          className="logo logo-home-link"
          aria-label="Volver al inicio de Conectá"
          onClick={() => {
            setActiveSection('home')
            setShowProfile(false)
            setShowCreateActivity(false)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        >
          <span>Conectá</span>
        </button>

        <nav className="main-navigation" aria-label="Navegación principal">
          <button type="button" className={activeSection === 'home' ? 'nav-section-button active' : 'nav-section-button'} onClick={() => { setActiveSection('home'); setShowProfile(false); setShowCreateActivity(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Inicio</button>
          {session && !recoveryMode && <>
            <button type="button" className={activeSection === 'my-activities' ? 'nav-section-button active' : 'nav-section-button'} onClick={() => { setActiveSection('my-activities'); setShowProfile(false); setShowCreateActivity(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Mis actividades</button>
            <button type="button" className={activeSection === 'requests' ? 'nav-section-button active' : 'nav-section-button'} onClick={() => { setActiveSection('requests'); setShowProfile(false); setShowCreateActivity(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Solicitudes{receivedRegistrations.filter(item => item.status === 'pending').length > 0 ? ` (${receivedRegistrations.filter(item => item.status === 'pending').length})` : ''}</button>
          </>}
        </nav>

        {session && !recoveryMode && (
          <div style={{ position: 'relative', marginLeft: 'auto', marginRight: '14px' }}>
            <button
              type="button"
              aria-label={`Notificaciones${notifications.filter(item => !item.read_at).length ? `, ${notifications.filter(item => !item.read_at).length} sin leer` : ''}`}
              aria-expanded={showNotifications}
              onClick={() => {
                setShowNotifications(previous => !previous)
                setShowProfile(false)
                setShowCreateActivity(false)
                if (!showNotifications) loadNotifications(session)
              }}
              style={{
                position: 'relative',
                width: '44px',
                height: '44px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #e8e1f4',
                borderRadius: '14px',
                background: showNotifications ? '#f3edff' : '#ffffff',
                color: '#7041b8',
                cursor: 'pointer'
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10 21h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              {notifications.filter(item => !item.read_at).length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-5px',
                  minWidth: '19px',
                  height: '19px',
                  padding: '0 5px',
                  borderRadius: '999px',
                  background: '#e34b75',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #ffffff'
                }}>
                  {notifications.filter(item => !item.read_at).length > 99 ? '99+' : notifications.filter(item => !item.read_at).length}
                </span>
              )}
            </button>

            {showNotifications && (
              <div
                className="notifications-panel"
                role="dialog"
                aria-label="Centro de notificaciones"
                style={{
                  position: 'absolute',
                  top: '54px',
                  right: '0',
                  width: 'min(380px, calc(100vw - 28px))',
                  maxHeight: 'min(520px, calc(100vh - 110px))',
                  overflowY: 'auto',
                  background: '#ffffff',
                  border: '1px solid #eee8f5',
                  borderRadius: '18px',
                  boxShadow: '0 18px 50px rgba(42, 24, 68, 0.18)',
                  zIndex: 1000,
                  color: '#30283a'
                }}
              >
                <div style={{
                  padding: '17px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid #f0ebf5'
                }}>
                  <div>
                    <strong style={{ fontSize: '16px' }}>Notificaciones</strong>
                    <div style={{ fontSize: '12px', color: '#81778d', marginTop: '3px' }}>
                      {notifications.filter(item => !item.read_at).length} sin leer
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {notifications.some(item => !item.read_at) && (
                      <button
                        type="button"
                        onClick={markAllNotificationsAsRead}
                        style={{ border: 0, background: 'transparent', color: '#7041b8', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                      >
                        Leer todas
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label="Cerrar notificaciones"
                      onClick={() => setShowNotifications(false)}
                      style={{ border: 0, background: 'transparent', color: '#81778d', cursor: 'pointer', fontSize: '19px', lineHeight: 1 }}
                    >
                      ×
                    </button>
                  </div>
                </div>

                {notificationError && (
                  <p style={{ margin: '12px 16px', color: '#b42345', fontSize: '13px' }}>{notificationError}</p>              )}

                {notificationsLoading && notifications.length === 0 ? (
                  <p style={{ padding: '24px 18px', color: '#81778d', textAlign: 'center', fontSize: '14px' }}>
                    Cargando notificaciones...
                  </p>
                ) : notifications.length === 0 ? (
                  <div style={{ padding: '30px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '27px', marginBottom: '8px' }}>🔔</div>
                    <strong style={{ fontSize: '14px' }}>Todavía no tenés notificaciones</strong>
                    <p style={{ color: '#81778d', fontSize: '13px', margin: '6px 0 0' }}>
                      Cuando haya novedades, las vas a encontrar acá.
                    </p>
                  </div>
                ) : (
                  <div>
                    {notifications.map(notification => {
                      const actor = notificationProfiles[notification.actor_id]
                      const actorName = actor?.display_name || 'Alguien de la comunidad'
                      const dateLabel = new Date(notification.created_at).toLocaleString('es-AR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })

                      return (
                        <div
                          key={notification.id}
                          style={{
                            display: 'flex',
                            alignItems: 'stretch',
                            borderBottom: '1px solid #f3eff7',
                            background: notification.read_at ? '#ffffff' : '#faf7ff'
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleNotificationClick(notification)}
                            style={{
                              minWidth: 0,
                              flex: 1,
                              display: 'flex',
                              gap: '12px',
                              alignItems: 'flex-start',
                              textAlign: 'left',
                              padding: '14px 10px 14px 16px',
                              border: 0,
                              background: 'transparent',
                              cursor: 'pointer',
                              color: '#30283a'
                            }}
                          >
                            <span style={{
                              flex: '0 0 36px',
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              background: '#eee6fb',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#7041b8',
                              fontSize: '16px',
                              fontWeight: 700
                            }}>
                              {actorName.charAt(0).toUpperCase()}
                            </span>
                            <span style={{ minWidth: 0, flex: 1 }}>
                              <span style={{ display: 'block', fontSize: '13px', fontWeight: notification.read_at ? 500 : 700, lineHeight: 1.35 }}>
                                {notification.title}
                              </span>
                              <span style={{ display: 'block', color: '#6f6679', fontSize: '12px', lineHeight: 1.4, marginTop: '4px' }}>
                                {actorName}: {notification.body}
                              </span>
                              <span style={{ display: 'block', color: '#9a91a3', fontSize: '11px', marginTop: '6px' }}>
                                {dateLabel}
                              </span>
                            </span>
                            {!notification.read_at && (
                              <span aria-label="No leída" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8b5bd1', marginTop: '5px', flex: '0 0 8px' }} />
                            )}
                          </button>
                          <button
                            type="button"
                            aria-label={`Eliminar notificación: ${notification.title}`}
                            title="Eliminar notificación"
                            onClick={() => deleteNotification(notification.id)}
                            style={{
                              flex: '0 0 36px',
                              alignSelf: 'flex-start',
                              width: '32px',
                              height: '32px',
                              margin: '12px 10px 0 0',
                              border: 0,
                              borderRadius: '10px',
                              background: 'transparent',
                              color: '#9a91a3',
                              cursor: 'pointer',
                              fontSize: '19px',
                              lineHeight: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            ×
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {session && !recoveryMode ? (
          <div className="user-actions">
            <button
              className="login"
              onClick={() => {
                setShowProfile(true)
                setActiveSection('profile')
                setShowNotifications(false)
                setShowCreateActivity(false)
                setProfileMessage('')
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            >
              Mi perfil
            </button>
            <button className="login" onClick={handleLogout}>
              Salir
            </button>
          </div>
        ) : (
          !recoveryMode && (
            <button
              className="login"
              onClick={() => {
                setAuthMode('login')
                setShowAuth(true)
                setMessage('')
              }}
            >
              Ingresar
            </button>
          )
        )}
      </header>

      {session && !recoveryMode && activeSection === 'home' && (
        <div className="welcome">
          Ya estás conectando.
        </div>
      )}

      {session && !recoveryMode && (activeSection === 'my-activities' || activeSection === 'requests') && (
        <section className={`registration-dashboard registration-page registration-page-${activeSection}`}>
          <div className="registration-dashboard-grid">
            {activeSection === 'my-activities' && <div className="registration-panel">
              <div className="section-heading section-heading-left">
                <span>MI ESPACIO</span>
                <h2>Mis actividades</h2>
                <p>Consultá tus inscripciones y el estado de cada experiencia.</p>
              </div>

              <div
                className="activity-timeline-tabs"
                role="tablist"
                aria-label="Mis actividades por estado"
                style={{
                  display: 'flex',
                  alignItems: 'stretch',
                  justifyContent: 'flex-start',
                  gap: 'clamp(20px, 4vw, 42px)',
                  width: '100%',
                  margin: '0 auto 24px',
                  padding: '0 4px',
                  borderBottom: '1px solid #eeeaf2',
                  overflowX: 'auto'
                }}
              >
                {[
                  { id: 'upcoming', title: 'Próximas', count: myUpcomingActivities.length },
                  { id: 'finished', title: 'Finalizadas', count: myFinishedActivities.length },
                  { id: 'cancelled', title: 'Canceladas', count: myCancelledActivities.length }
                ].map(tab => {
                  const isActive = myActivitiesTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setMyActivitiesTab(tab.id)}
                      style={{
                        flex: '0 0 auto',
                        minHeight: '44px',
                        padding: '8px 3px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '7px',
                        border: 0,
                        borderBottom: isActive ? '3px solid #7650c8' : '3px solid transparent',
                        borderRadius: 0,
                        marginBottom: '-1px',
                        background: 'transparent',
                        color: isActive ? '#7650c8' : '#77717f',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontSize: '14px',
                        fontWeight: isActive ? 700 : 600,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {tab.title}
                      <span style={{
                        minWidth: '20px',
                        padding: '2px 6px',
                        borderRadius: '999px',
                        background: isActive ? '#f1eaff' : '#f3f1f5',
                        color: isActive ? '#60349b' : '#77717f',
                        fontSize: '11px',
                        lineHeight: 1.4
                      }}>
                        {tab.count}
                      </span>
                    </button>
                  )
                })}
              </div>

              {visibleMyActivities.length === 0 ? (
                <p className="registration-empty">
                  {myActivitiesTab === 'upcoming'
                    ? 'No tenés actividades próximas por ahora.'
                    : myActivitiesTab === 'finished'
                      ? 'Todavía no tenés actividades finalizadas.'
                      : 'No tenés actividades canceladas.'}
                </p>
              ) : (
                <div className="registration-list">
                  {visibleMyActivities.map(({ activity, registration }) => {
                    const isCancelled = myActivitiesTab === 'cancelled'
                    return (
                      <div
                        className="registration-item registration-item-clickable"
                        key={activity.id}
                        role="link"
                        tabIndex={0}
                        aria-label={`Abrir actividad ${activity.title}`}
                        onClick={() => navigate(`/actividad/${activity.id}`)}
                        onKeyDown={event => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            navigate(`/actividad/${activity.id}`)
                          }
                        }}
                      >
                        <div>
                          <strong>{activity.title || 'Actividad'}</strong>
                          <span>{activity.starts_at ? formatDate(activity.starts_at) : ''}</span>
                        </div>

                        {isCancelled ? (
                          <span className="registration-status status-cancelled">
                            Actividad cancelada
                          </span>
                        ) : registration?.status === 'accepted' || registration?.status === 'confirmed' ? (
                          <div className="activity-participation-message">
                            <span className="activity-participation-icon" aria-hidden="true">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m5 12.5 4.2 4.2L19 7" />
                              </svg>
                            </span>
                            <span>{registrationStatusLabel(registration.status)}</span>
                          </div>
                        ) : (
                          <span className={`registration-status status-${registration?.status || 'pending'}`}>
                            {registrationStatusLabel(registration?.status || 'pending')}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>}

            {activeSection === 'requests' && <div className="registration-panel">
              <div className="section-heading section-heading-left">
                <span>ORGANIZACIÓN</span>
                <h2>Solicitudes recibidas</h2>
                <p>Gestioná las personas que quieren sumarse a tus actividades.</p>
              </div>
              {receivedRegistrations.filter(item => item.status === 'pending').length === 0 ? (
                <p className="registration-empty">No tenés solicitudes pendientes.</p>
              ) : (
                <div className="registration-list">
                  {receivedRegistrations.filter(item => item.status === 'pending').map(registration => {
                    const activity = activities.find(item => item.id === registration.activity_id)
                    const participant = registrationProfiles[registration.user_id]
                    return (
                      <div className="organizer-request" key={registration.id}>
                        <div className="organizer-request-info">
                          <strong>{participant?.display_name || 'Participante'}</strong>
                          <span>{participant?.city || 'Ciudad no indicada'}</span>
                          <small>Actividad: {activity?.title || 'Actividad'}</small>
                        </div>
                        <div className="request-actions">
                          <button
                            className="primary request-accept"
                            type="button"
                            disabled={registrationLoading}
                            onClick={() => handleManageRegistration(registration.id, 'accepted')}
                          >
                            Aceptar
                          </button>
                          <button
                            className="secondary request-reject"
                            type="button"
                            disabled={registrationLoading}
                            onClick={() => handleManageRegistration(registration.id, 'rejected')}
                          >
                            Rechazar
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>}
          </div>
          {registrationMessage && (
            <p className="registration-message" role="status">{registrationMessage}</p>
          )}
        </section>
      )}

      {/* PERFIL */}
      {showProfile && session && !recoveryMode && activeSection === 'profile' && (
        <section className="profile-section">
          <div className="profile-card">
            <div className="profile-heading">
              <div>
                <h2>Mi perfil</h2>
                <p>Contale a la comunidad un poco sobre vos.</p>
              </div>
            </div>

            <div className="avatar-upload">
              <div className="avatar-preview">
                {avatarFile ? (
                  <img src={URL.createObjectURL(avatarFile)} alt="Vista previa" />
                ) : avatarUrl ? (
                  <img src={avatarUrl} alt="Foto de perfil" />
                ) : (
                  <span>👤</span>
                )}
              </div>

              <label className="avatar-button">
                Elegir fotografía
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={e => setAvatarFile(e.target.files?.[0] || null)}
                />
              </label>

              {avatarFile && (
                <button
                  className="primary"
                  type="button"
                  onClick={uploadAvatar}
                  disabled={profileLoading}
                >
                  {profileLoading ? 'Subiendo...' : 'Guardar fotografía'}
                </button>
              )}
            </div>

            {profileLoading && !profileName ? (
              <p>Cargando perfil...</p>
            ) : (
              <form onSubmit={saveProfile}>
                <label>
                  Nombre y apellido
                  <input
                    value={profileName}
                    onChange={e => setProfileName(e.target.value)}
                    placeholder="Tu nombre"
                    required
                  />
                </label>
                <label>
  Sexo
  <select
    value={profileSex}
    onChange={e => setProfileSex(e.target.value)}
  >
    <option value="masculino">Masculino</option>
    <option value="femenino">Femenino</option>
    <option value="neutral">Prefiero no decirlo</option>
  </select>
</label>

                <label>
                  Ciudad
                  <input
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="Ejemplo: Alta Gracia"
                  />
                </label>

                <label>
                  Sobre mí
                  <textarea
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    placeholder="Contá qué te gusta hacer y qué actividades te gustaría compartir..."
                    rows={4}
                  />
                </label>

                <button className="primary" type="submit" disabled={profileLoading}>
                  {profileLoading ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </form>
            )}

            {profileMessage && <p className="profile-message">{profileMessage}</p>}
            <PushNotificationSettings userId={session.user.id} />

            <button
              className="secondary profile-close"
              onClick={() => { setShowProfile(false); setActiveSection('home') }}
            >
              Volver al inicio
            </button>
          </div>
        </section>
      )}

      {/* AUTENTICACIÓN */}
      {showAuth && (!session || recoveryMode) && (
        <section className="auth-section">
          <div className="auth-card">
            {!recoveryMode && (
              <button className="close-auth" onClick={() => setShowAuth(false)}>
                ✕
              </button>
            )}

            {recoveryMode ? (
              <>
                <h2>Creá una nueva contraseña</h2>
                <p>Elegí una contraseña segura para volver a Conectá.</p>

                <form onSubmit={handlePasswordRecovery}>
                  <label>
                    Nueva contraseña
                    <div className="password-input-wrapper" style={{ position: 'relative', width: '100%' }}>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
      minLength={8}
                        required
                        style={{ width: '100%', boxSizing: 'border-box', paddingRight: '48px' }}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowNewPassword(previous => !previous)}
                        aria-label={showNewPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        title={showNewPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 0, background: 'transparent', padding: '6px', margin: 0, cursor: 'pointer', color: 'inherit' }}
                      >
                        <PasswordEyeIcon visible={showNewPassword} />
                      </button>
                    </div>
                  </label>

                  <label>
                    Confirmar nueva contraseña
                    <div className="password-input-wrapper" style={{ position: 'relative', width: '100%' }}>
                      <input
                        type={showConfirmNewPassword ? 'text' : 'password'}
                        value={confirmNewPassword}
                        onChange={e => setConfirmNewPassword(e.target.value)}
      minLength={8}
                        required
                        style={{ width: '100%', boxSizing: 'border-box', paddingRight: '48px' }}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowConfirmNewPassword(previous => !previous)}
                        aria-label={showConfirmNewPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        title={showConfirmNewPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 0, background: 'transparent', padding: '6px', margin: 0, cursor: 'pointer', color: 'inherit' }}
                      >
                        <PasswordEyeIcon visible={showConfirmNewPassword} />
                      </button>
                    </div>
                  </label>

                  <button className="primary auth-submit" disabled={loading}>
                    {loading ? 'Actualizando...' : 'Guardar nueva contraseña'}
                  </button>
                </form>

                {recoveryMessage && <p className="auth-message">{recoveryMessage}</p>}
              </>
            ) : (
              <>
                <h2>
                  {authMode === 'register' ? 'Creá tu cuenta' : '¡Qué bueno verte!'}
                </h2>

                <p>
                  {authMode === 'register'
                    ? 'Empezá a compartir experiencias.'
                    : 'Ingresá a tu comunidad.'}
                </p>

                <form onSubmit={handleAuth}>
                  {authMode === 'register' && (
                    <label>
                      Nombre y apellido
                      <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Tu nombre"
                        required
                      />
                    </label>
                  )}

                  <label>
                    Correo electrónico
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="tu@email.com"
                      required
                    />
                  </label>

                  <label>
  Contraseña
  <div className="password-input-wrapper" style={{ position: 'relative', width: '100%' }}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
      minLength={8}
                        required
                        style={{ width: '100%', boxSizing: 'border-box', paddingRight: '48px' }}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowPassword(previous => !previous)}
                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 0, background: 'transparent', padding: '6px', margin: 0, cursor: 'pointer', color: 'inherit' }}
                      >
                        <PasswordEyeIcon visible={showPassword} />
                      </button>
                    </div>
</label>

                  {authMode === 'register' && (
                    <label>
  Confirmar contraseña
  <div className="password-input-wrapper" style={{ position: 'relative', width: '100%' }}>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        required
                        style={{ width: '100%', boxSizing: 'border-box', paddingRight: '48px' }}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowConfirmPassword(previous => !previous)}
                        aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        title={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 0, background: 'transparent', padding: '6px', margin: 0, cursor: 'pointer', color: 'inherit' }}
                      >
                        <PasswordEyeIcon visible={showConfirmPassword} />
                      </button>
                    </div>
</label>
                  )}

                  <button className="primary auth-submit" disabled={loading}>
                    {loading
                      ? 'Procesando...'
                      : authMode === 'register'
                        ? 'Crear mi cuenta'
                        : 'Ingresar'}
                  </button>
                </form>

                {authMode === 'login' && (
                  <p className="auth-switch">
                    <button type="button" onClick={handleForgotPassword} disabled={loading}>
                      ¿Olvidaste tu contraseña?
                    </button>
                  </p>
                )}

                {message && <p className="auth-message">{message}</p>}

                <p className="auth-switch">
                  {authMode === 'register'
                    ? '¿Ya tenés una cuenta?'
                    : '¿Todavía no tenés cuenta?'}{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode(authMode === 'register' ? 'login' : 'register')
                      setMessage('')
                    }}
                  >
                    {authMode === 'register' ? 'Ingresá' : 'Registrate'}
                  </button>
                </p>
              </>
            )}
          </div>
        </section>
      )}

      {/* INICIO */}
      <main id="inicio" style={{ display: activeSection === 'home' ? 'block' : 'none' }}>
        <section className="hero">
          <span className="tag">LAS EXPERIENCIAS NOS UNEN</span>

          <h1>
            Menos pantalla.
            <br />
            <span>Más conexiones reales.</span>
          </h1>

          <p>
            Encontrá personas con tus mismos intereses,
            descubrí actividades y compartí momentos
            que valen la pena.
          </p>

          <div className="hero-buttons">
            <button
              className="primary"
              onClick={() => document.getElementById('actividades')?.scrollIntoView({
                behavior: 'smooth'
              })}
            >
              Explorar actividades
            </button>

            <button className="secondary" onClick={openActivityForm}>
              Crear una actividad
            </button>
          </div>

          <div className="location">
            📍 Empezamos en Alta Gracia, Córdoba
          </div>
        </section>

        {/* FORMULARIO DE CREACIÓN */}
        {showCreateActivity && session && (
          <section className="create-activity-section" id="crear-actividad">
            <div className="create-activity-card">
              <div className="create-heading">
                <div>
                  <span className="tag">COMPARTÍ UNA EXPERIENCIA</span>
                  <h2>Crear una actividad</h2>
                  <p>Invitá a otras personas a compartir algo que te gusta.</p>
                </div>
                <button
                  className="close-create"
                  type="button"
                  onClick={() => setShowCreateActivity(false)}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateActivity}>
                <div className="form-group">
                  <label>
                    Nombre de la actividad *
                    <input
                      value={activityForm.title}
                      onChange={e => updateActivityField('title', e.target.value)}
                      placeholder="Ej. Tarde de lectura en el Tajamar"
                      maxLength={100}
                      required
                    />
                  </label>
                </div>

                <div className="form-group">
                  <label>
                    Descripción *
                    <textarea
                      value={activityForm.description}
                      onChange={e => updateActivityField('description', e.target.value)}
                      placeholder="Contá de qué se trata, qué vamos a hacer y a quién está dirigida..."
                      rows={5}
                      required
                    />
                  </label>
                </div>

                <div className="form-grid">
                  <label>
                    Categoría *
                    <select
                      value={activityForm.category}
                      onChange={e => updateActivityField('category', e.target.value)}
                      required
                    >
                      <option value="">Elegí una categoría</option>
                      {categories.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Ciudad *
                    <input
                      value={activityForm.city}
                      onChange={e => {
                        updateActivityField('city', e.target.value)
                        updateActivityField('meeting_latitude', null)
                        updateActivityField('meeting_longitude', null)
                      }}
                      placeholder="Ej. Alta Gracia"
                      required
                    />
                  </label>
                </div>

                <div className="form-group">
                  <label>
                    Punto de encuentro *
                    <input
                      value={activityForm.meeting_point}
                      onChange={e => {
                        updateActivityField('meeting_point', e.target.value)
                        updateActivityField('meeting_latitude', null)
                        updateActivityField('meeting_longitude', null)
                      }}
                      placeholder="Ej. Entrada principal del Tajamar"
                      required
                    />
                  </label>
                  <div className="meeting-point-map-field">
                    <strong>Ubicá el punto exacto en el mapa *</strong>
                    <p>Hacé clic en el mapa para colocar el marcador en el lugar donde se van a encontrar.</p>
                    <MeetingPointPicker
                      latitude={activityForm.meeting_latitude}
                      longitude={activityForm.meeting_longitude}
                      searchText={activityForm.meeting_point}
                      city={activityForm.city}
                      onChange={({ latitude, longitude, meeting_point }) => {
                        setActivityForm(previous => ({
                          ...previous,
                          meeting_latitude: latitude,
                          meeting_longitude: longitude,
                          ...(meeting_point ? { meeting_point } : {}),
                        }))
                      }}
                    />
                  </div>
                </div>

                <div className="form-grid">
                  <DateTimePicker
                    label="Fecha y hora de inicio"
                    value={activityForm.starts_at}
                    onChange={value => updateActivityField('starts_at', value)}
                    required
                  />

                  <DateTimePicker
                    label="Fecha y hora de finalización"
                    value={activityForm.ends_at}
                    onChange={value => updateActivityField('ends_at', value)}
                    min={activityForm.starts_at || ''}
                    required
                  />
                </div>

                <div className="form-divider" />

                <h3>Participantes e inscripción</h3>

                <div className="form-grid">
                  <label>
                    Participantes mínimos *
                    <input
                      type="number"
                      min="1"
                      value={activityForm.min_participants}
                      onChange={e => updateActivityField('min_participants', e.target.value)}
                      required
                    />
                  </label>

                  <label>
                    Capacidad máxima
                    <input
                      type="number"
                      min="1"
                      value={activityForm.capacity}
                      onChange={e => updateActivityField('capacity', e.target.value)}
                      placeholder="Sin límite"
                    />
                  </label>
                </div>

                <label>
                  Modalidad de inscripción
                  <select
                    value={activityForm.registration_mode}
                    onChange={e => updateActivityField('registration_mode', e.target.value)}
                  >
                    <option value="automatic">Confirmación automática</option>
                    <option value="approval">Requiere aprobación del organizador</option>
                  </select>
                </label>

                <DateTimePicker
                  label="Fecha límite de inscripción"
                  value={activityForm.signup_deadline}
                  onChange={value => updateActivityField('signup_deadline', value)}
                />

                <div className="form-divider" />

                <h3>Precio de la actividad</h3>

                <label className="paid-checkbox">
                  <input
                    type="checkbox"
                    checked={activityForm.is_paid}
                    onChange={e => updateActivityField('is_paid', e.target.checked)}
                  />
                  Esta actividad tiene un costo
                </label>

                {activityForm.is_paid && (
                  <div className="form-grid">
                    <label>
                      Precio por persona *
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={activityForm.price_amount}
                        onChange={e => updateActivityField('price_amount', e.target.value)}
                        placeholder="Ej. 5000"
                        required
                      />
                    </label>

                    <label>
                      Detalles del precio
                      <input
                        value={activityForm.price_details}
                        onChange={e => updateActivityField('price_details', e.target.value)}
                        placeholder="Ej. Incluye materiales"
                      />
                    </label>
                  </div>
                )}

                <p className="required-note">* Campos obligatorios</p>

                {activityMessage && (
                  <p className="activity-message">{activityMessage}</p>
                )}

                <div className="create-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setShowCreateActivity(false)}
                  >
                    Cancelar
                  </button>

                  <button type="submit" className="primary" disabled={loading}>
                    {loading ? 'Publicando...' : 'Publicar actividad'}
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

        {/* ACTIVIDADES */}
        <section
          className="activities"
          id="actividades"
          style={{
            width: 'calc(100% - 40px)',
            maxWidth: '1320px',
            marginLeft: 'auto',
            marginRight: 'auto',
            boxSizing: 'border-box'
          }}
        >
          <div className="section-heading">
            <span>DESCUBRÍ</span>
            <h2>Actividades para compartir</h2>
            <p>Personas reales, experiencias reales.</p>
          </div>

          {activities.length > 0 && (
            <div
              className="activity-search-panel"
              style={{
                width: '100%',
                maxWidth: '980px',
                boxSizing: 'border-box',
                margin: '0 auto 30px',
                padding: '20px',
                background: '#ffffff',
                border: '1px solid #eee8f5',
                borderRadius: '20px',
                boxShadow: '0 8px 28px rgba(42, 24, 68, 0.06)',
                display: 'grid',
                gap: '18px'
              }}
            >
              <div>
                <label htmlFor="activity-search" style={{ display: 'block', fontWeight: 700, marginBottom: '8px' }}>
                  ¿Qué tenés ganas de hacer?
                </label>
                <input
                  id="activity-search"
                  type="search"
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                  placeholder="Buscá por actividad, título o descripción..."
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '13px 15px',
                    border: '1px solid #ddd4e9',
                    borderRadius: '12px',
                    fontSize: '15px'
                  }}
                />
              </div>

              <div>
                <strong style={{ display: 'block', marginBottom: '9px' }}>Categorías</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {categories.map(category => {
                    const selected = selectedCategories.includes(category)
                    return (
                      <button
                        key={category}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleSearchCategory(category)}
                        style={{
                          border: selected ? '1px solid #8050c6' : '1px solid #e4ddec',
                          borderRadius: '999px',
                          padding: '8px 12px',
                          background: selected ? '#f1eaff' : '#ffffff',
                          color: selected ? '#60349b' : '#51485c',
                          fontSize: '13px',
                          fontWeight: selected ? 700 : 500,
                          cursor: 'pointer'
                        }}
                      >
                        {selected ? '✓ ' : ''}{category}
                      </button>
                    )
                  })}
                </div>
                {selectedCategories.length > 1 && (
                  <small style={{ display: 'block', marginTop: '7px', color: '#786d83' }}>
                    Se mostrarán actividades de cualquiera de las categorías elegidas.
                  </small>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
                <label style={{ display: 'grid', gap: '7px', fontWeight: 700 }}>
                  Ubicación
                  <select
                    value={selectedCity}
                    onChange={event => setSelectedCity(event.target.value)}
                    style={{ width: '100%', padding: '11px 12px', border: '1px solid #ddd4e9', borderRadius: '10px', background: '#fff' }}
                  >
                    <option value="">Todas las localidades</option>
                    {availableCities.map(cityOption => (
                      <option key={cityOption} value={cityOption}>{cityOption}</option>
                    ))}
                  </select>
                </label>

                <div style={{ display: 'grid', gap: '7px' }}>
                  <strong>Fecha</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                    {[
                      ['all', 'Cualquier fecha'],
                      ['today', 'Hoy'],
                      ['tomorrow', 'Mañana'],
                      ['week', 'Esta semana'],
                      ['month', 'Este mes']
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={datePreset === value}
                        onClick={() => setDatePreset(value)}
                        style={{
                          border: datePreset === value ? '1px solid #8050c6' : '1px solid #e4ddec',
                          borderRadius: '9px',
                          padding: '8px 10px',
                          background: datePreset === value ? '#f1eaff' : '#fff',
                          color: datePreset === value ? '#60349b' : '#51485c',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        {label}
                      </button>
                    ))}
                    <button
                      type="button"
                      aria-pressed={datePreset === 'custom'}
                      onClick={() => setDatePreset('custom')}
                      style={{
                        border: datePreset === 'custom' ? '1px solid #8050c6' : '1px solid #e4ddec',
                        borderRadius: '9px',
                        padding: '8px 10px',
                        background: datePreset === 'custom' ? '#f1eaff' : '#fff',
                        color: datePreset === 'custom' ? '#60349b' : '#51485c',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Elegir período
                    </button>
                  </div>
                </div>
              </div>

              {datePreset === 'custom' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px' }}>
                  <label style={{ display: 'grid', gap: '7px', fontWeight: 700 }}>
                    Desde
                    <input
                      type="date"
                      value={customStartDate}
                      max={customEndDate || undefined}
                      onChange={event => setCustomStartDate(event.target.value)}
                      style={{ padding: '11px 12px', border: '1px solid #ddd4e9', borderRadius: '10px' }}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: '7px', fontWeight: 700 }}>
                    Hasta
                    <input
                      type="date"
                      value={customEndDate}
                      min={customStartDate || undefined}
                      onChange={event => setCustomEndDate(event.target.value)}
                      style={{ padding: '11px 12px', border: '1px solid #ddd4e9', borderRadius: '10px' }}
                    />
                  </label>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <span style={{ color: '#6f6679', fontSize: '13px' }}>
                  {visibleActivities.length} {visibleActivities.length === 1 ? 'actividad en esta sección' : 'actividades en esta sección'}
                </span>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={clearActivityFilters}
                    style={{ border: 0, background: 'transparent', color: '#7041b8', fontWeight: 700, cursor: 'pointer', padding: '6px 0' }}
                  >
                    Limpiar búsqueda y filtros
                  </button>
                )}
              </div>
            </div>
          )}

          {activities.length > 0 && (
            <div
              className="activity-timeline-tabs"
              role="tablist"
              aria-label="Secciones de actividades"
              style={{
                display: 'flex',
                alignItems: 'stretch',
                justifyContent: 'center',
                gap: 'clamp(28px, 5vw, 54px)',
                width: '100%',
                maxWidth: '720px',
                margin: '0 auto 26px',
                padding: '0 4px',
                borderBottom: '1px solid #eeeaf2'
              }}
            >
              {[
                { id: 'upcoming', title: 'Próximas' },
                { id: 'in_progress', title: 'En curso' },
                { id: 'finished', title: 'Anteriores' }
              ].map(tab => {
                const isActive = selectedActivityTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setSelectedActivityTab(tab.id)}
                    style={{
                      flex: '0 1 auto',
                      minWidth: 0,
                      minHeight: '44px',
                      padding: '8px 3px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 0,
                      borderBottom: isActive ? '3px solid #7650c8' : '3px solid transparent',
                      borderRadius: 0,
                      marginBottom: '-1px',
                      background: 'transparent',
                      color: isActive ? '#7650c8' : '#77717f',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: '14px',
                      fontWeight: isActive ? 700 : 600,
                      whiteSpace: 'nowrap',
                      transition: 'color 160ms ease, border-color 160ms ease'
                    }}
                  >
                    {tab.title}
                  </button>
                )
              })}
            </div>
          )}

          {activities.length === 0 ? (
            <p className="empty-state">
              Todavía no hay actividades publicadas.
              ¡Pronto vas a encontrar nuevas propuestas!
            </p>
          ) : visibleActivities.length === 0 ? (
            <p className="empty-state">
              {selectedActivityTab === 'upcoming'
                ? 'No hay próximas actividades que coincidan con esos criterios.'
                : selectedActivityTab === 'in_progress'
                  ? 'No hay actividades en curso que coincidan con esos criterios.'
                  : 'Todavía no hay actividades anteriores que coincidan con esos criterios.'}
              {activeFilterCount > 0 && ' Probá cambiar la búsqueda o limpiar los filtros.'}
            </p>
          ) : (
            <div
              className="cards"
              style={{
                width: '100%',
                maxWidth: '1180px',
                marginLeft: 'auto',
                marginRight: 'auto'
              }}
            >
              {visibleActivities.map(activity => (
                <article
  className="activity-card"
  key={activity.id}
  role="link"
  tabIndex={0}
  onClick={event => {
    if (event.target.closest('button, a, input, textarea, select')) return
    navigate(`/actividad/${activity.id}`)
  }}
  onKeyDown={event => {
    if (
      (event.key === 'Enter' || event.key === ' ') &&
      event.target === event.currentTarget
    ) {
      event.preventDefault()
      navigate(`/actividad/${activity.id}`)
    }
  }}
>
                  <div className="card-image reading">
  <img
    src={categoryImages[activity.category] || categoryImages['Otros']}
    alt={`Imagen de la categoría ${activity.category || 'Otros'}`}
    loading="lazy"
    style={{
      display: 'block',
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    }}
  />
</div>

                  <span className="activity-category">{activity.category}</span>

                  <h3 className="activity-card-title">
                    {activity.title}
                  </h3>
                  <button
                    type="button"
                    className="activity-share-button"
                    aria-label={`Compartir ${activity.title}`}
                    onClick={() => shareActivity(activity)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="18" cy="5" r="3" />
                      <circle cx="6" cy="12" r="3" />
                      <circle cx="18" cy="19" r="3" />
                      <path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4" />
                    </svg>
                    Compartir
                  </button>
                  {shareFeedbackActivityId === activity.id && (
                    <span className="activity-share-feedback" role="status">Enlace copiado</span>
                  )}
                  {shareFeedbackActivityId === `error-${activity.id}` && (
                    <span className="activity-share-feedback" role="status">No se pudo compartir el enlace</span>
                  )}

                  {(() => {
                    const timelineStatus = getActivityTimelineStatus(activity, currentTime)
                    const timelineLabels = {
                      upcoming: 'Próxima',
                      in_progress: 'En curso',
                      finished: 'Finalizada'
                    }
                    const timelineStyles = {
                      upcoming: { background: '#eaf1ff', color: '#3157a4' },
                      in_progress: { background: '#e6f5ed', color: '#216b43' },
                      finished: { background: '#efedf1', color: '#625b69' }
                    }

                    return (
                      <span
                        className={`activity-timeline-badge activity-timeline-${timelineStatus}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          width: 'fit-content',
                          margin: '8px 0',
                          padding: '5px 10px',
                          borderRadius: '999px',
                          fontSize: '12px',
                          fontWeight: 700,
                          ...timelineStyles[timelineStatus]
                        }}
                      >
                        {timelineLabels[timelineStatus]}
                      </span>
                    )
                  })()}

{activity.status === 'confirmed' && (
  <div className="activity-confirmed-badge">
    <span className="activity-confirmed-icon">✓</span>
    <span>Actividad confirmada</span>
  </div>
)}
                  <p>{activity.description}</p>

                  <div className="activity-details">
                    <p>📍 {activity.city}</p>
                    <p>📌 {activity.meeting_point}</p>
                    <p>📅 {formatDate(activity.starts_at)}</p>
                    <p>🕒 {formatTime(activity.starts_at)}</p>
                    <p>
  👥 {publicActivityCounts[activity.id] ?? '...'} participantes
</p>
                    <p>
                      👥 {activity.capacity
                        ? `Hasta ${activity.capacity} personas`
                        : 'Sin límite de participantes'}
                    </p>
                    <p>
                      {activity.is_paid
                        ? `💰 $${Number(activity.price_amount).toLocaleString('es-AR')}`
                        : '🎉 Actividad gratuita'}
                    </p>
                  </div>

                  {activity.registration_mode === 'approval' && (
                    <span className="approval-label">Inscripción sujeta a aprobación</span>
                  )}

                  {session?.user?.id === activity.organizer_id ? (
                    <button
                      className="activity-owner-toggle"
                      type="button"
                      aria-expanded={expandedActivityId === activity.id}
                      onClick={() => toggleActivityManagement(activity)}
                    >
                      {expandedActivityId === activity.id ? 'Cerrar administración ▲' : 'Administrar mi actividad ▼'}
                    </button>
                  ) : session ? (
                    (() => {
                      const registration = myRegistrations.find(
                        item => item.activity_id === activity.id
                      )
                  if (registration) {


  return (
 <div className="activity-registration-result">
  {registration.status === 'accepted' || registration.status === 'confirmed' ? (
    <div className="activity-participation-message">
      <span className="activity-participation-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="m5 12.5 4.2 4.2L19 7" />
        </svg>
      </span>
      <span>{registrationStatusLabel(registration.status)}</span>
     </div>
  ) : (
    <span className={`registration-status status-${registration.status}`}>
      {registrationStatusLabel(registration.status)}
    </span>
  )}
</div>
  )
}
                      return (
                        <button
                          className="primary activity-join-button"
                          type="button"
                          disabled={registrationLoading}
                          onClick={() => handleJoinActivity(activity)}
                        >
                          {registrationLoading ? 'Procesando...' : 'Quiero participar'}
                        </button>
                      )
                    })()
                  ) : (
                    <button
                      className="primary activity-join-button"
                      type="button"
                      onClick={() => handleJoinActivity(activity)}
                    >
                      Quiero participar
                    </button>
                  )}

                  {expandedActivityId === activity.id && session?.user?.id === activity.organizer_id && (
                    <div className="activity-admin-panel">
                      <div className="activity-admin-heading">
                        <h4>Administrar actividad</h4>
                        <div className="activity-admin-actions">
                          {getActivityTimelineStatus(activity, currentTime) === 'upcoming' ? (
                            <button type="button" className="secondary" onClick={() => startEditingActivity(activity)} disabled={adminLoading}>Editar</button>
                          ) : (
                            <span className="activity-edit-locked" role="status">Edición cerrada: la actividad ya comenzó</span>
                          )}
                          <button type="button" className="secondary danger-button" onClick={() => openCancellationDialog(activity)} disabled={adminLoading || activity.status === 'cancelled'}>Cancelar actividad</button>
                        </div>
                      </div>

                      <h4>Participantes e inscripciones</h4>
                      {(() => {
  const registrations = receivedRegistrations.filter(
    item => item.activity_id === activity.id && item.status !== 'rejected'
  )

  const pending = registrations.filter(
    item => item.status === 'pending'
  )

  const accepted = registrations.filter(
    item => item.status === 'accepted' || item.status === 'confirmed'
  )

  return (
    <>
      <p className="admin-counts">
        {accepted.length + 1} confirmados · {pending.length} pendientes
      </p>

      {/* ORGANIZADOR */}
      <div className="admin-participant admin-organizer">
        <div className="admin-participant-person">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" />
          ) : (
            <span className="admin-avatar-placeholder">👤</span>
          )}

          <div>
            <strong>{profileName || 'Organizador'}</strong>
            <small>{city || 'Ciudad no indicada'}</small>
          </div>
        </div>

        <span className="registration-status status-confirmed">
          Organizador
        </span>
      </div>

      {/* INSCRIPTOS */}
      {registrations.length === 0 ? (
        <p className="registration-empty">
          Todavía no hay otras inscripciones para esta actividad.
        </p>
      ) : (
        registrations.map(registration => {
          const participant = registrationProfiles[registration.user_id]

          return (
            <div className="admin-participant" key={registration.id}>
              <div className="admin-participant-person">
                {participant?.avatar_url ? (
                  <img src={participant.avatar_url} alt="" />
                ) : (
                  <span className="admin-avatar-placeholder">👤</span>
                )}

                <div>
                  <strong>{participant?.display_name || 'Participante'}</strong>
                  <small>{participant?.city || 'Ciudad no indicada'}</small>
                </div>
              </div>

              <span className={`registration-status status-${registration.status}`}>
                {registrationStatusLabel(registration.status)}
              </span>

              {registration.status === 'pending' && (
                <div className="request-actions">
                  <button
                    className="primary request-accept"
                    type="button"
                    disabled={registrationLoading || adminLoading}
                    onClick={() => handleManageRegistration(registration.id, 'accepted')}
                  >
                    Aceptar
                  </button>

                  <button
                    className="secondary request-reject"
                    type="button"
                    disabled={registrationLoading || adminLoading}
                    onClick={() => handleManageRegistration(registration.id, 'rejected')}
                  >
                    Rechazar
                  </button>
                </div>
              )}
            </div>
          )
        })
      )}
    </>
  )
})()}

                      {adminMessage && <p className="registration-message" role="status">{adminMessage}</p>}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer id="nosotros" className="site-footer">
        <button
          type="button"
          className="footer-brand"
          aria-label="Volver al inicio de Conectá"
          onClick={() => {
            setActiveSection('home')
            setShowProfile(false)
            setShowCreateActivity(false)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        >
          Conectá
        </button>
        <p>Las mejores experiencias se viven juntos.</p>
      </footer>
    </div>

    {cancellationTarget && createPortal(
      <div
        className="activity-modal-overlay"
        onClick={() => !adminLoading && setCancellationTarget(null)}
        role="presentation"
      >
        <section
          className="activity-edit-form"
          onClick={event => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="activity-cancel-title"
        >
          <div className="activity-edit-header">
            <div>
              <span className="tag">GESTIÓN DE ACTIVIDAD</span>
              <h2 id="activity-cancel-title">Cancelar actividad</h2>
              <p>Se conservarán las inscripciones y se avisará a las personas confirmadas.</p>
            </div>
            <button
              type="button"
              className="activity-edit-close"
              aria-label="Cerrar"
              onClick={() => setCancellationTarget(null)}
              disabled={adminLoading}
            >✕</button>
          </div>
          <p><strong>{cancellationTarget.title}</strong></p>
          <label htmlFor="activity-cancellation-reason">Motivo de la cancelación (opcional)</label>
          <textarea
            id="activity-cancellation-reason"
            rows={4}
            maxLength={1000}
            value={cancellationReason}
            onChange={event => setCancellationReason(event.target.value)}
            placeholder="Si querés, explicá brevemente por qué se cancela."
            disabled={adminLoading}
          />
          <small>{cancellationReason.length}/1000 caracteres</small>
          {adminMessage && <p className="activity-edit-message" role="status">{adminMessage}</p>}
          <div className="create-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => setCancellationTarget(null)}
              disabled={adminLoading}
            >Volver</button>
            <button
              type="button"
              className="primary danger-button"
              onClick={handleCancelActivity}
              disabled={adminLoading}
            >{adminLoading ? 'Cancelando...' : 'Confirmar cancelación'}</button>
          </div>
        </section>
      </div>,
      document.body
    )}

    {editingActivity && getActivityTimelineStatus(editingActivity, currentTime) === 'upcoming' && createPortal(
      <div className="activity-modal-overlay"
        onClick={() => !adminLoading && setEditingActivityId(null)}
        role="presentation">
        <form className="activity-edit-form"
          onClick={event => event.stopPropagation()}
          onSubmit={event => {
            console.log('[Conectá] Submit del formulario de edición', { editingActivityId, hasActivity: Boolean(editingActivity) })
            saveEditedActivity(event, editingActivity)
          }}
          role="dialog" aria-modal="true" aria-labelledby="activity-edit-title">
          <div className="activity-edit-header">
            <div>
              <span className="tag">TU EXPERIENCIA</span>
              <h2 id="activity-edit-title">Editar actividad</h2>
              <p>Modificá los detalles de tu propuesta.</p>
            </div>
            <button type="button" className="activity-edit-close" aria-label="Cerrar"
              onClick={() => setEditingActivityId(null)} disabled={adminLoading}>✕</button>
          </div>
          <label>Nombre de la actividad *
            <input value={editActivityForm.title} onChange={e => updateEditActivityField('title', e.target.value)} required maxLength={100} />
          </label>
          <label>Descripción *
            <textarea rows={4} value={editActivityForm.description} onChange={e => updateEditActivityField('description', e.target.value)} required />
          </label>
          <div className="form-grid">
            <label>Categoría *
              <select value={editActivityForm.category} onChange={e => updateEditActivityField('category', e.target.value)} required>
                <option value="">Elegí una categoría</option>
                {categories.map(category => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label>Ciudad *
              <input
                value={editActivityForm.city}
                onChange={e => {
                  updateEditActivityField('city', e.target.value)
                  updateEditActivityField('meeting_latitude', null)
                  updateEditActivityField('meeting_longitude', null)
                }}
                required
              />
            </label>
          </div>
          <label>Punto de encuentro *
            <input
              value={editActivityForm.meeting_point}
              onChange={e => {
                updateEditActivityField('meeting_point', e.target.value)
                updateEditActivityField('meeting_latitude', null)
                updateEditActivityField('meeting_longitude', null)
              }}
              required
            />
          </label>
          <div className="meeting-point-map-field">
            <strong>Ubicá el punto exacto en el mapa *</strong>
            <p>Buscá el lugar por nombre o hacé clic en el mapa para ajustar el marcador.</p>
            <MeetingPointPicker
              latitude={editActivityForm.meeting_latitude}
              longitude={editActivityForm.meeting_longitude}
              searchText={editActivityForm.meeting_point}
              city={editActivityForm.city}
              onChange={({ latitude, longitude, meeting_point }) => {
                setEditActivityForm(previous => ({
                  ...previous,
                  meeting_latitude: latitude,
                  meeting_longitude: longitude,
                  ...(meeting_point ? { meeting_point } : {}),
                }))
              }}
            />
          </div>
         
<div className="form-grid">
  <DateTimePicker
    label="Fecha y hora de inicio"
    value={editActivityForm.starts_at}
    onChange={value => updateEditActivityField('starts_at', value)}
    required
  />

  <DateTimePicker
    label="Fecha y hora de finalización"
    value={editActivityForm.ends_at}
    onChange={value => updateEditActivityField('ends_at', value)}
    min={editActivityForm.starts_at || ''}
    required
  />
</div>
<div className="form-divider" />
<h3>Participantes e inscripción</h3>
<div className="form-grid">

            <label>Participantes mínimos *
              <input type="number" min="1" value={editActivityForm.min_participants} onChange={e => updateEditActivityField('min_participants', e.target.value)} required />
            </label>
            <label>Capacidad máxima
              <input type="number" min="1" value={editActivityForm.capacity} onChange={e => updateEditActivityField('capacity', e.target.value)} placeholder="Sin límite" />
            </label>
          </div>
          <label>Modalidad de inscripción
            <select value={editActivityForm.registration_mode} onChange={e => updateEditActivityField('registration_mode', e.target.value)}>
              <option value="automatic">Confirmación automática</option>
              <option value="approval">Requiere aprobación del organizador</option>
            </select>
          </label>
          <DateTimePicker
            label="Fecha límite de inscripción"
            value={editActivityForm.signup_deadline}
            onChange={value => updateEditActivityField('signup_deadline', value)}
          />
          <div className="form-divider" />
          <h3>Precio de la actividad</h3>
          <label className="paid-checkbox">
            <input type="checkbox" checked={editActivityForm.is_paid} onChange={e => updateEditActivityField('is_paid', e.target.checked)} />
            Esta actividad tiene un costo
          </label>
          {editActivityForm.is_paid && (
            <div className="form-grid">
              <label>Precio por persona *
                <input type="number" min="0.01" step="0.01" value={editActivityForm.price_amount} onChange={e => updateEditActivityField('price_amount', e.target.value)} required />
              </label>
              <label>Detalles del precio
                <input value={editActivityForm.price_details} onChange={e => updateEditActivityField('price_details', e.target.value)} />
              </label>
            </div>
          )}
          {adminMessage && <p className="activity-edit-message" role="status">{adminMessage}</p>}
          <div className="create-actions">
            <button type="button" className="secondary" onClick={() => setEditingActivityId(null)} disabled={adminLoading}>Cancelar</button>
            <button type="submit" className="primary" disabled={adminLoading}>
              {adminLoading ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>,
      document.body
    )}
    </>
  )
}

export default App

