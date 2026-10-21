import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

// Ngăn kéo Dự án / Chi tiết công việc theo ngôn ngữ thiết kế mới: tiêu đề xanh LoLo né tai thỏ, nút không tràn, phủ kín thanh dưới.
const css = fs.readFileSync('src/components/shell/shell.css', 'utf8');
const proj = fs.readFileSync('src/components/ProjectKanbanBoard.tsx', 'utf8');
const task = fs.readFileSync('src/components/TaskDetailModal.tsx', 'utf8');

describe('Ngăn kéo chi tiết — đồng bộ thiết kế mới', () => {
  it('tiêu đề dùng lớp lx-drawer-head (chừa vùng an toàn, nền xanh LoLo) ở cả Dự án và Công việc', () => {
    expect(proj).toContain('lx-drawer-head'); expect(task).toContain('lx-drawer-head');
    expect(css).toMatch(/\.lx-drawer-head[^{]*\{[^}]*safe-area|\.lx-drawer-head[^{]*\{[^}]*var\(--lx-safe-top\)/);
  });
  it('hàng nút của Dự án tự xuống dòng (không tràn mép phải); nút đóng gọn thành biểu tượng trên điện thoại', () => {
    expect(proj).toContain('lx-dh-actions'); expect(css).toMatch(/\.lx-dh-actions\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(css).toMatch(/max-width:\s*767px\)\s*\{[^}]*lx-dh-close-text[^}]*display:\s*none/);
    expect(proj).toContain('project-detail-close'); expect(task).toContain('task-detail-close');
  });
  it('thanh dưới điện thoại nằm DƯỚI ngăn kéo/hộp thoại chi tiết (z-index) để chúng phủ kín màn hình', () => {
    const nav = Number(/\.lx-bnav\s*\{[^}]*z-index:\s*(\d+)/.exec(css)![1]);
    expect(nav).toBeLessThan(50);                              // ngăn kéo dự án dùng z-50, chi tiết công việc z-[110]
    expect(proj).toMatch(/z-50 animate-fade-in/);
    expect(task).toMatch(/z-\[110\]/);
    expect(Number(/\.lx-sheet\s*\{[^}]*z-index:\s*(\d+)/.exec(css)![1])).toBeLessThan(nav);   // trang Danh mục dưới thanh dưới
  });
  it('điện thoại: chi tiết dự án chia 2 thẻ Thông tin | Công việc, không để danh sách công việc che hết thông tin', () => {
    expect(proj).toContain('project-mobile-tabs');
    expect(proj).toMatch(/mobileTab === 'info' \? '' : 'max-lg:hidden'/);    // cột thông tin ẩn khi đang ở thẻ Công việc
    expect(proj).toMatch(/mobileTab === 'tasks' \? '' : 'max-lg:hidden'/);   // cột công việc ẩn khi đang ở thẻ Thông tin
    expect(proj).toMatch(/useEffect\(\(\) => \{ setMobileTab\('info'\); \}, \[selectedProjectId\]\)/);   // mở dự án khác → về thẻ Thông tin
    expect(proj).toMatch(/lg:hidden shrink-0 grid grid-cols-2/);                // thanh thẻ chỉ hiện dưới 1024px
  });
});
