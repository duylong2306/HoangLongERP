// ─── Dọn tham chiếu khi XÓA một nhóm vai trò ─────────────────────────────────────────────────────────
// Lỗi (phát hiện khi kiểm thử 2026-10-09): xóa nhóm còn thành viên thì `employees.role_group_ids` của các thành viên đó VẪN giữ mã nhóm đã xóa.
// Hậu quả: dữ liệu rác tích tụ (VD Hoàng Long có nhân viên trỏ tới 6 nhóm không còn tồn tại); và vì ứng dụng chỉ tự suy nhóm từ danh sách
// thành viên khi mảng này RỖNG, nhân viên có mã "ma" có thể bị bỏ sót khi suy nhóm.
// Hàm thuần: nhận danh sách nhân viên, trả về những nhân viên cần cập nhật (đã bỏ mã nhóm bị xóa) — để gọi lưu rồi.

export interface EmpRoleRefs { id?: string; roleGroupIds?: string[] }

export function employeesToCleanAfterGroupDelete(employees: EmpRoleRefs[], deletedGroupId: string): { empId: string; roleGroupIds: string[] }[] {
  const out: { empId: string; roleGroupIds: string[] }[] = [];
  for (const e of employees || []) {
    if (!e?.id) continue;
    const ids = e.roleGroupIds || [];
    if (!ids.includes(deletedGroupId)) continue;
    out.push({ empId: e.id, roleGroupIds: ids.filter(x => x !== deletedGroupId) });
  }
  return out;
}
