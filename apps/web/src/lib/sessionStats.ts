import type { OneRMLift, Session, WorkoutSet } from '@atlaslog/shared'
import { setE1RM } from './oneRM.js'
import { SBD_IDS } from './rpeTable.js'
import { ymdOfISO } from './utils.js'

export interface ExerciseStats {
  exerciseId: string
  name: string
  label?: string
  // Completed sets only — an unchecked set was prescribed, not performed.
  sets: WorkoutSet[]
  topSet: WorkoutSet | null
  volumeKg: number
  bestE1RM: number | null
}

// Heaviest set wins; equal weight is broken by reps, matching the TOP marker
// SessionCard already draws.
function pickTopSet(sets: WorkoutSet[]): WorkoutSet | null {
  return sets.reduce<WorkoutSet | null>((best, s) => {
    if (!best) return s
    if (s.w > best.w || (s.w === best.w && s.r > best.r)) return s
    return best
  }, null)
}

// One row per exercise in the session, in the order it was performed. Rows of the
// same exerciseId are merged (a Top set + Back-off of one lift is one row) so the
// comparison lines up against the same key in an earlier session.
export function sessionExerciseStats(session: Session): ExerciseStats[] {
  const order: string[] = []
  const byId = new Map<string, ExerciseStats>()

  for (const ex of session.exercises ?? []) {
    const done = ex.sets.filter(s => s.done)
    if (done.length === 0) continue
    let row = byId.get(ex.exerciseId)
    if (!row) {
      row = {
        exerciseId: ex.exerciseId,
        name: ex.name ?? ex.exerciseId,
        label: ex.label,
        sets: [],
        topSet: null,
        volumeKg: 0,
        bestE1RM: null,
      }
      byId.set(ex.exerciseId, row)
      order.push(ex.exerciseId)
    }
    for (const s of done) {
      row.sets.push(s)
      row.volumeKg += s.w * s.r
      // e1RM is only meaningful for the main lifts the RPE table covers.
      if (ex.isMain && SBD_IDS[ex.exerciseId]) {
        const v = setE1RM(s)
        if (v != null && (row.bestE1RM == null || v > row.bestE1RM)) row.bestE1RM = v
      }
    }
  }

  for (const row of byId.values()) row.topSet = pickTopSet(row.sets)
  return order.map(id => byId.get(id)!)
}

export interface ExerciseDelta {
  current: ExerciseStats
  // Same exercise in the most recent EARLIER session that trained it.
  previous: ExerciseStats | null
  previousSession: Session | null
  topWeightDelta: number | null
  volumeDelta: number | null
  e1rmDelta: number | null
}

// "This time vs last time, same exercise." Compared per exercise rather than per
// session because two sessions rarely hold the same lifts — a session-level volume
// delta against whatever happened to come before it answers nothing.
export function compareSession(session: Session, history: Session[]): ExerciseDelta[] {
  // Anything strictly earlier, newest first. Sorted here rather than trusting
  // array order: a backdated session can sit anywhere in `history`.
  const earlier = history
    .filter(s => s.id !== session.id && s.date < session.date)
    .sort((a, b) => b.date.localeCompare(a.date))

  return sessionExerciseStats(session).map(current => {
    for (const past of earlier) {
      const previous = sessionExerciseStats(past).find(r => r.exerciseId === current.exerciseId)
      if (!previous) continue
      const curTop = current.topSet
      const prevTop = previous.topSet
      return {
        current,
        previous,
        previousSession: past,
        topWeightDelta: curTop && prevTop ? curTop.w - prevTop.w : null,
        volumeDelta: current.volumeKg - previous.volumeKg,
        e1rmDelta: current.bestE1RM != null && previous.bestE1RM != null
          ? current.bestE1RM - previous.bestE1RM
          : null,
      }
    }
    return {
      current, previous: null, previousSession: null,
      topWeightDelta: null, volumeDelta: null, e1rmDelta: null,
    }
  })
}

// Display names for the three lifts — the raw keys are lowercase and were
// leaking into the day sheet as "squat".
export const LIFT_LABEL: Record<OneRMLift, string> = {
  squat: 'Squat', bench: 'Bench', deadlift: 'Deadlift',
}

export interface LiftPR {
  lift: OneRMLift
  e1rm: number
  sessionId: string
}

// Days on which a session beat every earlier estimated 1RM for one of S/B/D,
// keyed by local calendar day so the calendar can mark the cell.
//
// The FIRST value recorded for a lift is the baseline, not a PR: marking every
// new user's first three sessions as personal records would make the badge mean
// nothing. Walked oldest → newest off a date sort, since `history` is only
// newest-first by insertion and a backdated session breaks that.
export function prDaysByLift(history: Session[]): Map<string, LiftPR[]> {
  const chronological = [...history].sort((a, b) => a.date.localeCompare(b.date))
  const best = new Map<OneRMLift, number>()
  const out = new Map<string, LiftPR[]>()

  for (const session of chronological) {
    for (const row of sessionExerciseStats(session)) {
      const lift = SBD_IDS[row.exerciseId]
      if (!lift || row.bestE1RM == null) continue
      const prior = best.get(lift)
      if (prior == null) {
        best.set(lift, row.bestE1RM)
        continue
      }
      if (row.bestE1RM <= prior) continue
      best.set(lift, row.bestE1RM)
      const ymd = ymdOfISO(session.date)
      const pr: LiftPR = { lift, e1rm: row.bestE1RM, sessionId: session.id }
      const bucket = out.get(ymd)
      if (bucket) bucket.push(pr)
      else out.set(ymd, [pr])
    }
  }
  return out
}
