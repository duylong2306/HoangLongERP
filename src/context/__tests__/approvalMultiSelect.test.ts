import { describe, it, expect, beforeEach } from 'vitest';
import {
  getConfiguredApprover,
  getConfiguredApprovers,
  getConfiguredSettler,
  getConfiguredSettlers,
  encodeApprovalApprovers,
  setApprovalConfigCache,
} from '../SettingsContext';
import type { ApprovalPermission } from '../SettingsContext';

// Quyền Phê Duyệt hỗ trợ chọn NHIỀU người (bất kỳ ai trong danh sách đều duyệt được).
// Bảng Supabase hrm_approval_config chỉ có 3 cột text cho approver (id/name/position) — không có
// cột mảng — nên nhiều người được lưu bằng cách JSON-encode mảng vào chính các cột text đó.
// Bộ test này khóa chặt hành vi mã hóa/giải mã đó, gồm cả tương thích ngược với dữ liệu CŨ (1 người,
// lưu dạng chuỗi đơn — trước khi tính năng chọn nhiều người tồn tại).
describe('Quyền Phê Duyệt — chọn nhiều người (mã hóa JSON trong cột text có sẵn)', () => {
  const mk = (over: Partial<ApprovalPermission>): ApprovalPermission => ({
    id: 'ap_leave',
    documentType: 'leave',
    documentTypeLabel: 'Đơn Xin Nghỉ Phép',
    approverId: '',
    approverName: '',
    canApprove: true,
    ...over,
  });

  beforeEach(() => setApprovalConfigCache([]));

  it('encodeApprovalApprovers() rồi getConfiguredApprovers() phải trả lại đúng nguyên danh sách (roundtrip)', () => {
    const list = [
      { id: 'NV001', name: 'Trương Hữu Long', position: 'Tổng giám đốc' },
      { id: 'NV004', name: 'Lê Nguyễn Gia Ny', position: 'Trưởng phòng' },
    ];
    const encoded = encodeApprovalApprovers(list);
    setApprovalConfigCache([mk({ approverId: encoded.id, approverName: encoded.name, approverPosition: encoded.position })]);
    expect(getConfiguredApprovers('leave')).toEqual(list);
  });

  it('dữ liệu CŨ (1 người, chuỗi đơn không phải JSON) vẫn đọc được, coi như mảng 1 phần tử', () => {
    setApprovalConfigCache([mk({ approverId: 'NV001', approverName: 'Trương Hữu Long', approverPosition: 'Tổng giám đốc' })]);
    expect(getConfiguredApprovers('leave')).toEqual([{ id: 'NV001', name: 'Trương Hữu Long', position: 'Tổng giám đốc' }]);
  });

  it('getConfiguredApprover() (số ít) trả về người ĐẦU TIÊN trong danh sách — dùng làm giá trị mặc định gán vào hồ sơ', () => {
    const encoded = encodeApprovalApprovers([
      { id: 'NV001', name: 'Trương Hữu Long' },
      { id: 'NV004', name: 'Lê Nguyễn Gia Ny' },
    ]);
    setApprovalConfigCache([mk({ approverId: encoded.id, approverName: encoded.name, approverPosition: encoded.position })]);
    expect(getConfiguredApprover('leave')).toEqual({ id: 'NV001', name: 'Trương Hữu Long', position: undefined });
  });

  it('mục chưa cấu hình (canApprove=false) hoặc không tồn tại → trả về mảng rỗng / null, không lỗi', () => {
    setApprovalConfigCache([mk({ approverId: 'NV001', approverName: 'A', canApprove: false })]);
    expect(getConfiguredApprovers('leave')).toEqual([]);
    expect(getConfiguredApprover('leave')).toBeNull();
    expect(getConfiguredApprovers('travel_expense')).toEqual([]); // loại hồ sơ không có trong config
  });

  it('người quyết toán (settler) mã hóa/giải mã độc lập với người duyệt (approver)', () => {
    const approvers = encodeApprovalApprovers([{ id: 'NV001', name: 'Trương Hữu Long' }]);
    const settlers = encodeApprovalApprovers([
      { id: 'NV007', name: 'Nguyễn Thị Huyền Trang', position: 'Nhân viên' },
      { id: 'NV004', name: 'Lê Nguyễn Gia Ny', position: 'Trưởng phòng' },
    ]);
    setApprovalConfigCache([mk({
      documentType: 'payroll', documentTypeLabel: 'Phiếu Lương',
      approverId: approvers.id, approverName: approvers.name, approverPosition: approvers.position,
      settlerId: settlers.id, settlerName: settlers.name, settlerPosition: settlers.position,
    })]);
    expect(getConfiguredApprovers('payroll')).toEqual([{ id: 'NV001', name: 'Trương Hữu Long', position: undefined }]);
    expect(getConfiguredSettlers('payroll')).toEqual([
      { id: 'NV007', name: 'Nguyễn Thị Huyền Trang', position: 'Nhân viên' },
      { id: 'NV004', name: 'Lê Nguyễn Gia Ny', position: 'Trưởng phòng' },
    ]);
    expect(getConfiguredSettler('payroll')?.id).toBe('NV007');
  });

  it('danh sách rỗng mã hóa/giải mã đúng thành []', () => {
    const encoded = encodeApprovalApprovers([]);
    setApprovalConfigCache([mk({ approverId: encoded.id, approverName: encoded.name, approverPosition: encoded.position })]);
    expect(getConfiguredApprovers('leave')).toEqual([]);
    expect(getConfiguredApprover('leave')).toBeNull();
  });
});
