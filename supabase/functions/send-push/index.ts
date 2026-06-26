// Supabase Edge Function: send-push
// Thin HTTP wrapper around the shared push sender — for manual testing and
// internal callers. Authorized by a shared secret header (x-cron-secret), NOT a
// user JWT, since it sends on behalf of the system.
//   POST { userId: string, payload: { title, body?, url?, tag? } }
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendPushToUser } from '../_shared/push.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
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
    const secret = Deno.env.get('CRON_SECRET')
    if (!secret || req.headers.get('x-cron-secret') !== secret) {
      return json({ error: 'Forbidden' }, 403)
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

    const { userId, payload } = await req.json()
    if (!userId || !payload?.title) return json({ error: 'Missing userId or payload.title' }, 400)

    await sendPushToUser(admin, userId, payload)
    return json({ ok: true })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
