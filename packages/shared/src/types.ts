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

// ─── Body Composition & Running (Phase B) ─────────────────────────────────────

// Body composition log entry. Skeletal muscle + body fat are optional now but
// stored so a later phase can derive BMR / TDEE.
export interface BodyMetricEntry {
  id: string
  date: string             // ISO timestamp
  weightKg: number
  skeletalMuscleKg?: number
  bodyFatPct?: number
}

// User bio for BMR/TDEE. Weight/bodyFat come from latest BodyMetricEntry —
// these are the slow-changing fields entered once.
export type Sex = 'male' | 'female'
export type ActivityLevel =
  | 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | 'extra_active'

export interface UserBio {
  sex?: Sex
  heightCm?: number
  birthDate?: string        // ISO 'YYYY-MM-DD'; age derived at calc time
  activityLevel?: ActivityLevel
}

// Result of an energy (calorie) computation.
export interface EnergyResult {
  bmr: number
  tdee: number
  method: 'katch' | 'mifflin'
}

// Running / cardio session. Pace is derived (durationMin / distanceKm), not stored.
export interface RunEntry {
  id: string
  date: string             // ISO timestamp
  distanceKm: number
  durationMin: number
  note?: string
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
  source?: 'builtin' | 'excel' | 'manual'
  // 'powerlifting' → working weights computed from 1RM (profile or config);
  // 'general' → no 1RM calc, log weights manually. Undefined = powerlifting (legacy).
  programType?: 'general' | 'powerlifting'
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

export interface ProgramCustomAccessories {
  [programId: string]: {
    [weekId: string]: {
      [dayId: string]: StructuredExercise[]
    }
  }
}

// Full per-user program state synced to cloud (one row per user)
export interface ProgramStateSnapshot {
  progress: ProgramProgressState
  configs: { [programId: string]: ProgramConfig }
  customAccessories: ProgramCustomAccessories
  // User settings synced in the same 1-row/user blob (optional for back-compat).
  bio?: UserBio
  personalOneRMs?: ProgramOneRMs
}

// ─── Phase 4 — Social (Coach-Athlete / Sharing / Notifications) ────────────────

export interface CoachLink {
  id: string
  coachId: string
  athleteId: string
  status: 'active' | 'archived'
  createdAt: string
}

export interface AthleteSummary {
  id: string
  email: string
  linkedAt: string
  status: 'pending' | 'active'
}

export interface SharedProgram {
  code: string
  ownerId: string
  name: string
  program: StructuredProgram
  createdAt: string
}

export interface AppNotification {
  id: string
  type: string
  data: Record<string, unknown> | null
  readAt: string | null
  createdAt: string
}
