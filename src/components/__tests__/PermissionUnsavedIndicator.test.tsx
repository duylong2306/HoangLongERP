import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// Màn hình phân quyền dùng cơ chế "bản nháp" (tích ô → phải bấm Lưu). Kiểm tra người dùng LUÔN thấy rõ còn bao nhiêu thay đổi chưa lưu:
// thanh nổi, số trên tab, ô đã đổi được tô nổi, và đổi lại về như cũ thì tắt cảnh báo.
vi.mock('../../context', () => ({
  loadHrmRoleGroups: () => [{ id: 'role_ketoan', name: 'Kế toán', memberIds: [] }, { id: 'role_xuong', name: 'Nhân viên xưởng', memberIds: [] }],
  useNotification: () => ({ addToast: vi.fn() }),
  isUserInRoleGroup: () => false, isRoleAdmin: () => false, isRoleAccounting: () => false,
}));
import ProjectPermissionModal from '../hr/tabs/ProjectPermissionModal';
import SaveActionBar from '../ui/SaveActionBar';
import { DEFAULT_PROJECT_PERMISSIONS } from '../hr/hrProjectPermissions';

afterEach(cleanup);
const renderModal = () => render(
  <ProjectPermissionModal isOpen mode="inline" onClose={() => {}} onSave={() => {}} value={DEFAULT_PROJECT_PERMISSIONS} savedValue={DEFAULT_PROJECT_PERMISSIONS} onChange={() => {}} hasChanges={false} />
);

describe('Cảnh báo "thay đổi chưa lưu" ở màn hình Quyền Dự Án', () => {
  it('chưa sửa gì: không có cảnh báo', () => {
    renderModal();
    fireEvent.click(screen.getByText(/Vai trò nhóm HRM/));
    expect(screen.queryByText(/CHƯA LƯU/)).toBeNull();
  });

  it('tích 1 ô: hiện "Có 1 thay đổi CHƯA LƯU" (thanh nổi + thanh Lưu), số 1 trên tab, ô đã đổi được tô nổi', () => {
    const { container } = renderModal();
    fireEvent.click(screen.getByText(/Vai trò nhóm HRM/));
    const box = container.querySelector('tbody input[type=checkbox]:not(:disabled)') as HTMLInputElement;
    fireEvent.click(box);
    expect(screen.getAllByText(/Có 1 thay đổi CHƯA LƯU/).length).toBe(1);                       // thanh Lưu ghim cố định
    expect(screen.getByRole('status')).toHaveTextContent('Chỉ có hiệu lực sau khi bấm Lưu');
    expect(container.querySelector('[title="1 thay đổi chưa lưu"]')).not.toBeNull();            // nhãn số trên tab
    expect(container.querySelector('td.ring-amber-400')).not.toBeNull();                         // ô đã đổi được tô nổi
  });

  it('tích thêm ô thứ 2 thì đếm 2; bỏ tích ô đầu thì còn 1; "Hủy bỏ" trên thanh nổi đưa về 0', () => {
    const { container } = renderModal();
    fireEvent.click(screen.getByText(/Vai trò nhóm HRM/));
    const boxes = container.querySelectorAll('tbody input[type=checkbox]:not(:disabled)');
    fireEvent.click(boxes[0]); fireEvent.click(boxes[1]);
    expect(screen.getAllByText(/Có 2 thay đổi CHƯA LƯU/).length).toBeGreaterThan(0);
    fireEvent.click(boxes[0]);
    expect(screen.getAllByText(/Có 1 thay đổi CHƯA LƯU/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Hủy bỏ' }));                            // nút "Hủy bỏ" trên thanh ghim
    expect(screen.queryByText(/CHƯA LƯU/)).toBeNull();
  });
});

describe('SaveActionBar dùng chung', () => {
  it('có thay đổi → nút "Lưu thay đổi" gọi đúng hàm lưu; không có thay đổi → nút khóa và không có cảnh báo', () => {
    const onSave = vi.fn();
    const props = { onSave, onCancel: () => {}, onSetDefault: () => {}, onRestoreDefault: () => {} };
    const { rerender } = render(<SaveActionBar {...props} changed={false} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect((screen.getByText('Lưu thay đổi') as HTMLButtonElement).disabled).toBe(true);
    rerender(<SaveActionBar {...props} changed changeCount={4} />);
    expect(screen.getAllByText(/Có 4 thay đổi CHƯA LƯU/).length).toBe(1);
    fireEvent.click(screen.getByText('Lưu thay đổi'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
  it('có thay đổi chưa lưu mà đóng/tải lại trang thì trình duyệt được yêu cầu hỏi lại', () => {
    render(<SaveActionBar changed onSave={() => {}} onCancel={() => {}} onSetDefault={() => {}} onRestoreDefault={() => {}} />);
    const ev = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });
  it('không có thay đổi thì KHÔNG chặn việc đóng trang', () => {
    render(<SaveActionBar changed={false} onSave={() => {}} onCancel={() => {}} onSetDefault={() => {}} onRestoreDefault={() => {}} />);
    const ev = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });
});

describe('Thanh Lưu ghim cố định (luôn nhìn thấy khi cuộn bảng dài)', () => {
  it('được vẽ ra ngoài cây giao diện (vào <body>) với vị trí fixed, luôn hiện kể cả khi chưa có thay đổi, đủ 4 nút', () => {
    const { container } = render(<div style={{ overflow: 'auto', height: 50 }}><SaveActionBar changed={false} onSave={() => {}} onCancel={() => {}} onSetDefault={() => {}} onRestoreDefault={() => {}} /></div>);
    const bar = screen.getByTestId('save-action-bar');
    expect(container.contains(bar)).toBe(false);                         // không nằm trong vùng cuộn của cha → không bị cuộn mất
    expect(bar.parentElement).toBe(document.body);
    expect(bar.className).toContain('fixed');
    for (const t of ['Hủy bỏ', 'Đặt làm mặc định', 'Khôi phục mặc định', 'Lưu thay đổi']) expect(screen.getByText(t)).toBeInTheDocument();
  });
  it('có thay đổi thì viền/nền nổi bật + hiện số thay đổi; để lại khoảng đệm ở vị trí cũ', () => {
    const { container } = render(<SaveActionBar changed changeCount={3} onSave={() => {}} onCancel={() => {}} onSetDefault={() => {}} onRestoreDefault={() => {}} />);
    expect(screen.getByTestId('save-action-bar').className).toContain('border-amber-400');
    expect(screen.getByRole('status')).toHaveTextContent('Có 3 thay đổi CHƯA LƯU');
    expect(container.querySelector('[aria-hidden]')).not.toBeNull();     // khoảng đệm giữ chỗ
  });
});

describe('Thanh Lưu dạng thanh ngang dưới đáy (kiểu VS Code)', () => {
  it('trải ngang suốt bề rộng, dính đáy màn hình; nút Lưu nằm ngoài cùng bên phải; chưa sửa thì ghi "Chưa có thay đổi"', () => {
    render(<SaveActionBar changed={false} onSave={() => {}} onCancel={() => {}} onSetDefault={() => {}} onRestoreDefault={() => {}} />);
    const bar = screen.getByTestId('save-action-bar');
    expect(bar.className).toContain('bottom-0'); expect(bar.className).toContain('left-0'); expect(bar.className).toContain('right-0');
    expect(bar).toHaveTextContent('Chưa có thay đổi nào cần lưu');
    const labels = [...bar.querySelectorAll('button')].map(b => b.textContent);
    expect(labels[labels.length - 1]).toBe('Lưu thay đổi');
  });
  it('nằm trong vùng nội dung <main> thì căn đúng mép trái/bề rộng của vùng đó (không đè menu bên trái)', () => {
    const rect = { left: 240, width: 800, top: 0, right: 1040, bottom: 600, height: 600, x: 240, y: 0, toJSON() {} } as DOMRect;
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect);
    render(<main><SaveActionBar changed onSave={() => {}} onCancel={() => {}} onSetDefault={() => {}} onRestoreDefault={() => {}} /></main>);
    const bar = screen.getByTestId('save-action-bar') as HTMLElement;
    expect(bar.style.left).toBe('240px'); expect(bar.style.width).toBe('800px');
    spy.mockRestore();
  });
});

// Nhãn "Chưa áp dụng": hành động nào ứng dụng chưa kiểm tra ở đâu thì phải được báo rõ ở CẢ 2 tab (tick cũng không đổi gì).
describe('Nhãn "Chưa áp dụng" ở Quyền Dự Án', () => {
  it('tab Theo vị trí: chỉ liệt kê hành động đang dùng (không nhãn), thao tác trong công việc bị ẩn và có ghi chú trỏ sang Quyền Công việc', () => {
    renderModal();
    const dong = (ten: string) => screen.getByText(ten).closest('tr')!;
    expect(dong('Tạo dự án mới').textContent).not.toContain('Chưa áp dụng');
    expect(screen.queryByText('Ghi nhận công tác phí')).toBeNull();
    expect(screen.queryByText('Duyệt kết quả')).toBeNull();
    expect(screen.getByTestId('ghi-chu-quyen-cong-viec').textContent).toContain('Quyền Công việc');
  });
  it('tab Vai trò nhóm HRM: chỉ còn ô có tác dụng (Duyệt kết quả…), các ô thừa (Nhận việc, Ghi nhận công tác phí, Lập phiếu phạt…) đã gỡ nên không còn nhãn', () => {
    renderModal();
    fireEvent.click(screen.getByText(/Vai trò nhóm HRM/));
    const dong = (ten: string) => screen.getByText(ten).closest('tr')!;
    for (const ten of ['Nhận việc', 'Hoàn thành', 'Giao việc', 'Ghi nhận công tác phí', 'Lập phiếu phạt', 'Gán thợ phụ', 'Gán phụ trách chính', 'Gán thành viên nhiệm vụ', 'Xác nhận hoàn thành']) expect(screen.queryByText(ten)).toBeNull();
    expect(dong('Duyệt kết quả').textContent).not.toContain('Chưa áp dụng');
    expect(dong('Tạo dự án mới').textContent).not.toContain('Chưa áp dụng');
    expect(screen.queryAllByText('Chưa áp dụng')).toHaveLength(0);
  });
});

// Cột "Tầm nhìn" đã bị gỡ (dư thừa): không còn ô chọn nào, và việc mở màn hình không tạo thay đổi chưa lưu.
describe('Không còn cột Tầm nhìn', () => {
  it('không có ô chọn chế độ vai trò nào và không còn chữ "Tầm nhìn"/"Chỉ xem"', () => {
    const { container } = renderModal();
    expect(container.querySelectorAll('select').length).toBe(0);
    expect(screen.queryByText(/Tầm nhìn/)).toBeNull();
    expect(screen.queryByText(/Chỉ xem/)).toBeNull();
    expect(screen.queryByText(/CHƯA LƯU/)).toBeNull();
  });
});

// Cột nhóm quản trị trong "Vai trò nhóm HRM": phải hiển thị TÍCH (khóa) vì nhóm quản trị luôn có toàn quyền — trước đây hiện ô trống gây hiểu nhầm.
describe('Cột nhóm quản trị trong Vai trò nhóm HRM', () => {
  it('nhóm Siêu Admin (role_superadmin): mọi ô được tích và bị khóa', async () => {
    vi.resetModules();
    vi.doMock('../../context', () => ({
      loadHrmRoleGroups: () => [{ id: 'role_superadmin', name: 'Siêu Admin', memberIds: [] }, { id: 'role_xuong', name: 'Nhân viên xưởng', memberIds: [] }],
      useNotification: () => ({ addToast: vi.fn() }), isUserInRoleGroup: () => false, isRoleAdmin: () => false, isRoleAccounting: () => false, hasModulePermission: () => true,
    }));
    const Modal = (await import('../hr/tabs/ProjectPermissionModal')).default;
    const { DEFAULT_PROJECT_PERMISSIONS: D } = await import('../hr/hrProjectPermissions');
    const { container } = render(<Modal isOpen mode="inline" onClose={() => {}} onSave={() => {}} value={D} savedValue={D} onChange={() => {}} hasChanges={false} />);
    fireEvent.click(screen.getByText(/Vai trò nhóm HRM/));
    const hang = container.querySelector('tbody input[type=checkbox]') as HTMLInputElement | null;
    const khoa = [...container.querySelectorAll('tbody input[type=checkbox]:disabled')] as HTMLInputElement[];
    expect(hang).not.toBeNull();
    expect(khoa.length).toBeGreaterThan(0);
    expect(khoa.every(c => c.checked)).toBe(true);
  });
});
