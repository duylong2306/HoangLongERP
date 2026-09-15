-- ============================================================================
-- Migration 027: Tạo index trên attendance_records(date)
--
-- MỤC ĐÍCH: Khắc phục lỗi console
--   GET .../rest/v1/attendance_records?select=*&date=gte...&date=lte...
--   500 (Internal Server Error) — "canceling statement due to statement timeout"
--
-- NGUYÊN NHÂN: Bảng attendance_records chỉ có PRIMARY KEY(id), KHÔNG có index
-- trên cột date. Truy vấn theo khoảng tháng (.gte('date',..).lte('date',..)
-- .order('date', desc)) buộc Postgres quét TUẦN TỰ toàn bộ bảng + sắp xếp
-- (do bảng lịch sử chấm công đã phình to sau thời gian dài dùng) → vượt
-- statement_timeout của Supabase → 500.
--
-- SỬA: Thêm index BRIN/B-tree trên date để range scan + sort chạy trên index,
-- giảm từ seq-scan toàn bảng xuống index scan, loại bỏ timeout.
-- ============================================================================

-- B-tree index: hỗ trợ cả range filter (gte/lte) và ORDER BY date desc.
CREATE INDEX IF NOT EXISTS idx_attendance_records_date
  ON public.attendance_records (date);
