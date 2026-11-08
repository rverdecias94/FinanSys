/* global self, clients */
/**
 * Handlers Web Push para el service worker de Gestia.
 * Se importa desde vite-plugin-pwa (workbox.importScripts).
 * Solo corre en build/preview/producción (no en `npm run dev`).
 */
self.addEventListener('push', (event) => {
  let payload = {
    title: 'Gestia',
    body: 'Tienes un aviso nuevo',
    url: '/admin/planes',
  }

  try {
    if (event.data) {
      const parsed = event.data.json()
      payload = { ...payload, ...parsed }
    }
  } catch {
    try {
      const text = event.data?.text?.()
      if (text) payload.body = text
    } catch {
      // ignore
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Gestia', {
      body: payload.body || '',
      icon: '/pwa-192x192-v5.png',
      badge: '/pwa-64x64-v5.png',
      data: { url: payload.url || '/admin/planes' },
      renotify: true,
      tag: payload.tag || 'gestia-admin',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification?.data?.url || '/admin/planes'

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of allClients) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) {
            try {
              await client.navigate(targetUrl)
            } catch {
              // ignore
            }
          }
          return
        }
      }
      if (clients.openWindow) {
        await clients.openWindow(targetUrl)
      }
    })(),
  )
})
