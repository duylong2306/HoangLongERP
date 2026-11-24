// Giá trị HỢP ĐỒNG của công trình = TỔNG các hợp đồng khách hàng ĐÃ DUYỆT (xây dựng / nội thất / cơ khí) của công trình đó.
// Đây là cách Kế toán (Công nợ thu) và bảng Kanban dự án đang tính. Khi người duyệt bấm "Duyệt Hợp Đồng", hệ thống chỉ đánh dấu
// contractApproved=true trên hồ sơ hợp đồng chứ KHÔNG ghi giá trị vào trường project.contractValue — nên các màn Phòng Giám Đốc
// (đọc project.contractValue) hiện 0 trong khi Kế toán đã thấy hợp đồng. Hàm ở đây giúp Phòng Giám Đốc dùng cùng cách tính với Kế toán.

/** Giá trị 1 hợp đồng: totalAmount là trường chính thức; hồ sơ cũ có thể null → rơi về contractValue rồi tổng items.totalPrice (đúng như Kế toán). */
export function contractFinalValue(q: any): number {
  const fromItems = Array.isArray(q?.items) ? q.items.reduce((s: number, it: any) => s + (Number(it?.totalPrice) || 0), 0) : 0;
  return Number(q?.totalAmount) || Number(q?.contractValue) || fromItems || 0;
}

/** Tổng giá trị hợp đồng ĐÃ DUYỆT theo từng công trình (bỏ hợp đồng thầu phụ — có luồng riêng). */
export function approvedContractByProject(quotes: any[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const q of quotes || []) {
    if (!q?.projectId || q.sector === 'subcontractor' || q.contractApproved !== true) continue;
    m.set(q.projectId, (m.get(q.projectId) || 0) + contractFinalValue(q));
  }
  return m;
}

/**
 * Trả về danh sách công trình với contractValue = tổng hợp đồng đã duyệt (nếu công trình CÓ hợp đồng đã duyệt).
 * Công trình chưa có hợp đồng nào được duyệt giữ nguyên giá trị đang lưu (dữ liệu cũ nhập tay) để không mất số liệu.
 * Không đổi danh sách nếu không có gì thay đổi.
 */
export function withApprovedContractValue<T extends { id: string; contractValue?: number }>(projects: T[], quotes: any[]): T[] {
  const byProject = approvedContractByProject(quotes);
  if (byProject.size === 0) return projects;
  return projects.map(p => (byProject.has(p.id) ? { ...p, contractValue: byProject.get(p.id)! } : p));
}
