// Màn Tổng quan kiểu mới: render thật DashboardOverview (CSDL giả) — khối mới hiện, khối cũ thu gọn, điểm danh nối đúng hàm cũ.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const S = vi.hoisted(() => ({ saved: [] as any[], employees: [] as any[], attendance: [] as any[], leaves: [] as any[], errors: [] as any[], advances: [] as any[], admin: false, now: new Date(2026, 9, 28, 7, 40, 19)   /* 07:40 giờ máy: trong khung vào ca sáng mặc định (07:15–07:45); dựng theo giờ máy để không phụ thuộc múi giờ */ }));
// CSDL giả: mọi bảng trả về mảng rỗng, riêng các bảng tổng quan cần dùng
vi.mock('../../lib/dbService', () => {
  const rows: Record<string, () => any[]> = { employees: () => S.employees, attendance: () => S.attendance, hrmLeaves: () => S.leaves, hrmEmployeeErrors: () => S.errors, subcontractorAdvances: () => S.advances };
  const table = (name: string) => new Proxy({}, { get: (_t, m: string) => {
    if (m === 'listForRange' || m === 'list') return async () => (rows[name] ? rows[name]() : []);
    if (m === 'get') return async () => null;
    if (m === 'save') return async (v: any) => { S.saved.push({ table: name, value: v }); };
    return async () => undefined;
  } });
  return { dbService: new Proxy({}, { get: (_t, k: string) => table(k) }), mapAttendanceRow: (r: any) => r, todayString: () => '2026-10-28' };
});
vi.mock('../../context', () => ({
  useNotification: () => ({ addToast: vi.fn() }), isUserInRoleGroup: () => false, loadHrmRoleGroups: () => [], getConfiguredApprover: () => null, getConfiguredApprovers: () => [],
  isRoleAdmin: () => S.admin, isRoleAccounting: () => false, isRoleOffice: () => false,
}));
vi.mock('../../lib/projectEventReads', () => ({ loadUnreadSummary: vi.fn(async () => ({ p1: { count: 2, latest: [] } })) }));
import DashboardOverview from '../DashboardOverview';

const me: any = { id: 'u1', name: 'Nguyễn Văn An', role: 'staff' };
const tasks: any[] = [
  { id: 't1', name: 'Lắp đặt tại công trình', status: 'in_progress', deadline: '2026-10-26', assigneeId: 'u1', projectId: 'p1' },
  { id: 't2', name: 'Khảo sát + Thiết kế', status: 'in_progress', deadline: '2026-10-28', assigneeId: 'u1', projectId: 'p1' },
  { id: 't3', name: 'Báo giá', status: 'completed', deadline: '2026-10-20', assigneeId: 'u1', projectId: 'p1' },
];
const projects: any[] = [{ id: 'p1', code: 'P1', name: 'SỬA CHỮA - A HIỀN TRẦN', pmId: 'u1', progress: 62, status: 'processing' }];
const mount = (props: any = {}) => render(<DashboardOverview projects={projects} tasks={tasks} receipts={[]} payments={[]} quotes={[]} currentUser={me} onNavigateTab={vi.fn()} travelExpensesSummary={[]} {...props} />);

beforeEach(() => {
  localStorage.clear(); S.saved = []; S.employees = []; S.attendance = []; S.leaves = []; S.errors = []; S.advances = []; S.admin = false;
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(S.now);
});

describe('Tổng quan kiểu mới', () => {
  it('hiện các khối chính: điểm danh, tuần, 4 chỉ số, số liệu tháng, hiệu suất, cần làm ngay, dự án; khối chi tiết cũ thu gọn', async () => {
    mount();
    expect(await screen.findByTestId('overview-home')).toBeTruthy();
    for (const id of ['ov-attendance', 'ov-week', 'ov-kpi', 'ov-month', 'ov-perf', 'ov-todo']) expect(screen.getByTestId(id)).toBeTruthy();
    expect(screen.getByTestId('overview-home').textContent).toContain('Nguyễn Văn An');   // lời chào
    expect(screen.queryByTestId('overview_detail')).toBeNull();                                   // khối cũ chưa mở
    expect(document.getElementById('realtime_biometric_timekeeping')).toBeNull();
  });

  it('4 chỉ số lấy đúng từ danh sách việc: hôm nay 1, quá hạn 1', async () => {
    mount();
    await screen.findByTestId('ov-kpi');
    expect(within(screen.getByTestId('kpi-today')).getByText('1')).toBeTruthy();
    expect(within(screen.getByTestId('kpi-overdue')).getByText('1')).toBeTruthy();
  });

  it('cần làm ngay: việc quá hạn đứng trước, bấm mở đúng công việc', async () => {
    const seen: any[] = []; const h = (e: Event) => seen.push((e as CustomEvent).detail); window.addEventListener('hl-open-task', h);
    mount();
    const items = await screen.findAllByTestId('todo-item');
    const overdue = items.find(i => i.textContent!.includes('Lắp đặt tại công trình'))!;   // (mục "Cần báo cáo" đứng trước các việc)
    expect(overdue.textContent).toContain('Quá hạn');
    expect(items.indexOf(overdue)).toBeGreaterThan(items.findIndex(i => i.textContent!.includes('Cần báo cáo')));
    fireEvent.click(overdue);
    window.removeEventListener('hl-open-task', h);
    expect(seen).toEqual([{ taskId: 't1' }]);
  });

  it('hiệu suất: tỷ lệ hoàn thành việc trong tháng (1/3 việc có hạn trong tháng 10 đã xong → 33%)', async () => {
    mount();
    await screen.findByTestId('ov-perf');
    expect(screen.getByTestId('perf-ring').textContent).toContain('33%');
  });

  it('dự án của tôi kèm số hoạt động nhật ký mới', async () => {
    mount();
    const item = await screen.findByTestId('project-item');
    expect(item.textContent).toContain('SỬA CHỮA - A HIỀN TRẦN');
    await waitFor(() => expect(screen.getByTestId('project-item').textContent).toContain('2 mới'));
  });

  it('"Lịch chấm công tháng" chỉ còn giao diện lịch (không còn khối điểm danh/bảng cũ); nút Thu gọn đóng lại', async () => {
    mount();
    expect(screen.queryByTestId('month-calendar')).toBeNull();
    fireEvent.click(await screen.findByTestId('open-detail'));
    expect(await screen.findByTestId('month-calendar')).toBeTruthy();
    // đủ 28–31 ô ngày của tháng, và khối cũ (điểm danh sinh trắc, bảng công tác phí) không còn
    expect(screen.getAllByTestId(/^month-day/).length).toBeGreaterThanOrEqual(28);
    expect(document.getElementById('realtime_biometric_timekeeping')).toBeNull();
    fireEvent.click(screen.getByTestId('close-detail'));
    await waitFor(() => expect(screen.queryByTestId('month-calendar')).toBeNull());
  });

  it('bấm một ngày trong lịch tháng mở hộp "Chi tiết ngày"', async () => {
    mount();
    fireEvent.click(await screen.findByTestId('open-detail'));
    const days = await screen.findAllByTestId('month-day');   // ngày bấm được (đã tới)
    fireEvent.click(days[0]);
    expect(await screen.findByTestId('day-detail-sheet')).toBeTruthy();
  });

  it('thẻ "Toàn công ty hôm nay" và "Công tác phí" không còn nút "Chi tiết"', async () => {
    mount();
    await screen.findByTestId('open-detail');
    expect(screen.queryByText('Chi tiết')).toBeNull();
  });

  it('đơn nghỉ phép của tôi chỉ hiện khi có đơn (đơn chờ kèm chuỗi duyệt)', async () => {
    mount();
    await screen.findByTestId('overview-home');
    expect(screen.queryByTestId('ov-leave')).toBeNull();
  });
  it('có đơn nghỉ phép đang chờ → hiện thẻ đơn với người duyệt', async () => {
    S.leaves = [{ id: 'l1', empId: 'u1', empName: me.name, type: 'Nghỉ phép năm', fromDate: '2026-10-30', toDate: '2026-10-31', daysCount: 2, status: 'pending', approverName: 'Trương Hữu Long', createdAt: '2026-10-27T13:15:00Z' }];
    mount();
    const card = await screen.findByTestId('ov-leave');
    expect(card.textContent).toContain('30/10 – 31/10'); expect(card.textContent).toContain('Trương Hữu Long'); expect(card.textContent).toContain('Chờ duyệt');
  });

  it('công tác phí của tôi: ẩn khi không có, hiện khi có (chờ duyệt kèm số tiền)', async () => {
    const { unmount } = mount();
    await screen.findByTestId('overview-home');
    expect(screen.queryByTestId('ov-ctp')).toBeNull();
    unmount();
    mount({ travelExpensesSummary: [{ empId: 'u1', employeeName: me.name, status: 'pending', amount: 1_200_000, content: 'Đi lại khảo sát', code: 'CTP-1', missionName: 'Khảo sát' }] });
    const card = await screen.findByTestId('ov-ctp');
    expect(card.textContent).toContain('1,2tr'); expect(card.textContent).toContain('Đi lại khảo sát');
  });

  it('chỉ Giám đốc thấy "Toàn công ty hôm nay"', async () => {
    mount();
    await screen.findByTestId('overview-home');
    expect(screen.queryByTestId('ov-company')).toBeNull();
  });
  it('Giám đốc thấy khối toàn công ty', async () => {
    S.admin = true;
    mount();
    expect(await screen.findByTestId('ov-company')).toBeTruthy();
  });

  it('điểm danh: 07:40 (trong khung ca sáng) → nút "Vào ca sáng" bấm được', async () => {
    mount();
    const btn = await screen.findByTestId('punch-main');
    expect(btn.textContent).toContain('Vào ca sáng');
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    expect(btn.textContent).toContain('07:40');
  });
  it('đã quá khung giờ vào ca sáng → thẻ chuyển sang ca chiều sắp mở, nút khóa kèm giờ mở', async () => {
    vi.setSystemTime(new Date(2026, 9, 28, 8, 11, 19));   // 08:11: quá 07:45
    mount();
    const btn = await screen.findByTestId('punch-main') as HTMLButtonElement;
    expect(btn.disabled).toBe(true); expect(btn.textContent).toContain('Vào ca chiều'); expect(btn.textContent).toContain('Mở lúc');
  });
});

describe('Ba hộp thoại kiểu LoLo (xin nghỉ phép, đề xuất ứng lương, chi tiết ngày + báo cáo)', () => {
  it('Xin nghỉ phép: hộp trượt từ dưới lên có đủ trường, số ngày phép còn, nút gửi; đóng được', async () => {
    mount();
    fireEvent.click(await screen.findByTestId('quick-leave'));
    const dlg = await screen.findByRole('dialog', { name: 'Xin nghỉ phép' });
    expect(dlg.textContent).toContain('Loại phép'); expect(dlg.textContent).toContain('Từ ngày'); expect(dlg.textContent).toContain('Lý do xin phép');
    expect(within(dlg).getByTestId('leave-balance').textContent).toContain('Còn 12 ngày');
    expect(within(dlg).getByTestId('leave-days')).toBeTruthy();
    expect(within(dlg).getByTestId('sheet-submit').textContent).toBe('Gửi đơn nghỉ phép');
    fireEvent.click(within(dlg).getByTestId('sheet-cancel'));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Xin nghỉ phép' })).toBeNull());
  });
  it('Xin nghỉ phép: chọn nghỉ 1 ca bằng nút chọn nhanh → ngày kết thúc bị khóa; hết phép năm → chặn gửi đơn kèm cảnh báo', async () => {
    S.employees = [{ id: 'u1', name: me.name, phepNam: 0 }];
    mount();
    fireEvent.click(await screen.findByTestId('quick-leave'));
    const dlg = await screen.findByRole('dialog', { name: 'Xin nghỉ phép' });
    await waitFor(() => expect(dlg.textContent).toContain('Bạn đã hết phép năm'));
    expect((within(dlg).getByTestId('sheet-submit') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(dlg.querySelector('[data-value="morning"]')!);
    const dates = dlg.querySelectorAll('input[type="date"]') as NodeListOf<HTMLInputElement>;
    expect(dates[1].disabled).toBe(true);
  });
  it('Đề xuất ứng lương: chọn nhanh số tiền hiện xem trước; có nút gửi', async () => {
    mount();
    fireEvent.click(await screen.findByTestId('quick-advance'));
    const dlg = await screen.findByRole('dialog', { name: 'Đề xuất tạm ứng lương' });
    fireEvent.click(dlg.querySelector('[data-amount="3000000"]')!);
    expect(within(dlg).getByTestId('advance-preview').textContent).toContain('3.000.000');
    expect((dlg.querySelector('input[type="number"]') as HTMLInputElement).value).toBe('3000000');
    expect(within(dlg).getByTestId('sheet-submit').textContent).toBe('Gửi đề xuất');
  });

  const log26 = { id: 'AT-u1-20261026', empId: 'u1', empName: me.name, date: '2026-10-26', timeInS: '07:25', timeOutS: '11:31', timeInC: '13:00', timeOutC: '17:02', status: 'valid' };
  it('bấm ô trong dải tuần → mở chi tiết ngày kiểu mới với giờ vào / ra từng ca', async () => {
    S.attendance = [log26];
    mount();
    const days = await screen.findAllByTestId('week-day');
    fireEvent.click(days[0]);                                   // T2 26/10
    const sheet = await screen.findByTestId('day-detail-sheet');
    expect(sheet.textContent).toContain('Chi tiết ngày 26/10/2026'); expect(sheet.textContent).toContain('07:25'); expect(sheet.textContent).toContain('17:02');
    expect(within(sheet).getByTestId('day-shift-morning').getAttribute('data-state')).toBe('ok');
    fireEvent.click(within(sheet).getByTestId('day-close'));
    await waitFor(() => expect(screen.queryByTestId('day-detail-sheet')).toBeNull());
  });
  it('ngày thiếu chấm công: dải nhắc "cần báo cáo" → mở ngày → gửi báo cáo giải trình thành công (lưu đơn giải trình, kèm lý do)', async () => {
    S.attendance = [log26];
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    mount();
    fireEvent.click(await screen.findByTestId('report-banner'));            // ngày thiếu mới nhất: 27/10 (không có bản ghi nào)
    const sheet = await screen.findByTestId('day-detail-sheet');
    expect(sheet.textContent).toContain('Chi tiết ngày 27/10/2026');
    expect(within(sheet).getByTestId('day-shift-morning').getAttribute('data-state')).toBe('missing');
    fireEvent.click(within(within(sheet).getByTestId('day-shift-morning')).getByText(/Báo cáo lý do/));
    const form = await within(sheet).findByTestId('report-form');
    fireEvent.change(form.querySelector('textarea')!, { target: { value: 'Quên chấm công do đi công trình sớm' } });
    fireEvent.click(within(form).getByTestId('report-submit'));
    await waitFor(() => expect(S.saved.some(x => x.table === 'hrmLeaves')).toBe(true));
    const sent = S.saved.find(x => x.table === 'hrmLeaves')!.value;
    expect(sent).toMatchObject({ empId: 'u1', fromDate: '2026-10-27', isAttendanceCorrection: true, status: 'pending', shift: 'morning' });
    expect(sent.reason).toContain('Quên chấm công do đi công trình sớm');
    expect(alertSpy).toHaveBeenCalled();
    alertSpy.mockRestore();
  });
  it('mục "Cần báo cáo" nằm đầu danh sách Cần làm ngay và mở đúng ngày', async () => {
    mount();
    const items = await screen.findAllByTestId('todo-item');
    expect(items[0].textContent).toContain('Báo cáo chấm công ngày 27/10'); expect(items[0].textContent).toContain('Cần báo cáo');
    fireEvent.click(items[0]);
    expect((await screen.findByTestId('day-detail-sheet')).textContent).toContain('27/10/2026');
  });
  it('ca đã gửi báo cáo (đơn chờ duyệt) → hiện "Chờ duyệt", không còn nút báo cáo lý do', async () => {
    S.leaves = [{ id: 'rp1', empId: 'u1', empName: me.name, type: 'Báo cáo nghỉ ca', shift: 'morning', fromDate: '2026-10-27', toDate: '2026-10-27', status: 'pending', isAttendanceCorrection: true, createdAt: '2026-10-28' }];
    mount();
    const days = await screen.findAllByTestId('week-day');
    fireEvent.click(days[1]);                                    // T3 27/10 (không có bản ghi chấm công)
    const morning = within(await screen.findByTestId('day-shift-morning'));
    expect(morning.getByText(/Chờ duyệt/)).toBeTruthy(); expect(morning.queryByText(/Báo cáo lý do/)).toBeNull();
    expect(within(screen.getByTestId('day-shift-afternoon')).getByText(/Báo cáo lý do/)).toBeTruthy();   // ca chiều vẫn chưa báo cáo
  });
});
