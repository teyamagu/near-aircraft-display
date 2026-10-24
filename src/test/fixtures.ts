import type { Aircraft, Enrichment } from '../types.ts'

export function aircraft(overrides: Partial<Aircraft> = {}): Aircraft {
  return {
    hex: '86e7e6',
    callsign: 'JAL39',
    registration: 'JA874J',
    typeCode: 'B789',
    desc: null,
    lat: 35.5,
    lon: 139.5,
    altFt: 12000,
    gs: 400,
    track: 270,
    distanceKm: 18,
    ...overrides,
  }
}

export function enrichment(overrides: Partial<Enrichment> = {}): Enrichment {
  return {
    manufacturer: 'Boeing',
    type: '787 9',
    icaoType: 'B789',
    registration: 'JA874J',
    registeredOwner: 'Japan Airlines',
    route: {
      airlineName: 'Japan Airlines',
      airlineIata: 'JL',
      airlineIcao: 'JAL',
      origin: {
        iata: 'HND',
        lat: 35.5523,
        lon: 139.78,
        municipality: 'Tokyo',
      },
      destination: {
        iata: 'TSA',
        lat: 25.0694,
        lon: 121.552,
        municipality: 'Taipei City',
      },
    },
    ...overrides,
  }
}
