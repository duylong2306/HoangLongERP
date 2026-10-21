import { isWorkThreadId } from './workThread';
// TÙY CHỌN RIÊNG của từng người trong Tin nhắn: tắt thông báo hội thoại, ghim hội thoại, kiểu giao diện (cũ/mới).
// Lưu trong localStorage theo người dùng + doanh nghiệp (không đồng bộ giữa các máy). Hàm thuần nhận storage để dễ kiểm tra.
export interface ChatPrefs { muted: string[]; pinned: string[] }
export type MessagesUi = 'new' | 'classic';
export const MESSAGES_UI_DEFAULT: MessagesUi = 'new';   // mặc định kiểu mới (kiểu Zalo)

export const prefsKey = (userId?: string) => `hl_chat_prefs_${userId || 'anon'}`;
export const uiKey = (userId?: string) => `hl_messages_ui_${userId || 'anon'}`;
type R = Pick<Storage, 'getItem'>; type W = Pick<Storage, 'setItem'>;
const ls = (): Storage | null => (typeof localStorage !== 'undefined' ? localStorage : null);

export function readPrefs(key: string, storage: R | null = ls()): ChatPrefs {
  try {
    const p = JSON.parse(storage?.getItem(key) || 'null');
    const arr = (v: any) => (Array.isArray(v) ? v.filter((x: any) => typeof x === 'string') : []);
    return { muted: arr(p?.muted), pinned: arr(p?.pinned) };
  } catch { return { muted: [], pinned: [] }; }
}
export function writePrefs(key: string, prefs: ChatPrefs, storage: W | null = ls()) {
  try { storage?.setItem(key, JSON.stringify(prefs)); } catch { /* bỏ qua */ }
}
/** Bật/tắt 1 id trong danh sách — trả về bản mới (không sửa bản cũ). */
export const toggleIn = (list: string[], id: string): string[] => (list.includes(id) ? list.filter(x => x !== id) : [...list, id]);

export function readMessagesUi(key: string, storage: R | null = ls()): MessagesUi {
  try { const v = storage?.getItem(key); return v === 'classic' || v === 'new' ? v : MESSAGES_UI_DEFAULT; } catch { return MESSAGES_UI_DEFAULT; }
}
export function writeMessagesUi(key: string, v: MessagesUi, storage: W | null = ls()) {
  try { storage?.setItem(key, v); } catch { /* bỏ qua */ }
}

/** Số tin chưa đọc để hiện trên huy hiệu menu: KHÔNG tính hội thoại đã tắt thông báo. */
export function unreadForBadge(convs: { id: string; unreadCount?: number }[], prefs: ChatPrefs): number {
  const muted = new Set(prefs.muted);
  return convs.reduce((s, c) => s + (muted.has(c.id) || isWorkThreadId(c.id) ? 0 : (c.unreadCount || 0)), 0);   // luồng "Việc của tôi" tính ở huy hiệu riêng
}
