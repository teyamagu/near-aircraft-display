import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { fetchNearbyAircraft } from '../lib/api.ts'
import type { Aircraft, UserPosition } from '../types.ts'

const POLL_INTERVAL_MS = 15_000

export interface NearbyState {
  aircraft: Aircraft[]
  selectedHex: string | null
  select: (hex: string) => void
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  refresh: () => void
}

/**
 * 基準位置が決まった時・半径変更時に即取得し、以後 15 秒ごとに再取得する。
 * 位置は ref から読むだけなので、GPS の細かい更新では再取得しない。
 */
export function useNearbyAircraft(
  positionRef: RefObject<UserPosition | null>,
  radiusKm: number,
  fixToken: number,
): NearbyState {
  const [aircraft, setAircraft] = useState<Aircraft[]>([])
  const [selectedHex, setSelectedHex] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const radiusRef = useRef(radiusKm)
  const controllerRef = useRef<AbortController | null>(null)

  const refresh = useCallback(() => {
    const position = positionRef.current
    if (position === null) return

    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setLoading(true)

    fetchNearbyAircraft(position, radiusRef.current, controller.signal)
      .then((list) => {
        if (controller.signal.aborted) return
        setAircraft(list)
        // 初回と、選択中の機体が消えたときだけ最寄りを選ぶ
        setSelectedHex((current) =>
          current !== null && list.some((item) => item.hex === current)
            ? current
            : (list[0]?.hex ?? null),
        )
        setError(null)
        setLastUpdated(new Date())
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setError('機体情報を取得できませんでした。通信状況を確認して再試行してください。')
      })
      .finally(() => {
        if (controllerRef.current === controller) setLoading(false)
      })
  }, [positionRef])

  useEffect(() => {
    if (fixToken === 0) return
    radiusRef.current = radiusKm
    refresh()
    const timer = window.setInterval(refresh, POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [fixToken, radiusKm, refresh])

  useEffect(() => () => controllerRef.current?.abort(), [])

  return { aircraft, selectedHex, select: setSelectedHex, loading, error, lastUpdated, refresh }
}
