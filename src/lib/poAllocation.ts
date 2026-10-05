import type { PurchaseOrder } from '../types';

// Phân bổ khoản chi của đề xuất "Chi Nhà Cung Cấp" vào các Đơn Mua Hàng (PO).
// Tách thành hàm THUẦN (không gọi DB/state) để test được; FinanceManagement.tsx lo việc lưu.

export interface PoAllocation { purchaseOrderId: string; amount: number }

// Số tiền còn phải trả của 1 đơn = giá trị HÀNG ĐÃ NHẬN − đã thanh toán.
// Cùng công thức với dòng chi tiết Công nợ Trả (expandToDetailRows): PO có theo dõi receivedQty
// (đi qua bước Nhận hàng) chỉ tính phần đã nhận; PO cũ/tạo tay coi như nhận đủ.
export function getPoPayableRemaining(po: PurchaseOrder): number {
  const items: any[] = (po as any).items || [];
  const hasReceiveTracking = items.some(it => it.receivedQty !== undefined && it.receivedQty !== null);
  const isFullyReceived = !hasReceiveTracking || items.every(it => (Number(it.receivedQty) || 0) >= (Number(it.qty) || 0));
  const receivedValue = isFullyReceived
    ? (po.tongTien || 0)
    : items.reduce((sum, it) => sum + (Number(it.receivedQty) || 0) * (Number(it.price) || 0), 0);
  return Math.max(0, receivedValue - (po.thanhToanThucTe || 0));
}

// Lập phiếu: trừ khoản chi vào các đơn đã chọn. Công thức giống handleApprovePayment (App.tsx):
// thanhToanThucTe += số tiền; congNo = tongTien − thanhToanThucTe; trả hết thì 'completed'.
// Phân bổ lần lượt theo thứ tự chọn, KHÔNG vượt số còn phải trả của đơn và KHÔNG vượt tổng tiền
// phiếu chi (người duyệt có thể duyệt thấp hơn số đề xuất).
// Trả về: applied = số tiền THỰC ÁP DỤNG (lưu lại để hoàn khi xóa phiếu), updatedOrders = các đơn đã sửa.
export function planPoAllocations(
  allocations: PoAllocation[],
  orders: PurchaseOrder[],
  payTotal: number
): { applied: PoAllocation[]; updatedOrders: PurchaseOrder[] } {
  const applied: PoAllocation[] = [];
  const updatedOrders: PurchaseOrder[] = [];
  let remainingPay = payTotal;
  for (const alloc of allocations) {
    if (remainingPay <= 0) break;
    const po = orders.find(o => o.id === alloc.purchaseOrderId);
    if (!po) continue; // đơn đã bị xóa → bỏ qua
    const use = Math.min(alloc.amount || 0, getPoPayableRemaining(po), remainingPay);
    if (use <= 0) continue;
    const newPaid = (po.thanhToanThucTe || 0) + use;
    const newCongNo = Math.max(0, (po.tongTien || 0) - newPaid);
    updatedOrders.push({ ...po, thanhToanThucTe: newPaid, congNo: newCongNo, status: newCongNo <= 0 ? 'completed' : (po.status || 'confirmed') } as PurchaseOrder);
    applied.push({ purchaseOrderId: po.id, amount: use });
    remainingPay -= use;
  }
  return { applied, updatedOrders };
}

// Xóa phiếu chi: hoàn lại đúng số đã trừ. Chỉ hạ 'completed' → 'confirmed' khi đơn còn nợ,
// không đụng các trạng thái khác (nháp/hủy...).
export function planPoRevert(allocations: PoAllocation[], orders: PurchaseOrder[]): PurchaseOrder[] {
  const updatedOrders: PurchaseOrder[] = [];
  for (const alloc of allocations) {
    const po = orders.find(o => o.id === alloc.purchaseOrderId);
    if (!po) continue;
    const newPaid = Math.max(0, (po.thanhToanThucTe || 0) - (alloc.amount || 0));
    const newCongNo = Math.max(0, (po.tongTien || 0) - newPaid);
    updatedOrders.push({ ...po, thanhToanThucTe: newPaid, congNo: newCongNo, status: (newCongNo > 0 && po.status === 'completed') ? 'confirmed' : po.status } as PurchaseOrder);
  }
  return updatedOrders;
}
