import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import fs from 'node:fs';
import ProfilesTab from '../tabs/ProfilesTab';

// Danh sách Hồ sơ nhân viên (thiết kế mới): thanh công cụ, chip lọc trạng thái, bảng máy tính + thẻ điện thoại, thao tác hàng loạt.
const emp = (id: string, name: string, status: string, extra: any = {}) => ({
  id, name, status, position: 'Nhân viên', department: 'Phòng Dự án', phone: '0900000000', gender: 'Nam', phepNam: 12, hasSystemAccount: false, ...extra,
}) as any;
const EMPS = [emp('NV001', 'An Văn Bình', 'working'), emp('NV002', 'Bùi Thị Cúc', 'leave'), emp('NV003', 'Cao Văn Dũng', 'resigned'), emp('NV004', 'Đỗ Thị Em', 'working', { hasSystemAccount: true })];

function setup(over: any = {}) {
  const props: any = {
    employees: EMPS, setEmployees: vi.fn(), roles: [], setRoles: vi.fn(),
    selectedEmpId: null, setSelectedEmpId: vi.fn(), employeeSearch: '', setEmployeeSearch: vi.fn(),
    isEditingEmp: false, setIsEditingEmp: vi.fn(), editingEmpData: null, setEditingEmpData: vi.fn(),
    profilePage: 1, setProfilePage: vi.fn(), globalPageSize: 'all', setGlobalPageSize: vi.fn(), addToast: vi.fn(),
    handleExportProfilesExcel: vi.fn(), handleImportProfilesExcel: vi.fn(), profileFileInputRef: { current: null },
    salaryScales: [], onAddEmployee: vi.fn(), ...over,
  };
  return { props, ...render(<ProfilesTab {...props} />) };
}

describe('Hồ sơ nhân viên — giao diện danh sách mới', () => {
  it('có bảng (máy tính) và thẻ (điện thoại) cho cùng danh sách; mỗi nhân viên một dòng/thẻ', () => {
    setup();
    expect(screen.getByTestId('profiles-table')).toBeTruthy();
    expect(screen.getByTestId('profiles-cards')).toBeTruthy();
    EMPS.forEach(e => { expect(screen.getByTestId(`profile-row-${e.id}`)).toBeTruthy(); expect(screen.getByTestId(`profile-card-${e.id}`)).toBeTruthy(); });
  });

  it('chip lọc trạng thái có số lượng; bấm "Đang làm" chỉ còn người đang làm; chip trống số lượng thì ẩn', () => {
    setup();
    expect(screen.getByTestId('profiles-chip-all').textContent).toContain('4');
    expect(screen.getByTestId('profiles-chip-working').textContent).toContain('2');
    expect(screen.queryByTestId('profiles-chip-director_board')).toBeNull();            // không có ai thuộc Ban giám đốc
    fireEvent.click(screen.getByTestId('profiles-chip-working'));
    expect(screen.queryByTestId('profile-row-NV001')).toBeTruthy();
    expect(screen.queryByTestId('profile-row-NV002')).toBeNull();                         // nghỉ phép bị ẩn
    expect(screen.queryByTestId('profile-row-NV003')).toBeNull();                         // nghỉ làm bị ẩn
    fireEvent.click(screen.getByTestId('profiles-chip-off'));
    expect(screen.queryByTestId('profile-row-NV003')).toBeTruthy();
  });

  it('nút "Thêm nhân viên" gọi onAddEmployee; không có quyền (không truyền) thì ẩn nút', () => {
    const { props, unmount } = setup();
    fireEvent.click(screen.getByTestId('profiles-add'));
    expect(props.onAddEmployee).toHaveBeenCalledTimes(1);
    unmount();
    setup({ onAddEmployee: undefined });
    expect(screen.queryByTestId('profiles-add')).toBeNull();
  });

  it('Xuất Excel gọi hàm xuất; bấm dòng thì chọn nhân viên mở chi tiết', () => {
    const { props } = setup();
    fireEvent.click(screen.getByTestId('profiles-export'));
    expect(props.handleExportProfilesExcel).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('profile-row-NV002'));
    expect(props.setSelectedEmpId).toHaveBeenCalledWith('NV002');
    expect(props.setIsEditingEmp).toHaveBeenCalledWith(false);
  });

  it('tick chọn dòng thì hiện thanh thao tác hàng loạt (Tạo tài khoản / Reset phép năm / Xóa)', () => {
    setup();
    expect(screen.queryByTestId('profiles-bulkbar')).toBeNull();
    const row = screen.getByTestId('profile-row-NV001');
    fireEvent.click(within(row).getByRole('checkbox'));
    const bar = screen.getByTestId('profiles-bulkbar');
    expect(bar.textContent).toContain('Đã chọn 1');
    ['Tạo tài khoản', 'Reset phép năm', 'Xóa'].forEach(t => expect(bar.textContent).toContain(t));
  });

  it('tab Hồ sơ không còn dùng khối tiêu đề + mô tả + nút cũ ở HumanResourcesManagement', () => {
    const src = fs.readFileSync('src/components/HumanResourcesManagement.tsx', 'utf8');
    expect(src).toContain("activeSubTab !== 'profiles' && (");
    expect(src).toContain('onAddEmployee=');
  });
});
