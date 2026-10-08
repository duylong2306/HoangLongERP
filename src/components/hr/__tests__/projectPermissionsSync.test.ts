import { describe, it, expect, vi } from 'vitest';

// Hồi quy: nhân viên KHÔNG phải admin (VD Kế toán) chỉ có quyền theo NHÓM VAI TRÒ sau khi ma trận quyền đã được nạp từ cơ sở dữ liệu.
// Trước khi nạp, bộ nhớ đệm là giá trị mặc định (chưa có quyền theo nhóm) → mọi nút bị khóa. Vì vậy App PHẢI nạp ma trận ngay khi đăng nhập
// (xem effect "NẠP MA TRẬN QUYỀN" trong App.tsx).
const H = vi.hoisted(() => ({
  cloud: {
    version: 2, inheritBelow: true,
    actions: { createCard: ['director', 'pm', 'assigner', 'assignee'], createProject: ['director', 'pm', 'accountant'], createColumn: ['director', 'pm'] },
    visibility: { accountant: 'all', teamMember: 'all' },
    roleGroupMatrix: { roleGroupActions: { role_ketoan: ['createProject', 'createCard', 'createColumn'] } },
  } as any,
}));
vi.mock('../../../lib/dbService', () => ({ dbService: { projectPermissions: { get: vi.fn(async () => H.cloud), save: vi.fn() } } }));
// NV004 thuộc nhóm "Kế toán" (loại kế toán) → vai trò theo dự án là 'accountant'
vi.mock('../../../context', () => ({ isUserInRoleGroup: () => false, isRoleAdmin: () => false, isRoleAccounting: () => true }));
import { can, syncProjectPermissionsFromDb, loadProjectPermissions } from '../hrProjectPermissions';

const ketoan = { id: 'NV004', name: 'Kế toán', role: 'engineer', roleGroupIds: ['role_ketoan'] } as any;
const duAn = { id: 'p1', pmId: 'NV_khac', type: 'construction' } as any;

describe('Ma trận quyền dự án — phải nạp từ cơ sở dữ liệu thì quyền theo nhóm mới có hiệu lực', () => {
  it('CHƯA nạp: Kế toán bị từ chối (đúng triệu chứng "Không có quyền THÊM dự án")', () => {
    expect(can('createCard', ketoan, duAn)).toBe(false);
    expect(can('createColumn', ketoan, duAn)).toBe(false);
    expect((loadProjectPermissions() as any).roleGroupMatrix).toBeUndefined();
  });
  it('SAU khi nạp từ cơ sở dữ liệu: Kế toán được phép các quyền đã cấp cho nhóm', async () => {
    await syncProjectPermissionsFromDb();
    expect(can('createCard', ketoan, duAn)).toBe(true);
    expect(can('createProject', ketoan, duAn)).toBe(true);
    expect(can('createColumn', ketoan, duAn)).toBe(true);
  });
});
