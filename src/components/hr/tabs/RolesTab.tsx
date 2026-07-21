import React, { useState, useEffect, useMemo } from 'react';
import { Users, Plus, Lock, Trash2, Shield, Settings, X, Unlock, ChevronDown, FileText, Building, Factory, Truck, AlertCircle, CheckCircle } from 'lucide-react';
import { Role, EmployeeProfile } from '../hrTypes';
import ProjectPermissionModal from './ProjectPermissionModal';
import { ProjectPermissionMatrix } from '../hrProjectPermissions';
import { Employee, HrmRoleGroup, HrmApprovalConfig } from '../../../types';
import SaveActionBar from '../../ui/SaveActionBar';
import { loadApprovalConfig, saveApprovalConfig, saveDefaultSnapshot, loadDefaultSnapshot, useNotification, ApprovalPermission } from '../../../context';
import { loadProjectPermissions, saveProjectPermissions } from '../hrProjectPermissions';
import { dbService } from '../../../lib/dbService';

export interface RolesTabProps {
  roles: Role[];
  setRoles: (v: any) => void;
  selectedRoleId: string;
  setSelectedRoleId: (v: any) => void;
  showAddRoleModal: boolean;
  setShowAddRoleModal: (v: any) => void;
  newRoleName: string;
  setNewRoleName: (v: any) => void;
  newRoleDesc: string;
  setNewRoleDesc: (v: any) => void;
  roleSearchQuery: string;
  setRoleSearchQuery: (v: any) => void;
  selectedTempEmpIds: string[];
  setSelectedTempEmpIds: React.Dispatch<React.SetStateAction<string[]>>;
  isRoleDropdownOpen: boolean;
  setIsRoleDropdownOpen: (v: any) => void;
  confirmRemoveMember: { roleId: string; empId: string } | null;
  setConfirmRemoveMember: (v: any) => void;
  employees: EmployeeProfile[];
  syncHrmPermissionsToApp: (v: any) => void;
  onSaveProjectPermissions: (matrix: ProjectPermissionMatrix) => void;
  currentUser: Employee;
  allEmployees: Employee[];
}

export default function RolesTab(props: RolesTabProps) {
  const {
    roles,
    setRoles,
    selectedRoleId,
    setSelectedRoleId,
    showAddRoleModal,
    setShowAddRoleModal,
    newRoleName,
    setNewRoleName,
    newRoleDesc,
    setNewRoleDesc,
    roleSearchQuery,
    setRoleSearchQuery,
    selectedTempEmpIds,
    setSelectedTempEmpIds,
    isRoleDropdownOpen,
    setIsRoleDropdownOpen,
    confirmRemoveMember,
    setConfirmRemoveMember,
    employees,
    syncHrmPermissionsToApp,
    onSaveProjectPermissions,
    currentUser,
    allEmployees,
  } = props;

  // ─── Top-level tab: Phân Quyền Nhóm Vai Trò | Quyền Dự Án | Quyền Phê Duyệt ──────
  const [roleMainTab, setRoleMainTab] = React.useState<'group' | 'task' | 'approval'>('group');

  // ─── Internal sub-tab within "Phân Quyền Nhóm Vai Trò" ──────────────
  const [roleGroupTab, setRoleGroupTab] = React.useState<'permissions' | 'members'>('permissions');

  // Danh sách loại hồ sơ cần phê duyệt (nhóm theo hồ sơ dự án và hồ sơ nhân sự)
  const approvalDocumentTypes = React.useMemo(() => ([
    { type: 'quotation', label: 'Báo Giá', group: 'Hồ Sơ Dự Án' },
    { type: 'contract', label: 'Hợp Đồng', group: 'Hồ Sơ Dự Án' },
    { type: 'acceptance', label: 'Nghiệm Thu', group: 'Hồ Sơ Dự Án' },
    { type: 'liquidation', label: 'Thanh Lý', group: 'Hồ Sơ Dự Án' },
    { type: 'leave', label: 'Đơn Xin Nghỉ Phép', group: 'Hồ Sơ Nhân Sự' },
    { type: 'salary_advance', label: 'Tạm Ứng Lương Nhanh', group: 'Hồ Sơ Nhân Sự' },
  ]), []);

  // ─── Draft states cho cơ chế Manual Save (Mỗi tab ≠ nhau) ──────────────
  const [draftRoles, setDraftRoles] = React.useState(() => [...roles]);
  const [draftMatrix, setDraftMatrix] = React.useState(() => loadProjectPermissions());
  const [draftApprovalConfig, setDraftApprovalConfig] = React.useState<ApprovalPermission[]>(() => loadApprovalConfig());

  // Đồng bộ draftRoles khi roles thay đổi từ parent (thêm/xóa ở modal ngoài)
  React.useEffect(() => {
    setDraftRoles([...roles]);
  }, [roles]);

  // Cờ hiển thị chưa lưu (để hiện badge)
  const groupChanged = React.useMemo(() => JSON.stringify(draftRoles) !== JSON.stringify(roles), [draftRoles, roles]);
  const projectChanged = React.useMemo(() => JSON.stringify(draftMatrix) !== JSON.stringify(loadProjectPermissions()), [draftMatrix]);
  const approvalChanged = React.useMemo(() => JSON.stringify(draftApprovalConfig) !== JSON.stringify(loadApprovalConfig()), [draftApprovalConfig]);

  // Save handlers
  const { addToast } = useNotification();

  const handleSaveGroup = React.useCallback(() => {
    const updated = [...draftRoles];
    // Ghi cache Supabase + localStorage cũ
    localStorage.setItem('hl_cached_hrm_role_groups', JSON.stringify(updated));
    localStorage.setItem('hl_hrm_roles_v2', JSON.stringify(updated));
    setRoles(updated);
    syncHrmPermissionsToApp(updated);
    // Đồng bộ lên Supabase
    updated.forEach((role: any) => {
      dbService.hrmRoleGroups.save({
        id: role.id,
        name: role.name,
        description: role.description || '',
        permissions: role.permissions || {},
        memberIds: role.memberIds || [],
      }).catch(() => {});
    });
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('hl-task-permissions-updated'));
    addToast({ title: '✅ Thành công', message: 'Phân quyền nhóm vai trò đã được lưu.', type: 'success' });
  }, [draftRoles, setRoles, syncHrmPermissionsToApp, addToast]);

  const handleSaveProject = React.useCallback(async () => {
    await saveProjectPermissions(draftMatrix);
    addToast({ title: '✅ Thành công', message: 'Quyền dự án đã được lưu.', type: 'success' });
  }, [draftMatrix, addToast]);

  const handleSaveApproval = React.useCallback(() => {
    saveApprovalConfig(draftApprovalConfig);
    addToast({ title: '✅ Thành công', message: 'Quyền phê duyệt đã được lưu.', type: 'success' });
  }, [draftApprovalConfig, addToast]);

  // Default snapshot helpers (per-tab)
  const getCurrentTabDefault = React.useCallback((): any => {
    if (roleMainTab === 'group') return loadDefaultSnapshot('group');
    if (roleMainTab === 'task') return loadDefaultSnapshot('project');
    return loadDefaultSnapshot('approval');
  }, [roleMainTab]);

  const handleSetDefault = React.useCallback(() => {
    if (roleMainTab === 'group') saveDefaultSnapshot('group', draftRoles);
    else if (roleMainTab === 'task') saveDefaultSnapshot('project', draftMatrix);
    else saveDefaultSnapshot('approval', draftApprovalConfig);
    addToast({ title: '📌 Đã đặt mặc định', message: 'Cấu hình hiện tại đã được lưu làm mặc định cho tab này.', type: 'info' });
  }, [roleMainTab, draftRoles, draftMatrix, draftApprovalConfig, addToast]);

  const handleRestoreDefault = React.useCallback(() => {
    const snap = getCurrentTabDefault();
    if (!snap) {
      addToast({ title: '⚠️ Chưa có mặc định', message: 'Tab này chưa được đặt cấu hình mặc định.', type: 'warning' });
      return;
    }
    if (!window.confirm('Khôi phục cấu hình về mặc định đã lưu? Các thay đổi chưa lưu sẽ bị mất.')) return;
    if (roleMainTab === 'group') setDraftRoles([...snap]);
    else if (roleMainTab === 'task') setDraftMatrix(snap);
    else setDraftApprovalConfig([...snap]);
    addToast({ title: '↩️ Đã khôi phục', message: 'Đã khôi phục cấu hình mặc định.', type: 'info' });
  }, [roleMainTab, getCurrentTabDefault, addToast]);

  // ─── State handlers cho tab Quyền Phê Duyệt ─────────────────────────
  const handleToggleApproval = React.useCallback((docType: ApprovalPermission['documentType'], docLabel: string, checked: boolean) => {
    const existing = [...draftApprovalConfig];
    const idx = existing.findIndex(p => p.documentType === docType);
    if (checked) {
      const defaultApprover = employees[0];
      if (!defaultApprover) return;
      const newPerm: ApprovalPermission = {
        id: `ap_${docType}`,
        documentType: docType,
        documentTypeLabel: docLabel,
        approverId: defaultApprover.id,
        approverName: defaultApprover.name,
        approverPosition: defaultApprover.position || '',
        canApprove: true
      };
      if (idx >= 0) {
        existing[idx] = newPerm;
      } else {
        existing.push(newPerm);
      }
    } else {
      if (idx >= 0) {
        existing[idx] = { ...existing[idx], canApprove: false };
      }
    }
    setDraftApprovalConfig(existing);
  }, [draftApprovalConfig, employees]);

  const handleChangeApprover = React.useCallback((docType: ApprovalPermission['documentType'], empId: string, empName: string, empPosition?: string) => {
    const existing = [...draftApprovalConfig];
    const idx = existing.findIndex(p => p.documentType === docType);
    if (idx >= 0) {
      existing[idx] = { ...existing[idx], approverId: empId, approverName: empName, approverPosition: empPosition || '' };
    } else {
      existing.push({
        id: `ap_${docType}`,
        documentType: docType,
        documentTypeLabel: docType,
        approverId: empId,
        approverName: empName,
        approverPosition: empPosition || '',
        canApprove: true
      });
    }
    setDraftApprovalConfig(existing);
  }, [draftApprovalConfig]);

  const getCurrentApprovalPerm = React.useCallback((docType: string): ApprovalPermission | undefined => {
    return draftApprovalConfig.find(p => p.documentType === docType);
  }, [draftApprovalConfig]);

  return (
    <div className="flex flex-col gap-6 animate-fadeIn text-slate-200">

      {/* TOP TAB SELECTOR: Phân Quyền Nhóm Vai Trò | Quyền Dự Án | Quyền Phê Duyệt */}
      <div className="flex gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 w-fit">
        <button
          type="button"
          onClick={() => setRoleMainTab('group')}
          className={`px-4 py-2 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 ${roleMainTab === 'group' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-white bg-transparent'}`}
        >
          <Shield className="w-3.5 h-3.5" /> Phân Quyền Nhóm Vai Trò
        </button>
        <button
          type="button"
          onClick={() => setRoleMainTab('task')}
          className={`px-4 py-2 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 ${roleMainTab === 'task' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white bg-transparent'}`}
        >
          <Shield className="w-3.5 h-3.5" /> Quyền Dự Án
        </button>
        <button
          type="button"
          onClick={() => {
            setRoleMainTab('approval');
            // Auto-select first role (or admin role) when entering approval tab
            if (!selectedRoleId && roles.length > 0) {
              const adminRole = roles.find(r => r.id === 'role_admin');
              setSelectedRoleId(adminRole ? adminRole.id : roles[0].id);
            }
          }}
          className={`px-4 py-2 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 ${roleMainTab === 'approval' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-white bg-transparent'}`}
        >
          <Shield className="w-3.5 h-3.5" /> Quyền Phê Duyệt
        </button>
      </div>

      {/* TOP PANEL: Master - List of Roles (chỉ hiển thị ở tab Phân Quyền Nhóm Vai Trò để tránh nhầm lẫn) */}
      {roleMainTab === 'group' && (
      <div className="bg-slate-900 border border-slate-805 rounded-2xl p-5 space-y-4 w-full">
        <div className="flex justify-between items-center pb-2 border-b border-slate-800">
          <h4 className="font-extrabold text-xs text-white uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-500" />
            <span>Nhóm vai trò ({roles.length})</span>
          </h4>
          <button
            type="button"
            onClick={() => {
              setNewRoleName('');
              setNewRoleDesc('');
              setShowAddRoleModal(true);
            }}
            className="bg-amber-600 hover:bg-amber-550 text-slate-950 font-extrabold text-[10px] px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-all uppercase tracking-wider"
          >
            <Plus className="w-3 h-3" /> Thêm nhóm
          </button>
        </div>

        <p className="text-[10px] text-slate-400">
          Chọn một nhóm vai trò bên dưới để kiểm tra phân quyền hoặc gán danh sách thành viên trực thuộc.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-3 overflow-y-auto pr-1">
          {roles.map(r => {
            const isSelected = selectedRoleId === r.id;
            return (
              <div
                key={r.id}
                onClick={() => {
                  setSelectedRoleId(r.id);
                }}
                className={`p-3 rounded-xl border transition-all cursor-pointer text-left ${isSelected ? 'bg-amber-500/10 border-amber-500/50 shadow-lg' : 'bg-slate-950/40 border-slate-850 hover:bg-slate-850/30'}`}
              >
                <div className="flex justify-between items-start gap-2">
                  <h5 className="font-bold text-xs text-white flex items-center gap-1.5">
                    <Lock className={`w-3 h-3 ${isSelected ? 'text-amber-500' : 'text-slate-400'}`} />
                    {r.name}
                  </h5>
                  <span className="bg-slate-800 text-slate-300 font-mono text-[9px] font-extrabold px-1.5 py-0.5 rounded-md">
                    {r.memberIds.length} nhân sự
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                  {r.description || 'Chưa cấu hình mô tả ngắn cho nhóm phân quyền này.'}
                </p>

                {/* Quick delete/edit controls for custom roles */}
                {!['role_admin', 'role_accounting', 'role_office'].includes(r.id) && (
                  <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-slate-800/40 text-[9.5px]">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`⚠️ Bạn có chắc chắn muốn xóa nhóm vai trò "${r.name}" không?`)) {
                          const updated = draftRoles.filter(item => item.id !== r.id);
                          setDraftRoles(updated);
                          setRoles(updated);
                          localStorage.setItem('hl_cached_hrm_role_groups', JSON.stringify(updated));
                          localStorage.setItem('hl_hrm_roles_v2', JSON.stringify(updated));
                          dbService.hrmRoleGroups.delete(r.id).catch(() => {});
                          syncHrmPermissionsToApp(updated);
                          if (selectedRoleId === r.id) {
                            setSelectedRoleId('role_admin');
                          }
                        }
                      }}
                      className="text-rose-450 hover:text-rose-400 font-bold flex items-center gap-0.5 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3 text-rose-500" /> Xóa nhóm
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>


      </div>
      )}

      {/* BOTTOM PANEL: Detail - Permission Matrix or Members */}
      {roleMainTab === 'group' && (() => {
        const activeRole = draftRoles.find(r => r.id === selectedRoleId);
        if (!activeRole) {
          return (
            <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-500 italic">
              Vui lòng chọn một nhóm vai trò để cấu hình.
            </div>
          );
        }

        // Admin (role_admin) luôn full quyền, không cho sửa
        const isAdmin = activeRole.id === 'role_admin';

        const groupedModules = [
          {
            department: 'PHÒNG GIÁM ĐỐC',
            color: 'border-violet-500/20 text-violet-400 bg-violet-500/5',
            modules: [
              { code: 'director_office', name: 'Menu Cha: Phòng Giám Đốc', desc: 'Kiểm soát khu vực làm việc và dữ liệu nhạy cảm của Ban Giám Đốc' },
              { code: 'director_dashboard', name: '↳ Bàn Làm Việc Giám Đốc', desc: 'Báo cáo chỉ số kinh doanh, biểu đồ tăng trưởng và duyệt ngân sách lớn' }
            ]
          },
          {
            department: 'PHÒNG DỰ ÁN',
            color: 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5',
            modules: [
              { code: 'project_office', name: 'Menu Cha: Phòng Dự Án', desc: 'Khu vực quản lý và giám sát các công trình xây dựng, sản xuất gỗ, cơ khí' },
              { code: 'projects_construction', name: '↳ Công trình & Thi công mộc (Xây Dựng)', desc: 'Theo dõi hợp đồng xây dựng, thi công thô và hoàn thiện thợ thầu dẻo dai' },
              { code: 'projects_furniture', name: '↳ Dự án Nội thất cao cấp', desc: 'Sản xuất mộc xưởng gỗ, bệ tủ kịch trần cao cấp và lắp đặt hoàn thiện' },
              { code: 'projects_mechanical', name: '↳ Sắt mỹ thuật & Cơ khí', desc: 'Gia công hàn cắt sắt mỹ nghệ, xưởng sỹ mạ cơ khí Hoàng Long' },
              { code: 'tasks', name: '↳ Nhiệm vụ & Tiến độ công việc', desc: 'Phân chia tác vụ việc làm, tiến độ thợ nhật thầu khoán liên thông' }
            ]
          },
          {
            department: 'PHÒNG NHÂN SỰ',
            color: 'border-orange-500/20 text-orange-400 bg-orange-500/5',
            modules: [
              { code: 'hr_office', name: 'Menu Cha: Phòng Nhân Sự', desc: 'Cổng thông tin nhân sự toàn công ty Hoàng Long Lâm Đồng' },
              { code: 'employees', name: '↳ Quản trị Nhân sự - Chấm công', desc: 'Quản lý thông tin hồ sơ lý lịch, máy chấm công vân tay, tự động tính bảng lương' },
              { code: 'hr_data', name: '↳ Dữ liệu nhân sự', desc: 'Lưu trữ hồ sơ số, hợp đồng lao động, quyết định bổ nhiệm và tài liệu nhân lực' }
            ]
          },
          {
            department: 'PHÒNG KẾ TOÁN',
            color: 'border-sky-500/20 text-sky-400 bg-sky-500/5',
            modules: [
              { code: 'accounting_office', name: 'Menu Cha: Phòng Kế Toán', desc: 'Nghiệp vụ tài chính kế toán, lập đề xuất chi tiền mặt và ngân hàng' },
              { code: 'finance', name: '↳ Tài chính - Kế toán', desc: 'Thống kê thu chi doanh nghiệp Hoàng Long Lâm Đồng' },
              { code: 'finance_data', name: '↳ Dữ Liệu Kế Toán', desc: 'Lịch sử giao dịch sao kê ngân hàng, hóa đơn chứng từ, phiếu thu phiếu chi' }
            ]
          },
          {
            department: 'KHO & VẬT TƯ',
            color: 'border-teal-500/20 text-teal-400 bg-teal-500/5',
            modules: [
              { code: 'warehouse_office', name: 'Menu Cha: Kho & Vật Tư', desc: 'Theo dõi chuỗi cung ứng vật tư gỗ, sắt thép, đá tự nhiên và phụ kiện' },
              { code: 'material_coordination', name: '↳ Điều phối vật tư', desc: 'Yêu cầu cấp phát vật tư công trình thầu phụ, điều chuyển và nghiệm thu thực tế' },
              { code: 'warehouse_suppliers', name: '↳ Nhà cung cấp vật tư', desc: 'Danh sách và đánh giá năng lực các đơn vị cung ứng vật tư xây dựng mộc cơ khí' },
              { code: 'warehouse_management', name: '↳ Quản lý tồn kho', desc: 'Nhập kho nguyên liệu, xuất kho chế biến và báo cáo kiểm kho định kỳ' }
            ]
          },
          {
            department: 'PHÂN HỆ THẦU PHỤ',
            color: 'border-amber-500/20 text-amber-400 bg-amber-500/5',
            modules: [
              { code: 'subcontractor_office', name: 'Menu Cha: Thầu Phụ', desc: 'Điều hành các tổ thợ, cai thầu xây dựng dẻo dai' },
              { code: 'subcontractor_management', name: '↳ Quản Lý Thầu Phụ', desc: 'Hồ sơ thầu phụ, nghiệm thu khối lượng thi công thô gỗ cơ khí hoàn thiện' }
            ]
          },
          {
            department: 'THƯ VIỆN & BÁO GIÁ',
            color: 'border-blue-500/20 text-blue-400 bg-blue-500/5',
            modules: [
              { code: 'library_office', name: 'Menu Cha: Thư Viện', desc: 'Cơ sở dữ liệu biểu giá định mức dự toán của Hoàng Long Lâm Đồng' },
              { code: 'quotes_construction', name: '↳ Hồ Sơ Xây Dựng (Thư viện)', desc: 'Thư viện mẫu dự toán xây dựng công trình, thợ thầu thi công thô dẻo dai' },
              { code: 'quotes', name: '↳ Hồ Sơ Nội Thất (Thư viện)', desc: 'Thư viện báo giá mẫu mộc tủ bếp gỗ công nghiệp, gỗ tự nhiên cao cấp' },
              { code: 'quotes_mechanical', name: '↳ Hồ Sơ Cơ Khí (Thư viện)', desc: 'Thư viện mẫu báo giá sắt nghệ thuật, hàng rào, cổng ngõ mạ kẽm' },
              { code: 'quotes_subcontractor', name: '↳ Hồ Sơ Thầu Phụ (Thư viện)', desc: 'Thư viện định mức báo giá chi tiết của các tổ đội thợ liên thông' }
            ]
          },
          {
            department: 'QUẢN TRỊ HỆ THỐNG',
            color: 'border-slate-800 text-slate-300 bg-slate-900/40',
            modules: [
              { code: 'system_office', name: 'Menu Cha: Quản Trị Hệ Thống', desc: 'Công cụ quản trị hệ thống ERP, phân quyền nhóm vai trò' },
              { code: 'settings_accounts', name: '↳ Tài Khoản Hệ Thống', desc: 'Tạo mới, phân nhóm, thay đổi trạng thái và mật khẩu người dùng' },
              { code: 'settings_roles', name: '↳ Phân Quyền Và Vai Trò', desc: 'Thiết lập danh mục chức năng phân hệ, phân quyền Xem, Thêm, Sửa, Xóa' },
              { code: 'settings', name: '↳ Thiết lập & Bản đồ vách mộc', desc: 'Quy chế công tác phí, hệ số lương tăng ca, ngày nghỉ lễ của công ty' }
            ]
          }
        ];

        const modulesList = groupedModules.flatMap(g => g.modules);

        return (
          <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5 text-left">

            {/* Active role header */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div>
                <span className="text-[9px] bg-amber-500/10 text-amber-500 font-extrabold px-2 py-0.5 rounded border border-amber-500/20 uppercase tracking-wider">
                  Đang cấu hình
                </span>
                <h4 className="font-extrabold text-sm text-white mt-1 flex items-center gap-2">
                  {activeRole.name}
                </h4>
                <p className="text-[10.5px] text-slate-405 mt-1">
                  {activeRole.description || 'Chưa có mô tả cho nhóm vai trò này.'}
                </p>
              </div>

              {/* Tab Selector inside Detail */}
              <div className="flex gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setRoleGroupTab('permissions')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${roleGroupTab === 'permissions' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-white bg-transparent'}`}
                >
                  1. Chi tiết phân quyền
                </button>
                <button
                  type="button"
                  onClick={() => setRoleGroupTab('members')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${roleGroupTab === 'members' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-white bg-transparent'}`}
                >
                  2. Thành viên nhóm ({activeRole.memberIds.length})
                </button>
              </div>
            </div>

            {/* TAB 1: PERMISSION MATRIX */}
            {roleGroupTab === 'permissions' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex justify-between items-center text-[10.5px]">
                  <span className="text-slate-400 italic">
                    * Tích chọn để cấp quyền thao tác trực tiếp trên từng phân hệ ERP. Thay đổi tự động lưu lại.
                  </span>

                  <div className="flex gap-2">
                    {!isAdmin && <>
                      <button
                        type="button"
                        onClick={() => {
                          const updatedRoles = draftRoles.map(r => {
                            if (r.id === activeRole.id) {
                              const newPerms = { ...r.permissions };
                              modulesList.forEach(m => {
                                newPerms[m.code] = { view: true, create: true, edit: true, delete: true };
                              });
                              return { ...r, permissions: newPerms };
                            }
                            return r;
                          });
                          setDraftRoles(updatedRoles);
                        }}
                        className="text-amber-500 hover:text-amber-400 font-bold cursor-pointer"
                      >
                        Chọn tất cả
                      </button>
                      <span className="text-slate-700">|</span>
                      <button
                        type="button"
                        onClick={() => {
                          const updatedRoles = draftRoles.map(r => {
                            if (r.id === activeRole.id) {
                              const newPerms = { ...r.permissions };
                              modulesList.forEach(m => {
                                newPerms[m.code] = { view: false, create: false, edit: false, delete: false };
                              });
                              return { ...r, permissions: newPerms };
                            }
                            return r;
                          });
                          setDraftRoles(updatedRoles);
                        }}
                        className="text-slate-400 hover:text-slate-300 font-bold cursor-pointer"
                      >
                        Bỏ chọn hết
                      </button>
                    </>}
                  </div>
                </div>

                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                      <thead>
                        <tr className="bg-slate-900 border-b border-slate-800 text-slate-400">
                          <th className="p-3 font-bold font-sans">Tên phân hệ hệ thống</th>
                          <th className="p-3 font-bold font-sans text-center w-24">Xem (View)</th>
                          <th className="p-3 font-bold font-sans text-center w-24">Thêm (Create)</th>
                          <th className="p-3 font-bold font-sans text-center w-24">Sửa (Edit)</th>
                          <th className="p-3 font-bold font-sans text-center w-24">Xóa (Delete)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {modulesList.map(m => {
                          const perm = activeRole.permissions[m.code] || { view: false, create: false, edit: false, delete: false };

                          const togglePerm = (action: 'view' | 'create' | 'edit' | 'delete') => {
                            // Admin luôn full quyền — không cho toggle
                            if (isAdmin) return;
                            const updatedRoles = draftRoles.map(r => {
                              if (r.id === activeRole.id) {
                                const currentPerms = r.permissions[m.code] || { view: false, create: false, edit: false, delete: false };
                                const nextPerms = {
                                  ...r.permissions,
                                  [m.code]: {
                                    ...currentPerms,
                                    [action]: !currentPerms[action]
                                  }
                                };
                                return { ...r, permissions: nextPerms };
                              }
                              return r;
                            });
                            setDraftRoles(updatedRoles);
                          };

                          const isSub = m.name.trim().startsWith('↳');
                          return (
                            <tr key={m.code} className="hover:bg-slate-900/40 transition-colors">
                              <td className={`p-3 ${isSub ? 'pl-10' : ''}`}>
                                <div className={`font-bold ${isSub ? 'text-slate-300 font-medium' : 'text-white'} text-[12px]`}>{m.name}</div>
                                <div className="text-[10px] text-slate-450 mt-0.5 leading-tight">{m.desc}</div>
                              </td>
                              <td className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isAdmin || perm.view}
                                  disabled={isAdmin}
                                  onChange={() => togglePerm('view')}
                                  className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-amber-500 focus:ring-amber-500 accent-amber-500 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                />
                              </td>
                              <td className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isAdmin || perm.create}
                                  disabled={isAdmin}
                                  onChange={() => togglePerm('create')}
                                  className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-amber-500 focus:ring-amber-500 accent-amber-500 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                />
                              </td>
                              <td className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isAdmin || perm.edit}
                                  disabled={isAdmin}
                                  onChange={() => togglePerm('edit')}
                                  className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-amber-500 focus:ring-amber-500 accent-amber-500 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                />
                              </td>
                              <td className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isAdmin || perm.delete}
                                  disabled={isAdmin}
                                  onChange={() => togglePerm('delete')}
                                  className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-amber-500 focus:ring-amber-500 accent-amber-500 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: MEMBERS IN THE ROLE */}
            {roleGroupTab === 'members' && (
              <div className="space-y-4 animate-fadeIn">

                <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl space-y-3 relative">
                  <h5 className="font-extrabold text-[10px] text-amber-500 uppercase tracking-wider">
                    Thêm nhân viên mới vào nhóm vai trò
                  </h5>

                  <div className="relative w-full" id="role-member-multiselect">
                    {/* Control bar / Dropdown header */}
                    <div
                      onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none font-sans font-bold cursor-pointer flex justify-between items-center hover:border-slate-700 transition-all select-none min-h-[38px] flex-wrap gap-1.5"
                    >
                      {selectedTempEmpIds.length === 0 ? (
                        <span className="text-slate-400">
                          -- Nhấn vào để tìm kiếm và chọn nhân viên gán vào nhóm này --
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1 items-center max-w-[90%]">
                          {selectedTempEmpIds.map(empId => {
                            const emp = employees.find(e => e.id === empId);
                            return (
                              <span
                                key={empId}
                                className="bg-amber-500/10 text-amber-500 font-bold px-2 py-0.5 rounded-md border border-amber-500/20 text-[10px] flex items-center gap-1 shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTempEmpIds(prev => prev.filter(id => id !== empId));
                                }}
                              >
                                {emp ? emp.name : empId}
                                <span className="text-[9px] hover:text-red-400 font-extrabold cursor-pointer ml-1">×</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                      <div className="flex items-center gap-2 shrink-0 ml-auto">
                        {selectedTempEmpIds.length > 0 && (
                          <span className="text-[10px] bg-amber-500 text-slate-950 font-bold px-1.5 py-0.5 rounded-full">
                            {selectedTempEmpIds.length}
                          </span>
                        )}
                        <span className="text-slate-400 text-[10px]">▼</span>
                      </div>
                    </div>

                    {/* Dropdown list popover */}
                    {isRoleDropdownOpen && (
                      <div className="absolute left-0 right-0 mt-1.5 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl z-50 p-3 space-y-2.5 max-h-80 overflow-y-auto flex flex-col">
                        {/* Inline Search Input */}
                        <div className="relative sticky top-0 bg-slate-900 pb-1 shrink-0 z-10">
                          <input
                            type="text"
                            placeholder="Tìm kiếm theo Mã NV, Tên, Phòng ban, Chức vụ..."
                            value={roleSearchQuery}
                            onChange={(e) => setRoleSearchQuery(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 pl-8 text-xs text-white outline-none placeholder-slate-500 focus:border-slate-700 transition-all font-sans font-bold"
                            autoFocus
                          />
                          <span className="absolute left-2.5 top-2.5 text-slate-550">🔍</span>
                          {roleSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setRoleSearchQuery('')}
                              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white text-xs bg-transparent border-none cursor-pointer font-bold"
                            >
                              Xóa
                            </button>
                          )}
                        </div>

                        {/* Dropdown Options List */}
                        <div className="space-y-1 overflow-y-auto max-h-48 pr-1 flex-1">
                          {(() => {
                            const availableEmployees = employees.filter(emp => !activeRole.memberIds.includes(emp.id));
                            const filtered = availableEmployees.filter(emp => {
                              const query = roleSearchQuery.toLowerCase();
                              return (
                                emp.id.toLowerCase().includes(query) ||
                                emp.name.toLowerCase().includes(query) ||
                                (emp.department || '').toLowerCase().includes(query) ||
                                (emp.position || '').toLowerCase().includes(query)
                              );
                            });

                            if (filtered.length === 0) {
                              return (
                                <div className="text-center py-4 text-xs text-slate-500 italic">
                                  Không tìm thấy nhân viên nào phù hợp
                                </div>
                              );
                            }

                            return filtered.map(emp => {
                              const isChecked = selectedTempEmpIds.includes(emp.id);
                              const existingRole = roles.find(r => r.memberIds.includes(emp.id));

                              return (
                                <div
                                  key={emp.id}
                                  onClick={() => {
                                    if (isChecked) {
                                      setSelectedTempEmpIds(prev => prev.filter(id => id !== emp.id));
                                    } else {
                                      setSelectedTempEmpIds(prev => [...prev, emp.id]);
                                    }
                                  }}
                                  className={`flex items-start gap-3 p-2 rounded-md cursor-pointer transition-all ${
                                    isChecked ? 'bg-amber-500/10 border-amber-500/20' : 'hover:bg-slate-800/60'
                                  } border border-transparent`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {}}
                                    className="mt-0.5 rounded accent-amber-500 cursor-pointer h-3.5 w-3.5 shrink-0"
                                  />
                                  <div className="flex-1 min-w-0 text-left">
                                    <div className="flex justify-between items-center flex-wrap gap-1.5">
                                      <span className="text-xs font-bold text-white font-sans">
                                        {emp.name} <span className="text-slate-550 font-mono text-[10px]">({emp.id})</span>
                                      </span>
                                      {existingRole && (
                                        <span className="text-[9px] bg-slate-850 border border-slate-800 text-slate-400 font-extrabold px-1.5 py-0.5 rounded">
                                          Thuộc: {existingRole.name}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                      {emp.position} — {emp.department}
                                    </p>
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>

                        {/* Actions inside list */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-800 sticky bottom-0 bg-slate-900 shrink-0">
                          <div className="text-[10px] text-slate-400 font-bold">
                            Đã chọn: <span className="text-amber-500">{selectedTempEmpIds.length}</span> nhân sự
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedTempEmpIds([])}
                              className="px-2.5 py-1 text-[10.5px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-md cursor-pointer transition-all"
                            >
                              Bỏ chọn tất cả
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsRoleDropdownOpen(false)}
                              className="px-2.5 py-1 text-[10.5px] bg-slate-950 hover:bg-slate-850 text-slate-400 font-bold rounded-md cursor-pointer transition-all border border-slate-800"
                            >
                              Đóng
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Multi-add confirmation bar */}
                  {selectedTempEmpIds.length > 0 && (
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl gap-2 animate-fadeIn">
                      <div className="text-[10.5px] text-amber-500 font-bold">
                        👉 Sẵn sàng gán <span className="underline">{selectedTempEmpIds.length}</span> nhân sự mới vào nhóm <span className="text-white">"{activeRole.name}"</span>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-end">
                        <button
                          type="button"
                          onClick={() => setSelectedTempEmpIds([])}
                          className="px-3 py-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-slate-400 font-bold rounded-lg cursor-pointer transition-all"
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const cleanedRoles = draftRoles.map(r => ({
                              ...r,
                              memberIds: r.memberIds.filter(id => !selectedTempEmpIds.includes(id))
                            }));

                            const updatedRoles = cleanedRoles.map(r => {
                              if (r.id === activeRole.id) {
                                return { ...r, memberIds: [...r.memberIds, ...selectedTempEmpIds] };
                              }
                              return r;
                            });

                            setDraftRoles(updatedRoles);
                            setSelectedTempEmpIds([]);
                            setIsRoleDropdownOpen(false);
                          }}
                          className="px-4 py-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-lg cursor-pointer transition-all shadow-md"
                        >
                          Gán ngay
                        </button>
                      </div>
                    </div>
                  )}

                  <p className="text-[9.5px] text-slate-500 italic">
                    * Nhân viên chỉ có thể thuộc tối đa một nhóm vai trò phân quyền. Gán vào nhóm mới sẽ tự động hủy gán ở nhóm cũ.
                  </p>
                </div>

                <div className="border border-slate-800 rounded-xl overflow-x-auto bg-slate-950">
                  <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800 text-slate-400">
                        <th className="p-3 font-bold font-sans w-20">Mã NV</th>
                        <th className="p-3 font-bold font-sans">Họ và tên</th>
                        <th className="p-3 font-bold font-sans">Phòng ban</th>
                        <th className="p-3 font-bold font-sans">Chức vụ</th>
                        <th className="p-3 font-bold font-sans text-center w-24">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {activeRole.memberIds.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-500 italic">
                            Nhóm vai trò này hiện chưa có nhân sự nào trực thuộc. Hãy gán thành viên ở trên.
                          </td>
                        </tr>
                      ) : (
                        activeRole.memberIds.map(empId => {
                          const emp = employees.find(e => e.id === empId);
                          if (!emp) {
                            return (
                              <tr key={empId} className="hover:bg-slate-900/40 transition-colors">
                                <td className="p-3 font-mono text-slate-500">{empId}</td>
                                <td colSpan={3} className="p-3 text-slate-500 italic">Hồ sơ đã bị xóa hoặc không tồn tại</td>
                                <td className="p-3 text-center">
                                  {confirmRemoveMember && confirmRemoveMember.roleId === activeRole.id && confirmRemoveMember.empId === empId ? (
                                    <div className="flex items-center justify-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = draftRoles.map(r => {
                                            if (r.id === activeRole.id) {
                                              return { ...r, memberIds: r.memberIds.filter(id => id !== empId) };
                                            }
                                            return r;
                                          });
                                          setDraftRoles(updated);
                                          setConfirmRemoveMember(null);
                                        }}
                                        className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] rounded cursor-pointer transition-all"
                                      >
                                        Xác nhận
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmRemoveMember(null)}
                                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] rounded cursor-pointer transition-all"
                                      >
                                        Hủy
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmRemoveMember({ roleId: activeRole.id, empId: empId })}
                                      className="text-red-400 hover:text-red-300 font-bold cursor-pointer bg-transparent border-none"
                                    >
                                      Gỡ bỏ
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          }

                          return (
                            <tr key={emp.id} className="hover:bg-slate-900/40 transition-colors">
                              <td className="p-3 font-mono font-bold text-amber-500">{emp.id}</td>
                              <td className="p-3 font-bold text-white">{emp.name}</td>
                              <td className="p-3 text-slate-400">{emp.department}</td>
                              <td className="p-3 text-slate-300 font-medium">{emp.position}</td>
                              <td className="p-3 text-center">
                                {confirmRemoveMember && confirmRemoveMember.roleId === activeRole.id && confirmRemoveMember.empId === emp.id ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = draftRoles.map(r => {
                                          if (r.id === activeRole.id) {
                                            return { ...r, memberIds: r.memberIds.filter(id => id !== emp.id) };
                                          }
                                          return r;
                                        });
                                        setDraftRoles(updated);
                                        setConfirmRemoveMember(null);
                                      }}
                                      className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] rounded cursor-pointer transition-all"
                                    >
                                      Xác nhận
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmRemoveMember(null)}
                                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] rounded cursor-pointer transition-all"
                                    >
                                      Hủy
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmRemoveMember({ roleId: activeRole.id, empId: emp.id })}
                                    className="text-rose-450 hover:text-rose-400 font-bold hover:underline cursor-pointer bg-transparent border-none"
                                  >
                                    Gỡ bỏ
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        );
      })()}

      {/* TOP TAB: QUYỀN DỰ ÁN (độc lập, không phụ thuộc Nhóm Vai Trò) */}
      {roleMainTab === 'task' && (
        <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5 text-left">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
            <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-500" /> Cấu hình Quyền Dự Án
            </h4>
            <p className="text-[10.5px] text-slate-400 mt-1">
              Ma trận cấu hình quyền cho 12 vai trò trong dự án (PM, Assigner, Assignee, Thầu phụ...). Đây là cấu hình TOÀN CỤC (không phụ thuộc Nhóm Vai Trò). Mỗi ô = vai trò đó có được thực hiện hành động đó không. Nhấp trực tiếp vào ô để bật/tắt.
            </p>
          </div>
          <ProjectPermissionModal
            isOpen={true}
            onClose={() => setRoleMainTab('group')}
            onSave={onSaveProjectPermissions}
            mode="inline"
            value={draftMatrix}
            onChange={setDraftMatrix}
          />
        </div>
      )}

      {/* TOP TAB: QUYỀN PHÊ DUYỆT (độc lập, không phụ thuộc Nhóm Vai Trò) */}
      {roleMainTab === 'approval' && (
        <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5 text-left">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
            <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-sky-500" /> Cấu hình Quyền Phê Duyệt
            </h4>
            <p className="text-[10.5px] text-slate-400 mt-1">
              Đây là cấu hình TOÀN CỤC (không phụ thuộc Nhóm Vai Trò). Chỉ định người có quyền duyệt các hồ sơ Báo Giá, Hợp Đồng, Nghiệm Thu, Thanh Lý và người xét duyệt cho Đơn Xin Nghỉ Phép, Tạm Ứng Lương Nhanh. Thông tin này sẽ hiển thị tự động trong biểu mẫu tương ứng.
            </p>
          </div>

          <div className="space-y-6">
              {/* HỒ SƠ DỰ ÁN */}
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <div className="bg-violet-500/10 px-4 py-2.5 border-b border-slate-800">
                  <h5 className="font-extrabold text-[11px] text-violet-400 uppercase tracking-wider">Hồ Sơ Dự Án</h5>
                </div>
                <div className="divide-y divide-slate-850">
                  {approvalDocumentTypes.filter(t => t.group === 'Hồ Sơ Dự Án').map(t => {
                    const perm = getCurrentApprovalPerm(t.type);
                    const enabled = !!perm?.canApprove;
                    return (
                      <div key={t.type} className="p-4 bg-slate-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(e) => handleToggleApproval(t.type as ApprovalPermission['documentType'], t.label, e.target.checked)}
                            className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-sky-500 focus:ring-sky-500 accent-sky-500 cursor-pointer"
                          />
                          <span className="font-bold text-xs text-white">{t.label}</span>
                        </div>
                        {enabled && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400">Người duyệt:</span>
                            <select
                              value={perm?.approverId || ''}
                              onChange={(e) => {
                                const emp = employees.find(em => em.id === e.target.value);
                                handleChangeApprover(t.type as ApprovalPermission['documentType'], e.target.value, emp?.name || '', emp?.position);
                              }}
                              className="bg-slate-950 border border-slate-800 rounded p-1.5 text-white text-xs min-w-[180px]"
                            >
                              {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name} ({emp.position})</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* HỒ SƠ NHÂN SỰ */}
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <div className="bg-orange-500/10 px-4 py-2.5 border-b border-slate-800">
                  <h5 className="font-extrabold text-[11px] text-orange-400 uppercase tracking-wider">Hồ Sơ Nhân Sự</h5>
                </div>
                <div className="divide-y divide-slate-850">
                  {approvalDocumentTypes.filter(t => t.group === 'Hồ Sơ Nhân Sự').map(t => {
                    const perm = getCurrentApprovalPerm(t.type);
                    const enabled = !!perm?.canApprove;
                    return (
                      <div key={t.type} className="p-4 bg-slate-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(e) => handleToggleApproval(t.type as ApprovalPermission['documentType'], t.label, e.target.checked)}
                            className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-sky-500 focus:ring-sky-500 accent-sky-500 cursor-pointer"
                          />
                          <span className="font-bold text-xs text-white">{t.label}</span>
                        </div>
                        {enabled && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400">Người xét duyệt:</span>
                            <select
                              value={perm?.approverId || ''}
                              onChange={(e) => {
                                const emp = employees.find(em => em.id === e.target.value);
                                handleChangeApprover(t.type as ApprovalPermission['documentType'], e.target.value, emp?.name || '', emp?.position);
                              }}
                              className="bg-slate-950 border border-slate-800 rounded p-1.5 text-white text-xs min-w-[180px]"
                            >
                              {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name} ({emp.position})</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className="text-[9.5px] text-slate-500 italic">
                * Trường "Người Xét Duyệt" trong Lập Đơn Nghỉ Phép & Chi Tiết Nhân Sự và "Người Duyệt" trong Đề Xuất Tạm Ứng Lương Nhân Sự sẽ hiển thị tên người được chỉ định ở đây và không cho phép sửa.
              </p>
          </div>
        </div>
      )}

      {/* ─── Save Action Bar ───────────────────────────────────────────────── */}
      <SaveActionBar
        changed={roleMainTab === 'group' ? groupChanged : roleMainTab === 'task' ? projectChanged : approvalChanged}
        onSave={roleMainTab === 'group' ? handleSaveGroup : roleMainTab === 'task' ? handleSaveProject : handleSaveApproval}
        onCancel={() => {
          if (roleMainTab === 'group') setDraftRoles([...roles]);
          else if (roleMainTab === 'task') setDraftMatrix(loadProjectPermissions());
          else setDraftApprovalConfig(loadApprovalConfig());
        }}
        onSetDefault={handleSetDefault}
        onRestoreDefault={handleRestoreDefault}
        hasDefault={!!getCurrentTabDefault()}
        accent={roleMainTab === 'task' ? 'emerald' : roleMainTab === 'approval' ? 'sky' : 'amber'}
      />
    </div>
  );
}
