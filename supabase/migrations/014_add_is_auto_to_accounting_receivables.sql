-- ============================================================
-- Migration 014: Thêm cột is_auto, remaining vào accounting_receivables
-- Fix: Khi lưu công nợ phải thu Supabase thiếu cột is_auto, remaining
-- ============================================================

ALTER TABLE public.accounting_receivables
  ADD COLUMN IF NOT EXISTS is_auto BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS remaining REAL DEFAULT 0;

COMMENT ON COLUMN public.accounting_receivables.is_auto IS 'true nếu được tự động tạo từ dự án, false nếu nhập thủ công';
COMMENT ON COLUMN public.accounting_receivables.remaining IS 'Số tiền còn lại = contract_value - collected';
