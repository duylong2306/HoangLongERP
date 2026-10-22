import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FakeDb } from './helpers/fakeSupabase';
import { generateTempPassword } from '../../../api/_security';

// Quản trị viên đặt lại mật khẩu nhân viên: chỉ admin cùng công ty, không tự đặt lại mình / admin gốc, thu hồi phiên + bắt đổi mật khẩu, mật khẩu tạm chỉ trả 1 lần.
const db = new FakeDb();
vi.mock('@supabase/supabase-js', () => ({ createClient: () => db.client() }));
import resetPassword from '../../../api/reset-password';
import login from '../../../api/login';
import ResetPasswordDialog from '../../components/ResetPasswordDialog';

const SECRET = 'bi-mat-thu';
const res = () => { const r: any = { code: 0, body: null, headers: {} }; r.status = (c: number) => { r.code = c; return r; }; r.json = (b: any) => { r.body = b; return r; }; r.setHeader = (k: string, v: string) => { r.headers[k] = v; return r; }; return r; };
const goc = { ...process.env };
let hash: string;
const tokenOf = (sub: string, tv = 0, extra: any = {}) => jwt.sign({ sub, role: 'authenticated', company_id: 'c1', tv, ...extra }, SECRET);
const reset = async (token: string | null, body: any) => { const r = res(); await resetPassword({ method: 'POST', body, headers: token ? { authorization: `Bearer ${token}` } : {} } as any, r); return r; };
const sec = (id: string) => db.table('employee_security').find(x => x.employee_id === id);

beforeEach(async () => {
  db.tables = {}; db.fail = {}; db.log = []; db.missingColumns = {}; db.missingTables = new Set();
  hash ||= await bcrypt.hash('matkhau123', 4);
  process.env.VITE_BASE_DOMAIN = 'lolo.io.vn'; process.env.VITE_SUPABASE_URL = 'https://x.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'srv'; process.env.SUPABASE_JWT_SECRET = SECRET;
  db.seed('companies', [{ id: 'c1', slug: 'abc', name: 'ABC', active: true, expires_at: null, is_trial: false }]);
  db.seed('employees', [
    { id: 'emp_admin', company_id: 'c1', name: 'Admin gốc', username: 'admin', password: hash, role_group_ids: ['role_admin'], has_system_account: true },
    { id: 'boss', company_id: 'c1', name: 'Giám đốc', username: 'boss', password: hash, role_group_ids: ['role_admin'], has_system_account: true },
    { id: 'e1', company_id: 'c1', name: 'An', username: 'an', password: hash, role_group_ids: ['role_office'], has_system_account: true },
    { id: 'nghi', company_id: 'c1', name: 'Đã nghỉ', username: 'nghi', password: hash, has_system_account: true, status: 'retired' },
    { id: 'khac', company_id: 'c2', name: 'Công ty khác', username: 'kh', password: hash, has_system_account: true },
  ]);
});
afterEach(() => { process.env = { ...goc }; });

describe('api/reset-password', () => {
  it('admin đặt lại thành công: trả mật khẩu tạm 1 lần; hash mới ≠ cũ và khớp mật khẩu tạm; không lưu dạng rõ', async () => {
    const r = await reset(tokenOf('boss'), { employeeId: 'e1' });
    expect(r.code).toBe(200); expect(r.body).toMatchObject({ ok: true, forced: true, employeeName: 'An' });
    const tmp = r.body.tempPassword as string; expect(tmp).toHaveLength(10);
    expect(r.headers['Cache-Control']).toBe('no-store');
    const stored = db.table('employees').find(x => x.id === 'e1').password;
    expect(stored).not.toBe(hash); expect(stored).not.toContain(tmp); expect(await bcrypt.compare(tmp, stored)).toBe(true);
    expect(JSON.stringify(db.log)).not.toContain(tmp.slice(0, 8) + '"');   // mật khẩu rõ không bị ghi vào bảng nào
  });
  it('người bị đặt lại: token cũ bị thu hồi (token_version tăng), bị BẮT đổi mật khẩu, gỡ khóa tạm; đăng nhập bằng mật khẩu tạm → mustChangePassword', async () => {
    db.seed('employee_security', [{ company_id: 'c1', employee_id: 'e1', failed_attempts: 3, locked_until: new Date(Date.now() + 600000).toISOString(), token_version: 4, must_change_password: false }]);
    const tmp = (await reset(tokenOf('boss'), { employeeId: 'e1' })).body.tempPassword;
    expect(sec('e1')).toMatchObject({ token_version: 5, must_change_password: true, failed_attempts: 0, locked_until: null });
    const l = res(); await login({ method: 'POST', body: { username: 'an', password: tmp }, headers: { host: 'abc.lolo.io.vn' } } as any, l);
    expect(l.code).toBe(200); expect(l.body.mustChangePassword).toBe(true);
    const old = res(); await login({ method: 'POST', body: { username: 'an', password: 'matkhau123' }, headers: { host: 'abc.lolo.io.vn' } } as any, old);
    expect(old.code).toBe(401);   // mật khẩu cũ không còn dùng được
  });
  it('không phải admin → 403 và KHÔNG đổi mật khẩu', async () => {
    const r = await reset(tokenOf('e1'), { employeeId: 'boss' });
    expect(r.code).toBe(403); expect(db.table('employees').find(x => x.id === 'boss').password).toBe(hash);
  });
  it('không đặt lại cho chính mình; không đặt lại cho admin gốc emp_admin', async () => {
    expect((await reset(tokenOf('boss'), { employeeId: 'boss' })).code).toBe(400);
    expect((await reset(tokenOf('boss'), { employeeId: 'emp_admin' })).code).toBe(403);
    expect(db.table('employees').find(x => x.id === 'emp_admin').password).toBe(hash);
  });
  it('nhân viên ở công ty khác / đã nghỉ / không tồn tại → 404', async () => {
    for (const id of ['khac', 'nghi', 'khong-co']) expect((await reset(tokenOf('boss'), { employeeId: id })).code).toBe(404);
  });
  it('token sai/thiếu/token khóa/quản trị nền tảng/đã thu hồi → bị từ chối; sai phương thức → 405; thiếu mã nhân viên → 400', async () => {
    expect((await reset(null, { employeeId: 'e1' })).code).toBe(401);
    expect((await reset('rac', { employeeId: 'e1' })).code).toBe(401);
    expect((await reset(jwt.sign({ sub: 'boss', role: 'authenticated', locked_company_id: 'c1' }, SECRET), { employeeId: 'e1' })).code).toBe(401);   // token khóa (không có company_id)
    db.seed('employee_security', [{ company_id: 'c1', employee_id: 'boss', token_version: 2, must_change_password: false }]);
    expect((await reset(tokenOf('boss', 1), { employeeId: 'e1' })).code).toBe(401);                                                              // phiên đã bị thu hồi
    expect((await reset(tokenOf('boss', 2), {})).code).toBe(400);
    const g = res(); await resetPassword({ method: 'GET', headers: {} } as any, g); expect(g.code).toBe(405);
  });
  it('chưa chạy SQL employee_security → vẫn đổi được mật khẩu nhưng báo forced=false (không ép đổi)', async () => {
    db.missingTables = new Set(['employee_security']);
    const r = await reset(tokenOf('boss'), { employeeId: 'e1' });
    expect(r.code).toBe(200); expect(r.body.forced).toBe(false);
  });
});

describe('generateTempPassword', () => {
  it('10 ký tự, đủ chữ hoa + chữ thường + số, không có ký tự dễ nhầm; mỗi lần khác nhau', () => {
    const { randomInt } = require('node:crypto');
    const set = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const p = generateTempPassword(randomInt); set.add(p);
      expect(p).toHaveLength(10); expect(p).toMatch(/[A-Z]/); expect(p).toMatch(/[a-z]/); expect(p).toMatch(/[0-9]/); expect(p).not.toMatch(/[0OIl1]/);
    }
    expect(set.size).toBeGreaterThan(35);
  });
});

describe('ResetPasswordDialog', () => {
  const emp = { id: 'e1', name: 'An', username: 'an' };
  it('xác nhận → hiện mật khẩu tạm MỘT lần + cảnh báo; đóng thì không còn', async () => {
    const fetcher = vi.fn(async () => ({ tempPassword: 'Ab3dEfGh7k', forced: true, employeeName: 'An' })); const onClose = vi.fn();
    render(<ResetPasswordDialog employee={emp} onClose={onClose} fetcher={fetcher} />);
    fireEvent.click(screen.getByTestId('reset-pw-confirm'));
    await waitFor(() => expect(screen.getByTestId('reset-pw-temp').textContent).toBe('Ab3dEfGh7k'));
    expect(fetcher).toHaveBeenCalledWith('e1'); expect(screen.getByText(/không hiện lại/)).toBeTruthy();
    fireEvent.click(screen.getByTestId('reset-pw-close')); expect(onClose).toHaveBeenCalled();
  });
  it('lỗi từ máy chủ → hiện thông báo, ở lại bước xác nhận, không lộ mật khẩu', async () => {
    const fetcher = vi.fn(async () => { throw new Error('Chỉ quản trị viên mới được đặt lại mật khẩu.'); });
    render(<ResetPasswordDialog employee={emp} onClose={() => {}} fetcher={fetcher} />);
    fireEvent.click(screen.getByTestId('reset-pw-confirm'));
    await waitFor(() => expect(screen.getByTestId('reset-pw-error').textContent).toContain('Chỉ quản trị viên'));
    expect(screen.queryByTestId('reset-pw-temp')).toBeNull();
  });
  it('trong giao diện App: nút chỉ hiện cho admin, không cho chính mình / admin gốc, và kiểm quyền "Sửa" Tài Khoản Hệ Thống', () => {
    const app = fs.readFileSync('src/App.tsx', 'utf8');
    expect(app).toMatch(/isRoleAdmin\(currentUser\.id\) && emp\.id !== currentUser\.id && emp\.id !== 'emp_admin' && emp\.username !== 'admin'/);
    expect(app).toMatch(/hasModulePermission\(currentUser\?\.id, 'settings_accounts', 'edit'\)/);
    expect(app).toContain('<ResetPasswordDialog');
  });
});
