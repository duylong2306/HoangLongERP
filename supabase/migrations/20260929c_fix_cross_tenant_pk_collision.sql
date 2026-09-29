-- ============================================================================
-- HOTFIX (rà soát bảo mật multi-tenant menu-by-menu): 11 bảng có PK đơn (chỉ
-- `id` hoặc `ma_san_pham`) mà giá trị khoá lại được sinh từ MÃ NGƯỜI DÙNG TỰ
-- NHẬP khi nhập Excel (vd "Mã NV", "Mã KH", "Mã SP", "Mã Vật Tư"...) — KHÔNG
-- đảm bảo duy nhất giữa các công ty. Nếu công ty A và công ty B cùng có nhân
-- viên/khách hàng/vật tư trùng mã (vd cả 2 đều có "NV001"), dòng của công ty
-- sau sẽ đụng khoá chính với dòng của công ty trước → bị RLS chặn UPDATE
-- (company_id không khớp) — CÙNG lỗi đã phát hiện & vá ở nhóm bảng cấu hình
-- singleton (business_profile, shift_config...) trước đó, nay lan sang nhóm
-- bảng nghiệp vụ có thể nhập liệu qua Excel.
--
-- Vá: đổi PK sang khoá ghép (company_id, <cột gốc>) — mỗi công ty tự do dùng
-- lại mã nào cũng được, không đụng công ty khác. dbService.ts (saveSupabase)
-- đã được cập nhật truyền đúng onConflict tương ứng cho từng bảng.
-- ============================================================================

begin;

-- customers: có 4 bảng khác tham chiếu FK đơn tới customers.id (archived_quotes,
-- projects, quotes, receipts) — phải drop + tạo lại các FK đó thành khoá ghép
-- (company_id, customer_id) TRƯỚC khi đổi PK, nếu không Postgres sẽ từ chối
-- đổi PK vì customers.id không còn unique-đơn để các FK cũ tham chiếu.
alter table public.archived_quotes drop constraint if exists archived_quotes_customer_id_fkey;
alter table public.projects drop constraint if exists projects_customer_id_fkey;
alter table public.quotes drop constraint if exists quotes_customer_id_fkey;
alter table public.receipts drop constraint if exists receipts_customer_id_fkey;

alter table public.customers drop constraint if exists customers_pkey;
alter table public.customers add primary key (company_id, id);

alter table public.archived_quotes add constraint archived_quotes_customer_id_fkey
  foreign key (company_id, customer_id) references public.customers (company_id, id);
alter table public.projects add constraint projects_customer_id_fkey
  foreign key (company_id, customer_id) references public.customers (company_id, id);
alter table public.quotes add constraint quotes_customer_id_fkey
  foreign key (company_id, customer_id) references public.customers (company_id, id);
alter table public.receipts add constraint receipts_customer_id_fkey
  foreign key (company_id, customer_id) references public.customers (company_id, id);

alter table public.suppliers drop constraint if exists suppliers_pkey;
alter table public.suppliers add primary key (company_id, id);

alter table public.inventory drop constraint if exists inventory_pkey;
alter table public.inventory add primary key (company_id, id);

alter table public.hrm_holidays drop constraint if exists hrm_holidays_pkey;
alter table public.hrm_holidays add primary key (company_id, id);

alter table public.hrm_performance_criteria drop constraint if exists hrm_performance_criteria_pkey;
alter table public.hrm_performance_criteria add primary key (company_id, id);

alter table public.hrm_salary_scales drop constraint if exists hrm_salary_scales_pkey;
alter table public.hrm_salary_scales add primary key (company_id, id);

alter table public.travel_norms drop constraint if exists travel_norms_pkey;
alter table public.travel_norms add primary key (company_id, id);

alter table public.subcontractor_catalog_items drop constraint if exists subcontractor_catalog_items_pkey;
alter table public.subcontractor_catalog_items add primary key (company_id, id);

alter table public.accounting_product_catalog drop constraint if exists accounting_product_catalog_pkey;
alter table public.accounting_product_catalog add primary key (company_id, id);

alter table public.purchase_product_catalog drop constraint if exists purchase_product_catalog_pkey;
alter table public.purchase_product_catalog add primary key (company_id, ma_san_pham);

alter table public.sales_product_catalog drop constraint if exists sales_product_catalog_pkey;
alter table public.sales_product_catalog add primary key (company_id, ma_san_pham);

-- attendance_records: id sinh từ empId (vd "AT-NV001-20260929") — cùng lỗi,
-- vá riêng trong migration 20260929c luôn (không tách file để tránh chạy sót).
alter table public.attendance_records drop constraint if exists attendance_records_pkey;
alter table public.attendance_records add primary key (company_id, id);

commit;

-- ============================================================================
-- VERIFY: mỗi bảng phải có đúng 1 dòng, cột pk_def phải chứa "company_id":
--   select conrelid::regclass, pg_get_constraintdef(oid) from pg_constraint
--   where contype = 'p' and conrelid::regclass::text in (
--     'customers','suppliers','inventory','hrm_holidays',
--     'hrm_performance_criteria','hrm_salary_scales','travel_norms',
--     'subcontractor_catalog_items','accounting_product_catalog',
--     'purchase_product_catalog','sales_product_catalog','attendance_records'
--   );
-- ============================================================================
