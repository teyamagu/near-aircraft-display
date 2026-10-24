import { useMemo, useState } from 'react'
import { AircraftList } from './components/AircraftList.tsx'
import { AircraftMap } from './components/AircraftMap.tsx'
import { LedPanel } from './components/LedPanel.tsx'
import type { IdleMessage } from './components/LedPanel.tsx'
import { StatusBar } from './components/StatusBar.tsx'
import { useEnrichment } from './hooks/useEnrichment.ts'
import { useLocation } from './hooks/useLocation.ts'
import type { GeoStatus } from './hooks/useLocation.ts'
import { useNearbyAircraft } from './hooks/useNearbyAircraft.ts'
import { enrichmentKey } from './lib/api.ts'
import { buildDisplay } from './lib/format.ts'
import type { EnrichmentTarget } from './types.ts'

const DEFAULT_RADIUS_KM = 80
const ENRICH_TOP_COUNT = 30

function geoMessage(status: GeoStatus): string | null {
  switch (status) {
    case 'denied':
      return '位置情報の利用が許可されていません。'
    case 'unavailable':
      return '現在地を取得できませんでした。'
    case 'unsupported':
      return 'このブラウザは位置情報に対応していません。'
    case 'pending':
    case 'granted':
      return null
  }
}

export function App() {
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM)
  const location = useLocation()
  const nearby = useNearbyAircraft(location.positionRef, radiusKm, location.fixToken)
  const { aircraft, selectedHex, loading, error, lastUpdated } = nearby

  const selected = useMemo(
    () => aircraft.find((item) => item.hex === selectedHex) ?? null,
    [aircraft, selectedHex],
  )

  const targets = useMemo<EnrichmentTarget[]>(() => {
    const top = aircraft.slice(0, ENRICH_TOP_COUNT)
    const ordered = selected ? [selected, ...top] : top
    const seen = new Set<string>()
    const result: EnrichmentTarget[] = []
    for (const item of ordered) {
      if (seen.has(item.hex)) continue
      seen.add(item.hex)
      result.push({ hex: item.hex, callsign: item.callsign })
    }
    return result
  }, [aircraft, selected])
  const entries = useEnrichment(targets)

  const now = lastUpdated ?? new Date()
  const selectedEntry = selected ? entries[enrichmentKey(selected.hex, selected.callsign)] : undefined
  const display = selected
    ? buildDisplay(selected, selectedEntry?.status === 'done' ? selectedEntry.data : null, now)
    : null

  const position = location.position
  const geoNotice = geoMessage(location.status)
  const waitingForPermission = location.status === 'pending' && position === null
  const pickable = location.status !== 'granted' || position?.source === 'manual'

  let idle: IdleMessage = { line1: 'STANDBY', line2: 'NO POSITION' }
  let emptyMessage = '現在地が決まると、近隣を飛行中の機体をここに表示します'
  if (position !== null) {
    if (lastUpdated === null) {
      idle = { line1: 'STANDBY', line2: error ? 'NO DATA' : 'SCANNING' }
      emptyMessage = error ? '機体一覧を取得できていません' : '取得中…'
    } else {
      idle = { line1: 'STANDBY', line2: 'NO AIRCRAFT' }
      emptyMessage = '半径内に飛行中の機体はありません'
    }
  }

  return (
    <div className="app">
      <StatusBar
        position={position}
        radiusKm={radiusKm}
        onRadiusChange={setRadiusKm}
        onRequestLocation={location.requestCurrentLocation}
        onRefresh={nearby.refresh}
        onManualPosition={location.setManualPosition}
        loading={loading}
        hasError={error !== null}
        lastUpdated={lastUpdated}
      />

      {waitingForPermission ? (
        <p className="notice">
          現在地の許可を待っています。ブラウザの確認で「許可」を選ぶと、現在地の近くを飛んでいる航空機を表示します。
          位置情報は端末内で使い、機体データの取得時に緯度経度（小数 4 桁）だけをプロキシ経由で送ります。
        </p>
      ) : null}

      {geoNotice !== null && position?.source !== 'manual' ? (
        <p className="notice warn">
          {geoNotice}地図をクリックして位置を指定するか、上の欄に緯度経度を入力してください。
        </p>
      ) : null}

      {error !== null ? (
        <p className="notice error" role="alert">
          {error}
          {aircraft.length > 0 ? '前回の一覧を表示しています。' : ''}
          <button type="button" onClick={nearby.refresh}>
            再試行
          </button>
        </p>
      ) : null}

      <main className="main">
        <LedPanel display={display} idle={idle} />
        <div className="list-wrap">
          <AircraftList
            aircraft={aircraft}
            entries={entries}
            selectedHex={selectedHex}
            onSelect={nearby.select}
            emptyMessage={emptyMessage}
            now={now}
          />
        </div>
      </main>

      <AircraftMap
        position={position}
        radiusKm={radiusKm}
        aircraft={aircraft}
        selectedHex={selectedHex}
        onSelect={nearby.select}
        pickable={pickable}
        onPick={location.setManualPosition}
      />
    </div>
  )
}
