-- ============================================================
-- Migration 009: Thêm bảng purchase_orders + cập nhật RPC
-- Hoàng Long ERP 3.9
-- ============================================================

-- 1. Tạo bảng purchase_orders (tương tự sales_orders)
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id                 TEXT PRIMARY KEY,
  supplier_id        TEXT,
  supplier_name      TEXT,
  supplier_phone     TEXT,
  supplier_address   TEXT,
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

-- Tắt RLS
ALTER TABLE public.purchase_orders DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.purchase_orders TO anon, authenticated, service_role;

-- 2. Cập nhật RPC function load_all_core_data() để bao gồm purchase_orders
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
    'purchase_orders',  (SELECT COALESCE(jsonb_agg(po), '[]'::jsonb) FROM purchase_orders po),
    'business_profile', (SELECT COALESCE(jsonb_agg(bp), '[]'::jsonb) FROM business_profile bp),
    'shift_config',     (SELECT COALESCE(jsonb_agg(sc), '[]'::jsonb) FROM shift_config sc)
  );
$$;

-- Grant quyền thực thi
GRANT EXECUTE ON FUNCTION load_all_core_data() TO anon;
GRANT EXECUTE ON FUNCTION load_all_core_data() TO authenticated;