import { describe, it, expect } from 'vitest';
import { workThreadId, isWorkThreadId, uniqueMembers } from '../workThread';
import { unreadForBadge } from '../chatPrefs';
import { filterConversations } from '../chatInfo';
import { getUserConversations } from '../chatStore';
import { buildWorkInbox } from '../workInbox';

describe('luồng thảo luận Việc của tôi', () => {
  it('mã xác định theo khóa mục, ký tự an toàn, nhận diện được', () => {
    expect(workThreadId('mis:T1:M2')).toBe('conv_work_mis_T1_M2');
    expect(workThreadId('task:abc')).toBe(workThreadId('task:abc'));
    expect(isWorkThreadId('conv_work_x')).toBe(true); expect(isWorkThreadId('conv_project_x')).toBe(false);
    expect(uniqueMembers(['a', undefined, 'a', '', 'b'])).toEqual(['a', 'b']);
  });
  it('không tính vào huy hiệu Tin nhắn, danh sách Tin nhắn thường, và getUserConversations', () => {
    const convs: any[] = [
      { id: 'p1', type: 'personal', name: 'A', participantIds: ['me', 'a'], createdAt: '1', unreadCount: 1 },
      { id: 'conv_work_task_x', type: 'group', name: '💬 x', participantIds: ['me'], createdAt: '2', unreadCount: 9 },
    ];
    expect(unreadForBadge(convs, { muted: [], pinned: [] })).toBe(1);
    expect(filterConversations(convs, { userId: 'me', tab: 'all', category: 'all', query: '', prefs: { muted: [], pinned: [] } }).map(c => c.id)).toEqual(['p1']);
    expect(getUserConversations(convs, 'me').map(c => c.id)).toEqual(['p1']);
  });
  it('buildWorkInbox: chỉ nhận mã nhân viên thật làm người thảo luận; nút mở đúng nơi', () => {
    const calls: string[] = [];
    const inbox = buildWorkInbox({
      employeeIds: new Set(['ny']), reviewingTasks: [], leaves: [], travel: [], materialToApprove: [], materialToCoordinate: [],
      payments: [{ id: 'P1', recipient: 'X', amount: 5, proposerId: 'ny' }],
      advances: [{ id: 'A1', reason: 'r', amount: 7, creator: 'Kế Toán' }],     // "Kế Toán" không phải mã nhân viên → bỏ
      vouchers: [{ id: 'V1', reason: 'v', amount: 9, creator: 'ny' }],
      open: { task: () => {}, finance: id => calls.push('fin:' + id), material: () => {}, myWork: () => calls.push('my') },
    });
    expect(inbox.map(i => i.key)).toEqual(['pm:P1', 'ad:A1', 'vc:V1']);
    expect(inbox[0].memberIds).toEqual(['ny']); expect(inbox[1].memberIds).toEqual([]);
    inbox[2].actions[0].onClick(); inbox[0].actions[0].onClick();
    expect(calls).toEqual(['fin:V1', 'my']);
  });
});
