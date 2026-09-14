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

export const MULTI_PROGRAM_ID = 'custom-multi'

// Six plain lifting weeks, two days each. Enough to exercise the week-picking
// rules (pickActiveWeek clamps between a calendar week and the weeks actually
// reached), which makeRunProgram's single week cannot express.
export function makeMultiWeekProgram(): StructuredProgram {
  return {
    id: MULTI_PROGRAM_ID,
    name: 'Six Week Block',
    description: '',
    totalWeeks: 6,
    daysPerWeek: 2,
    focus: '',
    isCustom: true,
    weeks: Array.from({ length: 6 }, (_, i) => ({
      id: `week-${i + 1}`,
      weekNumber: i + 1,
      phase: 'Accumulation',
      days: [
        {
          id: `w${i + 1}-mon`,
          dayOfWeek: 'Mon',
          focus: 'Squat',
          exercises: [{ exerciseId: 'squat', name: 'Squat', type: 'main' as const, sets: 3, reps: 5, pct: 0.75 }],
        },
        {
          id: `w${i + 1}-thu`,
          dayOfWeek: 'Thu',
          focus: 'Bench',
          exercises: [{ exerciseId: 'bench', name: 'Bench Press', type: 'main' as const, sets: 3, reps: 5, pct: 0.7 }],
        },
      ],
    })),
  }
}
