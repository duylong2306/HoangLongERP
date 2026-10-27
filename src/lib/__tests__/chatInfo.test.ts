import { describe, it, expect } from 'vitest';
import { readPrefs, writePrefs, toggleIn, unreadForBadge, prefsKey } from '../chatPrefs';
import { scrollTopAfterPrepend, filterConversations, sortConversations, categoryOf, collectMedia, extractLinks, pinnedMessages, dayLabel, listTime, isFirstOfRun, isPinnedConv, isStarredConv, CATEGORY_MENU } from '../chatInfo';

const conv = (id: string, o: any = {}) => ({ id, type: 'personal', name: id, participantIds: ['me', 'x'], createdAt: '2026-10-01T00:00:00Z', unreadCount: 0, ...o }) as any;
const none = { muted: [], pinned: [] };
const mem = () => { const m: Record<string, string> = {}; return { getItem: (k: string) => (k in m ? m[k] : null), setItem: (k: string, v: string) => { m[k] = v; } }; };

describe('chatPrefs', () => {
  it('tắt thông báo / ghim: lưu & đọc lại, dữ liệu hỏng → rỗng, mỗi người một khóa', () => {
    const s = mem(); const k = prefsKey('u1');
    writePrefs(k, { muted: ['a'], pinned: ['b'], starred: ['c'] }, s); expect(readPrefs(k, s)).toEqual({ muted: ['a'], pinned: ['b'], starred: ['c'] });
    s.setItem(k, '{"muted":["a"]}'); expect(readPrefs(k, s)).toEqual({ muted: ['a'], pinned: [], starred: [] });   // dữ liệu cũ chưa có starred vẫn đọc được
    s.setItem(k, '{hỏng'); expect(readPrefs(k, s)).toEqual({ muted: [], pinned: [], starred: [] });
    expect(prefsKey('u1')).not.toBe(prefsKey('u2'));
  });
  it('toggleIn không sửa mảng gốc', () => { const a = ['x']; expect(toggleIn(a, 'y')).toEqual(['x', 'y']); expect(toggleIn(a, 'x')).toEqual([]); expect(a).toEqual(['x']); });
  it('huy hiệu chưa đọc không tính hội thoại đã tắt thông báo', () => {
    const cs = [conv('a', { unreadCount: 3 }), conv('b', { unreadCount: 5 }), conv('c')];
    expect(unreadForBadge(cs, none)).toBe(8);
    expect(unreadForBadge(cs, { muted: ['b'], pinned: [] })).toBe(3);
  });
});

describe('lọc / phân loại / sắp xếp hội thoại', () => {
  const cs = [
    conv('p1', { name: 'Ngô Văn An', unreadCount: 2, lastMessageAt: '2026-10-20T10:00:00Z' }),
    conv('g1', { type: 'group', name: 'Điểm danh', lastMessageAt: '2026-10-20T09:00:00Z' }),
    conv('conv_project_X', { type: 'group', name: '📁 CÔNG TRÌNH X', unreadCount: 1, lastMessageAt: '2026-10-20T11:00:00Z' }),
    conv('t1', { type: 'task', name: 'Nhóm việc', lastMessageAt: '2026-10-19T09:00:00Z' }),
    conv('other', { participantIds: ['y', 'z'] }),
  ];
  const f = (o: any = {}) => filterConversations(cs, { userId: 'me', tab: 'all', category: 'all', query: '', prefs: none, ...o }).map(c => c.id);
  it('chỉ hội thoại có mình; phân loại theo loại', () => {
    expect(f()).toEqual(['p1', 'g1', 'conv_project_X', 't1']);
    expect(categoryOf(cs[0])).toBe('personal'); expect(categoryOf(cs[1])).toBe('group'); expect(categoryOf(cs[2])).toBe('project'); expect(categoryOf(cs[3])).toBe('task');
    expect(f({ category: 'project' })).toEqual(['conv_project_X']);
    expect(f({ category: 'personal' })).toEqual(['p1']);
    expect(f({ category: 'task' })).toEqual(['t1']);
  });
  it('tab Chưa đọc; Đã ghim; Đã tắt thông báo', () => {
    expect(f({ tab: 'unread' })).toEqual(['p1', 'conv_project_X']);
    expect(f({ category: 'pinned', prefs: { muted: [], pinned: ['g1'] } })).toEqual(['g1']);
    expect(f({ category: 'muted', prefs: { muted: ['t1'], pinned: [] } })).toEqual(['t1']);
  });
  it('tab Quan tâm: chỉ hội thoại đã đánh dấu ⭐; kết hợp được với Phân loại; dữ liệu cũ chưa có starred → rỗng', () => {
    expect(f({ tab: 'starred', prefs: { muted: [], pinned: [], starred: ['g1', 'p1'] } })).toEqual(['p1', 'g1']);
    expect(f({ tab: 'starred', category: 'personal', prefs: { muted: [], pinned: [], starred: ['g1', 'p1'] } })).toEqual(['p1']);
    expect(f({ tab: 'starred' })).toEqual([]);
    expect(isStarredConv({ id: 'g1' }, { muted: [], pinned: [], starred: ['g1'] })).toBe(true);
    expect(isStarredConv({ id: 'g1' }, none)).toBe(false);
  });
  it('menu Phân loại không còn "Công việc" và "Đã ghim"', () => {
    expect(CATEGORY_MENU).toEqual(['all', 'personal', 'group', 'project', 'muted']);
  });
  it('tìm kiếm không dấu, theo tên và theo tin cuối', () => {
    expect(f({ query: 'ngo van' })).toEqual(['p1']);
    expect(f({ query: 'DIEM DANH' })).toEqual(['g1']);
    expect(f({ query: 'cong trinh' })).toEqual(['conv_project_X']);
  });
  it('sắp xếp: ghim trước; rồi chưa đọc (không tắt thông báo); rồi mới nhất', () => {
    const ids = (p: any) => sortConversations(cs.slice(0, 4), p).map(c => c.id);
    expect(ids(none)).toEqual(['conv_project_X', 'p1', 'g1', 't1']);                       // chưa đọc trước, mới nhất trước
    expect(ids({ muted: ['conv_project_X'], pinned: [] })).toEqual(['p1', 'conv_project_X', 'g1', 't1']);   // tắt thông báo → không được đẩy lên vì chưa đọc
    expect(ids({ muted: [], pinned: ['t1'] })[0]).toBe('t1');                              // ghim lên đầu
    expect(isPinnedConv(conv('z', { pinned: true }), none)).toBe(true);                    // ghim hệ thống (nhóm công trình)
  });
});

describe('thông tin hội thoại & hiển thị', () => {
  const msg = (id: string, at: string, o: any = {}) => ({ id, conversationId: 'c', senderId: 'a', senderName: 'A', content: '', createdAt: at, read: true, ...o }) as any;
  it('gom ảnh / tệp / link, bỏ tin đã thu hồi, mới nhất trước', () => {
    const msgs = [
      msg('1', '2026-10-20T08:00:00Z', { attachments: [{ id: 'a1', type: 'image', name: 'a.png', url: 'u1', mimeType: 'image/png' }, { id: 'a2', type: 'file', name: 'b.xlsx', url: 'u2' }] }),
      msg('2', '2026-10-20T09:00:00Z', { content: 'xem https://example.com/x. và http://a.vn/b', attachments: [{ id: 'a3', type: 'camera', name: 'c.jpg', url: 'u3' }] }),
      msg('3', '2026-10-20T10:00:00Z', { deleted: true, attachments: [{ id: 'a4', type: 'image', name: 'd.png', url: 'u4' }], content: 'https://xoa.com' }),
    ];
    const { images, files } = collectMedia(msgs);
    expect(images.map(i => i.id)).toEqual(['a3', 'a1']); expect(files.map(i => i.id)).toEqual(['a2']);
    expect(extractLinks(msgs).map(l => l.url)).toEqual(['https://example.com/x', 'http://a.vn/b']);   // bỏ dấu câu cuối, bỏ tin thu hồi
  });
  it('tin đã ghim (không gồm thu hồi), mới nhất trước', () => {
    expect(pinnedMessages([msg('1', '2026-10-20T08:00:00Z', { pinned: true }), msg('2', '2026-10-20T09:00:00Z', { pinned: true }), msg('3', '2026-10-20T10:00:00Z', { pinned: true, deleted: true }), msg('4', '2026-10-20T11:00:00Z')]).map(m => m.id)).toEqual(['2', '1']);
  });
  it('nhãn ngày, giờ danh sách, gộp tin liên tiếp', () => {
    const now = new Date('2026-10-20T12:00:00');
    expect(dayLabel(now.toISOString(), now)).toBe('Hôm nay');
    expect(dayLabel(new Date('2026-10-19T12:00:00').toISOString(), now)).toBe('Hôm qua');
    expect(listTime(new Date(now.getTime() - 30_000).toISOString(), now)).toBe('Vừa xong');
    expect(listTime(new Date(now.getTime() - 4 * 60_000).toISOString(), now)).toBe('4 phút');
    expect(listTime(new Date(now.getTime() - 2 * 3600_000).toISOString(), now)).toBe('2 giờ');
    expect(listTime(undefined, now)).toBe('');
    const ms = [msg('1', '2026-10-20T08:00:00Z', { senderId: 'a' }), msg('2', '2026-10-20T08:02:00Z', { senderId: 'a' }), msg('3', '2026-10-20T08:30:00Z', { senderId: 'a' }), msg('4', '2026-10-20T08:31:00Z', { senderId: 'b' })];
    expect([0, 1, 2, 3].map(i => isFirstOfRun(ms, i))).toEqual([true, false, true, true]);
  });
});

describe('scrollTopAfterPrepend — không bị kéo ngược sau khi tải tin cũ', () => {
  it('đang đọc tin cũ: giữ nguyên chỗ đang đọc (vị trí hiện tại + phần chiều cao vừa thêm)', () => {
    expect(scrollTopAfterPrepend({ pinned: false, scrollTop: 40, prevHeight: 1000, newHeight: 1600 })).toBe(640);
  });
  it('đã bấm "xuống cuối" trong lúc tải (pinned) → không chỉnh, KHÔNG nhảy về chỗ cũ', () => {
    expect(scrollTopAfterPrepend({ pinned: true, scrollTop: 5000, prevHeight: 1000, newHeight: 1600 })).toBeNull();
  });
  it('không bao giờ ra số âm', () => {
    expect(scrollTopAfterPrepend({ pinned: false, scrollTop: 0, prevHeight: 1000, newHeight: 900 })).toBe(0);
  });
});
