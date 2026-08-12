-- ============================================================
-- Hoàng Long ERP 3.9 — Bảng Đề xuất vật tư theo luồng mới
-- (Material Proposals — luồng cung ứng vật tư 6 trạng thái)
-- Chạy trong Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.material_proposals (
  id                 TEXT PRIMARY KEY,
  code               TEXT,
  project_id         TEXT,
  project_name       TEXT,
  task_id            TEXT,
  task_name          TEXT,
  proposal_type      TEXT DEFAULT 'material',
  created_by         TEXT,
  created_by_name    TEXT,
  status             TEXT DEFAULT 'find_supplier',  -- find_supplier | waiting_approval | waiting_order | ordered | received | cancelled
  items              JSONB DEFAULT '[]'::jsonb,     -- [{name,qty,unit,spec,note,maSanPham,supplierId,supplierName,price,totalPrice}]
  supplier_id        TEXT,
  supplier_name      TEXT,
  quotes             JSONB DEFAULT '[]'::jsonb,     -- [{id,supplierId,supplierName,items:[{price,totalPrice}],createdAt,createdBy,createdByName}]
  chosen_quote_id    TEXT,
  purchase_order_ids JSONB DEFAULT '[]'::jsonb,
  debt_recorded      BOOLEAN DEFAULT FALSE,
  notes              TEXT,
  created_at         TEXT,
  updated_at         TEXT
);

-- Tắt RLS (giống pattern các bảng khác trong hệ thống)
ALTER TABLE public.material_proposals DISABLE ROW LEVEL SECURITY;

-- Cho phép tất cả role (giống như purchase_orders)
GRANT ALL ON TABLE public.material_proposals TO anon, authenticated, service_role;
