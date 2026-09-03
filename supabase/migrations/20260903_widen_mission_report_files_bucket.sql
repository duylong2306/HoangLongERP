-- ============================================================================
-- Migration: Mở rộng bucket "mission-report-images" cho phép upload MỌI định
-- dạng file (không chỉ ảnh) — đổi khái niệm UI từ "HÌNH ẢNH BÁO CÁO" thành
-- "ĐÍNH KÈM BÁO CÁO" trong cửa sổ CHI TIẾT NHIỆM VỤ THI CÔNG.
--
-- Migration 020 đã tạo bucket này với allowed_mime_types CHỈ gồm 4 loại ảnh —
-- dù code phía app (dbService.uploadMissionReportImage) có bỏ giới hạn định
-- dạng, Supabase Storage vẫn TỪ CHỐI upload các file khác ảnh ở tầng policy
-- bucket nếu không chạy migration này. Đặt allowed_mime_types = NULL để bỏ
-- hẳn giới hạn loại file (idempotent — chạy lại nhiều lần vẫn an toàn).
-- ============================================================================

update storage.buckets
set
  allowed_mime_types = null,
  file_size_limit = 26214400 -- nâng lên 25MB/file để đủ dùng cho tài liệu/video ngắn
where id = 'mission-report-images';
