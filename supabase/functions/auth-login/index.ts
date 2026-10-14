// Supabase Edge Function: auth-login
// Username login. Supabase signs in by email only, so we resolve username → email
// HERE (service role) and sign in server-side, returning only the session tokens.
// The email is never sent to the caller, so usernames can't be used to harvest emails.
// Email logins do NOT go through here (the client calls signInWithPassword directly).
//
//   { identifier: 'john_doe', password }  →  { access_token, refresh_token }
//
// Deploy via dashboard or:  supabase functions deploy auth-login

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const GENERIC_ERROR = 'Invalid login credentials'

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
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

    const { identifier, password } = await req.json()
    if (typeof identifier !== 'string' || typeof password !== 'string' || !identifier || !password) {
      return json({ error: GENERIC_ERROR }, 400)
    }
    // Emails are handled client-side; refusing them here keeps this endpoint username-only.
    if (identifier.includes('@')) return json({ error: GENERIC_ERROR }, 400)

    const username = identifier.trim().toLowerCase()
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

    const { data: profile } = await admin
      .from('profiles').select('id').eq('username', username).maybeSingle()
    if (!profile) return json({ error: GENERIC_ERROR }, 400)

    const { data: found, error: findErr } = await admin.auth.admin.getUserById(profile.id)
    const email = found?.user?.email
    if (findErr || !email) return json({ error: GENERIC_ERROR }, 400)

    // Fresh anon client so the service-role client's headers never end up on the sign-in call.
    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
    const { data, error } = await anon.auth.signInWithPassword({ email, password })

    if (error || !data.session) {
      // GoTrue checks the password before the confirmation state, so passing "not confirmed"
      // through (for the "waiting for admin approval" screen) shouldn't confirm a wrong guess.
      // (Not re-verified here — confirm in the e2e test with a wrong password on a pending user.)
      if (error?.message?.toLowerCase().includes('not confirmed')) return json({ error: error.message }, 400)
      return json({ error: GENERIC_ERROR }, 400)
    }

    return json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    })
  } catch (_e) {
    return json({ error: GENERIC_ERROR }, 500)
  }
})
