import React, { useState } from 'react';
import TablePagination, { hrGlobalSize } from '../../TablePagination';
import { Search, Check, CheckSquare, Trash2, RotateCcw, UserPlus, Users, X, Plus, Download, FileUp, Pencil } from 'lucide-react';
import { Role, EmployeeProfile } from '../hrTypes';
import { SalaryScale } from '../../../types';
import { dbService } from '../../../lib/dbService';
import { hashPasswordSync } from '../../../lib/passwordUtils';
import { loadHrmRoleGroups, setRoleGroupsCache } from '../../../context';

type ToastInput = { title: string; message: string; type?: 'success' | 'info' | 'warning' | 'error'; duration?: number };

// Modal for per-employee role selection in bulk create
interface BulkRoleSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (roleAssignments: Record<string, string>) => void;
  employees: { id: string; name: string }[];
  availableRoles: { id: string; name: string }[];
}

function BulkRoleSelectModal({ isOpen, onClose, onConfirm, employees, availableRoles }: BulkRoleSelectModalProps) {
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const handleChange = (empId: string, roleId: string) => {
    setAssignments(prev => ({ ...prev, [empId]: roleId }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl animate-fade-in">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-extrabold text-white">Phân quyền cho từng tài khoản</h4>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl font-bold">×</button>
        </div>
        <p className="text-slate-300 text-sm mb-4">Chọn nhóm vai trò cho từng nhân viên (để trống = không phân quyền)</p>

        <div className="space-y-3 max-h-96 overflow-y-auto mb-4 pr-2">
          {employees.map(emp => (
            <div key={emp.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-slate-950/50 border border-slate-800 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white truncate">{emp.name}</p>
                <p className="text-[10px] text-slate-400 font-mono">{emp.id}</p>
              </div>
              <select
                value={assignments[emp.id] || ''}
                onChange={e => handleChange(emp.id, e.target.value)}
                className="w-full sm:w-56 bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 text-sm focus:border-amber-500 focus:outline-none"
              >
                <option value="">— Không phân quyền —</option>
                {availableRoles.map(role => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={() => { onConfirm(assignments); onClose(); }}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-lg transition-colors"
          >
            Tạo tài khoản
          </button>
        </div>
      </div>
    </div>
  );
}

const generateUsernameFromProfile = (name: string, phone: string): string => {
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
};

interface ProfilesTabProps {
  employees: EmployeeProfile[];
  setEmployees: React.Dispatch<React.SetStateAction<EmployeeProfile[]>>;
  roles: Role[];
  setRoles: React.Dispatch<React.SetStateAction<Role[]>>;
  selectedEmpId: string | null;
  setSelectedEmpId: (v: string | null) => void;
  employeeSearch: string;
  setEmployeeSearch: (v: string) => void;
  isEditingEmp: boolean;
  setIsEditingEmp: (v: boolean) => void;
  editingEmpData: EmployeeProfile | null;
  setEditingEmpData: React.Dispatch<React.SetStateAction<EmployeeProfile | null>>;
  profilePage: number;
  setProfilePage: (v: number | ((prev: number) => number)) => void;
  globalPageSize: number | 'all';
  setGlobalPageSize: (v: number | 'all') => void;
  addToast: (t: ToastInput) => void;
  handleExportProfilesExcel: () => void;
  handleImportProfilesExcel: (e: React.ChangeEvent<HTMLInputElement>) => void;
  profileFileInputRef: React.RefObject<HTMLInputElement | null>;
  salaryScales: SalaryScale[];
  /** Mở form thêm nhân viên (đã kiểm tra quyền ở nơi gọi). Không truyền → ẩn nút Thêm. */
  onAddEmployee?: () => void;
}

// ───── Thành phần dùng chung cho danh sách và thẻ chi tiết nhân viên ─────
type StatusKey = 'working' | 'leave' | 'director_board' | 'off';
const statusKeyOf = (e: EmployeeProfile): StatusKey =>
  e.status === 'working' ? 'working' : e.status === 'leave' ? 'leave' : e.status === 'director_board' ? 'director_board' : 'off';

/** Nhãn trạng thái nền nhạt (chuẩn Điều phối vật tư) */
function StatusPill({ emp }: { emp: EmployeeProfile }) {
  const k = statusKeyOf(emp);
  const cls = k === 'working' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : k === 'leave' ? 'bg-amber-50 text-amber-700 border-amber-200'
    : k === 'director_board' ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
    : 'bg-slate-100 text-slate-600 border-slate-200';
  const label = k === 'working' ? 'Đang làm' : k === 'leave' ? 'Nghỉ phép' : k === 'director_board' ? 'Ban giám đốc' : 'Nghỉ làm';
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${cls}`}>{label}</span>;
}

const initialsOf = (name: string) => (name || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();

/**
 * Hiển thị ngày cho dễ đọc: "2026-03-05" → "05/03/2026". Dữ liệu nhập từ Excel đôi khi lưu dạng SỐ SERI của Excel
 * (vd 37109 = 13/09/2001; Excel tính từ 30/12/1899) → đổi lại thành ngày. Giá trị khác (đã là dd/mm/yyyy, chữ…) giữ nguyên.
 * Chỉ dùng để HIỂN THỊ, không sửa dữ liệu đã lưu.
 */
export function formatDisplayDate(v?: string | number | null): string {
  if (v === undefined || v === null || v === '') return '—';
  const t = String(v).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  if (/^\d{4,6}$/.test(t)) {
    const n = Number(t);
    if (n >= 20000 && n <= 80000) {   // khoảng năm 1954–2118: đúng dải số seri ngày của Excel
      const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
      return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
    }
  }
  return t;
}

/** Một cặp "nhãn nhỏ — giá trị" trong thẻ chi tiết */
function InfoField({ label, value, mono, wide }: { label: string; value?: React.ReactNode; mono?: boolean; wide?: boolean }) {
  const empty = value === undefined || value === null || value === '';
  return (
    <div className={`min-w-0 ${wide ? 'col-span-2' : ''}`}>
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`text-[13px] font-bold text-slate-900 break-words ${mono ? 'font-mono' : ''}`}>{empty ? '—' : value}</div>
    </div>
  );
}

/** Lớp dùng chung cho ô nhập trong form sửa hồ sơ (nền trắng, viền nhạt, focus xanh LoLo) */
const EDIT_INPUT = 'w-full h-9 bg-white border border-slate-200 rounded-xl px-3 text-[13px] text-slate-900 outline-none focus:border-[#0d47c9]';

/** Khối nhóm ô nhập trong form sửa (cùng kiểu InfoSection của thẻ chi tiết): lưới 2 cột */
function EditSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3.5">
      <h5 className="text-xs font-bold text-slate-500 mb-2.5">{title}</h5>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">{children}</div>
    </section>
  );
}

/** Một ô nhập: nhãn nhỏ phía trên; wide = chiếm cả hàng */
function EditField({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={`block min-w-0 ${wide ? 'col-span-2' : ''}`}>
      <span className="block text-[11px] text-slate-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

/** Khối thông tin có tiêu đề nhỏ */
function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3.5">
      <h5 className="text-xs font-bold text-slate-500 mb-2.5">{title}</h5>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">{children}</div>
    </section>
  );
}

export default function ProfilesTab({
  employees,
  setEmployees,
  roles,
  setRoles,
  selectedEmpId,
  setSelectedEmpId,
  employeeSearch,
  setEmployeeSearch,
  isEditingEmp,
  setIsEditingEmp,
  editingEmpData,
  setEditingEmpData,
  profilePage,
  setProfilePage,
  globalPageSize,
  setGlobalPageSize,
  addToast,
  handleExportProfilesExcel,
  handleImportProfilesExcel,
  profileFileInputRef,
  salaryScales,
  onAddEmployee,
}: ProfilesTabProps) {
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [bulkRoleModal, setBulkRoleModal] = useState<{
    isOpen: boolean;
    employees: { id: string; name: string }[];
    availableRoles: { id: string; name: string }[];
    onConfirm: (roleAssignments: Record<string, string>) => void;
  } | null>(null);

  // Lọc nhanh theo trạng thái (chip phía trên bảng). 'off' gồm mọi trạng thái còn lại (nghỉ làm…).
  const [statusFilter, setStatusFilter] = useState<'all' | 'working' | 'leave' | 'director_board' | 'off'>('all');
  const statusCount = (k: string) => employees.filter(e => statusKeyOf(e) === k).length;

  const filteredEmployees = employees.filter(emp =>
    (statusFilter === 'all' || statusKeyOf(emp) === statusFilter) && (
    emp.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
    emp.position.toLowerCase().includes(employeeSearch.toLowerCase()) ||
    emp.department.toLowerCase().includes(employeeSearch.toLowerCase()))
  ).sort((a, b) => {
    // Prioritize "working" status (đang làm) first
    if (a.status === 'working' && b.status !== 'working') return -1;
    if (a.status !== 'working' && b.status === 'working') return 1;
    // Then sort by employee code (mã nhân viên) ascending
    return a.id.localeCompare(b.id);
  });

  const paginatedEmployees = globalPageSize === 'all'
    ? filteredEmployees
    : filteredEmployees.slice((profilePage - 1) * (globalPageSize as number), profilePage * (globalPageSize as number));

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(new Set(paginatedEmployees.map(e => e.id)));
    } else {
      setSelectedRows(new Set());
    }
    setSelectAll(checked);
  };

  const handleRowSelect = (empId: string, checked: boolean) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (checked) next.add(empId);
      else next.delete(empId);
      return next;
    });
  };

  const handleBulkDelete = () => {
    if (selectedRows.size === 0) return;
    if (window.confirm(`⚠️ Bạn có chắc chắn muốn xóa ${selectedRows.size} nhân viên được chọn không?\nHành động này không thể hoàn tác.`)) {
      const idsToDelete = Array.from(selectedRows);
      const deletedEmps = employees.filter(e => selectedRows.has(e.id));
      setEmployees(employees.filter(e => !selectedRows.has(e.id)));
      setSelectedRows(new Set());
      setSelectAll(false);
      if (selectedEmpId && selectedRows.has(selectedEmpId)) {
        setSelectedEmpId(null);
        setIsEditingEmp(false);
      }
      // Đồng bộ xóa lên Supabase
      deletedEmps.forEach(emp => {
        dbService.employees.delete(emp.id).catch(err =>
          console.warn(`Xóa nhân viên ${emp.id} trên Supabase thất bại:`, err));
      });
      addToast({ title: '✅ Đã xóa', message: `Đã xóa ${idsToDelete.length} nhân viên.`, type: 'success' });
    }
  };

  const handleBulkResetPhepNam = () => {
    if (selectedRows.size === 0) return;
    const updatedEmps = employees.map(e =>
      selectedRows.has(e.id) ? { ...e, phepNam: 12 } : e
    );
    setEmployees(updatedEmps);
    setSelectedRows(new Set());
    setSelectAll(false);
    // Đồng bộ phép năm mới lên Supabase
    updatedEmps.filter(e => selectedRows.has(e.id)).forEach(emp => {
      dbService.employees.save(emp).catch(err =>
        console.warn(`Reset phép năm ${emp.id} trên Supabase thất bại:`, err));
    });
    addToast({ title: '✅ Đã reset', message: `Đã reset phép năm về 12 cho ${selectedRows.size} nhân viên.`, type: 'success' });
  };

  // Tạo tài khoản hệ thống từ hồ sơ nhân sự
  const createSystemAccountFromProfile = async (emp: EmployeeProfile, roleGroupId: string = '') => {
    // Check if employee already has a system account
    if (emp.hasSystemAccount) {
      addToast({
        title: '⚠️ Thông báo',
        message: `Nhân viên "${emp.name}" đã có tài khoản hệ thống.`,
        type: 'info'
      });
      return null;
    }

    const username = generateUsernameFromProfile(emp.name, emp.phone);

    try {
      // UPDATE the existing profile row in-place: add username, password, role fields.
      // Do NOT create a new Employee with a different ID — that would duplicate the row.
      const updatedProfile = {
        ...emp,
        username,
        password: hashPasswordSync('123'),
        role: 'engineer',
        // GIỮ nhóm vai trò hiện có của nhân viên (trước đây luôn đặt lại về rỗng khi không chỉ định nhóm → mất nhóm trong hồ sơ)
        roleGroupIds: roleGroupId ? [roleGroupId] : ((emp as any).roleGroupIds || ([] as string[])),
        // KHÔNG còn gán email cố định đuôi @hoanglonglamdong.vn (sai với mọi doanh nghiệp khác) — giữ email sẵn có của nhân viên.
        email: emp.email || '',
        hasSystemAccount: true,
      };

      // Save to Supabase (same ID — upsert, no duplicate)
      await dbService.employees.save(updatedProfile);

      // Update local HR state — đảm bảo không tạo duplicate record
      setEmployees(prev => {
        const exists = prev.some(e => e.id === emp.id);
        if (exists) {
          return prev.map(e => e.id === emp.id ? updatedProfile : e);
        }
        // Nếu record không có trong state local (sync issue), thêm vào
        return [...prev, updatedProfile];
      });

      // Đánh dấu cache bị invalidate để realtime sync lấy dữ liệu mới
      window.dispatchEvent(new CustomEvent('hl-system-account-created', {
        detail: { empId: emp.id, username }
      }));

      // If roleGroupId provided, add employee to the role group
      if (roleGroupId) {
        // Đọc từ in-memory cache (đã load từ Supabase)
        let rolesList: any[] = loadHrmRoleGroups();
        if (Array.isArray(rolesList)) {
          const targetRole = rolesList.find((r: any) => r.id === roleGroupId);
          if (targetRole) {
            if (!targetRole.memberIds) targetRole.memberIds = [];
            targetRole.memberIds.push(emp.id);
            setRoleGroupsCache(rolesList);
            // Đồng bộ lên Supabase
            dbService.hrmRoleGroups.save({
              id: targetRole.id,
              name: targetRole.name,
              description: targetRole.description || '',
              permissions: targetRole.permissions || {},
              memberIds: targetRole.memberIds || [],
            }).catch(() => {});
            window.dispatchEvent(new Event('storage'));
            window.dispatchEvent(new CustomEvent('hl-task-permissions-updated'));
          }
        }
      }

      addToast({
        title: '✅ Tạo tài khoản thành công',
        message: `Đã tạo tài khoản "${emp.name}" (${username})`,
        type: 'success'
      });

      return updatedProfile;
    } catch (error) {
      console.error('Lỗi tạo tài khoản:', error);
      addToast({
        title: '❌ Lỗi',
        message: 'Không thể tạo tài khoản hệ thống. Vui lòng thử lại.',
        type: 'error'
      });
      return null;
    }
  };

  // Tạo tài khoản nhanh cho nhiều nhân sự được chọn
  const handleBulkCreateSystemAccounts = async () => {
    if (selectedRows.size === 0) return;

    // Đọc danh sách role groups từ in-memory cache (đã load từ Supabase)
    let rolesList: any[] = loadHrmRoleGroups();
    const availableRoles: { id: string; name: string }[] = rolesList.map((r: any) => ({ id: r.id, name: r.name }));

    const selectedEmployees = employees.filter(e => selectedRows.has(e.id));

    // Show bulk per-employee role modal
    setBulkRoleModal({
      isOpen: true,
      employees: selectedEmployees.map(e => ({ id: e.id, name: e.name })),
      availableRoles,
      onConfirm: async (assignments) => {
        let successCount = 0;
        for (const emp of selectedEmployees) {
          const roleId = assignments[emp.id] || '';
          const result = await createSystemAccountFromProfile(emp, roleId);
          if (result) successCount++;
        }

        setSelectedRows(new Set());
        setSelectAll(false);

        addToast({
          title: '✅ Hoàn tất',
          message: `Đã tạo ${successCount}/${selectedEmployees.length} tài khoản hệ thống.`,
          type: 'success'
        });
      }
    });
  };

  // Tạo tài khoản nhanh cho nhân viên đang xem chi tiết (single)
  const handleSingleCreateSystemAccount = async (emp: EmployeeProfile) => {
    // Đọc danh sách role groups từ in-memory cache (đã load từ Supabase)
    let rolesList: any[] = loadHrmRoleGroups();
    const availableRoles: { id: string; name: string }[] = rolesList.map((r: any) => ({ id: r.id, name: r.name }));

    setBulkRoleModal({
      isOpen: true,
      employees: [{ id: emp.id, name: emp.name }],
      availableRoles,
      onConfirm: async (assignments) => {
        const roleId = assignments[emp.id] || '';
        if (roleId && !availableRoles.some(r => r.id === roleId)) {
          addToast({ title: '❌ Lỗi', message: 'Nhóm vai trò không hợp lệ.', type: 'error' });
          return;
        }
        await createSystemAccountFromProfile(emp, roleId);
      }
    });
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Left side: basic table layout */}
      <div className={`${selectedEmpId ? 'xl:col-span-7' : 'xl:col-span-12'} space-y-4 transition-all duration-300`}>
        {/* ── THANH CÔNG CỤ: tìm kiếm + nút. Nút chính (xanh LoLo) chỉ có "Thêm nhân viên"; Xuất/Nhập Excel là nút phụ chỉ biểu tượng ── */}
        <div className="flex flex-wrap items-center gap-2" data-testid="profiles-toolbar">
          <div className="flex items-center gap-2 h-9 px-3 flex-1 min-w-[150px] bg-white border border-slate-200 rounded-xl">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Tìm tên, chức vụ, bộ phận"
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
              className="flex-1 min-w-0 bg-transparent text-[13px] border-none outline-none text-slate-800 placeholder-slate-400"
              data-testid="profiles-search"
            />
          </div>
          <button type="button" onClick={handleExportProfilesExcel} title="Xuất Excel" aria-label="Xuất Excel" data-testid="profiles-export"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"><Download className="w-4 h-4" /></button>
          <button type="button" onClick={() => profileFileInputRef.current?.click()} title="Nhập Excel" aria-label="Nhập Excel" data-testid="profiles-import"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"><FileUp className="w-4 h-4" /></button>
          <input ref={profileFileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportProfilesExcel} />
          {onAddEmployee && (
            <button type="button" onClick={onAddEmployee} data-testid="profiles-add"
              // Nền xanh đặt inline vì index.css ép màu cho bg-* / text-white
              style={{ background: '#0d47c9', color: '#ffffff' }}
              className="h-9 px-3.5 rounded-xl flex items-center gap-1.5 text-[13px] font-bold cursor-pointer">
              <Plus className="w-4 h-4" /><span className="hidden sm:inline">Thêm nhân viên</span><span className="sm:hidden">Thêm</span>
            </button>
          )}
          {selectedEmpId && (
            <button type="button" onClick={() => { setSelectedEmpId(null); setIsEditingEmp(false); }}
              className="h-9 px-3 rounded-xl flex items-center gap-1 text-[13px] font-bold cursor-pointer bg-white border border-slate-200 text-slate-600">
              <X className="w-4 h-4" /> Đóng chi tiết
            </button>
          )}
        </div>

        {/* Lọc nhanh theo trạng thái (kèm số lượng); chip trống số lượng thì ẩn trừ "Tất cả" */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5" data-testid="profiles-chips">
          {([
            ['all', 'Tất cả', employees.length],
            ['working', 'Đang làm', statusCount('working')],
            ['leave', 'Nghỉ phép', statusCount('leave')],
            ['director_board', 'Ban giám đốc', statusCount('director_board')],
            ['off', 'Nghỉ làm', statusCount('off')],
          ] as const).filter(([k, , n]) => k === 'all' || n > 0).map(([k, label, n]) => {
            const on = statusFilter === k;
            return (
              <button key={k} type="button" onClick={() => { setStatusFilter(k); setProfilePage(1); }} data-testid={`profiles-chip-${k}`}
                style={on ? { background: '#e8efff', color: '#0d47c9', borderColor: '#bcd0ff' } : undefined}
                className={`h-8 px-3 rounded-full text-xs font-bold whitespace-nowrap border cursor-pointer ${on ? '' : 'bg-white text-slate-600 border-slate-200'}`}>
                {label} {n}
              </button>
            );
          })}
        </div>

        {/* Thanh thao tác hàng loạt — chỉ hiện khi đã tick chọn */}
        {selectedRows.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl border border-blue-200 bg-blue-50" data-testid="profiles-bulkbar">
            <span className="text-[13px] font-bold" style={{ color: '#0d47c9' }}>Đã chọn {selectedRows.size}</span>
            <span className="flex-1" />
            <button onClick={handleBulkCreateSystemAccounts} className="h-8 px-3 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer"><UserPlus className="w-3.5 h-3.5" /> Tạo tài khoản</button>
            <button onClick={handleBulkResetPhepNam} className="h-8 px-3 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer"><RotateCcw className="w-3.5 h-3.5" /> Reset phép năm</button>
            <button onClick={handleBulkDelete} className="h-8 px-3 rounded-lg bg-white border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /> Xóa</button>
          </div>
        )}

        {(() => {
          // Dùng chung cho bảng (máy tính) và thẻ (điện thoại)
          const initials = initialsOf;
          const statusPill = (emp: EmployeeProfile) => <StatusPill emp={emp} />;
          const openRow = (emp: EmployeeProfile) => {
            setSelectedEmpId(emp.id);
            setIsEditingEmp(false);
            // Điện thoại: khung chi tiết nằm dưới danh sách → cuộn xuống cho người dùng thấy ngay
            if (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 1279px)').matches) {
              setTimeout(() => document.getElementById('hr-profile-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
            }
          };
          const editRow = (emp: EmployeeProfile) => { setSelectedEmpId(emp.id); setEditingEmpData({ ...emp }); setIsEditingEmp(true); };
          const empty = <div className="py-10 text-center text-slate-500 text-sm">Không tìm thấy nhân viên phù hợp.</div>;

          return (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              {/* MÁY TÍNH: bảng */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px]" data-testid="profiles-table">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs">
                      <th className="px-3 py-2.5 w-10 text-center">
                        <input type="checkbox" checked={selectAll && paginatedEmployees.length > 0} onChange={(e) => handleSelectAll(e.target.checked)}
                          aria-label="Chọn tất cả" className="w-4 h-4 rounded cursor-pointer" />
                      </th>
                      <th className="px-3 py-2.5 font-bold">Mã</th>
                      <th className="px-3 py-2.5 font-bold">Nhân viên</th>
                      <th className="px-3 py-2.5 font-bold">Bộ phận</th>
                      <th className="px-3 py-2.5 font-bold">SĐT</th>
                      <th className="px-3 py-2.5 font-bold text-center">Phép năm</th>
                      <th className="px-3 py-2.5 font-bold text-center">Tài khoản</th>
                      <th className="px-3 py-2.5 font-bold text-center">Trạng thái</th>
                      <th className="px-3 py-2.5 w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedEmployees.length === 0 ? (
                      <tr><td colSpan={9}>{empty}</td></tr>
                    ) : paginatedEmployees.map(emp => (
                      <tr key={emp.id} onClick={() => openRow(emp)} data-testid={`profile-row-${emp.id}`}
                        className={`border-b border-slate-100 cursor-pointer transition-colors hover:bg-blue-50/50 ${selectedEmpId === emp.id ? 'bg-blue-50' : ''}`}>
                        <td className="px-3 py-2.5 text-center">
                          <input type="checkbox" checked={selectedRows.has(emp.id)} aria-label={`Chọn ${emp.name}`}
                            onClick={(e) => e.stopPropagation()} onChange={(e) => handleRowSelect(emp.id, e.target.checked)} className="w-4 h-4 rounded cursor-pointer" />
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{emp.id}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: '#e8efff', color: '#0d47c9' }}>{initials(emp.name)}</div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 truncate">{emp.name}</div>
                              <div className="text-[11px] text-slate-500 truncate">{emp.position}{emp.gender ? ` · ${emp.gender}` : ''}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-slate-700">{emp.department}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-600">{emp.phone}</td>
                        <td className="px-3 py-2.5 text-center font-mono text-xs font-bold text-slate-700">{emp.phepNam !== undefined ? emp.phepNam : 12} ngày</td>
                        <td className="px-3 py-2.5 text-center">
                          {emp.hasSystemAccount
                            ? <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">Đã tạo</span>
                            : <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border bg-slate-100 text-slate-500 border-slate-200">Chưa tạo</span>}
                        </td>
                        <td className="px-3 py-2.5 text-center">{statusPill(emp)}</td>
                        <td className="px-3 py-2.5 text-right">
                          <button type="button" aria-label={`Sửa ${emp.name}`} title="Sửa" onClick={(e) => { e.stopPropagation(); editRow(emp); }}
                            className="w-8 h-8 inline-flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"><Pencil className="w-3.5 h-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ĐIỆN THOẠI: danh sách thẻ (không phải kéo ngang) */}
              <div className="md:hidden" data-testid="profiles-cards">
                {paginatedEmployees.length === 0 ? empty : paginatedEmployees.map(emp => (
                  <div key={emp.id} onClick={() => openRow(emp)} data-testid={`profile-card-${emp.id}`}
                    className={`flex gap-3 px-3 py-3 border-b border-slate-100 last:border-b-0 cursor-pointer ${selectedEmpId === emp.id ? 'bg-blue-50' : ''}`}>
                    <div className="flex flex-col items-center gap-2 pt-0.5">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: '#e8efff', color: '#0d47c9' }}>{initials(emp.name)}</div>
                      <input type="checkbox" checked={selectedRows.has(emp.id)} aria-label={`Chọn ${emp.name}`}
                        onClick={(e) => e.stopPropagation()} onChange={(e) => handleRowSelect(emp.id, e.target.checked)} className="w-4 h-4 rounded cursor-pointer" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-slate-900 text-sm leading-snug">{emp.name}</div>
                        {statusPill(emp)}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">{emp.position} · {emp.department}</div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[11px] text-slate-500">
                        <span className="font-mono">{emp.id}</span>
                        <span className="font-mono">{emp.phone}</span>
                        <span>Phép {emp.phepNam !== undefined ? emp.phepNam : 12} ngày</span>
                        {emp.hasSystemAccount && <span className="text-emerald-700 font-bold">Có tài khoản</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Chân bảng: thanh phân trang chung (luôn hiện, kể cả khi danh sách ngắn) */}
              <TablePagination total={filteredEmployees.length} page={profilePage} onPage={setProfilePage}
                {...hrGlobalSize(globalPageSize, setGlobalPageSize)} unit="nhân viên" testId="profiles-pager" />
            </div>
          );
        })()}
      </div>

      {/* Right side: sticky details sidebar panel */}
      {selectedEmpId && (() => {
        const emp = employees.find(e => e.id === selectedEmpId);
        if (!emp) return null;

        return (
          <div id="hr-profile-detail" data-testid="profile-detail" className="xl:col-span-5 bg-white border border-slate-200 rounded-2xl p-4 space-y-4 text-slate-300 relative xl:sticky xl:top-6 animate-fade-in shadow-sm text-[11px]">
            {/* ĐẦU THẺ: ảnh chữ cái + tên + chức vụ · bộ phận + trạng thái; nút đóng bên phải */}
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: '#e8efff', color: '#0d47c9' }}>{initialsOf(emp.name)}</div>
              <div className="flex-1 min-w-0">
                <h4 className="font-black text-base text-slate-900 leading-snug">{emp.name}</h4>
                <p className="text-xs text-slate-600">{emp.position} · {emp.department}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <StatusPill emp={emp} />
                  <span className="font-mono text-[11px] text-slate-500">{emp.id}</span>
                </div>
              </div>
              <button type="button" onClick={() => { setSelectedEmpId(null); setIsEditingEmp(false); }} aria-label="Đóng chi tiết" title="Đóng" data-testid="profile-detail-close"
                className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            {!isEditingEmp ? (
              <div className="space-y-3">
                {/* Nút thao tác: Sửa là nút chính (xanh LoLo), Tạo tài khoản là nút phụ, Xóa là nút biểu tượng viền đỏ */}
                <div className="flex items-center gap-2" data-testid="profile-detail-actions">
                  <button type="button" data-testid="profile-edit"
                    onClick={() => { setEditingEmpData({ ...emp }); setIsEditingEmp(true); }}
                    style={{ background: '#0d47c9', color: '#ffffff' }}
                    className="h-9 px-4 rounded-xl text-[13px] font-bold flex items-center gap-1.5 cursor-pointer"><Pencil className="w-4 h-4" /> Sửa</button>
                  <button type="button" data-testid="profile-create-account" onClick={() => handleSingleCreateSystemAccount(emp)}
                    className="h-9 px-3.5 rounded-xl text-[13px] font-bold flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"><UserPlus className="w-4 h-4" /> Tạo tài khoản</button>
                  <span className="flex-1" />
                  <button type="button" aria-label="Xóa hồ sơ" title="Xóa hồ sơ" data-testid="profile-delete"
                    onClick={() => {
                      if (emp.id === 'NV_ADMIN' || emp.id === 'emp_admin' || emp.name === 'Administrator') {
                        addToast({ title: '🔒 Bị khóa', message: 'Không thể xóa tài khoản quản trị viên hệ thống (admin). Tài khoản này được bảo vệ và không thể xóa.', type: 'warning' });
                        return;
                      }
                      if (window.confirm(`⚠️ Bạn có chắc chắn muốn xóa vĩnh viễn hồ sơ nhân sự của ${emp.name} (${emp.id}) không?\nHành động này không thể hoàn tác.`)) {
                        setEmployees(employees.filter(e => e.id !== emp.id));
                        setSelectedEmpId(null);
                        // Đồng bộ xóa lên Supabase
                        dbService.employees.delete(emp.id).catch(err =>
                          console.warn(`Xóa nhân viên ${emp.id} trên Supabase thất bại:`, err));
                      }
                    }}
                    className="w-9 h-9 rounded-xl flex items-center justify-center bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                </div>

                <InfoSection title="Liên hệ">
                  <InfoField label="Điện thoại" value={emp.phone} mono />
                  <InfoField label="Giới tính" value={emp.gender} />
                  <InfoField label="Email" value={emp.email} mono wide />
                  <InfoField label="Thường trú" value={emp.address} wide />
                  <InfoField label="Tạm trú" value={emp.currentAddress || emp.address} wide />
                  <InfoField label="Liên hệ khẩn cấp" value={emp.emergencyContact} wide />
                </InfoSection>

                <InfoSection title="Giấy tờ cá nhân">
                  <InfoField label="CCCD" value={emp.cccd} mono />
                  <InfoField label="Ngày sinh" value={formatDisplayDate(emp.dob)} />
                  <InfoField label="Ngày cấp" value={formatDisplayDate(emp.cccdIssuedDate)} />
                  <InfoField label="Nơi cấp" value={emp.cccdIssuedPlace} />
                  <InfoField label="Trình độ" value={emp.education} wide />
                </InfoSection>

                <InfoSection title="Hợp đồng">
                  <InfoField label="Ngày vào làm" value={formatDisplayDate(emp.startDate)} />
                  <InfoField label="Ngạch lương" value={emp.salaryCode} mono />
                  <InfoField label="Loại hợp đồng" value={emp.contractType} />
                  <InfoField label="Thời hạn (tháng)" value={emp.contractType === 'Có thời hạn' ? emp.contractDurationMonths : undefined} />
                </InfoSection>

                {/* Phép năm: số lần đã cấp trên 12, kèm thanh tiến độ; kèm tài khoản ngân hàng */}
                {(() => {
                  const phep = emp.phepNam !== undefined ? emp.phepNam : 12;
                  const pct = Math.max(0, Math.min(100, (phep / 12) * 100));
                  return (
                    <section className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3">
                      <div>
                        <div className="flex items-baseline justify-between">
                          <h5 className="text-xs font-bold text-slate-500">Phép năm</h5>
                          <span className="text-[13px] font-black font-mono" style={{ color: '#0d47c9' }}>{phep} / 12 lần</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 mt-2 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#0d47c9' }} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-slate-100 pt-3">
                        <InfoField label="Số tài khoản" value={emp.bankAccount} mono />
                        <InfoField label="Ngân hàng" value={emp.bankName} />
                      </div>
                    </section>
                  );
                })()}
              </div>
            ) : (
              // FORM SỬA HỒ SƠ — chia khối giống thẻ chi tiết (Thông tin cá nhân / Liên hệ / Công việc & hợp đồng / Lương & ngân hàng).
              // Logic lưu/ràng buộc giữ nguyên; chỉ đổi giao diện.
              editingEmpData && (
                <form
                  data-testid="profile-edit-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const updated = employees.map(item => item.id === editingEmpData.id ? editingEmpData : item);
                    setEmployees(updated);
                    setIsEditingEmp(false);
                    // Đồng bộ lên Supabase
                    dbService.employees.save(editingEmpData).catch(err =>
                      console.warn('Lưu chỉnh sửa hồ sơ lên Supabase thất bại:', err));
                  }}
                  className="space-y-3 max-h-[70vh] overflow-y-auto pr-1"
                >
                  <EditSection title="Thông tin cá nhân">
                    <EditField label="Họ và tên" wide>
                      <input type="text" required value={editingEmpData.name} className={EDIT_INPUT} data-testid="edit-name"
                        onChange={(e) => setEditingEmpData({ ...editingEmpData, name: e.target.value })} />
                    </EditField>
                    <EditField label="Giới tính">
                      <select value={editingEmpData.gender} className={EDIT_INPUT}
                        onChange={(e) => setEditingEmpData({ ...editingEmpData, gender: e.target.value })}>
                        <option value="Nam">Nam</option>
                        <option value="Nữ">Nữ</option>
                      </select>
                    </EditField>
                    <EditField label="Ngày sinh">
                      <input type="date" value={editingEmpData.dob} className={EDIT_INPUT}
                        onChange={(e) => setEditingEmpData({ ...editingEmpData, dob: e.target.value })} />
                    </EditField>
                    <EditField label="CCCD / CMND">
                      <input type="text" required value={editingEmpData.cccd} className={`${EDIT_INPUT} font-mono`}
                        onChange={(e) => setEditingEmpData({ ...editingEmpData, cccd: e.target.value })} />
                    </EditField>
                    <EditField label="Ngày cấp CCCD">
                      <input type="text" value={editingEmpData.cccdIssuedDate || ''} className={EDIT_INPUT}
                        onChange={(e) => setEditingEmpData({ ...editingEmpData, cccdIssuedDate: e.target.value })} />
                    </EditField>
                    <EditField label="Nơi cấp CCCD" wide>
                      <input type="text" value={editingEmpData.cccdIssuedPlace || ''} className={EDIT_INPUT}
                        onChange={(e) => setEditingEmpData({ ...editingEmpData, cccdIssuedPlace: e.target.value })} />
                    </EditField>
                    <EditField label="Trình độ học vấn" wide>
                      <input type="text" value={editingEmpData.education || ''} className={EDIT_INPUT}
                        onChange={(e) => setEditingEmpData({ ...editingEmpData, education: e.target.value })} />
                    </EditField>
                  </EditSection>

                  <EditSection title="Liên hệ">
                    <EditField label="Số điện thoại">
                      <input type="text" required value={editingEmpData.phone} className={`${EDIT_INPUT} font-mono`}
                        onChange={(e) => setEditingEmpData({ ...editingEmpData, phone: e.target.value })} />
                    </EditField>
                    <EditField label="Email liên hệ">
                      <input type="email" required value={editingEmpData.email} className={EDIT_INPUT}
                        onChange={(e) => setEditingEmpData({ ...editingEmpData, email: e.target.value })} />
                    </EditField>
                    <EditField label="Địa chỉ thường trú" wide>
                      <input type="text" required value={editingEmpData.address} className={EDIT_INPUT}
                        onChange={(e) => setEditingEmpData({ ...editingEmpData, address: e.target.value })} />
                    </EditField>
                    <EditField label="Địa chỉ tạm trú" wide>
                      <input type="text" value={editingEmpData.currentAddress || ''} className={EDIT_INPUT}
                        onChange={(e) => setEditingEmpData({ ...editingEmpData, currentAddress: e.target.value })} />
                    </EditField>
                    <EditField label="Liên hệ khẩn cấp" wide>
                      <input type="text" value={editingEmpData.emergencyContact || ''} className={EDIT_INPUT}
                        onChange={(e) => setEditingEmpData({ ...editingEmpData, emergencyContact: e.target.value })} />
                    </EditField>
                  </EditSection>

                  <EditSection title="Công việc & hợp đồng">
                    <EditField label="Phòng ban">
                      {/* Hồ sơ cũ từng lưu nhầm "Xưởng cơ khí font-bold" (lẫn tên class vào giá trị) → hiện đúng mục "Xưởng cơ khí";
                          bấm Lưu sẽ ghi lại giá trị đúng. */}
                      <select value={editingEmpData.department === 'Xưởng cơ khí font-bold' ? 'Xưởng cơ khí' : editingEmpData.department} className={EDIT_INPUT} data-testid="edit-department"
                        onChange={(e) => setEditingEmpData({ ...editingEmpData, department: e.target.value })}>
                        <option value="Phòng Dự án">Phòng Dự án</option>
                        <option value="Xưởng mộc">Xưởng mộc</option>
                        <option value="Xưởng cơ khí">Xưởng cơ khí</option>
                        <option value="Kế toán">Kế toán</option>
                        <option value="Marketing/Sale">Marketing/Sale</option>
                        <option value="Ban Giám đốc">Ban Giám đốc</option>
                      </select>
                    </EditField>
                    <EditField label="Chức vụ">
                      <input type="text" required value={editingEmpData.position} className={EDIT_INPUT}
                        onChange={(e) => setEditingEmpData({ ...editingEmpData, position: e.target.value })} />
                    </EditField>
                    <EditField label="Loại hợp đồng">
                      <select value={editingEmpData.contractType} className={EDIT_INPUT}
                        onChange={(e) => setEditingEmpData({ ...editingEmpData, contractType: e.target.value, contractDurationMonths: e.target.value === 'Có thời hạn' ? (editingEmpData.contractDurationMonths || undefined) : undefined })}>
                        <option value="Không thời hạn">Không thời hạn</option>
                        <option value="Có thời hạn">Có thời hạn</option>
                        <option value="Thử việc">Thử việc</option>
                      </select>
                    </EditField>
                    {/* Thời hạn chỉ hiện khi hợp đồng "Có thời hạn" (bắt buộc nhập khi hiện) */}
                    {editingEmpData.contractType === 'Có thời hạn' && (
                      <EditField label="Thời hạn HĐ (tháng)">
                        <input type="number" min="1" required className={`${EDIT_INPUT} font-mono`} data-testid="edit-contract-months"
                          value={editingEmpData.contractDurationMonths !== undefined ? editingEmpData.contractDurationMonths : ''}
                          onChange={(e) => setEditingEmpData({ ...editingEmpData, contractDurationMonths: Number(e.target.value) })} />
                      </EditField>
                    )}
                    <EditField label="Trạng thái làm việc" wide>
                      <select value={editingEmpData.status} className={EDIT_INPUT} data-testid="edit-status"
                        onChange={(e) => {
                          const newStatus = e.target.value as any;
                          // Gắn "Nghỉ hẳn" -> xóa rỗng ngay tài khoản + mật khẩu đăng nhập,
                          // tránh nhân viên đã nghỉ việc vẫn đăng nhập được vào hệ thống.
                          // Không xóa hồ sơ nhân sự, chỉ khóa đường đăng nhập.
                          const accountClear = newStatus === 'retired' ? { username: '', password: '', hasSystemAccount: false } : {};
                          setEditingEmpData({ ...editingEmpData, status: newStatus, ...accountClear } as any);
                        }}>
                        <option value="working">Đang làm</option>
                        <option value="leave">Nghỉ phép</option>
                        <option value="director_board">Ban giám đốc</option>
                        <option value="retired">Nghỉ hẳn</option>
                      </select>
                      {editingEmpData.status === 'retired' && (
                        <p className="mt-1.5 text-[11px] leading-relaxed rounded-lg border border-amber-200 bg-amber-50 text-amber-700 px-2.5 py-1.5" data-testid="edit-retired-warning">
                          ⚠️ Nhân viên "Nghỉ hẳn" sẽ bị xóa tài khoản + mật khẩu đăng nhập khi lưu, không thể đăng nhập hệ thống nữa.
                        </p>
                      )}
                    </EditField>
                  </EditSection>

                  <EditSection title="Lương & ngân hàng">
                    <EditField label="Ngạch lương">
                      <select className={EDIT_INPUT}
                        value={(() => {
                          const found = salaryScales.find(s => editingEmpData.salaryCode && s.id === `${s.groupCode}${editingEmpData.salaryCode.replace(s.groupCode, '')}` || s.id === editingEmpData.salaryCode);
                          return found ? found.groupCode : (salaryScales.find(s => s.id === editingEmpData.salaryCode)?.groupCode || '');
                        })()}
                        onChange={(e) => {
                          const groupCode = e.target.value;
                          const firstLevel = salaryScales.find(s => s.groupCode === groupCode);
                          setEditingEmpData({
                            ...editingEmpData,
                            salaryCode: firstLevel ? `${groupCode}${firstLevel.level}` : '',
                          });
                        }}>
                        <option value="">-- Chọn ngạch lương --</option>
                        {Array.from(new Map(salaryScales.map(s => [s.groupCode, s])).values()).map(s => (
                          <option key={s.groupCode} value={s.groupCode}>{s.groupName} ({s.groupCode})</option>
                        ))}
                      </select>
                    </EditField>
                    <EditField label="Cấp bậc (bậc)">
                      <select disabled={!editingEmpData.salaryCode} className={`${EDIT_INPUT} disabled:opacity-50`}
                        value={(() => {
                          const found = salaryScales.find(s => s.id === editingEmpData.salaryCode);
                          return found ? found.level : '';
                        })()}
                        onChange={(e) => {
                          const level = e.target.value;
                          const groupCode = (() => {
                            const found = salaryScales.find(s => s.id === editingEmpData.salaryCode);
                            return found ? found.groupCode : '';
                          })();
                          if (groupCode) {
                            setEditingEmpData({ ...editingEmpData, salaryCode: `${groupCode}${level}` });
                          }
                        }}>
                        <option value="">-- Chọn bậc --</option>
                        {(() => {
                          const groupCode = salaryScales.find(s => s.id === editingEmpData.salaryCode)?.groupCode || '';
                          const levels = salaryScales.filter(s => s.groupCode === groupCode);
                          return levels.map(s => (
                            <option key={s.id} value={s.level}>{s.levelName} ({s.level})</option>
                          ));
                        })()}
                      </select>
                    </EditField>
                    {/* Mã ngạch tự sinh từ ngạch + bậc, chỉ xem (trước đây hiện 2 lần ở 2 chỗ → gộp 1) */}
                    <EditField label="Mã ngạch (tự động)">
                      <input type="text" readOnly disabled value={editingEmpData.salaryCode || ''}
                        className={`${EDIT_INPUT} font-mono cursor-not-allowed`} style={{ background: '#f1f5f9', color: '#0d47c9' }} />
                    </EditField>
                    <EditField label="Số lần phép năm được cấp">
                      <input type="number" step="0.5" min="0" required className={`${EDIT_INPUT} font-mono`}
                        value={editingEmpData.phepNam !== undefined ? editingEmpData.phepNam : 12}
                        onChange={(e) => setEditingEmpData({ ...editingEmpData, phepNam: Number(e.target.value) })} />
                    </EditField>
                    <EditField label="Số tài khoản ngân hàng">
                      <input type="text" required value={editingEmpData.bankAccount} className={`${EDIT_INPUT} font-mono`}
                        onChange={(e) => setEditingEmpData({ ...editingEmpData, bankAccount: e.target.value })} />
                    </EditField>
                    <EditField label="Tên ngân hàng">
                      <input type="text" required value={editingEmpData.bankName} className={EDIT_INPUT}
                        onChange={(e) => setEditingEmpData({ ...editingEmpData, bankName: e.target.value })} />
                    </EditField>
                  </EditSection>

                  {/* Thanh nút dính đáy: luôn thấy khi cuộn form dài. Nút Lưu xanh LoLo (màu inline vì index.css ép màu nền và màu chữ của nút) */}
                  <div className="sticky bottom-0 -mx-1 px-1 pt-2 pb-1 bg-white border-t border-slate-200 flex justify-end gap-2">
                    <button type="button" onClick={() => setIsEditingEmp(false)} data-testid="profile-edit-cancel"
                      className="h-9 px-4 rounded-xl text-[13px] font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer">Hủy</button>
                    <button type="submit" data-testid="profile-edit-save"
                      style={{ background: '#0d47c9', color: '#ffffff' }}
                      className="h-9 px-5 rounded-xl text-[13px] font-bold cursor-pointer">Lưu thay đổi</button>
                  </div>
                </form>
              )
            )}
          </div>
        );
      })()}

      {/* Bulk Per-Employee Role Modal (also used for single create) */}
      {bulkRoleModal && (
        <BulkRoleSelectModal
          isOpen={bulkRoleModal.isOpen}
          onClose={() => setBulkRoleModal(null)}
          onConfirm={bulkRoleModal.onConfirm}
          employees={bulkRoleModal.employees}
          availableRoles={bulkRoleModal.availableRoles}
        />
      )}
    </div>
  );
}
