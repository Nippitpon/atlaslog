// Shared Web Push sender for Supabase Edge Functions (Deno).
// Uses @negrel/webpush (Web Crypto, RFC 8291/8292) — works in the Deno edge runtime.
import * as webpush from 'jsr:@negrel/webpush@^0.3'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

export type PushPayload = { title: string; body?: string; url?: string; tag?: string }

// Build the ApplicationServer once per isolate (importing keys is not free).
let appServerPromise: ReturnType<typeof webpush.ApplicationServer.new> | null = null
function getAppServer() {
  if (!appServerPromise) {
    const vapid = JSON.parse(Deno.env.get('VAPID_JSON')!)
    appServerPromise = (async () => {
      const vapidKeys = await webpush.importVapidKeys(vapid, { extractable: false })
      return await webpush.ApplicationServer.new({
        contactInformation: 'mailto:itdcenter@thairung.co.th',
        vapidKeys,
      })
    })()
  }
  return appServerPromise
}

// Send a push to every device the user has subscribed. Prunes dead endpoints (404/410).
export async function sendPushToUser(
  admin: SupabaseClient,
  userId: string,
  payload: PushPayload,
): Promise<void> {
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, subscription')
    .eq('user_id', userId)
  if (!subs || subs.length === 0) return

  const appServer = await getAppServer()
  const text = JSON.stringify(payload)

  for (const row of subs) {
    try {
      const subscriber = appServer.subscribe(row.subscription)
      await subscriber.pushTextMessage(text, {})
    } catch (err) {
      // deno-lint-ignore no-explicit-any
      const status = (err as any)?.response?.status
      if (status === 404 || status === 410) {
        await admin.from('push_subscriptions').delete().eq('endpoint', row.endpoint)
      }
      // other errors (429/5xx): keep the subscription, drop this attempt
    }
  }
}
