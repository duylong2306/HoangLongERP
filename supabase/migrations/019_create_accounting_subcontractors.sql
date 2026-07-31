-- Migration: Tách bảng DANH SÁCH THẦU PHỤ khỏi bảng suppliers (Nhà cung cấp vật tư)
--
-- Mục đích: Người dùng yêu cầu "DANH SÁCH THẦU PHỤ" là bảng riêng, không trộn với
-- "Danh Mục Nhà Cung Cấp Vật Tư (KHO)". Trước đây cả 2 dùng chung bảng `suppliers`.
-- Migration này:
--   1. Tạo bảng mới `accounting_subcontractors` (cấu trúc giống `suppliers`).
--   2. Copy dữ liệu thầu phụ hiện có từ `suppliers` sang bảng mới.
--   3. Xóa các dòng thầu phụ đã chuyển khỏi `suppliers` để thực sự tách 2 nguồn.
--   4. Bật realtime cho bảng mới.
--
-- ⚠️ HEURISTIC: Việc nhận diện "dòng nào là thầu phụ" là ước lượng bằng keyword
-- (field chứa 'thầu'/'thợ', hoặc id dạng TP_/XD_/NTN_/KM_/DN_). Kiểm tra kết quả
-- trước khi áp dụng lên database production. Có thể chỉnh WHERE trong block 2 & 3.

-- 1. Tạo bảng accounting_subcontractors (copy đúng cấu trúc `suppliers`)
CREATE TABLE IF NOT EXISTS public.accounting_subcontractors (
  id text NOT NULL,
  name text,
  representative text,
  phone text,
  email text,
  address text,
  field text,
  bank_account text,
  bank_name text,
  note text,
  debt numeric,
  region text,
  bank_no text,
  gender text,
  birth_date text,
  cccd text,
  cccd_date text,
  cccd_place text,
  tax_code text,
  CONSTRAINT accounting_subcontractors_pkey PRIMARY KEY (id)
);

-- 2. Copy dữ liệu thầu phụ từ suppliers sang accounting_subcontractors
INSERT INTO public.accounting_subcontractors (
  id, name, representative, phone, email, address, field,
  bank_account, bank_name, note, debt, region, bank_no, gender,
  birth_date, cccd, cccd_date, cccd_place, tax_code
)
SELECT
  id, name, representative, phone, email, address, field,
  bank_account, bank_name, note, debt, region, bank_no, gender,
  birth_date, cccd, cccd_date, cccd_place, tax_code
FROM public.suppliers
WHERE
  field ILIKE '%thầu%' OR field ILIKE '%thợ%'
  OR id ~* '^(TP|XD|NTN|KM|DN)_'
ON CONFLICT (id) DO NOTHING;

-- 3. Xóa các dòng thầu phụ đã chuyển khỏi suppliers (để 2 nguồn thực sự tách biệt)
DELETE FROM public.suppliers
WHERE
  (field ILIKE '%thầu%' OR field ILIKE '%thợ%'
   OR id ~* '^(TP|XD|NTN|KM|DN)_')
  AND id IN (SELECT id FROM public.accounting_subcontractors);

-- 4. Bật realtime cho bảng mới (bỏ qua nếu đã có trong publication)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.accounting_subcontractors;
    RAISE NOTICE '✅ Added accounting_subcontractors to realtime publication';
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE '⏭ accounting_subcontractors already in publication';
  END;
END $$;
