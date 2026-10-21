import { describe, it, expect } from 'vitest';
import {
  buildMyWorkItems, groupByBucket, focusItems, weekStrip, awaitingReceive, assignedByMe, countByProject, bucketOf,
  readPins, writePins, pinsStorageKey,
} from '../myWork';

const TODAY = '2026-10-16';
const task = (id: string, o: any = {}) => ({ id, name: `CV ${id}`, projectId: 'P1', assigneeId: 'u1', assignerId: 'boss', status: 'doing', deadline: '2026-10-20', completionRate: 40, missions: [], ...o }) as any;
const opts = { userId: 'u1', userName: 'An', projectName: (id?: string) => (id === 'P1' ? 'Công trình 1' : '') };

describe('buildMyWorkItems', () => {
  it('lấy công việc được giao (theo id hoặc tên), bỏ việc đã hoàn thành và việc của người khác', () => {
    const items = buildMyWorkItems([task('a'), task('b', { assigneeId: 'An' }), task('c', { status: 'completed' }), task('d', { assigneeId: 'u2' })], opts);
    expect(items.map(i => i.key)).toEqual(['task:a', 'task:b']);
  });
  it('nhiệm vụ: phụ trách chính hoặc tham gia, bỏ đã hoàn thành; hạn trống thì lấy hạn công việc', () => {
    const t = task('a', { assigneeId: 'u9', deadline: '2026-10-25', missions: [
      { id: 'm1', name: 'NV chính', status: 'todo', mainAssigneeId: 'u1', memberIds: [] },
      { id: 'm2', name: 'NV tham gia', status: 'doing', mainAssigneeId: 'u9', memberIds: ['u1'], deadline: '2026-10-17' },
      { id: 'm3', name: 'NV xong', status: 'completed', mainAssigneeId: 'u1', memberIds: [] },
      { id: 'm4', name: 'NV người khác', status: 'doing', mainAssigneeId: 'u9', memberIds: ['u2'] },
    ] });
    const items = buildMyWorkItems([t], opts).filter(i => i.kind === 'mission');
    expect(items.map(i => i.title)).toEqual(['NV chính', 'NV tham gia']);
    expect(items[0].due).toBe('2026-10-25');
    expect(items[1].due).toBe('2026-10-17');
    // phụ trách chính của nhiệm vụ cũng làm cho công việc hiện trong "việc của tôi" (như tab Công việc được giao)
    expect(buildMyWorkItems([t], opts).some(i => i.kind === 'task')).toBe(true);
  });
  it('quyền Nhận việc: công việc theo ma trận quyền, nhiệm vụ chỉ phụ trách chính khi chưa làm', () => {
    const t = task('a', { status: 'todo', missions: [{ id: 'm1', name: 'x', status: 'todo', mainAssigneeId: 'u1', memberIds: [] }, { id: 'm2', name: 'y', status: 'todo', mainAssigneeId: 'u9', memberIds: ['u1'] }] });
    const ok = buildMyWorkItems([t], { ...opts, canReceiveTask: () => true });
    expect(ok.find(i => i.key === 'task:a')!.canReceive).toBe(true);
    expect(ok.find(i => i.key === 'mis:a:m1')!.canReceive).toBe(true);
    expect(ok.find(i => i.key === 'mis:a:m2')!.canReceive).toBe(false);   // chỉ tham gia → không nhận được
    expect(buildMyWorkItems([t], { ...opts, canReceiveTask: () => false }).find(i => i.key === 'task:a')!.canReceive).toBe(false);
    expect(buildMyWorkItems([task('b', { status: 'doing' })], { ...opts, canReceiveTask: () => true })[0].canReceive).toBe(false);   // đã làm rồi
  });
});

describe('mốc thời gian', () => {
  it('bucketOf', () => {
    expect(bucketOf('', TODAY)).toBe('none');
    expect(bucketOf('2026-10-15', TODAY)).toBe('late');
    expect(bucketOf('2026-10-16', TODAY)).toBe('today');
    expect(bucketOf('2026-10-17', TODAY)).toBe('week');
    expect(bucketOf('2026-10-23', TODAY)).toBe('week');
    expect(bucketOf('2026-10-24', TODAY)).toBe('later');
  });
  const items = buildMyWorkItems([task('a', { deadline: '2026-10-10' }), task('b', { deadline: '2026-10-16' }), task('c', { deadline: '2026-10-18' }), task('d', { deadline: '2026-12-01' }), task('e', { deadline: '' })], opts);
  it('groupByBucket chia đúng nhóm', () => {
    const g = groupByBucket(items, TODAY);
    expect([g.late.length, g.today.length, g.week.length, g.later.length, g.none.length]).toEqual([1, 1, 1, 1, 1]);
  });
  it('focusItems: ghim trước, rồi quá hạn, rồi hôm nay; không trùng', () => {
    expect(focusItems(items, TODAY, []).map(i => i.key)).toEqual(['task:a', 'task:b']);
    expect(focusItems(items, TODAY, ['task:d', 'task:a']).map(i => i.key)).toEqual(['task:a', 'task:d', 'task:b']);   // thứ tự gốc của danh sách cho nhóm ghim; a không bị lặp
  });
  it('weekStrip: 7 ngày từ hôm nay, đếm việc đến hạn mỗi ngày', () => {
    const w = weekStrip(items, TODAY);
    expect(w).toHaveLength(7);
    expect(w[0]).toMatchObject({ day: TODAY, isToday: true, count: 1 });
    expect(w[2]).toMatchObject({ day: '2026-10-18', count: 1 });
    expect(w[1].count).toBe(0);
  });
  it('awaitingReceive: việc chưa làm', () => {
    expect(awaitingReceive(buildMyWorkItems([task('a', { status: 'todo' }), task('b')], opts)).map(i => i.key)).toEqual(['task:a']);
  });
});

describe('Tôi giao & theo công trình', () => {
  it('assignedByMe: tôi là người giao, người nhận khác tôi, chưa hoàn thành, sắp theo hạn', () => {
    const r = assignedByMe([
      task('a', { assignerId: 'u1', assigneeId: 'u2', deadline: '2026-10-30' }), task('b', { assignerId: 'An', assigneeId: 'u3', deadline: '2026-10-20' }),
      task('c', { assignerId: 'u1', assigneeId: 'u1' }), task('d', { assignerId: 'u1', assigneeId: 'u2', status: 'completed' }), task('e', { assignerId: 'x', assigneeId: 'u2' }),
    ], { userId: 'u1', userName: 'An', projectName: () => 'P', employeeName: id => `NV ${id}` });
    expect(r.map(x => x.taskId)).toEqual(['b', 'a']);
    expect(r[0].assigneeName).toBe('NV u3');
  });
  it('countByProject: nhiều → ít; không công trình → Nhiệm vụ nội bộ', () => {
    const it = buildMyWorkItems([task('a'), task('b'), task('c', { projectId: '' })], opts);
    expect(countByProject(it)).toEqual([{ project: 'Công trình 1', count: 2 }, { project: 'Nhiệm vụ nội bộ', count: 1 }]);
  });
});

describe('lưu việc ghim', () => {
  const mem = () => { const m: Record<string, string> = {}; return { getItem: (k: string) => (k in m ? m[k] : null), setItem: (k: string, v: string) => { m[k] = v; } }; };
  it('ghim: chỉ hiệu lực trong ngày, sang ngày khác tự làm mới', () => {
    const s = mem(); const k = pinsStorageKey('u1');
    writePins(k, TODAY, ['task:a'], s);
    expect(readPins(k, TODAY, s)).toEqual(['task:a']);
    expect(readPins(k, '2026-10-17', s)).toEqual([]);
    s.setItem(k, '{hỏng'); expect(readPins(k, TODAY, s)).toEqual([]);
  });
});

describe('nhiệm vụ & việc đã hoàn thành (ngang kiểu Cột)', () => {
  const t = task('a', { assigneeId: 'u9', missions: [
    { id: 'm1', name: 'NV chính', status: 'doing', mainAssigneeId: 'u1', memberIds: ['u2', 'u3'] },
    { id: 'm2', name: 'NV tham gia', status: 'todo', mainAssigneeId: 'u9', memberIds: ['u1'] },
    { id: 'm3', name: 'NV xong', status: 'completed', mainAssigneeId: 'u1', memberIds: [], completedAt: '2026-10-14T09:00:00' },
  ] });
  it('mặc định không có việc đã hoàn thành; includeCompleted thì có kèm ngày hoàn thành', () => {
    expect(buildMyWorkItems([t], opts).some(i => i.status === 'completed')).toBe(false);
    const all = buildMyWorkItems([t], { ...opts, includeCompleted: true });
    const done = all.find(i => i.key === 'mis:a:m3')!;
    expect(done.status).toBe('completed');
    expect(done.doneDay).toBe('2026-10-14');
  });
  it('vai trò và số người tham gia của nhiệm vụ', () => {
    const all = buildMyWorkItems([t], { ...opts, includeCompleted: true });
    expect(all.find(i => i.key === 'mis:a:m1')).toMatchObject({ role: 'lead', memberCount: 2 });
    expect(all.find(i => i.key === 'mis:a:m2')).toMatchObject({ role: 'member', memberCount: 0 });
  });
  it('công việc đã hoàn thành của tôi cũng có khi includeCompleted', () => {
    const d = task('d', { status: 'completed', completedDate: '2026-10-10' });
    expect(buildMyWorkItems([d], opts)).toEqual([]);
    expect(buildMyWorkItems([d], { ...opts, includeCompleted: true })[0]).toMatchObject({ key: 'task:d', status: 'completed', doneDay: '2026-10-10' });
  });
});
