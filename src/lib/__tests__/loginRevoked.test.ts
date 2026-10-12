import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { FakeDb } from './helpers/fakeSupabase';
import { sessionRevokeReason } from '../employeeAccount';

// Rà soát bảo mật 11/10/2026: tài khoản bị thu hồi / nghỉ việc / mật khẩu rỗng không được đăng nhập; phiên của người đã bị xóa phải bị đăng xuất.
const db = new FakeDb();
vi.mock('@supabase/supabase-js', () => ({ createClient: () => db.client() }));
import login from '../../../api/login';

const res = () => {
  const r: any = { code: 0, body: null, headers: {} };
  r.status = (c: number) => { r.code = c; return r; };
  r.json = (b: any) => { r.body = b; return r; };
  r.setHeader = (k: string, v: string) => { r.headers[k] = v; return r; };
  return r;
};
const goc = { ...process.env };
let hash: string;
const nv = (over: any = {}) => ({ id: 'e1', company_id: 'c1', name: 'An', username: 'an', password: hash, ...over });
const dangNhap = async (body: any = { username: 'an', password: 'matkhau123' }) => {
  const r = res(); await login({ method: 'POST', body, headers: { host: 'abc.lolo.io.vn' } } as any, r); return r;
};

beforeEach(async () => {
  db.tables = {}; db.fail = {}; db.log = []; db.missingColumns = {};
  hash ||= await bcrypt.hash('matkhau123', 4);
  process.env.VITE_BASE_DOMAIN = 'lolo.io.vn';
  process.env.VITE_SUPABASE_URL = 'https://x.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'srv';
  process.env.SUPABASE_JWT_SECRET = 'bi-mat-thu';
  db.seed('companies', [{ id: 'c1', slug: 'abc', name: 'ABC', active: true, expires_at: null, is_trial: false }]);
});
afterEach(() => { process.env = { ...goc }; });

describe('api/login — chặn tài khoản không còn hiệu lực', () => {
  it('tài khoản bình thường đăng nhập được', async () => {
    db.seed('employees', [nv()]);
    expect((await dangNhap()).code).toBe(200);
  });
  it('has_system_account = false (đã thu hồi) → 403 dù mật khẩu đúng', async () => {
    db.seed('employees', [nv({ has_system_account: false })]);
    const r = await dangNhap();
    expect(r.code).toBe(403);
    expect(r.body.token).toBeUndefined();
  });
  it('nhân viên đã nghỉ việc (status = retired) → 403', async () => {
    db.seed('employees', [nv({ status: 'retired' })]);
    expect((await dangNhap()).code).toBe(403);
  });
  it('nghỉ dài hạn (status = leave) vẫn đăng nhập được', async () => {
    db.seed('employees', [nv({ status: 'leave' })]);
    expect((await dangNhap()).code).toBe(200);
  });
  it('has_system_account = null/true (dữ liệu cũ) vẫn đăng nhập được', async () => {
    db.seed('employees', [nv({ has_system_account: null })]);
    expect((await dangNhap()).code).toBe(200);
  });
  it('mật khẩu sai trên tài khoản đã thu hồi → vẫn báo "sai mật khẩu" (không lộ tài khoản đã bị khóa)', async () => {
    db.seed('employees', [nv({ has_system_account: false })]);
    const r = await dangNhap({ username: 'an', password: 'sai' });
    expect(r.code).toBe(401);
  });
  it('mật khẩu RỖNG không còn rơi về "123"', async () => {
    db.seed('employees', [nv({ password: null }), nv({ id: 'e2', username: 'binh', password: '' })]);
    expect((await dangNhap({ username: 'an', password: '123' })).code).toBe(401);
    expect((await dangNhap({ username: 'binh', password: '123' })).code).toBe(401);
  });
  it('mật khẩu "123" đã đặt thật vẫn dùng được (không ép đổi ở bước này)', async () => {
    db.seed('employees', [nv({ password: '123' })]);
    expect((await dangNhap({ username: 'an', password: '123' })).code).toBe(200);
  });
  it('tài khoản công ty khác (cùng tên đăng nhập) không đăng nhập được ở địa chỉ này', async () => {
    db.seed('employees', [nv({ company_id: 'c2' })]);
    expect((await dangNhap()).code).toBe(401);
  });
});

describe('sessionRevokeReason — phiên của người đã bị xóa / thu hồi', () => {
  const phien = { id: 'e1', username: 'an' };
  const ds = (over: any = {}) => [{ id: 'e1', username: 'an', hasSystemAccount: true, status: 'working', ...over }, { id: 'e2', username: 'binh' }];
  it('còn hợp lệ → null', () => { expect(sessionRevokeReason(phien, ds())).toBeNull(); });
  it('không còn hồ sơ trong danh sách thật → removed', () => { expect(sessionRevokeReason(phien, [{ id: 'e2', username: 'binh' }])).toBe('removed'); });
  it('đã thu hồi tài khoản / mất tên đăng nhập → revoked', () => {
    expect(sessionRevokeReason(phien, ds({ hasSystemAccount: false }))).toBe('revoked');
    expect(sessionRevokeReason(phien, ds({ username: '' }))).toBe('revoked');
  });
  it('đã nghỉ việc → retired', () => { expect(sessionRevokeReason(phien, ds({ status: 'retired' }))).toBe('retired'); });
  it('danh sách máy chủ rỗng (hết hạn token / RLS / mất mạng) → KHÔNG đăng xuất oan', () => {
    expect(sessionRevokeReason(phien, [])).toBeNull();
    expect(sessionRevokeReason(phien, null)).toBeNull();
    expect(sessionRevokeReason(null, ds())).toBeNull();
  });
  it('phiên cũ không có mã nhân viên → so theo tên đăng nhập (không phân biệt hoa thường)', () => {
    expect(sessionRevokeReason({ username: 'AN' }, ds())).toBeNull();
    expect(sessionRevokeReason({ username: 'khong-co' }, ds())).toBe('removed');
  });
});
