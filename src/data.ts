import { Employee, Customer, Project, Task, Receipt, Payment, ProjectContract, MaterialDemand, Quote, QuoteConfig } from './types';
import { hashPasswordSync } from './lib/passwordUtils';

export const INITIAL_EMPLOYEES: Employee[] = [
  { id: 'emp_admin', name: 'Administrator', role: 'director', email: 'admin@hoanglong.vn', phone: '0000000000', department: 'Ban Giám Đốc', username: 'admin', password: hashPasswordSync('admin') }
];

export const HRM_26_EMPLOYEES: Employee[] = [];

export const INITIAL_CUSTOMERS: Customer[] = [
  { id: 'cust_1', name: 'Phan Văn Nam', phone: '0912111222', email: 'namphan@gmail.com', address: 'Biệt Thự B2-15 Hoa Lam, Đà Lạt, Lâm Đồng', company: 'Công ty Cổ phần Đầu tư Nam Phát' },
  { id: 'cust_2', name: 'Nguyễn Thu Trang', phone: '0987333444', email: 'trangnt@nhaphunu.com', address: 'Số 45 Trần Phú, Bảo Lộc, Lâm Đồng' },
  { id: 'cust_3', name: 'Phạm Đức Minh', phone: '0933555666', email: 'minhpd@cokhithanhcong.com', address: 'Khu công nghiệp Lộc Sơn, Bảo Lộc, Lâm Đồng', company: 'Xưởng Cơ khí Thành Công' }
];

export const INITIAL_PROJECTS: Project[] = [];

export const INITIAL_TASKS: Task[] = [];

export const INITIAL_RECEIPTS: Receipt[] = [
  {
    id: 'rec_1',
    code: 'PT-2026-001',
    date: '2026-01-20',
    customerId: 'cust_1',
    projectId: 'proj_1',
    amount: 1350000000,
    paymentMethod: 'transfer',
    notes: 'Tạm ứng đợt 1 ngay sau khi ký hợp đồng thi công biệt thự vườn (30% giá trị hợp đồng).',
    collector: 'Lê Thị Mai',
    attachmentName: 'ủy_nhiệm_chi_PT-001.pdf'
  },
  {
    id: 'rec_2',
    code: 'PT-2026-002',
    date: '2026-04-10',
    customerId: 'cust_1',
    projectId: 'proj_1',
    amount: 1000000000,
    paymentMethod: 'transfer',
    notes: 'Tạm ứng đợt 2 sau khi xong móng và đổ cột tầng trệt biệt thự.',
    collector: 'Lê Thị Mai',
    attachmentName: 'báo_có_vcb_PT-002.png'
  },
  {
    id: 'rec_3',
    code: 'PT-2026-003',
    date: '2026-03-05',
    customerId: 'cust_2',
    projectId: 'proj_2',
    amount: 500000000,
    paymentMethod: 'transfer',
    notes: 'Tạm ứng đợt 1 sản xuất nội thất penhouse chị Trang (40%).',
    collector: 'Lê Thị Mai',
    attachmentName: 'unc_chig_trang_PT-003.pdf'
  }
];

export const INITIAL_PAYMENTS: Payment[] = [
  {
    id: 'pay_1',
    code: 'PC-2026-001',
    date: '2026-02-15',
    recipient: 'Đại lý Thép Miền Trung',
    projectId: 'proj_1',
    category: 'material',
    amount: 320000000,
    paymentMethod: 'transfer',
    notes: 'Thanh toán tiền thép đợt 1 móng biệt thự Nam Phát.',
    proposer: 'Nguyễn Văn Hải',
    approver: 'Trương Hữu Long',
    status: 'approved',
    attachmentName: 'hoa_don_vat_thep.pdf'
  },
  {
    id: 'pay_2',
    code: 'PC-2026-002',
    date: '2026-04-20',
    recipient: 'Công ty Cổ Phần Gỗ An Cường',
    projectId: 'proj_2',
    category: 'material',
    amount: 180000000,
    paymentMethod: 'transfer',
    notes: 'Mua ván MDF Acrylic và MDF Melamine chuẩn bị gia công nội thất hộ Trang.',
    proposer: 'Phạm Thanh Thảo',
    approver: 'Trương Hữu Long',
    status: 'approved',
    attachmentName: 'phieu_xuat_kho_an_cuong.pdf'
  },
  {
    id: 'pay_3',
    code: 'PC-2026-003',
    date: '2026-05-18',
    recipient: 'Tổ thợ xây thầu phụ - Anh Năm',
    projectId: 'proj_1',
    category: 'labor',
    amount: 120000000,
    paymentMethod: 'cash',
    notes: 'Ứng lương đợt thi công đổ dầm sàn bê tông thô cho thầu phụ xây dựng.',
    proposer: 'Nguyễn Văn Hải',
    approver: 'Trương Hữu Long',
    status: 'approved',
    attachmentName: 'giay_ky_nhan_tien_mat.pdf'
  },
  {
    id: 'pay_4',
    code: 'PC-2026-004',
    date: '2026-06-05',
    recipient: 'Đại lý gạch ốp lát Hoàng Gia',
    projectId: 'proj_1',
    category: 'material',
    amount: 65000000,
    paymentMethod: 'transfer',
    notes: 'Đề xuất tạm ứng mua gạch ốp lát Prime 80x80 cho biệt thự vườn.',
    proposer: 'Nguyễn Văn Hải',
    approver: 'Trương Hữu Long',
    status: 'pending',
    attachmentName: 'phieu_bao_gia_kem_don_hang.pdf'
  }
];

export const INITIAL_CONTRACTS: ProjectContract[] = [
  { id: 'con_1', code: 'HD-2026-01-NAM', projectId: 'proj_1', title: 'Hợp đồng thi công xây dựng trọn gói biệt thự', value: 4500000000, signedDate: '2026-01-10', status: 'active' },
  { id: 'con_2', code: 'HD-2026-03-TRANG', projectId: 'proj_2', title: 'Hợp đồng sản xuất thiết kế thi công lắp đặt nội thất', value: 1250000000, signedDate: '2026-02-28', status: 'active' },
  { id: 'con_3', code: 'HD-2026-05-MINH', projectId: 'proj_3', title: 'Hợp đồng chế tạo và dựng ráp kết cấu vì kèo thép nhà kho', value: 850000000, signedDate: '2026-05-08', status: 'active' }
];

export const INITIAL_MATERIALS: MaterialDemand[] = [
  { id: 'mat_1', projectId: 'proj_1', name: 'Đá dăm 1x2 xây dựng', unit: 'm3', qty: 120, estimatedPrice: 280000, supplier: 'Mỏ đá Lộc Phát', status: 'ordered' },
  { id: 'mat_2', projectId: 'proj_1', name: 'Thép Hòa Phát phi 18', unit: 'tấn', qty: 12, estimatedPrice: 15500000, supplier: 'Thép Miền Trung', status: 'received' },
  { id: 'mat_3', projectId: 'proj_2', name: 'Ván ván gỗ công nghiệp MDF An Cường chống ẩm 17mm', unit: 'tấm', qty: 65, estimatedPrice: 650000, supplier: 'Công ty Gỗ An Cường', status: 'received' },
  { id: 'mat_4', projectId: 'proj_2', name: 'Bản lề hơi giảm chấn Blum', unit: 'bộ', qty: 140, estimatedPrice: 45000, supplier: 'NPP Phụ kiện Hafele Blum', status: 'pending' },
  { id: 'mat_5', projectId: 'proj_3', name: 'Sơn chống rỉ kết cấu Epoxy xám', unit: 'thùng 18L', qty: 8, estimatedPrice: 2400000, supplier: 'Sơn Hải Phòng', status: 'pending' }
];

export const DEFAULT_QUOTE_CONFIG: QuoteConfig = {
  discountPercent: 5,
  accessoryPercent: 15, // tỷ lệ phụ kiện mặc định
  laborPercent: 12,     // 12% nhân công sản xuất lắp đặt
  generalPercent: 8,    // 8% chi phí chung quản lý vận hành xưởng
  profitPercent: 15,    // 15% biên lợi nhuận ròng dự kiến
  wastagePercent: 5,     // 5% hao hụt cốt gỗ, phụ gia
  vatPercent: 8,        // 8% thuế VAT
};

export const INITIAL_QUOTES: Quote[] = [];
