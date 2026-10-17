// AI THẤY / DUYỆT PHIẾU CHI & ĐỀ XUẤT CHI — một quy tắc dùng chung cho "Việc của tôi" và huy hiệu menu (trước đây 2 nơi 2 quy tắc).
// Khớp theo MÃ nhân viên (approverId / proposerId / employeeId); tên chỉ là dự phòng cho bản ghi cũ CHƯA có mã.
// → Hai nhân viên trùng tên, hoặc nhân viên đổi tên, không còn thấy/duyệt nhầm phiếu của nhau.
import type { Payment, SubcontractorAdvanceProposal } from '../types';

type User = { id?: string; name?: string };
const nameEq = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/** Phiếu chi CHỜ DUYỆT mà người này có thẩm quyền duyệt. isAdmin / isConfiguredApprover do nơi gọi truyền vào (Quyền Phê Duyệt). */
export function isPaymentPendingForUser(p: Payment, u: User, ctx: { isAdmin: boolean; isConfiguredApprover: boolean }): boolean {
  if (p.status !== 'pending') return false;
  if (ctx.isAdmin || ctx.isConfiguredApprover) return true;
  if (p.approverId) { if (u.id && p.approverId === u.id) return true; }
  else if (p.approver && u.name && (p.approver === u.name || p.approver.toLowerCase().includes(u.name.toLowerCase()))) return true;   // bản ghi cũ chưa có approverId: dung sai "Tên (Chức danh)"
  return !!p.approvals?.some(ap => (u.id && ap.approverId === u.id) || (u.name && ap.approverId === u.name));
}

/**
 * Đề xuất chi (advance) CHỜ DUYỆT mà người này duyệt được. Cột approver của đề xuất lưu MÃ người duyệt; chỉ khi approver rỗng
 * hoặc không phải mã của nhân viên nào (vd chữ "Ban Giám Đốc" mặc định) thì mới dự phòng theo tên (approverName).
 */
export function isAdvancePendingForUser(a: SubcontractorAdvanceProposal, u: User, ctx: { isAdmin: boolean; isConfiguredApprover: boolean; employeeIds?: Set<string> }): boolean {
  if (a.status !== 'pending_approval') return false;
  if (ctx.isAdmin || ctx.isConfiguredApprover) return true;
  if (u.id && a.approver === u.id) return true;
  const approverIsKnownEmployee = !!a.approver && !!ctx.employeeIds?.has(a.approver);
  if (!approverIsKnownEmployee && nameEq(a.approverName, u.name)) return true;
  return !!a.approvals?.some(ap => (u.id && ap.approverId === u.id) || (u.name && ap.approverId === u.name));
}

/** Phiếu chi do người này LẬP (proposerId; phiếu cũ chưa có mã mới so theo tên). */
export function isPaymentProposedBy(p: Pick<Payment, 'proposerId' | 'proposer'>, u: User): boolean {
  return p.proposerId ? p.proposerId === u.id : nameEq(p.proposer, u.name);
}

/** Phiếu chi liên quan tới người này (người lập / người nhận là nhân viên này / người duyệt) — dùng cho "Xóa bộ nhớ tạm". */
export function isPaymentRelatedToUser(p: Payment, u: User): boolean {
  if (isPaymentProposedBy(p, u)) return true;
  if (p.approverId ? p.approverId === u.id : nameEq(p.approver, u.name)) return true;
  // người nhận: theo mã nhân viên; phiếu cũ chưa có mã (và không phải NCC/thầu phụ) mới dự phòng theo tên
  return p.employeeId ? p.employeeId === u.id : (!p.supplierId && !p.subcontractorId && nameEq(p.recipient, u.name));
}
