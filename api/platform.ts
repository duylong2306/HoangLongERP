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
import { signPlatformToken, verifyPlatformToken, bearerToken, LOGIN_WINDOW_MS, MAX_FAILS_PER_IP, MAX_FAILS_PER_PAIR, MAX_FAILS_PER_USERNAME, PLATFORM_BCRYPT_COST, passwordProblem, ADMIN_USERNAME_RE } from './_platformAuth.js';
import { sendTelegram, telegramConfigured } from './_telegram.js';
import { writeAudit, purgeOldAudit, diffFields, AUDIT_RETENTION_DAYS, type AuditCtx } from './_audit.js';
import { getClientIp, hashIp, slugProblem, SLUG_MESSAGES } from './_signup.js';
import { createCompanyWithAdmin } from './_company.js';
import {
  getSubscriptionState, computeRenewal, validatePlan, cleanFeatures, readTrial, readBank, DEFAULT_TRIAL, DEFAULT_BANK, DAY_MS,
} from './_subscription.js';

// Băm "giả" để thời gian phản hồi khi sai TÊN đăng nhập ≈ khi sai MẬT KHẨU (không lộ tài khoản nào tồn tại).
// ⚠️ Phải CÙNG cost với hash thật (12 — xem PLATFORM_BCRYPT_COST trong _platformAuth.ts), nếu lệch thì
// thời gian phản hồi vẫn lộ tên nào có thật (đã đo: cost 10 ≈ 69ms vs cost 12 ≈ 276ms).
const DUMMY_HASH = '$2b$12$AkoYIfsxx4z9bO39IRYgfOYUNUQQV.3XleyxoTbkpzFhuCPXJSL7i';

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
  const [byIp, byUser, byPair] = await Promise.all([
    db.from('platform_login_attempts').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).eq('success', false).gte('created_at', since),
    db.from('platform_login_attempts').select('id', { count: 'exact', head: true }).eq('username', username).eq('success', false).gte('created_at', since),
    db.from('platform_login_attempts').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).eq('username', username).eq('success', false).gte('created_at', since),
  ]);
  if (byIp.error || byUser.error || byPair.error) {
    // Chưa chạy migration 20261011 → từ chối (KHÔNG bỏ qua giới hạn đăng nhập)
    console.error('[api/platform] Lỗi bảng platform_login_attempts:', (byIp.error || byUser.error || byPair.error)?.message);
    return fail(res, 500, 'Hệ thống chưa sẵn sàng.');
  }
  // Khóa theo CẶP (IP + tên đăng nhập) là chính: kẻ ngoài gõ sai tên quản trị từ IP của họ chỉ khóa được CHÍNH IP đó,
  // không khóa được quản trị thật đăng nhập từ IP khác. Ngưỡng theo tên (cao hơn nhiều) chỉ để chặn dò mật khẩu phân tán.
  if ((byIp.count || 0) >= MAX_FAILS_PER_IP || (byPair.count || 0) >= MAX_FAILS_PER_PAIR || (byUser.count || 0) >= MAX_FAILS_PER_USERNAME) {
    return fail(res, 429, 'Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.');
  }

  const { data: admin } = await db.from('platform_admins').select('*').eq('username', username).maybeSingle();
  const ok = await bcrypt.compare(password, admin?.password_hash || DUMMY_HASH);
  const passed = !!admin && admin.active === true && ok;

  await db.from('platform_login_attempts').insert({ ip_hash: ipHash, username, success: passed });
  if (!passed) return fail(res, 401, 'Tên đăng nhập hoặc mật khẩu không đúng.');

  await db.from('platform_admins').update({ last_login_at: new Date().toISOString() }).eq('id', admin!.id);
  await writeAudit(db, { adminId: admin!.id, username: admin!.username, ipHash }, { action: 'login', targetType: 'account', targetId: admin!.id, summary: 'Đăng nhập trang quản trị' });
  await purgeOldAudit(db);   // dọn nhật ký quá 30 ngày
  res.status(200).json({ token: signPlatformToken({ id: admin!.id, username: admin!.username, ver: admin!.token_version ?? 0 }, jwtSecret), admin: { id: admin!.id, username: admin!.username, name: admin!.name, isOwner: admin!.is_owner === true } });
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

async function actionCompaniesCreate(db: SupabaseClient, res: VercelResponse, body: any, ctx: AuditCtx) {
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
  await writeAudit(db, ctx, {
    action: 'companies.create', targetType: 'company', targetId: created.company!.id, summary: `Tạo doanh nghiệp "${name}" (${slug})`,
    detail: { slug, name, adminUsername, subscription: mode, expiresAt },   // KHÔNG lưu mật khẩu admin công ty
  });
  res.status(201).json({ company: created.company });
}

async function actionCompaniesUpdate(db: SupabaseClient, res: VercelResponse, body: any, ctx: AuditCtx) {
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

  // Đọc bản ghi TRƯỚC khi sửa để nhật ký lưu được giá trị cũ → mới
  const { data: before } = await db.from('companies').select('id, slug, name, active, plan_id, expires_at, is_trial').eq('id', id).maybeSingle();
  const { data, error } = await db.from('companies').update(patch).eq('id', id).select('id').maybeSingle();
  if (error) return fail(res, 500, error.message);
  if (!data) return fail(res, 404, 'Không tìm thấy công ty.');
  const changes = diffFields(before, patch, ['active', 'plan_id', 'expires_at', 'is_trial']);
  if (Object.keys(changes).length > 0) {
    const nhan = before ? `"${before.name}" (${before.slug})` : id;
    const tom = patch.active !== undefined && changes.active ? (patch.active ? `Mở khóa doanh nghiệp ${nhan}` : `Khóa doanh nghiệp ${nhan}`) : `Sửa thông tin doanh nghiệp ${nhan}`;
    await writeAudit(db, ctx, { action: 'companies.update', targetType: 'company', targetId: id, summary: tom, detail: changes });
  }
  res.status(200).json({ ok: true });
}

// ─── Gói dịch vụ ─────────────────────────────────────────────────────────────────────────────────
const planToApi = (p: any) => ({
  id: p.id, name: p.name, description: p.description, priceMonthly: Number(p.price_monthly), priceYearly: Number(p.price_yearly),
  maxEmployees: p.max_employees, active: p.active, sortOrder: p.sort_order, badge: p.badge || '', features: cleanFeatures(p.features),
});

async function actionPlansList(db: SupabaseClient, res: VercelResponse) {
  const { data, error } = await db.from('plans').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true });
  if (error) return fail(res, 500, error.message);
  res.status(200).json({ plans: (data || []).map(planToApi) });
}

async function actionPlansSave(db: SupabaseClient, res: VercelResponse, body: any, ctx: AuditCtx) {
  const v = validatePlan(body);
  if (!v.ok) return fail(res, 400, 'Thông tin gói chưa hợp lệ.', { errors: v.errors });
  const { data: before } = await db.from('plans').select('*').eq('id', v.data!.id).maybeSingle();
  const { error } = await db.from('plans').upsert({ ...v.data, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) return fail(res, 500, error.message);
  const campos = ['name', 'description', 'badge', 'features', 'price_monthly', 'price_yearly', 'max_employees', 'active', 'sort_order'];
  await writeAudit(db, ctx, {
    action: 'plans.save', targetType: 'plan', targetId: v.data!.id,
    summary: before ? `Sửa gói "${v.data!.name}"` : `Tạo gói "${v.data!.name}"`,
    detail: before ? diffFields(before, v.data as any, campos) : v.data,
  });
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
      paidClaimedAt: o.paid_claimed_at ?? null,   // khách đã bấm "Xác nhận chuyển khoản thành công"
    })),
  });
}

// Xác nhận đơn = đã nhận đủ tiền → kích hoạt/gia hạn công ty. Thứ tự an toàn khi 2 admin bấm cùng lúc:
//   1) "chiếm" đơn bằng cập nhật có điều kiện status='pending' (chỉ 1 yêu cầu thắng);
//   2) cập nhật công ty; nếu lỗi → trả đơn về 'pending' (không để đơn đã xác nhận mà công ty chưa được gia hạn).
async function actionOrdersConfirm(db: SupabaseClient, res: VercelResponse, body: any, adminId: string, ctx: AuditCtx) {
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
  await writeAudit(db, ctx, {
    action: 'orders.confirm', targetType: 'order', targetId: id, summary: `Xác nhận đơn ${order.code} — kích hoạt/gia hạn gói "${order.plan_id}" (${order.months} tháng)`,
    detail: { code: order.code, companyId: order.company_id, planId: order.plan_id, amount: Number(order.amount), months: order.months, expiresFrom: company.expires_at, expiresTo: end.toISOString() },
  });
  res.status(200).json({ ok: true, expiresAt: end.toISOString() });
}

async function actionOrdersCancel(db: SupabaseClient, res: VercelResponse, body: any, ctx: AuditCtx) {
  const id = String(body.id || '');
  const note = String(body.note || '').trim().slice(0, 300);
  const { data, error } = await db.from('subscription_orders').update({ status: 'cancelled', note }).eq('id', id).eq('status', 'pending').select('id').maybeSingle();
  if (error) return fail(res, 500, error.message);
  if (!data) return fail(res, 409, 'Đơn không còn ở trạng thái chờ xác nhận.');
  await writeAudit(db, ctx, { action: 'orders.cancel', targetType: 'order', targetId: id, summary: 'Hủy đơn đăng ký chờ xác nhận', detail: { note } });
  res.status(200).json({ ok: true });
}

// ─── Cấu hình ────────────────────────────────────────────────────────────────────────────────────
async function actionSettingsGet(db: SupabaseClient, res: VercelResponse) {
  res.status(200).json({
    trial: readTrial((await readSetting(db, 'trial')) ?? DEFAULT_TRIAL),
    bank: readBank((await readSetting(db, 'bank')) ?? DEFAULT_BANK),
    telegramConfigured: telegramConfigured(),   // chỉ cho biết đã cấu hình hay chưa — KHÔNG bao giờ trả token/chat id
  });
}

async function actionSettingsSave(db: SupabaseClient, res: VercelResponse, body: any, ctx: AuditCtx) {
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
  const cu = new Map<string, unknown>();
  for (const r of rows) cu.set(r.key, await readSetting(db, r.key));   // giá trị CŨ để ghi nhật ký
  const { error } = await db.from('platform_settings').upsert(rows, { onConflict: 'key' });
  if (error) return fail(res, 500, error.message);
  await writeAudit(db, ctx, {
    action: 'settings.save', targetType: 'setting', targetId: rows.map(r => r.key).join(','),
    summary: `Sửa cấu hình: ${rows.map(r => (r.key === 'trial' ? 'dùng thử' : 'tài khoản ngân hàng')).join(', ')}`,
    detail: Object.fromEntries(rows.map(r => [r.key, { from: cu.get(r.key) ?? null, to: r.value }])),
  });
  res.status(200).json({ ok: true });
}

// Gửi thử 1 tin nhắn để kiểm tra bot Telegram đã cấu hình đúng chưa.
async function actionTelegramTest(res: VercelResponse, ctx: AuditCtx, db: SupabaseClient) {
  const r = await sendTelegram(`✅ Thử kết nối từ trang quản trị LoLo (bởi ${ctx.username}). Nếu bạn thấy tin này, bot Telegram đã hoạt động.`);
  await writeAudit(db, ctx, { action: 'telegram.test', targetType: 'setting', targetId: 'telegram', summary: r.ok ? 'Gửi thử Telegram: thành công' : `Gửi thử Telegram: thất bại${r.configured ? '' : ' (chưa cấu hình)'}` });
  if (!r.configured) return fail(res, 400, 'Chưa cấu hình Telegram: cần đặt biến môi trường TELEGRAM_BOT_TOKEN và TELEGRAM_CHAT_ID trên máy chủ (Vercel) rồi deploy lại.');
  if (!r.ok) return fail(res, 502, r.error || 'Không gửi được tin nhắn Telegram.');
  res.status(200).json({ ok: true });
}

// Đăng xuất THẬT: tăng token_version → token hiện tại (và mọi token cũ) hết hiệu lực ở máy chủ.
async function actionLogout(db: SupabaseClient, res: VercelResponse, admin: any, ctx: AuditCtx) {
  const { error } = await db.from('platform_admins').update({ token_version: (admin.token_version ?? 0) + 1 }).eq('id', admin.id);
  if (error) return fail(res, 500, error.message);
  await writeAudit(db, ctx, { action: 'logout', targetType: 'account', targetId: admin.id, summary: 'Đăng xuất (thu hồi phiên)' });
  res.status(200).json({ ok: true });
}

async function actionPasswordChange(db: SupabaseClient, res: VercelResponse, body: any, adminRow: any, jwtSecret: string, ctx: AuditCtx) {
  const adminId = adminRow.id as string;
  const current = String(body.currentPassword || '');
  const next = String(body.newPassword || '');
  const problem = passwordProblem(next);
  if (problem) return fail(res, 400, problem);
  const { data: admin } = await db.from('platform_admins').select('password_hash').eq('id', adminId).maybeSingle();
  if (!admin || !(await bcrypt.compare(current, admin.password_hash))) return fail(res, 400, 'Mật khẩu hiện tại không đúng.');
  const ver = (adminRow.token_version ?? 0) + 1;
  const { error } = await db.from('platform_admins').update({ password_hash: await bcrypt.hash(next, PLATFORM_BCRYPT_COST), token_version: ver }).eq('id', adminId);
  if (error) return fail(res, 500, error.message);
  await writeAudit(db, ctx, { action: 'password.change', targetType: 'account', targetId: adminId, summary: 'Tự đổi mật khẩu' });   // không lưu mật khẩu
  // Đổi mật khẩu thu hồi MỌI token cũ (kể cả của kẻ đang giữ token bị lộ); trả token mới để phiên hiện tại không bị đá ra.
  res.status(200).json({ ok: true, token: signPlatformToken({ id: adminId, username: adminRow.username, ver }, jwtSecret) });
}

// ─── Tài khoản quản trị (chỉ chủ nền tảng) ────────────────────────────────────────────────────────
const accountToApi = (a: any) => ({
  id: a.id, username: a.username, name: a.name, active: a.active === true, isOwner: a.is_owner === true,
  lastLoginAt: a.last_login_at ?? null, createdAt: a.created_at,
});

async function actionAccountsList(db: SupabaseClient, res: VercelResponse) {
  const { data, error } = await db.from('platform_admins').select('*').order('created_at', { ascending: true });
  if (error) return fail(res, 500, error.message);
  res.status(200).json({ accounts: (data || []).map(accountToApi) });
}

async function actionAccountsCreate(db: SupabaseClient, res: VercelResponse, body: any, ctx: AuditCtx) {
  const username = String(body.username || '').trim().toLowerCase();
  const name = String(body.name || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  const password = String(body.password || '');
  if (!ADMIN_USERNAME_RE.test(username)) return fail(res, 400, 'Tên đăng nhập chỉ gồm chữ thường, số, dấu . _ - (3–40 ký tự).');
  const problem = passwordProblem(password);
  if (problem) return fail(res, 400, problem);

  const { data, error } = await db.from('platform_admins').insert({
    username, name: name || username, password_hash: await bcrypt.hash(password, PLATFORM_BCRYPT_COST), active: true,   // is_owner mặc định false
  }).select('id').maybeSingle();
  if (error) return fail(res, (error as any).code === '23505' ? 409 : 500, (error as any).code === '23505' ? 'Tên đăng nhập này đã tồn tại.' : error.message);
  await writeAudit(db, ctx, { action: 'accounts.create', targetType: 'account', targetId: data?.id, summary: `Tạo tài khoản quản trị "${username}"`, detail: { username, name: name || username } });
  res.status(201).json({ ok: true, id: data?.id });
}

// Tài khoản mục tiêu: chỉ thao tác được trên tài khoản KHÔNG phải chủ (chủ tự đổi mật khẩu ở mục riêng).
async function loadTarget(db: SupabaseClient, res: VercelResponse, id: string, actor: any): Promise<any | null> {
  const { data } = await db.from('platform_admins').select('*').eq('id', id).maybeSingle();
  if (!data) { fail(res, 404, 'Không tìm thấy tài khoản.'); return null; }
  if (data.is_owner === true && data.id !== actor.id) { fail(res, 403, 'Không thể thao tác trên tài khoản chủ nền tảng khác.'); return null; }
  return data;
}

async function actionAccountsUpdate(db: SupabaseClient, res: VercelResponse, body: any, actor: any, ctx: AuditCtx) {
  const target = await loadTarget(db, res, String(body.id || ''), actor);
  if (!target) return;
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = String(body.name || '').trim().replace(/\s+/g, ' ').slice(0, 80) || target.username;
  if (body.active !== undefined) {
    const active = body.active === true;
    // Không tự khóa chính mình (sẽ mất quyền quản trị) — chủ nền tảng không bao giờ bị khóa.
    if (!active && target.id === actor.id) return fail(res, 400, 'Không thể tự khóa tài khoản của chính mình.');
    patch.active = active;
    if (!active) patch.token_version = (target.token_version ?? 0) + 1;   // khóa → thu hồi luôn phiên đang mở
  }
  if (Object.keys(patch).length === 0) return fail(res, 400, 'Không có thông tin nào để cập nhật.');
  const { error } = await db.from('platform_admins').update(patch).eq('id', target.id);
  if (error) return fail(res, 500, error.message);
  const changes = diffFields(target, patch, ['name', 'active']);
  await writeAudit(db, ctx, {
    action: 'accounts.update', targetType: 'account', targetId: target.id,
    summary: patch.active === false ? `Khóa tài khoản "${target.username}"` : patch.active === true && target.active !== true ? `Mở khóa tài khoản "${target.username}"` : `Sửa thông tin tài khoản "${target.username}"`,
    detail: changes,
  });
  res.status(200).json({ ok: true });
}

async function actionAccountsReset(db: SupabaseClient, res: VercelResponse, body: any, actor: any, ctx: AuditCtx) {
  const target = await loadTarget(db, res, String(body.id || ''), actor);
  if (!target) return;
  if (target.id === actor.id) return fail(res, 400, 'Tự đổi mật khẩu của mình ở mục "Đổi mật khẩu của tôi".');
  const password = String(body.newPassword || '');
  const problem = passwordProblem(password);
  if (problem) return fail(res, 400, problem);
  const { error } = await db.from('platform_admins').update({
    password_hash: await bcrypt.hash(password, PLATFORM_BCRYPT_COST), token_version: (target.token_version ?? 0) + 1,   // thu hồi mọi phiên cũ của họ
  }).eq('id', target.id);
  if (error) return fail(res, 500, error.message);
  await writeAudit(db, ctx, { action: 'accounts.resetPassword', targetType: 'account', targetId: target.id, summary: `Đặt lại mật khẩu cho tài khoản "${target.username}"` });
  res.status(200).json({ ok: true });
}

// ─── Nhật ký thao tác ────────────────────────────────────────────────────────────────────────────
async function actionLogsList(db: SupabaseClient, res: VercelResponse, body: any) {
  await purgeOldAudit(db);   // đảm bảo không trả bản ghi quá 30 ngày
  const limit = Math.min(Math.max(parseInt(String(body.limit), 10) || 200, 1), 500);
  let q = db.from('platform_audit_logs').select('*').order('created_at', { ascending: false }).limit(limit);
  const who = String(body.adminUsername || '').trim().toLowerCase();
  if (who) q = q.eq('admin_username', who);
  // ⚠️ Không dùng khóa `action` cho bộ lọc: `action` đã là tên thao tác API (logs.list) — trùng sẽ lọc nhầm thành "không có gì".
  const act = String(body.actionFilter || '').trim();
  if (act) q = q.eq('action', act);
  const { data, error } = await q;
  if (error) return fail(res, 500, error.message);
  res.status(200).json({
    retentionDays: AUDIT_RETENTION_DAYS,
    logs: (data || []).map((l: any) => ({
      id: l.id, createdAt: l.created_at, adminUsername: l.admin_username, action: l.action,
      targetType: l.target_type, targetId: l.target_id, summary: l.summary, detail: l.detail,
    })),
  });
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
  const { data: admin } = await db.from('platform_admins').select('*').eq('id', token.sub).maybeSingle();
  if (!admin || admin.active !== true) return fail(res, 401, 'Tài khoản không còn hiệu lực.');
  // Token cũ hơn phiên bản hiện tại (đã đăng xuất / đổi mật khẩu) → thu hồi.
  if (token.ver !== (admin.token_version ?? 0)) return fail(res, 401, 'Phiên đăng nhập đã bị thu hồi. Vui lòng đăng nhập lại.');

  // Ngữ cảnh ghi nhật ký: ai (tài khoản trong DB — không tin tên trong token) + băm IP
  const ctx: AuditCtx = { adminId: admin.id, username: admin.username, ipHash: hashIp(getClientIp(req), jwtSecret) };
  const isOwner = admin.is_owner === true;

  switch (action) {
    case 'me': return void res.status(200).json({ admin: { id: admin.id, username: admin.username, name: admin.name, isOwner } });
    case 'companies.list': return actionCompaniesList(db, res);
    case 'companies.create': return actionCompaniesCreate(db, res, body, ctx);
    case 'companies.update': return actionCompaniesUpdate(db, res, body, ctx);
    case 'plans.list': return actionPlansList(db, res);
    case 'plans.save': return actionPlansSave(db, res, body, ctx);
    case 'orders.list': return actionOrdersList(db, res, body);
    case 'orders.confirm': return actionOrdersConfirm(db, res, body, admin.id, ctx);
    case 'orders.cancel': return actionOrdersCancel(db, res, body, ctx);
    case 'settings.get': return actionSettingsGet(db, res);
    case 'settings.save': return actionSettingsSave(db, res, body, ctx);
    case 'telegram.test': return actionTelegramTest(res, ctx, db);
    case 'password.change': return actionPasswordChange(db, res, body, admin, jwtSecret, ctx);
    case 'logout': return actionLogout(db, res, admin, ctx);
    // Quản lý tài khoản quản trị: chỉ CHỦ nền tảng (is_owner). Nhật ký: mọi quản trị viên xem được, không ai sửa/xóa được.
    case 'accounts.list': return isOwner ? actionAccountsList(db, res) : fail(res, 403, 'Chỉ chủ nền tảng mới quản lý được tài khoản quản trị.');
    case 'accounts.create': return isOwner ? actionAccountsCreate(db, res, body, ctx) : fail(res, 403, 'Chỉ chủ nền tảng mới quản lý được tài khoản quản trị.');
    case 'accounts.update': return isOwner ? actionAccountsUpdate(db, res, body, admin, ctx) : fail(res, 403, 'Chỉ chủ nền tảng mới quản lý được tài khoản quản trị.');
    case 'accounts.resetPassword': return isOwner ? actionAccountsReset(db, res, body, admin, ctx) : fail(res, 403, 'Chỉ chủ nền tảng mới quản lý được tài khoản quản trị.');
    case 'logs.list': return actionLogsList(db, res, body);
    default: return fail(res, 400, 'Thao tác không hợp lệ.');
  }
}
