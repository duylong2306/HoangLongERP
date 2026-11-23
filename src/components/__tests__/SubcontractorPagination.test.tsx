import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

// Quản Lý Thầu Phụ: 2 bảng dữ liệu (Hợp đồng lưu trữ, Công nợ Trả theo thầu phụ) phải có phân trang +
// chọn "Số dòng/trang". Khóa hành vi: mặc định 10 dòng, đổi cỡ trang, qua trang sau, STT nối tiếp, tìm kiếm về trang 1.
const mkQuote = (i: number) => ({
  id: `h${i}`, code: `HDTP-${String(i).padStart(2, '0')}`, sector: 'subcontractor', creatorId: 'u1',
  subcontractorId: `tp${i}`, subcontractorName: `Thầu phụ ${i}`, projectName: `Dự án ${i}`, customerName: 'CĐT',
  workName: `Việc ${i}`, contractValue: 1000000 * i, isApproved: true, status: 'Đã Lập', createdAt: '2026-11-01',
});
const quotes = Array.from({ length: 12 }, (_, i) => mkQuote(i + 1));
vi.mock('../../lib/dbService', () => ({
  dbService: {
    archivedSubcontractorQuotes: { list: vi.fn(async () => quotes), save: vi.fn(), delete: vi.fn() },
    archivedQuotes: { list: vi.fn(async () => quotes), save: vi.fn(), delete: vi.fn() },
    projects: { list: vi.fn(async () => []) },
    payments: { list: vi.fn(async () => []) },
    accountingSubcontractors: { list: vi.fn(async () => []) },
    businessProfile: { get: vi.fn(async () => null) },
  },
}));
vi.mock('../../context', () => ({
  useNotification: () => ({ addToast: vi.fn() }),
  isUserInRoleGroup: () => true, isRoleAdmin: () => true, isRoleAccounting: () => true,
  canApproveProjectDoc: () => true,
}));
vi.mock('../RichTextEditor', () => ({ default: () => <div /> }));
import SubcontractorArchive from '../SubcontractorArchive';
import SubcontractorManagement from '../SubcontractorManagement';

const user: any = { id: 'u1', name: 'Giám đốc' };
beforeEach(() => { vi.clearAllMocks(); });

describe('Phân trang bảng hợp đồng thầu phụ (SubcontractorArchive)', () => {
  it('mặc định 10 dòng/trang; đổi 5 dòng; qua trang sau STT nối tiếp', async () => {
    render(<SubcontractorArchive currentUser={user} />);
    const pager = await screen.findByTestId('sub-archive-pager');
    await waitFor(() => expect(screen.getAllByText(/^HDTP-/)).toHaveLength(10));
    expect(within(pager).getByTestId('sub-archive-pager-range').textContent).toMatch(/1–10 \/ 12/);

    fireEvent.change(within(pager).getByTestId('sub-archive-pager-size'), { target: { value: '5' } });
    await waitFor(() => expect(screen.getAllByText(/^HDTP-/)).toHaveLength(5));

    fireEvent.click(within(pager).getByTestId('sub-archive-pager-next'));
    await waitFor(() => expect(screen.getByText('HDTP-06')).toBeTruthy());
    // STT trang 2 bắt đầu từ 6 (không quay về 1)
    expect(screen.getByText('6')).toBeTruthy();
  });

  it('chọn "Tất cả" hiện đủ 12 dòng; tìm kiếm thu hẹp danh sách và về trang 1', async () => {
    render(<SubcontractorArchive currentUser={user} />);
    const pager = await screen.findByTestId('sub-archive-pager');
    fireEvent.change(within(pager).getByTestId('sub-archive-pager-size'), { target: { value: '-1' } });
    await waitFor(() => expect(screen.getAllByText(/^HDTP-/)).toHaveLength(12));

    fireEvent.change(screen.getByPlaceholderText(/Tìm theo Mã hợp đồng/), { target: { value: 'HDTP-03' } });
    await waitFor(() => expect(screen.getAllByText(/^HDTP-/)).toHaveLength(1));
  });
});

describe('Phân trang bảng Công nợ Trả theo thầu phụ (SubcontractorManagement)', () => {
  it('12 thầu phụ → trang 1 hiện 10, có thanh phân trang với số dòng/trang', async () => {
    render(<SubcontractorManagement currentUser={user} />);
    const pager = await screen.findByTestId('sub-liab-pager');
    expect(within(pager).getByTestId('sub-liab-pager-range').textContent).toMatch(/1–10 \/ 12/);
    fireEvent.change(within(pager).getByTestId('sub-liab-pager-size'), { target: { value: '20' } });
    await waitFor(() => expect(within(pager).getByTestId('sub-liab-pager-range').textContent).toMatch(/1–12 \/ 12/));
  });
});
