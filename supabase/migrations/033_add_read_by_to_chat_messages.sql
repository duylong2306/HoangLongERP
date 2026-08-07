-- =============================================================================
-- Migration 033: Thêm cột read_by vào chat_messages cho cơ chế "người đã xem"
-- Chạy trong Supabase Dashboard > SQL Editor
-- =============================================================================
-- Khi user mở hội thoại, client ghi userId của mình vào read_by của các tin
-- do người khác gửi (chỉ 1 lần/user/tin). Tin tự gửi sẽ hiển thị avatar của
-- những người đã xem tin đó (giống trạng thái "đã xem" của Zalo/Messenger).

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS read_by jsonb;

COMMENT ON COLUMN public.chat_messages.read_by IS
  'Mảng userId đã xem tin nhắn này. Vd: ["emp_001","emp_002"]. Chỉ ghi cho tin do NGƯỜI KHÁC gửi khi user mở hội thoại.';

-- Verify:
-- SELECT id, sender_id, read_by FROM public.chat_messages WHERE read_by IS NOT NULL AND jsonb_array_length(read_by) > 0 LIMIT 5;
