import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { lastMenuKey, readLastMenu, writeLastMenu } from '../lastMenu';

// Ghi nhớ menu dùng gần nhất cho phiên sau + bố cục Tin nhắn cố định chiều cao trên điện thoại (ô nhập không bị cuộn mất).
const mem = () => { const m: Record<string, string> = {}; return { getItem: (k: string) => (k in m ? m[k] : null), setItem: (k: string, v: string) => { m[k] = v; } }; };

describe('lastMenu', () => {
  it('lưu rồi đọc lại đúng trang + tab con; mỗi người một khóa riêng', () => {
    const s = mem(); const k = lastMenuKey('u1');
    writeLastMenu(k, { tab: 'finance', fin: 'du_lieu_ke_toan', hr: 'profiles', dir: 'summary' }, s);
    expect(readLastMenu(k, s)).toEqual({ tab: 'finance', fin: 'du_lieu_ke_toan', hr: 'profiles', dir: 'summary' });
    expect(readLastMenu(lastMenuKey('u2'), s)).toBeNull();
  });
  it('dữ liệu hỏng / giá trị lạ / chưa có → null; trình duyệt chặn lưu không làm hỏng', () => {
    const s = mem(); const k = lastMenuKey('u1');
    expect(readLastMenu(k, s)).toBeNull();
    s.setItem(k, '{hỏng'); expect(readLastMenu(k, s)).toBeNull();
    s.setItem(k, JSON.stringify({ tab: '<script>x</script>' })); expect(readLastMenu(k, s)).toBeNull();
    s.setItem(k, JSON.stringify({ tab: 'tasks', hr: 5 })); expect(readLastMenu(k, s)).toEqual({ tab: 'tasks', hr: undefined, fin: undefined, dir: undefined });
    const bad = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
    expect(readLastMenu(k, bad)).toBeNull(); expect(() => writeLastMenu(k, { tab: 'tasks' }, bad)).not.toThrow();
  });
});

describe('App — nhớ menu & bố cục Tin nhắn trên điện thoại', () => {
  const app = fs.readFileSync('src/App.tsx', 'utf8');
  it('khôi phục menu 1 lần sau đăng nhập, bỏ qua khi tải lại trang cùng phiên hoặc mở từ thông báo; ghi lại mỗi lần đổi', () => {
    expect(app).toMatch(/skipRestoreMenu = useRef\(!!sessionStorage\.getItem\('hl_erp_active_tab'\) \|\| window\.location\.search\.length > 1\)/);
    expect(app).toMatch(/readLastMenu\(companyScopedKey\(lastMenuKey\(currentUser\.id\)\)\)/);
    expect(app).toMatch(/writeLastMenu\(companyScopedKey\(lastMenuKey\(currentUser\.id\)\), \{ tab: activeTab, hr: hrSubTab, fin: financeSubTab, dir: directorSubDept \}\)/);
  });
  it('Tin nhắn trên điện thoại: khung cao đúng màn hình, không cuộn cả trang (ô nhập luôn nằm trên thanh dưới)', () => {
    expect(app).toMatch(/activeTab === 'messages' \? 'max-md:h-\[100dvh\] max-md:overflow-hidden'/);
    expect(app).toMatch(/activeTab === 'messages' \? 'p-0 overflow-hidden lx-main-pad'/);
    expect(app).not.toContain('lx-fill');
  });
});
