-- =============================================================================
-- KIỂM TRA & BẬT SUPABASE REALTIME
-- Chạy từng block trong Supabase Dashboard → SQL Editor
-- =============================================================================

-- BƯỚC 1: Kiểm tra các bảng đã có trong publication chưa
SELECT
  pubname,
  n.nspname AS schema_name,
  c.relname AS table_name
FROM pg_publication p
JOIN pg_publication_rel pr ON pr.prpubid = p.oid
JOIN pg_class c ON c.oid = pr.prrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE p.pubname = 'supabase_realtime'
ORDER BY c.relname;

-- BƯỚC 2: Bật Realtime cho tất cả các bảng cần sync
-- Dùng EXCEPTION block để bỏ qua nếu bảng đã có trong publication
DO $$
DECLARE
  tbl TEXT;
  tables_to_add TEXT[] := ARRAY[
    -- Core entities
    'projects', 'tasks', 'payments', 'receipts', 'quotes', 'customers', 'employees',
    -- Notifications & Documents
    'notifications', 'chat_messages', 'conversations', 'document_templates',
    -- HRM & Attendance
    'attendance_records', 'hrm_role_groups', 'hrm_approval_config', 'hrm_leaves',
    'hrm_leave_coefficients', 'hrm_payroll_records', 'hrm_employee_errors',
    'hrm_holidays', 'hrm_trips', 'hrm_performance_criteria', 'hrm_salary_scales',
    'hrm_default_snapshots', 'hrm_task_permissions',
    -- Warehouse & Inventory
    'suppliers', 'inventory', 'warehouse_logs', 'subcontractor_advances',
    'subcontractor_catalog_items',
    -- Orders & Products
    'sales_orders', 'purchase_orders', 'product_prices', 'product_materials',
    'accounting_product_catalog',
    -- Accounting
    'accounting_liabilities', 'accounting_receivables', 'accounting_sub_contracts',
    -- Configuration
    'business_profile', 'shift_config', 'display_settings', 'quotation_configs',
    'kanban_columns',
    -- Archived & Templates
    'archived_quotes', 'construction_norms', 'travel_norms',
    -- Permissions
    'project_permissions', 'project_permission_overrides',
    -- Communication
    'fcm_tokens'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_to_add LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
      RAISE NOTICE '✅ Added: %', tbl;
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE '⏭ Already in publication: %', tbl;
    END;
  END LOOP;
END $$;

-- BƯỚC 3: Verify lại sau khi chạy bước 2
SELECT
  c.relname AS table_name
FROM pg_publication p
JOIN pg_publication_rel pr ON pr.prpubid = p.oid
JOIN pg_class c ON c.oid = pr.prrelid
WHERE p.pubname = 'supabase_realtime'
ORDER BY c.relname;
