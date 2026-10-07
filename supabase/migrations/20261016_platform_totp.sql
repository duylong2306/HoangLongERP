-- ============================================================================
-- Xác thực hai lớp (TOTP — Google Authenticator) cho tài khoản quản trị nền tảng
-- ============================================================================
-- totp_secret      : khóa bí mật đã MÃ HÓA (AES-256-GCM, khóa mã hóa suy ra từ SUPABASE_JWT_SECRET). Có giá trị nhưng
--                    totp_enabled = false nghĩa là đang chờ quản trị viên nhập mã đầu tiên để xác nhận bật.
-- totp_enabled     : true = đăng nhập phải nhập thêm mã 6 số.
-- totp_recovery    : danh sách BĂM của các mã khôi phục còn dùng được (mỗi mã dùng 1 lần).
-- totp_last_step   : bước thời gian (30 giây) của mã đã dùng gần nhất — chống dùng lại cùng một mã.
-- Chỉ chạy trên project Supabase "LoLo". Chạy lại nhiều lần an toàn (idempotent).
-- ============================================================================
alter table public.platform_admins add column if not exists totp_secret    text;
alter table public.platform_admins add column if not exists totp_enabled   boolean not null default false;
alter table public.platform_admins add column if not exists totp_recovery  jsonb   not null default '[]'::jsonb;
alter table public.platform_admins add column if not exists totp_last_step bigint  not null default 0;
