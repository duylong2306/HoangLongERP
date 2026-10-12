// ─── Nhân viên có TÀI KHOẢN ĐĂNG NHẬP thật hay không ───────────────────────────────────────────────
// Lỗi (2026-10-09): "Xóa tài khoản" rồi tải lại trang thì tài khoản lại hiện ra. Nguyên nhân: ensureAdminAndPasswords tự điền tên đăng nhập sinh từ họ tên
// và mật khẩu mặc định "123" cho MỌI nhân viên còn trống, trong khi danh sách tài khoản lọc theo `username && password` — nên nhân viên nào cũng "có tài khoản".
// Quy tắc đúng: chỉ coi là có tài khoản khi trong dữ liệu có tên đăng nhập thật VÀ chưa bị thu hồi (hasSystemAccount !== false).
export function hasLoginAccount(emp: { username?: string | null; hasSystemAccount?: boolean | null } | undefined | null): boolean {
  if (!emp) return false;
  return !!(emp.username && emp.username.trim()) && emp.hasSystemAccount !== false;
}

// ─── Phiên đăng nhập của người đã bị xóa / thu hồi tài khoản ────────────────────────────────────────────────────
// Rà soát bảo mật 11/10/2026: nhân viên bị xóa hoặc thu hồi tài khoản mà máy vẫn đang đăng nhập thì vẫn dùng bình thường — trình duyệt giữ nguyên phiên cũ
// khi không tìm thấy họ trong danh sách. Hàm thuần này cho biết phiên có còn hợp lệ không, dựa trên DANH SÁCH NHÂN VIÊN THẬT lấy từ máy chủ.
export type SessionRevokeReason = 'removed' | 'revoked' | 'retired';

/**
 * Trả về lý do phải đăng xuất, hoặc null nếu phiên còn hợp lệ.
 * - Danh sách máy chủ RỖNG → null (không đủ cơ sở kết luận: có thể token hết hạn / mất mạng / RLS trả rỗng — việc đó có xử lý riêng).
 * - Không còn hồ sơ (so theo mã nhân viên; phiên cũ không có mã thì so theo tên đăng nhập) → 'removed'.
 * - Có hồ sơ nhưng đã nghỉ việc → 'retired'; đã thu hồi tài khoản / mất tên đăng nhập → 'revoked'.
 */
export function sessionRevokeReason(
  session: { id?: string | null; username?: string | null } | null | undefined,
  serverEmployees: { id?: string; username?: string | null; hasSystemAccount?: boolean | null; status?: string | null }[] | null | undefined
): SessionRevokeReason | null {
  if (!session || !serverEmployees || serverEmployees.length === 0) return null;
  const found = session.id
    ? serverEmployees.find(e => e.id === session.id)
    : session.username ? serverEmployees.find(e => (e.username || '').toLowerCase() === session.username!.toLowerCase()) : undefined;
  if (!found) return 'removed';
  if (found.status === 'retired') return 'retired';
  if (!hasLoginAccount(found)) return 'revoked';
  return null;
}

export const SESSION_REVOKE_MESSAGES: Record<SessionRevokeReason, string> = {
  removed: 'Tài khoản của bạn không còn trong hệ thống. Bạn sẽ được đăng xuất.',
  revoked: 'Tài khoản của bạn đã bị thu hồi. Bạn sẽ được đăng xuất.',
  retired: 'Hồ sơ của bạn đã chuyển sang nghỉ việc. Bạn sẽ được đăng xuất.',
};
