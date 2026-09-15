-- Thêm các cột khóa ngoại (FK) theo MÃ cho phiếu thu & phiếu chi,
-- để truy xuất thông tin CHÍNH XÁC 100% (thay vì ghép theo tên).
-- Dùng ADD COLUMN IF NOT EXISTS để an toàn khi chạy lại.

-- Phiếu thu (receipts)
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS collector_id text;        -- Mã nhân viên người thu
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS sales_order_id text;      -- FK → sales_orders (Đơn hàng bán)

-- Phiếu chi (payments)
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS employee_id text;         -- Mã nhân viên (ứng lương / nhận chi)
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS supplier_id text;         -- Mã nhà cung cấp (NCC)
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS proposer_id text;         -- Mã nhân viên người lập/đề xuất
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS approver_id text;          -- Mã nhân viên người duyệt
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS purchase_order_id text;    -- FK → purchase_orders (Đơn hàng mua)

-- (Lưu ý: subcontractor_id, related_advance_id, project_id đã tồn tại trên payments;
--  customer_id, project_id đã tồn tại trên receipts.)
