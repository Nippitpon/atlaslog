export interface Exercise {
  id: string
  name: string
  group: string
  equipment: string
  // Extended fields from the ExerciseDB dataset (Phase 6). All optional so the
  // 19 builtin + custom exercises stay valid.
  target?: string
  secondaryMuscles?: string[]
  instructions?: string[]
  gifPath?: string
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
  // Optional display name override (e.g. "Back Squat — Back-off"); falls back to
  // the canonical exercise name when absent.
  name?: string
  // Optional sub-label distinguishing rows of the same lift (e.g. "Competition · Top set"
  // vs "Competition · Back-off"). Sourced from Excel Variant/Prescription columns.
  label?: string
  sets: ProgramSet[]
  isMain?: boolean
  targetRpe?: number
}

export interface Program {
  id: string
  name: string
  focus: string
  duration: number
  exercises: ProgramExercise[]
}

export interface WorkoutSet {
  id?: string
  w: number
  r: number
  done: boolean
  // RPE the lifter actually reported for this set (0.5 steps, 6–10). Distinct from
  // WorkoutExercise.targetRpe, which is the prescription and is never updated.
  // Optional forever — every set logged before this field existed has none.
  rpe?: number
}

export interface WorkoutExercise {
  id?: string
  exerciseId: string
  name?: string
  label?: string
  sets: WorkoutSet[]
  isMain?: boolean
  targetRpe?: number
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
  calories?: number
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

// Dated 1RM log — append-only history, one row per lift per test. Mirrors
// BodyMetricEntry so both get the same store/sync/chart treatment.
// Estimated 1RMs are derived from Session[] on the fly and are never stored
// here — that's why 'estimated' is absent from OneRMSource.
export type OneRMLift = keyof ProgramOneRMs      // 'squat' | 'bench' | 'deadlift'
export type OneRMSource = 'manual' | 'test'

export interface OneRMEntry {
  id: string
  date: string             // ISO timestamp
  lift: OneRMLift
  weightKg: number
  source?: OneRMSource     // default 'manual'
  note?: string
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
  // Composite `programId/weekId/dayId`, same convention as Session.programId
  // (dayToProgram). Present when the run was logged from a program day — that
  // link, not the date, is what marks the day done.
  dayRef?: string
}

// ─── Structured (Hierarchical) Program Types ──────────────────────────────────

// 'skipped' is only ever set by the user tapping Skip on a day that has gone by.
// Nothing infers it: a day left alone stays 'not_started' and keeps its week (and
// the whole program) unfinished, which is the point — the plan isn't closed until
// the athlete says what happened to that day.
export type DayStatus = 'not_started' | 'in_progress' | 'done' | 'skipped'
export type ProgramPhase = 'Accumulation' | 'Intensification' | 'Peaking' | 'Taper'

export interface StructuredExercise {
  id?: string
  exerciseId: string
  name: string
  // Optional sub-label distinguishing rows of the same lift within a day
  // (e.g. "Competition · Top set" vs "Volume · Back-off"). From Excel Variant/Prescription.
  label?: string
  type: 'main' | 'accessory' | 'running'
  // Optional because a 'running' activity has no sets/reps (it uses the target
  // distance/duration below and opens the standalone /runs logger instead).
  sets?: number
  reps?: number | string
  rpe?: number
  pct?: number  // %1RM as decimal (e.g. 0.75 = 75%)
  note?: string
  // Running activity target (type === 'running'). Both optional — a bare
  // "go for a run" marker is valid. Tapping it opens the /runs page.
  distanceKm?: number
  durationMin?: number
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
  // Weekly routine (General only): no periodization / no start-end date setup —
  // opening it shows the training days directly. Undefined = periodized (dated).
  weekly?: boolean
  source?: 'builtin' | 'excel' | 'manual' | 'coach'
  // Set when a coach assigns this program to an athlete (source === 'coach').
  assignedBy?: string
  assignedByEmail?: string
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

// Per-user, per-program preferences. Keyed by program id rather than stored on
// StructuredProgram so it covers built-in programs too — those objects are
// module constants (twelveWeekProgram.ts) and can't carry per-user state.
export interface ProgramMeta {
  favorite?: boolean
  paused?: boolean
  updatedAt?: number    // epoch ms — last create/import/edit of the program
  activatedAt?: number  // epoch ms — last time the program was set up / resumed
}

export interface ProgramMetaState {
  [programId: string]: ProgramMeta
}

// Full per-user program state synced to cloud (one row per user)
export interface ProgramStateSnapshot {
  progress: ProgramProgressState
  configs: { [programId: string]: ProgramConfig }
  customAccessories: ProgramCustomAccessories
  // User settings synced in the same 1-row/user blob (optional for back-compat).
  bio?: UserBio
  personalOneRMs?: ProgramOneRMs
  programMeta?: ProgramMetaState
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
