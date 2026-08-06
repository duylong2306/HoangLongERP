-- ============================================================================
-- Cố định 2 lỗi 500 trong console (chạy 1 lần trong Supabase SQL Editor):
--   1) POST /rest/v1/rpc/load_all_core_data  -> 500
--   2) GET  /rest/v1/attendance_records?date=gte..&date=lte.. -> 500 (statement timeout)
--
-- ĐỒNG THỜI: RPC trả về ĐỦ 13 bảng app đọc từ cloudData (bao gồm cả
-- sales_orders, purchase_orders, suppliers, subcontractor_advances bị thiếu
-- ở migration 028 cũ) → không còn warning "thiếu sales_orders/purchase_orders"
-- và không mất suppliers khi RPC thành công.
--
-- Chạy toàn bộ script này trong Supabase Dashboard > SQL Editor, rồi nhấn "Run".
-- Idempotent: có thể chạy lại nhiều lần.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- (A) Index trên attendance_records(date) để range-scan + sort không bị timeout
--     (cột date là TEXT, nhưng định dạng 'YYYY-MM-DD' nên sort từ điển = thứ tự thời gian)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_attendance_records_date
  ON public.attendance_records (date);

-- ---------------------------------------------------------------------------
-- (B) Viết lại load_all_core_data() chạy với SECURITY DEFINER (quyền owner)
--     + bọc riêng business_profile / shift_config trong EXCEPTION để không sập hàm.
--     Trả về ĐỦ 13 bảng: employees, customers, projects, tasks, receipts,
--     payments, quotes, sales_orders, purchase_orders, suppliers,
--     subcontractor_advances, business_profile, shift_config.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION load_all_core_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bp jsonb;
  v_sc jsonb;
BEGIN
  -- 2 bảng CHỈ xuất hiện trong RPC: bọc riêng, lỗi → [] (không sập hàm)
  BEGIN
    SELECT COALESCE(jsonb_agg(bp), '[]'::jsonb)
      INTO v_bp
      FROM business_profile bp;
  EXCEPTION WHEN OTHERS THEN
    v_bp := '[]'::jsonb;
  END;

  BEGIN
    SELECT COALESCE(jsonb_agg(sc), '[]'::jsonb)
      INTO v_sc
      FROM shift_config sc;
  EXCEPTION WHEN OTHERS THEN
    v_sc := '[]'::jsonb;
  END;

  RETURN jsonb_build_object(
    'employees',               (SELECT COALESCE(jsonb_agg(e),  '[]'::jsonb) FROM employees e),
    'customers',               (SELECT COALESCE(jsonb_agg(c),  '[]'::jsonb) FROM customers c),
    'projects',                (SELECT COALESCE(jsonb_agg(p),  '[]'::jsonb) FROM projects p),
    'tasks',                   (SELECT COALESCE(jsonb_agg(t),  '[]'::jsonb) FROM tasks t),
    'receipts',                (SELECT COALESCE(jsonb_agg(r),  '[]'::jsonb) FROM receipts r),
    'payments',                (SELECT COALESCE(jsonb_agg(py), '[]'::jsonb) FROM payments py),
    'quotes',                  (SELECT COALESCE(jsonb_agg(q),  '[]'::jsonb) FROM quotes q),
    'sales_orders',            (SELECT COALESCE(jsonb_agg(so), '[]'::jsonb) FROM sales_orders so),
    'purchase_orders',         (SELECT COALESCE(jsonb_agg(po), '[]'::jsonb) FROM purchase_orders po),
    'suppliers',               (SELECT COALESCE(jsonb_agg(s),  '[]'::jsonb) FROM suppliers s),
    'subcontractor_advances',  (SELECT COALESCE(jsonb_agg(sa), '[]'::jsonb) FROM subcontractor_advances sa),
    'business_profile', v_bp,
    'shift_config',     v_sc
  );
END;
$$;

-- Cho phép anon / authenticated gọi RPC (app dùng anon key)
GRANT EXECUTE ON FUNCTION load_all_core_data() TO anon;
GRANT EXECUTE ON FUNCTION load_all_core_data() TO authenticated;

-- ---------------------------------------------------------------------------
-- (C) Reload schema cache của PostgREST để nhận hàm mới (vô hại nếu không có listener)
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
