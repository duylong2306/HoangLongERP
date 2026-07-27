-- ============================================================
-- Hoàng Long ERP 3.9 — Bảng Đơn mua hàng (Purchase Orders)
-- Chạy trong Supabase SQL Editor
-- ============================================================

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

-- Tắt RLS (giống pattern các bảng khác trong hệ thống)
ALTER TABLE public.purchase_orders DISABLE ROW LEVEL SECURITY;

-- Cho phép tất cả role (giống như sales_orders)
GRANT ALL ON TABLE public.purchase_orders TO anon, authenticated, service_role;