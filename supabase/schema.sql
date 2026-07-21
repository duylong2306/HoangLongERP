-- =============================================================================
-- HOÀNG LONG ERP — Supabase Schema (SQL hoàn chỉnh)
-- =============================================================================
-- Chạy file này trong Supabase SQL Editor (Database → SQL Editor → Run).
-- Ứng dụng dùng Supabase anon key + tự quản lý auth (bảng employees),
-- nên RLS được cấu hình cho phép anon đọc/ghi toàn bộ (USING true / WITH CHECK true).
-- ID của mọi bảng là TEXT (app tự sinh: 'emp_admin', 'SUP_001', 'conv_personal_...').
-- Các trường ngày tháng được lưu dạng TEXT (ISO string) để khớp với app
-- (rowToCamel/keysToSnake chỉ đổi tên cột, không parse kiểu).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. EMPLOYEES (Nhân viên + tài khoản hệ thống)
-- -----------------------------------------------------------------------------
create table if not exists public.employees (
  id               text primary key,
  name             text,
  email            text,
  phone            text,
  department       text,
  username         text,
  password         text,
  avatar           text,
  address          text,
  role             text,                       -- legacy: dùng role_group_ids thay thế
  role_group_ids   text[] default '{}'
);

-- -----------------------------------------------------------------------------
-- 2. CUSTOMERS (Khách hàng)
-- -----------------------------------------------------------------------------
create table if not exists public.customers (
  id              text primary key,
  name            text,
  phone           text,
  email           text,
  address         text,
  company         text,
  type            text,                       -- 'individual' | 'organization'
  representative  text,
  tax_or_id_number text,
  notes           text
);

-- -----------------------------------------------------------------------------
-- 3. PROJECTS (Dự án)
-- -----------------------------------------------------------------------------
create table if not exists public.projects (
  id                    text primary key,
  code                  text,
  name                  text,
  customer_id           text references public.customers(id),
  address               text,
  type                  text,                 -- construction|furniture|mechanical|general
  contract_value        numeric,
  start_date            text,
  end_date              text,
  pm_id                 text,                 -- employee id
  status                text,                 -- new|processing|paused|completed|cancelled
  progress              numeric,
  notes                 text,
  image                 text,
  documents             jsonb,                -- ProjectDoc[]
  involved_employee_ids text[] default '{}',
  kanban_column_id      text,
  style_italic          boolean,
  style_bold            boolean,
  style_strike          boolean,
  style_color           text,
  card_color            text,
  bao_gia_file          jsonb
);

-- -----------------------------------------------------------------------------
-- 4. TASKS (Công việc Kanban)
-- -----------------------------------------------------------------------------
create table if not exists public.tasks (
  id                          text primary key,
  code                        text,
  project_id                  text references public.projects(id),
  column_id                   text,
  name                        text,
  description                 text,
  assigner_id                 text,
  assignee_id                 text,
  department                  text,
  deadline                    text,
  priority                    text,            -- high|medium|low
  status                      text,            -- todo|doing|reviewing|completed|overdue
  completion_rate             numeric,
  notes                       text,
  attachment_name             text,
  involved_employee_ids       text[] default '{}',
  approvals                   jsonb,           -- ApprovalStep[]
  work_logs                   jsonb,           -- TaskWorkLog[]
  comments                    jsonb,           -- TaskComment[]
  time_logs                   jsonb,           -- TaskTimeLog[]
  advance_requests            jsonb,           -- advance request[]
  checklist_texts             text[] default '{}',
  completed_checklist_texts   text[] default '{}',
  style_italic                boolean,
  style_bold                  boolean,
  style_strike                boolean,
  style_color                 text,
  is_approval_enabled         boolean,
  is_approval_required        boolean,
  is_doc_generation_enabled   boolean,
  is_cost_enabled             boolean,
  is_material_enabled         boolean,
  is_subcontractor_enabled    boolean,
  subcontractor_id            text,
  subcontractor_name          text,
  default_approver_id         text,
  cost_approver_id            text,
  cost_settler_id             text,
  is_material_self_coordinated boolean,
  material_coordinator_id     text,
  subcontractor_approver_id   text,
  subcontractor_settler_id    text,
  missions                    jsonb            -- SubTaskMission[]
);

-- -----------------------------------------------------------------------------
-- 5. RECEIPTS (Phiếu thu)
-- -----------------------------------------------------------------------------
create table if not exists public.receipts (
  id              text primary key,
  code            text,
  date            text,
  customer_id     text references public.customers(id),
  project_id      text references public.projects(id),
  amount          numeric,
  payment_method  text,                        -- cash|transfer
  notes           text,
  collector       text,
  attachment_name text
);

-- -----------------------------------------------------------------------------
-- 6. PAYMENTS (Phiếu chi)
-- -----------------------------------------------------------------------------
create table if not exists public.payments (
  id              text primary key,
  code            text,
  date            text,
  recipient       text,
  project_id      text references public.projects(id),
  category        text,
  amount          numeric,
  payment_method  text,                        -- cash|transfer
  notes           text,
  proposer        text,
  approver        text,
  status          text,                        -- pending|approved|rejected
  attachment_name text,
  approvals       jsonb                        -- ApprovalStep[]
);

-- -----------------------------------------------------------------------------
-- 7. QUOTES (Báo giá active)
-- -----------------------------------------------------------------------------
create table if not exists public.quotes (
  id                     text primary key,
  code                   text,
  customer_id            text references public.customers(id),
  project_id             text references public.projects(id),
  project_name           text,
  chieu_dai              numeric,
  chieu_rong             numeric,
  so_tang                numeric,
  selected_house_type    text,
  don_gia_khai_toan      numeric,
  ngan_sach_noi_that     numeric,
  features               text,
  min_price              numeric,
  max_price              numeric,
  dien_tich_san          numeric,
  tong_dien_tich_xay_dung numeric,
  date                   text,
  items                  jsonb,                -- QuoteItem[]
  config                 jsonb,                -- QuoteConfig
  status                 text,                 -- draft|sent|approved|rejected
  notes                  text,
  payment_terms          text,
  customer_name          text,
  customer_phone         text,
  customer_address       text,
  takeoff_rows           jsonb,
  company_logo_img       text,
  company_logo_text      text,
  company_slogan         text,
  company_address_info   text,
  company_contact_info   text,
  contract_html          text,
  acceptance_html        text,
  liquidation_html       text,
  final_quote_html       text,
  contract_template      text,
  acceptance_template    text,
  liquidation_template   text,
  subcontractor_id       text,
  subcontractor_name     text,
  task_id                text,
  work_name              text,
  contract_value         numeric,
  created_date           text,
  signed_date            text,
  start_date             text,
  end_date               text,
  created_at             text,
  ho_ten_b               text,
  gioi_tinh_b            text,
  ngay_sinh_b            text,
  cccd_b                 text,
  ngay_cap_b             text,
  noi_cap_b              text,
  dia_chi_b              text,
  sdt_b                  text,
  email_b                text,
  mst_cn_b               text,
  stk_b                  text,
  ngan_hang_b            text,
  mo_ta_kq_ban_giao     text,
  dia_diem_thuc_hien     text,
  ty_le_khau_tru_tncn    numeric,
  tien_tam_ung           numeric,
  so_ngay_tam_ung        numeric,
  so_ngay_thanh_toan     numeric,
  dieu_khoan_nghiem_thu  text,
  thoi_gian_bao_hanh     text,
  ty_le_phat_cham        numeric,
  muc_phat_toi_da        numeric
);

-- -----------------------------------------------------------------------------
-- 8. HRM — ROLE GROUPS (Nhóm quyền vai trò)
-- -----------------------------------------------------------------------------
create table if not exists public.hrm_role_groups (
  id          text primary key,
  name        text,
  description text,
  permissions jsonb,                           -- { moduleCode: {view,create,edit,delete} }
  member_ids  text[] default '{}',
  created_at  text,
  updated_at  text
);

-- -----------------------------------------------------------------------------
-- 9. HRM — APPROVAL CONFIG (Cấu hình phê duyệt)
-- -----------------------------------------------------------------------------
create table if not exists public.hrm_approval_config (
  id                 text primary key,
  document_type      text,                     -- quotation|contract|acceptance|liquidation|leave|salary_advance
  document_type_label text,
  approver_id        text,
  approver_name      text,
  approver_position  text,
  can_approve        boolean
);

-- -----------------------------------------------------------------------------
-- 10. HRM — DEFAULT SNAPSHOTS (Cấu hình mặc định theo tab)
-- -----------------------------------------------------------------------------
create table if not exists public.hrm_default_snapshots (
  tab  text primary key,
  data jsonb
);

-- -----------------------------------------------------------------------------
-- 11. HRM — LEAVES (Đơn nghỉ phép)
-- -----------------------------------------------------------------------------
create table if not exists public.hrm_leaves (
  id                      text primary key,
  emp_id                  text,
  emp_name                text,
  type                    text,
  from_date               text,
  to_date                 text,
  days_count              numeric,
  reason                  text,
  status                  text,                -- pending|approved|rejected
  created_at              text,
  submitted_at            text,
  approver_name           text,
  approver_id             text,
  approver_position       text,
  is_attendance_correction boolean,
  shift                   text,                -- morning|afternoon
  approvals               jsonb
);

-- -----------------------------------------------------------------------------
-- 12. HRM — LEAVE COEFFICIENTS (Hệ số nghỉ phép)
-- -----------------------------------------------------------------------------
create table if not exists public.hrm_leave_coefficients (
  id          text primary key,
  type        text,
  is_auto     boolean,
  coefficient numeric
);

-- -----------------------------------------------------------------------------
-- 13. HRM — PAYROLL RECORDS (Bảng lương)
-- -----------------------------------------------------------------------------
create table if not exists public.hrm_payroll_records (
  id                        text primary key,
  blu_code                  text,
  emp_id                    text,
  emp_name                  text,
  month                     text,
  base_salary               numeric,
  performance_salary        numeric,
  kpi_score                 numeric,
  kpi_bonus                 numeric,
  salary_per_day            numeric,
  day_salary                numeric,
  worked_days               numeric,
  ot_sunday                 numeric,
  ot_sunday_salary          numeric,
  ot_holiday                numeric,
  ot_holiday_salary         numeric,
  ot_hours                  numeric,
  ot_count                  numeric,
  ot_hours_salary           numeric,
  expenses                  numeric,
  bonus_holiday             numeric,
  bonus_creative            numeric,
  total_income              numeric,
  insurance                 numeric,
  other_deductions          numeric,
  advances                  numeric,
  net_salary                numeric,
  status                    text,              -- unpaid|paid
  allowance                 numeric,
  tax                       numeric,
  kpi_max_allowed           numeric,
  monthly_salary            numeric,
  ot_weekend_salary         numeric,
  ot_hourly_salary          numeric,
  ot_allowance              numeric,
  total_ot_hours_salary     numeric,
  taxable_income            numeric,
  taxable_net_income        numeric
);

-- -----------------------------------------------------------------------------
-- 14. HRM — EMPLOYEE ERRORS (Lỗi / Khen thưởng)
-- -----------------------------------------------------------------------------
create table if not exists public.hrm_employee_errors (
  id               text primary key,
  employee_id      text,
  employee_name    text,
  department_code  text,
  department_name  text,
  criterion_id     text,
  criterion_content text,
  category         text,                       -- readiness|progress|reporting
  date             text,
  notes            text,
  severity         text,                       -- low|medium|high
  images           text[] default '{}'
);

-- -----------------------------------------------------------------------------
-- 15. HRM — TASK PERMISSIONS (Ma trận quyền tác vụ)
-- -----------------------------------------------------------------------------
create table if not exists public.hrm_task_permissions (
  id     text primary key,                     -- fixed: 'task_permission_matrix_v1'
  matrix jsonb
);

-- -----------------------------------------------------------------------------
-- 16. HRM — HOLIDAYS (Ngày lễ)
-- -----------------------------------------------------------------------------
create table if not exists public.hrm_holidays (
  id   text primary key,
  date text,
  name text
);

-- -----------------------------------------------------------------------------
-- 17. ARCHIVED QUOTES (Lưu trữ hồ sơ theo sector)
-- -----------------------------------------------------------------------------
create table if not exists public.archived_quotes (
  id                   text primary key,
  sector               text,                   -- furniture|construction|mechanical|subcontractor|general
  code                 text,
  customer_id          text references public.customers(id),
  project_id           text references public.projects(id),
  subcontractor_id     text,
  contract_value       numeric,
  status               text,
  scope_work           text,
  items                jsonb,
  contract_html        text,
  acceptance_html      text,
  liquidation_html     text,
  final_quote_html     text,
  is_approved          boolean,
  contract_approved    boolean,
  acceptance_approved  boolean,
  liquidation_approved boolean,
  approved_at          text,
  approved_by          text,
  creator_id           text,
  created_at           text,
  updated_at           text
);

-- -----------------------------------------------------------------------------
-- 18. SUBCONTRACTOR ADVANCES (Đề xuất thu chi thầu phụ)
-- -----------------------------------------------------------------------------
create table if not exists public.subcontractor_advances (
  id              text primary key,
  subcontractor_id text,
  subcontractor_name text,
  project_id      text references public.projects(id),
  project_name    text,
  task_id         text,
  task_name       text,
  amount          numeric,
  reason          text,
  approver        text,
  creator         text,
  status          text,                        -- pending_approval|pending_payment|rejected|completed
  date            text,
  proposal_date   text,
  type            text,                        -- subcontractor_advance|project_expense_proposal
  creator_name    text,
  approver_name   text,
  settler_id      text,
  settler_name    text,
  expense_items   jsonb,
  approvals       jsonb
);

-- -----------------------------------------------------------------------------
-- 19. DOCUMENT TEMPLATES (Mẫu hồ sơ thiết kế)
-- -----------------------------------------------------------------------------
create table if not exists public.document_templates (
  id                                text primary key,  -- fixed: 'global'
  contract_template                 text,
  acceptance_template               text,
  liquidation_template              text,
  final_quote_template              text,
  construction_contract_template    text,
  construction_acceptance_template  text,
  construction_liquidation_template text,
  mechanical_contract_template      text,
  mechanical_acceptance_template    text,
  mechanical_liquidation_template   text,
  subcontractor_contract_template   text,
  subcontractor_acceptance_template text,
  subcontractor_liquidation_template text
);

-- -----------------------------------------------------------------------------
-- 20. PROJECT PERMISSIONS (Ma trận quyền dự án toàn hệ thống)
-- -----------------------------------------------------------------------------
create table if not exists public.project_permissions (
  id     text primary key,                     -- fixed: 'global'
  matrix jsonb
);

-- -----------------------------------------------------------------------------
-- 21. PROJECT PERMISSION OVERRIDES (Ghi đè theo từng dự án)
-- -----------------------------------------------------------------------------
create table if not exists public.project_permission_overrides (
  id         text primary key,                 -- = projectId
  project_id text,
  overrides  jsonb
);

-- -----------------------------------------------------------------------------
-- 22. QUOTATION CONFIGS (Cấu hình mẫu báo giá theo sector)
-- -----------------------------------------------------------------------------
create table if not exists public.quotation_configs (
  sector text primary key,                     -- furniture|construction|mechanical|subcontractor
  config jsonb
);

-- -----------------------------------------------------------------------------
-- 23. NOTIFICATIONS (Thông báo hệ thống)
-- -----------------------------------------------------------------------------
create table if not exists public.notifications (
  id               text primary key,
  recipient_id     text,
  recipient_name   text,
  department       text,
  content          text,
  sub_task_code    text,
  created_at       text,
  read             boolean,
  sender_id        text,
  sender_name      text,
  sender_avatar    text,
  category         text,                        -- tasks|projects|employees|finance|warehouse|...
  title            text,
  detailed_content text,
  attachments      jsonb,
  conversation_id  text,
  task_id          text
);

-- -----------------------------------------------------------------------------
-- 24. SUPPLIERS (Nhà cung cấp)
-- -----------------------------------------------------------------------------
create table if not exists public.suppliers (
  id          text primary key,
  name        text,
  representative text,
  phone       text,
  email       text,
  address     text,
  field       text,
  bank_account text,
  bank_name   text,
  note        text,
  debt        numeric,
  region      text,
  bank_no     text,
  gender      text,
  birth_date  text,
  cccd        text,
  cccd_date   text,
  cccd_place  text,
  tax_code    text
);

-- -----------------------------------------------------------------------------
-- 25. INVENTORY (Kho vật tư)
-- -----------------------------------------------------------------------------
create table if not exists public.inventory (
  id         text primary key,
  code       text,
  name       text,
  unit       text,
  qty        numeric,
  unit_price numeric,
  min_alert  numeric,
  location   text
);

-- -----------------------------------------------------------------------------
-- 26. WAREHOUSE LOGS (Lịch sử xuất nhập kho)
-- -----------------------------------------------------------------------------
create table if not exists public.warehouse_logs (
  id     text primary key,
  time   text,
  type   text,                                 -- in|out
  mat_name text,
  qty    numeric,
  target text,
  note   text
);

-- -----------------------------------------------------------------------------
-- 27. SUBCONTRACTOR CATALOG ITEMS (Catalog sản phẩm thầu phụ)
-- -----------------------------------------------------------------------------
create table if not exists public.subcontractor_catalog_items (
  id                text primary key,
  linh_vuc          text,
  danh_muc          text,
  ten_san_pham      text,
  chat_lieu         text,
  don_vi            text,
  don_gia_thai_lan  numeric,
  don_gia_an_cuong  numeric,
  don_gia_plywood   numeric
);

-- -----------------------------------------------------------------------------
-- 28. ATTENDANCE RECORDS (Chấm công)
-- -----------------------------------------------------------------------------
create table if not exists public.attendance_records (
  id          text primary key,
  emp_id      text,
  emp_name    text,
  date        text,
  time_in_s   text,
  time_out_s  text,
  time_in_c   text,
  time_out_c  text,
  time_in_ot  text,
  time_out_ot text,
  method      text,
  status      text,
  ot_hours    numeric,
  notes       text,
  photo_in    text,
  location_in text,
  coords_in   text,
  photo_out   text,
  location_out text,
  coords_out  text,
  is_locked   boolean
);

-- -----------------------------------------------------------------------------
-- 29. CONVERSATIONS (Hội thoại chat)
-- -----------------------------------------------------------------------------
create table if not exists public.conversations (
  id             text primary key,
  type           text,                         -- personal|group|task
  name           text,
  avatar         text,
  color          text,
  participant_ids text[] default '{}',
  created_by     text,
  created_at     text,
  last_message_at text,
  unread_count   integer default 0,
  task_id        text,
  project_id     text,
  pinned         boolean default false
);

-- -----------------------------------------------------------------------------
-- 30. CHAT MESSAGES (Tin nhắn)
-- -----------------------------------------------------------------------------
create table if not exists public.chat_messages (
  id               text primary key,
  conversation_id  text references public.conversations(id) on delete cascade,
  sender_id        text,
  sender_name      text,
  sender_role      text,
  content          text,
  created_at       text,
  read             boolean default false,
  attachments      jsonb,
  system           boolean default false,
  edited           boolean default false,
  edited_at        text,
  deleted          boolean default false,
  deleted_at       text,
  pinned           boolean default false,
  reply_to         jsonb
);

-- -----------------------------------------------------------------------------
-- 31. FCM TOKENS (Push notification tokens)
-- -----------------------------------------------------------------------------
create table if not exists public.fcm_tokens (
  user_id    text not null,
  token      text not null,
  platform   text,
  updated_at text,
  primary key (user_id, token)
);

-- =============================================================================
-- INDEXES (tối ưu truy vấn thường dùng)
-- =============================================================================
create index if not exists idx_projects_customer_id      on public.projects(customer_id);
create index if not exists idx_tasks_project_id          on public.tasks(project_id);
create index if not exists idx_receipts_customer_id      on public.receipts(customer_id);
create index if not exists idx_receipts_project_id       on public.receipts(project_id);
create index if not exists idx_payments_project_id       on public.payments(project_id);
create index if not exists idx_quotes_customer_id        on public.quotes(customer_id);
create index if not exists idx_quotes_project_id         on public.quotes(project_id);
create index if not exists idx_archived_quotes_sector    on public.archived_quotes(sector);
create index if not exists idx_archived_quotes_customer  on public.archived_quotes(customer_id);
create index if not exists idx_subcontractor_advances_proj on public.subcontractor_advances(project_id);
create index if not exists idx_notifications_recipient   on public.notifications(recipient_id);
create index if not exists idx_attendance_emp_date       on public.attendance_records(emp_id, date);
create index if not exists idx_hrm_leaves_emp            on public.hrm_leaves(emp_id);
create index if not exists idx_chat_messages_conversation on public.chat_messages(conversation_id);
create index if not exists idx_chat_messages_created     on public.chat_messages(created_at);
-- GIN index cho truy vấn participant_ids (dùng .contains trong chatStore)
create index if not exists idx_conversations_participants on public.conversations using gin (participant_ids);

-- =============================================================================
-- ROW LEVEL SECURITY
-- App dùng Supabase anon key + tự xác thực (bảng employees), nên cho phép
-- anon thao tác toàn bộ. Nếu sau này tích hợp Supabase Auth, hãy siết lại policies.
-- =============================================================================
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'employees','customers','projects','tasks','receipts','payments','quotes',
      'hrm_role_groups','hrm_approval_config','hrm_default_snapshots','hrm_leaves',
      'hrm_leave_coefficients','hrm_payroll_records','hrm_employee_errors',
      'hrm_task_permissions','hrm_holidays','archived_quotes','subcontractor_advances',
      'document_templates','project_permissions','project_permission_overrides',
      'quotation_configs','notifications','suppliers','inventory','warehouse_logs',
      'subcontractor_catalog_items','attendance_records','conversations',
      'chat_messages','fcm_tokens'
    ])
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format(
      'drop policy if exists "anon_all_%I" on public.%I;', t, t
    );
    execute format(
      'create policy "anon_all_%I" on public.%I for all to anon using (true) with check (true);',
      t, t
    );
    execute format(
      'drop policy if exists "service_all_%I" on public.%I;', t, t
    );
    execute format(
      'create policy "service_all_%I" on public.%I for all to service_role using (true) with check (true);',
      t, t
    );
  end loop;
end $$;

-- =============================================================================
-- SEED (tùy chọn): bật bootstrap lần đầu qua dbService.bootstrapFirstTime(force=true)
-- Hoặc chạy script seed riêng. Schema ở trên đã sẵn sàng nhận dữ liệu.
-- =============================================================================
