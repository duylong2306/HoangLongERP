// ─── Trạng thái Công Tác Phí (CTP) ─────────────────────────────────────────
// CTP trải qua quy trình xét duyệt:
//   pending   → Chờ duyệt (mặc định khi người phụ trách nhiệm vụ thêm mới)
//   approved  → Đã duyệt (người được cấu hình xét duyệt duyệt)
//   rejected  → Từ chối
//   completed → dữ liệu CŨ (trước khi có quy trình xét duyệt) — hiển thị như
//               "Đã duyệt" để tương thích ngược, KHÔNG đổi dữ liệu trong DB.
export type CTPStatus = 'pending' | 'approved' | 'rejected' | 'completed';

// Nhãn hiển thị cho từng trạng thái (dùng chung cho badge + bộ lọc + Excel)
export const CTP_STATUS_LABEL: Record<CTPStatus, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  completed: 'Đã duyệt',
};

// Nhãn hiển thị an toàn cho giá trị bất kỳ (fallback '—' nếu không hợp lệ)
export function ctpStatusLabel(status?: string): string {
  if (!status) return '';
  if (status === 'pending' || status === 'approved' || status === 'rejected' || status === 'completed') {
    return CTP_STATUS_LABEL[status];
  }
  return '';
}
