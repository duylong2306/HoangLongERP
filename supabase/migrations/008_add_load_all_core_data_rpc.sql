-- RPC function: gộp tất cả bảng core thành 1 request duy nhất
-- Giảm 9 HTTP requests → 1 request, tăng tốc load trang đáng kể
-- Trả về JSON object chứa tất cả bảng: employees, customers, projects, tasks,
-- receipts, payments, quotes, business_profile, shift_config

CREATE OR REPLACE FUNCTION load_all_core_data()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'employees',        (SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) FROM employees e),
    'customers',        (SELECT COALESCE(jsonb_agg(c), '[]'::jsonb) FROM customers c),
    'projects',         (SELECT COALESCE(jsonb_agg(p), '[]'::jsonb) FROM projects p),
    'tasks',            (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM tasks t),
    'receipts',         (SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) FROM receipts r),
    'payments',         (SELECT COALESCE(jsonb_agg(py), '[]'::jsonb) FROM payments py),
    'quotes',           (SELECT COALESCE(jsonb_agg(q), '[]'::jsonb) FROM quotes q),
    'business_profile', (SELECT COALESCE(jsonb_agg(bp), '[]'::jsonb) FROM business_profile bp),
    'shift_config',     (SELECT COALESCE(jsonb_agg(sc), '[]'::jsonb) FROM shift_config sc)
  );
$$;

-- Grant quyền thực thi cho anonymous role (app dùng anon key)
GRANT EXECUTE ON FUNCTION load_all_core_data() TO anon;
GRANT EXECUTE ON FUNCTION load_all_core_data() TO authenticated;
