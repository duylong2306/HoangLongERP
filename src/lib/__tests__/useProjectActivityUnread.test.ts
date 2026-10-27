// Huy hiệu menu Tin nhắn / chuông cộng thêm số dự án có hoạt động nhật ký mới (mỗi dự án tính 1).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

const S: { summary: Record<string, any>; calls: string[][] } = { summary: {}, calls: [] };
vi.mock('../projectEventReads', async (orig) => ({
  ...(await orig<typeof import('../projectEventReads')>()),
  loadUnreadSummary: vi.fn(async (_u: string, ids: string[]) => { S.calls.push(ids); return S.summary; }),
}));
import { activityProjectKey, countProjectsWithNew, useProjectActivityUnread } from '../useProjectActivityUnread';

beforeEach(() => { S.summary = {}; S.calls = []; });

describe('activityProjectKey', () => {
  const convs = [
    { id: 'conv_project_B', projectId: 'B' }, { id: 'conv_project_A' }, { id: 'p_ny' },
    { id: 'conv_work_x', taskId: 'T1', projectId: 'A' }, { id: 'conv_project_M', projectId: 'M' },
  ];
  it('gom mã dự án từ nhóm chat dự án, sắp xếp, bỏ hội thoại cá nhân và nhóm công việc', () => {
    expect(activityProjectKey(convs, [])).toBe('A,B,M');
  });
  it('bỏ nhóm đã tắt thông báo (nhất quán với số tin chưa đọc)', () => {
    expect(activityProjectKey(convs, ['conv_project_M'])).toBe('A,B');
  });
  it('không có nhóm dự án → chuỗi rỗng', () => {
    expect(activityProjectKey([{ id: 'p_ny' }], [])).toBe('');
  });
});

describe('countProjectsWithNew', () => {
  it('mỗi dự án có hoạt động mới tính 1, không cộng theo số hoạt động', () => {
    expect(countProjectsWithNew({ A: { count: 25, latest: [] }, B: { count: 1, latest: [] }, C: { count: 0, latest: [] } })).toBe(2);
    expect(countProjectsWithNew({})).toBe(0);
  });
});

describe('useProjectActivityUnread', () => {
  it('trả về số dự án có hoạt động mới', async () => {
    S.summary = { A: { count: 7, latest: [] }, B: { count: 2, latest: [] } };
    const { result } = renderHook(() => useProjectActivityUnread('u1', 'A,B,C'));
    await waitFor(() => expect(result.current).toBe(2));
    expect(S.calls[0]).toEqual(['A', 'B', 'C']);
  });
  it('không có người dùng hoặc không có dự án → 0 và không gọi máy chủ', () => {
    const a = renderHook(() => useProjectActivityUnread(undefined, 'A'));
    const b = renderHook(() => useProjectActivityUnread('u1', ''));
    expect(a.result.current).toBe(0); expect(b.result.current).toBe(0);
    expect(S.calls.length).toBe(0);
  });
  it('tải lại khi vừa đánh dấu đã xem nhật ký (sự kiện hl-project-seen)', async () => {
    S.summary = { A: { count: 3, latest: [] } };
    const { result } = renderHook(() => useProjectActivityUnread('u1', 'A'));
    await waitFor(() => expect(result.current).toBe(1));
    S.summary = {};   // đã xem hết
    act(() => { window.dispatchEvent(new CustomEvent('hl-project-seen', { detail: { projectId: 'A' } })); });
    await waitFor(() => expect(result.current).toBe(0));
  });
});

describe('điểm nối trong App.tsx', () => {
  const app = fs.readFileSync(path.resolve(__dirname, '../../App.tsx'), 'utf8');
  it('huy hiệu menu Tin nhắn và chuông = tin chưa đọc + số dự án có hoạt động mới', () => {
    expect(app).toMatch(/useProjectActivityUnread\(/);
    expect(app).toMatch(/const chatUnreadForNav = [\s\S]*?\+ activityUnreadForNav;/);
    // cả menu (badge: chatUnreadForNav) lẫn chuông đều dùng chung biến này
    expect(app).toMatch(/badge: chatUnreadForNav/);
    expect(app).toMatch(/showBadgeCounts && chatUnreadForNav > 0/);
  });
});
