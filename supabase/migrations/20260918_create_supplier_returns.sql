-- ============================================================
-- Migration: Tạo bảng supplier_returns (Chứng từ Trả Hàng NCC)
-- Hoàng Long ERP 3.9
--
-- Chứng từ ĐỘC LẬP với purchase_orders/material_proposals — không sửa đơn
-- hàng/đề xuất gốc để giữ nguyên lịch sử đã nhận hàng. Khi xác nhận, tạo ra
-- "Số dư Có" của NCC (tính động = SUM(total_amount - applied_amount) theo
-- supplierId, không lưu field số dư riêng — xem FinanceManagement.tsx).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.supplier_returns (
  id                 TEXT PRIMARY KEY,
  purchase_order_id  TEXT,
  proposal_id        TEXT,
  proposal_code      TEXT,
  project_id         TEXT,
  project_name       TEXT,
  supplier_id        TEXT,
  supplier_name      TEXT,
  items              JSONB DEFAULT '[]'::jsonb,
  total_amount       REAL DEFAULT 0,
  reason             TEXT,
  status             TEXT DEFAULT 'confirmed',
  applied_amount     REAL DEFAULT 0,
  applications       JSONB DEFAULT '[]'::jsonb,
  created_by         TEXT,
  created_by_name    TEXT,
  created_at         TEXT,
  updated_at         TEXT
);

CREATE INDEX IF NOT EXISTS idx_supplier_returns_supplier_id ON public.supplier_returns (supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_returns_purchase_order_id ON public.supplier_returns (purchase_order_id);

-- Tắt RLS, đồng bộ đúng cách đang áp dụng cho các bảng khác trong dự án
ALTER TABLE public.supplier_returns DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.supplier_returns TO anon, authenticated, service_role;
