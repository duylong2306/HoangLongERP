// TỔNG CHI PHÍ CÔNG TRÌNH = ĐÃ CHI + CÒN PHẢI CHI (Bảng điều hành Giám đốc → Phòng Dự Án).
//
//   Đã chi        : phiếu chi ĐÃ DUYỆT gắn công trình (không tính nạp quỹ tiền mặt) — đúng số cột "Đã chi" hiện có.
//   Còn phải chi  : các khoản đã phát sinh/cam kết cho công trình nhưng CHƯA chi, gồm 4 nhóm (không trùng nhau):
//     1. Hợp đồng thầu phụ ĐÃ DUYỆT còn chưa trả = Σ giá trị hợp đồng − tiền đã chi cho thầu phụ đó tại công trình (không âm).
//     2. Đơn mua hàng của công trình còn công nợ (bỏ đơn nháp/đã hủy).
//     3. Đề xuất chi đang chờ duyệt / chờ lập phiếu CHƯA có phiếu chi (đã có phiếu rồi thì phiếu đã được tính ở nhóm 4 hoặc Đã chi).
//     4. Phiếu chi đang CHỜ DUYỆT (chưa tính vào Đã chi).
//   Tổng chi phí = Đã chi + Còn phải chi.
// Hàm thuần (không gọi DB) để dễ kiểm tra. Mọi nhóm đều tách riêng để hiển thị "chi tiết từng khoản" cho người xem đối chiếu.
import type { Payment } from '../types';

export interface ProjectCost {
  spent: number;             // Đã chi
  subcontractUnpaid: number; // 1. thầu phụ còn phải trả
  orderUnpaid: number;       // 2. đơn mua hàng còn công nợ
  proposalPending: number;   // 3. đề xuất chờ duyệt/chờ lập phiếu (chưa có phiếu)
  paymentPending: number;    // 4. phiếu chi chờ duyệt
  remaining: number;         // Còn phải chi = 1+2+3+4
  total: number;             // Tổng chi phí = spent + remaining
}

const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const isCashFund = (p: Payment) => (p.category as string) === 'cash_fund';
const EMPTY: ProjectCost = { spent: 0, subcontractUnpaid: 0, orderUnpaid: 0, proposalPending: 0, paymentPending: 0, remaining: 0, total: 0 };

export interface CostInputs {
  payments: Payment[];
  orders: any[];      // PurchaseOrder
  advances: any[];    // SubcontractorAdvanceProposal (đề xuất chi)
  contracts: any[];   // ArchivedQuote sector 'subcontractor'
}

/** Hợp đồng thầu phụ đã duyệt: cờ isApproved, hoặc trạng thái 'Hoàn thành' (cách app suy ra "đã duyệt"). */
const isApprovedContract = (c: any) => c?.isApproved === true || String(c?.status || '').trim().toLowerCase() === 'hoàn thành';

export function buildProjectCosts(projectIds: string[], inp: CostInputs): Map<string, ProjectCost> {
  const out = new Map<string, ProjectCost>();
  const wanted = new Set(projectIds);
  projectIds.forEach(id => out.set(id, { ...EMPTY }));
  const get = (id?: string) => (id && wanted.has(id) ? out.get(id)! : null);

  // Đề xuất đã có phiếu chi (liên kết relatedAdvanceId) → không tính lại ở nhóm 3
  const advanceWithPayment = new Set(inp.payments.map(p => p.relatedAdvanceId).filter(Boolean) as string[]);

  // Phiếu chi theo công trình
  const approvedByProject = new Map<string, Payment[]>();
  for (const p of inp.payments) {
    const c = get(p.projectId); if (!c || isCashFund(p)) continue;
    if (p.status === 'approved') {
      c.spent += num(p.amount);
      (approvedByProject.get(p.projectId!) || approvedByProject.set(p.projectId!, []).get(p.projectId!)!).push(p);
    } else if (p.status === 'pending') {
      c.paymentPending += num(p.amount);
    }
  }

  // 1. Thầu phụ: gom hợp đồng đã duyệt theo (công trình, thầu phụ); trừ tiền đã chi cho thầu phụ đó tại công trình
  const groups = new Map<string, { projectId: string; subId?: string; subName?: string; value: number }>();
  for (const k of inp.contracts) {
    if (!isApprovedContract(k) || !get(k.projectId)) continue;
    const key = `${k.projectId}|${k.subcontractorId || k.subcontractorName || k.id}`;
    const g = groups.get(key) || { projectId: k.projectId, subId: k.subcontractorId, subName: k.subcontractorName, value: 0 };
    g.value += num(k.contractValue);
    groups.set(key, g);
  }
  for (const g of groups.values()) {
    const paid = (approvedByProject.get(g.projectId) || [])
      .filter(p => p.category !== 'supplier_payment')   // tiền trả nhà cung cấp trùng tên không trừ vào hợp đồng thầu phụ
      .filter(p => (g.subId && p.subcontractorId === g.subId) || (!p.subcontractorId && g.subName && p.recipient === g.subName))
      .reduce((s, p) => s + num(p.amount), 0);
    get(g.projectId)!.subcontractUnpaid += Math.max(0, g.value - paid);
  }

  // 2. Đơn mua hàng còn công nợ
  for (const o of inp.orders) {
    const c = get(o.projectId); if (!c) continue;
    if (o.status === 'draft' || o.status === 'cancelled') continue;
    const debt = o.congNo != null ? num(o.congNo) : num(o.tongTien) - num(o.thanhToanThucTe);
    c.orderUnpaid += Math.max(0, debt);
  }

  // 3. Đề xuất chi chờ duyệt / chờ lập phiếu, chưa có phiếu (bỏ nạp quỹ tiền mặt)
  for (const a of inp.advances) {
    const c = get(a.projectId); if (!c) continue;
    if (a.status !== 'pending_approval' && a.status !== 'pending_payment') continue;
    if (a.type === 'cash_fund_deposit') continue;
    if (a.paymentId || advanceWithPayment.has(a.id)) continue;
    c.proposalPending += num(a.approvedAmount ?? a.amount);
  }

  for (const c of out.values()) {
    c.remaining = c.subcontractUnpaid + c.orderUnpaid + c.proposalPending + c.paymentPending;
    c.total = c.spent + c.remaining;
  }
  return out;
}

/** Chuỗi "chi tiết từng khoản" cho tooltip. */
export function describeProjectCost(c: ProjectCost, fmt: (n: number) => string): string {
  return [
    `Đã chi: ${fmt(c.spent)}`,
    `Còn phải chi: ${fmt(c.remaining)}`,
    `  • Hợp đồng thầu phụ chưa trả: ${fmt(c.subcontractUnpaid)}`,
    `  • Đơn mua hàng còn công nợ: ${fmt(c.orderUnpaid)}`,
    `  • Đề xuất chờ duyệt / chờ lập phiếu: ${fmt(c.proposalPending)}`,
    `  • Phiếu chi chờ duyệt: ${fmt(c.paymentPending)}`,
  ].join('\n');
}
