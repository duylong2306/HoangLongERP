// Logic thuần cho giao diện Tin nhắn kiểu mới: phân loại / lọc / sắp hội thoại, gom ảnh-tệp-liên kết, tin đã ghim, nhóm tin theo ngày.
import type { ChatMessage, Conversation } from '../types';
import type { ChatPrefs } from './chatPrefs';
import { isWorkThreadId } from './workThread';

export type ListTab = 'all' | 'unread';
export type Category = 'all' | 'personal' | 'group' | 'project' | 'task' | 'pinned' | 'muted';
export const CATEGORY_LABEL: Record<Category, string> = {
  all: 'Tất cả', personal: 'Cá nhân', group: 'Nhóm', project: 'Dự án', task: 'Công việc', pinned: 'Đã ghim', muted: 'Đã tắt thông báo',
};

/** Công trình = nhóm chat dự án (id conv_project_… hoặc có projectId); Công việc = type 'task'. */
export function categoryOf(c: Conversation): Exclude<Category, 'all' | 'pinned' | 'muted'> {
  if (c.type === 'personal') return 'personal';
  if (c.type === 'task') return 'task';
  if (c.projectId || String(c.id).startsWith('conv_project_')) return 'project';
  return 'group';
}
export const isPinnedConv = (c: Conversation, prefs: ChatPrefs) => !!c.pinned || prefs.pinned.includes(c.id);

const norm = (s?: string) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase();

export function filterConversations(
  convs: Conversation[],
  o: { userId: string; tab: ListTab; category: Category; query: string; prefs: ChatPrefs; nameOf?: (c: Conversation) => string },
): Conversation[] {
  const q = norm(o.query.trim());
  return convs
    .filter(c => c.participantIds.includes(o.userId) && !isWorkThreadId(c.id))   // luồng thảo luận "Việc của tôi" chỉ hiện ở tab Việc của tôi
    .filter(c => o.tab === 'all' || (c.unreadCount || 0) > 0)
    .filter(c => {
      if (o.category === 'all') return true;
      if (o.category === 'pinned') return isPinnedConv(c, o.prefs);
      if (o.category === 'muted') return o.prefs.muted.includes(c.id);
      return categoryOf(c) === o.category;
    })
    .filter(c => !q || norm(o.nameOf ? o.nameOf(c) : c.name).includes(q) || norm(c.lastMessage?.content).includes(q));
}

/** Ghim lên đầu; trong mỗi nhóm: có tin chưa đọc (không tắt thông báo) trước, rồi mới nhất. */
export function sortConversations(convs: Conversation[], prefs: ChatPrefs): Conversation[] {
  const muted = new Set(prefs.muted);
  const key = (c: Conversation) => (c.lastMessageAt || c.createdAt || '');
  return [...convs].sort((a, b) => {
    const pa = isPinnedConv(a, prefs) ? 1 : 0, pb = isPinnedConv(b, prefs) ? 1 : 0;
    if (pa !== pb) return pb - pa;
    const ua = (a.unreadCount || 0) > 0 && !muted.has(a.id) ? 1 : 0, ub = (b.unreadCount || 0) > 0 && !muted.has(b.id) ? 1 : 0;
    if (ua !== ub) return ub - ua;
    return key(b).localeCompare(key(a));
  });
}

// ─── Thông tin hội thoại: ảnh/video, tệp, liên kết gom từ tin nhắn ───
export interface MediaItem { id: string; msgId: string; url: string; name: string; at: string; kind: 'image' | 'file' }
export function collectMedia(msgs: ChatMessage[]): { images: MediaItem[]; files: MediaItem[] } {
  const images: MediaItem[] = [], files: MediaItem[] = [];
  for (const m of msgs) {
    if (m.deleted) continue;
    for (const a of m.attachments || []) {
      const isImg = a.type === 'image' || a.type === 'camera' || (a.mimeType || '').startsWith('image/');
      (isImg ? images : files).push({ id: a.id, msgId: m.id, url: a.url, name: a.name, at: m.createdAt, kind: isImg ? 'image' : 'file' });
    }
  }
  const byNewest = (a: MediaItem, b: MediaItem) => b.at.localeCompare(a.at);
  return { images: images.sort(byNewest), files: files.sort(byNewest) };
}
const URL_RE = /https?:\/\/[^\s<>"')]+/gi;
export function extractLinks(msgs: ChatMessage[]): { url: string; msgId: string; at: string }[] {
  const out: { url: string; msgId: string; at: string }[] = [];
  for (const m of msgs) {
    if (m.deleted) continue;
    for (const u of (m.content || '').match(URL_RE) || []) out.push({ url: u.replace(/[.,;:!?]+$/, ''), msgId: m.id, at: m.createdAt });
  }
  const seen = new Set<string>();
  return out.sort((a, b) => b.at.localeCompare(a.at)).filter(l => (seen.has(l.url) ? false : (seen.add(l.url), true)));
}
/** Tin đã ghim (chưa bị thu hồi), mới ghim/gửi nhất trước. */
export const pinnedMessages = (msgs: ChatMessage[]): ChatMessage[] =>
  msgs.filter(m => m.pinned && !m.deleted).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

// ─── Hiển thị ───
export function dayKey(iso: string): string { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function dayLabel(iso: string, now = new Date()): string {
  const k = dayKey(iso), t = dayKey(now.toISOString()), y = dayKey(new Date(now.getTime() - 86400000).toISOString());
  if (k === t) return 'Hôm nay'; if (k === y) return 'Hôm qua';
  const d = new Date(iso); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
/** Giờ trong danh sách: "Vừa xong", "4 phút", "2 giờ", "Hôm qua", hoặc dd/mm. */
export function listTime(iso?: string, now = new Date()): string {
  if (!iso) return '';
  const diffMin = Math.floor((now.getTime() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút`;
  const h = Math.floor(diffMin / 60);
  if (h < 24 && dayKey(iso) === dayKey(now.toISOString())) return `${h} giờ`;
  const label = dayLabel(iso, now);
  return label === 'Hôm qua' ? label : label.slice(0, 5);
}
/** Gộp tin liên tiếp của cùng người gửi (≤ 5 phút) để chỉ hiện ảnh/tên ở tin đầu. */
export function isFirstOfRun(msgs: ChatMessage[], i: number): boolean {
  if (i === 0) return true;
  const a = msgs[i - 1], b = msgs[i];
  return a.senderId !== b.senderId || a.system || b.system || dayKey(a.createdAt) !== dayKey(b.createdAt) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() > 5 * 60000;
}

/**
 * Giữ nguyên chỗ đang đọc sau khi tải thêm tin CŨ (chèn phía trên): vị trí cuộn mới = vị trí HIỆN TẠI + phần chiều cao vừa thêm.
 * Dùng vị trí hiện tại (không phải vị trí lúc bắt đầu tải) để nếu người dùng đã cuộn đi nơi khác trong lúc chờ — vd bấm "xuống cuối" —
 * thì không bị kéo ngược về chỗ cũ. Đang ở đáy (pinned) → trả null: không chỉnh, để cơ chế dính đáy lo.
 */
export function scrollTopAfterPrepend(o: { pinned: boolean; scrollTop: number; prevHeight: number; newHeight: number }): number | null {
  if (o.pinned) return null;
  return Math.max(0, o.scrollTop + (o.newHeight - o.prevHeight));
}
