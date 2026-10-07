-- ============================================================================
-- Trang quản trị nền tảng: NHIỀU TÀI KHOẢN + NHẬT KÝ THAO TÁC (giữ 30 ngày)
-- ============================================================================
-- (A) platform_admins.is_owner — chủ nền tảng: chỉ tài khoản này tạo/khóa/đặt lại mật khẩu cho tài khoản khác.
--     Tài khoản tạo sớm nhất hiện có được đặt làm chủ (chỉ khi CHƯA có chủ nào) → chạy lại không đổi gì.
-- (B) platform_audit_logs — ai đã đổi gì, lúc nào. KHÔNG có chính sách RLS nào → chỉ máy chủ (service_role) đọc/ghi;
--     không có API sửa/xóa, chỉ có xóa tự động bản ghi quá 30 ngày (api/_audit.ts → purgeOldAudit).
--
-- Chỉ chạy trên project Supabase "LoLo". Chạy lại nhiều lần an toàn (idempotent).
-- Sau khi xóa script tạo tài khoản, tài khoản mới tạo ngay trên trang quản trị (tab "Tài khoản").
-- Trường hợp khẩn cấp (mất hết quyền vào trang quản trị): can thiệp thẳng DB bằng SQL (đặt lại password_hash bằng hash bcrypt cost 12).
-- ============================================================================

alter table public.platform_admins add column if not exists is_owner boolean not null default false;

update public.platform_admins
   set is_owner = true
 where id = (select id from public.platform_admins order by created_at asc, username asc limit 1)
   and not exists (select 1 from public.platform_admins where is_owner);

create table if not exists public.platform_audit_logs (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  admin_id       uuid,                       -- không ràng buộc khóa ngoại: log vẫn giữ nguyên dù tài khoản sau này bị xóa
  admin_username text not null,
  action         text not null,              -- vd: companies.update, plans.save, accounts.create, login ...
  target_type    text,                       -- company | plan | order | setting | account ...
  target_id      text,
  summary        text not null,              -- mô tả ngắn tiếng Việt
  detail         jsonb,                      -- trước/sau (đã loại mật khẩu/hash/token)
  ip_hash        text
);
create index if not exists idx_platform_audit_created on public.platform_audit_logs (created_at desc);
create index if not exists idx_platform_audit_admin   on public.platform_audit_logs (admin_username, created_at desc);
alter table public.platform_audit_logs enable row level security;
