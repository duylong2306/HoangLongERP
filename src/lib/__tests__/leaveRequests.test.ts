import { describe, it, expect } from 'vitest';
import { generateLeaveId, findPairedAbsenceReport, groupPendingAbsencePairs } from '../leaveRequests';

const rep = (id: string, shift: string, over: any = {}) => ({ id, type: 'Báo cáo nghỉ ca', status: 'pending', shift, empId: 'NV018', empName: 'Lê Văn Công', fromDate: '2026-10-05', toDate: '2026-10-05', ...over });

describe('Mã đơn không trùng', () => {
  it('không bao giờ trả về mã đã có', () => {
    const used = new Set(Array.from({ length: 900 }, (_, i) => `LR-${String(i).padStart(3, '0')}`));   // còn trống 900–999
    for (let i = 0; i < 200; i++) expect(used.has(generateLeaveId(used))).toBe(false);
  });
  it('hết chỗ 3 số thì sang mã 5 số, vẫn không trùng', () => {
    const used = new Set(Array.from({ length: 1000 }, (_, i) => `LR-${String(i).padStart(3, '0')}`));
    const id = generateLeaveId(used); expect(id).toMatch(/^LR-\d{5}$/); expect(used.has(id)).toBe(false);
  });
  it('mã trùng ngẫu nhiên lần đầu thì thử lại', () => {
    const seq = [0.123, 0.456]; let i = 0;
    expect(generateLeaveId(['LR-123'], () => seq[i++])).toBe('LR-456');
  });
});

describe('Cặp báo cáo nghỉ ca sáng + chiều', () => {
  it('tìm đúng đơn còn lại của cặp (từ ca sáng và từ ca chiều)', () => {
    const list = [rep('A', 'morning'), rep('B', 'afternoon')];
    expect(findPairedAbsenceReport(list[0], list)?.id).toBe('B');
    expect(findPairedAbsenceReport(list[1], list)?.id).toBe('A');
  });
  it('không ghép khi khác nhân viên / khác ngày / khác loại / không còn chờ duyệt', () => {
    const a = rep('A', 'morning');
    expect(findPairedAbsenceReport(a, [a, rep('B', 'afternoon', { empId: 'NV022', empName: 'Khác' })])).toBeNull();
    expect(findPairedAbsenceReport(a, [a, rep('B', 'afternoon', { fromDate: '2026-10-06', toDate: '2026-10-06' })])).toBeNull();
    expect(findPairedAbsenceReport(a, [a, rep('B', 'afternoon', { type: 'Báo cáo lỗi chấm ra ca' })])).toBeNull();
    expect(findPairedAbsenceReport(a, [a, rep('B', 'afternoon', { status: 'approved' })])).toBeNull();
    expect(findPairedAbsenceReport(a, [a, rep('B', 'morning')])).toBeNull();            // cùng ca → không phải cặp
  });
  it('đơn đã duyệt/từ chối, hoặc loại khác → không có cặp', () => {
    const list = [rep('A', 'morning', { status: 'approved' }), rep('B', 'afternoon', { status: 'approved' })];
    expect(findPairedAbsenceReport(list[0], list)).toBeNull();
    expect(findPairedAbsenceReport(undefined, list)).toBeNull();
  });
  it('gom danh sách: ẩn đơn ca chiều của cặp, đánh dấu cặp; đơn lẻ giữ nguyên', () => {
    const list = [rep('A', 'morning'), rep('B', 'afternoon'), rep('C', 'morning', { empId: 'NV022', empName: 'Khác' }), rep('D', 'afternoon', { fromDate: '2026-10-07', toDate: '2026-10-07' })];
    const { visible, pairOf } = groupPendingAbsencePairs(list);
    expect(visible.map(l => l.id)).toEqual(['A', 'C', 'D']);
    expect(pairOf.get('A')).toBe('B'); expect(pairOf.has('C')).toBe(false);
  });
  it('đơn ca chiều đứng TRƯỚC ca sáng trong danh sách vẫn gom đúng', () => {
    const { visible, pairOf } = groupPendingAbsencePairs([rep('B', 'afternoon'), rep('A', 'morning')]);
    expect(visible.map(l => l.id)).toEqual(['A']); expect(pairOf.get('A')).toBe('B');
  });
});
