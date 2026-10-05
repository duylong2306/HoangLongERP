-- ============================================================================
-- Multi-tenant: kanban_columns — đổi khóa chính (sector) → (company_id, sector)
-- ============================================================================
-- Phát hiện 2026-10-05 khi test trên staging: bấm "Thêm Cột" ở bảng Kanban báo
--   "new row violates row-level security policy (USING expression) for table kanban_columns"
-- vì code upsert không gửi company_id, và khóa chính chỉ là `sector` nên công ty thứ 2
-- trở đi cũng sẽ đụng khóa của công ty đầu (cùng lỗi đã gặp ở quotation_configs,
-- construction_norms — xem 20260930_multi_tenant_config_tables_keys.sql).
--
-- Code tương ứng (dbService.kanbanColumns.save): upsert kèm company_id + onConflict
-- 'company_id,sector'. Phải chạy migration này TRƯỚC khi lưu cột trên staging, nếu không
-- upsert báo "no unique or exclusion constraint matching the ON CONFLICT specification".
--
-- CHỈ CHẠY TRÊN PROJECT STAGING MULTI-TENANT (oittwcngarzmtrmjxisu) — production (nhánh main)
-- chưa có company_id nên KHÔNG chạy ở đó. Idempotent.
-- ============================================================================

begin;

alter table public.kanban_columns drop constraint if exists kanban_columns_pkey;
alter table public.kanban_columns add primary key (company_id, sector);

commit;

-- VERIFY: phải giữ nguyên số dòng, mỗi dòng có company_id
--   select sector, company_id, jsonb_array_length(columns) as so_cot from public.kanban_columns;
