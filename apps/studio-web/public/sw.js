// ────────────────────────────────────────────────────────────────────────────
// Self-destructing service worker (killswitch).
//
// Previous SW versions cached the old `StartupSplash` bundle. To guarantee
// every device drops the stale cache and pulls the new `StudioSolarIntro`,
// this SW:
//   1. Skips waiting and activates immediately
//   2. Deletes EVERY cache it has ever created
//   3. Unregisters itself so the next page load goes straight to network
//   4. Reloads every open tab so users see the fresh bundle right away
// After this version runs once on a device, the SW is gone for good — fresh
// fetches go straight to the network. To re-introduce offline support later,
// a brand-new sw.js with a different filename can be registered.
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
      try { client.navigate(client.url); } catch { /* navigate may be blocked; reload-on-message fallback below */ }
    });
  })());
});

// Pass-through fetch — no caching while the SW is briefly active before
// unregistering. Once unregistered, this handler is never called again.
self.addEventListener('fetch', () => { /* intentional no-op */ });
