// Test thanh phân trang dùng chung: khoảng hiển thị, chuyển trang, đổi số dòng/trang, luôn hiện kể cả danh sách ngắn
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import TablePagination, { pageWindow, usePagination } from '../TablePagination';

describe('pageWindow', () => {
  it('ít trang: liệt kê hết; nhiều trang: có dấu … và luôn có trang đầu/cuối', () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(5, 12)).toEqual([1, '…', 4, 5, 6, '…', 12]);
    expect(pageWindow(1, 12)).toEqual([1, 2, '…', 12]);
  });
});

describe('TablePagination', () => {
  it('hiện khoảng đang xem, chuyển trang và đổi số dòng/trang', () => {
    const onPage = vi.fn(); const onPageSize = vi.fn();
    render(<TablePagination total={57} page={2} pageSize={10} onPage={onPage} onPageSize={onPageSize} unit="phiếu" />);
    expect(screen.getByTestId('pager-range').textContent).toContain('11–20');
    expect(screen.getByTestId('pager-range').textContent).toContain('57 phiếu');
    fireEvent.click(screen.getByTestId('pager-next'));
    expect(onPage).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByTestId('pager-prev'));
    expect(onPage).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByTestId('pager-page-6'));
    expect(onPage).toHaveBeenCalledWith(6);
    fireEvent.change(screen.getByTestId('pager-size'), { target: { value: '-1' } });
    expect(onPageSize).toHaveBeenCalledWith(-1);
  });
  it('danh sách ngắn vẫn hiện ô chọn số dòng/trang; "Tất cả" hiện 1–total', () => {
    render(<TablePagination total={3} page={1} pageSize={10} onPage={() => {}} onPageSize={() => {}} />);
    expect(screen.getByTestId('pager-size')).toBeTruthy();
    expect((screen.getByTestId('pager-prev') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('pager-next') as HTMLButtonElement).disabled).toBe(true);
  });
  it('trang vượt tổng (sau khi lọc) tự kéo về trang hợp lệ', () => {
    const onPage = vi.fn();
    render(<TablePagination total={5} page={4} pageSize={5} onPage={onPage} onPageSize={() => {}} />);
    expect(onPage).toHaveBeenCalledWith(1);
  });
});

describe('usePagination', () => {
  it('cắt đúng trang, đổi số dòng về trang 1, "Tất cả" trả toàn bộ', () => {
    const list = Array.from({ length: 25 }, (_, i) => i + 1);
    const { result } = renderHook(() => usePagination(10));
    expect(result.current.slice(list)).toEqual(list.slice(0, 10));
    act(() => result.current.setPage(3));
    expect(result.current.slice(list)).toEqual([21, 22, 23, 24, 25]);
    act(() => result.current.props(25).onPageSize(-1));
    expect(result.current.slice(list)).toEqual(list);
    expect(result.current.page).toBe(1);
  });
});
