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
