// ============================================================================
// Vercel Serverless Function — GÓI DỊCH VỤ phía DOANH NGHIỆP: xem gói, xem hạn dùng, đặt mua/gia hạn.
// ============================================================================
// Mọi thao tác dùng POST + JSON { action, ... }:
//   • plans   : (công khai) các gói đang bán — dùng cho trang giới thiệu/đăng ký;
//   • status  : hạn dùng + gói hiện tại + đơn gần đây của CÔNG TY đang đăng nhập;
//   • order   : (admin doanh nghiệp) đặt mua/gia hạn 1 gói theo tháng/năm → tạo đơn chờ + thông tin chuyển khoản;
//   • cancel  : (admin doanh nghiệp) hủy đơn đang chờ của chính công ty mình.
//
// Xác thực = token đăng nhập ERP (SUPABASE_JWT_SECRET). Chấp nhận 2 loại:
//   • token thường (có company_id) — doanh nghiệp còn hạn;
//   • token KHÓA (locked_company_id, role 'anon' — api/login.ts cấp khi hết hạn): KHÔNG đọc được dữ liệu ERP nhưng
//     đủ để gọi API này → công ty hết hạn vẫn vào được trang gia hạn.
// Công ty và nhân viên lấy TỪ TOKEN rồi tra lại DB bằng service_role (không tin dữ liệu client gửi).
//
// KHÔNG import từ src/ (xem giải thích ở api/login.ts).
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { bearerToken } from './_platformAuth.js'; // ⚠️ bắt buộc đuôi .js (Node ESM — xem api/login.ts)
import { getSubscriptionState, orderAmount, makeOrderCode, readBank, DEFAULT_BANK } from './_subscription.js';

const MAX_PENDING_ORDERS = 3;   // mỗi công ty tối đa 3 đơn chờ xác nhận cùng lúc (chống tạo đơn rác)

const fail = (res: VercelResponse, status: number, error: string) => { res.status(status).json({ error }); };

interface TenantAuth { companyId: string; empId: string; isAdmin: boolean; locked: boolean }

// Xác thực token ERP (thường hoặc khóa) → công ty + nhân viên + có phải admin doanh nghiệp không.
async function authenticate(req: VercelRequest, db: SupabaseClient, jwtSecret: string): Promise<TenantAuth | null> {
  const token = bearerToken(req.headers.authorization);
  if (!token) return null;
  let p: any;
  try { p = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }); } catch { return null; }
  const locked = typeof p.locked_company_id === 'string';
  const companyId = (locked ? p.locked_company_id : p.company_id) as string | undefined;
  if (!companyId || typeof p.sub !== 'string') return null;

  const { data: emp } = await db.from('employees').select('id, role_group_ids').eq('id', p.sub).eq('company_id', companyId).maybeSingle();
  if (!emp) return null;
  const groups: string[] = Array.isArray(emp.role_group_ids) ? emp.role_group_ids : [];
  // Cùng quy ước admin với ERP: nhóm role_admin / role_superadmin, hoặc admin gốc emp_admin.
  const isAdmin = emp.id === 'emp_admin' || groups.includes('role_admin') || groups.includes('role_superadmin');
  return { companyId, empId: emp.id, isAdmin, locked };
}

const planToApi = (p: any) => ({
  id: p.id, name: p.name, description: p.description,
  priceMonthly: Number(p.price_monthly), priceYearly: Number(p.price_yearly), maxEmployees: p.max_employees ?? null,
});

const orderToApi = (o: any, planName: string) => ({
  id: o.id, code: o.code, planId: o.plan_id, planName, period: o.period, months: o.months, amount: Number(o.amount),
  status: o.status, createdAt: o.created_at, confirmedAt: o.confirmed_at ?? null, periodEnd: o.period_end ?? null,
});

async function listPlans(db: SupabaseClient) {
  const { data } = await db.from('plans').select('*').eq('active', true).order('sort_order', { ascending: true }).order('name', { ascending: true });
  // Gói chưa đặt giá (cả tháng lẫn năm = 0) chưa thể mua → không hiện cho khách.
  return (data || []).filter((p: any) => Number(p.price_monthly) > 0 || Number(p.price_yearly) > 0).map(planToApi);
}

async function actionStatus(db: SupabaseClient, res: VercelResponse, a: TenantAuth) {
  const { data: company } = await db.from('companies').select('id, slug, name, plan_id, expires_at, is_trial').eq('id', a.companyId).maybeSingle();
  if (!company) return fail(res, 404, 'Không tìm thấy doanh nghiệp.');
  const sub = getSubscriptionState(company);

  const [plans, orders, empCount, bank] = await Promise.all([
    db.from('plans').select('id, name, max_employees'),
    db.from('subscription_orders').select('*').eq('company_id', a.companyId).order('created_at', { ascending: false }).limit(10),
    db.from('employees').select('id', { count: 'exact', head: true }).eq('company_id', a.companyId),
    a.isAdmin ? db.from('platform_settings').select('value').eq('key', 'bank').maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const planMap = new Map<string, any>((plans.data || []).map((p: any) => [p.id, p]));
  const plan = company.plan_id ? planMap.get(company.plan_id) : null;

  res.status(200).json({
    company: { name: company.name, slug: company.slug },
    subscription: { ...sub, planId: company.plan_id, planName: plan?.name || null, maxEmployees: plan?.max_employees ?? null },
    employeeCount: empCount.count ?? 0,
    canManage: a.isAdmin,
    // Thông tin chuyển khoản + danh sách đơn chỉ cho admin doanh nghiệp (nhân viên thường chỉ thấy trạng thái hạn dùng)
    bank: a.isAdmin ? readBank((bank as any).data?.value ?? DEFAULT_BANK) : null,
    orders: a.isAdmin ? (orders.data || []).map((o: any) => orderToApi(o, planMap.get(o.plan_id)?.name || o.plan_id)) : [],
  });
}

async function actionOrder(db: SupabaseClient, res: VercelResponse, a: TenantAuth, body: any) {
  if (!a.isAdmin) return fail(res, 403, 'Chỉ quản trị viên của doanh nghiệp mới đặt mua/gia hạn được.');
  const planId = String(body.planId || '');
  const period = String(body.period || '');

  const { data: plan } = await db.from('plans').select('*').eq('id', planId).eq('active', true).maybeSingle();
  if (!plan) return fail(res, 400, 'Gói không tồn tại hoặc đã ngừng bán.');
  const price = orderAmount(plan, period);
  if (!price) return fail(res, 400, 'Gói này chưa có giá cho kỳ hạn đã chọn.');

  const { data: pending } = await db.from('subscription_orders').select('*').eq('company_id', a.companyId).eq('status', 'pending').order('created_at', { ascending: false });
  const same = (pending || []).find((o: any) => o.plan_id === plan.id && o.period === period);
  const { data: bankRow } = await db.from('platform_settings').select('value').eq('key', 'bank').maybeSingle();
  const bank = readBank(bankRow?.value ?? DEFAULT_BANK);

  // Bấm 2 lần / đặt lại đúng gói+kỳ hạn đang chờ → trả lại đơn cũ (không tạo đơn trùng)
  if (same) return void res.status(200).json({ order: orderToApi(same, plan.name), bank, reused: true });
  if ((pending || []).length >= MAX_PENDING_ORDERS) {
    return fail(res, 429, `Bạn đang có ${MAX_PENDING_ORDERS} đơn chờ xác nhận. Vui lòng hoàn tất hoặc hủy bớt trước khi đặt thêm.`);
  }

  // Mã chuyển khoản duy nhất (cột code có ràng buộc unique; trùng — rất hiếm — thì thử mã khác)
  for (let i = 0; i < 5; i++) {
    const { data: created, error } = await db.from('subscription_orders').insert({
      code: makeOrderCode(), company_id: a.companyId, plan_id: plan.id, period, months: price.months, amount: price.amount,
      status: 'pending', requested_by: a.empId,
    }).select('*').maybeSingle();
    if (!error && created) return void res.status(201).json({ order: orderToApi(created, plan.name), bank, reused: false });
    if ((error as any)?.code !== '23505') {
      console.error('[api/subscription] Không tạo được đơn:', error?.message);
      return fail(res, 500, 'Không tạo được đơn. Vui lòng thử lại.');
    }
  }
  fail(res, 500, 'Không tạo được đơn. Vui lòng thử lại.');
}

async function actionCancel(db: SupabaseClient, res: VercelResponse, a: TenantAuth, body: any) {
  if (!a.isAdmin) return fail(res, 403, 'Chỉ quản trị viên của doanh nghiệp mới hủy được đơn.');
  // Điều kiện company_id: chỉ hủy được đơn của CHÍNH công ty mình, không đụng đơn công ty khác.
  const { data } = await db.from('subscription_orders').update({ status: 'cancelled', note: 'Khách hủy' })
    .eq('id', String(body.id || '')).eq('company_id', a.companyId).eq('status', 'pending').select('id').maybeSingle();
  if (!data) return fail(res, 404, 'Không tìm thấy đơn đang chờ để hủy.');
  res.status(200).json({ ok: true });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed');
  res.setHeader('Cache-Control', 'no-store');

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (!supabaseUrl || !serviceRoleKey || !jwtSecret) {
    console.error('[api/subscription] Thiếu biến môi trường server.');
    return fail(res, 500, 'Server chưa được cấu hình đầy đủ.');
  }
  const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const body = (req.body || {}) as any;
  const action = String(body.action || '');

  if (action === 'plans') return void res.status(200).json({ plans: await listPlans(db) });

  const auth = await authenticate(req, db, jwtSecret);
  if (!auth) return fail(res, 401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');

  switch (action) {
    case 'status': return actionStatus(db, res, auth);
    case 'order': return actionOrder(db, res, auth, body);
    case 'cancel': return actionCancel(db, res, auth, body);
    default: return fail(res, 400, 'Thao tác không hợp lệ.');
  }
}
