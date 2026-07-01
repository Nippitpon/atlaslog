// Supabase Edge Function: coach
// Handles cross-user operations for the coach-athlete feature using the
// service_role key (which must NEVER reach the client). Reads of athlete
// sessions/programs happen client-side via RLS — this function only covers
// what RLS can't: resolving a coach code/email to a user_id, and returning
// athlete emails (which live in auth.users, not readable by the client).
//
// Actions (POST body):
//   { action: 'resolve-link', code }       athlete links to a coach by code/email
//   { action: 'add-athlete', athlete }     coach REQUESTS an athlete (status pending)
//   { action: 'respond-link', coachId, accept }  athlete accepts/declines a request
//   { action: 'list-athletes' }            coach lists their athletes (+email, +status)
//   { action: 'assign-program', athleteId, program }  coach assigns a program to an active athlete

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendPushToUser } from '../_shared/push.ts'

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

    const { action, code, athlete, coachId, accept, athleteId, program } = await req.json()

    // Resolve a user by email or 8-char uuid prefix.
    const resolveUser = async (raw: string) => {
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
      const coach = await resolveUser(code)
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
      try { await sendPushToUser(admin, coach.id, { title: 'New athlete linked', body: `${caller.email ?? 'An athlete'} connected to you`, url: '/coach', tag: 'coach' }) } catch { /* push must not break the link */ }
      return json({ ok: true, coachEmail: coach.email ?? '' })
    }

    if (action === 'add-athlete') {
      const target = await resolveUser(athlete)
      if (!target) return json({ error: 'Athlete not found' }, 404)
      if (target.id === caller.id) return json({ error: 'Cannot add yourself' }, 400)

      // Don't downgrade an already-active link
      const { data: existing } = await admin.from('coach_athlete')
        .select('status').eq('coach_id', caller.id).eq('athlete_id', target.id).maybeSingle()
      if (existing?.status === 'active') {
        return json({ ok: true, athleteEmail: target.email ?? '', status: 'active' })
      }

      // Request consent: link starts pending → coach can't read until athlete accepts (RLS)
      const { error } = await admin.from('coach_athlete').upsert(
        { coach_id: caller.id, athlete_id: target.id, status: 'pending' },
        { onConflict: 'coach_id,athlete_id' },
      )
      if (error) return json({ error: error.message }, 500)

      await admin.from('notifications').insert({
        user_id: target.id,
        type: 'coach_request',
        data: { coach_id: caller.id, coach_email: caller.email ?? '' },
      })
      try { await sendPushToUser(admin, target.id, { title: 'Coach request', body: `${caller.email ?? 'A coach'} wants to coach you — tap to accept`, url: '/', tag: 'coach' }) } catch { /* push must not break the request */ }
      return json({ ok: true, athleteEmail: target.email ?? '', status: 'pending' })
    }

    if (action === 'respond-link') {
      // Caller is the athlete responding to a pending request from coachId
      if (!coachId) return json({ error: 'Missing coachId' }, 400)
      const { data: link } = await admin.from('coach_athlete')
        .select('status').eq('coach_id', coachId).eq('athlete_id', caller.id).maybeSingle()
      if (!link) return json({ error: 'Request not found' }, 404)

      if (accept) {
        const { error } = await admin.from('coach_athlete')
          .update({ status: 'active' })
          .eq('coach_id', coachId).eq('athlete_id', caller.id)
        if (error) return json({ error: error.message }, 500)
        await admin.from('notifications').insert({
          user_id: coachId,
          type: 'coach_linked',
          data: { athlete_id: caller.id, athlete_email: caller.email ?? '' },
        })
        try { await sendPushToUser(admin, coachId, { title: 'Request accepted', body: `${caller.email ?? 'An athlete'} accepted your coach request`, url: '/coach', tag: 'coach' }) } catch { /* non-fatal */ }
      } else {
        const { error } = await admin.from('coach_athlete')
          .delete().eq('coach_id', coachId).eq('athlete_id', caller.id)
        if (error) return json({ error: error.message }, 500)
        await admin.from('notifications').insert({
          user_id: coachId,
          type: 'coach_declined',
          data: { athlete_id: caller.id, athlete_email: caller.email ?? '' },
        })
      }
      return json({ ok: true })
    }

    if (action === 'list-athletes') {
      // Include pending so the coach can see requests awaiting acceptance
      const { data: links, error } = await admin
        .from('coach_athlete')
        .select('athlete_id, created_at, status')
        .eq('coach_id', caller.id)
        .in('status', ['active', 'pending'])
      if (error) return json({ error: error.message }, 500)

      const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const emailMap = new Map(usersData.users.map((u) => [u.id, u.email ?? '']))

      const athletes = (links ?? []).map((l) => ({
        id: l.athlete_id,
        email: emailMap.get(l.athlete_id) ?? '',
        linkedAt: l.created_at,
        status: l.status,
      }))
      return json({ athletes })
    }

    if (action === 'assign-program') {
      // Coach assigns one of their programs to an active athlete. Writes a fresh
      // copy into the athlete's custom_programs (service_role bypasses RLS).
      if (!athleteId || !program || !program.name || !Array.isArray(program.weeks)) {
        return json({ error: 'Missing athleteId or valid program' }, 400)
      }
      const { data: link } = await admin.from('coach_athlete')
        .select('status').eq('coach_id', caller.id).eq('athlete_id', athleteId).maybeSingle()
      if (!link || link.status !== 'active') return json({ error: 'Athlete not linked (active)' }, 403)

      const id = 'assigned-' + Date.now()
      const cloned = {
        ...program,
        id,
        isCustom: true,
        source: 'coach',
        assignedBy: caller.id,
        assignedByEmail: caller.email ?? '',
      }
      const { error } = await admin.from('custom_programs').insert({ id, user_id: athleteId, program: cloned })
      if (error) return json({ error: error.message }, 500)

      await admin.from('notifications').insert({
        user_id: athleteId,
        type: 'program_assigned',
        data: { coach_id: caller.id, coach_email: caller.email ?? '', program_name: program.name },
      })
      try { await sendPushToUser(admin, athleteId, { title: 'โค้ชส่งโปรแกรมให้คุณ 📋', body: `${caller.email ?? 'Your coach'} assigned "${program.name}"`, url: '/programs', tag: 'coach' }) } catch { /* non-fatal */ }
      return json({ ok: true })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
