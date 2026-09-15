-- =============================================================================
-- Migration: locked / locked_at / line_notes trên hrm_payroll_records
-- Chạy trong Supabase Dashboard > SQL Editor
-- =============================================================================
-- Phục vụ 2 tính năng mới của Phiếu Lương:
--   - "Khóa kỳ & Phát phiếu lương": đánh dấu locked=true, locked_at=thời điểm
--     khóa cho TOÀN BỘ payroll của kỳ đang chọn — dùng làm ngày lập mặc định
--     in trên phiếu lương (thay cho ngày cố định "15 tháng sau" trước đây).
--   - "Ghi chú theo từng dòng hạng mục lương": line_notes lưu 1 object
--     {tênHạngMục: ghiChú}, hiển thị ngay dưới dòng tương ứng trên phiếu.

ALTER TABLE public.hrm_payroll_records
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS line_notes jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.hrm_payroll_records.locked IS
  'Kỳ lương của nhân viên này đã được "Khóa kỳ & Phát phiếu lương" chưa.';
COMMENT ON COLUMN public.hrm_payroll_records.locked_at IS
  'Thời điểm khóa kỳ — dùng làm ngày lập mặc định in trên phiếu lương.';
COMMENT ON COLUMN public.hrm_payroll_records.line_notes IS
  'Ghi chú theo từng dòng hạng mục lương. Vd: {"baseSalary": "Đã điều chỉnh theo QĐ..."}';

-- Verify:
-- SELECT id, emp_id, month, locked, locked_at, line_notes FROM public.hrm_payroll_records LIMIT 5;
