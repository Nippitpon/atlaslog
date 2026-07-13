import type { StructuredDay, StructuredExercise, StructuredProgram, StructuredWeek, ProgramPhase } from '@atlaslog/shared'
import type { Program } from '@atlaslog/shared'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function e(
  exerciseId: string, name: string, type: 'main' | 'accessory',
  sets: number, reps: number, pct: number, rpe: number, note?: string,
): StructuredExercise {
  return { exerciseId, name, type, sets, reps, pct, rpe, note }
}

function mon(exs: StructuredExercise[], focus = 'Squat Focus'): StructuredDay {
  return { id: 'day-1', dayOfWeek: 'Mon', focus, exercises: exs }
}
function tue(exs: StructuredExercise[], focus = 'Bench Focus'): StructuredDay {
  return { id: 'day-2', dayOfWeek: 'Tue', focus, exercises: exs }
}
function thu(exs: StructuredExercise[]): StructuredDay {
  return { id: 'day-3', dayOfWeek: 'Thu', focus: 'Bench Volume', exercises: exs }
}
function sat(exs: StructuredExercise[], focus = 'Deadlift Focus'): StructuredDay {
  return { id: 'day-4', dayOfWeek: 'Sat', focus, exercises: exs }
}
function wk(n: number, phase: ProgramPhase, days: StructuredDay[]): StructuredWeek {
  return { id: `week-${n}`, weekNumber: n, phase, days }
}

// ─── 12-Week Program Data (from Excel Template) ───────────────────────────────
// Structure: Mon=Squat+SpeedBench+DLVol, Tue=Bench, Thu=BenchVol, Sat=DL+SquatVol

const WEEKS: StructuredWeek[] = [
  // ── Week 1 — Accumulation ────────────────────────────────────────────────────
  wk(1, 'Accumulation', [
    mon([
      e('squat',    'Back Squat',           'main',      1, 5, 0.75,  7),
      e('squat',    'Back Squat Back-off',  'main',      4, 5, 0.70,  6),
      e('bench',    'Speed Bench',          'accessory', 8, 3, 0.70,  6),
      e('deadlift', 'Deadlift Volume',      'accessory', 3, 6, 0.70,  7),
    ]),
    tue([
      e('bench', 'Bench Press',          'main', 1, 5, 0.75, 7),
      e('bench', 'Bench Press Back-off', 'main', 4, 5, 0.70, 6),
    ]),
    thu([
      e('bench', 'Bench Volume', 'accessory', 4, 8, 0.70, 7),
    ]),
    sat([
      e('deadlift', 'Deadlift',           'main',      1, 5, 0.75, 7),
      e('deadlift', 'Deadlift Back-off',  'main',      3, 5, 0.70, 6),
      e('squat',    'Squat Volume',       'accessory', 4, 6, 0.70, 7),
    ]),
  ]),

  // ── Week 2 — Accumulation ────────────────────────────────────────────────────
  wk(2, 'Accumulation', [
    mon([
      e('squat',    'Back Squat',           'main',      1, 5, 0.775, 7.5),
      e('squat',    'Back Squat Back-off',  'main',      4, 5, 0.725, 6.5),
      e('bench',    'Speed Bench',          'accessory', 8, 3, 0.725, 6.5),
      e('deadlift', 'Deadlift Volume',      'accessory', 4, 6, 0.70,  7.5),
    ]),
    tue([
      e('bench', 'Bench Press',          'main', 1, 5, 0.775, 7.5),
      e('bench', 'Bench Press Back-off', 'main', 4, 5, 0.725, 6.5),
    ]),
    thu([
      e('bench', 'Bench Volume', 'accessory', 5, 8, 0.70, 7.5),
    ]),
    sat([
      e('deadlift', 'Deadlift',          'main',      1, 5, 0.775, 7.5),
      e('deadlift', 'Deadlift Back-off', 'main',      3, 5, 0.725, 6.5),
      e('squat',    'Squat Volume',      'accessory', 5, 6, 0.725, 7.5),
    ]),
  ]),

  // ── Week 3 — Accumulation ────────────────────────────────────────────────────
  wk(3, 'Accumulation', [
    mon([
      e('squat',    'Back Squat',           'main',      1,  4, 0.80, 8),
      e('squat',    'Back Squat Back-off',  'main',      4,  4, 0.75, 7),
      e('bench',    'Speed Bench',          'accessory', 10, 2, 0.75, 7),
      e('deadlift', 'Deadlift Volume',      'accessory', 4,  5, 0.75, 8),
    ]),
    tue([
      e('bench', 'Bench Press',          'main', 1, 4, 0.80, 8),
      e('bench', 'Bench Press Back-off', 'main', 4, 4, 0.75, 7),
    ]),
    thu([
      e('bench', 'Bench Volume', 'accessory', 5, 6, 0.75, 8),
    ]),
    sat([
      e('deadlift', 'Deadlift',          'main',      1, 4, 0.80, 8),
      e('deadlift', 'Deadlift Back-off', 'main',      3, 4, 0.75, 7),
      e('squat',    'Squat Volume',      'accessory', 5, 5, 0.75, 8),
    ]),
  ]),

  // ── Week 4 — Accumulation Deload ─────────────────────────────────────────────
  wk(4, 'Accumulation', [
    mon([
      e('squat',    'Back Squat',           'main',      1, 5, 0.725, 6.5),
      e('squat',    'Back Squat Back-off',  'main',      2, 5, 0.65,  5.5),
      e('bench',    'Speed Bench',          'accessory', 6, 3, 0.65,  6),
      e('deadlift', 'Deadlift Volume',      'accessory', 2, 6, 0.65,  6),
    ]),
    tue([
      e('bench', 'Bench Press',          'main', 1, 5, 0.725, 6.5),
      e('bench', 'Bench Press Back-off', 'main', 2, 5, 0.65,  5.5),
    ]),
    thu([
      e('bench', 'Bench Volume', 'accessory', 3, 8, 0.65, 6),
    ]),
    sat([
      e('deadlift', 'Deadlift',          'main',      1, 4, 0.725, 6.5),
      e('deadlift', 'Deadlift Back-off', 'main',      2, 4, 0.65,  5.5),
      e('squat',    'Squat Volume',      'accessory', 3, 6, 0.65,  6),
    ]),
  ]),

  // ── Week 5 — Intensification ─────────────────────────────────────────────────
  wk(5, 'Intensification', [
    mon([
      e('squat',    'Back Squat',           'main',      1, 3, 0.85, 8),
      e('squat',    'Back Squat Back-off',  'main',      3, 3, 0.80, 7.5),
      e('bench',    'Speed Bench',          'accessory', 8, 3, 0.75, 6.5),
      e('deadlift', 'Deadlift Volume',      'accessory', 3, 4, 0.80, 8),
    ]),
    tue([
      e('bench', 'Bench Press',          'main', 1, 3, 0.85, 8),
      e('bench', 'Bench Press Back-off', 'main', 4, 3, 0.80, 7.5),
    ]),
    thu([
      e('bench', 'Bench Volume', 'accessory', 4, 5, 0.80, 8),
    ]),
    sat([
      e('deadlift', 'Deadlift',          'main',      1, 3, 0.85, 8),
      e('deadlift', 'Deadlift Back-off', 'main',      3, 3, 0.80, 7.5),
      e('squat',    'Squat Volume',      'accessory', 4, 4, 0.80, 8),
    ]),
  ]),

  // ── Week 6 — Intensification ─────────────────────────────────────────────────
  wk(6, 'Intensification', [
    mon([
      e('squat',    'Back Squat',           'main',      1, 2, 0.88,  8.5),
      e('squat',    'Back Squat Back-off',  'main',      3, 2, 0.83,  8),
      e('bench',    'Speed Bench',          'accessory', 8, 2, 0.775, 7),
      e('deadlift', 'Deadlift Volume',      'accessory', 3, 3, 0.825, 8.5),
    ]),
    tue([
      e('bench', 'Bench Press',          'main', 1, 2, 0.88, 8.5),
      e('bench', 'Bench Press Back-off', 'main', 4, 2, 0.83, 8),
    ]),
    thu([
      e('bench', 'Bench Volume', 'accessory', 5, 4, 0.825, 8.5),
    ]),
    sat([
      e('deadlift', 'Deadlift',          'main',      1, 2, 0.88,  8.5),
      e('deadlift', 'Deadlift Back-off', 'main',      3, 2, 0.83,  8),
      e('squat',    'Squat Volume',      'accessory', 4, 3, 0.825, 8.5),
    ]),
  ]),

  // ── Week 7 — Intensification ─────────────────────────────────────────────────
  wk(7, 'Intensification', [
    mon([
      e('squat',    'Back Squat',           'main',      1, 1, 0.90,  9),
      e('squat',    'Back Squat Back-off',  'main',      3, 2, 0.85,  8),
      e('bench',    'Speed Bench',          'accessory', 6, 2, 0.80,  7.5),
      e('deadlift', 'Deadlift Volume',      'accessory', 3, 3, 0.825, 8),
    ]),
    tue([
      e('bench', 'Bench Press',          'main', 1, 1, 0.90, 9),
      e('bench', 'Bench Press Back-off', 'main', 4, 2, 0.85, 8),
    ]),
    thu([
      e('bench', 'Bench Volume', 'accessory', 4, 3, 0.85, 8.8),
    ]),
    sat([
      e('deadlift', 'Deadlift',          'main',      1, 1, 0.90,  9),
      e('deadlift', 'Deadlift Back-off', 'main',      3, 2, 0.85,  8),
      e('squat',    'Squat Volume',      'accessory', 3, 3, 0.825, 8),
    ]),
  ]),

  // ── Week 8 — Intensification Deload ──────────────────────────────────────────
  wk(8, 'Intensification', [
    mon([
      e('squat',    'Back Squat',       'main',      3, 3, 0.80, 7.5),
      e('bench',    'Speed Bench',      'accessory', 6, 3, 0.70, 6),
      e('deadlift', 'Deadlift Volume',  'accessory', 2, 4, 0.75, 7),
    ]),
    tue([
      e('bench', 'Bench Press', 'main', 3, 3, 0.80, 7.5),
    ]),
    thu([
      e('bench', 'Bench Volume', 'accessory', 3, 5, 0.75, 7),
    ]),
    sat([
      e('deadlift', 'Deadlift',     'main',      2, 3, 0.80, 7.5),
      e('squat',    'Squat Volume', 'accessory', 3, 4, 0.75, 7),
    ]),
  ]),

  // ── Week 9 — Peaking ─────────────────────────────────────────────────────────
  wk(9, 'Peaking', [
    mon([
      e('squat',    'Back Squat',           'main',      1, 1, 0.88, 8.5),
      e('squat',    'Back Squat Back-off',  'main',      2, 2, 0.85, 8),
      e('bench',    'Speed Bench',          'accessory', 6, 2, 0.75, 6.5),
      e('deadlift', 'Deadlift Volume',      'accessory', 2, 2, 0.85, 8.5),
    ]),
    tue([
      e('bench', 'Bench Press',          'main', 1, 1, 0.88, 8.5),
      e('bench', 'Bench Press Back-off', 'main', 3, 2, 0.85, 8),
    ]),
    thu([
      e('bench', 'Bench Volume', 'accessory', 4, 3, 0.85, 8.5),
    ]),
    sat([
      e('deadlift', 'Deadlift',          'main',      1, 1, 0.88, 8.5),
      e('deadlift', 'Deadlift Back-off', 'main',      2, 2, 0.85, 8),
      e('squat',    'Squat Volume',      'accessory', 3, 2, 0.85, 8.5),
    ]),
  ]),

  // ── Week 10 — Peaking ────────────────────────────────────────────────────────
  wk(10, 'Peaking', [
    mon([
      e('squat',    'Back Squat',           'main',      1, 1, 0.92,  9.3),
      e('squat',    'Back Squat Back-off',  'main',      2, 1, 0.88,  8.5),
      e('bench',    'Speed Bench',          'accessory', 5, 2, 0.75,  6.5),
      e('deadlift', 'Deadlift Volume',      'accessory', 2, 2, 0.825, 8),
    ]),
    tue([
      e('bench', 'Bench Press',          'main', 1, 1, 0.92, 9.3),
      e('bench', 'Bench Press Back-off', 'main', 3, 1, 0.88, 8.5),
    ]),
    thu([
      e('bench', 'Bench Volume', 'accessory', 3, 2, 0.87, 9),
    ]),
    sat([
      e('deadlift', 'Deadlift',          'main',      1, 1, 0.91, 9),
      e('deadlift', 'Deadlift Back-off', 'main',      2, 1, 0.87, 8.5),
      e('squat',    'Squat Volume',      'accessory', 2, 2, 0.85, 8.5),
    ]),
  ]),

  // ── Week 11 — Peaking ────────────────────────────────────────────────────────
  wk(11, 'Peaking', [
    mon([
      e('squat',    'Back Squat (Optional)', 'main',      1, 1, 0.92, 9.2),
      e('squat',    'Squat Opener',          'main',      2, 1, 0.90, 8.8),
      e('bench',    'Speed Bench',           'accessory', 4, 2, 0.70, 6),
      e('deadlift', 'Deadlift Volume',       'accessory', 2, 2, 0.75, 7),
    ]),
    tue([
      e('bench', 'Bench Press (Optional)', 'main', 1, 1, 0.92, 9.2),
      e('bench', 'Bench Opener',           'main', 2, 1, 0.90, 8.8),
    ]),
    thu([
      e('bench', 'Bench Volume', 'accessory', 3, 3, 0.75, 7),
    ]),
    sat([
      e('deadlift', 'Deadlift Opener', 'main',      2, 1, 0.88, 8.8),
      e('squat',    'Squat Volume',    'accessory', 2, 2, 0.75, 7),
    ]),
  ]),

  // ── Week 12 — Taper / Test ───────────────────────────────────────────────────
  wk(12, 'Taper', [
    mon([
      e('squat',    'Back Squat',          'main',      3, 2, 0.65,  6),
      e('bench',    'Speed Bench',         'accessory', 4, 3, 0.625, 6),
      e('deadlift', 'Deadlift – Attempt 1','main',      1, 1, 0.90,  8),
      e('deadlift', 'Deadlift – Attempt 2','main',      1, 1, 0.97,  9),
      e('deadlift', 'Deadlift – Attempt 3','main',      1, 1, 1.02,  9.5),
    ], 'Taper + DL Test'),
    tue([
      e('bench', 'Bench Press', 'main', 3, 2, 0.70, 6.5),
    ]),
    thu([
      e('bench', 'Bench Volume', 'accessory', 2, 3, 0.60, 6),
    ]),
    sat([
      e('deadlift', 'Deadlift',                'main', 2, 2, 0.65,  6),
      e('squat',    'Squat – Attempt 1',       'main', 1, 1, 0.90,  8),
      e('squat',    'Squat – Attempt 2',       'main', 1, 1, 0.97,  9),
      e('squat',    'Squat – Attempt 3',       'main', 1, 1, 1.02,  9.5),
      e('bench',    'Bench Press – Attempt 1', 'main', 1, 1, 0.90,  8),
      e('bench',    'Bench Press – Attempt 2', 'main', 1, 1, 0.97,  9),
      e('bench',    'Bench Press – Attempt 3', 'main', 1, 1, 1.02,  9.5),
    ], 'Competition Day'),
  ]),
]

// ─── The Full 12-Week Program ─────────────────────────────────────────────────

export const TWELVE_WEEK_PROGRAM: StructuredProgram = {
  id: 'sbd-12w',
  name: '12 Weeks SBD Peaking',
  description: 'โปรแกรม 12 สัปดาห์ RPE-based สำหรับ Powerlifting: Accumulation → Intensification → Peaking → Taper/Test',
  totalWeeks: 12,
  daysPerWeek: 4,
  focus: 'Squat · Bench · Deadlift',
  weeks: WEEKS,
}

export const STRUCTURED_PROGRAMS: StructuredProgram[] = [TWELVE_WEEK_PROGRAM]

// ─── Helper: convert StructuredDay to logger-compatible Program ───────────────

export function dayToProgram(
  programId: string,
  weekId: string,
  day: StructuredDay,
  weightOverrides?: Record<string, number>,
): Program {
  return {
    id: `${programId}/${weekId}/${day.id}`,
    name: `${day.dayOfWeek} — ${day.focus}`,
    focus: day.focus,
    duration: 60,
    // Running activities are logged on /runs, not the set-by-set logger — exclude them.
    exercises: day.exercises.filter(ex => ex.type !== 'running').map(ex => ({
      exerciseId: ex.exerciseId,
      name: ex.name,
      label: ex.label,
      isMain: ex.type === 'main',
      targetRpe: ex.rpe,
      sets: Array.from({ length: ex.sets ?? 0 }, () => ({
        w: weightOverrides?.[ex.id ?? `${ex.exerciseId}:${ex.rpe}`] ?? 0,
        r: typeof ex.reps === 'number' ? ex.reps : 8,
      })),
    })),
  }
}
