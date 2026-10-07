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

export const PLATFORM_TOKEN_TTL_SECONDS = 2 * 60 * 60;    // phiên quản trị tối đa 2 giờ (token lộ cũng chỉ dùng được tối đa 2 giờ)
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;            // cửa sổ đếm lượt đăng nhập sai
export const MAX_FAILS_PER_IP = 10;
export const MAX_FAILS_PER_PAIR = 5;        // sai quá 5 lần với CÙNG (IP + tên đăng nhập) → khóa cặp đó
export const MAX_FAILS_PER_USERNAME = 50;   // tổng lượt sai theo tên từ mọi IP (chặn dò phân tán; đủ cao để khó dùng làm DoS)
export const PLATFORM_BCRYPT_COST = 12;     // cost bcrypt của mật khẩu quản trị (phải khớp DUMMY_HASH trong api/platform.ts)

export function platformSecret(jwtSecret: string): string {
  return createHash('sha256').update(`${jwtSecret}|platform-admin`).digest('hex');
}

export function signPlatformToken(admin: { id: string; username: string; ver?: number }, jwtSecret: string): string {
  return jwt.sign(
    // ver = số phiên bản token của tài khoản (platform_admins.token_version): đăng xuất / đổi mật khẩu tăng số này
    // → mọi token cũ (ver nhỏ hơn) bị máy chủ từ chối ngay, không chờ hết hạn.
    { sub: admin.id, username: admin.username, ver: admin.ver ?? 0, typ: 'platform_admin' },
    platformSecret(jwtSecret),
    { algorithm: 'HS256', expiresIn: PLATFORM_TOKEN_TTL_SECONDS },
  );
}

// Trả về { sub, username } nếu token đúng chữ ký, còn hạn VÀ đúng loại 'platform_admin'; ngược lại null.
export function verifyPlatformToken(token: string, jwtSecret: string): { sub: string; username: string; ver: number } | null {
  try {
    const p: any = jwt.verify(token, platformSecret(jwtSecret), { algorithms: ['HS256'] });
    if (p?.typ !== 'platform_admin' || typeof p.sub !== 'string') return null;
    return { sub: p.sub, username: String(p.username || ''), ver: Number.isInteger(p.ver) ? p.ver : 0 };
  } catch {
    return null;
  }
}

export function bearerToken(authorization: string | undefined): string {
  const h = authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

// ─── Quy tắc tài khoản quản trị (dùng chung cho đổi mật khẩu / tạo tài khoản) ─────────────────────
// Trả về thông báo lỗi tiếng Việt, hoặc null nếu hợp lệ.
export function passwordProblem(pw: string): string | null {
  if (pw.length < 10 || pw.length > 72 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) {
    return 'Mật khẩu từ 10 đến 72 ký tự, có cả chữ và số.';
  }
  return null;
}
export const ADMIN_USERNAME_RE = /^[a-z0-9._-]{3,40}$/;

// ─── Thử thách 2FA ───────────────────────────────────────────────────────────────────────────────
// Sau khi nhập ĐÚNG mật khẩu mà tài khoản bật 2FA, máy chủ chưa cấp phiên mà cấp "thẻ thử thách" sống 5 phút (typ khác hẳn
// phiên nên KHÔNG dùng được để gọi API quản trị). Chỉ khi nộp thẻ này cùng mã 6 số đúng mới nhận phiên thật.
export const TOTP_CHALLENGE_TTL_SECONDS = 5 * 60;

export function signTotpChallenge(admin: { id: string; username: string; ver?: number }, jwtSecret: string): string {
  return jwt.sign({ sub: admin.id, username: admin.username, ver: admin.ver ?? 0, typ: 'platform_totp_challenge' }, platformSecret(jwtSecret), { algorithm: 'HS256', expiresIn: TOTP_CHALLENGE_TTL_SECONDS });
}
export function verifyTotpChallenge(token: string, jwtSecret: string): { sub: string; username: string; ver: number } | null {
  try {
    const p: any = jwt.verify(token, platformSecret(jwtSecret), { algorithms: ['HS256'] });
    if (p?.typ !== 'platform_totp_challenge' || typeof p.sub !== 'string') return null;
    return { sub: p.sub, username: String(p.username || ''), ver: Number.isInteger(p.ver) ? p.ver : 0 };
  } catch { return null; }
}
