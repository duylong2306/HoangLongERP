import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup, waitFor } from '@testing-library/react';

// Phòng Dự Án: cảnh báo giai đoạn (kẹt / lệch / chậm) + thời gian ở giai đoạn trong phễu.
const S = vi.hoisted(() => ({ stage: new Map<string, string>() }));
vi.mock('../../lib/dbService', () => ({ dbService: {
  purchaseOrders: { list: async () => [] }, subcontractorAdvances: { list: async () => [] }, archivedQuotes: { list: async () => [] }, materialProposals: { list: async () => [] },
} }));
vi.mock('../../lib/projectEvents', async (orig) => ({ ...(await orig<any>()), loadStageEntries: async () => S.stage }));
import ProjectsView from '../director/ProjectsView';

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-28T10:00:00')); S.stage = new Map(); });
afterEach(() => { vi.useRealTimers(); cleanup(); });

const P = (id: string, col: string, o: any = {}) => ({ id, code: id, name: `Công trình ${id}`, type: 'construction', status: 'processing', contractValue: 1_000_000, progress: 0, endDate: '2027-01-01', startDate: '', pmId: 'E1', customerId: 'C1', kanbanColumnId: col, ...o }) as any;
const open = (projects: any[], tasks: any[] = []) => render(<ProjectsView projects={projects} tasks={tasks} receipts={[]} payments={[]} employees={[{ id: 'E1', name: 'An' } as any]} customers={[{ id: 'C1', name: 'Khách A' } as any]} onNavigateTab={vi.fn()} />);
const rows = () => screen.getAllByTestId('total-cost').map(td => td.closest('tr')!);

describe('Phòng Dự Án — cảnh báo giai đoạn', () => {
  it('đếm kẹt / lệch / chậm; bấm chip lọc danh sách; dòng công trình có huy hiệu', async () => {
    S.stage = new Map([['A', '2026-08-01T03:00:00Z']]);                 // A kẹt ở "thi công" 88 ngày
    open([P('A', 'col_active'), P('B', 'col_active'), P('C', 'col_done', { status: 'completed' })],
      [{ projectId: 'C', status: 'doing', id: 't1', name: 'v', deadline: '2026-11-01' }]);   // C hoàn thành mà còn việc → lệch
    await waitFor(() => expect(screen.getByTestId('alert-chip-stuck').textContent).toContain('1'));
    expect(screen.getByTestId('alert-chip-mismatch').textContent).toContain('1');
    expect(screen.getByTestId('alert-chip-behind').textContent).toContain('0');
    fireEvent.click(screen.getByTestId('alert-chip-stuck'));
    expect(rows()).toHaveLength(1);
    expect(rows()[0].textContent).toContain('Công trình A');
    expect(within(rows()[0]).getByTestId('row-alert').textContent).toContain('Kẹt giai đoạn');
    fireEvent.click(screen.getByTestId('alert-chip-mismatch'));
    expect(rows()[0].textContent).toContain('Công trình C');
  });
  it('phễu ghi thời gian TB ở giai đoạn và số dự án kẹt; chưa có nhật ký thì báo chưa rõ', async () => {
    S.stage = new Map([['A', '2026-08-01T03:00:00Z'], ['B', '2026-10-18T03:00:00Z']]);   // 88 ngày và 10 ngày → TB 49
    open([P('A', 'col_active'), P('B', 'col_active'), P('D', 'col_design')]);
    await waitFor(() => {
      const st = screen.getAllByTestId('funnel-stage');
      expect(within(st.find(s => s.textContent!.includes('THI CÔNG'))!).getByTestId('funnel-dwell').textContent).toContain('TB 49 ngày');
    });
    const st = screen.getAllByTestId('funnel-stage');
    expect(within(st.find(s => s.textContent!.includes('THI CÔNG'))!).getByTestId('funnel-dwell').textContent).toContain('1 kẹt');
    expect(within(st.find(s => s.textContent!.includes('THIẾT KẾ'))!).getByTestId('funnel-dwell').textContent).toContain('Chưa rõ');
  });
});
