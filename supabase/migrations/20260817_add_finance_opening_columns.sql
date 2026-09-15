-- =============================================================================
-- Migration: Thêm cột Công Nợ Đầu Kỳ cho bảng accounting_liabilities và
-- accounting_receivables để nút "Cập nhật Công Nợ Đầu Kỳ" lưu được lên Supabase.
--
-- Trước đây 2 bảng này chưa có cột opening_debt / is_opening_debt nên khi bấm
-- nút Cập nhật Công Nợ Đầu Kỳ, dữ liệu chỉ nằm ở state (mất sau khi reload).
-- Dùng ADD COLUMN IF NOT EXISTS nên chạy lại nhiều lần cũng an toàn.
-- =============================================================================

-- Công nợ Trả (accounting_liabilities): thiếu hoàn toàn các cột này.
ALTER TABLE public.accounting_liabilities
  ADD COLUMN IF NOT EXISTS opening_debt numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_opening_debt boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS balance_basis text;  -- 'opening' | 'contract'

COMMENT ON COLUMN public.accounting_liabilities.opening_debt IS 'Công nợ đầu kỳ (cột "Công Nợ Đầu Kỳ"); căn cứ tính Còn lại khi is_opening_debt = true';
COMMENT ON COLUMN public.accounting_liabilities.is_opening_debt IS 'true nếu là dòng Số dư đầu kỳ được đẩy từ 3 bảng master (Khách Hàng / Thầu Phụ / NCC)';
COMMENT ON COLUMN public.accounting_liabilities.balance_basis IS 'Căn cứ tính Còn lại: ''opening'' = Công Nợ Đầu Kỳ, ''contract'' = Giá Trị (VNĐ)';

-- Công nợ Thu (accounting_receivables): bảng đã có opening_debt/is_opening_debt
-- ở remote, nhưng thiếu balance_basis (gây lỗi 400 khi lưu). Thêm an toàn.
ALTER TABLE public.accounting_receivables
  ADD COLUMN IF NOT EXISTS opening_debt numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_opening_debt boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS balance_basis text,
  ADD COLUMN IF NOT EXISTS customer_id text;

COMMENT ON COLUMN public.accounting_receivables.opening_debt IS 'Công nợ đầu kỳ (cột "Công Nợ Đầu Kỳ"); căn cứ tính Còn lại khi is_opening_debt = true';
COMMENT ON COLUMN public.accounting_receivables.is_opening_debt IS 'true nếu là dòng Số dư đầu kỳ được đẩy từ Khách Hàng';
COMMENT ON COLUMN public.accounting_receivables.balance_basis IS 'Căn cứ tính Còn lại: ''opening'' = Công Nợ Đầu Kỳ, ''contract'' = Giá Trị HĐ';
COMMENT ON COLUMN public.accounting_receivables.customer_id IS 'ID Khách Hàng (Chủ đầu tư), dùng để nhóm và khớp phiếu thu theo khách hàng';
