import React, { useState, useEffect } from 'react';
import { 
  X, Zap, Edit2, ChevronRight, User, ArrowRight, Shield, Plus, Users, Trash2, 
  CheckSquare, AlertCircle, Type, Save, Link, ListTodo, Sliders, Play, FileText,
  DollarSign, Mail, Phone, Calendar
} from 'lucide-react';
import { Project, Customer, Employee, Task, ProjectDoc } from '../types';
import { KanbanColumn } from './ProjectKanbanBoard';
import SearchableEmployeeSelect from './SearchableEmployeeSelect';
import { useNotification } from '../context';

interface WorkflowAutomationModalProps {
  isOpen: boolean;
  onClose: () => void;
  columns: KanbanColumn[];
  activeWorkflowColId: string;
  setActiveWorkflowColId: (colId: string) => void;
  employees: Employee[];
  saveColumns: (columns: KanbanColumn[]) => void;
  openEditColumn: (col: KanbanColumn) => void;
  setConfirmDialog: (dialog: any) => void;
}

export const WorkflowAutomationModal: React.FC<WorkflowAutomationModalProps> = ({
  isOpen,
  onClose,
  columns,
  activeWorkflowColId,
  setActiveWorkflowColId,
  employees,
  saveColumns,
  openEditColumn,
  setConfirmDialog
}) => {
  const [selectedActionType, setSelectedActionType] = useState<'assignee' | 'status' | 'approval' | 'subtask' | 'involved' | 'textStyle'>('assignee');
  const [activeSubtaskRuleIndex, setActiveSubtaskRuleIndex] = useState<number | null>(null);
  const { addToast } = useNotification();

  if (!isOpen) return null;

  const activeCol = columns.find(c => c.id === activeWorkflowColId);
  const isActionActive = activeCol?.automation 
    ? (selectedActionType === 'assignee' ? !!activeCol.automation.assignId
      : selectedActionType === 'status' ? !!activeCol.automation.statusUpdate
      : selectedActionType === 'approval' ? (!!activeCol.automation.approvalRole && activeCol.automation.approvalRole !== 'none')
      : selectedActionType === 'subtask' ? (!!activeCol.automation.subtaskTitle || (activeCol.automation.subtaskTitles && activeCol.automation.subtaskTitles.some(t => !!t)))
      : selectedActionType === 'involved' ? (!!activeCol.automation.involvedId || (activeCol.automation.involvedEmployeeIds && activeCol.automation.involvedEmployeeIds.length > 0))
      : selectedActionType === 'textStyle' ? (activeCol.automation.textStyleStyleItalic !== undefined || activeCol.automation.textStyleStyleBold !== undefined || activeCol.automation.textStyleStyleStrike !== undefined || activeCol.automation.textStyleStyleColor !== undefined)
      : false)
    : false;

  const actionsConfig = {
    assignee: {
      title: 'Giao cho người thực hiện',
      description: 'Chỉ định lại PM quản lý hoặc người phụ trách.',
      helpText: 'Dự án sẽ tự động bàn giao tài khoản phụ trách chính (PM) sang thành viên được chọn dưới đây khi chuyển tới giai đoạn này.',
      icon: User,
      iconBg: 'bg-sky-500/10 border border-sky-500/30',
      iconColor: 'text-sky-450 text-sky-400',
      isActive: (auto: any) => !!auto?.assignId,
    },
    status: {
      title: 'Chuyển cột khi hoàn thành',
      description: 'Tự động chuyển dự án sang phân đoạn khác khi hoàn thành.',
      helpText: 'Hệ thống sẽ tự động chuyển thẻ dự án này sang cột/giai đoạn được chỉ định dưới đây khi toàn bộ các công việc con hiện có hoàn thành (Ví dụ: Đạt mốc 2/2, 3/3, ... việc con hoàn tất).',
      icon: ArrowRight,
      iconBg: 'bg-emerald-500/10 border border-emerald-500/30',
      iconColor: 'text-emerald-450 text-emerald-400',
      isActive: (auto: any) => !!auto?.statusUpdate,
    },
    textStyle: {
      title: 'Kiểu văn bản',
      description: 'Tự động cập nhật định dạng chữ của thẻ Dự Án.',
      helpText: 'Dự án sẽ tự động thay đổi kiểu chữ (in nghiêng, in đậm, gạch giữa) và màu sắc của thẻ khi di chuyển vào phân đoạn này.',
      icon: Type,
      iconBg: 'bg-violet-500/10 border border-violet-500/30',
      iconColor: 'text-violet-450 text-violet-400',
      isActive: (auto: any) => auto?.textStyleStyleItalic !== undefined || auto?.textStyleStyleBold !== undefined || auto?.textStyleStyleStrike !== undefined || auto?.textStyleStyleColor !== undefined,
    },
    approval: {
      title: 'Gửi yêu cầu phê duyệt',
      description: 'Kích hoạt tờ trình duyệt cấp quản lý tối cao.',
      helpText: 'Tự động gửi thông tin và đề xuất trạng thái chờ Ban Giám Đốc hoặc Kế Toán Trưởng phê duyệt liên thông.',
      icon: Shield,
      iconBg: 'bg-amber-500/10 border border-amber-500/30',
      iconColor: 'text-amber-500',
      isActive: (auto: any) => !!auto?.approvalRole && auto.approvalRole !== 'none',
    },
    subtask: {
      title: 'Thêm công việc con',
      description: 'Tạo công việc độc lập tự kích hoạt trong xưởng.',
      helpText: 'Tự động bổ nhiệm thêm các tác vụ thi công phụ trực thuộc hồ sơ công trình hiện tại.',
      icon: Plus,
      iconBg: 'bg-pink-500/10 border border-pink-500/30',
      iconColor: 'text-pink-400',
      isActive: (auto: any) => !!auto?.subtaskTitle || (auto?.subtaskTitles && auto.subtaskTitles.some((t: any) => !!t)),
    },
    involved: {
      title: 'Thêm người liên quan',
      description: 'Chỉ định cộng sự, thiết kế giám bám sát.',
      helpText: 'Tự động liên kết thêm thành viên hỗ trợ chuyên biệt vào danh sách đồng tham gia dự án.',
      icon: Users,
      iconBg: 'bg-green-500/10 border border-green-500/30',
      iconColor: 'text-green-400',
      isActive: (auto: any) => !!auto?.involvedId || (auto?.involvedEmployeeIds && auto.involvedEmployeeIds.length > 0),
    },
  };

  const updateColAutomation = (colId: string, updates: Partial<NonNullable<KanbanColumn['automation']>>) => {
    const updated = columns.map(c => {
      if (c.id === colId) {
        const curAuto = { ...(c.automation || { type: 'none' }) } as any;
        Object.entries(updates).forEach(([k, val]) => {
          if (val === undefined) {
            delete curAuto[k];
          } else {
            curAuto[k] = val;
          }
        });
        return {
          ...c,
          automation: curAuto
        };
      }
      return c;
    });
    saveColumns(updated);
  };

  const handleToggleAction = () => {
    if (!activeWorkflowColId) return;
    const col = columns.find(c => c.id === activeWorkflowColId);
    if (!col) return;

    const updates: Partial<NonNullable<KanbanColumn['automation']>> = {};

    if (isActionActive) {
      // Deactivate
      if (selectedActionType === 'assignee') updates.assignId = undefined;
      else if (selectedActionType === 'status') updates.statusUpdate = undefined;
      else if (selectedActionType === 'approval') updates.approvalRole = 'none';
      else if (selectedActionType === 'subtask') {
        updates.subtaskTitle = undefined;
        updates.subtaskTitles = undefined;
      }
      else if (selectedActionType === 'involved') {
        updates.involvedId = undefined;
        updates.involvedEmployeeIds = [];
      }
      else if (selectedActionType === 'textStyle') {
        updates.textStyleStyleItalic = undefined;
        updates.textStyleStyleBold = undefined;
        updates.textStyleStyleStrike = undefined;
        updates.textStyleStyleColor = undefined;
      }
    } else {
      // Activate with default value
      if (selectedActionType === 'assignee') updates.assignId = employees[0]?.id || 'emp_3';
      else if (selectedActionType === 'status') updates.statusUpdate = 'col_done';
      else if (selectedActionType === 'approval') updates.approvalRole = 'director';
      else if (selectedActionType === 'subtask') {
        updates.subtaskTitle = 'Khảo sát hiện trạng công xưởng thực tế';
        updates.subtaskTitles = ['Khảo sát hiện trạng công xưởng thực tế'];
      }
      else if (selectedActionType === 'involved') {
        const defaultEmpId = employees[1]?.id || 'emp_4';
        updates.involvedId = defaultEmpId;
        updates.involvedEmployeeIds = [defaultEmpId];
      }
      else if (selectedActionType === 'textStyle') {
        updates.textStyleStyleBold = true;
        updates.textStyleStyleColor = 'text-red-500';
      }
    }

    updateColAutomation(activeWorkflowColId, updates);
  };

  const handleResetAllInColumn = () => {
    if (!activeWorkflowColId) return;
    setConfirmDialog({
      title: 'Khôi phục cài đặt cột',
      message: `Bạn có chắc muốn xóa sạch toàn bộ quy tắc tự động cho cột phân đoạn này không?`,
      onConfirm: () => {
        const updated = columns.map(c => {
          if (c.id === activeWorkflowColId) {
            return {
              ...c,
              automation: { type: 'none' } as NonNullable<KanbanColumn['automation']>
            };
          }
          return c;
        });
        saveColumns(updated);
        addToast({ title: '✅ Thành công', message: 'Đã khôi phục cài đặt cột về chế độ thủ công.', type: 'success' });
      },
      confirmText: 'Xóa quy tắc'
    });
  };

  const renderActionInputs = () => {
    if (!activeCol) return null;
    const auto = (activeCol.automation || {}) as any;

    switch (selectedActionType) {
      case 'assignee':
        return (
          <div className="space-y-2 text-left">
            <label className="block text-slate-355 font-bold mb-1">Trưởng Dự Án phụ trách mới</label>
            <select
              value={auto.assignId || ''}
              onChange={(e) => updateColAutomation(activeWorkflowColId, { assignId: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white outline-none cursor-pointer text-[11px]"
            >
              <option value="">-- Chọn cán bộ phụ trách --</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.department} - {(emp.role || 'employee').toUpperCase()})
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500">
              PM chịu quyền điều động xe, thợ cơ động gỗ gia công thực hiện bàn giao chi phối.
            </p>
          </div>
        );

      case 'status':
        return (
          <div className="space-y-2 text-left">
            <label className="block text-slate-355 font-bold mb-1">Cột phân đoạn tự chuyển dự án sang</label>
            <select
              value={auto.statusUpdate || ''}
              onChange={(e) => updateColAutomation(activeWorkflowColId, { statusUpdate: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white outline-none cursor-pointer text-[11px]"
            >
              <option value="">-- Chọn cột chuyển tới --</option>
              {columns.filter(c => c.id !== activeWorkflowColId).map(col => (
                <option key={col.id} value={col.id}>
                  {col.name}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500">
              Khi tất cả các công việc con của dự án đạt mốc hoàn thành (Ví dụ: 2/2, 3/3... việc con hoàn tất), hệ thống sẽ tự động dời thẻ sang Cột phân đoạn được chọn trên.
            </p>
          </div>
        );

      case 'approval':
        return (
          <div className="space-y-2 text-left">
            <label className="block text-slate-355 font-bold mb-1">Trình phê duyệt chỉ tiêu</label>
            <select
              value={auto.approvalRole || 'director'}
              onChange={(e) => updateColAutomation(activeWorkflowColId, { approvalRole: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white outline-none cursor-pointer text-[11px]"
            >
              <option value="director">Giám Đốc tối cao (Trương Hữu Long)</option>
              <option value="accountant">Kế Toán chi phí (Lê Thị Mai)</option>
              <option value="pm">Trưởng Dự Án chuyên bồi mẫu nội xưởng</option>
            </select>
          </div>
        );

      case 'subtask': {
        const subtasks = [...(auto.subtaskTitles || [])];
        if (subtasks.length === 0 && auto.subtaskTitle) {
          subtasks.push(auto.subtaskTitle);
        }
        if (subtasks.length === 0) {
          subtasks.push('');
        }

        const handleSubtaskChange = (index: number, val: string) => {
          const updated = [...subtasks];
          updated[index] = val;
          updateColAutomation(activeWorkflowColId, {
            subtaskTitle: updated[0] || '',
            subtaskTitles: updated
          });
        };

        const handleAddSubtask = () => {
          const updated = [...subtasks, ''];
          const currentAutos = [...(auto.subtaskAutomations || [])];
          currentAutos.push({});
          updateColAutomation(activeWorkflowColId, { 
            subtaskTitles: updated,
            subtaskAutomations: currentAutos
          });
        };

        const handleRemoveSubtask = (index: number) => {
          let updated = subtasks.filter((_, i) => i !== index);
          if (updated.length === 0) {
            updated = [''];
          }
          const currentAutos = (auto.subtaskAutomations || []).filter((_: any, i: number) => i !== index);
          updateColAutomation(activeWorkflowColId, {
            subtaskTitle: updated[0] || '',
            subtaskTitles: updated,
            subtaskAutomations: currentAutos
          });
          if (activeSubtaskRuleIndex === index) {
            setActiveSubtaskRuleIndex(null);
          } else if (activeSubtaskRuleIndex !== null && activeSubtaskRuleIndex > index) {
            setActiveSubtaskRuleIndex(activeSubtaskRuleIndex - 1);
          }
        };

        const updateSubtaskAutomation = (subtaskIdx: number, subtaskUpdates: any) => {
          const currentAutos = [...(auto.subtaskAutomations || [])];
          while (currentAutos.length <= subtaskIdx) {
            currentAutos.push({});
          }
          const currentItem = { ...currentAutos[subtaskIdx] };
          Object.entries(subtaskUpdates).forEach(([k, val]) => {
            if (val === undefined) {
              delete currentItem[k];
            } else {
              currentItem[k] = val;
            }
          });
          currentAutos[subtaskIdx] = currentItem;
          updateColAutomation(activeWorkflowColId, {
            subtaskAutomations: currentAutos
          });
        };

        return (
          <div className="space-y-3 text-left">
            <div className="flex justify-between items-center bg-slate-955/40 p-2 rounded-lg border border-slate-805">
              <span className="text-slate-355 font-bold text-xs uppercase tracking-wider">
                Danh sách công việc con ({subtasks.length} công việc)
              </span>
              <button
                type="button"
                onClick={handleAddSubtask}
                className="flex items-center gap-1 bg-indigo-650 hover:bg-indigo-600 text-white font-bold text-[10px] px-2 py-1 rounded cursor-pointer transition-colors"
              >
                <Plus className="w-3" /> Thêm công việc
              </button>
            </div>
            
            <div className="space-y-2.5">
              {subtasks.map((task, index) => {
                const subtaskAuto = (auto.subtaskAutomations && auto.subtaskAutomations[index]) ? auto.subtaskAutomations[index] : {};
                return (
                  <div key={index} className="space-y-1.5 p-2.5 rounded-xl border border-slate-850/40 bg-slate-900/60 transition-colors">
                    <div className="flex gap-2 items-center">
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-950 w-5 h-5 flex items-center justify-center rounded-full shrink-0 font-bold">
                        {index + 1}
                      </span>
                      <input
                        type="text"
                        value={task}
                        onChange={(e) => handleSubtaskChange(index, e.target.value)}
                        placeholder={`Nhập nội dung công việc con thứ ${index + 1}...`}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-white outline-none text-[11px] focus:border-indigo-500 transition-colors"
                      />
                      
                      {/* Nút Quy Trình Tự Động Công Việc Con */}
                      <button
                        type="button"
                        onClick={() => setActiveSubtaskRuleIndex(activeSubtaskRuleIndex === index ? null : index)}
                        className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 text-[10px] font-bold ${
                          activeSubtaskRuleIndex === index 
                            ? 'bg-amber-500 border-amber-500/50 text-slate-950 shadow-md scale-[1.02]' 
                            : 'bg-slate-950 hover:bg-slate-805 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                        title="Kiểm soát cấu hình Quy trình tự động"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Cấu hình tự động</span>
                      </button>

                      {subtasks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSubtask(index)}
                          className="p-1.5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-lg transition-colors cursor-pointer shrink-0"
                          title="Xóa công việc này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Preview Badges for Configured Automation Details */}
                    {(() => {
                      const selectedInvolvedIds = subtaskAuto.involvedEmployeeIds || (subtaskAuto.involvedId ? [subtaskAuto.involvedId] : []);
                      const hasAssignee = !!subtaskAuto.assignId;
                      const hasInvolved = selectedInvolvedIds.length > 0;
                      const hasApproval = subtaskAuto.isApprovalEnabled === true;
                      const hasCost = subtaskAuto.isCostEnabled === true;
                      const hasMaterial = subtaskAuto.isMaterialEnabled === true;
                      const hasDocs = subtaskAuto.isDocGenerationEnabled === true;
                      const hasSubcontractor = subtaskAuto.isSubcontractorEnabled === true;
                      const hasCheck = subtaskAuto.checklistTexts && subtaskAuto.checklistTexts.length > 0;

                      if (!hasAssignee && !hasInvolved && !hasApproval && !hasCost && !hasMaterial && !hasDocs && !hasSubcontractor && !hasCheck) return null;

                      return (
                        <div className="flex flex-wrap gap-1.5 items-center px-7 text-[9.5px] text-slate-400 select-none pb-1">
                          {hasAssignee && (
                            <span className="bg-indigo-950/40 text-indigo-400 border border-indigo-900/40 px-2 py-0.5 rounded font-extrabold flex items-center gap-1">
                              👤 Thợ: {employees.find(e => e.id === subtaskAuto.assignId)?.name || 'Mặc định'}
                            </span>
                          )}
                          {hasInvolved && (
                            <span className="bg-sky-950/40 text-sky-400 border border-sky-900/40 px-2 py-0.5 rounded font-extrabold flex items-center gap-0.5">
                              👥 +{selectedInvolvedIds.length} Phụ Trách Nhiệm Vụ hỗ trợ
                            </span>
                          )}
                          {hasApproval && (
                            <span className="bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 px-2 py-0.5 rounded font-extrabold flex items-center gap-1 animate-pulse">
                              🛡️ {subtaskAuto.isApprovalRequired === true ? 'Phê duyệt bắt buộc' : 'Có phê duyệt'}
                            </span>
                          )}
                          {hasCost && (
                            <span className="bg-indigo-950/40 text-teal-400 border border-teal-905/30 px-2 py-0.5 rounded font-extrabold flex items-center gap-1">
                              💵 Nhận chi phí
                            </span>
                          )}
                          {hasMaterial && (
                            <span className="bg-amber-955/35 text-amber-400 border border-amber-900/30 px-2 py-0.5 rounded font-extrabold flex items-center gap-1">
                              ⚡ Nhận vật tư
                            </span>
                          )}
                          {hasDocs && (
                            <span className="bg-rose-950/40 text-rose-455 border border-rose-900/40 px-2 py-0.5 rounded font-extrabold flex items-center gap-1 font-mono">
                              📄 Có hồ sơ
                            </span>
                          )}
                          {hasSubcontractor && (
                            <span className="bg-orange-950/40 text-orange-400 border border-orange-900/45 px-2 py-0.5 rounded font-extrabold flex items-center gap-1">
                              🔗 Thầu phụ
                            </span>
                          )}
                          {hasCheck && (
                            <span className="bg-slate-800 text-slate-355 px-2 py-0.5 rounded font-extrabold">
                              ✓ {subtaskAuto.checklistTexts.length} bước đo kiểm
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>

            {/* POPUP OVERLAY FOR SUBTASK AUTOMATION */}
            {activeSubtaskRuleIndex !== null && (() => {
              const index = activeSubtaskRuleIndex;
              const task = subtasks[index] || '';
              const subtaskAuto = (auto.subtaskAutomations && auto.subtaskAutomations[index]) ? auto.subtaskAutomations[index] : {};
              
              return (
                <div 
                  className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-[70] p-4 overflow-y-auto animate-fade-in"
                  onClick={() => setActiveSubtaskRuleIndex(null)}
                >
                  <div 
                    className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden transform transition-all duration-300 scale-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Modal Header */}
                    <div className="flex justify-between items-center bg-slate-955 p-4.5 border-b border-slate-800 shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                          <Zap className="w-5 h-5 text-amber-400 animate-pulse" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-sm text-white uppercase tracking-wider">
                            Cấu hình Quy trình tự động công việc con
                          </h4>
                          <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider mt-0.5">
                            CÔNG VIỆC CON #{index + 1}: "{task || 'Công việc con'}"
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveSubtaskRuleIndex(null)}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Modal Content */}
                    <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar text-[11.5px] text-slate-300">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-left">
                        {/* 1. Giao cho người thực hiện */}
                        <div className="bg-slate-900 border border-slate-805/60 p-3 rounded-xl flex items-center gap-3 relative group hover:border-slate-700 transition-colors">
                          {(() => {
                            const assignedEmp = employees.find(e => e.id === subtaskAuto.assignId);
                            const name = assignedEmp ? assignedEmp.name : 'Chưa gán (Bấm để gán)';
                            const parts = name.split(' ');
                            const initials = parts.length >= 2
                              ? `${parts[parts.length - 2][0]}${parts[parts.length - 1][0]}`.toUpperCase()
                              : (parts[0] ? parts[0].substring(0, 2).toUpperCase() : '??');
                            return (
                              <>
                                <div className="relative shrink-0 w-11 h-11">
                                  <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${assignedEmp ? 'from-indigo-500 to-purple-600' : 'from-slate-700 to-slate-800'} flex items-center justify-center font-bold text-white text-sm shadow-md border border-white/5 group-hover:scale-105 transition-all`}>
                                    {initials}
                                  </div>
                                  <span className="absolute -bottom-1 -right-0.5 bg-slate-950 text-indigo-455 border border-slate-805 w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] font-bold">
                                    ⚙️
                                  </span>
                                  <select
                                    value={subtaskAuto.assignId || ''}
                                    onChange={(e) => updateSubtaskAutomation(index, { assignId: e.target.value || undefined })}
                                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                    title="Nhấp vào avatar để thay đổi người thực hiện"
                                  >
                                    <option value="" className="bg-slate-950 text-slate-400">-- Chưa gán / Theo PM --</option>
                                    {employees.map(emp => (
                                      <option key={emp.id} value={emp.id} className="bg-slate-950 text-slate-200">
                                        {emp.name} ({emp.department})
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div className="flex-1 min-w-0 text-left">
                                  <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider mb-0.5">NGƯỜI THỰC HIỆN CHÍNH</span>
                                  <SearchableEmployeeSelect
                                    value={subtaskAuto.assignId || ''}
                                    onChange={(val) => updateSubtaskAutomation(index, { assignId: val || undefined })}
                                    employees={employees}
                                    placeholder="Mặc định (Sử dụng PM)"
                                  />
                                  <span className="block text-[9.5px] text-slate-400 font-mono mt-1 truncate">
                                    {assignedEmp ? assignedEmp.department : 'Nhấp chọn để gán thợ...'}
                                  </span>
                                </div>
                              </>
                            );
                          })()}
                        </div>

                        {/* 2. Người liên quan & Hỗ trợ */}
                        <div className="bg-slate-900 border border-slate-805/60 p-3 rounded-xl flex flex-col justify-between hover:border-slate-700 transition-colors text-left min-h-[72px]">
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider mb-2">NGƯỜI LIÊN QUAN & HỖ TRỢ</span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {(() => {
                                const currentInvolved = subtaskAuto.involvedEmployeeIds || (subtaskAuto.involvedId ? [subtaskAuto.involvedId] : []);
                                return (
                                  <>
                                    {currentInvolved.length === 0 ? (
                                      <span className="text-slate-650 text-[10px] italic py-1 block">Chưa gán người hỗ trợ...</span>
                                    ) : (
                                      currentInvolved.map((empId: string) => {
                                        const emp = employees.find(e => e.id === empId);
                                        if (!emp) return null;
                                        const parts = emp.name.split(' ');
                                        const initials = parts.length >= 2
                                          ? `${parts[parts.length - 2][0]}${parts[parts.length - 1][0]}`.toUpperCase()
                                          : (parts[0] ? parts[0].substring(0, 2).toUpperCase() : '??');
                                        return (
                                          <div key={empId} className="relative group/member shrink-0">
                                            <div 
                                              className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-indigo-650 flex items-center justify-center font-bold text-white text-[10px] shadow border border-sky-450/10 cursor-pointer transition-transform hover:scale-105"
                                              title={`${emp.name} (${emp.department}) - Nhấp để xóa gỡ`}
                                              onClick={() => {
                                                const nextInvolved = currentInvolved.filter((id: string) => id !== empId);
                                                updateSubtaskAutomation(index, {
                                                  involvedEmployeeIds: nextInvolved,
                                                  involvedId: nextInvolved[0] || undefined
                                                });
                                              }}
                                            >
                                              {initials}
                                              <div className="absolute inset-0 bg-rose-955/80 rounded-full flex items-center justify-center text-rose-455 font-extrabold text-[8px] opacity-0 group-hover/member:opacity-100 transition-opacity">
                                                ✕
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })
                                    )}

                                    <div className="relative shrink-0">
                                      <div className="w-8 h-8 rounded-full border border-dashed border-slate-705 hover:border-emerald-500/70 bg-slate-955/50 flex items-center justify-center text-slate-500 hover:text-emerald-400 transition-colors cursor-pointer text-xs">
                                        <Plus className="w-3.5 h-3.5" />
                                      </div>
                                      <select
                                        value=""
                                        onChange={(e) => {
                                          const empId = e.target.value;
                                          if (empId) {
                                            const nextInvolved = [...currentInvolved];
                                            if (!nextInvolved.includes(empId)) {
                                              const updated = [...nextInvolved, empId];
                                              updateSubtaskAutomation(index, {
                                                involvedEmployeeIds: updated,
                                                involvedId: updated[0] || undefined
                                              });
                                            }
                                          }
                                        }}
                                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                        title="Nhấp để thêm người hỗ trợ vào danh sách liên quan"
                                      >
                                        <option value="">-- Thêm người hỗ trợ --</option>
                                        {employees
                                          .filter(emp => emp.id !== subtaskAuto.assignId && !currentInvolved.includes(emp.id))
                                          .map(emp => (
                                            <option key={emp.id} value={emp.id}>
                                              {emp.name} ({emp.department})
                                            </option>
                                          ))
                                        }
                                      </select>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Gửi yêu cầu phê duyệt */}
                      <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Shield className={`w-4 h-4 ${subtaskAuto.isApprovalEnabled === true ? 'text-sky-400' : 'text-slate-600'}`} />
                            <div className="text-left">
                              <span className="font-extrabold text-slate-200 text-[11px] block">Cấu hình Quy trình Phê duyệt</span>
                              <span className="text-[9.5px] text-slate-455 block">Mở nút "Yêu cầu phê duyệt" & Bắt buộc duyệt đối với việc con này</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const currentVal = subtaskAuto.isApprovalEnabled === true;
                              updateSubtaskAutomation(index, { 
                                isApprovalEnabled: !currentVal,
                                isApprovalRequired: !currentVal,
                                approvalRole: !currentVal ? 'director' : 'none',
                                defaultApproverId: undefined
                              });
                            }}
                            className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer relative duration-150 ${
                              subtaskAuto.isApprovalEnabled === true ? 'bg-sky-500' : 'bg-slate-800 border border-slate-850'
                            }`}
                          >
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-150 ${
                              subtaskAuto.isApprovalEnabled === true ? 'translate-x-4' : 'translate-x-0'
                            }`} />
                          </button>
                        </div>
                        {subtaskAuto.isApprovalEnabled === true && (
                          <div className="mt-2.5 pt-2.5 border-t border-slate-800 space-y-1">
                            <label className="block text-[9px] font-black text-rose-400 uppercase tracking-wider text-left">Người phê duyệt mặc định <span className="text-rose-400">*</span>:</label>
                            <SearchableEmployeeSelect
                              value={subtaskAuto.defaultApproverId || ''}
                              onChange={(val) => updateSubtaskAutomation(index, { defaultApproverId: val || undefined })}
                              employees={employees}
                              placeholder="-- Mặc định (PM chuyên trách hoặc Giám đốc) --"
                              required
                            />
                          </div>
                        )}
                      </div>

                      {/* Đề xuất chi phí */}
                      <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <DollarSign className={`w-4 h-4 ${subtaskAuto.isCostEnabled === true ? 'text-emerald-400' : 'text-slate-600'}`} />
                            <div className="text-left">
                              <span className="font-extrabold text-slate-200 text-[11px] block">Cấu hình Đề xuất chi phí</span>
                              <span className="text-[9.5px] text-slate-455 block">Mở/Đóng nút "Đề xuất chi phí" trong chi tiết công việc con</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const currentVal = subtaskAuto.isCostEnabled === true;
                              updateSubtaskAutomation(index, { 
                                isCostEnabled: !currentVal,
                                costApproverId: undefined,
                                costSettlerId: undefined
                              });
                            }}
                            className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer relative duration-150 ${
                              subtaskAuto.isCostEnabled === true ? 'bg-emerald-500' : 'bg-slate-800 border border-slate-850'
                            }`}
                          >
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-150 ${
                              subtaskAuto.isCostEnabled === true ? 'translate-x-4' : 'translate-x-0'
                            }`} />
                          </button>
                        </div>
                        {subtaskAuto.isCostEnabled === true && (
                          <div className="mt-2.5 pt-2.5 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                            <div className="space-y-1">
                              <label className="block text-[9px] font-black text-rose-400 uppercase tracking-wider">Người xét duyệt mặc định <span className="text-rose-400">*</span>:</label>
                              <SearchableEmployeeSelect
                                value={subtaskAuto.costApproverId || ''}
                                onChange={(val) => updateSubtaskAutomation(index, { costApproverId: val || undefined })}
                                employees={employees}
                                placeholder="-- Mặc định (Giám đốc / PM) --"
                                required
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-[9px] font-black text-rose-400 uppercase tracking-wider">Người quyết toán mặc định <span className="text-rose-400">*</span>:</label>
                              <SearchableEmployeeSelect
                                value={subtaskAuto.costSettlerId || ''}
                                onChange={(val) => updateSubtaskAutomation(index, { costSettlerId: val || undefined })}
                                employees={employees}
                                placeholder="-- Mặc định (Kế toán) --"
                                required
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Đề xuất vật tư */}
                      <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Zap className={`w-4 h-4 ${subtaskAuto.isMaterialEnabled === true ? 'text-amber-400' : 'text-slate-600'}`} />
                            <div className="text-left">
                              <span className="font-extrabold text-slate-200 text-[11px] block">Cấu hình Đề xuất vật tư</span>
                              <span className="text-[9.5px] text-slate-455 block">Mở/Đóng nút "Đề xuất vật tư" trong chi tiết công việc con</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const currentVal = subtaskAuto.isMaterialEnabled === true;
                              updateSubtaskAutomation(index, { 
                                isMaterialEnabled: !currentVal,
                                isMaterialSelfCoordinated: !currentVal ? true : undefined,
                                materialCoordinatorId: undefined
                              });
                            }}
                            className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer relative duration-150 ${
                              subtaskAuto.isMaterialEnabled === true ? 'bg-amber-500' : 'bg-slate-800 border border-slate-850'
                            }`}
                          >
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-150 ${
                              subtaskAuto.isMaterialEnabled === true ? 'translate-x-4' : 'translate-x-0'
                            }`} />
                          </button>
                        </div>
                       
                      </div>

                      {/* Liên kết Thầu phụ */}
                      <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Link className={`w-4 h-4 ${subtaskAuto.isSubcontractorEnabled === true ? 'text-orange-400' : 'text-slate-600'}`} />
                            <div className="text-left">
                              <span className="font-extrabold text-slate-200 text-[11px] block">Cấu hình Liên kết Thầu phụ</span>
                              <span className="text-[9.5px] text-slate-455 block">Mở/Đóng nút "Liên kết Thầu phụ" trong chi tiết công việc con</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const currentVal = subtaskAuto.isSubcontractorEnabled === true;
                              updateSubtaskAutomation(index, { 
                                isSubcontractorEnabled: !currentVal,
                                subcontractorApproverId: undefined,
                                subcontractorSettlerId: undefined
                              });
                            }}
                            className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer relative duration-150 ${
                              subtaskAuto.isSubcontractorEnabled === true 
                                ? 'bg-orange-500' 
                                : 'bg-slate-800 border border-slate-850'
                            }`}
                          >
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-150 ${
                              subtaskAuto.isSubcontractorEnabled === true ? 'translate-x-4' : 'translate-x-0'
                            }`} />
                          </button>
                        </div>
                        {subtaskAuto.isSubcontractorEnabled === true && (
                          <div className="mt-2.5 pt-2.5 border-t border-slate-800 space-y-3">
                            {/* Dropdown chọn thầu phụ từ localStorage (giữ logic cũ) */}
                            <div>
                              <label className="block text-orange-400 font-bold text-[9px] uppercase tracking-wider mb-1">Chọn Thầu Phụ từ Dữ Liệu Kế Toán <span className="text-rose-400">*</span>:</label>
                              <select
                                value={subtaskAuto.subcontractorId || ''}
                                onChange={(e) => {
                                  const subId = e.target.value;
                                  updateSubtaskAutomation(index, { subcontractorId: subId || undefined });
                                  // Logic to update subcontractorName...
                                  const savedSuppliers = localStorage.getItem('hl_acc_suppliers');
                                  let suppliers = [];
                                  if (savedSuppliers) {
                                    try { suppliers = JSON.parse(savedSuppliers); } catch(err) {}
                                  }
                                  const matched = suppliers.find((s: any) => s.id === subId || s.code === subId);
                                  if (matched) {
                                    updateSubtaskAutomation(index, { subcontractorName: matched.name });
                                  } else {
                                    const fallbackSuppliers = [
                                      { code: 'NTN_2', name: 'Công ty Cổ phần Thép tiền chế Nam Trung Nam' },
                                      { code: 'XD_1', name: 'Tổ thợ hồ móng cứng Bảo Lộc - Đại diện chú Ba' },
                                      { code: 'KM_3', name: 'Thợ kính cường lực Kim Minh' }
                                    ];
                                    const fbMatched = fallbackSuppliers.find(s => s.code === subId);
                                    if (fbMatched) {
                                      updateSubtaskAutomation(index, { subcontractorName: fbMatched.name });
                                    }
                                  }
                                }}
                                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 outline-none text-[10px] focus:border-orange-500 font-medium"
                                required
                              >
                                <option value="">-- Chọn đối tác thầu phụ --</option>
                                {(() => {
                                  const savedSuppliers = localStorage.getItem('hl_acc_suppliers');
                                  let suppliers = [];
                                  if (savedSuppliers) {
                                    try { suppliers = JSON.parse(savedSuppliers); } catch(err) {}
                                  }
                                  if (suppliers.length === 0) {
                                    suppliers = [
                                      { code: 'NTN_2', name: 'Thép tiền chế Nam Trung Nam' },
                                      { code: 'XD_1', name: 'Tổ thợ hồ móng Ba Bảo Lộc' },
                                      { code: 'KM_3', name: 'Thợ kính Kim Minh' }
                                    ];
                                  }
                                  return suppliers.map((sup: any) => (
                                    <option key={sup.code || sup.id} value={sup.code || sup.id}>
                                      {sup.name} ({sup.code || sup.id})
                                    </option>
                                  ));
                                })()}
                              </select>
                            </div>

                            {/* Approver & Settler dropdowns (theo mẫu popup) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="block text-[9px] font-black text-rose-400 uppercase tracking-wider">Người xét duyệt mặc định <span className="text-rose-400">*</span>:</label>
                                <SearchableEmployeeSelect
                                  value={subtaskAuto.subcontractorApproverId || ''}
                                  onChange={(val) => updateSubtaskAutomation(index, { subcontractorApproverId: val || undefined })}
                                  employees={employees}
                                  placeholder="-- Mặc định (Giám đốc) --"
                                  required
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="block text-[9px] font-black text-rose-400 uppercase tracking-wider">Người quyết toán mặc định <span className="text-rose-400">*</span>:</label>
                                <SearchableEmployeeSelect
                                  value={subtaskAuto.subcontractorSettlerId || ''}
                                  onChange={(val) => updateSubtaskAutomation(index, { subcontractorSettlerId: val || undefined })}
                                  employees={employees}
                                  placeholder="-- Mặc định (Kế toán) --"
                                  required
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Checklist / Đo kiểm */}
                      <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <div className="flex items-center gap-2">
                            <CheckSquare className="w-4 h-4 text-amber-500 animate-pulse" />
                            <div className="text-left">
                              <span className="font-extrabold text-slate-200 text-[11px] block">Đầu mục đo kiểm / Checklist kỹ thuật</span>
                              <span className="text-[9.5px] text-slate-455 block">Các bước thợ thi công phải đo, kiểm tra thực tế, chụp ảnh đối chứng</span>
                            </div>
                          </div>
                        </div>

                        {/* Danh sách các mục */}
                        {subtaskAuto.checklistTexts && subtaskAuto.checklistTexts.length > 0 ? (
                          <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                            {subtaskAuto.checklistTexts.map((chk: string, chkIdx: number) => {
                              return (
                                <div key={chkIdx} className="flex items-center justify-between bg-slate-950 border border-slate-800 px-2.5 py-1.5 rounded-lg text-slate-300 font-mono text-[9.5px]">
                                  <div className="flex items-center gap-2 truncate">
                                    <span className="text-[8px] font-bold bg-slate-800 text-slate-450 w-4 h-4 flex items-center justify-center rounded">
                                      {chkIdx + 1}
                                    </span>
                                    <span className="truncate">{chk}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = (subtaskAuto.checklistTexts || []).filter((_: any, i: number) => i !== chkIdx);
                                      updateSubtaskAutomation(index, { checklistTexts: updated });
                                    }}
                                    className="text-slate-500 hover:text-rose-400 p-1 hover:bg-rose-955/20 rounded cursor-pointer transition-all shrink-0"
                                    title="Xóa mục này"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-4 bg-slate-955/40 rounded-xl border border-dashed border-slate-800 text-slate-500 text-[10px]">
                            Chưa cấu hình bước đo kiểm kỹ thuật nào. Hãy thêm ở dưới.
                          </div>
                        )}

                        {/* Thêm mới */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            id={`new_checklist_input_${index}`}
                            placeholder="VD: Kiểm tra kích thước phủ bì cánh tủ..."
                            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-[10.5px] text-slate-200 placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors text-left"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const inputEl = document.getElementById(`new_checklist_input_${index}`) as HTMLInputElement;
                                if (inputEl && inputEl.value.trim()) {
                                  const currentText = inputEl.value.trim();
                                  const list = subtaskAuto.checklistTexts || [];
                                  if (!list.includes(currentText)) {
                                    updateSubtaskAutomation(index, { checklistTexts: [...list, currentText] });
                                  }
                                  inputEl.value = '';
                                }
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const inputEl = document.getElementById(`new_checklist_input_${index}`) as HTMLInputElement;
                              if (inputEl && inputEl.value.trim()) {
                                const currentText = inputEl.value.trim();
                                const list = subtaskAuto.checklistTexts || [];
                                if (!list.includes(currentText)) {
                                  updateSubtaskAutomation(index, { checklistTexts: [...list, currentText] });
                                }
                                inputEl.value = '';
                              }
                            }}
                            className="bg-indigo-650 hover:bg-indigo-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Plus className="w-3 h-3" /> Thêm
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="bg-slate-950 px-5 py-3 border-t border-slate-800 flex justify-end shrink-0">
                      <button
                        type="button"
                        onClick={() => setActiveSubtaskRuleIndex(null)}
                        className="bg-indigo-650 hover:bg-indigo-600 text-white font-bold text-xs px-5 py-2 rounded-xl cursor-pointer transition-colors"
                      >
                        Lưu & Đóng cài đặt
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
            <p className="text-[10px] text-slate-500 italic mt-1 text-left">
              * Hệ thống hỗ trợ tự động khởi tạo toàn bộ số lượng danh sách công việc con trên khi thẻ công trình di chuyển vào cột phân đoạn {activeCol?.name || ''}.
            </p>
          </div>
        );
      }

      case 'involved':
        return (
          <div className="space-y-2 text-left">
            <label className="block text-slate-355 font-bold mb-1">Cộng sự hỗ trợ bổ sung</label>
            <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {(() => {
                  const selectedInvolvedIds = auto.involvedEmployeeIds || (auto.involvedId ? [auto.involvedId] : []);
                  return (
                    <>
                      {selectedInvolvedIds.length === 0 ? (
                        <p className="text-[10px] text-slate-500 italic">Chưa chỉ định người hỗ trợ nào ở phân đoạn này...</p>
                      ) : (
                        selectedInvolvedIds.map((empId: string) => {
                          const emp = employees.find(e => e.id === empId);
                          if (!emp) return null;
                          return (
                            <div key={empId} className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 flex items-center gap-1.5 text-[10px] text-slate-300">
                              <span>👤 {emp.name} ({emp.department})</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = selectedInvolvedIds.filter((id: string) => id !== empId);
                                  updateColAutomation(activeWorkflowColId, {
                                    involvedEmployeeIds: updated,
                                    involvedId: updated[0] || undefined
                                  });
                                }}
                                className="text-slate-500 hover:text-rose-400 p-0.5 rounded cursor-pointer transition-colors"
                                title="Hủy liên kết thành viên này"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </>
                  );
                })()}
              </div>

              <div className="border-t border-slate-801 pt-2">
                <SearchableEmployeeSelect
                  value=""
                  onChange={(val) => {
                    if (val) {
                      const selectedInvolvedIds = auto.involvedEmployeeIds || (auto.involvedId ? [auto.involvedId] : []);
                      if (!selectedInvolvedIds.includes(val)) {
                        const updated = [...selectedInvolvedIds, val];
                        updateColAutomation(activeWorkflowColId, {
                          involvedEmployeeIds: updated,
                          involvedId: updated[0] || undefined
                        });
                      }
                    }
                  }}
                  employees={employees}
                  placeholder="-- Nhấp chọn thành viên hỗ trợ --"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500">
              Cộng sự liên quan được bổ nhiệm sẽ tự động nhận quyền theo dõi tiến trình dự án trên trang cá nhân của họ.
            </p>
          </div>
        );

      case 'textStyle':
        return (
          <div className="space-y-3.5 text-left">
            <div>
              <span className="block text-slate-355 font-bold mb-1">Cưỡng chế kiểu dáng chữ của thẻ Dự Án</span>
              <div className="grid grid-cols-3 gap-3 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-[10.5px] text-slate-300 select-none">
                  <input
                    type="checkbox"
                    checked={auto.textStyleStyleBold || false}
                    onChange={(e) => updateColAutomation(activeWorkflowColId, { textStyleStyleBold: e.target.checked })}
                    className="accent-indigo-500 w-3.5 h-3.5 rounded cursor-pointer"
                  />
                  <span>Chữ Đậm</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-[10.5px] text-slate-300 select-none">
                  <input
                    type="checkbox"
                    checked={auto.textStyleStyleItalic || false}
                    onChange={(e) => updateColAutomation(activeWorkflowColId, { textStyleStyleItalic: e.target.checked })}
                    className="accent-indigo-500 w-3.5 h-3.5 rounded cursor-pointer"
                  />
                  <span>Chữ Nghiêng</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-[10.5px] text-slate-300 select-none">
                  <input
                    type="checkbox"
                    checked={auto.textStyleStyleStrike || false}
                    onChange={(e) => updateColAutomation(activeWorkflowColId, { textStyleStyleStrike: e.target.checked })}
                    className="accent-indigo-500 w-3.5 h-3.5 rounded cursor-pointer"
                  />
                  <span>Gạch Giữa</span>
                </label>
              </div>
            </div>

            <div>
              <span className="block text-slate-355 font-bold mb-1">Cưỡng chế màu sắc tiêu đề chữ</span>
              <select
                value={auto.textStyleStyleColor || 'text-white'}
                onChange={(e) => updateColAutomation(activeWorkflowColId, { textStyleStyleColor: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white outline-none cursor-pointer font-bold font-mono text-[11px]"
              >
                <option value="text-white">⚪ Trắng (Mặc định)</option>
                <option value="text-red-500" className="text-red-500">🔴 Đỏ tươi (Cần chú ý)</option>
                <option value="text-amber-500" className="text-amber-500">🟡 Vàng cam (Thiết lập)</option>
                <option value="text-emerald-500" className="text-emerald-500">🟢 Xanh lá (Hoàn thành)</option>
                <option value="text-sky-500" className="text-sky-500">🔵 Xanh dương (Phân phái)</option>
                <option value="text-violet-500" className="text-violet-500">🟣 Tím (Tài liệu)</option>
              </select>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex justify-end z-50 animate-fade-in" onClick={onClose}>
      <div 
        className="w-full max-w-[1536px] bg-slate-900 border-l border-slate-805 h-full flex flex-col text-slate-300 shadow-2xl overflow-hidden animate-slideLeft" 
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Header */}
        <div className="flex justify-between items-center bg-slate-955 p-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
              <Zap className="w-5 h-5 text-indigo-400 animate-pulse" />
            </div>
            <div className="text-left">
              <h3 className="font-extrabold text-[15px] text-white">
                Chọn loại hành động
              </h3>
              <p className="text-[10px] text-slate-400 uppercase font-mono tracking-wider mt-0.5">
                QUY TRÌNH TỰ ĐỘNG: PHÂN ĐOẠN <span className="text-indigo-400 font-bold">[{activeCol?.name}]</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Column horizontal selector bar */}
        <div className="bg-slate-900 px-4 py-2 border-b border-slate-805 flex flex-wrap gap-1.5 shrink-0 select-none">
          {columns.map(col => {
            const isActive = col.id === activeWorkflowColId;
            const count = [
              col.automation?.assignId,
              col.automation?.statusUpdate,
              (col.automation?.textStyleStyleItalic || col.automation?.textStyleStyleBold || col.automation?.textStyleStyleStrike || col.automation?.textStyleStyleColor),
              col.automation?.approvalRole && col.automation.approvalRole !== 'none',
              col.automation?.subtaskTitle || (col.automation?.subtaskTitles && col.automation.subtaskTitles.some(t => !!t)),
              col.automation?.checklistText || (col.automation?.checklistTexts && col.automation.checklistTexts.some(t => !!t)),
              col.automation?.involvedId || (col.automation?.involvedEmployeeIds && col.automation.involvedEmployeeIds.length > 0)
            ].filter(Boolean).length;

            return (
              <div
                key={col.id}
                className={`px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase transition-all duration-150 flex items-center gap-2 ${
                  isActive 
                    ? 'bg-indigo-650 text-white border border-indigo-400 shadow-sm' 
                    : 'bg-slate-950 text-slate-400 border border-transparent hover:bg-slate-800/80'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveWorkflowColId(col.id)}
                  className="flex items-center gap-2 text-left cursor-pointer outline-none font-bold uppercase text-[10px]"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${col.color || 'bg-indigo-500'}`} />
                  <span>{col.name}</span>
                  {count > 0 && (
                    <span className="bg-indigo-500/30 text-indigo-300 font-mono px-1.5 py-0.2 rounded-md text-[9px]">
                      {count}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditColumn(col);
                  }}
                  className="p-0.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
                  title="Đổi tên & cấu hình cột"
                >
                  <Edit2 className="w-2.5 h-2.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDialog({
                      title: 'Xóa cột phân đoạn',
                      message: `Bạn có chắc chắn muốn xóa cột phân đoạn [${col.name}] này? Các công trình trong cột này sẽ tự về mốc phân đoạn mặc định.`,
                      onConfirm: () => {
                        const filtered = columns.filter(c => c.id !== col.id);
                        saveColumns(filtered);
                        if (col.id === activeWorkflowColId) {
                          const remaining = filtered[0];
                          if (remaining) {
                            setActiveWorkflowColId(remaining.id);
                          }
                        }
                      },
                      confirmText: 'Xác nhận xóa'
                    });
                  }}
                  className="p-0.5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded transition-colors cursor-pointer"
                  title="Xóa cột phân đoạn này"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Workspace Body */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left visual trigger cards */}
          <div className="w-5/12 border-r border-slate-800 p-4 overflow-y-auto space-y-2 select-none bg-slate-950/20">
            <span className="font-extrabold text-[9px] text-slate-500 uppercase tracking-widest block mb-2 px-1 text-left">
              DANH SÁCH BỘ KÍCH HOẠT QUY TRÌNH
            </span>

            {Object.entries(actionsConfig).map(([key, item]) => {
              const activeState = item.isActive(activeCol?.automation);
              const isSelected = selectedActionType === key;

              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => setSelectedActionType(key as any)}
                  className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition-all duration-155 cursor-pointer text-left outline-none ${
                    isSelected 
                      ? 'bg-slate-800 border-indigo-500 shadow-md shadow-black/30' 
                      : 'bg-slate-900 hover:bg-slate-850 border-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-lg shrink-0 ${item.iconBg} ${item.iconColor}`}>
                      <item.icon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="font-extrabold text-[11px] text-white tracking-wide">
                        {item.title}
                      </p>
                      <p className="text-[9px] text-slate-400 mt-0.5 line-clamp-1 max-w-[200px]">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {activeState ? (
                      <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Bật
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded-md">
                        Tắt
                      </span>
                    )}
                    <ChevronRight className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-400 translate-x-0.5' : 'text-slate-600'} transition-all`} />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right detailed settings pane */}
          <div className="w-7/12 p-5 overflow-y-auto bg-slate-900/40 flex flex-col justify-between">
            {activeCol ? (
              <div className="space-y-4">
                {/* Active Title Banner */}
                <div className="flex items-center gap-3 pb-3 border-b border-slate-850">
                  <div className={`p-3 rounded-xl shadow-inner ${actionsConfig[selectedActionType].iconBg} ${actionsConfig[selectedActionType].iconColor}`}>
                    {React.createElement(actionsConfig[selectedActionType].icon, { className: 'w-5 h-5' })}
                  </div>
                  <div className="text-left">
                    <h4 className="font-extrabold text-[13px] text-white tracking-wide">
                      Thiết lập: {actionsConfig[selectedActionType].title}
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Quy tắc tự chạy cho phân đoạn <span className="font-black text-indigo-400 font-mono">[{activeCol.name}]</span>
                    </p>
                  </div>
                </div>

                {/* Explanation banner */}
                <div className="bg-slate-950/60 border border-slate-850 p-3 rounded-xl text-[10.5px] leading-relaxed text-slate-355 text-slate-300 text-left">
                  <span className="text-yellow-400 mr-1 animate-pulse">💡</span>
                  <strong>Vận hành:</strong> {actionsConfig[selectedActionType].helpText}
                </div>

                {/* Config Area */}
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-801 pb-3 border-slate-800">
                    <div className="text-left">
                      <span className="font-extrabold text-slate-200 block text-[11px]">Trạng thái tự động hóa</span>
                      <span className="text-[9px] text-slate-500 block mt-0.5">Bật hoặc tắt hành động quy trình này</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black tracking-wide ${isActionActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {isActionActive ? 'ĐANG KÍCH HOẠT' : 'CHƯA ÁP DỤNG'}
                      </span>
                      <button
                        type="button"
                        onClick={handleToggleAction}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer relative duration-150 ${
                          isActionActive ? 'bg-emerald-500' : 'bg-slate-800 border border-slate-755 border-slate-850'
                        }`}
                      >
                        <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-150 ${
                          isActionActive ? 'translate-x-4' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>
                  </div>

                  {isActionActive ? (
                    <div className="pt-1 select-text">
                      {renderActionInputs()}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                      <Zap className="w-6 h-6 text-slate-750" />
                      <p className="text-[10.5px]">Điều kiện tự trị này chưa được kích hoạt cho mục này.</p>
                      <button
                        type="button"
                        onClick={handleToggleAction}
                        className="text-[10px] bg-indigo-650 hover:bg-indigo-600 text-white px-3.5 py-2 rounded-lg font-extrabold cursor-pointer transition-colors"
                      >
                        Bật quy chế tự động ngay
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                <AlertCircle className="w-8 h-8 text-slate-600 animate-bounce" />
                <span>Không tìm thấy thông tin cột thi công đã gán</span>
              </div>
            )}

            {/* Foot warning and actions */}
            <div className="pt-4 border-t border-slate-850/80 flex items-center justify-between text-[10px]">
              <span className="text-slate-400 italic flex items-center gap-1.5 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Quy trình tự trị kích hoạt tức thời khi kéo mốc
              </span>
              <button
                type="button"
                onClick={handleResetAllInColumn}
                className="text-red-400 hover:text-red-300 transition-colors cursor-pointer text-[10px] font-bold hover:underline"
              >
                Xóa sạch toàn bộ quy tắc hành động cột
              </button>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-950 p-4 border-t border-slate-805 flex justify-between items-center shrink-0">
          <p className="text-[10px] text-slate-500 max-w-lg leading-relaxed text-left">
            * Quy trình tự trị Hoàng Long được lưu cục bộ và an toàn. Khi di chuyển thẻ, hệ thống sẽ tự sinh bản vẽ con, đổi quản lý, cập nhật trạng thái liên hợp ngay lập tức.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                addToast({ title: 'ℹ️ Thông báo', message: `Đã hoàn tất cấu hình tự động cho phân đoạn: ${activeCol?.name || 'mục'}!`, type: 'info' });
                onClose();
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px] px-6 py-2 rounded-xl transition-all hover:scale-[1.02] cursor-pointer"
            >
              Đồng ý & Đóng lại
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
