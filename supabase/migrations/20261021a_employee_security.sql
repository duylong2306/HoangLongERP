-- ============================================================================
-- GIAI ĐOẠN A (bảo mật tài khoản): bảng employee_security + thu hồi phiên THEO TỪNG NHÂN VIÊN ở tầng cơ sở dữ liệu.
-- ============================================================================
-- Mục đích:
--  (2) Thu hồi phiên từng người: token của nhân viên bị thu hồi / nghỉ việc / bị xóa / đã đổi mật khẩu (token_version tăng)
--      bị CHẶN NGAY ở RLS — không phải chờ tới khi token hết hạn (tối đa 7 ngày) như trước.
--  (4) Khóa đăng nhập tạm khi nhập sai nhiều lần (failed_attempts, locked_until) + cờ bắt đổi mật khẩu (must_change_password).
-- Bảng này CHỈ máy chủ (service_role, api/login.ts & api/change-password.ts) đọc/ghi được; trình duyệt không có quyền gì.
-- Idempotent: chạy lại nhiều lần an toàn. Đường lui: 20261021b_employee_security_rollback.sql.
-- Thứ tự khuyến nghị: chạy 20261020b (nếu chưa) → deploy bản ứng dụng mới → chạy file này (ngoài giờ làm việc).
-- Token cũ (không có claim `tv`) vẫn hợp lệ: coi như token_version = 0.
-- ============================================================================

-- 1) Bảng bảo mật theo nhân viên (tách khỏi employees để trình duyệt không bao giờ thấy).
create table if not exists public.employee_security (
  company_id           uuid        not null,
  employee_id          text        not null,
  failed_attempts      integer     not null default 0,
  locked_until         timestamptz,
  must_change_password boolean     not null default false,
  last_login_at        timestamptz,
  token_version        integer     not null default 0,
  updated_at           timestamptz not null default now(),
  primary key (company_id, employee_id)
);
alter table public.employee_security enable row level security;
-- Không tạo policy nào + thu hết quyền → chỉ service_role (bỏ qua RLS) truy cập được.
revoke all on table public.employee_security from anon, authenticated;

-- 2) Phiên (token) của nhân viên này còn hiệu lực không?
--    Hết hiệu lực khi: nhân viên không còn trong công ty / tài khoản bị thu hồi / nghỉ việc / token_version đã tăng.
--    SECURITY DEFINER để đọc được employees + employee_security bất kể quyền người gọi; STABLE; search_path cố định.
create or replace function public.employee_session_is_live(p_company uuid, p_emp text, p_tv integer)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.employees e
     where e.company_id = p_company
       and e.id = p_emp
       and e.has_system_account is not false
       and e.status is distinct from 'retired'
       and coalesce((select s.token_version from public.employee_security s
                      where s.company_id = p_company and s.employee_id = p_emp), 0) = coalesce(p_tv, 0)
  );
$$;
revoke all on function public.employee_session_is_live(uuid, text, integer) from public;
grant execute on function public.employee_session_is_live(uuid, text, integer) to authenticated;

-- 3) Chính sách RESTRICTIVE "employee_live" trên mọi bảng có company_id (cùng kiểu company_live), AND với các chính sách sẵn có.
--    Token không có claim sub/company_id (VD token khóa của công ty hết hạn) đã bị company_live chặn nên không ảnh hưởng thêm.
--    Bỏ qua bảng employee_security (không ai ngoài service_role truy cập).
do $$
declare r record;
begin
  for r in
    select c.table_name
      from information_schema.columns c
      join pg_class k on k.relname = c.table_name and k.relnamespace = 'public'::regnamespace
     where c.table_schema = 'public' and c.column_name = 'company_id'
       and k.relkind = 'r' and k.relrowsecurity
       and c.table_name <> 'employee_security'
  loop
    execute format('drop policy if exists employee_live on public.%I', r.table_name);
    execute format(
      'create policy employee_live on public.%I as restrictive for all to authenticated
         using ((select public.employee_session_is_live((auth.jwt() ->> ''company_id'')::uuid, auth.jwt() ->> ''sub'', coalesce((auth.jwt() ->> ''tv'')::integer, 0))))
         with check ((select public.employee_session_is_live((auth.jwt() ->> ''company_id'')::uuid, auth.jwt() ->> ''sub'', coalesce((auth.jwt() ->> ''tv'')::integer, 0))))',
      r.table_name);
  end loop;
end $$;

drop policy if exists employee_live on storage.objects;
create policy employee_live on storage.objects as restrictive for all to authenticated
  using ((select public.employee_session_is_live((auth.jwt() ->> 'company_id')::uuid, auth.jwt() ->> 'sub', coalesce((auth.jwt() ->> 'tv')::integer, 0))))
  with check ((select public.employee_session_is_live((auth.jwt() ->> 'company_id')::uuid, auth.jwt() ->> 'sub', coalesce((auth.jwt() ->> 'tv')::integer, 0))));

-- 4) load_all_core_data() là SECURITY DEFINER (bỏ qua RLS) nên tự kiểm tra: phiên không còn hiệu lực → xóa claim (chỉ trong giao dịch này)
--    để hàm gốc thấy company_id = NULL và trả mảng rỗng. Giữ nguyên các bước đã có (công ty còn hạn; bỏ cột password khỏi employees).
create or replace function public.load_all_core_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_sub text;
  v_tv integer;
  v_data jsonb;
begin
  begin
    v_company := (auth.jwt() ->> 'company_id')::uuid;
  exception when others then
    v_company := null;
  end;
  v_sub := auth.jwt() ->> 'sub';
  begin
    v_tv := coalesce((auth.jwt() ->> 'tv')::integer, 0);
  exception when others then
    v_tv := 0;
  end;
  if v_company is not null and (
       not public.company_is_live(v_company)
       or not public.employee_session_is_live(v_company, v_sub, v_tv)
     ) then
    perform set_config('request.jwt.claims', '{}', true);
    perform set_config('request.jwt.claim.company_id', '', true);
  end if;
  v_data := public._load_all_core_data_impl();
  return jsonb_set(
    v_data,
    '{employees}',
    coalesce((select jsonb_agg(e - 'password') from jsonb_array_elements(coalesce(v_data -> 'employees', '[]'::jsonb)) e), '[]'::jsonb)
  );
end $$;
grant execute on function public.load_all_core_data() to anon, authenticated;

-- 5) list_employees_safe(): cũng trả rỗng khi phiên không còn hiệu lực.
create or replace function public.list_employees_safe()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_company uuid; v_tv integer;
begin
  begin
    v_company := (auth.jwt() ->> 'company_id')::uuid;
  exception when others then
    v_company := null;
  end;
  begin
    v_tv := coalesce((auth.jwt() ->> 'tv')::integer, 0);
  exception when others then
    v_tv := 0;
  end;
  if v_company is null or not public.company_is_live(v_company)
     or not public.employee_session_is_live(v_company, auth.jwt() ->> 'sub', v_tv) then
    return '[]'::jsonb;
  end if;
  return coalesce((select jsonb_agg(to_jsonb(e) - 'password') from public.employees e where e.company_id = v_company), '[]'::jsonb);
end $$;
revoke all on function public.list_employees_safe() from public;
grant execute on function public.list_employees_safe() to authenticated;

-- 6) (Tùy chọn, CHƯA chạy tự động) Bắt TẤT CẢ tài khoản còn mật khẩu mặc định '123' phải đổi ở lần đăng nhập kế tiếp.
--    Khi nào sẵn sàng thì chạy riêng câu này (sau khi báo nhân viên):
--    insert into public.employee_security (company_id, employee_id, must_change_password)
--    select company_id, id, true from public.employees where has_system_account is not false
--    on conflict (company_id, employee_id) do update set must_change_password = true, updated_at = now();
