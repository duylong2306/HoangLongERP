// ─── Lời giải thích ngắn cho từng dòng phân quyền (hiện khi rê chuột / chạm vào dấu "?") ─────────────────────────
// Mỗi câu mô tả ĐÚNG nút/chức năng mà ô quyền đó điều khiển trong ứng dụng (đã đối chiếu mã nguồn 09/10/2026) để người dùng quyết định tick hay không.
// Ô nào hiện chưa có nút nào đọc thì ghi rõ để người dùng không tưởng đã giới hạn được.

/** Quyền Dự Án (tab "Theo vị trí" và "Vai trò nhóm HRM") — khóa = tên hành động trong ma trận */
export const PROJECT_ACTION_HELP: Record<string, string> = {
  // Dự án
  createProject: 'Bấm được nút "Tạo Dự án" trên bảng Kanban (và dấu + trong từng cột) để tạo dự án mới.',
  editProjectInfo: 'Bấm được "Chỉnh sửa thông tin" trong chi tiết dự án (địa điểm, ngày khởi công, thời hạn, giá trị hợp đồng tạm tính, màu thẻ). Cũng quyết định ai đổi được Trưởng dự án và bấm được "Đồng bộ nhân sự vào nhóm chat dự án".',
  updateProjectStatus: 'Chỉ dùng ở màn Quản lý dự án cũ (không còn trên menu chính). Hiện KHÔNG có nút nào ở Kanban đọc ô này — tick hay bỏ tick chưa đổi gì.',
  deleteProject: 'Xóa vĩnh viễn cả dự án (kèm công việc, nhóm chat, công nợ, báo giá, hợp đồng, phiếu thu/chi liên quan). Chỉ cấp cho người thật sự cần.',
  quickAddCustomer: 'Thêm nhanh một khách hàng mới ngay trong form tạo dự án.',
  // Bảng Kanban
  createColumn: 'Bấm nút "Thêm Cột" để tạo cột (giai đoạn) mới trên bảng Kanban.',
  editColumn: 'Đổi tên/màu cột và dùng nút "Khôi phục Mặc định" dải cột.',
  deleteColumn: 'Xóa một cột khỏi bảng Kanban.',
  configureColumnAutomation: 'Mở "Tự động hóa" và cấu hình quy tắc tự động cho từng cột (ví dụ tự đổi trạng thái khi kéo thẻ vào cột).',
  moveCard: 'Kéo thẻ dự án từ cột này sang cột khác (có thể kích hoạt quy tắc tự động của cột).',
  // Tài chính / hồ sơ dự án
  viewProjectFinance: 'Xem khối tài chính trong chi tiết dự án: giá trị hợp đồng, số đã thu, còn lại chưa thu và tổng giá trị hợp đồng thầu phụ. Không có quyền này thì các số tiền bị ẩn.',
  settlePayment: 'Thấy và bấm "Lập Phiếu Tạm Ứng" / "Lập Phiếu Quyết Toán" để lập phiếu thu cho dự án.',
  manageProjectDocs: 'Chỉ dùng ở màn Quản lý dự án cũ (không còn trên menu chính). Hiện KHÔNG có nút nào ở Kanban đọc ô này — tick hay bỏ tick chưa đổi gì.',
  // Công việc trên Kanban
  createTask: 'Bấm "Tạo Việc Con" trong chi tiết dự án để tạo công việc mới và lưu.',
  editTask: 'Sửa công việc từ menu ⋮ trên thẻ công việc ở Kanban (tên, hạn, người giao, phụ trách, các tùy chọn tự động).',
  deleteTask: 'Xóa công việc con từ menu ⋮ ở Kanban (kèm hồ sơ liên thông của công việc đó).',
  // Công cụ liên thông
  openToolApproval: 'Dùng nút "Yêu cầu phê duyệt" của công việc (trong cửa sổ công việc và menu LT trên thẻ) để gửi yêu cầu duyệt. Không có quyền thì nút bị khóa.',
  openToolCost: 'Dùng nút "Đề xuất chi phí" của công việc để gửi đề xuất chi phí thi công. Không có quyền thì nút bị khóa.',
  openToolMaterial: 'Dùng nút "Đề xuất vật tư" của công việc để gửi đề xuất cung ứng vật tư. Không có quyền thì nút bị khóa.',
  openToolQuotation: 'Hiện KHÔNG có nút nào đọc ô này (báo giá đi qua Kho hồ sơ) — tick hay bỏ tick chưa đổi gì.',
  openToolContract: 'Cho phép ký/lưu hồ sơ Hợp đồng từ công cụ liên thông (cần kèm ô "Quản lý hồ sơ liên thông").',
  openToolAcceptance: 'Cho phép ký/lưu Biên bản nghiệm thu từ công cụ liên thông (cần kèm ô "Quản lý hồ sơ liên thông").',
  openToolLiquidation: 'Cho phép ký/lưu hồ sơ Thanh lý từ công cụ liên thông (cần kèm ô "Quản lý hồ sơ liên thông").',
  manageDocs: 'Cho phép ký/lưu các hồ sơ liên thông (hợp đồng, nghiệm thu, thanh lý) và vật tư. Cần có cùng ô công cụ tương ứng.',
  // Thao tác trong công việc / nhiệm vụ (chỉ tab "Vai trò nhóm HRM": cấp THÊM quyền cho cả nhóm, cộng vào quyền theo vị trí ở tab Quyền Công việc)
  viewTask: 'Xem được công việc của dự án (mở thẻ, cửa sổ chi tiết) dù không phải người giao hay người phụ trách.',
  approveResult: 'Hiện nút "Xét duyệt" hoàn thành công việc khi công việc ở trạng thái chờ duyệt.',
  rejectResult: 'Từ chối kết quả công việc đang chờ duyệt và trả về làm lại.',
  assignMembers: 'Chọn thêm / gỡ người tham gia vào công việc (ô "Chọn nhân sự" trong cửa sổ công việc).',
  recordViolation: 'Hiện khối "Ghi nhận vi phạm kỷ luật & hiệu suất" trong cửa sổ công việc và cho gửi vi phạm.',
  proposeAdvance: 'Hiện nút "Đề xuất tạm ứng" trong thẻ thầu phụ của công việc.',
  createMission: 'Quản lý nhiệm vụ con: nhóm có ô này được tạo, nhập Excel, sửa, xóa, phân công và thực hiện (checklist, báo cáo, tệp, công tác phí, hoàn thành) mọi nhiệm vụ của công việc.',
  uploadAttachment: 'Tải lên / chụp tệp báo cáo đính kèm của nhiệm vụ (người dùng còn cần quyền "Thực hiện nhiệm vụ" ở tab Quyền Công việc).',
  deleteAttachment: 'Xóa tệp báo cáo đã đính kèm. Người phụ trách chính của một nhiệm vụ luôn xóa được tệp của nhiệm vụ mình.',
};

/** Quyền Công việc — khóa = tên thao tác trong ma trận hrTaskPermissions */
export const TASK_ACTION_HELP: Record<string, string> = {
  view: 'Xem được công việc: mở thẻ và cửa sổ chi tiết của công việc.',
  receiveTask: 'Bấm "Nhận Việc" để chuyển công việc sang Đang làm. Chỉ người được giao thật mới nhận được — Giám đốc cũng không nhận hộ việc của người khác.',
  completeTask: 'Bấm "Hoàn thành công việc" / gửi yêu cầu phê duyệt khi các nhiệm vụ con đã xong. Chỉ người được giao thật mới làm được.',
  approveResult: 'Hiện nút "Xét duyệt" hoàn thành công việc khi công việc ở trạng thái chờ duyệt.',
  rejectResult: 'Từ chối kết quả đang chờ duyệt và trả công việc về làm lại.',
  assignMembers: 'Chọn thêm / gỡ người tham gia công việc (ô "Chọn nhân sự" trong cửa sổ công việc).',
  recordViolation: 'Hiện khối "Ghi nhận vi phạm kỷ luật & hiệu suất" trong cửa sổ công việc và cho gửi vi phạm.',
  proposeAdvance: 'Hiện nút "Đề xuất tạm ứng" trong thẻ thầu phụ của công việc để gửi đề xuất tạm ứng thầu phụ.',
  editTask: 'Đổi người Phụ trách chính của công việc (ô chọn Phụ trách chính trong cửa sổ công việc). Khác với "Sửa công việc" ở Kanban — ô đó nằm ở Quyền Dự Án.',
  manageSubTask: 'Hiện khối "Tạo nhiệm vụ" và nút Import Excel nhiệm vụ trong cửa sổ công việc. Tính theo cả công việc.',
  editMissionInfo: 'Nút "Sửa tên / hạn" và "Xóa nhiệm vụ này". Tính theo TỪNG nhiệm vụ: người phụ trách chính của chính nhiệm vụ đó dùng cột "Phụ Trách NV".',
  assignMission: 'Gán / gỡ người phụ trách chính và thêm / gỡ thành viên của nhiệm vụ. Tính theo TỪNG nhiệm vụ.',
  executeMission: 'Tích checklist, viết báo cáo + tải tệp đính kèm, ghi nhận công tác phí và xác nhận hoàn thành nhiệm vụ. Tính theo TỪNG nhiệm vụ.',
};

/** Quyền Phê Duyệt — khóa = loại hồ sơ */
export const APPROVAL_DOC_HELP: Record<string, string> = {
  quotation: 'Bật rồi chọn người duyệt Báo Giá của dự án. Bất kỳ ai trong danh sách đều duyệt được.',
  contract: 'Bật rồi chọn người duyệt Hợp Đồng của dự án. Bất kỳ ai trong danh sách đều duyệt được.',
  acceptance: 'Bật rồi chọn người duyệt Biên bản Nghiệm Thu. Bất kỳ ai trong danh sách đều duyệt được.',
  liquidation: 'Bật rồi chọn người duyệt hồ sơ Thanh Lý. Bất kỳ ai trong danh sách đều duyệt được.',
  material_coordinator: 'Người nhận và điều phối các đề xuất vật tư (bước điều phối trước khi xét duyệt).',
  material_approver: 'Người xét duyệt các đề xuất cung ứng vật tư sau khi điều phối.',
  leave: 'Người xét duyệt Đơn Xin Nghỉ Phép — tên hiện cố định ở ô "Người xét duyệt" khi lập đơn và không cho sửa.',
  salary_advance: 'Người duyệt Đề xuất Tạm Ứng Lương Nhanh — tên hiện cố định ở ô "Người duyệt" của đề xuất.',
  travel_expense: 'Người xét duyệt Công Tác Phí của nhân sự.',
  payroll: 'Người phát lương và kế toán xử lý Phiếu Lương.',
  finance_expense_proposal: 'Người xét duyệt và người quyết toán của Đề Xuất Chi Phí ở "Trung tâm Lập chi & Đề xuất" (Tài Chính - Kế Toán).',
  finance_advance_proposal: 'Người xét duyệt và người quyết toán của Đề Xuất Tạm Ứng Thầu Phụ ở "Trung tâm Lập chi & Đề xuất" (Tài Chính - Kế Toán).',
};

/** Phân hệ trong tab "Phân Quyền Nhóm Vai Trò": menu cha hay menu con + mô tả riêng */
export function moduleHelp(desc: string, isParent: boolean): string {
  const cac = 'Xem: thấy menu và mở được màn hình · Thêm: tạo mới · Sửa: chỉnh sửa · Xóa: xóa dữ liệu của phân hệ này.';
  return isParent
    ? `Menu cha — nhóm các menu con bên dưới. ${desc}. Tích một quyền ở menu cha sẽ tích luôn quyền đó cho tất cả menu con; bỏ tích hết các menu con thì menu cha tự bỏ. Xem: thấy menu · Thêm/Sửa/Xóa: theo từng menu con.`
    : `${desc}. ${cac}`;
}
