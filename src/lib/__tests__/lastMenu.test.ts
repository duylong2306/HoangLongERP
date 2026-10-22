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
  it('không kéo lệch ngang: gốc trang chặn cuộn ngang; danh sách tin không cuộn ngang; tin dài tự xuống dòng', () => {
    const css = fs.readFileSync('src/components/shell/shell.css', 'utf8');
    const zalo = fs.readFileSync('src/components/MessagesZalo.tsx', 'utf8');
    expect(css).toMatch(/html:root,\s*html:root body\s*\{[^}]*overflow-x:\s*hidden/);
    expect(css).toMatch(/overflow-x:\s*clip/);
    expect(zalo).toMatch(/overflow-y-auto overflow-x-hidden[^"]*data-testid="zalo-messages"|overflow-x-hidden px-3 sm:px-5 py-3 min-h-0 overscroll-contain" data-testid="zalo-messages"/);
    expect(zalo).toContain('[overflow-wrap:anywhere]');
  });
  it('Mở công trình từ Tin nhắn: App kiểm quyền phân hệ trước khi mở; bảng dự án mở sẵn chi tiết dự án được yêu cầu', () => {
    const app2 = fs.readFileSync('src/App.tsx', 'utf8');
    const kanban = fs.readFileSync('src/components/ProjectKanbanBoard.tsx', 'utf8');
    expect(app2).toMatch(/canOpenProject = \(id: string\) => \{ const pr = projects\.find\(x => x\.id === id\); return !!pr && isAccessible\(projectTabOf\(pr\)\); \}/);
    expect(app2).toMatch(/if \(!isAccessible\(projectTabOf\(pr\)\)\) \{ addToast\(\{ title: '⛔ Không có quyền'/);
    expect((app2.match(/initialProjectId=\{pendingProjectId \?\? undefined\}/g) || []).length).toBe(3);   // cả 3 phân hệ: Xây dựng, Nội thất, Cơ khí
    expect(kanban).toMatch(/setSelectedProjectId\(initialProjectId\)/);
  });
});

describe('Tên miền đăng ký doanh nghiệp: lolo.com.vn', () => {
  const v = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  it('địa chỉ gốc cũ (lolo.io.vn, www.lolo.io.vn) chuyển sang www.lolo.com.vn, giữ đường dẫn; địa chỉ riêng từng công ty KHÔNG bị chuyển', () => {
    const hosts = Array.from(new Set((v.redirects as any[]).map(r => r.has[0].value))).sort();
    expect(hosts).toEqual(['lolo.io.vn', 'www.lolo.io.vn']);
    // Mỗi host có 2 luật: đường dẫn gốc "/" và các đường dẫn con (:path+) — mẫu :path* không khớp "/" nên phải viết riêng
    for (const h of hosts) expect((v.redirects as any[]).filter(r => r.has[0].value === h).map(r => r.source).sort()).toEqual(['/', '/:path+']);
    for (const r of v.redirects) { expect(['https://www.lolo.com.vn/', 'https://www.lolo.com.vn/:path+']).toContain(r.destination); expect(r.permanent).toBe(false); }
    expect(hosts.some((h: string) => h.includes('hoanglong'))).toBe(false);
  });
  it('mã nguồn không còn ghi cứng địa chỉ lolo.io.vn (địa chỉ lấy từ cấu hình VITE_BASE_DOMAIN)', () => {
    for (const f of ['src/App.tsx', 'src/components/landing/LandingPage.tsx', 'src/components/platform/PlatformConsole.tsx', 'api/platform.ts', 'api/_platformAuth.ts', 'api/_company.ts']) {
      expect(fs.readFileSync(f, 'utf8')).not.toContain('lolo.io.vn');
    }
  });
});
