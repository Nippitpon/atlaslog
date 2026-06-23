import type { Session, StructuredProgram, ProgramStateSnapshot, BodyMetricEntry, RunEntry, Exercise } from '@atlaslog/shared'
import { supabase } from './supabase.js'
import type { User } from '@supabase/supabase-js'

const QUEUE_KEY = 'atlas:v1:sync-queue'

type SyncOp =
  | { kind: 'session-upsert'; payload: Session }
  | { kind: 'program-upsert'; payload: StructuredProgram }
  | { kind: 'program-delete'; payload: { id: string } }
  | { kind: 'program-state-upsert'; payload: ProgramStateSnapshot }
  | { kind: 'body-metric-upsert'; payload: BodyMetricEntry }
  | { kind: 'body-metric-delete'; payload: { id: string } }
  | { kind: 'run-upsert'; payload: RunEntry }
  | { kind: 'run-delete'; payload: { id: string } }
  | { kind: 'exercise-upsert'; payload: Exercise }
  | { kind: 'exercise-delete'; payload: { id: string } }

function readQueue(): SyncOp[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? (JSON.parse(raw) as SyncOp[]) : []
  } catch {
    return []
  }
}

function writeQueue(ops: SyncOp[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(ops))
  } catch {
    // ignore quota / serialization errors
  }
}

function enqueue(op: SyncOp) {
  const q = readQueue()
  // Program state is a full snapshot — only the latest matters, drop stale ones
  if (op.kind === 'program-state-upsert') {
    writeQueue([...q.filter(o => o.kind !== 'program-state-upsert'), op])
  } else {
    writeQueue([...q, op])
  }
}

function sessionRow(session: Session, userId: string) {
  return {
    id: session.id,
    user_id: userId,
    program_id: session.programId,
    name: session.name,
    date: session.date,
    duration: session.duration,
    volume: session.volume,
    set_count: session.setCount,
    exercises: session.exercises,
  }
}

async function runOp(op: SyncOp, userId: string): Promise<void> {
  if (op.kind === 'session-upsert') {
    const { error } = await supabase.from('sessions').upsert(sessionRow(op.payload, userId))
    if (error) throw error
  } else if (op.kind === 'program-upsert') {
    const { error } = await supabase
      .from('custom_programs')
      .upsert({ id: op.payload.id, user_id: userId, program: op.payload })
    if (error) throw error
  } else if (op.kind === 'program-state-upsert') {
    const { error } = await supabase.from('program_state').upsert({
      user_id: userId,
      progress: op.payload.progress,
      configs: op.payload.configs,
      custom_accessories: op.payload.customAccessories,
      updated_at: new Date().toISOString(),
    })
    if (error) throw error
  } else if (op.kind === 'body-metric-upsert') {
    const { error } = await supabase.from('body_metrics').upsert({
      id: op.payload.id,
      user_id: userId,
      date: op.payload.date,
      weight_kg: op.payload.weightKg,
      skeletal_muscle_kg: op.payload.skeletalMuscleKg ?? null,
      body_fat_pct: op.payload.bodyFatPct ?? null,
    })
    if (error) throw error
  } else if (op.kind === 'body-metric-delete') {
    const { error } = await supabase.from('body_metrics').delete().eq('id', op.payload.id)
    if (error) throw error
  } else if (op.kind === 'run-upsert') {
    const { error } = await supabase.from('runs').upsert({
      id: op.payload.id,
      user_id: userId,
      date: op.payload.date,
      distance_km: op.payload.distanceKm,
      duration_min: op.payload.durationMin,
      note: op.payload.note ?? null,
    })
    if (error) throw error
  } else if (op.kind === 'run-delete') {
    const { error } = await supabase.from('runs').delete().eq('id', op.payload.id)
    if (error) throw error
  } else if (op.kind === 'exercise-upsert') {
    const { error } = await supabase.from('custom_exercises').upsert({
      id: op.payload.id,
      name: op.payload.name,
      muscle_group: op.payload.group,
      equipment: op.payload.equipment || null,
      created_by: userId,
    })
    if (error) throw error
  } else if (op.kind === 'exercise-delete') {
    const { error } = await supabase.from('custom_exercises').delete().eq('id', op.payload.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('custom_programs').delete().eq('id', op.payload.id)
    if (error) throw error
  }
}

async function attempt(op: SyncOp, userId: string): Promise<void> {
  try {
    await runOp(op, userId)
  } catch {
    enqueue(op)
  }
}

export async function syncSession(session: Session) {
  const { data } = await supabase.auth.getUser()
  if (!data.user) return enqueue({ kind: 'session-upsert', payload: session })
  await attempt({ kind: 'session-upsert', payload: session }, data.user.id)
}

export async function syncProgramUpsert(program: StructuredProgram) {
  const { data } = await supabase.auth.getUser()
  if (!data.user) return enqueue({ kind: 'program-upsert', payload: program })
  await attempt({ kind: 'program-upsert', payload: program }, data.user.id)
}

export async function syncProgramDelete(id: string) {
  const { data } = await supabase.auth.getUser()
  if (!data.user) return enqueue({ kind: 'program-delete', payload: { id } })
  await attempt({ kind: 'program-delete', payload: { id } }, data.user.id)
}

export async function syncProgramState(snapshot: ProgramStateSnapshot) {
  const { data } = await supabase.auth.getUser()
  if (!data.user) return enqueue({ kind: 'program-state-upsert', payload: snapshot })
  await attempt({ kind: 'program-state-upsert', payload: snapshot }, data.user.id)
}

export async function syncBodyMetric(entry: BodyMetricEntry) {
  const { data } = await supabase.auth.getUser()
  if (!data.user) return enqueue({ kind: 'body-metric-upsert', payload: entry })
  await attempt({ kind: 'body-metric-upsert', payload: entry }, data.user.id)
}

export async function syncBodyMetricDelete(id: string) {
  const { data } = await supabase.auth.getUser()
  if (!data.user) return enqueue({ kind: 'body-metric-delete', payload: { id } })
  await attempt({ kind: 'body-metric-delete', payload: { id } }, data.user.id)
}

export async function syncRun(entry: RunEntry) {
  const { data } = await supabase.auth.getUser()
  if (!data.user) return enqueue({ kind: 'run-upsert', payload: entry })
  await attempt({ kind: 'run-upsert', payload: entry }, data.user.id)
}

export async function syncRunDelete(id: string) {
  const { data } = await supabase.auth.getUser()
  if (!data.user) return enqueue({ kind: 'run-delete', payload: { id } })
  await attempt({ kind: 'run-delete', payload: { id } }, data.user.id)
}

export async function syncExercise(ex: Exercise) {
  const { data } = await supabase.auth.getUser()
  if (!data.user) return enqueue({ kind: 'exercise-upsert', payload: ex })
  await attempt({ kind: 'exercise-upsert', payload: ex }, data.user.id)
}

export async function syncExerciseDelete(id: string) {
  const { data } = await supabase.auth.getUser()
  if (!data.user) return enqueue({ kind: 'exercise-delete', payload: { id } })
  await attempt({ kind: 'exercise-delete', payload: { id } }, data.user.id)
}

let flushing = false

export async function flushQueue() {
  if (flushing) return
  const queued = readQueue()
  if (queued.length === 0) return

  const { data }: { data: { user: User | null } } = await supabase.auth.getUser()
  if (!data.user) return

  flushing = true
  const remaining: SyncOp[] = []
  try {
    for (const op of queued) {
      try {
        await runOp(op, data.user.id)
      } catch {
        remaining.push(op)
      }
    }
  } finally {
    writeQueue(remaining)
    flushing = false
  }
}
