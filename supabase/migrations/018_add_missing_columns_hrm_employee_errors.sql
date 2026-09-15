-- Migration: Bổ sung các cột còn thiếu của hrm_employee_errors trên database thật
--
-- Lỗi gặp phải: "Could not find the 'images' column of 'hrm_employee_errors' in the schema cache"
-- → Bảng trên Supabase thật được tạo từ schema cũ, thiếu cột `images`.
-- Có thể cũng thiếu `task_id`/`auto_source` (migration 017) hoặc `severity`.
-- Tất cả dùng IF NOT EXISTS nên idempotent — chạy an toàn dù đã áp dụng 017.

ALTER TABLE public.hrm_employee_errors
ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}'::text[];

ALTER TABLE public.hrm_employee_errors
ADD COLUMN IF NOT EXISTS severity text;

ALTER TABLE public.hrm_employee_errors
ADD COLUMN IF NOT EXISTS task_id text;

ALTER TABLE public.hrm_employee_errors
ADD COLUMN IF NOT EXISTS auto_source text;
