-- ============================================================================
-- 024_attendance_punch_meta.sql
-- Mục đích: Lưu ẢNH FaceID + TỌA ĐỘ GPS RIÊNG CHO TỪNG LƯỢT CHẤM CÔNG.
--
-- Vấn đề trước đây: bảng attendance_records chỉ có 1 cặp (photo_in, coords_in)
-- và 1 cặp (photo_out, coords_out) cho CẢ NGÀY. Mỗi ngày nhân viên chấm tới 6
-- lượt (Vào sáng, Ra sáng, Vào chiều, Ra chiều, Vào tăng ca, Ra tăng ca) nên:
--   - Chấm "Vào chiều" GHI ĐÈ ảnh/tọa độ của "Vào sáng"
--   - Chấm "Ra tăng ca" GHI ĐÈ ảnh/tọa độ của "Ra sáng" và "Ra chiều"
-- → Chỉ còn lại 2 ảnh cuối cùng, mất dấu vết audit của 4 lượt còn lại.
--
-- Cách xử lý: thêm 1 cột JSONB `punch_meta` lưu metadata theo TỪNG SLOT:
--   {
--     "timeInS":  { "photo": "data:image/jpeg;base64,...", "location": "...",
--                   "coords": "10.77, 106.69", "at": "07:25" },
--     "timeOutS": { ... }, "timeInC": { ... }, "timeOutC": { ... },
--     "timeInOT": { ... }, "timeOutOT": { ... }
--   }
--
-- Các cột photo_in/photo_out/coords_in/coords_out CŨ được GIỮ NGUYÊN để:
--   1) Không phá vỡ dữ liệu lịch sử đã ghi trước migration này.
--   2) Các màn hình chưa nâng cấp (tab Chấm công của Nhân sự) vẫn chạy bình thường.
-- Client ghi song song cả 2 nơi: punch_meta (đầy đủ 6 slot) + cặp cột cũ (lượt gần nhất).
-- ============================================================================

ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS punch_meta jsonb;

COMMENT ON COLUMN public.attendance_records.punch_meta IS
  'Ảnh FaceID + tọa độ GPS + giờ chấm theo từng slot: timeInS/timeOutS/timeInC/timeOutC/timeInOT/timeOutOT';
