import { describe, it, expect } from 'vitest'
import { dayRef, resolveDayRef } from './programStatus.js'
import { makeRunProgram, RUN_PROGRAM_ID, RUN_WEEK_ID, RUN_DAY_ID } from '../test/fixtures.js'

const programs = [makeRunProgram()]

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
