import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';

// Bảng điều hành Giám đốc: kiểm tra các khối chính hiển thị đúng số liệu và điều hướng.
const T = '2026-10-09';
vi.mock('../../lib/dbService', () => ({
  dbService: {
    attendance: { listForRange: vi.fn().mockResolvedValue([{ empId: 'E1', date: '2026-10-09', status: 'working' }]) },
    hrmLeaves: { list: vi.fn().mockResolvedValue([{ id: 'L1', empId: 'E2', status: 'approved', fromDate: '2026-10-09', toDate: '2026-10-09' }, { id: 'L2', empId: 'E3', status: 'pending', fromDate: '2026-10-12', toDate: '2026-10-12' }]) },
    purchaseOrders: { list: vi.fn().mockResolvedValue([{ id: 'PO1', status: 'confirmed', createdAt: '2026-10-09T02:00:00', congNo: 500000 }]) },
    materialProposals: { list: vi.fn().mockResolvedValue([{ id: 'MP1', status: 'waiting_approval', createdAt: '2026-10-09T03:00:00' }]) },
    subcontractorAdvances: { list: vi.fn().mockResolvedValue([{ id: 'A1', status: 'pending_approval' }, { id: 'A2', status: 'pending_payment' }]) },
  },
}));
import ExecutiveDashboard from '../ExecutiveDashboard';

const employees = [{ id: 'E1', name: 'An', status: 'working' }, { id: 'E2', name: 'Bình', status: 'working' }, { id: 'E3', name: 'Cường', status: 'working' }] as any;
const projects = [
  { id: 'P1', code: 'CT1', name: 'Công trình Alpha', type: 'construction', status: 'processing', contractValue: 2_000_000_000, progress: 40, endDate: '2027-01-01', pmId: 'E1' },
  { id: 'P2', code: 'CT2', name: 'Công trình Beta', type: 'furniture', status: 'processing', contractValue: 100_000_000, progress: 10, endDate: '2027-01-01', pmId: 'E1' },
] as any;
const tasks = [
  { id: 'T1', name: 'Đổ bê tông móng', projectId: 'P1', assigneeId: 'E1', status: 'doing', deadline: '2026-10-20' },
  { id: 'T2', name: 'Lắp tủ bếp', projectId: 'P2', assigneeId: 'E2', status: 'todo', deadline: '2026-10-01' },
  { id: 'T3', name: 'Sơn tường', projectId: 'P1', assigneeId: 'E3', status: 'todo', deadline: '2026-11-15' },
] as any;
const receipts = [{ id: 'R1', code: 'PT1', date: T, amount: 500_000_000, projectId: 'P1' }] as any;
const payments = [
  { id: 'PAY1', code: 'PC1', date: T, amount: 120_000_000, projectId: 'P1', category: 'material', status: 'approved', recipient: 'NCC Thép' },
  { id: 'PAY2', code: 'PC2', date: T, amount: 30_000_000, projectId: 'P2', category: 'labor', status: 'pending', recipient: 'Thợ mộc' },
  { id: 'PAY3', code: 'PC3', date: T, amount: 130_000_000, projectId: 'P2', category: 'material', status: 'approved', recipient: 'NCC Gỗ' },
] as any;

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-09T10:30:00')); });
afterEach(() => { vi.useRealTimers(); cleanup(); });

describe('ExecutiveDashboard — Bảng điều hành Giám đốc', () => {
  const open = async (nav = vi.fn()) => {
    render(<ExecutiveDashboard projects={projects} tasks={tasks} receipts={receipts} payments={payments} employees={employees} onNavigateTab={nav} />);
    // chờ các nguồn dữ liệu bất đồng bộ (chấm công, nghỉ phép, vật tư…) nạp xong
    await waitFor(() => expect(screen.getAllByText(/1\/3/).length).toBeGreaterThan(0));
    return nav;
  };
  it('tổng hợp: giá trị hợp đồng, đã thu, đã chi', async () => {
    await open();
    const khoi = screen.getByText('Tổng hợp tài chính toàn doanh nghiệp').closest('section')!;
    expect(within(khoi).getByText('Tổng giá trị hợp đồng')).toBeInTheDocument();
    expect(within(khoi).getByText('2,1 tỷ')).toBeInTheDocument();      // 2.000tr + 100tr
    expect(within(khoi).getByText('Đã thu').nextSibling).toHaveTextContent('500 tr');
    expect(within(khoi).getByText('Đã chi (đã duyệt)').nextSibling).toHaveTextContent('250 tr'); // 120 + 130, bỏ phiếu chờ duyệt
  });
  it('chi phí từng công trình: từng dòng + tổng cộng + cảnh báo vượt ngân sách', async () => {
    await open();
    const bang = screen.getByText('Chi phí từng công trình').closest('section')!;
    expect(within(bang).getByText('Công trình Alpha')).toBeInTheDocument();
    expect(within(bang).getByText('Công trình Beta')).toBeInTheDocument();
    expect(within(bang).getByText('TỔNG CỘNG')).toBeInTheDocument();
    expect(within(bang).getByText('Chi vượt hợp đồng')).toBeInTheDocument(); // Beta: chi 130tr > hợp đồng 100tr
  });
  it('phòng dự án: số việc quá hạn / chưa làm và tab danh sách', async () => {
    await open();
    const khoi = screen.getByText(/Phòng Dự Án — hôm nay/).closest('section')!;
    fireEvent.click(within(khoi).getByRole('tab', { name: /Quá hạn \(1\)/ }));
    expect(within(khoi).getByText('Lắp tủ bếp')).toBeInTheDocument();
    expect(within(khoi).getByText('Trễ 8 ngày')).toBeInTheDocument();
    fireEvent.click(within(khoi).getByRole('tab', { name: /Chưa làm \(1\)/ }));
    expect(within(khoi).getByText('Sơn tường')).toBeInTheDocument();
  });
  it('nhân sự: có mặt 1/3, nghỉ phép 1, chưa chấm công 1 (Cường)', async () => {
    await open();
    const khoi = screen.getByText(/Nhân sự — chấm công hôm nay/).closest('section')!;
    expect(within(khoi).getByText('1/3')).toBeInTheDocument();
    expect(within(khoi).getAllByText('Cường').length).toBeGreaterThan(0);
  });
  it('kế toán: chi hôm nay liệt kê phiếu, phiếu chờ duyệt đếm riêng', async () => {
    await open();
    const khoi = screen.getByText(/Kế toán — thu chi hôm nay/).closest('section')!;
    expect(within(khoi).getByText('NCC Thép')).toBeInTheDocument();
    expect(within(khoi).getByText('Thợ mộc')).toBeInTheDocument();
  });
  it('vật tư: đơn mua và đề xuất hôm nay', async () => {
    await open();
    const khoi = screen.getByText(/Vật tư — số đơn theo ngày/).closest('section')!;
    expect(within(khoi).getByText('Đơn mua hôm nay').nextSibling).toHaveTextContent('1');
    expect(within(khoi).getByText('Đề xuất hôm nay').nextSibling).toHaveTextContent('1');
  });
  it('bấm vào dòng công trình mở đúng bảng dự án theo loại; bấm "Mở tài chính" sang tab finance', async () => {
    const nav = await open();
    fireEvent.click(screen.getByText('Công trình Beta'));
    expect(nav).toHaveBeenCalledWith('projects-furniture');
    fireEvent.click(screen.getByText(/Mở tài chính/));
    expect(nav).toHaveBeenCalledWith('finance');
  });
});
