// NHẬT KÝ HOẠT ĐỘNG DỰ ÁN — mỗi sự kiện của dự án / công việc / nhiệm vụ / đề xuất là 1 dòng trong bảng project_events
// (migration 20261027). Thay cho việc gửi tin "hệ thống" vào nhóm chat dự án: nhóm chat chỉ còn để thảo luận.
//
// Nguyên tắc an toàn:
//   • Ghi nhật ký KHÔNG BAO GIỜ làm hỏng thao tác chính (mọi lỗi chỉ cảnh báo console);
//   • CHƯA chạy migration (bảng chưa có) → recordProjectEvent trả false để nơi gọi gửi tin vào nhóm chat như cũ,
//     nên bật tính năng này không làm mất thông báo của nhân viên đang dùng thật.
import { getSupabase, getCurrentCompanyId } from './supabase';

export type ProjectEventType = 'tao' | 'giao' | 'tt' | 'han' | 'duyet' | 'tc' | 'xoa' | 'khac';

export interface ProjectEventInput {
  projectId: string;
  taskId?: string;
  missionId?: string;
  actor?: { id?: string; name?: string };
  /** Bỏ trống → tự đoán theo biểu tượng đầu câu (xem classifyEvent) */
  type?: ProjectEventType;
  objKind?: 'project' | 'task' | 'mission' | 'proposal' | 'payment' | 'material';
  objName?: string;
  text: string;
  detail?: string;
  from?: string;
  to?: string;
}

export interface ProjectEventRow {
  id: string;
  projectId: string;
  taskId?: string;
  missionId?: string;
  actorId?: string;
  actorName?: string;
  type: ProjectEventType;
  objKind?: string;
  objName?: string;
  text: string;
  detail?: string;
  from?: string;
  to?: string;
  /** Ảnh / tệp đính kèm (vd. báo cáo hoàn thành kèm ảnh — chuyển từ tin nhóm chat cũ) */
  attachments?: { id?: string; type?: string; name?: string; url: string }[];
  createdAt: string;
}

/** Nhãn + biểu tượng + màu từng loại — dùng chung cho dòng thời gian và file Excel */
export const EVENT_TYPE_META: Record<ProjectEventType, { icon: string; label: string; tone: string }> = {
  tao:   { icon: '➕', label: 'Tạo mới',        tone: 'sky' },
  giao:  { icon: '📌', label: 'Giao việc',      tone: 'blue' },
  tt:    { icon: '🔄', label: 'Trạng thái',     tone: 'emerald' },
  han:   { icon: '⏰', label: 'Hạn / ưu tiên',  tone: 'amber' },
  duyet: { icon: '✅', label: 'Duyệt',          tone: 'violet' },
  tc:    { icon: '💰', label: 'Tài chính',      tone: 'rose' },
  xoa:   { icon: '🗑️', label: 'Xóa / sửa',      tone: 'red' },
  khac:  { icon: '📝', label: 'Khác',           tone: 'slate' },
};

/**
 * Đoán loại sự kiện + tách biểu tượng đầu câu khỏi nội dung — để các tin hệ thống cũ (đã có biểu tượng đầu câu)
 * chuyển sang nhật ký mà không phải sửa từng câu. Biểu tượng KHÔNG nằm trong text lưu (giao diện tự vẽ theo loại).
 */
export function classifyEvent(content: string): { type: ProjectEventType; text: string } {
  const s = (content || '').trim();
  const lower = s.toLowerCase();
  const first = Array.from(s)[0] || '';
  let type: ProjectEventType = 'khac';
  if (/xóa|hủy|bị hủy/.test(lower) || first === '🗑') type = 'xoa';
  else if (/hạn|ưu tiên/.test(lower) && /đổi|cập nhật/.test(lower)) type = 'han';
  else if (first === '✅' || first === '❌' || first === '🔔' || /duyệt|từ chối|xét duyệt/.test(lower)) type = 'duyet';
  else if (first === '💰' || first === '📦' || first === '🛒' || first === '🚚' || /phiếu chi|tạm ứng|vật tư|công tác phí/.test(lower)) type = 'tc';
  else if (['📌', '🧩', '👤', '🔓', '➖'].includes(first) || /giao cho|phụ trách|thêm .* vào|chuyển trưởng/.test(lower)) type = 'giao';
  else if (first === '🔄' || first === '🙋' || first === '🎉' || /hoàn thành|nhận việc|trạng thái|giai đoạn/.test(lower)) type = 'tt';
  else if (first === '📝' || first === '➕' || /khởi tạo|tạo /.test(lower)) type = 'tao';
  // Bỏ biểu tượng/ký hiệu đứng đầu (không phải chữ/số) cho gọn
  const text = s.replace(/^[^\p{L}\p{N}"“\[\(]+/u, '').trim();
  return { type, text: text || s };
}

let tableMissing = false; // nhớ trong phiên: bảng chưa có thì khỏi thử lại mỗi lần (tránh spam lỗi mạng)
const isMissingTable = (error: any) => {
  const code = error?.code as string | undefined;
  return code === '42P01' || code === 'PGRST205' || /does not exist|schema cache|Could not find the table/i.test(error?.message || '');
};

/** Chỉ dùng cho kiểm thử: đặt lại cờ "bảng chưa có" */
export function __resetProjectEventsState() { tableMissing = false; }

/**
 * Ghi 1 sự kiện vào nhật ký. Trả về true nếu đã lưu; false nếu chưa lưu được (chưa chạy migration / lỗi mạng) —
 * nơi gọi nên dùng false để gửi tin vào nhóm chat theo cách cũ, tránh mất thông báo.
 */
export async function recordProjectEvent(input: ProjectEventInput): Promise<boolean> {
  try {
    if (!input.projectId || !input.text) return false;
    if (tableMissing) return false;
    const supabase = getSupabase(); const companyId = getCurrentCompanyId();
    if (!supabase || !companyId) return false;
    const { error } = await supabase.from('project_events').insert({
      company_id: companyId,
      project_id: input.projectId,
      task_id: input.taskId ?? null,
      mission_id: input.missionId ?? null,
      actor_id: input.actor?.id ?? null,
      actor_name: input.actor?.name ?? null,
      type: input.type || classifyEvent(input.text).type,
      obj_kind: input.objKind ?? null,
      obj_name: input.objName ?? null,
      text: input.text,
      detail: input.detail ?? null,
      from_val: input.from ?? null,
      to_val: input.to ?? null,
    });
    if (error) {
      if (isMissingTable(error)) tableMissing = true;
      console.warn('Ghi nhật ký dự án thất bại:', error.message);
      return false;
    }
    // Báo cho khung đang mở nhật ký tải lại ngay
    try { window.dispatchEvent(new CustomEvent('hl-project-events-updated', { detail: { projectId: input.projectId, taskId: input.taskId } })); } catch { /* môi trường không có window */ }
    return true;
  } catch (e: any) {
    console.warn('Ghi nhật ký dự án lỗi:', e?.message || e);
    return false;
  }
}

/**
 * Chuyển 1 tin hệ thống (nội dung có thể nhiều dòng, biểu tượng đầu câu) thành sự kiện nhật ký:
 * dòng đầu = tóm tắt, các dòng sau = chi tiết. Trả về kết quả ghi (xem recordProjectEvent).
 */
export function recordProjectEventFromMessage(
  content: string,
  ctx: Omit<ProjectEventInput, 'text' | 'detail' | 'type'> & { type?: ProjectEventType },
): Promise<boolean> {
  const [head, ...rest] = (content || '').split('\n');
  const cls = classifyEvent(head);
  // Giao diện đã in đậm tên người làm trước nội dung → bỏ tên đứng đầu câu (tin cũ viết "Long đã duyệt…") để khỏi hiện "Long Long đã…"
  let text = cls.text;
  const name = ctx.actor?.name?.trim();
  if (name && text.toLowerCase().startsWith(name.toLowerCase() + ' ')) text = text.slice(name.length).trim();
  return recordProjectEvent({ ...ctx, type: ctx.type || cls.type, text, detail: rest.join('\n').trim() || undefined });
}

export interface LoadEventsResult { ok: boolean; rows: ProjectEventRow[]; notEnabled?: boolean; message?: string }
/** 1 "trang" nhật ký = các sự kiện của 3 ngày liền nhau (có sự kiện), giống tải tin nhắn cũ khi cuộn lên */
export interface LoadEventsPage extends LoadEventsResult {
  /** Mốc để tải trang kế tiếp (truyền vào `before`); rỗng khi đã hết */
  nextBefore?: string;
  hasMore: boolean;
}

/** Số ngày (theo lịch có sự kiện) mỗi lần tải — người dùng yêu cầu ~3 ngày / 1 lần cuộn */
export const EVENT_PAGE_DAYS = 3;
const MAX_PAGE_ROWS = 1000; // chặn cứng để 3 ngày quá dày (nhập hàng loạt) không kéo cả nghìn dòng

const toRow = (r: any): ProjectEventRow => ({
  id: r.id, projectId: r.project_id, taskId: r.task_id || undefined, missionId: r.mission_id || undefined,
  actorId: r.actor_id || undefined, actorName: r.actor_name || undefined,
  type: (EVENT_TYPE_META[r.type as ProjectEventType] ? r.type : 'khac') as ProjectEventType,
  objKind: r.obj_kind || undefined, objName: r.obj_name || undefined,
  text: r.text, detail: r.detail || undefined, from: r.from_val || undefined, to: r.to_val || undefined,
  attachments: Array.isArray(r.attachments) && r.attachments.length ? r.attachments : undefined,
  createdAt: r.created_at,
});

/** Đầu ngày (giờ máy người dùng) của 1 thời điểm */
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

/**
 * Tải 1 trang nhật ký: lấy sự kiện mới nhất TRƯỚC mốc `before` (mặc định = bây giờ), rồi lấy trọn
 * EVENT_PAGE_DAYS ngày tính từ ngày của sự kiện đó trở lại. Ngày không có sự kiện không tính vào 3 ngày
 * (dự án nghỉ lâu thì vẫn tải được cụm hoạt động kế trước, không trả trang rỗng).
 * Truyền taskId để chỉ lấy "Lịch sử" riêng của 1 công việc. notEnabled=true khi chưa chạy migration.
 */
export interface EventFilters {
  type?: ProjectEventType;
  /** Dự án / công việc / nhiệm vụ / đề xuất… (cột obj_kind) */
  objKind?: string;
  actorName?: string;
  /** Tìm chữ trong nội dung, tên đối tượng, người làm, chi tiết */
  q?: string;
  /** Khoảng ngày yyyy-mm-dd (giờ máy người dùng), gồm cả ngày `to` */
  from?: string;
  to?: string;
}

/** Làm sạch từ khóa để ghép vào bộ lọc PostgREST .or(...) (bỏ dấu phẩy, ngoặc, % _ — các ký tự đặc biệt của cú pháp) */
export const cleanSearch = (q: string) => q.replace(/[,()%_*\\]/g, ' ').replace(/\s+/g, ' ').trim();

export async function loadProjectEventsPage(projectId: string, opts: { taskId?: string; before?: string; filters?: EventFilters } = {}): Promise<LoadEventsPage> {
  try {
    const supabase = getSupabase();
    if (!supabase) return { ok: false, rows: [], hasMore: false, message: 'Chưa kết nối cơ sở dữ liệu.' };
    const f = opts.filters || {};
    // Mốc trên: nhỏ hơn của (mốc tải trang trước, hết ngày `to`)
    const toEnd = f.to ? new Date(`${f.to}T00:00:00`) : null; if (toEnd) toEnd.setDate(toEnd.getDate() + 1);
    const upper = [opts.before, toEnd?.toISOString()].filter(Boolean).sort()[0] as string | undefined;
    const base = () => {
      let q = supabase.from('project_events').select('*').eq('project_id', projectId);
      if (opts.taskId) q = q.eq('task_id', opts.taskId);
      if (f.type) q = q.eq('type', f.type);
      if (f.objKind) q = q.eq('obj_kind', f.objKind);
      if (f.actorName) q = q.eq('actor_name', f.actorName);
      if (f.from) q = q.gte('created_at', new Date(`${f.from}T00:00:00`).toISOString());
      const kw = f.q ? cleanSearch(f.q) : '';
      if (kw) q = q.or(`text.ilike.%${kw}%,obj_name.ilike.%${kw}%,actor_name.ilike.%${kw}%,detail.ilike.%${kw}%`);
      return q;
    };
    const fail = (error: any): LoadEventsPage => {
      const missing = isMissingTable(error);
      if (missing) tableMissing = true;
      return { ok: false, rows: [], hasMore: false, notEnabled: missing, message: error?.message };
    };
    // 1) Sự kiện mới nhất trước mốc → xác định ngày bắt đầu của trang
    let q1 = base();
    if (upper) q1 = q1.lt('created_at', upper);
    const head = await q1.order('created_at', { ascending: false }).limit(1);
    if (head.error) return fail(head.error);
    if (!head.data || head.data.length === 0) return { ok: true, rows: [], hasMore: false };
    const newest = new Date(head.data[0].created_at);
    const windowStart = startOfDay(newest); windowStart.setDate(windowStart.getDate() - (EVENT_PAGE_DAYS - 1)); // đầu ngày, lùi 2 ngày
    // 2) Toàn bộ sự kiện trong cửa sổ [windowStart, mốc]
    let q2 = base().gte('created_at', windowStart.toISOString());
    if (upper) q2 = q2.lt('created_at', upper);
    const body = await q2.order('created_at', { ascending: false }).limit(MAX_PAGE_ROWS);
    if (body.error) return fail(body.error);
    const rows = (body.data || []).map(toRow);
    // Nếu cắt ở MAX_PAGE_ROWS thì mốc kế tiếp = sự kiện cuối cùng đã lấy (không bỏ sót dòng nào)
    const truncated = rows.length >= MAX_PAGE_ROWS;
    const nextBefore = truncated ? rows[rows.length - 1].createdAt : windowStart.toISOString();
    // 3) Còn sự kiện cũ hơn không?
    let q3 = base().lt('created_at', nextBefore);
    const more = await q3.order('created_at', { ascending: false }).limit(1);
    const hasMore = !more.error && !!more.data && more.data.length > 0;
    return { ok: true, rows, hasMore, nextBefore: hasMore ? nextBefore : undefined };
  } catch (e: any) {
    return { ok: false, rows: [], hasMore: false, message: e?.message || String(e) };
  }
}

/** Tải TOÀN BỘ nhật ký (nhiều trang liên tiếp) — dùng cho xuất Excel lưu trữ. Giới hạn 20.000 dòng để không treo máy. */
export async function loadAllProjectEvents(projectId: string, opts: { taskId?: string; maxRows?: number } = {}): Promise<LoadEventsResult> {
  const max = opts.maxRows ?? 20000;
  const all: ProjectEventRow[] = [];
  let before: string | undefined;
  for (let guard = 0; guard < 500; guard++) {
    const page = await loadProjectEventsPage(projectId, { taskId: opts.taskId, before });
    if (!page.ok) return all.length ? { ok: true, rows: all } : page;
    all.push(...page.rows);
    if (!page.hasMore || !page.nextBefore || all.length >= max) break;
    before = page.nextBefore;
  }
  return { ok: true, rows: all };
}
