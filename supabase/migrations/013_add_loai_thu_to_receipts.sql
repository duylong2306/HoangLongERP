-- ============================================================
-- Migration 013: Thêm cột loai_thu vào receipts
-- Fix: Phiếu thu khi lưu có loaiThu nhưng Supabase thiếu cột → upsert fail
-- Giá trị mặc định: 'ban_hang' (Bán lẻ)
-- ============================================================

-- ============================================================
-- Migration 013: Thêm cột loai_thu, sales_order_id, receipt_at vào receipts
-- Fix: Phiếu thu khi lưu có các trường mới nhưng Supabase thiếu cột → upsert fail
-- ============================================================

-- Thêm cột loai_thu (phân loại phiếu thu)
ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS loai_thu TEXT DEFAULT 'ban_hang';

COMMENT ON COLUMN public.receipts.loai_thu IS 'Phân loại phiếu thu: du_an, ban_hang, de_xuat. Mặc định: ban_hang';

-- Thêm cột sales_order_id (liên kết đơn hàng bán)
ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS sales_order_id TEXT;

COMMENT ON COLUMN public.receipts.sales_order_id IS 'FK → sales_orders.id — Liên kết với đơn hàng bán';

-- Thêm cột receipt_at (thời gian lập phiếu thu)
ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS receipt_at TEXT;

COMMENT ON COLUMN public.receipts.receipt_at IS 'Ngày giờ lập phiếu thu — ISO string. Mặc định: thời điểm tạo phiếu thu';
