import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import ProjectCostDetail from '../director/ProjectCostDetail';
import { buildProjectCosts, buildProjectCostItems } from '../../lib/projectCost';

// "Chi tiết tổng chi phí": tổng, đã chi/còn phải chi, tỷ trọng nhóm, danh sách khoản từng nhóm; đóng được.
const proj: any = { id: 'P1', name: 'CĂN TIN', code: 'DA_CT_1' };
const inp: any = {
  orders: [{ id: 'O1', projectId: 'P1', status: 'confirmed', supplierId: 'S', supplierName: 'NCC A', tongTien: 600, thanhToanThucTe: 200 }],
  payments: [{ id: 'p1', projectId: 'P1', status: 'approved', category: 'site_expense', amount: 150, code: 'PC-1', recipient: 'Thợ X' }, { id: 'p2', projectId: 'P1', status: 'pending', category: 'other', amount: 50, code: 'PC-2' }],
  advances: [], contracts: [],
};
const cost = buildProjectCosts(['P1'], inp).get('P1')!; const items = buildProjectCostItems('P1', inp);

describe('ProjectCostDetail', () => {
  it('hiện tổng, đã chi, còn phải chi và từng nhóm có khoản; nhóm rỗng bị ẩn', () => {
    render(<ProjectCostDetail project={proj} cost={cost} items={items} onClose={() => {}} />);
    expect(screen.getByTestId('cost-detail-total').textContent).toContain('800');
    expect(screen.getByTestId('cost-legend-material').textContent).toContain('600');
    expect(screen.getByTestId('cost-group-site')).toBeTruthy(); expect(screen.getByTestId('cost-group-pending')).toBeTruthy();
    expect(screen.queryByTestId('cost-group-warehouse')).toBeNull(); expect(screen.queryByTestId('cost-group-subcontract')).toBeNull();
  });
  it('mỗi khoản có tên, người nhận/nhà cung cấp, số tiền; nhóm lớn nhất mở sẵn', () => {
    render(<ProjectCostDetail project={proj} cost={cost} items={items} onClose={() => {}} />);
    const mat = screen.getByTestId('cost-group-material') as HTMLDetailsElement; expect(mat.open).toBe(true);
    expect(within(mat).getByText('Đơn mua hàng O1')).toBeTruthy(); expect(within(mat).getByText('NCC A')).toBeTruthy();
    expect((screen.getByTestId('cost-group-site') as HTMLDetailsElement).open).toBe(false);
  });
  it('công trình chưa có khoản chi → thông báo; nút đóng và bấm nền gọi onClose', () => {
    const onClose = vi.fn();
    render(<ProjectCostDetail project={proj} cost={buildProjectCosts(['P1'], { payments: [], orders: [], advances: [], contracts: [] }).get('P1')!} items={[]} onClose={onClose} />);
    expect(screen.getByText(/chưa có khoản chi nào/)).toBeTruthy();
    fireEvent.click(screen.getByTestId('cost-detail-close')); expect(onClose).toHaveBeenCalled();
  });
});

// iPhone: tiêu đề phải mang lx-drawer-head để quy tắc chung (shell.css) không đệm vùng an toàn thêm lần nữa cho lớp phủ (tránh cộng đôi)
describe('ProjectCostDetail — vùng an toàn không bị đệm đôi', () => {
  it('tiêu đề có lớp lx-drawer-head', () => {
    render(<ProjectCostDetail project={proj} cost={cost} items={items} onClose={() => {}} />);
    expect(screen.getByTestId('cost-detail').querySelector('header.lx-drawer-head')).not.toBeNull();
  });
});
