-- ============================================================================
-- Migration 020: Tạo Storage bucket "mission-report-images"
-- Dùng cho tính năng "Hình ảnh báo cáo" trong cửa sổ CHI TIẾT NHIỆM VỤ THI CÔNG.
-- Ảnh được upload thẳng lên Supabase Storage từ anon key của app.
-- ============================================================================

-- 1) Tạo bucket (public = true để lấy public URL trực tiếp).
--    Idempotent: nếu đã tồn tại thì cập nhật cấu hình.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mission-report-images',
  'mission-report-images',
  true,
  10485760, -- 10 MB / ảnh
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[];

-- 2) Policies cho phép anon / authenticated đọc, upload, sửa, xóa ảnh
--    trong bucket này. Viết qua DO block để tránh lỗi khi chạy lại migration.
do $$
declare
  b text := 'mission-report-images';
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'mission_report_images_select'
  ) then
    execute format(
      'create policy mission_report_images_select on storage.objects for select using (bucket_id = %L);',
      b
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'mission_report_images_insert'
  ) then
    execute format(
      'create policy mission_report_images_insert on storage.objects for insert to anon, authenticated with check (bucket_id = %L);',
      b
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'mission_report_images_update'
  ) then
    execute format(
      'create policy mission_report_images_update on storage.objects for update to anon, authenticated using (bucket_id = %L) with check (bucket_id = %L);',
      b, b
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'mission_report_images_delete'
  ) then
    execute format(
      'create policy mission_report_images_delete on storage.objects for delete to anon, authenticated using (bucket_id = %L);',
      b
    );
  end if;
end $$;
