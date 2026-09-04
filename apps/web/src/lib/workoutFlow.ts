import type { Workout } from '@atlaslog/shared'

export type StartAction = 'start' | 'resume' | 'confirm'

// What tapping Start/Continue/Redo should do while another workout is unfinished.
// startWorkout replaces the active workout outright, so without this the sets
// already logged are gone with no warning and no way back to them.
//
// A workout's programId is either the composite `programId/weekId/dayId` that
// dayToProgram stamps, or the plain id of a Quick Session / built-in program —
// both compare directly, so the same day resumes and anything else asks first.
export function resolveStartAction(current: Workout | null, nextProgramId: string): StartAction {
  if (!current) return 'start'
  return current.programId === nextProgramId ? 'resume' : 'confirm'
}

// Sets ticked off / sets prescribed — what the resume bar counts, and the same
// arithmetic the logger header shows.
export function workoutSetProgress(workout: Workout): { done: number; total: number } {
  return {
    done: workout.exercises.reduce((s, e) => s + e.sets.filter(x => x.done).length, 0),
    total: workout.exercises.reduce((s, e) => s + e.sets.length, 0),
  }
}
