import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Phòng Giám Đốc phải thấy hợp đồng ĐÃ DUYỆT (như Kế toán), kể cả khi trường project.contractValue lưu cứng đang là 0.
const quotes = vi.hoisted(() => ({ list: [] as any[] }));
vi.mock('../../lib/dbService', () => ({ dbService: { archivedQuotes: { list: vi.fn().mockImplementation(async () => quotes.list) } } }));
// Các màn con chỉ cần cho thấy giá trị hợp đồng mà chúng nhận được
const Show = vi.hoisted(() => (name: string) => ({ projects }: any) => (
  <div data-testid={name}>{projects.map((p: any) => `${p.id}=${p.contractValue}`).join(';')}</div>
));
vi.mock('../ExecutiveDashboard', () => ({ default: Show('summary') }));
vi.mock('../director/ProjectsView', () => ({ default: Show('projects') }));
vi.mock('../director/AccountingView', () => ({ default: Show('accounting') }));
vi.mock('../director/HrView', () => ({ default: () => null }));
vi.mock('../director/WarehouseView', () => ({ default: () => null }));
vi.mock('../director/SubcontractorView', () => ({ default: () => null }));
import DirectorDashboard from '../DirectorDashboard';

const projects = [{ id: 'P1', contractValue: 0 }, { id: 'P2', contractValue: 88_000_000 }] as any;
const props = { tasks: [], receipts: [], payments: [], employees: [], customers: [], currentUser: {} as any, onChangeSubDepartment: vi.fn(), onNavigateTab: vi.fn() };

describe('DirectorDashboard — giá trị hợp đồng đã duyệt', () => {
  it('công trình có hợp đồng đã duyệt lấy tổng đó; công trình chưa có giữ giá trị đang lưu — ở mọi tab', async () => {
    quotes.list = [{ projectId: 'P1', sector: 'construction', contractApproved: true, totalAmount: 1_315_459_569 }];
    for (const tab of ['summary', 'projects', 'accounting'] as const) {
      const { unmount } = render(<DirectorDashboard {...props} projects={projects} activeSubDepartment={tab} />);
      await waitFor(() => expect(screen.getByTestId(tab)).toHaveTextContent('P1=1315459569;P2=88000000'));
      unmount();
    }
  });
  it('chưa có hợp đồng nào được duyệt → giữ nguyên số đang lưu', async () => {
    quotes.list = [];
    render(<DirectorDashboard {...props} projects={projects} activeSubDepartment="summary" />);
    expect(screen.getByTestId('summary')).toHaveTextContent('P1=0;P2=88000000');
  });
});
