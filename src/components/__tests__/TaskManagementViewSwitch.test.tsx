import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

// "Việc của tôi": chỉ còn kiểu Tổng quan (đã bỏ kiểu Cột/Kanban) và hành động trong Tổng quan dùng đúng hàm.
vi.mock('../../lib/dbService', () => ({ dbService: {
  hrmLeaves: { list: vi.fn(async () => []) }, payments: { list: vi.fn(async () => []) }, hrmTravelExpenses: { list: vi.fn(async () => []) },
  materialProposals: { list: vi.fn(async () => []) }, employees: { list: vi.fn(async () => []), save: vi.fn() }, subcontractorAdvances: { list: vi.fn(async () => []) },
} }));
vi.mock('../../lib/chatStore', () => ({ sendApprovalDirectMessage: vi.fn(), findEmployeeByName: vi.fn(), ensureProjectChatGroup: vi.fn(), addMemberToConversation: vi.fn() }));
vi.mock('../TaskDetailModal', () => ({ default: (p: any) => <div data-testid="task-detail">{p.taskId}</div> }));
vi.mock('../ConnectedToolsModal', () => ({ default: () => null }));
vi.mock('../../context', () => ({
  useNotification: () => ({ addToast: vi.fn() }), isUserInRoleGroup: () => false, getConfiguredApprovers: () => [], getMaterialApprovers: () => [], getMaterialCoordinators: () => [],
  isRoleAdmin: () => false, isRoleAccounting: () => false, isConfiguredApproverForProposal: () => false, isConfiguredApproverForPayment: () => false,
  canApproveTravelExpense: () => false, isLeaveApproverFor: () => false,
}));
vi.mock('../hr/hrTaskPermissions', () => ({ canDoTaskAction: () => true, loadTaskPermissionMatrix: () => ({}), isTaskReadOnlyFor: () => false }));
import TaskManagement from '../TaskManagement';

const me: any = { id: 'u1', name: 'Long', role: 'staff' };
const today = new Date(); const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const tasks: any[] = [
  { id: 'T1', name: 'Việc đến hạn', projectId: '', assigneeId: 'u1', assignerId: 'boss', status: 'doing', deadline: ymd(today), completionRate: 10, missions: [] },
  { id: 'T2', name: 'Việc mới', projectId: '', assigneeId: 'u1', assignerId: 'boss', status: 'todo', deadline: '', completionRate: 0, missions: [], workLogs: [] },
];
const mount = (onUpdateTask = vi.fn()) => render(<TaskManagement tasks={tasks} projects={[]} employees={[me]} currentUser={me} onAddTask={vi.fn()} onUpdateTask={onUpdateTask} />);
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

describe('Việc của tôi — chỉ còn kiểu Tổng quan', () => {
  it('luôn hiện Tổng quan; không còn công tắc Cột (Kanban) và các tab cũ', () => {
    mount();
    expect(screen.getByTestId('mywork-overview')).toBeTruthy();
    expect(screen.queryByTestId('mytasks-view-switch')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cột (Kanban)' })).toBeNull();
    expect(screen.queryByText('Công việc được giao')).toBeNull();
  });
  it('người từng chọn Kanban (đã lưu trong trình duyệt) vẫn vào Tổng quan', () => {
    localStorage.setItem('hl_my_tasks_view_u1', 'kanban');
    mount();
    expect(screen.getByTestId('mywork-overview')).toBeTruthy();
  });
  it('Tổng quan: "Nhận việc" chuyển công việc sang Đang làm đúng như kiểu Cột (nhật ký + 20%)', () => {
    const onUpdateTask = vi.fn();
    mount(onUpdateTask);
    fireEvent.click(within(screen.getByTestId('mywork-waiting')).getByTestId('mywork-receive'));
    expect(onUpdateTask).toHaveBeenCalledTimes(1);
    const [id, upd] = onUpdateTask.mock.calls[0];
    expect(id).toBe('T2');
    expect(upd).toMatchObject({ status: 'doing', completionRate: 20 });
    expect(upd.workLogs[0]).toMatchObject({ action: 'Nhận Việc', actorId: 'u1' });
  });
  it('Tổng quan: bấm một việc mở chi tiết công việc đó', async () => {
    mount();
    fireEvent.click(within(screen.getByTestId('mywork-all')).getByText('Việc đến hạn'));
    await waitFor(() => expect(screen.getByTestId('task-detail').textContent).toBe('T1'));
  });
});
