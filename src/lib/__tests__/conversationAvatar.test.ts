// Đổi ảnh đại diện nhóm chat: lưu vào dòng hội thoại (chatStore) và tải ảnh lên kho (dbService).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const S = vi.hoisted(() => ({ client: null as any, company: 'C1' as string | null }));
vi.mock('../supabase', () => ({ getSupabase: () => S.client, getCurrentCompanyId: () => S.company, companyScopedKey: (k: string) => k }));

import { saveConversations, getConversations, updateConversationAvatar } from '../chatStore';
import { dbService } from '../dbService';

const conv = (o: any = {}) => ({ id: 'g1', type: 'group', name: 'Nhóm', avatar: 'N.', color: '', participantIds: ['a', 'b'], createdBy: 'a', createdAt: '', unreadCount: 0, ...o });

/** Bộ dựng truy vấn giả: ghi lại lệnh update + các điều kiện, trả về kết quả định sẵn */
function fakeClient(result: { data: any; error: any }) {
  const calls: any = { updates: [], eqs: [] };
  const q: any = {
    update: (v: any) => { calls.updates.push(v); return q; },
    eq: (c: string, v: any) => { calls.eqs.push([c, v]); return q; },
    select: () => Promise.resolve(result),
  };
  return { calls, client: { from: (t: string) => { calls.table = t; return q; } } };
}

beforeEach(() => { S.client = null; S.company = 'C1'; saveConversations([conv(), conv({ id: 'p1', type: 'personal', avatar: '' })]); });

describe('updateConversationAvatar', () => {
  it('chỉ cập nhật cột avatar của đúng nhóm trong đúng công ty, rồi đổi bản trong bộ nhớ', async () => {
    const f = fakeClient({ data: [{ id: 'g1' }], error: null }); S.client = f.client;
    expect(await updateConversationAvatar('g1', 'https://kho/a.jpg')).toBe(true);
    expect(f.calls.table).toBe('conversations');
    expect(f.calls.updates).toEqual([{ avatar: 'https://kho/a.jpg' }]);   // không ghi đè thành viên / tin cuối
    expect(f.calls.eqs).toEqual([['id', 'g1'], ['company_id', 'C1']]);
    expect(getConversations().find(c => c.id === 'g1')?.avatar).toBe('https://kho/a.jpg');
  });
  it('máy chủ lỗi hoặc không dòng nào được sửa → false và KHÔNG đổi ở máy này (khỏi lệch với người khác)', async () => {
    S.client = fakeClient({ data: null, error: { message: 'lỗi' } }).client;
    expect(await updateConversationAvatar('g1', 'https://kho/a.jpg')).toBe(false);
    S.client = fakeClient({ data: [], error: null }).client;
    expect(await updateConversationAvatar('g1', 'https://kho/a.jpg')).toBe(false);
    expect(getConversations().find(c => c.id === 'g1')?.avatar).toBe('N.');
  });
  it('gỡ ảnh: url rỗng được lưu', async () => {
    const f = fakeClient({ data: [{ id: 'g1' }], error: null }); S.client = f.client;
    expect(await updateConversationAvatar('g1', '')).toBe(true);
    expect(f.calls.updates).toEqual([{ avatar: '' }]);
  });
  it('hội thoại cá nhân không có ảnh nhóm', async () => {
    const f = fakeClient({ data: [{ id: 'p1' }], error: null }); S.client = f.client;
    expect(await updateConversationAvatar('p1', 'https://kho/a.jpg')).toBe(false);
    expect(f.calls.updates).toEqual([]);
  });
});

describe('dbService.uploadConversationAvatar', () => {
  it('chưa kết nối máy chủ → null (không nhúng base64 vào dòng hội thoại)', async () => {
    S.client = null;
    expect(await dbService.uploadConversationAvatar('g1', new File(['x'], 'a.png', { type: 'image/png' }))).toBeNull();
  });
  it('không phải ảnh → null', async () => {
    S.client = { storage: { from: () => ({}) } };
    expect(await dbService.uploadConversationAvatar('g1', new File(['x'], 'a.pdf', { type: 'application/pdf' }))).toBeNull();
  });
  it('tải lên đúng bucket + thư mục công ty/conv-avatars, trả đường dẫn công khai', async () => {
    const upload = vi.fn(async () => ({ error: null }));
    const getPublicUrl = vi.fn((p: string) => ({ data: { publicUrl: `https://kho/${p}` } }));
    const from = vi.fn(() => ({ upload, getPublicUrl }));
    S.client = { storage: { from } };
    const url = await dbService.uploadConversationAvatar('conv_project_P1', new File(['x'], 'a.png', { type: 'image/png' }));
    expect(from).toHaveBeenCalledWith('chat-attachments');
    expect(upload.mock.calls[0][0]).toMatch(/^C1\/conv-avatars\/conv_project_P1_\d+\.png$/);
    expect(url).toMatch(/^https:\/\/kho\/C1\/conv-avatars\//);
  });
  it('upload lỗi → null', async () => {
    S.client = { storage: { from: () => ({ upload: async () => ({ error: new Error('bucket') }), getPublicUrl: () => ({ data: { publicUrl: 'x' } }) }) } };
    expect(await dbService.uploadConversationAvatar('g1', new File(['x'], 'a.png', { type: 'image/png' }))).toBeNull();
  });
});
