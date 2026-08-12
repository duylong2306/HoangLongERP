/**
 * Supabase migration: warehouse product catalogs (Danh mục MUA / Danh mục BÁN)
 *
 * Tạo 2 bảng phục vụ menu con "Dữ liệu Kho":
 *   - purchase_product_catalog : Danh mục MUA (mã tự sinh SPM-xxx)
 *   - sales_product_catalog    : Danh mục BÁN (mã tự sinh SPB-xxx)
 *
 * Khóa chính là ma_san_pham (TEXT) — tự sinh ở client với prefix SPM / SPB.
 * RLS dùng policy public (anon) — giống business_profile / shift_config,
 * vì app chạy với anon key (không dùng luồng đăng nhập Supabase).
 */

-- Function to auto-update the updated_at timestamp (idempotent — an toàn khi chạy lại)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── Danh mục MUA ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_product_catalog (
  ma_san_pham  TEXT PRIMARY KEY,      -- Mã sản phẩm Mua (khóa chính, tự sinh SPM-xxx)
  ten_san_pham TEXT NOT NULL,         -- Tên sản phẩm Mua
  don_vi_tinh  TEXT,                  -- Đơn vị tính
  don_gia      NUMERIC DEFAULT 0,     -- Đơn giá
  quy_cach     TEXT,                  -- Quy cách
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- RLS policies (public read/write, giống business_profile)
ALTER TABLE public.purchase_product_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "purchase_product_catalog_public_all" ON public.purchase_product_catalog;
CREATE POLICY "purchase_product_catalog_public_all"
  ON public.purchase_product_catalog
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_purchase_product_catalog_updated_at ON public.purchase_product_catalog;
CREATE TRIGGER trg_purchase_product_catalog_updated_at
  BEFORE UPDATE ON public.purchase_product_catalog
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Index tìm kiếm nhanh theo tên
CREATE INDEX IF NOT EXISTS idx_purchase_product_catalog_ten_san_pham
  ON public.purchase_product_catalog(ten_san_pham);

-- ─── Danh mục BÁN ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sales_product_catalog (
  ma_san_pham  TEXT PRIMARY KEY,      -- Mã sản phẩm Bán (khóa chính, tự sinh SPB-xxx)
  ten_san_pham TEXT NOT NULL,         -- Tên sản phẩm Bán
  don_vi_tinh  TEXT,                  -- Đơn vị tính
  don_gia      NUMERIC DEFAULT 0,     -- Đơn giá
  quy_cach     TEXT,                  -- Quy cách
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- RLS policies (public read/write)
ALTER TABLE public.sales_product_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sales_product_catalog_public_all" ON public.sales_product_catalog;
CREATE POLICY "sales_product_catalog_public_all"
  ON public.sales_product_catalog
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_sales_product_catalog_updated_at ON public.sales_product_catalog;
CREATE TRIGGER trg_sales_product_catalog_updated_at
  BEFORE UPDATE ON public.sales_product_catalog
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Index tìm kiếm nhanh theo tên
CREATE INDEX IF NOT EXISTS idx_sales_product_catalog_ten_san_pham
  ON public.sales_product_catalog(ten_san_pham);
