-- 039: Thêm cột source cho receipts và payments để phân biệt dữ liệu thủ công vs import
-- 'manual' = tạo thủ công từ nút "Lập phiếu thu mới" / "Tạo đề xuất chi mới"
-- 'import' = nhập từ file Excel
-- 'auto' = tạo tự động từ quy trình khác (đề xuất tạm ứng, công nợ đầu kỳ, etc.)

ALTER TABLE public.receipts
ADD COLUMN IF NOT EXISTS source text DEFAULT 'import'
CHECK (source IN ('manual', 'import', 'auto'));

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS source text DEFAULT 'import'
CHECK (source IN ('manual', 'import', 'auto'));

COMMENT ON COLUMN public.receipts.source IS 'Nguồn dữ liệu: manual (thủ công), import (Excel), auto (tự động)';
COMMENT ON COLUMN public.payments.source IS 'Nguồn dữ liệu: manual (thủ công), import (Excel), auto (tự động)';

-- Cập nhật dữ liệu hiện có: mặc định là 'import' cho phiếu cũ
UPDATE public.receipts SET source = 'import' WHERE source IS NULL;
UPDATE public.payments SET source = 'import' WHERE source IS NULL;

-- Thêm index để query nhanh theo source
CREATE INDEX IF NOT EXISTS idx_receipts_source ON public.receipts(source);
CREATE INDEX IF NOT EXISTS idx_payments_source ON public.payments(source);