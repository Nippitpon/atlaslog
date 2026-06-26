/* Atlaslog service worker — Web Push only (no offline caching). */

self.addEventListener('push', (event) => {
  let p = {}
  try { p = event.data ? event.data.json() : {} } catch (_) { p = {} }
  const title = p.title || 'Atlaslog'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: p.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: p.tag,
      data: { url: p.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of all) {
      if ('focus' in c) {
        try { await c.navigate(url) } catch (_) { /* cross-origin or unsupported */ }
        return c.focus()
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url)
  })())
})

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
