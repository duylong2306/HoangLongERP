// TIẾN ĐỘ DỰ ÁN TỰ TÍNH TỪ CỘT KANBAN (giai đoạn) + CÔNG VIỆC CON — hàm thuần, dùng chung cho Tổng quan và màn Kanban.
//
// Vấn đề cũ: `project.progress` chỉ là 1 con số do quy tắc cột ghi vào (vd Thi công = 40%) nên đứng yên suốt giai đoạn dài nhất.
// Quy tắc mới:  tiến độ = ĐẦU khoảng của giai đoạn + (CUỐI − ĐẦU) × (số việc con đã xong / tổng số việc con của dự án).
//   • Khoảng % của từng cột: nếu cột có `automation.progressFrom/progressTo` thì dùng; chưa cấu hình thì CHIA ĐỀU các cột trước cột cuối
//     (cột cuối = "Hoàn thành" luôn là 100%). Ví dụ 7 cột → 6 giai đoạn: 0–17, 17–33, 33–50, 50–67, 67–83, 83–100, rồi 100.
//   • Dự án chưa có việc con nào → đứng ở ĐẦU khoảng của giai đoạn.
//   • Trạng thái "Hoàn thành" → 100%.
//   • PM/Giám đốc có thể GHI ĐÈ (`project.progressManual` 0–100); đè rồi thì hiện số tay, kèm số tự tính để đối chiếu; bỏ ghi đè = về tự động.
import type { Project, Task } from '../types';
import { getDefaultColumns, getProjectColumnId, type KanbanColumn } from './kanbanLogic';

export type ProgressSource = 'auto' | 'manual' | 'completed';

export interface StageInfo { id: string; name: string; index: number; total: number; from: number; to: number }
export interface ProjectProgress {
  /** Số hiển thị (0–100, đã làm tròn) */
  value: number;
  /** Số tự tính (luôn có, để đối chiếu khi đang ghi đè) */
  auto: number;
  source: ProgressSource;
  stage: StageInfo;
  /** Việc con đã xong / tổng số việc con của dự án */
  done: number;
  total: number;
}

const clamp = (n: number) => Math.min(100, Math.max(0, n));
const isFinal = (c: KanbanColumn, i: number, all: KanbanColumn[]) => c.automation?.type === 'auto_complete' || c.automation?.statusSet === 'completed' || i === all.length - 1;

/** Khoảng % của cột `columnId` trong bộ cột `columns` (đã có cấu hình riêng thì theo cấu hình, không thì chia đều). */
export function stageRange(columns: KanbanColumn[], columnId: string): StageInfo {
  const cols = columns.length ? columns : getDefaultColumns();
  const idx = Math.max(0, cols.findIndex(c => c.id === columnId));
  const col = cols[idx];
  const a: any = col.automation || {};
  // Cột cuối (Hoàn thành) = 100; các cột khác chia đều trên 0–100 theo thứ tự trong số cột "chưa hoàn thành".
  const working = cols.filter((c, i) => !isFinal(c, i, cols));
  let from = 100, to = 100;
  if (!isFinal(col, idx, cols)) {
    const k = working.findIndex(c => c.id === col.id);
    const n = Math.max(1, working.length);
    from = Math.round((k * 100) / n);
    to = Math.round(((k + 1) * 100) / n);
  }
  // Cấu hình riêng (nếu có) thắng mặc định
  if (Number.isFinite(Number(a.progressFrom)) && a.progressFrom !== '' && a.progressFrom != null) from = clamp(Number(a.progressFrom));
  if (Number.isFinite(Number(a.progressTo)) && a.progressTo !== '' && a.progressTo != null) to = clamp(Number(a.progressTo));
  if (to < from) to = from;
  return { id: col.id, name: col.name, index: idx, total: cols.length, from, to };
}

/** Bộ cột dành cho 1 dự án theo lĩnh vực (type) của nó; thiếu thì dùng bộ cột mặc định. */
export function columnsForProject(project: Pick<Project, 'type'>, bySector: Partial<Record<string, KanbanColumn[]>>): KanbanColumn[] {
  return bySector[project.type as string]?.length ? bySector[project.type as string]! : (bySector.construction?.length ? bySector.construction : getDefaultColumns());
}

export function computeProjectProgress(project: Project, tasks: Pick<Task, 'projectId' | 'status'>[], columns: KanbanColumn[]): ProjectProgress {
  const cols = columns.length ? columns : getDefaultColumns();
  const stage = stageRange(cols, getProjectColumnId(project, cols));
  const mine = tasks.filter(t => t.projectId === project.id);
  const done = mine.filter(t => t.status === 'completed').length;
  const total = mine.length;
  const completed = project.status === 'completed';
  const auto = completed ? 100 : Math.round(stage.from + (stage.to - stage.from) * (total ? done / total : 0));
  const manual = (project as any).progressManual;
  const hasManual = !completed && manual !== null && manual !== undefined && manual !== '' && Number.isFinite(Number(manual));
  return {
    value: hasManual ? Math.round(clamp(Number(manual))) : auto,
    auto,
    source: completed ? 'completed' : hasManual ? 'manual' : 'auto',
    stage, done, total,
  };
}

/**
 * Giai đoạn (cột kanban) mà dự án được TÍNH vào ở phễu / bộ lọc của Giám đốc: dự án đã "Hoàn thành" luôn vào cột cuối
 * (thẻ có thể còn nằm ở cột cũ vì cột không bật "chuyển cột khi hoàn thành"); còn lại theo vị trí thật của thẻ.
 */
export function stageIdOf(project: Pick<Project, 'status'> & { kanbanColumnId?: string }, columns: KanbanColumn[]): string {
  const cols = columns.length ? columns : getDefaultColumns();
  if (project.status === 'completed') return cols[cols.length - 1].id;
  return getProjectColumnId(project as Project, cols);
}

export interface PipelineStage { id: string; name: string; index: number; count: number; value: number; avgProgress: number; projectIds: string[] }

/** Phễu giai đoạn của 1 lĩnh vực: mỗi cột kanban → số dự án, tổng giá trị hợp đồng, tiến độ trung bình. Bỏ qua dự án đã hủy. */
export function buildPipeline(projects: Project[], tasks: Pick<Task, 'projectId' | 'status'>[], columns: KanbanColumn[], type: string): PipelineStage[] {
  const cols = columns.length ? columns : getDefaultColumns();
  const stages: PipelineStage[] = cols.map((c, index) => ({ id: c.id, name: c.name, index, count: 0, value: 0, avgProgress: 0, projectIds: [] }));
  const sums = new Map<string, number>();
  for (const p of projects) {
    if (p.status === 'cancelled' || (p.type || 'general') !== type) continue;
    const st = stages.find(s => s.id === stageIdOf(p, cols)) || stages[0];
    st.count++; st.value += Number(p.contractValue || 0); st.projectIds.push(p.id);
    sums.set(st.id, (sums.get(st.id) || 0) + computeProjectProgress(p, tasks, cols).value);
  }
  stages.forEach(s => { s.avgProgress = s.count ? Math.round((sums.get(s.id) || 0) / s.count) : 0; });
  return stages;
}
