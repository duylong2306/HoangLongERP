import React, { useEffect, useRef, useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import LeavesTab from '../hr/tabs/LeavesTab';
import { findPairedAbsenceReport } from '../../lib/leaveRequests';

afterEach(cleanup);

const today = new Date();
const d = `${today.getFullYear()}-01-10`;   // trong khoảng lọc mặc định (đầu năm → hôm nay)
const rep = (id: string, shift: string, over: any = {}) => ({ id, empId: 'NV018', empName: 'Lê Văn Công', type: 'Báo cáo nghỉ ca', shift, fromDate: d, toDate: d, daysCount: 1, status: 'pending' as const, reason: 'Em bị ốm', ...over });

const renderTab = (leaves: any[], handleApproveLeave = vi.fn(), onDeleteLeave = vi.fn()) => {
  const Wrapper = () => {
    const [sel, setSel] = useState<string | null>(null);
    return <LeavesTab leaves={leaves} selectedLeaveId={sel} setSelectedLeaveId={setSel} handleApproveLeave={handleApproveLeave} onDeleteLeave={onDeleteLeave}
      globalPageSize={50} setGlobalPageSize={() => {}} leavePage={1} setLeavePage={() => {}} />;
  };
  return { ...render(<Wrapper />), handleApproveLeave, onDeleteLeave };
};

describe('Tab Nghỉ phép — gộp báo cáo nghỉ ca "Cả ngày"', () => {
  it('cặp sáng + chiều đang chờ duyệt hiện thành 1 dòng "Cả ngày", dòng lẻ giữ nguyên', () => {
    const { container } = renderTab([rep('LR-001', 'morning'), rep('LR-002', 'afternoon'), rep('LR-003', 'morning', { empId: 'NV022', empName: 'Nguyễn Trần Nghĩa' })]);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(container.textContent).toContain('Cả ngày (sáng + chiều)');
    expect(container.textContent).toContain('+ LR-002');
    expect(container.textContent).toContain('Ca sáng');   // dòng lẻ ghi rõ ca
  });

  it('chọn dòng "Cả ngày": có ghi chú đi cùng đơn kia, nút Duyệt/Từ chối ghi "cả ngày"; bấm → gọi cho đơn đã chọn (cặp xử lý ở handler)', () => {
    const { container, handleApproveLeave } = renderTab([rep('LR-001', 'morning'), rep('LR-002', 'afternoon')]);
    fireEvent.click(container.querySelector('tbody tr')!);
    expect(container.textContent).toContain('báo cáo CẢ NGÀY');
    fireEvent.click(screen.getByText('Duyệt cả ngày ✅'));
    expect(handleApproveLeave).toHaveBeenCalledWith('LR-001', 'approved');
    fireEvent.click(screen.getByText('Từ chối cả ngày'));
    expect(handleApproveLeave).toHaveBeenCalledWith('LR-001', 'rejected');
  });

  it('đơn lẻ (không có cặp): nút giữ nhãn cũ', () => {
    const { container } = renderTab([rep('LR-003', 'morning')]);
    fireEvent.click(container.querySelector('tbody tr')!);
    expect(screen.getByText('Duyệt phép ✅')).toBeInTheDocument();
    expect(container.textContent).not.toContain('CẢ NGÀY');
  });

  it('đơn đã duyệt cùng ngày KHÔNG bị gộp (hiện đủ 2 dòng)', () => {
    const { container } = renderTab([rep('LR-001', 'morning', { status: 'approved' }), rep('LR-002', 'afternoon', { status: 'approved' })]);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
  });

  it('xóa dòng "Cả ngày" xóa luôn đơn đi cùng', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { container, onDeleteLeave } = renderTab([rep('LR-001', 'morning'), rep('LR-002', 'afternoon')]);
    fireEvent.click(container.querySelector('tbody tr')!);
    fireEvent.click(screen.getByTitle('Xóa đơn nghỉ phép này'));
    expect(onDeleteLeave).toHaveBeenCalledWith('LR-001');
    expect(onDeleteLeave).toHaveBeenCalledWith('LR-002');
  });
});

// Kiểm chứng MẪU "hàng đợi + effect" dùng ở 2 màn hình duyệt (HR và Quản lý công việc): handler tính từ state của lần render hiện tại,
// nên gọi 2 lần liền sẽ ghi đè nhau; xử lý đơn 2 sau khi state cập nhật thì cả hai cùng được duyệt.
describe('Mẫu duyệt cả cặp: không ghi đè nhau', () => {
  const Harness = ({ useQueue }: { useQueue: boolean }) => {
    const [leaves, setLeaves] = useState<any[]>([rep('A', 'morning'), rep('B', 'afternoon')]);
    // Giống handleApproveLeave thật: dựng danh sách mới từ `leaves` của render hiện tại rồi setLeaves(cả danh sách)
    const approve = (id: string) => setLeaves(leaves.map(l => l.id === id ? { ...l, status: 'approved' } : l));
    const queue = useRef<string[]>([]);
    const approveWithPair = (id: string) => {
      const sib = findPairedAbsenceReport(leaves.find(l => l.id === id), leaves);
      if (useQueue) { queue.current = sib ? [sib.id] : []; approve(id); }
      else { approve(id); if (sib) approve(sib.id); }   // cách "ngây thơ": gọi 2 lần liền
    };
    useEffect(() => { const n = queue.current.shift(); if (n) approve(n); }, [leaves]);   // eslint-disable-line
    return <div><button onClick={() => approveWithPair('A')}>go</button><span data-testid="s">{leaves.map(l => l.status).join(',')}</span></div>;
  };
  it('gọi 2 lần liền (cách ngây thơ) → chỉ 1 đơn được duyệt (chứng minh lỗi cần tránh)', () => {
    render(<Harness useQueue={false} />); fireEvent.click(screen.getByText('go'));
    expect(screen.getByTestId('s').textContent).toBe('pending,approved');
  });
  it('dùng hàng đợi + effect → cả hai đơn được duyệt', async () => {
    render(<Harness useQueue />); await act(async () => { fireEvent.click(screen.getByText('go')); });
    expect(screen.getByTestId('s').textContent).toBe('approved,approved');
  });
});

describe('Tab Nghỉ phép — nhãn "Xin muộn"', () => {
  it('đơn có dấu [XIN MUỘN…] hiện nhãn ở danh sách và cảnh báo + lý do gốc ở chi tiết', () => {
    const l = { id: 'LR-050', empId: 'NV001', empName: 'Nhân viên A', type: 'Nghỉ phép năm', fromDate: d, toDate: d, daysCount: 1, status: 'pending' as const,
      reason: '[XIN MUỘN: báo trước 0,3 ngày, quy định 1 ngày] Việc gia đình' };
    const { container } = renderTab([l]);
    expect(container.querySelector('tbody')!.textContent).toContain('⚠ Xin muộn');
    fireEvent.click(container.querySelector('tbody tr')!);
    expect(container.textContent).toContain('XIN MUỘN — báo trước 0,3 ngày, quy định 1 ngày');
    expect(container.textContent).toContain('"Việc gia đình"');
    expect(container.textContent).not.toContain('[XIN MUỘN');   // dấu thô không lộ ra giao diện
  });
  it('đơn thường không có nhãn', () => {
    const l = { id: 'LR-051', empId: 'NV001', empName: 'Nhân viên A', type: 'Nghỉ phép năm', fromDate: d, toDate: d, daysCount: 1, status: 'pending' as const, reason: 'Việc gia đình' };
    const { container } = renderTab([l]);
    expect(container.textContent).not.toContain('Xin muộn');
  });
});
