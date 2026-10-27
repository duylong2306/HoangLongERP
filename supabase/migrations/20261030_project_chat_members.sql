-- ============================================================================
-- THÀNH VIÊN NHÓM CHAT DỰ ÁN — do CƠ SỞ DỮ LIỆU tự giữ đúng, không để từng máy ghi đè cả danh sách
-- ============================================================================
-- Vì sao: trước đây mỗi máy sửa bản copy danh sách thành viên trong bộ nhớ rồi GHI ĐÈ cả dòng hội thoại (cả khi chỉ gửi 1 tin nhắn),
-- nên bản copy cũ xóa mất người mới thêm; người chưa ở trong nhóm bấm "đồng bộ" thì ghi đè cả nhóm bằng nhóm mới chỉ có trưởng dự án.
--
-- Quy tắc mới (chủ dự án chọn):
--   • Thành viên nhóm dự án = trưởng dự án + người thuộc dự án + người được giao / người giao / người liên quan trong công việc
--     + người phụ trách / thành viên nhiệm vụ + GIÁM ĐỐC & QUẢN TRỊ (nhóm quyền loại "admin", Siêu Admin; KHÔNG gồm tài khoản kỹ thuật emp_admin).
--   • Ai bị gỡ khỏi dự án (không còn nằm trong các nguồn trên) → TỰ XÓA khỏi nhóm.
--   • Nhân viên NGHỈ VIỆC (status = 'retired') → tự xóa khỏi mọi nhóm / luồng thảo luận (không đụng hội thoại 1-1).
--   • Người được thêm TAY vào nhóm (nút "Thêm thành viên" trong chat) được giữ lại — cột auto_member_ids nhớ phần do hệ thống tự thêm,
--     phần còn lại coi là thêm tay và không bao giờ bị tự động gỡ (trừ khi nghỉ việc).
--
-- Chạy thủ công trong SQL Editor của project (có thể chạy lại nhiều lần). SAU KHI chạy, làm bước "SỬA DỮ LIỆU CŨ" ở cuối file.
-- Chưa chạy file này thì ứng dụng vẫn chạy bằng cách cũ (đã bỏ phần ghi đè nguy hiểm, xem chatStore.ts).
-- ============================================================================

alter table public.conversations add column if not exists auto_member_ids text[] not null default '{}';

-- Giám đốc & quản trị của 1 công ty: thành viên nhóm quyền "admin" (đúng như isRoleAdmin trong ứng dụng) + Siêu Admin.
-- LOẠI các tài khoản kỹ thuật emp_admin / NV_ADMIN / admin (tài khoản "Administrator" mặc định): chúng có nhóm quyền admin nhưng không phải người thật
-- làm việc trong dự án, thêm vào mọi nhóm chỉ gây nhiễu danh sách thành viên. (Nếu tài khoản đó thật sự có việc / là trưởng dự án thì vẫn vào nhóm theo nguồn khác.)
create or replace function public.project_chat_admin_ids(p_company uuid)
returns text[] language sql stable security definer set search_path = public as $$
  with ag as (
    select g.id, g.member_ids from public.hrm_role_groups g
     where g.company_id = p_company
       and (g.id in ('role_admin', 'role_superadmin')
            or coalesce((g.permissions -> '__role_kind__admin' ->> 'view')::boolean, false))
  )
  select coalesce(array_agg(distinct t.x) filter (where t.x is not null and t.x not in ('emp_admin', 'NV_ADMIN', 'admin')), '{}'::text[]) from (
    select unnest(member_ids) as x from ag
    union all
    select e.id from public.employees e
     where e.company_id = p_company
       and e.role_group_ids && (select coalesce(array_agg(id), '{}'::text[]) from ag)
  ) t;
$$;

-- Những ai PHẢI có trong nhóm chat của 1 dự án (bỏ người đã nghỉ việc và mã không phải nhân viên)
create or replace function public.project_chat_wanted_members(p_company uuid, p_project text)
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct s.id), '{}'::text[])
  from (
    select p.pm_id as id from public.projects p where p.company_id = p_company and p.id = p_project
    union all select unnest(p.involved_employee_ids) from public.projects p where p.company_id = p_company and p.id = p_project
    union all select t.assignee_id from public.tasks t where t.company_id = p_company and t.project_id = p_project
    union all select t.assigner_id from public.tasks t where t.company_id = p_company and t.project_id = p_project
    union all select unnest(t.involved_employee_ids) from public.tasks t where t.company_id = p_company and t.project_id = p_project
    union all select m.data ->> 'mainAssigneeId'
      from public.task_missions m join public.tasks t on t.company_id = m.company_id and t.id = m.task_id
     where m.company_id = p_company and t.project_id = p_project
    union all select jsonb_array_elements_text(case when jsonb_typeof(m.data -> 'memberIds') = 'array' then m.data -> 'memberIds' else '[]'::jsonb end)
      from public.task_missions m join public.tasks t on t.company_id = m.company_id and t.id = m.task_id
     where m.company_id = p_company and t.project_id = p_project
    union all select unnest(public.project_chat_admin_ids(p_company))
  ) s
  join public.employees e on e.company_id = p_company and e.id = s.id
  where s.id is not null and e.status is distinct from 'retired';
$$;

-- Tính danh sách thành viên MỚI của nhóm: (người thêm tay còn đi làm) + (người phải có). p_prune_existing = true: coi mọi người đang trong nhóm là
-- "tự thêm" (dùng khi sửa dữ liệu cũ để gỡ người không còn thuộc dự án).
create or replace function public.project_chat_new_members(p_company uuid, p_wanted text[], p_current text[], p_auto text[], p_prune_existing boolean)
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct y order by y), '{}'::text[]) from unnest(
    coalesce((
      select array_agg(x) from unnest(coalesce(p_current, '{}'::text[])) x
       where not p_prune_existing
         and not (x = any(coalesce(p_auto, '{}'::text[])))
         and not exists (select 1 from public.employees e where e.company_id = p_company and e.id = x and e.status = 'retired')
    ), '{}'::text[]) || coalesce(p_wanted, '{}'::text[])
  ) y;
$$;

-- Đồng bộ nhóm chat của 1 dự án (tạo nếu chưa có). KHÔNG BAO GIỜ ghi đè tin cuối / số chưa đọc của nhóm có sẵn.
create or replace function public.sync_project_chat_members(p_company uuid, p_project text, p_prune_existing boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_proj record; v_conv record; v_wanted text[]; v_new text[]; v_id text := 'conv_project_' || p_project;
begin
  select p.id, p.name, p.pm_id into v_proj from public.projects p where p.company_id = p_company and p.id = p_project;
  if not found then return; end if;                      -- dự án đã xóa: không tạo lại nhóm
  v_wanted := public.project_chat_wanted_members(p_company, p_project);
  select c.participant_ids, c.auto_member_ids into v_conv from public.conversations c where c.company_id = p_company and c.id = v_id for update;
  if not found then
    insert into public.conversations (id, company_id, type, name, avatar, color, participant_ids, auto_member_ids, created_by, created_at, unread_count, project_id, pinned, unread_counts)
    values (v_id, p_company, 'group', '📁 ' || coalesce(v_proj.name, ''), upper(left(coalesce(nullif(v_proj.name, ''), 'DA'), 2)), '#2AABEE',
            v_wanted, v_wanted, coalesce(v_proj.pm_id, ''), now(), 0, p_project, true, '{}'::jsonb)
    on conflict (company_id, id) do nothing;
    return;
  end if;
  v_new := public.project_chat_new_members(p_company, v_wanted, v_conv.participant_ids, v_conv.auto_member_ids, p_prune_existing);
  -- chỉ ghi khi có thay đổi thật (tránh bắn sự kiện thời gian thực vô ích tới mọi máy)
  if v_new is distinct from (select coalesce(array_agg(distinct z order by z), '{}'::text[]) from unnest(v_conv.participant_ids) z)
     or v_wanted is distinct from v_conv.auto_member_ids then
    update public.conversations set participant_ids = v_new, auto_member_ids = v_wanted where company_id = p_company and id = v_id;
  end if;
end $$;

create or replace function public.sync_all_project_chat_members(p_company uuid, p_prune_existing boolean default false)
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select id from public.projects where company_id = p_company loop
    perform public.sync_project_chat_members(p_company, r.id, p_prune_existing); n := n + 1;
  end loop;
  return n;
end $$;

-- XEM TRƯỚC (không ghi gì): mỗi dự án sẽ THÊM ai / GỠ ai khỏi nhóm
create or replace function public.preview_project_chat_members(p_company uuid, p_prune_existing boolean default false)
returns table (project_id text, project_name text, nhom_dang_co int, se_them text[], se_go text[]) language plpgsql security definer set search_path = public as $$
declare r record; v_wanted text[]; v_cur text[]; v_new text[]; c record;
begin
  for r in select p.id, p.name from public.projects p where p.company_id = p_company order by p.name loop
    v_wanted := public.project_chat_wanted_members(p_company, r.id);
    select cv.participant_ids, cv.auto_member_ids into c from public.conversations cv where cv.company_id = p_company and cv.id = 'conv_project_' || r.id;
    v_cur := coalesce(c.participant_ids, '{}'::text[]);
    v_new := public.project_chat_new_members(p_company, v_wanted, v_cur, c.auto_member_ids, p_prune_existing);
    project_id := r.id; project_name := r.name; nhom_dang_co := coalesce(array_length(v_cur, 1), 0);
    se_them := array(select unnest(v_new) except select unnest(v_cur));
    se_go := array(select unnest(v_cur) except select unnest(v_new));
    if coalesce(array_length(se_them, 1), 0) > 0 or coalesce(array_length(se_go, 1), 0) > 0 or c is null then return next; end if;
  end loop;
end $$;

-- ───────────── TRIGGER: dữ liệu dự án đổi → nhóm chat tự đổi theo ─────────────
-- (Mỗi hàm dưới đây tách riêng INSERT / UPDATE / DELETE bằng if lồng nhau: NEW không có khi xóa, OLD không có khi thêm — không được nhắc tới sai chỗ.)
create or replace function public.trg_pcm_projects() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.pm_id is not distinct from old.pm_id and new.involved_employee_ids is not distinct from old.involved_employee_ids then return null; end if;
  end if;
  perform public.sync_project_chat_members(new.company_id, new.id);
  return null;
end $$;
drop trigger if exists pcm_projects on public.projects;
create trigger pcm_projects after insert or update of pm_id, involved_employee_ids on public.projects for each row execute function public.trg_pcm_projects();

create or replace function public.trg_pcm_tasks() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.project_id is not null then perform public.sync_project_chat_members(old.company_id, old.project_id); end if;
    return null;
  end if;
  if tg_op = 'UPDATE' then
    if new.project_id is not distinct from old.project_id and new.assignee_id is not distinct from old.assignee_id
       and new.assigner_id is not distinct from old.assigner_id and new.involved_employee_ids is not distinct from old.involved_employee_ids then
      return null;
    end if;
    if old.project_id is not null and old.project_id is distinct from new.project_id then
      perform public.sync_project_chat_members(old.company_id, old.project_id);   -- chuyển công việc sang dự án khác: dự án cũ cũng phải tính lại
    end if;
  end if;
  if new.project_id is not null then perform public.sync_project_chat_members(new.company_id, new.project_id); end if;
  return null;
end $$;
drop trigger if exists pcm_tasks on public.tasks;
create trigger pcm_tasks after insert or delete or update of project_id, assignee_id, assigner_id, involved_employee_ids on public.tasks for each row execute function public.trg_pcm_tasks();

create or replace function public.trg_pcm_missions() returns trigger language plpgsql security definer set search_path = public as $$
declare v_pid text; v_co uuid; v_task text;
begin
  if tg_op = 'DELETE' then
    v_co := old.company_id; v_task := old.task_id;
  else
    v_co := new.company_id; v_task := new.task_id;
    if tg_op = 'UPDATE' then
      if (old.data ->> 'mainAssigneeId') is not distinct from (new.data ->> 'mainAssigneeId') and (old.data -> 'memberIds') is not distinct from (new.data -> 'memberIds') then
        return null;
      end if;
    end if;
  end if;
  select t.project_id into v_pid from public.tasks t where t.company_id = v_co and t.id = v_task;
  if v_pid is not null then perform public.sync_project_chat_members(v_co, v_pid); end if;
  return null;
end $$;
drop trigger if exists pcm_missions on public.task_missions;
create trigger pcm_missions after insert or delete or update of data on public.task_missions for each row execute function public.trg_pcm_missions();

-- Nhân viên: nghỉ việc → gỡ khỏi mọi nhóm / luồng; trở lại làm việc hoặc đổi nhóm quyền (có thể thành Giám đốc/quản trị) → tính lại mọi nhóm dự án
create or replace function public.trg_pcm_employees() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.status is not distinct from old.status and new.role_group_ids is not distinct from old.role_group_ids then return null; end if;
  end if;
  if new.status = 'retired' then
    update public.conversations set participant_ids = array_remove(participant_ids, new.id), auto_member_ids = array_remove(auto_member_ids, new.id)
     where company_id = new.company_id and type <> 'personal' and participant_ids @> array[new.id];
  elsif tg_op = 'UPDATE' then
    perform public.sync_all_project_chat_members(new.company_id);
  elsif coalesce(array_length(new.role_group_ids, 1), 0) > 0 then
    perform public.sync_all_project_chat_members(new.company_id);   -- nhân viên mới có nhóm quyền (có thể là Giám đốc) → vào các nhóm dự án
  end if;
  return null;
end $$;
drop trigger if exists pcm_employees on public.employees;
create trigger pcm_employees after insert or update of status, role_group_ids on public.employees for each row execute function public.trg_pcm_employees();

-- Nhóm quyền: đổi thành viên / loại nhóm (có thể thêm/bớt Giám đốc) → tính lại mọi nhóm dự án của công ty
create or replace function public.trg_pcm_role_groups() returns trigger language plpgsql security definer set search_path = public as $$
declare v_co uuid;
begin
  if tg_op = 'DELETE' then
    v_co := old.company_id;
  else
    v_co := new.company_id;
    if tg_op = 'UPDATE' then
      if new.member_ids is not distinct from old.member_ids and new.permissions is not distinct from old.permissions then return null; end if;
    end if;
  end if;
  perform public.sync_all_project_chat_members(v_co);
  return null;
end $$;
drop trigger if exists pcm_role_groups on public.hrm_role_groups;
create trigger pcm_role_groups after insert or delete or update of member_ids, permissions on public.hrm_role_groups for each row execute function public.trg_pcm_role_groups();

-- ───────────── HÀM ỨNG DỤNG GỌI (công ty lấy từ TOKEN đăng nhập, không tin tham số) ─────────────
create or replace function public.ensure_project_chat_group(p_project_id text)
returns setof public.conversations language plpgsql security definer set search_path = public as $$
declare v_co uuid := nullif(auth.jwt() ->> 'company_id', '')::uuid;
begin
  if v_co is null then raise exception 'Chưa đăng nhập'; end if;
  perform public.sync_project_chat_members(v_co, p_project_id);
  return query select * from public.conversations c where c.company_id = v_co and c.id = 'conv_project_' || p_project_id;
end $$;

-- Thêm thành viên vào 1 nhóm (thêm tay / luồng thảo luận / điểm danh): gộp vào danh sách hiện có NGAY TRÊN MÁY CHỦ, không ghi đè bản copy của máy
create or replace function public.add_conversation_members(p_conv_id text, p_member_ids text[])
returns text[] language plpgsql security definer set search_path = public as $$
declare v_co uuid := nullif(auth.jwt() ->> 'company_id', '')::uuid; v_new text[];
begin
  if v_co is null then raise exception 'Chưa đăng nhập'; end if;
  update public.conversations c
     set participant_ids = (select coalesce(array_agg(distinct y order by y), '{}'::text[]) from unnest(
           c.participant_ids || array(select x from unnest(coalesce(p_member_ids, '{}'::text[])) x
                                       where not exists (select 1 from public.employees e where e.company_id = v_co and e.id = x and e.status = 'retired'))) y)
   where c.company_id = v_co and c.id = p_conv_id and c.type <> 'personal'
   returning c.participant_ids into v_new;
  return v_new;
end $$;

-- Quyền gọi: hàm nội bộ chỉ cho chủ sở hữu; hai hàm ứng dụng cho người đã đăng nhập
revoke all on function public.project_chat_admin_ids(uuid), public.project_chat_wanted_members(uuid, text),
  public.project_chat_new_members(uuid, text[], text[], text[], boolean), public.sync_project_chat_members(uuid, text, boolean),
  public.sync_all_project_chat_members(uuid, boolean), public.preview_project_chat_members(uuid, boolean) from public, anon, authenticated;
revoke all on function public.ensure_project_chat_group(text), public.add_conversation_members(text, text[]) from public, anon;
grant execute on function public.ensure_project_chat_group(text), public.add_conversation_members(text, text[]) to authenticated;

-- ============================================================================
-- SỬA DỮ LIỆU CŨ (chạy SAU KHI chạy phần trên; file này KHÔNG tự chạy phần này)
-- ----------------------------------------------------------------------------
-- B1) Xem trước cho 1 công ty (thay mã công ty; cột se_them = sẽ thêm, se_go = sẽ gỡ). Mặc định CHỈ THÊM, không gỡ ai đang có:
--       select * from public.preview_project_chat_members('<mã công ty>');
--     Muốn xem cả việc GỠ người không còn thuộc dự án (coi mọi người đang trong nhóm là "tự thêm"):
--       select * from public.preview_project_chat_members('<mã công ty>', true);
-- B2) Áp dụng thật (chỉ thêm):                 select public.sync_all_project_chat_members('<mã công ty>');
--     Áp dụng thật (thêm + gỡ người thừa):     select public.sync_all_project_chat_members('<mã công ty>', true);
-- Danh sách mã công ty:  select id, slug from public.companies;
-- ============================================================================
