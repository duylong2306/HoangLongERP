-- =============================================================================
-- HOÃ€NG LONG ERP â€” Supabase Schema (SQL hoÃ n chá»‰nh)
-- =============================================================================
-- Cháº¡y file nÃ y trong Supabase SQL Editor (Database â†’ SQL Editor â†’ Run).
-- á»¨ng dá»¥ng dÃ¹ng Supabase anon key + tá»± quáº£n lÃ½ auth (báº£ng employees),
-- nÃªn RLS Ä‘Æ°á»£c cáº¥u hÃ¬nh cho phÃ©p anon Ä‘á»c/ghi toÃ n bá»™ (USING true / WITH CHECK true).
-- ID cá»§a má»i báº£ng lÃ  TEXT (app tá»± sinh: 'emp_admin', 'SUP_001', 'conv_personal_...').
-- CÃ¡c trÆ°á»ng ngÃ y thÃ¡ng Ä‘Æ°á»£c lÆ°u dáº¡ng TEXT (ISO string) Ä‘á»ƒ khá»›p vá»›i app
-- (rowToCamel/keysToSnake chá»‰ Ä‘á»•i tÃªn cá»™t, khÃ´ng parse kiá»ƒu).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. EMPLOYEES (NhÃ¢n viÃªn + tÃ i khoáº£n há»‡ thá»‘ng)
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
  role             text,                       -- legacy: dÃ¹ng role_group_ids thay tháº¿
  role_group_ids   text[] default '{}'
);

-- -----------------------------------------------------------------------------
-- 2. CUSTOMERS (KhÃ¡ch hÃ ng)
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
-- 3. PROJECTS (Dá»± Ã¡n)
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
-- 4. TASKS (CÃ´ng viá»‡c Kanban)
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
-- 5. RECEIPTS (Phiáº¿u thu)
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
-- 6. PAYMENTS (Phiáº¿u chi)
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
-- 7. QUOTES (BÃ¡o giÃ¡ active)
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
-- 8. HRM â€” ROLE GROUPS (NhÃ³m quyá»n vai trÃ²)
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
-- 9. HRM â€” APPROVAL CONFIG (Cáº¥u hÃ¬nh phÃª duyá»‡t)
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
-- 10. HRM â€” DEFAULT SNAPSHOTS (Cáº¥u hÃ¬nh máº·c Ä‘á»‹nh theo tab)
-- -----------------------------------------------------------------------------
create table if not exists public.hrm_default_snapshots (
  tab  text primary key,
  data jsonb
);

-- -----------------------------------------------------------------------------
-- 11. HRM â€” LEAVES (ÄÆ¡n nghá»‰ phÃ©p)
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
-- 12. HRM â€” LEAVE COEFFICIENTS (Há»‡ sá»‘ nghá»‰ phÃ©p)
-- -----------------------------------------------------------------------------
create table if not exists public.hrm_leave_coefficients (
  id          text primary key,
  type        text,
  is_auto     boolean,
  coefficient numeric
);

-- -----------------------------------------------------------------------------
-- 13. HRM â€” PAYROLL RECORDS (Báº£ng lÆ°Æ¡ng)
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
-- 14. HRM â€” EMPLOYEE ERRORS (Lá»—i / Khen thÆ°á»Ÿng)
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
-- 15. HRM â€” TASK PERMISSIONS (Ma tráº­n quyá»n tÃ¡c vá»¥)
-- -----------------------------------------------------------------------------
create table if not exists public.hrm_task_permissions (
  id     text primary key,                     -- fixed: 'task_permission_matrix_v1'
  matrix jsonb
);

-- -----------------------------------------------------------------------------
-- 16. HRM â€” HOLIDAYS (NgÃ y lá»…)
-- -----------------------------------------------------------------------------
create table if not exists public.hrm_holidays (
  id   text primary key,
  date text,
  name text
);

-- -----------------------------------------------------------------------------
-- 17. ARCHIVED QUOTES (LÆ°u trá»¯ há»“ sÆ¡ theo sector)
-- -----------------------------------------------------------------------------
create table if not exists public.archived_quotes (
  id                   text primary key,
  sector               text,                   -- furniture|construction|mechanical|subcontractor|general
  code                 text,
  customer_id          text,
  project_id           text,
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
  updated_at           text,
  -- Construction-specific columns
  project_name         text,
  customer_name        text,
  customer_phone       text,
  customer_address     text,
  chieu_dai            numeric,
  chieu_rong           numeric,
  so_tang              numeric,
  selected_house_type  text,
  don_gia_khai_toan    numeric,
  ngan_sach_noi_that   numeric,
  features             text,
  min_price            numeric,
  max_price            numeric,
  dien_tich_san        numeric,
  tong_dien_tich_xay_dung numeric,
  date                 text,
  config               jsonb,
  notes                text,
  payment_terms        text,
  total_amount         numeric,
  creator_name         text,
  company_logo_img     text,
  company_logo_text    text,
  company_slogan       text,
  company_address_info text,
  company_contact_info text,
  contract_template    text,
  acceptance_template  text,
  liquidation_template text,
  takeoff_rows         jsonb,
  takeoff_totals       jsonb,
  final_items          jsonb,
  selected_final_result text,
  pre_estimate_amount  numeric,
  takeoff_cost_total   numeric,
  is_final_quote       boolean
);

-- -----------------------------------------------------------------------------
-- 18. SUBCONTRACTOR ADVANCES (Äá» xuáº¥t thu chi tháº§u phá»¥)
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
-- 19. DOCUMENT TEMPLATES (Máº«u há»“ sÆ¡ thiáº¿t káº¿)
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
-- 20. PROJECT PERMISSIONS (Ma tráº­n quyá»n dá»± Ã¡n toÃ n há»‡ thá»‘ng)
-- -----------------------------------------------------------------------------
create table if not exists public.project_permissions (
  id     text primary key,                     -- fixed: 'global'
  matrix jsonb
);

-- -----------------------------------------------------------------------------
-- 21. PROJECT PERMISSION OVERRIDES (Ghi Ä‘Ã¨ theo tá»«ng dá»± Ã¡n)
-- -----------------------------------------------------------------------------
create table if not exists public.project_permission_overrides (
  id         text primary key,                 -- = projectId
  project_id text,
  overrides  jsonb
);

-- -----------------------------------------------------------------------------
-- 22. QUOTATION CONFIGS (Cáº¥u hÃ¬nh máº«u bÃ¡o giÃ¡ theo sector)
-- -----------------------------------------------------------------------------
create table if not exists public.quotation_configs (
  sector text primary key,                     -- furniture|construction|mechanical|subcontractor
  config jsonb
);

-- -----------------------------------------------------------------------------
-- 23. NOTIFICATIONS (ThÃ´ng bÃ¡o há»‡ thá»‘ng)
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
-- 24. SUPPLIERS (NhÃ  cung cáº¥p)
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
-- 25. INVENTORY (Kho váº­t tÆ°)
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
-- 26. WAREHOUSE LOGS (Lá»‹ch sá»­ xuáº¥t nháº­p kho)
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
-- 27. SUBCONTRACTOR CATALOG ITEMS (Catalog sáº£n pháº©m tháº§u phá»¥)
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
-- 27b. PRODUCT PRICES (Giá bán theo sản phẩm - từ Danh mục sản phẩm)
-- -----------------------------------------------------------------------------
create table if not exists public.product_prices (
  id                text primary key,
  product_id        text,
  ten_gia           text,
  don_gia           numeric,
  ghi_chu           text
);

-- -----------------------------------------------------------------------------
-- 27c. PRODUCT MATERIALS (Chất liệu theo sản phẩm - từ Danh mục sản phẩm)
-- -----------------------------------------------------------------------------
create table if not exists public.product_materials (
  id                text primary key,
  product_id        text,
  ten_chat_lieu     text,
  ghi_chu           text
);

-- -----------------------------------------------------------------------------
-- 28. ATTENDANCE RECORDS (Cháº¥m cÃ´ng)
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
-- 29. CONVERSATIONS (Há»™i thoáº¡i chat)
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
-- 30. CHAT MESSAGES (Tin nháº¯n)
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
-- INDEXES (tá»‘i Æ°u truy váº¥n thÆ°á»ng dÃ¹ng)
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
-- GIN index cho truy váº¥n participant_ids (dÃ¹ng .contains trong chatStore)
create index if not exists idx_conversations_participants on public.conversations using gin (participant_ids);

-- =============================================================================
-- 32. CONSTRUCTION NORMS (Äá»‹nh má»©c & Ä‘Æ¡n giÃ¡ xÃ¢y dá»±ng - LÆ°u JSON array)
-- =============================================================================
create table if not exists public.construction_norms (
  id         text primary key,
  data       jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- =============================================================================
-- ROW LEVEL SECURITY
-- App dÃ¹ng Supabase anon key + tá»± xÃ¡c thá»±c (báº£ng employees), nÃªn cho phÃ©p
-- anon thao tÃ¡c toÃ n bá»™. Náº¿u sau nÃ y tÃ­ch há»£p Supabase Auth, hÃ£y siáº¿t láº¡i policies.
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
      'chat_messages','fcm_tokens','construction_norms',
      'product_prices','product_materials'
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
-- SEED (tÃ¹y chá»n): báº­t bootstrap láº§n Ä‘áº§u qua dbService.bootstrapFirstTime(force=true)
-- Hoáº·c cháº¡y script seed riÃªng. Schema á»Ÿ trÃªn Ä‘Ã£ sáºµn sÃ ng nháº­n dá»¯ liá»‡u.
-- =============================================================================

-- Schema hiá»‡n táº¡i Ä‘ang cháº¡y trÃªn Supabase
-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE IF NOT EXISTS public.employees (
  id text NOT NULL,
  name text,
  email text,
  phone text,
  department text,
  username text,
  password text,
  avatar text,
  address text,
  role text,
  role_group_ids text[] DEFAULT '{}'::text[],
  CONSTRAINT employees_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.customers (
  id text NOT NULL,
  name text,
  phone text,
  email text,
  address text,
  company text,
  type text,
  representative text,
  tax_or_id_number text,
  notes text,
  CONSTRAINT customers_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.projects (
  id text NOT NULL,
  code text,
  name text,
  customer_id text,
  address text,
  type text,
  contract_value numeric,
  start_date text,
  end_date text,
  pm_id text,
  status text,
  progress numeric,
  notes text,
  image text,
  documents jsonb,
  involved_employee_ids text[] DEFAULT '{}'::text[],
  kanban_column_id text,
  style_italic boolean,
  style_bold boolean,
  style_strike boolean,
  style_color text,
  card_color text,
  bao_gia_file jsonb,
  CONSTRAINT projects_pkey PRIMARY KEY (id),
  CONSTRAINT projects_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id)
);
CREATE TABLE IF NOT EXISTS public.tasks (
  id text NOT NULL,
  code text,
  project_id text,
  column_id text,
  name text,
  description text,
  assigner_id text,
  assignee_id text,
  department text,
  deadline text,
  priority text,
  status text,
  completion_rate numeric,
  notes text,
  attachment_name text,
  involved_employee_ids text[] DEFAULT '{}'::text[],
  approvals jsonb,
  work_logs jsonb,
  comments jsonb,
  time_logs jsonb,
  advance_requests jsonb,
  checklist_texts text[] DEFAULT '{}'::text[],
  completed_checklist_texts text[] DEFAULT '{}'::text[],
  style_italic boolean,
  style_bold boolean,
  style_strike boolean,
  style_color text,
  is_approval_enabled boolean,
  is_approval_required boolean,
  is_doc_generation_enabled boolean,
  is_cost_enabled boolean,
  is_material_enabled boolean,
  is_subcontractor_enabled boolean,
  subcontractor_id text,
  subcontractor_name text,
  default_approver_id text,
  cost_approver_id text,
  cost_settler_id text,
  is_material_self_coordinated boolean,
  material_coordinator_id text,
  subcontractor_approver_id text,
  subcontractor_settler_id text,
  missions jsonb,
  CONSTRAINT tasks_pkey PRIMARY KEY (id),
  CONSTRAINT tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE IF NOT EXISTS public.receipts (
  id text NOT NULL,
  code text,
  date text,
  customer_id text,
  project_id text,
  amount numeric,
  payment_method text,
  notes text,
  collector text,
  attachment_name text,
  CONSTRAINT receipts_pkey PRIMARY KEY (id),
  CONSTRAINT receipts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT receipts_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE IF NOT EXISTS public.payments (
  id text NOT NULL,
  code text,
  date text,
  recipient text,
  project_id text,
  category text,
  amount numeric,
  payment_method text,
  notes text,
  proposer text,
  approver text,
  status text,
  attachment_name text,
  approvals jsonb,
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE IF NOT EXISTS public.quotes (
  id text NOT NULL,
  code text,
  customer_id text,
  project_id text,
  project_name text,
  chieu_dai numeric,
  chieu_rong numeric,
  so_tang numeric,
  selected_house_type text,
  don_gia_khai_toan numeric,
  ngan_sach_noi_that numeric,
  features text,
  min_price numeric,
  max_price numeric,
  dien_tich_san numeric,
  tong_dien_tich_xay_dung numeric,
  date text,
  items jsonb,
  config jsonb,
  status text,
  notes text,
  payment_terms text,
  customer_name text,
  customer_phone text,
  customer_address text,
  takeoff_rows jsonb,
  company_logo_img text,
  company_logo_text text,
  company_slogan text,
  company_address_info text,
  company_contact_info text,
  contract_html text,
  acceptance_html text,
  liquidation_html text,
  final_quote_html text,
  contract_template text,
  acceptance_template text,
  liquidation_template text,
  subcontractor_id text,
  subcontractor_name text,
  task_id text,
  work_name text,
  contract_value numeric,
  created_date text,
  signed_date text,
  start_date text,
  end_date text,
  created_at text,
  ho_ten_b text,
  gioi_tinh_b text,
  ngay_sinh_b text,
  cccd_b text,
  ngay_cap_b text,
  noi_cap_b text,
  dia_chi_b text,
  sdt_b text,
  email_b text,
  mst_cn_b text,
  stk_b text,
  ngan_hang_b text,
  mo_ta_kq_ban_giao text,
  dia_diem_thuc_hien text,
  ty_le_khau_tru_tncn numeric,
  tien_tam_ung numeric,
  so_ngay_tam_ung numeric,
  so_ngay_thanh_toan numeric,
  dieu_khoan_nghiem_thu text,
  thoi_gian_bao_hanh text,
  ty_le_phat_cham numeric,
  muc_phat_toi_da numeric,
  CONSTRAINT quotes_pkey PRIMARY KEY (id),
  CONSTRAINT quotes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT quotes_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE IF NOT EXISTS public.hrm_role_groups (
  id text NOT NULL,
  name text,
  description text,
  permissions jsonb,
  member_ids text[] DEFAULT '{}'::text[],
  created_at text,
  updated_at text,
  CONSTRAINT hrm_role_groups_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.hrm_approval_config (
  id text NOT NULL,
  document_type text,
  document_type_label text,
  approver_id text,
  approver_name text,
  approver_position text,
  can_approve boolean,
  CONSTRAINT hrm_approval_config_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.hrm_default_snapshots (
  tab text NOT NULL,
  data jsonb,
  CONSTRAINT hrm_default_snapshots_pkey PRIMARY KEY (tab)
);
CREATE TABLE IF NOT EXISTS public.hrm_leaves (
  id text NOT NULL,
  emp_id text,
  emp_name text,
  type text,
  from_date text,
  to_date text,
  days_count numeric,
  reason text,
  status text,
  created_at text,
  submitted_at text,
  approver_name text,
  approver_id text,
  approver_position text,
  is_attendance_correction boolean,
  shift text,
  approvals jsonb,
  CONSTRAINT hrm_leaves_pkey PRIMARY KEY (id),
  CONSTRAINT hrm_leaves_emp_id_fkey FOREIGN KEY (emp_id) REFERENCES public.employees(id)
);
CREATE TABLE IF NOT EXISTS public.hrm_leave_coefficients (
  id text NOT NULL,
  type text,
  is_auto boolean,
  coefficient numeric,
  CONSTRAINT hrm_leave_coefficients_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.hrm_payroll_records (
  id text NOT NULL,
  blu_code text,
  emp_id text,
  emp_name text,
  month text,
  base_salary numeric,
  performance_salary numeric,
  kpi_score numeric,
  kpi_bonus numeric,
  salary_per_day numeric,
  day_salary numeric,
  worked_days numeric,
  ot_sunday numeric,
  ot_sunday_salary numeric,
  ot_holiday numeric,
  ot_holiday_salary numeric,
  ot_hours numeric,
  ot_count numeric,
  ot_hours_salary numeric,
  expenses numeric,
  bonus_holiday numeric,
  bonus_creative numeric,
  total_income numeric,
  insurance numeric,
  other_deductions numeric,
  advances numeric,
  net_salary numeric,
  status text,
  allowance numeric,
  tax numeric,
  kpi_max_allowed numeric,
  monthly_salary numeric,
  ot_weekend_salary numeric,
  ot_hourly_salary numeric,
  ot_allowance numeric,
  total_ot_hours_salary numeric,
  taxable_income numeric,
  taxable_net_income numeric,
  CONSTRAINT hrm_payroll_records_pkey PRIMARY KEY (id),
  CONSTRAINT hrm_payroll_records_emp_id_fkey FOREIGN KEY (emp_id) REFERENCES public.employees(id)
);
CREATE TABLE IF NOT EXISTS public.hrm_employee_errors (
  id text NOT NULL,
  employee_id text,
  employee_name text,
  department_code text,
  department_name text,
  criterion_id text,
  criterion_content text,
  category text,
  date text,
  notes text,
  severity text,
  images text[] DEFAULT '{}'::text[],
  CONSTRAINT hrm_employee_errors_pkey PRIMARY KEY (id),
  CONSTRAINT hrm_employee_errors_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE IF NOT EXISTS public.hrm_task_permissions (
  id text NOT NULL,
  matrix jsonb,
  CONSTRAINT hrm_task_permissions_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.hrm_holidays (
  id text NOT NULL,
  date text,
  name text,
  CONSTRAINT hrm_holidays_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.archived_quotes (
  id text NOT NULL,
  sector text,
  code text,
  customer_id text,
  project_id text,
  subcontractor_id text,
  contract_value numeric,
  status text,
  scope_work text,
  items jsonb,
  contract_html text,
  acceptance_html text,
  liquidation_html text,
  final_quote_html text,
  is_approved boolean,
  contract_approved boolean,
  acceptance_approved boolean,
  liquidation_approved boolean,
  approved_at text,
  approved_by text,
  creator_id text,
  created_at text,
  updated_at text,
  -- Construction-specific columns
  project_name text,
  customer_name text,
  customer_phone text,
  customer_address text,
  chieu_dai numeric,
  chieu_rong numeric,
  so_tang numeric,
  selected_house_type text,
  don_gia_khai_toan numeric,
  ngan_sach_noi_that numeric,
  features text,
  min_price numeric,
  max_price numeric,
  dien_tich_san numeric,
  tong_dien_tich_xay_dung numeric,
  date text,
  config jsonb,
  notes text,
  payment_terms text,
  total_amount numeric,
  creator_name text,
  company_logo_img text,
  company_logo_text text,
  company_slogan text,
  company_address_info text,
  company_contact_info text,
  contract_template text,
  acceptance_template text,
  liquidation_template text,
  takeoff_rows jsonb,
  takeoff_totals jsonb,
  final_items jsonb,
  selected_final_result text,
  pre_estimate_amount numeric,
  takeoff_cost_total numeric,
  is_final_quote boolean,
  CONSTRAINT archived_quotes_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.subcontractor_advances (
  id text NOT NULL,
  subcontractor_id text,
  subcontractor_name text,
  project_id text,
  project_name text,
  task_id text,
  task_name text,
  amount numeric,
  reason text,
  approver text,
  creator text,
  status text,
  date text,
  proposal_date text,
  type text,
  creator_name text,
  approver_name text,
  settler_id text,
  settler_name text,
  expense_items jsonb,
  approvals jsonb,
  CONSTRAINT subcontractor_advances_pkey PRIMARY KEY (id),
  CONSTRAINT subcontractor_advances_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE IF NOT EXISTS public.document_templates (
  id text NOT NULL,
  contract_template text,
  acceptance_template text,
  liquidation_template text,
  final_quote_template text,
  construction_contract_template text,
  construction_acceptance_template text,
  construction_liquidation_template text,
  mechanical_contract_template text,
  mechanical_acceptance_template text,
  mechanical_liquidation_template text,
  subcontractor_contract_template text,
  subcontractor_acceptance_template text,
  subcontractor_liquidation_template text,
  CONSTRAINT document_templates_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.project_permissions (
  id text NOT NULL,
  matrix jsonb,
  CONSTRAINT project_permissions_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.project_permission_overrides (
  id text NOT NULL,
  project_id text,
  overrides jsonb,
  CONSTRAINT project_permission_overrides_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.quotation_configs (
  sector text NOT NULL,
  config jsonb,
  CONSTRAINT quotation_configs_pkey PRIMARY KEY (sector)
);
CREATE TABLE IF NOT EXISTS public.notifications (
  id text NOT NULL,
  recipient_id text,
  recipient_name text,
  department text,
  content text,
  sub_task_code text,
  created_at text,
  read boolean,
  sender_id text,
  sender_name text,
  sender_avatar text,
  category text,
  title text,
  detailed_content text,
  attachments jsonb,
  conversation_id text,
  task_id text,
  CONSTRAINT notifications_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.suppliers (
  id text NOT NULL,
  name text,
  representative text,
  phone text,
  email text,
  address text,
  field text,
  bank_account text,
  bank_name text,
  note text,
  debt numeric,
  region text,
  bank_no text,
  gender text,
  birth_date text,
  cccd text,
  cccd_date text,
  cccd_place text,
  tax_code text,
  CONSTRAINT suppliers_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.inventory (
  id text NOT NULL,
  code text,
  name text,
  unit text,
  qty numeric,
  unit_price numeric,
  min_alert numeric,
  location text,
  CONSTRAINT inventory_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.warehouse_logs (
  id text NOT NULL,
  time text,
  type text,
  mat_name text,
  qty numeric,
  target text,
  note text,
  CONSTRAINT warehouse_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.product_prices (
  id text NOT NULL,
  product_id text,
  ten_gia text,
  don_gia numeric,
  ghi_chu text,
  CONSTRAINT product_prices_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.product_materials (
  id text NOT NULL,
  product_id text,
  ten_chat_lieu text,
  ghi_chu text,
  CONSTRAINT product_materials_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.subcontractor_catalog_items (
  id text NOT NULL,
  linh_vuc text,
  danh_muc text,
  ten_san_pham text,
  chat_lieu text,
  don_vi text,
  don_gia_thai_lan numeric,
  don_gia_an_cuong numeric,
  don_gia_plywood numeric,
  CONSTRAINT subcontractor_catalog_items_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id text NOT NULL,
  emp_id text,
  emp_name text,
  date text,
  time_in_s text,
  time_out_s text,
  time_in_c text,
  time_out_c text,
  time_in_ot text,
  time_out_ot text,
  method text,
  status text,
  ot_hours numeric,
  notes text,
  photo_in text,
  location_in text,
  coords_in text,
  photo_out text,
  location_out text,
  coords_out text,
  is_locked boolean,
  CONSTRAINT attendance_records_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.conversations (
  id text NOT NULL,
  type text,
  name text,
  avatar text,
  color text,
  participant_ids text[] DEFAULT '{}'::text[],
  created_by text,
  created_at text,
  last_message_at text,
  unread_count integer DEFAULT 0,
  task_id text,
  project_id text,
  pinned boolean DEFAULT false,
  CONSTRAINT conversations_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id text NOT NULL,
  conversation_id text,
  sender_id text,
  sender_name text,
  sender_role text,
  content text,
  created_at text,
  read boolean DEFAULT false,
  attachments jsonb,
  system boolean DEFAULT false,
  edited boolean DEFAULT false,
  edited_at text,
  deleted boolean DEFAULT false,
  deleted_at text,
  pinned boolean DEFAULT false,
  reply_to jsonb,
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT chat_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id)
);
CREATE TABLE IF NOT EXISTS public.fcm_tokens (
  user_id text NOT NULL,
  token text NOT NULL,
  platform text,
  updated_at text,
  CONSTRAINT fcm_tokens_pkey PRIMARY KEY (user_id, token)
);
CREATE TABLE IF NOT EXISTS public.business_profile (
  id text NOT NULL,
  company_name text NOT NULL,
  tax_code text,
  representative text,
  phone text,
  email text,
  address text,
  founding_year text,
  business_sector text,
  bank_info text,
  scale text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT business_profile_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.shift_config (
  id text NOT NULL,
  morning_in text DEFAULT '07:30'::text,
  morning_out text DEFAULT '11:30'::text,
  afternoon_in text DEFAULT '13:00'::text,
  afternoon_out text DEFAULT '17:00'::text,
  overtime_in text DEFAULT '17:45'::text,
  overtime_out text DEFAULT '20:45'::text,
  gps_radius_allowed integer DEFAULT 50,
  anti_fake_cam boolean DEFAULT true,
  punch_open_before_minutes integer DEFAULT 15,
  punch_close_after_minutes integer DEFAULT 15,
  punch_out_open_before_minutes integer DEFAULT 15,
  punch_out_close_after_minutes integer DEFAULT 15,
  ot_punch_open_before_minutes integer DEFAULT 15,
  ot_punch_close_after_minutes integer DEFAULT 15,
  ot_punch_out_open_before_minutes integer DEFAULT 15,
  ot_punch_out_close_after_minutes integer DEFAULT 15,
  allowed_late_minutes integer DEFAULT 15,
  weekend_days integer[] DEFAULT '{0}'::integer[],
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT shift_config_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  platform text DEFAULT 'web'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.employees(id)
);
CREATE TABLE IF NOT EXISTS public.kanban_columns (
  sector text NOT NULL,
  columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  column_width integer DEFAULT 280,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT kanban_columns_pkey PRIMARY KEY (sector)
);
CREATE TABLE IF NOT EXISTS public.hrm_trips (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hrm_trips_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.hrm_performance_criteria (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hrm_performance_criteria_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.hrm_salary_scales (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hrm_salary_scales_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.travel_norms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT travel_norms_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.accounting_sub_contracts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT accounting_sub_contracts_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.accounting_liabilities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT accounting_liabilities_pkey PRIMARY KEY (id)
);

-- =============================================================================
-- MIGRATION: Add missing columns to archived_quotes (safe to re-run)
-- =============================================================================
DO $$
BEGIN
  -- Construction-specific columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='project_name') THEN ALTER TABLE archived_quotes ADD COLUMN project_name text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='customer_name') THEN ALTER TABLE archived_quotes ADD COLUMN customer_name text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='customer_phone') THEN ALTER TABLE archived_quotes ADD COLUMN customer_phone text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='customer_address') THEN ALTER TABLE archived_quotes ADD COLUMN customer_address text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='chieu_dai') THEN ALTER TABLE archived_quotes ADD COLUMN chieu_dai numeric; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='chieu_rong') THEN ALTER TABLE archived_quotes ADD COLUMN chieu_rong numeric; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='so_tang') THEN ALTER TABLE archived_quotes ADD COLUMN so_tang numeric; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='selected_house_type') THEN ALTER TABLE archived_quotes ADD COLUMN selected_house_type text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='don_gia_khai_toan') THEN ALTER TABLE archived_quotes ADD COLUMN don_gia_khai_toan numeric; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='ngan_sach_noi_that') THEN ALTER TABLE archived_quotes ADD COLUMN ngan_sach_noi_that numeric; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='features') THEN ALTER TABLE archived_quotes ADD COLUMN features text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='min_price') THEN ALTER TABLE archived_quotes ADD COLUMN min_price numeric; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='max_price') THEN ALTER TABLE archived_quotes ADD COLUMN max_price numeric; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='dien_tich_san') THEN ALTER TABLE archived_quotes ADD COLUMN dien_tich_san numeric; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='tong_dien_tich_xay_dung') THEN ALTER TABLE archived_quotes ADD COLUMN tong_dien_tich_xay_dung numeric; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='date') THEN ALTER TABLE archived_quotes ADD COLUMN date text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='config') THEN ALTER TABLE archived_quotes ADD COLUMN config jsonb; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='notes') THEN ALTER TABLE archived_quotes ADD COLUMN notes text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='payment_terms') THEN ALTER TABLE archived_quotes ADD COLUMN payment_terms text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='total_amount') THEN ALTER TABLE archived_quotes ADD COLUMN total_amount numeric; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='creator_name') THEN ALTER TABLE archived_quotes ADD COLUMN creator_name text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='company_logo_img') THEN ALTER TABLE archived_quotes ADD COLUMN company_logo_img text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='company_logo_text') THEN ALTER TABLE archived_quotes ADD COLUMN company_logo_text text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='company_slogan') THEN ALTER TABLE archived_quotes ADD COLUMN company_slogan text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='company_address_info') THEN ALTER TABLE archived_quotes ADD COLUMN company_address_info text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='company_contact_info') THEN ALTER TABLE archived_quotes ADD COLUMN company_contact_info text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='contract_template') THEN ALTER TABLE archived_quotes ADD COLUMN contract_template text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='acceptance_template') THEN ALTER TABLE archived_quotes ADD COLUMN acceptance_template text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='liquidation_template') THEN ALTER TABLE archived_quotes ADD COLUMN liquidation_template text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='takeoff_rows') THEN ALTER TABLE archived_quotes ADD COLUMN takeoff_rows jsonb; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='takeoff_totals') THEN ALTER TABLE archived_quotes ADD COLUMN takeoff_totals jsonb; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='final_items') THEN ALTER TABLE archived_quotes ADD COLUMN final_items jsonb; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='selected_final_result') THEN ALTER TABLE archived_quotes ADD COLUMN selected_final_result text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='pre_estimate_amount') THEN ALTER TABLE archived_quotes ADD COLUMN pre_estimate_amount numeric; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='takeoff_cost_total') THEN ALTER TABLE archived_quotes ADD COLUMN takeoff_cost_total numeric; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='archived_quotes' AND column_name='is_final_quote') THEN ALTER TABLE archived_quotes ADD COLUMN is_final_quote boolean; END IF;
END
$$;
