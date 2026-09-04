import { describe, it, expect } from 'vitest'
import type { ProgramProgressState, StructuredProgram } from '@atlaslog/shared'
import {
  dayRef, resolveDayRef, doneDaysInWeek, remainingDays, programProgress, reachedWeekNum,
} from './programStatus.js'
import { makeRunProgram, RUN_PROGRAM_ID, RUN_WEEK_ID, RUN_DAY_ID, MIXED_DAY_ID } from '../test/fixtures.js'

const programs = [makeRunProgram()]

// 3 weeks × 2 days, ids w1..w3 / d1-d2 — enough to model "a day skipped every week"
const P = 'p3'
function make3WeekProgram(): StructuredProgram {
  return {
    id: P, name: '3wk', description: '', totalWeeks: 3, daysPerWeek: 2, focus: '',
    weeks: [1, 2, 3].map(n => ({
      id: `w${n}`, weekNumber: n, phase: 'Accumulation' as const,
      days: [1, 2].map(d => ({
        id: `d${d}`, dayOfWeek: 'Mon' as const, focus: 'x',
        exercises: [{ exerciseId: 'squat', name: 'Squat', type: 'main' as const, sets: 3, reps: 5 }],
      })),
    })),
  }
}
const progressOf = (weeks: Record<string, Record<string, 'done' | 'in_progress'>>): ProgramProgressState =>
  ({ [P]: weeks })

describe('dayRef', () => {
  it('joins the three ids the way dayToProgram stamps them', () => {
    expect(dayRef('sbd-12w', 'w3', 'day-2')).toBe('sbd-12w/w3/day-2')
  })
})

describe('resolveDayRef', () => {
  it('resolves a live ref, numbering the week by position', () => {
    const target = resolveDayRef(dayRef(RUN_PROGRAM_ID, RUN_WEEK_ID, RUN_DAY_ID), programs)
    expect(target?.program.id).toBe(RUN_PROGRAM_ID)
    expect(target?.week.id).toBe(RUN_WEEK_ID)
    expect(target?.day.id).toBe(RUN_DAY_ID)
    expect(target?.weekNum).toBe(1)
  })

  // A run keeps its dayRef forever; the program behind it may not survive.
  it('returns null when any id no longer exists', () => {
    expect(resolveDayRef(dayRef('gone', RUN_WEEK_ID, RUN_DAY_ID), programs)).toBeNull()
    expect(resolveDayRef(dayRef(RUN_PROGRAM_ID, 'w9', RUN_DAY_ID), programs)).toBeNull()
    expect(resolveDayRef(dayRef(RUN_PROGRAM_ID, RUN_WEEK_ID, 'day-gone'), programs)).toBeNull()
  })

  it('returns null for a ref that is not three segments', () => {
    expect(resolveDayRef(undefined, programs)).toBeNull()
    expect(resolveDayRef('', programs)).toBeNull()
    expect(resolveDayRef(`${RUN_PROGRAM_ID}/${RUN_WEEK_ID}`, programs)).toBeNull()
    expect(resolveDayRef(`${RUN_PROGRAM_ID}/${RUN_WEEK_ID}/${RUN_DAY_ID}/extra`, programs)).toBeNull()
  })
})

describe('doneDaysInWeek', () => {
  const run = makeRunProgram()
  const week = run.weeks[0]!

  it('counts nothing for an untouched week', () => {
    expect(doneDaysInWeek(RUN_PROGRAM_ID, week, {})).toBe(0)
  })

  it('counts only the days marked done', () => {
    const progress = { [RUN_PROGRAM_ID]: { [RUN_WEEK_ID]: { [RUN_DAY_ID]: 'done' as const } } }
    expect(doneDaysInWeek(RUN_PROGRAM_ID, week, progress)).toBe(1)
    expect(remainingDays(RUN_PROGRAM_ID, week, progress)).toBe(1)
  })

  it('counts every day when the week is finished', () => {
    const progress = {
      [RUN_PROGRAM_ID]: { [RUN_WEEK_ID]: { [RUN_DAY_ID]: 'done' as const, [MIXED_DAY_ID]: 'done' as const } },
    }
    expect(doneDaysInWeek(RUN_PROGRAM_ID, week, progress)).toBe(2)
    expect(remainingDays(RUN_PROGRAM_ID, week, progress)).toBe(0)
  })

  // Editing or re-importing a program leaves day ids behind in progress
  it('ignores recorded days the program no longer has', () => {
    const progress = {
      [RUN_PROGRAM_ID]: { [RUN_WEEK_ID]: { [RUN_DAY_ID]: 'done' as const, 'day-from-an-old-shape': 'done' as const } },
    }
    expect(doneDaysInWeek(RUN_PROGRAM_ID, week, progress)).toBe(1)
  })
})

describe('programProgress', () => {
  // The reported bug: one day skipped per week held the bar at 0% for three weeks
  it('moves with days trained even when no week is complete', () => {
    const p = programProgress(make3WeekProgram(), progressOf({
      w1: { d1: 'done' }, w2: { d1: 'done' }, w3: { d1: 'done' },
    }))
    expect(p.doneWeeks).toBe(0)
    expect(p.doneDays).toBe(3)
    expect(p.totalDays).toBe(6)
    expect(p.pct).toBe(50)
  })

  it('reads 0% before anything is trained', () => {
    expect(programProgress(make3WeekProgram(), {})).toMatchObject({ doneDays: 0, pct: 0 })
  })

  it('reaches 100% with every week counted when the program is finished', () => {
    const p = programProgress(make3WeekProgram(), progressOf({
      w1: { d1: 'done', d2: 'done' }, w2: { d1: 'done', d2: 'done' }, w3: { d1: 'done', d2: 'done' },
    }))
    expect(p).toMatchObject({ doneDays: 6, totalDays: 6, doneWeeks: 3, totalWeeks: 3, pct: 100 })
  })

  it('does not divide by zero on a program with no days', () => {
    const empty: StructuredProgram = { ...make3WeekProgram(), weeks: [] }
    expect(programProgress(empty, {})).toMatchObject({ pct: 0, totalDays: 0 })
  })
})

describe('reachedWeekNum', () => {
  it('is 0 until something is trained', () => {
    expect(reachedWeekNum(make3WeekProgram(), {})).toBe(0)
  })

  it('follows the furthest week touched, finished or not', () => {
    expect(reachedWeekNum(make3WeekProgram(), progressOf({ w3: { d1: 'in_progress' } }))).toBe(3)
  })

  it('does not run ahead of the weeks actually touched', () => {
    expect(reachedWeekNum(make3WeekProgram(), progressOf({ w1: { d1: 'done', d2: 'done' } }))).toBe(1)
  })
})
