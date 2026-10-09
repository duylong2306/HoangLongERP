import { describe, it, expect, beforeEach } from 'vitest';
import {
  setApprovalConfigCache, setRoleGroupsCache, encodeApprovalApprovers,
  canApproveProjectDoc, isLeaveApproverFor, canApproveTravelExpense, leaveApprovalDocType,
} from '../SettingsContext';
import type { ApprovalPermission } from '../SettingsContext';

// Rà soát Quyền Phê Duyệt (09/10/2026): các hàm kiểm tra người duyệt dùng chung phải đúng theo cấu hình.
const cfg = (documentType: ApprovalPermission['documentType'], ids: string[], canApprove = true): ApprovalPermission => {
  const e = encodeApprovalApprovers(ids.map(id => ({ id, name: `Tên ${id}` })));
  return { id: `ap_${documentType}`, documentType, documentTypeLabel: documentType, approverId: e.id, approverName: e.name, approverPosition: e.position, canApprove } as any;
};
const kind = (k: string) => ({ [`__role_kind__${k}`]: { view: true, create: false, edit: false, delete: false } });

beforeEach(() => {
  setApprovalConfigCache([]);
  setRoleGroupsCache([
    { id: 'g_gd', name: 'Giám đốc', memberIds: ['GD'], permissions: kind('admin') },
    { id: 'g_kt', name: 'Kế toán', memberIds: ['KT'], permissions: kind('accounting') },
  ] as any);
});

describe('canApproveProjectDoc — Báo Giá / Hợp Đồng / Nghiệm Thu / Thanh Lý', () => {
  it('chưa cấu hình → không hạn chế (giữ hành vi cũ)', () => {
    expect(canApproveProjectDoc('NV1', 'contract')).toBe(true);
  });
  it('đã bật nhưng danh sách trống → không hạn chế', () => {
    setApprovalConfigCache([cfg('contract', [])]);
    expect(canApproveProjectDoc('NV1', 'contract')).toBe(true);
  });
  it('đã chọn người → chỉ người đó + Giám đốc', () => {
    setApprovalConfigCache([cfg('contract', ['A', 'B'])]);
    expect(canApproveProjectDoc('A', 'contract')).toBe(true);
    expect(canApproveProjectDoc('B', 'contract')).toBe(true);
    expect(canApproveProjectDoc('NV1', 'contract')).toBe(false);
    expect(canApproveProjectDoc('GD', 'contract')).toBe(true);
    expect(canApproveProjectDoc('NV1', 'quotation')).toBe(true); // loại khác chưa cấu hình
  });
  it('loại bị TẮT (canApprove=false) → không hạn chế', () => {
    setApprovalConfigCache([cfg('quotation', ['A'], false)]);
    expect(canApproveProjectDoc('NV1', 'quotation')).toBe(true);
  });
});

describe('isLeaveApproverFor — nghỉ phép / tạm ứng lương nhanh nhiều người duyệt', () => {
  beforeEach(() => setApprovalConfigCache([cfg('leave', ['A', 'B']), cfg('salary_advance', ['C', 'D'])]));
  it('người ghi trên đơn luôn duyệt được', () => {
    expect(isLeaveApproverFor('A', 'Tên A', { type: 'Nghỉ phép năm', approverId: 'A' })).toBe(true);
  });
  it('người THỨ HAI trong danh sách cũng duyệt được đơn giao cho người đầu', () => {
    expect(isLeaveApproverFor('B', 'Tên B', { type: 'Nghỉ phép năm', approverId: 'A', approverName: 'Tên A' })).toBe(true);
  });
  it('đơn giao riêng cho người NGOÀI danh sách → người trong danh sách không tự duyệt được', () => {
    expect(isLeaveApproverFor('B', 'Tên B', { type: 'Nghỉ phép năm', approverId: 'X', approverName: 'Người X' })).toBe(false);
  });
  it('đơn chưa giao ai → người trong danh sách duyệt được; người ngoài thì không', () => {
    expect(isLeaveApproverFor('B', 'Tên B', { type: 'Nghỉ phép năm' })).toBe(true);
    expect(isLeaveApproverFor('Z', 'Tên Z', { type: 'Nghỉ phép năm' })).toBe(false);
  });
  it('tạm ứng lương nhanh dùng danh sách riêng của salary_advance', () => {
    expect(leaveApprovalDocType({ type: 'Tạm ứng lương nhanh' })).toBe('salary_advance');
    expect(isLeaveApproverFor('D', 'Tên D', { type: 'Tạm ứng lương nhanh', approverId: 'C' })).toBe(true);
    expect(isLeaveApproverFor('B', 'Tên B', { type: 'Tạm ứng lương nhanh', approverId: 'C' })).toBe(false);
  });
});

describe('canApproveTravelExpense — một quy tắc cho cả 3 nơi', () => {
  it('đã cấu hình → đúng những người đó (+ Giám đốc); Kế toán KHÔNG tự duyệt', () => {
    setApprovalConfigCache([cfg('travel_expense', ['A', 'B'])]);
    expect(canApproveTravelExpense('A')).toBe(true);
    expect(canApproveTravelExpense('B')).toBe(true);
    expect(canApproveTravelExpense('KT')).toBe(false);
    expect(canApproveTravelExpense('GD')).toBe(true);
  });
  it('chưa cấu hình ai → dự phòng cho Kế toán', () => {
    expect(canApproveTravelExpense('KT')).toBe(true);
    expect(canApproveTravelExpense('NV1')).toBe(false);
  });
});
