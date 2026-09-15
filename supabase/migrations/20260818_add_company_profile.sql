-- Thêm Hồ sơ Thông tin doanh nghiệp (header Đơn Mua Hàng)
-- Lưu dưới dạng jsonb trong bảng shift_config (cùng hàng cấu hình hệ thống).
ALTER TABLE public.shift_config ADD COLUMN IF NOT EXISTS company_profile jsonb;
