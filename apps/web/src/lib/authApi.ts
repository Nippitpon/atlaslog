import { supabase } from './supabase.js'

// Same unwrapping as adminApi: supabase-js hides the function's own message
// behind a generic "non-2xx" error.
async function functionError(error: unknown): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = (error as any)?.context as Response | undefined
  if (ctx && typeof ctx.json === 'function') {
    try {
      const msg = (await ctx.clone().json())?.error
      if (msg) return String(msg)
    } catch { /* fall through */ }
  }
  return error instanceof Error ? error.message : 'Login failed'
}

// Supabase signs in by email only; auth-login resolves the username server-side
// so the email is never exposed to the client.
export async function loginWithUsername(username: string, password: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('auth-login', {
    body: { identifier: username, password },
  })
  if (error) return functionError(error)
  if (data?.error) return String(data.error)
  if (!data?.access_token || !data?.refresh_token) return 'Login failed'
  const { error: sessionErr } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  })
  return sessionErr?.message ?? null
}

// Fails open (true): the unique index is the real guard, this is only a UX hint.
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('username_available', { p_username: username })
  if (error) return true
  return data === true
}

export async function saveUsername(username: string): Promise<{ username: string } | { error: string }> {
  const { data, error } = await supabase.rpc('set_username', { p_username: username })
  if (error) return { error: error.message }
  return { username: String(data) }
}

export async function completeForcedPasswordChange(newPassword: string): Promise<string | null> {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return error.message
  const { error: flagErr } = await supabase.rpc('clear_must_change_password')
  return flagErr?.message ?? null
}
