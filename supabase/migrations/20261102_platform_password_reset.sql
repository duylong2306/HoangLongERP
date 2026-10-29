-- ============================================================================
-- QUÊN MẬT KHẨU TRANG QUẢN TRỊ NỀN TẢNG (lolo.io.vn/quantri): gửi liên kết đặt lại về email.
--
--  • platform_admins.email      — email nhận liên kết đặt lại mật khẩu (duy nhất, không phân biệt hoa/thường). Quản trị viên chưa
--                                 có email thì KHÔNG dùng được "Quên mật khẩu" (chủ nền tảng đặt lại tay như trước).
--  • platform_password_resets   — mỗi lần yêu cầu = 1 dòng. CHỈ lưu BĂM (sha256) của mã trong liên kết, không lưu mã gốc;
--                                 mã sống 30 phút, dùng 1 lần.
-- Bảng bật RLS và không có policy → chỉ máy chủ (service_role, api/platform.ts) truy cập.
--
-- CHỈ CHẠY TRÊN PROJECT "LoLo". Idempotent — chạy lại không lỗi.
-- ============================================================================
begin;

alter table public.platform_admins add column if not exists email text;
create unique index if not exists uq_platform_admins_email on public.platform_admins (lower(email)) where email is not null;

create table if not exists public.platform_password_resets (
  id         uuid primary key default gen_random_uuid(),
  admin_id   uuid not null references public.platform_admins(id) on delete cascade,
  token_hash text not null unique,
  ip_hash    text not null default '',
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_platform_pw_reset_admin_time on public.platform_password_resets (admin_id, created_at desc);
create index if not exists idx_platform_pw_reset_ip_time    on public.platform_password_resets (ip_hash, created_at desc);
alter table public.platform_password_resets enable row level security;

commit;
