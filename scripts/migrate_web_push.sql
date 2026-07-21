-- ============================================================
-- Hoàng Long ERP — Web Push Subscriptions Table
-- Thay thế bảng fcm_tokens của Firebase
-- ============================================================

-- Bảng lưu web push subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL,
  endpoint      TEXT NOT NULL,
  p256dh        TEXT NOT NULL,
  auth          TEXT NOT NULL,
  platform      TEXT DEFAULT 'web',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Index cho user_id để query nhanh
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON public.push_subscriptions (user_id);

-- Unique index: mỗi user chỉ có 1 subscription
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_user_unique
  ON public.push_subscriptions (user_id);

-- RLS policies (giống attendance_records)
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "push_subscriptions_public_all" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_public_all"
  ON public.push_subscriptions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger cập nhật updated_at tự động
DROP TRIGGER IF EXISTS trg_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER trg_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();