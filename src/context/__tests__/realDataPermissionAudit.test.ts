import { describe, it, expect } from 'vitest';
import { setRoleGroupsCache, isUserInRoleGroup, hasModulePermission } from '../SettingsContext';

// RÀ SOÁT: dữ liệu Nhóm Vai Trò THẬT của công ty (lấy trực tiếp từ localStorage
// 'hl_role_groups_cache_v1' của tài khoản Administrator đang chạy thật, KHÔNG phải dữ liệu giả lập)
// để kiểm tra xem các hàm enforcement quyền có hoạt động đúng trên dữ liệu thật hay không.
const REAL_ROLE_GROUPS = [
  { id: 'role_custom_1784881020261', name: 'Kế toán', memberIds: ['NV004', 'NV007'], permissions: {} },
  { id: 'role_custom_1785565212400', name: 'Trưởng Bộ phận', memberIds: ['NV010', 'NV002', 'NV016'], permissions: {} },
  { id: 'role_custom_1785467660409', name: 'Nhân viên Xưởng', memberIds: ['NV025', 'NV026', 'NV018', 'NV015', 'NV019', 'NV022', 'NV014', 'NV020', 'NV013', 'NV021'], permissions: {} },
  { id: 'role_custom_1785639772625', name: 'Nhân viên Văn phòng', memberIds: ['NV008', 'NV023', 'NV009'], permissions: {} },
  { id: 'role_custom_1785565225062', name: 'Tổ trưởng - Tổ phó', memberIds: ['NV011', 'NV005', 'NV012'], permissions: {} },
  { id: 'role_superadmin', name: 'Siêu Admin (Super Admin)', memberIds: ['NV001'], permissions: {} },
  { id: 'role_custom_1784610919977', name: 'Giám Đốc', memberIds: ['NV003'], permissions: {} },
] as any;

describe('RÀ SOÁT — enforcement quyền trên DỮ LIỆU THẬT của công ty', () => {
  it('phát hiện lỗ hổng: các role id CỐ ĐỊNH (role_admin/role_accounting/role_office/role_technical) không khớp id THẬT nào trong dữ liệu công ty', () => {
    const fixedIds = ['role_admin', 'role_accounting', 'role_office', 'role_technical', 'role_factory_mwood', 'role_factory_mmetal'];
    const realIds = REAL_ROLE_GROUPS.map((g: any) => g.id);
    fixedIds.forEach(id => expect(realIds).not.toContain(id));
  });

  it('NV003 "Giám Đốc" (id thật) KHÔNG được isUserInRoleGroup(...,"role_admin") công nhận là admin — dù tên nhóm là Giám Đốc', () => {
    setRoleGroupsCache(REAL_ROLE_GROUPS);
    // Đây CHÍNH LÀ điều kiện App.tsx dùng để: (1) cho Giám đốc quyền Cài Đặt Hệ Thống mặc định,
    // (2) hiện các tab "director-*", (3) coi là isFinanceApprover, v.v.
    expect(isUserInRoleGroup('NV003', 'role_admin')).toBe(false);
  });

  it('NV004/NV007 "Kế toán" (id thật) KHÔNG được isUserInRoleGroup(...,"role_accounting") công nhận — mất hàng loạt quyền kế toán ngầm định trong code (FinanceManagement, TaskManagement, MaterialCoordination...)', () => {
    setRoleGroupsCache(REAL_ROLE_GROUPS);
    expect(isUserInRoleGroup('NV004', 'role_accounting')).toBe(false);
    expect(isUserInRoleGroup('NV007', 'role_accounting')).toBe(false);
  });

  it('NV008/NV023/NV009 "Nhân viên Văn phòng" (id thật) KHÔNG được nhận diện qua "role_office" — mất quyền xem toàn bộ hồ sơ lưu trữ (isPrivileged) dù đúng là nhân viên văn phòng', () => {
    setRoleGroupsCache(REAL_ROLE_GROUPS);
    expect(isUserInRoleGroup('NV008', 'role_office')).toBe(false);
  });

  it('CHỈ Siêu Admin (role_superadmin, NV001) và tài khoản admin đặc biệt mới được các kiểm tra role cố định công nhận — mọi nhân viên khác trong công ty đều bị coi như KHÔNG thuộc role_admin/role_accounting/role_office/role_technical, bất kể ma trận phân quyền đã cấu hình gì cho họ', () => {
    setRoleGroupsCache(REAL_ROLE_GROUPS);
    expect(isUserInRoleGroup('NV001', 'role_admin')).toBe(true); // Siêu Admin bypass mọi groupId — đúng như thiết kế
    // 6/7 nhân sự thật còn lại (tất cả trừ Siêu Admin) đều bị từ chối ở MỌI role cố định:
    const otherMembers = ['NV003', 'NV004', 'NV007', 'NV002', 'NV008', 'NV011'];
    const fixedIds = ['role_admin', 'role_accounting', 'role_office', 'role_technical'];
    otherMembers.forEach(uid => {
      fixedIds.forEach(rid => expect(isUserInRoleGroup(uid, rid)).toBe(false));
    });
  });

  it('hasModulePermission() (cột Thêm/Sửa/Xóa của ma trận Phân Quyền Nhóm Vai Trò) không có tác dụng thực tế: dù cấu hình create=true cho 1 module, hàm vẫn hoạt động đúng NHƯNG không nơi nào trong ứng dụng gọi hàm này để chặn nút Thêm/Sửa/Xóa (xác nhận bằng grep mã nguồn — xem báo cáo)', () => {
    const groupsWithPerm = REAL_ROLE_GROUPS.map((g: any) =>
      g.id === 'role_custom_1784881020261' ? { ...g, permissions: { finance: { view: true, create: true, edit: true, delete: false } } } : g
    );
    setRoleGroupsCache(groupsWithPerm);
    // Bản thân hàm hoạt động đúng (không phải lỗi logic của hasModulePermission) —
    // vấn đề là KHÔNG CÓ NƠI NÀO KHÁC trong toàn bộ src/components gọi hàm này (xem grep).
    expect(hasModulePermission('NV004', 'finance', 'create')).toBe(true);
    expect(hasModulePermission('NV004', 'finance', 'delete')).toBe(false);
  });
});
