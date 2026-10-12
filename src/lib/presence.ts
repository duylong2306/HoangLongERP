// TRẠNG THÁI ONLINE / OFFLINE của nhân viên (Tin nhắn).
// Dùng Supabase Realtime "Presence": mỗi trình duyệt đang mở ứng dụng "điểm danh" vào 1 kênh riêng của công ty
// (key = id nhân viên). Khi đóng tab / thoát ứng dụng / mất mạng, kết nối đóng → Supabase tự gỡ khỏi danh sách.
//  • Mở nhiều tab cùng 1 tài khoản vẫn là 1 người (cùng key) — chỉ offline khi đóng hết các tab.
//  • Chỉ gửi id nhân viên + thời điểm, không gửi tên/dữ liệu khác.
//  • Kênh theo company_id nên người công ty khác không thấy.
// Không lưu gì vào cơ sở dữ liệu: "online" chỉ phản ánh hiện tại; offline hiển thị khoảng thời gian từ lúc app này nhìn thấy họ rời đi
// (nếu chưa từng thấy họ online trong phiên này thì chỉ ghi "Ngoại tuyến").
import { useEffect, useState } from 'react';
import { getSupabase, getCurrentCompanyId } from './supabase';

type Listener = () => void;

let online: Set<string> = new Set();
let lastSeen: Record<string, number> = {};   // id → thời điểm (ms) lần cuối app này thấy họ rời đi
const listeners = new Set<Listener>();
let channel: any = null;
let clientRef: any = null;
let currentUserId: string | null = null;
let watchdog: ReturnType<typeof setInterval> | null = null;
let pageHideHandler: (() => void) | null = null;

const emit = () => listeners.forEach(l => l());

/** Cập nhật danh sách online từ trạng thái presence (đối tượng { key: [meta...] }). Xuất ra để test. */
export function applyPresenceState(state: Record<string, unknown[]>, now = Date.now()) {
  const next = new Set(Object.keys(state || {}).filter(k => (state[k] || []).length > 0));
  // Ai vừa biến mất so với lần trước → ghi lại "lần cuối thấy"
  online.forEach(id => { if (!next.has(id)) lastSeen[id] = now; });
  online = next;
  emit();
}

export const isOnline = (id?: string | null) => !!id && online.has(id);
export const getLastSeen = (id?: string | null) => (id ? lastSeen[id] : undefined);
export const getOnlineIds = () => online;

/** "Vừa xong" / "5 phút trước" / "2 giờ trước" / "3 ngày trước". */
export function formatLastSeen(ts: number | undefined, now = Date.now()): string {
  if (!ts) return 'Ngoại tuyến';
  const m = Math.max(0, Math.floor((now - ts) / 60000));
  if (m < 1) return 'Hoạt động vừa xong';
  if (m < 60) return `Hoạt động ${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Hoạt động ${h} giờ trước`;
  return `Hoạt động ${Math.floor(h / 24)} ngày trước`;
}

function teardown() {
  if (watchdog) { clearInterval(watchdog); watchdog = null; }
  if (pageHideHandler) { window.removeEventListener('pagehide', pageHideHandler); pageHideHandler = null; }
  try { channel?.untrack?.(); } catch { /* bỏ qua */ }
  try { if (channel && clientRef) clientRef.removeChannel(channel); } catch { /* bỏ qua */ }
  channel = null; clientRef = null;
}

function connect() {
  const sb: any = getSupabase();
  const companyId = getCurrentCompanyId();
  if (!sb || !currentUserId || !companyId) return;
  clientRef = sb;
  channel = sb.channel(`presence_${companyId}`, { config: { presence: { key: currentUserId } } });
  channel
    .on('presence', { event: 'sync' }, () => applyPresenceState(channel.presenceState()))
    .subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') { try { await channel.track({ at: Date.now() }); } catch { /* bỏ qua */ } }
    });
}

/** Bắt đầu "điểm danh online" cho người dùng hiện tại. Gọi lại với cùng người thì không làm gì thêm. */
export function startPresence(userId: string) {
  if (typeof window === 'undefined') return;
  if (currentUserId === userId && channel) return;
  stopPresence();
  currentUserId = userId;
  connect();
  // Thoát tab/ứng dụng: gỡ ngay thay vì chờ Supabase phát hiện mất kết nối (vài chục giây)
  pageHideHandler = () => { try { channel?.untrack?.(); } catch { /* bỏ qua */ } };
  window.addEventListener('pagehide', pageHideHandler);
  // Đăng nhập lại/đổi mật khẩu làm tạo client Supabase mới (token mới) → kênh cũ chết: nối lại sang client mới.
  watchdog = setInterval(() => {
    if (currentUserId && getSupabase() !== clientRef) {
      try { if (channel && clientRef) clientRef.removeChannel(channel); } catch { /* bỏ qua */ }
      channel = null;
      connect();
    }
  }, 15000);
}

/** Dừng (đăng xuất): gỡ khỏi danh sách online và xóa trạng thái đã biết. */
export function stopPresence() {
  teardown();
  currentUserId = null;
  online = new Set(); lastSeen = {};
  emit();
}

/** Hook React: re-render khi ai đó online/offline. */
export function usePresence() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick(t => t + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return { isOnline, getLastSeen, formatLastSeen };
}
