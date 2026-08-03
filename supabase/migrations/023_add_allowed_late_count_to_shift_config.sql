-- Thêm cột "Số lần đi muộn cho phép / tháng" vào bảng shift_config.
-- Khi số ngày đi muộn trong tháng của 1 nhân viên vượt quá giá trị này,
-- hệ thống tự ghi bản vi phạm đi muộn vào bảng hrm_employee_errors (Hiệu suất).
ALTER TABLE public.shift_config
ADD COLUMN IF NOT EXISTS allowed_late_count integer DEFAULT 3;
