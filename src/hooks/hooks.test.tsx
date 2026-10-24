import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UserPosition } from '../types.ts'
import { useEnrichment } from './useEnrichment.ts'
import { useLocation } from './useLocation.ts'
import { useNearbyAircraft } from './useNearbyAircraft.ts'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useNearbyAircraft', () => {
  it('位置が決まるまで取得せず、決まったら近い機体を選ぶ', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ac: [
          { hex: 'aaaaaa', flight: 'FAR1', lat: 36.2, lon: 140, alt_baro: 10000 },
          { hex: 'bbbbbb', flight: 'NEAR1', lat: 35.7, lon: 139.8, alt_baro: 8000 },
        ],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const positionRef = {
      current: { lat: 35.6812, lon: 139.7671, accuracy: null, source: 'manual' } satisfies UserPosition,
    }

    const waiting = renderHook(() => useNearbyAircraft(positionRef, 80, 0))
    expect(fetchMock).not.toHaveBeenCalled()
    waiting.unmount()

    const { result } = renderHook(() => useNearbyAircraft(positionRef, 80, 1))
    await waitFor(() => expect(result.current.aircraft).toHaveLength(2))
    expect(result.current.selectedHex).toBe('bbbbbb')
    expect(result.current.error).toBeNull()
  })

  it('選択中の機体が残っていれば選択を維持する', async () => {
    let round = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        round += 1
        const second = round > 1
        return jsonResponse({
          ac: [
            { hex: 'bbbbbb', flight: 'KEEP', lat: 35.7, lon: 139.8, alt_baro: 8000 },
            {
              hex: second ? 'cccccc' : 'aaaaaa',
              flight: 'OTHER',
              lat: 36.5,
              lon: 140.5,
              alt_baro: 10000,
            },
          ],
        })
      }),
    )
    const positionRef = {
      current: { lat: 35.6812, lon: 139.7671, accuracy: null, source: 'manual' } satisfies UserPosition,
    }
    const { result } = renderHook(() => useNearbyAircraft(positionRef, 80, 1))
    await waitFor(() => expect(result.current.selectedHex).toBe('bbbbbb'))
    result.current.refresh()
    await waitFor(() => expect(result.current.aircraft.some((item) => item.hex === 'cccccc')).toBe(true))
    expect(result.current.selectedHex).toBe('bbbbbb')
  })
})

describe('useEnrichment', () => {
  it('同じ機体を二度取得しない', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ response: 'unknown callsign' }, 404))
    vi.stubGlobal('fetch', fetchMock)
    const { result, rerender } = renderHook(
      ({ callsign }) => useEnrichment([{ hex: '86e7e6', callsign }]),
      { initialProps: { callsign: 'JAL39' } },
    )
    await waitFor(() => expect(result.current['86e7e6|JAL39']?.status).toBe('done'))
    rerender({ callsign: 'JAL39' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('useLocation', () => {
  it('ブラウザの現在地を受け取り、手入力では監視を止める', async () => {
    const clearWatch = vi.fn()
    const watchPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 35.1, longitude: 139.2, accuracy: 12 },
      } as GeolocationPosition)
      return 4
    })
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { watchPosition, clearWatch },
    })

    const { result } = renderHook(() => useLocation())
    await waitFor(() => expect(result.current.position?.source).toBe('gps'))
    expect(result.current.position).toMatchObject({ lat: 35.1, lon: 139.2, accuracy: 12 })

    result.current.setManualPosition(35.68, 139.76)
    await waitFor(() => expect(result.current.position?.source).toBe('manual'))
    expect(clearWatch).toHaveBeenCalled()
  })
})
