-- ============================================================================
-- Migration 029: Tạo Storage bucket "attendance-photos"
--
-- MỤC ĐÍCH: Giảm tải nặng cho bảng attendance_records. Trước đây ảnh selfie
-- lúc điểm danh được lưu base64 data URL TRỰC TIẾP trong cột photo_in / photo_out
-- và punch_meta.photo (jsonb). Mỗi dòng có thể nặng 40–150 KB → 1 tháng chấm công
-- ~100 dòng = 5–15 MB payload, khiến tab Chấm công / Dashboard tải chậm vì mọi
-- user đều tải nguyên khối ảnh đó qua PostgREST.
--
-- SỬA: Upload ảnh lên Supabase Storage (bucket public) và lưu public URL vào DB
-- thay vì base64. Dòng chỉ còn vài trăm bytes.
--
-- Bucket này chủ yếu phục vụ script di dời ảnh CŨ (scripts/_migrate_attendance_photos.mjs)
-- và luồng chấm công MỚI (DashboardOverview handleConfirmPunch). App chạy với anon key
-- nên policies phải cho phép anon upload (giống bucket quote-images / product-catalog-images).
--
-- Chạy 1 lần trong Supabase Dashboard > SQL Editor. Idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Tạo bucket "attendance-photos" (public = true để lấy public URL trực tiếp)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attendance-photos',
  'attendance-photos',
  true,
  10485760, -- 10 MB / ảnh
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[];

-- ----------------------------------------------------------------------------
-- 2) Policies cho phép anon / authenticated đọc, upload, sửa, xóa ảnh
--    trong bucket này. Viết qua DO block để chạy lại không lỗi.
-- ----------------------------------------------------------------------------
do $$
declare
  b text := 'attendance-photos';
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'attendance_photos_select'
  ) then
    execute format(
      'create policy attendance_photos_select on storage.objects for select using (bucket_id = %L);',
      b
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'attendance_photos_insert'
  ) then
    execute format(
      'create policy attendance_photos_insert on storage.objects for insert to anon, authenticated with check (bucket_id = %L);',
      b
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'attendance_photos_update'
  ) then
    execute format(
      'create policy attendance_photos_update on storage.objects for update to anon, authenticated using (bucket_id = %L) with check (bucket_id = %L);',
      b, b
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'attendance_photos_delete'
  ) then
    execute format(
      'create policy attendance_photos_delete on storage.objects for delete to anon, authenticated using (bucket_id = %L);',
      b
    );
  end if;
end $$;
