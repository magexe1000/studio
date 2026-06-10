// ────────────────────────────────────────────────────────────────────────────
// Self-destructing service worker (killswitch) for sw-push.js.
//
// Previous SW versions registered for background push updates may have cached
// the old bundles. This SW unregisters itself, deletes all Cache Storage caches,
// and refreshes open tabs to ensure the client is fully up to date.
// ────────────────────────────────────────────────────────────────────────────

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((client) => {
      try { client.navigate(client.url); } catch { /* navigate may be blocked */ }
    });
  })());
});

// Pass-through fetch — no caching while the SW is briefly active before
// unregistering. Once unregistered, this handler is never called again.
self.addEventListener('fetch', () => { /* intentional no-op */ });
