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

// Bối cảnh để TỰ PHÂN BỔ phần tiền chưa gắn vào đơn nào (chi lệch / không chọn đơn).
//  pool         : các đơn của ĐÚNG nhà cung cấp, đã ghi nhận công nợ (caller lọc sẵn).
//  openingDebt  : công nợ ĐẦU KỲ của NCC (nợ cũ nhất → được trả trước, không gắn vào đơn nào).
//  priorPaid    : tổng phiếu chi đã duyệt trước đó cho NCC (khớp theo tên người nhận như Công nợ Trả).
export interface AutoAllocateContext { pool: PurchaseOrder[]; openingDebt: number; priorPaid: number }

// Lập phiếu: trừ khoản chi vào các đơn đã chọn. Công thức giống handleApprovePayment (App.tsx):
// thanhToanThucTe += số tiền; congNo = tongTien − thanhToanThucTe; trả hết thì 'completed'.
// Bước 1: phân bổ lần lượt theo thứ tự chọn, KHÔNG vượt số còn phải trả của đơn và KHÔNG vượt tổng
//   tiền phiếu chi (người duyệt có thể duyệt thấp hơn số đề xuất).
// Bước 2 (nếu có `auto`): phần tiền phiếu còn dư được TỰ PHÂN BỔ vào các đơn CŨ NHẤT còn nợ của NCC.
//   Nguyên tắc nợ cũ trả trước: tiền phiếu chi trước hết trả công nợ đầu kỳ, CHỈ phần vượt công nợ
//   đầu kỳ (và chưa được gắn vào đơn nào) mới tự phân bổ — nếu không, khoản trả nợ đầu kỳ sẽ bị gắn
//   nhầm làm "trả hết" các đơn mới.
// Trả về: applied = số tiền THỰC ÁP DỤNG theo từng đơn (đã gộp bước 1+2, lưu lại để hoàn khi xóa
// phiếu), autoApplied = riêng phần tự phân bổ (để báo người dùng), updatedOrders = các đơn đã sửa.
export function planPoAllocations(
  allocations: PoAllocation[],
  orders: PurchaseOrder[],
  payTotal: number,
  auto?: AutoAllocateContext
): { applied: PoAllocation[]; autoApplied: PoAllocation[]; updatedOrders: PurchaseOrder[] } {
  const current = new Map<string, PurchaseOrder>(orders.map(o => [o.id, o]));
  if (auto) auto.pool.forEach(o => { if (!current.has(o.id)) current.set(o.id, o); });
  const appliedMap = new Map<string, number>();
  const autoMap = new Map<string, number>();
  const touched = new Set<string>();

  // Trừ `use` vào 1 đơn (đã tính sẵn không vượt số còn phải trả)
  const applyTo = (po: PurchaseOrder, use: number, bucket: Map<string, number>) => {
    const newPaid = (po.thanhToanThucTe || 0) + use;
    const newCongNo = Math.max(0, (po.tongTien || 0) - newPaid);
    current.set(po.id, { ...po, thanhToanThucTe: newPaid, congNo: newCongNo, status: newCongNo <= 0 ? 'completed' : (po.status || 'confirmed') } as PurchaseOrder);
    appliedMap.set(po.id, (appliedMap.get(po.id) || 0) + use);
    bucket.set(po.id, (bucket.get(po.id) || 0) + use);
    touched.add(po.id);
  };

  let remainingPay = payTotal;
  for (const alloc of allocations) {
    if (remainingPay <= 0) break;
    const po = current.get(alloc.purchaseOrderId);
    if (!po) continue; // đơn đã bị xóa → bỏ qua
    const use = Math.min(alloc.amount || 0, getPoPayableRemaining(po), remainingPay);
    if (use <= 0) continue;
    applyTo(po, use, new Map());
    remainingPay -= use;
  }

  if (auto && remainingPay > 0) {
    const poIds = new Set(auto.pool.map(o => o.id));
    // Tiền phiếu chi của NCC dùng được cho đơn = tổng đã trả (gồm phiếu này) − công nợ đầu kỳ;
    // trừ đi phần ĐÃ gắn vào đơn (trước đó + vừa phân bổ ở bước 1).
    const attributed = Array.from(current.values()).filter(o => poIds.has(o.id)).reduce((s, o) => s + (o.thanhToanThucTe || 0), 0);
    let autoBudget = Math.min(remainingPay, Math.max(0, (auto.priorPaid + payTotal) - (auto.openingDebt || 0) - attributed));
    const oldestFirst = auto.pool
      .slice()
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') || a.id.localeCompare(b.id));
    for (const base of oldestFirst) {
      if (autoBudget <= 0) break;
      const po = current.get(base.id)!;
      const use = Math.min(getPoPayableRemaining(po), autoBudget);
      if (use <= 0) continue;
      applyTo(po, use, autoMap);
      autoBudget -= use;
    }
  }

  const toList = (m: Map<string, number>): PoAllocation[] => Array.from(m, ([purchaseOrderId, amount]) => ({ purchaseOrderId, amount }));
  return {
    applied: toList(appliedMap),
    autoApplied: toList(autoMap),
    updatedOrders: Array.from(touched).map(id => current.get(id)!),
  };
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
