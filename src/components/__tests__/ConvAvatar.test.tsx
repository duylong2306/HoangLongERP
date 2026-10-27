import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConvAvatar, { convKind, isAvatarImage } from '../ConvAvatar';

// Ảnh đại diện hội thoại: cá nhân TRÒN, nhóm VUÔNG BO GÓC ghép ô, công trình/công việc có biểu tượng + số thành viên.
const emps: any[] = ['A Một', 'B Hai', 'C Ba', 'D Bốn', 'E Năm', 'F Sáu'].map((n, i) => ({ id: 'e' + i, name: n }));
const conv = (o: any) => ({ id: 'x', type: 'group', name: 'N', avatar: '', color: '', createdBy: 'e0', createdAt: '', unreadCount: 0, participantIds: ['e0'], ...o });
const tiles = (c: any) => { render(<ConvAvatar conv={c} employees={emps} me="e0" size={48} />); return screen.getByTestId(/conv-avatar-/).querySelectorAll('i'); };

describe('ảnh riêng của nhóm', () => {
  it('isAvatarImage: đường dẫn / data ảnh mới là ảnh; chữ viết tắt cũ ("K.") hoặc rỗng thì không', () => {
    expect(isAvatarImage('https://kho/a.jpg')).toBe(true); expect(isAvatarImage('data:image/png;base64,AA')).toBe(true);
    expect(isAvatarImage('K.')).toBe(false); expect(isAvatarImage('')).toBe(false); expect(isAvatarImage(undefined)).toBe(false);
  });
  it('nhóm thường / công trình / công việc có ảnh riêng → hiện ảnh thay cho ô ghép / biểu tượng', () => {
    for (const o of [{}, { id: 'conv_project_1' }, { type: 'task' }]) {
      const { unmount } = render(<ConvAvatar conv={conv({ ...o, avatar: 'https://kho/a.jpg', participantIds: ['e0', 'e1'] }) as any} employees={emps} me="e0" size={48} />);
      expect(screen.getByTestId('conv-avatar-img').getAttribute('src')).toBe('https://kho/a.jpg');
      expect(document.querySelectorAll('i')).toHaveLength(0);   // không còn ô chữ cái / biểu tượng
      unmount();
    }
  });
  it('công trình có ảnh riêng vẫn giữ huy hiệu số thành viên', () => {
    render(<ConvAvatar conv={conv({ id: 'conv_project_1', avatar: 'https://kho/a.jpg', participantIds: ['e0', 'e1', 'e2'] }) as any} employees={emps} me="e0" size={48} />);
    expect(screen.getByTestId('conv-count').textContent).toBe('3');
  });
  it('hội thoại cá nhân không bao giờ dùng ảnh nhóm', () => {
    render(<ConvAvatar conv={conv({ type: 'personal', avatar: 'https://kho/a.jpg', participantIds: ['e0', 'e1'] }) as any} employees={emps} me="e0" size={48} />);
    expect(screen.queryByTestId('conv-avatar-img')).toBeNull();
  });
});

describe('ConvAvatar', () => {
  it('phân loại hội thoại', () => {
    expect(convKind(conv({ type: 'personal' }))).toBe('personal');
    expect(convKind(conv({ id: 'conv_project_9' }))).toBe('project');
    expect(convKind(conv({ projectId: 'P' }))).toBe('project');
    expect(convKind(conv({ type: 'task' }))).toBe('task');
    expect(convKind(conv({}))).toBe('group');
  });
  it('nhóm ghép đúng số ô: 1, 2, 3, 4', () => {
    expect(tiles(conv({ participantIds: ['e0'] }))).toHaveLength(1);
  });
  it('2 thành viên → 2 ô; 3 → 3 ô; 4 → 4 ô', () => {
    expect(tiles(conv({ participantIds: ['e0', 'e1'] }))).toHaveLength(2);
  });
  it('đông hơn 4 người → ô thứ 4 hiện "+n" (n = số người còn lại), không có huy hiệu che', () => {
    const t = tiles(conv({ participantIds: ['e0', 'e1', 'e2', 'e3', 'e4', 'e5'] }));
    expect(t).toHaveLength(4); expect(t[3].textContent).toBe('+3');
    expect(screen.queryByTestId('conv-count')).toBeNull();
  });
  it('công trình: biểu tượng + số thành viên; không ghép chữ cái', () => {
    render(<ConvAvatar conv={conv({ id: 'conv_project_1', participantIds: ['e0', 'e1', 'e2'] })} employees={emps} me="e0" size={48} />);
    expect(screen.getByTestId('conv-avatar-project')).toBeTruthy(); expect(screen.getByTestId('conv-count').textContent).toBe('3');
  });
  it('cá nhân: không dùng khung vuông của nhóm', () => {
    render(<ConvAvatar conv={conv({ type: 'personal', participantIds: ['e0', 'e1'] })} employees={emps} me="e0" size={48} />);
    expect(screen.queryByTestId(/conv-avatar-/)).toBeNull();
  });
});
