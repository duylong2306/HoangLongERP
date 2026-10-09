// ─── Nhân viên có TÀI KHOẢN ĐĂNG NHẬP thật hay không ───────────────────────────────────────────────
// Lỗi (2026-10-09): "Xóa tài khoản" rồi tải lại trang thì tài khoản lại hiện ra. Nguyên nhân: ensureAdminAndPasswords tự điền tên đăng nhập sinh từ họ tên
// và mật khẩu mặc định "123" cho MỌI nhân viên còn trống, trong khi danh sách tài khoản lọc theo `username && password` — nên nhân viên nào cũng "có tài khoản".
// Quy tắc đúng: chỉ coi là có tài khoản khi trong dữ liệu có tên đăng nhập thật VÀ chưa bị thu hồi (hasSystemAccount !== false).
export function hasLoginAccount(emp: { username?: string | null; hasSystemAccount?: boolean | null } | undefined | null): boolean {
  if (!emp) return false;
  return !!(emp.username && emp.username.trim()) && emp.hasSystemAccount !== false;
}
