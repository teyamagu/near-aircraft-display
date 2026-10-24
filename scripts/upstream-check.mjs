import assert from 'node:assert/strict'
import { resolveUpstream } from '../worker/upstream.ts'

function url(path) {
  const parsed = new URL(path, 'https://worker.example')
  return resolveUpstream(parsed.pathname, parsed.searchParams)
}

assert.equal(
  url('/lol/v2/lat/35.6812/lon/139.7671/dist/43'),
  'https://api.adsb.lol/v2/lat/35.6812/lon/139.7671/dist/43',
)
assert.equal(
  url('/fi/api/v3/lat/35.6812/lon/139.7671/dist/43'),
  'https://opendata.adsb.fi/api/v3/lat/35.6812/lon/139.7671/dist/43',
)
assert.equal(
  url('/adsbdb/v0/aircraft/86E7E6?callsign=JAL39'),
  'https://api.adsbdb.com/v0/aircraft/86e7e6?callsign=JAL39',
)
assert.equal(url('/adsbdb/v0/aircraft/86e7e6'), 'https://api.adsbdb.com/v0/aircraft/86e7e6')
assert.equal(
  url('/adsbdb/v0/aircraft/86e7e6?callsign=jal39'),
  'https://api.adsbdb.com/v0/aircraft/86e7e6?callsign=JAL39',
)

assert.equal(url('/lol/v2/lat/35.6812/lon/139.7671/dist/251'), null)
assert.equal(url('/lol/v2/lat/95/lon/139/dist/10'), null)
assert.equal(resolveUpstream('/lol/v2/lat/35/lon/139/dist/10/../../hex/abc', new URLSearchParams()), null)
assert.equal(resolveUpstream('/lol/v2/%2e%2e/secret', new URLSearchParams()), null)
assert.equal(url('https://example.com'), null)
assert.equal(url('/adsbdb/v0/aircraft/zzzzzz'), null)
assert.equal(url('/adsbdb/v0/aircraft/86e7e6?callsign=bad%20sign'), null)
assert.equal(url('/adsbdb/v0/aircraft/86e7e6?callsign=JAL39&extra=1'), null)
assert.equal(url('/fi/api/v2/snapshot'), null)

console.log('upstream-check OK')
