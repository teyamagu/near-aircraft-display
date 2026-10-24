import type { LatLon } from '../types.ts'

const EARTH_RADIUS_KM = 6371.0088
const KM_PER_NM = 1.852

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/** 2 点間の大円距離（km, haversine） */
export function haversineKm(a: LatLon, b: LatLon): number {
  const dLat = toRadians(b.lat - a.lat)
  const dLon = toRadians(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function kmToNm(km: number): number {
  return km / KM_PER_NM
}

export function knotsToKmh(knots: number): number {
  return knots * KM_PER_NM
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/** 出発地→現在位置 / (出発地→現在位置 + 現在位置→到着地) を 0..1 にクランプ */
export function routeProgress(origin: LatLon, current: LatLon, destination: LatLon): number {
  const done = haversineKm(origin, current)
  const remaining = haversineKm(current, destination)
  const total = done + remaining
  if (total === 0) return 0
  return clamp01(done / total)
}
