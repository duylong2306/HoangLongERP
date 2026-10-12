// Đổi mật khẩu qua máy chủ (api/change-password) + thông báo "cần đổi mật khẩu" sau khi đăng nhập (Giai đoạn A bảo mật tài khoản).
import { getCurrentAccessToken, setAuthToken, isAuthTokenPersisted } from './supabase';

export type PasswordNotice = 'force' | 'default';
const NOTICE_KEY = 'hl_pw_notice';
export const MIN_PASSWORD_LENGTH = 6;   // khớp api/_security.ts
export const DEFAULT_PASSWORD = '123';

/** Ghi nhận (hoặc xóa, khi null) yêu cầu đổi mật khẩu của phiên hiện tại. 'force' = bắt buộc; 'default' = nhắc vì đang dùng mật khẩu mặc định. */
export function setPasswordNotice(kind: PasswordNotice | null): void {
  try {
    if (kind) sessionStorage.setItem(NOTICE_KEY, kind);
    else sessionStorage.removeItem(NOTICE_KEY);
  } catch { /* bỏ qua */ }
}
export function getPasswordNotice(): PasswordNotice | null {
  try {
    const v = sessionStorage.getItem(NOTICE_KEY);
    return v === 'force' || v === 'default' ? v : null;
  } catch { return null; }
}

/** Kiểm tra nhanh ở giao diện (máy chủ vẫn kiểm tra lại). Trả thông báo lỗi hoặc null. */
export function checkNewPassword(oldPw: string, newPw: string, confirmPw: string): string | null {
  if (!oldPw) return 'Vui lòng nhập mật khẩu hiện tại.';
  if (newPw.length < MIN_PASSWORD_LENGTH) return `Mật khẩu mới phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`;
  if (newPw === DEFAULT_PASSWORD) return 'Không được dùng mật khẩu mặc định.';
  if (newPw === oldPw) return 'Mật khẩu mới phải khác mật khẩu hiện tại.';
  if (newPw !== confirmPw) return 'Mật khẩu xác nhận không khớp.';
  return null;
}

/**
 * Gửi yêu cầu đổi mật khẩu. Thành công: máy chủ trả token MỚI (token cũ — kể cả trên máy khác — bị thu hồi), ta thay token ngay
 * để phiên hiện tại không bị đăng xuất. Ném Error với thông báo tiếng Việt khi thất bại.
 */
export async function requestPasswordChange(oldPassword: string, newPassword: string): Promise<void> {
  const token = getCurrentAccessToken();
  if (!token) throw new Error('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
  let res: Response;
  try {
    res = await fetch('/api/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ oldPassword, newPassword }),
    });
  } catch {
    throw new Error('Không kết nối được tới máy chủ. Vui lòng thử lại.');
  }
  const body = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error(body?.error || 'Không đổi được mật khẩu.');
  if (body?.token) setAuthToken(body.token, isAuthTokenPersisted());
  setPasswordNotice(null);
}
