import type { BodyMetricEntry } from '@atlaslog/shared'
import type { ChartPoint } from '../components/charts/oneRMScale.js'

export type BodyMeasure = 'weight' | 'muscle' | 'fat'

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
    .filter((p): p is ChartPoint => p.value !== undefined && Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t)
}

// Change since the previous reading OF THIS MEASURE — not simply the previous
// row, which may have left this measure blank.
export function measureDelta(entries: BodyMetricEntry[], measure: BodyMeasure): number | undefined {
  const pts = buildBodySeries(entries, measure)
  if (pts.length < 2) return undefined
  return pts[pts.length - 1]!.value - pts[pts.length - 2]!.value
}
