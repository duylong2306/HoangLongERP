import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Kiểm tra 2 endpoint dùng tên miền để xác định doanh nghiệp (Giai đoạn 1 subdomain):
//  - api/login.ts: công ty theo TÊN MIỀN, bỏ qua mã công ty client gửi (không thể vào địa chỉ A mà đăng nhập B);
//  - api/tenant-info.ts: trả đúng tồn tại/không tồn tại, không lộ id công ty.
const state: { slugTra: string[]; congTy: any } = { slugTra: [], congTy: null };
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (_bang: string) => ({
      select: () => ({
        eq: (cot: string, val: string) => {
          if (cot === 'slug') state.slugTra.push(val);
          return {
            maybeSingle: async () => ({ data: state.congTy, error: null }),
            // login.ts tra nhân viên: .eq('company_id').ilike('username')
            ilike: async () => ({ data: [], error: null }),
          };
        },
      }),
    }),
  }),
}));

import login from '../../../api/login';
import tenantInfo from '../../../api/tenant-info';

const res = () => {
  const r: any = { code: 0, body: null, headers: {} };
  r.status = (c: number) => { r.code = c; return r; };
  r.json = (b: any) => { r.body = b; return r; };
  r.setHeader = (k: string, v: string) => { r.headers[k] = v; return r; };
  return r;
};
const goc = { ...process.env };
beforeEach(() => {
  state.slugTra = []; state.congTy = null;
  process.env.VITE_BASE_DOMAIN = 'lolo.vn';
  process.env.VITE_SUPABASE_URL = 'https://x.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'srv';
  process.env.SUPABASE_JWT_SECRET = 'sec';
});
afterEach(() => { process.env = { ...goc }; });

describe('api/login — công ty theo tên miền', () => {
  const body = { username: 'admin', password: 'x', subdomain: 'congty-khac' };

  it('subdomain thật: dùng công ty của TÊN MIỀN, bỏ qua `subdomain` client gửi', async () => {
    const r = res();
    await login({ method: 'POST', body, headers: { host: 'hoanglong.lolo.vn' } } as any, r);
    expect(state.slugTra).toEqual(['hoanglong']);   // không phải 'congty-khac'
    expect(r.code).toBe(404);                       // công ty giả lập không tồn tại → 404, quan trọng là slug tra cứu
  });

  it('địa chỉ gốc: từ chối, không tra DB', async () => {
    const r = res();
    await login({ method: 'POST', body, headers: { host: 'lolo.vn' } } as any, r);
    expect(r.code).toBe(400);
    expect(state.slugTra).toEqual([]);
  });

  it('địa chỉ khác (vercel.app): giữ cách cũ, dùng mã công ty client gửi', async () => {
    const r = res();
    await login({ method: 'POST', body, headers: { host: 'hoanglong-erp-staging.vercel.app' } } as any, r);
    expect(state.slugTra).toEqual(['congty-khac']);
  });

  it('địa chỉ khác, không gửi mã: mặc định hoanglong', async () => {
    const r = res();
    await login({ method: 'POST', body: { username: 'a', password: 'b' }, headers: { host: 'localhost:5173' } } as any, r);
    expect(state.slugTra).toEqual(['hoanglong']);
  });

  it('qua proxy Vercel: ưu tiên x-forwarded-host', async () => {
    const r = res();
    await login({ method: 'POST', body, headers: { 'x-forwarded-host': 'abc.lolo.vn', host: 'x.vercel.app' } } as any, r);
    expect(state.slugTra).toEqual(['abc']);
  });
});

describe('api/tenant-info', () => {
  const req = (host: string, query: any = {}) => ({ method: 'GET', query, headers: { host } } as any);

  it('subdomain có doanh nghiệp → exists + tên, KHÔNG lộ id', async () => {
    state.congTy = { name: 'Hoàng Long', slug: 'hoanglong', active: true, id: 'bi-mat' };
    const r = res();
    await tenantInfo(req('hoanglong.lolo.vn'), r);
    expect(r.body).toEqual({ kind: 'tenant', slug: 'hoanglong', exists: true, name: 'Hoàng Long' });
    expect(JSON.stringify(r.body)).not.toContain('bi-mat');
    expect(r.headers['Cache-Control']).toBe('no-store');
  });

  it('subdomain không có / đã ngừng hoạt động → exists:false', async () => {
    const r1 = res(); await tenantInfo(req('khongco.lolo.vn'), r1);
    expect(r1.body).toMatchObject({ kind: 'tenant', exists: false });
    state.congTy = { name: 'Cũ', slug: 'cu', active: false };
    const r2 = res(); await tenantInfo(req('cu.lolo.vn'), r2);
    expect(r2.body).toMatchObject({ exists: false });
  });

  it('địa chỉ gốc → kind root, không tra DB', async () => {
    const r = res(); await tenantInfo(req('lolo.vn'), r);
    expect(r.body).toEqual({ kind: 'root' });
    expect(state.slugTra).toEqual([]);
  });

  it('địa chỉ khác: dùng ?slug=, mã sai dạng không tra DB', async () => {
    state.congTy = { name: 'Test', slug: 'congtytestg', active: true };
    const r = res(); await tenantInfo(req('stg.vercel.app', { slug: 'congtytestg' }), r);
    expect(r.body).toMatchObject({ kind: 'other', exists: true, name: 'Test' });
    state.slugTra = [];
    const r2 = res(); await tenantInfo(req('stg.vercel.app', { slug: "a' or 1=1" }), r2);
    expect(r2.body).toMatchObject({ exists: false });
    expect(state.slugTra).toEqual([]);
  });

  it('chỉ nhận GET', async () => {
    const r = res(); await tenantInfo({ method: 'POST', query: {}, headers: {} } as any, r);
    expect(r.code).toBe(405);
  });
});
