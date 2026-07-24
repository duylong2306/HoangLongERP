-- =============================================================================
-- Migration 007: Thêm cột mentions vào chat_messages cho @Mention feature
-- Chạy trong Supabase Dashboard > SQL Editor
-- =============================================================================

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS mentions jsonb;

COMMENT ON COLUMN chat_messages.mentions IS 'Mảng tên người được @tag trong tin nhắn. Vd: ["Nguyễn Văn A", "Trần Văn B"]';
