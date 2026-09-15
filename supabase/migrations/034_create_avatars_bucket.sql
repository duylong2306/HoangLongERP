-- ============================================================================
-- Migration 034: Tạo Storage bucket "avatars"
--
-- MỤC ĐÍCH: Lưu avatar người dùng do user tự upload từ cửa sổ
-- "Cập nhật hồ sơ cá nhân" (UserProfileModal). dbService.uploadAvatar()
-- upload lên bucket này và lưu public URL vào cột avatar của employees.
--
-- App chạy với anon key nên KHÔNG có quyền createBucket() (chỉ service_role) —
-- giống bucket attendance-photos / quote-images, việc tạo bucket là trách nhiệm
-- của migration này (chạy trên Supabase SQL editor / supabase db push), không
-- phải runtime. Upload ảnh vẫn hoạt động bình thường một khi bucket tồn tại.
--
-- Chạy 1 lần trong Supabase Dashboard > SQL Editor. Idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Tạo bucket "avatars" (public = true để lấy public URL trực tiếp)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880, -- 5 MB / ảnh
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[];

-- ----------------------------------------------------------------------------
-- 2) Policies cho phép anon / authenticated đọc, upload, sửa, xóa ảnh
--    trong bucket này. Viết qua DO block để chạy lại không lỗi.
-- ----------------------------------------------------------------------------
do $$
declare
  b text := 'avatars';
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'avatars_select'
  ) then
    execute format(
      'create policy avatars_select on storage.objects for select using (bucket_id = %L);',
      b
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'avatars_insert'
  ) then
    execute format(
      'create policy avatars_insert on storage.objects for insert to anon, authenticated with check (bucket_id = %L);',
      b
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'avatars_update'
  ) then
    execute format(
      'create policy avatars_update on storage.objects for update to anon, authenticated using (bucket_id = %L) with check (bucket_id = %L);',
      b, b
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'avatars_delete'
  ) then
    execute format(
      'create policy avatars_delete on storage.objects for delete to anon, authenticated using (bucket_id = %L);',
      b
    );
  end if;
end $$;
