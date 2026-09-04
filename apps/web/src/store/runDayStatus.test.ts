import { describe, it, expect, beforeEach } from 'vitest'
import type { RunEntry } from '@atlaslog/shared'
import { useProgramStore } from './useProgramStore.js'
import { useAppStore } from './useAppStore.js'
import { dayRef, isWeekDone, remainingDays } from '../lib/programStatus.js'
import { makeRunProgram, RUN_PROGRAM_ID, RUN_WEEK_ID, RUN_DAY_ID, MIXED_DAY_ID } from '../test/fixtures.js'

const runRef = dayRef(RUN_PROGRAM_ID, RUN_WEEK_ID, RUN_DAY_ID)
const mixedRef = dayRef(RUN_PROGRAM_ID, RUN_WEEK_ID, MIXED_DAY_ID)

const ps = () => useProgramStore.getState()
const as = () => useAppStore.getState()
const statusOf = (ref: string) => {
  const [p, w, d] = ref.split('/')
  return ps().getDayStatus(p!, w!, d!)
}

let n = 0
const run = (ref?: string): RunEntry => ({
  id: `r${++n}`,
  date: new Date().toISOString(),
  distanceKm: 5,
  durationMin: 30,
  dayRef: ref,
})

beforeEach(() => {
  // Both stores are module singletons shared across every test file.
  useProgramStore.setState({
    progress: {}, configs: {}, customAccessories: {}, customPrograms: [], programMeta: {},
  })
  useAppStore.setState({ runs: [] })
  ps().addCustomProgram(makeRunProgram())
})

describe('a day that only prescribes running', () => {
  it('starts not_started and is done once a linked run is logged', () => {
    expect(statusOf(runRef)).toBe('not_started')
    as().addRun(run(runRef))
    expect(statusOf(runRef)).toBe('done')
  })

  it('stays done while any run for that day remains', () => {
    const first = run(runRef)
    as().addRun(first)
    const second = run(runRef)
    as().addRun(second)
    as().removeRun(second.id)
    expect(statusOf(runRef)).toBe('done')
  })

  it('rewinds to not_started when the last run for it is deleted', () => {
    const only = run(runRef)
    as().addRun(only)
    as().removeRun(only.id)
    expect(statusOf(runRef)).toBe('not_started')
  })

  // The Edit sheet can add an accessory to a run day, which gives the set logger
  // something to finish — 'done' goes back to being the workout's to grant.
  it('only reaches in_progress once the user has edited lifts into it', () => {
    ps().setDayLayout(RUN_PROGRAM_ID, RUN_WEEK_ID, RUN_DAY_ID, [
      { id: 'acc1', exerciseId: 'plank', name: 'Plank', type: 'accessory', sets: 3, reps: 30 },
    ])
    as().addRun(run(runRef))
    expect(statusOf(runRef)).toBe('in_progress')
  })
})

describe('a day that lifts as well as runs', () => {
  it('only moves off not_started — the lifts still own done', () => {
    as().addRun(run(mixedRef))
    expect(statusOf(mixedRef)).toBe('in_progress')
  })

  it('never overwrites or rewinds a day the workout already finished', () => {
    ps().setDayStatus(RUN_PROGRAM_ID, RUN_WEEK_ID, MIXED_DAY_ID, 'done')
    const r = run(mixedRef)
    as().addRun(r)
    expect(statusOf(mixedRef)).toBe('done')
    as().removeRun(r.id)
    expect(statusOf(mixedRef)).toBe('done')
  })
})

describe('runs that point at nothing', () => {
  it('ignores a ref whose program is gone', () => {
    as().addRun(run('gone/w9/day-x'))
    expect(statusOf(runRef)).toBe('not_started')
  })

  it('leaves every day alone for a free run', () => {
    as().addRun(run())
    expect(statusOf(runRef)).toBe('not_started')
    expect(statusOf(mixedRef)).toBe('not_started')
  })
})

// The knock-on bug behind round 41: isWeekDone needs every day, so a week
// holding a run day could never finish, pinning Home and blocking COMPLETED.
describe('week completion', () => {
  it('finishes a week whose run day was closed by a run', () => {
    const week = makeRunProgram().weeks[0]!
    ps().setDayStatus(RUN_PROGRAM_ID, RUN_WEEK_ID, MIXED_DAY_ID, 'done')
    as().addRun(run(runRef))
    expect(isWeekDone(RUN_PROGRAM_ID, week, ps().progress)).toBe(true)
    expect(remainingDays(RUN_PROGRAM_ID, week, ps().progress)).toBe(0)
  })
})
