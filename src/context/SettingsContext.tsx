import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { dbService, stableStr } from '../lib/dbService';
import { refreshHrmConfigCache } from '../components/hr/hrCalculations';
import type { HrmRoleGroup, HrmApprovalConfig, HrmApprovalConfig as ApprovalPermission } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DisplaySettings {
  primaryAccent: 'emerald' | 'sky' | 'indigo' | 'amber' | 'rose' | 'violet';
  logoText: string;
  brandName: string;
  brandSlogan: string;
  dashboardTitle: string;
  motivationQuote: string;
  fontFamily: string;
}

export interface BusinessInfo {
  companyName: string;
  taxCode: string;
  representative: string;
  phone: string;
  email: string;
  address: string;
  foundingYear: string;
  businessSector: string;
  bankInfo: string;
  scale: string;
}

export interface HrmConfig {
  morningIn: string;
  morningOut: string;
  afternoonIn: string;
  afternoonOut: string;
  overtimeIn: string;
  overtimeOut: string;
  gpsRadiusAllowed: number;
  antiFakeCam: boolean;
  punchOpenBeforeMinutes: number;
  punchCloseAfterMinutes: number;
  punchOutOpenBeforeMinutes: number;
  punchOutCloseAfterMinutes: number;
  otPunchOpenBeforeMinutes: number;
  otPunchCloseAfterMinutes: number;
  otPunchOutOpenBeforeMinutes: number;
  otPunchOutCloseAfterMinutes: number;
  allowedLateMinutes: number;
  allowedLateMorning?: number;    // Dung sai đi muộn ca Sáng (phút)
  allowedLateAfternoon?: number;  // Dung sai đi muộn ca Chiều (phút)
  weekendDays: number[];
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  primaryAccent: 'emerald',
  logoText: 'HL',
  brandName: 'Hoàng Long',
  brandSlogan: 'Lâm Đồng ERP',
  dashboardTitle: 'Tổng Quan',
  motivationQuote: '"May mắn đứng về phía người dám đương đầu."',
  fontFamily: 'Inter',
};

const DEFAULT_BUSINESS_INFO: BusinessInfo = {
  companyName: 'CÔNG TY TNHH LÂM NGHIỆP & XÂY DỰNG HOÀNG LONG',
  taxCode: '5801456789',
  representative: 'Trương Hữu Long',
  phone: '0988.123.456',
  email: 'contact@hoanglonglamdong.vn',
  address: 'Số 120 Đường Trần Phú, Phường 2, TP. Bảo Lộc, Lâm Đồng',
  foundingYear: '2016',
  businessSector: 'Xây dựng dân dụng, sản xuất và thi công nội thất mộc cabinet, gia công cơ khí cấu kiện thép',
  bankInfo: '1023456789 - Vietcombank Chi nhánh Bảo Lộc',
  scale: 'Hơn 150 kỹ sư & thợ lành nghề',
};

const DEFAULT_HRM_CONFIG: HrmConfig = {
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
  allowedLateMorning: 15,
  allowedLateAfternoon: 15,
  weekendDays: [0],
};

// ─── Helpers (extracted from App.tsx) ─────────────────────────────────────────

export function generateUsername(name: string): string {
  if (!name) return '';
  let cleanName = name.normalize('NFD').replace(/[̀-ͯ]/g, '');
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
}

export function generateUsernameWithPhone(name: string, phone: string): string {
  if (!name) return '';
  let cleanName = name.normalize('NFD').replace(/[̀-ͯ]/g, '');
  cleanName = cleanName.replace(/[đĐ]/g, 'd');
  cleanName = cleanName.replace(/[^a-zA-Z0-9\s]/g, '');
  const words = cleanName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'user';
  const lastName = words[words.length - 1].toLowerCase();
  const cleanPhone = (phone || '').replace(/\D/g, '');
  const last3Digits = cleanPhone.length >= 3 ? cleanPhone.slice(-3) : '123';
  return `${lastName}${last3Digits}`;
}

export function getEmployeePermissionGroupName(emp: any, hrmRoles?: any[]): string {
  try {
    // 1. Try finding by matching employee ID in memberIds
    if (hrmRoles && Array.isArray(hrmRoles)) {
      const foundRole = hrmRoles.find((r: any) => r.memberIds && r.memberIds.includes(emp.id));
      if (foundRole) return foundRole.name;
    }

    // 2. Try mapping from old role field
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
}

export function getAccentClasses(accent: string) {
  const textClass =
    accent === 'emerald' ? 'text-emerald-400' :
    accent === 'sky' ? 'text-sky-400' :
    accent === 'indigo' ? 'text-indigo-400' :
    accent === 'amber' ? 'text-amber-400' :
    accent === 'rose' ? 'text-rose-400' : 'text-violet-400';

  const bgClass =
    accent === 'emerald' ? 'bg-emerald-500 text-slate-950 font-black' :
    accent === 'sky' ? 'bg-sky-500 text-slate-100 font-black' :
    accent === 'indigo' ? 'bg-indigo-500 text-white font-black' :
    accent === 'amber' ? 'bg-amber-500 text-slate-950 font-black' :
    accent === 'rose' ? 'bg-rose-500 text-white font-black' : 'bg-violet-500 text-white font-black';

  const borderClass =
    accent === 'emerald' ? 'border-emerald-500/20' :
    accent === 'sky' ? 'border-sky-500/20' :
    accent === 'indigo' ? 'border-indigo-500/20' :
    accent === 'amber' ? 'border-amber-500/20' :
    accent === 'rose' ? 'border-rose-500/20' : 'border-violet-500/20';

  const sidebarActiveClass =
    accent === 'emerald' ? 'bg-slate-800 text-emerald-400 border-emerald-500/20 font-bold' :
    accent === 'sky' ? 'bg-slate-800 text-sky-400 border-sky-500/20 font-bold' :
    accent === 'indigo' ? 'bg-slate-800 text-indigo-400 border-indigo-500/20 font-bold' :
    accent === 'amber' ? 'bg-slate-800 text-amber-400 border-amber-500/20 font-bold' :
    accent === 'rose' ? 'bg-slate-800 text-rose-400 border-rose-500/20 font-bold' : 'bg-slate-800 text-violet-400 border-violet-500/20 font-bold';

  return { accentTextClass: textClass, accentBgClass: bgClass, accentBorderClass: borderClass, sidebarActiveTabClass: sidebarActiveClass };
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface SettingsContextValue {
  displaySettings: DisplaySettings;
  updateDisplaySettings: (updates: Partial<DisplaySettings>) => void;
  businessInfo: BusinessInfo;
  updateBusinessInfo: (updates: Partial<BusinessInfo>) => void;
  hrmConfig: HrmConfig;
  updateHrmConfig: (updates: Partial<HrmConfig>) => void;
  /** Computed accent classes (reactive) */
  accentTextClass: string;
  accentBgClass: string;
  accentBorderClass: string;
  sidebarActiveTabClass: string;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SettingsProvider({ children }: { children: ReactNode }) {
  // ── Display Settings ──
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(() => {
    try {
      const saved = localStorage.getItem('hl_display_settings');
      if (saved) return { ...DEFAULT_DISPLAY_SETTINGS, ...JSON.parse(saved) };
    } catch {} /* eslint-disable-line no-empty */
    return DEFAULT_DISPLAY_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem('hl_display_settings', JSON.stringify(displaySettings));
  }, [displaySettings]);

  const updateDisplaySettings = useCallback((updates: Partial<DisplaySettings>) => {
    setDisplaySettings(prev => ({ ...prev, ...updates }));
  }, []);

  // ── Business Info ──
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>(() => {
    try {
      const saved = localStorage.getItem('hl_business_info');
      if (saved) return { ...DEFAULT_BUSINESS_INFO, ...JSON.parse(saved) };
    } catch {} /* eslint-disable-line no-empty */
    return DEFAULT_BUSINESS_INFO;
  });

  // Chặn vòng lặp realtime: chỉ save khi NỘI DUNG thật sự khác lần lưu trước
  // (setState từ realtime tạo object mới cùng nội dung → không save).
  const lastSavedBizRef = React.useRef<string | null>(null);
  useEffect(() => {
    localStorage.setItem('hl_business_info', JSON.stringify(businessInfo));
    const next = stableStr(businessInfo);
    if (lastSavedBizRef.current !== null && next === lastSavedBizRef.current) return;
    lastSavedBizRef.current = next;
    dbService.businessProfile.save(businessInfo).catch(err => console.warn('SettingsContext: save businessProfile failed:', err));
  }, [businessInfo]);

  const updateBusinessInfo = useCallback((updates: Partial<BusinessInfo>) => {
    setBusinessInfo(prev => ({ ...prev, ...updates }));
  }, []);

  // ── HRM Config ──
  const [hrmConfig, setHrmConfig] = useState<HrmConfig>(DEFAULT_HRM_CONFIG);
  const hrmConfigLoadedRef = React.useRef(false);

  // Load từ Supabase khi mount
  useEffect(() => {
    (async () => {
      try {
        const cloud = await dbService.shiftConfig.get();
        if (cloud) {
          setHrmConfig(prev => ({
            ...prev,
            ...cloud,
            weekendDays: cloud.weekendDays ?? [0],
            allowedLateMinutes: cloud.allowedLateMinutes ?? 15,
            allowedLateMorning: cloud.allowedLateMorning ?? 15,
            allowedLateAfternoon: cloud.allowedLateAfternoon ?? 15,
          }));
        }
        // Nạp cache cho hrCalculations (readHrmConfigFromStorage)
        await refreshHrmConfigCache();
      } catch (e) {
        console.warn('SettingsContext: load shiftConfig from Supabase failed:', e);
      } finally {
        hrmConfigLoadedRef.current = true;
      }
    })();
  }, []);

  // Save Supabase only khi hrmConfig thay đổi SAU KHI đã load xong.
  // Chặn vòng lặp realtime: chỉ save khi NỘI DUNG thật sự khác lần lưu trước.
  const lastSavedCfgRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!hrmConfigLoadedRef.current) return;
    const next = stableStr(hrmConfig);
    if (lastSavedCfgRef.current !== null && next === lastSavedCfgRef.current) return;
    lastSavedCfgRef.current = next;
    dbService.shiftConfig.save(hrmConfig).catch(err => console.warn('SettingsContext: save shiftConfig failed:', err));
  }, [hrmConfig]);

  const updateHrmConfig = useCallback((updates: Partial<HrmConfig>) => {
    setHrmConfig(prev => ({ ...prev, ...updates }));
  }, []);

  // ── Lắng nghe realtime: refresh in-memory cache phân quyền (role groups + approval config) ──
  useEffect(() => {
    const handleRoleGroupsUpdated = () => {
      dbService.hrmRoleGroups.list()
        .then(groups => { if (groups && groups.length > 0) setRoleGroupsCache(groups); })
        .catch(err => console.warn('SettingsContext: realtime refresh role groups failed:', err));
    };
    const handleApprovalConfigUpdated = () => {
      syncApprovalConfigFromDb()
        .then(configs => { if (configs && configs.length > 0) setApprovalConfigCache(configs); })
        .catch(err => console.warn('SettingsContext: realtime refresh approval config failed:', err));
    };
    window.addEventListener('hl-hrm-role-groups-updated', handleRoleGroupsUpdated);
    window.addEventListener('hl-hrm-approval-config-updated', handleApprovalConfigUpdated);
    return () => {
      window.removeEventListener('hl-hrm-role-groups-updated', handleRoleGroupsUpdated);
      window.removeEventListener('hl-hrm-approval-config-updated', handleApprovalConfigUpdated);
    };
  }, []);

  // ── Computed accent classes (reactive) ──
  const accentClasses = useMemo(() => getAccentClasses(displaySettings.primaryAccent), [displaySettings.primaryAccent]);

  const value = useMemo<SettingsContextValue>(() => ({
    displaySettings,
    updateDisplaySettings,
    businessInfo,
    updateBusinessInfo,
    hrmConfig,
    updateHrmConfig,
    accentTextClass: accentClasses.accentTextClass,
    accentBgClass: accentClasses.accentBgClass,
    accentBorderClass: accentClasses.accentBorderClass,
    sidebarActiveTabClass: accentClasses.sidebarActiveTabClass,
  }), [
    displaySettings, updateDisplaySettings,
    businessInfo, updateBusinessInfo,
    hrmConfig, updateHrmConfig,
    accentClasses,
  ]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

// ─── Consumer Hook ────────────────────────────────────────────────────────────

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return ctx;
}

// ─── Role Group Helpers ──────────────────────────────────────────────────────

// Các interface HrmRoleGroup, ApprovalPermission đã được chuyển sang ../types
export type { HrmRoleGroup, HrmApprovalConfig as ApprovalPermission } from '../types';

// In-memory cache: được populate từ Supabase khi app mount.
// Ngoài ra còn phản hồi qua localStorage (bản snapshot lần đồng bộ thành công gần
// nhất) để khi mạng chậm — điển hình trên mobile — phân quyền vẫn đọc được NGAY,
// tránh lỗi "Giám đốc không thấy toàn bộ công việc" do cache rỗng lúc khởi tạo.
const ROLE_GROUPS_STORAGE_KEY = 'hl_role_groups_cache_v1';
let _roleGroupsCache: HrmRoleGroup[] | null = null;

// In-memory cache cho cấu hình Quyền Phê Duyệt — populate từ Supabase khi app mount
// (cũng như role groups). Đây là nguồn duy nhất cho getConfiguredApprover.
let _approvalConfigCache: ApprovalPermission[] | null = null;

/** Được gọi từ App.tsx (poll) và RolesTab sau khi lưu, để nạp config vào bộ nhớ. */
export function setApprovalConfigCache(configs: ApprovalPermission[]): void {
  _approvalConfigCache = configs;
}

/**
 * Gọi từ App.tsx sau khi fetch role groups từ Supabase để populate in-memory cache.
 * Đồng thời snapshot xuống localStorage — nguồn fallback đồng bộ cho lần mở sau.
 */
export function setRoleGroupsCache(groups: HrmRoleGroup[]): void {
  _roleGroupsCache = groups;
  try {
    localStorage.setItem(ROLE_GROUPS_STORAGE_KEY, JSON.stringify(groups));
  } catch (e) {
    console.warn('Không thể snapshot role groups xuống localStorage:', e);
  }
}

/**
 * Đọc danh sách Role Groups.
 * Ưu tiên in-memory cache (đã load từ Supabase). Nếu chưa có (mạng chậm, khởi
 * động lại), đọc snapshot đồng bộ từ localStorage của lần đồng bộ thành công
 * trước đó — đảm bảo phân quyền (vd. Giám Đốc / role_admin) sẵn sàng NGAY trên
 * render đầu tiên mà không cần chờ Supabase.
 */
export function loadHrmRoleGroups(): HrmRoleGroup[] {
  if (_roleGroupsCache) return _roleGroupsCache;
  try {
    const saved = localStorage.getItem(ROLE_GROUPS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        _roleGroupsCache = parsed as HrmRoleGroup[];
        return _roleGroupsCache;
      }
    }
  } catch (e) {
    console.warn('Lỗi đọc role groups snapshot từ localStorage:', e);
  }
  // Chưa có dữ liệu nào → fail-secure: trả về []
  return [];
}

/**
 * Lưu danh sách cấu hình Quyền Phê Duyệt xuống localStorage và đồng bộ Supabase
 */
export async function saveApprovalConfig(config: ApprovalPermission[]): Promise<void> {
  try {
    // Đồng bộ Supabase — chờ tất cả hoàn tất
    await Promise.all(
      config.map(cfg =>
        dbService.hrmApprovalConfig.save(cfg as any).catch(e => {
          console.error('Supabase hrmApprovalConfig save error:', e);
          throw e; // Propagate lỗi để caller biết
        })
      )
    );
  } catch (e) {
    console.error('Lỗi lưu cấu hình phê duyệt:', e);
    throw e;
  }
}

/**
 * Đọc danh sách cấu hình Quyền Phê Duyệt (nguồn: in-memory cache đã nạp từ Supabase).
 */
export function loadApprovalConfig(): ApprovalPermission[] {
  return _approvalConfigCache ?? [];
}

/**
 * Đồng bộ cấu hình Quyền Phê Duyệt từ Supabase.
 * Gọi khi component mount để đảm bảo dữ liệu mới nhất từ DB.
 */
export async function syncApprovalConfigFromDb(): Promise<ApprovalPermission[]> {
  try {
    const dbConfigs = await dbService.hrmApprovalConfig.list();
    if (dbConfigs && dbConfigs.length > 0) {
      return dbConfigs as ApprovalPermission[];
    }
  } catch (e) {
    console.error('Supabase hrmApprovalConfig sync error:', e);
  }
  return [];
}

// ─── Snapshot lưu làm mặc định cho 3 tab phân quyền ──────────────────────
const DEFAULT_SNAPSHOT_KEYS: Record<string, string> = {
  group: 'hl_hrm_roles_default_v1',
  project: 'hl_hrm_project_perms_default_v1',
  approval: 'hl_hrm_approval_default_v1',
};

/**
 * Đặt cấu hình mặc định cho tab Group / Project / Approval
 */
export async function saveDefaultSnapshot(tab: 'group' | 'project' | 'approval', data: any): Promise<void> {
  try {
    localStorage.setItem(DEFAULT_SNAPSHOT_KEYS[tab], JSON.stringify(data));
    // Đồng bộ Supabase — chờ tất cả hoàn tất
    await dbService.hrmDefaultSnapshots.save(tab, data).catch(e => {
      console.error('Supabase hrmDefaultSnapshots save error:', e);
      throw e; // Propagate lỗi để caller biết
    });
  } catch (e) {
    console.error(`Lỗi ghi default snapshot ${tab}:`, e);
    throw e;
  }
}

export function loadDefaultSnapshot(tab: 'group' | 'project' | 'approval'): any | null {
  try {
    const saved = localStorage.getItem(DEFAULT_SNAPSHOT_KEYS[tab]);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error(`Lỗi đọc default snapshot ${tab}:`, e);
  }
  return null;
}

export function clearDefaultSnapshot(tab: 'group' | 'project' | 'approval'): void {
  try {
    localStorage.removeItem(DEFAULT_SNAPSHOT_KEYS[tab]);
  } catch (e) {
    console.error(`Lỗi xoá default snapshot ${tab}:`, e);
  }
}

/**
 * Lấy người phê duyệt được cấu hình trong Quyền Phê Duyệt theo loại hồ sơ (toàn cục)
 */
export function getConfiguredApprover(documentType: ApprovalPermission['documentType']): { name: string; id: string; position?: string } | null {
  const configs = loadApprovalConfig();
  const match = configs.find(p => p.documentType === documentType && p.canApprove);
  if (match) {
    return { name: match.approverName, id: match.approverId, position: match.approverPosition };
  }
  return null;
}

/**
 * Lấy người quyết toán (kế toán lập phiếu chi) được cấu hình trong Quyền Phê Duyệt
 * theo loại hồ sơ (toàn cục). Dùng cho Đề Xuất Chi Phí & Tạm Ứng Thầu Phụ.
 */
export function getConfiguredSettler(documentType: ApprovalPermission['documentType']): { name: string; id: string; position?: string } | null {
  const configs = loadApprovalConfig();
  const match = configs.find(p => p.documentType === documentType && p.canApprove);
  if (match && match.settlerId) {
    return { name: match.settlerName || '', id: match.settlerId, position: match.settlerPosition };
  }
  return null;
}

/**
 * Lấy người điều phối vật tư được chỉ định trong Quyền Phê Duyệt (loại 'material_coordinator')
 */
export function getMaterialCoordinator(): { name: string; id: string; position?: string } | null {
  return getConfiguredApprover('material_coordinator');
}

/**
 * Lấy người xét duyệt vật tư được chỉ định trong Quyền Phê Duyệt (loại 'material_approver')
 */
export function getMaterialApprover(): { name: string; id: string; position?: string } | null {
  return getConfiguredApprover('material_approver');
}

/**
 * Kiểm tra user có thuộc Role Group nào đó không
 * @param empId ID của nhân viên
 * @param groupId ID của Role Group (vd: 'role_admin', 'role_accounting')
 */
export function isUserInRoleGroup(empId: string | undefined, groupId: string): boolean {
  if (!empId) return false;
  const groups = loadHrmRoleGroups();
  const group = groups.find(g => g.id === groupId);
  if (group ? group.memberIds.includes(empId) : false) return true;
  // Super admin: thuộc mọi role group
  const superGroup = groups.find(g => g.id === 'role_superadmin');
  if (superGroup?.memberIds?.includes(empId)) return true;
  // Fallback: tài khoản admin đặc biệt luôn full quyền
  if (empId === 'emp_admin' || empId === 'NV_ADMIN' || empId === 'admin') return true;
  return false;
}

/**
 * Kiểm tra user có thuộc bất kỳ Role Group nào trong danh sách không
 */
export function isUserInAnyRoleGroup(empId: string | undefined, groupIds: string[]): boolean {
  if (!empId) return false;
  return groupIds.some(gid => isUserInRoleGroup(empId, gid));
}

/**
 * Ánh xạ parent-child cho module permissions
 */
const MODULE_PARENT_CHILDREN: Record<string, string[]> = {
  director_office: ['director_dashboard'],
  project_office: ['projects_construction', 'projects_furniture', 'projects_mechanical'],
  hr_office: ['employees', 'hr_data'],
  accounting_office: ['finance', 'finance_data'],
  warehouse_office: ['material_coordination', 'warehouse_suppliers', 'warehouse_management'],
  subcontractor_office: ['subcontractor_management'],
  library_office: ['quotes_construction', 'quotes', 'quotes_mechanical', 'quotes_subcontractor'],
  system_office: ['settings_accounts', 'settings_roles', 'settings'],
};

/**
 * Kiểm tra user có quyền cụ thể (view/create/edit/delete) trên module code không.
 * Hỗ trợ kế thừa: có quyền cha → có quyền con.
 * @param empId   ID nhân viên
 * @param moduleCode  Mã phân hệ (VD: 'projects_construction')
 * @param action  Hành động: 'view' | 'create' | 'edit' | 'delete'
 * @returns boolean
 */
export function hasModulePermission(empId: string | undefined, moduleCode: string, action: 'view' | 'create' | 'edit' | 'delete'): boolean {
  if (!empId) return false;

  // Admin role luôn full quyền
  if (isUserInRoleGroup(empId, 'role_admin')) return true;

  const groups = loadHrmRoleGroups();
  const userGroups = groups.filter(g => g.memberIds?.includes(empId));
  if (userGroups.length === 0) return false;

  for (const group of userGroups) {
    const perms = group.permissions || {};

    // 1. Kiểm tra trực tiếp trên module
    if (perms[moduleCode]?.[action]) return true;

    // 2. Kế thừa từ cha: nếu có quyền cha → có quyền con
    const parentCode = Object.keys(MODULE_PARENT_CHILDREN).find(
      p => MODULE_PARENT_CHILDREN[p].includes(moduleCode)
    );
    if (parentCode && perms[parentCode]?.[action]) return true;
  }

  return false;
}

