-- =============================================================================
-- Migration: unread_counts + last_message trên conversations
-- Chạy trong Supabase Dashboard > SQL Editor
-- =============================================================================
-- BUG CŨ: cột unread_count là 1 SỐ DÙNG CHUNG cho cả hội thoại (không tách
-- theo từng thành viên). Hệ quả:
--   - Trong nhóm chat, 1 người mở đọc → unread_count = 0 → badge "chưa đọc"
--     của TẤT CẢ thành viên khác cũng bị xóa theo, dù họ chưa xem.
--   - Khi đang mở sẵn 1 hội thoại và có tin mới tới, hệ thống cố tình không
--     reset unread_count (tránh vòng lặp) → badge báo sai "chưa đọc" dù đang
--     xem trực tiếp.
-- Đồng thời "tin nhắn cuối" trong danh sách hội thoại phải đọc từ cache tin
-- nhắn (chỉ có khi user ĐÃ TỪNG MỞ hội thoại đó trong phiên) → hiển thị rỗng/
-- sai với các hội thoại có tin mới từ người khác mà user chưa mở.
--
-- FIX: đổi sang unread_counts (map jsonb {userId: count}, đếm riêng theo
-- từng thành viên) và denormalize last_message (tin nhắn cuối) ngay trên
-- conversations để danh sách hội thoại không cần tải toàn bộ lịch sử tin
-- nhắn mới hiển thị đúng được.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS unread_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_message jsonb;

COMMENT ON COLUMN public.conversations.unread_counts IS
  'Số tin chưa đọc THEO TỪNG userId. Vd: {"emp_001": 2, "emp_002": 0}. Thay thế unread_count (dùng chung, đã lỗi thời).';
COMMENT ON COLUMN public.conversations.last_message IS
  'Tin nhắn cuối cùng, denormalize để hiển thị danh sách hội thoại không cần tải lịch sử tin nhắn. Vd: {"content":"...","senderId":"...","senderName":"...","createdAt":"...","deleted":false}';

-- Backfill last_message từ tin nhắn cuối cùng hiện có của mỗi hội thoại.
UPDATE public.conversations c
SET last_message = sub.msg
FROM (
  SELECT DISTINCT ON (conversation_id)
    conversation_id,
    jsonb_build_object(
      'content', content,
      'senderId', sender_id,
      'senderName', sender_name,
      'createdAt', created_at,
      'deleted', COALESCE(deleted, false)
    ) AS msg
  FROM public.chat_messages
  ORDER BY conversation_id, created_at DESC
) sub
WHERE sub.conversation_id = c.id;

-- Cột unread_count cũ được GIỮ LẠI (không xóa, tránh phá vỡ dữ liệu/tương
-- thích ngược) nhưng KHÔNG còn được code mới đọc/ghi.
COMMENT ON COLUMN public.conversations.unread_count IS
  'DEPRECATED — dùng chung cho cả hội thoại, đã lỗi thời. Xem unread_counts (theo từng user).';

-- Verify:
-- SELECT id, name, unread_counts, last_message FROM public.conversations LIMIT 10;
