// ============================================================================
// Vercel Serverless Function — API TRANG QUẢN TRỊ NỀN TẢNG (lolo.io.vn/quantri).
// ============================================================================
// Thay cho api/admin-companies.ts cũ (đã xóa): trước đây quyền quản trị nền tảng gắn vào admin của công ty
// Hoàng Long ngay trong ERP — nay là tài khoản RIÊNG (bảng platform_admins), token RIÊNG (api/_platformAuth.ts).
//
// Mọi thao tác dùng POST + JSON { action, ...dữ liệu } (token ở header Authorization: Bearer — không dùng cookie nên
// không có CSRF). Chỉ `login` không cần token. Mọi action khác: token hợp lệ + tài khoản còn active trong DB
// (kiểm tra lại mỗi lần, nên khóa tài khoản có hiệu lực ngay).
//
// Chỉ nhận từ địa chỉ gốc / địa chỉ "other" (vercel.app, localhost) — KHÔNG từ subdomain doanh nghiệp.
// Bảng nghiệp vụ nền tảng bật RLS không policy → chỉ service_role (hàm này) truy cập được.
//
// KHÔNG import từ src/ (xem giải thích ở api/login.ts).
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { resolveHost, getRequestHostname, getServerBaseDomains } from './_tenant.js'; // ⚠️ bắt buộc đuôi .js (Node ESM — xem api/login.ts)
import { signPlatformToken, verifyPlatformToken, bearerToken, LOGIN_WINDOW_MS, MAX_FAILS_PER_IP, MAX_FAILS_PER_USERNAME } from './_platformAuth.js';
import { getClientIp, hashIp, slugProblem, SLUG_MESSAGES } from './_signup.js';
import { createCompanyWithAdmin } from './_company.js';
import {
  getSubscriptionState, computeRenewal, validatePlan, readTrial, readBank, DEFAULT_TRIAL, DEFAULT_BANK, DAY_MS,
} from './_subscription.js';

// Băm "giả" để thời gian phản hồi khi sai TÊN đăng nhập ≈ khi sai MẬT KHẨU (không lộ tài khoản nào tồn tại).
const DUMMY_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8e3fNzG7bQvT9nWZB4oKX5PzB3q1uO';

const fail = (res: VercelResponse, status: number, error: string, extra: Record<string, unknown> = {}) => {
  res.status(status).json({ error, ...extra });
};

async function readSetting(db: SupabaseClient, key: string): Promise<any> {
  const { data } = await db.from('platform_settings').select('value').eq('key', key).maybeSingle();
  return data?.value;
}

// ─── Đăng nhập ───────────────────────────────────────────────────────────────────────────────────
async function actionLogin(db: SupabaseClient, req: VercelRequest, res: VercelResponse, body: any, jwtSecret: string) {
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!username || !password) return fail(res, 400, 'Vui lòng nhập tên đăng nhập và mật khẩu.');

  const ipHash = hashIp(getClientIp(req), jwtSecret);
  const since = new Date(Date.now() - LOGIN_WINDOW_MS).toISOString();
  const [byIp, byUser] = await Promise.all([
    db.from('platform_login_attempts').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).eq('success', false).gte('created_at', since),
    db.from('platform_login_attempts').select('id', { count: 'exact', head: true }).eq('username', username).eq('success', false).gte('created_at', since),
  ]);
  if (byIp.error || byUser.error) {
    // Chưa chạy migration 20261011 → từ chối (KHÔNG bỏ qua giới hạn đăng nhập)
    console.error('[api/platform] Lỗi bảng platform_login_attempts:', (byIp.error || byUser.error)?.message);
    return fail(res, 500, 'Hệ thống chưa sẵn sàng.');
  }
  if ((byIp.count || 0) >= MAX_FAILS_PER_IP || (byUser.count || 0) >= MAX_FAILS_PER_USERNAME) {
    return fail(res, 429, 'Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.');
  }

  const { data: admin } = await db.from('platform_admins').select('id, username, password_hash, name, active').eq('username', username).maybeSingle();
  const ok = await bcrypt.compare(password, admin?.password_hash || DUMMY_HASH);
  const passed = !!admin && admin.active === true && ok;

  await db.from('platform_login_attempts').insert({ ip_hash: ipHash, username, success: passed });
  if (!passed) return fail(res, 401, 'Tên đăng nhập hoặc mật khẩu không đúng.');

  await db.from('platform_admins').update({ last_login_at: new Date().toISOString() }).eq('id', admin!.id);
  res.status(200).json({ token: signPlatformToken({ id: admin!.id, username: admin!.username }, jwtSecret), admin: { id: admin!.id, username: admin!.username, name: admin!.name } });
}

// ─── Doanh nghiệp ────────────────────────────────────────────────────────────────────────────────
async function actionCompaniesList(db: SupabaseClient, res: VercelResponse) {
  const [cos, plans, counts] = await Promise.all([
    db.from('companies').select('id, slug, name, active, created_at, plan_id, expires_at, is_trial').order('created_at', { ascending: false }),
    db.from('plans').select('id, name, max_employees'),
    db.rpc('platform_employee_counts'),
  ]);
  if (cos.error) return fail(res, 500, cos.error.message);
  const planMap = new Map<string, any>((plans.data || []).map((p: any) => [p.id, p]));
  const countMap = new Map<string, number>(((counts.data as any[]) || []).map((r: any) => [r.company_id, Number(r.employee_count)]));
  const now = new Date();
  res.status(200).json({
    companies: (cos.data || []).map((c: any) => {
      const sub = getSubscriptionState(c, now);
      const plan = c.plan_id ? planMap.get(c.plan_id) : null;
      return {
        id: c.id, slug: c.slug, name: c.name, active: c.active, createdAt: c.created_at,
        planId: c.plan_id, planName: plan?.name || null, maxEmployees: plan?.max_employees ?? null,
        expiresAt: sub.expiresAt, isTrial: sub.isTrial, status: sub.status, daysLeft: sub.daysLeft,
        employeeCount: countMap.get(c.id) ?? 0,
      };
    }),
  });
}

async function actionCompaniesCreate(db: SupabaseClient, res: VercelResponse, body: any) {
  const slug = String(body.slug || '').trim().toLowerCase();
  const name = String(body.name || '').trim();
  const adminUsername = String(body.adminUsername || '').trim().toLowerCase();
  const adminPassword = String(body.adminPassword || '').trim();
  const problem = slugProblem(slug);
  if (problem) return fail(res, 400, SLUG_MESSAGES[problem]);
  if (!name) return fail(res, 400, 'Thiếu tên công ty.');
  if (!adminUsername || adminPassword.length < 4) return fail(res, 400, 'Thiếu tài khoản quản trị hoặc mật khẩu quá ngắn (tối thiểu 4 ký tự).');

  // Chế độ hạn dùng ban đầu: 'trial' (dùng thử theo cấu hình) hoặc 'unlimited' (không giới hạn). Mặc định dùng thử.
  const mode = body.subscription === 'unlimited' ? 'unlimited' : 'trial';
  let expiresAt: string | null = null;
  if (mode === 'trial') {
    const trial = readTrial(await readSetting(db, 'trial') ?? DEFAULT_TRIAL);
    expiresAt = new Date(Date.now() + trial.days * DAY_MS).toISOString();
  }
  const created = await createCompanyWithAdmin(db, {
    slug, name, adminUsername, adminPassword,
    adminName: String(body.adminName || '').trim() || undefined,
    expiresAt, isTrial: mode === 'trial',
  });
  if (!created.ok) return fail(res, created.status!, created.error!);
  res.status(201).json({ company: created.company });
}

async function actionCompaniesUpdate(db: SupabaseClient, res: VercelResponse, body: any) {
  const id = String(body.id || '');
  if (!id) return fail(res, 400, 'Thiếu mã công ty.');
  const patch: Record<string, unknown> = {};

  if (body.active !== undefined) patch.active = body.active === true;
  if (body.planId !== undefined) {
    if (body.planId === null || body.planId === '') patch.plan_id = null;
    else {
      const { data: plan } = await db.from('plans').select('id').eq('id', String(body.planId)).maybeSingle();
      if (!plan) return fail(res, 400, 'Gói không tồn tại.');
      patch.plan_id = plan.id;
    }
  }
  if (body.expiresAt !== undefined) {
    if (body.expiresAt === null || body.expiresAt === '') patch.expires_at = null;   // không giới hạn
    else {
      const d = new Date(String(body.expiresAt));
      if (isNaN(d.getTime())) return fail(res, 400, 'Ngày hết hạn không hợp lệ.');
      patch.expires_at = d.toISOString();
    }
  }
  if (body.isTrial !== undefined) patch.is_trial = body.isTrial === true;
  if (Object.keys(patch).length === 0) return fail(res, 400, 'Không có thông tin nào để cập nhật.');

  const { data, error } = await db.from('companies').update(patch).eq('id', id).select('id').maybeSingle();
  if (error) return fail(res, 500, error.message);
  if (!data) return fail(res, 404, 'Không tìm thấy công ty.');
  res.status(200).json({ ok: true });
}

// ─── Gói dịch vụ ─────────────────────────────────────────────────────────────────────────────────
const planToApi = (p: any) => ({
  id: p.id, name: p.name, description: p.description, priceMonthly: Number(p.price_monthly), priceYearly: Number(p.price_yearly),
  maxEmployees: p.max_employees, active: p.active, sortOrder: p.sort_order,
});

async function actionPlansList(db: SupabaseClient, res: VercelResponse) {
  const { data, error } = await db.from('plans').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true });
  if (error) return fail(res, 500, error.message);
  res.status(200).json({ plans: (data || []).map(planToApi) });
}

async function actionPlansSave(db: SupabaseClient, res: VercelResponse, body: any) {
  const v = validatePlan(body);
  if (!v.ok) return fail(res, 400, 'Thông tin gói chưa hợp lệ.', { errors: v.errors });
  const { error } = await db.from('plans').upsert({ ...v.data, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) return fail(res, 500, error.message);
  res.status(200).json({ ok: true });
}

// ─── Đơn đăng ký ─────────────────────────────────────────────────────────────────────────────────
async function actionOrdersList(db: SupabaseClient, res: VercelResponse, body: any) {
  let q = db.from('subscription_orders').select('*').order('created_at', { ascending: false }).limit(300);
  if (['pending', 'confirmed', 'cancelled'].includes(body.status)) q = q.eq('status', body.status);
  const { data, error } = await q;
  if (error) return fail(res, 500, error.message);
  const rows = data || [];
  const [cos, plans] = await Promise.all([
    db.from('companies').select('id, slug, name').in('id', [...new Set(rows.map((o: any) => o.company_id))]),
    db.from('plans').select('id, name'),
  ]);
  const coMap = new Map<string, any>((cos.data || []).map((c: any) => [c.id, c]));
  const planMap = new Map<string, any>((plans.data || []).map((p: any) => [p.id, p]));
  res.status(200).json({
    orders: rows.map((o: any) => ({
      id: o.id, code: o.code, companyId: o.company_id, companyName: coMap.get(o.company_id)?.name || '—', companySlug: coMap.get(o.company_id)?.slug || '',
      planId: o.plan_id, planName: planMap.get(o.plan_id)?.name || o.plan_id, period: o.period, months: o.months, amount: Number(o.amount),
      status: o.status, createdAt: o.created_at, confirmedAt: o.confirmed_at, periodStart: o.period_start, periodEnd: o.period_end, note: o.note,
    })),
  });
}

// Xác nhận đơn = đã nhận đủ tiền → kích hoạt/gia hạn công ty. Thứ tự an toàn khi 2 admin bấm cùng lúc:
//   1) "chiếm" đơn bằng cập nhật có điều kiện status='pending' (chỉ 1 yêu cầu thắng);
//   2) cập nhật công ty; nếu lỗi → trả đơn về 'pending' (không để đơn đã xác nhận mà công ty chưa được gia hạn).
async function actionOrdersConfirm(db: SupabaseClient, res: VercelResponse, body: any, adminId: string) {
  const id = String(body.id || '');
  const { data: order } = await db.from('subscription_orders').select('*').eq('id', id).maybeSingle();
  if (!order) return fail(res, 404, 'Không tìm thấy đơn.');
  if (order.status !== 'pending') return fail(res, 409, 'Đơn này đã được xử lý.');

  const { data: company } = await db.from('companies').select('id, expires_at').eq('id', order.company_id).maybeSingle();
  if (!company) return fail(res, 404, 'Công ty của đơn không còn tồn tại.');

  const { start, end } = computeRenewal(company.expires_at, order.months);
  const { data: claimed } = await db.from('subscription_orders')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString(), confirmed_by: adminId, period_start: start.toISOString(), period_end: end.toISOString() })
    .eq('id', id).eq('status', 'pending').select('id').maybeSingle();
  if (!claimed) return fail(res, 409, 'Đơn này vừa được xử lý bởi người khác.');

  const { error: coErr } = await db.from('companies').update({ plan_id: order.plan_id, expires_at: end.toISOString(), is_trial: false }).eq('id', order.company_id);
  if (coErr) {
    await db.from('subscription_orders').update({ status: 'pending', confirmed_at: null, confirmed_by: null, period_start: null, period_end: null }).eq('id', id);
    return fail(res, 500, `Không kích hoạt được gói: ${coErr.message}`);
  }
  res.status(200).json({ ok: true, expiresAt: end.toISOString() });
}

async function actionOrdersCancel(db: SupabaseClient, res: VercelResponse, body: any) {
  const id = String(body.id || '');
  const note = String(body.note || '').trim().slice(0, 300);
  const { data, error } = await db.from('subscription_orders').update({ status: 'cancelled', note }).eq('id', id).eq('status', 'pending').select('id').maybeSingle();
  if (error) return fail(res, 500, error.message);
  if (!data) return fail(res, 409, 'Đơn không còn ở trạng thái chờ xác nhận.');
  res.status(200).json({ ok: true });
}

// ─── Cấu hình ────────────────────────────────────────────────────────────────────────────────────
async function actionSettingsGet(db: SupabaseClient, res: VercelResponse) {
  res.status(200).json({
    trial: readTrial((await readSetting(db, 'trial')) ?? DEFAULT_TRIAL),
    bank: readBank((await readSetting(db, 'bank')) ?? DEFAULT_BANK),
  });
}

async function actionSettingsSave(db: SupabaseClient, res: VercelResponse, body: any) {
  const rows: { key: string; value: unknown; updated_at: string }[] = [];
  const now = new Date().toISOString();
  if (body.trial !== undefined) {
    const days = Number(body.trial?.days);
    const rawMax = body.trial?.maxEmployees;
    const maxEmployees = rawMax === null || rawMax === '' || rawMax === undefined ? null : Number(rawMax);
    if (!Number.isInteger(days) || days < 1 || days > 365) return fail(res, 400, 'Số ngày dùng thử phải là số nguyên từ 1 đến 365.');
    if (maxEmployees !== null && (!Number.isInteger(maxEmployees) || maxEmployees < 1)) return fail(res, 400, 'Số nhân viên tối đa khi dùng thử phải là số nguyên ≥ 1 (để trống = không giới hạn).');
    rows.push({ key: 'trial', value: { days, maxEmployees }, updated_at: now });
  }
  if (body.bank !== undefined) rows.push({ key: 'bank', value: readBank(body.bank), updated_at: now });
  if (rows.length === 0) return fail(res, 400, 'Không có cấu hình nào để lưu.');
  const { error } = await db.from('platform_settings').upsert(rows, { onConflict: 'key' });
  if (error) return fail(res, 500, error.message);
  res.status(200).json({ ok: true });
}

async function actionPasswordChange(db: SupabaseClient, res: VercelResponse, body: any, adminId: string) {
  const current = String(body.currentPassword || '');
  const next = String(body.newPassword || '');
  if (next.length < 10 || next.length > 72 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) {
    return fail(res, 400, 'Mật khẩu mới từ 10 đến 72 ký tự, có cả chữ và số.');
  }
  const { data: admin } = await db.from('platform_admins').select('password_hash').eq('id', adminId).maybeSingle();
  if (!admin || !(await bcrypt.compare(current, admin.password_hash))) return fail(res, 400, 'Mật khẩu hiện tại không đúng.');
  const { error } = await db.from('platform_admins').update({ password_hash: await bcrypt.hash(next, 10) }).eq('id', adminId);
  if (error) return fail(res, 500, error.message);
  res.status(200).json({ ok: true });
}

// ─── Điểm vào ────────────────────────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed');
  res.setHeader('Cache-Control', 'no-store');

  // Trang quản trị chỉ ở địa chỉ gốc — không bao giờ gọi được từ trong 1 doanh nghiệp.
  if (resolveHost(getRequestHostname(req), getServerBaseDomains()).kind === 'tenant') {
    return fail(res, 403, 'Không khả dụng tại địa chỉ doanh nghiệp.');
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (!supabaseUrl || !serviceRoleKey || !jwtSecret) {
    console.error('[api/platform] Thiếu biến môi trường server.');
    return fail(res, 500, 'Server chưa được cấu hình đầy đủ.');
  }
  const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const body = (req.body || {}) as any;
  const action = String(body.action || '');

  if (action === 'login') return actionLogin(db, req, res, body, jwtSecret);

  // Mọi action còn lại: token quản trị hợp lệ + tài khoản còn active (tra lại DB mỗi lần).
  const token = verifyPlatformToken(bearerToken(req.headers.authorization), jwtSecret);
  if (!token) return fail(res, 401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
  const { data: admin } = await db.from('platform_admins').select('id, username, name, active').eq('id', token.sub).maybeSingle();
  if (!admin || admin.active !== true) return fail(res, 401, 'Tài khoản không còn hiệu lực.');

  switch (action) {
    case 'me': return void res.status(200).json({ admin: { id: admin.id, username: admin.username, name: admin.name } });
    case 'companies.list': return actionCompaniesList(db, res);
    case 'companies.create': return actionCompaniesCreate(db, res, body);
    case 'companies.update': return actionCompaniesUpdate(db, res, body);
    case 'plans.list': return actionPlansList(db, res);
    case 'plans.save': return actionPlansSave(db, res, body);
    case 'orders.list': return actionOrdersList(db, res, body);
    case 'orders.confirm': return actionOrdersConfirm(db, res, body, admin.id);
    case 'orders.cancel': return actionOrdersCancel(db, res, body);
    case 'settings.get': return actionSettingsGet(db, res);
    case 'settings.save': return actionSettingsSave(db, res, body);
    case 'password.change': return actionPasswordChange(db, res, body, admin.id);
    default: return fail(res, 400, 'Thao tác không hợp lệ.');
  }
}
