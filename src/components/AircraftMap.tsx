import { useEffect, useRef } from 'react'
import L from 'leaflet'
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

function aircraftIcon(aircraft: Aircraft, selected: boolean): L.DivIcon {
  const size = selected ? 34 : 26
  const rotation = aircraft.track !== null ? `transform:rotate(${aircraft.track}deg)` : ''
  const shape = aircraft.track !== null ? 'ac-arrow' : 'ac-arrow no-track'
  return L.divIcon({
    className: `ac-icon${selected ? ' selected' : ''}`,
    html: `<div class="${shape}" style="${rotation}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function labelFor(aircraft: Aircraft): string {
  return aircraft.callsign || aircraft.registration || aircraft.hex.toUpperCase()
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
  const canvasRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const fittedRef = useRef(false)
  const onSelectRef = useRef(onSelect)
  const onPickRef = useRef(onPick)
  const pickableRef = useRef(pickable)
  onSelectRef.current = onSelect
  onPickRef.current = onPick
  pickableRef.current = pickable

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || mapRef.current) return
    const map = L.map(canvas, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      scrollWheelZoom: true,
    })
    L.tileLayer(TILE_BASE, { attribution: ATTRIBUTION, maxZoom: MAX_ZOOM }).addTo(map)
    L.tileLayer(TILE_LABELS, { maxZoom: MAX_ZOOM }).addTo(map)
    map.on('click', (event) => {
      if (!pickableRef.current) return
      onPickRef.current(event.latlng.lat, event.latlng.lng)
    })
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      fittedRef.current = false
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const layers: L.Layer[] = []

    if (position !== null && !fittedRef.current) {
      fittedRef.current = true
      map.fitBounds(L.latLng(position.lat, position.lon).toBounds(radiusKm * 2000))
    }

    if (position !== null) {
      layers.push(
        L.circle([position.lat, position.lon], {
          radius: radiusKm * 1000,
          interactive: false,
          color: '#5d78ff',
          weight: 1,
          dashArray: '4 6',
          fillOpacity: 0.03,
        }).addTo(map),
        L.marker([position.lat, position.lon], { icon: userIcon, interactive: false }).addTo(map),
      )
    }

    for (const item of aircraft) {
      const selected = item.hex === selectedHex
      const marker = L.marker([item.lat, item.lon], {
        icon: aircraftIcon(item, selected),
        zIndexOffset: selected ? 1000 : 0,
      })
      marker.on('click', (event) => {
        L.DomEvent.stopPropagation(event)
        onSelectRef.current(item.hex)
      })
      if (selected) {
        marker.bindTooltip(labelFor(item), {
          permanent: true,
          direction: 'right',
          offset: [14, 0],
          className: 'ac-label',
        })
      }
      marker.addTo(map)
      layers.push(marker)
    }

    return () => {
      for (const layer of layers) layer.remove()
    }
  }, [aircraft, position, radiusKm, selectedHex])

  return (
    <div className={`map${pickable ? ' pickable' : ''}`}>
      <div ref={canvasRef} className="map-canvas" />
    </div>
  )
}
