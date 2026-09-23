import { describe, it, expect } from 'vitest';
import { setRoleGroupsCache, isRoleAdmin, isRoleAccounting, isRoleOffice, isRoleTechnical } from '../SettingsContext';

// XÁC NHẬN SAU KHI NGƯỜI DÙNG ĐÃ GÁN "Loại nhóm" THẬT VÀ BẤM LƯU (2026-09):
// dữ liệu dưới đây lấy trực tiếp từ localStorage 'hl_role_groups_cache_v1' của tài khoản
// Administrator đang chạy thật, SAU KHI tải lại toàn trang (buộc app đồng bộ lại từ Supabase) —
// tức đã xác nhận là dữ liệu đã lưu thật trên máy chủ, không phải chỉ còn trong bộ nhớ tạm.
const LIVE_ROLE_GROUPS_AFTER_ASSIGNMENT = [
  { id: 'role_custom_1784881020261', name: 'Kế toán', memberIds: ['NV004', 'NV007'], permissions: { __role_kind__accounting: { view: true, create: false, edit: false, delete: false } } },
  { id: 'role_custom_1785467660409', name: 'Nhân viên Xưởng', memberIds: ['NV025', 'NV026', 'NV018', 'NV015', 'NV019', 'NV022', 'NV014', 'NV020', 'NV013', 'NV021'], permissions: { __role_kind__technical: { view: true, create: false, edit: false, delete: false } } },
  { id: 'role_custom_1785565212400', name: 'Trưởng Bộ phận', memberIds: ['NV010', 'NV002', 'NV016'], permissions: { __role_kind__office: { view: true, create: false, edit: false, delete: false } } },
  { id: 'role_custom_1785639772625', name: 'Nhân viên Văn phòng', memberIds: ['NV008', 'NV023', 'NV009'], permissions: { __role_kind__office: { view: true, create: false, edit: false, delete: false } } },
  { id: 'role_custom_1785565225062', name: 'Tổ trưởng - Tổ phó', memberIds: ['NV011', 'NV005', 'NV012'], permissions: { __role_kind__office: { view: true, create: false, edit: false, delete: false } } },
  { id: 'role_superadmin', name: 'Siêu Admin (Super Admin)', memberIds: ['NV001'], permissions: {} },
  { id: 'role_custom_1784610919977', name: 'Giám Đốc', memberIds: ['NV003'], permissions: { __role_kind__admin: { view: true, create: false, edit: false, delete: false } } },
] as any;

describe('XÁC NHẬN THỰC TẾ — sau khi bạn gán "Loại nhóm" và Lưu, quyền đã hoạt động đúng', () => {
  it('NV003 (Giám Đốc thật) giờ ĐƯỢC isRoleAdmin() công nhận — trước đây luôn false', () => {
    setRoleGroupsCache(LIVE_ROLE_GROUPS_AFTER_ASSIGNMENT);
    expect(isRoleAdmin('NV003')).toBe(true);
  });

  it('NV004, NV007 (Kế toán thật) giờ ĐƯỢC isRoleAccounting() công nhận — trước đây luôn false', () => {
    setRoleGroupsCache(LIVE_ROLE_GROUPS_AFTER_ASSIGNMENT);
    expect(isRoleAccounting('NV004')).toBe(true);
    expect(isRoleAccounting('NV007')).toBe(true);
  });

  it('NV010, NV002, NV016, NV008, NV023, NV009, NV011, NV005, NV012 (Văn phòng/Trưởng bộ phận/Tổ trưởng thật) giờ ĐƯỢC isRoleOffice() công nhận', () => {
    setRoleGroupsCache(LIVE_ROLE_GROUPS_AFTER_ASSIGNMENT);
    ['NV010', 'NV002', 'NV016', 'NV008', 'NV023', 'NV009', 'NV011', 'NV005', 'NV012'].forEach(uid => {
      expect(isRoleOffice(uid)).toBe(true);
    });
  });

  it('10 nhân viên Xưởng thật giờ ĐƯỢC isRoleTechnical() công nhận', () => {
    setRoleGroupsCache(LIVE_ROLE_GROUPS_AFTER_ASSIGNMENT);
    ['NV025', 'NV026', 'NV018', 'NV015', 'NV019', 'NV022', 'NV014', 'NV020', 'NV013', 'NV021'].forEach(uid => {
      expect(isRoleTechnical(uid)).toBe(true);
    });
  });

  it('không lẫn lộn: Kế toán KHÔNG được coi là Office/Technical/Admin; Xưởng KHÔNG được coi là Accounting', () => {
    setRoleGroupsCache(LIVE_ROLE_GROUPS_AFTER_ASSIGNMENT);
    expect(isRoleOffice('NV004')).toBe(false);
    expect(isRoleTechnical('NV004')).toBe(false);
    expect(isRoleAdmin('NV004')).toBe(false);
    expect(isRoleAccounting('NV025')).toBe(false);
  });

  it('Siêu Admin (NV001) và tài khoản admin đặc biệt vẫn bypass mọi kiểm tra như trước — không bị ảnh hưởng bởi thay đổi', () => {
    setRoleGroupsCache(LIVE_ROLE_GROUPS_AFTER_ASSIGNMENT);
    expect(isRoleAdmin('NV001')).toBe(true);
    expect(isRoleAccounting('NV001')).toBe(true);
    expect(isRoleOffice('NV001')).toBe(true);
    expect(isRoleTechnical('NV001')).toBe(true);
    expect(isRoleAdmin('emp_admin')).toBe(true);
  });

  it('nhân viên KHÔNG thuộc nhóm nào cả (id lạ) vẫn bị từ chối mọi quyền — không có lỗ hổng mở rộng ngoài ý muốn', () => {
    setRoleGroupsCache(LIVE_ROLE_GROUPS_AFTER_ASSIGNMENT);
    expect(isRoleAdmin('NV999_KHONG_TON_TAI')).toBe(false);
    expect(isRoleAccounting('NV999_KHONG_TON_TAI')).toBe(false);
  });
});
