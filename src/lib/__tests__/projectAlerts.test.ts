import { describe, it, expect } from 'vitest';
import { buildProjectHealth, stuckLimitOf, avgDaysInStage, DEFAULT_STUCK_DAYS } from '../projectAlerts';
import { getDefaultColumns } from '../kanbanLogic';

const cols = getDefaultColumns();   // 7 cột; "col_active" = thi công (index 3), "col_done" cuối
const P = (o: any = {}): any => ({ id: 'p1', type: 'construction', status: 'processing', kanbanColumnId: 'col_active', startDate: '', endDate: '', ...o });
const T = (status: string, projectId = 'p1') => ({ projectId, status }) as any;
const TODAY = '2026-10-28';
const entered = (iso: string) => new Map([['p1', iso]]);
const run = (p: any, tasks: any[] = [], e: Map<string, string> = new Map(), bySector: any = {}) => buildProjectHealth([p], tasks, bySector, e, TODAY).get(p.id)!;
const kinds = (h: any) => h.alerts.map((a: any) => a.kind);

describe('KẸT giai đoạn', () => {
  it('ở 1 cột quá 30 ngày (mặc định) → kẹt, nêu rõ số ngày và tên cột', () => {
    const h = run(P(), [], entered('2026-09-20T03:00:00Z'));   // 38 ngày
    expect(h.daysInStage).toBe(38);
    expect(kinds(h)).toEqual(['stuck']);
    expect(h.alerts[0].text).toContain('38 ngày'); expect(h.alerts[0].text).toContain('GIỚI ĐOẠN THI CÔNG');
  });
  it('chưa quá hạn mức → không cảnh báo; đúng bằng hạn mức cũng chưa kẹt', () => {
    expect(kinds(run(P(), [], entered('2026-10-20T03:00:00Z')))).toEqual([]);
    expect(kinds(run(P(), [], entered('2026-09-28T03:00:00Z')))).toEqual([]);   // đúng 30 ngày
  });
  it('chưa rõ ngày vào giai đoạn (nhật ký chưa có) → không đoán, không cảnh báo', () => {
    const h = run(P(), [], new Map());
    expect(h.daysInStage).toBeNull(); expect(kinds(h)).toEqual([]);
  });
  it('hạn mức riêng của cột; 0 = tắt cảnh báo', () => {
    const custom = (n: number) => ({ construction: cols.map(c => c.id === 'col_active' ? { ...c, automation: { ...c.automation!, stuckDays: n } } : c) });
    expect(kinds(run(P(), [], entered('2026-10-10T03:00:00Z'), custom(10)))).toEqual(['stuck']);   // 18 ngày > 10
    expect(kinds(run(P(), [], entered('2026-01-01T03:00:00Z'), custom(0)))).toEqual([]);
    expect(stuckLimitOf(undefined)).toBe(DEFAULT_STUCK_DAYS);
    expect(stuckLimitOf({ ...cols[0], automation: { type: 'none', stuckDays: 7 } })).toBe(7);
  });
  it('dự án tạm dừng / đã hoàn thành / ở cột cuối không bị coi là kẹt', () => {
    const old = entered('2026-01-01T03:00:00Z');
    expect(kinds(run(P({ status: 'paused' }), [], old))).toEqual([]);
    expect(kinds(run(P({ status: 'completed', kanbanColumnId: 'col_done' }), [], old))).toEqual([]);
  });
});

describe('LỆCH giai đoạn ↔ công việc', () => {
  it('dự án hoàn thành mà còn việc chưa xong', () => {
    const h = run(P({ status: 'completed' }), [T('completed'), T('doing'), T('todo')]);
    expect(kinds(h)).toEqual(['mismatch']); expect(h.alerts[0].text).toContain('2 việc');
  });
  it('xong hết việc con nhưng thẻ còn ở từ giữa hành trình trở đi (thi công, bước 4/7) → nhắc chuyển giai đoạn', () => {
    expect(kinds(run(P(), [T('completed'), T('completed')]))).toEqual(['mismatch']);
  });
  it('xong hết việc nhưng mới ở giai đoạn đầu (thiết kế) → không nhắc oan; còn việc dở → không lệch', () => {
    expect(kinds(run(P({ kanbanColumnId: 'col_design' }), [T('completed')]))).toEqual([]);
    expect(kinds(run(P(), [T('completed'), T('doing')]))).toEqual([]);
  });
});

describe('CHẬM so với kế hoạch', () => {
  const plan = { startDate: '2026-09-01', endDate: '2026-11-30' };   // 90 ngày; hôm nay 28/10 = ngày thứ 57 → kế hoạch ≈ 63%
  it('tiến độ thấp hơn kế hoạch quá 15 điểm → chậm', () => {
    const h = run(P({ ...plan, kanbanColumnId: 'col_bid' }), []);   // giai đoạn 2/6 → tiến độ ≈ 17%
    expect(kinds(h)).toContain('behind'); expect(h.alerts.find(a => a.kind === 'behind')!.text).toContain('kế hoạch 63%');
  });
  it('kịp kế hoạch, hoặc ngày kết thúc không phải ngày (vd "90 ngày"), hoặc đã quá hạn → không báo chậm', () => {
    expect(kinds(run(P({ ...plan, kanbanColumnId: 'col_fix' }), []))).not.toContain('behind');
    expect(kinds(run(P({ startDate: '2026-09-01', endDate: '90 ngày' }), []))).not.toContain('behind');
    expect(kinds(run(P({ startDate: '2026-01-01', endDate: '2026-02-01' }), []))).not.toContain('behind');
  });
});

describe('khác', () => {
  it('bỏ dự án đã hủy; trung bình ngày ở giai đoạn bỏ qua dự án chưa rõ ngày', () => {
    expect(buildProjectHealth([P({ status: 'cancelled' })], [], {}, new Map(), TODAY).size).toBe(0);
    const m = new Map([['a', { daysInStage: 10 }], ['b', { daysInStage: 20 }], ['c', { daysInStage: null }]]) as any;
    expect(avgDaysInStage(['a', 'b', 'c'], m)).toBe(15);
    expect(avgDaysInStage(['c'], m)).toBeNull();
  });
});
