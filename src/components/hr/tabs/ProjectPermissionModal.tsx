// ─── Project Permission Modal ───────────────────────────────────────────
// UI cấu hình ma trận "Quyền Dự Án" cho một role cụ thể (hoặc toàn hệ thống).
// Ma trận được trình bày theo SƠ ĐỒ CẤP MENU để người dùng dễ theo dõi:
//   Cấp Dự Án → Cột Kanban → Thẻ Dự Án → Công Việc → Nhiệm Vụ Con → ...
// Hỗ trợ 2 chế độ: 'modal' (overlay) hoặc 'inline' (trong tab Phân Quyền).

import React from 'react';
import { X, RotateCcw, Save, Shield, AlertTriangle, CheckCircle2, Eye, Users, FolderOpen, Columns, LayoutGrid, CheckSquare, ListTodo, DollarSign, FileText, Building2, MessageSquare, Paperclip, ArrowDownWideNarrow, UserCog } from 'lucide-react';
import {
  ProjectPermissionMatrix,
  ProjectAction,
  ProjectRoleScope,
  VisibilityMode,
  DEFAULT_PROJECT_PERMISSIONS,
  RoleGroupProjectMatrix,
  loadRoleGroupProjectMatrix,
  saveRoleGroupProjectMatrix,
} from '../hrProjectPermissions';
import { loadHrmRoleGroups } from '../../../context';

interface ProjectPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  roleId?: string;
  roleName?: string;
  onSave: (matrix: ProjectPermissionMatrix) => void;
  mode?: 'modal' | 'inline';
  value?: ProjectPermissionMatrix;
  onChange?: (matrix: ProjectPermissionMatrix) => void;
}

// Nhóm hành động theo cây menu (để hiển thị phân cấp)
const actionGroups: {
  group: string;
  icon: React.ReactNode;
  actions: { action: ProjectAction; label: string }[];
}[] = [
  {
    group: '🏗️ CẤP DỰ ÁN',
    icon: <FolderOpen className="w-4 h-4" />,
    actions: [
      { action: 'createProject', label: 'Tạo dự án mới' },
      { action: 'editProjectInfo', label: 'Sửa thông tin dự án' },
      { action: 'updateProjectStatus', label: 'Cập nhật trạng thái / % tiến độ' },
      { action: 'viewProjectFinance', label: 'Xem tài chính dự án' },
      { action: 'manageProjectDocs', label: 'Quản lý hồ sơ (BG/HĐ/NT/TL)' },
      { action: 'deleteProject', label: 'Xóa dự án' },
      { action: 'exportProject', label: 'Xuất dữ liệu dự án' },
      { action: 'quickAddCustomer', label: 'Thêm nhanh khách hàng' },
    ],
  },
  {
    group: '📋 CỘT KANBAN',
    icon: <Columns className="w-4 h-4" />,
    actions: [
      { action: 'createColumn', label: 'Tạo cột mới' },
      { action: 'editColumn', label: 'Sửa cột' },
      { action: 'deleteColumn', label: 'Xóa cột' },
      { action: 'arrangeColumn', label: 'Sắp xếp thứ tự cột' },
      { action: 'configureColumnAutomation', label: 'Cấu hình tự động hóa cột' },
    ],
  },
  {
    group: '🃏 THẺ DỰ ÁN',
    icon: <LayoutGrid className="w-4 h-4" />,
    actions: [
      { action: 'createCard', label: 'Tạo thẻ dự án' },
      { action: 'editCard', label: 'Sửa thẻ dự án' },
      { action: 'deleteCard', label: 'Xóa thẻ dự án' },
      { action: 'moveCard', label: 'Kéo thẻ qua cột' },
      { action: 'assignCardMember', label: 'Gán thành viên thẻ' },
    ],
  },
  {
    group: '✅ CÔNG VIỆC',
    icon: <CheckSquare className="w-4 h-4" />,
    actions: [
      { action: 'createTask', label: 'Tạo công việc' },
      { action: 'editTask', label: 'Sửa công việc' },
      { action: 'deleteTask', label: 'Xóa công việc' },
      { action: 'assignTask', label: 'Giao việc' },
      { action: 'receiveTask', label: 'Nhận việc' },
      { action: 'completeTask', label: 'Hoàn thành' },
      { action: 'approveResult', label: 'Duyệt kết quả' },
      { action: 'rejectResult', label: 'Từ chối duyệt' },
    ],
  },
  {
    group: '🧩 NHIỆM VỤ CON',
    icon: <ListTodo className="w-4 h-4" />,
    actions: [
      { action: 'createMission', label: 'Tạo nhiệm vụ con' },
      { action: 'editMission', label: 'Sửa nhiệm vụ con' },
      { action: 'deleteMission', label: 'Xóa nhiệm vụ con' },
      { action: 'assignMissionMainAssignee', label: 'Gán phụ trách chính' },
      { action: 'assignMissionMember', label: 'Gán thành viên nhiệm vụ' },
      { action: 'assignSubWorker', label: 'Gán thợ phụ' },
      { action: 'completeMission', label: 'Xác nhận hoàn thành' },
      { action: 'recordTravelAllowance', label: 'Ghi nhận công tác phí' },
    ],
  },
  {
    group: '👥 PHÂN CÔNG & THAM GIA',
    icon: <Users className="w-4 h-4" />,
    actions: [
      { action: 'assignMembers', label: 'Phân công người tham gia' },
      { action: 'addInvolved', label: 'Thêm người liên quan' },
      { action: 'removeInvolved', label: 'Xóa người liên quan' },
    ],
  },
  {
    group: '💰 TÀI CHÍNH',
    icon: <DollarSign className="w-4 h-4" />,
    actions: [
      { action: 'proposeAdvance', label: 'Đề xuất tạm ứng' },
      { action: 'settlePayment', label: 'Quyết toán thanh toán' },
      { action: 'viewFinanceLedger', label: 'Xem sổ cái thu chi' },
    ],
  },
  {
    group: '🚨 KỶ LUẬT',
    icon: <AlertTriangle className="w-4 h-4" />,
    actions: [
      { action: 'recordViolation', label: 'Ghi nhận vi phạm' },
      { action: 'issuePenalty', label: 'Lập phiếu phạt' },
    ],
  },
  {
    group: '🔗 HỒ SƠ LIÊN THÔNG',
    icon: <FileText className="w-4 h-4" />,
    actions: [
      { action: 'openToolApproval', label: 'Công cụ Phê duyệt' },
      { action: 'openToolCost', label: 'Công cụ Chi phí' },
      { action: 'openToolMaterial', label: 'Công cụ Vật tư' },
      { action: 'openToolQuotation', label: 'Công cụ Báo giá' },
      { action: 'openToolContract', label: 'Công cụ Hợp đồng' },
      { action: 'openToolAcceptance', label: 'Công cụ Nghiệm thu' },
      { action: 'openToolLiquidation', label: 'Công cụ Thanh lý' },
      { action: 'manageDocs', label: 'Quản lý hồ sơ liên thông' },
    ],
  },
  {
    group: '🗣️ BÌNH LUẬN & CHAT',
    icon: <MessageSquare className="w-4 h-4" />,
    actions: [
      { action: 'addComment', label: 'Thêm bình luận' },
      { action: 'deleteComment', label: 'Xóa bình luận' },
      { action: 'taskChat', label: 'Chat nội bộ công việc' },
    ],
  },
  {
    group: '📎 TỆP ĐÍNH KÈM',
    icon: <Paperclip className="w-4 h-4" />,
    actions: [
      { action: 'uploadAttachment', label: 'Tải lên tệp' },
      { action: 'deleteAttachment', label: 'Xóa tệp' },
    ],
  },
];

// Vai trò (cột của ma trận) — dựa trên vị trí dữ liệu thực tế trong UI
const roleScopeLabels: Record<ProjectRoleScope, { label: string; desc: string; color: string }> = {
  director: { label: 'Giám Đốc', desc: 'Role Group role_admin — luôn full quyền mọi dự án', color: 'text-violet-400 bg-violet-500/10' },
  pm: { label: 'Trưởng Dự Án', desc: 'project.pmId — người quản lý chính dự án', color: 'text-emerald-400 bg-emerald-500/10' },
  assigner: { label: 'Người Giao Việc', desc: 'task.assignerId — người khởi tạo & giao việc', color: 'text-sky-400 bg-sky-500/10' },
  assignee: { label: 'Phụ Trách CV', desc: 'task.assigneeId — phụ trách thực hiện công việc', color: 'text-amber-400 bg-amber-500/10' },
  missionAssignee: { label: 'Phụ Trách NV', desc: 'mission.mainAssigneeId — phụ trách nhiệm vụ con', color: 'text-teal-400 bg-teal-500/10' },
  involved: { label: 'Người Liên Quan', desc: 'project/task.involvedEmployeeIds — nhân sự hỗ trợ', color: 'text-cyan-400 bg-cyan-500/10' },
  accountant: { label: 'Kế Toán', desc: 'Role Group role_accounting — nhân viên kế toán', color: 'text-indigo-400 bg-indigo-500/10' },
  teamMember: { label: 'Thành Viên', desc: 'mission.memberIds — thành viên nhóm / fallback', color: 'text-slate-400 bg-slate-500/10' },
};

const VISIBILITY_OPTIONS: { value: VisibilityMode; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'related', label: 'Liên quan' },
  { value: 'readonly', label: 'Chỉ xem' },
];

export default function ProjectPermissionModal({ isOpen, onClose, roleId, roleName, onSave, mode = 'modal', value, onChange }: ProjectPermissionModalProps) {
  const [internalMatrix, setInternalMatrix] = React.useState<ProjectPermissionMatrix>(DEFAULT_PROJECT_PERMISSIONS);
  const [activeGroup, setActiveGroup] = React.useState<string | null>(null);
  const [rgTab, setRgTab] = React.useState<'context' | 'roleGroup'>('context');

  // HRM Role Group matrix state
  const [rgMatrix, setRgMatrix] = React.useState<RoleGroupProjectMatrix>(() => loadRoleGroupProjectMatrix());
  const hrmRoleGroups = React.useMemo(() => loadHrmRoleGroups(), []);

  const handleToggleRoleGroupAction = (groupId: string, action: ProjectAction) => {
    setRgMatrix(prev => {
      const current = prev.roleGroupActions[groupId] || [];
      const next = current.includes(action)
        ? current.filter(a => a !== action)
        : [...current, action];
      return { ...prev, roleGroupActions: { ...prev.roleGroupActions, [groupId]: next } };
    });
  };

  const handleSaveRoleGroup = async () => {
    await saveRoleGroupProjectMatrix(rgMatrix);
  };

  // Controlled vs uncontrolled: ưu tiên value prop nếu được truyền
  const matrix = value !== undefined ? value : internalMatrix;
  const setMatrix = React.useCallback((updater: ProjectPermissionMatrix | ((prev: ProjectPermissionMatrix) => ProjectPermissionMatrix)) => {
    const next = typeof updater === 'function' ? (updater as (prev: ProjectPermissionMatrix) => ProjectPermissionMatrix)(value !== undefined ? value : internalMatrix) : updater;
    if (value !== undefined) {
      onChange?.(next);
    } else {
      setInternalMatrix(next);
    }
  }, [value, internalMatrix, onChange]);

  // Load current matrix on open (chỉ khi uncontrolled)
  React.useEffect(() => {
    if (value !== undefined) return;
    try {
      const saved = localStorage.getItem('hl_project_permissions_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        setInternalMatrix({
          ...DEFAULT_PROJECT_PERMISSIONS,
          ...parsed,
          actions: { ...DEFAULT_PROJECT_PERMISSIONS.actions, ...(parsed.actions || {}) },
          visibility: { ...DEFAULT_PROJECT_PERMISSIONS.visibility, ...(parsed.visibility || {}) },
        });
      }
    } catch (e) {
      console.error('Load project permissions error:', e);
    }
  }, [isOpen, roleId, value]);

  const handleToggleAction = (action: ProjectAction, roleScope: ProjectRoleScope) => {
    setMatrix(prev => {
      const current = prev.actions[action] || [];
      const next = current.includes(roleScope)
        ? current.filter(r => r !== roleScope)
        : [...current, roleScope];
      return { ...prev, actions: { ...prev.actions, [action]: next } };
    });
  };

  const handleVisibilityChange = (roleScope: ProjectRoleScope, vis: VisibilityMode) => {
    setMatrix(prev => ({
      ...prev,
      visibility: { ...prev.visibility, [roleScope]: vis },
    }));
  };


  const handleResetToDefault = () => {
    setMatrix(DEFAULT_PROJECT_PERMISSIONS);
  };

  const handleSave = () => {
    const finalMatrix: ProjectPermissionMatrix = {
      ...matrix,
      version: 2,
      updatedBy: roleId || 'system',
      updatedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem('hl_project_permissions_v1', JSON.stringify(finalMatrix));
    } catch (e) {
      console.error('Save project permissions error:', e);
    }
    onSave(finalMatrix);
    onClose();
  };

  if (!isOpen) return null;

  const scopeKeys = Object.keys(roleScopeLabels).filter(k => k !== 'none') as ProjectRoleScope[];

  const allActions = actionGroups.flatMap(g => g.actions);

  const roleGroupTable = (
    <div className="w-full space-y-4 text-slate-200">
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
        <div className="flex items-center gap-2">
          <UserCog className="w-4 h-4 text-amber-400" />
          <span className="text-[10px] text-amber-300 font-bold">
            Phân quyền đặc biệt theo Nhóm Vai Trò HRM — Cho phép nhóm vai trò (vd: Nhân viên Kỹ thuật) được làm những hành động nào trong MỌI dự án.
          </span>
        </div>
        <p className="text-[10px] text-slate-400 mt-1.5">
          Quyền này ngoài quyền theo vị trí (PM, Assigner...). Nếu nhóm vai trò được cấp quyền ở đây → thành viên nhóm đó tự động có quyền trong mọi dự án.
        </p>
      </div>

      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800 text-slate-400">
                <th className="p-3 font-bold font-sans sticky left-0 bg-slate-900 z-10 min-w-[180px]">Nhóm vai trò HRM</th>
                {allActions.map(({ action, label }) => (
                  <th key={action} className="p-2 font-bold font-sans text-center min-w-[100px]" title={label}>
                    <span className="text-[9px] leading-tight block">{label.length > 12 ? label.substring(0, 12) + '…' : label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {hrmRoleGroups.map(rg => (
                <tr key={rg.id} className="hover:bg-slate-900/40 transition-colors">
                  <td className="p-3 font-bold text-white text-[11px] sticky left-0 bg-slate-950 z-10 border-r border-slate-800">
                    {rg.name}
                  </td>
                  {allActions.map(({ action }) => {
                    const isChecked = rgMatrix.roleGroupActions[rg.id]?.includes(action) || false;
                    return (
                      <td key={action} className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleRoleGroupAction(rg.id, action)}
                          disabled={rg.id === 'role_admin'}
                          className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-amber-500 focus:ring-amber-500 accent-amber-500 cursor-pointer mx-auto transition-transform hover:scale-110 disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
              {hrmRoleGroups.length === 0 && (
                <tr>
                  <td colSpan={allActions.length + 1} className="p-6 text-center text-slate-500 italic">
                    Chưa có nhóm vai trò HRM nào. Hãy tạo nhóm vai trò trong tab "Phân Quyền Và Vai Trò".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const table = (
    <div className="w-full space-y-4 text-slate-200">
      {/* Header info */}
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] text-emerald-300 font-bold">
              Ma trận Quyền Dự Án — 8 vai trò dự án × các hành động. Nhấp ô để bật/tắt quyền.
            </span>
          </div>
          <button
            onClick={handleResetToDefault}
            className="px-3 py-1.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Khôi phục mặc định
          </button>
        </div>


        {/* Cột Tầm nhìn */}
        <div className="mt-3">
          <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Tầm nhìn của từng vai trò dự án</span>
          {/* Chú thích tầm nhìn */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[9px] text-slate-400">
            <span><b className="text-emerald-400">Tất cả:</b> Xem & thao tác (theo quyền) với mọi dự án</span>
            <span><b className="text-sky-400">Liên quan:</b> Chỉ xem & thao tác dự án mình liên quan</span>
            <span><b className="text-slate-300">Chỉ xem:</b> Xem toàn bộ dự án, không được thao tác</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mt-2">
            {scopeKeys.map(key => (
              <div key={key} className="flex items-center justify-between gap-1 bg-slate-900 rounded-lg px-2 py-1 border border-slate-850">
                <span className={`text-[9px] font-bold ${roleScopeLabels[key].color} px-1.5 py-0.5 rounded`}>{roleScopeLabels[key].label}</span>
                <select
                  value={matrix.visibility[key] || 'related'}
                  onChange={(e) => handleVisibilityChange(key, e.target.value as VisibilityMode)}
                  className="bg-slate-800 text-[9px] text-slate-200 rounded border border-slate-700 px-1 py-0.5 outline-none cursor-pointer"
                >
                  {VISIBILITY_OPTIONS.map(v => (
                    <option key={v.value} value={v.value}>{v.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ma trận */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
          <thead>
            <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 sticky top-0 z-10">
              <th className="p-3 font-bold font-sans w-56">Hành động (theo cấp menu)</th>
              {scopeKeys.map(key => (
                <th key={key} className="p-3 font-bold font-sans text-center w-16" title={roleScopeLabels[key].desc}>
                  {roleScopeLabels[key].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-850">
            {actionGroups.map(group => (
              <React.Fragment key={group.group}>
                <tr className="bg-slate-950/60">
                  <td colSpan={scopeKeys.length + 1} className="p-2 px-3">
                    <button
                      onClick={() => setActiveGroup(activeGroup === group.group ? null : group.group)}
                      className="w-full flex items-center gap-1.5 text-[10px] text-emerald-400 font-extrabold uppercase tracking-wider hover:text-emerald-300 transition-colors"
                    >
                      {group.icon} {group.group}
                      <span className="ml-auto text-slate-600">{activeGroup === group.group ? '▾' : '▸'}</span>
                    </button>
                  </td>
                </tr>
                {(activeGroup === null || activeGroup === group.group) && group.actions.map(({ action, label }) => (
                  <tr key={action} className="hover:bg-slate-900/40 transition-colors">
                    <td className="p-3 font-medium text-slate-300 text-[11px]">{label}</td>
                    {scopeKeys.map(roleScopeKey => (
                      <td key={roleScopeKey} className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={matrix.actions[action]?.includes(roleScopeKey as ProjectRoleScope) || false}
                          onChange={() => handleToggleAction(action, roleScopeKey as ProjectRoleScope)}
                          className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-emerald-500 focus:ring-emerald-500 accent-emerald-500 cursor-pointer mx-auto transition-transform hover:scale-110"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {mode !== 'inline' && (
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg cursor-pointer transition-all"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-lg cursor-pointer transition-all shadow-md flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" /> Lưu cấu hình
          </button>
        </div>
      )}
    </div>
  );

  const content = rgTab === 'context' ? table : roleGroupTable;

  if (mode === 'inline') {
    return (
      <>
        {/* Tab selector inline */}
        <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 w-fit mb-4">
          <button
            type="button"
            onClick={() => setRgTab('context')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 ${rgTab === 'context' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white bg-transparent'}`}
          >
            <Shield className="w-3 h-3" /> Theo vị trí trong dự án
          </button>
          <button
            type="button"
            onClick={() => setRgTab('roleGroup')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 ${rgTab === 'roleGroup' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-white bg-transparent'}`}
          >
            <UserCog className="w-3 h-3" /> Vai trò nhóm HRM
          </button>
        </div>

        {/* Nút lưu riêng cho role group matrix */}
        {rgTab === 'roleGroup' && (
          <div className="flex justify-end mb-3">
            <button
              type="button"
              onClick={handleSaveRoleGroup}
              className="px-4 py-1.5 text-xs bg-amber-600 hover:bg-amber-550 text-white font-extrabold rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Save className="w-3 h-3" /> Lưu quyền nhóm HRM
            </button>
          </div>
        )}
        {content}
      </>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-[100] p-4 overflow-y-auto animate-fade-in">
      <div className="w-full max-w-6xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden transform transition-all duration-300 scale-100">
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/50 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-amber-500" />
            <div>
              <h3 className="font-extrabold text-white text-sm uppercase tracking-wider">CẤU HÌNH QUYỀN DỰ ÁN</h3>
              <p className="text-[10px] text-slate-400">Ma trận quyền theo 8 vai trò dự án</p>
            </div>
          </div>
          {/* Tab selector trong modal */}
          <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setRgTab('context')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 ${rgTab === 'context' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white bg-transparent'}`}
            >
              <Shield className="w-3 h-3" /> Theo vị trí
            </button>
            <button
              type="button"
              onClick={() => setRgTab('roleGroup')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 ${rgTab === 'roleGroup' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-white bg-transparent'}`}
            >
              <UserCog className="w-3 h-3" /> Nhóm HRM
            </button>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {rgTab === 'roleGroup' && (
            <div className="flex justify-end mb-3 gap-2">
              <button
                type="button"
                onClick={handleSaveRoleGroup}
                className="px-4 py-1.5 text-xs bg-amber-600 hover:bg-amber-550 text-white font-extrabold rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <Save className="w-3 h-3" /> Lưu quyền nhóm HRM
              </button>
            </div>
          )}
          {content}
        </div>
      </div>
    </div>
  );
}
