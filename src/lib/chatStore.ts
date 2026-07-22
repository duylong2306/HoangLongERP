import { Conversation, ChatMessage } from '../types';
import { getSupabase } from './supabase';

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

function convFromRow(r: any): Conversation {
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
    unreadCount: r.unread_count ?? 0,
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
    unread_count: c.unreadCount ?? 0,
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
  };
}

function msgToRow(m: ChatMessage): any {
  return {
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
  };
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

async function pushConversation(conv: Conversation) {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from('conversations').upsert(convToRow(conv));
  if (error) console.error('pushConversation error:', error.message);
}

async function pushMessage(msg: ChatMessage) {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from('chat_messages').insert(msgToRow(msg));
  if (error) console.error('pushMessage error:', error.message);
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

// ─── Messages CRUD (async + cache) ────────────────────────────────────────

export async function addMessage(msg: Omit<ChatMessage, 'id' | 'createdAt' | 'read'>): Promise<ChatMessage> {
  const newMsg: ChatMessage = {
    ...msg,
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    createdAt: new Date().toISOString(),
    read: false,
  };

  // Update cache
  const existing = messagesCache.get(msg.conversationId) || [];
  messagesCache.set(msg.conversationId, [...existing, newMsg]);

  const conv = conversationsCache.get(msg.conversationId);
  if (conv) {
    conversationsCache.set(msg.conversationId, {
      ...conv,
      lastMessageAt: newMsg.createdAt,
      unreadCount: (conv.unreadCount || 0) + 1,
    });
  }

  // Push to Supabase
  await pushMessage(newMsg);
  const updatedConv = conversationsCache.get(msg.conversationId);
  if (updatedConv) {
    await pushConversation(updatedConv);
  }

  // 🔔 Gửi Web Push cho người nhận (khi app đóng / background)
  // Gọi async, không block UI. Bỏ qua lỗi nếu Supabase chưa cấu hình.
  notifyChatPush(newMsg, updatedConv);

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
          url: `/messages?conversation=${conv.id}`,
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

export async function markConversationRead(convId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error: convErr } = await sb.from('conversations').update({ unread_count: 0 }).eq('id', convId);
  if (convErr) console.error('markConversationRead error:', convErr.message);
  const { error: msgErr } = await sb.from('chat_messages').update({ read: true }).eq('conversation_id', convId);
  if (msgErr) console.error('mark messages read error:', msgErr.message);

  const conv = conversationsCache.get(convId);
  if (conv) conversationsCache.set(convId, { ...conv, unreadCount: 0 });
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
    const convs = (data || []).map(convFromRow);
    saveConversations(convs);
    return convs;
  } catch (e) {
    console.error('loadConversationsFromCloud exception:', e);
    return [];
  }
}

/** Kéo tin nhắn của 1 hội thoại từ Supabase về cache. */
export async function loadMessagesFromCloud(conversationId: string): Promise<ChatMessage[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('loadMessagesFromCloud error:', error.message);
      return [];
    }
    const msgs = (data || []).map(msgFromRow);
    saveMessages(conversationId, msgs);
    return msgs;
  } catch (e) {
    console.error('loadMessagesFromCloud exception:', e);
    return [];
  }
}

/**
 * Subscribe realtime cho danh sách hội thoại.
 * Trả về hàm unsubscribe. onChange được gọi mỗi khi có thay đổi.
 */
export function subscribeConversations(userId: string, onChange: () => void): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};

  const channel = sb
    .channel(`conversations_${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' },
      async () => {
        await loadConversationsFromCloud(userId);
        onChange();
      })
    .subscribe();

  return () => { sb.removeChannel(channel); };
}

/**
 * Subscribe realtime cho tin nhắn của 1 hội thoại.
 * Trả về hàm unsubscribe. onChange(messages) được gọi mỗi khi có thay đổi.
 */
export function subscribeMessages(
  conversationId: string,
  onChange: (msgs: ChatMessage[]) => void
): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};

  const channel = sb
    .channel(`messages_${conversationId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${conversationId}` },
      async () => {
        const msgs = await loadMessagesFromCloud(conversationId);
        onChange(msgs);
      })
    .subscribe();

  return () => { sb.removeChannel(channel); };
}
