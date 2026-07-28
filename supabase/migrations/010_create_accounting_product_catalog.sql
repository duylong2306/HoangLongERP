-- Create accounting_product_catalog table for Finance module
-- This table stores product catalog items used in Sales Orders and Purchase Orders

CREATE TABLE IF NOT EXISTS accounting_product_catalog (
  id TEXT PRIMARY KEY,
  ten_san_pham TEXT NOT NULL,
  don_gia NUMERIC DEFAULT 0,
  don_vi_tinh TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE accounting_product_catalog ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access to accounting_product_catalog"
  ON accounting_product_catalog FOR SELECT
  TO public
  USING (true);

-- Allow authenticated users to insert/update/delete
CREATE POLICY "Allow authenticated users to manage accounting_product_catalog"
  ON accounting_product_catalog FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create index for faster searches
CREATE INDEX IF NOT EXISTS idx_accounting_product_catalog_ten_san_pham
  ON accounting_product_catalog(ten_san_pham);
