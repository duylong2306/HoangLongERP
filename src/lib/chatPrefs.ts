import { isWorkThreadId } from './workThread';
// TÙY CHỌN RIÊNG của từng người trong Tin nhắn: tắt thông báo hội thoại, ghim hội thoại.
// Lưu trong localStorage theo người dùng + doanh nghiệp (không đồng bộ giữa các máy). Hàm thuần nhận storage để dễ kiểm tra.
// starred = hội thoại đánh dấu ⭐ "Quan tâm" (thay cho "ghim hội thoại"; pinned giữ lại để đọc dữ liệu cũ)
export interface ChatPrefs { muted: string[]; pinned: string[]; starred?: string[] }

export const prefsKey = (userId?: string) => `hl_chat_prefs_${userId || 'anon'}`;
type R = Pick<Storage, 'getItem'>; type W = Pick<Storage, 'setItem'>;
const ls = (): Storage | null => (typeof localStorage !== 'undefined' ? localStorage : null);

export function readPrefs(key: string, storage: R | null = ls()): ChatPrefs {
  try {
    const p = JSON.parse(storage?.getItem(key) || 'null');
    const arr = (v: any) => (Array.isArray(v) ? v.filter((x: any) => typeof x === 'string') : []);
    return { muted: arr(p?.muted), pinned: arr(p?.pinned), starred: arr(p?.starred) };
  } catch { return { muted: [], pinned: [], starred: [] }; }
}
export function writePrefs(key: string, prefs: ChatPrefs, storage: W | null = ls()) {
  try { storage?.setItem(key, JSON.stringify(prefs)); } catch { /* bỏ qua */ }
}
/** Bật/tắt 1 id trong danh sách — trả về bản mới (không sửa bản cũ). */
export const toggleIn = (list: string[], id: string): string[] => (list.includes(id) ? list.filter(x => x !== id) : [...list, id]);

/** Số tin chưa đọc để hiện trên huy hiệu menu: KHÔNG tính hội thoại đã tắt thông báo. */
export function unreadForBadge(convs: { id: string; unreadCount?: number }[], prefs: ChatPrefs): number {
  const muted = new Set(prefs.muted);
  return convs.reduce((s, c) => s + (muted.has(c.id) || isWorkThreadId(c.id) ? 0 : (c.unreadCount || 0)), 0);   // luồng "Việc của tôi" tính ở huy hiệu riêng
}
