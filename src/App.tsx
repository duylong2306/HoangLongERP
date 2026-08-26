import React, { useState, useEffect, useRef, useCallback } from 'react';
import { dbService, invalidateCache, normalizeOrderItems, currentMonthRange, rowToCamel, populateCache, stableStr } from './lib/dbService';
import { syncAttendanceOutbox, pendingCount as outboxPendingCount } from './lib/attendanceOutbox';
import { useWebPush } from './hooks/useWebPush';
import { deleteConversation, getUserConversations, getConversations, loadConversationsFromCloud, subscribeConversations, sendApprovalDirectMessage, findEmployeeByName, ensureAttendanceChatGroup } from './lib/chatStore';
import {
  Employee,
  Customer,
  Project,
  ProjectDoc,
  Task,
  Receipt,
  Payment,
  Quote,
  ProjectStatus,
  QuoteConfig,
  Conversation,
  SalesOrder,
  PurchaseOrder,
  SubcontractorAdvanceProposal,
  LeaveRequest
} from './types';
import {
  INITIAL_EMPLOYEES,
  INITIAL_CUSTOMERS,
  INITIAL_PROJECTS,
  INITIAL_TASKS,
  INITIAL_RECEIPTS,
  INITIAL_PAYMENTS,
  INITIAL_QUOTES,
  DEFAULT_QUOTE_CONFIG,
  DEFAULT_SYSTEM_CONFIG
} from './data';

// CONTEXT PROVIDERS (required by child components)
import { DisplaySettingsProvider, useDisplaySettings } from './context/DisplaySettingsContext';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { isUserInRoleGroup, setRoleGroupsCache, loadHrmRoleGroups, setApprovalConfigCache, getConfiguredApprover } from './context';
import { Toast } from './context/NotificationContext';
import { hashPasswordSync } from './lib/passwordUtils';
import { migrateLegacyData } from './lib/migrateLocalStorage';

// COMPONENTS
import DashboardOverview from './components/DashboardOverview';
import CabinetEstimator from './components/CabinetEstimator';
import ConstructionEstimator from './components/ConstructionEstimator';
import MechanicalEstimator from './components/MechanicalEstimator';
import ProjectManagement from './components/ProjectManagement';
import TaskManagement from './components/TaskManagement';
import FinanceManagement from './components/FinanceManagement';
import ProjectKanbanBoard from './components/ProjectKanbanBoard';
import HumanResourcesManagement from './components/HumanResourcesManagement';
import QuotationSystem from './components/QuotationSystem';
import QuoteArchive from './components/QuoteArchive';
import MaterialCoordination from './components/MaterialCoordination';
import WarehouseSuppliers from './components/WarehouseSuppliers';
import WarehouseManagement from './components/WarehouseManagement';
import WarehouseDataManagement from './components/WarehouseDataManagement';
import SubcontractorManagement from './components/SubcontractorManagement';
import DirectorDashboard from './components/DirectorDashboard';
import Login from './components/Login';
import UserProfileModal from './components/UserProfileModal';
import MessagesView from './components/MessagesView';
import DisplaySettingsPage from './components/DisplaySettingsPage';

// ICONS
import { 
  LayoutDashboard, 
  Briefcase, 
  CheckSquare, 
  Calculator, 
  DollarSign, 
  Users, 
  BookOpen, 
  FileText,
  Clock,
  Shield,
  HelpCircle,
  LogOut,
  UserCog,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Folder,
  Search,
  BriefcaseIcon,
  CircleDot,
  Sliders,
  Palette,
  Info,
  Plus,
  Trash2,
  Building,
  Lock,
  Check,
  ShieldAlert,
  Database,
  PanelLeftClose,
  PanelLeftOpen,
  Bell,
  Mail,
  MessageSquare,
  CheckCircle,
  BarChart3,
  X,
  Menu,
  RefreshCw,
  Calendar,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getSupabase, initializeSupabase } from './lib/supabase';
import {
  parsePushData,
  readDeepLinkFromLocation,
  clearDeepLinkFromLocation,
  hasDeepLinkTarget,
  NOTIFICATION_CLICK_MESSAGE,
  type PushDeepLink,
} from './lib/pushDeepLink';
import { createClient } from '@supabase/supabase-js';

const generateUsername = (name: string): string => {
  if (!name) return '';
  let cleanName = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  cleanName = cleanName.replace(/[đĐ]/g, 'd');
  cleanName = cleanName.replace(/[^a-zA-Z0-9\s]/g, '');
  const words = cleanName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'user';
  if (words.length === 1) return words[0].toLowerCase();
  const lastName = words[words.length - 1].toLowerCase();
  const firstLetters = words.slice(0, words.length - 1)
    .map(w => w.charAt(0).toLowerCase())
    .join('');
  return firstLetters + lastName;
};

const generateUsernameWithPhone = (name: string, phone: string): string => {
  if (!name) return '';
  let cleanName = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  cleanName = cleanName.replace(/[đĐ]/g, 'd');
  cleanName = cleanName.replace(/[^a-zA-Z0-9\s]/g, '');
  const words = cleanName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'user';
  const lastName = words[words.length - 1].toLowerCase();
  const cleanPhone = (phone || '').replace(/\D/g, '');
  const last3Digits = cleanPhone.length >= 3 ? cleanPhone.slice(-3) : '123';
  return `${lastName}${last3Digits}`;
};

const getEmployeePermissionGroupName = (emp: any): string => {
  try {
    // Đọc từ in-memory cache (đã load từ Supabase)
    const hrmRoles = loadHrmRoleGroups();

    if (Array.isArray(hrmRoles) && hrmRoles.length > 0) {
      const foundRole = hrmRoles.find((r: any) => r.memberIds && r.memberIds.includes(emp.id));
      if (foundRole) return foundRole.name;
    }

    // Try mapping from old role field
    if (emp.role === 'director' || emp.username === 'admin') return 'Ban Giám Đốc (Admin)';
    if (emp.role === 'accountant') return 'Kế toán viên';
    if (emp.role === 'pm') return 'Quản lý dự án';
    if (emp.role === 'engineer') return 'Nhân viên Kỹ thuật';
    if (emp.role === 'quotation') return 'Nhân viên Báo giá';
    if (emp.role === 'purchasing') return 'Nhân viên Mua sắm';
    if (emp.role === 'factory') return 'Xưởng sản xuất';
  } catch (e) {
    console.error(e);
  }
  return 'Nhân viên / Chưa phân quyền';
};

/**
 * Tính danh sách các menu (tab) được phép truy cập từ Role Groups của nhân viên.
 * Đây là nguồn sự thật duy nhất cho menu gating sau khi chuyển sang HL HRM Role Groups.
 * @param emp Nhân viên hiện tại
 * @returns Mảng các tab code được phép (view = true trên bất kỳ group nào)
 */
const getAllowedTabsFromRoleGroups = (emp: Employee | null): string[] => {
  if (!emp) return [];
  try {
    // Đọc từ in-memory cache (đã load từ Supabase)
    const groups = loadHrmRoleGroups();
    if (!Array.isArray(groups) || groups.length === 0) return [];

    const userGroups = groups.filter(g =>
      emp.roleGroupIds?.includes(g.id) || g.memberIds?.includes(emp.id)
    );
    if (userGroups.length === 0) return [];

    const allowed = new Set<string>();
    userGroups.forEach(g => {
      const perms = g.permissions || {};
      Object.keys(perms).forEach(code => {
        if (perms[code]?.view) {
          allowed.add(code.replace(/_/g, '-'));
        }
      });
    });

    return Array.from(allowed);
  } catch (e) {
    console.error('Lỗi đọc phân quyền từ Role Groups cache:', e);
    return [];
  }
};

const ADMIN_EMPLOYEE: Employee = {
  id: 'emp_admin',
  name: 'Administrator',
  role: 'director',
  email: 'admin@hoanglong.vn',
  phone: '0000000000',
  department: 'Ban Giám Đốc',
  username: 'admin',
  password: 'admin',
  roleGroupIds: ['role_superadmin', 'role_admin', 'role_accounting', 'role_office', 'role_technical', 'role_factory_mwood', 'role_factory_mmetal'],
  status: 'working',
  hasSystemAccount: true
};

const ensureAdminAndPasswords = (emps: Employee[]): Employee[] => {
  const mapped: Employee[] = emps.map(emp => {
    if (emp.username === 'admin' || emp.id === 'emp_admin') {
      return {
        ...emp,
        ...ADMIN_EMPLOYEE,
        id: 'emp_admin',
        username: 'admin',
        roleGroupIds: ['role_superadmin', 'role_admin', 'role_accounting', 'role_office', 'role_technical', 'role_factory_mwood', 'role_factory_mmetal'],
        hasSystemAccount: true
      };
    }
    // Enrich roleGroupIds for non-admin users
    let roleGroupIds = emp.roleGroupIds;
    if (!roleGroupIds || roleGroupIds.length === 0) {
      try {
        const groups = loadHrmRoleGroups();
        if (Array.isArray(groups)) {
          roleGroupIds = groups
            .filter(g => g.memberIds?.includes(emp.id))
            .map((g: any) => g.id);
        }
      } catch { /* ignore */ }
    }
    return {
      ...emp,
      roleGroupIds: roleGroupIds && roleGroupIds.length > 0 ? roleGroupIds : undefined,
      username: emp.username || generateUsername(emp.name),
      password: emp.password || hashPasswordSync('123')
    };
  });
  if (!mapped.some(e => e.username === 'admin' || e.id === 'emp_admin')) {
    mapped.unshift(ADMIN_EMPLOYEE);
  }
  return mapped;
};

// ─── Helper functions ────────────────────────────────────────────────────────

/**
 * Helper to dynamically load all role groups (from Supabase then local)
 */
async function loadAllRoleGroups(): Promise<{ id: string; name: string }[]> {
  try {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase.from('hrm_role_groups').select('id, name');
      if (!error && data && data.length > 0) {
        return data.map((r: any) => ({ id: r.id, name: r.name }));
      }
    }
  } catch (e) {
    console.warn('Supabase hrm_role_groups load error:', e);
  }

  // Fallback: đọc từ in-memory cache (đã load từ Supabase)
  const cached = loadHrmRoleGroups();
  if (cached && cached.length > 0) {
    return cached.map((r: any) => ({ id: r.id, name: r.name }));
  }
  return [
    { id: 'role_superadmin', name: 'Siêu Admin (Super Admin)' },
    { id: 'role_admin', name: 'Ban Giám Đốc (Admin)' },
    { id: 'role_accounting', name: 'Kế toán viên' },
    { id: 'role_office', name: 'Nhân viên Văn phòng' },
    { id: 'role_technical', name: 'Nhân viên Kỹ thuật' },
    { id: 'role_factory_mwood', name: 'Tổ xưởng Mộc' },
    { id: 'role_factory_mmetal', name: 'Tổ xưởng Cơ khí' },
  ];
}

// ─── Component nhập số phút ổn định (dùng ngoài render để không mất focus) ───
function ShiftMinuteInput({
  field, label, value, accentBorder, hrmConfig, setHrmConfig,
}: {
  field: string;
  label: string;
  value: any;
  accentBorder: string;
  hrmConfig: any;
  setHrmConfig: React.Dispatch<React.SetStateAction<any>>;
}) {
  const handleChange = (rawVal: string) => {
    const val = rawVal === '' ? '' : Math.max(0, parseInt(rawVal, 10));
    const updated = { ...hrmConfig, [field]: val };
    setHrmConfig?.(updated);
    // Chỉ save khi nội dung thật sự khác state hiện có (chặn save trùng lặp
    // mỗi lần render lại từ realtime event với cùng giá trị).
    if (stableStr(updated) !== stableStr(hrmConfig)) {
      dbService.shiftConfig.save(updated).catch(e => console.error('Supabase shiftConfig save error:', e));
    }
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('hl_system_settings_updated'));
  };
  const handleBlur = () => {
    if ((hrmConfig as any)[field] === '' || (hrmConfig as any)[field] === undefined || (hrmConfig as any)[field] === null) {
      const updated = { ...hrmConfig, [field]: 15 };
      setHrmConfig?.(updated);
      dbService.shiftConfig.save(updated).catch(e => console.error('Supabase shiftConfig save error:', e));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('hl_system_settings_updated'));
    }
  };
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] text-slate-300 font-medium"><span>{label}</span></div>
      <div className="relative">
        <input
          type="number"
          min="0"
          placeholder="15"
          value={value ?? ''}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          className={`w-full bg-slate-900/60 border border-slate-800 ${accentBorder} rounded p-2 text-xs text-white outline-none focus:border-sky-500/50 font-mono pr-12`}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-bold pointer-events-none font-mono">phút</span>
      </div>
    </div>
  );
}

/** Bỏ password khỏi user object trước khi lưu session — KHÔNG lưu password hash vào storage */
const stripPassword = (emp: any) => {
  if (!emp) return emp;
  const { password, ...safe } = emp;
  return safe;
};

/**
 * Nạp ngược (backfill) khóa ngoại theo MÃ cho phiếu thu/chi CŨ đã lưu bằng TÊN.
 * Chỉ điền các trường id còn thiếu (idempotent). Trả về mảng đã làm giàu + danh sách
 * bản ghi bị đổi (để gọi save lên Supabase).
 * Lưu ý: salesOrderId / purchaseOrderId KHÔNG có tên để đối chiếu → bỏ qua (chỉ nạp
 * cho các FK có thể suy từ tên: collectorId, employeeId, supplierId, proposerId, approverId).
 */
const backfillVoucherFks = (
  receipts: any[],
  payments: any[],
  masters: { employees: any[]; suppliers: any[]; customers: any[]; projects: any[]; salesOrders: any[]; purchaseOrders: any[] }
) => {
  const { employees, suppliers } = masters;
  const norm = (s?: string) => (s ? s.trim().toLowerCase() : '');
  const empByName = (name?: string) => (name ? employees.find(e => e.name && norm(e.name) === norm(name)) : undefined);
  const supByName = (name?: string) => (name ? suppliers.find(s => s.name && norm(s.name) === norm(name)) : undefined);
  const changed: { table: 'receipts' | 'payments'; row: any }[] = [];

  const newReceipts = (receipts || []).map(r => {
    let upd: any = null;
    if (!r.collectorId) {
      const e = empByName(r.collector);
      if (e) upd = { ...(upd || r), collectorId: e.id };
    }
    if (upd) { changed.push({ table: 'receipts', row: upd }); return upd; }
    return r;
  });

  const newPayments = (payments || []).map(p => {
    let upd: any = null;
    const cat = p.category;
    // Người nhận (recipient) → id theo nhóm
    if (!p.employeeId && !p.supplierId && !p.subcontractorId && p.recipient) {
      if (['salary', 'salary_advance', 'site_expense'].includes(cat)) {
        const e = empByName(p.recipient); if (e) upd = { ...(upd || p), employeeId: e.id };
      } else if (['supplier_payment', 'material', 'shipping', 'machinery', 'general', 'other'].includes(cat)) {
        const s = supByName(p.recipient); if (s) upd = { ...(upd || p), supplierId: s.id };
      } else {
        // subcontractor_advance / labor: thầu phụ thủ công dùng bảng suppliers → thử supplier trước
        const s = supByName(p.recipient); if (s) upd = { ...(upd || p), supplierId: s.id };
      }
    }
    if (!p.proposerId && p.proposer) { const e = empByName(p.proposer); if (e) upd = { ...(upd || p), proposerId: e.id }; }
    if (!p.approverId && p.approver) {
      const e = employees.find(e => e.name && (p.approver as string).startsWith(e.name));
      if (e) upd = { ...(upd || p), approverId: e.id };
    }
    if (upd) { changed.push({ table: 'payments', row: upd }); return upd; }
    return p;
  });

  return { receipts: newReceipts, payments: newPayments, changed };
};

export default function App() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (toast: { title: string; message: string; type?: 'success' | 'info' | 'warning' | 'error'; duration?: number }) => {
    const id = `${Date.now()}_${Math.random()}`;
    const duration = toast.duration === undefined ? 5000 : toast.duration;
    const type = toast.type === undefined ? 'info' : toast.type;
    // Đẩy cập nhật state vào microtask thay vì chạy ngay. Tránh warning
    // "Cannot update a component while rendering a different component" khi
    // addToast tình cờ bị gọi trong lúc một component khác đang ở pha render
    // (ví dụ bên trong .map() hoặc hàm tính toán chạy lúc render).
    queueMicrotask(() => {
      setToasts(prev => [...prev, { ...toast, id, duration, type }]);
    });
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const [employees, setEmployees] = useState<Employee[]>([]);

  return (
    <DisplaySettingsProvider>
      <AppContent
        toasts={toasts} setToasts={setToasts} addToast={addToast} removeToast={removeToast}
        employees={employees} setEmployees={setEmployees}
      />
    </DisplaySettingsProvider>
  );
}

interface AppContentProps {
  toasts: Toast[];
  setToasts: React.Dispatch<React.SetStateAction<Toast[]>>;
  addToast: (toast: { title: string; message: string; type?: 'success' | 'info' | 'warning' | 'error'; duration?: number }) => void;
  removeToast: (id: string) => void;
  employees: Employee[];
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
}

function AppContent({ toasts, setToasts, addToast, removeToast, employees, setEmployees }: AppContentProps) {
  // ── Trạng thái khởi tạo: hiển thị splash screen trong khi load data từ Supabase ──
  const [isInitializing, setIsInitializing] = useState(true);

  // 1. Cấu hình Phân quyền từng vai trò

  const { displaySettings } = useDisplaySettings();
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({
    director: [
      'dashboard', 'director-office', 'director-dashboard',
      'project-office', 'projects-construction', 'projects-furniture', 'projects-mechanical', 'tasks', 'messages',
      'hr-office', 'employees', 'hr-data',
      'accounting-office', 'finance', 'finance-data',
      'warehouse-office', 'material-coordination', 'warehouse-suppliers', 'warehouse-management', 'warehouse-data',
      'subcontractor-office', 'subcontractor-management',
      'library-office', 'quotes-construction', 'quotes', 'quotes-mechanical', 'quotes-subcontractor',
      'system-office', 'settings-accounts', 'settings-roles', 'settings', 'display-settings'
    ],
    accountant: [
      'dashboard',
      'project-office', 'projects-construction', 'projects-furniture', 'projects-mechanical', 'tasks', 'messages',
      'hr-office', 'employees',
      'accounting-office', 'finance', 'finance-data',
      'warehouse-office', 'material-coordination', 'warehouse-suppliers', 'warehouse-management', 'warehouse-data',
      'subcontractor-office', 'subcontractor-management',
      'library-office', 'quotes',
      'system-office', 'settings'
    ],
    pm: [
      'dashboard',
      'project-office', 'projects-construction', 'projects-furniture', 'projects-mechanical', 'tasks', 'messages',
      'hr-office', 'employees',
      'subcontractor-office', 'subcontractor-management',
      'library-office', 'quotes',
      'system-office', 'settings'
    ],
    engineer: [
      'dashboard',
      'project-office', 'projects-construction', 'projects-furniture', 'projects-mechanical', 'tasks', 'messages',
      'hr-office', 'employees',
      'system-office', 'settings'
    ],
    quotation: [
      'dashboard', 'tasks', 'employees', 'settings', 'messages',
      'library-office', 'quotes-construction', 'quotes', 'quotes-mechanical', 'quotes-subcontractor'
    ],
    purchasing: [
      'dashboard', 'tasks', 'employees', 'settings', 'messages',
      'warehouse-office', 'material-coordination', 'warehouse-suppliers', 'warehouse-data'
    ],
    factory: [
      'dashboard', 'tasks', 'employees', 'settings', 'messages',
      'project-office', 'projects-furniture'
    ]
  });

  // Helper cho Màu chủ đạo hiển thị động
  const accentTextClass = 
    displaySettings.primaryAccent === 'emerald' ? 'text-emerald-400' :
    displaySettings.primaryAccent === 'sky' ? 'text-sky-400' :
    displaySettings.primaryAccent === 'indigo' ? 'text-indigo-400' :
    displaySettings.primaryAccent === 'amber' ? 'text-amber-400' :
    displaySettings.primaryAccent === 'rose' ? 'text-rose-400' : 'text-violet-400';

  const accentBgClass = 
    displaySettings.primaryAccent === 'emerald' ? 'bg-emerald-500 text-slate-950 font-black' :
    displaySettings.primaryAccent === 'sky' ? 'bg-sky-500 text-slate-100 font-black' :
    displaySettings.primaryAccent === 'indigo' ? 'bg-indigo-500 text-white font-black' :
    displaySettings.primaryAccent === 'amber' ? 'bg-amber-500 text-slate-950 font-black' :
    displaySettings.primaryAccent === 'rose' ? 'bg-rose-500 text-white font-black' : 'bg-violet-500 text-white font-black';

  const accentBorderClass = 
    displaySettings.primaryAccent === 'emerald' ? 'border-emerald-500/20' :
    displaySettings.primaryAccent === 'sky' ? 'border-sky-500/20' :
    displaySettings.primaryAccent === 'indigo' ? 'border-indigo-500/20' :
    displaySettings.primaryAccent === 'amber' ? 'border-amber-500/20' :
    displaySettings.primaryAccent === 'rose' ? 'border-rose-500/20' : 'border-violet-500/20';

  const sidebarActiveTabClass = 
    displaySettings.primaryAccent === 'emerald' ? 'bg-slate-800 text-emerald-400 border-emerald-500/20 font-bold' :
    displaySettings.primaryAccent === 'sky' ? 'bg-slate-800 text-sky-400 border-sky-500/20 font-bold' :
    displaySettings.primaryAccent === 'indigo' ? 'bg-slate-800 text-indigo-400 border-indigo-500/20 font-bold' :
    displaySettings.primaryAccent === 'amber' ? 'bg-slate-800 text-amber-400 border-amber-500/20 font-bold' :
    displaySettings.primaryAccent === 'rose' ? 'bg-slate-800 text-rose-400 border-rose-500/20 font-bold' : 'bg-slate-800 text-violet-400 border-violet-500/20 font-bold';

  // 3. Hồ sơ doanh nghiệp (nguồn: Supabase)
  const [businessInfo, setBusinessInfo] = useState({
    companyName: 'CÔNG TY TNHH LÂM NGHIỆP & XÂY DỰNG HOÀNG LONG',
    taxCode: '5801456789',
    representative: 'Trương Hữu Long',
    phone: '0988.123.456',
    email: 'contact@hoanglonglamdong.vn',
    address: 'Số 120 Đường Trần Phú, Phường 2, TP. Bảo Lộc, Lâm Đồng',
    foundingYear: '2016',
    businessSector: 'Xây dựng dân dụng, sản xuất và thi công nội thất mộc cabinet, gia công cơ khí cấu kiện thép',
    bankInfo: '1023456789 - Vietcombank Chi nhánh Bảo Lộc',
    scale: 'Hơn 150 kỹ sư & thợ lành nghề'
  });

  const isBusinessInfoInitRef = React.useRef(true);
  // Chuỗi stableStr của giá trị ĐÃ lưu lần gần nhất — chặn vòng lặp realtime:
  // fireConfigEvent → setBusinessInfo(object mới cùng nội dung) → nếu không
  // chặn, effect sẽ INSERT lại → event mới → mọi tab lặp lại vô hạn.
  const lastSavedBizRef = React.useRef<string | null>(null);
  useEffect(() => {
    // Skip save lần đầu (khi load từ cloud) — chỉ ghi nhớ nội dung để so sánh sau
    if (isBusinessInfoInitRef.current) {
      isBusinessInfoInitRef.current = false;
      lastSavedBizRef.current = stableStr(businessInfo);
      return;
    }
    const next = stableStr(businessInfo);
    if (next === lastSavedBizRef.current) {
      return; // chỉ đổi tham chiếu, KHÔNG đổi nội dung → không save, không sinh event
    }
    lastSavedBizRef.current = next;
    dbService.businessProfile.save(businessInfo);
  }, [businessInfo]);

  // Bootstrap và đồng bộ hoá dữ liệu từ Cloud trên nền tảng Supabase
  // ── BƯỚC 1: Load từ localStorage (instant) → hiện app ngay ──
  // ── BƯỚC 2: Fetch employees từ cloud (bắt buộc cho auth) ──
  // ── BƯỚC 3: Sync tất cả data từ cloud ở background → update state + localStorage ──
  useEffect(() => {
    const CACHE_KEY = 'hl_core_cache_v1';
    const CACHE_TABLES = ['customers', 'projects', 'tasks', 'receipts', 'payments', 'quotes'];

    const toCamel = (rows: any[]) => (rows || []).map((r: any) => {
      const n: any = {};
      Object.keys(r).forEach(k => {
        const camel = k.replace(/([-_][a-z])/g, g => g.toUpperCase().replace('-', '').replace('_', ''));
        n[camel] = r[k];
      });
      return n;
    });

    const saveToCache = (table: string, data: any[]) => {
      try {
        const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        cache[table] = data;
        cache._ts = Date.now();
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      } catch {}
    };

    const loadFromCache = (): Record<string, any[]> | null => {
      try {
        const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        if (cache._ts && Object.keys(cache).length > 1) return cache;
      } catch {}
      return null;
    };

    const initAndSync = async () => {
      try {
        // ── BƯỚC 1: Load non-sensitive data từ localStorage (instant) ──
        const cache = loadFromCache();
        if (cache) {
          console.log('[Init] 📦 Loaded from localStorage cache');
          if (cache.customers) setCustomers(cache.customers);
          if (cache.projects) {
            const filtered = cache.projects.filter((p: any) => !p.name?.startsWith('Dự án độc lập - ') || !p.notes?.includes('Tạo dự án tự động từ báo giá hoàn tất'));
            setProjects(filtered);
          }
          if (cache.tasks) setTasks(cache.tasks);
          if (cache.receipts) setReceipts(cache.receipts);
          if (cache.payments) setPayments(cache.payments);
          if (cache.quotes) setQuotes(cache.quotes);
          // Populate query cache để các component query lẻ dùng luôn
          for (const t of CACHE_TABLES) {
            if (cache[t]) dbService.populateCache(t, cache[t]);
          }
        }

        // ── BƯỚC 2: Fetch employees từ cloud (bắt buộc cho auth) ──
        let cloudEmps: Employee[];
        try {
          let data: Record<string, any[]> | null = null;
          try {
            data = await dbService.loadAllCore();
          } catch { /* RPC chưa có */ }
          cloudEmps = data
            ? toCamel(data.employees || [])
            : await dbService.employees.list();
        } catch {
          cloudEmps = await dbService.employees.list();
        }
        const finalEmps = ensureAdminAndPasswords(cloudEmps);
        setEmployees(finalEmps);

        // ── Nhóm chat "Điểm danh" (idempotent, không chặn init) ──
        ensureAttendanceChatGroup(finalEmps).catch(err =>
          console.warn('ensureAttendanceChatGroup error:', err));

        // Ensure admin
        const hasAdminInDb = finalEmps.some(e => e.username === 'admin' || e.id === 'emp_admin');
        if (!hasAdminInDb) {
          dbService.employees.save(ADMIN_EMPLOYEE).catch(() => {});
        }

        // Session
        const activeSessionStr = sessionStorage.getItem('hl_erp_active_session') || localStorage.getItem('hl_erp_active_session');
        if (activeSessionStr) {
          try {
            const parsedSession = JSON.parse(activeSessionStr);
            const foundUser = finalEmps.find(e => e.id === parsedSession.id || e.username === parsedSession.username);
            if (foundUser) {
              setCurrentUser(foundUser);
              sessionStorage.setItem('hl_erp_active_session', JSON.stringify(stripPassword(foundUser)));
            } else {
              setCurrentUser(parsedSession);
            }
          } catch { setCurrentUser(null); }
        } else {
          setCurrentUser(null);
        }

        // Employees xong → ẩn splash screen
        setIsInitializing(false);

        // ── MIGRATION MỘT LẦN: đẩy dữ liệu nghiệp vụ cũ từ localStorage lên Supabase ──
        migrateLegacyData();

        // ── BƯỚC 3: Sync cloud ở background → update state + cache ──
        // (non-blocking, app đã render xong từ localStorage)
        (async () => {
          try {
            let cloudData: Record<string, any[]> | null = null;
            try {
              cloudData = await dbService.loadAllCore();
            } catch {
              // Fallback: query từng bảng
              const [custs, projs, tsks, recs, pays, qtes, sOrders, pOrders, sups, advances, bps, scs] = await Promise.all([
                dbService.customers.list(), dbService.projects.list(),
                dbService.tasks.list(), dbService.receipts.list(),
                dbService.payments.list(), dbService.quotes.list(),
                dbService.salesOrders.list(), dbService.purchaseOrders.list(),
                dbService.suppliers.list().catch(() => []),
                dbService.subcontractorAdvances.list(),
                dbService.businessProfile.list().catch(() => []),
                dbService.shiftConfig.list().catch(() => []),
              ]);
              cloudData = {
                customers: custs, projects: projs, tasks: tsks,
                receipts: recs, payments: pays, quotes: qtes,
                sales_orders: sOrders, purchase_orders: pOrders,
                suppliers: sups,
                subcontractor_advances: advances,
                business_profile: bps, shift_config: scs,
              };
            }

            // Update state từ cloud
            const custRows = toCamel(cloudData.customers || []);
            const projRows = toCamel(cloudData.projects || []);
            const taskRows = toCamel(cloudData.tasks || []);
            const recRows = toCamel(cloudData.receipts || []);
            const payRows = toCamel(cloudData.payments || []);
            const quoteRows = toCamel(cloudData.quotes || []);
            // Đơn hàng bán / mua: RPC load_all_core_data() ở các bản migration cũ
            // KHÔNG trả về 2 key này. RPC không báo lỗi trong trường hợp đó, nên
            // phải kiểm tra tường minh và query bù, nếu không danh sách sẽ trống
            // → generateSOCode() đếm 0 → mã đơn trùng → upsert ghi đè hàng cũ.
            let sOrderRaw = cloudData.sales_orders;
            let pOrderRaw = cloudData.purchase_orders;
            if (!Array.isArray(sOrderRaw) || !Array.isArray(pOrderRaw)) {
              console.warn('[Init] RPC load_all_core_data() thiếu sales_orders/purchase_orders — query bù trực tiếp. Hãy chạy migration 015.');
              const [sFix, pFix] = await Promise.all([
                Array.isArray(sOrderRaw) ? Promise.resolve(sOrderRaw) : dbService.salesOrders.list().catch(e => { console.error('[Init] Query bù sales_orders thất bại:', e); return []; }),
                Array.isArray(pOrderRaw) ? Promise.resolve(pOrderRaw) : dbService.purchaseOrders.list().catch(e => { console.error('[Init] Query bù purchase_orders thất bại:', e); return []; }),
              ]);
              // dbService.*.list() đã trả về camelCase → không toCamel lần nữa
              sOrderRaw = sFix; pOrderRaw = pFix;
            }
            const sOrderRows = toCamel(sOrderRaw || []).map(normalizeOrderItems);
            const pOrderRows = toCamel(pOrderRaw || []).map(normalizeOrderItems);

            // business_profile / shift_config chỉ có trong RPC load_all_core_data.
            // Nếu RPC trả [] cho 1 trong 2 (do lỗi phụ trợ), query bù trực tiếp
            // để không làm mất thông tin công ty / cấu hình ca làm việc.
            if (!Array.isArray(cloudData.business_profile) || cloudData.business_profile.length === 0) {
              cloudData.business_profile = await dbService.businessProfile.list().catch(() => []);
            }
            if (!Array.isArray(cloudData.shift_config) || cloudData.shift_config.length === 0) {
              cloudData.shift_config = await dbService.shiftConfig.list().catch(() => []);
            }

            const supRows = toCamel(cloudData.suppliers || []);
            const advRows = toCamel(cloudData.subcontractor_advances || []);
            setCustomers(custRows);
            setProjects(projRows.filter((p: any) => !p.name?.startsWith('Dự án độc lập - ') || !p.notes?.includes('Tạo dự án tự động từ báo giá hoàn tất')));
            setTasks(taskRows);
            // ─── Nạp ngược FK (name → id) cho phiếu cũ ─────────────────────
            let finalReceipts = recRows;
            let finalPayments = payRows;
            try {
              const empRows = await dbService.employees.list().catch(() => []);
              const bf = backfillVoucherFks(recRows, payRows, {
                employees: empRows, suppliers: supRows, customers: custRows,
                projects: projRows, salesOrders: sOrderRows, purchaseOrders: pOrderRows,
              });
              if (bf.changed.length > 0) {
                await Promise.all(bf.changed.map(c =>
                  c.table === 'receipts' ? dbService.receipts.save(c.row) : dbService.payments.save(c.row)
                ));
                console.log(`[Init] Nạp ngược ${bf.changed.length} phiếu (FK theo mã).`);
              }
              finalReceipts = bf.receipts;
              finalPayments = bf.payments;
            } catch (bfErr) {
              console.warn('[Init] Backfill FK thất bại, dùng dữ liệu gốc:', bfErr);
            }
            setReceipts(finalReceipts);
            setPayments(finalPayments);
            setSubcontractorAdvances(advRows);
            setQuotes(quoteRows);
            setSalesOrders(sOrderRows);
            setPurchaseOrders(pOrderRows);
            setSuppliers(supRows);
            console.log('[Init] Loaded sales_orders:', sOrderRows.length, 'rows | purchase_orders:', pOrderRows.length, 'rows | suppliers:', supRows.length, 'rows');

            if (cloudData.business_profile?.[0]) {
              const bp = toCamel([cloudData.business_profile[0]])[0];
              setBusinessInfo(bp);
              // Đồng bộ luôn baseline (lastSavedBizRef) tại đây — nếu không, effect
              // "chặn vòng lặp" phía trên có thể đã tiêu cờ isBusinessInfoInitRef ở
              // lần render với businessInfo còn là giá trị mặc định hard-code (trước
              // khi cloud load xong), khiến setBusinessInfo(bp) THẬT ở đây bị hiểu
              // nhầm là "vừa sửa" nếu bp khác mặc định dù chỉ 1 field → lưu thừa 1 lần.
              isBusinessInfoInitRef.current = false;
              lastSavedBizRef.current = stableStr(bp);
            }
            if (cloudData.shift_config?.[0]) setHrmConfig(prev => ({ ...DEFAULT_SYSTEM_CONFIG, ...toCamel([cloudData.shift_config[0]])[0] }));

            // Save vào cache (bỏ qua sensitive tables — KHÔNG lưu sales_orders, purchase_orders vào localStorage)
            for (const t of CACHE_TABLES) {
              const key = t === 'projects' ? 'projects' : t;
              const rows = { customers: custRows, projects: projRows, tasks: taskRows, receipts: recRows, payments: payRows, quotes: quoteRows }[key];
              if (rows) saveToCache(t, rows);
              if (rows) dbService.populateCache(t, rows);
            }

            console.log('[Init] ✅ Cloud sync done — cache updated');
          } catch (e) {
            console.warn('[Init] ⚠️ Cloud sync failed, using cached data:', e);
          }
        })();

      } catch (err) {
        console.warn("Lỗi kết nối:", err);
        setIsInitializing(false);
      }
    };
    initAndSync();
  }, []);

  // Khối Dữ Liệu Nhân Viên — KHÔNG cache localStorage để tránh lộ thông tin nhạy cảm

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Trạng thái Người dùng hiện tại (bỏ chế độ phân quyền giả định, bắt buộc đăng nhập thực thụ)
  const [currentUser, setCurrentUser] = useState<Employee | null>(() => {
    // Check sessionStorage first (tab reload)
    const sessionActive = sessionStorage.getItem('hl_erp_active_session');
    if (sessionActive) {
      try {
        return JSON.parse(sessionActive);
      } catch (e) {}
    }
    // Check localStorage (Remember me + Auto Login)
    const savedSession = localStorage.getItem('hl_erp_active_session');
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        // Sync to sessionStorage
        sessionStorage.setItem('hl_erp_active_session', savedSession);
        return parsed;
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  // Web Push notification registration
  useWebPush(currentUser?.id ?? null);

  // ─── Super Admin check: query Supabase DB trực tiếp, KHÔNG dùng localStorage ──
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  useEffect(() => {
    if (!currentUser?.id) { setIsSuperAdmin(false); return; }
    dbService.checkSuperAdmin(currentUser.id).then(setIsSuperAdmin).catch(() => setIsSuperAdmin(false));
  }, [currentUser?.id]);

  // ─── Load chat conversations từ sớm để sidebar badge hoạt động ──────────────
  const [, forceChatUpdate] = useState(0);

  useEffect(() => {
    if (!currentUser?.id) return;
    loadConversationsFromCloud(currentUser.id);
  }, [currentUser?.id]);

  // Subscribe realtime + trigger re-render để sidebar badge cập nhật
  useEffect(() => {
    if (!currentUser?.id) return;
    const unsub = subscribeConversations(currentUser.id, () => {
      forceChatUpdate(n => n + 1);
    });
    return () => unsub();
  }, [currentUser?.id]);

  const [activeTab, setActiveTabState] = useState<string>(() => {
    return sessionStorage.getItem('hl_erp_active_tab') || 'dashboard';
  });
  const [tabHistory, setTabHistory] = useState<string[]>([]);
  // Wrapper setActiveTab tự động lưu tab hiện tại vào history trước khi chuyển tab
  const setActiveTab = useCallback((tab: string) => {
    setTabHistory(prev => activeTab !== tab ? [...prev, activeTab] : prev);
    setActiveTabState(tab);
  }, [activeTab]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);

  useEffect(() => {
    sessionStorage.setItem('hl_erp_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [activeTab]);

  const [financeSubTab, setFinanceSubTab] = useState<string>('de_xuat_thu_chi');
  const [financeInitialProposalId, setFinanceInitialProposalId] = useState<string | null>(null);
  // Mở Tài Chính > Đề xuất thu chi và tự động mở form lập phiếu cho đề xuất có id tương ứng.
  const openFinanceVoucher = (proposalId: string) => {
    setFinanceInitialProposalId(proposalId);
    setFinanceSubTab('de_xuat_thu_chi');
    setActiveTab('finance');
  };
  // Mở Điều Phối Vật Tư và tự động mở chi tiết Đề Xuất Vật Tư tương ứng (từ tab Đơn Hàng).
  const [materialInitialProposalId, setMaterialInitialProposalId] = useState<string | null>(null);
  const openMaterialProposal = (proposalId: string) => {
    setMaterialInitialProposalId(proposalId);
    setActiveTab('material-coordination');
  };
  const [hrSubTab, setHrSubTab] = useState<string>('profiles');
  const [financeDuLieuTab, setFinanceDuLieuTab] = useState<string>('khach_hang');
  const [preselectedCustomerId, setPreselectedCustomerId] = useState<string>('');
  const [preselectedProjectId, setPreselectedProjectId] = useState<string>('');
  const [preselectedQuotesSubTab, setPreselectedQuotesSubTab] = useState<string | null>(null);
  const [preselectedDocType, setPreselectedDocType] = useState<string | null>(null);

  // Reset sub-tab/preselect khi rời khỏi module báo giá để tránh stale "archive"
  useEffect(() => {
    if (!['quotes', 'quotes-construction', 'quotes-mechanical', 'quotes-subcontractor'].includes(activeTab)) {
      setPreselectedQuotesSubTab(null);
      setPreselectedDocType(null);
    }
  }, [activeTab]);

  // Thu gọn sidebar & hệ thống thông báo tin nhắn mới
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('hl_erp_sidebar_collapsed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('hl_erp_sidebar_collapsed', sidebarCollapsed ? 'true' : 'false');
  }, [sidebarCollapsed]);

  // Đóng dropdown tài khoản khi click ra ngoài
  useEffect(() => {
    if (!showUserMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('#user_account_dropdown')) return;
      setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [showUserMenu]);
  // Hội thoại cần mở khi điều hướng vào Messenger
  const [initialConvId, setInitialConvId] = useState<string | null>(null);
  // Sau khi MessagesView đã nhận initialConvId, reset để lần click sau vẫn kích hoạt lại
  useEffect(() => {
    if (initialConvId) {
      const t = setTimeout(() => setInitialConvId(null), 300);
      return () => clearTimeout(t);
    }
  }, [initialConvId]);
  // Hiển thị badge đếm số chưa đọc trên tab
  const [showBadgeCounts, setShowBadgeCounts] = useState<boolean>(() => localStorage.getItem('hl_show_badge_counts') !== 'false');

  // ═══════════════════════════════════════════════════════════════════════
  // DEEP LINK TỪ THÔNG BÁO ĐẨY (Web Push)
  // Bấm vào thông báo → mở ĐÚNG chi tiết công việc / hội thoại tương ứng.
  // Hai đường vào (xem src/lib/pushDeepLink.ts):
  //   1. App đang mở  → service worker postMessage sang đây (không reload).
  //   2. App chưa mở  → SW openWindow('/?taskId=...') → đọc từ location.search.
  // ═══════════════════════════════════════════════════════════════════════

  // Công việc cần bung modal chi tiết (truyền xuống <TaskManagement initialTaskId>)
  const [deepLinkTaskId, setDeepLinkTaskId] = useState<string | null>(null);
  // Deep link công việc đang chờ `tasks` tải xong để tra ID/mã
  const [pendingTaskLink, setPendingTaskLink] = useState<PushDeepLink | null>(null);
  // Deep link xét duyệt (leave/payment/advance) → mở thẳng "Công việc phải duyệt" trong tab Công việc
  const [approvalDeepLink, setApprovalDeepLink] = useState<{ kind: string; id: string } | null>(null);

  const handlePushDeepLink = useCallback((link: PushDeepLink) => {
    // Ưu tiên 1: hội thoại chat
    if (link.conversationId) {
      setActiveTab('messages');
      setInitialConvId(link.conversationId);
      return;
    }

    // Ưu tiên 2: công việc — chuyển tab NGAY, còn modal chi tiết đợi `tasks`
    // tải xong mới bung (xử lý ở effect resolver bên dưới).
    if (link.taskId || link.taskCode) {
      setActiveTab('tasks');
      setPendingTaskLink(link);
      return;
    }

    // Ưu tiên 3: dự án
    if (link.projectId) {
      setActiveTab('projects-construction');
      return;
    }

    // Không có đích cụ thể → điều hướng thô theo phân loại
    switch (link.category) {
      case 'tasks':
      case 'approval':   setActiveTab('tasks'); break;
      case 'finance':    setActiveTab('finance'); break;
      case 'hr':
      case 'employees':  setActiveTab('employees'); break;
      case 'projects':   setActiveTab('projects-construction'); break;
      case 'chat':       setActiveTab('messages'); break;
      default:           setActiveTab('dashboard'); break;
    }
  }, [setActiveTab]);

  // (1) App ĐANG MỞ: nhận message từ service worker khi người dùng bấm thông báo
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.type !== NOTIFICATION_CLICK_MESSAGE) return;
      handlePushDeepLink(parsePushData(event.data.data));
    };
    navigator.serviceWorker.addEventListener('message', onSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onSwMessage);
  }, [handlePushDeepLink]);

  // (2) App MỞ MỚI từ thông báo: đọc deep link trên query string rồi dọn URL
  useEffect(() => {
    const link = readDeepLinkFromLocation();
    if (hasDeepLinkTarget(link)) {
      handlePushDeepLink(link);
    }
    // Xoá query param để F5 không mở lại modal cũ
    clearDeepLinkFromLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ⚠️ Client-side attendance timer ĐÃ BỎ (gây trùng lặp).
  // Thông báo điểm danh giờ chỉ chạy qua server-side:
  //   1. pg_cron SQL (trigger_attendance_reminders) — nguồn chính
  //   2. Edge Function (send-attendance-reminders) — backup

  // Trạng thái cây thư mục Sidebar dạng mô phỏng
  const [isDirectorGroupExpanded, setIsDirectorGroupExpanded] = useState(true);
  const [directorSubDept, setDirectorSubDept] = useState<'projects' | 'hr' | 'accounting' | 'warehouse' | 'subcontractor' | 'summary'>('projects');
  const [isProjectGroupExpanded, setIsProjectGroupExpanded] = useState(true);
  const [isHrGroupExpanded, setIsHrGroupExpanded] = useState(true);
  const [isFinanceGroupExpanded, setIsFinanceGroupExpanded] = useState(true);
  const [isWarehouseGroupExpanded, setIsWarehouseGroupExpanded] = useState(true);
  const [isLibraryGroupExpanded, setIsLibraryGroupExpanded] = useState(true);
  const [isSubcontractorGroupExpanded, setIsSubcontractorGroupExpanded] = useState(true);
  const [isAccountGroupExpanded, setIsAccountGroupExpanded] = useState(true);
  const [sidebarSearch, setSidebarSearch] = useState('');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  // Phản chiếu tasks mới nhất để handler sự kiện đọc được giá trị cập nhật mà
  // không phải chạy side-effect bên trong hàm updater của setState.
  const tasksRef = useRef<Task[]>(tasks);
  tasksRef.current = tasks;
  // HƯỚNG B: ghi nhận thời điểm vừa save 1 task để các nguồn reload (Realtime,
  // hl-tasks-updated, polling) không ghi đè bản đã lưu mới hơn bằng dữ liệu cũ.
  const recentTaskSaves = useRef(new Map<string, number>());
  // Gộp kết quả tải từ server với bản local vừa save (trong cửa sổ 5s) để tránh
  // mất trạng thái "Hoàn thành nhiệm vụ" do race giữa save và reload.
  const applyTasksWithLocalOverrides = useCallback((serverTasks: Task[]) => {
    const now = Date.now();
    const merged: Task[] = serverTasks.map(t => {
      const savedAt = recentTaskSaves.current.get(t.id);
      if (savedAt && now - savedAt < 5000) {
        const local = tasksRef.current.find(x => x.id === t.id);
        if (local) return local;
      }
      return t;
    });
    // Giữ cả task local vừa save nhưng chưa kịp xuất hiện trên server (save chưa commit).
    recentTaskSaves.current.forEach((savedAt, tid) => {
      if (now - savedAt < 5000 && !merged.some(t => t.id === tid)) {
        const local = tasksRef.current.find(x => x.id === tid);
        if (local) merged.push(local);
      }
    });
    setTasks(merged);
  }, [setTasks]);

  // ── Resolver deep link công việc ────────────────────────────────────────
  // Thông báo đẩy có thể mang `taskId` (chuẩn) hoặc chỉ có `taskCode`
  // (`subTaskCode`, VD 'CV-001') với các thông báo cũ. Đợi `tasks` tải xong
  // rồi tra ra ID thật để bung modal chi tiết.
  useEffect(() => {
    if (!pendingTaskLink) return;
    if (tasks.length === 0) return; // chưa tải xong → chờ effect chạy lại

    const { taskId, taskCode } = pendingTaskLink;
    const task =
      (taskId && tasks.find(t => t.id === taskId)) ||
      (taskCode && tasks.find(t => t.code === taskCode)) ||
      // Thông báo cũ có thể nhét MÃ vào ô taskId (hoặc ngược lại) → thử chéo
      (taskId && tasks.find(t => t.code === taskId)) ||
      (taskCode && tasks.find(t => t.id === taskCode)) ||
      null;

    if (task) {
      setDeepLinkTaskId(task.id);
    } else {
      addToast({
        title: '🔍 Không mở được chi tiết',
        message: `Không tìm thấy công việc ${taskId || taskCode} (có thể đã bị xoá hoặc bạn không có quyền xem).`,
        type: 'warning',
      });
    }
    setPendingTaskLink(null);
  }, [pendingTaskLink, tasks, addToast]);

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  // Tổng hợp Công Tác Phí (dùng cho panel CTP trong Tổng Quan)
  const [ctpSummary, setCtpSummary] = useState<any[]>([]);
  // Đơn nghỉ phép (dùng để cộng vào badge "Việc của tôi" – nhánh Công việc phải duyệt)
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [subcontractorAdvances, setSubcontractorAdvances] = useState<SubcontractorAdvanceProposal[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  // Trạng thái đồng bộ & nạp dữ liệu mẫu lên Firestore hoanglongerpdb
  const [isDbSeeding, setIsDbSeeding] = useState(false);
  const [dbSeedSuccess, setDbSeedSuccess] = useState<string | null>(null);

  const handleForceDbSeed = async () => {
    setIsDbSeeding(true);
    setDbSeedSuccess(null);
    try {
      // Gọi bootstrap với cờ force = true để ép buộc ghi đè/bơm đẩy dữ liệu mẫu lên Firestore
      await dbService.bootstrapFirstTime(true);
      
      // Load lại toàn bộ danh sách thực tế từ Live database
      const emps = await dbService.employees.list();
      const mappedEmps = emps.map(emp => ({
        ...emp,
        username: emp.username || generateUsername(emp.name),
        password: emp.password || hashPasswordSync('123')
      }));
      setEmployees(mappedEmps);

      const activeSessionStr = sessionStorage.getItem('hl_erp_active_session') || localStorage.getItem('hl_erp_active_session');
      if (activeSessionStr) {
        try {
          const parsedSession = JSON.parse(activeSessionStr);
          const foundUser = mappedEmps.find(e => e.id === parsedSession.id || e.username === parsedSession.username);
          if (foundUser) {
            setCurrentUser(foundUser);
            sessionStorage.setItem('hl_erp_active_session', JSON.stringify(stripPassword(foundUser)));
          } else if (mappedEmps.length > 0) {
            setCurrentUser(mappedEmps[0]);
          }
        } catch (e) {
          if (mappedEmps.length > 0) setCurrentUser(mappedEmps[0]);
        }
      } else {
        setCurrentUser(null);
      }

      const custs = await dbService.customers.list();
      setCustomers(custs);

      const projs = await dbService.projects.list();
      const filteredProjs = projs.filter(p => !p.name.startsWith('Dự án độc lập - ') || !p.notes?.includes('Tạo dự án tự động từ báo giá hoàn tất'));
      setProjects(filteredProjs);

      const tsks = await dbService.tasks.list();
      setTasks(tsks);

      const recs = await dbService.receipts.list();
      setReceipts(recs);

      const pays = await dbService.payments.list();
      setPayments(pays);

      const qtes = await dbService.quotes.list();
      setQuotes(qtes);

      const sOrders = await dbService.salesOrders.list();
      setSalesOrders(sOrders);

      const pOrders = await dbService.purchaseOrders.list();
      setPurchaseOrders(pOrders);

      setDbSeedSuccess("Đồng bộ & Nạp dữ liệu mẫu lên database hoanglongerpdb thành công!");
      setTimeout(() => setDbSeedSuccess(null), 5000);
    } catch (err: any) {
      console.error(err);
      alert("Đồng bộ dữ liệu mẫu thất bại: " + (err.message || err));
    } finally {
      setIsDbSeeding(false);
    }
  };

  // ========== CÁC TRẠNG THÁI FORM CHO MODULE CÀI ĐẶT TÙY BIẾN =========
  const [subSettingsTab, setSubSettingsTab] = useState<'business' | 'shift' | 'display' | 'supabase'>('business');

  const [hrmConfig, setHrmConfig] = useState(() => DEFAULT_SYSTEM_CONFIG);

  // Điều chỉnh hiển thị (Display Settings)

  // ─── Helper tính toán phút từ chuỗi "HH:MM" ───
  const timeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length < 2) return 0;
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  };

  const formatMinutes = (m: number): string => {
    const totalMin = (m + 1440) % 1440;
    const hh = String(Math.floor(totalMin / 60)).padStart(2, '0');
    const mm = String(totalMin % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  // ─── Helper: tính cửa sổ thực tế mở/đóng của 1 slot ───
  const getSlotWindow = (targetTimeStr: string, beforeMin: number, afterMin: number) => {
    const targetMin = timeToMinutes(targetTimeStr);
    return {
      openMin: targetMin - beforeMin,
      closeMin: targetMin + afterMin,
      openStr: formatMinutes(targetMin - beforeMin),
      closeStr: formatMinutes(targetMin + afterMin),
    };
  };

  // Thêm người dùng mới — form đã xóa, tạo tài khoản qua HRM

  // Đọc danh sách Role Groups từ in-memory cache (đã load từ Supabase)
  const readHrmRoleGroups = (): { id: string; name: string }[] => {
    try {
      const groups = loadHrmRoleGroups();
      if (Array.isArray(groups) && groups.length > 0) {
        return groups.map((r: any) => ({ id: r.id, name: r.name }));
      }
    } catch {}
    return [
      { id: 'role_superadmin', name: 'Siêu Admin (Super Admin)' },
      { id: 'role_admin', name: 'Ban Giám Đốc (Admin)' },
      { id: 'role_accounting', name: 'Kế toán viên' },
      { id: 'role_office', name: 'Nhân viên Văn phòng' },
      { id: 'role_technical', name: 'Nhân viên Kỹ thuật' },
      { id: 'role_factory_mwood', name: 'Tổ xưởng Mộc' },
      { id: 'role_factory_mmetal', name: 'Tổ xưởng Cơ khí' },
    ];
  };
  const [hrmRoleGroups, setHrmRoleGroups] = useState<{ id: string; name: string }[]>(() => readHrmRoleGroups());

  // Điều chỉnh hiển thị

  // Hồ sơ doanh nghiệp
  const [editCorpName, setEditCorpName] = useState(businessInfo.companyName);
  const [editCorpTax, setEditCorpTax] = useState(businessInfo.taxCode);
  const [editCorpRep, setEditCorpRep] = useState(businessInfo.representative);
  const [editCorpPhone, setEditCorpPhone] = useState(businessInfo.phone);
  const [editCorpEmail, setEditCorpEmail] = useState(businessInfo.email);
  const [editCorpAddr, setEditCorpAddr] = useState(businessInfo.address);
  const [editCorpFounding, setEditCorpFounding] = useState(businessInfo.foundingYear);
  const [editCorpSector, setEditCorpSector] = useState(businessInfo.businessSector);
  const [editCorpBank, setEditCorpBank] = useState(businessInfo.bankInfo);
  const [editCorpScale, setEditCorpScale] = useState(businessInfo.scale);

  // Supabase states
  const [supabaseUrlInput, setSupabaseUrlInput] = useState('');
  const [supabaseAnonKeyInput, setSupabaseAnonKeyInput] = useState('');
  const [showSupabaseKey, setShowSupabaseKey] = useState(false);
  const [testConnStatus, setTestConnStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testConnError, setTestConnError] = useState('');

  // Fetch Supabase configuration on mount/activeTab change
  useEffect(() => {
    const fetchSupabaseConfig = async () => {
      // 1. Try from localStorage first for super-fast loading
      const localCfg = localStorage.getItem('hl_supabase_config');
      if (localCfg) {
        try {
          const parsed = JSON.parse(localCfg);
          if (parsed.url) setSupabaseUrlInput(parsed.url);
          if (parsed.anonKey) setSupabaseAnonKeyInput(parsed.anonKey);
        } catch (e) {
          console.error(e);
        }
      }

      // 2. Load from Firebase database config to keep in sync
      try {
        const dbCfg = await dbService.quotationConfigs.get('supabase');
        if (dbCfg && dbCfg.url && dbCfg.anonKey) {
          setSupabaseUrlInput(dbCfg.url);
          setSupabaseAnonKeyInput(dbCfg.anonKey);
          
          // Also sync to local storage if it's different
          const currentLocal = localStorage.getItem('hl_supabase_config');
          if (!currentLocal || JSON.parse(currentLocal).anonKey !== dbCfg.anonKey) {
            localStorage.setItem('hl_supabase_config', JSON.stringify({
              url: dbCfg.url,
              anonKey: dbCfg.anonKey
            }));
            // Update active client live!
            initializeSupabase(dbCfg.url, dbCfg.anonKey);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch cloud Supabase configuration: ", err);
      }
    };

    if (activeTab === 'settings') {
      fetchSupabaseConfig();
    }
  }, [activeTab]);


  const prevBusinessInfoRef = useRef(businessInfo);
  useEffect(() => {
    if (JSON.stringify(businessInfo) === JSON.stringify(prevBusinessInfoRef.current)) return;
    prevBusinessInfoRef.current = businessInfo;
    setEditCorpName(businessInfo.companyName);
    setEditCorpTax(businessInfo.taxCode);
    setEditCorpRep(businessInfo.representative);
    setEditCorpPhone(businessInfo.phone);
    setEditCorpEmail(businessInfo.email);
    setEditCorpAddr(businessInfo.address);
    setEditCorpFounding(businessInfo.foundingYear);
    setEditCorpSector(businessInfo.businessSector);
    setEditCorpBank(businessInfo.bankInfo);
    setEditCorpScale(businessInfo.scale);
  }, [businessInfo]);

  // Tab switching listener for connected tools
  useEffect(() => {
    const handleSwitch = (e: Event) => {
      const customEv = e as CustomEvent;
      if (customEv.detail) {
        if (typeof customEv.detail === 'string') {
          setActiveTab(customEv.detail);
        } else if (typeof customEv.detail === 'object') {
          const { tab, projectId, customerId, financeSubTab, financeDuLieuTab, quotesSubTab, docType } = customEv.detail;
          if (tab) setActiveTab(tab);
          if (projectId) setPreselectedProjectId(projectId);
          if (customerId) setPreselectedCustomerId(customerId);
          if (financeSubTab) setFinanceSubTab(financeSubTab);
          if (financeDuLieuTab) setFinanceDuLieuTab(financeDuLieuTab);
          setPreselectedQuotesSubTab(quotesSubTab || null);
          setPreselectedDocType(docType || null);
        }
      }
    };
    window.addEventListener('hl-switch-tab', handleSwitch);
    return () => window.removeEventListener('hl-switch-tab', handleSwitch);
  }, []);

  // Sync projects from Supabase when updated elsewhere
  useEffect(() => {
    const handleProjectsUpdated = async () => {
      console.log('[SYNC Projects] 🔔 Nhận sự kiện hl-projects-updated');
      // Đọc ngay từ localStorage để đồng bộ tức thì (vd: duyệt báo giá → Công nợ Thu)
      try {
        const localData = localStorage.getItem('hl_erp_projects');
        if (localData) {
          const localProjs = JSON.parse(localData);
          const filteredLocal = localProjs.filter((p: any) => !p.name.startsWith('Dự án độc lập - ') || !p.notes?.includes('Tạo dự án tự động từ báo giá hoàn tất'));
          const approvedLocal = filteredLocal.filter((p: any) => p.baoGiaFile?.isApproved === true);
          console.log(`[SYNC Projects] 📦 localStorage: ${filteredLocal.length} dự án, ${approvedLocal.length} đã duyệt BG`,
            approvedLocal.map((p: any) => ({ id: p.id, name: p.name, totalAmount: p.baoGiaFile?.totalAmount })));
          setProjects(filteredLocal);
        } else {
          console.log('[SYNC Projects] ⚠️ Không tìm thấy hl_erp_projects trong localStorage');
        }
      } catch {}
      // Sau đó đồng bộ từ DB để có dữ liệu mới nhất
      try {
        const projs = await dbService.projects.list();
        const filteredProjs = projs.filter(p => !p.name.startsWith('Dự án độc lập - ') || !p.notes?.includes('Tạo dự án tự động từ báo giá hoàn tất'));
        const approvedProjs = filteredProjs.filter(p => p.baoGiaFile?.isApproved === true);
        console.log(`[SYNC Projects] ☁️ Supabase: ${filteredProjs.length} dự án, ${approvedProjs.length} đã duyệt BG`,
          approvedProjs.map((p: any) => ({ id: p.id, name: p.name, totalAmount: p.baoGiaFile?.totalAmount, 'baoGiaFile?': !!p.baoGiaFile })));
        setProjects(filteredProjs);
      } catch (err) {
        console.error("[SYNC Projects] Lỗi đồng bộ dự án:", err);
      }
    };
    window.addEventListener('hl-projects-updated', handleProjectsUpdated);
    return () => window.removeEventListener('hl-projects-updated', handleProjectsUpdated);
  }, []);

  // Sync tasks from Supabase when updated elsewhere
  useEffect(() => {
    const handleTasksUpdated = async () => {
      try {
        const tsks = await dbService.tasks.list();
        // HƯỚNG B: không để reload cũ ghi đè task vừa được lưu.
        applyTasksWithLocalOverrides(tsks);
      } catch (err) {
        console.error("Lỗi đồng bộ công việc:", err);
      }
    };
    window.addEventListener('hl-tasks-updated', handleTasksUpdated);
    return () => window.removeEventListener('hl-tasks-updated', handleTasksUpdated);
  }, []);

  // Sync customers from Supabase when updated elsewhere
  useEffect(() => {
    const handleCustomersUpdated = async () => {
      try {
        const custs = await dbService.customers.list();
        setCustomers(custs);
      } catch (err) {
        console.error("Lỗi đồng bộ khách hàng:", err);
      }
    };
    window.addEventListener('hl-customers-updated', handleCustomersUpdated);
    return () => window.removeEventListener('hl-customers-updated', handleCustomersUpdated);
  }, []);

  // Sync payments from Supabase when updated elsewhere
  useEffect(() => {
    const handlePaymentsUpdated = async () => {
      try {
        const pays = await dbService.payments.list();
        setPayments(pays || []);
      } catch (err) {
        console.error("Lỗi đồng bộ thu chi:", err);
      }
    };
    window.addEventListener('hl-payments-updated', handlePaymentsUpdated);
    return () => window.removeEventListener('hl-payments-updated', handlePaymentsUpdated);
  }, []);

  // Sync đơn nghỉ phép (dùng cho badge "Việc của tôi") khi mount và khi có thay đổi
  useEffect(() => {
    const loadLeaves = async () => {
      try {
        const data = await dbService.hrmLeaves.list();
        setLeaves(data || []);
      } catch (err) {
        console.error("Lỗi đồng bộ đơn nghỉ phép:", err);
      }
    };
    loadLeaves();
    window.addEventListener('hl-hrm-leaves-updated', loadLeaves);
    return () => window.removeEventListener('hl-hrm-leaves-updated', loadLeaves);
  }, []);

  // Điều hướng mở thẳng 1 hội thoại (ví dụ nhóm chat dự án) từ bất kỳ component
  // con nào qua CustomEvent 'hl-open-conversation' { conversationId }.
  useEffect(() => {
    const handleOpenConversation = (e: Event) => {
      const convId = (e as CustomEvent).detail?.conversationId;
      if (!convId) return;
      setInitialConvId(convId);
      setActiveTab('messages');
    };
    window.addEventListener('hl-open-conversation', handleOpenConversation);
    return () => window.removeEventListener('hl-open-conversation', handleOpenConversation);
  }, []);

  // Deep link từ tin nhắn xét duyệt (leave/payment/advance) → mở tab Công việc
  // ở bảng "Công việc phải duyệt" để người dùng thao tác duyệt/từ chối ngay.
  // travel_expense → mở tab Nhân Sự → Công Tác Phí (nơi kế toán duyệt/từ chối CTP).
  useEffect(() => {
    const handleOpenApproval = (e: Event) => {
      const d = (e as CustomEvent).detail;
      const kind = d?.kind as string;
      const id = d?.id as string;
      if (!kind || !id) return;
      if (kind === 'travel_expense') {
        setHrSubTab('trips');
        setActiveTab('employees');
        return;
      }
      setApprovalDeepLink({ kind, id });
      setActiveTab('tasks');
    };
    window.addEventListener('hl-open-approval', handleOpenApproval);
    return () => window.removeEventListener('hl-open-approval', handleOpenApproval);
  }, [setActiveTab]);

  // Deep link từ tin nhắn thông báo công việc (task/mission) → mở tab Công việc
  // và bung modal chi tiết của công việc được giao (hl-open-task do MessagesView dispatch).
  useEffect(() => {
    const handleOpenTask = (e: Event) => {
      const taskId = (e as CustomEvent).detail?.taskId;
      if (!taskId) return;
      setDeepLinkTaskId(taskId);
      setActiveTab('tasks');
    };
    window.addEventListener('hl-open-task', handleOpenTask);
    return () => window.removeEventListener('hl-open-task', handleOpenTask);
  }, [setActiveTab]);

  // Sync subcontractor advances from Supabase when updated elsewhere
  useEffect(() => {
    const handleAdvancesUpdated = async () => {
      try {
        const list = await dbService.subcontractorAdvances.list();
        setSubcontractorAdvances(list || []);
      } catch (err) {
        console.error("Lỗi đồng bộ đề xuất thu chi:", err);
      }
    };
    window.addEventListener('hl-subcontractor-advances-updated', handleAdvancesUpdated);
    return () => window.removeEventListener('hl-subcontractor-advances-updated', handleAdvancesUpdated);
  }, []);

  // ─── Supabase Realtime: lắng nghe thay đổi bảng (primary sync, polling chỉ là backup) ───
  // G2: nếu client chưa sẵn sàng lúc mount (env rỗng + localStorage trống, user cấu hình
  // Supabase trong cùng phiên) → chờ event hl-supabase-client-ready rồi re-run effect.
  // Khi client ĐƯỢC tạo MỚI (initializeSupabase chạy lại), channel cũ gắn với instance cũ
  // sẽ chết → phải resubscribe. Dep [realtimeRetry] đảm bảo cleanup channel cũ trước.
  const [realtimeRetry, setRealtimeRetry] = useState(0);
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      console.warn('[Realtime] Supabase not available yet, waiting for hl-supabase-client-ready');
      const onReady = () => {
        console.log('[Realtime] Client ready — (re)subscribing');
        setRealtimeRetry(n => n + 1);
      };
      window.addEventListener('hl-supabase-client-ready', onReady);
      return () => window.removeEventListener('hl-supabase-client-ready', onReady);
    }

    // ─── Coalescer: gom burst realtime event trong 3s thành 1 lần chạy ──────
    // Vấn đề: 1 thao tác của user A (vd lưu task) sinh N event (tasks + projects +
    // kanban...), và M tab đang mở đều nhận → M×N lần refetch full bảng. Với 25
    // user online thì tải nhân bản theo cả 2 chiều → cháy CPU/egress Supabase.
    // Giải pháp: mỗi "job" (1 bảng) chỉ được lên lịch 1 lần; nếu có event mới trong
    // cửa sổ 3s thì job đang chờ gộp thêm rồi CHẠY 1 LẦN duy nhất.
    const COALESCE_MS = 3000;
    const pendingJobs = new Map<string, { timer: any; run: () => void }>();
    const scheduleCoalesced = (key: string, run: () => void) => {
      if (pendingJobs.has(key)) return; // đã có job chờ cho key này → bỏ qua
      const entry = {
        timer: setTimeout(() => {
          pendingJobs.delete(key);
          try { run(); } catch (e) { console.error(`[Realtime] coalesced job ${key} error:`, e); }
        }, COALESCE_MS),
        run,
      };
      pendingJobs.set(key, entry);
    };
    // Cleanup mọi timer còn treo khi effect teardown (resubscribe/unmount)
    const flushPendingJobs = () => {
      pendingJobs.forEach(j => clearTimeout(j.timer));
      pendingJobs.clear();
    };

    // ─── Patch TẠI CHỖ từ payload realtime (không cần refetch full bảng) ────
    // INSERT/UPDATE: payload.new chứa ĐỦ dòng mới → upsert vào state + cache.
    // DELETE: payload.old.id → xóa khỏi state + cache.
    // Trả về true nếu đã vá xong (không cần refetch), false nếu payload thiếu
    // dữ liệu (REPLICA IDENTITY FULL chưa bật cho DELETE...) → caller fallback refetch.
    const patchStateRow = (
      setter: React.Dispatch<React.SetStateAction<any[]>>,
      tableName: string,
      payload: any,
      transform?: (row: any) => any,
    ): boolean => {
      const eventType = payload?.eventType;
      if (!eventType || eventType === '*') return false;
      if (eventType === 'DELETE') {
        const delId = payload?.old?.id;
        if (!delId) return false; // không biết id nào bị xóa → phải refetch
        setter(prev => prev.filter((r: any) => r.id !== delId));
        // Vô hiệu cache để polling/mở tab không trả lại dòng đã xóa.
        try { invalidateCache(tableName); } catch {}
        return true;
      }
      const rawNew = payload?.new;
      if (!rawNew || !rawNew.id) return false;
      const row = transform ? transform(rawNew) : rawNew;
      setter(prev => {
        const idx = prev.findIndex((r: any) => r.id === row.id);
        if (idx >= 0) {
          const copy = [...prev];
          // Merge thay vì ghi đè hoàn toàn: giữ lại các field mà bản ghi
          // realtime KHÔNG mang theo (vd `tasks.missions` — cột cũ không còn
          // được ghi mới, xem dbService.tasks; nếu ghi đè cả object sẽ vô
          // tình xoá/làm cũ missions đang hiển thị đúng mỗi khi có 1 field
          // KHÁC của task đổi ở tab khác). Với các bảng khác, row luôn đủ
          // field nên merge cho kết quả giống hệt ghi đè — an toàn.
          copy[idx] = { ...copy[idx], ...row };
          return copy;
        }
        return [row, ...prev];
      });
      // Vô hiệu cache dbService để lần list() kế tiếp (polling/mở tab) fetch mới,
      // không trả dữ liệu cũ ghi đè mất dòng vừa vá.
      try { invalidateCache(tableName); } catch {}
      return true;
    };

    // Filter loại "Dự án độc lập" dùng chung cho projects (state App không chứa chúng)
    const isStandaloneProject = (p: any) =>
      p && (p.name?.startsWith('Dự án độc lập - ')
        ? !!p.notes?.includes('Tạo dự án tự động từ báo giá hoàn tất')
        : false);

    // ── Full refetch (chạy qua coalescer — tối đa 1 lần / 3s / bảng) ─────────
    const fetchProjects = async () => {
      try {
        invalidateCache('projects');
        const projs = await dbService.projects.list();
        console.log('[Realtime] 📦 projects fetched:', projs.length, 'rows');
        setProjects(projs.filter(p => !isStandaloneProject(p)));
      } catch (e) { console.error('Realtime projects sync error:', e); }
    };
    const fetchTasks = async () => {
      try {
        invalidateCache('tasks');
        const list = await dbService.tasks.list();
        // HƯỚNG B: không để reload cũ ghi đè task vừa được lưu (vd mission vừa hoàn thành).
        applyTasksWithLocalOverrides(list);
      } catch (e) { console.error('Realtime tasks sync error:', e); }
    };
    const fetchPayments = async () => {
      try {
        invalidateCache('payments');
        setPayments(await dbService.payments.list());
      } catch (e) { console.error('Realtime payments sync error:', e); }
    };
    const fetchReceipts = async () => {
      try {
        invalidateCache('receipts');
        setReceipts(await dbService.receipts.list());
      } catch (e) { console.error('Realtime receipts sync error:', e); }
    };
    // task_missions (nhiệm vụ con, bảng riêng — xem dbService.taskMissions):
    // payload mang task_id của dòng vừa đổi → chỉ nạp lại missions của ĐÚNG
    // task đó rồi vá vào state (không refetch toàn bộ bảng tasks). Coalesce
    // theo TỪNG task_id để nhiều thay đổi liên tiếp trên các task khác nhau
    // trong cùng cửa sổ 3s không bị gộp nhầm/mất id.
    const fireTaskMissionsEvent = (payload?: any) => {
      const taskId = payload?.new?.task_id || payload?.old?.task_id;
      if (!taskId) {
        // Không rõ task nào đổi (vd gọi thủ công, không có payload) → an toàn
        // nhất là refetch lại toàn bộ tasks (đã gồm missions mới, xem dbService.tasks.list()).
        scheduleCoalesced('task_missions:*', () => { fetchTasks(); });
        return;
      }
      scheduleCoalesced(`task_missions:${taskId}`, () => {
        (async () => {
          try {
            invalidateCache('task_missions');
            const missions = await dbService.taskMissions.listByTask(taskId);
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, missions } : t));
          } catch (e) { console.error('Realtime task_missions sync error:', e); }
        })();
      });
    };
    const fireAdvancesEvent = (payload?: any) => {
      console.log('[Realtime] 🔔 subcontractor_advances event:', payload ? { event: payload.eventType } : '(manual)');
      try { window.dispatchEvent(new CustomEvent('hl-subcontractor-advances-updated')); } catch {}
    };
    const fireAttendanceEvent = async (payload?: any) => {
      console.log('[Realtime] 🔔 attendance_records event:', payload ? { event: payload.eventType } : '(manual)');
      try {
        // Ưu tiên: cập nhật TẠI CHỖ bằng dòng thay đổi từ realtime (payload.new / payload.old).
        // KHÔNG tải lại bảng → loại bỏ hoàn toàn bầy đàn tái tải khi 25 user chấm công cùng lúc.
        if (payload && payload.eventType) {
          window.dispatchEvent(new CustomEvent('hl-attendance-realtime', { detail: payload }));
          return;
        }
        // Fallback (chỉ khi gọi manual, không có payload realtime): tải THÁNG HIỆN TẠI.
        invalidateCache('attendance_records');
        const { start, end } = currentMonthRange();
        const attendanceList = await dbService.attendance.listForRange(start, end);
        window.dispatchEvent(new CustomEvent('hl-attendance-updated', { detail: attendanceList }));
      } catch (e) { console.error('Realtime attendance sync error:', e); }
    };
    const fetchQuotes = async () => {
      try { invalidateCache('quotes'); setQuotes(await dbService.quotes.list()); } catch {}
    };
    const fetchCustomers = async () => {
      try { invalidateCache('customers'); setCustomers(await dbService.customers.list()); } catch {}
    };

    // ─── Handlers cho các bảng phụ (fire custom events để component lắng nghe) ──
    // Bọc qua coalescer: burst N event cùng bảng → component con chỉ refetch 1 lần.
    const coalescedEvent = (key: string, eventName: string) => () => {
      scheduleCoalesced(`event:${key}`, () => {
        try { window.dispatchEvent(new CustomEvent(eventName)); } catch {}
      });
    };
    const fireSuppliersEvent = coalescedEvent('suppliers', 'hl-suppliers-updated');
    const fireInventoryEvent = coalescedEvent('inventory', 'hl-inventory-updated');
    const fireWarehouseLogsEvent = coalescedEvent('warehouse_logs', 'hl-warehouse-logs-updated');
    const fireWarehouseDataEvent = coalescedEvent('warehouse_data', 'hl-warehouse-data-updated');
    const fireArchivedQuotesEvent = coalescedEvent('archived_quotes', 'hl-archived-quotes-updated');
    const fireTaskPermissionsEvent = coalescedEvent('hrm_task_permissions', 'hl-task-permissions-updated');
    const fireHrmRoleGroupsEvent = coalescedEvent('hrm_role_groups', 'hl-hrm-role-groups-updated');
    const fireEmployeesEvent = () => {
      scheduleCoalesced('event:employees', async () => {
        try {
          invalidateCache('employees');
          const emps = await dbService.employees.list();
          window.dispatchEvent(new CustomEvent('hl-employees-updated', { detail: { employees: emps } }));
        } catch {}
      });
    };
    const fireConfigEvent = async () => {
      try {
        // CHẶN VÒNG LẶP REALTIME: chỉ setState nếu NỘI DUNG khác hẳn state hiện tại.
        // Không chặn thì event → setState(object mới) → effect save → INSERT →
        // event mới → mọi tab lặp vô hạn (đã gây >100K INSERT business_profile).
        const profile = await dbService.businessProfile.get();
        if (profile) {
          setBusinessInfo(prev => stableStr(prev) === stableStr(profile) ? prev : profile);
        }
        const config = await dbService.shiftConfig.get();
        if (config) {
          setHrmConfig(prev => {
            const next = { ...DEFAULT_SYSTEM_CONFIG, ...config };
            return stableStr(prev) === stableStr(next) ? prev : next;
          });
        }
      } catch {}
    };

    // ─── Handlers cho bảng còn thiếu (HRM, accounting, etc.) ──
    // Nhóm 1: sales_orders / purchase_orders — App sở hữu state → refetch trực tiếp
    // (không dispatch event vì không component nào khác cần; giữ sync live giữa 2 tab).
    const fetchSalesOrders = async () => {
      try {
        setSalesOrders((await dbService.salesOrders.list()).map(normalizeOrderItems));
      } catch (e) { console.error('Realtime sales_orders sync error:', e); }
    };
    const fetchPurchaseOrders = async () => {
      try {
        setPurchaseOrders((await dbService.purchaseOrders.list()).map(normalizeOrderItems));
      } catch (e) { console.error('Realtime purchase_orders sync error:', e); }
    };
    const fireHrmApprovalConfigEvent = coalescedEvent('hrm_approval_config', 'hl-hrm-approval-config-updated');
    const fireHrmLeavesEvent = coalescedEvent('hrm_leaves', 'hl-hrm-leaves-updated');
    const fireHrmPayrollRecordsEvent = coalescedEvent('hrm_payroll_records', 'hl-hrm-payroll-records-updated');
    const fireHrmEmployeeErrorsEvent = coalescedEvent('hrm_employee_errors', 'hl-hrm-employee-errors-updated');
    const fireHrmHolidaysEvent = coalescedEvent('hrm_holidays', 'hl-hrm-holidays-updated');
    const fireHrmTripsEvent = coalescedEvent('hrm_trips', 'hl-hrm-trips-updated');
    const fireHrmTravelExpensesEvent = coalescedEvent('hrm_travel_expenses', 'hl-hrm-travel-expenses-updated');
    const fireHrmPerformanceCriteriaEvent = coalescedEvent('hrm_performance_criteria', 'hl-hrm-performance-criteria-updated');
    const fireHrmSalarySalesEvent = coalescedEvent('hrm_salary_scales', 'hl-hrm-salary-scales-updated');
    const fireKanbanColumnsEvent = coalescedEvent('kanban_columns', 'hl-kanban-columns-updated');
    const fireMaterialProposalsEvent = coalescedEvent('material_proposals', 'hl-material-proposals-updated');
    const firePurchaseOrdersEvent = coalescedEvent('purchase_orders_event', 'hl-purchase-orders-updated');
    const fireProjectPermissionsEvent = coalescedEvent('project_permissions', 'hl-project-permissions-updated');
    const fireAccountingLiabilitiesEvent = coalescedEvent('accounting_liabilities', 'hl-accounting-liabilities-updated');
    const fireAccountingReceivablesEvent = coalescedEvent('accounting_receivables', 'hl-accounting-receivables-updated');
    const fireAccountingSubContractsEvent = coalescedEvent('accounting_sub_contracts', 'hl-accounting-sub-contracts-updated');
    const fireHrmLeaveCoefficientsEvent = coalescedEvent('hrm_leave_coefficients', 'hl-hrm-leave-coefficients-updated');

    // ─── Bọc handler realtime: patch tại chỗ trước, refetch coalesced sau ────
    // Chiến lược 2 lớp cho bảng có state ở App:
    //   Lớp 1 (ngay, 0 request): INSERT/UPDATE/DELETE → vá state từ payload.
    //     UI cập nhật tức thì, không tốn băng thông.
    //   Lớp 2 (coalesced 3s): lên lịch full-refetch để tự sửa sai số (payload
    //     thiếu cột do REPLICA IDENTITY, cache lệch...). Nhiều event cùng bảng
    //     trong 3s chỉ sinh ĐÚNG 1 lần refetch → tải trọng không còn nhân bản.
    const REFETCHERS: Record<string, () => void> = {};
    const scheduleRefetch = (key: string, tableName: string) => {
      scheduleCoalesced(`refetch:${key}`, () => {
        invalidateCache(tableName);
        REFETCHERS[key]?.();
      });
    };
    const withPatchAndCoalesce = (
      key: string,
      tableName: string,
      setter: React.Dispatch<React.SetStateAction<any[]>>,
      transform?: (row: any) => any,
      exclude?: (r: any) => boolean,
    ) => (payload?: any) => {
      if (payload?.eventType && patchStateRow(setter, tableName, payload, transform)) {
        // Đã vá state từ payload. Với projects cần áp thêm bộ lọc loại trừ:
        if (exclude) {
          setter(prev => prev.filter(r => !exclude(r)));
        }
        scheduleRefetch(key, tableName);
        return;
      }
      // Payload không dùng được (manual call / thiếu dữ liệu) → refetch coalesced luôn.
      scheduleRefetch(key, tableName);
    };

    // Đăng ký hàm refetch cho coalescer (các hàm đã định nghĩa phía trên)
    Object.assign(REFETCHERS, {
      projects: fetchProjects,
      tasks: fetchTasks,
      payments: fetchPayments,
      receipts: fetchReceipts,
      quotes: fetchQuotes,
      customers: fetchCustomers,
      sales_orders: fetchSalesOrders,
      purchase_orders: fetchPurchaseOrders,
    });

    console.log('[Realtime] Creating channel...');
    const channel = sb
      .channel('app-realtime-sync-v2')
      // ── Core tables (state setters) ──
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' },
        withPatchAndCoalesce('projects', 'projects', setProjects as any,
          rowToCamel, isStandaloneProject))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' },
        withPatchAndCoalesce('tasks', 'tasks', setTasks as any, (row) => {
          // Cột tasks.missions cũ không còn được ghi mới (đã tách sang bảng
          // task_missions) — LOẠI hẳn key này khỏi bản vá realtime để merge ở
          // patchStateRow() giữ nguyên `.missions` đang đúng trong state hiện
          // tại, không bị đè bằng giá trị cũ/rỗng đóng băng trong cột đó.
          const { missions, ...rest } = rowToCamel(row);
          return rest;
        }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_missions' }, fireTaskMissionsEvent)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' },
        withPatchAndCoalesce('payments', 'payments', setPayments as any, rowToCamel))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'receipts' },
        withPatchAndCoalesce('receipts', 'receipts', setReceipts as any, rowToCamel))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' },
        withPatchAndCoalesce('quotes', 'quotes', setQuotes as any, rowToCamel))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' },
        withPatchAndCoalesce('customers', 'customers', setCustomers as any, rowToCamel))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, fireAttendanceEvent)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subcontractor_advances' }, fireAdvancesEvent)
      // ── Supporting tables (fire events) ──
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, fireInventoryEvent)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warehouse_logs' }, fireWarehouseLogsEvent)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_product_catalog' }, fireWarehouseDataEvent)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_product_catalog' }, fireWarehouseDataEvent)
      // suppliers/accounting_subcontractors/archived_quotes: đã bỏ khỏi realtime
      // — xem POLLED_LOW_CHURN_MS bên dưới.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, fireEmployeesEvent)
      // hrm_task_permissions/hrm_role_groups/business_profile/shift_config: đã
      // bỏ khỏi realtime — xem POLLED_LOW_CHURN_MS bên dưới.
      // ── Orders (critical - realtime for instant updates) ──
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_orders' },
        withPatchAndCoalesce('sales_orders', 'sales_orders', setSalesOrders as any,
          (row) => normalizeOrderItems(rowToCamel(row))))
      // ── HRM Configuration & Payroll ──
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hrm_leaves' }, fireHrmLeavesEvent)
      // hrm_approval_config/hrm_payroll_records/hrm_employee_errors/hrm_trips/
      // hrm_travel_expenses/hrm_leave_coefficients/hrm_holidays/hrm_performance_criteria/
      // hrm_salary_scales/kanban_columns/project_permissions: đã bỏ khỏi realtime
      // — xem POLLED_LOW_CHURN_MS bên dưới.
      // ── Accounting: accounting_liabilities/accounting_receivables/accounting_sub_contracts
      // đã bỏ khỏi realtime — xem POLLED_LOW_CHURN_MS bên dưới.
      // ── Material Proposals (Đề xuất vật tư) ──
      .on('postgres_changes', { event: '*', schema: 'public', table: 'material_proposals' }, fireMaterialProposalsEvent)
      // ── Purchase Orders (đơn hàng mua — dispatch event cho MaterialCoordination sync cross-tab) ──
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, (payload) => {
        withPatchAndCoalesce('purchase_orders', 'purchase_orders', setPurchaseOrders as any,
          (row) => normalizeOrderItems(rowToCamel(row)))(payload);
        firePurchaseOrdersEvent();
      })
      .subscribe((status: string, err: any) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] ✅ Channel ready. Listening for ~14 tables (21 bảng ít đổi chuyển sang polling 5 phút)');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[Realtime] ❌ Connection issue:', status, err);
        } else if (status === 'CLOSED') {
          if (err) console.log('[Realtime] Channel closed:', err.message);
        }
      });

    // ─── Bảng ít thay đổi: làm mới định kỳ thay vì Realtime ──────────────
    // Các bảng này (cấu hình hệ thống/nhân sự/phân quyền + công nợ/danh mục
    // không phải nơi nhiều người cùng thao tác đồng thời) hầu như không đổi
    // trong ngày làm việc bình thường, nhưng vẫn tính phí "Tin nhắn thời
    // gian thực" của Supabase MỖI LẦN đổi × MỖI tab đang mở — với ~25 nhân
    // viên mở app cả ngày, việc giữ Realtime cho các bảng này góp phần lớn
    // vào việc vượt hạn mức 5 triệu tin nhắn/tháng dù bản thân bảng ít đổi.
    // Đổi sang polling mỗi 5 phút: dùng lại ĐÚNG các hàm fire*Event/refetch
    // đã có (cùng logic dispatch event / setState), chỉ khác nơi gọi.
    const POLLED_LOW_CHURN_MS = 5 * 60 * 1000; // 5 phút
    const pollLowChurnTables = () => {
      // Đợt 1 (cấu hình hệ thống/nhân sự/phân quyền)
      fireTaskPermissionsEvent();
      fireHrmRoleGroupsEvent();
      fireConfigEvent();
      fireHrmHolidaysEvent();
      fireHrmPerformanceCriteriaEvent();
      fireHrmSalarySalesEvent();
      fireKanbanColumnsEvent();
      fireProjectPermissionsEvent();
      fireHrmLeaveCoefficientsEvent();
      // Đợt 2 (công nợ/hợp đồng/danh mục — không cần tức thời)
      fireHrmApprovalConfigEvent();
      fireHrmEmployeeErrorsEvent();
      fireHrmTripsEvent();
      fireHrmTravelExpensesEvent();
      fireHrmPayrollRecordsEvent();
      fireAccountingLiabilitiesEvent();
      fireAccountingReceivablesEvent();
      fireAccountingSubContractsEvent();
      fireArchivedQuotesEvent();
      fireSuppliersEvent();
    };
    const lowChurnInterval = setInterval(pollLowChurnTables, POLLED_LOW_CHURN_MS);

    return () => {
      console.log('[Realtime] Cleaning up channel...');
      flushPendingJobs();
      clearInterval(lowChurnInterval);
      sb.removeChannel(channel);
    };
  }, [realtimeRetry]);

  // ─── Tổng hợp Công Tác Phí cho Tổng Quan (panel CTP của tôi) ─────────────
  // Load từ hrm_travel_expenses + lắng nghe sự kiện làm mới (realtime postgres_changes
  // cũng fire 'hl-hrm-travel-expenses-updated' ở fireHrmTravelExpensesEvent).
  useEffect(() => {
    const loadCtpSummary = async () => {
      try {
        const data = await dbService.hrmTravelExpenses.list();
        const seen = new Map<string, any>();
        (data || []).forEach((item: any) => {
          const key = item?.rowId || item?.id;
          if (key) seen.set(key, item);
        });
        setCtpSummary(Array.from(seen.values()));
      } catch (e) {
        console.warn('[TravelExpense][App] Lỗi tải tổng hợp CTP:', e?.message || e);
      }
    };
    loadCtpSummary();
    const handler = () => loadCtpSummary();
    window.addEventListener('hl-hrm-travel-expenses-updated', handler);
    return () => window.removeEventListener('hl-hrm-travel-expenses-updated', handler);
  }, []);

  // ─── Outbox chấm công: đồng bộ TOÀN CỤC (cấp App) ─────────────────────────
  // Quan trọng: logic outbox trước đây nằm trong DashboardOverview → CHỈ chạy khi
  // user đang ở tab Tổng Quan. Nếu user chấm xong rồi tắt app, mở lại ở tab KHÁC
  // (activeTab lưu trong sessionStorage), DashboardOverview không mount → outbox
  // nằm im trong localStorage, lượt chấm chưa lên DB.
  // Đưa sync lên cấp App (luôn mount) → đảm bảo lượt chấm trong outbox được đẩy
  // lên DB mỗi khi app mở, bất kể user đang ở tab nào. Sau khi sync, dispatch
  // 'hl-outbox-synced' để Dashboard (nếu đang mở) cập nhật badge/pending.
  useEffect(() => {
    let cancelled = false;
    let retryTimer: any = null;
    const trySync = async () => {
      if (cancelled) return;
      const pendingBefore = outboxPendingCount();
      if (pendingBefore === 0) return; // không có gì → không tốn request
      const summary = await syncAttendanceOutbox((rec, slot) =>
        dbService.attendance.save(rec, slot)
      );
      if (cancelled) return;
      if (summary.dropped > 0) {
        addToast({
          title: '⚠️ Cần liên hệ Admin',
          message: `${summary.dropped} bản ghi chấm công không thể đồng bộ sau nhiều lần thử. Vui lòng báo Admin.`,
          type: 'error',
          duration: 8000,
        });
      }
      // Báo Dashboard cập nhật badge "chờ đồng bộ" / xóa cờ pending trên dòng.
      window.dispatchEvent(new CustomEvent('hl-outbox-synced', { detail: summary }));
    };
    trySync();
    window.addEventListener('online', trySync);
    const onVis = () => { if (document.visibilityState === 'visible') trySync(); };
    document.addEventListener('visibilitychange', onVis);
    // Thử lại định kỳ (20s) để lượt chấm nằm trong outbox (do lỗi mạng lúc 25 user
    // cùng chấm, hoặc user tắt app rồi mở lại) vẫn được đẩy lên DB.
    retryTimer = setInterval(() => { if (!cancelled) trySync(); }, 20000);
    return () => {
      cancelled = true;
      clearInterval(retryTimer);
      window.removeEventListener('online', trySync);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // ─── Polling Tier 1 (300s): dữ liệu thay đổi vừa phải, fallback cho Realtime ──
  useEffect(() => {
    const poll = async () => {
      // Không invalidateCache ở đây — cache sẽ tự expire khi realtime event invalidate
      try { setQuotes(await dbService.quotes.list()); } catch {}
      try { setCustomers(await dbService.customers.list()); } catch {}
      try {
        const projs = await dbService.projects.list();
        setProjects(projs.filter(p => !p.name.startsWith('Dự án độc lập - ') || !p.notes?.includes('Tạo dự án tự động từ báo giá hoàn tất')));
      } catch {}
      try { setTasks(await dbService.tasks.list()); } catch {}
      try { window.dispatchEvent(new CustomEvent('hl-suppliers-updated')); } catch {}
      try { window.dispatchEvent(new CustomEvent('hl-inventory-updated')); } catch {}
      try { window.dispatchEvent(new CustomEvent('hl-warehouse-logs-updated')); } catch {}
      try { window.dispatchEvent(new CustomEvent('hl-archived-quotes-updated')); } catch {}
      try { window.dispatchEvent(new CustomEvent('hl-task-permissions-updated')); } catch {}
      import('./components/hr/hrTaskPermissions').then(m => m.syncTaskPermissionsFromCloud()).catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 300000);
    return () => clearInterval(interval);
  }, []);

  // ─── Polling Tier 2 (600s): dữ liệu hiếm thay đổi (profile, config, employees, roles) ──
  useEffect(() => {
    const poll = async () => {
      try {
        const profile = await dbService.businessProfile.get();
        if (profile) {
          setBusinessInfo(profile);
        }
      } catch {}
      try {
        const config = await dbService.shiftConfig.get();
        if (config) setHrmConfig(prev => ({ ...DEFAULT_SYSTEM_CONFIG, ...config }));
      } catch {}
      try { setEmployees(await dbService.employees.list()); } catch {}
      try {
        const cloudRoles = await dbService.hrmRoleGroups.list();
        if (cloudRoles && cloudRoles.length > 0) {
          // Luôn merge role_superadmin vào cache
          if (!cloudRoles.some((r: any) => r.id === 'role_superadmin')) {
            cloudRoles.unshift({ id: 'role_superadmin', name: 'Siêu Admin (Super Admin)', memberIds: ['emp_admin', 'NV_ADMIN', 'admin'], permissions: {} });
          }
          setHrmRoleGroups(cloudRoles.map((r: any) => ({ id: r.id, name: r.name })));
          setRoleGroupsCache(cloudRoles);
        }
      } catch {}
      try {
        const cloudApproval = await dbService.hrmApprovalConfig.list();
        if (cloudApproval && cloudApproval.length > 0) {
          setApprovalConfigCache(cloudApproval);
        }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 600000);
    return () => clearInterval(interval);
  }, []);

  // ─── Event: cho phép component khác trigger đồng bộ tasks thủ công ──────
  useEffect(() => {
    const handleTasksRefreshRequest = async () => {
      try {
        const taskList = await dbService.tasks.list();
        // HƯỚNG B: không để reload cũ ghi đè task vừa được lưu.
        applyTasksWithLocalOverrides(taskList);
      } catch (e) { console.error('Tasks refresh error:', e); }
    };
    window.addEventListener('hl-tasks-refresh', handleTasksRefreshRequest);
    // Lắng nghe cả sự kiện từ Supabase Realtime (nếu có)
    window.addEventListener('hl-tasks-updated', handleTasksRefreshRequest);
    return () => {
      window.removeEventListener('hl-tasks-refresh', handleTasksRefreshRequest);
      window.removeEventListener('hl-tasks-updated', handleTasksRefreshRequest);
    };
  }, []);

  // Sync role permissions when updated from HRM
  useEffect(() => {
    const handleRolesUpdated = () => {
      const saved = localStorage.getItem('hl_role_permissions');
      if (saved) {
        try {
          setRolePermissions(JSON.parse(saved));
        } catch (e) {
          console.error(e);
        }
      }
    };
    window.addEventListener('hl-roles-updated', handleRolesUpdated);
    return () => window.removeEventListener('hl-roles-updated', handleRolesUpdated);
  }, []);

  // Sync hrmRoleGroups dropdown when roles are saved/updated from HRM
  useEffect(() => {
    const handleTaskPermUpdated = async () => {
      // Re-fetch từ Supabase thay vì đọc localStorage stale
      try {
        const cloudRoles = await dbService.hrmRoleGroups.list();
        if (cloudRoles && cloudRoles.length > 0) {
          // Luôn merge role_superadmin vào cache (bảo vệ khỏi DB chưa có)
          if (!cloudRoles.some((r: any) => r.id === 'role_superadmin')) {
            cloudRoles.unshift({ id: 'role_superadmin', name: 'Siêu Admin (Super Admin)', memberIds: ['emp_admin', 'NV_ADMIN', 'admin'], permissions: {} });
          }
          setHrmRoleGroups(cloudRoles.map((r: any) => ({ id: r.id, name: r.name })));
          setRoleGroupsCache(cloudRoles);
        }
      } catch {
        // Fallback về localStorage nếu Supabase lỗi
        setHrmRoleGroups(readHrmRoleGroups());
      }
    };
    const handleEmployeesUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        const incoming = customEvent.detail.employees || customEvent.detail;
        // Deduplicate by name: keep entry with username/hasSystemAccount if duplicate exists
        const deduped = incoming.filter((emp: Employee, idx: number, arr: Employee[]) => {
          const firstIdx = arr.findIndex(e => e.name.toLowerCase() === emp.name.toLowerCase());
          if (firstIdx === idx) return true;
          // Duplicate found, keep the one with account (username + hasSystemAccount)
          const first = arr[firstIdx];
          const hasAccount = (emp.username || emp.hasSystemAccount);
          const firstHasAccount = (first.username || first.hasSystemAccount);
          return hasAccount && !firstHasAccount;
        });
        setEmployees(deduped);
      }
    };
    window.addEventListener('hl-task-permissions-updated', handleTaskPermUpdated);
    window.addEventListener('hl-employees-updated', handleEmployeesUpdated);
    return () => {
      window.removeEventListener('hl-task-permissions-updated', handleTaskPermUpdated);
      window.removeEventListener('hl-employees-updated', handleEmployeesUpdated);
    };
  }, []);

  // Đồng hồ góc Trái dưới (Y hệt ảnh mồi)
  const [currentTime, setCurrentTime] = useState<string>('');
  
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // đổi số 0 thành 12
      setCurrentTime(`${hours}:${minutes} ${ampm}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Bộ xử lý Đăng nhập thành công & Ghi nhớ / Tự động đăng nhập
  const handleLoginSuccess = (loggedInUser: Employee, remember: boolean, autoLogin: boolean) => {
    setCurrentUser(loggedInUser);
    
    if (remember) {
      const creds = {
        username: loggedInUser.username || generateUsername(loggedInUser.name)
      };
      localStorage.setItem('hl_erp_remembered_credentials', JSON.stringify(creds));
    } else {
      localStorage.removeItem('hl_erp_remembered_credentials');
    }

    if (autoLogin) {
      localStorage.setItem('hl_erp_active_session', JSON.stringify(stripPassword(loggedInUser)));
    } else {
      localStorage.removeItem('hl_erp_active_session');
    }

    sessionStorage.setItem('hl_erp_active_session', JSON.stringify(stripPassword(loggedInUser)));
    
    addToast({
      title: 'Đăng nhập thành công',
      message: `Chào mừng ${loggedInUser.name} đã quay trở lại làm việc.`,
      type: 'success'
    });
  };

  // Bộ xử lý Đăng xuất
  const handleLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem('hl_erp_active_session');
    localStorage.removeItem('hl_erp_active_session');
    addToast({
      title: 'Đăng xuất thành công',
      message: 'Hẹn gặp lại bạn ở những phiên làm việc tiếp theo.',
      type: 'info'
    });
  };

  // Bộ xử lý cập nhật thông tin hồ sơ cá nhân
  const handleUpdateProfile = async (updatedUser: Employee) => {
    setCurrentUser(updatedUser);

    // Cập nhật trong danh sách cán bộ (UI only)
    setEmployees(prev => prev.map(emp => emp.id === updatedUser.id ? updatedUser : emp));

    // Lưu avatar & mật khẩu lên Supabase
    try {
      await dbService.employees.save(updatedUser);
      addToast({
        title: 'Cập nhật thành công',
        message: 'Hồ sơ cá nhân và mật khẩu của bạn đã được lưu trữ an toàn.',
        type: 'success'
      });
    } catch (err) {
      console.error('Lỗi khi lưu Supabase:', err);
    }
  };

  // HANDLERS DỰ ÁN
  const handleAddProject = async (newProj: Project) => {
    setProjects([newProj, ...projects]);
    try {
      await dbService.projects.save(newProj);
      window.dispatchEvent(new CustomEvent('hl-projects-updated'));
    } catch (err) {
      console.error('Lỗi lưu project lên Supabase:', err);
      addToast({
        title: '⚠️ Lưu dự án thất bại',
        message: `Không thể đồng bộ "${newProj.name}" lên đám mây: ${err.message}`,
        type: 'error'
      });
    }

    // Phát thông báo Toast nổi
    addToast({
      title: '📁 Khởi tạo dự án mới',
      message: `Dự án "${newProj.name}" [Mã số: ${newProj.code}] đã được ghi nhận trên hệ thống thành công!`,
      type: 'success'
    });
  };

  const handleUpdateProjectStatus = async (id: string, status: ProjectStatus, progress: number) => {
    const updated = projects.map(p => {
      if (p.id === id) {
        const isCompleted = (status === 'completed') || (progress === 100);
        return {
          ...p,
          status,
          progress,
          ...(isCompleted ? { kanbanColumnId: 'col_done' } : {})
        };
      }
      return p;
    });
    setProjects(updated);

    // Save to Supabase after state update
    const projectToSave = updated.find(p => p.id === id);
    if (projectToSave) {
      try { await dbService.projects.save(projectToSave); } catch (err) {
        console.error("Lỗi lưu trạng thái dự án:", err);
      }
    }
  };

  const handleUpdateProject = (id: string, updates: Partial<Project>): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      setProjects(prevProjects => {
        const updated = prevProjects.map(p => {
          if (p.id === id) {
            const finalStatus = updates.status !== undefined ? updates.status : p.status;
            const finalProgress = updates.progress !== undefined ? updates.progress : p.progress;
            const isCompleted = (finalStatus === 'completed') || (finalProgress === 100);
            // Chỉ ép về col_done khi dự án VỪA hoàn thành MÀ chưa nằm ở cột nào
            // (cả trong update lẫn trong dữ liệu hiện tại). Nếu dự án đã có cột
            // (ví dụ cột đã cấu hình "chuyển cột khi hoàn thành"), TUYỆT ĐỐI không
            // ghi đè — nếu không mỗi lần cập nhật/save sẽ kéo thẻ về col_done gây
            // hiện tượng "chạy lung tung", không theo đúng cấu hình.
            const nextp = {
              ...p,
              ...updates,
              ...(isCompleted && !updates.kanbanColumnId && !p.kanbanColumnId ? { kanbanColumnId: 'col_done' } : {})
            };

            // Trigger the Firestore save as a side-effect outside state rendering if possible,
            // but to be safe and compatible, we run it immediately on the constructed nextp
            setTimeout(() => {
              dbService.projects.save(nextp).then(() => {
                window.dispatchEvent(new CustomEvent('hl-projects-updated'));
                resolve();
              }).catch(err => {
                console.error("Lỗi khi lưu cập nhật dự án:", err);
                reject(err);
              });
            }, 0);

            return nextp;
          }
          return p;
        });
        return updated;
      });
    });
  };

  const handleUpdateMultipleProjects = async (updatedProjectsList: Project[]) => {
    // Find modified projects by comparing with current state
    const modifiedProjects = updatedProjectsList.filter(newProj => {
      const oldProj = projects.find(p => p.id === newProj.id);
      return !oldProj || JSON.stringify(oldProj.documents) !== JSON.stringify(newProj.documents);
    });

    setProjects(updatedProjectsList);

    // Save only modified ones to Supabase
    for (const proj of modifiedProjects) {
      await dbService.projects.save(proj).catch(err => {
        console.error("Lỗi khi lưu cập nhật hàng loạt dự án:", err);
      });
    }
  };

  /**
   * XÓA DỰ ÁN — cuốn sạch mọi dữ liệu phát sinh trên Supabase.
   *
   * Toàn bộ việc dọn database do dbService.projects.deleteCascade() lo:
   * Công Việc, Nhiệm Vụ, Nhóm chat + tin nhắn, Ghi nhận vi phạm, Công tác phí,
   * Báo giá, Hợp Đồng, Nghiệm Thu, Thanh Lý, HĐ Thầu, Công Nợ, Đề Xuất,
   * Phiếu Thu, Phiếu Chi... Ở đây chỉ đồng bộ lại state và báo kết quả.
   */
  const handleDeleteProject = async (id: string) => {
    const projectName = projects.find(p => p.id === id)?.name || id;

    // 1. Gỡ khỏi giao diện ngay (optimistic) để thao tác thấy tức thì
    setProjects(prevProjects => prevProjects.filter(p => p.id !== id));
    setTasks(prevTasks => prevTasks.filter(t => t.projectId !== id));

    try {
      // 2. Dọn sạch database — con trước, cha sau
      const report = await dbService.projects.deleteCascade(id);

      // 3. Báo cho mọi màn hình đang mở tự làm mới danh sách
      [
        'hl-projects-updated',
        'hl-tasks-updated',
        'hl-archived-quotes-updated',
        'hl-subcontractor-advances-updated',
        'hl-accounting-receivables-updated',
        'hl-conversations-updated',
      ].forEach(evt => window.dispatchEvent(new CustomEvent(evt)));

      addToast({
        title: '🗑️ Đã xóa dự án',
        message: report.total > 0
          ? `Dự án "${projectName}" và ${report.total} bản ghi liên quan đã bị xóa vĩnh viễn.`
          : `Dự án "${projectName}" đã bị xóa vĩnh viễn.`,
        type: 'success'
      });
    } catch (err) {
      console.error('Lỗi khi xóa dự án:', err);
      addToast({
        title: '❌ Xóa dự án thất bại',
        message: `Không thể xóa "${projectName}": ${err instanceof Error ? err.message : String(err)}. Danh sách sẽ được tải lại.`,
        type: 'error'
      });
      // Khôi phục state từ server để giao diện không lệch với database
      try {
        const [freshProjects, freshTasks] = await Promise.all([
          dbService.projects.list(),
          dbService.tasks.list(),
        ]);
        setProjects(freshProjects);
        setTasks(freshTasks);
      } catch (reloadErr) {
        console.error('Không tải lại được dữ liệu sau khi xóa dự án thất bại:', reloadErr);
      }
    }
  };

  // HANDLERS CÔNG VIỆC
  const handleAddTask = async (newTask: Task): Promise<void> => {
    setTasks(prev => [newTask, ...prev]);
    await dbService.tasks.save(newTask);
    // Task mới có thể kèm sẵn missions (vd sub-task tự động sinh từ mẫu ở
    // ProjectKanbanBoard) — tasks.save() không còn ghi cột missions cũ nữa,
    // nên phải lưu riêng từng mission sang bảng task_missions. An toàn vì
    // task_id vừa tạo chưa có dòng nào tồn tại (không có gì để ghi đè).
    if (newTask.missions && newTask.missions.length > 0) {
      await Promise.all(newTask.missions.map(m => dbService.taskMissions.save(newTask.id, m)));
    }
    window.dispatchEvent(new CustomEvent('hl-tasks-updated'));
  };

  // Hàng đợi lưu công việc theo TỪNG task id — chống mất dữ liệu khi 2 lệnh cập
  // nhật cùng 1 task (VD: 2 nhiệm vụ trong "missions" được xác nhận liên tiếp
  // thật nhanh) chạy gần như đồng thời. Vì "missions" được lưu là 1 mảng jsonb
  // duy nhất (ghi đè toàn bộ khi save), nếu lệnh thứ 2 tính toán dựa trên
  // `tasksRef.current` CHƯA kịp cập nhật bởi lệnh thứ 1 (tasksRef chỉ đồng bộ
  // lại vào lần re-render kế tiếp, không đồng bộ ngay khi setState được gọi),
  // nó sẽ ghi đè mất thay đổi của lệnh thứ 1. Xếp hàng theo id đảm bảo lệnh
  // sau luôn đọc bản đã-được-lệnh-trước cập nhật.
  const taskUpdateQueues = useRef(new Map<string, Promise<boolean>>());

  const handleUpdateTask = (id: string, updates: Partial<Task>): Promise<boolean> => {
    const prevInQueue = taskUpdateQueues.current.get(id) || Promise.resolve(true);
    const queued = prevInQueue.then(() => performUpdateTask(id, updates));
    taskUpdateQueues.current.set(id, queued);
    queued.finally(() => {
      // Chỉ xóa khỏi hàng đợi nếu không có lệnh mới nào được thêm vào sau đó.
      if (taskUpdateQueues.current.get(id) === queued) {
        taskUpdateQueues.current.delete(id);
      }
    });
    return queued;
  };

  // So sánh missions CŨ (mà client này biết) với missions MỚI trong `updates`,
  // rồi chỉ upsert/xóa đúng những mission THỰC SỰ thay đổi ở bảng task_missions
  // riêng — không ghi lại nguyên mảng. Đây là điểm mấu chốt chống mất dữ liệu
  // khi nhiều người sửa các mission khác nhau của cùng 1 task gần như đồng
  // thời: mission nào không đổi so với bản mà client này biết thì KHÔNG bao
  // giờ bị ghi đè, dù client đó không hay biết mission khác đã bị người khác
  // sửa ở giữa chừng.
  const syncMissionsDiff = (taskId: string, oldMissions: any[] | undefined, newMissions: any[] | undefined): Promise<any> => {
    if (newMissions === undefined) return Promise.resolve();
    const oldById = new Map((oldMissions || []).map((m: any) => [m.id, m]));
    const newIds = new Set((newMissions || []).map((m: any) => m.id));
    const toSave = (newMissions || []).filter((m: any) => {
      const old = oldById.get(m.id);
      return !old || stableStr(old) !== stableStr(m);
    });
    const toDelete = (oldMissions || []).filter((m: any) => !newIds.has(m.id)).map((m: any) => m.id);
    return Promise.all([
      ...toSave.map((m: any) => dbService.taskMissions.save(taskId, m)),
      ...toDelete.map((mid: string) => dbService.taskMissions.delete(taskId, mid))
    ]);
  };

  const performUpdateTask = (id: string, updates: Partial<Task>): Promise<boolean> => {
    // Tìm task từ state hiện tại (ref) — không chạy side-effect bên trong updater.
    const oldTask = tasksRef.current.find(t => t.id === id);
    const baseTask = oldTask;
    const changedTask: Task = baseTask
      ? { ...baseTask, ...updates }
      : { id, ...(updates as Task) };

    // ── Side-effect thông báo (tin nhắn, trạng thái, tiến độ, toast) ────────
    // Được chạy sau khi đã xác định task gốc (nếu có trong state) để tránh bắn
    // thông báo cho dữ liệu chưa được server xác nhận.
    const runTaskNotifications = (oldT: Task | undefined, newT: Task) => {
      if (!oldT) return;

      // ── Lõi Thông báo hệ thống ĐÃ BỊ XÓA ──
      // Các nhắc comment/trạng thái/tiến độ cũ tạo bản ghi `notifications` đã
      // được loại bỏ (xem plan phần D). Hội thoại công việc & luồng duyệt giờ
      // đi qua chat (chatStore.addMessage). Giữ lại duy nhất toast hoàn thành.

      // PHÁT HIỆN HOÀN THÀNH CÔNG VIỆC → BẮN TOAST NỔI
      const wasCompleted = oldT.status === 'completed' || oldT.completionRate === 100;
      const isNowCompleted = newT.status === 'completed' || newT.completionRate === 100;
      if (!wasCompleted && isNowCompleted) {
        addToast({
          title: '✅ Hoàn thành công việc',
          message: `Công việc "${newT.name}" đã cán đích và hoàn thành xuất sắc!`,
          type: 'success'
        });
      }
    };

    // Optimistic cập nhật state — nhưng nếu task chưa có trong state thì không
    // tự chèn (tránh giả lập dữ liệu chưa được server xác nhận).
    if (baseTask) {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    }

    // Ghi nhận thời điểm save để các nguồn reload không ghi đè bản mới (Hướng B).
    recentTaskSaves.current.set(id, Date.now());

    // Nếu task đã có trong state → save trực tiếp lên Supabase và trả về kết quả.
    if (baseTask) {
      return Promise.all([
        dbService.tasks.save(changedTask),
        syncMissionsDiff(id, baseTask.missions, updates.missions)
      ]).then(() => {
        runTaskNotifications(baseTask, changedTask);
        window.dispatchEvent(new CustomEvent('hl-tasks-updated'));
        return true;
      }).catch(err => {
        console.error("Lỗi khi cập nhật công việc:", err);
        // Save thất bại → bỏ marker chống-ghi-đè và hoàn nguyên UI về bản trước.
        recentTaskSaves.current.delete(id);
        setTasks(prev => prev.map(t => t.id === id ? baseTask : t));
        return false;
      });
    }

    // HƯỚNG A: task không còn trong state (bị reload thay thế) → lấy bản mới từ
    // server, merge updates, save. Không im lặng bỏ qua như trước.
    return dbService.tasks.list().then(serverTasks => {
      const serverTask = serverTasks.find(t => t.id === id);
      const target = serverTask ? { ...serverTask, ...updates } : changedTask;
      return Promise.all([
        dbService.tasks.save(target),
        syncMissionsDiff(id, serverTask?.missions, updates.missions)
      ]).then(() => {
        runTaskNotifications(serverTask, target);
        window.dispatchEvent(new CustomEvent('hl-tasks-updated'));
        // Cập nhật state với bản đã save — giữ bản này làm bản gốc.
        recentTaskSaves.current.delete(id);
        setTasks(prev => {
          const has = prev.some(t => t.id === id);
          if (has) return prev.map(t => t.id === id ? target : t);
          return [...prev, target];
        });
        return true;
      }).catch(err => {
        console.error("Lỗi khi cập nhật công việc (không có trong state):", err);
        // Save thất bại → bỏ marker chống-ghi-đè để reload không giữ bản local sai.
        recentTaskSaves.current.delete(id);
        return false;
      });
    }).catch(err => {
      console.error("Lỗi khi tải công việc để cập nhật:", err);
      return false;
    });
  };

  const handleDeleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    dbService.tasks.delete(id).then(() => {
      window.dispatchEvent(new CustomEvent('hl-tasks-updated'));
    }).catch(err => {
      console.error("Lỗi khi xóa công việc:", err);
    });

    // Auto-delete associated task chat group
    try {
      deleteConversation(`conv_task_${id}`);
    } catch (e) { console.error('Auto-delete chat group failed:', e); }
  };

  const handleDeleteMultipleTasks = (ids: string[]) => {
    setTasks(prev => prev.filter(t => !ids.includes(t.id)));
    dbService.tasks.deleteMultiple(ids).then(() => {
      window.dispatchEvent(new CustomEvent('hl-tasks-updated'));
    }).catch(err => {
      console.error("Lỗi khi dọn dẹp các công việc:", err);
    });

    // Auto-delete associated task chat groups
    try {
      ids.forEach(id => deleteConversation(`conv_task_${id}`));
    } catch (e) { console.error('Auto-delete chat groups failed:', e); }
  };

  // HANDLERS TÀI CHÍNH
  const handleAddReceipt = async (newRec: Receipt) => {
    setReceipts(prev => [newRec, ...prev]);
    try {
      await dbService.receipts.save(newRec);
    } catch (err) {
      console.error('[App] Lỗi lưu phiếu thu lên Supabase:', err);
      addToast({ title: '❌ Lỗi lưu', message: `Không thể lưu phiếu thu ${newRec.code} lên server.`, type: 'error' });
    }

    // Nếu có dự án kết nối, tăng nhẹ tiến trình ngẫu nhiên
    if (newRec.projectId) {
      setProjects(prev => prev.map(p => {
        if (p.id === newRec.projectId) {
          const nextp = { ...p, progress: Math.min(p.progress + 5, 100) };
          dbService.projects.save(nextp).catch(e => console.error('[App] Lỗi lưu tiến trình project:', e));
          return nextp;
        }
        return p;
      }));
    }
  };

  // HANDLERS ĐƠN HÀNG BÁN
  /**
   * Lưu đơn hàng bán MỚI. Dùng create() (insert) thay vì save() (upsert) để
   * đơn mới không bao giờ ghi đè đơn cũ khi mã bị trùng — tầng DB sẽ tự cấp
   * lại mã. Trả về đơn đã lưu (id có thể khác mã dự kiến), hoặc null nếu lỗi.
   */
  const handleAddSalesOrder = async (order: SalesOrder): Promise<SalesOrder | null> => {
    try {
      const saved = await dbService.salesOrders.create(order) as SalesOrder;
      setSalesOrders(prev => [saved, ...prev]);
      return saved;
    } catch (err) {
      console.error('[App] Lỗi lưu đơn hàng bán lên Supabase:', err);
      addToast({ title: '❌ Lỗi lưu', message: `Không thể lưu đơn hàng ${order.id} lên server.`, type: 'error' });
      return null;
    }
  };

  const handleDeleteSalesOrder = async (id: string) => {
    setSalesOrders(prev => prev.filter(o => o.id !== id));
    try {
      await dbService.salesOrders.delete(id);
    } catch (err) {
      console.error('[App] Lỗi xóa đơn hàng bán trên Supabase:', err);
    }
  };

  // HANDLERS ĐƠN MUA HÀNG
  /** Xem chú thích ở handleAddSalesOrder — cùng cơ chế chống ghi đè. */
  const handleAddPurchaseOrder = async (order: PurchaseOrder): Promise<PurchaseOrder | null> => {
    console.log('[App] Tạo đơn mua hàng:', order.id);
    try {
      const saved = await dbService.purchaseOrders.create(order) as PurchaseOrder;
      console.log('[App] Lưu đơn mua hàng thành công:', saved.id);
      setPurchaseOrders(prev => [saved, ...prev]);
      return saved;
    } catch (err) {
      console.error('[App] Lỗi lưu đơn mua hàng lên Supabase:', err);
      addToast({ title: '❌ Lỗi lưu', message: `Không thể lưu đơn mua ${order.id} lên server. Dữ liệu chỉ tạm thời trên trình duyệt.`, type: 'error' });
      return null;
    }
  };

  const handleDeletePurchaseOrder = async (id: string) => {
    setPurchaseOrders(prev => prev.filter(o => o.id !== id));
    try {
      await dbService.purchaseOrders.delete(id);
    } catch (err) {
      console.error('[App] Lỗi xóa đơn mua hàng trên Supabase:', err);
    }
  };

  const handleAddCustomer = (newCust: Customer) => {
    const exists = customers.some(c => c.id === newCust.id);
    if (exists) {
      setCustomers(customers.map(c => c.id === newCust.id ? newCust : c));
    } else {
      setCustomers([newCust, ...customers]);
    }
    dbService.customers.save(newCust);
  };

  const handleDeleteCustomer = (id: string) => {
    setCustomers(customers.filter(c => c.id !== id));
    dbService.customers.delete(id);
  };

  const handleAddPayment = async (newPay: Payment) => {
    setPayments([newPay, ...payments]);
    try {
      await dbService.payments.save(newPay);
    } catch (err) {
      console.error('[App] Lỗi lưu phiếu chi lên Supabase:', err);
      addToast({ title: '❌ Lỗi lưu', message: `Không thể lưu phiếu chi ${newPay.code} lên server.`, type: 'error' });
    }
    // Đồng bộ Công nợ Trả thầu phụ (menu Quản Lý Thầu Phụ) khi có phiếu chi mới
    window.dispatchEvent(new CustomEvent('hl-payments-updated'));
  };

  const handleDeleteReceipt = async (id: string) => {
    setReceipts(prev => prev.filter(r => r.id !== id));
    try {
      await dbService.receipts.delete(id);
    } catch (err) {
      console.error('[App] Lỗi xóa phiếu thu trên Supabase:', err);
    }
    // Thông báo FinanceManagement dọn dẹp Công Nợ Thu tự động mồ côi
    window.dispatchEvent(new CustomEvent('hl-receipt-deleted'));
  };

  const handleDeletePayment = async (id: string) => {
    setPayments(prev => prev.filter(p => p.id !== id));
    try {
      await dbService.payments.delete(id);
    } catch (err) {
      console.error('[App] Lỗi xóa phiếu chi trên Supabase:', err);
    }
  };

  const handleUpdateReceipt = async (updated: Receipt) => {
    setReceipts(prev => prev.map(r => r.id === updated.id ? updated : r));
    try {
      await dbService.receipts.save(updated);
    } catch (err) {
      console.error('[App] Lỗi cập nhật phiếu thu trên Supabase:', err);
    }
  };

  const handleUpdatePayment = async (updated: Payment) => {
    setPayments(prev => prev.map(p => p.id === updated.id ? updated : p));
    try {
      await dbService.payments.save(updated);
      window.dispatchEvent(new CustomEvent('hl-payments-updated'));
    } catch (err) {
      console.error('[App] Lỗi cập nhật phiếu chi trên Supabase:', err);
    }
  };

  const handleApprovePayment = async (id: string, status: 'approved' | 'rejected') => {
    const targetPayment = payments.find(p => p.id === id);
    const updated = payments.map(p => p.id === id ? { ...p, status } : p);
    setPayments(updated);

    if (targetPayment) {
      dbService.payments.save({ ...targetPayment, status });

      // 📩 Gửi tin nhắn xét duyệt vào HỘI THOẠI CÁ NHÂN giữa người duyệt và người đề xuất
      const proposerEmployee = findEmployeeByName(employees, targetPayment.proposer);
      if (currentUser && proposerEmployee && currentUser.id !== proposerEmployee.id) {
        sendApprovalDirectMessage({
          senderId: currentUser.id,
          senderName: currentUser.name,
          senderRole: currentUser.role,
          recipientId: proposerEmployee.id,
          recipientName: proposerEmployee.name || targetPayment.proposer,
          content: status === 'approved'
            ? `✅ Đã duyệt phiếu chi ${targetPayment.code} (${targetPayment.recipient}) ${targetPayment.amount.toLocaleString('vi-VN')}đ.`
            : `❌ Đã từ chối phiếu chi ${targetPayment.code} (${targetPayment.recipient}) ${targetPayment.amount.toLocaleString('vi-VN')}đ.`,
          relatedEntity: { type: 'payment', id: targetPayment.id },
        });
      }

      // 💳 Giảm công nợ đơn hàng & Công nợ Trả khi phiếu chi thanh toán đơn hàng được duyệt
      if (status === 'approved' && targetPayment.purchaseOrderId) {
        const order = purchaseOrders.find(o => o.id === targetPayment.purchaseOrderId);
        if (order) {
          const newPaid = (order.thanhToanThucTe || 0) + (targetPayment.amount || 0);
          const newCongNo = Math.max(0, (order.tongTien || 0) - newPaid);
          const updatedOrder: any = {
            ...order,
            thanhToanThucTe: newPaid,
            congNo: newCongNo,
            status: newCongNo <= 0 ? 'completed' : (order.status || 'confirmed'),
          };
          setPurchaseOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
          try {
            await dbService.purchaseOrders.save(updatedOrder);
          } catch (err) {
            console.error('[App] Lỗi cập nhật công nợ đơn hàng:', err);
          }
          // Giảm Công nợ Trả (accounting_liabilities) theo nhà cung cấp
          try {
            const liabs: any[] = await dbService.accountingLiabilities.list();
            const liab = liabs.find((l: any) => l.category === 'Nhà Cung Cấp' && l.name === order.supplierName);
            if (liab) {
              const newPaidL = (liab.paid || 0) + (targetPayment.amount || 0);
              const updatedLiab = { ...liab, paid: newPaidL, remaining: (liab.value || 0) - newPaidL };
              await dbService.accountingLiabilities.save(updatedLiab);
              window.dispatchEvent(new CustomEvent('hl-accounting-liabilities-updated'));
            }
          } catch (err) {
            console.error('[App] Lỗi cập nhật công nợ phải trả:', err);
          }
        }
      }
    }
    // Đồng bộ Công nợ Trả thầu phụ (menu Quản Lý Thầu Phụ) khi phiếu chi đổi trạng thái
    window.dispatchEvent(new CustomEvent('hl-payments-updated'));
  };

  // HANDLERS BÁO GIÁ
  const handleRedirectToQuote = (projectId: string) => {
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return;
    
    setPreselectedProjectId(proj.id);
    setPreselectedCustomerId(proj.customerId || '');
    
    // Choose active tab corresponding to the project type
    let tabKey = 'quotes';
    if (proj.type === 'construction') {
      tabKey = 'quotes-construction';
    } else if (proj.type === 'mechanical') {
      tabKey = 'quotes-mechanical';
    }
    setActiveTab(tabKey);
  };

  const handleRedirectToSubcontractor = (projectId: string, subcontractorId: string, workName: string) => {
    // ── THỐNG NHẤT CƠ CHẾ LƯU & XEM HĐ THẦU PHỤ ──
    // NGUYÊN TẮC: HĐ Thầu Phụ chỉ lưu duy nhất tại SubcontractorArchive (archivedSubcontractorQuotes).
    //   - Đã có HĐ (hl_view_contract_id được caller set trước) → redirect tới tab "Quản Lý Thầu Phụ" → mở modal xem HĐ (giao diện Đường 2)
    //   - Chưa có HĐ → redirect tới tab "Lập HĐ Thầu Phụ" → mở form tạo mới với dữ liệu tự điền sẵn
    const proj = projects.find(p => p.id === projectId);
    if (proj) {
      setPreselectedProjectId(proj.id);
      setPreselectedCustomerId(proj.customerId || '');
    }

    localStorage.setItem('hl_preselected_subcontractor_id', subcontractorId);
    localStorage.setItem('hl_preselected_work_name', workName);

    // Xác định tab đích dựa trên localStorage đã được caller (TaskDetailModal/Kanban) set
    const viewContractId = localStorage.getItem('hl_view_contract_id');
    const hasPreselectedTask = localStorage.getItem('hl_preselected_task_id');

    if (viewContractId && !hasPreselectedTask) {
      // Đã có HĐ → mở Lưu Trữ để xem (SubcontractorManagement sẽ truyền xuống SubcontractorArchive)
      setActiveTab('subcontractor-management');
    } else {
      // Chưa có HĐ hoặc đang tạo mới → mở form Lập HĐ mới
      setActiveTab('quotes-subcontractor');
    }
  };

  const handleAddQuote = (newQuote: Quote) => {
    let updatedCustomers = [...customers];
    
    // Tự động sinh khách hàng mới nếu đây là báo giá độc lập và thông tin chưa tồn tại
    if (newQuote.customerId && !customers.some(c => c.id === newQuote.customerId) && newQuote.customerName) {
      const newCust: Customer = {
        id: newQuote.customerId,
        name: newQuote.customerName,
        phone: newQuote.customerPhone || '',
        address: newQuote.customerAddress || '',
        email: '',
        type: 'individual'
      };
      updatedCustomers = [...customers, newCust];
      setCustomers(updatedCustomers);
      dbService.customers.save(newCust);
    }

    setQuotes([newQuote, ...quotes]);
    dbService.quotes.save(newQuote);

    // Đồng bộ vào bảng archived_quotes (Lưu trữ hồ sơ) để Menu Hồ Sơ Dự Án đọc trạng thái theo dự án.
    // (Đảm bảo hồ sơ luôn tồn tại với projectId + sector dù luồng lưu ở estimator có sai khác)
    try {
      const aqSector = newQuote.code?.startsWith('BGXD-') ? 'construction'
        : newQuote.code?.startsWith('BGME-') ? 'mechanical' : 'furniture';
      dbService.archivedQuotes.save({ ...newQuote, sector: aqSector })
        .catch((e: any) => console.warn('Lưu archived_quotes thất bại:', e));
    } catch (e) {
      console.warn('Lưu archived_quotes thất bại:', e);
    }

    // Tự sinh dự án tương ứng và trả file/hồ sơ về dự án
    if (newQuote.projectId) {
      const updatedProjs = projects.map(p => {
        if (p.id === newQuote.projectId) {
          const totalAmount = (newQuote.items || []).reduce((sum, item) => sum + item.totalPrice, 0);
          
          // Xác định lĩnh vực dựa trên mã code báo giá hoặc tiền tố
          const isConstruction = newQuote.code.startsWith('BGXD-');
          const isMechanical = newQuote.code.startsWith('BGME-');
          const sectorStr = isConstruction ? 'Xây Dựng Thô' : isMechanical ? 'Cơ Khí Hàn' : 'Nội Thất Gỗ';
          const templateName = isConstruction 
            ? 'Mẫu dự toán thô kết cấu Hoàng Long' 
            : isMechanical 
            ? 'Mẫu báo giá gia công Cơ khí Thép bản' 
            : 'Mẫu báo giá mộc nội thất Cabinet';

          const newDoc: ProjectDoc = {
            id: `doc_${Date.now()}`,
            type: 'quotation',
            name: `Hồ sơ báo giá thầu ${sectorStr} [Tự động lưu từ Cabinet]`,
            code: newQuote.code,
            createdAt: newQuote.date,
            status: 'approved', // Cho duyệt tự động để đưa thẳng vào hợp đồng
            value: totalAmount,
            templateName,
            customFields: (newQuote.items || []).map(item => ({
              label: item.productName,
              value: item.notes || 'Chi tiết dòng sản phẩm ước lượng'
            }))
          };

          const nextp = {
            ...p,
            contractValue: totalAmount, // Cập nhật trị giá hợp đồng dự án bằng báo giá thực tế
            documents: [...(p.documents || []), newDoc]
          };
          dbService.projects.save(nextp);
          return nextp;
        }
        return p;
      });
      setProjects(updatedProjs);
    }
  };

  const handleUpdateQuoteStatus = (quoteId: string, status: 'approved' | 'rejected' | 'sent' | 'draft') => {
    const updated = quotes.map(q => {
      if (q.id === quoteId) {
        const nextq = { ...q, status };
        dbService.quotes.save(nextq).catch(err => console.error("Lỗi lưu trạng thái báo giá:", err));
        return nextq;
      }
      return q;
    });
    setQuotes(updated);
    // Lõi Thông báo hệ thống đã bị xóa (phần D) — không còn gửi notification
    // khi cập nhật trạng thái báo giá nữa.
  };

  // Ánh xạ parent-child cho sidebar: nếu có quyền cha → tự động có quyền con
  // (dùng dấu gạch ngang vì getAllowedTabsFromRoleGroups đã convert _ → -)
  const parentChildrenMap: Record<string, string[]> = {
    'project-office': ['projects-construction', 'projects-furniture', 'projects-mechanical'],
    'hr-office': ['employees', 'hr-data'],
    'accounting-office': ['finance', 'finance-data'],
    'warehouse-office': ['material-coordination', 'warehouse-suppliers', 'warehouse-management', 'warehouse-data'],
    'subcontractor-office': ['subcontractor-management'],
    'library-office': ['quotes-construction', 'quotes', 'quotes-mechanical', 'quotes-subcontractor'],
    'system-office': ['settings-accounts', 'settings-roles', 'settings', 'display-settings'],
    'director-office': ['director-dashboard'],
  };

  // Ánh xạ ngược: con → cha
  const childParentMap: Record<string, string> = {};
  for (const [parent, children] of Object.entries(parentChildrenMap)) {
    children.forEach(child => { childParentMap[child] = parent; });
  }

  const isAccessible = (tab: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.username === 'admin') return true;
    // Super admin bypass — query trực tiếp Supabase DB (không dùng localStorage)
    if (isSuperAdmin) return true;

    // ── Nguồn sự thật chính: HRM Role Groups (hl_cached_hrm_role_groups / hl_hrm_roles_v2) ──
    const isAdminGroup = isUserInRoleGroup(currentUser.id, 'role_admin');

    const allowedFromGroups = getAllowedTabsFromRoleGroups(currentUser);

    // Fallback: dùng legacy role field nếu Role Groups chưa có cấu hình
    let allowedSet = new Set(allowedFromGroups);
    if (!allowedFromGroups || allowedFromGroups.length === 0) {
      const role = currentUser.role;
      const legacy = role ? rolePermissions[role] : undefined;
      if (legacy && legacy.length > 0) {
        legacy.forEach(t => allowedSet.add(t));
      }
    }

    // Các tab lõi (core) luôn hiển thị với mọi người dùng đã đăng nhập
    const coreTabs = ['dashboard', 'tasks', 'messages'];
    coreTabs.forEach(t => allowedSet.add(t));

    // ─── Logic kế thừa parent → child ───────────────────────────────────
    // Nếu có quyền cha → tự động thêm tất cả quyền con
    for (const [parent, children] of Object.entries(parentChildrenMap)) {
      if (allowedSet.has(parent)) {
        children.forEach(child => allowedSet.add(child));
      }
    }
    // Nếu có quyền con → tự động thêm quyền cha (để sidebar hiển thị nhóm cha)
    for (const childStr of Array.from(allowedSet)) {
      const parentStr = childParentMap[childStr];
      if (parentStr) {
        allowedSet.add(parentStr);
      }
    }

    // Fail-safe: nếu chưa cấu hình → không có quyền (ẩn menu)
    if (allowedSet.size === 0) return false;

    // Giám đốc luôn giữ quyền Cài đặt hệ thống để không tự khóa mình ra ngoài
    if (isAdminGroup && (tab === 'settings' || tab === 'settings-accounts' || tab === 'settings-roles' || tab === 'display-settings')) return true;

    // Các tab thuộc phòng giám đốc chỉ có Giám đốc được xem
    if (tab.startsWith('director-') && tab !== 'director-office' && tab !== 'director-dashboard') {
      return isAdminGroup;
    }

    return allowedSet.has(tab);
  };

  // Tự động điều hướng về 'dashboard' nếu tab hiện tại không có quyền truy cập
  useEffect(() => {
    if (!isAccessible(activeTab)) {
      setActiveTab('dashboard');
    }
  }, [currentUser, activeTab, rolePermissions]);

  // Badge "Việc của tôi" = TỔNG badge của 3 tab trong trang Công việc (đồng bộ với
  // TaskManagement): (1) Công việc được giao, (2) Nhiệm vụ được giao, (3) Công việc phải duyệt.
  const myUncompletedCount = (() => {
    if (!currentUser) return 0;

    // 1. Công việc được giao chưa hoàn thành (bao gồm cả việc có nhiệm vụ user là Phụ trách chính)
    const assignedUncompletedCount = tasks.filter(t => {
      const hasMainAssigneeMission = t.missions?.some(m => m.mainAssigneeId === currentUser.id);
      const isAssignee = t.assigneeId === currentUser.id || t.assigneeId === currentUser.name || hasMainAssigneeMission;
      return isAssignee && t.status !== 'completed';
    }).length;

    // 2. Nhiệm vụ được giao chưa hoàn thành (user là Phụ trách chính / Nhân sự tham gia)
    const relatedUncompletedCount = tasks.reduce((count, task) =>
      count + (task.missions || []).filter(m =>
        m.status !== 'completed' &&
        (m.mainAssigneeId === currentUser.id || (m.memberIds || []).includes(currentUser.id))
      ).length
    , 0);

    // 3. Công việc phải duyệt chưa hoàn thành (kèm đơn nghỉ phép & thu chi đang chờ duyệt)
    const toReviewTasksCount = tasks.filter(t =>
      t.status === 'reviewing' &&
      (t.assignerId === currentUser.id ||
       t.assignerId === currentUser.name ||
       t.approvals?.some(ap => ap.approverId === currentUser.id || ap.approverId === currentUser.name))
    ).length;
    // Đơn nghỉ phép chờ duyệt mà user hiện tại là NGƯỜI ĐƯỢC CHỈ ĐỊNH xét duyệt
    // (đồng bộ với TaskManagement myPendingLeaves: lọc theo ID lẫn tên, kể cả chuỗi duyệt approvals)
    const myPendingLeaves = leaves.filter(l =>
      l.status === 'pending' &&
      (l.approverId === currentUser.id ||
       l.approverName === currentUser.name ||
       l.approvals?.some(ap => ap.approverId === currentUser.id || ap.approverId === currentUser.name))
    );
    // Đề xuất tài chính chờ duyệt (đồng bộ TaskManagement myPendingPayments/myPendingAdvances):
    // chỉ định làm người duyệt, hoặc thuộc nhóm Kế toán / Giám đốc → xem toàn bộ.
    const isFinanceApprover = isUserInRoleGroup(currentUser.id, 'role_accounting') || isUserInRoleGroup(currentUser.id, 'role_admin');
    const myPendingPayments = payments.filter(p =>
      p.status === 'pending' &&
      (isFinanceApprover ||
       p.proposer === currentUser.name ||
       p.recipient === currentUser.name ||
       p.approver === currentUser.name ||
       (p.approver && p.approver.toLowerCase().includes(currentUser.name.toLowerCase())) || // dung sai chuỗi "Tên (Chức danh)"
       p.approvals?.some(ap => ap.approverId === currentUser.id || ap.approverId === currentUser.name))
    );
    const myPendingAdvances = subcontractorAdvances.filter(a =>
      a.status === 'pending_approval' &&
      (isFinanceApprover ||
       a.approver === currentUser.id ||
       (a.approverName && a.approverName.toLowerCase() === currentUser.name.toLowerCase()) ||
       a.approvals?.some(ap => ap.approverId === currentUser.id || ap.approverId === currentUser.name))
    );
    // Công tác phí chờ duyệt (đồng bộ TaskManagement myPendingTravelExpenses):
    // user hiện tại được cấu hình xét duyệt CTP hoặc thuộc nhóm Kế toán → xem toàn bộ.
    const canApproveTravelExpense = isUserInRoleGroup(currentUser.id, 'role_accounting') ||
      (getConfiguredApprover('travel_expense')?.id === currentUser.id);
    const myPendingTravelExpenses = ctpSummary.filter((t: any) => t.status === 'pending' && canApproveTravelExpense);
    const toReviewUncompletedCount = toReviewTasksCount
      + myPendingLeaves.length
      + myPendingPayments.length
      + myPendingAdvances.length
      + myPendingTravelExpenses.length;

    return assignedUncompletedCount + relatedUncompletedCount + toReviewUncompletedCount;
  })();

  if (!currentUser) {
    if (isInitializing || employees.length === 0) {
      return (
        <div className="flex h-screen w-screen items-center justify-center bg-slate-950">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
            <p className="text-sm text-slate-400 font-medium">Đang tải dữ liệu...</p>
          </div>
        </div>
      );
    }
    return (
      <Login
        brandName={displaySettings.brandName}
        brandSlogan={displaySettings.brandSlogan}
        logoText={displaySettings.logoText}
        primaryAccent={displaySettings.primaryAccent}
        employees={employees}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  // Splash screen cho giao diện chính: auto-login xong nhưng data chưa load xong
  if (isInitializing) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
          <p className="text-sm text-slate-400 font-medium">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  const currentFont = displaySettings.fontFamily || 'Inter';

  return (
    <AuthProvider employees={employees} addToast={addToast}>
      <NotificationProvider toasts={toasts} addToast={addToast} removeToast={removeToast}>
        <div
          className="flex min-h-screen w-full lg:h-screen lg:w-screen bg-slate-950 lg:overflow-hidden text-slate-200 font-sans transition-all duration-200"
          style={{ fontFamily: currentFont }}
          id="erp_container"
        >
      
      {/* BACKGROUND OVERLAY FOR MOBILE SIDEBAR */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden transition-opacity duration-300"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}


      {/* 1. SIDEBAR TRÁI KIỂU FLOWBITE */}
      <aside
          className={`fixed md:relative top-0 bottom-0 left-0 z-50 md:z-auto w-64 h-full max-h-screen flex flex-col shrink-0 transition-transform duration-300 ease-in-out bg-neutral-50 border-r border-gray-200 ${
            mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
          }`}
          id="left_sidebar_flowbite"
          aria-label="Sidebar"
        >
          <div className="h-full px-3 py-4 overflow-y-auto flex flex-col">
            {/* LOGO & THƯƠNG HIỆU */}
            <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shadow-sm shrink-0 text-white ${accentBgClass}`}>
                  <span className="font-black text-base tracking-wider italic font-mono">{displaySettings.logoText}</span>
                </div>
                <div className="min-w-0">
                  <h2 className="font-extrabold text-xs tracking-wide leading-none uppercase text-gray-900 truncate">{displaySettings.brandName}</h2>
                  <span className="text-[9px] font-bold tracking-widest mt-1 block uppercase text-gray-500 truncate">{displaySettings.brandSlogan}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="md:hidden p-1.5 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                title="Đóng menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* MENU CHÍNH KIỂU FLOWBITE */}
            <nav className="flex-1">
              <ul className="space-y-1.5 font-medium text-sm">
                {/* Nhóm tiêu điểm chung */}
                {isAccessible('dashboard') && (
                  <li>
                    <button
                      onClick={() => { setActiveTab('dashboard'); if (mobileMenuOpen) setMobileMenuOpen(false); }}
                      className={`w-full flex items-center px-2 py-2 rounded-lg group cursor-pointer transition-colors ${activeTab === 'dashboard' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
                    >
                      <LayoutDashboard className={`w-5 h-5 shrink-0 transition duration-75 ${activeTab === 'dashboard' ? 'text-emerald-600' : 'text-gray-500 group-hover:text-gray-900'}`} />
                      <span className="ms-3">Tổng quan</span>
                    </button>
                  </li>
                )}

                {isAccessible('tasks') && (
                  <li>
                    <button
                      onClick={() => { setActiveTab('tasks'); if (mobileMenuOpen) setMobileMenuOpen(false); }}
                      className={`w-full flex items-center px-2 py-2 rounded-lg group cursor-pointer transition-colors ${activeTab === 'tasks' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
                    >
                      <CheckSquare className={`w-5 h-5 shrink-0 transition duration-75 ${activeTab === 'tasks' ? 'text-emerald-600' : 'text-gray-500 group-hover:text-gray-900'}`} />
                      <span className="flex-1 ms-3 text-left whitespace-nowrap truncate">Việc của tôi</span>
                      {myUncompletedCount > 0 && (
                        <span className="inline-flex items-center justify-center w-5 h-5 ms-2 text-[10px] font-medium bg-danger-soft text-fg-danger-strong rounded-full">{myUncompletedCount}</span>
                      )}
                    </button>
                  </li>
                )}

                {isAccessible('messages') && (
                  <li>
                    <button
                      onClick={() => { setActiveTab('messages'); if (mobileMenuOpen) setMobileMenuOpen(false); }}
                      className={`w-full flex items-center px-2 py-2 rounded-lg group cursor-pointer transition-colors ${activeTab === 'messages' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
                    >
                      <MessageSquare className={`w-5 h-5 shrink-0 transition duration-75 ${activeTab === 'messages' ? 'text-emerald-600' : 'text-gray-500 group-hover:text-gray-900'}`} />
                      <span className="flex-1 ms-3 text-left whitespace-nowrap truncate">Tin nhắn</span>
                      {(() => {
                        const conversations = getConversations();
                        const userConvs = getUserConversations(conversations, currentUser?.id ?? '');
                        const chatUnreadCount = userConvs.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
                        return chatUnreadCount > 0 ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 ms-2 text-[10px] font-medium text-white bg-rose-600 rounded-full">{chatUnreadCount > 99 ? '99+' : chatUnreadCount}</span>
                        ) : null;
                      })()}
                    </button>
                  </li>
                )}
              </ul>

              {/* Các phân hệ - kiểu Flowbite dropdown */}
              <ul className="space-y-1 font-medium text-sm border-t border-gray-200 pt-3 mt-3">
                {/* PHÒNG GIÁM ĐỐC */}
                {isUserInRoleGroup(currentUser.id, 'role_admin') && (
                  <li>
                    <button
                      type="button"
                      onClick={() => setIsDirectorGroupExpanded(!isDirectorGroupExpanded)}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-gray-100 hover:text-gray-900 text-gray-600 group cursor-pointer transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 shrink-0 text-emerald-500 transition duration-75 group-hover:text-emerald-600" />
                        <span className="text-left whitespace-nowrap">Phòng Giám Đốc</span>
                      </span>
                      <svg className={`w-4 h-4 shrink-0 text-gray-400 transition-transform duration-200 ${isDirectorGroupExpanded ? 'rotate-0' : '-rotate-90'}`} aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 9-7 7-7-7"/></svg>
                    </button>
                    {isDirectorGroupExpanded && (
                      <ul className="py-1 space-y-1">
                        <li>
                          <button
                            onClick={() => {
                              const subTabMap: Record<string, string> = { projects: 'director-projects', hr: 'director-hr', accounting: 'director-finance', warehouse: 'director-warehouse', subcontractor: 'director-subcontractor', summary: 'director-summary' };
                              setActiveTab(subTabMap[directorSubDept] || 'director-projects');
                              if (mobileMenuOpen) setMobileMenuOpen(false);
                            }}
                            className={`w-full flex items-center pl-10 pr-2 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab.startsWith('director-') ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
                          >
                            Dashboard Tổng Hợp
                          </button>
                        </li>
                      </ul>
                    )}
                  </li>
                )}

                {/* PHÒNG DỰ ÁN */}
                {(isAccessible('projects-construction') || isAccessible('projects-furniture') || isAccessible('projects-mechanical')) && (
                  <li>
                    <button
                      type="button"
                      onClick={() => setIsProjectGroupExpanded(!isProjectGroupExpanded)}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-gray-100 hover:text-gray-900 text-gray-600 group cursor-pointer transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Folder className="w-5 h-5 shrink-0 text-sky-500 transition duration-75 group-hover:text-sky-600" />
                        <span className="text-left whitespace-nowrap">Phòng Dự Án</span>
                      </span>
                      <svg className={`w-4 h-4 shrink-0 text-gray-400 transition-transform duration-200 ${isProjectGroupExpanded ? 'rotate-0' : '-rotate-90'}`} aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 9-7 7-7-7"/></svg>
                    </button>
                    {isProjectGroupExpanded && (
                      <ul className="py-1 space-y-1">
                        {isAccessible('projects-construction') && (
                          <li>
                            <button onClick={() => { setActiveTab('projects-construction'); if (mobileMenuOpen) setMobileMenuOpen(false); }} className={`w-full flex items-center pl-10 pr-2 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab === 'projects-construction' ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                              Xây dựng
                            </button>
                          </li>
                        )}
                        {isAccessible('projects-furniture') && (
                          <li>
                            <button onClick={() => { setActiveTab('projects-furniture'); if (mobileMenuOpen) setMobileMenuOpen(false); }} className={`w-full flex items-center pl-10 pr-2 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab === 'projects-furniture' ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                              Nội thất
                            </button>
                          </li>
                        )}
                        {isAccessible('projects-mechanical') && (
                          <li>
                            <button onClick={() => { setActiveTab('projects-mechanical'); if (mobileMenuOpen) setMobileMenuOpen(false); }} className={`w-full flex items-center pl-10 pr-2 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab === 'projects-mechanical' ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                              Cơ khí
                            </button>
                          </li>
                        )}
                      </ul>
                    )}
                  </li>
                )}

                {/* PHÒNG NHÂN SỰ */}
                {isAccessible('hr-office') && (
                  <li>
                    <button
                      type="button"
                      onClick={() => setIsHrGroupExpanded(!isHrGroupExpanded)}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-gray-100 hover:text-gray-900 text-gray-600 group cursor-pointer transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Users className="w-5 h-5 shrink-0 text-amber-500 transition duration-75 group-hover:text-amber-600" />
                        <span className="text-left whitespace-nowrap">Phòng Nhân Sự</span>
                      </span>
                      <svg className={`w-4 h-4 shrink-0 text-gray-400 transition-transform duration-200 ${isHrGroupExpanded ? 'rotate-0' : '-rotate-90'}`} aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 9-7 7-7-7"/></svg>
                    </button>
                    {isHrGroupExpanded && (
                      <ul className="py-1 space-y-1">
                        {isAccessible('employees') && (
                          <li>
                            <button onClick={() => { setActiveTab('employees'); setHrSubTab('profiles'); if (mobileMenuOpen) setMobileMenuOpen(false); }} className={`w-full flex items-center pl-10 pr-2 py-1.5 rounded-lg transition-colors cursor-pointer ${(activeTab === 'employees' && hrSubTab !== 'hr_data') ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                              Hệ thống Nhân sự
                            </button>
                          </li>
                        )}
                        {isAccessible('hr-data') && (
                          <li>
                            <button onClick={() => { setActiveTab('employees'); setHrSubTab('hr_data'); if (mobileMenuOpen) setMobileMenuOpen(false); }} className={`w-full flex items-center pl-10 pr-2 py-1.5 rounded-lg transition-colors cursor-pointer ${(activeTab === 'employees' && hrSubTab === 'hr_data') ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                              Dữ liệu nhân sự
                            </button>
                          </li>
                        )}
                      </ul>
                    )}
                  </li>
                )}

                {/* PHÒNG KẾ TOÁN */}
                {isAccessible('accounting-office') && (
                  <li>
                    <button
                      type="button"
                      onClick={() => setIsFinanceGroupExpanded(!isFinanceGroupExpanded)}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-gray-100 hover:text-gray-900 text-gray-600 group cursor-pointer transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5 shrink-0 text-rose-500 transition duration-75 group-hover:text-rose-600" />
                        <span className="text-left whitespace-nowrap">Phòng Kế Toán</span>
                      </span>
                      <svg className={`w-4 h-4 shrink-0 text-gray-400 transition-transform duration-200 ${isFinanceGroupExpanded ? 'rotate-0' : '-rotate-90'}`} aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 9-7 7-7-7"/></svg>
                    </button>
                    {isFinanceGroupExpanded && (
                      <ul className="py-1 space-y-1">
                        {isAccessible('finance') && (
                          <li>
                            <button onClick={() => { setActiveTab('finance'); setFinanceSubTab('de_xuat_thu_chi'); if (mobileMenuOpen) setMobileMenuOpen(false); }} className={`w-full flex items-center pl-10 pr-2 py-1.5 rounded-lg transition-colors cursor-pointer ${(activeTab === 'finance' && financeSubTab !== 'du_lieu_ke_toan') ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                              Tài Chính - Kế Toán
                            </button>
                          </li>
                        )}
                        {isAccessible('finance-data') && (
                          <li>
                            <button onClick={() => { setActiveTab('finance'); setFinanceSubTab('du_lieu_ke_toan'); if (mobileMenuOpen) setMobileMenuOpen(false); }} className={`w-full flex items-center pl-10 pr-2 py-1.5 rounded-lg transition-colors cursor-pointer ${(activeTab === 'finance' && financeSubTab === 'du_lieu_ke_toan') ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                              Dữ Liệu Kế Toán
                            </button>
                          </li>
                        )}
                      </ul>
                    )}
                  </li>
                )}

                {/* KHO */}
                {isAccessible('warehouse-office') && (
                  <li>
                    <button
                      type="button"
                      onClick={() => setIsWarehouseGroupExpanded(!isWarehouseGroupExpanded)}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-gray-100 hover:text-gray-900 text-gray-600 group cursor-pointer transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Database className="w-5 h-5 shrink-0 text-teal-500 transition duration-75 group-hover:text-teal-600" />
                        <span className="text-left whitespace-nowrap">Kho</span>
                      </span>
                      <svg className={`w-4 h-4 shrink-0 text-gray-400 transition-transform duration-200 ${isWarehouseGroupExpanded ? 'rotate-0' : '-rotate-90'}`} aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 9-7 7-7-7"/></svg>
                    </button>
                    {isWarehouseGroupExpanded && (
                      <ul className="py-1 space-y-1">
                        {isAccessible('material-coordination') && (
                          <li>
                            <button onClick={() => { setActiveTab('material-coordination'); if (mobileMenuOpen) setMobileMenuOpen(false); }} className={`w-full flex items-center pl-10 pr-2 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab === 'material-coordination' ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                              Điều phối vật tư
                            </button>
                          </li>
                        )}
                        {isAccessible('warehouse-management') && (
                          <li>
                            <button onClick={() => { setActiveTab('warehouse-management'); if (mobileMenuOpen) setMobileMenuOpen(false); }} className={`w-full flex items-center pl-10 pr-2 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab === 'warehouse-management' ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                              Quản lý tồn kho
                            </button>
                          </li>
                        )}
                        {isAccessible('warehouse-data') && (
                          <li>
                            <button onClick={() => { setActiveTab('warehouse-data'); if (mobileMenuOpen) setMobileMenuOpen(false); }} className={`w-full flex items-center pl-10 pr-2 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab === 'warehouse-data' ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                              Dữ Liệu Kho
                            </button>
                          </li>
                        )}
                      </ul>
                    )}
                  </li>
                )}

                {/* THẦU PHỤ */}
                {isAccessible('subcontractor-office') && (
                  <li>
                    <button
                      type="button"
                      onClick={() => setIsSubcontractorGroupExpanded(!isSubcontractorGroupExpanded)}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-gray-100 hover:text-gray-900 text-gray-600 group cursor-pointer transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Folder className="w-5 h-5 shrink-0 text-orange-500 transition duration-75 group-hover:text-orange-600" />
                        <span className="text-left whitespace-nowrap">Thầu Phụ</span>
                      </span>
                      <svg className={`w-4 h-4 shrink-0 text-gray-400 transition-transform duration-200 ${isSubcontractorGroupExpanded ? 'rotate-0' : '-rotate-90'}`} aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 9-7 7-7-7"/></svg>
                    </button>
                    {isSubcontractorGroupExpanded && isAccessible('subcontractor-management') && (
                      <ul className="py-1 space-y-1">
                        <li>
                          <button onClick={() => { localStorage.removeItem('hl_view_contract_id'); localStorage.removeItem('hl_preselected_task_id'); setActiveTab('subcontractor-management'); if (mobileMenuOpen) setMobileMenuOpen(false); }} className={`w-full flex items-center pl-10 pr-2 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab === 'subcontractor-management' ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                            Quản Lý Thầu Phụ
                          </button>
                        </li>
                      </ul>
                    )}
                  </li>
                )}

                {/* THƯ VIỆN */}
                {isAccessible('library-office') && (
                  <li>
                    <button
                      type="button"
                      onClick={() => setIsLibraryGroupExpanded(!isLibraryGroupExpanded)}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-gray-100 hover:text-gray-900 text-gray-600 group cursor-pointer transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <BookOpen className="w-5 h-5 shrink-0 text-blue-500 transition duration-75 group-hover:text-blue-600" />
                        <span className="text-left whitespace-nowrap">Thư Viện</span>
                      </span>
                      <svg className={`w-4 h-4 shrink-0 text-gray-400 transition-transform duration-200 ${isLibraryGroupExpanded ? 'rotate-0' : '-rotate-90'}`} aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 9-7 7-7-7"/></svg>
                    </button>
                    {isLibraryGroupExpanded && (
                      <ul className="py-1 space-y-1">
                        {isAccessible('quotes-construction') && (
                          <li>
                            <button onClick={() => { setActiveTab('quotes-construction'); setPreselectedCustomerId(''); setPreselectedProjectId(''); if (mobileMenuOpen) setMobileMenuOpen(false); }} className={`w-full flex items-center pl-10 pr-2 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab === 'quotes-construction' ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                              Hồ Sơ Xây Dựng
                            </button>
                          </li>
                        )}
                        {isAccessible('quotes') && (
                          <li>
                            <button onClick={() => { setActiveTab('quotes'); setPreselectedCustomerId(''); setPreselectedProjectId(''); if (mobileMenuOpen) setMobileMenuOpen(false); }} className={`w-full flex items-center pl-10 pr-2 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab === 'quotes' ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                              Hồ Sơ Nội Thất
                            </button>
                          </li>
                        )}
                        {isAccessible('quotes-mechanical') && (
                          <li>
                            <button onClick={() => { setActiveTab('quotes-mechanical'); setPreselectedCustomerId(''); setPreselectedProjectId(''); if (mobileMenuOpen) setMobileMenuOpen(false); }} className={`w-full flex items-center pl-10 pr-2 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab === 'quotes-mechanical' ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                              Hồ Sơ Cơ Khí
                            </button>
                          </li>
                        )}
                        {isAccessible('quotes-subcontractor') && (
                          <li>
                            <button onClick={() => { localStorage.removeItem('hl_view_contract_id'); localStorage.removeItem('hl_preselected_task_id'); setActiveTab('quotes-subcontractor'); setPreselectedCustomerId(''); setPreselectedProjectId(''); if (mobileMenuOpen) setMobileMenuOpen(false); }} className={`w-full flex items-center pl-10 pr-2 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab === 'quotes-subcontractor' ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                              Hồ Sơ Thầu Phụ
                            </button>
                          </li>
                        )}
                      </ul>
                    )}
                  </li>
                )}

                {/* CÀI ĐẶT HỆ THỐNG */}
                {isAccessible('system-office') && (
                  <li className="border-t border-gray-200 pt-3 mt-3">
                    {isAccessible('settings-accounts') && (
                      <div>
                        <button
                          type="button"
                          onClick={() => setIsAccountGroupExpanded(!isAccountGroupExpanded)}
                          className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-gray-100 hover:text-gray-900 text-gray-600 group cursor-pointer transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <Users className="w-5 h-5 shrink-0 text-indigo-500 transition duration-75 group-hover:text-indigo-600" />
                            <span className="text-left whitespace-nowrap">Quản Lý Tài Khoản</span>
                          </span>
                          <svg className={`w-4 h-4 shrink-0 text-gray-400 transition-transform duration-200 ${isAccountGroupExpanded ? 'rotate-0' : '-rotate-90'}`} aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 9-7 7-7-7"/></svg>
                        </button>
                        {isAccountGroupExpanded && (
                          <ul className="py-1 space-y-1">
                            <li>
                              <button onClick={() => { setActiveTab('settings-accounts'); if (mobileMenuOpen) setMobileMenuOpen(false); }} className={`w-full flex items-center pl-10 pr-2 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab === 'settings-accounts' ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                                Tài Khoản Hệ Thống
                              </button>
                            </li>
                            {isAccessible('settings-roles') && (
                              <li>
                                <button onClick={() => { setActiveTab('settings-roles'); if (mobileMenuOpen) setMobileMenuOpen(false); }} className={`w-full flex items-center pl-10 pr-2 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab === 'settings-roles' ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                                  Phân Quyền Và Vai Trò
                                </button>
                              </li>
                            )}
                          </ul>
                        )}
                      </div>
                    )}

                    <button onClick={() => { setActiveTab('settings'); if (mobileMenuOpen) setMobileMenuOpen(false); }} className={`w-full flex items-center px-2 py-2 mt-1 rounded-lg cursor-pointer transition-colors ${activeTab === 'settings' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                      <Sliders className="w-5 h-5 shrink-0 text-violet-500 mr-2 transition duration-75" />
                      Cài Đặt Hệ Thống
                    </button>
                    {isAccessible('display-settings') && (
                      <button onClick={() => { setActiveTab('display-settings'); if (mobileMenuOpen) setMobileMenuOpen(false); }} className={`w-full flex items-center px-2 py-2 mt-1 rounded-lg cursor-pointer transition-colors ${activeTab === 'display-settings' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                        <Palette className="w-5 h-5 shrink-0 text-fuchsia-500 mr-2 transition duration-75" />
                        Cấu Hình Giao Diện
                      </button>
                    )}
                  </li>
                )}
              </ul>
            </nav>

            {/* ĐỒNG HỒ / CHÂN SIDEBAR */}
            <div className="border-t border-gray-200 pt-3 mt-3 text-gray-500 shrink-0">
              <span className="text-[9px] text-gray-400 block font-semibold mb-1">Cán bộ: {currentUser.name}</span>
              <div className="text-2xl font-black font-sans leading-none text-gray-900">{currentTime || '12:00 PM'}</div>
              <div className="text-[9px] text-gray-400 mt-1.5 leading-normal">{displaySettings.motivationQuote}</div>
              {/* Mã build ngắn (ngày + commit) — theo dõi bản đang chạy sau mỗi lần deploy */}
              <div className="text-[8px] text-gray-300 mt-1 font-mono">v{import.meta.env.VITE_BUILD_DATE} · {import.meta.env.VITE_BUILD_COMMIT}</div>
            </div>
          </div>
        </aside>

      {/* (NỘI DUNG CHÍNH BÊN PHẢI) */}
      <div className="flex-1 flex flex-col min-w-0 lg:overflow-hidden bg-slate-950 text-slate-200" id="right_content_pane">

        {/* HEADER TOP-BAR - Tall header with 39px top padding to avoid iPhone Dynamic Island. Content/scontrols aligned at bottom via items-end */}
        <header className="bg-slate-900/50 border-b border-slate-800 px-4 md:px-6 pt-[50px] pb-[10px] flex justify-between items-end shrink-0 shadow-lg" id="top_header_bar">
          <div className="flex items-center gap-3">
            {/* Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 text-slate-450 hover:text-slate-200 hover:bg-slate-800/50 rounded-lg transition-colors cursor-pointer"
              title="Mở menu"
            >
              <Menu className="w-5 h-5 text-slate-300" />
            </button>

            <span className="text-sm md:text-base font-extrabold text-slate-100 tracking-tight font-sans truncate max-w-[150px] sm:max-w-xs md:max-w-none">
              {activeTab === 'dashboard' && displaySettings.dashboardTitle}
              {activeTab === 'projects' && 'Quản Lý Mốc Thi Công'}
              {activeTab === 'projects-construction' && 'Dự Án Xây Dựng'}
              {activeTab === 'projects-furniture' && 'Dự Án Nội Thất'}
              {activeTab === 'projects-mechanical' && 'Dự Án Cơ Khí'}
              {activeTab === 'tasks' && 'Việc Của Tôi'}
              {activeTab === 'quotes-construction' && 'Hồ Sơ Xây Dựng'}
              {activeTab === 'quotes' && 'Hồ Sơ Nội Thất'}
              {activeTab === 'quotes-mechanical' && 'Hồ Sơ Cơ Khí'}
              {activeTab === 'quotes-subcontractor' && 'Hồ Sơ Thầu Phụ'}
              {activeTab === 'subcontractor-management' && 'Quản Lý Thầu Phụ'}
              {activeTab === 'finance' && 'Kế Toán - Tài Chính'}
              {activeTab === 'material-coordination' && 'Quản Lý Vật Tư'}
              {activeTab === 'warehouse-suppliers' && 'Danh Mục Nhà Cung Cấp Vật Tư'}
              {activeTab === 'warehouse-management' && 'Quản Lý Tồn Kho & Sổ Kho'}
              {activeTab === 'warehouse-data' && 'Dữ Liệu Kho — Danh Mục Mua & Bán'}
              {activeTab === 'employees' && (hrSubTab === 'hr_data' ? 'Dữ Liệu Nhân Sự' : 'Danh Sách Nhân Sự')}
              {activeTab === 'settings' && '⚙️ Cấu Hình Hệ Thống'}
              {activeTab === 'messages' && '💬 Tin Nhắn'}
              {activeTab.startsWith('director-') && '🛡️ PHÒNG GIÁM ĐỐC - BẢNG ĐIỀU HÀNH TỔNG HỢP'}
            </span>
          </div>

          {/* Thông tin đăng nhập giả lập */}
          <div className="flex items-center gap-2 sm:gap-3 text-xs font-semibold">
            {dbSeedSuccess && (
              <div className="hidden sm:block bg-emerald-900/50 text-emerald-400 border border-emerald-800/60 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300">
                {dbSeedSuccess}
              </div>
            )}

            {/* CHUÔNG 🔔 → LỐI TẮT VÀO TIN NHẮN (badge = tổng tin chat chưa đọc) */}
            {(() => {
              const chatConvs = getUserConversations(getConversations(), currentUser?.id ?? '');
              const chatUnreadCount = chatConvs.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

              return (
                <div className="flex items-center gap-2">
                  {/* Nút quay lại (back) — thay thế cử chỉ vuốt về tab trước trên mobile */}
                  <button
                    onClick={() => {
                      setTabHistory(prev => {
                        if (prev.length === 0) return prev;
                        const last = prev[prev.length - 1];
                        setActiveTabState(last);
                        return prev.slice(0, -1);
                      });
                    }}
                    className="p-2 text-slate-400 hover:text-emerald-400 bg-slate-900 border border-slate-800 rounded-lg cursor-pointer transition-colors flex items-center justify-center h-8.5 w-8.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Quay lại trang trước"
                    id="back_nav_btn"
                    disabled={tabHistory.length === 0}
                  >
                    <ArrowLeft className="w-4 h-4 text-emerald-400" />
                  </button>

                  {/* Nút reload trang */}
                  <button
                    onClick={() => window.location.reload()}
                    className="p-2 text-slate-400 hover:text-emerald-400 bg-slate-900 border border-slate-800 rounded-lg cursor-pointer transition-colors flex items-center justify-center h-8.5 w-8.5"
                    title="Tải lại trang"
                    id="reload_page_btn"
                  >
                    <RefreshCw className="w-4 h-4 text-emerald-400" />
                  </button>

                  <div className="relative" id="notification_bell_root">
                    <button
                      onClick={() => { setActiveTab('messages'); if (mobileMenuOpen) setMobileMenuOpen(false); }}
                      className="p-2 text-slate-400 hover:text-emerald-400 bg-slate-900 border border-slate-800 rounded-lg cursor-pointer transition-colors relative flex items-center justify-center h-8.5 w-8.5"
                      title="Tin nhắn"
                      id="notification_bell_btn"
                    >
                      <Bell className="w-4 h-4 text-emerald-400" />
                      {showBadgeCounts && chatUnreadCount > 0 ? (
                        <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-rose-600 text-[9px] font-black text-white ring-1 ring-rose-500 animate-pulse">
                          {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                        </span>
                      ) : null}
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* TÀI KHOẢN ĐĂNG NHẬP - Avatar + tên, click sổ tùy chọn */}
            <div className="relative" id="user_account_dropdown">
              <button
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1 sm:pr-2 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black bg-slate-800 border border-slate-700 text-slate-200 shrink-0 overflow-hidden">
                  {currentUser.avatar ? (
                    currentUser.avatar.startsWith('http') ? (
                      <img src={currentUser.avatar} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-base">{currentUser.avatar}</span>
                    )
                  ) : (
                    currentUser.name.charAt(0)
                  )}
                </div>
                <span className="hidden sm:block text-xs font-bold text-slate-200 truncate max-w-[120px]">{currentUser.name}</span>
                <svg className={`hidden sm:block w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200 ${showUserMenu ? 'rotate-0' : '-rotate-90'}`} aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 9-7 7-7-7"/></svg>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-1 w-44 z-50 bg-slate-900 border border-slate-800 rounded-lg shadow-xl py-1">
                  <button
                    type="button"
                    onClick={() => { setShowUserMenu(false); setShowProfileModal(true); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer transition-colors"
                  >
                    <UserCog className="w-4 h-4 shrink-0 text-slate-400" />
                    Sửa hồ sơ
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowUserMenu(false); setActiveTab('display-settings'); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-indigo-400 hover:bg-indigo-950/40 cursor-pointer transition-colors"
                  >
                    <Palette className="w-4 h-4 shrink-0" />
                    Giao diện & Màu sắc
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowUserMenu(false); handleLogout(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-rose-400 hover:bg-rose-950/40 cursor-pointer transition-colors"
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>

          </div>
        </header>

        {/* VÙNG ĐIỀU HƯỚNG TỚI CÁC TAB CHI TIẾT */}
        <main
          className="flex-1 p-3 sm:p-6 lg:overflow-y-auto"
          id="main_content_scroller"
        >
          {!isAccessible(activeTab) ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center space-y-4 animate-fadeIn" id="access_denied_pane">
              <div className="w-20 h-20 rounded-full bg-rose-950/40 border border-rose-800/60 flex items-center justify-center">
                <Lock className="w-9 h-9 text-rose-400" />
              </div>
              <div>
                <h2 className="text-lg font-black text-rose-400 uppercase tracking-wider">🚫 Truy cập bị từ chối</h2>
                <p className="text-xs text-slate-400 mt-2 max-w-sm leading-relaxed">
                  Bạn không có quyền xem phân hệ này. Vui lòng liên hệ Ban Giám Đốc hoặc Quản trị viên để được cấp quyền truy cập.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className={`px-5 py-2 text-xs font-black rounded-lg flex items-center gap-1.5 cursor-pointer transition-all ${accentBgClass}`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Quay về Tổng quan
              </button>
            </div>
          ) : (
          <>
          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <DashboardOverview
              projects={projects}
              tasks={tasks}
              receipts={receipts}
              payments={payments}
              quotes={quotes}
              currentUser={currentUser}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onUpdateTask={handleUpdateTask}
              onApprovePayment={handleApprovePayment}
              onAddTask={handleAddTask}
              onAddPayment={handleAddPayment}
              travelExpensesSummary={ctpSummary}
            />
          )}

          {/* TAB 2: DỰ ÁN */}
          {activeTab === 'projects' && (
            <ProjectManagement 
              projects={projects}
              customers={customers}
              employees={employees}
              receipts={receipts}
              payments={payments}
              onAddProject={handleAddProject}
              onUpdateProjectStatus={handleUpdateProjectStatus}
              onUpdateProject={handleUpdateProject}
              onDeleteProject={handleDeleteProject}
              onAddCustomer={handleAddCustomer}
            />
          )}

          {/* TAB 2.1: PHÒNG DỰ ÁN - XÂY DỰNG */}
          {activeTab === 'projects-construction' && (
            <ProjectKanbanBoard
              sector="construction"
              projects={projects}
              customers={customers}
              employees={employees}
              tasks={tasks}
              receipts={receipts}
              payments={payments}
              onAddProject={handleAddProject}
              onUpdateProject={handleUpdateProject}
              onDeleteProject={handleDeleteProject}
              onAddTask={handleAddTask}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              onDeleteMultipleTasks={handleDeleteMultipleTasks}
              onAddCustomer={handleAddCustomer}
              currentUser={currentUser}
              quotes={quotes}
              onRedirectToQuote={handleRedirectToQuote}
              onRedirectToSubcontractor={handleRedirectToSubcontractor}
            />
          )}

          {/* TAB 2.2: PHÒNG DỰ ÁN - NỘI THẤT */}
          {activeTab === 'projects-furniture' && (
            <ProjectKanbanBoard
              sector="furniture"
              projects={projects}
              customers={customers}
              employees={employees}
              tasks={tasks}
              receipts={receipts}
              payments={payments}
              onAddProject={handleAddProject}
              onUpdateProject={handleUpdateProject}
              onDeleteProject={handleDeleteProject}
              onAddTask={handleAddTask}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              onDeleteMultipleTasks={handleDeleteMultipleTasks}
              onAddCustomer={handleAddCustomer}
              currentUser={currentUser}
              quotes={quotes}
              onRedirectToQuote={handleRedirectToQuote}
              onRedirectToSubcontractor={handleRedirectToSubcontractor}
            />
          )}

          {/* TAB 2.3: PHÒNG DỰ ÁN - CƠ KHÍ */}
          {activeTab === 'projects-mechanical' && (
            <ProjectKanbanBoard
              sector="mechanical"
              projects={projects}
              customers={customers}
              employees={employees}
              tasks={tasks}
              receipts={receipts}
              payments={payments}
              onAddProject={handleAddProject}
              onUpdateProject={handleUpdateProject}
              onDeleteProject={handleDeleteProject}
              onAddTask={handleAddTask}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              onDeleteMultipleTasks={handleDeleteMultipleTasks}
              onAddCustomer={handleAddCustomer}
              currentUser={currentUser}
              quotes={quotes}
              onRedirectToQuote={handleRedirectToQuote}
              onRedirectToSubcontractor={handleRedirectToSubcontractor}
            />
          )}

          {/* TAB 3: CÔNG VIỆC */}
          {activeTab === 'tasks' && (
            <TaskManagement 
              tasks={tasks}
              projects={projects}
              employees={employees}
              currentUser={currentUser}
              onAddTask={handleAddTask}
              onUpdateTask={handleUpdateTask}
              onUpdateProject={handleUpdateProject}
              onDeleteTask={handleDeleteTask}
              onDeleteMultipleTasks={handleDeleteMultipleTasks}
              customers={customers}
              quotes={quotes}
              onRedirectToQuote={handleRedirectToQuote}
              onRedirectToSubcontractor={handleRedirectToSubcontractor}
              onRedirectToHrLeaves={() => { setActiveTab('employees'); setHrSubTab('leaves'); }}
              onOpenFinanceVoucher={openFinanceVoucher}
              subcontractorAdvances={subcontractorAdvances}
              initialTaskId={deepLinkTaskId ?? undefined}
              onInitialTaskOpened={() => setDeepLinkTaskId(null)}
              initialTaskScope={approvalDeepLink ? 'toreview' : undefined}
              onInitialTaskScopeOpened={() => setApprovalDeepLink(null)}
            />
          )}

          {/* TAB 4: HỆ THỐNG BÁO GIÁ ĐA LĨNH VỰC TÍCH HỢP */}
          {['quotes', 'quotes-construction', 'quotes-mechanical', 'quotes-subcontractor'].includes(activeTab) && (
            <QuotationSystem 
              quotes={quotes}
              customers={customers}
              projects={projects}
              onAddQuote={handleAddQuote}
              onUpdateQuoteStatus={handleUpdateQuoteStatus}
              preselectedCustomerId={preselectedCustomerId}
              preselectedProjectId={preselectedProjectId}
              initialSubTab={preselectedQuotesSubTab || undefined}
              preselectedDocType={preselectedDocType || undefined}
              currentUser={currentUser}
              initialTab={
                activeTab === 'quotes-construction' 
                  ? 'construction' 
                  : activeTab === 'quotes-mechanical' 
                  ? 'mechanical' 
                  : activeTab === 'quotes-subcontractor'
                  ? 'subcontractor'
                  : 'furniture'
              }
            />
          )}

          {/* TAB: QUẢN LÝ THẦU PHỤ (RIÊNG BIỆT) */}
          {activeTab === 'subcontractor-management' && (
            <SubcontractorManagement
              currentUser={currentUser}
              canEdit={isUserInRoleGroup(currentUser?.id, 'role_admin') || isUserInRoleGroup(currentUser?.id, 'role_office') || isUserInRoleGroup(currentUser?.id, 'role_technical')}
              canDelete={isUserInRoleGroup(currentUser?.id, 'role_admin')}
              viewContractId={localStorage.getItem('hl_view_contract_id') || undefined}
            />
          )}

          {/* TAB 5: TÀI CHÍNH */}
          {activeTab === 'finance' && (
            <FinanceManagement
              receipts={receipts}
              payments={payments}
              projects={projects}
              customers={customers}
              currentUser={currentUser}
              employees={employees}
              salesOrders={salesOrders}
              suppliers={suppliers}
              purchaseOrders={purchaseOrders}
              onAddReceipt={handleAddReceipt}
              onAddPayment={handleAddPayment}
              onApprovePayment={handleApprovePayment}
              onAddCustomer={handleAddCustomer}
              onDeleteCustomer={handleDeleteCustomer}
              onDeleteReceipt={handleDeleteReceipt}
              onDeletePayment={handleDeletePayment}
              onUpdateReceipt={handleUpdateReceipt}
              onUpdatePayment={handleUpdatePayment}
              onAddSalesOrder={handleAddSalesOrder}
              onDeleteSalesOrder={handleDeleteSalesOrder}
              onAddPurchaseOrder={handleAddPurchaseOrder}
              onDeletePurchaseOrder={handleDeletePurchaseOrder}
              tasks={tasks}
              initialSubTab={financeSubTab}
              initialDuLieuTab={financeDuLieuTab}
              initialProposalId={financeInitialProposalId}
              onInitialProposalConsumed={() => setFinanceInitialProposalId(null)}
              onOpenMaterialProposal={openMaterialProposal}
              systemConfig={hrmConfig}
            />
          )}

          {/* TAB 5.5: ĐIỀU PHỐI VẬT TƯ */}
          {activeTab === 'material-coordination' && (
            <MaterialCoordination
              projects={projects}
              employees={employees}
              onUpdateProject={handleUpdateProject}
              onUpdateMultipleProjects={handleUpdateMultipleProjects}
              currentUser={currentUser}
              customers={customers}
              initialProposalId={materialInitialProposalId}
              onInitialProposalConsumed={() => setMaterialInitialProposalId(null)}
            />
          )}

          {/* TAB 5.6: DANH MỤC NHÀ CUNG CẤP KHO */}
          {activeTab === 'warehouse-suppliers' && (
            <WarehouseSuppliers />
          )}

          {/* TAB 5.7: QUẢN LÝ KHO */}
          {activeTab === 'warehouse-management' && (
            <WarehouseManagement />
          )}

          {/* TAB 5.8: DỮ LIỆU KHO (Danh mục MUA / BÁN) */}
          {activeTab === 'warehouse-data' && (
            <WarehouseDataManagement />
          )}

          {/* TAB 6: NHÂN SỰ */}
          {activeTab === 'employees' && (
            <HumanResourcesManagement 
              currentUser={currentUser} 
              projects={projects} 
              customers={customers} 
              defaultSubTab={hrSubTab}
              systemConfig={hrmConfig}
            />
          )}

          {/* PHÂN QUYỀN VÀ VAI TRÒ (Dưới danh nghĩa menu con của Quản Lý Tài Khoản) */}
          {activeTab === 'settings-roles' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg max-w-7xl mx-auto">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-3">
                  <Lock className={`w-4 h-4 ${accentTextClass}`} />
                  <h3 className="text-sm font-black text-white uppercase tracking-wider font-mono">
                    🔐 Phân quyền và Vai trò người dùng
                  </h3>
                </div>
                <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
                  Thiết lập các quyền thao tác (Xem, Thêm, Sửa, Xóa) chi tiết cho từng vai trò và phòng ban được đồng bộ trực tiếp từ phân hệ Quản trị Nhân sự (HRM). Thay đổi quyền hạn tại đây sẽ áp dụng ngay lập tức cho toàn bộ người dùng trong hệ thống.
                </p>
                <HumanResourcesManagement
                  currentUser={currentUser}
                  projects={projects}
                  customers={customers}
                  defaultSubTab="roles"
                  hideSidebar={true}
                  systemConfig={hrmConfig}
                />
              </div>
            </div>
          )}

          {/* TÀI KHOẢN HỆ THỐNG (Dưới danh nghĩa menu con của Quản Lý Tài Khoản) */}
          {activeTab === 'settings-accounts' && (
            <div className="space-y-6 max-w-5xl mx-auto animate-fadeIn" id="view_accounts_settings_pane">
              
              {/* Form thêm người dùng đã bị xóa — tạo tài khoản thực hiện qua Hồ sơ Nhân viên trong HRM */}

              {/* bảng người dùng */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Users className={`w-4 h-4 ${accentTextClass}`} />
                    <h3 className="text-xs font-black text-white uppercase tracking-wider font-mono">
                      👤 Danh Sách Tài Khoản Hệ Thống ({employees.filter(e => e.username && e.password).length})
                    </h3>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-bold bg-slate-950/40">
                        <th className="py-2.5 px-3">Nhân Viên / Họ Tên</th>
                        <th className="py-2.5 px-3">Tên Đăng Nhập (Username)</th>
                        <th className="py-2.5 px-3">Mật Khẩu</th>
                        <th className="py-2.5 px-3">Phân Quyền</th>
                        <th className="py-2.5 px-3">Bộ Phận / Phòng Ban</th>
                        <th className="py-2.5 px-3 text-right">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.filter(e => e.username && e.password).map((emp) => (
                        <tr key={emp.id} className="border-b border-slate-800/60 hover:bg-slate-850/30 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-100 flex items-center gap-1.5">
                              {emp.name}
                              {emp.id === currentUser.id && (
                                <span className="px-1 py-0.2 bg-emerald-500/20 text-emerald-400 rounded text-[9px] font-mono">Hiện Tại</span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">{emp.phone}</div>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-400">
                            {emp.username || generateUsernameWithPhone(emp.name, emp.phone)}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-400 select-none">
                            ***
                          </td>
                          <td className="py-2.5 px-3 font-medium">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                              {getEmployeePermissionGroupName(emp)}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 font-semibold">{emp.department}</td>
                          <td className="py-2.5 px-3 text-right">
                            {confirmDeleteId === emp.id ? (
                              <div className="flex justify-end items-center gap-1.5 animate-fadeIn">
                                <span className="text-[10px] text-rose-400 font-bold font-mono">Xác nhận xóa?</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const filtered = employees.filter(e => e.id !== emp.id);
                                    setEmployees(filtered);
                                    dbService.employees.delete(emp.id);
                                    setConfirmDeleteId(null);
                                    // Notify HR UI to reset hasSystemAccount flag
                                    window.dispatchEvent(new CustomEvent('hl-system-account-deleted', { detail: { empId: emp.id } }));
                                    addToast({
                                      title: 'Đã xóa tài khoản',
                                      message: `Đã xóa tài khoản của nhân sự "${emp.name}" thành công.`,
                                      type: 'success'
                                    });
                                  }}
                                  className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-[10px] transition-all cursor-pointer"
                                >
                                  Xóa
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded text-[10px] transition-all cursor-pointer"
                                >
                                  Hủy
                                </button>
                              </div>
                            ) : (
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (emp.username === 'admin' || emp.id === 'emp_admin' || emp.id === 'NV_ADMIN') {
                                      addToast({
                                        title: 'Hành động bị cấm',
                                        message: 'Không thể xóa tài khoản Quản trị viên hệ thống (admin)!',
                                        type: 'error'
                                      });
                                      return;
                                    }
                                    if (currentUser && emp.id === currentUser.id) {
                                      addToast({
                                        title: 'Hành động không hợp lệ',
                                        message: 'Không thể xóa tài khoản hiện đang đăng nhập vào hệ thống!',
                                        type: 'warning'
                                      });
                                      return;
                                    }
                                    if (employees.filter(e => e.username && e.password).length <= 1) {
                                      addToast({
                                        title: 'Không thể thực hiện',
                                        message: 'Hệ thống cần ít nhất một tài khoản hoạt động.',
                                        type: 'warning'
                                      });
                                      return;
                                    }
                                    setConfirmDeleteId(emp.id);
                                  }}
                                  className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/15 p-1 px-2 rounded-md transition-all cursor-pointer font-black font-mono text-[10px]"
                                >
                                  🗑️ XÓA
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB: CẤU HÌNH GIAO DIỆN (TÁCH RIÊNG) */}
          {activeTab === 'display-settings' && (
            <div className="space-y-6 animate-fadeIn p-4 md:p-6">
              <DisplaySettingsPage />
            </div>
          )}

          {/* TAB 7: CÀI ĐẶT TÙY BIẾN TOÀN DIỆN (THEO YÊU CẦU MỚI) */}
          {activeTab === 'settings' && (
            <div className="space-y-6 animate-fadeIn" id="corporate_settings_panel">

              {/* THANH ĐIỀU HƯỚNG SUB-TABS CỦA TRUNG TÂM CÀI ĐẶT */}
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setSubSettingsTab('business')}
                  className={`px-4 py-2 text-xs font-black rounded-lg transition-all flex items-center gap-2 cursor-pointer border ${
                    subSettingsTab === 'business'
                      ? `${accentBgClass} shadow-md`
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                  id="tab_business_settings"
                >
                  <Building className="w-4 h-4" />
                  1. HỒ SƠ THÔNG TIN DOANH NGHIỆP
                </button>

                <button
                  type="button"
                  onClick={() => setSubSettingsTab('shift')}
                  className={`px-4 py-2 text-xs font-black rounded-lg transition-all flex items-center gap-2 cursor-pointer border ${
                    subSettingsTab === 'shift'
                      ? `${accentBgClass} shadow-md`
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                  id="tab_shift_settings"
                >
                  <Clock className="w-4 h-4" />
                  2. CẤU HÌNH CA
                </button>
              </div>

                  

                            {/* PHẦN 3: CÀI ĐẶT THÔNG TIN DOANH NGHIỆP */}
              {subSettingsTab === 'business' && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg max-w-4xl space-y-6" id="view_business_info_pane">
                  
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                    <Building className={`w-4 h-4 ${accentTextClass}`} />
                    <h3 className="text-xs font-black text-white uppercase tracking-wider font-mono">
                      Hồ Sơ Thông Tin Doanh Nghiệp (Tư Duy Các Trường Quản Trị Nghiệp Vụ)
                    </h3>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Hồ sơ doanh nghiệp dùng để kết xuất hợp đồng thi công dân dụng, lập phiếu báo giá sản phẩm mộc cabinet, vách ngăn CNC hoặc áp dụng vào hóa đơn chi trả thực tế tại địa bàn Lâm Đồng.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold mb-1">TÊN DOANH NGHIỆP ĐẦY ĐỦ VĂN BẢN *</label>
                      <input
                        type="text"
                        value={editCorpName}
                        onChange={(e) => setEditCorpName(e.target.value)}
                        placeholder="Ví dụ: CÔNG TY TNHH LÂM NGHIỆP & XÂY DỰNG HOÀNG LONG"
                        className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 px-3 text-xs text-white outline-none focus:border-slate-700"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold mb-1">MÃ SỐ THUẾ / SỐ ĐĂNG KÍ DOANH NGHIỆP</label>
                      <input
                        type="text"
                        value={editCorpTax}
                        onChange={(e) => setEditCorpTax(e.target.value)}
                        placeholder="5801456789"
                        className="w-full bg-slate-950 border border-slate-805 rounded p-1.5 px-3 text-xs text-emerald-400 font-mono outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold mb-1">NGƯỜI ĐẠI DIỆN PHÁP LUẬT (GIÁM ĐỐC)</label>
                      <input
                        type="text"
                        value={editCorpRep}
                        onChange={(e) => setEditCorpRep(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 px-3 text-xs text-white outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold mb-1">SỐ ĐIỆN THOẠI HOTLINE DOANH NGHIỆP</label>
                      <input
                        type="text"
                        value={editCorpPhone}
                        onChange={(e) => setEditCorpPhone(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 px-3 text-xs text-white outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold mb-1">EMAIL NHẬN THƯỜNG TRỰC GIAO DỊCH</label>
                      <input
                        type="text"
                        value={editCorpEmail}
                        onChange={(e) => setEditCorpEmail(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 px-3 text-xs text-white outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold mb-1">NĂM SÁNG LẬP & THÀNH LẬP</label>
                      <input
                        type="text"
                        value={editCorpFounding}
                        onChange={(e) => setEditCorpFounding(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-805 rounded p-1.5 px-3 text-xs text-white outline-none w-1/2 font-mono"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[10px] text-slate-400 font-bold mb-1">TRỤ SỞ PHÁP LÝ ĐĂNG KÝ HÀNH CHÍNH chính</label>
                      <input
                        type="text"
                        value={editCorpAddr}
                        onChange={(e) => setEditCorpAddr(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 px-3 text-xs text-slate-205 outline-none"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[10px] text-slate-400 font-bold mb-1">CÁC CHI NHÁNH / VP ĐẠI DIỆN KHÁC (ĐÀ LẠT V.V)</label>
                      <input
                        type="text"
                        value="45 Hùng Vương, Phường 9, TP. Đà Lạt & Đường tránh Quốc Lộ 20, Xã Lộc Châu, TP. Bảo Lộc"
                        disabled
                        className="w-full bg-slate-955 border border-slate-800 opacity-60 rounded p-1.5 px-3 text-xs text-slate-400 outline-none"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[10px] text-slate-400 font-bold mb-1">THÔNG TIN KHAI THÁC & TÀI KHOẢN NGÂN HÀNG CHÍNH</label>
                      <input
                        type="text"
                        value={editCorpBank}
                        onChange={(e) => setEditCorpBank(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 rounded p-1.5 px-3 text-xs text-slate-200 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold mb-1">QUY MÔ NHÂN SỰ & KHẢ NĂNG THẦU</label>
                      <input
                        type="text"
                        value={editCorpScale}
                        onChange={(e) => setEditCorpScale(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 px-3 text-xs text-slate-200 outline-none"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[10px] text-slate-400 font-bold mb-1">LĨNH VỰC HOẠT ĐỘNG CỐT LÕI (NÓI RÕ PHÂN KHÚC THI CÔNG NGHIỆP VỤ)</label>
                      <textarea
                        value={editCorpSector}
                        onChange={(e) => setEditCorpSector(e.target.value)}
                        rows={3}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-350 outline-none resize-none leading-relaxed"
                      />
                    </div>

                  </div>

                  <div className="flex justify-end pt-4 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        const updated = {
                          companyName: editCorpName.trim() || 'CÔNG TY TNHH LÂM NGHIỆP & XÂY DỰNG HOÀNG LONG',
                          taxCode: editCorpTax.trim() || '5801456789',
                          representative: editCorpRep.trim() || 'Trương Hữu Long',
                          phone: editCorpPhone.trim() || '0988.123.456',
                          email: editCorpEmail.trim() || 'contact@hoanglonglamdong.vn',
                          address: editCorpAddr.trim() || 'Số 120 Đường Trần Phú, Phường 2, TP. Bảo Lộc, Lâm Đồng',
                          foundingYear: editCorpFounding.trim() || '2016',
                          businessSector: editCorpSector.trim() || 'Xây dựng dân dụng, sản xuất và thi công nội thất mộc cabinet, gia công cơ khí cấu kiện thép',
                          bankInfo: editCorpBank.trim() || '1023456789 - Vietcombank Chi nhánh Bảo Lộc',
                          scale: editCorpScale.trim() || 'Hơn 150 kỹ sư & thợ lành nghề'
                        };
                        setBusinessInfo(updated);
                        alert('🏢 Đã lưu hồ sơ cập nhật thông tin doanh nghiệp thành công! Dữ liệu này sẽ làm căn mẫu thông tin cho mọi kết xuất văn bản của hệ thống.');
                      }}
                      className={`px-6 py-2.5 text-xs font-black rounded-xl transition-all cursor-pointer shadow-md ${accentBgClass}`}
                    >
                      💾 CẬP NHẬT HỒ SƠ DOANH NGHIỆP
                    </button>
                  </div>

                </div>
              )}

              {/* PHẦN 4: CẤU HÌNH CA */}
              {subSettingsTab === 'shift' && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg max-w-4xl space-y-6 animate-fadeIn" id="view_shift_settings_pane">

                  <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                    <Clock className={`w-4 h-4 ${accentTextClass}`} />
                    <h3 className="text-xs font-black text-white uppercase tracking-wider font-mono">
                      🕒 CẤU HÌNH GIỜ CA & CHẤM CÔNG
                    </h3>
                  </div>

                  <p className="text-[10px] text-slate-400 leading-relaxed bg-slate-950/60 border border-slate-850 rounded-lg p-3">
                    Mỗi ca làm việc có 2 nút <b className="text-emerald-400">VÀO</b> và <b className="text-rose-400">RA</b>. Thời điểm mở/đóng mỗi nút được tính tự động từ
                    <b className="text-sky-400"> Giờ chuẩn ca</b> ± <b className="text-amber-400">Số phút cấu hình</b>. Thay đổi tại đây sẽ <b className="text-sky-400">tự động khóa/mở</b> ngay các nút điểm danh ở trang Tổng quan.
                  </p>

                  <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 space-y-5" id="hrm_timing_settings_card">

                    {/* ───────── 6 GIỜ CHUẨN CỦA TỪNG CA ───────── */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Vào Sáng:</label>
                        <input
                          type="time"
                          value={hrmConfig.morningIn}
                          onChange={(e) => {
                            const updated = { ...hrmConfig, morningIn: e.target.value };
                            setHrmConfig(updated);
                            dbService.shiftConfig.save(updated).catch(err => console.error('Supabase shiftConfig save error:', err));
                            window.dispatchEvent(new Event('storage'));
                            window.dispatchEvent(new CustomEvent('hl_system_settings_updated'));
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white outline-none focus:border-slate-700 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Ra Sáng:</label>
                        <input
                          type="time"
                          value={hrmConfig.morningOut}
                          onChange={(e) => {
                            const updated = { ...hrmConfig, morningOut: e.target.value };
                            setHrmConfig(updated);
                            dbService.shiftConfig.save(updated).catch(err => console.error('Supabase shiftConfig save error:', err));
                            window.dispatchEvent(new Event('storage'));
                            window.dispatchEvent(new CustomEvent('hl_system_settings_updated'));
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white outline-none focus:border-slate-700 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Vào Chiều:</label>
                        <input
                          type="time"
                          value={hrmConfig.afternoonIn}
                          onChange={(e) => {
                            const updated = { ...hrmConfig, afternoonIn: e.target.value };
                            setHrmConfig(updated);
                            dbService.shiftConfig.save(updated).catch(err => console.error('Supabase shiftConfig save error:', err));
                            window.dispatchEvent(new Event('storage'));
                            window.dispatchEvent(new CustomEvent('hl_system_settings_updated'));
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white outline-none focus:border-slate-700 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Ra Chiều:</label>
                        <input
                          type="time"
                          value={hrmConfig.afternoonOut}
                          onChange={(e) => {
                            const updated = { ...hrmConfig, afternoonOut: e.target.value };
                            setHrmConfig(updated);
                            dbService.shiftConfig.save(updated).catch(err => console.error('Supabase shiftConfig save error:', err));
                            window.dispatchEvent(new Event('storage'));
                            window.dispatchEvent(new CustomEvent('hl_system_settings_updated'));
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white outline-none focus:border-slate-700 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Vào OT Tối:</label>
                        <input
                          type="time"
                          value={hrmConfig.overtimeIn}
                          onChange={(e) => {
                            const updated = { ...hrmConfig, overtimeIn: e.target.value };
                            setHrmConfig(updated);
                            dbService.shiftConfig.save(updated).catch(err => console.error('Supabase shiftConfig save error:', err));
                            window.dispatchEvent(new Event('storage'));
                            window.dispatchEvent(new CustomEvent('hl_system_settings_updated'));
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white outline-none focus:border-slate-700 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Ra OT Tối:</label>
                        <input
                          type="time"
                          value={hrmConfig.overtimeOut}
                          onChange={(e) => {
                            const updated = { ...hrmConfig, overtimeOut: e.target.value };
                            setHrmConfig(updated);
                            dbService.shiftConfig.save(updated).catch(err => console.error('Supabase shiftConfig save error:', err));
                            window.dispatchEvent(new Event('storage'));
                            window.dispatchEvent(new CustomEvent('hl_system_settings_updated'));
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white outline-none focus:border-slate-700 font-mono"
                        />
                      </div>
                    </div>

                    {/* ───────── THẺ CẤU HÌNH TỪNG CA ───────── */}
                    {[
                      {
                        key: 'morning',
                        label: '☀️ CA SÁNG (Ca 1)',
                        accent: 'text-sky-400 border-sky-500/30',
                        inTime: hrmConfig.morningIn,
                        outTime: hrmConfig.morningOut,
                        openBefore: hrmConfig.punchOpenBeforeMinutes,
                        closeAfter: hrmConfig.punchCloseAfterMinutes,
                        outOpenBefore: hrmConfig.punchOutOpenBeforeMinutes,
                        outCloseAfter: hrmConfig.punchOutCloseAfterMinutes,
                        allowLate: hrmConfig.allowedLateMorning,
                        showLate: true,
                      },
                      {
                        key: 'afternoon',
                        label: '🌇 CA CHIỀU (Ca 2)',
                        accent: 'text-amber-400 border-amber-500/30',
                        inTime: hrmConfig.afternoonIn,
                        outTime: hrmConfig.afternoonOut,
                        openBefore: hrmConfig.punchOpenBeforeMinutes,
                        closeAfter: hrmConfig.punchCloseAfterMinutes,
                        outOpenBefore: hrmConfig.punchOutOpenBeforeMinutes,
                        outCloseAfter: hrmConfig.punchOutCloseAfterMinutes,
                        allowLate: hrmConfig.allowedLateAfternoon,
                        showLate: true,
                      },
                      {
                        key: 'overtime',
                        label: '🌙 TĂNG CA TỐI (OT)',
                        accent: 'text-purple-400 border-purple-500/30',
                        inTime: hrmConfig.overtimeIn,
                        outTime: hrmConfig.overtimeOut,
                        openBefore: hrmConfig.otPunchOpenBeforeMinutes,
                        closeAfter: hrmConfig.otPunchCloseAfterMinutes,
                        outOpenBefore: hrmConfig.otPunchOutOpenBeforeMinutes,
                        outCloseAfter: hrmConfig.otPunchOutCloseAfterMinutes,
                        allowLate: 0,
                        showLate: false,
                      },
                    ].map((shift) => {
                      const inWin = getSlotWindow(shift.inTime || '00:00', Number(shift.openBefore ?? 0), Number(shift.closeAfter ?? 0));
                      const outWin = getSlotWindow(shift.outTime || '00:00', Number(shift.outOpenBefore ?? 0), Number(shift.outCloseAfter ?? 0));
                      // Trường dung sai "Cho phép đi muộn" tách riêng theo ca (migration 036)
                      const lateField: 'allowedLateMorning' | 'allowedLateAfternoon' =
                        shift.key === 'morning' ? 'allowedLateMorning' : 'allowedLateAfternoon';

                      return (
                        <div key={shift.key} className={`bg-slate-900/40 p-4 rounded-xl border ${shift.accent} space-y-4`}>
                          {/* Header ca + timeline trực quan */}
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="text-[11px] font-black uppercase tracking-wider">{shift.label}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              Chuẩn: <span className="text-white">{shift.inTime}</span> → <span className="text-white">{shift.outTime}</span>
                            </div>
                          </div>

                          {/* Timeline minh họa: VÀO mở → VÀO chuẩn → VÀO đóng || RA mở → RA chuẩn → RA đóng */}
                          <div className="bg-slate-950/60 rounded-lg p-3 border border-slate-850">
                            <div className="flex items-center justify-between text-[9px] text-slate-500 mb-1.5 font-mono">
                              <span>🟢 NÚT VÀO</span>
                              <span className="text-emerald-400">Mở {inWin.openStr} · Đóng {inWin.closeStr}</span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-800 relative overflow-hidden">
                              <div className="absolute inset-y-0 left-0 bg-emerald-500/40" style={{ width: '50%' }}></div>
                              <div className="absolute top-1/2 -translate-y-1/2 left-[50%] w-2 h-2 -ml-1 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]"></div>
                            </div>
                            <div className="flex items-center justify-between text-[9px] text-slate-500 mt-3 mb-1.5 font-mono">
                              <span>🔴 NÚT RA</span>
                              <span className="text-rose-400">Mở {outWin.openStr} · Đóng {outWin.closeStr}</span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-800 relative overflow-hidden">
                              <div className="absolute inset-y-0 left-0 bg-rose-500/40" style={{ width: '50%' }}></div>
                              <div className="absolute top-1/2 -translate-y-1/2 left-[50%] w-2 h-2 -ml-1 rounded-full bg-rose-400 shadow-[0_0_6px_#fb7185]"></div>
                            </div>
                          </div>

                          {/* 4 ô nhập phút */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                            <ShiftMinuteInput field={shift.key === 'overtime' ? 'otPunchOpenBeforeMinutes' : 'punchOpenBeforeMinutes'} label="🔓 Mở nút VÀO trước (phút):" value={shift.openBefore} accentBorder="border-sky-900/30" hrmConfig={hrmConfig} setHrmConfig={setHrmConfig} />
                            <ShiftMinuteInput field={shift.key === 'overtime' ? 'otPunchCloseAfterMinutes' : 'punchCloseAfterMinutes'} label="🔒 Tắt nút VÀO sau (phút):" value={shift.closeAfter} accentBorder="border-sky-900/30" hrmConfig={hrmConfig} setHrmConfig={setHrmConfig} />
                            <ShiftMinuteInput field={shift.key === 'overtime' ? 'otPunchOutOpenBeforeMinutes' : 'punchOutOpenBeforeMinutes'} label="🔓 Mở nút RA trước (phút):" value={shift.outOpenBefore} accentBorder="border-rose-900/30" hrmConfig={hrmConfig} setHrmConfig={setHrmConfig} />
                            <ShiftMinuteInput field={shift.key === 'overtime' ? 'otPunchOutCloseAfterMinutes' : 'punchOutCloseAfterMinutes'} label="🔒 Tắt nút RA sau (phút):" value={shift.outCloseAfter} accentBorder="border-rose-900/30" hrmConfig={hrmConfig} setHrmConfig={setHrmConfig} />
                          </div>

                          {/* Cho phép đi muộn (chỉ 2 ca chính) */}
                          {shift.showLate && (
                            <div className="pt-3 border-t border-slate-800/40 space-y-1.5">
                              <div className="text-[11px] text-slate-300 font-medium">
                                <span>⏱️ Cho phép đi muộn (phút):</span>
                              </div>
                              <div className="relative">
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="15"
                                  value={shift.allowLate ?? ''}
                                  onChange={(e) => {
                                    const rawVal = e.target.value;
                                    const val = rawVal === '' ? 15 : Math.max(0, parseInt(rawVal, 10));
                                    const updated = { ...hrmConfig, [lateField]: val };
                                    setHrmConfig(updated);
                                    dbService.shiftConfig.save(updated).catch(err => console.error('Supabase shiftConfig save error:', err));
                                    window.dispatchEvent(new Event('storage'));
                                    window.dispatchEvent(new CustomEvent('hl_system_settings_updated'));
                                  }}
                                  onBlur={() => {
                                    if ((hrmConfig as any)[lateField] === undefined || (hrmConfig as any)[lateField] === null) {
                                      const updated = { ...hrmConfig, [lateField]: 15 };
                                      setHrmConfig(updated);
                                      dbService.shiftConfig.save(updated).catch(err => console.error('Supabase shiftConfig save error:', err));
                                      window.dispatchEvent(new Event('storage'));
                                      window.dispatchEvent(new CustomEvent('hl_system_settings_updated'));
                                    }
                                  }}
                                  className="w-full bg-slate-900/60 border border-slate-800 border-rose-900/30 rounded p-2 text-xs text-white outline-none focus:border-rose-500/50 font-mono pr-12"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-bold pointer-events-none font-mono">phút</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* ───────── BẢNG TỔNG HỢP CỬA SỔ THỰC TẾ ───────── */}
                    <div className="pt-2 border-t border-slate-850">
                      <div className="text-[10px] text-slate-400 font-bold uppercase mb-2 font-mono flex items-center gap-1">
                        📊 TỔNG HỢP CỬA SỔ ĐIỂM DANH THỰC TẾ (tự động tính)
                      </div>
                      <div className="overflow-x-auto rounded-lg border border-slate-850">
                        <table className="w-full text-[10px] font-mono">
                          <thead className="bg-slate-900 text-slate-400 uppercase">
                            <tr>
                              <th className="text-left p-2 font-bold">Nút</th>
                              <th className="text-left p-2 font-bold">Giờ chuẩn</th>
                              <th className="text-left p-2 font-bold text-emerald-400">Mở lúc</th>
                              <th className="text-left p-2 font-bold text-rose-400">Đóng lúc</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850">
                            {[
                              { name: 'VÀO Sáng', t: hrmConfig.morningIn, b: hrmConfig.punchOpenBeforeMinutes, a: hrmConfig.punchCloseAfterMinutes },
                              { name: 'RA Sáng', t: hrmConfig.morningOut, b: hrmConfig.punchOutOpenBeforeMinutes, a: hrmConfig.punchOutCloseAfterMinutes },
                              { name: 'VÀO Chiều', t: hrmConfig.afternoonIn, b: hrmConfig.punchOpenBeforeMinutes, a: hrmConfig.punchCloseAfterMinutes },
                              { name: 'RA Chiều', t: hrmConfig.afternoonOut, b: hrmConfig.punchOutOpenBeforeMinutes, a: hrmConfig.punchOutCloseAfterMinutes },
                              { name: 'VÀO OT', t: hrmConfig.overtimeIn, b: hrmConfig.otPunchOpenBeforeMinutes, a: hrmConfig.otPunchCloseAfterMinutes },
                              { name: 'RA OT', t: hrmConfig.overtimeOut, b: hrmConfig.otPunchOutOpenBeforeMinutes, a: hrmConfig.otPunchOutCloseAfterMinutes },
                            ].map((row) => {
                              const win = getSlotWindow(row.t || '00:00', Number(row.b ?? 0), Number(row.a ?? 0));
                              return (
                                <tr key={row.name} className="bg-slate-950/40 hover:bg-slate-900/60">
                                  <td className="p-2 font-bold text-slate-200">{row.name}</td>
                                  <td className="p-2 text-slate-300">{row.t}</td>
                                  <td className="p-2 text-emerald-400 font-bold">{win.openStr}</td>
                                  <td className="p-2 text-rose-400 font-bold">{win.closeStr}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* ───────── Tự động chấm công (Auto Attendance) ───────── */}
                    <div className="pt-2 border-t border-slate-850">
                      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                        <Calendar className={`w-4 h-4 ${accentTextClass}`} />
                        <h3 className="text-xs font-black text-white uppercase tracking-wider font-mono">
                          TỰ ĐỘNG CHẤM CÔNG (AUTO ATTENDANCE)
                        </h3>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed bg-slate-950/60 border border-slate-850 rounded-lg p-3 mt-3">
                        Hệ thống sẽ tự động tạo các bản ghi chấm công (time-in/time-out) cho nhân viên dựa trên cấu hình ca và số ngày quy định. Điều này hữu ích cho việc chấm công hàng loạt hoặc cho các trường hợp đặc biệt.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                          <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Số ngày tự động chấm công trước ngày hiện tại</label>
                          <input
                            type="number"
                            min="1"
                            max="30"
                            value={hrmConfig.autoAttendanceDays}
                            onChange={(e) => {
                              const updated = { ...hrmConfig, autoAttendanceDays: parseInt(e.target.value) || 7 };
                              setHrmConfig(updated);
                              dbService.shiftConfig.save(updated).catch(err => console.error('Supabase shiftConfig save error:', err));
                              window.dispatchEvent(new Event('storage'));
                              window.dispatchEvent(new CustomEvent('hl_system_settings_updated'));
                            }}
                            className="w-full bg-slate-900 border border-emerald-800 rounded p-1.5 text-xs text-white outline-none focus:border-emerald-700 font-mono"
                          />
                          <p className="text-[9px] text-slate-500 mt-1">Ví dụ: 7 = tự động chấm công cho 7 ngày trước (mặc định)</p>
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Ngày bắt đầu áp dụng tự động chấm công</label>
                          <input
                            type="date"
                            value={(typeof hrmConfig.autoAttendanceStartDate === 'string' ? hrmConfig.autoAttendanceStartDate : (hrmConfig.autoAttendanceStartDate || new Date().toISOString().split('T')[0]))}
                            onChange={(e) => {
                              const updated = { ...hrmConfig, autoAttendanceStartDate: e.target.value };
                              setHrmConfig(updated);
                              dbService.shiftConfig.save(updated).catch(err => console.error('Supabase shiftConfig save error:', err));
                              window.dispatchEvent(new Event('storage'));
                              window.dispatchEvent(new CustomEvent('hl_system_settings_updated'));
                            }}
                            className="w-full bg-slate-900 border border-emerald-800 rounded p-1.5 text-xs text-white outline-none focus:border-emerald-700 font-mono"
                          />
                          <p className="text-[9px] text-slate-500 mt-1">Hệ thống sẽ chỉ tự động chấm công từ ngày này trở đi</p>
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Số lần đi muộn cho phép (trong tháng)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={hrmConfig.allowedLateCount}
                            onChange={(e) => {
                              const updated = { ...hrmConfig, allowedLateCount: parseInt(e.target.value) || 0 };
                              setHrmConfig(updated);
                              dbService.shiftConfig.save(updated).catch(err => console.error('Supabase shiftConfig save error:', err));
                              window.dispatchEvent(new Event('storage'));
                              window.dispatchEvent(new CustomEvent('hl_system_settings_updated'));
                            }}
                            className="w-full bg-slate-900 border border-emerald-800 rounded p-1.5 text-xs text-white outline-none focus:border-emerald-700 font-mono"
                          />
                          <p className="text-[9px] text-slate-500 mt-1">Nếu số ngày đi muộn trong tháng vượt quá giá trị này, hệ thống tự ghi vi phạm "Đi muộn" (crit_A_3) vào bảng Hiệu suất.</p>
                        </div>
                      </div>
                    </div>

                    {/* ───────── NGÀY NGHỈ CUỐI TUẦN ───────── */}
                    <div className="pt-2 border-t border-slate-850">
                      <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1.5 font-mono">
                        📅 Ngày nghỉ cuối tuần được cấu hình:
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { label: 'CN', val: 0 },
                          { label: 'T2', val: 1 },
                          { label: 'T3', val: 2 },
                          { label: 'T4', val: 3 },
                          { label: 'T5', val: 4 },
                          { label: 'T6', val: 5 },
                          { label: 'T7', val: 6 },
                        ].map((day) => {
                          const activeWeekends = hrmConfig.weekendDays || [0];
                          const isSelected = activeWeekends.includes(day.val);
                          return (
                            <button
                              key={day.val}
                              type="button"
                              onClick={() => {
                                let nextWeekends;
                                if (isSelected) {
                                  nextWeekends = activeWeekends.filter((w: number) => w !== day.val);
                                } else {
                                  nextWeekends = [...activeWeekends, day.val];
                                }
                                const updated = { ...hrmConfig, weekendDays: nextWeekends };
                                setHrmConfig(updated);
                                dbService.shiftConfig.save(updated).catch(err => console.error('Supabase shiftConfig save error:', err));
                                window.dispatchEvent(new Event('storage'));
                                window.dispatchEvent(new CustomEvent('hl_system_settings_updated'));
                              }}
                              className={`px-2 py-1 text-[10px] font-bold rounded border transition-all ${
                                isSelected
                                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-400'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850'
                              }`}
                            >
                              {day.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* ───────── NÚT ĐẶT LẠI MẶC ĐỊNH ───────── */}
                    <div className="pt-2 border-t border-slate-850 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          if (!confirm('Đặt lại toàn bộ cấu hình ca về mặc định (15 phút / ca)?')) return;
                          const updated = {
                            ...hrmConfig,
                            morningIn: '07:30', morningOut: '11:30',
                            afternoonIn: '13:00', afternoonOut: '17:00',
                            overtimeIn: '17:45', overtimeOut: '20:45',
                            punchOpenBeforeMinutes: 15, punchCloseAfterMinutes: 15,
                            punchOutOpenBeforeMinutes: 15, punchOutCloseAfterMinutes: 15,
                            otPunchOpenBeforeMinutes: 15, otPunchCloseAfterMinutes: 15,
                            otPunchOutOpenBeforeMinutes: 15, otPunchOutCloseAfterMinutes: 15,
                            allowedLateMinutes: 15,
                            allowedLateCount: 3,
                            allowedLateMorning: 15,
                            allowedLateAfternoon: 15,
                          };
                          setHrmConfig(updated);
                          dbService.shiftConfig.save(updated).catch(err => console.error('Supabase shiftConfig save error:', err));
                          window.dispatchEvent(new Event('storage'));
                          window.dispatchEvent(new CustomEvent('hl_system_settings_updated'));
                          alert('✅ Đã đặt lại cấu hình ca về mặc định.');
                        }}
                        className="px-4 py-2 text-[10px] font-black rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all cursor-pointer"
                      >
                        ↺ ĐẶT LẠI MẶC ĐỊNH
                      </button>
                    </div>
                  </div>

                  <p className="text-[9px] text-slate-550 italic mt-1 leading-normal">
                    * Thay đổi ở đây sẽ tự động cập nhật và khóa/mở các nút điểm danh tương ứng tại trang Tổng quan dựa trên đồng hồ thời gian (giả lập hoặc thực).
                  </p>
                </div>
              )}

              {subSettingsTab === 'supabase' && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg max-w-4xl space-y-6 animate-fadeIn" id="view_supabase_settings_pane">
                  
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                    <Database className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-black text-white uppercase tracking-wider font-mono">
                      ⚡ CẤU HÌNH KẾT NỐI SUPABASE DATABASE (SQL)
                    </h3>
                  </div>

                  {/* Warning and Guidance Banner */}
                  <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-4 text-xs text-slate-300 space-y-2">
                    <p className="font-bold text-emerald-400 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      Tích hợp Hệ Cơ sở dữ liệu Đồng bộ hóa Thời gian Thực (Real-time SQL)
                    </p>
                    <p className="leading-relaxed">
                      Trong tương lai hệ thống sẽ sử dụng song song hệ cơ sở dữ liệu dạng SQL và NoSQL trên Supabase. 
                      Trang cấu hình này cho phép quản trị viên thiết lập kết nối API để đồng bộ dữ liệu doanh nghiệp và các tùy chọn lưu trữ NoSQL (JSONB) một cách dễ dàng.
                    </p>
                    <p className="text-[10px] text-emerald-500 font-medium">
                      * Chỉ tài khoản có quyền Quản trị viên (Admin) hoặc Giám đốc (Director) mới có quyền truy cập, chỉnh sửa và lưu cấu hình này.
                    </p>
                  </div>

                  <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 space-y-5" id="supabase_config_form_card">
                    {/* Input field for Supabase Project URL */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">
                        🔗 SUPABASE PROJECT URL (API URL)
                      </label>
                      <input
                        type="url"
                        placeholder="https://your-project-id.supabase.co"
                        value={supabaseUrlInput}
                        onChange={(e) => setSupabaseUrlInput(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-xs text-white outline-none focus:border-emerald-500/50 font-mono"
                      />
                      <p className="text-[10px] text-slate-500">
                        URL này dùng để gửi các yêu cầu API đến dịch vụ RESTful của Supabase.
                      </p>
                    </div>

                    {/* Input field for Supabase Anon Key */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">
                        🔑 SUPABASE ANON KEY (PUBLIC API KEY)
                      </label>
                      <div className="relative">
                        <input
                          type={showSupabaseKey ? 'text' : 'password'}
                          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                          value={supabaseAnonKeyInput}
                          onChange={(e) => setSupabaseAnonKeyInput(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-xs text-white outline-none focus:border-emerald-500/50 font-mono pr-20"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSupabaseKey(!showSupabaseKey)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-[9px] font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded transition-colors"
                        >
                          {showSupabaseKey ? 'Ẩn' : 'Hiện'}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-500">
                        Khóa công khai (Anon Key) dùng để xác thực các yêu cầu API từ Client tuân thủ Row Level Security (RLS).
                      </p>
                    </div>

                    {/* Connection Test & Action buttons */}
                    <div className="pt-4 border-t border-slate-850 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          disabled={testConnStatus === 'testing'}
                          onClick={async () => {
                            if (!supabaseUrlInput || !supabaseAnonKeyInput) {
                              setTestConnStatus('error');
                              setTestConnError('Vui lòng nhập đầy đủ Project URL và Anon Key trước khi kiểm tra!');
                              return;
                            }
                            setTestConnStatus('testing');
                            setTestConnError('');
                            try {
                              const testClient = createClient(supabaseUrlInput, supabaseAnonKeyInput);
                              
                              const { error } = await testClient.from('employees').select('count', { count: 'exact', head: true });
                              
                              if (error && error.message.includes('FetchError')) {
                                throw new Error(error.message);
                              }
                              
                              setTestConnStatus('success');
                            } catch (err: any) {
                              console.error(err);
                              setTestConnStatus('error');
                              setTestConnError(err?.message || 'Không thể kết nối đến máy chủ Supabase. Vui lòng kiểm tra lại URL và Anon Key.');
                            }
                          }}
                          className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                            testConnStatus === 'testing'
                              ? 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
                              : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850 hover:text-white'
                          }`}
                        >
                          {testConnStatus === 'testing' ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                              Đang kết nối...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                              Kiểm tra kết nối
                            </>
                          )}
                        </button>

                        {testConnStatus === 'success' && (
                          <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold animate-fadeIn">
                            <CheckCircle className="w-4 h-4 shrink-0" />
                            Kết nối thành công!
                          </div>
                        )}

                        {testConnStatus === 'error' && (
                          <div className="flex items-center gap-1.5 text-rose-500 text-xs font-medium max-w-md animate-fadeIn">
                            <ShieldAlert className="w-4 h-4 shrink-0" />
                            <span className="truncate">{testConnError}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSupabaseUrlInput('');
                            setSupabaseAnonKeyInput('');
                            setTestConnStatus('idle');
                            setTestConnError('');
                            localStorage.removeItem('hl_supabase_config');
                            initializeSupabase('', '');
                            alert('Đã xóa cấu hình kết nối tùy biến. Hệ thống sẽ quay về sử dụng các biến môi trường mặc định.');
                          }}
                          className="px-3 py-1.5 rounded text-xs font-bold bg-slate-900 hover:bg-slate-850 text-slate-400 border border-slate-800 transition-colors cursor-pointer"
                        >
                          Xóa Cấu Hình
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            if (!supabaseUrlInput || !supabaseAnonKeyInput) {
                              alert('Vui lòng nhập đầy đủ Project URL và Anon Key!');
                              return;
                            }
                            try {
                              localStorage.setItem('hl_supabase_config', JSON.stringify({
                                url: supabaseUrlInput,
                                anonKey: supabaseAnonKeyInput
                              }));

                              await dbService.quotationConfigs.save('supabase', {
                                url: supabaseUrlInput,
                                anonKey: supabaseAnonKeyInput,
                                updatedAt: new Date().toISOString()
                              });

                              initializeSupabase(supabaseUrlInput, supabaseAnonKeyInput);

                              alert('Đã lưu cấu hình kết nối Supabase thành công lên Cloud Firestore và đồng bộ trên toàn hệ thống!');
                              setTestConnStatus('success');
                            } catch (err: any) {
                              console.error(err);
                              alert('Lưu thất bại: ' + (err?.message || err));
                            }
                          }}
                          className="px-4 py-1.5 rounded text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-colors cursor-pointer"
                        >
                          Lưu Cấu Hình
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Schema mapping table guidance */}
                  <div className="space-y-3">
                    <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                      📋 DANH SÁCH BẢNG DỮ LIỆU ĐÃ CHUẨN HÓA (SCHEMAS)
                    </h4>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Dưới đây là các bảng dữ liệu SQL đã được thiết kế sẵn sàng tương thích 100% trong tệp <code className="text-slate-200 font-mono bg-slate-950 px-1 py-0.5 rounded">supabase_schema.sql</code>. Bạn có thể sao chép để chạy trên Supabase SQL Editor:
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[
                        { name: 'employees', desc: 'Hồ sơ nhân sự, tài khoản đăng nhập, phòng ban & vai trò' },
                        { name: 'customers', desc: 'Thông tin đối tác, khách hàng xây dựng & báo giá' },
                        { name: 'projects', desc: 'Hồ sơ công trình, ngân sách đầu vào & tài liệu đính kèm' },
                        { name: 'tasks', desc: 'Phân công công việc, tiến độ, người thực hiện' },
                        { name: 'receipts', desc: 'Sổ quỹ thu tiền khách hàng, tạm ứng dòng tiền' },
                        { name: 'payments', desc: 'Sổ quỹ chi tiền nhà cung cấp, vật tư, nhân công' },
                        { name: 'quotes', desc: 'Báo giá chi tiết, phân rã vật tư bóc tách tủ bếp & thi công' },
                        { name: 'subcontractor_advances', desc: 'Quản lý tạm ứng & thanh toán tổ đội thi công phụ' },
                        { name: 'supplier_partners', desc: 'Danh sách nhà cung cấp vật liệu, đá, kính, phụ kiện' }
                      ].map((tbl, idx) => (
                        <div key={idx} className="bg-slate-950 p-2.5 rounded-lg border border-slate-900 flex items-start gap-2">
                          <span className="text-[10px] text-emerald-400 font-bold font-mono px-1.5 py-0.5 bg-slate-900 rounded shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="text-xs font-bold text-slate-200 font-mono">{tbl.name}</div>
                            <div className="text-[10px] text-slate-400 leading-tight mt-0.5">{tbl.desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}

            </div>
          )}

          {/* TAB: PHÒNG GIÁM ĐỐC */}
          {activeTab.startsWith('director-') && (
            <DirectorDashboard 
              projects={projects}
              tasks={tasks}
              receipts={receipts}
              payments={payments}
              employees={employees}
              customers={customers}
              currentUser={currentUser}
              activeSubDepartment={directorSubDept}
              onChangeSubDepartment={(sub) => {
                setDirectorSubDept(sub);
                const tabMap: Record<string, string> = {
                  projects: 'director-projects',
                  hr: 'director-hr',
                  accounting: 'director-finance',
                  warehouse: 'director-warehouse',
                  subcontractor: 'director-subcontractor',
                  summary: 'director-summary'
                };
                setActiveTab(tabMap[sub]);
              }}
              onNavigateTab={(tabId) => {
                setActiveTab(tabId);
              }}
              onUpdateTask={handleUpdateTask}
              onApprovePayment={handleApprovePayment}
            />
          )}

          {activeTab === 'messages' && (
            <MessagesView
              currentUser={currentUser!}
              employees={employees}
              tasks={tasks}
              onNavigateTab={(tab) => setActiveTab(tab)}
              initialConversationId={initialConvId ?? undefined}
              showBadgeCounts={showBadgeCounts}
              onToggleBadgeCounts={(next) => {
                setShowBadgeCounts(next);
                localStorage.setItem('hl_show_badge_counts', next ? 'true' : 'false');
              }}
            />
          )}

          </>
          )}

        </main>
      </div>

      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        currentUser={currentUser}
        onUpdateProfile={handleUpdateProfile}
        accentTextClass={accentTextClass}
        accentBgClass={accentBgClass}
      />

      {/* FLOATING TOAST NOTIFICATIONS */}
      <div className="fixed bottom-5 right-5 z-[10000] flex flex-col gap-3.5 max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 35, scale: 0.88 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -25, scale: 0.88, transition: { duration: 0.25 } }}
              className="pointer-events-auto bg-slate-900/95 border border-slate-800/90 backdrop-blur-md rounded-2xl p-4 shadow-[0_12px_32px_rgba(0,0,0,0.55)] flex gap-3.5 items-start justify-between relative overflow-hidden group select-none transition-all duration-300"
            >
              {/* Colored left bar */}
              <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${
                t.type === 'success' ? 'bg-emerald-500' :
                t.type === 'error' ? 'bg-rose-500' :
                t.type === 'warning' ? 'bg-amber-500' : 'bg-sky-500'
              }`} />

              <div className="flex gap-3 pl-1.5">
                {t.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : t.type === 'error' ? (
                  <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                ) : t.type === 'warning' ? (
                  <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <Bell className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                )}

                <div className="flex-1">
                  <h4 className="text-white font-extrabold text-[12.5px] tracking-wide leading-tight mb-1">
                    {t.title}
                  </h4>
                  <p className="text-slate-350 text-[11px] leading-relaxed">
                    {t.message}
                  </p>
                </div>
              </div>

              <button
                onClick={() => removeToast(t.id)}
                className="text-slate-500 hover:text-slate-300 rounded-lg p-1.5 cursor-pointer hover:bg-slate-800/60 transition-colors"
                type="button"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

        </div>
      </NotificationProvider>
    </AuthProvider>
  );
} // Close AppContent function
