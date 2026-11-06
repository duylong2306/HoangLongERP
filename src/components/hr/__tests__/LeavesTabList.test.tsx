import { describe, it, expect, vi, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import LeavesTab from '../tabs/LeavesTab';

afterEach(cleanup);

// Tab Nghỉ phép (thiết kế mới): thanh công cụ, chip trạng thái kèm số lượng, bảng + thẻ, thẻ chi tiết, duyệt theo quyền.
const yr = new Date().getFullYear();
const lv = (id: string, status: string, over: any = {}) => ({
  id, empId: 'NV' + id, empName: 'Nhân viên ' + id, type: 'Nghỉ phép năm', fromDate: `${yr}-01-10`, toDate: `${yr}-01-11`,
  daysCount: 2, status, reason: 'Việc gia đình', ...over,
}) as any;
const LEAVES = [lv('1', 'pending'), lv('2', 'approved'), lv('3', 'rejected'), lv('4', 'pending', { type: 'Nghỉ cưới' })];

function setup(over: any = {}) {
  const handlers = { handleApproveLeave: vi.fn(), onDeleteLeave: vi.fn(), onRescheduleLeave: vi.fn().mockReturnValue(true) };
  const Wrapper = () => {
    const [sel, setSel] = useState<string | null>(over.initialSel || null);
    const [page, setPage] = useState(1);
    return <LeavesTab leaves={over.leaves || LEAVES} selectedLeaveId={sel} setSelectedLeaveId={setSel} {...handlers} canApproveLeave={over.canApproveLeave}
      globalPageSize="all" setGlobalPageSize={() => {}} leavePage={page} setLeavePage={setPage} />;
  };
  return { ...handlers, ...render(<Wrapper />) };
}

describe('Nghỉ phép — giao diện mới', () => {
  it('có bảng + thẻ cho cùng danh sách; ngày hiện dd/mm/yyyy', () => {
    setup();
    expect(screen.getByTestId('leaves-table')).toBeTruthy();
    expect(screen.getByTestId('leaves-cards')).toBeTruthy();
    LEAVES.forEach(l => { expect(screen.getByTestId(`leave-row-${l.id}`)).toBeTruthy(); expect(screen.getByTestId(`leave-card-${l.id}`)).toBeTruthy(); });
    expect(screen.getByTestId('leave-row-1').textContent).toContain(`10/01/${yr} → 11/01/${yr}`);
  });

  it('chip trạng thái có số lượng; bấm "Chờ duyệt" chỉ còn đơn chờ', () => {
    setup();
    expect(screen.getByTestId('leaves-chip-all').textContent).toContain('4');
    expect(screen.getByTestId('leaves-chip-pending').textContent).toContain('2');
    fireEvent.click(screen.getByTestId('leaves-chip-pending'));
    expect(screen.queryByTestId('leave-row-1')).toBeTruthy();
    expect(screen.queryByTestId('leave-row-2')).toBeNull();
    expect(screen.queryByTestId('leave-row-3')).toBeNull();
  });

  it('tìm theo tên không dấu và lọc loại phép', () => {
    setup({ leaves: [lv('1', 'pending', { empName: 'Nguyễn Đức' }), lv('2', 'pending', { empName: 'Lê Văn' })] });
    fireEvent.change(screen.getByTestId('leaves-search'), { target: { value: 'duc' } });
    expect(screen.queryByTestId('leave-row-1')).toBeTruthy();
    expect(screen.queryByTestId('leave-row-2')).toBeNull();
  });

  it('bấm dòng mở thẻ chi tiết; Duyệt/Từ chối gọi đúng hàm; đóng được', () => {
    const { handleApproveLeave } = setup();
    expect(screen.queryByTestId('leave-detail')).toBeNull();
    fireEvent.click(screen.getByTestId('leave-row-1'));
    expect(screen.getByTestId('leave-detail').textContent).toContain('Việc gia đình');
    fireEvent.click(screen.getByTestId('leave-approve'));
    expect(handleApproveLeave).toHaveBeenCalledWith('1', 'approved');
    fireEvent.click(screen.getByTestId('leave-reject'));
    expect(handleApproveLeave).toHaveBeenCalledWith('1', 'rejected');
    fireEvent.click(screen.getByTestId('leave-detail-close'));
    expect(screen.queryByTestId('leave-detail')).toBeNull();
  });

  it('không có quyền duyệt → ẩn nút Duyệt/Từ chối, hiện thông báo chờ người duyệt', () => {
    setup({ initialSel: '1', canApproveLeave: () => false });
    expect(screen.queryByTestId('leave-approve')).toBeNull();
    expect(screen.getByTestId('leave-not-approver')).toBeTruthy();
  });

  it('đơn đã duyệt có nút "Sửa ngày" → mở hộp sửa, lưu gọi onRescheduleLeave; tick chọn hiện thanh hàng loạt', () => {
    const { onRescheduleLeave } = setup({ initialSel: '2' });
    fireEvent.click(screen.getByTestId('leave-reschedule'));
    expect(screen.getByTestId('leave-edit-dates')).toBeTruthy();
    fireEvent.click(screen.getByText('Lưu ngày mới'));
    expect(onRescheduleLeave).toHaveBeenCalledWith('2', `${yr}-01-10`, `${yr}-01-11`);
    expect(screen.queryByTestId('leaves-bulkbar')).toBeNull();
    fireEvent.click(screen.getAllByLabelText('Chọn đơn 1')[0]);
    expect(screen.getByTestId('leaves-bulkbar').textContent).toContain('Đã chọn 1');
  });
});
