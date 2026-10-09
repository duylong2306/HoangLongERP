import { describe, it, expect } from 'vitest';
import { normalizeText, matchesQuery, rangeOf, inRange, pageInfo, paginate, buildSubcontractorRows } from '../directorViews';
import { employeeTodayStates, workedDaysByEmployee } from '../executiveDashboard';

const TODAY = '2026-10-09';

describe('Tìm kiếm không dấu', () => {
  it('bỏ dấu, đ→d, không phân biệt hoa thường', () => {
    expect(normalizeText('Nguyễn Đức Đồng')).toBe('nguyen duc dong');
  });
  it('khớp bất kỳ trường nào; chuỗi rỗng khớp tất cả; trường rỗng không lỗi', () => {
    expect(matchesQuery('nguyen', 'Cty A', 'Nguyễn Văn B')).toBe(true);
    expect(matchesQuery('dong', undefined, 'Đồng Nai')).toBe(true);
    expect(matchesQuery('', 'x')).toBe(true);
    expect(matchesQuery('zzz', 'abc', null, 12)).toBe(false);
  });
});

describe('Khoảng ngày', () => {
  it('các mốc nhanh', () => {
    expect(rangeOf('today', TODAY)).toEqual({ from: TODAY, to: TODAY });
    expect(rangeOf('7d', TODAY)).toEqual({ from: '2026-10-03', to: TODAY });
    expect(rangeOf('30d', TODAY)).toEqual({ from: '2026-09-10', to: TODAY });
    expect(rangeOf('month', TODAY)).toEqual({ from: '2026-10-01', to: TODAY });
    expect(rangeOf('all', TODAY)).toEqual({ from: '', to: '' });
    expect(rangeOf('custom', TODAY, '2026-01-02', '2026-01-31')).toEqual({ from: '2026-01-02', to: '2026-01-31' });
  });
  it('inRange: gồm cả hai đầu; ngày rỗng chỉ khớp khi không giới hạn', () => {
    const r = rangeOf('7d', TODAY);
    expect(inRange('2026-10-03', r)).toBe(true);
    expect(inRange('2026-10-02', r)).toBe(false);
    expect(inRange(`${TODAY}T23:00:00`, r)).toBe(true);
    expect(inRange('', r)).toBe(false);
    expect(inRange('', rangeOf('all', TODAY))).toBe(true);
    expect(inRange('2026-10-20', { from: '', to: TODAY })).toBe(false); // chỉ chặn trên
  });
});

describe('Phân trang', () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1);
  it('thông tin trang và cắt đúng dòng', () => {
    expect(pageInfo(25, 1, 10)).toMatchObject({ page: 1, totalPages: 3, from: 1, to: 10 });
    expect(pageInfo(25, 3, 10)).toMatchObject({ from: 21, to: 25 });
    expect(paginate(items, 2, 10)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(paginate(items, 3, 10)).toHaveLength(5);
  });
  it('trang quá lớn (do lọc thu hẹp) kéo về trang cuối; danh sách rỗng', () => {
    expect(pageInfo(5, 9, 10).page).toBe(1);
    expect(paginate(items, 99, 10)).toEqual([21, 22, 23, 24, 25]);
    expect(pageInfo(0, 1, 10)).toMatchObject({ total: 0, from: 0, to: 0, totalPages: 1 });
  });
});

describe('Nhân sự hôm nay — từng người', () => {
  const emps = [{ id: 'A' }, { id: 'B' }, { id: 'C' }] as any;
  it('đã chấm công / nghỉ có phép / chưa chấm công', () => {
    const m = employeeTodayStates(emps,
      [{ empId: 'A', date: TODAY, status: 'working' }, { empId: 'B', date: TODAY, status: 'missing' }],
      [{ empId: 'B', status: 'approved', fromDate: TODAY, toDate: TODAY }, { empId: 'C', status: 'pending', fromDate: TODAY, toDate: TODAY }], TODAY);
    expect(m.get('A')).toBe('present');
    expect(m.get('B')).toBe('leave');
    expect(m.get('C')).toBe('missing');
  });
  it('số ngày công trong tháng: mỗi ngày tính 1, bỏ ngày vắng', () => {
    const w = workedDaysByEmployee([
      { empId: 'A', date: '2026-10-01', status: 'working' }, { empId: 'A', date: '2026-10-01', status: 'working' }, { empId: 'A', date: '2026-10-02', status: 'present' },
      { empId: 'A', date: '2026-10-03', status: 'missing' }, { empId: 'B', date: '2026-10-01', status: 'unexcused' },
    ]);
    expect(w.get('A')).toBe(2);
    expect(w.get('B')).toBeUndefined();
  });
});

describe('Thầu phụ — tổng hợp từng thầu phụ', () => {
  it('chỉ tính hợp đồng đã duyệt, phiếu chi đã duyệt; còn phải chi không âm', () => {
    const rows = buildSubcontractorRows(
      [{ id: 'S1', name: 'Tổ A', debt: 5 }, { id: 'S2', name: 'Tổ B' }],
      [
        { subcontractorId: 'S1', isApproved: true, contractValue: 1000, projectId: 'P1' },
        { subcontractorId: 'S1', isApproved: true, totalAmount: 500, projectId: 'P2' },
        { subcontractorId: 'S1', isApproved: false, contractValue: 9999, projectId: 'P3' },
        { subcontractorId: 'S2', isApproved: true, contractValue: 100, projectId: 'P1' },
      ],
      [
        { subcontractorId: 'S1', status: 'approved', amount: 400 }, { subcontractorId: 'S1', status: 'pending', amount: 50 },
        { subcontractorId: 'S2', status: 'approved', amount: 300 },
      ],
      [{ subcontractorId: 'S1', status: 'pending_approval' }, { subcontractorId: 'S1', status: 'completed' }]);
    const a = rows[0], b = rows[1];
    expect(a.contracts).toBe(3); expect(a.approvedContracts).toBe(2);
    expect(a.contractValue).toBe(1500); expect(a.paid).toBe(400); expect(a.pendingPaid).toBe(50);
    expect(a.remaining).toBe(1100); expect(a.debt).toBe(5);
    expect(a.projectIds.sort()).toEqual(['P1', 'P2', 'P3']);
    expect(a.pendingProposals).toBe(1);
    expect(b.remaining).toBe(0); // chi 300 > hợp đồng 100 → không âm
  });
});
