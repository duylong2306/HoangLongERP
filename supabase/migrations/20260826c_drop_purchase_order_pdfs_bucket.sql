-- ============================================================================
-- Migration: Gỡ policy của bucket "purchase-order-pdfs"
--
-- LÝ DO: Tính năng "Copy Link" (upload PDF Đơn Mua Hàng lên Supabase Storage
-- rồi copy public URL để dán vào Zalo) đã bị GỠ BỎ khỏi ứng dụng — thay bằng
-- luồng thuần cục bộ: bấm "Tải PDF" về máy rồi kéo-thả file vào khung chat
-- Zalo (giống hệt cách gửi file bình thường, không qua link/server ngoài).
--
-- LƯU Ý QUAN TRỌNG: Supabase CHẶN xóa trực tiếp bằng SQL vào bảng
-- storage.objects / storage.buckets (trigger storage.protect_delete() —
-- "Direct deletion from storage tables is not allowed. Use the Storage API
-- instead."), kể cả chạy trong SQL Editor với quyền cao nhất. Vì vậy migration
-- này CHỈ gỡ policy (là thao tác RLS bình thường, không bị chặn). Muốn xóa
-- hẳn file PDF đã upload và xóa bucket, phải làm thủ công qua giao diện:
--   Supabase Dashboard → Storage → mở bucket "purchase-order-pdfs" →
--   chọn (các) file → Delete → sau đó bấm nút xóa bucket (biểu tượng thùng
--   rác cạnh tên bucket trong danh sách Storage).
--
-- Chạy 1 lần trong Supabase Dashboard > SQL Editor. Idempotent (an toàn chạy
-- lại nhiều lần, kể cả khi policy đã bị gỡ hoặc chưa từng tồn tại).
-- ============================================================================

-- Policy "select" có thể đã được gỡ trước đó ở migration 20260826b —
-- DROP IF EXISTS nên chạy lại vẫn an toàn dù đã gỡ hay chưa.
drop policy if exists purchase_order_pdfs_select on storage.objects;
drop policy if exists purchase_order_pdfs_insert on storage.objects;
drop policy if exists purchase_order_pdfs_update on storage.objects;
drop policy if exists purchase_order_pdfs_delete on storage.objects;
