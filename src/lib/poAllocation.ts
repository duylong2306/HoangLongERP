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
// thanhToanThucTe += số tiền; congNo = tongTien − thanhToanThucTe (trạng thái đơn giữ nguyên).
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
    // KHÔNG đổi status: với đơn mua, 'completed' nghĩa là đã nhận hàng xong chứ không phải đã thanh toán —
    // đơn còn nợ vẫn 'completed' (kiểm chứng trên dữ liệu thật). Đổi status ở đây rồi hoàn lại sẽ làm
    // sai trạng thái nhận hàng (completed → confirmed).
    current.set(po.id, { ...po, thanhToanThucTe: newPaid, congNo: newCongNo } as PurchaseOrder);
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

// Xóa phiếu chi: hoàn lại đúng số đã trừ (trạng thái đơn giữ nguyên).
export function planPoRevert(allocations: PoAllocation[], orders: PurchaseOrder[]): PurchaseOrder[] {
  const updatedOrders: PurchaseOrder[] = [];
  for (const alloc of allocations) {
    const po = orders.find(o => o.id === alloc.purchaseOrderId);
    if (!po) continue;
    const newPaid = Math.max(0, (po.thanhToanThucTe || 0) - (alloc.amount || 0));
    const newCongNo = Math.max(0, (po.tongTien || 0) - newPaid);
    // Không đổi status (xem giải thích ở planPoAllocations).
    updatedOrders.push({ ...po, thanhToanThucTe: newPaid, congNo: newCongNo } as PurchaseOrder);
  }
  return updatedOrders;
}

// ── BÙ PHẦN ĐÃ CHI TRƯỚC KHI GHI NHẬN CÔNG NỢ ──
// Sự cố 2026-11 (PO-1792141670846-0): phiếu chi 107.000.000đ được lập TRƯỚC khi đơn được ghi nhận
// công nợ → lúc lập phiếu, đơn chưa nằm trong "pool" nên không được trừ; khi ghi nhận sau đó, hệ thống
// không áp lại → dòng chi tiết đơn báo còn nợ 107 triệu trong khi dòng tổng NCC báo đã trả đủ.
// Hàm này tính phần tiền NCC đã được chi nhưng CHƯA gắn vào đơn nào:
//   chưa gắn = tổng phiếu chi đã duyệt của NCC − công nợ đầu kỳ (nợ cũ trả trước) − tổng đã gắn vào các đơn
// rồi phân bổ vào các đơn CŨ NHẤT còn nợ (cùng nguyên tắc với planPoAllocations bước 2).
// Phần đã cấn trừ bằng trả hàng nằm trong thanhToanThucTe của đơn (tính vào "đã gắn") nên chỉ làm
// con số "chưa gắn" nhỏ đi — thiên về an toàn, không bao giờ gắn thừa.
export function planCatchUpAllocation(
  pool: PurchaseOrder[],
  openingDebt: number,
  totalPaid: number
): { applied: PoAllocation[]; updatedOrders: PurchaseOrder[] } {
  const attributed = pool.reduce((s, o) => s + (o.thanhToanThucTe || 0), 0);
  let budget = Math.max(0, totalPaid - (openingDebt || 0) - attributed);
  const applied: PoAllocation[] = [];
  const updatedOrders: PurchaseOrder[] = [];
  const oldestFirst = pool.slice().sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') || a.id.localeCompare(b.id));
  for (const po of oldestFirst) {
    if (budget <= 0) break;
    const use = Math.min(getPoPayableRemaining(po), budget);
    if (use <= 0) continue;
    const newPaid = (po.thanhToanThucTe || 0) + use;
    // Không đổi status (xem giải thích ở planPoAllocations)
    updatedOrders.push({ ...po, thanhToanThucTe: newPaid, congNo: Math.max(0, (po.tongTien || 0) - newPaid) } as PurchaseOrder);
    applied.push({ purchaseOrderId: po.id, amount: use });
    budget -= use;
  }
  return { applied, updatedOrders };
}

// ── GIÁM ĐỐC DUYỆT THEO TỪNG ĐƠN (đề xuất "Chi Nhà Cung Cấp") ──
// Thay vì chỉ nhập 1 con số "Số tiền duyệt chi" (rồi hệ thống tự cắt theo thứ tự đơn → có đơn bị bỏ ngoài ý muốn),
// người duyệt tick/bỏ tick và chỉnh số tiền TỪNG ĐƠN; tổng duyệt chi = tổng các đơn được duyệt + phần chi chung.
//   lines   : các đơn kế toán đề xuất, kèm cờ duyệt + số tiền người duyệt chấp thuận
//   general : phần chi KHÔNG gắn đơn (trả công nợ đầu kỳ / tạm ứng) mà người duyệt chấp thuận
export interface ApprovalLine { purchaseOrderId: string; amount: number; checked: boolean }
export interface ApprovalResult { allocations: PoAllocation[]; general: number; total: number; error?: string }

export function buildApprovedAllocations(
  lines: ApprovalLine[],
  general: number,
  orders: PurchaseOrder[]
): ApprovalResult {
  const allocations: PoAllocation[] = [];
  for (const l of lines) {
    if (!l.checked) continue;                           // đơn bị bỏ tick → không được chi
    const amount = Math.round(Number(l.amount) || 0);
    if (amount <= 0) continue;
    const po = orders.find(o => o.id === l.purchaseOrderId);
    if (!po) return { allocations: [], general: 0, total: 0, error: `Đơn ${l.purchaseOrderId} không còn tồn tại.` };
    // Không duyệt vượt số còn phải trả của đơn (dung sai 1đ như lúc lập đề xuất)
    if (amount > getPoPayableRemaining(po) + 1) {
      return { allocations: [], general: 0, total: 0, error: `Số tiền duyệt cho đơn ${po.id} vượt số còn phải trả (${getPoPayableRemaining(po).toLocaleString('vi-VN')}đ).` };
    }
    allocations.push({ purchaseOrderId: l.purchaseOrderId, amount });
  }
  const g = Math.max(0, Math.round(Number(general) || 0));
  const total = allocations.reduce((s, a) => s + a.amount, 0) + g;
  return { allocations, general: g, total };
}

// ── ĐỐI CHIẾU CÔNG NỢ NCC (sửa dữ liệu cũ) ──
// Với mỗi NCC: phần tiền đã chi nhưng chưa gắn vào đơn nào (xem planCatchUpAllocation) được phân bổ
// vào các đơn cũ nhất còn nợ. Trả về bản XEM TRƯỚC để kế toán duyệt từng NCC rồi mới áp dụng.
// Bỏ qua NCC có tổng áp dụng nhỏ hơn `minAmount` (nhiễu làm tròn vài đồng).
export interface ReconcileSupplierInput { supplierId: string; name: string; pool: PurchaseOrder[]; openingDebt: number; totalPaid: number }
export interface ReconcileSupplierPlan {
  supplierId: string; name: string; total: number;
  lines: { purchaseOrderId: string; before: number; amount: number }[];   // before = còn phải trả của đơn TRƯỚC khi áp
  updatedOrders: PurchaseOrder[];
}
export function planReconcileSuppliers(inputs: ReconcileSupplierInput[], minAmount = 1000): ReconcileSupplierPlan[] {
  const out: ReconcileSupplierPlan[] = [];
  for (const s of inputs) {
    const { applied, updatedOrders } = planCatchUpAllocation(s.pool, s.openingDebt, s.totalPaid);
    const total = applied.reduce((sum, a) => sum + a.amount, 0);
    if (total < minAmount) continue;
    const lines = applied.map(a => {
      const po = s.pool.find(o => o.id === a.purchaseOrderId)!;
      return { purchaseOrderId: a.purchaseOrderId, before: getPoPayableRemaining(po), amount: a.amount };
    });
    out.push({ supplierId: s.supplierId, name: s.name, total, lines, updatedOrders });
  }
  return out.sort((a, b) => b.total - a.total);
}
