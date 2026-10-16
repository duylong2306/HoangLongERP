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
