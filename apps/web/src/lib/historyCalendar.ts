import type {
  DayStatus, ProgramConfig, ProgramProgressState, RunEntry, Session,
  StructuredDay, StructuredProgram, StructuredWeek,
} from '@atlaslog/shared'
import { ymdLocal, ymdOfISO } from './utils.js'
import { DAY_STATUS_STYLE, dayDate, dayRef, isSettled, startOfTrainingWeek } from './programStatus.js'
import type { LiftPR } from './sessionStats.js'

// One dot per calendar day. Ordered by the precedence dotFor() applies: actual
// training beats anything the plan says, because History answers "what happened".
export type CalendarDot = 'trained' | 'run' | 'today' | 'planned' | 'missed' | 'settled'

// Dot styling in one place, the same way DAY_STATUS_STYLE owns the day badge —
// 'done' green is taken from there rather than re-typing the hex. `hollow` draws
// a ring instead of a fill.
export const CALENDAR_DOT: Record<CalendarDot, { color: string; hollow: boolean; label: string }> = {
  trained: { color: DAY_STATUS_STYLE.done.color, hollow: false, label: 'ยกเหล็ก' },
  run:     { color: 'var(--accent)',             hollow: false, label: 'วิ่ง' },
  today:   { color: '#3aaaff',                   hollow: false, label: 'วันนี้' },
  planned: { color: 'var(--border-strong)',      hollow: false, label: 'ตามแผน' },
  missed:  { color: 'var(--danger)',             hollow: false, label: 'พลาด' },
  settled: { color: 'var(--border-strong)',      hollow: true,  label: 'ปิดแล้ว' },
}

export interface ScheduledCell {
  program: StructuredProgram
  week: StructuredWeek
  // The program's OWN week number (week.weekNumber), which is what the athlete's
  // sheet says — not the array position resolveDayRef reports. They differ for a
  // gappy import (weeks 1, 2, 5).
  weekNum: number
  day: StructuredDay
  status: DayStatus
  ref: string
}

export type TrainedCell =
  | { kind: 'session'; date: string; session: Session }
  | { kind: 'run'; date: string; run: RunEntry }

export type ScheduleMap = Map<string, ScheduledCell[]>
export type TrainedMap = Map<string, TrainedCell[]>

// Every prescribed day of every dated program, keyed by the calendar date it
// falls on. Built once and looked up per cell — searching the programs for each
// of the ~35 cells on screen would redo this work 35 times.
export function buildScheduleMap(
  programs: StructuredProgram[],
  configs: { [programId: string]: ProgramConfig },
  progress: ProgramProgressState,
): ScheduleMap {
  const map: ScheduleMap = new Map()
  for (const program of programs) {
    // Weekly routines have no start date on purpose (useProgramStore drops the
    // config), so they cannot be placed on a calendar at all.
    if (program.weekly) continue
    const config = configs[program.id]
    if (!config) continue
    for (const week of program.weeks) {
      for (const day of week.days) {
        // week.weekNumber, never the index: a gappy Excel import (weeks 1, 2, 5)
        // has totalWeeks 3, and counting positions would pull week 5 forward.
        const d = dayDate(config.startDate, week.weekNumber, day.dayOfWeek)
        if (!d) continue
        const ymd = ymdLocal(d)
        const cell: ScheduledCell = {
          program,
          week,
          weekNum: week.weekNumber,
          day,
          status: progress[program.id]?.[week.id]?.[day.id] ?? 'not_started',
          ref: dayRef(program.id, week.id, day.id),
        }
        const bucket = map.get(ymd)
        if (bucket) bucket.push(cell)
        else map.set(ymd, [cell])
      }
    }
  }
  return map
}

// Everything actually logged, keyed by the day it really happened on. Sorted
// per-day rather than trusting array order: runs can be backdated and addRun
// only prepends, so `runs` is not date-ordered until the next cloud reload.
export function buildTrainedMap(history: Session[], runs: RunEntry[]): TrainedMap {
  const map: TrainedMap = new Map()
  const push = (cell: TrainedCell) => {
    const ymd = ymdOfISO(cell.date)
    const bucket = map.get(ymd)
    if (bucket) bucket.push(cell)
    else map.set(ymd, [cell])
  }
  for (const session of history) push({ kind: 'session', date: session.date, session })
  for (const run of runs) push({ kind: 'run', date: run.date, run })
  for (const bucket of map.values()) bucket.sort((a, b) => b.date.localeCompare(a.date))
  return map
}

// 'YYYY-MM-DD' sorts lexicographically, so plain string compare is a date compare.
export function dotFor(
  ymd: string,
  schedule: ScheduleMap,
  trained: TrainedMap,
  todayYmd: string,
): CalendarDot | null {
  const entries = trained.get(ymd)
  // A run-only day is training too, but it is not the same work as a lifting day,
  // so it gets its own colour rather than a green dot that overstates it.
  if (entries?.length) return entries.some(e => e.kind === 'session') ? 'trained' : 'run'
  const cells = schedule.get(ymd)
  if (!cells?.length) return null
  // An unsettled day wins: if one program still wants work on this date, the day
  // is outstanding even when another program has closed its own day out.
  const open = cells.find(c => !isSettled(c.status))
  // Settled with nothing logged on this date = skipped, or trained on another
  // day (finishWorkout marks the PLANNED day done but stamps the real date).
  if (!open) return 'settled'
  if (ymd === todayYmd) return 'today'
  return ymd > todayYmd ? 'planned' : 'missed'
}

// `month` is 0-based, like Date.getMonth(). Cells are Monday-first to match the
// program week (StructuredDay.dayOfWeek is Mon–Sat, so Sunday is the rest slot at
// the end); note weeklyVolume/weeklyCalories are Sunday-first — the app is split
// on this and the calendar deliberately follows the programs. Trailing blanks are
// only padded out to a whole week, so a 5-week month gets no empty 6th row.
export function monthGrid(year: number, month: number): (string | null)[] {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (string | null)[] = new Array(lead).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(ymdLocal(new Date(year, month, d)))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

// Oldest and newest dates the calendar has anything to show for, so month paging
// can stop at the edges of real data instead of walking into empty grids. Today
// is always inside the range — the current month must stay reachable even before
// anything is logged or planned.
export function dataBounds(
  schedule: ScheduleMap,
  trained: TrainedMap,
  todayYmd: string,
): { first: string; last: string } {
  let first = todayYmd
  let last = todayYmd
  for (const map of [schedule, trained]) {
    for (const ymd of map.keys()) {
      if (ymd < first) first = ymd
      if (ymd > last) last = ymd
    }
  }
  return { first, last }
}

// Lifted volume logged on a day. Runs carry no kg, so they never move the heat.
export function dayVolume(entries: TrainedCell[] | undefined): number {
  let kg = 0
  for (const e of entries ?? []) if (e.kind === 'session') kg += e.session.volume
  return kg
}

// Heaviest single day in the month, the denominator for the volume heat. Scaled
// per month rather than all-time so a deload block still shows contrast instead
// of flattening against a peak week from last year.
export function monthMaxVolume(year: number, month: number, trained: TrainedMap): number {
  let max = 0
  for (const ymd of monthGrid(year, month)) {
    if (!ymd) continue
    const kg = dayVolume(trained.get(ymd))
    if (kg > max) max = kg
  }
  return max
}

// rgb of DAY_STATUS_STYLE.done.color (#4ade80). Kept as a triple because the
// heat wash needs an alpha channel, and CSS has no way to add one to a hex var.
const TRAINED_RGB = '74, 222, 128'

// Volume heat for a cell background. Floors at a visible tint so any trained day
// reads as worked, and tops out well short of opaque — the dot and the day number
// still have to be legible on top of it, in both themes.
export function heatBackground(heat: number): string {
  return heat > 0 ? `rgba(${TRAINED_RGB}, ${(0.07 + heat * 0.2).toFixed(3)})` : 'transparent'
}

export interface DayCell {
  dot: CalendarDot | null
  hasLift: boolean
  hasRun: boolean
  volumeKg: number
  // 0..1 share of the month's heaviest day — the cell's background intensity.
  heat: number
  prs: LiftPR[]
}

// Everything one calendar cell needs to draw itself, so the component does no
// deriving of its own. `prs` comes in from sessionStats rather than being computed
// here: it depends on the whole history, not on this month.
export function dayCell(
  ymd: string,
  schedule: ScheduleMap,
  trained: TrainedMap,
  todayYmd: string,
  prs: Map<string, LiftPR[]>,
  maxVolumeKg: number,
): DayCell {
  const entries = trained.get(ymd)
  const volumeKg = dayVolume(entries)
  return {
    dot: dotFor(ymd, schedule, trained, todayYmd),
    hasLift: !!entries?.some(e => e.kind === 'session'),
    hasRun: !!entries?.some(e => e.kind === 'run'),
    volumeKg,
    heat: maxVolumeKg > 0 ? volumeKg / maxVolumeKg : 0,
    prs: prs.get(ymd) ?? [],
  }
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    .toUpperCase()
}

export interface MonthSummary {
  trainedDays: number
  sessionCount: number
  runCount: number
  // Scheduled days that have come due (today included) — the adherence divisor.
  dueDays: number
  doneDays: number
  missedDays: number
  volumeKg: number
  adherencePct: number
}

// Counted per DATE, not per prescribed row, so the numbers agree with the dots
// the user is looking at (two programs scheduling the same date is one day).
export function monthSummary(
  year: number,
  month: number,
  schedule: ScheduleMap,
  trained: TrainedMap,
  todayYmd: string,
): MonthSummary {
  let trainedDays = 0, sessionCount = 0, runCount = 0
  let dueDays = 0, doneDays = 0, missedDays = 0, volumeKg = 0

  for (const ymd of monthGrid(year, month)) {
    if (!ymd) continue

    const entries = trained.get(ymd)
    if (entries?.length) {
      trainedDays++
      for (const e of entries) {
        if (e.kind === 'session') { sessionCount++; volumeKg += e.session.volume }
        else runCount++
      }
    }

    const cells = schedule.get(ymd)
    // Future days are left out of both sides of the ratio — dividing by days the
    // athlete has not reached yet makes the current month read as a failure.
    if (!cells?.length || ymd > todayYmd) continue
    // Today is not missed yet either: there is still time to train it (the same
    // rule isDayPast applies). It joins the ratio only once it is settled —
    // otherwise the strip reported one more missed day than the calendar drew.
    if (ymd === todayYmd && !cells.some(c => isSettled(c.status))) continue
    dueDays++
    if (cells.some(c => c.status === 'done')) doneDays++
    else if (cells.some(c => !isSettled(c.status))) missedDays++
  }

  return {
    trainedDays, sessionCount, runCount, dueDays, doneDays, missedDays, volumeKg,
    adherencePct: dueDays ? Math.round((doneDays / dueDays) * 100) : 0,
  }
}

// Consecutive Mon-start weeks with at least one logged entry. The current week is
// still in progress, so an empty one does not break the streak yet — counting
// starts at the most recent week that has training.
export function weekStreak(trained: TrainedMap, now: Date = new Date()): number {
  const hasTraining = (weekStart: Date): boolean => {
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      if (trained.get(ymdLocal(d))?.length) return true
    }
    return false
  }

  const cursor = startOfTrainingWeek(now)
  if (!hasTraining(cursor)) cursor.setDate(cursor.getDate() - 7)
  let streak = 0
  while (hasTraining(cursor)) {
    streak++
    cursor.setDate(cursor.getDate() - 7)
  }
  return streak
}
