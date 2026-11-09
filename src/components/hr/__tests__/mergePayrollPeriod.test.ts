import { describe, it, expect } from 'vitest';
import { mergePayrollPeriod } from '../hrCalculations';

// "Tính lương tự động" phải GỘP vào danh sách hiện có chứ không thay toàn bộ.
const row = (empId: string, month: string, extra: any = {}) => ({ id: `PL-${empId}-${month.replace('/', '')}`, empId, month, net: 0, ...extra });

describe('mergePayrollPeriod', () => {
  it('giữ nguyên dòng của tháng khác', () => {
    const all = [row('A', '09/2026'), row('A', '10/2026')];
    const out = mergePayrollPeriod(all, '10/2026', [row('A', '10/2026', { net: 5 })]);
    expect(out.find(r => r.month === '09/2026')).toBeTruthy();
    expect(out.filter(r => r.month === '10/2026')).toHaveLength(1);
    expect(out.find(r => r.month === '10/2026')!.net).toBe(5);      // dòng chưa khóa được thay bằng kết quả mới
  });

  it('dòng ĐÃ KHÓA của kỳ được giữ nguyên, không bị ghi đè', () => {
    const locked = row('A', '10/2026', { locked: true, lockedAt: 'x', net: 111 });
    const out = mergePayrollPeriod([locked, row('B', '10/2026')], '10/2026', [row('A', '10/2026', { net: 5 }), row('B', '10/2026', { net: 7 })]);
    const a = out.find(r => r.empId === 'A')!;
    expect(a.locked).toBe(true); expect(a.net).toBe(111);
    expect(out.find(r => r.empId === 'B')!.net).toBe(7);
  });

  it('nhân viên có dòng trong kỳ nhưng không nằm trong lần tính (vd. đã nghỉ) vẫn được giữ', () => {
    const out = mergePayrollPeriod([row('A', '10/2026'), row('GONE', '10/2026', { net: 9 })], '10/2026', [row('A', '10/2026')]);
    expect(out.map(r => r.empId).sort()).toEqual(['A', 'GONE']);
  });

  it('chưa có dòng nào → trả đúng các dòng mới; không trùng lặp khi tính lại 2 lần', () => {
    const first = mergePayrollPeriod([], '10/2026', [row('A', '10/2026')]);
    const second = mergePayrollPeriod(first, '10/2026', [row('A', '10/2026', { net: 3 })]);
    expect(second).toHaveLength(1); expect(second[0].net).toBe(3);
  });
});
