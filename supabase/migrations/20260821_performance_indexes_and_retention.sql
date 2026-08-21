-- =============================================================================
-- Migration 20260821: Tối ưu hiệu năng — Index còn thiếu + Retention dữ liệu
-- =============================================================================
-- Bối cảnh: Supabase cảnh báo "exhausting multiple resources" (CPU + Egress).
-- Nguyên nhân chính (đã sửa phía client trong App.tsx):
--   • Realtime refetch toàn bộ bảng mỗi event × số tab đang mở.
-- Phần này xử lý phía DB:
--   1. Tạo index cho các cột lọc/join thường dùng (hiện chỉ có ~6 index toàn DB).
--   2. Retention: xóa log/thông báo/tin nhắn đã xóa quá hạn (bảng mọc vô hạn).
--   3. pg_cron chạy retention tự động hằng ngày.
-- Chạy: Supabase Dashboard → SQL Editor → Run toàn bộ file.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- PHẦN 1: INDEX CHO CÁC QUERY NÓNG
-- ─────────────────────────────────────────────────────────────────────────────

-- tasks: lọc theo dự án (Kanban), người được giao, trạng thái
CREATE INDEX IF NOT EXISTS idx_tasks_project_id   ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id  ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status       ON public.tasks(status);

-- receipts / payments: lọc theo dự án + ngày (báo cáo tài chính)
CREATE INDEX IF NOT EXISTS idx_receipts_project_id ON public.receipts(project_id);
CREATE INDEX IF NOT EXISTS idx_receipts_date       ON public.receipts(date);
CREATE INDEX IF NOT EXISTS idx_payments_project_id ON public.payments(project_id);
CREATE INDEX IF NOT EXISTS idx_payments_date       ON public.payments(date);

-- quotes: lọc theo khách hàng / dự án
CREATE INDEX IF NOT EXISTS idx_quotes_customer_id ON public.quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_project_id  ON public.quotes(project_id);

-- attendance_records: query theo (emp_id, date) là đường nóng nhất app
-- (listForRange với empId — xem dbService.attendance.listForRange)
CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON public.attendance_records(emp_id, date);

-- chat_messages: load tin nhắn theo hội thoại + thời gian (cửa sổ 2 ngày)
CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_created
  ON public.chat_messages(conversation_id, created_at);
-- markConversationRead / markMessagesReadByUser update theo conversation_id
CREATE INDEX IF NOT EXISTS idx_chat_messages_read_by_conv
  ON public.chat_messages(conversation_id) WHERE read = false;

-- conversations: tìm hội thoại của 1 user (query.contains(participant_ids,...))
-- GIN index trên mảng để contains không phải scan toàn bảng.
CREATE INDEX IF NOT EXISTS idx_conversations_participants
  ON public.conversations USING gin(participant_ids);

-- notifications: tra cứu theo người nhận + loại
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_category  ON public.notifications(category);

-- warehouse_logs: sắp xếp/lọc theo thời gian (bảng append-only)
CREATE INDEX IF NOT EXISTS idx_warehouse_logs_time ON public.warehouse_logs(time);

-- sales_orders / purchase_orders: lọc theo dự án
CREATE INDEX IF NOT EXISTS idx_sales_orders_project_id   ON public.sales_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_project_id ON public.purchase_orders(project_id);

-- hrm_travel_expenses: tổng hợp CTP lọc theo nhân viên
CREATE INDEX IF NOT EXISTS idx_hrm_travel_expenses_emp ON public.hrm_travel_expenses(emp_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- PHẦN 2: RETENTION — DỌN DỮ LIỆU RÁC HIỆN CÓ (chạy 1 lần)
-- ─────────────────────────────────────────────────────────────────────────────

-- 2a. notifications: app KHÔNG còn đọc bảng này từ UI (đã chuyển sang chat/push),
--     nhưng pg_cron điểm danh vẫn INSERT 2 lần/ngày/nhân viên → phình vô hạn.
--     Giữ tối đa 30 ngày gần nhất.
DELETE FROM public.notifications
WHERE COALESCE(created_at, '') <> ''
  AND created_at < to_char(now() - interval '30 days', 'YYYY-MM-DD"T"HH24:MI:SS');

-- 2b. warehouse_logs: lịch sử xuất nhập kho — giữ 180 ngày (6 tháng).
--     Cột `time` lưu TEXT; format 'YYYY-MM-DD HH:MI' so sánh đúng kiểu chuỗi ISO.
DELETE FROM public.warehouse_logs
WHERE COALESCE(time, '') <> ''
  AND time < to_char(now() - interval '180 days', 'YYYY-MM-DD');

-- 2c. chat_messages đã đánh dấu deleted quá 90 ngày → xóa hẳn (dọn payload JSONB nặng)
DELETE FROM public.chat_messages
WHERE deleted = true
  AND COALESCE(deleted_at, '') <> ''
  AND deleted_at < to_char(now() - interval '90 days', 'YYYY-MM-DD"T"HH24:MI:SS');

-- 2d. VACUUM nhẹ sau khi dọn (không khóa bảng; full vacuum làm ngoài giờ nếu cần)
-- Lưu ý: VACUUM không chạy được bên trong transaction — chạy riêng từng câu
-- trong SQL Editor nếu muốn thu hồi dung lượng ngay:
--   VACUUM ANALYZE public.notifications;
--   VACUUM ANALYZE public.warehouse_logs;
--   VACUUM ANALYZE public.chat_messages;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHẦN 3: PG_CRON RETENTION HẰNG NGÀY (03:15 UTC = 10:15 VN)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION hl_retention_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- notifications quá 30 ngày
  DELETE FROM public.notifications
  WHERE COALESCE(created_at, '') <> ''
    AND created_at < to_char(now() - interval '30 days', 'YYYY-MM-DD"T"HH24:MI:SS');

  -- warehouse_logs quá 180 ngày
  DELETE FROM public.warehouse_logs
  WHERE COALESCE(time, '') <> ''
    AND time < to_char(now() - interval '180 days', 'YYYY-MM-DD');

  -- chat_messages đã xóa mềm quá 90 ngày
  DELETE FROM public.chat_messages
  WHERE deleted = true
    AND COALESCE(deleted_at, '') <> ''
    AND deleted_at < to_char(now() - interval '90 days', 'YYYY-MM-DD"T"HH24:MI:SS');
END;
$$;

-- Đảm bảo pg_cron đã bật (migration 006 đã tạo; idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hl-retention-cleanup') THEN
    PERFORM cron.unschedule('hl-retention-cleanup');
  END IF;
END $$;

SELECT cron.schedule(
  'hl-retention-cleanup',
  '15 3 * * *',
  $$ SELECT hl_retention_cleanup(); $$
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PHẦN 4: VERIFY
-- ─────────────────────────────────────────────────────────────────────────────

-- Xem các index vừa tạo:
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- Xem cron job:
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'hl-retention-cleanup';

-- Số dòng còn lại của các bảng đã dọn:
SELECT 'notifications' AS tbl, count(*) FROM public.notifications
UNION ALL SELECT 'warehouse_logs', count(*) FROM public.warehouse_logs
UNION ALL SELECT 'chat_messages (deleted=true)', count(*) FROM public.chat_messages WHERE deleted = true;
