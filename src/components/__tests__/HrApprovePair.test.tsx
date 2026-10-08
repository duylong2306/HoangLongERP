import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

// Kiểm chứng LUỒNG THẬT trong màn hình Nhân sự: 2 đơn "Báo cáo nghỉ ca" (sáng + chiều) cùng ngày → bấm "Duyệt cả ngày" MỘT lần →
// cả hai đơn được duyệt và lưu (không bị ghi đè lẫn nhau); "Từ chối cả ngày" → cả hai bị từ chối.
const chatMock = vi.hoisted(() => ({ sendGroupChatMessage: vi.fn().mockResolvedValue(null), sendApprovalDirectMessage: vi.fn().mockResolvedValue(null) }));
vi.mock('../../lib/chatStore', () => chatMock);
vi.mock('../../context', () => ({
  useNotification: () => ({ addToast: vi.fn() }),
  isUserInRoleGroup: () => true, isRoleAdmin: () => true, isRoleAccounting: () => true, isRoleOffice: () => true, isRoleTechnical: () => true,
  getConfiguredSettler: () => null, getConfiguredSettlers: () => [],
  getAccentClasses: () => '', getConfiguredApprover: () => null, getConfiguredApprovers: () => [],
  hasModulePermission: () => true,
}));

vi.mock('../../context/SettingsContext', () => ({ useSettings: () => ({ settings: {}, businessInfo: { companyName: 'Cty thử' }, hrmConfig: {} }) }));

const d = `${new Date().getFullYear()}-01-10`;
const mkLeave = (id: string, shift: string) => ({ id, empId: 'NV018', empName: 'Lê Văn Công', type: 'Báo cáo nghỉ ca', shift, fromDate: d, toDate: d, daysCount: 1, status: 'pending', reason: `[Vắng mặt / Không điểm danh] - Lý do: Em bị ốm`, isAttendanceCorrection: true, approverName: 'Admin', approverId: 'admin1' });
const leaveStore: any[] = [];
const leaveSave = vi.fn().mockImplementation((l: any) => { const i = leaveStore.findIndex(x => x.id === l.id); if (i >= 0) leaveStore[i] = l; else leaveStore.push(l); return Promise.resolve(); });
const attendanceSave = vi.fn().mockResolvedValue(undefined);

vi.mock('../../lib/dbService', () => {
  const makeTable = (extra: Record<string, any> = {}) => ({ list: vi.fn().mockResolvedValue([]), save: vi.fn().mockResolvedValue(undefined), delete: vi.fn().mockResolvedValue(undefined), deleteMultiple: vi.fn().mockResolvedValue(undefined), get: vi.fn().mockResolvedValue(null), ...extra });
  const target: any = {
    hrmLeaves: { ...makeTable(), list: vi.fn().mockImplementation(() => Promise.resolve(JSON.parse(JSON.stringify(leaveStore)))), save: (...a: any[]) => leaveSave(...a) },
    attendance: { ...makeTable(), save: (...a: any[]) => attendanceSave(...a), listForRange: vi.fn().mockResolvedValue([]), getCachedRange: vi.fn().mockReturnValue(null) },
    employees: { ...makeTable(), list: vi.fn().mockResolvedValue([{ id: 'NV018', name: 'Lê Văn Công', status: 'working', phepNam: 12 }]) },
  };
  return { dbService: new Proxy(target, { get(t: any, p: string) { if (p in t) return t[p]; t[p] = makeTable(); return t[p]; } }), camelToSnake: (s: string) => s, snakeToCamel: (s: string) => s };
});

import HumanResourcesManagement from '../HumanResourcesManagement';

beforeEach(() => { cleanup(); leaveStore.length = 0; leaveStore.push(mkLeave('LR-001', 'morning'), mkLeave('LR-002', 'afternoon')); leaveSave.mockClear(); localStorage.clear(); });

const admin = { id: 'admin1', name: 'Admin', role: 'director', roleGroupIds: ['role_admin'] } as any;
const open = async () => {
  const { container } = render(<HumanResourcesManagement currentUser={admin} defaultSubTab="leaves" hideSidebar systemConfig={{} as any} />);
  await waitFor(() => expect(container.textContent).toContain('Cả ngày (sáng + chiều)'), { timeout: 4000 });
  // Màn hình tạm KHÔNG ghi lên cơ sở dữ liệu trong ~0,5 giây đầu sau khi tải danh sách từ máy chủ (chống ghi đè) — người dùng thật bấm sau đó
  await new Promise(r => setTimeout(r, 800));
  fireEvent.click(container.querySelector('tbody tr')!);
  return container;
};

describe('Màn hình Nhân sự — duyệt cả ngày (luồng thật)', () => {
  it('Duyệt cả ngày: cả 2 đơn đều thành "approved" và được lưu', async () => {
    await open();
    fireEvent.click(await screen.findByText('Duyệt cả ngày ✅'));
    await waitFor(() => expect(leaveStore.map(l => l.status)).toEqual(['approved', 'approved']), { timeout: 4000 });
  });
  it('Từ chối cả ngày: cả 2 đơn đều thành "rejected"', async () => {
    await open();
    fireEvent.click(await screen.findByText('Từ chối cả ngày'));
    await waitFor(() => expect(leaveStore.map(l => l.status)).toEqual(['rejected', 'rejected']), { timeout: 4000 });
  });
});
