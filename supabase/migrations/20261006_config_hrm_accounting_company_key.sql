-- ============================================================================
-- Multi-tenant — Đợt 1 rà soát khóa chính: 10 bảng còn PK đơn (id / tab) trong
-- khi giá trị khóa dễ TRÙNG giữa các công ty:
--   • khóa cố định/đoán được: hrm_role_groups ('role_admin'...), hrm_approval_config,
--     hrm_leave_coefficients, hrm_default_snapshots (khóa theo `tab`);
--   • khóa suy ra từ mã nhân viên/kỳ lương (mã NV do người dùng nhập khi import
--     Excel): hrm_payroll_records, hrm_leaves, hrm_employee_errors,
--     accounting_liabilities, accounting_receivables, subcontractor_advances.
-- Hậu quả khi trùng: công ty thứ 2 lưu bị RLS chặn / đụng dòng công ty khác
-- (cùng lỗi kanban_columns). Vá: PK ghép (company_id, <cột gốc>).
--
-- KHÔNG đụng: push_subscriptions, hrm_travel_expenses (id uuid ngẫu nhiên),
-- attendance_chat_notified (đi qua RPC claim_attendance_chat — xử lý riêng),
-- projects/tasks/conversations... (Đợt 2, dính khóa ngoại).
-- Các bảng này không có FK nào trỏ tới (đã rà soát schema + migrations).
-- CHỈ CHẠY TRÊN STAGING.
-- ============================================================================
begin;

-- Hàm tạm: bỏ PK hiện tại (bất kể tên) rồi tạo PK ghép (company_id, <cột>).
-- Dừng lại với thông báo rõ nếu company_id còn NULL (PK không cho phép NULL).
create or replace function pg_temp.rekey(tbl text, keycol text) returns void
language plpgsql as $$
declare pk text;
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name=tbl and column_name='company_id') is false then
    raise exception 'Bảng % chưa có cột company_id', tbl;
  end if;
  execute format('select count(*) from public.%I where company_id is null', tbl) into pk;
  if pk::int > 0 then
    raise exception 'Bảng % còn % dòng company_id NULL — backfill trước', tbl, pk;
  end if;
  select conname into pk from pg_constraint
   where conrelid = format('public.%I', tbl)::regclass and contype = 'p';
  if pk is not null then
    execute format('alter table public.%I drop constraint %I', tbl, pk);
  end if;
  execute format('alter table public.%I add primary key (company_id, %I)', tbl, keycol);
end $$;

select pg_temp.rekey('hrm_role_groups',         'id');
select pg_temp.rekey('hrm_approval_config',     'id');
select pg_temp.rekey('hrm_leave_coefficients',  'id');
select pg_temp.rekey('hrm_default_snapshots',   'tab');
select pg_temp.rekey('hrm_payroll_records',     'id');
select pg_temp.rekey('hrm_leaves',              'id');
select pg_temp.rekey('hrm_employee_errors',     'id');
select pg_temp.rekey('accounting_liabilities',  'id');
select pg_temp.rekey('accounting_receivables',  'id');
select pg_temp.rekey('subcontractor_advances',  'id');

commit;
