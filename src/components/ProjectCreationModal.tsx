import React, { useState, useEffect } from 'react';
import { Plus, X, Check } from 'lucide-react';
import { Project, Customer, Employee, Task, ProjectDoc } from '../types';
import { KanbanColumn } from './ProjectKanbanBoard';
import { QuickAddCustomerModal } from './QuickAddCustomerModal';

interface ProjectCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  columns: KanbanColumn[];
  employees: Employee[];
  customers: Customer[];
  onAddTask: (task: Task) => void;
  onAddProject: (project: Project) => void;
  onAddCustomer: (customer: Customer) => void;
}

const getAbbrev = (nameStr: string): string => {
  if (!nameStr) return '';
  const norm = nameStr
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
  const words = norm.trim().split(/\s+/).filter(Boolean);
  return words.map(w => w[0].toUpperCase()).join('');
};

export const ProjectCreationModal: React.FC<ProjectCreationModalProps> = ({
  isOpen,
  onClose,
  projects,
  columns,
  employees,
  customers,
  onAddTask,
  onAddProject,
  onAddCustomer
}) => {
  const [newProjName, setNewProjName] = useState('');
  const [newProjCustomer, setNewProjCustomer] = useState('');
  const [newProjType, setNewProjType] = useState<'construction' | 'furniture' | 'mechanical' | 'general'>('furniture');
  const [newProjValue, setNewProjValue] = useState(0);
  const [newProjPm, setNewProjPm] = useState('');
  const [newProjAddress, setNewProjAddress] = useState('');
  const [newProjStart, setNewProjStart] = useState('');
  const [newProjDuration, setNewProjDuration] = useState<number | ''>('');
  const [newProjNotes, setNewProjNotes] = useState('Tạo từ bảng Kanban.');
  const [newProjColumnId, setNewProjColumnId] = useState<string>('');
  
  const [showQuickCustModal, setShowQuickCustModal] = useState(false);

  useEffect(() => {
    if (columns && columns.length > 0 && !newProjColumnId) {
      setNewProjColumnId(columns[0].id);
    }
    if (employees && employees.length > 0 && !newProjPm) {
      const firstPm = employees.find(e => e.role === 'pm' || e.role === 'director');
      setNewProjPm(firstPm ? firstPm.id : 'emp_3');
    }
  }, [columns, employees, isOpen]);

  // Sync address when customer changes
  useEffect(() => {
    if (newProjCustomer) {
      const selectedCust = customers.find(c => c.id === newProjCustomer);
      if (selectedCust) {
        setNewProjAddress(selectedCust.address || '');
      }
    }
  }, [newProjCustomer, customers]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName.trim()) return;

    // 1. Prepare initial project object helper for name initials
    const code = `DA_${getAbbrev(newProjName) || 'DA'}_${projects.length + 1}`;
    
    let calculatedEndStr = '';
    if (newProjStart && newProjDuration) {
      const dt = new Date(newProjStart);
      dt.setDate(dt.getDate() + Number(newProjDuration));
      calculatedEndStr = dt.toISOString().split('T')[0];
    } else if (newProjDuration) {
      calculatedEndStr = `${newProjDuration} ngày`;
    }

    const customProject: Project = {
      id: `proj_${Date.now()}`,
      code,
      name: newProjName.trim(),
      customerId: newProjCustomer,
      address: newProjAddress.trim(),
      type: newProjType,
      contractValue: Number(newProjValue) || 0,
      startDate: newProjStart || '',
      endDate: calculatedEndStr,
      pmId: newProjPm,
      status: 'new',
      progress: 10,
      image: newProjType === 'furniture'
        ? 'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=400&q=80'
        : newProjType === 'mechanical'
        ? 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=400&q=80'
        : 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80',
      notes: newProjNotes.trim()
    };
    (customProject as any).kanbanColumnId = newProjColumnId;

    // 2. Run target column automation rules when initializing
    const targetCol = columns.find(c => c.id === newProjColumnId);
    let ruleLogs: string[] = [];
    if (targetCol && targetCol.automation) {
      const rule = targetCol.automation;

      // rule 1: Assign operator
      if (rule.assignId) {
        customProject.pmId = rule.assignId;
        const empName = employees.find(e => e.id === rule.assignId)?.name || 'Trưởng Dự Án mới';
        ruleLogs.push(`Giao cho PM phụ trách mới: ${empName}`);
      }

      // rule 2: Status update
      if (rule.statusUpdate) {
        customProject.status = rule.statusUpdate as any;
        const statusLabel = rule.statusUpdate === 'active' ? 'Đang thực hiện' : rule.statusUpdate === 'completed' ? 'Hoàn thành' : rule.statusUpdate === 'suspended' ? 'Tạm khiển' : rule.statusUpdate;
        ruleLogs.push(`Chuyển trạng thái dự án sang: ${statusLabel}`);
      }

      // rule 2.2: Style and formatting
      if (rule.textStyleStyleItalic !== undefined || rule.textStyleStyleBold !== undefined || rule.textStyleStyleStrike !== undefined || rule.textStyleStyleColor !== undefined) {
        customProject.styleItalic = rule.textStyleStyleItalic;
        customProject.styleBold = rule.textStyleStyleBold;
        customProject.styleStrike = rule.textStyleStyleStrike;
        customProject.styleColor = rule.textStyleStyleColor;
        ruleLogs.push(`Tự động định dạng kiểu chữ & màu sắc cho công trình`);
      }

      // rule 3: Approval request
      if (rule.approvalRole && rule.approvalRole !== 'none') {
        const roleLabel = rule.approvalRole === 'director' ? 'Giám Đốc (Trương Hữu Long)' : rule.approvalRole === 'accountant' ? 'Kế Toán trưởng (Lê Thị Mai)' : 'PM chuyên trách';
        ruleLogs.push(`Yêu cầu trình duyệt cấp: ${roleLabel}`);
      }

      // rule 6: Spawn subtasks
      const tasksToAdd: string[] = [];
      if (rule.subtaskTitles && rule.subtaskTitles.length > 0) {
        rule.subtaskTitles.forEach(title => {
          if (title && title.trim()) {
            tasksToAdd.push(title.trim());
          }
        });
      } else if (rule.subtaskTitle && rule.subtaskTitle.trim()) {
        tasksToAdd.push(rule.subtaskTitle.trim());
      }

      if (tasksToAdd.length > 0) {
        tasksToAdd.forEach((title, idx) => {
          const newTaskId = `task_auto_${Date.now()}_${idx}`;
          const dayOffset = rule.dueDateDaysOffset || 7;
          const subtaskAuto = (rule.subtaskAutomations && rule.subtaskAutomations[idx]) ? rule.subtaskAutomations[idx] : {};
          
          const assigneeId = subtaskAuto.assignId || rule.assignId || customProject.pmId || 'emp_3';
          const involvedEmployeeIds = Array.from(new Set([
            ...(customProject.involvedEmployeeIds || []),
            ...(rule.involvedId ? [rule.involvedId] : []),
            ...(subtaskAuto.involvedId ? [subtaskAuto.involvedId] : []),
            ...(subtaskAuto.involvedEmployeeIds || [])
          ]));

          // Send approval request
          let approvals = undefined;
          if (subtaskAuto.isApprovalEnabled === true) {
            const defaultApproverEmp = subtaskAuto.defaultApproverId ? employees.find(e => e.id === subtaskAuto.defaultApproverId) : null;
            const approverId = defaultApproverEmp ? defaultApproverEmp.id : (subtaskAuto.approvalRole === 'director' ? 'emp_1' : subtaskAuto.approvalRole === 'accountant' ? 'emp_2' : (customProject.pmId || 'emp_3'));
            const approverName = defaultApproverEmp ? defaultApproverEmp.name : (subtaskAuto.approvalRole === 'director' ? 'Giám Đốc (Trương Hữu Long)' : subtaskAuto.approvalRole === 'accountant' ? 'Kế Toán trưởng (Lê Thị Mai)' : 'PM chuyên trách');
            
            approvals = [{
              id: `app_sub_auto_${Date.now()}_${idx}`,
              levelName: `Quy trình duyệt: ${approverName}`,
              approverId: approverId,
              status: 'pending' as const
            }];
          }

          const autoTask: Task = {
            id: newTaskId,
            code: `CV-AUTO-${Math.floor(Math.random() * 900) + 100}`,
            projectId: customProject.id,
            columnId: targetCol.id,
            name: title,
            description: `Công việc con được tạo tự động bởi quy trình khi khởi tạo vào phân đoạn ${targetCol.name}. ${subtaskAuto.docTitle ? 'Yêu cầu lập hồ sơ thiết kế kèm theo.' : ''}`,
            assignerId: 'system',
            assigneeId: assigneeId,
            involvedEmployeeIds: involvedEmployeeIds,
            department: 'Thi công',
            deadline: new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            priority: 'medium',
            status: 'todo',
            completionRate: 0,
            notes: 'Nhiệm vụ tự trị Hoàng Long vách mộc',
            workLogs: [
              {
                id: `wl_auto_${Date.now()}`,
                actorId: 'system',
                actorName: 'Hệ thống tự động',
                action: 'Cấp phát nhiệm vụ tự động',
                timestamp: new Date().toISOString().split('T')[0],
                notes: `Khởi tạo công việc từ quy trình tự động khởi tạo phân đoạn ${targetCol.name}.`
              }
            ],
            styleItalic: subtaskAuto.textStyleStyleItalic,
            styleBold: subtaskAuto.textStyleStyleBold,
            styleStrike: subtaskAuto.textStyleStyleStrike,
            styleColor: subtaskAuto.textStyleStyleColor,
            checklistTexts: subtaskAuto.checklistTexts || [],
            approvals: approvals,
            isApprovalEnabled: subtaskAuto.isApprovalEnabled === true,
            isApprovalRequired: subtaskAuto.isApprovalRequired === true,
            isDocGenerationEnabled: subtaskAuto.isDocGenerationEnabled === true,
            isCostEnabled: subtaskAuto.isCostEnabled === true,
            isMaterialEnabled: subtaskAuto.isMaterialEnabled === true,
            isSubcontractorEnabled: subtaskAuto.isSubcontractorEnabled === true
          };
          onAddTask(autoTask);

          // Auto Document Generation
          if (subtaskAuto.docTemplateId && subtaskAuto.docTemplateId !== 'none') {
            const docTitle = subtaskAuto.docTitle || `Hồ sơ ${subtaskAuto.docTemplateId === 'quotation' ? 'Báo giá thầu' : subtaskAuto.docTemplateId === 'contract' ? 'Hợp đồng kinh tế' : subtaskAuto.docTemplateId === 'acceptance' ? 'Biên bản nghiệm thu' : 'Biên bản thanh lý'}`;
            const subtaskDoc: ProjectDoc = {
              id: `doc_sub_auto_${Date.now()}_${idx}`,
              type: subtaskAuto.docTemplateId as any,
              name: docTitle,
              code: `HS-AUTO-${Math.floor(Math.random() * 900) + 100}`,
              createdAt: new Date().toISOString().split('T')[0],
              status: 'draft',
              templateName: 'Hồ sơ thiết lập tự động từ công việc con',
              customFields: [
                { label: 'Công việc liên kết', value: title }
              ]
            };
            if (!customProject.documents) {
              customProject.documents = [];
            }
            customProject.documents.push(subtaskDoc);
          }
        });
        ruleLogs.push(`Tự động bổ nhiệm ${tasksToAdd.length} công việc con:\n` + tasksToAdd.map(t => `- "${t}"`).join('\n'));
      }

      // rule 8: Add checklist text
      if (rule.checklistTexts && rule.checklistTexts.length > 0) {
        const chkItems = rule.checklistTexts.filter(chk => chk && chk.trim());
        if (chkItems.length > 0) {
          ruleLogs.push(`Thêm các mục checklist yêu cầu:\n` + chkItems.map(chk => `- ${chk}`).join('\n'));
        }
      } else if (rule.checklistText) {
        ruleLogs.push(`Thêm mục checklist yêu cầu: ${rule.checklistText}`);
      }

      // rule 9: Add involved person
      const ruleInvolvedIds = rule.involvedEmployeeIds || (rule.involvedId ? [rule.involvedId] : []);
      if (ruleInvolvedIds.length > 0) {
        const currentInvolved = customProject.involvedEmployeeIds || [];
        const addedIds = ruleInvolvedIds.filter(id => !currentInvolved.includes(id));
        if (addedIds.length > 0) {
          customProject.involvedEmployeeIds = [...currentInvolved, ...addedIds];
          const names = addedIds.filter(Boolean).map(id => employees.find(e => e.id === id)?.name || 'Người hỗ trợ').join(', ');
          ruleLogs.push(`Thêm cộng sự hỗ trợ liên quan: ${names}`);
        }
      }
    }

    const ruleLogged = ruleLogs.join('. ') || '';
    const autoComment: ProjectDoc = {
      id: `log_${Date.now()}`,
      type: 'acceptance',
      name: `Khởi tạo dự án trực tiếp vào cột : ${targetCol ? targetCol.name : 'Khác'}`,
      code: `XN-${Math.floor(Math.random() * 900) + 100}`,
      createdAt: new Date().toISOString().split('T')[0],
      status: 'approved',
      templateName: 'Hệ thống tự động hóa',
      customFields: [
        { label: 'Hành động', value: `Khởi tạo tại cột [${targetCol ? targetCol.name : 'Khác'}]` },
        { label: 'Tự động kích hoạt', value: ruleLogged || 'Không có quy tắc áp dụng' }
      ]
    };
    customProject.documents = [autoComment];

    onAddProject(customProject);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 text-xs shadow-2xl animate-scaleIn text-slate-200">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                <Plus className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-sm">Khởi tạo Hồ sơ Dự án mới</h3>
                <p className="text-[10px] text-slate-500">Thiết lập chi tiết dự án trước khi đưa vào dải Kanban</p>
              </div>
            </div>
            <button 
              type="button" 
              onClick={onClose} 
              className="text-slate-500 hover:text-white cursor-pointer p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
            {/* Tên dự án/công trình */}
            <div>
              <label className="block text-slate-350 font-bold mb-1">Tên dự án/công trình <span className="text-rose-500 font-extrabold">*</span></label>
              <input
                type="text"
                required
                value={newProjName}
                onChange={(e) => setNewProjName(e.target.value)}
                placeholder="ví dụ: Biệt Thự Sân Vườn - Phan Văn Nam"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Mã dự án tự sinh */}
            <div>
              <label className="block text-slate-350 font-bold mb-1">Mã dự án (Khóa nhập liệu)</label>
              <input
                type="text"
                disabled
                value={newProjName ? `DA_${getAbbrev(newProjName) || 'DA'}_${projects.length + 1}` : 'DA_[Initials]_[Index]'}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-400 font-mono select-none cursor-not-allowed opacity-80"
              />
            </div>

            {/* Chủ đầu tư và Loại khách hàng */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-slate-350 font-bold">Chủ đầu tư (Khách hàng) <span className="text-rose-500 font-extrabold">*</span></label>
                  <button
                    type="button"
                    onClick={() => setShowQuickCustModal(true)}
                    className="text-emerald-400 hover:text-emerald-350 font-bold text-[10px] flex items-center gap-0.5 transition-colors cursor-pointer"
                  >
                    <span>➕ Thêm nhanh</span>
                  </button>
                </div>
                <select
                  required
                  value={newProjCustomer}
                  onChange={(e) => setNewProjCustomer(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white outline-none cursor-pointer focus:border-emerald-500 transition-colors text-[11px]"
                >
                  <option value="">-- Chọn khách hàng --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-350 font-bold mb-1">Loại khách hàng (Chỉ đọc)</label>
                <input
                  type="text"
                  disabled
                  value={
                    (() => {
                      const sel = customers.find(c => c.id === newProjCustomer);
                      if (!sel) return 'Chưa phân loại';
                      return sel.type === 'organization' ? '🏢 Tổ chức' : '👤 Cá nhân';
                    })()
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-400 outline-none select-none cursor-not-allowed opacity-80"
                />
              </div>
            </div>

            {/* Lĩnh vực và PM phụ trách */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-350 font-bold mb-1">Lĩnh vực (Loại dự án) <span className="text-rose-500 font-extrabold">*</span></label>
                <select
                  required
                  value={newProjType}
                  onChange={(e) => setNewProjType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white outline-none cursor-pointer focus:border-emerald-500 transition-colors text-[11px]"
                >
                  <option value="">-- Chọn lĩnh vực --</option>
                  <option value="construction">Xây dựng (Construction)</option>
                  <option value="furniture">Nội thất (Furniture)</option>
                  <option value="mechanical">Cơ khí (Mechanical)</option>
                  <option value="general">Tổng hợp (General)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-350 font-bold mb-1 col-span-1">PM chuyên trách phụ trách <span className="text-rose-500 font-extrabold">*</span></label>
                <select
                  required
                  value={newProjPm}
                  onChange={(e) => setNewProjPm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white outline-none cursor-pointer focus:border-emerald-500 transition-colors text-[11px]"
                >
                  <option value="">-- Chọn PM phụ trách --</option>
                  {employees.filter(emp => emp.role === 'pm' || emp.role === 'director').map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Địa điểm thi công */}
            <div>
              <label className="block text-slate-350 font-bold mb-1">Địa điểm thi công <span className="text-rose-500 font-extrabold">*</span></label>
              <input
                type="text"
                required
                value={newProjAddress}
                onChange={(e) => setNewProjAddress(e.target.value)}
                placeholder="ví dụ: 120 Hùng Vương, Đà Lạt, Lâm Đồng"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Ngày bắt đầu và Thời hạn HĐ */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-350 font-bold mb-1">Ngày bắt đầu</label>
                <input
                  type="date"
                  value={newProjStart}
                  onChange={(e) => setNewProjStart(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white outline-none focus:border-emerald-500 transition-colors font-mono text-[11px]"
                />
              </div>
              <div>
                <label className="block text-slate-350 font-bold mb-1">Thời hạn HĐ (tính theo ngày)</label>
                <input
                  type="number"
                  min="1"
                  placeholder="ví dụ: 90"
                  value={newProjDuration}
                  onChange={(e) => setNewProjDuration(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white outline-none focus:border-emerald-500 transition-colors font-mono"
                />
              </div>
            </div>

            {/* Phân đoạn khởi tạo (Cột Kanban) */}
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-slate-350 font-bold mb-1">Phân đoạn khởi tạo (Cột Kanban)</label>
                <select
                  value={newProjColumnId}
                  onChange={(e) => setNewProjColumnId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white outline-none cursor-pointer focus:border-emerald-500 transition-colors font-bold text-[11px]"
                >
                  {columns.map(col => (
                    <option key={col.id} value={col.id}>{col.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Ghi chú đặc thù */}
            <div>
              <label className="block text-slate-350 font-bold mb-1">Ghi chú đặc thù (Nhật trình / Yêu cầu kỹ nghệ)</label>
              <textarea
                value={newProjNotes}
                onChange={(e) => setNewProjNotes(e.target.value)}
                rows={2}
                placeholder="mô tả các yêu cầu cốt thô, nội mộc hay các ràng buộc tiến độ liên thông..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-755 text-slate-300 font-extrabold text-[11px] px-4 py-2 rounded-lg cursor-pointer transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px] px-4 py-2 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 shadow-md shadow-emerald-950/20"
            >
              <Check className="w-3.5 h-3.5" />
              Khởi tạo dự án
            </button>
          </div>
        </form>
      </div>

      <QuickAddCustomerModal
        isOpen={showQuickCustModal}
        onClose={() => setShowQuickCustModal(false)}
        customers={customers}
        onAddCustomer={onAddCustomer}
        onSuccess={(generatedId, address) => {
          setNewProjCustomer(generatedId);
          setNewProjAddress(address);
        }}
      />
    </>
  );
};
