-- =============================================================================
-- Migration: Sửa kiểu dữ liệu cột id của accounting_liabilities từ uuid -> text
--
-- Lý do: Code frontend tạo id dạng "opbal_sup_SUP_1785767640473" để làm
-- primary key cho các dòng Công Nợ Đầu Kỳ, nhưng cột id hiện là uuid nên
-- upsert thất bại với lỗi "invalid input syntax for type uuid".
--
-- Bảng accounting_receivables đã có id dạng text nên hoạt động bình thường.
-- =============================================================================

-- Phải drop primary key trước vì PostgreSQL không cho đổi kiểu cột PK trực tiếp.
ALTER TABLE public.accounting_liabilities DROP CONSTRAINT accounting_liabilities_pkey;

-- Chuyển id từ uuid sang text, giữ lại giá trị cũ (các UUID hợp lệ vẫn hoạt động).
ALTER TABLE public.accounting_liabilities
  ALTER COLUMN id DROP DEFAULT,
  ALTER COLUMN id TYPE text USING id::text;

-- Gắn lại primary key
ALTER TABLE public.accounting_liabilities
  ADD CONSTRAINT accounting_liabilities_pkey PRIMARY KEY (id);
