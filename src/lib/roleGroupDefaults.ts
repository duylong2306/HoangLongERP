// ─── Quyền MẶC ĐỊNH của nhóm vai trò MỚI TẠO ──────────────────────────────────────────────────────────────────────
// Trước đây nhóm mới được cấp quyền Xem ở TẤT CẢ phân hệ (kể cả Cài đặt, Tài khoản, Phân quyền, Nhân sự/lương, Tài chính) — tạo nhóm xong quên chỉnh
// là người trong nhóm xem được hầu hết hệ thống (vi phạm nguyên tắc "ít quyền nhất"). Nay mặc định chỉ Xem các phân hệ nghiệp vụ thông thường;
// phân hệ nhạy cảm phải được chủ doanh nghiệp tick riêng.
export const PHAN_HE_NHAY_CAM: readonly string[] = [
  'director_office', 'director_dashboard',          // phòng giám đốc
  'hr_office', 'employees', 'hr_data',              // nhân sự, chấm công, lương
  'accounting_office', 'finance', 'finance_data',   // tài chính, kế toán
  'system_office', 'settings_accounts', 'settings_roles', 'settings', // cài đặt, tài khoản, phân quyền
];

export type ModulePerm = { view: boolean; create: boolean; edit: boolean; delete: boolean };

/** Quyền mặc định của nhóm mới: Xem các phân hệ KHÔNG nhạy cảm, các phân hệ nhạy cảm để tắt hết. */
export function defaultPermissionsForNewGroup(allModules: readonly string[]): Record<string, ModulePerm> {
  const out: Record<string, ModulePerm> = {};
  for (const m of allModules) out[m] = { view: !PHAN_HE_NHAY_CAM.includes(m), create: false, edit: false, delete: false };
  return out;
}
