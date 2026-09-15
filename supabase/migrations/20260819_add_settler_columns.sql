-- Migration: bổ sung cột Người quyết toán cho bảng hrm_approval_config
--
-- settler_id       : id nhân viên kế toán thực hiện lập phiếu chi / quyết toán
-- settler_name     : tên người quyết toán (hiển thị nhanh, không phải join)
-- settler_position : chức vụ người quyết toán
--
-- Dùng IF NOT EXISTS nên migration là idempotent, chạy lại nhiều lần không lỗi.

ALTER TABLE public.hrm_approval_config
ADD COLUMN IF NOT EXISTS settler_id text,
ADD COLUMN IF NOT EXISTS settler_name text,
ADD COLUMN IF NOT EXISTS settler_position text;
