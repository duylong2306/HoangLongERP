-- MỐC "ĐÃ XEM NHẬT KÝ ĐẾN LÚC NÀO" của từng người, theo từng dự án — để hiện số hoạt động mới (chấm số + dải "Cập nhật mới").
-- Chạy thủ công trong Supabase SQL Editor, SAU 20261027_project_events.sql.
-- CHƯA chạy thì ứng dụng vẫn bình thường, chỉ là không hiện chấm số / dải cập nhật mới (xem lib/projectEventReads.ts).
create table if not exists public.project_event_reads (
  company_id    uuid not null,
  user_id       text not null,
  project_id    text not null,
  last_seen_at  timestamptz not null default now(),
  primary key (company_id, user_id, project_id)
);

-- Cô lập theo doanh nghiệp (cùng mẫu với project_events)
alter table public.project_event_reads enable row level security;
drop policy if exists "tenant_isolation_project_event_reads" on public.project_event_reads;
create policy "tenant_isolation_project_event_reads" on public.project_event_reads
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
