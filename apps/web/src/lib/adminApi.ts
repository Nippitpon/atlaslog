import type { AdminUser } from '@atlaslog/shared'
import { supabase } from './supabase.js'

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data as T
}

export function listUsers(): Promise<AdminUser[]> {
  return call<{ users: AdminUser[] }>({ action: 'list' }).then(r => r.users)
}

export function confirmUser(userId: string): Promise<void> {
  return call<{ ok: true }>({ action: 'confirm', userId }).then(() => undefined)
}

export function deleteUser(userId: string): Promise<void> {
  return call<{ ok: true }>({ action: 'delete', userId }).then(() => undefined)
}
