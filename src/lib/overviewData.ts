// TÍNH TOÁN THUẦN cho màn Tổng quan kiểu mới (điểm danh gọn + dải tuần + các khối tổng hợp).
// Không đụng mạng / CSDL / giao diện: nhận dữ liệu đã có sẵn trong màn Tổng quan và trả về số liệu để hiển thị — dễ kiểm thử.
// Quy tắc điểm danh (khung giờ mở / đóng nút) giữ NGUYÊN như các hàng ca cũ trong DashboardOverview.

// ───────────── Điểm danh: trạng thái nút của từng ca ─────────────
export type ShiftKey = 'morning' | 'afternoon' | 'overtime';
export type ShiftState = 'ready' | 'working' | 'waiting' | 'closed' | 'done';

export interface ShiftInput {
  key: ShiftKey;
  inSlot: string; outSlot: string;            // tên ô chấm: timeInS / timeOutS …
  inTime?: string; outTime?: string;           // giờ đã chấm (rỗng = chưa)
  inActive: boolean; outActive: boolean;       // khung giờ đang mở (isSlotActive) cho lượt vào / ra
  currMin: number;                              // phút hiện tại trong ngày
  inStartMin: number; inStartStr: string; inEndStr: string;       // khung mở nút VÀO
  outStartMin: number; outStartStr: string; outEndStr: string;    // khung mở nút RA
}
export interface ShiftView {
  key: ShiftKey; state: ShiftState;
  /** Ô cần chấm khi bấm (rỗng = chưa bấm được) */
  action: string;
  label: string;        // vd. "Vào ca sáng"
  sub: string;          // vd. "Mở lúc 07:15"
  inTime?: string; outTime?: string;
}

const SHIFT_NAME: Record<ShiftKey, string> = { morning: 'ca sáng', afternoon: 'ca chiều', overtime: 'tăng ca' };
export const shiftTitle = (k: ShiftKey) => ({ morning: 'Ca sáng', afternoon: 'Ca chiều', overtime: 'Tăng ca' }[k]);

/** Giờ chấm hợp lệ? (loại '--:--' và rỗng) */
export const hasTime = (v?: string | null): boolean => !!v && v !== '--:--';

/** Trạng thái nút của 1 ca — cùng quy tắc với các hàng ca cũ: chưa vào → VÀO; đã vào chưa ra → RA; đủ cả hai → đã chốt. */
export function computeShiftView(p: ShiftInput): ShiftView {
  const inDone = hasTime(p.inTime), outDone = hasTime(p.outTime);
  const name = SHIFT_NAME[p.key];
  if (!inDone) {
    const label = p.key === 'overtime' ? 'Vào tăng ca' : `Vào ${name}`;
    if (p.inActive || p.outActive) return { key: p.key, state: 'ready', action: p.inSlot, label, sub: 'Trong khung giờ' };
    if (p.currMin < p.inStartMin) return { key: p.key, state: 'waiting', action: '', label, sub: `Mở lúc ${p.inStartStr}` };
    return { key: p.key, state: 'closed', action: '', label, sub: `Hết giờ vào ca (${p.inEndStr})` };
  }
  if (!outDone) {
    const label = p.key === 'overtime' ? 'Kết thúc tăng ca' : `Ra ${name}`;
    if (p.outActive) return { key: p.key, state: 'working', action: p.outSlot, label, sub: 'Trong khung giờ', inTime: p.inTime };
    if (p.currMin < p.outStartMin) return { key: p.key, state: 'working', action: '', label, sub: `Ra ca mở lúc ${p.outStartStr}`, inTime: p.inTime };
    return { key: p.key, state: 'closed', action: '', label, sub: `Hết giờ ra ca (${p.outEndStr})`, inTime: p.inTime };
  }
  return { key: p.key, state: 'done', action: '', label: `${shiftTitle(p.key)} đã chốt`, sub: `${p.inTime} → ${p.outTime}`, inTime: p.inTime, outTime: p.outTime };
}

/**
 * Chọn ca hiện ở thẻ điểm danh gọn:
 *  1) ca đang bấm được (vào / ra) — sáng, chiều rồi tăng ca; 2) ca đã vào, chờ tới giờ ra; 3) ca sắp mở gần nhất; 4) ca lỡ giờ (hết hạn chấm) gần nhất; 5) null = đã xong cả ngày.
 * Tăng ca chỉ lên thẻ khi đang bấm được hoặc đã vào ca tăng ca (không nhắc tăng ca với người không làm).
 */
export function pickFocusShift(views: ShiftView[]): ShiftView | null {
  const order: ShiftKey[] = ['morning', 'afternoon', 'overtime'];
  const sorted = order.map(k => views.find(v => v.key === k)).filter(Boolean) as ShiftView[];
  const actionable = sorted.find(v => (v.state === 'ready' || (v.state === 'working' && !!v.action)));
  if (actionable) return actionable;
  const regular = sorted.filter(v => v.key !== 'overtime');
  const working = sorted.find(v => v.state === 'working');   // đã vào ca, chưa tới giờ ra → hiện "Đang làm việc" (trước cả ca sắp mở)
  if (working) return working;
  const waiting = regular.find(v => v.state === 'waiting');
  if (waiting) return waiting;
  const closed = [...regular].reverse().find(v => v.state === 'closed');
  return closed || null;
}

// ───────────── Dải tuần ─────────────
export type DayKind = 'ok' | 'late' | 'leave' | 'absent' | 'rest' | 'today' | 'future';
export interface WeekDay { date: string; label: string; day: number; kind: DayKind; note: string }

const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

/** 7 ngày của tuần chứa `today`, bắt đầu từ thứ Hai */
export function weekDates(today: string): string[] {
  const d = parse(today);
  const dow = (d.getDay() + 6) % 7;                       // 0 = thứ Hai
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow + i); return ymd(x); });
}
const DOW = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export interface DayFacts { hasPunch: boolean; lates: number; isRest: boolean; onLeave: boolean }
/** Trạng thái 1 ô trong dải tuần */
export function buildWeek(today: string, factsOf: (date: string) => DayFacts): WeekDay[] {
  return weekDates(today).map((date, i) => {
    const f = factsOf(date);
    const day = Number(date.slice(8, 10));
    const base = { date, label: DOW[i], day };
    if (date === today) return { ...base, kind: 'today' as DayKind, note: 'nay' };
    if (date > today) return { ...base, kind: f.isRest ? 'rest' as DayKind : 'future' as DayKind, note: f.isRest ? 'nghỉ' : '' };
    if (f.onLeave) return { ...base, kind: 'leave' as DayKind, note: 'phép' };
    if (f.isRest && !f.hasPunch) return { ...base, kind: 'rest' as DayKind, note: 'nghỉ' };
    if (f.hasPunch) return f.lates > 0 ? { ...base, kind: 'late' as DayKind, note: 'muộn' } : { ...base, kind: 'ok' as DayKind, note: '✓' };
    return { ...base, kind: 'absent' as DayKind, note: 'vắng' };
  });
}
export const weekCounts = (w: WeekDay[]) => ({ ok: w.filter(d => d.kind === 'ok').length, late: w.filter(d => d.kind === 'late').length, absent: w.filter(d => d.kind === 'absent').length });

/** Số ngày công chuẩn của tháng (bỏ ngày nghỉ/lễ) — mẫu số của "Công tháng 17 / 22" */
export function standardWorkdays(ym: string, isRest: (date: string) => boolean): number {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  let n = 0;
  for (let d = 1; d <= last; d++) if (!isRest(`${ym}-${pad(d)}`)) n++;
  return n;
}

// ───────────── Công việc ─────────────
export interface TaskLike { id: string; name: string; code?: string; status: string; deadline: string; assigneeId?: string; projectId?: string; missions?: { mainAssigneeId?: string; memberIds?: string[] }[] }
export const isMyTask = (t: TaskLike, userId: string) =>
  t.assigneeId === userId || !!t.missions?.some(m => m.mainAssigneeId === userId || (m.memberIds || []).includes(userId));

export interface TaskSummary { dueToday: TaskLike[]; overdue: TaskLike[]; monthTotal: number; monthDone: number; rate: number | null }
/** Việc của tôi: đến hạn hôm nay, quá hạn, và tỷ lệ hoàn thành trong số việc có hạn rơi vào tháng này */
export function summarizeTasks(tasks: TaskLike[], userId: string, today: string): TaskSummary {
  const ym = today.slice(0, 7);
  const mine = tasks.filter(t => isMyTask(t, userId));
  const open = mine.filter(t => t.status !== 'completed');
  const dueToday = open.filter(t => t.deadline === today);
  const overdue = open.filter(t => t.status === 'overdue' || (t.deadline && t.deadline < today));
  const inMonth = mine.filter(t => (t.deadline || '').startsWith(ym));
  const done = inMonth.filter(t => t.status === 'completed').length;
  return { dueToday, overdue, monthTotal: inMonth.length, monthDone: done, rate: inMonth.length ? Math.round((done / inMonth.length) * 100) : null };
}

// ───────────── Hiệu suất (vi phạm trong Bảng Hiệu suất) ─────────────
export interface ErrorLike { employeeId?: string; date?: string; criterionContent?: string }
export function summarizeViolations(list: ErrorLike[], empId: string, today: string): { count: number; last?: string } {
  const ym = today.slice(0, 7);
  const mine = (list || []).filter(e => e.employeeId === empId && (e.date || '').startsWith(ym)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return { count: mine.length, last: mine[0]?.criterionContent };
}

// ───────────── Đơn nghỉ phép ─────────────
export interface LeaveLike { id: string; empId?: string; empName?: string; type: string; fromDate: string; toDate: string; daysCount?: number; status: string; approverName?: string; createdAt?: string; submittedAt?: string; isAttendanceCorrection?: boolean }
export interface LeaveSummary { pending: LeaveLike[]; recent: LeaveLike[] }
/** Đơn nghỉ phép CỦA TÔI: các đơn đang chờ + đơn gần nhất đã có kết quả trong 45 ngày. `isReal` lọc bỏ đơn giải trình chấm công. */
export function summarizeLeaves(list: LeaveLike[], me: { id: string; name: string }, today: string, isReal: (type: string) => boolean): LeaveSummary {
  const mine = (list || []).filter(l => (l.empId ? l.empId === me.id : l.empName === me.name) && !l.isAttendanceCorrection && isReal(l.type));
  const stamp = (l: LeaveLike) => String(l.submittedAt || l.createdAt || l.fromDate || '');
  const sorted = [...mine].sort((a, b) => stamp(b).localeCompare(stamp(a)));
  const pending = sorted.filter(l => l.status === 'pending');
  const cutoff = ymd(new Date(parse(today).getTime() - 45 * 86400000));
  const recent = sorted.filter(l => l.status !== 'pending' && (l.toDate || l.fromDate) >= cutoff).slice(0, 1);
  return { pending, recent };
}
/** dd/MM */
export const fmtDM = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : String(s || ''));
export const fmtLeaveRange = (l: { fromDate: string; toDate: string }) => (l.toDate && l.toDate !== l.fromDate ? `${fmtDM(l.fromDate)} – ${fmtDM(l.toDate)}` : fmtDM(l.fromDate));

// ───────────── Công tác phí ─────────────
export interface CtpLike { status?: string; amount?: number; code?: string; id?: string; content?: string; missionName?: string; date?: string; createdAt?: string }
export interface CtpSummary { pendingCount: number; pendingSum: number; approvedCount: number; approvedSum: number; rejectedCount: number; latest: CtpLike[] }
/** Công tác phí của tôi: chờ duyệt (mọi thời gian), đã duyệt và từ chối trong THÁNG này nếu khoản có ngày (không có ngày thì tính). */
export function summarizeCtp(list: CtpLike[], today: string): CtpSummary {
  const ym = today.slice(0, 7);
  const inMonth = (c: CtpLike) => { const d = String(c.date || c.createdAt || ''); return !d || d.startsWith(ym) || /^\d{2}\/\d{2}\/\d{4}$/.test(d) && d.slice(6) + '-' + d.slice(3, 5) === ym; };
  const sum = (a: CtpLike[]) => a.reduce((s, c) => s + Number(c.amount || 0), 0);
  const pending = list.filter(c => c.status === 'pending');
  const approved = list.filter(c => (c.status === 'approved' || c.status === 'completed') && inMonth(c));
  const rejected = list.filter(c => c.status === 'rejected' && inMonth(c));
  const rank = (c: CtpLike) => (c.status === 'pending' ? 0 : 1);
  const latest = [...list].sort((a, b) => rank(a) - rank(b)).slice(0, 2);
  return { pendingCount: pending.length, pendingSum: sum(pending), approvedCount: approved.length, approvedSum: sum(approved), rejectedCount: rejected.length, latest };
}

/** 1.200.000 → "1,2tr"; 450.000 → "450k"; nhỏ hơn → số đầy đủ */
export function fmtMoneyShort(n: number): string {
  const v = Math.round(Number(n) || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 2).replace(/\.?0+$/, '').replace('.', ',')}tr`;
  if (v >= 1000) return `${Math.round(v / 1000)}k`;
  return String(v);
}
export const fmtMoney = (n: number) => `${Math.round(Number(n) || 0).toLocaleString('vi-VN')}đ`;

// ───────────── Tạm ứng lương ─────────────
export interface AdvanceLike { creator?: string; projectName?: string; amount?: number; status?: string; date?: string; proposalDate?: string }
export interface AdvanceSummary { pendingCount: number; pendingSum: number; approvedCount: number; approvedSum: number; lastDate?: string }
/** Đề xuất tạm ứng lương của tôi trong tháng này (projectName 'Ứng Lương Nhân Sự' là dấu hiệu đề xuất ứng lương) */
export function summarizeAdvances(list: AdvanceLike[], empId: string, today: string): AdvanceSummary {
  const ym = today.slice(0, 7);
  const mine = (list || []).filter(a => a.creator === empId && a.projectName === 'Ứng Lương Nhân Sự' && String(a.date || a.proposalDate || '').startsWith(ym));
  const pending = mine.filter(a => a.status === 'pending_approval' || a.status === 'pending');
  const approved = mine.filter(a => a.status === 'approved' || a.status === 'paid' || a.status === 'completed');
  const sum = (a: AdvanceLike[]) => a.reduce((s, x) => s + Number(x.amount || 0), 0);
  const last = [...mine].sort((a, b) => String(b.date || b.proposalDate).localeCompare(String(a.date || a.proposalDate)))[0];
  return { pendingCount: pending.length, pendingSum: sum(pending), approvedCount: approved.length, approvedSum: sum(approved), lastDate: last ? String(last.date || last.proposalDate) : undefined };
}

// ───────────── Dự án của tôi ─────────────
export interface ProjectLike { id: string; name: string; pmId?: string; progress?: number; status?: string; involvedEmployeeIds?: string[] }
/** Dự án tôi tham gia (là trưởng dự án, có tên trong dự án, hoặc có việc ở đó), chưa hoàn thành, tối đa `limit` */
export function myProjects(projects: ProjectLike[], tasks: TaskLike[], userId: string, limit = 3): ProjectLike[] {
  const taskProjects = new Set(tasks.filter(t => isMyTask(t, userId) && t.projectId).map(t => t.projectId as string));
  return projects
    .filter(p => p.pmId === userId || (p.involvedEmployeeIds || []).includes(userId) || taskProjects.has(p.id))
    .filter(p => p.status !== 'completed' && p.status !== 'cancelled')
    .slice(0, limit);
}

// ───────────── Toàn công ty hôm nay (Giám đốc) ─────────────
export interface CompanyToday { total: number; present: number; late: number; onLeave: number; absent: number; missing: string[] }
export function summarizeCompanyToday(args: {
  employees: { id: string; name: string; status?: string; hasSystemAccount?: boolean }[];
  logs: { empId?: string; date?: string }[];
  today: string;
  latesOf: (log: any) => number;
  onLeaveIds: Set<string>;
  isRestDay: boolean;
}): CompanyToday {
  const staff = args.employees.filter(e => e.status !== 'retired' && e.status !== 'leave' && e.hasSystemAccount !== false);
  const todays = args.logs.filter(l => l.date === args.today);
  const byEmp = new Map<string, any>(todays.map(l => [String(l.empId), l]));
  const onLeave = staff.filter(e => args.onLeaveIds.has(e.id));
  const active = staff.filter(e => !args.onLeaveIds.has(e.id));
  const present = active.filter(e => byEmp.has(e.id));
  const late = present.filter(e => args.latesOf(byEmp.get(e.id)) > 0);
  const missing = args.isRestDay ? [] : active.filter(e => !byEmp.has(e.id)).map(e => e.name);
  return { total: staff.length, present: present.length, late: late.length, onLeave: onLeave.length, absent: missing.length, missing };
}
