import { describe, it, expect } from 'vitest';
import { supportsShiftLeave, isShiftLeave, leaveDaysCount, leaveSymbolOf, approvedShiftLeavesOnDay, shiftLeaveBadge, shiftLeaveFullLabel, shiftLabel } from '../leaveShift';

describe('Nghỉ phép theo ca', () => {
  it('chỉ nghỉ phép năm và nghỉ không lương có xin phép cho chọn 1 ca', () => {
    expect(supportsShiftLeave('Nghỉ phép năm')).toBe(true);
    expect(supportsShiftLeave('Nghỉ không lương có xin phép')).toBe(true);
    expect(supportsShiftLeave('Nghỉ hiếu hĩ/ma chay')).toBe(false);
    expect(supportsShiftLeave('Nghỉ cưới')).toBe(false);
    expect(supportsShiftLeave(undefined)).toBe(false);
  });
  it('số ngày: nghỉ 1 ca = 0,5; cả ngày/nhiều ngày = số ngày lịch', () => {
    expect(leaveDaysCount('2026-10-10', '2026-10-10', 'morning')).toBe(0.5);
    expect(leaveDaysCount('2026-10-10', '2026-10-10', 'afternoon')).toBe(0.5);
    expect(leaveDaysCount('2026-10-10', '2026-10-10')).toBe(1);
    expect(leaveDaysCount('2026-10-10', '2026-10-12')).toBe(3);
    expect(leaveDaysCount('2026-10-12', '2026-10-10')).toBe(0);
  });
  it('báo cáo chấm công có shift KHÔNG phải đơn nghỉ theo ca', () => {
    expect(isShiftLeave({ type: 'Báo cáo nghỉ ca', shift: 'morning' })).toBe(false);
    expect(isShiftLeave({ type: 'Nghỉ phép năm', shift: 'morning' })).toBe(true);
    expect(isShiftLeave({ type: 'Nghỉ phép năm' })).toBe(false);
  });
  it('ký hiệu & nhãn hiển thị', () => {
    expect(leaveSymbolOf('Nghỉ phép năm')).toBe('PN'); expect(leaveSymbolOf('Nghỉ không lương có xin phép')).toBe('P');
    expect(shiftLeaveBadge({ type: 'Nghỉ phép năm', shift: 'morning' })).toBe('PN·S');
    expect(shiftLeaveBadge({ type: 'Nghỉ không lương có xin phép', shift: 'afternoon' })).toBe('P·C');
    expect(shiftLeaveFullLabel({ type: 'Nghỉ phép năm', shift: 'afternoon' })).toBe('Nghỉ phép năm — ca chiều');
    expect(shiftLabel('morning')).toBe('ca sáng');
  });
  it('tìm đơn 1 ca đã duyệt của đúng nhân viên, đúng ngày', () => {
    const l = (o: any) => ({ id: 'a', type: 'Nghỉ phép năm', status: 'approved', shift: 'morning', empId: 'NV1', fromDate: '2026-10-10', toDate: '2026-10-10', ...o });
    const list = [l({}), l({ id: 'b', empId: 'NV2' }), l({ id: 'c', status: 'pending' }), l({ id: 'd', fromDate: '2026-10-11', toDate: '2026-10-11' }), l({ id: 'e', shift: undefined })];
    expect(approvedShiftLeavesOnDay(list, { empId: 'NV1' }, '2026-10-10').map(x => x.id)).toEqual(['a']);
  });
});
