import type { Session, WorkoutSet, ProgramOneRMs, OneRMEntry, OneRMLift } from '@atlaslog/shared'
import { getRpePct, SBD_IDS } from './rpeTable.js'

export const LIFT_ORDER: OneRMLift[] = ['squat', 'bench', 'deadlift']

// The RPE table caps at 10 reps (rpeTable.ts:21) and Brzycki's denominator hits
// zero at 37 reps, so both paths clamp to the same ceiling. Past 10 reps the
// estimate is noise for a powerlifting 1RM — under-reporting beats a spike.
const MAX_REPS = 10

// Keep the estimated series drawable: 150 sessions across a 284px plot is 2px a
// point. Above this we keep the best point per ISO week instead.
const MAX_ESTIMATED_POINTS = 120

// Invert the app's own RPE table: the weight was pct% of 1RM, so 1RM = w / pct.
export function e1rmFromRpe(w: number, reps: number, rpe: number): number {
  const pct = getRpePct(Math.min(reps, MAX_REPS), rpe)
  return pct > 0 ? (w * 100) / pct : 0
}

// Brzycki, not Epley. At 1 rep Brzycki returns exactly w; Epley returns w × 1.033,
// claiming 3.3% more than the single you just completed — a constant upward bias
// on every top single, fatal for a chart that exists to show trend.
export function e1rmFromReps(w: number, reps: number): number {
  const r = Math.min(reps, MAX_REPS)
  return (w * 36) / (37 - r)
}

export function setE1RM(set: Pick<WorkoutSet, 'w' | 'r' | 'rpe'>): number | null {
  if (!(set.w > 0) || !(set.r > 0)) return null
  if (set.rpe != null && set.rpe > 0) {
    const v = e1rmFromRpe(set.w, set.r, set.rpe)
    return v > 0 ? v : null
  }
  return e1rmFromReps(set.w, set.r)
}

export interface OneRMPoint {
  date: string                   // ISO
  t: number                      // epoch ms — the chart's x, parsed once here
  value: number                  // kg, unrounded; round at display time
  kind: 'logged' | 'estimated'
  entryId?: string               // logged → deletable
  sessionId?: string             // estimated → traceable back to the session
  reps?: number
  rpe?: number
  basis?: 'rpe' | 'reps'         // which formula produced it
}

export interface LiftSeries {
  lift: OneRMLift
  manual: OneRMPoint[]
  estimated: OneRMPoint[]
}

// Keep the best point per bucket, preserving chronological order.
function bestPer(points: OneRMPoint[], keyOf: (d: Date) => string): OneRMPoint[] {
  const byKey = new Map<string, OneRMPoint>()
  for (const p of points) {
    const key = keyOf(new Date(p.t))
    const cur = byKey.get(key)
    if (!cur || p.value > cur.value) byKey.set(key, p)
  }
  return [...byKey.values()].sort((a, b) => a.t - b.t)
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function weekKey(d: Date): string {
  const w = new Date(d)
  w.setHours(0, 0, 0, 0)
  w.setDate(w.getDate() - w.getDay())
  return dayKey(w)
}

// Two sessions on the same day would plot at the same x and draw as a vertical
// spike, so the estimated trend keeps one point per calendar day. Long histories
// thin further to one per week — 150 points across a 284px plot is 2px apiece.
function thinEstimated(points: OneRMPoint[]): OneRMPoint[] {
  const daily = bestPer(points, dayKey)
  return daily.length <= MAX_ESTIMATED_POINTS ? daily : bestPer(daily, weekKey)
}

// One max-e1RM point per (session, lift). Main sets only, completed sets only,
// SBD only. Both series come back oldest → newest so the chart reads left to right.
export function buildLiftSeries(history: Session[], entries: OneRMEntry[]): LiftSeries[] {
  const manual = new Map<OneRMLift, OneRMPoint[]>()
  const estimated = new Map<OneRMLift, OneRMPoint[]>()
  for (const lift of LIFT_ORDER) {
    manual.set(lift, [])
    estimated.set(lift, [])
  }

  for (const entry of entries) {
    const bucket = manual.get(entry.lift)
    if (!bucket) continue
    bucket.push({
      date: entry.date,
      t: new Date(entry.date).getTime(),
      value: entry.weightKg,
      kind: 'logged',
      entryId: entry.id,
    })
  }

  for (const session of history) {
    const best = new Map<OneRMLift, OneRMPoint>()
    for (const ex of session.exercises ?? []) {
      if (!ex.isMain) continue
      const lift = SBD_IDS[ex.exerciseId]
      if (!lift) continue
      for (const st of ex.sets) {
        if (!st.done) continue
        const value = setE1RM(st)
        if (value == null) continue
        const cur = best.get(lift)
        if (cur && cur.value >= value) continue
        best.set(lift, {
          date: session.date,
          t: new Date(session.date).getTime(),
          value,
          kind: 'estimated',
          sessionId: session.id,
          reps: st.r,
          rpe: st.rpe,
          basis: st.rpe != null && st.rpe > 0 ? 'rpe' : 'reps',
        })
      }
    }
    for (const [lift, point] of best) estimated.get(lift)?.push(point)
  }

  return LIFT_ORDER.map(lift => ({
    lift,
    manual: (manual.get(lift) ?? []).sort((a, b) => a.t - b.t),
    estimated: thinEstimated((estimated.get(lift) ?? []).sort((a, b) => a.t - b.t)),
  }))
}

export function latestEntryFor(entries: OneRMEntry[], lift: OneRMLift): OneRMEntry | undefined {
  let latest: OneRMEntry | undefined
  for (const e of entries) {
    if (e.lift !== lift) continue
    if (!latest || e.date.localeCompare(latest.date) > 0) latest = e
  }
  return latest
}

// Newest logged value per lift, falling back per-lift when history has none for it.
export function latestOneRMs(entries: OneRMEntry[], fallback: ProgramOneRMs): ProgramOneRMs {
  const out = { ...fallback }
  for (const lift of LIFT_ORDER) {
    const latest = latestEntryFor(entries, lift)
    if (latest) out[lift] = latest.weightKg
  }
  return out
}
