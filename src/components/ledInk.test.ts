import { describe, expect, it } from 'vitest'
import { ledInk } from './LedLogo.tsx'

describe('ledInk', () => {
  it('真っ黒は白いドットにする', () => {
    expect(ledInk(10, 0, 0)).toEqual([236, 240, 255])
  })

  it('JAL の赤は赤のまま残す', () => {
    const [red, green, blue] = ledInk(224, 16, 32)
    expect(red).toBeGreaterThan(180)
    expect(green).toBeLessThan(80)
    expect(blue).toBeLessThan(80)
  })

  it('青地に溶ける紺は明るくする', () => {
    const [red, green, blue] = ledInk(32, 64, 144)
    expect(blue).toBeGreaterThan(180)
    expect(red + green + blue).toBeGreaterThan(32 + 64 + 144)
  })
})
