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

describe('Phòng Dự Án — Nhiệm vụ toàn doanh nghiệp', () => {
  const projects = [{ id: 'PA', code: 'A', name: 'Công trình A', type: 'construction', status: 'processing', contractValue: 1, progress: 1, endDate: '2027-01-01', pmId: 'E1', customerId: 'C1' }, { id: 'PB', code: 'B', name: 'Công trình B', type: 'construction', status: 'processing', contractValue: 1, progress: 1, endDate: '2027-01-01', pmId: 'E1', customerId: 'C1' }] as any;
  const tasks = [
    { id: 'T1', name: 'Công việc 1', projectId: 'PA', deadline: '2026-10-20', status: 'doing', missions: [
      { id: 'm1', name: 'Đổ bê tông', status: 'doing', memberIds: ['E1'], mainAssigneeId: 'E1' },
      { id: 'm2', name: 'Chưa làm xa', status: 'todo', memberIds: [] },
      { id: 'm3', name: 'Trễ hạn', status: 'doing', memberIds: [], deadline: '2026-10-05' },
    ] },
    { id: 'T2', name: 'Công việc 2', projectId: 'PB', deadline: '2026-10-09', status: 'doing', missions: [{ id: 'm4', name: 'Đến hạn hôm nay', status: 'todo', memberIds: ['E2'], mainAssigneeId: 'E2' }] },
  ] as any;
  const open = () => render(<ProjectsView projects={projects} tasks={tasks} receipts={[]} payments={[]} employees={employees} customers={[{ id: 'C1', name: 'Khách A' } as any]} onNavigateTab={vi.fn()} />);
  const names = () => screen.getAllByTestId('mission-row').map(r => r.querySelector('td')!.textContent);
  it('mặc định chỉ hiện nhiệm vụ HÔM NAY của mọi công trình, đếm đúng', () => {
    open();
    expect(names().sort()).toEqual(['Đến hạn hôm nay', 'Đổ bê tông']);
    expect(screen.getByTestId('mission-today-count').textContent).toBe('2');
  });
  it('đổi tình trạng sang Quá hạn / Tất cả; lọc theo công trình', () => {
    open();
    const sel = screen.getAllByLabelText('Tình trạng')[2];   // [0] sức khỏe công trình, [1] công việc, [2] nhiệm vụ
    fireEvent.change(sel, { target: { value: 'overdue' } });
    expect(names()).toEqual(['Trễ hạn']);
    fireEvent.change(sel, { target: { value: 'all' } });
    expect(names()).toHaveLength(4);
    fireEvent.change(screen.getAllByLabelText('Công trình')[1], { target: { value: 'PB' } });
    expect(names()).toEqual(['Đến hạn hôm nay']);
  });
  it('không có nhiệm vụ hôm nay → thông báo rỗng', () => {
    render(<ProjectsView projects={projects} tasks={[]} receipts={[]} payments={[]} employees={employees} customers={[]} onNavigateTab={vi.fn()} />);
    expect(screen.getByText('Hôm nay chưa có nhiệm vụ nào cần làm.')).toBeTruthy();
  });
});

describe('Phòng Dự Án — Tổng chi phí / Còn phải chi / bảng Chi phí theo công trình', () => {
  const projects = [{ id: 'PX', code: 'CTX', name: 'Công trình X', type: 'construction', status: 'processing', contractValue: 5_000_000, progress: 10, endDate: '2027-01-01', pmId: 'E1', customerId: 'C1' }, { id: 'PY', code: 'CTY', name: 'Công trình Y', type: 'construction', status: 'processing', contractValue: 1_000_000, progress: 10, endDate: '2027-01-01', pmId: 'E1', customerId: 'C1' }] as any;
  const payments = [
    { id: 'p1', projectId: 'PX', subcontractorId: 'TP1', category: 'subcontractor_advance', status: 'approved', amount: 400_000, paymentMethod: 'transfer' },
    { id: 'p2', projectId: 'PX', category: 'site_expense', status: 'approved', amount: 50_000, paymentMethod: 'cash' },
  ] as any;
  const setup = () => {
    D.contracts = [{ id: 'K1', projectId: 'PX', subcontractorId: 'TP1', subcontractorName: 'Minh', contractValue: 1_000_000, isApproved: true }];
    D.orders = [
      { id: 'O1', projectId: 'PX', status: 'confirmed', supplierId: 'S1', tongTien: 500_000, thanhToanThucTe: 200_000, congNo: 300_000 },
      { id: 'O2', projectId: 'PX', status: 'completed', supplierId: '__warehouse__', tongTien: 100_000, thanhToanThucTe: 0, congNo: 0 },
    ];
    return render(<ProjectsView projects={projects} tasks={[]} receipts={[]} payments={payments} employees={employees} customers={[{ id: 'C1', name: 'Khách A' } as any]} onNavigateTab={vi.fn()} />);
  };
  it('bảng công trình: không còn cột Đã chi; có Tổng chi phí và Còn phải chi, tính theo 6 nhóm, kèm chi tiết khi rê chuột', async () => {
    setup();
    expect(screen.queryAllByText('Đã chi').length).toBe(1);   // chỉ còn trong bảng "Chi phí theo công trình", không còn ở bảng công trình
    // vật tư 500.000 + kho 100.000 + thầu phụ 1.000.000 (400.000 đã chi + 600.000 chưa trả) + công trường 50.000 = 1.650.000
    // đã chi = 200.000 (đơn) + 100.000 (kho) + 400.000 + 50.000 = 750.000; còn phải chi = 900.000
    await waitFor(() => expect(screen.getAllByTestId('remaining-cost')[0].textContent).toContain('900.000'));
    expect(screen.getAllByTestId('total-cost')[0].textContent).toContain('1.650.000');
    expect(screen.getAllByTestId('total-cost')[0].getAttribute('title')).toMatch(/Thầu phụ: 1\.000\.000/);
    D.contracts = []; D.orders = [];
  });
  it('bảng Chi phí theo công trình: từng cột, dòng cộng, tiền mặt, và ẩn công trình chưa có chi phí', async () => {
    setup();
    await waitFor(() => expect(screen.getAllByTestId('cost-row')).toHaveLength(1));   // công trình Y chưa có chi phí → ẩn
    const row = screen.getAllByTestId('cost-row')[0].textContent!;
    for (const x of ['500.000', '100.000', '1.000.000', '50.000', '1.650.000', '750.000', '900.000']) expect(row).toContain(x);
    expect(screen.getByTestId('cost-grand-total').textContent).toContain('1.650.000');
    expect(screen.getByTestId('cost-footer').textContent).toContain('1.650.000');
    fireEvent.change(screen.getByLabelText('Hiển thị'), { target: { value: 'all' } });
    expect(screen.getAllByTestId('cost-row')).toHaveLength(2);
    D.contracts = []; D.orders = [];
  });
});

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
