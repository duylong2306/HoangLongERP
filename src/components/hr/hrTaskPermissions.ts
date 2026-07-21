// ─── HRM Task Permission Matrix ──────────────────────────────────────
// Tách từ ProjectKanbanBoard.tsx & TaskDetailModal.tsx
// Quản lý phân quyền chi tiết bên trong Công Việc (Task):
//   1. view: quyền xem task (nằm trong Action Matrix)
//   2. Action Matrix: ai được làm action nào
//
// Mục tiêu: thay thế ~50 chỗ hardcode `isAssignee || isAssigner` bằng
// ma trận Role × Action có thể tùy biến qua UI trong tab "Phân Quyền Và Vai Trò"

import { Employee, Project, Task } from '../../types';
import { isUserInRoleGroup } from '../../context';

// ─── Role Scope: vai trò của user đối với MỘT task cụ thể ────────────
// Tên hiển thị UI (Xem TaskPermissionModal.tsx > roleScopeLabels):
//   director        → "Giám Đốc"
//   pm              → "Trưởng Dự Án"
//   assigner        → "Người Giao Việc"
//   assignee        → "Phụ Trách Công Việc"
//   missionAssignee → "Phụ Trách Nhiệm Vụ"
//   involved        → "Người Tham Gia"
//   accountant      → "Kế Toán"
//   none            → "Không Liên Quan"
export type RoleScope =
  | 'director'         // Giám Đốc (luôn full)
  | 'assigner'         // Người Giao Việc (task.assignerId)
  | 'pm'               // Trưởng Dự Án (project.pmId)
  | 'assignee'         // Phụ Trách Công Việc (task.assigneeId)
  | 'missionAssignee'  // Phụ Trách Nhiệm Vụ (task.missions[].mainAssigneeId)
  | 'involved'         // Người Tham Gia (task.involvedEmployeeIds)
  | 'accountant'       // Kế Toán (role hệ thống)
  | 'none';            // Không Liên Quan

// ─── Task Actions: các thao tác con bên trong Task ───────────────────
export type TaskAction =
  | 'view'             // Xem task
  | 'receiveTask'      // Nhận việc
  | 'completeTask'     // Tự hoàn thành
  | 'approveResult'    // Duyệt kết quả
  | 'rejectResult'     // Từ chối duyệt
  | 'assignMembers'    // Thêm/xóa người tham gia
  | 'assignSubWorkers' // Gán thợ phụ (mission)
  | 'recordViolation'  // Ghi nhận vi phạm 🚨
  | 'issuePenalty'     // Phiếu phạt
  | 'proposeAdvance'   // Đề xuất tạm ứng
  | 'settlePayment'    // Quyết toán
  | 'manageDocs'       // Quản lý hồ sơ liên thông
  | 'editTask'         // Sửa thông tin task
  | 'deleteTask'       // Xóa task
  | 'manageSubTask';   // Quản lý công việc con

// ─── Ma trận quyền mặc định ──────────────────────────────────────────
// Mỗi action = danh sách RoleScope được phép
export interface TaskPermissionMatrix {
  actions: Record<TaskAction, RoleScope[]>;
}

export const DEFAULT_TASK_PERMISSIONS: TaskPermissionMatrix = {
  actions: {
    view:             ['director', 'pm', 'assigner', 'assignee', 'missionAssignee', 'involved', 'accountant'],
    receiveTask:      ['assignee', 'missionAssignee'],
    completeTask:     ['assignee', 'missionAssignee'],
    approveResult:    ['director', 'pm', 'assigner'],
    rejectResult:     ['director', 'pm', 'assigner'],
    assignMembers:    ['director', 'pm', 'assigner', 'assignee', 'missionAssignee'],
    assignSubWorkers: ['director', 'pm', 'assigner', 'assignee'],
    recordViolation:  ['director', 'pm', 'assigner', 'assignee', 'missionAssignee'],
    issuePenalty:     ['director', 'pm', 'assigner'],
    proposeAdvance:   ['director', 'pm', 'assigner', 'assignee'],
    settlePayment:    ['director', 'pm', 'accountant'],
    manageDocs:       ['director', 'pm', 'assigner', 'accountant'],
    editTask:         ['director', 'pm', 'assigner'],
    deleteTask:       ['director', 'pm', 'assigner'],
    manageSubTask:    ['director', 'pm', 'assigner', 'assignee'],
  },
};

const STORAGE_KEY = 'hl_task_permissions_v1';

// ─── Helpers ─────────────────────────────────────────────────────────

// Đọc ma trận từ localStorage (hoặc default nếu chưa cấu hình)
export const loadTaskPermissionMatrix = (): TaskPermissionMatrix => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge với default để đảm bảo đủ fields
      return {
        actions: { ...DEFAULT_TASK_PERMISSIONS.actions, ...(parsed.actions || {}) },
      };
    }
  } catch (e) {
    console.error('Lỗi đọc hl_task_permissions_v1:', e);
  }
  return DEFAULT_TASK_PERMISSIONS;
};

export const saveTaskPermissionMatrix = (matrix: TaskPermissionMatrix): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(matrix));
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('hl-task-permissions-updated'));
  } catch (e) {
    console.error('Lỗi lưu hl_task_permissions_v1:', e);
  }
};

// ─── Role Group IDs (HRM) ─────────────────────────────────────
export const ROLE_GROUP_ADMIN = 'role_admin';
export const ROLE_GROUP_ACCOUNTING = 'role_accounting';

// Tính Role Scope của user đối với một task cụ thể
export const getTaskRoleScope = (
  currentUser: Employee | undefined,
  task: Task,
  project: Project | undefined
): RoleScope => {
  if (!currentUser) return 'none';

  // 1. Director (Role Group: role_admin)
  if (isUserInRoleGroup(currentUser.id, ROLE_GROUP_ADMIN)) return 'director';

  // 2. Trưởng Dự Án (PM)
  if (project?.pmId === currentUser.id) return 'pm';

  // 3. Người Giao Việc
  if (task.assignerId === currentUser.id) return 'assigner';

  // 4. Phụ Trách Công Việc
  if (task.assigneeId === currentUser.id) return 'assignee';

  // 5. Phụ Trách Nhiệm Vụ (mission)
  const hasMainMission = task.missions?.some(m => m.mainAssigneeId === currentUser.id);
  if (hasMainMission) return 'missionAssignee';

  // 6. Kế Toán (Role Group: role_accounting)
  if (isUserInRoleGroup(currentUser.id, ROLE_GROUP_ACCOUNTING)) return 'accountant';

  // 7. Người Tham Gia
  if (task.involvedEmployeeIds?.includes(currentUser.id)) return 'involved';

  return 'none';
};

/** Admin/root luôn full quyền */
const IS_ADMIN = (uid: string) => uid === 'NV_ADMIN' || uid === 'emp_admin';

// Kiểm tra user có được xem task này không (dùng action matrix 'view')
export const canViewTask = (
  currentUser: Employee | undefined,
  task: Task,
  project: Project | undefined,
  matrix: TaskPermissionMatrix = DEFAULT_TASK_PERMISSIONS
): boolean => {
  if (!currentUser) return false;

  // Admin luôn thấy mọi thứ
  if (IS_ADMIN(currentUser.id)) return true;

  const roleScope = getTaskRoleScope(currentUser, task, project);
  const allowedRoles = matrix.actions.view || [];
  return allowedRoles.includes(roleScope);
};

// Kiểm tra user có được thực hiện action không
export const canDoTaskAction = (
  currentUser: Employee | undefined,
  task: Task,
  project: Project | undefined,
  action: TaskAction,
  matrix: TaskPermissionMatrix = DEFAULT_TASK_PERMISSIONS
): boolean => {
  if (!currentUser) return false;

  // Admin luôn được làm mọi action
  if (IS_ADMIN(currentUser.id)) return true;

  const roleScope = getTaskRoleScope(currentUser, task, project);
  const allowedRoles = matrix.actions[action] || [];

  return allowedRoles.includes(roleScope);
};
