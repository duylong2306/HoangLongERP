// GHI NHỚ MENU DÙNG GẦN NHẤT cho các lần đăng nhập/mở ứng dụng sau (theo từng người + từng doanh nghiệp).
// Lưu trang đang mở và các tab con (nhân sự, tài chính, bảng điều hành giám đốc). Hàm thuần nhận storage để dễ kiểm tra.
export interface LastMenu { tab: string; hr?: string; fin?: string; dir?: string }
export const lastMenuKey = (userId?: string) => `hl_last_menu_${userId || 'anon'}`;
type R = Pick<Storage, 'getItem'>; type W = Pick<Storage, 'setItem'>;
const ls = (): Storage | null => (typeof localStorage !== 'undefined' ? localStorage : null);
const str = (v: unknown, max = 60) => (typeof v === 'string' && v.length > 0 && v.length <= max && /^[\w-]+$/.test(v) ? v : undefined);

export function readLastMenu(key: string, storage: R | null = ls()): LastMenu | null {
  try {
    const p = JSON.parse(storage?.getItem(key) || 'null');
    const tab = str(p?.tab);
    return tab ? { tab, hr: str(p?.hr), fin: str(p?.fin), dir: str(p?.dir) } : null;   // dữ liệu hỏng / giá trị lạ → bỏ
  } catch { return null; }
}
export function writeLastMenu(key: string, m: LastMenu, storage: W | null = ls()) {
  try { storage?.setItem(key, JSON.stringify(m)); } catch { /* trình duyệt chặn lưu → bỏ qua */ }
}
/** Trang không nên mở lại tự động (cần ngữ cảnh/đường dẫn riêng). */
export const NOT_RESTORABLE = new Set(['', 'login']);
