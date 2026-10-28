// Thanh menu dưới trên điện thoại: không còn khoảng trắng thừa dưới chữ (chỉ chừa vừa đủ vạch home), mọi chỗ chừa chỗ cho thanh menu dùng cùng một giá trị.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const css = fs.readFileSync(path.resolve(__dirname, '../shell/shell.css'), 'utf8');

describe('thanh menu dưới (điện thoại)', () => {
  it('đệm dưới chữ = nửa vùng an toàn (tối thiểu 6px) + 4px, không còn chừa trọn vùng an toàn', () => {
    expect(css).toMatch(/--lx-bsafe:\s*max\(calc\(var\(--lx-safe-bottom\) \* 0\.5\), 6px\)/);
    expect(css).toMatch(/\.lx-bnav\s*\{[^}]*padding:\s*6px 4px calc\(var\(--lx-bsafe\) \+ 4px\)/);
    expect(css).not.toMatch(/\.lx-bnav\s*\{[^}]*padding:[^;]*var\(--lx-safe-bottom\)/);
  });
  it('nội dung và thẻ nhắc cài đặt chừa chỗ đúng bằng chiều cao thanh menu (không dư, không thiếu)', () => {
    expect(css).toMatch(/\.lx-main-pad\s*\{\s*padding-bottom:\s*calc\(var\(--lx-bnav\) \+ var\(--lx-bsafe\)\)/);
    expect(css).toMatch(/\.lx-sb\s*\{[^}]*calc\(var\(--lx-bnav\) \+ var\(--lx-bsafe\) \+ 14px\)/);
    expect(css).toMatch(/\.lx-install\s*\{[^}]*bottom:\s*calc\(var\(--lx-bnav\) \+ var\(--lx-bsafe\) \+ 10px\)/);
    // không còn chỗ nào cộng --lx-bnav với trọn vùng an toàn
    expect(css).not.toMatch(/var\(--lx-bnav\)\s*\+\s*var\(--lx-safe-bottom\)/);
  });
  it('trong khung ứng dụng: chỉ một dải xanh LoLo 120px ở mép trên, KHÔNG lặp, phần còn lại (kể cả dưới thanh menu) trắng; nền body trắng trên điện thoại; trang ngoài khung giữ nền xanh', () => {
    expect(css).toMatch(/html:has\(\.lx-shell\)\s*\{\s*background:\s*linear-gradient\(#0a4fd8, #0a4fd8\) top left \/ 100% 120px no-repeat #ffffff;/);
    expect(css).not.toMatch(/html:has\(\.lx-shell\)\s*\{[^}]*50%/);   // không còn gradient 50/50 (bị lặp → cằm xanh)
    expect(css).toMatch(/@media \(max-width: 767px\)\s*\{\s*body:has\(\.lx-shell\)\s*\{\s*background-color:\s*#ffffff/);
    expect(css).toMatch(/\nhtml\s*\{\s*background:\s*#0a4fd8;\s*\}/);   // quy tắc cũ cho trang đăng nhập / giới thiệu vẫn còn
  });
});
