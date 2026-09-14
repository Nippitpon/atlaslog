import { describe, it, expect } from 'vitest'
import type { BodyMetricEntry } from '@atlaslog/shared'
import { buildBodySeries, sortedByDate, latestBodyMetric, measureDelta, measureDef } from './bodyMetrics.js'
import { makeScale, FINE_STEPS, type Box } from '../components/charts/oneRMScale.js'

const entry = (
  id: string,
  date: string,
  weightKg: number,
  skeletalMuscleKg?: number,
  bodyFatPct?: number,
): BodyMetricEntry => ({ id, date, weightKg, skeletalMuscleKg, bodyFatPct })

// Deliberately out of order — the store never sorts bodyMetrics, so nothing may
// assume the array arrives chronologically.
const entries: BodyMetricEntry[] = [
  entry('c', '2026-09-10T12:00:00.000Z', 74.8, 33.4, 17.9),
  entry('a', '2026-09-01T12:00:00.000Z', 76.0, 33.0, 19.0),
  entry('b', '2026-09-05T12:00:00.000Z', 75.2, undefined, undefined),
]

describe('sortedByDate', () => {
  it('returns newest first', () => {
    expect(sortedByDate(entries).map(e => e.id)).toEqual(['c', 'b', 'a'])
  })

  it('does not mutate the input', () => {
    const before = entries.map(e => e.id)
    sortedByDate(entries)
    expect(entries.map(e => e.id)).toEqual(before)
  })
})

describe('latestBodyMetric', () => {
  it('picks by date, not by position in the array', () => {
    expect(latestBodyMetric(entries)?.id).toBe('c')
  })

  // Backdating became possible with the date picker on the log sheet; an older
  // reading must never take over, because the latest one drives session calories
  // (latestWeightKg) and BMR/TDEE.
  it('is not taken over by a backdated entry logged later', () => {
    const withBackdated = [...entries, entry('old', '2026-08-01T12:00:00.000Z', 99, 40, 25)]
    expect(latestBodyMetric(withBackdated)?.id).toBe('c')
  })

  it('is undefined with no entries', () => {
    expect(latestBodyMetric([])).toBeUndefined()
  })
})

describe('buildBodySeries', () => {
  it('returns points oldest to newest whatever order they arrive in', () => {
    const pts = buildBodySeries(entries, 'weight')
    expect(pts.map(p => p.value)).toEqual([76.0, 75.2, 74.8])
    expect(pts[0]!.t).toBeLessThan(pts[1]!.t)
  })

  // Muscle and fat are optional. Zero-filling a missing reading would draw a
  // cliff to the floor and wreck the y-axis.
  it('skips entries that never recorded the measure', () => {
    expect(buildBodySeries(entries, 'muscle').map(p => p.value)).toEqual([33.0, 33.4])
    expect(buildBodySeries(entries, 'fat').map(p => p.value)).toEqual([19.0, 17.9])
    expect(buildBodySeries(entries, 'fat')).toHaveLength(2)
  })

  it('drops entries with an unparseable date', () => {
    expect(buildBodySeries([entry('x', 'not-a-date', 70)], 'weight')).toEqual([])
  })

  it('is empty with no entries', () => {
    expect(buildBodySeries([], 'weight')).toEqual([])
  })
})

describe('measureDelta', () => {
  it('is the change between the two most recent readings', () => {
    expect(measureDelta(entries, 'weight')).toBeCloseTo(-0.4, 5)
  })

  // 'b' has no muscle reading, so the muscle delta spans 'a' → 'c', not 'b' → 'c'.
  it('spans the last two readings OF THAT MEASURE, skipping blanks', () => {
    expect(measureDelta(entries, 'muscle')).toBeCloseTo(0.4, 5)
    expect(measureDelta(entries, 'fat')).toBeCloseTo(-1.1, 5)
  })

  it('is undefined when there is nothing to compare against', () => {
    expect(measureDelta([entries[0]!], 'weight')).toBeUndefined()
    expect(measureDelta(entries.filter(e => e.id === 'b'), 'muscle')).toBeUndefined()
  })
})

describe('measureDef', () => {
  it('carries unit and colour per measure', () => {
    expect(measureDef('weight').unit).toBe('kg')
    expect(measureDef('fat').unit).toBe('%')
    expect(measureDef('muscle').color).not.toBe(measureDef('fat').color)
  })
})

describe('makeScale with FINE_STEPS', () => {
  const box: Box = { w: 320, h: 168, padL: 34, padR: 6, padT: 10, padB: 20 }

  // Body ranges are an order of magnitude tighter than a 1RM. On the default kg
  // steps a 74-76 kg series padded out to a 2.5-wide axis and the line went flat.
  it('gives a tight axis for a narrow weight range', () => {
    const pts = [{ t: 1, value: 74 }, { t: 2, value: 76 }]
    const s = makeScale(pts, box, FINE_STEPS)!
    expect(s.vMax - s.vMin).toBeLessThanOrEqual(5)
    expect(s.vMin).toBeLessThanOrEqual(74)
    expect(s.vMax).toBeGreaterThanOrEqual(76)
  })

  it('handles a sub-1 body fat range without collapsing', () => {
    const pts = [{ t: 1, value: 18.0 }, { t: 2, value: 18.4 }]
    const s = makeScale(pts, box, FINE_STEPS)!
    expect(s.vMax).toBeGreaterThan(s.vMin)
    expect(s.vMax - s.vMin).toBeLessThanOrEqual(2.5)
    expect(s.ticks).toHaveLength(3)
  })

  it('returns null with no points', () => {
    expect(makeScale([], box, FINE_STEPS)).toBeNull()
  })

  // The 1RM chart calls makeScale without a steps argument; the default path has
  // to stay byte-identical or /one-rm silently re-scales.
  it('leaves the default kg behaviour untouched', () => {
    const pts = [{ t: 1, value: 100 }, { t: 2, value: 140 }]
    const a = makeScale(pts, box)!
    const b = makeScale(pts, box, [2.5, 5, 10, 20, 25, 50, 100])!
    // x and y are closures, so compare the domain and what they actually map to
    expect([a.vMin, a.vMax, a.tMin, a.tMax, a.ticks]).toEqual([b.vMin, b.vMax, b.tMin, b.tMax, b.ticks])
    expect(pts.map(p => [a.x(p.t), a.y(p.value)])).toEqual(pts.map(p => [b.x(p.t), b.y(p.value)]))
  })
})
