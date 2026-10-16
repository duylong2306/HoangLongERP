import { describe, it, expect } from 'vitest';
import { buildProjectCosts, costBudgetFlags, describeProjectCost } from '../projectCost';

const pay = (o: any) => ({ id: Math.random().toString(36), status: 'approved', category: 'other', paymentMethod: 'transfer', amount: 0, ...o }) as any;
const run = (inp: Partial<Parameters<typeof buildProjectCosts>[1]>, ids = ['P1']) =>
  buildProjectCosts(ids, { payments: [], orders: [], advances: [], contracts: [], ...inp } as any);
const order = (o: any) => ({ id: Math.random().toString(36), projectId: 'P1', status: 'confirmed', supplierId: 'S1', tongTien: 0, thanhToanThucTe: 0, ...o });

describe('buildProjectCosts — 6 nhóm chi phí', () => {
  it('Vật tư: tổng tiền đơn mua hàng; đã chi = đã thanh toán; bỏ nháp/hủy/công trình khác/đơn nhập kho', () => {
    const c = run({ orders: [
      order({ tongTien: 500, thanhToanThucTe: 200 }),
      order({ tongTien: 900, status: 'draft' }),
      order({ tongTien: 800, status: 'cancelled' }),
      order({ tongTien: 700, projectId: 'P2' }),
      order({ tongTien: 600, projectId: '__warehouse_restock__' }),
    ] }).get('P1')!;
    expect(c).toMatchObject({ material: 500, paid: 200, total: 500, remaining: 300 });
  });
  it('Kho: đơn nội bộ xuất từ kho tính là chi phí đã chi (không công nợ)', () => {
    const c = run({ orders: [order({ supplierId: '__warehouse__', tongTien: 400 }), order({ fromWarehouse: true, supplierId: 'X', tongTien: 100 })] }).get('P1')!;
    expect(c).toMatchObject({ warehouse: 500, material: 0, paid: 500, remaining: 0 });
  });
  it('phiếu chi trả cho đơn mua hàng đã tính KHÔNG cộng lần nữa; phiếu gắn đơn không tính vẫn tính', () => {
    const o = order({ id: 'O1', tongTien: 500, thanhToanThucTe: 500 });
    const c = run({ orders: [o], payments: [pay({ projectId: 'P1', amount: 500, purchaseOrderId: 'O1', category: 'supplier_payment' }), pay({ projectId: 'P1', amount: 70, purchaseOrderId: 'KHONG-CO', category: 'supplier_payment' })] }).get('P1')!;
    expect(c).toMatchObject({ material: 500, other: 70, paid: 570, total: 570 });
  });
  it('Thầu phụ: đã chi + phần hợp đồng đã duyệt chưa trả (tổng = giá trị hợp đồng)', () => {
    const c = run({
      contracts: [{ id: 'K1', projectId: 'P1', subcontractorId: 'TP1', subcontractorName: 'Minh', contractValue: 1000, isApproved: true }],
      payments: [pay({ projectId: 'P1', subcontractorId: 'TP1', category: 'subcontractor_advance', amount: 400 })],
    }).get('P1')!;
    expect(c).toMatchObject({ subcontract: 1000, paid: 400, remaining: 600, total: 1000 });
  });
  it('Thầu phụ: hợp đồng chưa duyệt không tính; trả vượt hợp đồng thì tổng = số đã chi; có đã chi mà không có hợp đồng vẫn tính', () => {
    const k = (o: any) => ({ id: 'K', projectId: 'P1', subcontractorId: 'TP1', contractValue: 1000, ...o });
    expect(run({ contracts: [k({ isApproved: false })] }).get('P1')!.subcontract).toBe(0);
    expect(run({ contracts: [k({ isApproved: true })], payments: [pay({ projectId: 'P1', subcontractorId: 'TP1', category: 'subcontractor_advance', amount: 1500 })] }).get('P1')!.subcontract).toBe(1500);
    expect(run({ payments: [pay({ projectId: 'P1', category: 'subcontractor_advance', amount: 300 })] }).get('P1')!).toMatchObject({ subcontract: 300, paid: 300 });
  });
  it('Thầu phụ: nhiều hợp đồng cùng thầu phụ được gộp; "Hoàn thành" cũng là đã duyệt', () => {
    const c = run({ contracts: [
      { id: 'K1', projectId: 'P1', subcontractorId: 'TP1', contractValue: 600, isApproved: true },
      { id: 'K2', projectId: 'P1', subcontractorId: 'TP1', contractValue: 400, status: 'Hoàn thành' },
    ], payments: [pay({ projectId: 'P1', subcontractorId: 'TP1', category: 'subcontractor_advance', amount: 250 })] }).get('P1')!;
    expect(c.subcontract).toBe(1000);
    expect(c.remaining).toBe(750);
  });
  it('Chi phí công trường và Chi khác tách riêng; nạp quỹ và phiếu bị từ chối bị loại', () => {
    const c = run({ payments: [
      pay({ projectId: 'P1', category: 'site_expense', amount: 100 }),
      pay({ projectId: 'P1', category: 'other', amount: 40 }),
      pay({ projectId: 'P1', category: 'supplier_payment', amount: 10 }),
      pay({ projectId: 'P1', category: 'cash_fund', amount: 999 }),
      pay({ projectId: 'P1', category: 'other', amount: 7, status: 'rejected' }),
      pay({ projectId: 'P2', category: 'other', amount: 555 }),
    ] }).get('P1')!;
    expect(c).toMatchObject({ site: 100, other: 50, paid: 150, total: 150 });
  });
  it('Chờ duyệt: phiếu chờ duyệt + đề xuất chưa có phiếu; đề xuất đã có phiếu/nạp quỹ/hoàn thành không tính đôi', () => {
    const c = run({
      advances: [
        { id: 'A1', projectId: 'P1', status: 'pending_approval', amount: 100 },
        { id: 'A2', projectId: 'P1', status: 'pending_payment', amount: 200, approvedAmount: 150 },
        { id: 'A3', projectId: 'P1', status: 'pending_payment', amount: 300, paymentId: 'pay1' },
        { id: 'A4', projectId: 'P1', status: 'pending_approval', amount: 400, type: 'cash_fund_deposit' },
        { id: 'A5', projectId: 'P1', status: 'completed', amount: 500 },
        { id: 'A6', projectId: 'P1', status: 'pending_payment', amount: 600 },
      ],
      payments: [pay({ projectId: 'P1', status: 'pending', amount: 600, relatedAdvanceId: 'A6' })],
    }).get('P1')!;
    expect(c.pending).toBe(100 + 150 + 600);
    expect(c.paid).toBe(0);
    expect(c.remaining).toBe(850);
  });
  it('Trong đó tiền mặt: tiền mặt + rút từ quỹ (kể cả phiếu trả đơn), chỉ để tham khảo', () => {
    const o = order({ id: 'O1', tongTien: 300, thanhToanThucTe: 300 });
    const c = run({ orders: [o], payments: [
      pay({ projectId: 'P1', amount: 300, paymentMethod: 'cash', purchaseOrderId: 'O1', category: 'supplier_payment' }),
      pay({ projectId: 'P1', amount: 20, paymentMethod: 'cash_fund', category: 'site_expense' }),
      pay({ projectId: 'P1', amount: 50, paymentMethod: 'transfer', category: 'site_expense' }),
    ] }).get('P1')!;
    expect(c.cash).toBe(320);
    expect(c.total).toBe(370);   // 300 đơn + 70 công trường — tiền mặt không cộng thêm
  });
  it('tổng = cộng 6 nhóm; còn phải chi = tổng − đã chi; công trình trống toàn 0', () => {
    const c = run({
      orders: [order({ tongTien: 500, thanhToanThucTe: 100 }), order({ supplierId: '__warehouse__', tongTien: 50 })],
      payments: [pay({ projectId: 'P1', category: 'site_expense', amount: 10 }), pay({ projectId: 'P1', status: 'pending', amount: 5 })],
    }).get('P1')!;
    expect(c.total).toBe(c.material + c.warehouse + c.subcontract + c.site + c.other + c.pending);
    expect(c.remaining).toBe(c.total - c.paid);
    expect(run({}).get('P1')!).toEqual({ material: 0, warehouse: 0, subcontract: 0, site: 0, other: 0, pending: 0, paid: 0, total: 0, remaining: 0, cash: 0 });
  });
  it('mô tả chi tiết có đủ các nhóm', () => {
    const t = describeProjectCost({ material: 1, warehouse: 2, subcontract: 3, site: 4, other: 5, pending: 6, paid: 7, total: 21, remaining: 14, cash: 8 }, n => `${n}đ`);
    for (const x of ['Vật tư (đơn mua hàng): 1đ', 'Kho (xuất cho công trình): 2đ', 'Thầu phụ: 3đ', 'Chi phí công trường: 4đ', 'Chi khác: 5đ', 'Chờ duyệt: 6đ', 'Đã chi: 7đ', 'tiền mặt: 8đ', 'Còn phải chi: 14đ']) expect(t).toContain(x);
  });
});

describe('costBudgetFlags', () => {
  const c = (total: number, paid: number) => ({ material: 0, warehouse: 0, subcontract: 0, site: 0, other: 0, pending: 0, paid, total, remaining: total - paid, cash: 0 });
  it('vượt hợp đồng / gần 80% / chi thực > đã thu', () => {
    expect(costBudgetFlags(1000, 0, c(1100, 0))).toMatchObject({ over: true, risk: true });
    expect(costBudgetFlags(1000, 0, c(850, 0))).toMatchObject({ near: true, risk: false });
    expect(costBudgetFlags(1000, 100, c(500, 300))).toMatchObject({ loss: true, risk: true });
    expect(costBudgetFlags(0, 0, c(500, 500))).toMatchObject({ over: false, near: false, risk: false });   // chưa có giá trị hợp đồng: không cảnh báo vượt
  });
});
