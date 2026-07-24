-- =============================================================================
-- Migration 006: Hệ thống thông báo điểm danh tự động (pg_cron)
-- Chạy trong Supabase Dashboard > SQL Editor
-- =============================================================================
-- Cơ chế:
--   1. pg_cron chạy lúc 07:00 & 12:30 VN (T2-T7)
--   2. Function INSERT vào bảng notifications → tạo in-app notification
--   3. Supabase Realtime (đã enable) tự động push đến client đang mở
--   4. Client-side timer (App.tsx) gửi Web Push cho user đang mở app
--   → Không cần pg_net hay outbound HTTP
-- =============================================================================


-- BƯỚC 1a: Thêm cột last_attendance_reminder_sent vào bảng employees
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS last_attendance_reminder_sent TEXT DEFAULT '';

COMMENT ON COLUMN employees.last_attendance_reminder_sent IS 'Ngày (YYYY-MM-DD) lần cuối nhận thông báo điểm danh. Chống trùng trong ngày.';


-- BƯỚC 1b: Thêm cột notification_type vào bảng notifications
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS notification_type TEXT DEFAULT '';

COMMENT ON COLUMN notifications.notification_type IS 'Loại thông báo chi tiết (morning/afternoon cho attendance)';


-- BƯỚC 2: Enable pg_cron extension (không cần pg_net nữa)
CREATE EXTENSION IF NOT EXISTS pg_cron;


-- BƯỚC 3: Xóa cron jobs cũ (nếu có)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'attendance-morning-reminder') THEN
    PERFORM cron.unschedule('attendance-morning-reminder');
    RAISE NOTICE 'Đã xóa cron job cũ: attendance-morning-reminder';
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'attendance-afternoon-reminder') THEN
    PERFORM cron.unschedule('attendance-afternoon-reminder');
    RAISE NOTICE 'Đã xóa cron job cũ: attendance-afternoon-reminder';
  END IF;
END $$;


-- BƯỚC 4: Tạo function INSERT notification vào database
-- Hoàn toàn chạy trong SQL, không cần HTTP call

CREATE OR REPLACE FUNCTION trigger_attendance_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  today_str text;
  now_hour int;
  now_min int;
  total_min int;
  shift_type text := null;
  employee record;
  day_of_week int;
  date_mmdd text;
  notif_count int := 0;
  shift_label text;
  shift_content text;
  shift_detail text;
  shift_code text;
BEGIN
  -- Tính giờ Việt Nam (UTC+7)
  now_hour := (extract(hour from now()) + 7)::int % 24;
  now_min  := extract(minute from now())::int;
  total_min := now_hour * 60 + now_min;

  -- Kiểm tra giờ có nằm trong cửa sổ điểm danh không
  IF total_min >= 420 AND total_min <= 450 THEN      -- 07:00 - 07:30
    shift_type := 'morning';
  ELSIF total_min >= 750 AND total_min <= 780 THEN   -- 12:30 - 13:00
    shift_type := 'afternoon';
  ELSE
    RAISE NOTICE 'Không nằm trong cửa sổ giờ điểm danh (%:%)', now_hour, lpad(now_min::text, 2, '0');
    RETURN;
  END IF;

  -- Kiểm tra Chủ nhật
  day_of_week := extract(dow from now())::int;  -- 0=Sun
  IF day_of_week = 0 THEN
    RAISE NOTICE 'Chủ nhật - bỏ qua';
    RETURN;
  END IF;

  -- Kiểm tra ngày lễ
  date_mmdd := to_char(now(), 'DD/MM');
  IF date_mmdd IN ('01/01', '30/04', '01/05', '02/09') THEN
    RAISE NOTICE 'Ngày lễ % - bỏ qua', date_mmdd;
    RETURN;
  END IF;

  today_str := to_char(now(), 'YYYY-MM-DD');

  -- Chuẩn bị nội dung theo ca
  IF shift_type = 'morning' THEN
    shift_label := '⏰ Điểm danh Ca Sáng';
    shift_content := 'Sắp đến ca làm việc sáng (07:30). Hãy điểm danh vân tay/khuôn mặt ngay!';
    shift_detail := 'Ca làm việc chính thức: Sáng 07:30 - 11:30. Thời gian bắt đầu điểm danh: 07:00. Hãy thực hiện điểm danh sinh trắc học trên hệ thống ERP để ghi nhận công chuẩn.';
    shift_code := 'CA-SANG';
  ELSE
    shift_label := '⏰ Điểm danh Ca Chiều';
    shift_content := 'Sắp đến ca làm việc chiều (13:00). Hãy điểm danh vân tay/khuôn mặt!';
    shift_detail := 'Ca làm việc chính thức: Chiều 13:00 - 17:00. Thời gian bắt đầu điểm danh: 12:30. Hãy thực hiện điểm danh để không bị ghi nhận đi muộn.';
    shift_code := 'CA-CHIEU';
  END IF;

  -- Duyệt từng nhân viên active chưa nhận thông báo hôm nay
  FOR employee IN
    SELECT id, name, department FROM employees
    WHERE status = 'working'
      AND (last_attendance_reminder_sent IS NULL OR last_attendance_reminder_sent != today_str)
  LOOP
    -- INSERT in-app notification (Supabase Realtime sẽ tự push đến client)
    BEGIN
      INSERT INTO notifications (
        id, recipient_id, recipient_name, department,
        title, content, detailed_content, category,
        notification_type, sub_task_code, sender_name, sender_avatar,
        sender_id, read, created_at
      ) VALUES (
        'ATT-' || today_str || '-' || shift_code || '-' || substr(employee.id, 1, 10) || '-' || floor(random() * 900 + 100)::int,
        employee.id,
        employee.name,
        COALESCE(employee.department, 'Phòng Ban'),
        shift_label,
        shift_content,
        shift_detail,
        'attendance',
        shift_type,
        shift_code,
        'Phòng Hành Chính Nhân Sự',
        'NS',
        'system',
        false,
        now()
      );
      notif_count := notif_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Lỗi tạo notification cho %: %', employee.id, SQLERRM;
    END;

    -- Cập nhật last_attendance_reminder_sent (chống trùng)
    UPDATE employees
    SET last_attendance_reminder_sent = today_str
    WHERE id = employee.id;
  END LOOP;

  RAISE NOTICE '✅ Hoàn thành! Đã tạo % thông báo điểm danh %', notif_count, shift_type;
END;
$$;


-- BƯỚC 5: Tạo 2 cron jobs
-- Ca sáng:  07:00 VN = 00:00 UTC → '0 0 * * 1-6'
-- Ca chiều: 12:30 VN = 05:30 UTC → '30 5 * * 1-6'

SELECT cron.schedule(
  'attendance-morning-reminder',
  '0 0 * * 1-6',
  $$ SELECT trigger_attendance_reminders(); $$
);

SELECT cron.schedule(
  'attendance-afternoon-reminder',
  '30 5 * * 1-6',
  $$ SELECT trigger_attendance_reminders(); $$
);


-- BƯỚC 6: Verify
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname IN ('attendance-morning-reminder', 'attendance-afternoon-reminder')
ORDER BY jobname;


-- =============================================================================
-- TEST: Chạy thử ngay (không cần chờ cron)
-- =============================================================================
-- SELECT trigger_attendance_reminders();
--
-- Kiểm tra kết quả:
-- SELECT * FROM notifications WHERE category = 'attendance' ORDER BY created_at DESC LIMIT 10;
-- SELECT id, name, last_attendance_reminder_sent FROM employees WHERE last_attendance_reminder_sent != '';
-- =============================================================================
