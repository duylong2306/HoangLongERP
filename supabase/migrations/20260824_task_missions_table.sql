-- Migration: Tách "missions" (nhiệm vụ con trong 1 Công việc) từ cột jsonb
-- trong bảng tasks thành 1 bảng riêng task_missions (mỗi mission 1 dòng).
--
-- LÝ DO: tasks.missions trước đây là 1 cột jsonb duy nhất — mỗi lần lưu 1
-- mission là upsert TOÀN BỘ row tasks, ghi đè nguyên mảng. Khi 2 người dùng
-- (2 tab/2 máy) sửa 2 mission khác nhau của cùng 1 task gần như đồng thời,
-- người lưu sau ghi đè mất thay đổi của người lưu trước → "nhiệm vụ thỉnh
-- thoảng bị mất". Tách thành bảng riêng, mỗi mission 1 dòng độc lập, để lưu
-- 1 mission không còn động tới các mission khác.
--
-- Cột task_id là FK THẬT (không như hrm_travel_expenses, nơi liên kết task
-- chỉ nằm trong jsonb → cascade xoá không hoạt động, để lại bản ghi mồ côi).
-- Đặt ON DELETE CASCADE ngay lúc tạo bảng theo đúng mẫu chat_messages đã có.
--
-- KHÔNG xoá cột tasks.missions cũ trong migration này — giữ làm lưới an
-- toàn/rollback, dữ liệu cũ đóng băng tại đó. Ứng dụng (dbService.ts) sẽ
-- ngừng đọc/ghi cột này và chuyển sang dùng bảng task_missions.

CREATE TABLE IF NOT EXISTS public.task_missions (
  id      text PRIMARY KEY,
  task_id text NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  -- Toàn bộ nội dung 1 SubTaskMission (trừ id/taskId), giữ nguyên camelCase
  -- — đúng cách tasks.missions jsonb cũ đang lưu (keysToSnake trong
  -- dbService.ts chỉ convert key tầng ngoài, không đệ quy vào nested value).
  data    jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_task_missions_task_id ON public.task_missions(task_id);

-- Backfill dữ liệu cũ từ tasks.missions (idempotent — chạy lại nhiều lần an toàn).
INSERT INTO public.task_missions (id, task_id, data)
SELECT
  COALESCE(m->>'id', gen_random_uuid()::text) AS id,
  t.id AS task_id,
  (m - 'id') AS data
FROM public.tasks t, jsonb_array_elements(t.missions) AS m
WHERE t.missions IS NOT NULL AND jsonb_typeof(t.missions) = 'array'
ON CONFLICT (id) DO NOTHING;

-- Row Level Security — giống mọi bảng khác trong app (anon key + tự xác thực
-- qua bảng employees, xem phần RLS trong schema.sql).
ALTER TABLE public.task_missions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_task_missions" ON public.task_missions;
CREATE POLICY "anon_all_task_missions" ON public.task_missions
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_all_task_missions" ON public.task_missions;
CREATE POLICY "service_all_task_missions" ON public.task_missions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Bật Realtime cho task_missions (theo mẫu 20260101_enable_realtime.sql).
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.task_missions';
    RAISE NOTICE '✅ Added: task_missions';
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE '⏭ Already in publication: task_missions';
  END;
END $$;
