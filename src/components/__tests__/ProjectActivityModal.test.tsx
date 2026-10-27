import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProjectActivityModal from '../ProjectActivityModal';

const row = (id: string, daysAgo: number, extra: any = {}) => {
  const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(10, 0, 0, 0);
  return { id, projectId: 'P1', type: 'tt', text: `sự kiện ${id}`, actorName: 'Long', createdAt: d.toISOString(), ...extra };
};

describe('Nhật ký dự án — khung dòng thời gian', () => {
  it('hiện sự kiện theo ngày (Hôm nay / Hôm qua), người làm in đậm, cũ → mới và chi tiết bấm xem', async () => {
    const loader = vi.fn().mockResolvedValue({ ok: true, rows: [row('a', 0, { from: 'Chờ duyệt', to: 'Hoàn thành', detail: 'dòng 1\ndòng 2', objName: 'Lắp khung' }), row('b', 1)], hasMore: false });
    render(<ProjectActivityModal projectId="P1" projectName="Cổng sắt" onClose={() => {}} loader={loader} />);
    expect(await screen.findAllByTestId('activity-event')).toHaveLength(2);
    expect(screen.getByText('Hôm nay')).toBeTruthy(); expect(screen.getByText('Hôm qua')).toBeTruthy();
    expect(screen.getByText('Chờ duyệt')).toBeTruthy(); expect(screen.getByText('Hoàn thành')).toBeTruthy();
    expect(screen.queryByText(/dòng 2/)).toBeNull();
    fireEvent.click(screen.getByText(/Xem chi tiết/)); expect(screen.getByText(/dòng 2/)).toBeTruthy();
    expect(screen.getByText('— Đã hiện toàn bộ lịch sử —')).toBeTruthy();
  });

  it('tải thêm 3 ngày khi cuộn gần cuối và khi bấm nút; hết thì thôi', async () => {
    const loader = vi.fn()
      .mockResolvedValueOnce({ ok: true, rows: [row('a', 0)], hasMore: true, nextBefore: 'M1' })
      .mockResolvedValueOnce({ ok: true, rows: [row('b', 5)], hasMore: false });
    render(<ProjectActivityModal projectId="P1" onClose={() => {}} loader={loader} />);
    await screen.findAllByTestId('activity-event');
    // jsdom không có bố cục thật: giả lập khung cao 100, nội dung cao 1000, đã cuộn tới cuối
    const box = screen.getByTestId('activity-scroll');
    Object.defineProperty(box, 'clientHeight', { value: 100, configurable: true });
    Object.defineProperty(box, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(box, 'scrollTop', { value: 900, configurable: true });
    fireEvent.scroll(box);
    await waitFor(() => expect(screen.getAllByTestId('activity-event')).toHaveLength(2));
    expect(loader).toHaveBeenLastCalledWith('P1', expect.objectContaining({ before: 'M1' }));
    expect(loader).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('activity-more')).toBeNull();
  });

  it('có nút "Tải 3 ngày trước đó" để bấm tay khi còn lịch sử cũ', async () => {
    const loader = vi.fn()
      .mockResolvedValueOnce({ ok: true, rows: [row('a', 0)], hasMore: true, nextBefore: 'M1' })
      .mockResolvedValueOnce({ ok: true, rows: [row('b', 5)], hasMore: false });
    render(<ProjectActivityModal projectId="P1" onClose={() => {}} loader={loader} />);
    fireEvent.click(await screen.findByTestId('activity-more'));
    await waitFor(() => expect(screen.getAllByTestId('activity-event')).toHaveLength(2));
  });

  it('đổi bộ lọc → tải lại từ đầu với bộ lọc mới (lọc ở máy chủ, tìm trong toàn bộ lịch sử)', async () => {
    const loader = vi.fn().mockResolvedValue({ ok: true, rows: [row('a', 0, { actorName: 'Ny' })], hasMore: false });
    render(<ProjectActivityModal projectId="P1" onClose={() => {}} loader={loader} />);
    await screen.findAllByTestId('activity-event');
    fireEvent.click(screen.getByRole('button', { name: /Duyệt/ }));
    await waitFor(() => expect(loader).toHaveBeenLastCalledWith('P1', expect.objectContaining({ filters: expect.objectContaining({ type: 'duyet' }) })));
    fireEvent.click(screen.getByRole('button', { name: 'Nhiệm vụ' }));
    await waitFor(() => expect(loader).toHaveBeenLastCalledWith('P1', expect.objectContaining({ filters: expect.objectContaining({ type: 'duyet', objKind: 'mission' }) })));
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-10-01' } });
    await waitFor(() => expect(loader).toHaveBeenLastCalledWith('P1', expect.objectContaining({ filters: expect.objectContaining({ from: '2026-10-01' }) })));
    fireEvent.click(screen.getByTestId('activity-clear'));
    await waitFor(() => expect(loader).toHaveBeenLastCalledWith('P1', expect.objectContaining({ filters: expect.not.objectContaining({ type: 'duyet' }) })));
  });

  it('chưa chạy migration → báo rõ; có onExport mới hiện nút Xuất Excel', async () => {
    const loader = vi.fn().mockResolvedValue({ ok: false, rows: [], notEnabled: true, hasMore: false });
    const onExport = vi.fn();
    const { rerender } = render(<ProjectActivityModal projectId="P1" onClose={() => {}} loader={loader} />);
    expect(await screen.findByTestId('activity-not-enabled')).toBeTruthy();
    expect(screen.queryByTestId('activity-export')).toBeNull();
    rerender(<ProjectActivityModal projectId="P1" onClose={() => {}} loader={loader} onExport={onExport} />);
    fireEvent.click(screen.getByTestId('activity-export')); expect(onExport).toHaveBeenCalled();
  });

  it('chế độ Lịch sử công việc: truyền taskId xuống bộ tải, tiêu đề đổi', async () => {
    const loader = vi.fn().mockResolvedValue({ ok: true, rows: [], hasMore: false });
    render(<ProjectActivityModal projectId="P1" taskId="T9" taskName="Hàn khung" onClose={() => {}} loader={loader} />);
    expect(await screen.findByText('Lịch sử công việc')).toBeTruthy();
    expect(loader).toHaveBeenCalledWith('P1', expect.objectContaining({ taskId: 'T9' }));
    expect(await screen.findByTestId('activity-empty')).toBeTruthy();
  });
});
