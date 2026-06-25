import type { ActivityLevel, BodyMetricEntry, EnergyResult, UserBio } from '@atlaslog/shared'

// Activity multipliers + human-readable descriptions (6-level standard scheme).
export const ACTIVITY: Record<ActivityLevel, { multiplier: number; label: string }> = {
  sedentary:    { multiplier: 1.2,   label: 'Little or no exercise' },
  light:        { multiplier: 1.375, label: 'Exercise 1–3 times/week' },
  moderate:     { multiplier: 1.465, label: 'Exercise 4–5 times/week' },
  active:       { multiplier: 1.55,  label: 'Daily exercise or intense exercise 3–4 times/week' },
  very_active:  { multiplier: 1.725, label: 'Intense exercise 6–7 times/week' },
  extra_active: { multiplier: 1.9,   label: 'Very intense exercise daily, or physical job' },
}

export const ACTIVITY_ORDER: ActivityLevel[] =
  ['sedentary', 'light', 'moderate', 'active', 'very_active', 'extra_active']

// Lean body mass from weight + body fat %.
export function calcLBM(weightKg: number, bodyFatPct: number): number {
  return weightKg * (1 - bodyFatPct / 100)
}

// Age in whole years from an ISO birth date (accounts for whether this year's
// birthday has passed yet). Returns null if unparseable.
export function calcAge(birthDate?: string): number | null {
  if (!birthDate) return null
  const b = new Date(birthDate)
  if (Number.isNaN(b.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  return age >= 0 && age < 130 ? age : null
}

// Suggested activity level from a program's training days/week (a starting
// guess only — the user confirms/edits, since TDEE covers all daily activity).
export function suggestActivityFromDays(daysPerWeek: number): ActivityLevel {
  if (daysPerWeek <= 0) return 'sedentary'
  if (daysPerWeek <= 3) return 'light'
  if (daysPerWeek <= 5) return 'moderate'
  if (daysPerWeek <= 6) return 'very_active'
  return 'extra_active'
}

// BMR via Katch-McArdle when body fat is known (uses lean mass, no demographics);
// falls back to Mifflin-St Jeor (needs height + age + sex). Returns null if neither
// has enough inputs.
export function calcBMR(bio: UserBio, latest?: BodyMetricEntry):
  { bmr: number; method: 'katch' | 'mifflin' } | null {
  const weight = latest?.weightKg
  const bodyFat = latest?.bodyFatPct

  if (weight && bodyFat != null) {
    const lbm = calcLBM(weight, bodyFat)
    return { bmr: 370 + 21.6 * lbm, method: 'katch' }
  }

  const age = calcAge(bio.birthDate)
  if (weight && bio.heightCm && age != null && bio.sex) {
    const base = 10 * weight + 6.25 * bio.heightCm - 5 * age
    const bmr = bio.sex === 'male' ? base + 5 : base - 161
    return { bmr, method: 'mifflin' }
  }

  return null
}

// Full energy result (BMR + TDEE). activityLevel defaults to sedentary if unset.
export function calcEnergy(bio: UserBio, latest?: BodyMetricEntry): EnergyResult | null {
  const base = calcBMR(bio, latest)
  if (!base) return null
  const level = bio.activityLevel ?? 'sedentary'
  const tdee = base.bmr * ACTIVITY[level].multiplier
  return { bmr: Math.round(base.bmr), tdee: Math.round(tdee), method: base.method }
}
