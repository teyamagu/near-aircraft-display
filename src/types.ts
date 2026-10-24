export interface LatLon {
  lat: number
  lon: number
}

/** 飛行中と判定済みの航空機（API の生データを正規化したもの） */
export interface Aircraft extends LatLon {
  hex: string
  /** trim・大文字化済み。無ければ空文字 */
  callsign: string
  registration: string | null
  /** ICAO 型式コード（例: B789） */
  typeCode: string | null
  desc: string | null
  /** フィート。数値で与えられない場合は null */
  altFt: number | null
  /** ノット */
  gs: number | null
  /** 度 */
  track: number | null
  /** ユーザーからの横方向距離 km */
  distanceKm: number
}

export interface Airport extends LatLon {
  iata: string
  municipality: string | null
}

export interface FlightRoute {
  airlineName: string | null
  /** ロゴ取得用。IATA を優先し、無ければ ICAO */
  airlineIata: string | null
  airlineIcao: string | null
  origin: Airport
  destination: Airport
}

/** adsbdb による補完情報 */
export interface Enrichment {
  manufacturer: string | null
  type: string | null
  icaoType: string | null
  registration: string | null
  registeredOwner: string | null
  route: FlightRoute | null
}

export type EnrichmentEntry =
  | { status: 'done'; data: Enrichment | null }
  | { status: 'failed'; at: number }

export interface EnrichmentTarget {
  hex: string
  callsign: string
}

export interface RouteDisplay {
  origin: string
  destination: string
  /** 0..1 */
  progress: number
  remainingKm: number
}

/** LED パネルと一覧に表示する整形済み情報 */
export interface DisplayInfo {
  airline: string
  airlineKnown: boolean
  /** 公開ロゴ CDN に渡す航空会社コード。不明なら null */
  logoCode: string | null
  flight: string
  aircraftName: string
  route: RouteDisplay | null
  altText: string
  rightText: string
  bottomText: string
}

export interface UserPosition extends LatLon {
  accuracy: number | null
  source: 'gps' | 'manual'
}
