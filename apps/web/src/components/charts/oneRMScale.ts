import type { OneRMLift } from '@atlaslog/shared'

export { LIFT_ORDER } from '../../lib/oneRM.js'

// Reuses three hexes already in PHASE_COLOR (DashboardPage) rather than growing
// the palette. Never var(--accent): lime is the app's "you / now / active" colour
// everywhere else, so handing it to one of three lifts would read as privileged.
export const LIFT_COLOR: Record<OneRMLift, string> = {
  squat: '#60a5fa',
  bench: '#f97316',
  deadlift: '#a78bfa',
}

export const LIFT_LABEL: Record<OneRMLift, string> = {
  squat: 'Squat', bench: 'Bench', deadlift: 'Deadlift',
}

export const LIFT_SHORT: Record<OneRMLift, string> = {
  squat: 'S', bench: 'B', deadlift: 'D',
}

export const LIFT_PILL: Record<OneRMLift, string> = {
  squat: 'SQUAT', bench: 'BENCH', deadlift: 'DEAD',
}

export interface Box {
  w: number; h: number
  padL: number; padR: number; padT: number; padB: number
}

// The only thing the scale maths below reads off a point. OneRMPoint satisfies
// it structurally, so the 1RM chart is unaffected — but a body-composition or
// any other dated series can now feed the same functions.
export interface ChartPoint { t: number; value: number }

export interface Scale {
  x: (t: number) => number
  y: (v: number) => number
  tMin: number; tMax: number
  vMin: number; vMax: number
  ticks: number[]
}

const NICE_STEPS = [2.5, 5, 10, 20, 25, 50, 100]

// Body weight moves 74 → 76 kg and body fat 18.0 → 18.4 % — ranges an order of
// magnitude tighter than a 1RM, where the coarsest sensible gridline is 2.5 kg.
export const FINE_STEPS = [0.5, 1, 2.5, 5, 10]

function niceStep(range: number, steps: number[]): number {
  const target = range / 2
  return steps.find(s => s >= target) ?? steps[steps.length - 1]!
}

// Linear time on x (points are irregularly spaced — index would lie about the
// gaps) and a value domain snapped to round gridlines. Returns null with no
// points. `steps` picks the gridline granularity; the default suits kg 1RMs.
export function makeScale(points: ChartPoint[], box: Box, steps: number[] = NICE_STEPS): Scale | null {
  if (points.length === 0) return null

  const plotW = box.w - box.padL - box.padR
  const plotH = box.h - box.padT - box.padB

  const times = points.map(p => p.t)
  const tMin = Math.min(...times)
  const tMax = Math.max(...times)

  const vals = points.map(p => p.value)
  const rawMin = Math.min(...vals)
  const rawMax = Math.max(...vals)
  // Floors keyed to the smallest gridline offered. min(1, …) keeps the default
  // kg behaviour byte-identical while letting a finer `steps` array actually bite:
  // with a hard floor of 1, an 18.0-18.4 % fat range still padded out to a 2.5-wide
  // axis and the line went flat.
  const floor = Math.min(1, steps[0]!)
  const pad = Math.max(floor, (rawMax - rawMin) * 0.05)
  const step = niceStep(Math.max(floor, rawMax - rawMin + pad * 2), steps)
  let vMin = Math.floor((rawMin - pad) / step) * step
  let vMax = Math.ceil((rawMax + pad) / step) * step
  if (vMax - vMin < step) { vMin -= step; vMax += step }

  const span = tMax - tMin

  return {
    x: t => span === 0 ? box.padL + plotW / 2 : box.padL + ((t - tMin) / span) * plotW,
    y: v => box.padT + plotH - ((v - vMin) / (vMax - vMin)) * plotH,
    tMin, tMax, vMin, vMax,
    ticks: [vMin, (vMin + vMax) / 2, vMax],
  }
}

export function polyPoints(pts: ChartPoint[], s: Scale): string {
  return pts.map(p => `${s.x(p.t).toFixed(1)},${s.y(p.value).toFixed(1)}`).join(' ')
}
