-- Migration: bổ sung cột ghi nhận Người lập phiếu chi cho bảng subcontractor_advances
--
-- pay_creator_id   : id của Kế toán thực hiện "Lập Phiếu" (ghi nhận riêng,
--                    không đè lên trường creator/approver của đề xuất).
-- pay_creator_name : tên người lập phiếu chi (hiển thị nhanh, không phải join).
--
-- Dùng IF NOT EXISTS nên migration là idempotent, chạy lại nhiều lần không lỗi.

ALTER TABLE public.subcontractor_advances
ADD COLUMN IF NOT EXISTS pay_creator_id text,
ADD COLUMN IF NOT EXISTS pay_creator_name text;
