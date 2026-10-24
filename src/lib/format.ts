import type { Aircraft, DisplayInfo, Enrichment, LatLon, RouteDisplay } from '../types.ts'
import { haversineKm, knotsToKmh, routeProgress } from './geo.ts'

/** gs がこの値（ノット）を超えるときだけ ETA を推定する */
const MIN_GS_FOR_ETA_KNOTS = 40

const MODEL_WITH_VARIANT = /^([A-Z]{0,2}\d+)\s+(\d+[A-Z]*)$/i

/** LED に載せやすい、よく見る ICAO 型式。adsbdb の詳細型式（737NG 881/W など）よりこちらを優先する */
const FRIENDLY_ICAO: Record<string, string> = {
  A318: 'Airbus A318',
  A319: 'Airbus A319',
  A320: 'Airbus A320',
  A321: 'Airbus A321',
  A20N: 'Airbus A320neo',
  A21N: 'Airbus A321neo',
  A332: 'Airbus A330-200',
  A333: 'Airbus A330-300',
  A338: 'Airbus A330-800',
  A339: 'Airbus A330-900',
  A359: 'Airbus A350-900',
  A35K: 'Airbus A350-1000',
  A388: 'Airbus A380-800',
  BCS1: 'Airbus A220-100',
  BCS3: 'Airbus A220-300',
  B734: 'Boeing 737-400',
  B736: 'Boeing 737-600',
  B737: 'Boeing 737-700',
  B738: 'Boeing 737-800',
  B739: 'Boeing 737-900',
  B37M: 'Boeing 737 MAX 7',
  B38M: 'Boeing 737 MAX 8',
  B39M: 'Boeing 737 MAX 9',
  B3XM: 'Boeing 737 MAX 10',
  B744: 'Boeing 747-400',
  B748: 'Boeing 747-8',
  B752: 'Boeing 757-200',
  B753: 'Boeing 757-300',
  B762: 'Boeing 767-200',
  B763: 'Boeing 767-300',
  B764: 'Boeing 767-400',
  B772: 'Boeing 777-200',
  B773: 'Boeing 777-300',
  B77L: 'Boeing 777-200LR',
  B77W: 'Boeing 777-300ER',
  B788: 'Boeing 787-8',
  B789: 'Boeing 787-9',
  B78X: 'Boeing 787-10',
  E170: 'Embraer 170',
  E190: 'Embraer 190',
  E75L: 'Embraer 175',
  E75S: 'Embraer 175',
  E290: 'Embraer 190-E2',
  E295: 'Embraer 195-E2',
  DH8D: 'Dash 8 Q400',
  C30J: 'Lockheed C-130J',
  A3ST: 'Airbus A300-600ST',
}

/** adsbdb の type（"787 9"）を "787-9" のように整える。manufacturer があれば先頭に付ける */
export function formatAircraftType(manufacturer: string | null, type: string | null): string | null {
  const trimmedType = type?.trim()
  if (!trimmedType) return null
  const model = trimmedType.replace(MODEL_WITH_VARIANT, '$1-$2')
  const trimmedManufacturer = manufacturer?.trim()
  if (!trimmedManufacturer) return model
  if (model.toLowerCase().startsWith(trimmedManufacturer.toLowerCase())) return model
  return `${trimmedManufacturer} ${model}`
}

function friendlyIcaoName(code: string | null): string | null {
  if (!code) return null
  return FRIENDLY_ICAO[code.trim().toUpperCase()] ?? null
}

/** 787-9 や A321neo のような通称はそのまま。型式詳細（767-346ER や 777 F）は ICAO 名に置き換える */
function prefersFriendlyName(formatted: string): boolean {
  return !/(?:\d{3}-\d{1,4}|MAX \d|neo|Q400|C-130J|A220-\d{3})$/i.test(formatted)
}

/** "737NG 781/W" の百の位はシリーズ。8xx は 737-800 */
function boeingNgName(type: string | null): string | null {
  if (!type) return null
  const series = type.toUpperCase().match(/737\s*NG\s*([789])/)?.[1]
  if (series !== '7' && series !== '8' && series !== '9') return null
  const model = { '7': '700', '8': '800', '9': '900' }[series]
  return `Boeing 737-${model}`
}

export function displayAircraftName(
  manufacturer: string | null,
  type: string | null,
  icaoType: string | null,
  desc: string | null,
  typeCode: string | null,
): string {
  const formatted = formatAircraftType(manufacturer, type)
  const friendly =
    friendlyIcaoName(icaoType ?? typeCode) ?? boeingNgName(type) ?? boeingNgName(formatted)
  if (friendly && (formatted === null || prefersFriendlyName(formatted))) return friendly
  return formatted ?? desc ?? friendly ?? typeCode ?? 'UNKNOWN'
}

export function formatClock(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

export function formatClockWithSeconds(date: Date): string {
  return `${formatClock(date)}:${String(date.getSeconds()).padStart(2, '0')}`
}

function resolveAirline(enrichment: Enrichment | null): string | null {
  return enrichment?.route?.airlineName ?? enrichment?.registeredOwner ?? null
}

function resolveLogoCode(enrichment: Enrichment | null): string | null {
  const route = enrichment?.route
  const raw = route?.airlineIata ?? route?.airlineIcao ?? null
  if (!raw) return null
  const code = raw.trim().toUpperCase()
  return /^[A-Z0-9]{2,3}$/.test(code) ? code : null
}

function resolveFlight(aircraft: Aircraft, enrichment: Enrichment | null): string {
  if (aircraft.callsign) return aircraft.callsign
  const registration = aircraft.registration ?? enrichment?.registration ?? null
  return registration ?? aircraft.hex.toUpperCase()
}

function resolveAircraftName(aircraft: Aircraft, enrichment: Enrichment | null): string {
  return displayAircraftName(
    enrichment?.manufacturer ?? null,
    enrichment?.type ?? null,
    enrichment?.icaoType ?? null,
    aircraft.desc,
    aircraft.typeCode,
  )
}

function resolveRoute(aircraft: Aircraft, enrichment: Enrichment | null): RouteDisplay | null {
  const route = enrichment?.route
  if (!route) return null
  const current: LatLon = { lat: aircraft.lat, lon: aircraft.lon }
  return {
    origin: route.origin.iata,
    destination: route.destination.iata,
    progress: routeProgress(route.origin, current, route.destination),
    remainingKm: haversineKm(current, route.destination),
  }
}

function resolveRightText(aircraft: Aircraft, route: RouteDisplay | null, now: Date): string {
  const gs = aircraft.gs
  if (route && gs !== null && gs > MIN_GS_FOR_ETA_KNOTS) {
    const hours = route.remainingKm / knotsToKmh(gs)
    const eta = new Date(now.getTime() + hours * 3_600_000)
    return `ETA ~${formatClock(eta)}`
  }
  return gs !== null ? `GS ${Math.round(knotsToKmh(gs))}km/h` : 'GS --'
}

export function buildDisplay(
  aircraft: Aircraft,
  enrichment: Enrichment | null,
  now: Date,
): DisplayInfo {
  const airline = resolveAirline(enrichment)
  const route = resolveRoute(aircraft, enrichment)
  return {
    airline: airline ?? 'UNKNOWN',
    airlineKnown: airline !== null,
    logoCode: resolveLogoCode(enrichment),
    flight: resolveFlight(aircraft, enrichment),
    aircraftName: resolveAircraftName(aircraft, enrichment),
    route,
    altText: aircraft.altFt !== null ? `ALT ${Math.round(aircraft.altFt)}ft` : 'ALT --',
    rightText: resolveRightText(aircraft, route, now),
    bottomText: route
      ? `${Math.round(route.remainingKm)}km to go`
      : `${Math.round(aircraft.distanceKm)}km away`,
  }
}
