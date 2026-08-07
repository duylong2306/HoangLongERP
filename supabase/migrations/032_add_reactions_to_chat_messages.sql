-- =============================================================================
-- Migration 032: Thêm cột reactions vào chat_messages cho tính năng thả tim
-- (double-tap trên mobile / click chuột phải trên desktop / gesture trả lời)
-- Chạy trong Supabase Dashboard > SQL Editor
-- =============================================================================

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS reactions jsonb;

COMMENT ON COLUMN public.chat_messages.reactions IS
  'Phản ứng cảm xúc trên tin nhắn. Dạng JSON array: [{"emoji":"❤️","users":["emp_001","emp_002"]}]';

-- Verify:
-- SELECT id, reactions FROM public.chat_messages WHERE reactions IS NOT NULL LIMIT 5;
