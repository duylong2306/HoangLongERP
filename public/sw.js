// =====================================================================
// SERVICE WORKER "KILL SWITCH" — hệ thống Hoàng Long ERP CŨ đã CHUYỂN sang https://hoanglong.lolo.io.vn
// =====================================================================
// Ứng dụng cũ (đã cài lên điện thoại / máy tính) giữ bản của nó trong bộ nhớ đệm của service worker nên sẽ KHÔNG tự thấy việc
// chuyển hướng ở máy chủ. Tệp này thay thế service worker cũ để: (1) xóa toàn bộ bộ nhớ đệm, (2) tự gỡ đăng ký, (3) tải lại các
// cửa sổ đang mở — lúc đó không còn gì chặn ở giữa nên máy chủ chuyển hướng người dùng sang địa chỉ mới (vercel.json).
// Tệp này CỐ Ý không có trình xử lý "fetch": mọi yêu cầu đi thẳng ra mạng.
self.addEventListener('install', () => { self.skipWaiting(); });

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try { const keys = await caches.keys(); await Promise.all(keys.map((k) => caches.delete(k))); } catch (e) { /* bỏ qua */ }
    try { await self.registration.unregister(); } catch (e) { /* bỏ qua */ }
    try {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      wins.forEach((w) => { try { w.navigate(w.url); } catch (e) { /* bỏ qua */ } });
    } catch (e) { /* bỏ qua */ }
  })());
});
