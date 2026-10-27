// "Đã xem nhật ký đến lúc nào" của từng người theo từng dự án → số hoạt động mới (chấm số + dải "Cập nhật mới").
// Chưa chạy migration 20261028_project_event_reads.sql thì mọi hàm trả rỗng / bỏ qua, ứng dụng vẫn chạy bình thường.
import { getSupabase, getCurrentCompanyId } from './supabase';

export interface UnreadSummary {
  count: number;
  /** Vài hoạt động mới nhất (mới → cũ) để hiện tóm tắt trên dải */
  latest: { text: string; actorName?: string }[];
}

const MAX_ROWS = 1000;      // giới hạn số sự kiện mới đọc 1 lần (đủ để đếm; quá thì hiện "99+")
const LATEST_KEEP = 2;
let tableMissing = false;   // nhớ trong phiên: bảng chưa có thì khỏi thử lại
const isMissingTable = (error: any) => {
  const code = error?.code as string | undefined;
  return code === '42P01' || code === 'PGRST205' || /does not exist|schema cache|Could not find the table/i.test(error?.message || '');
};

/** Chỉ dùng cho kiểm thử */
export function __resetProjectEventReadsState() { tableMissing = false; }

/** Mã dự án của 1 hội thoại nhóm dự án (không tính hội thoại của riêng 1 công việc); không phải nhóm dự án → undefined */
export function projectIdOfConversation(c: { id: string; projectId?: string; taskId?: string }): string | undefined {
  if (c.taskId) return undefined;
  if (c.projectId) return c.projectId;
  return c.id.startsWith('conv_project_') ? c.id.slice('conv_project_'.length) : undefined;
}

/**
 * Số hoạt động mới của từng dự án kể từ lần người dùng xem nhật ký gần nhất (không tính việc do chính họ làm).
 * Dự án chưa có mốc (lần đầu) → đặt mốc = bây giờ, để không báo "mới" cho cả lịch sử cũ.
 */
export async function loadUnreadSummary(userId: string, projectIds: string[]): Promise<Record<string, UnreadSummary>> {
  try {
    if (tableMissing || !userId || projectIds.length === 0) return {};
    const supabase = getSupabase(); const companyId = getCurrentCompanyId();
    if (!supabase || !companyId) return {};
    const reads = await supabase.from('project_event_reads').select('project_id,last_seen_at').eq('user_id', userId).in('project_id', projectIds);
    if (reads.error) { if (isMissingTable(reads.error)) tableMissing = true; return {}; }
    const seen: Record<string, string> = {};
    (reads.data || []).forEach((r: any) => { seen[r.project_id] = r.last_seen_at; });
    // Lần đầu: đặt mốc cho các dự án chưa có
    const fresh = projectIds.filter(id => !seen[id]);
    if (fresh.length) {
      const now = new Date().toISOString();
      await supabase.from('project_event_reads').upsert(fresh.map(id => ({ company_id: companyId, user_id: userId, project_id: id, last_seen_at: now })), { onConflict: 'company_id,user_id,project_id' });
    }
    const ids = projectIds.filter(id => seen[id]);
    if (ids.length === 0) return {};
    const since = ids.map(id => seen[id]).sort()[0]; // mốc cũ nhất; mốc riêng từng dự án lọc lại ở dưới
    const ev = await supabase.from('project_events').select('project_id,created_at,actor_id,actor_name,text')
      .in('project_id', ids).gt('created_at', since).order('created_at', { ascending: false }).limit(MAX_ROWS);
    if (ev.error) return {};
    const out: Record<string, UnreadSummary> = {};
    (ev.data || []).forEach((r: any) => {
      if (r.actor_id === userId) return;                                  // việc của chính mình không tính là "mới"
      if (!(r.created_at > seen[r.project_id])) return;                   // cũ hơn mốc của dự án này
      const s = out[r.project_id] || (out[r.project_id] = { count: 0, latest: [] });
      s.count++;
      if (s.latest.length < LATEST_KEEP) s.latest.push({ text: r.text, actorName: r.actor_name || undefined });
    });
    return out;
  } catch {
    return {};
  }
}

/** Đánh dấu đã xem nhật ký dự án đến bây giờ (gọi khi mở / đóng khung nhật ký) */
export async function markProjectSeen(userId: string, projectId: string): Promise<void> {
  try {
    if (tableMissing || !userId || !projectId) return;
    const supabase = getSupabase(); const companyId = getCurrentCompanyId();
    if (!supabase || !companyId) return;
    const { error } = await supabase.from('project_event_reads').upsert(
      { company_id: companyId, user_id: userId, project_id: projectId, last_seen_at: new Date().toISOString() },
      { onConflict: 'company_id,user_id,project_id' });
    if (error) { if (isMissingTable(error)) tableMissing = true; return; }
    try { window.dispatchEvent(new CustomEvent('hl-project-seen', { detail: { projectId } })); } catch { /* không có window */ }
  } catch { /* không để lỗi ảnh hưởng giao diện */ }
}
