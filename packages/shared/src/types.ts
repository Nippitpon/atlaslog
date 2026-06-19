export interface Exercise {
  id: string
  name: string
  group: string
  equipment: string
}

export interface AdminUser {
  id: string
  email: string
  createdAt: string
  emailConfirmedAt: string | null
  role: string
}

export interface ProgramSet {
  w: number
  r: number
}

export interface ProgramExercise {
  exerciseId: string
  sets: ProgramSet[]
  isMain?: boolean
}

export interface Program {
  id: string
  name: string
  focus: string
  duration: number
  exercises: ProgramExercise[]
}

export interface WorkoutSet {
  w: number
  r: number
  done: boolean
}

export interface WorkoutExercise {
  exerciseId: string
  sets: WorkoutSet[]
  isMain?: boolean
}

export interface Workout {
  programId: string
  name: string
  startTime: number
  currentIdx: number
  exercises: WorkoutExercise[]
}

export interface Session {
  id: string
  programId: string
  name: string
  date: string
  duration: number
  volume: number
  setCount: number
  exercises?: WorkoutExercise[]
}

// ─── Structured (Hierarchical) Program Types ──────────────────────────────────

export type DayStatus = 'not_started' | 'in_progress' | 'done'
export type ProgramPhase = 'Accumulation' | 'Intensification' | 'Peaking' | 'Taper'

export interface StructuredExercise {
  exerciseId: string
  name: string
  type: 'main' | 'accessory'
  sets: number
  reps: number | string
  rpe?: number
  pct?: number  // %1RM as decimal (e.g. 0.75 = 75%)
  note?: string
}

export interface StructuredDay {
  id: string
  dayOfWeek: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat'
  focus: string
  exercises: StructuredExercise[]
}

export interface StructuredWeek {
  id: string
  weekNumber: number
  phase: ProgramPhase
  days: StructuredDay[]
}

export interface StructuredProgram {
  id: string
  name: string
  description: string
  totalWeeks: number
  daysPerWeek: number
  focus: string
  weeks: StructuredWeek[]
  isCustom?: boolean
  source?: 'builtin' | 'excel'
}

export interface ProgramOneRMs {
  squat: number
  bench: number
  deadlift: number
}

export interface ProgramConfig {
  startDate: string
  endDate: string
  oneRMs: ProgramOneRMs
}

export interface ProgramProgressState {
  [programId: string]: {
    [weekId: string]: {
      [dayId: string]: DayStatus
    }
  }
}
