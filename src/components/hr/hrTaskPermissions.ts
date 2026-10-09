// ─── HRM Task Permission Matrix ──────────────────────────────────────
// Tách từ ProjectKanbanBoard.tsx & TaskDetailModal.tsx
// Quản lý phân quyền chi tiết bên trong Công Việc (Task):
//   1. view: quyền xem task (nằm trong Action Matrix)
//   2. Action Matrix: ai được làm action nào
//
// Mục tiêu: thay thế ~50 chỗ hardcode `isAssignee || isAssigner` bằng
// ma trận Role × Action có thể tùy biến qua UI trong tab "Phân Quyền Và Vai Trò"

import { Employee, Project, Task } from '../../types';
import { isUserInRoleGroup, isRoleAdmin, isRoleAccounting } from '../../context';
import { dbService } from '../../lib/dbService';
import { loadProjectPermissions } from './hrProjectPermissions';

// ─── Role Scope: vai trò của user đối với MỘT task cụ thể ────────────
// Dựa trên vị trí dữ liệu THỰC TẾ trong UI
// Tên hiển thị UI (Xem tabs/TaskPermissionEditor.tsx > COT):
//   director        → "Giám Đốc"
//   pm              → "Trưởng Dự Án"
//   assigner        → "Người Giao Việc"
//   assignee        → "Phụ Trách Công Việc"
//   missionAssignee → "Phụ Trách Nhiệm Vụ"
//   accountant      → "Kế Toán"
//   none            → "Không Liên Quan"
export type RoleScope =
  | 'director'         // Giám Đốc (luôn full)
  | 'assigner'         // Người Giao Việc (task.assignerId)
  | 'pm'               // Trưởng Dự Án (project.pmId)
  | 'assignee'         // Phụ Trách Công Việc (task.assigneeId)
  | 'missionAssignee'  // Phụ Trách Nhiệm Vụ (task.missions[].mainAssigneeId)
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
    view:             ['director', 'pm', 'assigner', 'assignee', 'missionAssignee', 'accountant'],
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

// ─── In-memory cache (nguồn: Supabase khi mount) ─────────────────────
let _taskPermissionCache: TaskPermissionMatrix = DEFAULT_TASK_PERMISSIONS;

// ─── Helpers ─────────────────────────────────────────────────────────

// Đọc ma trận từ in-memory cache (đã load từ Supabase khi mount)
export const loadTaskPermissionMatrix = (): TaskPermissionMatrix => {
  return _taskPermissionCache;
};

/** Đồng bộ từ Supabase về in-memory cache (gọi khi app mount) */
export const syncTaskPermissionsFromCloud = async (): Promise<void> => {
  try {
    const cloud = await dbService.hrmTaskPermissions.get();
    if (cloud && cloud.actions) {
      _taskPermissionCache = {
        actions: { ...DEFAULT_TASK_PERMISSIONS.actions, ...cloud.actions },
      };
      window.dispatchEvent(new CustomEvent('hl-task-permissions-updated'));
    }
  } catch (e) {
    console.warn('Sync task permissions from cloud failed:', e);
  }
};

// Lưu lên in-memory cache + Supabase (async, fail-safe)
export const saveTaskPermissionMatrix = (matrix: TaskPermissionMatrix): void => {
  _taskPermissionCache = matrix;
  // Đồng bộ lên Supabase (non-blocking)
  dbService.hrmTaskPermissions.save(matrix).catch(e =>
    console.warn('Supabase save task permissions error:', e)
  );
  window.dispatchEvent(new CustomEvent('hl-task-permissions-updated'));
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

  // 1. Director — nhóm có id 'role_admin' HOẶC nhóm được gán "Loại nhóm" = Quản trị viên (isRoleAdmin). Trước đây chỉ so id cố định
  //    nên nhóm tự tạo (id role_custom_...) như "Giám Đốc" không bao giờ được tính là 'director' ở đây.
  if (isRoleAdmin(currentUser.id)) return 'director';

  // 2. Trưởng Dự Án (PM)
  if (project?.pmId === currentUser.id) return 'pm';

  // 3. Người Giao Việc
  if (task.assignerId === currentUser.id) return 'assigner';

  // 4. Phụ Trách Công Việc
  if (task.assigneeId === currentUser.id) return 'assignee';

  // 5. Phụ Trách Nhiệm Vụ (mission)
  const hasMainMission = task.missions?.some(m => m.mainAssigneeId === currentUser.id);
  if (hasMainMission) return 'missionAssignee';

  // 6. Kế Toán — nhóm có id 'role_accounting' HOẶC nhóm được gán "Loại nhóm" = Kế toán (isRoleAccounting). Trước đây chỉ so id cố định
  //    nên Kế toán thật (nhóm tự tạo) luôn bị tính là 'none' và cột "Kế Toán" của ma trận không có tác dụng.
  if (isRoleAccounting(currentUser.id)) return 'accountant';

  return 'none';
};

/** Admin/root luôn full quyền */
const IS_ADMIN = (uid: string) => uid === 'NV_ADMIN' || uid === 'emp_admin';

const IS_DIRECTOR = (uid: string): boolean => {
  return isRoleAdmin(uid); // superadmin cũng true nhờ isUserInRoleGroup
};

// Kiểm tra user có được xem task này không (dùng action matrix 'view')
export const canViewTask = (
  currentUser: Employee | undefined,
  task: Task,
  project: Project | undefined,
  matrix: TaskPermissionMatrix = DEFAULT_TASK_PERMISSIONS
): boolean => {
  if (!currentUser) return false;

  // Admin/Director luôn thấy mọi thứ
  if (IS_ADMIN(currentUser.id) || IS_DIRECTOR(currentUser.id)) return true;

  // Check role group permissions via project permissions matrix
  // If user's role group has 'viewTask' action, allow
  try {
    const parsed = loadProjectPermissions() as any;
    const rgMatrix = parsed.roleGroupMatrix || {};
    const empGroupIds = currentUser.roleGroupIds || [];
    for (const groupId of empGroupIds) {
      const actions = rgMatrix.roleGroupActions?.[groupId];
      if (actions?.includes('viewTask')) {
        return true;
      }
    }
  } catch (e) {
    console.warn('canViewTask role group check failed:', e);
    // Fallback — continue to context check
  }

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

  // "Nhận Việc" / "Hoàn thành" là hành động CỦA NGƯỜI ĐƯỢC GIAO — Admin/Director/Superadmin
  // KHÔNG được ghi đè như các action quản lý khác. Trước đây họ thấy nút này trên MỌI công
  // việc: bấm vào là việc của người khác chuyển "Đang làm" và nhật ký/chat ghi tên họ ("Trương
  // Hữu Long đã Nhận Việc") dù người phụ trách vẫn là người cũ (xem rà soát 2026-10-03).
  // getTaskRoleScope() trả 'director' TRƯỚC 'assignee' nên không dùng được cho 2 action này
  // — phải so trực tiếp với assigneeId / mainAssigneeId của nhiệm vụ.
  if (action === 'receiveTask' || action === 'completeTask') {
    const allowed = matrix.actions[action] || [];
    const isAssignee = task.assigneeId === currentUser.id;
    const isMissionAssignee = !!task.missions?.some(m => m.mainAssigneeId === currentUser.id);
    // Trả về luôn, KHÔNG rơi xuống khối roleGroupMatrix bên dưới: dữ liệu thật (bảng
    // project_permissions) đã cấp receiveTask/completeTask cho role_superadmin và hầu hết
    // các nhóm tùy chỉnh — để rơi xuống thì mọi nhân viên trong các nhóm đó lại nhận được
    // việc của người khác như cũ.
    return (isAssignee && allowed.includes('assignee')) ||
           (isMissionAssignee && allowed.includes('missionAssignee'));
  } else {
    // Admin/Director luôn được làm mọi action
    if (IS_ADMIN(currentUser.id) || IS_DIRECTOR(currentUser.id)) return true;

    // Superadmin check (dự phòng cho user không trong role_admin nhưng là superadmin)
    if (isUserInRoleGroup(currentUser.id, 'role_superadmin')) return true;

    const roleScope = getTaskRoleScope(currentUser, task, project);
    const allowedRoles = matrix.actions[action] || [];
    if (allowedRoles.includes(roleScope)) return true;
  }

  // Kiểm tra roleGroupMatrix từ Quyền Dự Án (Hệ thống mới — tab "Vai trò nhóm HRM")
  // Cho phép HRM Role Group cấp quyền đặc biệt trong mọi task
  try {
    const parsed = loadProjectPermissions() as any;
    const rgMatrix = parsed.roleGroupMatrix;
    if (rgMatrix?.roleGroupActions) {
      const empGroupIds = currentUser.roleGroupIds || [];
      for (const groupId of empGroupIds) {
        const groupActions = rgMatrix.roleGroupActions[groupId] || [];
        // Map TaskAction → ProjectAction nếu tên khác nhau
        const mappedAction = action === 'assignSubWorkers' ? 'assignSubWorker' : action;
        if (groupActions.includes(mappedAction)) return true;
        // manageSubTask → kiểm tra nhiều quyền mission
        if (action === 'manageSubTask') {
          if (groupActions.includes('createMission') ||
              groupActions.includes('editMission') ||
              groupActions.includes('deleteMission')) return true;
        }
      }
    }
  } catch (e) {
    console.warn('canDoTaskAction roleGroupMatrix check failed:', e);
  }

  return false;
};


// ─── Quyền theo TỪNG NHIỆM VỤ & chế độ chỉ-xem của cửa sổ chi tiết công việc ───────────────────────────────────────
// Lỗi (vòng 3 kiểm thử 2026-10-09): quyền cấp nhiệm vụ được tính bằng `canReceive || canAssignMembers || canManageSubTask || là-phụ-trách-chính`,
// trong đó 2 điều kiện đầu là quyền cấp CÔNG VIỆC nên người phụ trách chính của MỘT nhiệm vụ sửa/xóa/hoàn thành được nhiệm vụ của NGƯỜI KHÁC
// trong cùng công việc. Nay: quản lý nhiệm vụ = quyền "Quản lý nhiệm vụ con" (manageSubTask) HOẶC là phụ trách chính của CHÍNH nhiệm vụ đó.
export const canManageMission = (
  currentUser: Employee | undefined,
  task: Task,
  project: Project | undefined,
  mission: { mainAssigneeId?: string } | undefined,
  matrix: TaskPermissionMatrix = DEFAULT_TASK_PERMISSIONS
): boolean => {
  if (!currentUser || !mission) return false;
  if (mission.mainAssigneeId && mission.mainAssigneeId === currentUser.id) return true;
  return canDoTaskAction(currentUser, task, project, 'manageSubTask', matrix);
};

/**
 * Cửa sổ chi tiết công việc ở chế độ CHỈ XEM? Trước đây khóa theo danh tính cứng (trường role = director, người phụ trách, người giao việc,
 * Trưởng DA) nên MỌI vai trò khác — kể cả Giám đốc thuộc nhóm quản trị nhưng trường role không phải "director", hoặc người được ma trận/nhóm cấp
 * quyền duyệt/quản lý — luôn chỉ xem. Nay: không chỉ-xem nếu thuộc danh tính cũ HOẶC được ma trận cho duyệt / từ chối / sửa công việc / quản lý nhiệm vụ.
 * (Cố ý KHÔNG tính nhận việc/hoàn thành/thêm người: người phụ trách chính nhiệm vụ không được nhận hộ công việc của người khác.)
 */
export const isTaskReadOnlyFor = (
  currentUser: Employee | undefined,
  task: Task | undefined,
  project: Project | undefined,
  matrix: TaskPermissionMatrix = DEFAULT_TASK_PERMISSIONS
): boolean => {
  if (!task || !currentUser) return false;
  if (currentUser.role === 'director' || isRoleAdmin(currentUser.id)) return false;
  if (task.assigneeId === currentUser.id || task.assignerId === currentUser.id) return false;
  if (project?.pmId === currentUser.id) return false;
  return !(['approveResult', 'rejectResult', 'editTask', 'manageSubTask'] as TaskAction[])
    .some(a => canDoTaskAction(currentUser, task, project, a, matrix));
};
