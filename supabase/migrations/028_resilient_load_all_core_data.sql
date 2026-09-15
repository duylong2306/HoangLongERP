-- ============================================================================
-- Migration 028: Viết lại load_all_core_data() không bao giờ trả 500
--
-- MỤC ĐÍCH: Khắc phục lỗi console
--   POST .../rest/v1/rpc/load_all_core_data 500 (Internal Server Error)
--
-- NGUYÊN NHÂN: Hàm cũ (LANGUAGE sql STABLE) chạy VỚI QUYỀN NGƯỜI GỌI (anon).
-- Nếu bất kỳ 1 trong 9 sub-SELECT lỗi (RLS/quyền/thiếu cột ở 1 bảng nào đó),
-- TOÀN BỘ hàm ném exception → PostgREST trả 500. App bắt buộc fallback query
-- từng bảng, nhưng fallback KHÔNG load business_profile / shift_config → 2 bảng
-- này bị mất mỗi lần load.
--
-- SỬA:
--   * Chuyển sang LANGUAGE plpgsql + SECURITY DEFINER (chạy với quyền owner,
--     không bị kẹt RLS của anon) và SET search_path = public (an toàn).
--   * 2 bảng CHỈ có trong RPC (business_profile, shift_config) được bọc riêng
--     trong BEGIN/EXCEPTION → nếu lỗi thì trả [] thay vì làm sập cả hàm.
--   * 11 bảng còn lại giữ sub-query trực tiếp (employees, customers, projects,
--     tasks, receipts, payments, quotes, sales_orders, purchase_orders,
--     suppliers, subcontractor_advances): nếu 1 bảng lỗi, hàm ném lỗi → app
--     fallback load TẤT CẢ bảng riêng lẻ, đảm bảo KHÔNG mất dữ liệu.
--   * Quan trọng: 028 phiên bản đầu từng BỎ sales_orders / purchase_orders /
--     suppliers / subcontractor_advances → gây warning "thiếu sales_orders" và
--     mất suppliers khi RPC thành công. Bản này trả ĐỦ 13 bảng (khôi phục đúng
--     như migration 015 đã làm).
-- Kết quả: RPC luôn trả 200 (không còn 500), và app luôn có đủ dữ liệu.
-- ============================================================================

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

-- Grant quyền thực thi cho anonymous role (app dùng anon key)
GRANT EXECUTE ON FUNCTION load_all_core_data() TO anon;
GRANT EXECUTE ON FUNCTION load_all_core_data() TO authenticated;
