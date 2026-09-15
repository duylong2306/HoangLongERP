-- ============================================================
-- Hoàng Long ERP 3.9 — Bảng Danh mục sản phẩm kế toán
-- Chạy trong Supabase SQL Editor
-- ============================================================

-- Tạo bảng nếu chưa có
CREATE TABLE IF NOT EXISTS public.accounting_product_catalog (
  id            TEXT PRIMARY KEY,
  ten_san_pham  TEXT NOT NULL,
  don_gia       REAL DEFAULT 0
);

-- Tắt RLS (cho phép anonymous key truy cập tự do, giống các bảng khác)
ALTER TABLE public.accounting_product_catalog DISABLE ROW LEVEL SECURITY;

-- Nếu muốn bật RLS thì dùng policy cho phép tất cả:
-- ALTER TABLE public.accounting_product_catalog ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all for anon" ON public.accounting_product_catalog
--   FOR ALL USING (true) WITH CHECK (true);
