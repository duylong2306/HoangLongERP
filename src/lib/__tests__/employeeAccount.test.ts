import { describe, it, expect, vi } from 'vitest';
vi.mock('../dbService', () => ({ dbService: {} }));
import { hasLoginAccount } from '../employeeAccount';
import { ensureAdminAndPasswords } from '../../context/AuthContext';

// Hồi quy lỗi "xóa tài khoản, tải lại trang tài khoản tự tạo lại": nhân viên đã thu hồi tài khoản (username rỗng, hasSystemAccount=false)
// KHÔNG được tự có lại tên đăng nhập/mật khẩu "123" sau khi chuẩn hóa dữ liệu khi tải trang.
describe('hasLoginAccount', () => {
  it('có tên đăng nhập thật và chưa bị thu hồi → có tài khoản', () => {
    expect(hasLoginAccount({ username: 'nghia367', hasSystemAccount: true })).toBe(true);
    expect(hasLoginAccount({ username: 'nghia367' })).toBe(true);               // dữ liệu cũ chưa có cờ → vẫn tính là có
  });
  it('tên đăng nhập rỗng/khoảng trắng/thiếu → không có tài khoản', () => {
    expect(hasLoginAccount({ username: '' })).toBe(false);
    expect(hasLoginAccount({ username: '   ' })).toBe(false);
    expect(hasLoginAccount({})).toBe(false);
    expect(hasLoginAccount(undefined)).toBe(false);
  });
  it('đã bị thu hồi (hasSystemAccount=false) → không có tài khoản dù còn username', () => {
    expect(hasLoginAccount({ username: 'cu', hasSystemAccount: false })).toBe(false);
  });
});

describe('ensureAdminAndPasswords — không tự tạo tài khoản ma', () => {
  const dbSauKhiXoaTaiKhoan = { id: 'NV9', name: 'Nguyễn Văn A', username: '', password: '', hasSystemAccount: false } as any;
  it('nhân viên đã xóa tài khoản vẫn KHÔNG có tài khoản sau khi tải lại (đúng lỗi đã báo)', () => {
    const [, nv] = ensureAdminAndPasswords([dbSauKhiXoaTaiKhoan]);   // phần tử đầu là admin được thêm sẵn
    expect(nv.username || '').toBe('');
    expect(nv.password || '').toBe('');
    expect(hasLoginAccount(nv)).toBe(false);
  });
  it('nhân viên có tài khoản thật vẫn giữ nguyên tên đăng nhập và mật khẩu (băm)', () => {
    const [, nv] = ensureAdminAndPasswords([{ id: 'NV1', name: 'B', username: 'b01', password: '$2b$10$abc', hasSystemAccount: true } as any]);
    expect(nv.username).toBe('b01'); expect(nv.password).toBe('$2b$10$abc'); expect(hasLoginAccount(nv)).toBe(true);
  });
  it('tài khoản quản trị vẫn được đảm bảo luôn có mặt', () => {
    const r = ensureAdminAndPasswords([]);
    expect(r.some(e => e.id === 'emp_admin' && e.username === 'admin')).toBe(true);
  });
});

// Bước 1 (ẩn password khỏi trình duyệt): chuẩn hóa nhân viên KHÔNG được bơm mật khẩu mặc định cho admin, vì nếu hồ sơ admin bị lưu lại sẽ ghi đè mật khẩu thật.
describe('ensureAdminAndPasswords — không bơm mật khẩu cho admin', () => {
  it('admin lấy từ DB (không có cột password) vẫn không có password trong bộ nhớ', () => {
    const [admin] = ensureAdminAndPasswords([{ id: 'emp_admin', name: 'Quản trị', username: 'admin', hasSystemAccount: true } as any]);
    expect(admin.id).toBe('emp_admin');
    expect((admin as any).password).toBeUndefined();
  });
});
