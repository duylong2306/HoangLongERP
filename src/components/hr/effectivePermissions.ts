// ─── Xem quyền HIỆU LỰC của một nhân viên (Quyền Dự Án) ─────────────────────────────────────────────
// Trả lời "người này thực sự làm được gì?" mà không bắt người dùng đọc ma trận. Dùng ĐÚNG hàm can() mà ứng dụng dùng thật, nên kết quả
// không thể lệch với hành vi thực tế. Mỗi ô cho biết CÓ/KHÔNG và ĐẾN TỪ ĐÂU: theo vị trí (ma trận "Theo vị trí"), theo nhóm HRM, hay toàn quyền.
import type { Employee, Project, Task, HrmRoleGroup } from '../../types';
import { can, ProjectAction, ProjectPermissionMatrix } from './hrProjectPermissions';
import { ENFORCED_BY_POSITION, CHECKED_WITH_TASK } from './projectActionEnforcement';

/** Các "tình huống" (cột) mà một người có thể đứng ở đó khi thao tác */
export type Situation = 'board' | 'pm' | 'assigner' | 'assignee' | 'missionAssignee' | 'teamMember';
export const SITUATION_LABELS: Record<Situation, string> = {
  board: 'Nhân viên thường (cấp dự án/bảng)',
  pm: 'Khi là Trưởng DA của dự án',
  assigner: 'Khi là Người giao việc',
  assignee: 'Khi là Phụ trách CV',
  missionAssignee: 'Khi là Phụ trách NV',
  teamMember: 'Khi là Thành viên nhiệm vụ',
};
export const TASK_SITUATIONS: Situation[] = ['assigner', 'assignee', 'missionAssignee', 'teamMember'];

export type Source = 'vitri' | 'nhom' | 'toanquyen' | null; // null = không có quyền

/** roleGroupIds hiệu lực của nhân viên — giống AuthContext: ưu tiên trường riêng, nếu rỗng thì suy ra từ danh sách thành viên của nhóm */
export function resolveRoleGroupIds(emp: { id: string; roleGroupIds?: string[] }, groups: Pick<HrmRoleGroup, 'id' | 'memberIds'>[]): string[] {
  if (emp.roleGroupIds && emp.roleGroupIds.length > 0) return emp.roleGroupIds;
  return groups.filter(g => g.memberIds?.includes(emp.id)).map(g => g.id);
}

const duAn = (pmId: string): Project => ({ id: 'preview_project', pmId, type: 'construction' } as any);
const congViec = (kind: Situation, empId: string): Task => {
  const base: any = { id: 'preview_task', assignerId: 'nguoi_khac', assigneeId: 'nguoi_khac', missions: [] };
  if (kind === 'assigner') base.assignerId = empId;
  if (kind === 'assignee') base.assigneeId = empId;
  if (kind === 'missionAssignee') base.missions = [{ id: 'm', name: 'm', memberIds: [], mainAssigneeId: empId, status: 'todo' }];
  if (kind === 'teamMember') base.missions = [{ id: 'm', name: 'm', memberIds: [empId], mainAssigneeId: 'nguoi_khac', status: 'todo' }];
  return base;
};

/** Kết quả một ô: có quyền không và đến từ nguồn nào */
export function checkCell(action: ProjectAction, emp: Employee, situation: Situation, matrix: ProjectPermissionMatrix): Source {
  const project = situation === 'pm' ? duAn(emp.id) : duAn('nguoi_khac');
  const task = TASK_SITUATIONS.includes(situation) ? congViec(situation, emp.id) : undefined;
  if (!can(action, emp, project, task, matrix)) return null;
  // Có quyền — xác định nguồn: thử bỏ quyền theo nhóm; nếu vẫn có → theo vị trí; bỏ cả ma trận vị trí mà vẫn có → toàn quyền (admin/siêu admin)
  const khongNhom = { ...matrix, roleGroupMatrix: undefined } as ProjectPermissionMatrix;
  const trong = { ...khongNhom, actions: {} } as unknown as ProjectPermissionMatrix;
  if (can(action, emp, project, task, trong)) return 'toanquyen';
  return can(action, emp, project, task, khongNhom) ? 'vitri' : 'nhom';
}

export interface PreviewRow { action: ProjectAction; cells: Record<Situation, Source | 'khongapdung'>; }

/** Tính cả bảng: mỗi hành động có tác dụng × mỗi tình huống */
export function previewEmployeePermissions(emp: Employee, matrix: ProjectPermissionMatrix): PreviewRow[] {
  const rows: PreviewRow[] = [];
  for (const action of ENFORCED_BY_POSITION) {
    const coTask = CHECKED_WITH_TASK.has(action);
    const cells = {} as Record<Situation, Source | 'khongapdung'>;
    (['board', 'pm', 'assigner', 'assignee', 'missionAssignee', 'teamMember'] as Situation[]).forEach(s => {
      const lienQuanTask = TASK_SITUATIONS.includes(s);
      // Cột theo công việc chỉ áp dụng cho hành động kiểm tra kèm công việc; hành động có công việc cũng có cột "Trưởng DA", còn cột "bảng" thì không
      if ((lienQuanTask && !coTask) || (s === 'board' && coTask)) cells[s] = 'khongapdung';
      else cells[s] = checkCell(action, emp, s, matrix);
    });
    rows.push({ action, cells });
  }
  return rows;
}
