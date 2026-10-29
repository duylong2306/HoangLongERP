// Tính toán cho màn Tổng quan kiểu mới (điểm danh gọn, dải tuần, tổng hợp việc / hiệu suất / đơn / công tác phí / tạm ứng / dự án / toàn công ty).
import { describe, it, expect } from 'vitest';
import {
  computeShiftView, pickFocusShift, buildMonth, monthCounts, monthStartOffset, weekDates, buildWeek, weekCounts, standardWorkdays, summarizeTasks, summarizeViolations, summarizeLeaves,
  summarizeCtp, summarizeAdvances, myProjects, summarizeCompanyToday, fmtMoneyShort, fmtMoney, fmtLeaveRange, hasTime, type ShiftInput,
} from '../overviewData';

const base = (o: Partial<ShiftInput> = {}): ShiftInput => ({
  key: 'morning', inSlot: 'timeInS', outSlot: 'timeOutS', inTime: '--:--', outTime: '--:--', inActive: false, outActive: false, currMin: 8 * 60 + 11,
  inStartMin: 7 * 60, inStartStr: '07:00', inEndStr: '08:00', outStartMin: 11 * 60, outStartStr: '11:00', outEndStr: '12:00', ...o,
});

describe('computeShiftView (cùng quy tắc nút ca cũ)', () => {
  it('chưa vào ca + trong khung giờ → nút VÀO bấm được', () => {
    const v = computeShiftView(base({ inActive: true }));
    expect(v).toMatchObject({ state: 'ready', action: 'timeInS', label: 'Vào ca sáng', sub: 'Trong khung giờ' });
  });
  it('chưa vào ca + chưa tới giờ mở → chờ, ghi giờ mở', () => {
    expect(computeShiftView(base({ currMin: 6 * 60 }))).toMatchObject({ state: 'waiting', action: '', sub: 'Mở lúc 07:00' });
  });
  it('chưa vào ca + quá giờ → đóng (lỡ ca)', () => {
    expect(computeShiftView(base({ currMin: 9 * 60 }))).toMatchObject({ state: 'closed', action: '', sub: 'Hết giờ vào ca (08:00)' });
  });
  it('đã vào, trong khung giờ ra → nút RA bấm được', () => {
    expect(computeShiftView(base({ inTime: '07:24', outActive: true, currMin: 11 * 60 + 5 }))).toMatchObject({ state: 'working', action: 'timeOutS', label: 'Ra ca sáng', inTime: '07:24' });
  });
  it('đã vào, chưa tới giờ ra → đang làm việc, nút RA khóa kèm giờ mở', () => {
    expect(computeShiftView(base({ inTime: '07:24', currMin: 9 * 60 }))).toMatchObject({ state: 'working', action: '', sub: 'Ra ca mở lúc 11:00' });
  });
  it('đã vào, quá giờ ra → đóng', () => {
    expect(computeShiftView(base({ inTime: '07:24', currMin: 13 * 60 }))).toMatchObject({ state: 'closed', sub: 'Hết giờ ra ca (12:00)' });
  });
  it('đủ vào + ra → đã chốt kèm khoảng giờ', () => {
    expect(computeShiftView(base({ inTime: '07:24', outTime: '11:31' }))).toMatchObject({ state: 'done', sub: '07:24 → 11:31' });
  });
  it('tăng ca có nhãn riêng', () => {
    expect(computeShiftView(base({ key: 'overtime', inActive: true })).label).toBe('Vào tăng ca');
    expect(computeShiftView(base({ key: 'overtime', inTime: '18:00', outActive: true })).label).toBe('Kết thúc tăng ca');
  });
  it('hasTime loại bỏ --:-- và rỗng', () => { expect(hasTime('--:--')).toBe(false); expect(hasTime('')).toBe(false); expect(hasTime(undefined)).toBe(false); expect(hasTime('07:30')).toBe(true); });
});

describe('pickFocusShift (ca hiện ở thẻ gọn)', () => {
  const v = (key: any, state: any, action = '') => ({ key, state, action, label: key, sub: '' } as any);
  it('ưu tiên ca đang bấm được: sáng rồi chiều rồi tăng ca', () => {
    expect(pickFocusShift([v('morning', 'done'), v('afternoon', 'ready', 'timeInC'), v('overtime', 'ready', 'timeInOT')])!.key).toBe('afternoon');
  });
  it('không ca nào bấm được → ca sắp mở gần nhất (không nhảy sang ca đã lỡ)', () => {
    expect(pickFocusShift([v('morning', 'closed'), v('afternoon', 'waiting'), v('overtime', 'waiting')])!.key).toBe('afternoon');
  });
  it('đang làm việc chờ giờ ra → hiện ca đó', () => {
    expect(pickFocusShift([v('morning', 'working'), v('afternoon', 'waiting')])!.key).toBe('morning');   // đã vào ca sáng, chờ giờ ra: hiện "đang làm việc" thay vì ca chiều sắp mở
  });
  it('tăng ca chỉ lên thẻ khi bấm được', () => {
    expect(pickFocusShift([v('morning', 'done'), v('afternoon', 'done'), v('overtime', 'waiting')])).toBeNull();
    expect(pickFocusShift([v('morning', 'done'), v('afternoon', 'done'), v('overtime', 'ready', 'timeInOT')])!.key).toBe('overtime');
  });
  it('lỡ cả hai ca → hiện ca lỡ gần nhất; xong cả ngày → null', () => {
    expect(pickFocusShift([v('morning', 'closed'), v('afternoon', 'closed')])!.key).toBe('afternoon');
    expect(pickFocusShift([v('morning', 'done'), v('afternoon', 'done')])).toBeNull();
  });
});

describe('dải tuần', () => {
  it('tuần chứa 28/10/2026 (thứ Tư) bắt đầu thứ Hai 26/10', () => {
    expect(weekDates('2026-10-28')).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
  });
  it('chủ nhật vẫn thuộc tuần bắt đầu thứ Hai trước đó', () => {
    expect(weekDates('2026-11-01')[0]).toBe('2026-10-26');
  });
  const facts: Record<string, any> = {
    '2026-10-26': { hasPunch: true, lates: 0, isRest: false, onLeave: false },
    '2026-10-27': { hasPunch: true, lates: 1, isRest: false, onLeave: false },
    '2026-10-31': { hasPunch: false, lates: 0, isRest: true, onLeave: false },
  };
  const f = (d: string) => facts[d] || { hasPunch: false, lates: 0, isRest: false, onLeave: false };
  it('phân loại: đủ công, muộn, hôm nay, tương lai, nghỉ cuối tuần', () => {
    const w = buildWeek('2026-10-28', f);
    expect(w.map(d => d.kind)).toEqual(['ok', 'late', 'today', 'future', 'future', 'rest', 'future']);
    expect(w[1].note).toBe('muộn'); expect(w[2].note).toBe('nay'); expect(weekCounts(w)).toEqual({ ok: 1, late: 1, absent: 0 });
  });
  it('ngày đã qua không chấm và không nghỉ → vắng; có đơn phép đã duyệt → phép', () => {
    const w = buildWeek('2026-10-30', d => (d === '2026-10-27' ? { hasPunch: false, lates: 0, isRest: false, onLeave: true } : { hasPunch: false, lates: 0, isRest: false, onLeave: false }));
    expect(w[0].kind).toBe('absent'); expect(w[1].kind).toBe('leave'); expect(weekCounts(w).absent).toBe(3);   // T2, T4, T5 (T3 phép)
  });
  it('ngày nghỉ nhưng vẫn có chấm (làm bù) → tính theo chấm công', () => {
    const w = buildWeek('2026-11-01', d => (d === '2026-10-31' ? { hasPunch: true, lates: 0, isRest: true, onLeave: false } : { hasPunch: false, lates: 0, isRest: true, onLeave: false }));
    expect(w[5].kind).toBe('ok');
  });
  it('số ngày công chuẩn của tháng bỏ ngày nghỉ', () => {
    const isRest = (d: string) => { const dow = new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)).getDay(); return dow === 0; };   // chỉ nghỉ chủ nhật
    expect(standardWorkdays('2026-10', isRest)).toBe(31 - 4);   // 4 chủ nhật trong T10/2026
  });
});

describe('việc của tôi', () => {
  const t = (o: any) => ({ id: 'x', name: 'v', status: 'in_progress', deadline: '2026-10-28', assigneeId: 'u1', ...o });
  const tasks = [
    t({ id: 'a' }), t({ id: 'b', deadline: '2026-10-20' }), t({ id: 'c', status: 'completed', deadline: '2026-10-10' }),
    t({ id: 'd', status: 'completed', deadline: '2026-10-25' }), t({ id: 'e', assigneeId: 'u2' }), t({ id: 'f', assigneeId: 'u2', missions: [{ memberIds: ['u1'] }], deadline: '2026-10-28' }),
    t({ id: 'g', deadline: '2026-09-30' }),
  ];
  it('đến hạn hôm nay, quá hạn, tỷ lệ hoàn thành trong tháng', () => {
    const s = summarizeTasks(tasks as any, 'u1', '2026-10-28');
    expect(s.dueToday.map(x => x.id).sort()).toEqual(['a', 'f']);       // f: là thành viên nhiệm vụ
    expect(s.overdue.map(x => x.id).sort()).toEqual(['b', 'g']);
    expect(s.monthTotal).toBe(5); expect(s.monthDone).toBe(2); expect(s.rate).toBe(40);
  });
  it('không có việc nào trong tháng → tỷ lệ null (không chia cho 0)', () => {
    expect(summarizeTasks([], 'u1', '2026-10-28').rate).toBeNull();
  });
});

describe('vi phạm (Bảng Hiệu suất)', () => {
  it('chỉ đếm của mình trong tháng, lấy nội dung gần nhất', () => {
    const r = summarizeViolations([
      { employeeId: 'u1', date: '2026-10-05', criterionContent: 'A' }, { employeeId: 'u1', date: '2026-10-20', criterionContent: 'B' },
      { employeeId: 'u2', date: '2026-10-21', criterionContent: 'C' }, { employeeId: 'u1', date: '2026-09-30', criterionContent: 'D' },
    ], 'u1', '2026-10-28');
    expect(r).toEqual({ count: 2, last: 'B' });
    expect(summarizeViolations([], 'u1', '2026-10-28')).toEqual({ count: 0, last: undefined });
  });
});

describe('đơn nghỉ phép của tôi', () => {
  const real = (t: string) => t.startsWith('Nghỉ');
  const l = (o: any) => ({ id: 'x', empId: 'u1', type: 'Nghỉ phép năm', fromDate: '2026-10-30', toDate: '2026-10-31', status: 'pending', createdAt: '2026-10-27T13:15:00Z', ...o });
  it('đơn chờ lên đầu; chỉ lấy đơn của mình, loại giải trình chấm công và loại không phải nghỉ phép thật', () => {
    const s = summarizeLeaves([l({ id: 'p1' }), l({ id: 'o', empId: 'u2' }), l({ id: 'c', isAttendanceCorrection: true }), l({ id: 'r', type: 'Báo cáo' })], { id: 'u1', name: 'A' }, '2026-10-28', real);
    expect(s.pending.map(x => x.id)).toEqual(['p1']);
  });
  it('đơn đã có kết quả: chỉ lấy 1 đơn gần nhất trong 45 ngày', () => {
    const s = summarizeLeaves([
      l({ id: 'old', status: 'approved', fromDate: '2026-08-01', toDate: '2026-08-01' }), l({ id: 'n1', status: 'approved', fromDate: '2026-10-13', toDate: '2026-10-13', createdAt: '2026-10-12T00:00:00Z' }),
      l({ id: 'n2', status: 'rejected', fromDate: '2026-10-05', toDate: '2026-10-05', createdAt: '2026-10-01T00:00:00Z' }),
    ], { id: 'u1', name: 'A' }, '2026-10-28', real);
    expect(s.recent.map(x => x.id)).toEqual(['n1']);
  });
  it('khớp theo tên khi đơn cũ chưa có mã nhân viên; định dạng khoảng ngày', () => {
    const s = summarizeLeaves([l({ id: 'z', empId: undefined, empName: 'A' })], { id: 'u1', name: 'A' }, '2026-10-28', real);
    expect(s.pending).toHaveLength(1);
    expect(fmtLeaveRange({ fromDate: '2026-10-30', toDate: '2026-10-31' })).toBe('30/10 – 31/10');
    expect(fmtLeaveRange({ fromDate: '2026-10-13', toDate: '2026-10-13' })).toBe('13/10');
  });
});

describe('công tác phí của tôi', () => {
  it('đếm và cộng tiền theo trạng thái; chờ duyệt tính mọi thời gian, đã duyệt / từ chối chỉ trong tháng khi khoản có ngày', () => {
    const s = summarizeCtp([
      { status: 'pending', amount: 1_200_000, code: 'A' }, { status: 'approved', amount: 450_000, date: '2026-10-22' }, { status: 'completed', amount: 3_000_000, date: '2026-10-01' },
      { status: 'approved', amount: 999, date: '2026-09-10' }, { status: 'rejected', amount: 50, date: '2026-10-02' }, { status: 'rejected', amount: 70, date: '2026-08-02' },
    ], '2026-10-28');
    expect(s).toMatchObject({ pendingCount: 1, pendingSum: 1_200_000, approvedCount: 2, approvedSum: 3_450_000, rejectedCount: 1 });
    expect(s.latest[0].status).toBe('pending');
  });
  it('khoản không có ngày vẫn được tính', () => {
    expect(summarizeCtp([{ status: 'approved', amount: 10 }], '2026-10-28').approvedCount).toBe(1);
  });
  it('định dạng tiền ngắn', () => {
    expect(fmtMoneyShort(1_200_000)).toBe('1,2tr'); expect(fmtMoneyShort(3_000_000)).toBe('3tr'); expect(fmtMoneyShort(450_000)).toBe('450k'); expect(fmtMoneyShort(500)).toBe('500');
    expect(fmtMoney(1_200_000)).toContain('1.200.000');
  });
});

describe('tạm ứng lương', () => {
  it('chỉ đề xuất ứng lương của mình trong tháng; tách chờ duyệt / đã duyệt', () => {
    const s = summarizeAdvances([
      { creator: 'u1', projectName: 'Ứng Lương Nhân Sự', amount: 3_000_000, status: 'approved', date: '2026-10-15' },
      { creator: 'u1', projectName: 'Ứng Lương Nhân Sự', amount: 1_000_000, status: 'pending_approval', date: '2026-10-27' },
      { creator: 'u2', projectName: 'Ứng Lương Nhân Sự', amount: 9, status: 'approved', date: '2026-10-15' },
      { creator: 'u1', projectName: 'Dự án khác', amount: 8, status: 'approved', date: '2026-10-15' },
      { creator: 'u1', projectName: 'Ứng Lương Nhân Sự', amount: 7, status: 'approved', date: '2026-09-15' },
    ], 'u1', '2026-10-28');
    expect(s).toMatchObject({ pendingCount: 1, pendingSum: 1_000_000, approvedCount: 1, approvedSum: 3_000_000, lastDate: '2026-10-27' });
  });
});

describe('dự án của tôi', () => {
  const projects = [{ id: 'p1', name: 'A', pmId: 'u1' }, { id: 'p2', name: 'B', pmId: 'x', involvedEmployeeIds: ['u1'] }, { id: 'p3', name: 'C', pmId: 'x' }, { id: 'p4', name: 'D', pmId: 'u1', status: 'completed' }, { id: 'p5', name: 'E', pmId: 'x' }];
  it('là trưởng dự án / có tên / có việc ở đó; bỏ dự án đã hoàn thành; giới hạn số lượng', () => {
    const tasks = [{ id: 't', name: 'v', status: 'x', deadline: '', assigneeId: 'u1', projectId: 'p5' }];
    expect(myProjects(projects as any, tasks as any, 'u1').map(p => p.id)).toEqual(['p1', 'p2', 'p5']);
    expect(myProjects(projects as any, tasks as any, 'u1', 2)).toHaveLength(2);
  });
});

describe('toàn công ty hôm nay (Giám đốc)', () => {
  const employees = [{ id: 'a', name: 'An' }, { id: 'b', name: 'Bình' }, { id: 'c', name: 'Chi' }, { id: 'd', name: 'Dũng' }, { id: 'e', name: 'Em', status: 'retired' }];
  const logs = [{ empId: 'a', date: '2026-10-28' }, { empId: 'b', date: '2026-10-28', late: true }, { empId: 'a', date: '2026-10-27' }];
  const args = { employees, logs, today: '2026-10-28', latesOf: (l: any) => (l.late ? 1 : 0), onLeaveIds: new Set(['c']), isRestDay: false };
  it('đếm đã điểm danh, đi muộn, nghỉ phép, chưa điểm danh; bỏ người đã nghỉ việc', () => {
    expect(summarizeCompanyToday(args)).toEqual({ total: 4, present: 2, late: 1, onLeave: 1, absent: 1, missing: ['Dũng'] });
  });
  it('ngày nghỉ: không ai bị coi là chưa điểm danh', () => {
    expect(summarizeCompanyToday({ ...args, isRestDay: true })).toMatchObject({ absent: 0, missing: [] });
  });
});


describe('buildMonth — lịch tháng', () => {
  const base = { hasPunch: false, lates: 0, isRest: false, onLeave: false, workLabel: '', ot: false, issue: false };
  // 2026-10: ngày 3 = thứ Bảy, 4 = Chủ nhật; hôm nay = 15
  const facts: Record<string, any> = {
    '2026-10-01': { hasPunch: true, workLabel: '1' },
    '2026-10-02': { hasPunch: true, lates: 1, workLabel: '1', ot: true },
    '2026-10-03': { isRest: true }, '2026-10-04': { isRest: true },
    '2026-10-05': { onLeave: true }, '2026-10-06': { holiday: 'Lễ X' },
    '2026-10-07': { issue: true },
  };
  const days = buildMonth('2026-10', '2026-10-15', (d) => ({ ...base, ...(facts[d] || {}) }));
  const kind = (n: number) => days[n - 1].kind;
  it('đủ số ngày của tháng', () => expect(days).toHaveLength(31));
  it('phân loại từng ngày đã qua', () => {
    expect(kind(1)).toBe('ok'); expect(kind(2)).toBe('late'); expect(kind(3)).toBe('rest'); expect(kind(5)).toBe('leave');
    expect(kind(6)).toBe('holiday'); expect(kind(7)).toBe('absent'); expect(days[1].ot).toBe(true); expect(days[6].issue).toBe(true);
  });
  it('hôm nay / tương lai', () => { expect(kind(15)).toBe('today'); expect(kind(20)).toBe('future'); });
  it('đếm và ô trống đầu tháng', () => {
    const c = monthCounts(days);
    expect(c.ok).toBe(1); expect(c.late).toBe(1); expect(c.leave).toBe(1); expect(c.issue).toBe(1);
    expect(monthStartOffset('2026-10')).toBe(3);   // 1/10/2026 là thứ Năm → 3 ô trống (T2, T3, T4)
  });
});
