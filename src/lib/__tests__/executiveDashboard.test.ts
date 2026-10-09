import { describe, it, expect } from 'vitest';
import {
  toDay, addDays, diffDays, bucketTasks, buildProjectFinance, sumFinance, cashflowByDay, spendByCategory, paymentsOfDay,
  materialByDay, proposalStatusCounts, supplierPayable, summarizeAttendance, buildAlerts,
} from '../executiveDashboard';

const TODAY = '2026-10-09';
const task = (o: any) => ({ id: o.id, name: o.id, status: 'todo', deadline: '', assigneeId: 'E1', ...o }) as any;
const proj = (o: any) => ({ id: 'P1', code: 'P1', name: 'Công trình 1', status: 'processing', contractValue: 1000, progress: 10, endDate: '2027-01-01', ...o }) as any;
const pay = (o: any) => ({ id: 'PAY' + Math.random(), code: 'PC', date: TODAY, category: 'material', amount: 100, status: 'approved', projectId: 'P1', ...o }) as any;
const rec = (o: any) => ({ id: 'R' + Math.random(), code: 'PT', date: TODAY, amount: 100, projectId: 'P1', ...o }) as any;

describe('Ngày tháng', () => {
  it('toDay hiểu YYYY-MM-DD, dd/mm/yyyy và ISO; rác → rỗng', () => {
    expect(toDay('2026-10-09')).toBe('2026-10-09');
    expect(toDay('9/10/2026')).toBe('2026-10-09');
    expect(toDay('09/10/2026 10:20')).toBe('2026-10-09');
    expect(toDay('xyz')).toBe('');
    expect(toDay(undefined)).toBe('');
  });
  it('addDays / diffDays qua ranh giới tháng', () => {
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(diffDays('2026-10-01', '2026-10-09')).toBe(8);
  });
});

describe('Phòng dự án — việc hôm nay / quá hạn / chưa làm', () => {
  const tasks = [
    task({ id: 'doing', status: 'doing', deadline: '2026-10-20' }),
    task({ id: 'dueToday', status: 'todo', deadline: '2026-10-09' }),
    task({ id: 'late3', status: 'doing', deadline: '2026-10-06' }),
    task({ id: 'late10', status: 'todo', deadline: '2026-09-29' }),
    task({ id: 'todo', status: 'todo', deadline: '2026-11-01' }),
    task({ id: 'review', status: 'reviewing', deadline: '2026-10-30' }),
    task({ id: 'done', status: 'completed', deadline: '2026-09-01' }),
    task({ id: 'flag', status: 'overdue', deadline: '' }),
  ];
  const b = bucketTasks(tasks, TODAY);
  it('quá hạn: chưa xong và hạn < hôm nay, trễ nhiều nhất lên đầu; việc đã xong không tính', () => {
    expect(b.overdue.map(t => t.id)).toEqual(['late10', 'late3', 'flag']);
    expect(b.overdue[0].daysLate).toBe(10);
  });
  it('đến hạn hôm nay không lẫn vào quá hạn; chưa làm không gồm việc quá hạn', () => {
    expect(b.dueToday.map(t => t.id)).toEqual(['dueToday']);
    expect(b.todo.map(t => t.id)).toEqual(['dueToday', 'todo']);
  });
  it('đang làm và chờ duyệt', () => {
    expect(b.doing.map(t => t.id).sort()).toEqual(['doing', 'late3']);
    expect(b.reviewing.map(t => t.id)).toEqual(['review']);
  });
});

describe('Tài chính từng công trình', () => {
  it('đã chi chỉ tính phiếu ĐÃ DUYỆT, loại nạp quỹ; chi chờ duyệt tách riêng', () => {
    const rows = buildProjectFinance([proj({})], [rec({ amount: 600 })], [
      pay({ amount: 300 }), pay({ amount: 50, status: 'pending' }), pay({ amount: 999, category: 'cash_fund' }), pay({ amount: 70, status: 'rejected' }),
    ], TODAY);
    expect(rows[0].spent).toBe(300);
    expect(rows[0].pendingSpent).toBe(50);
    expect(rows[0].collected).toBe(600);
    expect(rows[0].spentPct).toBe(30);
    expect(rows[0].cashMargin).toBe(300);
    expect(rows[0].receivable).toBe(400);
    expect(rows[0].flags).toEqual([]);
  });
  it('cờ cảnh báo: vượt hợp đồng, sắp hết ngân sách, chi > thu, trễ tiến độ, chưa có giá trị HĐ', () => {
    const rows = buildProjectFinance([
      proj({ id: 'A', contractValue: 1000 }), proj({ id: 'B', contractValue: 1000 }), proj({ id: 'C', contractValue: 1000, endDate: '2026-09-01' }), proj({ id: 'D', contractValue: 0 }),
    ], [rec({ projectId: 'B', amount: 100 })], [
      pay({ projectId: 'A', amount: 1200 }), pay({ projectId: 'B', amount: 850 }), pay({ projectId: 'D', amount: 10 }),
    ], TODAY);
    const f = (id: string) => rows.find(r => r.project.id === id)!.flags;
    expect(f('A')).toContain('overBudget');
    expect(f('B')).toContain('nearBudget');
    expect(f('B')).toContain('loss');
    expect(f('C')).toContain('late');
    expect(f('D')).toContain('noContract');
  });
  it('công trình đã hủy không tính; sắp theo chi nhiều nhất; tổng cộng đúng', () => {
    const rows = buildProjectFinance([proj({ id: 'A' }), proj({ id: 'B', status: 'cancelled' }), proj({ id: 'C' })], [rec({ projectId: 'A', amount: 200 })], [pay({ projectId: 'C', amount: 500 }), pay({ projectId: 'A', amount: 100 })], TODAY);
    expect(rows.map(r => r.project.id)).toEqual(['C', 'A']);
    const t = sumFinance(rows);
    expect(t.contractValue).toBe(2000);
    expect(t.spent).toBe(600);
    expect(t.collected).toBe(200);
    expect(t.cashMargin).toBe(-400);
  });
});

describe('Dòng tiền & cơ cấu chi', () => {
  it('14 ngày, thu/chi đúng ngày, chi chỉ tính phiếu đã duyệt', () => {
    const f = cashflowByDay([rec({ date: TODAY, amount: 50 }), rec({ date: '2026-10-08', amount: 20 }), rec({ date: '2026-01-01', amount: 999 })],
      [pay({ date: TODAY, amount: 30 }), pay({ date: TODAY, amount: 99, status: 'pending' })], TODAY, 14);
    expect(f).toHaveLength(14);
    expect(f[13]).toMatchObject({ day: TODAY, income: 50, expense: 30 });
    expect(f[12]).toMatchObject({ income: 20, expense: 0 });
  });
  it('cơ cấu chi theo hạng mục, lớn → nhỏ, phần trăm cộng ≈ 100', () => {
    const c = spendByCategory([pay({ category: 'material', amount: 300 }), pay({ category: 'labor', amount: 700 }), pay({ category: 'labor', amount: 5, status: 'pending' })]);
    expect(c.map(x => x.key)).toEqual(['labor', 'material']);
    expect(c[0].pct).toBe(70);
  });
  it('chi hôm nay không gồm phiếu từ chối và nạp quỹ', () => {
    const l = paymentsOfDay([pay({}), pay({ status: 'rejected' }), pay({ category: 'cash_fund' }), pay({ date: '2026-10-01' })], TODAY);
    expect(l).toHaveLength(1);
  });
});

describe('Vật tư — số đơn theo ngày', () => {
  it('đếm đơn mua (bỏ nháp/hủy) và đề xuất theo ngày tạo (giờ địa phương)', () => {
    const d = materialByDay(
      [{ status: 'confirmed', createdAt: `${TODAY}T01:00:00` }, { status: 'draft', createdAt: TODAY }, { status: 'cancelled', createdAt: TODAY }, { status: 'completed', createdAt: '2026-10-08' }],
      [{ status: 'waiting_order', createdAt: `${TODAY}T08:00:00` }, { status: 'cancelled', createdAt: TODAY }], TODAY, 7);
    expect(d).toHaveLength(7);
    expect(d[6]).toMatchObject({ orders: 1, proposals: 1 });
    expect(d[5]).toMatchObject({ orders: 1, proposals: 0 });
  });
  it('đếm đề xuất theo trạng thái và công nợ nhà cung cấp (bỏ đơn từ kho / nháp)', () => {
    const s = proposalStatusCounts([{ status: 'find_supplier' }, { status: 'find_supplier' }, { status: 'received' }]);
    expect(s.find(x => x.key === 'find_supplier')!.count).toBe(2);
    expect(supplierPayable([{ status: 'confirmed', congNo: 100 }, { status: 'completed', congNo: 50 }, { status: 'draft', congNo: 999 }, { status: 'confirmed', congNo: 70, fromWarehouse: true }])).toBe(150);
  });
});

describe('Nhân sự — chấm công hôm nay', () => {
  const emps = [
    { id: 'A', name: 'An', status: 'working' }, { id: 'B', name: 'Bình', status: 'working' }, { id: 'C', name: 'Cường' }, { id: 'D', name: 'Dũng', status: 'retired' }, { id: 'E', name: 'Em', status: 'director_board' },
  ] as any;
  it('quân số, có mặt, nghỉ có phép, chưa chấm công — loại nghỉ việc và ban giám đốc', () => {
    const s = summarizeAttendance(emps,
      [{ empId: 'A', date: TODAY, status: 'working' }, { empId: 'B', date: TODAY, status: 'missing' }, { empId: 'D', date: TODAY, status: 'working' }],
      [{ empId: 'C', status: 'approved', fromDate: '2026-10-08', toDate: '2026-10-10' }, { empId: 'B', status: 'pending', fromDate: TODAY, toDate: TODAY }], TODAY);
    expect(s.expected).toBe(3);
    expect(s.present).toBe(1);
    expect(s.onLeave).toBe(1);
    expect(s.notChecked).toBe(1);
    expect(s.notCheckedNames).toEqual(['Bình']);
    expect(s.presentRate).toBe(33);
    expect(s.pendingLeaves).toBe(1);
  });
});

describe('Cảnh báo Giám đốc', () => {
  it('xếp nghiêm trọng trước; chỉ cảnh báo chưa chấm công sau 9h', () => {
    const rows = buildProjectFinance([proj({ id: 'A', contractValue: 1000 })], [], [pay({ projectId: 'A', amount: 1500 })], TODAY);
    const att = summarizeAttendance([{ id: 'X', name: 'X', status: 'working' }] as any, [], [], TODAY);
    const b = bucketTasks([task({ id: 'L', status: 'todo', deadline: '2026-10-01' })], TODAY);
    const sang = buildAlerts({ rows, buckets: b, attendance: att, pendingPayments: 2, pendingPaymentAmount: 10, hour: 8 });
    const trua = buildAlerts({ rows, buckets: b, attendance: att, pendingPayments: 2, pendingPaymentAmount: 10, hour: 10 });
    expect(sang[0].level).toBe('danger');
    expect(sang.some(a => a.text.includes('chưa chấm công'))).toBe(false);
    expect(trua.some(a => a.text.includes('chưa chấm công'))).toBe(true);
    expect(trua.some(a => a.text.includes('phiếu chi chờ duyệt'))).toBe(true);
  });
});
