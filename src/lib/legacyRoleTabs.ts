// ─── Quyền menu "cũ" theo trường `role` — chỉ dùng khi nhân viên CHƯA có quyền nào từ nhóm vai trò ─────────────────
// LỖI NGHIÊM TRỌNG (phát hiện 2026-10-09 khi kiểm thử bằng tài khoản thật): nhân viên không thuộc nhóm nào (VD nhóm của họ đã bị xóa) rơi về quyền
// cũ của `role = engineer`, vốn gồm Hệ thống Nhân sự + toàn bộ Cài đặt hệ thống (Tài khoản, Phân quyền…) → mở được trang Phân quyền và SỬA được quyền.
// Nay quyền cũ chỉ còn dùng cho các màn nghiệp vụ thông thường; các màn nhạy cảm (nhân sự/lương, cài đặt, tài khoản, phân quyền, tài chính, kế toán,
// phòng giám đốc) KHÔNG BAO GIỜ được cấp qua đường dự phòng này — phải có nhóm vai trò cấp rõ ràng.
const NHAY_CAM = new Set([
  'hr-office', 'employees', 'hr-data',
  'system-office', 'settings', 'settings-accounts', 'settings-roles', 'display-settings',
  'accounting-office', 'finance', 'finance-data',
  'director-office', 'director-dashboard',
]);

export function filterLegacyFallbackTabs(tabs: readonly string[] | undefined | null): string[] {
  return (tabs || []).filter(t => !NHAY_CAM.has(t));
}
