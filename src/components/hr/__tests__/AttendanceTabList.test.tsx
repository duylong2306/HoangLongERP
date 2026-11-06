import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AttendanceTab from '../tabs/AttendanceTab';

// Tab "Chấm công ngày" (thiết kế mới): thanh công cụ, chip chuyển màn, thẻ tổng hợp, bảng máy tính + thẻ điện thoại, thao tác theo quyền.
const log = (id: string, extra: any = {}) => ({
  id, empId: 'NV' + id, empName: 'Nhân viên ' + id, date: '2026-11-05',
  timeInS: '07:30', timeOutS: '11:30', timeInC: '13:00', timeOutC: '17:00', timeInOT: '', timeOutOT: '',
  method: 'FaceID', status: 'valid', otHours: 0, notes: 'ghi chú ' + id, isLocked: false, ...extra,
}) as any;
const LOGS = [log('1'), log('2', { isLocked: true }), log('3', { timeOutS: '--:--' })];

function setup(over: any = {}) {
  const props: any = {
    employees: [{ id: 'NV1', name: 'A', status: 'working' }], attendanceFiltered: LOGS,
    attendanceSearchEmpId: 'all', setAttendanceSearchEmpId: vi.fn(), attendanceFilterMonth: 'all', setAttendanceFilterMonth: vi.fn(),
    attendanceFilterDay: 'all', setAttendanceFilterDay: vi.fn(), attendanceFilterYear: '2026', setAttendanceFilterYear: vi.fn(),
    attendancePage: 1, setAttendancePage: vi.fn(), globalPageSize: 'all', setGlobalPageSize: vi.fn(),
    leaveCoefficients: [], holidays: [], weekendDays: [], leaves: [],
    canManageLockedAttendance: () => true, setShowBulkLockModal: vi.fn(),
    handleExportAttendanceExcel: vi.fn(), handleImportAttendanceExcel: vi.fn(), attendanceFileInputRef: { current: null },
    setZoomedImage: vi.fn(), setEditingAttendance: vi.fn(), handleDeleteAttendance: vi.fn(), addToast: vi.fn(),
    WorkdayCell: () => <span>1 công</span>, onUpdateAttendance: vi.fn(),
    attendance: LOGS, excludedIds: [], excludedRoles: [], onCreateMissingRecord: vi.fn(), ...over,
  };
  return { props, ...render(<AttendanceTab {...props} />) };
}

describe('Chấm công ngày — giao diện mới', () => {
  it('có bảng (máy tính) và thẻ (điện thoại); mỗi bản ghi một dòng/thẻ; ngày hiện dd/mm/yyyy', () => {
    setup();
    expect(screen.getByTestId('att-table')).toBeTruthy();
    expect(screen.getByTestId('att-cards')).toBeTruthy();
    LOGS.forEach(l => { expect(screen.getByTestId(`att-row-${l.id}`)).toBeTruthy(); expect(screen.getByTestId(`att-card-${l.id}`)).toBeTruthy(); });
    expect(screen.getByTestId('att-row-1').textContent).toContain('05/11/2026');
  });

  it('thanh công cụ: Xuất/Nhập/Chốt hàng loạt gọi đúng hàm; đổi bộ lọc gọi setter', () => {
    const { props } = setup();
    fireEvent.click(screen.getByTestId('att-export'));
    expect(props.handleExportAttendanceExcel).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('att-bulk-lock'));
    expect(props.setShowBulkLockModal).toHaveBeenCalledWith(true);
    fireEvent.change(screen.getByTestId('att-filter-month'), { target: { value: '11' } });
    expect(props.setAttendanceFilterMonth).toHaveBeenCalledWith('11');
  });

  it('không có quyền chốt công → ẩn nút "Chốt hàng loạt"; bản ghi đã chốt chỉ hiện "Đã chốt", không có nút sửa/xóa', () => {
    setup({ canManageLockedAttendance: () => false });
    expect(screen.queryByTestId('att-bulk-lock')).toBeNull();
    expect(screen.queryAllByTestId('att-edit-2').length).toBe(0);   // bản ghi 2 đã chốt
    expect(screen.queryAllByTestId('att-edit-1').length).toBeGreaterThan(0);
  });

  it('Sửa / Xóa / Chốt-Mở khóa gọi đúng hàm; có quyền thì bản ghi đã chốt đổi thành "Mở khóa"', () => {
    const { props } = setup();
    fireEvent.click(screen.getAllByTestId('att-edit-1')[0]);
    expect(props.setEditingAttendance).toHaveBeenCalledWith(LOGS[0]);
    fireEvent.click(screen.getAllByTestId('att-delete-1')[0]);
    expect(props.handleDeleteAttendance).toHaveBeenCalledWith(LOGS[0]);
    fireEvent.click(screen.getAllByTestId('att-lock-1')[0]);
    expect(props.onUpdateAttendance).toHaveBeenCalledWith('1', { isLocked: true });
    fireEvent.click(screen.getAllByTestId('att-lock-2')[0]);
    expect(props.onUpdateAttendance).toHaveBeenCalledWith('2', { isLocked: false });
  });

  it('tick chọn dòng → hiện thanh thao tác hàng loạt; bấm dòng mở phần chi tiết (ghi chú)', () => {
    setup();
    expect(screen.queryByTestId('att-bulkbar')).toBeNull();
    fireEvent.click(screen.getAllByLabelText('Chọn Nhân viên 1')[0]);
    expect(screen.getByTestId('att-bulkbar').textContent).toContain('Đã chọn 1');
    expect(screen.queryByTestId('att-detail-3')).toBeNull();
    fireEvent.click(screen.getByTestId('att-row-3'));
    expect(screen.getAllByTestId('att-detail-3')[0].textContent).toContain('ghi chú 3');
  });

  it('dòng thiếu giờ ra hiện chip bất thường; đang tải hiện khung chờ; chip "Báo cáo vắng mặt" chuyển màn', () => {
    const { unmount } = setup();
    expect(screen.getByTestId('att-row-3').textContent).toContain('Thiếu Ra Sáng');
    fireEvent.click(screen.getByTestId('att-view-missing'));
    expect(screen.queryByTestId('att-table')).toBeNull();
    unmount();
    setup({ isLoadingAttendance: true });
    expect(screen.getByTestId('att-loading')).toBeTruthy();
  });

  it('số lượng trên hai chip là huy hiệu nổi bật; tăng ca trống ("--:--") không hiện huy hiệu giờ', () => {
    // 2 bản ghi hôm nay (chip bảng) → số 2; có bản ghi tăng ca thật thì mới hiện giờ tăng ca
    const today = new Date(); const d = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const rows = [log('1', { date: d, timeInOT: '--:--', timeOutOT: '--:--' }), log('2', { date: d, timeInOT: '18:00', timeOutOT: '20:00', otHours: 2 })];
    setup({ attendanceFiltered: rows, attendance: rows });
    expect(screen.getByTestId('att-count-table').textContent).toBe('2');
    expect(screen.getByTestId('att-count-missing')).toBeTruthy();
    expect(screen.getByTestId('att-row-1').textContent).not.toContain('(0h)');
    expect(screen.getByTestId('att-row-2').textContent).toContain('18:00–20:00 (2h)');
  });
});
