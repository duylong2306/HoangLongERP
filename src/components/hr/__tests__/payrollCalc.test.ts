import { describe, it, expect } from 'vitest';
import {
  calculateScoreFromErrorCount,
  sumApprovedTravelExpenses,
  calculateSingleEmployeePayroll,
} from '../hrCalculations';

// ─── Hiệu suất % theo số lỗi ───────────────────────────────────────────────
describe('calculateScoreFromErrorCount — bảng điểm hiệu suất dùng chung', () => {
  it('0 lỗi → 100%, 1 → 97%, 2 → 95%, 3 → 90%, 4 → 85%, 5 → 80%, ≥6 → 50%', () => {
    expect(calculateScoreFromErrorCount(0)).toBe(100);
    expect(calculateScoreFromErrorCount(1)).toBe(97);
    expect(calculateScoreFromErrorCount(2)).toBe(95);
    expect(calculateScoreFromErrorCount(3)).toBe(90);
    expect(calculateScoreFromErrorCount(4)).toBe(85);
    expect(calculateScoreFromErrorCount(5)).toBe(80);
    expect(calculateScoreFromErrorCount(6)).toBe(50);
    expect(calculateScoreFromErrorCount(20)).toBe(50);
  });
});

// ─── Tổng Công Tác Phí Đã Duyệt theo kỳ lương ──────────────────────────────
describe('sumApprovedTravelExpenses — CTP đã duyệt trong tháng-năm', () => {
  const emp = { id: 'NV001', name: 'Nguyễn Văn A' };

  it('chỉ cộng CTP approved HOẶC completed (legacy đã duyệt), bỏ qua pending/rejected', () => {
    const ctp = [
      { status: 'approved',  empId: 'NV001', completedDate: '10/08/2026', amount: 200000 },
      { status: 'completed', empId: 'NV001', completedDate: '11/08/2026', amount: 150000 }, // legacy
      { status: 'pending',   empId: 'NV001', completedDate: '12/08/2026', amount: 500000 },
      { status: 'rejected',  empId: 'NV001', completedDate: '13/08/2026', amount: 700000 },
    ];
    expect(sumApprovedTravelExpenses(ctp, emp, '08', '2026')).toBe(350000);
  });

  it('chỉ cộng trong đúng tháng-năm của kỳ lương (dd/mm/yyyy)', () => {
    const ctp = [
      { status: 'approved', empId: 'NV001', completedDate: '31/07/2026', amount: 100000 }, // tháng trước
      { status: 'approved', empId: 'NV001', completedDate: '01/08/2026', amount: 200000 }, // đúng tháng
      { status: 'approved', empId: 'NV001', completedDate: '10/08/2026', amount: 300000 }, // đúng tháng
      { status: 'approved', empId: 'NV001', completedDate: '10/08/2027', amount: 400000 }, // sai năm
    ];
    expect(sumApprovedTravelExpenses(ctp, emp, '08', '2026')).toBe(500000);
  });

  it('match theo empId khi có; fallback theo employeeName cho dữ liệu cũ', () => {
    const ctp = [
      { status: 'approved', empId: 'NV001',  employeeName: 'Nguyễn Văn A', completedDate: '10/08/2026', amount: 100000 },
      // không có empId (dữ liệu cũ) → khớp bằng tên
      { status: 'approved', employeeName: 'Nguyễn Văn A', completedDate: '11/08/2026', amount: 200000 },
      // tên khác → không khớp
      { status: 'approved', employeeName: 'Trần Văn B', completedDate: '12/08/2026', amount: 900000 },
    ];
    expect(sumApprovedTravelExpenses(ctp, emp, '08', '2026')).toBe(300000);
  });

  it('không bỏ sót khoản amount=0; mảng rỗng → 0', () => {
    expect(sumApprovedTravelExpenses([], emp, '08', '2026')).toBe(0);
    const ctp = [
      { status: 'approved', empId: 'NV001', completedDate: '10/08/2026', amount: 0 },
      { status: 'approved', empId: 'NV001', completedDate: '11/08/2026', amount: 150000 },
    ];
    expect(sumApprovedTravelExpenses(ctp, emp, '08', '2026')).toBe(150000);
  });
});

// ─── Tính lương 1 nhân viên: expenses & kpiScore thấm vào kết quả ──────────
describe('calculateSingleEmployeePayroll — CTP & KPI đi vào lương', () => {
  const emp = { id: 'NV001', name: 'Nguyễn Văn A', salaryCode: 'S1' };
  const scales = [{ id: 'S1', baseSalary: 6000000, performanceSalary: 2000000 }];

  it('kpiScore 100 → Thưởng KPI = performanceSalary; 90 → 90% performanceSalary', () => {
    const baseInputs = {
      workedDays: 26, otSunday: 0, otHoliday: 0, otHours: 0, otCount: 0,
      bonusHoliday: 0, bonusCreative: 0, otherDeductions: 0, advances: 0, expenses: 0,
    };
    const p100 = calculateSingleEmployeePayroll(emp, '08/2026', { ...baseInputs, kpiScore: 100 }, scales, 26);
    const p90 = calculateSingleEmployeePayroll(emp, '08/2026', { ...baseInputs, kpiScore: 90 }, scales, 26);

    expect(p100.kpiBonus).toBe(2000000);
    expect(p90.kpiBonus).toBe(1800000);
    // lương ngày chuẩn tăng theo kpiBonus
    expect(p90.salaryPerDay).toBe((6000000 + 1800000) / 26);
  });

  it('expenses (CTP đã duyệt) được cộng thẳng vào Tổng thu nhập', () => {
    const base = {
      workedDays: 26, kpiScore: 100, otSunday: 0, otHoliday: 0, otHours: 0, otCount: 0,
      bonusHoliday: 0, bonusCreative: 0, otherDeductions: 0, advances: 0,
    };
    const p0 = calculateSingleEmployeePayroll(emp, '08/2026', { ...base, expenses: 0 }, scales, 26);
    const pCtp = calculateSingleEmployeePayroll(emp, '08/2026', { ...base, expenses: 500000 }, scales, 26);

    expect(pCtp.totalIncome - p0.totalIncome).toBe(500000);
    expect(pCtp.netSalary - p0.netSalary).toBe(500000);
  });
});
