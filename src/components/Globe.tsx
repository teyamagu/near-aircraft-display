const CENTER = 50
const RADIUS = 44
const PARALLELS_DEG = [-60, -30, 0, 30, 60]
const MERIDIAN_DEG = [0, 30, 60, 90, 120, 150]
const TILT_RATIO = 0.22

interface Ellipse {
  cy: number
  rx: number
  ry: number
}

const parallels: Ellipse[] = PARALLELS_DEG.map((deg) => {
  const rad = (deg * Math.PI) / 180
  const rx = RADIUS * Math.cos(rad)
  return { cy: CENTER - RADIUS * Math.sin(rad) * (1 - TILT_RATIO), rx, ry: rx * TILT_RATIO }
})

const meridians: { deg: number; rx: number }[] = MERIDIAN_DEG.map((deg) => ({
  deg,
  rx: Math.abs(RADIUS * Math.cos((deg * Math.PI) / 180)),
}))

/** 汎用の緯線・経線ワイヤーフレーム地球（特定の航空会社のロゴではない） */
export function Globe() {
  return (
    <svg className="globe" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="globe-clip">
          <circle cx={CENTER} cy={CENTER} r={RADIUS} />
        </clipPath>
      </defs>
      <g fill="none" stroke="currentColor" strokeWidth="1.7">
        <circle cx={CENTER} cy={CENTER} r={RADIUS} />
        <g clipPath="url(#globe-clip)">
          {parallels.map((e) => (
            <ellipse key={`p${e.cy}`} cx={CENTER} cy={e.cy} rx={e.rx} ry={e.ry} />
          ))}
          {meridians.map((meridian) => (
            <ellipse key={`m${meridian.deg}`} cx={CENTER} cy={CENTER} rx={meridian.rx} ry={RADIUS} />
          ))}
        </g>
      </g>
    </svg>
  )
}
