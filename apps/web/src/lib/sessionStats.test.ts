import { describe, it, expect } from 'vitest'
import type { Session, WorkoutExercise } from '@atlaslog/shared'
import { compareSession, prDaysByLift, sessionExerciseStats } from './sessionStats.js'

// Local noon, so the ISO stamp lands on the intended calendar day in any timezone.
const isoAt = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString()

const ex = (
  exerciseId: string,
  sets: [number, number, boolean?, number?][],
  isMain = true,
  name?: string,
): WorkoutExercise => ({
  exerciseId,
  name: name ?? exerciseId,
  isMain,
  sets: sets.map(([w, r, done = true, rpe], i) => ({ id: `s${i}`, w, r, done, rpe })),
})

const session = (id: string, date: string, exercises: WorkoutExercise[]): Session => ({
  id, programId: 'p', name: 'Day', date, duration: 60,
  volume: exercises.flatMap(e => e.sets).filter(s => s.done).reduce((a, s) => a + s.w * s.r, 0),
  setCount: exercises.flatMap(e => e.sets).filter(s => s.done).length,
  exercises,
})

describe('sessionExerciseStats', () => {
  it('counts only completed sets', () => {
    const rows = sessionExerciseStats(session('a', isoAt(2026, 9, 7), [
      ex('squat', [[100, 5], [110, 5], [120, 5, false]]),
    ]))
    expect(rows[0]!.sets).toHaveLength(2)
    expect(rows[0]!.volumeKg).toBe(100 * 5 + 110 * 5)
  })

  // A Top set and a Back-off of the same lift are separate WorkoutExercise rows,
  // but one exercise for the purpose of "vs last time".
  it('merges rows that share an exerciseId', () => {
    const rows = sessionExerciseStats(session('a', isoAt(2026, 9, 7), [
      ex('squat', [[140, 1]]),
      ex('squat', [[120, 5], [120, 5]]),
    ]))
    expect(rows).toHaveLength(1)
    expect(rows[0]!.sets).toHaveLength(3)
    expect(rows[0]!.topSet?.w).toBe(140)
  })

  it('breaks a top-set tie on reps, like the TOP marker', () => {
    const rows = sessionExerciseStats(session('a', isoAt(2026, 9, 7), [
      ex('squat', [[120, 3], [120, 6]]),
    ]))
    expect(rows[0]!.topSet?.r).toBe(6)
  })

  it('drops an exercise with nothing completed', () => {
    const rows = sessionExerciseStats(session('a', isoAt(2026, 9, 7), [
      ex('squat', [[100, 5]]),
      ex('bench', [[80, 5, false]]),
    ]))
    expect(rows.map(r => r.exerciseId)).toEqual(['squat'])
  })

  // Brzycki returns exactly w at 1 rep, so a top single reads as its own e1RM.
  it('estimates e1RM for main SBD work only', () => {
    const rows = sessionExerciseStats(session('a', isoAt(2026, 9, 7), [
      ex('squat', [[150, 1]]),
      ex('leg-press', [[300, 10]]),
      ex('bench', [[100, 1]], false),
    ]))
    const byId = new Map(rows.map(r => [r.exerciseId, r]))
    expect(byId.get('squat')!.bestE1RM).toBeCloseTo(150, 5)
    // Not an SBD lift → no 1RM estimate, even though it is flagged main.
    expect(byId.get('leg-press')!.bestE1RM).toBeNull()
    // SBD but logged as an accessory → the RPE table does not apply.
    expect(byId.get('bench')!.bestE1RM).toBeNull()
  })

  it('handles a session saved before the exercises field existed', () => {
    const s = { ...session('a', isoAt(2026, 9, 7), []), exercises: undefined }
    expect(sessionExerciseStats(s)).toEqual([])
  })
})

describe('compareSession', () => {
  const older = session('s1', isoAt(2026, 9, 1), [ex('squat', [[100, 5], [100, 5]])])
  const noSquat = session('s2', isoAt(2026, 9, 4), [ex('bench', [[80, 5]])])
  const current = session('s3', isoAt(2026, 9, 7), [ex('squat', [[110, 5], [110, 5]])])
  const history = [current, noSquat, older]

  it('compares against the most recent earlier session holding that exercise', () => {
    const [squat] = compareSession(current, history)
    expect(squat!.previousSession?.id).toBe('s1')
    expect(squat!.topWeightDelta).toBe(10)
    expect(squat!.volumeDelta).toBe(1100 - 1000)
  })

  it('reports nulls for an exercise never trained before', () => {
    const [bench] = compareSession(noSquat, history)
    expect(bench!.previous).toBeNull()
    expect(bench!.topWeightDelta).toBeNull()
    expect(bench!.volumeDelta).toBeNull()
  })

  // The comparison must look backwards only, or the newest session would compare
  // against nothing while older ones compared against their own future.
  it('ignores sessions that come after the one being viewed', () => {
    const [squat] = compareSession(older, history)
    expect(squat!.previousSession).toBeNull()
  })

  it('never compares a session against itself', () => {
    const dup = { ...current, id: 'other' }
    const [squat] = compareSession(current, [...history, dup])
    expect(squat!.previousSession?.id).not.toBe(current.id)
  })

  it('reports an e1RM delta for main SBD work', () => {
    const [squat] = compareSession(
      session('c', isoAt(2026, 9, 7), [ex('squat', [[160, 1]])]),
      [session('p', isoAt(2026, 9, 1), [ex('squat', [[150, 1]])])],
    )
    expect(squat!.e1rmDelta).toBeCloseTo(10, 5)
  })
})

describe('prDaysByLift', () => {
  it('treats the first recorded value as a baseline, not a PR', () => {
    const prs = prDaysByLift([session('a', isoAt(2026, 9, 1), [ex('squat', [[150, 1]])])])
    expect(prs.size).toBe(0)
  })

  it('marks the day a lift beats every earlier estimate', () => {
    const prs = prDaysByLift([
      session('a', isoAt(2026, 9, 1), [ex('squat', [[150, 1]])]),
      session('b', isoAt(2026, 9, 8), [ex('squat', [[160, 1]])]),
    ])
    expect([...prs.keys()]).toEqual(['2026-09-08'])
    expect(prs.get('2026-09-08')![0]!.lift).toBe('squat')
    expect(prs.get('2026-09-08')![0]!.e1rm).toBeCloseTo(160, 5)
    expect(prs.get('2026-09-08')![0]!.sessionId).toBe('b')
  })

  it('does not mark a day that only matched or fell short', () => {
    const prs = prDaysByLift([
      session('a', isoAt(2026, 9, 1), [ex('squat', [[150, 1]])]),
      session('b', isoAt(2026, 9, 8), [ex('squat', [[150, 1]])]),
      session('c', isoAt(2026, 9, 15), [ex('squat', [[140, 1]])]),
    ])
    expect(prs.size).toBe(0)
  })

  // `history` is newest-first by insertion, and a backdated session breaks even
  // that, so the walk has to sort by date itself.
  it('walks chronologically whatever order history arrives in', () => {
    const a = session('a', isoAt(2026, 9, 1), [ex('squat', [[150, 1]])])
    const b = session('b', isoAt(2026, 9, 8), [ex('squat', [[160, 1]])])
    expect([...prDaysByLift([b, a]).keys()]).toEqual(['2026-09-08'])
    expect([...prDaysByLift([a, b]).keys()]).toEqual(['2026-09-08'])
  })

  it('tracks each lift independently', () => {
    const prs = prDaysByLift([
      session('a', isoAt(2026, 9, 1), [ex('squat', [[150, 1]]), ex('bench', [[100, 1]])]),
      session('b', isoAt(2026, 9, 8), [ex('squat', [[140, 1]]), ex('bench', [[105, 1]])]),
    ])
    expect(prs.get('2026-09-08')!.map(p => p.lift)).toEqual(['bench'])
  })

  it('reports two lifts on one day', () => {
    const prs = prDaysByLift([
      session('a', isoAt(2026, 9, 1), [ex('squat', [[150, 1]]), ex('bench', [[100, 1]])]),
      session('b', isoAt(2026, 9, 8), [ex('squat', [[160, 1]]), ex('bench', [[105, 1]])]),
    ])
    expect(prs.get('2026-09-08')).toHaveLength(2)
  })
})
