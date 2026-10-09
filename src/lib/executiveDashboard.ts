// ─── Tính toán số liệu cho "Bảng điều hành Giám đốc" (Dashboard Tổng Hợp) ─────────────────────────────────────
// Toàn bộ là HÀM THUẦN (không đọc DB, không dùng React) để dễ kiểm thử: màn hình chỉ việc truyền dữ liệu đã tải vào đây.
// Quy ước ngày: mọi so sánh ngày dùng chuỗi 'YYYY-MM-DD' theo GIỜ ĐỊA PHƯƠNG (tránh lệch múi giờ khi chuỗi ISO có 'T…Z').
import type { Project, Task, Receipt, Payment, Employee } from '../types';

/** Chuyển nhiều dạng ngày (YYYY-MM-DD, ISO, dd/mm/yyyy) về 'YYYY-MM-DD' theo giờ địa phương; không hiểu được → ''. */
export function toDay(value?: string | null): string {
  if (!value) return '';
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const vn = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); // 7/9/2026 hoặc 07/09/2026 …
  if (vn) return `${vn[3]}-${vn[2].padStart(2, '0')}-${vn[1].padStart(2, '0')}`;
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Hôm nay ('YYYY-MM-DD', giờ địa phương). */
export function todayYmd(now: Date = new Date()): string {
  return toDay(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
}

/** Cộng/trừ ngày trên chuỗi 'YYYY-MM-DD'. */
export function addDays(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return toDay(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`);
}

/** Số ngày từ a đến b (b - a), cả hai dạng 'YYYY-MM-DD'. */
export function diffDays(a: string, b: string): number {
  const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
  return Math.round((new Date(pb[0], pb[1] - 1, pb[2]).getTime() - new Date(pa[0], pa[1] - 1, pa[2]).getTime()) / 86400000);
}

// ─── 1. PHÒNG DỰ ÁN: việc hôm nay / quá hạn / chưa làm ──────────────────────────────────────────────
export interface TaskBuckets {
  /** Đang làm (status = doing) */
  doing: Task[];
  /** Có hạn hoàn thành đúng hôm nay (chưa xong) */
  dueToday: Task[];
  /** Quá hạn: chưa xong và hạn < hôm nay — kèm số ngày trễ, trễ nhiều nhất lên đầu */
  overdue: (Task & { daysLate: number })[];
  /** Chưa làm (status = todo) */
  todo: Task[];
  /** Đang chờ duyệt kết quả */
  reviewing: Task[];
  completedToday: number;
}

export function bucketTasks(tasks: Task[], today: string): TaskBuckets {
  const open = tasks.filter(t => t.status !== 'completed');
  const overdue = open
    .map(t => ({ t, d: toDay(t.deadline) }))
    // status 'overdue' do hệ thống đánh dấu cũng tính là quá hạn dù thiếu/ sai ngày hạn
    .filter(x => (x.d && x.d < today) || x.t.status === 'overdue')
    .map(x => ({ ...x.t, daysLate: x.d ? Math.max(1, diffDays(x.d, today)) : 1 }))
    .sort((a, b) => b.daysLate - a.daysLate);
  const overdueIds = new Set(overdue.map(t => t.id));
  return {
    doing: open.filter(t => t.status === 'doing'),
    dueToday: open.filter(t => toDay(t.deadline) === today && !overdueIds.has(t.id)),
    overdue,
    todo: open.filter(t => t.status === 'todo' && !overdueIds.has(t.id)),
    reviewing: open.filter(t => t.status === 'reviewing'),
    completedToday: tasks.filter(t => t.status === 'completed' && toDay((t as any).completedAt || (t as any).updatedAt) === today).length,
  };
}

// ─── 2. TÀI CHÍNH THEO CÔNG TRÌNH ─────────────────────────────────────────────────────────────────
export interface ProjectFinanceRow {
  project: Project;
  contractValue: number;
  collected: number;
  /** Đã chi = phiếu chi ĐÃ DUYỆT gắn công trình (không tính nạp quỹ tiền mặt) */
  spent: number;
  /** Phiếu chi còn chờ duyệt của công trình */
  pendingSpent: number;
  /** Chi / giá trị hợp đồng (%), 0 nếu chưa có giá trị hợp đồng */
  spentPct: number;
  /** Đã thu / giá trị hợp đồng (%) */
  collectedPct: number;
  /** Lãi gộp tạm tính = đã thu − đã chi (theo dòng tiền thực) */
  cashMargin: number;
  /** Lãi gộp dự kiến = giá trị hợp đồng − đã chi (nếu thu đủ) */
  expectedMargin: number;
  /** Còn phải thu = hợp đồng − đã thu (không âm) */
  receivable: number;
  flags: ('loss' | 'overBudget' | 'nearBudget' | 'late' | 'noContract')[];
}

/** Phiếu chi NẠP quỹ (không phải chi phí công trình) — loại khỏi tổng chi. */
const isCashFundDeposit = (p: Payment) => (p.category as string) === 'cash_fund';

export function buildProjectFinance(projects: Project[], receipts: Receipt[], payments: Payment[], today: string): ProjectFinanceRow[] {
  return projects
    .filter(p => p.status !== 'cancelled')
    .map(p => {
      const contractValue = p.contractValue || 0;
      const collected = receipts.filter(r => r.projectId === p.id).reduce((s, r) => s + (r.amount || 0), 0);
      const mine = payments.filter(x => x.projectId === p.id && !isCashFundDeposit(x));
      const spent = mine.filter(x => x.status === 'approved').reduce((s, x) => s + (x.amount || 0), 0);
      const pendingSpent = mine.filter(x => x.status === 'pending').reduce((s, x) => s + (x.amount || 0), 0);
      const spentPct = contractValue > 0 ? Math.round((spent / contractValue) * 100) : 0;
      const collectedPct = contractValue > 0 ? Math.round((collected / contractValue) * 100) : 0;
      const flags: ProjectFinanceRow['flags'] = [];
      if (contractValue <= 0 && (spent > 0 || collected > 0)) flags.push('noContract');
      if (spent > collected && collected > 0 && spent - collected > 0) flags.push('loss');
      if (contractValue > 0 && spent > contractValue) flags.push('overBudget');
      else if (contractValue > 0 && spentPct >= 80) flags.push('nearBudget');
      const end = toDay(p.endDate);
      if (end && end < today && p.status !== 'completed') flags.push('late');
      return {
        project: p, contractValue, collected, spent, pendingSpent, spentPct, collectedPct,
        cashMargin: collected - spent,
        expectedMargin: contractValue - spent,
        receivable: Math.max(0, contractValue - collected),
        flags,
      };
    })
    .sort((a, b) => b.spent - a.spent);
}

export interface FinanceTotals { contractValue: number; collected: number; spent: number; pendingSpent: number; receivable: number; cashMargin: number; collectedPct: number; spentPct: number }
export function sumFinance(rows: ProjectFinanceRow[]): FinanceTotals {
  const t = rows.reduce((a, r) => ({
    contractValue: a.contractValue + r.contractValue, collected: a.collected + r.collected, spent: a.spent + r.spent,
    pendingSpent: a.pendingSpent + r.pendingSpent, receivable: a.receivable + r.receivable,
  }), { contractValue: 0, collected: 0, spent: 0, pendingSpent: 0, receivable: 0 });
  return {
    ...t,
    cashMargin: t.collected - t.spent,
    collectedPct: t.contractValue > 0 ? Math.round((t.collected / t.contractValue) * 100) : 0,
    spentPct: t.contractValue > 0 ? Math.round((t.spent / t.contractValue) * 100) : 0,
  };
}

// ─── 3. DÒNG TIỀN & CƠ CẤU CHI ────────────────────────────────────────────────────────────────────
export interface DayFlow { day: string; income: number; expense: number }
/** Thu / chi từng ngày trong `days` ngày gần nhất (kết thúc ở hôm nay). Chi chỉ tính phiếu ĐÃ DUYỆT, không tính nạp quỹ. */
export function cashflowByDay(receipts: Receipt[], payments: Payment[], today: string, days = 14): DayFlow[] {
  const out: DayFlow[] = [];
  for (let i = days - 1; i >= 0; i--) out.push({ day: addDays(today, -i), income: 0, expense: 0 });
  const idx = new Map(out.map((d, i) => [d.day, i]));
  for (const r of receipts) { const k = idx.get(toDay(r.receiptAt || r.date)); if (k !== undefined) out[k].income += r.amount || 0; }
  for (const p of payments) {
    if (p.status !== 'approved' || isCashFundDeposit(p)) continue;
    const k = idx.get(toDay(p.paymentAt || p.date)); if (k !== undefined) out[k].expense += p.amount || 0;
  }
  return out;
}

export const CATEGORY_LABELS: Record<string, string> = {
  material: 'Vật tư', labor: 'Nhân công', shipping: 'Vận chuyển', machinery: 'Máy móc / thiết bị', general: 'Quản lý chung',
  subcontractor_advance: 'Tạm ứng thầu phụ', site_expense: 'Chi phí công trường', other: 'Khác',
};
/** Cơ cấu chi (phiếu đã duyệt) theo hạng mục, lớn → nhỏ. */
export function spendByCategory(payments: Payment[]): { key: string; label: string; amount: number; pct: number }[] {
  const m = new Map<string, number>();
  for (const p of payments) {
    if (p.status !== 'approved' || isCashFundDeposit(p)) continue;
    m.set(p.category || 'other', (m.get(p.category || 'other') || 0) + (p.amount || 0));
  }
  const total = [...m.values()].reduce((a, b) => a + b, 0);
  return [...m.entries()].map(([key, amount]) => ({ key, label: CATEGORY_LABELS[key] || 'Khác', amount, pct: total ? Math.round((amount / total) * 100) : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

// ─── 4. KẾ TOÁN HÔM NAY ───────────────────────────────────────────────────────────────────────────
export function paymentsOfDay(payments: Payment[], day: string): Payment[] {
  return payments.filter(p => !isCashFundDeposit(p) && p.status !== 'rejected' && toDay(p.paymentAt || p.date) === day);
}
export function receiptsOfDay(receipts: Receipt[], day: string): Receipt[] {
  return receipts.filter(r => toDay(r.receiptAt || r.date) === day);
}

// ─── 5. VẬT TƯ: số đơn theo ngày ───────────────────────────────────────────────────────────────────
export interface DayOrders { day: string; orders: number; proposals: number }
/** Số ĐƠN MUA HÀNG (đã xác nhận trở lên, không tính nháp/hủy) và số ĐỀ XUẤT vật tư tạo mỗi ngày. */
export function materialByDay(orders: any[], proposals: any[], today: string, days = 14): DayOrders[] {
  const out: DayOrders[] = [];
  for (let i = days - 1; i >= 0; i--) out.push({ day: addDays(today, -i), orders: 0, proposals: 0 });
  const idx = new Map(out.map((d, i) => [d.day, i]));
  for (const o of orders || []) {
    if (o.status === 'draft' || o.status === 'cancelled') continue;
    const k = idx.get(toDay(o.createdAt)); if (k !== undefined) out[k].orders += 1;
  }
  for (const p of proposals || []) {
    if (p.status === 'cancelled') continue;
    const k = idx.get(toDay(p.createdAt)); if (k !== undefined) out[k].proposals += 1;
  }
  return out;
}

export const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  find_supplier: 'Tìm nhà cung cấp', waiting_approval: 'Chờ duyệt', waiting_order: 'Chờ đặt hàng', ordered: 'Đã đặt hàng', received: 'Đã nhận hàng',
};
export function proposalStatusCounts(proposals: any[]): { key: string; label: string; count: number }[] {
  const order = ['find_supplier', 'waiting_approval', 'waiting_order', 'ordered', 'received'];
  return order.map(key => ({ key, label: PROPOSAL_STATUS_LABELS[key], count: (proposals || []).filter(p => p.status === key).length }));
}
/** Công nợ phải trả nhà cung cấp = tổng công nợ các đơn đã xác nhận / hoàn thành (không tính nháp, hủy, đơn lấy từ kho). */
export function supplierPayable(orders: any[]): number {
  return (orders || [])
    .filter(o => (o.status === 'confirmed' || o.status === 'completed') && !o.fromWarehouse)
    .reduce((s, o) => s + Math.max(0, o.congNo || 0), 0);
}

// ─── 6. NHÂN SỰ HÔM NAY ───────────────────────────────────────────────────────────────────────────
export interface AttendanceToday {
  /** Quân số cần chấm công (đang làm việc, không tính nghỉ việc / nghỉ dài hạn / ban giám đốc) */
  expected: number;
  present: number;
  onLeave: number;
  notChecked: number;
  presentRate: number;
  notCheckedNames: string[];
  onLeaveNames: string[];
  pendingLeaves: number;
}
export type TodayState = 'present' | 'leave' | 'missing';
/** Trạng thái hôm nay của TỪNG nhân sự cần chấm công: đã chấm công / nghỉ có phép / chưa chấm công (cùng quy tắc với summarizeAttendance). */
export function employeeTodayStates(employees: Employee[], logs: any[], leaves: any[], today: string): Map<string, TodayState> {
  const out = new Map<string, TodayState>();
  const presentIds = new Set((logs || [])
    .filter(l => toDay(l.date) === today && l.status !== 'missing' && l.status !== 'unexcused' && l.status !== 'leave').map(l => l.empId));
  const leaveIds = new Set<string>();
  for (const l of leaves || []) {
    if (l.status !== 'approved') continue;
    const from = toDay(l.fromDate), to = toDay(l.toDate || l.fromDate);
    if (from && from <= today && today <= (to || from)) leaveIds.add(l.empId);
  }
  for (const e of employees) out.set(e.id, presentIds.has(e.id) ? 'present' : leaveIds.has(e.id) ? 'leave' : 'missing');
  return out;
}
/** Số NGÀY công đã chấm của từng nhân sự trong khoảng bản ghi truyền vào (mỗi ngày tính 1, bỏ ngày vắng/không phép/nghỉ). */
export function workedDaysByEmployee(logs: any[]): Map<string, number> {
  const days = new Map<string, Set<string>>();
  for (const l of logs || []) {
    if (l.status === 'missing' || l.status === 'unexcused' || l.status === 'leave') continue;
    const d = toDay(l.date); if (!d || !l.empId) continue;
    if (!days.has(l.empId)) days.set(l.empId, new Set());
    days.get(l.empId)!.add(d);
  }
  return new Map([...days.entries()].map(([k, v]) => [k, v.size] as const));
}

export function summarizeAttendance(employees: Employee[], logs: any[], leaves: any[], today: string): AttendanceToday {
  const staff = employees.filter(e => (!e.status || e.status === 'working'));
  const staffIds = new Set(staff.map(e => e.id));
  // Có mặt = đã có bản ghi chấm công hôm nay và không phải trạng thái vắng/không phép (cùng quy tắc với màn Nhân sự)
  const presentIds = new Set(
    (logs || [])
      .filter(l => toDay(l.date) === today && l.status !== 'missing' && l.status !== 'unexcused' && l.status !== 'leave')
      .map(l => l.empId).filter(id => staffIds.has(id))
  );
  const leaveIds = new Set<string>();
  for (const l of leaves || []) {
    if (l.status !== 'approved') continue;
    const from = toDay(l.fromDate), to = toDay(l.toDate || l.fromDate);
    if (from && from <= today && today <= (to || from) && staffIds.has(l.empId) && !presentIds.has(l.empId)) leaveIds.add(l.empId);
  }
  const notChecked = staff.filter(e => !presentIds.has(e.id) && !leaveIds.has(e.id));
  return {
    expected: staff.length,
    present: presentIds.size,
    onLeave: leaveIds.size,
    notChecked: notChecked.length,
    presentRate: staff.length ? Math.round((presentIds.size / staff.length) * 100) : 0,
    notCheckedNames: notChecked.map(e => e.name),
    onLeaveNames: staff.filter(e => leaveIds.has(e.id)).map(e => e.name),
    pendingLeaves: (leaves || []).filter(l => l.status === 'pending').length,
  };
}

// ─── 7. CẢNH BÁO CHO GIÁM ĐỐC ─────────────────────────────────────────────────────────────────────
export interface DirectorAlert { level: 'danger' | 'warn' | 'info'; text: string; target?: string }
export function buildAlerts(input: { rows: ProjectFinanceRow[]; buckets: TaskBuckets; attendance: AttendanceToday; pendingPayments: number; pendingPaymentAmount: number; hour: number }): DirectorAlert[] {
  const a: DirectorAlert[] = [];
  const { rows, buckets, attendance } = input;
  for (const r of rows) {
    if (r.flags.includes('overBudget')) a.push({ level: 'danger', text: `${r.project.name}: đã chi ${r.spentPct}% — VƯỢT giá trị hợp đồng`, target: r.project.id });
    else if (r.flags.includes('loss')) a.push({ level: 'danger', text: `${r.project.name}: chi nhiều hơn thu (đang lỗ dòng tiền)`, target: r.project.id });
    else if (r.flags.includes('nearBudget')) a.push({ level: 'warn', text: `${r.project.name}: đã chi ${r.spentPct}% giá trị hợp đồng`, target: r.project.id });
    if (r.flags.includes('late')) a.push({ level: 'warn', text: `${r.project.name}: quá ngày kết thúc dự kiến mà chưa hoàn thành`, target: r.project.id });
  }
  if (buckets.overdue.length) a.push({ level: 'danger', text: `${buckets.overdue.length} công việc quá hạn (trễ nhiều nhất ${buckets.overdue[0].daysLate} ngày)` });
  if (input.pendingPayments > 0) a.push({ level: 'warn', text: `${input.pendingPayments} phiếu chi chờ duyệt` });
  // Sau 9h sáng mà còn người chưa chấm công thì mới đáng cảnh báo
  if (input.hour >= 9 && attendance.notChecked > 0) a.push({ level: 'warn', text: `${attendance.notChecked} nhân sự chưa chấm công hôm nay` });
  if (attendance.pendingLeaves > 0) a.push({ level: 'info', text: `${attendance.pendingLeaves} đơn nghỉ / tạm ứng lương chờ duyệt` });
  const order = { danger: 0, warn: 1, info: 2 } as const;
  return a.sort((x, y) => order[x.level] - order[y.level]);
}
