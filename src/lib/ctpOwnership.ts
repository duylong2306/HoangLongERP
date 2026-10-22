// "Công Tác Phí Của Tôi" (Tổng quan): chỉ lấy khoản mà người dùng là NGƯỜI ĐƯỢC HƯỞNG (empId),
// KHÔNG phải người lập (creatorId) — người lập hộ người khác không thấy khoản đó trong mục "Của tôi".
// Khớp theo MÃ nhân viên; chỉ khoản cũ chưa có mã mới dự phòng theo tên người hưởng.
export function isTravelExpenseBeneficiary(
  item: { empId?: string; employeeId?: string; employeeName?: string },
  user: { id?: string; name?: string } | null | undefined,
): boolean {
  if (!user) return false;
  const beneficiaryId = item.empId || item.employeeId;
  if (beneficiaryId) return beneficiaryId === user.id;
  return !!item.employeeName && !!user.name && item.employeeName.trim().toLowerCase() === user.name.trim().toLowerCase();
}
