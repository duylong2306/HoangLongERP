import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MissingAttendanceReport from '../tabs/MissingAttendanceReport';

// Báo cáo vắng mặt (thiết kế mới): chip loại, bộ lọc, bảng + thẻ, thanh duyệt hàng loạt khi tick chọn.
const EMPS = [
  { id: 'NV1', name: 'An', status: 'working', startDate: '2026-01-01' },
  { id: 'NV2', name: 'Bình', status: 'working', startDate: '2026-01-01' },
];

function setup() {
  const props: any = {
    employees: EMPS, attendance: [], leaves: [], holidays: [], weekendDays: [0], month: '11', year: '2026',
    excludedIds: [], excludedRoles: [], onCreateRecord: vi.fn(), addToast: vi.fn(),
  };
  return { props, ...render(<MissingAttendanceReport {...props} />) };
}

describe('Báo cáo vắng mặt — giao diện mới', () => {
  // Cố định "hôm nay" = thứ Sáu 06/11/2026 để danh sách mặc định (Vắng KP + Hôm nay) có đúng 2 dòng
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 10, 6, 9, 0, 0)); });
  afterEach(() => { vi.useRealTimers(); });

  it('có bảng + thẻ, mỗi nhân viên vắng một dòng; ngày hiện dd/mm/yyyy; chip loại có số lượng', () => {
    setup();
    expect(screen.getByTestId('miss-table')).toBeTruthy();
    expect(screen.getByTestId('miss-cards')).toBeTruthy();
    expect(screen.getByTestId('miss-row-NV1|2026-11-06').textContent).toContain('06/11/2026');
    expect(screen.getByTestId('miss-card-NV2|2026-11-06')).toBeTruthy();
    expect(screen.getByTestId('miss-chip-absent').textContent).toContain('Vắng KP');
  });

  it('chưa chọn dòng thì không có thanh hàng loạt; tick chọn thì hiện, "Áp dụng" gán KP gọi onCreateRecord', () => {
    const { props } = setup();
    expect(screen.queryByTestId('miss-bulkbar')).toBeNull();
    fireEvent.click(screen.getByTestId('miss-row-NV1|2026-11-06'));
    expect(screen.getByTestId('miss-bulkbar').textContent).toContain('Đã chọn 1');
    fireEvent.change(screen.getByTestId('miss-action'), { target: { value: 'kp' } });
    fireEvent.click(screen.getByTestId('miss-apply'));
    expect(props.onCreateRecord).toHaveBeenCalledTimes(1);
    expect(props.onCreateRecord.mock.calls[0][0]).toMatchObject({ empId: 'NV1', date: '2026-11-06', status: 'unexcused' });
  });

  it('chưa chọn hành động mà bấm Áp dụng → cảnh báo, không tạo bản ghi', () => {
    const { props } = setup();
    fireEvent.click(screen.getByTestId('miss-row-NV2|2026-11-06'));
    fireEvent.click(screen.getByTestId('miss-apply'));
    expect(props.onCreateRecord).not.toHaveBeenCalled();
    expect(props.addToast).toHaveBeenCalled();
  });
});
