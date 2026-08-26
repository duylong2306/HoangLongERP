-- ============================================================================
-- Migration: Tạo Storage bucket "purchase-order-pdfs"
--
-- MỤC ĐÍCH: Lưu file PDF Đơn Mua Hàng (Điều Phối Vật Tư) khi người dùng bấm
-- nút "Copy Link" — dbService.uploadPurchaseOrderPdf() upload PDF lên bucket
-- này rồi trả về public URL, copy vào clipboard để dán trực tiếp vào Zalo
-- (thay cho việc chia sẻ file qua navigator.share(), vốn không hoạt động với
-- Zalo trên Windows vì Zalo desktop không đăng ký nhận qua Web Share API).
--
-- App chạy với anon key nên KHÔNG có quyền storage.createBucket() (chỉ
-- service_role) — giống các bucket avatars/attendance-photos/quote-images,
-- việc tạo bucket là trách nhiệm của migration này (chạy trên Supabase SQL
-- Editor / supabase db push), không phải runtime.
--
-- Chạy 1 lần trong Supabase Dashboard > SQL Editor. Idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Tạo bucket "purchase-order-pdfs" (public = true để lấy public URL trực tiếp)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'purchase-order-pdfs',
  'purchase-order-pdfs',
  true,
  10485760, -- 10 MB / file
  array['application/pdf']::text[]
)
on conflict (id) do update set
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf']::text[];

-- ----------------------------------------------------------------------------
-- 2) Policies cho phép anon / authenticated đọc, upload, sửa, xóa file
--    trong bucket này. Viết qua DO block để chạy lại không lỗi.
-- ----------------------------------------------------------------------------
do $$
declare
  b text := 'purchase-order-pdfs';
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'purchase_order_pdfs_select'
  ) then
    execute format(
      'create policy purchase_order_pdfs_select on storage.objects for select using (bucket_id = %L);',
      b
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'purchase_order_pdfs_insert'
  ) then
    execute format(
      'create policy purchase_order_pdfs_insert on storage.objects for insert to anon, authenticated with check (bucket_id = %L);',
      b
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'purchase_order_pdfs_update'
  ) then
    execute format(
      'create policy purchase_order_pdfs_update on storage.objects for update to anon, authenticated using (bucket_id = %L) with check (bucket_id = %L);',
      b, b
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'purchase_order_pdfs_delete'
  ) then
    execute format(
      'create policy purchase_order_pdfs_delete on storage.objects for delete to anon, authenticated using (bucket_id = %L);',
      b
    );
  end if;
end $$;
