-- Thêm cột Công Nợ đầu kỳ (opening_debt) cho 3 bảng master data:
-- customers, suppliers (Nhà cung cấp vật tư), accounting_subcontractors (Thầu phụ)
-- Dùng ALTER TABLE ... ADD COLUMN IF NOT EXISTS để an toàn khi chạy lại.

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS opening_debt numeric DEFAULT 0;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS opening_debt numeric DEFAULT 0;
ALTER TABLE public.accounting_subcontractors ADD COLUMN IF NOT EXISTS opening_debt numeric DEFAULT 0;
