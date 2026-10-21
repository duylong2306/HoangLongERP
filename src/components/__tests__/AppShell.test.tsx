import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import AppRail, { RAIL_KEY } from '../shell/AppRail';
import MobileNav from '../shell/MobileNav';

// Khung ứng dụng mới: thanh menu trái (thu gọn/mở rộng/menu con bung ra) và thanh dưới điện thoại (5 mục + Danh mục + Tôi).
const sel = vi.fn(); const logout = vi.fn(); const profile = vi.fn();
const leaf = (id: string, label: string, active = false) => ({ id, label, active, onSelect: () => sel(id) });
const tops: any[] = [{ ...leaf('dashboard', 'Tổng quan'), icon: <i /> }, { ...leaf('tasks', 'Việc của tôi'), icon: <i />, badge: 5 }, { ...leaf('messages', 'Tin nhắn', true), icon: <i />, badge: 120 }];
const groups: any[] = [
  { id: 'projects', label: 'Phòng Dự Án', icon: <i />, active: false, children: [leaf('p1', 'Xây dựng'), leaf('p2', 'Nội thất')] },
  { id: 'sub', label: 'Thầu Phụ', icon: <i />, active: false, children: [leaf('s1', 'Quản Lý Thầu Phụ')] },
];
const user: any = { name: 'Administrator', subtitle: 'LoLo', onProfile: profile, onReload: vi.fn(), onLogout: logout };
beforeEach(() => { localStorage.clear(); sel.mockClear(); logout.mockClear(); profile.mockClear(); });

describe('Thanh menu trái (máy tính)', () => {
  const mount = () => render(<AppRail brandName="LoLo" tops={tops} groups={groups} user={user} />);
  it('mặc định thu gọn; hiện huy hiệu (99+ khi quá 99); bấm mục thì chọn trang', () => {
    mount();
    expect(document.querySelector('.lx-rail')!.className).not.toContain('open');
    expect(within(screen.getByTestId('rail-messages')).getByText('99+')).toBeTruthy();
    fireEvent.click(screen.getByTestId('rail-tasks')); expect(sel).toHaveBeenCalledWith('tasks');
  });
  it('bấm logo mở rộng/thu gọn và NHỚ lựa chọn', () => {
    mount();
    fireEvent.click(screen.getByTestId('rail-toggle'));
    expect(document.querySelector('.lx-rail')!.className).toContain('open');
    expect(localStorage.getItem(RAIL_KEY)).toBe('1');
    fireEvent.click(screen.getByTestId('rail-toggle')); expect(localStorage.getItem(RAIL_KEY)).toBe('0');
  });
  it('mở lại thì giữ trạng thái đã chọn', () => {
    localStorage.setItem(RAIL_KEY, '1'); mount();
    expect(document.querySelector('.lx-rail')!.className).toContain('open');
  });
  it('thu gọn: bấm phòng ban → menu con bung ra bên cạnh; chọn mục con thì đóng', () => {
    mount();
    fireEvent.click(screen.getByTestId('rail-group-projects'));
    const fly = screen.getByTestId('rail-flyout');
    fireEvent.click(within(fly).getByText('Nội thất'));
    expect(sel).toHaveBeenCalledWith('p2'); expect(screen.queryByTestId('rail-flyout')).toBeNull();
  });
  it('mở rộng: bấm phòng ban xổ/gập menu con ngay trong thanh', () => {
    localStorage.setItem(RAIL_KEY, '1'); mount();
    expect(screen.queryByText('Xây dựng')).toBeNull();
    fireEvent.click(screen.getByTestId('rail-group-projects'));
    fireEvent.click(screen.getByText('Xây dựng')); expect(sel).toHaveBeenCalledWith('p1');
    expect(screen.queryByTestId('rail-flyout')).toBeNull();
  });
  it('menu tài khoản: Sửa hồ sơ / Đăng xuất', () => {
    mount(); fireEvent.click(screen.getByTestId('rail-user'));
    const m = screen.getByTestId('rail-usermenu');
    fireEvent.click(within(m).getByText('Sửa hồ sơ')); expect(profile).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('rail-user')); fireEvent.click(within(screen.getByTestId('rail-usermenu')).getByText('Đăng xuất')); expect(logout).toHaveBeenCalled();
  });
});

describe('Thanh dưới (điện thoại)', () => {
  const mount = () => render(<MobileNav tops={tops} groups={groups} user={user} activeTab="messages" />);
  it('có 5 nút: Tổng quan, Việc, Tin nhắn, Danh mục, Tôi', () => {
    mount();
    expect(within(screen.getByTestId('mobile-nav')).getAllByRole('button').map(b => b.textContent?.replace(/\d+\+?$/, ''))).toEqual(['Tổng quan', 'Việc của tôi5', 'Tin nhắn99+', 'Danh mục', 'Tôi'].map(t => t.replace(/\d+\+?$/, '')));
    fireEvent.click(screen.getByTestId('bn-tasks')); expect(sel).toHaveBeenCalledWith('tasks');
  });
  it('Danh mục: lưới phòng ban → vào menu con → chọn thì đóng; nhóm chỉ 1 mục thì đi thẳng', () => {
    mount();
    fireEvent.click(screen.getByTestId('bn-cat'));
    fireEvent.click(screen.getByTestId('cat-projects'));
    fireEvent.click(screen.getByText('Xây dựng')); expect(sel).toHaveBeenCalledWith('p1'); expect(screen.queryByTestId('sheet-cat')).toBeNull();
    fireEvent.click(screen.getByTestId('bn-cat')); fireEvent.click(screen.getByTestId('cat-sub')); expect(sel).toHaveBeenCalledWith('s1');
  });
  it('Tôi: tên + Sửa hồ sơ + Đăng xuất', () => {
    mount(); fireEvent.click(screen.getByTestId('bn-me'));
    const sheet = screen.getByTestId('sheet-me'); expect(sheet.textContent).toContain('Administrator');
    fireEvent.click(within(sheet).getByText('Đăng xuất')); expect(logout).toHaveBeenCalled();
  });
});

describe('Cấu hình trang', () => {
  it('khóa zoom + phủ tai thỏ trong index.html', async () => {
    const fs = await import('node:fs'); const html = fs.readFileSync('index.html', 'utf8');
    expect(html).toMatch(/user-scalable=no/); expect(html).toMatch(/maximum-scale=1\.0/); expect(html).toMatch(/viewport-fit=cover/); expect(html).toMatch(/gesturestart/);
  });
  it('thanh tiêu đề đệm theo vùng an toàn thay cho số cứng 50px', async () => {
    const fs = await import('node:fs'); const app = fs.readFileSync('src/App.tsx', 'utf8'); const css = fs.readFileSync('src/components/shell/shell.css', 'utf8');
    expect(app).not.toContain('pt-[50px]'); expect(css).toContain('safe-area-inset-top'); expect(css).toContain('safe-area-inset-bottom');
  });
});
