// Báo nghỉ phép được duyệt lên nhóm "Điểm danh": nội dung (không lộ lý do), loại đơn bị bỏ qua, và gửi vào đúng nhóm.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sent: any[] = []; const ensured: any[] = [];
vi.mock('../chatStore', () => ({
  ATTENDANCE_CONV_ID: 'conv_attendance',
  ensureAttendanceChatGroup: vi.fn(async (m: any[]) => { ensured.push(m); return { id: 'conv_attendance' }; }),
  addMessage: vi.fn(async (m: any) => { sent.push(m); return m; }),
}));
import { buildLeaveAnnouncement, announceLeaveApproved } from '../leaveAnnounce';

const NOW = new Date('2026-10-27T09:00:00');
beforeEach(() => { sent.length = 0; ensured.length = 0; });

describe('buildLeaveAnnouncement', () => {
  it('nghỉ nhiều ngày: loại nghỉ, khoảng ngày, số ngày, người duyệt — KHÔNG có lý do', () => {
    const t = buildLeaveAnnouncement({ empName: 'Nguyễn A', type: 'Nghỉ phép năm', fromDate: '2026-10-28', toDate: '2026-10-30', daysCount: 3, reason: 'Đi khám bệnh' } as any, 'Trần B', NOW)!;
    expect(t).toBe('🌴 Nguyễn A nghỉ phép năm · 28/10 → 30/10 (3 ngày) · Trần B duyệt');
    expect(t).not.toContain('khám');
  });
  it('nghỉ 1 ngày cả ngày / 1 ca', () => {
    expect(buildLeaveAnnouncement({ empName: 'A', type: 'Nghỉ phép năm', fromDate: '2026-10-28', toDate: '2026-10-28', daysCount: 1 }, 'B', NOW)).toContain('ngày 28/10 (cả ngày)');
    expect(buildLeaveAnnouncement({ empName: 'A', type: 'Nghỉ phép năm', fromDate: '2026-10-28', toDate: '2026-10-28', daysCount: 0.5, shift: 'afternoon' }, 'B', NOW)).toContain('ngày 28/10 (ca chiều)');
  });
  it('nghỉ vắt qua năm khác: hiện năm để khỏi nhầm', () => {
    expect(buildLeaveAnnouncement({ empName: 'A', type: 'Nghỉ phép năm', fromDate: '2027-01-02', toDate: '2027-01-04', daysCount: 3 }, 'B', NOW)).toContain('02/01/2027 → 04/01/2027');
  });
  it('báo cáo chấm công / giải trình KHÔNG phải lịch nghỉ → không đăng', () => {
    expect(buildLeaveAnnouncement({ empName: 'A', type: 'Báo cáo nghỉ ca', fromDate: '2026-10-28', toDate: '2026-10-28', shift: 'morning' }, 'B', NOW)).toBeNull();
    expect(buildLeaveAnnouncement({ empName: 'A', type: 'Yêu cầu xét duyệt công', fromDate: '2026-10-28', toDate: '2026-10-28' }, 'B', NOW)).toBeNull();
    expect(buildLeaveAnnouncement({ empName: 'A', type: 'Nghỉ phép năm', fromDate: '2026-10-28', toDate: '2026-10-28', isAttendanceCorrection: true }, 'B', NOW)).toBeNull();
  });
});

describe('announceLeaveApproved', () => {
  it('gửi vào nhóm Điểm danh dạng tin hệ thống, thành viên = nhân viên có tài khoản', async () => {
    const ok = await announceLeaveApproved({ empName: 'A', type: 'Nghỉ phép năm', fromDate: '2026-10-28', toDate: '2026-10-29', daysCount: 2 }, 'B',
      [{ id: 'e1', hasSystemAccount: true }, { id: 'e2', hasSystemAccount: false }, { id: 'e3' }]);
    expect(ok).toBe(true);
    expect(ensured[0].map((e: any) => e.id)).toEqual(['e1', 'e3']);
    expect(sent[0]).toMatchObject({ conversationId: 'conv_attendance', senderId: 'system', system: true });
    expect(sent[0].content).toContain('B duyệt');
  });
  it('đơn không phải nghỉ phép → không gửi gì', async () => {
    expect(await announceLeaveApproved({ empName: 'A', type: 'Báo cáo nghỉ ca', fromDate: '2026-10-28', toDate: '2026-10-28' }, 'B', [{ id: 'e1' }])).toBe(false);
    expect(sent.length).toBe(0);
  });
});
