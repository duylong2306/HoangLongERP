-- Migration nối tiếp: sửa 2 lỗi "column ... does not exist" khi chạy
-- 20260821_performance_indexes_and_retention.sql — file gốc giả định nhầm
-- một số bảng có cột thật mà thực tế không có:
--
-- 1) sales_orders.project_id — bảng sales_orders (tạo ở migration 015) chưa
--    từng có cột project_id, khác purchase_orders đã được thêm riêng ở
--    migration 20260820_add_project_to_purchase_orders.sql.
-- 2) hrm_travel_expenses.emp_id — bảng này dùng pattern "id uuid + data jsonb"
--    (migration 021_create_hrm_travel_expenses.sql), không có cột emp_id thật;
--    id nhân viên nằm trong data->>'empId'.
--
-- Cả 2 lỗi lần lượt chặn ngang migration gốc, khiến TOÀN BỘ phần còn lại
-- (retention dọn dữ liệu, cron tự động) CHƯA CHẠY được.
--
-- FIX: thêm cột project_id/project_name cho sales_orders (giống purchase_orders),
-- đổi index emp_id sang expression index trên data->>'empId', rồi CHẠY LẠI
-- TOÀN BỘ nội dung Phần 1-4 của migration 20260821 (mọi câu lệnh đều idempotent
-- — IF NOT EXISTS / CREATE OR REPLACE / DELETE theo điều kiện — an toàn chạy
-- lại dù một phần đã chạy thành công trước đó).

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX: thêm cột project_id cho sales_orders (giống purchase_orders)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS project_id   TEXT,
  ADD COLUMN IF NOT EXISTS project_name TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHẦN 1 (chạy lại đầy đủ — idempotent): INDEX CHO CÁC QUERY NÓNG
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tasks_project_id   ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id  ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status       ON public.tasks(status);

CREATE INDEX IF NOT EXISTS idx_receipts_project_id ON public.receipts(project_id);
CREATE INDEX IF NOT EXISTS idx_receipts_date       ON public.receipts(date);
CREATE INDEX IF NOT EXISTS idx_payments_project_id ON public.payments(project_id);
CREATE INDEX IF NOT EXISTS idx_payments_date       ON public.payments(date);

CREATE INDEX IF NOT EXISTS idx_quotes_customer_id ON public.quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_project_id  ON public.quotes(project_id);

CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON public.attendance_records(emp_id, date);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_created
  ON public.chat_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_read_by_conv
  ON public.chat_messages(conversation_id) WHERE read = false;

CREATE INDEX IF NOT EXISTS idx_conversations_participants
  ON public.conversations USING gin(participant_ids);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_category  ON public.notifications(category);

CREATE INDEX IF NOT EXISTS idx_warehouse_logs_time ON public.warehouse_logs(time);

CREATE INDEX IF NOT EXISTS idx_sales_orders_project_id    ON public.sales_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_project_id ON public.purchase_orders(project_id);

-- hrm_travel_expenses KHÔNG có cột emp_id thật — bảng này dùng pattern
-- "id uuid + data jsonb" (xem migration 021_create_hrm_travel_expenses.sql),
-- id nhân viên nằm trong data->>'empId'. Dùng expression index thay vì cột
-- thật (bản gốc của migration 20260821 giả định nhầm có cột emp_id → lỗi 42703).
CREATE INDEX IF NOT EXISTS idx_hrm_travel_expenses_emp
  ON public.hrm_travel_expenses ((data->>'empId'));

-- ─────────────────────────────────────────────────────────────────────────────
-- PHẦN 2 (chạy lại — an toàn, chỉ xóa theo điều kiện ngày): RETENTION 1 LẦN
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM public.notifications
WHERE COALESCE(created_at, '') <> ''
  AND created_at < to_char(now() - interval '30 days', 'YYYY-MM-DD"T"HH24:MI:SS');

DELETE FROM public.warehouse_logs
WHERE COALESCE(time, '') <> ''
  AND time < to_char(now() - interval '180 days', 'YYYY-MM-DD');

DELETE FROM public.chat_messages
WHERE deleted = true
  AND COALESCE(deleted_at, '') <> ''
  AND deleted_at < to_char(now() - interval '90 days', 'YYYY-MM-DD"T"HH24:MI:SS');

-- ─────────────────────────────────────────────────────────────────────────────
-- PHẦN 3 (CREATE OR REPLACE — an toàn chạy lại): PG_CRON RETENTION HẰNG NGÀY
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION hl_retention_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE COALESCE(created_at, '') <> ''
    AND created_at < to_char(now() - interval '30 days', 'YYYY-MM-DD"T"HH24:MI:SS');

  DELETE FROM public.warehouse_logs
  WHERE COALESCE(time, '') <> ''
    AND time < to_char(now() - interval '180 days', 'YYYY-MM-DD');

  DELETE FROM public.chat_messages
  WHERE deleted = true
    AND COALESCE(deleted_at, '') <> ''
    AND deleted_at < to_char(now() - interval '90 days', 'YYYY-MM-DD"T"HH24:MI:SS');
END;
$$;

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
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'hl-retention-cleanup';

SELECT 'notifications' AS tbl, count(*) FROM public.notifications
UNION ALL SELECT 'warehouse_logs', count(*) FROM public.warehouse_logs
UNION ALL SELECT 'chat_messages (deleted=true)', count(*) FROM public.chat_messages WHERE deleted = true;
