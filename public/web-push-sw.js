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

/**
 * Chuẩn hoá URL deep link về dạng '/?taskId=...' — LUÔN nằm ở đường dẫn gốc '/'.
 *
 * ⚠️ QUAN TRỌNG: host chỉ phục vụ file tĩnh và KHÔNG có SPA fallback, nên mở
 * bất kỳ đường dẫn nào khác '/' (VD '/tasks/CV-1', '/messages') đều trả về 404.
 * Lỗi này lộ rõ nhất trên ĐIỆN THOẠI vì app thường đã đóng → service worker
 * phải openWindow tab mới thay vì focus tab đang mở.
 *
 * Hàm này còn dịch ngược định dạng CŨ ('/tasks/<id>') sang query string, để các
 * thông báo ĐÃ GỬI trước đây (vẫn nằm trên máy người dùng, không sửa được nữa)
 * khi bấm vào vẫn mở đúng chi tiết thay vì văng 404.
 *
 * Giữ đồng bộ với `normalizePushUrl` trong src/lib/pushDeepLink.ts.
 */
function hlNormalizePushUrl(data) {
  data = data || {};
  var taskId = data.taskId;
  var taskCode = data.taskCode;
  var conversationId = data.conversationId;
  var projectId = data.projectId;

  // Bóc thêm thông tin từ data.url (kể cả định dạng đường dẫn cũ)
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
  } catch (e) {
    /* URL rác → bỏ qua, rơi về '/' */
  }

  var params = new URLSearchParams();
  if (taskId) params.set('taskId', taskId);
  else if (taskCode) params.set('taskCode', taskCode);
  if (conversationId) params.set('conversation', conversationId);
  if (projectId && !taskId && !taskCode) params.set('projectId', projectId);

  var qs = params.toString();
  return qs ? '/?' + qs : '/';
}

// Click notification → focus/open app rồi điều hướng đến chi tiết tương ứng
//
// ⚠️ TRƯỚC ĐÂY so sánh `client.url === url`. App là SPA nên mọi tab đang mở đều
// ở '/' còn `url` là '/tasks/<id>' → KHÔNG BAO GIỜ khớp → luôn mở tab MỚI, và
// tab mới đó cũng không biết cách xử lý '/tasks/<id>' (app điều hướng bằng state,
// không có route). Kết quả: bấm thông báo chỉ mở thêm tab trắng ở trang chủ.
//
// BÂY GIỜ: khớp theo ORIGIN. Nếu app đang mở → focus tab đó và postMessage
// payload để app tự mở đúng modal chi tiết (không reload, giữ nguyên state).
// Nếu chưa mở → openWindow với query string deep link ('/?taskId=...').
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
        // Ưu tiên tab đang được focus, nếu không lấy tab đầu tiên
        const client = sameOrigin.find((c) => c.focused) || sameOrigin[0];
        try {
          if ('focus' in client) await client.focus();
        } catch (e) {
          /* focus có thể bị từ chối — vẫn gửi message để app điều hướng */
        }
        client.postMessage({
          type: 'HL_NOTIFICATION_CLICK',
          action: event.action || '',
          data,
        });
        return;
      }

      // Không có tab nào đang mở → mở mới kèm deep link trên query string
      await self.clients.openWindow(targetUrl);
    })()
  );
});

// Notification close event (for analytics)
self.addEventListener('notificationclose', (event) => {
  console.log('[Web Push SW] Notification closed:', event.notification.tag);
});

console.log('[Web Push SW] Service worker loaded for Web Push (VAPID)');