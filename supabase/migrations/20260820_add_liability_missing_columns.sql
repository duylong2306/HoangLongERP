-- =============================================================================
-- Migration: Thêm các cột còn thiếu vào bảng accounting_liabilities
-- Hoàng Long ERP 3.9
-- =============================================================================
-- Nguyên nhân: code ghi các trường recordedPurchaseOrderIds, date, isAuto vào
-- bảng accounting_liabilities, nhưng những cột này chưa tồn tại trong schema
-- (chỉ có ở interface Liability, chưa có migration tương ứng). Khi lưu Công nợ
-- Trả / ghi nhận PO vào công nợ, PostgREST trả lỗi:
--   "Could not find the 'recorded_purchase_order_ids' column ..."
-- Fix: thêm cột (idempotent, an toàn chạy lại nhiều lần).
-- =============================================================================

ALTER TABLE public.accounting_liabilities
  ADD COLUMN IF NOT EXISTS recorded_purchase_order_ids text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS date text,
  ADD COLUMN IF NOT EXISTS is_auto boolean DEFAULT false;

COMMENT ON COLUMN public.accounting_liabilities.recorded_purchase_order_ids
  IS 'Các mã Đơn mua hàng (PO) đã ghi nhận vào công nợ này';
COMMENT ON COLUMN public.accounting_liabilities.date
  IS 'Ngày phát sinh / ghi nhận công nợ (YYYY-MM-DD) — dùng cho lọc theo ngày';
COMMENT ON COLUMN public.accounting_liabilities.is_auto
  IS 'Tạo tự động (vd: từ phiếu chi tạm ứng thầu phụ)';

-- Bảng đã tắt RLS; cấp ALL cho các role giống các bảng khác trong hệ thống.
GRANT ALL ON TABLE public.accounting_liabilities TO anon, authenticated, service_role;
