import { describe, it, expect } from 'vitest';
import { defaultStandardWorkDays, inferStandardWorkDays, pickMonthStandardWorkDays, countStandardMismatch, calculateSingleEmployeePayroll } from '../hrCalculations';

// Công chuẩn theo THÁNG (không còn là state tạm mặc định 26): xem chú thích ở hrCalculations.ts.
describe('defaultStandardWorkDays — mặc định theo lịch', () => {
  it('10/2026: 31 ngày, 4 Chủ nhật → 27', () => expect(defaultStandardWorkDays(10, 2026, [0])).toBe(27));
  it('11/2026: 30 ngày, 5 Chủ nhật → 25', () => expect(defaultStandardWorkDays(11, 2026, [0])).toBe(25));
  it('02/2026: 28 ngày, 4 Chủ nhật → 24', () => expect(defaultStandardWorkDays(2, 2026, [0])).toBe(24));
  it('nghỉ cả T7 + CN: 10/2026 có 5 T7 + 4 CN → 22', () => expect(defaultStandardWorkDays(10, 2026, [0, 6])).toBe(22));
});

describe('suy ra công chuẩn từ dòng lương đã tính (số liệu thật từ ảnh kỳ 10/2026)', () => {
  const nv011 = { baseSalary: 6970000, kpiBonus: 6970000, salaryPerDay: 516296.296 };   // 13.940.000 / 27
  const nv012 = { baseSalary: 6970000, kpiBonus: 6970000, salaryPerDay: 536153.846 };   // 13.940.000 / 26
  const nv013 = { baseSalary: 6640000, kpiBonus: 6308000, salaryPerDay: 498000 };        // 12.948.000 / 26
  it('NV011 → 27, NV012 → 26, NV013 → 26', () => {
    expect(inferStandardWorkDays(nv011)).toBe(27);
    expect(inferStandardWorkDays(nv012)).toBe(26);
    expect(inferStandardWorkDays(nv013)).toBe(26);
  });
  it('thiếu salaryPerDay hoặc không ra số nguyên → null (không rõ)', () => {
    expect(inferStandardWorkDays({ baseSalary: 5000000, kpiBonus: 0 })).toBeNull();
    expect(inferStandardWorkDays({ baseSalary: 5000000, kpiBonus: 0, salaryPerDay: 123456 })).toBeNull();
    expect(inferStandardWorkDays(null)).toBeNull();
  });
  it('công chuẩn của tháng = giá trị phổ biến nhất; đếm đúng số dòng lệch', () => {
    const rows = [nv011, nv011, nv011, nv012, nv013];
    expect(pickMonthStandardWorkDays(rows)).toBe(27);
    expect(countStandardMismatch(rows, 27)).toBe(2);   // NV012 + NV013 đang chia 26
    expect(countStandardMismatch(rows, 26)).toBe(3);
    expect(pickMonthStandardWorkDays([])).toBeNull();
  });
  it('tính lại cùng công chuẩn → 2 người cùng mức lương ra cùng lương ngày chuẩn', () => {
    const scales = [{ id: 'X', baseSalary: 6970000, performanceSalary: 6970000 }];
    const inputs = { workedDays: 26.5, kpiScore: 100, otSunday: 0, otHoliday: 0, otHours: 0, otCount: 0, bonusHoliday: 0, bonusCreative: 0, otherDeductions: 0, advances: 0, expenses: 0 };
    const a = calculateSingleEmployeePayroll({ id: 'A', salaryCode: 'X' }, '10/2026', inputs, scales, 27);
    const b = calculateSingleEmployeePayroll({ id: 'B', salaryCode: 'X' }, '10/2026', inputs, scales, 27);
    expect(a.salaryPerDay).toBeCloseTo(516296.296, 2);
    expect(b.salaryPerDay).toBeCloseTo(a.salaryPerDay, 6);
    expect(inferStandardWorkDays(a as any)).toBe(27);
  });
});
