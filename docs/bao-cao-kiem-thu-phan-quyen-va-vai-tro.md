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

### 8.2 Quyền đổi ở admin áp dụng chậm cho người đang đăng nhập (ĐÃ SỬA)
*Phát hiện:* cấp "Sửa công việc" cho Phụ trách CV, sau ~15 giây tab nhân viên vẫn bị chặn. **Đính chính:** trong báo cáo ban đầu tôi ghi "chỉ sau khi tải lại trang" — chưa chính xác. Các bảng phân quyền không dùng realtime mà được poll mỗi 5 phút (thiết kế để tiết kiệm chi phí realtime, migration `20260826d`), nên độ trễ thật là tối đa 5 phút; thu hồi quyền cũng trễ chừng đó.
*Đã sửa (commit `2cca50d`):* poll riêng mỗi 60 giây cho ma trận Quyền Dự Án/Công việc, nhóm vai trò, hồ sơ nhân viên; làm tươi ngay khi tab hiện lại; nhóm của người đang đăng nhập được đồng bộ.
*Đã kiểm chứng trên bản deploy:* cấp quyền → hiệu lực ở tab nhân viên sau ~22 giây (không tải lại); thu hồi → bị chặn lại sau ~48 giây.

### 8.3 Nhỏ
- "Tạo tài khoản nhanh" đặt email cố định đuôi `@hoanglonglamdong.vn` cho mọi doanh nghiệp và đặt lại `role_group_ids` về rỗng; mật khẩu mặc định `123`.
- Thợ A thấy nút "Tạo Việc Con", "Lập Phiếu Tạm Ứng/Quyết Toán" dù không có quyền (bấm mới bị chặn) — chỉ là giao diện hiện nút thừa.

---

# VÒNG 3 — Đánh giá nút chức năng Dự án / Công việc / Nhiệm vụ so với Quyền Dự Án và Quyền Công việc

Thử trên doanh nghiệp TEST với 5 tài khoản thật (Giám đốc, Kế toán, Trưởng DA, Thợ A, Nhân viên chưa nhóm); dựng thêm 3 nhiệm vụ test (NV1 trong CV1; NV2, NV3 trong CV2) để thử cấp nhiệm vụ. Phương pháp: mở từng màn, liệt kê nút hiển thị, bấm thử để xem có bị chặn không, đối chiếu mã nguồn.

## 9. Cấp DỰ ÁN (Kanban) — hợp lý, có 3 điểm lệch nhỏ
| Nút / thao tác | GĐ | KT | Trưởng DA | Thợ A | Đánh giá |
|---|---|---|---|---|---|
| Tạo Dự án | ✅ | ✅ (theo nhóm) | ✅ (theo nhóm) | ⛔ | Đúng |
| Thêm cột / Sửa cột / Xóa cột / Tự động hóa cột | ✅ | ⛔ | ✅ (Trưởng DA) | ⛔ | Đúng khi bấm; nút hiện nhưng đã được làm mờ (xám, con trỏ cấm) khi không có quyền — kiểm tra lại mã nguồn xác nhận |
| Kéo thẻ | ✅ | ⛔ | ✅ | ✅ (mặc định cho "Thành viên") | Đúng ma trận; nhưng nên xem lại có muốn thợ tự kéo thẻ |
| Sửa thông tin / Xóa dự án | ✅ / ✅ | ✅ / ẩn | ✅ / ✅ | ẩn / ẩn | Đúng (nút ẩn khi không có quyền) |
| Lập phiếu tạm ứng / quyết toán | ✅ | ✅ | ✅ | ẩn | Đúng (đã ẩn ở vòng trước) |

**Lệch 1:** 4 ô quyền **Sửa thẻ dự án, Xóa thẻ dự án, Gán thành viên thẻ, Xem tài chính dự án** vẫn được tính "có tác dụng" nhưng thực tế chỉ khai báo biến rồi không dùng ở đâu trong giao diện Kanban (`canEdit`, `canDelete`, `canAssignCardMember`, `canView` có 1 lần khai báo, 0 lần dùng). Nhãn "Chưa áp dụng" đang **thiếu** ở 4 ô này, và test canh lệch chỉ đếm chỗ khai báo nên không bắt được. **Lệch 2:** "Sắp xếp cột" không có nơi dùng (đã gắn nhãn). **Lệch 3:** nút điều khiển cột hiện cho mọi người dù không có quyền.

## 10. Cấp CÔNG VIỆC — chạy đúng nhưng có 2 hệ quyền song song
- **Thấy công việc nào:** đúng. Thợ A chỉ thấy CV1 (việc mình phụ trách), thấy CV2 khi là phụ trách chính nhiệm vụ trong CV2; Trưởng DA và Kế toán thấy cả hai; nhân viên chưa nhóm không thấy gì.
- **Nhận việc:** chỉ Thợ A (phụ trách CV1) có nút; Giám đốc/Trưởng DA/Kế toán không có nút. Đúng thiết kế (admin không nhận hộ việc).
- **Sửa/Xóa công việc ở Kanban (menu ⋮)** dùng ma trận **Quyền Dự Án**; còn **bên trong cửa sổ chi tiết công việc** lại dùng ma trận **Quyền Công việc**. Hai ma trận có mặc định khác nhau (VD xóa công việc: Quyền Dự Án chỉ Giám đốc + Trưởng DA; Quyền Công việc thêm cả Người giao việc) → cùng một việc nhưng kết quả phụ thuộc vào cửa vào.
- **Cửa sổ chi tiết bị khóa chỉ-xem theo danh tính cứng** (`isReadOnlyTask` ở ProjectKanbanBoard): chỉ Giám đốc (theo trường `role`), người phụ trách, người giao việc hoặc Trưởng DA mới thao tác được; **mọi vai trò khác (kể cả Kế toán dù ma trận cho phép quyết toán/hồ sơ) luôn chỉ xem**. Nghĩa là các ô của cột "Kế Toán" trong Quyền Công việc không có tác dụng.
- **Ô Quyền Công việc không có tác dụng trong cửa sổ chi tiết:** Lập phiếu phạt (`issuePenalty`), Quyết toán (`settlePayment`), Quản lý hồ sơ (`manageDocs`), Xóa công việc (`deleteTask`) — được tính sẵn nhưng không nối vào nút nào.

## 11. Cấp NHIỆM VỤ — chưa hợp lý, có lỗi phân quyền cần sửa
*Đã kiểm chứng:*
1. **Người phụ trách chính của MỘT nhiệm vụ sửa/xóa/hoàn thành được nhiệm vụ của NGƯỜI KHÁC trong cùng công việc.** Thợ A (phụ trách chính NV2, không phải phụ trách CV2) thấy nút *Sửa tên/hạn*, *Xóa nhiệm vụ này*, *Thêm thợ*, *XÁC NHẬN HOÀN THÀNH* trên **NV3 của Thợ B**. Nguyên nhân: quyền cấp nhiệm vụ tính bằng `canReceive || canAssignMembers || canManageSubTask || là-phụ-trách-chính-của-nhiệm-vụ-đó` — hai điều kiện đầu là quyền cấp CÔNG VIỆC nên có là áp cho MỌI nhiệm vụ trong công việc.
2. **Phụ trách chính nhiệm vụ lại có khối "Khởi tạo nhiệm vụ" (tạo nhiệm vụ mới), "Thêm đầu mục", "Gửi vi phạm"** dù ma trận "Quản lý nhiệm vụ con" (`manageSubTask`) không cấp cho vai trò này: khối tạo nhiệm vụ hiển thị khi có `assignMembers` **hoặc** `assignSubWorkers` **hoặc** `manageSubTask`, mà mặc định `assignMembers` (thêm/xóa người tham gia) có cả "Phụ trách nhiệm vụ" → quyền thêm người bị hiểu thành quyền tạo/xóa nhiệm vụ.
3. **Nút Import (nhập Excel nhiệm vụ) và Export hiện cho mọi người, kể cả người chỉ-xem (Kế toán); hàm Import không kiểm tra quyền.** (xác nhận qua mã nguồn và qua việc nút hiện ở tài khoản chỉ-xem; chưa tải thử một tệp thật.)
4. Người chỉ-xem (Kế toán) thấy nút "XÁC NHẬN HOÀN THÀNH" ở bảng nhiệm vụ nhưng bị khóa (đúng, chỉ là hiển thị thừa).
5. Giám đốc có "XÁC NHẬN HOÀN THÀNH" nhiệm vụ của người khác, trong khi "Nhận việc/Hoàn thành công việc" cố ý chỉ cho người được giao — hai quy tắc trái nhau.

## 12. Đề xuất sửa (theo ưu tiên)
1. Quyền cấp nhiệm vụ phải xét **theo từng nhiệm vụ**: người phụ trách chính/thành viên của nhiệm vụ đó + (Giám đốc, Trưởng DA, Người giao việc, Phụ trách CV) — không để phụ trách một nhiệm vụ làm được trên nhiệm vụ khác.
2. Tách rõ `assignMembers` (thêm/bớt người) khỏi `manageSubTask` (tạo/sửa/xóa nhiệm vụ): khối "Khởi tạo nhiệm vụ", sửa, xóa chỉ theo `manageSubTask`.
3. Chặn Import theo quyền quản lý nhiệm vụ (và ẩn nút cho người chỉ-xem).
4. Thống nhất sửa/xóa công việc về **một** ma trận; thay `isReadOnlyTask` bằng kiểm tra theo ma trận (để cột Kế toán có tác dụng) hoặc ghi rõ giới hạn.
5. Gắn nhãn "Chưa áp dụng" cho 4 ô cấp thẻ nêu ở mục 9 và 4 ô công việc ở mục 10; làm test canh lệch đếm chỗ DÙNG thay vì chỗ khai báo.
6. (Không cần làm: nút điều khiển cột đã được làm mờ khi không có quyền — đính chính sau khi đọc lại mã nguồn.)

## 13. ĐÃ SỬA (commit sau báo cáo vòng 3)
1. Quyền cấp nhiệm vụ tính **theo từng nhiệm vụ** (`canManageMission`): phụ trách chính của CHÍNH nhiệm vụ đó hoặc người có quyền "Quản lý nhiệm vụ con" — không còn lẫn quyền cấp công việc nên Thợ A không còn sửa/xóa/hoàn thành nhiệm vụ của Thợ B.
2. Khối "Khởi tạo nhiệm vụ" chỉ hiện với quyền "Quản lý nhiệm vụ con" (không còn do quyền "Thêm/xóa người tham gia").
3. **Import** Excel nhiệm vụ: hàm kiểm tra quyền; nút ẩn với người không có quyền (Export vẫn xem được).
4. Chế độ chỉ-xem của cửa sổ công việc dùng chung `isTaskReadOnlyFor` (Kanban và Công việc): Giám đốc thuộc nhóm quản trị không còn bị khóa nếu trường role không phải "director"; vai trò được ma trận cho duyệt/từ chối/sửa/quản lý nhiệm vụ không còn bị khóa. Kế toán và phụ trách chính nhiệm vụ (không phải người được giao) vẫn chỉ-xem — cố ý, để không nhận hộ việc người khác.
5. Nhãn "Chưa áp dụng" cho 4 ô cấp thẻ (đã gỡ khỏi bảng "có tác dụng" và xóa biến thừa ở Kanban) và 5 ô Quyền Công việc chưa nối vào nút nào.
*Giữ nguyên có chủ đích:* Giám đốc vẫn xác nhận hoàn thành được nhiệm vụ của người khác (quyền quản lý nhiệm vụ) — khác với nhận/hoàn thành CÔNG VIỆC chỉ cho người được giao; nếu muốn thống nhất cần quyết định riêng.

---

# VÒNG 4 — Kiểm thử các công cụ kết nối trong công việc (Phê duyệt, Chi phí, Báo giá, Hợp đồng, Nghiệm thu, Thanh lý)

Thực hiện trên doanh nghiệp TEST: bật các tính năng trên công việc thử (task_test_1/2), thao tác bằng nhiều tài khoản nhân viên.

## 14. Cách các công cụ đang được kiểm soát quyền
| Công cụ | Cờ quyền (Quyền Dự Án) | Chặn ở đâu |
|---|---|---|
| Phê duyệt | `openToolApproval` | khi **gửi/lưu** (ConnectedToolsModal ~dòng 693) |
| Chi phí | `openToolCost` | khi **lưu** phiếu chi phí (~1334) |
| Hợp đồng / Nghiệm thu / Thanh lý | `openToolContract` / `openToolAcceptance` / `openToolLiquidation` | khi **ký/lưu** hồ sơ (~2181) |
| Vật tư | `openToolMaterial` | khi **lưu** (~2365) |
| Báo giá | `openToolQuotation` | **không dùng ở đâu** — cờ được tính (dòng 346) nhưng không có chỗ nào đọc |
| Các nút hồ sơ ở thanh bên (Hợp đồng…) | — | chỉ điều hướng sang Kho hồ sơ, nên quyền do phân hệ Kho hồ sơ quyết định, không phải cờ `openTool*` |

## 15. Kết quả
1. **Nút công cụ luôn hiện với mọi người** có quyền xem công việc; cờ `openTool*` chỉ chặn ở bước lưu/gửi. Người không có quyền vẫn mở được cửa sổ, nhập xong mới bị từ chối → trải nghiệm kém (nhập mất công rồi báo lỗi).
2. **Ô "Mở công cụ Báo giá" trong Quyền Dự Án không có tác dụng** — tích hay bỏ tích đều không ảnh hưởng. Nên gắn nhãn "Chưa áp dụng" (như 4 ô cấp thẻ ở vòng 3) hoặc nối vào nút thật.
3. Các công cụ còn lại (Phê duyệt, Chi phí, Hợp đồng, Nghiệm thu, Thanh lý, Vật tư) **có chặn ở bước lưu**, đúng theo ma trận.
4. Nút hồ sơ chỉ là lối tắt sang Kho hồ sơ nên quyền bị quyết định bởi phân hệ đó, dễ gây hiểu lầm rằng "đã bỏ tích mà vẫn mở được".

## 16. Đề xuất
1. Ẩn hoặc làm mờ nút công cụ khi cờ `openTool*` tương ứng = không (chặn ngay khi mở, không đợi đến lúc lưu) — giữ nguyên chặn ở bước lưu làm lớp thứ hai.
2. Xử lý ô Báo giá: nhãn "Chưa áp dụng" hoặc nối vào nút.
3. Ghi rõ trong màn Quyền Dự Án rằng nút hồ sơ phụ thuộc quyền phân hệ Kho hồ sơ.

## 17. Dọn dữ liệu thử (còn lại trong TEST)
Cờ tính năng trên task_test_1/2 cần trả về `null`, trạng thái CV1/CV2 trả về `todo`; nhiệm vụ mission_test_1/2/3 là dữ liệu thử còn lại.

---

# VÒNG 5 — Kiểm thử lại sau đợt chỉnh Quyền Dự Án / Quyền Công việc (09/10/2026)

Thực hiện trên doanh nghiệp TEST, bản deploy `dad6d2f`, dự án `TEST Dự án phân quyền`, 6 tab đăng nhập sẵn: **Long Nguyen (quản trị), TEST Giám đốc, TEST Kế toán, TEST Trưởng dự án, TEST Thợ A (phụ trách CV), TEST Nhân viên chưa vào nhóm**. Công việc: CV1 (giao: Trưởng dự án, phụ trách: Thợ A; NV1: Thợ A), CV2 (giao: Giám đốc, phụ trách: Thợ B; NV2: Thợ A, NV3: Thợ B). Bật tạm trạng thái "Đang làm" + các công cụ để nút hiện đủ, kiểm xong đã trả về ban đầu. Chỉ quan sát nút/ô khóa và bấm các nút bị chặn (không tạo/xóa dữ liệu).

## 14. Kết quả theo vai trò — cấp DỰ ÁN
| Chức năng | Quản trị | Giám đốc | Trưởng DA | Kế toán | Thợ A | Chưa vào nhóm |
|---|---|---|---|---|---|---|
| Sửa thông tin dự án | ✓ | ✓ | ✓ | ✓ (*) | ẩn | ẩn |
| Đổi Trưởng dự án | mở | mở | mở | mở (*) | **khóa** | **khóa** |
| Đồng bộ nhân sự vào nhóm chat | mở | mở | mở | mở (*) | **khóa** | **khóa** |
| Khối tài chính (giá trị HĐ, đã thu, thầu phụ) | thấy | thấy | thấy | thấy | **ẩn** | **ẩn** |
| Nút "Lập Phiếu Tạm Ứng/Quyết Toán" | ✓ | ✓ | ✓ | ✓ | **ẩn** | **ẩn** |
| Xóa dự án | ✓ | ✓ | ✓ | ẩn | ẩn | ẩn |
| Xóa công việc con (menu ⋮) | ✓ | ✓ | ✓ | ẩn | ẩn | — |
(*) Kế toán được quyền này vì nhóm Kế toán mặc định có "Sửa thông tin dự án".

## 15. Kết quả — cấp CÔNG VIỆC
- **Công cụ liên thông** (cửa sổ công việc và menu LT trên thẻ Kanban): khóa mờ kèm "(Không có quyền)" đúng theo ma trận — Thợ A: Phê duyệt mở / Chi phí khóa / Vật tư mở trên CV1; trên CV2 (chỉ là phụ trách một nhiệm vụ) Phê duyệt khóa, Chi phí khóa, Vật tư mở. Kế toán: Chi phí mở, Phê duyệt + Vật tư khóa.
- **Khối "Ghi nhận vi phạm"**: Quản trị / Giám đốc / Trưởng DA / Thợ A có; **Kế toán không**. Người chưa vào nhóm **không thấy công việc nào** của dự án.
- **Khối tạo nhiệm vụ + Import**: chỉ Quản trị / Giám đốc / Trưởng DA / (Phụ trách CV = Thợ A trên CV1). Kế toán và Thợ A trên CV2 (không phải phụ trách CV) **không có**.

## 16. Kết quả — cấp NHIỆM VỤ (điểm mấu chốt của đợt sửa)
| Người | Nhiệm vụ | Nút Sửa / Xóa / Gỡ người | Mở popup: gán, thêm thợ, file báo cáo, công tác phí |
|---|---|---|---|
| Thợ A | NV2 (của mình, trong CV2) | có | có |
| Thợ A | NV3 (của Thợ B, cùng CV2) | **không** | **không** (ô báo cáo khóa, không có File báo cáo / CTP / Thêm thợ) |
| Kế toán | NV2, NV3 | không | không |
| Trưởng DA / Giám đốc | cả hai | có | có |
Đây là lỗi nghiêm trọng của vòng 3 ("phụ trách chính nhiệm vụ này sửa được nhiệm vụ của người khác") — **đã hết**.

## 17. So với báo cáo lần trước
| Vấn đề lần trước | Nay |
|---|---|
| Nhân viên chưa vào nhóm vào được Phân quyền/Tài khoản/Nhân sự | **Đã hết**: không thấy menu nào của Hệ thống, Kho; không thấy công việc |
| Quyền nhiệm vụ lẫn sang nhiệm vụ của người khác | **Đã hết** (xem mục 16) |
| Thợ A thấy nút thừa "Lập Phiếu Tạm Ứng/Quyết Toán" | **Đã ẩn** |
| Công cụ liên thông chỉ chặn lúc lưu | **Khóa ngay từ nút** |
| Ai cũng đổi được Trưởng dự án, đồng bộ nhóm chat | **Đã khóa theo "Sửa thông tin dự án"** |
| Số tiền hợp đồng ai mở thẻ cũng thấy | **Chỉ vai trò có "Xem tài chính dự án"** |
| Bảng phân quyền đầy ô "Chưa áp dụng", ô trùng giữa hai tab | **0 nhãn** ở cả 3 tab; ô thừa đã gỡ, nhóm theo chức năng thật |
| Quyền thay đổi áp dụng chậm | Giữ ~1 phút (đã sửa từ trước) |

## 18. Vấn đề còn lại phát hiện trong vòng này
1. **(Trung bình) Người chưa vào nhóm vẫn mở được form "Tạo thẻ việc con"** và **được phép lưu**: ở cấp dự án/Kanban mọi nhân viên được tính là vai "Thành viên" (`getProjectRoleScopes` khi không có công việc cụ thể), và ma trận mặc định cho "Thành viên" tạo công việc (`createTask`) / kéo thẻ (`moveCard`). Hệ quả: nhân viên chưa thuộc nhóm nào cũng tạo/kéo được thẻ ở bất kỳ dự án nào họ nhìn thấy. Đề xuất: ở cấp dự án chỉ tính "Thành viên" cho người thực sự tham gia dự án hoặc thuộc nhóm có quyền xem phân hệ dự án.
2. **(Thấp) Nút hiện nhưng bị chặn khi bấm**: Tạo Dự án, Thêm Cột, Tự động hóa, Khôi phục Mặc định (người không có quyền thấy nút, bấm ra thông báo "Không có quyền"); "Sửa công việc" ở menu ⋮ của công việc cũng vậy. Hành vi an toàn nhưng gây khó hiểu — nên ẩn/làm mờ như nút công cụ liên thông.
3. **(Cần quyết định) Kế toán đổi được Trưởng dự án và đồng bộ nhóm chat**, vì nhóm Kế toán mặc định có "Sửa thông tin dự án". Nếu không muốn, bỏ ô này khỏi nhóm Kế toán trong Quyền Dự Án → Vai trò nhóm HRM.
4. Chưa kiểm: Thợ B (không có tab đăng nhập), nút duyệt/từ chối khi công việc ở trạng thái "Chờ duyệt", nút "Nhận Việc", thao tác ghi dữ liệu thật (chỉ quan sát giao diện).
