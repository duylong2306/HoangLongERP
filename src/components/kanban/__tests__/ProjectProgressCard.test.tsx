import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProjectProgressCard from '../ProjectProgressCard';

const stage = { id: 'col_active', name: 'GIỚI ĐOẠN THI CÔNG', index: 3, total: 7, from: 50, to: 67 };
const auto = { value: 59, auto: 59, source: 'auto' as const, stage, done: 5, total: 9 };
const manual = { ...auto, value: 80, source: 'manual' as const };

describe('Khối tiến độ dự án', () => {
  it('tự tính: hiện số, giai đoạn, khoảng và số việc xong; có nút ghi đè cho người có quyền', () => {
    render(<ProjectProgressCard progress={auto} canEdit onSave={vi.fn()} />);
    expect(screen.getByTestId('progress-value').textContent).toBe('59%');
    const t = screen.getByTestId('progress-explain').textContent!;
    expect(t).toContain('GIỚI ĐOẠN THI CÔNG (bước 4/7)'); expect(t).toContain('50% → 67%'); expect(t).toContain('5/9');
    expect(screen.getByTestId('progress-edit')).toBeTruthy();
  });
  it('không có quyền → không có nút ghi đè', () => {
    render(<ProjectProgressCard progress={auto} canEdit={false} onSave={vi.fn()} />);
    expect(screen.queryByTestId('progress-edit')).toBeNull();
  });
  it('ghi đè: nhập số hợp lệ → lưu; số ngoài 0–100 → nút khóa', async () => {
    const onSave = vi.fn(async () => {});
    render(<ProjectProgressCard progress={auto} canEdit onSave={onSave} />);
    fireEvent.click(screen.getByTestId('progress-edit'));
    fireEvent.change(screen.getByTestId('progress-input'), { target: { value: '120' } });
    expect((screen.getByTestId('progress-save') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByTestId('progress-input'), { target: { value: '75' } });
    fireEvent.click(screen.getByTestId('progress-save'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(75));
  });
  it('đang ghi đè: báo rõ kèm số tự tính; "Về tự động" gửi null', async () => {
    const onSave = vi.fn(async () => {});
    render(<ProjectProgressCard progress={manual} canEdit onSave={onSave} />);
    expect(screen.getByTestId('progress-manual-note').textContent).toContain('80%');
    expect(screen.getByTestId('progress-manual-note').textContent).toContain('59%');
    fireEvent.click(screen.getByTestId('progress-auto'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(null));
  });
  it('dự án hoàn thành: không cho ghi đè', () => {
    render(<ProjectProgressCard progress={{ ...auto, value: 100, source: 'completed' }} canEdit onSave={vi.fn()} />);
    expect(screen.queryByTestId('progress-edit')).toBeNull();
    expect(screen.getByTestId('progress-explain').textContent).toContain('đã hoàn thành');
  });
});
