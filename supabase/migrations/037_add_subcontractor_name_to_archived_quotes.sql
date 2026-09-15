-- Migration: Thêm cột subcontractor_name vào bảng archived_quotes
--
-- NGUYÊN NHÂN: Trước đây bảng archived_quotes chỉ lưu subcontractor_id, không lưu
-- subcontractor_name. Lớp dbService (archivedQuotes.save/list) cũng dùng whitelist
-- cố định bỏ quên trường subcontractorName. Hậu quả: khi Hợp Đồng Thầu Phụ được duyệt
-- và đồng bộ sang Công nợ Trả, giá trị HĐ (contract_value) hiển thị đúng nhưng
-- Tên Thầu Phụ thì trống (vì subcontractorName không bao giờ được ghi/đọc).
--
-- Migration này:
--   1. Thêm cột subcontractor_name text vào archived_quotes.
--   2. Backfill: điền tên thầu phụ cho các HĐ đã có subcontractor_id khớp với
--      bảng danh sách thầu phụ (accounting_subcontractors).
--   3. Bật realtime cho bảng (nếu chưa) để UI tự động cập nhật.

-- 1. Thêm cột
ALTER TABLE IF EXISTS public.archived_quotes
  ADD COLUMN IF NOT EXISTS subcontractor_name text;

-- 2. Backfill tên thầu phụ từ bảng danh sách thầu phụ
UPDATE public.archived_quotes aq
SET subcontractor_name = s.name
FROM public.accounting_subcontractors s
WHERE aq.subcontractor_id = s.id
  AND (aq.subcontractor_name IS NULL OR aq.subcontractor_name = '')
  AND s.name IS NOT NULL
  AND s.name <> '';

-- 3. Bật realtime cho bảng archived_quotes (bỏ qua nếu đã có trong publication)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.archived_quotes;
    RAISE NOTICE '✅ Added archived_quotes to realtime publication';
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE '⏭ archived_quotes already in publication';
  END;
END $$;
