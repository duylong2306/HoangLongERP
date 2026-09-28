-- ============================================================================
-- Giai đoạn 3 (Multi-tenant): bật RLS THẬT theo company_id
-- ============================================================================
-- Trước đây (schema gốc) mọi bảng có policy "anon_all_<bảng>" cho phép role
-- anon (ai cũng dùng chung 1 anon key public) đọc/ghi TOÀN BỘ, vì app tự xác
-- thực qua bảng employees, không dùng Supabase Auth. Giai đoạn 2 đã thêm luồng
-- đăng nhập ký JWT chứa company_id (api/login.ts) — JWT này khi gửi lên dùng
-- ĐÚNG secret Supabase xác thực (SUPABASE_JWT_SECRET) nên PostgREST coi là
-- request hợp lệ với role 'authenticated' (đọc từ claim `role` trong JWT).
--
-- Từ đây: xoá hẳn quyền anon (ai chưa đăng nhập — chưa có JWT hợp lệ — không
-- đọc/ghi được gì), CHỈ authenticated (đã đăng nhập, JWT có company_id đúng)
-- mới truy cập được, và CHỈ đúng company_id của họ — auth.jwt()->>'company_id'
-- đọc claim từ JWT, so khớp với cột company_id của từng dòng.
--
-- service_role (dùng ở api/login.ts) có cờ BYPASSRLS ở Supabase, KHÔNG cần
-- policy riêng — luôn bỏ qua RLS bất kể có policy hay không.
--
-- ⚠️ CHỈ CHẠY TRÊN PROJECT STAGING ("LoLo") — đây là bước RỦI RO NHẤT trong kế
-- hoạch multi-tenant (có thể khoá hẳn quyền đọc/ghi nếu JWT/luồng auth có lỗi
-- chưa phát hiện). Test kỹ trên staging trước khi áp dụng lên production.
-- ============================================================================

begin;

alter table public.accounting_liabilities enable row level security;
drop policy if exists "anon_all_accounting_liabilities" on public.accounting_liabilities;
drop policy if exists "tenant_isolation_accounting_liabilities" on public.accounting_liabilities;
create policy "tenant_isolation_accounting_liabilities" on public.accounting_liabilities
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.accounting_product_catalog enable row level security;
drop policy if exists "anon_all_accounting_product_catalog" on public.accounting_product_catalog;
drop policy if exists "tenant_isolation_accounting_product_catalog" on public.accounting_product_catalog;
create policy "tenant_isolation_accounting_product_catalog" on public.accounting_product_catalog
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.accounting_receivables enable row level security;
drop policy if exists "anon_all_accounting_receivables" on public.accounting_receivables;
drop policy if exists "tenant_isolation_accounting_receivables" on public.accounting_receivables;
create policy "tenant_isolation_accounting_receivables" on public.accounting_receivables
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.accounting_sub_contracts enable row level security;
drop policy if exists "anon_all_accounting_sub_contracts" on public.accounting_sub_contracts;
drop policy if exists "tenant_isolation_accounting_sub_contracts" on public.accounting_sub_contracts;
create policy "tenant_isolation_accounting_sub_contracts" on public.accounting_sub_contracts
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.accounting_subcontractors enable row level security;
drop policy if exists "anon_all_accounting_subcontractors" on public.accounting_subcontractors;
drop policy if exists "tenant_isolation_accounting_subcontractors" on public.accounting_subcontractors;
create policy "tenant_isolation_accounting_subcontractors" on public.accounting_subcontractors
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.archived_quotes enable row level security;
drop policy if exists "anon_all_archived_quotes" on public.archived_quotes;
drop policy if exists "tenant_isolation_archived_quotes" on public.archived_quotes;
create policy "tenant_isolation_archived_quotes" on public.archived_quotes
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.attendance_chat_notified enable row level security;
drop policy if exists "anon_all_attendance_chat_notified" on public.attendance_chat_notified;
drop policy if exists "tenant_isolation_attendance_chat_notified" on public.attendance_chat_notified;
create policy "tenant_isolation_attendance_chat_notified" on public.attendance_chat_notified
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.attendance_records enable row level security;
drop policy if exists "anon_all_attendance_records" on public.attendance_records;
drop policy if exists "tenant_isolation_attendance_records" on public.attendance_records;
create policy "tenant_isolation_attendance_records" on public.attendance_records
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.business_profile enable row level security;
drop policy if exists "anon_all_business_profile" on public.business_profile;
drop policy if exists "tenant_isolation_business_profile" on public.business_profile;
create policy "tenant_isolation_business_profile" on public.business_profile
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.cash_fund_config enable row level security;
drop policy if exists "anon_all_cash_fund_config" on public.cash_fund_config;
drop policy if exists "tenant_isolation_cash_fund_config" on public.cash_fund_config;
create policy "tenant_isolation_cash_fund_config" on public.cash_fund_config
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.chat_messages enable row level security;
drop policy if exists "anon_all_chat_messages" on public.chat_messages;
drop policy if exists "tenant_isolation_chat_messages" on public.chat_messages;
create policy "tenant_isolation_chat_messages" on public.chat_messages
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.construction_norms enable row level security;
drop policy if exists "anon_all_construction_norms" on public.construction_norms;
drop policy if exists "tenant_isolation_construction_norms" on public.construction_norms;
create policy "tenant_isolation_construction_norms" on public.construction_norms
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.conversations enable row level security;
drop policy if exists "anon_all_conversations" on public.conversations;
drop policy if exists "tenant_isolation_conversations" on public.conversations;
create policy "tenant_isolation_conversations" on public.conversations
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.customers enable row level security;
drop policy if exists "anon_all_customers" on public.customers;
drop policy if exists "tenant_isolation_customers" on public.customers;
create policy "tenant_isolation_customers" on public.customers
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.document_templates enable row level security;
drop policy if exists "anon_all_document_templates" on public.document_templates;
drop policy if exists "tenant_isolation_document_templates" on public.document_templates;
create policy "tenant_isolation_document_templates" on public.document_templates
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.employees enable row level security;
drop policy if exists "anon_all_employees" on public.employees;
drop policy if exists "tenant_isolation_employees" on public.employees;
create policy "tenant_isolation_employees" on public.employees
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.fcm_tokens enable row level security;
drop policy if exists "anon_all_fcm_tokens" on public.fcm_tokens;
drop policy if exists "tenant_isolation_fcm_tokens" on public.fcm_tokens;
create policy "tenant_isolation_fcm_tokens" on public.fcm_tokens
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.hrm_approval_config enable row level security;
drop policy if exists "anon_all_hrm_approval_config" on public.hrm_approval_config;
drop policy if exists "tenant_isolation_hrm_approval_config" on public.hrm_approval_config;
create policy "tenant_isolation_hrm_approval_config" on public.hrm_approval_config
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.hrm_default_snapshots enable row level security;
drop policy if exists "anon_all_hrm_default_snapshots" on public.hrm_default_snapshots;
drop policy if exists "tenant_isolation_hrm_default_snapshots" on public.hrm_default_snapshots;
create policy "tenant_isolation_hrm_default_snapshots" on public.hrm_default_snapshots
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.hrm_employee_errors enable row level security;
drop policy if exists "anon_all_hrm_employee_errors" on public.hrm_employee_errors;
drop policy if exists "tenant_isolation_hrm_employee_errors" on public.hrm_employee_errors;
create policy "tenant_isolation_hrm_employee_errors" on public.hrm_employee_errors
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.hrm_holidays enable row level security;
drop policy if exists "anon_all_hrm_holidays" on public.hrm_holidays;
drop policy if exists "tenant_isolation_hrm_holidays" on public.hrm_holidays;
create policy "tenant_isolation_hrm_holidays" on public.hrm_holidays
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.hrm_leave_coefficients enable row level security;
drop policy if exists "anon_all_hrm_leave_coefficients" on public.hrm_leave_coefficients;
drop policy if exists "tenant_isolation_hrm_leave_coefficients" on public.hrm_leave_coefficients;
create policy "tenant_isolation_hrm_leave_coefficients" on public.hrm_leave_coefficients
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.hrm_leaves enable row level security;
drop policy if exists "anon_all_hrm_leaves" on public.hrm_leaves;
drop policy if exists "tenant_isolation_hrm_leaves" on public.hrm_leaves;
create policy "tenant_isolation_hrm_leaves" on public.hrm_leaves
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.hrm_payroll_records enable row level security;
drop policy if exists "anon_all_hrm_payroll_records" on public.hrm_payroll_records;
drop policy if exists "tenant_isolation_hrm_payroll_records" on public.hrm_payroll_records;
create policy "tenant_isolation_hrm_payroll_records" on public.hrm_payroll_records
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.hrm_performance_criteria enable row level security;
drop policy if exists "anon_all_hrm_performance_criteria" on public.hrm_performance_criteria;
drop policy if exists "tenant_isolation_hrm_performance_criteria" on public.hrm_performance_criteria;
create policy "tenant_isolation_hrm_performance_criteria" on public.hrm_performance_criteria
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.hrm_role_groups enable row level security;
drop policy if exists "anon_all_hrm_role_groups" on public.hrm_role_groups;
drop policy if exists "tenant_isolation_hrm_role_groups" on public.hrm_role_groups;
create policy "tenant_isolation_hrm_role_groups" on public.hrm_role_groups
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.hrm_salary_scales enable row level security;
drop policy if exists "anon_all_hrm_salary_scales" on public.hrm_salary_scales;
drop policy if exists "tenant_isolation_hrm_salary_scales" on public.hrm_salary_scales;
create policy "tenant_isolation_hrm_salary_scales" on public.hrm_salary_scales
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.hrm_task_permissions enable row level security;
drop policy if exists "anon_all_hrm_task_permissions" on public.hrm_task_permissions;
drop policy if exists "tenant_isolation_hrm_task_permissions" on public.hrm_task_permissions;
create policy "tenant_isolation_hrm_task_permissions" on public.hrm_task_permissions
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.hrm_travel_expenses enable row level security;
drop policy if exists "anon_all_hrm_travel_expenses" on public.hrm_travel_expenses;
drop policy if exists "tenant_isolation_hrm_travel_expenses" on public.hrm_travel_expenses;
create policy "tenant_isolation_hrm_travel_expenses" on public.hrm_travel_expenses
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.hrm_trips enable row level security;
drop policy if exists "anon_all_hrm_trips" on public.hrm_trips;
drop policy if exists "tenant_isolation_hrm_trips" on public.hrm_trips;
create policy "tenant_isolation_hrm_trips" on public.hrm_trips
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.inventory enable row level security;
drop policy if exists "anon_all_inventory" on public.inventory;
drop policy if exists "tenant_isolation_inventory" on public.inventory;
create policy "tenant_isolation_inventory" on public.inventory
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.kanban_columns enable row level security;
drop policy if exists "anon_all_kanban_columns" on public.kanban_columns;
drop policy if exists "tenant_isolation_kanban_columns" on public.kanban_columns;
create policy "tenant_isolation_kanban_columns" on public.kanban_columns
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.material_proposals enable row level security;
drop policy if exists "anon_all_material_proposals" on public.material_proposals;
drop policy if exists "tenant_isolation_material_proposals" on public.material_proposals;
create policy "tenant_isolation_material_proposals" on public.material_proposals
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.notifications enable row level security;
drop policy if exists "anon_all_notifications" on public.notifications;
drop policy if exists "tenant_isolation_notifications" on public.notifications;
create policy "tenant_isolation_notifications" on public.notifications
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.payments enable row level security;
drop policy if exists "anon_all_payments" on public.payments;
drop policy if exists "tenant_isolation_payments" on public.payments;
create policy "tenant_isolation_payments" on public.payments
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.product_materials enable row level security;
drop policy if exists "anon_all_product_materials" on public.product_materials;
drop policy if exists "tenant_isolation_product_materials" on public.product_materials;
create policy "tenant_isolation_product_materials" on public.product_materials
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.product_prices enable row level security;
drop policy if exists "anon_all_product_prices" on public.product_prices;
drop policy if exists "tenant_isolation_product_prices" on public.product_prices;
create policy "tenant_isolation_product_prices" on public.product_prices
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.project_permission_overrides enable row level security;
drop policy if exists "anon_all_project_permission_overrides" on public.project_permission_overrides;
drop policy if exists "tenant_isolation_project_permission_overrides" on public.project_permission_overrides;
create policy "tenant_isolation_project_permission_overrides" on public.project_permission_overrides
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.project_permissions enable row level security;
drop policy if exists "anon_all_project_permissions" on public.project_permissions;
drop policy if exists "tenant_isolation_project_permissions" on public.project_permissions;
create policy "tenant_isolation_project_permissions" on public.project_permissions
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.projects enable row level security;
drop policy if exists "anon_all_projects" on public.projects;
drop policy if exists "tenant_isolation_projects" on public.projects;
create policy "tenant_isolation_projects" on public.projects
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.purchase_orders enable row level security;
drop policy if exists "anon_all_purchase_orders" on public.purchase_orders;
drop policy if exists "tenant_isolation_purchase_orders" on public.purchase_orders;
create policy "tenant_isolation_purchase_orders" on public.purchase_orders
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.purchase_product_catalog enable row level security;
drop policy if exists "anon_all_purchase_product_catalog" on public.purchase_product_catalog;
drop policy if exists "tenant_isolation_purchase_product_catalog" on public.purchase_product_catalog;
create policy "tenant_isolation_purchase_product_catalog" on public.purchase_product_catalog
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.push_subscriptions enable row level security;
drop policy if exists "anon_all_push_subscriptions" on public.push_subscriptions;
drop policy if exists "tenant_isolation_push_subscriptions" on public.push_subscriptions;
create policy "tenant_isolation_push_subscriptions" on public.push_subscriptions
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.quotation_configs enable row level security;
drop policy if exists "anon_all_quotation_configs" on public.quotation_configs;
drop policy if exists "tenant_isolation_quotation_configs" on public.quotation_configs;
create policy "tenant_isolation_quotation_configs" on public.quotation_configs
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.quotes enable row level security;
drop policy if exists "anon_all_quotes" on public.quotes;
drop policy if exists "tenant_isolation_quotes" on public.quotes;
create policy "tenant_isolation_quotes" on public.quotes
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.receipts enable row level security;
drop policy if exists "anon_all_receipts" on public.receipts;
drop policy if exists "tenant_isolation_receipts" on public.receipts;
create policy "tenant_isolation_receipts" on public.receipts
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.sales_orders enable row level security;
drop policy if exists "anon_all_sales_orders" on public.sales_orders;
drop policy if exists "tenant_isolation_sales_orders" on public.sales_orders;
create policy "tenant_isolation_sales_orders" on public.sales_orders
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.sales_product_catalog enable row level security;
drop policy if exists "anon_all_sales_product_catalog" on public.sales_product_catalog;
drop policy if exists "tenant_isolation_sales_product_catalog" on public.sales_product_catalog;
create policy "tenant_isolation_sales_product_catalog" on public.sales_product_catalog
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.shift_config enable row level security;
drop policy if exists "anon_all_shift_config" on public.shift_config;
drop policy if exists "tenant_isolation_shift_config" on public.shift_config;
create policy "tenant_isolation_shift_config" on public.shift_config
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.subcontractor_advances enable row level security;
drop policy if exists "anon_all_subcontractor_advances" on public.subcontractor_advances;
drop policy if exists "tenant_isolation_subcontractor_advances" on public.subcontractor_advances;
create policy "tenant_isolation_subcontractor_advances" on public.subcontractor_advances
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.subcontractor_catalog_items enable row level security;
drop policy if exists "anon_all_subcontractor_catalog_items" on public.subcontractor_catalog_items;
drop policy if exists "tenant_isolation_subcontractor_catalog_items" on public.subcontractor_catalog_items;
create policy "tenant_isolation_subcontractor_catalog_items" on public.subcontractor_catalog_items
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.supplier_returns enable row level security;
drop policy if exists "anon_all_supplier_returns" on public.supplier_returns;
drop policy if exists "tenant_isolation_supplier_returns" on public.supplier_returns;
create policy "tenant_isolation_supplier_returns" on public.supplier_returns
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.suppliers enable row level security;
drop policy if exists "anon_all_suppliers" on public.suppliers;
drop policy if exists "tenant_isolation_suppliers" on public.suppliers;
create policy "tenant_isolation_suppliers" on public.suppliers
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.task_missions enable row level security;
drop policy if exists "anon_all_task_missions" on public.task_missions;
drop policy if exists "tenant_isolation_task_missions" on public.task_missions;
create policy "tenant_isolation_task_missions" on public.task_missions
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.tasks enable row level security;
drop policy if exists "anon_all_tasks" on public.tasks;
drop policy if exists "tenant_isolation_tasks" on public.tasks;
create policy "tenant_isolation_tasks" on public.tasks
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.travel_norms enable row level security;
drop policy if exists "anon_all_travel_norms" on public.travel_norms;
drop policy if exists "tenant_isolation_travel_norms" on public.travel_norms;
create policy "tenant_isolation_travel_norms" on public.travel_norms
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
alter table public.warehouse_logs enable row level security;
drop policy if exists "anon_all_warehouse_logs" on public.warehouse_logs;
drop policy if exists "tenant_isolation_warehouse_logs" on public.warehouse_logs;
create policy "tenant_isolation_warehouse_logs" on public.warehouse_logs
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);

-- companies: khoá hẳn — chỉ service_role (api/login.ts) truy cập, client
-- không bao giờ query trực tiếp bảng này (thông tin công ty trả về sẵn trong
-- response của /api/login).
alter table public.companies enable row level security;
drop policy if exists "anon_all_companies" on public.companies;

commit;
