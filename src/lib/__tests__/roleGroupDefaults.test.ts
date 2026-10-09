import { describe, it, expect } from 'vitest';
import { defaultPermissionsForNewGroup, PHAN_HE_NHAY_CAM } from '../roleGroupDefaults';
import { countRoleGroupChanges } from '../permissionDraftDiff';
import { ERP_MODULE_CODES } from '../../components/hr/hrTypes';

describe('quyền mặc định của nhóm vai trò mới', () => {
  const p = defaultPermissionsForNewGroup(ERP_MODULE_CODES);
  it('phân hệ nhạy cảm (nhân sự/lương, tài chính, cài đặt, tài khoản, phân quyền, phòng giám đốc) mặc định TẮT hết', () => {
    for (const m of PHAN_HE_NHAY_CAM) if (m in p) expect(p[m]).toEqual({ view: false, create: false, edit: false, delete: false });
    for (const m of ['settings', 'settings_accounts', 'settings_roles', 'finance', 'hr_data', 'employees', 'director_dashboard']) expect(p[m].view).toBe(false);
  });
  it('phân hệ nghiệp vụ thường chỉ được Xem (không thêm/sửa/xóa)', () => {
    for (const m of ['projects_construction', 'material_coordination', 'quotes', 'subcontractor_management']) expect(p[m]).toEqual({ view: true, create: false, edit: false, delete: false });
  });
  it('phủ đủ mọi phân hệ trong danh sách', () => { expect(Object.keys(p).sort()).toEqual([...ERP_MODULE_CODES].sort()); });
});

describe('countRoleGroupChanges — đếm theo từng thay đổi', () => {
  const g = (over: any = {}) => ({ id: 'g1', name: 'Kế toán', description: 'x', permissions: { finance: { view: true, create: false, edit: false, delete: false } }, memberIds: ['A'], ...over });
  it('không đổi = 0', () => { expect(countRoleGroupChanges([g()], [g()])).toBe(0); });
  it('thêm 5 người vào 4 nhóm = 5 thay đổi (trước đây báo 4)', () => {
    const saved = ['a', 'b', 'c', 'd'].map(id => g({ id, memberIds: [] }));
    const draft = [g({ id: 'a', memberIds: ['1'] }), g({ id: 'b', memberIds: ['2'] }), g({ id: 'c', memberIds: ['3'] }), g({ id: 'd', memberIds: ['4', '5'] })];
    expect(countRoleGroupChanges(draft, saved)).toBe(5);
  });
  it('đổi tên (1) + tick thêm quyền sửa/xóa (2) + bỏ 1 người (1) = 4; nhóm thêm/xóa = 1', () => {
    const d = g({ name: 'Mới', permissions: { finance: { view: true, create: false, edit: true, delete: true } }, memberIds: [] });
    expect(countRoleGroupChanges([d], [g()])).toBe(4);
    expect(countRoleGroupChanges([g(), g({ id: 'g2' })], [g()])).toBe(1);
    expect(countRoleGroupChanges([], [g()])).toBe(1);
  });
});
