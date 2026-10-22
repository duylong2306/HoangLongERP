import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';

// Tab "Việc của tôi" trong Tin nhắn kiểu mới: danh sách theo nhóm, chi tiết + luồng thảo luận riêng của từng mục, hành động.
const store = vi.hoisted(() => ({ convs: [] as any[], msgs: {} as Record<string, any[]>, convCb: null as null | (() => void), onProgressive: null as null | (() => void) }));
const fn = vi.hoisted(() => ({
  addMessage: vi.fn(async (m: any, onLocal?: (x: any) => void) => { const x = { ...m, id: 'new_' + Math.random(), createdAt: new Date().toISOString(), read: false }; (store.msgs[m.conversationId] ||= []).push(x); onLocal?.(x); return x; }),
  toggleMessageReaction: vi.fn(async () => {}),
  ensureWorkThread: vi.fn(async (p: any) => ({ id: 'conv_work_' + p.key.replace(/[^A-Za-z0-9_-]/g, '_'), participantIds: p.memberIds })),
  markConversationRead: vi.fn(async () => {}), markMessagesReadByUser: vi.fn(async () => {}),
  sendApprovalDirectMessage: vi.fn(async () => null),
}));
vi.mock('../../lib/chatStore', () => ({
  getConversations: () => store.convs.map(c => ({ ...c })), getMessages: (id: string) => (store.msgs[id] || []).map(m => ({ ...m })),
  ...fn, getOrCreatePersonalConversation: vi.fn(), loadConversationsFromCloud: vi.fn(async () => []), loadMessagesFromCloud: vi.fn(async () => []), loadMessagesProgressive: vi.fn(async () => { store.onProgressive?.(); return []; }),
  subscribeConversations: (_u: string, cb: () => void) => { store.convCb = cb; return () => {}; }, subscribeMessages: () => () => {},
}));
vi.mock('../../context', () => ({ useNotification: () => ({ addToast: vi.fn() }), isRoleAdmin: () => false }));
import MessagesZalo from '../MessagesZalo';
import { stopPresence } from '../../lib/presence';
import { todayYmd } from '../../lib/myWork';

const me: any = { id: 'me', name: 'Trương Hữu Long', role: 'director' };
const emps: any[] = [me, { id: 'ny', name: 'Lê Nguyễn Gia Ny' }, { id: 'tang', name: 'Hồ Văn Tặng' }];
// Ngày theo GIỜ ĐỊA PHƯƠNG (todayYmd cũng theo giờ địa phương) — dùng toISOString (UTC) làm test sai lệch 1 ngày sau nửa đêm ở múi giờ +7
const day = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const task = (id: string, o: any = {}) => ({ id, name: 'Việc ' + id, status: 'doing', assigneeId: 'me', assignerId: 'tang', deadline: day(0), completionRate: 40, missions: [], ...o });
const item = (id: string, o: any = {}) => ({ key: `task:${id}`, kind: 'task', taskId: id, title: 'Việc ' + id, taskName: 'Việc ' + id, project: 'CĂN TIN', due: day(0), rate: 40, status: 'doing', isLead: true, canReceive: false, role: 'assignee', memberCount: 0, doneDay: '', ...o });

const receive = vi.fn(); const openTask = vi.fn(); const openApp = vi.fn(); const approve = vi.fn(); const createTask = vi.fn(async () => {});
const mount = (o: any = {}) => render(<MessagesZalo currentUser={me} employees={emps} tasks={[task('a'), task('b'), task('c')] as any}
  workItems={[item('a', { due: day(-2) }), item('b', { canReceive: true, status: 'todo', due: day(0) }), item('c', { due: day(5) })] as any}
  workInbox={[{ key: 'ad:DX1', chip: 'Duyệt chi', chipTone: 'amber', title: 'Chi dầu xe', meta: 'CĂN TIN · Gia Ny', amount: 4500000, memberIds: ['ny'], actions: [{ label: 'Từ chối', tone: 'no', onClick: () => approve('rejected') }, { label: 'Duyệt', tone: 'ok', onClick: () => approve('approved') }, { label: 'Mở & xử lý', tone: 'main', onClick: openApp }] }] as any}
  onCreateTask={createTask} projects={[{ id: 'P1', name: 'CĂN TIN' }]}
  onReceiveWork={receive} onOpenWorkTask={openTask} {...o} />);
const toWork = () => fireEvent.click(screen.getByTestId('zalo-mode-work'));

beforeEach(() => {
  localStorage.clear(); stopPresence(); Object.values(fn).forEach(f => f.mockClear()); receive.mockClear(); openTask.mockClear(); openApp.mockClear(); approve.mockClear(); createTask.mockClear();
  (Element.prototype as any).scrollIntoView = vi.fn();
  store.convs = [{ id: 'p_ny', type: 'personal', name: 'Gia Ny', participantIds: ['me', 'ny'], createdAt: '2026-10-01T00:00:00Z', unreadCount: 0 }];
  store.msgs = {}; store.convCb = null; store.onProgressive = null;
});

describe('Tab Việc của tôi trong Tin nhắn', () => {
  it('huy hiệu đếm đủ mục; chuyển tab thì hiện danh sách chia nhóm: Chờ xử lý → Quá hạn → Hôm nay → Sau đó', () => {
    mount();
    expect(screen.getByTestId('zalo-work-badge').textContent).toBe('4');
    toWork();
    const sections = Array.from(document.querySelectorAll('[data-testid^="work-section-"]')).map(e => e.getAttribute('data-testid'));
    expect(sections).toEqual(['work-section-inbox', 'work-section-late', 'work-section-today', 'work-section-week']);
    expect(screen.getAllByTestId('work-row')).toHaveLength(4);
    expect(within(screen.getByTestId('work-section-inbox')).getByText('Chi dầu xe')).toBeTruthy();
    expect(screen.queryByTestId('zalo-list')).toBeNull();   // danh sách hội thoại ẩn khi ở tab Việc của tôi
  });
  it('bấm 1 việc → chi tiết có nút hành động; Nhận việc / Mở chi tiết gọi đúng hàm', () => {
    mount(); toWork();
    fireEvent.click(document.querySelector('[data-work="task:b"]') as HTMLElement);
    const acts = within(screen.getByTestId('work-actions'));
    fireEvent.click(acts.getByText('Nhận việc')); expect(receive).toHaveBeenCalledWith(expect.objectContaining({ taskId: 'b' }));
    fireEvent.click(acts.getByText('Mở chi tiết')); expect(openTask).toHaveBeenCalledWith('b');
  });
  it('đề xuất chờ duyệt: chi tiết hiện số tiền; nút Mở & xử lý gọi hàm của App', () => {
    mount(); toWork();
    fireEvent.click(document.querySelector('[data-work="ap:ad:DX1"]') as HTMLElement);
    expect(screen.getByTestId('work-detail').textContent).toContain('4.500.000');
    fireEvent.click(within(screen.getByTestId('work-actions')).getByText('Mở & xử lý')); expect(openApp).toHaveBeenCalled();
  });
  it('mở mục → tạo luồng thảo luận gồm tôi + người liên quan (khớp theo mã), gửi tin vào ĐÚNG luồng của mục', async () => {
    mount(); toWork();
    fireEvent.click(document.querySelector('[data-work="ap:ad:DX1"]') as HTMLElement);
    await waitFor(() => expect(fn.ensureWorkThread).toHaveBeenCalled());
    const p = fn.ensureWorkThread.mock.calls[0][0];
    expect(p.key).toBe('ap:ad:DX1'); expect(p.memberIds.sort()).toEqual(['me', 'ny']);
    fireEvent.change(screen.getByTestId('work-input'), { target: { value: 'Anh đã xem' } });
    fireEvent.click(screen.getByTestId('work-send'));
    await waitFor(() => expect(fn.addMessage).toHaveBeenCalled());
    expect(fn.addMessage.mock.calls[0][0]).toMatchObject({ conversationId: 'conv_work_ap_ad_DX1', senderId: 'me', content: 'Anh đã xem' });
    await waitFor(() => expect(screen.getAllByTestId('work-msg')).toHaveLength(1));
  });
  it('luồng của việc gồm người được giao + người giao; mục có thảo luận chưa đọc hiện chấm đỏ', async () => {
    store.convs.push({ id: 'conv_work_task_a', type: 'group', name: '💬 Việc a', participantIds: ['me', 'tang'], createdAt: '2026-10-01T00:00:00Z', unreadCount: 2 });
    mount(); toWork();
    expect(within(document.querySelector('[data-work="task:a"]') as HTMLElement).getByTestId('work-unread')).toBeTruthy();
    fireEvent.click(document.querySelector('[data-work="task:a"]') as HTMLElement);
    await waitFor(() => expect(fn.ensureWorkThread).toHaveBeenCalled());
    expect(fn.ensureWorkThread.mock.calls[0][0].memberIds.sort()).toEqual(['me', 'tang']);
  });
  it('luồng thảo luận KHÔNG lẫn vào danh sách Tin nhắn thường', () => {
    store.convs.push({ id: 'conv_work_task_a', type: 'group', name: '💬 Việc a', participantIds: ['me', 'tang'], createdAt: '2026-10-01T00:00:00Z', unreadCount: 2 });
    mount();
    expect(screen.getAllByTestId('zalo-conv').map(r => r.getAttribute('data-conv'))).toEqual(['p_ny']);
  });
  it('không có việc nào → thông báo trống', () => {
    mount({ workItems: [], workInbox: [] }); toWork();
    expect(screen.getByTestId('work-empty')).toBeTruthy(); expect(screen.queryByTestId('zalo-work-badge')).toBeNull();
  });
  it('quay lại tab Tin nhắn thì danh sách hội thoại hiện lại', () => {
    mount(); toWork(); fireEvent.click(screen.getByTestId('zalo-mode-chat'));
    expect(screen.getByTestId('zalo-list')).toBeTruthy();
  });

  it('thẻ "Hôm nay" ở đầu tab Tin nhắn: đếm đúng và bấm Xem → sang tab Việc của tôi', () => {
    mount();
    const card = screen.getByTestId('zalo-today');
    expect(card.textContent).toContain('1 việc đến hạn'); expect(card.textContent).toContain('1 quá hạn'); expect(card.textContent).toContain('1 mục chờ bạn xử lý');
    fireEvent.click(card);
    expect(screen.getByTestId('work-list')).toBeTruthy();
  });
  it('nút Duyệt / Từ chối ngay trong chi tiết đề xuất', () => {
    mount(); toWork();
    fireEvent.click(document.querySelector('[data-work="ap:ad:DX1"]') as HTMLElement);
    const acts = within(screen.getByTestId('work-actions'));
    fireEvent.click(acts.getByText('Duyệt')); expect(approve).toHaveBeenCalledWith('approved');
    fireEvent.click(acts.getByText('Từ chối')); expect(approve).toHaveBeenCalledWith('rejected');
  });
});

describe('Việc trong khung chat', () => {
  const openChat = () => fireEvent.click(document.querySelector('[data-conv="p_ny"]') as HTMLElement);
  it('"Gửi việc vào hội thoại" (nút ở ô soạn tin): chọn đề xuất → gửi tin có THẺ kèm khóa mục', async () => {
    mount(); openChat();
    fireEvent.click(await screen.findByTestId('zalo-sendwork-btn'));
    fireEvent.click(within(screen.getByTestId('work-send-dialog')).getByText('Chi dầu xe'));
    await waitFor(() => expect(fn.addMessage).toHaveBeenCalled());
    const m = fn.addMessage.mock.calls[0][0];
    expect(m.conversationId).toBe('p_ny');
    expect(m.relatedEntity).toMatchObject({ type: 'advance', id: 'DX1', card: { kind: 'approval', key: 'ap:ad:DX1', amount: 4500000 } });
  });
  it('tin có thẻ: người đang có việc thấy nút xử lý đúng quyền; bấm Duyệt gọi hàm duyệt', async () => {
    store.msgs.p_ny = [{ id: 'c1', conversationId: 'p_ny', senderId: 'ny', senderName: 'Gia Ny', content: '📌 Duyệt chi', createdAt: new Date().toISOString(), read: true,
      relatedEntity: { type: 'advance', id: 'DX1', card: { kind: 'approval', key: 'ap:ad:DX1', title: 'Chi dầu xe', amount: 4500000, chip: 'Duyệt chi' } } }];
    mount(); openChat();
    const card = await screen.findByTestId('work-card');
    expect(card.textContent).toContain('4.500.000');
    fireEvent.click(within(card).getByText('Duyệt')); expect(approve).toHaveBeenCalledWith('approved');
  });
  it('tin có thẻ mà mục không còn chờ bạn (đã xử lý/không thuộc quyền): hiện thông báo, KHÔNG có nút duyệt', async () => {
    store.msgs.p_ny = [{ id: 'c2', conversationId: 'p_ny', senderId: 'ny', senderName: 'Gia Ny', content: 'x', createdAt: new Date().toISOString(), read: true,
      relatedEntity: { type: 'advance', id: 'DX9', card: { kind: 'approval', key: 'ap:ad:DX9', title: 'Đề xuất cũ', chip: 'Duyệt chi' } } }];
    mount(); openChat();
    const card = await screen.findByTestId('work-card');
    expect(within(card).getByTestId('work-card-done')).toBeTruthy(); expect(within(card).queryByText('Duyệt')).toBeNull();
  });
  it('"Tạo công việc từ tin nhắn": tạo công việc thật với tên từ tin nhắn rồi gửi thẻ việc vào hội thoại', async () => {
    store.msgs.p_ny = [{ id: 'm1', conversationId: 'p_ny', senderId: 'ny', senderName: 'Gia Ny', content: 'Nhờ anh kiểm tra lại số tài khoản người nhận', createdAt: new Date().toISOString(), read: true }];
    mount(); openChat();
    fireEvent.click(await screen.findByTitle('Thêm'));
    fireEvent.click(screen.getByTestId('zalo-menu-createtask'));
    expect((screen.getByTestId('work-create-name') as HTMLTextAreaElement).value).toContain('kiểm tra lại số tài khoản');
    expect((screen.getByTestId('work-create-assignee') as HTMLSelectElement).value).toBe('ny');   // hội thoại cá nhân → mặc định giao cho người kia
    fireEvent.click(screen.getByTestId('work-create-submit'));
    await waitFor(() => expect(createTask).toHaveBeenCalled());
    const t: any = (createTask.mock.calls[0] as any[])[0];
    expect(t).toMatchObject({ assigneeId: 'ny', assignerId: 'me', status: 'todo', completionRate: 0 });
    expect(t.name).toContain('kiểm tra lại số tài khoản');
    await waitFor(() => expect(fn.addMessage).toHaveBeenCalled());
    expect(fn.addMessage.mock.calls[0][0].relatedEntity).toMatchObject({ type: 'task', id: t.id, card: { kind: 'task', key: `task:${t.id}` } });
  });
});

describe('Khung chat — tự cuộn xuống cuối & ô nhập', () => {
  it('mở hội thoại → khung tin nhắn nhảy xuống đáy; cuộn lên xem tin cũ rồi có tin mới của người khác thì KHÔNG bị kéo xuống', async () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(900);
    store.msgs.p_ny = [{ id: 'm1', conversationId: 'p_ny', senderId: 'ny', senderName: 'Gia Ny', content: 'a', createdAt: new Date().toISOString(), read: true }];
    mount(); fireEvent.click(document.querySelector('[data-conv="p_ny"]') as HTMLElement);
    const box = await screen.findByTestId('zalo-messages');
    await waitFor(() => expect(box.scrollTop).toBe(900));
    spy.mockRestore();
  });
  it('ô nhập tin dùng lớp bỏ viền khi bấm vào (không bị viền đen của quy tắc input chung)', async () => {
    mount(); fireEvent.click(document.querySelector('[data-conv="p_ny"]') as HTMLElement);
    expect((await screen.findByLabelText('Nhập tin nhắn')).className).toContain('chat-plain-input');
  });
  it('menu "⋯" của tin sát mép TRÊN khung chat mở XUỐNG dưới (không bị cắt); tin ở giữa/dưới vẫn mở lên', async () => {
    store.msgs.p_ny = [{ id: 'm1', conversationId: 'p_ny', senderId: 'ny', senderName: 'Gia Ny', content: 'a', createdAt: new Date().toISOString(), read: true }];
    const rect = (top: number, bottom: number) => ({ top, bottom, left: 0, right: 0, width: 0, height: bottom - top, x: 0, y: top, toJSON() {} } as DOMRect);
    const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      return this.getAttribute('data-testid') === 'zalo-messages' ? rect(100, 700) : rect(this.getAttribute('title') === 'Thêm' ? mockTop : 0, 0);
    });
    let mockTop = 120;   // sát mép trên khung (khung bắt đầu ở 100)
    mount(); fireEvent.click(document.querySelector('[data-conv="p_ny"]') as HTMLElement);
    fireEvent.click(await screen.findByTitle('Thêm'));
    expect(screen.getByTestId('zalo-msgmenu').className).toContain('top-full');
    fireEvent.click(screen.getByTitle('Thêm')); mockTop = 650;   // gần đáy → mở lên
    fireEvent.click(screen.getByTitle('Thêm'));
    expect(screen.getByTestId('zalo-msgmenu').className).toContain('bottom-full');
    spy.mockRestore();
  });
  it('đang mở sẵn hội thoại mà số chưa đọc tăng (tin tới trước khi hội thoại cập nhật) → tự đánh dấu đã đọc', async () => {
    mount(); fireEvent.click(document.querySelector('[data-conv="p_ny"]') as HTMLElement);
    await screen.findByTestId('zalo-messages'); fn.markConversationRead.mockClear();
    store.convs = store.convs.map(c => c.id === 'p_ny' ? { ...c, unreadCount: 2 } : c);
    act(() => store.convCb?.());
    expect(fn.markConversationRead).toHaveBeenCalledWith('p_ny', 'me');
  });
  it('bấm lại hội thoại đang mở → tải lại tin (không "không có tác dụng")', async () => {
    mount(); const row = document.querySelector('[data-conv="p_ny"]') as HTMLElement;
    fireEvent.click(row); await screen.findByTestId('zalo-messages');
    const loads = (await import('../../lib/chatStore')).loadMessagesProgressive as any; loads.mockClear();
    fireEvent.click(row);
    await waitFor(() => expect(loads).toHaveBeenCalled());
  });
  it('lưới an toàn: realtime chậm → cứ ~4 giây tự hỏi tin mới và hiện lên', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      store.msgs.p_ny = [{ id: 'm1', conversationId: 'p_ny', senderId: 'ny', senderName: 'Gia Ny', content: 'cũ', createdAt: '2026-10-21T10:00:00Z', read: true }];
      mount(); fireEvent.click(document.querySelector('[data-conv="p_ny"]') as HTMLElement);
      await screen.findByTestId('zalo-messages');
      store.onProgressive = () => { store.msgs.p_ny.push({ id: 'm2', conversationId: 'p_ny', senderId: 'ny', senderName: 'Gia Ny', content: 'tin mới tới', createdAt: '2026-10-21T10:00:05Z', read: false }); store.onProgressive = null; };
      await act(async () => { await vi.advanceTimersByTimeAsync(4100); });
      await waitFor(() => expect(screen.getByText('tin mới tới')).toBeTruthy());
    } finally { vi.useRealTimers(); }
  });
  it('chạm 2 lần nhanh vào tin (điện thoại) → thả tim ❤️; chạm 1 lần, chạm chậm hoặc vuốt thì KHÔNG', async () => {
    store.msgs.p_ny = [{ id: 'm1', conversationId: 'p_ny', senderId: 'ny', senderName: 'Gia Ny', content: 'xin chào', createdAt: new Date().toISOString(), read: true }];
    mount(); fireEvent.click(document.querySelector('[data-conv="p_ny"]') as HTMLElement);
    const msg = await screen.findByTestId('zalo-msg');
    const tap = (x = 10, y = 10, ex = x, ey = y) => { fireEvent.touchStart(msg, { touches: [{ clientX: x, clientY: y }] }); fireEvent.touchEnd(msg, { changedTouches: [{ clientX: ex, clientY: ey }] }); };
    tap(); expect(fn.toggleMessageReaction).not.toHaveBeenCalled();            // mới 1 cú chạm
    tap(); await waitFor(() => expect(fn.toggleMessageReaction).toHaveBeenCalledWith('p_ny', 'm1', 'me', '❤️'));
    fn.toggleMessageReaction.mockClear();
    tap(10, 10, 10, 80); tap(10, 10, 10, 80); expect(fn.toggleMessageReaction).not.toHaveBeenCalled();   // vuốt (di chuyển xa) không tính
  });
  it('nút "xuống cuối" (như Zalo): chỉ hiện khi đã cuộn lên xa đáy; bấm thì xuống cuối và ẩn', async () => {
    store.msgs.p_ny = [{ id: 'm1', conversationId: 'p_ny', senderId: 'ny', senderName: 'Gia Ny', content: 'a', createdAt: new Date().toISOString(), read: true }];
    mount(); fireEvent.click(document.querySelector('[data-conv="p_ny"]') as HTMLElement);
    const box = (await screen.findByTestId('zalo-messages')) as HTMLElement;
    expect(screen.queryByTestId('zalo-jump-bottom')).toBeNull();                 // đang ở đáy → không có nút
    Object.defineProperty(box, 'scrollHeight', { configurable: true, value: 2000 }); Object.defineProperty(box, 'clientHeight', { configurable: true, value: 500 });
    box.scrollTop = 0; fireEvent.scroll(box);                                      // cuộn lên cách đáy 1500px
    const btn = await screen.findByTestId('zalo-jump-bottom'); fireEvent.click(btn);
    await waitFor(() => expect(screen.queryByTestId('zalo-jump-bottom')).toBeNull());
    expect(box.scrollTop).toBe(2000);
  });
});
