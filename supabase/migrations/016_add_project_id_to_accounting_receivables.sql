-- ============================================================
-- Migration 016: Thêm cột project_id vào accounting_receivables
-- Dùng để liên kết Công nợ Thu tự động từ duyệt Báo Giá
-- ============================================================

ALTER TABLE public.accounting_receivables
  ADD COLUMN IF NOT EXISTS project_id TEXT,
  ADD COLUMN IF NOT EXISTS investor TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS field TEXT DEFAULT '';

COMMENT ON COLUMN public.accounting_receivables.project_id IS 'ID dự án, dùng để liên kết phiếu thu và tính collected real-time';
COMMENT ON COLUMN public.accounting_receivables.investor IS 'Chủ đầu tư (tên khách hàng)';
COMMENT ON COLUMN public.accounting_receivables.field IS 'Lĩnh vực (Xây dựng / Nội thất / Cơ khí)';
