-- ============================================================================
-- DỌN DẸP DOANH NGHIỆP TEST trên project Supabase "LoLo" (staging) — chỉ giữ lại doanh nghiệp "hoanglong"
-- ============================================================================
-- ⚠️ XÓA VĨNH VIỄN dữ liệu, KHÔNG hoàn tác được. Chỉ chạy trên project "LoLo" (mã oittwcngarzmtrmjxisu), KHÔNG chạy ở
--    project production Hoàng Long cũ (project đó không có bảng `companies` nên câu lệnh sẽ báo lỗi và dừng — an toàn).
--
-- Cách dùng: chạy BƯỚC 1 (chỉ xem) → kiểm tra danh sách "SẼ BỊ XÓA" đúng ý → chạy BƯỚC 2 (xóa).
-- Giữ lại: doanh nghiệp có slug = 'hoanglong' (cùng toàn bộ dữ liệu của nó), gói dịch vụ, cấu hình nền tảng, tài khoản quản trị,
--          nhật ký thao tác. Xóa: các doanh nghiệp còn lại + MỌI dữ liệu của chúng (nhân viên, dự án, ...) + đơn đăng ký gói của chúng.
-- Tệp ảnh/tài liệu đã tải lên Storage của các doanh nghiệp test KHÔNG xóa được bằng SQL (Supabase chặn xóa trực tiếp) —
--          xem ghi chú BƯỚC 3 ở cuối.
-- ============================================================================


-- ─── BƯỚC 1: XEM TRƯỚC (chỉ đọc, an toàn) ────────────────────────────────────────────────────────────────────────
-- 1a) Doanh nghiệp SẼ BỊ XÓA và doanh nghiệp được GIỮ:
select case when slug = 'hoanglong' then 'GIỮ LẠI' else 'SẼ BỊ XÓA' end as ket_qua,
       slug, name, active, expires_at, plan_id, created_at,
       (select count(*) from public.employees e where e.company_id = c.id) as so_nhan_vien,
       (select count(*) from public.subscription_orders o where o.company_id = c.id) as so_don_mua
  from public.companies c
 order by (slug = 'hoanglong') desc, created_at;

-- 1b) Phải thấy đúng 1 dòng 'GIỮ LẠI' là hoanglong ở trên. Nếu KHÔNG thấy 'hoanglong' → DỪNG, đừng chạy bước 2.


-- ─── BƯỚC 2: XÓA (chạy cả khối DO bên dưới trong một lần) ─────────────────────────────────────────────────────────
-- Cách làm: với mọi bảng public có cột company_id, xóa dòng thuộc các doanh nghiệp test; vì các bảng tham chiếu lẫn nhau
-- (khóa ngoại) nên lặp nhiều lượt — lượt nào bị vướng khóa ngoại thì bỏ qua rồi thử lại ở lượt sau — cho tới khi hết.
-- Nếu cuối cùng còn sót dòng nào hoặc không tìm thấy 'hoanglong' → báo lỗi và TOÀN BỘ khối bị hủy (không xóa gì cả).
do $$
declare
  keep_id    uuid;
  del_ids    uuid[];
  t          record;
  pass       int := 0;
  conn_lai   bigint;
  da_xoa     bigint;
  tong_xoa   bigint := 0;
begin
  select id into keep_id from public.companies where slug = 'hoanglong';
  if keep_id is null then
    raise exception 'DỪNG: không tìm thấy doanh nghiệp slug=hoanglong — không xóa gì cả.';
  end if;

  select array_agg(id) into del_ids from public.companies where id <> keep_id;
  if del_ids is null then
    raise notice 'Không có doanh nghiệp test nào cần xóa.';
    return;
  end if;
  raise notice 'Sẽ xóa % doanh nghiệp (giữ lại hoanglong).', array_length(del_ids, 1);

  -- Lặp tối đa 30 lượt để xử lý thứ tự phụ thuộc giữa các bảng
  loop
    pass := pass + 1;
    conn_lai := 0;
    for t in
      select c.table_name
        from information_schema.columns c
        join pg_class k on k.relname = c.table_name and k.relnamespace = 'public'::regnamespace and k.relkind = 'r'
       where c.table_schema = 'public' and c.column_name = 'company_id' and c.table_name <> 'companies'
    loop
      begin
        execute format('delete from public.%I where company_id = any($1)', t.table_name) using del_ids;
        get diagnostics da_xoa = row_count;
        tong_xoa := tong_xoa + da_xoa;
      exception when foreign_key_violation then
        -- bảng này còn bị bảng khác tham chiếu → thử lại lượt sau (sau khi bảng con đã được xóa)
        execute format('select count(*) from public.%I where company_id = any($1)', t.table_name) into da_xoa using del_ids;
        conn_lai := conn_lai + da_xoa;
      end;
    end loop;
    exit when conn_lai = 0 or pass >= 30;
  end loop;

  if conn_lai > 0 then
    raise exception 'DỪNG: sau % lượt vẫn còn % dòng chưa xóa được (vướng khóa ngoại) — toàn bộ thao tác bị hủy, không xóa gì.', pass, conn_lai;
  end if;

  -- Cuối cùng xóa chính các doanh nghiệp test (đơn đăng ký gói subscription_orders tự xóa theo: khóa ngoại ON DELETE CASCADE)
  delete from public.companies where id = any(del_ids);
  get diagnostics da_xoa = row_count;
  raise notice 'XONG: đã xóa % doanh nghiệp và % dòng dữ liệu liên quan (% lượt).', da_xoa, tong_xoa, pass;

  if (select count(*) from public.companies) <> 1 or not exists (select 1 from public.companies where id = keep_id) then
    raise exception 'DỪNG: kiểm tra cuối cùng thất bại — toàn bộ thao tác bị hủy.';
  end if;
end $$;

-- 2b) Kiểm tra sau khi xóa: phải còn đúng 1 doanh nghiệp (hoanglong) và dữ liệu của nó còn nguyên
select slug, name, active,
       (select count(*) from public.employees e where e.company_id = c.id) as so_nhan_vien
  from public.companies c;
select count(*) as so_don_mua_con_lai from public.subscription_orders;   -- 0 nếu hoanglong chưa từng mua gói


-- ─── BƯỚC 3 (tuỳ chọn): tệp trong Storage của các doanh nghiệp test ───────────────────────────────────────────────
-- Supabase không cho xóa trực tiếp bảng storage.objects bằng SQL. Tệp được xếp theo thư mục tên = mã doanh nghiệp (company_id).
-- Xem các thư mục còn sót (sau khi đã xóa doanh nghiệp, mọi thư mục KHÁC thư mục của hoanglong là của doanh nghiệp test):
--   select bucket_id, (storage.foldername(name))[1] as company_id, count(*) as so_tep
--     from storage.objects group by 1, 2 order by 1, 2;
-- Muốn xóa: vào Supabase → Storage → chọn bucket → xóa thư mục tương ứng (hoặc nhờ Claude xóa qua Storage API khi bạn đồng ý).
