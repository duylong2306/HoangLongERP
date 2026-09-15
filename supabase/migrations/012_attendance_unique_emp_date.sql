-- ============================================================================
-- 012_attendance_unique_emp_date.sql
-- Mục đích: Ngăn chặn bản ghi chấm công trùng lặp (cùng emp_id + date).
--
-- Nguyên nhân lỗi: id bản ghi được sinh NGẪU NHIÊN (thêm Date.now() vào cuối)
-- cộng với việc tìm bản ghi hiện tại bằng empName thay vì empId + date,
-- dẫn đến mỗi lần chấm (sáng/chiều) tạo 1 dòng mới thay vì cập nhật dòng cũ.
--
-- Cách xử lý:
--   1) Gộp các dòng trùng (emp_id + date) thành 1 dòng duy nhất, ưu tiên giờ thực tế.
--   2) Chuẩn hóa id về dạng xác định AT-{emp_id}-{date} (không dấu gạch ngang).
--   3) Thêm ràng buộc UNIQUE (emp_id, date) để DB tự chặn trùng ở tầng DB.
--
-- Lưu ý: Client (dbService.attendance.save) đã được sửa để luôn ghi id xác định
-- này cho bản ghi THẬT, nên sau migration mọi upsert thật đều trúng đúng 1 dòng cho
-- mỗi nhân viên/ngày. Bản ghi auto (AT-AUTO-*) được giữ id riêng biệt; nếu HR (không
-- lắng nghe sự kiện chấm công) tạo nhầm AT-AUTO-* trùng empId+date, ràng buộc UNIQUE
-- sẽ từ chối (reject) thay vì ghi đè → bảo vệ dữ liệu chấm công thật.
-- ============================================================================

-- (1) Xác định keeper (dòng giữ lại) cho mỗi nhóm emp_id + date:
--     ưu tiên dòng có nhiều giờ thực tế (HH:MM) nhất; hòa thì lấy id cũ nhất.
WITH keeper_ids AS (
  SELECT emp_id, date,
         (ARRAY_AGG(id ORDER BY
            (CASE WHEN time_in_s  ~ '^\d{1,2}:\d{2}$' THEN 1 ELSE 0 END)
          + (CASE WHEN time_out_s ~ '^\d{1,2}:\d{2}$' THEN 1 ELSE 0 END)
          + (CASE WHEN time_in_c  ~ '^\d{1,2}:\d{2}$' THEN 1 ELSE 0 END)
          + (CASE WHEN time_out_c ~ '^\d{1,2}:\d{2}$' THEN 1 ELSE 0 END)
          + (CASE WHEN time_in_ot ~ '^\d{1,2}:\d{2}$' THEN 1 ELSE 0 END)
          + (CASE WHEN time_out_ot~ '^\d{1,2}:\d{2}$' THEN 1 ELSE 0 END) DESC,
            id ASC))[1] AS keep_id
  FROM public.attendance_records
  WHERE emp_id IS NOT NULL AND emp_id <> ''
  GROUP BY emp_id, date
  HAVING COUNT(*) > 1
),
-- (2) Giá trị giờ đã gộp (chỉ lấy giờ thực tế HH:MM) cho mỗi keeper
merged AS (
  SELECT k.keep_id,
         MAX(CASE WHEN r.time_in_s  ~ '^\d{1,2}:\d{2}$' THEN r.time_in_s  END) AS tis,
         MAX(CASE WHEN r.time_out_s ~ '^\d{1,2}:\d{2}$' THEN r.time_out_s END) AS tos,
         MAX(CASE WHEN r.time_in_c  ~ '^\d{1,2}:\d{2}$' THEN r.time_in_c  END) AS tic,
         MAX(CASE WHEN r.time_out_c ~ '^\d{1,2}:\d{2}$' THEN r.time_out_c END) AS toc,
         MAX(CASE WHEN r.time_in_ot ~ '^\d{1,2}:\d{2}$' THEN r.time_in_ot END) AS tiot,
         MAX(CASE WHEN r.time_out_ot~ '^\d{1,2}:\d{2}$' THEN r.time_out_ot END) AS toot
  FROM public.attendance_records r
  JOIN keeper_ids k ON r.emp_id = k.emp_id AND r.date = k.date
  GROUP BY k.keep_id
)
UPDATE public.attendance_records a
SET time_in_s  = COALESCE(m.tis,  a.time_in_s),
    time_out_s = COALESCE(m.tos,  a.time_out_s),
    time_in_c  = COALESCE(m.tic,  a.time_in_c),
    time_out_c = COALESCE(m.toc,  a.time_out_c),
    time_in_ot = COALESCE(m.tiot, a.time_in_ot),
    time_out_ot= COALESCE(m.toot, a.time_out_ot)
FROM merged m
WHERE a.id = m.keep_id;

-- (3) Xóa các dòng trùng (không phải keeper)
WITH keeper_ids AS (
  SELECT emp_id, date,
         (ARRAY_AGG(id ORDER BY
            (CASE WHEN time_in_s  ~ '^\d{1,2}:\d{2}$' THEN 1 ELSE 0 END)
          + (CASE WHEN time_out_s ~ '^\d{1,2}:\d{2}$' THEN 1 ELSE 0 END)
          + (CASE WHEN time_in_c  ~ '^\d{1,2}:\d{2}$' THEN 1 ELSE 0 END)
          + (CASE WHEN time_out_c ~ '^\d{1,2}:\d{2}$' THEN 1 ELSE 0 END)
          + (CASE WHEN time_in_ot ~ '^\d{1,2}:\d{2}$' THEN 1 ELSE 0 END)
          + (CASE WHEN time_out_ot~ '^\d{1,2}:\d{2}$' THEN 1 ELSE 0 END) DESC,
            id ASC))[1] AS keep_id
  FROM public.attendance_records
  WHERE emp_id IS NOT NULL AND emp_id <> ''
  GROUP BY emp_id, date
  HAVING COUNT(*) > 1
)
DELETE FROM public.attendance_records a
USING keeper_ids k
WHERE a.emp_id = k.emp_id AND a.date = k.date AND a.id <> k.keep_id;

-- (4) Chuẩn hóa id về dạng xác định AT-{emp_id}-{date không gạch}
--     CHỈ áp dụng cho bản ghi thật/import (KHÔNG đụng đến AT-AUTO-*). Bản auto giữ id riêng
--     để tách biệt với bản thật; dedup và ràng buộc UNIQUE sẽ xử lý (ưu tiên bản thật).
UPDATE public.attendance_records
SET id = 'AT-' || emp_id || '-' || REPLACE(date, '-', '')
WHERE emp_id IS NOT NULL AND emp_id <> ''
  AND id IS DISTINCT FROM ('AT-' || emp_id || '-' || REPLACE(date, '-', ''))
  AND id NOT LIKE 'AT-AUTO-%';

-- (5) Thêm ràng buộc duy nhất (emp_id, date) nếu chưa tồn tại
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a1 ON a1.attrelid = c.conrelid AND a1.attnum = c.conkey[1]
    JOIN pg_attribute a2 ON a2.attrelid = c.conrelid AND a2.attnum = c.conkey[2]
    WHERE c.conrelid = 'public.attendance_records'::regclass
      AND c.contype = 'u'
      AND a1.attname = 'emp_id'
      AND a2.attname = 'date'
  ) THEN
    ALTER TABLE public.attendance_records ADD CONSTRAINT attendance_records_emp_date_unique UNIQUE (emp_id, date);
  END IF;
END $$;
