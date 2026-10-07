import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('../../hooks/useWebPush', () => ({ subscribeToPush: vi.fn(async () => {}) }));
import { subscribeToPush } from '../../hooks/useWebPush';
import PushPermissionBanner from '../PushPermissionBanner';

// Giả lập API Notification của trình duyệt
function fakeNotification(permission: NotificationPermission, onAsk?: NotificationPermission) {
  (window as any).Notification = { permission, requestPermission: vi.fn(async () => { (window as any).Notification.permission = onAsk ?? permission; return onAsk ?? permission; }) };
}

describe('Thanh nhắc bật thông báo trình duyệt', () => {
  beforeEach(() => { localStorage.clear(); vi.mocked(subscribeToPush).mockClear(); });
  afterEach(() => { delete (window as any).Notification; });

  it('đã cấp quyền → không hiện', () => {
    fakeNotification('granted');
    const { container } = render(<PushPermissionBanner userId="u1" />);
    expect(container.querySelector('#push_permission_banner')).toBeNull();
  });

  it('trình duyệt không hỗ trợ → không hiện', () => {
    delete (window as any).Notification;
    const { container } = render(<PushPermissionBanner userId="u1" />);
    expect(container.querySelector('#push_permission_banner')).toBeNull();
  });

  it('chưa chọn → hiện nút; bấm nút → xin quyền rồi đăng ký push cho đúng user, thanh biến mất', async () => {
    fakeNotification('default', 'granted');
    const { container, getByText } = render(<PushPermissionBanner userId="u1" />);
    fireEvent.click(getByText('Bật thông báo'));
    await waitFor(() => expect(subscribeToPush).toHaveBeenCalledWith('u1'));
    expect(container.querySelector('#push_permission_banner')).toBeNull();
  });

  it('người dùng từ chối khi được hỏi → không đăng ký, chuyển sang hướng dẫn mở khóa', async () => {
    fakeNotification('default', 'denied');
    const { container, getByText } = render(<PushPermissionBanner userId="u1" />);
    fireEvent.click(getByText('Bật thông báo'));
    await waitFor(() => expect(container.textContent).toContain('đang chặn thông báo'));
    expect(subscribeToPush).not.toHaveBeenCalled();
  });

  it('đã bị chặn từ trước → hiện hướng dẫn, không có nút xin quyền', () => {
    fakeNotification('denied');
    const { container } = render(<PushPermissionBanner userId="u1" />);
    expect(container.textContent).toContain('đang chặn thông báo');
    expect(container.textContent).not.toContain('Bật thông báo');
  });

  it('bấm X → ẩn và nhớ 1 ngày (tải lại vẫn ẩn)', () => {
    fakeNotification('default');
    const first = render(<PushPermissionBanner userId="u1" />);
    fireEvent.click(first.getByLabelText('Ẩn 1 ngày'));
    expect(first.container.querySelector('#push_permission_banner')).toBeNull();
    first.unmount();
    const again = render(<PushPermissionBanner userId="u1" />);
    expect(again.container.querySelector('#push_permission_banner')).toBeNull();
  });
});
