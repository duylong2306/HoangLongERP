// ─── Task Permission Modal ──────────────────────────────────────────
// UI cấu hình Task Permission Matrix cho một role cụ thể
// Hỗ trợ 2 chế độ: 'modal' (overlay) hoặc 'inline' (trong tab)

import React from 'react';
import { X, RotateCcw, Save, Shield, AlertTriangle, CheckCircle2, DollarSign, FileText, Users, Settings, Eye } from 'lucide-react';
import { TaskPermissionMatrix, TaskAction, RoleScope, DEFAULT_TASK_PERMISSIONS } from '../hrTaskPermissions';

interface TaskPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  roleId: string;
  roleName: string;
  onSave: (matrix: TaskPermissionMatrix) => void;
  mode?: 'modal' | 'inline';
}

export default function TaskPermissionModal({ isOpen, onClose, roleId, roleName, onSave, mode = 'modal' }: TaskPermissionModalProps) {
  if (!isOpen) return null;

  const [matrix, setMatrix] = React.useState<TaskPermissionMatrix>(DEFAULT_TASK_PERMISSIONS);

  // Load current matrix for this role from localStorage on open
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('hl_task_permissions_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Check if there's role-specific override
        const roleSpecific = parsed.roles?.[roleId];
        if (roleSpecific) {
          setMatrix(roleSpecific);
        } else {
          setMatrix({
            actions: { ...DEFAULT_TASK_PERMISSIONS.actions, ...(parsed.actions || {}) },
          });
        }
      }
    } catch (e) {
      console.error('Load task permissions error:', e);
    }
  }, [isOpen, roleId]);

  // Action groups for better UX
  const actionGroups: { group: string; icon: React.ReactNode; actions: TaskAction[] }[] = [
    { group: '👁️ XEM', icon: <Eye className="w-4 h-4" />, actions: ['view'] },
    { group: '📥 NHẬN & HOÀN THÀNH', icon: <CheckCircle2 className="w-4 h-4" />, actions: ['receiveTask', 'completeTask'] },
    { group: '✔️ DUYỆT & TỪ CHỐI', icon: <Shield className="w-4 h-4" />, actions: ['approveResult', 'rejectResult'] },
    { group: '👥 PHÂN CÔNG', icon: <Users className="w-4 h-4" />, actions: ['assignMembers', 'assignSubWorkers'] },
    { group: '🚨 KỶ LUẬT & HIỆU SUẤT', icon: <AlertTriangle className="w-4 h-4" />, actions: ['recordViolation', 'issuePenalty'] },
    { group: '💰 TÀI CHÍNH', icon: <DollarSign className="w-4 h-4" />, actions: ['proposeAdvance', 'settlePayment'] },
    { group: '📋 HỒ SƠ & QUẢN LÝ', icon: <FileText className="w-4 h-4" />, actions: ['manageDocs', 'editTask', 'deleteTask', 'manageSubTask'] },
  ];

  // RoleScope labels
  const roleScopeLabels: Record<RoleScope, { label: string; desc: string; color: string }> = {
    director: { label: 'Giám Đốc', desc: 'Quyền cao nhất, luôn full quyền mọi công việc', color: 'text-violet-400 bg-violet-500/10' },
    pm: { label: 'Trưởng Dự Án', desc: 'Người quản lý & chịu trách nhiệm chính dự án (project.pmId)', color: 'text-emerald-400 bg-emerald-500/10' },
    assigner: { label: 'Người Giao Việc', desc: 'Người khởi tạo & giao công việc (task.assignerId)', color: 'text-sky-400 bg-sky-500/10' },
    assignee: { label: 'Phụ Trách Công Việc', desc: 'Phụ Trách Công Việc chịu trách nhiệm toàn bộ công việc (task.assigneeId)', color: 'text-amber-400 bg-amber-500/10' },
    missionAssignee: { label: 'Phụ Trách Nhiệm Vụ', desc: 'Phụ Trách Nhiệm Vụ thực hiện nhiệm vụ con (task.missions[].mainAssigneeId)', color: 'text-orange-400 bg-orange-500/10' },
    involved: { label: 'Người Tham Gia', desc: 'Nhân sự hỗ trợ liên quan (task.involvedEmployeeIds)', color: 'text-teal-400 bg-teal-500/10' },
    accountant: { label: 'Kế Toán', desc: 'Nhân viên kế toán phụ trách thu chi (role === accountant)', color: 'text-sky-400 bg-sky-500/10' },
    none: { label: 'Không Liên Quan', desc: 'Không có quyền mặc định với công việc này', color: 'text-slate-500 bg-slate-500/10' },
  };

  const handleToggleAction = (action: TaskAction, roleScope: RoleScope) => {
    setMatrix(prev => {
      const current = prev.actions[action] || [];
      const next = current.includes(roleScope)
        ? current.filter(r => r !== roleScope)
        : [...current, roleScope];
      return { ...prev, actions: { ...prev.actions, [action]: next } };
    });
  };

  const handleResetToDefault = () => {
    setMatrix(DEFAULT_TASK_PERMISSIONS);
  };

  const handleSave = () => {
    // Save role-specific override
    try {
      const saved = localStorage.getItem('hl_task_permissions_v1');
      const base = saved ? JSON.parse(saved) : { actions: DEFAULT_TASK_PERMISSIONS.actions, roles: {} };
      base.roles = base.roles || {};
      base.roles[roleId] = matrix;
      localStorage.setItem('hl_task_permissions_v1', JSON.stringify(base));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('hl-task-permissions-updated'));
    } catch (e) {
      console.error('Save task permissions error:', e);
    }
    onSave(matrix);
    onClose();
  };

  return mode === 'inline' ? (
    /* ─── INLINE MODE (trong tab) ────────────────────────────────────── */
    <div className="w-full space-y-4 text-slate-200">
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] text-emerald-300 font-bold">
              Quyền "Xem" và các thao tác được cấu hình thống nhất trong cùng một ma trận
            </span>
          </div>
          <button
            onClick={handleResetToDefault}
            className="px-3 py-1.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Khôi phục mặc định
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 sticky top-0 z-10">
                <th className="p-3 font-bold font-sans w-48">Hành động</th>
                {Object.keys(roleScopeLabels).filter(k => k !== 'none').map(key => (
                  <th key={key} className="p-3 font-bold font-sans text-center w-20" title={roleScopeLabels[key as RoleScope].desc}>
                    {roleScopeLabels[key as RoleScope].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {actionGroups.map(group => (
                <React.Fragment key={group.group}>
                  <tr className="bg-slate-950/50">
                    <td colSpan={Object.keys(roleScopeLabels).length} className="p-2 px-3">
                      <span className="text-[9px] text-emerald-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                        {group.icon} {group.group}
                      </span>
                    </td>
                  </tr>
                  {group.actions.map(action => (
                    <tr key={action} className="hover:bg-slate-900/40 transition-colors">
                      <td className="p-3 font-medium text-slate-300 text-[11px]">
                        {action.charAt(0).toUpperCase() + action.slice(1).replace(/([A-Z])/g, ' $1')}
                      </td>
                      {Object.keys(roleScopeLabels).filter(k => k !== 'none').map(roleScopeKey => (
                        <td key={roleScopeKey} className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={matrix.actions[action]?.includes(roleScopeKey as RoleScope) || false}
                            onChange={() => handleToggleAction(action, roleScopeKey as RoleScope)}
                            className="w-4.5 h-4.5 rounded border-slate-800 bg-slate-950 text-emerald-500 focus:ring-emerald-500 accent-emerald-500 cursor-pointer mx-auto transition-transform hover:scale-110"
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
      </div>

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
    </div>
  ) : (
    /* ─── MODAL MODE (overlay, mặc định) ──────────────────────────────── */
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-[100] p-4 overflow-y-auto animate-fade-in">
      <div className="w-full max-w-6xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden transform transition-all duration-300 scale-100">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/50 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-amber-500" />
            <div>
              <h3 className="font-extrabold text-white text-sm uppercase tracking-wider">CẤU HÌNH QUYỀN CÔNG VIỆC</h3>
              <p className="text-[10px] text-slate-400">Nhóm vai trò: <span className="text-amber-400 font-bold">{roleName}</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">

          {/* ACTION MATRIX (bao gồm quyền Xem trong matrix) */}
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <span className="text-[10px] text-emerald-300 font-bold">Quyền "Xem" và các thao tác được cấu hình thống nhất trong cùng một ma trận</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleResetToDefault}
                    className="px-3 py-1.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Khôi phục mặc định
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 sticky top-0 z-10">
                      <th className="p-3 font-bold font-sans w-48">Hành động</th>
                      {Object.keys(roleScopeLabels).filter(k => k !== 'none').map(key => (
                        <th key={key} className="p-3 font-bold font-sans text-center w-20" title={roleScopeLabels[key as RoleScope].desc}>
                          {roleScopeLabels[key as RoleScope].label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {actionGroups.map(group => (
                      <React.Fragment key={group.group}>
                        <tr className="bg-slate-950/50">
                          <td colSpan={Object.keys(roleScopeLabels).length} className="p-2 px-3">
                            <span className="text-[9px] text-emerald-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                              {group.icon} {group.group}
                            </span>
                          </td>
                        </tr>
                        {group.actions.map(action => (
                          <tr key={action} className="hover:bg-slate-900/40 transition-colors">
                            <td className="p-3 font-medium text-slate-300 text-[11px]">
                              {action.charAt(0).toUpperCase() + action.slice(1).replace(/([A-Z])/g, ' $1')}
                            </td>
                            {Object.keys(roleScopeLabels).filter(k => k !== 'none').map(roleScopeKey => (
                              <td key={roleScopeKey} className="p-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={matrix.actions[action]?.includes(roleScopeKey as RoleScope) || false}
                                  onChange={() => handleToggleAction(action, roleScopeKey as RoleScope)}
                                  className="w-4.5 h-4.5 rounded border-slate-800 bg-slate-950 text-emerald-500 focus:ring-emerald-500 accent-emerald-500 cursor-pointer mx-auto transition-transform hover:scale-110"
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
            </div>

            {/* Footer Actions */}
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
          </div>

        </div>
      </div>
    </div>
  );
}