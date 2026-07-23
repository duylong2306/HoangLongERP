-- Migration: Add missing columns to hrm_performance_criteria
-- Bảng lưu tiêu chí đánh giá nhân viên theo phòng ban

-- Thêm cột department_name nếu chưa có
ALTER TABLE hrm_performance_criteria
ADD COLUMN IF NOT EXISTS department_name TEXT;

-- Thêm cột criteria (JSON array dạng text) nếu chưa có
ALTER TABLE hrm_performance_criteria
ADD COLUMN IF NOT EXISTS criteria TEXT;