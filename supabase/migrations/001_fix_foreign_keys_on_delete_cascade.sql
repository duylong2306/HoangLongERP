-- =====================================================================
-- FIX: Thêm ON DELETE CASCADE cho tất cả foreign key constraints
-- Chạy trong Supabase Dashboard > SQL Editor
-- =====================================================================

-- 1. PROJECTS → CUSTOMERS (projects.customer_id → customers.id)
ALTER TABLE IF EXISTS projects
  DROP CONSTRAINT IF EXISTS projects_customer_id_fkey,
  ADD CONSTRAINT projects_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

-- 2. TASKS → PROJECTS (tasks.project_id → projects.id)
ALTER TABLE IF EXISTS tasks
  DROP CONSTRAINT IF EXISTS tasks_project_id_fkey,
  ADD CONSTRAINT tasks_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- 3. QUOTES → CUSTOMERS (quotes.customer_id → customers.id)
ALTER TABLE IF EXISTS quotes
  DROP CONSTRAINT IF EXISTS quotes_customer_id_fkey,
  ADD CONSTRAINT quotes_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

-- 4. QUOTES → PROJECTS (quotes.project_id → projects.id)
ALTER TABLE IF EXISTS quotes
  DROP CONSTRAINT IF EXISTS quotes_project_id_fkey,
  ADD CONSTRAINT quotes_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

-- 5. ARCHIVED_QUOTES → CUSTOMERS
ALTER TABLE IF EXISTS archived_quotes
  DROP CONSTRAINT IF EXISTS archived_quotes_customer_id_fkey,
  ADD CONSTRAINT archived_quotes_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

-- 6. ARCHIVED_QUOTES → PROJECTS
ALTER TABLE IF EXISTS archived_quotes
  DROP CONSTRAINT IF EXISTS archived_quotes_project_id_fkey,
  ADD CONSTRAINT archived_quotes_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

-- 7. RECEIPTS → PROJECTS
ALTER TABLE IF EXISTS receipts
  DROP CONSTRAINT IF EXISTS receipts_project_id_fkey,
  ADD CONSTRAINT receipts_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

-- 8. RECEIPTS → CUSTOMERS
ALTER TABLE IF EXISTS receipts
  DROP CONSTRAINT IF EXISTS receipts_customer_id_fkey,
  ADD CONSTRAINT receipts_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

-- 9. PAYMENTS → PROJECTS
ALTER TABLE IF EXISTS payments
  DROP CONSTRAINT IF EXISTS payments_project_id_fkey,
  ADD CONSTRAINT payments_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

-- 10. PAYMENTS → CUSTOMERS
ALTER TABLE IF EXISTS payments
  DROP CONSTRAINT IF EXISTS payments_customer_id_fkey,
  ADD CONSTRAINT payments_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

-- 11. CHAT_MESSAGES → CONVERSATIONS
ALTER TABLE IF EXISTS chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_conversation_id_fkey,
  ADD CONSTRAINT chat_messages_conversation_id_fkey
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;

-- 12. ATTENDANCE_RECORDS → EMPLOYEES
ALTER TABLE IF EXISTS attendance_records
  DROP CONSTRAINT IF EXISTS attendance_records_emp_id_fkey,
  ADD CONSTRAINT attendance_records_emp_id_fkey
    FOREIGN KEY (emp_id) REFERENCES employees(id) ON DELETE CASCADE;

-- 13. HRM_LEAVES → EMPLOYEES
ALTER TABLE IF EXISTS hrm_leaves
  DROP CONSTRAINT IF EXISTS hrm_leaves_emp_id_fkey,
  ADD CONSTRAINT hrm_leaves_emp_id_fkey
    FOREIGN KEY (emp_id) REFERENCES employees(id) ON DELETE CASCADE;

-- 14. HRM_PAYROLL_RECORDS → EMPLOYEES
ALTER TABLE IF EXISTS hrm_payroll_records
  DROP CONSTRAINT IF EXISTS hrm_payroll_records_emp_id_fkey,
  ADD CONSTRAINT hrm_payroll_records_emp_id_fkey
    FOREIGN KEY (emp_id) REFERENCES employees(id) ON DELETE CASCADE;

-- 15. HRM_EMPLOYEE_ERRORS → EMPLOYEES
ALTER TABLE IF EXISTS hrm_employee_errors
  DROP CONSTRAINT IF EXISTS hrm_employee_errors_emp_id_fkey,
  ADD CONSTRAINT hrm_employee_errors_emp_id_fkey
    FOREIGN KEY (emp_id) REFERENCES employees(id) ON DELETE CASCADE;

-- 16. HRM_TRIPS → EMPLOYEES
ALTER TABLE IF EXISTS hrm_trips
  DROP CONSTRAINT IF EXISTS hrm_trips_emp_id_fkey,
  ADD CONSTRAINT hrm_trips_emp_id_fkey
    FOREIGN KEY (emp_id) REFERENCES employees(id) ON DELETE CASCADE;

-- 17. PUSH_SUBSCRIPTIONS → EMPLOYEES
ALTER TABLE IF EXISTS push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_fkey,
  ADD CONSTRAINT push_subscriptions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES employees(id) ON DELETE CASCADE;

-- =====================================================================
-- SAFETY: Bỏ qua lỗi nếu bảng/khóa không tồn tại
-- Trên Supabase, ALTER TABLE sẽ báo lỗi nếu constraint không có →
-- Đây là expected behavior, chỉ cần chạy lại nếu cần.
-- =====================================================================
