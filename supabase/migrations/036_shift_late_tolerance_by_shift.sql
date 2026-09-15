-- Tách dung sai "Cho phép đi muộn" riêng theo từng ca (Sáng / Chiều).
-- Ca Sáng dùng allowed_late_morning, ca Chiều dùng allowed_late_afternoon.
-- Giữ allowed_late_minutes làm fallback tương thích (không xóa).
ALTER TABLE public.shift_config
  ADD COLUMN IF NOT EXISTS allowed_late_morning   integer DEFAULT 15,
  ADD COLUMN IF NOT EXISTS allowed_late_afternoon integer DEFAULT 15;
