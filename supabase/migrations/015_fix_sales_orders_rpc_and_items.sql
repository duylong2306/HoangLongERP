-- ============================================================
-- Migration 015: Fix tab Bán hàng (Tài Chính - Kế Toán)
-- Hoàng Long ERP 3.9
--
-- Bug 1: RPC load_all_core_data() thiếu 'sales_orders' → app luôn nhận
--        undefined → setSalesOrders([]) → danh sách đơn hàng bán trống.
-- Bug 2: Vì danh sách trống, generateSOCode() luôn sinh mã ...-0001
--        → upsert ghi đè hàng cũ thay vì thêm hàng mới.
-- Bug 3: Cột items (JSONB) đang chứa JSON *string* do client stringify
--        → đọc ra là string, không phải array.
-- ============================================================

-- 1. Đảm bảo bảng sales_orders tồn tại (trước đây chỉ nằm trong scripts/,
--    chưa từng được đưa vào migrations nên có thể chưa có trên remote DB)
CREATE TABLE IF NOT EXISTS public.sales_orders (
  id                 TEXT PRIMARY KEY,
  customer_id        TEXT,
  customer_name      TEXT,
  customer_phone     TEXT,
  customer_address   TEXT,
  items              JSONB DEFAULT '[]'::jsonb,
  tong_tien          REAL DEFAULT 0,
  thanh_toan_thuc_te REAL DEFAULT 0,
  cong_no            REAL DEFAULT 0,
  status             TEXT DEFAULT 'confirmed',
  receipt_id         TEXT,
  notes              TEXT,
  created_at         TEXT,
  created_by         TEXT
);

-- Cột receipt_at (thời gian lập phiếu thu) — SalesOrder.receiptAt trong types.ts
ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS receipt_at TEXT;

ALTER TABLE public.sales_orders DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.sales_orders TO anon, authenticated, service_role;

-- 2. Chuẩn hóa dữ liệu items đã lưu sai kiểu (JSON string → JSON array)
--    jsonb_typeof(items) = 'string' nghĩa là client đã stringify trước khi ghi.
UPDATE public.sales_orders
SET items = (items #>> '{}')::jsonb
WHERE items IS NOT NULL AND jsonb_typeof(items) = 'string';

UPDATE public.purchase_orders
SET items = (items #>> '{}')::jsonb
WHERE items IS NOT NULL AND jsonb_typeof(items) = 'string';

-- 3. Cập nhật RPC: bổ sung 'sales_orders' (nguyên nhân gốc của Bug 1)
CREATE OR REPLACE FUNCTION load_all_core_data()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'employees',        (SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) FROM employees e),
    'customers',        (SELECT COALESCE(jsonb_agg(c), '[]'::jsonb) FROM customers c),
    'projects',         (SELECT COALESCE(jsonb_agg(p), '[]'::jsonb) FROM projects p),
    'tasks',            (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM tasks t),
    'receipts',         (SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) FROM receipts r),
    'payments',         (SELECT COALESCE(jsonb_agg(py), '[]'::jsonb) FROM payments py),
    'quotes',           (SELECT COALESCE(jsonb_agg(q), '[]'::jsonb) FROM quotes q),
    'sales_orders',     (SELECT COALESCE(jsonb_agg(so), '[]'::jsonb) FROM sales_orders so),
    'purchase_orders',  (SELECT COALESCE(jsonb_agg(po), '[]'::jsonb) FROM purchase_orders po),
    'business_profile', (SELECT COALESCE(jsonb_agg(bp), '[]'::jsonb) FROM business_profile bp),
    'shift_config',     (SELECT COALESCE(jsonb_agg(sc), '[]'::jsonb) FROM shift_config sc)
  );
$$;

GRANT EXECUTE ON FUNCTION load_all_core_data() TO anon;
GRANT EXECUTE ON FUNCTION load_all_core_data() TO authenticated;
