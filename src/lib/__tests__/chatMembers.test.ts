// Thành viên nhóm chat: không máy nào được ghi đè danh sách thành viên bằng bản copy cũ trong bộ nhớ
// (nguyên nhân người "chưa vào được" / "vào rồi bị out khỏi nhóm" — xem migration 20261030_project_chat_members.sql).
import { describe, it, expect, vi, beforeEach } from 'vitest';

type Row = Record<string, any>;
const S = vi.hoisted(() => ({ convs: [] as any[], msgs: [] as any[], rpcMissing: false, rpcCalls: [] as string[], upserts: [] as any[], updates: [] as any[] }));

vi.mock('../supabase', () => {
  const key = (r: Row) => `${r.company_id}|${r.id}`;
  const conversations = () => {
    let filt: Record<string, any> = {}; let mode: 'select' | 'update' = 'select'; let patch: any = null;
    const q: any = {
      select: () => q, eq: (c: string, v: any) => { filt[c] = v; return q; }, limit: () => q,
      update: (p: any) => { mode = 'update'; patch = p; return q; },
      upsert: async (row: Row) => { S.upserts.push(row); const i = S.convs.findIndex(r => key(r) === key(row)); if (i >= 0) S.convs[i] = { ...row }; else S.convs.push({ ...row }); return { error: null }; },
      then: (res: any) => {
        const hit = S.convs.filter(r => Object.entries(filt).every(([k, v]) => r[k] === v));
        if (mode === 'update') { S.updates.push(patch); hit.forEach(r => Object.assign(r, patch)); return Promise.resolve({ data: hit.map(r => ({ id: r.id })), error: null }).then(res); }
        return Promise.resolve({ data: hit.map(r => ({ ...r })), error: null }).then(res);
      },
    };
    return q;
  };
  const rpc = async (name: string, args: any) => {
    S.rpcCalls.push(name);
    if (S.rpcMissing) return { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };
    if (name === 'add_conversation_members') {
      const c = S.convs.find(r => r.id === args.p_conv_id); if (!c || c.type === 'personal') return { data: null, error: null };
      c.participant_ids = Array.from(new Set([...c.participant_ids, ...args.p_member_ids])).sort(); return { data: c.participant_ids, error: null };
    }
    if (name === 'ensure_project_chat_group') {
      const id = `conv_project_${args.p_project_id}`; let c = S.convs.find(r => r.id === id);
      if (!c) { c = { id, company_id: 'C1', type: 'group', name: '📁 P', participant_ids: ['pm1'], created_at: '2026-10-01T00:00:00Z', unread_counts: {}, project_id: args.p_project_id }; S.convs.push(c); }
      return { data: [{ ...c }], error: null };
    }
    return { data: null, error: null };
  };
  const from = (t: string) => t === 'conversations' ? conversations() : { insert: async (row: Row) => { S.msgs.push(row); return { error: null }; } };
  return { getSupabase: () => ({ from, rpc, channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }), removeChannel: () => {} }), getCurrentCompanyId: () => 'C1', getCurrentAccessToken: () => null };
});

import { addMessage, addMemberToConversation, ensureProjectChatGroup, saveConversations, getConversations } from '../chatStore';

const cloudConv = (o: Row = {}) => ({ id: 'conv_project_P1', company_id: 'C1', type: 'group', name: '📁 P', avatar: 'P', color: '#000', participant_ids: ['a', 'b', 'c'], created_by: 'a', created_at: '2026-10-01T00:00:00Z', unread_counts: {}, project_id: 'P1', pinned: true, ...o });

beforeEach(() => { S.convs = []; S.msgs = []; S.rpcMissing = false; S.rpcCalls = []; S.upserts = []; S.updates = []; saveConversations([]); });

describe('gửi tin nhắn KHÔNG ghi đè danh sách thành viên', () => {
  it('máy có bản copy CŨ (thiếu người c vừa được thêm) gửi tin → trên máy chủ vẫn còn đủ a, b, c', async () => {
    S.convs.push(cloudConv());
    saveConversations([{ id: 'conv_project_P1', type: 'group', name: '📁 P', participantIds: ['a', 'b'], createdBy: 'a', createdAt: '2026-10-01T00:00:00Z', unreadCount: 0 } as any]);   // bản cũ: chưa có c
    await addMessage({ conversationId: 'conv_project_P1', senderId: 'a', senderName: 'A', content: 'xin chào', system: false } as any);
    expect(S.convs[0].participant_ids).toEqual(['a', 'b', 'c']);
    expect(S.upserts).toEqual([]);                                  // không upsert cả dòng
    expect(S.updates[0]).not.toHaveProperty('participant_ids');     // chỉ cập nhật tin cuối / chưa đọc
    expect(S.updates[0].last_message.content).toBe('xin chào');
    expect(S.msgs).toHaveLength(1);
  });
  it('hội thoại CHƯA có trên máy chủ (mới tạo) → vẫn tạo đầy đủ để tin nhắn không lỗi khóa ngoại', async () => {
    saveConversations([{ id: 'conv_new', type: 'group', name: 'Mới', participantIds: ['a', 'b'], createdBy: 'a', createdAt: '2026-10-01T00:00:00Z', unreadCount: 0 } as any]);
    await addMessage({ conversationId: 'conv_new', senderId: 'a', senderName: 'A', content: 'hi', system: false } as any);
    expect(S.upserts).toHaveLength(1);
    expect(S.convs[0].participant_ids).toEqual(['a', 'b']);
  });
});

describe('ensureProjectChatGroup — không tạo đè nhóm có sẵn', () => {
  it('người CHƯA là thành viên (bộ nhớ không có nhóm) gọi ensure → dùng hàm máy chủ, nhóm cũ nguyên vẹn', async () => {
    S.convs.push(cloudConv());
    const conv = await ensureProjectChatGroup({ id: 'P1', name: 'P', pmId: 'pm1' });
    expect(S.rpcCalls).toContain('ensure_project_chat_group');
    expect(S.upserts).toEqual([]);
    expect(conv!.participantIds).toEqual(['a', 'b', 'c']);
    expect(getConversations().find(c => c.id === 'conv_project_P1')).toBeTruthy();
  });
  it('chưa chạy migration (hàm máy chủ chưa có): đọc nhóm trên máy chủ, chỉ GỘP trưởng dự án, KHÔNG ghi đè', async () => {
    S.rpcMissing = true; S.convs.push(cloudConv());
    const conv = await ensureProjectChatGroup({ id: 'P1', name: 'P', pmId: 'pm1' });
    expect(S.upserts).toEqual([]);
    expect([...conv!.participantIds].sort()).toEqual(['a', 'b', 'c', 'pm1']);
    expect([...S.convs[0].participant_ids].sort()).toEqual(['a', 'b', 'c', 'pm1']);
  });
  it('nhóm thật sự chưa có ở đâu cả → tạo mới (dự phòng)', async () => {
    S.rpcMissing = true;
    const conv = await ensureProjectChatGroup({ id: 'P9', name: 'Mới', pmId: 'pm1' });
    expect(conv!.participantIds).toEqual(['pm1']);
    expect(S.upserts).toHaveLength(1);
  });
});

describe('addMemberToConversation — không phụ thuộc bộ nhớ của máy', () => {
  it('bộ nhớ trống (không có nhóm) vẫn thêm được qua hàm máy chủ, không mất người cũ', async () => {
    S.convs.push(cloudConv());
    const r = await addMemberToConversation('conv_project_P1', 'z');
    expect(r!.participantIds).toEqual(['a', 'b', 'c', 'z']);
    expect(S.convs[0].participant_ids).toEqual(['a', 'b', 'c', 'z']);
  });
  it('dự phòng (chưa có hàm máy chủ): đọc bản mới nhất → gộp → chỉ ghi participant_ids', async () => {
    S.rpcMissing = true; S.convs.push(cloudConv());
    saveConversations([{ id: 'conv_project_P1', type: 'group', name: '📁 P', participantIds: ['a'], createdBy: 'a', createdAt: 'x', unreadCount: 0 } as any]);   // bản cũ chỉ có a
    const r = await addMemberToConversation('conv_project_P1', 'z');
    expect([...r!.participantIds].sort()).toEqual(['a', 'b', 'c', 'z']);
    expect(S.updates.at(-1)).toEqual({ participant_ids: ['a', 'b', 'c', 'z'] });
  });
  it('đã là thành viên → không gọi máy chủ; hội thoại 1-1 → không thêm', async () => {
    saveConversations([{ id: 'g', type: 'group', name: 'g', participantIds: ['a'], createdBy: 'a', createdAt: 'x', unreadCount: 0 } as any,
                       { id: 'p', type: 'personal', name: 'p', participantIds: ['a', 'b'], createdBy: 'a', createdAt: 'x', unreadCount: 0 } as any]);
    await addMemberToConversation('g', 'a');
    expect(await addMemberToConversation('p', 'z')).toBeNull();
    expect(S.rpcCalls).toEqual([]);
  });
});
