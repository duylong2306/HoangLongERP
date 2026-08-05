-- ============================================================================
-- Migration 025: Tạo Storage buckets "quote-images" & "product-catalog-images"
--
-- Mục đích: Khắc phục lỗi khi upload ảnh trong Lập Báo Giá Nội Thất & Cơ Khí
-- bị fallback lưu cục bộ (base64) vì bucket chưa tồn tại.
--
-- NGUYÊN NHÂN: Ứng dụng chạy với anon key nên KHÔNG có quyền tạo bucket qua
-- createBucket() (quyền này chỉ dành cho service_role). Vì vậy việc tạo bucket
-- PHẢI thực hiện qua SQL editor này (chạy với quyền postgres/service_role).
--
-- Ảnh được upload thẳng lên Supabase Storage từ anon key của app.
-- ============================================================================

-- ============================================================
-- 1) Tạo bucket "quote-images" (Hình ảnh báo giá Cơ Khí & Nội Thất)
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'quote-images',
  'quote-images',
  true,
  10485760, -- 10 MB / ảnh
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[];

-- ============================================================
-- 2) Tạo bucket "product-catalog-images" (Hình ảnh danh mục sản phẩm)
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-catalog-images',
  'product-catalog-images',
  true,
  10485760, -- 10 MB / ảnh
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[];

-- ============================================================
-- 3) Policies cho phép anon / authenticated đọc, upload, sửa, xóa ảnh
--    trong cả 2 bucket. Viết qua DO block để chạy lại không lỗi.
-- ============================================================
do $$
declare
  b text;
begin
  foreach b in array array['quote-images', 'product-catalog-images'] loop

    if not exists (
      select 1 from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname = format('%s_select', replace(b, '-', '_'))
    ) then
      execute format(
        'create policy %I on storage.objects for select using (bucket_id = %L);',
        format('%s_select', replace(b, '-', '_')), b
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname = format('%s_insert', replace(b, '-', '_'))
    ) then
      execute format(
        'create policy %I on storage.objects for insert to anon, authenticated with check (bucket_id = %L);',
        format('%s_insert', replace(b, '-', '_')), b
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname = format('%s_update', replace(b, '-', '_'))
    ) then
      execute format(
        'create policy %I on storage.objects for update to anon, authenticated using (bucket_id = %L) with check (bucket_id = %L);',
        format('%s_update', replace(b, '-', '_')), b, b
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname = format('%s_delete', replace(b, '-', '_'))
    ) then
      execute format(
        'create policy %I on storage.objects for delete to anon, authenticated using (bucket_id = %L);',
        format('%s_delete', replace(b, '-', '_')), b
      );
    end if;

  end loop;
end $$;
