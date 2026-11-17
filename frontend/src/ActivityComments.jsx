import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'

const MAX_LENGTH = 1000
const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

function initials(name) {
  return (name || 'U')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0] || '')
    .join('')
    .toUpperCase()
}

function renderStars(value, size = 20) {
  return (
    <span aria-label={`${value} de 5 estrellas`} style={{ display: 'inline-flex', gap: 2, color: '#e5a000', fontSize: size }}>
      {[1, 2, 3, 4, 5].map(star => (
        <span key={star}>{star <= value ? '★' : '☆'}</span>
      ))}
    </span>
  )
}

function ActivityComments({ activity, session, registration, isOrganizer, isAdmin }) {
  const userId = session?.user?.id
  const now = Date.now()
  const endsAt = activity?.ends_at ? new Date(activity.ends_at).getTime() : NaN
  const isCancelled = activity?.status === 'cancelled'
  const hasEnded = !isCancelled && Number.isFinite(endsAt) && now >= endsAt
  const withinWindow = Boolean(hasEnded && now <= endsAt + THIRTY_DAYS_MS)
  const isConfirmedParticipant = registration?.status === 'confirmed'

  // En canceladas se conserva la lectura del historial, pero no se habilitan valoraciones.
  const canRead = Boolean(isOrganizer || isAdmin || (isConfirmedParticipant && (isCancelled || withinWindow)))
  const canRate = Boolean(userId && hasEnded && withinWindow && isConfirmedParticipant)

  const [ratings, setRatings] = useState([])
  const [myRating, setMyRating] = useState(null)
  const [selectedRating, setSelectedRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [actionMessage, setActionMessage] = useState('')

  const loadRatings = useCallback(async () => {
    if (!activity?.id || (!hasEnded && !isCancelled) || !canRead) {
      setRatings([])
      setMyRating(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data: ratingRows, error: ratingsError } = await supabase
        .from('activity_ratings')
        .select('id, activity_id, user_id, rating, review_text, created_at, updated_at')
        .eq('activity_id', activity.id)
        .order('created_at', { ascending: false })

      if (ratingsError) throw ratingsError

      const rows = ratingRows || []
      const userIds = [...new Set(rows.map(row => row.user_id).filter(Boolean))]
      let profileMap = {}

      if (userIds.length) {
        const { data: profileRows, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', userIds)

        if (profilesError) throw profilesError
        profileMap = Object.fromEntries(
          (profileRows || []).map(profile => [profile.id, profile])
        )
      }

      const enrichedRows = rows.map(row => ({
        ...row,
        profile: profileMap[row.user_id] || { display_name: 'Usuario', avatar_url: null }
      }))

      setRatings(enrichedRows)

      const ownRating = enrichedRows.find(row => row.user_id === userId) || null
      setMyRating(ownRating)
      setSelectedRating(ownRating?.rating || 0)
      setReviewText(ownRating?.review_text || '')
    } catch (err) {
      console.error('Error cargando valoraciones:', err)
      setError('No se pudieron cargar las valoraciones: ' + (err.message || 'Error desconocido'))
    } finally {
      setLoading(false)
    }
  }, [activity?.id, hasEnded, isCancelled, canRead, userId])

  useEffect(() => {
    loadRatings()
  }, [loadRatings])

  const averageRating = useMemo(() => {
    if (!ratings.length) return 0
    return ratings.reduce((total, item) => total + Number(item.rating || 0), 0) / ratings.length
  }, [ratings])

  const canEditOwnRating = Boolean(
    myRating &&
    canRate &&
    new Date(myRating.created_at).getTime() + FIVE_DAYS_MS >= Date.now()
  )

  const canSubmit = canRate && (!myRating || canEditOwnRating)

  async function saveRating() {
    if (!canSubmit || !selectedRating || saving) return

    setSaving(true)
    setError('')
    setActionMessage('')

    const payload = {
      rating: selectedRating,
      review_text: reviewText.trim() || null
    }

    try {
      if (myRating) {
        const { error: updateError } = await supabase
          .from('activity_ratings')
          .update(payload)
          .eq('id', myRating.id)
          .eq('user_id', userId)

        if (updateError) throw updateError
        setActionMessage('Tu valoración fue actualizada.')
      } else {
        const { error: insertError } = await supabase
          .from('activity_ratings')
          .insert({
            activity_id: activity.id,
            user_id: userId,
            ...payload
          })

        if (insertError) throw insertError
        setActionMessage('¡Gracias! Tu valoración fue publicada.')
      }

      await loadRatings()
    } catch (err) {
      console.error('Error guardando valoración:', err)
      setError('No se pudo guardar la valoración: ' + (err.message || 'Error desconocido'))
    } finally {
      setSaving(false)
    }
  }

  if (!hasEnded && !isCancelled) return null

  return (
    <section className="activity-comments" style={{ marginTop: 28, paddingTop: 22, borderTop: '1px solid var(--border, #e5e7eb)' }}>
      <h2>Opiniones y experiencias</h2>
      {isCancelled && <p role="status">Actividad cancelada: las opiniones existentes se conservan en modo lectura.</p>}

      {error && <p role="alert" className="activity-detail-message">{error}</p>}
      {actionMessage && <p role="status" className="activity-detail-message">{actionMessage}</p>}

      {loading ? (
        <p>Cargando valoraciones...</p>
      ) : !canRead ? (
        <p>Las valoraciones están disponibles para los participantes confirmados y el organizador durante los 30 días posteriores a la actividad.</p>
      ) : (
        <>
          <div style={{ padding: 14, marginBottom: 20, borderRadius: 10, background: 'var(--surface-secondary, #f5f6f8)' }}>
            <strong>Valoración general</strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
              {ratings.length ? (
                <>
                  {renderStars(Math.round(averageRating), 23)}
                  <strong>{averageRating.toFixed(1)} / 5</strong>
                  <small style={{ color: 'var(--muted, #687386)' }}>
                    ({ratings.length} {ratings.length === 1 ? 'valoración' : 'valoraciones'})
                  </small>
                </>
              ) : (
                <span style={{ color: 'var(--muted, #687386)' }}>Todavía no hay valoraciones.</span>
              )}
            </div>
          </div>

          {canRate && (
            <div style={{ marginBottom: 24 }}>
              <h3>{myRating ? 'Tu valoración' : '¿Cómo estuvo la actividad?'}</h3>
              <p style={{ marginBottom: 8 }}>Elegí una puntuación de 1 a 5 estrellas.</p>
              <div role="group" aria-label="Elegir puntuación" style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setSelectedRating(star)}
                    disabled={!canSubmit || saving}
                    aria-label={`${star} ${star === 1 ? 'estrella' : 'estrellas'}`}
                    aria-pressed={selectedRating === star}
                    style={{
                      border: 0,
                      background: 'transparent',
                      padding: 2,
                      cursor: canSubmit ? 'pointer' : 'default',
                      color: star <= selectedRating ? '#e5a000' : '#9ca3af',
                      fontSize: 32,
                      lineHeight: 1
                    }}
                  >
                    {star <= selectedRating ? '★' : '☆'}
                  </button>
                ))}
              </div>

              <label htmlFor="activity-rating-review">Comentario (opcional)</label>
              <textarea
                id="activity-rating-review"
                value={reviewText}
                onChange={event => setReviewText(event.target.value)}
                maxLength={MAX_LENGTH}
                rows={4}
                disabled={!canSubmit || saving}
                placeholder="Si querés, contá brevemente cómo fue tu experiencia..."
                style={{ width: '100%', boxSizing: 'border-box', marginTop: 8 }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <small>{reviewText.length}/{MAX_LENGTH} caracteres</small>
                <button
                  type="button"
                  className="primary"
                  disabled={!canSubmit || !selectedRating || saving}
                  onClick={saveRating}
                >
                  {saving ? 'Guardando...' : myRating ? 'Actualizar valoración' : 'Publicar valoración'}
                </button>
              </div>

              {myRating && !canEditOwnRating && (
                <small style={{ display: 'block', marginTop: 8, color: 'var(--muted, #687386)' }}>
                  El plazo de 5 días para modificar tu valoración finalizó.
                </small>
              )}
            </div>
          )}

          {!canRate && !isOrganizer && !isAdmin && (
            <p>Solo los participantes confirmados pueden dejar una valoración.</p>
          )}

          <div>
            <h3>Opiniones de los participantes</h3>
            {ratings.length === 0 ? (
              <p>Todavía no hay opiniones. ¡Podés ser el primero en valorar!</p>
            ) : (
              ratings.map(item => {
                const profile = item.profile || {}
                const wasEdited = item.updated_at && new Date(item.updated_at).getTime() > new Date(item.created_at).getTime() + 1000

                return (
                  <article key={item.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--border, #e5e7eb)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {profile.avatar_url ? (
                        <img src={profile.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div aria-hidden="true" style={{ width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--surface-secondary, #e9edf2)', fontWeight: 700 }}>
                          {initials(profile.display_name)}
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <strong>{profile.display_name || 'Usuario'}</strong>
                        <small style={{ color: 'var(--muted, #687386)' }}>
                          {new Date(item.created_at).toLocaleDateString('es-AR')}
                          {wasEdited ? ' · Editada' : ''}
                        </small>
                      </div>
                    </div>
                    <div style={{ marginTop: 8 }}>{renderStars(Number(item.rating), 19)}</div>
                    {item.review_text && (
                      <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '8px 0 0' }}>
                        {item.review_text}
                      </p>
                    )}
                  </article>
                )
              })
            )}
          </div>
        </>
      )}
    </section>
  )
}

export default ActivityComments
