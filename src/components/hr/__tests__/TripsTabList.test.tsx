import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import TripsTab from '../tabs/TripsTab';

afterEach(cleanup);

// Tab Công tác phí (thiết kế mới): thanh công cụ, chip trạng thái, thẻ tổng hợp, bảng + thẻ, duyệt theo quyền, sửa/xóa.
const trip = (rowId: string, status: string, over: any = {}) => ({
  id: rowId, rowId, code: 'CTP-' + rowId, employeeName: 'Nhân viên ' + rowId, amount: 500000, period: '11/2026', completedDate: '05/11/2026',
  projectName: 'Dự án A', customerName: 'Khách X', taskName: 'Việc 1', missionName: 'NV 1', content: 'Xăng xe ' + rowId, status, ...over,
}) as any;
const ITEMS = [trip('1', 'pending'), trip('2', 'approved', { amount: 300000 }), trip('3', 'rejected'), trip('4', 'completed', { amount: 200000 })];

function setup(over: any = {}) {
  const props: any = {
    travelExpensesSummary: ITEMS, selectedEmpFilter: 'all', setSelectedEmpFilter: vi.fn(), selectedMonthFilter: 'all', setSelectedMonthFilter: vi.fn(),
    selectedYearFilter: 'all', setSelectedYearFilter: vi.fn(), selectedProjectFilter: 'all', setSelectedProjectFilter: vi.fn(),
    handleExportExcel: vi.fn(), setClearingState: vi.fn(), onApproveTravelExpense: vi.fn(), canApprove: true,
    onDeleteTravelExpenses: vi.fn(), onEditTravelExpense: vi.fn(), onAddTravelExpense: vi.fn(), projectNames: ['Dự án A', 'Dự án B'], ...over,
  };
  return { props, ...render(<TripsTab {...props} />) };
}

describe('Công tác phí — giao diện mới', () => {
  it('có bảng + thẻ; chip trạng thái có số lượng ("completed" tính là Đã duyệt); thẻ tổng tiền đúng', () => {
    setup();
    expect(screen.getByTestId('trips-table')).toBeTruthy();
    expect(screen.getByTestId('trips-cards')).toBeTruthy();
    expect(screen.getByTestId('trips-chip-all').textContent).toContain('4');
    expect(screen.getByTestId('trips-chip-pending').textContent).toContain('1');
    expect(screen.getByTestId('trips-chip-approved').textContent).toContain('2');
    expect(screen.getByTestId('trips-summary').textContent).toContain('1.500.000');   // 500k+300k+500k+200k
  });

  it('bấm chip "Chờ duyệt" chỉ còn khoản chờ duyệt', () => {
    setup();
    fireEvent.click(screen.getByTestId('trips-chip-pending'));
    expect(screen.queryByTestId('trip-row-1')).toBeTruthy();
    expect(screen.queryByTestId('trip-row-2')).toBeNull();
    expect(screen.queryByTestId('trip-row-4')).toBeNull();
  });

  it('nút Thêm / Xuất Excel gọi đúng hàm; không truyền onAddTravelExpense thì ẩn nút Thêm; đổi tháng gọi setter', () => {
    const { props, unmount } = setup();
    fireEvent.click(screen.getByTestId('trips-add'));
    expect(props.onAddTravelExpense).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('trips-export'));
    expect(props.handleExportExcel).toHaveBeenCalled();
    fireEvent.change(screen.getByTestId('trips-month'), { target: { value: '11' } });
    expect(props.setSelectedMonthFilter).toHaveBeenCalledWith('11');
    unmount();
    setup({ onAddTravelExpense: undefined });
    expect(screen.queryByTestId('trips-add')).toBeNull();
  });

  it('Duyệt / Từ chối chỉ hiện khi khoản chờ duyệt và có quyền; bấm gọi đúng hàm', () => {
    const { props, unmount } = setup();
    expect(screen.queryAllByTestId('trip-approve-2').length).toBe(0);       // đã duyệt → không có nút
    fireEvent.click(screen.getAllByTestId('trip-approve-1')[0]);
    expect(props.onApproveTravelExpense).toHaveBeenCalledWith('1', 'approved');
    fireEvent.click(screen.getAllByTestId('trip-reject-1')[0]);
    expect(props.onApproveTravelExpense).toHaveBeenCalledWith('1', 'rejected');
    unmount();
    setup({ canApprove: false });
    expect(screen.queryAllByTestId('trip-approve-1').length).toBe(0);
  });

  it('Sửa mở hộp, Lưu gọi onEditTravelExpense; Xóa (sau xác nhận) gọi onDeleteTravelExpenses; tick chọn hiện thanh hàng loạt', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { props } = setup();
    fireEvent.click(screen.getAllByTestId('trip-edit-2')[0]);
    fireEvent.change(screen.getByTestId('trips-edit-amount'), { target: { value: '450000' } });
    fireEvent.click(screen.getByTestId('trips-edit-save'));
    expect(props.onEditTravelExpense).toHaveBeenCalledWith('2', { content: 'Xăng xe 2', amount: 450000 });
    fireEvent.click(screen.getAllByTestId('trip-delete-3')[0]);
    expect(props.onDeleteTravelExpenses).toHaveBeenCalledWith(['3']);
    expect(screen.queryByTestId('trips-bulkbar')).toBeNull();
    fireEvent.click(screen.getAllByLabelText('Chọn CTP-1')[0]);
    expect(screen.getByTestId('trips-bulkbar').textContent).toContain('Đã chọn 1');
  });

  it('danh sách rỗng / không khớp bộ lọc hiện thông báo tương ứng', () => {
    const { unmount } = setup({ travelExpensesSummary: [] });
    expect(screen.getByTestId('trips-empty')).toBeTruthy();
    unmount();
    setup({ selectedEmpFilter: 'Người không tồn tại' });
    expect(screen.getByTestId('trips-empty-filter')).toBeTruthy();
  });
});
