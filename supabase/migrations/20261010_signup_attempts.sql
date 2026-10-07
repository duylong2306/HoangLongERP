-- ============================================================================
-- Giai đoạn 2 (đăng ký doanh nghiệp công khai): bảng ghi nhận lượt đăng ký để GIỚI HẠN SỐ LẦN theo IP
-- (api/register-company.ts: tối đa 3 lượt/giờ và 10 lượt/ngày cho mỗi IP).
--
-- Chỉ lưu BĂM của IP (sha256 + muối) — không lưu IP thật, chỉ để đếm.
-- Bảng này chỉ máy chủ (service_role) đọc/ghi: bật RLS và KHÔNG tạo policy nào → anon/authenticated
-- (khóa công khai trong trình duyệt) không đọc/ghi được gì.
--
-- CHỈ CHẠY TRÊN PROJECT "LoLo" (staging/nền tảng đa doanh nghiệp). KHÔNG chạy trên production Hoàng Long cũ.
-- Idempotent — chạy lại không lỗi.
-- ============================================================================
create table if not exists public.signup_attempts (
  id         uuid primary key default gen_random_uuid(),
  ip_hash    text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_signup_attempts_ip_time on public.signup_attempts (ip_hash, created_at desc);

alter table public.signup_attempts enable row level security;
-- (cố ý không có policy nào)

-- Dọn các lượt cũ hơn 7 ngày — chạy tay khi cần (không cần cho hoạt động bình thường, chỉ để bảng không phình):
--   delete from public.signup_attempts where created_at < now() - interval '7 days';
