// Khối giao diện Tổng quan kiểu mới: các trạng thái của thẻ điểm danh và các khối tổng hợp (nhận dữ liệu đã tính sẵn).
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import OverviewHome, { type OverviewHomeData, type OverviewHomeActions } from '../overview/OverviewHome';

const base = (o: Partial<OverviewHomeData> = {}): OverviewHomeData => ({
  user: { name: 'Nguyễn Văn An', roleLabel: 'Thành viên' }, todayLabel: 'Thứ Tư, 28/10', nowStr: '07:40',
  focus: null, focusRange: '07:30–11:30', allDoneTimes: '', punches: { inS: '', outS: '', inC: '', outC: '' }, pendingSync: 0,
  week: [
    { date: '2026-10-26', label: 'T2', day: 26, kind: 'ok', note: '✓' }, { date: '2026-10-27', label: 'T3', day: 27, kind: 'late', note: 'muộn' }, { date: '2026-10-28', label: 'T4', day: 28, kind: 'today', note: 'nay' },
    { date: '2026-10-29', label: 'T5', day: 29, kind: 'future', note: '' }, { date: '2026-10-30', label: 'T6', day: 30, kind: 'future', note: '' }, { date: '2026-10-31', label: 'T7', day: 31, kind: 'rest', note: 'nghỉ' }, { date: '2026-11-01', label: 'CN', day: 1, kind: 'rest', note: 'nghỉ' },
  ],
  reportDays: [],
  kpi: { dueToday: 3, overdue: 0, toApprove: 0, unread: 0 },
  month: { days: 17, standard: 22, phep: '9.5', phepReserved: 0, lateDays: 1, earlies: 0, allowedLate: 3, otHours: 4 },
  perf: { rate: null, done: 0, total: 0, violations: 0 }, todo: [],
  leaves: { pending: [], recent: [] }, ctp: { pendingCount: 0, pendingSum: 0, approvedCount: 0, approvedSum: 0, rejectedCount: 0, latest: [] },
  advance: { pendingCount: 0, pendingSum: 0, approvedCount: 0, approvedSum: 0 }, projects: [], company: null, ...o,
});
const acts = (): OverviewHomeActions => ({ onPunch: vi.fn(), onGo: vi.fn(), onOpenTask: vi.fn(), onRequestLeave: vi.fn(), onRequestAdvance: vi.fn(), onOpenDetail: vi.fn(), onOpenDay: vi.fn() });
const view = (o: Partial<OverviewHomeData>, a = acts()) => { render(<OverviewHome d={base(o)} a={a} />); return a; };
const focus = (o: any) => ({ key: 'morning', state: 'ready', action: 'timeInS', label: 'Vào ca sáng', sub: 'Trong khung giờ', ...o });

describe('thẻ điểm danh', () => {
  it('đang trong khung giờ vào ca: nút xanh kèm giờ hiện tại, bấm gọi hàm chấm công đúng ô', () => {
    const a = view({ focus: focus({}) });
    const b = screen.getByTestId('punch-main') as HTMLButtonElement;
    expect(b.disabled).toBe(false); expect(b.textContent).toContain('Vào ca sáng · 07:40');
    fireEvent.click(b); expect(a.onPunch).toHaveBeenCalledWith('timeInS');
  });
  it('đã vào ca, chưa tới giờ ra: hiện "Đang làm việc" + giờ vào, nút ra khóa kèm giờ mở', () => {
    const a = view({ focus: focus({ state: 'working', action: '', label: 'Ra ca sáng', sub: 'Ra ca mở lúc 11:15', inTime: '07:24' }), punches: { inS: '07:24', outS: '', inC: '', outC: '' } });
    expect(screen.getByText('Đang làm việc')).toBeTruthy(); expect(screen.getByText('07:24', { selector: 'b' })).toBeTruthy();
    const b = screen.getByTestId('punch-main') as HTMLButtonElement;
    expect(b.disabled).toBe(true); expect(b.textContent).toContain('Ra ca mở lúc 11:15');
    fireEvent.click(b); expect(a.onPunch).not.toHaveBeenCalled();
  });
  it('tới giờ ra ca: nút Ra bấm được (màu đỏ)', () => {
    const a = view({ focus: focus({ state: 'working', action: 'timeOutS', label: 'Ra ca sáng', inTime: '07:24' }), punches: { inS: '07:24', outS: '', inC: '', outC: '' } });
    fireEvent.click(screen.getByTestId('punch-main')); expect(a.onPunch).toHaveBeenCalledWith('timeOutS');
  });
  it('lỡ giờ: báo hết giờ, nút khóa', () => {
    view({ focus: focus({ state: 'closed', action: '', label: 'Vào ca sáng', sub: 'Hết giờ vào ca (07:45)' }) });
    expect(screen.getByText('Đã quá giờ chấm')).toBeTruthy(); expect((screen.getByTestId('punch-main') as HTMLButtonElement).disabled).toBe(true);
  });
  it('xong các ca: hiện đã hoàn thành kèm giờ, không còn nút', () => {
    view({ focus: null, allDoneTimes: 'Sáng 07:24→11:31 · Chiều 13:00→17:02', punches: { inS: '07:24', outS: '11:31', inC: '13:00', outC: '17:02' } });
    expect(screen.getByText(/Đã hoàn thành các ca hôm nay/)).toBeTruthy(); expect(screen.getByText(/Sáng 07:24→11:31/)).toBeTruthy(); expect(screen.queryByTestId('punch-main')).toBeNull();
  });
  it('đường 4 mốc: mốc đã chấm có dấu ✓ và giờ, mốc kế tiếp được đánh dấu', () => {
    view({ focus: focus({}), punches: { inS: '07:24', outS: '', inC: '', outC: '' } });
    const steps = within(screen.getByTestId('ov-steps')).getAllByText(/Vào sáng|Ra sáng|Vào chiều|Ra chiều/).map(e => e.parentElement!);
    expect(steps.map(s => s.getAttribute('data-state'))).toEqual(['done', 'current', 'todo', 'todo']);
    expect(steps[0].textContent).toContain('07:24');
  });
  it('lượt chấm chờ đồng bộ được báo', () => {
    view({ focus: focus({}), pendingSync: 2 });
    expect(screen.getByText(/2 lượt chờ đồng bộ/)).toBeTruthy();
  });
});

describe('dải tuần bấm được + báo cáo lỗi chấm công', () => {
  it('ô đã tới (đủ công / muộn / hôm nay) bấm được và mở chi tiết ngày; ô tương lai và ngày nghỉ thì không', () => {
    const a = view({});
    const open = screen.getAllByTestId('week-day');
    expect(open.map(b => b.getAttribute('data-kind'))).toEqual(['ok', 'late', 'today']);
    fireEvent.click(open[1]); expect(a.onOpenDay).toHaveBeenCalledWith('2026-10-27');
    expect(screen.getAllByTestId('week-day-static')).toHaveLength(4);
  });
  it('có ngày cần báo cáo → hiện dải nhắc, bấm mở ngày mới nhất; không có thì ẩn', () => {
    const a = view({ reportDays: [{ date: '2026-10-27', label: 'Ca Sáng: không có lịch sử check-in' }, { date: '2026-10-26', label: 'Ca Chiều: thiếu chấm RA ca' }] });
    const b = screen.getByTestId('report-banner');
    expect(b.textContent).toContain('Có 2 ngày thiếu / lỗi chấm công cần báo cáo');
    fireEvent.click(b); expect(a.onOpenDay).toHaveBeenCalledWith('2026-10-27');
  });
  it('không có ngày cần báo cáo → không có dải nhắc', () => { view({}); expect(screen.queryByTestId('report-banner')).toBeNull(); });
  it('mục "Cần báo cáo" trong danh sách việc mở chi tiết đúng ngày (không mở công việc)', () => {
    const a = view({ todo: [{ id: 'rp', icon: '📝', title: 'Báo cáo chấm công ngày 27/10', sub: 'Ca Sáng: không có lịch sử check-in', pill: 'Cần báo cáo', tone: 'warn', dayDate: '2026-10-27' }] });
    fireEvent.click(screen.getByTestId('todo-item'));
    expect(a.onOpenDay).toHaveBeenCalledWith('2026-10-27'); expect(a.onOpenTask).not.toHaveBeenCalled();
  });
});

describe('các khối tổng hợp', () => {
  it('dải tuần: đủ 7 ô, đếm đủ công / muộn', () => {
    view({});
    const cells = within(screen.getByTestId('ov-week')).getAllByText(/^T[2-7]|CN/).length;
    expect(cells).toBeGreaterThanOrEqual(7);
    expect(screen.getByText('Đủ công 1')).toBeTruthy(); expect(screen.getByText('Muộn 1')).toBeTruthy();
  });
  it('chỉ số: bấm "Quá hạn" / "Tin nhắn" chuyển đúng tab', () => {
    const a = view({ kpi: { dueToday: 3, overdue: 2, toApprove: 1, unread: 5 } });
    fireEvent.click(screen.getByTestId('kpi-overdue')); expect(a.onGo).toHaveBeenLastCalledWith('tasks');
    fireEvent.click(screen.getByTestId('kpi-unread')); expect(a.onGo).toHaveBeenLastCalledWith('messages');
  });
  it('số liệu tháng: công, phép năm còn, đi muộn trên ngưỡng tô đỏ', () => {
    view({ month: { days: 17, standard: 22, phep: '9.5', phepReserved: 2, lateDays: 4, earlies: 1, allowedLate: 3, otHours: 6 } });
    const m = screen.getByTestId('ov-month');
    expect(m.textContent).toContain('17'); expect(m.textContent).toContain('/ 22'); expect(m.textContent).toContain('9.5'); expect(m.textContent).toContain('Đang chờ duyệt: 2 ngày');
    expect(within(m).getByText('4').className).toContain('text-rose-600');
  });
  it('hiệu suất: hiện % hoàn thành việc, số vi phạm và nội dung gần nhất', () => {
    view({ perf: { rate: 40, done: 2, total: 5, violations: 1, lastViolation: 'Đi muộn không chấp hành giờ giấc' } });
    expect(screen.getByTestId('perf-ring').textContent).toContain('40%'); expect(screen.getByTestId('ov-perf').textContent).toContain('2/5'); expect(screen.getByTestId('ov-perf').textContent).toContain('Đi muộn không chấp hành giờ giấc');
  });
  it('không có việc nào trong tháng: vòng hiệu suất hiện "—" (không chia cho 0)', () => {
    view({}); expect(screen.getByTestId('perf-ring').textContent).toContain('—');
  });
  it('cần làm ngay: trống thì báo không có việc gấp', () => {
    view({}); expect(screen.getByTestId('ov-todo').textContent).toContain('Không có việc cần xử lý gấp');
  });
  it('đơn nghỉ phép chờ: có người duyệt và chuỗi duyệt; đơn đã duyệt hiện nhãn', () => {
    view({ leaves: {
      pending: [{ id: 'a', type: 'Nghỉ phép năm', fromDate: '2026-10-30', toDate: '2026-10-31', daysCount: 2, status: 'pending', approverName: 'Trương Hữu Long' }],
      recent: [{ id: 'b', type: 'Nghỉ phép năm', fromDate: '2026-10-13', toDate: '2026-10-13', daysCount: 1, status: 'approved' }] } });
    const items = screen.getAllByTestId('leave-item');
    expect(items[0].textContent).toContain('Người duyệt: Trương Hữu Long'); expect(items[0].textContent).toContain('Chờ duyệt');
    expect(items[1].textContent).toContain('Đã duyệt');
  });
  it('tạm ứng lương chỉ hiện khi có (công tác phí luôn hiện, báo trống khi chưa có); nút Đề xuất gọi đúng hàm', () => {
    const a = view({ advance: { pendingCount: 1, pendingSum: 1_000_000, approvedCount: 1, approvedSum: 3_000_000 } });
    expect(screen.getByTestId('ov-advance').textContent).toContain('3.000.000');
    fireEvent.click(within(screen.getByTestId('ov-advance')).getByText('Đề xuất')); expect(a.onRequestAdvance).toHaveBeenCalled();
    expect(screen.getByTestId('ov-ctp')).toBeTruthy(); expect(screen.getByTestId('ctp-empty')).toBeTruthy();
  });
  it('dự án: tiến độ và số hoạt động mới', () => {
    view({ projects: [{ id: 'p1', name: 'SỬA CHỮA', progress: 61.6, newCount: 2 }, { id: 'p2', name: 'KHÁCH SẠN', progress: 35, newCount: 0 }] });
    const [p1, p2] = screen.getAllByTestId('project-item');
    expect(p1.textContent).toContain('Tiến độ 62%'); expect(p1.textContent).toContain('2 mới'); expect(p2.textContent).not.toContain('mới');
  });
  it('toàn công ty (Giám đốc): số đã điểm danh, đi muộn, nghỉ phép, chưa điểm danh và tên người chưa điểm danh', () => {
    view({ company: { total: 22, present: 18, late: 2, onLeave: 1, absent: 1, missing: ['Lê Thế Tiến'] } });
    const c = screen.getByTestId('ov-company');
    expect(c.textContent).toContain('18'); expect(c.textContent).toContain('/ 22'); expect(c.textContent).toContain('Chưa điểm danh'); expect(c.textContent).toContain('Lê Thế Tiến');
  });
  it('nút nhanh: xin nghỉ phép, ứng lương, mở chi tiết', () => {
    const a = view({});
    fireEvent.click(screen.getByTestId('quick-leave')); fireEvent.click(screen.getByTestId('quick-advance')); fireEvent.click(screen.getByTestId('open-detail'));
    expect(a.onRequestLeave).toHaveBeenCalled(); expect(a.onRequestAdvance).toHaveBeenCalled(); expect(a.onOpenDetail).toHaveBeenCalled();
  });
});
