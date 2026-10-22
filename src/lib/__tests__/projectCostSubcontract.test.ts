import { describe, it, expect } from 'vitest';
import { buildProjectCosts, buildProjectCostItems, COST_GROUPS, type CostInputs } from '../projectCost';

// Tiền trả thầu phụ lập bằng đề xuất "Chi phí công trình" (category site_expense) không được tính ĐÔI với hợp đồng thầu phụ.
// Mô phỏng đúng dữ liệu thật: NGUYỄN VĂN HÒA — hợp đồng 130tr; 1 phiếu tạm ứng thầu phụ 30tr + 3 phiếu "chi phí công trình" (16tr, 19tr, 55tr).
const pay = (o: any) => ({ id: 'p' + Math.random().toString(36).slice(2, 7), status: 'approved', category: 'other', paymentMethod: 'transfer', amount: 0, projectId: 'P1', ...o }) as any;
const T1 = 'TP_IMP_1';
const base = (over: Partial<CostInputs> = {}): CostInputs => ({
  orders: [], advances: [
    { id: 'DX-1', projectId: 'P1', status: 'completed', type: 'project_expense_proposal', subcontractorId: T1, amount: 16e6 },
    { id: 'DX-2', projectId: 'P1', status: 'completed', type: 'project_expense_proposal', subcontractorId: T1, amount: 19e6 },
    { id: 'DX-3', projectId: 'P1', status: 'completed', type: 'project_expense_proposal', subcontractorId: T1, amount: 50e6 },
  ],
  payments: [
    pay({ amount: 30e6, category: 'subcontractor_advance', subcontractorId: T1, recipient: 'NGUYỄN VĂN HÒA' }),
    pay({ amount: 16e6, category: 'site_expense', subcontractorId: T1, recipient: 'NGUYỄN VĂN HÒA', relatedAdvanceId: 'DX-1' }),   // chỉ phiếu này có mã thầu phụ
    pay({ amount: 19e6, category: 'site_expense', recipient: 'NGUYỄN VĂN HÒA', relatedAdvanceId: 'DX-2' }),                          // mã chỉ nằm ở đề xuất gốc
    pay({ amount: 55e6, category: 'site_expense', recipient: 'NGUYỄN VĂN HÒA', relatedAdvanceId: 'DX-3' }),
    pay({ amount: 5e6, category: 'site_expense', recipient: 'Thợ điện nước' }),                                                      // chi công trường thật
  ],
  contracts: [{ id: 'K1', projectId: 'P1', isApproved: true, subcontractorId: T1, subcontractorName: 'NGUYỄN VĂN HÒA', contractValue: 130e6 }], ...over,
});

describe('Phiếu chi trả thầu phụ lập qua đề xuất "Chi phí công trình"', () => {
  const c = buildProjectCosts(['P1'], base()).get('P1')!;
  it('xếp vào THẦU PHỤ và trừ vào hợp đồng: thầu phụ = đúng giá trị hợp đồng 130tr, không cộng đôi', () => {
    expect(c.subcontract).toBe(130e6);          // 120tr đã trả (30+16+19+55) + 10tr hợp đồng còn lại
    expect(c.site).toBe(5e6);                    // chỉ còn khoản chi công trường thật
    expect(c.total).toBe(135e6); expect(c.paid).toBe(125e6); expect(c.remaining).toBe(10e6);
  });
  it('danh sách khoản chi tiết cộng ra đúng từng nhóm (và có đúng 4 phiếu + 1 dòng hợp đồng còn lại trong Thầu phụ)', () => {
    const items = buildProjectCostItems('P1', base());
    for (const g of COST_GROUPS) expect(items.filter(i => i.group === g.key).reduce((s, i) => s + i.amount, 0)).toBe((c as any)[g.key]);
    expect(items.filter(i => i.group === 'subcontract')).toHaveLength(5);
    expect(items.filter(i => i.group === 'site').map(i => i.amount)).toEqual([5e6]);
  });
  it('nhận theo MÃ: người nhận trùng TÊN nhưng khác mã thầu phụ → KHÔNG bị tính vào hợp đồng đó', () => {
    const inp = base({ payments: [pay({ amount: 10e6, category: 'site_expense', recipient: 'NGUYỄN VĂN HÒA', subcontractorId: 'KHAC' })] });
    const r = buildProjectCosts(['P1'], inp).get('P1')!;
    expect(r.site).toBe(10e6); expect(r.subcontract).toBe(130e6);   // hợp đồng vẫn tính đủ vì chưa trả khoản nào của đúng thầu phụ
  });
  it('thầu phụ KHÔNG có hợp đồng đã duyệt ở công trình → phiếu site_expense giữ nguyên là chi công trường', () => {
    const r = buildProjectCosts(['P1'], base({ contracts: [] })).get('P1')!;
    expect(r.site).toBe(95e6); expect(r.subcontract).toBe(30e6);    // 16+19+55+5 ; chỉ phiếu tạm ứng thầu phụ
  });
  it('hợp đồng chỉ có tên (không có mã) + phiếu không có mã nào → khớp theo tên CHÍNH XÁC; hợp đồng chưa duyệt không ảnh hưởng', () => {
    const noId = base({ advances: [], contracts: [{ id: 'K2', projectId: 'P1', isApproved: true, subcontractorName: 'ĐỘI A', contractValue: 50e6 }], payments: [pay({ amount: 20e6, category: 'site_expense', recipient: 'ĐỘI A' })] });
    const r = buildProjectCosts(['P1'], noId).get('P1')!; expect(r).toMatchObject({ site: 0, subcontract: 50e6 });
    const draft = base({ advances: [], contracts: [{ id: 'K3', projectId: 'P1', isApproved: false, subcontractorId: T1, contractValue: 99e6 }], payments: [pay({ amount: 20e6, category: 'site_expense', subcontractorId: T1 })] });
    expect(buildProjectCosts(['P1'], draft).get('P1')!).toMatchObject({ site: 20e6, subcontract: 0 });
  });
  it('trả vượt giá trị hợp đồng → không âm, thầu phụ = số đã trả', () => {
    const over = base({ payments: [pay({ amount: 150e6, category: 'site_expense', subcontractorId: T1 })] });
    expect(buildProjectCosts(['P1'], over).get('P1')!).toMatchObject({ subcontract: 150e6, site: 0 });
  });
});

// Đơn mua hàng sinh từ đề xuất vật tư ĐÃ HỦY (hủy đề xuất không tự hủy đơn) không được tính vào chi phí.
describe('Đơn mua hàng của đề xuất vật tư đã hủy', () => {
  const order = (o: any) => ({ id: 'o' + Math.random().toString(36).slice(2, 6), projectId: 'P1', status: 'confirmed', supplierId: 'S1', supplierName: 'NCC', tongTien: 0, thanhToanThucTe: 0, ...o });
  const inp = (orders: any[], proposals: any[], payments: any[] = []): CostInputs => ({ orders, proposals, payments, advances: [], contracts: [] });
  it('đơn đang đặt (confirmed) mà đề xuất nguồn đã hủy → bỏ khỏi chi phí (đúng ca PO-1792111437560-0: 2.187.550đ)', () => {
    const o = [order({ id: 'PO-A', tongTien: 2187550, proposalId: 'MP1' }), order({ id: 'PO-B', tongTien: 1837360, proposalId: 'MP2' })];
    const props = [{ id: 'MP1', status: 'cancelled' }, { id: 'MP2', status: 'received' }];
    const c = buildProjectCosts(['P1'], inp(o, props)).get('P1')!;
    expect(c.material).toBe(1837360);
    expect(buildProjectCostItems('P1', inp(o, props)).map(i => i.id)).toEqual(['o:PO-B']);
  });
  it('đơn đã HOÀN TẤT (đã nhập hàng) vẫn tính dù đề xuất bị hủy sau đó; đơn không có đề xuất / đề xuất còn hiệu lực không bị ảnh hưởng', () => {
    const o = [order({ id: 'PO-C', tongTien: 11e6, proposalId: 'MP1', status: 'completed' }), order({ id: 'PO-D', tongTien: 5e6 }), order({ id: 'PO-E', tongTien: 7e6, proposalId: 'MP3' })];
    const c = buildProjectCosts(['P1'], inp(o, [{ id: 'MP1', status: 'cancelled' }, { id: 'MP3', status: 'ordered' }])).get('P1')!;
    expect(c.material).toBe(23e6);
  });
  it('tiền ĐÃ trả cho đơn bị bỏ vẫn tính (qua phiếu chi), không bị mất', () => {
    const o = [order({ id: 'PO-F', tongTien: 4e6, thanhToanThucTe: 1e6, proposalId: 'MP1' })];
    const pays = [{ id: 'pp', projectId: 'P1', status: 'approved', category: 'supplier_payment', amount: 1e6, purchaseOrderId: 'PO-F', paymentMethod: 'transfer' }];
    const c = buildProjectCosts(['P1'], inp(o, [{ id: 'MP1', status: 'cancelled' }], pays)).get('P1')!;
    expect(c).toMatchObject({ material: 0, other: 1e6, paid: 1e6 });
  });
  it('không truyền danh sách đề xuất → hành vi cũ (không loại đơn nào)', () => {
    const c = buildProjectCosts(['P1'], { orders: [order({ tongTien: 3e6, proposalId: 'MP1' })], payments: [], advances: [], contracts: [] }).get('P1')!;
    expect(c.material).toBe(3e6);
  });
});
