import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import CopyButton from '../CopyButton';

// Nút sao chép nhanh dùng chung: bấm → sao chép + HIỆN thông báo "Đã sao chép" (rồi tự ẩn); thất bại → báo "Không sao chép được".
const setClipboard = (impl: any) => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: impl });
const bam = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el); }); };

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('CopyButton', () => {
  it('bấm → ghi đúng nội dung vào bộ nhớ tạm, hiện "Đã sao chép" rồi tự ẩn sau ~2 giây', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    render(<CopyButton text="LOLOAB12CD34" label="nội dung" />);
    expect(screen.queryByText('Đã sao chép')).toBeNull();
    await bam(screen.getByRole('button', { name: 'Sao chép nội dung' }));
    expect(writeText).toHaveBeenCalledWith('LOLOAB12CD34');
    expect(screen.getByRole('status')).toHaveTextContent('Đã sao chép');
    await act(async () => { vi.advanceTimersByTime(2100); });
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('bấm liên tiếp: thông báo được gia hạn (không ẩn sớm theo lần bấm trước)', async () => {
    setClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
    render(<CopyButton text="x" label="x" />);
    const nut = screen.getByRole('button', { name: 'Sao chép x' });
    await bam(nut);
    await act(async () => { vi.advanceTimersByTime(1500); });
    await bam(nut);                                                     // bấm lại ở giây 1.5
    await act(async () => { vi.advanceTimersByTime(1000); });           // giây 2.5: lần bấm đầu đã quá hạn nhưng lần 2 chưa
    expect(screen.getByRole('status')).toHaveTextContent('Đã sao chép');
    await act(async () => { vi.advanceTimersByTime(1200); });
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('Clipboard API không có → dùng cách cũ (execCommand) và vẫn báo "Đã sao chép"', async () => {
    setClipboard(undefined);
    const exec = vi.fn().mockReturnValue(true); (document as any).execCommand = exec;
    render(<CopyButton text="0123456789" label="số tài khoản" />);
    await bam(screen.getByRole('button', { name: 'Sao chép số tài khoản' }));
    expect(exec).toHaveBeenCalledWith('copy');
    expect(screen.getByRole('status')).toHaveTextContent('Đã sao chép');
  });

  it('không sao chép được (bị chặn) → báo lỗi rõ ràng, không im lặng', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });
    (document as any).execCommand = vi.fn().mockReturnValue(false);
    render(<CopyButton text="x" label="x" />);
    await bam(screen.getByRole('button', { name: 'Sao chép x' }));
    expect(screen.getByRole('status')).toHaveTextContent('Không sao chép được');
  });

  it('dạng nút có chữ: đổi chữ thành "Đã sao chép" rồi trả lại chữ cũ', async () => {
    setClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
    render(<CopyButton variant="text" text="a\nb" label="các mã" className="btn">Sao chép tất cả</CopyButton>);
    const nut = screen.getByRole('button', { name: /Sao chép tất cả/ });
    await bam(nut);
    expect(nut).toHaveTextContent('Đã sao chép');
    expect(screen.getByRole('status')).toHaveTextContent('Đã sao chép');
    await act(async () => { vi.advanceTimersByTime(2100); });
    expect(nut).toHaveTextContent('Sao chép tất cả');
  });
});
