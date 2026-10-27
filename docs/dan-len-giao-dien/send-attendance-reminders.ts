// @ts-nocheck
// BẢN GỘP 1 FILE của hàm Edge `send-attendance-reminders` để dán vào giao diện Supabase (Edge Functions → Via Editor).
// Gộp từ: _shared/tenant-core.ts + _shared/attendance-core.ts + send-attendance-reminders/index.ts. Đừng sửa tay; mã gốc nằm trong thư mục supabase/functions.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import webPush from "https://esm.sh/web-push@3.6.7";

// ───── tenant-core.ts ─────
// LÕI DÙNG CHUNG cho các Edge Function đa doanh nghiệp (send-push, send-attendance-reminders).
// Chỉ chứa hàm THUẦN (không dùng API riêng của Deno) nên test được bằng vitest: src/lib/__tests__/edgeTenant.test.ts.
//
// VẤN ĐỀ ĐÃ SỬA: bản cũ viết cho 1 doanh nghiệp — tìm người nhận push CHỈ theo mã nhân viên (user_id). Mã như "emp_admin" có ở
// MỌI doanh nghiệp, nên thông báo của công ty A có thể đến máy công ty B. Nay MỌI truy vấn đều lọc theo company_id, và company_id
// lấy từ TOKEN ĐĂNG NHẬP (không tin dữ liệu client gửi lên).

export interface Claims { sub?: string; role?: string; company_id?: string; [k: string]: unknown }

// Giải mã phần dữ liệu của JWT (KHÔNG kiểm chữ ký — chữ ký được kiểm ở bước authenticateCaller bằng cách hỏi PostgREST).
export function decodeJwtClaims(token: string): Claims | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const json = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
    const bytes = Uint8Array.from(json, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch { return null; }
}

export const isUuid = (s: unknown): s is string =>
  typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

// Danh sách mã nhân viên an toàn để ghép vào bộ lọc in.(...) của PostgREST: chỉ nhận ký tự an toàn, bỏ trùng, giới hạn số lượng.
// (Bản cũ ghép thẳng chuỗi client gửi vào URL — mã chứa dấu nháy/phẩy sẽ phá bộ lọc.)
export function sanitizeIds(ids: unknown, max = 500): string[] {
  if (!Array.isArray(ids)) return [];
  const out: string[] = [];
  for (const v of ids) {
    if (typeof v === 'string' && /^[A-Za-z0-9_.:@-]{1,128}$/.test(v) && !out.includes(v)) out.push(v);
    if (out.length >= max) break;
  }
  return out;
}
export const pgIn = (ids: string[]): string => `in.(${ids.map((i) => `"${i}"`).join(',')})`;

export type Caller = { kind: 'user'; companyId: string; userId: string } | { kind: 'service' };
export type AuthResult = { ok: true; caller: Caller } | { ok: false; status: number; error: string };

export interface AuthDeps {
  authorization: string | null | undefined;
  serviceKey: string;
  anonKey: string;
  supabaseUrl: string;
  fetchFn: (url: string, init?: any) => Promise<{ ok: boolean; json: () => Promise<any> }>;
}

// Token này có phải khóa cấp MÁY CHỦ (service_role) không?
//   • khớp CHÍNH XÁC khóa mà hàm Edge nhận (cách nhanh, đáng tin nhất); HOẶC
//   • token tự nhận role=service_role (hoặc khóa dạng mới sb_secret_...) VÀ cơ sở dữ liệu xác nhận bằng cách cho đọc bảng `companies`
//     — bảng này bật RLS không chính sách cho khóa anon/đăng nhập nên chỉ khóa cấp máy chủ đọc được. Cần cách thứ hai vì giá trị
//     SUPABASE_SERVICE_ROLE_KEY mà Supabase đưa vào hàm Edge có thể KHÁC chuỗi khóa anh copy từ giao diện (định dạng khóa khác nhau).
export async function isServiceToken(d: { token: string; serviceKey: string; supabaseUrl: string; fetchFn: AuthDeps['fetchFn'] }): Promise<boolean> {
  if (!d.token) return false;
  if (d.serviceKey && d.token === d.serviceKey) return true;
  const claims = decodeJwtClaims(d.token);
  if (!(claims?.role === 'service_role' || d.token.startsWith('sb_secret_'))) return false;
  try {
    const r = await d.fetchFn(`${d.supabaseUrl}/rest/v1/companies?select=id&limit=1`, { headers: { apikey: d.token, Authorization: `Bearer ${d.token}` } });
    const rows = r.ok ? await r.json() : null;
    return Array.isArray(rows) && rows.length > 0;
  } catch { return false; }
}

// Xác định ai đang gọi:
//   • khóa service_role (cron/máy chủ): xem isServiceToken ở trên;
//   • nhân viên đăng nhập ERP: token role=authenticated + company_id + sub; rồi HỎI PostgREST bằng chính token đó xem nhân viên `sub`
//     có thật trong công ty của token và công ty còn hoạt động không (PostgREST kiểm chữ ký + RLS) — khóa anon công khai không qua được.
export async function authenticateCaller(d: AuthDeps): Promise<AuthResult> {
  const token = (d.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return { ok: false, status: 401, error: 'Thiếu thông tin đăng nhập.' };
  if (await isServiceToken({ token, serviceKey: d.serviceKey, supabaseUrl: d.supabaseUrl, fetchFn: d.fetchFn })) return { ok: true, caller: { kind: 'service' } };

  const claims = decodeJwtClaims(token);
  if (!claims || claims.role !== 'authenticated' || !isUuid(claims.company_id) || typeof claims.sub !== 'string' || !claims.sub) {
    return { ok: false, status: 401, error: 'Cần đăng nhập vào doanh nghiệp.' };
  }
  try {
    const r = await d.fetchFn(`${d.supabaseUrl}/rest/v1/employees?select=id&id=eq.${encodeURIComponent(claims.sub)}&limit=1`,
      { headers: { apikey: d.anonKey, Authorization: `Bearer ${token}` } });
    const rows = r.ok ? await r.json() : null;
    if (!Array.isArray(rows) || rows.length !== 1) return { ok: false, status: 401, error: 'Phiên đăng nhập không hợp lệ hoặc doanh nghiệp đã bị khóa.' };
  } catch { return { ok: false, status: 401, error: 'Không xác thực được phiên đăng nhập.' }; }
  return { ok: true, caller: { kind: 'user', companyId: claims.company_id!, userId: claims.sub } };
}

// ─── Gửi Web Push theo doanh nghiệp ──────────────────────────────────────────────────────────────
export interface PushDeps {
  supabaseUrl: string;
  serviceKey: string;
  fetchFn: (url: string, init?: any) => Promise<any>;
  webPush: { sendNotification: (sub: any, payload: string) => Promise<any> };
}
const svcHeaders = (k: string) => ({ apikey: k, Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' });

// Gửi cùng 1 nội dung tới các thiết bị đã đăng ký của `userIds` TRONG doanh nghiệp `companyId` (không bao giờ ra ngoài công ty).
// Trả về số liệu; endpoint đã chết thật (404/410) bị xóa — cũng chỉ trong phạm vi công ty này.
export async function pushToUsers(d: PushDeps, companyId: string, userIds: string[], payload: string) {
  const subRes = await d.fetchFn(
    `${d.supabaseUrl}/rest/v1/push_subscriptions?select=user_id,endpoint,p256dh,auth&company_id=eq.${companyId}&user_id=${pgIn(userIds)}`,
    { headers: svcHeaders(d.serviceKey) });
  const subs = await subRes.json();
  if (!Array.isArray(subs) || subs.length === 0) return { successCount: 0, failureCount: 0, removed: 0, notifiedUserIds: [] as string[], note: 'no subscriptions' };

  const results = await Promise.allSettled(subs.map((s: any) => d.webPush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)));
  let successCount = 0, failureCount = 0;
  const dead: string[] = [], notified = new Set<string>();
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') { successCount++; notified.add(subs[i].user_id); return; }
    failureCount++;
    const code = (r.reason as any)?.statusCode || (r.reason as any)?.status || 0;
    if (code === 404 || code === 410) dead.push(subs[i].endpoint);   // chỉ xóa khi endpoint hết hạn THẬT; lỗi tạm thời giữ lại để thử lần sau
  });
  if (dead.length) {
    await d.fetchFn(`${d.supabaseUrl}/rest/v1/push_subscriptions?company_id=eq.${companyId}&endpoint=in.(${dead.map((e) => `"${e.replace(/"/g, '')}"`).join(',')})`,
      { method: 'DELETE', headers: svcHeaders(d.serviceKey) }).catch(() => {});
  }
  return { successCount, failureCount, removed: dead.length, notifiedUserIds: [...notified] };
}

// Dọn đăng ký quá 90 ngày — CHỈ trong 1 công ty (bản cũ xóa trên toàn bảng).
export async function cleanupOldSubscriptions(d: Pick<PushDeps, 'supabaseUrl' | 'serviceKey' | 'fetchFn'>, companyId: string, now = Date.now()) {
  try {
    await d.fetchFn(`${d.supabaseUrl}/rest/v1/push_subscriptions?company_id=eq.${companyId}&created_at=lt.${new Date(now - 90 * 24 * 3600 * 1000).toISOString()}`,
      { method: 'DELETE', headers: svcHeaders(d.serviceKey) });
  } catch { /* bỏ qua lỗi dọn dẹp */ }
}

export interface PushRequest { method: string; authorization: string | null | undefined; body: any }
export interface PushEnv { SUPABASE_URL?: string; SERVICE_KEY?: string; ANON_KEY?: string; VAPID_PRIV?: string; VAPID_PUB?: string }

// Xử lý yêu cầu /send-push: xác thực → xác định công ty (từ TOKEN; chỉ khóa service_role mới được chỉ định companyId) → gửi.
export async function handleSendPush(req: PushRequest, env: PushEnv, deps: { fetchFn: PushDeps['fetchFn']; webPush: PushDeps['webPush'] }): Promise<{ status: number; json: any }> {
  if (req.method !== 'POST') return { status: 405, json: { error: 'Method not allowed' } };
  if (!env.SUPABASE_URL || !env.SERVICE_KEY || !env.ANON_KEY) return { status: 500, json: { error: 'Missing env vars' } };

  const auth = await authenticateCaller({ authorization: req.authorization, serviceKey: env.SERVICE_KEY, anonKey: env.ANON_KEY, supabaseUrl: env.SUPABASE_URL, fetchFn: deps.fetchFn as any });
  if (!auth.ok) return { status: auth.status, json: { error: auth.error } };

  // Khóa VAPID kiểm sau khi xác thực: người chưa đăng nhập luôn nhận 401, không biết cấu hình máy chủ thiếu gì.
  if (!env.VAPID_PRIV || !env.VAPID_PUB) return { status: 500, json: { error: 'Missing VAPID keys' } };

  const b = req.body || {};
  const userIds = sanitizeIds(b.userIds);
  if (userIds.length === 0) return { status: 400, json: { error: 'missing userIds' } };

  let companyId: string;
  if (auth.caller.kind === 'user') companyId = auth.caller.companyId;                 // công ty lấy từ TOKEN, bỏ qua mọi companyId client gửi
  else if (isUuid(b.companyId)) companyId = b.companyId;                              // máy chủ (service_role) phải nói rõ công ty nào
  else return { status: 400, json: { error: 'missing companyId' } };

  const pd: PushDeps = { supabaseUrl: env.SUPABASE_URL, serviceKey: env.SERVICE_KEY, fetchFn: deps.fetchFn, webPush: deps.webPush };
  await cleanupOldSubscriptions(pd, companyId);
  const payload = JSON.stringify({
    title: b.title || 'Thong bao moi', body: b.body || '', image: b.image || '', data: b.data || {},
    tag: b.tag || 'web-push-notification', actions: [{ action: 'open', title: 'Mo' }],
  });
  const r = await pushToUsers(pd, companyId, userIds, payload);
  if (r.note) return { status: 200, json: { successCount: 0, failureCount: 0, note: r.note } };
  return { status: 200, json: { successCount: r.successCount, failureCount: r.failureCount, removedSubscriptions: r.removed } };
}


// ───── attendance-core.ts ─────
// NHẮC ĐIỂM DANH qua Web Push — chạy cho TỪNG doanh nghiệp (đa doanh nghiệp). Hàm thuần nhận phụ thuộc qua tham số để test được.
// Đây là NGUỒN DUY NHẤT của nhắc điểm danh: pg_cron gọi hàm Edge này mỗi 5 phút (migration 20261029), hàm tự xét từng công ty
// xem đã đến lúc nhắc chưa. (Hàm SQL cũ trigger_attendance_reminders() chỉ ghi vào bảng notifications mà ứng dụng không đọc,
// lại đánh dấu cả công ty là "đã nhắc" nên chặn luôn đợt nhắc buổi chiều — đã ngừng dùng.)
//
// GIỜ NHẮC LẤY TỪ CẤU HÌNH CA CỦA TỪNG CÔNG TY (shift_config): nhắc đúng lúc MỞ ĐIỂM DANH = giờ vào ca − punch_open_before_minutes
// (mặc định 15 phút, kẹp 5–60), và chỉ nhắc cho tới giờ vào ca. Tin nhắc ghi đúng giờ vào ca / ra ca của công ty đó.
//
// So với bản cũ (1 doanh nghiệp):
//   • lặp qua các doanh nghiệp ĐANG HOẠT ĐỘNG (không bị khóa / hết hạn), mỗi doanh nghiệp tự có ngày nghỉ (shift_config theo
//     company_id) và ngày lễ (hrm_holidays theo company_id);
//   • mọi truy vấn / cập nhật / xóa đều lọc company_id (mã nhân viên như emp_admin trùng giữa các công ty);
//   • notifications ghi kèm company_id; lỗi ở 1 công ty không chặn các công ty khác;
//   • đã SỬA lỗi cũ: bản cũ không lấy cột last_attendance_reminder_sent nên "chống nhắc trùng" không bao giờ chạy.

const hdr = (k: string) => ({ apikey: k, Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' });
const chunk = <T,>(a: T[], n: number): T[][] => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

export type Shift = 'morning' | 'afternoon';

export interface ShiftPlan { shift: Shift; inTime: string; outTime: string; openTime: string }

const HM = /^(\d{1,2}):(\d{2})/;
const toMin = (v: unknown): number | null => { const m = typeof v === 'string' ? v.trim().match(HM) : null; return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const fmtHm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
export const MIN_LEAD = 5, MAX_LEAD = 60, DEFAULT_LEAD = 15;

/** Số phút mở điểm danh trước giờ vào ca: lấy từ cấu hình, thiếu/0/sai → 15; kẹp trong 5–60 để không nhắc quá sớm / sát giờ */
export function openLeadMinutes(cfg: any): number {
  const n = Number(cfg?.punch_open_before_minutes);
  return Number.isFinite(n) && n > 0 ? Math.min(MAX_LEAD, Math.max(MIN_LEAD, Math.round(n))) : DEFAULT_LEAD;
}

/**
 * Ca nào đang trong "cửa sổ nhắc" lúc `nowMin` (phút trong ngày, giờ VN) theo cấu hình ca của công ty?
 * Cửa sổ = [giờ vào ca − số phút mở điểm danh, giờ vào ca). Thiếu cấu hình → giờ mặc định 07:30 / 13:00.
 */
export function reminderPlan(cfg: any, nowMin: number): ShiftPlan | null {
  const lead = openLeadMinutes(cfg);
  const shifts: { shift: Shift; inM: number; outM: number }[] = [
    { shift: 'morning', inM: toMin(cfg?.morning_in) ?? 450, outM: toMin(cfg?.morning_out) ?? 690 },
    { shift: 'afternoon', inM: toMin(cfg?.afternoon_in) ?? 780, outM: toMin(cfg?.afternoon_out) ?? 1020 },
  ];
  for (const x of shifts) {
    if (nowMin >= x.inM - lead && nowMin < x.inM) return { shift: x.shift, inTime: fmtHm(x.inM), outTime: fmtHm(x.outM), openTime: fmtHm(x.inM - lead) };
  }
  return null;
}

export function vnDateParts(now: Date) {
  const vn = new Date(now.getTime() + 7 * 3600 * 1000);
  const dd = String(vn.getUTCDate()).padStart(2, '0'), mm = String(vn.getUTCMonth() + 1).padStart(2, '0');
  return { dow: vn.getUTCDay(), ddmm: `${dd}/${mm}`, ddmmyyyy: `${dd}/${mm}/${vn.getUTCFullYear()}`, today: `${vn.getUTCFullYear()}-${mm}-${dd}`, minutes: vn.getUTCHours() * 60 + vn.getUTCMinutes() };
}

/** Nội dung nhắc theo giờ ca THẬT của công ty (không còn viết cứng 07:30 / 13:00) */
export function reminderContent(plan: ShiftPlan) {
  const m = plan.shift === 'morning';
  const ca = m ? 'sáng' : 'chiều';
  return {
    title: `⏰ Điểm danh ca ${ca} · ${plan.inTime}`,
    body: `Đã mở điểm danh. Điểm danh trước ${plan.inTime} để không bị ghi nhận đi muộn.`,
    detail: `Ca ${ca}: ${plan.inTime} – ${plan.outTime}. Mở điểm danh từ ${plan.openTime}.`,
  };
}

export interface AttendanceDeps extends PushDeps { now?: Date }

async function getJson(d: AttendanceDeps, path: string): Promise<any> {
  const r = await d.fetchFn(`${d.supabaseUrl}/rest/v1/${path}`, { headers: hdr(d.serviceKey) });
  if (!r.ok) throw new Error(`${path.split('?')[0]}: ${r.status} ${await r.text().catch(() => '')}`.slice(0, 200));
  return r.json();
}

// Đơn có phải nghỉ phép THẬT (không tính báo cáo / giải trình chấm công)? Giữ đồng bộ với lib/leaveNotice.isRealLeaveType
const isRealLeave = (l: any) => !l.is_attendance_correction && !/^(Báo cáo|Yêu cầu xét duyệt)/i.test(String(l.type || ''));

export async function runAttendanceReminders(d: AttendanceDeps) {
  const now = d.now ?? new Date();
  const p = vnDateParts(now);
  const vnTime = fmtHm(p.minutes);

  // Chỉ doanh nghiệp đang hoạt động: không bị khóa (active) và chưa hết hạn gói — giống chính sách company_live ở cơ sở dữ liệu
  const companies = (await getJson(d, 'companies?select=id,slug,active,expires_at&active=eq.true'))
    .filter((co: any) => !co.expires_at || new Date(co.expires_at).getTime() > now.getTime());

  const perCompany: any[] = [];
  for (const co of companies) {
    const row: any = { company: co.slug };
    try {
      // 1) cấu hình ca CỦA CÔNG TY: ngày nghỉ cuối tuần + giờ vào/ra ca + số phút mở điểm danh (thiếu → mặc định như cũ)
      let cfg: any = null;
      try {
        const rows = await getJson(d, `shift_config?select=weekend_days,morning_in,morning_out,afternoon_in,afternoon_out,punch_open_before_minutes&company_id=eq.${co.id}`);
        cfg = Array.isArray(rows) ? rows[0] || null : null;
      } catch { /* fail-open: dùng mặc định */ }
      const weekend: number[] = Array.isArray(cfg?.weekend_days) && cfg.weekend_days.length ? cfg.weekend_days : [0];
      if (weekend.includes(p.dow)) { row.skipped = 'weekend'; perCompany.push(row); continue; }

      // 2) chưa đến cửa sổ nhắc của ca nào → bỏ qua (cron chạy 5 phút/lần nên hầu hết lượt chạy dừng ở đây, rất nhẹ)
      const plan = reminderPlan(cfg, p.minutes);
      if (!plan) { row.skipped = 'outside_window'; perCompany.push(row); continue; }
      row.shift = plan.shift;

      // 3) ngày lễ của công ty
      let holidays: string[] = [];
      try { holidays = (await getJson(d, `hrm_holidays?select=date&company_id=eq.${co.id}`)).map((h: any) => h.date).filter(Boolean); } catch { /* fail-open */ }
      if (holidays.includes(p.ddmm) || holidays.includes(p.ddmmyyyy)) { row.skipped = 'holiday'; perCompany.push(row); continue; }

      // 4) nhân viên đang làm, CHƯA được nhắc CHO CA NÀY hôm nay (dấu "YYYY-MM-DD:ca" — sáng và chiều nhắc độc lập; dấu cũ chỉ có ngày nên không chặn)
      const mark = `${p.today}:${plan.shift}`;
      const emps = await getJson(d, `employees?select=id,name,last_attendance_reminder_sent&status=eq.working&company_id=eq.${co.id}`);
      let need = (emps || []).filter((e: any) => e.last_attendance_reminder_sent !== mark);

      // 5) bỏ người KHÔNG cần nhắc: đã điểm danh vào ca này rồi, hoặc đang nghỉ phép được duyệt hôm nay (cả ngày hoặc đúng ca này)
      try {
        const att = await getJson(d, `attendance_records?select=emp_id,time_in_s,time_in_c&date=eq.${p.today}&company_id=eq.${co.id}`);
        const done = new Set((att || []).filter((a: any) => (plan.shift === 'morning' ? a.time_in_s : a.time_in_c)).map((a: any) => a.emp_id));
        const leaves = await getJson(d, `hrm_leaves?select=emp_id,type,shift,is_attendance_correction,from_date,to_date&status=eq.approved&company_id=eq.${co.id}`);
        const onLeave = new Set((leaves || []).filter((l: any) => isRealLeave(l) && l.from_date <= p.today && p.today <= (l.to_date || l.from_date) && (!l.shift || l.shift === plan.shift)).map((l: any) => l.emp_id));
        need = need.filter((e: any) => !done.has(e.id) && !onLeave.has(e.id));
      } catch { /* fail-open: không lọc được thì nhắc cả những người này, còn hơn bỏ sót */ }
      row.needsReminder = need.length;
      if (!need.length) { perCompany.push(row); continue; }

      // 6) gửi push cho thiết bị của họ (chia lô để URL không quá dài)
      const c = reminderContent(plan);
      const payload = JSON.stringify({
        title: c.title, body: c.body, image: '', tag: `attendance-${plan.shift}-${p.today}`,
        data: { url: '/', type: 'attendance', notificationType: plan.shift, detailedContent: c.detail }, actions: [{ action: 'open', title: 'Điểm danh ngay' }],
      });
      const notified = new Set<string>(); let ok = 0, fail = 0;
      for (const ids of chunk(need.map((e: any) => e.id).filter((id: string) => /^[A-Za-z0-9_.:@-]{1,128}$/.test(id)), 100)) {
        const r = await pushToUsers(d, co.id, ids, payload);
        ok += r.successCount; fail += r.failureCount; r.notifiedUserIds.forEach((u: string) => notified.add(u));
      }
      row.pushSent = ok; row.pushFailed = fail;

      // 7) đánh dấu đã nhắc cho ca này (chỉ trong công ty này) để 5 phút sau không nhắc lại. Người chưa có thiết bị push cũng được đánh dấu
      //    — nếu không, họ bị truy vấn lại mỗi 5 phút cho tới giờ vào ca mà vẫn không có thiết bị nào để gửi.
      for (const ids of chunk(need.map((e: any) => e.id).filter((id: string) => /^[A-Za-z0-9_.:@-]{1,128}$/.test(id)), 100)) {
        await d.fetchFn(`${d.supabaseUrl}/rest/v1/employees?company_id=eq.${co.id}&id=${pgIn(ids)}`,
          { method: 'PATCH', headers: { ...hdr(d.serviceKey), Prefer: 'return=minimal' }, body: JSON.stringify({ last_attendance_reminder_sent: mark }) });
      }
    } catch (err: any) {
      row.error = String(err?.message || err).slice(0, 160);   // lỗi 1 công ty không chặn công ty khác
    }
    perCompany.push(row);
  }
  return { success: true, vietnamTime: vnTime, companies: perCompany };
}


// ───── index.ts ─────

// =============================================================================
// Edge Function: send-attendance-reminders — nhắc điểm danh qua Web Push (DỰ PHÒNG), chạy cho TỪNG doanh nghiệp.
// Nguồn chính là hàm SQL trigger_attendance_reminders() (pg_cron). Logic nằm ở ../_shared/attendance-core.ts (có test).
// Chỉ nhận lời gọi bằng khóa service_role (cron/máy chủ) — người dùng ERP và khóa anon công khai bị từ chối.
// =============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const VAPID_PRIV = Deno.env.get("VAPID_PRIVATE_KEY");
    const VAPID_PUB = Deno.env.get("VAPID_PUBLIC_KEY");
    if (!SUPABASE_URL || !SERVICE_KEY) return json(500, { error: "Missing env vars" });

    // Chỉ khóa service_role mới được kích hoạt nhắc điểm danh (nếu không, ai có khóa anon công khai cũng gọi được)
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!(await isServiceToken({ token, serviceKey: SERVICE_KEY, supabaseUrl: SUPABASE_URL, fetchFn: fetch }))) return json(401, { error: "Chỉ máy chủ (service_role) được gọi hàm này." });
    if (!VAPID_PRIV || !VAPID_PUB) return json(500, { error: "Missing VAPID keys" });

    webPush.setVapidDetails("mailto:admin@hoanglonglamdong.vn", VAPID_PUB, VAPID_PRIV);
    const result = await runAttendanceReminders({ supabaseUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, fetchFn: fetch, webPush });
    return json(200, result);
  } catch (err) {
    console.error("Error:", err);
    return json(500, { error: String(err) });
  }
});
