import { describe, it, expect } from 'vitest';
import { buildProjectCosts, buildProjectCostItems, COST_GROUPS, type CostInputs } from '../projectCost';

// Chi tiết từng khoản PHẢI cộng ra đúng số ở bảng tổng chi phí (cùng quy tắc với buildProjectCosts).
const pay = (o: any) => ({ id: 'p' + Math.random().toString(36).slice(2, 7), status: 'approved', category: 'other', paymentMethod: 'transfer', amount: 0, projectId: 'P1', ...o }) as any;
const order = (o: any) => ({ id: 'o' + Math.random().toString(36).slice(2, 7), projectId: 'P1', status: 'confirmed', supplierId: 'S1', tongTien: 0, thanhToanThucTe: 0, ...o });
const inp: CostInputs = {
  orders: [order({ id: 'O1', tongTien: 500, thanhToanThucTe: 200, supplierName: 'NCC A' }), order({ tongTien: 400, supplierId: '__warehouse__' }), order({ tongTien: 900, status: 'draft' }), order({ tongTien: 50, projectId: 'P2' })],
  payments: [
    pay({ amount: 500, purchaseOrderId: 'O1' }),                         // trả cho đơn đã tính → không cộng lần nữa
    pay({ amount: 300, category: 'subcontractor_advance', recipient: 'Thầu B', subcontractorId: 'T1' }),
    pay({ amount: 120, category: 'site_expense', paymentMethod: 'cash' }),
    pay({ amount: 70 }), pay({ amount: 999, category: 'cash_fund' }),    // nạp quỹ → loại
    pay({ amount: 60, status: 'pending' }), pay({ amount: 5, status: 'rejected' }),
  ],
  advances: [{ id: 'A1', projectId: 'P1', status: 'pending_approval', amount: 80, creatorName: 'Ny', reason: 'Dầu xe' }, { id: 'A2', projectId: 'P1', status: 'pending_payment', amount: 40, paymentId: 'x' }],
  contracts: [{ id: 'K1', projectId: 'P1', isApproved: true, subcontractorId: 'T1', subcontractorName: 'Thầu B', contractValue: 1000 }],
};

describe('buildProjectCostItems', () => {
  const items = buildProjectCostItems('P1', inp); const cost = buildProjectCosts(['P1'], inp).get('P1')!;
  const sum = (g: string) => items.filter(i => i.group === g).reduce((s, i) => s + i.amount, 0);
  it('mỗi nhóm cộng ra đúng số của buildProjectCosts', () => {
    for (const g of COST_GROUPS) expect(sum(g.key)).toBe((cost as any)[g.key]);
    expect(items.reduce((s, i) => s + i.amount, 0)).toBe(cost.total);
  });
  it('đã chi cộng ra đúng số "Đã chi" (không tính nhóm chờ duyệt / phần hợp đồng chưa trả)', () => {
    expect(items.reduce((s, i) => s + i.paid, 0)).toBe(cost.paid);
  });
  it('phần hợp đồng thầu phụ chưa trả là 1 khoản riêng; đề xuất đã có phiếu và nạp quỹ không xuất hiện', () => {
    const left = items.find(i => i.id.startsWith('c:'))!; expect(left).toMatchObject({ group: 'subcontract', amount: 700, paid: 0, tag: 'Còn chưa trả' });
    expect(items.some(i => i.id === 'a:A2')).toBe(false); expect(items.some(i => i.amount === 999)).toBe(false);
  });
  it('khoản có nhãn đúng: tiền mặt, thanh toán một phần, chờ duyệt', () => {
    expect(items.find(i => i.amount === 120)!.tag).toBe('Tiền mặt');
    expect(items.find(i => i.id === 'o:O1')!.tag).toBe('Thanh toán một phần');
    expect(items.find(i => i.id === 'a:A1')!.tag).toBe('Chờ duyệt');
  });
  it('công trình không có khoản nào → danh sách rỗng', () => expect(buildProjectCostItems('P9', inp)).toEqual([]));
});
