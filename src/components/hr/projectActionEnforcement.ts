// ─── Bảng "ô tick nào trong Quyền Dự Án THỰC SỰ có tác dụng" ─────────────────────────────────────
// RÀ SOÁT 2026-10: ma trận có 54 hành động nhưng nhiều hành động KHÔNG có nơi nào trong ứng dụng kiểm tra
// (tick hay bỏ tick đều không đổi gì) → người dùng tưởng đã giới hạn/cấp quyền mà thực tế không. Bảng này
// liệt kê chính xác nơi có tác dụng để giao diện gắn nhãn "Chưa áp dụng" cho phần còn lại.
// Có test canh lệch (src/components/hr/__tests__/projectActionEnforcement.test.ts): thêm/bớt chỗ gọi can()
// mà không cập nhật bảng này thì test báo lỗi.
import type { ProjectAction } from './hrProjectPermissions';

/** Tab "Theo vị trí": hành động được can() kiểm tra trực tiếp ở ProjectKanbanBoard / ProjectManagement / ConnectedToolsModal. */
export const ENFORCED_BY_POSITION: ReadonlySet<ProjectAction> = new Set<ProjectAction>([
  'createProject', 'editProjectInfo', 'updateProjectStatus', 'manageProjectDocs', 'deleteProject', 'quickAddCustomer',
  'createColumn', 'editColumn', 'deleteColumn', 'configureColumnAutomation',
  'moveCard',
  'createTask', 'editTask', 'deleteTask', 'settlePayment',
  'openToolApproval', 'openToolCost', 'openToolMaterial', 'openToolQuotation', 'openToolContract', 'openToolAcceptance', 'openToolLiquidation', 'manageDocs',
  'uploadAttachment', 'deleteAttachment', // file đính kèm báo cáo nhiệm vụ (TaskDetailModal)
]);

/**
 * Tab "Vai trò nhóm HRM": ngoài các hành động ở trên, quyền theo NHÓM còn được canDoTaskAction (hrTaskPermissions.ts) đọc
 * cho thao tác trong chi tiết công việc. Riêng nhận việc/hoàn thành (receiveTask/completeTask) CỐ Ý không đọc theo nhóm.
 */
const TASK_LEVEL_FOR_GROUP: ProjectAction[] = [
  'viewTask', // canViewTask đọc 'viewTask' của nhóm để cho xem công việc
  'approveResult', 'rejectResult', 'assignMembers', 'assignSubWorker', 'recordViolation', 'issuePenalty', 'proposeAdvance',
  'createMission', 'editMission', 'deleteMission', // = "manageSubTask" trong Quyền Công việc
];
export const ENFORCED_BY_ROLE_GROUP: ReadonlySet<ProjectAction> = new Set<ProjectAction>([...ENFORCED_BY_POSITION, ...TASK_LEVEL_FOR_GROUP]);

/**
 * Trong ENFORCED_BY_POSITION: những hành động được kiểm tra KÈM CÔNG VIỆC cụ thể (Kanban truyền task cho sửa/xóa công việc,
 * ConnectedToolsModal truyền activeTask) — chỉ ở đó các vai trò Người giao việc / Phụ trách CV / Phụ trách NV / Thành viên nhiệm vụ mới xuất hiện.
 * Các hành động còn lại được kiểm tra ở cấp dự án/bảng (không có công việc). Dùng cho màn "Xem quyền của một nhân viên".
 */
export const CHECKED_WITH_TASK: ReadonlySet<ProjectAction> = new Set<ProjectAction>([
  'editTask', 'deleteTask',
  'openToolApproval', 'openToolCost', 'openToolMaterial', 'openToolQuotation', 'openToolContract', 'openToolAcceptance', 'openToolLiquidation', 'manageDocs',
  'uploadAttachment', 'deleteAttachment',
]);
