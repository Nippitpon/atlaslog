import { describe, it, expect } from 'vitest'
import type { Workout } from '@atlaslog/shared'
import { resolveStartAction, workoutSetProgress } from './workoutFlow.js'

const workout = (programId: string): Workout => ({
  programId,
  name: 'Wed — Squat',
  startTime: Date.now(),
  currentIdx: 0,
  exercises: [
    { exerciseId: 'squat', sets: [{ w: 100, r: 5, done: true }, { w: 100, r: 5, done: false }] },
    { exerciseId: 'bench', sets: [{ w: 80, r: 5, done: true }] },
  ],
})

describe('resolveStartAction', () => {
  it('starts straight away when nothing is running', () => {
    expect(resolveStartAction(null, 'sbd-12w/w1/day-1')).toBe('start')
  })

  it('resumes when the same day is tapped again', () => {
    expect(resolveStartAction(workout('sbd-12w/w1/day-1'), 'sbd-12w/w1/day-1')).toBe('resume')
  })

  // The case that lost sets: two days of one program are different workouts
  it('asks first for another day of the same program', () => {
    expect(resolveStartAction(workout('sbd-12w/w1/day-1'), 'sbd-12w/w1/day-2')).toBe('confirm')
  })

  it('asks first for a different program', () => {
    expect(resolveStartAction(workout('sbd-12w/w1/day-1'), 'quick')).toBe('confirm')
  })

  it('resumes a quick session instead of restarting it', () => {
    expect(resolveStartAction(workout('quick'), 'quick')).toBe('resume')
  })
})

describe('workoutSetProgress', () => {
  it('counts checked sets against every prescribed set', () => {
    expect(workoutSetProgress(workout('quick'))).toEqual({ done: 2, total: 3 })
  })
})
