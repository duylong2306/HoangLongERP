import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// Trang Phân quyền phải kiểm tra quyền: không có quyền Xem → chặn hẳn; chỉ có quyền Xem → hiện cảnh báo chỉ-xem; có quyền Sửa → bình thường.
const Q = vi.hoisted(() => ({ xem: false, sua: false }));
vi.mock('../../lib/dbService', () => ({ dbService: { projectPermissions: { get: vi.fn(async () => null), save: vi.fn() }, hrmTaskPermissions: { get: vi.fn(async () => null), save: vi.fn() }, hrmRoleGroups: { save: vi.fn(), delete: vi.fn() }, employees: { list: vi.fn(async () => []), save: vi.fn() } } }));
vi.mock('../../lib/supabase', () => ({ getSupabase: () => null, getCurrentCompanyId: () => 'c1' }));
vi.mock('../../context', () => ({
  loadApprovalConfig: () => [], syncApprovalConfigFromDb: async () => [], saveApprovalConfig: vi.fn(), saveDefaultSnapshot: vi.fn(), loadDefaultSnapshot: () => null,
  useNotification: () => ({ addToast: vi.fn() }), hasModulePermission: (_id: string, mod: string, act: string) => mod === 'settings_roles' && (act === 'view' ? Q.xem : Q.sua),
  setRoleGroupsCache: vi.fn(), setApprovalConfigCache: vi.fn(), encodeApprovalApprovers: vi.fn(), getRoleGroupKind: () => null, withRoleGroupKind: (p: any) => p,
  ROLE_GROUP_KIND_LABELS: {}, loadHrmRoleGroups: () => [], isUserInRoleGroup: () => false, isRoleAdmin: () => false, isRoleAccounting: () => false,
}));
import RolesTab from '../hr/tabs/RolesTab';

afterEach(cleanup);
const props: any = {
  roles: [], setRoles: () => {}, selectedRoleId: '', setSelectedRoleId: () => {}, showAddRoleModal: false, setShowAddRoleModal: () => {}, newRoleName: '', setNewRoleName: () => {},
  newRoleDesc: '', setNewRoleDesc: () => {}, roleSearchQuery: '', setRoleSearchQuery: () => {}, selectedTempEmpIds: [], setSelectedTempEmpIds: () => {}, isRoleDropdownOpen: false,
  setIsRoleDropdownOpen: () => {}, confirmRemoveMember: null, setConfirmRemoveMember: () => {}, employees: [], syncHrmPermissionsToApp: () => {}, onSaveProjectPermissions: () => {},
  currentUser: { id: 'NV9', name: 'Nhân viên' }, allEmployees: [],
};

describe('RolesTab — kiểm soát truy cập', () => {
  it('không có quyền Xem → chỉ hiện thông báo chặn, không có nội dung phân quyền', () => {
    Q.xem = false; Q.sua = false;
    render(<RolesTab {...props} />);
    expect(screen.getByRole('alert')).toHaveTextContent('không có quyền truy cập');
    expect(screen.queryByText(/Phân Quyền Nhóm Vai Trò/)).toBeNull();
  });
  it('chỉ có quyền Xem → vào được nhưng có cảnh báo chỉ-xem', () => {
    Q.xem = true; Q.sua = false;
    render(<RolesTab {...props} />);
    expect(screen.getByRole('note')).toHaveTextContent('chỉ có quyền XEM');
    expect(screen.getAllByText(/Phân Quyền Nhóm Vai Trò/).length).toBeGreaterThan(0);
  });
  it('có quyền Sửa → không có cảnh báo, nội dung bình thường', () => {
    Q.xem = true; Q.sua = true;
    render(<RolesTab {...props} />);
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getAllByText(/Phân Quyền Nhóm Vai Trò/).length).toBeGreaterThan(0);
  });
});
