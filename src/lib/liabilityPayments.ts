// Phiếu chi (khớp theo TÊN người nhận) có thật sự thuộc công nợ này không? — dùng cho "Công nợ Trả" (FinanceManagement).
// 1 đơn vị có thể VỪA là Thầu phụ VỪA là Nhà cung cấp (đổi vai trò theo thời gian) → cùng 1 tên nhưng là HAI công nợ riêng.
// Trước đây công nợ NCC nhận cả phiếu tạm ứng THẦU PHỤ cùng tên (và ngược lại) nên bị trừ lặp, "Còn lại" ra số âm
// (VD CÔNG TY TNHH HƯNG NGUYÊN KHANG: NCC nợ đầu kỳ 93,52tr bị trừ cả 171,99tr tạm ứng thầu phụ → còn lại −171,99tr).
//  • Công nợ Nhà Cung Cấp: bỏ phiếu thầu phụ (category subcontractor_advance / có subcontractorId); phiếu gắn mã NCC khác thì bỏ.
//  • Công nợ Thầu Phụ: bỏ phiếu "Chi Nhà Cung Cấp" (supplier_payment) — cùng nguyên tắc với hợp đồng thầu phụ.
import type { Liability, Payment } from '../types';

export function isPaymentForNamedLiability(liab: Pick<Liability, 'id' | 'category'>, p: Pick<Payment, 'category' | 'subcontractorId' | 'supplierId'>): boolean {
  if (liab.category === 'Nhà Cung Cấp') {
    if (p.subcontractorId || p.category === 'subcontractor_advance') return false;
    const supId = liab.id.startsWith('opbal_sup_') ? liab.id.slice('opbal_sup_'.length) : '';
    if (supId && p.supplierId && p.supplierId !== supId) return false;
    return true;
  }
  if (liab.category === 'Thầu Phụ') return p.category !== 'supplier_payment';
  return true;
}

// ─── KHỚP THEO MÃ (khóa chính) TRƯỚC, tên chỉ là phương án dự phòng ───
// Mã thầu phụ / mã NCC của 1 công nợ: ưu tiên cột subcontractorId; công nợ đầu kỳ có mã nằm trong id ('opbal_sub_<mã>' / 'opbal_sup_<mã>').
// Công nợ nhập tay hoàn toàn (không suy ra được mã) mới khớp theo tên người nhận.
export function liabilityKeys(l: Pick<Liability, 'id' | 'subcontractorId'>): { supplierId?: string; subcontractorId?: string } {
  if (l.subcontractorId) return { subcontractorId: l.subcontractorId };
  if (l.id?.startsWith('opbal_sub_')) return { subcontractorId: l.id.slice('opbal_sub_'.length) };
  if (l.id?.startsWith('opbal_sup_')) return { supplierId: l.id.slice('opbal_sup_'.length) };
  return {};
}

// ─── Công nợ thuộc về đơn vị nào? Khớp theo MÃ trước; công nợ nhập tay (không có mã) mới dự phòng theo tên + đúng loại ───
export function liabilityMatchesEntity(
  l: { id: string; name: string; category: string; subcontractorId?: string },
  entity: { id?: string; name?: string },
  kind: 'supplier' | 'subcontractor',
): boolean {
  const k = liabilityKeys(l);
  if (kind === 'subcontractor' && k.subcontractorId) return !!entity.id && k.subcontractorId === entity.id;
  if (kind === 'supplier' && k.supplierId) return !!entity.id && k.supplierId === entity.id;
  if (k.subcontractorId || k.supplierId) return false;           // có mã của LOẠI KHÁC → thuộc đơn vị khác
  if (l.category !== (kind === 'supplier' ? 'Nhà Cung Cấp' : 'Thầu Phụ')) return false;
  return !!entity.name && l.name === entity.name;                  // nhập tay không mã → dự phòng theo tên
}

/**
 * Công nợ NCC để ghi nhận 1 đơn mua hàng. Thứ tự: (1) công nợ đầu kỳ đúng mã NCC (opbal_sup_<mã>);
 * (2) công nợ đã ghi nhận đơn khác CỦA CÙNG NCC (theo mã NCC trên đơn); (3) dự phòng theo tên nhưng CHỈ khi tên đó khớp đúng 1 công nợ NCC
 * và công nợ ấy không thuộc NCC khác (mã khác trong id / đơn đã ghi nhận của NCC khác).
 */
export function findSupplierLiability<L extends Pick<Liability, 'id' | 'name' | 'category' | 'recordedPurchaseOrderIds'>>(
  liabs: L[],
  o: { supplierId?: string; supplierName?: string; orders: { id: string; supplierId?: string }[] },
): L | undefined {
  const ncc = liabs.filter(l => l.category === 'Nhà Cung Cấp');
  const orderSupplier = new Map(o.orders.map(x => [x.id, x.supplierId]));
  if (o.supplierId) {
    const byId = ncc.find(l => l.id === `opbal_sup_${o.supplierId}`);
    if (byId) return byId;
    const byOrders = ncc.find(l => (l.recordedPurchaseOrderIds || []).some(id => orderSupplier.get(id) === o.supplierId));
    if (byOrders) return byOrders;
  }
  const byName = ncc.filter(l => l.name === o.supplierName).filter(l => {
    const keySup = l.id.startsWith('opbal_sup_') ? l.id.slice('opbal_sup_'.length) : '';
    if (keySup && o.supplierId && keySup !== o.supplierId) return false;
    return !(l.recordedPurchaseOrderIds || []).some(id => o.supplierId && orderSupplier.get(id) && orderSupplier.get(id) !== o.supplierId);
  });
  return byName.length === 1 ? byName[0] : undefined;
}

/** Phiếu chi này có phải của thầu phụ (mã + tên)? Mã trước; chỉ phiếu cũ chưa gắn mã nào mới dự phòng theo tên (và không phải phiếu trả NCC). */
export function paymentBelongsToSubcontractor(
  p: Pick<Payment, 'category' | 'subcontractorId' | 'supplierId' | 'recipient'>,
  sub: { id?: string; name?: string },
): boolean {
  if (p.subcontractorId) return !!sub.id && p.subcontractorId === sub.id;
  if (p.supplierId || p.category === 'supplier_payment') return false;
  return !!sub.name && p.recipient === sub.name;
}
