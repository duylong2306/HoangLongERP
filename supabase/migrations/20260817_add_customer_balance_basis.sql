-- Thêm cột lưu căn cứ tính Công Nợ Đầu Kỳ (CĐK) / Giá Trị HĐ (HĐ)
-- cho từng Khách Hàng (Chủ đầu tư) ở mức gom nhóm Công nợ Thu.
-- Dùng ADD COLUMN IF NOT EXISTS để an toàn khi chạy lại.
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS balance_basis text;  -- 'opening' | 'contract'
