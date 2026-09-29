-- ============================================================================
-- HOTFIX (Multi-tenant Phase 3): xoá các policy "lạ" còn sót cấp quyền cho
-- role public/anon (qual = true) trên 18 bảng, gây LỘ TOÀN BỘ dữ liệu qua anon
-- key public bất kể policy "tenant_isolation_*" đã tạo đúng ở Phase 3.
--
-- Nguyên nhân: các policy này được tạo thủ công ở nhiều thời điểm khác nhau
-- trong lịch sử dự án, đặt tên KHÔNG theo chuẩn "anon_all_<bảng>" nên câu
-- `drop policy if exists "anon_all_<bảng>"` trong 20260928c không khớp được.
-- Vì Postgres RLS là permissive (OR các policy lại với nhau), chỉ cần 1 policy
-- "true" còn sống là đủ để bỏ qua hoàn toàn policy tenant_isolation_* đã bật.
--
-- Phát hiện qua truy vấn trực tiếp pg_policies trên staging (không suy đoán):
--   select tablename, policyname, roles, cmd, qual from pg_policies
--   where (roles::text like '%public%' or roles::text like '%anon%') and qual = 'true';
--
-- Đã xác nhận cả 18 bảng dưới đây đều đã có cột company_id (Phase 1) và đã có
-- policy tenant_isolation_<bảng> hợp lệ (Phase 3) — xoá các policy lạ này an
-- toàn, không ảnh hưởng user đã đăng nhập (JWT đúng company_id vẫn hoạt động
-- bình thường qua policy tenant_isolation_*).
-- ============================================================================

begin;

drop policy if exists "Allow all for anon" on public.accounting_product_catalog;
drop policy if exists "Allow public read access to accounting_product_catalog" on public.accounting_product_catalog;
drop policy if exists "Allow all access" on public.accounting_receivables;
drop policy if exists "accounting_sub_contracts_public_all" on public.accounting_sub_contracts;
drop policy if exists "business_profile_public_all" on public.business_profile;
drop policy if exists "hrm_employee_errors_public_all" on public.hrm_employee_errors;
drop policy if exists "hrm_holidays_public_all" on public.hrm_holidays;
drop policy if exists "hrm_leave_coefficients_public_all" on public.hrm_leave_coefficients;
drop policy if exists "hrm_leaves_public_all" on public.hrm_leaves;
drop policy if exists "hrm_payroll_records_public_all" on public.hrm_payroll_records;
drop policy if exists "hrm_performance_criteria_public_all" on public.hrm_performance_criteria;
drop policy if exists "hrm_salary_scales_public_all" on public.hrm_salary_scales;
drop policy if exists "hrm_trips_public_all" on public.hrm_trips;
drop policy if exists "kanban_columns_public_all" on public.kanban_columns;
drop policy if exists "purchase_product_catalog_public_all" on public.purchase_product_catalog;
drop policy if exists "push_subscriptions_public_all" on public.push_subscriptions;
drop policy if exists "sales_product_catalog_public_all" on public.sales_product_catalog;
drop policy if exists "shift_config_public_all" on public.shift_config;
drop policy if exists "travel_norms_public_all" on public.travel_norms;

commit;

-- ============================================================================
-- VERIFY sau khi chạy: câu này phải trả về 0 dòng (không còn policy nào cấp
-- quyền true cho public/anon trên toàn bộ schema public):
--
--   select tablename, policyname, roles, cmd, qual from pg_policies
--   where (roles::text like '%public%' or roles::text like '%anon%') and qual = 'true';
-- ============================================================================
