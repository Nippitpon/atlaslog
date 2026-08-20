import type { OneRMLift } from '@atlaslog/shared'
import type { OneRMPoint } from '../../lib/oneRM.js'

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

export interface Scale {
  x: (t: number) => number
  y: (v: number) => number
  tMin: number; tMax: number
  vMin: number; vMax: number
  ticks: number[]
}

const NICE_STEPS = [2.5, 5, 10, 20, 25, 50, 100]

function niceStep(range: number): number {
  const target = range / 2
  return NICE_STEPS.find(s => s >= target) ?? NICE_STEPS[NICE_STEPS.length - 1]
}

// Linear time on x (points are irregularly spaced — index would lie about the
// gaps) and a kg domain snapped to round gridlines. Returns null with no points.
export function makeScale(points: OneRMPoint[], box: Box): Scale | null {
  if (points.length === 0) return null

  const plotW = box.w - box.padL - box.padR
  const plotH = box.h - box.padT - box.padB

  const times = points.map(p => p.t)
  const tMin = Math.min(...times)
  const tMax = Math.max(...times)

  const vals = points.map(p => p.value)
  const rawMin = Math.min(...vals)
  const rawMax = Math.max(...vals)
  const pad = Math.max(1, (rawMax - rawMin) * 0.05)
  const step = niceStep(Math.max(1, rawMax - rawMin + pad * 2))
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

export function polyPoints(pts: OneRMPoint[], s: Scale): string {
  return pts.map(p => `${s.x(p.t).toFixed(1)},${s.y(p.value).toFixed(1)}`).join(' ')
}
