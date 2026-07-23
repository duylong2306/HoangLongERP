-- ============================================================
-- Hoàng Long ERP — Hỗ trợ Push Notification đa thiết bị
-- Bỏ unique constraint trên user_id, cho phép nhiều subscription
-- ============================================================

-- 1. Xóa unique index cũ (mỗi user chỉ 1 subscription)
DROP INDEX IF EXISTS public.idx_push_subscriptions_user_unique;

-- 2. Tạo unique index trên endpoint (mỗi endpoint chỉ 1 lần)
--    + index thường trên user_id (đã có sẵn idx_push_subscriptions_user_id)
DROP INDEX IF EXISTS public.idx_push_subscriptions_endpoint_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint_unique
  ON public.push_subscriptions (endpoint);

-- 3. (Optional) Xóa các subscription trùng endpoint nếu có
--    Giữ lại subscription mới nhất (updated_at lớn nhất)
DELETE FROM public.push_subscriptions
WHERE id NOT IN (
  SELECT DISTINCT ON (endpoint) id
  FROM public.push_subscriptions
  ORDER BY endpoint, updated_at DESC
);

-- ============================================================
-- HOÀN THÀNH!
-- Sau migration: mỗi user có thể có nhiều subscription (nhiều thiết bị)
-- ============================================================
