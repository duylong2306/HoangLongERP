-- BƯỚC 1B — THU QUYỀN ĐỌC cột `password` của bảng employees đối với trình duyệt (anon / authenticated).
-- CHỈ CHẠY SAU KHI: (1) đã chạy 20261020a, (2) bản ứng dụng mới (đọc nhân viên qua list_employees_safe / load_all_core_data, ghi nhân viên không đòi trả lại cột) ĐÃ DEPLOY.
-- Sau bước này: select('*') trực tiếp trên employees từ trình duyệt sẽ báo lỗi "permission denied" (đúng ý — nó là đường để lộ hash).
-- service_role (api/login.ts, scripts) không bị ảnh hưởng. Hoàn tác: 20261020c_employees_restore_password_select.sql.
-- LƯU Ý BẢO TRÌ: cột MỚI thêm vào employees sau này mặc định KHÔNG được cấp quyền đọc cho trình duyệt —
-- migration thêm cột phải kèm: grant select (<cột mới>) on public.employees to anon, authenticated;
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
    from information_schema.columns where table_schema = 'public' and table_name = 'employees' and column_name <> 'password';
  execute 'revoke select on public.employees from anon, authenticated';
  execute format('grant select (%s) on public.employees to anon, authenticated', cols);
end $$;
notify pgrst, 'reload schema';
