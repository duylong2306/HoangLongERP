-- =============================================================================
-- Migration: tax_exempt_income / personal_deduction / dependent_count /
--            dependent_deduction trên hrm_payroll_records
-- Chạy trong Supabase Dashboard > SQL Editor
-- =============================================================================
-- Phục vụ tính năng "Thuế TNCN + Giảm trừ gia cảnh" trong Tính lương tự động —
-- công thức ĐÚNG theo sheet "LƯƠNG OK" của file BẢNG LƯƠNG, NHÂN SỰ:
--   - tax_exempt_income: Thu nhập miễn thuế (toàn bộ tiền tăng ca CN/Lễ + ngoài giờ).
--   - personal_deduction: Giảm trừ bản thân dùng khi tính kỳ này (snapshot từ
--     employee.tax_personal_relief, mặc định 15.500.000đ).
--   - dependent_count: Số người phụ thuộc dùng khi tính kỳ này (snapshot từ
--     employee.dependent_count).
--   - dependent_deduction: = dependent_count × 6.200.000đ.
-- Các cột "tax", "taxable_income", "taxable_net_income" đã có sẵn từ trước,
-- không cần thêm lại.

ALTER TABLE public.hrm_payroll_records
  ADD COLUMN IF NOT EXISTS tax_exempt_income numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS personal_deduction numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dependent_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dependent_deduction numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.hrm_payroll_records.tax_exempt_income IS
  'Thu nhập miễn thuế = toàn bộ tiền tăng ca CN/Lễ + tăng ca ngoài giờ (đúng công thức sheet LƯƠNG OK).';
COMMENT ON COLUMN public.hrm_payroll_records.personal_deduction IS
  'Giảm trừ bản thân snapshot tại thời điểm tính lương (từ employees.tax_personal_relief).';
COMMENT ON COLUMN public.hrm_payroll_records.dependent_count IS
  'Số người phụ thuộc snapshot tại thời điểm tính lương (từ employees.dependent_count).';
COMMENT ON COLUMN public.hrm_payroll_records.dependent_deduction IS
  'Giảm trừ người phụ thuộc = dependent_count x 6.200.000đ.';

-- Verify:
-- SELECT id, emp_id, month, tax_exempt_income, personal_deduction, dependent_count, dependent_deduction, taxable_income, taxable_net_income, tax FROM public.hrm_payroll_records LIMIT 5;
