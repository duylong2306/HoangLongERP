-- Nhật ký THAY ĐỔI PHÂN QUYỀN của từng doanh nghiệp: ai đổi, lúc nào, vùng nào, đổi gì (từ → sang).
-- Ghi từ màn hình Phân Quyền Và Vai Trò mỗi khi bấm "Lưu thay đổi" (nhóm vai trò, Quyền Dự Án theo vị trí / theo nhóm HRM, Quyền Phê Duyệt).
-- Chạy thủ công trong Supabase SQL Editor (không có công cụ migration tự động). Chưa chạy thì ứng dụng vẫn lưu phân quyền bình thường,
-- chỉ là chưa có nhật ký (màn "Nhật ký" sẽ báo chưa bật).
create table if not exists public.permission_audit_log (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null,
  actor_id    text,
  actor_name  text,
  -- vùng thay đổi: role_group | project_position | project_group | approval
  area        text not null,
  -- đối tượng bị đổi (VD tên nhóm vai trò) — để lọc/hiển thị nhanh
  target      text,
  -- 1 câu tóm tắt cho danh sách (VD "Kế toán: +3 quyền, −1 quyền")
  summary     text,
  -- chi tiết: mảng {label, from, to}
  changes     jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists permission_audit_log_company_time
  on public.permission_audit_log (company_id, created_at desc);

-- Cô lập theo doanh nghiệp (cùng mẫu với các bảng khác — xem 20260928c_enable_rls_tenant_isolation.sql)
alter table public.permission_audit_log enable row level security;
drop policy if exists "tenant_isolation_permission_audit_log" on public.permission_audit_log;
create policy "tenant_isolation_permission_audit_log" on public.permission_audit_log
  for all to authenticated
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
