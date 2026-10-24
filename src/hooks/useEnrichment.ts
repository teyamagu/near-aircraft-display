import { useCallback, useEffect, useRef, useState } from 'react'
import { enrichmentKey, fetchEnrichment } from '../lib/api.ts'
import type { EnrichmentEntry, EnrichmentTarget } from '../types.ts'

const MAX_CONCURRENT = 3
/** 通信エラーで失敗したキーを再試行するまでの待ち時間 */
const RETRY_AFTER_MS = 60_000

/**
 * targets（先頭ほど優先）の補完情報を adsbdb から同時 3 件まで取得する。
 * 200 / 404 はセッション中キャッシュし、再取得しない。
 */
export function useEnrichment(targets: EnrichmentTarget[]): Record<string, EnrichmentEntry> {
  const [entries, setEntries] = useState<Record<string, EnrichmentEntry>>({})
  const entriesRef = useRef<Record<string, EnrichmentEntry>>({})
  const inflightRef = useRef<Set<string>>(new Set())
  const targetsRef = useRef<EnrichmentTarget[]>(targets)

  const pump = useCallback(function run(): void {
    for (const target of targetsRef.current) {
      if (inflightRef.current.size >= MAX_CONCURRENT) return
      const key = enrichmentKey(target.hex, target.callsign)
      if (inflightRef.current.has(key)) continue
      const existing = entriesRef.current[key]
      if (existing) {
        if (existing.status === 'done') continue
        if (Date.now() - existing.at < RETRY_AFTER_MS) continue
      }

      inflightRef.current.add(key)
      const controller = new AbortController()
      fetchEnrichment(target.hex, target.callsign, controller.signal)
        .then((data): EnrichmentEntry => ({ status: 'done', data }))
        .catch((): EnrichmentEntry => ({ status: 'failed', at: Date.now() }))
        .then((entry) => {
          inflightRef.current.delete(key)
          entriesRef.current = { ...entriesRef.current, [key]: entry }
          setEntries(entriesRef.current)
          run()
        })
    }
  }, [])

  useEffect(() => {
    targetsRef.current = targets
    pump()
  }, [targets, pump])

  return entries
}
