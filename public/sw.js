// =====================================================================
// PWA Service Worker - Offline caching & Installable app
// =====================================================================
// Cache name with version for easy updates
// ⚠️ Tăng số phiên bản mỗi khi sửa chiến lược cache, để `activate` dọn cache cũ.
// v2: thêm SPA navigation fallback (sửa lỗi 404 khi bấm thông báo đẩy).
const CACHE_NAME = 'hl-erp-v2';
const CACHE_STATIC = 'hl-erp-static-v2';
const CACHE_DYNAMIC = 'hl-erp-dynamic-v2';

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

  // ─── SPA NAVIGATION FALLBACK ───────────────────────────────────────────
  // App là SPA nhưng host chỉ phục vụ file tĩnh (không có rewrite về
  // index.html). Mọi điều hướng tới đường dẫn không phải file thật → 404.
  // Đây chính là màn hình 404 khi bấm thông báo đẩy trên điện thoại.
  //
  // Với MỌI request điều hướng: thử mạng trước; nếu server trả 404/5xx (hoặc
  // mất mạng) thì phục vụ app shell '/' để React tự route bằng query string.
  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request));
    return;
  }

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

/**
 * Xử lý request điều hướng (mở trang / bấm link / mở từ thông báo đẩy).
 *
 * Thứ tự: mạng → nếu 404/lỗi thì trả app shell '/' (từ mạng hoặc cache).
 * Nhờ vậy '/tasks/CV-1' của các thông báo CŨ vẫn vào được app thay vì 404;
 * React đọc query string / đường dẫn rồi tự mở đúng màn hình.
 */
async function navigationHandler(request) {
  const cache = await caches.open(CACHE_STATIC);

  try {
    const response = await fetch(request);
    if (response.ok) return response;
    // Server trả 404/5xx cho một "route" của SPA → phục vụ app shell thay thế
    console.warn('[SW] Điều hướng', request.url, '→', response.status, '· trả app shell');
  } catch (err) {
    console.log('[SW] Điều hướng thất bại (offline?):', request.url);
  }

  // Ưu tiên app shell trong cache; nếu chưa có thì tải '/' từ mạng
  const shell = await cache.match('/');
  if (shell) return shell;

  try {
    const rootResponse = await fetch('/');
    if (rootResponse.ok) {
      cache.put('/', rootResponse.clone());
      return rootResponse;
    }
  } catch (err) {
    /* vẫn không được → trả thông báo offline bên dưới */
  }

  return new Response('Offline', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

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

// Chuẩn hoá URL deep link về '/?taskId=...' (luôn ở đường dẫn gốc, tránh 404
// vì host không có SPA fallback) + dịch ngược định dạng cũ '/tasks/<id>'.
// Giữ đồng bộ với public/web-push-sw.js và src/lib/pushDeepLink.ts.
function hlNormalizePushUrl(data) {
  data = data || {};
  var taskId = data.taskId;
  var taskCode = data.taskCode;
  var conversationId = data.conversationId;
  var projectId = data.projectId;

  try {
    var u = new URL(data.url || '/', self.location.origin);
    var q = u.searchParams;
    taskId = taskId || q.get('taskId') || undefined;
    taskCode = taskCode || q.get('taskCode') || undefined;
    conversationId =
      conversationId || q.get('conversation') || q.get('conversationId') || undefined;
    projectId = projectId || q.get('projectId') || undefined;

    var legacy = u.pathname.match(/^\/(tasks|projects|messages)\/([^/]+)\/?$/);
    if (legacy) {
      var id = decodeURIComponent(legacy[2]);
      if (legacy[1] === 'tasks' && !taskId) taskId = id;
      if (legacy[1] === 'projects' && !projectId) projectId = id;
      if (legacy[1] === 'messages' && !conversationId) conversationId = id;
    }
  } catch (e) { /* URL rác → rơi về '/' */ }

  var params = new URLSearchParams();
  if (taskId) params.set('taskId', taskId);
  else if (taskCode) params.set('taskCode', taskCode);
  if (conversationId) params.set('conversation', conversationId);
  if (projectId && !taskId && !taskCode) params.set('projectId', projectId);

  var qs = params.toString();
  return qs ? '/?' + qs : '/';
}

// Bấm thông báo → focus tab app đang mở & postMessage deep link, hoặc mở tab mới.
// (Cùng logic với public/web-push-sw.js — xem giải thích chi tiết ở file đó.)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const targetUrl = self.location.origin + hlNormalizePushUrl(data);

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      const sameOrigin = clientList.filter((c) => {
        try {
          return new URL(c.url).origin === self.location.origin;
        } catch (e) {
          return false;
        }
      });

      if (sameOrigin.length > 0) {
        const client = sameOrigin.find((c) => c.focused) || sameOrigin[0];
        try {
          if ('focus' in client) await client.focus();
        } catch (e) { /* bỏ qua */ }
        client.postMessage({
          type: 'HL_NOTIFICATION_CLICK',
          action: event.action || '',
          data,
        });
        return;
      }

      await self.clients.openWindow(targetUrl);
    })()
  );
});