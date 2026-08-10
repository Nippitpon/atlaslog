import type { StructuredDay, StructuredExercise } from '@atlaslog/shared'

// Stable identity for one row of a training day. Imported/manual programs carry a
// per-row `id`, but the built-in 12-week program builds bare objects — fall back to
// exerciseId + name + original index so two rows of the same lift never collide.
export function dayRowKey(ex: StructuredExercise, i: number): string {
  return ex.id ?? `${ex.exerciseId}|${ex.name}|${i}`
}

const withKey = (ex: StructuredExercise, i: number): StructuredExercise =>
  ex.id ? ex : { ...ex, id: dayRowKey(ex, i) }

// Does the row a saved layout points at still hold the same lift? Guards against
// an id that was re-minted onto a different exercise: without this the stored
// order would silently shuffle instead of falling back. `exerciseId` alone is not
// enough — a top set and its back-off share one.
const sameRow = (a: StructuredExercise, b: StructuredExercise): boolean =>
  a.exerciseId === b.exerciseId && a.name === b.name && (a.label ?? '') === (b.label ?? '')

// Merge a day's program rows with the user's saved layout for that day.
//
// The saved array is either legacy (accessories only — written before free
// ordering existed) or a full ordering that includes `main` rows. Mains are
// always re-read from the program by key, so later edits to sets/pct/rpe still
// flow through and only the ordering comes from storage.
//
// Running rows are excluded — they're logged on /runs and rendered separately.
export function resolveDayExercises(
  day: StructuredDay,
  stored: StructuredExercise[] | null,
): StructuredExercise[] {
  const mainsByKey = new Map<string, StructuredExercise>()
  day.exercises.forEach((ex, i) => {
    if (ex.type === 'main') mainsByKey.set(dayRowKey(ex, i), withKey(ex, i))
  })

  if (!stored) {
    return day.exercises.filter(e => e.type !== 'running').map(withKey)
  }

  const accessories = stored
    .filter(e => e.type !== 'main' && e.type !== 'running')
    .map((ex, i) => ex.id ? ex : { ...ex, id: `acc-${i}-${ex.exerciseId}` })

  // Legacy payload: no main rows → keep the old "mains first, then accessories".
  if (!stored.some(e => e.type === 'main')) {
    return [...mainsByKey.values(), ...accessories]
  }

  const used = new Set<string>()
  const ordered: StructuredExercise[] = []
  let accIdx = 0
  stored.forEach(row => {
    if (row.type === 'running') return
    if (row.type !== 'main') { ordered.push(accessories[accIdx++]); return }
    const live = row.id ? mainsByKey.get(row.id) : undefined
    if (live && sameRow(live, row) && !used.has(row.id!)) {
      used.add(row.id!)
      ordered.push(live)
    }
  })
  // Mains added to the program after this layout was saved — and any whose id no
  // longer resolves to the same lift — land at the end in program order.
  mainsByKey.forEach((ex, key) => { if (!used.has(key)) ordered.push(ex) })
  return ordered
}
