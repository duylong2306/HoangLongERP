-- =====================================================================
-- XÓA DỰ ÁN → XÓA SẠCH TOÀN BỘ DỮ LIỆU PHÁT SINH
--
-- Mục tiêu: khi một dòng trong `projects` bị xóa, mọi dữ liệu sinh ra từ
-- dự án đó cũng biến mất khỏi database, không để lại rác:
--   Công Việc, Nhiệm Vụ, Nhóm chat, Ghi nhận vi phạm, Công tác phí,
--   Báo giá, Hợp Đồng, Nghiệm Thu, Thanh Lý, HĐ Thầu, Công Nợ,
--   Đề Xuất, Phiếu Thu, Phiếu Chi ...
--
-- Migration này THAY THẾ hành vi cũ ở 20260101_fix_foreign_keys_on_delete_cascade.sql
-- (trước đây receipts / payments / quotes / archived_quotes / subcontractor_advances
--  dùng ON DELETE SET NULL → dữ liệu ở lại làm rác mồ côi).
--
-- An toàn: chạy lại nhiều lần được (idempotent). Bảng/cột không tồn tại thì
-- bỏ qua, không làm hỏng migration.
--
-- Chạy trong Supabase Dashboard > SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Hàm tiện ích: ép một cột thành FK ... ON DELETE CASCADE
--   1. Bỏ qua nếu bảng hoặc cột không tồn tại
--   2. Dọn bản ghi "mồ côi" (trỏ tới cha đã biến mất) → NULL, nếu không
--      Postgres sẽ từ chối tạo FK
--   3. Gỡ mọi FK cũ đang gắn trên cột đó (bất kể tên constraint)
--   4. Tạo lại FK với ON DELETE CASCADE
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hl_force_cascade_fk(
  p_child  text,
  p_col    text,
  p_parent text
) RETURNS void
LANGUAGE plpgsql AS $fn$
DECLARE
  v_con text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = p_child
  ) THEN
    RAISE NOTICE '⏭  Bỏ qua %.% — bảng không tồn tại', p_child, p_col;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = p_child AND column_name = p_col
  ) THEN
    RAISE NOTICE '⏭  Bỏ qua %.% — cột không tồn tại', p_child, p_col;
    RETURN;
  END IF;

  -- 2. Dọn mồ côi
  BEGIN
    EXECUTE format(
      'UPDATE public.%1$I SET %2$I = NULL
         WHERE %2$I IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM public.%3$I par WHERE par.id = public.%1$I.%2$I)',
      p_child, p_col, p_parent
    );
  EXCEPTION WHEN others THEN
    RAISE NOTICE '⚠️  Không dọn được mồ côi %.%: %', p_child, p_col, SQLERRM;
  END;

  -- 3. Gỡ mọi FK cũ trên đúng cột này
  FOR v_con IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel      ON rel.oid = con.conrelid
    JOIN pg_namespace ns   ON ns.oid = rel.relnamespace
    WHERE con.contype = 'f'
      AND ns.nspname  = 'public'
      AND rel.relname = p_child
      AND (
        SELECT array_agg(att.attname::text ORDER BY att.attnum)
        FROM unnest(con.conkey) AS k
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = k
      ) = ARRAY[p_col]
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', p_child, v_con);
  END LOOP;

  -- 4. Tạo lại với CASCADE
  BEGIN
    EXECUTE format(
      'ALTER TABLE public.%1$I ADD CONSTRAINT %4$I
         FOREIGN KEY (%2$I) REFERENCES public.%3$I(id) ON DELETE CASCADE',
      p_child, p_col, p_parent, p_child || '_' || p_col || '_fkey'
    );
    RAISE NOTICE '✅ %.% → %(id) ON DELETE CASCADE', p_child, p_col, p_parent;
  EXCEPTION WHEN others THEN
    -- Thường gặp: kiểu dữ liệu lệch (uuid vs text) hoặc cột cha không unique
    RAISE NOTICE '❌ Không tạo được FK %.% → %(id): %', p_child, p_col, p_parent, SQLERRM;
  END;
END;
$fn$;

-- =====================================================================
-- A. MỌI THỨ TRỎ VỀ projects(id)  →  CASCADE
-- =====================================================================
DO $$
DECLARE
  t text;
  project_children text[] := ARRAY[
    'tasks',                          -- Công Việc (Nhiệm Vụ nằm trong JSON của task)
    'receipts',                       -- Phiếu Thu
    'payments',                       -- Phiếu Chi
    'quotes',                         -- Báo Giá
    'archived_quotes',                -- Hồ sơ lưu trữ: Hợp Đồng / Nghiệm Thu / Thanh Lý
    'subcontractor_advances',         -- Đề Xuất tạm ứng - thu chi thầu phụ
    'accounting_receivables',         -- Công Nợ phải thu
    'accounting_liabilities',         -- Công Nợ phải trả
    'accounting_sub_contracts',       -- HĐ Thầu (hợp đồng thầu phụ)
    'project_permission_overrides',   -- Phân quyền riêng theo dự án
    'conversations',                  -- Nhóm chat dự án
    'notifications',                  -- Thông báo gắn dự án
    'hrm_employee_errors',            -- Ghi nhận vi phạm kỷ luật & hiệu suất
    'hrm_trips',                      -- Chuyến công tác
    'hrm_travel_expenses',            -- Công tác phí
    'purchase_orders',                -- Đơn mua hàng
    'sales_orders',                   -- Đơn bán hàng
    'warehouse_logs'                  -- Nhật ký xuất/nhập kho theo dự án
  ];
BEGIN
  FOREACH t IN ARRAY project_children LOOP
    PERFORM public.hl_force_cascade_fk(t, 'project_id', 'projects');
  END LOOP;
END $$;

-- =====================================================================
-- B. MỌI THỨ TRỎ VỀ tasks(id)  →  CASCADE
--    (xóa dự án → tasks bị cascade → các bảng này cascade tiếp theo)
-- =====================================================================
DO $$
DECLARE
  t text;
  task_children text[] := ARRAY[
    'quotes',
    'archived_quotes',
    'subcontractor_advances',
    'notifications',
    'conversations',                  -- Nhóm chat công việc
    'hrm_employee_errors',            -- Vi phạm ghi nhận từ trong Công việc
    'hrm_trips',
    'hrm_travel_expenses'
  ];
BEGIN
  FOREACH t IN ARRAY task_children LOOP
    PERFORM public.hl_force_cascade_fk(t, 'task_id', 'tasks');
  END LOOP;
END $$;

-- =====================================================================
-- C. Tin nhắn chat phải chết theo nhóm chat
-- =====================================================================
DO $$
BEGIN
  PERFORM public.hl_force_cascade_fk('chat_messages', 'conversation_id', 'conversations');
END $$;

-- =====================================================================
-- D. Index cho các cột khóa ngoại (CASCADE quét nhanh hơn hẳn)
-- =====================================================================
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_schema = c.table_schema
     AND tb.table_name   = c.table_name
     AND tb.table_type   = 'BASE TABLE'
    WHERE c.table_schema = 'public'
      AND c.column_name IN ('project_id', 'task_id', 'conversation_id')
  LOOP
    BEGIN
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I (%I)',
        'idx_' || r.table_name || '_' || r.column_name, r.table_name, r.column_name
      );
    EXCEPTION WHEN others THEN
      RAISE NOTICE '⚠️  Không tạo được index %.%: %', r.table_name, r.column_name, SQLERRM;
    END;
  END LOOP;
END $$;

-- =====================================================================
-- E. RPC cho ứng dụng: bảng nào có cột liên kết nào?
--
-- Vì sao cần: các bảng lưu dữ liệu dạng `data jsonb` không có cột
-- project_id thật nên FK CASCADE không với tới — ứng dụng phải tự quét xóa.
-- Nhưng nếu ứng dụng đoán mò tên bảng, request DELETE lên cột không tồn tại
-- sẽ trả HTTP 400 và trình duyệt log đỏ đầy Console.
--
-- Hàm này trả về đúng sự thật để dbService.projects.deleteCascade() chỉ bắn
-- request vào bảng có thật. Bảng mới thêm về sau tự động được nhận diện,
-- không phải sửa code.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.hl_link_columns()
RETURNS TABLE (
  table_name      text,
  has_project_id  boolean,
  has_task_id     boolean,
  has_jsonb_data  boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
  -- Bọc qua subquery với bí danh riêng: tên cột OUT ở trên (table_name...)
  -- nằm cùng phạm vi với thân hàm, tham chiếu trực tiếp sẽ bị nhập nhằng.
  SELECT
    src.tbl,
    bool_or(src.col = 'project_id'),
    bool_or(src.col = 'task_id'),
    bool_or(src.col = 'data' AND src.typ IN ('jsonb', 'json'))
  FROM (
    SELECT
      c.table_name::text  AS tbl,
      c.column_name::text AS col,
      c.data_type::text   AS typ
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON  t.table_schema = c.table_schema
      AND t.table_name   = c.table_name
      AND t.table_type   = 'BASE TABLE'
    WHERE c.table_schema = 'public'
  ) src
  GROUP BY src.tbl
  HAVING bool_or(src.col IN ('project_id', 'task_id'))
      OR bool_or(src.col = 'data' AND src.typ IN ('jsonb', 'json'));
$fn$;

-- Ứng dụng chạy bằng anon key → phải cấp quyền gọi
GRANT EXECUTE ON FUNCTION public.hl_link_columns() TO anon, authenticated, service_role;

-- =====================================================================
-- F. Dọn hàm tiện ích chỉ dùng trong lúc migrate
-- =====================================================================
DROP FUNCTION IF EXISTS public.hl_force_cascade_fk(text, text, text);

-- =====================================================================
-- HOÀN THÀNH
--
-- Kiểm tra lại bằng câu lệnh sau — cột delete_rule phải là CASCADE:
--
--   SELECT tc.table_name, kcu.column_name, ccu.table_name AS refs, rc.delete_rule
--   FROM information_schema.table_constraints tc
--   JOIN information_schema.key_column_usage kcu  ON kcu.constraint_name = tc.constraint_name
--   JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
--   JOIN information_schema.referential_constraints rc  ON rc.constraint_name = tc.constraint_name
--   WHERE tc.constraint_type = 'FOREIGN KEY'
--     AND ccu.table_name IN ('projects', 'tasks', 'conversations')
--   ORDER BY refs, tc.table_name;
--
-- ⚠️ Các bảng lưu dữ liệu dạng `data jsonb` (không có cột project_id thật)
--    không thể cascade bằng FK. Chúng được quét xóa từ phía ứng dụng trong
--    dbService.projects.deleteCascade() — xem src/lib/dbService.ts.
-- =====================================================================
