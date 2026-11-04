import { describe, it, expect } from 'vitest';
import { isAttendanceReportType, isShiftCreditReport } from '../attendanceMeta';

describe('Loại báo cáo giải trình chấm công', () => {
  it('"Quên chấm công" là một loại giải trình chấm công (không bị coi là đơn nghỉ phép thật)', () => {
    expect(isAttendanceReportType('Báo cáo quên chấm công')).toBe(true);
  });
  it('quên chấm công và lỗi hệ thống đều tính công cho ca được báo cáo; nghỉ ca / lỗi chấm ra ca thì không', () => {
    expect(isShiftCreditReport('Báo cáo quên chấm công')).toBe(true);
    expect(isShiftCreditReport('Báo cáo lỗi hệ thống chấm công')).toBe(true);
    expect(isShiftCreditReport('Báo cáo nghỉ ca')).toBe(false);
    expect(isShiftCreditReport('Báo cáo lỗi chấm ra ca')).toBe(false);
    expect(isShiftCreditReport(undefined)).toBe(false);
  });
});
