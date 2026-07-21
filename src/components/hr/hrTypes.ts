// ─── Core HRM types & interfaces ───────────────────────────────────────
// Tách từ HumanResourcesManagement.tsx để dễ bảo trì.

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: {
    [moduleCode: string]: {
      view: boolean;
      create: boolean;
      edit: boolean;
      delete: boolean;
    }
  };
  memberIds: string[];
}

export interface HRMProps {
  currentUser: any;
  projects?: any[];
  customers?: any[];
  defaultSubTab?: string;
  hideSidebar?: boolean;
}

export interface TravelAllowanceNorm {
  id: string;
  code: string; // MÃ CTP
  content: string; // Nội dung
  quantity: number; // Số lượng
  unitPrice: number; // Đơn giá
  notes: string; // Ghi chú
}

export interface EmployeeProfile {
  id: string;
  name: string;
  gender: string;
  dob: string;
  phone: string;
  email: string;
  cccd: string;
  cccdIssuedDate?: string;
  cccdIssuedPlace?: string;
  address: string;
  currentAddress?: string;
  emergencyContact: string;
  department: string;
  position: string;
  startDate: string;
  contractType: string;
  contractDurationMonths?: number; // Thời hạn HĐ (tháng) - chỉ dùng khi HĐ Có thời hạn
  status: 'working' | 'leave' | 'retired';
  phepNam?: number;
  bankAccount: string;
  bankName: string;
  docsCount: number;
  education?: string;
  salaryCode?: string;
  bhxhBookNo?: string;
  bhxhSalary?: number;
  bhxhRate?: number;
  taxPersonalRelief?: number;
  dependentCount?: number;
  bhxhDate?: string;
  hasSystemAccount?: boolean; // Đã tạo tài khoản hệ thống (hl_erp_employees) chưa
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
}

export interface LeaveCoefficient {
  id: string; // Mã HSCC (Khóa chính)
  type: string;
  isAuto: boolean;
  coefficient: number;
}

export interface PerformanceCriterion {
  id: string;
  category: 'readiness' | 'progress' | 'reporting';
  content: string;
}

export interface DepartmentCriteria {
  id: string;
  departmentCode: string; // A, B, C_KE_TOAN, C_KINH_DOANH, E
  departmentName: string;
  criteria: PerformanceCriterion[];
}

export interface AttendanceLog {
  id: string;
  empId: string;
  empName: string;
  date: string;
  timeInS: string;
  timeOutS: string;
  timeInC: string;
  timeOutC: string;
  timeInOT: string;
  timeOutOT: string;
  method: string;
  status: 'valid' | 'missing' | 'late' | 'excused' | 'unexcused' | 'invalid';
  otHours: number;
  notes: string;
  approvedBy?: string;
  photoIn?: string;
  photoOut?: string;
  locationIn?: string;
  coordsIn?: string;
  locationOut?: string;
  coordsOut?: string;
  isLocked?: boolean;
  statusMsg?: string;
  leaveSymbol?: string;
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
  approverId?: string;
  approverPosition?: string;
  isAttendanceCorrection?: boolean;
  shift?: 'morning' | 'afternoon';
}

export interface PayrollItem {
  id: string;
  bluCode: string;
  empId: string;
  empName: string;
  month: string;
  baseSalary: number;
  performanceSalary?: number;
  kpiScore: number;
  kpiBonus: number;
  salaryPerDay?: number;
  daySalary?: number;
  workedDays: number;
  otSunday: number;
  otSundaySalary: number;
  otHoliday: number;
  otHolidaySalary: number;
  otHours: number;
  otCount: number;
  otHoursSalary?: number;
  expenses: number;
  bonusHoliday: number;
  bonusCreative: number;
  totalIncome: number;
  insurance: number;
  otherDeductions: number;
  advances: number;
  netSalary: number;
  status: 'unpaid' | 'paid';
  allowance?: number;
  tax?: number;
  kpiMaxAllowed?: number;
  monthlySalary?: number;
  otWeekendSalary?: number;
  otHourlySalary?: number;
  otAllowance?: number;
  totalOtHoursSalary?: number;
  taxableIncome?: number;
  taxableNetIncome?: number;
}

export interface KpiMetric {
  id: string;
  name: string;
  group: 'office' | 'project' | 'factory' | 'sale';
  weight: number;
  target: string;
  actual: string;
  score: number;
}

export interface BusinessTrip {
  id: string;
  empName: string;
  destination: string;
  purpose: string;
  fromDate: string;
  toDate: string;
  status: 'pending' | 'approved' | 'active' | 'completed';
  estimatedCost: number;
  advanceAmount: number;
  settledCost: number;
  settleStatus: 'draft' | 'pending' | 'settled';
}

export interface SOPDocument {
  id: string;
  title: string;
  category: string;
  author: string;
  date: string;
  excerpt: string;
}

export interface EmployeeErrorLog {
  id: string;
  employeeId: string;
  employeeName: string;
  departmentCode: string;
  departmentName: string;
  criterionId: string;
  criterionContent: string;
  category: 'readiness' | 'progress' | 'reporting';
  date: string; // YYYY-MM-DD
  notes?: string;
  severity?: 'low' | 'medium' | 'high';
  images?: string[];
}
