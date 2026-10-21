import { describe, it, expect, vi, beforeEach } from 'vitest';

// Tin nhắn thời gian thực "mượt như Zalo": áp thẳng dòng realtime (không tải lại), hiện tin của mình ngay, ghi lên máy chủ song song.
const h = vi.hoisted(() => ({ handlers: [] as { filter: any; cb: (p: any) => void }[], selects: 0, order: [] as string[], failFirstMsg: false, cols: [] as string[], light: [] as any[], atts: [] as any[], lightError: false }));
vi.mock('../supabase', () => {
  const channel = () => { const ch: any = { on: (_t: string, filter: any, cb: any) => { h.handlers.push({ filter, cb }); return ch; }, subscribe: () => ch }; return ch; };
  const from = (table: string) => {
    const q: any = {
      select: (cols?: string) => { h.selects++; if (cols) h.cols.push(cols); q._cols = cols; return q; }, eq: () => q, gte: () => q, contains: () => q, order: () => q, update: () => q, in: () => q,
      then: (res: any) => res(q._cols?.includes('att0:') ? (h.lightError ? { data: null, error: { message: 'col' } } : { data: h.light, error: null }) : q._cols === 'id,attachments' ? { data: h.atts, error: null } : { data: [], error: null }),
      insert: async (row: any) => { h.order.push('insert:' + table); if (table === 'chat_messages' && h.failFirstMsg) { h.failFirstMsg = false; return { error: { code: '23503', message: 'foreign key' } }; } return { error: null }; },
      upsert: async () => { h.order.push('upsert:' + table); return { error: null }; },
    };
    return q;
  };
  return { getSupabase: () => ({ channel, from, removeChannel: () => {} }), getCurrentCompanyId: () => 'C1', getCurrentAccessToken: () => null };
});
import { loadMessagesProgressive, subscribeMessages, subscribeConversations, addMessage, getMessages, getConversations, saveConversations, saveMessages } from '../chatStore';

const row = (o: any = {}) => ({ id: 'm1', conversation_id: 'c1', sender_id: 'u2', sender_name: 'B', content: 'xin chào', created_at: '2026-10-21T10:00:00Z', read: false, attachments: [], reactions: [], read_by: [], ...o });
const handlerFor = (event: string) => h.handlers.filter(x => x.filter.event === event).at(-1)!.cb;

beforeEach(() => { h.cols.length = 0; h.light = []; h.atts = []; h.lightError = false; h.handlers.length = 0; h.selects = 0; h.order.length = 0; h.failFirstMsg = false; saveMessages('c1', []); saveConversations([]); });

describe('subscribeMessages — áp thẳng dòng realtime', () => {
  it('INSERT: tin hiện ngay từ payload, KHÔNG truy vấn tải lại', () => {
    const got: any[] = [];
    subscribeMessages('c1', (m, k) => got.push([m.map(x => x.id), k]));
    handlerFor('INSERT')({ new: row() });
    expect(got).toEqual([[['m1'], 'insert']]);
    expect(h.selects).toBe(0);
    expect(getMessages('c1')[0].content).toBe('xin chào');
  });
  it('trùng id (tin của chính mình vọng lại) không bị nhân đôi', () => {
    subscribeMessages('c1', () => {});
    handlerFor('INSERT')({ new: row() }); handlerFor('INSERT')({ new: row() });
    expect(getMessages('c1')).toHaveLength(1);
  });
  it('UPDATE (thu hồi/cảm xúc/đã xem): gộp vào tin cũ, kind=update', () => {
    const kinds: any[] = [];
    subscribeMessages('c1', (_m, k) => kinds.push(k));
    handlerFor('INSERT')({ new: row() });
    handlerFor('UPDATE')({ new: row({ deleted: true, read_by: ['u1'] }) });
    expect(kinds).toEqual(['insert', 'update']);
    expect(getMessages('c1')[0]).toMatchObject({ deleted: true, readBy: ['u1'] });
  });
  it('payload thiếu dữ liệu / quá lớn (errors) → tải lại như cũ', () => {
    subscribeMessages('c1', () => {});
    handlerFor('INSERT')({ new: row(), errors: ['Error 413: Payload too large'] });
    handlerFor('INSERT')({ new: {} });
    expect(h.selects).toBe(2);
  });
  it('bỏ qua dòng của hội thoại khác', () => {
    subscribeMessages('c1', () => {});
    handlerFor('INSERT')({ new: row({ conversation_id: 'c9' }) });
    expect(getMessages('c1')).toHaveLength(0);
  });
});

describe('subscribeConversations — cập nhật từng dòng', () => {
  const crow = (o: any = {}) => ({ id: 'c1', type: 'group', name: 'N', participant_ids: ['u1', 'u2'], created_by: 'u2', created_at: 'x', unread_counts: { u1: 3 }, ...o });
  it('UPDATE áp thẳng, số chưa đọc của riêng mình; không tải lại cả danh sách', () => {
    const cb = vi.fn(); const un = subscribeConversations('u1', cb);
    handlerFor('*')({ eventType: 'UPDATE', new: crow() });
    expect(getConversations().find(c => c.id === 'c1')?.unreadCount).toBe(3);
    expect(cb).toHaveBeenCalled(); expect(h.selects).toBe(0);
    un();   // kênh hội thoại dùng chung toàn app → hủy để test sau đăng ký lại
  });
  it('bị gỡ khỏi hội thoại hoặc hội thoại bị xóa → biến mất', () => {
    const un = subscribeConversations('u1', () => {});
    handlerFor('*')({ eventType: 'UPDATE', new: crow() });
    handlerFor('*')({ eventType: 'UPDATE', new: crow({ participant_ids: ['u2'] }) });
    expect(getConversations()).toHaveLength(0);
    handlerFor('*')({ eventType: 'UPDATE', new: crow() }); handlerFor('*')({ eventType: 'DELETE', old: { id: 'c1' } });
    expect(getConversations()).toHaveLength(0);
    un();
  });
});

describe('addMessage — gửi nhanh', () => {
  const conv = { id: 'c1', type: 'group', name: 'N', avatar: '', color: '', participantIds: ['u1', 'u2'], createdBy: 'u1', createdAt: 'x', unreadCount: 0 } as any;
  it('gọi onLocal NGAY khi tin đã vào bộ nhớ (trước mọi lệnh mạng); tin + hội thoại ghi song song', async () => {
    saveConversations([conv]);
    let atLocal: string[] = [];
    await addMessage({ conversationId: 'c1', senderId: 'u1', senderName: 'A', content: 'hi', system: false } as any, () => { atLocal = [...h.order]; });
    expect(atLocal).toEqual([]);                                         // lúc onLocal chưa có lệnh mạng nào
    expect(h.order.sort()).toEqual(['insert:chat_messages', 'upsert:conversations']);   // chỉ 2 lượt (trước đây 3 lượt nối đuôi)
    expect(getConversations()[0].unreadCounts).toEqual({ u2: 1 });
  });
  it('lỗi khóa ngoại (hội thoại chưa có trên cloud) → chờ hội thoại rồi chèn lại tin 1 lần', async () => {
    saveConversations([conv]); h.failFirstMsg = true;
    await addMessage({ conversationId: 'c1', senderId: 'u1', senderName: 'A', content: 'hi', system: false } as any);
    expect(h.order.filter(x => x === 'insert:chat_messages')).toHaveLength(2);
  });
});

describe('loadMessagesProgressive — mở hội thoại nhanh', () => {
  const lrow = (id: string, att0: string | null = null, at = '2026-10-21T10:00:00Z') => ({ id, conversation_id: 'c1', sender_id: 'u2', sender_name: 'B', content: 'tin ' + id, created_at: at, att0 });
  it('bước 1 chỉ tải chữ (KHÔNG có cột attachments) rồi vẽ ngay; bước 2 gắn tệp cho tin có đính kèm', async () => {
    h.light = [lrow('a'), lrow('b', 'f1', '2026-10-21T10:01:00Z')];
    h.atts = [{ id: 'b', attachments: [{ id: 'f1', name: 'x.png' }] }];
    const seen: any[] = [];
    const all = await loadMessagesProgressive('c1', {}, () => seen.push(getMessages('c1').map(m => [m.id, !!m.attachments?.length])));
    expect(h.cols[0]).not.toMatch(/(^|,)attachments(,|$)/);                 // cột nặng không có ở bước 1
    expect(seen).toEqual([[['a', false], ['b', false]]]);                     // lúc vẽ lần 1: đã có chữ, chưa có tệp
    expect(all.find(m => m.id === 'b')?.attachments?.[0].name).toBe('x.png'); // sau bước 2: có tệp
    expect(h.cols).toContain('id,attachments');
  });
  it('không có tin nào đính kèm → không gọi bước 2', async () => {
    h.light = [lrow('a')];
    await loadMessagesProgressive('c1');
    expect(h.cols).not.toContain('id,attachments');
  });
  it('bước 1 lỗi (vd thiếu cột) → quay về cách tải cũ, không mất tin', async () => {
    h.lightError = true;
    const r = await loadMessagesProgressive('c1');
    expect(Array.isArray(r)).toBe(true);
    expect(h.cols.some(c => c === '*')).toBe(true);
  });
});
