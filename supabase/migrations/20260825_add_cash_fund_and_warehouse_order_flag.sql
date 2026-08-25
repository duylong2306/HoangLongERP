-- ============================================================
-- Migration 20260825: Quỹ Tiền Mặt + cờ đơn hàng nội bộ xuất từ Kho
-- Hoàng Long ERP 3.9
-- Mục đích:
--   1) Bảng cash_fund_config lưu số dư đầu kỳ Quỹ tiền mặt (bản ghi đơn/singleton).
--      Số dư hiện tại KHÔNG lưu trực tiếp — tính từ opening_balance + tổng các
--      Payment (category='cash_fund' cộng, payment_method='cash_fund' trừ) đã duyệt.
--   2) Cột from_warehouse cho purchase_orders — đánh dấu đơn nội bộ xuất từ Kho
--      có sẵn cho công trình (không phát sinh công nợ NCC).
-- ============================================================

-- 1. Bảng cấu hình Quỹ tiền mặt
CREATE TABLE IF NOT EXISTS public.cash_fund_config (
  id              TEXT PRIMARY KEY,
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  opening_date    DATE,
  updated_at      TIMESTAMPTZ,
  updated_by      TEXT
);

GRANT ALL ON TABLE public.cash_fund_config TO anon, authenticated, service_role;

-- 2. Cờ đơn hàng nội bộ xuất từ Kho (không công nợ) trên purchase_orders
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS from_warehouse BOOLEAN DEFAULT FALSE;
