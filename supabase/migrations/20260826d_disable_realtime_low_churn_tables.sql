-- ============================================================================
-- Migration: Tắt Realtime (server-side) cho 21 bảng ít cần cập nhật tức thời
--
-- LÝ DO: App đã bỏ các bảng này khỏi channel Realtime phía code (2 đợt commit
-- "Chuyển 10 bảng ít thay đổi..." và "Hạ thêm 11 bảng..."), chuyển sang làm
-- mới định kỳ mỗi 5 phút — vì tài khoản Supabase đã VƯỢT hạn mức "Tin nhắn
-- thời gian thực" (117%/tháng). Migration này CỦNG CỐ thêm ở phía server:
-- gỡ hẳn các bảng đó khỏi publication "supabase_realtime" — đảm bảo KHÔNG
-- bảng nào trong số này còn phát sinh "Tin nhắn thời gian thực" nữa, kể cả
-- nếu sau này có đoạn code nào (vô tình) subscribe lại.
--
-- KHÔNG đụng tới 14 bảng còn lại vẫn cần cập nhật tức thời (tasks, projects,
-- payments, receipts, material_proposals, purchase_orders,
-- subcontractor_advances, attendance_records, quotes, customers, inventory,
-- warehouse_logs, purchase_product_catalog, sales_product_catalog,
-- sales_orders, employees, hrm_leaves, task_missions) — các bảng này vẫn cần
-- đẩy tin ngay lập tức để nhiều người cộng tác cùng lúc (Kanban, đề xuất
-- chi/vật tư, đơn hàng, chấm công...) thấy thay đổi của nhau không cần F5.
--
-- Idempotent: chỉ DROP TABLE khỏi publication nếu bảng ĐANG có trong đó —
-- an toàn chạy lại nhiều lần, kể cả khi bảng đã bị gỡ từ trước hoặc chưa
-- từng được thêm vào publication.
--
-- Chạy 1 lần trong Supabase Dashboard > SQL Editor.
-- ============================================================================

do $$
declare
  t text;
  low_churn_tables text[] := array[
    -- Đợt 1: cấu hình hệ thống/nhân sự/phân quyền
    'hrm_task_permissions',
    'hrm_role_groups',
    'business_profile',
    'shift_config',
    'hrm_holidays',
    'hrm_performance_criteria',
    'hrm_salary_scales',
    'kanban_columns',
    'project_permissions',
    'hrm_leave_coefficients',
    -- Đợt 2: công nợ/hợp đồng/danh mục không cần tức thời
    'hrm_approval_config',
    'hrm_employee_errors',
    'hrm_trips',
    'hrm_travel_expenses',
    'hrm_payroll_records',
    'accounting_liabilities',
    'accounting_receivables',
    'accounting_sub_contracts',
    'archived_quotes',
    'suppliers',
    'accounting_subcontractors'
  ];
begin
  foreach t in array low_churn_tables loop
    if exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime drop table public.%I;', t);
      raise notice 'Đã gỡ bảng % khỏi Realtime publication.', t;
    else
      raise notice 'Bảng % không nằm trong Realtime publication (bỏ qua).', t;
    end if;
  end loop;
end $$;
