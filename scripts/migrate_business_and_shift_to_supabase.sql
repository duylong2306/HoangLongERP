/**
 * Supabase migration: business_profile and shift_config tables
 * Stores business profile info and shift configuration in Supabase
 */

-- Function to auto-update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Business Profile Table
CREATE TABLE IF NOT EXISTS public.business_profile (
  id            TEXT PRIMARY KEY,
  company_name  TEXT NOT NULL,
  tax_code      TEXT,
  representative TEXT,
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  founding_year TEXT,
  business_sector TEXT,
  bank_info     TEXT,
  scale         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Unique index for single business profile (we'll store only one record)
CREATE UNIQUE INDEX IF NOT EXISTS idx_business_profile_single
  ON public.business_profile ((id = 'current'));

-- Shift Config Table
CREATE TABLE IF NOT EXISTS public.shift_config (
  id            TEXT PRIMARY KEY,
  morning_in    TEXT DEFAULT '07:30',
  morning_out   TEXT DEFAULT '11:30',
  afternoon_in  TEXT DEFAULT '13:00',
  afternoon_out TEXT DEFAULT '17:00',
  overtime_in   TEXT DEFAULT '17:45',
  overtime_out  TEXT DEFAULT '20:45',
  gps_radius_allowed INTEGER DEFAULT 50,
  anti_fake_cam BOOLEAN DEFAULT true,
  punch_open_before_minutes INTEGER DEFAULT 15,
  punch_close_after_minutes INTEGER DEFAULT 15,
  punch_out_open_before_minutes INTEGER DEFAULT 15,
  punch_out_close_after_minutes INTEGER DEFAULT 15,
  ot_punch_open_before_minutes INTEGER DEFAULT 15,
  ot_punch_close_after_minutes INTEGER DEFAULT 15,
  ot_punch_out_open_before_minutes INTEGER DEFAULT 15,
  ot_punch_out_close_after_minutes INTEGER DEFAULT 15,
  allowed_late_minutes INTEGER DEFAULT 15,
  weekend_days INTEGER[] DEFAULT '{0}',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Unique index for single shift config (we'll store only one record)
CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_config_single
  ON public.shift_config ((id = 'current'));

-- RLS policies (same as attendance_records)
ALTER TABLE public.business_profile ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "business_profile_public_all" ON public.business_profile;
CREATE POLICY "business_profile_public_all"
  ON public.business_profile
  FOR ALL
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.shift_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shift_config_public_all" ON public.shift_config;
CREATE POLICY "shift_config_public_all"
  ON public.shift_config
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at (reuse existing function)
DROP TRIGGER IF EXISTS trg_business_profile_updated_at ON public.business_profile;
CREATE TRIGGER trg_business_profile_updated_at
  BEFORE UPDATE ON public.business_profile
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_shift_config_updated_at ON public.shift_config;
CREATE TRIGGER trg_shift_config_updated_at
  BEFORE UPDATE ON public.shift_config
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();