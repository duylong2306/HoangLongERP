# Đối chiếu tắt kế thừa quyền Dự Án (inheritBelow: true → false)

Bảng dựa trên ma trận đang lưu TRƯỚC khi tắt (bản sao lưu `migration-snapshot/sua-du-lieu/project_permissions-truoc-tat-ke-thua.json`).

- **Được tick**: các vai trò được cấp rõ ràng — vẫn giữ nguyên.
- **MẤT**: vai trò từng có quyền *ngầm* do kế thừa nay không còn. ⚠️ = thao tác hằng ngày của người làm việc (công việc, nhiệm vụ con, phân công, hồ sơ, bình luận, tệp) mà vai trò làm việc thật (Người giao việc / Phụ trách CV / Phụ trách NV) bị mất → nên cân nhắc tick lại. Các nhóm quản trị (Cấp dự án, Cột, Thẻ, Tài chính, Kỷ luật) mất quyền với người làm việc thường là ĐÚNG ý nên không đánh ⚠️. Chỉ mất "Nhân viên thường"/"Kế toán" thì thường là đúng ý (kế toán vẫn có quyền theo *nhóm vai trò*).

## Hoàng Long

**🏗️ CẤP DỰ ÁN**

| Hành động | Được tick | MẤT |
|---|---|---|
| Tạo dự án mới | Giám đốc, Trưởng DA, Kế toán | Người giao việc, Phụ trách CV, Phụ trách NV, Nhân viên thường |
| Sửa thông tin dự án | Giám đốc, Trưởng DA, Kế toán | Người giao việc, Phụ trách CV, Phụ trách NV, Nhân viên thường |
| Cập nhật trạng thái / % tiến độ | Giám đốc, Trưởng DA, Kế toán | Người giao việc, Phụ trách CV, Phụ trách NV, Nhân viên thường |
| Xem tài chính dự án | Giám đốc, Trưởng DA, Kế toán | Người giao việc, Phụ trách CV, Phụ trách NV, Nhân viên thường |
| Xóa dự án | Giám đốc, Trưởng DA | Người giao việc, Phụ trách CV, Phụ trách NV, Nhân viên thường, Kế toán |
| Xuất dữ liệu dự án | Giám đốc, Trưởng DA, Người giao việc, Kế toán | Phụ trách CV, Phụ trách NV, Nhân viên thường |
| Thêm nhanh khách hàng | Giám đốc, Trưởng DA, Người giao việc, Kế toán | Phụ trách CV, Phụ trách NV, Nhân viên thường |

**📋 CỘT KANBAN**

| Hành động | Được tick | MẤT |
|---|---|---|
| Tạo cột mới | Giám đốc, Trưởng DA | Người giao việc, Phụ trách CV, Phụ trách NV, Nhân viên thường, Kế toán |
| Sửa cột | Giám đốc, Trưởng DA | Người giao việc, Phụ trách CV, Phụ trách NV, Nhân viên thường, Kế toán |
| Xóa cột | Giám đốc, Trưởng DA | Người giao việc, Phụ trách CV, Phụ trách NV, Nhân viên thường, Kế toán |
| Sắp xếp thứ tự cột | Giám đốc, Trưởng DA | Người giao việc, Phụ trách CV, Phụ trách NV, Nhân viên thường, Kế toán |
| Cấu hình tự động hóa cột | Giám đốc, Trưởng DA | Người giao việc, Phụ trách CV, Phụ trách NV, Nhân viên thường, Kế toán |

**🃏 THẺ DỰ ÁN**

| Hành động | Được tick | MẤT |
|---|---|---|
| Tạo thẻ dự án | Giám đốc, Trưởng DA, Người giao việc, Phụ trách CV | Phụ trách NV, Nhân viên thường, Kế toán |
| Sửa thẻ dự án | Giám đốc, Trưởng DA, Người giao việc, Phụ trách CV | Phụ trách NV, Nhân viên thường, Kế toán |
| Xóa thẻ dự án | Giám đốc, Trưởng DA | Người giao việc, Phụ trách CV, Phụ trách NV, Nhân viên thường, Kế toán |
| Kéo thẻ qua cột | Giám đốc, Trưởng DA, Người giao việc | Phụ trách CV, Phụ trách NV, Nhân viên thường, Kế toán |
| Gán thành viên thẻ | Giám đốc, Trưởng DA, Người giao việc, Phụ trách CV | Phụ trách NV, Nhân viên thường, Kế toán |

**✅ CÔNG VIỆC**

| Hành động | Được tick | MẤT |
|---|---|---|
| ⚠️ Tạo công việc | Giám đốc, Trưởng DA, Người giao việc, Phụ trách CV, Nhân viên thường, Kế toán | Phụ trách NV |
| ⚠️ Sửa công việc | Giám đốc, Trưởng DA, Người giao việc, Kế toán | Phụ trách CV, Phụ trách NV, Nhân viên thường |
| ⚠️ Xóa công việc | Giám đốc, Trưởng DA | Người giao việc, Phụ trách CV, Phụ trách NV, Nhân viên thường, Kế toán |
| ⚠️ Giao việc | Giám đốc, Trưởng DA, Người giao việc, Phụ trách CV, Kế toán | Phụ trách NV, Nhân viên thường |
| ⚠️ Nhận việc | Phụ trách CV, Giám đốc, Trưởng DA, Kế toán | Người giao việc, Phụ trách NV, Nhân viên thường |
| ⚠️ Hoàn thành | Phụ trách CV, Giám đốc, Trưởng DA, Kế toán | Người giao việc, Phụ trách NV, Nhân viên thường |
| ⚠️ Duyệt kết quả | Giám đốc, Trưởng DA, Người giao việc, Kế toán | Phụ trách CV, Phụ trách NV, Nhân viên thường |
| ⚠️ Từ chối duyệt | Giám đốc, Trưởng DA, Người giao việc, Kế toán | Phụ trách CV, Phụ trách NV, Nhân viên thường |

**🧩 NHIỆM VỤ CON**

| Hành động | Được tick | MẤT |
|---|---|---|
| ⚠️ Tạo nhiệm vụ con | Giám đốc, Trưởng DA, Người giao việc, Phụ trách CV, Kế toán | Phụ trách NV, Nhân viên thường |
| ⚠️ Sửa nhiệm vụ con | Giám đốc, Trưởng DA, Người giao việc, Phụ trách CV, Kế toán | Phụ trách NV, Nhân viên thường |
| ⚠️ Xóa nhiệm vụ con | Giám đốc, Trưởng DA, Người giao việc, Phụ trách CV, Kế toán | Phụ trách NV, Nhân viên thường |
| ⚠️ Gán phụ trách chính | Giám đốc, Trưởng DA, Người giao việc, Phụ trách CV, Kế toán | Phụ trách NV, Nhân viên thường |
| ⚠️ Gán thành viên nhiệm vụ | Giám đốc, Trưởng DA, Người giao việc, Phụ trách CV, Kế toán | Phụ trách NV, Nhân viên thường |
| ⚠️ Gán thợ phụ | Giám đốc, Trưởng DA, Người giao việc, Phụ trách CV, Kế toán | Phụ trách NV, Nhân viên thường |
| Xác nhận hoàn thành | Giám đốc, Trưởng DA, Người giao việc, Phụ trách CV, Phụ trách NV, Kế toán | Nhân viên thường |
| Ghi nhận công tác phí | Giám đốc, Trưởng DA, Người giao việc, Phụ trách CV, Phụ trách NV, Kế toán | Nhân viên thường |

**👥 PHÂN CÔNG & THAM GIA**

| Hành động | Được tick | MẤT |
|---|---|---|
| ⚠️ Phân công người tham gia | Giám đốc, Trưởng DA, Người giao việc, Phụ trách CV | Phụ trách NV, Nhân viên thường, Kế toán |

**💰 TÀI CHÍNH**

| Hành động | Được tick | MẤT |
|---|---|---|
| Đề xuất tạm ứng | Giám đốc, Trưởng DA, Phụ trách CV, Nhân viên thường, Người giao việc | Phụ trách NV, Kế toán |
| Quyết toán thanh toán | Giám đốc, Trưởng DA, Kế toán, Người giao việc | Phụ trách CV, Phụ trách NV, Nhân viên thường |
| Xem sổ cái thu chi | Giám đốc, Trưởng DA, Kế toán | Người giao việc, Phụ trách CV, Phụ trách NV, Nhân viên thường |

**🚨 KỶ LUẬT**

| Hành động | Được tick | MẤT |
|---|---|---|
| Ghi nhận vi phạm | Giám đốc, Trưởng DA, Người giao việc | Phụ trách CV, Phụ trách NV, Nhân viên thường, Kế toán |
| Lập phiếu phạt | Giám đốc, Trưởng DA, Kế toán | Người giao việc, Phụ trách CV, Phụ trách NV, Nhân viên thường |

**🗣️ BÌNH LUẬN & CHAT**

| Hành động | Được tick | MẤT |
|---|---|---|
| Thêm bình luận | Giám đốc, Trưởng DA, Người giao việc, Phụ trách CV, Phụ trách NV, , Nhân viên thường | Kế toán |
| ⚠️ Xóa bình luận | Giám đốc, Trưởng DA, Người giao việc | Phụ trách CV, Phụ trách NV, Nhân viên thường, Kế toán |

**📎 TỆP ĐÍNH KÈM**

| Hành động | Được tick | MẤT |
|---|---|---|
| ⚠️ Xóa tệp | Giám đốc, Trưởng DA, Người giao việc | Phụ trách CV, Phụ trách NV, Nhân viên thường, Kế toán |

→ Hoàng Long: 42 hành động bị ảnh hưởng, trong đó 17 hành động ⚠️ (thao tác của người làm việc) nên cân nhắc tick lại.

## Ngọc Thịnh

**🏗️ CẤP DỰ ÁN**

| Hành động | Được tick | MẤT |
|---|---|---|
| Tạo dự án mới | Giám đốc, Trưởng DA, Kế toán | Người giao việc, Phụ trách CV, Phụ trách NV, Nhân viên thường |
| Sửa thông tin dự án | Giám đốc, Trưởng DA, Kế toán | Người giao việc, Phụ trách CV, Phụ trách NV, Nhân viên thường |
| Cập nhật trạng thái / % tiến độ | Giám đốc, Trưởng DA, Kế toán | Người giao việc, Phụ trách CV, Phụ trách NV, Nhân viên thường |
| Xem tài chính dự án | Giám đốc, Trưởng DA, Kế toán | Người giao việc, Phụ trách CV, Phụ trách NV, Nhân viên thường |
| Quản lý hồ sơ (BG/HĐ/NT/TL) | Giám đốc, Trưởng DA, Người giao việc, Kế toán | Phụ trách CV, Phụ trách NV, Nhân viên thường |
| Xóa dự án | Giám đốc, Trưởng DA, Kế toán | Người giao việc, Phụ trách CV, Phụ trách NV, Nhân viên thường |
| Xuất dữ liệu dự án | Giám đốc, Trưởng DA, Người giao việc, Kế toán | Phụ trách CV, Phụ trách NV, Nhân viên thường |
| Thêm nhanh khách hàng | Giám đốc, Trưởng DA, Người giao việc, Kế toán | Phụ trách CV, Phụ trách NV, Nhân viên thường |

**📋 CỘT KANBAN**

| Hành động | Được tick | MẤT |
|---|---|---|
| Tạo cột mới | Giám đốc, Trưởng DA, Kế toán | Người giao việc, Phụ trách CV, Phụ trách NV, Nhân viên thường |
| Sửa cột | Giám đốc, Trưởng DA, Kế toán | Người giao việc, Phụ trách CV, Phụ trách NV, Nhân viên thường |
| Xóa cột | Giám đốc, Trưởng DA, Kế toán | Người giao việc, Phụ trách CV, Phụ trách NV, Nhân viên thường |
| Sắp xếp thứ tự cột | Giám đốc, Trưởng DA, Kế toán | Người giao việc, Phụ trách CV, Phụ trách NV, Nhân viên thường |
| Cấu hình tự động hóa cột | Giám đốc, Trưởng DA, Kế toán | Người giao việc, Phụ trách CV, Phụ trách NV, Nhân viên thường |

**🃏 THẺ DỰ ÁN**

| Hành động | Được tick | MẤT |
|---|---|---|
| Tạo thẻ dự án | Giám đốc, Trưởng DA, Người giao việc, Phụ trách CV, Nhân viên thường, Kế toán | Phụ trách NV |
| Sửa thẻ dự án | Giám đốc, Trưởng DA, Người giao việc, Phụ trách CV, Kế toán | Phụ trách NV, Nhân viên thường |
| Xóa thẻ dự án | Giám đốc, Trưởng DA, Kế toán | Người giao việc, Phụ trách CV, Phụ trách NV, Nhân viên thường |
| Gán thành viên thẻ | Giám đốc, Trưởng DA, Người giao việc, Phụ trách CV, Kế toán | Phụ trách NV, Nhân viên thường |

**✅ CÔNG VIỆC**

| Hành động | Được tick | MẤT |
|---|---|---|
| ⚠️ Tạo công việc | Giám đốc, Trưởng DA, Người giao việc, Phụ trách CV, Nhân viên thường, Kế toán | Phụ trách NV |
| ⚠️ Sửa công việc | Giám đốc, Trưởng DA, Người giao việc, Kế toán | Phụ trách CV, Phụ trách NV, Nhân viên thường |
| ⚠️ Xóa công việc | Giám đốc, Trưởng DA, Kế toán | Người giao việc, Phụ trách CV, Phụ trách NV, Nhân viên thường |
| ⚠️ Giao việc | Giám đốc, Trưởng DA, Người giao việc, Phụ trách CV, Kế toán | Phụ trách NV, Nhân viên thường |
| Nhận việc | Phụ trách CV, Phụ trách NV, Kế toán | Nhân viên thường |
| Hoàn thành | Phụ trách CV, Phụ trách NV, Kế toán | Nhân viên thường |
| ⚠️ Duyệt kết quả | Giám đốc, Trưởng DA, Người giao việc, Kế toán | Phụ trách CV, Phụ trách NV, Nhân viên thường |
| ⚠️ Từ chối duyệt | Giám đốc, Trưởng DA, Người giao việc, Kế toán | Phụ trách CV, Phụ trách NV, Nhân viên thường |

**🧩 NHIỆM VỤ CON**

| Hành động | Được tick | MẤT |
|---|---|---|
| ⚠️ Tạo nhiệm vụ con | Giám đốc, Trưởng DA, Người giao việc, Phụ trách CV, Kế toán | Phụ trách NV, Nhân viên thường |
| ⚠️ Sửa nhiệm vụ con | Giám đốc, Trưởng DA, Người giao việc, Phụ trách CV, Kế toán | Phụ trách NV, Nhân viên thường |
| ⚠️ Xóa nhiệm vụ con | Giám đốc, Trưởng DA, Kế toán | Người giao việc, Phụ trách CV, Phụ trách NV, Nhân viên thường |
| ⚠️ Gán phụ trách chính | Giám đốc, Trưởng DA, Người giao việc, Phụ trách CV, Kế toán | Phụ trách NV, Nhân viên thường |
| Gán thành viên nhiệm vụ | Giám đốc, Trưởng DA, Người giao việc, Phụ trách CV, Phụ trách NV, Kế toán | Nhân viên thường |
| ⚠️ Gán thợ phụ | Giám đốc, Trưởng DA, Người giao việc, Phụ trách CV, Kế toán | Phụ trách NV, Nhân viên thường |
| Xác nhận hoàn thành | Giám đốc, Trưởng DA, Người giao việc, Phụ trách CV, Phụ trách NV, Kế toán | Nhân viên thường |
| Ghi nhận công tác phí | Giám đốc, Trưởng DA, Người giao việc, Phụ trách CV, Phụ trách NV, Kế toán | Nhân viên thường |

**👥 PHÂN CÔNG & THAM GIA**

| Hành động | Được tick | MẤT |
|---|---|---|
| ⚠️ Phân công người tham gia | Giám đốc, Trưởng DA, Người giao việc, Phụ trách CV, Kế toán | Phụ trách NV, Nhân viên thường |

**💰 TÀI CHÍNH**

| Hành động | Được tick | MẤT |
|---|---|---|
| Đề xuất tạm ứng | Giám đốc, Trưởng DA, Phụ trách CV, Nhân viên thường, Kế toán | Người giao việc, Phụ trách NV |
| Quyết toán thanh toán | Giám đốc, Trưởng DA, Kế toán | Người giao việc, Phụ trách CV, Phụ trách NV, Nhân viên thường |
| Xem sổ cái thu chi | Giám đốc, Trưởng DA, Kế toán | Người giao việc, Phụ trách CV, Phụ trách NV, Nhân viên thường |

**🚨 KỶ LUẬT**

| Hành động | Được tick | MẤT |
|---|---|---|
| Ghi nhận vi phạm | Giám đốc, Trưởng DA, Người giao việc, Phụ trách CV, Phụ trách NV, Kế toán | Nhân viên thường |
| Lập phiếu phạt | Giám đốc, Trưởng DA, Kế toán | Người giao việc, Phụ trách CV, Phụ trách NV, Nhân viên thường |

**🔗 HỒ SƠ LIÊN THÔNG**

| Hành động | Được tick | MẤT |
|---|---|---|
| ⚠️ Công cụ Phê duyệt | Giám đốc, Trưởng DA, Người giao việc, Phụ trách CV, Kế toán | Phụ trách NV, Nhân viên thường |
| ⚠️ Công cụ Chi phí | Giám đốc, Trưởng DA, Người giao việc, Kế toán | Phụ trách CV, Phụ trách NV, Nhân viên thường |
| Công cụ Vật tư | Giám đốc, Trưởng DA, Người giao việc, Phụ trách CV, Phụ trách NV, Kế toán | Nhân viên thường |
| ⚠️ Công cụ Báo giá | Giám đốc, Trưởng DA, Người giao việc, Kế toán | Phụ trách CV, Phụ trách NV, Nhân viên thường |
| ⚠️ Công cụ Hợp đồng | Giám đốc, Trưởng DA, Người giao việc, Kế toán | Phụ trách CV, Phụ trách NV, Nhân viên thường |
| ⚠️ Công cụ Nghiệm thu | Giám đốc, Trưởng DA, Người giao việc, Kế toán | Phụ trách CV, Phụ trách NV, Nhân viên thường |
| ⚠️ Công cụ Thanh lý | Giám đốc, Trưởng DA, Người giao việc, Kế toán | Phụ trách CV, Phụ trách NV, Nhân viên thường |
| ⚠️ Quản lý hồ sơ liên thông | Giám đốc, Trưởng DA, Người giao việc, Kế toán | Phụ trách CV, Phụ trách NV, Nhân viên thường |

**🗣️ BÌNH LUẬN & CHAT**

| Hành động | Được tick | MẤT |
|---|---|---|
| ⚠️ Xóa bình luận | Giám đốc, Trưởng DA, Người giao việc, Kế toán | Phụ trách CV, Phụ trách NV, Nhân viên thường |

**📎 TỆP ĐÍNH KÈM**

| Hành động | Được tick | MẤT |
|---|---|---|
| ⚠️ Xóa tệp | Giám đốc, Trưởng DA, Người giao việc, Kế toán | Phụ trách CV, Phụ trách NV, Nhân viên thường |

→ Ngọc Thịnh: 49 hành động bị ảnh hưởng, trong đó 21 hành động ⚠️ (thao tác của người làm việc) nên cân nhắc tick lại.

