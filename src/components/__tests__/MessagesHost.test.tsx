import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Tin nhắn: công tắc Kiểu mới (mặc định) / Kiểu cũ, nhớ trong localStorage theo người dùng.
// Kiểu mới nhận công tắc qua prop headerExtra (đặt đầu cột danh sách) — mô phỏng bằng cách hiển thị nó
vi.mock('../MessagesZalo', () => ({ default: (p: any) => <div data-testid="ui-new">kiểu mới{p.headerExtra}</div> }));
vi.mock('../MessagesView', () => ({ default: () => <div data-testid="ui-classic">kiểu cũ</div> }));
import MessagesHost from '../MessagesHost';

const me: any = { id: 'u1', name: 'Long' };
const mount = () => render(<MessagesHost currentUser={me} employees={[me]} />);
beforeEach(() => localStorage.clear());

describe('MessagesHost', () => {
  it('mặc định là KIỂU MỚI', () => {
    mount();
    expect(screen.getByTestId('ui-new')).toBeTruthy();
    expect(screen.queryByTestId('ui-classic')).toBeNull();
  });
  it('chuyển sang Kiểu cũ → hiện giao diện cũ và lưu lựa chọn; mở lại vẫn kiểu cũ; đổi lại kiểu mới cũng được nhớ', () => {
    const { unmount } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Kiểu cũ' }));
    expect(screen.getByTestId('ui-classic')).toBeTruthy();
    expect(localStorage.getItem('hl_messages_ui_u1')).toBe('classic');
    unmount(); mount();
    expect(screen.getByTestId('ui-classic')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Kiểu mới' }));
    expect(screen.getByTestId('ui-new')).toBeTruthy();
    expect(localStorage.getItem('hl_messages_ui_u1')).toBe('new');
  });
  it('App dùng MessagesHost và huy hiệu bỏ hội thoại đã tắt thông báo', async () => {
    const fs = await import('node:fs');
    const app = fs.readFileSync('src/App.tsx', 'utf8');
    expect(app).toMatch(/<MessagesHost\n/);
    expect(app.match(/unreadForBadge\(/g)).toHaveLength(1);   // 1 chỗ tính duy nhất, dùng chung cho menu trái, thanh dưới và chuông
  });
});
