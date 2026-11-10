import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import HrDataTab from '../tabs/HrDataTab';

afterEach(cleanup);

// Tab "Dữ liệu nhân sự" (thiết kế mới): chip 6 danh mục, thanh công cụ gọn, bảng + thẻ, xóa hàng loạt.
const HOLIDAYS: any[] = [{ id: 'NL1', date: '02/09/2026', name: 'Quốc khánh' }, { id: 'NL2', date: '01/01/2026', name: 'Tết dương lịch' }];
const COEFS: any[] = [{ id: 'HS1', type: 'Đi làm', isAuto: true, coefficient: 1 }, { id: 'HS2', type: 'Nghỉ phép', isAuto: false, coefficient: 0.5 }];
const CRIT: any[] = [{ departmentId: 'dept_all', criteria: [{ id: 'TC1', category: 'readiness', content: 'Đi muộn' }, { id: 'TC2', category: 'progress', content: 'Trễ tiến độ' }] }];
const SCALES: any[] = [{ id: 'QLDH1', groupCode: 'QLDH', groupName: 'Quản lý', level: '1', levelName: 'Bậc 1', baseSalary: 8000000, allocationRate: 60, performanceSalary: 5000000, totalSalary: 13000000 }];
const EMPS: any[] = [
  { id: 'NV1', name: 'An Văn Bình', department: 'Kế toán', position: 'KT', bhxhBookNo: 'SHX1', salaryCode: 'QLDH1' },
  { id: 'NV2', name: 'Bùi Thị Cúc', department: 'Kế toán', position: 'KT', salaryCode: 'QLDH1' },
];
const NORMS: any[] = [{ id: 'CTP1', code: 'A1', content: 'Phụ cấp ăn', quantity: 1, unitPrice: 100000 }];

function setup(sub: string, over: any = {}) {
  const props: any = {
    activeHrDataSubTab: sub, setActiveHrDataSubTab: vi.fn(), attendanceInitDate: new Date(), setAttendanceInitDate: vi.fn(),
    holidays: HOLIDAYS, setHolidays: vi.fn(), holidaySearchQuery: '', setHolidaySearchQuery: vi.fn(), setShowHolidayModal: vi.fn(), handleDeleteHoliday: vi.fn(), onEditHoliday: vi.fn(),
    leaveCoefficients: COEFS, setLeaveCoefficients: vi.fn(), coefSearchQuery: '', setCoefSearchQuery: vi.fn(), setShowCoefModal: vi.fn(), handleToggleCoefficientAuto: vi.fn(), handleDeleteCoefficient: vi.fn(),
    departmentCriteria: CRIT, setDepartmentCriteria: vi.fn(), criteriaSearchQuery: '', setCriteriaSearchQuery: vi.fn(), setEditingCritId: vi.fn(), setEditingCritDeptId: vi.fn(), setNewCritContent: vi.fn(), setNewCritCategory: vi.fn(), setShowCriteriaModal: vi.fn(), handleEditCriteriaTrigger: vi.fn(), handleDeleteCriteria: vi.fn(),
    removeVietnameseTones: (s: string) => (s || '').toLowerCase(),
    salaryScales: SCALES, setSalaryScales: vi.fn(), salaryScalesSearch: '', setSalaryScalesSearch: vi.fn(), selectedGroupFilter: 'all', setSelectedGroupFilter: vi.fn(), handleResetSalaryScales: vi.fn(), handleAddNewSalaryScaleClick: vi.fn(), handleEditSalaryScaleClick: vi.fn(), handleDeleteSalaryScale: vi.fn(),
    employees: EMPS, setEmployees: vi.fn(), addToast: vi.fn(), insSearchText: '', setInsSearchText: vi.fn(), insDeptFilter: 'all', setInsDeptFilter: vi.fn(), insBookFilter: 'all', setInsBookFilter: vi.fn(),
    setEditingInsEmpId: vi.fn(), setInsBookNo: vi.fn(), setInsSalary: vi.fn(), setInsRate: vi.fn(), setInsPersonalRelief: vi.fn(), setInsDependentCount: vi.fn(), setInsDate: vi.fn(), setShowInsModal: vi.fn(),
    travelNorms: NORMS, setTravelNorms: vi.fn(), travelNormSearch: '', setTravelNormSearch: vi.fn(), handleAddTravelNormClick: vi.fn(), handleEditTravelNormClick: vi.fn(), handleDeleteTravelNorm: vi.fn(), ...over,
  };
  return { props, ...render(<HrDataTab {...props} />) };
}

describe('Dữ liệu nhân sự — giao diện mới', () => {
  it('chip 6 danh mục kèm số lượng; bấm chip gọi đổi danh mục', () => {
    const { props } = setup('holidays');
    const chips = screen.getByTestId('hrdata-chips');
    expect(chips.textContent).toContain('Ngày nghỉ lễ'); expect(chips.textContent).toContain('Định mức công tác phí');
    expect(screen.getByTestId('hrdata-chip-holidays').textContent).toContain('2');
    fireEvent.click(screen.getByTestId('hrdata-chip-salary_scales'));
    expect(props.setActiveHrDataSubTab).toHaveBeenCalledWith('salary_scales');
  });

  it('Ngày nghỉ lễ: sắp theo ngày tăng dần; Thêm/Sửa/Xóa gọi đúng; tìm kiếm gọi setter', () => {
    const { props } = setup('holidays');
    const rows = within(screen.getByTestId('hrdata-table')).getAllByRole('row').slice(1);
    expect(rows[0].textContent).toContain('Tết dương lịch');     // 01/01 trước 02/09
    fireEvent.click(screen.getByTestId('hrdata-add'));
    expect(props.setShowHolidayModal).toHaveBeenCalledWith(true);
    fireEvent.click(within(screen.getByTestId('hrdata-row-NL1')).getByLabelText('Sửa ngày nghỉ'));
    expect(props.onEditHoliday).toHaveBeenCalledWith(HOLIDAYS[0]);
    fireEvent.click(within(screen.getByTestId('hrdata-row-NL1')).getByLabelText('Xóa ngày nghỉ'));
    expect(props.handleDeleteHoliday).toHaveBeenCalledWith('NL1');
    fireEvent.change(screen.getByTestId('hrdata-search'), { target: { value: 'tết' } });
    expect(props.setHolidaySearchQuery).toHaveBeenCalledWith('tết');
  });

  it('phân trang: 25 ngày nghỉ lễ → trang 1 có 10 dòng, sang trang 2 có 10, đổi 5 dòng/trang, "Tất cả" hiện đủ', () => {
    const many: any[] = Array.from({ length: 25 }, (_, i) => ({ id: `NLX${i + 1}`, date: `${String((i % 28) + 1).padStart(2, '0')}/05/2026`, name: `Dịp ${i + 1}` }));
    setup('holidays', { holidays: many });
    const rowsCount = () => within(screen.getByTestId('hrdata-table')).getAllByRole('row').length - 1;
    expect(rowsCount()).toBe(10);
    expect(screen.getByTestId('hrdata-pager-range').textContent).toContain('1–10');
    fireEvent.click(screen.getByTestId('hrdata-pager-next'));
    expect(screen.getByTestId('hrdata-pager-range').textContent).toContain('11–20');
    fireEvent.change(screen.getByTestId('hrdata-pager-size'), { target: { value: '5' } });
    expect(rowsCount()).toBe(5);
    expect(screen.getByTestId('hrdata-pager-range').textContent).toContain('1–5');   // đổi số dòng → về trang 1
    fireEvent.change(screen.getByTestId('hrdata-pager-size'), { target: { value: '-1' } });
    expect(rowsCount()).toBe(25);
  });

  it('không có kết quả → thông báo trống', () => {
    setup('holidays', { holidaySearchQuery: 'khôngcó' });
    expect(screen.getByTestId('hrdata-empty')).toBeTruthy();
  });

  it('Hệ số chấm công: công tắc tự động và sửa hệ số tại chỗ', () => {
    const { props } = setup('coefficients');
    fireEvent.click(screen.getAllByTestId('hrdata-auto-HS2')[0]);   // jsdom render cả bảng lẫn thẻ
    expect(props.handleToggleCoefficientAuto).toHaveBeenCalledWith('HS2');
    fireEvent.change(screen.getAllByTestId('hrdata-coef-HS1')[0], { target: { value: '2' } });
    expect(props.setLeaveCoefficients).toHaveBeenCalled();
  });

  it('Tiêu chí: pill nhóm đúng; nút thêm đặt lại form rồi mở hộp', () => {
    const { props } = setup('criteria');
    expect(screen.getByTestId('hrdata-row-TC2').textContent).toContain('Hiệu suất & Tiến độ');
    fireEvent.click(screen.getByTestId('hrdata-add'));
    expect(props.setEditingCritId).toHaveBeenCalledWith(null);
    expect(props.setNewCritCategory).toHaveBeenCalledWith('readiness');
    expect(props.setShowCriteriaModal).toHaveBeenCalledWith(true);
  });

  it('Bậc lương: hiện đủ số tiền; lọc ngạch và "Khôi phục mẫu" gọi đúng', () => {
    const { props } = setup('salary_scales');
    const row = screen.getByTestId('hrdata-row-QLDH1').textContent!;
    expect(row).toContain('8.000.000'); expect(row).toContain('13.000.000');
    fireEvent.change(screen.getByTestId('hrdata-group-filter'), { target: { value: 'KTTC' } });
    expect(props.setSelectedGroupFilter).toHaveBeenCalledWith('KTTC');
    fireEvent.click(screen.getByTestId('hrdata-reset-scales'));
    expect(props.handleResetSalaryScales).toHaveBeenCalled();
  });

  it('BHXH: 4 ô tổng; người chưa có sổ hiện "Chưa có sổ"; Thiết lập mở hộp với dữ liệu; Đăng ký nhanh cấp sổ', () => {
    const { props } = setup('insurance');
    expect(screen.getByTestId('hrdata-ins-tiles').textContent).toContain('1/2');
    expect(screen.getByTestId('hrdata-row-NV2').textContent).toContain('Chưa có sổ');
    fireEvent.click(screen.getByTestId('hrdata-ins-edit-NV1'));
    expect(props.setEditingInsEmpId).toHaveBeenCalledWith('NV1'); expect(props.setShowInsModal).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByTestId('hrdata-add'));            // "Đăng ký nhanh"
    expect(props.setEmployees).toHaveBeenCalled();
    const updated = props.setEmployees.mock.calls[0][0];
    expect(updated.find((e: any) => e.id === 'NV2').bhxhBookNo).toMatch(/^SHX260/);
    expect(updated.find((e: any) => e.id === 'NV1').bhxhBookNo).toBe('SHX1');    // người đã có sổ giữ nguyên
  });

  it('Định mức công tác phí: hiện mã, đơn giá; Sửa/Xóa gọi đúng', () => {
    const { props } = setup('travel_norms');
    expect(screen.getByTestId('hrdata-row-CTP1').textContent).toContain('100.000');
    fireEvent.click(within(screen.getByTestId('hrdata-row-CTP1')).getByLabelText('Sửa định mức'));
    expect(props.handleEditTravelNormClick).toHaveBeenCalledWith(NORMS[0]);
    fireEvent.click(within(screen.getByTestId('hrdata-row-CTP1')).getByLabelText('Xóa định mức'));
    expect(props.handleDeleteTravelNorm).toHaveBeenCalledWith('CTP1');
  });

  it('tích dòng → hiện thanh xóa hàng loạt; xác nhận thì xóa đúng dòng đã chọn', () => {
    const { props } = setup('holidays');
    expect(screen.queryByTestId('hrdata-bulk')).toBeNull();
    fireEvent.click(within(screen.getByTestId('hrdata-row-NL1')).getByRole('checkbox'));
    expect(screen.getByTestId('hrdata-bulk').textContent).toContain('Đã chọn 1');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByTestId('hrdata-bulk-delete'));
    expect(props.setHolidays).toHaveBeenCalledWith([HOLIDAYS[1]]);
  });
});
