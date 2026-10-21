import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

// Tab "Việc của tôi" trong Tin nhắn kiểu mới: danh sách theo nhóm, chi tiết + luồng thảo luận riêng của từng mục, hành động.
const store = vi.hoisted(() => ({ convs: [] as any[], msgs: {} as Record<string, any[]> }));
const fn = vi.hoisted(() => ({
  addMessage: vi.fn(async (m: any) => { const x = { ...m, id: 'new_' + Math.random(), createdAt: new Date().toISOString(), read: false }; (store.msgs[m.conversationId] ||= []).push(x); return x; }),
  ensureWorkThread: vi.fn(async (p: any) => ({ id: 'conv_work_' + p.key.replace(/[^A-Za-z0-9_-]/g, '_'), participantIds: p.memberIds })),
  markConversationRead: vi.fn(async () => {}), markMessagesReadByUser: vi.fn(async () => {}),
}));
vi.mock('../../lib/chatStore', () => ({
  getConversations: () => store.convs.map(c => ({ ...c })), getMessages: (id: string) => (store.msgs[id] || []).map(m => ({ ...m })),
  ...fn, loadConversationsFromCloud: vi.fn(async () => []), loadMessagesFromCloud: vi.fn(async () => []),
  subscribeConversations: () => () => {}, subscribeMessages: () => () => {},
}));
vi.mock('../../context', () => ({ useNotification: () => ({ addToast: vi.fn() }), isRoleAdmin: () => false }));
import MessagesZalo from '../MessagesZalo';
import { stopPresence } from '../../lib/presence';
import { todayYmd } from '../../lib/myWork';

const me: any = { id: 'me', name: 'Trương Hữu Long', role: 'director' };
const emps: any[] = [me, { id: 'ny', name: 'Lê Nguyễn Gia Ny' }, { id: 'tang', name: 'Hồ Văn Tặng' }];
const day = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const task = (id: string, o: any = {}) => ({ id, name: 'Việc ' + id, status: 'doing', assigneeId: 'me', assignerId: 'tang', deadline: day(0), completionRate: 40, missions: [], ...o });
const item = (id: string, o: any = {}) => ({ key: `task:${id}`, kind: 'task', taskId: id, title: 'Việc ' + id, taskName: 'Việc ' + id, project: 'CĂN TIN', due: day(0), rate: 40, status: 'doing', isLead: true, canReceive: false, role: 'assignee', memberCount: 0, doneDay: '', ...o });

const receive = vi.fn(); const openTask = vi.fn(); const openApp = vi.fn();
const mount = (o: any = {}) => render(<MessagesZalo currentUser={me} employees={emps} tasks={[task('a'), task('b'), task('c')] as any}
  workItems={[item('a', { due: day(-2) }), item('b', { canReceive: true, status: 'todo', due: day(0) }), item('c', { due: day(5) })] as any}
  workInbox={[{ key: 'ad:DX1', chip: 'Duyệt chi', chipTone: 'amber', title: 'Chi dầu xe', meta: 'CĂN TIN · Gia Ny', amount: 4500000, memberIds: ['ny'], actions: [{ label: 'Mở & xử lý', tone: 'main', onClick: openApp }] }] as any}
  onReceiveWork={receive} onOpenWorkTask={openTask} {...o} />);
const toWork = () => fireEvent.click(screen.getByTestId('zalo-mode-work'));

beforeEach(() => {
  localStorage.clear(); stopPresence(); Object.values(fn).forEach(f => f.mockClear()); receive.mockClear(); openTask.mockClear(); openApp.mockClear();
  (Element.prototype as any).scrollIntoView = vi.fn();
  store.convs = [{ id: 'p_ny', type: 'personal', name: 'Gia Ny', participantIds: ['me', 'ny'], createdAt: '2026-10-01T00:00:00Z', unreadCount: 0 }];
  store.msgs = {};
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
});
