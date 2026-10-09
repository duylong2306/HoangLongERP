# Kế hoạch tách tài khoản đăng nhập khỏi hồ sơ nhân viên (TẠM DỪNG — làm sau)

Cập nhật: 09/10/2026 · Trạng thái: **tạm dừng theo yêu cầu** vì Hoàng Long và Ngọc Thịnh đang dùng thật; mọi thay đổi ở tầng DB phải làm lúc ít người dùng.

## 1. Vì sao cần làm
Bảng `employees` đang chứa cả hồ sơ nhân sự lẫn thông tin đăng nhập (`username`, `password` (hash), `has_system_account`).
- Hash mật khẩu của TẤT CẢ đồng nghiệp bị gửi về trình duyệt của mọi người đăng nhập (đọc `select('*')` và RPC `load_all_core_data`).
- "Có tài khoản hay không" phải suy từ vài cột nên sinh lỗi (đã sửa: tài khoản xóa rồi tự hiện lại, commit `0f33c40`).
- Máy chủ đăng nhập còn đoạn `password || '123'`; 17/24 tài khoản Hoàng Long và 7/9 tài khoản Ngọc Thịnh đang dùng mật khẩu `123`.
- Chưa có chỗ cho: khóa tạm sau nhiều lần sai, bắt đổi mật khẩu lần đầu, lần đăng nhập cuối, 2FA, đặt lại mật khẩu.

## 2. Bước 1 — ngừng gửi hash mật khẩu về trình duyệt
| Phần | Trạng thái |
|---|---|
| Code: đọc nhân viên qua RPC `list_employees_safe` / `load_all_core_data` (không có `password`), lưu nhân viên chỉ `select('id')`, không bơm mật khẩu mặc định cho admin | **Đã push và deploy** (commit `242d9eb`), tương thích ngược với DB cũ |
| SQL 1A `supabase/migrations/20261020a_employees_hide_password_functions.sql` (hàm đọc an toàn, bỏ `password` khỏi RPC, cột realtime) | **Đã chạy** (xác nhận hàm có mặt trong DB; kiểm tra trên doanh nghiệp test: 2 đường RPC không còn trả `password`) |
| SQL 1B `supabase/migrations/20261020b_employees_revoke_password_select.sql` (thu quyền đọc cột `password` của trình duyệt) | **CHƯA CHẠY — chờ làm sau** |
| SQL hoàn tác `20261020c_employees_restore_password_select.sql` | Sẵn sàng |

Hiện còn một khe hở: trình duyệt vẫn đọc được cột `password` nếu gọi thẳng bảng `employees` (đã xác nhận trên doanh nghiệp test). Chỉ 1B mới chặn hẳn.

### Khi nào và cách chạy 1B
1. Chọn giờ ít người dùng (ngoài giờ làm việc). Báo trước.
2. Chạy `20261020b` trong Supabase SQL Editor (một lần, vài giây).
3. Kiểm tra ngay trên doanh nghiệp test (đăng nhập admin test):
   - đọc trực tiếp `employees?select=password` phải bị từ chối;
   - tải danh sách nhân viên, lưu hồ sơ, gán nhóm, đổi mật khẩu cá nhân vẫn chạy;
   - **realtime của nhân viên** (một thiết bị đổi, thiết bị kia tự cập nhật) vẫn chạy — đây là điểm chưa chắc, cần xem;
   - đăng nhập vẫn chạy (máy chủ dùng service_role nên không bị ảnh hưởng).
4. Có lỗi "permission denied for table employees" → chạy ngay `20261020c` để hoàn tác.
5. **Bảo trì sau này:** cột MỚI thêm vào `employees` mặc định không được trình duyệt đọc; migration thêm cột phải kèm `grant select (<cột>) on public.employees to anon, authenticated;`.

## 3. Bước 2 — tách hẳn bảng tài khoản (chưa làm)
Tạo bảng `employee_accounts`: `company_id`, `employee_id` (khóa ngoại), `username` (duy nhất theo công ty), `password_hash`, `must_change_password`, `failed_attempts`, `locked_until`, `last_login_at`, trạng thái (+ sau này 2FA). Quyền, nhóm vai trò, thành viên vẫn gắn vào nhân viên (`employee_id`), không đổi.

Việc cần làm:
1. Migration tạo bảng + chuyển dữ liệu từ `employees` (`username`, `password`, `has_system_account`); RLS không cho trình duyệt đọc cột hash (hoặc chỉ service_role).
2. Đổi `api/login.ts` đọc từ bảng mới; **bỏ đoạn `password || '123'`**; ghi `last_login_at`, đếm sai/khóa tạm.
3. Đổi các luồng tạo, đổi mật khẩu, xóa tài khoản (màn "Tài Khoản Hệ Thống", hồ sơ nhân sự, đổi mật khẩu cá nhân) sang gọi API máy chủ thay vì ghi thẳng bảng từ trình duyệt.
4. Bắt đổi mật khẩu `123` ở lần đăng nhập tiếp theo (`must_change_password = true` cho các tài khoản đang dùng `123`) hoặc chủ doanh nghiệp đặt lại hàng loạt.
5. Sau khi ổn định: bỏ các cột cũ `username/password/has_system_account` khỏi `employees` (hoặc giữ `has_system_account` chỉ để hiển thị).
6. Test: đăng nhập đủ 3 doanh nghiệp, tạo/xóa/đổi mật khẩu, khóa tạm, chạy lúc ít người dùng; có kế hoạch hoàn tác.

## 4. Các việc liên quan còn mở
- Mật khẩu mặc định `123` ở 17/24 tài khoản Hoàng Long, 7/9 tài khoản Ngọc Thịnh (chưa xử lý).
- `src/lib/migrations.ts` còn một dòng tự sinh `username` cho dữ liệu cũ (luồng di chuyển một lần, chưa rà).
- Kiểm thử đăng nhập bằng từng tài khoản nhân viên thật chưa làm (cần người dùng đặt mật khẩu cho nhân viên TEST; xem `docs/bao-cao-kiem-thu-phan-quyen-va-vai-tro.md`).
