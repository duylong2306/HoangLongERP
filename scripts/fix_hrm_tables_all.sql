-- ============================================================
-- FIX ALL HRM TABLES — Tạo lại bảng với đầy đủ cột flat
-- Chạy file này trong Supabase SQL Editor
-- ============================================================
-- ⚠️ CẢNH BÁO: DROP TABLE sẽ xóa dữ liệu cũ!
-- Nếu có dữ liệu quan trọng, export trước khi chạy.

-- Helper trigger (nếu chưa có)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. HRM SALARY SCALES (Thang lương)
-- ============================================================
DROP TABLE IF EXISTS public.hrm_salary_scales;
CREATE TABLE public.hrm_salary_scales (
  id                 TEXT PRIMARY KEY,
  group_code         TEXT DEFAULT '',
  group_name         TEXT DEFAULT '',
  group_desc         TEXT DEFAULT '',
  level              TEXT DEFAULT '',
  level_name         TEXT DEFAULT '',
  base_salary        NUMERIC DEFAULT 0,
  allocation_rate    NUMERIC DEFAULT 80,
  performance_salary NUMERIC DEFAULT 0,
  total_salary       NUMERIC DEFAULT 0,
  notes              TEXT DEFAULT '',
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.hrm_salary_scales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hrm_salary_scales_public_all" ON public.hrm_salary_scales FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_hrm_salary_scales_updated_at BEFORE UPDATE ON public.hrm_salary_scales
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 2. TRAVEL NORMS (Định mức công tác)
-- ============================================================
DROP TABLE IF EXISTS public.travel_norms;
CREATE TABLE public.travel_norms (
  id         TEXT PRIMARY KEY,
  code       TEXT DEFAULT '',
  content    TEXT DEFAULT '',
  quantity   NUMERIC DEFAULT 0,
  unit_price NUMERIC DEFAULT 0,
  notes      TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.travel_norms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "travel_norms_public_all" ON public.travel_norms FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_travel_norms_updated_at BEFORE UPDATE ON public.travel_norms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 3. HRM TRIPS (Chuyến công tác)
-- ============================================================
DROP TABLE IF EXISTS public.hrm_trips;
CREATE TABLE public.hrm_trips (
  id              TEXT PRIMARY KEY,
  emp_name        TEXT DEFAULT '',
  destination     TEXT DEFAULT '',
  purpose         TEXT DEFAULT '',
  from_date       TEXT DEFAULT '',
  to_date         TEXT DEFAULT '',
  status          TEXT DEFAULT 'pending',
  estimated_cost  NUMERIC DEFAULT 0,
  advance_amount  NUMERIC DEFAULT 0,
  settled_cost    NUMERIC DEFAULT 0,
  settle_status   TEXT DEFAULT 'draft',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.hrm_trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hrm_trips_public_all" ON public.hrm_trips FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_hrm_trips_updated_at BEFORE UPDATE ON public.hrm_trips
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 4. HRM PERFORMANCE CRITERIA (Tiêu chí đánh giá)
-- ============================================================
DROP TABLE IF EXISTS public.hrm_performance_criteria;
CREATE TABLE public.hrm_performance_criteria (
  id              TEXT PRIMARY KEY,
  department_code TEXT DEFAULT '',
  department_name TEXT DEFAULT '',
  criteria        TEXT DEFAULT '[]',  -- JSON array as TEXT
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.hrm_performance_criteria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hrm_performance_criteria_public_all" ON public.hrm_performance_criteria FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_hrm_performance_criteria_updated_at BEFORE UPDATE ON public.hrm_performance_criteria
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 5. HRM LEAVE COEFFICIENTS (Hệ số nghỉ phép)
-- ============================================================
DROP TABLE IF EXISTS public.hrm_leave_coefficients;
CREATE TABLE public.hrm_leave_coefficients (
  id           TEXT PRIMARY KEY,
  type         TEXT DEFAULT '',
  coefficient  NUMERIC DEFAULT 0,
  is_auto      BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.hrm_leave_coefficients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hrm_leave_coefficients_public_all" ON public.hrm_leave_coefficients FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_hrm_leave_coefficients_updated_at BEFORE UPDATE ON public.hrm_leave_coefficients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 6. HRM LEAVES (Đơn xin nghỉ phép)
-- ============================================================
DROP TABLE IF EXISTS public.hrm_leaves;
CREATE TABLE public.hrm_leaves (
  id                       TEXT PRIMARY KEY,
  emp_id                   TEXT DEFAULT '',
  emp_name                 TEXT DEFAULT '',
  type                     TEXT DEFAULT '',
  from_date                TEXT DEFAULT '',
  to_date                  TEXT DEFAULT '',
  days_count               NUMERIC DEFAULT 0,
  reason                   TEXT DEFAULT '',
  status                   TEXT DEFAULT 'pending',
  submitted_at             TEXT DEFAULT '',
  approver_name            TEXT DEFAULT '',
  approver_id              TEXT DEFAULT '',
  approver_position        TEXT DEFAULT '',
  is_attendance_correction BOOLEAN DEFAULT false,
  shift                    TEXT DEFAULT '',
  created_at               TIMESTAMPTZ DEFAULT now(),
  updated_at               TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.hrm_leaves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hrm_leaves_public_all" ON public.hrm_leaves FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_hrm_leaves_updated_at BEFORE UPDATE ON public.hrm_leaves
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 7. HRM PAYROLL RECORDS (Bảng lương)
-- ============================================================
DROP TABLE IF EXISTS public.hrm_payroll_records;
CREATE TABLE public.hrm_payroll_records (
  id                      TEXT PRIMARY KEY,
  blu_code                TEXT DEFAULT '',
  emp_id                  TEXT DEFAULT '',
  emp_name                TEXT DEFAULT '',
  month                   TEXT DEFAULT '',
  base_salary             NUMERIC DEFAULT 0,
  performance_salary      NUMERIC DEFAULT 0,
  kpi_score               NUMERIC DEFAULT 0,
  kpi_bonus               NUMERIC DEFAULT 0,
  salary_per_day          NUMERIC DEFAULT 0,
  day_salary              NUMERIC DEFAULT 0,
  worked_days             NUMERIC DEFAULT 0,
  ot_sunday               NUMERIC DEFAULT 0,
  ot_sunday_salary        NUMERIC DEFAULT 0,
  ot_holiday              NUMERIC DEFAULT 0,
  ot_holiday_salary       NUMERIC DEFAULT 0,
  ot_hours                NUMERIC DEFAULT 0,
  ot_count                NUMERIC DEFAULT 0,
  ot_hours_salary         NUMERIC DEFAULT 0,
  expenses                NUMERIC DEFAULT 0,
  bonus_holiday           NUMERIC DEFAULT 0,
  bonus_creative          NUMERIC DEFAULT 0,
  total_income            NUMERIC DEFAULT 0,
  insurance               NUMERIC DEFAULT 0,
  other_deductions        NUMERIC DEFAULT 0,
  advances                NUMERIC DEFAULT 0,
  net_salary              NUMERIC DEFAULT 0,
  status                  TEXT DEFAULT 'unpaid',
  allowance               NUMERIC DEFAULT 0,
  tax                     NUMERIC DEFAULT 0,
  kpi_max_allowed         NUMERIC DEFAULT 0,
  monthly_salary          NUMERIC DEFAULT 0,
  ot_weekend_salary       NUMERIC DEFAULT 0,
  ot_hourly_salary        NUMERIC DEFAULT 0,
  ot_allowance            NUMERIC DEFAULT 0,
  total_ot_hours_salary   NUMERIC DEFAULT 0,
  taxable_income          NUMERIC DEFAULT 0,
  taxable_net_income      NUMERIC DEFAULT 0,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.hrm_payroll_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hrm_payroll_records_public_all" ON public.hrm_payroll_records FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_hrm_payroll_records_updated_at BEFORE UPDATE ON public.hrm_payroll_records
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 8. HRM EMPLOYEE ERRORS (Lỗi nhân viên)
-- ============================================================
DROP TABLE IF EXISTS public.hrm_employee_errors;
CREATE TABLE public.hrm_employee_errors (
  id                 TEXT PRIMARY KEY,
  employee_id        TEXT DEFAULT '',
  employee_name      TEXT DEFAULT '',
  department_code    TEXT DEFAULT '',
  department_name    TEXT DEFAULT '',
  criterion_id       TEXT DEFAULT '',
  criterion_content  TEXT DEFAULT '',
  category           TEXT DEFAULT '',
  date               TEXT DEFAULT '',
  notes              TEXT DEFAULT '',
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.hrm_employee_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hrm_employee_errors_public_all" ON public.hrm_employee_errors FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_hrm_employee_errors_updated_at BEFORE UPDATE ON public.hrm_employee_errors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 9. HRM HOLIDAYS (Ngày lễ)
-- ============================================================
DROP TABLE IF EXISTS public.hrm_holidays;
CREATE TABLE public.hrm_holidays (
  id         TEXT PRIMARY KEY,
  date       TEXT DEFAULT '',
  name       TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.hrm_holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hrm_holidays_public_all" ON public.hrm_holidays FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_hrm_holidays_updated_at BEFORE UPDATE ON public.hrm_holidays
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
