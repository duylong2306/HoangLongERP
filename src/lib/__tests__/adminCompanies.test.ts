import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// api/admin-companies.ts (màn quản trị doanh nghiệp, chỉ chủ nền tảng): mã công ty giờ là SUBDOMAIN nên phải
// chặn tên dành cho hệ thống (www, api, admin...) và sai chuẩn nhãn DNS — Giai đoạn 4.
const PLATFORM = '00000000-0000-0000-0000-000000000001';
const state = { payload: { company_id: PLATFORM, sub: 'emp_admin' } as any, roleGroups: ['role_admin'], inserted: [] as string[], taken: new Set<string>() };

vi.mock('jsonwebtoken', () => ({
  default: { verify: () => state.payload },
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => ({
      select: () => {
        const b: any = {
          eq: (_c: string, v: string) => { b._v = v; return b; },
          maybeSingle: async () => table === 'employees'
            ? { data: { id: 'emp_admin', role_group_ids: state.roleGroups }, error: null }
            : { data: state.taken.has(b._v) ? { id: 'x' } : null, error: null },
          order: async () => ({ data: [{ id: '1', slug: 'hoanglong', name: 'Hoàng Long', active: true, created_at: '2026-01-01' }], error: null }),
        };
        return b;
      },
      insert: async () => { state.inserted.push(table); return { error: null }; },
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  }),
}));

import handler from '../../../api/admin-companies';

const res = () => {
  const r: any = { code: 0, body: null };
  r.status = (c: number) => { r.code = c; return r; };
  r.json = (b: any) => { r.body = b; return r; };
  r.setHeader = () => r;
  return r;
};
const post = (body: any) => ({ method: 'POST', body, headers: { authorization: 'Bearer t' } } as any);
const hopLe = { slug: 'congty-moi', name: 'Công ty mới', adminUsername: 'admin', adminPassword: 'abcd1234' };
const goc = { ...process.env };

beforeEach(() => {
  state.payload = { company_id: PLATFORM, sub: 'emp_admin' }; state.roleGroups = ['role_admin']; state.inserted = []; state.taken = new Set();
  process.env.VITE_SUPABASE_URL = 'https://x.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'srv';
  process.env.SUPABASE_JWT_SECRET = 'sec';
});
afterEach(() => { process.env = { ...goc }; });

describe('api/admin-companies — tạo công ty', () => {
  it('mã hợp lệ → 201 và tạo công ty + admin', async () => {
    const r = res(); await handler(post(hopLe), r);
    expect(r.code).toBe(201);
    expect(r.body.company.slug).toBe('congty-moi');
    expect(state.inserted).toEqual(['companies', 'employees']);
  });

  it.each([['www'], ['api'], ['admin'], ['support']])('chặn tên dành cho hệ thống: %s', async (slug) => {
    const r = res(); await handler(post({ ...hopLe, slug }), r);
    expect(r.code).toBe(400);
    expect(r.body.error).toMatch(/dành cho hệ thống/);
    expect(state.inserted).toEqual([]);
  });

  it.each([['-abc'], ['abc-'], ['a'], ['Có dấu'], ['a'.repeat(41)]])('chặn mã sai chuẩn subdomain: %s', async (slug) => {
    const r = res(); await handler(post({ ...hopLe, slug }), r);
    expect(r.code).toBe(400);
    expect(state.inserted).toEqual([]);
  });

  it('mã đã tồn tại → 409', async () => {
    state.taken.add('congty-moi');
    const r = res(); await handler(post(hopLe), r);
    expect(r.code).toBe(409);
  });

  it('chỉ admin của công ty chủ nền tảng mới được tạo', async () => {
    state.payload = { company_id: 'cong-ty-khac', sub: 'emp_admin' };
    const r = res(); await handler(post(hopLe), r);
    expect(r.code).toBe(403);
    expect(state.inserted).toEqual([]);
    state.payload = { company_id: PLATFORM, sub: 'emp_admin' }; state.roleGroups = ['role_office'];
    const r2 = res(); await handler(post(hopLe), r2);
    expect(r2.code).toBe(403);
  });

  it('GET trả danh sách công ty', async () => {
    const r = res(); await handler({ method: 'GET', headers: { authorization: 'Bearer t' } } as any, r);
    expect(r.code).toBe(200);
    expect(r.body.companies[0].slug).toBe('hoanglong');
  });
});
