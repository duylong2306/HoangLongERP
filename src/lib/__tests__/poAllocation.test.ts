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
  it('trừ đúng từng đơn, trả hết → completed, congNo = 0', () => {
    const { applied, updatedOrders } = planPoAllocations(
      [{ purchaseOrderId: 'A', amount: 10720000 }, { purchaseOrderId: 'B', amount: 5360000 }],
      [po('A', 10720000, 0, { status: 'confirmed' }), po('B', 5360000, 0, { status: 'confirmed' })],
      16080000
    );
    expect(applied).toEqual([{ purchaseOrderId: 'A', amount: 10720000 }, { purchaseOrderId: 'B', amount: 5360000 }]);
    expect(updatedOrders.map(o => [o.thanhToanThucTe, o.congNo, o.status])).toEqual([[10720000, 0, 'completed'], [5360000, 0, 'completed']]);
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
  it('xóa phiếu chi → hoàn lại đúng số đã trừ, đơn còn nợ hạ completed → confirmed', () => {
    const [o] = planPoRevert([{ purchaseOrderId: 'A', amount: 40 }], [po('A', 100, 100)]);
    expect(o).toMatchObject({ thanhToanThucTe: 60, congNo: 40, status: 'confirmed' });
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
