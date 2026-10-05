-- ============================================================================
-- Multi-tenant — Đợt 2 rà soát khóa chính: nhóm bảng nghiệp vụ lõi còn PK đơn
-- (id), dính khóa ngoại dây chuyền (projects ← tasks ← conversations ← ...).
-- Id nhiều bảng có thể trùng giữa các công ty (vd conversation cố định
-- 'conv_attendance', mã đơn <tiền tố>-<số> tăng dần, mã dự án/phiếu nhập tay...).
--
-- Vá: PK ghép (company_id, id) cho 21 bảng, và đổi 16 khóa ngoại đơn
-- (project_id / task_id / conversation_id) thành khóa ngoại GHÉP
-- (company_id, <cột>) → bảng con CHỈ trỏ được tới bản ghi cha CÙNG công ty.
-- Giữ nguyên ON DELETE CASCADE như cũ. Cột FK nullable: khi NULL, FK ghép
-- (MATCH SIMPLE mặc định) không kiểm tra → hành vi "không gắn dự án/nhiệm vụ" giữ nguyên.
--
-- KHÔNG đụng: business_profile, shift_config, document_templates,
-- hrm_task_permissions, project_permissions (id = company_id theo 20260930);
-- push_subscriptions, hrm_travel_expenses (id uuid ngẫu nhiên); fcm_tokens (đã bỏ Firebase).
-- Toàn bộ trong 1 transaction: lỗi (vd dữ liệu con lệch công ty so với cha) thì rollback hết.
-- CHỈ CHẠY TRÊN STAGING.
-- ============================================================================
begin;

-- ── BƯỚC 1: gỡ 16 khóa ngoại đơn (phải gỡ trước khi đổi PK của bảng cha) ───
alter table public.accounting_receivables      drop constraint accounting_receivables_project_id_fkey;
alter table public.archived_quotes             drop constraint archived_quotes_project_id_fkey;
alter table public.chat_messages               drop constraint chat_messages_conversation_id_fkey;
alter table public.conversations               drop constraint conversations_project_id_fkey;
alter table public.conversations               drop constraint conversations_task_id_fkey;
alter table public.hrm_employee_errors         drop constraint hrm_employee_errors_task_id_fkey;
alter table public.notifications               drop constraint notifications_task_id_fkey;
alter table public.payments                    drop constraint payments_project_id_fkey;
alter table public.project_permission_overrides drop constraint project_permission_overrides_project_id_fkey;
alter table public.quotes                      drop constraint quotes_project_id_fkey;
alter table public.quotes                      drop constraint quotes_task_id_fkey;
alter table public.receipts                    drop constraint receipts_project_id_fkey;
alter table public.subcontractor_advances      drop constraint subcontractor_advances_project_id_fkey;
alter table public.subcontractor_advances      drop constraint subcontractor_advances_task_id_fkey;
alter table public.task_missions               drop constraint task_missions_task_id_fkey;
alter table public.tasks                       drop constraint tasks_project_id_fkey;

-- ── BƯỚC 2: đổi PK sang (company_id, id) ────────────────────────────────────
-- Hàm tạm: bỏ PK hiện tại (bất kể tên) rồi tạo PK ghép. Dừng kèm thông báo rõ
-- nếu còn dòng company_id NULL.
create or replace function pg_temp.rekey(tbl text, keycol text) returns void
language plpgsql as $$
declare pk text; n bigint;
begin
  execute format('select count(*) from public.%I where company_id is null', tbl) into n;
  if n > 0 then
    raise exception 'Bảng % còn % dòng company_id NULL — backfill trước', tbl, n;
  end if;
  select conname into pk from pg_constraint
   where conrelid = format('public.%I', tbl)::regclass and contype = 'p';
  if pk is not null then
    execute format('alter table public.%I drop constraint %I', tbl, pk);
  end if;
  execute format('alter table public.%I add primary key (company_id, %I)', tbl, keycol);
end $$;

select pg_temp.rekey(t, 'id') from unnest(array[
  'projects','tasks','task_missions','conversations','chat_messages','notifications',
  'payments','quotes','receipts','archived_quotes','project_permission_overrides',
  'purchase_orders','sales_orders','supplier_returns','warehouse_logs',
  'product_materials','product_prices','accounting_sub_contracts',
  'material_proposals','cash_fund_config','hrm_trips'
]) as t;

-- ── BƯỚC 3: tạo lại 16 khóa ngoại dạng GHÉP, giữ ON DELETE CASCADE ──────────
alter table public.tasks add constraint tasks_project_id_fkey
  foreign key (company_id, project_id) references public.projects (company_id, id) on delete cascade;

alter table public.accounting_receivables add constraint accounting_receivables_project_id_fkey
  foreign key (company_id, project_id) references public.projects (company_id, id) on delete cascade;
alter table public.archived_quotes add constraint archived_quotes_project_id_fkey
  foreign key (company_id, project_id) references public.projects (company_id, id) on delete cascade;
alter table public.conversations add constraint conversations_project_id_fkey
  foreign key (company_id, project_id) references public.projects (company_id, id) on delete cascade;
alter table public.payments add constraint payments_project_id_fkey
  foreign key (company_id, project_id) references public.projects (company_id, id) on delete cascade;
alter table public.project_permission_overrides add constraint project_permission_overrides_project_id_fkey
  foreign key (company_id, project_id) references public.projects (company_id, id) on delete cascade;
alter table public.quotes add constraint quotes_project_id_fkey
  foreign key (company_id, project_id) references public.projects (company_id, id) on delete cascade;
alter table public.receipts add constraint receipts_project_id_fkey
  foreign key (company_id, project_id) references public.projects (company_id, id) on delete cascade;
alter table public.subcontractor_advances add constraint subcontractor_advances_project_id_fkey
  foreign key (company_id, project_id) references public.projects (company_id, id) on delete cascade;

alter table public.conversations add constraint conversations_task_id_fkey
  foreign key (company_id, task_id) references public.tasks (company_id, id) on delete cascade;
alter table public.hrm_employee_errors add constraint hrm_employee_errors_task_id_fkey
  foreign key (company_id, task_id) references public.tasks (company_id, id) on delete cascade;
alter table public.notifications add constraint notifications_task_id_fkey
  foreign key (company_id, task_id) references public.tasks (company_id, id) on delete cascade;
alter table public.quotes add constraint quotes_task_id_fkey
  foreign key (company_id, task_id) references public.tasks (company_id, id) on delete cascade;
alter table public.subcontractor_advances add constraint subcontractor_advances_task_id_fkey
  foreign key (company_id, task_id) references public.tasks (company_id, id) on delete cascade;
alter table public.task_missions add constraint task_missions_task_id_fkey
  foreign key (company_id, task_id) references public.tasks (company_id, id) on delete cascade;

alter table public.chat_messages add constraint chat_messages_conversation_id_fkey
  foreign key (company_id, conversation_id) references public.conversations (company_id, id) on delete cascade;

commit;
