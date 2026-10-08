import { describe, it, expect, vi } from 'vitest';

// "Xem quyền hiệu lực của một nhân viên": phải dùng đúng can() và chỉ rõ nguồn quyền (vị trí / nhóm / toàn quyền).
vi.mock('../../../lib/dbService', () => ({ dbService: { projectPermissions: { get: vi.fn(async () => null), save: vi.fn() } } }));
const NHOM = [
  { id: 'g_ketoan', name: 'Kế toán', memberIds: ['KT'], kind: 'accounting' },
  { id: 'g_xuong', name: 'Xưởng', memberIds: ['TH'], kind: null },
  { id: 'role_superadmin', name: 'Siêu admin', memberIds: ['SA'], kind: null },
];
vi.mock('../../../context', () => ({
  isUserInRoleGroup: (id: string, g: string) => NHOM.some(n => n.id === g && n.memberIds.includes(id)) || NHOM.find(n => n.id === 'role_superadmin')!.memberIds.includes(id),
  isRoleAdmin: (id: string) => NHOM.find(n => n.id === 'role_superadmin')!.memberIds.includes(id),
  isRoleAccounting: (id: string) => NHOM.find(n => n.kind === 'accounting')!.memberIds.includes(id),
}));
import { previewEmployeePermissions, resolveRoleGroupIds } from '../effectivePermissions';
import { DEFAULT_PROJECT_PERMISSIONS } from '../hrProjectPermissions';

const matrix: any = {
  ...DEFAULT_PROJECT_PERMISSIONS,
  roleGroupMatrix: { roleGroupActions: { g_ketoan: ['createProject', 'moveCard'] } },
};
const emp = (id: string, roleGroupIds: string[]) => ({ id, name: id, roleGroupIds } as any);
const o = (rows: any[], a: string) => rows.find(r => r.action === a).cells;

describe('Xem quyền hiệu lực của một nhân viên', () => {
  it('nhân viên xưởng: không tạo được dự án ở cấp bảng; làm Trưởng DA của dự án thì có (nguồn: vị trí)', () => {
    const r = previewEmployeePermissions(emp('TH', ['g_xuong']), matrix);
    expect(o(r, 'createProject').board).toBeNull();
    expect(o(r, 'createProject').pm).toBe('vitri');
  });
  it('Kế toán: tạo dự án/kéo thẻ (mặc định chỉ cấp cho NHÓM) → nguồn là nhóm; nếu tick thêm vai trò Kế toán ở "Theo vị trí" thì nguồn là vị trí', () => {
    const r = previewEmployeePermissions(emp('KT', ['g_ketoan']), matrix);
    expect(o(r, 'createProject').board).toBe('nhom');
    expect(o(r, 'moveCard').board).toBe('nhom');
    const m2 = { ...matrix, actions: { ...matrix.actions, createProject: ['director', 'pm', 'accountant'] } };
    expect(o(previewEmployeePermissions(emp('KT', ['g_ketoan']), m2), 'createProject').board).toBe('vitri');
  });
  it('siêu admin: mọi ô đều là "toàn quyền"', () => {
    const r = previewEmployeePermissions(emp('SA', []), matrix);
    for (const row of r) for (const v of Object.values(row.cells)) expect(['toanquyen', 'khongapdung']).toContain(v);
  });
  it('hành động theo công việc: Người giao việc sửa được công việc của mình, Phụ trách CV thì không (mặc định)', () => {
    const r = previewEmployeePermissions(emp('TH', ['g_xuong']), matrix);
    expect(o(r, 'editTask').assigner).toBe('vitri');
    expect(o(r, 'editTask').assignee).toBeNull();
    expect(o(r, 'editTask').board).toBe('khongapdung');         // sửa công việc luôn kiểm tra kèm công việc → không có cột "bảng"
    expect(o(r, 'createProject').assigner).toBe('khongapdung'); // hành động cấp dự án không có cột theo công việc
  });
  it('chỉ liệt kê hành động CÓ tác dụng (không có ô "Chưa áp dụng")', () => {
    const r = previewEmployeePermissions(emp('TH', []), matrix);
    expect(r.map(x => x.action)).not.toContain('exportProject');
    expect(r.map(x => x.action)).toContain('createProject');
  });
  it('resolveRoleGroupIds: dùng trường riêng nếu có, nếu rỗng thì suy ra từ danh sách thành viên nhóm', () => {
    expect(resolveRoleGroupIds({ id: 'KT', roleGroupIds: ['x'] }, NHOM as any)).toEqual(['x']);
    expect(resolveRoleGroupIds({ id: 'KT' }, NHOM as any)).toEqual(['g_ketoan']);
  });
});
