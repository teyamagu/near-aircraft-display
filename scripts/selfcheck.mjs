// 純関数の自己検査: `npm run check`（Node の型除去機能で src/lib/*.ts を直接読む）
import assert from 'node:assert/strict'
import { haversineKm, routeProgress } from '../src/lib/geo.ts'
import { displayAircraftName, formatAircraftType } from '../src/lib/format.ts'

const tokyoStation = { lat: 35.6812, lon: 139.7671 }
const haneda = { lat: 35.5494, lon: 139.7798 }
const taipei = { lat: 25.0777, lon: 121.2328 }

// haversine
const tokyoToHaneda = haversineKm(tokyoStation, haneda)
assert.ok(tokyoToHaneda > 13 && tokyoToHaneda < 17, `東京駅-羽田: ${tokyoToHaneda}`)
assert.equal(haversineKm(haneda, haneda), 0)
assert.ok(Math.abs(haversineKm(haneda, taipei) - haversineKm(taipei, haneda)) < 1e-9)

// 大円の中点
function midpoint(a, b) {
  const rad = (d) => (d * Math.PI) / 180
  const deg = (r) => (r * 180) / Math.PI
  const [lat1, lon1, lat2, lon2] = [rad(a.lat), rad(a.lon), rad(b.lat), rad(b.lon)]
  const bx = Math.cos(lat2) * Math.cos(lon2 - lon1)
  const by = Math.cos(lat2) * Math.sin(lon2 - lon1)
  const lat = Math.atan2(
    Math.sin(lat1) + Math.sin(lat2),
    Math.hypot(Math.cos(lat1) + bx, by),
  )
  const lon = lon1 + Math.atan2(by, Math.cos(lat1) + bx)
  return { lat: deg(lat), lon: deg(lon) }
}

// 進捗率
const mid = midpoint(haneda, taipei)
const midProgress = routeProgress(haneda, mid, taipei)
assert.ok(Math.abs(midProgress - 0.5) < 0.01, `中点の進捗: ${midProgress}`)
assert.equal(routeProgress(haneda, haneda, taipei), 0)
assert.equal(routeProgress(haneda, taipei, taipei), 1)
assert.equal(routeProgress(haneda, haneda, haneda), 0)
const offRoute = routeProgress(haneda, { lat: -40, lon: -60 }, taipei)
assert.ok(offRoute >= 0 && offRoute <= 1)

// 機種名
assert.equal(formatAircraftType('Boeing', '787 9'), 'Boeing 787-9')
assert.equal(formatAircraftType('Boeing', '737 900'), 'Boeing 737-900')
assert.equal(formatAircraftType('Boeing', '737 8'), 'Boeing 737-8')
assert.equal(formatAircraftType(null, '787 9'), '787-9')
assert.equal(formatAircraftType('Airbus', 'A320 214'), 'Airbus A320-214')
assert.equal(formatAircraftType('Boeing', null), null)
assert.equal(
  displayAircraftName('Boeing', '737NG 881/W', 'B738', null, 'B738'),
  'Boeing 737-800',
)
assert.equal(displayAircraftName('Boeing', '787 9', 'B789', null, 'B789'), 'Boeing 787-9')
assert.equal(displayAircraftName('Boeing', '777 F', 'B77L', null, 'B77L'), 'Boeing 777-200LR')
assert.equal(displayAircraftName('Boeing', '767 346ER', 'B763', null, 'B763'), 'Boeing 767-300')
assert.equal(displayAircraftName(null, null, null, null, 'C30J'), 'Lockheed C-130J')
assert.equal(displayAircraftName('Boeing', '737NG 781/W', null, null, 'B737'), 'Boeing 737-700')
assert.equal(displayAircraftName('Boeing', '737NG 781/W', null, null, null), 'Boeing 737-700')
assert.equal(displayAircraftName('Boeing', '737NG 9G', null, null, null), 'Boeing 737-900')

console.log(
  `selfcheck OK (東京駅-羽田 ${tokyoToHaneda.toFixed(1)}km, 中点の進捗 ${midProgress.toFixed(3)})`,
)
