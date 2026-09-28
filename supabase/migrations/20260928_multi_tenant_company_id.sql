-- ============================================================================
-- Giai đoạn 1 (Multi-tenant): thêm cột company_id vào TOÀN BỘ bảng nghiệp vụ
-- ============================================================================
-- Mục đích: chuẩn bị cho việc phân tách dữ liệu theo từng doanh nghiệp
-- (company_id) trong 1 Supabase project dùng chung. Ở giai đoạn này CHƯA bật
-- RLS lọc theo company_id (xem Giai đoạn 3) — chỉ thêm cột + backfill dữ liệu
-- cũ về ĐÚNG 1 công ty gốc (Hoàng Long) để không phá vỡ gì đang chạy.
--
-- An toàn khi chạy lại nhiều lần (idempotent): dùng "if not exists"/"on
-- conflict" ở mọi bước.
--
-- CHỈ CHẠY TRÊN PROJECT STAGING ("LoLo") — KHÔNG chạy trên production khi
-- chưa test xong toàn bộ Giai đoạn 1-8 (xem kế hoạch multi-tenant).
-- ============================================================================

-- Bọc toàn bộ trong 1 transaction: lỗi giữa chừng (57 bảng) sẽ tự rollback
-- hết, không để tình trạng nửa bảng có company_id nửa bảng chưa.
begin;

-- 1. Bảng companies (danh sách doanh nghiệp dùng chung nền tảng) ------------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,           -- dùng làm subdomain, vd 'hoanglong'
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. Công ty gốc (dữ liệu thật hiện có) — id CỐ ĐỊNH để script chạy lại vẫn
--    ra cùng kết quả, và để tiện tham chiếu khi test RLS ở Giai đoạn 3.
insert into public.companies (id, slug, name)
values ('00000000-0000-0000-0000-000000000001', 'hoanglong', 'Hoàng Long')
on conflict (slug) do nothing;

-- 3. Thêm company_id vào từng bảng: thêm cột (cho phép NULL trước), backfill
--    toàn bộ dữ liệu cũ về công ty gốc, rồi mới ép NOT NULL + đánh index.
--    Tách 3 bước rõ ràng (thay vì "add column ... not null default ...")
--    để an toàn với bảng đã có dữ liệu — tránh khoá bảng lâu/lỗi nếu default
--    không áp dụng được ngay cho toàn bộ dòng cũ.

alter table public.accounting_liabilities add column if not exists company_id uuid references public.companies(id);
update public.accounting_liabilities set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.accounting_liabilities alter column company_id set not null;
create index if not exists idx_accounting_liabilities_company_id on public.accounting_liabilities (company_id);
alter table public.accounting_product_catalog add column if not exists company_id uuid references public.companies(id);
update public.accounting_product_catalog set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.accounting_product_catalog alter column company_id set not null;
create index if not exists idx_accounting_product_catalog_company_id on public.accounting_product_catalog (company_id);
alter table public.accounting_receivables add column if not exists company_id uuid references public.companies(id);
update public.accounting_receivables set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.accounting_receivables alter column company_id set not null;
create index if not exists idx_accounting_receivables_company_id on public.accounting_receivables (company_id);
alter table public.accounting_sub_contracts add column if not exists company_id uuid references public.companies(id);
update public.accounting_sub_contracts set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.accounting_sub_contracts alter column company_id set not null;
create index if not exists idx_accounting_sub_contracts_company_id on public.accounting_sub_contracts (company_id);
alter table public.accounting_subcontractors add column if not exists company_id uuid references public.companies(id);
update public.accounting_subcontractors set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.accounting_subcontractors alter column company_id set not null;
create index if not exists idx_accounting_subcontractors_company_id on public.accounting_subcontractors (company_id);
alter table public.archived_quotes add column if not exists company_id uuid references public.companies(id);
update public.archived_quotes set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.archived_quotes alter column company_id set not null;
create index if not exists idx_archived_quotes_company_id on public.archived_quotes (company_id);
alter table public.attendance_chat_notified add column if not exists company_id uuid references public.companies(id);
update public.attendance_chat_notified set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.attendance_chat_notified alter column company_id set not null;
create index if not exists idx_attendance_chat_notified_company_id on public.attendance_chat_notified (company_id);
alter table public.attendance_records add column if not exists company_id uuid references public.companies(id);
update public.attendance_records set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.attendance_records alter column company_id set not null;
create index if not exists idx_attendance_records_company_id on public.attendance_records (company_id);
alter table public.business_profile add column if not exists company_id uuid references public.companies(id);
update public.business_profile set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.business_profile alter column company_id set not null;
create index if not exists idx_business_profile_company_id on public.business_profile (company_id);
alter table public.cash_fund_config add column if not exists company_id uuid references public.companies(id);
update public.cash_fund_config set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.cash_fund_config alter column company_id set not null;
create index if not exists idx_cash_fund_config_company_id on public.cash_fund_config (company_id);
alter table public.chat_messages add column if not exists company_id uuid references public.companies(id);
update public.chat_messages set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.chat_messages alter column company_id set not null;
create index if not exists idx_chat_messages_company_id on public.chat_messages (company_id);
alter table public.construction_norms add column if not exists company_id uuid references public.companies(id);
update public.construction_norms set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.construction_norms alter column company_id set not null;
create index if not exists idx_construction_norms_company_id on public.construction_norms (company_id);
alter table public.conversations add column if not exists company_id uuid references public.companies(id);
update public.conversations set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.conversations alter column company_id set not null;
create index if not exists idx_conversations_company_id on public.conversations (company_id);
alter table public.customers add column if not exists company_id uuid references public.companies(id);
update public.customers set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.customers alter column company_id set not null;
create index if not exists idx_customers_company_id on public.customers (company_id);
alter table public.document_templates add column if not exists company_id uuid references public.companies(id);
update public.document_templates set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.document_templates alter column company_id set not null;
create index if not exists idx_document_templates_company_id on public.document_templates (company_id);
alter table public.employees add column if not exists company_id uuid references public.companies(id);
update public.employees set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.employees alter column company_id set not null;
create index if not exists idx_employees_company_id on public.employees (company_id);
alter table public.fcm_tokens add column if not exists company_id uuid references public.companies(id);
update public.fcm_tokens set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.fcm_tokens alter column company_id set not null;
create index if not exists idx_fcm_tokens_company_id on public.fcm_tokens (company_id);
alter table public.hrm_approval_config add column if not exists company_id uuid references public.companies(id);
update public.hrm_approval_config set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.hrm_approval_config alter column company_id set not null;
create index if not exists idx_hrm_approval_config_company_id on public.hrm_approval_config (company_id);
alter table public.hrm_default_snapshots add column if not exists company_id uuid references public.companies(id);
update public.hrm_default_snapshots set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.hrm_default_snapshots alter column company_id set not null;
create index if not exists idx_hrm_default_snapshots_company_id on public.hrm_default_snapshots (company_id);
alter table public.hrm_employee_errors add column if not exists company_id uuid references public.companies(id);
update public.hrm_employee_errors set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.hrm_employee_errors alter column company_id set not null;
create index if not exists idx_hrm_employee_errors_company_id on public.hrm_employee_errors (company_id);
alter table public.hrm_holidays add column if not exists company_id uuid references public.companies(id);
update public.hrm_holidays set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.hrm_holidays alter column company_id set not null;
create index if not exists idx_hrm_holidays_company_id on public.hrm_holidays (company_id);
alter table public.hrm_leave_coefficients add column if not exists company_id uuid references public.companies(id);
update public.hrm_leave_coefficients set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.hrm_leave_coefficients alter column company_id set not null;
create index if not exists idx_hrm_leave_coefficients_company_id on public.hrm_leave_coefficients (company_id);
alter table public.hrm_leaves add column if not exists company_id uuid references public.companies(id);
update public.hrm_leaves set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.hrm_leaves alter column company_id set not null;
create index if not exists idx_hrm_leaves_company_id on public.hrm_leaves (company_id);
alter table public.hrm_payroll_records add column if not exists company_id uuid references public.companies(id);
update public.hrm_payroll_records set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.hrm_payroll_records alter column company_id set not null;
create index if not exists idx_hrm_payroll_records_company_id on public.hrm_payroll_records (company_id);
alter table public.hrm_performance_criteria add column if not exists company_id uuid references public.companies(id);
update public.hrm_performance_criteria set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.hrm_performance_criteria alter column company_id set not null;
create index if not exists idx_hrm_performance_criteria_company_id on public.hrm_performance_criteria (company_id);
alter table public.hrm_role_groups add column if not exists company_id uuid references public.companies(id);
update public.hrm_role_groups set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.hrm_role_groups alter column company_id set not null;
create index if not exists idx_hrm_role_groups_company_id on public.hrm_role_groups (company_id);
alter table public.hrm_salary_scales add column if not exists company_id uuid references public.companies(id);
update public.hrm_salary_scales set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.hrm_salary_scales alter column company_id set not null;
create index if not exists idx_hrm_salary_scales_company_id on public.hrm_salary_scales (company_id);
alter table public.hrm_task_permissions add column if not exists company_id uuid references public.companies(id);
update public.hrm_task_permissions set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.hrm_task_permissions alter column company_id set not null;
create index if not exists idx_hrm_task_permissions_company_id on public.hrm_task_permissions (company_id);
alter table public.hrm_travel_expenses add column if not exists company_id uuid references public.companies(id);
update public.hrm_travel_expenses set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.hrm_travel_expenses alter column company_id set not null;
create index if not exists idx_hrm_travel_expenses_company_id on public.hrm_travel_expenses (company_id);
alter table public.hrm_trips add column if not exists company_id uuid references public.companies(id);
update public.hrm_trips set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.hrm_trips alter column company_id set not null;
create index if not exists idx_hrm_trips_company_id on public.hrm_trips (company_id);
alter table public.inventory add column if not exists company_id uuid references public.companies(id);
update public.inventory set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.inventory alter column company_id set not null;
create index if not exists idx_inventory_company_id on public.inventory (company_id);
alter table public.kanban_columns add column if not exists company_id uuid references public.companies(id);
update public.kanban_columns set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.kanban_columns alter column company_id set not null;
create index if not exists idx_kanban_columns_company_id on public.kanban_columns (company_id);
alter table public.material_proposals add column if not exists company_id uuid references public.companies(id);
update public.material_proposals set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.material_proposals alter column company_id set not null;
create index if not exists idx_material_proposals_company_id on public.material_proposals (company_id);
alter table public.notifications add column if not exists company_id uuid references public.companies(id);
update public.notifications set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.notifications alter column company_id set not null;
create index if not exists idx_notifications_company_id on public.notifications (company_id);
alter table public.payments add column if not exists company_id uuid references public.companies(id);
update public.payments set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.payments alter column company_id set not null;
create index if not exists idx_payments_company_id on public.payments (company_id);
alter table public.product_materials add column if not exists company_id uuid references public.companies(id);
update public.product_materials set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.product_materials alter column company_id set not null;
create index if not exists idx_product_materials_company_id on public.product_materials (company_id);
alter table public.product_prices add column if not exists company_id uuid references public.companies(id);
update public.product_prices set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.product_prices alter column company_id set not null;
create index if not exists idx_product_prices_company_id on public.product_prices (company_id);
alter table public.project_permission_overrides add column if not exists company_id uuid references public.companies(id);
update public.project_permission_overrides set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.project_permission_overrides alter column company_id set not null;
create index if not exists idx_project_permission_overrides_company_id on public.project_permission_overrides (company_id);
alter table public.project_permissions add column if not exists company_id uuid references public.companies(id);
update public.project_permissions set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.project_permissions alter column company_id set not null;
create index if not exists idx_project_permissions_company_id on public.project_permissions (company_id);
alter table public.projects add column if not exists company_id uuid references public.companies(id);
update public.projects set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.projects alter column company_id set not null;
create index if not exists idx_projects_company_id on public.projects (company_id);
alter table public.purchase_orders add column if not exists company_id uuid references public.companies(id);
update public.purchase_orders set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.purchase_orders alter column company_id set not null;
create index if not exists idx_purchase_orders_company_id on public.purchase_orders (company_id);
alter table public.purchase_product_catalog add column if not exists company_id uuid references public.companies(id);
update public.purchase_product_catalog set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.purchase_product_catalog alter column company_id set not null;
create index if not exists idx_purchase_product_catalog_company_id on public.purchase_product_catalog (company_id);
alter table public.push_subscriptions add column if not exists company_id uuid references public.companies(id);
update public.push_subscriptions set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.push_subscriptions alter column company_id set not null;
create index if not exists idx_push_subscriptions_company_id on public.push_subscriptions (company_id);
alter table public.quotation_configs add column if not exists company_id uuid references public.companies(id);
update public.quotation_configs set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.quotation_configs alter column company_id set not null;
create index if not exists idx_quotation_configs_company_id on public.quotation_configs (company_id);
alter table public.quotes add column if not exists company_id uuid references public.companies(id);
update public.quotes set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.quotes alter column company_id set not null;
create index if not exists idx_quotes_company_id on public.quotes (company_id);
alter table public.receipts add column if not exists company_id uuid references public.companies(id);
update public.receipts set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.receipts alter column company_id set not null;
create index if not exists idx_receipts_company_id on public.receipts (company_id);
alter table public.sales_orders add column if not exists company_id uuid references public.companies(id);
update public.sales_orders set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.sales_orders alter column company_id set not null;
create index if not exists idx_sales_orders_company_id on public.sales_orders (company_id);
alter table public.sales_product_catalog add column if not exists company_id uuid references public.companies(id);
update public.sales_product_catalog set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.sales_product_catalog alter column company_id set not null;
create index if not exists idx_sales_product_catalog_company_id on public.sales_product_catalog (company_id);
alter table public.shift_config add column if not exists company_id uuid references public.companies(id);
update public.shift_config set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.shift_config alter column company_id set not null;
create index if not exists idx_shift_config_company_id on public.shift_config (company_id);
alter table public.subcontractor_advances add column if not exists company_id uuid references public.companies(id);
update public.subcontractor_advances set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.subcontractor_advances alter column company_id set not null;
create index if not exists idx_subcontractor_advances_company_id on public.subcontractor_advances (company_id);
alter table public.subcontractor_catalog_items add column if not exists company_id uuid references public.companies(id);
update public.subcontractor_catalog_items set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.subcontractor_catalog_items alter column company_id set not null;
create index if not exists idx_subcontractor_catalog_items_company_id on public.subcontractor_catalog_items (company_id);
alter table public.supplier_returns add column if not exists company_id uuid references public.companies(id);
update public.supplier_returns set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.supplier_returns alter column company_id set not null;
create index if not exists idx_supplier_returns_company_id on public.supplier_returns (company_id);
alter table public.suppliers add column if not exists company_id uuid references public.companies(id);
update public.suppliers set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.suppliers alter column company_id set not null;
create index if not exists idx_suppliers_company_id on public.suppliers (company_id);
alter table public.task_missions add column if not exists company_id uuid references public.companies(id);
update public.task_missions set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.task_missions alter column company_id set not null;
create index if not exists idx_task_missions_company_id on public.task_missions (company_id);
alter table public.tasks add column if not exists company_id uuid references public.companies(id);
update public.tasks set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.tasks alter column company_id set not null;
create index if not exists idx_tasks_company_id on public.tasks (company_id);
alter table public.travel_norms add column if not exists company_id uuid references public.companies(id);
update public.travel_norms set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.travel_norms alter column company_id set not null;
create index if not exists idx_travel_norms_company_id on public.travel_norms (company_id);
alter table public.warehouse_logs add column if not exists company_id uuid references public.companies(id);
update public.warehouse_logs set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
alter table public.warehouse_logs alter column company_id set not null;
create index if not exists idx_warehouse_logs_company_id on public.warehouse_logs (company_id);

commit;

-- 4. Kiểm tra nhanh: mọi bảng phải có đúng số dòng = số dòng company_id
--    không null (tức KHÔNG còn dòng nào bị bỏ sót) — chạy tay để soát lại
--    sau khi migration chạy xong, KHÔNG phải phần migration tự động:
--
--   select relname, n_live_tup from pg_stat_user_tables where schemaname='public' order by relname;
