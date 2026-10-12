import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

// Chống tái phát lỗi "mở app chậm": BƯỚC 2 của App.tsx (lấy nhân viên để đăng nhập) chỉ được gọi RPC nhẹ list_employees_safe,
// KHÔNG được tải toàn bộ dữ liệu bằng loadAllCore() (~6MB, ~6s với Hoàng Long) — phần đó đã do BƯỚC 3 tải nền.
describe('App.tsx — khởi tạo', () => {
  const src = fs.readFileSync('src/App.tsx', 'utf8');
  const b2 = src.indexOf('BƯỚC 2: Fetch employees');
  const b3 = src.indexOf('BƯỚC 3: Sync cloud');
  it('BƯỚC 2 không gọi loadAllCore, dùng employees.list', () => {
    expect(b2).toBeGreaterThan(0);
    expect(b3).toBeGreaterThan(b2);
    const block = src.slice(b2, b3);
    expect(block).not.toMatch(/loadAllCore\(\)\s*;/);
    expect(block).toMatch(/dbService\.employees\.list\(\)/);
  });
  it('BƯỚC 3 vẫn tải dữ liệu đầy đủ bằng loadAllCore', () => {
    expect(src.slice(b3, b3 + 1500)).toMatch(/dbService\.loadAllCore\(\)/);
  });
});
