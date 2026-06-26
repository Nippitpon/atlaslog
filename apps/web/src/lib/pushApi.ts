import { supabase } from './supabase.js'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''

export function isPushSupported(): boolean {
  return typeof navigator !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
}

function isStandalone(): boolean {
  // iOS uses navigator.standalone; others use display-mode media query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (navigator as any).standalone === true
    || window.matchMedia?.('(display-mode: standalone)').matches === true
}

// iOS Safari needs the PWA installed to the Home Screen before Web Push works.
export function isIosNeedsInstall(): boolean {
  const ua = navigator.userAgent || ''
  const isIos = /iphone|ipad|ipod/i.test(ua)
    || (/macintosh/i.test(ua) && 'ontouchend' in document) // iPadOS desktop UA
  return isIos && !isStandalone()
}

export function getPermission(): NotificationPermission {
  return typeof Notification !== 'undefined' ? Notification.permission : 'denied'
}

export async function isSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false
  try {
    const reg = await navigator.serviceWorker.ready
    return !!(await reg.pushManager.getSubscription())
  } catch {
    return false
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const buffer = new ArrayBuffer(raw.length)
  const out = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

// Persists reminder opt-in on the user's single program_state row (best effort;
// the row's other columns default to '{}' so this never clobbers progress).
async function setReminderOptIn(userId: string, value: boolean) {
  try {
    await supabase.from('program_state')
      .upsert({ user_id: userId, reminder_opt_in: value }, { onConflict: 'user_id' })
  } catch { /* non-fatal */ }
}

// Returns null on success, or an error message string.
export async function subscribeToPush(userId: string): Promise<string | null> {
  if (!isPushSupported()) return 'push-unsupported'
  if (!VAPID_PUBLIC_KEY) return 'missing-vapid-key'

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'permission-denied'

  try {
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }
    const json = sub.toJSON()
    const { error } = await supabase.from('push_subscriptions').upsert(
      { user_id: userId, endpoint: json.endpoint, subscription: json, user_agent: navigator.userAgent },
      { onConflict: 'endpoint' },
    )
    if (error) return error.message
    await setReminderOptIn(userId, true)
    return null
  } catch (e) {
    return e instanceof Error ? e.message : 'subscribe-failed'
  }
}

export async function unsubscribeFromPush(userId: string): Promise<void> {
  await setReminderOptIn(userId, false)
  if (!isPushSupported()) return
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      await sub.unsubscribe()
    }
  } catch { /* non-fatal */ }
}
