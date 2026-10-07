import { describe, it, expect } from 'vitest';
import { validateSignup, slugProblem, hashIp, getClientIp } from '../../../api/_signup';

// Kiểm tra dữ liệu đăng ký doanh nghiệp công khai (Giai đoạn 2).
const hopLe = {
  companyName: '  Công ty  TNHH   Hoàng Long ', slug: ' HoangLong2 ', adminName: ' Nguyễn Văn A ',
  email: ' Admin@Example.COM ', phone: '091 234-5678', password: 'matkhau123',
};

describe('validateSignup', () => {
  it('dữ liệu hợp lệ → làm sạch (gộp khoảng trắng, chữ thường, bỏ ký tự thừa ở số điện thoại)', () => {
    const r = validateSignup(hopLe);
    expect(r.ok).toBe(true);
    expect(r.data).toEqual({
      companyName: 'Công ty TNHH Hoàng Long', slug: 'hoanglong2', adminName: 'Nguyễn Văn A',
      email: 'admin@example.com', phone: '0912345678', password: 'matkhau123',
    });
  });

  it.each([
    ['slug có dấu / ký tự lạ', { slug: 'hoàng long' }, 'slug'],
    ['slug 1 ký tự', { slug: 'a' }, 'slug'],
    ['slug bắt đầu bằng gạch ngang', { slug: '-abc' }, 'slug'],
    ['slug dành cho hệ thống (www)', { slug: 'www' }, 'slug'],
    ['slug dành cho hệ thống (api)', { slug: 'api' }, 'slug'],
    ['slug quá dài (41)', { slug: 'a'.repeat(41) }, 'slug'],
    ['tên doanh nghiệp rỗng', { companyName: ' ' }, 'companyName'],
    ['họ tên quá ngắn', { adminName: 'A' }, 'adminName'],
    ['email sai', { email: 'khong-phai-email' }, 'email'],
    ['số điện thoại sai', { phone: '12345' }, 'phone'],
    ['mật khẩu ngắn', { password: 'abc123' }, 'password'],
    ['mật khẩu toàn chữ', { password: 'chuchuchuchu' }, 'password'],
    ['mật khẩu toàn số', { password: '123456789' }, 'password'],
    ['mật khẩu quá dài (bcrypt chỉ dùng 72 byte)', { password: 'a1' + 'x'.repeat(80) }, 'password'],
  ])('từ chối: %s', (_ten, thayDoi, truong) => {
    const r = validateSignup({ ...hopLe, ...thayDoi });
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors!)).toContain(truong);
  });

  it('không phải chuỗi (số/mảng/null) → coi như rỗng, không ném lỗi', () => {
    const r = validateSignup({ companyName: 1, slug: null, adminName: [], email: {}, phone: undefined, password: 5 });
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors!).sort()).toEqual(['adminName', 'companyName', 'email', 'password', 'phone', 'slug']);
  });

  it('số điện thoại: chấp nhận 0xxxxxxxxx, 84xxxxxxxxx và +84xxxxxxxxx', () => {
    for (const p of ['0912345678', '84912345678', '+84912345678', '+84 912 345 678']) {
      expect(validateSignup({ ...hopLe, phone: p }).ok, p).toBe(true);
    }
  });
});

describe('slugProblem', () => {
  it('phân loại đúng', () => {
    expect(slugProblem('hoanglong')).toBeNull();
    expect(slugProblem('ab')).toBeNull();
    expect(slugProblem('a-b-c')).toBeNull();
    expect(slugProblem('A')).toBe('invalid');
    expect(slugProblem('admin')).toBe('reserved');
    expect(slugProblem('support')).toBe('reserved');
  });
});

describe('hashIp / getClientIp', () => {
  it('băm ổn định, khác muối/khác IP ra khác kết quả, không chứa IP thật', () => {
    const a = hashIp('1.2.3.4', 'muoi');
    expect(a).toBe(hashIp('1.2.3.4', 'muoi'));
    expect(a).not.toBe(hashIp('1.2.3.5', 'muoi'));
    expect(a).not.toBe(hashIp('1.2.3.4', 'muoi2'));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain('1.2.3.4');
  });
  it('lấy IP đầu trong x-forwarded-for', () => {
    expect(getClientIp({ headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1' } } as any)).toBe('9.9.9.9');
    expect(getClientIp({ headers: {} } as any)).toBe('unknown');
  });
});
