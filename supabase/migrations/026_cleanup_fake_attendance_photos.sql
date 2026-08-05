-- ============================================================================
-- 026_cleanup_fake_attendance_photos.sql
-- Mục đích: Dọn các ẢNH GIẢ (stock/placeholder — ví dụ images.unsplash.com) đã
-- bị lưu nhầm lên bảng attendance_records do fallback cũ trong captureSelfieFromStream().
--
-- NGUYÊN NHÂN: Trước đây, khi camera không mở được, captureSelfieFromStream()
-- trả về URL ảnh chân dung lấy từ images.unsplash.com (trông như ảnh AI sinh ra).
-- burnTimestampToPhoto() chỉ đốt giờ ảnh dạng data URL nên URL này đi nguyên vẹn
-- vào cột photo_in/photo_out và trường "photo" bên trong punch_meta (jsonb),
-- rồi được đồng bộ lên Supabase.
--
-- Ảnh chấm công HỢP LỆ chỉ có 2 dạng:
--   1) data URL (data:image/...) — ảnh chụp trực tiếp lúc điểm danh, resize canvas
--   2) URL public của chính Supabase Storage (/storage/v1/object/public/...)
-- Mọi http(s) URL KHÁC (Unsplash, placeholder, ảnh stock...) = ẢNH GIẢ.
--
-- Chỉ dọn ẢNH GIẢ; GIỮ NGUYÊN ảnh data URL và ảnh thuộc Storage của dự án.
-- Không đụng tới các cột coords/location (GPS) vì chúng hợp lệ.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Cột cũ photo_in / photo_out — đặt NULL nếu là ảnh URL giả
-- ----------------------------------------------------------------------------
UPDATE public.attendance_records
SET photo_in = NULL
WHERE photo_in IS NOT NULL
  AND photo_in LIKE 'http%'
  AND photo_in NOT LIKE '%/storage/v1/object/public/%';

UPDATE public.attendance_records
SET photo_out = NULL
WHERE photo_out IS NOT NULL
  AND photo_out LIKE 'http%'
  AND photo_out NOT LIKE '%/storage/v1/object/public/%';

-- ----------------------------------------------------------------------------
-- 2) punch_meta (jsonb) — bỏ khóa "photo" khỏi từng slot nếu đó là ảnh URL giả
--    (giữ nguyên location/coords/at của slot, chỉ bỏ riêng ảnh)
-- ----------------------------------------------------------------------------
UPDATE public.attendance_records
SET punch_meta = (
  SELECT jsonb_object_agg(
           kv.key,
           CASE
             WHEN (kv.value->>'photo') IS NOT NULL
              AND (kv.value->>'photo') LIKE 'http%'
              AND (kv.value->>'photo') NOT LIKE '%/storage/v1/object/public/%'
               THEN kv.value - 'photo'
             ELSE kv.value
           END
         )
  FROM jsonb_each(punch_meta) AS kv
)
WHERE punch_meta IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM jsonb_each(punch_meta) AS kv
    WHERE (kv.value->>'photo') IS NOT NULL
      AND (kv.value->>'photo') LIKE 'http%'
      AND (kv.value->>'photo') NOT LIKE '%/storage/v1/object/public/%'
  );
