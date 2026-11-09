import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

// Lỗi đã gặp: màn "Mẫu hồ sơ" của 4 loại báo giá (xây dựng / nội thất / cơ khí / thầu phụ) mở Estimator ở chế độ
// showTemplateOnly nhưng KHÔNG truyền currentUser → hasModulePermission(undefined, …) = false → nút "Chỉnh sửa" báo
// "Không đủ quyền" cho tất cả mọi người, kể cả admin. Test này giữ cho mọi chỗ mở mẫu đều truyền currentUser.
const src = fs.readFileSync('src/components/QuotationSystem.tsx', 'utf8');

describe('Mẫu hồ sơ báo giá — kiểm tra quyền Sửa', () => {
  it('mọi <…Estimator showTemplateOnly> đều truyền currentUser', () => {
    // Lấy từng khối thẻ có showTemplateOnly rồi kiểm tra có currentUser trong cùng thẻ
    const blocks = src.match(/<(?:Cabinet|Subcontractor|Construction|Mechanical)Estimator[^>]*?showTemplateOnly=\{true\}[^>]*?\/>/gs) || [];
    expect(blocks.length).toBe(4);
    blocks.forEach(b => expect(b).toContain('currentUser={currentUser}'));
  });
});
