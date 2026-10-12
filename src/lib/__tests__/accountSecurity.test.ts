import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import { FakeDb } from './helpers/fakeSupabase';
import { validateNewPassword } from '../../../api/_security';

// Giai đoạn A bảo mật tài khoản: khóa đăng nhập tạm, claim tv, cờ đổi mật khẩu, api/change-password, và kiểm tra tĩnh file SQL.
const db = new FakeDb();
vi.mock('@supabase/supabase-js', () => ({ createClient: () => db.client() }));
import login from '../../../api/login';
import changePassword from '../../../api/change-password';

const SECRET = 'bi-mat-thu';
const res = () => {
  const r: any = { code: 0, body: null };
  r.status = (c: number) => { r.code = c; return r; };
  r.json = (b: any) => { r.body = b; return r; };
  r.setHeader = () => r;
  return r;
};
const goc = { ...process.env };
let hash: string;
const nv = (over: any = {}) => ({ id: 'e1', company_id: 'c1', name: 'An', username: 'an', password: hash, ...over });
const dangNhap = async (password = 'matkhau123') => {
  const r = res(); await login({ method: 'POST', body: { username: 'an', password }, headers: { host: 'abc.lolo.io.vn' } } as any, r); return r;
};
const doiMk = async (token: string, body: any) => {
  const r = res(); await changePassword({ method: 'POST', body, headers: { authorization: `Bearer ${token}` } } as any, r); return r;
};
const sec = () => db.table('employee_security').find(x => x.employee_id === 'e1');

beforeEach(async () => {
  db.tables = {}; db.fail = {}; db.log = []; db.missingColumns = {}; db.missingTables = new Set();
  hash ||= await bcrypt.hash('matkhau123', 4);
  process.env.VITE_BASE_DOMAIN = 'lolo.io.vn';
  process.env.VITE_SUPABASE_URL = 'https://x.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'srv';
  process.env.SUPABASE_JWT_SECRET = SECRET;
  db.seed('companies', [{ id: 'c1', slug: 'abc', name: 'ABC', active: true, expires_at: null, is_trial: false }]);
  db.seed('employees', [nv()]);
});
afterEach(() => { process.env = { ...goc }; });

describe('api/login — khóa tạm khi nhập sai', () => {
  it('sai 4 lần vẫn 401, lần thứ 5 → 429 và khóa; đúng mật khẩu trong lúc khóa vẫn bị từ chối', async () => {
    for (let i = 0; i < 4; i++) expect((await dangNhap('sai')).code).toBe(401);
    const r5 = await dangNhap('sai');
    expect(r5.code).toBe(429);
    expect(sec().locked_until).toBeTruthy();
    const dung = await dangNhap();   // mật khẩu ĐÚNG nhưng đang khóa
    expect(dung.code).toBe(429);
    expect(dung.body.token).toBeUndefined();
  });
  it('hết thời gian khóa → đăng nhập lại được và bộ đếm được xóa', async () => {
    db.seed('employee_security', [{ company_id: 'c1', employee_id: 'e1', failed_attempts: 0, locked_until: new Date(Date.now() - 1000).toISOString(), token_version: 0 }]);
    expect((await dangNhap()).code).toBe(200);
    expect(sec().locked_until).toBeNull();
  });
  it('đăng nhập thành công xóa số lần sai và ghi last_login_at', async () => {
    await dangNhap('sai'); await dangNhap('sai');
    expect(sec().failed_attempts).toBe(2);
    expect((await dangNhap()).code).toBe(200);
    expect(sec().failed_attempts).toBe(0);
    expect(sec().last_login_at).toBeTruthy();
  });
  it('tên đăng nhập không tồn tại → 401 và không tạo dòng bảo mật', async () => {
    const r = res(); await login({ method: 'POST', body: { username: 'khongco', password: 'x' }, headers: { host: 'abc.lolo.io.vn' } } as any, r);
    expect(r.code).toBe(401);
    expect(db.table('employee_security')).toHaveLength(0);
  });
  it('bảng employee_security chưa có (chưa chạy SQL) → đăng nhập vẫn chạy bình thường, token tv = 0', async () => {
    db.missingTables.add('employee_security');
    const r = await dangNhap();
    expect(r.code).toBe(200);
    expect((jwt.decode(r.body.token) as any).tv).toBe(0);
    expect((await dangNhap('sai')).code).toBe(401);   // sai mật khẩu cũng không lỗi 500
  });
});

describe('api/login — claim tv và cờ đổi mật khẩu', () => {
  it('token mang tv = token_version hiện tại', async () => {
    db.seed('employee_security', [{ company_id: 'c1', employee_id: 'e1', failed_attempts: 0, token_version: 3 }]);
    const r = await dangNhap();
    expect((jwt.decode(r.body.token) as any).tv).toBe(3);
  });
  it('must_change_password = true → mustChangePassword', async () => {
    db.seed('employee_security', [{ company_id: 'c1', employee_id: 'e1', failed_attempts: 0, token_version: 0, must_change_password: true }]);
    expect((await dangNhap()).body.mustChangePassword).toBe(true);
  });
  it('dùng mật khẩu mặc định 123 → defaultPassword = true; mật khẩu khác → false', async () => {
    db.table('employees')[0].password = await bcrypt.hash('123', 4);
    const r = await dangNhap('123');
    expect(r.body.defaultPassword).toBe(true);
    expect(r.body.mustChangePassword).toBe(false);
    db.table('employees')[0].password = hash;
    expect((await dangNhap()).body.defaultPassword).toBe(false);
  });
});

describe('api/change-password', () => {
  const lay = async () => (await dangNhap()).body.token as string;
  it('đổi thành công: hash mới, tv tăng, cờ bắt đổi được bỏ, trả token mới', async () => {
    db.seed('employee_security', [{ company_id: 'c1', employee_id: 'e1', failed_attempts: 0, token_version: 0, must_change_password: true }]);
    const r = await doiMk(await lay(), { oldPassword: 'matkhau123', newPassword: 'MatKhauMoi9' });
    expect(r.code).toBe(200);
    expect(await bcrypt.compare('MatKhauMoi9', db.table('employees')[0].password)).toBe(true);
    expect(sec().token_version).toBe(1);
    expect(sec().must_change_password).toBe(false);
    expect((jwt.decode(r.body.token) as any).tv).toBe(1);
    // đăng nhập lại bằng mật khẩu mới được, mật khẩu cũ thì không
    expect((await dangNhap('MatKhauMoi9')).code).toBe(200);
    expect((await dangNhap('matkhau123')).code).toBe(401);
  });
  it('token cũ (tv thấp hơn) dùng lại sau khi đổi mật khẩu → 401', async () => {
    const cu = await lay();
    expect((await doiMk(cu, { oldPassword: 'matkhau123', newPassword: 'MatKhauMoi9' })).code).toBe(200);
    expect((await doiMk(cu, { oldPassword: 'MatKhauMoi9', newPassword: 'MatKhauMoi10' })).code).toBe(401);
  });
  it('mật khẩu hiện tại sai → 401, không đổi gì', async () => {
    const r = await doiMk(await lay(), { oldPassword: 'saiRoi', newPassword: 'MatKhauMoi9' });
    expect(r.code).toBe(401);
    expect(db.table('employees')[0].password).toBe(hash);
  });
  it('mật khẩu mới yếu / trùng cũ / là 123 → 400', async () => {
    const t = await lay();
    expect((await doiMk(t, { oldPassword: 'matkhau123', newPassword: '12345' })).code).toBe(400);
    expect((await doiMk(t, { oldPassword: 'matkhau123', newPassword: 'matkhau123' })).code).toBe(400);
    expect((await doiMk(t, { oldPassword: 'matkhau123', newPassword: '123' })).code).toBe(400);
  });
  it('không có token / token giả / token khóa / token quản trị → 401', async () => {
    expect((await doiMk('', { oldPassword: 'a', newPassword: 'b' })).code).toBe(401);
    expect((await doiMk(jwt.sign({ sub: 'e1', role: 'authenticated', company_id: 'c1' }, 'khac'), { oldPassword: 'a', newPassword: 'b' })).code).toBe(401);
    expect((await doiMk(jwt.sign({ sub: 'e1', role: 'anon', locked_company_id: 'c1' }, SECRET), { oldPassword: 'a', newPassword: 'b' })).code).toBe(401);
  });
  it('tài khoản đã bị thu hồi → 403', async () => {
    const t = await lay();
    db.table('employees')[0].has_system_account = false;
    expect((await doiMk(t, { oldPassword: 'matkhau123', newPassword: 'MatKhauMoi9' })).code).toBe(403);
  });
  it('token của công ty khác không đổi được mật khẩu nhân viên công ty này', async () => {
    const t = jwt.sign({ sub: 'e1', role: 'authenticated', company_id: 'c2', tv: 0 }, SECRET);
    expect((await doiMk(t, { oldPassword: 'matkhau123', newPassword: 'MatKhauMoi9' })).code).toBe(403);
    expect(db.table('employees')[0].password).toBe(hash);
  });
});

describe('validateNewPassword', () => {
  it('các quy tắc', () => {
    expect(validateNewPassword('abcdef', 'x', 'an')).toBeNull();
    expect(validateNewPassword('abc', 'x')).toMatch(/ít nhất/);
    expect(validateNewPassword('nguyenvan', 'x', 'NguyenVan')).toMatch(/tên đăng nhập/);
  });
});

describe('SQL 20261021a — kiểm tra tĩnh', () => {
  const sql = fs.readFileSync('supabase/migrations/20261021a_employee_security.sql', 'utf8');
  it('bảng chỉ service_role truy cập, có hàm kiểm tra phiên và chính sách RESTRICTIVE', () => {
    expect(sql).toMatch(/revoke all on table public\.employee_security from anon, authenticated/);
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/create or replace function public\.employee_session_is_live/);
    expect(sql).toMatch(/as restrictive for all to authenticated/);
    expect(sql).toMatch(/coalesce\(\(auth\.jwt\(\) ->> 'tv'\)::integer, 0\)/);   // token cũ không có tv vẫn hợp lệ
    expect(sql).toMatch(/- 'password'/);   // không làm lộ lại cột password
  });
  it('có file đường lui', () => {
    expect(fs.existsSync('supabase/migrations/20261021b_employee_security_rollback.sql')).toBe(true);
  });
});
