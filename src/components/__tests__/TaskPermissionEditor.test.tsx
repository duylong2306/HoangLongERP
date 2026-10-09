import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import TaskPermissionEditor from '../hr/tabs/TaskPermissionEditor';
import { DEFAULT_TASK_PERMISSIONS } from '../hr/hrTaskPermissions';
import { countTaskMatrixChanges, isTaskCellChanged } from '../../lib/permissionDraftDiff';

// Tab "Quyền Công việc": chỉnh ma trận theo bản nháp, đếm thay đổi chưa lưu, khóa đúng các ô không có tác dụng.
afterEach(cleanup);
const clone = (m: any) => JSON.parse(JSON.stringify(m));

function Harness({ onChangeSpy }: { onChangeSpy?: (m: any) => void }) {
  const saved = React.useMemo(() => clone(DEFAULT_TASK_PERMISSIONS), []);
  const [draft, setDraft] = React.useState<any>(() => clone(DEFAULT_TASK_PERMISSIONS));
  return <TaskPermissionEditor value={draft} savedValue={saved} onChange={m => { setDraft(m); onChangeSpy?.(m); }} />;
}
const o = (ten: string, cot: string) => screen.getByRole('checkbox', { name: `${ten} — ${cot}` }) as HTMLInputElement;

describe('Tab Quyền Công việc — bảng chỉnh sửa', () => {
  it('hiển thị đúng mặc định: Người giao việc được Duyệt kết quả, Phụ trách CV thì không', () => {
    render(<Harness />);
    expect(o('Duyệt kết quả', 'Người Giao Việc').checked).toBe(true);
    expect(o('Duyệt kết quả', 'Phụ Trách CV').checked).toBe(false);
  });
  it('tích 1 ô → báo "Có 1 thay đổi chưa lưu" và ô được tô nổi; bỏ tích lại → hết cảnh báo', () => {
    const { container } = render(<Harness />);
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(o('Duyệt kết quả', 'Phụ Trách CV'));
    expect(screen.getByRole('status')).toHaveTextContent('Có 1 thay đổi chưa lưu');
    expect(container.querySelector('td.ring-amber-400')).not.toBeNull();
    fireEvent.click(o('Duyệt kết quả', 'Phụ Trách CV'));
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('cột Giám Đốc bị khóa (luôn được phép), trừ Nhận việc/Hoàn thành thì khóa và KHÔNG tích', () => {
    render(<Harness />);
    expect(o('Duyệt kết quả', 'Giám Đốc').disabled).toBe(true);
    expect(o('Duyệt kết quả', 'Giám Đốc').checked).toBe(true);
    expect(o('Nhận việc', 'Giám Đốc').checked).toBe(false);
  });
  it('Nhận việc / Hoàn thành: chỉ Phụ trách CV và Phụ trách NV chỉnh được, các vai trò khác bị khóa', () => {
    render(<Harness />);
    for (const ten of ['Nhận việc', 'Tự hoàn thành công việc']) {
      expect(o(ten, 'Phụ Trách CV').disabled).toBe(false);
      expect(o(ten, 'Phụ Trách NV').disabled).toBe(false);
      for (const cot of ['Giám Đốc', 'Trưởng Dự Án', 'Người Giao Việc', 'Kế Toán']) expect(o(ten, cot).disabled).toBe(true);
    }
  });
  it('mọi thao tác trong ma trận đều có dòng (trừ 5 ô đã gỡ khỏi giao diện vì không điều khiển nút nào)', () => {
    render(<Harness />);
    // Chỉ đếm các ô còn hiện trong bảng (đã gỡ ô không điều khiển nút nào)
    const dong = Object.keys(DEFAULT_TASK_PERMISSIONS.actions).filter(a => !['deleteTask', 'issuePenalty', 'settlePayment', 'manageDocs', 'assignSubWorkers'].includes(a)).length;
    const sl = document.querySelectorAll('tbody tr:not(.bg-slate-950\\/60)').length;
    expect(sl).toBe(dong);
  });
});

describe('Đếm thay đổi Quyền Công việc', () => {
  it('đếm từng ô thêm/bớt; không đổi = 0', () => {
    const a = clone(DEFAULT_TASK_PERMISSIONS), b = clone(DEFAULT_TASK_PERMISSIONS);
    expect(countTaskMatrixChanges(a, b)).toBe(0);
    b.actions.editTask.push('assignee'); b.actions.deleteTask = b.actions.deleteTask.filter((r: string) => r !== 'assigner');
    expect(countTaskMatrixChanges(b, a)).toBe(2);
    expect(isTaskCellChanged(b, a, 'editTask', 'assignee')).toBe(true);
    expect(isTaskCellChanged(b, a, 'editTask', 'pm')).toBe(false);
  });
});

describe('Nhãn "Chưa áp dụng" ở Quyền Công việc', () => {
  it('chỉ các thao tác chưa nối vào nút nào có nhãn', () => {
    render(<Harness />);
    const dong = (ten: string) => screen.getByText(ten).closest('tr')!.textContent || '';
    // Các ô không điều khiển nút nào đã gỡ khỏi bảng (dữ liệu đã lưu giữ nguyên)
    for (const ten of ['Lập phiếu phạt', 'Quyết toán thanh toán', 'Quản lý hồ sơ liên thông', 'Gán thợ phụ cho nhiệm vụ', 'Xóa công việc']) expect(screen.queryByText(ten)).toBeNull();
    expect(screen.queryAllByText('Chưa áp dụng')).toHaveLength(0);
    expect(screen.queryByText('Xóa công việc')).toBeNull(); // đã gỡ khỏi bảng
    for (const ten of ['Duyệt kết quả', 'Nhận việc', 'Quản lý nhiệm vụ con (tạo/sửa/xóa)', 'Ghi nhận vi phạm']) expect(dong(ten)).not.toContain('Chưa áp dụng');
  });
});
