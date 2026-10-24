import { useLayoutEffect, useRef } from 'react'
import { LedLogo } from './LedLogo.tsx'
import type { DisplayInfo } from '../types.ts'

const BAR_CELLS = 24

export interface IdleMessage {
  line1: string
  line2: string
}

interface Props {
  display: DisplayInfo | null
  idle: IdleMessage
}

/** 実測幅に合わせて文字を縮める。ピクセル丸めでまだはみ出すときはもう一度かける */
function tighten(el: HTMLElement, available: number, measure: () => number) {
  el.style.fontSize = ''
  let needed = measure()
  for (let attempt = 0; attempt < 2 && needed > available + 1; attempt += 1) {
    const current = parseFloat(getComputedStyle(el).fontSize)
    el.style.fontSize = `${Math.max(current * (available / needed) * 0.96, 8)}px`
    needed = measure()
  }
}

/** 省略表示を外した状態で、文字そのものの幅を測る */
function naturalWidth(el: HTMLElement): number {
  const previous = {
    width: el.style.width,
    maxWidth: el.style.maxWidth,
    overflow: el.style.overflow,
  }
  el.style.width = 'max-content'
  el.style.maxWidth = 'none'
  el.style.overflow = 'visible'
  const width = el.scrollWidth
  el.style.width = previous.width
  el.style.maxWidth = previous.maxWidth
  el.style.overflow = previous.overflow
  return width
}

/**
 * 枠幅を超えるときだけ文字を縮める。
 * Silkscreen の読み込み後にも測り直す。ellipsis は使わない。
 */
function useFitText<T extends HTMLElement>(text: string, portionOfParent = 0) {
  const ref = useRef<T>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let lastWidth = -1

    const fit = (force: boolean) => {
      const parentWidth = el.parentElement?.clientWidth ?? 0
      const available = portionOfParent > 0 ? parentWidth * portionOfParent : el.clientWidth
      if (available <= 0) return
      if (!force && Math.round(available) === lastWidth) return
      lastWidth = Math.round(available)
      tighten(el, available, () => naturalWidth(el))
    }

    fit(true)
    const parent = el.parentElement
    const observer = parent
      ? new ResizeObserver(() => {
          fit(false)
        })
      : null
    if (parent) observer?.observe(parent)
    const onFonts = () => fit(true)
    document.fonts.ready.then(onFonts).catch(() => undefined)
    document.fonts.addEventListener('loadingdone', onFonts)
    return () => {
      observer?.disconnect()
      document.fonts.removeEventListener('loadingdone', onFonts)
    }
  }, [text, portionOfParent])

  return ref
}

function FitLine({ text, className }: { text: string; className: string }) {
  const ref = useFitText<HTMLDivElement>(text)
  return (
    <div ref={ref} className={className}>
      {text}
    </div>
  )
}

/** ALT と ETA を同じ大きさのまま、両方最後まで入るように縮める */
function FitSplit({ left, right }: { left: string; right: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let lastWidth = -1

    const fit = (force: boolean) => {
      const available = el.clientWidth
      if (available <= 0) return
      if (!force && available === lastWidth) return
      lastWidth = available
      const gap = () => parseFloat(getComputedStyle(el).columnGap || getComputedStyle(el).gap) || 0
      tighten(el, available, () => {
        const spans = [...el.querySelectorAll('span')]
        return spans.reduce((sum, span) => sum + naturalWidth(span), 0) + gap()
      })
    }

    fit(true)
    const parent = el.parentElement ?? el
    const observer = new ResizeObserver(() => {
      fit(false)
    })
    observer.observe(parent)
    const onFonts = () => fit(true)
    document.fonts.ready.then(onFonts).catch(() => undefined)
    document.fonts.addEventListener('loadingdone', onFonts)
    return () => {
      observer.disconnect()
      document.fonts.removeEventListener('loadingdone', onFonts)
    }
  }, [left, right])

  return (
    <div ref={ref} className="led-row led-wide led-split">
      <span>{left}</span>
      <span>{right}</span>
    </div>
  )
}

function ProgressBar({ progress }: { progress: number }) {
  const head = Math.min(BAR_CELLS - 1, Math.round(progress * (BAR_CELLS - 1)))
  const cells = Array.from({ length: BAR_CELLS }, (_, index) => {
    const state = index < head ? 'done' : index === head ? 'head' : 'todo'
    return <span key={index} className={`bar-cell ${state}`} />
  })
  return (
    <div
      className="bar"
      role="progressbar"
      aria-label="飛行の進捗"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
    >
      {cells}
    </div>
  )
}

export function LedPanel({ display, idle }: Props) {
  const active = display !== null
  const route = display?.route ?? null
  const airline = active ? display.airline : idle.line1
  const flight = active ? display.flight : idle.line2
  const flightRef = useFitText<HTMLSpanElement>(flight, 0.58)

  return (
    <div className="led-bezel">
      <section
        className={`led-panel${active ? '' : ' idle'}`}
        aria-label={active ? `選択中の機体 ${display.flight}` : '待機中'}
      >
        <div className="led-globe">
          <LedLogo key={active ? display.logoCode : 'globe'} code={active ? display.logoCode : null} name={airline} />
        </div>

        <FitLine className="led-row led-airline" text={airline} />
        <div className="led-row led-flight-row">
          <span ref={flightRef} className="led-flight">
            {flight}
          </span>
          {route ? <ProgressBar progress={route.progress} /> : null}
        </div>
        <FitLine
          className="led-row led-route"
          text={route ? `${route.origin} -> ${route.destination}` : ''}
        />

        <FitLine className="led-row led-wide" text={active ? display.aircraftName : ''} />
        <FitSplit left={active ? display.altText : ''} right={active ? display.rightText : ''} />
        <FitLine className="led-row led-wide" text={active ? display.bottomText : ''} />

        <div className="led-dots" aria-hidden="true" />
      </section>
    </div>
  )
}
