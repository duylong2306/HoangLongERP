-- Menu "Tài Chính - Kế Toán" load rất chậm: cột payments.images (mảng base64
-- ảnh sao kê/biên lai, có thể tới hàng trăm KB/phiếu) được tải kèm TOÀN BỘ
-- phiếu chi trong hệ thống ngay lúc khởi động app (qua RPC load_all_core_data()
-- bên dưới) và dùng cho MỌI tab của Tài Chính (Nhập Chi, Công nợ, Tổng hợp...)
-- dù phần lớn tab không hiển thị ảnh — gây payload khởi động rất nặng.
--
-- FIX: loại `images` khỏi kết quả mặc định, thay bằng `image_count` (chỉ 1 số
-- nguyên) để UI vẫn hiển thị đúng badge/số lượng/trạng thái "Hoàn Thành" —
-- ảnh đầy đủ được tải RIÊNG, LƯỜI (dbService.payments.getImages/getFull) chỉ
-- khi người dùng thực sự mở xem/sửa chứng từ. Áp dụng ở CẢ 2 đường tải:
--   1. RPC load_all_core_data() — đường tải CHÍNH lúc khởi động app.
--   2. Computed column payments_image_count() — dùng cho payments.list() JS
--      (đường fallback khi RPC lỗi) qua PostgREST computed-columns feature.

-- 1. Computed column cho PostgREST: cho phép .select('...,image_count:payments_image_count')
--    mà KHÔNG cần kéo cột images thật sự về client (Postgres tính array_length ngay
--    trong DB, chỉ số nguyên kết quả mới được trả về qua mạng).
CREATE OR REPLACE FUNCTION public.payments_image_count(p public.payments)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(array_length(p.images, 1), 0);
$$;

GRANT EXECUTE ON FUNCTION public.payments_image_count(public.payments) TO anon;
GRANT EXECUTE ON FUNCTION public.payments_image_count(public.payments) TO authenticated;

-- 2. RPC load_all_core_data(): giữ nguyên toàn bộ hàm — chỉ đổi cách build
--    field 'payments' để loại bỏ 'images' và thêm 'image_count'.
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
    'tasks',                   (
      SELECT COALESCE(jsonb_agg(
        to_jsonb(t) || jsonb_build_object('missions', COALESCE(tm.missions, '[]'::jsonb))
      ), '[]'::jsonb)
      FROM tasks t
      LEFT JOIN (
        SELECT task_id, jsonb_agg(data) AS missions
        FROM task_missions
        GROUP BY task_id
      ) tm ON tm.task_id = t.id
    ),
    'receipts',                (SELECT COALESCE(jsonb_agg(r),  '[]'::jsonb) FROM receipts r),
    -- 'images' (base64, nặng) bị loại khỏi payload khởi động — thay bằng
    -- 'image_count' (số nguyên). Ảnh đầy đủ tải riêng khi mở chi tiết 1 phiếu.
    'payments',                (
      SELECT COALESCE(jsonb_agg(
        (to_jsonb(py) - 'images') || jsonb_build_object('image_count', COALESCE(array_length(py.images, 1), 0))
      ), '[]'::jsonb)
      FROM payments py
    ),
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

GRANT EXECUTE ON FUNCTION load_all_core_data() TO anon;
GRANT EXECUTE ON FUNCTION load_all_core_data() TO authenticated;
