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
