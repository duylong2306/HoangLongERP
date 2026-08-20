-- =============================================================================
-- Migration: Liên kết Đơn mua hàng (purchase_orders) với Đề xuất vật tư nguồn
-- Hoàng Long ERP 3.9
-- =============================================================================
-- Cho phép hiển thị "Mã Đề Xuất" trong Chi tiết đơn hàng và mở được detail
-- Đề Xuất Vật Tư tương ứng từ tab Đơn Hàng. PO nhập tay sẽ để trống 2 trường này.
-- =============================================================================

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS proposal_id text,
  ADD COLUMN IF NOT EXISTS proposal_code text;

COMMENT ON COLUMN public.purchase_orders.proposal_id IS 'FK → material_proposals.id (nếu đơn tạo từ Đề Xuất Vật Tư)';
COMMENT ON COLUMN public.purchase_orders.proposal_code IS 'Mã đề xuất nguồn (hiển thị)';

-- Bảng đã tắt RLS; cấp ALL cho các role giống các bảng khác trong hệ thống.
GRANT ALL ON TABLE public.purchase_orders TO anon, authenticated, service_role;
