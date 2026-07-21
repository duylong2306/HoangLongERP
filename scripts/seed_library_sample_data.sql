-- ============================================================
-- Hoàng Long ERP — Dữ liệu mẫu cho Thư Viện Hồ Sơ
-- Chèn khách hàng, dự án mẫu (nếu chưa có) và 4 hồ sơ báo giá mẫu
-- ============================================================

-- 0) Khách hàng mẫu (idempotent)
INSERT INTO public.customers (id, name, phone, email, address, company)
VALUES
  ('cust_1', 'Phan Văn Nam', '0912111222', 'namphan@gmail.com', 'Biệt Thự B2-15 Hoa Lam, Đà Lạt, Lâm Đồng', 'Công ty Cổ phần Đầu tư Nam Phát'),
  ('cust_2', 'Nguyễn Thu Trang', '0987333444', 'trangnt@nhaphunu.com', 'Số 45 Trần Phú, Bảo Lộc, Lâm Đồng', NULL),
  ('cust_3', 'Phạm Đức Minh', '0933555666', 'minhpd@cokhithanhcong.com', 'Khu công nghiệp Lộc Sơn, Bảo Lộc, Lâm Đồng', 'Xưởng Cơ khí Thành Công')
ON CONFLICT (id) DO NOTHING;

-- 1) Dự án mẫu (idempotent)
INSERT INTO public.projects (id, name, type, status, customer_id)
VALUES
  ('proj_lib_1', 'Biệt thự vườn Nam Phát - giai đoạn 1', 'construction', 'new', 'cust_1'),
  ('proj_lib_2', 'Nội thất penthouse chị Trang', 'furniture', 'new', 'cust_2'),
  ('proj_lib_3', 'Nhà kho kết cấu thép Cơ khí Thành Công', 'mechanical', 'new', 'cust_3'),
  ('proj_lib_4', 'Thầu phụ phần xây dựng dự án Nam Phát', 'general', 'new', 'cust_1')
ON CONFLICT (id) DO NOTHING;

-- 2) Hồ sơ mẫu (archived_quotes)
INSERT INTO public.archived_quotes
  (id, sector, code, customer_id, project_id, subcontractor_id, contract_value, status, scope_work, items, creator_id, created_at, updated_at)
VALUES
  (
    'arch_lib_xd_001',
    'construction',
    'BG-XD-2026-001',
    'cust_1',
    'proj_lib_1',
    NULL,
    4500000000,
    'approved',
    'Thi công xây dựng trọn gói phần thô và hoàn thiện',
    '[{"name":"Móng + móng cọc","qty":1,"price":900000000},{"name":"Khung BTCT","qty":1,"price":1800000000},{"name":"Hoàn thiện","qty":1,"price":1800000000}]'::jsonb,
    'emp_admin',
    '2026-06-01T08:30:00+07:00',
    '2026-06-01T08:30:00+07:00'
  ),
  (
    'arch_lib_nt_002',
    'furniture',
    'BG-NT-2026-002',
    'cust_2',
    'proj_lib_2',
    NULL,
    1250000000,
    'approved',
    'Thiết kế, sản xuất và lắp đặt nội thất trọn gói',
    '[{"name":"Phòng khách","qty":1,"price":450000000},{"name":"Phòng ngủ master","qty":1,"price":350000000},{"name":"Bếp + pantry","qty":1,"price":450000000}]'::jsonb,
    'emp_admin',
    '2026-06-05T10:15:00+07:00',
    '2026-06-05T10:15:00+07:00'
  ),
  (
    'arch_lib_ck_003',
    'mechanical',
    'BG-CK-2026-003',
    'cust_3',
    'proj_lib_3',
    NULL,
    850000000,
    'approved',
    'Chế tạo và lắp đặt kết cấu vì kèo thép nhà kho',
    '[{"name":"Hệ vì kèo thép","qty":1,"price":520000000},{"name":"Mái tôn +.panel","qty":1,"price":230000000},{"name":"Gia công + vận chuyển","qty":1,"price":100000000}]'::jsonb,
    'emp_admin',
    '2026-06-10T14:00:00+07:00',
    '2026-06-10T14:00:00+07:00'
  ),
  (
    'arch_lib_tp_004',
    'subcontractor',
    'BG-TP-2026-004',
    'cust_1',
    'proj_lib_4',
    'sub_001',
    680000000,
    'approved',
    'Thầu phụ phần xây dựng thô + hoàn thiện cơ bản',
    '[{"name":"Thi công phần thô","qty":1,"price":430000000},{"name":"Hoàn thiện cơ bản","qty":1,"price":250000000}]'::jsonb,
    'emp_admin',
    '2026-06-12T09:00:00+07:00',
    '2026-06-12T09:00:00+07:00'
  )
ON CONFLICT (id) DO NOTHING;
