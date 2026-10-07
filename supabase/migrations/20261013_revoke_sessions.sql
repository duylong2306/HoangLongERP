-- ============================================================================
-- Đợt 2 bảo mật: THU HỒI PHIÊN
-- ============================================================================
-- (A) Trang quản trị: platform_admins.token_version — đăng xuất / đổi mật khẩu tăng số này, token cũ bị từ chối ngay.
-- (B) ERP của doanh nghiệp: trước đây khóa doanh nghiệp / rút ngắn hạn chỉ chặn ĐĂNG NHẬP MỚI, người đang đăng nhập vẫn dùng
--     được dữ liệu tới 7 ngày (hết hạn token). Nay thêm chính sách RESTRICTIVE "company_live" lên mọi bảng có cột
--     company_id (+ Storage) và kiểm tra trong load_all_core_data(): công ty bị khóa (active = false) hoặc đã hết hạn
--     (expires_at <= now()) → mọi đọc/ghi dữ liệu bằng token cũ đều bị chặn NGAY.
--
-- Chỉ chạy trên project Supabase "LoLo" (không phải production Hoàng Long cũ). Chạy lại nhiều lần an toàn (idempotent).
-- Công ty có expires_at = null (không giới hạn, VD Hoàng Long) và active = true luôn "còn sống".
-- ============================================================================

-- (A) -----------------------------------------------------------------------------------------------
alter table public.platform_admins add column if not exists token_version integer not null default 0;

-- (B) -----------------------------------------------------------------------------------------------
-- Công ty còn được dùng dữ liệu không? SECURITY DEFINER để đọc được bảng companies bất kể RLS của người gọi;
-- STABLE + search_path cố định. Công ty không tồn tại / id null → false.
create or replace function public.company_is_live(p_company uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select c.active and (c.expires_at is null or c.expires_at > now())
       from public.companies c where c.id = p_company),
    false);
$$;
revoke all on function public.company_is_live(uuid) from public;
grant execute on function public.company_is_live(uuid) to authenticated;

-- Chính sách RESTRICTIVE: được AND với các chính sách tenant_isolation_* sẵn có (không thay thế chúng).
-- (select ...) bọc ngoài để Postgres tính 1 lần cho cả câu lệnh thay vì mỗi dòng.
do $$
declare r record;
begin
  for r in
    select c.table_name
      from information_schema.columns c
      join pg_class k on k.relname = c.table_name and k.relnamespace = 'public'::regnamespace
     where c.table_schema = 'public' and c.column_name = 'company_id'
       and k.relkind = 'r' and k.relrowsecurity
  loop
    execute format('drop policy if exists company_live on public.%I', r.table_name);
    execute format(
      'create policy company_live on public.%I as restrictive for all to authenticated
         using ((select public.company_is_live((auth.jwt() ->> ''company_id'')::uuid)))
         with check ((select public.company_is_live((auth.jwt() ->> ''company_id'')::uuid)))',
      r.table_name);
  end loop;
end $$;

-- Storage (ảnh/tệp của doanh nghiệp)
drop policy if exists company_live on storage.objects;
create policy company_live on storage.objects as restrictive for all to authenticated
  using ((select public.company_is_live((auth.jwt() ->> 'company_id')::uuid)))
  with check ((select public.company_is_live((auth.jwt() ->> 'company_id')::uuid)));

-- load_all_core_data() là SECURITY DEFINER (bỏ qua RLS) nên phải tự kiểm tra: đổi tên hàm cũ thành _impl rồi bọc lại.
-- Công ty hết hạn/bị khóa → xóa claim JWT (chỉ trong giao dịch này) rồi gọi hàm cũ: nó thấy company_id = NULL và trả
-- về các mảng rỗng đúng như với token khóa. Chỉ đổi tên nếu _impl chưa tồn tại để chạy lại không đè lên bản bọc.
do $$
begin
  if to_regprocedure('public._load_all_core_data_impl()') is null then
    alter function public.load_all_core_data() rename to _load_all_core_data_impl;
  end if;
end $$;
revoke all on function public._load_all_core_data_impl() from public, anon, authenticated;

create or replace function public.load_all_core_data()
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
  if v_company is not null and not public.company_is_live(v_company) then
    perform set_config('request.jwt.claims', '{}', true);
    perform set_config('request.jwt.claim.company_id', '', true);
  end if;
  return public._load_all_core_data_impl();
end $$;
grant execute on function public.load_all_core_data() to anon, authenticated;
