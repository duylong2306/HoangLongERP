# Đề xuất nhóm phân quyền theo chức năng thực tế: Dự án – Công việc – Nhiệm vụ

Cập nhật: 09/10/2026 · Cơ sở: rà trực tiếp mã `ProjectKanbanBoard.tsx` (dự án + thẻ công việc), `TaskDetailModal.tsx` (cửa sổ công việc + nhiệm vụ), `ConnectedToolsModal.tsx` và các bảng quyền hiện có. **Chỉ là đề xuất, chưa sửa mã.**

Nguyên tắc: một thao tác thật chỉ do **một** ô quyết định; mỗi ô gắn với một nút/chức năng có thật; tên ô gọi đúng tên nút người dùng thấy.

## 1. DỰ ÁN (Quyền Dự Án → tab "Theo vị trí")
Chức năng thực tế ở cấp dự án / bảng Kanban, và cách đang kiểm soát:

| Chức năng thật | Nút / nơi | Đang kiểm soát | Ô hiện có |
|---|---|---|---|
| Tạo dự án (nút "Tạo Dự án", "+" trong cột) | Kanban | có | `createProject` |
| Sửa thông tin dự án (địa điểm, ngày khởi công, thời hạn, giá trị HĐ tạm tính, màu thẻ) | "Chỉnh sửa thông tin" | có | `editProjectInfo` |
| Cập nhật trạng thái / % tiến độ | kéo thẻ sang cột có luật | có | `updateProjectStatus` |
| Kéo thẻ sang cột khác | Kanban | có | `moveCard` |
| Xóa dự án | menu thẻ | có | `deleteProject` |
| Thêm nhanh khách hàng | form tạo dự án | có | `quickAddCustomer` |
| Tạo / sửa / xóa cột | menu cột | có | `createColumn` `editColumn` `deleteColumn` |
| Cấu hình tự động hóa cột | nút "Quy tắc tự động" | có | `configureColumnAutomation` |
| Xem tài chính dự án (giá trị HĐ, đã thu, thầu phụ) | chi tiết dự án | có (mới nối) | `viewProjectFinance` |
| Lập phiếu tạm ứng / quyết toán thu | chi tiết dự án | có | `settlePayment` |
| Quản lý hồ sơ BG/HĐ/NT/TL của dự án | hồ sơ dự án | có | `manageProjectDocs` |
| Tạo / sửa / xóa **công việc con** trên Kanban (+ bật tự động duyệt/chi phí/vật tư/thầu phụ/checklist) | "Thêm công việc con", menu ⋮ | có | `createTask` `editTask` `deleteTask` |
| Công cụ liên thông Phê duyệt/Chi phí/Vật tư/Báo giá/Hợp đồng/Nghiệm thu/Thanh lý + hồ sơ liên thông | thanh bên công việc, nhãn LT/HS/TP | chỉ chặn lúc lưu | `openTool*` `manageDocs` |
| **Đổi Trưởng dự án** (chọn trên avatar) | chi tiết dự án | **KHÔNG kiểm soát** | chưa có ô |
| **Đồng bộ nhân sự vào nhóm chat dự án** | chi tiết dự án | **KHÔNG kiểm soát** | chưa có ô |

**Nhóm đề xuất cho Quyền Dự Án (6 nhóm, đều có chức năng thật):**
1. **Dự án** – tạo, sửa thông tin (kể cả đổi Trưởng dự án và đồng bộ nhóm chat, xem mục 4), cập nhật trạng thái, xóa, thêm nhanh khách hàng.
2. **Bảng Kanban** – tạo/sửa/xóa cột, tự động hóa cột, kéo thẻ.
3. **Tài chính dự án** – xem tài chính, lập phiếu tạm ứng/quyết toán.
4. **Hồ sơ dự án** – quản lý hồ sơ BG/HĐ/NT/TL.
5. **Công việc trên Kanban** – tạo, sửa, xóa công việc con (từ Kanban).
6. **Công cụ liên thông** – 7 công cụ + hồ sơ liên thông.

Đã gỡ trước đó vì không có chức năng: thẻ (tạo/sửa/xóa/gán), sắp xếp cột, xuất dữ liệu dự án, sổ cái, bình luận/chat. Tệp đính kèm (`uploadAttachment`/`deleteAttachment`) đang nằm ở đây nhưng thực chất là **tệp báo cáo của nhiệm vụ** → nên chuyển sang nhóm Nhiệm vụ (mục 3) để không lẫn.

## 2. CÔNG VIỆC (Quyền Công việc)
Chức năng thật trong cửa sổ chi tiết công việc:

| Chức năng thật | Nút | Đang kiểm soát | Ô hiện có |
|---|---|---|---|
| Xem công việc | mở thẻ | có | `view` |
| Nhận việc | "Nhận Việc" | có | `receiveTask` |
| Hoàn thành / gửi duyệt | "Hoàn thành công việc", "Gửi yêu cầu phê duyệt" | có | `completeTask` |
| Duyệt / Từ chối kết quả | "Xét duyệt", "Từ chối" | có | `approveResult` `rejectResult` |
| Đổi **Phụ trách chính** của công việc | avatar | có (dùng `editTask`) | `editTask` |
| Giao thêm người tham gia | ô chọn người | có | `assignMembers` |
| Ghi nhận vi phạm kỷ luật | khối "Ghi nhận vi phạm" | có | `recordViolation` |
| Đề xuất tạm ứng thầu phụ | nút "Đề xuất tạm ứng" | có | `proposeAdvance` |
| Liên kết thầu phụ vào công việc | thẻ thầu phụ | **KHÔNG kiểm soát riêng** | chưa có ô |
| Quản lý nhiệm vụ con (tạo / nhập / sửa / xóa) | khối nhiệm vụ | có | `manageSubTask` |

Ô không có chức năng (chờ gỡ): Lập phiếu phạt, Quyết toán thanh toán, Quản lý hồ sơ liên thông, Gán thợ phụ — đã rà, cả 4 đều không điều khiển nút nào.

**Nhóm đề xuất cho Quyền Công việc (5 nhóm):**
1. **Xem công việc** – `view`.
2. **Vòng đời công việc** – nhận việc, hoàn thành/gửi duyệt, duyệt, từ chối.
3. **Nhân sự công việc** – đổi Phụ trách chính, giao người tham gia. *(Đổi tên ô `editTask` thành "Đổi người phụ trách chính" để không nhầm với "Sửa công việc" ở Kanban.)*
4. **Kỷ luật & tài chính** – ghi nhận vi phạm, đề xuất tạm ứng thầu phụ, liên kết thầu phụ (nếu muốn kiểm soát).
5. *(nhiệm vụ con chuyển sang mục 3)*

## 3. NHIỆM VỤ (nhiệm vụ con trong công việc)
Chức năng thật trong khối "Nhiệm vụ chi tiết" và cửa sổ chi tiết nhiệm vụ:

| Chức năng thật | Đang kiểm soát bởi |
|---|---|
| Tạo nhiệm vụ, Nhập Excel | `manageSubTask` |
| Xuất Excel danh sách nhiệm vụ | không (chỉ xem) |
| Sửa tên / hạn nhiệm vụ | quyền cấp nhiệm vụ (`canManageMission`) |
| Xóa nhiệm vụ | `canManageMission` |
| Gán / gỡ **phụ trách chính**, thêm / gỡ **thành viên** | `canManageMission` |
| Tích checklist | `canManageMission` |
| Ghi nhận công tác phí (CTP) | `canManageMission` |
| Báo cáo công việc + **đính kèm tệp** (chụp/tải/xóa) | `canManageMission` + (mới) `uploadAttachment`/`deleteAttachment` |
| Xác nhận hoàn thành nhiệm vụ | `canManageMission` |

Hiện **toàn bộ** thao tác nhiệm vụ dùng một cổng chung "phụ trách chính của nhiệm vụ hoặc có Quản lý nhiệm vụ con" — thô nhưng không chồng chéo.

**Nhóm đề xuất cho Nhiệm vụ (3 nhóm), gắn với thao tác thật:**
1. **Quản lý nhiệm vụ** – tạo, nhập Excel, sửa, xóa.
2. **Phân công nhiệm vụ** – gán/gỡ phụ trách chính, thêm/gỡ thành viên.
3. **Thực hiện nhiệm vụ** – tích checklist, báo cáo + tệp đính kèm (tải lên/xóa), ghi nhận công tác phí, xác nhận hoàn thành.

Thực hiện qua 3 bước an toàn (không ai mất quyền): tách ô theo nhóm, ô mới **mặc định lấy theo cổng hiện tại** (`manageSubTask`/phụ trách chính) khi dữ liệu đã lưu chưa có.

## 4. Chồng chéo / lỗ hổng cần quyết định
| Vấn đề | Đề xuất |
|---|---|
| **Đổi Trưởng dự án** và **Đồng bộ nhân sự vào nhóm chat** ai cũng bấm được khi mở chi tiết dự án | Nối vào `editProjectInfo` (đổi PM) và một ô mới nhỏ hoặc cũng `editProjectInfo` (đồng bộ chat). **Đây là lỗ hổng thật, nên làm trước.** |
| `editTask` có ở **hai nơi** (Quyền Dự Án: sửa công việc từ Kanban; Quyền Công việc: đổi phụ trách chính) | Giữ cả hai nhưng đổi tên ô ở Quyền Công việc cho đúng nút ("Đổi người phụ trách chính") |
| Tệp đính kèm nằm ở Quyền Dự Án nhưng là tệp của **nhiệm vụ** | Chuyển nhóm sang Nhiệm vụ → "Thực hiện nhiệm vụ" |
| Công cụ liên thông chỉ chặn lúc lưu, nút luôn hiện | Ẩn/làm mờ nút theo ô `openTool*` ngay khi mở |
| Tab "Vai trò nhóm HRM" (Quyền Dự Án) đọc cả thao tác **trong công việc** theo nhóm, còn Quyền Công việc chỉ theo vai trò | Đã quyết định giữ hai tab riêng, không gộp; ghi chú rõ để người dùng không nhầm |
| 4 ô Quyền Công việc chưa nối | Gỡ khỏi giao diện (giữ dữ liệu) |

## 5. Thứ tự thực hiện gợi ý
1. Nối 2 lỗ hổng (đổi Trưởng dự án, đồng bộ chat) vào `editProjectInfo` — rủi ro thấp, đóng lỗ hổng.
2. Gỡ 4 ô Quyền Công việc không có chức năng; đổi tên ô `editTask` bên Quyền Công việc.
3. Sắp lại nhóm hiển thị theo mục 1, 2 (chỉ đổi cách nhóm, chưa đổi dữ liệu).
4. Tách nhóm Nhiệm vụ (mục 3) có quy tắc mặc định tương đương — cần thử trên doanh nghiệp test, làm sau khi bạn xác nhận.
5. Ẩn nút công cụ liên thông theo quyền.
