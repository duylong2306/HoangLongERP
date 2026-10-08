// GIỜ CHUẨN CỦA CA — dùng khi DUYỆT báo cáo chấm công và hệ thống tự điền giờ (xem HumanResourcesManagement.handleApproveLeave và
// TaskManagement.handleApproveLeave). Trước đây giờ chuẩn viết cứng trong mã (07:30 / 11:30 / 13:00 / 17:00) nên đổi giờ ca trong
// Cài đặt ca làm việc thì phần tự điền bị lệch. Nay đọc từ cấu hình ca của doanh nghiệp (shift_config).
export interface ShiftTimes { morningIn: string; morningOut: string; afternoonIn: string; afternoonOut: string }

// Giá trị dự phòng khi doanh nghiệp chưa có cấu hình ca hoặc cấu hình sai định dạng
export const DEFAULT_SHIFT_TIMES: ShiftTimes = { morningIn: '07:30', morningOut: '11:30', afternoonIn: '13:00', afternoonOut: '17:00' };

// Chấp nhận "H:MM" hoặc "HH:MM" (giờ 0–23, phút 0–59) → chuẩn hóa "HH:MM"; sai định dạng → null
function normalizeHm(v: unknown): string | null {
  const m = typeof v === 'string' ? v.trim().match(/^(\d{1,2}):(\d{2})$/) : null;
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

/** Giờ chuẩn 4 mốc của ca sáng/chiều từ cấu hình; mốc nào thiếu/sai thì dùng mặc định cho riêng mốc đó. */
export function resolveShiftTimes(cfg?: Partial<ShiftTimes> | null): ShiftTimes {
  return {
    morningIn: normalizeHm(cfg?.morningIn) ?? DEFAULT_SHIFT_TIMES.morningIn,
    morningOut: normalizeHm(cfg?.morningOut) ?? DEFAULT_SHIFT_TIMES.morningOut,
    afternoonIn: normalizeHm(cfg?.afternoonIn) ?? DEFAULT_SHIFT_TIMES.afternoonIn,
    afternoonOut: normalizeHm(cfg?.afternoonOut) ?? DEFAULT_SHIFT_TIMES.afternoonOut,
  };
}
