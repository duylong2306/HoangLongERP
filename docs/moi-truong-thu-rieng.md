# Môi trường thử riêng (DEV) — để thử tính năng mà không đụng nhân viên thật

> Từ ngày nhân viên Hoàng Long làm việc thật trên `hoanglong.lolo.io.vn`, môi trường hiện tại (Vercel `hoanglong-erp-staging` + Supabase LoLo) là **môi trường THẬT**. Mọi thử nghiệm phải chạy ở môi trường dev riêng dưới đây.

## Tổng quan

| | **PROD (thật)** | **DEV (thử nghiệm)** |
|---|---|---|
| Vercel | `hoanglong-erp-staging` | `lolo-dev` (tạo mới) |
| Supabase | LoLo `oittwcngarzmtrmjxisu` | `lolo-dev` (tạo mới, khôi phục cấu trúc từ LoLo) |
| Tên miền | `lolo.io.vn`, `*.lolo.io.vn` | `dev.lolo.io.vn`, `*.dev.lolo.io.vn` |
| Dữ liệu | thật | giả (do tự tạo) |
| Telegram, thông báo đẩy, CAPTCHA | bật | **tắt** (không đặt biến) |
| Lệnh deploy | `npm run deploy:prod` (chỉ nhánh `multi-tenant`, sạch, gõ `DEPLOY`) | `npm run deploy:dev` (mọi nhánh, kể cả sửa dở) |
| Nhận diện | — | nhãn cam "THỬ NGHIỆM — dữ liệu giả" ở góc màn hình |

Lệnh deploy có **chốt chặn**: nếu cấu hình dev trỏ nhầm vào project thật (cùng id hoặc cùng tên), cả hai lệnh đều từ chối.

## Chi phí cần cân nhắc
- Một project Supabase thứ hai trong gói Pro tính thêm phí (khoảng vài chục nghìn đến vài trăm nghìn đồng mỗi tháng tùy cỡ máy — **kiểm tra bảng giá hiện hành**). Có thể tạm dừng (pause) khi không dùng.
- **Vercel gói Hobby chỉ dành cho dùng cá nhân/phi thương mại.** Khi nền tảng thu phí khách hàng thật cần gói Pro. Project dev có thể ở cùng tài khoản.

## A. Tạo Supabase dev (cấu trúc giống hệt LoLo)

Cách nhanh và chính xác nhất là **khôi phục bản sao lưu của LoLo sang một project mới** (copy trọn bảng, hàm, chính sách RLS, extension):

1. Supabase → project **LoLo** → **Database → Backups → Restore to a new project** → đặt tên `lolo-dev`, cùng vùng với LoLo, chọn bản sao lưu mới nhất.
2. Khi project mới sẵn sàng, mở **SQL Editor của project `lolo-dev`** và chạy **đúng dòng này trước** (đánh dấu đây là dev — script dọn dẹp sẽ từ chối chạy ở project khác):
   ```sql
   create table public.__is_dev_environment (ok boolean);
   ```
3. Chạy toàn bộ nội dung [scripts/scrub-dev-database.sql](../scripts/scrub-dev-database.sql) để **xóa sạch dữ liệu thật** (bản khôi phục mang theo cả dữ liệu Hoàng Long). Cuối script có câu kiểm tra, tất cả phải bằng 0.
4. Lấy thông tin của project dev ở **Project Settings → API**: URL, `anon`, `service_role`, và **JWT Secret** (đây là bốn giá trị RIÊNG của dev, khác LoLo).
5. Tạo tài khoản quản trị nền tảng cho dev (vì script dọn đã xóa hết). Trên máy anh, sinh mật khẩu băm (thay `MatKhauDev12345`):
   ```bash
   node -e "console.log(require('bcryptjs').hashSync('MatKhauDev12345', 12))"
   ```
   rồi chạy trong SQL Editor của dev (thay `<HASH>` bằng chuỗi vừa in):
   ```sql
   insert into public.platform_admins (username, password_hash, name, is_owner) values ('admin', '<HASH>', 'Quản trị dev', true);
   ```
6. (Nếu cần thử thông báo/nhắc chấm công ở dev) cài hai hàm Edge cho dev: `npx supabase functions deploy send-push --project-ref <ma-project-dev>` và tương tự `send-attendance-reminders`. Mặc định có thể bỏ qua.

> Ghi chú: bản khôi phục **không** chép file ảnh trong Storage, chỉ chép cấu trúc bucket. Các dòng mô tả file cũ (nếu còn) chỉ là siêu dữ liệu, không ảnh hưởng.

## B. Tạo Vercel dev

1. Tạo project: `npx vercel project add lolo-dev` (hoặc Vercel → Add New → Project).
2. Vercel → project `lolo-dev` → **Settings → Environment Variables** → thêm các biến trong [.env.dev.example](../.env.dev.example) với **giá trị của Supabase dev** (không dùng lại giá trị của LoLo). **Không** đặt Telegram, VAPID, Turnstile.
3. **Settings → Domains**: thêm `dev.lolo.io.vn` và `*.dev.lolo.io.vn` (tên miền gốc `lolo.io.vn` đang dùng DNS của Vercel nên thêm được ngay).
4. Lấy **Project ID** (Settings → General → Project ID, dạng `prj_…`) của `lolo-dev`.

## C. Nối máy anh với dev

```bash
node scripts/setup-dev-env.mjs        # hỏi tên project, Project ID, Org ID (Enter = dùng cùng Org với project thật)
npm run deploy:dev -- --check         # chỉ kiểm tra cấu hình, không deploy
npm run deploy:dev                    # deploy lên dev (mọi nhánh, kể cả sửa dở)
```

Cấu hình lưu ở `.vercel/envs.json` (cục bộ, không lên GitHub).

## D. Quy trình làm việc từ nay

1. **Mọi tính năng/sửa lỗi mới** → Claude `deploy:dev` → thử trên `dev.lolo.io.vn` (đăng ký công ty giả `dev-…`).
2. **SQL thay đổi cấu trúc** → chạy ở **dev trước**, thử xong mới chạy ở LoLo thật (anh là người chạy ở LoLo thật, như hiện nay).
3. Anh duyệt → commit → "push đi" → `npm run deploy:prod` (gõ `DEPLOY`). Từ đó nhân viên thấy bản mới.
4. Sửa nóng khẩn cấp: vẫn qua dev trước (vài phút), trừ khi hệ thống đang sập.
5. Định kỳ khôi phục lại dev từ LoLo (rồi dọn bằng script) nếu cần kiểm tra trên cấu trúc mới nhất.

## E. Việc nên làm sau
- Đổi tên project Vercel `hoanglong-erp-staging` → tên đúng nghĩa (ví dụ `lolo-prod`); đổi xong cập nhật `PROD_PROJECT_NAME` trong `scripts/lib/deploy-core.mjs` (hoặc bỏ, vì id mới là căn cứ chính).
- Đặt lịch nhắc dọn dev (xóa dữ liệu giả) khi cần.
