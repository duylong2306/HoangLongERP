import { describe, it, expect } from 'vitest';
import { setRoleGroupsCache, hasModulePermission } from '../SettingsContext';

// PHÁT HIỆN KHI KIỂM THỬ TRỰC TIẾP (2026-09): tài khoản thật NV004 (nhóm "Kế toán") vẫn Thêm/Sửa/Xóa
// được ở "Quản lý tồn kho" dù ô Thêm/Sửa/Xóa của module con đó đã bị TẮT RIÊNG trong Phân Quyền —
// vì menu cha "Kho & Vật Tư" (warehouse_office) vẫn BẬT (nhờ 2 module con khác còn bật), và
// hasModulePermission() cũ luôn OR quyền con với quyền cha bất kể con đã có cấu hình riêng hay
// chưa. Sửa: quyền module con, MỘT KHI ĐÃ CÓ CẤU HÌNH RIÊNG (dù đang tắt), luôn thắng quyền cha.
describe('hasModulePermission — quyền module con đã cấu hình riêng phải thắng quyền menu cha', () => {
  // Dữ liệu THẬT lấy từ nhóm "Kế toán" của công ty (localStorage 'hl_role_groups_cache_v1'):
  // menu cha "Kho & Vật Tư" (warehouse_office) full quyền, nhưng module con "Quản lý tồn kho"
  // (warehouse_management) bị tắt hết Thêm/Sửa/Xóa riêng.
  const REAL_KETOAN_GROUP = {
    id: 'role_custom_1784881020261',
    name: 'Kế toán',
    memberIds: ['NV004', 'NV007'],
    permissions: {
      warehouse_office: { view: true, create: true, edit: true, delete: true },
      warehouse_management: { view: true, create: false, edit: false, delete: false },
      material_coordination: { view: true, create: true, edit: true, delete: true },
      warehouse_suppliers: { view: true, create: true, edit: true, delete: true },
      employees: { view: true, create: false, edit: false, delete: false },
      __role_kind__accounting: { view: true, create: false, edit: false, delete: false },
    },
  } as any;

  it('module con đã tắt riêng (warehouse_management) → từ chối, KHÔNG kế thừa quyền menu cha đang bật', () => {
    setRoleGroupsCache([REAL_KETOAN_GROUP]);
    expect(hasModulePermission('NV004', 'warehouse_management', 'create')).toBe(false);
    expect(hasModulePermission('NV004', 'warehouse_management', 'edit')).toBe(false);
    expect(hasModulePermission('NV004', 'warehouse_management', 'delete')).toBe(false);
    expect(hasModulePermission('NV004', 'warehouse_management', 'view')).toBe(true); // view vẫn bật riêng
  });

  it('module con khác chưa từng cấu hình riêng vẫn kế thừa đúng quyền menu cha (hành vi cũ giữ nguyên)', () => {
    const group = { ...REAL_KETOAN_GROUP, permissions: { ...REAL_KETOAN_GROUP.permissions } };
    delete group.permissions.material_coordination; // giả lập "chưa từng cấu hình riêng"
    setRoleGroupsCache([group]);
    expect(hasModulePermission('NV004', 'material_coordination', 'create')).toBe(true); // kế thừa từ warehouse_office
  });

  it('module employees đã tắt riêng → từ chối dù menu cha khác (nếu có) đang bật', () => {
    setRoleGroupsCache([REAL_KETOAN_GROUP]);
    expect(hasModulePermission('NV004', 'employees', 'create')).toBe(false);
    expect(hasModulePermission('NV004', 'employees', 'delete')).toBe(false);
  });

  it('module con đã bật riêng vẫn hoạt động bình thường (không bị ảnh hưởng bởi sửa lỗi)', () => {
    setRoleGroupsCache([REAL_KETOAN_GROUP]);
    expect(hasModulePermission('NV004', 'warehouse_suppliers', 'create')).toBe(true);
    expect(hasModulePermission('NV004', 'warehouse_suppliers', 'delete')).toBe(true);
  });

  it('Admin (kể cả gán qua "loại nhóm") vẫn luôn full quyền mọi module, bất kể cấu hình', () => {
    const adminGroup = { id: 'role_custom_admin', name: 'Giám Đốc', memberIds: ['NV003'], permissions: { __role_kind__admin: { view: true, create: false, edit: false, delete: false } } };
    setRoleGroupsCache([REAL_KETOAN_GROUP, adminGroup] as any);
    expect(hasModulePermission('NV003', 'warehouse_management', 'delete')).toBe(true);
    expect(hasModulePermission('NV003', 'employees', 'create')).toBe(true);
  });
});
