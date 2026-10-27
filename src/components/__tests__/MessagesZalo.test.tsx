import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';

// Tin nhắn kiểu mới (Zalo): danh sách, tab Chưa đọc, Phân loại, tắt thông báo, ghim, gửi/trả lời/chuyển tiếp/thu hồi, thông tin hội thoại.
const store = vi.hoisted(() => ({ convs: [] as any[], msgs: {} as Record<string, any[]> }));
const fn = vi.hoisted(() => ({
  addMessage: vi.fn(async (m: any, onLocal?: (x: any) => void) => { const x = { ...m, id: 'new_' + Math.random(), createdAt: new Date().toISOString(), read: false }; (store.msgs[m.conversationId] ||= []).push(x); onLocal?.(x); return x; }),
  markConversationRead: vi.fn(async () => {}), markMessagesReadByUser: vi.fn(async () => {}),
  softDeleteMessage: vi.fn(async (c: string, id: string) => { store.msgs[c] = store.msgs[c].map(m => m.id === id ? { ...m, deleted: true, content: 'x' } : m); return true; }),
  togglePinMessage: vi.fn(async (c: string, id: string) => { store.msgs[c] = store.msgs[c].map(m => m.id === id ? { ...m, pinned: !m.pinned } : m); return null; }),
  toggleMessageReaction: vi.fn(async () => {}), updateMessage: vi.fn(async () => null),
  getOrCreatePersonalConversation: vi.fn(async (a: string, b: string, an: string, bn: string) => { const c = { id: `conv_personal_${a}_${b}`, type: 'personal', name: bn, participantIds: [a, b], createdAt: '2026-10-01T00:00:00Z', unreadCount: 0 }; store.convs.push(c); return c; }),
}));
vi.mock('../../lib/chatStore', () => ({
  getConversations: () => store.convs.map(c => ({ ...c })), getMessages: (id: string) => (store.msgs[id] || []).map(m => ({ ...m })),
  ...fn, createGroupConversation: vi.fn(), deleteConversation: vi.fn(), addMemberToConversation: vi.fn(), isUserInConversation: () => true,
  loadConversationsFromCloud: vi.fn(async () => []), loadMessagesFromCloud: vi.fn(async () => []), loadMessagesProgressive: vi.fn(async () => []), subscribeConversations: () => () => {}, subscribeMessages: () => () => {},
  searchMessagesInConversation: (msgs: any[], q: string) => msgs.filter(m => (m.content || '').includes(q)),
}));
// Thẻ "Hôm nay" trong khung thông tin: không gọi máy chủ thật trong test
vi.mock('../../lib/projectEvents', async (orig) => ({ ...(await orig<typeof import('../../lib/projectEvents')>()), loadTodayProjectEvents: vi.fn(async () => []) }));
const addToast = vi.fn();
vi.mock('../../context', () => ({ useNotification: () => ({ addToast }), isRoleAdmin: () => false }));
import MessagesZalo from '../MessagesZalo';
import { applyPresenceState, stopPresence } from '../../lib/presence';

const me: any = { id: 'me', name: 'Trương Hữu Long', role: 'director', hasSystemAccount: true };
const emps: any[] = [me, { id: 'ny', name: 'Lê Nguyễn Gia Ny', hasSystemAccount: true, position: 'Kế toán' }, { id: 'hao', name: 'Cao Võ Anh Hào', hasSystemAccount: true }, { id: 'tang', name: 'Hồ Văn Tặng', hasSystemAccount: true }];
const msg = (id: string, conv: string, o: any = {}) => ({ id, conversationId: conv, senderId: 'ny', senderName: 'Lê Nguyễn Gia Ny', content: 'xin chào', createdAt: new Date().toISOString(), read: true, ...o });
const mount = (props: any = {}) => render(<MessagesZalo currentUser={me} employees={emps} {...props} />);
const row = (id: string) => document.querySelector(`[data-conv="${id}"]`) as HTMLElement;

beforeEach(() => {
  localStorage.clear(); stopPresence(); addToast.mockClear(); Object.values(fn).forEach(f => f.mockClear());
  (Element.prototype as any).scrollIntoView = vi.fn();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const t = (m: number) => new Date(Date.now() - m * 60000).toISOString();
  store.convs = [
    { id: 'p_ny', type: 'personal', name: 'Lê Nguyễn Gia Ny', participantIds: ['me', 'ny'], createdAt: t(500), lastMessageAt: t(1), unreadCount: 2, lastMessage: { content: 'Dạ anh', senderId: 'ny', senderName: 'Lê Nguyễn Gia Ny', createdAt: t(1) } },
    { id: 'conv_project_A', type: 'group', name: '📁 CÔNG TRÌNH A', participantIds: ['me', 'ny', 'hao', 'tang'], createdAt: t(600), lastMessageAt: t(30), unreadCount: 0, pinned: true, projectId: 'A', lastMessage: { content: 'Đổ xong sàn', senderId: 'tang', senderName: 'Hồ Văn Tặng', createdAt: t(30) } },
    { id: 'g_diemdanh', type: 'group', name: 'Điểm danh', participantIds: ['me', 'ny', 'hao'], createdAt: t(700), lastMessageAt: t(90), unreadCount: 5, lastMessage: { content: 'Đã chấm công', senderId: 'hao', senderName: 'Cao Võ Anh Hào', createdAt: t(90) } },
    { id: 'p_hao', type: 'personal', name: 'Cao Võ Anh Hào', participantIds: ['me', 'hao'], createdAt: t(800), lastMessageAt: t(300), unreadCount: 0, lastMessage: { content: 'OK', senderId: 'me', senderName: 'Trương Hữu Long', createdAt: t(300) } },
  ];
  store.msgs = {
    p_ny: [msg('m1', 'p_ny', { content: 'Anh ơi gửi đề xuất chi', createdAt: t(5) }), msg('m2', 'p_ny', { senderId: 'me', senderName: me.name, content: 'Anh duyệt rồi', createdAt: t(3), readBy: ['ny'] })],
    conv_project_A: [
      msg('a1', 'conv_project_A', { senderId: 'tang', senderName: 'Hồ Văn Tặng', content: 'Xem https://example.com/ban-ve', createdAt: t(40), pinned: true, attachments: [{ id: 'i1', type: 'image', name: 'san.png', url: 'data:image/png;base64,AA', mimeType: 'image/png' }, { id: 'f1', type: 'file', name: 'du-toan.xlsx', url: 'data:x', size: 20480 }] }),
      msg('a2', 'conv_project_A', { senderId: 'hao', senderName: 'Cao Võ Anh Hào', content: 'Đã xong tầng 1', createdAt: t(35), pinned: true }),
      msg('a3', 'conv_project_A', { senderId: 'hao', senderName: 'Cao Võ Anh Hào', content: 'tin cũ bị thu hồi', createdAt: t(34), deleted: true }),
    ],
    g_diemdanh: [msg('d1', 'g_diemdanh', { senderId: 'hao', senderName: 'Cao Võ Anh Hào', content: 'Đã chấm công' })],
  };
});

describe('Danh sách hội thoại', () => {
  it('hiện đủ hội thoại, ghim hệ thống (nhóm công trình) lên đầu, nhãn Dự án, số chưa đọc', () => {
    mount();
    const ids = screen.getAllByTestId('zalo-conv').map(r => r.getAttribute('data-conv'));
    expect(ids[0]).toBe('conv_project_A');                      // ghim lên đầu
    expect(ids).toEqual(['conv_project_A', 'p_ny', 'g_diemdanh', 'p_hao']);   // rồi chưa đọc, rồi mới nhất
    expect(within(row('conv_project_A')).getByText('Dự án')).toBeTruthy();
    expect(within(row('g_diemdanh')).getByTestId('zalo-unread').textContent).toBe('5');
    expect(within(row('p_ny')).getByText(/Dạ anh/)).toBeTruthy();
    expect(within(row('p_hao')).getByText(/^Bạn: OK/)).toBeTruthy();   // tin của chính mình có "Bạn:"
  });
  it('nhóm dự án chưa có tin nào (tin hệ thống đã chuyển sang Nhật ký) hiện "Chưa có tin nhắn"; nhóm thường vẫn là "Nhóm mới tạo"', () => {
    store.convs.push(
      { id: 'conv_project_B', type: 'group', name: '📁 CÔNG TRÌNH B', participantIds: ['me', 'ny'], createdAt: new Date().toISOString(), lastMessageAt: new Date().toISOString(), unreadCount: 0, projectId: 'B' },
      { id: 'g_moi', type: 'group', name: 'Nhóm thử', participantIds: ['me', 'ny'], createdAt: new Date().toISOString(), lastMessageAt: new Date().toISOString(), unreadCount: 0 },
    );
    mount();
    expect(within(row('conv_project_B')).getByText('Chưa có tin nhắn')).toBeTruthy();
    expect(within(row('g_moi')).getByText('Nhóm mới tạo')).toBeTruthy();
  });

  it('cột Thông tin hội thoại rộng 340px (bằng cột danh sách, như Zalo)', () => {
    mount(); fireEvent.click(row('conv_project_A'));
    const grid = screen.getByTestId('zalo-info').closest('div.grid') as HTMLElement | null;
    expect(grid?.className).toContain('lg:grid-cols-[340px_minmax(0,1fr)_340px]');
  });

  it('nhóm dự án có thẻ "Hôm nay" trong khung thông tin; cá nhân thì không', async () => {
    mount(); fireEvent.click(row('conv_project_A'));
    expect(await screen.findByTestId('today-card')).toBeTruthy();
    fireEvent.click(row('p_ny'));
    await waitFor(() => expect(screen.queryByTestId('today-card')).toBeNull());
  });

  it('tab Chưa đọc chỉ còn hội thoại có tin mới, kèm số', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: /Chưa đọc/ }));
    expect(screen.getAllByTestId('zalo-conv').map(r => r.getAttribute('data-conv'))).toEqual(['p_ny', 'g_diemdanh']);
  });
  it('Phân loại: Cá nhân / Dự án; tìm kiếm không dấu', () => {
    mount();
    fireEvent.click(screen.getByTestId('zalo-category-btn')); fireEvent.click(screen.getByRole('menuitem', { name: 'Dự án' }));
    expect(screen.getAllByTestId('zalo-conv').map(r => r.getAttribute('data-conv'))).toEqual(['conv_project_A']);
    fireEvent.click(screen.getByTestId('zalo-category-btn')); fireEvent.click(screen.getByRole('menuitem', { name: 'Tất cả' }));
    fireEvent.change(screen.getByLabelText('Tìm kiếm hội thoại'), { target: { value: 'diem danh' } });
    expect(screen.getAllByTestId('zalo-conv').map(r => r.getAttribute('data-conv'))).toEqual(['g_diemdanh']);
  });
  it('chấm online của người đối diện theo presence', () => {
    mount();
    expect(row('p_ny').querySelector('i.bg-emerald-500')).toBeNull();
    act(() => applyPresenceState({ ny: [{}] }));
    expect(row('p_ny').querySelector('i.bg-emerald-500')).not.toBeNull();
  });
});

describe('Khung chat', () => {
  it('mở hội thoại: hiện tin, đánh dấu đã đọc, "Đã xem" ở tin cuối của mình, tiêu đề + trạng thái', async () => {
    mount();
    fireEvent.click(row('p_ny'));
    await waitFor(() => expect(screen.getAllByTestId('zalo-msg')).toHaveLength(2));
    expect(fn.markConversationRead).toHaveBeenCalledWith('p_ny', 'me');
    expect(screen.getByTestId('zalo-seen').textContent).toContain('Đã xem');
    expect(within(screen.getByTestId('zalo-chat')).getByText('Lê Nguyễn Gia Ny')).toBeTruthy();
  });
  it('thanh tin đã ghim: hiện tin mới ghim nhất, "+N ghim" mở danh sách; tin thu hồi hiện dòng thu hồi', async () => {
    mount();
    fireEvent.click(row('conv_project_A'));
    await waitFor(() => expect(screen.getByTestId('zalo-pinbar')).toBeTruthy());
    expect(within(screen.getByTestId('zalo-pinbar')).getByText(/Đã xong tầng 1/)).toBeTruthy();
    fireEvent.click(within(screen.getByTestId('zalo-pinbar')).getByText(/\+1 ghim/));
    expect(within(screen.getByTestId('zalo-pinbar')).getByText(/Xem https:\/\/example\.com/)).toBeTruthy();
    expect(screen.getByText('Tin nhắn đã được thu hồi')).toBeTruthy();
  });
  it('gửi tin bằng Enter và nút Gửi; ô trống hiện 👍', async () => {
    mount(); fireEvent.click(row('p_ny'));
    const input = await screen.findByLabelText('Nhập tin nhắn');
    expect(screen.getByLabelText('Gửi 👍')).toBeTruthy();
    fireEvent.change(input, { target: { value: 'Anh đã chuyển khoản' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(fn.addMessage).toHaveBeenCalledTimes(1));
    expect(fn.addMessage.mock.calls[0][0]).toMatchObject({ conversationId: 'p_ny', senderId: 'me', content: 'Anh đã chuyển khoản' });
    fireEvent.click(screen.getByLabelText('Gửi 👍'));
    await waitFor(() => expect(fn.addMessage).toHaveBeenCalledTimes(2));
    expect(fn.addMessage.mock.calls[1][0].content).toBe('👍');
  });
  it('trả lời: gắn trích dẫn vào tin gửi đi', async () => {
    mount(); fireEvent.click(row('p_ny'));
    const msgs = await screen.findAllByTestId('zalo-msg');
    fireEvent.click(within(msgs[0]).getByLabelText('Trả lời'));
    expect(screen.getByText(/Trả lời Lê Nguyễn Gia Ny/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Nhập tin nhắn'), { target: { value: 'ok em' } });
    fireEvent.click(screen.getByLabelText('Gửi'));
    await waitFor(() => expect(fn.addMessage).toHaveBeenCalled());
    expect(fn.addMessage.mock.calls[0][0].replyTo).toMatchObject({ id: 'm1', senderName: 'Lê Nguyễn Gia Ny' });
  });
  it('chuyển tiếp tin sang nhiều hội thoại', async () => {
    mount(); fireEvent.click(row('p_ny'));
    const msgs = await screen.findAllByTestId('zalo-msg');
    fireEvent.click(within(msgs[0]).getByLabelText('Chuyển tiếp'));
    const dlg = screen.getByTestId('zalo-forward');
    const targets = within(dlg).getAllByTestId('zalo-fwd-target');
    fireEvent.click(targets[0]); fireEvent.click(targets[1]);
    fireEvent.click(within(dlg).getByRole('button', { name: /Gửi \(2\)/ }));
    await waitFor(() => expect(fn.addMessage).toHaveBeenCalledTimes(2));
    expect(fn.addMessage.mock.calls.every(c => c[0].content === 'Anh ơi gửi đề xuất chi')).toBe(true);
    expect(new Set(fn.addMessage.mock.calls.map(c => c[0].conversationId)).size).toBe(2);
  });
  it('menu thêm: ghim tin, thu hồi tin của mình (không có "Thu hồi" cho tin người khác)', async () => {
    mount(); fireEvent.click(row('p_ny'));
    const msgs = await screen.findAllByTestId('zalo-msg');
    fireEvent.click(within(msgs[0]).getByLabelText('Thêm'));
    let menu = screen.getByTestId('zalo-msgmenu');
    expect(within(menu).queryByText('Thu hồi')).toBeNull();
    fireEvent.click(within(menu).getByText('Ghim tin nhắn'));
    await waitFor(() => expect(fn.togglePinMessage).toHaveBeenCalledWith('p_ny', 'm1'));
    fireEvent.click(within((await screen.findAllByTestId('zalo-msg'))[1]).getByLabelText('Thêm'));
    menu = screen.getByTestId('zalo-msgmenu');
    fireEvent.click(within(menu).getByText('Thu hồi'));
    await waitFor(() => expect(fn.softDeleteMessage).toHaveBeenCalledWith('p_ny', 'm2'));
  });
  it('thả cảm xúc nhanh', async () => {
    mount(); fireEvent.click(row('p_ny'));
    const msgs = await screen.findAllByTestId('zalo-msg');
    fireEvent.click(within(msgs[0]).getByLabelText('Thêm'));
    fireEvent.click(screen.getByLabelText('Thả ❤️'));
    await waitFor(() => expect(fn.toggleMessageReaction).toHaveBeenCalledWith('p_ny', 'm1', 'me', '❤️'));
  });
  it('đính kèm tệp rồi gửi', async () => {
    mount(); fireEvent.click(row('p_ny'));
    await screen.findByLabelText('Nhập tin nhắn');
    const file = new File(['abc'], 'bao-gia.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByTestId('zalo-file-input'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByTestId('zalo-pending').textContent).toContain('bao-gia.pdf'));
    fireEvent.click(screen.getByLabelText('Gửi'));
    await waitFor(() => expect(fn.addMessage).toHaveBeenCalled());
    expect(fn.addMessage.mock.calls[0][0].attachments[0]).toMatchObject({ name: 'bao-gia.pdf', type: 'file' });
  });
  it('@ gợi ý thành viên nhóm và chèn tên', async () => {
    mount(); fireEvent.click(row('conv_project_A'));
    const input = await screen.findByLabelText('Nhập tin nhắn');
    fireEvent.change(input, { target: { value: 'chào @Hồ' } });
    fireEvent.click(within(screen.getByTestId('zalo-mention')).getByText('Hồ Văn Tặng'));
    expect((input as HTMLInputElement).value).toBe('chào @HồVănTặng ');
  });
  it('nhắn tin mới cho đồng nghiệp chưa có hội thoại: tạo hội thoại cá nhân khi gửi', async () => {
    mount();
    fireEvent.click(screen.getByLabelText('Nhắn tin mới'));
    fireEvent.click(within(screen.getByTestId('zalo-newchat')).getByText('Hồ Văn Tặng'));
    const input = await screen.findByLabelText('Nhập tin nhắn');
    fireEvent.change(input, { target: { value: 'chào Tặng' } }); fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(fn.getOrCreatePersonalConversation).toHaveBeenCalledWith('me', 'tang', me.name, 'Hồ Văn Tặng'));
    await waitFor(() => expect(fn.addMessage).toHaveBeenCalled());
  });
});

describe('Tắt thông báo / ghim hội thoại / thông tin hội thoại', () => {
  it('tắt thông báo: lưu trình duyệt, hiện thanh "Mở lại", số chưa đọc chuyển xám; bật lại được', async () => {
    mount(); fireEvent.click(row('g_diemdanh'));
    await screen.findAllByTestId('zalo-msg');
    fireEvent.click(screen.getByTestId('zalo-mute'));
    expect(JSON.parse(localStorage.getItem('hl_chat_prefs_me')!).muted).toEqual(['g_diemdanh']);
    expect(screen.getByTestId('zalo-mutebar').textContent).toContain('KHÔNG được thông báo');
    fireEvent.click(within(screen.getByTestId('zalo-mutebar')).getByText('Mở lại'));
    expect(JSON.parse(localStorage.getItem('hl_chat_prefs_me')!).muted).toEqual([]);
    expect(screen.queryByTestId('zalo-mutebar')).toBeNull();
  });
  it('hội thoại đã tắt thông báo: số chưa đọc màu xám trong danh sách', () => {
    localStorage.setItem('hl_chat_prefs_me', JSON.stringify({ muted: ['g_diemdanh'], pinned: [] }));
    mount();
    expect(within(row('g_diemdanh')).getByTestId('zalo-unread').className).toContain('bg-slate-400');
    expect(within(row('p_ny')).getByTestId('zalo-unread').className).toContain('bg-red-500');
  });
  it('ghim hội thoại: lưu và đưa lên đầu danh sách', async () => {
    mount(); fireEvent.click(row('p_hao'));
    await screen.findByTestId('zalo-info');
    fireEvent.click(screen.getByTestId('zalo-pinconv'));
    expect(JSON.parse(localStorage.getItem('hl_chat_prefs_me')!).pinned).toEqual(['p_hao']);
    expect(screen.getAllByTestId('zalo-conv').map(r => r.getAttribute('data-conv')).slice(0, 2)).toEqual(['conv_project_A', 'p_hao']);   // nhóm ghim (hệ thống + riêng) đứng đầu, mới nhất trước; p_hao nhảy lên trên các hội thoại chưa đọc
  });
  it('thông tin hội thoại: ảnh, tệp, link, thành viên gom từ tin nhắn', async () => {
    mount(); fireEvent.click(row('conv_project_A'));
    const info = await screen.findByTestId('zalo-info');
    await waitFor(() => expect(within(info).getByTestId('zalo-media').querySelectorAll('img')).toHaveLength(1));
    expect(within(info).getByTestId('zalo-files').textContent).toContain('du-toan.xlsx');
    expect(within(info).getByTestId('zalo-links').textContent).toContain('https://example.com/ban-ve');
    expect(within(info).getByTestId('zalo-members').textContent).toContain('Thành viên (4)');
  });
  it('nút bảng ẩn/hiện khung thông tin; nhóm có nút Thêm thành viên, cá nhân có Tạo nhóm', async () => {
    mount(); fireEvent.click(row('p_ny'));
    await screen.findByTestId('zalo-info');
    expect(within(screen.getByTestId('zalo-info')).getByText('Tạo nhóm')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Thông tin hội thoại'));
    expect(screen.queryByTestId('zalo-info')).toBeNull();
    fireEvent.click(row('conv_project_A'));
    fireEvent.click(screen.getByLabelText('Thông tin hội thoại'));
    expect(within(await screen.findByTestId('zalo-info')).getByText('Thêm thành viên')).toBeTruthy();
  });
  it('tìm trong hội thoại: liệt kê tin khớp', async () => {
    mount(); fireEvent.click(row('conv_project_A'));
    await screen.findAllByTestId('zalo-msg');
    fireEvent.click(screen.getByLabelText('Tìm trong hội thoại'));
    fireEvent.change(screen.getByPlaceholderText(/Tìm tin nhắn trong hội thoại/), { target: { value: 'tầng 1' } });
    expect(within(screen.getByTestId('zalo-search')).getByText(/Đã xong tầng 1/)).toBeTruthy();
  });
});
