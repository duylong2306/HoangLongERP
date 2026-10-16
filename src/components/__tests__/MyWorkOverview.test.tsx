import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import MyWorkOverview, { type InboxItem } from '../MyWorkOverview';
import { buildMyWorkItems, pinsStorageKey } from '../../lib/myWork';

const TODAY = '2026-10-16';
const me: any = { id: 'u1', name: 'Trương Hữu Long' };
const emps: any[] = [me, { id: 'u2', name: 'Cao Võ Anh Hào' }];
const task = (id: string, o: any = {}) => ({ id, name: `Việc ${id}`, projectId: 'P1', assigneeId: 'u1', assignerId: 'boss', status: 'doing', deadline: '2026-10-20', completionRate: 30, missions: [], ...o }) as any;
const items = buildMyWorkItems([
  task('late', { deadline: '2026-10-12' }), task('today', { deadline: TODAY }), task('week', { deadline: '2026-10-19' }),
  task('new', { status: 'todo', deadline: '2026-11-30' }), task('free', { deadline: '' }),
], { userId: 'u1', userName: me.name, projectName: () => 'Công trình A', canReceiveTask: () => true });
const KEY = pinsStorageKey('u1');
const inbox = (onOk = vi.fn(), onNo = vi.fn()): InboxItem[] => [
  { key: 'k1', chip: 'Duyệt chi', chipTone: 'amber', title: 'Chi dầu xe', meta: 'Công trình A · Ny', amount: 4500000, actions: [{ label: 'Từ chối', tone: 'no', onClick: onNo }, { label: 'Duyệt', tone: 'ok', onClick: onOk }] },
];
const mount = (o: any = {}) => render(<MyWorkOverview today={TODAY} user={me} items={items} inbox={inbox()} byMe={[]} employees={emps} pinKey={KEY} onOpenTask={vi.fn()} onReceive={vi.fn()} {...o} />);
beforeEach(() => localStorage.clear());

describe('MyWorkOverview', () => {
  it('lời chào, 5 chỉ số tách riêng Quá hạn / Hôm nay / Mới chờ nhận / Chờ xử lý / Tôi giao', () => {
    mount();
    expect(screen.getByText(/Chào Long/)).toBeTruthy();
    expect(screen.getByTestId('mywork-stat-Quá hạn').textContent).toBe('1');
    expect(screen.getByTestId('mywork-stat-Hôm nay').textContent).toBe('1');
    expect(screen.getByTestId('mywork-stat-Mới, chờ nhận').textContent).toBe('1');
    expect(screen.getByTestId('mywork-stat-Chờ tôi xử lý').textContent).toBe('1');
    expect(screen.getByTestId('mywork-stat-Tôi giao').textContent).toBe('0');
  });
  it('dải 7 ngày có đủ 7 ô, ô đầu là Hôm nay', () => {
    mount();
    const week = screen.getByTestId('mywork-week');
    expect(week.children).toHaveLength(7);
    expect(week.children[0].textContent).toContain('Hôm nay');
  });
  it('Tập trung hôm nay tự gom việc quá hạn + đến hạn hôm nay', () => {
    mount();
    const focus = screen.getByTestId('mywork-focus');
    expect(within(focus).getAllByTestId('mywork-row').map(r => r.textContent)).toEqual([expect.stringContaining('Việc late'), expect.stringContaining('Việc today')]);
  });
  it('Tất cả việc: chia nhóm theo mốc; nhóm Sau đó/Chưa đặt hạn mặc định thu gọn', () => {
    mount();
    expect(screen.getByTestId('mywork-group-late')).toHaveProperty('open', true);
    expect(screen.getByTestId('mywork-group-today')).toHaveProperty('open', true);
    expect(screen.getByTestId('mywork-group-week')).toHaveProperty('open', true);
    expect(screen.getByTestId('mywork-group-later')).toHaveProperty('open', false);
    expect(screen.getByTestId('mywork-group-none')).toHaveProperty('open', false);
  });
  it('ghim một việc → xuất hiện ở Tập trung hôm nay và được nhớ trong trình duyệt; bỏ ghim thì mất', () => {
    mount();
    const all = screen.getByTestId('mywork-all');
    const rowWeek = within(all).getAllByTestId('mywork-row').find(r => r.textContent!.includes('Việc week'))!;
    fireEvent.click(within(rowWeek).getByLabelText('Ghim vào Tập trung hôm nay'));
    const focus = screen.getByTestId('mywork-focus');
    expect(within(focus).getAllByTestId('mywork-row')).toHaveLength(3);
    expect(JSON.parse(localStorage.getItem(KEY)!).keys).toEqual(['task:week']);
    fireEvent.click(within(focus).getAllByLabelText('Bỏ ghim')[0]);
    expect(within(screen.getByTestId('mywork-focus')).getAllByTestId('mywork-row')).toHaveLength(2);
  });
  it('ghim đã lưu từ ngày hôm qua không còn hiệu lực', () => {
    localStorage.setItem(KEY, JSON.stringify({ day: '2026-10-15', keys: ['task:week'] }));
    mount();
    expect(within(screen.getByTestId('mywork-focus')).getAllByTestId('mywork-row')).toHaveLength(2);
  });
  it('Mới được giao: có nút Nhận việc, bấm gọi onReceive đúng mục', () => {
    const onReceive = vi.fn();
    mount({ onReceive });
    const waiting = screen.getByTestId('mywork-waiting');
    fireEvent.click(within(waiting).getByTestId('mywork-receive'));
    expect(onReceive).toHaveBeenCalledTimes(1);
    expect(onReceive.mock.calls[0][0].key).toBe('task:new');
  });
  it('không có quyền nhận → không hiện nút Nhận việc', () => {
    const noRecv = buildMyWorkItems([task('new', { status: 'todo' })], { userId: 'u1', userName: me.name, projectName: () => '', canReceiveTask: () => false });
    mount({ items: noRecv });
    expect(screen.queryByTestId('mywork-receive')).toBeNull();
  });
  it('Chờ tôi xử lý: hiện số tiền và các nút hành động gọi đúng hàm', () => {
    const ok = vi.fn(), no = vi.fn();
    mount({ inbox: inbox(ok, no) });
    const box = screen.getByTestId('mywork-inbox');
    expect(box.textContent).toContain('4.500.000 đ');
    fireEvent.click(within(box).getByText('Duyệt'));
    fireEvent.click(within(box).getByText('Từ chối'));
    expect(ok).toHaveBeenCalledTimes(1); expect(no).toHaveBeenCalledTimes(1);
  });
  it('rỗng: báo không có việc và không có mục chờ', () => {
    mount({ items: [], inbox: [] });
    expect(screen.getByText('Chưa có việc nào được giao cho bạn.')).toBeTruthy();
    expect(screen.getByText('Không có mục nào đang chờ.')).toBeTruthy();
    expect(screen.getByText(/Hôm nay chưa có việc đến hạn/)).toBeTruthy();
  });
  it('Tôi giao cho người khác: hiện người nhận; bấm mở công việc', () => {
    const onOpenTask = vi.fn();
    mount({ onOpenTask, byMe: [{ taskId: 'T9', title: 'Giao việc X', project: 'Công trình A', assigneeId: 'u2', assigneeName: 'Cao Võ Anh Hào', due: '2026-10-25', rate: 50, status: 'doing' }] });
    const box = screen.getByTestId('mywork-byme');
    expect(box.textContent).toContain('Cao Võ Anh Hào');
    fireEvent.click(within(box).getByText('Giao việc X'));
    expect(onOpenTask).toHaveBeenCalledWith('T9');
  });
});
