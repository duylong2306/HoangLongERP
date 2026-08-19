-- Migration: Bổ sung cột images cho bảng payments
--
-- Lỗi gặp phải: khi "Cập nhật chứng từ" (upload sao kê / biên lai) ở Đề Xuất Chi,
-- hàm dbService.payments.save() upsert bản ghi Payment có trường images, nhưng bảng
-- payments trên Supabase thật thiếu cột images → PostgREST báo
-- "Could not find the 'images' column of 'payments' in the schema cache" (42703).
-- Kết quả: sao kê không lưu được, đề xuất không bao giờ chuyển sang cột "Hoàn thành".
--
-- Thêm cột images (mảng base64 data URL) để flow Lập Phiếu → Cập nhật chứng từ →
-- Hoàn thành hoạt động đúng. Dùng IF NOT EXISTS nên idempotent.

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}'::text[];
