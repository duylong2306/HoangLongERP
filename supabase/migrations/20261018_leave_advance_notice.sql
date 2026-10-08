-- QUY ĐỊNH "XIN NGHỈ PHÉP PHẢI BÁO TRƯỚC" — cấu hình trong Cấu Hình Ca (bảng shift_config, mỗi doanh nghiệp 1 dòng).
--   leave_advance_days  : số ngày phải xin phép trước (nhập được số thập phân, VD 0.5 = 12 giờ). Mặc định 1. 0 = không yêu cầu.
--   leave_advance_block : true = CHẶN không cho nộp đơn khi xin muộn; false (mặc định) = vẫn cho nộp nhưng đánh dấu "Xin muộn" cho người duyệt.
-- Chạy trong SQL Editor của Supabase LoLo TRƯỚC khi triển khai bản ứng dụng có tính năng này. Chạy lại nhiều lần an toàn.
ALTER TABLE public.shift_config
  ADD COLUMN IF NOT EXISTS leave_advance_days  numeric DEFAULT 1,
  ADD COLUMN IF NOT EXISTS leave_advance_block boolean DEFAULT false;

-- Kiểm tra: phải thấy 2 cột mới và mỗi doanh nghiệp có giá trị 1 / false
SELECT company_id, leave_advance_days, leave_advance_block FROM public.shift_config;
