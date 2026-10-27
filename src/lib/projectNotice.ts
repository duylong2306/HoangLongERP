// ĐƯỜNG GỬI THÔNG BÁO HỆ THỐNG CỦA DỰ ÁN: ghi vào NHẬT KÝ dự án (lib/projectEvents) thay vì nhắn vào nhóm chat,
// để nhóm chat chỉ còn thảo luận do người viết. Vẫn đảm bảo nhóm chat tồn tại và các nhân sự liên quan là thành viên
// (để họ mở được nhóm / xem được nhật ký từ nút trong khung thông tin hội thoại).
//
// An toàn khi chưa chạy migration: ghi nhật ký thất bại → tự gửi tin vào nhóm chat theo cách cũ (không mất thông báo).
import type { ChatAttachment, ChatMessage } from '../types';
import { ensureProjectChatGroup, addMemberToConversation, sendGroupChatMessage } from './chatStore';
import { recordProjectEventFromMessage, type ProjectEventInput, type ProjectEventType } from './projectEvents';

export interface ProjectNoticeParams {
  project: { id: string; name?: string; pmId?: string };
  actor: { id: string; name: string; role?: string };
  content: string;
  relatedEntity?: ChatMessage['relatedEntity'];
  attachments?: ChatAttachment[];
  /** Nhân sự liên quan cần có mặt trong nhóm chat dự án */
  memberIds?: (string | undefined)[];
  taskId?: string;
  missionId?: string;
  /** Loại sự kiện nêu rõ (bỏ trống → tự đoán theo biểu tượng/từ khóa — xem classifyEvent) */
  type?: ProjectEventType;
  objKind?: ProjectEventInput['objKind'];
  objName?: string;
  from?: string;
  to?: string;
  /** true: ngoài nhật ký còn gửi tin vào nhóm chat (mặc định KHÔNG: ảnh/tệp đính kèm hiện trong nhật ký) */
  alsoChat?: boolean;
}

/** relatedEntity của tin → đối tượng của sự kiện */
function entityContext(rel?: ChatMessage['relatedEntity']): Pick<ProjectEventInput, 'taskId' | 'missionId' | 'objKind'> {
  if (!rel) return {};
  const t = String((rel as any).type || '');
  if (t === 'task') return { taskId: rel.id, objKind: 'task' };
  if (t === 'mission') return { missionId: rel.id, objKind: 'mission' };
  if (t === 'advance' || t === 'proposal') return { objKind: 'proposal' };
  if (t === 'payment') return { objKind: 'payment' };
  if (t === 'project') return { objKind: 'project' };
  return {};
}

export async function postProjectNotice(p: ProjectNoticeParams): Promise<void> {
  try {
    const conv = await ensureProjectChatGroup({ id: p.project.id, name: p.project.name || '', pmId: p.project.pmId });
    if (conv) {
      const ids = Array.from(new Set([p.actor.id, p.project.pmId, ...(p.memberIds || [])].filter(Boolean) as string[]));
      ids.forEach(mid => addMemberToConversation(conv.id, mid));
    }
    const ctx = entityContext(p.relatedEntity);
    // Ảnh/tệp đính kèm hiện NGAY TRONG nhật ký (kèm lối tắt mở nhiệm vụ) thay vì gửi tin có ảnh vào nhóm chat.
    // Tệp còn ở dạng base64 (upload lên kho thất bại → lưu cục bộ) không đưa vào nhật ký được (quá nặng) → vẫn gửi nhóm chat như cũ.
    const atts = p.attachments || [];
    const hasInline = atts.some(a => String(a.url || '').startsWith('data:'));
    const evAtts = atts.filter(a => a.url && !String(a.url).startsWith('data:')).map(a => ({ id: a.id, type: a.type, name: a.name, url: a.url }));
    const logged = await recordProjectEventFromMessage(p.content, {
      projectId: p.project.id,
      actor: { id: p.actor.id, name: p.actor.name },
      taskId: p.taskId ?? ctx.taskId, missionId: p.missionId ?? ctx.missionId,
      type: p.type, objKind: p.objKind ?? ctx.objKind, objName: p.objName, from: p.from, to: p.to,
      attachments: evAtts.length ? evAtts : undefined,
    });
    if ((!logged || p.alsoChat || hasInline) && conv) {
      await sendGroupChatMessage({
        conversationId: conv.id, senderId: p.actor.id, senderName: p.actor.name, senderRole: p.actor.role,
        content: p.content, relatedEntity: p.relatedEntity, attachments: p.attachments,
      });
    }
  } catch { /* thông báo không bao giờ làm hỏng thao tác chính */ }
}
