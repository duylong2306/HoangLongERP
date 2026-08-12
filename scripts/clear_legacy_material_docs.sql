-- ============================================================
-- Hoàng Long ERP 3.9 — XÓA ĐỀ XUẤT VẬT TƯ PHIÊN BẢN CŨ
-- (legacy material docs nằm trong projects.documents)
-- ⚠️ Thao tác không thể hoàn tác — hãy backup nếu cần!
-- Chạy trong Supabase SQL Editor
--
-- Lưu ý: Kịch bản này CHỈ xóa các phần tử trong mảng documents
-- khớp tiêu chí isLegacyMaterialDoc (code chứa 'mat-', id chứa
-- 'doc_mat_', có mảng 'materials', hoặc templateName đúng).
-- Các tài liệu khác của công trình được GIỮ NGUYÊN.
-- ============================================================

UPDATE public.projects
SET documents = (
  SELECT COALESCE(jsonb_agg(d), '[]'::jsonb)
  FROM jsonb_array_elements(COALESCE(documents, '[]'::jsonb)) AS d
  WHERE NOT (
    (d->>'code' IS NOT NULL AND lower(d->>'code') LIKE '%mat-%')
    OR (d->>'id'   IS NOT NULL AND lower(d->>'id')   LIKE '%doc_mat_%')
    OR (d ? 'materials' AND jsonb_typeof(d->'materials') = 'array')
    OR (d->>'templateName' = 'Bản thô đặt sản xuất phôi Hoàng Long')
  )
)
WHERE documents IS NOT NULL
  AND jsonb_array_length(documents) > 0;

-- (Tùy chọn) Reload cache schema nếu cần
-- NOTIFY pgrst, 'reload schema';
