-- ============================================================================
-- Multi-tenant: sửa khoá chính cố định cho 8 bảng "cấu hình" — hiện chỉ hỗ trợ
-- ĐÚNG 1 công ty (công ty thứ 2 trở đi lưu sẽ bị RLS chặn do đụng khoá chính
-- của công ty đầu). Xem giải thích chi tiết trong kế hoạch đã thống nhất.
--
-- NHÓM 1 — "mỗi công ty 1 dòng duy nhất" (PK là cột id text, đơn):
--   business_profile, shift_config, display_settings, hrm_task_permissions,
--   project_permissions, document_templates
--   → Đổi id từ chuỗi cố định ('current'/'global'/'task_permission_matrix_v1')
--     sang CHÍNH company_id của dòng đó. Không đổi cấu trúc bảng, chỉ đổi giá
--     trị khoá — dữ liệu hiện có của Hoàng Long được giữ nguyên.
--
-- NHÓM 2 — "nhiều dòng theo loại, cần lặp lại cho mỗi công ty":
--   quotation_configs (PK: sector), construction_norms (PK: id = loại định mức)
--   → Đổi PK từ 1 cột sang khoá ghép (company_id, sector|id) để mỗi công ty
--     có bộ dòng riêng theo từng sector/loại của mình.
--
-- CHỈ CHẠY TRÊN STAGING trước, test kỹ rồi mới áp dụng production.
-- ============================================================================

begin;

-- ── NHÓM 1: đổi giá trị id = company_id ─────────────────────────────────────
-- LƯU Ý: display_settings KHÔNG có trong migration này — bảng này chưa từng
-- được tạo trên Supabase (không nằm trong bất kỳ migration nào trước đây),
-- nghĩa là displaySettings.get()/save() trong dbService.ts từ trước đến giờ
-- luôn thất bại âm thầm (lỗi bị nuốt bởi catch). Cấu hình giao diện thực tế
-- chỉ tồn tại ở localStorage/DisplaySettingsContext. Cần quyết định riêng có
-- tạo bảng này không trước khi xử lý — xem báo cáo kèm theo.
update public.business_profile      set id = company_id::text where id = 'current';
update public.shift_config          set id = company_id::text where id = 'current';
update public.hrm_task_permissions  set id = company_id::text where id = 'task_permission_matrix_v1';
update public.project_permissions   set id = company_id::text where id = 'global';
update public.document_templates    set id = company_id::text where id = 'global';

-- ── NHÓM 2: đổi PK sang khoá ghép (company_id, sector|id) ───────────────────
alter table public.quotation_configs drop constraint if exists quotation_configs_pkey;
alter table public.quotation_configs add primary key (company_id, sector);

alter table public.construction_norms drop constraint if exists construction_norms_pkey;
alter table public.construction_norms add primary key (company_id, id);

-- Index cũ (thiết kế single-tenant): unique trên biểu thức (id = 'current'),
-- chỉ cho phép ĐÚNG 1 dòng trong toàn bảng. Sau khi đổi id sang company_id,
-- biểu thức này = false cho MỌI dòng → vô tình chặn công ty thứ 2 trở đi dù
-- khoá chính đã đúng. Phát hiện qua test thực tế (tạo công ty B, lưu
-- business_profile → lỗi 23505 duplicate key trên đúng index này).
drop index if exists public.idx_business_profile_single;
drop index if exists public.idx_shift_config_single;

commit;

-- ============================================================================
-- VERIFY sau khi chạy (phải khớp số dòng hiện có, không có dòng nào rớt):
--   select id, company_id from public.business_profile;
--   select id, company_id from public.shift_config;
--   select id, company_id from public.hrm_task_permissions;
--   select id, company_id from public.project_permissions;
--   select id, company_id from public.document_templates;
--   select sector, company_id from public.quotation_configs;
--   select id, company_id from public.construction_norms;
-- ============================================================================
