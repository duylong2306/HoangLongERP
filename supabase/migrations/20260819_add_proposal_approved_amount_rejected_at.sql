-- Migration: bổ sung cột approved_amount và rejected_at cho bảng subcontractor_advances
--
-- approved_amount : "Số tiền duyệt chi" do người xét duyệt nhập. Người lập phiếu ("Lập phiếu")
--                  sẽ lập phiếu chi dựa trên số tiền này. Trường amount giữ nguyên làm
--                  "Số tiền đề xuất" để tham chiếu lịch sử.
-- rejected_at     : ISO timestamp lúc Đề Xuất bị Từ Chối. Dùng để tự động xóa vĩnh viễn
--                  sau 30 ngày trong Thùng rác (giống Đề xuất vật tư).
--
-- Dùng IF NOT EXISTS nên migration là idempotent, chạy lại nhiều lần không lỗi.

ALTER TABLE public.subcontractor_advances
ADD COLUMN IF NOT EXISTS approved_amount numeric,
ADD COLUMN IF NOT EXISTS rejected_at text;
