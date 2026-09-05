import { Conversation, ChatMessage, ChatAttachment } from '../types';
import { getSupabase } from './supabase';
import { buildPushUrl } from './pushDeepLink';

// =====================================================================
// KIẾN TRÚC SUPABASE-ONLY + IN-MEMORY CACHE
// ---------------------------------------------------------------------
// - Dữ liệu được lưu trên Supabase (nguồn sự thật duy nhất).
// - Module-level in-memory cache (conversationsCache, messagesCache) làm
//   nguồn đọc-nhanh đồng bộ cho các component UI.
// - Khi mount: loadConversationsFromCloud() / loadMessagesFromCloud()
//   kéo dữ liệu về cache.
// - Realtime: subscribeConversations() / subscribeMessages() nhận
//   push từ Supabase, hydrate lại cache.
// - Mọi thao tác ghi đều upsert lên Supabase + cập nhật cache.
// =====================================================================

// ─── In-memory cache ──────────────────────────────────────────────────────
const conversationsCache = new Map<string, Conversation>();
const messagesCache = new Map<string, ChatMessage[]>();

// ─── Mappers: DB (snake_case) ↔ App (camelCase) ─────────────────────────────

// currentUserId: dùng để "resolve" unreadCount (số chưa đọc CỦA RIÊNG người
// này) từ map unread_counts (theo từng userId) lưu trên Supabase — thay cho
// cột unread_count cũ dùng chung cho cả hội thoại (1 người đọc xóa badge của
// tất cả). unreadCounts (map đầy đủ) vẫn được giữ lại trên object để các hàm
// ghi (addMessage, markConversationRead...) có dữ liệu gốc mà cập nhật.
function convFromRow(r: any, currentUserId?: string): Conversation {
  const rawCounts: Record<string, number> =
    r.unread_counts && typeof r.unread_counts === 'object' ? r.unread_counts : {};
  return {
    id: r.id,
    type: r.type,
    name: r.name,
    avatar: r.avatar ?? '',
    color: r.color ?? '#2AABEE',
    participantIds: Array.isArray(r.participant_ids) ? r.participant_ids : [],
    createdBy: r.created_by,
    createdAt: r.created_at,
    lastMessageAt: r.last_message_at ?? undefined,
    unreadCount: currentUserId ? (rawCounts[currentUserId] || 0) : 0,
    unreadCounts: rawCounts,
    lastMessage: r.last_message ?? undefined,
    taskId: r.task_id ?? undefined,
    projectId: r.project_id ?? undefined,
    pinned: r.pinned ?? false,
  };
}

function convToRow(c: Conversation): any {
  return {
    id: c.id,
    type: c.type,
    name: c.name,
    avatar: c.avatar,
    color: c.color,
    participant_ids: c.participantIds,
    created_by: c.createdBy,
    created_at: c.createdAt,
    last_message_at: c.lastMessageAt ?? null,
    unread_counts: c.unreadCounts ?? {},
    last_message: c.lastMessage ?? null,
    task_id: c.taskId ?? null,
    project_id: c.projectId ?? null,
    pinned: c.pinned ?? false,
  };
}

function msgFromRow(r: any): ChatMessage {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    senderId: r.sender_id,
    senderName: r.sender_name,
    senderRole: r.sender_role ?? undefined,
    content: r.content,
    createdAt: r.created_at,
    read: r.read ?? false,
    attachments: r.attachments ?? undefined,
    system: r.system ?? false,
    edited: r.edited ?? false,
    editedAt: r.edited_at ?? undefined,
    deleted: r.deleted ?? false,
    deletedAt: r.deleted_at ?? undefined,
    pinned: r.pinned ?? false,
    replyTo: r.reply_to ?? undefined,
    mentions: r.mentions ?? undefined,
    reactions: r.reactions ?? undefined,
    readBy: r.read_by ?? undefined,
    relatedEntity: r.related_entity ? JSON.parse(r.related_entity) : undefined,
  };
}

function msgToRow(m: ChatMessage): any {
  const row: any = {
    id: m.id,
    conversation_id: m.conversationId,
    sender_id: m.senderId,
    sender_name: m.senderName,
    sender_role: m.senderRole ?? null,
    content: m.content,
    created_at: m.createdAt,
    read: m.read ?? false,
    attachments: m.attachments ?? [],
    system: m.system ?? false,
    edited: m.edited ?? false,
    edited_at: m.editedAt ?? null,
    deleted: m.deleted ?? false,
    deleted_at: m.deletedAt ?? null,
    pinned: m.pinned ?? false,
    reply_to: m.replyTo ?? null,
    mentions: m.mentions ?? null,
    reactions: m.reactions ?? [],
    read_by: m.readBy ?? [],
  };
  // CHỈ gửi related_entity khi có giá trị. Cột này có thể CHƯA tồn tại trên một
  // số project Supabase (chưa chạy migration 035). Gửi `related_entity: null`
  // vào cột không tồn tại → PostgREST trả 400 "Could not find the
  // 'related_entity' column" và TOÀN BỘ insert tin nhắn thất bại (tin nhắn
  // không được lưu, dù conversation vẫn cập nhật last_message_at). Omit key này
  // khi rỗng để tin nhắn thường gửi được ngay cả khi chưa có cột.
  if (m.relatedEntity) {
    row.related_entity = JSON.stringify(m.relatedEntity);
  }
  return row;
}

// ─── Sync cache accessors (đọc/ghi in-memory, interface giữ nguyên) ────────

export function getConversations(): Conversation[] {
  return Array.from(conversationsCache.values());
}

export function saveConversations(convs: Conversation[]): void {
  conversationsCache.clear();
  convs.forEach(c => conversationsCache.set(c.id, c));
}

export function getMessages(conversationId: string): ChatMessage[] {
  return messagesCache.get(conversationId) || [];
}

export function saveMessages(conversationId: string, msgs: ChatMessage[]): void {
  messagesCache.set(conversationId, msgs);
}

// ─── Supabase push (internal) ─────────────────────────────────────────────

async function pushConversation(conv: Conversation): Promise<any | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { error } = await sb.from('conversations').upsert(convToRow(conv));
  if (error) {
    console.error('pushConversation error:', error.message);
    return error;
  }
  return null;
}

async function pushMessage(msg: ChatMessage): Promise<any | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { error } = await sb.from('chat_messages').insert(msgToRow(msg));
  if (error) {
    console.error('pushMessage error:', error.message);
    return error;
  }
  return null;
}

// ─── Conversation CRUD (async + cache) ────────────────────────────────────

// Tìm hoặc tạo hội thoại personal (1-1)
export async function getOrCreatePersonalConversation(
  userId1: string, userId2: string,
  user1Name: string, user2Name: string,
): Promise<Conversation> {
  const convs = getConversations();
  const existing = convs.find(c =>
    c.type === 'personal' &&
    c.participantIds.includes(userId1) &&
    c.participantIds.includes(userId2)
  );
  if (existing) return existing;

  const newConv: Conversation = {
    id: `conv_personal_${userId1}_${userId2}`,
    type: 'personal',
    name: user2Name,
    avatar: user2Name.substring(0, 2).toUpperCase(),
    color: '#2AABEE',
    participantIds: [userId1, userId2],
    createdBy: userId1,
    createdAt: new Date().toISOString(),
    unreadCount: 0,
    pinned: true,
  };

  conversationsCache.set(newConv.id, newConv);
  await pushConversation(newConv);
  return newConv;
}

// Tìm hoặc tạo hội thoại cá nhân (1-1) — bản gói gọn, an toàn với dữ liệu rỗng.
// Dùng chung cho mọi luồng "xét duyệt → hội thoại cá nhân" trong app.
export async function getOrCreateDirectConv(
  userId1: string, userId2: string,
  user1Name: string, user2Name: string,
): Promise<Conversation | null> {
  if (!userId1 || !userId2 || userId1 === userId2) return null;
  return getOrCreatePersonalConversation(userId1, userId2, user1Name, user2Name);
}

// Tra cứu nhân viên theo TÊN — nhiều đơn (nghỉ phép, phiếu chi) chỉ lưu tên
// người duyệt/đề xuất ("Trương Hữu Long (Giám đốc)"), cần ánh xạ sang ID để
// dựng hội thoại cá nhân. Ưu tiên khớp chính xác, rồi bỏ phần chức danh.
export function findEmployeeByName(
  employees: { id: string; name?: string }[],
  name?: string | null,
): { id: string; name?: string } | undefined {
  if (!name) return undefined;
  const trimmed = String(name).trim();
  if (!trimmed) return undefined;
  const exact = employees.find(e => e.name === trimmed);
  if (exact) return exact;
  const base = trimmed.split('(')[0].trim();
  return (
    employees.find(e => e.name === base) ||
    employees.find(e => e.name?.includes(base)) ||
    employees.find(e => e.name && base.includes(e.name))
  );
}

// ─── Xét duyệt → hội thoại cá nhân ─────────────────────────────────────────
// Gửi một tin nhắn xét duyệt giữa 2 người (người khởi tạo ↔ người duyệt).
// Tự tìm/tạo hội thoại cá nhân 2 chiều rồi gửi tin kèm deep-link thực thể.
export async function sendApprovalDirectMessage(params: {
  senderId: string;
  senderName: string;
  senderRole?: string;
  recipientId: string;
  recipientName: string;
  content: string;
  relatedEntity?: ChatMessage['relatedEntity'];
}): Promise<ChatMessage | null> {
  if (!params.senderId || !params.recipientId || params.senderId === params.recipientId) return null;
  const conv = await getOrCreateDirectConv(params.senderId, params.recipientId, params.senderName, params.recipientName);
  if (!conv) return null;
  return addMessage({
    conversationId: conv.id,
    senderId: params.senderId,
    senderName: params.senderName,
    senderRole: (params.senderRole || 'member') as any,
    content: params.content,
    system: false,
    relatedEntity: params.relatedEntity,
  });
}

// Tạo hội thoại nhóm
export async function createGroupConversation(
  name: string, memberIds: string[], createdBy: string,
  taskId?: string, projectId?: string
): Promise<Conversation> {
  const colors = ['#2AABEE','#E74C3C','#27AE60','#F39C12','#8E44AD','#16A085'];
  const newConv: Conversation = {
    id: taskId ? `conv_task_${taskId}` : `conv_group_${Date.now()}`,
    type: taskId ? 'task' : 'group',
    name,
    avatar: name.substring(0, 2).toUpperCase(),
    color: colors[Math.floor(Math.random() * colors.length)],
    participantIds: memberIds,
    createdBy,
    createdAt: new Date().toISOString(),
    unreadCount: 0,
    taskId,
    projectId,
    pinned: true,
  };

  conversationsCache.set(newConv.id, newConv);
  await pushConversation(newConv);
  return newConv;
}

/**
 * Tự động tạo (hoặc đồng bộ) NHÓM CHAT DỰ ÁN mỗi khi một dự án được khởi tạo.
 * - id xác định: conv_project_<projectId> → idempotent, không tạo trùng lặp.
 * - Thành viên: pmId của dự án.
 * - Nếu nhóm đã tồn tại, đồng bộ thêm thành viên mới (không xóa ai).
 */
export async function ensureProjectChatGroup(
  project: { id: string; name: string; pmId?: string }
): Promise<Conversation | null> {
  if (!project || !project.id) return null;

  const convId = `conv_project_${project.id}`;
  const existing = conversationsCache.get(convId);

  const memberIds = Array.from(new Set(
    [project.pmId].filter(Boolean) as string[]
  ));

  if (existing) {
    // Đồng bộ thành viên mới (không xóa ai đã có)
    const missing = memberIds.filter(id => !existing.participantIds.includes(id));
    if (missing.length === 0) return existing;
    const updated = {
      ...existing,
      participantIds: [...existing.participantIds, ...missing],
    };
    conversationsCache.set(convId, updated);
    await pushConversation(updated);
    return updated;
  }

  const colors = ['#2AABEE','#E74C3C','#27AE60','#F39C12','#8E44AD','#16A085'];
  const newConv: Conversation = {
    id: convId,
    type: 'group',
    name: `📁 ${project.name}`,
    avatar: (project.name || 'DA').substring(0, 2).toUpperCase(),
    color: colors[Math.floor(Math.random() * colors.length)],
    participantIds: memberIds,
    createdBy: project.pmId || '',
    createdAt: new Date().toISOString(),
    unreadCount: 0,
    projectId: project.id,
    pinned: true,
  };

  conversationsCache.set(convId, newConv);
  await pushConversation(newConv);
  return newConv;
}

/**
 * Gửi một tin nhắn vào một nhóm chat bất kỳ — truyền sẵn MÃ NHÓM CHAT
 * để đảm bảo tin nhắn đến đúng nhóm (ví dụ NHÓM CHAT DỰ ÁN: conv_project_<projectId>).
 *
 * @param conversationId - Mã cuộc hội thoại đích, VD: `conv_project_${project.id}`
 * @param senderId       - ID người gửi
 * @param senderName     - Tên người gửi (hiển thị trong tin nhắn)
 * @param senderRole     - Vai trò người gửi (tuỳ chọn)
 * @param content        - Nội dung tin nhắn (tùy biến tự do)
 * @param relatedEntity  - Thực thể liên quan để điều hướng (task, project, mission)
 * @returns Tin nhắn vừa tạo, hoặc null nếu nhóm chat không tồn tại
 */
export async function sendGroupChatMessage(params: {
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole?: string;
  content: string;
  relatedEntity?: ChatMessage['relatedEntity'];
  attachments?: ChatAttachment[];
}): Promise<ChatMessage | null> {
  // Chỉ gửi khi nhóm chat thực sự tồn tại
  const exists = getConversations().some(c => c.id === params.conversationId);
  if (!exists) return null;

  return await addMessage({
    conversationId: params.conversationId,
    senderId: params.senderId,
    senderName: params.senderName,
    senderRole: (params.senderRole || 'member') as any,
    content: params.content,
    system: false,
    relatedEntity: params.relatedEntity,
    attachments: params.attachments,
  });
}

export async function deleteConversation(convId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error: msgErr } = await sb.from('chat_messages').delete().eq('conversation_id', convId);
  if (msgErr) console.error('delete messages error:', msgErr.message);
  const { error: convErr } = await sb.from('conversations').delete().eq('id', convId);
  if (convErr) console.error('delete conversation error:', convErr.message);
  conversationsCache.delete(convId);
  messagesCache.delete(convId);
}

// Thêm thành viên vào hội thoại nhóm
export async function addMemberToConversation(convId: string, memberId: string): Promise<Conversation | null> {
  const conv = conversationsCache.get(convId);
  if (!conv) return null;
  if (conv.type === 'personal') return null;
  if (conv.participantIds.includes(memberId)) return conv;

  const updatedConv = {
    ...conv,
    participantIds: [...conv.participantIds, memberId],
  };

  conversationsCache.set(convId, updatedConv);
  await pushConversation(updatedConv);
  return updatedConv;
}

// ─── Nhóm chat "Điểm danh" ─────────────────────────────────────────────────
// Nhóm chat ĐIỂM DANH (id cố định `conv_attendance`): người chấm công ĐẦU TIÊN
// trong mỗi ca (Vào/Ra sáng, Vào/Ra chiều) khiến Hệ Thống gửi 1 tin nhắc vào
// nhóm. Việc chọn "người đầu tiên" dùng RPC server-side atomic
// (INSERT ON CONFLICT DO NOTHING) → chống race khi nhiều người cùng bấm.
export const ATTENDANCE_CONV_ID = 'conv_attendance';

// Nội dung tin theo 4 slot (BỎ QUA tăng ca timeInOT/timeOutOT).
export const ATTENDANCE_CHAT_CONTENT: Record<string, string> = {
  timeInS: '⏰ Đến giờ check-in rồi mọi người!',
  timeOutS: '⏰ Đến giờ check-out rồi mọi người!',
  timeInC: '⏰ Đến giờ check-in (chiều) rồi mọi người!',
  timeOutC: '⏰ Đến giờ check-out (chiều) rồi mọi người!',
};

/**
 * Tự động tạo (idempotent) nhóm chat "Điểm danh". Thành viên = toàn bộ nhân
 * viên có tài khoản hệ thống (hasSystemAccount). Nếu nhóm đã tồn tại, đồng bộ
 * thêm thành viên mới (không xóa ai).
 */
export async function ensureAttendanceChatGroup(
  employees: { id: string }[]
): Promise<Conversation | null> {
  const memberIds = Array.from(new Set(
    (employees || []).map(e => e.id).filter(Boolean) as string[]
  ));
  if (memberIds.length === 0) return null;

  const existing = conversationsCache.get(ATTENDANCE_CONV_ID);
  if (existing) {
    const missing = memberIds.filter(id => !existing.participantIds.includes(id));
    if (missing.length === 0) return existing;
    const updated = { ...existing, participantIds: [...existing.participantIds, ...missing] };
    conversationsCache.set(ATTENDANCE_CONV_ID, updated);
    await pushConversation(updated);
    return updated;
  }

  const newConv: Conversation = {
    id: ATTENDANCE_CONV_ID,
    type: 'group',
    name: 'Điểm danh',
    avatar: 'ĐD',
    color: '#27AE60',
    participantIds: memberIds,
    createdBy: 'system',
    createdAt: new Date().toISOString(),
    unreadCount: 0,
    pinned: true,
  };
  conversationsCache.set(ATTENDANCE_CONV_ID, newConv);
  await pushConversation(newConv);
  return newConv;
}

/**
 * Gọi SAU KHI lưu chấm công thành công cho 1 trong 4 slot chính. Claim "người
 * chấm đầu tiên" qua RPC `claim_attendance_chat` (server-side atomic); chỉ khi
 * trả về row (đúng người đầu tiên, không phải ngày nghỉ) mới gửi tin vào nhóm.
 * Mọi lỗi đều nuốt im lặng — không làm hỏng luồng chấm công.
 */
export async function maybeSendAttendanceChatMessage(params: {
  date: string;   // YYYY-MM-DD
  slot: string;   // timeInS/timeOutS/timeInC/timeOutC
  empId: string;
  empName: string;
}): Promise<void> {
  const content = ATTENDANCE_CHAT_CONTENT[params.slot];
  if (!content) return; // bỏ qua tăng ca & slot không thuộc 4 ca chính

  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { data, error } = await supabase.rpc('claim_attendance_chat', {
      p_date: params.date,
      p_slot: params.slot,
      p_emp_id: params.empId,
    });
    if (error) {
      console.warn('claim_attendance_chat error:', error.message);
      return;
    }
    // Chỉ người chấm ĐẦU TIÊN (RPC trả về 1 row) mới gửi tin nhắc
    if (!Array.isArray(data) || data.length === 0) return;

    await ensureAttendanceChatGroup([{ id: params.empId }]);
    await addMessage({
      conversationId: ATTENDANCE_CONV_ID,
      senderId: 'system',
      senderName: 'Hệ Thống',
      senderRole: 'system' as any,
      content,
      system: true,
    });
  } catch (err) {
    console.warn('maybeSendAttendanceChatMessage error (ignored):', err);
  }
}

// ─── Messages CRUD (async + cache) ────────────────────────────────────────

export async function addMessage(msg: Omit<ChatMessage, 'id' | 'createdAt' | 'read'>): Promise<ChatMessage> {
  const newMsg: ChatMessage = {
    ...msg,
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    createdAt: new Date().toISOString(),
    read: false,
  };

  // Update cache — KHÔNG increment unreadCount cho người gửi
  const existing = messagesCache.get(msg.conversationId) || [];
  messagesCache.set(msg.conversationId, [...existing, newMsg]);

  const conv = conversationsCache.get(msg.conversationId);
  if (conv) {
    conversationsCache.set(msg.conversationId, {
      ...conv,
      lastMessageAt: newMsg.createdAt,
      // Không tăng unreadCount — tin nhắn của chính mình không tính là chưa đọc
    });
  }

  // Đảm bảo conversation tồn tại trên cloud TRƯỚC KHI insert message.
  // chat_messages.conversation_id có FK tới conversations(id) (ON DELETE CASCADE),
  // nên nếu conversation chưa có trên cloud, insert message sẽ lỗi 23503 (foreign
  // key) và — nếu bị swallow — tin nhắn bị MẤT SILENT (hiện tạm rồi biến mất khi
  // reload). Upsert conversation trước để chắc chắn FK target tồn tại.
  if (conv) {
    await pushConversation({ ...conv, lastMessageAt: newMsg.createdAt });
  }

  // Push message lên Supabase. Nếu lỗi FK (conversation chưa kịp có trên cloud do
  // race / push trước thất bại) → upsert lại conversation rồi thử lại 1 lần.
  let pushErr = await pushMessage(newMsg);
  if (
    pushErr &&
    (pushErr.code === '23503' ||
      (pushErr.message || '').toLowerCase().includes('foreign key'))
  ) {
    if (conv) await pushConversation({ ...conv, lastMessageAt: newMsg.createdAt });
    pushErr = await pushMessage(newMsg);
  }
  if (pushErr) console.error('pushMessage failed (tin nhắn có thể không được lưu):', pushErr.message);

  // Push conversation LÊN SUPABASE: +1 vào unread_counts CHO TỪNG THÀNH VIÊN
  // NHẬN (trừ người gửi) — thay vì +1 vào 1 số dùng chung cho cả hội thoại
  // (bug cũ: người này đọc thì badge của người khác cũng bị xóa theo). Đồng
  // thời denormalize lastMessage để danh sách hội thoại hiển thị đúng tin
  // nhắn cuối mà không cần tải lịch sử tin nhắn (messagesCache) của hội
  // thoại đó trong phiên hiện tại.
  let convForPush = conv;
  if (conv) {
    const nextCounts: Record<string, number> = { ...(conv.unreadCounts || {}) };
    (conv.participantIds || []).forEach(uid => {
      if (uid !== msg.senderId) nextCounts[uid] = (nextCounts[uid] || 0) + 1;
    });
    convForPush = {
      ...conv,
      lastMessageAt: newMsg.createdAt,
      unreadCounts: nextCounts,
      unreadCount: nextCounts[msg.senderId] || 0, // luôn 0 cho chính người gửi
      lastMessage: {
        content: newMsg.content,
        senderId: newMsg.senderId,
        senderName: newMsg.senderName,
        createdAt: newMsg.createdAt,
        deleted: false,
      },
    };
    conversationsCache.set(msg.conversationId, convForPush);
    await pushConversation(convForPush);
  }

  // 🔔 Gửi Web Push cho người nhận (khi app đóng / background)
  // Gọi async, không block UI. Bỏ qua lỗi nếu Supabase chưa cấu hình.
  notifyChatPush(newMsg, convForPush);

  return newMsg;
}

// ─── Web Push bridge ────────────────────────────────────────────────────────

/**
 * Gửi push notification đến các participant của cuộc hội thoại (trừ người gửi)
 * qua Supabase Edge Function send-push.
 */
async function notifyChatPush(msg: ChatMessage, conv?: Conversation): Promise<void> {
  try {
    const supabase = getSupabase();
    if (!supabase || !conv) return;

    const recipientIds = (conv.participantIds || []).filter(id => id !== msg.senderId);
    if (!recipientIds.length) return;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    if (!supabaseUrl || !supabaseAnonKey) return;

    const res = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        userIds: recipientIds,
        title: msg.senderName || 'Tin nhắn mới',
        body: msg.content,
        data: {
          // ⚠️ TRƯỚC ĐÂY: '/messages?conversation=...'. Host phục vụ file tĩnh và
          // KHÔNG có SPA fallback → mở '/messages' trả về 404 (rõ nhất trên điện
          // thoại, vì app thường đã đóng nên service worker phải mở tab mới).
          // Nay dùng buildPushUrl → '/?conversation=...' (luôn là đường dẫn gốc).
          url: buildPushUrl({ conversationId: conv.id }),
          type: 'chat.message',
          conversationId: conv.id,
          senderId: msg.senderId,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn('Chat Web Push failed:', res.status, text);
    }
  } catch (err) {
    console.warn('Chat Web Push error (ignored):', err);
  }
}

// Guard: đánh dấu đã đọc chỉ khi chưa đọc
let _lastMarkReadTime: Record<string, number> = {};
const MARK_READ_DEBOUNCE_MS = 1000; // Tối thiểu 1 giây giữa 2 lần gọi liên tiếp cho cùng 1 hội thoại

// Đánh dấu đã đọc CHO RIÊNG userId (chỉ set unread_counts[userId] = 0) — không
// đụng đến key của các thành viên khác trong cùng hội thoại (bug cũ: dùng 1
// cột unread_count chung, 1 người đọc xóa badge của tất cả).
export async function markConversationRead(convId: string, userId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;

  // Guard: nếu unreadCount của CHÍNH userId này đã = 0 trong cache thì bỏ qua
  const conv = conversationsCache.get(convId);
  if (conv && (conv.unreadCounts?.[userId] || 0) === 0) return;

  // Guard debounce: không gọi lại trong vòng 1 giây (theo từng cặp hội thoại+user)
  const debounceKey = `${convId}_${userId}`;
  const now = Date.now();
  if (_lastMarkReadTime[debounceKey] && now - _lastMarkReadTime[debounceKey] < MARK_READ_DEBOUNCE_MS) return;
  _lastMarkReadTime[debounceKey] = now;

  // Update cache trước để tránh race condition
  const nextCounts = { ...(conv?.unreadCounts || {}), [userId]: 0 };
  if (conv) conversationsCache.set(convId, { ...conv, unreadCounts: nextCounts, unreadCount: 0 });

  const { error: convErr } = await sb.from('conversations').update({ unread_counts: nextCounts }).eq('id', convId);
  if (convErr) console.error('markConversationRead error:', convErr.message);
  const { error: msgErr } = await sb.from('chat_messages').update({ read: true }).eq('conversation_id', convId);
  if (msgErr) console.error('mark messages read error:', msgErr.message);
}

// Đánh dấu "đã xem" (read_by) cho các tin do NGƯỜI KHÁC gửi trong hội thoại.
// Chỉ ghi 1 lần/user/tin; tin tự gửi không ghi. Dùng cho cơ chế hiển thị "người đã xem".
export async function markMessagesReadByUser(convId: string, userId: string): Promise<void> {
  const sb = getSupabase();
  const msgs = messagesCache.get(convId) || [];
  const toMark = msgs.filter(m =>
    m.senderId !== userId &&
    !(m.readBy || []).includes(userId) &&
    !m.deleted
  );
  if (toMark.length === 0) return;

  // Update cache trước
  const byId = new Map(toMark.map(m => [m.id, m]));
  messagesCache.set(convId, msgs.map(m => {
    if (!byId.has(m.id)) return m;
    const readBy = [...(m.readBy || []), userId];
    return { ...m, readBy };
  }));

  // Update Supabase (mỗi tin 1 update với read_by mới)
  if (sb) {
    for (const m of toMark) {
      const next = [...(m.readBy || []), userId];
      const { error } = await sb.from('chat_messages')
        .update({ read_by: next })
        .eq('id', m.id);
      if (error) { console.error('markMessagesReadByUser error:', error.message); break; }
    }
  }
}

// Lấy hội thoại của user (filter theo participantIds)
export function getUserConversations(convs: Conversation[], userId: string): Conversation[] {
  return convs
    .filter(c => c.participantIds.includes(userId))
    .sort((a, b) => (b.lastMessageAt || b.createdAt).localeCompare(a.lastMessageAt || a.createdAt));
}

export function getConversationUnreadCount(convs: Conversation[], userId: string): number {
  return getUserConversations(convs, userId)
    .reduce((sum, c) => sum + (c.unreadCount || 0), 0);
}

// Kiểm tra user có tham gia hội thoại không
export function isUserInConversation(convs: Conversation[], userId: string, conversationId: string): boolean {
  const conv = convs.find(c => c.id === conversationId);
  return conv ? conv.participantIds.includes(userId) : false;
}

// Tìm kiếm tin nhắn trong hội thoại
export function searchMessagesInConversation(msgs: ChatMessage[], query: string): ChatMessage[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return msgs.filter(m =>
    m.content.toLowerCase().includes(q) ||
    m.senderName.toLowerCase().includes(q)
  );
}

// Cập nhật tin nhắn (edit)
export async function updateMessage(conversationId: string, messageId: string, newContent: string): Promise<ChatMessage | null> {
  const msgs = messagesCache.get(conversationId) || [];
  const idx = msgs.findIndex(m => m.id === messageId);
  if (idx === -1) return null;

  const updated: ChatMessage = {
    ...msgs[idx],
    content: newContent,
    edited: true,
    editedAt: new Date().toISOString(),
  };

  // Update cache
  const newMsgs = [...msgs];
  newMsgs[idx] = updated;
  messagesCache.set(conversationId, newMsgs);

  // Update lastMessageAt if this was the last message
  if (idx === msgs.length - 1) {
    const conv = conversationsCache.get(conversationId);
    if (conv) {
      conversationsCache.set(conversationId, { ...conv, lastMessageAt: updated.editedAt! });
    }
  }

  // Push to Supabase
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from('chat_messages')
      .update({ content: newContent, edited: true, edited_at: updated.editedAt })
      .eq('id', messageId);
    if (error) console.error('updateMessage error:', error.message);
  }

  return updated;
}

// Xóa tin nhắn (soft delete - ẩn nội dung)
export async function softDeleteMessage(conversationId: string, messageId: string): Promise<boolean> {
  const deletedAt = new Date().toISOString();

  // Update cache
  const msgs = messagesCache.get(conversationId) || [];
  messagesCache.set(conversationId, msgs.map(m =>
    m.id === messageId ? { ...m, content: '🗑️ Tin nhắn này đã bị xóa', deleted: true, deletedAt } : m
  ));

  // Push to Supabase
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from('chat_messages')
      .update({ content: '🗑️ Tin nhắn này đã bị xóa', deleted: true, deleted_at: deletedAt })
      .eq('id', messageId);
    if (error) console.error('softDeleteMessage error:', error.message);
  }
  return true;
}

// Gắn tin nhắn (pin/unpin)
export async function togglePinMessage(conversationId: string, messageId: string): Promise<ChatMessage | null> {
  const msgs = messagesCache.get(conversationId) || [];
  const idx = msgs.findIndex(m => m.id === messageId);
  if (idx === -1) return null;

  const updated: ChatMessage = {
    ...msgs[idx],
    pinned: !msgs[idx].pinned,
  };

  const newMsgs = [...msgs];
  newMsgs[idx] = updated;
  messagesCache.set(conversationId, newMsgs);

  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from('chat_messages').update({ pinned: updated.pinned }).eq('id', messageId);
    if (error) console.error('togglePinMessage error:', error.message);
  }
  return updated;
}

// Thả/bỏ thả tim (hoặc emoji) vào tin nhắn — toggle theo userId
export async function toggleMessageReaction(
  conversationId: string,
  messageId: string,
  userId: string,
  emoji: string
): Promise<ChatMessage | null> {
  const msgs = messagesCache.get(conversationId) || [];
  const idx = msgs.findIndex(m => m.id === messageId);
  if (idx === -1) return null;

  const reactions = [...(msgs[idx].reactions ?? [])];
  const groupIdx = reactions.findIndex(g => g.emoji === emoji);
  let hasEmoji = false;

  if (groupIdx === -1) {
    // Emoji chưa có → tạo nhóm mới với user hiện tại
    reactions.push({ emoji, users: [userId] });
    hasEmoji = true;
  } else {
    const users = reactions[groupIdx].users;
    if (users.includes(userId)) {
      // Đã thả rồi → gỡ user; nếu hết user thì xóa nhóm emoji
      const nextUsers = users.filter(u => u !== userId);
      if (nextUsers.length === 0) reactions.splice(groupIdx, 1);
      else reactions[groupIdx] = { emoji, users: nextUsers };
    } else {
      reactions[groupIdx] = { emoji, users: [...users, userId] };
      hasEmoji = true;
    }
  }

  const updated: ChatMessage = {
    ...msgs[idx],
    reactions,
  };

  // Update cache
  const newMsgs = [...msgs];
  newMsgs[idx] = updated;
  messagesCache.set(conversationId, newMsgs);

  // Push to Supabase
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from('chat_messages')
      .update({ reactions })
      .eq('id', messageId);
    if (error) console.error('toggleMessageReaction error:', error.message);
  }
  return updated;
}

export async function deleteMessageFromConversation(convId: string, msgId: string): Promise<void> {
  // Update cache
  const msgs = messagesCache.get(convId) || [];
  messagesCache.set(convId, msgs.filter(m => m.id !== msgId));

  // Push to Supabase
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from('chat_messages').delete().eq('id', msgId);
  if (error) console.error('deleteMessage error:', error.message);
}

// ─── Cloud sync: load + realtime ────────────────────────────────────────────

/** Kéo tất cả hội thoại từ Supabase về cache. */
export async function loadConversationsFromCloud(userId?: string): Promise<Conversation[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    let query = sb.from('conversations').select('*');
    if (userId) {
      query = query.contains('participant_ids', [userId]);
    }
    const { data, error } = await query;
    if (error) {
      console.error('loadConversationsFromCloud error:', error.message);
      return [];
    }
    // unreadCount được resolve THEO userId ngay từ unread_counts (map theo
    // từng người) — người gửi tin nhắn của chính mình không bao giờ được +1
    // vào key của họ (xem addMessage), nên không cần zero-out thủ công như
    // cách cũ (dò tin nhắn cuối trong cache để đoán "có phải mình gửi không").
    const convs = (data || []).map(r => convFromRow(r, userId));

    saveConversations(convs);
    return convs;
  } catch (e) {
    console.error('loadConversationsFromCloud exception:', e);
    return [];
  }
}

/** Kéo tin nhắn của 1 hội thoại từ Supabase về cache. */
// Biên giới cũ nhất (ISO) đã được load cho mỗi hội thoại. Dùng để realtime
// reload chỉ trong cửa sổ đang mở (không load lại toàn bộ tin nhắn).
const _loadedFromIso = new Map<string, string>();

/**
 * Tải tin nhắn từ cloud. Mặc định (không có opts) tải TẤT CẢ (giữ tương thích
 * ngược). Khi truyền opts.fromIso, chỉ tải tin nhắn có created_at >= fromIso
 * (cửa sổ theo ngày) → làm nhẹ app, không load 1 lần toàn bộ lịch sử.
 *
 * Kết quả được MERGE (union theo id) vào cache thay vì ghi đè, để các lần load
 * cũ hơn (vuốt lên) cộng dồn chứ không đè mất tin cũ đã có.
 */
export async function loadMessagesFromCloud(
  conversationId: string,
  opts?: { fromIso?: string },
): Promise<ChatMessage[]> {
  const sb = getSupabase();
  if (!sb) return getMessages(conversationId);
  try {
    let query = sb
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId);
    if (opts?.fromIso) query = query.gte('created_at', opts.fromIso);
    query = query.order('created_at', { ascending: true });
    const { data, error } = await query;
    if (error) {
      console.error('loadMessagesFromCloud error:', error.message);
      return getMessages(conversationId);
    }
    const msgs = (data || []).map(msgFromRow);

    // Merge union theo id vào cache
    const existing = getMessages(conversationId);
    const byId = new Map<string, ChatMessage>();
    for (const m of existing) byId.set(m.id, m);
    for (const m of msgs) byId.set(m.id, m);
    const merged = Array.from(byId.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    saveMessages(conversationId, merged);

    // Ghi nhớ biên cũ nhất để realtime reload đúng cửa sổ
    if (opts?.fromIso) {
      const prev = _loadedFromIso.get(conversationId);
      if (!prev || opts.fromIso < prev) _loadedFromIso.set(conversationId, opts.fromIso);
    }
    return merged;
  } catch (e) {
    console.error('loadMessagesFromCloud exception:', e);
    return getMessages(conversationId);
  }
}

/**
 * Subscribe realtime cho danh sách hội thoại.
 * Hỗ trợ N callback (multi-component): channel chỉ subscribe 1 lần duy nhất.
 * Khi unsubscribe callback cuối → cleanup channel.
 */
let _convChannel: any = null;
let _convCallbacks: Set<() => void> = new Set();
let _convUserId: string | null = null;
// ── Tự phục hồi khi kênh "chết êm" (tab để lâu/máy ngủ/đổi mạng) ───────────
// Trước đây .subscribe() không có callback trạng thái — nếu WebSocket chết
// êm, tab đó VĨNH VIỄN không nhận thêm hội thoại/tin nhắn mới, không log,
// không tự phục hồi (giống lỗi đã sửa ở kênh Realtime chính trong App.tsx,
// nhưng module chat này tách biệt hoàn toàn nên chưa được sửa). Thêm cùng
// pattern: backoff tăng dần, phân biệt đóng chủ động (cleanup) vs bất thường.
let _convReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let _convReconnectAttempts = 0;
let _convIntentionalClose = false;

function createConvChannel(userId: string): any {
  const sb = getSupabase();
  if (!sb) return null;
  _convIntentionalClose = false;
  return sb
    .channel(`conversations_${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' },
      async () => {
        await loadConversationsFromCloud(userId);
        _convCallbacks.forEach(cb => cb());
      })
    .subscribe((status: string, err: any) => {
      if (status === 'SUBSCRIBED') {
        _convReconnectAttempts = 0;
        if (_convReconnectTimer) { clearTimeout(_convReconnectTimer); _convReconnectTimer = null; }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        if (status === 'CLOSED' && _convIntentionalClose) return; // cleanup chủ động — không phải sự cố
        if (err) console.error('[Chat] Kênh conversations lỗi:', status, err);
        if (_convReconnectTimer) clearTimeout(_convReconnectTimer);
        const attempt = _convReconnectAttempts + 1;
        _convReconnectAttempts = attempt;
        const delay = Math.min(3000 * 2 ** (attempt - 1), 30000);
        _convReconnectTimer = setTimeout(() => {
          if (_convCallbacks.size === 0 || !_convUserId) return; // không còn ai lắng nghe
          const sbNow = getSupabase();
          if (sbNow && _convChannel) sbNow.removeChannel(_convChannel);
          _convChannel = createConvChannel(_convUserId);
        }, delay);
      }
    });
}

export function subscribeConversations(userId: string, onChange: () => void): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};

  // Nếu userId khác với channel đang active → cleanup channel cũ
  if (_convChannel && _convUserId !== userId) {
    _convIntentionalClose = true;
    if (_convReconnectTimer) { clearTimeout(_convReconnectTimer); _convReconnectTimer = null; }
    sb.removeChannel(_convChannel);
    _convChannel = null;
    _convCallbacks = new Set();
    _convUserId = null;
    _convReconnectAttempts = 0;
  }

  _convCallbacks.add(onChange);

  // Chỉ subscribe channel 1 lần
  if (!_convChannel) {
    _convUserId = userId;
    _convChannel = createConvChannel(userId);
  }

  // Trả về hàm unsubscribe: xóa callback, cleanup channel nếu không còn callback nào
  return () => {
    _convCallbacks.delete(onChange);
    if (_convCallbacks.size === 0 && _convChannel) {
      _convIntentionalClose = true;
      if (_convReconnectTimer) { clearTimeout(_convReconnectTimer); _convReconnectTimer = null; }
      const sb2 = getSupabase();
      if (sb2) sb2.removeChannel(_convChannel);
      _convChannel = null;
      _convUserId = null;
      _convReconnectAttempts = 0;
    }
  };
}

/**
 * Subscribe realtime cho tin nhắn của 1 hội thoại.
 * Trả về hàm unsubscribe. onChange(messages) được gọi mỗi khi có INSERT mới.
 * CHỈ lắng nghe INSERT — không lắng nghe UPDATE (tránh loop do markConversationRead).
 */
export function subscribeMessages(
  conversationId: string,
  onChange: (msgs: ChatMessage[]) => void
): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};

  // Cùng cơ chế tự phục hồi như subscribeConversations() — kênh này gắn với 1
  // lần gọi cụ thể (1 hội thoại đang mở) nên biến trạng thái để cục bộ trong
  // closure, không cần biến cấp module.
  let channel: any = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempts = 0;
  let intentionalClose = false;

  const handleInsert = async () => {
    // Chỉ reload cửa sổ đã load (từ _loadedFromIso) thay vì toàn bộ lịch sử
    const from = _loadedFromIso.get(conversationId);
    const msgs = await loadMessagesFromCloud(conversationId, from ? { fromIso: from } : undefined);
    onChange(msgs);
  };

  const createChannel = (): any => {
    intentionalClose = false;
    return sb
      .channel(`messages_${conversationId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${conversationId}` },
        handleInsert)
      .subscribe((status: string, err: any) => {
        if (status === 'SUBSCRIBED') {
          reconnectAttempts = 0;
          if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (status === 'CLOSED' && intentionalClose) return;
          if (err) console.error('[Chat] Kênh messages lỗi:', status, err);
          if (reconnectTimer) clearTimeout(reconnectTimer);
          const attempt = reconnectAttempts + 1;
          reconnectAttempts = attempt;
          const delay = Math.min(3000 * 2 ** (attempt - 1), 30000);
          reconnectTimer = setTimeout(() => {
            const sbNow = getSupabase();
            if (sbNow && channel) sbNow.removeChannel(channel);
            channel = createChannel();
          }, delay);
        }
      });
  };

  channel = createChannel();

  return () => {
    intentionalClose = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    sb.removeChannel(channel);
  };
}
