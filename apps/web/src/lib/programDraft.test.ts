import { describe, it, expect } from 'vitest'
import type { StructuredExercise, StructuredProgram, StructuredWeek } from '@atlaslog/shared'
import { addExerciseToWeeks, copyWeek, draftToWeeks, programToDraft, resizeWeeks, emptyWeek, findEmptyDays, removeEmptyDays } from './programDraft.js'

const row = (id: string, exerciseId: string, label: string, sets: number, reps: number, pct: number, note?: string): StructuredExercise =>
  ({ id, exerciseId, name: exerciseId, label, type: 'main', sets, reps, pct, rpe: 8, ...(note ? { note } : {}) })

// Shaped like the Hybrid Sumo import: week 1 is a normal training week, week 2 is
// a test week with a different number of rows and different lifts per day.
const sumoLike = (): StructuredProgram => ({
  id: 'custom-1', name: 'Sumo', description: '', totalWeeks: 2, daysPerWeek: 2, focus: 'SBD',
  isCustom: true, source: 'excel', programType: 'powerlifting',
  weeks: [
    {
      id: 'week-1', weekNumber: 1, phase: 'Accumulation', days: [
        { id: 'day-1', dayOfWeek: 'Mon', focus: 'Squat', exercises: [
          row('w1-Mon-e0', 'squat', 'Competition · Top set', 1, 5, 0.75, 'tempo'),
          row('w1-Mon-e1', 'squat', 'Competition · Back-off', 3, 5, 0.7),
          row('w1-Mon-e2', 'bench', 'Technique/Speed · Speed sets', 3, 3, 0.7),
          row('w1-Mon-e3', 'deadlift', 'Volume · Work sets', 2, 6, 0.7),
        ] },
        { id: 'day-2', dayOfWeek: 'Tue', focus: 'Bench', exercises: [
          row('w1-Tue-e0', 'bench', 'Competition · Top set', 1, 5, 0.75),
          row('w1-Tue-e1', 'bench', 'Competition · Back-off', 4, 5, 0.7),
        ] },
      ],
    },
    {
      id: 'week-2', weekNumber: 2, phase: 'Taper', days: [
        { id: 'day-1', dayOfWeek: 'Mon', focus: 'Squat', exercises: [
          row('w2-Mon-e0', 'squat', 'Competition · Attempt 1', 1, 1, 0.9, '1st attempt'),
          row('w2-Mon-e1', 'squat', 'Competition · Attempt 2', 1, 1, 0.97),
          row('w2-Mon-e2', 'squat', 'Competition · Attempt 3', 1, 1, 1.02),
        ] },
        { id: 'day-2', dayOfWeek: 'Tue', focus: 'Bench', exercises: [
          row('w2-Tue-e0', 'bench', 'Competition · Attempt 1', 1, 1, 0.9),
          row('w2-Tue-e1', 'bench', 'Competition · Attempt 2', 1, 1, 0.97),
          row('w2-Tue-e2', 'bench', 'Competition · Attempt 3', 1, 1, 1.02),
        ] },
      ],
    },
  ],
})

describe('programToDraft → draftToWeeks', () => {
  it('round-trips a program whose weeks differ without changing a single field', () => {
    const p = sumoLike()
    const out: StructuredWeek[] = draftToWeeks(programToDraft(p), 123)
    expect(out).toEqual(p.weeks)
  })

  it('does not mutate the source program', () => {
    const p = sumoLike()
    const snap = JSON.parse(JSON.stringify(p))
    const d = programToDraft(p)
    d[1].days[0].exercises[0].pct = 0.5
    d[1].days[0].exercises.pop()
    expect(p).toEqual(snap)
  })

  it('edits one week without touching the others', () => {
    const p = sumoLike()
    const d = programToDraft(p)
    d[1].days[0].exercises[2] = { ...d[1].days[0].exercises[2], pct: 1.03 }
    const out = draftToWeeks(d, 1)
    expect(out[0]).toEqual(p.weeks[0])
    expect(out[1].days[0].exercises[2].pct).toBe(1.03)
    expect(out[1].days[1]).toEqual(p.weeks[1].days[1])
  })

  it('mints unique ids for new days/rows and sorts days by weekday', () => {
    const d = [{ phase: 'Accumulation' as const, days: [
      { dayOfWeek: 'Fri' as const, focus: '', exercises: [row('', 'squat', 'x', 1, 1, 0.5), row('', 'squat', 'y', 1, 1, 0.5)] },
      { dayOfWeek: 'Mon' as const, focus: 'Legs', exercises: [] },
    ] }]
    d[0].days[0].exercises.forEach(e => { delete e.id })
    const [w] = draftToWeeks(d, 9)
    expect(w.id).toBe('week-1')
    expect(w.days.map(x => x.dayOfWeek)).toEqual(['Mon', 'Fri'])
    expect(w.days[1].focus).toBe('Fri Training')
    const ids = w.days[1].exercises.map(e => e.id)
    expect(new Set(ids).size).toBe(2)
    expect(ids.every(Boolean)).toBe(true)
  })
})

describe('resizeWeeks', () => {
  it('grows by cloning the last week with fresh row ids', () => {
    const d = resizeWeeks(programToDraft(sumoLike()), 4)
    expect(d).toHaveLength(4)
    expect(d[3].phase).toBe('Taper')
    expect(d[3].days[0].exercises.map(e => e.label)).toEqual(d[1].days[0].exercises.map(e => e.label))
    expect(d[3].days[0].id).toBeUndefined()
    expect(d[3].days[0].exercises.every(e => e.id === undefined)).toBe(true)
    const out = draftToWeeks(d, 5)
    expect(out.map(w => w.id)).toEqual(['week-1', 'week-2', 'week-3', 'week-4'])
  })

  it('shrinks by dropping the tail and never below one week', () => {
    expect(resizeWeeks(programToDraft(sumoLike()), 1)).toHaveLength(1)
    expect(resizeWeeks(programToDraft(sumoLike()), 0)).toHaveLength(1)
  })
})

describe('copyWeek', () => {
  it('copies rows to targets, keeping target day ids on matching weekdays', () => {
    const d = copyWeek(programToDraft(sumoLike()), 0, [1])
    expect(d[1].phase).toBe('Taper')
    expect(d[1].days.map(x => x.id)).toEqual(['day-1', 'day-2'])
    expect(d[1].days[0].exercises.map(e => e.label)).toEqual(d[0].days[0].exercises.map(e => e.label))
    expect(d[1].days[0].exercises.every(e => e.id === undefined)).toBe(true)
    expect(d[0].days[0].exercises[0].id).toBe('w1-Mon-e0')
  })

  it('ignores copying a week onto itself', () => {
    const src = programToDraft(sumoLike())
    expect(copyWeek(src, 1, [1])).toEqual(src)
  })
})

describe('findEmptyDays / removeEmptyDays', () => {
  it('lists empty days per week and removes only those', () => {
    const d = programToDraft(sumoLike())
    d[1].days.push({ dayOfWeek: 'Wed', focus: '', exercises: [] })
    d[0].days.unshift({ dayOfWeek: 'Sat', focus: '', exercises: [] })
    expect(findEmptyDays(d)).toEqual([{ week: 0, dayOfWeek: 'Sat' }, { week: 1, dayOfWeek: 'Wed' }])
    const cleaned = removeEmptyDays(d)
    expect(findEmptyDays(cleaned)).toEqual([])
    expect(draftToWeeks(cleaned, 1)).toEqual(sumoLike().weeks)
  })

  it('returns nothing when every day has a row', () => {
    expect(findEmptyDays(programToDraft(sumoLike()))).toEqual([])
  })
})

describe('addExerciseToWeeks', () => {
  it('puts the per-week row into the right week and creates missing days', () => {
    const d0 = [emptyWeek(), { phase: 'Accumulation' as const, days: [{ id: 'd', dayOfWeek: 'Wed' as const, focus: '', exercises: [] }] }]
    const rows = [row('a', 'squat', 'W1', 3, 5, 0.7), row('b', 'squat', 'W2', 3, 4, 0.75)]
    const d = addExerciseToWeeks(d0, [0, 1], 'Wed', rows, 'Legs')
    expect(d[0].days[0]).toMatchObject({ dayOfWeek: 'Wed', focus: 'Legs' })
    expect(d[0].days[0].exercises[0]).toMatchObject({ label: 'W1', pct: 0.7 })
    expect(d[1].days[0].id).toBe('d')
    expect(d[1].days[0].exercises[0]).toMatchObject({ label: 'W2', pct: 0.75, reps: 4 })
    expect(d[1].days[0].exercises[0].id).toBeUndefined()
  })
})
