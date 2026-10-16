// CHI PHÍ THEO CÔNG TRÌNH (Bảng điều hành Giám đốc → Phòng Dự Án).
//
// Phần lớn tiền trả nhà cung cấp KHÔNG gắn công trình ở phiếu chi — chi phí vật tư của công trình nằm ở ĐƠN MUA HÀNG (đơn có gắn công trình).
// Nên chi phí công trình được tổng hợp theo 6 nhóm (không trùng nhau):
//   1. Vật tư (nhà cung cấp) : Σ tổng tiền đơn mua hàng của công trình (bỏ nháp/đã hủy); đã chi = số đã thanh toán của đơn.
//   2. Kho                  : Σ tổng tiền đơn NỘI BỘ xuất từ kho cho công trình (không có công nợ → coi như đã chi).
//   3. Thầu phụ             : đã chi tạm ứng/thanh toán thầu phụ + phần hợp đồng thầu phụ ĐÃ DUYỆT còn chưa trả
//                              (mỗi hợp đồng/thầu phụ tính max(giá trị hợp đồng, đã chi) để trả vượt không làm âm).
//   4. Chi phí công trường  : phiếu chi "chi phí công trường" đã duyệt.
//   5. Chi khác             : các phiếu chi đã duyệt còn lại gắn công trình (chi khác, nhân công, vận chuyển…), trừ nạp quỹ tiền mặt.
//   6. Chờ duyệt            : phiếu chi đang chờ duyệt + đề xuất chi chờ duyệt/chờ lập phiếu CHƯA có phiếu (chưa chi, nhưng sẽ chi).
//   Tổng chi phí = 1 + 2 + 3 + 4 + 5 + 6.   Đã chi = phần đã trả của 1–5.   Còn phải chi = Tổng chi phí − Đã chi.
//   "Trong đó tiền mặt" chỉ để tham khảo (tiền mặt / rút từ quỹ tiền mặt đã chi), KHÔNG cộng thêm vào tổng.
// Phiếu chi trả cho đơn mua hàng (có purchaseOrderId của đơn đã tính) KHÔNG cộng lần nữa — đã nằm trong số đã thanh toán của đơn.
// Hàm thuần (không gọi DB) để dễ kiểm tra.
import type { Payment } from '../types';
import { WAREHOUSE_SOURCE_ID, WAREHOUSE_PROJECT_ID } from '../types';

export interface ProjectCost {
  material: number;      // 1. Vật tư (nhà cung cấp) — tổng tiền đơn
  warehouse: number;     // 2. Kho
  subcontract: number;   // 3. Thầu phụ (đã chi + chưa trả)
  site: number;          // 4. Chi phí công trường
  other: number;         // 5. Chi khác
  pending: number;       // 6. Chờ duyệt
  paid: number;          // Đã chi
  total: number;         // Tổng chi phí
  remaining: number;     // Còn phải chi = total − paid
  cash: number;          // Trong đó tiền mặt (tham khảo)
}

export interface CostInputs {
  payments: Payment[];
  orders: any[];      // PurchaseOrder
  advances: any[];    // SubcontractorAdvanceProposal (đề xuất chi)
  contracts: any[];   // ArchivedQuote sector 'subcontractor'
}

const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const isCashFundDeposit = (p: Payment) => (p.category as string) === 'cash_fund';
const emptyCost = (): ProjectCost => ({ material: 0, warehouse: 0, subcontract: 0, site: 0, other: 0, pending: 0, paid: 0, total: 0, remaining: 0, cash: 0 });
/** Hợp đồng thầu phụ đã duyệt: cờ isApproved, hoặc trạng thái 'Hoàn thành' (cách app suy ra "đã duyệt"). */
const isApprovedContract = (c: any) => c?.isApproved === true || String(c?.status || '').trim().toLowerCase() === 'hoàn thành';
const isWarehouseOrder = (o: any) => !!o?.fromWarehouse || o?.supplierId === WAREHOUSE_SOURCE_ID;

export function buildProjectCosts(projectIds: string[], inp: CostInputs): Map<string, ProjectCost> {
  const out = new Map<string, ProjectCost>();
  const wanted = new Set(projectIds);
  projectIds.forEach(id => out.set(id, emptyCost()));
  const get = (id?: string) => (id && wanted.has(id) ? out.get(id)! : null);

  // ── 1 & 2. Đơn mua hàng ──
  const countedOrderIds = new Set<string>();
  for (const o of inp.orders) {
    const c = get(o.projectId); if (!c) continue;
    if (o.projectId === WAREHOUSE_PROJECT_ID || o.status === 'draft' || o.status === 'cancelled') continue;
    const total = num(o.tongTien);
    countedOrderIds.add(o.id);
    if (isWarehouseOrder(o)) { c.warehouse += total; c.paid += total; continue; }
    c.material += total;
    c.paid += Math.min(total, Math.max(0, num(o.thanhToanThucTe)));
  }

  // ── Phiếu chi theo công trình (bỏ nạp quỹ; bỏ phiếu trả cho đơn đã tính ở trên) ──
  const subPaidByProject = new Map<string, Payment[]>();
  for (const p of inp.payments) {
    const c = get(p.projectId); if (!c || isCashFundDeposit(p)) continue;
    const forCountedOrder = !!p.purchaseOrderId && countedOrderIds.has(p.purchaseOrderId);
    if (p.status === 'pending') { if (!forCountedOrder) c.pending += num(p.amount); continue; }
    if (p.status !== 'approved') continue;
    // "Trong đó tiền mặt": cả phiếu trả đơn mua hàng (số đã chi thật), chỉ để tham khảo
    if (p.paymentMethod === 'cash' || p.paymentMethod === 'cash_fund') c.cash += num(p.amount);
    if (forCountedOrder) continue;
    const amt = num(p.amount);
    if (p.category === 'subcontractor_advance') {
      c.subcontract += amt; c.paid += amt;
      (subPaidByProject.get(p.projectId!) || subPaidByProject.set(p.projectId!, []).get(p.projectId!)!).push(p);
    } else if (p.category === 'site_expense') { c.site += amt; c.paid += amt; }
    else { c.other += amt; c.paid += amt; }
  }

  // ── 3. Hợp đồng thầu phụ đã duyệt: phần chưa trả = max(0, giá trị − đã chi cho thầu phụ đó tại công trình) ──
  const groups = new Map<string, { projectId: string; subId?: string; subName?: string; value: number }>();
  for (const k of inp.contracts) {
    if (!isApprovedContract(k) || !get(k.projectId)) continue;
    const key = `${k.projectId}|${k.subcontractorId || k.subcontractorName || k.id}`;
    const g = groups.get(key) || { projectId: k.projectId, subId: k.subcontractorId, subName: k.subcontractorName, value: 0 };
    g.value += num(k.contractValue);
    groups.set(key, g);
  }
  for (const g of groups.values()) {
    const paid = (subPaidByProject.get(g.projectId) || [])
      .filter(p => (g.subId && p.subcontractorId === g.subId) || (!p.subcontractorId && g.subName && p.recipient === g.subName))
      .reduce((s, p) => s + num(p.amount), 0);
    get(g.projectId)!.subcontract += Math.max(0, g.value - paid);   // phần đã chi đã cộng ở trên; chỉ cộng thêm phần chưa trả
  }

  // ── 6. Đề xuất chi chờ duyệt / chờ lập phiếu, chưa có phiếu (bỏ nạp quỹ tiền mặt) ──
  const advanceWithPayment = new Set(inp.payments.map(p => p.relatedAdvanceId).filter(Boolean) as string[]);
  for (const a of inp.advances) {
    const c = get(a.projectId); if (!c) continue;
    if (a.status !== 'pending_approval' && a.status !== 'pending_payment') continue;
    if (a.type === 'cash_fund_deposit') continue;
    if (a.paymentId || advanceWithPayment.has(a.id)) continue;
    c.pending += num(a.approvedAmount ?? a.amount);
  }

  for (const c of out.values()) {
    c.total = c.material + c.warehouse + c.subcontract + c.site + c.other + c.pending;
    c.remaining = Math.max(0, c.total - c.paid);
  }
  return out;
}

/** Cảnh báo ngân sách theo MÔ HÌNH MỚI: tổng chi phí so với giá trị hợp đồng; chi thực > thu. */
export function costBudgetFlags(contractValue: number, collected: number, c: ProjectCost) {
  const over = contractValue > 0 && c.total > contractValue;
  const near = !over && contractValue > 0 && c.total / contractValue >= 0.8;
  const loss = collected > 0 && c.paid > collected;
  return { over, near, loss, risk: over || loss };
}

/** Chuỗi "chi tiết từng khoản" cho tooltip. */
export function describeProjectCost(c: ProjectCost, fmt: (n: number) => string): string {
  return [
    `Tổng chi phí: ${fmt(c.total)}`,
    `  • Vật tư (đơn mua hàng): ${fmt(c.material)}`,
    `  • Kho (xuất cho công trình): ${fmt(c.warehouse)}`,
    `  • Thầu phụ: ${fmt(c.subcontract)}`,
    `  • Chi phí công trường: ${fmt(c.site)}`,
    `  • Chi khác: ${fmt(c.other)}`,
    `  • Chờ duyệt: ${fmt(c.pending)}`,
    `Đã chi: ${fmt(c.paid)} (trong đó tiền mặt: ${fmt(c.cash)})`,
    `Còn phải chi: ${fmt(c.remaining)}`,
  ].join('\n');
}
