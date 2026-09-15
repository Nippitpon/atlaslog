import type { BodyMetricEntry } from '@atlaslog/shared'
import type { ChartPoint, ChartSeries } from '../components/charts/oneRMScale.js'

export type BodyMeasure = 'weight' | 'muscle' | 'fat'

// 'all' draws the three measures together, normalised to percent change.
export type BodySelection = BodyMeasure | 'all'


export interface MeasureDef {
  key: BodyMeasure
  label: string
  pill: string
  unit: string
  color: string
  get: (e: BodyMetricEntry) => number | undefined
}

// Three hexes already in LIFT_COLOR / PHASE_COLOR rather than a new palette.
// Never var(--accent) — for the same reason oneRMScale gives: lime means
// "you / now / active" everywhere else, so a series wearing it reads as special.
export const BODY_MEASURES: MeasureDef[] = [
  { key: 'weight', label: 'Weight', pill: 'WEIGHT', unit: 'kg', color: '#60a5fa', get: e => e.weightKg },
  { key: 'muscle', label: 'Muscle', pill: 'MUSCLE', unit: 'kg', color: '#4ade80', get: e => e.skeletalMuscleKg },
  { key: 'fat',    label: 'Fat',    pill: 'FAT%',   unit: '%',  color: '#f97316', get: e => e.bodyFatPct },
]

export function measureDef(key: BodyMeasure): MeasureDef {
  return BODY_MEASURES.find(m => m.key === key) ?? BODY_MEASURES[0]!
}

// Newest first — the order every existing consumer sorts into for itself
// (ProfilePage, AthleteDetailPage, latestWeightKg). The stored array is never
// sorted by the store, so nothing may assume its order.
export function sortedByDate(entries: BodyMetricEntry[]): BodyMetricEntry[] {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date))
}

// By date, not by position: backdating a measurement must not make it "latest",
// because this value drives session calories (latestWeightKg) and BMR/TDEE.
export function latestBodyMetric(entries: BodyMetricEntry[]): BodyMetricEntry | undefined {
  return sortedByDate(entries)[0]
}

// Oldest → newest, which is the direction a chart reads. Entries that never
// recorded this measure are SKIPPED, not zero-filled: muscle and fat are
// optional, and a missing one plotted as 0 draws a cliff to the floor.
export function buildBodySeries(entries: BodyMetricEntry[], measure: BodyMeasure): ChartPoint[] {
  const get = measureDef(measure).get
  return entries
    .map(e => ({ t: Date.parse(e.date), value: get(e) }))
    .filter((p): p is ChartPoint => Number.isFinite(p.value) && Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t)
}

// Change since the previous reading OF THIS MEASURE — not simply the previous
// row, which may have left this measure blank.
export function measureDelta(entries: BodyMetricEntry[], measure: BodyMeasure): number | undefined {
  const pts = buildBodySeries(entries, measure)
  if (pts.length < 2) return undefined
  return pts[pts.length - 1]!.value - pts[pts.length - 2]!.value
}

// Percent change from the series' own first reading, so kg and % can share one
// axis. The first point is exactly 0 (IEEE: v - v is exact), which is what lets
// the chart draw a baseline at y(0) without widening the domain by hand.
// Bails out on a non-positive baseline: optional() in LogBodyMetricSheet stores
// a blank as undefined rather than 0, but nothing guarantees that for rows that
// arrived from the cloud, and dividing by one would give Infinity.
export function normalizePct(points: ChartPoint[]): ChartPoint[] {
  const base = points[0]?.value
  // NaN <= 0 is false, so the finite check has to be explicit.
  if (base === undefined || !Number.isFinite(base) || base <= 0) return []
  return points.map(p => ({ t: p.t, value: ((p.value - base) / base) * 100 }))
}

// Each measure keeps ITS OWN baseline — not the first row in the table. Muscle
// and fat are optional and buildBodySeries skips the rows that omit them, so
// someone who bought a smart scale months into logging bodyweight gets a muscle
// line that starts at 0 % part-way along the x-axis. That is the honest reading.
export function buildNormalizedSeries(entries: BodyMetricEntry[]): ChartSeries[] {
  return BODY_MEASURES.map(m => ({
    key: m.key,
    color: m.color,
    points: normalizePct(buildBodySeries(entries, m.key)),
  }))
}

// First reading to last, matching what the ALL chart draws — unlike
// measureDelta, which is the step between the last two readings.
export function totalPctChange(entries: BodyMetricEntry[], measure: BodyMeasure): number | undefined {
  const pts = normalizePct(buildBodySeries(entries, measure))
  if (pts.length < 2) return undefined
  return pts[pts.length - 1]!.value
}
