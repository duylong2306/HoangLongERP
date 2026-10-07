-- ============================================================================
-- Nhắc điểm danh ĐA DOANH NGHIỆP: viết lại hàm trigger_attendance_reminders() (pg_cron)
-- ============================================================================
-- Bản cũ (migration 006/007) viết cho 1 doanh nghiệp:
--   • đọc cấu hình ca bằng id = 'current' (nay id = company_id → không tìm thấy, mặc định chỉ Chủ nhật);
--   • lặp nhân viên của MỌI doanh nghiệp, ghi notifications KHÔNG có company_id (bị từ chối ở cơ sở dữ liệu → không có thông báo nào);
--   • UPDATE employees chỉ theo id (mã như emp_admin trùng giữa các công ty → đụng chéo công ty);
--   • ai có khóa anon công khai cũng gọi được hàm qua RPC (spam thông báo).
-- Bản mới: lặp qua từng doanh nghiệp ĐANG HOẠT ĐỘNG, mỗi doanh nghiệp dùng ngày nghỉ/ngày lễ của riêng nó, mọi truy vấn lọc company_id,
-- ghi notifications kèm company_id; lỗi ở 1 công ty không chặn công ty khác; chỉ service_role/pg_cron được gọi.
-- Hàm vẫn tên cũ nên 2 cron job hiện có (SELECT trigger_attendance_reminders();) không cần đổi. Có chế độ chạy thử p_dry_run = true
-- (chỉ đếm, không ghi gì) và p_force_window = true (bỏ qua giới hạn giờ, để thử ngoài khung 07:00–07:30 / 12:30–13:00).
--
-- Chỉ chạy trên project Supabase "LoLo". Chạy lại nhiều lần an toàn (idempotent).
-- ============================================================================

drop function if exists public.trigger_attendance_reminders();
drop function if exists public.trigger_attendance_reminders(boolean, boolean);

create or replace function public.trigger_attendance_reminders(p_dry_run boolean default false, p_force_window boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vn         timestamp := (now() at time zone 'Asia/Ho_Chi_Minh');   -- giờ Việt Nam
  v_min        int := extract(hour from v_vn)::int * 60 + extract(minute from v_vn)::int;
  v_shift      text;
  v_label      text; v_content text; v_detail text; v_code text;
  v_today      text := to_char(v_vn, 'YYYY-MM-DD');
  v_ddmm       text := to_char(v_vn, 'DD/MM');
  v_ddmmyyyy   text := to_char(v_vn, 'DD/MM/YYYY');
  v_dow        int  := extract(dow from v_vn)::int;                     -- 0 = Chủ nhật
  co           record;
  emp          record;
  v_weekend    integer[];
  v_count      int;
  v_result     jsonb := '[]'::jsonb;
  v_row        jsonb;
begin
  if v_min between 420 and 450 then v_shift := 'morning';             -- 07:00 - 07:30
  elsif v_min between 750 and 780 then v_shift := 'afternoon';        -- 12:30 - 13:00
  elsif p_force_window then v_shift := case when v_min < 600 then 'morning' else 'afternoon' end;
  else return jsonb_build_object('skipped', 'outside_time_window', 'vn_time', to_char(v_vn, 'HH24:MI'));
  end if;

  if v_shift = 'morning' then
    v_label := '⏰ Điểm danh Ca Sáng'; v_code := 'CA-SANG';
    v_content := 'Sắp đến ca làm việc sáng (07:30). Hãy điểm danh vân tay/khuôn mặt ngay!';
    v_detail := 'Ca làm việc chính thức: Sáng 07:30 - 11:30. Thời gian bắt đầu điểm danh: 07:00. Hãy thực hiện điểm danh sinh trắc học trước giờ làm để không bị ghi nhận đi muộn.';
  else
    v_label := '⏰ Điểm danh Ca Chiều'; v_code := 'CA-CHIEU';
    v_content := 'Sắp đến ca làm việc chiều (13:00). Hãy điểm danh vân tay/khuôn mặt!';
    v_detail := 'Ca làm việc chính thức: Chiều 13:00 - 17:00. Thời gian bắt đầu điểm danh: 12:30. Hãy thực hiện điểm danh để không bị ghi nhận đi muộn.';
  end if;

  -- Mỗi doanh nghiệp xử lý trong khối riêng: lỗi ở 1 công ty chỉ ghi nhận cho công ty đó
  for co in
    select c.id, c.slug from public.companies c
     where c.active and (c.expires_at is null or c.expires_at > now())
     order by c.created_at
  loop
    begin
      v_row := jsonb_build_object('company', co.slug);
      -- 1) ngày nghỉ cuối tuần theo cấu hình ca CỦA CÔNG TY (mặc định chỉ Chủ nhật)
      select s.weekend_days into v_weekend from public.shift_config s where s.company_id = co.id limit 1;
      if v_weekend is null or array_length(v_weekend, 1) is null then v_weekend := array[0]; end if;
      if v_dow = any(v_weekend) then
        v_result := v_result || (v_row || jsonb_build_object('skipped', 'weekend')); continue;
      end if;
      -- 2) ngày lễ của công ty
      if exists (select 1 from public.hrm_holidays h where h.company_id = co.id and (h.date = v_ddmm or h.date = v_ddmmyyyy)) then
        v_result := v_result || (v_row || jsonb_build_object('skipped', 'holiday')); continue;
      end if;

      v_count := 0;
      for emp in
        select e.id, e.name, e.department from public.employees e
         where e.company_id = co.id and e.status = 'working'
           and (e.last_attendance_reminder_sent is null or e.last_attendance_reminder_sent <> v_today)
      loop
        v_count := v_count + 1;
        if p_dry_run then continue; end if;
        begin
          insert into public.notifications (
            id, company_id, recipient_id, recipient_name, department, title, content, detailed_content, category,
            notification_type, sub_task_code, sender_name, sender_avatar, sender_id, read, created_at
          ) values (
            'ATT-' || v_today || '-' || v_code || '-' || substr(co.id::text, 1, 8) || '-' || substr(emp.id, 1, 10),
            co.id, emp.id, emp.name, coalesce(emp.department, 'Phòng Ban'), v_label, v_content, v_detail, 'attendance',
            v_shift, v_code, 'Phòng Hành Chính Nhân Sự', 'NS', 'system', false, now()
          ) on conflict do nothing;                                            -- đã có thông báo hôm nay (vd từ hàm Edge) → bỏ qua
        exception when others then
          raise notice 'Lỗi tạo thông báo cho % (%): %', emp.id, co.slug, sqlerrm;
        end;
        -- chống nhắc trùng: CHỈ nhân viên của đúng công ty này
        update public.employees set last_attendance_reminder_sent = v_today where company_id = co.id and id = emp.id;
      end loop;
      v_result := v_result || (v_row || jsonb_build_object('employees', v_count));
    exception when others then
      v_result := v_result || jsonb_build_object('company', co.slug, 'error', sqlerrm);
    end;
  end loop;

  return jsonb_build_object('shift', v_shift, 'dry_run', p_dry_run, 'vn_time', to_char(v_vn, 'HH24:MI'), 'companies', v_result);
end;
$$;

-- Chỉ pg_cron (chạy bằng quyền chủ sở hữu) và service_role được gọi — KHÔNG để người dùng/khóa anon gọi được qua RPC
revoke all on function public.trigger_attendance_reminders(boolean, boolean) from public, anon, authenticated;
grant execute on function public.trigger_attendance_reminders(boolean, boolean) to service_role;

-- Đặt lại 2 cron job (tên + lịch như cũ; hàm tự lọc giờ/ngày nghỉ). Bỏ qua nếu project chưa bật pg_cron.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule(jobname) from cron.job where jobname in ('attendance-morning-reminder', 'attendance-afternoon-reminder');
    perform cron.schedule('attendance-morning-reminder',   '0 0 * * 1-6',  'select public.trigger_attendance_reminders();');   -- 07:00 VN
    perform cron.schedule('attendance-afternoon-reminder', '30 5 * * 1-6', 'select public.trigger_attendance_reminders();');   -- 12:30 VN
  else
    raise notice 'Chưa bật extension pg_cron — hãy bật ở Database > Extensions rồi chạy lại migration này.';
  end if;
end $$;

-- KIỂM TRA SAU KHI CHẠY (an toàn, không ghi gì):
--   select public.trigger_attendance_reminders(true, true);       -- chạy thử: đếm số nhân viên sẽ được nhắc, theo từng doanh nghiệp
--   select jobname, schedule, active from cron.job where jobname like 'attendance-%';
