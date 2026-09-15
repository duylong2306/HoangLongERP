-- Bảng display_settings (Cấu Hình Giao Diện — màu chủ đạo, logo, tên thương
-- hiệu, slogan, tiêu đề dashboard, câu động lực, font chữ). Bảng này được code
-- (src/lib/dbService.ts -> displaySettings.get/save) tham chiếu từ trước
-- nhưng CHƯA TỪNG có migration tạo bảng — mọi lần lưu ở "Cấu Hình Giao Diện"
-- đều âm thầm lỗi (bị nuốt qua console.warn) vì bảng không tồn tại.
CREATE TABLE IF NOT EXISTS public.display_settings (
  id                TEXT PRIMARY KEY,
  primary_accent    TEXT,
  logo_text         TEXT,
  brand_name        TEXT,
  brand_slogan      TEXT,
  dashboard_title   TEXT,
  motivation_quote  TEXT,
  font_family       TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- Chỉ lưu 1 bản ghi duy nhất (id = 'current'), giống business_profile/shift_config
CREATE UNIQUE INDEX IF NOT EXISTS idx_display_settings_single
  ON public.display_settings ((id = 'current'));

ALTER TABLE public.display_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "display_settings_public_all" ON public.display_settings;
CREATE POLICY "display_settings_public_all"
  ON public.display_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Dùng lại function set_updated_at() đã có sẵn (tạo ở migration business_profile/shift_config)
DROP TRIGGER IF EXISTS trg_display_settings_updated_at ON public.display_settings;
CREATE TRIGGER trg_display_settings_updated_at
  BEFORE UPDATE ON public.display_settings
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
