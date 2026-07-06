import type { StructuredExercise, ProgramOneRMs } from '@atlaslog/shared'

// Standard RPE chart (Tuchscherer / RTS)
// Rows = reps 1–10, Cols = RPE 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0
const RPE_COLS = [6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0]

const RPE_TABLE: number[][] = [
  [78.6, 82.4, 85.7, 88.5, 91.0, 93.9, 95.5, 97.8, 100.0], // 1 rep
  [75.1, 79.0, 82.0, 84.7, 87.3, 90.7, 92.2, 94.7, 97.8],  // 2 reps
  [71.4, 75.1, 78.2, 81.1, 83.7, 87.8, 89.2, 91.3, 95.5],  // 3 reps
  [68.0, 71.4, 74.6, 77.8, 80.7, 85.0, 86.3, 87.8, 93.9],  // 4 reps
  [64.5, 68.0, 71.1, 74.4, 77.4, 82.4, 83.7, 85.0, 92.2],  // 5 reps
  [60.2, 64.5, 67.8, 71.1, 74.4, 79.9, 81.1, 82.4, 90.7],  // 6 reps
  [55.4, 60.2, 64.4, 67.8, 71.1, 77.4, 78.6, 79.9, 89.2],  // 7 reps
  [50.4, 55.4, 60.5, 64.4, 67.8, 75.1, 76.2, 77.4, 87.8],  // 8 reps
  [44.2, 50.4, 56.0, 60.5, 64.5, 72.3, 73.9, 75.1, 86.3],  // 9 reps
  [38.4, 44.2, 51.2, 56.0, 60.5, 69.4, 71.4, 72.3, 85.0],  // 10 reps
]

function getRpePct(reps: number, rpe: number): number {
  const repsIdx = Math.min(Math.max(reps, 1), 10) - 1
  const rpeIdx = RPE_COLS.findIndex(r => Math.abs(r - rpe) < 0.01)
  if (rpeIdx === -1) {
    // Interpolate between nearest RPE columns
    const lower = RPE_COLS.filter(r => r < rpe).pop()
    const upper = RPE_COLS.find(r => r > rpe)
    if (lower === undefined) return RPE_TABLE[repsIdx][0]
    if (upper === undefined) return RPE_TABLE[repsIdx][RPE_COLS.length - 1]
    const li = RPE_COLS.indexOf(lower)
    const ui = RPE_COLS.indexOf(upper)
    const t = (rpe - lower) / (upper - lower)
    return RPE_TABLE[repsIdx][li] + t * (RPE_TABLE[repsIdx][ui] - RPE_TABLE[repsIdx][li])
  }
  return RPE_TABLE[repsIdx][rpeIdx]
}

// Returns working weight rounded to nearest 2.5 kg
export function calcWeight(oneRM: number, reps: number, rpe: number): number {
  if (!oneRM || oneRM <= 0) return 0
  const pct = getRpePct(reps, rpe) / 100
  const raw = oneRM * pct
  return Math.round(raw / 2.5) * 2.5
}

// Maps an exercise id to its SBD lift key (only the three main lifts have 1RMs).
export const SBD_IDS: Record<string, keyof ProgramOneRMs> = {
  squat: 'squat', bench: 'bench', deadlift: 'deadlift',
}

// Working weight for a structured exercise given the lifter's 1RMs. Returns null
// when it isn't an SBD lift, no 1RM is set, or there's no %/RPE to calc from.
// Shared by the Week view and the Dashboard "Today's session" card.
export function structuredWeight(ex: StructuredExercise, oneRMs: ProgramOneRMs | null): number | null {
  if (!oneRMs) return null
  const liftKey = SBD_IDS[ex.exerciseId]
  if (!liftKey) return null
  const rm = oneRMs[liftKey]
  if (!rm) return null
  if (ex.pct !== undefined) return Math.round(rm * ex.pct / 2.5) * 2.5
  if (ex.rpe === undefined || typeof ex.reps !== 'number') return null
  return calcWeight(rm, ex.reps, ex.rpe)
}
