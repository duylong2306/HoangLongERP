-- =============================================================================
-- Script chẩn đoán hiệu năng Supabase — Hoàng Long ERP (bản 2, chống-lỗi)
-- =============================================================================
-- CÁCH DÙNG QUAN TRỌNG: SQL Editor chạy TOÀN BỘ nội dung ô như MỘT lô —
-- chỉ cần 1 câu lỗi là cả lô dừng. Vì vậy hãy CHỌN TỪNG PHẦN rồi Run riêng.
--
-- Bản 2 thay đổi so với bản đầu:
--   • Thêm PHẦN 0: truy vết lỗi "relation public.messages_2026_08_20 does not
--     exist" — object này KHÔNG do script tạo ra; nó là view/rule/cron có sẵn
--     trong DB tham chiếu bảng ngày đã bị xóa. Chạy Phần 0 và gửi kết quả.
--   • Phần 5/6 bọc EXCEPTION: một bảng hỏng trả về -1/-2 thay vì làm sập lô.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- PHẦN 0: TRUY VẾT LỖI "messages_2026_08_20 DOES NOT EXIST"  ← CHẠY ĐẦU TIÊN
-- ─────────────────────────────────────────────────────────────────────────────

-- 0a. Mọi relation có chữ "message" trong tên + loại của chúng.
--     relkind: r = bảng thường | v = view | m = materialized view | p = bảng phân vùng
--     → Nếu chat_messages hiện relkind = 'v' thì đó là VIEW ghép các bảng ngày,
--       và bảng con messages_2026_08_20 đã biến mất → nguồn gốc lỗi 42P01.
SELECT n.nspname AS schema, c.relname AS name, c.relkind
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname ILIKE '%message%'
ORDER BY 1, 2;

-- 0b. Định nghĩa đầy đủ của chat_messages nếu nó là view (xem nó UNION những
--     bảng ngày nào):
SELECT viewname, definition
FROM pg_views
WHERE schemaname = 'public' AND viewname ILIKE '%message%';

-- 0c. View/rule khác trong public có tham chiếu bảng messages_... không:
SELECT schemaname, viewname
FROM pg_views
WHERE schemaname = 'public'
  AND definition ILIKE '%messages[_]2%'
LIMIT 20;

-- 0d. Toàn bộ cron jobs đang đặt — tìm job luân chuyển/xóa bảng ngày:
SELECT jobid, jobname, schedule, active, command
FROM cron.job
ORDER BY jobname;

-- 0e. Lịch sử chạy cron gần đây (job nào đang lỗi lặp lại):
SELECT jobid, status, return_message, start_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 15;

-- ═════════════════════════════════════════════════════════════════════════════
-- SAU KHI CHẠY PHẦN 0: gửi kết quả cho Claude để xử lý gốc rễ.
--
-- CẤP CỨU (nếu cần chat hoạt động ngay, chưa rõ cấu trúc):
--   Tạo lại bảng ngày bị thiếu bằng cấu trúc của một bảng ngày liền kề còn
--   tồn tại (thay tên theo kết quả 0a), ví dụ:
--     CREATE TABLE public.messages_2026_08_20
--       (LIKE public.messages_2026_08_21 INCLUDING DEFAULTS);
--   Hoặc nếu 0a cho thấy KHÔNG còn bảng messages_* nào khác:
--     CREATE TABLE public.messages_2026_08_20 (LIKE public.chat_messages);
--   (chỉ hợp lệ khi chat_messages là bảng thật; nếu là view sẽ báo lỗi — gửi kết quả 0a).
-- ═════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- PHẦN 1: TOP QUERY NGỐN CPU NHẤT (cần pg_stat_statements)
-- Nếu lỗi "function pg_stat_statements does not exist" → bật extension ở
-- Database → Extensions → pg_stat_statements (hoặc bỏ qua phần này).
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  calls,
  round(total_exec_time::numeric, 0)          AS total_ms,
  round(mean_exec_time::numeric, 1)           AS avg_ms,
  rows,
  round((100 * total_exec_time / sum(total_exec_time) OVER ())::numeric, 1) AS pct_total,
  left(regexp_replace(query, '\s+', ' ', 'g'), 120) AS query_snippet
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY total_exec_time DESC
LIMIT 20;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHẦN 2: KÍCH THƯỚC BẢNG + INDEX (tìm bảng phình to)
-- LƯU Ý: pg_stat_user_tables gồm TẤT CẢ schema (kể cả partition realtime.*),
-- nên phải dùng đúng schema của từng dòng — ghép cứng 'public.' sẽ gây lỗi
-- 42P01 cho các bảng tên trùng nhưng thuộc schema khác.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  schemaname                       AS schema,
  relname                          AS table_name,
  pg_size_pretty(pg_total_relation_size(format('%I.%I', schemaname, relname)::regclass)) AS total_size,
  pg_size_pretty(pg_relation_size(format('%I.%I', schemaname, relname)::regclass))       AS data_size,
  pg_size_pretty(pg_indexes_size(format('%I.%I', schemaname, relname)::regclass))        AS index_size,
  n_live_tup                       AS approx_rows
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(format('%I.%I', schemaname, relname)::regclass) DESC
LIMIT 30;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHẦN 3: SEQUENTIAL SCAN — bảng bị scan toàn bộ nhiều (thiếu index)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  relname        AS table_name,
  seq_scan,
  seq_tup_read,
  idx_scan,
  n_live_tup     AS approx_rows,
  CASE WHEN idx_scan = 0 AND seq_scan > 0 THEN '⚠️ CHƯA CÓ INDEX ĐƯỢC DÙNG'
       WHEN seq_scan > idx_scan * 10 AND n_live_tup > 1000 THEN '⚠️ NÊN THÊM INDEX'
       ELSE 'OK' END AS verdict
FROM pg_stat_user_tables
WHERE n_live_tup > 100
ORDER BY seq_tup_read DESC
LIMIT 20;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHẦN 4: REALTIME — số connection realtime đang mở
-- ─────────────────────────────────────────────────────────────────────────────
SELECT count(*) AS active_realtime_connections
FROM pg_stat_activity
WHERE usename = 'supabase_realtime_admin'
   OR application_name LIKE '%realtime%';

-- ─────────────────────────────────────────────────────────────────────────────
-- PHẦN 5: SỐ DÒNG CÁC BẢNG LOG/THÔNG BÁO (bản chống-lỗi)
-- Bảng nào lỗi → rows = -1 (kể cả lỗi 42P01 kiểu messages_2026_08_20),
-- script vẫn chạy tiếp và cho biết chính xác bảng nào đang hỏng.
-- ─────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS _hl_row_counts;
CREATE TEMP TABLE _hl_row_counts (tbl text, row_count bigint);

DO $$
DECLARE
  n bigint;
  t text;
  tables text[] := array[
    'notifications', 'warehouse_logs', 'chat_messages',
    'attendance_records', 'tasks', 'quotes', 'conversations'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
      INSERT INTO _hl_row_counts VALUES (t, n);
      -- Riêng chat_messages: đếm thêm dòng deleted=true
      IF t = 'chat_messages' THEN
        BEGIN
          EXECUTE format('SELECT count(*) FROM public.%I WHERE deleted = true', t) INTO n;
          INSERT INTO _hl_row_counts VALUES (t || ' deleted=true', n);
        EXCEPTION WHEN OTHERS THEN
          INSERT INTO _hl_row_counts VALUES (t || ' deleted=true', -1);
        END;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO _hl_row_counts VALUES (t, -1);
      RAISE NOTICE 'Bảng %.% lỗi: %', 'public', t, SQLERRM;
    END;
  END LOOP;
END $$;

SELECT tbl, row_count,
       CASE WHEN row_count = -1 THEN '❌ BẢNG/VIEW HỎNG — xem notice ở tab Messages' ELSE '' END AS note
FROM _hl_row_counts
ORDER BY tbl;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHẦN 6: QUÉT BASE64/ẢNH LỚN TRONG DB (bản chống-lỗi)
-- Trả về: số dòng chứa data:image | -1 = cột/lỗi khác | -2 = bảng không tồn tại
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION hl_count_base64(tbl_name text, col text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  n integer;
BEGIN
  IF to_regclass(tbl_name) IS NULL THEN RETURN -2; END IF;
  BEGIN
    EXECUTE format(
      'SELECT count(*) FROM %s WHERE %I::text LIKE ''%%data:image%%''',
      tbl_name, col) INTO n;
  EXCEPTION WHEN OTHERS THEN
    RETURN -1;
  END;
  RETURN n;
END $$;

SELECT 'tasks.missions'            AS location, hl_count_base64('public.tasks', 'missions')             AS base64_rows
UNION ALL SELECT 'tasks.comments',        hl_count_base64('public.tasks', 'comments')
UNION ALL SELECT 'tasks.work_logs',       hl_count_base64('public.tasks', 'work_logs')
UNION ALL SELECT 'payments.images',       hl_count_base64('public.payments', 'images')
UNION ALL SELECT 'quotes.items',          hl_count_base64('public.quotes', 'items')
UNION ALL SELECT 'quotes.company_logo_img', hl_count_base64('public.quotes', 'company_logo_img')
UNION ALL SELECT 'attendance_records.photo_in',  hl_count_base64('public.attendance_records', 'photo_in')
UNION ALL SELECT 'attendance_records.photo_out', hl_count_base64('public.attendance_records', 'photo_out');

DROP FUNCTION IF EXISTS hl_count_base64(text, text);

-- ─────────────────────────────────────────────────────────────────────────────
-- PHẦN 7: CONNECTIONS HIỆN TẠI THEO USER (pool có bị cạn không)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT usename, application_name, state, count(*) AS connections
FROM pg_stat_activity
GROUP BY usename, application_name, state
ORDER BY connections DESC;
