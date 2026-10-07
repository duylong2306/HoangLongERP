// XÁC THỰC TRANG QUẢN TRỊ NỀN TẢNG (lolo.io.vn/quantri) — tách biệt hoàn toàn với đăng nhập ERP của doanh nghiệp.
// File bắt đầu bằng "_" nên Vercel không coi là endpoint. KHÔNG import từ src/ (xem api/login.ts).
//
// Token quản trị được ký bằng KHÓA RIÊNG suy ra từ SUPABASE_JWT_SECRET (sha256 + nhãn "platform-admin"), nên:
//   • token ERP (ký bằng SUPABASE_JWT_SECRET) KHÔNG được chấp nhận ở trang quản trị — nhân viên/admin của bất kỳ
//     doanh nghiệp nào (kể cả Hoàng Long) không thể dùng token của mình để vào trang quản trị;
//   • token quản trị KHÔNG hợp lệ với Supabase/PostgREST (khác khóa ký) — lộ token cũng không đọc được dữ liệu ERP.
// Không cần thêm biến môi trường mới; đổi SUPABASE_JWT_SECRET là đồng thời vô hiệu mọi token quản trị.
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';

export const PLATFORM_TOKEN_TTL_SECONDS = 12 * 60 * 60;   // phiên quản trị tối đa 12 giờ
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;            // cửa sổ đếm lượt đăng nhập sai
export const MAX_FAILS_PER_IP = 10;
export const MAX_FAILS_PER_USERNAME = 5;

export function platformSecret(jwtSecret: string): string {
  return createHash('sha256').update(`${jwtSecret}|platform-admin`).digest('hex');
}

export function signPlatformToken(admin: { id: string; username: string }, jwtSecret: string): string {
  return jwt.sign(
    { sub: admin.id, username: admin.username, typ: 'platform_admin' },
    platformSecret(jwtSecret),
    { algorithm: 'HS256', expiresIn: PLATFORM_TOKEN_TTL_SECONDS },
  );
}

// Trả về { sub, username } nếu token đúng chữ ký, còn hạn VÀ đúng loại 'platform_admin'; ngược lại null.
export function verifyPlatformToken(token: string, jwtSecret: string): { sub: string; username: string } | null {
  try {
    const p: any = jwt.verify(token, platformSecret(jwtSecret), { algorithms: ['HS256'] });
    if (p?.typ !== 'platform_admin' || typeof p.sub !== 'string') return null;
    return { sub: p.sub, username: String(p.username || '') };
  } catch {
    return null;
  }
}

export function bearerToken(authorization: string | undefined): string {
  const h = authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}
