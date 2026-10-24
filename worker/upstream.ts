const LOL_ORIGIN = 'https://api.adsb.lol'
const FI_ORIGIN = 'https://opendata.adsb.fi'
const ADSBDB_ORIGIN = 'https://api.adsbdb.com'

const HEX = /^[0-9a-fA-F]{6}$/
const CALLSIGN = /^[A-Za-z0-9]{1,8}$/

function numberIn(value: string, min: number, max: number): number | null {
  if (!/^-?\d{1,3}(?:\.\d{1,4})?$/.test(value)) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null
  return parsed
}

function distNm(value: string): number | null {
  if (!/^\d{1,3}$/.test(value)) return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 250) return null
  return parsed
}

function nearbyUrl(origin: string, prefix: string, rest: string): string | null {
  const match = /^\/lat\/([^/]+)\/lon\/([^/]+)\/dist\/([^/]+)$/.exec(rest)
  if (!match) return null
  const lat = numberIn(match[1] ?? '', -90, 90)
  const lon = numberIn(match[2] ?? '', -180, 180)
  const dist = distNm(match[3] ?? '')
  if (lat === null || lon === null || dist === null) return null
  return `${origin}${prefix}/lat/${match[1]}/lon/${match[2]}/dist/${match[3]}`
}

function aircraftUrl(rest: string, search: URLSearchParams): string | null {
  const match = /^\/v0\/aircraft\/([^/]+)$/.exec(rest)
  if (!match) return null
  const hex = match[1] ?? ''
  if (!HEX.test(hex)) return null
  const url = new URL(`${ADSBDB_ORIGIN}/v0/aircraft/${hex.toLowerCase()}`)
  const callsign = search.get('callsign')
  if (callsign !== null) {
    if (!CALLSIGN.test(callsign)) return null
    url.searchParams.set('callsign', callsign.toUpperCase())
  }
  if ([...search.keys()].some((key) => key !== 'callsign')) return null
  return url.toString()
}

/** 許可した航空機 API だけに対応する上流 URL を返す。それ以外は null */
export function resolveUpstream(pathname: string, search: URLSearchParams): string | null {
  if (pathname !== pathname.trim() || pathname.includes('%') || pathname.includes('..')) return null
  const path = pathname.replace(/\/+$/, '') || '/'

  const lol = tail(path, '/lol/v2')
  if (lol !== null) return nearbyUrl(LOL_ORIGIN, '/v2', lol)
  const fi = tail(path, '/fi/api/v3')
  if (fi !== null) return nearbyUrl(FI_ORIGIN, '/api/v3', fi)
  const adsbdb = tail(path, '/adsbdb')
  if (adsbdb !== null) return aircraftUrl(adsbdb, search)
  return null
}

function tail(path: string, prefix: string): string | null {
  if (!path.startsWith(`${prefix}/`)) return null
  return path.slice(prefix.length)
}
