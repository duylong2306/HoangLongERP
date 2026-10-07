-- ============================================================================
-- GỠ ĐÓNG BĂNG GHI trên PRODUCTION Hoàng Long CŨ — hoàn tác scripts/production-freeze.sql (dùng khi quay lại hệ thống cũ)
-- ============================================================================
-- Xóa các chính sách freeze_ins / freeze_upd / freeze_del và đặt lại 2 lịch nhắc điểm danh (giờ pg_cron tính theo UTC):
--   • attendance-morning-reminder   : 00:00 UTC = 07:00 giờ VN, thứ Hai–thứ Bảy
--   • attendance-afternoon-reminder : 05:30 UTC = 12:30 giờ VN, thứ Hai–thứ Bảy
-- ⛔ CHỈ chạy ở project PRODUCTION cũ (dừng nếu thấy bảng companies). Chạy lại nhiều lần an toàn.
-- ============================================================================

do $$
declare t record; n int := 0;
begin
  if to_regclass('public.companies') is not null then
    raise exception 'DỪNG: có bảng public.companies — đây là LoLo, KHÔNG phải production cũ.';
  end if;

  for t in select distinct schemaname, tablename from pg_policies where policyname in ('freeze_ins', 'freeze_upd', 'freeze_del') loop
    execute format('drop policy if exists freeze_ins on %I.%I', t.schemaname, t.tablename);
    execute format('drop policy if exists freeze_upd on %I.%I', t.schemaname, t.tablename);
    execute format('drop policy if exists freeze_del on %I.%I', t.schemaname, t.tablename);
    n := n + 1;
  end loop;

  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule(jobname) from cron.job where jobname in ('attendance-morning-reminder', 'attendance-afternoon-reminder');
    perform cron.schedule('attendance-morning-reminder',   '0 0 * * 1-6',  'select trigger_attendance_reminders();');
    perform cron.schedule('attendance-afternoon-reminder', '30 5 * * 1-6', 'select trigger_attendance_reminders();');
  end if;
  raise notice 'ĐÃ GỠ ĐÓNG BĂNG: % bảng (kể cả Storage); lịch nhắc điểm danh đã đặt lại.', n;
end $$;

-- KIỂM TRA: phải ra 0 dòng (không còn chính sách đóng băng nào)
select schemaname, tablename, policyname from pg_policies where policyname in ('freeze_ins', 'freeze_upd', 'freeze_del');
