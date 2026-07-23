import React, { useState, useEffect } from 'react';
import { dbService } from './lib/dbService';
import { getSupabase } from './lib/supabase';
import { useWebPush } from './hooks/useWebPush';
import { createGroupConversation, deleteConversation, getUserConversations, getConversations } from './lib/chatStore';
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
  AppNotification,
  Conversation
} from './types';
import {
  INITIAL_EMPLOYEES,
  HRM_26_EMPLOYEES,
  INITIAL_CUSTOMERS,
  INITIAL_PROJECTS,
  INITIAL_TASKS,
  INITIAL_RECEIPTS,
  INITIAL_PAYMENTS,
  INITIAL_QUOTES,
  DEFAULT_QUOTE_CONFIG
} from './data';

// CONTEXT PROVIDERS (required by child components)
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { isUserInRoleGroup } from './context';
import { hashPasswordSync, verifyPasswordSync } from './lib/passwordUtils';

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
import SubcontractorManagement from './components/SubcontractorManagement';
import DirectorDashboard from './components/DirectorDashboard';
import Login from './components/Login';
import UserProfileModal from './components/UserProfileModal';
import MessagesView from './components/MessagesView';

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
  UserPlus,
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
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getSupabase, initializeSupabase } from './lib/supabase';
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
    // 1. Đọc từ cache của dbService trước (từ Supabase)
    const cached = localStorage.getItem('hl_cached_hrm_role_groups');
    let hrmRoles: any[] = [];
    if (cached) {
      hrmRoles = JSON.parse(cached);
    }
    // 2. Nếu không có cache, fallback sang localStorage cũ
    if (!Array.isArray(hrmRoles) || hrmRoles.length === 0) {
      const rolesSaved = localStorage.getItem('hl_hrm_roles_v2');
      hrmRoles = rolesSaved ? JSON.parse(rolesSaved) : [];
    }

    if (Array.isArray(hrmRoles)) {
      const foundRole = hrmRoles.find((r: any) => r.memberIds && r.memberIds.includes(emp.id));
      if (foundRole) return foundRole.name;
    }

    // 3. Try mapping from old role field
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
    // 1. Đọc từ cache của dbService trước
    const supCached = localStorage.getItem('hl_cached_hrm_role_groups');
    let groups: any[] = [];
    if (supCached) {
      groups = JSON.parse(supCached);
    }
    // 2. Fallback sang localStorage cũ
    if (!Array.isArray(groups) || groups.length === 0) {
      const saved = localStorage.getItem('hl_hrm_roles_v2');
      groups = saved ? JSON.parse(saved) : [];
    }
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
    console.error('Lỗi đọc phân quyền từ hl_hrm_roles_v2:', e);
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
  password: 'admin'
};

const ensureAdminAndPasswords = (emps: Employee[]): Employee[] => {
  const mapped: Employee[] = emps.map(emp => {
    if (emp.username === 'admin' || emp.id === 'emp_admin') {
      return {
        ...emp,
        username: 'admin',
        password: 'admin',
        role: 'director' as const
      };
    }
    return {
      ...emp,
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

  // Fallback: đọc từ localStorage
  try {
    const saved = localStorage.getItem('hl_hrm_roles_v2');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.map((r: any) => ({ id: r.id, name: r.name }));
      }
    }
  } catch {}
  return [
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
    dbService.shiftConfig.save(updated).catch(e => console.error('Supabase shiftConfig save error:', e));
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

export default function App() {
  // 1. Cấu hình Phân quyền từng vai trò
  const [toasts, setToasts] = useState<any[]>([]);

  const addToast = (toast: { title: string; message: string; type?: 'success' | 'info' | 'warning' | 'error'; duration?: number }) => {
    const id = `${Date.now()}_${Math.random()}`;
    const duration = toast.duration === undefined ? 5000 : toast.duration;
    setToasts(prev => [...prev, { ...toast, id, duration }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>(() => {
    const saved = localStorage.getItem('hl_role_permissions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const healed: Record<string, string[]> = {};
        for (const role in parsed) {
          if (Array.isArray(parsed[role])) {
            const arr = parsed[role].map((item: string) => item.replace(/_/g, '-'));
            // Đảm bảo mọi role đều có quyền truy cập Tin Nhắn
            if (!arr.includes('messages')) arr.push('messages');
            healed[role] = arr;
          } else {
            healed[role] = parsed[role];
          }
        }
        return healed;
      } catch (e) {
        console.error(e);
      }
    }
    return {
      director: [
        'dashboard', 'director-office', 'director-dashboard',
        'project-office', 'projects-construction', 'projects-furniture', 'projects-mechanical', 'tasks', 'messages',
        'hr-office', 'employees', 'hr-data',
        'accounting-office', 'finance', 'finance-data',
        'warehouse-office', 'material-coordination', 'warehouse-suppliers', 'warehouse-management',
        'subcontractor-office', 'subcontractor-management',
        'library-office', 'quotes-construction', 'quotes', 'quotes-mechanical', 'quotes-subcontractor',
        'system-office', 'settings-accounts', 'settings-roles', 'settings'
      ],
      accountant: [
        'dashboard',
        'project-office', 'projects-construction', 'projects-furniture', 'projects-mechanical', 'tasks', 'messages',
        'hr-office', 'employees',
        'accounting-office', 'finance', 'finance-data',
        'warehouse-office', 'material-coordination', 'warehouse-suppliers', 'warehouse-management',
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
        'warehouse-office', 'material-coordination', 'warehouse-suppliers'
      ],
      factory: [
        'dashboard', 'tasks', 'employees', 'settings', 'messages',
        'project-office', 'projects-furniture'
      ]
    };
  });

  useEffect(() => {
    localStorage.setItem('hl_role_permissions', JSON.stringify(rolePermissions));
  }, [rolePermissions]);

  // 2. Cấu hình Hiển thị (Màu chủ đạo, Slogan, Tên nhãn hiệu, Giao diện, Font chữ)
  const [displaySettings, setDisplaySettings] = useState(() => {
    const saved = localStorage.getItem('hl_display_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          primaryAccent: 'emerald',
          logoText: 'HL',
          brandName: 'Hoàng Long',
          brandSlogan: 'Lâm Đồng ERP',
          dashboardTitle: 'Hệ Thống Chỉ Số Doanh Nghiệp',
          motivationQuote: '"May mắn đứng về phía người dám đương đầu."',
          fontFamily: 'Inter',
          ...parsed
        };
      } catch (e) {
        // Fallback
      }
    }
    return {
      primaryAccent: 'emerald', // emerald, sky, indigo, amber, rose, violet
      logoText: 'HL',
      brandName: 'Hoàng Long',
      brandSlogan: 'Lâm Đồng ERP',
      dashboardTitle: 'Hệ Thống Chỉ Số Doanh Nghiệp',
      motivationQuote: '"May mắn đứng về phía người dám đương đầu."',
      fontFamily: 'Inter' // Inter, Roboto, Be Vietnam Pro, Nunito, Lora, Fira Sans
    };
  });

  useEffect(() => {
    localStorage.setItem('hl_display_settings', JSON.stringify(displaySettings));
  }, [displaySettings]);

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

  // 3. Hồ sơ doanh nghiệp
  const [businessInfo, setBusinessInfo] = useState(() => {
    const saved = localStorage.getItem('hl_business_info');
    if (saved) return JSON.parse(saved);
    return {
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
    };
  });

  useEffect(() => {
    localStorage.setItem('hl_business_info', JSON.stringify(businessInfo));
    dbService.businessProfile.save(businessInfo);
  }, [businessInfo]);

  // Bootstrap và đồng bộ hoá dữ liệu từ Cloud Firestore trên nền tảng Firebase
  useEffect(() => {
    const initAndSync = async () => {
      try {
        await dbService.bootstrapFirstTime();

        // Cloud (Supabase) là nguồn sự thật duy nhất. KHÔNG đọc localStorage làm chuẩn
        // để tránh "hồi sinh" dữ liệu đã xóa trực tiếp trên Supabase khi reload ứng dụng.
        const cloudEmps = await dbService.employees.list();
        const finalEmps = ensureAdminAndPasswords(cloudEmps);
        setEmployees(finalEmps);
        // Đồng bộ ngược cache localStorage cho khớp cloud (chỉ là bản sao, không ghi đè lên cloud)
        localStorage.setItem('hl_erp_employees', JSON.stringify(finalEmps));

        // Ensure admin is saved to db as well
        const hasAdminInDb = finalEmps.some(e => e.username === 'admin' || e.id === 'emp_admin');
        if (!hasAdminInDb) {
          dbService.employees.save(ADMIN_EMPLOYEE).catch(err => console.error("Error saving admin employee:", err));
        }
        // Cập nhật thông tin tài khoản hiện tại từ database vừa tải nếu đã đăng nhập trước đó
        const activeSessionStr = sessionStorage.getItem('hl_erp_active_session') || localStorage.getItem('hl_erp_active_session');
        if (activeSessionStr) {
          try {
            const parsedSession = JSON.parse(activeSessionStr);
            const foundUser = finalEmps.find(e => e.id === parsedSession.id || e.username === parsedSession.username);
            if (foundUser) {
              setCurrentUser(foundUser);
              sessionStorage.setItem('hl_erp_active_session', JSON.stringify(foundUser));
              if (localStorage.getItem('hl_erp_active_session')) {
                localStorage.setItem('hl_erp_active_session', JSON.stringify(foundUser));
              }
            } else {
              setCurrentUser(parsedSession);
            }
          } catch (e) {
            setCurrentUser(null);
          }
        } else {
          setCurrentUser(null);
        }

        const custs = await dbService.customers.list();
        setCustomers(custs);

        const projs = await dbService.projects.list();
        const filteredProjs = projs.filter(p => !p.name.startsWith('Dự án độc lập - ') || !p.notes?.includes('Tạo dự án tự động từ báo giá hoàn tất'));
        const autoProjIds = projs.filter(p => p.name.startsWith('Dự án độc lập - ') && p.notes?.includes('Tạo dự án tự động từ báo giá hoàn tất')).map(p => p.id);
        for (const pid of autoProjIds) {
          dbService.projects.delete(pid).catch(err => console.error("Could not delete legacy auto project", err));
        }
        setProjects(filteredProjs);

        const tsks = await dbService.tasks.list();
        setTasks(tsks);

        const recs = await dbService.receipts.list();
        setReceipts(recs);

        const pays = await dbService.payments.list();
        const pendingPays = pays.filter(p => p.status === 'pending');
        if (pendingPays.length > 0) {
          const cleanedPays = pays.filter(p => p.status !== 'pending');
          setPayments(cleanedPays);
          for (const p of pendingPays) {
            dbService.payments.delete(p.id).catch(err => console.error("Lỗi xóa đồng bộ payment chờ duyệt:", err));
          }
        } else {
          setPayments(pays);
        }

        const qtes = await dbService.quotes.list();
        setQuotes(qtes);

        // Đồng bộ hồ sơ doanh nghiệp từ Supabase
        const cloudProfile = await dbService.businessProfile.get();
        if (cloudProfile) {
          setBusinessInfo(cloudProfile);
          localStorage.setItem('hl_business_info', JSON.stringify(cloudProfile));
        } else {
          // Chưa có trên cloud → push dữ liệu local lên Supabase
          const localProfile = localStorage.getItem('hl_business_info');
          if (localProfile) {
            const parsed = JSON.parse(localProfile);
            await dbService.businessProfile.save(parsed);
          }
        }

        // Đồng bộ cấu hình ca từ Supabase
        const cloudShiftConfig = await dbService.shiftConfig.get();
        if (cloudShiftConfig) {
          setHrmConfig(cloudShiftConfig);
        }

        // displaySettings chỉ lưu localStorage (cá nhân hóa - màu sắc, font chữ)
      } catch (err) {
        console.warn("Lỗi kết nối đồng bộ cơ sở dữ liệu Firebase Firestore:", err);
      }
    };
    initAndSync();
  }, []);

  // Khối Dữ Liệu Nhân Viên - Khởi tạo rỗng, sẽ nạp từ Supabase trong useEffect
  const [employees, setEmployees] = useState<Employee[]>(() => {
    // Trả về mảng rỗng - dữ liệu sẽ được nạp từ Supabase trong useEffect
    return [];
  });

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('hl_erp_employees', JSON.stringify(employees));
  }, [employees]);

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

  // Web Push notification registration (using Supabase Realtime)
  useWebPush(currentUser?.id ?? null);

  const [activeTab, setActiveTab ] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [activeTab]);

  const handleSync26Accounts = async () => {
    // Bước 1: Tính toán danh sách mới (chỉ update state, không save cloud ở đây)
    const merged = [...employees];
    let addedCount = 0;
    let updatedCount = 0;
    const toSave: Employee[] = [];

    HRM_26_EMPLOYEES.forEach(newEmp => {
      const formattedUsername = generateUsernameWithPhone(newEmp.name, newEmp.phone);
      const existingIndex = merged.findIndex(e => e.id === newEmp.id);

      if (existingIndex >= 0) {
        const existing = merged[existingIndex];
        if (existing.username !== formattedUsername || !verifyPasswordSync('123', existing.password || '')) {
          merged[existingIndex] = {
            ...existing,
            username: formattedUsername,
            password: hashPasswordSync('123')
          };
          updatedCount++;
          toSave.push(merged[existingIndex]);
        }
      } else {
        const processedEmp = {
          ...newEmp,
          username: formattedUsername,
          password: hashPasswordSync('123')
        };
        merged.push(processedEmp);
        addedCount++;
        toSave.push(processedEmp);
      }
    });

    setEmployees(merged);
    localStorage.setItem('hl_erp_employees', JSON.stringify(merged));

    // Bước 2: Đồng bộ lên cloud (await tất cả, bắt lỗi cụ thể)
    let saveErrors = 0;
    await Promise.allSettled(
      toSave.map(emp =>
        dbService.employees.save(emp).catch(err => {
          saveErrors++;
          console.error("❌ Lỗi lưu tài khoản lên cloud:", emp.id, emp.username, err);
        })
      )
    );

    if (saveErrors > 0) {
      alert(`🎉 Đã tạo tài khoản từ nhân sự thành công!\n- Tạo mới: ${addedCount} tài khoản\n- Cập nhật: ${updatedCount} tài khoản.\nMật khẩu mặc định: 123.\n\n⚠️ Cảnh báo: ${saveErrors} tài khoản chưa đồng bộ lên cloud (kiểm tra kết nối mạng). Dữ liệu cục bộ vẫn được lưu an toàn.`);
    } else {
      alert(`🎉 Đã tạo tài khoản từ nhân sự thành công!\n- Tạo mới: ${addedCount} tài khoản\n- Cập nhật: ${updatedCount} tài khoản.\nMật khẩu mặc định: 123.\n✅ Đã đồng bộ lên cloud thành công.`);
    }
  };

  const [financeSubTab, setFinanceSubTab] = useState<string>('de_xuat_thu_chi');
  const [hrSubTab, setHrSubTab] = useState<string>('profiles');
  const [financeDuLieuTab, setFinanceDuLieuTab] = useState<string>('khach_hang');
  const [preselectedCustomerId, setPreselectedCustomerId] = useState<string>('');
  const [preselectedProjectId, setPreselectedProjectId] = useState<string>('');

  // Thu gọn sidebar & hệ thống thông báo tin nhắn mới
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('hl_erp_sidebar_collapsed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('hl_erp_sidebar_collapsed', sidebarCollapsed ? 'true' : 'false');
  }, [sidebarCollapsed]);

  const [showNotificationsPanel, setShowNotificationsPanel] = useState<boolean>(false);
  // Đóng popup Thông báo & Tin nhắn khi click ra ngoài cửa sổ
  useEffect(() => {
    if (!showNotificationsPanel) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('#notification_bell_root')) return;
      setShowNotificationsPanel(false);
    };
    // Dùng capture để bắt event trước khi các handler khác chạy
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [showNotificationsPanel]);

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
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'unread' | 'tasks' | 'finance' | 'employees_attendance' | 'chat'>('all');
  // Tab phân hệ Messenger được mở từ lối tắt chuông thông báo
  const [messengerInitialTab, setMessengerInitialTab] = useState<'all' | 'personal' | 'group' | 'notifications'>('all');
  // Bộ lọc trong popover Thông báo & Tin nhắn (4 tab)
  const [popoverFilter, setPopoverFilter] = useState<'all' | 'personal' | 'group' | 'notifications'>('all');
  // Hội thoại cần mở khi điều hướng vào Messenger
  const [initialConvId, setInitialConvId] = useState<string | null>(null);
  // Thông báo cần mở chi tiết khi điều hướng vào Messenger
  const [initialNotificationId, setInitialNotificationId] = useState<string | null>(null);
  // Sau khi MessagesView đã nhận initialConvId / initialNotificationId, reset để lần click sau vẫn kích hoạt lại
  useEffect(() => {
    if (initialConvId) {
      const t = setTimeout(() => setInitialConvId(null), 300);
      return () => clearTimeout(t);
    }
  }, [initialConvId]);
  useEffect(() => {
    if (initialNotificationId) {
      const t = setTimeout(() => setInitialNotificationId(null), 300);
      return () => clearTimeout(t);
    }
  }, [initialNotificationId]);
  // Hiển thị badge đếm số chưa đọc trên tab
  const [showBadgeCounts, setShowBadgeCounts] = useState<boolean>(() => localStorage.getItem('hl_show_badge_counts') !== 'false');

  // Deep-link từ FCM push notification: /messages?conversation=xxx
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const convId = params.get('conversation');
    if (convId) {
      setInitialConvId(convId);
      setActiveTab('messages');
      // Xoá query param khỏi URL để không mở lại khi reload
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    }
  }, []);
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    // Trả về mảng rỗng - dữ liệu thông báo sẽ được nạp từ Supabase trong useEffect
    return [];
  });

  // Load notifications from Supabase on mount
  useEffect(() => {
    let mounted = true;
    dbService.notifications.list()
      .then(list => {
        if (mounted && Array.isArray(list) && list.length > 0) {
          const sorted = [...list].sort((a, b) =>
            (b.createdAt || '').localeCompare(a.createdAt || ''));
          setNotifications(sorted as AppNotification[]);
        }
      })
      .catch(err => console.warn('Lỗi khi tải thông báo từ Supabase:', err));
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    localStorage.setItem('hl_erp_notifications', JSON.stringify(notifications));
  }, [notifications]);

  const addNotification = (notif: Partial<AppNotification>) => {
    const randomNum = Math.floor(100 + Math.random() * 900);
    const id = notif.id || `MSG-${Date.now()}-${randomNum}`;
    const recipientId = notif.recipientId || 'emp_1';
    const recipient = employees.find(e => e.id === recipientId) || currentUser;

    if (!recipient) return;

    const newNotif: AppNotification = {
      id,
      recipientId: recipient.id,
      recipientName: recipient.name,
      department: recipient.department || 'Phòng Ban',
      content: notif.content || 'Thông báo mới từ hệ thống.',
      subTaskCode: notif.subTaskCode || 'CV-GEN',
      createdAt: notif.createdAt || new Date().toISOString(),
      read: false,
      senderId: notif.senderId || 'system',
      senderName: notif.senderName || 'Hệ Thống',
      senderAvatar: notif.senderAvatar || 'HT',
      category: notif.category || 'tasks',
      title: notif.title || 'Thông báo hệ thống',
      detailedContent: notif.detailedContent || notif.content || 'Nội dung chi tiết thông báo hệ thống.',
      conversationId: notif.conversationId,
      taskId: notif.taskId
    };

    setNotifications(prev => {
      // Chống trùng lặp: bỏ qua nếu đã có thông báo giống hệt (cùng người nhận, tiêu đề, nội dung)
      // được tạo trong vòng 5 giây gần đây
      const isDuplicate = prev.some(n =>
        n.recipientId === newNotif.recipientId &&
        n.title === newNotif.title &&
        n.content === newNotif.content &&
        Math.abs(new Date(n.createdAt).getTime() - new Date(newNotif.createdAt).getTime()) < 5000
      );
      if (isDuplicate) return prev;
      return [newNotif, ...prev];
    });

    addToast({
      title: `🔔 ${newNotif.title}`,
      message: newNotif.content,
      type: 'info'
    });

    // Persist to Supabase (non-blocking)
    dbService.notifications.save(newNotif).catch(err =>
      console.warn('Lỗi khi lưu thông báo lên Supabase:', err));
  };

  useEffect(() => {
    const handleDispatchNotification = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        addNotification(customEvent.detail);
      }
    };
    window.addEventListener('hl-dispatch-notification', handleDispatchNotification);
    return () => window.removeEventListener('hl-dispatch-notification', handleDispatchNotification);
  }, [employees, currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const checkAttendanceTimeAndNotify = () => {
      const now = new Date();
      const day = now.getDay(); // 0: Sunday, 6: Saturday
      if (day === 0) return; // Do not notify on Sundays (rest day)

      // Kiểm tra nghỉ lễ cố định Việt Nam (01/01, 30/04, 01/05, 02/09)
      const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`;
      const holidays = ['01/01', '30/04', '01/05', '02/09'];
      if (holidays.includes(dateStr)) return; // Không thông báo điểm danh ngày nghỉ lễ

      const hours = now.getHours();
      const minutes = now.getMinutes();

      // Ca sáng: 7:00 - 7:30
      if (hours === 7 && minutes >= 0 && minutes <= 30) {
        const key = `attendance_morning_notified_${now.toDateString()}`;
        if (!localStorage.getItem(key)) {
          addNotification({
            category: 'attendance',
            title: '⏰ Điểm danh Ca Sáng',
            content: 'Sắp đến ca làm việc sáng (07:30). Hãy điểm danh vân tay/khuôn mặt ngay!',
            detailedContent: 'Ca làm việc chính thức: Sáng 07:30 - 11:30.\nThời gian bắt đầu điểm danh vào ca: 07:00.\nHãy thực hiện điểm danh sinh trắc học trên hệ thống ERP để ghi nhận công chuẩn.',
            senderName: 'Phòng Hành Chính Nhân Sự',
            senderAvatar: 'NS',
            recipientId: currentUser.id
          });
          localStorage.setItem(key, 'true');
        }
      }

      // Ca chiều: 12:30 - 13:00 (13:00)
      if ((hours === 12 && minutes >= 30) || (hours === 13 && minutes === 0)) {
        const key = `attendance_afternoon_notified_${now.toDateString()}`;
        if (!localStorage.getItem(key)) {
          addNotification({
            category: 'attendance',
            title: '⏰ Điểm danh Ca Chiều',
            content: 'Sắp đến ca làm việc chiều (13:00). Hãy điểm danh vân tay/khuôn mặt!',
            detailedContent: 'Ca làm việc chính thức: Chiều 13:00 - 17:00.\nThời gian bắt đầu điểm danh vào ca: 12:30.\nHãy thực hiện điểm danh để không bị ghi nhận đi muộn.',
            senderName: 'Phòng Hành Chính Nhân Sự',
            senderAvatar: 'NS',
            recipientId: currentUser.id
          });
          localStorage.setItem(key, 'true');
        }
      }
    };

    checkAttendanceTimeAndNotify();
    const interval = setInterval(checkAttendanceTimeAndNotify, 60000);
    return () => clearInterval(interval);
  }, [currentUser, employees]);

  // Trạng thái cây thư mục Sidebar dạng mô phỏng
  const [isDirectorGroupExpanded, setIsDirectorGroupExpanded] = useState(true);
  const [directorSubDept, setDirectorSubDept] = useState<'projects' | 'hr' | 'accounting' | 'warehouse' | 'subcontractor'>('projects');
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
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);

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
            sessionStorage.setItem('hl_erp_active_session', JSON.stringify(foundUser));
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

  const [hrmConfig, setHrmConfig] = useState(() => ({
    morningIn: '07:30',
    morningOut: '11:30',
    afternoonIn: '13:00',
    afternoonOut: '17:00',
    overtimeIn: '17:45',
    overtimeOut: '20:45',
    gpsRadiusAllowed: 50,
    antiFakeCam: true,
    punchOpenBeforeMinutes: 15,
    punchCloseAfterMinutes: 15,
    punchOutOpenBeforeMinutes: 15,
    punchOutCloseAfterMinutes: 15,
    otPunchOpenBeforeMinutes: 15,
    otPunchCloseAfterMinutes: 15,
    otPunchOutOpenBeforeMinutes: 15,
    otPunchOutCloseAfterMinutes: 15,
    allowedLateMinutes: 15,
    weekendDays: [0] as number[],
  }));

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

  // Thêm người dùng mới
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpEmail, setNewEmpEmail] = useState('');
  const [newEmpPhone, setNewEmpPhone] = useState('');
  const [newEmpDept, setNewEmpDept] = useState('Phòng Dự Án - Xây Dựng');
  const [newEmpRole, setNewEmpRole] = useState<string>('engineer');
  const [newEmpUsername, setNewEmpUsername] = useState('');
  const [newEmpPassword, setNewEmpPassword] = useState('123');
  const [newEmpRoleGroupId, setNewEmpRoleGroupId] = useState<string>('role_office');

  // Đọc danh sách Role Groups từ localStorage hoặc Supabase cache để render dropdown
  const readHrmRoleGroups = (): { id: string; name: string }[] => {
    try {
      // Ưu tiên cache từ Supabase
      const supCached = localStorage.getItem('hl_cached_hrm_role_groups');
      if (supCached) {
        const parsed = JSON.parse(supCached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((r: any) => ({ id: r.id, name: r.name }));
        }
      }
      // Fallback
      const saved = localStorage.getItem('hl_hrm_roles_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((r: any) => ({ id: r.id, name: r.name }));
        }
      }
    } catch {}
    return [
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
  const [editLogoText, setEditLogoText] = useState(displaySettings.logoText);
  const [editBrandName, setEditBrandName] = useState(displaySettings.brandName);
  const [editBrandSlogan, setEditBrandSlogan] = useState(displaySettings.brandSlogan);
  const [editDashboardTitle, setEditDashboardTitle] = useState(displaySettings.dashboardTitle);
  const [editMotivationQuote, setEditMotivationQuote] = useState(displaySettings.motivationQuote);

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

  useEffect(() => {
    setEditLogoText(displaySettings.logoText);
    setEditBrandName(displaySettings.brandName);
    setEditBrandSlogan(displaySettings.brandSlogan);
    setEditDashboardTitle(displaySettings.dashboardTitle);
    setEditMotivationQuote(displaySettings.motivationQuote);
  }, [displaySettings]);

  useEffect(() => {
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
          const { tab, projectId, customerId, financeSubTab, financeDuLieuTab } = customEv.detail;
          if (tab) setActiveTab(tab);
          if (projectId) setPreselectedProjectId(projectId);
          if (customerId) setPreselectedCustomerId(customerId);
          if (financeSubTab) setFinanceSubTab(financeSubTab);
          if (financeDuLieuTab) setFinanceDuLieuTab(financeDuLieuTab);
        }
      }
    };
    window.addEventListener('hl-switch-tab', handleSwitch);
    return () => window.removeEventListener('hl-switch-tab', handleSwitch);
  }, []);

  // Sync projects from Supabase when updated elsewhere
  useEffect(() => {
    const handleProjectsUpdated = async () => {
      try {
        const projs = await dbService.projects.list();
        const filteredProjs = projs.filter(p => !p.name.startsWith('Dự án độc lập - ') || !p.notes?.includes('Tạo dự án tự động từ báo giá hoàn tất'));
        setProjects(filteredProjs);
      } catch (err) {
        console.error("Lỗi đồng bộ dự án:", err);
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
        setTasks(tsks);
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

  // ─── Supabase Realtime: lắng nghe thay đổi projects, tasks, payments, customers, quotes, receipts, suppliers, inventory, subcontractorAdvances ───
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;

    const fetchProjects = async () => {
      try {
        const projs = await dbService.projects.list();
        setProjects(projs.filter(p => !p.name.startsWith('Dự án độc lập - ') || !p.notes?.includes('Tạo dự án tự động từ báo giá hoàn tất')));
      } catch (e) { console.error('Realtime projects sync error:', e); }
    };
    const fetchTasks = async () => {
      try { setTasks(await dbService.tasks.list()); } catch (e) { console.error('Realtime tasks sync error:', e); }
    };
    const fetchPayments = async () => {
      try { setPayments(await dbService.payments.list()); } catch (e) { console.error('Realtime payments sync error:', e); }
    };
    const fetchCustomers = async () => {
      try { setCustomers(await dbService.customers.list()); } catch (e) { console.error('Realtime customers sync error:', e); }
    };
    const fetchQuotes = async () => {
      try { setQuotes(await dbService.quotes.list()); } catch (e) { console.error('Realtime quotes sync error:', e); }
    };
    const fetchReceipts = async () => {
      try { setReceipts(await dbService.receipts.list()); } catch (e) { console.error('Realtime receipts sync error:', e); }
    };
    const fireSuppliersEvent = () => {
      try { window.dispatchEvent(new CustomEvent('hl-suppliers-updated')); } catch {}
    };
    const fireInventoryEvent = () => {
      try { window.dispatchEvent(new CustomEvent('hl-inventory-updated')); } catch {}
    };
    const fireAdvancesEvent = () => {
      try { window.dispatchEvent(new CustomEvent('hl-subcontractor-advances-updated')); } catch {}
    };
    const fireLogsEvent = () => {
      try { window.dispatchEvent(new CustomEvent('hl-warehouse-logs-updated')); } catch {}
    };
    const fireArchivedQuotesEvent = () => {
      try {
        window.dispatchEvent(new CustomEvent('hl-archived-quotes-updated'));
        window.dispatchEvent(new CustomEvent('hl-archived-subcontractor-quotes-updated'));
      } catch {}
    };

    // Realtime cho employees & hrm_role_groups (Quản Lý Tài Khoản)
    const fetchEmployees = async () => {
      try {
        const emps = await dbService.employees.list();
        setEmployees(emps);
      } catch (e) { console.error('Realtime employees sync error:', e); }
    };
    const fireHrmRoleGroupsEvent = () => {
      try {
        window.dispatchEvent(new CustomEvent('hl-task-permissions-updated'));
      } catch {}
    };

    // Realtime cho Cài Đặt Hệ Thống (business_profile, shift_config)
    const fetchBusinessProfile = async () => {
      try {
        const profile = await dbService.businessProfile.get();
        if (profile) {
          setBusinessInfo(profile);
          localStorage.setItem('hl_business_info', JSON.stringify(profile));
        }
      } catch (e) { console.error('Realtime business_profile sync error:', e); }
    };
    const fetchShiftConfig = async () => {
      try {
        const config = await dbService.shiftConfig.get();
        if (config) {
          setHrmConfig(config);
        }
      } catch (e) { console.error('Realtime shift_config sync error:', e); }
    };

    const channel = sb
      .channel('app-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, fetchProjects)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchTasks)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, fetchPayments)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, fetchCustomers)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, fetchQuotes)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'receipts' }, fetchReceipts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, fireSuppliersEvent)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, fireInventoryEvent)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subcontractor_advances' }, fireAdvancesEvent)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warehouse_logs' }, fireLogsEvent)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'archived_quotes' }, fireArchivedQuotesEvent)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, fetchEmployees)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hrm_role_groups' }, fireHrmRoleGroupsEvent)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_profile' }, fetchBusinessProfile)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_config' }, fetchShiftConfig)
      .subscribe();

    return () => { sb.removeChannel(channel); };
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
          setHrmRoleGroups(cloudRoles.map((r: any) => ({ id: r.id, name: r.name })));
          // Cập nhật cache localStorage để các component khác dùng
          const updated = JSON.stringify(cloudRoles);
          localStorage.setItem('hl_cached_hrm_role_groups', updated);
          localStorage.setItem('hl_hrm_roles_v2', updated);
        }
      } catch {
        // Fallback về localStorage nếu Supabase lỗi
        setHrmRoleGroups(readHrmRoleGroups());
      }
    };
    const handleEmployeesUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setEmployees(prev => customEvent.detail.employees || customEvent.detail);
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
        username: loggedInUser.username || generateUsername(loggedInUser.name),
        password: loggedInUser.password || hashPasswordSync('123')
      };
      localStorage.setItem('hl_erp_remembered_credentials', JSON.stringify(creds));
    } else {
      localStorage.removeItem('hl_erp_remembered_credentials');
    }

    if (autoLogin) {
      localStorage.setItem('hl_erp_active_session', JSON.stringify(loggedInUser));
    } else {
      localStorage.removeItem('hl_erp_active_session');
    }
    
    sessionStorage.setItem('hl_erp_active_session', JSON.stringify(loggedInUser));
    
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
  const handleAddProject = (newProj: Project) => {
    setProjects([newProj, ...projects]);
    dbService.projects.save(newProj);
    
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

  const handleUpdateProject = (id: string, updates: Partial<Project>) => {
    setProjects(prevProjects => {
      const updated = prevProjects.map(p => {
        if (p.id === id) {
          const finalStatus = updates.status !== undefined ? updates.status : p.status;
          const finalProgress = updates.progress !== undefined ? updates.progress : p.progress;
          const isCompleted = (finalStatus === 'completed') || (finalProgress === 100);
          const nextp = {
            ...p,
            ...updates,
            ...(isCompleted && !updates.kanbanColumnId ? { kanbanColumnId: 'col_done' } : {})
          };
          
          // Trigger the Firestore save as a side-effect outside state rendering if possible, 
          // but to be safe and compatible, we run it immediately on the constructed nextp
          setTimeout(() => {
            dbService.projects.save(nextp).catch(err => {
              console.error("Lỗi khi lưu cập nhật dự án:", err);
            });
          }, 0);
          
          return nextp;
        }
        return p;
      });
      return updated;
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

  const handleDeleteProject = (id: string) => {
    // 1. Cập nhật state dự án dùng functional update để tránh stale closure
    setProjects(prevProjects => prevProjects.filter(p => p.id !== id));
    
    // 2. Cập nhật state công việc dùng functional update, đồng thời xóa các tài liệu tương ứng trong Firebase
    setTasks(prevTasks => {
      const associatedTasks = prevTasks.filter(t => t.projectId === id);
      const associatedTaskIds = associatedTasks.map(t => t.id);
      
      if (associatedTaskIds.length > 0) {
        dbService.tasks.deleteMultiple(associatedTaskIds).catch(err => {
          console.error("Lỗi khi xóa các công việc con liên quan đến dự án:", err);
        });
      }
      
      return prevTasks.filter(t => t.projectId !== id);
    });

    // 3. Xóa dự án trong Firebase
    dbService.projects.delete(id).catch(err => {
      console.error("Lỗi khi xóa dự án:", err);
    });
  };

  // HANDLERS CÔNG VIỆC
  const handleAddTask = (newTask: Task) => {
    setTasks(prev => [newTask, ...prev]);
    dbService.tasks.save(newTask).catch(err => {
      console.error("Lỗi khi thêm công việc mới:", err);
    });

    // Auto-create task chat group
    try {
      if (!currentUser) return;
      const project = projects.find(p => p.id === newTask.projectId);
      const memberIds = Array.from(new Set([
        newTask.assignerId,
        newTask.assigneeId,
        ...(newTask.involvedEmployeeIds || []),
        ...(newTask.missions || []).flatMap(m => [m.mainAssigneeId, ...(m.memberIds || [])]),
        project?.pmId,
        ...(project?.involvedEmployeeIds || []),
        currentUser?.id
      ].filter((id): id is string => Boolean(id))));

      if (!currentUser) return;
      createGroupConversation(
        `${project?.name?.substring(0, 30)} - ${newTask.name.substring(0, 30)}`,
        memberIds,
        currentUser.id,
        newTask.id,
        newTask.projectId
      );
    } catch (e) { console.error('Auto-create chat group failed:', e); }
  };

  const handleUpdateTask = (id: string, updates: Partial<Task>) => {
    setTasks(prev => {
      const idx = prev.findIndex(t => t.id === id);
      if (idx !== -1) {
        const oldTask = prev[idx];
        const changedTask = { ...oldTask, ...updates };

        // A. THÔNG BÁO TIN NHẮN MỚI TRONG CÔNG VIỆC CON (HỘI THOẠI)
        if (updates.comments && updates.comments.length > (oldTask.comments?.length || 0)) {
          const newComment = updates.comments[updates.comments.length - 1];
          // Thông báo cho người nhận (nếu người nhận không phải là chính người gửi)
          const recipientIds: string[] = [];
          if (newComment.senderId !== oldTask.assigneeId) recipientIds.push(oldTask.assigneeId);
          if (newComment.senderId !== oldTask.assignerId) recipientIds.push(oldTask.assignerId);
          if (oldTask.involvedEmployeeIds) {
            oldTask.involvedEmployeeIds.forEach(ieId => {
              if (ieId !== newComment.senderId && !recipientIds.includes(ieId)) {
                recipientIds.push(ieId);
              }
            });
          }

          recipientIds.forEach(recId => {
            const rec = employees.find(e => e.id === recId);
            if (rec) {
              setTimeout(() => {
                addNotification({
                  recipientId: recId,
                  senderId: newComment.senderId,
                  senderName: newComment.senderName,
                  senderAvatar: newComment.senderName.substring(0, 2).toUpperCase(),
                  category: 'chat',
                  title: `💬 Tin nhắn mới từ ${newComment.senderName}`,
                  content: `[Công việc con ${oldTask.code}]: "${newComment.content}"`,
                  detailedContent: `Nội dung cuộc hội thoại trong công việc con "${oldTask.name}" (${oldTask.code}):\n\nNgười gửi: ${newComment.senderName} (${newComment.senderRole})\nThời gian: ${new Date(newComment.createdAt).toLocaleString('vi-VN')}\n\nTin nhắn: "${newComment.content}"`,
                  subTaskCode: oldTask.code
                });
              }, 10);
            }
          });
        }

        // B. THÔNG BÁO THÔNG TIN TRONG CÔNG VIỆC CON CÓ LIÊN QUAN (TRẠNG THÁI, TIẾN ĐỘ)
        if (updates.status && updates.status !== oldTask.status) {
          const statusMap: Record<string, string> = { todo: 'Chưa làm', in_progress: 'Đang làm', review: 'Đợi duyệt', completed: 'Hoàn thành' };
          const recipientIds = Array.from(new Set([oldTask.assigneeId, oldTask.assignerId, ...(oldTask.involvedEmployeeIds || [])]))
            .filter(recId => recId !== currentUser?.id);

          recipientIds.forEach(recId => {
            setTimeout(() => {
              if (!currentUser) return;
              addNotification({
                recipientId: recId,
                senderId: currentUser.id,
                senderName: currentUser.name,
                senderAvatar: currentUser.name.substring(0, 2).toUpperCase(),
                category: 'tasks',
                title: `📋 Cập nhật công việc con`,
                content: `Trạng thái công việc "${oldTask.name}" đổi thành: ${statusMap[updates.status || ''] || updates.status}`,
                detailedContent: `Mã công việc: ${oldTask.code}\nTên công việc: ${oldTask.name}\nPhòng ban: ${oldTask.department}\nHạn hoàn thành: ${oldTask.deadline}\n\nNgười cập nhật: ${currentUser.name}\nTrạng thái mới: ${statusMap[updates.status || ''] || updates.status}\nTiến độ hiện tại: ${changedTask.completionRate}%`,
                subTaskCode: oldTask.code
              });
            }, 10);
          });
        }

        if (updates.completionRate !== undefined && updates.completionRate !== oldTask.completionRate) {
          const recipientIds = Array.from(new Set([oldTask.assigneeId, oldTask.assignerId, ...(oldTask.involvedEmployeeIds || [])]))
            .filter(recId => recId !== currentUser?.id);

          recipientIds.forEach(recId => {
            setTimeout(() => {
              if (!currentUser) return;
              addNotification({
                recipientId: recId,
                senderId: currentUser.id,
                senderName: currentUser.name,
                senderAvatar: currentUser.name.substring(0, 2).toUpperCase(),
                category: 'tasks',
                title: `📈 Cập nhật tiến độ`,
                content: `Tiến độ việc "${oldTask.name}" tăng lên ${updates.completionRate}%`,
                detailedContent: `Mã công việc: ${oldTask.code}\nTên công việc: ${oldTask.name}\nTiến độ cũ: ${oldTask.completionRate}%\nTiến độ mới: ${updates.completionRate}%\n\nNgười cập nhật: ${currentUser.name}`,
                subTaskCode: oldTask.code
              });
            }, 10);
          });
        }

        // Phát hiện hoàn thành công việc để bắn Toast nổi
        const wasCompleted = oldTask.status === 'completed' || oldTask.completionRate === 100;
        const isNowCompleted = changedTask.status === 'completed' || changedTask.completionRate === 100;
        if (!wasCompleted && isNowCompleted) {
          addToast({
            title: '✅ Hoàn thành công việc',
            message: `Công việc "${changedTask.name}" đã cán đích và hoàn thành xuất sắc!`,
            type: 'success'
          });
        }

        dbService.tasks.save(changedTask).catch(err => {
          console.error("Lỗi khi cập nhật công việc:", err);
        });

        // TỰ ĐỘNG CHUYỂN CỘT KHI HOÀN THÀNH:
        const projectId = changedTask.projectId;
        if (projectId) {
          const updatedTasks = prev.map(t => t.id === id ? changedTask : t);
          const projTasks = updatedTasks.filter(t => t.projectId === projectId);
          if (projTasks.length > 0) {
            const allCompleted = projTasks.every(t => t.status === 'completed' || t.completionRate === 100);
            if (allCompleted) {
              // Wait a brief moment to avoid state updates collision or race conditions
              setTimeout(() => {
                const proj = projects.find(p => p.id === projectId);
                if (proj) {
                  // Determine sector and loading key
                  const sector = proj.type === 'furniture' ? 'furniture' : proj.type === 'construction' ? 'construction' : 'mechanical';
                  const storageKey = `hl_kanban_cols_${sector}`;
                  const saved = localStorage.getItem(storageKey);
                  let columnsList: any[] = [];
                  if (saved) {
                    try {
                      columnsList = JSON.parse(saved);
                    } catch (e) {}
                  }
                  if (!columnsList || columnsList.length === 0) {
                    columnsList = [
                      { id: 'col_design', name: 'YÊU CẦU THIẾT KẾ', color: 'bg-indigo-650', iconColor: 'text-indigo-400', automation: { type: 'auto_progress', param: 10 } },
                      { id: 'col_bid', name: 'ĐẤU THẦU', color: 'bg-sky-600', iconColor: 'text-sky-450', automation: { type: 'auto_pm', param: 'emp_3' } },
                      { id: 'col_waiting', name: 'CHỜ KẾT QUẢ', color: 'bg-blue-700', iconColor: 'text-blue-450', automation: { type: 'none' } },
                      { id: 'col_active', name: 'GIỚI ĐOẠN THI CÔNG', color: 'bg-amber-500', iconColor: 'text-amber-400', automation: { type: 'auto_progress', param: 40 } },
                      { id: 'col_accept', name: 'NGHIỆM THU', color: 'bg-emerald-600', iconColor: 'text-emerald-450', automation: { type: 'auto_approval', param: 'director' } },
                      { id: 'col_fix', name: 'XỬ LÝ - KHẮC PHỤC', color: 'bg-purple-600', iconColor: 'text-purple-400', automation: { type: 'auto_progress', param: 90 } },
                      { id: 'col_done', name: 'HOÀN THÀNH', color: 'bg-pink-600', iconColor: 'text-pink-400', automation: { type: 'auto_complete' } },
                    ];
                  }

                  const getProjColumnId = (p: Project): string => {
                    if ((p as any).kanbanColumnId) {
                      if (columnsList.some(c => c.id === (p as any).kanbanColumnId)) {
                        return (p as any).kanbanColumnId;
                      }
                    }
                    if (p.status === 'completed') return 'col_done';
                    if (p.status === 'new') return 'col_design';
                    if (p.progress >= 90) return 'col_fix';
                    if (p.progress >= 70) return 'col_accept';
                    if (p.progress > 0) return 'col_active';
                    return 'col_design';
                  };

                  const currentColId = getProjColumnId(proj);
                  const currentColObj = columnsList.find(c => c.id === currentColId);
                  const targetColId = currentColObj?.automation?.statusUpdate;

                  if (targetColId && targetColId !== currentColId) {
                    const targetColObj = columnsList.find(c => c.id === targetColId);
                    const updates: Partial<Project> = {
                      kanbanColumnId: targetColId,
                    };

                    const generatedTasks: Task[] = [];

                    if (targetColObj?.automation) {
                      const rule = targetColObj.automation;

                      // 1. PM assignment
                      if (rule.assignId) {
                        updates.pmId = rule.assignId;
                      }

                      // 2. Status update
                      if (rule.statusUpdate && rule.statusUpdate !== 'col_done' && !columnsList.some((c: any) => c.id === rule.statusUpdate)) {
                        updates.status = rule.statusUpdate as any;
                      }

                      // 2.2 Text styling
                      if (rule.textStyleStyleItalic !== undefined) updates.styleItalic = rule.textStyleStyleItalic;
                      if (rule.textStyleStyleBold !== undefined) updates.styleBold = rule.textStyleStyleBold;
                      if (rule.textStyleStyleStrike !== undefined) updates.styleStrike = rule.textStyleStyleStrike;
                      if (rule.textStyleStyleColor !== undefined) updates.styleColor = rule.textStyleStyleColor;

                      // 6. Subtasks creation
                      const tasksToAdd: string[] = [];
                      if (rule.subtaskTitles && rule.subtaskTitles.length > 0) {
                        rule.subtaskTitles.forEach((title: string) => {
                          if (title && title.trim()) {
                            tasksToAdd.push(title.trim());
                          }
                        });
                      } else if (rule.subtaskTitle && rule.subtaskTitle.trim()) {
                        tasksToAdd.push(rule.subtaskTitle.trim());
                      }

                      if (tasksToAdd.length > 0) {
                        const nowTimestamp = Date.now();
                        tasksToAdd.forEach((title, idx) => {
                          const newTaskId = `task_auto_${nowTimestamp}_${idx}`;
                          const dayOffset = rule.dueDateDaysOffset || 7;
                          const subtaskAuto = (rule.subtaskAutomations && rule.subtaskAutomations[idx]) ? rule.subtaskAutomations[idx] : {};
                          
                          const assigneeId = subtaskAuto.assignId || rule.assignId || proj.pmId || 'emp_3';
                          const involvedEmployeeIds = Array.from(new Set([
                            ...(proj.involvedEmployeeIds || []),
                            ...(rule.involvedId ? [rule.involvedId] : []),
                            ...(subtaskAuto.involvedId ? [subtaskAuto.involvedId] : []),
                            ...(subtaskAuto.involvedEmployeeIds || [])
                          ]));

                          const approvals = subtaskAuto.isApprovalEnabled !== false && subtaskAuto.approvalRole && subtaskAuto.approvalRole !== 'none' ? [{
                            id: `app_sub_auto_${nowTimestamp}_${idx}`,
                            levelName: `Quy trình duyệt: ${subtaskAuto.approvalRole === 'director' ? 'Giám Đốc (Trương Hữu Long)' : subtaskAuto.approvalRole === 'accountant' ? 'Kế Toán trưởng (Lê Thị Mai)' : 'PM chuyên trách'}`,
                            approverId: subtaskAuto.approvalRole === 'director' ? 'emp_1' : subtaskAuto.approvalRole === 'accountant' ? 'emp_2' : (proj.pmId || 'emp_3'),
                            status: 'pending' as const
                          }] : undefined;

                          const autoTask: Task = {
                            id: newTaskId,
                            code: `CV-AUTO-${Math.floor(Math.random() * 900) + 100}`,
                            projectId: projectId,
                            columnId: targetColId,
                            name: title,
                            description: `Công việc con được tạo tự động bởi quy trình khi di chuyển vào phân đoạn ${targetColObj.name}. ${subtaskAuto.docTitle ? 'Yêu cầu lập hồ sơ thiết kế kèm theo.' : ''}`,
                            assignerId: 'system',
                            assigneeId: assigneeId,
                            involvedEmployeeIds: involvedEmployeeIds,
                            department: 'Thi công',
                            deadline: new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                            priority: 'medium',
                            status: 'todo',
                            completionRate: 0,
                            notes: 'Nhiệm vụ tự trị Hoàng Long vách mộc',
                            workLogs: [
                              {
                                id: `wl_auto_${nowTimestamp}`,
                                actorId: 'system',
                                actorName: 'Hệ thống tự động',
                                action: 'Cấp phát nhiệm vụ tự động',
                                timestamp: new Date().toISOString().split('T')[0],
                                notes: `Khởi tạo công việc từ quy trình tự động phân đoạn ${targetColObj.name}.`
                              }
                            ],
                            styleItalic: subtaskAuto.textStyleStyleItalic,
                            styleBold: subtaskAuto.textStyleStyleBold,
                            styleStrike: subtaskAuto.textStyleStyleStrike,
                            styleColor: subtaskAuto.textStyleStyleColor,
                            checklistTexts: subtaskAuto.checklistTexts || [],
                            approvals: approvals,
                            isApprovalEnabled: subtaskAuto.isApprovalEnabled !== false,
                            isApprovalRequired: subtaskAuto.isApprovalRequired !== false,
                            isDocGenerationEnabled: subtaskAuto.isDocGenerationEnabled !== false,
                            isCostEnabled: subtaskAuto.isCostEnabled !== false,
                            isMaterialEnabled: subtaskAuto.isMaterialEnabled !== false
                          };

                          generatedTasks.push(autoTask);

                          // Thiết kế Hồ sơ
                          if (subtaskAuto.docTemplateId && subtaskAuto.docTemplateId !== 'none') {
                            const docTitle = subtaskAuto.docTitle || `Hồ sơ ${subtaskAuto.docTemplateId === 'quotation' ? 'Báo giá thầu' : subtaskAuto.docTemplateId === 'contract' ? 'Hợp đồng kinh tế' : subtaskAuto.docTemplateId === 'acceptance' ? 'Biên bản nghiệm thu' : 'Biên bản thanh lý'}`;
                            const subtaskDoc: ProjectDoc = {
                              id: `doc_sub_auto_${nowTimestamp}_${idx}`,
                              type: subtaskAuto.docTemplateId as any,
                              name: docTitle,
                              code: `HS-AUTO-${Math.floor(Math.random() * 900) + 100}`,
                              createdAt: new Date().toISOString().split('T')[0],
                              status: 'draft',
                              templateName: 'Hồ sơ thiết lập tự động từ công việc con',
                              customFields: [
                                { label: 'Công việc liên kết', value: title }
                              ]
                            };
                            if (!updates.documents) {
                              updates.documents = [...(proj.documents || [])];
                            }
                            updates.documents.push(subtaskDoc);
                          }
                        });
                      }
                    }

                    const nextp = {
                      ...proj,
                      ...updates,
                    };

                    // 1. Save updated project to DB
                    dbService.projects.save(nextp).catch(err => {
                      console.error("Lỗi khi lưu tự động cập nhật dự án:", err);
                    });

                    // 2. Set Projects State
                    setProjects(prevProjects => prevProjects.map(p => p.id === proj.id ? nextp : p));

                    // 3. Save tasks securely to prevent duplicates
                    if (generatedTasks.length > 0) {
                      setTasks(prevTasks => {
                        // De-duplicate guard to strictly ensure no identical todo task name on the target column
                        const nonDuplicateGenerated = generatedTasks.filter(gt => 
                          !prevTasks.some(pt => pt.projectId === projectId && pt.name === gt.name && pt.columnId === targetColId && pt.status === 'todo')
                        );

                        nonDuplicateGenerated.forEach(task => {
                          dbService.tasks.save(task).catch(err => {
                            console.error("Lỗi khi lưu tự động tạo công việc từ quy trình:", err);
                          });
                        });

                        return [...nonDuplicateGenerated, ...prevTasks];
                      });
                    }

                    const targetColName = targetColObj?.name || targetColId;
                    setTimeout(() => {
                      alert(`[Quy trình Tự động]: Toàn bộ công việc con (${projTasks.length}/${projTasks.length} việc con) đã hoàn thành.\nHệ thống tự động chuyển dự án [${proj.name}] từ cột [${currentColObj?.name || currentColId}] sang cột phân đoạn mới [${targetColName}] thành công!\nCác quy tắc tự động (quy trình phê duyệt, cán bộ PM phụ trách, định dạng phông chữ, thêm công việc con mới...) của phân đoạn mới [${targetColName}] đã được kích hoạt và áp dụng đầy đủ.`);
                    }, 50);
                  }
                }
              }, 500);
            }
          }
        }

        return prev.map(t => t.id === id ? changedTask : t);
      }
      return prev;
    });
  };

  const handleDeleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    dbService.tasks.delete(id).catch(err => {
      console.error("Lỗi khi xóa công việc:", err);
    });

    // Auto-delete associated task chat group
    try {
      deleteConversation(`conv_task_${id}`);
    } catch (e) { console.error('Auto-delete chat group failed:', e); }
  };

  const handleDeleteMultipleTasks = (ids: string[]) => {
    setTasks(prev => prev.filter(t => !ids.includes(t.id)));
    dbService.tasks.deleteMultiple(ids).catch(err => {
      console.error("Lỗi khi dọn dẹp các công việc:", err);
    });

    // Auto-delete associated task chat groups
    try {
      ids.forEach(id => deleteConversation(`conv_task_${id}`));
    } catch (e) { console.error('Auto-delete chat groups failed:', e); }
  };

  // HANDLERS TÀI CHÍNH
  const handleAddReceipt = (newRec: Receipt) => {
    setReceipts([newRec, ...receipts]);
    dbService.receipts.save(newRec);
    
    // Nếu có dự án kết nối, tăng nhẹ tiến trình ngẫu nhiên
    if (newRec.projectId) {
      const updatedProjs = projects.map(p => {
        if (p.id === newRec.projectId) {
          const nextp = { ...p, progress: Math.min(p.progress + 5, 100) };
          dbService.projects.save(nextp);
          return nextp;
        }
        return p;
      });
      setProjects(updatedProjs);
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

  const handleAddPayment = (newPay: Payment) => {
    setPayments([newPay, ...payments]);
    dbService.payments.save(newPay);
  };

  const handleDeleteReceipt = (id: string) => {
    setReceipts(prev => prev.filter(r => r.id !== id));
    dbService.receipts.delete(id).catch(err => console.error("Lỗi xóa phiếu thu:", err));
  };

  const handleDeletePayment = (id: string) => {
    setPayments(prev => prev.filter(p => p.id !== id));
    dbService.payments.delete(id).catch(err => console.error("Lỗi xóa phiếu chi:", err));
  };

  const handleApprovePayment = (id: string, status: 'approved' | 'rejected') => {
    const targetPayment = payments.find(p => p.id === id);
    const updated = payments.map(p => p.id === id ? { ...p, status } : p);
    setPayments(updated);

    if (targetPayment) {
      dbService.payments.save({ ...targetPayment, status });

      // Phát thông báo trạng thái phê duyệt cho người đề xuất
      const proposerEmployee = employees.find(e => e.name === targetPayment.proposer);
      const recipientId = proposerEmployee ? proposerEmployee.id : 'emp_1';
      if (!currentUser) return;
      setTimeout(() => {
        addNotification({
          recipientId,
          senderId: currentUser.id,
          senderName: currentUser.name,
          senderAvatar: currentUser.name.substring(0, 2).toUpperCase(),
          category: 'finance',
          title: status === 'approved' ? '✅ Phê duyệt thanh toán thành công' : '❌ Từ chối phê duyệt thanh toán',
          content: `Yêu cầu thanh toán ${targetPayment.code} (${targetPayment.recipient}) đã được ${status === 'approved' ? 'duyệt chi' : 'từ chối'}.`,
          detailedContent: `Mã phiếu: ${targetPayment.code}\nNội dung chi chiết đề xuất thanh toán:\n\nHạng mục: ${targetPayment.recipient}\nSố tiền: ${targetPayment.amount.toLocaleString('vi-VN')} đ\nNgười đề xuất: ${targetPayment.proposer}\nNgười xét duyệt: ${currentUser.name}\n\nTrạng thái mới: ${status === 'approved' ? 'ĐÃ PHÊ DUYỆT & ĐÃ CHI' : 'BỊ TỪ CHỐI DUYỆT'}`,
          subTaskCode: 'CV-GEN'
        });
      }, 10);
    }
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

    // Notification logic
    const statusTexts: Record<string, string> = { draft: 'Nháp', sent: 'Đã gửi', approved: 'Đã phê duyệt', rejected: 'Bị từ chối' };
    const quote = quotes.find(q => q.id === quoteId);
    if (quote) {
      const associatedProject = projects.find(p => p.id === quote.projectId);
      const recipientId = associatedProject ? associatedProject.pmId : 'emp_1';
      if (!currentUser) return;
      setTimeout(() => {
        addNotification({
          recipientId,
          senderId: currentUser.id,
          senderName: currentUser.name,
          senderAvatar: currentUser.name.substring(0, 2).toUpperCase(),
          category: 'projects',
          title: status === 'approved' ? '🎯 Báo giá được phê duyệt' : '⚠️ Báo giá bị cập nhật trạng thái',
          content: `Báo giá ${quote.code} (${quote.customerName || 'Khách hàng'}) đã được ${statusTexts[status] || status}.`,
          detailedContent: `Báo giá: ${quote.code}\nKhách hàng: ${quote.customerName || 'N/A'}\nTrạng thái mới: ${statusTexts[status] || status}\nDự án liên đới: ${quote.projectName || 'N/A'}\n\nNgười phê duyệt: ${currentUser.name}\nHạn mức đầu tư: ${quote.nganSachNoiThat?.toLocaleString('vi-VN') || 0} đ`,
          subTaskCode: 'CV-GEN'
        });
      }, 10);
    }
  };

  const isAccessible = (tab: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.username === 'admin') return true;

    // ── Nguồn sự thật chính: HRM Role Groups (hl_cached_hrm_role_groups / hl_hrm_roles_v2) ──
    const isAdminGroup = isUserInRoleGroup(currentUser.id, 'role_admin');

    const allowedFromGroups = getAllowedTabsFromRoleGroups(currentUser);

    // Fallback: dùng legacy role field nếu Role Groups chưa có cấu hình
    let allowed: string[] = allowedFromGroups;
    if (!allowed || allowed.length === 0) {
      const role = currentUser.role;
      const legacy = role ? rolePermissions[role] : undefined;
      if (legacy && legacy.length > 0) {
        allowed = legacy;
      }
    }

    // Các tab lõi (core) luôn hiển thị với mọi người dùng đã đăng nhập
    // (Tin nhắn là tính năng liên lạc bắt buộc, không nằm trong ma trận phân quyền module)
    const coreTabs = ['dashboard', 'tasks', 'messages'];
    allowed = Array.from(new Set([...coreTabs, ...(allowed || [])]));

    // Fail-safe: nếu chưa cấu hình → không có quyền (ẩn menu)
    if (!allowed || allowed.length === 0) return false;

    // Giám đốc luôn giữ quyền Cài đặt hệ thống để không tự khóa mình ra ngoài
    if (isAdminGroup && (tab === 'settings' || tab === 'settings-accounts' || tab === 'settings-roles')) return true;

    // Các tab thuộc phòng giám đốc chỉ có Giám đốc được xem
    if (tab.startsWith('director-') && tab !== 'director-office' && tab !== 'director-dashboard') {
      return isAdminGroup;
    }

    // Map các trường hợp đặc thù liên kết giữa tab tổng và các tab con để tương thích ngược
    if (tab === 'projects') {
      return allowed.includes('project-office') ||
             allowed.includes('projects-construction') ||
             allowed.includes('projects-furniture') ||
             allowed.includes('projects-mechanical');
    }
    if (tab === 'material-coordination') {
      return allowed.includes('material-coordination') || allowed.includes('finance');
    }
    if (tab === 'warehouse-suppliers') {
      return allowed.includes('warehouse-suppliers') || allowed.includes('finance');
    }
    if (tab === 'warehouse-management') {
      return allowed.includes('warehouse-management') || allowed.includes('finance');
    }
    if (tab === 'subcontractor-management') {
      return allowed.includes('subcontractor-management') || allowed.includes('finance') || allowed.includes('quotes');
    }
    if (tab === 'quotes-construction') {
      return allowed.includes('quotes-construction') || allowed.includes('quotes');
    }
    if (tab === 'quotes-mechanical') {
      return allowed.includes('quotes-mechanical') || allowed.includes('quotes');
    }
    if (tab === 'quotes-subcontractor') {
      return allowed.includes('quotes-subcontractor') || allowed.includes('quotes');
    }
    if (tab === 'settings-accounts') {
      return allowed.includes('settings-accounts') || allowed.includes('settings');
    }
    if (tab === 'settings-roles') {
      return allowed.includes('settings-roles') || allowed.includes('settings');
    }

    return allowed.includes(tab);
  };

  // Tự động điều hướng về 'dashboard' nếu tab hiện tại không có quyền truy cập
  useEffect(() => {
    if (!isAccessible(activeTab)) {
      setActiveTab('dashboard');
    }
  }, [currentUser, activeTab, rolePermissions]);

  const myUncompletedCount = tasks.filter(t => {
    // Guard: only run when currentUser exists
    if (!currentUser) return false;
    // 1. Công việc được giao chưa hoàn thành
    const isAssignee = (t.assigneeId === currentUser?.id || t.assigneeId === currentUser?.name) && t.status !== 'completed';
    
    // 2. Công việc phải duyệt chưa hoàn thành (đang chờ duyệt, tôi là người giao việc hoặc có vai trò duyệt)
    const isToReview = t.status === 'reviewing' && (
      t.assignerId === currentUser?.id ||
      t.assignerId === currentUser?.name ||
      t.approvals?.some(ap => ap.approverId === currentUser?.id || ap.approverId === currentUser?.name)
    );

    // 3. Công việc liên quan chưa hoàn thành
    let isRelated = false;
    if (t.status !== 'completed') {
      const isAssignerGeneric = t.assignerId === currentUser?.id || 
                                 t.assignerId === currentUser?.name ||
                                 t.approvals?.some(ap => ap.approverId === currentUser?.id || ap.approverId === currentUser?.name);
      if (!isAssignee && !isAssignerGeneric) {
        const projectOfTask = projects.find(p => p.id === t.projectId);
        const isProjectInvolved = projectOfTask?.involvedEmployeeIds?.includes(currentUser!.id);
        const isTaskInvolved = t.involvedEmployeeIds?.includes(currentUser!.id) || t.involvedEmployeeIds?.includes(currentUser!.name);
        isRelated = !!(isProjectInvolved || isTaskInvolved);
      }
    }

    return isAssignee || isToReview || isRelated;
  }).length;

  if (!currentUser) {
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

  const currentFont = displaySettings.fontFamily || 'Inter';

  return (
    <AuthProvider employees={employees} addToast={addToast}>
      <NotificationProvider employees={employees} currentUser={currentUser}>
        <div
          className="flex h-screen w-screen bg-slate-950 overflow-hidden text-slate-200 font-sans transition-all duration-200"
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
                        const unreadCount = notifications.filter(n => n.recipientId === currentUser?.id && !n.read).length;
                        return unreadCount > 0 ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 ms-2 text-[10px] font-medium text-white bg-rose-600 rounded-full">{unreadCount}</span>
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
                              const subTabMap: Record<string, string> = { projects: 'director-projects', hr: 'director-hr', accounting: 'director-finance', warehouse: 'director-warehouse', subcontractor: 'director-subcontractor' };
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
                        {isAccessible('warehouse-suppliers') && (
                          <li>
                            <button onClick={() => { setActiveTab('warehouse-suppliers'); if (mobileMenuOpen) setMobileMenuOpen(false); }} className={`w-full flex items-center pl-10 pr-2 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab === 'warehouse-suppliers' ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                              Nhà cung cấp vật tư
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
                  </li>
                )}
              </ul>
            </nav>

            {/* ĐỒNG HỒ / CHÂN SIDEBAR */}
            <div className="border-t border-gray-200 pt-3 mt-3 text-gray-500 shrink-0">
              <span className="text-[9px] text-gray-400 block font-semibold mb-1">Cán bộ: {currentUser.name}</span>
              <div className="text-2xl font-black font-sans leading-none text-gray-900">{currentTime || '12:00 PM'}</div>
              <div className="text-[9px] text-gray-400 mt-1.5 leading-normal">{displaySettings.motivationQuote}</div>
            </div>
          </div>
        </aside>

      {/* TẤM LÒNG PHẦN KIẾM CHỦ (NỘI DUNG CHÍNH BÊN PHẢI) */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-950 text-slate-200" id="right_content_pane">
        
        {/* HEADER TOP-BAR */}
        <header className="bg-slate-900/50 border-b border-slate-800 px-4 md:px-6 py-3 flex justify-between items-center shrink-0 shadow-lg" id="top_header_bar">
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
              {activeTab === 'projects-construction' && 'Phân Hệ Dự Án XÂY DỰNG'}
              {activeTab === 'projects-furniture' && 'Phân Hệ Dự Án NỘI THẤT'}
              {activeTab === 'projects-mechanical' && 'Phân Hệ Dự Án CƠ KHÍ & GIA CÔNG'}
              {activeTab === 'tasks' && 'Điều Phối Việc Công Trường / Xưởng'}
              {activeTab === 'quotes-construction' && 'Hồ Sơ Xây Dựng'}
              {activeTab === 'quotes' && 'Hồ Sơ Nội Thất'}
              {activeTab === 'quotes-mechanical' && 'Hồ Sơ Cơ Khí'}
              {activeTab === 'quotes-subcontractor' && 'Hồ Sơ Thầu Phụ'}
              {activeTab === 'subcontractor-management' && 'Quản Lý Thầu Phụ'}
              {activeTab === 'finance' && 'Kế Toán Tổng Hợp & Sổ Sách'}
              {activeTab === 'material-coordination' && 'Phân Hệ Điều Phối Vật Tư'}
              {activeTab === 'warehouse-suppliers' && 'Danh Mục Nhà Cung Cấp Vật Tư'}
              {activeTab === 'warehouse-management' && 'Phân Hệ Quản Lý Tồn Kho & Sổ Kho'}
              {activeTab === 'employees' && (hrSubTab === 'hr_data' ? 'Dữ Liệu Nhân Sự' : 'Danh Bạ Nhân Sự Nội Bộ')}
              {activeTab === 'settings' && '⚙️ Trung Tâm Thiết Lập Hệ Thống & Tùy Biến'}
              {activeTab === 'messages' && '💬 Tin Nhắn & Thông Báo Công Việc (Messenger)'}
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

            {/* THÔNG BÁO TIN NHẮN MỚI (CHUÔNG THÔNG BÁO) */}
            {(() => {
              const userNotifications = notifications.filter(n => n.recipientId === currentUser?.id);
              const unreadCount = userNotifications.filter(n => !n.read).length;

              // Helper sinh màu avatar và fallback tên (giống MessagesView)
              const avatarColors = ['#6366F1','#EF4444','#10B981','#F59E0B','#A855F7','#3B82F6','#14B8A6','#F97316','#334155'];
              const getAvatarColor = (name: string) => {
                let hash = 0;
                for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
                return avatarColors[Math.abs(hash) % avatarColors.length];
              };
              const getAvatarFallback = (name: string) => {
                if (!name) return '??';
                const words = name.trim().split(/\s+/);
                if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
                return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
              };
              const formatTime = (iso: string) => {
                try {
                  const d = new Date(iso); const now = new Date();
                  const diffMs = now.getTime() - d.getTime();
                  if (diffMs < 60000) return 'Vừa xong';
                  const diffMins = Math.floor(diffMs / 60000);
                  if (diffMins < 60) return `${diffMins} phút`;
                  const diffHours = Math.floor(diffMins / 60);
                  if (diffHours < 24) return `${diffHours} giờ`;
                  return d.toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit' });
                } catch { return ''; }
              };

              // Badge counts cho 4 tab bộ lọc
              const notifAllCount = notifications.filter(n => n.recipientId === currentUser?.id && !n.read).length;
              const notifPersonalCount = notifications.filter(n => n.recipientId === currentUser?.id && n.category === 'chat' && !n.read).length;
              const notifGroupCount = notifications.filter(n => n.recipientId === currentUser?.id && n.category !== 'chat' && !n.read).length;

              const popoverTabs: Array<{id: typeof popoverFilter, label: string, icon: any, count: number}> = [
                { id: 'all', label: 'Tất cả', icon: MessageSquare, count: notifAllCount },
                { id: 'personal', label: 'Cá nhân', icon: User, count: notifPersonalCount },
                { id: 'group', label: 'Nhóm', icon: Users, count: notifGroupCount },
                { id: 'notifications', label: 'Thông báo', icon: Bell, count: notifAllCount },
              ];

              return (
                <div className="relative" id="notification_bell_root">
                  <button
                    onClick={() => setShowNotificationsPanel(!showNotificationsPanel)}
                    className="p-2 text-slate-400 hover:text-emerald-400 bg-slate-900 border border-slate-800 rounded-lg cursor-pointer transition-colors relative flex items-center justify-center h-8.5 w-8.5"
                    title="Thông báo tin nhắn phòng ban & công việc"
                    id="notification_bell_btn"
                  >
                    <Bell className="w-4 h-4 text-emerald-400" />
                    {showBadgeCounts && unreadCount > 0 ? (
                      <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-rose-600 text-[9px] font-black text-white ring-1 ring-rose-500 animate-pulse">
                        {unreadCount}
                      </span>
                    ) : null}
                  </button>

                  {showNotificationsPanel && (
                    <div
                      className="absolute right-0 mt-3 w-[92vw] sm:w-[460px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4.5 z-50 text-slate-200 font-sans top-full flex flex-col gap-3.5 ring-1 ring-slate-800"
                      id="notification_popover"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                            <Bell className="w-4 h-4 text-emerald-400" />
                          </div>
                          <div>
                            <span className="font-extrabold text-sm text-white block">Thông báo & Tin nhắn</span>
                            <span className="text-[10px] text-slate-500 font-medium">Được đồng bộ theo thời gian thực</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Nút ẩn/hiện badge */}
                          <button
                            type="button"
                            onClick={() => {
                              const next = !showBadgeCounts;
                              setShowBadgeCounts(next);
                              localStorage.setItem('hl_show_badge_counts', next ? 'true' : 'false');
                            }}
                            className={`p-1.5 rounded-lg cursor-pointer transition-all ${
                              showBadgeCounts ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-600 bg-slate-850'
                            }`}
                            title={showBadgeCounts ? 'Ẩn số chưa đọc' : 'Hiện số chưa đọc'}
                          >
                            {showBadgeCounts ? '🔔' : '🔕'}
                          </button>
                          {userNotifications.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = notifications.map(n => n.recipientId === currentUser.id ? { ...n, read: true } : n);
                                setNotifications(updated);
                              }}
                              className="text-[10px] bg-slate-800 hover:bg-slate-750 text-slate-300 font-extrabold px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
                            >
                              Đọc tất cả
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              const remainder = notifications.filter(n => n.recipientId !== currentUser.id);
                              setNotifications(remainder);
                            }}
                            className="text-[10px] bg-rose-950/40 hover:bg-rose-900/45 text-rose-400 border border-rose-900/30 font-extrabold px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
                          >
                            Xóa tất cả
                          </button>
                        </div>
                      </div>

                      {/* 4 tab bộ lọc — kiểu tab gạch chân ngang (Flowbite) */}
                      <ul className="flex flex-nowrap -mb-px text-sm font-medium text-center">
                        {popoverTabs.map(tab => {
                          const isActive = popoverFilter === tab.id;
                          return (
                            <li key={tab.id} className="flex-1 min-w-0">
                              <button
                                type="button"
                                onClick={() => setPopoverFilter(tab.id)}
                                className={`w-full inline-flex items-center justify-center px-2 py-3 border-b-2 rounded-t-lg cursor-pointer transition-colors group relative ${
                                  isActive
                                    ? 'text-emerald-400 border-emerald-400'
                                    : 'text-slate-400 border-transparent hover:text-emerald-400 hover:border-emerald-400/50'
                                }`}
                                aria-current={isActive ? 'page' : undefined}
                              >
                                {showBadgeCounts && tab.count > 0 && (
                                  <span className="me-1.5 bg-rose-500 text-white text-[8px] font-bold min-w-[14px] h-3.5 px-1 flex items-center justify-center rounded-full">
                                    {tab.count > 99 ? '99+' : tab.count}
                                  </span>
                                )}
                                <span className="truncate">{tab.label}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>

                      {/* Danh sách hội thoại + thông báo đã lọc */}
                      <div className="max-h-[360px] overflow-y-auto pr-1 scrollbar-thin">
                        {(() => {
                          // Lấy conversations của user
                          const allConvs = getUserConversations(getConversations(), currentUser?.id || '');

                          // Lọc theo popoverFilter
                          let displayItems: Array<{type: 'conv'; conv: Conversation} | {type: 'notif'; notif: AppNotification}> = [];

                          if (popoverFilter === 'personal' || popoverFilter === 'all') {
                            const personalConvs = allConvs.filter(c => c.type === 'personal');
                            personalConvs.forEach(conv => displayItems.push({ type: 'conv', conv }));
                          }
                          if (popoverFilter === 'group' || popoverFilter === 'all') {
                            const groupConvs = allConvs.filter(c => c.type === 'group' || c.type === 'task');
                            groupConvs.forEach(conv => displayItems.push({ type: 'conv', conv }));
                          }
                          if (popoverFilter === 'notifications' || popoverFilter === 'all') {
                            // Dedup thông báo theo nội dung + người gửi để tránh trùng lặp
                            const seen = new Set<string>();
                            userNotifications.forEach(n => {
                              const dedupKey = `${n.senderId}_${n.title}_${n.content}`;
                              if (!seen.has(dedupKey)) {
                                seen.add(dedupKey);
                                displayItems.push({ type: 'notif', notif: n });
                              }
                            });
                          }

                          // Sắp xếp: chưa đọc trước, sau đó mới nhất
                          displayItems.sort((a, b) => {
                            const aUnread = a.type === 'conv' ? (a.conv.unreadCount || 0) : (!a.notif.read ? 1 : 0);
                            const bUnread = b.type === 'conv' ? (b.conv.unreadCount || 0) : (!b.notif.read ? 1 : 0);
                            if (aUnread > 0 && bUnread === 0) return -1;
                            if (aUnread === 0 && bUnread > 0) return 1;
                            const aTime = a.type === 'conv' ? (a.conv.lastMessageAt || a.conv.createdAt) : a.notif.createdAt;
                            const bTime = b.type === 'conv' ? (b.conv.lastMessageAt || b.conv.createdAt) : b.notif.createdAt;
                            return bTime.localeCompare(aTime);
                          });

                          if (displayItems.length === 0) {
                            return (
                              <div className="py-10 text-center text-slate-500 space-y-2">
                                <MessageSquare className="w-8 h-8 mx-auto text-slate-700 opacity-60" />
                                <p className="text-xs font-semibold">Không có mục nào phù hợp.</p>
                              </div>
                            );
                          }

                          return displayItems.map(item => {
                            if (item.type === 'conv') {
                              const conv = item.conv;
                              const isGroup = conv.type === 'group' || conv.type === 'task';
                              const unread = conv.unreadCount || 0;
                              const otherId = conv.participantIds.find(id => id !== currentUser?.id);
                              const otherEmp = otherId ? employees.find(e => e.id === otherId) : null;
                              const displayName = isGroup ? conv.name : (otherEmp?.name || 'Người dùng');
                              const avatarText = isGroup ? (conv.avatar || getAvatarFallback(conv.name)) : (otherEmp ? getAvatarFallback(otherEmp.name) : '??');
                              const avatarColor = conv.color || (otherEmp ? getAvatarColor(otherEmp.name) : '#6366F1');

                              return (
                                <div
                                  key={`conv_${conv.id}`}
                                  onClick={() => {
                                    // Mở thẳng vào hội thoại này trong Messenger
                                    setInitialConvId(conv.id);
                                    setMessengerInitialTab('all');
                                    setShowNotificationsPanel(false);
                                    setActiveTab('messages');
                                    if (mobileMenuOpen) setMobileMenuOpen(false);
                                  }}
                                  className={`flex items-center gap-3 px-2.5 py-2.5 cursor-pointer transition-all border-l-[3px] mt-1 first:mt-0 rounded-r-xl ${
                                    unread > 0
                                      ? 'bg-emerald-500/5 border-l-emerald-500 hover:bg-slate-800/60'
                                      : 'border-l-transparent hover:bg-slate-800/60'
                                  }`}
                                >
                                  <div className="relative shrink-0">
                                    <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-xs shadow-md text-white"
                                      style={{ backgroundColor: avatarColor }}>
                                      {avatarText}
                                    </div>
                                    {!isGroup && <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-900"></span>}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-1">
                                      <span className={`font-semibold text-[13px] truncate ${unread > 0 ? 'text-white' : 'text-slate-300'}`}>
                                        {displayName}
                                      </span>
                                      {conv.lastMessageAt && (
                                        <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-2">{formatTime(conv.lastMessageAt)}</span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                                      {isGroup ? 'Nhóm' : (otherEmp?.department || 'Nhân viên')}
                                    </p>
                                  </div>
                                  {unread > 0 && (
                                    <span className="bg-indigo-500 text-white text-[9px] font-bold min-w-[18px] h-4 flex items-center justify-center rounded-full px-1 shrink-0">
                                      {unread}
                                    </span>
                                  )}
                                </div>
                              );
                            } else {
                              const notif = item.notif;
                              const isUnread = !notif.read;
                              const senderName = notif.senderName || 'Hệ Thống';
                              const avatarText = notif.senderAvatar || getAvatarFallback(senderName);

                              return (
                                <div
                                  key={notif.id}
                                  onClick={() => {
                                    const updated = notifications.map(n => n.id === notif.id ? { ...n, read: true } : n);
                                    setNotifications(updated);
                                    setShowNotificationsPanel(false);
                                    setActiveTab('messages');
                                    if (mobileMenuOpen) setMobileMenuOpen(false);
                                    if (notif.conversationId) {
                                      // Có hội thoại → mở thẳng vào chi tiết hội thoại đó
                                      setInitialConvId(notif.conversationId);
                                    } else {
                                      // Thông báo hệ thống → mở tab Thông báo & chi tiết thông báo này
                                      setMessengerInitialTab('notifications');
                                      setInitialNotificationId(notif.id);
                                    }
                                  }}
                                  className={`flex items-center gap-3 px-2.5 py-2.5 cursor-pointer transition-all border-l-[3px] mt-1 first:mt-0 rounded-r-xl ${
                                    isUnread
                                      ? 'bg-emerald-500/5 border-l-emerald-500 hover:bg-slate-800/60'
                                      : 'border-l-transparent hover:bg-slate-800/60'
                                  }`}
                                >
                                  <div className="relative shrink-0">
                                    <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-xs shadow-md text-white"
                                      style={{ backgroundColor: getAvatarColor(senderName) }}>
                                      {avatarText}
                                    </div>
                                    {notif.category && (
                                      <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[7px] border-2 border-slate-900"
                                        style={{
                                          backgroundColor: notif.category === 'chat' ? '#6366F1' : notif.category === 'attendance' ? '#F59E0B' : notif.category === 'finance' ? '#10B981' : '#3B82F6'
                                        }}>
                                        {notif.category === 'chat' ? '💬' : notif.category === 'attendance' ? '⏰' : notif.category === 'finance' ? '💰' : '📋'}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-1">
                                      <span className={`font-semibold text-[13px] truncate ${isUnread ? 'text-white' : 'text-slate-300'}`}>
                                        {senderName}
                                      </span>
                                      <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-2">
                                        {formatTime(notif.createdAt)}
                                      </span>
                                    </div>
                                    <p className={`text-[12px] mt-0.5 truncate leading-tight ${isUnread ? 'text-white font-semibold' : 'text-slate-400'}`}>
                                      {notif.title || notif.content}
                                    </p>
                                  </div>
                                  {isUnread && (
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                                  )}
                                </div>
                              );
                            }
                          });
                        })()}
                      </div>
                    </div>
                  )}
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
                <div className="absolute right-0 mt-2 w-44 z-50 bg-slate-900 border border-slate-800 rounded-lg shadow-xl py-1">
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
                    onClick={() => { setShowUserMenu(false); setActiveTab('settings'); setSubSettingsTab('display'); }}
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
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto" id="main_content_scroller">
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
              onAddReceipt={handleAddReceipt}
              onAddPayment={handleAddPayment}
              onApprovePayment={handleApprovePayment}
              onAddCustomer={handleAddCustomer}
              onDeleteCustomer={handleDeleteCustomer}
              onDeleteReceipt={handleDeleteReceipt}
              onDeletePayment={handleDeletePayment}
              initialSubTab={financeSubTab}
              initialDuLieuTab={financeDuLieuTab}
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

          {/* TAB 6: NHÂN SỰ */}
          {activeTab === 'employees' && (
            <HumanResourcesManagement 
              currentUser={currentUser} 
              projects={projects} 
              customers={customers} 
              defaultSubTab={hrSubTab}
            />
          )}

          {/* PHÂN QUYỀN VÀ VAI TRÒ (Dưới danh nghĩa menu con của Quản Lý Tài Khoản) */}
          {activeTab === 'settings-roles' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg max-w-7xl mx-auto">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-3">
                  <Lock className={`w-4 h-4 ${accentTextClass}`} />
                  <h3 className="text-sm font-black text-white uppercase tracking-wider font-mono">
                    🔐 Phân quyền và Vai trò người dùng (MISA-Inspired)
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
                />
              </div>
            </div>
          )}

          {/* TÀI KHOẢN HỆ THỐNG (Dưới danh nghĩa menu con của Quản Lý Tài Khoản) */}
          {activeTab === 'settings-accounts' && (
            <div className="space-y-6 max-w-5xl mx-auto animate-fadeIn" id="view_accounts_settings_pane">
              
              {/* form thêm người dùng */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
                  <UserPlus className={`w-4 h-4 ${accentTextClass}`} />
                  <h3 className="text-xs font-black text-white uppercase tracking-wider font-mono">
                    👤 Thêm tài khoản người dùng mới
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" style={{ position: 'relative', zIndex: 10 }}>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Họ và Tên Nhân Sự *</label>
                    <input
                      type="text"
                      value={newEmpName}
                      onChange={(e) => {
                        try {
                          const name = e.target.value;
                          setNewEmpName(name);
                          setNewEmpUsername(generateUsernameWithPhone(name, newEmpPhone));
                        } catch (err) {
                          console.error('Error updating name:', err);
                        }
                      }}
                      placeholder="Ví dụ: Hoàng Văn Định"
                      className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 px-3 text-xs text-white outline-none focus:border-slate-700 pointer-events-auto"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Phòng Ban / Tổ Nhóm Công Tác</label>
                    <input
                      type="text"
                      value={newEmpDept}
                      onChange={(e) => {
                        try { setNewEmpDept(e.target.value); } catch (err) { console.error('Error updating dept:', err); }
                      }}
                      placeholder="Ví dụ: Tổ Mộc số 3, Ban Chỉ Huy"
                      className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 px-3 text-xs text-white outline-none pointer-events-auto"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Số Điện Thoại Di Động</label>
                    <input
                      type="text"
                      value={newEmpPhone}
                      onChange={(e) => {
                        try {
                          const phone = e.target.value;
                          setNewEmpPhone(phone);
                          setNewEmpUsername(generateUsernameWithPhone(newEmpName, phone));
                        } catch (err) { console.error('Error updating phone:', err); }
                      }}
                      placeholder="0912345xxx"
                      className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 px-3 text-xs text-white outline-none pointer-events-auto"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Tên Đăng Nhập (Username) *</label>
                    <input
                      type="text"
                      value={newEmpUsername}
                      onChange={(e) => {
                        try { setNewEmpUsername(e.target.value.toLowerCase().trim()); } catch (err) { console.error('Error updating username:', err); }
                      }}
                      placeholder="ndlong"
                      className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 px-3 text-xs text-emerald-400 font-mono font-bold outline-none pointer-events-auto"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Mật Khẩu *</label>
                    <input
                      type="text"
                      value={newEmpPassword}
                      onChange={(e) => {
                        try { setNewEmpPassword(e.target.value); } catch (err) { console.error('Error updating password:', err); }
                      }}
                      placeholder="123"
                      className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 px-3 text-xs text-white outline-none pointer-events-auto"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Nhóm Vai Trò (Phân Quyền) *</label>
                    <select
                      value={newEmpRoleGroupId}
                      onChange={(e) => {
                        try { setNewEmpRoleGroupId(e.target.value); } catch (err) { console.error('Error updating role group:', err); }
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white outline-none text-xs pointer-events-auto"
                    >
                      {hrmRoleGroups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                    <p className="text-[9px] text-slate-500 mt-1">Nhân viên sẽ được gán vào nhóm này để nhận quyền module tương ứng</p>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (!newEmpName.trim()) {
                        alert('Vui lòng điền họ và tên nhân sự thiết lập!');
                        return;
                      }
                      const usernameToUse = newEmpUsername.trim() || generateUsernameWithPhone(newEmpName, newEmpPhone);
                      const newId = `emp_${Date.now()}`;

                      // Tạo đối tượng nhân viên mới
                      const created: Employee = {
                        id: newId,
                        name: newEmpName.trim(),
                        role: 'engineer', // Legacy field — fallback nếu Role Groups rỗng
                        roleGroupIds: [newEmpRoleGroupId], // Nguồn sự thật chính cho phân quyền menu
                        email: `${usernameToUse}@hoanglonglamdong.vn`,
                        phone: newEmpPhone.trim() || '09xxxxxxxx',
                        department: newEmpDept.trim() || 'Phòng Ban Liên Quan',
                        username: usernameToUse,
                        password: hashPasswordSync(newEmpPassword || '123')
                      };

                      // Thêm employee vào Role Group đã chọn (Supabase là nguồn sự thật)
                      try {
                        const cached = localStorage.getItem('hl_cached_hrm_role_groups');
                        const hrmRolesList = cached ? JSON.parse(cached) : [];
                        if (Array.isArray(hrmRolesList)) {
                          const targetRole = hrmRolesList.find((r: any) => r.id === newEmpRoleGroupId);
                          if (targetRole) {
                            targetRole.memberIds = targetRole.memberIds || [];
                            targetRole.memberIds.push(newId);
                            // Ghi cache localStorage (2 keys để tương thích reader cũ)
                            const updated = JSON.stringify(hrmRolesList);
                            localStorage.setItem('hl_cached_hrm_role_groups', updated);
                            localStorage.setItem('hl_hrm_roles_v2', updated);
                            // Sync lên Supabase (nguồn sự thật)
                            dbService.hrmRoleGroups.save({
                              id: targetRole.id,
                              name: targetRole.name,
                              description: targetRole.description || '',
                              permissions: targetRole.permissions || {},
                              memberIds: targetRole.memberIds || [],
                            }).catch(() => {});
                          }
                        }
                      } catch (e) {
                        console.error("Lỗi khi thêm nhân viên vào Role Group:", e);
                      }

                      const updatedList = [...employees, created];
                      setEmployees(updatedList);
                      dbService.employees.save(created);
                      
                      // Reset local inputs
                      setNewEmpName('');
                      setNewEmpUsername('');
                      setNewEmpPassword('123');
                      setNewEmpPhone('');
                      setNewEmpDept('Phòng Dự Án - Xây Dựng');
                      setNewEmpRole('engineer');
                      setNewEmpRoleGroupId('role_office');

                      alert(`🎉 Thêm tài khoản người dùng "${created.name}" (${created.username}) thành công!`);
                    }}
                    className={`px-5 py-2 text-xs font-black rounded-lg flex items-center gap-1 cursor-pointer transition-all ${accentBgClass}`}
                  >
                    <Plus className="w-4 h-4 cursor-pointer" />
                    Thêm Tài Khoản
                  </button>
                </div>
              </div>

              {/* bảng người dùng */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Users className={`w-4 h-4 ${accentTextClass}`} />
                    <h3 className="text-xs font-black text-white uppercase tracking-wider font-mono">
                      👤 Danh Sách Tài Khoản Hệ Thống ({employees.length})
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleSync26Accounts}
                    className="flex items-center gap-1 px-3 py-1 bg-indigo-600/90 hover:bg-indigo-600 text-white font-bold text-[10px] uppercase font-mono rounded border border-indigo-500 transition-all cursor-pointer shadow-md"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Tạo Tài Khoản Từ Nhân Sự
                  </button>
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
                      {employees.map((emp) => (
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
                                    if (employees.length <= 1) {
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

              {/* PHẦN 2: CÀI ĐẶT HIỂN THỊ */}
              {subSettingsTab === 'display' && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg max-w-4xl space-y-6" id="view_display_settings_pane">
                  
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                    <Palette className={`w-4 h-4 ${accentTextClass}`} />
                    <h3 className="text-xs font-black text-white uppercase tracking-wider font-mono">
                      Cấu hình Giao Diện, Sắc Màu Chủ Đạo & Phông Chữ Hệ Thống
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2">
                    {/* CHỌN TONE MÀU & FONT */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-4">

                      {/* 🎨 CHỌN MÀU SẮC CHỦ ĐẠO */}
                      <div className="pt-3.5 border-t border-slate-900">
                        <label className="block text-[11px] text-slate-300 font-black uppercase font-mono mb-2">
                          🎨 TÔNG MÀU CHỦ ĐẠO HỆ THỐNG
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { key: 'emerald', label: 'Emerald Green', desc: 'Lâm Đồng', style: 'bg-emerald-500' },
                            { key: 'sky', label: 'Sky Blue', desc: 'Mây Đà Lạt', style: 'bg-sky-500' },
                            { key: 'indigo', label: 'Marine Blue', desc: 'Xanh thẳm', style: 'bg-indigo-500' },
                            { key: 'amber', label: 'Mộc Amber', desc: 'Vân gỗ sồi', style: 'bg-amber-500' },
                            { key: 'rose', label: 'Rose Gold', desc: 'Ấm áp', style: 'bg-rose-500' },
                            { key: 'violet', label: 'Amethyst', desc: 'Thủy chung', style: 'bg-violet-500' }
                          ].map((clProps) => (
                            <button
                              key={clProps.key}
                              type="button"
                              onClick={() => {
                                setDisplaySettings({
                                  ...displaySettings,
                                  primaryAccent: clProps.key as any
                                });
                              }}
                              className={`p-2 rounded-lg border text-center transition-all cursor-pointer group flex flex-col items-center justify-center ${
                                displaySettings.primaryAccent === clProps.key
                                  ? 'bg-slate-900 border-slate-500 text-white shadow font-bold scale-101'
                                  : 'bg-slate-950/60 border-slate-850 hover:bg-slate-900 text-slate-400'
                              }`}
                            >
                              <span className={`w-3.5 h-3.5 rounded-full ${clProps.style} mb-1.5 ring-2 ring-slate-950 block`}></span>
                              <span className="text-[9.5px] font-black tracking-wide block leading-tight">{clProps.label}</span>
                              <span className="text-[7.5px] text-slate-500 block">{clProps.desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* ✍️ CHỌN FONT CHỮ */}
                      <div className="pt-3.5 border-t border-slate-900">
                        <label className="block text-[11px] text-slate-300 font-black uppercase font-mono mb-2">
                          ✍️ CHỌN PHÔNG CHỮ ĐỒNG NHẤT (GOOGLE FONTS VIỆT)
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { key: 'Inter', label: '1. Inter', desc: 'Sắc nét, đa năng' },
                            { key: 'Roboto', label: '2. Roboto', desc: 'Hiện đại, dễ nhìn' },
                            { key: 'Be Vietnam Pro', label: '3. Be Vietnam Pro', desc: 'Thiết kế cho tiếng Việt' },
                            { key: 'Nunito', label: '4. Nunito', desc: 'Tròn trịa, thanh tao' },
                            { key: 'Lora', label: '5. Lora (Serif)', desc: 'Có chân, chữ sách' },
                            { key: 'Fira Sans', label: '6. Fira Sans', desc: 'Rõ ràng, chuyên nghiệp' }
                          ].map((fontOpt) => (
                            <button
                              key={fontOpt.key}
                              type="button"
                              onClick={() => {
                                setDisplaySettings({
                                  ...displaySettings,
                                  fontFamily: fontOpt.key
                                });
                              }}
                              className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                                (displaySettings.fontFamily || 'Inter') === fontOpt.key
                                  ? 'bg-slate-900 border-slate-500 text-white shadow font-bold scale-101'
                                  : 'bg-slate-950/60 border-slate-850 hover:bg-slate-900 text-slate-400'
                              }`}
                              style={{ fontFamily: fontOpt.key }}
                            >
                              <span className="text-[10px] font-bold block">{fontOpt.label}</span>
                              <span className="text-[7.5px] text-slate-500 block leading-tight">{fontOpt.desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                    </div>

                    {/* chỉnh sửa text thương hiệu */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-4">
                      <label className="block text-[11px] text-slate-300 font-black uppercase font-mono">
                        📝 Thay Đổi Danh Xưng & Khẩu Hiệu Bảng Biển
                      </label>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-[9px] text-slate-400 font-bold mb-1 uppercase">Viết Tắt Logo (2 Ký Tự)</label>
                          <input
                            type="text"
                            maxLength={3}
                            value={editLogoText}
                            onChange={(e) => setEditLogoText(e.target.value)}
                            className="bg-slate-900 border border-slate-800 text-xs text-white rounded p-1.5 px-2.5 w-full font-mono font-bold outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] text-slate-400 font-bold mb-1 uppercase">Tên Thương Hiệu Chính (Sidebar)</label>
                          <input
                            type="text"
                            value={editBrandName}
                            onChange={(e) => setEditBrandName(e.target.value)}
                            className="bg-slate-900 border border-slate-800 text-xs text-white rounded p-1.5 px-2.5 w-full outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] text-slate-400 font-bold mb-1 uppercase">Slogan Thương Hiệu Kèm Theo</label>
                          <input
                            type="text"
                            value={editBrandSlogan}
                            onChange={(e) => setEditBrandSlogan(e.target.value)}
                            className="bg-slate-900 border border-slate-800 text-xs text-white rounded p-1.5 px-2.5 w-full outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] text-slate-400 font-bold mb-1 uppercase">Khẩu Hiện Động Có Sức Truyền Cảm Hứng (Chân Sidebar)</label>
                          <textarea
                            value={editMotivationQuote}
                            onChange={(e) => setEditMotivationQuote(e.target.value)}
                            rows={2}
                            className="bg-slate-900 border border-slate-805 text-xs text-slate-300 rounded p-1.5 px-2.5 w-full outline-none resize-none font-semibold leading-normal"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] text-slate-400 font-bold mb-1 uppercase">Tiêu Đề Trang Tổng Quan (Dashboard Title Banner)</label>
                          <input
                            type="text"
                            value={editDashboardTitle}
                            onChange={(e) => setEditDashboardTitle(e.target.value)}
                            className="bg-slate-900 border border-slate-800 text-xs text-white rounded p-1.5 px-2.5 w-full outline-none"
                          />
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* ACTION SAVE */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-800 bg-slate-950/20 p-4 rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Bạn có muốn khôi phục hiển thị và câu từ về định danh gốc của Hoàng Long ERP không?')) {
                          const original = {
                            primaryAccent: 'emerald',
                            logoText: 'HL',
                            brandName: 'Hoàng Long',
                            brandSlogan: 'Lâm Đồng ERP',
                            dashboardTitle: 'Hệ Thống Chỉ Số Doanh Nghiệp',
                            motivationQuote: '"May mắn đứng về phía người dám đương đầu."',
                            fontFamily: 'Inter'
                          };
                          setDisplaySettings(original as any);
                          localStorage.setItem('hl_display_settings', JSON.stringify(original));
                          alert('🌈 Trả về các thông số hiển thị mặc định của Hoàng Long ERP thành công!');
                        }
                      }}
                      className="text-xs text-slate-500 hover:text-rose-500 font-bold transition-all bg-slate-100 border border-slate-200 p-2 px-4 rounded-xl"
                    >
                      🔄 TRẢ VỀ ĐỊNH DANH MẶC ĐỊNH
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const payload = {
                          primaryAccent: displaySettings.primaryAccent,
                          logoText: editLogoText.trim() || 'HL',
                          brandName: editBrandName.trim() || 'Hoàng Long',
                          brandSlogan: editBrandSlogan.trim() || 'Lâm Đồng ERP',
                          dashboardTitle: editDashboardTitle.trim() || 'Hệ Thống Chỉ Số Doanh Nghiệp',
                          motivationQuote: editMotivationQuote.trim() || '"May mắn đứng về phía người dám đương đầu."',
                          fontFamily: displaySettings.fontFamily || 'Inter'
                        };
                        setDisplaySettings(payload as any);
                        localStorage.setItem('hl_display_settings', JSON.stringify(payload));
                        alert('💾 Đã áp dụng & lưu cấu hình toàn bộ các câu chữ thương hiệu và tone màu mới!');
                      }}
                      className={`px-6 py-2.5 text-xs font-black rounded-xl transition-all cursor-pointer shadow-md ${accentBgClass}`}
                    >
                      💾 LƯU CẤU HÌNH HIỂN THỊ
                    </button>
                  </div>
                </div>
              )}

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
                        localStorage.setItem('hl_business_info', JSON.stringify(updated));
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
                        allowLate: hrmConfig.allowedLateMinutes,
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
                        allowLate: hrmConfig.allowedLateMinutes,
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
                                    const updated = { ...hrmConfig, allowedLateMinutes: val };
                                    setHrmConfig(updated);
                                    dbService.shiftConfig.save(updated).catch(err => console.error('Supabase shiftConfig save error:', err));
                                    window.dispatchEvent(new Event('storage'));
                                    window.dispatchEvent(new CustomEvent('hl_system_settings_updated'));
                                  }}
                                  onBlur={() => {
                                    if (hrmConfig.allowedLateMinutes === undefined || hrmConfig.allowedLateMinutes === null) {
                                      const updated = { ...hrmConfig, allowedLateMinutes: 15 };
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
                  subcontractor: 'director-subcontractor'
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
              notifications={notifications}
              onUpdateNotifications={(updated) => setNotifications(updated)}
              initialPaneTab={messengerInitialTab}
              initialConversationId={initialConvId ?? undefined}
              initialNotificationId={initialNotificationId}
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
}
