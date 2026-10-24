import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { UserPosition } from '../types.ts'

export type GeoStatus = 'pending' | 'granted' | 'denied' | 'unavailable' | 'unsupported'

export interface LocationState {
  position: UserPosition | null
  /** ポーリングが読むための最新位置。GPS の更新で再取得は起こさない */
  positionRef: RefObject<UserPosition | null>
  status: GeoStatus
  /** 「新しい基準位置が決まった」ときだけ増える。即時取得のトリガ */
  fixToken: number
  requestCurrentLocation: () => void
  setManualPosition: (lat: number, lon: number) => void
}

const WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 5_000,
  timeout: 20_000,
}

export function useLocation(): LocationState {
  const [position, setPosition] = useState<UserPosition | null>(null)
  const [status, setStatus] = useState<GeoStatus>(() =>
    'geolocation' in navigator ? 'pending' : 'unsupported',
  )
  const [fixToken, setFixToken] = useState(0)

  const positionRef = useRef<UserPosition | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const manualRef = useRef(false)
  const awaitingFixRef = useRef(true)

  const stopWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  const startWatch = useCallback(() => {
    stopWatch()
    manualRef.current = false
    awaitingFixRef.current = true

    if (!('geolocation' in navigator)) {
      setStatus('unsupported')
      return
    }
    setStatus('pending')

    watchIdRef.current = navigator.geolocation.watchPosition(
      (geo) => {
        if (manualRef.current) return
        const next: UserPosition = {
          lat: geo.coords.latitude,
          lon: geo.coords.longitude,
          accuracy: Number.isFinite(geo.coords.accuracy) ? geo.coords.accuracy : null,
          source: 'gps',
        }
        positionRef.current = next
        setPosition(next)
        setStatus('granted')
        if (awaitingFixRef.current) {
          awaitingFixRef.current = false
          setFixToken((token) => token + 1)
        }
      },
      (error) => {
        if (manualRef.current) return
        setStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable')
      },
      WATCH_OPTIONS,
    )
  }, [stopWatch])

  useEffect(() => {
    startWatch()
    return stopWatch
  }, [startWatch, stopWatch])

  const setManualPosition = useCallback(
    (lat: number, lon: number) => {
      stopWatch()
      manualRef.current = true
      const next: UserPosition = { lat, lon, accuracy: null, source: 'manual' }
      positionRef.current = next
      setPosition(next)
      setFixToken((token) => token + 1)
    },
    [stopWatch],
  )

  return {
    position,
    positionRef,
    status,
    fixToken,
    requestCurrentLocation: startWatch,
    setManualPosition,
  }
}
