// CHI PHÍ THEO CÔNG TRÌNH (Bảng điều hành Giám đốc → Phòng Dự Án).
//
// Phần lớn tiền trả nhà cung cấp KHÔNG gắn công trình ở phiếu chi — chi phí vật tư của công trình nằm ở ĐƠN MUA HÀNG (đơn có gắn công trình).
// Nên chi phí công trình được tổng hợp theo 6 nhóm (không trùng nhau):
//   1. Vật tư (nhà cung cấp) : Σ tổng tiền đơn mua hàng của công trình (bỏ nháp/đã hủy); đã chi = số đã thanh toán của đơn.
//   2. Kho                  : Σ tổng tiền đơn NỘI BỘ xuất từ kho cho công trình (không có công nợ → coi như đã chi).
//   3. Thầu phụ             : mọi phiếu chi đã duyệt TRẢ CHO THẦU PHỤ (đề xuất "Chi Thầu Phụ", hoặc đề xuất "Chi phí công trình" nhưng người nhận là thầu phụ ĐÃ CÓ HỢP ĐỒNG ĐÃ DUYỆT ở công trình — nhận theo mã)
//                              + phần hợp đồng thầu phụ ĐÃ DUYỆT còn chưa trả
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
  proposals?: any[];  // Đề xuất vật tư — để loại các đơn mua hàng sinh từ đề xuất ĐÃ HỦY
}

const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const isCashFundDeposit = (p: Payment) => (p.category as string) === 'cash_fund';
const emptyCost = (): ProjectCost => ({ material: 0, warehouse: 0, subcontract: 0, site: 0, other: 0, pending: 0, paid: 0, total: 0, remaining: 0, cash: 0 });
/** Hợp đồng thầu phụ đã duyệt: cờ isApproved, hoặc trạng thái 'Hoàn thành' (cách app suy ra "đã duyệt"). */
const isApprovedContract = (c: any) => c?.isApproved === true || String(c?.status || '').trim().toLowerCase() === 'hoàn thành';
/**
 * Đơn mua hàng sinh từ một ĐỀ XUẤT VẬT TƯ ĐÃ HỦY mà đơn vẫn ở trạng thái đặt hàng (chưa nhập hàng): hủy đề xuất không tự hủy đơn nên đơn vẫn "treo" và bị tính vào chi phí.
 * Bỏ khỏi chi phí. Đơn đã HOÀN TẤT (đã nhập hàng) giữ nguyên vì hàng đã về thật; tiền đã trả cho đơn bị bỏ vẫn tính qua phiếu chi.
 */
const cancelledProposalIds = (proposals?: any[]) => new Set((proposals || []).filter(p => p?.status === 'cancelled').map(p => p.id as string));
const isVoidedByProposal = (o: any, cancelled: Set<string>) => !!o?.proposalId && cancelled.has(o.proposalId) && o.status !== 'completed';
const isWarehouseOrder = (o: any) => !!o?.fromWarehouse || o?.supplierId === WAREHOUSE_SOURCE_ID;

// ── Nhận diện phiếu chi TRẢ CHO THẦU PHỤ ──
// Trước đây chỉ phiếu có category 'subcontractor_advance' (đề xuất "Chi Thầu Phụ") mới tính vào Thầu phụ. Nhưng tiền trả thầu phụ cũng hay được lập bằng
// đề xuất "Chi phí công trình" → phiếu mang category 'site_expense' → bị cộng vào "Chi phí công trường" TRONG KHI hợp đồng thầu phụ vẫn tính đủ giá trị
// → tính ĐÔI (vd NGUYỄN VĂN HÒA: hợp đồng 130tr + 90tr phiếu chi công trường). Nay: phiếu của một thầu phụ ĐÃ CÓ HỢP ĐỒNG ĐÃ DUYỆT ở công trình đó
// được xếp vào Thầu phụ và trừ vào phần hợp đồng còn chưa trả. Nhận ra thầu phụ theo MÃ: mã trên phiếu, hoặc mã trên đề xuất gốc của phiếu (nhiều phiếu chỉ lưu mã ở đề xuất);
// chỉ khi phiếu không có mã nào mới dựa vào tên người nhận khớp CHÍNH XÁC tên thầu phụ của hợp đồng.
interface ContractSubs { ids: Set<string>; names: Set<string> }
function contractSubsByProject(contracts: any[]): Map<string, ContractSubs> {
  const m = new Map<string, ContractSubs>();
  for (const k of contracts) {
    if (!isApprovedContract(k) || !k.projectId) continue;
    const e = m.get(k.projectId) || m.set(k.projectId, { ids: new Set(), names: new Set() }).get(k.projectId)!;
    if (k.subcontractorId) e.ids.add(k.subcontractorId); else if (k.subcontractorName) e.names.add(k.subcontractorName);
  }
  return m;
}
const advanceIndex = (advances: any[]) => new Map<string, any>(advances.map(a => [a.id, a] as const));
const resolveSubId = (p: Payment, adv: Map<string, any>): string | undefined => p.subcontractorId || adv.get((p as any).relatedAdvanceId)?.subcontractorId || undefined;
const isSubcontractPayment = (p: Payment, subId: string | undefined, cs?: ContractSubs): boolean =>
  p.category === 'subcontractor_advance' || (!!cs && (subId ? cs.ids.has(subId) : !!p.recipient && cs.names.has(p.recipient)));
interface SubPay { p: Payment; subId?: string }

export function buildProjectCosts(projectIds: string[], inp: CostInputs): Map<string, ProjectCost> {
  const out = new Map<string, ProjectCost>();
  const wanted = new Set(projectIds);
  projectIds.forEach(id => out.set(id, emptyCost()));
  const get = (id?: string) => (id && wanted.has(id) ? out.get(id)! : null);

  // ── 1 & 2. Đơn mua hàng ──
  const countedOrderIds = new Set<string>();
  const cancelledProps = cancelledProposalIds(inp.proposals);
  for (const o of inp.orders) {
    const c = get(o.projectId); if (!c) continue;
    if (o.projectId === WAREHOUSE_PROJECT_ID || o.status === 'draft' || o.status === 'cancelled' || isVoidedByProposal(o, cancelledProps)) continue;
    const total = num(o.tongTien);
    countedOrderIds.add(o.id);
    if (isWarehouseOrder(o)) { c.warehouse += total; c.paid += total; continue; }
    c.material += total;
    c.paid += Math.min(total, Math.max(0, num(o.thanhToanThucTe)));
  }

  // ── Phiếu chi theo công trình (bỏ nạp quỹ; bỏ phiếu trả cho đơn đã tính ở trên) ──
  const subPaidByProject = new Map<string, SubPay[]>();
  const advById = advanceIndex(inp.advances), cSubs = contractSubsByProject(inp.contracts);
  for (const p of inp.payments) {
    const c = get(p.projectId); if (!c || isCashFundDeposit(p)) continue;
    const forCountedOrder = !!p.purchaseOrderId && countedOrderIds.has(p.purchaseOrderId);
    if (p.status === 'pending') { if (!forCountedOrder) c.pending += num(p.amount); continue; }
    if (p.status !== 'approved') continue;
    // "Trong đó tiền mặt": cả phiếu trả đơn mua hàng (số đã chi thật), chỉ để tham khảo
    if (p.paymentMethod === 'cash' || p.paymentMethod === 'cash_fund') c.cash += num(p.amount);
    if (forCountedOrder) continue;
    const amt = num(p.amount);
    const subId = resolveSubId(p, advById);
    if (isSubcontractPayment(p, subId, cSubs.get(p.projectId!))) {
      c.subcontract += amt; c.paid += amt;
      (subPaidByProject.get(p.projectId!) || subPaidByProject.set(p.projectId!, []).get(p.projectId!)!).push({ p, subId });
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
      .filter(x => (g.subId && x.subId === g.subId) || (!x.subId && g.subName && x.p.recipient === g.subName))
      .reduce((s, x) => s + num(x.p.amount), 0);
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

// ─── CHI TIẾT TỪNG KHOẢN của tổng chi phí (cho màn hình "Chi tiết chi phí") ───
// Dựng danh sách khoản theo ĐÚNG quy tắc của buildProjectCosts → cộng từng nhóm ra đúng số ở bảng (có test đối chiếu).
export type CostGroup = 'material' | 'warehouse' | 'subcontract' | 'site' | 'other' | 'pending';
export interface CostItem {
  id: string; group: CostGroup;
  title: string;       // tên khoản (đơn mua hàng, phiếu chi, hợp đồng…)
  sub?: string;        // dòng phụ: nhà cung cấp / người nhận / ghi chú
  date?: string;       // YYYY-MM-DD (nếu có)
  amount: number;      // số tiền tính vào tổng chi phí
  paid: number;        // phần đã chi trong khoản này
  tag?: string;        // nhãn nhỏ (vd "Chờ duyệt", "Tiền mặt", "Chưa trả")
}
export const COST_GROUPS: { key: CostGroup; label: string; color: string; hint: string }[] = [
  { key: 'material', label: 'Vật tư (nhà cung cấp)', color: '#0a4fd8', hint: 'Tổng tiền các đơn mua hàng của công trình' },
  { key: 'warehouse', label: 'Kho', color: '#0ea5e9', hint: 'Vật tư xuất từ kho cho công trình' },
  { key: 'subcontract', label: 'Thầu phụ', color: '#f59e0b', hint: 'Đã trả thầu phụ + phần hợp đồng đã duyệt còn chưa trả' },
  { key: 'site', label: 'Chi phí công trường', color: '#10b981', hint: 'Phiếu chi "chi phí công trường" đã duyệt' },
  { key: 'other', label: 'Chi khác', color: '#8b5cf6', hint: 'Phiếu chi đã duyệt khác: nhân công, vận chuyển…' },
  { key: 'pending', label: 'Chờ duyệt', color: '#e11d48', hint: 'Chưa chi, nhưng sẽ chi (phiếu/đề xuất đang chờ)' },
];
const day = (v: any) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : undefined);

export function buildProjectCostItems(projectId: string, inp: CostInputs): CostItem[] {
  const items: CostItem[] = [];
  const countedOrderIds = new Set<string>();
  const cancelledProps = cancelledProposalIds(inp.proposals);
  for (const o of inp.orders) {
    if (o.projectId !== projectId || o.projectId === WAREHOUSE_PROJECT_ID || o.status === 'draft' || o.status === 'cancelled' || isVoidedByProposal(o, cancelledProps)) continue;
    countedOrderIds.add(o.id);
    const total = num(o.tongTien);
    const wh = isWarehouseOrder(o);
    items.push({
      id: `o:${o.id}`, group: wh ? 'warehouse' : 'material', title: `Đơn mua hàng ${o.code || o.maDon || o.id}`, sub: wh ? 'Xuất từ kho' : (o.supplierName || o.nhaCungCap || ''),
      date: day(o.ngayDat || o.date || o.createdAt), amount: total, paid: wh ? total : Math.min(total, Math.max(0, num(o.thanhToanThucTe))),
      tag: wh ? undefined : (num(o.thanhToanThucTe) >= total && total > 0 ? 'Đã thanh toán đủ' : num(o.thanhToanThucTe) > 0 ? 'Thanh toán một phần' : 'Chưa thanh toán'),
    });
  }
  const subPaid: SubPay[] = [];
  const advById = advanceIndex(inp.advances), csub = contractSubsByProject(inp.contracts).get(projectId);
  for (const p of inp.payments) {
    if (p.projectId !== projectId || isCashFundDeposit(p)) continue;
    const forCounted = !!p.purchaseOrderId && countedOrderIds.has(p.purchaseOrderId);
    const cash = p.paymentMethod === 'cash' || p.paymentMethod === 'cash_fund';
    if (p.status === 'pending') {
      if (!forCounted) items.push({ id: `p:${p.id}`, group: 'pending', title: `Phiếu chi ${p.code || p.id}`, sub: [p.recipient, (p as any).notes].filter(Boolean).join(' · '), date: day((p as any).date || (p as any).createdAt), amount: num(p.amount), paid: 0, tag: 'Phiếu chi chờ duyệt' });
      continue;
    }
    if (p.status !== 'approved' || forCounted) continue;
    const amt = num(p.amount);
    const subId = resolveSubId(p, advById);
    const group: CostGroup = isSubcontractPayment(p, subId, csub) ? 'subcontract' : p.category === 'site_expense' ? 'site' : 'other';
    if (group === 'subcontract') subPaid.push({ p, subId });
    items.push({ id: `p:${p.id}`, group, title: `Phiếu chi ${p.code || p.id}`, sub: [p.recipient, (p as any).notes].filter(Boolean).join(' · '), date: day((p as any).date || (p as any).createdAt), amount: amt, paid: amt, tag: cash ? 'Tiền mặt' : undefined });
  }
  // Hợp đồng thầu phụ đã duyệt: phần còn chưa trả (giống buildProjectCosts)
  const groups = new Map<string, { subId?: string; subName?: string; value: number }>();
  for (const k of inp.contracts) {
    if (!isApprovedContract(k) || k.projectId !== projectId) continue;
    const key = `${k.subcontractorId || k.subcontractorName || k.id}`;
    const g = groups.get(key) || { subId: k.subcontractorId, subName: k.subcontractorName, value: 0 };
    g.value += num(k.contractValue); groups.set(key, g);
  }
  for (const [key, g] of groups) {
    const paid = subPaid.filter(x => (g.subId && x.subId === g.subId) || (!x.subId && g.subName && x.p.recipient === g.subName)).reduce((s, x) => s + num(x.p.amount), 0);
    const left = Math.max(0, g.value - paid);
    if (left > 0) items.push({ id: `c:${key}`, group: 'subcontract', title: `Hợp đồng thầu phụ ${g.subName || ''}`.trim(), sub: `Giá trị hợp đồng ${g.value.toLocaleString('vi-VN')} đ, đã trả ${paid.toLocaleString('vi-VN')} đ`, amount: left, paid: 0, tag: 'Còn chưa trả' });
  }
  const advanceWithPayment = new Set(inp.payments.map(p => p.relatedAdvanceId).filter(Boolean) as string[]);
  for (const a of inp.advances) {
    if (a.projectId !== projectId || (a.status !== 'pending_approval' && a.status !== 'pending_payment') || a.type === 'cash_fund_deposit' || a.paymentId || advanceWithPayment.has(a.id)) continue;
    items.push({ id: `a:${a.id}`, group: 'pending', title: `Đề xuất chi ${a.id}`, sub: [a.creatorName || a.creator, a.reason].filter(Boolean).join(' · ').slice(0, 120), date: day(a.createdAt || a.date), amount: num(a.approvedAmount ?? a.amount), paid: 0, tag: a.status === 'pending_approval' ? 'Chờ duyệt' : 'Chờ lập phiếu' });
  }
  return items;
}
