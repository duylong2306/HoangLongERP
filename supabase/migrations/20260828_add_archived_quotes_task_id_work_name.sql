-- =============================================================================
-- Migration: Thêm cột task_id, work_name còn thiếu vào bảng archived_quotes
-- Hoàng Long ERP 3.9
-- =============================================================================
-- Nguyên nhân: SubcontractorEstimator.tsx thu thập taskId ("Công việc con liên
-- kết") và workName ("Nội dung công việc") khi lập Hợp Đồng Thầu Phụ, nhưng
-- dbService.archivedQuotes.save() là 1 object literal liệt kê cứng danh sách
-- cột — KHÔNG có task_id/work_name trong đó — nên 2 giá trị này bị âm thầm bỏ
-- qua, không bao giờ lưu xuống DB (xác nhận bằng test trực tiếp: POST thử với
-- field task_id trả lỗi PGRST204 "Could not find the 'task_id' column").
--
-- Hậu quả: khi 1 dự án có nhiều Công việc cùng gán 1 Thầu phụ (hợp lệ về
-- nghiệp vụ), nhưng mỗi Hợp Đồng Thầu Phụ lập riêng cho từng công việc lại
-- không lưu được liên kết công việc → các nơi tính công nợ/giá trị hợp đồng
-- theo (dự án, công việc, thầu phụ) không phân biệt được, dễ lấy nhầm hợp
-- đồng của công việc khác. work_name (nội dung công việc, trường bắt buộc khi
-- lập hợp đồng) cũng mất tương tự, khiến Công Nợ Trả luôn hiện text mặc định
-- "Hợp đồng thầu phụ thi công" thay vì nội dung thật đã nhập.
--
-- Fix: thêm cột (idempotent, an toàn chạy lại nhiều lần). Code phía
-- dbService.ts (archivedQuotes.save/list) được cập nhật tương ứng ở cùng PR.
-- =============================================================================

ALTER TABLE public.archived_quotes
  ADD COLUMN IF NOT EXISTS task_id text,
  ADD COLUMN IF NOT EXISTS work_name text;

COMMENT ON COLUMN public.archived_quotes.task_id
  IS 'Công việc con liên kết (FK → tasks.id) — chỉ áp dụng cho sector=subcontractor, phân biệt hợp đồng khi 1 thầu phụ có nhiều hợp đồng trong cùng 1 dự án';
COMMENT ON COLUMN public.archived_quotes.work_name
  IS 'Nội dung công việc (chỉ áp dụng cho sector=subcontractor) — mô tả hạng mục thầu phụ thi công';

-- Bảng đã tắt RLS; cấp ALL cho các role giống các bảng khác trong hệ thống.
GRANT ALL ON TABLE public.archived_quotes TO anon, authenticated, service_role;
