import { useEffect, useMemo, useState } from 'react'
import './DateTimePicker.css'

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const pad = value => String(value).padStart(2, '0')

function parseDate(value) {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function DateTimePicker({ label, value, onChange, required = false, min = '' }) {
  const [open, setOpen] = useState(false)
  const selectedDate = value?.split('T')[0] || ''
  const selectedTime = value?.split('T')[1]?.slice(0, 5) || ''
  const minDate = min?.split('T')[0] || ''
  const minTime = min?.split('T')[1]?.slice(0, 5) || ''

  const [viewMonth, setViewMonth] = useState(() => {
    const date = parseDate(selectedDate) || parseDate(minDate) || new Date()
    return new Date(date.getFullYear(), date.getMonth(), 1)
  })

  useEffect(() => {
    if (selectedDate) {
      const date = parseDate(selectedDate)
      if (date) setViewMonth(new Date(date.getFullYear(), date.getMonth(), 1))
    }
  }, [selectedDate])

  const [hour, minute] = selectedTime ? selectedTime.split(':') : ['09', '00']
  const calendarDays = useMemo(() => {
    const year = viewMonth.getFullYear()
    const month = viewMonth.getMonth()
    const offset = (new Date(year, month, 1).getDay() + 6) % 7
    const count = new Date(year, month + 1, 0).getDate()
    return [...Array(offset).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)]
  }, [viewMonth])

  const hours = Array.from({ length: 24 }, (_, i) => pad(i))
  const minutes = Array.from({ length: 12 }, (_, i) => pad(i * 5))
  const minimumApplies = Boolean(minDate && selectedDate === minDate && minTime)
  const [minHour, minMinute] = minTime ? minTime.split(':') : ['00', '00']

  const displayValue = value
    ? `${parseDate(selectedDate)?.toLocaleDateString('es-AR')} · ${selectedTime}`
    : 'Elegir fecha y hora'

  function changeDate(dateString) {
    let nextTime = selectedTime || '09:00'
    if (dateString === minDate && minTime && nextTime < minTime) nextTime = minTime
    onChange(`${dateString}T${nextTime}`)
  }

  function changeTime(nextHour, nextMinute) {
    if (!selectedDate) return
    const nextTime = `${nextHour}:${nextMinute}`
    if (selectedDate === minDate && minTime && nextTime < minTime) return
    onChange(`${selectedDate}T${nextTime}`)
  }

  function isDisabled(day) {
    if (!day || !minDate) return false
    return formatDate(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day)) < minDate
  }

  function moveMonth(amount) {
    setViewMonth(current => new Date(current.getFullYear(), current.getMonth() + amount, 1))
  }

  return (
    <div className="datetime-picker">
      <label className="datetime-picker-label">
        {label}{required && <span className="datetime-required"> *</span>}
      </label>

      <button
        type="button"
        className="datetime-picker-trigger"
        onClick={() => setOpen(current => !current)}
        aria-expanded={open}
      >
        <span>{displayValue}</span>
        <span className="datetime-picker-icon" aria-hidden="true">▦</span>
      </button>

      {open && (
        <div className="datetime-picker-panel">
          <div className="datetime-calendar-header">
            <button type="button" onClick={() => moveMonth(-1)} aria-label="Mes anterior">‹</button>
            <strong>{MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}</strong>
            <button type="button" onClick={() => moveMonth(1)} aria-label="Mes siguiente">›</button>
          </div>

          <div className="datetime-calendar-grid">
            {WEEKDAYS.map(day => <span className="datetime-weekday" key={day}>{day}</span>)}
            {calendarDays.map((day, index) => {
              if (!day) return <span className="datetime-empty-day" key={`empty-${index}`} />
              const dateString = formatDate(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day))
              const selected = selectedDate === dateString
              return (
                <button
                  type="button"
                  key={dateString}
                  disabled={isDisabled(day)}
                  className={selected ? 'selected' : ''}
                  onClick={() => changeDate(dateString)}
                >
                  {day}
                </button>
              )
            })}
          </div>

          <div className="datetime-time-section">
            <strong>Horario</strong>
            <div className="datetime-time-selectors">
              <label>Hora
                <select value={hour} disabled={!selectedDate} onChange={e => changeTime(e.target.value, minute)}>
                  {hours.map(item => (
                    <option key={item} value={item} disabled={minimumApplies && item < minHour}>{item}</option>
                  ))}
                </select>
              </label>
              <span className="datetime-time-colon">:</span>
              <label>Minutos
                <select value={minute} disabled={!selectedDate} onChange={e => changeTime(hour, e.target.value)}>
                  {minutes.map(item => (
                    <option
                      key={item}
                      value={item}
                      disabled={minimumApplies && hour === minHour && item < minMinute}
                    >{item}</option>
                  ))}
                </select>
              </label>
            </div>
            {!selectedDate && <small>Primero seleccioná un día del calendario.</small>}
          </div>

          <button type="button" className="datetime-picker-done" onClick={() => setOpen(false)}>Listo</button>
        </div>
      )}
    </div>
  )
}

export default DateTimePicker
