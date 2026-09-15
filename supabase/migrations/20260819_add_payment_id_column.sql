-- Migration: bổ sung cột payment_id cho bảng subcontractor_advances
--
-- payment_id : mã phiếu chi (id của bảng payments) được lập khi "Lập Phiếu"
--              thành công. Dùng để thẻ Đề Xuất Chi tra nhanh phiếu chi liên kết
--              (hiển thị sao kê / chứng từ) thay vì chỉ dò qua payments.related_advance_id.
--
-- Dùng IF NOT EXISTS nên migration là idempotent, chạy lại nhiều lần không lỗi.

ALTER TABLE public.subcontractor_advances
ADD COLUMN IF NOT EXISTS payment_id text;
