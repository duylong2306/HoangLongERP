import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Kiểm tra 2 API đăng ký công khai (Giai đoạn 2): chống lạm dụng + tạo đúng công ty/tài khoản quản trị.
const db: {
  count: { hour: number; day: number };
  taken: Set<string>;
  attemptsError: any;
  log: string[];
  companyRows: any[];
  employeeRows: any[];
  attemptRows: any[];
} = { count: { hour: 0, day: 0 }, taken: new Set(), attemptsError: null, log: [], companyRows: [], employeeRows: [], attemptRows: [] };

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => ({
      // signup_attempts: select(...count).eq().gte()  |  companies: select('id').eq('slug').maybeSingle()
      select: () => {
        const b: any = {
          eq: (_c: string, val: string) => { b._eq = val; return b; },
          gte: async (_c: string, since: string) => {
            if (db.attemptsError) return { count: null, error: db.attemptsError };
            const quaKhu = Date.now() - new Date(since).getTime();
            return { count: quaKhu > 2 * 3600 * 1000 ? db.count.day : db.count.hour, error: null };
          },
          maybeSingle: async () => ({ data: db.taken.has(b._eq) ? { id: 'x' } : null, error: null }),
        };
        return b;
      },
      insert: async (row: any) => {
        db.log.push(`insert:${table}`);
        if (table === 'signup_attempts') { if (db.attemptsError) return { error: db.attemptsError }; db.attemptRows.push(row); }
        if (table === 'companies') db.companyRows.push(row);
        if (table === 'employees') db.employeeRows.push(row);
        return { error: null };
      },
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  }),
}));

import register from '../../../api/register-company';
import checkSlug from '../../../api/check-slug';

const res = () => {
  const r: any = { code: 0, body: null, headers: {} };
  r.status = (c: number) => { r.code = c; return r; };
  r.json = (b: any) => { r.body = b; return r; };
  r.setHeader = (k: string, v: string) => { r.headers[k] = v; return r; };
  return r;
};
const hopLe = { companyName: 'Công ty ABC', slug: 'congty-abc', adminName: 'Nguyễn Văn A', email: 'a@abc.vn', phone: '0912345678', password: 'matkhau123' };
const post = (body: any, host = 'www.lolo.io.vn') => ({ method: 'POST', body, headers: { host, 'x-forwarded-for': '7.7.7.7' } } as any);
const goc = { ...process.env };
const fetchGoc = globalThis.fetch;

beforeEach(() => {
  db.count = { hour: 0, day: 0 }; db.taken = new Set(); db.attemptsError = null;
  db.log = []; db.companyRows = []; db.employeeRows = []; db.attemptRows = [];
  process.env.VITE_BASE_DOMAIN = 'lolo.io.vn';
  process.env.VITE_SUPABASE_URL = 'https://x.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'srv';
  process.env.SUPABASE_JWT_SECRET = 'sec';
  delete process.env.TURNSTILE_SECRET_KEY;
});
afterEach(() => { process.env = { ...goc }; globalThis.fetch = fetchGoc; });

describe('api/register-company', () => {
  it('thành công: tạo công ty + admin (id emp_admin, mật khẩu băm, kèm email/sđt), ghi nhận lượt TRƯỚC khi tạo', async () => {
    const r = res();
    await register(post(hopLe), r);
    expect(r.code).toBe(201);
    expect(r.body).toEqual({ company: { slug: 'congty-abc', name: 'Công ty ABC' }, adminUsername: 'admin' });
    expect(db.companyRows[0]).toMatchObject({ slug: 'congty-abc', name: 'Công ty ABC', active: true });
    const emp = db.employeeRows[0];
    expect(emp).toMatchObject({ id: 'emp_admin', username: 'admin', name: 'Nguyễn Văn A', email: 'a@abc.vn', phone: '0912345678', role_group_ids: ['role_admin'], company_id: db.companyRows[0].id });
    expect(emp.password).toMatch(/^\$2/);            // bcrypt, không lưu mật khẩu thô
    expect(emp.password).not.toContain('matkhau123');
    expect(db.log).toEqual(['insert:signup_attempts', 'insert:companies', 'insert:employees']);
    expect(db.attemptRows[0].ip_hash).toMatch(/^[0-9a-f]{64}$/);   // chỉ lưu băm IP
    expect(JSON.stringify(r.body)).not.toContain('matkhau123');
  });

  it('honeypot có nội dung → từ chối, không đụng DB', async () => {
    const r = res();
    await register(post({ ...hopLe, website: 'http://spam.com' }), r);
    expect(r.code).toBe(400);
    expect(db.log).toEqual([]);
  });

  it('dữ liệu sai / tên cấm → 400 kèm lỗi từng trường, không đụng DB', async () => {
    const r = res();
    await register(post({ ...hopLe, slug: 'www', password: '123' }), r);
    expect(r.code).toBe(400);
    expect(Object.keys(r.body.errors).sort()).toEqual(['password', 'slug']);
    expect(db.log).toEqual([]);
  });

  it('gọi từ subdomain doanh nghiệp → 403', async () => {
    const r = res();
    await register(post(hopLe, 'hoanglong.lolo.io.vn'), r);
    expect(r.code).toBe(403);
    expect(db.log).toEqual([]);
  });

  it('vượt giới hạn theo giờ hoặc theo ngày → 429, không tạo gì', async () => {
    db.count.hour = 3;
    const r1 = res(); await register(post(hopLe), r1);
    expect(r1.code).toBe(429);
    db.count = { hour: 0, day: 10 };
    const r2 = res(); await register(post(hopLe), r2);
    expect(r2.code).toBe(429);
    expect(db.log).toEqual([]);
  });

  it('chưa tạo bảng signup_attempts → từ chối (KHÔNG bỏ qua giới hạn), không tạo công ty', async () => {
    db.attemptsError = { message: 'relation "signup_attempts" does not exist' };
    const r = res();
    await register(post(hopLe), r);
    expect(r.code).toBe(500);
    expect(db.companyRows).toEqual([]);
  });

  it('địa chỉ đã có người dùng → 409', async () => {
    db.taken.add('congty-abc');
    const r = res();
    await register(post(hopLe), r);
    expect(r.code).toBe(409);
    expect(r.body.errors.slug).toMatch(/đã có doanh nghiệp/);
    expect(db.companyRows).toEqual([]);
  });

  describe('CAPTCHA Turnstile (khi đã đặt TURNSTILE_SECRET_KEY)', () => {
    beforeEach(() => { process.env.TURNSTILE_SECRET_KEY = 'secret'; });

    it('thiếu token → 400, không gọi DB', async () => {
      const r = res(); await register(post(hopLe), r);
      expect(r.code).toBe(400);
      expect(db.log).toEqual([]);
    });
    it('Cloudflare báo không hợp lệ → 400', async () => {
      globalThis.fetch = vi.fn(async () => ({ json: async () => ({ success: false }) })) as any;
      const r = res(); await register(post({ ...hopLe, captchaToken: 'tok' }), r);
      expect(r.code).toBe(400);
      expect(db.log).toEqual([]);
    });
    it('không gọi được Cloudflare → từ chối (không bỏ qua CAPTCHA)', async () => {
      globalThis.fetch = vi.fn(async () => { throw new Error('mạng'); }) as any;
      const r = res(); await register(post({ ...hopLe, captchaToken: 'tok' }), r);
      expect(r.code).toBe(400);
    });
    it('hợp lệ → 201, và gửi đúng secret/token/IP lên Cloudflare', async () => {
      const f = vi.fn(async () => ({ json: async () => ({ success: true }) }));
      globalThis.fetch = f as any;
      const r = res(); await register(post({ ...hopLe, captchaToken: 'tok' }), r);
      expect(r.code).toBe(201);
      const [url, init] = f.mock.calls[0] as any;
      expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
      expect(init.body).toContain('secret=secret');
      expect(init.body).toContain('response=tok');
      expect(init.body).toContain('remoteip=7.7.7.7');
    });
  });

  it('chỉ nhận POST', async () => {
    const r = res(); await register({ method: 'GET', headers: {} } as any, r);
    expect(r.code).toBe(405);
  });
});

describe('api/check-slug', () => {
  const get = (slug: string, host = 'www.lolo.io.vn') => ({ method: 'GET', query: { slug }, headers: { host } } as any);

  it('còn trống / đã có / cấm / sai định dạng', async () => {
    db.taken.add('da-co');
    const a = res(); await checkSlug(get('con-trong'), a);
    expect(a.body).toEqual({ available: true });
    const b = res(); await checkSlug(get('da-co'), b);
    expect(b.body).toMatchObject({ available: false, reason: 'taken' });
    const c = res(); await checkSlug(get('admin'), c);
    expect(c.body).toMatchObject({ available: false, reason: 'reserved' });
    const d = res(); await checkSlug(get('Sai Dinh Dang!'), d);
    expect(d.body).toMatchObject({ available: false, reason: 'invalid' });
  });

  it('subdomain doanh nghiệp → 403; không phải GET → 405; không lộ thông tin công ty đã có', async () => {
    const a = res(); await checkSlug(get('abc', 'hoanglong.lolo.io.vn'), a);
    expect(a.code).toBe(403);
    const b = res(); await checkSlug({ method: 'POST', query: {}, headers: {} } as any, b);
    expect(b.code).toBe(405);
    db.taken.add('da-co');
    const c = res(); await checkSlug(get('da-co'), c);
    expect(Object.keys(c.body).sort()).toEqual(['available', 'message', 'reason']);
  });
});
