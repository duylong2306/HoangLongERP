// ĐỀ XUẤT VẬT TƯ chờ duyệt cần NGƯỜI XÉT DUYỆT vật tư xử lý — hiển thị ở "Việc của tôi".
// Cùng quy tắc với MaterialCoordination.canApprove: Giám đốc/Admin, hoặc người được cấu hình "Người xét duyệt vật tư" (Quyền Phê Duyệt).
// Đề xuất ở trạng thái 'waiting_approval' (CHỜ DUYỆT) mới cần duyệt.
export interface MaterialProposalLite { id: string; status?: string; [k: string]: any }

export function isMaterialApprover(uid: string | undefined, username: string | undefined, isAdmin: boolean, approverIds: string[]): boolean {
  if (!uid) return false;
  return isAdmin || username === 'admin' || approverIds.includes(uid);
}

export function pendingMaterialForApprover(proposals: MaterialProposalLite[], canApprove: boolean): MaterialProposalLite[] {
  if (!canApprove) return [];
  return proposals.filter(p => p.status === 'waiting_approval');
}

/** Tổng giá trị đề xuất: ưu tiên báo giá đã chọn, nếu không thì cộng thành tiền các dòng vật tư. */
export function materialProposalTotal(p: MaterialProposalLite): number {
  const q = (p.quotes || []).find((x: any) => x.id === p.chosenQuoteId);
  const fromQuote = Number(q?.total ?? q?.totalAmount ?? 0);
  if (fromQuote > 0) return fromQuote;
  return (p.items || []).reduce((s: number, it: any) => s + (Number(it.totalPrice) || (Number(it.qty) || 0) * (Number(it.price) || 0)), 0);
}

// ─── VIỆC ĐIỀU PHỐI VẬT TƯ (không phải chờ duyệt — là việc cần LÀM) ───
// Người điều phối vật tư (cấu hình ở Quyền Phê Duyệt → "Người điều phối vật tư") có việc khi đề xuất đang:
//   • find_supplier  = "Tìm nhà cung cấp" (cần tìm NCC, nhập báo giá)
//   • waiting_order  = "Chờ đặt hàng"     (đã duyệt, cần tạo đơn đặt hàng)
// Chỉ người ĐƯỢC CHỈ ĐỊNH điều phối mới thấy ở "Việc của tôi" (khác quyền thao tác trong màn Điều Phối Vật Tư vốn rộng hơn theo nhóm).
export const COORDINATOR_STATUSES = ['find_supplier', 'waiting_order'] as const;
export const COORDINATOR_STATUS_LABEL: Record<string, string> = { find_supplier: 'Tìm nhà cung cấp', waiting_order: 'Chờ đặt hàng' };

export function pendingMaterialForCoordinator(proposals: MaterialProposalLite[], uid: string | undefined, coordinatorIds: string[]): MaterialProposalLite[] {
  if (!uid || !coordinatorIds.includes(uid)) return [];
  return proposals.filter(p => (COORDINATOR_STATUSES as readonly string[]).includes(String(p.status)));
}

/** Gộp: việc "chờ duyệt" + việc "điều phối" của 1 người — dùng chung cho Việc của tôi và huy hiệu menu. */
export function materialInboxFor(
  proposals: MaterialProposalLite[],
  user: { id?: string; username?: string } | null | undefined,
  ctx: { isAdmin: boolean; approverIds: string[]; coordinatorIds: string[] },
) {
  const toApprove = pendingMaterialForApprover(proposals, isMaterialApprover(user?.id, user?.username, ctx.isAdmin, ctx.approverIds));
  const toCoordinate = pendingMaterialForCoordinator(proposals, user?.id, ctx.coordinatorIds);
  return { toApprove, toCoordinate, count: toApprove.length + toCoordinate.length };
}
