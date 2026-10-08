// LOGIC DÙNG CHUNG CHO ĐƠN NGHỈ / BÁO CÁO CHẤM CÔNG (hrm_leaves).

// ── 1) Mã đơn không trùng ───────────────────────────────────────────────────────────────────────────────────────────────────
// Trước đây mã đơn = "LR-" + 3 số cuối của đồng hồ → chỉ 1000 giá trị; khi trùng mã có sẵn, lệnh lưu (upsert theo mã) GHI ĐÈ đơn cũ.
// Hàm này chọn mã 3 số chưa dùng (giữ dạng quen thuộc LR-123); gần hết chỗ thì sang mã 5 số.
export function generateLeaveId(existingIds: Iterable<string>, rand: () => number = Math.random): string {
  const used = new Set(existingIds);
  for (let i = 0; i < 60; i++) {
    const id = `LR-${String(Math.floor(rand() * 1000)).padStart(3, '0')}`;
    if (!used.has(id)) return id;
  }
  for (let i = 0; i < 1000; i++) {
    const id = `LR-${String(Math.floor(rand() * 100000)).padStart(5, '0')}`;
    if (!used.has(id)) return id;
  }
  return `LR-${Date.now()}`;   // đường lui cuối cùng: dùng đồng hồ đầy đủ (không thể trùng)
}

// ── 2) Gộp cặp "Báo cáo nghỉ ca" sáng + chiều thành 1 thao tác "Cả ngày" ─────────────────────────────────────────────
// Dữ liệu vẫn là 2 bản ghi (mỗi ca 1 đơn) để các luồng tính công/chấm công không đổi; chỉ phần HIỂN THỊ và DUYỆT coi cặp là một.
// Cặp hợp lệ: cùng nhân viên, cùng 1 ngày, cùng loại "Báo cáo nghỉ ca", cùng đang CHỜ DUYỆT, một đơn ca sáng + một đơn ca chiều.
type Leave = { id: string; type?: string; status?: string; shift?: string; empId?: string; empName?: string; fromDate?: string; toDate?: string };

export const ABSENCE_REPORT_TYPE = 'Báo cáo nghỉ ca';

const sameEmp = (a: Leave, b: Leave) => (a.empId && b.empId ? a.empId === b.empId : !!a.empName && a.empName === b.empName);

/** Đơn còn lại của cặp (nếu có) — dùng khi Duyệt/Từ chối 1 đơn để áp dụng cho cả cặp. */
export function findPairedAbsenceReport<T extends Leave>(leave: T | undefined | null, leaves: T[]): T | null {
  if (!leave || leave.type !== ABSENCE_REPORT_TYPE || leave.status !== 'pending') return null;
  if (leave.shift !== 'morning' && leave.shift !== 'afternoon') return null;
  if (!leave.fromDate || leave.fromDate !== leave.toDate) return null;
  const other = leave.shift === 'morning' ? 'afternoon' : 'morning';
  return leaves.find(l =>
    l.id !== leave.id && l.type === ABSENCE_REPORT_TYPE && l.status === 'pending' && l.shift === other &&
    l.fromDate === leave.fromDate && l.toDate === leave.toDate && sameEmp(l, leave)) || null;
}

/**
 * Gom các cặp chờ duyệt: trả về danh sách hiển thị (đơn ca CHIỀU của cặp bị ẩn đi),
 * và bảng `pairOf` (mã đơn ca sáng → mã đơn ca chiều) để biết dòng nào là "Cả ngày".
 */
export function groupPendingAbsencePairs<T extends Leave>(leaves: T[]): { visible: T[]; pairOf: Map<string, string> } {
  const pairOf = new Map<string, string>();
  const hidden = new Set<string>();
  for (const l of leaves) {
    if (hidden.has(l.id) || pairOf.has(l.id) || l.shift !== 'morning') continue;
    const sib = findPairedAbsenceReport(l, leaves.filter(x => !hidden.has(x.id)));
    if (sib) { pairOf.set(l.id, sib.id); hidden.add(sib.id); }
  }
  return { visible: leaves.filter(l => !hidden.has(l.id)), pairOf };
}
