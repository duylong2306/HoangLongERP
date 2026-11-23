-- Đổi các cột tiền từ real (float 32-bit, ~7 chữ số có nghĩa) sang numeric(18,0)
-- để lưu CHÍNH XÁC từng đồng (real làm tròn số >= 16.777.216, từ 67 triệu bước nhảy 8 đồng).
-- Lưu ý: đổi kiểu KHÔNG khôi phục được số đã bị làm tròn — xem bước khôi phục riêng.
-- Chạy từng khối; trước khi chạy hãy kiểm tra view/hàm phụ thuộc (khối 0).

-- 0) Kiểm tra view phụ thuộc vào các bảng này (kết quả rỗng = an toàn để đổi kiểu)
-- select distinct v.relname as view_name, t.relname as table_name
-- from pg_depend d
-- join pg_rewrite r on r.oid = d.objid
-- join pg_class v on v.oid = r.ev_class
-- join pg_class t on t.oid = d.refobjid
-- where t.relname in ('accounting_product_catalog','accounting_receivables','purchase_orders','sales_orders','supplier_returns')
--   and v.relkind = 'v';

begin;

alter table accounting_product_catalog alter column don_gia type numeric(18,0) using round(don_gia::numeric);
alter table accounting_receivables     alter column remaining type numeric(18,0) using round(remaining::numeric);

alter table purchase_orders alter column tong_tien          type numeric(18,0) using round(tong_tien::numeric);
alter table purchase_orders alter column thanh_toan_thuc_te type numeric(18,0) using round(thanh_toan_thuc_te::numeric);
alter table purchase_orders alter column cong_no            type numeric(18,0) using round(cong_no::numeric);

alter table sales_orders alter column tong_tien          type numeric(18,0) using round(tong_tien::numeric);
alter table sales_orders alter column thanh_toan_thuc_te type numeric(18,0) using round(thanh_toan_thuc_te::numeric);
alter table sales_orders alter column cong_no            type numeric(18,0) using round(cong_no::numeric);

alter table supplier_returns alter column applied_amount type numeric(18,0) using round(applied_amount::numeric);
alter table supplier_returns alter column total_amount   type numeric(18,0) using round(total_amount::numeric);

commit;
