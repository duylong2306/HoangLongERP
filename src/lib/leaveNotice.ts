// QUY ĐỊNH "XIN NGHỈ PHÉP PHẢI BÁO TRƯỚC" — số ngày báo trước do doanh nghiệp cấu hình trong Cấu Hình Ca (leaveAdvanceDays, nhập được số
// thập phân: 0,5 ngày = 12 giờ). Trước đây quy định này viết cứng "2 ngày" và chặn cứng trong form xin nghỉ của nhân viên.
//
// Cách tính: thời gian báo trước = từ lúc NỘP ĐƠN đến GIỜ VÀO CA SÁNG của ngày bắt đầu nghỉ (giờ vào ca đọc từ cấu hình ca), đổi ra ngày.
//   VD báo trước 1 ngày; nghỉ ngày 10/10 (vào ca 07:30) → phải nộp trước 07:30 ngày 09/10.
// Chỉ áp dụng cho đơn nghỉ phép THẬT. Các báo cáo giải trình chấm công (nghỉ ca / lỗi chấm ra ca / lỗi hệ thống) nộp sau sự việc nên không áp dụng.
import { isAttendanceReportType } from './attendanceMeta';

export const DEFAULT_LEAVE_ADVANCE_DAYS = 1;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Có phải đơn nghỉ phép thật (chịu quy định báo trước) không? */
export function isRealLeaveType(type?: string): boolean {
  return !!type && !isAttendanceReportType(type) && type !== 'Yêu cầu xét duyệt công';
}

/** Chuẩn hóa số ngày cấu hình: số hữu hạn ≥ 0, chấp nhận thập phân; thiếu/sai → mặc định 1 ngày. (0 = không yêu cầu báo trước) */
export function normalizeAdvanceDays(v: unknown): number {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_LEAVE_ADVANCE_DAYS;
}

/** Thời điểm bắt đầu nghỉ = ngày bắt đầu nghỉ + giờ vào ca sáng (giờ địa phương của trình duyệt). */
export function leaveStartMoment(fromDate: string, morningIn: string): Date {
  const hm = /^(\d{1,2}):(\d{2})$/.exec(String(morningIn || '').trim());
  const [h, m] = hm ? [Number(hm[1]), Number(hm[2])] : [7, 30];
  const [y, mo, d] = String(fromDate).split('-').map(Number);
  return new Date(y, (mo || 1) - 1, d || 1, h, m, 0, 0);
}

export interface LeaveNotice { late: boolean; advanceDays: number; requiredDays: number }

/** Đơn nộp lúc `now` cho kỳ nghỉ bắt đầu `fromDate` có đủ thời gian báo trước không? */
export function evaluateLeaveNotice(p: { fromDate: string; now: Date; morningIn: string; requiredDays: unknown }): LeaveNotice {
  const requiredDays = normalizeAdvanceDays(p.requiredDays);
  const advanceDays = (leaveStartMoment(p.fromDate, p.morningIn).getTime() - p.now.getTime()) / MS_PER_DAY;
  return { late: requiredDays > 0 && advanceDays < requiredDays, advanceDays, requiredDays };
}

/** Hiển thị số ngày kiểu Việt Nam, tối đa 2 chữ số thập phân, bỏ số 0 thừa (1 → "1", 0.5 → "0,5", -0.25 → "-0,25"). */
export function formatDays(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

// ── Đánh dấu "Xin muộn" ngay trong nội dung lý do (không cần thêm cột trong cơ sở dữ liệu) ──
// Dạng: "[XIN MUỘN: báo trước 0,3 ngày, quy định 1 ngày] <lý do>". Mọi nơi hiển thị lý do đều thấy; giao diện đọc lại để hiện nhãn.
const TAG_RE = /^\[XIN MUỘN: ([^\]]*)\]\s*/;

export function tagLateNoticeReason(reason: string, n: LeaveNotice): string {
  const adv = n.advanceDays < 0 ? 'đã quá hạn' : `báo trước ${formatDays(n.advanceDays)} ngày`;
  return `[XIN MUỘN: ${adv}, quy định ${formatDays(n.requiredDays)} ngày] ${reason}`;
}

/** Đọc lại dấu "Xin muộn" từ lý do: { late, detail, reason (đã bỏ dấu) }. */
export function parseLateNotice(reason?: string): { late: boolean; detail: string; reason: string } {
  const m = TAG_RE.exec(reason || '');
  return m ? { late: true, detail: m[1], reason: (reason || '').replace(TAG_RE, '') } : { late: false, detail: '', reason: reason || '' };
}
