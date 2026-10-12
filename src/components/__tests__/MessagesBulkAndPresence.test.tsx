import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// Tin nhắn: (1) chọn nhiều → "Đã đọc" hàng loạt; (2) chấm/nhãn online-offline theo presence.
const convs: any[] = [];
const markConversationRead = vi.fn(async () => {});
const markMessagesReadByUser = vi.fn(async () => {});
vi.mock('../../lib/chatStore', () => ({
  getConversations: () => convs.map(c => ({ ...c })),
  saveConversations: vi.fn(), getMessages: () => [], addMessage: vi.fn(),
  getOrCreatePersonalConversation: vi.fn(), createGroupConversation: vi.fn(), deleteConversation: vi.fn(),
  markConversationRead: (...a: any[]) => markConversationRead(...(a as [])),
  markMessagesReadByUser: (...a: any[]) => markMessagesReadByUser(...(a as [])),
  getUserConversations: () => convs, deleteMessageFromConversation: vi.fn(), updateMessage: vi.fn(),
  searchMessagesInConversation: () => [], getConversationUnreadCount: () => 0, addMemberToConversation: vi.fn(),
  toggleMessageReaction: vi.fn(), isUserInConversation: () => true,
  loadConversationsFromCloud: vi.fn(async () => {}), loadMessagesFromCloud: vi.fn(async () => []),
  subscribeConversations: () => () => {}, subscribeMessages: () => () => {},
}));
const addToast = vi.fn();
vi.mock('../../context', () => ({ useNotification: () => ({ addToast }), isRoleAdmin: () => false }));
import MessagesView from '../MessagesView';
import { applyPresenceState, stopPresence } from '../../lib/presence';

const me: any = { id: 'me', name: 'Tôi', hasSystemAccount: true };
const an: any = { id: 'an', name: 'An', department: 'Kế toán', hasSystemAccount: true };
const binh: any = { id: 'binh', name: 'Bình', department: 'Kỹ thuật', hasSystemAccount: true };
const personal = (id: string, other: string, unread: number) => ({
  id, type: 'personal', name: other, participantIds: ['me', other], unreadCount: unread, unreadCounts: { me: unread },
  lastMessageAt: '2026-10-12T10:00:00Z', lastMessage: 'xin chào',
});

beforeEach(() => {
  (Element.prototype as any).scrollIntoView = vi.fn();   // jsdom không có scrollIntoView
  convs.length = 0;
  convs.push(personal('c1', 'an', 3), personal('c2', 'binh', 0));
  markConversationRead.mockClear(); markMessagesReadByUser.mockClear(); addToast.mockClear();
  stopPresence();
});
const mount = () => render(<MessagesView currentUser={me} employees={[me, an, binh]} />);

describe('Tin nhắn — đánh dấu đã đọc hàng loạt', () => {
  it('chọn tất cả → Đã đọc chỉ xử lý hội thoại có tin chưa đọc', async () => {
    mount();
    fireEvent.click(screen.getByTitle('Chọn nhiều'));
    fireEvent.click(screen.getByText('Chọn tất cả'));
    fireEvent.click(screen.getByText('Đã đọc'));
    await waitFor(() => expect(markConversationRead).toHaveBeenCalledTimes(1));
    expect((markConversationRead.mock.calls[0] as any[])[0]).toBe('c1');
    expect((markConversationRead.mock.calls[0] as any[])[1]).toBe('me');
    expect(markMessagesReadByUser).toHaveBeenCalledTimes(1);
    expect(addToast.mock.calls.at(-1)![0].message).toMatch(/1 cuộc trò chuyện/);
  });
  it('chỉ chọn hội thoại đã đọc → báo không có gì để đánh dấu, không gọi cập nhật', async () => {
    mount();
    fireEvent.click(screen.getByTitle('Chọn nhiều'));
    fireEvent.click(screen.getByText('Binh'.replace('Binh', 'Bình')));
    fireEvent.click(screen.getByText('Đã đọc'));
    await waitFor(() => expect(addToast).toHaveBeenCalled());
    expect(markConversationRead).not.toHaveBeenCalled();
    expect(addToast.mock.calls.at(-1)![0].title).toMatch(/Không có gì/);
  });
  it('chưa chọn gì thì không có nút Đã đọc', () => {
    mount();
    fireEvent.click(screen.getByTitle('Chọn nhiều'));
    expect(screen.queryByText('Đã đọc')).toBeNull();
  });
});

describe('Tin nhắn — trạng thái online/offline', () => {
  it('chấm xanh cho người online, xám cho người offline; đổi theo presence', async () => {
    mount();
    let dots = screen.getAllByTestId('presence-dot').map(d => d.getAttribute('data-online'));
    expect(dots).toEqual(['false', 'false']);
    act(() => applyPresenceState({ an: [{ at: 1 }] }));
    dots = screen.getAllByTestId('presence-dot').map(d => d.getAttribute('data-online'));
    expect(dots).toEqual(['true', 'false']);
    act(() => applyPresenceState({}));   // An thoát tab/ứng dụng
    expect(screen.getAllByTestId('presence-dot').map(d => d.getAttribute('data-online'))).toEqual(['false', 'false']);
  });
  it('tiêu đề chat cá nhân: "Đang hoạt động" khi online, "Hoạt động … trước" sau khi rời đi', async () => {
    mount();
    fireEvent.click(screen.getByText('An'));
    act(() => applyPresenceState({ an: [{ at: 1 }] }));
    expect(screen.getByTestId('presence-label').textContent).toBe('Đang hoạt động');
    act(() => applyPresenceState({}));
    expect(screen.getByTestId('presence-label').textContent).toMatch(/Hoạt động (vừa xong|\d+ phút trước)/);
  });
});
