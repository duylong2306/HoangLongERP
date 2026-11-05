import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProfilesTab, { formatDisplayDate } from '../tabs/ProfilesTab';

// Thẻ chi tiết nhân viên (thiết kế mới).
const EMP: any = {
  id: 'NV004', name: 'Lê Nguyễn Gia Ny', status: 'working', position: 'Trưởng phòng', department: 'Phòng Kế toán', phone: '0829400708',
  gender: 'Nữ', email: 'ny@example.vn', cccd: '066301010634', cccdIssuedDate: '2022-02-16', cccdIssuedPlace: 'CS QLHC về TTXH',
  dob: '37109', address: 'Thôn 1, Cư Kuin', currentAddress: '', education: 'Đại học', emergencyContact: '',
  salaryCode: 'HCKTB6', contractType: 'Không xác định thời hạn', startDate: '46113', phepNam: 4, bankAccount: '5400205484678', bankName: 'Agribank', hasSystemAccount: false,
};
function setup(over: any = {}) {
  const props: any = {
    employees: [EMP], setEmployees: vi.fn(), roles: [], setRoles: vi.fn(),
    selectedEmpId: 'NV004', setSelectedEmpId: vi.fn(), employeeSearch: '', setEmployeeSearch: vi.fn(),
    isEditingEmp: false, setIsEditingEmp: vi.fn(), editingEmpData: null, setEditingEmpData: vi.fn(),
    profilePage: 1, setProfilePage: vi.fn(), globalPageSize: 'all', setGlobalPageSize: vi.fn(), addToast: vi.fn(),
    handleExportProfilesExcel: vi.fn(), handleImportProfilesExcel: vi.fn(), profileFileInputRef: { current: null }, salaryScales: [], ...over,
  };
  render(<ProfilesTab {...props} />);
  return props;
}

describe('formatDisplayDate', () => {
  it('đổi ngày ISO sang dd/mm/yyyy', () => expect(formatDisplayDate('2022-02-16')).toBe('16/02/2022'));
  it('đổi số seri ngày của Excel (nhập từ file) về ngày thật', () => {
    expect(formatDisplayDate('37109')).toBe('06/08/2001');
    expect(formatDisplayDate(46113)).toBe('01/04/2026');
  });
  it('giữ nguyên chữ/ngày đã đúng dạng; trống thì hiện —', () => {
    expect(formatDisplayDate('16/02/2022')).toBe('16/02/2022');
    expect(formatDisplayDate('')).toBe('—'); expect(formatDisplayDate(undefined)).toBe('—');
  });
});

describe('Thẻ chi tiết nhân viên', () => {
  it('hiện tên, chức vụ · bộ phận, trạng thái và các nhóm thông tin; ngày dạng số seri được đổi sang ngày thật', () => {
    setup();
    const card = screen.getByTestId('profile-detail');
    expect(card.textContent).toContain('Lê Nguyễn Gia Ny');
    expect(card.textContent).toContain('Trưởng phòng · Phòng Kế toán');
    expect(card.textContent).toContain('Đang làm');
    ['Liên hệ', 'Giấy tờ cá nhân', 'Hợp đồng', 'Phép năm'].forEach(t => expect(card.textContent).toContain(t));
    expect(card.textContent).toContain('06/08/2001');      // ngày sinh 37109
    expect(card.textContent).toContain('16/02/2022');      // ngày cấp CCCD
    expect(card.textContent).toContain('4 / 12 lần');
    expect(card.textContent).toContain('Agribank');
  });

  it('nút Sửa mở chế độ sửa với dữ liệu nhân viên; nút đóng bỏ chọn', () => {
    const p = setup();
    fireEvent.click(screen.getByTestId('profile-edit'));
    expect(p.setEditingEmpData).toHaveBeenCalledWith(expect.objectContaining({ id: 'NV004' }));
    expect(p.setIsEditingEmp).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByTestId('profile-detail-close'));
    expect(p.setSelectedEmpId).toHaveBeenCalledWith(null);
  });

  it('Xóa: hỏi xác nhận; bấm Hủy thì không xóa, đồng ý thì bỏ nhân viên khỏi danh sách', () => {
    const p = setup();
    const confirmSpy = vi.spyOn(window, 'confirm');
    confirmSpy.mockReturnValueOnce(false);
    fireEvent.click(screen.getByTestId('profile-delete'));
    expect(p.setEmployees).not.toHaveBeenCalled();
    confirmSpy.mockReturnValueOnce(true);
    fireEvent.click(screen.getByTestId('profile-delete'));
    expect(p.setEmployees).toHaveBeenCalledWith([]);
    confirmSpy.mockRestore();
  });
});
