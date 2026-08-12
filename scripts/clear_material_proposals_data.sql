-- ============================================================
-- Hoàng Long ERP 3.9 — XÓA TOÀN BỘ DỮ LIỆU ĐỀ XUẤT VẬT TƯ
-- ⚠️ THAO TÁC KHÔNG THỂ HOÀN TÁC — Hãy backup nếu cần!
-- Chạy trong Supabase SQL Editor
--
-- Xóa sạch 3 bảng liên quan đến chuỗi vật tư:
--   • material_proposals   (Đề xuất vật tư)
--   • purchase_orders      (Đơn hàng mua sinh ra từ đề xuất)
--   • accounting_liabilities (Công nợ Trả — bao gồm cả NCC và Thầu Phụ)
-- ============================================================

-- Xóa theo thứ tự không phụ thuộc (không có FK giữa 3 bảng này)
DELETE FROM public.accounting_liabilities;
DELETE FROM public.purchase_orders;
DELETE FROM public.material_proposals;

-- (Tùy chọn) Reload cache schema nếu cần
-- NOTIFY pgrst, 'reload schema';
