import { isRealLeaveType } from './leaveNotice';
import { isShiftLeave, leaveDaysCount, shiftLabel } from './leaveShift';

/**
 * ĐỔI NGÀY CỦA ĐƠN NGHỈ PHÉP ĐÃ DUYỆT (người quản lý hoán ngày nghỉ).
 *
 * Khi duyệt, hệ thống đã ghi ký hiệu nghỉ (P/PN/…) vào các dòng chấm công của những ngày trong đơn (hoặc tạo dòng mới
 * "Hành chính phép"). Vì vậy đổi ngày không chỉ sửa đơn mà còn phải: trả các ngày cũ về trạng thái chưa nghỉ và ghi ký hiệu
 * nghỉ vào các ngày mới. Toàn bộ logic ở đây là hàm thuần (không đụng state/DB) để test được; việc lưu do component gọi.
 */

type Leave = {
  id: string; empId?: string; empName?: string; type?: string; status?: string;
  fromDate: string; toDate: string; shift?: string; daysCount?: number; isAttendanceCorrection?: boolean;
};
type Att = {
  id: string; empId?: string; empName?: string; date: string; method?: string; notes?: string; isLocked?: boolean;
  timeInS?: string; timeOutS?: string; timeInC?: string; timeOutC?: string; timeInOT?: string; timeOutOT?: string;
  [k: string]: any;
};

export interface ReschedulePlan {
  error?: string;
  days: number;            // số ngày mới của đơn
  removed: string[];       // ngày bị bỏ khỏi đơn
  added: string[];         // ngày mới thêm vào đơn
  lockedDates: string[];   // ngày (cũ/mới) mà dòng chấm công đã CHỐT công
  punchedAdded: string[];  // ngày mới đã có giờ chấm thật → ký hiệu nghỉ sẽ ghi đè giờ đó
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isClock = (v: any) => typeof v === 'string' && /^\d{1,2}:\d{2}/.test(v.trim());

/** Liệt kê các ngày YYYY-MM-DD từ from đến to (gồm hai đầu). Dùng UTC để không lệch ngày do múi giờ. */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  if (!ISO.test(from) || !ISO.test(to)) return out;
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= end; t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

const sameEmp = (a: { empId?: string; empName?: string }, b: { empId?: string; empName?: string }) =>
  (!!a.empId && !!b.empId && a.empId === b.empId) || (!!a.empName && !!b.empName && a.empName === b.empName);

/** Dòng chấm công có giờ thật (HH:mm) ở bất kỳ ô nào — dùng để cảnh báo trước khi ký hiệu nghỉ ghi đè. */
const hasRealPunch = (a: Att) => [a.timeInS, a.timeOutS, a.timeInC, a.timeOutC, a.timeInOT, a.timeOutOT].some(isClock);

/** Kiểm tra đổi ngày có hợp lệ không và liệt kê tác động lên chấm công. */
export function planLeaveReschedule(p: { leave: Leave; newFrom: string; newTo: string; leaves: Leave[]; attendance: Att[] }): ReschedulePlan {
  const { leave, leaves, attendance } = p;
  const shiftOnly = isShiftLeave(leave as any);
  // Đơn nghỉ 1 ca chỉ có 1 ngày: ép "đến ngày" = "từ ngày".
  const newFrom = p.newFrom;
  const newTo = shiftOnly ? p.newFrom : p.newTo;
  const fail = (error: string): ReschedulePlan => ({ error, days: 0, removed: [], added: [], lockedDates: [], punchedAdded: [] });

  if (leave.status !== 'approved') return fail('Chỉ đổi ngày cho đơn đã duyệt (đơn chờ duyệt thì Từ chối hoặc Duyệt).');
  if (!isRealLeaveType(leave.type)) return fail('Loại đơn này không đổi ngày được.');
  if (!ISO.test(newFrom) || !ISO.test(newTo)) return fail('Vui lòng chọn đủ ngày.');
  if (newTo < newFrom) return fail('"Đến ngày" phải sau hoặc bằng "Từ ngày".');
  if (newFrom === leave.fromDate && newTo === leave.toDate) return fail('Ngày chưa thay đổi.');

  // Trùng đơn nghỉ khác của cùng nhân viên (đã duyệt hoặc đang chờ). Hai đơn nghỉ 1 ca khác ca nhau trong cùng ngày thì vẫn hợp lệ.
  const clash = leaves.find(o => {
    if (o.id === leave.id || !sameEmp(o, leave) || !isRealLeaveType(o.type)) return false;
    if (o.status !== 'approved' && o.status !== 'pending') return false;
    if (o.toDate < newFrom || o.fromDate > newTo) return false;
    return !(shiftOnly && isShiftLeave(o as any) && o.shift !== leave.shift);
  });
  if (clash) return fail(`Trùng với đơn ${clash.id} (${clash.fromDate} → ${clash.toDate}) của cùng nhân viên.`);

  const oldDates = datesBetween(leave.fromDate, leave.toDate);
  const newDates = datesBetween(newFrom, newTo);
  const removed = oldDates.filter(d => !newDates.includes(d));
  const added = newDates.filter(d => !oldDates.includes(d));
  const rowOf = (d: string) => attendance.find(a => sameEmp(a, leave) && a.date === d);
  const lockedDates = [...removed, ...added].filter(d => rowOf(d)?.isLocked);
  const punchedAdded = shiftOnly ? [] : added.filter(d => { const r = rowOf(d); return !!r && hasRealPunch(r); });
  return { days: leaveDaysCount(newFrom, newTo, leave.shift), removed, added, lockedDates, punchedAdded };
}

/**
 * Áp kế hoạch đổi ngày lên bảng chấm công. Trả về bảng mới + id các dòng đã xóa + các dòng đã đổi/tạo (để lưu lên DB).
 * - Ngày bỏ: chỉ hoàn tác dòng còn NGUYÊN ký hiệu nghỉ do việc duyệt ghi (người dùng đã sửa giờ tay thì giữ nguyên, không đụng).
 *   Dòng do việc duyệt tạo ra (method "Hành chính phép") mà vẫn trống thì xóa hẳn.
 * - Ngày mới: ghi ký hiệu nghỉ giống lúc duyệt (đơn 1 ca: chỉ ghi chú, không ghi đè giờ).
 */
export function applyLeaveReschedule(p: {
  leave: Leave; plan: ReschedulePlan; attendance: Att[]; symbol: string; newId: (date: string) => string;
}): { attendance: Att[]; deletedIds: string[]; saved: Att[] } {
  const { leave, plan, symbol } = p;
  const shiftOnly = isShiftLeave(leave as any);
  const note = `Nghỉ phép được duyệt: ${leave.type} (${symbol})${shiftOnly ? ` — ${shiftLabel(leave.shift)}` : ''}`;
  let att = [...p.attendance];
  const deletedIds: string[] = [];
  const saved: Att[] = [];
  const idxOf = (d: string) => att.findIndex(a => sameEmp(a, leave) && a.date === d);

  for (const d of plan.removed) {
    const i = idxOf(d);
    if (i < 0) continue;
    const r = att[i];
    const untouched = shiftOnly
      ? [r.timeInS, r.timeOutS, r.timeInC, r.timeOutC].every(v => !v) && (r.notes || '').startsWith('Nghỉ phép được duyệt')
      : [r.timeInS, r.timeOutS, r.timeInC, r.timeOutC].every(v => v === symbol);
    if (!untouched) continue;
    if (r.method === 'Hành chính phép') { deletedIds.push(r.id); att = att.filter((_, k) => k !== i); }
    else { att[i] = { ...r, timeInS: '', timeOutS: '', timeInC: '', timeOutC: '', status: 'valid', statusMsg: 'Hợp lệ', notes: '' }; saved.push(att[i]); }
  }

  for (const d of plan.added) {
    const i = idxOf(d);
    if (i >= 0) {
      att[i] = shiftOnly
        ? { ...att[i], notes: note }
        : { ...att[i], timeInS: symbol, timeOutS: symbol, timeInC: symbol, timeOutC: symbol, status: 'excused', notes: note };
      saved.push(att[i]);
    } else {
      const fill = shiftOnly ? '' : symbol;
      const row: Att = {
        id: p.newId(d), empId: leave.empId, empName: leave.empName, date: d,
        timeInS: fill, timeOutS: fill, timeInC: fill, timeOutC: fill, timeInOT: '', timeOutOT: '',
        method: 'Hành chính phép', status: shiftOnly ? 'valid' : 'excused', otHours: 0, notes: note,
      };
      att.unshift(row); saved.push(row);
    }
  }
  return { attendance: att, deletedIds, saved };
}
