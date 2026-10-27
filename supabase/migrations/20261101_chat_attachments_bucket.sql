-- KHO LƯU TRỮ ẢNH / TỆP ĐÍNH KÈM CỦA TIN NHẮN (bucket "chat-attachments").
-- Trước đây ảnh/tệp gửi trong chat bị nhúng thẳng vào bảng chat_messages dưới dạng chuỗi base64 (có tin > 3,5 MB; tải 10 tin ≈ 16 MB / 15 giây),
-- nay tải lên Storage, trong tin chỉ giữ đường dẫn (xem dbService.uploadChatAttachment).
-- Chạy thủ công trong Supabase SQL Editor (mỗi project một lần). Chạy lại nhiều lần vẫn an toàn.
-- ⚠️ Chưa chạy thì ứng dụng vẫn gửi được ảnh/tệp như cũ (tự quay về lưu base64 trong tin) — chỉ là chậm.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-attachments', 'chat-attachments', true, 26214400, null)   -- 25 MB/tệp, nhận mọi định dạng (chat giới hạn 10 MB ở giao diện)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Cô lập theo doanh nghiệp: thư mục gốc của đường dẫn phải là company_id trong JWT (cùng mẫu 20261001_storage_tenant_isolation.sql)
drop policy if exists chat_attachments_tenant_select on storage.objects;
drop policy if exists chat_attachments_tenant_insert on storage.objects;
drop policy if exists chat_attachments_tenant_update on storage.objects;
drop policy if exists chat_attachments_tenant_delete on storage.objects;

create policy chat_attachments_tenant_select on storage.objects for select to authenticated
  using (bucket_id = 'chat-attachments' and (storage.foldername(name))[1] = (auth.jwt() ->> 'company_id'));
create policy chat_attachments_tenant_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-attachments' and (storage.foldername(name))[1] = (auth.jwt() ->> 'company_id'));
create policy chat_attachments_tenant_update on storage.objects for update to authenticated
  using (bucket_id = 'chat-attachments' and (storage.foldername(name))[1] = (auth.jwt() ->> 'company_id'))
  with check (bucket_id = 'chat-attachments' and (storage.foldername(name))[1] = (auth.jwt() ->> 'company_id'));
create policy chat_attachments_tenant_delete on storage.objects for delete to authenticated
  using (bucket_id = 'chat-attachments' and (storage.foldername(name))[1] = (auth.jwt() ->> 'company_id'));
