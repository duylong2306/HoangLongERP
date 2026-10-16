import { describe, it, expect } from 'vitest';
import { buildProjectCosts, describeProjectCost } from '../projectCost';

const pay = (o: any) => ({ id: Math.random().toString(36), status: 'approved', category: 'material', amount: 0, ...o }) as any;
const run = (inp: Partial<Parameters<typeof buildProjectCosts>[1]>, ids = ['P1']) =>
  buildProjectCosts(ids, { payments: [], orders: [], advances: [], contracts: [], ...inp } as any);

describe('buildProjectCosts — Tổng chi phí = Đã chi + Còn phải chi', () => {
  it('đã chi = phiếu đã duyệt gắn công trình, bỏ nạp quỹ và phiếu công trình khác', () => {
    const c = run({ payments: [pay({ projectId: 'P1', amount: 100 }), pay({ projectId: 'P1', amount: 50, category: 'cash_fund' }), pay({ projectId: 'P2', amount: 999 }), pay({ projectId: 'P1', amount: 7, status: 'rejected' })] }).get('P1')!;
    expect(c.spent).toBe(100);
    expect(c.remaining).toBe(0);
    expect(c.total).toBe(100);
  });
  it('phiếu chi chờ duyệt → còn phải chi', () => {
    const c = run({ payments: [pay({ projectId: 'P1', amount: 100 }), pay({ projectId: 'P1', amount: 30, status: 'pending' })] }).get('P1')!;
    expect(c).toMatchObject({ spent: 100, paymentPending: 30, remaining: 30, total: 130 });
  });
  it('hợp đồng thầu phụ đã duyệt: còn phải trả = giá trị − đã chi cho thầu phụ đó tại công trình', () => {
    const c = run({
      contracts: [{ id: 'K1', projectId: 'P1', subcontractorId: 'TP1', subcontractorName: 'Minh', contractValue: 1000, isApproved: true }],
      payments: [pay({ projectId: 'P1', subcontractorId: 'TP1', category: 'subcontractor_advance', amount: 400 })],
    }).get('P1')!;
    expect(c).toMatchObject({ spent: 400, subcontractUnpaid: 600, remaining: 600, total: 1000 });   // tổng = đúng giá trị hợp đồng, không cộng đôi
  });
  it('thầu phụ: hợp đồng chưa duyệt không tính; trả vượt hợp đồng không âm; tiền trả NCC trùng tên không trừ', () => {
    const k = (o: any) => ({ id: 'K', projectId: 'P1', subcontractorId: 'TP1', subcontractorName: 'Minh', contractValue: 1000, ...o });
    expect(run({ contracts: [k({ isApproved: false })] }).get('P1')!.subcontractUnpaid).toBe(0);
    expect(run({ contracts: [k({ isApproved: true })], payments: [pay({ projectId: 'P1', subcontractorId: 'TP1', amount: 1500 })] }).get('P1')!.subcontractUnpaid).toBe(0);
    expect(run({ contracts: [k({ isApproved: true })], payments: [pay({ projectId: 'P1', recipient: 'Minh', category: 'supplier_payment', amount: 300 })] }).get('P1')!.subcontractUnpaid).toBe(1000);
  });
  it('thầu phụ: nhiều hợp đồng cùng thầu phụ cùng công trình được gộp; theo trạng thái "Hoàn thành" cũng là đã duyệt', () => {
    const c = run({ contracts: [
      { id: 'K1', projectId: 'P1', subcontractorId: 'TP1', contractValue: 600, isApproved: true },
      { id: 'K2', projectId: 'P1', subcontractorId: 'TP1', contractValue: 400, status: 'Hoàn thành' },
    ], payments: [pay({ projectId: 'P1', subcontractorId: 'TP1', amount: 250 })] }).get('P1')!;
    expect(c.subcontractUnpaid).toBe(750);
  });
  it('đơn mua hàng: lấy công nợ còn lại, bỏ nháp/hủy', () => {
    const c = run({ orders: [
      { projectId: 'P1', status: 'confirmed', tongTien: 500, thanhToanThucTe: 200, congNo: 300 },
      { projectId: 'P1', status: 'draft', tongTien: 900, thanhToanThucTe: 0, congNo: 900 },
      { projectId: 'P1', status: 'cancelled', tongTien: 800, congNo: 800 },
      { projectId: 'P2', status: 'confirmed', tongTien: 700, congNo: 700 },
    ] }).get('P1')!;
    expect(c.orderUnpaid).toBe(300);
  });
  it('đề xuất chi chờ duyệt/chờ lập phiếu chưa có phiếu → tính; đã có phiếu, nạp quỹ, đã hoàn thành → không tính', () => {
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
    expect(c.proposalPending).toBe(100 + 150);   // A1 + A2 (theo số duyệt); A6 đã có phiếu chờ duyệt nên tính ở phiếu, không tính đôi
    expect(c.paymentPending).toBe(600);
    expect(c.remaining).toBe(850);
  });
  it('công trình không có dữ liệu → toàn 0; tổng = đã chi + còn phải chi', () => {
    const c = run({}).get('P1')!;
    expect(c).toEqual({ spent: 0, subcontractUnpaid: 0, orderUnpaid: 0, proposalPending: 0, paymentPending: 0, remaining: 0, total: 0 });
    const d = run({ payments: [pay({ projectId: 'P1', amount: 10 })], orders: [{ projectId: 'P1', status: 'confirmed', congNo: 5 }] }).get('P1')!;
    expect(d.total).toBe(d.spent + d.remaining);
  });
  it('mô tả chi tiết liệt kê đủ 4 nhóm', () => {
    const t = describeProjectCost({ spent: 1, subcontractUnpaid: 2, orderUnpaid: 3, proposalPending: 4, paymentPending: 5, remaining: 14, total: 15 }, n => `${n}đ`);
    expect(t).toMatch(/Đã chi: 1đ/); expect(t).toMatch(/thầu phụ chưa trả: 2đ/); expect(t).toMatch(/Đơn mua hàng còn công nợ: 3đ/); expect(t).toMatch(/Đề xuất chờ duyệt.*4đ/); expect(t).toMatch(/Phiếu chi chờ duyệt: 5đ/);
  });
});
