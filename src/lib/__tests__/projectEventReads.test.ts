// Mốc "đã xem nhật ký" → số hoạt động mới của từng dự án: lần đầu đặt mốc, không tính việc của chính mình, bảng chưa có thì im lặng.
import { describe, it, expect, beforeEach, vi } from 'vitest';

type Row = Record<string, any>;
const S: { reads: Row[]; events: Row[]; upserts: Row[]; missing: boolean } = { reads: [], events: [], upserts: [], missing: false };

function query(table: string) {
  let r: Row[] = table === 'project_event_reads' ? [...S.reads] : [...S.events]; let lim = Infinity; let asc = true;
  const q: any = {
    select: () => q,
    eq: (c: string, v: any) => { r = r.filter(x => x[c] === v); return q; },
    in: (c: string, v: any[]) => { r = r.filter(x => v.includes(x[c])); return q; },
    gt: (c: string, v: any) => { r = r.filter(x => x[c] > v); return q; },
    order: (_c: string, o: any) => { asc = !!o?.ascending; return q; },
    limit: (n: number) => { lim = n; return q; },
    then: (res: any) => {
      if (S.missing) return Promise.resolve({ data: null, error: { code: 'PGRST205', message: 'Could not find the table' } }).then(res);
      const out = [...r].sort((a, b) => (asc ? 1 : -1) * String(a.created_at).localeCompare(String(b.created_at)));
      return Promise.resolve({ data: out.slice(0, lim), error: null }).then(res);
    },
  };
  return q;
}
vi.mock('../supabase', () => ({
  getSupabase: () => ({ from: (t: string) => ({
    select: () => query(t),
    upsert: async (rows: Row | Row[]) => { if (S.missing) return { error: { code: '42P01', message: 'does not exist' } }; S.upserts.push(...(Array.isArray(rows) ? rows : [rows])); return { error: null }; },
  }) }),
  getCurrentCompanyId: () => 'C1',
}));

import { loadUnreadSummary, markProjectSeen, projectIdOfConversation, __resetProjectEventReadsState } from '../projectEventReads';

beforeEach(() => { S.reads = []; S.events = []; S.upserts = []; S.missing = false; __resetProjectEventReadsState(); });

describe('projectIdOfConversation', () => {
  it('nhóm dự án → mã dự án; hội thoại công việc / cá nhân → không', () => {
    expect(projectIdOfConversation({ id: 'conv_project_P1' })).toBe('P1');
    expect(projectIdOfConversation({ id: 'x', projectId: 'P2' })).toBe('P2');
    expect(projectIdOfConversation({ id: 'conv_task_T1', projectId: 'P2', taskId: 'T1' })).toBeUndefined();
    expect(projectIdOfConversation({ id: 'personal_a_b' })).toBeUndefined();
  });
});

describe('loadUnreadSummary', () => {
  it('đếm hoạt động sau mốc, bỏ việc của chính mình, kèm tóm tắt mới nhất', async () => {
    S.reads = [{ project_id: 'P1', user_id: 'me', last_seen_at: '2026-10-27T08:00:00Z' }];
    S.events = [
      { project_id: 'P1', created_at: '2026-10-27T07:00:00Z', actor_id: 'a', text: 'cũ hơn mốc' },
      { project_id: 'P1', created_at: '2026-10-27T09:00:00Z', actor_id: 'a', actor_name: 'Lan', text: 'giao việc A' },
      { project_id: 'P1', created_at: '2026-10-27T10:00:00Z', actor_id: 'me', text: 'việc của tôi' },
      { project_id: 'P1', created_at: '2026-10-27T11:00:00Z', actor_id: 'b', actor_name: 'Hùng', text: 'nhận việc A' },
      { project_id: 'P1', created_at: '2026-10-27T12:00:00Z', actor_id: 'c', actor_name: 'Mai', text: 'duyệt phiếu chi' },
    ];
    const r = await loadUnreadSummary('me', ['P1']);
    expect(r.P1.count).toBe(3);
    expect(r.P1.latest.map(x => x.text)).toEqual(['duyệt phiếu chi', 'nhận việc A']); // mới → cũ, giữ 2 dòng
  });
  it('mốc riêng từng dự án: dự án đã xem muộn hơn thì không tính sự kiện trước mốc đó', async () => {
    S.reads = [{ project_id: 'P1', user_id: 'me', last_seen_at: '2026-10-27T08:00:00Z' }, { project_id: 'P2', user_id: 'me', last_seen_at: '2026-10-27T11:30:00Z' }];
    S.events = [{ project_id: 'P2', created_at: '2026-10-27T11:00:00Z', actor_id: 'a', text: 'đã xem rồi' }, { project_id: 'P1', created_at: '2026-10-27T09:00:00Z', actor_id: 'a', text: 'mới' }];
    const r = await loadUnreadSummary('me', ['P1', 'P2']);
    expect(r.P1.count).toBe(1); expect(r.P2).toBeUndefined();
  });
  it('lần đầu (chưa có mốc): đặt mốc = bây giờ, không báo lịch sử cũ là mới', async () => {
    S.events = [{ project_id: 'P1', created_at: '2020-01-01T00:00:00Z', actor_id: 'a', text: 'rất cũ' }];
    const r = await loadUnreadSummary('me', ['P1']);
    expect(r).toEqual({});
    expect(S.upserts.length).toBe(1); expect(S.upserts[0]).toMatchObject({ company_id: 'C1', user_id: 'me', project_id: 'P1' });
  });
  it('chưa chạy migration → trả rỗng, không lỗi', async () => {
    S.missing = true;
    expect(await loadUnreadSummary('me', ['P1'])).toEqual({});
  });
});

describe('markProjectSeen', () => {
  it('ghi mốc bây giờ cho đúng người + dự án và báo sự kiện cho giao diện', async () => {
    const fn = vi.fn(); window.addEventListener('hl-project-seen', fn);
    await markProjectSeen('me', 'P1');
    expect(S.upserts[0]).toMatchObject({ company_id: 'C1', user_id: 'me', project_id: 'P1' });
    expect(fn).toHaveBeenCalled();
    window.removeEventListener('hl-project-seen', fn);
  });
  it('chưa chạy migration → không ném lỗi', async () => {
    S.missing = true;
    await expect(markProjectSeen('me', 'P1')).resolves.toBeUndefined();
  });
});
