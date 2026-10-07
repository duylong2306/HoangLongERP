-- ============================================================================
-- Thanh toán QR + mô tả chi tiết gói
-- ============================================================================
-- (A) plans.features  — danh sách "được nhận / không được nhận" hiển thị ở bảng giá & trang thanh toán:
--                       [{ "text": "Quản lý dự án", "included": true }, ...] (tối đa 30 dòng, kiểm tra ở api/_subscription.ts)
--     plans.badge     — nhãn nổi bật trên thẻ gói (vd "Phổ biến nhất"), tối đa 20 ký tự.
-- (B) subscription_orders.paid_claimed_at       — lúc khách bấm "Xác nhận chuyển khoản thành công" (chờ quản trị duyệt).
--     subscription_orders.telegram_notified_at  — lúc đã gửi được tin nhắn Telegram báo quản trị (null = chưa gửi được → cho gửi lại).
--
-- Chỉ chạy trên project Supabase "LoLo". Chạy lại nhiều lần an toàn (idempotent).
-- ============================================================================
alter table public.plans add column if not exists features jsonb not null default '[]'::jsonb;
alter table public.plans add column if not exists badge    text  not null default '';

alter table public.subscription_orders add column if not exists paid_claimed_at      timestamptz;
alter table public.subscription_orders add column if not exists telegram_notified_at timestamptz;
