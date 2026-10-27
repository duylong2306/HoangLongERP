/**
 * Web Push Service Worker — thay thế Firebase Messaging
 *
 * Xử lý push notification từ Supabase Edge Function
 * using Web Push API (VAPID keys)
 */

// ── Huy hiệu số trên biểu tượng ứng dụng (App Badging API) ────────────────────────────────────────────
// Lúc ứng dụng ĐÃ ĐÓNG, mỗi thông báo đẩy cộng thêm 1 vào huy hiệu (số ước lượng). Số được giữ trong Cache 'hl-badge-v1' (khóa '/__badge') —
// cùng nơi ứng dụng ghi số thật khi mở (src/lib/appBadge.ts), nên mở ứng dụng là được đặt lại đúng. Đang mở và nhìn thấy ứng dụng thì bỏ qua
// (ứng dụng tự đặt số chính xác). Trình duyệt không hỗ trợ / lỗi → bỏ qua, không ảnh hưởng việc hiện thông báo.
const BADGE_CACHE = 'hl-badge-v1';
const BADGE_KEY = '/__badge';
async function bumpAppBadge() {
  try {
    if (!self.navigator || typeof self.navigator.setAppBadge !== 'function' || !self.caches) return;
    if (self.clients && self.clients.matchAll) {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (wins.some((c) => c.visibilityState === 'visible')) return;
    }
    const cache = await self.caches.open(BADGE_CACHE);
    const cur = await cache.match(BADGE_KEY);
    const n = (cur ? parseInt(await cur.text(), 10) || 0 : 0) + 1;
    await cache.put(BADGE_KEY, new Response(String(n)));
    await self.navigator.setAppBadge(n);
  } catch (e) { /* bỏ qua */ }
}

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

  // THẺ (tag) quyết định thông báo nào bị thay thế: cùng thẻ → thông báo mới ĐÈ thông báo cũ.
  // Máy chủ send-push đặt `tag` ở NGOÀI CÙNG gói push (không nằm trong data) — trước đây chỗ này chỉ đọc data.tag
  // nên mọi push đều rơi về một thẻ chung, tin sau đè tin trước của mọi hội thoại. Nay ưu tiên:
  //   1) thẻ máy chủ gửi riêng (VD nhắc điểm danh: 'attendance-<ca>-<ngày>');
  //   2) thẻ trong data;
  //   3) tin chat → MỖI HỘI THOẠI MỘT THÔNG BÁO ('conv-<mã>'): tin mới của cùng hội thoại thay tin cũ, hội thoại khác không bị đè.
  const DEFAULT_TAG = 'web-push-notification';
  const pickTag = () => {
    if (payload.tag && payload.tag !== DEFAULT_TAG) return payload.tag;   // thẻ mặc định của máy chủ = "không có thẻ riêng"
    if (notificationData.tag) return notificationData.tag;
    if (notificationData.conversationId) return 'conv-' + notificationData.conversationId;
    return DEFAULT_TAG;
  };
  const tag = pickTag();

  const options = {
    body: body || '',
    icon: icon || '/lolo-icon-192.png',
    image: image || '',
    data: notificationData,
    tag,
    // Thông báo thay thế theo thẻ vẫn phải RUNG/BÁO ÂM lại (mặc định trình duyệt thay lặng lẽ → mất tin mới)
    renotify: true,
    requireInteraction: true,
    badge: '/lolo-badge-72.png',
    vibrate: [200, 100, 200],
    timestamp: Date.now(),
  };

  // Nút bấm: máy chủ gửi `actions` ở ngoài cùng gói push (VD "Điểm danh ngay") — trước đây bị bỏ qua vì chỉ đọc data.actions
  const actions = Array.isArray(payload.actions) && payload.actions.length ? payload.actions
    : (Array.isArray(notificationData.actions) ? notificationData.actions : null);
  if (actions) {
    // Hàm send-push mặc định ghi nhãn nút KHÔNG DẤU ('Mo') — hiện đúng tiếng Việt ở phía máy khách, khỏi phải triển khai lại hàm
    options.actions = actions.map(a => (a && a.title === 'Mo' ? { ...a, title: 'Mở' } : a));
  } else if (notificationData.action) {
    options.actions = [{ action: 'open', title: 'Mở' }];
  }

  event.waitUntil(
    Promise.all([self.registration.showNotification(title || 'Thông báo mới', options), bumpAppBadge()])
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
  var targetKind = data.targetKind;
  var targetId = data.targetId;

  // Bóc thêm thông tin từ data.url (kể cả định dạng đường dẫn cũ)
  try {
    var u = new URL(data.url || '/', self.location.origin);
    var q = u.searchParams;
    taskId = taskId || q.get('taskId') || undefined;
    taskCode = taskCode || q.get('taskCode') || undefined;
    conversationId =
      conversationId || q.get('conversation') || q.get('conversationId') || undefined;
    projectId = projectId || q.get('projectId') || undefined;
    targetKind = targetKind || q.get('tk') || undefined;
    targetId = targetId || q.get('ti') || undefined;

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
  if (targetKind && targetId) { params.set('tk', targetKind); params.set('ti', targetId); }

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