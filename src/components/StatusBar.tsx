import { useState } from 'react'
import type { FormEvent } from 'react'
import { formatClockWithSeconds } from '../lib/format.ts'
import type { UserPosition } from '../types.ts'

const RADIUS_OPTIONS_KM = [30, 80, 150, 250] as const

interface Props {
  position: UserPosition | null
  radiusKm: number
  onRadiusChange: (radiusKm: number) => void
  onRequestLocation: () => void
  onRefresh: () => void
  onManualPosition: (lat: number, lon: number) => void
  loading: boolean
  hasError: boolean
  lastUpdated: Date | null
}

function describePosition(position: UserPosition | null): string {
  if (position === null) return '未取得'
  const coords = `${position.lat.toFixed(4)}, ${position.lon.toFixed(4)}`
  if (position.source === 'manual') return `${coords}（手動指定）`
  return position.accuracy !== null ? `${coords}（精度 ${Math.round(position.accuracy)}m）` : coords
}

export function StatusBar({
  position,
  radiusKm,
  onRadiusChange,
  onRequestLocation,
  onRefresh,
  onManualPosition,
  loading,
  hasError,
  lastUpdated,
}: Props) {
  const [latText, setLatText] = useState('')
  const [lonText, setLonText] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const submitManual = (event: FormEvent) => {
    event.preventDefault()
    const lat = Number(latText)
    const lon = Number(lonText)
    const valid =
      latText.trim() !== '' &&
      lonText.trim() !== '' &&
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lon) <= 180
    if (!valid) {
      setFormError('緯度 -90〜90、経度 -180〜180 の数値で入力してください')
      return
    }
    setFormError(null)
    onManualPosition(lat, lon)
  }

  return (
    <header className="status-bar">
      <div className="status-main">
        <h1 className="status-title">近隣航空機ディスプレイ</h1>
        <div className="status-item">
          <span className="status-label">現在地</span>
          <span className="status-value">{describePosition(position)}</span>
        </div>
        <label className="status-item">
          <span className="status-label">半径</span>
          <select value={radiusKm} onChange={(e) => onRadiusChange(Number(e.target.value))}>
            {RADIUS_OPTIONS_KM.map((km) => (
              <option key={km} value={km}>
                {km} km
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={onRequestLocation}>
          現在地を取得
        </button>
        <button type="button" onClick={onRefresh} disabled={position === null}>
          更新
        </button>
        <div className="status-item status-state" aria-live="polite">
          {loading ? <span className="badge loading">取得中…</span> : null}
          {hasError ? <span className="badge error">エラー</span> : null}
          <span className="status-label">最終更新</span>
          <span className="status-value">
            {lastUpdated ? formatClockWithSeconds(lastUpdated) : '--:--:--'}
          </span>
        </div>
      </div>

      <form className="manual-form" onSubmit={submitManual}>
        <span className="status-label">位置を手入力</span>
        <input
          type="number"
          step="any"
          inputMode="decimal"
          placeholder="緯度"
          aria-label="緯度"
          value={latText}
          onChange={(e) => setLatText(e.target.value)}
        />
        <input
          type="number"
          step="any"
          inputMode="decimal"
          placeholder="経度"
          aria-label="経度"
          value={lonText}
          onChange={(e) => setLonText(e.target.value)}
        />
        <button type="submit">設定</button>
        {formError ? <span className="form-error">{formError}</span> : null}
      </form>
    </header>
  )
}
