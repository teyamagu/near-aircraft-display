import { render } from '@testing-library/react'
import L from 'leaflet'
import { describe, expect, it, vi } from 'vitest'
import { aircraft } from '../test/fixtures.ts'
import type { UserPosition } from '../types.ts'
import { AircraftMap } from './AircraftMap.tsx'

const position: UserPosition = { lat: 35.6812, lon: 139.7671, accuracy: 20, source: 'gps' }

function watchMaps(): L.Map[] {
  const maps: L.Map[] = []
  const original = L.map
  vi.spyOn(L, 'map').mockImplementation((...args) => {
    const map = original(...(args as Parameters<typeof original>))
    maps.push(map)
    return map
  })
  return maps
}

describe('AircraftMap', () => {
  it('最初の位置で一度だけ範囲を合わせ、機体のクリックは位置指定にしない', () => {
    const onSelect = vi.fn()
    const onPick = vi.fn()
    const maps = watchMaps()
    const fitBounds = vi.spyOn(L.Map.prototype, 'fitBounds')
    const view = render(
      <AircraftMap
        position={position}
        radiusKm={80}
        aircraft={[aircraft({ track: 90 })]}
        selectedHex="86e7e6"
        onSelect={onSelect}
        pickable
        onPick={onPick}
      />,
    )

    const canvas = view.container.querySelector('.map-canvas')
    expect(canvas?.classList.contains('leaflet-container')).toBe(true)
    expect(view.container.querySelector('.map')?.classList.contains('pickable')).toBe(true)
    expect(fitBounds).toHaveBeenCalledTimes(1)

    view.rerender(
      <AircraftMap
        position={position}
        radiusKm={80}
        aircraft={[aircraft({ track: 90 }), aircraft({ hex: 'aaaaaa', lat: 36, lon: 140 })]}
        selectedHex="86e7e6"
        onSelect={onSelect}
        pickable
        onPick={onPick}
      />,
    )
    expect(fitBounds).toHaveBeenCalledTimes(1)

    const map = maps[0]
    expect(map).toBeTruthy()
    map?.fire('click', { latlng: L.latLng(35.7, 139.8) })
    expect(onPick).toHaveBeenCalledWith(35.7, 139.8)

    const markers: L.Marker[] = []
    map?.eachLayer((layer) => {
      if (layer instanceof L.Marker) markers.push(layer)
    })
    const marker = markers.find((layer) => layer.getLatLng().lat === 35.5)
    expect(marker).toBeTruthy()
    marker?.fire('click')
    expect(onSelect).toHaveBeenCalledWith('86e7e6')
    expect(onPick).toHaveBeenCalledTimes(1)

    view.unmount()
    fitBounds.mockRestore()
  })
})
