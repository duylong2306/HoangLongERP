// CẢNH BÁO GIAI ĐOẠN DỰ ÁN (kẹt / lệch / chậm) — hàm thuần, dùng cho Dashboard giám đốc và Tổng quan.
//   • KẸT   : ở cùng 1 giai đoạn (cột kanban) quá số ngày cho phép của cột (automation.stuckDays; mặc định 30; 0 = tắt).
//             Ngày vào giai đoạn lấy từ NHẬT KÝ DỰ ÁN (sự kiện "Giai đoạn dự án …" gần nhất) — dự án chưa từng đổi cột kể từ khi có nhật ký
//             thì chưa biết ngày vào → không cảnh báo (không đoán bừa). Dự án "Tạm dừng" không bị coi là kẹt (chờ là chủ đích).
//   • LỆCH  : giai đoạn và công việc không khớp — dự án hoàn thành mà còn việc chưa xong; hoặc việc con xong hết mà thẻ chưa chuyển cột
//             (chỉ nhắc khi thẻ đã tới giữa hành trình trở đi — 7 cột thì từ cột thứ 4 — để khỏi nhắc oan ở giai đoạn đầu khi mới chỉ có việc khảo sát).
//   • CHẬM  : tiến độ thấp hơn kế hoạch theo thời gian (ngày bắt đầu → ngày kết thúc dự kiến) quá 15 điểm %.
// Chỉ CẢNH BÁO, không chặn thao tác nào.
import type { Project, Task } from '../types';
import type { KanbanColumn } from './kanbanLogic';
import { columnsForProject, computeProjectProgress, stageIdOf } from './projectProgress';

export const DEFAULT_STUCK_DAYS = 30;
export const BEHIND_GAP = 15;   // điểm % chậm hơn kế hoạch thì mới cảnh báo

export type AlertKind = 'stuck' | 'mismatch' | 'behind';
export interface ProjectAlert { kind: AlertKind; text: string }
export interface ProjectHealth { projectId: string; stageId: string; daysInStage: number | null; stuckLimit: number; alerts: ProjectAlert[] }

/** Số ngày cho phép ở 1 cột (0 = tắt cảnh báo kẹt). */
export function stuckLimitOf(col: KanbanColumn | undefined): number {
  const v = col?.automation?.stuckDays as any;
  if (v === undefined || v === null || v === '' || !Number.isFinite(Number(v))) return DEFAULT_STUCK_DAYS;
  return Math.max(0, Math.round(Number(v)));
}

const ymdMs = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);
const parseYmd = (s?: string): number | null => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? ymdMs(+m[1], +m[2], +m[3]) : null; };
/** Ngày (theo giờ máy) của 1 mốc thời gian ISO */
const localDayMs = (iso: string): number | null => { const d = new Date(iso); return isNaN(d.getTime()) ? null : ymdMs(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
const DAY = 86400000;

export function buildProjectHealth(
  projects: Project[], tasks: Pick<Task, 'projectId' | 'status'>[], bySector: Partial<Record<string, KanbanColumn[]>>,
  stageEntries: Map<string, string>, today: string,
): Map<string, ProjectHealth> {
  const out = new Map<string, ProjectHealth>();
  const todayMs = parseYmd(today) as number;
  for (const p of projects) {
    if (p.status === 'cancelled') continue;
    const cols = columnsForProject(p, bySector);
    const pg = computeProjectProgress(p, tasks, cols);
    const stageId = stageIdOf(p as any, cols);
    const col = cols.find(c => c.id === stageId);
    const isFinalStage = stageId === cols[cols.length - 1].id;
    const alerts: ProjectAlert[] = [];

    // ── Ngày ở giai đoạn hiện tại ──
    const enteredIso = stageEntries.get(p.id);
    const enteredMs = enteredIso ? localDayMs(enteredIso) : null;
    const daysInStage = enteredMs === null ? null : Math.max(0, Math.round((todayMs - enteredMs) / DAY));
    const limit = stuckLimitOf(col);
    const running = p.status === 'processing' || p.status === 'new';

    // ── KẸT ──
    if (running && !isFinalStage && limit > 0 && daysInStage !== null && daysInStage > limit) {
      alerts.push({ kind: 'stuck', text: `Kẹt ${daysInStage} ngày ở "${col?.name}" (quá ${limit} ngày)` });
    }

    // ── LỆCH ──
    const open = pg.total - pg.done;
    if ((p.status === 'completed' || isFinalStage) && open > 0) {
      alerts.push({ kind: 'mismatch', text: `Đã hoàn thành nhưng còn ${open} việc chưa xong` });
    } else if (running && !isFinalStage && pg.total > 0 && pg.done === pg.total && pg.stage.index >= Math.floor(cols.length / 2)) {
      alerts.push({ kind: 'mismatch', text: 'Việc con đã xong hết nhưng chưa chuyển giai đoạn' });
    }

    // ── CHẬM so với kế hoạch ──
    const start = parseYmd(p.startDate), end = parseYmd(p.endDate);
    if (p.status === 'processing' && start !== null && end !== null && end > start && todayMs >= start && todayMs <= end) {
      const expected = Math.round(((todayMs - start) / (end - start)) * 100);
      if (expected >= 20 && pg.value + BEHIND_GAP < expected) alerts.push({ kind: 'behind', text: `Tiến độ ${pg.value}% thấp hơn kế hoạch ${expected}%` });
    }

    out.set(p.id, { projectId: p.id, stageId, daysInStage, stuckLimit: limit, alerts });
  }
  return out;
}

/** Số ngày trung bình các dự án (đã biết ngày vào) ở 1 giai đoạn; null nếu chưa dự án nào biết. */
export function avgDaysInStage(projectIds: string[], health: Map<string, ProjectHealth>): number | null {
  const ds = projectIds.map(id => health.get(id)?.daysInStage).filter((d): d is number => typeof d === 'number');
  return ds.length ? Math.round(ds.reduce((a, b) => a + b, 0) / ds.length) : null;
}

export const ALERT_LABEL: Record<AlertKind, string> = { stuck: 'Kẹt giai đoạn', mismatch: 'Lệch giai đoạn', behind: 'Chậm kế hoạch' };
