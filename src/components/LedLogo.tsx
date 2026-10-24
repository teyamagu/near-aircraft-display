import { useEffect, useRef, useState } from 'react'
import { Globe } from './Globe.tsx'

const CELL = 4
const PANEL_BLUE: Rgb = [28, 61, 255]

type Rgb = [number, number, number]

function avsLogoUrl(code: string): string {
  return `https://pics.avs.io/200/200/${encodeURIComponent(code)}.png`
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const lightness = (max + min) / 2
  if (max === min) return [0, 0, lightness]
  const delta = max - min
  const saturation = delta / (1 - Math.abs(2 * lightness - 1))
  let hue = 0
  if (max === rn) hue = (gn - bn) / delta + (gn < bn ? 6 : 0)
  else if (max === gn) hue = (bn - rn) / delta + 2
  else hue = (rn - gn) / delta + 4
  return [hue / 6, saturation, lightness]
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const hue = (p: number, q: number, t: number) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }
  if (s === 0) {
    const gray = Math.round(l * 255)
    return [gray, gray, gray]
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [
    Math.round(hue(p, q, h + 1 / 3) * 255),
    Math.round(hue(p, q, h) * 255),
    Math.round(hue(p, q, h - 1 / 3) * 255),
  ]
}

/**
 * 青地の LED に載せても色が残るようにする。
 * 赤などの色相はそのまま、真っ黒は白、青地に溶ける紺だけ明るくする。
 */
export function ledInk(r: number, g: number, b: number): Rgb {
  const [hue, saturation, lightness] = rgbToHsl(r, g, b)
  if (lightness < 0.14) return [236, 240, 255]
  const onBlueField = hue > 0.54 && hue < 0.75
  if (!onBlueField) {
    return hslToRgb(hue, Math.max(saturation, 0.72), Math.min(0.58, Math.max(lightness, 0.46)))
  }
  return hslToRgb(hue, Math.min(Math.max(saturation, 0.45), 0.7), Math.max(lightness, 0.74))
}

function drawLedLogo(canvas: HTMLCanvasElement, image: HTMLImageElement) {
  const parent = canvas.parentElement
  if (!parent) return
  const width = Math.max(1, parent.clientWidth)
  const height = Math.max(1, parent.clientHeight)
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.floor(width * dpr)
  canvas.height = Math.floor(height * dpr)

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, width, height)

  const source = document.createElement('canvas')
  source.width = image.naturalWidth
  source.height = image.naturalHeight
  const sourceCtx = source.getContext('2d', { willReadFrequently: true })
  if (!sourceCtx) return
  sourceCtx.drawImage(image, 0, 0)
  const pixels = sourceCtx.getImageData(0, 0, source.width, source.height).data

  const scale = Math.min(width / source.width, height / source.height) * 0.9
  const dw = source.width * scale
  const dh = source.height * scale
  const ox = (width - dw) / 2
  const oy = (height - dh) / 2
  const radius = CELL * 0.4

  const cols = Math.ceil(width / CELL)
  const rows = Math.ceil(height / CELL)
  for (let gy = 0; gy < rows; gy += 1) {
    for (let gx = 0; gx < cols; gx += 1) {
      const cx = gx * CELL + CELL / 2
      const cy = gy * CELL + CELL / 2
      const color = sample(pixels, source.width, source.height, cx, cy, ox, oy, dw, dh)
      ctx.fillStyle = `rgb(${color[0]} ${color[1]} ${color[2]})`
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function sample(
  pixels: Uint8ClampedArray,
  iw: number,
  ih: number,
  cx: number,
  cy: number,
  ox: number,
  oy: number,
  dw: number,
  dh: number,
): Rgb {
  const x0 = Math.floor(((cx - CELL / 2 - ox) / dw) * iw)
  const y0 = Math.floor(((cy - CELL / 2 - oy) / dh) * ih)
  const x1 = Math.ceil(((cx + CELL / 2 - ox) / dw) * iw)
  const y1 = Math.ceil(((cy + CELL / 2 - oy) / dh) * ih)
  if (x1 <= 0 || y1 <= 0 || x0 >= iw || y0 >= ih) return PANEL_BLUE

  let r = 0
  let g = 0
  let b = 0
  let count = 0
  const stepX = Math.max(1, Math.floor((x1 - x0) / 3))
  const stepY = Math.max(1, Math.floor((y1 - y0) / 3))
  for (let y = Math.max(0, y0); y < Math.min(ih, y1); y += stepY) {
    for (let x = Math.max(0, x0); x < Math.min(iw, x1); x += stepX) {
      const index = (y * iw + x) * 4
      const alpha = pixels[index + 3] ?? 0
      if (alpha < 140) continue
      r += pixels[index] ?? 0
      g += pixels[index + 1] ?? 0
      b += pixels[index + 2] ?? 0
      count += 1
    }
  }
  if (count === 0) return PANEL_BLUE
  return ledInk(r / count, g / count, b / count)
}

export function LedLogo({ code, name }: { code: string | null; name: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [useGlobe, setUseGlobe] = useState(code === null)

  useEffect(() => {
    if (!code) return
    const parent = canvasRef.current?.parentElement
    if (!parent) return

    let cancelled = false
    let image: HTMLImageElement | null = null

    const paint = () => {
      if (cancelled || !image || !canvasRef.current || image.naturalWidth < 2) return
      try {
        drawLedLogo(canvasRef.current, image)
      } catch {
        if (!cancelled) setUseGlobe(true)
      }
    }

    image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (image && image.naturalWidth < 2) {
        if (!cancelled) setUseGlobe(true)
        return
      }
      paint()
    }
    image.onerror = () => {
      if (!cancelled) setUseGlobe(true)
    }
    image.src = avsLogoUrl(code)

    const observer = new ResizeObserver(() => paint())
    observer.observe(parent)
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [code])

  if (!code || useGlobe) return <Globe />

  return <canvas ref={canvasRef} className="airline-logo" role="img" aria-label={name} />
}
