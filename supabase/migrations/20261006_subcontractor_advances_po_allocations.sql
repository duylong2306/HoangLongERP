-- ============================================================================
-- Đề xuất "Chi Nhà Cung Cấp": cho phép chọn các Đơn Mua Hàng (PO) mà khoản chi
-- thanh toán. Lưu mảng [{ "purchaseOrderId": "PO-...", "amount": 123000 }, ...].
--
-- Vì sao cần: trước đây phiếu chi sinh từ đề xuất không gắn đơn hàng nào nên
-- công nợ từng đơn (thanh_toan_thuc_te / cong_no) không bao giờ giảm dù tiền
-- đã chi (vd DX-20261001-0007, DX-20261001-0006).
--
-- Cột nullable, KHÔNG có giá trị mặc định → các đề xuất cũ không bị ảnh hưởng.
-- An toàn chạy trên production TRƯỚC khi deploy bản code mới (code cũ bỏ qua cột này).
-- ============================================================================
alter table public.subcontractor_advances
  add column if not exists purchase_order_allocations jsonb;
