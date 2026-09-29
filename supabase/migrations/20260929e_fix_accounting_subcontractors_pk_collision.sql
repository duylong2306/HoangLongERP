-- ============================================================================
-- HOTFIX (tiếp tục rà soát menu-by-menu — menu Thầu Phụ): bảng
-- `accounting_subcontractors` cũng dùng PK đơn (id), trong khi
-- SubcontractorDirectory.tsx cho phép nhập "Mã thầu phụ" tuỳ ý qua Excel làm
-- id — cùng lỗi đã vá ở 12 bảng khác (20260929c/d).
-- ============================================================================

begin;

alter table public.accounting_subcontractors drop constraint if exists accounting_subcontractors_pkey;
alter table public.accounting_subcontractors add primary key (company_id, id);

commit;
