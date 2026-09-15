-- =============================================================================
-- Migration 007: Tắt thông báo nhắc nhở điểm danh vào NGÀY NGHỈ
-- (ngày nghỉ cuối tuần cấu hình trong tab "Cấu hình ca" + ngày lễ hrm_holidays)
-- Chạy trong Supabase Dashboard > SQL Editor
-- =============================================================================
-- Cơ chế:
--   Hàm trigger_attendance_reminders() (gọi bởi pg_cron) sẽ BỎ QUA việc tạo
--   notification nếu hôm nay là:
--     1. Ngày nghỉ cuối tuần (shift_config.weekend_days), HOẶC
--     2. Ngày lễ (bảng hrm_holidays, khớp cả DD/MM và DD/MM/YYYY)
-- LƯU Ý: KHÔNG tắt nút điểm danh (nhân viên vẫn làm ngày lễ).
-- =============================================================================

-- BƯỚC 1: Thay thế hàm trigger_attendance_reminders() với logic ngày nghỉ
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
  date_ddmm text;
  date_ddmmyyyy text;
  notif_count int := 0;
  shift_label text;
  shift_content text;
  shift_detail text;
  shift_code text;
  v_weekend integer[];
  v_is_rest_day boolean := false;
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

  -- ─── KIỂM TRA NGÀY NGHỈ (weekend_days từ shift_config + hrm_holidays) ───
  -- 1) Ngày nghỉ cuối tuần cấu hình (tab "Cấu hình ca")
  BEGIN
    SELECT weekend_days INTO v_weekend FROM shift_config WHERE id = 'current';
  EXCEPTION WHEN OTHERS THEN
    v_weekend := NULL;
  END;

  IF v_weekend IS NULL OR array_length(v_weekend, 1) IS NULL THEN
    v_weekend := ARRAY[0]; -- mặc định chỉ Chủ nhật
  END IF;

  day_of_week := extract(dow from now())::int;  -- 0=Sun ... 6=Sat (theo giờ VN tại giờ chạy cron)
  IF day_of_week = ANY(v_weekend) THEN
    RAISE NOTICE 'Ngày nghỉ cuối tuần (dow=%) - bỏ qua thông báo điểm danh', day_of_week;
    RETURN;
  END IF;

  -- 2) Ngày lễ từ bảng hrm_holidays (khớp cả DD/MM và DD/MM/YYYY)
  date_ddmm := to_char(now(), 'DD/MM');
  date_ddmmyyyy := to_char(now(), 'DD/MM/YYYY');

  IF EXISTS (
    SELECT 1 FROM hrm_holidays
    WHERE date = date_ddmm OR date = date_ddmmyyyy
  ) THEN
    RAISE NOTICE 'Ngày lễ % - bỏ qua thông báo điểm danh', date_ddmmyyyy;
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


-- BƯỚC 2: Đảm bảo 2 cron jobs vẫn đúng (không đổi lịch; hàm tự lọc ngày nghỉ)
-- Ca sáng:  07:00 VN = 00:00 UTC → '0 0 * * 1-6'
-- Ca chiều: 12:30 VN = 05:30 UTC → '30 5 * * 1-6'

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'attendance-morning-reminder') THEN
    PERFORM cron.unschedule('attendance-morning-reminder');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'attendance-afternoon-reminder') THEN
    PERFORM cron.unschedule('attendance-afternoon-reminder');
  END IF;
END $$;

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


-- BƯỚC 3: Verify
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname IN ('attendance-morning-reminder', 'attendance-afternoon-reminder')
ORDER BY jobname;


-- =============================================================================
-- TEST: Chạy thử ngay (không cần chờ cron)
--   - Ngày làm việc bình thường: tạo notification (notif_count > 0)
--   - Ngày nghỉ (weekend_days / hrm_holidays): in "Ngày nghỉ..." và notif_count = 0
-- =============================================================================
-- SELECT trigger_attendance_reminders();
--
-- Kiểm tra kết quả:
-- SELECT * FROM notifications WHERE category = 'attendance' ORDER BY created_at DESC LIMIT 10;
-- SELECT id, name, last_attendance_reminder_sent FROM employees WHERE last_attendance_reminder_sent != '';
-- =============================================================================
