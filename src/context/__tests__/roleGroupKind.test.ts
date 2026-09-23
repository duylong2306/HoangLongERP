import { describe, it, expect, beforeEach } from 'vitest';
import { setRoleGroupsCache, isRoleAdmin, isRoleAccounting, isRoleOffice, isRoleTechnical, getRoleGroupKind, withRoleGroupKind } from '../SettingsContext';

// Khắc phục phát hiện ở realDataPermissionAudit.test.ts: nhóm tùy chỉnh (id role_custom_*) giờ có
// thể được ADMIN GÁN THỦ CÔNG "loại nhóm" (dropdown "Loại nhóm hệ thống" trong RolesTab.tsx) để các
// đặc quyền viết cứng trong app (isRoleAdmin/isRoleAccounting/isRoleOffice/isRoleTechnical) nhận
// diện đúng, không còn phụ thuộc vào id/tên nhóm phải trùng đúng quy ước cũ.
describe('"Loại nhóm" — khắc phục kiểm tra quyền không khớp dữ liệu thật (id role_custom_*)', () => {
  const REAL_ROLE_GROUPS = [
    { id: 'role_custom_1784881020261', name: 'Kế toán', memberIds: ['NV004', 'NV007'], permissions: {} },
    { id: 'role_custom_1784610919977', name: 'Giám Đốc', memberIds: ['NV003'], permissions: {} },
    { id: 'role_custom_1785639772625', name: 'Nhân viên Văn phòng', memberIds: ['NV008'], permissions: {} },
    { id: 'role_custom_1785467660409', name: 'Nhân viên Xưởng', memberIds: ['NV025'], permissions: {} },
    { id: 'role_superadmin', name: 'Siêu Admin (Super Admin)', memberIds: ['NV001'], permissions: {} },
  ] as any;

  it('withRoleGroupKind() rồi getRoleGroupKind() phải trả lại đúng kind vừa gán (roundtrip), không đụng các module permission khác', () => {
    const original = { finance: { view: true, create: true, edit: false, delete: false } };
    const withKind = withRoleGroupKind(original, 'accounting');
    expect(getRoleGroupKind(withKind)).toBe('accounting');
    expect(withKind.finance).toEqual(original.finance); // không mất permission module thật đã có

    const cleared = withRoleGroupKind(withKind, null);
    expect(getRoleGroupKind(cleared)).toBeNull();
    expect(cleared.finance).toEqual(original.finance);
  });

  it('gán kind cho nhóm "Kế toán" thật (id role_custom_*) → isRoleAccounting() nhận diện đúng thành viên (trước đây luôn false)', () => {
    const groups = REAL_ROLE_GROUPS.map((g: any) =>
      g.id === 'role_custom_1784881020261' ? { ...g, permissions: withRoleGroupKind(g.permissions, 'accounting') } : g
    );
    setRoleGroupsCache(groups);
    expect(isRoleAccounting('NV004')).toBe(true);
    expect(isRoleAccounting('NV007')).toBe(true);
    expect(isRoleAccounting('NV003')).toBe(false); // Giám Đốc không thuộc nhóm Kế toán
  });

  it('gán kind cho nhóm "Giám Đốc" thật → isRoleAdmin() nhận diện đúng (trước đây isUserInRoleGroup(...,"role_admin") luôn false cho NV003)', () => {
    const groups = REAL_ROLE_GROUPS.map((g: any) =>
      g.id === 'role_custom_1784610919977' ? { ...g, permissions: withRoleGroupKind(g.permissions, 'admin') } : g
    );
    setRoleGroupsCache(groups);
    expect(isRoleAdmin('NV003')).toBe(true);
  });

  it('gán kind cho "Nhân viên Văn phòng"/"Nhân viên Xưởng" → isRoleOffice()/isRoleTechnical() nhận diện đúng', () => {
    const groups = REAL_ROLE_GROUPS.map((g: any) => {
      if (g.id === 'role_custom_1785639772625') return { ...g, permissions: withRoleGroupKind(g.permissions, 'office') };
      if (g.id === 'role_custom_1785467660409') return { ...g, permissions: withRoleGroupKind(g.permissions, 'technical') };
      return g;
    });
    setRoleGroupsCache(groups);
    expect(isRoleOffice('NV008')).toBe(true);
    expect(isRoleTechnical('NV025')).toBe(true);
    expect(isRoleOffice('NV025')).toBe(false);
  });

  it('CHƯA gán kind (mặc định) → vẫn giữ hành vi cũ là false, không tự nhận nhầm ai — phải admin chủ động gán', () => {
    setRoleGroupsCache(REAL_ROLE_GROUPS); // không có nhóm nào được gán kind
    expect(isRoleAdmin('NV003')).toBe(false);
    expect(isRoleAccounting('NV004')).toBe(false);
  });

  it('Siêu Admin (role_superadmin) luôn được mọi isRoleXxx() công nhận, không cần gán kind — hành vi bypass giữ nguyên', () => {
    setRoleGroupsCache(REAL_ROLE_GROUPS);
    expect(isRoleAdmin('NV001')).toBe(true);
    expect(isRoleAccounting('NV001')).toBe(true);
    expect(isRoleOffice('NV001')).toBe(true);
    expect(isRoleTechnical('NV001')).toBe(true);
  });
});
