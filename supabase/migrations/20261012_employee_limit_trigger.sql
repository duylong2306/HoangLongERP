-- ============================================================================
-- GIỚI HẠN SỐ NHÂN VIÊN THEO GÓI — chặn ở tầng cơ sở dữ liệu (không lách được bằng cách bỏ qua giao diện).
--
-- Quy tắc: khi THÊM nhân viên MỚI vào 1 doanh nghiệp, nếu số nhân viên hiện có đã ĐẠT giới hạn thì từ chối:
--   • đang dùng gói (companies.plan_id)  → giới hạn = plans.max_employees;
--   • đang dùng thử (is_trial)           → giới hạn = platform_settings 'trial'.maxEmployees;
--   • không giới hạn / giới hạn null     → không chặn (doanh nghiệp cũ như Hoàng Long không bị ảnh hưởng).
-- Phụ thuộc migration 20261011_platform_admin_subscriptions.sql (phải chạy TRƯỚC).
--
-- ⚠️ ỨNG DỤNG LƯU NHÂN VIÊN BẰNG UPSERT (INSERT ... ON CONFLICT DO UPDATE): trigger BEFORE INSERT vẫn chạy cả khi dòng
-- sau đó thành UPDATE. Nên nếu nhân viên (company_id, id) ĐÃ TỒN TẠI thì cho qua — nếu không, doanh nghiệp đã đạt giới hạn
-- sẽ không sửa được bất kỳ nhân viên nào. Chỉ chặn khi thật sự là nhân viên MỚI.
-- Đếm tất cả dòng employees của công ty (kể cả nhân viên đã nghỉ).
--
-- CHỈ CHẠY TRÊN PROJECT "LoLo" (nền tảng đa doanh nghiệp). KHÔNG chạy trên production Hoàng Long cũ.
-- Idempotent. Gỡ bỏ: drop trigger trg_enforce_employee_limit on public.employees;
-- ============================================================================
create or replace function public.enforce_employee_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan  text;
  v_trial boolean;
  v_max   integer;
  v_count bigint;
begin
  -- Nhân viên đã tồn tại → đây là cập nhật (qua upsert), không phải thêm mới
  if exists (select 1 from public.employees e where e.company_id = new.company_id and e.id = new.id) then
    return new;
  end if;

  select c.plan_id, c.is_trial into v_plan, v_trial from public.companies c where c.id = new.company_id;

  if v_plan is not null then
    select p.max_employees into v_max from public.plans p where p.id = v_plan;
  elsif coalesce(v_trial, false) then
    select nullif(s.value->>'maxEmployees', '')::integer into v_max from public.platform_settings s where s.key = 'trial';
  end if;

  if v_max is null then
    return new;   -- không giới hạn
  end if;

  select count(*) into v_count from public.employees e where e.company_id = new.company_id;
  if v_count >= v_max then
    raise exception 'EMPLOYEE_LIMIT_REACHED: Đã đạt giới hạn % nhân viên của gói dịch vụ. Vui lòng nâng cấp gói để thêm nhân viên.', v_max
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_employee_limit on public.employees;
create trigger trg_enforce_employee_limit
  before insert on public.employees
  for each row execute function public.enforce_employee_limit();
