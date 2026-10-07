import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { FakeDb } from './helpers/fakeSupabase';

// API trang quản trị nền tảng (api/platform.ts): xác thực tách biệt khỏi ERP, quản lý doanh nghiệp/gói/đơn/cấu hình.
const db = new FakeDb();
vi.mock('@supabase/supabase-js', () => ({ createClient: () => db.client() }));

import handler from '../../../api/platform';
import { signPlatformToken } from '../../../api/_platformAuth';

const SECRET = 'jwt-secret-thu';
const res = () => {
  const r: any = { code: 0, body: null, headers: {} };
  r.status = (c: number) => { r.code = c; return r; };
  r.json = (b: any) => { r.body = b; return r; };
  r.setHeader = (k: string, v: string) => { r.headers[k] = v; return r; };
  return r;
};
const call = async (body: any, opts: { token?: string; host?: string; method?: string } = {}) => {
  const r = res();
  await handler({
    method: opts.method || 'POST', body,
    headers: { host: opts.host || 'www.lolo.io.vn', 'x-forwarded-for': '5.5.5.5', ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
  } as any, r);
  return r;
};
const ADMIN_ID = 'ad-1';
const tok = () => signPlatformToken({ id: ADMIN_ID, username: 'chu' }, SECRET);
const goc = { ...process.env };
let matKhauHash: string;

beforeEach(async () => {
  db.tables = {}; db.fail = {}; db.log = []; db.rpcs = {};
  db.unique = { companies: ['slug'], subscription_orders: ['code'], platform_admins: ['username'] };
  db.autoId = new Set(['platform_login_attempts', 'subscription_orders', 'platform_audit_logs', 'platform_admins']);
  matKhauHash ||= await bcrypt.hash('MatKhauTot123', 4);
  db.seed('platform_admins', [{ id: ADMIN_ID, username: 'chu', password_hash: matKhauHash, name: 'Chủ nền tảng', active: true, is_owner: true }]);
  db.seed('plans', [
    { id: 'co-ban', name: 'Cơ bản', description: '', price_monthly: 300000, price_yearly: 3000000, max_employees: 10, active: true, sort_order: 1 },
  ]);
  process.env.VITE_BASE_DOMAIN = 'lolo.io.vn';
  process.env.VITE_SUPABASE_URL = 'https://x.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'srv';
  process.env.SUPABASE_JWT_SECRET = SECRET;
});
afterEach(() => { process.env = { ...goc }; vi.useRealTimers(); });

describe('xác thực', () => {
  it('chỉ nhận POST; từ subdomain doanh nghiệp → 403', async () => {
    expect((await call({}, { method: 'GET' })).code).toBe(405);
    expect((await call({ action: 'me' }, { token: tok(), host: 'hoanglong.lolo.io.vn' })).code).toBe(403);
  });

  it('không token / token sai → 401', async () => {
    expect((await call({ action: 'companies.list' })).code).toBe(401);
    expect((await call({ action: 'companies.list' }, { token: 'rac.rac.rac' })).code).toBe(401);
  });

  it('TOKEN ERP (ký bằng khóa Supabase) của admin Hoàng Long KHÔNG vào được trang quản trị', async () => {
    const erpToken = jwt.sign({ sub: 'emp_admin', role: 'authenticated', company_id: '00000000-0000-0000-0000-000000000001' }, SECRET, { expiresIn: '1h' });
    const r = await call({ action: 'companies.list' }, { token: erpToken });
    expect(r.code).toBe(401);
  });

  it('token quản trị KHÔNG hợp lệ như token Supabase (khác khóa ký)', () => {
    expect(() => jwt.verify(tok(), SECRET)).toThrow();
  });

  it('token đúng nhưng tài khoản bị khóa / không còn → 401 ngay (tra lại DB mỗi lần)', async () => {
    db.table('platform_admins')[0].active = false;
    expect((await call({ action: 'me' }, { token: tok() })).code).toBe(401);
    db.tables.platform_admins = [];
    expect((await call({ action: 'me' }, { token: tok() })).code).toBe(401);
  });

  it('me → thông tin tài khoản', async () => {
    const r = await call({ action: 'me' }, { token: tok() });
    expect(r.code).toBe(200);
    expect(r.body.admin).toMatchObject({ username: 'chu', name: 'Chủ nền tảng' });
  });

  it('thao tác lạ → 400', async () => {
    expect((await call({ action: 'xoa.het' }, { token: tok() })).code).toBe(400);
  });
});

describe('đăng nhập', () => {
  it('đúng → token dùng được; tên đăng nhập không phân biệt hoa/thường; cập nhật last_login_at', async () => {
    const r = await call({ action: 'login', username: ' CHU ', password: 'MatKhauTot123' });
    expect(r.code).toBe(200);
    expect((await call({ action: 'me' }, { token: r.body.token })).code).toBe(200);
    expect(db.table('platform_admins')[0].last_login_at).toBeTruthy();
    expect(db.table('platform_login_attempts').at(-1)).toMatchObject({ success: true });
    expect(JSON.stringify(r.body)).not.toContain('password');
  });

  it('sai mật khẩu và sai tên đăng nhập cho CÙNG thông báo (không lộ tài khoản nào tồn tại)', async () => {
    const a = await call({ action: 'login', username: 'chu', password: 'sai' });
    const b = await call({ action: 'login', username: 'khong-co', password: 'sai' });
    expect(a.code).toBe(401); expect(b.code).toBe(401);
    expect(a.body.error).toBe(b.body.error);
  });

  it('tài khoản bị khóa không đăng nhập được kể cả đúng mật khẩu', async () => {
    db.table('platform_admins')[0].active = false;
    expect((await call({ action: 'login', username: 'chu', password: 'MatKhauTot123' })).code).toBe(401);
  });

  it('sai 5 lần từ cùng 1 IP với cùng tên → 429, kể cả khi sau đó nhập ĐÚNG mật khẩu', async () => {
    for (let i = 0; i < 5; i++) expect((await call({ action: 'login', username: 'chu', password: 'sai' })).code).toBe(401);
    expect((await call({ action: 'login', username: 'chu', password: 'MatKhauTot123' })).code).toBe(429);
  });

  it('kẻ ngoài gõ sai tên quản trị từ IP khác KHÔNG khóa được quản trị thật đăng nhập từ IP của họ', async () => {
    // 5 lượt sai trước đó đến từ IP lạ (ip_hash khác) nhắm vào đúng tên 'chu'
    db.seed('platform_login_attempts', Array.from({ length: 5 }, () => ({ ip_hash: 'ip-la', username: 'chu', success: false, created_at: new Date().toISOString() })));
    expect((await call({ action: 'login', username: 'chu', password: 'MatKhauTot123' })).code).toBe(200);
  });

  it('dò phân tán: ≥50 lượt sai vào 1 tên từ nhiều IP → khóa theo tên', async () => {
    db.seed('platform_login_attempts', Array.from({ length: 50 }, (_, i) => ({ ip_hash: `ip-${i}`, username: 'chu', success: false, created_at: new Date().toISOString() })));
    expect((await call({ action: 'login', username: 'chu', password: 'MatKhauTot123' })).code).toBe(429);
  });

  it('sai 10 lần từ 1 IP (nhiều tên khác nhau) → 429', async () => {
    for (let i = 0; i < 10; i++) await call({ action: 'login', username: `ten${i}`, password: 'x' });
    expect((await call({ action: 'login', username: 'chu', password: 'MatKhauTot123' })).code).toBe(429);
  });

  it('lượt sai cũ hơn 15 phút không còn bị tính', async () => {
    db.seed('platform_login_attempts', Array.from({ length: 6 }, () => ({ ip_hash: 'x', username: 'chu', success: false, created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString() })));
    expect((await call({ action: 'login', username: 'chu', password: 'MatKhauTot123' })).code).toBe(200);
  });

  it('thiếu bảng lượt đăng nhập (chưa chạy migration) → từ chối, KHÔNG bỏ qua giới hạn', async () => {
    db.fail['platform_login_attempts.select'] = 'relation does not exist';
    expect((await call({ action: 'login', username: 'chu', password: 'MatKhauTot123' })).code).toBe(500);
  });
});

describe('doanh nghiệp', () => {
  it('companies.list: trạng thái hạn, số ngày còn lại, số nhân viên, tên gói', async () => {
    const now = Date.now();
    db.seed('companies', [
      { id: 'c1', slug: 'hoanglong', name: 'Hoàng Long', active: true, created_at: '2026-01-01', plan_id: null, expires_at: null, is_trial: false },
      { id: 'c2', slug: 'dung-thu', name: 'Dùng thử', active: true, created_at: '2026-02-01', plan_id: null, expires_at: new Date(now + 3 * 86400000).toISOString(), is_trial: true },
      { id: 'c3', slug: 'het-han', name: 'Hết hạn', active: true, created_at: '2026-03-01', plan_id: 'co-ban', expires_at: new Date(now - 86400000).toISOString(), is_trial: false },
    ]);
    db.rpcs.platform_employee_counts = () => [{ company_id: 'c1', employee_count: 24 }, { company_id: 'c3', employee_count: 4 }];
    const r = await call({ action: 'companies.list' }, { token: tok() });
    const by = Object.fromEntries(r.body.companies.map((c: any) => [c.slug, c]));
    expect(by['hoanglong']).toMatchObject({ status: 'unlimited', daysLeft: null, employeeCount: 24 });
    expect(by['dung-thu']).toMatchObject({ status: 'trial', daysLeft: 3, isTrial: true, employeeCount: 0 });
    expect(by['het-han']).toMatchObject({ status: 'expired', planName: 'Cơ bản', maxEmployees: 10, employeeCount: 4 });
  });

  it('companies.create dùng thử: hạn = hôm nay + số ngày cấu hình; không giới hạn: hạn null', async () => {
    db.seed('platform_settings', [{ key: 'trial', value: { days: 10, maxEmployees: null } }]);
    const r1 = await call({ action: 'companies.create', slug: 'cty-a', name: 'Cty A', adminUsername: 'admin', adminPassword: 'abcd' }, { token: tok() });
    expect(r1.code).toBe(201);
    const a = db.table('companies').find(c => c.slug === 'cty-a')!;
    expect(a.is_trial).toBe(true);
    expect(Math.round((new Date(a.expires_at).getTime() - Date.now()) / 86400000)).toBe(10);

    const r2 = await call({ action: 'companies.create', slug: 'cty-b', name: 'Cty B', adminUsername: 'admin', adminPassword: 'abcd', subscription: 'unlimited' }, { token: tok() });
    expect(r2.code).toBe(201);
    expect(db.table('companies').find(c => c.slug === 'cty-b')).toMatchObject({ expires_at: null, is_trial: false });
    expect(db.table('employees').filter(e => e.id === 'emp_admin').length).toBe(2);
  });

  it('companies.create chặn tên cấm / thiếu thông tin / trùng mã', async () => {
    const base = { action: 'companies.create', name: 'X', adminUsername: 'admin', adminPassword: 'abcd' };
    expect((await call({ ...base, slug: 'www' }, { token: tok() })).code).toBe(400);
    expect((await call({ ...base, slug: 'ok-slug', adminPassword: '1' }, { token: tok() })).code).toBe(400);
    expect((await call({ ...base, slug: 'ok-slug' }, { token: tok() })).code).toBe(201);
    expect((await call({ ...base, slug: 'ok-slug' }, { token: tok() })).code).toBe(409);
  });

  it('companies.update: đổi hạn/gói/khóa; kiểm tra gói tồn tại và ngày hợp lệ', async () => {
    db.seed('companies', [{ id: 'c1', slug: 'a', name: 'A', active: true, plan_id: null, expires_at: null, is_trial: true }]);
    expect((await call({ action: 'companies.update', id: 'c1', planId: 'khong-co' }, { token: tok() })).code).toBe(400);
    expect((await call({ action: 'companies.update', id: 'c1', expiresAt: 'abc' }, { token: tok() })).code).toBe(400);
    expect((await call({ action: 'companies.update', id: 'khong-co', active: false }, { token: tok() })).code).toBe(404);
    expect((await call({ action: 'companies.update', id: 'c1' }, { token: tok() })).code).toBe(400);
    const r = await call({ action: 'companies.update', id: 'c1', planId: 'co-ban', expiresAt: '2027-01-01T00:00:00Z', isTrial: false, active: false }, { token: tok() });
    expect(r.code).toBe(200);
    expect(db.table('companies')[0]).toMatchObject({ plan_id: 'co-ban', expires_at: '2027-01-01T00:00:00.000Z', is_trial: false, active: false });
    await call({ action: 'companies.update', id: 'c1', expiresAt: null }, { token: tok() });
    expect(db.table('companies')[0].expires_at).toBeNull();
  });
});

describe('gói dịch vụ', () => {
  it('plans.save: thêm mới + sửa giá; từ chối dữ liệu sai; plans.list có cả gói tắt', async () => {
    const goi = { id: 'chuyen-nghiep', name: 'Chuyên nghiệp', priceMonthly: 700000, priceYearly: 7000000, maxEmployees: 50, active: true, sortOrder: 2 };
    expect((await call({ action: 'plans.save', ...goi }, { token: tok() })).code).toBe(200);
    expect((await call({ action: 'plans.save', ...goi, priceMonthly: 800000 }, { token: tok() })).code).toBe(200);
    expect(db.table('plans').find(p => p.id === 'chuyen-nghiep')!.price_monthly).toBe(800000);
    const bad = await call({ action: 'plans.save', ...goi, priceMonthly: -5 }, { token: tok() });
    expect(bad.code).toBe(400);
    expect(bad.body.errors.priceMonthly).toBeTruthy();
    await call({ action: 'plans.save', ...goi, priceMonthly: 800000, active: false }, { token: tok() });
    const list = await call({ action: 'plans.list' }, { token: tok() });
    expect(list.body.plans.map((p: any) => p.id)).toEqual(['co-ban', 'chuyen-nghiep']);
    expect(list.body.plans[1]).toMatchObject({ active: false, priceMonthly: 800000, maxEmployees: 50 });
  });
});

describe('đơn đăng ký', () => {
  const donCho = (over: any = {}) => ({ id: 'o1', code: 'LOLOAAAA2222', company_id: 'c1', plan_id: 'co-ban', period: 'month', months: 1, amount: 300000, status: 'pending', created_at: '2026-10-01', note: '', ...over });
  const congTy = (over: any = {}) => ({ id: 'c1', slug: 'a', name: 'A', active: true, plan_id: null, expires_at: null, is_trial: true, ...over });

  it('xác nhận đơn công ty đang DÙNG THỬ còn 5 ngày: gói được kích hoạt, tính TIẾP từ hạn dùng thử (không mất ngày)', async () => {
    const exp = new Date(Date.now() + 5 * 86400000);
    db.seed('companies', [congTy({ expires_at: exp.toISOString() })]); db.seed('subscription_orders', [donCho()]);
    const r = await call({ action: 'orders.confirm', id: 'o1' }, { token: tok() });
    expect(r.code).toBe(200);
    const c = db.table('companies')[0];
    expect(c).toMatchObject({ plan_id: 'co-ban', is_trial: false });
    const diffNgay = (new Date(c.expires_at).getTime() - exp.getTime()) / 86400000;
    expect(diffNgay).toBeGreaterThanOrEqual(28); expect(diffNgay).toBeLessThanOrEqual(31);
    expect(db.table('subscription_orders')[0]).toMatchObject({ status: 'confirmed', confirmed_by: ADMIN_ID });
    expect(db.table('subscription_orders')[0].period_end).toBe(c.expires_at);
  });

  it('công ty ĐÃ HẾT HẠN: tính từ bây giờ, theo năm = 12 tháng', async () => {
    db.seed('companies', [congTy({ expires_at: '2026-01-01T00:00:00Z', is_trial: true })]);
    db.seed('subscription_orders', [donCho({ period: 'year', months: 12, amount: 3000000 })]);
    await call({ action: 'orders.confirm', id: 'o1' }, { token: tok() });
    const c = db.table('companies')[0];
    const nam = (new Date(c.expires_at).getTime() - Date.now()) / 86400000;
    expect(nam).toBeGreaterThan(364); expect(nam).toBeLessThan(367);
  });

  it('xác nhận lần 2 → 409, không cộng thêm hạn', async () => {
    db.seed('companies', [congTy()]); db.seed('subscription_orders', [donCho()]);
    await call({ action: 'orders.confirm', id: 'o1' }, { token: tok() });
    const han1 = db.table('companies')[0].expires_at;
    expect((await call({ action: 'orders.confirm', id: 'o1' }, { token: tok() })).code).toBe(409);
    expect(db.table('companies')[0].expires_at).toBe(han1);
  });

  it('cập nhật công ty lỗi → đơn được TRẢ VỀ pending (không để đơn đã xác nhận mà công ty chưa được gia hạn)', async () => {
    db.seed('companies', [congTy()]); db.seed('subscription_orders', [donCho()]);
    db.fail['companies.update'] = 'lỗi giả lập';
    const r = await call({ action: 'orders.confirm', id: 'o1' }, { token: tok() });
    expect(r.code).toBe(500);
    expect(db.table('subscription_orders')[0]).toMatchObject({ status: 'pending', confirmed_at: null, confirmed_by: null, period_end: null });
  });

  it('không tìm thấy đơn / công ty → 404', async () => {
    expect((await call({ action: 'orders.confirm', id: 'khong-co' }, { token: tok() })).code).toBe(404);
    db.seed('subscription_orders', [donCho({ company_id: 'da-xoa' })]);
    expect((await call({ action: 'orders.confirm', id: 'o1' }, { token: tok() })).code).toBe(404);
  });

  it('hủy đơn chờ; đơn đã xác nhận không hủy được', async () => {
    db.seed('companies', [congTy()]);
    db.seed('subscription_orders', [donCho(), donCho({ id: 'o2', code: 'LOLOBBBB3333', status: 'confirmed' })]);
    expect((await call({ action: 'orders.cancel', id: 'o1', note: 'Khách không chuyển' }, { token: tok() })).code).toBe(200);
    expect(db.table('subscription_orders')[0]).toMatchObject({ status: 'cancelled', note: 'Khách không chuyển' });
    expect((await call({ action: 'orders.cancel', id: 'o2' }, { token: tok() })).code).toBe(409);
  });

  it('orders.list: lọc theo trạng thái, kèm tên công ty/gói', async () => {
    db.seed('companies', [congTy()]);
    db.seed('subscription_orders', [donCho(), donCho({ id: 'o2', code: 'LOLOBBBB3333', status: 'confirmed', created_at: '2026-10-02' })]);
    const all = await call({ action: 'orders.list' }, { token: tok() });
    expect(all.body.orders.map((o: any) => o.id)).toEqual(['o2', 'o1']);   // mới nhất trước
    expect(all.body.orders[0]).toMatchObject({ companyName: 'A', companySlug: 'a', planName: 'Cơ bản', amount: 300000 });
    const pend = await call({ action: 'orders.list', status: 'pending' }, { token: tok() });
    expect(pend.body.orders.map((o: any) => o.id)).toEqual(['o1']);
  });
});

describe('cấu hình & mật khẩu', () => {
  it('settings.save/get: dùng thử + ngân hàng; từ chối giá trị sai', async () => {
    expect((await call({ action: 'settings.save', trial: { days: 0 } }, { token: tok() })).code).toBe(400);
    expect((await call({ action: 'settings.save', trial: { days: 7, maxEmployees: 0 } }, { token: tok() })).code).toBe(400);
    expect((await call({ action: 'settings.save', trial: { days: 14, maxEmployees: '' }, bank: { bankName: 'VCB', accountNumber: '0123', accountName: 'CTY LOLO', note: 'ghi chú' } }, { token: tok() })).code).toBe(200);
    const g = await call({ action: 'settings.get' }, { token: tok() });
    expect(g.body).toEqual({ trial: { days: 14, maxEmployees: null }, bank: { bankName: 'VCB', accountNumber: '0123', accountName: 'CTY LOLO', note: 'ghi chú' } });
  });

  it('chưa có cấu hình trong DB → trả mặc định (7 ngày, ngân hàng trống)', async () => {
    const g = await call({ action: 'settings.get' }, { token: tok() });
    expect(g.body.trial).toEqual({ days: 7, maxEmployees: null });
    expect(g.body.bank.accountNumber).toBe('');
  });

  it('đổi mật khẩu: sai mật khẩu hiện tại / mật khẩu yếu bị từ chối; thành công thì mật khẩu cũ hết tác dụng', async () => {
    expect((await call({ action: 'password.change', currentPassword: 'sai', newPassword: 'MatKhauMoi12345' }, { token: tok() })).code).toBe(400);
    expect((await call({ action: 'password.change', currentPassword: 'MatKhauTot123', newPassword: 'ngan1' }, { token: tok() })).code).toBe(400);
    expect((await call({ action: 'password.change', currentPassword: 'MatKhauTot123', newPassword: 'toanchuuuuuuuu' }, { token: tok() })).code).toBe(400);
    expect((await call({ action: 'password.change', currentPassword: 'MatKhauTot123', newPassword: 'MatKhauMoi12345' }, { token: tok() })).code).toBe(200);
    expect((await call({ action: 'login', username: 'chu', password: 'MatKhauTot123' })).code).toBe(401);
    expect((await call({ action: 'login', username: 'chu', password: 'MatKhauMoi12345' })).code).toBe(200);
  });

  it('đăng xuất thật: token cũ bị từ chối ngay (kể cả còn hạn); đăng nhập lại cho token mới dùng được', async () => {
    const login = await call({ action: 'login', username: 'chu', password: 'MatKhauTot123' });
    const t1 = login.body.token;
    expect((await call({ action: 'me' }, { token: t1 })).code).toBe(200);
    expect((await call({ action: 'logout' }, { token: t1 })).code).toBe(200);
    expect((await call({ action: 'me' }, { token: t1 })).code).toBe(401);
    const t2 = (await call({ action: 'login', username: 'chu', password: 'MatKhauTot123' })).body.token;
    expect((await call({ action: 'me' }, { token: t2 })).code).toBe(200);
  });

  it('đổi mật khẩu thu hồi token cũ nhưng trả token MỚI cho phiên hiện tại', async () => {
    const old = (await call({ action: 'login', username: 'chu', password: 'MatKhauTot123' })).body.token;
    const r = await call({ action: 'password.change', currentPassword: 'MatKhauTot123', newPassword: 'MatKhauMoi12345' }, { token: old });
    expect(r.code).toBe(200);
    expect((await call({ action: 'me' }, { token: old })).code).toBe(401);
    expect((await call({ action: 'me' }, { token: r.body.token })).code).toBe(200);
  });
});

describe('tài khoản quản trị & nhật ký', () => {
  const mk = 'MatKhauBanDau1';
  const tao = (u = 'nv1') => call({ action: 'accounts.create', username: u, name: 'Nhân viên', password: mk }, { token: tok() });

  it('chủ tạo được tài khoản: băm mật khẩu, không phải chủ, trùng tên → 409, mật khẩu yếu/tên sai → 400', async () => {
    const r = await tao();
    expect(r.code).toBe(201);
    const row = db.table('platform_admins').find(a => a.username === 'nv1')!;
    expect(row.is_owner).toBeFalsy();
    expect(await bcrypt.compare(mk, row.password_hash)).toBe(true);
    expect((await tao()).code).toBe(409);
    expect((await call({ action: 'accounts.create', username: 'x y', password: mk }, { token: tok() })).code).toBe(400);
    expect((await call({ action: 'accounts.create', username: 'nv2', password: 'ngan' }, { token: tok() })).code).toBe(400);
    // Tài khoản mới đăng nhập được
    expect((await call({ action: 'login', username: 'nv1', password: mk })).code).toBe(200);
  });

  it('quản trị viên không phải chủ bị từ chối mọi action accounts.* (403) nhưng xem được nhật ký', async () => {
    await tao();
    const nv = db.table('platform_admins').find(a => a.username === 'nv1')!;
    const t = signPlatformToken({ id: nv.id, username: 'nv1', ver: 0 }, SECRET);
    for (const a of ['accounts.list', 'accounts.create', 'accounts.update', 'accounts.resetPassword']) {
      expect((await call({ action: a, id: ADMIN_ID, username: 'nv9', password: mk }, { token: t })).code).toBe(403);
    }
    expect((await call({ action: 'logs.list' }, { token: t })).code).toBe(200);
  });

  it('khóa tài khoản: phiên đang mở bị thu hồi + không đăng nhập được; không tự khóa mình; không đụng chủ', async () => {
    await tao();
    const nvTok = (await call({ action: 'login', username: 'nv1', password: mk })).body.token;
    const nv = db.table('platform_admins').find(a => a.username === 'nv1')!;
    expect((await call({ action: 'accounts.update', id: nv.id, active: false }, { token: tok() })).code).toBe(200);
    expect((await call({ action: 'me' }, { token: nvTok })).code).toBe(401);
    expect((await call({ action: 'login', username: 'nv1', password: mk })).code).toBe(401);
    expect((await call({ action: 'accounts.update', id: ADMIN_ID, active: false }, { token: tok() })).code).toBe(400);
    expect((await call({ action: 'accounts.update', id: nv.id, active: true }, { token: tok() })).code).toBe(200);
    expect((await call({ action: 'login', username: 'nv1', password: mk })).code).toBe(200);
  });

  it('đặt lại mật khẩu: mật khẩu cũ hết tác dụng, phiên cũ bị thu hồi', async () => {
    await tao();
    const nvTok = (await call({ action: 'login', username: 'nv1', password: mk })).body.token;
    const nv = db.table('platform_admins').find(a => a.username === 'nv1')!;
    expect((await call({ action: 'accounts.resetPassword', id: nv.id, newPassword: 'MatKhauMoi99999' }, { token: tok() })).code).toBe(200);
    expect((await call({ action: 'me' }, { token: nvTok })).code).toBe(401);
    expect((await call({ action: 'login', username: 'nv1', password: mk })).code).toBe(401);
    expect((await call({ action: 'login', username: 'nv1', password: 'MatKhauMoi99999' })).code).toBe(200);
    expect((await call({ action: 'accounts.resetPassword', id: ADMIN_ID, newPassword: 'MatKhauMoi99999' }, { token: tok() })).code).toBe(400);   // chủ tự đổi ở password.change
  });

  it('nhật ký ghi thao tác kèm trước/sau, KHÔNG chứa mật khẩu/hash; xem được qua logs.list', async () => {
    db.seed('companies', [{ id: 'c1', slug: 'a', name: 'Công ty A', active: true, plan_id: null, expires_at: null, is_trial: false }]);
    await tao();
    await call({ action: 'companies.update', id: 'c1', active: false }, { token: tok() });
    // Đổi mật khẩu thu hồi token cũ → từ đây dùng token MỚI trả về
    const moiTok = (await call({ action: 'password.change', currentPassword: 'MatKhauTot123', newPassword: 'MatKhauMoi99999' }, { token: tok() })).body.token;
    const logs = db.table('platform_audit_logs');
    const kh = logs.find(l => l.action === 'companies.update')!;
    expect(kh.admin_username).toBe('chu');
    expect(kh.detail).toEqual({ active: { from: true, to: false } });
    expect(kh.summary).toMatch(/Khóa doanh nghiệp/);
    expect(logs.some(l => l.action === 'accounts.create')).toBe(true);
    expect(JSON.stringify(logs)).not.toMatch(/MatKhauBanDau1|MatKhauMoi99999|MatKhauTot123|\$2[aby]\$/);
    const list = await call({ action: 'logs.list' }, { token: moiTok });
    expect(list.body.retentionDays).toBe(30);
    expect(list.body.logs.length).toBe(logs.length);
    // Lọc theo người / theo thao tác
    expect((await call({ action: 'logs.list', adminUsername: 'khong-co' }, { token: moiTok })).body.logs).toEqual([]);
    const loc = (await call({ action: 'logs.list', actionFilter: 'companies.update' }, { token: moiTok })).body.logs;
    expect(loc.length).toBe(1);
  });

  it('chỉ giữ 30 ngày: bản ghi cũ hơn bị xóa khi mở nhật ký', async () => {
    const cu = new Date(Date.now() - 31 * 86400000).toISOString(), moi = new Date(Date.now() - 29 * 86400000).toISOString();
    db.seed('platform_audit_logs', [
      { id: 'a', created_at: cu, admin_username: 'chu', action: 'x', summary: 'cũ' },
      { id: 'b', created_at: moi, admin_username: 'chu', action: 'x', summary: 'mới' },
    ]);
    const r = await call({ action: 'logs.list' }, { token: tok() });
    expect(r.body.logs.map((l: any) => l.summary)).toEqual(['mới']);
    expect(db.table('platform_audit_logs').map(l => l.id)).toEqual(['b']);
  });

  it('thao tác thành công cả khi ghi nhật ký lỗi (không làm hỏng thao tác chính)', async () => {
    db.fail['platform_audit_logs.insert'] = 'boom';
    expect((await tao()).code).toBe(201);
  });
});
