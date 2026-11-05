import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import fs from 'node:fs';
import { HrDesktopTabs, HrMobileNav, HR_TABS } from '../HrNavigation';

describe('Menu Hệ thống nhân sự (thiết kế mới)', () => {
  it('máy tính: đủ 6 tab, bấm đổi tab, chấm đỏ đếm đơn chờ duyệt ở Nghỉ phép', () => {
    const onChange = vi.fn();
    render(<HrDesktopTabs active="profiles" onChange={onChange} badges={{ leaves: 3 }} />);
    expect(HR_TABS).toHaveLength(6);
    HR_TABS.forEach(t => expect(screen.getByTestId(`hr-tab-${t.id}`)).toBeTruthy());
    expect(screen.getByTestId('hr-tab-leaves').textContent).toContain('3');
    expect(screen.getByTestId('hr-tab-payroll').textContent).not.toMatch(/\d/);   // tab khác không có số
    expect(screen.getByTestId('hr-tab-profiles').getAttribute('aria-current')).toBe('page');
    fireEvent.click(screen.getByTestId('hr-tab-payroll'));
    expect(onChange).toHaveBeenCalledWith('payroll');
  });

  it('điện thoại: ngăn kéo mặc định ẩn; bấm ☰ mở, chọn tab thì đổi tab và tự đóng', () => {
    const onChange = vi.fn();
    render(<HrMobileNav active="attendance" onChange={onChange} badges={{ leaves: 2 }} />);
    expect(screen.queryByTestId('hr-drawer')).toBeNull();                         // mặc định ẩn
    expect(screen.getByTestId('hr-current-tab').textContent).toBe('Chấm công ngày'); // tiêu đề = tên tab đang xem
    fireEvent.click(screen.getByTestId('hr-menu-btn'));
    expect(screen.getByTestId('hr-drawer')).toBeTruthy();
    expect(screen.getByTestId('hr-drawer-leaves').textContent).toContain('2');     // số đơn chờ duyệt
    HR_TABS.forEach(t => expect(screen.getByTestId(`hr-drawer-${t.id}`).textContent).toContain(t.short));
    fireEvent.click(screen.getByTestId('hr-drawer-leaves'));
    expect(onChange).toHaveBeenCalledWith('leaves');
    expect(screen.queryByTestId('hr-drawer')).toBeNull();                         // chọn xong tự đóng
  });

  it('điện thoại: bấm nền mờ / nút đóng / phím Esc đều đóng ngăn kéo', () => {
    render(<HrMobileNav active="profiles" onChange={() => {}} />);
    const open = () => fireEvent.click(screen.getByTestId('hr-menu-btn'));
    open(); fireEvent.click(screen.getByTestId('hr-drawer-scrim')); expect(screen.queryByTestId('hr-drawer')).toBeNull();
    open(); fireEvent.click(screen.getByTestId('hr-drawer-close')); expect(screen.queryByTestId('hr-drawer')).toBeNull();
    open(); fireEvent.keyDown(window, { key: 'Escape' }); expect(screen.queryByTestId('hr-drawer')).toBeNull();
  });

  it('không có chấm đỏ trên nút ☰ khi không có đơn chờ', () => {
    const { container } = render(<HrMobileNav active="profiles" onChange={() => {}} badges={{ leaves: 0 }} />);
    expect(container.querySelector('[data-testid="hr-menu-btn"] span')).toBeNull();
  });

  it('HumanResourcesManagement dùng menu mới và đã gỡ thanh bên cũ', () => {
    const src = fs.readFileSync('src/components/HumanResourcesManagement.tsx', 'utf8');
    expect(src).toContain('<HrDesktopTabs'); expect(src).toContain('<HrMobileNav');
    expect(src).not.toContain('hrm_sidebar_control'); expect(src).not.toContain('menuDisplayMode');
  });
});
