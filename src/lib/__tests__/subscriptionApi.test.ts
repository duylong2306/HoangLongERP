import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { FakeDb } from './helpers/fakeSupabase';

// Phía DOANH NGHIỆP của gói dịch vụ: đăng nhập (token thường / token KHÓA khi hết hạn), api/subscription (xem gói, đặt mua),
// đăng ký dùng thử 7 ngày.
const db = new FakeDb();
vi.mock('@supabase/supabase-js', () => ({ createClient: () => db.client() }));

import login from '../../../api/login';
import subscription from '../../../api/subscription';
import register from '../../../api/register-company';

const SECRET = 'jwt-secret-thu';
const res = () => {
  const r: any = { code: 0, body: null, headers: {} };
  r.status = (c: number) => { r.code = c; return r; };
  r.json = (b: any) => { r.body = b; return r; };
  r.setHeader = (k: string, v: string) => { r.headers[k] = v; return r; };
  return r;
};
const DAY = 86400000;
const goc = { ...process.env };
let hashMK: string;

const congTy = (over: any = {}) => ({ id: 'c1', slug: 'abc', name: 'Công ty ABC', active: true, plan_id: null, expires_at: null, is_trial: false, ...over });
const nhanVien = (over: any = {}) => ({ id: 'emp_admin', company_id: 'c1', name: 'Admin', username: 'admin', password: hashMK, role_group_ids: ['role_admin'], ...over });

const dangNhap = async (host = 'abc.lolo.io.vn', body: any = { username: 'admin', password: 'matkhau123' }) => {
  const r = res(); await login({ method: 'POST', body, headers: { host } } as any, r); return r;
};
const goi = async (body: any, token?: string) => {
  const r = res();
  await subscription({ method: 'POST', body, headers: { host: 'abc.lolo.io.vn', ...(token ? { authorization: `Bearer ${token}` } : {}) } } as any, r);
  return r;
};

beforeEach(async () => {
  db.tables = {}; db.fail = {}; db.log = []; db.missingColumns = {};
  db.unique = { companies: ['slug'], subscription_orders: ['code'] };
  db.autoId = new Set(['subscription_orders']);
  hashMK ||= await bcrypt.hash('matkhau123', 4);
  process.env.VITE_BASE_DOMAIN = 'lolo.io.vn';
  process.env.VITE_SUPABASE_URL = 'https://x.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'srv';
  process.env.SUPABASE_JWT_SECRET = SECRET;
  db.seed('plans', [
    { id: 'co-ban', name: 'Cơ bản', description: 'Nhỏ', price_monthly: 300000, price_yearly: 3000000, max_employees: 10, active: true, sort_order: 1 },
    { id: 'pro', name: 'Pro', description: '', price_monthly: 700000, price_yearly: 0, max_employees: 50, active: true, sort_order: 2 },
    { id: 'an', name: 'Ẩn', description: '', price_monthly: 1, price_yearly: 1, max_employees: null, active: false, sort_order: 3 },
    { id: 'chua-gia', name: 'Chưa giá', description: '', price_monthly: 0, price_yearly: 0, max_employees: null, active: true, sort_order: 4 },
  ]);
  db.seed('platform_settings', [{ key: 'bank', value: { bankName: 'VCB', accountNumber: '0123', accountName: 'LOLO', note: '' } }]);
});
afterEach(() => { process.env = { ...goc }; });

describe('api/login — theo hạn dùng của công ty', () => {
  it('KHÔNG GIỚI HẠN (doanh nghiệp cũ): token thường, sống 7 ngày, có company_id', async () => {
    db.seed('companies', [congTy()]); db.seed('employees', [nhanVien()]);
    const r = await dangNhap();
    expect(r.code).toBe(200);
    const p: any = jwt.verify(r.body.token, SECRET);
    expect(p).toMatchObject({ role: 'authenticated', company_id: 'c1', sub: 'emp_admin' });
    expect(p.exp - p.iat).toBe(7 * 86400);
    expect(r.body.subscription).toMatchObject({ status: 'unlimited', locked: false });
  });

  it('DÙNG THỬ còn 3 ngày: token thường nhưng HẾT HẠN đúng lúc dùng thử hết (không sống lâu hơn gói)', async () => {
    db.seed('companies', [congTy({ expires_at: new Date(Date.now() + 3 * DAY).toISOString(), is_trial: true })]); db.seed('employees', [nhanVien()]);
    const r = await dangNhap();
    const p: any = jwt.verify(r.body.token, SECRET);
    expect(p.company_id).toBe('c1');
    expect(p.exp - p.iat).toBeGreaterThan(3 * 86400 - 120); expect(p.exp - p.iat).toBeLessThanOrEqual(3 * 86400);
    expect(r.body.subscription).toMatchObject({ status: 'trial', daysLeft: 3, isTrial: true, locked: false });
  });

  it('ĐÃ HẾT HẠN: đăng nhập được nhưng nhận token KHÓA — role anon, KHÔNG có company_id, chỉ có locked_company_id', async () => {
    db.seed('companies', [congTy({ expires_at: new Date(Date.now() - DAY).toISOString(), is_trial: true })]); db.seed('employees', [nhanVien()]);
    const r = await dangNhap();
    expect(r.code).toBe(200);
    const p: any = jwt.verify(r.body.token, SECRET);
    expect(p.role).toBe('anon');
    expect(p.company_id).toBeUndefined();            // RLS + load_all_core_data dựa vào claim này → token khóa đọc 0 dòng dữ liệu ERP
    expect(p.locked_company_id).toBe('c1');
    expect(r.body.subscription).toMatchObject({ status: 'expired', locked: true });
  });

  it('sai mật khẩu vẫn 401 dù công ty hết hạn (không lộ trạng thái cho người chưa xác thực)', async () => {
    db.seed('companies', [congTy({ expires_at: new Date(Date.now() - DAY).toISOString() })]); db.seed('employees', [nhanVien()]);
    expect((await dangNhap('abc.lolo.io.vn', { username: 'admin', password: 'sai' })).code).toBe(401);
  });

  it('CHƯA CHẠY migration (thiếu cột expires_at): vẫn đăng nhập bình thường, coi là không giới hạn', async () => {
    db.missingColumns.companies = ['expires_at'];
    db.seed('companies', [congTy({ expires_at: '2020-01-01T00:00:00Z' })]); db.seed('employees', [nhanVien()]);
    const r = await dangNhap();
    expect(r.code).toBe(200);
    expect((jwt.verify(r.body.token, SECRET) as any).company_id).toBe('c1');
  });

  it('công ty bị ngừng hoạt động (active=false) → 404 như trước', async () => {
    db.seed('companies', [congTy({ active: false })]); db.seed('employees', [nhanVien()]);
    expect((await dangNhap()).code).toBe(404);
  });
});

describe('api/subscription — plans (công khai)', () => {
  it('chỉ trả gói đang bán và đã có giá, đúng thứ tự, không cần đăng nhập', async () => {
    const r = await goi({ action: 'plans' });
    expect(r.code).toBe(200);
    expect(r.body.plans.map((p: any) => p.id)).toEqual(['co-ban', 'pro']);     // 'an' (tắt) và 'chua-gia' (giá 0) bị ẩn
    expect(r.body.plans[0]).toEqual({ id: 'co-ban', name: 'Cơ bản', description: 'Nhỏ', priceMonthly: 300000, priceYearly: 3000000, maxEmployees: 10 });
  });
});

describe('api/subscription — xác thực', () => {
  it('không token / token rác / token ký sai khóa / token quản trị nền tảng → 401', async () => {
    expect((await goi({ action: 'status' })).code).toBe(401);
    expect((await goi({ action: 'status' }, 'rac.rac.rac')).code).toBe(401);
    expect((await goi({ action: 'status' }, jwt.sign({ sub: 'emp_admin', company_id: 'c1' }, 'khoa-khac'))).code).toBe(401);
  });

  it('token đúng nhưng nhân viên KHÔNG thuộc công ty trong token → 401', async () => {
    db.seed('companies', [congTy()]); db.seed('employees', [nhanVien({ company_id: 'c-khac' })]);
    const t = jwt.sign({ sub: 'emp_admin', role: 'authenticated', company_id: 'c1' }, SECRET);
    expect((await goi({ action: 'status' }, t)).code).toBe(401);
  });

  it('thao tác lạ → 400; chỉ nhận POST', async () => {
    db.seed('companies', [congTy()]); db.seed('employees', [nhanVien()]);
    const t = jwt.sign({ sub: 'emp_admin', role: 'authenticated', company_id: 'c1' }, SECRET);
    expect((await goi({ action: 'la' }, t)).code).toBe(400);
    const r = res(); await subscription({ method: 'GET', headers: {} } as any, r); expect(r.code).toBe(405);
  });
});

describe('api/subscription — status / order / cancel', () => {
  const tokenThuong = () => jwt.sign({ sub: 'emp_admin', role: 'authenticated', company_id: 'c1' }, SECRET);
  const tokenKhoa = () => jwt.sign({ sub: 'emp_admin', role: 'anon', locked_company_id: 'c1' }, SECRET);
  beforeEach(() => {
    db.seed('companies', [congTy({ expires_at: new Date(Date.now() + 2 * DAY).toISOString(), is_trial: true })]);
    db.seed('employees', [nhanVien(), nhanVien({ id: 'nv1', username: 'nv', role_group_ids: ['role_office'] })]);
  });

  it('status (admin): hạn dùng, gói, số nhân viên, thông tin chuyển khoản, đơn', async () => {
    const r = await goi({ action: 'status' }, tokenThuong());
    expect(r.code).toBe(200);
    expect(r.body.company).toEqual({ name: 'Công ty ABC', slug: 'abc' });
    expect(r.body.subscription).toMatchObject({ status: 'trial', daysLeft: 2, isTrial: true, locked: false });
    expect(r.body.employeeCount).toBe(2);
    expect(r.body.canManage).toBe(true);
    expect(r.body.bank).toMatchObject({ bankName: 'VCB', accountNumber: '0123' });
  });

  it('status (nhân viên thường): thấy hạn dùng nhưng KHÔNG thấy tài khoản ngân hàng/đơn, không quản lý được', async () => {
    const r = await goi({ action: 'status' }, jwt.sign({ sub: 'nv1', role: 'authenticated', company_id: 'c1' }, SECRET));
    expect(r.body.canManage).toBe(false);
    expect(r.body.bank).toBeNull();
    expect(r.body.orders).toEqual([]);
    expect(r.body.subscription.daysLeft).toBe(2);
  });

  it('TOKEN KHÓA (công ty hết hạn) vẫn xem được status và đặt mua', async () => {
    db.table('companies')[0].expires_at = new Date(Date.now() - DAY).toISOString();
    const st = await goi({ action: 'status' }, tokenKhoa());
    expect(st.code).toBe(200);
    expect(st.body.subscription).toMatchObject({ status: 'expired', locked: true });
    expect((await goi({ action: 'order', planId: 'co-ban', period: 'month' }, tokenKhoa())).code).toBe(201);
  });

  it('order theo THÁNG và NĂM: số tiền đúng giá gói, mã chuyển khoản, kèm ngân hàng', async () => {
    const m = await goi({ action: 'order', planId: 'co-ban', period: 'month' }, tokenThuong());
    expect(m.code).toBe(201);
    expect(m.body.order).toMatchObject({ planId: 'co-ban', planName: 'Cơ bản', period: 'month', months: 1, amount: 300000, status: 'pending' });
    expect(m.body.order.code).toMatch(/^LOLO[A-HJ-NP-Z2-9]{8}$/);
    expect(m.body.bank.accountNumber).toBe('0123');
    const y = await goi({ action: 'order', planId: 'co-ban', period: 'year' }, tokenThuong());
    expect(y.body.order).toMatchObject({ period: 'year', months: 12, amount: 3000000 });
    expect(db.table('subscription_orders')[0]).toMatchObject({ company_id: 'c1', requested_by: 'emp_admin' });
  });

  it('đặt lại đúng gói + kỳ hạn đang chờ → trả đơn cũ (không tạo trùng)', async () => {
    const a = await goi({ action: 'order', planId: 'co-ban', period: 'month' }, tokenThuong());
    const b = await goi({ action: 'order', planId: 'co-ban', period: 'month' }, tokenThuong());
    expect(b.code).toBe(200); expect(b.body.reused).toBe(true);
    expect(b.body.order.id).toBe(a.body.order.id);
    expect(db.table('subscription_orders').length).toBe(1);
  });

  it('tối đa 3 đơn chờ cùng lúc', async () => {
    await goi({ action: 'order', planId: 'co-ban', period: 'month' }, tokenThuong());
    await goi({ action: 'order', planId: 'co-ban', period: 'year' }, tokenThuong());
    await goi({ action: 'order', planId: 'pro', period: 'month' }, tokenThuong());
    db.seed('plans', [{ id: 'pro2', name: 'Pro2', description: '', price_monthly: 5, price_yearly: 5, max_employees: null, active: true, sort_order: 9 }]);
    expect((await goi({ action: 'order', planId: 'pro2', period: 'month' }, tokenThuong())).code).toBe(429);
  });

  it('từ chối: nhân viên thường, gói tắt/không tồn tại, gói chưa có giá cho kỳ đó, kỳ hạn lạ', async () => {
    expect((await goi({ action: 'order', planId: 'co-ban', period: 'month' }, jwt.sign({ sub: 'nv1', role: 'authenticated', company_id: 'c1' }, SECRET))).code).toBe(403);
    expect((await goi({ action: 'order', planId: 'an', period: 'month' }, tokenThuong())).code).toBe(400);
    expect((await goi({ action: 'order', planId: 'khong-co', period: 'month' }, tokenThuong())).code).toBe(400);
    expect((await goi({ action: 'order', planId: 'pro', period: 'year' }, tokenThuong())).code).toBe(400);   // pro chưa có giá năm
    expect((await goi({ action: 'order', planId: 'co-ban', period: 'tuan' }, tokenThuong())).code).toBe(400);
    expect(db.table('subscription_orders')).toEqual([]);
  });

  it('cancel: hủy đơn chờ của CHÍNH công ty; không hủy được đơn công ty khác', async () => {
    const o = await goi({ action: 'order', planId: 'co-ban', period: 'month' }, tokenThuong());
    db.seed('subscription_orders', [{ id: 'dh-khac', code: 'LOLOXXXXXXXX', company_id: 'c-khac', plan_id: 'co-ban', period: 'month', months: 1, amount: 1, status: 'pending' }]);
    expect((await goi({ action: 'cancel', id: 'dh-khac' }, tokenThuong())).code).toBe(404);
    expect(db.table('subscription_orders').find(x => x.id === 'dh-khac')!.status).toBe('pending');
    expect((await goi({ action: 'cancel', id: o.body.order.id }, tokenThuong())).code).toBe(200);
    expect(db.table('subscription_orders').find(x => x.id === o.body.order.id)!.status).toBe('cancelled');
    expect((await goi({ action: 'cancel', id: o.body.order.id }, tokenThuong())).code).toBe(404);   // đã hủy rồi
  });
});

describe('api/register-company — dùng thử', () => {
  const dangKy = async (cauHinh?: any) => {
    db.tables.companies = []; db.tables.employees = [];
    db.autoId.add('signup_attempts');
    if (cauHinh) db.seed('platform_settings', [{ key: 'trial', value: cauHinh }]);
    const r = res();
    await register({ method: 'POST', headers: { host: 'www.lolo.io.vn', 'x-forwarded-for': '9.9.9.9' }, body: {
      companyName: 'Cty Mới', slug: 'cty-moi', adminName: 'Nguyen Van A', email: 'a@b.vn', phone: '0912345678', password: 'matkhau123',
    } } as any, r);
    return r;
  };

  it('mặc định dùng thử 7 ngày: hạn = hôm nay + 7, is_trial = true, kết quả có ngày hết hạn', async () => {
    const r = await dangKy();
    expect(r.code).toBe(201);
    const c = db.table('companies')[0];
    expect(c.is_trial).toBe(true);
    expect(Math.round((new Date(c.expires_at).getTime() - Date.now()) / DAY)).toBe(7);
    expect(r.body.trial).toEqual({ days: 7, endsAt: c.expires_at });
  });

  it('theo số ngày dùng thử admin cấu hình (14 ngày)', async () => {
    const r = await dangKy({ days: 14, maxEmployees: null });
    expect(r.body.trial.days).toBe(14);
    expect(Math.round((new Date(db.table('companies')[0].expires_at).getTime() - Date.now()) / DAY)).toBe(14);
  });
});
