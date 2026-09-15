-- =============================================================================
-- Migration: Sửa kiểu dữ liệu cột id của accounting_receivables từ uuid -> text
--
-- Lý do: Code frontend tạo id dạng "opbal_cust_KH_CTTCL_21" để làm
-- primary key cho các dòng Công Nợ Đầu Kỳ (Thu), nhưng cột id hiện là uuid
-- nên upsert thất bại với lỗi "invalid input syntax for type uuid".
--
-- Bảng accounting_liabilities đã được fix tương tự ở migration
-- 20260817_fix_accounting_liabilities_id_type.sql.
-- =============================================================================

-- Phải drop primary key trước vì PostgreSQL không cho đổi kiểu cột PK trực tiếp.
ALTER TABLE public.accounting_receivables DROP CONSTRAINT accounting_receivables_pkey;

-- Chuyển id từ uuid sang text, giữ lại giá trị cũ (các UUID hợp lệ vẫn hoạt động).
ALTER TABLE public.accounting_receivables
  ALTER COLUMN id DROP DEFAULT,
  ALTER COLUMN id TYPE text USING id::text;

-- Gắn lại primary key
ALTER TABLE public.accounting_receivables
  ADD CONSTRAINT accounting_receivables_pkey PRIMARY KEY (id);
