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
-- Dùng EXCEPTION block để bỏ qua nếu bảng đã có trong publication
DO $$
DECLARE
  tbl TEXT;
  tables_to_add TEXT[] := ARRAY[
    'projects', 'tasks', 'payments', 'receipts',
    'subcontractor_advances', 'attendance_records', 'notifications',
    'employees', 'customers', 'quotes', 'hrm_role_groups'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_to_add LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
      RAISE NOTICE '✅ Added: %', tbl;
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE '⏭ Already in publication: %', tbl;
    END;
  END LOOP;
END $$;

-- BƯỚC 3: Verify lại sau khi chạy bước 2
SELECT
  c.relname AS table_name
FROM pg_publication p
JOIN pg_publication_rel pr ON pr.prpubid = p.oid
JOIN pg_class c ON c.oid = pr.prrelid
WHERE p.pubname = 'supabase_realtime'
ORDER BY c.relname;
