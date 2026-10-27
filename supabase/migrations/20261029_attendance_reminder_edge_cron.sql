-- ============================================================================
-- NHẮC ĐIỂM DANH QUA WEB PUSH — pg_cron gọi hàm Edge `send-attendance-reminders` mỗi 5 phút
-- ============================================================================
-- Vì sao đổi: hàm SQL cũ trigger_attendance_reminders() chỉ ghi vào bảng `notifications` (ứng dụng không đọc bảng này, không gửi
-- thông báo đẩy) và đánh dấu cả công ty là "đã nhắc" ngay lúc 07:00, nên đợt nhắc buổi chiều cũng bị chặn. Nay hàm Edge là nguồn duy nhất:
-- tự đọc GIỜ VÀO CA từng công ty trong cấu hình ca (shift_config), nhắc đúng lúc mở điểm danh, ca sáng / ca chiều độc lập.
--
-- THỨ TỰ LÀM (làm đủ 3 bước, thiếu bước 1 thì file này tự dừng và báo lỗi, không đặt lịch hỏng):
--   1) Triển khai lại hàm Edge (trên máy có Supabase CLI), cho đúng project:
--        npx supabase functions deploy send-attendance-reminders --project-ref <mã project>
--      (hàm cần 2 biến VAPID_PRIVATE_KEY / VAPID_PUBLIC_KEY như hàm send-push — đã có sẵn nếu send-push đang chạy được)
--   2) Trong SQL Editor của project, cất địa chỉ project + khóa service_role vào Vault (chạy 1 lần, thay 2 giá trị):
--        select vault.create_secret('https://<mã project>.supabase.co', 'attendance_project_url');
--        select vault.create_secret('<khóa service_role của project>', 'attendance_service_key');
--      (khóa service_role KHÔNG được dán vào file này hay vào mã nguồn)
--   3) Chạy file này.
-- Chạy lại nhiều lần an toàn (idempotent). Chỉ chạy trên project Supabase đang chạy thật.
-- ============================================================================

create extension if not exists pg_net;
create extension if not exists pg_cron;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'attendance_project_url')
     or not exists (select 1 from vault.decrypted_secrets where name = 'attendance_service_key') then
    raise exception 'Chưa có bí mật attendance_project_url / attendance_service_key trong Vault — làm bước 2 ở đầu file rồi chạy lại.';
  end if;
end $$;

do $$
begin
  -- Bỏ 2 lịch cũ gọi hàm SQL (chỉ ghi bảng notifications) và lịch mới nếu đã có
  perform cron.unschedule(jobname) from cron.job
   where jobname in ('attendance-morning-reminder', 'attendance-afternoon-reminder', 'attendance-reminder-edge');
  -- Mỗi 5 phút: hàm Edge tự xét từng công ty xem có đang trong cửa sổ nhắc (giờ vào ca − số phút mở điểm danh) không; ngoài cửa sổ thì dừng ngay
  perform cron.schedule('attendance-reminder-edge', '*/5 * * * *', $cmd$
    select net.http_post(
      url     := (select decrypted_secret from vault.decrypted_secrets where name = 'attendance_project_url') || '/functions/v1/send-attendance-reminders',
      headers := jsonb_build_object('Content-Type', 'application/json',
                   'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'attendance_service_key')),
      body    := '{}'::jsonb,
      timeout_milliseconds := 20000
    );
  $cmd$);
end $$;

-- KIỂM TRA 1: phải thấy đúng 1 dòng 'attendance-reminder-edge', active = true (và KHÔNG còn 2 job attendance-morning/afternoon-reminder)
select jobname, schedule, active from cron.job where jobname like 'attendance-%' order by jobname;
-- KIỂM TRA 2 (sau vài phút): lượt gọi gần nhất phải 'succeeded'; nội dung trả về của hàm Edge xem ở bảng net._http_response
--   select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
--   select status_code, content::text from net._http_response order by created desc limit 3;
