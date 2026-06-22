// Supabase Edge Function: coach
// Handles cross-user operations for the coach-athlete feature using the
// service_role key (which must NEVER reach the client). Reads of athlete
// sessions/programs happen client-side via RLS — this function only covers
// what RLS can't: resolving a coach code/email to a user_id, and returning
// athlete emails (which live in auth.users, not readable by the client).
//
// Actions (POST body):
//   { action: 'resolve-link', code }   athlete links to a coach by code/email
//   { action: 'list-athletes' }        coach lists their active athletes (+email)

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

    // --- Verify the caller (never trust the client) ---
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    if (!token) return json({ error: 'Missing authorization' }, 401)

    const { data: userData, error: userErr } = await admin.auth.getUser(token)
    if (userErr || !userData.user) return json({ error: 'Invalid token' }, 401)
    const caller = userData.user

    const { action, code } = await req.json()

    // Resolve a coach code (8-char uuid prefix) or email to a user id.
    const resolveCoach = async (raw: string) => {
      const value = String(raw ?? '').trim().toLowerCase()
      if (!value) return null
      // Email match
      if (value.includes('@')) {
        const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        return data.users.find((u) => (u.email ?? '').toLowerCase() === value) ?? null
      }
      // uuid prefix match
      const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      return data.users.find((u) => u.id.toLowerCase().startsWith(value)) ?? null
    }

    if (action === 'resolve-link') {
      const coach = await resolveCoach(code)
      if (!coach) return json({ error: 'Coach not found' }, 404)
      if (coach.id === caller.id) return json({ error: 'Cannot link to yourself' }, 400)

      const { error } = await admin.from('coach_athlete').upsert(
        { coach_id: coach.id, athlete_id: caller.id, status: 'active' },
        { onConflict: 'coach_id,athlete_id' },
      )
      if (error) return json({ error: error.message }, 500)

      await admin.from('notifications').insert({
        user_id: coach.id,
        type: 'coach_linked',
        data: { athlete_id: caller.id, athlete_email: caller.email ?? '' },
      })
      return json({ ok: true, coachEmail: coach.email ?? '' })
    }

    if (action === 'list-athletes') {
      const { data: links, error } = await admin
        .from('coach_athlete')
        .select('athlete_id, created_at')
        .eq('coach_id', caller.id)
        .eq('status', 'active')
      if (error) return json({ error: error.message }, 500)

      const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const emailMap = new Map(usersData.users.map((u) => [u.id, u.email ?? '']))

      const athletes = (links ?? []).map((l) => ({
        id: l.athlete_id,
        email: emailMap.get(l.athlete_id) ?? '',
        linkedAt: l.created_at,
      }))
      return json({ athletes })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
