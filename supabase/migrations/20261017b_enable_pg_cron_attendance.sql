-- ============================================================================
-- Bật pg_cron + đặt lịch nhắc điểm danh trên project LoLo
-- ============================================================================
-- Migration 20261017 đã tạo hàm trigger_attendance_reminders() nhưng bỏ qua bước đặt lịch vì project LoLo CHƯA bật pg_cron
-- (lỗi: relation "cron.job" does not exist). File này bật extension rồi đặt 2 lịch chạy (giờ pg_cron tính theo UTC):
--   • attendance-morning-reminder   : 00:00 UTC = 07:00 giờ Việt Nam, thứ Hai–thứ Bảy
--   • attendance-afternoon-reminder : 05:30 UTC = 12:30 giờ Việt Nam, thứ Hai–thứ Bảy
-- (Hàm tự bỏ qua ngày nghỉ cuối tuần và ngày lễ của TỪNG công ty, nên Chủ nhật/ngày lễ không gửi.)
-- Chỉ chạy trên project Supabase "LoLo". Chạy lại nhiều lần an toàn (idempotent).
-- Nếu câu `create extension` báo thiếu quyền: bật bằng giao diện — Database → Extensions → tìm "pg_cron" → bật — rồi chạy tiếp từ khối `do`.
-- ============================================================================

create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule(jobname) from cron.job where jobname in ('attendance-morning-reminder', 'attendance-afternoon-reminder');
  perform cron.schedule('attendance-morning-reminder',   '0 0 * * 1-6',  'select public.trigger_attendance_reminders();');
  perform cron.schedule('attendance-afternoon-reminder', '30 5 * * 1-6', 'select public.trigger_attendance_reminders();');
end $$;

-- KIỂM TRA: phải thấy 2 dòng, active = true
select jobname, schedule, active from cron.job where jobname like 'attendance-%' order by jobname;
