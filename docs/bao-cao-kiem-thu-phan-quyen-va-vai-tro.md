# Báo cáo kiểm thử & đánh giá chức năng "Phân Quyền Và Vai Trò"

Ngày: 09/10/2026 · Môi trường kiểm thử chuyên sâu: https://test.lolo.io.vn (doanh nghiệp TEST) · Bản ứng dụng: `index-C9u-W3UF.js` (commit `f07d8f6`)

> Giới hạn quan trọng (nói trước để tránh hiểu sai): tôi **không nhập mật khẩu** vào bất kỳ ô đăng nhập nào và **không tạo tài khoản có mật khẩu**. Bạn đã đăng nhập sẵn admin của doanh nghiệp TEST, tôi dùng phiên đó. Vì vậy các luồng "đăng nhập bằng từng tài khoản nhân viên rồi bấm thử" **chưa được kiểm tra trực tiếp**; thay vào đó tôi kiểm tra bằng (1) màn "Xem quyền của một nhân viên" (dùng đúng hàm `can()` thật), (2) kiểm tra dữ liệu thật trong cơ sở dữ liệu, (3) 704 bài test tự động. Chi tiết ở mục 5.

---

## 1. Công việc đã làm (toàn bộ đợt Phân Quyền)

| # | Việc | Kết quả |
|---|---|---|
| 1 | Điều tra vì sao Kế toán được cấp "Tạo dự án" nhưng không dùng được | Tìm ra 3 nguyên nhân gốc (xem mục 3) và sửa |
| 2 | **Tắt kế thừa quyền xuống vai trò thấp** (`inheritBelow`) | Trước đây quyền cấp cho Giám đốc/Trưởng DA lan xuống mọi nhân viên → nhân viên thường tạo/xóa được dự án, thêm cột. Đã tắt ở code + dữ liệu 2 công ty (có sao lưu) |
| 3 | Nút "Tạo Dự án" trên Kanban dùng sai quyền (`createCard`) | Đổi sang `createProject` |
| 4 | Kanban kiểm tra quyền theo đúng dự án/công việc (`canOn`) | Vai trò theo vị trí (Người giao việc, Trưởng DA đúng dự án…) giờ mới có tác dụng |
| 5 | "Thành viên" ở công việc chỉ áp dụng cho người có tên trong nhiệm vụ | Trước đây = mọi nhân viên |
| 6 | Gắn nhãn **"Chưa áp dụng"** cho ô tick không có chức năng nào kiểm tra + test canh lệch với mã nguồn | Hết cảnh "tick mà không đổi gì" |
| 7 | Gỡ hẳn cột **Tầm nhìn** (dư thừa, có chỗ gây hại) | Đã gỡ khỏi giao diện và `can()` |
| 8 | **Bộ nhóm vai trò mẫu** cho doanh nghiệp mới (4 nhóm có "Loại nhóm" + quyền dự án theo nhóm) | Đã kiểm chứng: doanh nghiệp TEST nhận đủ 4 nhóm đúng loại |
| 9 | Màn **"Xem quyền của một nhân viên"** | Chạy đúng, khớp kết quả thử thật |
| 10 | **Nhật ký thay đổi phân quyền** (+ migration `20261019`) | Ghi đúng ai/lúc nào/đổi gì ở 4 vùng |
| 11 | Tab **"Quyền Công việc"** (trước đây không có màn hình chỉnh nào) | Chỉnh/lưu/hoàn tác/lưu lại sau khi tải lại trang đều đúng |
| 12 | Sửa `getTaskRoleScope` nhận diện Giám đốc/Kế toán theo "Loại nhóm" | Trước đây Kế toán thật luôn bị coi là "không liên quan" ở công việc |
| 13 | Dọn: 2 nhóm đã xóa trong ma trận Hoàng Long; xóa modal cũ không dùng | Xong |

Chất lượng mã: 704 bài test tự động đều đạt, `tsc` sạch, build chạy.

---

## 2. Kết quả kiểm thử trên doanh nghiệp TEST

Dữ liệu tôi dựng: 6 nhân viên test (không có tên đăng nhập/mật khẩu, bật cờ "có tài khoản hệ thống" để gán nhóm được): **TEST Giám đốc, Kế toán, Trưởng dự án, Thợ A, Thợ B, Nhân viên chưa vào nhóm**; 1 khách hàng, 1 dự án, 2 công việc.

| Luồng | Kết quả | Bằng chứng |
|---|---|---|
| Bộ nhóm mẫu của doanh nghiệp mới | ✅ Đạt | 4 nhóm đúng "Loại nhóm" (admin/accounting/office/technical), Ban Giám Đốc có admin, quyền dự án theo nhóm đúng bộ mẫu |
| Gán nhân viên vào nhóm (nhiều nhóm một lần, bấm Lưu) | ✅ Đạt | `member_ids` và `employees.role_group_ids` cùng cập nhật |
| Chuyển nhân viên sang nhóm khác | ✅ Đạt | Tự rời nhóm cũ; số thay đổi chưa lưu tính đúng (1) |
| Gỡ thành viên khỏi nhóm | ✅ Đạt | Hộp xác nhận → Lưu → `role_group_ids` về rỗng |
| Báo "N thay đổi chưa lưu", số trên tab, "Hủy bỏ" | ✅ Đạt | Cả 4 tab |
| Rời tab khi còn thay đổi chưa lưu (hỏi lại) | ✅ Đạt | Chọn "không" thì ở lại; chọn "có" thì mất bản nháp |
| Đổi "Loại nhóm" | ✅ Đạt | Vào bản nháp, lưu, ghi nhật ký |
| Quyền Dự Án theo nhóm: tick → Lưu | ✅ Đạt | Lưu DB, ghi nhật ký, màn "Xem quyền" đổi ngay sang nguồn "Nhóm" |
| Quyền Dự Án theo vị trí: tick → Hủy bỏ | ✅ Đạt | Về đúng trạng thái cũ |
| Quyền Công việc: tick, Lưu, tải lại trang, Khôi phục mặc định | ✅ Đạt | Tick còn nguyên sau tải lại; khôi phục về mặc định hệ thống |
| Màn "Xem quyền nhân viên" cho 6 người | ✅ Đạt | Giám đốc: nguồn Vị trí; Kế toán: Tạo dự án qua Nhóm, Tài chính qua Vị trí; Trưởng DA: nhóm Văn phòng; Thợ/Nhân viên chưa vào nhóm: không có quyền quản trị |
| Nhật ký (tab "Nhật ký") | ✅ Đạt | 12 dòng, đúng người/giờ/vùng; xem chi tiết "từ → sang" |
| Cách ly dữ liệu giữa doanh nghiệp (RLS, đọc) | ✅ Đạt | Phiên TEST đọc `permission_audit_log`, `project_permissions`, `hrm_role_groups`, `hrm_task_permissions`, `employees`, `tasks`: mỗi bảng chỉ có dữ liệu của đúng 1 công ty |
| Tạo / xóa nhóm | ⚠️ Chạy, nhưng có lỗi (mục 3) | |
| Quyền Phê Duyệt (giao diện chọn người duyệt) | ⚪ Chưa kiểm thử sâu | Logic ghi nhật ký đã có test tự động; chưa thao tác thủ công vì giao diện chọn người duyệt khó điều khiển tự động |
| Đăng nhập bằng từng tài khoản nhân viên | ⚪ Không thực hiện | Xem giới hạn ở đầu báo cáo |
| Ghi chéo sang dữ liệu doanh nghiệp khác (kiểm tra RLS khi ghi) | ⚪ Không thực hiện | Bị hệ thống chặn vì chạm dữ liệu doanh nghiệp khác; chỉ kiểm tra được phần đọc |

---

## 3. Lỗi và điểm cần khắc phục

Xếp theo mức độ ưu tiên. "Đã kiểm chứng" = tôi tái hiện được trên doanh nghiệp TEST.

### Trung bình – nên sửa
1. **Xóa nhóm vai trò còn thành viên thì nhân viên vẫn giữ mã nhóm đã xóa** (`employees.role_group_ids`). *Đã kiểm chứng:* xóa nhóm có TEST_NG → `role_group_ids` vẫn còn `role_custom_…`. Đây cũng là nguồn của các mã nhóm "mồ côi" thấy ở Hoàng Long. Hậu quả: bước tự suy nhóm từ danh sách thành viên chỉ chạy khi mảng rỗng nên có thể bỏ sót; dữ liệu rác tích tụ. *Cách sửa:* khi xóa nhóm, gỡ mã đó khỏi mọi nhân viên.
2. **Tạo nhóm và xóa nhóm không ghi nhật ký và lưu thẳng vào DB, không qua bản nháp/thanh Lưu.** *Đã kiểm chứng:* sau khi tạo/xóa nhóm, nhật ký không có dòng nào. Không nhất quán với phần còn lại. *Cách sửa:* ghi nhật ký ở hai chỗ này (tạo ở `HumanResourcesManagement.tsx`, xóa ở `RolesTab.tsx`).
3. **Nhóm mới tạo mặc định có quyền "Xem" ở tất cả 27 phân hệ**, gồm Cài đặt, Tài khoản, Phân quyền, Tài chính, Dữ liệu nhân sự. *Đã kiểm chứng* trong DB. Vi phạm nguyên tắc ít quyền nhất: tạo nhóm xong quên chỉnh là nhóm đó xem được hầu hết. Đây là chủ ý cũ trong code (lý do ghi ở comment: tránh nhóm mới "không có quyền Xem ở đa số phân hệ") nên cần bạn quyết định. *Gợi ý:* mặc định chỉ Xem các phân hệ nghiệp vụ cơ bản, không gồm Cài đặt/Tài khoản/Phân quyền/Tài chính/Nhân sự.

### Thấp – nên cải thiện
4. **Cột của nhóm quản trị trong bảng "Vai trò nhóm HRM" hiển thị tắt và không tick**, dù nhóm đó có toàn quyền (quyền đến từ vai trò Giám đốc ở tab Theo vị trí). Dễ hiểu nhầm là nhóm Giám đốc không có quyền gì. *Cách sửa:* hiển thị tick mờ hoặc ghi chú "Toàn quyền qua vai trò Giám đốc".
5. **Câu "Thay đổi tự động lưu lại" ở bảng quyền phân hệ đã lỗi thời**: các thay đổi giờ là bản nháp và chỉ có hiệu lực sau khi bấm Lưu. *Cách sửa:* đổi câu chữ.
6. **Số "thay đổi chưa lưu" ở tab nhóm đếm theo nhóm, không theo từng người** (thêm 5 người vào 4 nhóm hiện "4 thay đổi"). Không sai về dữ liệu, chỉ chưa trực quan.
7. **Nhóm ảo "Siêu Admin" hiển thị "3 nhân sự"** dù chỉ có 1 người thật (đếm cả mã cố định `NV_ADMIN`, `admin`) và nhóm này được lưu vào DB ở lần Lưu đầu tiên. Chỉ là hiển thị.

### Thiết kế / rủi ro cần biết (không phải lỗi của đợt này)
8. **Quyền chủ yếu được kiểm tra ở giao diện (trình duyệt).** Cách ly giữa các doanh nghiệp là thật (đã kiểm chứng đọc), nhưng trong cùng một doanh nghiệp, mọi nhân viên đăng nhập đều có cùng quyền đọc/ghi ở tầng dữ liệu. Nếu cần bảo vệ lương/tài chính/xóa dự án thật sự thì phải kiểm tra thêm ở phía máy chủ.
9. **Cả 7 nhóm ở Hoàng Long đều được tick "Xem công việc"** nên mọi nhân viên thấy mọi công việc (bạn đã quyết định không xử lý).
10. **Chỉ nhân viên có "tài khoản hệ thống" mới thêm được vào nhóm** (danh sách chọn lọc theo cờ này). Nhân viên chưa có tài khoản không gán nhóm được; cần biết khi hướng dẫn người dùng.
11. Quyền Phê Duyệt chưa có kiểm thử thủ công đầy đủ (xem mục 2).

---

## 4. Đánh giá mức độ hiệu quả từng chức năng

| Chức năng | Đánh giá | Nhận xét |
|---|---|---|
| Nhóm vai trò + Loại nhóm | Tốt | Gán/chuyển/gỡ thành viên đúng, đồng bộ cả hai phía. Điểm yếu: xóa nhóm để lại dữ liệu rác; mặc định nhóm mới quá rộng |
| Quyền Dự Án — theo vị trí | Tốt | Nay có tác dụng thật nhờ truyền đúng dự án/công việc; ô vô tác dụng đã gắn nhãn |
| Quyền Dự Án — theo nhóm HRM | Tốt | Lưu, nhật ký, hiệu lực đúng. Cột nhóm quản trị gây nhầm (mục 3.4) |
| Quyền Công việc (mới) | Tốt | Trước đây không có chỗ chỉnh. Cần chú ý: cả hai công ty đang cho mọi nhóm xem mọi công việc nên cột "Xem" ít tác dụng |
| Xem quyền của nhân viên | Rất tốt | Dùng đúng hàm thật, chỉ rõ nguồn quyền; giúp tránh phải đọc ma trận |
| Nhật ký thay đổi | Tốt | Ghi đủ 4 vùng; còn thiếu tạo/xóa nhóm |
| Bản nháp + thanh Lưu ghim đáy | Rất tốt | Người dùng luôn thấy còn bao nhiêu thay đổi chưa lưu; hỏi lại khi rời tab |
| Bộ nhóm mẫu cho doanh nghiệp mới | Tốt | Đã kiểm chứng; nên rà thêm mặc định nhóm tự tạo |
| Cách ly giữa doanh nghiệp | Tốt (phần đọc) | Phần ghi chưa kiểm được trực tiếp |

---

## 5. Việc nên làm tiếp (đề xuất thứ tự)
1. Sửa lỗi 3.1 (xóa nhóm dọn `role_group_ids`) và 3.2 (ghi nhật ký tạo/xóa nhóm) — nhỏ, rủi ro thấp.
2. Quyết định về 3.3 (mặc định quyền Xem của nhóm mới).
3. Kiểm thử đăng nhập thật bằng 3–4 tài khoản (Giám đốc, Kế toán, Trưởng DA, thợ): bạn tạo mật khẩu cho 4 nhân viên TEST rồi đăng nhập vào các tab, tôi lái các tab đó để kiểm tra từng nút. Đây là phần còn thiếu so với yêu cầu "test đầy đủ".
4. Cân nhắc kiểm tra quyền ở tầng máy chủ cho dữ liệu nhạy cảm (mục 3.8).

## 6. Dữ liệu thử còn lại trong doanh nghiệp TEST
6 nhân viên `TEST_*`, khách hàng `cust_test_1`, dự án `proj_test_1`, công việc `task_test_1/2`, một dòng ma trận Quyền Công việc (đang bằng mặc định), nhóm ảo "Siêu Admin" đã được lưu, 12 dòng nhật ký. Doanh nghiệp Hoàng Long và Ngọc Thịnh không bị đụng trong lượt kiểm thử này.

---

# VÒNG 2 — Kiểm thử bằng 5 tài khoản nhân viên thật (doanh nghiệp TEST)

Tài khoản được tạo bằng nút "Tạo tài khoản nhanh" và đăng nhập bởi chủ dự án (tôi không nhập mật khẩu): TEST Giám đốc (nhóm Ban Giám Đốc), TEST Kế toán (nhóm Kế toán), TEST Trưởng dự án (nhóm Văn phòng, là Trưởng DA của dự án test), TEST Thợ A (nhóm Kỹ thuật, phụ trách công việc CV1), TEST Nhân viên chưa vào nhóm. Admin test dùng để đổi quyền.

## 7. Kết quả theo từng chức năng (đối chiếu với ma trận)
| Thử | Giám đốc | Kế toán | Trưởng DA | Thợ A | Chưa nhóm | Đúng ma trận? |
|---|---|---|---|---|---|---|
| Tạo dự án (Kanban) | ✅ | ✅ (theo nhóm) | ✅ (theo nhóm) | ⛔ | ⛔ | ✅ |
| Thêm cột | ✅ | ⛔ | ✅ (Trưởng DA) | ⛔ | ⛔ | ✅ |
| Kéo thẻ | ✅ | ⛔ | ✅ | ✅ (mặc định cho "Thành viên") | — | ✅ |
| Sửa thông tin dự án | ✅ | ✅ | ✅ | không có nút | — | ✅ |
| Xóa dự án | có nút | không có nút | có nút | không có nút | — | ✅ |
| Sửa công việc | ✅ | ⛔ | ✅ | ⛔ (là Phụ trách CV) | — | ✅ |
| Xóa công việc | có nút | không có nút | có nút | không có nút | — | ✅ |
| Lập phiếu quyết toán | — | — | — | ⛔ | ⛔ | ✅ |
| Thấy công việc nào | cả 2 | cả 2 (vai trò Kế toán) | cả 2 | chỉ CV1 của mình | không thấy gì | ✅ — xác nhận sửa lỗi nhận diện Kế toán |
| Nhận việc (Thợ A, CV1) | — | — | — | ✅ ghi nhật ký đúng người | không có nút | ✅ |
| Mở trang qua sự kiện chuyển tab (finance, settings-roles) | — | — | — | ⛔ về Tổng quan | — | ✅ |
| Menu hiển thị | Đầy đủ | Dự án, Nhân sự, Kế toán, Kho, Thầu phụ, Thư viện | Dự án, Kho, Thầu phụ, Thư viện | Dự án, Kho (xem) | **Có Nhân sự + Cài đặt hệ thống** ⚠️ | ✅ trừ cột "Chưa nhóm" |
| Đổi quyền ở admin → hiệu lực ở tab nhân viên | — | — | — | **chỉ sau khi tải lại trang** | — | ⚠️ xem 8.2 |

## 8. Lỗi mới phát hiện
### 8.1 NGHIÊM TRỌNG — nhân viên không thuộc nhóm nào được vào "Phân quyền" và "Tài khoản" và SỬA được quyền
*Đã tái hiện:* tài khoản "chưa vào nhóm" thấy menu **Hệ thống Nhân sự, Dữ liệu nhân sự, Tài Khoản Hệ Thống, Phân Quyền Và Vai Trò, Cài Đặt Hệ Thống**; mở được trang Phân quyền (có nút Thêm nhóm, Lưu), thấy danh sách 7 tài khoản kèm nút Xóa, và **đã sửa thật** ma trận Quyền Công việc rồi Lưu thành công (nhật ký ghi đúng người sửa là nhân viên đó). Tôi đã hoàn tác.
*Nguyên nhân:* `isAccessible` (App.tsx) khi nhân viên không có quyền từ nhóm thì rơi về bảng quyền cũ theo trường `role`; "Tạo tài khoản nhanh" luôn đặt `role = engineer`, mà quyền cũ của `engineer` gồm `hr-office`, `employees`, `system-office`, `settings` (kéo theo toàn bộ trang cài đặt). Trang Phân quyền không kiểm tra lại quyền "Sửa" khi lưu.
*Ảnh hưởng thật:* **Ngọc Thịnh: 5 nhân viên (4 nhân viên xưởng + 1 tổ trưởng) hiện không thuộc nhóm nào** — hai nhóm "Nhân viên xưởng" và "Tổ trưởng" đã bị xóa nhưng hồ sơ họ vẫn giữ mã nhóm cũ (lỗi mã nhóm mồ côi đã nêu ở mục 3.1, đã sửa cho các lần xóa sau nhưng chưa dọn dữ liệu cũ). **Hoàng Long: 1 nhân viên** (Nhữ Văn Phường). Các nhân viên này, nếu đăng nhập, đang có thể mở trang Phân quyền và đổi quyền.
*Cách sửa đề xuất (khẩn):* (1) bỏ cơ chế rơi về quyền cũ khi chưa có nhóm (chỉ giữ các tab lõi), (2) kiểm tra quyền Sửa/Xóa trong trang Phân quyền và Tài khoản khi lưu/xóa, (3) gán nhóm cho 5+1 nhân viên đang không có nhóm, (4) về lâu dài kiểm tra ở tầng máy chủ (xem 3.8).

### 8.2 Quyền đổi ở admin không áp dụng cho người đang đăng nhập cho tới khi họ tải lại trang
Đã tái hiện (cấp "Sửa công việc" cho Phụ trách CV: vẫn bị chặn sau >10 giây, được phép sau khi tải lại). Do realtime của các bảng phân quyền đã bị tắt có chủ ý (migration `20260826d`, App.tsx:2006). Hệ quả: **thu hồi quyền cũng chỉ có hiệu lực khi người đó tải lại** — người đã bị rút quyền vẫn thao tác được tới khi tải lại. Cân nhắc: tải lại ma trận định kỳ (vài phút) hoặc khi chuyển màn hình; hoặc bật lại realtime cho riêng bảng phân quyền (ít thay đổi nên chi phí thấp).

### 8.3 Nhỏ
- "Tạo tài khoản nhanh" đặt email cố định đuôi `@hoanglonglamdong.vn` cho mọi doanh nghiệp và đặt lại `role_group_ids` về rỗng; mật khẩu mặc định `123`.
- Thợ A thấy nút "Tạo Việc Con", "Lập Phiếu Tạm Ứng/Quyết Toán" dù không có quyền (bấm mới bị chặn) — chỉ là giao diện hiện nút thừa.
