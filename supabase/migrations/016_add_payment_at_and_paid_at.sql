-- ============================================================
-- Migration 016: Thêm cột payment_at vào payments và paid_at vào accounting_liabilities
-- Hoàng Long ERP 3.9
-- ============================================================

-- Thêm cột payment_at vào payments (thời gian lập phiếu chi tùy chỉnh)
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_at TEXT;

COMMENT ON COLUMN public.payments.payment_at IS 'Thời gian lập phiếu chi tùy chỉnh — ISO string. Nếu NULL thì dùng date';

-- Thêm cột paid_at vào accounting_liabilities (thời gian thanh toán gần nhất)
ALTER TABLE public.accounting_liabilities
  ADD COLUMN IF NOT EXISTS paid_at TEXT;

COMMENT ON COLUMN public.accounting_liabilities.paid_at IS 'Thời gian thanh toán gần nhất — ISO string';
