import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ColumnSettingsModal from '../ColumnSettingsModal';

const col: any = { id: 'col_active', name: 'THI CÔNG', color: 'bg-amber-500', iconColor: 'text-amber-400', automation: { type: 'none', progressFrom: 30, progressTo: 80, stuckDays: 45 } };

describe('Cài đặt cột Kanban — khoảng tiến độ & cảnh báo kẹt', () => {
  it('hiện giá trị đã cấu hình; lưu gửi đúng các ô', () => {
    const onSave = vi.fn();
    render(<ColumnSettingsModal column={col} onSave={onSave} onDelete={vi.fn()} onClose={vi.fn()} />);
    expect((screen.getByTestId('col-from') as HTMLInputElement).value).toBe('30');
    expect((screen.getByTestId('col-to') as HTMLInputElement).value).toBe('80');
    expect((screen.getByTestId('col-stuck') as HTMLInputElement).value).toBe('45');
    fireEvent.change(screen.getByTestId('col-stuck'), { target: { value: '0' } });
    fireEvent.click(screen.getByText('Lưu thiết lập'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ progressFrom: '30', progressTo: '80', stuckDays: '0' }));
  });
  it('cột chưa cấu hình → các ô để trống (dùng mặc định)', () => {
    render(<ColumnSettingsModal column={{ ...col, automation: { type: 'none' } }} onSave={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />);
    expect((screen.getByTestId('col-from') as HTMLInputElement).value).toBe('');
    expect((screen.getByTestId('col-stuck') as HTMLInputElement).value).toBe('');
  });
});
