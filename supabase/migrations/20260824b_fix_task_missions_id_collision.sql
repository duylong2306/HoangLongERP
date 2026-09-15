-- Migration nối tiếp: sửa lỗi khóa chính có thể trùng ở task_missions
-- (xem 20260824_task_missions_table.sql).
--
-- LÝ DO: migration trước dùng THẲNG mission.id làm khóa chính TOÀN CỤC của
-- bảng task_missions. Nhưng mission.id chỉ được đảm bảo duy nhất TRONG PHẠM
-- VI 1 task — một số nơi trong code sinh id kiểu `mission_${Date.now()}`
-- (KHÔNG có phần ngẫu nhiên). Nếu 2 mission ở 2 TASK KHÁC NHAU được tạo cùng
-- mili-giây, chúng trùng id → lần backfill trước (ON CONFLICT id DO NOTHING)
-- đã ÂM THẦM BỎ QUA 1 trong 2 — đúng kiểu mất dữ liệu đang cố khắc phục.
--
-- FIX: đổi giá trị lưu ở cột id thành khóa ghép "task_id::mission.id" — luôn
-- duy nhất toàn cục bất kể mission.id có trùng giữa các task hay không.
-- mission.id GỐC vẫn được giữ nguyên vẹn bên trong cột data (data.id), vì
-- vậy KHÔNG ảnh hưởng gì tới ứng dụng (application đọc mission.id từ data).
--
-- An toàn để chạy lại nhiều lần (TRUNCATE rồi insert lại từ tasks.missions —
-- cột jsonb cũ vẫn còn nguyên, chưa bị xóa).

TRUNCATE public.task_missions;

INSERT INTO public.task_missions (id, task_id, data)
SELECT
  t.id || '::' || COALESCE(m->>'id', gen_random_uuid()::text) AS id,
  t.id AS task_id,
  m AS data
FROM public.tasks t, jsonb_array_elements(t.missions) AS m
WHERE t.missions IS NOT NULL AND jsonb_typeof(t.missions) = 'array'
ON CONFLICT (id) DO NOTHING;

-- ─── Kiểm tra sau khi chạy (chạy tay, không phải phần bắt buộc của migration) ───
-- So sánh tổng số mission trong cột jsonb cũ với số dòng đã chuyển sang bảng mới.
-- 2 số này PHẢI BẰNG NHAU — nếu lệch, còn dữ liệu chưa được chuyển hết.
--
-- select
--   (select count(*) from public.tasks t, jsonb_array_elements(t.missions) as m
--    where t.missions is not null and jsonb_typeof(t.missions) = 'array') as so_luong_jsonb_cu,
--   (select count(*) from public.task_missions) as so_luong_bang_moi;
