import { describe, it, expect, afterEach } from 'vitest';
import * as client from '../tenant';
import * as server from '../../../api/_tenant';

// Quy tắc nhận diện doanh nghiệp theo tên miền (Giai đoạn 1 subdomain). Chạy cùng 1 bộ ca cho CẢ bản
// trình duyệt (src/lib/tenant.ts) và bản máy chủ (api/_tenant.ts) để 2 bản không bao giờ lệch nhau.
const bo = [['trình duyệt', client], ['máy chủ', server]] as const;

describe.each(bo)('resolveHost — %s', (_ten, m) => {
  const base = m.parseBaseDomains('lolo.vn');

  it('subdomain 1 nhãn dưới tên miền gốc → doanh nghiệp', () => {
    expect(m.resolveHost('hoanglong.lolo.vn', base)).toEqual({ kind: 'tenant', slug: 'hoanglong' });
    expect(m.resolveHost('HoangLong.LOLO.vn', base)).toEqual({ kind: 'tenant', slug: 'hoanglong' });   // không phân biệt hoa/thường
    expect(m.resolveHost('hoanglong.lolo.vn:5173', base)).toEqual({ kind: 'tenant', slug: 'hoanglong' }); // bỏ cổng
    expect(m.resolveHost('hoanglong.lolo.vn.', base)).toEqual({ kind: 'tenant', slug: 'hoanglong' });  // dấu chấm cuối
  });

  it('địa chỉ gốc và subdomain hệ thống (www, api...) → root, không phải doanh nghiệp', () => {
    expect(m.resolveHost('lolo.vn', base)).toEqual({ kind: 'root' });
    expect(m.resolveHost('www.lolo.vn', base)).toEqual({ kind: 'root' });
    expect(m.resolveHost('api.lolo.vn', base)).toEqual({ kind: 'root' });
  });

  it('nhiều nhãn (a.b.lolo.vn), tên sai chuẩn, hoặc ngoài tên miền gốc → other (không đoán công ty)', () => {
    expect(m.resolveHost('a.b.lolo.vn', base)).toEqual({ kind: 'other' });
    expect(m.resolveHost('-xau.lolo.vn', base)).toEqual({ kind: 'other' });
    expect(m.resolveHost('a.lolo.vn', base)).toEqual({ kind: 'other' });          // 1 ký tự: dưới tối thiểu 2
    expect(m.resolveHost('hoanglong.evil.com', base)).toEqual({ kind: 'other' });
    expect(m.resolveHost('hoanglong.lolo.vn.evil.com', base)).toEqual({ kind: 'other' }); // giả mạo bằng đuôi
    expect(m.resolveHost('xlolo.vn', base)).toEqual({ kind: 'other' });           // trùng đuôi chữ nhưng không phải subdomain
  });

  it('chưa cấu hình tên miền gốc → mọi địa chỉ là other (hành vi cũ, không ảnh hưởng môi trường đang chạy)', () => {
    expect(m.resolveHost('hoanglong.lolo.vn', [])).toEqual({ kind: 'other' });
    expect(m.resolveHost('localhost', [])).toEqual({ kind: 'other' });
    expect(m.parseBaseDomains(undefined)).toEqual([]);
    expect(m.parseBaseDomains('')).toEqual([]);
  });

  it('nhiều tên miền gốc: staging nằm trong production không bị nhầm thành doanh nghiệp "stg"', () => {
    const b = m.parseBaseDomains(' lolo.vn , stg.lolo.vn ,, ');
    expect(b).toEqual(['lolo.vn', 'stg.lolo.vn']);
    expect(m.resolveHost('stg.lolo.vn', b)).toEqual({ kind: 'root' });                       // gốc của staging
    expect(m.resolveHost('hoanglong.stg.lolo.vn', b)).toEqual({ kind: 'tenant', slug: 'hoanglong' });
    expect(m.resolveHost('hoanglong.lolo.vn', b)).toEqual({ kind: 'tenant', slug: 'hoanglong' });
  });

  it('dev: *.localhost', () => {
    expect(m.resolveHost('hoanglong.localhost:5173', m.parseBaseDomains('localhost'))).toEqual({ kind: 'tenant', slug: 'hoanglong' });
  });
});

describe('hai bản dùng chung danh sách tên cấm và quy tắc mã', () => {
  it('RESERVED_SUBDOMAINS và SLUG_PATTERN giống nhau', () => {
    expect([...server.RESERVED_SUBDOMAINS]).toEqual([...client.RESERVED_SUBDOMAINS]);
    expect(server.SLUG_PATTERN.source).toBe(client.SLUG_PATTERN.source);
  });
});

describe('getRequestHostname (máy chủ)', () => {
  const req = (headers: Record<string, any>) => ({ headers } as any);
  it('ưu tiên x-forwarded-host, lấy giá trị đầu, bỏ cổng', () => {
    expect(server.getRequestHostname(req({ 'x-forwarded-host': 'hoanglong.lolo.vn, proxy.vercel.app', host: 'x.vercel.app' }))).toBe('hoanglong.lolo.vn');
    expect(server.getRequestHostname(req({ host: 'hoanglong.lolo.vn:443' }))).toBe('hoanglong.lolo.vn');
    expect(server.getRequestHostname(req({}))).toBe('');
  });
});

describe('getServerBaseDomains', () => {
  const goc = process.env.VITE_BASE_DOMAIN;
  afterEach(() => { if (goc === undefined) delete process.env.VITE_BASE_DOMAIN; else process.env.VITE_BASE_DOMAIN = goc; });
  it('đọc VITE_BASE_DOMAIN', () => {
    process.env.VITE_BASE_DOMAIN = 'lolo.vn,stg.lolo.vn';
    expect(server.getServerBaseDomains()).toEqual(['lolo.vn', 'stg.lolo.vn']);
    delete process.env.VITE_BASE_DOMAIN;
    expect(server.getServerBaseDomains()).toEqual([]);
  });
});

describe('matchBaseDomain — để hiện hướng dẫn đúng tên miền gốc', () => {
  const b = client.parseBaseDomains('lolo.vn,stg.lolo.vn');
  it('www.lolo.vn → lolo.vn (không phải www.lolo.vn); staging khớp bản dài nhất', () => {
    expect(client.matchBaseDomain('www.lolo.vn', b)).toBe('lolo.vn');
    expect(client.matchBaseDomain('lolo.vn', b)).toBe('lolo.vn');
    expect(client.matchBaseDomain('hoanglong.stg.lolo.vn', b)).toBe('stg.lolo.vn');
    expect(client.matchBaseDomain('example.com', b)).toBeNull();
  });
});

describe('buildTenantUrl — địa chỉ riêng của doanh nghiệp', () => {
  const b = client.parseBaseDomains('lolo.io.vn');
  it('đang ở tên miền gốc/subdomain: giữ giao thức + cổng hiện tại', () => {
    expect(client.buildTenantUrl('abc', b, 'www.lolo.io.vn', 'https:', '')).toBe('https://abc.lolo.io.vn');
    expect(client.buildTenantUrl('abc', b, 'hoanglong.lolo.io.vn', 'https:', '')).toBe('https://abc.lolo.io.vn');
    expect(client.buildTenantUrl('abc', client.parseBaseDomains('localhost'), 'www.localhost', 'http:', '5174')).toBe('http://abc.localhost:5174');
  });
  it('đang ở địa chỉ khác (vercel.app): dùng tên miền gốc đầu tiên, https, không cổng', () => {
    expect(client.buildTenantUrl('abc', b, 'hoanglong-erp-staging.vercel.app', 'https:', '')).toBe('https://abc.lolo.io.vn');
    expect(client.buildTenantUrl('abc', client.parseBaseDomains('lolo.io.vn,stg.lolo.io.vn'), 'x.vercel.app', 'https:', '')).toBe('https://abc.lolo.io.vn');
  });
  it('nhiều tên miền gốc: khớp bản dài nhất', () => {
    expect(client.buildTenantUrl('abc', client.parseBaseDomains('lolo.io.vn,stg.lolo.io.vn'), 'x.stg.lolo.io.vn', 'https:', '')).toBe('https://abc.stg.lolo.io.vn');
  });
  it('chưa cấu hình tên miền gốc hoặc thiếu mã → null', () => {
    expect(client.buildTenantUrl('abc', [], 'x.vercel.app', 'https:', '')).toBeNull();
    expect(client.buildTenantUrl('', b, 'x.vercel.app', 'https:', '')).toBeNull();
  });
});
