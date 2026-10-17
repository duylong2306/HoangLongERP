// "VIỆC CỦA TÔI" — kiểu xem TỔNG QUAN (lựa chọn thay cho kiểu Cột/Kanban).
// Hàm thuần (không gọi DB/giao diện) để dễ kiểm tra: gom việc & nhiệm vụ của 1 người, chia mốc thời gian, dải 7 ngày,
// danh sách "Tôi giao", việc ghim hôm nay và ghi nhớ kiểu xem đã chọn.
import type { Task } from '../types';
import { toDay, todayYmd, addDays, diffDays } from './executiveDashboard';

// ─── Kiểu xem đã chọn (lưu localStorage theo người dùng + doanh nghiệp) ───
export type MyTasksView = 'kanban' | 'overview';
export const MY_TASKS_VIEW_DEFAULT: MyTasksView = 'overview';   // mặc định Tổng quan để người dùng kiểm thử giao diện mới (ai đã chọn Kanban thì vẫn giữ Kanban)
export const viewStorageKey = (userId?: string) => `hl_my_tasks_view_${userId || 'anon'}`;
export function readMyTasksView(key: string, storage: Pick<Storage, 'getItem'> | null = typeof localStorage !== 'undefined' ? localStorage : null): MyTasksView {
  try { const v = storage?.getItem(key); return v === 'overview' || v === 'kanban' ? v : MY_TASKS_VIEW_DEFAULT; } catch { return MY_TASKS_VIEW_DEFAULT; }
}
export function writeMyTasksView(key: string, v: MyTasksView, storage: Pick<Storage, 'setItem'> | null = typeof localStorage !== 'undefined' ? localStorage : null) {
  try { storage?.setItem(key, v); } catch { /* trình duyệt chặn lưu → bỏ qua, vẫn dùng được trong phiên */ }
}

// ─── Việc ghim "Tập trung hôm nay": hết ngày tự làm mới ───
export const pinsStorageKey = (userId?: string) => `hl_my_tasks_pins_${userId || 'anon'}`;
export function readPins(key: string, today: string, storage: Pick<Storage, 'getItem'> | null = typeof localStorage !== 'undefined' ? localStorage : null): string[] {
  try {
    const raw = storage?.getItem(key); if (!raw) return [];
    const p = JSON.parse(raw);
    return p && p.day === today && Array.isArray(p.keys) ? p.keys.filter((k: any) => typeof k === 'string') : [];   // khác ngày → bỏ
  } catch { return []; }
}
export function writePins(key: string, today: string, keys: string[], storage: Pick<Storage, 'setItem'> | null = typeof localStorage !== 'undefined' ? localStorage : null) {
  try { storage?.setItem(key, JSON.stringify({ day: today, keys })); } catch { /* bỏ qua */ }
}

// ─── Gom việc của tôi ───
export interface MyWorkItem {
  key: string;              // duy nhất: task:<id> | mis:<taskId>:<missionId>
  kind: 'task' | 'mission';
  taskId: string;
  missionId?: string;
  title: string;
  taskName: string;
  projectId?: string;
  project: string;          // tên công trình ('' = nội bộ)
  due: string;              // YYYY-MM-DD hoặc ''
  rate: number | null;      // % hoàn thành (chỉ công việc)
  status: 'todo' | 'doing' | 'reviewing' | 'overdue' | 'completed' | string;
  isLead: boolean;          // nhiệm vụ: là phụ trách chính
  canReceive: boolean;      // có thể bấm "Nhận việc" (chưa làm + đúng quyền)
  role: 'assignee' | 'lead' | 'member';   // công việc: được giao; nhiệm vụ: phụ trách chính / tham gia
  memberCount: number;      // số người tham gia nhiệm vụ (không tính phụ trách chính)
  doneDay: string;          // ngày hoàn thành (chỉ khi đã xong), '' nếu chưa
}

export interface BuildOpts {
  userId?: string; userName?: string;
  projectName: (projectId?: string) => string;
  /** Quyền "Nhận việc" của công việc (ma trận quyền công việc) — mặc định cho phép khi là người được giao */
  canReceiveTask?: (t: Task) => boolean;
  /** Gồm cả việc/nhiệm vụ ĐÃ HOÀN THÀNH (như kiểu Cột hiển thị) — mặc định không */
  includeCompleted?: boolean;
}

/** Công việc của tôi = tôi là người được giao, hoặc là phụ trách chính của 1 nhiệm vụ trong đó (đúng như tab "Công việc được giao"). */
export function isMyTask(t: Task, userId?: string, userName?: string): boolean {
  const lead = (t.missions || []).some(m => m.mainAssigneeId === userId);
  return t.assigneeId === userId || t.assigneeId === userName || lead;
}

export function buildMyWorkItems(tasks: Task[], o: BuildOpts): MyWorkItem[] {
  const out: MyWorkItem[] = [];
  for (const t of tasks) {
    if (isMyTask(t, o.userId, o.userName) && (o.includeCompleted || t.status !== 'completed')) {
      out.push({
        key: `task:${t.id}`, kind: 'task', taskId: t.id, title: t.name, taskName: t.name, projectId: t.projectId, project: o.projectName(t.projectId),
        due: toDay(t.deadline), rate: Number.isFinite(Number(t.completionRate)) ? Number(t.completionRate) : 0, status: t.status, isLead: t.assigneeId === o.userId,
        canReceive: t.status === 'todo' && (o.canReceiveTask ? o.canReceiveTask(t) : (t.assigneeId === o.userId)),
        role: 'assignee', memberCount: 0, doneDay: t.status === 'completed' ? toDay((t as any).completedDate || (t as any).completedAt || (t as any).updatedAt) : '',
      });
    }
    for (const m of (t.missions || [])) {
      const mine = m.mainAssigneeId === o.userId || (m.memberIds || []).includes(o.userId as string);
      if (!mine || (m.status === 'completed' && !o.includeCompleted)) continue;
      const lead = m.mainAssigneeId === o.userId;
      out.push({
        key: `mis:${t.id}:${m.id}`, kind: 'mission', taskId: t.id, missionId: m.id, title: m.name || '(chưa đặt tên)', taskName: t.name, projectId: t.projectId,
        project: o.projectName(t.projectId), due: toDay(m.deadline) || toDay(t.deadline), rate: null, status: m.status, isLead: lead,
        canReceive: m.status === 'todo' && lead,   // chỉ phụ trách chính được nhận nhiệm vụ (đúng nút "Nhận NV" hiện có)
        role: lead ? 'lead' : 'member', memberCount: (m.memberIds || []).filter(x => x !== m.mainAssigneeId && x !== o.userId).length,   // người tham gia khác (không tính phụ trách chính và chính tôi)
        doneDay: m.status === 'completed' ? toDay(m.completedAt) : '',
      });
    }
  }
  return out;
}

export type Bucket = 'late' | 'today' | 'week' | 'later' | 'none';
export function bucketOf(due: string, today: string): Bucket {
  if (!due) return 'none';
  const d = diffDays(today, due);
  return d < 0 ? 'late' : d === 0 ? 'today' : d <= 7 ? 'week' : 'later';
}
export const BUCKET_LABEL: Record<Bucket, string> = { late: 'Quá hạn', today: 'Hôm nay', week: '7 ngày tới', later: 'Sau đó', none: 'Chưa đặt hạn' };
export const BUCKET_ORDER: Bucket[] = ['late', 'today', 'week', 'later', 'none'];

/** Chia nhóm theo mốc thời gian, mỗi nhóm sắp theo hạn gần nhất. */
export function groupByBucket(items: MyWorkItem[], today: string): Record<Bucket, MyWorkItem[]> {
  const g: Record<Bucket, MyWorkItem[]> = { late: [], today: [], week: [], later: [], none: [] };
  for (const it of items) g[bucketOf(it.due, today)].push(it);
  (Object.keys(g) as Bucket[]).forEach(k => g[k].sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || a.title.localeCompare(b.title, 'vi')));
  return g;
}

/** Tập trung hôm nay: việc đã ghim trước, rồi quá hạn (cũ nhất trước), rồi đến hạn hôm nay. Không trùng. */
export function focusItems(items: MyWorkItem[], today: string, pinnedKeys: string[]): MyWorkItem[] {
  const pinned = new Set(pinnedKeys);
  const g = groupByBucket(items, today);
  const out: MyWorkItem[] = [];
  const seen = new Set<string>();
  const push = (i: MyWorkItem) => { if (!seen.has(i.key)) { seen.add(i.key); out.push(i); } };
  items.filter(i => pinned.has(i.key)).forEach(push);
  g.late.forEach(push);
  g.today.forEach(push);
  return out;
}

/** Dải 7 ngày từ hôm nay: số việc đến hạn mỗi ngày (đang mở). */
export function weekStrip(items: MyWorkItem[], today: string): { day: string; count: number; isToday: boolean }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(today, i);
    return { day, count: items.filter(x => x.due === day).length, isToday: i === 0 };
  });
}

/** "Mới được giao — chờ nhận": việc/nhiệm vụ chưa làm mà tôi nhận được. */
export const awaitingReceive = (items: MyWorkItem[]) => items.filter(i => i.status === 'todo');

// ─── Tôi giao cho người khác ───
export interface AssignedByMe { taskId: string; title: string; project: string; assigneeId?: string; assigneeName: string; due: string; rate: number; status: string }
export function assignedByMe(tasks: Task[], o: { userId?: string; userName?: string; projectName: (id?: string) => string; employeeName: (id?: string) => string }): AssignedByMe[] {
  return tasks
    .filter(t => t.status !== 'completed' && (t.assignerId === o.userId || t.assignerId === o.userName) && t.assigneeId !== o.userId && t.assigneeId !== o.userName)
    .map(t => ({ taskId: t.id, title: t.name, project: o.projectName(t.projectId), assigneeId: t.assigneeId, assigneeName: o.employeeName(t.assigneeId), due: toDay(t.deadline), rate: Number(t.completionRate) || 0, status: t.status }))
    .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
}

/** Việc theo công trình (số mục đang mở), nhiều → ít. */
export function countByProject(items: MyWorkItem[]): { project: string; count: number }[] {
  const m = new Map<string, number>();
  for (const i of items) m.set(i.project || 'Nhiệm vụ nội bộ', (m.get(i.project || 'Nhiệm vụ nội bộ') || 0) + 1);
  return [...m.entries()].map(([project, count]) => ({ project, count })).sort((a, b) => b.count - a.count);
}

export { todayYmd };
