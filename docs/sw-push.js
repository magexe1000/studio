/**
 * Studio Web Push Service Worker
 * ──────────────────────────────
 * Listens for system-level push notifications while the app is closed or backgrounded.
 * Employs Studio branding assets, intercepts notification clicks, focuses active tabs,
 * and routes deep links back into the Chordex/Drumex Updater subpages.
 */

self.addEventListener('push', (event) => {
  let data = {
    title: 'Studio update available',
    body: "A new OTA update is ready. Tap to see what's new.",
    version: ''
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      // Plain text fallback
      const text = event.data.text();
      if (text) {
        data = {
          title: 'Studio update available',
          body: text
        };
      }
    }
  }

  // Enforce branding and required details
  const notificationTitle = data.title || 'Studio update available';
  const notificationOptions = {
    body: data.body || "A new update is ready. Tap to see what's new.",
    icon: '/icon-192.png',           // Official Studio icon 192x192
    badge: '/favicon.svg',           // Official minimalist badge icon
    vibrate: [150, 50, 100],
    data: {
      url: data.url || '/?page=updater' // Navigate directly to updater page on click
    },
    actions: [
      { action: 'open', title: 'Open Updater' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(notificationTitle, notificationOptions)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/?page=updater';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 1. Focus existing tab if open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Tell the page to transition and route immediately
          client.postMessage({ type: 'ROUTE_UPDATE', url: targetUrl });
          return client.focus();
        }
      }
      // 2. Otherwise open a new window and let App.tsx parse URL parameters
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
