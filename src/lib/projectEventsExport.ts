// XUẤT NHẬT KÝ DỰ ÁN RA EXCEL để lưu trữ — 3 trang tính:
//   1) "Thông tin dự án": toàn bộ thông tin hồ sơ dự án (khách hàng, người phụ trách, mốc thời gian, giá trị, hồ sơ…);
//   2) "Công việc & Nhiệm vụ": từng công việc và nhiệm vụ con (người phụ trách, hạn, trạng thái, tiến độ);
//   3) "Nhật ký hoạt động": mọi sự kiện đã ghi (thời gian, người làm, loại, đối tượng, nội dung, cũ → mới, chi tiết).
// Phần dựng dữ liệu (buildProjectLogSheets) tách riêng khỏi phần ghi file để kiểm thử được không cần trình duyệt.
import * as XLSX from 'xlsx';
import type { Project, Task, Customer, Employee } from '../types';
import { EVENT_TYPE_META, loadAllProjectEvents, type ProjectEventRow } from './projectEvents';

const PROJECT_STATUS: Record<string, string> = { new: 'Mới', processing: 'Đang thực hiện', paused: 'Tạm dừng', maintenance: 'Bảo trì', completed: 'Hoàn thành', cancelled: 'Đã hủy' };
const PROJECT_TYPE: Record<string, string> = { construction: 'Xây dựng', furniture: 'Nội thất', mechanical: 'Cơ khí', general: 'Chung' };
const TASK_STATUS: Record<string, string> = { todo: 'Chưa làm', doing: 'Đang làm', reviewing: 'Chờ duyệt', completed: 'Hoàn thành', overdue: 'Quá hạn' };
const MISSION_STATUS: Record<string, string> = { todo: 'Chưa làm', doing: 'Đang làm', completed: 'Hoàn thành' };
const PRIORITY: Record<string, string> = { high: 'Cao', medium: 'Trung bình', low: 'Thấp' };
const DOC_TYPE: Record<string, string> = { quotation: 'Báo giá', contract: 'Hợp đồng', acceptance: 'Nghiệm thu', liquidation: 'Thanh lý' };
const DOC_STATUS: Record<string, string> = { draft: 'Nháp', active: 'Đang hiệu lực', approved: 'Đã duyệt', archived: 'Lưu trữ', rejected: 'Từ chối' };
const OBJ_LABEL: Record<string, string> = { project: 'Dự án', task: 'Công việc', mission: 'Nhiệm vụ', proposal: 'Đề xuất', payment: 'Phiếu chi', material: 'Vật tư' };

const pad = (n: number) => String(n).padStart(2, '0');
const fmtDateTime = (iso?: string) => { if (!iso) return ''; const d = new Date(iso); return isNaN(d.getTime()) ? iso : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fmtDate = (iso?: string) => { if (!iso) return ''; const d = new Date(iso); return isNaN(d.getTime()) ? iso : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };

export interface ProjectLogExportCtx {
  project: Project;
  customer?: Customer | null;
  employees: Pick<Employee, 'id' | 'name'>[];
  tasks: Task[];
  events: ProjectEventRow[];
  /** Tên cột/giai đoạn Kanban hiện tại của dự án (nếu biết) */
  stageName?: string;
  exportedBy?: string;
  now?: Date;
}

/** Dựng nội dung 3 trang tính dưới dạng mảng-các-dòng (chưa ghi file) */
export function buildProjectLogSheets(c: ProjectLogExportCtx) {
  const emp = (id?: string) => (id ? c.employees.find(e => e.id === id)?.name || id : '');
  const p = c.project;
  const projectTasks = c.tasks.filter(t => t.projectId === p.id);
  const missionCount = projectTasks.reduce((n, t) => n + (t.missions?.length || 0), 0);

  const info: (string | number)[][] = [
    ['THÔNG TIN DỰ ÁN (lưu trữ)', ''],
    ['Mã dự án', p.code],
    ['Tên dự án', p.name],
    ['Loại dự án', PROJECT_TYPE[p.type] || p.type],
    ['Trạng thái', PROJECT_STATUS[p.status] || p.status],
    ['Giai đoạn (cột Kanban)', c.stageName || ''],
    ['Tiến độ (%)', p.progress ?? 0],
    ['Địa chỉ dự án', p.address || ''],
    ['Trưởng dự án', emp(p.pmId)],
    ['Ngày bắt đầu', fmtDate(p.startDate)],
    ['Ngày kết thúc', fmtDate(p.endDate)],
    ['Giá trị hợp đồng (đ)', p.contractValue ?? 0],
    ['Ghi chú', p.notes || ''],
    ['', ''],
    ['KHÁCH HÀNG', ''],
    ['Tên khách hàng', c.customer?.name || ''],
    ['Người đại diện', c.customer?.representative || ''],
    ['Số điện thoại', c.customer?.phone || ''],
    ['Email', c.customer?.email || ''],
    ['Địa chỉ khách hàng', c.customer?.address || ''],
    ['MST / CMND', c.customer?.taxOrIdNumber || ''],
    ['', ''],
    ['TỔNG HỢP', ''],
    ['Số công việc', projectTasks.length],
    ['Số nhiệm vụ', missionCount],
    ['Số sự kiện trong nhật ký', c.events.length],
    ['', ''],
    ['HỒ SƠ DỰ ÁN', ''],
    ...(p.documents?.length
      ? [['Loại', 'Mã', 'Tên', 'Trạng thái', 'Giá trị (đ)', 'Ngày tạo'] as (string | number)[], ...p.documents.map(d => [DOC_TYPE[d.type] || d.type, d.code, d.name, DOC_STATUS[d.status] || d.status, d.value ?? '', fmtDate(d.createdAt)] as (string | number)[])]
      : [['(chưa có hồ sơ)', '']] as (string | number)[][]),
    ['', ''],
    ['Xuất bởi', c.exportedBy || ''],
    ['Thời điểm xuất', fmtDateTime((c.now || new Date()).toISOString())],
  ];

  const taskRows: (string | number)[][] = [['Cấp', 'Mã', 'Tên', 'Thuộc công việc', 'Phụ trách', 'Người giao', 'Thành viên', 'Trạng thái', 'Tiến độ (%)', 'Ưu tiên', 'Hạn', 'Ngày tạo', 'Ngày hoàn thành']];
  projectTasks.forEach(t => {
    taskRows.push(['Công việc', t.code, t.name, '', emp(t.assigneeId), emp(t.assignerId), '', TASK_STATUS[t.status] || t.status, t.completionRate ?? 0, PRIORITY[t.priority] || '', fmtDate(t.deadline), '', '']);
    (t.missions || []).forEach(m => taskRows.push([
      'Nhiệm vụ', '', m.name, t.name, emp(m.mainAssigneeId), '', (m.memberIds || []).map(emp).join(', '),
      MISSION_STATUS[m.status] || m.status, m.status === 'completed' ? 100 : '', '', fmtDate(m.deadline || t.deadline), fmtDate(m.createdAt), fmtDate(m.completedAt),
    ]));
  });

  const logRows: (string | number)[][] = [['Thời gian', 'Ngày', 'Người làm', 'Loại', 'Đối tượng', 'Tên đối tượng', 'Nội dung', 'Giá trị cũ', 'Giá trị mới', 'Chi tiết']];
  // Theo thứ tự thời gian tăng dần (cũ → mới) cho dễ đọc như sổ nhật ký
  [...c.events].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).forEach(e => logRows.push([
    fmtDateTime(e.createdAt), fmtDate(e.createdAt), e.actorName || '', EVENT_TYPE_META[e.type]?.label || e.type,
    OBJ_LABEL[e.objKind || ''] || '', e.objName || '', e.text, e.from || '', e.to || '', e.detail || '',
  ]));

  return { info, taskRows, logRows };
}

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '_').trim().slice(0, 60) || 'DuAn';

/** Tải toàn bộ nhật ký của dự án rồi ghi file Excel. Trả về tên file; ném lỗi nếu tải nhật ký thất bại hoàn toàn. */
export async function exportProjectLogExcel(ctx: Omit<ProjectLogExportCtx, 'events'> & { events?: ProjectEventRow[] }): Promise<string> {
  let events = ctx.events;
  if (!events) {
    const r = await loadAllProjectEvents(ctx.project.id);
    if (!r.ok) throw new Error(r.notEnabled ? 'Nhật ký chưa được bật (chưa chạy migration 20261027_project_events.sql).' : (r.message || 'Không tải được nhật ký.'));
    events = r.rows;
  }
  const { info, taskRows, logRows } = buildProjectLogSheets({ ...ctx, events });
  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: (string | number)[][], widths: number[]) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = widths.map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add('Thông tin dự án', info, [28, 50, 30, 18, 16, 16]);
  add('Công việc & Nhiệm vụ', taskRows, [11, 14, 36, 30, 18, 18, 30, 14, 11, 11, 12, 12, 14]);
  add('Nhật ký hoạt động', logRows, [17, 11, 18, 14, 12, 30, 60, 18, 18, 50]);
  const d = ctx.now || new Date();
  const file = `NhatKy_${safeName(ctx.project.code || ctx.project.name)}_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.xlsx`;
  XLSX.writeFile(wb, file);
  return file;
}
