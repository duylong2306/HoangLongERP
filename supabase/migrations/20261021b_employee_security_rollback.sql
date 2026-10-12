-- ĐƯỜNG LUI cho 20261021a: gỡ chính sách employee_live, trả load_all_core_data()/list_employees_safe() về bản không kiểm tra phiên nhân viên.
-- (Giữ bảng employee_security để không mất số liệu; muốn xóa hẳn thì bỏ comment dòng cuối.)
do $$
declare r record;
begin
  for r in select schemaname, tablename from pg_policies where policyname = 'employee_live' loop
    execute format('drop policy if exists employee_live on %I.%I', r.schemaname, r.tablename);
  end loop;
end $$;

create or replace function public.load_all_core_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_company uuid; v_data jsonb;
begin
  begin v_company := (auth.jwt() ->> 'company_id')::uuid; exception when others then v_company := null; end;
  if v_company is not null and not public.company_is_live(v_company) then
    perform set_config('request.jwt.claims', '{}', true);
    perform set_config('request.jwt.claim.company_id', '', true);
  end if;
  v_data := public._load_all_core_data_impl();
  return jsonb_set(v_data, '{employees}',
    coalesce((select jsonb_agg(e - 'password') from jsonb_array_elements(coalesce(v_data -> 'employees', '[]'::jsonb)) e), '[]'::jsonb));
end $$;
grant execute on function public.load_all_core_data() to anon, authenticated;

create or replace function public.list_employees_safe()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_company uuid;
begin
  begin v_company := (auth.jwt() ->> 'company_id')::uuid; exception when others then v_company := null; end;
  if v_company is null or not public.company_is_live(v_company) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(to_jsonb(e) - 'password') from public.employees e where e.company_id = v_company), '[]'::jsonb);
end $$;
revoke all on function public.list_employees_safe() from public;
grant execute on function public.list_employees_safe() to authenticated;

drop function if exists public.employee_session_is_live(uuid, text, integer);
-- drop table if exists public.employee_security;
