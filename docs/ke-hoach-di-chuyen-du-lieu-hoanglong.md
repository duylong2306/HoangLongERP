# Kế hoạch di chuyển dữ liệu Hoàng Long: production (nhánh `main`) → doanh nghiệp `hoanglong` (nhánh `multi-tenant`)

> Trạng thái: **KẾ HOẠCH — chưa chạy gì.** Production **không bị đụng tới** ở mọi bước (chỉ đọc). Mọi thao tác ghi chỉ nằm trên project LoLo và chỉ trong phạm vi một `company_id`.

## 1. Hiện trạng (đã kiểm chứng trong repo)

| Mục | Production (main) | LoLo (multi-tenant) |
|---|---|---|
| Supabase | `cyuunmrdrymhzxfcruoe` (nhân viên Hoàng Long đang làm việc thật) | `oittwcngarzmtrmjxisu` |
| Bảng nghiệp vụ | 57 bảng, khóa chính `id` | **cùng 57 bảng**, thêm cột `company_id`, khóa chính/khóa ngoại **ghép `(company_id, id)`** |
| Quan hệ giữa bảng | 21 khóa ngoại (dự án, công việc, khách hàng, hội thoại là bảng cha) | khóa ngoại ghép theo `company_id` → **phải nạp bảng cha trước** |
| Phân quyền dữ liệu | chính sách `anon_all_*` | RLS `tenant_isolation_*` + chính sách chặn `company_live` |
| Tệp (Storage) | 5 bucket ảnh: `avatars`, `attendance-photos`, `mission-report-images`, `quote-images`, `product-catalog-images`; đường dẫn gốc là `<thư mục>/…` | cùng 5 bucket, nhưng **đường dẫn bắt buộc bắt đầu bằng `<company_id>/`** (RLS Storage kiểm tra thư mục gốc) |
| Mật khẩu nhân viên | băm bcrypt trong `employees` | cùng cách → **chép nguyên, không cần đặt lại** |
| Dữ liệu `hoanglong` hiện có trên LoLo | — | là **bản sao cũ chụp ngày 28/9/2026** (24 nhân viên, 41 dự án…); production đã thay đổi nhiều từ đó (đề xuất chi NCC, phân bổ đơn mua, sửa dữ liệu bằng SQL…) → **không dùng được, phải nạp lại từ đầu** |
| Giới hạn số nhân viên | — | trigger `enforce_employee_limit` **không chặn** Hoàng Long (không gói, không dùng thử = không giới hạn) |

### Kết quả kiểm kê thật (chạy chỉ-đọc ngày 7/10/2026 bằng khóa production)

- **Cấu trúc khớp hoàn toàn:** production 57 bảng, LoLo 65 bảng = 57 bảng nghiệp vụ giống hệt + 8 bảng nền tảng (`companies`, `plans`, `platform_*`, `signup_attempts`, `subscription_orders`). **Không có cột nào** của production mà LoLo thiếu (và ngược lại) → không nguy cơ mất cột.
- **Khối lượng nhỏ:** tổng **10.072 dòng** (lớn nhất: `chat_messages` 4.916, `attendance_records` 1.400, `material_proposals` 322, `purchase_orders` 298, `subcontractor_advances` 327, `payments` 309). Dữ liệu cũ trên LoLo thiếu rất nhiều so với hiện tại (ví dụ `chat_messages` 4.215 → 4.916, `purchase_orders` 239 → 298, `projects` 41 → 44).
- **Có dòng ở LoLo mà production không còn** (ví dụ `hrm_employee_errors` LoLo 25 > production 12, `archived_quotes` 51 > 50): bản sao cũ chứa dòng đã bị xóa ở production → **bắt buộc xóa sạch dữ liệu `hoanglong` cũ rồi nạp lại** (không "gộp thêm"), mới ra bản sao chính xác.
- **Storage production: 5.293 tệp, khoảng 1,39 GB:** `mission-report-images` 836 tệp (1,26 GB — chiếm gần hết), `attendance-photos` 4.361 tệp (112 MB), `quote-images` 90 (18,5 MB), `avatars` 4 (2,7 MB), `product-catalog-images` 1. **Bucket thứ 6 `purchase-order-pdfs` (1 tệp 0,3 MB) là di sản:** repo có migration *xóa* bucket này và mã nguồn không còn dùng → **không chuyển**, chỉ sao lưu 1 tệp về máy.
- Thông báo đẩy: production có 35 `push_subscriptions` (gắn tên miền cũ, không chuyển được — xem §6), `fcm_tokens` 0 dòng.
- Việc dọn sẵn: LoLo còn bucket thử `zz-policy-test` (của lần kiểm tra bảo mật cũ) cần xóa.

Chưa kiểm chứng: trạng thái RLS thật trên production, cấu hình cron/Edge Function trên production (sẽ xem ở bước diễn tập).

## 2. Những rủi ro chính và cách chặn

| # | Rủi ro | Cách chặn |
|---|---|---|
| R1 | **Bỏ sót dữ liệu** (bảng/cột/dòng) | Danh sách bảng lấy **tự động** từ cả hai DB (không gõ tay); so khớp cột hai bên — production có cột mà LoLo chưa có → **dừng và báo**, không âm thầm bỏ cột. Đếm dòng từng bảng trước/sau bắt buộc **bằng nhau** |
| R2 | **Dữ liệu lọt sang doanh nghiệp khác** | Script nhận **đúng 1 `company_id` đích**, kiểm tra `slug=hoanglong` khớp id; mọi dòng ghi đều gán `company_id` đó; chụp số dòng của **mọi công ty khác trước/sau** và so (phải y nguyên); thử đọc bằng token của công ty khác → phải thấy 0 dòng Hoàng Long |
| R3 | **Ảnh mất / gãy liên kết**: URL trong dữ liệu trỏ vào project production + đường dẫn cũ, mà LoLo bắt buộc thư mục `<company_id>/` | Chép từng tệp sang LoLo tại `<company_id>/<đường dẫn cũ>`, **viết lại URL ở mọi cột chữ và JSON** (duyệt đệ quy toàn bộ giá trị mọi bảng); kiểm tra không còn URL nào trỏ về production và mọi URL mới đều tồn tại |
| R4 | **Vướng khóa ngoại** (nạp bảng con trước bảng cha; dòng mồ côi trong production) | Nạp theo thứ tự phụ thuộc lấy từ danh mục khóa ngoại + thử lại nhiều lượt. **Dòng mồ côi không bị bỏ**: liệt kê trong báo cáo để anh quyết định (giữ bằng cách gỡ liên kết / bổ sung dòng cha / loại bỏ có chủ đích) |
| R5 | **Dữ liệu thay đổi trong lúc đang chép** | Cửa sổ **đóng băng ghi** trên production (xem §4) trong lúc xuất bản cuối cùng |
| R6 | **Chạy hỏng giữa chừng** | Script chạy lại được (ghi `upsert` theo khóa chính, theo `company_id`); lỗi thì dừng, production không ảnh hưởng; có thể xóa sạch dữ liệu `hoanglong` trên LoLo theo `company_id` rồi nạp lại |
| R7 | **Lộ khóa/dữ liệu** | Khóa `service_role` chỉ đặt trong tệp `.env` cục bộ đã nằm trong `.gitignore`; bản xuất ra thư mục cục bộ cũng được `.gitignore`; không gửi khóa qua chat |

## 3. Cách làm: một script duy nhất, nhiều giai đoạn, luôn có xem trước

Tôi sẽ viết `scripts/migrate-production-to-company.mjs` (tiếng Việt, có chú thích, có test bằng CSDL giả như các phần trước). Các giai đoạn:

0. **Kiểm kê (chỉ đọc, 2 DB):** đếm dòng từng bảng, so danh sách cột, liệt kê bucket/số tệp/dung lượng, đếm dòng của mọi công ty trên LoLo. Cho ra báo cáo *"sẽ chép gì / sẽ bỏ gì / chỗ nào không khớp"*. **Dừng nếu có điều bất thường.**
1. **Xuất** toàn bộ dữ liệu production ra tệp cục bộ (phân trang theo khóa chính, sắp xếp ổn định, kiểm tra tổng dòng khớp kiểm kê). Đây cũng là **bản sao lưu** độc lập.
2. **Biến đổi:** thêm `company_id` đích; viết lại URL Storage; giữ nguyên mọi kiểu dữ liệu (số, thời gian, mảng, JSON, chuỗi base64 ảnh nhúng sẵn trong dữ liệu).
3. **Chép Storage:** liệt kê tệp từng bucket production (bằng khóa service), tải về, tải lên LoLo tại `<company_id>/<đường dẫn cũ>`, so kích thước từng tệp.
4. **Nạp vào LoLo** (chỉ với `--ghi`; mặc định là chạy thử không ghi): xóa dữ liệu cũ **chỉ của công ty đích** (kiểu `where company_id = <đích>`), nạp theo thứ tự phụ thuộc, nhiều lượt, ghi nhật ký từng bảng.
5. **Kiểm chứng tự động** (báo cáo đạt/không đạt, xem §5).

**Diễn tập trước, nạp thật sau — ĐIỀU CHỈNH sau khi viết script:** ban đầu dự định diễn tập vào công ty thử `hltest`, nhưng một số bảng của LoLo có khóa chính chỉ là `id` (toàn cục, ví dụ `hrm_travel_expenses`) nên nạp cùng id vào công ty thứ hai sẽ đụng với bản sao cũ của `hoanglong`. Vì bản `hoanglong` hiện trên LoLo chỉ là **bản sao thử nghiệm cũ** (không ai dùng thật), ta **diễn tập thẳng vào `hoanglong` trên LoLo**: script xóa bản sao cũ rồi nạp lại từ production; anh dùng thử ở `hoanglong.lolo.io.vn`. Production không bị đụng. Khi chuyển chính thức chỉ việc chạy lại đúng lệnh đó sau khi đóng băng ghi (nạp lại dữ liệu mới nhất).

### Những điểm tương thích multi-tenant script đã xử lý (phát hiện khi viết script)

1. **Bảng cấu hình "mỗi doanh nghiệp 1 dòng"** (`business_profile`, `shift_config`, `hrm_task_permissions`, `project_permissions`, `document_templates`): ở production `id` là chuỗi cố định (`current`, `global`…) nhưng ứng dụng multi-tenant đọc bằng `id = company_id`. Script **đổi `id` thành `company_id` đích**; nếu không, ERP sẽ không tìm thấy hồ sơ doanh nghiệp, cấu hình ca làm, phân quyền dự án, mẫu tài liệu của Hoàng Long.
2. **Thứ tự nạp theo khóa ngoại:** PostgREST không báo các khóa ngoại ghép của LoLo, nên script đọc thêm từ các tệp migration (25 khóa ngoại) + khóa ngoại production.
3. **Đọc bảng nặng:** một số bảng (ví dụ `payments`) có dòng chứa ảnh base64 làm đọc theo trang lớn bị quá giờ → script tự giảm cỡ trang, không sót dòng.
4. **Địa chỉ ảnh** được viết lại ở mọi bảng, kể cả trong JSON lồng nhau và chuỗi JSON.

### Kết quả chạy thử (không ghi) bằng dữ liệu thật — 7/10/2026

Xuất 10.037 dòng (10.072 trừ 35 đăng ký thông báo đẩy bỏ qua), 55 bảng, **4.717 tệp được dữ liệu nhắc tới, 0 tệp thiếu, 0 địa chỉ không viết lại được, 0 cảnh báo**; Storage 5.293 tệp ~1,39 GB sẵn sàng chép. Chưa ghi gì lên LoLo.

Lệnh: `node scripts/migrate-production-to-company.mjs --slug hoanglong` (chạy thử) · thêm `--ghi --xac-nhan-hoanglong` để ghi thật (có hỏi xác nhận bằng cách gõ lại câu `XOA-VA-NAP hoanglong`).

## 4. Quy trình chuyển chính thức (cửa sổ khoảng 1–3 giờ, nên làm buổi tối/cuối tuần)

| Bước | Việc | Ai | Ghi chú |
|---|---|---|---|
| 0 | Kiểm kê + báo cáo | Claude chạy khi có khóa | Không ghi gì |
| 1 | Diễn tập vào `hltest`, dùng thử, sửa lỗi | Claude + anh thử | Lặp tới khi đạt |
| 2 | **Thông báo nhân viên** ngừng nhập liệu giờ X | Anh | |
| 3 | **Đóng băng ghi trên production:** thêm chính sách chặn ghi (INSERT/UPDATE/DELETE) tạm thời — SQL đảo ngược được, tôi soạn sẵn kèm câu gỡ | Anh chạy SQL | Nhân viên vẫn xem được, không lưu được → tránh mất dữ liệu nhập dở |
| 4 | Xuất bản cuối, chép Storage, nạp vào `hoanglong` | Claude chạy | Mất khoảng vài chục phút tùy lượng ảnh |
| 5 | Kiểm chứng tự động + anh kiểm tra tay bằng số liệu quen thuộc (công nợ, quỹ, số dự án…) | Claude + anh | |
| 6 | Đạt → nhân viên chuyển sang `hoanglong.lolo.io.vn`; production **giữ nguyên chế độ chỉ đọc** (không xóa) | Anh | |
| 7 | Theo dõi 1–2 tuần; sau đó lưu trữ production | Anh | |

**Hoàn tác:** nếu bước 5 không đạt → gỡ chính sách đóng băng (production dùng lại ngay, **không mất gì**), xóa dữ liệu `hoanglong` trên LoLo theo `company_id`, sửa lỗi, làm lại. Sau bước 6 vẫn quay lại được trong thời gian production còn giữ.

## 5. Kiểm chứng "không sót, không lạc" (bắt buộc đạt hết mới coi là xong)

1. **Đếm dòng:** từng bảng, production = `hoanglong` trên LoLo (57/57 bảng).
2. **Tổng tiền/số liệu then chốt** khớp: tổng thu/chi (`receipts`, `payments`), công nợ phải thu/trả, quỹ, số nhân viên/dự án/công việc/báo giá/đơn mua.
3. **So sánh mẫu sâu:** ngẫu nhiên N dòng mỗi bảng so từng trường (sau khi trừ `company_id` và URL đã đổi).
4. **Storage:** số tệp và dung lượng từng bucket khớp; **0 URL còn trỏ về production**; kiểm tra mọi URL mới trả về tệp tồn tại.
5. **Không lạc:** không có dòng nào `company_id` null; số dòng của **mọi công ty khác y nguyên** trước/sau; dùng token công ty khác thử đọc → 0 dòng Hoàng Long; token Hoàng Long chỉ thấy dữ liệu Hoàng Long.
6. **Tương thích ứng dụng:** đăng nhập thật bằng tài khoản Hoàng Long trên `hoanglong.lolo.io.vn`, mở các màn hình chính (dự án, tài chính, nhân sự, chấm công, tin nhắn), xem ảnh cũ, tạo thử bản ghi mới rồi xóa.

## 6. Những thứ KHÔNG chuyển được thẳng (cần quyết định/làm lại)

- **Thông báo đẩy (`push_subscriptions`) và PWA đã cài:** gắn với tên miền cũ nên nhân viên phải **bật lại thông báo / cài lại app** ở địa chỉ mới. Đề xuất không chép bảng này (vô dụng ở tên miền mới); `fcm_tokens` là di sản Firebase đã bỏ — đề xuất bỏ.
- **Nhắc chấm công tự động (pg_cron + Edge Function `send-attendance-reminders`) và `send-push`:** đang chạy ở production; sau khi chuyển cần **thiết lập lại cho LoLo** và **tắt ở production** để không nhắc trùng. Phần này là cấu hình chạy phía máy chủ, không phải dữ liệu — tôi sẽ kiểm tra riêng ở diễn tập.
- **Bộ nhớ trình duyệt cũ** (`localStorage`) ở tên miền cũ không sang địa chỉ mới; không mất dữ liệu vì nguồn thật nằm trên Supabase.
- **Địa chỉ truy cập:** nhân viên dùng `hoanglong.lolo.io.vn`. Muốn giữ tên miền cũ thì cấu hình chuyển hướng ở bước sau.

## 7. Việc tôi cần ở anh để bắt đầu

1. **Khóa `service_role` của project production** (lấy ở Supabase → Settings → API) đặt vào một tệp `.env.production.local` trên máy anh (tôi sẽ chỉ rõ tên biến và đảm bảo tệp nằm trong `.gitignore`). **Đừng dán khóa vào chat.**
2. Chọn **giờ chuyển** (buổi tối/cuối tuần) và người thông báo nhân viên.
3. Quyết định 3 điểm ở §6: không chép `push_subscriptions`/`fcm_tokens`; xử lý nhắc chấm công; tên miền sau chuyển.
4. Đồng ý cho tôi viết script + test và chạy **diễn tập vào `hltest`** trước.

## 8. Ước lượng công việc

| Hạng mục | Khối lượng |
|---|---|
| Viết script + test tự động | khoảng 1 ngày làm việc |
| Kiểm kê + diễn tập + sửa lỗi phát sinh | 0,5–1 ngày (phụ thuộc số lỗi dữ liệu mồ côi) |
| Cửa sổ chuyển chính thức | khoảng 1–3 giờ (đóng băng ghi ngắn hơn: chỉ trong lúc xuất + nạp) |
