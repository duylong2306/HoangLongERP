-- ============================================================================
-- DỌN SẠCH DỮ LIỆU THẬT trong database của môi trường DEV (sau khi "Restore to new project" từ LoLo)
-- ============================================================================
-- Khi tạo project dev bằng cách khôi phục bản sao lưu của LoLo, dev mang theo CẢ DỮ LIỆU THẬT của Hoàng Long (nhân viên, mật khẩu băm,
-- tài chính, ảnh chấm công...). Script này xóa sạch để dev chỉ còn CẤU TRÚC (bảng, hàm, chính sách RLS) và dữ liệu giả do bạn tự tạo.
--
-- ⛔ XÓA VĨNH VIỄN — CHỈ CHẠY TRONG PROJECT DEV. Chốt chặn: script từ chối chạy nếu project chưa được đánh dấu là dev.
--    Bước 0 (làm trước, CHỈ trong project dev):   create table public.__is_dev_environment (ok boolean);
--    Project LoLo thật KHÔNG có bảng này nên script tự dừng nếu lỡ dán nhầm vào đó.
--
-- Xóa: toàn bộ dòng của MỌI doanh nghiệp (kể cả hoanglong) + danh sách doanh nghiệp + đơn đăng ký + nhật ký + lượt đăng nhập/đăng ký.
-- Giữ: cấu trúc, gói dịch vụ (plans), cấu hình nền tảng (đã xóa số tài khoản ngân hàng thật). Tài khoản quản trị nền tảng BỊ XÓA
--      (mật khẩu/khóa 2FA của project thật không dùng được ở dev) — tạo lại tài khoản dev theo docs/moi-truong-thu-rieng.md.
-- File ảnh trong Storage KHÔNG được sao chép sang dev (chỉ có cấu trúc bucket), nên không cần dọn.
-- ============================================================================

do $$
declare
  t record;
  pass int := 0;
  conlai int;
  n bigint;
  dev_marker boolean;
begin
  select to_regclass('public.__is_dev_environment') is not null into dev_marker;
  if not dev_marker then
    raise exception 'DỪNG: project này chưa được đánh dấu là DEV (thiếu bảng public.__is_dev_environment). Nếu đây đúng là project dev, chạy trước: create table public.__is_dev_environment (ok boolean);';
  end if;

  -- 1) Xóa dòng của mọi bảng có company_id; vướng khóa ngoại thì thử lại ở lượt sau cho tới khi hết
  loop
    pass := pass + 1; conlai := 0;
    for t in
      select c.table_name
        from information_schema.columns c
        join pg_class k on k.relname = c.table_name and k.relnamespace = 'public'::regnamespace and k.relkind = 'r'
       where c.table_schema = 'public' and c.column_name = 'company_id' and c.table_name <> 'companies'
    loop
      begin
        execute format('delete from public.%I', t.table_name);
      exception when foreign_key_violation then
        execute format('select count(*) from public.%I', t.table_name) into n;
        conlai := conlai + n;
      end;
    end loop;
    exit when conlai = 0 or pass >= 30;
  end loop;
  if conlai > 0 then raise exception 'DỪNG: còn % dòng chưa xóa được sau % lượt (vướng khóa ngoại).', conlai, pass; end if;

  -- 2) Doanh nghiệp + dữ liệu nền tảng
  delete from public.subscription_orders;
  delete from public.companies;
  delete from public.platform_audit_logs;
  delete from public.platform_login_attempts;
  delete from public.signup_attempts;
  delete from public.platform_admins;                       -- tài khoản quản trị của project thật không dùng ở dev
  update public.platform_settings set value = jsonb_set(value, '{accountNumber}', '""') where key = 'bank' and value ? 'accountNumber';
  update public.platform_settings set value = jsonb_set(value, '{accountName}', '""')   where key = 'bank' and value ? 'accountName';

  raise notice 'XONG: đã dọn dữ liệu thật của project dev (% lượt).', pass;
end $$;

-- KIỂM TRA: tất cả phải = 0
select (select count(*) from public.companies) as so_doanh_nghiep,
       (select count(*) from public.employees) as so_nhan_vien,
       (select count(*) from public.platform_admins) as so_quan_tri,
       (select count(*) from public.subscription_orders) as so_don_mua;
