import { useEffect, useRef, useState } from 'react'
import { Globe } from './Globe.tsx'

/** 表示ドットの一辺。小さいほどロゴの文字が残る */
const CELL = 2

type Rgb = [number, number, number]

function avsLogoUrl(code: string): string {
  return `https://pics.avs.io/200/200/${encodeURIComponent(code)}.png`
}

/**
 * 色相は保ったまま、黒地に沈む色だけ持ち上げる。
 * すでに明るい色はそのまま。真っ黒のインクは明るいドットにする。
 */
export function logoInk(r: number, g: number, b: number): Rgb {
  const red = Math.round(r)
  const green = Math.round(g)
  const blue = Math.round(b)
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  if (max <= 36 && max - min < 18) return [220, 224, 234]
  if (max >= 188 || max === 0) return [red, green, blue]
  const gain = 188 / max
  return [
    Math.min(255, Math.round(red * gain)),
    Math.min(255, Math.round(green * gain)),
    Math.min(255, Math.round(blue * gain)),
  ]
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

  const cols = Math.max(1, Math.round(width / CELL))
  const rows = Math.max(1, Math.round(height / CELL))
  const bounds = opaqueBounds(image)
  if (!bounds) return

  const grid = document.createElement('canvas')
  grid.width = cols
  grid.height = rows
  const gridCtx = grid.getContext('2d', { willReadFrequently: true })
  if (!gridCtx) return
  gridCtx.imageSmoothingEnabled = true
  gridCtx.imageSmoothingQuality = 'high'
  const scale = Math.min(cols / bounds.sw, rows / bounds.sh) * 0.96
  const dw = Math.max(1, Math.round(bounds.sw * scale))
  const dh = Math.max(1, Math.round(bounds.sh * scale))
  gridCtx.drawImage(
    image,
    bounds.sx,
    bounds.sy,
    bounds.sw,
    bounds.sh,
    Math.floor((cols - dw) / 2),
    Math.floor((rows - dh) / 2),
    dw,
    dh,
  )
  const pixels = gridCtx.getImageData(0, 0, cols, rows).data

  const cellX = width / cols
  const cellY = height / rows
  // ドット中心が画素境界に乗ると黒と混ざって暗くなるので、画素を覆う大きさにする
  const radius = Math.min(cellX, cellY) * 0.62
  for (let gy = 0; gy < rows; gy += 1) {
    for (let gx = 0; gx < cols; gx += 1) {
      const index = (gy * cols + gx) * 4
      const alpha = pixels[index + 3] ?? 0
      if (alpha < 140) continue
      const color = logoInk(pixels[index] ?? 0, pixels[index + 1] ?? 0, pixels[index + 2] ?? 0)
      ctx.fillStyle = `rgb(${color[0]} ${color[1]} ${color[2]})`
      ctx.beginPath()
      ctx.arc(gx * cellX + cellX / 2, gy * cellY + cellY / 2, radius, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

/** 透明な余白を除き、マーク本体だけをドット面いっぱいに載せる */
function opaqueBounds(image: HTMLImageElement): { sx: number; sy: number; sw: number; sh: number } | null {
  const source = document.createElement('canvas')
  source.width = image.naturalWidth
  source.height = image.naturalHeight
  const sourceCtx = source.getContext('2d', { willReadFrequently: true })
  if (!sourceCtx) return null
  sourceCtx.drawImage(image, 0, 0)
  const pixels = sourceCtx.getImageData(0, 0, source.width, source.height).data
  let minX = source.width
  let minY = source.height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const alpha = pixels[(y * source.width + x) * 4 + 3] ?? 0
      if (alpha < 140) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  if (maxX < minX || maxY < minY) return null
  return { sx: minX, sy: minY, sw: maxX - minX + 1, sh: maxY - minY + 1 }
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
