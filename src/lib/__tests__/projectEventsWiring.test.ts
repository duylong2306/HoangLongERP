// Chốt các điểm nối của Nhật ký dự án (kiểm bằng đọc mã nguồn, như các test "wiring" khác của dự án):
// thông báo hệ thống đi qua nhật ký thay vì nhắn thẳng vào nhóm chat, và các sự kiện trước đây bị bỏ sót đã có chỗ ghi.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, '../../', rel), 'utf8');
const kanban = read('components/ProjectKanbanBoard.tsx');
const taskModal = read('components/TaskDetailModal.tsx');
const app = read('App.tsx');
const zalo = read('components/MessagesZalo.tsx');

describe('Nhật ký dự án — điểm nối', () => {
  it('hàm notifyProjectChat của Kanban và chi tiết công việc đi qua postProjectNotice (không còn nhắn thẳng vào nhóm)', () => {
    for (const src of [kanban, taskModal]) {
      const i = src.indexOf('const notifyProjectChat = ');
      const body = src.slice(i, src.indexOf('\n  };', i));
      expect(body).toContain('postProjectNotice(');
      expect(body).not.toContain('sendGroupChatMessage(');
    }
  });
  it('các sự kiện trước đây không có dấu vết nay đã được ghi', () => {
    // Mẫu chữ mới (messageTemplates): không có tên người, không có "đã" — giao diện in sẵn tên người làm
    // dự án: tạo / xóa / đổi trạng thái / chuyển giai đoạn
    expect(app).toMatch(/Tạo dự án:/); expect(app).toMatch(/Xóa dự án:/); expect(app).toMatch(/Trạng thái dự án/);
    expect(kanban).toMatch(/Giai đoạn dự án/);
    // công việc: xóa / đổi tên / đổi hạn / đổi ưu tiên / nhận việc ở Tổng quan; nhiệm vụ: nhận nhiệm vụ
    expect(app).toMatch(/Xóa công việc:/); expect(app).toMatch(/Đổi tên công việc/); expect(app).toMatch(/Đổi hạn công việc/);
    expect(app).toMatch(/Đổi ưu tiên/); expect(app).toMatch(/nk\.nhanViec/); expect(app).toMatch(/Nhận nhiệm vụ:/);
    // chi tiết công việc: đổi thầu phụ / checklist / xóa công tác phí / nhập Excel / gửi duyệt
    expect(taskModal).toMatch(/nk\.doiThauPhu/); expect(taskModal).toMatch(/nk\.tichMuc/); expect(taskModal).toMatch(/nk\.xoaCongTacPhi/);
    expect(taskModal).toMatch(/nk\.nhapExcel/); expect(taskModal).toMatch(/nk\.guiDuyetHoanThanh/);
  });
  it('xóa dự án ghi nhật ký TRỰC TIẾP (không qua postProjectNotice vì sẽ tạo lại nhóm chat của dự án sắp xóa)', () => {
    const i = app.indexOf('const handleDeleteProject');
    const body = app.slice(i, i + 900);
    expect(body).toContain('recordProjectEvent(');
    expect(body).not.toContain('logProjectEvt(');
  });
  it('nút "Nhật ký dự án" cạnh nút "Mở dự án" trong Tin nhắn; chữ "Công trình" đã đổi thành "Dự án"', () => {
    expect(zalo).toContain('zalo-open-activity');
    expect(zalo).toContain('>Mở dự án<');
    expect(zalo).not.toContain('>Mở công trình<');
  });
});
