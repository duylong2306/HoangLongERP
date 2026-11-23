/**
 * Dọn đơn mua hàng "treo" khi XÓA VĨNH VIỄN một đề xuất vật tư đã HỦY.
 *
 * Bối cảnh: hủy đề xuất KHÔNG tự hủy đơn mua hàng sinh ra từ nó. Tính chi phí công trình
 * (projectCost.ts → isVoidedByProposal) bỏ các đơn đó nhờ nhìn thấy đề xuất ở trạng thái 'cancelled'.
 * Nhưng đề xuất hủy bị TỰ XÓA sau 30 ngày (và có nút xóa tay) → mất "dấu hiệu hủy" → đơn treo
 * quay lại bị tính vào chi phí / công nợ. Vì vậy, TRƯỚC KHI xóa đề xuất phải hủy hẳn các đơn treo của nó.
 *
 * Chỉ hủy đơn chắc chắn là thừa: đang 'confirmed' (chưa hoàn tất), chưa chi đồng nào, chưa có phiếu
 * nhập, chưa nhận dòng hàng nào, chưa được ghi nhận vào công nợ NCC. Đơn đã có tiền/hàng/công nợ giữ nguyên
 * (cần kế toán xử lý tay) — tuyệt đối không tự động hủy.
 */

export interface VoidablePo {
  id: string;
  status?: string;
  proposalId?: string;
  thanhToanThucTe?: number;
  receiptId?: string | null;
  items?: any[];
}

/** Đơn có dòng hàng nào đã nhận (receivedQty > 0) không. */
const hasReceivedQty = (po: VoidablePo): boolean =>
  (po.items || []).some((it: any) => Number(it?.receivedQty) > 0);

/**
 * Trả về các đơn cần chuyển sang 'cancelled' khi xóa đề xuất `proposal`.
 * @param recordedPoIds  mã các đơn ĐÃ ghi nhận vào công nợ NCC (không được tự hủy)
 */
export function ordersToVoidOnProposalDelete(
  proposal: { id: string; purchaseOrderIds?: string[] },
  orders: VoidablePo[],
  recordedPoIds: Set<string> = new Set()
): VoidablePo[] {
  const linked = new Set(proposal.purchaseOrderIds || []);
  return orders.filter(o =>
    // đơn thuộc đề xuất này: theo proposalId hoặc theo danh sách đơn của đề xuất
    (o.proposalId === proposal.id || linked.has(o.id)) &&
    // chỉ đơn đang đặt hàng; đơn 'completed' = hàng đã về thật → giữ
    o.status === 'confirmed' &&
    !(Number(o.thanhToanThucTe) > 0) &&
    !o.receiptId &&
    !hasReceivedQty(o) &&
    !recordedPoIds.has(o.id)
  );
}
