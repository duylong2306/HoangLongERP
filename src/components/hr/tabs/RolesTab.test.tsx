import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RolesTab from './RolesTab';
import { useState } from 'react';

// Mock the context and helper functions
jest.mock('../../../context', () => ({
  isUserInRoleGroup: jest.fn(),
  loadHrmRoleGroups: jest.fn(),
  getConfiguredApprover: jest.fn(),
  loadApprovalConfig: jest.fn(() => []),
  saveApprovalConfig: jest.fn(),
}));

import { loadApprovalConfig, saveApprovalConfig } from '../../../context';

// Mock employees data
const mockEmployees = [
  { id: '1', name: 'John Doe', position: 'Giám đốc' },
  { id: '2', name: 'Jane Smith', position: 'Quản lý' },
];

const renderComponent = () => {
  const [roleMainTab, setRoleMainTab] = useState<'group' | 'task' | 'approval'>('approval');
  const [roles, setRoles] = useState<any>([
    { id: 'r1', name: 'Nhóm A', permissions: {}, memberIds: [] },
  ]);
  const props = {
    roles,
    setRoles,
    selectedRoleId: 'r1',
    setSelectedRoleId: jest.fn(),
    showAddRoleModal: false,
    setShowAddRoleModal: jest.fn(),
    newRoleName: '',
    setNewRoleName: jest.fn(),
    newRoleDesc: '',
    setNewRoleDesc: jest.fn(),
    roleSearchQuery: '',
    setRoleSearchQuery: jest.fn(),
    selectedTempEmpIds: [],
    setSelectedTempEmpIds: jest.fn(),
    isRoleDropdownOpen: false,
    setIsRoleDropdownOpen: jest.fn(),
    confirmRemoveMember: null,
    setConfirmRemoveMember: jest.fn(),
    employees: mockEmployees,
    syncHrmPermissionsToApp: jest.fn(),
    onSaveProjectPermissions: jest.fn(),
    currentUser: { id: '1', name: 'Admin', position: 'Admin' } as any,
    allEmployees: mockEmployees as any,
  };
  return render(<RolesTab {...props} />);
};

describe('RolesTab – Permission Approval tab (độc lập)', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    (loadApprovalConfig as jest.Mock).mockReturnValue([]);
  });

  it('hiển thị tiêu đề "Cấu hình Quyền Phê Duyệt"', () => {
    renderComponent();
    expect(screen.getByText('🛡️ Cấu hình Quyền Phê Duyệt')).toBeInTheDocument();
  });

  it('bật checkbox Quyền Phê Duyệt → gọi saveApprovalConfig với dữ liệu mới', async () => {
    renderComponent();
    // Tìm checkbox "Báo Giá"
    const checkbox = screen.getByText('Báo Giá').closest('div')?.querySelector('input[type="checkbox"]');
    if (!checkbox) throw new Error('Không tìm thấy checkbox Báo Giá');
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(saveApprovalConfig).toHaveBeenCalled();
      const saved = (saveApprovalConfig as jest.Mock).mock.calls[0][0];
      expect(saved.some((p: any) => p.documentType === 'quotation')).toBe(true);
    });
  });
});
