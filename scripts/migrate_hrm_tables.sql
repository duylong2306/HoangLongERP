-- ============================================================
-- Hoàng Long ERP — HRM Additional Tables
-- Chuyển localStorage HRM sang Supabase
-- ============================================================

-- 1. HRM TRIPS (Chuyến công tác)
CREATE TABLE IF NOT EXISTS public.hrm_trips (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data          JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.hrm_trips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hrm_trips_public_all" ON public.hrm_trips;
CREATE POLICY "hrm_trips_public_all" ON public.hrm_trips FOR ALL USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_hrm_trips_updated_at ON public.hrm_trips;
CREATE TRIGGER trg_hrm_trips_updated_at BEFORE UPDATE ON public.hrm_trips FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. HRM PERFORMANCE CRITERIA (Tiêu chí đánh giá)
CREATE TABLE IF NOT EXISTS public.hrm_performance_criteria (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data          JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.hrm_performance_criteria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hrm_performance_criteria_public_all" ON public.hrm_performance_criteria;
CREATE POLICY "hrm_performance_criteria_public_all" ON public.hrm_performance_criteria FOR ALL USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_hrm_performance_criteria_updated_at ON public.hrm_performance_criteria;
CREATE TRIGGER trg_hrm_performance_criteria_updated_at BEFORE UPDATE ON public.hrm_performance_criteria FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. HRM SALARY SCALES (Thang lương)
CREATE TABLE IF NOT EXISTS public.hrm_salary_scales (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data          JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.hrm_salary_scales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hrm_salary_scales_public_all" ON public.hrm_salary_scales;
CREATE POLICY "hrm_salary_scales_public_all" ON public.hrm_salary_scales FOR ALL USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_hrm_salary_scales_updated_at ON public.hrm_salary_scales;
CREATE TRIGGER trg_hrm_salary_scales_updated_at BEFORE UPDATE ON public.hrm_salary_scales FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. TRAVEL NORMS (Định mức công tác)
CREATE TABLE IF NOT EXISTS public.travel_norms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data          JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.travel_norms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "travel_norms_public_all" ON public.travel_norms;
CREATE POLICY "travel_norms_public_all" ON public.travel_norms FOR ALL USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_travel_norms_updated_at ON public.travel_norms;
CREATE TRIGGER trg_travel_norms_updated_at BEFORE UPDATE ON public.travel_norms FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. KANBAN COLUMNS (Cài đặt cột Kanban — thay localStorage)
CREATE TABLE IF NOT EXISTS public.kanban_columns (
  sector        TEXT PRIMARY KEY,
  columns       JSONB NOT NULL DEFAULT '[]',
  column_width  INTEGER DEFAULT 280,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.kanban_columns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kanban_columns_public_all" ON public.kanban_columns;
CREATE POLICY "kanban_columns_public_all" ON public.kanban_columns FOR ALL USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_kanban_columns_updated_at ON public.kanban_columns;
CREATE TRIGGER trg_kanban_columns_updated_at BEFORE UPDATE ON public.kanban_columns FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6. ACCOUNTING SUB-CONTRACTS (Hợp đồng thầu phụ kế toán — thay localStorage hl_acc_subcontracts)
CREATE TABLE IF NOT EXISTS public.accounting_sub_contracts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data          JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.accounting_sub_contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "accounting_sub_contracts_public_all" ON public.accounting_sub_contracts;
CREATE POLICY "accounting_sub_contracts_public_all" ON public.accounting_sub_contracts FOR ALL USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_accounting_sub_contracts_updated_at ON public.accounting_sub_contracts;
CREATE TRIGGER trg_accounting_sub_contracts_updated_at BEFORE UPDATE ON public.accounting_sub_contracts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 7. ACCOUNTING LIABILITIES (Công nợ tùy chỉnh kế toán — thay localStorage hl_acc_custom_liabilities)
CREATE TABLE IF NOT EXISTS public.accounting_liabilities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data          JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.accounting_liabilities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "accounting_liabilities_public_all" ON public.accounting_liabilities;
CREATE POLICY "accounting_liabilities_public_all" ON public.accounting_liabilities FOR ALL USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_accounting_liabilities_updated_at ON public.accounting_liabilities;
CREATE TRIGGER trg_accounting_liabilities_updated_at BEFORE UPDATE ON public.accounting_liabilities FOR EACH ROW EXECUTE FUNCTION set_updated_at();
