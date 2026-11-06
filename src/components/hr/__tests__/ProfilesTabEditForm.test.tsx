import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ProfilesTab from '../tabs/ProfilesTab';

afterEach(cleanup);

// Form sửa hồ sơ nhân viên (thiết kế mới): chia khối, nút Lưu/Hủy, giữ nguyên logic cũ.
vi.mock('../../../lib/dbService', () => ({ dbService: { employees: { save: vi.fn(() => Promise.resolve()), delete: vi.fn(() => Promise.resolve()) } } }));

const EMP: any = {
  id: 'NV004', name: 'Lê Nguyễn Gia Ny', status: 'working', position: 'Trưởng phòng', department: 'Kế toán', phone: '0829400708',
  gender: 'Nữ', email: 'ny@example.vn', cccd: '066301010634', cccdIssuedDate: '2022-02-16', cccdIssuedPlace: 'CS',
  dob: '1990-01-01', address: 'Thôn 1', currentAddress: '', education: 'Đại học', emergencyContact: '',
  salaryCode: '', contractType: 'Không thời hạn', phepNam: 4, bankAccount: '5400', bankName: 'Agribank', hasSystemAccount: true, username: 'ny', password: 'x',
};
function setup(emp: any = EMP) {
  const props: any = {
    employees: [EMP], setEmployees: vi.fn(), roles: [], setRoles: vi.fn(),
    selectedEmpId: 'NV004', setSelectedEmpId: vi.fn(), employeeSearch: '', setEmployeeSearch: vi.fn(),
    isEditingEmp: true, setIsEditingEmp: vi.fn(), editingEmpData: emp, setEditingEmpData: vi.fn(),
    profilePage: 1, setProfilePage: vi.fn(), globalPageSize: 'all', setGlobalPageSize: vi.fn(), addToast: vi.fn(),
    handleExportProfilesExcel: vi.fn(), handleImportProfilesExcel: vi.fn(), profileFileInputRef: { current: null }, salaryScales: [],
  };
  render(<ProfilesTab {...props} />);
  return props;
}

describe('Form sửa hồ sơ nhân viên', () => {
  it('chia 4 khối và có nút Hủy / Lưu thay đổi', () => {
    setup();
    const f = screen.getByTestId('profile-edit-form');
    ['Thông tin cá nhân', 'Liên hệ', 'Công việc & hợp đồng', 'Lương & ngân hàng'].forEach(t => expect(f.textContent).toContain(t));
    expect(screen.getByTestId('profile-edit-save').textContent).toBe('Lưu thay đổi');
    expect(screen.getByTestId('profile-edit-cancel').textContent).toBe('Hủy');
  });

  it('gõ vào ô tên → cập nhật dữ liệu đang sửa; Hủy thoát chế độ sửa', () => {
    const p = setup();
    fireEvent.change(screen.getByTestId('edit-name'), { target: { value: 'Tên mới' } });
    expect(p.setEditingEmpData).toHaveBeenCalledWith(expect.objectContaining({ name: 'Tên mới' }));
    fireEvent.click(screen.getByTestId('profile-edit-cancel'));
    expect(p.setIsEditingEmp).toHaveBeenCalledWith(false);
  });

  it('Lưu: cập nhật danh sách nhân viên và thoát chế độ sửa', () => {
    const p = setup({ ...EMP, name: 'Đã sửa' });
    fireEvent.submit(screen.getByTestId('profile-edit-form'));
    expect(p.setEmployees).toHaveBeenCalledWith([expect.objectContaining({ id: 'NV004', name: 'Đã sửa' })]);
    expect(p.setIsEditingEmp).toHaveBeenCalledWith(false);
  });

  it('chọn "Nghỉ hẳn" → xóa tài khoản + mật khẩu đăng nhập và hiện cảnh báo', () => {
    const p = setup();
    fireEvent.change(screen.getByTestId('edit-status'), { target: { value: 'retired' } });
    expect(p.setEditingEmpData).toHaveBeenCalledWith(expect.objectContaining({ status: 'retired', username: '', password: '', hasSystemAccount: false }));
    cleanup();
    setup({ ...EMP, status: 'retired' });
    expect(screen.getByTestId('edit-retired-warning')).toBeTruthy();
  });

  it('ô "Thời hạn HĐ (tháng)" chỉ hiện khi hợp đồng Có thời hạn', () => {
    setup();
    expect(screen.queryByTestId('edit-contract-months')).toBeNull();
    cleanup();
    setup({ ...EMP, contractType: 'Có thời hạn', contractDurationMonths: 12 });
    expect((screen.getByTestId('edit-contract-months') as HTMLInputElement).value).toBe('12');
  });

  it('Phòng ban "Xưởng cơ khí": giá trị đúng (không lẫn tên class); hồ sơ cũ lưu nhầm vẫn hiện đúng mục', () => {
    setup({ ...EMP, department: 'Xưởng cơ khí font-bold' });
    const sel = screen.getByTestId('edit-department') as HTMLSelectElement;
    expect(sel.value).toBe('Xưởng cơ khí');
    expect(Array.from(sel.options).map(o => o.value)).not.toContain('Xưởng cơ khí font-bold');
    cleanup();
    const p = setup();
    fireEvent.change(screen.getByTestId('edit-department'), { target: { value: 'Xưởng cơ khí' } });
    expect(p.setEditingEmpData).toHaveBeenCalledWith(expect.objectContaining({ department: 'Xưởng cơ khí' }));
  });
});
