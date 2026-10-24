import { resolveUpstream } from './upstream.ts'

const USER_AGENT = 'near-aircraft-display/0.1'
const ALLOWED_ORIGINS = new Set([
  'https://teyamagu.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])
const WINDOW_MS = 60_000
const LIMIT_PER_WINDOW = 120

const hits = new Map<string, { count: number; resetAt: number }>()

function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? 'unknown'
}

function tooMany(ip: string): boolean {
  const now = Date.now()
  if (hits.size > 2000) {
    for (const [key, row] of hits) {
      if (now > row.resetAt) hits.delete(key)
    }
  }
  const row = hits.get(ip)
  if (!row || now > row.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  row.count += 1
  return row.count > LIMIT_PER_WINDOW
}

function corsHeaders(request: Request): Headers {
  const headers = new Headers()
  const origin = request.headers.get('Origin')
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Vary', 'Origin')
  }
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Accept')
  headers.set('Access-Control-Max-Age', '86400')
  return headers
}

function withCors(response: Response, request: Request): Response {
  const headers = new Headers(response.headers)
  headers.delete('set-cookie')
  const origin = request.headers.get('Origin')
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
    const vary = headers.get('Vary')
    headers.set('Vary', vary ? `${vary}, Origin` : 'Origin')
  } else {
    headers.delete('Access-Control-Allow-Origin')
  }
  return new Response(response.body, { status: response.status, headers })
}

function jsonError(status: number, message: string, request: Request): Response {
  const headers = corsHeaders(request)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  headers.set('Cache-Control', 'no-store')
  return new Response(JSON.stringify({ error: message }), { status, headers })
}

function cacheSeconds(pathname: string, status: number): number {
  if (pathname.startsWith('/adsbdb')) return status === 200 || status === 404 ? 3600 : 0
  return status === 200 ? 10 : 0
}

export default {
  async fetch(request: Request, _env: unknown, ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) })
    }
    if (request.method !== 'GET') return jsonError(405, 'GET only', request)
    if (tooMany(clientIp(request))) return jsonError(429, 'rate limit', request)

    const url = new URL(request.url)
    const upstream = resolveUpstream(url.pathname, url.searchParams)
    if (upstream === null) return jsonError(404, 'not found', request)

    const cache = caches.default
    const cacheKey = new Request(upstream, { method: 'GET' })
    const cached = await cache.match(cacheKey)
    if (cached) return withCors(cached, request)

    const upstreamResponse = await fetch(upstream, {
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
      signal: AbortSignal.timeout(10_000),
    })
    const body = await upstreamResponse.arrayBuffer()
    const seconds = cacheSeconds(url.pathname, upstreamResponse.status)
    const headers = new Headers()
    headers.set('Content-Type', upstreamResponse.headers.get('Content-Type') ?? 'application/json; charset=utf-8')
    headers.set('Cache-Control', seconds > 0 ? `public, max-age=${seconds}` : 'no-store')
    const response = new Response(body, { status: upstreamResponse.status, headers })
    if (seconds > 0) ctx.waitUntil(cache.put(cacheKey, response.clone()))
    return withCors(response, request)
  },
}
