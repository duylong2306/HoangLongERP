-- ============================================================
-- Hoàng Long ERP 3.9 — Bảng Đơn hàng bán (Sales Orders)
-- Chạy trong Supabase SQL Editor
-- ============================================================

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

-- Tắt RLS (giống pattern các bảng khác trong hệ thống)
ALTER TABLE public.sales_orders DISABLE ROW LEVEL SECURITY;
