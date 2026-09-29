-- ============================================================================
-- HOTFIX NGHIÊM TRỌNG (Giai đoạn 7): RPC load_all_core_data() SECURITY DEFINER
-- bỏ qua RLS hoàn toàn — trả về dữ liệu của MỌI công ty cho bất kỳ ai gọi,
-- bất kể JWT/company_id. Hàm này được tạo TRƯỚC dự án multi-tenant (gộp 9
-- request đầu trang thành 1 RPC cho nhanh) và chưa từng được cập nhật khi
-- bật RLS ở Giai đoạn 3.
--
-- Phát hiện qua test thực tế: tạo công ty B (Giai đoạn 7), gọi thẳng RPC này
-- bằng JWT của công ty B → vẫn nhận được customers/suppliers/purchase_orders
-- thật của Hoàng Long (99/97/239 dòng) dù REST API bảng thường
-- (/rest/v1/suppliers...) với ĐÚNG JWT đó trả về đúng [] (RLS hoạt động bình
-- thường ở đường REST trực tiếp — chỉ riêng RPC này bị bỏ qua).
--
-- Vá: thêm `where company_id = (auth.jwt() ->> 'company_id')::uuid` cho toàn
-- bộ 12 bảng bên trong (giữ nguyên SECURITY DEFINER vì hàm cần đọc
-- business_profile/shift_config trước khi có JWT ở 1 số luồng cũ — nhưng từ
-- nay TỰ lọc company_id thay vì dựa vào RLS bị bỏ qua).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.load_all_core_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid;
  v_bp jsonb;
  v_sc jsonb;
BEGIN
  -- Đọc company_id từ JWT của request hiện tại. NULL nếu chưa đăng nhập/JWT
  -- không hợp lệ — khi đó mọi bảng trả về rỗng thay vì lỗi hoặc rò rỉ dữ liệu.
  BEGIN
    v_company_id := (auth.jwt() ->> 'company_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_company_id := NULL;
  END;

  BEGIN
    SELECT COALESCE(jsonb_agg(bp), '[]'::jsonb)
      INTO v_bp
      FROM business_profile bp
      WHERE bp.company_id = v_company_id;
  EXCEPTION WHEN OTHERS THEN
    v_bp := '[]'::jsonb;
  END;

  BEGIN
    SELECT COALESCE(jsonb_agg(sc), '[]'::jsonb)
      INTO v_sc
      FROM shift_config sc
      WHERE sc.company_id = v_company_id;
  EXCEPTION WHEN OTHERS THEN
    v_sc := '[]'::jsonb;
  END;

  RETURN jsonb_build_object(
    'employees',               (SELECT COALESCE(jsonb_agg(e),  '[]'::jsonb) FROM employees e WHERE e.company_id = v_company_id),
    'customers',               (SELECT COALESCE(jsonb_agg(c),  '[]'::jsonb) FROM customers c WHERE c.company_id = v_company_id),
    'projects',                (SELECT COALESCE(jsonb_agg(p),  '[]'::jsonb) FROM projects p WHERE p.company_id = v_company_id),
    'tasks',                   (
      SELECT COALESCE(jsonb_agg(
        to_jsonb(t) || jsonb_build_object('missions', COALESCE(tm.missions, '[]'::jsonb))
      ), '[]'::jsonb)
      FROM tasks t
      LEFT JOIN (
        SELECT task_id, jsonb_agg(data) AS missions
        FROM task_missions
        WHERE company_id = v_company_id
        GROUP BY task_id
      ) tm ON tm.task_id = t.id
      WHERE t.company_id = v_company_id
    ),
    'receipts',                (SELECT COALESCE(jsonb_agg(r),  '[]'::jsonb) FROM receipts r WHERE r.company_id = v_company_id),
    'payments',                (
      SELECT COALESCE(jsonb_agg(
        (to_jsonb(py) - 'images') || jsonb_build_object('image_count', COALESCE(array_length(py.images, 1), 0))
      ), '[]'::jsonb)
      FROM payments py
      WHERE py.company_id = v_company_id
    ),
    'quotes',                  (SELECT COALESCE(jsonb_agg(q),  '[]'::jsonb) FROM quotes q WHERE q.company_id = v_company_id),
    'sales_orders',            (SELECT COALESCE(jsonb_agg(so), '[]'::jsonb) FROM sales_orders so WHERE so.company_id = v_company_id),
    'purchase_orders',         (SELECT COALESCE(jsonb_agg(po), '[]'::jsonb) FROM purchase_orders po WHERE po.company_id = v_company_id),
    'suppliers',               (SELECT COALESCE(jsonb_agg(s),  '[]'::jsonb) FROM suppliers s WHERE s.company_id = v_company_id),
    'subcontractor_advances',  (SELECT COALESCE(jsonb_agg(sa), '[]'::jsonb) FROM subcontractor_advances sa WHERE sa.company_id = v_company_id),
    'business_profile', v_bp,
    'shift_config',     v_sc
  );
END;
$function$;

-- ============================================================================
-- VERIFY sau khi chạy: gọi RPC bằng JWT của 1 công ty KHÔNG có dữ liệu (vd
-- công ty test vừa tạo ở Giai đoạn 7), mọi field phải là [] — KHÔNG còn thấy
-- dữ liệu của Hoàng Long. Test qua ứng dụng thật (tải lại trang khi đang
-- đăng nhập công ty đó) hoặc gọi thẳng:
--   POST https://<project>.supabase.co/rest/v1/rpc/load_all_core_data
--   Header: Authorization: Bearer <JWT của công ty test>
-- ============================================================================
