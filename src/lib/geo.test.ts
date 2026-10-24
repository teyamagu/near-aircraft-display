import { describe, expect, it } from 'vitest'
import { clamp01, haversineKm, kmToNm, knotsToKmh, routeProgress } from './geo.ts'

const tokyoStation = { lat: 35.6812, lon: 139.7671 }
const haneda = { lat: 35.5494, lon: 139.7798 }
const taipei = { lat: 25.0777, lon: 121.2328 }

function midpoint(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = (degrees: number) => (degrees * Math.PI) / 180
  const deg = (radians: number) => (radians * 180) / Math.PI
  const lat1 = rad(a.lat)
  const lon1 = rad(a.lon)
  const lat2 = rad(b.lat)
  const lon2 = rad(b.lon)
  const bx = Math.cos(lat2) * Math.cos(lon2 - lon1)
  const by = Math.cos(lat2) * Math.sin(lon2 - lon1)
  const lat = Math.atan2(Math.sin(lat1) + Math.sin(lat2), Math.hypot(Math.cos(lat1) + bx, by))
  const lon = lon1 + Math.atan2(by, Math.cos(lat1) + bx)
  return { lat: deg(lat), lon: deg(lon) }
}

describe('haversineKm', () => {
  it('東京駅と羽田はおよそ 15km', () => {
    const distance = haversineKm(tokyoStation, haneda)
    expect(distance).toBeGreaterThan(13)
    expect(distance).toBeLessThan(17)
  })

  it('同一点は 0 で、向きを入れ替えても同じ', () => {
    expect(haversineKm(haneda, haneda)).toBe(0)
    expect(haversineKm(haneda, taipei)).toBeCloseTo(haversineKm(taipei, haneda), 8)
  })
})

describe('単位換算', () => {
  it('海里とノットを km に戻す', () => {
    expect(kmToNm(1.852)).toBeCloseTo(1)
    expect(knotsToKmh(1)).toBeCloseTo(1.852)
  })
})

describe('routeProgress', () => {
  it('出発地では 0、到着地では 1、中点ではおよそ 0.5', () => {
    expect(routeProgress(haneda, haneda, taipei)).toBe(0)
    expect(routeProgress(haneda, taipei, taipei)).toBe(1)
    expect(routeProgress(haneda, haneda, haneda)).toBe(0)
    expect(routeProgress(haneda, midpoint(haneda, taipei), taipei)).toBeCloseTo(0.5, 2)
  })

  it('航路から大きく外れても 0 から 1 に収まる', () => {
    const progress = routeProgress(haneda, { lat: -40, lon: -60 }, taipei)
    expect(progress).toBeGreaterThanOrEqual(0)
    expect(progress).toBeLessThanOrEqual(1)
  })
})

describe('clamp01', () => {
  it('範囲外を端に寄せる', () => {
    expect(clamp01(-1)).toBe(0)
    expect(clamp01(2)).toBe(1)
    expect(clamp01(0.4)).toBe(0.4)
  })
})
