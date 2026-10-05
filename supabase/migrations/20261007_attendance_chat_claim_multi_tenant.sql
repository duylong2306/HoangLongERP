-- ============================================================================
-- Multi-tenant: vá RPC claim_attendance_chat + bảng attendance_chat_notified.
-- Lỗi cũ (single-tenant):
--   1) PK (date, slot) → công ty thứ 2 không "claim" được vì đã bị công ty 1 giữ.
--   2) INSERT không có company_id (cột NOT NULL từ migration 20260928) → lỗi,
--      client nuốt im lặng → tin nhắc "Điểm danh" không bao giờ gửi.
--   3) shift_config đọc id='current' — sau 20260930 id = company_id::text → không
--      khớp, mặc định cuối tuần luôn là Chủ nhật.
--   4) hrm_holidays không lọc công ty → ngày lễ công ty khác làm công ty này
--      mất tin nhắc (rò rỉ chéo).
-- Vá: PK ghép (company_id, date, slot); hàm lấy company_id từ JWT, lọc đúng
-- công ty ở mọi truy vấn. Không có company_id trong JWT (anon) → không làm gì.
-- Chữ ký hàm giữ nguyên nên client (chatStore.ts) không phải sửa.
-- CHỈ CHẠY TRÊN STAGING.
-- ============================================================================
begin;

alter table public.attendance_chat_notified drop constraint if exists attendance_chat_notified_pkey;
alter table public.attendance_chat_notified add primary key (company_id, date, slot);

create or replace function claim_attendance_chat(
  p_date   text,
  p_slot   text,
  p_emp_id text
)
returns setof public.attendance_chat_notified
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_weekend integer[];
  v_day_of_week int;
  v_date_ddmm text;
  v_date_ddmmyyyy text;
begin
  -- Công ty của người đang gọi (JWT tự cấp từ api/login.ts). Thiếu → bỏ qua.
  begin
    v_company := (auth.jwt() ->> 'company_id')::uuid;
  exception when others then
    v_company := null;
  end;
  if v_company is null then
    return;
  end if;

  -- Ngày nghỉ cuối tuần: cấu hình ca CỦA CÔNG TY NÀY (id = company_id::text)
  begin
    select weekend_days into v_weekend from shift_config
     where company_id = v_company limit 1;
  exception when others then
    v_weekend := null;
  end;
  if v_weekend is null or array_length(v_weekend, 1) is null then
    v_weekend := array[0]; -- mặc định chỉ Chủ nhật
  end if;

  v_day_of_week := extract(dow from p_date::date)::int;
  if v_day_of_week = any(v_weekend) then
    return; -- ngày nghỉ → không trả row → client không gửi tin
  end if;

  -- Ngày lễ CỦA CÔNG TY NÀY (khớp cả DD/MM và DD/MM/YYYY)
  v_date_ddmm     := to_char(p_date::date, 'DD/MM');
  v_date_ddmmyyyy := to_char(p_date::date, 'DD/MM/YYYY');
  if exists (
    select 1 from hrm_holidays
     where company_id = v_company
       and (date = v_date_ddmm or date = v_date_ddmmyyyy)
  ) then
    return;
  end if;

  -- Claim nguyên tử theo (company_id, date, slot): chỉ người đầu tiên của
  -- công ty đó nhận được row.
  return query
    insert into public.attendance_chat_notified (company_id, date, slot, notified_by)
    values (v_company, p_date, p_slot, p_emp_id)
    on conflict (company_id, date, slot) do nothing
    returning *;
end;
$$;

grant execute on function claim_attendance_chat(text, text, text) to authenticated;
grant execute on function claim_attendance_chat(text, text, text) to service_role;
-- Bỏ quyền của anon: multi-tenant bắt buộc có JWT công ty.
revoke execute on function claim_attendance_chat(text, text, text) from anon;

commit;
