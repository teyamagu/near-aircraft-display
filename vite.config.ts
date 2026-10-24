import { defineConfig, loadEnv } from 'vite'
import type { ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'

const USER_AGENT = 'near-aircraft-display/0.1'

function createUpstreamProxy(prefix: string, target: string): ProxyOptions {
  const prefixPattern = new RegExp(`^${prefix}`)
  return {
    target,
    changeOrigin: true,
    rewrite: (path) => path.replace(prefixPattern, ''),
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        proxyReq.removeHeader('origin')
        proxyReq.setHeader('User-Agent', USER_AGENT)
        proxyReq.setHeader('Accept', 'application/json')
      })
    },
  }
}

const proxy: Record<string, ProxyOptions> = {
  '/upstream/lol': createUpstreamProxy('/upstream/lol', 'https://api.adsb.lol'),
  '/upstream/fi': createUpstreamProxy('/upstream/fi', 'https://opendata.adsb.fi'),
  '/upstream/adsbdb': createUpstreamProxy('/upstream/adsbdb', 'https://api.adsbdb.com'),
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (mode === 'production' && !env.VITE_API_BASE) {
    throw new Error('本番ビルドには VITE_API_BASE（Cloudflare Worker の URL）が必要です')
  }
  return {
    base: mode === 'production' ? '/near-aircraft-display/' : '/',
    plugins: [react()],
    server: { proxy },
    preview: { proxy },
  }
})
