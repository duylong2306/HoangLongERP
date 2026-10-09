-- BƯỚC 1A — ngừng gửi hash mật khẩu của nhân viên về trình duyệt (CHẠY TRƯỚC, an toàn, không đổi quyền truy cập bảng).
-- Vấn đề: danh sách nhân viên đọc bằng select('*') và RPC load_all_core_data() nên MỌI người đăng nhập đều nhận được cột `password` (hash) của tất cả đồng nghiệp.
-- Đăng nhập kiểm tra ở máy chủ (api/login.ts, quyền service_role) nên trình duyệt không cần cột này.
-- File này CHỈ thêm/đổi hàm đọc để KHÔNG trả `password`; việc thu quyền đọc cột ở bước 1B (20261020b) chạy SAU khi bản ứng dụng mới đã lên.
-- Idempotent: chạy lại nhiều lần được.

-- 1) load_all_core_data(): giữ nguyên toàn bộ logic cũ (kiểm tra công ty còn hạn, lọc company_id), chỉ bỏ `password` khỏi mảng employees.
create or replace function public.load_all_core_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_data jsonb;
begin
  begin
    v_company := (auth.jwt() ->> 'company_id')::uuid;
  exception when others then
    v_company := null;
  end;
  if v_company is not null and not public.company_is_live(v_company) then
    perform set_config('request.jwt.claims', '{}', true);
    perform set_config('request.jwt.claim.company_id', '', true);
  end if;
  v_data := public._load_all_core_data_impl();
  -- Bỏ cột password khỏi từng nhân viên (jsonb `-` xóa khóa)
  return jsonb_set(
    v_data,
    '{employees}',
    coalesce((select jsonb_agg(e - 'password') from jsonb_array_elements(coalesce(v_data -> 'employees', '[]'::jsonb)) e), '[]'::jsonb)
  );
end $$;
grant execute on function public.load_all_core_data() to anon, authenticated;

-- 2) list_employees_safe(): danh sách nhân viên CỦA CÔNG TY trong JWT, không có `password`. Công ty hết hạn/bị khóa → mảng rỗng.
create or replace function public.list_employees_safe()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_company uuid;
begin
  begin
    v_company := (auth.jwt() ->> 'company_id')::uuid;
  exception when others then
    v_company := null;
  end;
  if v_company is null or not public.company_is_live(v_company) then
    return '[]'::jsonb;
  end if;
  return coalesce((select jsonb_agg(to_jsonb(e) - 'password') from public.employees e where e.company_id = v_company), '[]'::jsonb);
end $$;
revoke all on function public.list_employees_safe() from public;
grant execute on function public.list_employees_safe() to authenticated;

-- 3) Realtime: bản tin thay đổi của bảng employees không được mang cột password. Dùng danh sách cột của publication (PostgreSQL 15+).
--    Bọc trong khối lỗi để máy không hỗ trợ vẫn chạy được phần 1-2; khi đó dựa vào bước 1B (thu quyền đọc cột) để chặn.
do $$
declare cols text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'employees') then
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
      from information_schema.columns where table_schema = 'public' and table_name = 'employees' and column_name <> 'password';
    execute 'alter publication supabase_realtime drop table public.employees';
    execute format('alter publication supabase_realtime add table public.employees (%s)', cols);
  end if;
exception when others then
  raise notice 'Bỏ qua cấu hình cột realtime cho employees: %', sqlerrm;
end $$;

notify pgrst, 'reload schema';
