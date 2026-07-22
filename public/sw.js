// =====================================================================
// PWA Service Worker - Offline caching & Installable app
// =====================================================================
// Cache name with version for easy updates
const CACHE_NAME = 'hl-erp-v1';
const CACHE_STATIC = 'hl-erp-static-v1';
const CACHE_DYNAMIC = 'hl-erp-dynamic-v1';

// Assets to cache immediately on install (App Shell)
// Chỉ include các file chắc chắn tồn tại, tránh lỗi addAll
const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/icon.svg',
];

// Install event - cache static assets (fault-tolerant)
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_STATIC).then(async (cache) => {
      console.log('[SW] Caching static assets');
      for (const url of STATIC_ASSETS) {
        try {
          await cache.add(new Request(url, { cache: 'reload' }));
        } catch (err) {
          console.warn('[SW] Failed to cache:', url, err.message);
        }
      }
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_STATIC && key !== CACHE_DYNAMIC)
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network-first for API, cache-first for static
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension, data:, blob: URLs
  if (!url.protocol.startsWith('http')) return;

  // API requests (Supabase, Firebase) - Network first, fallback to cache
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('fcm.googleapis.com') ||
    url.pathname.startsWith('/api/')
  ) {
    event.respondWith(networkFirst(request, CACHE_DYNAMIC));
    return;
  }

  // Static assets (HTML, JS, CSS, images, fonts) - Cache first
  if (
    request.destination === 'document' ||
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    request.destination === 'manifest' ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.ico')
  ) {
    event.respondWith(cacheFirst(request, CACHE_STATIC));
    return;
  }

  // Default: Network first
  event.respondWith(networkFirst(request, CACHE_DYNAMIC));
});

// Cache-first strategy (for static assets)
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    // Serve from cache, update in background (stale-while-revalidate)
    const fetchPromise = fetch(request)
      .then((response) => {
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
      .catch(() => cached);
    return cached;
  }

  // Not in cache - fetch and store
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    console.log('[SW] Cache first fetch failed:', request.url, err);
    // Return offline page for navigation requests
    if (request.destination === 'document') {
      return cache.match('/') || new Response('Offline', { status: 503 });
    }
    return new Response('Offline', { status: 503 });
  }
}

// Network-first strategy (for API calls)
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    console.log('[SW] Network first fetch failed:', request.url, err);
    const cached = await cache.match(request);
    if (cached) return cached;
    // Return offline fallback for API
    return new Response(
      JSON.stringify({ error: 'Offline', message: 'Không có kết nối mạng' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Background sync for offline mutations (optional, advanced)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncPendingMessages());
  }
});

async function syncPendingMessages() {
  // Could implement IndexedDB queue for offline messages
  console.log('[SW] Background sync: sync-messages');
}

// Push notification handling (FCM handles its own via firebase-messaging-sw.js)
// This SW can also handle custom push if needed
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  const options = {
    body: data.body || '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: data.data || {},
    actions: data.actions || [],
    tag: data.tag || 'hl-erp-notification',
    requireInteraction: true,
  };
  event.waitUntil(self.registration.showNotification(data.title || 'Hoàng Long ERP', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});