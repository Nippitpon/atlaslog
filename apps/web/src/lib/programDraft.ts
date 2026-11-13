import type { ProgramPhase, StructuredDay, StructuredExercise, StructuredProgram, StructuredWeek } from '@atlaslog/shared'
import { sortDaysByWeekday } from './programStatus.js'

// Authoring model for CreateProgramPage: every week owns its own days and rows.
// The editor used to treat week 1 as a template and stamp it onto every week,
// which silently rewrote programs whose weeks differ (e.g. an Excel import with
// a test week). Ids are carried through untouched so progress / customAccessories
// (keyed weekId → dayId, rows by id) survive an edit.

export type DayOfWeek = StructuredDay['dayOfWeek']
export type DayDraft = { id?: string; dayOfWeek: DayOfWeek; focus: string; exercises: StructuredExercise[] }
export type WeekDraft = { id?: string; phase: ProgramPhase; days: DayDraft[] }

export const PHASES: ProgramPhase[] = ['Accumulation', 'Intensification', 'Peaking', 'Deload', 'Taper']

const cloneEx = (ex: StructuredExercise, keepId: boolean): StructuredExercise => {
  const c = { ...ex }
  if (!keepId) delete c.id
  return c
}

const cloneDay = (d: DayDraft, keepIds: boolean): DayDraft => ({
  ...(keepIds && d.id ? { id: d.id } : {}),
  dayOfWeek: d.dayOfWeek,
  focus: d.focus,
  exercises: d.exercises.map(ex => cloneEx(ex, keepIds)),
})

export function emptyWeek(phase: ProgramPhase = 'Accumulation'): WeekDraft {
  return { phase, days: [] }
}

export function programToDraft(program: StructuredProgram): WeekDraft[] {
  const weeks = [...program.weeks].sort((a, b) => a.weekNumber - b.weekNumber)
  if (!weeks.length) return [emptyWeek()]
  return weeks.map(w => ({
    id: w.id,
    phase: w.phase,
    days: w.days.map(d => cloneDay({ id: d.id, dayOfWeek: d.dayOfWeek, focus: d.focus, exercises: d.exercises }, true)),
  }))
}

export function draftToWeeks(drafts: WeekDraft[], stamp: number): StructuredWeek[] {
  const usedWeekIds = new Set<string>()
  return drafts.map((w, wi) => {
    const n = wi + 1
    let weekId = w.id && !usedWeekIds.has(w.id) ? w.id : `week-${n}`
    if (usedWeekIds.has(weekId)) weekId = `week-${n}-${stamp}`
    usedWeekIds.add(weekId)
    const usedDayIds = new Set<string>()
    const days = sortDaysByWeekday(w.days).map((d, di) => {
      let dayId = d.id && !usedDayIds.has(d.id) ? d.id : `day-${stamp}-w${n}-${di}`
      if (usedDayIds.has(dayId)) dayId = `${dayId}-${di}`
      usedDayIds.add(dayId)
      const usedExIds = new Set<string>()
      const exercises = d.exercises.map((ex, ei) => {
        const id = ex.id && !usedExIds.has(ex.id) ? ex.id : `w${n}-${dayId}-n${stamp}-${ei}`
        usedExIds.add(id)
        return { ...ex, id }
      })
      return { id: dayId, dayOfWeek: d.dayOfWeek, focus: d.focus.trim() || `${d.dayOfWeek} Training`, exercises }
    })
    return { id: weekId, weekNumber: n, phase: w.phase, days }
  })
}

// Grow by cloning the last week (fresh row ids, no day ids) · shrink by dropping the tail.
export function resizeWeeks(drafts: WeekDraft[], n: number): WeekDraft[] {
  const count = Math.max(1, Math.floor(n))
  if (count <= drafts.length) return drafts.slice(0, count)
  const last = drafts[drafts.length - 1] ?? emptyWeek()
  const extra = Array.from({ length: count - drafts.length }, () => ({
    phase: last.phase,
    days: last.days.map(d => cloneDay(d, false)),
  }))
  return [...drafts, ...extra]
}

// Replace each target week's days with a copy of `from`. A target day on the same
// weekday keeps its id so that day's logged progress stays attached.
export function copyWeek(drafts: WeekDraft[], from: number, targets: number[]): WeekDraft[] {
  const src = drafts[from]
  if (!src) return drafts
  const set = new Set(targets.filter(t => t !== from))
  return drafts.map((w, wi) => {
    if (!set.has(wi)) return w
    const byDay = new Map(w.days.filter(d => d.id).map(d => [d.dayOfWeek, d.id!]))
    return {
      ...w,
      days: src.days.map(d => {
        const c = cloneDay(d, false)
        const keep = byDay.get(d.dayOfWeek)
        return keep ? { id: keep, ...c } : c
      }),
    }
  })
}

// Append a row to `dayOfWeek` in each listed week (creating the day where missing).
// `rows` is either one row for every week or one row per entry of `weekIdxs`.
export function addExerciseToWeeks(
  drafts: WeekDraft[],
  weekIdxs: number[],
  dayOfWeek: DayOfWeek,
  rows: StructuredExercise | StructuredExercise[],
  focus = '',
): WeekDraft[] {
  const pick = (i: number) => (Array.isArray(rows) ? rows[i] : rows)
  const targets = new Map(weekIdxs.map((wi, i) => [wi, i]))
  return drafts.map((w, wi) => {
    const i = targets.get(wi)
    if (i === undefined) return w
    const row = pick(i)
    if (!row) return w
    const add = cloneEx(row, false)
    const has = w.days.some(d => d.dayOfWeek === dayOfWeek)
    const days = has
      ? w.days.map(d => (d.dayOfWeek === dayOfWeek ? { ...d, exercises: [...d.exercises, add] } : d))
      : [...w.days, { dayOfWeek, focus, exercises: [add] }]
    return { ...w, days }
  })
}

// Training days with no rows. Saving them would put an empty "<Day> Training" day
// in the program, so the editor blocks the save and lists them instead.
export function findEmptyDays(drafts: WeekDraft[]): { week: number; dayOfWeek: DayOfWeek }[] {
  return drafts.flatMap((w, wi) =>
    sortDaysByWeekday(w.days).filter(d => d.exercises.length === 0).map(d => ({ week: wi, dayOfWeek: d.dayOfWeek })))
}

export function removeEmptyDays(drafts: WeekDraft[]): WeekDraft[] {
  return drafts.map(w => (w.days.some(d => d.exercises.length === 0)
    ? { ...w, days: w.days.filter(d => d.exercises.length > 0) }
    : w))
}

export function maxDaysPerWeek(drafts: WeekDraft[]): number {
  return Math.max(0, ...drafts.map(w => w.days.length))
}
