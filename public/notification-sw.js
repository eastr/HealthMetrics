/* Loaded by the generated service worker (vite-plugin-pwa importScripts). */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const raw = event.notification.data
  const target =
    raw && typeof raw === 'object' && typeof raw.url === 'string' ? raw.url : '/'

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      for (const client of allClients) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client && typeof client.navigate === 'function') {
            try {
              await client.navigate(target)
            } catch {
              /* ignore navigate failures */
            }
          }
          return
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(target)
      }
    })(),
  )
})
