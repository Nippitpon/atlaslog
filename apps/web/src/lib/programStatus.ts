import type {
  ProgramMeta, ProgramMetaState, ProgramProgressState, ProgramConfig,
  Session, StructuredProgram,
} from '@atlaslog/shared'

export type ProgramStatus = 'not_setup' | 'active' | 'paused' | 'completed'

// A week counts as done only when EVERY day in it is done. The Programs page
// used to derive this from the recorded keys alone (`every(s => s === 'done')`),
// which marks a 4-day week done once its first logged day is done.
export function countDoneWeeks(program: StructuredProgram, progress: ProgramProgressState): number {
  const byWeek = progress[program.id] ?? {}
  return program.weeks.filter(w => {
    const days = byWeek[w.id] ?? {}
    return w.days.length > 0 && w.days.every(d => days[d.id] === 'done')
  }).length
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

export const PROGRAM_STATUS_STYLE: Record<
  Exclude<ProgramStatus, 'not_setup'>,
  { label: string; color: string; bg: string; border: string }
> = {
  active:    { label: 'ACTIVE',    color: '#4ade80', bg: 'rgba(74,222,128,0.15)',  border: 'rgba(74,222,128,0.4)' },
  paused:    { label: 'PAUSED',    color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.4)' },
  completed: { label: 'COMPLETED', color: 'var(--muted)', bg: 'var(--surface-2)',  border: 'var(--border)' },
}
