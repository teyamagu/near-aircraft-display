import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchEnrichment, fetchNearbyAircraft } from './api.ts'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const user = { lat: 35.6812, lon: 139.7671 }

function flying(hex: string, lat: number, lon: number, extra: Record<string, unknown> = {}) {
  return { hex, flight: `${hex} `, lat, lon, alt_baro: 10000, gs: 400, track: 90, t: 'B738', ...extra }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchNearbyAircraft', () => {
  it('地上と高度 0 以下を除き、近い順に並べる', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          ac: [
            flying('aaaaaa', 36.2, 139.8),
            flying('bbbbbb', 35.7, 139.8),
            { hex: 'cccccc', lat: 35.69, lon: 139.77, alt_baro: 'ground' },
            { hex: 'dddddd', lat: 35.69, lon: 139.77, alt_baro: 0 },
            { hex: 'eeeeee', flight: 'NO POS' },
          ],
        }),
      ),
    )

    const list = await fetchNearbyAircraft(user, 80, new AbortController().signal)
    expect(list.map((item) => item.hex)).toEqual(['bbbbbb', 'aaaaaa'])
    expect(list[0]?.callsign).toBe('BBBBBB')
    expect(list[0]?.distanceKm).toBeLessThan(list[1]?.distanceKm ?? 0)
    expect(list[0]?.typeCode).toBe('B738')
  })

  it('同じ hex は一度だけ残す', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          ac: [flying('aaaaaa', 35.7, 139.8), flying('AAAAAA', 35.71, 139.8)],
        }),
      ),
    )
    const list = await fetchNearbyAircraft(user, 80, new AbortController().signal)
    expect(list).toHaveLength(1)
  })

  it('最初の取得に失敗したら予備の API を使う', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/lol/')) throw new Error('down')
      return jsonResponse({ ac: [flying('ffffff', 35.7, 139.8)] })
    })
    vi.stubGlobal('fetch', fetchMock)
    const list = await fetchNearbyAircraft(user, 80, new AbortController().signal)
    expect(list.map((item) => item.hex)).toEqual(['ffffff'])
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/fi/')
  })

  it('中止済みのリクエストは予備へ切り替えない', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError')
      return jsonResponse({ ac: [] })
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchNearbyAircraft(user, 80, controller.signal)).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('配列でない応答は失敗になる', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ ac: null })))
    await expect(fetchNearbyAircraft(user, 80, new AbortController().signal)).rejects.toThrow()
  })
})

describe('fetchEnrichment', () => {
  it('路線と航空会社コードを読む', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        expect(String(url)).toContain('/adsbdb/v0/aircraft/86e7e6?callsign=JAL39')
        return jsonResponse({
          response: {
            aircraft: { manufacturer: 'Boeing', type: '787 9', icao_type: 'B789', registration: 'JA874J' },
            flightroute: {
              airline: { name: 'Japan Airlines', iata: 'JL', icao: 'JAL' },
              origin: { iata_code: 'HND', latitude: 35.55, longitude: 139.78, municipality: 'Tokyo' },
              destination: { iata_code: 'TSA', latitude: 25.07, longitude: 121.55, municipality: 'Taipei' },
            },
          },
        })
      }),
    )
    const result = await fetchEnrichment('86e7e6', 'JAL39', new AbortController().signal)
    expect(result?.route?.airlineIata).toBe('JL')
    expect(result?.route?.origin.iata).toBe('HND')
    expect(result?.manufacturer).toBe('Boeing')
  })

  it('404 は情報なしとして null を返す', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ response: 'unknown callsign' }, 404)))
    await expect(fetchEnrichment('86e7e6', 'JAL39', new AbortController().signal)).resolves.toBeNull()
  })

  it('404 以外の失敗は投げる', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'nope' }, 500)))
    await expect(fetchEnrichment('86e7e6', '', new AbortController().signal)).rejects.toThrow('HTTP 500')
  })
})
