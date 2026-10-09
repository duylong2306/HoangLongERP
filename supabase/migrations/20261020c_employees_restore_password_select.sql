-- HOÀN TÁC bước 1B: cấp lại quyền đọc đầy đủ bảng employees cho trình duyệt (dùng nếu thấy lỗi "permission denied for table employees" sau 1B).
grant select on public.employees to anon, authenticated;
notify pgrst, 'reload schema';
