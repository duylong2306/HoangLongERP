// Tính SỐ NGÀY CÒN LẠI của dự án (thẻ Kanban + sắp xếp cột).
// Hạn hoàn thành = endDate (dạng 'YYYY-MM-DD'), hoặc = ngày khởi công + N ngày khi endDate chỉ lưu "N ngày".
// Cùng cách tính với khối "Số ngày còn lại" trong chi tiết dự án để hai nơi luôn khớp.

const DAY = 24 * 60 * 60 * 1000;

// 'YYYY-MM-DD' (có thể kèm giờ) → Date theo giờ máy, 00:00 — tránh lệch ngày do múi giờ.
function parseYmd(s?: string): Date | null {
  const m = (s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

/** Ngày hạn của dự án, hoặc null nếu chưa đủ dữ liệu. */
export function getProjectDeadline(p: { startDate?: string; endDate?: string }): Date | null {
  const end = parseYmd(p.endDate);
  if (end) return end;
  const n = (p.endDate || '').match(/^(\d+)\s*ngày/);
  const start = parseYmd(p.startDate);
  if (n && start) { start.setDate(start.getDate() + Number(n[1])); return start; }
  return null;
}

/**
 * Số ngày còn lại (âm = đã trễ hạn); null nếu dự án đã hoàn thành hoặc chưa có hạn.
 * `now` cho phép test cố định ngày.
 */
export function getProjectDaysLeft(p: { startDate?: string; endDate?: string; status?: string }, now: Date = new Date()): number | null {
  if (p.status === 'completed') return null;
  const d = getProjectDeadline(p);
  if (!d) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((d.getTime() - today.getTime()) / DAY);
}

/** So sánh để sắp TĂNG DẦN theo số ngày còn lại: trễ hạn (âm) lên đầu, rồi sắp hết hạn; không có hạn xuống cuối. */
export function compareByDaysLeft(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}
