import type { Session, RunEntry, BodyMetricEntry } from '@atlaslog/shared'

// MET (metabolic equivalent) constants per activity intensity.
export const MET = {
  running: 9.8,
  heavyLifting: 6.0,
  lightLifting: 3.5,
} as const

// Calories = MET × Weight(kg) × Duration(hours). durationMin → hours = /60.
export function caloriesBurned(met: number, weightKg: number, durationMin: number): number {
  return Math.round(met * weightKg * (durationMin / 60))
}

// A lifting session counts as "heavy" when it contains a main SBD lift.
export function sessionMet(session: Pick<Session, 'exercises'>): number {
  return session.exercises?.some(e => e.isMain) ? MET.heavyLifting : MET.lightLifting
}

export function sessionCalories(
  session: Pick<Session, 'exercises' | 'duration'>,
  weightKg: number | undefined,
): number {
  if (!weightKg) return 0
  return caloriesBurned(sessionMet(session), weightKg, session.duration)
}

export function runCalories(run: Pick<RunEntry, 'durationMin'>, weightKg: number | undefined): number {
  if (!weightKg) return 0
  return caloriesBurned(MET.running, weightKg, run.durationMin)
}

// Latest logged body weight (newest by date), or undefined if none logged.
export function latestWeightKg(bodyMetrics: BodyMetricEntry[]): number | undefined {
  if (bodyMetrics.length === 0) return undefined
  return [...bodyMetrics].sort((a, b) => b.date.localeCompare(a.date))[0].weightKg
}

export interface DayCalories {
  date: Date
  label: string
  calories: number
  isToday: boolean
}

// Per-day calories for the current week (Sunday-based), mirroring weeklyVolume.
// Sums stored/derived session calories plus running calories on each day.
export function weeklyCalories(
  history: Session[],
  runs: RunEntry[],
  weightKg: number | undefined,
): DayCalories[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const weekStart = new Date(today)
  weekStart.setDate(weekStart.getDate() - today.getDay())

  const days: DayCalories[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    const next = new Date(d)
    next.setDate(next.getDate() + 1)

    const inDay = (iso: string) => { const t = new Date(iso); return t >= d && t < next }

    const sessionCal = history
      .filter(h => inDay(h.date))
      .reduce((sum, h) => sum + (h.calories ?? sessionCalories(h, weightKg)), 0)
    const runCal = runs
      .filter(r => inDay(r.date))
      .reduce((sum, r) => sum + runCalories(r, weightKg), 0)

    days.push({
      date: d,
      label: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()],
      calories: sessionCal + runCal,
      isToday: d.getTime() === today.getTime(),
    })
  }
  return days
}
