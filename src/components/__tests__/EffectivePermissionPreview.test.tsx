import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// Màn "Xem quyền của một nhân viên": chọn người → thấy bảng quyền thực tế kèm nguồn; chưa chọn thì chưa có bảng.
vi.mock('../../lib/dbService', () => ({ dbService: { projectPermissions: { get: vi.fn(async () => null), save: vi.fn() } } }));
const GROUPS = [{ id: 'g_xuong', name: 'Nhân viên Xưởng', memberIds: ['NV1'], permissions: {} }, { id: 'g_ketoan', name: 'Kế toán', memberIds: ['NV2'], permissions: { '__role_kind__accounting': { view: true } } }];
vi.mock('../../context', () => ({
  loadHrmRoleGroups: () => GROUPS,
  getRoleGroupKind: (p: any) => (p && p['__role_kind__accounting'] ? 'accounting' : null),
  ROLE_GROUP_KIND_LABELS: { accounting: 'Kế toán', admin: 'Quản trị viên', office: 'Văn phòng', technical: 'Kỹ thuật' },
  useNotification: () => ({ addToast: vi.fn() }),
  isUserInRoleGroup: () => false, isRoleAdmin: () => false, isRoleAccounting: (id: string) => id === 'NV2',
}));
import EffectivePermissionPreview from '../hr/tabs/EffectivePermissionPreview';

afterEach(cleanup);
const NV = [{ id: 'NV1', name: 'Nguyễn Văn Xưởng' }, { id: 'NV2', name: 'Trần Thị Kế Toán' }];

describe('Xem quyền của một nhân viên', () => {
  it('chưa chọn → chưa có bảng; chọn nhân viên → hiện nhóm vai trò và bảng quyền', () => {
    render(<EffectivePermissionPreview employees={NV} />);
    expect(screen.queryByRole('table')).toBeNull();
    fireEvent.change(screen.getByLabelText('Chọn nhân viên'), { target: { value: 'NV1' } });
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Nhân viên Xưởng')).toBeInTheDocument();      // nhóm suy ra từ danh sách thành viên nhóm
    expect(screen.getByText('Tạo dự án mới')).toBeInTheDocument();        // chỉ liệt kê hành động có tác dụng
    expect(screen.queryByText('Xuất dữ liệu dự án')).toBeNull();          // hành động "Chưa áp dụng" không có mặt
  });
  it('nhân viên xưởng thường không tạo được dự án ở cấp bảng; Kế toán thì có nhãn nguồn', () => {
    render(<EffectivePermissionPreview employees={NV} />);
    fireEvent.change(screen.getByLabelText('Chọn nhân viên'), { target: { value: 'NV1' } });
    const dongXuong = screen.getByText('Tạo dự án mới').closest('tr')!;
    expect(dongXuong.querySelectorAll('[title="Không có quyền"]').length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('Chọn nhân viên'), { target: { value: 'NV2' } });
    expect(screen.getByText(/Kế toán/, { selector: 'b' })).toBeInTheDocument();
    expect(screen.getByText('Tạo dự án mới').closest('tr')!.textContent).toMatch(/Vị trí|Nhóm/);
  });
});
