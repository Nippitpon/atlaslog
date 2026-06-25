import type { AthleteSummary, Session, StructuredProgram, BodyMetricEntry, UserBio, ProgramOneRMs } from '@atlaslog/shared'
import { supabase } from './supabase.js'

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('coach', { body })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data as T
}

export function linkCoach(code: string): Promise<string> {
  return call<{ ok: true; coachEmail: string }>({ action: 'resolve-link', code })
    .then(r => r.coachEmail)
}

export function addAthlete(athlete: string): Promise<{ athleteEmail: string; status: string }> {
  return call<{ ok: true; athleteEmail: string; status: string }>({ action: 'add-athlete', athlete })
    .then(r => ({ athleteEmail: r.athleteEmail, status: r.status }))
}

export function respondCoachRequest(coachId: string, accept: boolean): Promise<void> {
  return call<{ ok: true }>({ action: 'respond-link', coachId, accept }).then(() => undefined)
}

export function listAthletes(): Promise<AthleteSummary[]> {
  return call<{ athletes: AthleteSummary[] }>({ action: 'list-athletes' }).then(r => r.athletes)
}

export async function unlinkAthlete(athleteId: string): Promise<void> {
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('Not signed in')
  const { error } = await supabase
    .from('coach_athlete')
    .delete()
    .eq('coach_id', data.user.id)
    .eq('athlete_id', athleteId)
  if (error) throw new Error(error.message)
}

// Read athlete data via RLS (coach reads policy). No edge function needed.
export async function getAthleteSessions(athleteId: string): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', athleteId)
    .order('date', { ascending: false })
  if (error) throw new Error(error.message)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map(r => ({
    id: r.id,
    programId: r.program_id,
    name: r.name,
    date: r.date,
    duration: r.duration,
    volume: r.volume,
    setCount: r.set_count,
    exercises: r.exercises,
  }))
}

export async function getAthletePrograms(athleteId: string): Promise<StructuredProgram[]> {
  const { data, error } = await supabase
    .from('custom_programs')
    .select('*')
    .eq('user_id', athleteId)
  if (error) throw new Error(error.message)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map(r => r.program)
}

export async function getAthleteBodyMetrics(athleteId: string): Promise<BodyMetricEntry[]> {
  const { data, error } = await supabase
    .from('body_metrics')
    .select('*')
    .eq('user_id', athleteId)
    .order('date', { ascending: false })
  if (error) throw new Error(error.message)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map(r => ({
    id: r.id,
    date: r.date,
    weightKg: r.weight_kg,
    skeletalMuscleKg: r.skeletal_muscle_kg ?? undefined,
    bodyFatPct: r.body_fat_pct ?? undefined,
  }))
}

// Athlete bio + 1RM from their program_state row (coach-read via RLS).
export async function getAthleteState(athleteId: string):
  Promise<{ bio: UserBio; personalOneRMs: ProgramOneRMs | null }> {
  const { data, error } = await supabase
    .from('program_state')
    .select('bio, personal_one_rms')
    .eq('user_id', athleteId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = data as any
  return { bio: s?.bio ?? {}, personalOneRMs: s?.personal_one_rms ?? null }
}
