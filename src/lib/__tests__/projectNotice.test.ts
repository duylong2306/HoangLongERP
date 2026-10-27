// Thông báo hệ thống của dự án: ghi nhật ký; chưa ghi được (chưa chạy migration) thì gửi nhóm chat như cũ.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const M = vi.hoisted(() => ({ record: vi.fn(), send: vi.fn(), ensure: vi.fn(), addMember: vi.fn() }));
vi.mock('../chatStore', () => ({ ensureProjectChatGroup: M.ensure, addMemberToConversation: M.addMember, sendGroupChatMessage: M.send }));
vi.mock('../projectEvents', () => ({ recordProjectEventFromMessage: M.record }));
import { postProjectNotice } from '../projectNotice';

const base = { project: { id: 'P1', name: 'Cổng', pmId: 'pm' }, actor: { id: 'u1', name: 'Long', role: 'admin' }, content: '✅ xong' };
beforeEach(() => { Object.values(M).forEach(f => f.mockReset()); M.ensure.mockResolvedValue({ id: 'conv_project_P1' }); });

describe('postProjectNotice', () => {
  it('ghi nhật ký được → KHÔNG nhắn vào nhóm chat; vẫn thêm người liên quan vào nhóm', async () => {
    M.record.mockResolvedValue(true);
    await postProjectNotice({ ...base, memberIds: ['e2'], relatedEntity: { type: 'task', id: 'T1' } as any });
    expect(M.send).not.toHaveBeenCalled();
    expect(M.addMember).toHaveBeenCalledWith('conv_project_P1', 'e2');
    expect(M.addMember).toHaveBeenCalledWith('conv_project_P1', 'pm');
    expect(M.record).toHaveBeenCalledWith('✅ xong', expect.objectContaining({ projectId: 'P1', taskId: 'T1', objKind: 'task', actor: { id: 'u1', name: 'Long' } }));
  });
  it('ghi nhật ký không được (chưa chạy migration) → gửi nhóm chat như cũ để không mất thông báo', async () => {
    M.record.mockResolvedValue(false);
    await postProjectNotice(base);
    expect(M.send).toHaveBeenCalledWith(expect.objectContaining({ conversationId: 'conv_project_P1', content: '✅ xong', senderId: 'u1' }));
  });
  it('tin có đính kèm (báo cáo kèm ảnh) → ảnh/tệp ghi vào NHẬT KÝ, KHÔNG gửi nhóm chat', async () => {
    M.record.mockResolvedValue(true);
    await postProjectNotice({ ...base, attachments: [{ id: 'a', type: 'image', name: 'a.jpg', url: 'https://kho/a.jpg', size: 9 } as any] });
    expect(M.send).not.toHaveBeenCalled();
    // chỉ giữ các trường cần để hiển thị (không mang cả size/mimeType)
    expect(M.record).toHaveBeenCalledWith('✅ xong', expect.objectContaining({ attachments: [{ id: 'a', type: 'image', name: 'a.jpg', url: 'https://kho/a.jpg' }] }));
  });
  it('tệp còn dạng base64 (upload lên kho thất bại) không đưa vào nhật ký được → vẫn gửi nhóm chat như cũ', async () => {
    M.record.mockResolvedValue(true);
    await postProjectNotice({ ...base, attachments: [{ id: 'a', type: 'image', name: 'a.jpg', url: 'data:image/jpeg;base64,AA' } as any] });
    expect(M.send).toHaveBeenCalledWith(expect.objectContaining({ attachments: [expect.objectContaining({ id: 'a' })] }));
    expect(M.record.mock.calls[0][1].attachments).toBeUndefined();
  });
  it('alsoChat = true vẫn ép gửi thêm vào nhóm chat (dùng khi thật sự cần)', async () => {
    M.record.mockResolvedValue(true);
    await postProjectNotice({ ...base, attachments: [{ id: 'a', url: 'https://kho/a.jpg' } as any], alsoChat: true });
    expect(M.send).toHaveBeenCalled();
  });
  it('lỗi bất kỳ không làm hỏng thao tác chính', async () => {
    M.ensure.mockRejectedValue(new Error('mạng'));
    await expect(postProjectNotice(base)).resolves.toBeUndefined();
  });
  it('ánh xạ đối tượng: mission / đề xuất', async () => {
    M.record.mockResolvedValue(true);
    await postProjectNotice({ ...base, relatedEntity: { type: 'mission', id: 'M1' } as any });
    expect(M.record).toHaveBeenLastCalledWith('✅ xong', expect.objectContaining({ missionId: 'M1', objKind: 'mission' }));
    await postProjectNotice({ ...base, relatedEntity: { type: 'advance', id: 'A1' } as any });
    expect(M.record).toHaveBeenLastCalledWith('✅ xong', expect.objectContaining({ objKind: 'proposal' }));
  });
});
