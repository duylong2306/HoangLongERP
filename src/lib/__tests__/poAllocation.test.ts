import { describe, it, expect } from 'vitest';
import { getPoPayableRemaining, planPoAllocations, planPoRevert } from '../poAllocation';

// Sự cố 2026-10: phiếu chi sinh từ đề xuất "Chi Nhà Cung Cấp" (DX-20261001-0007: 97.362.500đ,
// DX-20261001-0006: 16.080.000đ = 2 đơn 10.720.000 + 5.360.000) không trừ vào đơn hàng nào →
// thanhToanThucTe/congNo của đơn không đổi. Các test này khóa cách trừ & hoàn lại.
const po = (id: string, tongTien: number, paid = 0, extra: any = {}): any => ({
  id, supplierId: 'NCC1', supplierName: 'NCC', items: [], tongTien,
  thanhToanThucTe: paid, congNo: tongTien - paid, status: 'completed', ...extra,
});

describe('getPoPayableRemaining', () => {
  it('đơn nhận đủ / không theo dõi receivedQty → tongTien − đã trả', () => {
    expect(getPoPayableRemaining(po('A', 100, 30))).toBe(70);
  });
  it('đơn mới nhận 1 phần → chỉ tính giá trị hàng đã nhận', () => {
    const o = po('A', 1000, 0, { items: [{ qty: 10, price: 100, receivedQty: 4 }] });
    expect(getPoPayableRemaining(o)).toBe(400);
  });
  it('trả dư không âm', () => {
    expect(getPoPayableRemaining(po('A', 100, 150))).toBe(0);
  });
});

describe('planPoAllocations', () => {
  it('trừ đúng từng đơn, trả hết → congNo = 0, trạng thái đơn giữ nguyên', () => {
    const { applied, updatedOrders } = planPoAllocations(
      [{ purchaseOrderId: 'A', amount: 10720000 }, { purchaseOrderId: 'B', amount: 5360000 }],
      [po('A', 10720000, 0, { status: 'confirmed' }), po('B', 5360000, 0, { status: 'confirmed' })],
      16080000
    );
    expect(applied).toEqual([{ purchaseOrderId: 'A', amount: 10720000 }, { purchaseOrderId: 'B', amount: 5360000 }]);
    expect(updatedOrders.map(o => [o.thanhToanThucTe, o.congNo, o.status])).toEqual([[10720000, 0, 'confirmed'], [5360000, 0, 'confirmed']]);
  });

  it('trả 1 phần → còn nợ, giữ nguyên trạng thái đơn', () => {
    const { updatedOrders } = planPoAllocations([{ purchaseOrderId: 'A', amount: 40 }], [po('A', 100, 0, { status: 'confirmed' })], 40);
    expect(updatedOrders[0]).toMatchObject({ thanhToanThucTe: 40, congNo: 60, status: 'confirmed' });
  });

  it('người duyệt duyệt thấp hơn đề xuất → phân bổ lần lượt, dừng khi hết tiền phiếu', () => {
    const { applied } = planPoAllocations(
      [{ purchaseOrderId: 'A', amount: 100 }, { purchaseOrderId: 'B', amount: 100 }],
      [po('A', 100), po('B', 100)], 130
    );
    expect(applied).toEqual([{ purchaseOrderId: 'A', amount: 100 }, { purchaseOrderId: 'B', amount: 30 }]);
  });

  it('không vượt số còn phải trả của đơn; bỏ qua đơn đã bị xóa', () => {
    const { applied } = planPoAllocations(
      [{ purchaseOrderId: 'A', amount: 500 }, { purchaseOrderId: 'ZZ', amount: 50 }],
      [po('A', 100, 70)], 1000
    );
    expect(applied).toEqual([{ purchaseOrderId: 'A', amount: 30 }]);
  });
});

describe('planPoRevert', () => {
  it('xóa phiếu chi → hoàn lại đúng số đã trừ, KHÔNG đổi trạng thái đơn (completed vẫn completed)', () => {
    const [o] = planPoRevert([{ purchaseOrderId: 'A', amount: 40 }], [po('A', 100, 100)]);
    expect(o).toMatchObject({ thanhToanThucTe: 60, congNo: 40, status: 'completed' });
  });
  it('trừ rồi hoàn lại → về đúng số ban đầu', () => {
    const orig = po('A', 100, 0, { status: 'confirmed' });
    const { applied, updatedOrders } = planPoAllocations([{ purchaseOrderId: 'A', amount: 100 }], [orig], 100);
    const [back] = planPoRevert(applied, updatedOrders);
    expect(back).toMatchObject({ thanhToanThucTe: 0, congNo: 100, status: 'confirmed' });
  });
  it('không đẩy thanhToanThucTe xuống âm', () => {
    const [o] = planPoRevert([{ purchaseOrderId: 'A', amount: 999 }], [po('A', 100, 50)]);
    expect(o.thanhToanThucTe).toBe(0);
  });
});

// Tự phân bổ phần tiền chưa gắn đơn vào các đơn CŨ NHẤT còn nợ — sau khi trả công nợ đầu kỳ.
describe('planPoAllocations — tự phân bổ phần dư', () => {
  const pool = () => [
    po('NEW', 100, 0, { createdAt: '2026-09-01', status: 'confirmed' }),
    po('OLD', 30, 0, { createdAt: '2026-07-01', status: 'confirmed' }),
  ];

  it('không chọn đơn nào → tự trừ vào đơn cũ nhất trước, rồi tới đơn kế tiếp', () => {
    const { applied, autoApplied, updatedOrders } = planPoAllocations([], pool(), 50, { pool: pool(), openingDebt: 0, priorPaid: 0 });
    expect(applied).toEqual([{ purchaseOrderId: 'OLD', amount: 30 }, { purchaseOrderId: 'NEW', amount: 20 }]);
    expect(autoApplied).toEqual(applied);
    expect(updatedOrders.find(o => o.id === 'OLD')).toMatchObject({ thanhToanThucTe: 30, congNo: 0, status: 'confirmed' });
    expect(updatedOrders.find(o => o.id === 'NEW')).toMatchObject({ thanhToanThucTe: 20, congNo: 80, status: 'confirmed' });
  });

  it('nợ cũ trả trước: khoản trả chưa vượt công nợ đầu kỳ → KHÔNG gắn vào đơn nào', () => {
    const { applied, updatedOrders } = planPoAllocations([], pool(), 778, { pool: pool(), openingDebt: 787, priorPaid: 0 });
    expect(applied).toEqual([]);
    expect(updatedOrders).toEqual([]);
  });

  it('chỉ phần VƯỢT công nợ đầu kỳ mới được tự phân bổ (tính cả các phiếu đã trả trước đó)', () => {
    // đầu kỳ 100, đã trả trước 60, phiếu này 100 → tổng 160 − 100 = 60 dùng được cho đơn
    const { applied } = planPoAllocations([], pool(), 100, { pool: pool(), openingDebt: 100, priorPaid: 60 });
    expect(applied.reduce((s, a) => s + a.amount, 0)).toBe(60);
  });

  it('có chọn đơn: trừ đơn đã chọn trước, phần dư mới tự phân bổ; đơn được cộng dồn, không lặp', () => {
    // chọn NEW 40; phiếu 100 → dư 60 tự phân bổ: OLD 30 (cũ nhất), NEW thêm 30
    const { applied, autoApplied } = planPoAllocations(
      [{ purchaseOrderId: 'NEW', amount: 40 }], pool(), 100, { pool: pool(), openingDebt: 0, priorPaid: 0 });
    expect(applied).toEqual(expect.arrayContaining([{ purchaseOrderId: 'NEW', amount: 70 }, { purchaseOrderId: 'OLD', amount: 30 }]));
    expect(applied).toHaveLength(2);
    expect(autoApplied).toEqual(expect.arrayContaining([{ purchaseOrderId: 'OLD', amount: 30 }, { purchaseOrderId: 'NEW', amount: 30 }]));
  });

  it('không vượt tổng còn phải trả của các đơn', () => {
    const { applied } = planPoAllocations([], pool(), 1000, { pool: pool(), openingDebt: 0, priorPaid: 0 });
    expect(applied.reduce((s, a) => s + a.amount, 0)).toBe(130);
  });

  it('không truyền auto → hành vi cũ (không tự phân bổ)', () => {
    expect(planPoAllocations([], pool(), 50).applied).toEqual([]);
  });

  it('tự phân bổ rồi hoàn lại → các đơn về đúng số ban đầu', () => {
    const { applied, updatedOrders } = planPoAllocations([], pool(), 50, { pool: pool(), openingDebt: 0, priorPaid: 0 });
    const back = planPoRevert(applied, updatedOrders);
    expect(back.map(o => [o.id, o.thanhToanThucTe, o.congNo]).sort()).toEqual([['NEW', 0, 100], ['OLD', 0, 30]]);
  });
});

// Lỗi phát hiện khi test trên staging: đơn đã nhận hàng (status 'completed') còn nợ → trừ công nợ rồi xóa
// phiếu chi đã bị hạ nhầm xuống 'confirmed'. 'completed' của đơn mua = đã nhận hàng, không phải đã trả tiền.
describe('trạng thái đơn không bị đổi bởi trừ/hoàn công nợ', () => {
  it("đơn 'completed' còn nợ: trừ rồi hoàn lại vẫn 'completed'", () => {
    const orig = po('A', 100, 0); // status mặc định 'completed'
    const { applied, updatedOrders } = planPoAllocations([{ purchaseOrderId: 'A', amount: 100 }], [orig], 100);
    expect(updatedOrders[0].status).toBe('completed');
    const [back] = planPoRevert(applied, updatedOrders);
    expect(back).toMatchObject({ status: 'completed', thanhToanThucTe: 0, congNo: 100 });
  });
});
