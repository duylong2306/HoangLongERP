-- ============================================================================
-- Migration 035: Thêm cột related_entity vào chat_messages
--
-- MỤC ĐÍCH: Code (chatStore.msgToRow) gửi trường related_entity để hỗ trợ điều
-- hướng thực thể liên quan trong chat (task / project / mission). Nếu cột này
-- CHƯA tồn tại trên bảng chat_messages của project Supabase, mọi lệnh INSERT đều
-- trả 400 "Could not find the 'related_entity' column" → TIN NHẮN KHÔNG THỂ LƯU,
-- dù conversation vẫn cập nhật last_message_at (hội thoại "trôi nổi" có thời gian
-- nhưng không có nội dung).
--
-- Migration này thêm cột related_entity (jsonb) cho phép null. Idempotent
-- (ADD COLUMN IF NOT EXISTS) → chạy lại an toàn, không lỗi nếu cột đã có.
--
-- Chạy 1 lần trong Supabase Dashboard > SQL Editor (app chạy bằng anon key nên
-- KHÔNG có quyền ALTER TABLE — chỉ service_role / postgres mới được, nên phải
-- chạy tay ở đây hoặc qua `supabase db push`). Code đã phòng thủ: msgToRow chỉ
-- gửi related_entity khi có giá trị, nên tin nhắn thường vẫn lưu được ngay cả
-- khi migration này CHƯA chạy.
-- ============================================================================

alter table public.chat_messages
  add column if not exists related_entity jsonb;

comment on column public.chat_messages.related_entity is
  'Thực thể liên quan để điều hướng (task / project / mission), dạng jsonb. Null nếu tin nhắn thường.';
