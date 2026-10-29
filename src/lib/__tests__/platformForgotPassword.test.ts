import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { FakeDb } from './helpers/fakeSupabase';

// Quên mật khẩu trang quản trị (api/platform.ts: password.forgot / password.reset / email.set).
// Thư gửi qua Resend được chặn bằng fetch giả → đọc liên kết trong thư để làm bước đặt lại.
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
const call = async (body: any, opts: { token?: string; ip?: string } = {}) => {
  const r = res();
  await handler({
    method: 'POST', body,
    headers: { host: 'www.lolo.io.vn', 'x-forwarded-for': opts.ip || '7.7.7.7', ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
  } as any, r);
  return r;
};
const goc = { ...process.env };
const gocFetch = globalThis.fetch;
let mails: any[] = [];
let mailOk = true;
let hash: string;

// Lấy mã đặt lại từ liên kết trong thư gần nhất
const lastToken = () => String(mails[mails.length - 1]?.text || '').match(/reset=([a-f0-9]{64})/)?.[1] || '';

beforeEach(async () => {
  db.tables = {}; db.fail = {}; db.log = []; db.rpcs = {};
  db.unique = { platform_admins: ['username'] };
  db.autoId = new Set(['platform_login_attempts', 'platform_audit_logs', 'platform_password_resets']);
  hash ||= await bcrypt.hash('MatKhauTot123', 4);
  db.seed('platform_admins', [
    { id: 'ad-1', username: 'chu', password_hash: hash, name: 'Chủ', active: true, is_owner: true, email: 'chu@lolo.vn', token_version: 0 },
    { id: 'ad-2', username: 'khongmail', password_hash: hash, name: 'Không email', active: true, is_owner: false, email: null, token_version: 0 },
    { id: 'ad-3', username: 'biKhoa', password_hash: hash, name: 'Bị khóa', active: false, is_owner: false, email: 'khoa@lolo.vn', token_version: 0 },
  ]);
  process.env.VITE_BASE_DOMAIN = 'lolo.io.vn';
  process.env.VITE_SUPABASE_URL = 'https://x.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'srv';
  process.env.SUPABASE_JWT_SECRET = SECRET;
  process.env.RESEND_API_KEY = 're_test';
  process.env.MAIL_FROM = 'LoLo <no-reply@lolo.io.vn>';
  process.env.PLATFORM_PUBLIC_URL = 'https://lolo.io.vn';
  mails = []; mailOk = true;
  globalThis.fetch = vi.fn(async (url: any, init: any) => {
    expect(String(url)).toBe('https://api.resend.com/emails');
    mails.push(JSON.parse(init.body));
    return { ok: mailOk, status: mailOk ? 200 : 500, json: async () => ({}) } as any;
  }) as any;
});
afterEach(() => { process.env = { ...goc }; globalThis.fetch = gocFetch; vi.useRealTimers(); });

describe('password.forgot', () => {
  it('đúng tên đăng nhập → gửi thư có liên kết về đúng email; DB chỉ lưu BĂM của mã', async () => {
    const r = await call({ action: 'password.forgot', identifier: 'chu' });
    expect(r.code).toBe(200);
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toEqual(['chu@lolo.vn']);
    expect(mails[0].text).toContain('https://lolo.io.vn/quantri?reset=');
    const tok = lastToken();
    expect(tok).toHaveLength(64);
    const rows = db.tables['platform_password_resets'];
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain(tok);   // không lưu mã gốc
  });

  it('nhập bằng email (hoa/thường lẫn lộn) cũng được', async () => {
    await call({ action: 'password.forgot', identifier: ' CHU@lolo.vn ' });
    expect(mails).toHaveLength(1);
  });

  it('KHÔNG lộ tài khoản nào có thật: không tồn tại / không email / bị khóa đều trả cùng câu trả lời và không gửi thư', async () => {
    const a = await call({ action: 'password.forgot', identifier: 'chu' }, { ip: '1.1.1.1' });
    const bs = [
      await call({ action: 'password.forgot', identifier: 'khong-co' }, { ip: '2.2.2.2' }),
      await call({ action: 'password.forgot', identifier: 'khongmail' }, { ip: '3.3.3.3' }),
      await call({ action: 'password.forgot', identifier: 'biKhoa' }, { ip: '4.4.4.4' }),
    ];
    for (const b of bs) { expect(b.code).toBe(a.code); expect(b.body).toEqual(a.body); }
    expect(mails).toHaveLength(1);   // chỉ thư của "chu"
  });

  it('chưa cấu hình gửi thư → 503 báo rõ', async () => {
    delete process.env.RESEND_API_KEY;
    const r = await call({ action: 'password.forgot', identifier: 'chu' });
    expect(r.code).toBe(503);
    expect(mails).toHaveLength(0);
  });

  it('gửi thư thất bại → vẫn trả câu chung, nhưng không giữ mã vô dụng trong DB', async () => {
    mailOk = false;
    const r = await call({ action: 'password.forgot', identifier: 'chu' });
    expect(r.code).toBe(200);
    expect(db.tables['platform_password_resets'] || []).toHaveLength(0);
  });

  it('giới hạn 5 yêu cầu / 15 phút theo IP (kể cả tên không tồn tại) → lần 6 bị 429', async () => {
    for (let i = 0; i < 5; i++) expect((await call({ action: 'password.forgot', identifier: `x${i}` })).code).toBe(200);
    expect((await call({ action: 'password.forgot', identifier: 'chu' })).code).toBe(429);
    expect(mails).toHaveLength(0);
  });

  it('mỗi tài khoản tối đa 3 thư / giờ (từ nhiều IP khác nhau) — thư thứ 4 không gửi', async () => {
    for (let i = 0; i < 4; i++) await call({ action: 'password.forgot', identifier: 'chu' }, { ip: `9.9.9.${i}` });
    expect(mails).toHaveLength(3);
  });

  it('yêu cầu mới vô hiệu liên kết cũ', async () => {
    await call({ action: 'password.forgot', identifier: 'chu' }, { ip: '1.1.1.1' });
    const cu = lastToken();
    await call({ action: 'password.forgot', identifier: 'chu' }, { ip: '1.1.1.2' });
    expect((await call({ action: 'password.reset', token: cu, newPassword: 'MatKhauMoi12345' })).code).toBe(400);
    expect((await call({ action: 'password.reset', token: lastToken(), newPassword: 'MatKhauMoi12345' })).code).toBe(200);
  });
});

describe('password.reset', () => {
  it('đặt lại thành công: đăng nhập được bằng mật khẩu mới, mật khẩu cũ hết tác dụng, phiên cũ bị thu hồi, liên kết dùng 1 lần', async () => {
    const cuToken = signPlatformToken({ id: 'ad-1', username: 'chu', ver: 0 }, SECRET);
    await call({ action: 'password.forgot', identifier: 'chu' });
    const tok = lastToken();

    const r = await call({ action: 'password.reset', token: tok, newPassword: 'MatKhauMoi12345' });
    expect(r.code).toBe(200);
    expect((await call({ action: 'login', username: 'chu', password: 'MatKhauMoi12345' }, { ip: '8.8.8.8' })).code).toBe(200);
    expect((await call({ action: 'login', username: 'chu', password: 'MatKhauTot123' }, { ip: '8.8.8.9' })).code).toBe(401);
    expect((await call({ action: 'me' }, { token: cuToken })).code).toBe(401);   // token_version đã tăng
    expect((await call({ action: 'password.reset', token: tok, newPassword: 'MatKhauKhac12345' })).code).toBe(400);   // dùng lần 2
  });

  it('mã hết hạn / mã bịa / mật khẩu yếu bị từ chối', async () => {
    await call({ action: 'password.forgot', identifier: 'chu' });
    const tok = lastToken();
    expect((await call({ action: 'password.reset', token: tok, newPassword: 'ngan1' })).code).toBe(400);    // yếu → chưa tiêu mã
    expect((await call({ action: 'password.reset', token: 'a'.repeat(64), newPassword: 'MatKhauMoi12345' })).code).toBe(400);
    expect((await call({ action: 'password.reset', token: 'abc', newPassword: 'MatKhauMoi12345' })).code).toBe(400);
    db.tables['platform_password_resets'][0].expires_at = new Date(Date.now() - 1000).toISOString();
    expect((await call({ action: 'password.reset', token: tok, newPassword: 'MatKhauMoi12345' })).code).toBe(400);
  });

  it('tài khoản bị khóa sau khi xin liên kết → không đặt lại được', async () => {
    await call({ action: 'password.forgot', identifier: 'chu' });
    db.tables['platform_admins'][0].active = false;
    expect((await call({ action: 'password.reset', token: lastToken(), newPassword: 'MatKhauMoi12345' })).code).toBe(400);
  });

  it('không vượt được 2FA: tài khoản bật 2FA đặt lại xong vẫn phải qua bước mã 6 số', async () => {
    db.tables['platform_admins'][0].totp_enabled = true;
    await call({ action: 'password.forgot', identifier: 'chu' });
    await call({ action: 'password.reset', token: lastToken(), newPassword: 'MatKhauMoi12345' });
    const r = await call({ action: 'login', username: 'chu', password: 'MatKhauMoi12345' }, { ip: '8.8.8.8' });
    expect(r.body.needTotp).toBe(true);
    expect(r.body.token).toBeUndefined();
  });

  it('ghi nhật ký nhưng KHÔNG lưu mã hay mật khẩu', async () => {
    await call({ action: 'password.forgot', identifier: 'chu' });
    const tok = lastToken();
    await call({ action: 'password.reset', token: tok, newPassword: 'MatKhauMoi12345' });
    const logs = JSON.stringify(db.tables['platform_audit_logs']);
    expect(logs).toContain('password.reset');
    expect(logs).not.toContain(tok);
    expect(logs).not.toContain('MatKhauMoi12345');
  });
});

describe('email.set', () => {
  const tok = () => signPlatformToken({ id: 'ad-2', username: 'khongmail', ver: 0 }, SECRET);

  it('cần đúng mật khẩu hiện tại; đặt xong thì dùng được "quên mật khẩu"', async () => {
    expect((await call({ action: 'email.set', email: 'a@b.vn', currentPassword: 'sai' }, { token: tok() })).code).toBe(400);
    const r = await call({ action: 'email.set', email: ' A@B.vn ', currentPassword: 'MatKhauTot123' }, { token: tok() });
    expect(r.code).toBe(200);
    expect(r.body.email).toBe('a@b.vn');
    await call({ action: 'password.forgot', identifier: 'a@b.vn' });
    expect(mails[0].to).toEqual(['a@b.vn']);
  });

  it('email sai định dạng bị từ chối; để trống = xóa', async () => {
    expect((await call({ action: 'email.set', email: 'khong-phai-email', currentPassword: 'MatKhauTot123' }, { token: tok() })).code).toBe(400);
    const r = await call({ action: 'email.set', email: '', currentPassword: 'MatKhauTot123' }, { token: tok() });
    expect(r.body.email).toBeNull();
  });
});
