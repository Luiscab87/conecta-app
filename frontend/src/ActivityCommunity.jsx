import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import ActivityComments from './ActivityComments'

function ActivityCommunity({
  activity,
  session,
  isOrganizer,
  isAdmin = false,
  registration
}) {
  const [posts, setPosts] = useState([])
  const [messages, setMessages] = useState([])
  const [profiles, setProfiles] = useState({})
  const [postRoles, setPostRoles] = useState({})
  const [postText, setPostText] = useState('')
  const [commentText, setCommentText] = useState('')
  const [replyText, setReplyText] = useState('')
  const [replyingTo, setReplyingTo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [activeTab, setActiveTab] = useState('news')

  const now = Date.now()
  const activityEndedAt = activity?.ends_at ? new Date(activity.ends_at).getTime() : NaN
  const activityStartsAt = activity?.starts_at ? new Date(activity.starts_at).getTime() : NaN
  const isCancelled = activity?.status === 'cancelled'

  // Las etapas se determinan por fechas; el cron solo sincroniza el estado en Supabase.
  const hasStarted = Number.isFinite(activityStartsAt) && now >= activityStartsAt
  const hasEnded = !isCancelled && Number.isFinite(activityEndedAt) && now >= activityEndedAt
  const withinPostActivityWindow =
    Number.isFinite(activityEndedAt) &&
    now <= activityEndedAt + 30 * 24 * 60 * 60 * 1000

  const isConfirmedParticipant = ['accepted', 'confirmed'].includes(registration?.status)
  const participantHistoryAvailable = !hasEnded || withinPostActivityWindow
  const canParticipate =
    isOrganizer || (isConfirmedParticipant && participantHistoryAvailable)
  const canReadPosts = isOrganizer || isAdmin || (isConfirmedParticipant && participantHistoryAvailable)
  const canReadMessages = isOrganizer || isAdmin || (isConfirmedParticipant && participantHistoryAvailable)
  // En una actividad cancelada, solo el organizador puede publicar novedades.
  const canPublish = isCancelled
    ? Boolean(isOrganizer)
    : !hasStarted && ((isAdmin && !isOrganizer) || (isOrganizer && participantHistoryAvailable))
  const canSendMessages = !isCancelled && !hasStarted && canParticipate && participantHistoryAvailable

  const loadCommunity = useCallback(async () => {
    if (!activity?.id || !canReadPosts) {
      setPosts([])
      setMessages([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const postsQuery = supabase
        .from('activity_posts')
        .select(`
          id,
          activity_id,
          organizer_id,
          author_id,
          post_type,
          body,
          created_at
        `)
        .eq('activity_id', activity.id)
        .order('created_at', { ascending: false })

      const messagesQuery = canReadMessages
        ? supabase
            .from('messages')
            .select(`
              id,
              activity_id,
              sender_id,
              body,
              parent_message_id,
              created_at
            `)
            .eq('activity_id', activity.id)
            .order('created_at', { ascending: true })
        : Promise.resolve({ data: [], error: null })

      const [postsResult, messagesResult] = await Promise.all([
        postsQuery,
        messagesQuery
      ])

      if (postsResult.error) throw postsResult.error
      if (messagesResult.error) throw messagesResult.error

      const loadedPosts = postsResult.data || []
      const loadedMessages = messagesResult.data || []

      setPosts(loadedPosts)
      setMessages(loadedMessages)

      const userIds = [
        ...new Set([
          ...loadedPosts.map(post => post.author_id || post.organizer_id),
          ...loadedMessages.map(message => message.sender_id)
        ])
      ]

      if (userIds.length > 0) {
        const { data: profileData, error: profileError } =
          await supabase
            .from('profiles')
            .select('id, display_name')
            .in('id', userIds)

        if (!profileError) {
          const profileMap = {}

          ;(profileData || []).forEach(profile => {
            profileMap[profile.id] = profile.display_name
          })

          setProfiles(profileMap)
        }

        const postAuthorIds = [
          ...new Set(
            loadedPosts
              .filter(post => post.post_type !== 'admin_notice')
              .map(post => post.author_id || post.organizer_id)
          )
        ]

        const roleResults = await Promise.all(
          postAuthorIds.map(async userId => {
            const { data: role, error: roleError } =
              await supabase.rpc('get_public_profile_role', {
                p_user_id: userId
              })

            if (roleError) {
              console.error(
                'Error cargando tratamiento del organizador:',
                roleError.message
              )
              return [userId, 'Organizador']
            }

            return [
              userId,
              role === 'Organizadora' ? 'Organizadora' : 'Organizador'
            ]
          })
        )

        setPostRoles(Object.fromEntries(roleResults))
      } else {
        setProfiles({})
        setPostRoles({})
      }
    } catch (err) {
      console.error('Error cargando comunidad:', err)
      setError('No se pudo cargar la comunidad. Intentá nuevamente.')
    } finally {
      setLoading(false)
    }
  }, [activity?.id, canReadPosts, canReadMessages, canParticipate, isAdmin])

  useEffect(() => {
    loadCommunity()
  }, [loadCommunity])

  function formatMessageDate(date) {
    return new Date(date).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function getDisplayName(userId) {
    if (userId === session?.user?.id) return 'Vos'
    return profiles[userId] || 'Participante'
  }

  function getPostAuthorName(post) {
    if (post.post_type === 'admin_notice') {
      return 'Administración de Conectá'
    }

    const authorId = post.author_id || post.organizer_id
    return profiles[authorId] || 'Organizador'
  }

  function getPostRole(post) {
    if (post.post_type === 'admin_notice') {
      return 'Aviso oficial'
    }

    const authorId = post.author_id || post.organizer_id
    return postRoles[authorId] || 'Organizador'
  }

  async function publishPost(event) {
    event.preventDefault()

    if (!postText.trim() || !canPublish || sending) return
    if (!session?.user?.id || !activity?.id) return

    setSending(true)
    setError('')
    setNotice('')

    try {
      const isAdminNotice = isAdmin && !isOrganizer

      const { error } = await supabase
        .from('activity_posts')
        .insert({
          activity_id: activity.id,
          organizer_id: activity.organizer_id,
          author_id: session.user.id,
          post_type: isAdminNotice ? 'admin_notice' : 'organizer',
          body: postText.trim()
        })

      if (error) throw error

      setPostText('')
      setNotice(
        isAdminNotice
          ? 'El aviso administrativo se publicó correctamente.'
          : 'La novedad se publicó correctamente.'
      )

      await loadCommunity()
    } catch (err) {
      console.error('Error publicando novedad:', err)
      setError('No se pudo publicar: ' + err.message)
    } finally {
      setSending(false)
    }
  }

  async function sendMessage(event, parentMessageId = null) {
    event.preventDefault()

    const body = parentMessageId ? replyText : commentText

    if (!body.trim() || !canSendMessages || sending) return

    setSending(true)
    setError('')
    setNotice('')

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          activity_id: activity.id,
          sender_id: session.user.id,
          body: body.trim(),
          parent_message_id: parentMessageId
        })

      if (error) throw error

      if (parentMessageId) {
        setReplyText('')
        setReplyingTo(null)
      } else {
        setCommentText('')
      }

      await loadCommunity()
    } catch (err) {
      console.error('Error enviando mensaje:', err)
      setError('No se pudo enviar el mensaje: ' + err.message)
    } finally {
      setSending(false)
    }
  }

  async function deletePost(post) {
    // Los organizadores no pueden eliminar avisos oficiales de la administración.
    if (!isAdmin && post.post_type !== 'organizer') {
      setError('No tenés permisos para eliminar este aviso oficial.')
      return
    }

    const confirmed = window.confirm(
      '¿Querés eliminar esta publicación? Esta acción no se puede deshacer.'
    )

    if (!confirmed) return

    setError('')
    setNotice('')

    try {
      let query = supabase
        .from('activity_posts')
        .delete()
        .eq('id', post.id)

      if (!isAdmin) {
        query = query
          .eq('organizer_id', session.user.id)
          .eq('post_type', 'organizer')
      }

      const { error } = await query

      if (error) throw error

      setNotice('La publicación fue eliminada.')
      await loadCommunity()
    } catch (err) {
      console.error('Error eliminando publicación:', err)
      setError('No se pudo eliminar la publicación: ' + err.message)
    }
  }

  const mainMessages = messages.filter(
    message => !message.parent_message_id
  )

  function getReplies(messageId) {
    return messages.filter(
      message => message.parent_message_id === messageId
    )
  }

  function renderMessage(message, depth = 0) {
    const replies = getReplies(message.id)

    return (
      <article
        className={
          depth > 0
            ? 'activity-community-reply activity-community-nested-reply'
            : 'activity-community-message'
        }
        key={message.id}
        style={depth > 0 ? { marginLeft: `${Math.min(depth * 18, 54)}px` } : undefined}
      >
        <div className="activity-community-item-header">
          <strong>{getDisplayName(message.sender_id)}</strong>
          <span>{formatMessageDate(message.created_at)}</span>
        </div>

        <p>{message.body}</p>

        {!isCancelled && <button
          type="button"
          className="activity-community-reply-button"
          onClick={() => {
            setReplyingTo(replyingTo === message.id ? null : message.id)
            setReplyText('')
          }}
        >
          Responder
        </button>}

        {!isCancelled && replyingTo === message.id && (
          <form
            className="activity-community-reply-form"
            onSubmit={event => sendMessage(event, message.id)}
          >
            <textarea
              value={replyText}
              onChange={event => setReplyText(event.target.value)}
              placeholder="Escribí tu respuesta..."
              rows={2}
              maxLength={2000}
              required
            />

            <div>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setReplyingTo(null)
                  setReplyText('')
                }}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="primary"
                disabled={sending || !replyText.trim()}
              >
                {sending ? 'Enviando...' : 'Responder'}
              </button>
            </div>
          </form>
        )}

        {replies.length > 0 && (
          <div className="activity-community-replies">
            {replies.map(reply => renderMessage(reply, depth + 1))}
          </div>
        )}
      </article>
    )
  }

  if (!canReadPosts) {
    return !participantHistoryAvailable ? (
      <section className="activity-community activity-community-closed">
        <p className="activity-community-empty">El período de acceso a la comunidad finalizó. Podés seguir consultando los datos básicos de esta actividad desde tu historial.</p>
      </section>
    ) : null
  }

  const tabButtonStyle = (selected, disabled = false) => ({
    width: '100%',
    minWidth: 0,
    minHeight: 88,
    boxSizing: 'border-box',
    border: selected ? '1px solid var(--primary, #8050b8)' : '1px solid var(--border, #e5e7eb)',
    borderRadius: 12,
    padding: '9px 3px',
    background: selected ? 'var(--surface-secondary, #f2ecfa)' : 'var(--surface, #fff)',
    color: disabled ? 'var(--muted, #8992a3)' : 'var(--text, inherit)',
    opacity: disabled ? 0.62 : 1,
    cursor: 'pointer',
    fontWeight: selected ? 700 : 600,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden'
  })

  // Los tres títulos permanecen en una sola línea incluso en pantallas angostas.
  const tabLabelStyle = {
    display: 'block',
    width: '100%',
    minWidth: 0,
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    lineHeight: 1.2,
    fontSize: 'clamp(10px, 2.8vw, 15px)'
  }

  const tabAvailabilityStyle = {
    display: 'block',
    width: '100%',
    minWidth: 0,
    textAlign: 'center',
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
    lineHeight: 1.2,
    fontSize: 'clamp(9px, 2.2vw, 11px)',
    fontWeight: 500
  }

  const isCompleted = hasEnded
  const tabAvailability = {
    news: isCancelled ? (isOrganizer ? 'Puede publicar' : 'Solo lectura') : hasStarted ? 'Solo lectura' : 'Disponible',
    questions: isCancelled || hasStarted ? 'Solo lectura' : 'Disponible',
    experiences: isCancelled ? 'Solo lectura' : isCompleted ? 'Disponible' : 'Se habilita al finalizar'
  }

  return (
    <section className="activity-community" style={{ marginTop: 28 }}>
      <div className="activity-community-heading">
        <span className="tag">ESPACIO DE LA ACTIVIDAD</span>
        <h2>La experiencia continúa acá</h2>
        <p>{isCancelled ? 'Actividad cancelada. Las novedades pueden ser publicadas por el organizador; el resto del contenido queda en modo lectura.' : 'Novedades, consultas y experiencias en un mismo lugar.'}</p>
      </div>

      {error && <p className="activity-community-feedback error" role="alert">{error}</p>}
      {notice && <p className="activity-community-feedback success" role="status">{notice}</p>}

      <div
        role="tablist"
        aria-label="Secciones de la actividad"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 8,
          margin: '18px 0',
          width: '100%',
          minWidth: 0
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'news'}
          onClick={() => setActiveTab('news')}
          style={tabButtonStyle(activeTab === 'news')}
        >
          <span aria-hidden="true">📢</span>
          <span style={tabLabelStyle}>Novedades</span>
          <small style={tabAvailabilityStyle}>{tabAvailability.news}</small>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'questions'}
          onClick={() => setActiveTab('questions')}
          style={tabButtonStyle(activeTab === 'questions')}
        >
          <span aria-hidden="true">💬</span>
          <span style={tabLabelStyle}>Preguntas</span>
          <small style={tabAvailabilityStyle}>{tabAvailability.questions}</small>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'experiences'}
          onClick={() => setActiveTab('experiences')}
          style={tabButtonStyle(activeTab === 'experiences', !isCompleted)}
        >
          <span aria-hidden="true">⭐</span>
          <span style={tabLabelStyle}>Experiencias</span>
          <small style={tabAvailabilityStyle}>{tabAvailability.experiences}</small>
        </button>
      </div>

      {activeTab === 'news' && (
        <section className="activity-community-posts" role="tabpanel">
          <div className="activity-community-section-title"><h3>Novedades</h3></div>
          {canPublish && (
            <form className="activity-community-post-form" onSubmit={publishPost}>
              <label htmlFor="activity-post-text">{isAdmin && !isOrganizer ? 'Publicar un aviso de la administración' : 'Compartí una novedad con los participantes'}</label>
              <textarea id="activity-post-text" value={postText} onChange={event => setPostText(event.target.value)} placeholder={isAdmin && !isOrganizer ? 'Escribí un aviso oficial...' : 'Escribí una novedad o información importante...'} rows={3} maxLength={2000} required />
              <button type="submit" className="primary" disabled={sending || !postText.trim()}>{sending ? 'Publicando...' : isAdmin && !isOrganizer ? 'Publicar aviso administrativo' : 'Publicar novedad'}</button>
            </form>
          )}
          {isCancelled && !isOrganizer && <p className="activity-community-empty">La actividad fue cancelada. Las novedades están disponibles en modo lectura.</p>}
          {!isCancelled && hasStarted && <p className="activity-community-empty">La actividad comenzó. Las novedades están disponibles en modo lectura.</p>}
          {loading ? <p>Cargando publicaciones...</p> : posts.length === 0 ? <p className="activity-community-empty">Todavía no hay publicaciones.</p> : (
            <div className="activity-community-post-list">
              {posts.map(post => {
                const isAdminNotice = post.post_type === 'admin_notice'
                const canDelete = isAdmin || (isOrganizer && post.post_type === 'organizer')
                return <article className={isAdminNotice ? 'activity-community-post activity-community-admin-post' : 'activity-community-post'} key={post.id}>
                  <div className="activity-community-item-header"><strong>{getPostAuthorName(post)}</strong><span className="activity-community-role">{getPostRole(post)}</span><span>{formatMessageDate(post.created_at)}</span></div>
                  {isAdminNotice && <div className="activity-community-admin-label">Aviso oficial de Conectá</div>}
                  <p>{post.body}</p>
                  {canDelete && <button type="button" className="activity-community-delete" onClick={() => deletePost(post)}>Eliminar publicación</button>}
                </article>
              })}
            </div>
          )}
        </section>
      )}

      {activeTab === 'questions' && canReadMessages && (
        <section className="activity-community-chat" role="tabpanel">
          <div className="activity-community-section-title"><h3>Preguntas</h3></div>
          {canSendMessages ? <form className="activity-community-comment-form" onSubmit={event => sendMessage(event)}>
            <textarea value={commentText} onChange={event => setCommentText(event.target.value)} placeholder="¿Tenés alguna consulta sobre la actividad?" rows={3} maxLength={2000} required />
            <button type="submit" className="primary" disabled={sending || !commentText.trim()}>{sending ? 'Enviando...' : 'Enviar pregunta'}</button>
          </form> : <p className="activity-community-empty">{isCancelled ? 'La actividad fue cancelada. Las preguntas y respuestas anteriores permanecen disponibles en modo lectura.' : 'La actividad comenzó. Las preguntas y respuestas están disponibles en modo lectura.'}</p>}
          {loading ? <p>Cargando preguntas...</p> : mainMessages.length === 0 ? <p className="activity-community-empty">Todavía no hay preguntas. ¡Podés iniciar la conversación!</p> : <div className="activity-community-message-list">{mainMessages.map(message => renderMessage(message, 0))}</div>}
          <button type="button" className="activity-community-refresh" onClick={loadCommunity} disabled={loading}>Actualizar preguntas</button>
        </section>
      )}

      {activeTab === 'questions' && !canReadMessages && <p className="activity-community-empty">Las preguntas están disponibles para el organizador y los participantes confirmados.</p>}

      {activeTab === 'experiences' && (
        (isCompleted || isCancelled) ? <ActivityComments activity={activity} session={session} registration={registration} isOrganizer={isOrganizer} isAdmin={isAdmin} /> :
        <section className="activity-community-locked" role="tabpanel" style={{ padding: 20, border: '1px solid var(--border, #e5e7eb)', borderRadius: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 28 }}>⭐</div><strong>Opiniones y experiencias</strong>
          <p>Esta sección se habilitará cuando la actividad esté finalizada. Allí podrás valorar la experiencia, dejar un comentario y compartir fotografías.</p>
        </section>
      )}
    </section>
  )
}

export default ActivityCommunity