import { describe, it, expect } from 'vitest'
import type { StructuredDay, StructuredExercise } from '@atlaslog/shared'
import { resolveDayExercises } from './dayLayout.js'

const ex = (exerciseId: string, name: string, type: 'main' | 'accessory', sets: number, id?: string): StructuredExercise =>
  ({ exerciseId, name, type, sets, reps: 5, pct: 0.7, rpe: 7, id })

const day = (exercises: StructuredExercise[]): StructuredDay =>
  ({ id: 'day-1', dayOfWeek: 'Mon', focus: 'x', exercises })

describe('resolveDayExercises', () => {
  it('re-reads a saved program accessory from the live program', () => {
    const live = day([ex('squat', 'Squat', 'main', 1), ex('bench', 'Speed Bench', 'accessory', 3)])
    const stored = [
      { ...ex('squat', 'Squat', 'main', 1), id: 'squat|Squat|0' },
      { ...ex('bench', 'Speed Bench', 'accessory', 8), id: 'bench|Speed Bench|1' },
    ]
    const out = resolveDayExercises(live, stored)
    expect(out.map(e => e.sets)).toEqual([1, 3])
  })

  it('drops a saved program accessory the program no longer has', () => {
    const live = day([ex('squat', 'Squat', 'main', 1)])
    const stored = [
      { ...ex('squat', 'Squat', 'main', 1), id: 'squat|Squat|0' },
      { ...ex('squat', 'Squat Volume', 'accessory', 4), id: 'squat|Squat Volume|1' },
    ]
    expect(resolveDayExercises(live, stored).map(e => e.name)).toEqual(['Squat'])
  })

  it('keeps user-added accessories as stored, in order', () => {
    const live = day([ex('squat', 'Squat', 'main', 1), ex('bench', 'Speed Bench', 'accessory', 3)])
    const stored = [
      { ...ex('curl', 'Curl', 'accessory', 4), id: 'ax123' },
      { ...ex('squat', 'Squat', 'main', 1), id: 'squat|Squat|0' },
      { ...ex('bench', 'Speed Bench', 'accessory', 8), id: 'bench|Speed Bench|1' },
    ]
    const out = resolveDayExercises(live, stored)
    expect(out.map(e => [e.name, e.sets])).toEqual([['Curl', 4], ['Squat', 1], ['Speed Bench', 3]])
  })
})
