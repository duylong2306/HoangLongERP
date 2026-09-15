-- =============================================================================
-- Migration 038: Link payment vouchers (phiếu chi) to subcontractor advances
-- and to Công nợ Trả (accounting_liabilities).
--
-- Bug: When a user created a payment voucher from a "Đề xuất tạm ứng thầu phụ"
-- via the "Lập phiếu (KT)" button, dbService tried to upsert the payment with
-- subcontractor_id / related_advance_id keys, but those columns did not exist
-- on the payments table, so the upsert threw and the payment was never saved
-- (and Công nợ Trả was never updated).
--
-- Fix: add the link columns to payments and to accounting_liabilities so the
-- advance -> payment -> Công nợ Trả chain persists correctly.
-- =============================================================================

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS subcontractor_id text,
  ADD COLUMN IF NOT EXISTS related_advance_id text;

ALTER TABLE public.accounting_liabilities
  ADD COLUMN IF NOT EXISTS related_advance_id text,
  ADD COLUMN IF NOT EXISTS subcontractor_id text;

-- Enable realtime for the affected tables (safe to re-run)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'payments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END
$$;
