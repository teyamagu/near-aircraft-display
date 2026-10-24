import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import { Circle, MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { Aircraft, UserPosition } from '../types.ts'

// Carto Dark Matter は API キー必須の透かしタイルを返すようになったため、
// キー不要の Esri World Dark Gray を使う。タイル座標は {z}/{y}/{x}。
const TILE_BASE =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
const TILE_LABELS =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}'
const ATTRIBUTION =
  'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, FAO, NOAA, USGS, &copy; OpenStreetMap contributors, and the GIS User Community'
const DEFAULT_CENTER: L.LatLngTuple = [35.68, 139.76]
const DEFAULT_ZOOM = 8
const MAX_ZOOM = 16

const userIcon = L.divIcon({
  className: 'user-icon',
  html: '<span class="user-dot"></span>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

interface MarkerProps {
  aircraft: Aircraft
  selected: boolean
  onSelect: (hex: string) => void
}

function AircraftMarker({ aircraft, selected, onSelect }: MarkerProps) {
  const { track } = aircraft
  const icon = useMemo(() => {
    const size = selected ? 34 : 26
    const rotation = track !== null ? `transform:rotate(${track}deg)` : ''
    const shape = track !== null ? 'ac-arrow' : 'ac-arrow no-track'
    return L.divIcon({
      className: `ac-icon${selected ? ' selected' : ''}`,
      html: `<div class="${shape}" style="${rotation}"></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    })
  }, [track, selected])

  return (
    <Marker
      position={[aircraft.lat, aircraft.lon]}
      icon={icon}
      zIndexOffset={selected ? 1000 : 0}
      eventHandlers={{ click: () => onSelect(aircraft.hex) }}
    >
      {selected ? (
        <Tooltip permanent direction="right" offset={[14, 0]} className="ac-label">
          {aircraft.callsign || aircraft.registration || aircraft.hex.toUpperCase()}
        </Tooltip>
      ) : null}
    </Marker>
  )
}

/** 初めて位置が決まったときだけ、半径が収まるように表示範囲を合わせる */
function FitOnFirstFix({ position, radiusKm }: { position: UserPosition | null; radiusKm: number }) {
  const map = useMap()
  const fittedRef = useRef(false)

  useEffect(() => {
    if (position === null || fittedRef.current) return
    fittedRef.current = true
    map.fitBounds(L.latLng(position.lat, position.lon).toBounds(radiusKm * 2000))
  }, [map, position, radiusKm])

  return null
}

function ClickToPick({ enabled, onPick }: { enabled: boolean; onPick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click: (event) => {
      if (enabled) onPick(event.latlng.lat, event.latlng.lng)
    },
  })
  return null
}

interface Props {
  position: UserPosition | null
  radiusKm: number
  aircraft: Aircraft[]
  selectedHex: string | null
  onSelect: (hex: string) => void
  pickable: boolean
  onPick: (lat: number, lon: number) => void
}

export function AircraftMap({
  position,
  radiusKm,
  aircraft,
  selectedHex,
  onSelect,
  pickable,
  onPick,
}: Props) {
  return (
    <MapContainer
      className={`map${pickable ? ' pickable' : ''}`}
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom
    >
      <TileLayer url={TILE_BASE} attribution={ATTRIBUTION} maxZoom={MAX_ZOOM} />
      <TileLayer url={TILE_LABELS} maxZoom={MAX_ZOOM} />
      <FitOnFirstFix position={position} radiusKm={radiusKm} />
      <ClickToPick enabled={pickable} onPick={onPick} />
      {position ? (
        <>
          <Circle
            center={[position.lat, position.lon]}
            radius={radiusKm * 1000}
            interactive={false}
            pathOptions={{ color: '#5d78ff', weight: 1, dashArray: '4 6', fillOpacity: 0.03 }}
          />
          <Marker position={[position.lat, position.lon]} icon={userIcon} interactive={false} />
        </>
      ) : null}
      {aircraft.map((item) => (
        <AircraftMarker
          key={item.hex}
          aircraft={item}
          selected={item.hex === selectedHex}
          onSelect={onSelect}
        />
      ))}
    </MapContainer>
  )
}
