-- Migration: Thêm cột task_id & auto_source cho hrm_employee_errors
-- Vi phạm gửi từ Công việc (TaskDetailModal) lưu tham chiếu task_id để lọc lịch sử.
-- auto_source dùng để chống trùng khi tự động ghi nhận quá hạn (chỉ dùng Supabase, không dùng localStorage).

ALTER TABLE public.hrm_employee_errors
ADD COLUMN IF NOT EXISTS task_id text;

ALTER TABLE public.hrm_employee_errors
ADD COLUMN IF NOT EXISTS auto_source text;
