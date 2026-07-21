/**
 * Web Push Service Worker — thay thế Firebase Messaging
 *
 * Xử lý push notification từ Supabase Edge Function
 * using Web Push API (VAPID keys)
 */

// Push notification handler
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.warn('[Web Push SW] Push event không có data');
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    console.warn('[Web Push SW] Không parse được push data:', e);
    return;
  }

  const { title, body, icon, image, data } = payload;
  const notificationData = data || payload.data || {};

  const options = {
    body: body || '',
    icon: icon || '/logo192.png',
    image: image || '',
    data: notificationData,
    tag: notificationData.tag || 'web-push-notification',
    requireInteraction: true,
    badge: '/badge-72x72.png',
    vibrate: [200, 100, 200],
    timestamp: Date.now(),
  };

  // Add actions if provided
  if (notificationData.actions && Array.isArray(notificationData.actions)) {
    options.actions = notificationData.actions;
  } else if (notificationData.action) {
    options.actions = [{ action: 'open', title: 'Mở' }];
  }

  event.waitUntil(
    self.registration.showNotification(title || 'Thông báo mới', options)
  );
});

// Click notification → focus/open app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';
  const action = event.action;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to focus existing window
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      return clients.openWindow(url);
    })
  );
});

// Notification close event (for analytics)
self.addEventListener('notificationclose', (event) => {
  console.log('[Web Push SW] Notification closed:', event.notification.tag);
});

console.log('[Web Push SW] Service worker loaded for Web Push (VAPID)');