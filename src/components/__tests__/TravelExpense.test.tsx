import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';

// --- Mock heavy sub-components & external modules ---
vi.mock('../QuotationTableSheet', () => ({ default: () => null }));
vi.mock('../ConnectedToolsModal', () => ({ default: () => null }));
vi.mock('../MissionConfigEditor', () => ({ default: () => null }));
vi.mock('../SearchableEmployeeSelect', () => ({ default: () => null }));

const chatMock = vi.hoisted(() => ({
  sendGroupChatMessage: vi.fn().mockResolvedValue(null),
  sendApprovalDirectMessage: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../lib/chatStore', () => chatMock);
vi.mock('./hr/hrTaskPermissions', () => ({
  canDoTaskAction: () => true,
  loadTaskPermissionMatrix: vi.fn(),
  getTaskRoleScope: () => ({ view: true, create: true, edit: true, delete: true }),
}));
vi.mock('../../context', () => ({
  useNotification: () => ({ addToast: vi.fn() }),
  isUserInRoleGroup: () => true,
  useSettings: () => ({ settings: {} }),
  getAccentClasses: () => '',
  getConfiguredApprover: () => null, // chưa cấu hình người duyệt CTP → không gửi tin cá nhân
}));

const hrmTravelExpensesSave = vi.fn().mockResolvedValue(undefined);
const tasksSave = vi.fn().mockResolvedValue(undefined);

const storedTasks: any[] = [];

vi.mock('../../lib/dbService', () => {
  const makeTable = (extra: Record<string, any> = {}) => ({
    list: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    deleteMultiple: vi.fn().mockResolvedValue(undefined),
    ...extra,
  });
  const target: any = {
    tasks: {
      list: vi.fn().mockImplementation(() => Promise.resolve(JSON.parse(JSON.stringify(storedTasks)))),
      save: vi.fn().mockImplementation((task: any) => {
        const i = storedTasks.findIndex(t => t.id === task.id);
        if (i >= 0) storedTasks[i] = JSON.parse(JSON.stringify(task));
        else storedTasks.push(JSON.parse(JSON.stringify(task)));
        return Promise.resolve();
      }),
      delete: vi.fn().mockResolvedValue(undefined),
      deleteMultiple: vi.fn().mockResolvedValue(undefined),
    },
    hrmTravelExpenses: { ...makeTable(), save: (...a: any[]) => hrmTravelExpensesSave(...a) },
    uploadMissionReportImage: vi.fn().mockResolvedValue({ url: 'http://img', stored: 'local' }),
  };
  return {
    dbService: new Proxy(target, {
      get(t: any, prop: string) {
        if (prop in t) return t[prop];
        const tbl = makeTable();
        t[prop] = tbl;
        return tbl;
      },
    }),
  };
});

import TaskDetailModal from '../TaskDetailModal';
import { dbService } from '../../lib/dbService';

const admin = { id: 'emp_admin', name: 'Admin', role: 'director', roleGroupIds: [] as string[] } as any;
const emp1 = { id: 'emp1', name: 'Thợ A', role: 'worker', roleGroupIds: [] as string[] } as any;

// Wrapper that mimics App.handleUpdateTask INCLUDING the side-effect-in-updater
// (dbService.tasks.save + dispatch hl-tasks-updated → reload listeners → setTasks(dbData))
function Wrapper({ initialTask, onTasksChange }: { initialTask: any; onTasksChange?: (t: any) => void }) {
  const [tasks, setTasks] = useState<any[]>([initialTask]);
  // seed the mock "Supabase" store
  if (storedTasks.length === 0) storedTasks.push(JSON.parse(JSON.stringify(initialTask)));

  const onUpdateTask = (id: string, updates: any) => {
    setTasks(prev => {
      const oldTask = prev.find(t => t.id === id);
      const changedTask = { ...oldTask, ...updates };
      dbService.tasks.save(changedTask).then(() => {
        // simulate hl-tasks-updated listeners: list() then setTasks(dbData)
        dbService.tasks.list().then((dbData: any[]) => setTasks(dbData));
      });
      const next = prev.map(t => (t.id === id ? changedTask : t));
      onTasksChange?.(next);
      return next;
    });
    // Nếu cấu hình trả false (save fail), trả Promise<false> để modal chặn hoàn thành.
    if ((Wrapper as any).__failSave) return Promise.resolve(false);
    return undefined;
  };
  return (
    <TaskDetailModal
      taskId={initialTask.id}
      onClose={vi.fn()}
      tasks={tasks}
      projects={[{ id: 'proj1', name: 'Dự án test', customerId: 'cust1' }] as any}
      customers={[{ id: 'cust1', name: 'Khách lẻ' }] as any}
      employees={[admin, emp1]}
      currentUser={admin}
      onUpdateTask={onUpdateTask}
    />
  );
}

function makeTask() {
  return {
    id: 'task_child_1',
    code: 'CV1',
    name: 'Công việc con test',
    projectId: 'proj1',
    status: 'doing',
    assigneeId: 'emp_admin',
    missions: [
      {
        id: 'mission_1',
        name: 'Nhiệm vụ thi công A',
        memberIds: ['emp1'],
        status: 'todo',
        workReports: '',
        evidence: '',
      },
    ],
  } as any;
}

beforeEach(() => {
  hrmTravelExpensesSave.mockClear();
  tasksSave.mockClear();
  localStorage.setItem('hl_acc_travel_norms', JSON.stringify([
    { id: 'norm1', code: 'CTP01', content: 'Đi công tác Hà Nội', quantity: 1, unitPrice: 200000, notes: '' },
  ]));
});

describe('Travel Expense persistence', () => {
  it('saves travel allowance to Supabase hrm_travel_expenses on complete', async () => {
    const onTasksChange = vi.fn();
    const task = makeTask();
    render(<Wrapper initialTask={task} onTasksChange={onTasksChange} />);

    // Open mission detail popup
    fireEvent.click(screen.getByText('Nhiệm vụ thi công A'));

    // Select a travel norm
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const normCombo = selects.find(s => Array.from(s.options).some(o => o.value === 'norm1'));
    expect(normCombo).toBeTruthy();
    fireEvent.change(normCombo!, { target: { value: 'norm1' } });

    // Click add CTP
    const addBtn = screen.getByTitle('Thêm công tác phí');
    fireEvent.click(addBtn);

    // After add: the mission should have travelAllowances in tasks state
    await waitFor(() => {
      const last = onTasksChange.mock.calls.at(-1)?.[0];
      const m = last?.[0]?.missions?.find((x: any) => x.id === 'mission_1');
      expect(m?.travelAllowances?.length).toBe(1);
    });

    // Now complete: fill work report (>=10 chars) and upload an image
    const report = screen.getByPlaceholderText(/Mô tả chi tiết/i) as HTMLTextAreaElement;
    fireEvent.change(report, { target: { value: 'Đã hoàn thành nhiệm vụ thi công đạt chất lượng.' } });

    // trigger image upload via file input
    const fileInputs = Array.from(document.querySelectorAll('input[type=file]')) as HTMLInputElement[];
    const fileInput = fileInputs.find(f => (f.getAttribute('accept') || '').includes('image')) || fileInputs[0];
    expect(fileInput).toBeTruthy();
    const file = new File([new Uint8Array([1])], 'r.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText(/Đã có 1 ảnh/)).toBeTruthy(), { timeout: 3000 });

    // Click complete
    const completeBtn = screen.getByText('Xác Nhận Hoàn Thành');
    fireEvent.click(completeBtn);

    // hrmTravelExpenses.save should have been called
    await waitFor(() => expect(hrmTravelExpensesSave).toHaveBeenCalled(), { timeout: 3000 });
    const callArg = hrmTravelExpensesSave.mock.calls[0][0];
    expect(callArg.employeeName).toBeTruthy();
    expect(callArg.amount).toBe(200000);

    cleanup();
  });

  it('blocks "Hoàn thành công việc" when a mission is still incomplete', async () => {
    const onTasksChange = vi.fn();
    const task = makeTask(); // mission_1 status = 'todo'
    render(<Wrapper initialTask={task} onTasksChange={onTasksChange} />);

    // Status doing → the footer shows "Hoàn thành công việc" button
    fireEvent.click(screen.getByText('Hoàn thành công việc'));

    // Should NOT mark task as completed (no status update to completed)
    await waitFor(() => {
      const last = onTasksChange.mock.calls.at(-1)?.[0];
      expect(last?.[0]?.status).not.toBe('completed');
    });
    // And no group chat message should be sent for completing the work
    expect(chatMock.sendGroupChatMessage).not.toHaveBeenCalled();

    cleanup();
  });

  it('does not complete mission nor send group chat when task save fails', async () => {
    (Wrapper as any).__failSave = true;
    try {
      const task = makeTask(); // mission_1 status = 'todo'
      render(<Wrapper initialTask={task} />);

      // Open mission detail popup
      fireEvent.click(screen.getByText('Nhiệm vụ thi công A'));

      // Fill report + image (required to enable the button)
      const report = screen.getByPlaceholderText(/Mô tả chi tiết/i) as HTMLTextAreaElement;
      fireEvent.change(report, { target: { value: 'Đã hoàn thành nhiệm vụ thi công đạt chất lượng.' } });

      const fileInputs = Array.from(document.querySelectorAll('input[type=file]')) as HTMLInputElement[];
      const fileInput = fileInputs.find(f => (f.getAttribute('accept') || '').includes('image')) || fileInputs[0];
      fireEvent.change(fileInput, { target: { files: [new File([new Uint8Array([1])], 'r.jpg', { type: 'image/jpeg' })] } });
      await waitFor(() => expect(screen.getByText(/Đã có 1 ảnh/)).toBeTruthy(), { timeout: 3000 });

      // Click complete — save fails → mission NOT completed, no group chat
      fireEvent.click(screen.getByText('Xác Nhận Hoàn Thành'));

      await waitFor(() => expect(chatMock.sendGroupChatMessage).not.toHaveBeenCalled());
      expect(hrmTravelExpensesSave).not.toHaveBeenCalled();
    } finally {
      (Wrapper as any).__failSave = false;
    }

    cleanup();
  });
});
