export interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  username?: string;
  password?: string;
  avatar?: string;
  address?: string;
  role?: string; // Legacy field — dùng Role Groups thay thế (hl_hrm_roles_v2)
  roleGroupIds?: string[]; // Danh sách ID của HRM Role Groups mà nhân viên thuộc về (vd: ['role_office', 'role_technical'])
  bank_account?: string; // Số tài khoản ngân hàng
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  company?: string;
  type?: 'individual' | 'organization'; // Loại khách hàng: Cá nhân / Tổ chức
  representative?: string; // Người đại diện (Nếu là Tổ chức)
  taxOrIdNumber?: string; // MST/CMND (kiểu số)
  notes?: string; // Ghi chú
}

export type ProjectType = 'construction' | 'furniture' | 'mechanical' | 'general';
export type ProjectStatus = 'new' | 'processing' | 'paused' | 'completed' | 'cancelled';

export interface ProjectDocCustomField {
  label: string; // Nhãn tùy chỉnh (vd: "Chất liệu chính", "Điều khoản tạm ứng")
  value: string; // Giá trị (vd: "MDF chống ẩm An Cường", "Tạm ứng 30% khi chuyển hàng")
}

export interface ProjectDoc {
  id: string;
  type: 'quotation' | 'contract' | 'acceptance' | 'liquidation';
  name: string;
  code: string;
  createdAt: string;
  status: 'draft' | 'active' | 'approved' | 'archived' | 'rejected';
  value?: number;
  templateName: string; // Tên mẫu văn bản áp dụng
  customFields?: ProjectDocCustomField[];
  content?: string; // Nội dung văn bản tùy chỉnh đầy đủ
  materials?: { 
    id: string; 
    name: string; 
    qty: number; 
    unit: string; 
    spec: string;
    note?: string; // Ghi chú
    supplierId?: string; // Nhà cung cấp ID
    supplierName?: string; // Nhà cung cấp Tên
    price?: number; // Đơn giá
    totalPrice?: number; // Thành tiền
  }[];
  coordinationType?: 'self' | 'assign';
  coordinatorId?: string;
  coordinatorName?: string;
  creatorId?: string;
  creatorName?: string;
  projectId?: string;
  projectName?: string;
  taskId?: string;
  taskName?: string;
  description?: string; // Diễn giải
  proposalType?: 'warehouse' | 'supplier';
  supplierId?: string;
  supplierName?: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  customerId: string;
  address: string;
  type: ProjectType;
  contractValue: number;
  startDate: string;
  endDate: string;
  pmId: string; // Employee ID
  status: ProjectStatus;
  progress: number;
  notes?: string;
  image?: string;
  documents?: ProjectDoc[]; // Bộ tài liệu hồ sơ dự án gồm: Báo giá, Hợp đồng, Nghiệm thu, Thanh lý
  involvedEmployeeIds?: string[]; // Người liên quan/hỗ trợ của dự án
  kanbanColumnId?: string;
  styleItalic?: boolean;
  styleBold?: boolean;
  styleStrike?: boolean;
  styleColor?: string;
  cardColor?: string;
  baoGiaFile?: {
    name: string;
    size: string;
    createdAt: string;
    totalAmount: number;
    discountPercent: number;
    items?: any[];
    content?: string;
    isApproved?: boolean;
    approvedAt?: string;
    approvedBy?: string;
  };
}

export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskStatus = 'todo' | 'doing' | 'reviewing' | 'completed' | 'overdue';

export interface ApprovalStep {
  id: string;
  levelName: string; // Tên cấp duyệt (ví dụ: "Cấp 1: Giám sát kỹ thuật", "Cấp 2: Quản lý dự án", "Cấp 3: Giám đốc")
  approverId: string; // Employee ID/approver
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
  updatedAt?: string;
}

// ─── HRM Role Groups & Approval ────────────────────────────────────────────────

export interface HrmRoleGroup {
  id: string;
  name: string;
  description?: string;
  /** { moduleCode: { view, create, edit, delete } } */
  permissions?: Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean }>;
  memberIds: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface HrmApprovalConfig {
  id: string;
  documentType: 'quotation' | 'contract' | 'acceptance' | 'liquidation' | 'leave' | 'salary_advance';
  documentTypeLabel: string;
  approverId: string;
  approverName: string;
  approverPosition?: string;
  canApprove: boolean;
}

export interface TaskComment {
  id: string;
  senderId: string; // Employee ID
  senderName: string;
  senderRole: string;
  content: string;
  createdAt: string;
  attachmentName?: string;
  attachmentSize?: string;
  attachmentUrl?: string;
}

export interface TaskWorkLog {
  id: string;
  actorId: string; // Employee ID
  actorName: string;
  action: string; // e.g., "Nhận nhiệm vụ", "Thay đổi tiến độ lên 50%", "Gửi phê duyệt", etc.
  timestamp: string;
  notes?: string;
}

export interface TaskTimeLog {
  id: string;
  workerId: string;
  workerName: string;
  hoursSpent: number; // Số giờ làm việc thực tế
  date: string;
  description: string;
}

export interface Task {
  id: string;
  code: string;
  projectId?: string;
  columnId?: string;
  name: string;
  description: string;
  assignerId: string; // Employee ID
  assigneeId: string; // Employee ID
  department: string;
  deadline: string;
  priority: TaskPriority;
  status: TaskStatus;
  completionRate: number;
  notes?: string;
  attachmentName?: string;
  involvedEmployeeIds?: string[]; // Danh sách nhiều người liên quan
  approvals?: ApprovalStep[]; // Quy trình duyệt nhiều cấp
  workLogs?: TaskWorkLog[]; // Lịch trình/Quá trình thao tác
  comments?: TaskComment[]; // Bình luận trực tiếp
  timeLogs?: TaskTimeLog[]; // Nhật ký ghi nhận thời gian thực tế
  advanceRequests?: {
    id: string;
    title: string;
    amount: number;
    status: 'pending' | 'approved' | 'rejected';
    reason: string;
    proposerName: string;
    date: string;
    type: 'advance' | 'reimbursement'; // advance = cấp / tạm ứng, reimbursement = hoàn / thanh quyết toán
  }[];
  checklistTexts?: string[]; // Danh sách checklist tự động
  completedChecklistTexts?: string[]; // Danh sách các mục checklist đã tích hoàn thành
  styleItalic?: boolean;
  styleBold?: boolean;
  styleStrike?: boolean;
  styleColor?: string;
  isApprovalEnabled?: boolean;
  isApprovalRequired?: boolean;
  isDocGenerationEnabled?: boolean;
  isCostEnabled?: boolean;
  isMaterialEnabled?: boolean;
  isSubcontractorEnabled?: boolean;
  subcontractorId?: string;
  subcontractorName?: string;
  defaultApproverId?: string;
  costApproverId?: string;
  costSettlerId?: string;
  isMaterialSelfCoordinated?: boolean;
  materialCoordinatorId?: string;
  subcontractorApproverId?: string;
  subcontractorSettlerId?: string;
  missions?: SubTaskMission[];
}

export interface SubTaskMission {
  id: string;
  name: string;
  memberIds: string[]; // Danh sách thành viên tham gia nhiệm vụ (avatar)
  mainAssigneeId?: string; // Người phụ trách chính nhiệm vụ
  status: 'todo' | 'completed';
  workReports: string; // Báo cáo công việc đã làm (bắt buộc)
  evidence: string; // Bằng chứng công việc hoàn thành (bắt buộc)
  completedAt?: string;
  createdAt?: string;
  deadline?: string;
  travelAllowances?: {
    id: string;
    memberId: string;
    normId?: string;
    code?: string;
    content: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    notes?: string;
  }[];
}

export interface Receipt {
  id: string;
  code: string;
  date: string;
  customerId: string;
  projectId?: string;
  amount: number;
  paymentMethod: 'cash' | 'transfer';
  notes: string;
  collector: string;
  attachmentName?: string;
}

export interface Payment {
  id: string;
  code: string;
  date: string;
  recipient: string; // Nhà cung cấp / nhân viên / thầu phụ
  projectId?: string;
  category: 'material' | 'labor' | 'shipping' | 'machinery' | 'general' | 'other' | 'subcontractor_advance' | 'site_expense' | 'salary' | 'supplier_payment' | 'salary_advance';
  amount: number;
  paymentMethod: 'cash' | 'transfer';
  notes: string;
  proposer: string;
  approver: string;
  status: 'pending' | 'approved' | 'rejected';
  attachmentName?: string;
  approvals?: ApprovalStep[]; // Chuỗi duyệt nhiều cấp từ matrix config
}

export interface ProjectContract {
  id: string;
  code: string;
  projectId: string;
  title: string;
  value: number;
  signedDate: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
}

export interface MaterialDemand {
  id: string;
  projectId: string;
  name: string;
  unit: string;
  qty: number;
  estimatedPrice: number;
  supplier?: string;
  status: 'pending' | 'ordered' | 'received';
}

// Báo giá nội thất cấu hình & sản phẩm
export type ProductGroup =
  | 'kitchen_cabinet'
  | 'wardrobe'
  | 'tv_shelf'
  | 'bed'
  | 'shoe_cabinet'
  | 'desk'
  | 'document_cabinet'
  | 'reception_desk'
  | 'wall_decor'
  | 'custom';

export interface QuoteConfig {
  discountPercent: number;
  accessoryPercent: number; // Phụ kiện % cộng thêm hoặc tính tỷ lệ
  laborPercent: number;     // Nhân công %
  generalPercent: number;   // Chi phí chung %
  profitPercent: number;    // Lợi nhuận %
  wastagePercent: number;   // Hao hụt %
  vatPercent: number;       // % Thuế VAT
}

export interface QuoteItem {
  id: string;
  productGroup: ProductGroup;
  productName: string;
  qty: number;
  notes?: string;
  material?: string; // Chất liệu sản phẩm gốc từ Catalog
  unit?: string; // Đơn vị tính của sản phẩm
  unitPrice?: number; // Đơn giá được áp dụng cho sản phẩm
  ratioPercent?: string; // Tỷ lệ % đặc thù xây dựng hoặc khái toán
  
  // Các thông số kích thước, chung
  width?: number; // mét hoặc mm tùy chế độ, ta chuẩn hóa theo mét (m) dải bếp hay tủ quần áo
  height?: number;
  depth?: number;
  
  // Tủ bếp
  lowerCabinetLength?: number; // mét dài tủ dưới
  upperCabinetLength?: number; // mét dài tủ trên
  lowerCabinetMaterial?: string; // loại thùng: MDF/Plywood/Nhựa
  upperCabinetMaterial?: string;
  wingMaterial?: string; // Melamine, Acrylic, Laminate, Sơn
  stoneBrand?: string; // mặt đá
  glassType?: string; // kính bếp
  accessories?: string; // các phụ kiện kèm theo

  // Chế độ báo giá: 'quick' (mét dài) hoặc 'detail' (theo vật tư)
  pricingMethod: 'quick' | 'detail';
  
  // Chi tiết tính giá
  lowerCabinetUnitPrice?: number;
  upperCabinetUnitPrice?: number;
  stoneUnitPrice?: number;
  glassUnitPrice?: number;
  accessoryCost?: number;
  
  // Tính toán chi tiết (cho pricingMethod = 'detail')
  boardPanelsQty?: number; // số tấm ván
  boardPanelUnitPrice?: number;
  laborCost?: number;
  generalCost?: number;
  profitAmount?: number;
  wastageCost?: number;

  totalPrice: number;
}

export interface Quote {
  id: string;
  code: string;
  customerId: string;
  projectId?: string;
  projectName?: string; // Tên dự án độc lập/vãng lai (nhập tay)
  chieuDai?: number;
  chieuRong?: number;
  soTang?: number;
  selectedHouseType?: string;
  donGiaKhaiToan?: number;
  nganSachNoiThat?: number;
  features?: string;
  minPrice?: number;
  maxPrice?: number;
  dienTichSan?: number;
  tongDienTichXayDung?: number;
  date: string;
  items: QuoteItem[];
  config: QuoteConfig;
  status: 'draft' | 'sent' | 'approved' | 'rejected';
  notes?: string;
  paymentTerms?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  takeoffRows?: any[];
  companyLogoImg?: string;
  companyLogoText?: string;
  companySlogan?: string;
  companyAddressInfo?: string;
  companyContactInfo?: string;
  contractHtml?: string;
  acceptanceHtml?: string;
  liquidationHtml?: string;
  finalQuoteHtml?: string;
  contractTemplate?: string;
  acceptanceTemplate?: string;
  liquidationTemplate?: string;
  // Optional subcontractor-contract fields (used by SubcontractorEstimator)
  subcontractorId?: string;
  subcontractorName?: string;
  taskId?: string;
  workName?: string;
  contractValue?: number;
  createdDate?: string;
  signedDate?: string;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  // Bên B fields
  hoTenB?: string;
  gioiTinhB?: string;
  ngaySinhB?: string;
  cccdB?: string;
  ngayCapB?: string;
  noiCapB?: string;
  diaChiB?: string;
  sdtB?: string;
  emailB?: string;
  mstCnB?: string;
  stkB?: string;
  nganHangB?: string;
  // Điều khoản fields
  moTaKqBanGiao?: string;
  diaDiemThucHien?: string;
  tyLeKhauTruTncn?: number;
  tienTamUng?: number;
  soNgayTamUng?: number;
  soNgayThanhToan?: number;
  dieuKhoanNghiemThu?: string;
  thoiGianBaoHanh?: string;
  tyLePhatCham?: number;
  mucPhatToiDa?: number;
}

export interface AppNotification {
  id: string;          // Mã tin nhắn
  recipientId: string; // ID Người nhận
  recipientName: string; // Người nhận (User)
  department: string;  // Phòng Ban
  content: string;     // Nội dung thông báo
  subTaskCode: string; // Mã Công Việc con
  createdAt: string;   // Ngày tạo
  read: boolean;       // Đã đọc hay chưa
  senderId?: string;   // ID Người gửi
  senderName?: string; // Tên người gửi
  senderAvatar?: string; // Ký tự đại diện hoặc mã màu avatar
  category?: 'tasks' | 'projects' | 'employees' | 'finance' | 'warehouse' | 'subcontractor' | 'attendance' | 'approval' | 'chat' | 'hr'; // Phân loại
  title?: string;       // Tiêu đề thông báo
  detailedContent?: string; // Nội dung đầy đủ chi tiết
  attachments?: ChatAttachment[]; // File đính kèm tin nhắn
  conversationId?: string; // ID hội thoại (dùng cho category chat để điều hướng)
  taskId?: string; // ID công việc liên quan
}

export interface ChatAttachment {
  id: string;
  type: 'image' | 'file' | 'camera';
  name: string;
  url: string;
  size?: number;
  mimeType?: string;
}

export interface SalaryScale {
  id: string;             // Mã chi trả (Primary Key), vd: QLDHB1, KTTCB1, HCKTB1
  groupCode: string;      // Mã ngạch, vd: QLDH, KTTC, HCKT
  groupName: string;      // Tên ngạch, vd: QUẢN LÝ - ĐIỀU HÀNH
  groupDesc?: string;     // Mô tả/Mô tả ngạch, vd: Dành cho thành viên HĐQT...
  level: string;          // Bậc lương, vd: B1, B2...
  levelName: string;      // Tên bậc, vd: Bậc lương QLDHB1
  baseSalary: number;     // Lương cơ bản
  allocationRate: number; // Tỉ lệ phân bổ Lương HS theo LCB % (ví dụ: 80, 85, 90...)
  performanceSalary: number; // Lương Hiệu suất (ví dụ: baseSalary * allocationRate / 100)
  totalSalary: number;    // Tổng lương nếu đạt Hiệu suất 100% (ví dụ: baseSalary + performanceSalary)
  notes?: string;         // Ghi chú
}

export interface ProductCatalogItem {
  id: string; // Mã SP (Khóa chính tự sinh) e.g. "SP001"
  linhVuc: string; // Lĩnh vực
  danhMuc: string; // Danh mục
  tenSanPham: string; // Tên sản phẩm
  chatLieu?: string; // Chất liệu (optional for backward compatibility or default fallback)
  donVi: string; // Đơn vị
  donGiaThaiLan?: number | null; // Đơn giá Thái Lan (đ)
  donGiaAnCuong?: number | null; // Đơn giá An Cường (đ)
  donGiaPlywood?: number | null; // Đơn giá gỗ Plywood (đ)
}

export interface ProductPriceItem {
  id: string; // Mã đơn giá (Primary Key)
  productId: string; // Liên kết với ProductCatalogItem.id (Foreign Key)
  tenGia: string; // Tên phân loại giá, ví dụ: "Thái Lan", "An Cường", "Plywood", hoặc bất kì mức giá mới nào
  donGia: number; // Đơn giá tính theo đồng (đ)
  ghiChu?: string; // Ghi chú phân bổ
}

export interface ProductMaterialItem {
  id: string; // Mã chất liệu (Primary Key)
  productId: string; // Liên kết với ProductCatalogItem.id (Foreign Key)
  tenChatLieu: string; // Tên chất liệu
  ghiChu?: string; // Ghi chú chi tiết thêm
}

// ─── Archived Quote Types ─────────────────────────────────────────────────────
export interface ArchivedQuote {
  id: string;
  code: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  projectId?: string;
  projectName?: string;
  sector: 'furniture' | 'construction' | 'mechanical' | 'subcontractor';
  totalAmount: number;
  date: string;
  items: QuoteItem[];
  config: QuoteConfig;
  status: 'draft' | 'sent' | 'approved' | 'rejected';
  notes?: string;
  contractHtml?: string;
  acceptanceHtml?: string;
  liquidationHtml?: string;
  finalQuoteHtml?: string;
  isApproved?: boolean;
  approvedAt?: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt?: string;
  // Subcontractor-specific fields (used across archive/supplier modules)
  subcontractorId?: string;
  subcontractorName?: string;
  workName?: string;
  contractValue?: number;
  creatorId?: string;
  creatorName?: string;
  proposalDate?: string;
  // Additional metadata from estimators
  discountPercent?: number;
  companyLogoImg?: string;
  companyLogoText?: string;
  companySlogan?: string;
  companyAddressInfo?: string;
  companyContactInfo?: string;
  // Optional metadata used by Kanban/archive views
  totalPrice?: number;
  _sectorType?: string;
  contractApproved?: boolean;
  acceptanceApproved?: boolean;
  liquidationApproved?: boolean;
  taskId?: string;
  content?: string;
  name?: string;
  // Additional dynamic fields used by various views (e.g. day, month, year,
  // representative, phone, address, taxCode, startDate, endDate, signedLabel, signedDate)
  [key: string]: any;
}

// ─── Inventory Types ──────────────────────────────────────────────────────────
export interface InventoryItem {
  id: string;
  code: string;
  name: string;
  unit: string;
  qty: number;
  unitPrice: number;
  minAlert: number;
  location: string;
}

export interface WarehouseLog {
  id: string;
  time: string;
  type: 'in' | 'out';
  matName: string;
  qty: number;
  target: string;
  note: string;
}

export interface Supplier {
  id: string;
  name: string;
  representative: string;
  phone: string;
  email: string;
  address: string;
  field: string;
  bankAccount: string;
  bankName: string;
  note: string;
  debt: number;
  region?: string;
  bankNo?: string;
  // Optional individual/contractor fields (used for subcontractor contracts)
  gender?: string;
  birthDate?: string;
  cccd?: string;
  cccdDate?: string;
  cccdPlace?: string;
  taxCode?: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  morningIn?: string;
  morningOut?: string;
  afternoonIn?: string;
  afternoonOut?: string;
  status: 'present' | 'absent' | 'late' | 'leave';
  notes?: string;
}

export interface LeaveRequest {
  id: string;
  empId: string;
  empName: string;
  type: string;
  fromDate: string;
  toDate: string;
  daysCount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  submittedAt?: string;
  approverName?: string;
  isAttendanceCorrection?: boolean;
  shift?: 'morning' | 'afternoon';
  approvals?: ApprovalStep[]; // Chuỗi duyệt nhiều cấp từ matrix config
}

export interface SupplierPartner {
  id: string; // Mã Thầu Phụ
  name: string; // Tên Thầu Phụ
  representative: string; // Người Đại Diện (Họ tên Bên B)
  gender: string; // Giới tính Bên B ("Nam" | "Nữ")
  birthDate: string; // Ngày sinh Bên B
  cccd: string; // Số CCCD Bên B
  cccdDate: string; // Ngày cấp CCCD
  cccdPlace: string; // Nơi cấp CCCD
  address: string; // Địa Chỉ thường trú
  phone: string; // Điện Thoại Bên B
  email: string; // Email Bên B
  taxCode: string; // Mã số thuế cá nhân Bên B
  bankAccount: string; // Số tài khoản Bên B
  bankName: string; // Mở tại Ngân hàng
  field: string; // Lĩnh Vực
  note: string; // Ghi chú
  debt?: number; // Công nợ
  region?: string; // Legacy field
  bankNo?: string; // Interoperability with SubcontractorEstimator
}

export interface SubcontractorAdvanceProposal {
  id: string; // Mã Đề Xuất (DX-YYYYMMDD-XXXX)
  subcontractorId: string;
  subcontractorName: string;
  projectId: string;
  projectName: string;
  taskId: string;
  taskName: string;
  amount: number; // Số Tiền Đề Xuất Tạm Ứng (VNĐ)
  reason: string; // Diễn Giải
  approver: string; // Người Xét Duyệt (Default: "Ban Giám Đốc")
  creator: string; // Người Lập Phiếu (Default: "Kế Toán")
  status: 'pending_approval' | 'pending_payment' | 'rejected' | 'completed'; // Chờ Duyệt, Chờ Lập Phiếu, Từ Chối, Hoàn Thành
  date: string; // YYYY-MM-DD
  proposalDate?: string; // Ngày đề xuất
  type?: 'subcontractor_advance' | 'project_expense_proposal';
  creatorName?: string;
  approverName?: string;
  settlerId?: string;
  settlerName?: string;
  expenseItems?: { id: string; item: string; amount: number; note: string }[];
  approvals?: ApprovalStep[]; // Chuỗi duyệt nhiều cấp từ matrix config
}
export interface Liability {
  id: string;
  name: string;
  category: 'Thầu Phụ' | 'Nhà Cung Cấp' | 'Khác';
  value: number;
  paid: number;
  remaining?: number;
  notes?: string;
}

// ─── Chat Group Types ────────────────────────────────────────────────────────
export interface ChatGroup {
  id: string;
  name: string;
  avatar: string;
  color: string;
  memberIds: string[];
  createdBy: string;
  createdAt: string;
  isAuto?: boolean;   // true = phòng ban tự động, false = user tạo
  department?: string; // chỉ cho auto rooms
  pinned?: boolean;
  taskId?: string; // Liên kết với công việc con
  projectId?: string;
}

// ─── Conversation & Chat Message Types ────────────────────────────────────────
export interface Conversation {
  id: string;
  type: 'personal' | 'group' | 'task';  // personal = 1-1, group = tự tạo, task = từ công việc con
  name: string;
  avatar: string;
  color: string;
  participantIds: string[];
  createdBy: string;
  createdAt: string;
  lastMessageAt?: string;
  unreadCount: number;
  taskId?: string;
  projectId?: string;
  pinned?: boolean;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole?: string;
  content: string;
  createdAt: string;
  read: boolean;
  attachments?: ChatAttachment[];
  system?: boolean;
  edited?: boolean;       // Đã chỉnh sửa
  editedAt?: string;      // Thời gian chỉnh sửa
  deleted?: boolean;      // Đã xóa (soft delete)
  deletedAt?: string;     // Thời gian xóa
  pinned?: boolean;       // Đã ghim
  replyTo?: {             // Trả lời tin nhắn nào
    id: string;
    senderName: string;
    content: string;
  };
}

