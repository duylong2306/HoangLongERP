import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import PerformanceTab from '../tabs/PerformanceTab';

afterEach(cleanup);

// Tab Hiệu suất (thiết kế mới): thanh công cụ, thẻ tổng hợp, thang điểm, xếp loại, nhật ký lỗi, sửa/xóa.
const EMPS = [
  { id: 'NV1', name: 'An Văn Bình', department: 'Phòng A (Dự án)', position: 'Kỹ sư' },
  { id: 'NV2', name: 'Bùi Thị Cúc', department: 'Phòng B', position: 'Kế toán' },
];
const err = (id: string, empId: string, name: string, date = '2026-06-12') => ({
  id, employeeId: empId, employeeName: name, date, category: 'readiness', criterionContent: 'Đi muộn ' + id, notes: 'ghi chú ' + id, departmentName: 'Phòng A', images: [],
}) as any;
const ERRORS = [err('E1', 'NV1', 'An Văn Bình'), err('E2', 'NV1', 'An Văn Bình'), err('E3', 'NV1', 'An Văn Bình', '2025-01-05')];

function setup(over: any = {}) {
  const props: any = {
    employees: EMPS, employeeErrors: ERRORS, errorSearchEmpId: 'all', setErrorSearchEmpId: vi.fn(), errorFilterMonth: 'all', setErrorFilterMonth: vi.fn(),
    errorFilterYear: '2026', setErrorFilterYear: vi.fn(), deletingErrorId: null, setDeletingErrorId: vi.fn(), setEditingErrorId: vi.fn(),
    setErrFormEmpId: vi.fn(), setErrFormDate: vi.fn(), setErrFormNotes: vi.fn(), setErrorFormCritSearch: vi.fn(), setShowErrorModal: vi.fn(),
    handleFormEmployeeChange: vi.fn(), handleEditErrorTrigger: vi.fn(), handleDeleteError: vi.fn(), ...over,
  };
  return { props, ...render(<PerformanceTab {...props} />) };
}

describe('Hiệu suất — giao diện mới', () => {
  it('chỉ hiện lỗi của năm đang lọc; thẻ tổng hợp + xếp loại đúng (An 2 lỗi, Bùi 0 lỗi)', () => {
    setup();
    expect(screen.getByTestId('perf-log-count').textContent).toBe('2');      // lỗi năm 2025 bị ẩn
    expect(screen.getByTestId('perf-err-E1')).toBeTruthy();
    expect(screen.queryByTestId('perf-err-E3')).toBeNull();
    expect(screen.getByTestId('perf-summary').textContent).toContain('Nhân sự có lỗi');
    expect(screen.getByTestId('perf-rank-NV1').textContent).toContain('2 lỗi');
    expect(screen.getByTestId('perf-rank-NV2').textContent).toContain('0 lỗi');
    expect(screen.getByTestId('perf-scale').textContent).toContain('0 lỗi → 100');
  });

  it('nút "Ghi nhận lỗi" mở hộp với nhân sự đầu tiên; Xuất Excel không báo lỗi; đổi bộ lọc gọi setter', () => {
    const { props } = setup();
    fireEvent.click(screen.getByTestId('perf-add'));
    expect(props.setEditingErrorId).toHaveBeenCalledWith(null);
    expect(props.handleFormEmployeeChange).toHaveBeenCalledWith('NV1');
    expect(props.setShowErrorModal).toHaveBeenCalledWith(true);
    // Ngày mặc định phải là hôm nay (không còn gán cứng)
    const d = new Date();
    expect(props.setErrFormDate).toHaveBeenCalledWith(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    fireEvent.change(screen.getByTestId('perf-filter-month'), { target: { value: '6' } });
    expect(props.setErrorFilterMonth).toHaveBeenCalledWith('6');
  });

  it('bấm nhân sự ở bảng xếp loại → lọc theo người đó; chip tên có nút bỏ lọc', () => {
    const { props, unmount } = setup();
    fireEvent.click(screen.getByTestId('perf-rank-NV2'));
    expect(props.setErrorSearchEmpId).toHaveBeenCalledWith('NV2');
    unmount();
    const r = setup({ errorSearchEmpId: 'NV1' });
    fireEvent.click(screen.getByTestId('perf-clear-emp'));
    expect(r.props.setErrorSearchEmpId).toHaveBeenCalledWith('all');
  });

  it('Sửa gọi handleEditErrorTrigger; Xóa chuyển sang bước xác nhận; xác nhận thì xóa thật', () => {
    const { props, unmount } = setup();
    fireEvent.click(screen.getByTestId('perf-edit-E1'));
    expect(props.handleEditErrorTrigger).toHaveBeenCalledWith(ERRORS[0]);
    fireEvent.click(screen.getByTestId('perf-delete-E1'));
    expect(props.setDeletingErrorId).toHaveBeenCalledWith('E1');
    unmount();
    const r = setup({ deletingErrorId: 'E1' });
    fireEvent.click(screen.getByTestId('perf-confirm-delete-E1'));
    expect(r.props.handleDeleteError).toHaveBeenCalledWith('E1');
    expect(r.props.setDeletingErrorId).toHaveBeenCalledWith(null);
  });

  it('không có lỗi trong bộ lọc → hiện thông báo trống', () => {
    setup({ employeeErrors: [] });
    expect(screen.getByTestId('perf-empty')).toBeTruthy();
  });

  it('tổng quan: điểm trung bình, thanh phân bố theo mức điểm; nhật ký gom theo ngày', () => {
    setup();
    // An 2 lỗi → 95, Bùi 0 lỗi → 100 ⇒ trung bình 97.5
    expect(screen.getByTestId('perf-avg').textContent).toContain('97.5');
    expect(screen.getByTestId('perf-scale').textContent).toContain('2 → 95(1)');
    expect(screen.getByTestId('perf-summary').textContent).toContain('1/2');
    // 2 lỗi cùng ngày 12/06/2026 gom thành 1 nhóm
    expect(screen.getByTestId('perf-log').textContent).toContain('12/06/2026');
    expect(screen.getByTestId('perf-log').textContent).toContain('2 lỗi');
  });

  it('nhiều nhân sự không lỗi → gọn thành chip, có nút xem thêm/thu gọn', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ id: 'X' + i, name: 'Người ' + i, department: 'P', position: 'NV' }));
    setup({ employees: many, employeeErrors: [] });
    expect(screen.queryByTestId('perf-rank-X11')).toBeNull();
    fireEvent.click(screen.getByTestId('perf-clean-toggle'));
    expect(screen.getByTestId('perf-rank-X11')).toBeTruthy();
  });
});
