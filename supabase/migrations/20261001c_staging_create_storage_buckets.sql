-- ============================================================================
-- ⚠️ CHỈ CHẠY TRÊN PROJECT STAGING MULTI-TENANT (oittwcngarzmtrmjxisu) —
-- KHÔNG chạy trên project production (cyuunmrdrymhzxfcruoe), production đã
-- có bucket + migration riêng (20261001b_storage_production_block_public_list.sql).
-- ============================================================================
--
-- Rà soát bảo mật 2026-10-01 phát hiện project staging CHƯA CÓ bucket Storage
-- nào (0 bucket) — nên 20261001_storage_tenant_isolation.sql (đã chạy) chỉ
-- mới tạo policy "chờ sẵn" cho 5 bucket chưa tồn tại, chưa thể verify bằng
-- thực nghiệm. Migration này tạo đúng 5 bucket đó (thông số lấy từ các
-- migration gốc trên production: 034/029/020+20260903/025) rồi đảm bảo lại
-- policy tenant-isolation theo company_id — bucket mới tạo đã AN TOÀN NGAY
-- TỪ ĐẦU, không đi qua policy công khai cũ bao giờ.
--
-- Chạy 1 lần trong Supabase Dashboard > SQL Editor (project STAGING).
-- Idempotent — chạy lại không lỗi.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Tạo 5 bucket (thông số khớp với production)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 5242880, array['image/png','image/jpeg','image/webp','image/gif']::text[]),
  ('attendance-photos', 'attendance-photos', true, 10485760, array['image/png','image/jpeg','image/webp','image/gif']::text[]),
  ('mission-report-images', 'mission-report-images', true, 26214400, null),
  ('quote-images', 'quote-images', true, 10485760, array['image/png','image/jpeg','image/webp','image/gif']::text[]),
  ('product-catalog-images', 'product-catalog-images', true, 10485760, array['image/png','image/jpeg','image/webp','image/gif']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- 2) Đảm bảo lại policy tenant-isolation theo company_id cho cả 5 bucket —
--    y hệt 20261001_storage_tenant_isolation.sql, chạy lại idempotent để
--    chắc chắn bucket mới tạo có policy đúng ngay (phòng trường hợp lần
--    chạy trước chưa tạo được do bucket chưa tồn tại).
-- ----------------------------------------------------------------------------
do $$
declare
  bucket_name text;
  buckets text[] := array[
    'avatars',
    'attendance-photos',
    'mission-report-images',
    'quote-images',
    'product-catalog-images'
  ];
  prefix text;
begin
  foreach bucket_name in array buckets loop
    prefix := replace(bucket_name, '-', '_');

    execute format('drop policy if exists %I on storage.objects;', prefix || '_select');
    execute format('drop policy if exists %I on storage.objects;', prefix || '_insert');
    execute format('drop policy if exists %I on storage.objects;', prefix || '_update');
    execute format('drop policy if exists %I on storage.objects;', prefix || '_delete');
    execute format('drop policy if exists %I on storage.objects;', prefix || '_tenant_select');
    execute format('drop policy if exists %I on storage.objects;', prefix || '_tenant_insert');
    execute format('drop policy if exists %I on storage.objects;', prefix || '_tenant_update');
    execute format('drop policy if exists %I on storage.objects;', prefix || '_tenant_delete');

    execute format(
      'create policy %I on storage.objects for select to authenticated
         using (bucket_id = %L and (storage.foldername(name))[1] = (auth.jwt() ->> ''company_id''));',
      prefix || '_tenant_select', bucket_name
    );
    execute format(
      'create policy %I on storage.objects for insert to authenticated
         with check (bucket_id = %L and (storage.foldername(name))[1] = (auth.jwt() ->> ''company_id''));',
      prefix || '_tenant_insert', bucket_name
    );
    execute format(
      'create policy %I on storage.objects for update to authenticated
         using (bucket_id = %L and (storage.foldername(name))[1] = (auth.jwt() ->> ''company_id''))
         with check (bucket_id = %L and (storage.foldername(name))[1] = (auth.jwt() ->> ''company_id''));',
      prefix || '_tenant_update', bucket_name, bucket_name
    );
    execute format(
      'create policy %I on storage.objects for delete to authenticated
         using (bucket_id = %L and (storage.foldername(name))[1] = (auth.jwt() ->> ''company_id''));',
      prefix || '_tenant_delete', bucket_name
    );

    raise notice '✅ Bucket % đã tạo + policy tenant-isolation theo company_id', bucket_name;
  end loop;
end $$;
