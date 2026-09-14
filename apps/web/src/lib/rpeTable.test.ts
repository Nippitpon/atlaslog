import { describe, it, expect } from 'vitest'
import { getRpePct, calcWeight, structuredWeight } from './rpeTable.js'

describe('getRpePct', () => {
  it('reads the table exactly on a listed RPE column', () => {
    expect(getRpePct(1, 10)).toBe(100)
    expect(getRpePct(5, 8)).toBe(77.4)
    expect(getRpePct(10, 6)).toBe(38.4)
  })

  it('interpolates between the nearest RPE columns', () => {
    // 5 reps: RPE 8 = 77.4, RPE 8.5 = 82.4 → 8.25 sits halfway
    expect(getRpePct(5, 8.25)).toBeCloseTo(79.9, 5)
  })

  it('clamps RPE outside the table to its end columns', () => {
    expect(getRpePct(3, 1)).toBe(71.4)
    expect(getRpePct(3, 99)).toBe(95.5)
  })

  it('clamps reps to the 1-10 rows the table actually has', () => {
    expect(getRpePct(0, 8)).toBe(getRpePct(1, 8))
    expect(getRpePct(-4, 8)).toBe(getRpePct(1, 8))
    expect(getRpePct(25, 8)).toBe(getRpePct(10, 8))
  })

  // The white-screen bug: reps indexes a row, so a fractional value landed
  // between rows, RPE_TABLE[idx] came back undefined, and reading [rpeIdx] off
  // it threw — taking down every page that renders a working weight.
  describe('reps that cannot index a row', () => {
    it('rounds a fractional reps to the nearest row instead of throwing', () => {
      expect(() => getRpePct(2.5, 8)).not.toThrow()
      expect(getRpePct(2.4, 8)).toBe(getRpePct(2, 8))
      expect(getRpePct(2.6, 8)).toBe(getRpePct(3, 8))
    })

    it('falls back to 1 rep for NaN, and clamps the infinities', () => {
      expect(getRpePct(NaN, 8)).toBe(getRpePct(1, 8))
      expect(getRpePct(Infinity, 8)).toBe(getRpePct(10, 8))
      expect(getRpePct(-Infinity, 8)).toBe(getRpePct(1, 8))
    })

    it('survives a fractional reps all the way through calcWeight', () => {
      expect(() => calcWeight(200, 2.5, 8)).not.toThrow()
      expect(calcWeight(200, 2.5, 8)).toBe(calcWeight(200, 3, 8))
    })

    it('survives a fractional reps through structuredWeight', () => {
      const oneRMs = { squat: 200, bench: 140, deadlift: 240 }
      const ex = { exerciseId: 'squat', name: 'Squat', type: 'main' as const, sets: 3, reps: 1.5, rpe: 8 }
      expect(() => structuredWeight(ex, oneRMs)).not.toThrow()
      expect(structuredWeight(ex, oneRMs)).toBe(calcWeight(200, 2, 8))
    })
  })
})

describe('calcWeight', () => {
  it('rounds to the nearest 2.5 kg', () => {
    expect(calcWeight(200, 5, 8) % 2.5).toBe(0)
    expect(calcWeight(100, 1, 10)).toBe(100)
  })

  it('returns 0 without a 1RM rather than NaN', () => {
    expect(calcWeight(0, 5, 8)).toBe(0)
    expect(calcWeight(-10, 5, 8)).toBe(0)
  })
})

describe('structuredWeight', () => {
  const oneRMs = { squat: 200, bench: 140, deadlift: 240 }
  const base = { name: 'X', type: 'main' as const, sets: 3, reps: 5 }

  it('prefers pct over rpe when both are present', () => {
    const ex = { ...base, exerciseId: 'squat', pct: 0.8, rpe: 6 }
    expect(structuredWeight(ex, oneRMs)).toBe(160)
  })

  it('returns null for a lift with no 1RM of its own', () => {
    expect(structuredWeight({ ...base, exerciseId: 'curl', rpe: 8 }, oneRMs)).toBeNull()
    expect(structuredWeight({ ...base, exerciseId: 'squat', rpe: 8 }, null)).toBeNull()
  })

  it('returns null when there is nothing to calculate from', () => {
    expect(structuredWeight({ ...base, exerciseId: 'squat' }, oneRMs)).toBeNull()
    expect(structuredWeight({ ...base, exerciseId: 'squat', reps: 'AMRAP', rpe: 8 }, oneRMs)).toBeNull()
  })
})
