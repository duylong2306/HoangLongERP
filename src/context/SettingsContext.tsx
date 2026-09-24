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

// Dùng làm giá trị hiện tạm thời (trước khi tải xong từ Supabase) cho bản sao
// CHỈ ĐỌC của businessInfo trong context này (xem ghi chú tại nơi khai báo state).
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
  /** CHỈ ĐỌC — dùng để in phiếu/hoá đơn (FinanceManagement, MaterialCoordination).
   * Nguồn chỉnh sửa duy nhất là form "1. Hồ Sơ Thông Tin Doanh Nghiệp" trong
   * App.tsx (tự lưu thẳng qua dbService.businessProfile). Xem ghi chú tại nơi
   * khai báo bên dưới để biết lý do KHÔNG có updateBusinessInfo ở context này. */
  businessInfo: BusinessInfo;
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

  // ── Business Info (CHỈ ĐỌC, không tự lưu) ──
  // Trước đây có state ghi/lưu riêng ở đây, khởi tạo mặc định cứng rồi LƯU ĐÈ
  // lên Supabase ngay mỗi khi Provider mount (kể cả không ai sửa gì) — xóa mất
  // dữ liệu thật vừa được cập nhật từ form "Hồ Sơ Thông Tin Doanh Nghiệp" ở
  // App.tsx mỗi lần tải lại trang. Nay chỉ ĐỌC 1 lần từ cache local (hiện ngay,
  // tránh nháy UI khi in phiếu) rồi tải bản mới nhất từ Supabase để cập nhật —
  // không còn ghi ngược lại bảng business_profile từ đây nữa.
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>(() => {
    try {
      const saved = localStorage.getItem('hl_business_info');
      if (saved) return { ...DEFAULT_BUSINESS_INFO, ...JSON.parse(saved) };
    } catch {} /* eslint-disable-line no-empty */
    return DEFAULT_BUSINESS_INFO;
  });

  useEffect(() => {
    dbService.businessProfile.get().then(profile => {
      if (!profile) return;
      setBusinessInfo(profile);
      try { localStorage.setItem('hl_business_info', JSON.stringify(profile)); } catch {} /* eslint-disable-line no-empty */
    }).catch(() => {});
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
    hrmConfig,
    updateHrmConfig,
    accentTextClass: accentClasses.accentTextClass,
    accentBgClass: accentClasses.accentBgClass,
    accentBorderClass: accentClasses.accentBorderClass,
    sidebarActiveTabClass: accentClasses.sidebarActiveTabClass,
  }), [
    displaySettings, updateDisplaySettings,
    businessInfo,
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

export interface ConfiguredApprover {
  id: string;
  name: string;
  position?: string;
}

/**
 * Giải mã một trong các trường approverId/approverName/approverPosition/settlerId/settlerName/
 * settlerPosition (xem ghi chú ở HrmApprovalConfig trong ../types.ts) thành mảng chuỗi.
 * - Chuỗi rỗng/undefined → [].
 * - Chuỗi JSON hợp lệ dạng mảng (dữ liệu mới, nhiều người) → parse trực tiếp.
 * - Chuỗi thường (dữ liệu cũ, 1 người, trước khi hỗ trợ nhiều người) → coi như mảng 1 phần tử.
 */
function decodeApprovalList(raw?: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string' && v !== '');
  } catch {
    // Không phải JSON → dữ liệu cũ dạng chuỗi đơn, rơi xuống dưới
  }
  return [raw];
}

/** Mã hóa mảng chuỗi thành 1 chuỗi JSON để lưu vào cột text (xem decodeApprovalList ở trên). */
function encodeApprovalList(ids: string[]): string {
  return JSON.stringify(ids);
}

/** Ghép 3 trường (idField/nameField/positionField) đã JSON-encode thành danh sách ConfiguredApprover. */
function zipApprovers(idsRaw?: string, namesRaw?: string, positionsRaw?: string): ConfiguredApprover[] {
  const ids = decodeApprovalList(idsRaw);
  const names = decodeApprovalList(namesRaw);
  const positions = decodeApprovalList(positionsRaw);
  return ids.map((id, i) => ({ id, name: names[i] || '', position: positions[i] || undefined }));
}

/**
 * Đóng gói lại 1 danh sách ConfiguredApprover thành { id, name, position } (mỗi field đã JSON-encode)
 * để ghi vào approverId/approverName/approverPosition (hoặc settlerId/settlerName/settlerPosition)
 * của ApprovalPermission. Dùng ở RolesTab.tsx khi người dùng thêm/bớt người duyệt trong ô chọn nhiều.
 */
export function encodeApprovalApprovers(list: ConfiguredApprover[]): { id: string; name: string; position: string } {
  return {
    id: encodeApprovalList(list.map(a => a.id)),
    name: encodeApprovalList(list.map(a => a.name)),
    position: encodeApprovalList(list.map(a => a.position || '')),
  };
}

/**
 * Lấy TOÀN BỘ danh sách người có quyền duyệt được cấu hình trong Quyền Phê Duyệt theo loại hồ sơ
 * (toàn cục). Bất kỳ ai trong danh sách trả về đều có quyền duyệt (song song, không tuần tự).
 * Dùng cho: kiểm tra quyền hiện nút Duyệt/Từ chối, hiển thị đủ danh sách tên, gửi thông báo cho
 * tất cả người duyệt.
 */
export function getConfiguredApprovers(documentType: ApprovalPermission['documentType']): ConfiguredApprover[] {
  const configs = loadApprovalConfig();
  const match = configs.find(p => p.documentType === documentType && p.canApprove);
  if (!match) return [];
  return zipApprovers(match.approverId, match.approverName, match.approverPosition);
}

/**
 * Lấy TOÀN BỘ danh sách người quyết toán (kế toán lập phiếu chi / quyết toán) được cấu hình trong
 * Quyền Phê Duyệt theo loại hồ sơ (toàn cục). Dùng cho Đề Xuất Chi Phí & Tạm Ứng Thầu Phụ.
 */
export function getConfiguredSettlers(documentType: ApprovalPermission['documentType']): ConfiguredApprover[] {
  const configs = loadApprovalConfig();
  const match = configs.find(p => p.documentType === documentType && p.canApprove);
  if (!match) return [];
  return zipApprovers(match.settlerId, match.settlerName, match.settlerPosition);
}

/**
 * Lấy MỘT người phê duyệt "đại diện" (người đầu tiên trong danh sách) được cấu hình trong Quyền
 * Phê Duyệt theo loại hồ sơ (toàn cục). Dùng ở những nơi chỉ cần gán 1 giá trị mặc định vào hồ sơ
 * (VD: approverId của 1 đơn xin nghỉ phép) — hồ sơ đó vẫn chỉ lưu 1 người, còn quyền THAO TÁC duyệt
 * (hiện nút Duyệt/Từ chối) phải dùng getConfiguredApprovers() để kiểm tra currentUser có nằm trong
 * TOÀN BỘ danh sách hay không, không chỉ so với người đầu tiên này.
 */
export function getConfiguredApprover(documentType: ApprovalPermission['documentType']): ConfiguredApprover | null {
  return getConfiguredApprovers(documentType)[0] || null;
}

/** Tương tự getConfiguredApprover() nhưng cho người quyết toán — xem ghi chú ở trên. */
export function getConfiguredSettler(documentType: ApprovalPermission['documentType']): ConfiguredApprover | null {
  return getConfiguredSettlers(documentType)[0] || null;
}

/**
 * Suy ra ĐÚNG loại hồ sơ (documentType trong Quyền Phê Duyệt) mà 1 SubcontractorAdvanceProposal
 * thuộc về, dựa trên field `type` của đề xuất.
 *
 * LƯU Ý QUAN TRỌNG: luồng "Ứng Lương Nhanh" (DashboardOverview.tsx handleAdvanceSubmit) gán nhầm
 * `type: 'project_expense_proposal'` cho đề xuất ứng lương (thay vì 'salary_advance') — vì vậy
 * KHÔNG thể chỉ dựa vào `type` để nhận diện, phải kèm theo kiểm tra taskName bắt đầu bằng
 * "Ứng lương" (cùng quy ước đã dùng ở handleCreateVoucherFromProposal trong FinanceManagement.tsx).
 */
export function getProposalApprovalDocType(proposal: { type?: string; taskName?: string }): ApprovalPermission['documentType'] {
  const isSalaryAdvance = proposal.type === 'salary_advance' || !!proposal.taskName?.startsWith('Ứng lương');
  if (isSalaryAdvance) return 'salary_advance';
  if (proposal.type === 'subcontractor_advance') return 'finance_advance_proposal';
  // project_expense_proposal / supplier_payment_proposal / cash_fund_deposit / other_expense_proposal
  return 'finance_expense_proposal';
}

/**
 * Kiểm tra currentUser có nằm trong danh sách người được cấu hình xét duyệt (Quyền Phê Duyệt)
 * cho ĐÚNG loại hồ sơ của đề xuất này không — dùng để thay cho việc cấp quyền duyệt tràn lan
 * cho CẢ nhóm "Kế toán" (isRoleAccounting) bất kể họ có được add riêng cho loại đó hay không.
 */
export function isConfiguredApproverForProposal(empId: string | undefined, proposal: { type?: string; taskName?: string }): boolean {
  if (!empId) return false;
  const docType = getProposalApprovalDocType(proposal);
  return getConfiguredApprovers(docType).some(a => a.id === empId);
}

/**
 * Tương tự getProposalApprovalDocType() nhưng cho Payment (phiếu chi) — field `category` của
 * Payment không bị gán nhầm như `type` của SubcontractorAdvanceProposal nên map trực tiếp.
 */
export function getPaymentApprovalDocType(payment: { category?: string }): ApprovalPermission['documentType'] {
  if (payment.category === 'salary_advance') return 'salary_advance';
  if (payment.category === 'subcontractor_advance') return 'finance_advance_proposal';
  return 'finance_expense_proposal';
}

/** Tương tự isConfiguredApproverForProposal() nhưng cho Payment (phiếu chi). */
export function isConfiguredApproverForPayment(empId: string | undefined, payment: { category?: string }): boolean {
  if (!empId) return false;
  const docType = getPaymentApprovalDocType(payment);
  return getConfiguredApprovers(docType).some(a => a.id === empId);
}

/**
 * Lấy người điều phối vật tư được chỉ định trong Quyền Phê Duyệt (loại 'material_coordinator')
 */
export function getMaterialCoordinator(): ConfiguredApprover | null {
  return getConfiguredApprover('material_coordinator');
}

/** Lấy TOÀN BỘ danh sách người điều phối vật tư (bất kỳ ai trong danh sách đều có quyền). */
export function getMaterialCoordinators(): ConfiguredApprover[] {
  return getConfiguredApprovers('material_coordinator');
}

/**
 * Lấy người xét duyệt vật tư được chỉ định trong Quyền Phê Duyệt (loại 'material_approver')
 */
export function getMaterialApprover(): ConfiguredApprover | null {
  return getConfiguredApprover('material_approver');
}

/** Lấy TOÀN BỘ danh sách người xét duyệt vật tư (bất kỳ ai trong danh sách đều có quyền). */
export function getMaterialApprovers(): ConfiguredApprover[] {
  return getConfiguredApprovers('material_approver');
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

// ─── "Loại nhóm" (RoleGroupKind) ─────────────────────────────────────────
// RÀ SOÁT PHÁT HIỆN (2026-09): rất nhiều nơi trong app (FinanceManagement, TaskManagement,
// MaterialCoordination, các Archive, DashboardOverview...) kiểm tra đặc quyền bằng
// isUserInRoleGroup(uid, 'role_admin' | 'role_accounting' | 'role_office' | 'role_technical') —
// 4 ID CỐ ĐỊNH trùng với id của 6 nhóm MẪU mặc định của hệ thống. Nhưng khi người dùng tự tạo
// nhóm qua "Thêm nhóm" (RolesTab.tsx), nhóm mới luôn có id dạng role_custom_<timestamp> — KHÔNG
// BAO GIỜ trùng 4 ID cố định đó — nên toàn bộ 87 kiểm tra này ÂM THẦM LUÔN TRẢ VỀ FALSE cho mọi
// nhân viên thật (đã xác nhận bằng test trên dữ liệu thật: xem src/context/__tests__/
// realDataPermissionAudit.test.ts), dù nhóm của họ tên là "Giám Đốc"/"Kế toán"/... và đã được
// gán đầy đủ thành viên.
//
// Sửa tận gốc: thêm "loại nhóm" (kind) mà admin CHỌN THỦ CÔNG khi cấu hình 1 nhóm — đánh dấu nhóm
// đó "tương đương" 1 trong 4 vai trò hệ thống mặc định, bất kể id/tên nhóm là gì. Các hàm
// isRoleAdmin/isRoleAccounting/isRoleOffice/isRoleTechnical bên dưới kiểm tra CẢ id cố định cũ
// (tương thích ngược) LẪN kind mới — dùng thay cho isUserInRoleGroup(uid, 'role_xxx') ở mọi nơi.
//
// Lưu trữ: bảng Supabase hrm_role_groups KHÔNG có cột "kind" riêng (chỉ có id/name/description/
// permissions jsonb/member_ids) — thêm cột mới cần chạy migration DDL mà phiên làm việc này không
// có quyền thực thi trên DB thật. Để hoạt động NGAY không cần migration, kind được lưu như một
// pseudo-module đặc biệt bên trong "permissions" (đã là jsonb tự do) — KHÔNG đọc/ghi trực tiếp,
// luôn qua getRoleGroupKind()/withRoleGroupKind() ở dưới.
export type RoleGroupKind = 'admin' | 'accounting' | 'office' | 'technical';
const ROLE_KIND_KEY_PREFIX = '__role_kind__';
export const ROLE_GROUP_KIND_LABELS: Record<RoleGroupKind, string> = {
  admin: 'Quản trị viên (Admin / Giám đốc)',
  accounting: 'Kế toán',
  office: 'Văn phòng / Quản lý dự án',
  technical: 'Kỹ thuật',
};

/** Đọc "loại nhóm" đã gán cho 1 nhóm vai trò (từ permissions của nó), hoặc null nếu chưa gán. */
export function getRoleGroupKind(permissions?: Record<string, { view?: boolean }>): RoleGroupKind | null {
  if (!permissions) return null;
  const key = Object.keys(permissions).find(k => k.startsWith(ROLE_KIND_KEY_PREFIX) && permissions[k]?.view);
  return key ? (key.slice(ROLE_KIND_KEY_PREFIX.length) as RoleGroupKind) : null;
}

/** Trả về bản permissions mới đã gán (hoặc gỡ, nếu kind=null) "loại nhóm" — dùng khi lưu draft ở RolesTab.tsx. */
export function withRoleGroupKind<T extends Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean }>>(
  permissions: T | undefined,
  kind: RoleGroupKind | null
): T {
  const cleaned: any = {};
  Object.entries(permissions || {}).forEach(([k, v]) => {
    if (!k.startsWith(ROLE_KIND_KEY_PREFIX)) cleaned[k] = v;
  });
  if (kind) cleaned[`${ROLE_KIND_KEY_PREFIX}${kind}`] = { view: true, create: false, edit: false, delete: false };
  return cleaned;
}

/** Có nhân viên nào thuộc 1 nhóm được gán "loại nhóm" = kind hay không (Siêu Admin/admin luôn bypass). */
function isUserInRoleGroupKind(empId: string | undefined, kind: RoleGroupKind): boolean {
  if (!empId) return false;
  const groups = loadHrmRoleGroups();
  const superGroup = groups.find(g => g.id === 'role_superadmin');
  if (superGroup?.memberIds?.includes(empId)) return true;
  if (empId === 'emp_admin' || empId === 'NV_ADMIN' || empId === 'admin') return true;
  return groups.some(g => g.memberIds?.includes(empId) && getRoleGroupKind(g.permissions) === kind);
}

/**
 * Dùng các hàm này (KHÔNG dùng isUserInRoleGroup(uid, 'role_admin'|'role_accounting'|'role_office'|
 * 'role_technical') trực tiếp nữa) để kiểm tra đặc quyền — chúng nhận diện đúng dữ liệu thật
 * (nhóm tùy chỉnh đã gán "loại nhóm") LẪN dữ liệu quy ước cũ (nhóm có đúng id cố định, nếu có).
 */
export function isRoleAdmin(empId: string | undefined): boolean {
  return isUserInRoleGroup(empId, 'role_admin') || isUserInRoleGroupKind(empId, 'admin');
}
export function isRoleAccounting(empId: string | undefined): boolean {
  return isUserInRoleGroup(empId, 'role_accounting') || isUserInRoleGroupKind(empId, 'accounting');
}
export function isRoleOffice(empId: string | undefined): boolean {
  return isUserInRoleGroup(empId, 'role_office') || isUserInRoleGroupKind(empId, 'office');
}
export function isRoleTechnical(empId: string | undefined): boolean {
  return isUserInRoleGroup(empId, 'role_technical') || isUserInRoleGroupKind(empId, 'technical');
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

  // Admin (role_admin/role_superadmin theo id, hoặc nhóm được gán "loại nhóm" = admin) luôn full quyền
  if (isRoleAdmin(empId)) return true;

  const groups = loadHrmRoleGroups();
  const userGroups = groups.filter(g => g.memberIds?.includes(empId));
  if (userGroups.length === 0) return false;

  for (const group of userGroups) {
    const perms = group.permissions || {};
    const modulePerms = perms[moduleCode];

    // 1. Module này ĐÃ có cấu hình RIÊNG (dù đang tắt) → dùng đúng giá trị đó, KHÔNG rơi về
    //    quyền của menu cha. Trước đây luôn OR với cha (bước 2), nên khi admin tick full quyền
    //    ở menu cha "Kho & Vật Tư" rồi CHỦ Ý untick riêng 1 module con (VD "Quản lý tồn kho"),
    //    module con đó vẫn bị coi là có quyền — vì cha vẫn true nhờ các module con khác — ngược
    //    hẳn ý định thực sự của admin. Quyền module con (cụ thể) phải luôn thắng quyền cha
    //    (tổng quát) một khi đã được cấu hình riêng.
    if (modulePerms) {
      if (modulePerms[action]) return true;
      continue;
    }

    // 2. Module này CHƯA từng được cấu hình riêng → kế thừa theo menu cha
    const parentCode = Object.keys(MODULE_PARENT_CHILDREN).find(
      p => MODULE_PARENT_CHILDREN[p].includes(moduleCode)
    );
    if (parentCode && perms[parentCode]?.[action]) return true;
  }

  return false;
}

