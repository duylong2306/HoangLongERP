// Xác định DOANH NGHIỆP (tenant) từ tên miền đang truy cập — Giai đoạn 1 chuyển sang subdomain.
//
// Quy ước: mỗi doanh nghiệp có 1 subdomain dưới "tên miền gốc" (VITE_BASE_DOMAIN), ví dụ
//   hoanglong.lolo.vn  → doanh nghiệp "hoanglong"
//   lolo.vn            → địa chỉ gốc (trang giới thiệu/đăng ký — làm ở Giai đoạn 2)
//   *.vercel.app, localhost… (không nằm dưới tên miền gốc nào) → "other": giữ cách cũ, người dùng
//   tự nhập "Mã công ty" ở form đăng nhập (dùng cho staging *.vercel.app và máy dev).
//
// VITE_BASE_DOMAIN có thể có NHIỀU giá trị, phân cách bằng dấu phẩy, ví dụ "lolo.vn,stg.lolo.vn"
// (production và staging dùng 2 tên miền gốc khác nhau). Chưa cấu hình biến này → mọi địa chỉ đều
// là "other" → hành vi y hệt trước đây (không ảnh hưởng môi trường đang chạy).
//
// ⚠️ BẢN SAO phía máy chủ: api/_tenant.ts (api/ không được import từ src/ — xem api/login.ts).
// Sửa ở đây thì PHẢI sửa cả bên đó — test src/lib/__tests__/tenant.test.ts so sánh 2 bản.

// Tên không được dùng làm subdomain doanh nghiệp (dành cho hệ thống). Gặp các tên này → coi như
// địa chỉ gốc. Giai đoạn 2 (đăng ký) cũng dùng danh sách này để chặn người dùng đặt trùng.
export const RESERVED_SUBDOMAINS: readonly string[] = [
  'www', 'app', 'api', 'admin', 'mail', 'ftp', 'static', 'assets', 'cdn',
  'dashboard', 'login', 'signup', 'register', 'support', 'help', 'status', 'blog', 'docs',
];

// Mã công ty hợp lệ: chữ thường/số/gạch ngang, 2–40 ký tự, không bắt đầu/kết thúc bằng gạch ngang
// (khớp kiểm tra ở api/platform.ts + chuẩn nhãn DNS).
export const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])$/;

export type HostInfo =
  | { kind: 'tenant'; slug: string }   // đúng 1 subdomain dưới tên miền gốc → xác định được doanh nghiệp
  | { kind: 'root' }                   // địa chỉ gốc (hoặc subdomain hệ thống như www)
  | { kind: 'other' };                 // không thuộc tên miền gốc nào (vercel.app, localhost...)

// "lolo.vn, stg.lolo.vn " → ['lolo.vn','stg.lolo.vn'] (chữ thường, bỏ rỗng/trùng)
export function parseBaseDomains(raw?: string | null): string[] {
  return Array.from(new Set(
    (raw || '').split(',').map(s => s.trim().toLowerCase().replace(/^\.+|\.+$/g, '')).filter(Boolean)
  ));
}

// Chuẩn hóa hostname: chữ thường, bỏ cổng (:5173) và dấu chấm cuối.
export function normalizeHostname(host: string): string {
  return (host || '').trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
}

export function resolveHost(hostname: string, baseDomains: string[]): HostInfo {
  const host = normalizeHostname(hostname);
  if (!host || baseDomains.length === 0) return { kind: 'other' };

  // Trùng khít 1 tên miền gốc → địa chỉ gốc. Kiểm tra TRƯỚC mọi phép so "endsWith" để
  // stg.lolo.vn (là tên miền gốc riêng của staging) không bị hiểu nhầm là doanh nghiệp "stg" của lolo.vn.
  if (baseDomains.includes(host)) return { kind: 'root' };

  // Thử tên miền gốc DÀI nhất trước (stg.lolo.vn trước lolo.vn).
  const sorted = [...baseDomains].sort((a, b) => b.length - a.length);
  for (const base of sorted) {
    if (!host.endsWith('.' + base)) continue;
    const prefix = host.slice(0, host.length - base.length - 1);
    // Chỉ chấp nhận ĐÚNG 1 nhãn (hoanglong.lolo.vn); a.b.lolo.vn không phải doanh nghiệp.
    if (prefix.includes('.')) continue;
    if (RESERVED_SUBDOMAINS.includes(prefix)) return { kind: 'root' };
    if (!SLUG_PATTERN.test(prefix)) return { kind: 'other' };
    return { kind: 'tenant', slug: prefix };
  }
  return { kind: 'other' };
}

// Tên miền gốc mà hostname đang thuộc về (dài nhất khớp trước) — dùng để hiển thị đúng hướng dẫn
// "tên-doanh-nghiệp.<tên-miền-gốc>" ngay cả khi người dùng đang ở www.<tên-miền-gốc>. Không khớp → null.
export function matchBaseDomain(hostname: string, baseDomains: string[]): string | null {
  const host = normalizeHostname(hostname);
  const sorted = [...baseDomains].sort((a, b) => b.length - a.length);
  return sorted.find(b => host === b || host.endsWith('.' + b)) ?? null;
}

// Dựng địa chỉ riêng của 1 doanh nghiệp: <slug>.<tên-miền-gốc>. Hàm thuần để test được.
//  - Đang ở chính tên miền gốc (hoặc subdomain của nó): dùng đúng giao thức + cổng hiện tại (dev: http://x.localhost:5174);
//  - Đang ở địa chỉ khác (vercel.app...): dùng tên miền gốc ĐẦU TIÊN đã cấu hình, mặc định https, không cổng.
// Không có tên miền gốc nào được cấu hình → null (chưa dùng subdomain).
export function buildTenantUrl(slug: string, baseDomains: string[], hostname: string, protocol: string, port: string): string | null {
  if (baseDomains.length === 0 || !slug) return null;
  const matched = matchBaseDomain(hostname, baseDomains);
  if (matched) return `${protocol}//${slug}.${matched}${port ? ':' + port : ''}`;
  return `https://${slug}.${baseDomains[0]}`;
}

// Dùng ở trình duyệt: đọc cấu hình + địa chỉ hiện tại.
export function getHostInfo(): HostInfo {
  let hostname = '';
  try { hostname = window.location.hostname; } catch { /* môi trường không có window (test/SSR) */ }
  const raw = import.meta.env.VITE_BASE_DOMAIN;
  return resolveHost(hostname, parseBaseDomains(raw));
}

// Dùng ở trình duyệt: tên miền gốc của địa chỉ hiện tại (để hiện hướng dẫn cho người dùng).
export function getBaseDomainForDisplay(): string {
  let hostname = '';
  try { hostname = window.location.hostname; } catch { /* không có window */ }
  const raw = import.meta.env.VITE_BASE_DOMAIN;
  return matchBaseDomain(hostname, parseBaseDomains(raw)) ?? hostname;
}

// Dùng ở trình duyệt: địa chỉ riêng của doanh nghiệp `slug` (null nếu chưa cấu hình VITE_BASE_DOMAIN).
export function getTenantUrl(slug: string): string | null {
  let loc = { hostname: '', protocol: 'https:', port: '' };
  try { loc = window.location; } catch { /* không có window */ }
  const raw = import.meta.env.VITE_BASE_DOMAIN;
  return buildTenantUrl(slug, parseBaseDomains(raw), loc.hostname, loc.protocol, loc.port);
}
