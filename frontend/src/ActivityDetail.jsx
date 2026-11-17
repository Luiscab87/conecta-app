import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { supabase } from './lib/supabase'
import ActivityCommunity from './ActivityCommunity'
import MeetingPointPicker from './components/MeetingPointPicker'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

const meetingPointDisplayIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

function MeetingPointDisplay({ latitude, longitude, address, city }) {
  if (latitude == null || longitude == null) return null

  const lat = Number(latitude)
  const lng = Number(longitude)

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`

  return (
    <section className="activity-meeting-map" style={{ margin: '24px 0' }}>
      <h2 style={{ marginBottom: '8px' }}>Punto de encuentro</h2>
      <p style={{ marginTop: 0, marginBottom: '14px' }}>
        <strong>{address || 'Ubicación de la actividad'}</strong>
        {city ? ` · ${city}` : ''}
      </p>

      <div style={{ height: '240px', width: '100%', overflow: 'hidden', borderRadius: '16px' }}>
        <MapContainer
          center={[lat, lng]}
          zoom={16}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={[lat, lng]} icon={meetingPointDisplayIcon} />
        </MapContainer>
      </div>

      <a
        href={googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="primary activity-detail-button"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: '14px',
          textDecoration: 'none'
        }}
      >
        Cómo llegar
      </a>
    </section>
  )
}

const emptyForm = {
  title: '',
  description: '',
  category: '',
  categories: [],
  starts_at: '',
  ends_at: '',
  city: '',
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

function getActivityCategories(activity) {
  if (Array.isArray(activity?.categories) && activity.categories.length > 0) {
    return activity.categories.filter(Boolean).slice(0, 3)
  }
  return activity?.category ? [activity.category] : []
}

function toDateTimeLocal(value) {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60000)
    .toISOString()
    .slice(0, 16)
}

function isActivityUpcoming(activity, now = new Date()) {
  if (!activity?.starts_at) return false

  const start = new Date(activity.starts_at).getTime()
  return Number.isFinite(start) && now.getTime() < start
}

function ActivityDetail() {
  const { activityId } = useParams()

  const [activity, setActivity] = useState(null)
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [organizerName, setOrganizerName] = useState('Organizador')
  const [organizerRole, setOrganizerRole] = useState('Organiza')
  const [session, setSession] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [registration, setRegistration] = useState(null)
  const [loading, setLoading] = useState(true)
  const [registrationLoading, setRegistrationLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [shareMessage, setShareMessage] = useState('')

  // Administración de participantes
  const [participants, setParticipants] = useState([])
  const [pendingRequests, setPendingRequests] = useState([])
  const [requestActionLoading, setRequestActionLoading] = useState(false)
  const [requestActionMessage, setRequestActionMessage] = useState('')
  const [showParticipantsManager, setShowParticipantsManager] = useState(false)
  const [removalHistory, setRemovalHistory] = useState([])
  const [participantsLoading, setParticipantsLoading] = useState(false)
  const [participantsError, setParticipantsError] = useState('')
  const [removalTarget, setRemovalTarget] = useState(null)
  const [removalReason, setRemovalReason] = useState('')
  const [removalLoading, setRemovalLoading] = useState(false)
  const [removalMessage, setRemovalMessage] = useState('')

  const isOrganizer =
    session?.user?.id === activity?.organizer_id

  const isCompleted = activity?.status === 'completed'
  const isCancelled = activity?.status === 'cancelled'
  const activityStart = activity?.starts_at ? new Date(activity.starts_at).getTime() : NaN
  const activityEnd = activity?.ends_at ? new Date(activity.ends_at).getTime() : NaN
  const hasActivityStarted = Number.isFinite(activityStart) && currentTime.getTime() >= activityStart
  const hasActivityFinished = isCompleted || (Number.isFinite(activityEnd) && currentTime.getTime() >= activityEnd)
  const registrationActionsClosed = isCancelled || hasActivityStarted || hasActivityFinished

  const canManageParticipants = Boolean((isOrganizer || isAdmin) && !isCancelled)
  const canRemoveParticipants = Boolean(canManageParticipants && !registrationActionsClosed)
  const canEditActivity = Boolean(isOrganizer && !isCancelled && isActivityUpcoming(activity, currentTime))

  useEffect(() => {
    const intervalId = window.setInterval(() => setCurrentTime(new Date()), 1000)
    return () => window.clearInterval(intervalId)
  }, [])

  // Edición
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState(emptyForm)
  const [editLoading, setEditLoading] = useState(false)
  const [editMessage, setEditMessage] = useState('')

  async function shareCurrentActivity() {
    if (!activity) return

    const url = `${window.location.origin}/actividad/${activity.id}`
    const shareData = {
      title: activity.title || 'Actividad en Conectá',
      text: `Mirá esta actividad en Conectá: ${activity.title || 'Una experiencia para compartir'}`,
      url
    }

    try {
      if (navigator.share) {
        await navigator.share(shareData)
        setShareMessage('')
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        setShareMessage('Enlace copiado. ¡Ya podés compartirlo!')
      } else {
        window.prompt('Copiá el enlace para compartir esta actividad:', url)
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        console.error('No se pudo compartir la actividad:', error)
        setShareMessage('No se pudo compartir el enlace.')
      }
    }
  }

  // Sesión
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Consultar el rol administrativo de la sesión actual.
  useEffect(() => {
    let active = true

    async function checkAdminRole() {
      setIsAdmin(false)

      if (!session?.user?.id) return

      try {
        const { data, error } = await supabase.rpc('is_conecta_admin')

        if (error) throw error
        if (active) setIsAdmin(data === true)
      } catch (err) {
        console.error('Error verificando rol administrativo:', err.message)
        if (active) setIsAdmin(false)
      }
    }

    checkAdminRole()

    return () => {
      active = false
    }
  }, [session])

  // Cargar participantes confirmados e historial de retiros.
  useEffect(() => {
    let active = true

    async function loadParticipantsAndHistory() {
      if (!activity?.id || !canManageParticipants) {
        setParticipants([])
        setPendingRequests([])
        setRemovalHistory([])
        return
      }

      setParticipantsLoading(true)
      setParticipantsError('')

      try {
        const { data: registrationData, error: registrationError } =
          await supabase
            .from('registrations')
            .select('id, activity_id, user_id, status, created_at')
            .eq('activity_id', activity.id)
            .in('status', ['accepted', 'confirmed'])
            .order('created_at', { ascending: true })

        if (registrationError) throw registrationError

        const { data: pendingData, error: pendingError } =
          await supabase
            .from('registrations')
            .select('id, activity_id, user_id, status, created_at')
            .eq('activity_id', activity.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: true })

        if (pendingError) throw pendingError

        const { data: historyData, error: historyError } =
          await supabase
            .from('activity_participant_removals')
            .select(`
              id,
              activity_id,
              registration_id,
              participant_id_snapshot,
              participant_name_snapshot,
              removed_by_id_snapshot,
              removed_by_name_snapshot,
              reason,
              created_at
            `)
            .eq('activity_id', activity.id)
            .order('created_at', { ascending: false })

        if (historyError) throw historyError

        const userIds = [
          ...new Set([
            ...(registrationData || []).map(item => item.user_id),
            ...(pendingData || []).map(item => item.user_id),
            ...(historyData || []).map(item => item.participant_id_snapshot),
            ...(historyData || []).map(item => item.removed_by_id_snapshot)
          ].filter(Boolean))
        ]

        let profileMap = {}
        if (userIds.length > 0) {
          const { data: profilesData, error: profilesError } =
            await supabase
              .from('profiles')
              .select('id, display_name')
              .in('id', userIds)

          if (profilesError) throw profilesError

          profileMap = Object.fromEntries(
            (profilesData || []).map(profile => [
              profile.id,
              profile.display_name || 'Usuario'
            ])
          )
        }

        if (!active) return

        setParticipants(
          (registrationData || []).map(item => ({
            ...item,
            display_name: profileMap[item.user_id] || 'Usuario'
          }))
        )

        setPendingRequests(
          (pendingData || []).map(item => ({
            ...item,
            display_name: profileMap[item.user_id] || 'Usuario'
          }))
        )

        setRemovalHistory(
          (historyData || []).map(item => ({
            ...item,
            participant_name:
              item.participant_name_snapshot ||
              profileMap[item.participant_id_snapshot] ||
              'Usuario',
            removed_by_name:
              item.removed_by_name_snapshot ||
              profileMap[item.removed_by_id_snapshot] ||
              'Usuario'
          }))
        )
      } catch (err) {
        console.error('Error cargando participantes:', err)
        if (active) {
          setParticipantsError(
            'No se pudieron cargar los participantes: ' + err.message
          )
        }
      } finally {
        if (active) setParticipantsLoading(false)
      }
    }

    loadParticipantsAndHistory()

    return () => {
      active = false
    }
  }, [activity?.id, canManageParticipants])

  // Aceptar o rechazar solicitudes desde el detalle de la actividad.
  async function handleManagePendingRequest(requestId, newStatus) {
    if (!canManageParticipants || registrationActionsClosed || !isActivityUpcoming(activity, currentTime)) {
      setRequestActionMessage('Las solicitudes solo se pueden gestionar antes de que comience la actividad.')
      return
    }
    if (requestActionLoading) return

    setRequestActionLoading(true)
    setRequestActionMessage('')

    try {
      const { error } = await supabase.rpc('manage_activity_registration', {
        p_registration_id: requestId,
        p_new_status: newStatus
      })

      if (error) throw error

      const request = pendingRequests.find(item => item.id === requestId)
      setPendingRequests(previous => previous.filter(item => item.id !== requestId))

      if (newStatus === 'accepted' && request) {
        setParticipants(previous => [
          ...previous.filter(item => item.id !== request.id),
          { ...request, status: 'confirmed' }
        ])
      }

      setRequestActionMessage(
        newStatus === 'accepted'
          ? 'Solicitud aceptada. La persona ya figura entre los participantes confirmados.'
          : 'Solicitud rechazada.'
      )
    } catch (err) {
      console.error('Error gestionando solicitud desde el detalle:', err)
      setRequestActionMessage(err.message || 'No se pudo actualizar la solicitud.')
    } finally {
      setRequestActionLoading(false)
    }
  }

  // Retirar un participante confirmado. El motivo es obligatorio.
  async function handleRemoveParticipant() {
    if (!canRemoveParticipants) {
      setRemovalMessage('No se pueden retirar participantes una vez comenzada la actividad.')
      return
    }
    if (!removalTarget || !removalReason.trim() || removalLoading) return

    if (removalReason.trim().length < 3) {
      setRemovalMessage('El motivo debe tener al menos 3 caracteres.')
      return
    }

    setRemovalLoading(true)
    setRemovalMessage('')

    try {
      const { error } = await supabase.rpc('remove_activity_participant', {
        p_registration_id: removalTarget.id,
        p_reason: removalReason.trim()
      })

      if (error) throw error

      setRemovalTarget(null)
      setRemovalReason('')
      setRemovalMessage('La participación fue retirada correctamente.')

      // Recargar lista e historial.
      const { data: registrationData, error: registrationError } =
        await supabase
          .from('registrations')
          .select('id, activity_id, user_id, status, created_at')
          .eq('activity_id', activity.id)
          .in('status', ['accepted', 'confirmed'])
          .order('created_at', { ascending: true })

      if (registrationError) throw registrationError

      const { data: historyData, error: historyError } =
        await supabase
          .from('activity_participant_removals')
          .select(`
            id,
            activity_id,
            registration_id,
            participant_id_snapshot,
            participant_name_snapshot,
            removed_by_id_snapshot,
            removed_by_name_snapshot,
            reason,
            created_at
          `)
          .eq('activity_id', activity.id)
          .order('created_at', { ascending: false })

      if (historyError) throw historyError

      const userIds = [
        ...new Set([
          ...(registrationData || []).map(item => item.user_id),
          ...(historyData || []).map(item => item.participant_id_snapshot),
          ...(historyData || []).map(item => item.removed_by_id_snapshot)
        ].filter(Boolean))
      ]

      let profileMap = {}
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } =
          await supabase
            .from('profiles')
            .select('id, display_name')
            .in('id', userIds)

        if (profilesError) throw profilesError

        profileMap = Object.fromEntries(
          (profilesData || []).map(profile => [
            profile.id,
            profile.display_name || 'Usuario'
          ])
        )
      }

      setParticipants(
        (registrationData || []).map(item => ({
          ...item,
          display_name: profileMap[item.user_id] || 'Usuario'
        }))
      )

      setRemovalHistory(
        (historyData || []).map(item => ({
          ...item,
          participant_name:
            item.participant_name_snapshot ||
            profileMap[item.participant_id_snapshot] ||
            'Usuario',
          removed_by_name:
            item.removed_by_name_snapshot ||
            profileMap[item.removed_by_id_snapshot] ||
            'Usuario'
        }))
      )
    } catch (err) {
      console.error('Error retirando participante:', err)
      setRemovalMessage('No se pudo retirar al participante: ' + err.message)
    } finally {
      setRemovalLoading(false)
    }
  }

  // Cargar actividad
  async function loadActivity() {
    const { data, error } = await supabase
      .from('activities')
      .select(`
        id,
        organizer_id,
        title,
        description,
        category,
        categories,
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
        signup_deadline,
        status,
        cancellation_reason
      `)
      .eq('id', activityId)
      .maybeSingle()

    if (error) {
      console.error('Error cargando actividad:', error.message)
      setError('No se pudo cargar la actividad.')
    } else if (!data) {
      setError('Esta actividad no existe o ya no está disponible.')
    } else {
setActivity(data)

const { data: organizerProfile, error: profileError } = await supabase
  .from('profiles')
  .select('display_name')
  .eq('id', data.organizer_id)
  .maybeSingle()

const { data: organizerRole, error: roleError } = await supabase
  .rpc('get_public_profile_role', {
    p_user_id: data.organizer_id
  })

if (profileError) {
  console.error('Error cargando perfil del organizador:', profileError.message)
}

if (roleError) {
  console.error('Error cargando tratamiento del organizador:', roleError.message)
}

setOrganizerName(organizerProfile?.display_name || 'Usuario')
setOrganizerRole(roleError ? 'Organiza' : organizerRole || 'Organiza')
}
  }

  useEffect(() => {
    async function initialLoad() {
      setLoading(true)
      setError('')
      await loadActivity()
      setLoading(false)
    }

    initialLoad()
  }, [activityId])

  // Cargar inscripción
  useEffect(() => {
    let active = true

    async function loadRegistration() {
      setRegistration(null)

      if (!session?.user || !activityId) return

      const { data, error } = await supabase
        .from('registrations')
        .select('id, activity_id, user_id, status, created_at')
        .eq('activity_id', activityId)
        .eq('user_id', session.user.id)
        .in('status', ['pending', 'confirmed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!active) return

      if (error) {
        console.error('Error cargando inscripción:', error.message)
        setMessage('No se pudo consultar tu inscripción.')
      } else {
        setRegistration(data || null)
      }
    }

    loadRegistration()

    return () => {
      active = false
    }
  }, [session, activityId])

  // Bloquear scroll al abrir el modal
  useEffect(() => {
    if (!editing) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [editing])

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

  // Abrir edición: sólo se permite antes del inicio de la actividad.
  function openEditActivity() {
    if (!isOrganizer || !isActivityUpcoming(activity)) {
      setEditing(false)
      setEditMessage('Esta actividad ya comenzó o finalizó y no se puede editar.')
      return
    }

    setEditForm({
      title: activity.title || '',
      description: activity.description || '',
      category: activity.category || '',
      categories: getActivityCategories(activity),
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

    setEditMessage('')
    setEditing(true)
  }

  function updateEditField(field, value) {
    setEditForm(previous => ({
      ...previous,
      [field]: value,
      ...(field === 'city' || field === 'meeting_point'
        ? { meeting_latitude: null, meeting_longitude: null }
        : {})
    }))
  }

  function toggleEditCategory(category) {
    setEditForm(previous => {
      const current = getActivityCategories(previous)
      const next = current.includes(category)
        ? current.filter(item => item !== category)
        : current.length < 3 ? [...current, category] : current
      return { ...previous, categories: next, category: next[0] || '' }
    })
  }

  function updateEditMeetingPoint(point) {
    setEditForm(previous => ({
      ...previous,
      meeting_point: point.meeting_point ?? previous.meeting_point,
      meeting_latitude: point.latitude,
      meeting_longitude: point.longitude
    }))
  }

  // Guardar cambios
  async function saveEditedActivity(event) {
    event.preventDefault()
    setEditMessage('')

    // Volver a comprobar al guardar para impedir cambios si la actividad
    // comenzó mientras el formulario de edición estaba abierto.
    if (!isOrganizer || !isActivityUpcoming(activity)) {
      setEditing(false)
      setEditMessage('Esta actividad ya comenzó o finalizó y no se puede editar.')
      return
    }

    if (
      !editForm.title.trim() ||
      !editForm.description.trim() ||
      !editForm.categories?.length || editForm.categories.length > 3 ||
      !editForm.starts_at ||
      !editForm.city.trim() ||
      !editForm.meeting_point.trim()
    ) {
      setEditMessage('Completá todos los campos obligatorios.')
      return
    }

    if (
      editForm.meeting_latitude == null ||
      editForm.meeting_longitude == null ||
      !Number.isFinite(Number(editForm.meeting_latitude)) ||
      !Number.isFinite(Number(editForm.meeting_longitude))
    ) {
      setEditMessage('Ubicá el punto de encuentro en el mapa antes de guardar.')
      return
    }

    const start = new Date(editForm.starts_at)
    const end = editForm.ends_at
      ? new Date(editForm.ends_at)
      : null

    if (Number.isNaN(start.getTime())) {
      setEditMessage('Revisá la fecha de inicio.')
      return
    }

    if (end && end <= start) {
      setEditMessage('La finalización debe ser posterior al inicio.')
      return
    }

    const capacity = editForm.capacity === ''
      ? null
      : Number(editForm.capacity)

    const minimum = Number(editForm.min_participants)

    const price = editForm.is_paid
      ? Number(editForm.price_amount)
      : null

    if (
      capacity !== null &&
      (!Number.isInteger(capacity) || capacity < 1)
    ) {
      setEditMessage('La capacidad debe ser mayor que cero.')
      return
    }

    if (
      !Number.isInteger(minimum) ||
      minimum < 1 ||
      (capacity !== null && minimum > capacity)
    ) {
      setEditMessage('Revisá la cantidad mínima y la capacidad máxima.')
      return
    }

    if (
      editForm.is_paid &&
      (!Number.isFinite(price) || price <= 0)
    ) {
      setEditMessage('Ingresá un precio válido.')
      return
    }

    if (!session?.user || session.user.id !== activity.organizer_id) {
      setEditMessage('No tenés permiso para editar esta actividad.')
      return
    }

    setEditLoading(true)

    try {
      const { error } = await supabase
        .from('activities')
        .update({
          title: editForm.title.trim(),
          description: editForm.description.trim(),
          category: editForm.categories[0],
          categories: editForm.categories,
          starts_at: start.toISOString(),
          ends_at: end ? end.toISOString() : null,
          city: editForm.city.trim(),
          meeting_point: editForm.meeting_point.trim(),
          meeting_latitude: Number(editForm.meeting_latitude),
          meeting_longitude: Number(editForm.meeting_longitude),
          is_paid: editForm.is_paid,
          price_amount: price,
          price_details: editForm.is_paid
            ? editForm.price_details.trim() || null
            : null,
          capacity,
          min_participants: minimum,
          registration_mode: editForm.registration_mode,
          signup_deadline: editForm.signup_deadline
            ? new Date(editForm.signup_deadline).toISOString()
            : null
        })
        .eq('id', activity.id)
        .eq('organizer_id', session.user.id)

      if (error) throw error

      await loadActivity()
      setEditing(false)
      setMessage('La actividad se actualizó correctamente.')
    } catch (error) {
      setEditMessage('No se pudo guardar: ' + error.message)
    } finally {
      setEditLoading(false)
    }
  }

  // Solicitar participación
  async function handleJoinActivity() {
    if (!session?.user) return
    if (registrationActionsClosed) {
      setMessage('Las inscripciones están cerradas porque la actividad comenzó o finalizó.')
      return
    }

    setRegistrationLoading(true)
    setMessage('')

    try {
      const { data, error } = await supabase.rpc(
        'request_activity_registration',
        { p_activity_id: activity.id }
      )

      if (error) throw error

      const status = typeof data === 'string'
        ? data
        : data?.request_activity_registration

      setMessage(
        status === 'confirmed' || status === 'accepted'
          ? '¡Ya sos parte de esta actividad!'
          : 'Tu solicitud fue enviada. El organizador debe aprobarla.'
      )

      const { data: updatedRegistration, error: registrationError } =
        await supabase
          .from('registrations')
          .select('id, activity_id, user_id, status, created_at')
          .eq('activity_id', activity.id)
          .eq('user_id', session.user.id)
          .in('status', ['pending', 'confirmed'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

      if (registrationError) throw registrationError

      setRegistration(updatedRegistration || null)
    } catch (error) {
      setMessage(error.message || 'No se pudo completar la inscripción.')
    } finally {
      setRegistrationLoading(false)
    }
  }

  // Cancelar inscripción
  async function handleCancelRegistration() {
    const confirmed = window.confirm(
      '¿Querés cancelar tu inscripción a esta actividad?'
    )

    if (!confirmed || !registration || !session?.user) return
    if (registrationActionsClosed) {
      setMessage('Ya no se puede cancelar la participación porque la actividad comenzó o finalizó.')
      return
    }

    setRegistrationLoading(true)
    setMessage('')

    try {
      const { error } = await supabase
        .from('registrations')
        .update({ status: 'cancelled' })
        .eq('id', registration.id)
        .eq('user_id', session.user.id)

      if (error) throw error

      setRegistration(null)
      setMessage('Tu inscripción fue cancelada correctamente.')
    } catch (error) {
      setMessage('No se pudo cancelar la inscripción: ' + error.message)
    } finally {
      setRegistrationLoading(false)
    }
  }

  return (
    <>
      <main className="activity-detail-page">
        <header className="activity-detail-header">
          <Link to="/" className="activity-detail-back">
            ← Volver a Conectá
          </Link>
          <strong>conectá.</strong>
        </header>

        <section className="activity-detail-content">
          {loading ? (
            <p>Cargando actividad...</p>
          ) : error ? (
            <p>{error}</p>
          ) : (
            <>
              <div className="activity-category-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {getActivityCategories(activity).map(category => (
                  <span className="activity-category" key={category}>{category}</span>
                ))}
              </div>

              {isCancelled && (
                <div
                  className="activity-cancellation-notice"
                  role="status"
                  style={{
                    margin: '16px 0',
                    padding: '16px',
                    border: '1px solid #fecdca',
                    borderRadius: '14px',
                    background: '#fff1f0',
                    color: '#912018'
                  }}
                >
                  <strong style={{ display: 'block', marginBottom: '6px' }}>
                    ✕ Esta actividad fue cancelada
                  </strong>
                  <span>
                    {activity.cancellation_reason?.trim()
                      ? `Motivo: ${activity.cancellation_reason}`
                      : 'El organizador canceló esta actividad.'}
                  </span>
                </div>
              )}

              {activity.status === 'confirmed' && (
                <div className="activity-confirmed-badge">
                  <span className="activity-confirmed-icon">✓</span>
                  <span>Actividad confirmada</span>
                </div>
              )}

              <h1>{activity.title}</h1>
              <div className="activity-detail-share-row">
                <button
                  type="button"
                  className="activity-share-button activity-detail-share-button"
                  onClick={shareCurrentActivity}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4" />
                  </svg>
                  Compartir actividad
                </button>
                {shareMessage && <span className="activity-share-feedback" role="status">{shareMessage}</span>}
              </div>

            <div className="activity-detail-organizer">
  <div className="activity-detail-organizer-avatar">
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
    </svg>
  </div>

  <div className="activity-detail-organizer-info">
    <span>Organizada por</span>
    <strong>{organizerName}</strong>
  </div>

 
</div>

              <p className="activity-detail-description">
                {activity.description}
              </p>

              <div className="activity-detail-information">
                <p>📍 {activity.city}</p>
                <p>📌 {activity.meeting_point}</p>
                <p>📅 {formatDate(activity.starts_at)}</p>
                <p>🕒 {formatTime(activity.starts_at)}</p>

                {activity.ends_at && (
                  <p>Finaliza: {formatTime(activity.ends_at)}</p>
                )}

                <p>
                  {activity.is_paid
                    ? `💰 $${Number(activity.price_amount).toLocaleString('es-AR')}`
                    : '🎉 Actividad gratuita'}
                </p>

                {activity.is_paid && activity.price_details && (
                  <p>{activity.price_details}</p>
                )}

                <p>👥 Mínimo: {activity.min_participants} participantes</p>

                <p>
                  👥 Capacidad: {activity.capacity || 'Sin límite'}
                </p>
              </div>

              <MeetingPointDisplay latitude={activity.meeting_latitude} longitude={activity.meeting_longitude} address={activity.meeting_point} city={activity.city} />

              {/* PARTICIPACIÓN Y ADMINISTRACIÓN */}
              <section className="activity-detail-participation">
                <h2>
                  {isOrganizer ? 'Administrar actividad' : 'Tu participación'}
                </h2>

                {isCancelled ? (
                  <div className="activity-detail-joined" role="status">
                    <div className="activity-participation-message">
                      <span className="activity-participation-icon">✕</span>
                      <span>{isOrganizer ? 'Cancelaste esta actividad. Podés informar novedades en la sección correspondiente.' : 'Esta actividad fue cancelada por el organizador.'}</span>
                    </div>
                  </div>
                ) : isOrganizer ? (
                  <div className="activity-detail-owner">
                    <span>⭐</span>
                    <div>
                      <strong>Sos el organizador</strong>
                      {canEditActivity ? (
                        <>
                          <p>Desde acá podés modificar los datos de tu actividad.</p>
                          <button
                            type="button"
                            className="primary activity-detail-button"
                            onClick={openEditActivity}
                          >
                            Editar actividad
                          </button>
                        </>
                      ) : (
                        <p role="status">
                          La edición está cerrada porque la actividad ya comenzó o finalizó.
                        </p>
                      )}
                    </div>
                  </div>
                ) : isCompleted ? (
                  <div className="activity-detail-joined">
                    <div className="activity-participation-message">
                      <span className="activity-participation-icon">✓</span>
                      <span>
                        {registration?.status === 'confirmed'
                          ? 'Esta actividad ya finalizó. ¡Gracias por haber participado!'
                          : registration?.status === 'pending'
                            ? 'Esta actividad ya finalizó. Tu solicitud quedó cerrada.'
                            : 'Esta actividad ya finalizó. Las inscripciones están cerradas.'}
                      </span>
                    </div>
                  </div>
                ) : registrationActionsClosed ? (
                  <div className="activity-detail-joined">
                    <div className="activity-participation-message">
                      <span className="activity-participation-icon">✓</span>
                      <span>{registration?.status === 'confirmed' ? 'Tu participación sigue registrada. Las modificaciones están cerradas porque la actividad comenzó o finalizó.' : registration?.status === 'pending' ? 'Tu solicitud permanece registrada, pero ya no puede modificarse porque la actividad comenzó o finalizó.' : 'Las inscripciones están cerradas porque la actividad comenzó o finalizó.'}</span>
                    </div>
                  </div>
                ) : !session?.user ? (
                  <div className="activity-detail-join">
                    <p>Ingresá a Conectá para participar de esta experiencia.</p>
                    <Link to="/" className="primary activity-detail-button">
                      Ingresar o registrarme
                    </Link>
                  </div>
                ) : registration?.status === 'confirmed' ? (
                  <div className="activity-detail-joined">
                    <div className="activity-participation-message">
                      <span className="activity-participation-icon">
                        &#128522;
                      </span>
                      <span>¡Ya sos parte de esta actividad!</span>
                    </div>

                    <button
                      type="button"
                      className="secondary activity-detail-cancel"
                      onClick={handleCancelRegistration}
                      disabled={registrationLoading}
                    >
                      {registrationLoading
                        ? 'Procesando...'
                        : 'Cancelar inscripción'}
                    </button>
                  </div>
                ) : registration?.status === 'pending' ? (
                  <div className="activity-detail-pending">
                    <span className="registration-status status-pending">
                      Pendiente de aprobación
                    </span>

                    <button
                      type="button"
                      className="secondary activity-detail-cancel"
                      onClick={handleCancelRegistration}
                      disabled={registrationLoading}
                    >
                      {registrationLoading
                        ? 'Procesando...'
                        : 'Cancelar solicitud'}
                    </button>
                  </div>
                ) : (
                  <div className="activity-detail-join">
                    <p>
                      {activity.registration_mode === 'approval'
                        ? 'Tu solicitud deberá ser aprobada por el organizador.'
                        : 'La confirmación de participación es automática.'}
                    </p>

                    <button
                      type="button"
                      className="primary activity-detail-button"
                      onClick={handleJoinActivity}
                      disabled={registrationLoading}
                    >
                      {registrationLoading
                        ? 'Procesando...'
                        : 'Quiero participar'}
                    </button>
                  </div>
                )}

                {message && (
                  <p className="activity-detail-message" role="status">
                    {message}
                  </p>
                )}
              </section>

              {canManageParticipants && !isCancelled && (
                <section className="activity-detail-participants-entry">
                  <button
                    type="button"
                    className="primary activity-detail-button"
                    onClick={() => setShowParticipantsManager(true)}
                  >
                    Administrar participantes
                  </button>
                  <p>{canRemoveParticipants ? 'Consultá las personas confirmadas, gestioná retiros y revisá el historial.' : 'Podés consultar las personas confirmadas y el historial. Los retiros están cerrados porque la actividad comenzó o finalizó.'}</p>
                </section>
              )}

              {canManageParticipants && !isCancelled && showParticipantsManager && createPortal(
                <div
                  className="activity-modal-overlay"
                  onClick={() => {
                    setShowParticipantsManager(false)
                    setRemovalTarget(null)
                    setRemovalReason('')
                  }}
                  role="presentation"
                  style={{ zIndex: 10000 }}
                >
                <section
                  className="activity-detail-participants"
                  onClick={event => event.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="participants-manager-title"
                  style={{
                    width: 'min(720px, calc(100vw - 32px))',
                    maxHeight: '85vh',
                    overflowY: 'auto',
                    margin: 'auto',
                    position: 'relative',
                    background: 'var(--surface, #fff)',
                    borderRadius: '18px',
                    padding: '24px',
                    boxSizing: 'border-box'
                  }}
                >
                  <div className="activity-detail-participants-header">
                    <div>
                      <h2 id="participants-manager-title">Administrar participantes</h2>
                      <p>Gestioná las personas confirmadas y consultá el historial de retiros.</p>
                    </div>
                    <button
                      type="button"
                      className="secondary"
                      aria-label="Cerrar administración de participantes"
                      onClick={() => {
                        setShowParticipantsManager(false)
                        setRemovalTarget(null)
                        setRemovalReason('')
                      }}
                    >
                      ✕ Cerrar
                    </button>
                  </div>

                  {participantsError && (
                    <p className="activity-detail-message" role="alert">
                      {participantsError}
                    </p>
                  )}

                  {removalMessage && (
                    <p className="activity-detail-message" role="status">
                      {removalMessage}
                    </p>
                  )}

                  <section className="activity-detail-pending-requests" style={{ marginBottom: '24px' }}>
                    <h3>Solicitudes pendientes ({pendingRequests.length})</h3>
                    {participantsLoading ? (
                      <p>Cargando solicitudes...</p>
                    ) : pendingRequests.length === 0 ? (
                      <p>No hay solicitudes pendientes para esta actividad.</p>
                    ) : (
                      <div className="activity-detail-participant-list">
                        {pendingRequests.map(request => (
                          <article className="activity-detail-participant" key={request.id}>
                            <div>
                              <strong>{request.display_name}</strong>
                              <span>Solicitó participar · {new Date(request.created_at).toLocaleDateString('es-AR')}</span>
                            </div>
                            {canRemoveParticipants && isActivityUpcoming(activity, currentTime) && (
                              <div className="request-actions">
                                <button
                                  type="button"
                                  className="primary request-accept"
                                  disabled={requestActionLoading}
                                  onClick={() => handleManagePendingRequest(request.id, 'accepted')}
                                >
                                  {requestActionLoading ? 'Procesando...' : 'Aceptar'}
                                </button>
                                <button
                                  type="button"
                                  className="secondary request-reject"
                                  disabled={requestActionLoading}
                                  onClick={() => handleManagePendingRequest(request.id, 'rejected')}
                                >
                                  Rechazar
                                </button>
                              </div>
                            )}
                          </article>
                        ))}
                      </div>
                    )}
                    {requestActionMessage && (
                      <p className="activity-detail-message" role="status">{requestActionMessage}</p>
                    )}
                    {registrationActionsClosed && pendingRequests.length > 0 && (
                      <p className="activity-edit-locked">La actividad comenzó o finalizó. Las solicitudes pendientes se conservan, pero ya no pueden gestionarse.</p>
                    )}
                  </section>

                  <h3>Participantes confirmados ({participants.length})</h3>
                  {participantsLoading ? (
                    <p>Cargando participantes...</p>
                  ) : participants.length === 0 ? (
                    <p>Todavía no hay participantes confirmados.</p>
                  ) : (
                    <div className="activity-detail-participant-list">
                      {participants.map(participant => (
                        <article
                          className="activity-detail-participant"
                          key={participant.id}
                        >
                          <div>
                            <strong>{participant.display_name}</strong>
                            <span>Confirmado</span>
                          </div>
                          {canRemoveParticipants && (
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => {
                                setRemovalTarget(participant)
                                setRemovalReason('')
                                setRemovalMessage('')
                              }}
                            >
                              Retirar participante
                            </button>
                          )}
                        </article>
                      ))}
                    </div>
                  )}

                  {removalTarget && canRemoveParticipants && (
                    <div className="activity-detail-removal-panel">
                      <h3>Retirar a {removalTarget.display_name}</h3>
                      <p>
                        Esta acción quedará registrada y la persona recibirá
                        una notificación. El motivo es obligatorio.
                      </p>
                      <label>
                        Motivo del retiro *
                        <textarea
                          value={removalReason}
                          onChange={event => setRemovalReason(event.target.value)}
                          rows={3}
                          minLength={3}
                          maxLength={1000}
                          placeholder="Explicá brevemente el motivo..."
                          required
                        />
                      </label>
                      <div className="create-actions">
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => {
                            setRemovalTarget(null)
                            setRemovalReason('')
                          }}
                          disabled={removalLoading}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          className="primary"
                          onClick={handleRemoveParticipant}
                          disabled={
                            removalLoading || removalReason.trim().length < 3
                          }
                        >
                          {removalLoading ? 'Procesando...' : 'Confirmar retiro'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="activity-detail-removal-history">
                    <h3>Historial de retiros</h3>
                    {participantsLoading ? (
                      <p>Cargando historial...</p>
                    ) : removalHistory.length === 0 ? (
                      <p>No hay retiros registrados en esta actividad.</p>
                    ) : (
                      removalHistory.map(item => (
                        <article key={item.id}>
                          <strong>{item.participant_name}</strong>
                          <p>{item.reason}</p>
                          <small>
                            Retirado por {item.removed_by_name} ·{' '}
                            {new Date(item.created_at).toLocaleString('es-AR')}
                          </small>
                        </article>
                      ))
                    )}
                  </div>
                </section>
                </div>,
                document.body
              )}

              {!isCancelled && (
                <ActivityCommunity
                  activity={activity}
                  session={session}
                  isOrganizer={isOrganizer}
                  isAdmin={isAdmin}
                  registration={registration}
                />
              )}

            </>
          )}
        </section>
      </main>

      {/* MODAL DE EDICIÓN */}
      {editing && isActivityUpcoming(activity) && createPortal(
        <div
          className="activity-modal-overlay"
          onClick={() => !editLoading && setEditing(false)}
          role="presentation"
        >
          <form
            className="activity-edit-form"
            onClick={event => event.stopPropagation()}
            onSubmit={saveEditedActivity}
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-edit-title"
          >
            <div className="activity-edit-header">
              <div>
                <span className="tag">TU EXPERIENCIA</span>
                <h2 id="detail-edit-title">Editar actividad</h2>
                <p>Modificá los detalles de tu propuesta.</p>
              </div>

              <button
                type="button"
                className="activity-edit-close"
                onClick={() => setEditing(false)}
                disabled={editLoading}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <label>Nombre de la actividad *
              <input
                value={editForm.title}
                onChange={e => updateEditField('title', e.target.value)}
                required
                maxLength={100}
              />
            </label>

            <label>Descripción *
              <textarea
                rows={4}
                value={editForm.description}
                onChange={e => updateEditField('description', e.target.value)}
                required
              />
            </label>

            <div className="form-grid">
              <div className="activity-category-selector">
                <strong>Categorías * (elegí hasta 3)</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '9px' }}>
                  {categories.map(category => {
                    const selected = getActivityCategories(editForm).includes(category)
                    return (
                      <button key={category} type="button" aria-pressed={selected}
                        onClick={() => toggleEditCategory(category)}
                        disabled={!selected && getActivityCategories(editForm).length >= 3}
                        style={{ border: selected ? '1px solid #8050c6' : '1px solid #e4ddec', borderRadius: '999px', padding: '8px 12px', background: selected ? '#f1eaff' : '#fff', color: selected ? '#60349b' : '#51485c', fontSize: '13px', fontWeight: selected ? 700 : 500, cursor: 'pointer', opacity: !selected && getActivityCategories(editForm).length >= 3 ? .45 : 1 }}>
                        {selected ? '✓ ' : ''}{category}
                      </button>
                    )
                  })}
                </div>
                <small style={{ display: 'block', marginTop: '7px', color: '#786d83' }}>
                  {getActivityCategories(editForm).length}/3 seleccionadas
                </small>
              </div>

              <label>Ciudad *
                <input
                  value={editForm.city}
                  onChange={e => updateEditField('city', e.target.value)}
                  required
                />
              </label>
            </div>

            <label>Punto de encuentro *
              <input
                value={editForm.meeting_point}
                onChange={e => updateEditField('meeting_point', e.target.value)}
                required
              />
            </label>

            <div className="meeting-point-map-field">
              <strong>Ubicá el punto exacto en el mapa *</strong>
              <p>Buscá el lugar por nombre o hacé clic en el mapa para ajustar el marcador.</p>
              <MeetingPointPicker
                latitude={editForm.meeting_latitude}
                longitude={editForm.meeting_longitude}
                searchText={editForm.meeting_point}
                city={editForm.city}
                onChange={updateEditMeetingPoint}
              />
            </div>

            <div className="form-grid">
              <label>Fecha y hora de inicio *
                <input
                  type="datetime-local"
                  value={editForm.starts_at}
                  onChange={e => updateEditField('starts_at', e.target.value)}
                  required
                />
              </label>

              <label>Fecha y hora de finalización
                <input
                  type="datetime-local"
                  value={editForm.ends_at}
                  min={editForm.starts_at || undefined}
                  onChange={e => updateEditField('ends_at', e.target.value)}
                />
              </label>
            </div>

            <div className="form-divider" />

            <h3>Participantes e inscripción</h3>

            <div className="form-grid">
              <label>Participantes mínimos *
                <input
                  type="number"
                  min="1"
                  value={editForm.min_participants}
                  onChange={e => updateEditField('min_participants', e.target.value)}
                  required
                />
              </label>

              <label>Capacidad máxima
                <input
                  type="number"
                  min="1"
                  value={editForm.capacity}
                  onChange={e => updateEditField('capacity', e.target.value)}
                  placeholder="Sin límite"
                />
              </label>
            </div>

            <label>Modalidad de inscripción
              <select
                value={editForm.registration_mode}
                onChange={e => updateEditField('registration_mode', e.target.value)}
              >
                <option value="automatic">Confirmación automática</option>
                <option value="approval">Requiere aprobación del organizador</option>
              </select>
            </label>

            <label>Fecha límite de inscripción
              <input
                type="datetime-local"
                value={editForm.signup_deadline}
                onChange={e => updateEditField('signup_deadline', e.target.value)}
              />
            </label>

            <div className="form-divider" />

            <h3>Precio de la actividad</h3>

            <label className="paid-checkbox">
              <input
                type="checkbox"
                checked={editForm.is_paid}
                onChange={e => updateEditField('is_paid', e.target.checked)}
              />
              Esta actividad tiene un costo
            </label>

            {editForm.is_paid && (
              <div className="form-grid">
                <label>Precio por persona *
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={editForm.price_amount}
                    onChange={e => updateEditField('price_amount', e.target.value)}
                    required
                  />
                </label>

                <label>Detalles del precio
                  <input
                    value={editForm.price_details}
                    onChange={e => updateEditField('price_details', e.target.value)}
                  />
                </label>
              </div>
            )}

            {editMessage && (
              <p className="activity-edit-message" role="status">
                {editMessage}
              </p>
            )}

            <div className="create-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setEditing(false)}
                disabled={editLoading}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="primary"
                disabled={editLoading}
              >
                {editLoading ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}
    </>
  )
}

export default ActivityDetail
