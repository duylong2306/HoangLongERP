// Quản trị viên đặt lại mật khẩu cho nhân viên qua máy chủ (api/reset-password). Máy chủ tự sinh mật khẩu tạm — chỉ trả về MỘT LẦN.
import { getCurrentAccessToken } from './supabase';

export interface ResetResult { tempPassword: string; forced: boolean; employeeName: string }

/** Ném Error với thông báo tiếng Việt khi thất bại. */
export async function requestAdminPasswordReset(employeeId: string): Promise<ResetResult> {
  const token = getCurrentAccessToken();
  if (!token) throw new Error('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
  let res: Response;
  try {
    res = await fetch('/api/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ employeeId }) });
  } catch { throw new Error('Không kết nối được tới máy chủ. Vui lòng thử lại.'); }
  const body = await res.json().catch(() => ({} as any));
  if (!res.ok || !body?.ok || !body?.tempPassword) throw new Error(body?.error || 'Không đặt lại được mật khẩu. Vui lòng thử lại.');
  return { tempPassword: String(body.tempPassword), forced: body.forced !== false, employeeName: String(body.employeeName || '') };
}
