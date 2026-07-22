-- =====================================================================
-- FIX: Thêm ON DELETE CASCADE cho tất cả foreign key constraints
-- Schema chính xác theo Supabase database
-- Chạy trong Supabase Dashboard > SQL Editor
-- =====================================================================

-- 1. PROJECTS → CUSTOMERS
ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_customer_id_fkey,
  ADD CONSTRAINT projects_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

-- 2. TASKS → PROJECTS
ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_project_id_fkey,
  ADD CONSTRAINT tasks_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- 3. RECEIPTS → CUSTOMERS
ALTER TABLE receipts
  DROP CONSTRAINT IF EXISTS receipts_customer_id_fkey,
  ADD CONSTRAINT receipts_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

-- 4. RECEIPTS → PROJECTS
ALTER TABLE receipts
  DROP CONSTRAINT IF EXISTS receipts_project_id_fkey,
  ADD CONSTRAINT receipts_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

-- 5. PAYMENTS → PROJECTS
ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_project_id_fkey,
  ADD CONSTRAINT payments_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

-- 6. QUOTES → CUSTOMERS
ALTER TABLE quotes
  DROP CONSTRAINT IF EXISTS quotes_customer_id_fkey,
  ADD CONSTRAINT quotes_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

-- 7. QUOTES → PROJECTS
ALTER TABLE quotes
  DROP CONSTRAINT IF EXISTS quotes_project_id_fkey,
  ADD CONSTRAINT quotes_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

-- 8. ARCHIVED_QUOTES → CUSTOMERS
ALTER TABLE archived_quotes
  DROP CONSTRAINT IF EXISTS archived_quotes_customer_id_fkey,
  ADD CONSTRAINT archived_quotes_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

-- 9. ARCHIVED_QUOTES → PROJECTS
ALTER TABLE archived_quotes
  DROP CONSTRAINT IF EXISTS archived_quotes_project_id_fkey,
  ADD CONSTRAINT archived_quotes_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

-- 10. SUBCONTRACTOR_ADVANCES → PROJECTS
ALTER TABLE subcontractor_advances
  DROP CONSTRAINT IF EXISTS subcontractor_advances_project_id_fkey,
  ADD CONSTRAINT subcontractor_advances_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

-- 11. CHAT_MESSAGES → CONVERSATIONS
ALTER TABLE chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_conversation_id_fkey,
  ADD CONSTRAINT chat_messages_conversation_id_fkey
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;

-- 12. HRM_LEAVES → EMPLOYEES (chưa có FK, thêm mới)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hrm_leaves_emp_id_fkey'
  ) THEN
    ALTER TABLE hrm_leaves
      ADD CONSTRAINT hrm_leaves_emp_id_fkey
        FOREIGN KEY (emp_id) REFERENCES employees(id) ON DELETE CASCADE;
    RAISE NOTICE '✅ Added: hrm_leaves.emp_id → employees ON DELETE CASCADE';
  END IF;
END $$;

-- 13. HRM_PAYROLL_RECORDS → EMPLOYEES (chưa có FK, thêm mới)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hrm_payroll_records_emp_id_fkey'
  ) THEN
    ALTER TABLE hrm_payroll_records
      ADD CONSTRAINT hrm_payroll_records_emp_id_fkey
        FOREIGN KEY (emp_id) REFERENCES employees(id) ON DELETE CASCADE;
    RAISE NOTICE '✅ Added: hrm_payroll_records.emp_id → employees ON DELETE CASCADE';
  END IF;
END $$;

-- 14. HRM_EMPLOYEE_ERRORS → EMPLOYEES (dùng employee_id, chưa có FK)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hrm_employee_errors_employee_id_fkey'
  ) THEN
    ALTER TABLE hrm_employee_errors
      ADD CONSTRAINT hrm_employee_errors_employee_id_fkey
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
    RAISE NOTICE '✅ Added: hrm_employee_errors.employee_id → employees ON DELETE CASCADE';
  END IF;
END $$;

-- 15. PUSH_SUBSCRIPTIONS → EMPLOYEES (chưa có FK, thêm mới)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'push_subscriptions_user_id_fkey'
  ) THEN
    ALTER TABLE push_subscriptions
      ADD CONSTRAINT push_subscriptions_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES employees(id) ON DELETE CASCADE;
    RAISE NOTICE '✅ Added: push_subscriptions.user_id → employees ON DELETE CASCADE';
  END IF;
END $$;

-- =====================================================================
-- HOÀN THÀNH!
-- Giờ bạn có thể xóa customers/projects mà dữ liệu liên quan sẽ tự xử lý.
-- =====================================================================
