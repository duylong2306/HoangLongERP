-- =============================================================================
-- Migration 031: XÓA SẠCH bảng notifications + TẮT pg_cron nhắc điểm danh
-- Chạy trong Supabase Dashboard > SQL Editor
-- =============================================================================
-- Bối cảnh:
--   Toàn bộ "Thông báo hệ thống" đã được chuyển vào Tin nhắn (chat) theo plan:
--     - Xét duyệt → hội thoại cá nhân (Part A)
--     - Nhắc điểm danh → nhóm chat "Điểm danh" (Part B, chạy qua RPC
--       claim_attendance_chat + addMessage, KHÔNG còn tạo bản ghi notifications)
--     - Chuông 🔔 → lối tắt vào Tin nhắn (Part C)
--   Không còn code nào đọc/ghi bảng notifications (NotificationList,
--   notificationRouter, dbService.notifications, realtime... đều đã bị xóa).
--
-- Migration này:
--   1) XÓA SẠCH toàn bộ dòng cũ trong bảng notifications (521 bản).
--   2) TẮT 2 cron pg_cron nhắc điểm danh (attendance-morning-reminder,
--      attendance-afternoon-reminder) — trước đây INSERT vào notifications;
--      giờ nhóm chat "Điểm danh" đảm nhận. Tránh gửi kép + tránh table bị
--      đổ lại dữ liệu mới.
--   3) GIỮ NGUYÊN bảng notifications (rỗng) — không DROP để không phá vỡ:
--      - FKs cascade từ migration 20260731_project_cascade_delete
--      - Publication supabase_realtime (20260101_enable_realtime)
--      - schema.sql `create table if not exists` (idempotent)
-- =============================================================================

-- ─── BƯỚC 1: Xóa sạch toàn bộ thông báo cũ ───────────────────────────────
DELETE FROM public.notifications;

-- Verify:
-- SELECT count(*) FROM public.notifications;  -- phải = 0

-- ─── BƯỚC 2: Tắt 2 cron nhắc điểm danh cũ (đã chuyển sang nhóm chat) ─────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'attendance-morning-reminder') THEN
    PERFORM cron.unschedule('attendance-morning-reminder');
    RAISE NOTICE 'Đã tắt cron attendance-morning-reminder';
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'attendance-afternoon-reminder') THEN
    PERFORM cron.unschedule('attendance-afternoon-reminder');
    RAISE NOTICE 'Đã tắt cron attendance-afternoon-reminder';
  END IF;
END $$;

-- Verify:
-- SELECT jobname, active FROM cron.job WHERE jobname LIKE 'attendance-%';

-- =============================================================================
-- LƯU Ý: Edge Function send-attendance-reminders (backup push cũ) vẫn tồn tại
-- trong supabase/functions nhưng KHÔNG còn được pg_cron gọi nữa → không tự chạy.
-- Có thể xóa folder function này sau khi chắc chắn môi trường prod không còn
-- nguồn gọi ngoài (vd cron của Supabase Dashboard / GitHub Actions).
-- =============================================================================
