import { describe, it, expect, beforeEach } from 'vitest';
import { setRoleGroupsCache } from '../../../context/SettingsContext';
import { canDoTaskAction, DEFAULT_TASK_PERMISSIONS } from '../hrTaskPermissions';

// Rà soát 2026-10-03: Giám đốc/Superadmin (vd Trương Hữu Long, NV001) từng thấy nút "Nhận Việc"
// trên MỌI công việc và bấm được thay người phụ trách. Nay "Nhận Việc"/"Hoàn thành" chỉ dành cho
// người được giao thật, không phụ thuộc role admin hay cấu hình nhóm quyền.
describe('canDoTaskAction — receiveTask / completeTask chỉ cho người được giao', () => {
  const long = { id: 'NV001', name: 'Trương Hữu Long', roleGroupIds: ['role_superadmin'] } as any;
  const worker = { id: 'NV016', name: 'Hoàng Ngọc Đức', roleGroupIds: [] } as any;
  const other = { id: 'NV012', name: 'Người khác', roleGroupIds: [] } as any;

  beforeEach(() => {
    setRoleGroupsCache([
      { id: 'role_superadmin', name: 'Siêu Admin', memberIds: ['NV001'], permissions: {} },
    ] as any);
  });

  const task = { id: 't1', assigneeId: 'NV016', assignerId: 'NV001', status: 'todo', missions: [] } as any;
  const M = DEFAULT_TASK_PERMISSIONS;

  it('Superadmin KHÔNG phải người phụ trách → không có quyền Nhận Việc / Hoàn thành', () => {
    expect(canDoTaskAction(long, task, undefined, 'receiveTask', M)).toBe(false);
    expect(canDoTaskAction(long, task, undefined, 'completeTask', M)).toBe(false);
  });

  it('Người phụ trách thật được Nhận Việc / Hoàn thành', () => {
    expect(canDoTaskAction(worker, task, undefined, 'receiveTask', M)).toBe(true);
    expect(canDoTaskAction(worker, task, undefined, 'completeTask', M)).toBe(true);
  });

  it('Superadmin LÀ người phụ trách thì vẫn nhận được việc của chính mình', () => {
    const own = { ...task, assigneeId: 'NV001' };
    expect(canDoTaskAction(long, own, undefined, 'receiveTask', M)).toBe(true);
  });

  it('Người phụ trách chính của một nhiệm vụ (mission) được Nhận Việc', () => {
    const withMission = { ...task, missions: [{ id: 'm1', mainAssigneeId: 'NV012' }] };
    expect(canDoTaskAction(other, withMission, undefined, 'receiveTask', M)).toBe(true);
  });

  it('Người không liên quan không nhận được việc', () => {
    expect(canDoTaskAction(other, task, undefined, 'receiveTask', M)).toBe(false);
  });

  it('Các action quản lý khác (duyệt, sửa, xóa...) của Superadmin giữ nguyên', () => {
    expect(canDoTaskAction(long, task, undefined, 'approveResult', M)).toBe(true);
    expect(canDoTaskAction(long, task, undefined, 'editTask', M)).toBe(true);
    expect(canDoTaskAction(long, task, undefined, 'deleteTask', M)).toBe(true);
  });
});

// Vai trò "Kế Toán"/"Giám Đốc" của công việc phải nhận diện cả nhóm TỰ TẠO có "Loại nhóm" (id role_custom_...), không chỉ id cố định cũ.
// Trước đây Kế toán thật luôn bị tính là "không liên quan" nên cột "Kế Toán" của ma trận Quyền Công việc không có tác dụng.
import { getTaskRoleScope } from '../hrTaskPermissions';
describe('getTaskRoleScope — nhận diện theo "Loại nhóm"', () => {
  const kind = (k: string) => ({ [`__role_kind__${k}`]: { view: true, create: false, edit: false, delete: false } });
  beforeEach(() => {
    setRoleGroupsCache([
      { id: 'role_custom_kt', name: 'Kế toán', memberIds: ['KT'], permissions: kind('accounting') },
      { id: 'role_custom_gd', name: 'Giám Đốc', memberIds: ['GD'], permissions: kind('admin') },
      { id: 'role_custom_xuong', name: 'Xưởng', memberIds: ['TH'], permissions: kind('technical') },
    ] as any);
  });
  const nv = (id: string) => ({ id, name: id, roleGroupIds: [] }) as any;
  const task = { id: 't', assignerId: 'A', assigneeId: 'B', missions: [] } as any;
  it('nhóm tự tạo loại Kế toán → accountant; loại Quản trị viên → director; nhân viên xưởng → none', () => {
    expect(getTaskRoleScope(nv('KT'), task, undefined)).toBe('accountant');
    expect(getTaskRoleScope(nv('GD'), task, undefined)).toBe('director');
    expect(getTaskRoleScope(nv('TH'), task, undefined)).toBe('none');
  });
  it('Kế toán đồng thời là Người giao việc → vẫn là Người giao việc (thứ tự ưu tiên không đổi)', () => {
    expect(getTaskRoleScope(nv('KT'), { ...task, assignerId: 'KT' }, undefined)).toBe('assigner');
  });
});

// ─── Quyền theo TỪNG NHIỆM VỤ & chế độ chỉ-xem (vòng 3) ───
import { canManageMission, isTaskReadOnlyFor } from '../hrTaskPermissions';
describe('canManageMission — quyền cấp nhiệm vụ không lẫn sang nhiệm vụ của người khác', () => {
  const nv = (id: string) => ({ id, name: id, roleGroupIds: [] }) as any;
  const task = { id: 't', assignerId: 'GIAO', assigneeId: 'CV', missions: [] } as any;
  const M = DEFAULT_TASK_PERMISSIONS;
  beforeEach(() => { setRoleGroupsCache([] as any); });
  it('phụ trách chính của CHÍNH nhiệm vụ đó → được', () => {
    expect(canManageMission(nv('TA'), task, undefined, { mainAssigneeId: 'TA' }, M)).toBe(true);
  });
  it('phụ trách chính của nhiệm vụ KHÁC trong cùng công việc → KHÔNG được (đúng lỗi đã báo)', () => {
    const t = { ...task, missions: [{ id: 'm2', mainAssigneeId: 'TA' }, { id: 'm3', mainAssigneeId: 'TB' }] };
    expect(canManageMission(nv('TA'), t, undefined, t.missions[1], M)).toBe(false);
    expect(canManageMission(nv('TA'), t, undefined, t.missions[0], M)).toBe(true);
  });
  it('người giao việc / phụ trách công việc / trưởng DA (có quyền "Quản lý nhiệm vụ con") quản lý được mọi nhiệm vụ', () => {
    expect(canManageMission(nv('GIAO'), task, undefined, { mainAssigneeId: 'TB' }, M)).toBe(true);
    expect(canManageMission(nv('CV'), task, undefined, { mainAssigneeId: 'TB' }, M)).toBe(true);
    expect(canManageMission(nv('PM'), task, { pmId: 'PM' } as any, { mainAssigneeId: 'TB' }, M)).toBe(true);
  });
  it('người không liên quan → không', () => {
    expect(canManageMission(nv('LA'), task, undefined, { mainAssigneeId: 'TB' }, M)).toBe(false);
  });
});

describe('isTaskReadOnlyFor — chỉ-xem theo ma trận chứ không chỉ theo danh tính cứng', () => {
  const kind = (k: string) => ({ [`__role_kind__${k}`]: { view: true, create: false, edit: false, delete: false } });
  const nv = (id: string, role = 'engineer') => ({ id, name: id, role, roleGroupIds: [] }) as any;
  const task = { id: 't', assignerId: 'GIAO', assigneeId: 'CV', missions: [{ id: 'm', mainAssigneeId: 'TA' }] } as any;
  beforeEach(() => {
    setRoleGroupsCache([
      { id: 'g_gd', name: 'Giám đốc', memberIds: ['GD'], permissions: kind('admin') },
      { id: 'g_kt', name: 'Kế toán', memberIds: ['KT'], permissions: kind('accounting') },
    ] as any);
  });
  it('Giám đốc thuộc nhóm quản trị dù trường role KHÔNG phải "director" → không bị chỉ-xem (trước đây bị khóa)', () => {
    expect(isTaskReadOnlyFor(nv('GD', 'engineer'), task, undefined)).toBe(false);
  });
  it('người giao việc / phụ trách / Trưởng DA → không chỉ-xem', () => {
    expect(isTaskReadOnlyFor(nv('GIAO'), task, undefined)).toBe(false);
    expect(isTaskReadOnlyFor(nv('CV'), task, undefined)).toBe(false);
    expect(isTaskReadOnlyFor(nv('PM'), task, { pmId: 'PM' } as any)).toBe(false);
  });
  it('Kế toán và người chỉ là phụ trách chính một nhiệm vụ → vẫn chỉ-xem ở cửa sổ công việc (không nhận hộ việc người khác)', () => {
    expect(isTaskReadOnlyFor(nv('KT'), task, undefined)).toBe(true);
    expect(isTaskReadOnlyFor(nv('TA'), task, undefined)).toBe(true);
  });
  it('ma trận cho phép duyệt cho vai trò Kế toán → hết chỉ-xem (cột Kế Toán bắt đầu có tác dụng)', () => {
    const m: any = { actions: { ...DEFAULT_TASK_PERMISSIONS.actions, approveResult: ['director', 'pm', 'assigner', 'accountant'] } };
    expect(isTaskReadOnlyFor(nv('KT'), task, undefined, m)).toBe(false);
  });
});
