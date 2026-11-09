import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import PayrollTab from '../tabs/PayrollTab';

afterEach(cleanup);

// Tab Lương (thiết kế mới): thanh công cụ, thẻ tổng hợp, bảng tóm tắt + thẻ điện thoại, bảng chi tiết, khóa kỳ.
const pay = (id: string, empId: string, name: string, over: any = {}) => ({
  id, empId, empName: name, month: '11/2026', baseSalary: 26000000, workedDays: 13, kpiBonus: 500000, allowance: 0,
  otSundaySalary: 100000, otHolidaySalary: 0, otHoursSalary: 50000, otHours: 3, advances: 1000000, insurance: 2000000, tax: 300000,
  netSalary: 9000000, locked: false, ...over,
}) as any;
const PAYROLL = [pay('P1', 'NV001', 'An Văn Bình'), pay('P2', 'NV002', 'Bùi Thị Cúc', { netSalary: 7000000 }), pay('P3', 'NV003', 'Khác kỳ', { month: '10/2026' })];

function setup(over: any = {}) {
  const props: any = {
    payroll: PAYROLL, employees: [{ id: 'NV001', name: 'An Văn Bình', position: 'Kỹ sư' }], payrollMonth: '11', setPayrollMonth: vi.fn(),
    payrollYear: '2026', setPayrollYear: vi.fn(), standardWorkDays: 26, setStandardWorkDays: vi.fn(), payrollViewMode: 'summary',
    setPayrollViewMode: vi.fn(), globalPageSize: 'all', setGlobalPageSize: vi.fn(), payrollPage: 1, setPayrollPage: vi.fn(),
    handleCalculatePayroll: vi.fn(), handleExportPayrollExcel: vi.fn(), handleOpenEditPayroll: vi.fn(), triggerDownloadPayslip: vi.fn(),
    handleLockPayrollPeriod: vi.fn(), handleDownloadAllPayslips: vi.fn(), addToast: vi.fn(), ...over,
  };
  return { props, ...render(<PayrollTab {...props} />) };
}

describe('Tab Lương — giao diện mới', () => {
  it('chỉ hiện lương của kỳ đang chọn; có bảng + thẻ; chức vụ lấy từ hồ sơ; tổng thực lĩnh đúng', () => {
    setup();
    expect(screen.getByTestId('payroll-table')).toBeTruthy();
    expect(screen.getByTestId('payroll-cards')).toBeTruthy();
    expect(screen.getByTestId('payroll-row-P1').textContent).toContain('Kỹ sư');
    expect(screen.queryByTestId('payroll-row-P3')).toBeNull();                     // kỳ 10/2026 bị ẩn
    expect(screen.getByTestId('payroll-summary').textContent).toContain('16.000.000');   // 9tr + 7tr
  });

  it('nút Tính lương / Xuất Excel / đổi kỳ / chế độ xem gọi đúng hàm', () => {
    const { props } = setup();
    fireEvent.click(screen.getByTestId('payroll-calc'));
    expect(props.handleCalculatePayroll).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('payroll-export'));
    expect(props.handleExportPayrollExcel).toHaveBeenCalled();
    fireEvent.change(screen.getByTestId('payroll-month'), { target: { value: '10' } });
    expect(props.setPayrollMonth).toHaveBeenCalledWith('10');
    fireEvent.click(screen.getByTestId('payroll-view-detail'));
    expect(props.setPayrollViewMode).toHaveBeenCalledWith('detail');
  });

  it('bấm dòng mở phần chi tiết (tạm ứng, bảo hiểm, thuế); Sửa / Phiếu gọi đúng hàm và không mở dòng', () => {
    const { props } = setup();
    expect(screen.queryByTestId('payroll-detail-P1')).toBeNull();
    fireEvent.click(screen.getByTestId('payroll-row-P1'));
    expect(screen.getAllByTestId('payroll-detail-P1')[0].textContent).toContain('Tạm ứng');
    fireEvent.click(screen.getAllByTestId('payroll-edit-P2')[0]);
    expect(props.handleOpenEditPayroll).toHaveBeenCalledWith(PAYROLL[1]);
    fireEvent.click(screen.getAllByTestId('payroll-slip-P2')[0]);
    expect(props.triggerDownloadPayslip).toHaveBeenCalledWith(PAYROLL[1]);
    expect(screen.queryByTestId('payroll-detail-P2')).toBeNull();
  });

  it('chế độ chi tiết hiện bảng worksheet (đủ cột, có Thuế TNCN)', () => {
    setup({ payrollViewMode: 'detail' });
    expect(screen.getByTestId('payroll-worksheet').textContent).toContain('Thuế TNCN');
    expect(screen.getByTestId('payroll-wrow-P1')).toBeTruthy();
    expect(screen.queryByTestId('payroll-table')).toBeNull();
  });

  it('khóa kỳ: chưa khóa → bấm Khóa (sau xác nhận) gọi hàm, Tải toàn bộ bị tắt; đã khóa → ngược lại', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { props, unmount } = setup();
    expect((screen.getByTestId('payroll-download-all') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('payroll-lock'));
    expect(props.handleLockPayrollPeriod).toHaveBeenCalled();
    unmount();
    setup({ payroll: PAYROLL.map(p => ({ ...p, locked: true })) });
    expect((screen.getByTestId('payroll-lock') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('payroll-download-all') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByTestId('payroll-lock-status').textContent).toContain('Đã khóa');
  });

  it('kỳ chưa có dữ liệu → thông báo trống; tìm tên không dấu lọc đúng', () => {
    const { unmount } = setup({ payrollMonth: '09' });
    expect(screen.getAllByTestId('payroll-empty').length).toBeGreaterThan(0);
    unmount();
    setup();
    fireEvent.change(screen.getByTestId('payroll-search'), { target: { value: 'cuc' } });
    expect(screen.queryByTestId('payroll-row-P1')).toBeNull();
    expect(screen.queryByTestId('payroll-row-P2')).toBeTruthy();
  });

  it('cảnh báo khi có dòng lương tính theo công chuẩn khác công chuẩn của tháng', () => {
    // 2 dòng chia 27 (đúng với std=27), 1 dòng chia 26 → lệch 1
    const mk = (id: string, spd: number) => ({ id, empId: id, empName: id, month: '11/2026', baseSalary: 6970000, kpiBonus: 6970000, salaryPerDay: spd, status: 'unpaid', workedDays: 26 }) as any;
    setup({ payroll: [mk('A', 516296.296), mk('B', 516296.296), mk('C', 536153.846)], standardWorkDays: 27 });
    expect(screen.getByTestId('payroll-std-mismatch').textContent).toContain('1');
    cleanup();
    setup({ payroll: [mk('A', 516296.296), mk('B', 516296.296)], standardWorkDays: 27 });
    expect(screen.queryByTestId('payroll-std-mismatch')).toBeNull();
  });
});
