-- Migration nối tiếp: sửa RPC load_all_core_data() để trả kèm "missions" cho
-- từng task — bị BỎ SÓT khi tách tasks.missions sang bảng task_missions
-- (xem 20260824_task_missions_table.sql .. 20260824d_drop_tasks_missions_column.sql).
--
-- NGUYÊN NHÂN "Nhiệm vụ chưa hiển thị": App.tsx tải dữ liệu khởi động (BƯỚC 3
-- trong initAndSync) qua RPC load_all_core_data() (viết ở migration 028), KHÔNG
-- đi qua hàm JS dbService.tasks.list() (nơi ĐÃ có logic gộp missions từ bảng
-- task_missions — xem dbService.ts). RPC này SELECT thẳng bảng tasks, và sau
-- khi cột tasks.missions bị xóa (20260824d), phần "tasks" trong kết quả RPC
-- HOÀN TOÀN không còn field missions nào — khiến TaskDetailModal luôn thấy
-- "Chưa có nhiệm vụ chi tiết nào" dù dữ liệu vẫn còn nguyên trong task_missions.
--
-- FIX: LEFT JOIN gộp missions (mảng data của từng dòng task_missions, đã gồm
-- id gốc của mission) vào mỗi task trước khi trả về — cùng hình dạng dữ liệu
-- với dbService.tasks.list() ở phía JS.

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

GRANT EXECUTE ON FUNCTION load_all_core_data() TO anon;
GRANT EXECUTE ON FUNCTION load_all_core_data() TO authenticated;
