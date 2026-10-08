// Bộ NHÓM VAI TRÒ + QUYỀN DỰ ÁN MẪU cấp sẵn cho DOANH NGHIỆP MỚI (dùng trong api/_company.ts).
// Trước đây công ty mới KHÔNG có nhóm nào: chủ phải tự dựng từ đầu, và các nhóm tự tạo thường thiếu "Loại nhóm"
// (VD nhóm "Ban giám đốc" không có loại → người trong nhóm không được tính là Giám đốc/Kế toán ở Quyền Dự Án).
// Nội dung rút từ cấu hình thực tế của Hoàng Long (đã chạy ổn) nhưng rút gọn, an toàn theo hướng "ít quyền hơn".
// File bắt đầu bằng "_" nên Vercel không coi là endpoint. KHÔNG import từ src/ (xem api/login.ts).

type ModulePerm = { view: boolean; create: boolean; edit: boolean; delete: boolean };
type Perms = Record<string, ModulePerm>;

// Mọi mã module trong app (khớp danh sách phân hệ ở tab Phân Quyền Và Vai Trò)
export const ALL_MODULES = [
  'director_office', 'director_dashboard', 'project_office', 'projects_construction', 'projects_furniture', 'projects_mechanical',
  'hr_office', 'employees', 'hr_data', 'accounting_office', 'finance', 'finance_data',
  'warehouse_office', 'material_coordination', 'warehouse_suppliers', 'warehouse_management', 'subcontractor_office', 'subcontractor_management',
  'library_office', 'quotes_construction', 'quotes', 'quotes_mechanical', 'quotes_subcontractor',
  'system_office', 'settings_accounts', 'settings_roles', 'settings', 'tasks', 'reports',
];

const p = (flags: string): ModulePerm => ({ view: flags.includes('v'), create: flags.includes('c'), edit: flags.includes('e'), delete: flags.includes('d') });
/** Đánh dấu "Loại nhóm" — lưu như pseudo-module trong permissions (xem getRoleGroupKind ở src/context/SettingsContext.tsx) */
const kind = (k: string): Perms => ({ [`__role_kind__${k}`]: p('v') });
const gan = (codes: string[], flags: string): Perms => Object.fromEntries(codes.map(c => [c, p(flags)]));

const PROJECT_MODULES = ['project_office', 'projects_construction', 'projects_furniture', 'projects_mechanical'];
const QUOTE_MODULES = ['library_office', 'quotes_construction', 'quotes', 'quotes_mechanical', 'quotes_subcontractor'];
const WAREHOUSE_MODULES = ['warehouse_office', 'material_coordination', 'warehouse_suppliers', 'warehouse_management', 'subcontractor_office', 'subcontractor_management'];

// ID cố định cũ (role_admin/role_accounting/role_office/role_technical) được GIỮ để code cũ nhận diện được cả theo id lẫn theo "Loại nhóm".
export const DEFAULT_ROLE_GROUPS: { id: string; name: string; description: string; permissions: Perms }[] = [
  {
    id: 'role_admin', name: 'Ban Giám Đốc', description: 'Quản trị viên / Giám đốc — toàn quyền',
    permissions: { ...gan(ALL_MODULES, 'vced'), ...kind('admin') },
  },
  {
    id: 'role_accounting', name: 'Kế toán', description: 'Nhân viên phòng Kế toán',
    permissions: {
      ...gan(['finance', 'finance_data', 'accounting_office', 'warehouse_office', 'material_coordination', 'warehouse_suppliers'], 'vced'),
      ...gan([...PROJECT_MODULES, ...QUOTE_MODULES, 'employees', 'hr_data', 'warehouse_management', 'subcontractor_office', 'subcontractor_management'], 'vce'),
      ...gan(['tasks', 'reports'], 'v'),
      ...kind('accounting'),
    },
  },
  {
    id: 'role_office', name: 'Văn phòng / Quản lý dự án', description: 'Trưởng bộ phận, nhân viên văn phòng, quản lý dự án',
    permissions: {
      ...gan([...PROJECT_MODULES, ...QUOTE_MODULES, ...WAREHOUSE_MODULES], 'vce'),
      ...gan(['tasks', 'reports'], 'v'),
      ...kind('office'),
    },
  },
  {
    id: 'role_technical', name: 'Kỹ thuật / Xưởng', description: 'Tổ trưởng, thợ, nhân viên xưởng — chỉ xem là chính',
    permissions: {
      ...gan([...PROJECT_MODULES, 'material_coordination', 'warehouse_management', 'tasks', 'reports'], 'v'),
      ...kind('technical'),
    },
  },
];

// Quyền Dự Án theo NHÓM (tab "Vai trò nhóm HRM") — áp dụng cho mọi dự án. Nhóm Ban Giám Đốc đã có toàn quyền qua vai trò "Giám đốc"
// trong ma trận theo vị trí nên không cần liệt kê. Nhóm Kỹ thuật/Xưởng không cấp quyền nhóm: họ làm việc theo vị trí (phụ trách/giao việc...).
const BINH_LUAN = ['addComment', 'taskChat', 'uploadAttachment'];
export const DEFAULT_ROLE_GROUP_PROJECT_ACTIONS: Record<string, string[]> = {
  role_accounting: [
    'createProject', 'editProjectInfo', 'updateProjectStatus', 'viewProjectFinance', 'manageProjectDocs', 'quickAddCustomer', 'exportProject',
    'proposeAdvance', 'settlePayment', 'viewFinanceLedger', 'openToolCost', 'openToolContract', 'openToolQuotation', 'openToolLiquidation', 'manageDocs',
    ...BINH_LUAN,
  ],
  role_office: [
    'createProject', 'editProjectInfo', 'updateProjectStatus', 'manageProjectDocs', 'quickAddCustomer', 'exportProject',
    'createCard', 'editCard', 'moveCard', 'assignCardMember', 'createTask', 'editTask', 'assignTask', 'assignMembers',
    'openToolApproval', 'openToolMaterial', 'openToolQuotation', 'openToolContract', 'manageDocs',
    ...BINH_LUAN,
  ],
  role_admin: [],
  role_technical: [],
};

/** Ma trận Quyền Dự Án khởi tạo cho công ty mới: CHỈ phần theo nhóm — phần theo vị trí lấy mặc định của ứng dụng (DEFAULT_PROJECT_PERMISSIONS). */
export function buildInitialProjectPermissionMatrix() {
  return { version: 2, roleGroupMatrix: { roleGroupActions: DEFAULT_ROLE_GROUP_PROJECT_ACTIONS } };
}
