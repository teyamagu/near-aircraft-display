import { buildDisplay } from '../lib/format.ts'
import type { Aircraft, EnrichmentEntry, EnrichmentTarget } from '../types.ts'
import { enrichmentKey } from '../lib/api.ts'

interface Props {
  aircraft: Aircraft[]
  entries: Record<string, EnrichmentEntry>
  selectedHex: string | null
  onSelect: (hex: string) => void
  emptyMessage: string | null
  now: Date
}

function entryFor(
  entries: Record<string, EnrichmentEntry>,
  target: EnrichmentTarget,
) {
  const entry = entries[enrichmentKey(target.hex, target.callsign)]
  return entry?.status === 'done' ? entry.data : null
}

export function AircraftList({ aircraft, entries, selectedHex, onSelect, emptyMessage, now }: Props) {
  if (aircraft.length === 0) {
    return <div className="list-empty">{emptyMessage}</div>
  }

  return (
    <ul className="list">
      {aircraft.map((item) => {
        const display = buildDisplay(item, entryFor(entries, { hex: item.hex, callsign: item.callsign }), now)
        const selected = item.hex === selectedHex
        const subtitle = display.airlineKnown ? display.airline : display.aircraftName
        return (
          <li key={item.hex}>
            <button
              type="button"
              className={`list-row${selected ? ' selected' : ''}`}
              aria-pressed={selected}
              onClick={() => onSelect(item.hex)}
            >
              <span className="list-flight">{display.flight}</span>
              <span className="list-distance">{item.distanceKm.toFixed(1)} km</span>
              <span className="list-sub">{subtitle}</span>
              <span className="list-alt">
                {item.altFt !== null ? `${Math.round(item.altFt)} ft` : '高度 --'}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
