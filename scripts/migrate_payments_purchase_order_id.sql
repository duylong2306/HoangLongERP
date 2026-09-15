-- ============================================================
-- Hoàng Long ERP 3.9 — Thêm cột purchase_order_id cho bảng payments
-- (Liên kết phiếu chi thanh toán đơn hàng mua từ Đề xuất vật tư)
-- Chạy trong Supabase SQL Editor
-- ============================================================

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS purchase_order_id text;

-- Tắt RLS (giống pattern các bảng khác trong hệ thống)
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;

-- Cho phép tất cả role (giống như payments hiện tại)
GRANT ALL ON TABLE public.payments TO anon, authenticated, service_role;

-- Reload PostgREST schema cache (nếu vẫn báo "could not find column", chạy thêm dòng sau trong SQL Editor)
-- NOTIFY pgrst, 'reload schema';
