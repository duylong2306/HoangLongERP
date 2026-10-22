// Giám đốc không tự thấy việc duyệt của người khác: chỉ khi được chỉ định, hoặc loại đó chưa chỉ định ai (dự phòng).
import { describe, it, expect, beforeEach } from 'vitest';
import { setRoleGroupsCache, setApprovalConfigCache, isAdminFallbackForPayment, isAdminFallbackForProposal, isAdminFallbackApprover, canSeeTravelExpenseApproval } from '../../context/SettingsContext';

const grp = (id: string, memberIds: string[], kind: string) => ({
  id, name: id, memberIds,
  permissions: { [`__role_kind__${kind}`]: { view: true, create: false, edit: false, delete: false } },
}) as any;
const cfg = (documentType: string, ids: string[]) => ({ documentType, canApprove: true, approverId: ids.join(','), approverName: ids.join(','), approverPosition: '' }) as any;

describe('Giám đốc & danh sách chờ duyệt', () => {
  beforeEach(() => setRoleGroupsCache([grp('g_gd', ['gd'], 'admin'), grp('g_kt', ['kt'], 'accounting')]));

  it('loại đã chỉ định người duyệt khác → Giám đốc KHÔNG tự thấy', () => {
    setApprovalConfigCache([cfg('material_approver', ['kt'])] as any);
    expect(isAdminFallbackApprover('gd', 'material_approver')).toBe(false);
  });
  it('loại chưa chỉ định ai → Giám đốc là người duyệt dự phòng', () => {
    setApprovalConfigCache([] as any);
    expect(isAdminFallbackApprover('gd', 'material_approver')).toBe(true);
    expect(isAdminFallbackForPayment('gd', { category: 'salary_advance' })).toBe(true);
    expect(isAdminFallbackForProposal('gd', {})).toBe(true);
  });
  it('người không thuộc nhóm Giám đốc không bao giờ được dự phòng', () => {
    setApprovalConfigCache([] as any);
    expect(isAdminFallbackApprover('kt', 'material_approver')).toBe(false);
  });
  it('công tác phí: đã cấu hình → đúng người đó, kể cả Giám đốc không có tên thì không thấy', () => {
    setApprovalConfigCache([cfg('travel_expense', ['kt'])] as any);
    expect(canSeeTravelExpenseApproval('kt')).toBe(true);
    expect(canSeeTravelExpenseApproval('gd')).toBe(false);
  });
});
