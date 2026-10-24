import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from './index.ts'

class MemoryCache {
  private readonly store = new Map<string, Response>()

  async match(request: Request): Promise<Response | undefined> {
    const found = this.store.get(request.url)
    return found ? found.clone() : undefined
  }

  async put(request: Request, response: Response): Promise<void> {
    this.store.set(request.url, response.clone())
  }
}

function request(path: string, init: { method?: string; origin?: string; ip?: string } = {}): Request {
  const headers = new Headers()
  if (init.origin) headers.set('Origin', init.origin)
  if (init.ip) headers.set('CF-Connecting-IP', init.ip)
  return new Request(`https://near-aircraft-display.teyamagu.workers.dev${path}`, {
    method: init.method ?? 'GET',
    headers,
  })
}

async function call(path: string, init: { method?: string; origin?: string; ip?: string } = {}) {
  const pending: Promise<unknown>[] = []
  const response = await worker.fetch(request(path, init), {}, {
    waitUntil(promise) {
      pending.push(promise)
    },
  })
  await Promise.all(pending)
  return response
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('worker', () => {
  it('許可したオリジンにだけ CORS を付ける', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ac: [] })))
    const allowed = await call('/lol/v2/lat/35.6812/lon/139.7671/dist/10', {
      origin: 'https://teyamagu.github.io',
      ip: 'cors-ok',
    })
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe('https://teyamagu.github.io')

    const foreign = await call('/lol/v2/lat/35.6812/lon/139.7671/dist/10', {
      origin: 'https://evil.example',
      ip: 'cors-foreign',
    })
    expect(foreign.status).toBe(200)
    expect(foreign.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('GET 以外と不明な経路を拒否する', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const options = await call('/lol/v2/lat/1/lon/2/dist/3', { method: 'OPTIONS', ip: 'opt' })
    expect(options.status).toBe(204)
    const posted = await call('/lol/v2/lat/1/lon/2/dist/3', { method: 'POST', ip: 'post' })
    expect(posted.status).toBe(405)
    const missing = await call('/lol/v2/lat/1/lon/2/dist/999', { ip: 'missing' })
    expect(missing.status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('同じ上流 URL はキャッシュし、回数を超えると 429 を返す', async () => {
    const fetchMock = vi.fn(async () => Response.json({ ac: [] }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('caches', { default: new MemoryCache() })

    const first = await call('/fi/api/v3/lat/35/lon/139/dist/10', { ip: 'cache' })
    const second = await call('/fi/api/v3/lat/35/lon/139/dist/10', { ip: 'cache-2' })
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    let limited = 0
    for (let i = 0; i < 130; i += 1) {
      const response = await call(`/lol/v2/lat/10/lon/10/dist/${(i % 200) + 1}`, { ip: 'busy' })
      if (response.status === 429) limited = response.status
    }
    expect(limited).toBe(429)
  })
})
