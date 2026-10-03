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
