-- ============================================================
-- Migration: thêm loại hồ sơ "Hồ sơ pháp lý dự án" vào archived_quotes
-- Hoàng Long ERP 3.9
--
-- Giống Hợp đồng / Nghiệm thu / Thanh lý: mỗi hồ sơ báo giá đã lưu có thêm
-- 1 bản in hồ sơ pháp lý (legal_html) và cờ đã duyệt (legal_approved).
-- Mẫu (template) hồ sơ pháp lý lưu ở bảng quotation_configs (khóa
-- legal_furniture / legal_construction / legal_mechanical) nên KHÔNG cần cột mới.
-- ============================================================

ALTER TABLE public.archived_quotes
  ADD COLUMN IF NOT EXISTS legal_html     text,
  ADD COLUMN IF NOT EXISTS legal_approved boolean;
