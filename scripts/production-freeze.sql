-- ============================================================================
-- ĐÓNG BĂNG GHI trên PRODUCTION Hoàng Long CŨ (project cyuunmrdrymhzxfcruoe) — dùng vào NGÀY CHUYỂN sang nền tảng mới
-- ============================================================================
-- Mục đích: sau khi chuyển hướng người dùng sang hoanglong.lolo.io.vn, vẫn có thể còn TAB CŨ đang mở (hoặc ai đó dùng địa chỉ cũ qua bộ nhớ
-- đệm) cố ghi dữ liệu vào hệ thống cũ → dữ liệu bị tách làm hai nơi. Script này chặn mọi lệnh GHI (thêm/sửa/xóa) vào bảng dữ liệu và Storage
-- của production; ĐỌC vẫn bình thường (xem lại dữ liệu cũ được). Cũng tắt 2 lịch nhắc điểm danh tự động của hệ thống cũ (nhắc trùng với hệ thống mới).
--
-- Cách làm: thêm chính sách RLS dạng RESTRICTIVE tên freeze_ins / freeze_upd / freeze_del cho các vai trò anon + authenticated (ứng dụng cũ dùng
-- khóa anon). Quyền service_role (script di chuyển, cron nội bộ) KHÔNG bị ảnh hưởng. HOÀN TÁC NGAY bằng scripts/production-unfreeze.sql.
--
-- ⛔ CHỈ chạy ở project PRODUCTION cũ. Chốt chặn: dừng nếu thấy bảng `companies` (dấu hiệu của LoLo).
-- Chạy trong SQL Editor của production. Chạy lại nhiều lần an toàn (idempotent).
-- ============================================================================

do $$
declare
  t record; n int := 0; sin_rls text[] := '{}';
begin
  if to_regclass('public.companies') is not null then
    raise exception 'DỪNG: có bảng public.companies — đây là LoLo (nền tảng mới), KHÔNG phải production cũ. Không đóng băng.';
  end if;

  for t in select c.relname, c.relrowsecurity from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' order by 1 loop
    if not t.relrowsecurity then sin_rls := sin_rls || t.relname; continue; end if;   -- bảng chưa bật RLS: không chặn được bằng chính sách (báo ở cuối)
    execute format('drop policy if exists freeze_ins on public.%I', t.relname);
    execute format('drop policy if exists freeze_upd on public.%I', t.relname);
    execute format('drop policy if exists freeze_del on public.%I', t.relname);
    execute format('create policy freeze_ins on public.%I as restrictive for insert to anon, authenticated with check (false)', t.relname);
    execute format('create policy freeze_upd on public.%I as restrictive for update to anon, authenticated using (false) with check (false)', t.relname);
    execute format('create policy freeze_del on public.%I as restrictive for delete to anon, authenticated using (false)', t.relname);
    n := n + 1;
  end loop;

  -- Storage (ảnh/tệp tải lên): chặn thêm/sửa/xóa tệp
  execute 'drop policy if exists freeze_ins on storage.objects';  execute 'drop policy if exists freeze_upd on storage.objects';  execute 'drop policy if exists freeze_del on storage.objects';
  execute 'create policy freeze_ins on storage.objects as restrictive for insert to anon, authenticated with check (false)';
  execute 'create policy freeze_upd on storage.objects as restrictive for update to anon, authenticated using (false) with check (false)';
  execute 'create policy freeze_del on storage.objects as restrictive for delete to anon, authenticated using (false)';

  -- Tắt lịch nhắc điểm danh của hệ thống cũ (hệ thống mới đã có lịch riêng)
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule(jobname) from cron.job where jobname in ('attendance-morning-reminder', 'attendance-afternoon-reminder');
  end if;

  raise notice 'ĐÃ ĐÓNG BĂNG GHI: % bảng dữ liệu + Storage. Bảng chưa bật RLS (không chặn được): %', n, coalesce(nullif(array_to_string(sin_rls, ', '), ''), 'không có');
end $$;

-- KIỂM TRA: số bảng đã đóng băng (mỗi bảng 3 chính sách) — và danh sách bảng CHƯA được chặn nếu có
select count(distinct tablename) filter (where schemaname = 'public') as so_bang_da_dong_bang,
       count(distinct tablename) filter (where schemaname = 'storage') as storage_da_dong_bang
  from pg_policies where policyname in ('freeze_ins', 'freeze_upd', 'freeze_del');
select c.relname as bang_chua_chan_duoc_ghi from pg_class c
 where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and not c.relrowsecurity order by 1;
