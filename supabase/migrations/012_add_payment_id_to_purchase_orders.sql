-- ============================================================
-- Migration 012: Thêm cột payment_id vào purchase_orders
-- Fix: Đơn mua hàng khi tạo có paymentId nhưng Supabase thiếu cột → upsert fail
-- ============================================================

-- Thêm cột payment_id (liên kết phiếu chi tự động)
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS payment_id TEXT;

COMMENT ON COLUMN public.purchase_orders.payment_id IS 'FK → payments.id — Phiếu chi tự động khi tạo đơn mua có thanh toán > 0';
