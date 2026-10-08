// NGHỈ PHÉP THEO CA — "Nghỉ phép năm" và "Nghỉ không lương có xin phép" cho phép nghỉ CẢ NGÀY (mặc định) hoặc chỉ 1 CA cụ thể (sáng/chiều).
// Đơn nghỉ 1 ca: dùng lại trường `shift` ('morning' | 'afternoon') đã có trên đơn, nghỉ đúng 1 ngày (fromDate = toDate), số ngày = 0,5.
// Đơn nghỉ cả ngày: không có `shift`. Vì số ngày của đơn (daysCount) đã là 0,5 nên việc TRỪ PHÉP NĂM khi duyệt tự đúng (trừ 0,5).
import { isRealLeaveType } from './leaveNotice';

export type LeaveShift = 'morning' | 'afternoon';

/** Loại đơn cho phép chọn nghỉ 1 ca. Các loại khác (hiếu hỉ, cưới...) luôn là nghỉ theo số ngày. */
export const SHIFT_LEAVE_TYPES = ['Nghỉ phép năm', 'Nghỉ không lương có xin phép'] as const;
export const supportsShiftLeave = (type?: string): boolean => !!type && (SHIFT_LEAVE_TYPES as readonly string[]).includes(type);

export const HALF_DAY = 0.5;

export const shiftLabel = (s?: string): string => (s === 'morning' ? 'ca sáng' : s === 'afternoon' ? 'ca chiều' : '');
/** Chữ viết tắt ngắn để gắn vào ô lịch: S = sáng, C = chiều. */
export const shiftShort = (s?: string): string => (s === 'morning' ? 'S' : s === 'afternoon' ? 'C' : '');

/** Đơn nghỉ phép THẬT theo 1 ca (không tính các báo cáo chấm công — chúng cũng có `shift` nhưng là loại khác). */
export function isShiftLeave(l: { type?: string; shift?: string } | null | undefined): boolean {
  return !!l && isRealLeaveType(l.type) && (l.shift === 'morning' || l.shift === 'afternoon');
}

/** Số ngày của đơn: nghỉ 1 ca = 0,5; ngược lại = số ngày lịch từ ngày bắt đầu tới ngày kết thúc (gồm cả hai đầu). */
export function leaveDaysCount(fromDate: string, toDate: string, shift?: string): number {
  if (shift === 'morning' || shift === 'afternoon') return HALF_DAY;
  const a = new Date(`${fromDate}T00:00:00`), b = new Date(`${toDate}T00:00:00`);
  const diff = b.getTime() - a.getTime();
  return diff >= 0 ? Math.round(diff / 86400000) + 1 : 0;
}

/** Ký hiệu công của loại nghỉ (khớp với getLeaveSymbol ở các màn hình duyệt). */
export function leaveSymbolOf(type?: string): string {
  if (type === 'Nghỉ phép năm') return 'PN';
  if (type === 'Nghỉ không lương có xin phép') return 'P';
  return 'OFF';
}

type LeaveLike = { type?: string; status?: string; shift?: string; empId?: string; empName?: string; fromDate?: string; toDate?: string };

/** Các đơn nghỉ 1 ca ĐÃ DUYỆT của nhân viên trong 1 ngày. */
export function approvedShiftLeavesOnDay<T extends LeaveLike>(leaves: T[] | undefined, who: { empId?: string; empName?: string }, date: string): T[] {
  return (leaves || []).filter(l =>
    l.status === 'approved' && isShiftLeave(l) &&
    ((l.empId && who.empId && l.empId === who.empId) || (l.empName && who.empName && l.empName === who.empName)) &&
    !!l.fromDate && date >= l.fromDate && date <= (l.toDate || l.fromDate));
}

/** Nhãn ngắn gắn lên ô lịch, VD "PN·S" (nghỉ phép năm ca sáng), "P·C" (nghỉ không lương ca chiều). */
export const shiftLeaveBadge = (l: { type?: string; shift?: string }): string => `${leaveSymbolOf(l.type)}·${shiftShort(l.shift)}`;
/** Nhãn đầy đủ, VD "Nghỉ phép năm — ca sáng". */
export const shiftLeaveFullLabel = (l: { type?: string; shift?: string }): string => `${l.type || 'Nghỉ'} — ${shiftLabel(l.shift)}`;
