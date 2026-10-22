// NHẮC CÀI ỨNG DỤNG RA MÀN HÌNH CHÍNH (PWA) — Android: nút "Cài đặt" gọi hộp thoại cài của Chrome; iPhone/iPad: hướng dẫn "Thêm vào Màn hình chính".
// Hàm thuần (nhận userAgent…) để dễ kiểm tra.
export type InstallPlatform = 'android' | 'ios' | 'other';

export function detectPlatform(ua: string, platform = '', maxTouchPoints = 0): InstallPlatform {
  if (/iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1)) return 'ios';   // iPadOS mới tự nhận là Mac nhưng có cảm ứng
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}
/** Trình duyệt trong ứng dụng khác (Zalo, Facebook, Messenger…) không cài được/không có nút Chia sẻ đúng → không hiện hướng dẫn. */
export const isInAppBrowser = (ua: string) => /FBAN|FBAV|Instagram|Zalo|Line\/|MicroMessenger|Messenger/i.test(ua);

export const SNOOZE_KEY = 'hl_install_prompt_snooze_until';
export const INSTALLED_KEY = 'hl_install_prompt_installed';
export const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;   // bấm "Để sau" → nhắc lại sau 3 ngày
type R = Pick<Storage, 'getItem'>; type W = Pick<Storage, 'setItem'>;
const ls = (): Storage | null => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } };

export function isSnoozed(now = Date.now(), storage: R | null = ls()): boolean {
  try { return storage?.getItem(INSTALLED_KEY) === '1' || Number(storage?.getItem(SNOOZE_KEY) || 0) > now; } catch { return false; }
}
export function snooze(now = Date.now(), storage: W | null = ls()) { try { storage?.setItem(SNOOZE_KEY, String(now + SNOOZE_MS)); } catch { /* bỏ qua */ } }
export function markInstalled(storage: W | null = ls()) { try { storage?.setItem(INSTALLED_KEY, '1'); } catch { /* bỏ qua */ } }
