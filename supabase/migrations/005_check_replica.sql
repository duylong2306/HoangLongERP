-- Kiểm tra REPLICA IDENTITY cho bảng projects
SELECT
  c.relname AS table_name,
  CASE c.relreplident
    WHEN 'd' THEN 'DEFAULT'
    WHEN 'n' THEN 'NOTHING'
    WHEN 'f' THEN 'FULL'
    WHEN 'i' THEN 'INDEX'
  END AS replica_identity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname = 'projects'
  AND n.nspname = 'public';

-- Nếu kết quả là 'd' (DEFAULT) hoặc 'n' (NOTHING) thì chạy:
-- ALTER TABLE public.projects REPLICA IDENTITY FULL;
