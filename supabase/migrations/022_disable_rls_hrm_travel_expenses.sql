-- =============================================================================
-- Migration 022: TẮT RLS cho bảng hrm_travel_expenses
-- -----------------------------------------------------------------------------
-- App dùng anon key toàn cục để truy cập Supabase (pattern chung của toàn bộ
-- project). Các bảng cùng nhóm (purchase_orders - migration 009, sales_orders
-- - migration 015) đều dùng:  ALTER TABLE ... DISABLE ROW LEVEL SECURITY;
-- Migration 021 ĐÃ TẠO bảng nhưng QUÊN thực thi lệnh tắt RLS, chỉ ghi chú
-- "Không bật RLS (giống hrm_trips)" ở comment. Do Supabase mặc định BẬT RLS
-- cho mọi bảng mới, anon key bị chặn INSERT/UPDATE, gây lỗi:
--   "new row violates row-level security policy for table hrm_travel_expenses"
-- → Công Tác Phí không lưu được lên Supabase (chỉ lưu localStorage).
--
-- Migration này TẮT RLS cho hrm_travel_expenses để khớp thiết kế ban đầu và
-- đồng bộ với các bảng khác dùng anon key.
-- Idempotent: chạy lại nhiều lần không lỗi.
-- =============================================================================

ALTER TABLE IF EXISTS public.hrm_travel_expenses DISABLE ROW LEVEL SECURITY;
