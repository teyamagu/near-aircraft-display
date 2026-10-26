import { describe, expect, it } from 'vitest'
import { logoInk } from './LedLogo.tsx'

describe('logoInk', () => {
  it('すでに明るい赤はそのまま残す', () => {
    expect(logoInk(224, 16, 32)).toEqual([224, 16, 32])
  })

  it('黒地に沈む色は色相を保って明るくする', () => {
    const [red, green, blue] = logoInk(32, 64, 144)
    expect(blue).toBeGreaterThan(red)
    expect(blue).toBeGreaterThan(green)
    expect(blue).toBeGreaterThan(144)

    const gold = logoInk(80, 60, 10)
    expect(gold[0]).toBeGreaterThan(gold[1])
    expect(gold[1]).toBeGreaterThan(gold[2])
    expect(gold[0]).toBeGreaterThan(80)
  })

  it('真っ黒のインクは明るいドットにする', () => {
    const [red, green, blue] = logoInk(10, 0, 0)
    expect(red).toBeGreaterThan(180)
    expect(green).toBeGreaterThan(180)
    expect(blue).toBeGreaterThan(180)
  })
})
