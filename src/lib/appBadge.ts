// HUY HIỆU SỐ TRÊN BIỂU TƯỢNG ỨNG DỤNG (khi đã "Thêm vào Màn hình chính" / cài ứng dụng) bằng App Badging API (navigator.setAppBadge).
// Hỗ trợ: iPhone iOS 16.4+ (đã cho phép thông báo), Chrome/Edge trên Android và máy tính (một số máy Android chỉ hiện chấm thay vì số).
//   • Ứng dụng ĐANG MỞ: đặt đúng con số ở menu Tin nhắn (tin chưa đọc + số dự án có nhật ký mới) — hook useAppBadge.
//   • Ứng dụng ĐÃ ĐÓNG: service worker (public/web-push-sw.js) cộng thêm 1 mỗi thông báo đẩy (số ước lượng), đọc/ghi cùng bộ nhớ
//     (Cache 'hl-badge-v1', khóa '/__badge') với lib này; mở ứng dụng lên thì được đặt lại về số thật.
import { useEffect } from 'react';

export const BADGE_CACHE = 'hl-badge-v1';
export const BADGE_KEY = '/__badge';

/** Số hợp lệ để hiện: nguyên, không âm; không phải số → 0 */
export const normalizeBadge = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);

export const badgeSupported = (): boolean => typeof navigator !== 'undefined' && typeof (navigator as any).setAppBadge === 'function';

/** Đặt (hoặc xóa khi 0) huy hiệu và ghi nhớ số thật để service worker cộng tiếp từ đó. Mọi lỗi bị bỏ qua — huy hiệu không bao giờ làm hỏng ứng dụng. */
export async function applyAppBadge(count: number): Promise<void> {
  try {
    if (!badgeSupported()) return;
    const n = normalizeBadge(count);
    if (n > 0) await (navigator as any).setAppBadge(n);
    else if (typeof (navigator as any).clearAppBadge === 'function') await (navigator as any).clearAppBadge();
    else await (navigator as any).setAppBadge(0);
    if (typeof caches !== 'undefined') await (await caches.open(BADGE_CACHE)).put(BADGE_KEY, new Response(String(n)));
  } catch { /* trình duyệt từ chối / không hỗ trợ → bỏ qua */ }
}

/** Giữ huy hiệu bằng `count`: đặt khi số đổi và đặt lại khi quay về cửa sổ (service worker có thể đã cộng ước lượng lúc ứng dụng ẩn) */
export function useAppBadge(count: number): void {
  useEffect(() => {
    applyAppBadge(count);
    const reapply = () => { if (document.visibilityState === 'visible') applyAppBadge(count); };
    window.addEventListener('focus', reapply);
    document.addEventListener('visibilitychange', reapply);
    return () => { window.removeEventListener('focus', reapply); document.removeEventListener('visibilitychange', reapply); };
  }, [count]);
}
