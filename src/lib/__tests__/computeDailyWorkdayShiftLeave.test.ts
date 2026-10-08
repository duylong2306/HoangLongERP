import { describe, it, expect } from 'vitest';
import { computeDailyWorkday } from '../../components/hr/hrCalculations';

// Hệ số như cấu hình Hoàng Long: PN = 1, P = 0, KP = -2, ca sáng/chiều 0,5
const coefs = [
  { id: 'MSHID', type: 'Hệ số ca Sáng', coefficient: 0.5 }, { id: 'ASHID', type: 'Hệ số ca Chiều', coefficient: 0.5 },
  { id: 'KP', type: 'Nghỉ không lương không xin phép', coefficient: -2 }, { id: 'P', type: 'Nghỉ không lương có xin phép', coefficient: 0 },
  { id: 'PN', type: 'Nghỉ phép năm', coefficient: 1 }, { id: 'TC', type: 'Chủ nhật', coefficient: 2 }, { id: 'TCL', type: 'Lễ', coefficient: 3 },
];
const D = '2026-10-12';   // Thứ Hai
const log = (o: any = {}) => ({ empId: 'NV1', empName: 'A', date: D, timeInS: '', timeOutS: '', timeInC: '', timeOutC: '', status: 'valid', ...o });
const leave = (o: any = {}) => ({ id: 'L1', empId: 'NV1', empName: 'A', type: 'Nghỉ phép năm', status: 'approved', shift: 'morning', fromDate: D, toDate: D, ...o });
const calc = (l: any, leaves: any[]) => computeDailyWorkday(l, coefs, [], [0], leaves);
const chieu = { timeInC: '13:00', timeOutC: '17:00' }, sang = { timeInS: '07:30', timeOutS: '11:30' };

describe('Tính công — nghỉ phép theo ca', () => {
  it('nghỉ phép năm ca sáng + làm ca chiều = 0,5 + 0,5 = 1 công', () => {
    const r = calc(log(chieu), [leave()]);
    expect(r.workday).toBe(1); expect(r.details).toContain('ca sáng'); expect(r.details).toContain('làm ca chiều');
  });
  it('nghỉ phép năm ca chiều + làm ca sáng = 1 công', () => {
    expect(calc(log(sang), [leave({ shift: 'afternoon' })]).workday).toBe(1);
  });
  it('nghỉ phép năm ca sáng, ca chiều không chấm → chỉ 0,5 (không phạt ca chiều)', () => {
    expect(calc(log(), [leave()]).workday).toBe(0.5);
  });
  it('nghỉ không lương có xin phép (hệ số 0) ca sáng + làm chiều = 0,5', () => {
    expect(calc(log(chieu), [leave({ type: 'Nghỉ không lương có xin phép' })]).workday).toBe(0.5);
  });
  it('hai đơn nghỉ 2 ca (sáng + chiều) cùng ngày = nghỉ phép năm cả ngày = 1 công', () => {
    expect(calc(log(), [leave(), leave({ id: 'L2', shift: 'afternoon' })]).workday).toBe(1);
  });
  it('đơn đang chờ hoặc bị từ chối, của người khác, hoặc ngày khác → không ảnh hưởng (làm ca chiều = 0,5)', () => {
    for (const o of [{ status: 'pending' }, { status: 'rejected' }, { empId: 'NV2', empName: 'B' }, { fromDate: '2026-10-13', toDate: '2026-10-13' }]) {
      expect(calc(log(chieu), [leave(o)]).workday).toBe(0.5);
    }
  });
  it('"Báo cáo nghỉ ca" có shift KHÔNG bị coi là nghỉ phép theo ca', () => {
    expect(calc(log(), [leave({ type: 'Báo cáo nghỉ ca' })]).workday).toBe(-2);   // vẫn đi theo luật báo cáo (chưa đủ 2 ca → KP)
  });
  it('nghỉ phép năm CẢ NGÀY (không có shift) vẫn +1 như cũ, và đè lên giờ chấm', () => {
    expect(calc(log(chieu), [leave({ shift: undefined })]).workday).toBe(1);
  });
  it('cả ngày không chấm, không có đơn → vẫn KP', () => { expect(calc(log(), []).workday).toBe(-2); });
});
