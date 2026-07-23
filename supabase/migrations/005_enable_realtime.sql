-- =============================================================================
-- KIỂM TRA & BẬT SUPABASE REALTIME
-- Chạy từng block trong Supabase Dashboard → SQL Editor
-- =============================================================================

-- BƯỚC 1: Kiểm tra các bảng đã có trong publication chưa
SELECT
  pubname,
  n.nspname AS schema_name,
  c.relname AS table_name
FROM pg_publication p
JOIN pg_publication_rel pr ON pr.prpubid = p.oid
JOIN pg_class c ON c.oid = pr.prrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE p.pubname = 'supabase_realtime'
ORDER BY c.relname;

-- BƯỚC 2: Bật Realtime cho tất cả các bảng cần sync
-- Nếu bước 1 trả về rỗng hoặc thiếu bảng → chạy bước 2
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.receipts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.subcontractor_advances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.employees;
ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quotes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hrm_role_groups;

-- BƯỚC 3: Verify lại sau khi chạy bước 2
SELECT
  c.relname AS table_name
FROM pg_publication p
JOIN pg_publication_rel pr ON pr.prpubid = p.oid
JOIN pg_class c ON c.oid = pr.prrelid
WHERE p.pubname = 'supabase_realtime'
ORDER BY c.relname;
