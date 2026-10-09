import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HelpTip from '../ui/HelpTip';
import { actionGroups } from '../hr/tabs/ProjectPermissionModal';
import { TASK_ACTION_LABELS } from '../hr/tabs/TaskPermissionEditor';
import { PROJECT_ACTION_HELP, TASK_ACTION_HELP, APPROVAL_DOC_HELP, moduleHelp } from '../../lib/permissionHelp';

describe('HelpTip — dấu ? giải thích dòng phân quyền', () => {
  it('rê chuột vào → hiện lời giải thích; rời chuột → ẩn', () => {
    render(<HelpTip text="Giải thích thử" label="Dòng thử" />);
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.mouseEnter(screen.getByTestId('help-tip'));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Giải thích thử');
    fireEvent.mouseLeave(screen.getByTestId('help-tip'));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
  it('chạm (bấm) → bật; chạm lại → tắt; Esc đóng', () => {
    render(<HelpTip text="Nội dung" />);
    const nut = screen.getByTestId('help-tip');
    fireEvent.click(nut);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.click(nut);
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.click(nut);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
  it('chạm ra ngoài → đóng', () => {
    render(<div><HelpTip text="Nội dung" /><span data-testid="ngoai">x</span></div>);
    fireEvent.click(screen.getByTestId('help-tip'));
    fireEvent.mouseDown(screen.getByTestId('ngoai'));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

describe('Bộ lời giải thích phủ đủ mọi dòng phân quyền', () => {
  it('mọi hành động ở Quyền Dự Án đều có giải thích', () => {
    for (const g of actionGroups) for (const a of g.actions) expect(PROJECT_ACTION_HELP[a.action], a.action).toBeTruthy();
  });
  it('mọi thao tác ở Quyền Công việc đều có giải thích', () => {
    // 5 thao tác đã gỡ khỏi bảng (không điều khiển nút nào) thì không cần giải thích
    const daGo = ['deleteTask', 'issuePenalty', 'settlePayment', 'manageDocs', 'assignSubWorkers'];
    for (const k of Object.keys(TASK_ACTION_LABELS).filter(x => !daGo.includes(x))) expect(TASK_ACTION_HELP[k], k).toBeTruthy();
  });
  it('mọi loại hồ sơ ở Quyền Phê Duyệt đều có giải thích', () => {
    for (const k of ['quotation', 'contract', 'acceptance', 'liquidation', 'material_coordinator', 'material_approver', 'leave', 'salary_advance', 'travel_expense', 'payroll', 'finance_expense_proposal', 'finance_advance_proposal']) expect(APPROVAL_DOC_HELP[k], k).toBeTruthy();
  });
  it('giải thích phân hệ: menu cha khác menu con', () => {
    expect(moduleHelp('Mô tả', true)).toContain('Menu cha');
    expect(moduleHelp('Mô tả', false)).toContain('Xem:');
  });
});
