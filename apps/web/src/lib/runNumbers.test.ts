import { describe, it, expect } from 'vitest'
import { round2, formatNum2, runTarget, formatPace } from './utils.js'

describe('round2', () => {
  it('keeps two decimal places', () => {
    expect(round2(5.25)).toBe(5.25)
    expect(round2(32.5)).toBe(32.5)
    expect(round2(5)).toBe(5)
  })

  it('rounds anything longer to two', () => {
    expect(round2(5.123456)).toBe(5.12)
    expect(round2(5.125)).toBe(5.13)
    expect(round2(5.129)).toBe(5.13)
  })

  // What the watch says and what the app calculates from have to be the same
  // number; summing raw floats is where they used to drift apart.
  it('cleans up float sums', () => {
    expect(5.1 + 5.2 + 5.3).not.toBe(15.6)   // 15.600000000000001
    expect(round2(5.1 + 5.2 + 5.3)).toBe(15.6)
    expect(round2(0.1 + 0.2)).toBe(0.3)
  })

  it('returns 0 for values that are not real numbers', () => {
    expect(round2(NaN)).toBe(0)
    expect(round2(Infinity)).toBe(0)
    expect(round2(Number('abc'))).toBe(0)
  })
})

describe('formatNum2', () => {
  it('shows up to two decimals without trailing zeros', () => {
    expect(formatNum2(5)).toBe('5')
    expect(formatNum2(5.5)).toBe('5.5')
    expect(formatNum2(5.25)).toBe('5.25')
    expect(formatNum2(5.1)).toBe('5.1')
  })

  it('never renders more precision than is stored', () => {
    expect(formatNum2(5.123456)).toBe('5.12')
    expect(formatNum2(32.499)).toBe('32.5')
  })

  // The old display did Math.round(durationMin): a 32.5 min run read as "33 min"
  // while pace was still computed from 32.5.
  it('keeps the half-minute the old display threw away', () => {
    expect(formatNum2(32.5)).toBe('32.5')
    expect(formatNum2(32.5)).not.toBe(String(Math.round(32.5)))
  })
})

describe('runTarget', () => {
  it('formats a prescribed distance and time at 2 dp', () => {
    expect(runTarget({ distanceKm: 5, durationMin: 30 })).toBe('5 km · 30 min')
    expect(runTarget({ distanceKm: 5.25, durationMin: 32.5 })).toBe('5.25 km · 32.5 min')
  })

  it('trims a legacy row stored with long decimals', () => {
    expect(runTarget({ distanceKm: 5.123456 })).toBe('5.12 km')
  })

  it('is empty when neither is set', () => {
    expect(runTarget({})).toBe('')
  })
})

describe('formatPace', () => {
  it('reads M:SS per km', () => {
    expect(formatPace(5, 30)).toBe('6:00')
    expect(formatPace(10, 55)).toBe('5:30')
  })

  it('agrees with the 2-dp values now shown next to it', () => {
    // 5.25 km in 32.5 min = 6.190… min/km → 6:11
    expect(formatPace(5.25, 32.5)).toBe('6:11')
  })

  it('shows a dash rather than Infinity when a side is missing', () => {
    expect(formatPace(0, 30)).toBe('—')
    expect(formatPace(5, 0)).toBe('—')
  })
})
