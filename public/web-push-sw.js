// SERVICE WORKER thông báo đẩy của hệ thống CŨ — đã VÔ HIỆU HÓA vì hệ thống chuyển sang https://hoanglong.lolo.io.vn.
// Không còn nhận/hiện thông báo từ hệ thống cũ (thông báo mới đến từ địa chỉ mới; nhân viên bật lại thông báo ở đó). Tự gỡ đăng ký.
// Xem thêm public/sw.js (kill switch) và vercel.json (chuyển hướng).
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
