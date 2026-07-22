import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { dbService } from '../lib/dbService';
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
  weekendDays: number[];
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  primaryAccent: 'emerald',
  logoText: 'HL',
  brandName: 'Hoàng Long',
  brandSlogan: 'Lâm Đồng ERP',
  dashboardTitle: 'Hệ Thống Chỉ Số Doanh Nghiệp',
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

  useEffect(() => {
    // Update both localStorage and Supabase when businessInfo changes
    localStorage.setItem('hl_business_info', JSON.stringify(businessInfo));
    dbService.businessProfile.save(businessInfo).catch(err => console.warn('SettingsContext: save businessProfile failed:', err));
  }, [businessInfo]);

  const updateBusinessInfo = useCallback((updates: Partial<BusinessInfo>) => {
    setBusinessInfo(prev => ({ ...prev, ...updates }));
  }, []);

  // ── HRM Config ──
  const [hrmConfig, setHrmConfig] = useState<HrmConfig>(() => {
    try {
      const saved = localStorage.getItem('hl_system_settings_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_HRM_CONFIG,
          ...parsed,
          // Ensure defaults for new fields
          weekendDays: parsed.weekendDays ?? [0],
          allowedLateMinutes: parsed.allowedLateMinutes ?? 15,
          punchOutOpenBeforeMinutes: parsed.punchOutOpenBeforeMinutes ?? 15,
          punchOutCloseAfterMinutes: parsed.punchOutCloseAfterMinutes ?? 15,
          otPunchOpenBeforeMinutes: parsed.otPunchOpenBeforeMinutes ?? 15,
          otPunchCloseAfterMinutes: parsed.otPunchCloseAfterMinutes ?? 15,
          otPunchOutOpenBeforeMinutes: parsed.otPunchOutOpenBeforeMinutes ?? 15,
          otPunchOutCloseAfterMinutes: parsed.otPunchOutCloseAfterMinutes ?? 15,
        };
      }
    } catch {} /* eslint-disable-line no-empty */
    return DEFAULT_HRM_CONFIG;
  });

  useEffect(() => {
    // Update both localStorage and Supabase when hrmConfig changes
    localStorage.setItem('hl_system_settings_v3', JSON.stringify(hrmConfig));
    dbService.shiftConfig.save(hrmConfig).catch(err => console.warn('SettingsContext: save shiftConfig failed:', err));
  }, [hrmConfig]);

  const updateHrmConfig = useCallback((updates: Partial<HrmConfig>) => {
    setHrmConfig(prev => ({ ...prev, ...updates }));
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

/** Đọc danh sách Role Groups từ localStorage (fallback) hoặc Supabase */
export function loadHrmRoleGroups(): HrmRoleGroup[] {
  // Ưu tiên cache local để tránh async
  try {
    const cached = localStorage.getItem('hl_cached_hrm_role_groups');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return parsed as HrmRoleGroup[];
    }
  } catch (e) {
    console.error('Lỗi đọc cache hrm_role_groups:', e);
  }
  // Fallback: đọc từ localStorage cũ
  try {
    const saved = localStorage.getItem('hl_hrm_roles_v2');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed as HrmRoleGroup[];
    }
  } catch (e) {
    console.error('Lỗi đọc hl_hrm_roles_v2:', e);
  }
  return [];
}

/**
 * Lưu danh sách cấu hình Quyền Phê Duyệt xuống localStorage và đồng bộ Supabase
 */
export function saveApprovalConfig(config: ApprovalPermission[]): void {
  try {
    localStorage.setItem('hl_hrm_approval_config', JSON.stringify(config));
    // Đồng bộ Supabase bất đồng bộ
    config.forEach(cfg => {
      dbService.hrmApprovalConfig.save(cfg as any).catch(() => {});
    });
  } catch (e) {
    console.error('Lỗi ghi hl_hrm_approval_config:', e);
  }
}

/**
 * Đọc danh sách cấu hình Quyền Phê Duyệt từ localStorage
 */
export function loadApprovalConfig(): ApprovalPermission[] {
  try {
    const saved = localStorage.getItem('hl_hrm_approval_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed as ApprovalPermission[];
    }
  } catch (e) {
    console.error('Lỗi đọc hl_hrm_approval_config:', e);
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
export function saveDefaultSnapshot(tab: 'group' | 'project' | 'approval', data: any): void {
  try {
    localStorage.setItem(DEFAULT_SNAPSHOT_KEYS[tab], JSON.stringify(data));
    // Đồng bộ Supabase
    dbService.hrmDefaultSnapshots.save(tab, data).catch(() => {});
  } catch (e) {
    console.error(`Lỗi ghi default snapshot ${tab}:`, e);
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
 * Kiểm tra user có thuộc Role Group nào đó không
 * @param empId ID của nhân viên
 * @param groupId ID của Role Group (vd: 'role_admin', 'role_accounting')
 */
export function isUserInRoleGroup(empId: string | undefined, groupId: string): boolean {
  if (!empId) return false;
  const groups = loadHrmRoleGroups();
  const group = groups.find(g => g.id === groupId);
  return group ? group.memberIds.includes(empId) : false;
}

/**
 * Kiểm tra user có thuộc bất kỳ Role Group nào trong danh sách không
 */
export function isUserInAnyRoleGroup(empId: string | undefined, groupIds: string[]): boolean {
  if (!empId) return false;
  return groupIds.some(gid => isUserInRoleGroup(empId, gid));
}

