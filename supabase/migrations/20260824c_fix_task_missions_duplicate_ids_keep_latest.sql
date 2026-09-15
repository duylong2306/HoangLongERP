-- Migration nối tiếp: sửa lỗi chọn NHẦM bản CŨ khi có mission trùng id trong
-- CÙNG 1 task (xem 20260824_task_missions_table.sql,
-- 20260824b_fix_task_missions_id_collision.sql).
--
-- PHÁT HIỆN: dữ liệu thật có một số mission bị TRÙNG id NGAY TRONG CÙNG 1
-- mảng missions của 1 task — hệ quả của đúng lỗi "ghi đè toàn bộ mảng" đã sửa
-- (mỗi lần 1 người sửa mission dựa trên bản cũ rồi vô tình append thêm 1 bản
-- mới thay vì cập nhật tại chỗ). Các bản trùng có deadline/thành viên KHÁC
-- NHAU tăng dần theo thời gian → bản NẰM SAU trong mảng luôn là bản MỚI NHẤT
-- (nơi tạo mission dùng `[...currentMissions, newMission]` — thêm vào CUỐI).
--
-- LỖI CỦA 2 MIGRATION TRƯỚC: dùng `ON CONFLICT (id) DO NOTHING`, nên khi có
-- nhiều bản trùng id trong 1 mảng, chỉ bản ĐẦU TIÊN (CŨ NHẤT) được giữ lại —
-- ngược với điều đúng cần làm.
--
-- FIX: dùng jsonb_array_elements(...) WITH ORDINALITY để biết vị trí từng
-- phần tử trong mảng, DISTINCT ON để chỉ giữ ĐÚNG 1 bản mới nhất (vị trí lớn
-- nhất) cho mỗi (task_id, mission.id) TRƯỚC KHI insert — tránh luôn lỗi
-- Postgres "ON CONFLICT DO UPDATE command cannot affect row a second time"
-- (không thể ON CONFLICT DO UPDATE khi cùng 1 câu INSERT có 2 dòng trùng khóa).
-- An toàn chạy lại nhiều lần (ON CONFLICT DO UPDATE ghi đè đúng bản mới nhất).

WITH expanded AS (
  SELECT
    t.id AS task_id,
    m AS data,
    ord AS array_pos
  FROM public.tasks t
  CROSS JOIN LATERAL jsonb_array_elements(t.missions) WITH ORDINALITY AS x(m, ord)
  WHERE t.missions IS NOT NULL AND jsonb_typeof(t.missions) = 'array'
),
deduped AS (
  -- Giữ đúng 1 bản cho mỗi (task_id, mission.id): bản Ở VỊ TRÍ CUỐI trong
  -- mảng (array_pos lớn nhất) = bản được ghi/sửa gần đây nhất.
  SELECT DISTINCT ON (task_id, (data->>'id'))
    task_id,
    data
  FROM expanded
  ORDER BY task_id, (data->>'id'), array_pos DESC
)
INSERT INTO public.task_missions (id, task_id, data)
SELECT
  task_id || '::' || COALESCE(data->>'id', gen_random_uuid()::text),
  task_id,
  data
FROM deduped
ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;

-- ─── Kiểm tra sau khi chạy (chạy tay) ───
-- Đếm số (task_id, mission.id) PHÂN BIỆT trong cột jsonb cũ, so với số dòng
-- trong bảng mới — 2 số này phải bằng nhau.
--
-- select
--   (select count(distinct (t.id, m->>'id'))
--    from public.tasks t, jsonb_array_elements(t.missions) as m
--    where t.missions is not null and jsonb_typeof(t.missions) = 'array') as so_luong_phan_biet_cu,
--   (select count(*) from public.task_missions) as so_luong_bang_moi;
--
-- Xem lại mission cụ thể đã từng bị lấy nhầm bản cũ để xác nhận đã đúng bản mới nhất:
-- select data->>'deadline' as deadline, data->'memberIds' as members
-- from public.task_missions
-- where id = 'task_child_1785676380464::mission_1785753456558';
-- → deadline PHẢI là 2026-08-08 (bản mới nhất), KHÔNG phải 2026-08-04.
