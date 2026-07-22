import React, { useState } from 'react';
import { Search, Check, CheckSquare, Trash2, RotateCcw, UserPlus, Users, X } from 'lucide-react';
import { Role, EmployeeProfile } from '../hrTypes';
import { SalaryScale, Employee } from '../../../types';
import { dbService } from '../../../lib/dbService';
import { hashPasswordSync } from '../../../lib/passwordUtils';

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
                  <option key={role.id} value={role.id}>{role.id} - {role.name}</option>
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
            className="px-4 py-2 bg-amber-600 hover:bg-amber-550 text-slate-950 font-bold rounded-lg transition-colors"
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
  handleSimulateCheckIn: (empId: string, empName: string) => void;
  addToast: (t: ToastInput) => void;
  handleExportProfilesExcel: () => void;
  handleImportProfilesExcel: (e: React.ChangeEvent<HTMLInputElement>) => void;
  profileFileInputRef: React.RefObject<HTMLInputElement | null>;
  salaryScales: SalaryScale[];
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
  handleSimulateCheckIn,
  addToast,
  handleExportProfilesExcel,
  handleImportProfilesExcel,
  profileFileInputRef,
  salaryScales,
}: ProfilesTabProps) {
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [bulkRoleModal, setBulkRoleModal] = useState<{
    isOpen: boolean;
    employees: { id: string; name: string }[];
    availableRoles: { id: string; name: string }[];
    onConfirm: (roleAssignments: Record<string, string>) => void;
  } | null>(null);

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
    emp.position.toLowerCase().includes(employeeSearch.toLowerCase()) ||
    emp.department.toLowerCase().includes(employeeSearch.toLowerCase())
  );

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
    setEmployees(employees.map(e =>
      selectedRows.has(e.id) ? { ...e, phepNam: 12 } : e
    ));
    setSelectedRows(new Set());
    setSelectAll(false);
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
    const newId = `emp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const newAccount: Employee = {
      id: newId,
      name: emp.name,
      role: 'engineer',
      roleGroupIds: roleGroupId ? [roleGroupId] : [],
      email: `${username}@hoanglonglamdong.vn`,
      phone: emp.phone || '09xxxxxxxx',
      department: emp.department || 'Phòng Ban Liên Quan',
      username: username,
      password: hashPasswordSync('123')
    };

    try {
      // Save to localStorage (hl_erp_employees)
      const existingAccounts = JSON.parse(localStorage.getItem('hl_erp_employees') || '[]');
      const updatedAccounts = [...existingAccounts, newAccount];
      localStorage.setItem('hl_erp_employees', JSON.stringify(updatedAccounts));

      // Also save to cloud via dbService (don't let cloud failures block the local save)
      try {
        await dbService.employees.save(newAccount);
      } catch (cloudErr) {
        console.warn('Lưu lên cloud thất bại, nhưng đã lưu cục bộ:', cloudErr);
      }

      // If roleGroupId provided, add employee to the role group
      if (roleGroupId) {
        // Đọc từ cache Supabase trước, fallback localStorage cũ
        let rolesList: any[] = [];
        const supCached = localStorage.getItem('hl_cached_hrm_role_groups');
        if (supCached) {
          try { rolesList = JSON.parse(supCached); } catch {}
        }
        if (rolesList.length === 0) {
          const hrmRoles = localStorage.getItem('hl_hrm_roles_v2');
          if (hrmRoles) {
            try { rolesList = JSON.parse(hrmRoles); } catch {}
          }
        }
        if (Array.isArray(rolesList)) {
          const targetRole = rolesList.find((r: any) => r.id === roleGroupId);
          if (targetRole) {
            if (!targetRole.memberIds) targetRole.memberIds = [];
            targetRole.memberIds.push(newId);
            const updated = JSON.stringify(rolesList);
            localStorage.setItem('hl_cached_hrm_role_groups', updated);
            localStorage.setItem('hl_hrm_roles_v2', updated);
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

      // Also update HR employee list (hl_hrm_employees_v3) so the UI reflects the new account
      // Find if this employee already exists in HR store; if not, add a marker so it's visible
      const existingHR = employees.find(e => e.id === emp.id);
      if (existingHR) {
        // Employee exists in HR - we can add a flag or note that they now have a system account
        // The HR profile already exists, just the auth account was created
        setEmployees(prev => prev.map(e =>
          e.id === emp.id ? { ...e, hasSystemAccount: true } : e
        ));
      } else {
        // Employee doesn't exist in HR yet - add a basic profile entry so they appear in the list
        const newHRProfile: EmployeeProfile = {
          id: newAccount.id,
          name: emp.name,
          gender: emp.gender,
          dob: emp.dob,
          phone: emp.phone,
          email: emp.email,
          cccd: emp.cccd,
          cccdIssuedDate: emp.cccdIssuedDate,
          cccdIssuedPlace: emp.cccdIssuedPlace,
          address: emp.address,
          currentAddress: emp.currentAddress,
          emergencyContact: emp.emergencyContact,
          department: emp.department,
          position: emp.position,
          startDate: emp.startDate,
          contractType: emp.contractType,
          contractDurationMonths: emp.contractDurationMonths,
          status: emp.status,
          phepNam: emp.phepNam,
          bankAccount: emp.bankAccount,
          bankName: emp.bankName,
          docsCount: 0,
          education: emp.education,
          salaryCode: emp.salaryCode,
          bhxhBookNo: emp.bhxhBookNo,
          bhxhSalary: emp.bhxhSalary,
          bhxhRate: emp.bhxhRate,
          taxPersonalRelief: emp.taxPersonalRelief,
          dependentCount: emp.dependentCount,
          bhxhDate: emp.bhxhDate,
          hasSystemAccount: true
        };
        setEmployees(prev => [...prev, newHRProfile]);
        const updatedEmps = [...employees, newHRProfile];
        localStorage.setItem('hl_hrm_employees_v3', JSON.stringify(updatedEmps));
        dbService.employees.save(newHRProfile).catch(err =>
          console.warn('Lỗi khi lưu nhân viên mới lên Supabase:', err));
      }

      return newAccount;
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

    // Đọc danh sách role groups từ Supabase cache trước
    let rolesList: any[] = [];
    const supCached = localStorage.getItem('hl_cached_hrm_role_groups');
    if (supCached) {
      try { rolesList = JSON.parse(supCached); } catch {}
    }
    if (rolesList.length === 0) {
      const rolesData = localStorage.getItem('hl_hrm_roles_v2');
      if (rolesData) {
        try {
          const parsed = JSON.parse(rolesData);
          if (Array.isArray(parsed)) rolesList = parsed;
        } catch (e) {
          console.error('Error parsing roles:', e);
        }
      }
    }
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
    // Đọc danh sách role groups từ Supabase cache trước
    let rolesList: any[] = [];
    const supCached = localStorage.getItem('hl_cached_hrm_role_groups');
    if (supCached) {
      try { rolesList = JSON.parse(supCached); } catch {}
    }
    if (rolesList.length === 0) {
      const rolesData = localStorage.getItem('hl_hrm_roles_v2');
      if (rolesData) {
        try {
          const parsed = JSON.parse(rolesData);
          if (Array.isArray(parsed)) rolesList = parsed;
        } catch (e) {
          console.error('Error parsing roles:', e);
        }
      }
    }
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
        <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-900 p-3 rounded-xl border border-slate-800 gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên nhân viên, chức vụ, bộ phận..."
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
              className="flex-1 min-w-[200px] bg-transparent text-xs border-none outline-none text-slate-200 placeholder-slate-500"
            />
          </div>
          {selectedEmpId && (
            <button
              onClick={() => { setSelectedEmpId(null); setIsEditingEmp(false); }}
              className="text-xs text-amber-500 hover:text-amber-400 font-bold flex items-center gap-1 transition cursor-pointer"
            >
              Đóng chi tiết ✕
            </button>
          )}
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-[11px] overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-800 text-slate-405">
                <th className="pb-2 font-bold font-sans w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectAll && paginatedEmployees.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 text-amber-500 border-slate-600 rounded cursor-pointer"
                  />
                </th>
                <th className="pb-2 font-bold font-sans">Mã NV</th>
                <th className="pb-2 font-bold font-sans">Nhân viên</th>
                <th className="pb-2 font-bold font-sans text-center">Giới tính</th>
                <th className="pb-2 font-bold font-sans">SĐT</th>
                <th className="pb-2 font-bold font-sans">Bộ phận</th>
                <th className="pb-2 font-bold font-sans">Chức vụ</th>
                <th className="pb-2 font-bold font-sans text-center">Phép năm</th>
                <th className="pb-2 font-bold font-sans text-center">Tài khoản HT</th>
                <th className="pb-2 font-bold font-sans text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {paginatedEmployees.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-500 italic">Không tìm thấy nhân viên nào phù hợp.</td>
                </tr>
              ) : (
                paginatedEmployees.map(emp => (
                  <tr
                    key={emp.id}
                    onClick={() => {
                      setSelectedEmpId(emp.id);
                      setIsEditingEmp(false);
                    }}
                    className={`hover:bg-slate-950/40 cursor-pointer transition-colors ${selectedEmpId === emp.id ? 'bg-amber-600/10' : ''} ${selectedRows.has(emp.id) ? 'bg-amber-500/10' : ''}`}
                  >
                    <td className="py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(emp.id)}
                        onChange={(e) => { e.stopPropagation(); handleRowSelect(emp.id, e.target.checked); }}
                        className="w-4 h-4 text-amber-500 border-slate-600 rounded cursor-pointer"
                      />
                    </td>
                    <td className="py-2.5 font-mono font-bold text-amber-500">{emp.id}</td>
                    <td className="py-2.5 font-bold text-white hover:text-amber-400 transition-colors leading-none">
                      {emp.name}
                                          </td>
                    <td className="py-2.5 text-slate-300 text-center">{emp.gender}</td>
                    <td className="py-2.5 font-mono text-slate-300">{emp.phone}</td>
                    <td className="py-2.5 text-slate-350">{emp.department}</td>
                    <td className="py-2.5 text-slate-300 font-bold">{emp.position}</td>
                    <td className="py-2.5 text-center font-mono font-bold text-sky-400">{emp.phepNam !== undefined ? emp.phepNam : 12} ngày</td>
                    <td className="py-2.5 text-center">
                      {emp.hasSystemAccount ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          Đã tạo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                          Chưa tạo
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        emp.status === 'working' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        emp.status === 'leave' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${emp.status === 'working' ? 'bg-emerald-400' : emp.status === 'leave' ? 'bg-amber-400' : 'bg-red-400'}`}></span>
                        {emp.status === 'working' ? 'Đang làm' : emp.status === 'leave' ? 'Nghỉ phép' : 'Nghỉ làm'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination controller */}
          {(() => {
            const totalFiltered = filteredEmployees.length;
            if (globalPageSize === 'all' || totalFiltered <= (globalPageSize as number)) return null;
            const totalPages = Math.ceil(totalFiltered / (globalPageSize as number));
            return (
              <div className="flex justify-center items-center gap-1.5 mt-4 pt-4 border-t border-slate-850">
                <button
                  type="button"
                  disabled={profilePage === 1}
                  onClick={(e) => { e.stopPropagation(); setProfilePage(prev => Math.max(prev - 1, 1)); }}
                  className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none text-xs font-bold transition-all cursor-pointer"
                >
                  ◀ Trước
                </button>
                <span className="text-[11px] font-mono text-slate-400 px-2">
                  Trang <strong>{profilePage}</strong> / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={profilePage >= totalPages}
                  onClick={(e) => { e.stopPropagation(); setProfilePage(prev => Math.min(prev + 1, totalPages)); }}
                  className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none text-xs font-bold transition-all cursor-pointer"
                >
                  Sau ▶
                </button>
              </div>
            );
          })()}

          {/* Bulk Actions & Row Count */}
          <div className="flex flex-col sm:flex-row justify-between items-center mt-3 pt-2 text-[10px] text-slate-500 border-t border-slate-850/50 gap-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              {(() => {
                return (
                  <div>Hiển thị {globalPageSize === 'all' ? 'tất cả' : `${Math.min(globalPageSize as number, paginatedEmployees.length)} / ${filteredEmployees.length} nhân sự`} mỗi trang.</div>
                );
              })()}
              {selectedRows.size > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-amber-500 font-bold">Đã chọn: {selectedRows.size}</span>
                  <button
                    onClick={handleBulkDelete}
                    className="bg-rose-650 hover:bg-rose-600 text-white font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors text-[10px]"
                  >
                    <Trash2 className="w-3 h-3 inline-block align-middle mr-1" /> Xóa
                  </button>
                  <button
                    onClick={handleBulkResetPhepNam}
                    className="bg-amber-600 hover:bg-amber-550 text-white font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors text-[10px]"
                  >
                    <RotateCcw className="w-3 h-3 inline-block align-middle mr-1" /> Reset phép năm
                  </button>
                  <button
                    onClick={handleBulkCreateSystemAccounts}
                    className="bg-emerald-600 hover:bg-emerald-550 text-white font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors text-[10px]"
                  >
                    <UserPlus className="w-3 h-3 inline-block align-middle mr-1" /> Tạo tài khoản nhanh
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span>Hiển thị:</span>
              <select
                value={globalPageSize.toString()}
                onChange={(e) => {
                  const val = e.target.value;
                  const newSize = val === 'all' ? 'all' : parseInt(val, 10);
                  setGlobalPageSize(newSize);
                  localStorage.setItem('hl_global_page_size', val);
                }}
                className="bg-slate-950 border border-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[10px] cursor-pointer outline-none font-bold"
              >
                <option value="5">5 dòng</option>
                <option value="10">10 dòng</option>
                <option value="20">20 dòng</option>
                <option value="50">50 dòng</option>
                <option value="all">Tất cả</option>
              </select>
            </div>
          </div>

        </div>
      </div>

      {/* Right side: sticky details sidebar panel */}
      {selectedEmpId && (() => {
        const emp = employees.find(e => e.id === selectedEmpId);
        if (!emp) return null;

        return (
          <div className="xl:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-slate-300 relative sticky top-6 animate-fade-in shadow-2xl text-[11px] border-l-4 border-l-amber-500">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <span className="text-[9px] font-mono font-bold text-amber-500">{emp.id}</span>
                <h4 className="font-extrabold text-sm text-slate-100 mt-0.5">{emp.name}</h4>
                <p className="text-[10px] text-slate-420">{emp.department} • {emp.position}</p>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedEmpId(null); setIsEditingEmp(false); }}
                className="p-1 text-slate-400 hover:text-white rounded transition cursor-pointer"
                title="Đóng chi tiết"
              >
                ✕
              </button>
            </div>

            {!isEditingEmp ? (
              <div className="space-y-3">
                {/* Basic Profile Details */}
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-2">
                  <h5 className="font-extrabold text-[10px] text-amber-500 uppercase tracking-wider">Thông Tin Cá Nhân & Liên Hệ</h5>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs">
                    <div>CCCD: <strong className="text-slate-200 font-mono block mt-0.5">{emp.cccd}</strong></div>
                    <div>SĐT: <strong className="text-slate-200 font-mono block mt-0.5">{emp.phone}</strong></div>
                    <div>Ngày cấp CCCD: <strong className="text-slate-200 block mt-0.5">{emp.cccdIssuedDate || '—'}</strong></div>
                    <div>Nơi cấp CCCD: <strong className="text-slate-200 block mt-0.5">{emp.cccdIssuedPlace || '—'}</strong></div>
                    <div className="truncate col-span-2">Email: <strong className="text-slate-200 font-mono block mt-0.5 truncate">{emp.email}</strong></div>
                    <div>Ngày sinh: <strong className="text-slate-200 font-mono block mt-0.5">{emp.dob}</strong></div>
                    <div>Giới tính: <strong className="text-slate-200 block mt-0.5">{emp.gender}</strong></div>
                    <div className="col-span-2 font-xs">Địa chỉ thường trú: <strong className="text-slate-250 block mt-0.5 text-xs">{emp.address}</strong></div>
                    <div className="col-span-2 font-xs">Địa chỉ tạm trú: <strong className="text-slate-250 block mt-0.5 text-xs">{emp.currentAddress || emp.address}</strong></div>
                    <div>Trình độ học vấn: <strong className="text-slate-200 block mt-0.5">{emp.education || '—'}</strong></div>
                    <div className="col-span-2">Khẩn cấp: <strong className="text-slate-250 block mt-0.5 italic">{emp.emergencyContact || '—'}</strong></div>
                  </div>
                </div>

                {/* Contracts & Labor */}
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-2">
                  <h5 className="font-extrabold text-[10px] text-amber-500 uppercase tracking-wider">Hợp Đồng & Quản Trị</h5>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs">
                    <div>Ngạch lương: <strong className="text-slate-200 block mt-0.5 font-mono text-amber-400">{emp.salaryCode || '—'}</strong></div>
                    <div>Loại hợp đồng: <strong className="text-slate-200 block mt-0.5">{emp.contractType}</strong></div>
                    <div>Thời hạn HĐ (tháng): <strong className="text-slate-200 block mt-0.5">{emp.contractType === 'Có thời hạn' ? (emp.contractDurationMonths || '—') : '—'}</strong></div>
                    <div>Công Nhật Vào: <strong className="text-slate-200 block mt-0.5">{emp.startDate}</strong></div>
                    <div>Trạng thái: <strong className="text-slate-200 block mt-0.5 capitalize">{emp.status === 'working' ? 'Đang làm' : 'Nghỉ làm'}</strong></div>
                  </div>
                </div>

                {/* Finance / Allowances */}
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-1.5">
                  <h5 className="font-extrabold text-[10px] text-amber-500 uppercase tracking-wider">Quy Chế Phép Năm</h5>
                  <div className="flex justify-between">
                    <span className="text-slate-420">Số lần phép năm được cấp:</span>
                    <span className="font-bold text-amber-500 font-mono">{emp.phepNam !== undefined ? emp.phepNam : 12} / 12 lần</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-1.5 mt-1">
                    <span className="text-slate-420">Tài khoản ngân quỹ:</span>
                    <span className="font-mono text-slate-300 text-right">{emp.bankAccount} ({emp.bankName})</span>
                  </div>
                </div>

                {/* Actions on detailed sidebar */}
                <div className="flex justify-between items-center text-[10.5px] border-t border-slate-800 pt-3 mt-1.5">

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingEmpData({ ...emp });
                        setIsEditingEmp(true);
                      }}
                      className="bg-amber-600 hover:bg-amber-550 text-white font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSingleCreateSystemAccount(emp)}
                      className="bg-emerald-600 hover:bg-emerald-550 text-white font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                    >
                      <UserPlus className="w-3 h-3" /> Tạo tài khoản nhanh
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (emp.id === 'NV_ADMIN' || emp.id === 'emp_admin' || emp.name === 'Administrator') {
                          addToast({ title: '🗑️ Đã xóa', message: 'Không thể xóa hồ sơ nhân sự của Quản trị viên hệ thống (admin)!', type: 'info' });
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
                      className="bg-red-650 hover:bg-red-600 text-white font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              // EDIT FORM
              editingEmpData && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const updated = employees.map(item => item.id === editingEmpData.id ? editingEmpData : item);
                    setEmployees(updated);
                    setIsEditingEmp(false);
                    // Đồng bộ lên Supabase
                    dbService.employees.save(editingEmpData).catch(err =>
                      console.warn('Lưu chỉnh sửa hồ sơ lên Supabase thất bại:', err));
                  }}
                  className="space-y-3.5 max-h-[70vh] overflow-y-auto pr-1 text-slate-200"
                >
                  <div className="space-y-2">
                    <label className="block text-slate-400 font-bold text-[9.5px] uppercase">Họ và Tên:</label>
                    <input
                      type="text"
                      required
                      value={editingEmpData.name}
                      onChange={(e) => setEditingEmpData({ ...editingEmpData, name: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none focus:border-amber-500/50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-400 font-bold text-[9.5px] uppercase mb-1">Giới tính:</label>
                      <select
                        value={editingEmpData.gender}
                        onChange={(e) => setEditingEmpData({ ...editingEmpData, gender: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none"
                      >
                        <option value="Nam">Nam</option>
                        <option value="Nữ">Nữ</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold text-[9.5px] uppercase mb-1">Ngày sinh:</label>
                      <input
                        type="date"
                        value={editingEmpData.dob}
                        onChange={(e) => setEditingEmpData({ ...editingEmpData, dob: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-400 font-bold text-[9.5px] uppercase mb-1">Số điện thoại:</label>
                      <input
                        type="text"
                        required
                        value={editingEmpData.phone}
                        onChange={(e) => setEditingEmpData({ ...editingEmpData, phone: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold text-[9.5px] uppercase mb-1">CCCD / CMND:</label>
                      <input
                        type="text"
                        required
                        value={editingEmpData.cccd}
                        onChange={(e) => setEditingEmpData({ ...editingEmpData, cccd: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-400 font-bold text-[9.5px] uppercase mb-1">Ngày cấp CCCD:</label>
                      <input
                        type="text"
                        value={editingEmpData.cccdIssuedDate || ''}
                        onChange={(e) => setEditingEmpData({ ...editingEmpData, cccdIssuedDate: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold text-[9.5px] uppercase mb-1">Nơi cấp CCCD:</label>
                      <input
                        type="text"
                        value={editingEmpData.cccdIssuedPlace || ''}
                        onChange={(e) => setEditingEmpData({ ...editingEmpData, cccdIssuedPlace: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-slate-400 font-bold text-[9.5px] uppercase">Email liên hệ:</label>
                    <input
                      type="email"
                      required
                      value={editingEmpData.email}
                      onChange={(e) => setEditingEmpData({ ...editingEmpData, email: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-slate-400 font-bold text-[9.5px] uppercase">Địa chỉ thường trú:</label>
                    <input
                      type="text"
                      required
                      value={editingEmpData.address}
                      onChange={(e) => setEditingEmpData({ ...editingEmpData, address: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-slate-400 font-bold text-[9.5px] uppercase">Địa chỉ tạm trú:</label>
                    <input
                      type="text"
                      value={editingEmpData.currentAddress || ''}
                      onChange={(e) => setEditingEmpData({ ...editingEmpData, currentAddress: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-slate-400 font-bold text-[9.5px] uppercase">Liên hệ khẩn cấp:</label>
                    <input
                      type="text"
                      value={editingEmpData.emergencyContact || ''}
                      onChange={(e) => setEditingEmpData({ ...editingEmpData, emergencyContact: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-400 font-bold text-[9.5px] uppercase mb-1">Phòng ban:</label>
                      <select
                        value={editingEmpData.department}
                        onChange={(e) => setEditingEmpData({ ...editingEmpData, department: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none"
                      >
                        <option value="Phòng Dự án">Phòng Dự án</option>
                        <option value="Xưởng mộc">Xưởng mộc</option>
                        <option value="Xưởng cơ khí font-bold">Xưởng cơ khí</option>
                        <option value="Kế toán">Kế toán</option>
                        <option value="Marketing/Sale">Marketing/Sale</option>
                        <option value="Ban Giám đốc">Ban Giám đốc</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold text-[9.5px] uppercase mb-1">Chức vụ:</label>
                      <input
                        type="text"
                        required
                        value={editingEmpData.position}
                        onChange={(e) => setEditingEmpData({ ...editingEmpData, position: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-400 font-bold text-[9.5px] uppercase mb-1">Ngạch lương:</label>
                      <select
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
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none"
                      >
                        <option value="">-- Chọn ngạch lương --</option>
                        {Array.from(new Map(salaryScales.map(s => [s.groupCode, s])).values()).map(s => (
                          <option key={s.groupCode} value={s.groupCode}>{s.groupName} ({s.groupCode})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold text-[9.5px] uppercase mb-1">Cấp bậc (Bậc):</label>
                      <select
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
                        }}
                        disabled={!editingEmpData.salaryCode}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none disabled:opacity-50"
                      >
                        <option value="">-- Chọn bậc --</option>
                        {(() => {
                          const groupCode = salaryScales.find(s => s.id === editingEmpData.salaryCode)?.groupCode || '';
                          const levels = salaryScales.filter(s => s.groupCode === groupCode);
                          return levels.map(s => (
                            <option key={s.id} value={s.level}>{s.levelName} ({s.level})</option>
                          ));
                        })()}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-400 font-bold text-[9.5px] uppercase mb-1">Mã ngạch (tự động):</label>
                      <input
                        type="text"
                        value={editingEmpData.salaryCode || ''}
                        readOnly
                        disabled
                        className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-white outline-none font-mono text-amber-400 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold text-[9.5px] uppercase mb-1">Loại hợp đồng:</label>
                      <select
                        value={editingEmpData.contractType}
                        onChange={(e) => setEditingEmpData({ ...editingEmpData, contractType: e.target.value, contractDurationMonths: e.target.value === 'Có thời hạn' ? (editingEmpData.contractDurationMonths || undefined) : undefined })}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none"
                      >
                        <option value="Không thời hạn">Không thời hạn</option>
                        <option value="Có thời hạn">Có thời hạn</option>
                        <option value="Thử việc">Thử việc</option>
                      </select>
                    </div>
                    {editingEmpData.contractType === 'Có thời hạn' ? (
                      <div>
                        <label className="block text-slate-400 font-bold text-[9.5px] uppercase mb-1">Thời hạn HĐ (tháng):</label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={editingEmpData.contractDurationMonths !== undefined ? editingEmpData.contractDurationMonths : ''}
                          onChange={(e) => setEditingEmpData({ ...editingEmpData, contractDurationMonths: Number(e.target.value) })}
                          className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white font-mono outline-none"
                        />
                      </div>
                    ) : (
                      <div style={{visibility: 'hidden'}}>
                        <label className="block text-slate-400 font-bold text-[9.5px] uppercase mb-1">Thời hạn HĐ (tháng):</label>
                        <input type="number" disabled className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-white font-mono outline-none cursor-not-allowed opacity-50" />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-400 font-bold text-[9.5px] uppercase mb-1">Trạng thái làm việc:</label>
                      <select
                        value={editingEmpData.status}
                        onChange={(e) => setEditingEmpData({ ...editingEmpData, status: e.target.value as any })}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none"
                      >
                        <option value="working">Đang làm</option>
                        <option value="leave">Nghỉ phép</option>
                        <option value="retired">Nghỉ hẳn</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-400 font-bold text-[9.5px] uppercase mb-1">Số lần phép năm được cấp:</label>
                      <input
                        type="number"
                        required
                        value={editingEmpData.phepNam !== undefined ? editingEmpData.phepNam : 12}
                        onChange={(e) => setEditingEmpData({ ...editingEmpData, phepNam: Number(e.target.value) })}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold text-[9.5px] uppercase mb-1">Trình độ học vấn:</label>
                      <input
                        type="text"
                        value={editingEmpData.education || ''}
                        onChange={(e) => setEditingEmpData({ ...editingEmpData, education: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-400 font-bold text-[9.5px] uppercase mb-1">Tài khoản Ngân quỹ:</label>
                      <input
                        type="text"
                        required
                        value={editingEmpData.bankAccount}
                        onChange={(e) => setEditingEmpData({ ...editingEmpData, bankAccount: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold text-[9.5px] uppercase mb-1">Tên ngân hàng:</label>
                      <input
                        type="text"
                        required
                        value={editingEmpData.bankName}
                        onChange={(e) => setEditingEmpData({ ...editingEmpData, bankName: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-400 font-bold text-[9.5px] uppercase mb-1">Mã ngạch lương (Salary Code):</label>
                      <input
                        type="text"
                        value={editingEmpData.salaryCode || ''}
                        readOnly
                        className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none font-mono text-amber-400 cursor-not-allowed opacity-60"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
                    <button
                      type="button"
                      onClick={() => setIsEditingEmp(false)}
                      className="bg-slate-800 hover:bg-slate-705 text-white px-3 py-1.5 rounded-lg cursor-pointer"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      className="bg-emerald-600 hover:bg-emerald-550 text-white font-bold px-4 py-1.5 rounded-lg cursor-pointer"
                    >
                      Lưu lại ✅
                    </button>
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
