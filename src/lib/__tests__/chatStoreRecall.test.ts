import { describe, it, expect } from 'vitest';
import { getMessages, saveMessages, softDeleteMessage } from '../chatStore';

// Thu hồi 1 tin chỉ được đánh dấu xóa ĐÚNG tin đó — các tin khác trong hội thoại (và hội thoại khác) phải còn nguyên.
const msg = (id: string, conv: string, content: string, o: any = {}) => ({ id, conversationId: conv, senderId: 'a', senderName: 'A', content, createdAt: `2026-11-04T09:0${id.slice(-1)}:00Z`, read: true, ...o });

describe('softDeleteMessage (thu hồi tin nhắn)', () => {
  it('chỉ tin được thu hồi bị đánh dấu deleted; tin khác trong cùng hội thoại và hội thoại khác giữ nguyên', async () => {
    saveMessages('c1', [msg('m1', 'c1', 'một'), msg('m2', 'c1', 'hai', { attachments: [{ id: 'x', type: 'image', name: 'a.png', url: 'u' }], pinned: true }), msg('m3', 'c1', 'ba')] as any);
    saveMessages('c2', [msg('m1', 'c2', 'khác hội thoại')] as any);
    await softDeleteMessage('c1', 'm2');
    const c1 = getMessages('c1');
    expect(c1.map(m => m.id)).toEqual(['m1', 'm2', 'm3']);                       // không mất tin nào
    expect(c1.map(m => !!m.deleted)).toEqual([false, true, false]);
    expect(c1[0].content).toBe('một'); expect(c1[2].content).toBe('ba');
    expect(c1[1].content).toContain('đã bị xóa');
    expect(getMessages('c2')).toHaveLength(1); expect(getMessages('c2')[0].deleted).toBeFalsy();   // hội thoại khác không bị ảnh hưởng dù trùng mã tin
  });
  it('thu hồi tin không tồn tại → không làm mất tin nào', async () => {
    saveMessages('c3', [msg('m1', 'c3', 'một'), msg('m2', 'c3', 'hai')] as any);
    await softDeleteMessage('c3', 'm9');
    expect(getMessages('c3').map(m => m.content)).toEqual(['một', 'hai']);
  });
});
