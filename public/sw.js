/**
 * NoHunger service worker.
 *
 * Two jobs:
 *   1. Receive push messages from the server and render them as OS-level
 *      notifications on the user's device.
 *   2. When the user taps a notification, focus an existing tab or open a
 *      fresh one at the right URL.
 *
 * Deliberately no caching. This SW does not intercept fetches, so pages
 * always come from the network. A "fancy offline" cache is a Bucket-C thing
 * and would need its own careful invalidation strategy.
 */

self.addEventListener('install', (event) => {
  // Take over from any old SW immediately, so a new deploy replaces the old
  // one on next reload rather than waiting for every tab to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'NoHunger', body: event.data.text() };
  }

  const title = payload.title || 'NoHunger';
  const options = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.tag,
    // Tag lets a second notification of the same "kind" replace the first,
    // instead of stacking. Useful for e.g. "3 people want your food" — only
    // the latest matters.
    renotify: Boolean(payload.tag),
    data: { url: payload.url || '/' },
    // On Android, this makes the notification stay in the tray until tapped.
    // On iOS, it's ignored — Apple manages notification presentation itself.
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      // If a NoHunger tab is already open, focus it and navigate there.
      for (const client of allClients) {
        try {
          const url = new URL(client.url);
          if (url.origin === self.location.origin) {
            await client.focus();
            if ('navigate' in client) {
              await client.navigate(targetUrl);
            }
            return;
          }
        } catch {
          // ignore malformed client URLs
        }
      }
      // Otherwise open a new one.
      await self.clients.openWindow(targetUrl);
    })(),
  );
});