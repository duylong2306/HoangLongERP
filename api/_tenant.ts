// BẢN SAO phía MÁY CHỦ của src/lib/tenant.ts — Vercel Functions (api/) không import từ src/ (xem api/login.ts).
// File bắt đầu bằng "_" nên Vercel KHÔNG coi là 1 endpoint. Sửa logic ở src/lib/tenant.ts thì sửa cả ở đây;
// test src/lib/__tests__/tenant.test.ts so sánh kết quả của 2 bản.
// Xem giải thích đầy đủ về quy ước subdomain ở src/lib/tenant.ts.
import type { VercelRequest } from '@vercel/node';

// Tên không được dùng làm subdomain doanh nghiệp (dành cho hệ thống). Gặp các tên này → coi như
// địa chỉ gốc. Giai đoạn 2 (đăng ký) cũng dùng danh sách này để chặn người dùng đặt trùng.
export const RESERVED_SUBDOMAINS: readonly string[] = [
  'www', 'app', 'api', 'admin', 'mail', 'ftp', 'static', 'assets', 'cdn',
  'dashboard', 'login', 'signup', 'register', 'support', 'help', 'status', 'blog', 'docs',
];

// Mã công ty hợp lệ: chữ thường/số/gạch ngang, 2–40 ký tự, không bắt đầu/kết thúc bằng gạch ngang
// (khớp kiểm tra ở api/admin-companies.ts + chuẩn nhãn DNS).
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

// Hostname mà người dùng THỰC SỰ truy cập: sau proxy của Vercel là x-forwarded-host (có thể nhiều giá trị
// cách nhau dấu phẩy — lấy giá trị đầu), không có thì dùng Host.
export function getRequestHostname(req: VercelRequest): string {
  const raw = (req.headers['x-forwarded-host'] || req.headers.host || '') as string | string[];
  const first = (Array.isArray(raw) ? raw[0] : raw).split(',')[0];
  return normalizeHostname(first);
}

// Tên miền gốc cấu hình trên server. VITE_BASE_DOMAIN dùng chung với frontend (cùng 1 biến môi trường
// trên Vercel) để 2 phía luôn thống nhất — các hàm trong api/ đã đọc sẵn VITE_SUPABASE_URL theo cách này.
export function getServerBaseDomains(): string[] {
  return parseBaseDomains(process.env.VITE_BASE_DOMAIN);
}
