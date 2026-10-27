// Tiêu đề / nội dung push của tin hệ thống (xem pushText.ts)
import { describe, it, expect } from 'vitest';
import { buildPushText } from '../pushText';
import * as MT from '../messageTemplates';

const dm = { type: 'personal', name: '' };
const grp = { type: 'group', name: 'Nhà anh Tuấn' };

describe('buildPushText', () => {
  it('cần duyệt: tiêu đề = loại việc, nội dung có người gửi + số liệu + lý do', () => {
    const content = MT.canDuyetNghiPhep({ type: 'Nghỉ phép năm', fromDate: '2026-10-28', toDate: '2026-10-30', daysCount: 3, reason: 'Việc gia đình' });
    const r = buildPushText({ senderId: 'e1', senderName: 'Nguyễn A', content, relatedEntity: { type: 'leave', id: 'LR-1' } }, dm);
    expect(r.title).toBe('🔔 Cần duyệt nghỉ phép');
    expect(r.body).toBe('Nguyễn A · Nghỉ phép năm · 28/10 → 30/10 (3 ngày)\nLý do: Việc gia đình');
  });
  it('giao việc / kết quả duyệt', () => {
    const g = buildPushText({ senderId: 'e1', senderName: 'Long', content: MT.giaoViec({ task: 'Lắp tủ bếp', deadline: '2026-10-30', project: 'Nhà anh Tuấn' }), relatedEntity: { type: 'task', id: 'T1' } }, dm);
    expect(g).toEqual({ title: '📌 Giao việc', body: 'Long · Lắp tủ bếp · Hạn 30/10 · Nhà anh Tuấn' });
    const k = buildPushText({ senderId: 'e2', senderName: 'Kế toán', content: MT.ketQuaPhieuChi(true, { code: 'PC-012', amount: 12000000, recipient: 'Công ty ABC' }), relatedEntity: { type: 'payment', id: 'p' } }, dm);
    expect(k.title).toBe('✅ Đã duyệt phiếu chi PC-012');   // mã phiếu nằm ngay trong tiêu đề
    expect(k.body).toBe('Kế toán · 12.000.000đ · Công ty ABC');
  });
  it('tin nhóm: thêm tên nhóm vào tiêu đề, không thêm tên người gửi vào nội dung', () => {
    const r = buildPushText({ senderId: 'e1', senderName: 'Long', content: '🔔 Cần duyệt hoàn thành: Công việc X', relatedEntity: { type: 'task', id: 'T1' } }, grp);
    expect(r.title).toBe('🔔 Cần duyệt hoàn thành · Nhà anh Tuấn');
    expect(r.body).toBe('Công việc X');
  });
  it('tin hệ thống không có dấu ":" (báo nghỉ / nhắc điểm danh) → tiêu đề là tên nhóm', () => {
    const r = buildPushText({ senderId: 'system', senderName: 'Hệ Thống', content: '🌴 Nguyễn A nghỉ phép năm · 28/10 → 30/10 (3 ngày) · Trần B duyệt' }, { type: 'group', name: 'Điểm danh' });
    expect(r.title).toBe('🌴 Điểm danh');
    expect(r.body).toBe('Nguyễn A nghỉ phép năm · 28/10 → 30/10 (3 ngày) · Trần B duyệt');
  });
  it('tin người dùng tự gõ giữ nguyên (kể cả bắt đầu bằng biểu tượng)', () => {
    expect(buildPushText({ senderId: 'e1', senderName: 'Long', content: '✅ Xong: mai giao hàng' }, grp)).toEqual({ title: 'Long', body: '✅ Xong: mai giao hàng' });
  });
});

// Kiểm tra từng mẫu: dòng đầu đúng quy tắc, không còn tên người / chữ thừa
describe('messageTemplates', () => {
  const T = MT;
  it('định dạng ngày & tiền', () => {
    const y = new Date().getFullYear();
    expect(T.fmtDay(`${y}-10-30`)).toBe('30/10');
    expect(T.fmtDay('2099-01-02')).toBe('02/01/2099');
    expect(T.fmtMoney(12000000)).toBe('12.000.000đ');
    expect(T.fmtRange(`${y}-10-28`, `${y}-10-28`)).toBe('28/10');
  });
  it('tin cần duyệt đều mở đầu 🔔 (để bấm push mở đúng nơi duyệt) và không có chữ thừa', () => {
    const all = [
      T.canDuyetHoanThanh({ task: 'X', project: 'P' }),
      T.canDuyetTamUngThauPhu({ code: 'TU-1', amount: 1000000, subcontractor: 'Z', task: 'X', reason: 'r' }),
      T.canDuyetDeXuatChi({ loai: 'chi khác', code: 'DX-1', amount: 5000, project: 'P', reason: 'r' }),
      T.canDuyetNghiPhep({ type: 'Nghỉ phép năm', fromDate: '2099-01-02', toDate: '2099-01-04', daysCount: 3, reason: 'r' }),
      T.canDuyetChamCong({ type: 'Lỗi chấm ra ca', wholeDay: true, date: '2099-01-02', reason: 'r' }),
      T.canDuyetTamUngLuong({ code: 'TL-1', amount: 3000000, reason: 'r' }),
      T.canDuyetCongTacPhi({ content: 'Xăng xe', amount: 500000, employee: 'B', mission: 'M' }),
      T.canDuyetLienThong({ step: 'Duyệt dán chỉ', approver: 'V' }),
    ];
    all.forEach(m => { expect(m.startsWith('🔔 Cần duyệt')).toBe(true); expect(m).not.toMatch(/Vui lòng|Kính trình|HỆ THỐNG/); });
  });
  it('thẻ giao việc trong chat có tên người nhận; ghi chú liên thông gọn, không còn chữ "Kính trình"', () => {
    expect(T.giaoViec({ task: 'Lắp tủ', assignee: 'Hùng', deadline: '2099-01-02', project: 'P' })).toBe('📌 Giao việc: Lắp tủ · giao Hùng · Hạn 02/01/2099 · P');
    expect(T.canDuyetLienThong({ step: 'Yêu cầu phê duyệt công việc', approver: 'V' })).toBe('🔔 Cần duyệt liên thông: Yêu cầu phê duyệt công việc · Người duyệt: V');
  });
  it('kết quả duyệt: ✅/❌ + đối tượng + số liệu', () => {
    expect(T.ketQuaCongTacPhi(true, { content: 'Xăng xe', amount: 500000, mission: 'M' })).toBe('✅ Đã duyệt công tác phí: Xăng xe · 500.000đ · nhiệm vụ M');
    expect(T.ketQuaTamUng(false, { code: 'TU-1', amount: 1000000, task: 'X' })).toBe('❌ Từ chối tạm ứng TU-1: 1.000.000đ · X');
    expect(T.ketQuaTamUng(true, { code: 'TU-1', amount: 1000000, task: 'X' })).toContain('Chờ lập phiếu');
  });
  it('nhật ký: phân loại sự kiện vẫn đúng với chữ mới', async () => {
    const { classifyEvent } = await import('../projectEvents');
    expect(classifyEvent(T.nk.nhanViec('X')).type).toBe('tt');
    expect(classifyEvent(T.nk.hoanThanhViec('X')).type).toBe('tt');
    expect(classifyEvent(T.nk.duyetHoanThanh(true, 'X')).type).toBe('duyet');
    expect(classifyEvent(T.nk.taoNhiemVu({ mission: 'M', task: 'T' })).type).toBe('tao');
    expect(classifyEvent(T.nk.gan({ who: 'B', mission: 'M' })).type).toBe('giao');
    expect(classifyEvent(T.nk.xoaCongTacPhi({ content: 'N', mission: 'M' })).type).toBe('xoa');
    expect(classifyEvent(T.nk.deXuatVatTu({ code: 'VT-1', project: 'P', lines: ['• a × 1 cái'] })).type).toBe('tc');
    expect(classifyEvent('⏰ Đổi hạn công việc X').type).toBe('han');
  });
});
