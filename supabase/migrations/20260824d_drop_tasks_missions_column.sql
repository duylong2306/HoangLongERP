-- Migration dọn dẹp: xóa cột tasks.missions (jsonb) cũ — ĐÃ được tách hẳn
-- sang bảng public.task_missions (xem 20260824_task_missions_table.sql,
-- 20260824b_fix_task_missions_id_collision.sql,
-- 20260824c_fix_task_missions_duplicate_ids_keep_latest.sql).
--
-- Đã xác nhận trước khi chạy migration này: 78/78 mission phân biệt trong
-- cột jsonb cũ đều có mặt và ĐÚNG NỘI DUNG (bản mới nhất) trong task_missions
-- — không còn dữ liệu nào chỉ tồn tại ở cột cũ. Ứng dụng (dbService.ts) đã
-- ngừng đọc/ghi cột này từ trước (xem tasks.list()/save()).
--
-- ⚠️ THAO TÁC KHÔNG THỂ HOÀN TÁC — xóa cột là xóa vĩnh viễn dữ liệu jsonb cũ
-- khỏi bảng tasks (bảng task_missions không bị ảnh hưởng).

ALTER TABLE public.tasks DROP COLUMN IF EXISTS missions;
