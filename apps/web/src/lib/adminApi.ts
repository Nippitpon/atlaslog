import type { AdminUser } from '@atlaslog/shared'
import { supabase } from './supabase.js'

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) {
    // supabase-js hides the function's real message behind a generic
    // "non-2xx status code" — dig the actual { error } out of the response.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = (error as any).context as Response | undefined
    if (ctx && typeof ctx.json === 'function') {
      try {
        const realErr = (await ctx.clone().json())?.error
        if (realErr) throw new Error(`${realErr} (HTTP ${ctx.status})`)
      } catch (e) {
        if (e instanceof Error && e.message !== error.message) throw e
      }
    }
    throw new Error(error.message)
  }
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

export function setUserRole(userId: string, role: 'user' | 'coach'): Promise<void> {
  return call<{ ok: true }>({ action: 'set-role', userId, role }).then(() => undefined)
}
