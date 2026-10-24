import type { Aircraft, Airport, Enrichment, FlightRoute, LatLon } from '../types.ts'
import { haversineKm, kmToNm } from './geo.ts'

const MAX_RADIUS_NM = 250
const REQUEST_TIMEOUT_MS = 10_000

/** 本番は Cloudflare Worker。開発中は Vite の /upstream プロキシ */
function endpoint(path: string): string {
  const configured = import.meta.env.VITE_API_BASE
  const base = typeof configured === 'string' ? configured.replace(/\/$/, '') : ''
  if (base) return `${base}${path}`
  return `/upstream${path}`
}

class HttpError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`HTTP ${status}`)
    this.status = status
  }
}

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

async function getJson(url: string, signal: AbortSignal): Promise<unknown> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const response = await fetch(url, {
    signal: AbortSignal.any([signal, timeout]),
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new HttpError(response.status)
  return (await response.json()) as unknown
}

/** `{ ac: [...] }` から配列を取り出す。配列でなければ null */
function extractAircraftArray(json: unknown): unknown[] | null {
  if (!isRecord(json)) return null
  return Array.isArray(json.ac) ? (json.ac as unknown[]) : null
}

/** 飛行中の機体だけを Aircraft に正規化する。地上・位置なしは null */
function normalizeFlying(raw: unknown, user: LatLon): Aircraft | null {
  if (!isRecord(raw)) return null
  const hex = asString(raw.hex)
  const lat = asNumber(raw.lat)
  const lon = asNumber(raw.lon)
  if (hex === null || lat === null || lon === null) return null

  const altBaro = raw.alt_baro
  if (altBaro === 'ground') return null
  if (typeof altBaro === 'number' && !(altBaro > 0)) return null

  return {
    hex: hex.toLowerCase(),
    callsign: (asString(raw.flight) ?? '').toUpperCase(),
    registration: asString(raw.r),
    typeCode: asString(raw.t),
    desc: asString(raw.desc),
    lat,
    lon,
    altFt: typeof altBaro === 'number' ? altBaro : null,
    gs: asNumber(raw.gs),
    track: asNumber(raw.track),
    distanceKm: haversineKm(user, { lat, lon }),
  }
}

async function fetchFrom(url: string, signal: AbortSignal): Promise<unknown[]> {
  const list = extractAircraftArray(await getJson(url, signal))
  if (list === null) throw new Error('invalid response')
  return list
}

/** 近隣の飛行中機を距離昇順で返す。adsb.lol → 失敗なら adsb.fi */
export async function fetchNearbyAircraft(
  user: LatLon,
  radiusKm: number,
  signal: AbortSignal,
): Promise<Aircraft[]> {
  const nm = Math.min(MAX_RADIUS_NM, Math.max(1, Math.ceil(kmToNm(radiusKm))))
  const query = `lat/${user.lat.toFixed(4)}/lon/${user.lon.toFixed(4)}/dist/${nm}`

  let rawList: unknown[]
  try {
    rawList = await fetchFrom(endpoint(`/lol/v2/${query}`), signal)
  } catch (error) {
    if (signal.aborted) throw error
    rawList = await fetchFrom(endpoint(`/fi/api/v3/${query}`), signal)
  }

  const seen = new Set<string>()
  const flying: Aircraft[] = []
  for (const raw of rawList) {
    const aircraft = normalizeFlying(raw, user)
    if (aircraft === null || seen.has(aircraft.hex)) continue
    seen.add(aircraft.hex)
    flying.push(aircraft)
  }
  return flying.sort((a, b) => a.distanceKm - b.distanceKm)
}

function parseAirport(value: unknown): Airport | null {
  if (!isRecord(value)) return null
  const iata = asString(value.iata_code) ?? asString(value.icao_code)
  const lat = asNumber(value.latitude)
  const lon = asNumber(value.longitude)
  if (iata === null || lat === null || lon === null) return null
  return { iata, lat, lon, municipality: asString(value.municipality) }
}

function parseRoute(value: unknown): FlightRoute | null {
  if (!isRecord(value)) return null
  const origin = parseAirport(value.origin)
  const destination = parseAirport(value.destination)
  if (origin === null || destination === null) return null
  const airline = isRecord(value.airline) ? value.airline : null
  return {
    airlineName: airline ? asString(airline.name) : null,
    airlineIata: airline ? asString(airline.iata) : null,
    airlineIcao: airline ? asString(airline.icao) : null,
    origin,
    destination,
  }
}

function parseEnrichment(json: unknown): Enrichment | null {
  if (!isRecord(json) || !isRecord(json.response)) return null
  const aircraft = isRecord(json.response.aircraft) ? json.response.aircraft : null
  return {
    manufacturer: aircraft ? asString(aircraft.manufacturer) : null,
    type: aircraft ? asString(aircraft.type) : null,
    icaoType: aircraft ? asString(aircraft.icao_type) : null,
    registration: aircraft ? asString(aircraft.registration) : null,
    registeredOwner: aircraft ? asString(aircraft.registered_owner) : null,
    route: parseRoute(json.response.flightroute),
  }
}

/** adsbdb から機体・路線情報を取得する。404 は null（情報なし）。それ以外の失敗は throw */
export async function fetchEnrichment(
  hex: string,
  callsign: string,
  signal: AbortSignal,
): Promise<Enrichment | null> {
  const base = endpoint(`/adsbdb/v0/aircraft/${encodeURIComponent(hex)}`)
  const url = callsign === '' ? base : `${base}?callsign=${encodeURIComponent(callsign)}`
  try {
    return parseEnrichment(await getJson(url, signal))
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null
    throw error
  }
}

export function enrichmentKey(hex: string, callsign: string): string {
  return `${hex}|${callsign}`
}
