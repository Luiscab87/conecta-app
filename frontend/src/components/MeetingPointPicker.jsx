import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const DEFAULT_CENTER = [-31.652, -64.428]

const meetingPointIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

function MapClickHandler({ onSelect }) {
  useMapEvents({
    click(event) {
      onSelect({ latitude: event.latlng.lat, longitude: event.latlng.lng })
    },
  })
  return null
}

function MapViewUpdater({ point }) {
  const map = useMap()
  useEffect(() => {
    if (point) map.flyTo([point.latitude, point.longitude], 17, { duration: 0.8 })
  }, [map, point?.latitude, point?.longitude])
  return null
}

function conciseAddress(result) {
  const address = result?.address || {}
  const parts = [
    address.road && `${address.road}${address.house_number ? ` ${address.house_number}` : ''}`,
    address.neighbourhood || address.suburb,
    address.city || address.town || address.village || address.municipality,
  ].filter(Boolean)
  return parts.length ? [...new Set(parts)].join(', ') : (result?.display_name || '')
}

export default function MeetingPointPicker({
  latitude,
  longitude,
  onChange,
  searchText = '',
  city = '',
}) {
  const [selectedPoint, setSelectedPoint] = useState(
    latitude != null && longitude != null
      ? { latitude: Number(latitude), longitude: Number(longitude) }
      : null
  )
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [searchResult, setSearchResult] = useState('')
  const requestId = useRef(0)
  const skipNextTextSearch = useRef('')
  const firstTextEffect = useRef(true)

  useEffect(() => {
    if (latitude != null && longitude != null) {
      setSelectedPoint({ latitude: Number(latitude), longitude: Number(longitude) })
    } else {
      setSelectedPoint(null)
    }
  }, [latitude, longitude])

  async function searchPlace(text = searchText, cityName = city) {
    const cleanText = text.trim()
    if (!cleanText) {
      setSearchError('Escribí un lugar o una dirección para ubicarlo en el mapa.')
      return
    }

    const currentRequest = ++requestId.current
    setSearching(true)
    setSearchError('')
    setSearchResult('')

    try {
      const place = [cleanText, cityName.trim(), 'Argentina'].filter(Boolean).join(', ')
      const params = new URLSearchParams({ format: 'jsonv2', q: place, limit: '1', countrycodes: 'ar', addressdetails: '1' })
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
        headers: { 'Accept-Language': 'es' },
      })
      if (!response.ok) throw new Error('El servicio de búsqueda no respondió correctamente.')
      const results = await response.json()
      if (currentRequest !== requestId.current) return
      if (!results.length) {
        setSearchError('No encontramos ese lugar. Probá agregando una dirección más precisa o marcándolo en el mapa.')
        return
      }

      const result = results[0]
      const point = { latitude: Number(result.lat), longitude: Number(result.lon) }
      const address = conciseAddress(result) || cleanText
      setSelectedPoint(point)
      skipNextTextSearch.current = address
      onChange?.({ ...point, meeting_point: address })
      setSearchResult(`Lugar encontrado: ${address}`)
    } catch (error) {
      if (currentRequest === requestId.current) {
        setSearchError(error.message || 'No se pudo buscar el lugar. Intentá nuevamente.')
      }
    } finally {
      if (currentRequest === requestId.current) setSearching(false)
    }
  }

  async function selectMapPoint(point) {
    const currentRequest = ++requestId.current
    setSelectedPoint(point)
    setSearching(true)
    setSearchError('')
    setSearchResult('Buscando la dirección del punto seleccionado...')

    try {
      const params = new URLSearchParams({
        format: 'jsonv2',
        lat: String(point.latitude),
        lon: String(point.longitude),
        zoom: '18',
        addressdetails: '1',
      })
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
        headers: { 'Accept-Language': 'es' },
      })
      if (!response.ok) throw new Error('No se pudo obtener la dirección del punto seleccionado.')
      const result = await response.json()
      if (currentRequest !== requestId.current) return
      const address = conciseAddress(result)
      if (address) {
        skipNextTextSearch.current = address
        onChange?.({ ...point, meeting_point: address })
        setSearchResult(`Dirección seleccionada: ${address}`)
      } else {
        onChange?.(point)
        setSearchResult('Punto seleccionado en el mapa.')
      }
    } catch (error) {
      if (currentRequest === requestId.current) {
        // Aunque falle la búsqueda inversa, conservamos el punto exacto elegido.
        onChange?.(point)
        setSearchError(error.message || 'No se pudo obtener la dirección.')
      }
    } finally {
      if (currentRequest === requestId.current) setSearching(false)
    }
  }

  // Buscar automáticamente cuando cambia el texto, con una pausa para no consultar por cada tecla.
  useEffect(() => {
    if (firstTextEffect.current) {
      firstTextEffect.current = false
      if (latitude != null && longitude != null) return undefined
    }

    const cleanText = searchText.trim()
    if (!cleanText) {
      setSearchError('')
      setSearchResult('')
      return undefined
    }
    if (skipNextTextSearch.current === cleanText) {
      skipNextTextSearch.current = ''
      return undefined
    }

    const timer = window.setTimeout(() => {
      searchPlace(cleanText, city)
    }, 750)
    return () => window.clearTimeout(timer)
  }, [searchText, city, latitude, longitude])

  const initialCenter = selectedPoint
    ? [selectedPoint.latitude, selectedPoint.longitude]
    : DEFAULT_CENTER

  return (
    <div className="meeting-point-picker">
      <div className="meeting-point-search-row">
        <button
          type="button"
          onClick={() => searchPlace()}
          disabled={searching || !searchText.trim()}
          style={{
            border: 0,
            borderRadius: '10px',
            padding: '11px 16px',
            background: searching ? '#b9a5d5' : '#7041b8',
            color: '#ffffff',
            fontWeight: 700,
            cursor: searching ? 'wait' : 'pointer',
          }}
        >
          {searching ? 'Buscando...' : 'Ubicar en el mapa'}
        </button>
      </div>

      <p className="meeting-point-instructions">
        Escribí un lugar o dirección para ubicarlo automáticamente, o hacé clic en el mapa para elegir el punto exacto.
      </p>

      <MapContainer
        center={initialCenter}
        zoom={selectedPoint ? 17 : 14}
        scrollWheelZoom
        style={{ height: '350px', width: '100%', borderRadius: '12px', zIndex: 1 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onSelect={selectMapPoint} />
        <MapViewUpdater point={selectedPoint} />
        {selectedPoint && (
          <Marker position={[selectedPoint.latitude, selectedPoint.longitude]} icon={meetingPointIcon} />
        )}
      </MapContainer>

      {searchError && <p className="meeting-point-search-error" role="status">{searchError}</p>}
      {searchResult && <p className="meeting-point-search-result" role="status">{searchResult}</p>}
      <p className="meeting-point-coordinates">
        {selectedPoint
          ? `Punto seleccionado: ${selectedPoint.latitude.toFixed(6)}, ${selectedPoint.longitude.toFixed(6)}`
          : 'Todavía no seleccionaste un punto de encuentro.'}
      </p>
    </div>
  )
}
