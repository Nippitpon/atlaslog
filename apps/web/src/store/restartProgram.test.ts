import { describe, it, expect, beforeEach } from 'vitest'
import type { ProgramConfig, RunEntry, Session, Workout } from '@atlaslog/shared'
import { useProgramStore } from './useProgramStore.js'
import { useAppStore } from './useAppStore.js'
import { dayRef, pickActiveWeek, programProgress, weekStatus } from '../lib/programStatus.js'
import { ymdLocal } from '../lib/utils.js'
import {
  makeRunProgram, makeMultiWeekProgram,
  RUN_PROGRAM_ID, RUN_WEEK_ID, RUN_DAY_ID, MULTI_PROGRAM_ID,
} from '../test/fixtures.js'

const ps = () => useProgramStore.getState()
const as = () => useAppStore.getState()

const multi = makeMultiWeekProgram()
const W1_MON = 'w1-mon'
const W6_MON = 'w6-mon'

const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

const config = (startDate: string, squat = 100): ProgramConfig => ({
  startDate,
  endDate: '2099-01-01',
  oneRMs: { squat, bench: 80, deadlift: 120 },
})

let n = 0
const run = (ref?: string): RunEntry => ({
  id: `r${++n}`,
  date: new Date().toISOString(),
  distanceKm: 5,
  durationMin: 30,
  dayRef: ref,
})

const session = (programId: string, date: Date): Session => ({
  id: `h${++n}`,
  programId,
  name: 'Session',
  date: date.toISOString(),
  duration: 60,
  volume: 1000,
  setCount: 9,
})

beforeEach(() => {
  // Both stores are module singletons shared across every test file.
  useProgramStore.setState({
    progress: {}, configs: {}, customAccessories: {}, customPrograms: [], programMeta: {},
  })
  useAppStore.setState({ runs: [], history: [], workout: null })
  ps().addCustomProgram(multi)
  ps().setConfig(MULTI_PROGRAM_ID, config(ymdLocal(daysAgo(35))))
})

describe('restartProgram', () => {
  it('clears every day status in the program', () => {
    ps().setDayStatus(MULTI_PROGRAM_ID, 'week-1', W1_MON, 'done')
    ps().setDayStatus(MULTI_PROGRAM_ID, 'week-1', 'w1-thu', 'skipped')
    ps().setDayStatus(MULTI_PROGRAM_ID, 'week-6', W6_MON, 'in_progress')
    expect(programProgress(multi, ps().progress).doneDays).toBe(1)

    ps().restartProgram(MULTI_PROGRAM_ID, config('2026-09-14'))

    const { doneDays, skippedDays, settledDays, settledPct, trainedPct } = programProgress(multi, ps().progress)
    expect(doneDays).toBe(0)
    expect(skippedDays).toBe(0)
    expect(settledDays).toBe(0)
    expect(settledPct).toBe(0)
    expect(trainedPct).toBe(0)
    expect(weekStatus(MULTI_PROGRAM_ID, multi.weeks[0]!, ps().progress)).toBe('not_started')
    expect(weekStatus(MULTI_PROGRAM_ID, multi.weeks[5]!, ps().progress)).toBe('not_started')
  })

  it('writes the new config over the old one', () => {
    ps().restartProgram(MULTI_PROGRAM_ID, config('2026-09-14', 145))

    const saved = ps().getConfig(MULTI_PROGRAM_ID)
    expect(saved?.startDate).toBe('2026-09-14')
    expect(saved?.oneRMs.squat).toBe(145)
  })

  it('drops the day layouts so the program reads as imported again', () => {
    ps().setDayLayout(MULTI_PROGRAM_ID, 'week-1', W1_MON, [
      { exerciseId: 'squat', name: 'Squat', type: 'main', sets: 5, reps: 3 },
    ])
    expect(ps().getDayLayout(MULTI_PROGRAM_ID, 'week-1', W1_MON)).not.toBeNull()

    ps().restartProgram(MULTI_PROGRAM_ID, config('2026-09-14'))

    expect(ps().getDayLayout(MULTI_PROGRAM_ID, 'week-1', W1_MON)).toBeNull()
  })

  it('keeps the favourite star, clears the pause and re-stamps activation', () => {
    ps().toggleFavorite(MULTI_PROGRAM_ID)
    ps().setProgramPaused(MULTI_PROGRAM_ID, true)
    const before = ps().programMeta[MULTI_PROGRAM_ID]!.activatedAt ?? 0

    ps().restartProgram(MULTI_PROGRAM_ID, config('2026-09-14'))

    const meta = ps().programMeta[MULTI_PROGRAM_ID]!
    expect(meta.favorite).toBe(true)
    expect(meta.paused).toBe(false)
    expect(meta.activatedAt).toBeGreaterThanOrEqual(before)
  })

  it('leaves the training history completely alone', () => {
    const logged = [
      session(dayRef(MULTI_PROGRAM_ID, 'week-1', W1_MON), daysAgo(30)),
      session(dayRef(MULTI_PROGRAM_ID, 'week-6', W6_MON), daysAgo(2)),
    ]
    useAppStore.setState({ history: logged })

    ps().restartProgram(MULTI_PROGRAM_ID, config('2026-09-14'))

    expect(as().history).toEqual(logged)
  })

  it('unlinks this program\'s runs but keeps the run records', () => {
    const linked = run(dayRef(MULTI_PROGRAM_ID, 'week-1', W1_MON))
    const other = run(dayRef(RUN_PROGRAM_ID, RUN_WEEK_ID, RUN_DAY_ID))
    const free = run()
    useAppStore.setState({ runs: [linked, other, free] })

    ps().restartProgram(MULTI_PROGRAM_ID, config('2026-09-14'))

    const runs = as().runs
    expect(runs).toHaveLength(3)
    expect(runs.find(r => r.id === linked.id)?.dayRef).toBeUndefined()
    expect(runs.find(r => r.id === other.id)?.dayRef).toBe(other.dayRef)
    expect(runs.find(r => r.id === free.id)?.dayRef).toBeUndefined()
  })

  it('rewinds the active week to 1 even after training a late week this week', () => {
    // The case a fresh start date alone cannot fix: pickActiveWeek floors the
    // current week at the first unfinished one, which without clearing progress
    // stays at week 6 no matter what the calendar says.
    for (const w of multi.weeks.slice(0, 5)) {
      for (const d of w.days) ps().setDayStatus(MULTI_PROGRAM_ID, w.id, d.id, 'done')
    }
    ps().setDayStatus(MULTI_PROGRAM_ID, 'week-6', W6_MON, 'done')
    useAppStore.setState({
      history: [session(dayRef(MULTI_PROGRAM_ID, 'week-6', W6_MON), new Date())],
    })

    const before = pickActiveWeek(multi, ps().progress, ps().getConfig(MULTI_PROGRAM_ID)!, as().history)
    expect(before?.weekNum).toBe(6)

    const today = ymdLocal(new Date())
    ps().restartProgram(MULTI_PROGRAM_ID, config(today))

    const after = pickActiveWeek(multi, ps().progress, ps().getConfig(MULTI_PROGRAM_ID)!, as().history)
    expect(after?.weekNum).toBe(1)
    expect(after?.weeksBehind).toBe(0)
    expect(after?.leftovers).toEqual([])
  })

  it('does not touch another program', () => {
    ps().addCustomProgram(makeRunProgram())
    ps().setConfig(RUN_PROGRAM_ID, config('2026-01-01'))
    ps().setDayStatus(RUN_PROGRAM_ID, RUN_WEEK_ID, RUN_DAY_ID, 'done')

    ps().restartProgram(MULTI_PROGRAM_ID, config('2026-09-14'))

    expect(ps().getDayStatus(RUN_PROGRAM_ID, RUN_WEEK_ID, RUN_DAY_ID)).toBe('done')
    expect(ps().getConfig(RUN_PROGRAM_ID)?.startDate).toBe('2026-01-01')
  })

  it('cancels an unfinished workout of this program, but not of another', () => {
    const workout = (programId: string): Workout => ({
      programId, name: 'Day', startTime: Date.now(), currentIdx: 0, exercises: [],
    })

    useAppStore.setState({ workout: workout(dayRef(MULTI_PROGRAM_ID, 'week-3', 'w3-mon')) })
    ps().restartProgram(MULTI_PROGRAM_ID, config('2026-09-14'))
    expect(as().workout).toBeNull()

    const elsewhere = workout(dayRef(RUN_PROGRAM_ID, RUN_WEEK_ID, RUN_DAY_ID))
    useAppStore.setState({ workout: elsewhere })
    ps().restartProgram(MULTI_PROGRAM_ID, config('2026-09-14'))
    expect(as().workout).toEqual(elsewhere)
  })
})
