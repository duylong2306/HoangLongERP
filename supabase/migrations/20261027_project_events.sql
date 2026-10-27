-- NHẬT KÝ HOẠT ĐỘNG DỰ ÁN: mỗi sự kiện của dự án / công việc / nhiệm vụ / đề xuất là 1 dòng (ai, làm gì, đổi từ → sang).
-- Thay cho việc gửi tin "hệ thống" vào nhóm chat dự án (nhóm chat chỉ còn để thảo luận).
-- Chạy thủ công trong Supabase SQL Editor (không có công cụ migration tự động).
-- CHƯA chạy thì ứng dụng vẫn hoạt động như cũ: các tin hệ thống tiếp tục gửi vào nhóm chat (xem lib/projectEvents.ts).
create table if not exists public.project_events (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null,
  project_id  text not null,
  -- công việc / nhiệm vụ liên quan (nếu có) — để mở "Lịch sử" riêng của 1 công việc
  task_id     text,
  mission_id  text,
  actor_id    text,
  actor_name  text,
  -- loại sự kiện: tao | giao | tt (trạng thái) | han (hạn/ưu tiên) | duyet | tc (tài chính) | xoa | khac
  type        text not null default 'khac',
  -- đối tượng: project | task | mission | proposal | payment | material
  obj_kind    text,
  obj_name    text,
  -- 1 câu tóm tắt cho dòng thời gian; detail = phần chi tiết thêm (nhiều dòng)
  text        text not null,
  detail      text,
  -- giá trị cũ → mới (nếu sự kiện đổi 1 giá trị)
  from_val    text,
  to_val      text,
  created_at  timestamptz not null default now()
);

create index if not exists project_events_project_time on public.project_events (company_id, project_id, created_at desc);
create index if not exists project_events_task_time    on public.project_events (company_id, task_id, created_at desc) where task_id is not null;

-- Cô lập theo doanh nghiệp (cùng mẫu với các bảng khác — xem 20260928c_enable_rls_tenant_isolation.sql)
alter table public.project_events enable row level security;
drop policy if exists "tenant_isolation_project_events" on public.project_events;
create policy "tenant_isolation_project_events" on public.project_events
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
