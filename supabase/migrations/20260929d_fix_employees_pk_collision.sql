-- ============================================================================
-- HOTFIX (tiếp tục rà soát menu-by-menu): bảng `employees` — bảng QUAN TRỌNG
-- NHẤT (chứa tài khoản đăng nhập) — vẫn PK đơn (id). Rủi ro giống các bảng
-- trước: "Mã NV" tự nhập khi import Excel (HumanResourcesManagement.tsx)
-- không đảm bảo duy nhất giữa các công ty; quy ước bootstrap admin cũng hay
-- dùng id cố định 'emp_admin' (xem ADMIN_EMPLOYEE trong App.tsx/AuthContext.tsx)
-- — 2 công ty khác nhau đều có thể có nhân viên id='emp_admin' hoặc 'NV001'.
--
-- Vá: đổi PK sang khoá ghép (company_id, id). Có 1 bảng phụ thuộc FK đơn
-- (push_subscriptions.user_id → employees.id) — đổi luôn sang khoá ghép
-- (company_id, user_id) để không vỡ.
-- ============================================================================

begin;

alter table public.push_subscriptions drop constraint if exists push_subscriptions_user_id_fkey;

alter table public.employees drop constraint if exists employees_pkey;
alter table public.employees add primary key (company_id, id);

alter table public.push_subscriptions add constraint push_subscriptions_user_id_fkey
  foreign key (company_id, user_id) references public.employees (company_id, id);

commit;

-- ============================================================================
-- VERIFY:
--   select conrelid::regclass, pg_get_constraintdef(oid) from pg_constraint
--   where contype = 'p' and conrelid::regclass::text = 'employees';
--   -- phải là: PRIMARY KEY (company_id, id)
-- ============================================================================
