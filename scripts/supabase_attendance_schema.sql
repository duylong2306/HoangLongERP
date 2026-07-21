-- ============================================================
-- Hoàng Long ERP 3.9 — Supabase Attendance Table Schema
-- Chạy trong Supabase SQL Editor (dashboard) hoặc qua psql.
-- ============================================================

-- Bảng lưu bản ghi chấm công (tương đương localStorage hl_hrm_attendance_v3)
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id            TEXT PRIMARY KEY,
  emp_id        TEXT NOT NULL,
  emp_name      TEXT,
  date          TEXT NOT NULL,                 -- YYYY-MM-DD (local Vietnam)

  -- Ca sáng
  time_in_s     TEXT DEFAULT '--:--',
  time_out_s    TEXT DEFAULT '--:--',
  -- Ca chiều
  time_in_c     TEXT DEFAULT '--:--',
  time_out_c    TEXT DEFAULT '--:--',
  -- Tăng ca
  time_in_ot    TEXT DEFAULT '--:--',
  time_out_ot   TEXT DEFAULT '--:--',

  method        TEXT,                           -- VD: "GPS/FaceID (Công trình Blue Sky)"
  status        TEXT DEFAULT 'valid',          -- valid | late | excused | unexcused | missing | invalid
  ot_hours      REAL DEFAULT 0,
  notes         TEXT,

  -- Sinh trắc & vị trí
  photo_in      TEXT,
  location_in   TEXT,
  coords_in     TEXT,
  photo_out     TEXT,
  location_out  TEXT,
  coords_out    TEXT,

  is_locked     BOOLEAN DEFAULT FALSE,         -- true = đã chốt công
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Unique (nhân viên + ngày) để tránh trùng lặp bản ghi
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_emp_date
  ON public.attendance_records (emp_id, date);

-- Index phục vụ dashboard giám đốc (đếm theo ngày)
CREATE INDEX IF NOT EXISTS idx_attendance_date
  ON public.attendance_records (date);

-- RLS: mở toàn bộ quyền đọc/ghi (app dùng anon key, chưa có auth user).
-- CẢNH BÁO: Nếu sau này bật Supabase Auth, hãy thu hẹp policy này.
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_public_all" ON public.attendance_records;
CREATE POLICY "attendance_public_all"
  ON public.attendance_records
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger cập nhật updated_at tự động
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_attendance_updated_at ON public.attendance_records;
CREATE TRIGGER trg_attendance_updated_at
  BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
