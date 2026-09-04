import type {
  DayStatus, ProgramMeta, ProgramMetaState, ProgramProgressState, ProgramConfig,
  Session, StructuredDay, StructuredProgram, StructuredWeek,
} from '@atlaslog/shared'
import { dateFromYMD } from './utils.js'

export type ProgramStatus = 'not_setup' | 'active' | 'paused' | 'completed'

// Every day accounted for — trained, or explicitly skipped by the user. Derived
// from the program's own day list, not the recorded keys (`every(s => s ===
// 'done')` over those marks a 4-day week done once its first logged day is).
export function isWeekDone(
  programId: string,
  week: StructuredWeek,
  progress: ProgramProgressState,
): boolean {
  const days = progress[programId]?.[week.id] ?? {}
  return week.days.length > 0 && week.days.every(d => isSettled(days[d.id]))
}

// A day nobody has to come back to. Skipping is the only way to settle a day
// without training it, and it has to be deliberate.
const isSettled = (s: DayStatus | undefined): boolean => s === 'done' || s === 'skipped'

// Id-aware replacement for the store's old getWeekStatus, which compared a count
// of recorded keys against week.days.length: progress can hold day ids from an
// older shape of the program (edited, re-imported, or an old cloud snapshot), so
// counting keys reports both false 'done' and permanently-stuck weeks.
export function weekStatus(
  programId: string,
  week: StructuredWeek,
  progress: ProgramProgressState,
): DayStatus {
  if (isWeekDone(programId, week, progress)) return 'done'
  const days = progress[programId]?.[week.id] ?? {}
  return week.days.some(d => days[d.id] && days[d.id] !== 'not_started')
    ? 'in_progress'
    : 'not_started'
}

// Counted off the program's own day list, never off the recorded keys: progress
// can still hold day ids from an older shape of the program (edited, re-imported,
// or an old cloud snapshot), and those would inflate the total.
export function doneDaysInWeek(
  programId: string,
  week: StructuredWeek,
  progress: ProgramProgressState,
): number {
  const days = progress[programId]?.[week.id] ?? {}
  return week.days.filter(d => days[d.id] === 'done').length
}

// Days the user skipped on purpose. Kept apart from doneDays everywhere: they
// close out a week without pretending the training happened.
export function skippedDaysInWeek(
  programId: string,
  week: StructuredWeek,
  progress: ProgramProgressState,
): number {
  const days = progress[programId]?.[week.id] ?? {}
  return week.days.filter(d => days[d.id] === 'skipped').length
}

// Days still waiting on the user — what Home's "days left behind" line counts.
export function remainingDays(
  programId: string,
  week: StructuredWeek,
  progress: ProgramProgressState,
): number {
  const days = progress[programId]?.[week.id] ?? {}
  return week.days.filter(d => !isSettled(days[d.id])).length
}

export function countDoneWeeks(program: StructuredProgram, progress: ProgramProgressState): number {
  return program.weeks.filter(w => isWeekDone(program.id, w, progress)).length
}

export interface ProgramProgress {
  doneDays: number
  skippedDays: number
  totalDays: number
  doneWeeks: number
  totalWeeks: number
  pct: number
}

// How far through a program the user actually is. Measured in DAYS: counting
// finished weeks reports 0% forever for anyone who skips one day a week, which
// is most people — the work was done, the number just never moved.
export function programProgress(
  program: StructuredProgram,
  progress: ProgramProgressState,
): ProgramProgress {
  let doneDays = 0
  let skippedDays = 0
  let totalDays = 0
  for (const week of program.weeks) {
    doneDays += doneDaysInWeek(program.id, week, progress)
    skippedDays += skippedDaysInWeek(program.id, week, progress)
    totalDays += week.days.length
  }
  return {
    doneDays,
    skippedDays,
    totalDays,
    doneWeeks: countDoneWeeks(program, progress),
    totalWeeks: program.weeks.length,
    // Skipped days never count here — the bar reports training done, not boxes
    // ticked, so a finished program that skipped days lands under 100%.
    pct: totalDays ? Math.round((doneDays / totalDays) * 100) : 0,
  }
}

// Highest week POSITION the user has touched at all (any day off not_started);
// 0 when the program has never been started. This is "which week am I on" for
// display — unlike doneWeeks + 1, one unfinished day doesn't freeze it at week 1.
export function reachedWeekNum(program: StructuredProgram, progress: ProgramProgressState): number {
  let reached = 0
  program.weeks.forEach((w, i) => {
    if (weekStatus(program.id, w, progress) !== 'not_started') reached = i + 1
  })
  return reached
}

export function hasStarted(program: StructuredProgram, progress: ProgramProgressState): boolean {
  const byWeek = progress[program.id] ?? {}
  return Object.values(byWeek).some(week => Object.values(week).some(s => s !== 'not_started'))
}

export function getProgramStatus(
  program: StructuredProgram,
  config: ProgramConfig | null | undefined,
  meta: ProgramMeta | undefined,
  progress: ProgramProgressState,
): ProgramStatus {
  if (program.totalWeeks > 0 && countDoneWeeks(program, progress) === program.totalWeeks) return 'completed'
  if (meta?.paused) return 'paused'
  // Weekly routines never get a config (useProgramStore drops it), so they only
  // read as active once something has actually been logged against them.
  if (config || (program.weekly && hasStarted(program, progress))) return 'active'
  return 'not_setup'
}

// Session.programId is the composite `programId/weekId/dayId` minted by
// dayToProgram(); quick sessions carry a bare single-segment id.
export function lastPlayedAt(programId: string, history: Session[]): number {
  for (const s of history) {
    if (s.programId.split('/')[0] !== programId) continue
    const t = Date.parse(s.date)
    if (!Number.isNaN(t)) return t
  }
  return 0
}

// Newest interaction of any kind: trained, edited, or set up. Used for list order.
export function programRecency(
  program: StructuredProgram,
  meta: ProgramMeta | undefined,
  history: Session[],
): number {
  return Math.max(lastPlayedAt(program.id, history), meta?.updatedAt ?? 0, meta?.activatedAt ?? 0)
}

// Newest sign that the user is actually RUNNING this program — trained it, or
// deliberately set it up / resumed it. Editing deliberately doesn't count: tweaking
// a program you aren't training shouldn't take over the Dashboard.
export function programActivity(
  programId: string,
  meta: ProgramMeta | undefined,
  history: Session[],
): number {
  return Math.max(lastPlayedAt(programId, history), meta?.activatedAt ?? 0)
}

// Favourites pinned on top, then most-recently-touched, then name so the order
// stays stable across reloads (the cloud hydrate returns rows unordered).
export function sortPrograms(
  programs: StructuredProgram[],
  metas: ProgramMetaState,
  history: Session[],
): StructuredProgram[] {
  return [...programs].sort((a, b) => {
    const favA = metas[a.id]?.favorite ? 1 : 0
    const favB = metas[b.id]?.favorite ? 1 : 0
    if (favA !== favB) return favB - favA
    const recA = programRecency(a, metas[a.id], history)
    const recB = programRecency(b, metas[b.id], history)
    if (recA !== recB) return recB - recA
    return a.name.localeCompare(b.name)
  })
}

// Pick the program the Dashboard should show. Deliberately includes paused
// programs: pausing must not silently promote a different program — the user
// sees a "paused" card until they set up a new one (which stamps activatedAt).
export function pickCurrentProgramId(
  programs: StructuredProgram[],
  configs: { [programId: string]: ProgramConfig },
  metas: ProgramMetaState,
  progress: ProgramProgressState,
  history: Session[],
): string | null {
  // Config-only, matching the Dashboard's existing scope — weekly routines have
  // no config and still can't drive the current-week card (see log.md round 24).
  const candidates = programs.filter(p => {
    if (!configs[p.id]) return false
    return !(p.totalWeeks > 0 && countDoneWeeks(p, progress) === p.totalWeeks)
  })
  if (!candidates.length) return null

  const active = candidates
    .map(p => ({ p, at: programActivity(p.id, metas[p.id], history) }))
    .filter(x => x.at > 0)
  if (active.length) {
    return active.reduce((best, x) => (x.at > best.at ? x : best)).p.id
  }
  // Pre-existing users have neither a session nor activatedAt — keep the old
  // behaviour (first configured program in insertion order) so nothing shifts.
  for (const programId of Object.keys(configs)) {
    const found = candidates.find(p => p.id === programId)
    if (found) return found.id
  }
  return candidates[0]!.id
}

// Where the plan's dates say you should be. Local midnight on both sides —
// new Date('2026-08-18') is UTC, so comparing it to a local now shifts the
// rollover to 07:00 in Bangkok (see utils.dateFromYMD).
export function scheduledWeekNum(startDate: string, totalWeeks: number, now: Date): number {
  const start = dateFromYMD(startDate)
  if (Number.isNaN(start.getTime())) return 1
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.round((today.getTime() - start.getTime()) / 86400000)
  return Math.min(Math.max(Math.floor(days / 7) + 1, 1), Math.max(totalWeeks, 1))
}

// Training weeks run Mon–Sat (StructuredDay.dayOfWeek has no 'Sun'), so Sunday
// belongs to the week that just ended — otherwise the card jumps on Sunday morning.
function startOfTrainingWeek(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

// Highest week POSITION actually trained since `sinceMs`. Same composite-id parse
// as lastPlayedAt. Every 'done' day has a session (useAppStore writes both on
// finish), so this is the only signal that says which week you're really on.
export function trainedWeekNumSince(
  program: StructuredProgram,
  history: Session[],
  sinceMs: number,
): number {
  const posByWeekId = new Map(program.weeks.map((w, i) => [w.id, i + 1]))
  let best = 0
  for (const s of history) {
    const [pid, weekId] = s.programId.split('/')
    if (pid !== program.id || !weekId) continue
    const t = Date.parse(s.date)
    if (Number.isNaN(t) || t < sinceMs) continue
    best = Math.max(best, posByWeekId.get(weekId) ?? 0)
  }
  return best
}

export interface ActiveWeek {
  week: StructuredWeek
  weekNum: number
  scheduledWeekNum: number
  weeksBehind: number
  doneWeeks: number
  leftovers: { week: StructuredWeek; weekNum: number; remaining: number }[]
}

// The week Home shows. Calendar-driven, but never past a week the user has
// actually reached — a program set up 5 weeks ago and never trained still shows
// W1 rather than jumping into its peaking block (log.md round 38). Weeks left
// unfinished behind it come back as `leftovers` instead of pinning the card.
export function pickActiveWeek(
  program: StructuredProgram,
  progress: ProgramProgressState,
  config: ProgramConfig,
  history: Session[],
  now: Date = new Date(),
): ActiveWeek | null {
  const total = program.weeks.length
  if (!total) return null

  let firstUnfinished = total
  for (let i = 0; i < total; i++) {
    const w = program.weeks[i]!
    // An empty week can never be done, so it must not pin the card forever.
    if (w.days.length > 0 && !isWeekDone(program.id, w, progress)) {
      firstUnfinished = i + 1
      break
    }
  }

  // Trained this calendar week → that's the week you're on, and you only move up
  // once it's finished. Otherwise the ceiling is one past whatever you've touched.
  const lastTouched = reachedWeekNum(program, progress)
  const trained = trainedWeekNumSince(program, history, startOfTrainingWeek(now).getTime())
  const ceiling = trained > 0
    ? trained + (isWeekDone(program.id, program.weeks[trained - 1]!, progress) ? 1 : 0)
    : lastTouched + 1

  const scheduled = scheduledWeekNum(config.startDate, total, now)
  const weekNum = Math.min(Math.max(firstUnfinished, Math.min(scheduled, ceiling)), total)
  const week = program.weeks[weekNum - 1]
  if (!week) return null

  const leftovers = program.weeks.slice(0, weekNum - 1)
    .map((w, i) => ({ week: w, weekNum: i + 1, remaining: remainingDays(program.id, w, progress) }))
    .filter(x => x.remaining > 0)

  return {
    week,
    weekNum,
    scheduledWeekNum: scheduled,
    weeksBehind: scheduled - weekNum,
    doneWeeks: countDoneWeeks(program, progress),
    leftovers,
  }
}

export interface DayRefTarget {
  program: StructuredProgram
  week: StructuredWeek
  weekNum: number
  day: StructuredDay
}

// `programId/weekId/dayId` — the same composite dayToProgram() stamps onto a
// Workout/Session, reused so a logged run can point back at the day it was
// prescribed for. Ids are opaque, so callers going into a URL must encode it.
export function dayRef(programId: string, weekId: string, dayId: string): string {
  return `${programId}/${weekId}/${dayId}`
}

// Resolve a dayRef against the programs the user actually has. Returns null for
// a malformed ref and for one whose ids no longer exist — a program can be
// deleted, re-imported, or edited (updateCustomProgram prunes day ids), and a
// run stored before that must not resurrect a day that is gone.
export function resolveDayRef(
  ref: string | undefined | null,
  programs: StructuredProgram[],
): DayRefTarget | null {
  const parts = (ref ?? '').split('/')
  if (parts.length !== 3) return null
  const [programId, weekId, dayId] = parts
  const program = programs.find(p => p.id === programId)
  if (!program) return null
  const weekIdx = program.weeks.findIndex(w => w.id === weekId)
  if (weekIdx < 0) return null
  const week = program.weeks[weekIdx]!
  const day = week.days.find(d => d.id === dayId)
  if (!day) return null
  return { program, week, weekNum: weekIdx + 1, day }
}


const DAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

// The calendar date a program day falls on. Weeks are 7-day blocks counted from
// startDate (same arithmetic as scheduledWeekNum and the week ranges shown on the
// overview page), and every weekday name appears exactly once inside a block —
// so the mapping is unambiguous even when startDate isn't a Monday.
export function dayDate(startDate: string, weekNumber: number, dayOfWeek: string): Date | null {
  const start = dateFromYMD(startDate)
  if (Number.isNaN(start.getTime())) return null
  const target = DAY_INDEX[dayOfWeek]
  if (target === undefined) return null
  start.setDate(start.getDate() + (weekNumber - 1) * 7)
  start.setDate(start.getDate() + ((target - start.getDay() + 7) % 7))
  return start
}

// Has this day already gone by? Local midnight on both sides (see dateFromYMD).
// Today is NOT past — there's still time to train it.
export function isDayPast(
  startDate: string,
  weekNumber: number,
  dayOfWeek: string,
  now: Date = new Date(),
): boolean {
  const d = dayDate(startDate, weekNumber, dayOfWeek)
  if (!d) return false
  return d < new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

// One source for the day badge, which three pages render identically (Week days,
// week rows on the overview, the week header) — adding 'skipped' to a copy in
// each was what surfaced the duplication.
export const DAY_STATUS_STYLE: Record<
  DayStatus,
  { label: string; bg: string; border: string; color: string }
> = {
  not_started: { label: 'Not started', bg: 'var(--surface-2)',       border: 'var(--border)',           color: 'var(--muted)' },
  in_progress: { label: 'In progress', bg: 'rgba(212,255,58,0.12)',  border: 'rgba(212,255,58,0.35)',   color: 'var(--accent)' },
  done:        { label: 'Done',        bg: 'rgba(74,222,128,0.1)',   border: 'rgba(74,222,128,0.3)',    color: '#4ade80' },
  skipped:     { label: 'Skipped',     bg: 'var(--surface-2)',       border: 'var(--border-strong)',    color: 'var(--text-2)' },
}

// Left edge of a day/week card, keyed off the same status.
export const DAY_STATUS_EDGE: Record<DayStatus, string> = {
  not_started: 'var(--surface-3)',
  in_progress: 'var(--accent)',
  done: '#4ade80',
  skipped: 'var(--border-strong)',
}

export const PROGRAM_STATUS_STYLE: Record<
  Exclude<ProgramStatus, 'not_setup'>,
  { label: string; color: string; bg: string; border: string }
> = {
  active:    { label: 'ACTIVE',    color: '#4ade80', bg: 'rgba(74,222,128,0.15)',  border: 'rgba(74,222,128,0.4)' },
  paused:    { label: 'PAUSED',    color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.4)' },
  completed: { label: 'COMPLETED', color: 'var(--muted)', bg: 'var(--surface-2)',  border: 'var(--border)' },
}
