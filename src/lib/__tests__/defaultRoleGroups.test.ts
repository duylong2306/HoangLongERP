import { describe, it, expect } from 'vitest';
import { DEFAULT_ROLE_GROUPS, DEFAULT_ROLE_GROUP_PROJECT_ACTIONS, ALL_MODULES, buildInitialProjectPermissionMatrix } from '../../../api/_defaultRoleGroups';
import { getRoleGroupKind } from '../../context/SettingsContext';
import { DEFAULT_PROJECT_PERMISSIONS } from '../../components/hr/hrProjectPermissions';

// Bộ nhóm mẫu cấp cho công ty mới: phải có "Loại nhóm" (nếu thiếu, người trong nhóm không được tính là Giám đốc/Kế toán ở Quyền Dự Án).
describe('nhóm vai trò mẫu của công ty mới', () => {
  it('mỗi nhóm có "Loại nhóm" đọc lại được bằng getRoleGroupKind, đủ 4 loại', () => {
    const kinds = DEFAULT_ROLE_GROUPS.map(g => getRoleGroupKind(g.permissions as any)).sort();
    expect(kinds).toEqual(['accounting', 'admin', 'office', 'technical']);
  });
  it('id cố định cũ được giữ để code cũ nhận diện theo id', () => {
    expect(DEFAULT_ROLE_GROUPS.map(g => g.id).sort()).toEqual(['role_accounting', 'role_admin', 'role_office', 'role_technical']);
  });
  it('Ban Giám Đốc toàn quyền mọi phân hệ; nhóm Kỹ thuật/Xưởng không được sửa/xóa phân hệ nào', () => {
    const admin = DEFAULT_ROLE_GROUPS.find(g => g.id === 'role_admin')!;
    for (const m of ALL_MODULES) expect(admin.permissions[m]).toEqual({ view: true, create: true, edit: true, delete: true });
    const kt = DEFAULT_ROLE_GROUPS.find(g => g.id === 'role_technical')!;
    for (const [k, v] of Object.entries(kt.permissions)) if (!k.startsWith('__role_kind__')) expect(v.create || v.edit || v.delete).toBe(false);
  });
  it('mọi action trong Quyền Dự Án theo nhóm đều là action có thật trong ma trận mặc định (không gõ sai tên)', () => {
    const hopLe = new Set(Object.keys(DEFAULT_PROJECT_PERMISSIONS.actions));
    for (const acts of Object.values(DEFAULT_ROLE_GROUP_PROJECT_ACTIONS)) for (const a of acts) expect(hopLe.has(a), a).toBe(true);
  });
  it('Kế toán được tạo dự án (đúng bug Ngọc Thịnh) nhưng KHÔNG được xóa dự án/xóa cột', () => {
    const kt = DEFAULT_ROLE_GROUP_PROJECT_ACTIONS.role_accounting;
    expect(kt).toContain('createProject');
    expect(kt).not.toContain('deleteProject');
    expect(kt).not.toContain('deleteColumn');
  });
  it('ma trận khởi tạo chỉ chứa phần theo nhóm (phần theo vị trí lấy mặc định ứng dụng)', () => {
    const m: any = buildInitialProjectPermissionMatrix();
    expect(m.actions).toBeUndefined();
    expect(Object.keys(m.roleGroupMatrix.roleGroupActions).sort()).toEqual(['role_accounting', 'role_admin', 'role_office', 'role_technical']);
  });
});
