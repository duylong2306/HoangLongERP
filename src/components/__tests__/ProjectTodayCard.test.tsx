import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ProjectTodayCard from '../ProjectTodayCard';

const ev = (id: string, hh: number, extra: any = {}) => {
  const d = new Date(); d.setHours(hh, 0, 0, 0);
  return { id, projectId: 'P1', type: 'tt', text: `sự kiện ${id}`, actorName: 'Long', createdAt: d.toISOString(), ...extra };
};

describe('Thẻ "Hôm nay" (khung thông tin hội thoại)', () => {
  it('hiện tối đa 4 hoạt động mới nhất kèm nhãn loại + giờ, phần còn lại gom vào "Xem thêm N hoạt động"', async () => {
    const rows = [ev('a', 20, { type: 'tao', actorName: 'Ngọc' }), ev('b', 19, { attachments: [{ url: 'u1' }, { url: 'u2' }, { url: 'u3' }] }), ev('c', 13, { type: 'duyet' }), ev('d', 8, { type: 'tc' }), ev('e', 7), ev('f', 6)];
    const onOpen = vi.fn();
    render(<ProjectTodayCard projectId="P1" onOpen={onOpen} loader={vi.fn().mockResolvedValue(rows)} />);
    const items = await screen.findAllByTestId('today-item');
    expect(items).toHaveLength(4);
    expect(screen.getByText(/6 hoạt động/)).toBeTruthy();
    expect(items[0].textContent).toContain('Ngọc'); expect(items[0].textContent).toContain('Tạo mới'); expect(items[0].textContent).toContain('20:00');
    expect(items[1].textContent).toContain('📎 3 tệp');
    fireEvent.click(screen.getByTestId('today-more'));
    expect(screen.getByTestId('today-more').textContent).toBe('Xem thêm 2 hoạt động ›');
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('không quá số dòng hiện sẵn thì không có nút "Xem thêm"', async () => {
    render(<ProjectTodayCard projectId="P1" onOpen={() => {}} loader={vi.fn().mockResolvedValue([ev('a', 9), ev('b', 8)])} />);
    await screen.findAllByTestId('today-item');
    expect(screen.queryByTestId('today-more')).toBeNull();
  });

  it('hôm nay chưa có gì → 1 dòng nhắc; đang tải lần đầu thì chưa hiện gì', async () => {
    const loader = vi.fn().mockResolvedValue([]);
    const { container } = render(<ProjectTodayCard projectId="P1" onOpen={() => {}} loader={loader} />);
    expect(container.querySelector('[data-testid="today-card"]')).toBeNull();
    expect((await screen.findByTestId('today-empty')).textContent).toContain('chưa có hoạt động');
  });

  it('tải lại khi nhật ký của đúng dự án này có sự kiện mới; dự án khác thì bỏ qua', async () => {
    const loader = vi.fn().mockResolvedValue([ev('a', 9)]);
    render(<ProjectTodayCard projectId="P1" onOpen={() => {}} loader={loader} />);
    await screen.findAllByTestId('today-item');
    expect(loader).toHaveBeenCalledTimes(1);
    act(() => { window.dispatchEvent(new CustomEvent('hl-project-events-updated', { detail: { projectId: 'KHAC' } })); });
    expect(loader).toHaveBeenCalledTimes(1);
    loader.mockResolvedValue([ev('b', 10), ev('a', 9)]);
    act(() => { window.dispatchEvent(new CustomEvent('hl-project-events-updated', { detail: { projectId: 'P1' } })); });
    await waitFor(() => expect(screen.getAllByTestId('today-item')).toHaveLength(2));
  });

  it('đổi sang dự án khác → tải lại theo dự án mới', async () => {
    const loader = vi.fn().mockResolvedValue([ev('a', 9)]);
    const { rerender } = render(<ProjectTodayCard projectId="P1" onOpen={() => {}} loader={loader} />);
    await screen.findAllByTestId('today-item');
    rerender(<ProjectTodayCard projectId="P2" onOpen={() => {}} loader={loader} />);
    await waitFor(() => expect(loader).toHaveBeenLastCalledWith('P2'));
  });
});
