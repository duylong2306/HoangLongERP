// Trang đăng nhập trên điện thoại: không kéo ngang, khóa zoom.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

describe('trang đăng nhập — khóa cuộn ngang và zoom', () => {
  const login = read('src/components/Login.tsx');
  it('khung đăng nhập cắt tràn ngang (overflow-x-hidden), vừa bề ngang, chỉ cho vuốt dọc', () => {
    const m = /<div className="([^"]*)" style=\{\{ touchAction: 'pan-y' \}\} data-testid="login-root">/.exec(login);
    expect(m, 'không thấy khung đăng nhập').not.toBeNull();
    for (const c of ['overflow-x-hidden', 'overflow-y-auto', 'max-w-full']) expect(m![1]).toContain(c);
  });
  it('ô nhập trong thẻ đăng nhập có chữ 16px trên điện thoại (iOS không tự phóng to khi chạm vào ô)', () => {
    const css = read('src/components/shell/shell.css');
    expect(css).toMatch(/@media \(max-width: 767px\)\s*\{\s*#login_form_card input, #login_form_card select, #login_form_card textarea\s*\{\s*font-size:\s*16px/);
    expect(login).toContain('id="login_form_card"');
  });
  it('viewport vẫn khóa phóng to và chặn cử chỉ chụm 2 ngón', () => {
    const html = read('index.html');
    expect(html).toMatch(/maximum-scale=1\.0[^"]*user-scalable=no/);
    expect(html).toMatch(/gesturestart/);
    expect(read('src/components/shell/shell.css')).toMatch(/html, body \{ touch-action: pan-x pan-y; \}/);
  });
});
