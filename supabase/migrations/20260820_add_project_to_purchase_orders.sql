-- ============================================================
-- Migration 20260820: Thêm cột Dự án cho bảng purchase_orders
-- Hoàng Long ERP 3.9
-- Mục đích: cho phép gắn dự án (công trình) vào từng đơn hàng mua,
-- và hiển thị cột "Dự án" trong danh sách Đơn Hàng (Tài Chính - Kế Toán).
-- ============================================================

-- 1. Thêm cột project_id (FK mềm tới projects.id) và project_name (cache tên)
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS project_id   TEXT,
  ADD COLUMN IF NOT EXISTS project_name TEXT;

-- 2. Index nhẹ để lọc theo dự án nhanh hơn
CREATE INDEX IF NOT EXISTS idx_purchase_orders_project_id
  ON public.purchase_orders (project_id);

-- 3. Đảm bảo quyền truy cập (bảng đã tắt RLS từ migration 009, nhưng cấp lại cho chắc chắn)
GRANT ALL ON TABLE public.purchase_orders TO anon, authenticated, service_role;

-- 4. RPC load_all_core_data dùng jsonb_agg(po) nên tự động bao gồm cột mới,
--    không cần sửa function. Chỉ cần đảm bảo schema cache được làm mới.
--    (Supabase tự động nhận cột mới sau khi chạy migration này.)
