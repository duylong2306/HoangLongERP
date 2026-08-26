-- ============================================================================
-- Migration: Gỡ bỏ hoàn toàn bucket "purchase-order-pdfs"
--
-- LÝ DO: Tính năng "Copy Link" (upload PDF Đơn Mua Hàng lên Supabase Storage
-- rồi copy public URL để dán vào Zalo) đã bị GỠ BỎ khỏi ứng dụng — thay bằng
-- luồng thuần cục bộ: bấm "Tải PDF" về máy rồi kéo-thả file vào khung chat
-- Zalo (giống hệt cách gửi file bình thường, không qua link/server ngoài).
-- Bucket này không còn được dùng nữa nên xóa hẳn để không để lại dữ liệu PDF
-- đơn hàng nằm công khai trên Storage không cần thiết.
--
-- Chạy 1 lần trong Supabase Dashboard > SQL Editor. Idempotent (an toàn chạy
-- lại nhiều lần, kể cả khi bucket đã bị xóa hoặc chưa từng tồn tại).
-- ============================================================================

-- 1) Xóa toàn bộ policy liên quan tới bucket này (policy "select" có thể đã
--    được gỡ trước đó ở migration 20260826b — DROP IF EXISTS nên chạy lại
--    vẫn an toàn dù đã gỡ hay chưa).
drop policy if exists purchase_order_pdfs_select on storage.objects;
drop policy if exists purchase_order_pdfs_insert on storage.objects;
drop policy if exists purchase_order_pdfs_update on storage.objects;
drop policy if exists purchase_order_pdfs_delete on storage.objects;

-- 2) Xóa toàn bộ file (object) đã upload vào bucket, rồi xóa chính bucket đó.
delete from storage.objects where bucket_id = 'purchase-order-pdfs';
delete from storage.buckets where id = 'purchase-order-pdfs';
