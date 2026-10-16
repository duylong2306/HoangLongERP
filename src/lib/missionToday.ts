// NHIỆM VỤ (nhiệm vụ con của công việc) TOÀN DOANH NGHIỆP — Bảng điều hành Giám đốc → Phòng Dự Án.
// Nhiệm vụ nằm trong Task.missions. Hạn của nhiệm vụ để trống thì thừa hưởng hạn của công việc chứa nó.
// Hàm thuần (không gọi DB) để dễ kiểm tra.
import type { Task } from '../types';
import { toDay, diffDays } from './executiveDashboard';

export interface MissionRow {
  id: string;
  name: string;
  taskId: string;
  taskName: string;
  projectId?: string;
  assigneeId?: string;       // phụ trách chính
  memberIds: string[];
  status: 'todo' | 'doing' | 'completed';
  deadline: string;          // YYYY-MM-DD ('' nếu không có)
  completedDay: string;      // ngày hoàn thành (YYYY-MM-DD) hoặc ''
  daysLate: number;          // >0 nếu chưa xong và quá hạn
}

export type MissionView = 'today' | 'overdue' | 'todo' | 'doneToday' | 'all';
export const MISSION_VIEW_LABEL: Record<MissionView, string> = {
  today: 'Hôm nay (đang làm + đến hạn hôm nay)', overdue: 'Quá hạn', todo: 'Chưa làm', doneToday: 'Hoàn thành hôm nay', all: 'Tất cả',
};

export function buildMissionRows(tasks: Task[], today: string): MissionRow[] {
  const out: MissionRow[] = [];
  for (const t of tasks) {
    for (const m of (t.missions || [])) {
      const status = (m.status === 'doing' || m.status === 'completed') ? m.status : 'todo';
      const deadline = toDay(m.deadline) || toDay(t.deadline);
      const daysLate = status !== 'completed' && deadline && deadline < today ? Math.max(1, diffDays(deadline, today)) : 0;
      out.push({
        id: `${t.id}::${m.id}`, name: m.name || '(chưa đặt tên)', taskId: t.id, taskName: t.name, projectId: t.projectId,
        assigneeId: m.mainAssigneeId, memberIds: m.memberIds || [], status, deadline,
        completedDay: status === 'completed' ? toDay(m.completedAt) : '', daysLate,
      });
    }
  }
  return out;
}

/** Nhiệm vụ có thuộc nhóm xem này không. Quá hạn được tách riêng (không lẫn vào "Hôm nay"/"Chưa làm"). */
export function inMissionView(r: MissionRow, view: MissionView, today: string): boolean {
  switch (view) {
    case 'today': return r.status !== 'completed' && r.daysLate === 0 && (r.status === 'doing' || r.deadline === today);
    case 'overdue': return r.daysLate > 0;
    case 'todo': return r.status === 'todo' && r.daysLate === 0;
    case 'doneToday': return r.status === 'completed' && r.completedDay === today;
    default: return true;
  }
}

/** Sắp xếp: quá hạn nhiều ngày nhất lên đầu, rồi theo hạn gần nhất, rồi theo tên. */
export function sortMissions(rows: MissionRow[]): MissionRow[] {
  return [...rows].sort((a, b) => b.daysLate - a.daysLate || (a.deadline || '9999').localeCompare(b.deadline || '9999') || a.name.localeCompare(b.name, 'vi'));
}
