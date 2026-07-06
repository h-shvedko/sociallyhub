/*
 * SociallyHub service worker — Web Push (ADR-0010, Phase 4).
 *
 * Minimal by design: it renders pushes and routes clicks. The payload is
 * produced by src/lib/notifications/push-service.ts (sendToUser) and mirrors
 * PushNotificationData: { title, body, icon?, badge?, tag?, data?, actions?,
 * requireInteraction?, silent? }. The click target is data.actionUrl.
 */

self.addEventListener('install', () => {
  // Activate immediately so a freshly-registered worker can receive pushes.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload = { title: 'SociallyHub', body: event.data.text() };
    }
  }

  const title = payload.title || 'SociallyHub';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon-192.png',
    badge: typeof payload.badge === 'string' ? payload.badge : '/icon-192.png',
    tag: payload.tag,
    data: payload.data || {},
    actions: Array.isArray(payload.actions) ? payload.actions : undefined,
    requireInteraction: Boolean(payload.requireInteraction),
    silent: Boolean(payload.silent),
    timestamp: payload.timestamp || Date.now(),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const targetUrl = data.actionUrl || '/dashboard';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus an existing tab on the same origin if one is open.
        for (const client of clientList) {
          try {
            const clientUrl = new URL(client.url);
            const wantUrl = new URL(targetUrl, self.location.origin);
            if (clientUrl.origin === wantUrl.origin && 'focus' in client) {
              client.focus();
              if ('navigate' in client && clientUrl.href !== wantUrl.href) {
                return client.navigate(wantUrl.href);
              }
              return;
            }
          } catch (e) {
            // Ignore malformed URLs and fall through to opening a new window.
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
