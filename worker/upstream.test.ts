import { describe, expect, it } from 'vitest'
import { resolveUpstream } from './upstream.ts'

function resolve(path: string): string | null {
  const parsed = new URL(path, 'https://worker.example')
  return resolveUpstream(parsed.pathname, parsed.searchParams)
}

describe('resolveUpstream', () => {
  it('近隣機の経路だけを上流 URL にする', () => {
    expect(resolve('/lol/v2/lat/35.6812/lon/139.7671/dist/43')).toBe(
      'https://api.adsb.lol/v2/lat/35.6812/lon/139.7671/dist/43',
    )
    expect(resolve('/fi/api/v3/lat/35.6812/lon/139.7671/dist/43')).toBe(
      'https://opendata.adsb.fi/api/v3/lat/35.6812/lon/139.7671/dist/43',
    )
  })

  it('機体情報は hex を小文字にし、便名は大文字にする', () => {
    expect(resolve('/adsbdb/v0/aircraft/86E7E6?callsign=jal39')).toBe(
      'https://api.adsbdb.com/v0/aircraft/86e7e6?callsign=JAL39',
    )
    expect(resolve('/adsbdb/v0/aircraft/86e7e6')).toBe('https://api.adsbdb.com/v0/aircraft/86e7e6')
  })

  it('範囲外、パスの抜け、余分なクエリを拒否する', () => {
    expect(resolve('/lol/v2/lat/35.6812/lon/139.7671/dist/251')).toBeNull()
    expect(resolve('/lol/v2/lat/95/lon/139/dist/10')).toBeNull()
    expect(resolveUpstream('/lol/v2/lat/35/lon/139/dist/10/../../hex/abc', new URLSearchParams())).toBeNull()
    expect(resolveUpstream('/lol/v2/%2e%2e/secret', new URLSearchParams())).toBeNull()
    expect(resolve('/adsbdb/v0/aircraft/zzzzzz')).toBeNull()
    expect(resolve('/adsbdb/v0/aircraft/86e7e6?callsign=bad%20sign')).toBeNull()
    expect(resolve('/adsbdb/v0/aircraft/86e7e6?callsign=JAL39&extra=1')).toBeNull()
    expect(resolve('/fi/api/v2/snapshot')).toBeNull()
    expect(resolve('/lol/v2extra/lat/1/lon/2/dist/3')).toBeNull()
  })
})
