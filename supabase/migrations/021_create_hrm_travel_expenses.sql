-- =============================================================================
-- Migration 021: Bảng hrm_travel_expenses (Tổng hợp Công Tác Phí từ nhiệm vụ)
-- Lưu các mục THCTP (Tổng hợp Công Tác Phí) được sinh ra khi người dùng bấm
-- "Xác Nhận Hoàn Thành" một nhiệm vụ thi công CÓ Công Tác Phí chuyến đi, trong
-- cửa sổ CHI TIẾT NHIỆM VỤ THI CÔNG.
-- Dùng cột data jsonb (đồng bộ pattern với hrm_trips / hrm_performance_criteria):
--   id uuid PK, data jsonb (chứa toàn bộ object THCTP), created_at, updated_at.
-- Không bật RLS (giống hrm_trips) vì app dùng anon key toàn cục.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.hrm_travel_expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hrm_travel_expenses_pkey PRIMARY KEY (id)
);

-- Bật Realtime để đồng bộ đa thiết bị (mirror hrm_trips)
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.hrm_travel_expenses';
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;
