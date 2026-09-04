import type { StructuredProgram } from '@atlaslog/shared'

export const RUN_PROGRAM_ID = 'custom-test'
export const RUN_WEEK_ID = 'w1'
export const RUN_DAY_ID = 'day-run'
export const MIXED_DAY_ID = 'day-mixed'

// One week holding the two shapes the run→day-status rules distinguish: a day
// whose only prescription is a run (nothing the set logger can take, so logging
// the run is the only thing that can finish it) and a day that also lifts.
export function makeRunProgram(): StructuredProgram {
  return {
    id: RUN_PROGRAM_ID,
    name: 'Test Program',
    description: '',
    totalWeeks: 1,
    daysPerWeek: 2,
    focus: '',
    isCustom: true,
    weeks: [{
      id: RUN_WEEK_ID,
      weekNumber: 1,
      phase: 'Accumulation',
      days: [
        {
          id: RUN_DAY_ID,
          dayOfWeek: 'Wed',
          focus: 'Easy Run',
          exercises: [
            { exerciseId: 'running', name: 'Easy Run', type: 'running', distanceKm: 5, durationMin: 30 },
          ],
        },
        {
          id: MIXED_DAY_ID,
          dayOfWeek: 'Thu',
          focus: 'Bench + Run',
          exercises: [
            { exerciseId: 'bench', name: 'Bench Press', type: 'main', sets: 3, reps: 5, pct: 0.7 },
            { exerciseId: 'running', name: 'Cooldown Run', type: 'running', distanceKm: 3 },
          ],
        },
      ],
    }],
  }
}
