import type { Session, StructuredProgram } from '@atlaslog/shared'
import { supabase } from './supabase.js'
import type { User } from '@supabase/supabase-js'

const QUEUE_KEY = 'atlas:v1:sync-queue'

type SyncOp =
  | { kind: 'session-upsert'; payload: Session }
  | { kind: 'program-upsert'; payload: StructuredProgram }
  | { kind: 'program-delete'; payload: { id: string } }

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
  writeQueue([...readQueue(), op])
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
