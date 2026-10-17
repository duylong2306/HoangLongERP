import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { liabilityMatchesEntity, findSupplierLiability, paymentBelongsToSubcontractor } from '../liabilityPayments';
import { isPaymentPendingForUser, isAdvancePendingForUser, isPaymentProposedBy, isPaymentRelatedToUser } from '../approvalInbox';
import { findUniqueEmployeeByName } from '../employeeLookup';
import { findEmployeeByName } from '../chatStore';
import { isLeaveApproverFor } from '../../context/SettingsContext';

// Rà soát "khớp theo tên thay vì mã": nhóm 1 (tiền/công nợ), nhóm 2 (phân quyền duyệt), nhóm 3 (tìm nhân viên theo tên)
describe('Nhóm 1 — công nợ & phiếu chi khớp theo MÃ', () => {
  const nccLiab: any = { id: 'opbal_sup_NCC1', name: 'CTY X', category: 'Nhà Cung Cấp' };
  const subLiab: any = { id: 'opbal_sub_TP1', name: 'CTY X', category: 'Thầu Phụ' };
  const hand: any = (cat: string, name = 'CTY X') => ({ id: 'tay1', name, category: cat });
  it('liabilityMatchesEntity: mã trước; có mã của loại khác → không khớp; nhập tay mới theo tên + đúng loại', () => {
    expect(liabilityMatchesEntity(nccLiab, { id: 'NCC1', name: 'CTY X' }, 'supplier')).toBe(true);
    expect(liabilityMatchesEntity(nccLiab, { id: 'NCC2', name: 'CTY X' }, 'supplier')).toBe(false);          // trùng tên nhưng khác mã
    expect(liabilityMatchesEntity(nccLiab, { id: 'TP1', name: 'CTY X' }, 'subcontractor')).toBe(false);      // công nợ NCC không thuộc thầu phụ
    expect(liabilityMatchesEntity(subLiab, { id: 'TP1', name: 'khác tên' }, 'subcontractor')).toBe(true);    // khớp mã dù khác tên (đã đổi tên)
    expect(liabilityMatchesEntity(hand('Thầu Phụ'), { id: 'TP9', name: 'CTY X' }, 'subcontractor')).toBe(true);   // nhập tay → dự phòng tên
    expect(liabilityMatchesEntity(hand('Nhà Cung Cấp'), { id: 'TP9', name: 'CTY X' }, 'subcontractor')).toBe(false);   // sai loại
  });
  const orders = [{ id: 'O1', supplierId: 'NCC1' }, { id: 'O2', supplierId: 'NCC2' }];
  it('findSupplierLiability: ưu tiên mã đầu kỳ, rồi đơn đã ghi nhận cùng NCC, tên chỉ khi duy nhất & không thuộc NCC khác', () => {
    const liabs: any[] = [
      { id: 'opbal_sup_NCC1', name: 'CTY X', category: 'Nhà Cung Cấp', recordedPurchaseOrderIds: [] },
      { id: 'u-2', name: 'CTY X', category: 'Nhà Cung Cấp', recordedPurchaseOrderIds: ['O2'] },   // cùng tên nhưng là NCC2
    ];
    expect(findSupplierLiability(liabs, { supplierId: 'NCC1', supplierName: 'CTY X', orders })!.id).toBe('opbal_sup_NCC1');
    expect(findSupplierLiability(liabs, { supplierId: 'NCC2', supplierName: 'CTY X', orders })!.id).toBe('u-2');     // không bị nhầm sang NCC1 dù trùng tên
    expect(findSupplierLiability(liabs, { supplierId: 'NCC3', supplierName: 'CTY X', orders })).toBeUndefined();      // tên khớp 2 → không đoán
  });
  it('findSupplierLiability: tên duy nhất và không xung đột → dùng được (công nợ cũ chưa có mã)', () => {
    const liabs: any[] = [{ id: 'uuid-1', name: 'CTY Y', category: 'Nhà Cung Cấp', recordedPurchaseOrderIds: [] }];
    expect(findSupplierLiability(liabs, { supplierId: 'NCC7', supplierName: 'CTY Y', orders })!.id).toBe('uuid-1');
    // công nợ đầu kỳ mang mã NCC khác thì không dùng dù trùng tên
    expect(findSupplierLiability([{ id: 'opbal_sup_NCC9', name: 'CTY Y', category: 'Nhà Cung Cấp' } as any], { supplierId: 'NCC7', supplierName: 'CTY Y', orders })).toBeUndefined();
    // công nợ Thầu phụ không bao giờ được chọn làm công nợ NCC
    expect(findSupplierLiability([{ id: 'x', name: 'CTY Y', category: 'Thầu Phụ' } as any], { supplierId: 'NCC7', supplierName: 'CTY Y', orders })).toBeUndefined();
  });
  it('paymentBelongsToSubcontractor: mã trước; phiếu mã khác loại; phiếu cũ không mã mới theo tên', () => {
    const sub = { id: 'TP1', name: 'CTY X' };
    expect(paymentBelongsToSubcontractor({ subcontractorId: 'TP1', recipient: 'tên khác' } as any, sub)).toBe(true);
    expect(paymentBelongsToSubcontractor({ subcontractorId: 'TP2', recipient: 'CTY X' } as any, sub)).toBe(false);   // trùng tên nhưng mã thầu phụ khác
    expect(paymentBelongsToSubcontractor({ supplierId: 'NCC1', category: 'supplier_payment', recipient: 'CTY X' } as any, sub)).toBe(false);
    expect(paymentBelongsToSubcontractor({ category: 'subcontractor_advance', recipient: 'CTY X' } as any, sub)).toBe(true);   // phiếu cũ chưa có mã
  });
  it('nơi dùng: Công nợ trả, Chi tiết công việc, Quản lý thầu phụ, bảng lương theo mã', () => {
    const fm = fs.readFileSync('src/components/FinanceManagement.tsx', 'utf8');
    expect(fm).toMatch(/findSupplierLiability\(customLiabilities/);
    expect(fm).toMatch(/liabilityMatchesEntity\(l, selSub,/);
    expect(fm).toMatch(/empId && p\.empId \? p\.empId === empId : p\.empName === empName/);
    expect(fs.readFileSync('src/App.tsx', 'utf8').match(/findSupplierLiability\(liabs/g)).toHaveLength(2);
    expect(fs.readFileSync('src/components/TaskDetailModal.tsx', 'utf8')).toMatch(/paymentBelongsToSubcontractor\(p,/);
    expect(fs.readFileSync('src/components/SubcontractorManagement.tsx', 'utf8')).toMatch(/paymentBelongsToSubcontractor\(p,/);
  });
});

describe('Nhóm 2 — duyệt phiếu chi theo MÃ người duyệt', () => {
  const pay = (o: any) => ({ id: 'p', status: 'pending', amount: 1, ...o }) as any;
  const me = { id: 'u1', name: 'Nguyễn An' };
  const no = { isAdmin: false, isConfiguredApprover: false };
  it('phiếu có approverId: chỉ đúng mã mới duyệt; người trùng tên khác mã KHÔNG thấy', () => {
    expect(isPaymentPendingForUser(pay({ approverId: 'u1', approver: 'Ai đó' }), me, no)).toBe(true);
    expect(isPaymentPendingForUser(pay({ approverId: 'u2', approver: 'Nguyễn An' }), me, no)).toBe(false);   // trùng tên, khác mã
  });
  it('phiếu cũ chưa có approverId: dự phòng theo tên (kể cả "Tên (Chức danh)")', () => {
    expect(isPaymentPendingForUser(pay({ approver: 'Nguyễn An (Giám đốc)' }), me, no)).toBe(true);
    expect(isPaymentPendingForUser(pay({ approver: 'Người khác' }), me, no)).toBe(false);
  });
  it('Giám đốc / người được cấu hình duyệt đúng loại luôn thấy; chuỗi duyệt approvals; chỉ phiếu chờ duyệt', () => {
    expect(isPaymentPendingForUser(pay({ approverId: 'u2' }), me, { isAdmin: true, isConfiguredApprover: false })).toBe(true);
    expect(isPaymentPendingForUser(pay({ approverId: 'u2' }), me, { isAdmin: false, isConfiguredApprover: true })).toBe(true);
    expect(isPaymentPendingForUser(pay({ approverId: 'u2', approvals: [{ approverId: 'u1' }] }), me, no)).toBe(true);
    expect(isPaymentPendingForUser(pay({ approverId: 'u1', status: 'approved' }), me, no)).toBe(false);
  });
  it('người lập / người nhận của phiếu KHÔNG tự thấy nút duyệt (không tự duyệt cho mình)', () => {
    expect(isPaymentPendingForUser(pay({ proposerId: 'u1', proposer: 'Nguyễn An', recipient: 'Nguyễn An', approverId: 'u2' }), me, no)).toBe(false);
  });
  it('đề xuất chi: theo mã người duyệt; tên chỉ khi cột approver rỗng/không phải mã nhân viên', () => {
    const adv = (o: any) => ({ id: 'a', status: 'pending_approval', ...o }) as any;
    const ids = new Set(['u1', 'u2']);
    expect(isAdvancePendingForUser(adv({ approver: 'u1' }), me, { ...no, employeeIds: ids })).toBe(true);
    expect(isAdvancePendingForUser(adv({ approver: 'u2', approverName: 'Nguyễn An' }), me, { ...no, employeeIds: ids })).toBe(false);   // trùng tên, mã người duyệt là u2
    expect(isAdvancePendingForUser(adv({ approver: 'Ban Giám Đốc', approverName: 'Nguyễn An' }), me, { ...no, employeeIds: ids })).toBe(true);   // không phải mã → dự phòng tên
    expect(isAdvancePendingForUser(adv({ approver: 'u1', status: 'completed' }), me, { ...no, employeeIds: ids })).toBe(false);
  });
  it('isPaymentProposedBy / isPaymentRelatedToUser: mã trước, tên chỉ phiếu cũ', () => {
    expect(isPaymentProposedBy({ proposerId: 'u1', proposer: 'x' } as any, me)).toBe(true);
    expect(isPaymentProposedBy({ proposerId: 'u2', proposer: 'Nguyễn An' } as any, me)).toBe(false);
    expect(isPaymentProposedBy({ proposer: 'Nguyễn An' } as any, me)).toBe(true);
    expect(isPaymentRelatedToUser({ proposerId: 'u2', approverId: 'u3', employeeId: 'u1' } as any, me)).toBe(true);
    expect(isPaymentRelatedToUser({ proposerId: 'u2', approverId: 'u3', recipient: 'Nguyễn An', supplierId: 'S1' } as any, me)).toBe(false);   // NCC trùng tên người dùng
  });
  it('đơn nghỉ phép: có approverId thì không so tên (trùng tên không duyệt được)', () => {
    expect(isLeaveApproverFor('u1', 'Nguyễn An', { approverId: 'u2', approverName: 'Nguyễn An', type: 'x' })).toBe(false);
    expect(isLeaveApproverFor('u1', 'Nguyễn An', { approverName: 'Nguyễn An', type: 'x' })).toBe(true);   // đơn cũ chưa có mã
  });
  it('App (huy hiệu) và Việc của tôi dùng chung quy tắc', () => {
    expect(fs.readFileSync('src/App.tsx', 'utf8')).toMatch(/isPaymentPendingForUser\(p, currentUser/);
    expect(fs.readFileSync('src/components/TaskManagement.tsx', 'utf8')).toMatch(/isPaymentPendingForUser\(p, currentUser/);
  });
});

describe('Nhóm 3 — tìm nhân viên theo tên: chính xác, duy nhất', () => {
  const emps = [{ id: 'e1', name: 'Nguyễn Thị Ánh Ngọc' }, { id: 'e2', name: 'Vũ Đình Ngọc' }, { id: 'e3', name: 'An' }, { id: 'e4', name: 'Bảo An' }, { id: 'e5', name: 'Lê Văn Cường' }, { id: 'e6', name: ' Lê  Văn Cường ' }];
  it('findUniqueEmployeeByName: không còn khớp một phần', () => {
    expect(findUniqueEmployeeByName(emps, 'Ngọc')).toBeUndefined();            // trước đây "includes" chọn nhầm
    expect(findUniqueEmployeeByName(emps, 'An')!.id).toBe('e3');               // đúng "An", không phải "Bảo An"
    expect(findUniqueEmployeeByName(emps, 'vũ đình ngọc')!.id).toBe('e2');     // không phân biệt hoa/thường
  });
  it('trùng tên (≥2 người) → không đoán', () => {
    expect(findUniqueEmployeeByName(emps, 'Lê Văn Cường')).toBeUndefined();
    expect(findUniqueEmployeeByName(emps, '')).toBeUndefined();
  });
  it('findEmployeeByName (chat): bỏ chức danh trong ngoặc; không khớp một phần', () => {
    expect(findEmployeeByName(emps, 'Vũ Đình Ngọc (Giám đốc)')!.id).toBe('e2');
    expect(findEmployeeByName(emps, 'Ngọc')).toBeUndefined();
    expect(findEmployeeByName(emps, 'Bảo')).toBeUndefined();
  });
  it('nơi dùng: nhập Excel nhiệm vụ, chọn người duyệt nghỉ phép theo mã', () => {
    expect(fs.readFileSync('src/components/TaskDetailModal.tsx', 'utf8')).toMatch(/findUniqueEmployeeByName\(employees, name\)/);
    expect(fs.readFileSync('src/components/MissionConfigEditor.tsx', 'utf8')).toMatch(/findUniqueEmployeeByName\(employees, name\)/);
    expect(fs.readFileSync('src/components/DashboardOverview.tsx', 'utf8')).toMatch(/em\.id === e\.target\.value/);
  });
});
