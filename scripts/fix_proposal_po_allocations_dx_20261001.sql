-- ============================================================================
-- Sửa 2 đề xuất Chi Nhà Cung Cấp lập TRƯỚC tính năng "chọn đơn hàng thanh toán":
--   DX-20261001-0007  (Lâm Đồng, 97.362.500đ,  phiếu chi PC-2026-462, theo hóa đơn 12989)
--   DX-20261001-0006  (Đăng Phong, 16.080.000đ, phiếu chi PC-2026-629)
-- Phiếu chi đã duyệt nhưng KHÔNG trừ vào đơn hàng nào → đơn vẫn hiện "chưa thanh toán".
--
-- Số tiền khớp tuyệt đối với đơn:
--   97.362.500 = PO-1788765479633-0 (Lâm Đồng)
--   16.080.000 = PO-1789098803564-0 (10.720.000) + PO-1789378761483-0 (5.360.000) (Đăng Phong)
--
-- Việc làm (cùng công thức app dùng khi lập phiếu): thanh_toan_thuc_te = tong_tien, cong_no = 0,
-- status 'completed'. Đồng thời ghi lại purchase_order_allocations vào đề xuất để sau này xóa
-- phiếu chi thì app hoàn lại đúng từng đơn.
--
-- AN TOÀN: chỉ sửa khi đơn còn thanh_toan_thuc_te = 0 và đề xuất chưa có allocations
-- → chạy lại lần 2 sẽ KHÔNG trừ lần nữa. Toàn bộ trong 1 transaction.
-- ============================================================================
begin;

-- 1) Đơn hàng: ghi nhận đã thanh toán đủ
update public.purchase_orders
set thanh_toan_thuc_te = tong_tien,
    cong_no            = 0,
    status             = 'completed'
where id in ('PO-1788765479633-0', 'PO-1789098803564-0', 'PO-1789378761483-0')
  and coalesce(thanh_toan_thuc_te, 0) = 0;

-- 2) Đề xuất: lưu số tiền đã áp dụng cho từng đơn (để hoàn lại khi xóa phiếu chi)
update public.subcontractor_advances
set purchase_order_allocations =
      '[{"purchaseOrderId":"PO-1788765479633-0","amount":97362500}]'::jsonb
where id = 'DX-20261001-0007'
  and purchase_order_allocations is null;

update public.subcontractor_advances
set purchase_order_allocations =
      '[{"purchaseOrderId":"PO-1789098803564-0","amount":10720000},{"purchaseOrderId":"PO-1789378761483-0","amount":5360000}]'::jsonb
where id = 'DX-20261001-0006'
  and purchase_order_allocations is null;

-- 3) Kiểm tra kết quả (mong đợi: 3 đơn thanh_toan = tong_tien, cong_no = 0; 2 đề xuất có allocations)
select 'don_hang' as loai, id, tong_tien::text as a, thanh_toan_thuc_te::text as b, cong_no::text as c, status as d
from public.purchase_orders
where id in ('PO-1788765479633-0', 'PO-1789098803564-0', 'PO-1789378761483-0')
union all
select 'de_xuat', id, amount::text, purchase_order_allocations::text, null, status
from public.subcontractor_advances
where id in ('DX-20261001-0007', 'DX-20261001-0006')
order by 1, 2;

commit;
