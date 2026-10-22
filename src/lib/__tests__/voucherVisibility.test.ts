// Lập phiếu (KT): chỉ thành viên THẬT của nhóm Kế toán + người lập thấy; Giám đốc / Siêu Admin thì không.
import { describe, it, expect, beforeEach } from 'vitest';
import { setRoleGroupsCache, isAccountingGroupMember } from '../../context/SettingsContext';
import { isVoucherPendingForUser } from '../approvalInbox';

const grp = (id: string, memberIds: string[], kind?: string) => ({
  id, name: id, memberIds,
  permissions: kind ? { [`__role_kind__${kind}`]: { view: true, create: false, edit: false, delete: false } } : {},
}) as any;

const adv = (o: any = {}) => ({ id: 'a1', status: 'pending_payment', creator: 'emp_creator', creatorName: 'Người Lập', ...o }) as any;

describe('Lập phiếu (KT) — ai thấy', () => {
  beforeEach(() => {
    setRoleGroupsCache([
      grp('role_superadmin', ['emp_long']),
      grp('g_gd', ['emp_tien'], 'admin'),
      grp('g_kt', ['emp_ny'], 'accounting'),
    ]);
  });

  it('Kế toán thấy', () => {
    expect(isAccountingGroupMember('emp_ny')).toBe(true);
    expect(isVoucherPendingForUser(adv(), { id: 'emp_ny' }, { isAccountingMember: true })).toBe(true);
  });
  it('Giám đốc (kind admin) KHÔNG thấy', () => {
    expect(isAccountingGroupMember('emp_tien')).toBe(false);
    expect(isVoucherPendingForUser(adv(), { id: 'emp_tien', name: 'Tiến' }, { isAccountingMember: false })).toBe(false);
  });
  it('Siêu Admin không có lối tắt', () => {
    expect(isAccountingGroupMember('emp_long')).toBe(false);
  });
  it('Người lập thấy (theo mã hoặc theo tên bản ghi cũ)', () => {
    expect(isVoucherPendingForUser(adv(), { id: 'emp_creator' }, { isAccountingMember: false })).toBe(true);
    expect(isVoucherPendingForUser(adv({ creator: 'x', creatorName: 'Người Lập' }), { id: 'e9', name: 'người lập' }, { isAccountingMember: false })).toBe(true);
  });
  it('Phiếu không ở trạng thái chờ lập phiếu thì không hiện', () => {
    expect(isVoucherPendingForUser(adv({ status: 'paid' }), { id: 'emp_ny' }, { isAccountingMember: true })).toBe(false);
  });
});
