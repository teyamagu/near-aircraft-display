import { describe, expect, it } from 'vitest'
import { aircraft, enrichment } from '../test/fixtures.ts'
import { buildDisplay, displayAircraftName, formatAircraftType, formatClock } from './format.ts'

describe('formatAircraftType', () => {
  it('型式番号の前にハイフンを入れる', () => {
    expect(formatAircraftType('Boeing', '787 9')).toBe('Boeing 787-9')
    expect(formatAircraftType('Boeing', '737 900')).toBe('Boeing 737-900')
    expect(formatAircraftType('Boeing', '737 8')).toBe('Boeing 737-8')
    expect(formatAircraftType(null, '787 9')).toBe('787-9')
    expect(formatAircraftType('Airbus', 'A320 214')).toBe('Airbus A320-214')
    expect(formatAircraftType('Boeing', null)).toBeNull()
    expect(formatAircraftType('Boeing', 'Boeing 787-9')).toBe('Boeing 787-9')
  })
})

describe('displayAircraftName', () => {
  it('詳細型式より ICAO の通称を優先する', () => {
    expect(displayAircraftName('Boeing', '737NG 881/W', 'B738', null, 'B738')).toBe('Boeing 737-800')
    expect(displayAircraftName('Boeing', '787 9', 'B789', null, 'B789')).toBe('Boeing 787-9')
    expect(displayAircraftName('Boeing', '777 F', 'B77L', null, 'B77L')).toBe('Boeing 777-200LR')
    expect(displayAircraftName('Boeing', '767 346ER', 'B763', null, 'B763')).toBe('Boeing 767-300')
  })

  it('ICAO が無くても 737NG の百の位から通称にする', () => {
    expect(displayAircraftName(null, '737NG 781/W', null, null, null)).toBe('Boeing 737-700')
  })

  it('どれも無ければ UNKNOWN', () => {
    expect(displayAircraftName(null, null, null, null, null)).toBe('UNKNOWN')
  })

  it('説明文を型式コードより先に使う', () => {
    expect(displayAircraftName(null, null, null, 'Cessna 172', 'C172')).toBe('Cessna 172')
  })
})

describe('buildDisplay', () => {
  const now = new Date(2026, 9, 24, 12, 0, 0)

  it('路線があるときは残距離と推定 ETA を出す', () => {
    const display = buildDisplay(aircraft(), enrichment(), now)
    expect(display.airline).toBe('Japan Airlines')
    expect(display.airlineKnown).toBe(true)
    expect(display.logoCode).toBe('JL')
    expect(display.flight).toBe('JAL39')
    expect(display.aircraftName).toBe('Boeing 787-9')
    expect(display.route?.origin).toBe('HND')
    expect(display.route?.destination).toBe('TSA')
    expect(display.altText).toBe('ALT 12000ft')
    expect(display.bottomText).toMatch(/^\d+km to go$/)
    expect(display.rightText).toMatch(/^ETA ~\d{2}:\d{2}$/)
    expect(display.route?.progress).toBeGreaterThan(0)
    expect(display.route?.progress).toBeLessThan(1)
  })

  it('速度が遅いときは ETA ではなく対地速度を出す', () => {
    const display = buildDisplay(aircraft({ gs: 30 }), enrichment(), now)
    expect(display.rightText).toBe(`GS ${Math.round(30 * 1.852)}km/h`)
  })

  it('路線が無いときは所有者名と現在地からの距離を出す', () => {
    const display = buildDisplay(
      aircraft({ callsign: '', registration: null, altFt: null, gs: null }),
      enrichment({ route: null }),
      now,
    )
    expect(display.airline).toBe('Japan Airlines')
    expect(display.logoCode).toBeNull()
    expect(display.flight).toBe('JA874J')
    expect(display.route).toBeNull()
    expect(display.altText).toBe('ALT --')
    expect(display.rightText).toBe('GS --')
    expect(display.bottomText).toBe('18km away')
  })

  it('便名も登録記号も無いときは hex を出す', () => {
    const display = buildDisplay(
      aircraft({ callsign: '', registration: null }),
      enrichment({ route: null, registration: null, registeredOwner: null }),
      now,
    )
    expect(display.flight).toBe('86E7E6')
    expect(display.airline).toBe('UNKNOWN')
  })

  it('IATA が無ければ ICAO をロゴコードにする', () => {
    const info = enrichment()
    info.route = info.route && { ...info.route, airlineIata: null, airlineIcao: 'JAL' }
    expect(buildDisplay(aircraft(), info, now).logoCode).toBe('JAL')
  })
})

describe('formatClock', () => {
  it('時分をゼロ埋めする', () => {
    expect(formatClock(new Date(2026, 0, 1, 9, 5, 0))).toBe('09:05')
  })
})
