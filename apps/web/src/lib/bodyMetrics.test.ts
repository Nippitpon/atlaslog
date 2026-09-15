import { describe, it, expect } from 'vitest'
import type { BodyMetricEntry } from '@atlaslog/shared'
import {
  buildBodySeries, sortedByDate, latestBodyMetric, measureDelta, measureDef,
  BODY_MEASURES, normalizePct, buildNormalizedSeries, totalPctChange,
} from './bodyMetrics.js'
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

describe('normalizePct', () => {
  it('reads as percent change from the first value', () => {
    const pts = normalizePct([{ t: 1, value: 74 }, { t: 2, value: 76 }])
    expect(pts[1]!.value).toBeCloseTo(2.7027, 3)
  })

  it('always starts at exactly zero — the chart draws its baseline there', () => {
    expect(normalizePct([{ t: 1, value: 18.4 }, { t: 2, value: 17.9 }])[0]!.value).toBe(0)
  })

  it('keeps the timestamps untouched', () => {
    expect(normalizePct([{ t: 5, value: 70 }, { t: 9, value: 71 }]).map(p => p.t)).toEqual([5, 9])
  })

  it('drops a series with a non-positive baseline instead of returning Infinity', () => {
    expect(normalizePct([{ t: 1, value: 0 }, { t: 2, value: 20 }])).toEqual([])
    expect(normalizePct([{ t: 1, value: -5 }, { t: 2, value: 20 }])).toEqual([])
    expect(normalizePct([])).toEqual([])
  })

  // A NaN anywhere in the series poisons Math.min/Math.max in makeScale and
  // blanks the whole chart, so buildBodySeries screens values now too.
  it('never lets a NaN through', () => {
    expect(normalizePct([{ t: 1, value: NaN }, { t: 2, value: 20 }])).toEqual([])
    expect(buildBodySeries([entry('x', '2026-09-01T12:00:00.000Z', NaN)], 'weight')).toEqual([])
  })

  it('does not mutate the input', () => {
    const pts = [{ t: 1, value: 74 }, { t: 2, value: 76 }]
    normalizePct(pts)
    expect(pts.map(p => p.value)).toEqual([74, 76])
  })
})

describe('buildNormalizedSeries', () => {
  it('returns one series per measure, in BODY_MEASURES order', () => {
    expect(buildNormalizedSeries(entries).map(s => s.key)).toEqual(['weight', 'muscle', 'fat'])
  })

  it('carries the measure colours, so no new palette entry sneaks in', () => {
    expect(buildNormalizedSeries(entries).map(s => s.color)).toEqual(BODY_MEASURES.map(m => m.color))
  })

  // 'b' leaves muscle and fat blank; those series are shorter, never zero-filled.
  it('skips the readings that omit a measure', () => {
    const byKey = Object.fromEntries(buildNormalizedSeries(entries).map(s => [s.key, s.points]))
    expect(byKey.weight).toHaveLength(3)
    expect(byKey.muscle).toHaveLength(2)
  })

  it('gives a never-logged measure an empty series rather than dropping it', () => {
    const weightOnly = [entry('x', '2026-09-01T12:00:00.000Z', 80), entry('y', '2026-09-08T12:00:00.000Z', 79)]
    const muscle = buildNormalizedSeries(weightOnly).find(s => s.key === 'muscle')!
    expect(muscle.points).toEqual([])
  })

  // Baseline is per measure, not the first row in the table: someone can start
  // logging muscle months after bodyweight.
  it('baselines each measure on its own first reading', () => {
    const late = [
      entry('p', '2026-09-01T12:00:00.000Z', 80),
      entry('q', '2026-09-08T12:00:00.000Z', 79, 30),
      entry('r', '2026-09-15T12:00:00.000Z', 78, 31.5),
    ]
    const muscle = buildNormalizedSeries(late).find(s => s.key === 'muscle')!
    expect(muscle.points[0]!.value).toBe(0)
    expect(muscle.points[1]!.value).toBeCloseTo(5, 6)
  })

  it('draws a flat zero line when nothing changed, not NaN', () => {
    const same = [
      entry('p', '2026-09-01T12:00:00.000Z', 80, 33, 18),
      entry('q', '2026-09-08T12:00:00.000Z', 80, 33, 18),
    ]
    for (const s of buildNormalizedSeries(same)) {
      expect(s.points.map(pt => pt.value)).toEqual([0, 0])
    }
  })
})

describe('totalPctChange', () => {
  // measureDelta is the last step; this is the whole journey.
  it('spans the first reading to the last, not the last two', () => {
    const three = [
      entry('p', '2026-09-01T12:00:00.000Z', 80),
      entry('q', '2026-09-08T12:00:00.000Z', 78),
      entry('r', '2026-09-15T12:00:00.000Z', 76),
    ]
    expect(totalPctChange(three, 'weight')).toBeCloseTo(-5, 6)
    expect(measureDelta(three, 'weight')).toBeCloseTo(-2, 6)
  })

  it('is undefined with fewer than two readings of that measure', () => {
    expect(totalPctChange([entry('p', '2026-09-01T12:00:00.000Z', 80)], 'weight')).toBeUndefined()
    expect(totalPctChange(entries, 'muscle')).toBeDefined()
    expect(totalPctChange([], 'weight')).toBeUndefined()
  })

  // Backdating below every existing row redefines the baseline, so the whole
  // line moves. That is the definition working, not a bug.
  it('re-baselines when an older reading is added', () => {
    const base = [
      entry('q', '2026-09-08T12:00:00.000Z', 80),
      entry('r', '2026-09-15T12:00:00.000Z', 76),
    ]
    expect(totalPctChange(base, 'weight')).toBeCloseTo(-5, 6)
    expect(totalPctChange([...base, entry('p', '2026-08-01T12:00:00.000Z', 100)], 'weight')).toBeCloseTo(-24, 6)
  })
})

describe('makeScale on normalised %Δ data', () => {
  const box: Box = { w: 320, h: 168, padL: 34, padR: 6, padT: 10, padB: 20 }

  // FINE_STEPS, not a dedicated percent table: [1, 2.5, 5, ...] would push
  // `floor` to 1, padding every axis by a whole percentage point and bringing
  // back the flat-line bug those steps were introduced to fix.
  it('fits a realistic recomposition spread without flattening it', () => {
    const pts = [{ t: 1, value: 0 }, { t: 2, value: -0.8 }, { t: 3, value: 3.1 }, { t: 4, value: -5.2 }]
    const s = makeScale(pts, box, FINE_STEPS)!
    expect((3.1 - -5.2) / (s.vMax - s.vMin)).toBeGreaterThan(0.4)
  })

  // Why MetricChart can draw its baseline at y(0) and derive `signed` from the
  // domain: a normalised series always contains 0, and pad is always positive.
  it('keeps zero strictly inside the domain', () => {
    for (const far of [8, -18, 0, -0.4, 40]) {
      const s = makeScale([{ t: 1, value: 0 }, { t: 2, value: far }], box, FINE_STEPS)!
      expect(s.vMin).toBeLessThan(0)
      expect(s.vMax).toBeGreaterThan(0)
    }
  })

  it('survives a completely flat series', () => {
    const s = makeScale([{ t: 1, value: 0 }, { t: 2, value: 0 }], box, FINE_STEPS)!
    expect(s.vMax).toBeGreaterThan(s.vMin)
    expect(s.ticks).toHaveLength(3)
    expect(Number.isFinite(s.y(0))).toBe(true)
  })

  // The dashed baseline must never land on a gridline label and read as a
  // fourth gridline with a number attached.
  it('never draws the baseline on top of a gridline label', () => {
    for (const far of [8, -18, -0.4, 40, -5.2]) {
      const s = makeScale([{ t: 1, value: 0 }, { t: 2, value: far }], box, FINE_STEPS)!
      for (const tick of s.ticks) {
        expect(tick === 0 || Math.abs(s.y(0) - s.y(tick)) > 10).toBe(true)
      }
    }
  })

  // niceStep falls through to its last entry, so a long cut still gets an axis
  // wide enough to hold it.
  it('reaches far enough for a three-month cut', () => {
    expect(makeScale([{ t: 1, value: 0 }, { t: 2, value: -22 }], box, FINE_STEPS)!.vMin).toBeLessThanOrEqual(-22)
  })
})
