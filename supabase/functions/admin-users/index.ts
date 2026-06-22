// Supabase Edge Function: admin-users
// Lets an admin list users and confirm/delete them using the service_role key
// (which must NEVER be exposed to the client). Deploy via dashboard or:
//   supabase functions deploy admin-users
//
// Actions (POST body):
//   { action: 'list' }
//   { action: 'confirm', userId }
//   { action: 'delete', userId }
//   { action: 'set-role', userId, role: 'user' | 'coach' }

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

    // --- Verify the caller is an admin (defense in depth; never trust the client) ---
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    if (!token) return json({ error: 'Missing authorization' }, 401)

    const { data: userData, error: userErr } = await admin.auth.getUser(token)
    if (userErr || !userData.user) return json({ error: 'Invalid token' }, 401)

    const { data: profile } = await admin
      .from('profiles').select('role').eq('id', userData.user.id).single()
    if (!profile || profile.role !== 'admin') return json({ error: 'Forbidden' }, 403)

    const { action, userId, role } = await req.json()

    if (action === 'list') {
      const { data, error } = await admin.auth.admin.listUsers()
      if (error) return json({ error: error.message }, 500)

      const ids = data.users.map((u) => u.id)
      const { data: profiles } = await admin.from('profiles').select('id, role').in('id', ids)
      const roleMap = new Map((profiles ?? []).map((p) => [p.id, p.role]))

      const users = data.users.map((u) => ({
        id: u.id,
        email: u.email ?? '',
        createdAt: u.created_at,
        emailConfirmedAt: u.email_confirmed_at ?? null,
        role: roleMap.get(u.id) ?? 'user',
      }))
      return json({ users })
    }

    if (action === 'confirm') {
      if (!userId) return json({ error: 'userId required' }, 400)
      const { error } = await admin.auth.admin.updateUserById(userId, { email_confirm: true })
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true })
    }

    if (action === 'set-role') {
      if (!userId) return json({ error: 'userId required' }, 400)
      if (role !== 'user' && role !== 'coach') return json({ error: 'role must be user or coach' }, 400)
      if (userId === userData.user.id) return json({ error: 'Cannot change your own role' }, 400)

      // Never demote/alter an admin via this action.
      const { data: target } = await admin.from('profiles').select('role').eq('id', userId).single()
      if (target?.role === 'admin') return json({ error: 'Cannot change an admin\'s role' }, 400)

      const { error } = await admin
        .from('profiles').update({ role }).eq('id', userId)
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true })
    }

    if (action === 'delete') {
      if (!userId) return json({ error: 'userId required' }, 400)
      if (userId === userData.user.id) return json({ error: 'Cannot delete your own account' }, 400)
      const { error } = await admin.auth.admin.deleteUser(userId)
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
