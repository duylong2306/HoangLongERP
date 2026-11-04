import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// Tab "Dự án" (màn quản lý dự án cũ): thanh tiến độ phải theo giai đoạn (cột Kanban) + việc con xong, không còn đọc project.progress cũ.
vi.mock('../../context', () => ({ useNotification: () => ({ addToast: vi.fn() }), isRoleAdmin: () => true, isUserInRoleGroup: () => true }));
vi.mock('../../hooks/useKanbanColumnsBySector', () => ({ useKanbanColumnsBySector: () => ({}) }));   // không có cột lưu → bộ cột mặc định 7 cột
import ProjectManagement from '../ProjectManagement';

afterEach(cleanup);

const admin: any = { id: 'admin', name: 'Admin', role: 'admin', roleGroupIds: ['role_admin'] };
const proj = (o: any = {}) => ({ id: 'P1', code: 'CT-1', name: 'Công trình A', type: 'construction', status: 'processing', progress: 85, customerId: 'C1', pmId: 'admin', startDate: '2026-10-01', endDate: '2026-12-01', contractValue: 1000, address: 'HN', notes: '', kanbanColumnId: 'col_design', ...o });
const task = (id: string, status: string) => ({ id, projectId: 'P1', name: id, status } as any);
const mount = (p: any, tasks: any[], extra: any = {}) => render(
  <ProjectManagement projects={[p]} customers={[{ id: 'C1', name: 'Khách', phone: '', address: '' } as any]} employees={[admin]} receipts={[]} payments={[]} tasks={tasks}
    onAddProject={vi.fn()} onUpdateProjectStatus={vi.fn()} currentUser={admin} {...extra} />);

describe('ProjectManagement — tiến độ theo cột Kanban', () => {
  it('thanh trong danh sách = tiến độ TỰ TÍNH, bỏ qua project.progress cũ (85)', () => {
    // Cột "Thiết kế" (giai đoạn đầu, 0–17%) + 1/2 việc con xong → ~8–9%, màu đỏ (<30%)
    mount(proj(), [task('a', 'completed'), task('b', 'todo')]);
    const v = screen.getByTestId('pm-progress').textContent || '';
    expect(v).not.toContain('85');
    expect(Number(v.replace(/[^0-9]/g, ''))).toBeLessThan(30);
    expect(screen.getByTestId('pm-bar')).toHaveAttribute('data-tone', 'bad');
    expect(screen.getByTestId('pm-bar').className).toContain('bg-rose-500');
  });
  it('dự án đã Hoàn thành → 100%, thanh xanh lá', () => {
    mount(proj({ status: 'completed' }), []);
    expect(screen.getByTestId('pm-progress').textContent).toContain('100%');
    expect(screen.getByTestId('pm-bar').className).toContain('bg-emerald-500');
  });
  it('PM đã ghi đè → hiện số tay kèm dấu ✎', () => {
    mount(proj({ progressManual: 70 }), [task('a', 'todo')]);
    expect(screen.getByTestId('pm-progress').textContent).toContain('70%');
    expect(screen.getByTestId('pm-progress').textContent).toContain('✎');
    expect(screen.getByTestId('pm-bar')).toHaveAttribute('data-tone', 'blue');
  });
  it('khung chi tiết: nhập số tay → Lưu gọi onUpdateProject({ progressManual }); "Về tự động" gửi null', () => {
    const onUpdateProject = vi.fn();
    const { rerender } = mount(proj(), [task('a', 'todo')], { onUpdateProject });
    // dự án đầu tiên được chọn sẵn → khung chi tiết đã hiện
    const input = screen.getByLabelText('Tiến độ nhập tay (%)');
    fireEvent.change(input, { target: { value: '45' } });
    fireEvent.click(screen.getByText('Lưu'));
    expect(onUpdateProject).toHaveBeenCalledWith('P1', { progressManual: 45 });
    rerender(<ProjectManagement projects={[proj({ progressManual: 45 })]} customers={[]} employees={[admin]} receipts={[]} payments={[]} tasks={[task('a', 'todo')]}
      onAddProject={vi.fn()} onUpdateProjectStatus={vi.fn()} onUpdateProject={onUpdateProject} currentUser={admin} />);
    fireEvent.click(screen.getByText('Về tự động'));
    expect(onUpdateProject).toHaveBeenLastCalledWith('P1', { progressManual: null });
  });
  it('khung chi tiết hiện số tự tính, giai đoạn và số việc con xong', () => {
    mount(proj(), [task('a', 'completed'), task('b', 'todo')]);
    // dự án đầu tiên được chọn sẵn → khung chi tiết đã hiện
    const box = screen.getByTestId('progress-override').textContent || '';
    expect(box).toContain('1/2 việc con xong'); expect(box).toContain('giai đoạn');
  });
});
