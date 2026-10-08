import { describe, it, expect } from 'vitest';
import { evaluateLeaveNotice, normalizeAdvanceDays, formatDays, tagLateNoticeReason, parseLateNotice, isRealLeaveType, leaveStartMoment } from '../leaveNotice';

const at = (s: string) => new Date(s);   // giờ địa phương, VD '2026-10-09T07:30:00'

describe('Xin nghỉ phép báo trước — tính thời gian', () => {
  it('nghỉ 10/10 vào ca 07:30, quy định 1 ngày: nộp 09/10 07:00 → muộn; nộp 09/10 07:30 → vừa đủ; nộp 08/10 → đủ', () => {
    const base = { fromDate: '2026-10-10', morningIn: '07:30', requiredDays: 1 };
    expect(evaluateLeaveNotice({ ...base, now: at('2026-10-09T07:31:00') }).late).toBe(true);
    expect(evaluateLeaveNotice({ ...base, now: at('2026-10-09T07:30:00') }).late).toBe(false);
    expect(evaluateLeaveNotice({ ...base, now: at('2026-10-08T15:00:00') }).late).toBe(false);
  });
  it('số ngày thập phân: 0,5 ngày = 12 giờ', () => {
    const base = { fromDate: '2026-10-10', morningIn: '07:30', requiredDays: 0.5 };
    expect(evaluateLeaveNotice({ ...base, now: at('2026-10-09T19:30:00') }).late).toBe(false);   // đúng 12 giờ
    expect(evaluateLeaveNotice({ ...base, now: at('2026-10-09T19:31:00') }).late).toBe(true);    // thiếu 1 phút
  });
  it('giờ vào ca lấy theo cấu hình (vào ca 08:00 thì hạn là 08:00)', () => {
    expect(evaluateLeaveNotice({ fromDate: '2026-10-10', morningIn: '08:00', requiredDays: 1, now: at('2026-10-09T07:45:00') }).late).toBe(false);
  });
  it('nộp sau khi đã bắt đầu nghỉ → báo trước âm, muộn', () => {
    const r = evaluateLeaveNotice({ fromDate: '2026-10-05', morningIn: '07:30', requiredDays: 1, now: at('2026-10-06T10:00:00') });
    expect(r.late).toBe(true); expect(r.advanceDays).toBeLessThan(0);
  });
  it('quy định 0 ngày = không yêu cầu báo trước (không bao giờ muộn)', () => {
    expect(evaluateLeaveNotice({ fromDate: '2026-10-05', morningIn: '07:30', requiredDays: 0, now: at('2026-10-06T10:00:00') }).late).toBe(false);
  });
  it('cấu hình thiếu/sai → mặc định 1 ngày; chấp nhận "0,5" kiểu Việt', () => {
    expect(normalizeAdvanceDays(undefined)).toBe(1); expect(normalizeAdvanceDays('abc')).toBe(1); expect(normalizeAdvanceDays(-3)).toBe(1);
    expect(normalizeAdvanceDays('0,5')).toBe(0.5); expect(normalizeAdvanceDays(0)).toBe(0); expect(normalizeAdvanceDays(2)).toBe(2);
  });
  it('giờ vào ca sai định dạng → dùng 07:30', () => {
    expect(leaveStartMoment('2026-10-10', 'x').getHours()).toBe(7);
  });
});

describe('Xin muộn — đánh dấu & loại đơn', () => {
  it('định dạng số ngày kiểu Việt', () => { expect(formatDays(1)).toBe('1'); expect(formatDays(0.5)).toBe('0,5'); expect(formatDays(0.333)).toBe('0,33'); });
  it('gắn dấu vào lý do rồi đọc lại được, không lẫn lý do gốc', () => {
    const t = tagLateNoticeReason('Em bị ốm', { late: true, advanceDays: 0.3, requiredDays: 1 });
    expect(t).toBe('[XIN MUỘN: báo trước 0,3 ngày, quy định 1 ngày] Em bị ốm');
    expect(parseLateNotice(t)).toEqual({ late: true, detail: 'báo trước 0,3 ngày, quy định 1 ngày', reason: 'Em bị ốm' });
    expect(tagLateNoticeReason('x', { late: true, advanceDays: -1, requiredDays: 1 })).toContain('đã quá hạn');
  });
  it('lý do thường không bị coi là xin muộn', () => {
    expect(parseLateNotice('Công việc gia đình')).toEqual({ late: false, detail: '', reason: 'Công việc gia đình' });
    expect(parseLateNotice(undefined).late).toBe(false);
  });
  it('chỉ đơn nghỉ phép thật chịu quy định; báo cáo chấm công thì không', () => {
    expect(isRealLeaveType('Nghỉ phép năm')).toBe(true); expect(isRealLeaveType('Nghỉ không lương có xin phép')).toBe(true);
    expect(isRealLeaveType('Báo cáo nghỉ ca')).toBe(false); expect(isRealLeaveType('Báo cáo lỗi chấm ra ca')).toBe(false);
    expect(isRealLeaveType('Yêu cầu xét duyệt công')).toBe(false);
  });
});
