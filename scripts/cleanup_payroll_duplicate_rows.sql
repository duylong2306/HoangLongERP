-- DỌN DÒNG LƯƠNG TRÙNG do "Ứng lương nhân sự" từng tự tạo dòng mã ngẫu nhiên PL-<4 số> (0 công, chỉ có tạm ứng)
-- trong khi "Tính lương tự động" tạo thêm dòng chuẩn PL-<mã NV>-<MMYYYY> cho cùng nhân viên + cùng kỳ.
-- Chỉ xóa dòng PL-<4 số> NÀO ĐÃ CÓ dòng chuẩn cùng công ty/nhân viên/kỳ. Dòng PL-<4 số> chưa có dòng chuẩn
-- (kỳ chưa tính lương, chỉ mới có tạm ứng) được GIỮ NGUYÊN.
-- Tạm ứng không mất: dòng chuẩn tính lại tạm ứng từ phiếu chi "Ứng lương" mỗi lần Tính lương tự động.
--
-- CÁCH DÙNG: chạy BƯỚC 1 xem trước → đúng thì chạy BƯỚC 2. Sau đó bảo mọi người tải lại trang (tab đang mở
-- còn giữ dòng cũ trong bộ nhớ có thể ghi ngược lại).

-- BƯỚC 1: xem trước các dòng sẽ bị xóa
select s.company_id, s.id as dong_thua, s.emp_id, s.month, s.worked_days, s.advances
from hrm_payroll_records s
where s.id ~ '^PL-[0-9]{4}$'
  and exists (
    select 1 from hrm_payroll_records k
    where k.company_id = s.company_id and k.emp_id = s.emp_id and k.month = s.month
      and k.id = 'PL-' || k.emp_id || '-' || replace(k.month, '/', '')
  )
order by s.month, s.emp_id;

-- BƯỚC 2: xóa (bỏ dấu -- ở các dòng dưới rồi chạy)
-- delete from hrm_payroll_records s
-- where s.id ~ '^PL-[0-9]{4}$'
--   and exists (
--     select 1 from hrm_payroll_records k
--     where k.company_id = s.company_id and k.emp_id = s.emp_id and k.month = s.month
--       and k.id = 'PL-' || k.emp_id || '-' || replace(k.month, '/', '')
--   );
