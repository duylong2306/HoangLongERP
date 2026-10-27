// Báo lên nhóm chat "Điểm danh" khi 1 đơn NGHỈ PHÉP được duyệt — để mọi người biết ai nghỉ những ngày nào và chủ động sắp xếp công việc.
// Quy tắc nội dung: KHÔNG hiện lý do nghỉ (chuyện riêng của nhân viên, VD nghỉ ốm); chỉ báo loại nghỉ, ngày, số ngày và người duyệt.
// Chỉ báo đơn nghỉ phép THẬT — các báo cáo giải trình chấm công (nghỉ ca, lỗi chấm công...) không phải lịch nghỉ nên không đăng.
import { addMessage, ensureAttendanceChatGroup, ATTENDANCE_CONV_ID } from './chatStore';
import { isRealLeaveType } from './leaveNotice';
import { baoNghiPhep } from './messageTemplates';

export interface ApprovedLeave {
  empName: string;
  type: string;
  fromDate: string;      // YYYY-MM-DD
  toDate: string;
  daysCount?: number;
  shift?: string;        // 'morning' | 'afternoon' khi nghỉ 1 ca
  isAttendanceCorrection?: boolean;
}

/** Nội dung tin báo nghỉ; null nếu đơn này không cần báo (không phải nghỉ phép thật). Mẫu chữ: messageTemplates.baoNghiPhep */
export function buildLeaveAnnouncement(l: ApprovedLeave, approverName: string, now?: Date): string | null {
  if (l.isAttendanceCorrection || !isRealLeaveType(l.type)) return null;
  return baoNghiPhep({ empName: l.empName, type: l.type, fromDate: l.fromDate, toDate: l.toDate, daysCount: l.daysCount, shift: l.shift, approver: approverName, now });
}

/**
 * Đăng tin báo nghỉ vào nhóm "Điểm danh" (tạo nhóm nếu chưa có, đủ thành viên). Có push cho cả nhóm (chủ dự án đã chọn).
 * Không bao giờ ném lỗi: báo nghỉ chỉ là thông tin thêm, không được làm hỏng việc duyệt đơn.
 */
export async function announceLeaveApproved(l: ApprovedLeave, approverName: string, employees: { id: string; hasSystemAccount?: boolean }[]): Promise<boolean> {
  try {
    const content = buildLeaveAnnouncement(l, approverName);
    if (!content) return false;
    const members = (employees || []).filter(e => e.hasSystemAccount !== false);
    const conv = await ensureAttendanceChatGroup(members);
    if (!conv) return false;
    await addMessage({
      conversationId: ATTENDANCE_CONV_ID,
      senderId: 'system',
      senderName: 'Hệ Thống',
      senderRole: 'system' as any,
      content,
      system: true,
    });
    return true;
  } catch (e) {
    console.warn('Báo nghỉ phép lên nhóm Điểm danh lỗi (bỏ qua):', e);
    return false;
  }
}
