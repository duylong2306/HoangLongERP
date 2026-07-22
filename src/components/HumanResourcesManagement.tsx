import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNotification, getConfiguredApprover } from '../context';
import { isUserInRoleGroup } from '../context';
import {
  Users, Clock, DollarSign, Calendar, Award,
  Briefcase, FileText, MapPin, ChevronRight,
  Plus, Search, Download, Info, CheckCircle,
  XCircle, AlertTriangle, Sliders, Send, BookOpen,
  Share2, Building, UserCheck, TrendingUp, CreditCard,
  CalendarCheck, FileSpreadsheet, Printer, ChevronDown,
  Lock, Unlock, Workflow, HelpCircle, FolderMinus, Database,
  Trash2, Percent, X, FileUp, Camera, Calculator, Shield
} from 'lucide-react';
import { SalaryScale, Employee } from '../types';
import { dbService } from '../lib/dbService';
import * as XLSX from 'xlsx';

import { Role, HRMProps, TravelAllowanceNorm, EmployeeProfile, Holiday, LeaveCoefficient, PerformanceCriterion, DepartmentCriteria, AttendanceLog, LeaveRequest, PayrollItem, KpiMetric, BusinessTrip, SOPDocument, EmployeeErrorLog } from './hr/hrTypes';
import { INITIAL_ROLES, DEFAULT_DEPARTMENT_CRITERIA } from './hr/hrInitialData';
import { getLocalYYYYMMDD, minutesDiff, readHrmConfigFromStorage, getAttendanceStatusText, removeVietnameseTones, getDeduplicatedCriteria, computeDailyWorkday, calculateSingleEmployeePayroll } from './hr/hrCalculations';
import { saveProjectPermissions } from './hr/hrProjectPermissions';
import TripsTab from './hr/tabs/TripsTab';
import LeavesTab from './hr/tabs/LeavesTab';
import PayrollTab from './hr/tabs/PayrollTab';
import PerformanceTab from './hr/tabs/PerformanceTab';
import ProfilesTab from './hr/tabs/ProfilesTab';
import AttendanceTab from './hr/tabs/AttendanceTab';
import HrDataTab from './hr/tabs/HrDataTab';
import RolesTab from './hr/tabs/RolesTab';

/* ============================================================================
 * HumanResourcesManagement.tsx — PHÂN HỆ QUẢN LÝ NHÂN SỰ (HRM) tổng hợp
 * ----------------------------------------------------------------------------
 * File này là "god component" (~6.2K dòng) gom toàn bộ phân hệ HRM. Nó giữ
 * state + handlers cục bộ, rồi render 8 sub-tab. 7/8 sub-tab đã được TÁCH ra
 * thành component con trong src/components/hr/tabs/* (chỉ phần render + một
 * số prop). Xem bản đồ hàm ở PROGRESS.md (mục "Cấu trúc HumanResourcesManagement.tsx").
 *
 * 8 SUB-TAB (chuyển bằng state `activeSubTab`):
 *   - profiles    : 👥 Hồ sơ & Hợp đồng nhân sự           -> <ProfilesTab>  (line 3635)
 *   - attendance  : ⏰ Nhật ký Chấm công & Lịch ca        -> <AttendanceTab>(line 3659)
 *   - leaves      : 📬 Đăng ký Nghỉ phép & Trừ phép        -> <LeavesTab>   (line 3691)
 *   - payroll     : 💰 Tính lương tự động                 -> <PayrollTab>   (line 3706)
 *   - performance : 🏆 Hiệu suất & Lỗi kỷ luật            -> <PerformanceTab>(line 3731)
 *   - trips       : ✈️ Công tác phí (Kế toán)             -> <TripsTab>     (line 3755)
 *   - hr_data     : 🗄️ Dữ liệu kế toán (lương, phép, định mức, BHXH, ...)
 *                                                        -> <HrDataTab>    (line 3771) [render inline, CHƯA tách riêng]
 *   - roles       : 🛡️ Phân quyền chức năng & Vai trò     -> <RolesTab>     (line 3835)
 *
 * CÁC MODULE ĐƯỢC TRỎ VỀ (cross-module references):
 *   - ./hr/hrTypes          : toán bộ type/interface (Role, EmployeeProfile, PayrollItem,
 *                             TravelAllowanceNorm, AttendanceLog, LeaveRequest, ...)
 *   - ./hr/hrInitialData    : INITIAL_ROLES (rỗng), DEFAULT_DEPARTMENT_CRITERIA (rỗng)
 *   - ./hr/hrCalculations   : logic thuần — getLocalYYYYMMDD, minutesDiff, readHrmConfigFromStorage,
 *                             getAttendanceStatusText, removeVietnameseTones, getDeduplicatedCriteria,
 *                             computeDailyWorkday, calculateSingleEmployeePayroll
 *   - ./hr/tabs/*           : 7 component con của các sub-tab (profiles→roles)
 *   - ../data/salaryScales  : INITIAL_SALARY_SCALES (rỗng — dữ liệu được lưu trên database/localStorage)
 *   - ../types              : SalaryScale, Employee (dùng cho form/tham chiếu chung)
 *   - ../context            : useNotification -> addToast (toast thông báo toàn cục)
 *   - xlsx (thư viện)       : xuất/nhập Excel bảng chấm công & lương
 *   - html2pdf.js (dynamic) : in phiếu lương PDF
 *
 * NGHIỆP VỤ (business rules đã cập nhật 07/2026):
 *   - Bảng chấm công (`attendanceFiltered`): chỉ HIỂN THỊ log của nhân viên ĐANG LÀM
 *     (`status === 'working'`), ẩn hoàn toàn nhân viên nghỉ việc/nghỉ phép.
 *   - Tạo log tự động (`executeAutoWorkdayLocking`): chỉ tạo KP/phép/lễ/cuối tuần
 *     cho nhân viên `working`.
 *   - Tính lương tự động (`handleCalculatePayroll`): chỉ tính lương cho nhân viên
 *     `working`, dựa trên `empAttendance` (workedDays, otSunday, otHoliday, otHours)
 *     từ log chấm công có `status === 'valid'`.
 *   - Chấm công thủ công (`handleSimulateCheckIn`): từ chối nếu nhân viên không
 *     phải `working`.
 * ========================================================================== */

// html2pdf.js has no TypeScript declarations and depends on browser globals (self, document)
// Use dynamic import to only load it in browser environment when actually needed
const loadHtml2Pdf = async () => {
  const mod = await import('html2pdf.js');
  return mod.default || mod;
};

const WorkdayCell = React.memo(function WorkdayCell({
  log,
  leaveCoefficients,
  holidays,
  weekendDays,
  leaves,
}: {
  log: any;
  leaveCoefficients: any[];
  holidays: any[];
  weekendDays: number[];
  leaves: any[];
}) {
  const result = useMemo(
    // ↓ Gọi logic thuần từ module ./hr/hrCalculations (tính công ngày: vào/ra, OT, phép, lễ)
    () => computeDailyWorkday(log, leaveCoefficients, holidays, weekendDays, leaves),
    [log, leaveCoefficients, holidays, weekendDays, leaves]
  );
  return (
    <div className="flex flex-col items-center justify-center space-y-1">
      <span className={`px-1.5 py-0.5 rounded font-mono font-black text-[10.5px] border select-none ${
        result.workday > 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
        result.workday < 0 ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
        'bg-slate-950 text-slate-400 border-slate-800'
      }`}>
        {result.label}
      </span>
      {log.isLocked ? (
        <span className="text-[8.5px] text-emerald-400 font-bold flex items-center gap-0.5 bg-emerald-950/40 px-1 py-0.5 rounded border border-emerald-900/30">
          <Lock className="w-2.5 h-2.5 shrink-0" />
          <span>Đã chốt</span>
        </span>
      ) : (
        <span className="text-[8.5px] text-amber-500 font-bold flex items-center gap-0.5 bg-amber-950/40 px-1 py-0.5 rounded border border-amber-905/20" title="Chờ duyệt">
          <Unlock className="w-2.5 h-2.5 shrink-0" />
          <span>Chờ duyệt</span>
        </span>
      )}
    </div>
  );
});

export default function HumanResourcesManagement({ currentUser, projects = [], customers = [], defaultSubTab, hideSidebar = false }: HRMProps) {
  const { addToast } = useNotification();
  // Tab list: "profiles", "attendance", "leaves", "payroll", "trips", "hr_data"
  const [activeSubTab, setActiveSubTab] = useState<string>(() => defaultSubTab || 'profiles');

  useEffect(() => {
    if (defaultSubTab) {
      setActiveSubTab(defaultSubTab);
    }
  }, [defaultSubTab]);
  const [menuDisplayMode, setMenuDisplayMode] = useState<'sidebar' | 'tabs'>('tabs');

  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [deletingErrorId, setDeletingErrorId] = useState<string | null>(null);
  const [editingAttendance, setEditingAttendance] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<any>(null);

  // Khởi tạo form sửa khi mở modal
  useEffect(() => {
    if (editingAttendance) {
      setEditForm({
        timeInS: editingAttendance.timeInS || '--:--',
        timeOutS: editingAttendance.timeOutS || '--:--',
        timeInC: editingAttendance.timeInC || '--:--',
        timeOutC: editingAttendance.timeOutC || '--:--',
        timeInOT: editingAttendance.timeInOT || '--:--',
        timeOutOT: editingAttendance.timeOutOT || '--:--',
        status: editingAttendance.status || 'valid',
        notes: editingAttendance.notes || '',
      });
    }
  }, [editingAttendance]);

  // ===================== BLOCK CHẤM CÔNG (attendance) =====================
  const handleSaveAttendanceEdit = () => {
    if (!editingAttendance || !editForm) return;

    // ── Validation: không cho phép giờ ra < giờ vào ──────────────────────────
    const isReal = (t: string) => t && t !== '--:--';
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

    const checks: { label: string; ok: boolean }[] = [
      // Ca sáng: ra >= vào
      { label: 'Ca Sáng: Giờ ra phải sau Giờ vào', ok: !isReal(editForm.timeInS) || !isReal(editForm.timeOutS) || toMin(editForm.timeOutS) >= toMin(editForm.timeInS) },
      // Ca chiều: ra >= vào
      { label: 'Ca Chiều: Giờ ra phải sau Giờ vào', ok: !isReal(editForm.timeInC) || !isReal(editForm.timeOutC) || toMin(editForm.timeOutC) >= toMin(editForm.timeInC) },
      // Ca chiều vào phải sau ca sáng ra
      { label: 'Ca Chiều: Giờ vào phải sau Giờ ra Ca Sáng', ok: !isReal(editForm.timeOutS) || !isReal(editForm.timeInC) || toMin(editForm.timeInC) >= toMin(editForm.timeOutS) },
      // OT: ra >= vào
      { label: 'Tăng Ca: Giờ ra phải sau Giờ vào', ok: !isReal(editForm.timeInOT) || !isReal(editForm.timeOutOT) || toMin(editForm.timeOutOT) >= toMin(editForm.timeInOT) },
    ];

    const failed = checks.filter(c => !c.ok);
    if (failed.length > 0) {
      addToast({
        title: '⛔ Giờ không hợp lệ',
        message: failed.map(f => `• ${f.label}`).join('\n'),
        type: 'error',
      });
      return;
    }

    const updated = attendance.map(a => {
      if (a.id === editingAttendance.id) {
        return {
          ...a,
          timeInS: editForm.timeInS,
          timeOutS: editForm.timeOutS,
          timeInC: editForm.timeInC,
          timeOutC: editForm.timeOutC,
          timeInOT: editForm.timeInOT,
          timeOutOT: editForm.timeOutOT,
          status: editForm.status,
          notes: editForm.notes,
        };
      }
      return a;
    });
    setAttendance(updated);
    setEditingAttendance(null);
    setEditForm(null);
    addToast({ title: '✅ Đã lưu', message: 'Đã cập nhật bản ghi chấm công thành công', type: 'success' });
  };

  const handleDeleteAttendance = (log: any) => {
    if (log.isLocked) {
      addToast({ title: '🔒 Không thể xóa', message: 'Bản ghi đã chốt công', type: 'warning' });
      return;
    }
    if (!confirm(`Xóa bản ghi chấm công của "${log.empName}" ngày ${log.date}?`)) return;
    const updated = attendance.filter(a => a.id !== log.id);
    setAttendance(updated);
    // Đồng bộ xóa lên Supabase
    dbService.attendance.delete(log.id).catch(err => console.warn('Xóa bản ghi chấm công trên Supabase thất bại:', err));
    addToast({ title: '🗑️ Đã xóa', message: 'Bản ghi chấm công đã được xóa', type: 'info' });
    window.dispatchEvent(new CustomEvent('hl-attendance-updated', { detail: { attendance: updated } }));
  };

  // Chỉ Giám đốc (role_admin) và Kế toán (role_accounting) được sửa/xóa bản ghi đã chốt công.
  // Nhân viên thường chỉ xem, không can thiệp vào dữ liệu đã chốt.
  const canManageLockedAttendance = (): boolean => {
    if (!currentUser) return false;
    return isUserInRoleGroup(currentUser.id, 'role_admin') || isUserInRoleGroup(currentUser.id, 'role_accounting');
  };

  const handleBulkLock = () => {
    let toLock = attendanceFiltered;
    if (bulkLockScope === 'page') {
      toLock = globalPageSize === 'all'
        ? attendanceFiltered
        : attendanceFiltered.slice((attendancePage - 1) * (globalPageSize as number), attendancePage * (globalPageSize as number));
    }
    const updated = attendance.map(a => {
      if (!a.isLocked && toLock.some(t => t.id === a.id)) {
        return { ...a, isLocked: true, notes: a.notes ? `${a.notes} (Chốt hàng loạt)` : 'Chốt hàng loạt' };
      }
      return a;
    });
    setAttendance(updated);
    setShowBulkLockModal(false);
    addToast({ title: '✅ Đã chốt', message: `Đã chốt ${updated.filter(a => a.isLocked && toLock.some(t => t.id === a.id)).length} bản ghi`, type: 'success' });
  };

  const attendanceFileInputRef = useRef<HTMLInputElement>(null);

  const handleExportAttendanceExcel = () => {
    const data = attendanceFiltered.map(log => ({
      'Mã NV': log.empId,
      'Tên nhân viên': log.empName,
      'Ngày': log.date,
      'Vào Sáng': log.timeInS,
      'Ra Sáng': log.timeOutS,
      'Vào Chiều': log.timeInC,
      'Ra Chiều': log.timeOutC,
      'Vào OT': log.timeInOT,
      'Ra OT': log.timeOutOT,
      'Giờ OT': log.otHours,
      'Phương thức': log.method,
      'Trạng thái': log.status,
      'Ghi chú': log.notes,
      'Đã chốt': log.isLocked ? 'X' : '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BangCong');
    const monthLabel = attendanceFilterMonth === 'all' ? 'tatca' : attendanceFilterMonth.padStart(2, '0');
    XLSX.writeFile(wb, `BangCong_${monthLabel}_${attendanceFilterYear}.xlsx`);
    addToast({ title: '✅ Xuất Excel', message: `Đã xuất ${data.length} bản ghi`, type: 'success' });
  };

  const handleImportAttendanceExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        const imported: AttendanceLog[] = rows.map((r, idx) => ({
          id: `AT-IMP-${Date.now()}-${idx}`,
          empId: String(r['Mã NV'] || '').trim(),
          empName: String(r['Tên nhân viên'] || '').trim(),
          date: String(r['Ngày'] || '').trim(),
          timeInS: String(r['Vào Sáng'] || '--:--'),
          timeOutS: String(r['Ra Sáng'] || '--:--'),
          timeInC: String(r['Vào Chiều'] || '--:--'),
          timeOutC: String(r['Ra Chiều'] || '--:--'),
          timeInOT: String(r['Vào OT'] || '--:--'),
          timeOutOT: String(r['Ra OT'] || '--:--'),
          method: String(r['Phương thức'] || 'Import Excel'),
          status: 'valid' as const,
          otHours: Number(r['Giờ OT'] || 0),
          notes: String(r['Ghi chú'] || 'Import từ Excel'),
          isLocked: false,
        })).filter(r => r.empId && r.date);
        if (imported.length === 0) {
          addToast({ title: '⚠️ Không có dữ liệu', message: 'File không có dòng hợp lệ (cần cột Mã NV, Tên nhân viên, Ngày)', type: 'warning' });
          return;
        }
        const merged = [...attendance];
        imported.forEach(imp => {
          const dupIdx = merged.findIndex(a => a.empId === imp.empId && a.date === imp.date);
          if (dupIdx > -1) merged[dupIdx] = { ...merged[dupIdx], ...imp };
          else merged.push(imp);
        });
        setAttendance(merged);
        addToast({ title: '✅ Nhập thành công', message: `Đã import ${imported.length} bản ghi`, type: 'success' });
      } catch (err) {
        addToast({ title: '⛔ Lỗi', message: 'Không thể đọc file Excel', type: 'error' });
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // ===================== BLOCK HỒ SƠ NHÂN SỰ (profiles) =====================
  const profileFileInputRef = useRef<HTMLInputElement>(null);

  const handleExportProfilesExcel = () => {
    if (employees.length === 0) {
      addToast({ title: '⚠️ Không có dữ liệu', message: 'Chưa có hồ sơ nhân sự nào để xuất.', type: 'warning' });
      return;
    }
    const data = employees.map(emp => ({
      'Mã NV': emp.id,
      'Họ tên': emp.name,
      'Giới tính': emp.gender,
      'Ngày sinh': emp.dob,
      'SĐT': emp.phone,
      'CCCD': emp.cccd,
      'Ngày cấp CCCD': emp.cccdIssuedDate || '',
      'Nơi cấp CCCD': emp.cccdIssuedPlace || '',
      'Email': emp.email,
      'Địa chỉ': emp.address,
      'Địa chỉ tạm trú': emp.currentAddress || emp.address,
      'Liên hệ khẩn cấp': emp.emergencyContact,
      'Bộ phận': emp.department,
      'Chức vụ': emp.position,
      'Loại hợp đồng': emp.contractType,
      'Thời hạn HĐ (tháng)': emp.contractDurationMonths || '',
      'Ngày vào làm': emp.startDate,
      'Trình độ': emp.education || '',
      'Mã ngạch lương': emp.salaryCode || '',
      'Phép năm': emp.phepNam !== undefined ? emp.phepNam : 12,
      'Ngân hàng': emp.bankName,
      'Số tài khoản': emp.bankAccount,
      'Trạng thái': emp.status === 'working' ? 'Đang làm' : emp.status === 'leave' ? 'Nghỉ phép' : 'Nghỉ làm',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'HoSoNhanSu');
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    XLSX.writeFile(wb, `HoSoNhanSu_${ymd}.xlsx`);
    addToast({ title: '✅ Xuất Excel', message: `Đã xuất ${data.length} hồ sơ nhân sự`, type: 'success' });
  };

  const handleImportProfilesExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        const imported: EmployeeProfile[] = rows.map((r, idx) => ({
          id: String(r['Mã NV'] || `NV_IMP_${Date.now()}_${idx}`).trim(),
          name: String(r['Họ tên'] || '').trim(),
          gender: String(r['Giới tính'] || 'Nam'),
          dob: String(r['Ngày sinh'] || ''),
          phone: String(r['SĐT'] || ''),
          cccd: String(r['CCCD'] || ''),
          cccdIssuedDate: String(r['Ngày cấp CCCD'] || ''),
          cccdIssuedPlace: String(r['Nơi cấp CCCD'] || ''),
          email: String(r['Email'] || ''),
          address: String(r['Địa chỉ'] || ''),
          currentAddress: String(r['Địa chỉ tạm trú'] || r['Địa chỉ'] || ''),
          emergencyContact: String(r['Liên hệ khẩn cấp'] || ''),
          department: String(r['Bộ phận'] || ''),
          position: String(r['Chức vụ'] || ''),
          contractType: String(r['Loại hợp đồng'] || ''),
          contractDurationMonths: r['Thời hạn HĐ (tháng)'] ? Number(r['Thời hạn HĐ (tháng)']) : undefined,
          startDate: String(r['Ngày vào làm'] || ''),
          education: String(r['Trình độ'] || ''),
          salaryCode: String(r['Mã ngạch lương'] || ''),
          phepNam: Number(r['Phép năm'] || 12),
          bankName: String(r['Ngân hàng'] || ''),
          bankAccount: String(r['Số tài khoản'] || ''),
          status: (String(r['Trạng thái'] || 'working').includes('Nghỉ làm') ? 'retired' : String(r['Trạng thái'] || 'working').includes('Nghỉ phép') ? 'leave' : 'working') as any,
          docsCount: 0,
        })).filter(r => r.id && r.name);
        if (imported.length === 0) {
          addToast({ title: '⚠️ Không có dữ liệu', message: 'File không có dòng hợp lệ (cần cột Mã NV, Họ tên).', type: 'warning' });
          return;
        }
        const merged = [...employees];
        imported.forEach(imp => {
          const dupIdx = merged.findIndex(a => a.id === imp.id);
          if (dupIdx > -1) merged[dupIdx] = { ...merged[dupIdx], ...imp };
          else merged.push(imp);
        });
        setEmployees(merged);
        addToast({ title: '✅ Nhập thành công', message: `Đã import ${imported.length} hồ sơ nhân sự`, type: 'success' });
      } catch (err) {
        addToast({ title: '⛔ Lỗi', message: 'Không thể đọc file Excel', type: 'error' });
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const [roles, setRoles] = useState<Role[]>([]);
  // Ref để tránh infinite loop khi re-fetch từ Supabase
  const isSyncingRolesFromCloud = useRef(false);

  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<{ roleId: string; empId: string } | null>(null);
  const [showAddRoleModal, setShowAddRoleModal] = useState<boolean>(false);
  const [newRoleName, setNewRoleName] = useState<string>('');
  const [newRoleDesc, setNewRoleDesc] = useState<string>('');

  const [roleSearchQuery, setRoleSearchQuery] = useState<string>('');
  const [selectedTempEmpIds, setSelectedTempEmpIds] = useState<string[]>([]);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState<boolean>(false);

  // States for system menu structure sync and customization
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);
  const [syncModalSelectedRoleId, setSyncModalSelectedRoleId] = useState<string>('role_admin');
  const [syncModalRolePerms, setSyncModalRolePerms] = useState<Record<string, Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean }>>>({});

  useEffect(() => {
    setRoleSearchQuery('');
    setSelectedTempEmpIds([]);
    setIsRoleDropdownOpen(false);
  }, [selectedRoleId]);

  // ===================== BLOCK PHÂN QUYỀN (roles) =====================
  const syncHrmPermissionsToApp = (updatedRoles: Role[]) => {
    const mapHrmRoleToAppRole = (roleId: string, roleName: string): string[] => {
      const name = roleName.toLowerCase();
      const keys: string[] = [];
      if (roleId === 'role_admin' || name.includes('giám đốc') || name.includes('admin') || roleId === 'director') keys.push('director');
      if (roleId === 'role_accounting' || name.includes('kế toán') || roleId === 'accountant') keys.push('accountant');
      if (roleId === 'role_office' || name.includes('văn phòng') || name.includes('pm') || name.includes('quản lý') || roleId === 'pm') keys.push('pm');
      if (roleId === 'role_technical' || name.includes('kỹ thuật') || name.includes('engineer') || roleId === 'engineer') keys.push('engineer');
      if (name.includes('báo giá') || name.includes('quotation') || roleId === 'quotation') keys.push('quotation');
      if (name.includes('mua sắm') || name.includes('purchasing') || roleId === 'purchasing') keys.push('purchasing');
      if (name.includes('xưởng') || name.includes('mộc') || name.includes('cơ khí') || name.includes('factory') || roleId === 'factory') keys.push('factory');
      
      keys.push(roleId);
      return keys;
    };

    const updatedAppPerms: Record<string, string[]> = {
      director: ['dashboard'],
      accountant: ['dashboard'],
      pm: ['dashboard'],
      engineer: ['dashboard'],
      quotation: ['dashboard'],
      purchasing: ['dashboard'],
      factory: ['dashboard']
    };

    const mapToAppTab = (code: string) => code.replace(/_/g, '-');

    updatedRoles.forEach(r => {
      const appRoleKeys = mapHrmRoleToAppRole(r.id, r.name);
      const allowedTabs: string[] = [];
      
      Object.keys(r.permissions).forEach(code => {
        if (r.permissions[code]?.view) {
          allowedTabs.push(mapToAppTab(code));
        }
      });

      appRoleKeys.forEach(key => {
        if (!updatedAppPerms[key]) {
          updatedAppPerms[key] = ['dashboard'];
        }
        allowedTabs.forEach(tab => {
          if (!updatedAppPerms[key].includes(tab)) {
            updatedAppPerms[key].push(tab);
          }
        });
      });
    });

    localStorage.setItem('hl_role_permissions', JSON.stringify(updatedAppPerms));
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('hl-roles-updated'));
  };

  const handleSyncSystemModules = () => {
    const allModulesList = [
      'director_office', 'director_dashboard',
      'project_office', 'projects_construction', 'projects_furniture', 'projects_mechanical', 'tasks',
      'hr_office', 'employees', 'hr_data',
      'accounting_office', 'finance', 'finance_data',
      'warehouse_office', 'material_coordination', 'warehouse_suppliers', 'warehouse_management',
      'subcontractor_office', 'subcontractor_management',
      'library_office', 'quotes_construction', 'quotes', 'quotes_mechanical', 'quotes_subcontractor',
      'system_office', 'settings_accounts', 'settings_roles', 'settings'
    ];

    const updatedRoles = roles.map(r => {
      const newPerms = { ...r.permissions };
      const isDirectorOrAdmin = r.id === 'role_admin' || r.name.toLowerCase().includes('giám đốc') || r.name.toLowerCase().includes('admin');

      allModulesList.forEach(code => {
        if (newPerms[code]) {
          return;
        }

        newPerms[code] = { view: false, create: false, edit: false, delete: false };

        if (isDirectorOrAdmin) {
          newPerms[code] = { view: true, create: true, edit: true, delete: true };
          return;
        }

        if (code === 'director_office' || code === 'director_dashboard') {
          const base = r.permissions['settings'] || r.permissions['reports'] || { view: false };
          if (base.view) newPerms[code] = { view: true, create: isDirectorOrAdmin, edit: isDirectorOrAdmin, delete: isDirectorOrAdmin };
        }
        else if (code === 'project_office') {
          const hasAnyProj = (r.permissions['projects_construction']?.view) || (r.permissions['projects_furniture']?.view) || (r.permissions['projects_mechanical']?.view);
          if (hasAnyProj) newPerms[code] = { view: true, create: true, edit: true, delete: false };
        }
        else if (code === 'hr_office' || code === 'hr_data') {
          const base = r.permissions['employees'] || { view: false };
          if (base.view) newPerms[code] = { ...base };
        }
        else if (code === 'accounting_office' || code === 'finance_data') {
          const base = r.permissions['finance'] || { view: false };
          if (base.view) newPerms[code] = { ...base };
        }
        else if (code === 'warehouse_office' || code === 'material_coordination' || code === 'warehouse_suppliers' || code === 'warehouse_management') {
          const base = r.permissions['finance'] || { view: false };
          if (base.view) newPerms[code] = { ...base };
        }
        else if (code === 'subcontractor_office' || code === 'subcontractor_management') {
          const baseFinance = r.permissions['finance'] || { view: false };
          const baseQuotes = r.permissions['quotes'] || { view: false };
          if (baseFinance.view || baseQuotes.view) {
            newPerms[code] = { view: true, create: (baseFinance as any).create || (baseQuotes as any).create, edit: (baseFinance as any).edit || (baseQuotes as any).edit, delete: (baseFinance as any).delete || (baseQuotes as any).delete };
          }
        }
        else if (code === 'library_office' || code === 'quotes_construction' || code === 'quotes_mechanical' || code === 'quotes_subcontractor') {
          const base = r.permissions['quotes'] || { view: false };
          if (base.view) newPerms[code] = { ...base };
        }
        else if (code === 'system_office' || code === 'settings_accounts' || code === 'settings_roles') {
          const base = r.permissions['settings'] || { view: false };
          if (base.view) newPerms[code] = { ...base };
        }
      });

      return { ...r, permissions: newPerms };
    });

    setRoles(updatedRoles);
    syncHrmPermissionsToApp(updatedRoles);

    addToast({ title: '✅ Thành công', message: "🎉 ĐÃ ĐỒNG BỘ PHÂN HỆ TOÀN HỆ THỐNG THÀNH CÔNG!\n\n1. Sơ đồ 8 menu cha và 20 menu con của hệ thống đã được cập nhật chính xác.\n2. Đã tự động kế thừa và di chuyển phân quyền thông minh từ các phân hệ cũ cho từng vai trò người dùng.\n3. Thanh điều hướng bên trái đã được đồng bộ hóa và phản ánh tức thì.", type: 'success' });
  };

  // When the sync modal opens, seed the temp permission state from each role's stored permissions
  useEffect(() => {
    if (!isSyncModalOpen) return;
    const seeded: Record<string, Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean }>> = {};
    roles.forEach(r => {
      seeded[r.id] = JSON.parse(JSON.stringify(r.permissions || {}));
    });
    setSyncModalRolePerms(seeded);
  }, [isSyncModalOpen, roles]);

  // Restore the currently selected role's temp permissions back to its stored defaults
  const handleRestoreSyncDefaults = () => {
    const currentRole = roles.find(r => r.id === syncModalSelectedRoleId);
    if (!currentRole) return;
    setSyncModalRolePerms(prev => {
      const next = { ...prev };
      next[syncModalSelectedRoleId] = JSON.parse(JSON.stringify(currentRole.permissions || {}));
      return next;
    });
  };

  // Commit the customized permissions for every role back into roles, persist, and sync to the app
  const handleSaveSyncPermissions = () => {
    const updatedRoles = roles.map(r => {
      const custom = syncModalRolePerms[r.id];
      if (!custom) return r;
      return { ...r, permissions: { ...r.permissions, ...custom } };
    });

    setRoles(updatedRoles);
    syncHrmPermissionsToApp(updatedRoles);

    addToast({
      title: '✅ Đã lưu & đồng bộ',
      message: 'Cấu hình phân quyền của các vai trò đã được lưu và đồng bộ sang ERP.',
      type: 'success'
    });
    setIsSyncModalOpen(false);
  };

  const [clearingState, setClearingState] = useState<{
    isOpen: boolean;
    tableName: string;
    targetTab: string;
  }>({
    isOpen: false,
    tableName: '',
    targetTab: ''
  });

  const executeClearData = () => {
    const { targetTab } = clearingState;
    if (targetTab === 'profiles') {
      setEmployees([]);
    } else if (targetTab === 'attendance') {
      setAttendance([]);
    } else if (targetTab === 'leaves') {
      setLeaves([]);
    } else if (targetTab === 'payroll') {
      setPayroll([]);
    } else if (targetTab === 'performance') {
      setEmployeeErrors([]);
    } else if (targetTab === 'trips') {
      setTrips([]);
      setTravelExpensesSummary([]);
    } else if (targetTab === 'holidays') {
      setHolidays([]);
    } else if (targetTab === 'coefficients') {
      setLeaveCoefficients([]);
    } else if (targetTab === 'criteria') {
      setDepartmentCriteria([]);
    } else if (targetTab === 'salary_scales') {
      setSalaryScales([]);
    } else if (targetTab === 'insurance') {
      const updated = employees.map((emp: any) => ({
        ...emp,
        bhxhBookNo: '',
        bhxhSalary: 0,
        bhxhRate: 0,
        taxPersonalRelief: 0,
        dependentCount: 0,
        bhxhDate: ''
      }));
      setEmployees(updated);
    } else if (targetTab === 'roles') {
      setRoles(INITIAL_ROLES);
    }
    setClearingState({ isOpen: false, tableName: '', targetTab: '' });
  };

  // Selected employee detail state & editing states
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [isEditingEmp, setIsEditingEmp] = useState(false);
  const [editingEmpData, setEditingEmpData] = useState<EmployeeProfile | null>(null);

  const [selectedLeaveId, setSelectedLeaveId] = useState<string | null>(null);

  // States for Department Performance Criteria
  const [showCriteriaModal, setShowCriteriaModal] = useState(false);
  const [selectedCriteriaDeptId, setSelectedCriteriaDeptId] = useState<string>('dept_all');
  const [criteriaSearchQuery, setCriteriaSearchQuery] = useState('');
  const [newCritCategory, setNewCritCategory] = useState<'readiness' | 'progress' | 'reporting'>('readiness');
  const [newCritContent, setNewCritContent] = useState('');
  const [editingCritId, setEditingCritId] = useState<string | null>(null);
  const [editingCritDeptId, setEditingCritDeptId] = useState<string | null>(null);

  // Employee Performance Violations/Errors States
  const [employeeErrors, setEmployeeErrors] = useState<EmployeeErrorLog[]>([]);

  const [errorSearchEmpId, setErrorSearchEmpId] = useState<string>('all');
  const [errorFilterMonth, setErrorFilterMonth] = useState<string>(() => String(new Date().getMonth() + 1)); // Mặc định tháng hiện tại
  const [errorFilterYear, setErrorFilterYear] = useState<string>(() => String(new Date().getFullYear())); // Mặc định năm hiện tại
  
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [editingErrorId, setEditingErrorId] = useState<string | null>(null);

  const [errFormEmpId, setErrFormEmpId] = useState('');
  const [errFormDeptId, setErrFormDeptId] = useState('dept_all');
  const [errFormCritId, setErrFormCritId] = useState('');
  const [errFormDate, setErrFormDate] = useState('2026-06-12');
  const [errFormNotes, setErrFormNotes] = useState('');
  const [errorFormCritSearch, setErrorFormCritSearch] = useState('');
  const [errFormImages, setErrFormImages] = useState<string[]>([]);
  const [errFormCameraActive, setErrFormCameraActive] = useState(false);
  const [errFormCameraStream, setErrFormCameraStream] = useState<MediaStream | null>(null);

  // Fallback variables for truncated panels to prevent compiler errors
  const [globalPageSize, setGlobalPageSize] = useState<number | 'all'>(() => {
    const saved = localStorage.getItem('hl_global_page_size');
    if (saved === 'all') return 'all';
    if (saved) {
      const val = parseInt(saved, 10);
      if (!isNaN(val)) return val;
    }
    return 10;
  });

  const [profilePage, setProfilePage] = useState(1);
  const [attendancePage, setAttendancePage] = useState(1);
  const [leavePage, setLeavePage] = useState(1);
  const [payrollPage, setPayrollPage] = useState(1);
  const [tripPage, setTripPage] = useState(1);

  const [salaryScales, setSalaryScales] = useState<SalaryScale[]>([]);

  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);

  const getApproversList = () => {
    // Lọc nhân sự cấp quản lý
    const defaultList: { name: string; role: string; id: string }[] = [];
    if (Array.isArray(employees)) {
      const filtered = employees.filter((e: any) => {
        const role = (e.position || '').toLowerCase();
        return (
          role.includes('giám đốc') ||
          role.includes('quản') ||
          role.includes('trưởng') ||
          role.includes('kế toán')
        );
      });
      if (filtered.length > 0) {
        return filtered.map((e: any) => ({
          name: e.name,
          role: e.position || 'Quản lý',
          id: e.id
        }));
      }
    }
    return defaultList;
  };

  const handleCreateSalaryAdvance = () => {
    const configuredApprover = getConfiguredApprover('salary_advance');
    if (configuredApprover) {
      setNewSalaryAdvance({ empId: '', amount: 0, reason: '', approverName: configuredApprover.name, approverId: configuredApprover.id });
    } else {
      setNewSalaryAdvance({ empId: '', amount: 0, reason: '', approverName: '', approverId: '' });
    }
    setShowSalaryAdvanceModal(true);
  };

  const handleSubmitSalaryAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSalaryAdvance.empId) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'Vui lòng chọn nhân viên cần tạm ứng.', type: 'warning' });
      return;
    }
    if (!newSalaryAdvance.amount || newSalaryAdvance.amount <= 0) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'Vui lòng nhập số tiền tạm ứng hợp lệ.', type: 'warning' });
      return;
    }
    if (!newSalaryAdvance.reason) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'Vui lòng nhập lý do tạm ứng.', type: 'warning' });
      return;
    }

    const emp = employees.find(ep => ep.id === newSalaryAdvance.empId);
    if (!emp) return;

    // Tạo đơn tạm ứng dưới dạng LeaveRequest với type='Tạm ứng lương nhanh'
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const submittedAtStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const todayStr = getLocalYYYYMMDD(new Date());

    const req: LeaveRequest = {
      id: `SA-${Date.now().toString().slice(-3)}`,
      empId: newSalaryAdvance.empId,
      empName: emp.name,
      type: 'Tạm ứng lương nhanh',
      fromDate: todayStr,
      toDate: todayStr,
      daysCount: 0,
      reason: `Tạm ứng lương ${newSalaryAdvance.amount.toLocaleString('vi-VN')}đ — ${newSalaryAdvance.reason}`,
      status: 'pending',
      createdAt: todayStr,
      submittedAt: submittedAtStr,
      approverName: newSalaryAdvance.approverName || '',
      approverId: newSalaryAdvance.approverId || ''
    };

    setLeaves([req, ...leaves]);
    setShowSalaryAdvanceModal(false);
    addToast({ title: '✅ Thành công', message: `Đề xuất tạm ứng lương ${newSalaryAdvance.amount.toLocaleString('vi-VN')}đ cho ${emp.name} đã được gửi trình duyệt.`, type: 'success' });

    // ← Sửa lỗi cho sổ cái tạm ứng phụ
    // Chuỗi sửa lỗi:
    // const [editedPayrollItems, setEditedPayrollItems] = useState<PayrollItem[]>(() => []);
    // const editedAdvances = editedPayrollItems.map(item => ({ ...item, advances: item.advances - (newSalaryAdvance.amount || 0) })).filter(item => item.advances !== item.advances);
    // const netAdvances = editedAdvances.length > 0 ? editedAdvances.reduce((sum, item) => sum + item.advances, 0) : 0;
    // const newAdvances = (newSalaryAdvance.amount || 0) - netAdvances;

    setNewSalaryAdvance({
      empId: '',
      amount: 0,
      reason: '',
      approverName: '',
      approverId: ''
    });
  };

  // Lấy người xét duyệt được cấu hình trong Quyền Phê Duyệt (toàn cục, không phụ thuộc role)
  // (Hàm getConfiguredApprover được import từ '../context')

  const [attendance, setAttendance] = useState<AttendanceLog[]>([]);

  // Ngày khởi tạo dữ liệu chấm công - chỉ chấm từ ngày này trở đi
  const [attendanceInitDate] = useState<string>(() => {
    const stored = localStorage.getItem('hl_attendance_init_date');
    if (stored) return stored;
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('hl_attendance_init_date', today);
    return today;
  });

  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);

  const [payroll, setPayroll] = useState<PayrollItem[]>([]);

  const [trips, setTrips] = useState<BusinessTrip[]>([]);

  const [weekendDays, setWeekendDays] = useState<number[]>([0]);

  useEffect(() => {
    dbService.shiftConfig.get().then(config => {
      if (config && Array.isArray(config.weekendDays)) {
        setWeekendDays(config.weekendDays);
      }
    }).catch(() => {});
  }, []);

  const [travelExpensesSummary, setTravelExpensesSummary] = useState<{ id: string; employeeId?: string; empId?: string; employeeName: string; amount: number; period: string; completedDate?: string; projectName?: string; customerName?: string; taskName?: string; missionName?: string; content?: string; month?: string; fuelFee?: number; mealFee?: number; lodgeFee?: number; otherFee?: number }[]>([]);



  const [confirmDeleteAllLogs, setConfirmDeleteAllLogs] = useState(false);

  const [selectedEmpFilter, setSelectedEmpFilter] = useState<string>('all');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>(() => String(new Date().getMonth() + 1)); // Mặc định tháng hiện tại
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>(() => String(new Date().getFullYear())); // Mặc định năm hiện tại

  const handleExportExcel = () => {
    const headers = [
      'Mã THCTP',
      'Ngày Hoàn Thành',
      'Tên Dự Án',
      'Khách hàng',
      'Công Việc',
      'Nhiệm Vụ',
      'Nhân Viên',
      'Nội Dung',
      'Số Tiền'
    ];

    let rowData = '';
    rowData += '<tr>' + headers.map(h => `<th style="background-color: #d97706; color: white; border: 1px solid #3f3f46; padding: 6px; font-family: Arial, sans-serif; font-size: 11px;">${h}</th>`).join('') + '</tr>';
    
    const dataRows = travelExpensesSummary.filter(item => {
      // Apply filters
      if (selectedEmpFilter !== 'all' && item.employeeName !== selectedEmpFilter) return false;
      if (item.completedDate) {
        const parts = item.completedDate.split('/');
        if (parts.length === 3) {
          const itemMonth = String(parseInt(parts[1], 10));
          const itemYear = parts[2];
          if (selectedMonthFilter !== 'all' && itemMonth !== selectedMonthFilter) return false;
          if (selectedYearFilter !== 'all' && itemYear !== selectedYearFilter) return false;
        } else {
          const dateObj = new Date(item.completedDate);
          if (!isNaN(dateObj.getTime())) {
            const itemMonth = String(dateObj.getMonth() + 1);
            const itemYear = String(dateObj.getFullYear());
            if (selectedMonthFilter !== 'all' && itemMonth !== selectedMonthFilter) return false;
            if (selectedYearFilter !== 'all' && itemYear !== selectedYearFilter) return false;
          }
        }
      }
      return true;
    });

    dataRows.forEach(item => {
      rowData += '<tr>';
      rowData += `<td style="border: 1px solid #3f3f46; padding: 6px; font-weight: bold; font-family: Arial, sans-serif; font-size: 11px;">${item.id || ''}</td>`;
      rowData += `<td style="border: 1px solid #3f3f46; padding: 6px; font-family: Arial, sans-serif; font-size: 11px;">${item.completedDate || ''}</td>`;
      rowData += `<td style="border: 1px solid #3f3f46; padding: 6px; font-family: Arial, sans-serif; font-size: 11px;">${item.projectName || ''}</td>`;
      rowData += `<td style="border: 1px solid #3f3f46; padding: 6px; font-family: Arial, sans-serif; font-size: 11px;">${item.customerName || ''}</td>`;
      rowData += `<td style="border: 1px solid #3f3f46; padding: 6px; font-family: Arial, sans-serif; font-size: 11px;">${item.taskName || ''}</td>`;
      rowData += `<td style="border: 1px solid #3f3f46; padding: 6px; font-family: Arial, sans-serif; font-size: 11px;">${item.missionName || ''}</td>`;
      rowData += `<td style="border: 1px solid #3f3f46; padding: 6px; font-weight: bold; font-family: Arial, sans-serif; font-size: 11px;">${item.employeeName || ''}</td>`;
      rowData += `<td style="border: 1px solid #3f3f46; padding: 6px; font-family: Arial, sans-serif; font-size: 11px;">${item.content || ''}</td>`;
      rowData += `<td style="border: 1px solid #3f3f46; padding: 6px; text-align: right; font-family: Arial, sans-serif; font-size: 11px;">${Number(item.amount || 0).toLocaleString('vi-VN')} đ</td>`;
      rowData += '</tr>';
    });

    const totalAmount = dataRows.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    rowData += '<tr>';
    rowData += `<td colspan="8" style="border: 1px solid #3f3f46; padding: 6px; font-weight: bold; text-align: right; background-color: #f4f4f5; font-family: Arial, sans-serif; font-size: 11px;">Tổng cộng:</td>`;
    rowData += `<td style="border: 1px solid #3f3f46; padding: 6px; font-weight: bold; text-align: right; color: #b45309; background-color: #f4f4f5; font-family: Arial, sans-serif; font-size: 11px;">${totalAmount.toLocaleString('vi-VN')} đ</td>`;
    rowData += '</tr>';

    const excelTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Bao Cao Hoa Don Cong Tac</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
      </head>
      <body>
        <h2 style="font-family: Arial, sans-serif; color: #1e3a8a;">BẢNG TỔNG HỢP CÔNG TÁC PHÍ - HOÀNG LONG GROUP</h2>
        <p style="font-family: Arial, sans-serif;">Thời gian xuất file: ${new Date().toLocaleString('vi-VN')}</p>
        <p style="font-family: Arial, sans-serif;">Bộ lọc đang chọn: Nhân viên: <strong>${selectedEmpFilter === 'all' ? 'Tất cả nhân viên' : selectedEmpFilter}</strong> | Tháng: <strong>${selectedMonthFilter === 'all' ? 'Tất cả' : 'Tháng ' + selectedMonthFilter}</strong> | Năm: <strong>${selectedYearFilter === 'all' ? 'Tất cả' : 'Năm ' + selectedYearFilter}</strong></p>
        <table style="font-family: Arial, sans-serif; font-size: 11px; border-collapse: collapse; border: 1px solid #3f3f46;">
          ${rowData}
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `TongHopCongTacPhi_${selectedMonthFilter !== 'all' ? 'Thang' + selectedMonthFilter : ''}_${selectedYearFilter !== 'all' ? 'Nam' + selectedYearFilter : ''}_${Date.now()}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // KPI states
  const [selectedRoleForKpi, setSelectedRoleForKpi] = useState<string>('project');
  const [officeKpis, setOfficeKpis] = useState<KpiMetric[]>([]);
  const [projectKpis, setProjectKpis] = useState<KpiMetric[]>([]);
  const [factoryKpis, setFactoryKpis] = useState<KpiMetric[]>([]);

  const [holidays, setHolidays] = useState<Holiday[]>([]);

  const [leaveCoefficients, setLeaveCoefficients] = useState<LeaveCoefficient[]>([]);

  const [activeHrDataSubTab, setActiveHrDataSubTab] = useState<'holidays' | 'coefficients' | 'criteria' | 'salary_scales' | 'insurance' | 'travel_norms'>('salary_scales');

  const [travelNorms, setTravelNorms] = useState<TravelAllowanceNorm[]>([]);

  // ===================== BLOCK CẤU HÌNH KẾ TOÁN (hr_data) =====================
  // (định mức công tác, ngày lễ, thang lương, hệ số phép, tiêu chí đánh giá, BHXH)
  const generateNextTravelNormCode = (currentNorms: TravelAllowanceNorm[]): string => {
    let maxNum = 0;
    currentNorms.forEach(norm => {
      if (norm.code && norm.code.startsWith('CTP_')) {
        const numStr = norm.code.substring(4);
        const num = parseInt(numStr, 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });
    return `CTP_${String(maxNum + 1).padStart(3, '0')}`;
  };

  const [showTravelNormModal, setShowTravelNormModal] = useState(false);
  const [editingTravelNorm, setEditingTravelNorm] = useState<TravelAllowanceNorm | null>(null);

  // Form states for Travel Allowance
  const [normCode, setNormCode] = useState('');
  const [normContent, setNormContent] = useState('');
  const [normQuantity, setNormQuantity] = useState<number>(1);
  const [normUnitPrice, setNormUnitPrice] = useState<number>(0);
  const [normNotes, setNormNotes] = useState('');
  const [travelNormSearch, setTravelNormSearch] = useState('');

  const [salaryScalesSearch, setSalaryScalesSearch] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
  const [showSalaryScaleModal, setShowSalaryScaleModal] = useState(false);
  const [editingSalaryScale, setEditingSalaryScale] = useState<SalaryScale | null>(null);
  
  // Temporary fields for adding or editing a Salary Grade
  const [ssId, setSsId] = useState('');
  const [ssGroupCode, setSsGroupCode] = useState('');
  const [ssGroupName, setSsGroupName] = useState('');
  const [ssGroupDesc, setSsGroupDesc] = useState('');
  const [ssLevel, setSsLevel] = useState('');
  const [ssLevelName, setSsLevelName] = useState('');
  const [ssBaseSalary, setSsBaseSalary] = useState<number>(0);
  const [ssAllocationRate, setSsAllocationRate] = useState<number>(0);
  const [ssNotes, setSsNotes] = useState('');

  const [departmentCriteria, setDepartmentCriteria] = useState<DepartmentCriteria[]>([
    {
      id: 'dept_all',
      departmentCode: 'ALL',
      departmentName: 'DANH SÁCH TIÊU CHÍ HIỆU SUẤT',
      criteria: getDeduplicatedCriteria([])
    }
  ]);

  // =====================================================================
  // CLOUD SYNC — Load dữ liệu từ Supabase khi mount + storage listener
  // cho cross-tab / cross-browser sync
  // =====================================================================

  // ─── CLOUD SYNC: Load từ Supabase khi mount ───
  useEffect(() => {
    // Roles
    dbService.hrmRoleGroups.list().then((cloudRoles: any[]) => {
      if (cloudRoles && cloudRoles.length > 0) {
        setRoles(cloudRoles.map((r: any) => ({
          id: r.id, name: r.name, description: r.description || '',
          permissions: r.permissions || {}, memberIds: r.memberIds || [],
        })));
      }
    }).catch(err => { console.warn('Load roles from Supabase thất bại:', err); });
    // Employees
    dbService.employees.list().then((cloudEmps: any[]) => {
      if (cloudEmps && cloudEmps.length > 0) {
        setEmployees(cloudEmps);
        // Thêm: sync localStorage với employee profile để tránh mất data
        const cached = localStorage.getItem('hl_hrm_employees_v3');
        if (cached) {
          try { localStorage.setItem('hl_cached_hrm_employees', cached); } catch {}
        }
      }
    }).catch(err => { console.warn('Load employees from Supabase thất bại:', err); });
    // Holidays
    dbService.hrmHolidays.list().then((d: any[]) => { if (d?.length) setHolidays(d); }).catch(() => {});
    // Leaves
    dbService.hrmLeaves.list().then((d: any[]) => { if (d?.length) setLeaves(d); }).catch(() => {});
    // Payroll
    dbService.hrmPayrollRecords.list().then((d: any[]) => { if (d?.length) setPayroll(d); }).catch(() => {});
    // Employee Errors
    dbService.hrmEmployeeErrors.list().then((d: any[]) => { if (d?.length) setEmployeeErrors(d); }).catch(() => {});
    // Leave Coefficients
    dbService.hrmLeaveCoefficients.list().then((d: any[]) => { if (d?.length) setLeaveCoefficients(d); }).catch(() => {});
    // Trips
    dbService.hrmTrips.list().then((d: any[]) => { if (d?.length) setTrips(d); }).catch(() => {});
    // Salary Scales
    dbService.hrmSalaryScales.list().then((d: any[]) => { if (d?.length) setSalaryScales(d); }).catch(() => {});
    // Performance Criteria
    dbService.hrmPerformanceCriteria.list().then((d: any[]) => { if (d?.length) setDepartmentCriteria(d); }).catch(() => {});
    // Travel Norms
    dbService.travelNorms.list().then((d: any[]) => { if (d?.length) setTravelNorms(d); }).catch(() => {});
  }, []);

  // ─── REALTIME LISTENER: Re-fetch roles từ Supabase khi có thay đổi từ user khác ───
  useEffect(() => {
    const handleRolesChanged = async () => {
      try {
        isSyncingRolesFromCloud.current = true;
        const cloudRoles = await dbService.hrmRoleGroups.list();
        if (cloudRoles && cloudRoles.length > 0) {
          setRoles(cloudRoles.map((r: any) => ({
            id: r.id, name: r.name, description: r.description || '',
            permissions: r.permissions || {}, memberIds: r.memberIds || [],
          })));
          // Cập nhật localStorage cache
          const updated = JSON.stringify(cloudRoles);
          localStorage.setItem('hl_cached_hrm_role_groups', updated);
          localStorage.setItem('hl_hrm_roles_v2', updated);
        }
      } catch (e) {
        console.error('Realtime roles sync error:', e);
      } finally {
        // Delay một chút để useEffect bulk save bỏ qua
        setTimeout(() => { isSyncingRolesFromCloud.current = false; }, 500);
      }
    };
    window.addEventListener('hl-task-permissions-updated', handleRolesChanged);
    return () => window.removeEventListener('hl-task-permissions-updated', handleRolesChanged);
  }, []);

  // ─── SYNC TO SUPABASE: lưu khi state thay đổi ───
  useEffect(() => {
    if (isSyncingRolesFromCloud.current) return; // Không ghi lại khi vừa re-fetch từ cloud
    if (employees?.length) employees.forEach(emp => dbService.employees.save(emp).catch(() => {}));
  }, [employees]);

  useEffect(() => {
    if (isSyncingRolesFromCloud.current) return; // Không ghi lại khi vừa re-fetch từ cloud
    if (roles?.length) roles.forEach(r => dbService.hrmRoleGroups.save({
      id: r.id, name: r.name, description: r.description || '',
      permissions: r.permissions || {}, memberIds: r.memberIds || [],
    }).catch(() => {}));
  }, [roles]);

  useEffect(() => {
    if (attendance?.length) {
      attendance.forEach(rec => dbService.attendance.save(rec).catch(() => {}));
    }
  }, [attendance]);

  useEffect(() => {
    if (leaves?.length) leaves.forEach(l => dbService.hrmLeaves.save(l).catch(() => {}));
  }, [leaves]);

  useEffect(() => {
    if (payroll?.length) payroll.forEach(p => dbService.hrmPayrollRecords.save(p).catch(() => {}));
  }, [payroll]);

  useEffect(() => {
    if (trips?.length) trips.forEach(t => dbService.hrmTrips.save(t).catch(() => {}));
  }, [trips]);

  useEffect(() => {
    if (holidays?.length) holidays.forEach(h => dbService.hrmHolidays.save(h).catch(() => {}));
  }, [holidays]);

  useEffect(() => {
    if (leaveCoefficients?.length) leaveCoefficients.forEach(c => dbService.hrmLeaveCoefficients.save(c).catch(() => {}));
  }, [leaveCoefficients]);

  useEffect(() => {
    if (employeeErrors?.length) employeeErrors.forEach(e => dbService.hrmEmployeeErrors.save(e).catch(() => {}));
  }, [employeeErrors]);

  useEffect(() => {
    if (salaryScales?.length) salaryScales.forEach(s => dbService.hrmSalaryScales.save(s).catch(() => {}));
  }, [salaryScales]);

  useEffect(() => {
    if (departmentCriteria?.length) departmentCriteria.forEach(c => dbService.hrmPerformanceCriteria.save(c).catch(() => {}));
  }, [departmentCriteria]);

  useEffect(() => {
    if (travelNorms?.length) travelNorms.forEach(n => dbService.travelNorms.save(n).catch(() => {}));
  }, [travelNorms]);

  // Chức năng tự động chốt công hàng ngày lúc 22h00 cho tất cả nhân viên
  const executeAutoWorkdayLocking = () => {
    if (!employees || employees.length === 0) return;

    const getLocalYYYYMMDD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const r = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${r}`;
    };

    const now = new Date();
    const todayStr = getLocalYYYYMMDD(now);
    const currentHour = now.getHours();

    // Duyệt qua hôm nay và 7 ngày trước đó để chốt công tự động nếu chưa chốt
    const datesToCheck: string[] = [];
    for (let i = 0; i <= 7; i++) {
      const d = new Date(now.getTime());
      d.setDate(now.getDate() - i);
      datesToCheck.push(getLocalYYYYMMDD(d));
    }

    let updated = [...attendance];
    let changed = false;

    datesToCheck.forEach(checkDate => {
      // Bỏ qua các ngày trước ngày khởi tạo dữ liệu chấm công
      // (chỉ chấm từ attendanceInitDate trở đi, không ghi KP cho ngày quá khứ trước đó)
      if (checkDate < attendanceInitDate) {
        return;
      }

      const isToday = (checkDate === todayStr);
      // Nếu là hôm nay, chỉ tự động chốt khi đồng hồ máy tính vượt quá mốc 22h00
      if (isToday && currentHour < 22) {
        return;
      }

      employees.forEach(emp => {
        // Chỉ chốt công cho nhân viên ĐANG LÀM (ẩn các nhân viên khác khỏi bảng chấm công)
        if (emp.status !== 'working') return;
        // Tìm bản ghi chấm công
        const existingIndex = updated.findIndex(a => a.empId === emp.id && a.date === checkDate);

        if (existingIndex > -1) {
          const log = updated[existingIndex];
          if (!log.isLocked) {
            updated[existingIndex] = {
              ...log,
              isLocked: true,
              notes: log.notes ? `${log.notes} (Đã chốt công tự động lúc 22h00)` : `Đã chốt công tự động lúc 22h00`
            };
            changed = true;
          }
        } else {
          // Chưa có bản ghi chấm công => thực hiện tự động rà quét và chốt công theo đơn phép hoặc nghỉ không phép
          const dateObj = new Date(checkDate);
          const dayOfWeek = dateObj.getDay();
          const isWeekend = weekendDays.includes(dayOfWeek);
          
          const holidayKey = checkDate.split('-').reverse().join('/'); // DD/MM/YYYY
          const holidayMatch = holidays.find(h => h.date === holidayKey);

          // Kiểm tra xem có đơn xin phép nào được phê duyệt cho nhân viên vào ngày này không
          const approvedLeave = leaves.find(l => {
            if (l.status !== 'approved') return false;
            if (l.isAttendanceCorrection || l.type === 'Yêu cầu xét duyệt công' || l.type === 'Báo cáo nghỉ ca' || l.type === 'Báo cáo lỗi chấm ra ca') return false;
            const sameEmp = (l.empId === emp.id) || (l.empName === emp.name);
            return sameEmp && checkDate >= l.fromDate && checkDate <= l.toDate;
          });

          if (approvedLeave) {
            // Có đơn phép được duyệt => Tự động ghi nhận nghỉ phép và chốt
            const matchedCoef = leaveCoefficients.find(c => c.type === approvedLeave.type || c.id === approvedLeave.type);
            const symbol = matchedCoef ? matchedCoef.id : 'PN';
            const newLog: AttendanceLog = {
              id: `AT-AUTO-LEAVE-${emp.id}-${checkDate}`,
              empId: emp.id,
              empName: emp.name,
              date: checkDate,
              timeInS: symbol,
              timeOutS: symbol,
              timeInC: symbol,
              timeOutC: symbol,
              timeInOT: '',
              timeOutOT: '',
              method: 'Hệ thống (Tự động phép)',
              status: 'excused',
              otHours: 0,
              notes: `Nghỉ phép được phê duyệt (Tự động chốt): ${approvedLeave.type}`,
              isLocked: true
            };
            updated.push(newLog);
            changed = true;
          } else if (holidayMatch) {
            // Ngày lễ => tự động chốt nghỉ lễ
            const newLog: AttendanceLog = {
              id: `AT-AUTO-HOLIDAY-${emp.id}-${checkDate}`,
              empId: emp.id,
              empName: emp.name,
              date: checkDate,
              timeInS: 'OFF',
              timeOutS: 'OFF',
              timeInC: 'OFF',
              timeOutC: 'OFF',
              timeInOT: '',
              timeOutOT: '',
              method: 'Hệ thống (Nghỉ Lễ)',
              status: 'excused',
              otHours: 0,
              notes: `Nghỉ Lễ (${holidayMatch.name}) (Tự động chốt)`,
              isLocked: true
            };
            updated.push(newLog);
            changed = true;
          } else if (isWeekend) {
            // Ngày cuối tuần => tự động chốt nghỉ cuối tuần
            const newLog: AttendanceLog = {
              id: `AT-AUTO-WEEKEND-${emp.id}-${checkDate}`,
              empId: emp.id,
              empName: emp.name,
              date: checkDate,
              timeInS: 'OFF',
              timeOutS: 'OFF',
              timeInC: 'OFF',
              timeOutC: 'OFF',
              timeInOT: '',
              timeOutOT: '',
              method: 'Hệ thống (Nghỉ Tuần)',
              status: 'excused',
              otHours: 0,
              notes: `Nghỉ cuối tuần (Tự động chốt)`,
              isLocked: true
            };
            updated.push(newLog);
            changed = true;
          } else {
            // Ngày làm việc bình thường, không chấm công và không phép => Tính Nghỉ không phép (KP)
            const newLog: AttendanceLog = {
              id: `AT-AUTO-KP-${emp.id}-${checkDate}`,
              empId: emp.id,
              empName: emp.name,
              date: checkDate,
              timeInS: 'KP',
              timeOutS: 'KP',
              timeInC: 'KP',
              timeOutC: 'KP',
              timeInOT: '',
              timeOutOT: '',
              method: 'Hệ thống (Tự động)',
              status: 'missing',
              otHours: 0,
              notes: `Vắng không phép (KP) (Tự động chốt lúc 22h00)`,
              isLocked: true
            };
            updated.push(newLog);
            changed = true;
          }
        }
      });
    });

    if (changed) {
      setAttendance(updated);
    }
  };

  useEffect(() => {
    executeAutoWorkdayLocking();
    const intervalId = setInterval(() => {
      executeAutoWorkdayLocking();
    }, 10000);
    return () => clearInterval(intervalId);
  }, [attendance, employees, leaves, weekendDays, holidays, leaveCoefficients]);

  useEffect(() => {
    if (activeSubTab === 'trips') {
      const saved = localStorage.getItem('hl_travel_expenses_summary_v4');
      if (saved) {
        setTravelExpensesSummary(JSON.parse(saved));
      }
    }
  }, [activeSubTab]);

  // Form states
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [newEmp, setNewEmp] = useState({
    name: '', gender: 'Nam', dob: '1995-01-01', phone: '', email: '', cccd: '',
    address: 'Bảo Lộc, Lâm Đồng', emergencyContact: '', department: 'Phòng Dự án',
    position: 'Kỹ sư công trường',
    contractType: 'Thử việc',
    contractDurationMonths: undefined as number | undefined,
    phepNam: 12,
    bankAccount: '', bankName: 'MBBank',
    currentAddress: '', cccdIssuedDate: '', cccdIssuedPlace: '', education: '', salaryCode: ''
  });

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [newLeave, setNewLeave] = useState({
    empId: '', type: 'Nghỉ phép năm', fromDate: '', toDate: '',
    daysCount: 1, reason: '', approverName: '', approverId: '', approverPosition: ''
  });

  // Tạm ứng lương (salary advance) state
  const [showSalaryAdvanceModal, setShowSalaryAdvanceModal] = useState(false);
  const [newSalaryAdvance, setNewSalaryAdvance] = useState({
    empId: '',
    amount: 0,
    reason: '',
    approverName: '',
    approverId: ''
  });

  // Social Insurance states
  const [showInsModal, setShowInsModal] = useState(false);
  const [editingInsEmpId, setEditingInsEmpId] = useState<string | null>(null);
  const [insBookNo, setInsBookNo] = useState('');
  const [insSalary, setInsSalary] = useState(0);
  const [insRate, setInsRate] = useState(10.5);
  const [insPersonalRelief, setInsPersonalRelief] = useState(15500000);
  const [insDependentCount, setInsDependentCount] = useState(0);
  const [insDate, setInsDate] = useState('');
  const [insSearchText, setInsSearchText] = useState('');
  const [insDeptFilter, setInsDeptFilter] = useState('all');
  const [insBookFilter, setInsBookFilter] = useState('all'); // all, has_book, no_book

  useEffect(() => {
    const nonAuto = leaveCoefficients.filter(c => !c.isAuto);
    if (nonAuto.length > 0) {
      setNewLeave(prev => {
        if (!nonAuto.some(c => c.type === prev.type)) {
          return { ...prev, type: nonAuto[0].type };
        }
        return prev;
      });
    }
  }, [leaveCoefficients]);

  const [showTripModal, setShowTripModal] = useState(false);
  const [newTrip, setNewTrip] = useState({
    empName: '', destination: '', purpose: '',
    fromDate: '', toDate: '', estimatedCost: 0, advanceAmount: 0
  });

  const [attendanceFilter, setAttendanceFilter] = useState('');
  const [attendanceSearchEmpId, setAttendanceSearchEmpId] = useState('all');
  const [attendanceFilterMonth, setAttendanceFilterMonth] = useState(String(new Date().getMonth() + 1)); // '6' for June
  const [attendanceFilterYear, setAttendanceFilterYear] = useState(String(new Date().getFullYear())); // '2026' for this year
  const [showBulkLockModal, setShowBulkLockModal] = useState(false);
  const [bulkLockScope, setBulkLockScope] = useState<'page' | 'month'>('page');
  const [employeeSearch, setEmployeeSearch] = useState('');

  useEffect(() => {
    setProfilePage(1);
    setAttendancePage(1);
    setLeavePage(1);
    setPayrollPage(1);
    setTripPage(1);
  }, [employeeSearch, attendanceFilter, attendanceSearchEmpId, attendanceFilterMonth, attendanceFilterYear, globalPageSize, activeSubTab]);

  // ── Filter attendance once (dùng cho cả table, paginator, summary) ────────
  const attendanceFiltered = useMemo(() => {
    // Chỉ ghi nhận chấm công của nhân viên ĐANG LÀM; ẩn các nhân viên khác khỏi bảng
    const workingEmpIds = new Set(
      employees.filter((e: any) => e.status === 'working').map((e: any) => e.id)
    );
    return attendance.filter(el => {
      if (!workingEmpIds.has(el.empId)) return false;
      if (attendanceSearchEmpId !== 'all' && el.empId !== attendanceSearchEmpId) return false;
      if (!el.date) return true;
      const parts = el.date.split('-');
      let itemMonth: string, itemYear: string;
      if (parts.length === 3) {
        itemMonth = String(parseInt(parts[1], 10));
        itemYear = parts[0];
      } else {
        const slashParts = el.date.split('/');
        if (slashParts.length === 3) {
          itemMonth = String(parseInt(slashParts[1], 10));
          itemYear = slashParts[2];
        } else {
          return true;
        }
      }
      if (attendanceFilterMonth !== 'all' && itemMonth !== attendanceFilterMonth) return false;
      if (attendanceFilterYear !== 'all' && itemYear !== attendanceFilterYear) return false;
      return true;
    });
  }, [attendance, employees, attendanceSearchEmpId, attendanceFilterMonth, attendanceFilterYear]);

  // Holiday state & handlers
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidaySearchQuery, setHolidaySearchQuery] = useState('');

  const [newHolidayName, setNewHolidayName] = useState('');
  const [holidayInputMode, setHolidayInputMode] = useState<'single' | 'range'>('range');
  const [holidaySingleDate, setHolidaySingleDate] = useState('');
  const [holidayFromDate, setHolidayFromDate] = useState('');
  const [holidayToDate, setHolidayToDate] = useState('');

  const getDatesInRange = (startStr: string, endStr: string): string[] => {
    const dates = [];
    let current = new Date(startStr);
    const end = new Date(endStr);
    while (current <= end) {
      const day = String(current.getDate()).padStart(2, '0');
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const year = current.getFullYear();
      dates.push(`${day}/${month}/${year}`);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const generateHolidayId = (list: Holiday[]) => {
    const ids = list.map(h => {
      const num = parseInt(h.id.replace('NL-', ''), 10);
      return isNaN(num) ? 0 : num;
    });
    const max = ids.length > 0 ? Math.max(...ids) : 0;
    return `NL-${String(max + 1).padStart(3, '0')}`;
  };

  const handleAddTravelNormClick = () => {
    setEditingTravelNorm(null);
    const nextCode = generateNextTravelNormCode(travelNorms);
    setNormCode(nextCode);
    setNormContent('');
    setNormQuantity(1);
    setNormUnitPrice(100000);
    setNormNotes('');
    setShowTravelNormModal(true);
  };

  const handleEditTravelNormClick = (norm: TravelAllowanceNorm) => {
    setEditingTravelNorm(norm);
    setNormCode(norm.code || '');
    setNormContent(norm.content);
    setNormQuantity(norm.quantity);
    setNormUnitPrice(norm.unitPrice);
    setNormNotes(norm.notes || '');
    setShowTravelNormModal(true);
  };

  const handleTravelNormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!normContent) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'vui lòng nhập Nội dung Công tác phí!', type: 'warning' });
      return;
    }

    if (editingTravelNorm) {
      setTravelNorms(prev => prev.map(item => 
        item.id === editingTravelNorm.id 
          ? { 
              ...item, 
              code: normCode, 
              content: normContent, 
              quantity: Number(normQuantity), 
              unitPrice: Number(normUnitPrice), 
              notes: normNotes 
            }
          : item
      ));
      addToast({ title: '✅ Thành công', message: '✅ Cập nhật định mức công tác phí thành công!', type: 'success' });
    } else {
      const finalCode = generateNextTravelNormCode(travelNorms);
      const newNorm: TravelAllowanceNorm = {
        id: `ctp_${Date.now()}`,
        code: finalCode,
        content: normContent,
        quantity: Number(normQuantity),
        unitPrice: Number(normUnitPrice),
        notes: normNotes
      };
      setTravelNorms(prev => [...prev, newNorm]);
      addToast({ title: '✅ Thành công', message: '✅ Thêm định mức công tác phí mới thành công!', type: 'success' });
    }
    setShowTravelNormModal(false);
  };

  const handleDeleteTravelNorm = (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa định mức công tác phí này?')) {
      setTravelNorms(prev => prev.filter(item => item.id !== id));
      addToast({ title: '🗑️ Đã xóa', message: '🗑️ Đã xóa định mức công tác phí.', type: 'info' });
    }
  };

  // ---------- CRUD Ngày lễ (Holiday) ----------
  const handleAddHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayName.trim()) return;

    let datesToAdd: string[] = [];
    if (holidayInputMode === 'range') {
      if (!holidayFromDate || !holidayToDate) return;
      datesToAdd = getDatesInRange(holidayFromDate, holidayToDate);
    } else {
      if (!holidaySingleDate) return;
      const [year, month, day] = holidaySingleDate.split('-');
      datesToAdd = [`${day}/${month}/${year}`];
    }

    const updatedHolidays = [...holidays];
    datesToAdd.forEach(d => {
      if (updatedHolidays.some(h => h.date === d)) {
        return; // skip duplicate dates
      }
      const nextId = generateHolidayId(updatedHolidays);
      updatedHolidays.push({
        id: nextId,
        date: d,
        name: newHolidayName.trim()
      });
    });

    setHolidays(updatedHolidays);
    setShowHolidayModal(false);
    setNewHolidayName('');
    setHolidayInputMode('range');
    setHolidaySingleDate('');
    setHolidayFromDate('');
    setHolidayToDate('');
  };

  const handleDeleteHoliday = (id: string) => {
    if (confirm('Bạn có chắc muốn xóa ngày nghỉ lễ này?')) {
      const updated = holidays.filter(h => h.id !== id);
      setHolidays(updated);
      // Đồng bộ xóa lên Supabase
      dbService.hrmHolidays.delete(id).catch(err => console.warn('Xóa ngày lễ trên Supabase thất bại:', err));
    }
  };

  // Salary Scale Handlers
  // ---------- CRUD Thang lương (SalaryScale) ----------
  const handleSaveSalaryScale = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!ssId.trim() || !ssLevel.trim() || !ssLevelName.trim()) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'vui lòng nhập đầy đủ Mã chi trả, Bậc lương và Tên bậc!', type: 'warning' });
      return;
    }

    const perf = Math.round(ssBaseSalary * (ssAllocationRate / 100));
    const tot = ssBaseSalary + perf;

    const newItem: SalaryScale = {
      id: ssId.trim().toUpperCase(),
      groupCode: ssGroupCode,
      groupName: ssGroupName,
      groupDesc: ssGroupDesc || (
        ssGroupCode === 'QLDH' ? 'Dành cho thành viên HĐQT có tham gia quản lý; Thành viên ban giám đốc; Trợ lý giám đốc; Giám đốc sản xuất; Giám đốc tài chính; Giám dốc dự án' : 
        ssGroupCode === 'KTTC' ? 'Dành cho nhân viên kỹ thuật; Trưởng bộ phận; Tổ trưởng; Thợ, Phụ' : 
        'Dành cho nhân sự tài chính kế toán, vật tư, cung ứng, thiết bị, hành chính, nhân sự, Kinh doanh'
      ),
      level: ssLevel.trim().toUpperCase(),
      levelName: ssLevelName.trim(),
      baseSalary: ssBaseSalary,
      allocationRate: ssAllocationRate,
      performanceSalary: perf,
      totalSalary: tot,
      notes: ssNotes
    };

    setSalaryScales(prev => {
      const idx = prev.findIndex(item => item.id === newItem.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = newItem;
        return updated;
      } else {
        return [...prev, newItem];
      }
    });

    setShowSalaryScaleModal(false);
    setEditingSalaryScale(null);
  };

  const handleDeleteSalaryScale = (id: string) => {
    if (confirm(`Bạn có chắc chắn muốn xóa Bậc Lương "${id}" này không?`)) {
      const target = salaryScales.find(item => item.id === id);
      setSalaryScales(prev => prev.filter(item => item.id !== id));
      // Đồng bộ xóa lên Supabase
      if (target) dbService.hrmSalaryScales.delete(id).catch(err => console.warn('Xóa bậc lương trên Supabase thất bại:', err));
    }
  };

  const handleResetSalaryScales = () => {
    if (confirm("Bạn có muốn xóa toàn bộ danh sách Bậc Lương không?")) {
      setSalaryScales([]);
    }
  };

  const handleEditSalaryScaleClick = (scale: SalaryScale) => {
    setEditingSalaryScale(scale);
    setSsId(scale.id);
    setSsGroupCode(scale.groupCode);
    setSsGroupName(scale.groupName);
    setSsGroupDesc(scale.groupDesc || '');
    setSsLevel(scale.level);
    setSsLevelName(scale.levelName);
    setSsBaseSalary(scale.baseSalary);
    setSsAllocationRate(scale.allocationRate);
    setSsNotes(scale.notes || '');
    setShowSalaryScaleModal(true);
  };

  const handleAddNewSalaryScaleClick = () => {
    setEditingSalaryScale(null);
    setSsId('');
    setSsGroupCode('QLDH');
    setSsGroupName('QUẢN LÝ - ĐIỀU HÀNH');
    setSsGroupDesc('');
    setSsLevel('B1');
    setSsLevelName('Bậc lương ');
    setSsBaseSalary(6000000);
    setSsAllocationRate(80);
    setSsNotes('');
    setShowSalaryScaleModal(true);
  };

  // Attendance Coefficient state & handlers
  const [showCoefModal, setShowCoefModal] = useState(false);
  const [coefSearchQuery, setCoefSearchQuery] = useState('');
  const [newCoefType, setNewCoefType] = useState('');
  const [newCoefSymbol, setNewCoefSymbol] = useState('');
  const [newCoefVal, setNewCoefVal] = useState<string>('0');
  const [newCoefIsAuto, setNewCoefIsAuto] = useState<boolean>(false);

  const handleAddCoefficient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCoefType.trim() || !newCoefSymbol.trim()) return;

    const hSccCode = newCoefSymbol.trim().toUpperCase();
    const updated = [...leaveCoefficients];
    if (updated.some(c => c.id.toUpperCase() === hSccCode)) {
      addToast({ title: 'ℹ️ Thông báo', message: `Mã HSCC "${hSccCode}" đã tồn tại! Vui lòng nhập mã khác để tránh trùng khóa chính.`, type: 'info' });
      return;
    }

    updated.push({
      id: hSccCode,
      type: newCoefType.trim(),
      isAuto: newCoefIsAuto,
      coefficient: Number(newCoefVal)
    });

    setLeaveCoefficients(updated);
    setShowCoefModal(false);
    setNewCoefType('');
    setNewCoefSymbol('');
    setNewCoefVal('0');
    setNewCoefIsAuto(false);
  };

  const handleDeleteCoefficient = (id: string) => {
    if (confirm('Bạn có chắc muốn xóa hệ số chấm công này?')) {
      const updated = leaveCoefficients.filter(c => c.id !== id);
      setLeaveCoefficients(updated);
      // Đồng bộ xóa lên Supabase
      dbService.hrmLeaveCoefficients.delete(id).catch(err => console.warn('Xóa hệ số chấm công trên Supabase thất bại:', err));
    }
  };

  const handleToggleCoefficientAuto = (id: string) => {
    setLeaveCoefficients(prev => prev.map(c => c.id === id ? { ...c, isAuto: !c.isAuto } : c));
  };

  // Performance Criteria CRUD functions
  // ===================== BLOCK HIỆU SUẤT & KỶ LUẬT (performance) =====================
  const handleCreateOrUpdateCriteria = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCritContent.trim()) {
      addToast({ title: 'ℹ️ Thông báo', message: 'Nội dung tiêu chí không được để trống!', type: 'warning' });
      return;
    }

    if (editingCritId && editingCritDeptId) {
      setDepartmentCriteria(prev => prev.map(dept => {
        if (dept.id === editingCritDeptId) {
          return {
            ...dept,
            criteria: dept.criteria.map(crit => crit.id === editingCritId ? { ...crit, category: newCritCategory, content: newCritContent } : crit)
          };
        }
        return dept;
      }));
      addToast({ title: '✅ Thành công', message: 'Đã cập nhật tiêu chí đánh giá thành công!', type: 'success' });
    } else {
      const newId = `crit_new_${Date.now()}`;
      setDepartmentCriteria(prev => prev.map(dept => {
        if (dept.id === selectedCriteriaDeptId) {
          return {
            ...dept,
            criteria: [...dept.criteria, { id: newId, category: newCritCategory, content: newCritContent }]
          };
        }
        return dept;
      }));
      addToast({ title: '✅ Thành công', message: 'Đã thêm tiêu chí đánh giá mới thành công!', type: 'success' });
    }

    setShowCriteriaModal(false);
    setNewCritContent('');
    setEditingCritId(null);
    setEditingCritDeptId(null);
  };

  const handleDeleteCriteria = (deptId: string, critId: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa tiêu chí đánh giá này không?")) {
      setDepartmentCriteria(prev => prev.map(dept => {
        if (dept.id === deptId) {
          return {
            ...dept,
            criteria: dept.criteria.filter(crit => crit.id !== critId)
          };
        }
        return dept;
      }));
    }
  };

  const handleEditCriteriaTrigger = (deptId: string, crit: PerformanceCriterion) => {
    setEditingCritId(crit.id);
    setEditingCritDeptId(deptId);
    setNewCritCategory(crit.category);
    setNewCritContent(crit.content);
    setShowCriteriaModal(true);
  };

  // Employee Performance Error Handlers

  const handleFormEmployeeChange = (empId: string) => {
    setErrFormEmpId(empId);
    const emp = employees.find(e => e.id === empId);
    if (emp) {
      setErrFormDeptId('dept_all');
      
      const deptCrit = departmentCriteria.find(dc => dc.id === 'dept_all');
      if (deptCrit && deptCrit.criteria.length > 0) {
        setErrFormCritId(deptCrit.criteria[0].id);
      } else {
        setErrFormCritId('');
      }
    }
  };

  const handleCreateOrUpdateError = (e: React.FormEvent) => {
    e.preventDefault();
    if (!errFormEmpId) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'vui lòng chọn nhân viên!', type: 'warning' });
      return;
    }
    if (!errFormCritId) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'vui lòng chọn tiêu chí vi phạm!', type: 'warning' });
      return;
    }
    if (!errFormDate) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'vui lòng chọn ngày vi phạm!', type: 'warning' });
      return;
    }

    const emp = employees.find(empItem => empItem.id === errFormEmpId);
    const dc = departmentCriteria.find(dcItem => dcItem.id === errFormDeptId);
    const critObj = dc?.criteria.find(c => c.id === errFormCritId);

    if (!emp) {
      addToast({ title: 'ℹ️ Thông báo', message: 'Không tìm thấy thông tin nhân viên!', type: 'warning' });
      return;
    }

    if (editingErrorId) {
      setEmployeeErrors(prev => prev.map(err => {
        if (err.id === editingErrorId) {
          return {
            ...err,
            employeeId: errFormEmpId,
            employeeName: emp.name,
            departmentCode: emp.department || 'A',
            departmentName: emp.department || '',
            criterionId: errFormCritId,
            criterionContent: critObj?.content || '',
            category: critObj?.category || 'readiness',
            date: errFormDate,
            notes: errFormNotes,
            images: errFormImages
          };
        }
        return err;
      }));
      addToast({ title: '✅ Thành công', message: 'Đã cập nhật lỗi vi phạm thành công!', type: 'success' });
    } else {
      const newErr: EmployeeErrorLog = {
        id: `err_log_${Date.now()}`,
        employeeId: errFormEmpId,
        employeeName: emp.name,
        departmentCode: emp.department || 'A',
        departmentName: emp.department || '',
        criterionId: errFormCritId,
        criterionContent: critObj?.content || '',
        category: critObj?.category || 'readiness',
        date: errFormDate,
        notes: errFormNotes,
        images: errFormImages
      };
      setEmployeeErrors(prev => [newErr, ...prev]);
      addToast({ title: '✅ Thành công', message: 'Đã ghi nhận lỗi vi phạm mới thành công!', type: 'success' });
    }

    if (errFormCameraStream) {
      errFormCameraStream.getTracks().forEach(track => track.stop());
    }
    setErrFormCameraStream(null);
    setErrFormCameraActive(false);
    setErrFormImages([]);

    setShowErrorModal(false);
    setEditingErrorId(null);
    setErrFormNotes('');
    setErrorFormCritSearch('');
  };

  const handleDeleteError = (id: string) => {
    const target = employeeErrors.find(e => e.id === id);
    setEmployeeErrors(prev => prev.filter(e => e.id !== id));
    // Đồng bộ xóa lên Supabase
    if (target) dbService.hrmEmployeeErrors.delete(id).catch(err => console.warn('Xóa lỗi vi phạm trên Supabase thất bại:', err));
  };

  const handleEditErrorTrigger = (err: EmployeeErrorLog) => {
    setEditingErrorId(err.id);
    setErrFormEmpId(err.employeeId);
    
    setErrFormDeptId('dept_all');
    setErrFormCritId(err.criterionId);
    setErrFormDate(err.date);
    setErrFormNotes(err.notes || '');
    setErrFormImages(err.images || []);
    setErrFormCameraActive(false);
    setErrFormCameraStream(null);
    setErrorFormCritSearch('');
    setShowErrorModal(true);
  };

  const handleSaveInsurance = () => {
    if (!editingInsEmpId) return;
    const updated = employees.map((emp: any) => {
      if (emp.id === editingInsEmpId) {
        return {
          ...emp,
          bhxhBookNo: insBookNo,
          bhxhSalary: Number(insSalary) || 0,
          bhxhRate: Number(insRate) || 10.5,
          taxPersonalRelief: Number(insPersonalRelief) || 0,
          dependentCount: Number(insDependentCount) || 0,
          bhxhDate: insDate || '2026-04-01'
        };
      }
      return emp;
    });

    setEmployees(updated);
    setShowInsModal(false);
    setEditingInsEmpId(null);
    addToast({ title: '✅ Thành công', message: 'Cập nhật thông tin BHXH & Giảm trừ thuế thành công!', type: 'success' });
  };

  // -----------------------------------------------------------------
  // PAYROLL AUTOMATIC GENERATOR & EDIT LOGIC (VIETNAMESE HR COMPLIANT)
  // -----------------------------------------------------------------
  const [payrollMonth, setPayrollMonth] = useState<string>(() => String(new Date().getMonth() + 1).padStart(2, '0'));
  const [payrollYear, setPayrollYear] = useState<string>(() => String(new Date().getFullYear()));
  const [standardWorkDays, setStandardWorkDays] = useState<number>(26);
  const [payrollViewMode, setPayrollViewMode] = useState<'summary' | 'detail'>('summary');
  const [showEditPayrollModal, setShowEditPayrollModal] = useState(false);
  const [editingPayrollItem, setEditingPayrollItem] = useState<PayrollItem | null>(null);

  // States for printing custom payslip
  const [showPrintPayslipModal, setShowPrintPayslipModal] = useState(false);
  const [printingPayrollItem, setPrintingPayrollItem] = useState<PayrollItem | null>(null);
  const [printNotes, setPrintNotes] = useState<string>('');
  const [printNguoiPhat, setPrintNguoiPhat] = useState<string>('');
  const [printKeToanTruong, setPrintKeToanTruong] = useState<string>('');
  const [printDatePlace, setPrintDatePlace] = useState<string>('');

  // Automatically update printing defaults when selected item changes
  useEffect(() => {
    if (printingPayrollItem) {
      setPrintNotes('');

      // Calculate 15th of the following month for Vietnamese default payment date
      let m = parseInt(payrollMonth) + 1;
      let y = parseInt(payrollYear);
      if (m > 12) {
        m = 1;
        y += 1;
      }
      const mStr = m.toString().padStart(2, '0');
      setPrintDatePlace(`Lâm Đồng, ngày 15 tháng ${mStr} năm ${y}`);
    }
  }, [printingPayrollItem, payrollMonth, payrollYear]);

  // Form states for editing a single payroll item
  const [editWorkedDays, setEditWorkedDays] = useState(0);
  const [editKpiScore, setEditKpiScore] = useState(100);
  const [editOtSunday, setEditOtSunday] = useState(0);
  const [editOtHoliday, setEditOtHoliday] = useState(0);
  const [editOtHours, setEditOtHours] = useState(0);
  const [editOtCount, setEditOtCount] = useState(0);
  const [editAdvances, setEditAdvances] = useState(0);
  const [editBonusHoliday, setEditBonusHoliday] = useState(0);
  const [editBonusCreative, setEditBonusCreative] = useState(0);
  const [editOtherDeductions, setEditOtherDeductions] = useState(0);
  const [editExpenses, setEditExpenses] = useState(0);

  // ↓ Wrapper quanh calculateSingleEmployeePayroll (từ ./hr/hrCalculations); truyền closure salaryScales + standardWorkDays
  const _calcPayroll = (emp: any, monthStr: string, inputs: any) => calculateSingleEmployeePayroll(emp, monthStr, inputs, salaryScales, standardWorkDays);

  // ===================== BLOCK TÍNH LƯƠNG (payroll) =====================
  const handleCalculatePayroll = () => {
    const monthStr = `${payrollMonth}/${payrollYear}`;

    const newPayrollItems = employees
      .filter((emp: any) => emp.status === 'working')
      .map((emp) => {
      let inputs: any = {
        workedDays: standardWorkDays,
        kpiScore: 100,
        otSunday: 0,
        otHoliday: 0,
        otHours: 0,
        otCount: 0,
        bonusHoliday: 0,
        bonusCreative: 0,
        otherDeductions: 0,
        advances: 0,
        expenses: 0
      };

      const empAttendance = (attendance || []).filter((a: any) => {
        if (!a.date) return false;
        const [aYear, aMonth] = a.date.split('-');
        return aMonth === payrollMonth && aYear === payrollYear && a.empId === emp.id && a.status === 'valid';
      });

      const empErrors = (employeeErrors || []).filter((err: any) => {
        if (!err.date) return false;
        const [errYear, errMonth] = err.date.split('-');
        return errMonth === String(Number(payrollMonth)) && errYear === payrollYear && err.employeeId === emp.id;
      });

      let deducedKpi = 100;
      empErrors.forEach((err: any) => {
        const notes = (err.notes || '').toLowerCase();
        if (notes.includes('nặng') || notes.includes('nghiêm trọng')) deducedKpi -= 10;
        else if (notes.includes('trung bình') || notes.includes('vừa')) deducedKpi -= 5;
        else deducedKpi -= 2;
      });
      inputs.kpiScore = Math.max(0, deducedKpi);

      let sundayCount = 0;
      let holidayCount = 0;
      let normalCount = 0;

      empAttendance.forEach((a: any) => {
        const aDateObj = new Date(a.date);
        const isSunday = weekendDays.includes(aDateObj.getDay());
        const isHolidayDate = (holidays || []).some((h: any) => {
          if (h.inputMode === 'single') {
            return h.singleDate === a.date;
          } else {
            return a.date >= h.fromDate && a.date <= h.toDate;
          }
        });

        if (isHolidayDate) holidayCount++;
        else if (isSunday) sundayCount++;
        else normalCount++;
      });

      // Determine workedDays (Công nhật), otSunday (TC Chủ Nhật), otHoliday (TC Lễ)
      if (empAttendance.length > 0) {
        inputs.workedDays = normalCount;
        inputs.otSunday = sundayCount;
        inputs.otHoliday = holidayCount;
      } else {
        inputs.workedDays = standardWorkDays;
        inputs.otSunday = 0;
        inputs.otHoliday = 0;
      }

      let totalOtHrs = 0;
      let otClts = 0;
      empAttendance.forEach((a: any) => {
        if (a.otHours && a.otHours > 0) {
          totalOtHrs += a.otHours;
          otClts++;
        }
      });
      inputs.otHours = totalOtHrs;
      inputs.otCount = otClts;

      // Sum Expenses from Business trips
      const tripSummary = (travelExpensesSummary || []).find((s: any) => s.empId === emp.id && s.month === `${payrollMonth}/${payrollYear}`);
      inputs.expenses = tripSummary ? ((tripSummary.fuelFee ?? 0) + (tripSummary.mealFee ?? 0) + (tripSummary.lodgeFee ?? 0) + (tripSummary.otherFee ?? 0)) : 0;

      inputs.bonusHoliday = 0;
      inputs.bonusCreative = 0;
      inputs.otherDeductions = 0;
      inputs.advances = 0;

      const calculated = _calcPayroll(emp, monthStr, inputs);

      return {
        id: `PL-${emp.id}-${payrollMonth}${payrollYear}`,
        empId: emp.id,
        empName: emp.name,
        month: monthStr,
        status: 'unpaid' as any,
        ...calculated
      };
    });

    setPayroll(newPayrollItems as PayrollItem[]);
    addToast({ title: '✅ Thành công', message: `⚡ Đã tự động tính lương thành công cho ${newPayrollItems.length} nhân viên tháng ${payrollMonth}/${payrollYear}.`, type: 'success' });
  };

  const handleOpenEditPayroll = (item: any) => {
    setEditingPayrollItem(item);
    setEditWorkedDays(item.workedDays);
    setEditKpiScore(item.kpiScore || 100);
    setEditOtSunday(item.otSunday || 0);
    setEditOtHoliday(item.otHoliday || 0);
    setEditOtHours(item.otHours || 0);
    setEditOtCount(item.otCount || 0);
    setEditAdvances(item.advances || 0);
    setEditBonusHoliday(item.bonusHoliday || 0);
    setEditBonusCreative(item.bonusCreative || 0);
    setEditOtherDeductions(item.otherDeductions || 0);
    setEditExpenses(item.expenses || 0);
    setShowEditPayrollModal(true);
  };

  const handleSaveEditPayroll = () => {
    if (!editingPayrollItem) return;
    const emp = employees.find(e => e.id === editingPayrollItem.empId);
    if (!emp) return;

    const inputs = {
      workedDays: Number(editingPayrollItem.workedDays) || 0,
      kpiScore: Number(editingPayrollItem.kpiScore) || 0,
      otSunday: Number(editingPayrollItem.otSunday) || 0,
      otHoliday: Number(editingPayrollItem.otHoliday) || 0,
      otHours: Number(editingPayrollItem.otHours) || 0,
      otCount: Number(editingPayrollItem.otCount) || 0,
      bonusHoliday: Number(editBonusHoliday) || 0,
      bonusCreative: Number(editBonusCreative) || 0,
      otherDeductions: Number(editOtherDeductions) || 0,
      advances: Number(editingPayrollItem.advances) || 0,
      expenses: Number(editingPayrollItem.expenses) || 0
    };

    const calculated = _calcPayroll(emp, editingPayrollItem.month, inputs);

    const updatedPayroll = payroll.map((p) => {
      if (p.id === editingPayrollItem.id) {
        return {
          ...p,
          ...calculated
        };
      }
      return p;
    });

    setPayroll(updatedPayroll);
    setShowEditPayrollModal(false);
    setEditingPayrollItem(null);
    addToast({ title: '✅ Thành công', message: '✅ Đã cập nhật và tái tính toán kết quả lương cho nhân viên thành công!', type: 'success' });
  };

  const handleExportPayrollExcel = () => {
    let htmlContent = `
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11px; }
          th { background-color: #0b5394; color: white; border: 1px solid #c0c0c0; padding: 6px; text-align: center; font-weight: bold; }
          td { border: 1px solid #c0c0c0; padding: 6px; }
          .number { text-align: right; }
          .bold { font-weight: bold; }
          .title { font-size: 16px; font-weight: bold; text-align: center; margin-bottom: 5px; color: #0b5394; }
          .subtitle { font-size: 11px; text-align: center; margin-bottom: 15px; italic: true; }
        </style>
      </head>
      <body>
        <div class="title">BẢNG TÍNH LƯƠNG TỰ ĐỘNG THÁNG ${payrollMonth}/${payrollYear}</div>
        <div class="subtitle">Đơn vị: Đồng Việt Nam (VND) - Công chuẩn quy chuẩn: ${standardWorkDays} ngày</div>
        <table>
          <thead>
            <tr>
              <th rowspan="2">TT</th>
              <th rowspan="2">Họ và tên nhân sự</th>
              <th rowspan="2">Chức vụ</th>
              <th rowspan="2">Lương cơ bản</th>
              <th rowspan="2">Ngày công đi làm</th>
              <th colspan="3">Thưởng Hiệu suất công việc</th>
              <th rowspan="2">Lương trong tháng (HS & Công nhật)</th>
              <th colspan="3">Lương tăng ca lễ, CN</th>
              <th colspan="3">Lương tăng ca ngoài giờ</th>
              <th rowspan="2">Công tác phí</th>
              <th rowspan="2">Thưởng lễ</th>
              <th rowspan="2">Thưởng sáng kiến</th>
              <th rowspan="2">Tổng thu nhập & CTP</th>
              <th rowspan="2">Trừ BHXH (10.5%)</th>
              <th rowspan="2">Khoản giảm trừ khác</th>
              <th rowspan="2">Tạm ứng</th>
              <th rowspan="2">Thực lĩnh</th>
            </tr>
            <tr>
              <th>Định mức</th>
              <th>Điểm</th>
              <th>Thưởng HS thực tế</th>
              <th>Công TC CN</th>
              <th>Công TC lễ</th>
              <th>Tiền TC lễ, CN</th>
              <th>Giờ TC</th>
              <th>Số lần TC</th>
              <th>Tiền TC ngoài giờ</th>
            </tr>
          </thead>
          <tbody>
    `;

    payroll.forEach((pay, index) => {
      const emp = employees.find(e => e.id === pay.empId);
      const roleName = emp ? emp.position : 'Nhân viên';
      
      htmlContent += `
        <tr>
          <td align="center">${index + 1}</td>
          <td><b>${pay.empName}</b></td>
          <td>${roleName}</td>
          <td class="number">${(pay.baseSalary || 0).toLocaleString()}</td>
          <td class="number">${pay.workedDays || 0}</td>
          <td class="number">${(pay.kpiMaxAllowed || 0).toLocaleString()}</td>
          <td class="number">${pay.kpiScore || 100}</td>
          <td class="number">${(pay.kpiBonus || 0).toLocaleString()}</td>
          <td class="number bold" style="background-color: #f7f9fa;">${(pay.monthlySalary || 0).toLocaleString()}</td>
          <td class="number">${pay.otSunday || 0}</td>
          <td class="number">${pay.otHoliday || 0}</td>
          <td class="number">${(pay.otWeekendSalary || 0).toLocaleString()}</td>
          <td class="number">${pay.otHours || 0}</td>
          <td class="number">${pay.otCount || 0}</td>
          <td class="number">${(pay.totalOtHoursSalary || 0).toLocaleString()}</td>
          <td class="number">${(pay.expenses || 0).toLocaleString()}</td>
          <td class="number">${(pay.bonusHoliday || 0).toLocaleString()}</td>
          <td class="number">${(pay.bonusCreative || 0).toLocaleString()}</td>
          <td class="number bold" style="background-color: #e2f0d9;">${(pay.totalIncome || 0).toLocaleString()}</td>
          <td class="number" style="color: #c00000;">${(pay.insurance || 0).toLocaleString()}</td>
          <td class="number">${(pay.otherDeductions || 0).toLocaleString()}</td>
          <td class="number">${(pay.advances || 0).toLocaleString()}</td>
          <td class="number bold" style="background-color: #fff2cc; color: maroon; font-size: 11px;">${(pay.netSalary || 0).toLocaleString()}</td>
        </tr>
      `;
    });

    const totalBase = payroll.reduce((sum, p) => sum + (p.baseSalary || 0), 0);
    const totalMonthly = payroll.reduce((sum, p) => sum + (p.monthlySalary || 0), 0);
    const totalOtW = payroll.reduce((sum, p) => sum + (p.otWeekendSalary || 0), 0);
    const totalOtH = payroll.reduce((sum, p) => sum + (p.totalOtHoursSalary || 0), 0);
    const totalExp = payroll.reduce((sum, p) => sum + (p.expenses || 0), 0);
    const totalInc = payroll.reduce((sum, p) => sum + (p.totalIncome || 0), 0);
    const totalIns = payroll.reduce((sum, p) => sum + (p.insurance || 0), 0);
    const totalDed = payroll.reduce((sum, p) => sum + (p.otherDeductions || 0), 0);
    const totalAdv = payroll.reduce((sum, p) => sum + (p.advances || 0), 0);
    const totalNet = payroll.reduce((sum, p) => sum + (p.netSalary || 0), 0);

    htmlContent += `
          <tr style="font-weight: bold; background-color: #f2f2f2;">
            <td colspan="3" align="center">TỔNG CỘNG</td>
            <td class="number">${totalBase.toLocaleString()}</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td class="number">${totalMonthly.toLocaleString()}</td>
            <td></td>
            <td></td>
            <td class="number">${totalOtW.toLocaleString()}</td>
            <td></td>
            <td></td>
            <td class="number">${totalOtH.toLocaleString()}</td>
            <td class="number">${totalExp.toLocaleString()}</td>
            <td></td>
            <td></td>
            <td class="number" style="background-color: #d9e1f2;">${totalInc.toLocaleString()}</td>
            <td class="number" style="color: #c00000;">${totalIns.toLocaleString()}</td>
            <td class="number">${totalDed.toLocaleString()}</td>
            <td class="number">${totalAdv.toLocaleString()}</td>
            <td class="number" style="background-color: #ffe699; color: maroon;">${totalNet.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
    </body>
    </html>
    `;

    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bang_Luong_Thang_${payrollMonth}_${payrollYear}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Simulation actions
  // ===================== BLOCK HỒ SƠ NHÂN VIÊN (profiles) =====================
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = `NV${String(employees.length + 1).padStart(3, '0')}`;
    const profile: EmployeeProfile = {
      ...newEmp,
      id,
      startDate: getLocalYYYYMMDD(new Date()),
      contractType: 'Thử việc 02 tháng',
      status: 'working',
      docsCount: 3
    };
    setEmployees([...employees, profile]);
    setShowEmpModal(false);
    // Đồng bộ lên Supabase
    try {
      await dbService.employees.save(profile);
    } catch (err) {
      console.warn('Lưu hồ sơ nhân sự lên Supabase thất bại:', err);
    }
    addToast({ title: '✅ Thành công', message: `🎉 Đã thêm hồ sơ nhân sự mã ${id} cho anh/chị ${newEmp.name} thành công.`, type: 'success' });
  };

  const handleSimulateCheckIn = (empId: string, name: string) => {
    // Chỉ cho phép chấm công với nhân viên ĐANG LÀM
    const emp = employees.find(e => e.id === empId);
    if (emp && emp.status !== 'working') {
      addToast({ title: '⛔ Từ chối', message: `⚠️ Nhân viên ${name} (${empId}) không ở trạng thái Đang làm, không thể ghi nhận chấm công.`, type: 'warning' });
      return;
    }
    const todayStr = getLocalYYYYMMDD(new Date());
    // Check if check-in already exists
    const duplicate = attendance.find(a => a.empId === empId && a.date === todayStr);
    if (duplicate) {
      addToast({ title: 'ℹ️ Thông báo', message: `⚠️ Nhân viên ${name} đã được ghi nhận chấm công ngày hôm nay (${todayStr})!`, type: 'info' });
      return;
    }
    const newLog: AttendanceLog = {
      id: `AT-${Date.now().toString().slice(-4)}`,
      empId,
      empName: name,
      date: todayStr,
      timeInS: '07:28',
      timeOutS: '11:30',
      timeInC: '13:00',
      timeOutC: '17:05',
      timeInOT: '',
      timeOutOT: '',
      method: 'GPS Biệt Thự Trạm',
      status: 'valid',
      otHours: 0,
      notes: 'Hệ thống vệ tinh xác nhận chấm công thực tế thành công'
    };
    setAttendance([newLog, ...attendance]);
    addToast({ title: '✅ Thành công', message: `⚡ Chấm công thành công cho [${empId}] ${name} vào lúc 07:28 sáng ngày hôm nay!`, type: 'success' });
  };

  // ===================== BLOCK NGHỈ PHÉP (leaves) =====================
  const handleCreateLeaveRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find(ep => ep.id === newLeave.empId);
    if (!emp) return;

    // Constraint: must apply at least 2 days in advance of today
    try {
      const todayVal = getLocalYYYYMMDD(new Date());
      const todayMidnight = new Date(todayVal);
      todayMidnight.setHours(0,0,0,0);
      const fromMidnight = new Date(newLeave.fromDate);
      fromMidnight.setHours(0,0,0,0);
      
      const timeDiff = fromMidnight.getTime() - todayMidnight.getTime();
      const diffDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
      
      if (diffDays < 2) {
        addToast({ title: '⚠️ Lỗi', message: '⚠️ không thể nộp đơn nghỉ phép! Bạn không được phép nộp đơn xin nghỉ ngay trong ngày làm đơn hoặc ngày hôm sau (phép nghỉ bắt buộc phải đăng ký trước ít nhất 2 ngày).', type: 'warning' });
        return;
      }
    } catch (err) {
      console.error(err);
    }

    if (new Date(newLeave.toDate) < new Date(newLeave.fromDate)) {
      addToast({ title: '⚠️ Lỗi', message: '⚠️ Đến ngày không thể trước Từ ngày!', type: 'warning' });
      return;
    }

    // Constraint: Check if leaveRequestType is annual leave but user runs out or doesn't have enough remaining annual leave days
    if (newLeave.type === 'Nghỉ phép năm') {
      const remainingDays = emp.phepNam !== undefined ? emp.phepNam : 12;
      const reqDays = Number(newLeave.daysCount);
      if (remainingDays <= 0) {
        addToast({ title: '⚠️ Thông báo', message: `⚠️ Không thể nộp đơn! Nhân viên ${emp.name} đã dùng hết số lượng phép năm được cấp (số ngày phép còn lại: 0).`, type: 'warning' });
        return;
      }
      if (reqDays > remainingDays) {
        addToast({ title: '⚠️ Thông báo', message: `⚠️ Không thể nộp đơn! Số ngày xin nghỉ phép năm (${reqDays} ngày) vượt quá số ngày phép năm còn lại của nhân viên (${remainingDays} ngày).`, type: 'warning' });
        return;
      }
    }

    // Constraint: Do not allow leave requests on a Sunday
    try {
      const startD = new Date(newLeave.fromDate);
      const endD = new Date(newLeave.toDate);
      let tempD = new Date(startD);
      let hasSunday = false;
      while (tempD <= endD) {
        if (weekendDays.includes(tempD.getDay())) {
          hasSunday = true;
          break;
        }
        tempD.setDate(tempD.getDate() + 1);
      }
      if (hasSunday) {
        addToast({ title: '⚠️ Thiếu thông tin', message: '⚠️ Không thể nộp đơn! Không cho phép xin nghỉ phép vào ngày nghỉ tuần của công ty để tránh cộng công sai. vui lòng chọn lại khoảng thời gian không chứa ngày nghỉ tuần.', type: 'warning' });
        return;
      }
    } catch (e) {
      console.error(e);
    }

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const submittedAtStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const req: LeaveRequest = {
      id: `LR-${Date.now().toString().slice(-3)}`,
      empId: newLeave.empId,
      empName: emp.name,
      type: newLeave.type,
      fromDate: newLeave.fromDate,
      toDate: newLeave.toDate,
      daysCount: Number(newLeave.daysCount),
      reason: newLeave.reason,
      status: 'pending',
      createdAt: getLocalYYYYMMDD(new Date()),
      submittedAt: submittedAtStr,
      approverName: newLeave.approverName || '',
      approverId: newLeave.approverId || '',
      approverPosition: newLeave.approverPosition || ''
    };
    setLeaves([req, ...leaves]);
    setShowLeaveModal(false);
    addToast({ title: 'ℹ️ Thông báo', message: `đã nộp Đơn nghỉ lý do: "${newLeave.reason}" trình lên cấp duyệt quản lý trực tiếp.`, type: 'info' });
  };

  const handleApproveLeave = (id: string, status: 'approved' | 'rejected') => {
    const targetLeave = leaves.find(l => l.id === id);
    if (targetLeave && status === 'approved' && targetLeave.type === 'Nghỉ phép năm' && targetLeave.status !== 'approved') {
      setEmployees(prev => prev.map(emp => {
        if (emp.id === targetLeave.empId) {
          const currentPhep = emp.phepNam !== undefined ? emp.phepNam : 12;
          const leaveDays = targetLeave.daysCount !== undefined ? targetLeave.daysCount : 1;
          return { ...emp, phepNam: Math.max(0, currentPhep - leaveDays) };
        }
        return emp;
      }));
    }

    const getLeaveSymbol = (type: string) => {
      if (leaveCoefficients && leaveCoefficients.length > 0) {
        const found = leaveCoefficients.find((c: any) => c.type === type);
        if (found) return found.id || 'OFF';
      }
      if (type === 'Nghỉ phép năm') return 'PN';
      if (type === 'Nghỉ không lương có xin phép') return 'P';
      if (type === 'Nghỉ không lương không xin phép') return 'KP';
      if (type.includes('lễ')) return 'NL';
      if (type.includes('hiếu') || type.includes('ma chay')) return 'T';
      if (type.includes('cưới')) return 'C';
      return 'OFF';
    };

    const getDaysDiffList = (fromStr: string, toStr: string) => {
      const dates: string[] = [];
      try {
        const start = new Date(fromStr);
        const end = new Date(toStr);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          dates.push(getLocalYYYYMMDD(d));
        }
      } catch (err) {
        console.error(err);
      }
      return dates;
    };

    setLeaves(leaves.map(l => {
      if (l.id === id) {
        if (status === 'approved') {
          try {
            const symbol = getLeaveSymbol(l.type);
            const leaveDates = getDaysDiffList(l.fromDate, l.toDate);
            let updatedAttendance = [...attendance];

            leaveDates.forEach(dStr => {
              const idx = updatedAttendance.findIndex(at => at.empId === l.empId && at.date === dStr);
              if (idx !== -1) {
                if (l.isAttendanceCorrection || l.type === 'Yêu cầu xét duyệt công' || l.type === 'Báo cáo nghỉ ca' || l.type === 'Báo cáo lỗi chấm ra ca') {
                  const currentAt = updatedAttendance[idx];
                  let timeInS = currentAt.timeInS;
                  let timeOutS = currentAt.timeOutS;
                  let timeInC = currentAt.timeInC;
                  let timeOutC = currentAt.timeOutC;

                  if (l.type === 'Báo cáo lỗi chấm ra ca') {
                    if (l.shift === 'morning') {
                      timeOutS = '11:30';
                    } else if (l.shift === 'afternoon') {
                      timeOutC = '17:00';
                    }
                  } else if (l.type === 'Báo cáo nghỉ ca') {
                    // Trạng thái ngày đó sẽ là HỢP LỆ, không cần ghi thêm giờ nếu không có sẵn
                  } else {
                    timeInS = currentAt.timeInS && currentAt.timeInS !== '--:--' && currentAt.timeInS !== '' ? currentAt.timeInS : '07:30';
                    timeOutS = currentAt.timeOutS && currentAt.timeOutS !== '--:--' && currentAt.timeOutS !== '' ? currentAt.timeOutS : '11:30';
                    timeInC = currentAt.timeInC && currentAt.timeInC !== '--:--' && currentAt.timeInC !== '' ? currentAt.timeInC : '13:00';
                    timeOutC = currentAt.timeOutC && currentAt.timeOutC !== '--:--' && currentAt.timeOutC !== '' ? currentAt.timeOutC : '17:00';
                  }

                  updatedAttendance[idx] = {
                    ...currentAt,
                    timeInS,
                    timeOutS,
                    timeInC,
                    timeOutC,
                    status: 'valid',
                    statusMsg: 'Hợp lệ',
                    leaveSymbol: undefined,
                    notes: l.reason
                  };
                } else {
                  updatedAttendance[idx] = {
                    ...updatedAttendance[idx],
                    timeInS: symbol,
                    timeOutS: symbol,
                    timeInC: symbol,
                    timeOutC: symbol,
                    status: 'excused',
                    notes: `Nghỉ phép được duyệt: ${l.type} (${symbol})`
                  };
                }
              } else {
                if (l.isAttendanceCorrection || l.type === 'Yêu cầu xét duyệt công' || l.type === 'Báo cáo nghỉ ca' || l.type === 'Báo cáo lỗi chấm ra ca') {
                  let timeInS = '07:30';
                  let timeOutS = '11:30';
                  let timeInC = '13:00';
                  let timeOutC = '17:00';

                  if (l.type === 'Báo cáo lỗi chấm ra ca') {
                    if (l.shift === 'morning') {
                      timeInS = '07:30';
                      timeOutS = '11:30';
                      timeInC = '';
                      timeOutC = '';
                    } else if (l.shift === 'afternoon') {
                      timeInS = '';
                      timeOutS = '';
                      timeInC = '13:00';
                      timeOutC = '17:00';
                    }
                  } else if (l.type === 'Báo cáo nghỉ ca') {
                    if (l.shift === 'morning') {
                      timeInS = '';
                      timeOutS = '';
                      timeInC = '13:00';
                      timeOutC = '17:00';
                    } else if (l.shift === 'afternoon') {
                      timeInS = '07:30';
                      timeOutS = '11:30';
                      timeInC = '';
                      timeOutC = '';
                    }
                  }

                  const simulatedLog: AttendanceLog = {
                    id: `AT-${Date.now().toString().slice(-3)}-${Math.random().toString().slice(-2)}`,
                    empId: l.empId,
                    empName: l.empName,
                    date: dStr,
                    timeInS,
                    timeOutS,
                    timeInC,
                    timeOutC,
                    timeInOT: '',
                    timeOutOT: '',
                    method: 'Duyệt công',
                    status: 'valid',
                    statusMsg: 'Hợp lệ',
                    otHours: 0,
                    notes: l.reason
                  };
                  updatedAttendance.unshift(simulatedLog);
                } else {
                  const simulatedLog: AttendanceLog = {
                    id: `AT-${Date.now().toString().slice(-3)}-${Math.random().toString().slice(-2)}`,
                    empId: l.empId,
                    empName: l.empName,
                    date: dStr,
                    timeInS: symbol,
                    timeOutS: symbol,
                    timeInC: symbol,
                    timeOutC: symbol,
                    timeInOT: '',
                    timeOutOT: '',
                    method: 'Hành chính phép',
                    status: 'excused',
                    otHours: 0,
                    notes: `Nghỉ phép được duyệt: ${l.type} (${symbol})`
                  };
                  updatedAttendance.unshift(simulatedLog);
                }
              }
            });

            setAttendance(updatedAttendance);
          } catch (e) {
            console.error(e);
          }
        } else if (status === 'rejected') {
          if (l.type === 'Báo cáo nghỉ ca' || l.type === 'Báo cáo lỗi chấm ra ca') {
            try {
              const leaveDates = getDaysDiffList(l.fromDate, l.toDate);
              let updatedAttendance = [...attendance];

              leaveDates.forEach(dStr => {
                const idx = updatedAttendance.findIndex(at => at.empId === l.empId && at.date === dStr);
                if (idx !== -1) {
                  updatedAttendance[idx] = {
                    ...updatedAttendance[idx],
                    status: 'invalid',
                    statusMsg: 'Không hợp lệ',
                    notes: `Bị từ chối duyệt: ${l.reason || ''}`
                  };
                } else {
                  const simulatedLog: AttendanceLog = {
                    id: `AT-${Date.now().toString().slice(-3)}-${Math.random().toString().slice(-2)}`,
                    empId: l.empId,
                    empName: l.empName,
                    date: dStr,
                    timeInS: l.shift === 'morning' ? 'OFF' : '',
                    timeOutS: '',
                    timeInC: l.shift === 'afternoon' ? 'OFF' : '',
                    timeOutC: '',
                    timeInOT: '',
                    timeOutOT: '',
                    method: 'Duyệt công',
                    status: 'invalid',
                    statusMsg: 'Không hợp lệ',
                    otHours: 0,
                    notes: `Bị từ chối duyệt: ${l.reason || ''}`
                  };
                  updatedAttendance.unshift(simulatedLog);
                }
              });

              setAttendance(updatedAttendance);
            } catch (e) {
              console.error(e);
            }
          }
        }
        return { ...l, status };
      }
      return l;
    }));
    if (status === 'approved') {
      addToast({ title: 'ℹ️ Thông báo', message: "Đã duyệt", type: 'info' });
    } else {
      addToast({ title: 'ℹ️ Thông báo', message: "Từ chối", type: 'info' });
    }
  };

  // ===================== BLOCK CÔNG TÁC PHÍ (trips) =====================
  const handleCreateTrip = (e: React.FormEvent) => {
    e.preventDefault();
    const trip: BusinessTrip = {
      ...newTrip,
      id: `BT-${Date.now().toString().slice(-2)}`,
      status: 'pending',
      settledCost: 0,
      settleStatus: 'draft'
    };
    setTrips([trip, ...trips]);
    setShowTripModal(false);
    addToast({ title: 'ℹ️ Thông báo', message: `✈️ Đã tạo đề xuất công tác phí và lên lịch đi đến: ${newTrip.destination}.`, type: 'info' });
  };

  const handleApproveTrip = (id: string) => {
    setTrips(trips.map(t => t.id === id ? { ...t, status: 'approved' } : t));
    addToast({ title: '✅ Thành công', message: '✅ Chủ quản đã duyệt kinh phí tạm ứng công tác thành công, hệ thống sinh ủy nhiệm chi tạm ứng ngân sách phòng kế toán.', type: 'success' });
  };

  const handleSettleTrip = (id: string, actual: number) => {
    setTrips(trips.map(t => {
      if (t.id === id) {
        return {
          ...t,
          status: 'completed',
          settledCost: actual,
          settleStatus: 'settled'
        };
      }
      return t;
    }));
    addToast({ title: 'ℹ️ Thông báo', message: `📈 Đã hoàn tất quyết toán số tiền thực tế chi ${actual.toLocaleString('vi-VN')} đ cho chuyến đi.`, type: 'info' });
  };

  // Vietnamese Number to Words Conversion
  const docSoTiengViet = (cuSo: number): string => {
    if (cuSo === 0) return 'Không đồng';
    
    const handleRound = Math.round(cuSo);
    const units = ['', ' nghìn', ' triệu', ' tỷ', ' nghìn tỷ', ' triệu tỷ'];
    const chuSo = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
    
    function readGroupOfThree(n: number, showZeroUnit: boolean = true): string {
      const tram = Math.floor(n / 100);
      const chuc = Math.floor((n % 100) / 10);
      const donVi = n % 10;
      let res = '';
      
      if (tram > 0 || showZeroUnit) {
        res += chuSo[tram] + ' trăm ';
      }
      
      if (chuc > 1) {
        res += chuSo[chuc] + ' mươi ';
        if (donVi === 1) res += 'mốt';
        else if (donVi === 5) res += 'lăm';
        else if (donVi > 0) res += chuSo[donVi];
      } else if (chuc === 1) {
        res += 'mười ';
        if (donVi === 5) res += 'lăm';
        else if (donVi > 0) res += chuSo[donVi];
      } else if (chuc === 0 && donVi > 0) {
        if (tram > 0 || showZeroUnit) res += 'lẻ ';
        res += chuSo[donVi];
      }
      
      return res.trim();
    }

    let text = '';
    let temp = handleRound;
    let groupIndex = 0;
    
    while (temp > 0) {
      const group = temp % 1000;
      if (group > 0) {
        const groupText = readGroupOfThree(group, temp >= 1000);
        text = groupText + units[groupIndex] + ' ' + text;
      }
      temp = Math.floor(temp / 1000);
      groupIndex++;
    }
    
    text = text.trim();
    text = text.replace(/\s+/g, ' ');
    if (!text) return 'Không đồng';
    
    return text.charAt(0).toUpperCase() + text.slice(1) + ' đồng';
  };

  const triggerDownloadPayslip = (item: PayrollItem) => {
    setPrintingPayrollItem(item);
    setShowPrintPayslipModal(true);
  };

  const downloadPDFPayslip = async (item: PayrollItem) => {
    const element = document.getElementById('printable-payslip-canvas-content');
    if (!element) {
      addToast({ title: 'ℹ️ Thông báo', message: 'Không tìm thấy nội dung phiếu lương để tải PDF!', type: 'warning' });
      return;
    }

    const opt = {
      margin:       10, // 10mm margins for a crisp fit
      filename:     `PhieuLuong_${item.empId}_Thang${item.month.replace('/', '_')}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    const html2pdf = (await loadHtml2Pdf()) as any;
    html2pdf().from(element).set(opt).save();
  };

  const downloadRawTextSlip = (item: PayrollItem) => {
    const slipText = `
========================================
    PHIẾU LƯƠNG NHÂN VIÊN CHI TIẾT
         CÔNG TY HOÀNG LONG (LÂM ĐỒNG)
========================================
Mã nhân viên   : ${item.empId}
Tên nhân viên  : ${item.empName}
Thời điểm kỳ   : Tháng ${item.month}
----------------------------------------
Thu nhập chính thức:
 + Lương theo công : ${item.baseSalary.toLocaleString('vi-VN')} đ
 + Ngày công đạt   : ${item.workedDays} ngày công
 + Lương tăng ca   : ${(item.otSundaySalary + item.otHolidaySalary).toLocaleString('vi-VN')} đ
 + Lương tăng ca ngoài giờ: ${(item.otHoursSalary || 0).toLocaleString('vi-VN')} đ (${item.otHours} giờ)
 + Thưởng KPI      : ${item.kpiBonus.toLocaleString('vi-VN')} đ
----------------------------------------
Các khoản khấu trừ:
 - Tạm ứng kỳ trước: ${item.advances.toLocaleString('vi-VN')} đ
 - Đóng Bảo hiểm   : ${item.insurance.toLocaleString('vi-VN')} đ
 - Thuế TNCN tạm tính: ${(item.tax || 0).toLocaleString('vi-VN')} đ
 - Khấu trừ khác   : ${item.otherDeductions.toLocaleString('vi-VN')} đ
----------------------------------------
THỰC NHẬN CHUYỂN KHOẢN:
 >>> ${item.netSalary.toLocaleString('vi-VN')} đ <<<
----------------------------------------
Kế Toán: ${printKeToanTruong}
Người lập/phát phiếu: ${printNguoiPhat}
========================================
Generated by HL ERP Cloud v2.1 (2026)
`;
    const textBlob = new Blob([slipText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(textBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PhieuLuong_${item.empId}_Thang${item.month.replace('/', '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintPayslip = (
    item: PayrollItem,
    notes: string,
    nguoiPhat: string,
    keToan: string
  ) => {
    const targetEmp = employees.find((e: any) => e.id === item.empId);
    const position = targetEmp?.position || 'Nhân viên';
    
    const dayAndPerformanceSalary = item.daySalary || 0;
    const otWeekendAndHoliday = (item.otSundaySalary || 0) + (item.otHolidaySalary || 0);
    const perfSalary = item.performanceSalary || 0;
    const kpiBonus = item.kpiBonus || 0;
    const docTien = docSoTiengViet(item.netSalary);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'vui lòng cho phép mở popup trên trình duyệt của bạn để thực hiện in phiếu lương!', type: 'warning' });
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Phieu_Luong_${item.empId}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
            body {
              font-family: 'Roboto', 'Times New Roman', Times, serif;
              color: #000;
              background: #fff;
              margin: 30px;
              font-size: 13.5px;
              line-height: 1.4;
            }
            .title-container {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 12px;
              border-bottom: 2px solid #000;
              padding-bottom: 6px;
            }
            .title-main {
              font-size: 21px;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .title-subtitle {
              font-size: 18px;
              font-weight: bold;
              text-transform: uppercase;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
            }
            th, td {
              border: 1px solid #000;
              padding: 6.5px 10px;
              text-align: left;
              vertical-align: middle;
            }
            .col-name {
              width: 38%;
              font-weight: bold;
              background-color: #f7f7f7;
            }
            .col-val {
              width: 32%;
              text-align: right;
            }
            .col-notes {
              width: 30%;
              vertical-align: top;
            }
            .align-left {
              text-align: left !important;
            }
            .align-right {
              text-align: right !important;
            }
            .align-center {
              text-align: center !important;
            }
            .bg-highlight {
              background-color: #FAD7A0 !important;
              font-weight: bold;
            }
            .text-highlight {
              color: #784212 !important;
            }
            .footer-section {
              margin-top: 15px;
              text-align: right;
              font-style: italic;
              font-size: 13px;
              margin-bottom: 12px;
            }
            .sign-grid {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              text-align: center;
              margin-top: 20px;
              font-size: 13.5px;
            }
            .sign-title {
              font-weight: bold;
              margin-bottom: 65px;
            }
            .sign-name {
              font-weight: bold;
            }
            .no-print-btn {
              text-align: center;
              margin-top: 35px;
            }
            .btn {
              background-color: #e67e22;
              color: #fff;
              border: none;
              padding: 10px 20px;
              font-size: 14px;
              font-weight: bold;
              border-radius: 5px;
              cursor: pointer;
              box-shadow: 0 2px 4px rgba(0,0,0,0.15);
            }
            @media print {
              body { margin: 15px; }
              .no-print-btn { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="title-container">
            <div class="title-main">PHIẾU LƯƠNG</div>
            <div class="title-subtitle">THÁNG ${item.month}</div>
          </div>
          
          <table>
            <tbody>
              <tr>
                <td class="col-name">Họ và tên</td>
                <td class="col-val align-left bg-highlight" style="font-size: 14.5px;">${item.empName}</td>
                <td class="col-notes" rowspan="2" style="font-weight: bold; text-align: center; background-color: #f2f2f2; width: 30%;">
                  Ghi chú
                  <div style="font-weight: normal; font-style: italic; text-align: left; margin-top: 6px; font-size: 12px; font-family: sans-serif; white-space: pre-wrap; line-height: 1.4;">${notes || ''}</div>
                </td>
              </tr>
              <tr>
                <td class="col-name">Chức vụ</td>
                <td class="col-val align-left">${position}</td>
              </tr>
              <tr>
                <td class="col-name">Lương cơ bản</td>
                <td class="col-val">${(item.baseSalary || 0).toLocaleString('vi-VN')}</td>
                <td rowspan="17" style="background-color: #fafafa;"></td>
              </tr>
              <tr>
                <td class="col-name">Ngày công đi làm</td>
                <td class="col-val">${item.workedDays || 0}</td>
              </tr>
              <tr>
                <td class="col-name">Thưởng hiệu suất 100 %</td>
                <td class="col-val">${(perfSalary || 0).toLocaleString('vi-VN')}</td>
              </tr>
              <tr>
                <td class="col-name">Điểm KPI</td>
                <td class="col-val">${item.kpiScore || 100}</td>
              </tr>
              <tr>
                <td class="col-name">Mức hưởng KPI</td>
                <td class="col-val">${(kpiBonus || 0).toLocaleString('vi-VN')}</td>
              </tr>
              <tr style="font-weight: bold;">
                <td class="col-name">Lương ngày công + Hiệu suất</td>
                <td class="col-val">${(dayAndPerformanceSalary || 0).toLocaleString('vi-VN')}</td>
              </tr>
              <tr>
                <td class="col-name">Lương tăng ca lễ, CN</td>
                <td class="col-val">${(otWeekendAndHoliday || 0).toLocaleString('vi-VN')}</td>
              </tr>
              <tr>
                <td class="col-name">Lương tăng ca ngoài giờ</td>
                <td class="col-val">${(item.otHoursSalary || 0).toLocaleString('vi-VN')}</td>
              </tr>
              <tr>
                <td class="col-name">Thưởng lễ</td>
                <td class="col-val">${(item.bonusHoliday || 0).toLocaleString('vi-VN')}</td>
              </tr>
              <tr>
                <td class="col-name">Thưởng sáng kiến</td>
                <td class="col-val">${(item.bonusCreative || 0).toLocaleString('vi-VN')}</td>
              </tr>
              <tr>
                <td class="col-name">Công tác phí</td>
                <td class="col-val">${(item.expenses || 0).toLocaleString('vi-VN')}</td>
              </tr>
              <tr style="font-weight: bold;">
                <td class="col-name">Tổng thu nhập & công tác phí</td>
                <td class="col-val">${(item.totalIncome || 0).toLocaleString('vi-VN')}</td>
              </tr>
              <tr>
                <td class="col-name">Khoản giảm trừ khác</td>
                <td class="col-val">${(item.otherDeductions || 0).toLocaleString('vi-VN')}</td>
              </tr>
              <tr>
                <td class="col-name">Thuế TNCN</td>
                <td class="col-val">${(item.tax || 0).toLocaleString('vi-VN')}</td>
              </tr>
              <tr>
                <td class="col-name">Khấu trừ BHXH 10,5%</td>
                <td class="col-val">${(item.insurance || 0).toLocaleString('vi-VN')}</td>
              </tr>
              <tr>
                <td class="col-name">Tạm ứng hoặc lĩnh trước</td>
                <td class="col-val">${(item.advances || 0).toLocaleString('vi-VN')}</td>
              </tr>
              <tr class="bg-highlight">
                <td class="col-name">Thực lĩnh tháng này</td>
                <td class="col-val align-center scale-105" style="font-size: 15.5px; background-color: #FAD7A0;">${(item.netSalary || 0).toLocaleString('vi-VN')}</td>
              </tr>
              <tr>
                <td class="col-name" style="font-family: serif; font-style: italic;">Số tiền bằng chữ</td>
                <td colspan="2" class="align-left" style="font-family: serif; font-style: italic; font-size: 13px; line-height: 1.5; font-weight: bold;">${docTien}</td>
              </tr>
            </tbody>
          </table>

          <div class="footer-section">
            ${printDatePlace}
          </div>

          <div class="sign-grid">
            <div>
              <div class="sign-title">Người nhận</div>
              <div class="sign-name">${item.empName}</div>
            </div>
            <div>
              <div class="sign-title">Người phát</div>
              <div class="sign-name">${nguoiPhat}</div>
            </div>
            <div>
              <div class="sign-title">Kế Toán</div>
              <div class="sign-name">${keToan}</div>
            </div>
          </div>

          <div class="no-print-btn">
            <button class="btn" onclick="window.print();">🖨️ In Phiếu Lương Này</button>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 450);
  };

  return (
    <div className="bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden font-sans" id="erp_hrm_module">
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[75vh]">
        
        {/* LEFT COLUMN: NAVIGATION & SUITE STATS (3 cols) */}
        {menuDisplayMode === 'sidebar' && !hideSidebar && activeSubTab !== 'hr_data' && (
          <div className="lg:col-span-3 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 font-sans p-4 space-y-4" id="hrm_sidebar_control">
            <div>
              {/* Interactive Functional Tabs */}
              <div className="flex flex-col gap-1 text-[11px] mt-4">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('profiles')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left font-bold transition-all ${activeSubTab === 'profiles' ? 'bg-slate-800/90 text-white border-l-4 border-amber-500' : 'text-slate-400 hover:text-white hover:bg-slate-850/50'}`}
                >
                  <UserCheck className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                  <span>1. Hồ sơ nhân viên</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('attendance')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left font-bold transition-all ${activeSubTab === 'attendance' ? 'bg-slate-800/90 text-white border-l-4 border-amber-500' : 'text-slate-400 hover:text-white hover:bg-slate-850/50'}`}
                >
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  <span>2. Chấm công ngày</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('leaves')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left font-bold transition-all ${activeSubTab === 'leaves' ? 'bg-slate-800/90 text-white border-l-4 border-amber-500' : 'text-slate-400 hover:text-white hover:bg-slate-850/50'}`}
                >
                  <Calendar className="w-3.5 h-3.5 text-pink-400" />
                  <span>3. Đơn nghỉ phép</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('payroll')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left font-bold transition-all ${activeSubTab === 'payroll' ? 'bg-slate-800/90 text-white border-l-4 border-amber-500' : 'text-slate-400 hover:text-white hover:bg-slate-850/50'}`}
                >
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  <span>4. Tính lương tự động</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('trips')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left font-bold transition-all ${activeSubTab === 'trips' ? 'bg-slate-800/90 text-white border-l-4 border-amber-500' : 'text-slate-400 hover:text-white hover:bg-slate-850/50'}`}
                >
                  <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                  <span>5. Công tác phí</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('performance')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left font-bold transition-all ${activeSubTab === 'performance' ? 'bg-slate-800/90 text-white border-l-4 border-amber-500' : 'text-slate-400 hover:text-white hover:bg-slate-850/50'}`}
                >
                  <Award className="w-3.5 h-3.5 text-amber-550" />
                  <span>6. Hiệu suất công việc</span>
                </button>
              </div>
            </div>

            <div className="p-3 border-t border-slate-850/70 text-[9px] text-slate-500 text-center uppercase tracking-wider font-bold">
              Hoàng Long Group • HRM v2.1
            </div>
          </div>
        )}

        {/* RIGHT COLUMN: MAIN PANEL VIEWPORT (9 cols) */}
        <div className={`${(menuDisplayMode === 'tabs' || hideSidebar || activeSubTab === 'hr_data') ? 'lg:col-span-12' : 'lg:col-span-9'} p-6 bg-slate-950 flex flex-col justify-between`} id="hrm_workspace_panel">
          <div>
            
            {/* Top Navigation & Mode Switcher (Fully active when menuDisplayMode is 'tabs') */}
            {menuDisplayMode === 'tabs' && !hideSidebar && activeSubTab !== 'hr_data' && (
              <div className="bg-white border-b border-slate-200 mb-6 rounded-t-lg">
                {/* Horizontal underline-tab list (style: bottom-border tabs) */}
                <ul className="flex flex-nowrap md:flex-wrap items-center gap-1 -mb-px text-sm font-medium overflow-x-auto scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <li>
                    <button
                      type="button"
                      onClick={() => setActiveSubTab('profiles')}
                      aria-current={activeSubTab === 'profiles' ? 'page' : undefined}
                      className={`group inline-flex items-center justify-center px-4 py-3 border-b border-transparent rounded-t-lg transition-all whitespace-nowrap cursor-pointer ${activeSubTab === 'profiles' ? 'text-amber-600 border-amber-500' : 'text-slate-600 hover:text-amber-600 hover:border-slate-300'}`}
                    >
                      <UserCheck className={`w-4 h-4 me-2 ${activeSubTab === 'profiles' ? 'text-amber-600' : 'text-slate-400 group-hover:text-amber-600'}`} />
                      <span>Hồ sơ nhân viên</span>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => setActiveSubTab('attendance')}
                      aria-current={activeSubTab === 'attendance' ? 'page' : undefined}
                      className={`group inline-flex items-center justify-center px-4 py-3 border-b border-transparent rounded-t-lg transition-all whitespace-nowrap cursor-pointer ${activeSubTab === 'attendance' ? 'text-amber-600 border-amber-500' : 'text-slate-600 hover:text-amber-600 hover:border-slate-300'}`}
                    >
                      <Clock className={`w-4 h-4 me-2 ${activeSubTab === 'attendance' ? 'text-amber-600' : 'text-slate-400 group-hover:text-amber-600'}`} />
                      <span>Chấm công ngày</span>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => setActiveSubTab('leaves')}
                      aria-current={activeSubTab === 'leaves' ? 'page' : undefined}
                      className={`group inline-flex items-center justify-center px-4 py-3 border-b border-transparent rounded-t-lg transition-all whitespace-nowrap cursor-pointer ${activeSubTab === 'leaves' ? 'text-amber-600 border-amber-500' : 'text-slate-600 hover:text-amber-600 hover:border-slate-300'}`}
                    >
                      <Calendar className={`w-4 h-4 me-2 ${activeSubTab === 'leaves' ? 'text-amber-600' : 'text-slate-400 group-hover:text-amber-600'}`} />
                      <span>Đơn nghỉ phép</span>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => setActiveSubTab('payroll')}
                      aria-current={activeSubTab === 'payroll' ? 'page' : undefined}
                      className={`group inline-flex items-center justify-center px-4 py-3 border-b border-transparent rounded-t-lg transition-all whitespace-nowrap cursor-pointer ${activeSubTab === 'payroll' ? 'text-amber-600 border-amber-500' : 'text-slate-600 hover:text-amber-600 hover:border-slate-300'}`}
                    >
                      <DollarSign className={`w-4 h-4 me-2 ${activeSubTab === 'payroll' ? 'text-amber-600' : 'text-slate-400 group-hover:text-amber-600'}`} />
                      <span>Tính lương tự động</span>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => setActiveSubTab('trips')}
                      aria-current={activeSubTab === 'trips' ? 'page' : undefined}
                      className={`group inline-flex items-center justify-center px-4 py-3 border-b border-transparent rounded-t-lg transition-all whitespace-nowrap cursor-pointer ${activeSubTab === 'trips' ? 'text-amber-600 border-amber-500' : 'text-slate-600 hover:text-amber-600 hover:border-slate-300'}`}
                    >
                      <MapPin className={`w-4 h-4 me-2 ${activeSubTab === 'trips' ? 'text-amber-600' : 'text-slate-400 group-hover:text-amber-600'}`} />
                      <span>Công tác phí</span>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => setActiveSubTab('performance')}
                      aria-current={activeSubTab === 'performance' ? 'page' : undefined}
                      className={`group inline-flex items-center justify-center px-4 py-3 border-b border-transparent rounded-t-lg transition-all whitespace-nowrap cursor-pointer ${activeSubTab === 'performance' ? 'text-amber-600 border-amber-500' : 'text-slate-600 hover:text-amber-600 hover:border-slate-300'}`}
                    >
                      <Award className={`w-4 h-4 me-2 ${activeSubTab === 'performance' ? 'text-amber-600' : 'text-slate-400 group-hover:text-amber-600'}`} />
                      <span>Hiệu suất</span>
                    </button>
                  </li>
                </ul>
              </div>
            )}
            
            {/* Header block summarizing currently viewed subtab */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-850 pb-4 mb-5 gap-3 shrink-0">
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2 capitalize">
                  {activeSubTab === 'profiles' && '👥 Quản lý Hồ sơ & Hợp đồng nhân sự'}
                  {activeSubTab === 'attendance' && '⏰ Nhật ký Chấm công & Lịch làm ca'}
                  {activeSubTab === 'leaves' && '📬 Quản lý Đăng ký Nghỉ phép & Trừ phép tự động'}
                  {activeSubTab === 'payroll' && '💰 Bảng tổng hợp Tính lương tự động'}
                  {activeSubTab === 'performance' && '🏆 Quản lý Hiệu suất Công việc & Lỗi Kỷ luật'}
                  {activeSubTab === 'trips' && '✈️ Tổng hợp công tác phí'}
                  {activeSubTab === 'roles' && '🛡️ Phân quyền chức năng & Vai trò người dùng'}
                  {activeSubTab === 'hr_data' && (
                    activeHrDataSubTab === 'insurance'
                      ? '🛡️ Quản lý Bảo hiểm xã hội & Giảm trừ gia cảnh'
                      : '🗄️ Cấu hình Dữ liệu nhân sự doanh nghiệp'
                  )}
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  {activeSubTab === 'profiles' && 'Đăng ký lý lịch nhân viên, hợp đồng, phụ cấp ăn, mâm điện thoại xăng xe.'}
                  {activeSubTab === 'attendance' && 'Mốc vào sáng 07:30, vào chiều 13:00, tăng ca 17:45. Tích hợp máy vân tay vĩ độ.'}
                  {activeSubTab === 'leaves' && 'Tính toán số ngày phép còn tồn, tự động bù trừ mốc thợ thầu công nhật.'}
                  {activeSubTab === 'payroll' && 'Thu nhập sạch sau khi bù trừ thuế TNCN, đóng bảo hiểm và ứng chi công tác phí.'}
                  {activeSubTab === 'performance' && 'Ghi nhận lỗi vi phạm tác phong, kỹ luật và tự động đánh giá xếp loại theo tổng lỗi mắc phải.'}
                  {activeSubTab === 'trips' && 'Tổng hợp công tác phí.'}
                  {activeSubTab === 'roles' && 'Thiết lập nhóm vai trò người dùng, tùy biến chi tiết quyền Xem, Thêm, Sửa, Xóa cho từng phân hệ ERP.'}
                  {activeSubTab === 'hr_data' && (
                    activeHrDataSubTab === 'insurance'
                      ? 'Kết hợp số liệu đăng ký BHXH, mức đóng mặc định 10.5% và thông tin người phụ thuộc thuế TNCN.'
                      : 'Bảng danh mục các ngày nghỉ lễ năm 2026 và cấu hình ngày quy định cho toàn chuỗi.'
                  )}
                </p>
              </div>

              {/* Action Buttons & Filters on top headers */}
              <div className="flex flex-wrap gap-2 w-full sm:w-auto text-[11px] items-center justify-end">
                {activeSubTab === 'profiles' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowEmpModal(true)}
                      className="bg-amber-600 hover:bg-amber-550 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Thêm nhân viên
                    </button>
                    <button
                      onClick={handleExportProfilesExcel}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Xuất Excel
                    </button>
                    <button
                      onClick={() => profileFileInputRef.current?.click()}
                      className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <FileUp className="w-3.5 h-3.5" /> Nhập Excel
                    </button>
                    <input
                      ref={profileFileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={handleImportProfilesExcel}
                    />
                  </div>
                )}

                {activeSubTab === 'trips' && (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 text-[10px] font-bold uppercase">Nhân viên:</span>
                      <select
                        value={selectedEmpFilter}
                        onChange={(e) => setSelectedEmpFilter(e.target.value)}
                        className="bg-slate-900 border border-slate-800 text-white rounded px-2.5 py-1 text-[11px] outline-none font-medium focus:border-amber-500 transition-colors cursor-pointer"
                      >
                        <option value="all">Tất cả nhân viên</option>
                        {Array.from(new Set(travelExpensesSummary.map(item => item.employeeName).filter(Boolean))).map((empName: any) => (
                          <option key={empName} value={empName}>
                            {empName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 text-[10px] font-bold uppercase">Tháng:</span>
                      <select
                        value={selectedMonthFilter}
                        onChange={(e) => setSelectedMonthFilter(e.target.value)}
                        className="bg-slate-900 border border-slate-800 text-white rounded px-2.5 py-1 text-[11px] outline-none font-medium focus:border-amber-500 transition-colors cursor-pointer"
                      >
                        <option value="all">Tất cả</option>
                        {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(m => (
                          <option key={m} value={m}>Tháng {m}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 text-[10px] font-bold uppercase">Năm:</span>
                      <select
                        value={selectedYearFilter}
                        onChange={(e) => setSelectedYearFilter(e.target.value)}
                        className="bg-slate-900 border border-slate-800 text-white rounded px-2.5 py-1 text-[11px] outline-none font-medium focus:border-amber-500 transition-colors cursor-pointer"
                      >
                        <option value="all">Tất cả</option>
                        {['2024', '2025', '2026', '2027'].map(y => (
                          <option key={y} value={y}>Năm {y}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={handleExportExcel}
                      className="bg-emerald-600 hover:bg-emerald-550 text-slate-950 font-extrabold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                      title="Xuất file báo cáo Excel"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" /> Xuất file Excel
                    </button>

                  </div>
                )}

                {activeSubTab === 'leaves' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const configuredApprover = getConfiguredApprover('leave');
                        if (configuredApprover) {
                          setNewLeave(prev => ({ ...prev, approverName: configuredApprover.name, approverId: configuredApprover.id, approverPosition: configuredApprover.position || '' }));
                        }
                        setShowLeaveModal(true);
                      }}
                      className="bg-pink-600 hover:bg-pink-550 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Tạo Đơn Phép
                    </button>
                  </div>
                )}

                {activeSubTab === 'payroll' && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateSalaryAdvance}
                      className="bg-cyan-600 hover:bg-cyan-550 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <DollarSign className="w-3.5 h-3.5" /> Tạm Ứng Lương Nhanh
                    </button>
                  </div>
                )}

              </div>
            </div>

            {/* TAB PORT DISPLAY */}

            {/* TAB: EMPS PROFILES */}
            {/* ======= SWITCH RENDER 8 SUB-TAB (start) =======
                Mỗi sub-tab là 1 component con trong ./hr/tabs/*.
                Phần filter/action header của mỗi tab nằm ở các block
                `{activeSubTab === 'X' && (...)` phía trên (line ~3498-3672);
                phần thân component mount ở đây. Xem PROGRESS.md để tra
                số dòng hàm tương ứng. ========================================== */}
            {activeSubTab === 'profiles' && (
              <ProfilesTab
                employees={employees}
                setEmployees={setEmployees}
                roles={roles}
                setRoles={setRoles}
                selectedEmpId={selectedEmpId}
                setSelectedEmpId={setSelectedEmpId}
                employeeSearch={employeeSearch}
                setEmployeeSearch={setEmployeeSearch}
                isEditingEmp={isEditingEmp}
                setIsEditingEmp={setIsEditingEmp}
                editingEmpData={editingEmpData}
                setEditingEmpData={setEditingEmpData}
                profilePage={profilePage}
                setProfilePage={setProfilePage}
                globalPageSize={globalPageSize}
                setGlobalPageSize={setGlobalPageSize}
                handleSimulateCheckIn={handleSimulateCheckIn}
                addToast={addToast}
                handleExportProfilesExcel={handleExportProfilesExcel}
                handleImportProfilesExcel={handleImportProfilesExcel}
                profileFileInputRef={profileFileInputRef}
                salaryScales={salaryScales}
              />
            )}

            {/* TAB: ATTENDANCE */}
            {/* [1] CHAM CONG - AttendanceTab (props: employees, attendanceFiltered, refs, handlers sua/xoa/xuat-nhap Excel) */}
            {activeSubTab === 'attendance' && (
              <AttendanceTab
                employees={employees}
                attendanceFiltered={attendanceFiltered}
                attendanceSearchEmpId={attendanceSearchEmpId}
                setAttendanceSearchEmpId={setAttendanceSearchEmpId}
                attendanceFilterMonth={attendanceFilterMonth}
                setAttendanceFilterMonth={setAttendanceFilterMonth}
                attendanceFilterYear={attendanceFilterYear}
                setAttendanceFilterYear={setAttendanceFilterYear}
                attendancePage={attendancePage}
                setAttendancePage={setAttendancePage}
                globalPageSize={globalPageSize}
                setGlobalPageSize={setGlobalPageSize}
                leaveCoefficients={leaveCoefficients}
                holidays={holidays}
                weekendDays={weekendDays}
                leaves={leaves}
                canManageLockedAttendance={canManageLockedAttendance}
                setShowBulkLockModal={setShowBulkLockModal}
                handleExportAttendanceExcel={handleExportAttendanceExcel}
                handleImportAttendanceExcel={handleImportAttendanceExcel}
                attendanceFileInputRef={attendanceFileInputRef}
                setZoomedImage={setZoomedImage}
                setEditingAttendance={setEditingAttendance}
                handleDeleteAttendance={handleDeleteAttendance}
                addToast={addToast}
                WorkdayCell={WorkdayCell}
              />
            )}

            {/* TAB: LEAVES */}
            {/* [2] NGHI PHEP - LeavesTab (props: employees, holidays, leaveCoefficients, leaves, handlers duyet/tu choi) */}
            {activeSubTab === 'leaves' && (
              <LeavesTab
                leaves={leaves}
                selectedLeaveId={selectedLeaveId}
                setSelectedLeaveId={setSelectedLeaveId}
                handleApproveLeave={handleApproveLeave}
                globalPageSize={globalPageSize}
                setGlobalPageSize={setGlobalPageSize}
                leavePage={leavePage}
                setLeavePage={setLeavePage}
              />
            )}


            {/* TAB: PAYROLL */}
            {/* [3] TINH LUONG - PayrollTab (props: payroll[], payrollMonth/Year, standardWorkDays, handlers tinh/xuat/sua/triggerDownloadPayslip) */}
            {activeSubTab === 'payroll' && (
              <PayrollTab
                payroll={payroll}
                payrollMonth={payrollMonth}
                setPayrollMonth={setPayrollMonth}
                payrollYear={payrollYear}
                setPayrollYear={setPayrollYear}
                standardWorkDays={standardWorkDays}
                setStandardWorkDays={setStandardWorkDays}
                payrollViewMode={payrollViewMode}
                setPayrollViewMode={setPayrollViewMode}
                globalPageSize={globalPageSize}
                setGlobalPageSize={setGlobalPageSize}
                payrollPage={payrollPage}
                setPayrollPage={setPayrollPage}
                handleCalculatePayroll={handleCalculatePayroll}
                handleExportPayrollExcel={handleExportPayrollExcel}
                handleOpenEditPayroll={handleOpenEditPayroll}
                triggerDownloadPayslip={triggerDownloadPayslip}
                addToast={addToast}
              />
            )}

            {/* TAB: JOB PERFORMANCE MONITORING */}
            {/* [4] HIEU SUAT & KY LUAT - PerformanceTab (props: employees, employeeErrors, performanceCriteria, handlers CRUD loi + tieu chi) */}
            {activeSubTab === 'performance' && (
              <PerformanceTab
                employees={employees}
                employeeErrors={employeeErrors}
                errorSearchEmpId={errorSearchEmpId}
                setErrorSearchEmpId={setErrorSearchEmpId}
                errorFilterMonth={errorFilterMonth}
                setErrorFilterMonth={setErrorFilterMonth}
                errorFilterYear={errorFilterYear}
                setErrorFilterYear={setErrorFilterYear}
                deletingErrorId={deletingErrorId}
                setDeletingErrorId={setDeletingErrorId}
                setEditingErrorId={setEditingErrorId}
                setErrFormEmpId={setErrFormEmpId}
                setErrFormDate={setErrFormDate}
                setErrFormNotes={setErrFormNotes}
                setErrorFormCritSearch={setErrorFormCritSearch}
                setShowErrorModal={setShowErrorModal}
                handleFormEmployeeChange={handleFormEmployeeChange}
                handleEditErrorTrigger={handleEditErrorTrigger}
                handleDeleteError={handleDeleteError}
              />
            )}

            {/* TAB: TRIP SPENDING & SCHEDULES */}
            {/* [5] CONG TAC PHI - TripsTab (props: employees, travelExpensesSummary, projects, handlers tao/duyet/quyet toan) */}
            {activeSubTab === 'trips' && (
              <TripsTab
                travelExpensesSummary={travelExpensesSummary}
                selectedEmpFilter={selectedEmpFilter}
                setSelectedEmpFilter={setSelectedEmpFilter}
                selectedMonthFilter={selectedMonthFilter}
                setSelectedMonthFilter={setSelectedMonthFilter}
                selectedYearFilter={selectedYearFilter}
                setSelectedYearFilter={setSelectedYearFilter}
                handleExportExcel={handleExportExcel}
                setClearingState={setClearingState}
              />
            )}


            {/* TAB: HR DATA / CONFIGURATION - National Holidays & Attendance Coefficients */}
            {/* [6] DU LIEU KE TOAN - HrDataTab (props: holidays, salaryScales, leaveCoefficients, travelNorms, config BHXH, click-outside filters) */}
            {activeSubTab === 'hr_data' && (
              <HrDataTab
                activeHrDataSubTab={activeHrDataSubTab}
                setActiveHrDataSubTab={setActiveHrDataSubTab}
                holidays={holidays}
                setHolidays={setHolidays}
                holidaySearchQuery={holidaySearchQuery}
                setHolidaySearchQuery={setHolidaySearchQuery}
                setShowHolidayModal={setShowHolidayModal}
                handleDeleteHoliday={handleDeleteHoliday}
                leaveCoefficients={leaveCoefficients}
                setLeaveCoefficients={setLeaveCoefficients}
                coefSearchQuery={coefSearchQuery}
                setCoefSearchQuery={setCoefSearchQuery}
                setShowCoefModal={setShowCoefModal}
                handleToggleCoefficientAuto={handleToggleCoefficientAuto}
                handleDeleteCoefficient={handleDeleteCoefficient}
                departmentCriteria={departmentCriteria}
                setDepartmentCriteria={setDepartmentCriteria}
                criteriaSearchQuery={criteriaSearchQuery}
                setCriteriaSearchQuery={setCriteriaSearchQuery}
                setEditingCritId={setEditingCritId}
                setEditingCritDeptId={setEditingCritDeptId}
                setNewCritContent={setNewCritContent}
                setNewCritCategory={setNewCritCategory}
                setShowCriteriaModal={setShowCriteriaModal}
                handleEditCriteriaTrigger={handleEditCriteriaTrigger}
                handleDeleteCriteria={handleDeleteCriteria}
                removeVietnameseTones={removeVietnameseTones}
                salaryScales={salaryScales}
                setSalaryScales={setSalaryScales}
                salaryScalesSearch={salaryScalesSearch}
                setSalaryScalesSearch={setSalaryScalesSearch}
                selectedGroupFilter={selectedGroupFilter}
                setSelectedGroupFilter={setSelectedGroupFilter}
                handleResetSalaryScales={handleResetSalaryScales}
                handleAddNewSalaryScaleClick={handleAddNewSalaryScaleClick}
                handleEditSalaryScaleClick={handleEditSalaryScaleClick}
                handleDeleteSalaryScale={handleDeleteSalaryScale}
                employees={employees}
                setEmployees={setEmployees}
                addToast={addToast}
                insSearchText={insSearchText}
                setInsSearchText={setInsSearchText}
                insDeptFilter={insDeptFilter}
                setInsDeptFilter={setInsDeptFilter}
                insBookFilter={insBookFilter}
                setInsBookFilter={setInsBookFilter}
                setEditingInsEmpId={setEditingInsEmpId}
                setInsBookNo={setInsBookNo}
                setInsSalary={setInsSalary}
                setInsRate={setInsRate}
                setInsPersonalRelief={setInsPersonalRelief}
                setInsDependentCount={setInsDependentCount}
                setInsDate={setInsDate}
                setShowInsModal={setShowInsModal}
                travelNorms={travelNorms}
                setTravelNorms={setTravelNorms}
                travelNormSearch={travelNormSearch}
                setTravelNormSearch={setTravelNormSearch}
                handleAddTravelNormClick={handleAddTravelNormClick}
                handleEditTravelNormClick={handleEditTravelNormClick}
                handleDeleteTravelNorm={handleDeleteTravelNorm}
              />
            )}

            {/* TAB: ROLES & PERMISSIONS */}
            {/* [7] PHAN QUYEN - RolesTab (props: roles, setRoles, selectedRoleId, members/temp-emp, handlers syncHrmPermissionsToApp) */}
            {activeSubTab === 'roles' && (
              <RolesTab
                roles={roles}
                setRoles={setRoles}
                selectedRoleId={selectedRoleId}
                setSelectedRoleId={setSelectedRoleId}
                showAddRoleModal={showAddRoleModal}
                setShowAddRoleModal={setShowAddRoleModal}
                newRoleName={newRoleName}
                setNewRoleName={setNewRoleName}
                newRoleDesc={newRoleDesc}
                setNewRoleDesc={setNewRoleDesc}
                roleSearchQuery={roleSearchQuery}
                setRoleSearchQuery={setRoleSearchQuery}
                selectedTempEmpIds={selectedTempEmpIds}
                setSelectedTempEmpIds={setSelectedTempEmpIds}
                isRoleDropdownOpen={isRoleDropdownOpen}
                setIsRoleDropdownOpen={setIsRoleDropdownOpen}
                confirmRemoveMember={confirmRemoveMember}
                setConfirmRemoveMember={setConfirmRemoveMember}
                employees={employees}
                syncHrmPermissionsToApp={syncHrmPermissionsToApp}
                onSaveProjectPermissions={saveProjectPermissions}
                currentUser={currentUser}
                allEmployees={employees}
              />
            )}
          </div>



        </div>

      </div>

      {/* MODAL: UPDATE SOCIAL INSURANCE DETAILS */}
      {showInsModal && (() => {
        const targetEmp = employees.find((e: any) => e.id === editingInsEmpId);
        return (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-xs font-sans">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full text-left space-y-4 shadow-2xl">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                  <span>Cấu hình BHXH & Thuế TNCN</span>
                </h4>
                <button
                  type="button"
                  onClick={() => { setShowInsModal(false); setEditingInsEmpId(null); }}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {targetEmp && (
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-orange-555/10 border border-orange-500/20 flex items-center justify-center font-black text-orange-400 text-xs font-mono">
                    {targetEmp.id}
                  </div>
                  <div className="text-xs font-sans">
                    <h5 className="font-black text-white">{targetEmp.name} (Chức vụ: {targetEmp.position})</h5>
                    <p className="text-[10px] text-slate-500 font-bold">Lương cơ bản gốc: {(salaryScales.find(s => s.id === targetEmp.salaryCode)?.baseSalary || 5200000).toLocaleString('vi-VN')}đ • Thuộc {targetEmp.department}</p>
                  </div>
                </div>
              )}

              <div className="space-y-3.5 text-xs font-sans">
                
                {/* Book No Input */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-450 font-black uppercase">Mã số sổ BHXH:</label>
                  <input
                    type="text"
                    value={insBookNo}
                    onChange={(e) => setInsBookNo(e.target.value)}
                    placeholder="Ví dụ: SHX2600201 hoặc để trống nếu chưa có"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-555 focus:outline-none rounded-xl px-3 py-2.5 text-white placeholder-slate-650 font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pb-2 col-span-2 font-sans">
                  {/* Base Salary for Insurance */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-450 font-black uppercase">Mức lương đóng BH:</label>
                    <input
                      type="number"
                      value={insSalary}
                      onChange={(e) => setInsSalary(Number(e.target.value) || 0)}
                      className="w-full bg-slate-955 border border-slate-800 focus:border-amber-555 focus:outline-none rounded-xl px-3 py-2 text-white font-bold font-mono"
                    />
                  </div>

                  {/* Insurance Contribution Rate */}
                  <div className="space-y-1 font-sans">
                    <label className="text-[10px] text-slate-450 font-black uppercase">Tỷ lệ trích nộp (%):</label>
                    <input
                      type="number"
                      step="0.1"
                      value={insRate}
                      onChange={(e) => setInsRate(Number(e.target.value) || 10.5)}
                      className="w-full bg-slate-955 border border-slate-800 focus:border-amber-555 focus:outline-none rounded-xl px-3 py-2 text-white font-bold font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pb-2 col-span-2 font-sans">
                  {/* Personal Relief tax discount */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-450 font-black uppercase">Lượng GT Bản thân:</label>
                    <input
                      type="number"
                      value={insPersonalRelief}
                      onChange={(e) => setInsPersonalRelief(Number(e.target.value) || 0)}
                      className="w-full bg-slate-955 border border-slate-800 focus:border-amber-555 focus:outline-none rounded-xl px-3 py-2 text-white font-bold font-mono"
                    />
                    <span className="text-[9px] text-slate-500 block">Mặc định: 15.500.000đ</span>
                  </div>

                  {/* Dependents Count */}
                  <div className="space-y-1 font-sans">
                    <label className="text-[10px] text-slate-450 font-black uppercase">Người phụ thuộc:</label>
                    <input
                      type="number"
                      value={insDependentCount}
                      onChange={(e) => setInsDependentCount(Number(e.target.value) || 0)}
                      className="w-full bg-slate-955 border border-slate-800 focus:border-amber-555 focus:outline-none rounded-xl px-3 py-2 text-white font-bold font-mono"
                    />
                    <span className="text-[9px] text-slate-500 block">4.400.000đ / người / tháng</span>
                  </div>
                </div>

                {/* Insurance Effective Date */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-450 font-black uppercase">Ngày hiệu lực bắt đầu:</label>
                  <input
                    type="date"
                    value={insDate}
                    onChange={(e) => setInsDate(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 focus:border-amber-555 focus:outline-none rounded-xl px-3 py-2.5 text-white font-mono"
                  />
                </div>

              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 border-t border-slate-800 pt-3 text-xs">
                <button
                  type="button"
                  onClick={() => { setShowInsModal(false); setEditingInsEmpId(null); }}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-755 text-slate-300 font-bold rounded-xl transition-all cursor-pointer text-center"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleSaveInsurance}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-555 text-white font-black rounded-xl transition-all shadow-md cursor-pointer text-center"
                >
                  Lưu cấu hình
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {showEditPayrollModal && (() => {
        const targetEmp = employees.find((e: any) => e.id === editingPayrollItem?.empId);
        return (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-xs font-sans">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-2xl w-full text-left space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-orange-400" />
                  <span>Điều chỉnh mộc bảng lương: {editingPayrollItem?.empName}</span>
                </h4>
                <button
                  type="button"
                  onClick={() => { setShowEditPayrollModal(false); setEditingPayrollItem(null); }}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {targetEmp && (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-orange-550/10 border border-orange-500/20 flex items-center justify-center font-black text-orange-400 text-xs font-mono">
                      {targetEmp.id}
                    </div>
                    <div className="text-xs">
                      <h5 className="font-black text-white">{targetEmp.name} (Chức vụ: {targetEmp.position})</h5>
                      <p className="text-[10px] text-slate-500 font-bold">Lương cơ bản gốc: {(salaryScales.find(s => s.id === targetEmp.salaryCode)?.baseSalary || 5200000).toLocaleString('vi-VN')}đ • Thuộc {targetEmp.department}</p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-850/60 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-400 font-mono">
                    <span>🔑 Mã BLU: <strong className="text-amber-450">{editingPayrollItem?.bluCode}</strong></span>
                    <span> Kỳ lương: <strong>{editingPayrollItem?.month}</strong></span>
                  </div>
                </div>
              )}

              {/* READ-ONLY AUTOMATIC SECTION */}
              <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 space-y-3">
                <h6 className="font-extrabold text-slate-400 text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  THÔNG TIN TỔNG HỢP TỰ ĐỘNG (ĐỌC - CHỈ)
                </h6>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-sans">
                  <div className="p-2 bg-slate-900/60 border border-slate-850 rounded-lg">
                    <p className="text-[10px] text-slate-500 font-bold">Công nhật:</p>
                    <p className="font-mono text-slate-300 font-semibold">{editingPayrollItem?.workedDays || 0} ngày</p>
                  </div>
                  <div className="p-2 bg-slate-900/60 border border-slate-850 rounded-lg">
                    <p className="text-[10px] text-slate-500 font-bold">Điểm hiệu suất:</p>
                    <p className="font-mono text-slate-300 font-semibold">{editingPayrollItem?.kpiScore || 100}%</p>
                  </div>
                  <div className="p-2 bg-slate-900/60 border border-slate-850 rounded-lg">
                    <p className="text-[10px] text-slate-500 font-bold">TC Chủ Nhật:</p>
                    <p className="font-mono text-slate-300 font-semibold">{editingPayrollItem?.otSunday || 0} ngày</p>
                  </div>
                  <div className="p-2 bg-slate-900/60 border border-slate-850 rounded-lg">
                    <p className="text-[10px] text-slate-500 font-bold">TC Ngày Lễ:</p>
                    <p className="font-mono text-slate-300 font-semibold">{editingPayrollItem?.otHoliday || 0} ngày</p>
                  </div>
                  <div className="p-2 bg-slate-900/60 border border-slate-850 rounded-lg">
                    <p className="text-[10px] text-slate-500 font-bold">Giờ tăng ca:</p>
                    <p className="font-mono text-slate-300 font-semibold">{editingPayrollItem?.otHours || 0} h</p>
                  </div>
                  <div className="p-2 bg-slate-900/60 border border-slate-850 rounded-lg">
                    <p className="text-[10px] text-slate-500 font-bold">Số lần tăng ca:</p>
                    <p className="font-mono text-slate-300 font-semibold">{editingPayrollItem?.otCount || 0} lần</p>
                  </div>
                  <div className="p-2 bg-slate-900/60 border border-slate-850 rounded-lg">
                    <p className="text-[10px] text-slate-500 font-bold">Tạm ứng:</p>
                    <p className="font-mono text-slate-300 font-semibold">{(editingPayrollItem?.advances || 0).toLocaleString('vi-VN')} đ</p>
                  </div>
                  <div className="p-2 bg-slate-900/60 border border-slate-850 rounded-lg">
                    <p className="text-[10px] text-slate-500 font-bold">Công tác phí:</p>
                    <p className="font-mono text-slate-300 font-semibold">{(editingPayrollItem?.expenses || 0).toLocaleString('vi-VN')} đ</p>
                  </div>
                </div>
              </div>

              {/* EDITABLE SECTION */}
              <div className="bg-slate-950/40 p-4 rounded-xl border border-amber-500/15 space-y-4">
                <h6 className="font-extrabold text-amber-500 text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                  THÔNG TIN CẬP NHẬT MỘC CHỈ ĐỊNH (NHẬP SỐ)
                </h6>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-sans">
                  <div className="space-y-1.5">
                    <label className="text-[10.5px] text-slate-300 font-bold flex items-center gap-1">
                      Thưởng ngày Lễ tết (VNĐ):
                    </label>
                    <input
                      type="number"
                      step="10000"
                      value={editBonusHoliday}
                      onChange={(e) => setEditBonusHoliday(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full bg-slate-950 border border-slate-800 text-white font-mono font-bold rounded-lg px-2.5 py-2 focus:border-amber-500 focus:outline-none transition-colors"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10.5px] text-slate-300 font-bold flex items-center gap-1">
                      Thưởng sáng kiến (VNĐ):
                    </label>
                    <input
                      type="number"
                      step="10000"
                      value={editBonusCreative}
                      onChange={(e) => setEditBonusCreative(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full bg-slate-950 border border-slate-800 text-white font-mono font-bold rounded-lg px-2.5 py-2 focus:border-amber-500 focus:outline-none transition-colors"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10.5px] text-slate-300 font-bold flex items-center gap-1">
                      Khoản giảm trừ khác (VNĐ):
                    </label>
                    <input
                      type="number"
                      step="10000"
                      value={editOtherDeductions}
                      onChange={(e) => setEditOtherDeductions(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full bg-slate-950 border border-slate-800 text-white font-mono font-bold rounded-lg px-2.5 py-2 focus:border-amber-500 focus:outline-none transition-colors"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 border-t border-slate-800 pt-3 text-xs">
                <button
                  type="button"
                  onClick={() => { setShowEditPayrollModal(false); setEditingPayrollItem(null); }}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-xl transition-all cursor-pointer text-center"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditPayroll}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-550 text-white font-black rounded-xl transition-all shadow-md cursor-pointer text-center"
                >
                  Ghi đè & Tái tính toán lương
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {showPrintPayslipModal && printingPayrollItem && (() => {
        const pay = printingPayrollItem;
        const targetEmp = employees.find((e: any) => e.id === pay.empId);
        const position = targetEmp?.position || 'Phụ Trách Nhiệm Vụ';
        
        const dayAndPerformanceSalary = pay.daySalary || 0;
        const otWeekendAndHoliday = (pay.otSundaySalary || 0) + (pay.otHolidaySalary || 0);
        const perfSalary = pay.performanceSalary || 0;
        const kpiBonus = pay.kpiBonus || 0;
        const docTien = docSoTiengViet(pay.netSalary);

        return (
          <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 backdrop-blur-xs font-sans overflow-y-auto" id="payslip_print_modal">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-5xl w-full text-left space-y-5 shadow-2xl my-8">
              
              {/* Header */}
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-orange-400" />
                  <span>Xử Lý In Phiếu Lương Nhanh Nhân Viên: <strong className="text-orange-400 font-mono">{pay.empId}</strong></span>
                </h4>
                <button
                  type="button"
                  onClick={() => { setShowPrintPayslipModal(false); setPrintingPayrollItem(null); }}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Grid content */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Configuration Sidebar */}
                <div className="lg:col-span-4 bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-4 h-fit">
                  <div className="border-b border-slate-850 pb-2">
                    <h5 className="font-black text-xs text-amber-500 uppercase tracking-widest">📝 Tùy Biến Thông Tin In</h5>
                    <p className="text-[10px] text-slate-500 mt-1">Các thông tin dưới đây sẽ hiển thị trực tiếp trên phôi in phiếu lương.</p>
                  </div>
                  
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">✍️ Ghi chú của phiếu (Bên phải)</label>
                      <textarea
                        value={printNotes}
                        onChange={(e) => setPrintNotes(e.target.value)}
                        placeholder="Có thể thêm ghi chú phụ cấp, giải thích tăng ca..."
                        rows={3}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">👤 Người phát lương</label>
                      <input
                        type="text"
                        value={printNguoiPhat}
                        onChange={(e) => setPrintNguoiPhat(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-amber-500 focus:outline-none font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">💼 Kế Toán</label>
                      <input
                        type="text"
                        value={printKeToanTruong}
                        onChange={(e) => setPrintKeToanTruong(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-amber-500 focus:outline-none font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">📍 Địa điểm & Ngày lập</label>
                      <input
                        type="text"
                        value={printDatePlace}
                        onChange={(e) => setPrintDatePlace(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-amber-500 focus:outline-none font-medium text-amber-400"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handlePrintPayslip(pay, printNotes, printNguoiPhat, printKeToanTruong)}
                      className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                    >
                      🖨️ In Phiếu Lương Nhanh
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => downloadPDFPayslip(pay)}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-550 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                    >
                      📥 Tải Phiếu Lương (PDF)
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => { setShowPrintPayslipModal(false); setPrintingPayrollItem(null); }}
                      className="w-full py-2 text-slate-450 hover:text-white text-xs font-bold transition-all text-center cursor-pointer"
                    >
                      Hủy & Đóng lại
                    </button>
                  </div>
                </div>

                {/* Printable Excel View Frame */}
                <div className="lg:col-span-8 bg-slate-950 p-3 rounded-xl border border-slate-850 overflow-x-auto">
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest font-black text-center py-1 mb-2 border-b border-slate-900">
                    🖼️ Giao Diện Bản In Thực Tế (Bám Sát Mẫu Ảnh)
                  </div>

                  <div id="printable-payslip-canvas-content" className="bg-white text-black p-5 rounded-lg shadow-2xl mx-auto min-w-[500px] max-w-[580px] border border-slate-300 pointer-events-none select-none">
                    
                    {/* Header */}
                    <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-3">
                      <div className="text-lg font-black tracking-tight text-slate-900 font-serif">PHIẾU LƯƠNG</div>
                      <div className="text-sm font-black text-slate-800 font-serif">THÁNG {pay.month}</div>
                    </div>

                    {/* Table block */}
                    <table className="w-full border-collapse border border-slate-400 text-[10.5px] text-left mb-3 font-serif">
                      <tbody>
                        <tr>
                          <td className="border border-slate-400 bg-slate-100 p-1.5 font-bold w-[38%]">Họ và tên</td>
                          <td className="border border-slate-400 p-1.5 font-bold bg-[#FAD7A0] text-slate-950 text-left w-[32%] text-[11.5px] uppercase">{pay.empName}</td>
                          <td className="border border-slate-400 p-1.5 font-extrabold bg-slate-100 text-slate-900 text-center w-[30%]" rowSpan={2}>
                            Ghi chú
                            <div className="font-normal text-[9.5px] text-left pt-1.5 text-slate-700 italic block leading-snug whitespace-pre-wrap font-sans max-h-[42px] overflow-hidden">
                              {printNotes || ''}
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-slate-400 bg-slate-100 p-1.5 font-bold">Chức vụ</td>
                          <td className="border border-slate-400 p-1.5 text-left text-slate-800">{position}</td>
                        </tr>
                        <tr>
                          <td className="border border-slate-400 bg-slate-100 p-1.5 font-bold">Lương cơ bản</td>
                          <td className="border border-slate-400 p-1.5 text-right font-mono text-slate-800 font-bold">{(pay.baseSalary || 0).toLocaleString('vi-VN')}</td>
                          <td className="border border-slate-400 p-1.5 text-center bg-slate-50/40" rowSpan={17}></td>
                        </tr>
                        <tr>
                          <td className="border border-slate-400 bg-slate-100 p-1.5 font-bold">Ngày công đi làm</td>
                          <td className="border border-slate-400 p-1.5 text-right font-mono text-slate-805 font-bold">{pay.workedDays || 0}</td>
                        </tr>
                        <tr>
                          <td className="border border-slate-400 bg-slate-100 p-1.5 font-bold">Thưởng hiệu suất 100 %</td>
                          <td className="border border-slate-400 p-1.5 text-right font-mono text-slate-800">{(perfSalary || 0).toLocaleString('vi-VN')}</td>
                        </tr>
                        <tr>
                          <td className="border border-slate-400 bg-slate-100 p-1.5 font-bold">Điểm KPI</td>
                          <td className="border border-slate-400 p-1.5 text-right font-mono text-slate-800">{pay.kpiScore || 100}</td>
                        </tr>
                        <tr>
                          <td className="border border-slate-400 bg-slate-100 p-1.5 font-bold">Mức hưởng KPI</td>
                          <td className="border border-slate-400 p-1.5 text-right font-mono text-slate-800">{(kpiBonus || 0).toLocaleString('vi-VN')}</td>
                        </tr>
                        <tr className="font-extrabold text-slate-950">
                          <td className="border border-slate-400 bg-slate-100 p-1.5">Lương ngày công + Hiệu suất</td>
                          <td className="border border-slate-400 p-1.5 text-right font-mono text-slate-900 bg-slate-50">{(dayAndPerformanceSalary || 0).toLocaleString('vi-VN')}</td>
                        </tr>
                        <tr>
                          <td className="border border-slate-400 bg-slate-100 p-1.5 font-bold">Lương tăng ca lễ, CN</td>
                          <td className="border border-slate-400 p-1.5 text-right font-mono text-slate-800">{(otWeekendAndHoliday || 0).toLocaleString('vi-VN')}</td>
                        </tr>
                        <tr>
                          <td className="border border-slate-400 bg-slate-100 p-1.5 font-bold">Lương tăng ca ngoài giờ</td>
                          <td className="border border-slate-400 p-1.5 text-right font-mono text-slate-800">{(pay.otHoursSalary || 0).toLocaleString('vi-VN')}</td>
                        </tr>
                        <tr>
                          <td className="border border-slate-400 bg-slate-100 p-1.5 font-bold">Thưởng lễ</td>
                          <td className="border border-slate-400 p-1.5 text-right font-mono text-slate-800">{(pay.bonusHoliday || 0).toLocaleString('vi-VN')}</td>
                        </tr>
                        <tr>
                          <td className="border border-slate-400 bg-slate-100 p-1.5 font-bold">Thưởng sáng kiến</td>
                          <td className="border border-slate-400 p-1.5 text-right font-mono text-slate-800 font-medium">{(pay.bonusCreative || 0).toLocaleString('vi-VN')}</td>
                        </tr>
                        <tr>
                          <td className="border border-slate-400 bg-slate-100 p-1.5 font-bold">Công tác phí</td>
                          <td className="border border-slate-400 p-1.5 text-right font-mono text-slate-800">{(pay.expenses || 0).toLocaleString('vi-VN')}</td>
                        </tr>
                        <tr className="font-bold text-slate-950">
                          <td className="border border-slate-400 bg-slate-100 p-1.5">Tổng thu nhập & công tác phí</td>
                          <td className="border border-slate-400 p-1.5 text-right font-mono">{(pay.totalIncome || 0).toLocaleString('vi-VN')}</td>
                        </tr>
                        <tr>
                          <td className="border border-slate-400 bg-slate-100 p-1.5 font-bold">Khoản giảm trừ khác</td>
                          <td className="border border-slate-400 p-1.5 text-right font-mono text-slate-800">{(pay.otherDeductions || 0).toLocaleString('vi-VN')}</td>
                        </tr>
                        <tr>
                          <td className="border border-slate-400 bg-slate-100 p-1.5 font-bold">Thuế TNCN</td>
                          <td className="border border-slate-400 p-1.5 text-right font-mono text-slate-800">{(pay.tax || 0).toLocaleString('vi-VN')}</td>
                        </tr>
                        <tr>
                          <td className="border border-slate-400 bg-slate-100 p-1.5 font-bold">Khấu trừ BHXH 10,5%</td>
                          <td className="border border-slate-400 p-1.5 text-right font-mono text-slate-800">{(pay.insurance || 0).toLocaleString('vi-VN')}</td>
                        </tr>
                        <tr>
                          <td className="border border-slate-400 bg-slate-100 p-1.5 font-bold">Tạm ứng hoặc lĩnh trước</td>
                          <td className="border border-slate-400 p-1.5 text-right font-mono text-slate-850">{(pay.advances || 0).toLocaleString('vi-VN')}</td>
                        </tr>
                        <tr className="bg-[#FAD7A0] font-bold text-amber-950">
                          <td className="border border-slate-400 p-1.5 text-[11.5px]">Thực lĩnh tháng này</td>
                          <td className="border border-slate-400 p-1.5 text-center text-[12.5px] bg-[#FAD7A0]">{(pay.netSalary || 0).toLocaleString('vi-VN')}</td>
                        </tr>
                        <tr>
                          <td className="border border-slate-400 bg-slate-100 p-1.5 font-bold italic text-slate-800">Số tiền bằng chữ</td>
                          <td className="border border-slate-400 p-1.5 text-slate-800 italic text-[10.5px] text-left leading-normal" colSpan={2}>
                            {docTien}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Footer sign */}
                    <div className="text-right text-[10.5px] text-slate-800 italic font-serif mb-2">
                      {printDatePlace}
                    </div>

                    <div className="grid grid-cols-3 text-center text-[10px] text-slate-900 font-serif gap-2">
                      <div>
                        <div className="font-extrabold text-slate-900">Người nhận</div>
                        <div className="text-[8.5px] text-slate-400 italic mb-10">(Ký ghi rõ họ tên)</div>
                        <div className="font-bold text-slate-950 text-[10.5px]">{pay.empName}</div>
                      </div>
                      <div>
                        <div className="font-extrabold text-slate-900">Người phát</div>
                        <div className="text-[8.5px] text-slate-400 italic mb-10">(Ký ghi rõ họ tên)</div>
                        <div className="font-bold text-slate-950 text-[10.5px]">{printNguoiPhat}</div>
                      </div>
                      <div>
                        <div className="font-extrabold text-slate-900">Kế Toán</div>
                        <div className="text-[8.5px] text-slate-400 italic mb-10">(Ký ghi rõ họ tên)</div>
                        <div className="font-bold text-slate-950 text-[10.5px]">{printKeToanTruong}</div>
                      </div>
                    </div>

                  </div>
                </div>

              </div>

            </div>
          </div>
        );
      })()}

      {/* CLEAR DATA TAB CONFIRMATION MODAL */}
      {clearingState.isOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fadeIn" id="clear_data_confirm_modal">
          <div className="bg-slate-900 border border-rose-500/30 p-6 rounded-2xl max-w-sm w-full text-center space-y-4 shadow-2xl relative">
            <div className="absolute top-3 right-3">
              <button
                type="button"
                onClick={() => setClearingState({ isOpen: false, tableName: '', targetTab: '' })}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                id="close_clear_modal_btn"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/30 rounded-full flex items-center justify-center mx-auto mb-2 text-rose-500 animate-bounce">
              <Trash2 className="w-6 h-6" />
            </div>
            <h4 className="font-extrabold text-white text-base">
              ⚠️ Cảnh Báo Xóa Dữ Liệu!
            </h4>
            <p className="text-[12px] text-slate-300 leading-relaxed">
              Bạn có chắc chắn muốn <span className="text-rose-400 font-extrabold">XÓA SẠCH HOÀN TOÀN</span> dữ liệu cũ trong bảng: <br />
              <strong className="text-white text-sm bg-slate-950 px-2 py-1 rounded block mt-2 border border-slate-800 font-mono">
                {clearingState.tableName}
              </strong>
            </p>
            <p className="text-[10px] text-slate-400 italic">
              * Hành động này sẽ dọn dẹp toàn bộ bản ghi hiện có và không thể hoàn tác. Các cài đặt mặc định có thể được áp dụng lại sau đó.
            </p>
            <div className="flex gap-3 pt-2 text-xs">
              <button
                type="button"
                onClick={() => setClearingState({ isOpen: false, tableName: '', targetTab: '' })}
                className="flex-1 py-2 font-bold rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 transition-colors cursor-pointer"
                id="cancel_clear_btn"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={executeClearData}
                className="flex-1 py-2 font-extrabold rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-lg active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                id="confirm_clear_btn"
              >
                <Trash2 className="w-3.5 h-3.5" /> Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RENDER MODAL FOR ADDING USER ROLE GROUP */}
      {showAddRoleModal && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 animate-fadeIn font-sans" id="add_role_modal_popup">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full text-left space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="font-extrabold text-white text-base flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-500" />
                <span>Thêm Nhóm Vai Trò Mới</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowAddRoleModal(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newRoleName.trim()) {
                  addToast({ title: '⚠️ Thiếu thông tin', message: 'vui lòng nhập tên nhóm vai trò.', type: 'warning' });
                  return;
                }

                const newId = 'role_custom_' + Date.now();
                const defaultPerms: any = {};
                const modules = [
                  'projects_construction',
                  'projects_furniture',
                  'projects_mechanical',
                  'tasks',
                  'finance',
                  'employees',
                  'reports',
                  'settings'
                ];
                modules.forEach(m => {
                  defaultPerms[m] = { view: true, create: false, edit: false, delete: false };
                });

                const createdRole: Role = {
                  id: newId,
                  name: newRoleName.trim(),
                  description: newRoleDesc.trim(),
                  permissions: defaultPerms,
                  memberIds: []
                };

                const nextRoles = [...roles, createdRole];
                setRoles(nextRoles);
                dbService.hrmRoleGroups.save({ id: createdRole.id, name: createdRole.name, description: createdRole.description || '', permissions: createdRole.permissions || {}, memberIds: createdRole.memberIds || [] }).catch(() => {});
                setSelectedRoleId(newId);
                setShowAddRoleModal(false);
              }}
              className="space-y-4 text-xs text-slate-300"
            >
              <div className="space-y-1">
                <label className="block text-slate-400 font-bold uppercase text-[9.5px]">Tên nhóm vai trò / Phòng ban:</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Giám sát công trình, Tổ trưởng tổ mộc..."
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400 font-bold uppercase text-[9.5px]">Mô tả nhiệm vụ phân quyền:</label>
                <textarea
                  placeholder="Mô tả tóm tắt trách nhiệm, phạm vi phân quyền cho nhóm người dùng này..."
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white outline-none focus:border-amber-500/50 resize-none"
                />
              </div>

              <p className="text-[10px] text-slate-450 italic leading-relaxed">
                * Sau khi khởi tạo thành công, nhóm sẽ mặc định có quyền "XEM" ở tất cả phân hệ. Bạn có thể thay đổi chi tiết quyền thao tác ngay trên bảng phân quyền tác nghiệp.
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddRoleModal(false)}
                  className="flex-1 py-2 font-bold rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 font-extrabold rounded-xl bg-amber-600 hover:bg-amber-550 text-slate-950 transition-all cursor-pointer text-center"
                >
                  Tạo vai trò
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENDER DYNAMIC POPUP MODAL FOR ADDING EMPLOYEE PROFILE */}
      {showEmpModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-lg w-full text-left space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <h4 className="font-extrabold text-white text-base border-b border-slate-800 pb-2 flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-500" /> Đăng ký Hồ Sơ Nhân Sự Mới (Xây dựng, mộc, xưởng)
            </h4>
            
            <form onSubmit={handleCreateEmployee} className="grid grid-cols-2 gap-3 text-[11px] text-slate-300">
              <div className="col-span-2">
                <label className="block text-slate-400 font-bold mb-1">Họ và Tên:</label>
                <input
                  type="text"
                  required
                  value={newEmp.name}
                  onChange={(e) => setNewEmp({ ...newEmp, name: e.target.value })}
                  placeholder="Lê Hoàng Sơn"
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Giới tính:</label>
                <select
                  value={newEmp.gender}
                  onChange={(e) => setNewEmp({ ...newEmp, gender: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white outline-none"
                >
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Ngày sinh:</label>
                <input
                  type="date"
                  value={newEmp.dob}
                  onChange={(e) => setNewEmp({ ...newEmp, dob: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">CCCD / CMND:</label>
                <input
                  type="text"
                  required
                  value={newEmp.cccd}
                  onChange={(e) => setNewEmp({ ...newEmp, cccd: e.target.value })}
                  placeholder="068095111222"
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Ngày cấp CCCD:</label>
                <input
                  type="text"
                  value={newEmp.cccdIssuedDate || ''}
                  onChange={(e) => setNewEmp({ ...newEmp, cccdIssuedDate: e.target.value })}
                  placeholder="04/11/2022"
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Nơi cấp CCCD:</label>
                <input
                  type="text"
                  value={newEmp.cccdIssuedPlace || ''}
                  onChange={(e) => setNewEmp({ ...newEmp, cccdIssuedPlace: e.target.value })}
                  placeholder="CS QLHC về TTXH"
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Số điện thoại:</label>
                <input
                  type="text"
                  required
                  value={newEmp.phone}
                  onChange={(e) => setNewEmp({ ...newEmp, phone: e.target.value })}
                  placeholder="0911223344"
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-slate-400 font-bold mb-1">Email liên hệ:</label>
                <input
                  type="email"
                  value={newEmp.email}
                  onChange={(e) => setNewEmp({ ...newEmp, email: e.target.value })}
                  placeholder="son.le@hoanglonggup.vn (không bắt buộc)"
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Phòng ban:</label>
                <select
                  value={newEmp.department}
                  onChange={(e) => setNewEmp({ ...newEmp, department: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white outline-none"
                >
                  <option value="Phòng Dự Án">Phòng Dự Án</option>
                  <option value="Phòng Nhân Sự">Phòng Nhân Sự</option>
                  <option value="Phòng Kế Toán">Phòng Kế Toán</option>
                  <option value="Kho">Kho</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Chức vụ cụ thể:</label>
                <input
                  type="text"
                  value={newEmp.position}
                  onChange={(e) => setNewEmp({ ...newEmp, position: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Ngạch lương:</label>
                <select
                  value={(() => {
                    const found = salaryScales.find(s => newEmp.salaryCode && s.id === `${s.groupCode}${newEmp.salaryCode.replace(s.groupCode, '')}` || s.id === newEmp.salaryCode);
                    return found ? found.groupCode : '';
                  })()}
                  onChange={(e) => {
                    const groupCode = e.target.value;
                    const firstLevel = salaryScales.find(s => s.groupCode === groupCode);
                    setNewEmp({ ...newEmp, salaryCode: firstLevel ? `${groupCode}${firstLevel.level}` : '' });
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white outline-none"
                >
                  <option value="">-- Chọn ngạch lương --</option>
                  {Array.from(new Map(salaryScales.map(s => [s.groupCode, s])).values()).map(s => (
                    <option key={s.groupCode} value={s.groupCode}>{s.groupName} ({s.groupCode})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Bậc lương:</label>
                <select
                  value={(() => {
                    const found = salaryScales.find(s => s.id === newEmp.salaryCode);
                    return found ? found.level : '';
                  })()}
                  onChange={(e) => {
                    const level = e.target.value;
                    const groupCode = (() => {
                      const found = salaryScales.find(s => s.id === newEmp.salaryCode);
                      return found ? found.groupCode : '';
                    })();
                    if (groupCode) {
                      setNewEmp({ ...newEmp, salaryCode: `${groupCode}${level}` });
                    }
                  }}
                  disabled={!newEmp.salaryCode}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white outline-none disabled:opacity-50"
                >
                  <option value="">-- Chọn bậc --</option>
                  {(() => {
                    const groupCode = salaryScales.find(s => s.id === newEmp.salaryCode)?.groupCode || '';
                    const levels = salaryScales.filter(s => s.groupCode === groupCode);
                    return levels.map(s => (
                      <option key={s.id} value={s.level}>{s.levelName} ({s.level})</option>
                    ));
                  })()}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Mã ngạch (tự động):</label>
                <input
                  type="text"
                  value={newEmp.salaryCode || ''}
                  readOnly
                  className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-white outline-none font-mono text-amber-400 cursor-not-allowed opacity-60"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Hợp đồng:</label>
                <select
                  value={newEmp.contractType}
                  onChange={(e) => setNewEmp({ ...newEmp, contractType: e.target.value, contractDurationMonths: e.target.value === 'Có thời hạn' ? (newEmp.contractDurationMonths || undefined) : undefined })}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white outline-none"
                >
                  <option value="Không thời hạn">Không thời hạn</option>
                  <option value="Có thời hạn">Có thời hạn</option>
                  <option value="Thử việc 02 tháng">Thử việc 02 tháng</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Thời hạn HĐ (tháng):</label>
                <input
                  type="number"
                  value={newEmp.contractDurationMonths === undefined ? '' : newEmp.contractDurationMonths}
                  onChange={(e) => setNewEmp({ ...newEmp, contractDurationMonths: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder={newEmp.contractType === 'Có thời hạn' ? 'VD: 12, 24, 36...' : 'Chỉ dùng cho HĐ Có thời hạn'}
                  disabled={newEmp.contractType !== 'Có thời hạn'}
                  className={`w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none ${newEmp.contractType !== 'Có thời hạn' ? 'opacity-50 cursor-not-allowed' : ''}`}
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Số lần phép năm được cấp:</label>
                <input
                  type="number"
                  value={newEmp.phepNam !== undefined ? newEmp.phepNam : 12}
                  onChange={(e) => setNewEmp({ ...newEmp, phepNam: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none font-mono text-amber-400"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-slate-400 font-bold mb-1">Địa chỉ thường trú:</label>
                <input
                  type="text"
                  required
                  value={newEmp.address}
                  onChange={(e) => setNewEmp({ ...newEmp, address: e.target.value })}
                  placeholder="Thôn, Xã, Huyện, Tỉnh"
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-slate-400 font-bold mb-1">Địa chỉ tạm trú:</label>
                <input
                  type="text"
                  value={newEmp.currentAddress || ''}
                  onChange={(e) => setNewEmp({ ...newEmp, currentAddress: e.target.value })}
                  placeholder="Để trống nếu giống địa chỉ thường trú"
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Trình độ học vấn:</label>
                <input
                  type="text"
                  value={newEmp.education || ''}
                  onChange={(e) => setNewEmp({ ...newEmp, education: e.target.value })}
                  placeholder="Đại học, Trung cấp, 12/12..."
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-slate-400 font-bold mb-1">Liên hệ khẩn cấp (Người thân):</label>
                <input
                  type="text"
                  value={newEmp.emergencyContact}
                  onChange={(e) => setNewEmp({ ...newEmp, emergencyContact: e.target.value })}
                  placeholder="Họ tên - Quan hệ - SĐT cứu trợ"
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 col-span-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEmpModal(false)}
                  className="bg-slate-800 hover:bg-slate-705 text-white px-3 py-1.5 rounded-lg cursor-pointer"
                >
                  Bỏ qua
                </button>
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-550 text-white font-extrabold px-4 py-1.5 rounded-lg cursor-pointer"
                >
                  Đăng ký Hồ sơ ✅
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENDER LEAVE REQUEST MODAL */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-sm w-full text-left space-y-4 max-h-[85vh] overflow-y-auto pr-2 custom-scrollbar">
            <h4 className="font-extrabold text-white text-sm border-b border-slate-805 pb-1 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-pink-400" /> Nộp Đơn Xin Nghỉ Phép Thợ xây mộc
            </h4>
            <form onSubmit={handleCreateLeaveRequest} className="space-y-3 text-[11px] text-slate-300">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Chọn Nhân viên:</label>
                <select
                  value={newLeave.empId}
                  onChange={(e) => setNewLeave({ ...newLeave, empId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white"
                >
                  {employees.map(ep => (
                    <option key={ep.id} value={ep.id}>{ep.name} ({ep.department})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Loại nghỉ phép:</label>
                <select
                  value={newLeave.type}
                  onChange={(e) => setNewLeave({ ...newLeave, type: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white"
                >
                  {leaveCoefficients.filter(c => !c.isAuto).map(c => (
                    <option key={c.id} value={c.type}>{c.type}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Từ ngày:</label>
                  <input
                    type="date"
                    value={newLeave.fromDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      let updatedToDate = newLeave.toDate;
                      try {
                        const d = new Date(val);
                        if (!isNaN(d.getTime())) {
                          d.setDate(d.getDate() + 1);
                          updatedToDate = getLocalYYYYMMDD(d);
                        }
                      } catch (err) {}
                      setNewLeave({
                        ...newLeave,
                        fromDate: val,
                        toDate: updatedToDate,
                        daysCount: 2
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Đến ngày (Gồm):</label>
                  <input
                    type="date"
                    value={newLeave.toDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      let days = 1;
                      try {
                        const d1 = new Date(newLeave.fromDate);
                        const d2 = new Date(val);
                        if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
                          days = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                          if (days < 1) days = 1;
                        }
                      } catch (err) {}
                      setNewLeave({
                        ...newLeave,
                        toDate: val,
                        daysCount: days
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Số lượng ngày nghỉ:</label>
                <input
                  type="number"
                  value={newLeave.daysCount}
                  onChange={(e) => setNewLeave({ ...newLeave, daysCount: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Người xét duyệt:</label>
                {(() => {
                  const configuredApprover = getConfiguredApprover('leave');
                  if (configuredApprover) {
                    const approverPos = configuredApprover.position ? ` (${configuredApprover.position})` : '';
                    return (
                      <div className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white flex items-center justify-between">
                        <span className="font-bold">{configuredApprover.name}{approverPos}</span>
                        <span className="text-[10px] bg-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded">Đã khóa · Tự động từ Quyền Phê Duyệt</span>
                      </div>
                    );
                  }
                  return (
                    <select
                      value={newLeave.approverName || ''}
                      onChange={(e) => setNewLeave({ ...newLeave, approverName: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white"
                    >
                      {getApproversList().map((ap, idx) => (
                        <option key={idx} value={ap.name}>{ap.name} ({ap.role})</option>
                      ))}
                    </select>
                  );
                })()}
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Lý do trình duyệt:</label>
                <textarea
                  required
                  value={newLeave.reason}
                  onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })}
                  placeholder="Giải trình lý do cụ thể..."
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white h-14"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button type="button" onClick={() => setShowLeaveModal(false)} className="bg-slate-800 px-3 py-1 rounded">Hủy</button>
                <button type="submit" className="bg-amber-600 hover:bg-amber-550 font-bold text-white px-4 py-1 rounded">Gửi đơn phép 🚀</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENDER BUSINESS TRIP MODAL */}
      {showTripModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-sm w-full text-left space-y-4">
            <h4 className="font-extrabold text-white text-sm border-b border-slate-805 pb-1 flex items-center gap-1.5 animate-pulse">
              <MapPin className="w-4 h-4 text-indigo-400" /> Tạo Kế Hoạch Đi Công Tác & Tạm Ứng Phí
            </h4>
            <form onSubmit={handleCreateTrip} className="space-y-3 text-[11px] text-slate-300">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Nhân viên công vụ:</label>
                <input
                  type="text"
                  required
                  value={newTrip.empName}
                  onChange={(e) => setNewTrip({ ...newTrip, empName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Điểm đến (Địa bàn/Showroom):</label>
                <input
                  type="text"
                  required
                  value={newTrip.destination}
                  onChange={(e) => setNewTrip({ ...newTrip, destination: e.target.value })}
                  placeholder="Đà Lạt biệt thự thầu hoặc HCM"
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Mục đích hành trình:</label>
                <textarea
                  required
                  value={newTrip.purpose}
                  onChange={(e) => setNewTrip({ ...newTrip, purpose: e.target.value })}
                  placeholder="Đối chiếu dán mâm ráp vách mộc Acrylic..."
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white h-12"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Bắt đầu:</label>
                  <input
                    type="date"
                    value={newTrip.fromDate}
                    onChange={(e) => setNewTrip({ ...newTrip, fromDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Kết thúc:</label>
                  <input
                    type="date"
                    value={newTrip.toDate}
                    onChange={(e) => setNewTrip({ ...newTrip, toDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Dự kiến chi phí (VND):</label>
                  <input
                    type="number"
                    value={newTrip.estimatedCost}
                    onChange={(e) => setNewTrip({ ...newTrip, estimatedCost: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Tạm ứng trước (VND):</label>
                  <input
                    type="number"
                    value={newTrip.advanceAmount}
                    onChange={(e) => setNewTrip({ ...newTrip, advanceAmount: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button type="button" onClick={() => setShowTripModal(false)} className="bg-slate-800 px-3 py-1 rounded">Huỷ</button>
                <button type="submit" className="bg-amber-600 hover:bg-amber-550 font-bold text-white px-4 py-1 rounded">Trình Giám Đốc 🚀</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENDER HOLIDAY CREATION MODAL */}
      {showHolidayModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-sm w-full text-left space-y-4">
            <h4 className="font-extrabold text-white text-sm border-b border-slate-805 pb-1 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-500" /> Thêm Ngày Nghỉ Lễ Mới
            </h4>
            <form onSubmit={handleAddHoliday} className="space-y-3 text-[11px] text-slate-300">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Tên dịp lễ:</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Tết Dương lịch"
                  value={newHolidayName}
                  onChange={(e) => setNewHolidayName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Phương thức nhập ngày:</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="holidayInputMode"
                      checked={holidayInputMode === 'range'}
                      onChange={() => setHolidayInputMode('range')}
                      className="cursor-pointer"
                    />
                    <span>Theo khoảng ngày</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="holidayInputMode"
                      checked={holidayInputMode === 'single'}
                      onChange={() => setHolidayInputMode('single')}
                      className="cursor-pointer"
                    />
                    <span>Một ngày duy nhất</span>
                  </label>
                </div>
              </div>

              {holidayInputMode === 'single' ? (
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Chọn ngày:</label>
                  <input
                    type="date"
                    required
                    value={holidaySingleDate}
                    onChange={(e) => setHolidaySingleDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Từ ngày:</label>
                    <input
                      type="date"
                      required
                      value={holidayFromDate}
                      onChange={(e) => setHolidayFromDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Đến ngày:</label>
                    <input
                      type="date"
                      required
                      value={holidayToDate}
                      onChange={(e) => setHolidayToDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white"
                    />
                  </div>
                </div>
              )}

              <p className="text-[10px] text-slate-500 italic mt-1 leading-relaxed">
                * Note: Nếu chọn theo khoảng ngày, hệ thống sẽ tự động tách các ngày được nghỉ ra thành các hàng khác nhau trong danh mục đúng như quy định.
              </p>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button type="button" onClick={() => setShowHolidayModal(false)} className="bg-slate-800 px-3 py-1 rounded cursor-pointer">Huỷ</button>
                <button type="submit" className="bg-amber-600 hover:bg-amber-550 font-bold text-white px-4 py-1 rounded cursor-pointer">Thêm mới</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENDER ATTENDANCE COEFFICIENT CREATION MODAL */}
      {showCoefModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-sm w-full text-left space-y-4">
            <h4 className="font-extrabold text-white text-sm border-b border-slate-805 pb-1 flex items-center gap-1.5 font-sans">
              <Percent className="w-4 h-4 text-amber-500" /> Thêm Hệ Số Chấm Công Mới
            </h4>
            <form onSubmit={handleAddCoefficient} className="space-y-3 text-[11px] text-slate-300 font-sans">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Nội Dung Chấm Công (Tên định nghĩa):</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nghỉ không lương có xin phép"
                  value={newCoefType}
                  onChange={(e) => setNewCoefType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1.5">Chấm tự động (kiểu boolean):</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setNewCoefIsAuto(!newCoefIsAuto)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      newCoefIsAuto ? 'bg-emerald-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        newCoefIsAuto ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className={`text-xs font-extrabold px-2 py-0.5 rounded border transition-colors ${
                    newCoefIsAuto 
                      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                      : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                  }`}>
                    {newCoefIsAuto ? 'TRUE' : 'FALSE'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Mã HSCC (Khóa chính):</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: P, KP, PN,..."
                  value={newCoefSymbol}
                  onChange={(e) => setNewCoefSymbol(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Hệ Số:</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={newCoefVal}
                  onChange={(e) => setNewCoefVal(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button type="button" onClick={() => setShowCoefModal(false)} className="bg-slate-800 px-3 py-1 rounded cursor-pointer">Huỷ</button>
                <button type="submit" className="bg-amber-600 hover:bg-amber-550 font-bold text-white px-4 py-1 rounded cursor-pointer">Thêm mới</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENDER CRITERION CREATION/EDIT MODAL */}
      {showCriteriaModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full text-left space-y-4 shadow-2xl">
            <h4 className="font-extrabold text-white text-sm border-b border-slate-805 pb-2 flex items-center gap-1.5 font-sans">
              <Building className="w-4 h-4 text-amber-500" /> 
              {editingCritId ? "Cập Nhật Tiêu Chí Đánh Giá" : "Thêm Tiêu Chí Đánh Giá Mới"}
            </h4>
            <form onSubmit={handleCreateOrUpdateCriteria} className="space-y-4 text-[11px] text-slate-300 font-sans">
              


              {editingCritId && (
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Mã tiêu chí:</label>
                  <input
                    type="text"
                    disabled
                    value={editingCritId}
                    className="w-full bg-slate-950 border border-slate-805 rounded p-1.5 text-slate-500 cursor-not-allowed"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-400 font-bold mb-1">Phân loại tiêu chí:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewCritCategory('readiness')}
                    className={`py-1.5 px-2 rounded font-bold text-center border transition-all cursor-pointer ${
                      newCritCategory === 'readiness' 
                        ? 'bg-purple-950 text-purple-400 border-purple-500' 
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Tác phong
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCritCategory('progress')}
                    className={`py-1.5 px-2 rounded font-bold text-center border transition-all cursor-pointer ${
                      newCritCategory === 'progress' 
                        ? 'bg-sky-950 text-sky-400 border-sky-500' 
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Hiệu suất
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCritCategory('reporting')}
                    className={`py-1.5 px-2 rounded font-bold text-center border transition-all cursor-pointer ${
                      newCritCategory === 'reporting' 
                        ? 'bg-emerald-950 text-emerald-400 border-emerald-500' 
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Báo cáo
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Nội dung tiêu chí:</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Ví dụ: Đi làm đúng giờ, tác phong sạch sẽ đúng chuẩn chỉ bảo hộ lao động..."
                  value={newCritContent}
                  onChange={(e) => setNewCritContent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-850">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowCriteriaModal(false);
                    setNewCritContent('');
                    setEditingCritId(null);
                    setEditingCritDeptId(null);
                  }} 
                  className="bg-slate-800 px-3 py-1 rounded cursor-pointer hover:bg-slate-750"
                >
                  Huỷ
                </button>
                <button 
                  type="submit" 
                  className="bg-amber-600 hover:bg-amber-550 font-bold text-white px-4 py-1 rounded cursor-pointer"
                >
                  {editingCritId ? "Cập nhật" : "Thêm mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENDER EMPLOYEE ERROR LOGGING / EDIT MODAL */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-lg w-full text-left space-y-4 shadow-2xl">
            <h4 className="font-extrabold text-white text-sm border-b border-slate-805 pb-2.5 flex items-center gap-1.5 font-sans">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              {editingErrorId ? "Cập Nhật Nhật Ký Vi Phạm" : "Ghi Nhận Lỗi Vi Phạm Mới"}
            </h4>
            <form onSubmit={handleCreateOrUpdateError} className="space-y-4 text-xs text-slate-300 font-sans">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Chọn nhân viên:</label>
                  <select
                    value={errFormEmpId}
                    onChange={(e) => handleFormEmployeeChange(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white focus:outline-none focus:border-amber-505 cursor-pointer text-xs"
                  >
                    <option value="" disabled>-- Chọn nhân sự --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.id} - {emp.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Ngày vi phạm:</label>
                  <input
                    type="date"
                    required
                    value={errFormDate}
                    onChange={(e) => setErrFormDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white focus:outline-none focus:border-amber-505 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Tìm nhanh lỗi / tiêu chí:</label>
                <div className="relative mb-2">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-2">
                    <Search className="w-3.5 h-3.5 text-slate-500" />
                  </span>
                  <input
                    type="text"
                    placeholder="Nhập từ khóa tìm kiếm tiêu chí..."
                    value={errorFormCritSearch}
                    onChange={(e) => setErrorFormCritSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded pl-7 pr-7 py-1.5 text-xs text-white outline-none focus:border-amber-505 transition-colors"
                  />
                  {errorFormCritSearch && (
                    <button
                      type="button"
                      onClick={() => setErrorFormCritSearch('')}
                      className="absolute right-2 top-1.5 text-slate-400 hover:text-white font-bold text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>

                <label className="block text-slate-400 font-bold mb-1">Chọn lỗi / Tiêu chí vi phạm:</label>
                <select
                  value={errFormCritId}
                  onChange={(e) => setErrFormCritId(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white focus:outline-none focus:border-amber-505 cursor-pointer text-xs"
                >
                  <option value="" disabled>-- Chọn lỗi vi phạm cụ thể --</option>
                  {(() => {
                    const allCriteria = departmentCriteria.find(dc => dc.id === errFormDeptId)?.criteria || [];
                    const filtered = allCriteria.filter(crit => {
                      const q = removeVietnameseTones(errorFormCritSearch);
                      return removeVietnameseTones(crit.content).includes(q) ||
                             removeVietnameseTones(crit.id).includes(q);
                    });
                    if (filtered.length === 0) {
                      return <option disabled>Không tìm thấy tiêu chí nào khớp</option>;
                    }
                    return filtered.map(crit => (
                      <option key={crit.id} value={crit.id}>
                        {crit.category === 'readiness' ? '[TÁC PHONG]' : crit.category === 'progress' ? '[HIỆU SUẤT]' : '[BÁO CÁO]'} {crit.content}
                      </option>
                    ));
                  })()}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Ghi chú cụ thể của quản lý:</label>
                <textarea
                  rows={3}
                  value={errFormNotes}
                  placeholder="Ví dụ: Đi muộn 45 phút không xin phép, không dọn dẹp sạch sẽ mạt gỗ sấy xưởng mộc..."
                  onChange={(e) => setErrFormNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white focus:outline-none focus:border-amber-505 text-xs"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-slate-400 font-bold mb-1 flex items-center justify-between">
                  <span>📸 Minh chứng hình ảnh vi phạm (Tải lên hoặc Chụp ảnh):</span>
                  <span className="text-[10px] text-slate-500 font-normal">Tối đa 5 ảnh</span>
                </label>

                {errFormImages.length > 0 && (
                  <div className="grid grid-cols-5 gap-2 bg-slate-950 p-2 rounded-xl border border-slate-850">
                    {errFormImages.map((img, idx) => (
                      <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-slate-800 group">
                        <img src={img} alt="Evidence" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setErrFormImages(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute -top-1 -right-1 bg-red-650 hover:bg-red-600 text-white w-4 h-4 rounded-full flex items-center justify-center text-[9px] cursor-pointer font-bold shadow"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.multiple = true;
                      input.onchange = (e: any) => {
                        const files = Array.from(e.target.files || []);
                        files.forEach((file: any) => {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            if (typeof reader.result === 'string') {
                              setErrFormImages(prev => [...prev, reader.result as string].slice(0, 5));
                            }
                          };
                          reader.readAsDataURL(file);
                        });
                      };
                      input.click();
                    }}
                    className="flex-1 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-705 text-slate-300 p-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <FileUp className="w-3.5 h-3.5" />
                    Tải ảnh lên
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      if (errFormCameraActive) {
                        const video = document.getElementById('errFormVideo') as HTMLVideoElement;
                        if (video) {
                          const canvas = document.createElement('canvas');
                          canvas.width = video.videoWidth || 640;
                          canvas.height = video.videoHeight || 480;
                          const ctx = canvas.getContext('2d');
                          if (ctx) {
                            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                            const dataUrl = canvas.toDataURL('image/jpeg');
                            setErrFormImages(prev => [...prev, dataUrl].slice(0, 5));
                          }
                        }
                        if (errFormCameraStream) {
                          errFormCameraStream.getTracks().forEach(track => track.stop());
                        }
                        setErrFormCameraStream(null);
                        setErrFormCameraActive(false);
                      } else {
                        try {
                          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                          setErrFormCameraStream(stream);
                          setErrFormCameraActive(true);
                          setTimeout(() => {
                            const video = document.getElementById('errFormVideo') as HTMLVideoElement;
                            if (video) {
                              video.srcObject = stream;
                              video.play().catch(e => console.log("video play path error:", e));
                            }
                          }, 150);
                        } catch (err) {
                          addToast({ title: '⚠️ Thiếu thông tin', message: 'Không thể truy cập camera. vui lòng cấp quyền hoặc tải ảnh lên.', type: 'warning' });
                        }
                      }
                    }}
                    className={`flex-1 p-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      errFormCameraActive 
                        ? 'bg-rose-650 hover:bg-rose-550 border-none text-white animate-pulse' 
                        : 'bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-705 text-slate-300'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    {errFormCameraActive ? "Chụp hình" : "Chụp từ Camera"}
                  </button>
                </div>

                {errFormCameraActive && (
                  <div className="relative rounded-xl overflow-hidden border border-rose-900/40 bg-black mt-2 aspect-video flex flex-col items-center justify-center">
                    <video id="errFormVideo" className="w-full h-full object-cover" playsInline muted />
                    <button
                      type="button"
                      onClick={() => {
                        if (errFormCameraStream) {
                          errFormCameraStream.getTracks().forEach(track => track.stop());
                        }
                        setErrFormCameraStream(null);
                        setErrFormCameraActive(false);
                      }}
                      className="absolute top-2 right-2 bg-black/60 hover:bg-black/90 text-white text-[10px] p-1 px-2 rounded-lg border border-slate-800 cursor-pointer"
                    >
                      ✕ Tắt Camera
                    </button>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => {
                    setShowErrorModal(false);
                    setEditingErrorId(null);
                    setErrFormNotes('');
                    setErrorFormCritSearch('');
                  }}
                  className="bg-slate-800 hover:bg-slate-750 text-slate-300 px-4 py-1.5 rounded-lg cursor-pointer transition-colors"
                >
                  Huỷ bỏ
                </button>
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-550 active:translate-y-0.5 font-bold text-white px-5 py-1.5 rounded-lg cursor-pointer transition-all shadow-md"
                >
                  {editingErrorId ? "Cập nhật lỗi" : "Ghi nhận lỗi"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {showSalaryScaleModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-lg w-full text-left space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowSalaryScaleModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h4 className="font-extrabold text-white text-base border-b border-slate-800 pb-2 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              {editingSalaryScale ? 'Cập Nhật Cấu Hình Bậc Lương' : 'Thêm Mới Bậc Lương Nhân Sự'}
            </h4>

            <form onSubmit={handleSaveSalaryScale} className="space-y-4 text-xs text-slate-300 font-sans">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-slate-400 font-bold mb-1">Mã chi trả (Khóa chính SQL):</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingSalaryScale}
                    value={ssId}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setSsId(val);
                      setSsLevelName(`Bậc lương ${val}`);
                    }}
                    placeholder="E.g., QLDHB1"
                    className="w-full bg-slate-950 border border-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg p-2.5 text-white outline-none focus:border-amber-500 font-mono font-bold"
                  />
                  {!editingSalaryScale && <span className="text-[9px] text-slate-500 block mt-1">Dành để xác định khóa chính bảng SQL</span>}
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-slate-400 font-bold mb-1">Mã ngạch:</label>
                  <select
                    value={ssGroupCode}
                    onChange={(e) => {
                      const code = e.target.value;
                      setSsGroupCode(code);
                      if (code === 'QLDH') setSsGroupName('QUẢN LÝ - ĐIỀU HÀNH');
                      else if (code === 'KTTC') setSsGroupName('KỸ THUẬT - THI CÔNG');
                      else if (code === 'HCKT') setSsGroupName('HÀNH CHÍNH - KẾ TOÁN - NHÂN SỰ - KINH DOANH');
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white outline-none focus:border-amber-500 font-bold"
                  >
                    <option value="QLDH">QLDH - Quản Lý - Điều Hành</option>
                    <option value="KTTC">KTTC - Kỹ Thuyết - Thi Công</option>
                    <option value="HCKT">HCKT - Hành Chính - Nhân Sự</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Bậc Lương:</label>
                  <input
                    type="text"
                    required
                    value={ssLevel}
                    onChange={(e) => setSsLevel(e.target.value)}
                    placeholder="E.g., B1"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white outline-none focus:border-amber-500 font-mono text-center font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Tên Bậc Lương:</label>
                  <input
                    type="text"
                    required
                    value={ssLevelName}
                    onChange={(e) => setSsLevelName(e.target.value)}
                    placeholder="E.g., Bậc lương QLDHB1"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white outline-none focus:border-amber-500 font-bold"
                  />
                </div>

                <div className="col-span-2 border-t border-b border-slate-800/60 py-3 my-1 grid grid-cols-2 gap-3 bg-slate-950/20 px-2 rounded-xl">
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Lương Cơ Bản (LCB):</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="50000"
                      value={ssBaseSalary}
                      onChange={(e) => setSsBaseSalary(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white outline-none focus:border-amber-500 font-mono text-right font-bold text-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Tỷ lệ Lương Hiệu suất %:</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="200"
                        value={ssAllocationRate}
                        onChange={(e) => setSsAllocationRate(Number(e.target.value))}
                        className="w-20 bg-slate-950 border border-slate-800 rounded-lg p-2 text-white outline-none focus:border-amber-500 font-mono font-bold text-center"
                      />
                      <input
                        type="range"
                        min="40"
                        max="160"
                        step="5"
                        value={ssAllocationRate}
                        onChange={(e) => setSsAllocationRate(Number(e.target.value))}
                        className="flex-1 accent-amber-500"
                      />
                    </div>
                  </div>

                  <div className="col-span-2 grid grid-cols-2 gap-3 text-[10.5px] bg-slate-950/60 p-2.5 rounded-lg border border-slate-850 mt-1">
                    <div className="text-slate-400">
                      <span>Lương Hiệu Suất tự tính:</span>
                      <strong className="block text-xs font-mono font-extrabold text-white mt-0.5">
                        {Math.round(ssBaseSalary * (ssAllocationRate / 100)).toLocaleString('vi-VN')} ₫
                      </strong>
                    </div>
                    <div className="text-slate-400 border-l border-slate-800 pl-3">
                      <span className="text-emerald-400">Tổng lương đạt 100%:</span>
                      <strong className="block text-xs font-mono font-black text-emerald-400 mt-0.5">
                        {(ssBaseSalary + Math.round(ssBaseSalary * (ssAllocationRate / 100))).toLocaleString('vi-VN')} ₫
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-slate-400 font-bold mb-1">Ghi chú / Mô tả chi tiết:</label>
                  <textarea
                    value={ssNotes}
                    onChange={(e) => setSsNotes(e.target.value)}
                    placeholder="Nhập ghi chú hoặc điều kiện xếp loại lương khác biệt..."
                    rows={2}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white outline-none focus:border-amber-500 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setShowSalaryScaleModal(false)}
                  className="bg-slate-805 hover:bg-slate-800 text-slate-300 font-bold px-4 py-2 rounded-lg cursor-pointer transition-colors"
                >
                  Huỷ bỏ
                </button>
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-550 active:translate-y-0.5 font-extrabold text-white px-5 py-2 rounded-lg cursor-pointer transition-all shadow-lg flex items-center gap-1.5"
                >
                  {editingSalaryScale ? 'Cập nhật Quyết định' : 'Lưu Bậc Lương'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: THÊM / CẬP NHẬT ĐỊNH MỨC CÔNG TÁC PHÍ */}
      {showTravelNormModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-slate-200 text-xs text-left animate-scaleIn">
            <div className="flex justify-between items-center border-b border-slate-800/80 pb-3 font-sans">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-500" />
                <h3 className="font-extrabold text-white text-sm">
                  {editingTravelNorm ? 'CẬP NHẬT ĐỊNH MỨC CÔNG TÁC PHÍ' : 'THÊM ĐỊNH MỨC CÔNG TÁC PHÍ'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTravelNormModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleTravelNormSubmit} className="space-y-4 font-sans">
                <div>
                <label className="block text-slate-400 font-bold mb-1">Mã CTP (Mã tự sinh)</label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={normCode}
                  placeholder="Mã tự động sinh..."
                  className="w-full bg-slate-950/60 text-slate-400 border border-slate-800 rounded-xl px-3 py-2 outline-none select-none cursor-not-allowed font-mono font-bold text-[11.5px]"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Nội Dung <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={normContent}
                  onChange={(e) => setNormContent(e.target.value)}
                  placeholder="Ví dụ: Đà Lạt - Nam Ban"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-500 outline-none focus:border-amber-500 transition-colors text-[11.5px]"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Đơn Giá (đ) <span className="text-rose-500">*</span></label>
                <input
                  type="number"
                  min="0"
                  required
                  value={normUnitPrice}
                  onChange={(e) => setNormUnitPrice(Number(e.target.value))}
                  className="w-full bg-slate-955 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 outline-none focus:border-amber-500 transition-colors font-mono text-[11.5px]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowTravelNormModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-755 text-slate-200 rounded-xl font-bold transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-black transition-colors shadow-lg shadow-amber-950/20 cursor-pointer"
                >
                  {editingTravelNorm ? 'Cập nhật' : 'Thêm định mức'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENDER ATTENDANCE EDIT MODAL */}
      {editingAttendance && editForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-lg w-full text-left space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="font-extrabold text-white text-sm flex items-center gap-1.5">
                ✏️ Sửa bản ghi chấm công — <span className="text-amber-400">{editingAttendance.empName}</span> ({editingAttendance.date})
              </h4>
              <button onClick={() => { setEditingAttendance(null); setEditForm(null); }} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>

            {/* Status select */}
            <div>
              <label className="block text-slate-400 font-bold mb-1 text-[11px]">Trạng thái:</label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-amber-500 focus:outline-none cursor-pointer"
              >
                <option value="valid">Hợp Lệ</option>
                <option value="late">Đi muộn</option>
                <option value="excused">Có phép</option>
                <option value="unexcused">Không phép</option>
                <option value="missing">Thiếu dữ liệu</option>
                <option value="invalid">Không hợp lệ</option>
              </select>
            </div>

            {/* Morning shift */}
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-850 space-y-2">
              <h5 className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">🌅 Ca Sáng</h5>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold">Giờ vào:</label>
                  <input
                    type="time"
                    value={editForm.timeInS === '--:--' ? '' : editForm.timeInS}
                    onChange={(e) => setEditForm({ ...editForm, timeInS: e.target.value || '--:--' })}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white text-xs font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold">Giờ ra:</label>
                  <input
                    type="time"
                    value={editForm.timeOutS === '--:--' ? '' : editForm.timeOutS}
                    onChange={(e) => setEditForm({ ...editForm, timeOutS: e.target.value || '--:--' })}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white text-xs font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Afternoon shift */}
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-850 space-y-2">
              <h5 className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">☀️ Ca Chiều</h5>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold">Giờ vào:</label>
                  <input
                    type="time"
                    value={editForm.timeInC === '--:--' ? '' : editForm.timeInC}
                    onChange={(e) => setEditForm({ ...editForm, timeInC: e.target.value || '--:--' })}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white text-xs font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold">Giờ ra:</label>
                  <input
                    type="time"
                    value={editForm.timeOutC === '--:--' ? '' : editForm.timeOutC}
                    onChange={(e) => setEditForm({ ...editForm, timeOutC: e.target.value || '--:--' })}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white text-xs font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Overtime shift */}
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-850 space-y-2">
              <h5 className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">🌙 Tăng Ca (OT)</h5>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold">Giờ vào:</label>
                  <input
                    type="time"
                    value={editForm.timeInOT === '--:--' ? '' : editForm.timeInOT}
                    onChange={(e) => setEditForm({ ...editForm, timeInOT: e.target.value || '--:--' })}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white text-xs font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold">Giờ ra:</label>
                  <input
                    type="time"
                    value={editForm.timeOutOT === '--:--' ? '' : editForm.timeOutOT}
                    onChange={(e) => setEditForm({ ...editForm, timeOutOT: e.target.value || '--:--' })}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white text-xs font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-slate-400 font-bold mb-1 text-[11px]">Ghi chú:</label>
              <textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => { setEditingAttendance(null); setEditForm(null); }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-1.5 rounded-lg cursor-pointer text-xs font-bold"
              >
                Huỷ bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveAttendanceEdit}
                className="bg-amber-600 hover:bg-amber-550 text-white px-4 py-1.5 rounded-lg cursor-pointer text-xs font-bold"
              >
                💾 Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK LOCK MODAL */}
      {showBulkLockModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full text-left space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="font-extrabold text-white text-sm flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-emerald-400" />
                Chốt công hàng loạt
              </h4>
              <button onClick={() => setShowBulkLockModal(false)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>

            <p className="text-slate-300 text-[12px] leading-relaxed">
              Chọn phạm vi chốt công. Hệ thống sẽ khóa tất cả bản ghi chưa chốt trong phạm vi đó. Sau khi chốt, chỉ Giám đốc / Kế toán mới được sửa.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setBulkLockScope('page')}
                className={`px-3 py-2.5 rounded-lg text-[12px] font-bold border transition-all cursor-pointer ${
                  bulkLockScope === 'page'
                    ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                Trang hiện tại
                <div className="text-[9px] font-normal text-slate-500 mt-0.5">
                  {globalPageSize === 'all' ? 'Tất cả dòng' : `${globalPageSize} dòng`}
                </div>
              </button>
              <button
                onClick={() => setBulkLockScope('month')}
                className={`px-3 py-2.5 rounded-lg text-[12px] font-bold border transition-all cursor-pointer ${
                  bulkLockScope === 'month'
                    ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                Cả tháng đã lọc
                <div className="text-[9px] font-normal text-slate-500 mt-0.5">
                  {attendanceFilterMonth === 'all' ? 'Tất cả tháng' : `Tháng ${attendanceFilterMonth.padStart(2, '0')}`}/{attendanceFilterYear}
                </div>
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowBulkLockModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-1.5 rounded-lg cursor-pointer text-xs font-bold"
              >
                Huỷ bỏ
              </button>
              <button
                type="button"
                onClick={handleBulkLock}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg cursor-pointer text-xs font-bold flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                Xác nhận chốt
              </button>
            </div>
          </div>
        </div>
      )}

      {zoomedImage && (
        <div
          className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4 z-[100] animate-fadeIn cursor-zoom-out"
          onClick={() => setZoomedImage(null)}
          id="hr_zoomed_image_overlay"
        >
          <div className="relative max-w-3xl max-h-[85vh] w-full flex items-center justify-center p-1 bg-slate-800 rounded-2xl border border-slate-700/60 shadow-2xl overflow-hidden pointer-events-auto" onClick={(e) => e.stopPropagation()}>
            <img 
              src={zoomedImage} 
              className="max-w-full max-h-[80vh] rounded-xl object-contain shadow-inner" 
              alt="Ảnh chấm công phóng lớn" 
              referrerPolicy="no-referrer"
            />
            <button
              onClick={() => setZoomedImage(null)}
              className="absolute top-4 right-4 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 hover:text-white text-slate-300 rounded-full p-2 cursor-pointer z-50 transition-all font-bold text-xs"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="mt-4 text-xs font-semibold text-slate-400 font-mono">Bấm nhấp ngoài vùng để đóng xem phóng to</p>
        </div>
      )}

      {/* SYSTEM MENU STRUCTURE SYNC MODAL */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn" id="sync_structure_modal">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl relative text-left">
            
            {/* Header */}
            <div className="flex justify-between items-start pb-4 border-b border-slate-800 shrink-0">
              <div>
                <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                  <Workflow className="w-5 h-5 text-indigo-400" />
                  CẤU TRÚC PHÂN HỆ & ĐỒNG BỘ PHÂN QUYỀN ERP
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Hiển thị sơ đồ menu cha, con của toàn bộ hệ thống Hoàng Long Lâm Đồng ERP. Tùy biến quyền hạn Xem, Thêm, Sửa, Xóa trước khi đồng bộ.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSyncModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-5 pr-1 text-slate-200">
              
              {/* Role selector inside the modal */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850/60 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                <div>
                  <label className="block text-[11px] uppercase font-black text-slate-400 tracking-wider mb-1">
                    Chọn vai trò người dùng để cấu hình:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {roles.map(r => {
                      const isSelected = syncModalSelectedRoleId === r.id;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setSyncModalSelectedRoleId(r.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-indigo-650 text-white shadow-md border border-indigo-500/30' 
                              : 'bg-slate-900/60 text-slate-400 hover:text-white border border-transparent'
                          }`}
                        >
                          {r.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 max-w-xs md:text-right">
                  Thay đổi trạng thái bên dưới sẽ áp dụng trực tiếp cho nhóm <span className="text-indigo-400 font-bold">{(roles.find(r => r.id === syncModalSelectedRoleId)?.name) || ''}</span>.
                </div>
              </div>

              {/* Hierarchy Tree */}
              <div className="space-y-4">
                {(() => {
                  const menuGroups = [
                    {
                      parentName: 'PHÒNG DỰ ÁN (Menu Cha)',
                      icon: 'Folder',
                      color: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
                      submenus: [
                        { code: 'projects_construction', name: 'Công trình & Thi công mộc (Xây Dựng)', desc: 'Theo dõi hợp đồng xây dựng, thi công thô và hoàn thiện thợ thầu.' },
                        { code: 'projects_furniture', name: 'Sản xuất Nội thất cao cấp', desc: 'Đơn hàng xưởng gỗ, tiến độ sản xuất bệ tủ kịch trần, lắp đặt.' },
                        { code: 'projects_mechanical', name: 'Gia công Cơ khí & Sắt mỹ thuật', desc: 'Thiết kế hàn cắt sắt mỹ nghệ, cổng cửa rào xưởng sỹ mạ.' },
                        { code: 'tasks', name: 'Nhiệm vụ & Tiến độ công việc', desc: 'Phân chia tác vụ việc làm, tiến độ thợ nhật thầu khoán liên thông.' }
                      ]
                    },
                    {
                      parentName: 'PHÒNG NHÂN SỰ (Menu Cha)',
                      icon: 'Users',
                      color: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
                      submenus: [
                        { code: 'employees', name: 'Quản trị Nhân sự & Chấm công', desc: 'Quản lý thông tin hồ sơ lý lịch, máy chấm công vân tay, tự động lập bảng lương.' }
                      ]
                    },
                    {
                      parentName: 'PHÒNG KẾ TOÁN & KHO & THẦU PHỤ (Menu Cha)',
                      icon: 'Briefcase',
                      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                      submenus: [
                        { code: 'finance', name: 'Tài chính - Kế Toán - Kho & Thầu Phụ', desc: 'Thống kê thu chi, quỹ tiền mặt, tồn kho nguyên vật liệu gỗ sắt, tổ đội thầu phụ.' },
                        { code: 'quotes', name: 'Hệ thống Lập Báo Giá', desc: 'Định mức dự toán xây dựng, nội thất gỗ và cơ khí gia công, xuất hợp đồng.' },
                        { code: 'reports', name: 'Báo cáo Phân tích kinh doanh', desc: 'Báo cáo lãi lỗ dự án, doanh thu dòng tiền và biểu đồ tăng trưởng doanh nghiệp.' }
                      ]
                    },
                    {
                      parentName: 'QUẢN TRỊ HỆ THỐNG (Menu Cha)',
                      icon: 'Settings',
                      color: 'text-slate-300 bg-slate-800/20 border-slate-700/30',
                      submenus: [
                        { code: 'settings', name: 'Thiết lập & Bản đồ vách mộc', desc: 'Cấu hình ngày nghỉ lễ, hệ số phép, định mức công tác phí và thông số quy chế.' }
                      ]
                    }
                  ];

                  return menuGroups.map((group, gIdx) => {
                    return (
                      <div key={gIdx} className="border border-slate-800/80 rounded-xl overflow-hidden">
                        
                        {/* Parent Menu Header */}
                        <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800/80 flex justify-between items-center">
                          <span className="text-[11px] font-black tracking-wider text-slate-300 flex items-center gap-1.5 uppercase">
                            <span className="w-2 h-2 rounded-full bg-indigo-500" />
                            {group.parentName}
                          </span>
                          
                          {/* Parent Quick Action */}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSyncModalRolePerms(prev => {
                                  const next = { ...prev };
                                  if (!next[syncModalSelectedRoleId]) next[syncModalSelectedRoleId] = {};
                                  group.submenus.forEach(sub => {
                                    next[syncModalSelectedRoleId][sub.code] = { view: true, create: true, edit: true, delete: true };
                                  });
                                  return next;
                                });
                              }}
                              className="text-[9.5px] font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer"
                            >
                              Chọn tất cả quyền
                            </button>
                            <span className="text-slate-700">|</span>
                            <button
                              type="button"
                              onClick={() => {
                                setSyncModalRolePerms(prev => {
                                  const next = { ...prev };
                                  if (!next[syncModalSelectedRoleId]) next[syncModalSelectedRoleId] = {};
                                  group.submenus.forEach(sub => {
                                    next[syncModalSelectedRoleId][sub.code] = { view: false, create: false, edit: false, delete: false };
                                  });
                                  return next;
                                });
                              }}
                              className="text-[9.5px] font-bold text-slate-400 hover:text-slate-300 cursor-pointer"
                            >
                              Bỏ chọn hết
                            </button>
                          </div>
                        </div>

                        {/* Submenus List */}
                        <div className="divide-y divide-slate-800/50 bg-slate-900/40">
                          {group.submenus.map((sub, sIdx) => {
                            const perms = syncModalRolePerms[syncModalSelectedRoleId]?.[sub.code] || { view: false, create: false, edit: false, delete: false };
                            return (
                              <div key={sIdx} className="p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-800/20 transition-colors">
                                <div className="space-y-1 max-w-md">
                                  <div className="font-bold text-slate-100 text-xs flex items-center gap-2">
                                    <span className="font-mono text-[9px] bg-indigo-950/60 border border-indigo-900/30 text-indigo-400 px-1.5 py-0.2 rounded font-extrabold uppercase">
                                      {sub.code}
                                    </span>
                                    {sub.name}
                                  </div>
                                  <p className="text-[10px] text-slate-400 leading-normal">
                                    {sub.desc}
                                  </p>
                                </div>

                                {/* Checklist Action Grid */}
                                <div className="flex flex-wrap items-center gap-3 lg:gap-4 shrink-0 bg-slate-950/45 p-2 rounded-xl border border-slate-850/60">
                                  
                                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={perms.view}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        setSyncModalRolePerms(prev => {
                                          const next = { ...prev };
                                          if (!next[syncModalSelectedRoleId]) next[syncModalSelectedRoleId] = {};
                                          next[syncModalSelectedRoleId][sub.code] = { ...perms, view: checked };
                                          return next;
                                        });
                                      }}
                                      className="w-4 h-4 rounded border-slate-800 text-amber-500 bg-slate-900 focus:ring-0 focus:ring-offset-0 accent-amber-500 cursor-pointer"
                                    />
                                    <span>Xem</span>
                                  </label>

                                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={perms.create}
                                      disabled={!perms.view}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        setSyncModalRolePerms(prev => {
                                          const next = { ...prev };
                                          if (!next[syncModalSelectedRoleId]) next[syncModalSelectedRoleId] = {};
                                          next[syncModalSelectedRoleId][sub.code] = { ...perms, create: checked };
                                          return next;
                                        });
                                      }}
                                      className={`w-4 h-4 rounded border-slate-800 text-amber-500 bg-slate-900 focus:ring-0 focus:ring-offset-0 accent-amber-500 cursor-pointer ${!perms.view ? 'opacity-40 cursor-not-allowed' : ''}`}
                                    />
                                    <span>Thêm</span>
                                  </label>

                                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={perms.edit}
                                      disabled={!perms.view}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        setSyncModalRolePerms(prev => {
                                          const next = { ...prev };
                                          if (!next[syncModalSelectedRoleId]) next[syncModalSelectedRoleId] = {};
                                          next[syncModalSelectedRoleId][sub.code] = { ...perms, edit: checked };
                                          return next;
                                        });
                                      }}
                                      className={`w-4 h-4 rounded border-slate-800 text-amber-500 bg-slate-900 focus:ring-0 focus:ring-offset-0 accent-amber-500 cursor-pointer ${!perms.view ? 'opacity-40 cursor-not-allowed' : ''}`}
                                    />
                                    <span>Sửa</span>
                                  </label>

                                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={perms.delete}
                                      disabled={!perms.view}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        setSyncModalRolePerms(prev => {
                                          const next = { ...prev };
                                          if (!next[syncModalSelectedRoleId]) next[syncModalSelectedRoleId] = {};
                                          next[syncModalSelectedRoleId][sub.code] = { ...perms, delete: checked };
                                          return next;
                                        });
                                      }}
                                      className={`w-4 h-4 rounded border-slate-800 text-rose-500 bg-slate-900 focus:ring-0 focus:ring-offset-0 accent-rose-500 cursor-pointer ${!perms.view ? 'opacity-40 cursor-not-allowed' : ''}`}
                                    />
                                    <span>Xóa</span>
                                  </label>

                                </div>
                              </div>
                            );
                          })}
                        </div>

                      </div>
                    );
                  });
                })()}
              </div>

            </div>

            {/* Footer Actions */}
            <div className="pt-4 border-t border-slate-800 shrink-0 flex flex-col sm:flex-row justify-between items-center gap-3">
              <button
                type="button"
                onClick={handleRestoreSyncDefaults}
                className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-755 text-slate-300 hover:text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 border border-slate-700/60"
              >
                <Sliders className="w-3.5 h-3.5 text-orange-400" />
                <span>Khôi phục cài đặt gốc của vai trò</span>
              </button>

              <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => setIsSyncModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-755 text-slate-300 hover:text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleSaveSyncPermissions}
                  className="px-5 py-2.5 bg-indigo-650 hover:bg-indigo-600 text-white font-black text-xs rounded-xl transition-all shadow-lg shadow-indigo-950/30 cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
                >
                  <Workflow className="w-4 h-4" />
                  <span>🔄 LƯU CẤU HÌNH & ĐỒNG BỘ ERP</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
