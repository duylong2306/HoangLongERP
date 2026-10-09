import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';

// Các tab phòng ban của Bảng điều hành Giám đốc: kiểm tra bộ lọc, phân trang, chọn số dòng.
const D = vi.hoisted(() => ({
  logs: [{ empId: 'E1', date: '2026-10-09', status: 'working' }],
  leaves: [
    { id: 'L1', empId: 'E2', empName: 'Bình', type: 'Nghỉ phép năm', status: 'approved', fromDate: '2026-10-09', toDate: '2026-10-09', daysCount: 1, reason: 'Việc nhà' },
    { id: 'L2', empId: 'E3', empName: 'Cường', type: 'Tạm ứng lương nhanh', status: 'pending', fromDate: '2026-10-08', toDate: '2026-10-08', reason: 'Ứng lương' },
  ],
  orders: [] as any[], proposals: [] as any[], inventory: [] as any[], subs: [] as any[], contracts: [] as any[], advances: [] as any[],
}));
vi.mock('../../lib/dbService', () => ({
  dbService: {
    attendance: { listForRange: vi.fn().mockImplementation(async () => D.logs) },
    hrmLeaves: { list: vi.fn().mockImplementation(async () => D.leaves) },
    purchaseOrders: { list: vi.fn().mockImplementation(async () => D.orders) },
    materialProposals: { list: vi.fn().mockImplementation(async () => D.proposals) },
    inventory: { list: vi.fn().mockImplementation(async () => D.inventory) },
    accountingSubcontractors: { list: vi.fn().mockImplementation(async () => D.subs) },
    archivedQuotes: { list: vi.fn().mockImplementation(async () => D.contracts) },
    subcontractorAdvances: { list: vi.fn().mockImplementation(async () => D.advances) },
  },
}));
import ProjectsView from '../director/ProjectsView';
import HrView from '../director/HrView';
import AccountingView from '../director/AccountingView';
import WarehouseView from '../director/WarehouseView';
import SubcontractorView from '../director/SubcontractorView';

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-09T10:30:00')); });
afterEach(() => { vi.useRealTimers(); cleanup(); });

const emp = (id: string, name: string, extra: any = {}) => ({ id, name, department: 'Xưởng', status: 'working', ...extra }) as any;
const employees = [emp('E1', 'An'), emp('E2', 'Bình', { department: 'Văn phòng' }), emp('E3', 'Cường'), emp('E4', 'Dũng', { status: 'retired' })];
const rangeText = () => screen.getAllByTestId('pager-range')[0].textContent;

describe('Phòng Dự Án — lọc & phân trang', () => {
  const projects = Array.from({ length: 25 }, (_, i) => ({ id: `P${i}`, code: `CT${i}`, name: `Công trình ${String(i).padStart(2, '0')}`, type: i % 2 ? 'furniture' : 'construction', status: 'processing', contractValue: 1_000_000 * (i + 1), progress: i, endDate: '2027-01-01', pmId: 'E1', customerId: 'C1' })) as any;
  const open = (nav = vi.fn()) => { render(<ProjectsView projects={projects} tasks={[]} receipts={[]} payments={[]} employees={employees} customers={[{ id: 'C1', name: 'Khách A' } as any]} onNavigateTab={nav} />); return nav; };
  it('mặc định 10 dòng/trang; sang trang 2; đổi 20 dòng/trang', () => {
    open();
    expect(rangeText()).toContain('1–10');
    expect(rangeText()).toContain('25');
    fireEvent.click(screen.getAllByLabelText('Trang sau')[0]);
    expect(rangeText()).toContain('11–20');
    fireEvent.change(screen.getAllByLabelText('Số dòng trên trang')[0], { target: { value: '20' } });
    expect(rangeText()).toContain('1–20'); // đổi số dòng → về trang 1
  });
  it('lọc theo loại thu hẹp danh sách và quay về trang 1; tìm không dấu', () => {
    open();
    fireEvent.click(screen.getAllByLabelText('Trang sau')[0]);
    fireEvent.change(screen.getByLabelText('Loại'), { target: { value: 'furniture' } });
    expect(rangeText()).toContain('1–10');
    expect(rangeText()).toContain('12'); // 12 công trình nội thất (i lẻ)
    fireEvent.change(screen.getAllByLabelText('Tìm kiếm')[0], { target: { value: 'cong trinh 03' } });
    expect(rangeText()).toContain('1–1');
    fireEvent.click(screen.getAllByText('Xóa bộ lọc')[0]);
    expect(rangeText()).toContain('25');
  });
  it('bấm dòng mở bảng dự án theo loại', () => {
    const nav = open();
    fireEvent.click(screen.getAllByText('Công trình 01', { selector: 'div' })[0]);
    expect(nav).toHaveBeenCalledWith('projects-furniture');
  });
});

describe('Phòng Nhân Sự — chấm công hôm nay & lọc', () => {
  it('đếm đúng và lọc "chưa chấm công"', async () => {
    render(<HrView employees={employees} onNavigateTab={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('1/3')).toBeInTheDocument());   // An đã chấm; Bình nghỉ phép; Cường chưa; Dũng đã nghỉ việc (không tính)
    fireEvent.click(within(screen.getByText('Tổng quan nhân sự hôm nay').closest('section')!).getByText('Chưa chấm công').closest('button')!);
    await waitFor(() => expect(screen.getAllByTestId('pager-range')[0]).toHaveTextContent('1–1'));
    const bang = screen.getByText('Danh sách nhân sự').closest('section')!;
    expect(within(bang).getByText('Cường')).toBeInTheDocument();
    expect(within(bang).queryByText('An')).toBeNull();
  });
  it('đơn nghỉ: mặc định chỉ hiện đơn chờ duyệt, đổi sang "Tất cả" hiện đủ', async () => {
    render(<HrView employees={employees} onNavigateTab={vi.fn()} />);
    const khoi = (await screen.findByText('Đơn nghỉ phép / tạm ứng lương')).closest('section')!;
    await waitFor(() => expect(within(khoi).getByText('Ứng lương')).toBeInTheDocument());
    expect(within(khoi).queryByText('Việc nhà')).toBeNull();
    fireEvent.change(within(khoi).getByLabelText('Trạng thái'), { target: { value: 'all' } });
    expect(within(khoi).getByText('Việc nhà')).toBeInTheDocument();
  });
});

describe('Phòng Kế Toán — thời gian, trạng thái, phân trang', () => {
  const pays = Array.from({ length: 23 }, (_, i) => ({ id: `PAY${i}`, code: `PC${i}`, date: '2026-10-09', amount: 1_000_000, category: 'material', status: i < 3 ? 'pending' : 'approved', recipient: `NCC ${i}`, projectId: 'P1', paymentMethod: 'transfer' })) as any;
  pays.push({ id: 'OLD', code: 'PCOLD', date: '2026-01-01', amount: 5_000_000, category: 'labor', status: 'approved', recipient: 'Cũ', projectId: 'P1', paymentMethod: 'cash' });
  const open = () => render(<AccountingView projects={[{ id: 'P1', name: 'Công trình 1', status: 'processing', contractValue: 100_000_000 } as any]} receipts={[]} payments={pays} customers={[]} onNavigateTab={vi.fn()} />);
  it('mặc định 30 ngày qua (loại phiếu cũ), 10 dòng/trang; lọc chờ duyệt', async () => {
    open();
    await waitFor(() => expect(screen.getAllByTestId('pager-range')[0]).toHaveTextContent('23'));
    expect(screen.queryByText('Cũ')).toBeNull();
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'pending' } });
    expect(screen.getAllByTestId('pager-range')[0]).toHaveTextContent('1–3');
  });
  it('chọn "Tất cả" thời gian thì thấy phiếu cũ; tổng cộng đúng', async () => {
    open();
    fireEvent.change(screen.getByLabelText('Thời gian'), { target: { value: 'all' } });
    expect(screen.getAllByTestId('pager-range')[0]).toHaveTextContent('24');
    fireEvent.change(screen.getAllByLabelText('Số dòng trên trang')[0], { target: { value: '50' } });
    expect(screen.getByText('Cũ')).toBeInTheDocument();
    expect(screen.getByText(/TỔNG \(24 phiếu/)).toBeInTheDocument();
  });
});

describe('Kho & Vật tư', () => {
  it('tồn kho: lọc hàng sắp hết / hết', async () => {
    D.inventory = [
      { id: 'I1', code: 'V1', name: 'Xi măng', unit: 'bao', qty: 100, minAlert: 10, unitPrice: 90000, location: 'Kho A' },
      { id: 'I2', code: 'V2', name: 'Thép phi 10', unit: 'cây', qty: 5, minAlert: 20, unitPrice: 120000, location: 'Kho A' },
      { id: 'I3', code: 'V3', name: 'Cát vàng', unit: 'm3', qty: 0, minAlert: 5, unitPrice: 300000, location: 'Kho B' },
    ];
    render(<WarehouseView projects={[]} onNavigateTab={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Xi măng')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Tình trạng tồn'), { target: { value: 'low' } });
    expect(screen.getByText('Thép phi 10')).toBeInTheDocument();
    expect(screen.queryByText('Xi măng')).toBeNull();
    expect(screen.queryByText('Cát vàng')).toBeNull();
  });
});

describe('Nhà thầu phụ', () => {
  it('tổng hợp từng thầu phụ và lọc theo tình trạng', async () => {
    D.subs = [{ id: 'S1', name: 'Tổ thợ A', field: 'Xây dựng', debt: 0 }, { id: 'S2', name: 'Tổ thợ B', field: 'Điện nước', debt: 2_000_000 }];
    D.contracts = [{ id: 'Q1', code: 'HDTP1', subcontractorId: 'S1', projectId: 'P1', projectName: 'Công trình 1', isApproved: true, contractValue: 50_000_000, date: '2026-09-01' }];
    render(<SubcontractorView projects={[]} payments={[{ id: 'X', subcontractorId: 'S1', status: 'approved', amount: 10_000_000 } as any]} onNavigateTab={vi.fn()} />);
    const khoi = (await screen.findByText('Danh sách thầu phụ')).closest('section')!;
    await waitFor(() => expect(within(khoi).getByText('Tổ thợ A')).toBeInTheDocument());
    expect(within(khoi).getByText('20%')).toBeInTheDocument();      // đã chi 10tr / hợp đồng 50tr
    fireEvent.change(within(khoi).getByLabelText('Tình trạng'), { target: { value: 'debt' } });
    expect(within(khoi).getByText('Tổ thợ B')).toBeInTheDocument();
    expect(within(khoi).queryByText('Tổ thợ A')).toBeNull();
  });
});
