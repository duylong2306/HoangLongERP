import { describe, it, expect } from 'vitest';
import { computeDailyWorkday } from '../../components/hr/hrCalculations';

// Hệ số công như cấu hình Hoàng Long: KP = -2, P = 0, ca sáng/chiều 0,5
const coefs = [
  { id: 'MSHID', type: 'Hệ số ca Sáng', coefficient: 0.5 },
  { id: 'ASHID', type: 'Hệ số ca Chiều', coefficient: 0.5 },
  { id: 'KP', type: 'Nghỉ không lương không xin phép', coefficient: -2 },
  { id: 'P', type: 'Nghỉ không lương có xin phép', coefficient: 0 },
  { id: 'PN', type: 'Nghỉ phép năm', coefficient: 1 },
  { id: 'TC', type: 'Tăng ca ngày chủ nhật', coefficient: 2 },
  { id: 'TCL', type: 'Tăng ca ngày Lễ/Tết', coefficient: 3 },
];
const WEEKDAY = '2026-10-05';   // Thứ Hai
const emptyLog = (over: any = {}) => ({ empId: 'NV018', empName: 'Lê Văn Công', date: WEEKDAY, timeInS: '--:--', timeOutS: '--:--', timeInC: '--:--', timeOutC: '--:--', status: 'valid', ...over });
const report = (over: any = {}) => ({ id: 'LR-1', empId: 'NV018', empName: 'Lê Văn Công', type: 'Báo cáo nghỉ ca', fromDate: WEEKDAY, toDate: WEEKDAY, status: 'approved', isAttendanceCorrection: true, shift: 'morning', ...over });
const calc = (log: any, leaves: any[]) => computeDailyWorkday(log, coefs, [], [0], leaves);

describe('Báo cáo nghỉ ca — tính công ngày không có giờ chấm', () => {
  it('chưa có báo cáo nào → vắng không phép KP (-2)', () => expect(calc(emptyLog(), []).workday).toBe(-2));

  it('báo cáo nghỉ ca ĐÃ DUYỆT cho CẢ HAI ca (sáng + chiều) → 0 công (mã P), không phạt', () => {
    const r = calc(emptyLog(), [report(), report({ id: 'LR-2', shift: 'afternoon' })]);
    expect(r.workday).toBe(0); expect(r.label).toBe('0'); expect(r.details).toContain('(P)');
  });
  it('chỉ 1 ca có báo cáo đã duyệt, ca kia không báo cáo, cả ngày không có giờ → vẫn KP (ca còn lại vắng không giải trình)', () => {
    expect(calc(emptyLog(), [report({ shift: 'morning' })]).workday).toBe(-2);
    expect(calc(emptyLog(), [report({ shift: 'afternoon' })]).workday).toBe(-2);
  });
  it('duyệt ca sáng nhưng TỪ CHỐI ca chiều → KP (từ chối phải có tác dụng)', () => {
    expect(calc(emptyLog(), [report({ shift: 'morning' }), report({ id: 'LR-2', shift: 'afternoon', status: 'rejected' })]).workday).toBe(-2);
  });
  it('duyệt ca sáng, ca chiều ĐANG CHỜ duyệt → vẫn KP cho tới khi duyệt đủ cả hai', () => {
    expect(calc(emptyLog(), [report({ shift: 'morning' }), report({ id: 'LR-2', shift: 'afternoon', status: 'pending' })]).workday).toBe(-2);
  });
  it('đơn không ghi rõ ca (dữ liệu cũ) được coi là phủ cả ngày → 0 công', () => {
    expect(calc(emptyLog(), [report({ shift: undefined })]).workday).toBe(0);
  });
  it('mã P đổi theo cấu hình công ty (VD P = 0.5)', () => {
    const c2 = coefs.map(c => c.id === 'P' ? { ...c, coefficient: 0.5 } : c);
    expect(computeDailyWorkday(emptyLog(), c2, [], [0], [report(), report({ id: 'LR-2', shift: 'afternoon' })]).workday).toBe(0.5);
  });

  it('báo cáo bị TỪ CHỐI → như chưa có báo cáo: KP', () => expect(calc(emptyLog(), [report({ status: 'rejected' })]).workday).toBe(-2));
  it('báo cáo ĐANG CHỜ duyệt → chưa tha phạt (KP) cho tới khi được duyệt', () => expect(calc(emptyLog(), [report({ status: 'pending' })]).workday).toBe(-2));
  it('báo cáo của NGƯỜI KHÁC hoặc NGÀY KHÁC không ảnh hưởng', () => {
    expect(calc(emptyLog(), [report({ empId: 'NV099', empName: 'Người khác' })]).workday).toBe(-2);
    expect(calc(emptyLog(), [report({ fromDate: '2026-10-06', toDate: '2026-10-06' })]).workday).toBe(-2);
  });
  it('các loại báo cáo khác (lỗi chấm ra ca / lỗi hệ thống) KHÔNG tha phạt KP khi cả ngày không có giờ', () => {
    expect(calc(emptyLog(), [report({ type: 'Báo cáo lỗi chấm ra ca' })]).workday).toBe(-2);
    expect(calc(emptyLog(), [report({ type: 'Báo cáo lỗi hệ thống chấm công' })]).workday).toBe(-2);
  });
  it('trạng thái "Có phép" ở bản ghi chỉ là chú thích — KHÔNG đổi công', () => {
    expect(calc(emptyLog({ status: 'excused' }), []).workday).toBe(-2);
  });

  it('ngày CÓ chấm 1 ca: tính công ca đó, báo cáo nghỉ ca không đổi gì (không cộng, không phạt thêm)', () => {
    const log = emptyLog({ timeInS: '07:30', timeOutS: '11:30' });
    expect(calc(log, []).workday).toBe(0.5);
    expect(calc(log, [report({ shift: 'afternoon' })]).workday).toBe(0.5);
    expect(calc(log, [report({ shift: 'afternoon', status: 'rejected' })]).workday).toBe(0.5);
  });
  it('đơn nghỉ THẬT đã duyệt vẫn ưu tiên (VD nghỉ phép năm = +1)', () => {
    const pn = { id: 'LR-9', empId: 'NV018', empName: 'Lê Văn Công', type: 'Nghỉ phép năm', fromDate: WEEKDAY, toDate: WEEKDAY, status: 'approved' };
    expect(calc(emptyLog(), [pn, report(), report({ id: 'LR-2', shift: 'afternoon' })]).workday).toBe(1);
  });
  it('Chủ nhật / cuối tuần không có giờ → 0 (không phạt), báo cáo hay không đều vậy', () => {
    expect(computeDailyWorkday(emptyLog({ date: '2026-10-04' }), coefs, [], [0], []).workday).toBe(0);
  });
});
