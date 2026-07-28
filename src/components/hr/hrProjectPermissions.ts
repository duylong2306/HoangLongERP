// ─── HRM Project Permission Matrix ──────────────────────────────────────
// Thay thế hrTaskPermissions.ts + quyền module sector (canCreate/Edit/Delete).
// Quản lý phân quyền DUY NHẤT cho MỌI chức năng bên trong Dự Án:
//   Cột Kanban, Thẻ Dự Án, Chi tiết Dự Án, Công việc, Nhiệm vụ con,
//   Hồ sơ, Công cụ liên thông, Thầu phụ, Bình luận, Tệp đính kèm.
// Cấu hình tập trung tại tab "Quyền Dự Án" (Phân Quyền và Vai Trò).
// Ma trận được lưu lên Firestore + Supabase (dbService.projectPermissions).

import { Employee, Project, Task } from '../../types';
import { isUserInRoleGroup } from '../../context';
import { dbService } from '../../lib/dbService';

// ─── Role Scope: vai trò của user đối với MỘT dự án / công việc cụ thể ───
// Dựa trên vị trí dữ liệu THỰC TẾ trong UI (không role trừu tượng)
// Tên hiển thị UI (Xem ProjectPermissionModal.tsx > roleScopeLabels):
//   director        → "Giám Đốc"           (Role Group: role_admin)
//   pm              → "Trưởng Dự Án"        (project.pmId)
//   assigner        → "Người Giao Việc"     (task.assignerId)
//   assignee        → "Phụ Trách Công Việc" (task.assigneeId)
//   missionAssignee → "Phụ Trách Nhiệm Vụ"  (task.missions[].mainAssigneeId)
//   involved        → "Người Liên Quan"      (project.involvedEmployeeIds / task.involvedEmployeeIds)
//   accountant      → "Kế Toán"             (Role Group: role_accounting)
//   teamMember      → "Thành Viên Nhóm"     (mission.memberIds / fallback)
export type ProjectRoleScope =
  | 'director'         // Giám Đốc (role_admin) - luôn full
  | 'pm'               // Trưởng Dự Án (project.pmId)
  | 'assigner'         // Người Giao Việc (task.assignerId)
  | 'assignee'         // Phụ Trách Công Việc (task.assigneeId)
  | 'missionAssignee'  // Phụ Trách Nhiệm Vụ (task.missions[].mainAssigneeId)
  | 'involved'         // Người Liên Quan (project.involvedEmployeeIds / task.involvedEmployeeIds)
  | 'accountant'       // Kế Toán (role_accounting)
  | 'teamMember';      // Thành Viên Nhóm (mission.memberIds / fallback)

// ─── Project Actions: mọi thao tác bên trong dự án ───────────────────────
export type ProjectAction =
  // CẤP DỰ ÁN
  | 'createProject'          // Khởi tạo dự án mới
  | 'editProjectInfo'        // Sửa thông tin dự án
  | 'updateProjectStatus'    // Cập nhật trạng thái / % tiến độ
  | 'viewProjectFinance'     // Xem tài chính / sổ cái dự án
  | 'manageProjectDocs'      // Quản lý hồ sơ (báo giá, hợp đồng, nghiệm thu, thanh lý)
  | 'deleteProject'          // Xóa dự án
  | 'exportProject'          // Xuất dữ liệu dự án
  | 'quickAddCustomer'       // Thêm nhanh khách hàng từ dự án
  // CỘT KANBAN
  | 'createColumn'           // Tạo cột Kanban
  | 'editColumn'             // Sửa cột Kanban
  | 'deleteColumn'           // Xóa cột Kanban
  | 'arrangeColumn'          // Sắp xếp / di chuyển cột
  | 'configureColumnAutomation' // Cấu hình tự động hóa cột
  // THẺ DỰ ÁN
  | 'createCard'             // Tạo thẻ dự án
  | 'editCard'               // Sửa thẻ dự án
  | 'deleteCard'             // Xóa thẻ dự án
  | 'moveCard'               // Kéo thẻ qua / giữa các cột
  | 'assignCardMember'       // Gán thành viên cho thẻ dự án
  // CÔNG VIỆC (TASK)
  | 'createTask'             // Tạo công việc mới
  | 'editTask'               // Sửa thông tin công việc
  | 'deleteTask'             // Xóa công việc
  | 'assignTask'             // Giao việc (assigner)
  | 'receiveTask'            // Nhận việc
  | 'completeTask'           // Tự hoàn thành công việc
  | 'approveResult'          // Duyệt kết quả
  | 'rejectResult'           // Từ chối duyệt kết quả
  // NHIỆM VỤ CON (MISSION)
  | 'createMission'          // Tạo nhiệm vụ con
  | 'editMission'            // Sửa nhiệm vụ con
  | 'deleteMission'          // Xóa nhiệm vụ con
  | 'assignMissionMainAssignee' // Gán phụ trách chính nhiệm vụ
  | 'assignMissionMember'    // Gán thành viên vào nhiệm vụ
  | 'assignSubWorker'        // Gán thợ phụ (mission)
  | 'completeMission'        // Xác nhận hoàn thành nhiệm vụ
  | 'recordTravelAllowance'  // Ghi nhận công tác phí nhiệm vụ
  // PHÂN CÔNG & THAM GIA
  | 'assignMembers'          // Thêm/xóa người tham gia công việc
  | 'addInvolved'            // Thêm người liên quan
  | 'removeInvolved'         // Xóa người liên quan
  // TÀI CHÍNH
  | 'proposeAdvance'         // Đề xuất tạm ứng
  | 'settlePayment'          // Quyết toán thanh toán
  | 'viewFinanceLedger'      // Xem sổ cái thu chi
  // KỶ LUẬT
  | 'recordViolation'        // Ghi nhận vi phạm
  | 'issuePenalty'           // Lập phiếu phạt
  // HỒ SƠ LIÊN THÔNG (Connected Tools)
  | 'openToolApproval'       // Mở công cụ Phê duyệt
  | 'openToolCost'           // Mở công cụ Chi phí
  | 'openToolMaterial'       // Mở công cụ Vật tư
  | 'openToolQuotation'      // Mở công cụ Báo giá
  | 'openToolContract'       // Mở công cụ Hợp đồng
  | 'openToolAcceptance'     // Mở công cụ Nghiệm thu
  | 'openToolLiquidation'    // Mở công cụ Thanh lý
  | 'manageDocs'             // Quản lý hồ sơ liên thông
  // BÌNH LUẬN & CHAT
  | 'addComment'             // Thêm bình luận
  | 'deleteComment'          // Xóa bình luận
  | 'taskChat'               // Chat nội bộ công việc
  // TỆP ĐÍNH KÈM
  | 'uploadAttachment'       // Tải lên tệp
  | 'deleteAttachment';      // Xóa tệp

// ─── Visibility Mode: tầm nhìn theo sự liên quan ─────────────────────────
// all      → thấy mọi cột/thẻ/công việc của dự án
// related  → chỉ thấy thẻ/công việc có mặt mình
// readonly → thấy nhưng không thao tác
export type VisibilityMode = 'all' | 'related' | 'readonly';

// ─── Quy tắc theo trạng thái (tùy biến nâng cao) ─────────────────────────
export interface ProjectStatusRule {
  action: ProjectAction;
  condition: string; // ví dụ: 'status !== completed'
  enabled: boolean;
}

// ─── Ma trận quyền mặc định ──────────────────────────────────────────────
export interface ProjectPermissionMatrix {
  version: number;
  updatedBy?: string;
  updatedAt?: string;
  /** Mỗi action = danh sách ProjectRoleScope được phép */
  actions: Record<ProjectAction, ProjectRoleScope[]>;
  /** Tầm nhìn theo từng vai trò */
  visibility: Partial<Record<ProjectRoleScope, VisibilityMode>>;
  /** Kế thừa quyền cấp dưới (pm cấp → tự động cấp cho assignee, involved...) */
  inheritBelow: boolean;
  /** Quy tắc theo trạng thái */
  statusRules: ProjectStatusRule[];
  /** Ghi đè theo từng dự án (projectId -> ma trận riêng) */
  projectOverrides?: Record<string, Partial<Pick<ProjectPermissionMatrix, 'actions' | 'visibility' | 'inheritBelow'>>>;
}

const STORAGE_KEY = 'hl_project_permissions_v1';

// Thứ tự cấp bậc (cao → thấp) để tính kế thừa
export const ROLE_HIERARCHY: ProjectRoleScope[] = [
  'director',
  'pm',
  'assigner',
  'assignee',
  'missionAssignee',
  'involved',
  'teamMember',
  'accountant',
];

export const DEFAULT_PROJECT_PERMISSIONS: ProjectPermissionMatrix = {
  version: 2,
  inheritBelow: true,
  actions: {
    // CẤP DỰ ÁN
    createProject:       ['director', 'pm'],
    editProjectInfo:     ['director', 'pm'],
    updateProjectStatus: ['director', 'pm'],
    viewProjectFinance:  ['director', 'pm', 'accountant'],
    manageProjectDocs:   ['director', 'pm', 'assigner', 'accountant'],
    deleteProject:       ['director', 'pm'],
    exportProject:       ['director', 'pm', 'assigner'],
    quickAddCustomer:    ['director', 'pm', 'assigner'],

    // CỘT KANBAN
    createColumn:           ['director', 'pm'],
    editColumn:             ['director', 'pm'],
    deleteColumn:           ['director', 'pm'],
    arrangeColumn:          ['director', 'pm'],
    configureColumnAutomation: ['director', 'pm'],

    // THẺ DỰ ÁN
    createCard:       ['director', 'pm', 'assigner', 'assignee', 'teamMember'],
    editCard:         ['director', 'pm', 'assigner', 'assignee'],
    deleteCard:       ['director', 'pm'],
    moveCard:         ['director', 'pm', 'assigner', 'assignee', 'missionAssignee', 'teamMember'],
    assignCardMember: ['director', 'pm', 'assigner', 'assignee'],

    // CÔNG VIỆC
    createTask:    ['director', 'pm', 'assigner', 'assignee', 'teamMember'],
    editTask:      ['director', 'pm', 'assigner'],
    deleteTask:    ['director', 'pm'],
    assignTask:    ['director', 'pm', 'assigner', 'assignee'],
    receiveTask:   ['assignee', 'missionAssignee'],
    completeTask:  ['assignee', 'missionAssignee'],
    approveResult: ['director', 'pm', 'assigner'],
    rejectResult:  ['director', 'pm', 'assigner'],

    // NHIỆM VỤ CON
    createMission:            ['director', 'pm', 'assigner', 'assignee'],
    editMission:              ['director', 'pm', 'assigner', 'assignee'],
    deleteMission:            ['director', 'pm'],
    assignMissionMainAssignee: ['director', 'pm', 'assigner', 'assignee'],
    assignMissionMember:      ['director', 'pm', 'assigner', 'assignee', 'missionAssignee'],
    assignSubWorker:          ['director', 'pm', 'assigner', 'assignee'],
    completeMission:          ['director', 'pm', 'assigner', 'assignee', 'missionAssignee'],
    recordTravelAllowance:    ['director', 'pm', 'assigner', 'assignee', 'missionAssignee'],

    // PHÂN CÔNG
    assignMembers: ['director', 'pm', 'assigner', 'assignee'],
    addInvolved:    ['director', 'pm', 'assigner', 'assignee'],
    removeInvolved: ['director', 'pm', 'assigner'],

    // TÀI CHÍNH
    proposeAdvance:   ['director', 'pm', 'assignee', 'teamMember'],
    settlePayment:    ['director', 'pm', 'accountant'],
    viewFinanceLedger: ['director', 'pm', 'accountant'],

    // KỶ LUẬT
    recordViolation: ['director', 'pm', 'assigner', 'assignee', 'missionAssignee'],
    issuePenalty:    ['director', 'pm', 'accountant'],

    // HỒ SƠ LIÊN THÔNG
    openToolApproval:   ['director', 'pm', 'assigner', 'assignee'],
    openToolCost:       ['director', 'pm', 'assigner', 'accountant'],
    openToolMaterial:   ['director', 'pm', 'assigner', 'assignee', 'missionAssignee', 'involved'],
    openToolQuotation:  ['director', 'pm', 'assigner'],
    openToolContract:   ['director', 'pm', 'assigner', 'accountant'],
    openToolAcceptance: ['director', 'pm', 'assigner'],
    openToolLiquidation:['director', 'pm', 'assigner', 'accountant'],
    manageDocs:         ['director', 'pm', 'assigner', 'accountant'],

    // BÌNH LUẬN & CHAT
    addComment: ['director', 'pm', 'assigner', 'assignee', 'missionAssignee', 'involved', 'teamMember'],
    deleteComment: ['director', 'pm', 'assigner'],
    taskChat:   ['director', 'pm', 'assigner', 'assignee', 'missionAssignee', 'involved', 'teamMember'],

    // TỆP ĐÍNH KÈM
    uploadAttachment: ['director', 'pm', 'assigner', 'assignee', 'missionAssignee', 'involved', 'teamMember'],
    deleteAttachment: ['director', 'pm', 'assigner'],
  },
  visibility: {
    director: 'all',
    pm: 'all',
    assigner: 'all',
    assignee: 'related',
    missionAssignee: 'related',
    involved: 'related',
    teamMember: 'related',
    accountant: 'readonly',
  },
  statusRules: [],
};

// ─── Helpers ─────────────────────────────────────────────────────────────

const IS_ADMIN = (uid?: string) => uid === 'NV_ADMIN' || uid === 'emp_admin' || uid === 'admin';

/** Tính các ProjectRoleScope của user đối với một dự án/công việc cụ thể */
export const getProjectRoleScopes = (
  currentUser: Employee | undefined,
  project: Project | undefined,
  task?: Task
): ProjectRoleScope[] => {
  if (!currentUser) return [];

  const scopes: ProjectRoleScope[] = [];

  // 1. Director (Role Group: role_admin)
  if (isUserInRoleGroup(currentUser.id, 'role_admin')) scopes.push('director');

  // 2. Kế Toán (Role Group: role_accounting)
  if (isUserInRoleGroup(currentUser.id, 'role_accounting')) scopes.push('accountant');

  if (project) {
    // 3. Trưởng Dự Án (PM)
    if (project.pmId === currentUser.id) scopes.push('pm');

    // 4. Người Liên Quan dự án
    if (project.involvedEmployeeIds?.includes(currentUser.id)) scopes.push('involved');
  }

  if (task) {
    // 5. Người Giao Việc
    if (task.assignerId === currentUser.id) scopes.push('assigner');

    // 6. Phụ Trách Công Việc
    if (task.assigneeId === currentUser.id) scopes.push('assignee');

    // 7. Phụ Trách Nhiệm Vụ
    if (task.missions?.some(m => m.mainAssigneeId === currentUser.id)) scopes.push('missionAssignee');

    // 8. Người Liên Quan công việc
    if (task.involvedEmployeeIds?.includes(currentUser.id)) scopes.push('involved');
  }

  // Nếu không rơi vào vai trò đặc thù nào → coi là thành viên nhóm
  if (scopes.length === 0) scopes.push('teamMember');

  return Array.from(new Set(scopes));
};

/** Kế thừa: nếu role cao được cấp, các role thấp hơn cũng được cấp */
const expandInheritance = (roles: ProjectRoleScope[]): ProjectRoleScope[] => {
  const result = new Set<ProjectRoleScope>(roles);
  for (const r of roles) {
    const idx = ROLE_HIERARCHY.indexOf(r);
    if (idx >= 0) {
      // Thêm mọi role đứng sau r trong hierarchy (cấp thấp hơn)
      for (let i = idx + 1; i < ROLE_HIERARCHY.length; i++) {
        result.add(ROLE_HIERARCHY[i]);
      }
    }
  }
  return Array.from(result);
};

// ─── Load / Save (localStorage + DB) ─────────────────────────────────────

export const loadProjectPermissions = (): ProjectPermissionMatrix => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...DEFAULT_PROJECT_PERMISSIONS,
        ...parsed,
        actions: { ...DEFAULT_PROJECT_PERMISSIONS.actions, ...(parsed.actions || {}) },
        visibility: { ...DEFAULT_PROJECT_PERMISSIONS.visibility, ...(parsed.visibility || {}) },
        // Preserve roleGroupMatrix from saved data
        roleGroupMatrix: parsed.roleGroupMatrix,
      };
    }
  } catch (e) {
    console.error('Lỗi đọc', STORAGE_KEY, e);
  }
  return DEFAULT_PROJECT_PERMISSIONS;
};

/**
 * Đồng bộ ma trận quyền dự án từ Supabase → localStorage.
 * Gọi khi component mount để đảm bảo dữ liệu mới nhất từ DB.
 */
export const syncProjectPermissionsFromDb = async (): Promise<ProjectPermissionMatrix> => {
  try {
    const cloudMatrix = await dbService.projectPermissions.get();
    if (cloudMatrix) {
      const merged: ProjectPermissionMatrix = {
        ...DEFAULT_PROJECT_PERMISSIONS,
        ...cloudMatrix,
        actions: { ...DEFAULT_PROJECT_PERMISSIONS.actions, ...(cloudMatrix.actions || {}) },
        visibility: { ...DEFAULT_PROJECT_PERMISSIONS.visibility, ...(cloudMatrix.visibility || {}) },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch (e) {
    console.warn('Supabase projectPermissions sync error:', e);
  }
  return loadProjectPermissions();
};

/** Lưu ma trận lên localStorage + Firestore + Supabase (qua dbService). Async, fail-safe. */
export const saveProjectPermissions = async (matrix: ProjectPermissionMatrix): Promise<void> => {
  const finalMatrix: ProjectPermissionMatrix = {
    ...matrix,
    version: 2,
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(finalMatrix));
  } catch (e) {
    console.error('Lỗi lưu localStorage', STORAGE_KEY, e);
  }
  // Đẩy lên cloud (Firestore + Supabase) nếu có dbService
  try {
    await dbService.projectPermissions.save(finalMatrix);
  } catch (e) {
    console.warn('Lưu projectPermissions lên cloud thất bại (offline fallback):', e);
  }
  // Notify components
  window.dispatchEvent(new Event('storage'));
  window.dispatchEvent(new CustomEvent('hl-project-permissions-updated', { detail: finalMatrix }));
};

// ─── Role Group → Project Actions (Global Matrix) ────────────────────────
// Cho phép HRM Role Group (vd: Nhân viên Văn phòng, Kế toán...)
// được làm gì trong MỌI dự án — ngoài quyền theo context (pm, assigner...)
// Lưu cùng matrix chính vào Supabase qua dbService.projectPermissions

export interface RoleGroupProjectMatrix {
  /** Mỗi HRM Role Group ID = danh sách project actions được phép (global cho tất cả dự án) */
  roleGroupActions: Record<string, ProjectAction[]>;
  /** Per-project overrides: dự án ID → role group ID → actions. Cho phép cấp quyền khác biệt cho từng dự án */
  perProjectOverrides?: Record<string, Record<string, ProjectAction[]>>;
}

export const loadRoleGroupProjectMatrix = (): RoleGroupProjectMatrix => {
  // Ưu tiên đọc từ matrix chính (đã sync Supabase)
  try {
    const mainMatrix = loadProjectPermissions();
    if ((mainMatrix as any).roleGroupMatrix) {
      return (mainMatrix as any).roleGroupMatrix;
    }
  } catch (e) {}
  // Fallback: localStorage cũ (migration)
  try {
    const saved = localStorage.getItem('hl_role_group_project_permissions');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return { roleGroupActions: {} };
};

export const saveRoleGroupProjectMatrix = async (rgMatrix: RoleGroupProjectMatrix): Promise<void> => {
  // Đọc matrix hiện tại, merge roleGroupMatrix vào, rồi lưu chung
  try {
    const currentMatrix = loadProjectPermissions();
    const merged = { ...currentMatrix, roleGroupMatrix: rgMatrix } as any;
    await saveProjectPermissions(merged);
  } catch (e) {
    console.warn('Lưu roleGroupProjectMatrix thất bại:', e);
  }
};

// ─── Core check ───────────────────────────────────────────────────────────

/**
 * Kiểm tra user có được thực hiện action không.
 * Kiểm tra 2 nguồn:
 *   1. Context role (pm, assigner, assignee...) — theo vị trí trong dự án/công việc
 *   2. HRM Role Group — quyền đặc biệt cho nhóm vai trò HRM
 * @param action hành động cần kiểm tra
 * @param currentUser user hiện tại
 * @param project dự án (bắt buộc cho hầu hết action)
 * @param task công việc (bắt buộc cho action cấp task/mission)
 * @param matrixOverride ma trận tùy chọn (mặc định load từ storage)
 * @param projectId để áp dụng per-project override
 */
export const can = (
  action: ProjectAction,
  currentUser: Employee | undefined,
  project: Project | undefined,
  task?: Task,
  matrixOverride?: ProjectPermissionMatrix,
  projectId?: string
): boolean => {
  if (!currentUser) return false;
  if (IS_ADMIN(currentUser.id)) return true;

  const matrix = matrixOverride || loadProjectPermissions();

  // Áp dụng per-project override nếu có
  let effectiveActions = matrix.actions;
  let effectiveInherit = matrix.inheritBelow;
  const override = projectId ? matrix.projectOverrides?.[projectId] : (project?.id ? matrix.projectOverrides?.[project.id] : undefined);
  if (override) {
    if (override.actions) effectiveActions = { ...matrix.actions, ...override.actions };
    if (override.inheritBelow !== undefined) effectiveInherit = override.inheritBelow;
  }

  // ── Nguồn 1: Context roles (vị trí trong dự án/công việc) ──
  const scopes = getProjectRoleScopes(currentUser, project, task);

  // Kiểm tra visibility readonly → không được thao tác (trừ role group)
  let blockedByVisibility = false;
  const allowedRoles = effectiveActions[action] || [];
  if (allowedRoles.length > 0) {
    const checkRoles = effectiveInherit ? expandInheritance(allowedRoles) : allowedRoles;
    const hasContextPermission = scopes.some(s => checkRoles.includes(s));
    if (!hasContextPermission) {
      blockedByVisibility = true;
    }
  } else {
    blockedByVisibility = true;
  }

  // Nếu context role bị block bởi visibility readonly → không cho
  for (const scope of scopes) {
    const vis = matrix.visibility[scope];
    if (vis === 'readonly') blockedByVisibility = true;
  }

  // Nếu có quyền từ context role → cho phép
  if (!blockedByVisibility) return true;

  // ── Nguồn 2: HRM Role Group (quyền đặc biệt global) ──
  const rgMatrix = (matrix as any).roleGroupMatrix as RoleGroupProjectMatrix | undefined;
  if (rgMatrix?.roleGroupActions) {
    const empGroupIds = currentUser.roleGroupIds || [];
    for (const groupId of empGroupIds) {
      if (rgMatrix.roleGroupActions[groupId]?.includes(action)) return true;
    }
  }

  return false;
};

/** Lấy tầm nhìn của user đối với dự án */
export const getVisibility = (
  currentUser: Employee | undefined,
  project: Project | undefined,
  task?: Task
): VisibilityMode => {
  if (!currentUser) return 'readonly';
  if (IS_ADMIN(currentUser.id)) return 'all';

  const scopes = getProjectRoleScopes(currentUser, project, task);
  const matrix = loadProjectPermissions();

  // Ưu tiên role cao nhất (all > related > readonly)
  const rank: Record<VisibilityMode, number> = { all: 3, related: 2, readonly: 1 };
  let best: VisibilityMode = 'related';
  for (const scope of scopes) {
    const vis = matrix.visibility[scope];
    if (vis && rank[vis] > rank[best]) best = vis;
  }
  return best;
};

/** Tiện ích: user có thấy mọi thứ (all) không */
export const canSeeAll = (currentUser: Employee | undefined, project: Project | undefined, task?: Task): boolean => {
  return getVisibility(currentUser, project, task) === 'all';
};
