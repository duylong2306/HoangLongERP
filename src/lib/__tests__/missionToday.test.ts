import { describe, it, expect } from 'vitest';
import { buildMissionRows, inMissionView, sortMissions } from '../missionToday';

const TODAY = '2026-10-16';
const task = (id: string, deadline: string, missions: any[], extra: any = {}) => ({ id, name: `CV ${id}`, projectId: 'P1', deadline, status: 'doing', missions, ...extra }) as any;
const m = (id: string, status: string, extra: any = {}) => ({ id, name: `NV ${id}`, status, memberIds: [], ...extra });

describe('nhiệm vụ toàn doanh nghiệp', () => {
  const rows = buildMissionRows([
    task('T1', '2026-10-20', [
      m('a', 'doing'),                                        // đang làm, hạn công việc còn xa → hôm nay
      m('b', 'todo', { deadline: '2026-10-16' }),             // chưa làm nhưng đến hạn hôm nay → hôm nay
      m('c', 'todo'),                                         // chưa làm, hạn xa → chỉ ở "Chưa làm"
      m('d', 'doing', { deadline: '2026-10-14' }),            // đang làm nhưng quá hạn 2 ngày → "Quá hạn" (không lẫn vào hôm nay)
      m('e', 'completed', { completedAt: '2026-10-16T08:00:00', deadline: '2026-10-10' }),   // xong hôm nay (dù hạn cũ) → không quá hạn
      m('f', 'completed', { completedAt: '2026-10-12T08:00:00' }),
    ]),
    task('T2', '', [m('g', 'doing')]),                        // không có hạn, đang làm → hôm nay
  ], TODAY);
  const ids = (v: any) => rows.filter(r => inMissionView(r, v, TODAY)).map(r => r.id.split('::')[1]).sort();

  it('Hôm nay = đang làm hoặc đến hạn hôm nay, chưa quá hạn, chưa hoàn thành', () => expect(ids('today')).toEqual(['a', 'b', 'g']));
  it('Quá hạn = chưa xong và hạn đã qua', () => { expect(ids('overdue')).toEqual(['d']); expect(rows.find(r => r.id.endsWith('::d'))!.daysLate).toBe(2); });
  it('Chưa làm gồm cả việc chưa làm đến hạn hôm nay, không gồm việc đã quá hạn', () => expect(ids('todo')).toEqual(['b', 'c']));
  it('Hoàn thành hôm nay', () => expect(ids('doneToday')).toEqual(['e']));
  it('Tất cả', () => expect(ids('all')).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']));
  it('hạn nhiệm vụ trống thì thừa hưởng hạn công việc', () => expect(rows.find(r => r.id.endsWith('::a'))!.deadline).toBe('2026-10-20'));
  it('nhiệm vụ đã hoàn thành không bao giờ bị tính quá hạn', () => expect(rows.find(r => r.id.endsWith('::e'))!.daysLate).toBe(0));
  it('công việc không có nhiệm vụ → không sinh dòng; trạng thái lạ coi là chưa làm', () => {
    expect(buildMissionRows([task('T9', '', [])], TODAY)).toEqual([]);
    expect(buildMissionRows([task('T9', '', [m('x', 'weird')])], TODAY)[0].status).toBe('todo');
  });
  it('sắp xếp: trễ nhiều nhất lên đầu', () => {
    const s = sortMissions(rows.filter(r => inMissionView(r, 'all', TODAY)));
    expect(s[0].id.endsWith('::d')).toBe(true);
  });
});
