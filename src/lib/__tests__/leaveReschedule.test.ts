import { describe, it, expect } from 'vitest';
import { datesBetween, planLeaveReschedule, applyLeaveReschedule } from '../leaveReschedule';

// Đơn LR-515 thực tế: nghỉ không lương có xin phép, đã duyệt 23/10 → 24/10
const leave = (o: any = {}) => ({ id: 'LR-515', empId: 'NV014', empName: 'Nguyễn Thế Bình', type: 'Nghỉ không lương có xin phép', fromDate: '2026-10-23', toDate: '2026-10-24', daysCount: 2, status: 'approved', ...o });
const row = (date: string, o: any = {}) => ({ id: `AT-${date}`, empId: 'NV014', empName: 'Nguyễn Thế Bình', date, timeInS: 'P', timeOutS: 'P', timeInC: 'P', timeOutC: 'P', method: 'Hành chính phép', ...o });
const plan = (l: any, from: string, to: string, leaves: any[] = [l], attendance: any[] = []) => planLeaveReschedule({ leave: l, newFrom: from, newTo: to, leaves, attendance });

describe('datesBetween', () => {
  it('liệt kê đủ hai đầu, qua tháng', () => expect(datesBetween('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']));
  it('ngày sai → rỗng', () => expect(datesBetween('', '2026-10-30')).toEqual([]));
});

describe('planLeaveReschedule', () => {
  it('hoán 23–24/10 sang 24–25/10: bỏ 23, thêm 25, 2 ngày', () => {
    const p = plan(leave(), '2026-10-24', '2026-10-25');
    expect(p.error).toBeUndefined(); expect(p.removed).toEqual(['2026-10-23']); expect(p.added).toEqual(['2026-10-25']); expect(p.days).toBe(2);
  });
  it('chỉ đơn đã duyệt mới đổi được', () => expect(plan(leave({ status: 'pending' }), '2026-10-24', '2026-10-25').error).toBeTruthy());
  it('đến ngày < từ ngày / không đổi → lỗi', () => {
    expect(plan(leave(), '2026-10-25', '2026-10-24').error).toBeTruthy();
    expect(plan(leave(), '2026-10-23', '2026-10-24').error).toBeTruthy();
  });
  it('trùng đơn nghỉ khác của cùng nhân viên → lỗi, nêu mã đơn', () => {
    const other = leave({ id: 'LR-600', fromDate: '2026-10-26', toDate: '2026-10-27' });
    expect(plan(leave(), '2026-10-25', '2026-10-26', [leave(), other]).error).toContain('LR-600');
  });
  it('đơn của người khác cùng ngày không phải trùng', () => {
    const other = leave({ id: 'LR-600', empId: 'NV099', empName: 'Người Khác', fromDate: '2026-10-26', toDate: '2026-10-27' });
    expect(plan(leave(), '2026-10-25', '2026-10-26', [leave(), other]).error).toBeUndefined();
  });
  it('đơn nghỉ 1 ca: chỉ 1 ngày, khác ca cùng ngày không trùng, cùng ca thì trùng', () => {
    const morning = leave({ type: 'Nghỉ phép năm', shift: 'morning', fromDate: '2026-10-23', toDate: '2026-10-23', daysCount: 0.5 });
    const afternoon = leave({ id: 'LR-2', type: 'Nghỉ phép năm', shift: 'afternoon', fromDate: '2026-10-26', toDate: '2026-10-26', daysCount: 0.5 });
    const p = plan(morning, '2026-10-26', '2026-10-30', [morning, afternoon]);
    expect(p.error).toBeUndefined(); expect(p.added).toEqual(['2026-10-26']); expect(p.days).toBe(0.5);
    const sameShift = { ...afternoon, shift: 'morning' };
    expect(plan(morning, '2026-10-26', '2026-10-26', [morning, sameShift]).error).toContain('LR-2');
  });
  it('báo ngày đã chốt công và ngày mới đã có giờ chấm', () => {
    const att = [row('2026-10-23', { isLocked: true }), row('2026-10-25', { timeInS: '07:30', timeOutS: '11:30', timeInC: '13:00', timeOutC: '17:00' })];
    const p = plan(leave(), '2026-10-24', '2026-10-25', [leave()], att);
    expect(p.lockedDates).toEqual(['2026-10-23']); expect(p.punchedAdded).toEqual(['2026-10-25']);
  });
});

describe('applyLeaveReschedule', () => {
  const run = (att: any[], from = '2026-10-24', to = '2026-10-25') => {
    const l = leave(); const pl = plan(l, from, to, [l], att);
    return applyLeaveReschedule({ leave: l, plan: pl, attendance: att, symbol: 'P', newId: d => `NEW-${d}` });
  };
  it('ngày cũ do việc duyệt tạo ra (còn nguyên ký hiệu) → xóa dòng; ngày mới → tạo dòng nghỉ', () => {
    const r = run([row('2026-10-23'), row('2026-10-24')]);
    expect(r.deletedIds).toEqual(['AT-2026-10-23']);
    expect(r.attendance.find(a => a.date === '2026-10-23')).toBeUndefined();
    const added = r.attendance.find(a => a.date === '2026-10-25')!;
    expect(added.timeInS).toBe('P'); expect(added.status).toBe('excused'); expect(added.method).toBe('Hành chính phép');
  });
  it('ngày cũ đã được HR sửa giờ tay (như 23/10 của NV014) → giữ nguyên, không đụng', () => {
    const edited = row('2026-10-23', { timeInS: '07:30', timeOutS: '11:30', timeInC: '13:00', timeOutC: '17:00' });
    const r = run([edited, row('2026-10-24')]);
    expect(r.deletedIds).toEqual([]);
    expect(r.attendance.find(a => a.date === '2026-10-23')).toEqual(edited);
  });
  it('dòng ngày cũ có sẵn từ trước (không phải do duyệt tạo) → xóa ký hiệu về trống, không xóa dòng', () => {
    const r = run([row('2026-10-23', { method: 'GPS/FaceID' }), row('2026-10-24')]);
    const back = r.attendance.find(a => a.date === '2026-10-23')!;
    expect(back.timeInS).toBe(''); expect(back.status).toBe('valid'); expect(r.deletedIds).toEqual([]);
  });
  it('ngày mới đã có dòng chấm công → ghi ký hiệu nghỉ lên dòng đó', () => {
    const r = run([row('2026-10-24'), { id: 'X', empId: 'NV014', empName: 'Nguyễn Thế Bình', date: '2026-10-25', timeInS: '--:--', timeOutS: '--:--', timeInC: '--:--', timeOutC: '--:--' }]);
    expect(r.attendance.find(a => a.id === 'X')!.timeInS).toBe('P');
  });
});
