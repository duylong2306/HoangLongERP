import React, { useState } from 'react';
import { Task, Project, Employee, TaskPriority, TaskStatus, Customer, Quote, LeaveRequest, Payment, SubcontractorAdvanceProposal } from '../types';
import {
  Plus, Check, Clock, Filter, CheckSquare, Eye, Users, ShieldCheck,
  MessageSquare, UserPlus, Trash2, Shield, DollarSign, Zap, FileText,
  Briefcase, Award, CheckCircle2, X
} from 'lucide-react';
import TaskDetailModal from './TaskDetailModal';
import ConnectedToolsModal from './ConnectedToolsModal';
import { dbService } from '../lib/dbService';
import { useNotification } from '../context';
import { createGroupConversation, addMessage, getConversations } from '../lib/chatStore';

/**
 * Tự động gửi tin nhắn vào nhóm chat của công việc (conv_task_<taskId>).
 * Nếu nhóm chưa tồn tại thì tạo mới từ danh sách người liên quan.
 * Tin nhắn được gắn cờ system: true (hoạt động tự động, không phải chat tay).
 */
function postTaskChat(
  taskId: string,
  senderId: string,
  senderName: string,
  senderRole: string,
  content: string,
  members: string[],
  taskName?: string,
  projectName?: string
) {
  const convId = `conv_task_${taskId}`;
  const convs = getConversations();
  const exists = convs.some(c => c.id === convId);
  if (!exists && members.length > 0) {
    createGroupConversation(
      `${projectName ? projectName.substring(0, 30) + ' - ' : ''}${taskName ? taskName.substring(0, 30) : 'Công việc'}`,
      Array.from(new Set(members.filter(Boolean))),
      senderId,
      taskId
    );
  }
  addMessage({
    conversationId: convId,
    senderId,
    senderName,
    senderRole: (senderRole || 'member') as any,
    content,
    system: true
  });
}

interface TaskManagementProps {
  tasks: Task[];
  projects: Project[];
  employees: Employee[];
  currentUser: Employee;
  onAddTask: (newTask: Task) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onUpdateProject?: (id: string, updates: Partial<Project>) => void;
  onDeleteTask?: (id: string) => void;
  onDeleteMultipleTasks?: (ids: string[]) => void;
  customers?: Customer[];
  quotes?: Quote[];
  onRedirectToQuote?: (projectId: string) => void;
  onRedirectToSubcontractor?: (projectId: string, subcontractorId: string, workName: string) => void;
  subcontractorAdvances?: SubcontractorAdvanceProposal[]; // Đề xuất tạm ứng / Thu Chi từ Tài Chính
}

export default function TaskManagement({
  tasks,
  projects,
  employees,
  currentUser,
  onAddTask,
  onUpdateTask,
  onUpdateProject,
  onDeleteTask,
  onDeleteMultipleTasks,
  customers,
  quotes,
  onRedirectToQuote,
  onRedirectToSubcontractor,
  subcontractorAdvances = []
}: TaskManagementProps) {
  const { addToast } = useNotification();
  // Bộ lọc
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterEmployee, setFilterEmployee] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Phạm vi SCOPE: "assigned" (Công việc được giao), "all" (Công việc liên quan) hoặc "toreview" (Công việc phải duyệt)
  const [taskScope, setTaskScope] = useState<'assigned' | 'all' | 'toreview'>('assigned');

  // Trạng thái cho Chi tiết công việc chọn Xem
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // States to view leave request or payment details under "Việc của tôi"
  const [viewingLeave, setViewingLeave] = useState<LeaveRequest | null>(null);
  const [viewingPayment, setViewingPayment] = useState<Payment | null>(null);

  // States cho Công cụ liên thông (Connected Tools) trong Việc của tôi
  const [activeConnectedTool, setActiveConnectedTool] = useState<'approval' | 'cost' | 'material' | 'quotation' | 'contract' | 'acceptance' | 'liquidation' | null>(null);
  const [activeConnectedToolTaskId, setActiveConnectedToolTaskId] = useState<string | null>(null);

  // States cho Yêu cầu phê duyệt
  const [ctApprovalSubject, setCtApprovalSubject] = useState('Phê duyệt kết quả bàn giao thiết kế sơ bộ');
  const [ctApprovalApprover, setCtApprovalApprover] = useState(employees[0]?.id || 'emp_1');
  const [ctApprovalLevelName, setCtApprovalLevelName] = useState('Ủy quyền duyệt một cấp dán chỉ mộc');

  // States cho Đề xuất chi phí
  const [ctCostTitle, setCtCostTitle] = useState('Chi cho đội thợ chính lắp sườn tủ mộc');
  const [ctCostAmount, setCtCostAmount] = useState<number>(1500000);
  const [ctCostReason, setCtCostReason] = useState('Chi phí tạm ứng mua vật liệu liên kết nhanh đợt 2');

  // States cho Đề xuất vật tư
  const [ctMatName, setCtMatName] = useState('Vách MDF chống ẩm phủ Melamine An Cường dày 18mm');
  const [ctMatQty, setCtMatQty] = useState<number>(12);
  const [ctMatUnit, setCtMatUnit] = useState('Tấm nguyên');
  const [ctMatSupplier, setCtMatSupplier] = useState('Đại lý phân phối mộc Hoàng Long CNC');

  // States cho Tài liệu liên thông (Báo giá, Hợp đồng, Nghiệm thu, Thanh lý)
  const [ctDocSector, setCtDocSector] = useState<'furniture' | 'construction' | 'mechanical'>('furniture');
  const [ctDocValue, setCtDocValue] = useState<number>(12000000);
  const [ctDocRepA, setCtDocRepA] = useState('Phan Văn Nam');
  const [ctDocPosA, setCtDocPosA] = useState('Đại diện Chủ đầu tư / Chủ căn hộ');
  const [ctDocRepB, setCtDocRepB] = useState('Trương Hữu Long');
  const [ctDocPosB, setCtDocPosB] = useState('Trưởng Dự Án thầu đại diện thợ thi công');
  const [ctDocWarranty, setCtDocWarranty] = useState('12 tháng kể từ ngày ký biên bản');
  const [ctDocLocation, setCtDocLocation] = useState('Thành phố Bảo Lộc, Lâm Đồng');
  const [ctDocAcceptRate, setCtDocAcceptRate] = useState<number>(100);

  // Form thêm mới công việc
  const [showForm, setShowForm] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskProj, setNewTaskProj] = useState(projects[0]?.id || '');
  const [newTaskAssignee, setNewTaskAssignee] = useState(employees[3]?.id || '');
  const [newTaskDeadline, setNewTaskDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
  const [newTaskDept, setNewTaskDept] = useState('Phòng Kỹ Thuật');

  // Trạng thái phụ tạo mẻ công việc mới: Người liên quan và Cấp duyệt ban đầu
  const [newInvolvedIds, setNewInvolvedIds] = useState<string[]>([]);
  const [newApprovals, setNewApprovals] = useState<{ levelName: string; approverId: string }[]>([]);
  const [tempLevelName, setTempLevelName] = useState('');
  const [tempApproverId, setTempApproverId] = useState(employees[0]?.id || '');

  // Đồng bộ dải màu chủ đạo với hiển thị hệ thống
  const [displaySettings] = useState(() => {
    const saved = localStorage.getItem('hl_display_settings');
    if (saved) return JSON.parse(saved);
    return { primaryAccent: 'emerald' };
  });

  const accentColor = displaySettings.primaryAccent || 'emerald';

  const accentBgClass = 
    accentColor === 'emerald' ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-extrabold' :
    accentColor === 'sky' ? 'bg-sky-500 text-slate-950 hover:bg-sky-400 font-extrabold' :
    accentColor === 'indigo' ? 'bg-indigo-600 text-white hover:bg-indigo-505 font-extrabold' :
    accentColor === 'amber' ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 font-extrabold' :
    accentColor === 'rose' ? 'bg-rose-500 text-white hover:bg-rose-450 font-extrabold' : 'bg-violet-500 text-white hover:bg-violet-450 font-extrabold';

  const accentTextClass = 
    accentColor === 'emerald' ? 'text-emerald-400' :
    accentColor === 'sky' ? 'text-sky-400' :
    accentColor === 'indigo' ? 'text-indigo-400' :
    accentColor === 'amber' ? 'text-amber-400' :
    accentColor === 'rose' ? 'text-rose-400' : 'text-violet-400';

  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  // Tải leaves & payments từ Supabase khi mount hoặc chuyển tab
  React.useEffect(() => {
    if (taskScope === 'toreview') {
      dbService.hrmLeaves.list().then(data => setLeaves(data || [])).catch(console.error);
      dbService.payments.list().then(data => setPayments(data || [])).catch(console.error);
    }
  }, [taskScope]);

  const handleApproveLeave = async (id: string, status: 'approved' | 'rejected') => {
    const getLeaveSymbol = (type: string) => {
      try {
        const coefsSaved = localStorage.getItem('hl_hrm_leave_coefs_v6');
        if (coefsSaved) {
          const coefs = JSON.parse(coefsSaved);
          if (Array.isArray(coefs)) {
            const found = coefs.find((c: any) => c.type === type);
            if (found) return found.id || 'OFF';
          }
        }
      } catch (e) {
        console.error(e);
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
          dates.push(d.toISOString().split('T')[0]);
        }
      } catch (err) {
        console.error(err);
      }
      return dates;
    };

    // Tìm leave cần xử lý
    const targetLeave = leaves.find(l => l.id === id);
    if (!targetLeave) return;

    // Thực hiện async work trước (cập nhật phepNam, attendance trên Supabase)
    if (status === 'approved') {
      // A. Trừ ngày phép năm nếu là nghỉ phép năm
      if (targetLeave.type === 'Nghỉ phép năm' && targetLeave.status !== 'approved') {
        try {
          const empsList = await dbService.employees.list();
          if (Array.isArray(empsList)) {
            const changedEmp = empsList.find((emp: any) => emp.id === targetLeave.empId);
            if (changedEmp) {
              const currentPhep = (changedEmp as any).phepNam !== undefined ? (changedEmp as any).phepNam : 12;
              const leaveDays = targetLeave.daysCount !== undefined ? targetLeave.daysCount : 1;
              const updatedEmp = { ...changedEmp, phepNam: Math.max(0, currentPhep - leaveDays) } as any;
              await dbService.employees.save(updatedEmp).catch(() => {});
            }
          }
        } catch (e) {
          console.error("Lỗi khi cập nhật số ngày phép năm:", e);
        }
      }

      // B. Cập nhật attendance trên Supabase
      try {
        const symbol = getLeaveSymbol(targetLeave.type);
        const attendance = await dbService.attendance.list();
        const leaveDates = getDaysDiffList(targetLeave.fromDate, targetLeave.toDate);
        const toSave: any[] = [];

        leaveDates.forEach(dStr => {
          const idx = attendance.findIndex((at: any) => at.empId === targetLeave.empId && at.date === dStr);
          if (idx !== -1) {
            if (targetLeave.isAttendanceCorrection || targetLeave.type === 'Yêu cầu xét duyệt công' || targetLeave.type === 'Báo cáo nghỉ ca' || targetLeave.type === 'Báo cáo lỗi chấm ra ca') {
              const currentAt = attendance[idx];
              let timeInS = currentAt.timeInS, timeOutS = currentAt.timeOutS, timeInC = currentAt.timeInC, timeOutC = currentAt.timeOutC;
              if (targetLeave.type === 'Báo cáo lỗi chấm ra ca') {
                if (targetLeave.shift === 'morning') timeOutS = '11:30';
                else if (targetLeave.shift === 'afternoon') timeOutC = '17:00';
              } else if (targetLeave.type !== 'Báo cáo nghỉ ca') {
                timeInS = currentAt.timeInS && currentAt.timeInS !== '--:--' && currentAt.timeInS !== '' ? currentAt.timeInS : '07:30';
                timeOutS = currentAt.timeOutS && currentAt.timeOutS !== '--:--' && currentAt.timeOutS !== '' ? currentAt.timeOutS : '11:30';
                timeInC = currentAt.timeInC && currentAt.timeInC !== '--:--' && currentAt.timeInC !== '' ? currentAt.timeInC : '13:00';
                timeOutC = currentAt.timeOutC && currentAt.timeOutC !== '--:--' && currentAt.timeOutC !== '' ? currentAt.timeOutC : '17:00';
              }
              attendance[idx] = { ...currentAt, timeInS, timeOutS, timeInC, timeOutC, status: 'valid', statusMsg: 'Hợp lệ', leaveSymbol: undefined, notes: targetLeave.reason };
              toSave.push(attendance[idx]);
            } else {
              attendance[idx] = { ...attendance[idx], timeInS: symbol, timeOutS: symbol, timeInC: symbol, timeOutC: symbol, status: 'excused', leaveSymbol: symbol, notes: `Nghỉ phép được duyệt: ${targetLeave.type} (${symbol})` };
              toSave.push(attendance[idx]);
            }
          } else {
            let timeInS = symbol, timeOutS = symbol, timeInC = symbol, timeOutC = symbol, method = 'Hành chính phép', st = 'excused';
            if (targetLeave.isAttendanceCorrection || targetLeave.type === 'Yêu cầu xét duyệt công' || targetLeave.type === 'Báo cáo nghỉ ca' || targetLeave.type === 'Báo cáo lỗi chấm ra ca') {
              method = 'Duyệt công'; st = 'valid';
              timeInS = '07:30'; timeOutS = '11:30'; timeInC = '13:00'; timeOutC = '17:00';
              if (targetLeave.type === 'Báo cáo lỗi chấm ra ca') {
                if (targetLeave.shift === 'morning') { timeInC = ''; timeOutC = ''; }
                else { timeInS = ''; timeOutS = ''; }
              } else if (targetLeave.type === 'Báo cáo nghỉ ca') {
                if (targetLeave.shift === 'morning') { timeInS = ''; timeOutS = ''; }
                else { timeInC = ''; timeOutC = ''; }
              }
            }
            const newLog = { id: `AT-${Date.now().toString().slice(-3)}-${Math.random().toString().slice(-2)}`, empId: targetLeave.empId, empName: targetLeave.empName, date: dStr, timeInS, timeOutS, timeInC, timeOutC, timeInOT: '', timeOutOT: '', method, status: st, statusMsg: st === 'valid' ? 'Hợp lệ' : undefined, otHours: 0, leaveSymbol: st === 'excused' ? symbol : undefined, notes: targetLeave.reason || `Nghỉ phép được duyệt: ${targetLeave.type} (${symbol})` };
            attendance.unshift(newLog);
            toSave.push(newLog);
          }
        });

        for (const rec of toSave) {
          await dbService.attendance.save(rec).catch(() => {});
        }
      } catch (e) {
        console.error(e);
      }
    } else if (status === 'rejected') {
      // Cập nhật attendance khi từ chối
      if (targetLeave.type === 'Báo cáo nghỉ ca' || targetLeave.type === 'Báo cáo lỗi chấm ra ca') {
        try {
          const attendance = await dbService.attendance.list();
          const leaveDates = getDaysDiffList(targetLeave.fromDate, targetLeave.toDate);
          const toSave: any[] = [];

          leaveDates.forEach(dStr => {
            const idx = attendance.findIndex((at: any) => at.empId === targetLeave.empId && at.date === dStr);
            if (idx !== -1) {
              attendance[idx] = { ...attendance[idx], status: 'invalid', statusMsg: 'Không hợp lệ', notes: `Bị từ chối duyệt: ${targetLeave.reason || ''}` };
              toSave.push(attendance[idx]);
            } else {
              const newLog = { id: `AT-${Date.now().toString().slice(-3)}-${Math.random().toString().slice(-2)}`, empId: targetLeave.empId, empName: targetLeave.empName, date: dStr, timeInS: targetLeave.shift === 'morning' ? 'OFF' : '', timeOutS: '', timeInC: targetLeave.shift === 'afternoon' ? 'OFF' : '', timeOutC: '', timeInOT: '', timeOutOT: '', method: 'Duyệt công', status: 'invalid', statusMsg: 'Không hợp lệ', otHours: 0, notes: `Bị từ chối duyệt: ${targetLeave.reason || ''}` };
              attendance.unshift(newLog);
              toSave.push(newLog);
            }
          });

          for (const rec of toSave) {
            await dbService.attendance.save(rec).catch(() => {});
          }
        } catch (e) {
          console.error(e);
        }
      }
    }

    // Cập nhật state leaves (đồng bộ)
    const updated = leaves.map(l => l.id === id ? { ...l, status } : l);
    setLeaves(updated);
    // Lưu đơn đã duyệt/từ chối lên Supabase
    const changed = updated.find(l => l.id === id);
    if (changed) dbService.hrmLeaves.save(changed).catch(() => {});
    if (status === 'approved') {
      addToast({ title: 'ℹ️ Thông báo', message: "Đã duyệt", type: 'info' });
    } else {
      addToast({ title: 'ℹ️ Thông báo', message: "Từ chối", type: 'info' });
    }
  };

  const handleApprovePayment = (id: string, status: 'approved' | 'rejected') => {
    const updatedPayment = payments.find(p => p.id === id);
    const updated = payments.map(p => p.id === id ? { ...p, status } : p);
    setPayments(updated);
    if (updatedPayment) {
      dbService.payments.save({ ...updatedPayment, status }).catch(err =>
        console.warn('Lỗi khi lưu trạng thái duyệt thanh toán lên Supabase:', err));
    }
    addToast({ title: '✅ Đã cập nhật', message: `Đã cập nhật đề xuất thanh toán [${id}] sang trạng thái: ${status === 'approved' ? 'Phê duyệt ✅' : 'Từ chối ❌'}`, type: 'success' });
  };

  // Xử lý duyệt Đề Xuất Thu Chi (Subcontractor Advance Proposal)
  // Trạng thái: 'pending_approval' (Chờ Duyệt BGĐ) -> 'pending_payment' (Chờ Lập Phiếu KT) | 'rejected'
  const handleApproveAdvance = async (id: string, decision: 'approved' | 'rejected') => {
    const adv = subcontractorAdvances.find(a => a.id === id);
    if (!adv) return;
    const newStatus = decision === 'approved' ? 'pending_payment' : 'rejected';
    const updated: SubcontractorAdvanceProposal = { ...adv, status: newStatus };
    try {
      await dbService.subcontractorAdvances.save(updated);
      window.dispatchEvent(new CustomEvent('hl-subcontractor-advances-updated', { detail: updated }));
      addToast({
        title: decision === 'approved' ? '✅ Đã phê duyệt' : '❌ Đã từ chối',
        message: `Đề xuất ${id} → ${decision === 'approved' ? 'Chờ Lập Phiếu (KT)' : 'Từ Chối'}`,
        type: decision === 'approved' ? 'success' : 'info'
      });
    } catch (err) {
      addToast({ title: '❌ Lỗi', message: `Thất bại: ${err instanceof Error ? err.message : String(err)}`, type: 'error' });
    }
  };

  const handleClearPendingPayments = async () => {
    const pendingList = payments.filter(p => p.status === 'pending' && (p.proposer === currentUser.name || p.recipient === currentUser.name || p.approver === currentUser.name));
    if (pendingList.length === 0) {
      addToast({ title: 'ℹ️ Thông báo', message: 'Không có dữ liệu chờ duyệt nào.', type: 'warning' });
      return;
    }

    if (window.confirm(`Bạn có chắc chắn muốn xóa tất cả ${pendingList.length} dữ liệu đang chờ duyệt của PHÒNG KẾ TOÁN?`)) {
      const pendingIds = pendingList.map(p => p.id);
      const updated = payments.filter(p => p.status !== 'pending');

      setPayments(updated);

      try {
        for (const id of pendingIds) {
          await dbService.payments.delete(id).catch(err => {
            console.warn(`Could not delete payment ${id} from Supabase:`, err);
          });
        }
        addToast({ title: '🗑️ Đã xóa', message: 'Đã xóa sạch toàn bộ dữ liệu chờ duyệt thành công!', type: 'info' });
      } catch (err) {
        console.error('Lỗi khi xóa dữ liệu trên Supabase:', err);
        addToast({ title: '🗑️ Đã xóa', message: 'Đã xóa dữ liệu cục bộ, nhưng gặp lỗi khi đồng bộ Supabase.', type: 'info' });
      }
    }
  };

  const accentBorderClass = 
    accentColor === 'emerald' ? 'border-emerald-500/20' :
    accentColor === 'sky' ? 'border-sky-500/20' :
    accentColor === 'indigo' ? 'border-indigo-500/10' :
    accentColor === 'amber' ? 'border-amber-500/20' :
    accentColor === 'rose' ? 'border-rose-500/20' : 'border-violet-500/20';

  const taskStatusLabels: Record<TaskStatus, string> = {
    todo: 'Chưa làm',
    doing: 'Đang làm',
    reviewing: 'Chờ duyệt',
    completed: 'Hoàn thành',
    overdue: 'Trễ hạn'
  };

  const priorityColors: Record<TaskPriority, string> = {
    high: 'text-red-400 bg-red-950/40 border border-red-900/50',
    medium: 'text-amber-400 bg-amber-950/40 border border-amber-900/50',
    low: 'text-blue-400 bg-blue-950/40 border border-blue-900/50'
  };

  const statusColors: Record<TaskStatus, string> = {
    todo: 'bg-white text-slate-500 border-slate-300 shadow-sm',
    doing: 'bg-white text-sky-600 border-sky-300 shadow-sm',
    reviewing: 'bg-white text-indigo-600 border-indigo-300 shadow-sm',
    completed: 'bg-white text-emerald-600 border-emerald-300 shadow-sm',
    overdue: 'bg-white text-rose-600 border-rose-300 shadow-sm'
  };

  // Trình xử lý tạo Task mới
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName.trim()) return;

    const codeNum = tasks.length + 1;
    const paddingCode = codeNum < 10 ? `00${codeNum}` : codeNum < 100 ? `0${codeNum}` : `${codeNum}`;

    const newlyCreatedTask: Task = {
      id: `task_${Date.now()}`,
      code: `CV-${paddingCode}`,
      projectId: newTaskProj || undefined,
      name: newTaskName,
      description: newTaskDesc,
      assignerId: currentUser.id,
      assigneeId: newTaskAssignee,
      department: newTaskDept,
      deadline: newTaskDeadline,
      priority: newTaskPriority,
      status: 'todo',
      completionRate: 0,
      involvedEmployeeIds: newInvolvedIds.length > 0 ? newInvolvedIds : undefined,
      
      // Khai mốc duyệt ngầm định
      approvals: newApprovals.length > 0 ? newApprovals.map((ap, i) => ({
        id: `app_${Date.now()}_${i}`,
        levelName: ap.levelName,
        approverId: ap.approverId,
        status: 'pending' as const
      })) : [
        {
          id: `app_def_1_${Date.now()}`,
          levelName: "Cấp 1: Kiểm chỉ số thiết kế gốc thô",
          approverId: newTaskAssignee,
          status: 'pending' as const
        },
        {
          id: `app_def_2_${Date.now()}`,
          levelName: "Cấp 2: Quản lý kỹ thuật chốt dung sai",
          approverId: projects.find(p => p.id === newTaskProj)?.pmId || 'emp_3',
          status: 'pending' as const
        },
        {
          id: `app_def_3_${Date.now()}`,
          levelName: "Cấp 3: Giám Đốc phê duyệt nghiệm thu mộc",
          approverId: 'emp_1',
          status: 'pending' as const
        }
      ],

      // Khởi tạo đề xuất tài chính tạm ứng ban đầu làm mẫu dữ liệu chạy thật linh hoạt
      advanceRequests: [
        {
          id: `adv_gen_1_${Date.now()}`,
          title: `Tạm ứng mua vật tư phụ mộc, vít cơ & bản lề hơi thi công ${newTaskName}`,
          amount: 500000,
          status: 'pending' as const,
          reason: 'Lập khẩn thiết bị lắp sườn mộc mạc âm liên kết.',
          proposerName: employees.find(emp => emp.id === newTaskAssignee)?.name || currentUser.name,
          date: new Date().toISOString().split('T')[0],
          type: 'advance'
        }
      ],

      workLogs: [
        {
          id: `wl_init_${Date.now()}`,
          actorId: currentUser.id,
          actorName: currentUser.name,
          action: 'Khởi tạo công việc mới.',
          timestamp: new Date().toISOString()
        }
      ]
    };

    onAddTask(newlyCreatedTask);

    // Tự động gửi tin nhắn vào nhóm chat của công việc (người gửi = người thao tác)
    const proj = projects.find(p => p.id === newTaskProj);
    postTaskChat(
      newlyCreatedTask.id,
      currentUser.id,
      currentUser.name,
      currentUser.role || 'member',
      `🆕 ${currentUser.name} đã tạo công việc mới: "${newTaskName}".`,
      [currentUser.id, newTaskAssignee, ...(newInvolvedIds || []), proj?.pmId].filter(Boolean) as string[],
      newTaskName,
      proj?.name
    );

    // Reset form states
    setNewTaskName('');
    setNewTaskDesc('');
    setNewInvolvedIds([]);
    setNewApprovals([]);
    setShowForm(false);
  };

  // Lọc dữ liệu hiển thị
  const filteredTasks = tasks.filter(task => {
    const hasMainAssigneeMission = task.missions?.some(m => m.mainAssigneeId === currentUser?.id);
    const hasMemberMission = task.missions?.some(m => m.memberIds?.includes(currentUser?.id));

    if (taskScope === 'assigned') {
      // Công việc được giao: Chỉ hiển thị các công việc mà người nhận việc được giao (hoặc có nhiệm vụ phụ mà user là phụ trách chính)
      const isTaskMainAssignee = task.assigneeId === currentUser?.id || hasMainAssigneeMission;
      if (!isTaskMainAssignee) {
        return false;
      }
    } else if (taskScope === 'toreview') {
      // Công việc phải duyệt: Có trạng thái chờ duyệt mà người giao việc phụ trách (Kiểm tra linh hoạt theo cả ID, tên, hoặc nếu có quy trình duyệt cho user)
      const isMyAssignedTask = task.assignerId === currentUser?.id || 
                               task.assignerId === currentUser?.name ||
                               task.approvals?.some(ap => ap.approverId === currentUser?.id || ap.approverId === currentUser?.name);
      if (task.status !== 'reviewing' || !isMyAssignedTask) {
        return false;
      }
    } else {
      // taskScope === 'all' đại diện cho Công việc liên quan:
      // Chỉ hiển thị cho những người hỗ trợ liên quan, KHÔNG hiển thị cho người giao việc và người nhận việc
      const isAssignee = task.assigneeId === currentUser?.id || task.assigneeId === currentUser?.name || hasMainAssigneeMission;
      const isAssigner = task.assignerId === currentUser?.id || 
                         task.assignerId === currentUser?.name ||
                         task.approvals?.some(ap => ap.approverId === currentUser?.id || ap.approverId === currentUser?.name);

      if (isAssignee || isAssigner) {
        return false;
      }

      const projectOfTask = projects.find(p => p.id === task.projectId);
      const isProjectInvolved = projectOfTask?.involvedEmployeeIds?.includes(currentUser?.id);
      const isTaskInvolved = task.involvedEmployeeIds?.includes(currentUser?.id) || 
                             task.involvedEmployeeIds?.includes(currentUser?.name) ||
                             hasMemberMission;

      if (!isProjectInvolved && !isTaskInvolved) {
        return false;
      }
    }

    const matchProj = filterProject === 'all' || task.projectId === filterProject;
    const matchEmp = filterEmployee === 'all' || task.assigneeId === filterEmployee || task.involvedEmployeeIds?.includes(filterEmployee);
    const matchStatus = taskScope === 'toreview' ? true : (filterStatus === 'all' || task.status === filterStatus);
    return matchProj && matchEmp && matchStatus;
  });

  // Đếm số lượng công việc liên quan để hiển thị ở tab badge
  const relatedTasksCount = tasks.filter(task => {
    const hasMainAssigneeMission = task.missions?.some(m => m.mainAssigneeId === currentUser?.id);
    const hasMemberMission = task.missions?.some(m => m.memberIds?.includes(currentUser?.id));

    const isAssignee = task.assigneeId === currentUser?.id || task.assigneeId === currentUser?.name || hasMainAssigneeMission;
    const isAssigner = task.assignerId === currentUser?.id || 
                       task.assignerId === currentUser?.name ||
                       task.approvals?.some(ap => ap.approverId === currentUser?.id || ap.approverId === currentUser?.name);

    if (isAssignee || isAssigner) {
      return false;
    }

    const projectOfTask = projects.find(p => p.id === task.projectId);
    const isProjectInvolved = projectOfTask?.involvedEmployeeIds?.includes(currentUser?.id);
    const isTaskInvolved = task.involvedEmployeeIds?.includes(currentUser?.id) || 
                           task.involvedEmployeeIds?.includes(currentUser?.name) ||
                           hasMemberMission;

    return isProjectInvolved || isTaskInvolved;
  }).length;

  // Đếm số lượng công việc phải duyệt của tôi
  const toReviewTasksCount = tasks.filter(t => 
    t.status === 'reviewing' && 
    (t.assignerId === currentUser?.id || 
     t.assignerId === currentUser?.name ||
     t.approvals?.some(ap => ap.approverId === currentUser?.id || ap.approverId === currentUser?.name))
  ).length;

  // --- TÍNH TOÁN CÁC CÔNG VIỆC CHƯA HOÀN THÀNH ĐỂ HIỂN THỊ BADGE ĐỎ ---
  // 1. Công việc được giao chưa hoàn thành (status !== 'completed')
  const assignedUncompletedCount = tasks.filter(t => {
    const hasMainAssigneeMission = t.missions?.some(m => m.mainAssigneeId === currentUser?.id);
    const isAssignee = t.assigneeId === currentUser?.id || t.assigneeId === currentUser?.name || hasMainAssigneeMission;
    return isAssignee && t.status !== 'completed';
  }).length;

  // 2. Công việc phải duyệt chưa hoàn thành (mặc định đã là trạng thái 'reviewing' nên tương đương toReviewTasksCount)
  const toReviewUncompletedCount = toReviewTasksCount 
    + leaves.filter(l => l.status === 'pending').length 
    + payments.filter(p => p.status === 'pending' && (p.proposer === currentUser.name || p.recipient === currentUser.name || p.approver === currentUser.name)).length;

  // 3. Công việc liên quan chưa hoàn thành (status !== 'completed')
  const relatedUncompletedCount = tasks.filter(task => {
    if (task.status === 'completed') {
      return false;
    }
    const hasMainAssigneeMission = task.missions?.some(m => m.mainAssigneeId === currentUser?.id);
    const hasMemberMission = task.missions?.some(m => m.memberIds?.includes(currentUser?.id));

    const isAssignee = task.assigneeId === currentUser?.id || task.assigneeId === currentUser?.name || hasMainAssigneeMission;
    const isAssigner = task.assignerId === currentUser?.id || 
                       task.assignerId === currentUser?.name ||
                       task.approvals?.some(ap => ap.approverId === currentUser?.id || ap.approverId === currentUser?.name);

    if (isAssignee || isAssigner) {
      return false;
    }

    const projectOfTask = projects.find(p => p.id === task.projectId);
    const isProjectInvolved = projectOfTask?.involvedEmployeeIds?.includes(currentUser?.id);
    const isTaskInvolved = task.involvedEmployeeIds?.includes(currentUser?.id) || 
                           task.involvedEmployeeIds?.includes(currentUser?.name) ||
                           hasMemberMission;

    return isProjectInvolved || isTaskInvolved;
  }).length;

  // Nhóm công việc theo từng Dự Án
  const groupedTasks: Record<string, Task[]> = {};
  filteredTasks.forEach(task => {
    const pId = task.projectId || 'unassigned';
    if (!groupedTasks[pId]) {
      groupedTasks[pId] = [];
    }
    groupedTasks[pId].push(task);
  });

  return (
    <div className="space-y-4 text-slate-100">
      {/* KHU VỰC TIÊU ĐỀ & NÚT THÊM VIỆC */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900 text-white p-4 rounded-xl border border-slate-800 gap-3">
        <div>
          <h2 className="text-base font-extrabold flex items-center gap-2">
            <CheckSquare className={`w-5 h-5 ${accentTextClass}`} />
            Bảng Điều Hành Công Việc & Giám Sát Kỹ Thuật (Phê Duyệt Nhiều Cấp)
          </h2>
          <p className="text-[11px] text-slate-400 font-medium">
            Giám sát kỹ thuật xây dựng công trình, sản xuất mộc mạc xưởng, dán chỉ cạnh tự do găm người và chấm công giờ thực địa.
          </p>
        </div>
      </div>

      {/* CHUYỂN ĐỔI PHẠM VI CÔNG VIỆC: ĐƯỢC GIAO / PHẢI DUYỆT / LIÊN QUAN (Đồng bộ dải màu) */}
      <div className="grid grid-cols-3 p-1 bg-slate-950 border border-slate-800 rounded-xl">
        <button
          type="button"
          onClick={() => setTaskScope('assigned')}
          className={`py-2 px-3 text-xs font-bold rounded-lg transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer ${
            taskScope === 'assigned'
              ? `${accentBgClass} shadow-sm`
              : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>Công việc được giao</span>
          {assignedUncompletedCount > 0 && (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-danger-soft text-fg-danger-strong text-[10px] font-black shadow-sm ring-1 ring-rose-500/30 animate-pulse">
              {assignedUncompletedCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTaskScope('toreview')}
          className={`py-2 px-3 text-xs font-bold rounded-lg transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer ${
            taskScope === 'toreview'
              ? `${accentBgClass} shadow-sm`
              : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Công việc phải duyệt</span>
          {toReviewUncompletedCount > 0 && (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-danger-soft text-fg-danger-strong text-[10px] font-black shadow-sm ring-1 ring-rose-500/30 animate-pulse">
              {toReviewUncompletedCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTaskScope('all')}
          className={`py-2 px-3 text-xs font-bold rounded-lg transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer ${
            taskScope === 'all'
              ? `${accentBgClass} shadow-sm`
              : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Công việc liên quan</span>
          {relatedUncompletedCount > 0 && (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-danger-soft text-fg-danger-strong text-[10px] font-black shadow-sm ring-1 ring-rose-500/30 animate-pulse">
              {relatedUncompletedCount}
            </span>
          )}
        </button>
      </div>

      {/* FORM LẬP CÔNG VIỆC MỚI CHI TIẾT */}
      {showForm && (
        <form onSubmit={handleCreateTask} className="bg-slate-900 text-slate-100 border border-slate-800 rounded-xl p-4 shadow-sm space-y-4 text-xs animate-fade-in animate-duration-150">
          <div className="border-b border-slate-800 pb-2 flex justify-between items-center">
            <span className={`font-extrabold uppercase text-[11.5px] flex items-center gap-1 ${accentTextClass}`}>
              <UserPlus className="w-4.5 h-4.5 animate-pulse" />
              Thiết kế phiếu giao việc & Quy trình kiểm định chất lượng thi công
            </span>
            <span className="text-slate-450 font-semibold">Người giao: <strong className="text-slate-200">{currentUser.name}</strong></span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-6">
              <label className="block text-slate-300 font-bold mb-1">Tên mục công việc / Nhiệm vụ thi công</label>
              <input
                type="text"
                required
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                placeholder="vd: Ép keo gia công chỉ nẹp bo cạnh thô tủ bếp trên"
                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 outline-none font-medium focus:border-slate-700 text-xs text-white"
              />
            </div>
            
            <div className="md:col-span-3">
              <label className="block text-slate-300 font-bold mb-1">Chọn Dự án liên kết</label>
              <select
                value={newTaskProj}
                onChange={(e) => setNewTaskProj(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded p-1.5 outline-none cursor-pointer focus:border-slate-705"
              >
                <option value="" className="bg-slate-900 text-white">Nhiệm vụ chung nội bộ</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-white">[{p.code}] {p.name}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-slate-300 font-bold mb-1">Phụ Trách Công Việc (Assignee)</label>
              <select
                value={newTaskAssignee}
                onChange={(e) => setNewTaskAssignee(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded p-1.5 outline-none cursor-pointer focus:border-slate-705"
              >
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id} className="bg-slate-900 text-white">{emp.name} ({emp.role?.toUpperCase() ?? ''})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-slate-300 font-bold mb-1">Độ ưu tiên</label>
              <select
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded p-1.5 outline-none cursor-pointer focus:border-slate-705"
              >
                <option value="low" className="bg-slate-900 text-white">Thấp (Low)</option>
                <option value="medium" className="bg-slate-900 text-white">Trung bình (Medium)</option>
                <option value="high" className="bg-slate-900 text-white">Cao (High Urgent)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Thời hạn cam kết</label>
              <input
                type="date"
                required
                value={newTaskDeadline}
                onChange={(e) => setNewTaskDeadline(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded p-1 text-xs outline-none focus:border-slate-705"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Bộ phận tác chiến</label>
              <input
                type="text"
                required
                value={newTaskDept}
                onChange={(e) => setNewTaskDept(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded p-1.5 text-xs outline-none focus:border-slate-705"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Nhân sự liên quan hỗ trợ giám sát</label>
              <div className="flex gap-1 flex-wrap border border-slate-800 rounded p-1.5 bg-slate-955 min-h-[32px]">
                {employees
                  .filter(e => e.id !== newTaskAssignee)
                  .map(emp => {
                    const isSelected = newInvolvedIds.includes(emp.id);
                    return (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setNewInvolvedIds(newInvolvedIds.filter(id => id !== emp.id));
                          } else {
                            setNewInvolvedIds([...newInvolvedIds, emp.id]);
                          }
                        }}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition cursor-pointer ${
                          isSelected ? `${accentBgClass} border-transparent` : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border-slate-800'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '}{emp.name}
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">Mô tả đặc tả kỹ thuật và cốt gia công chi tiết</label>
            <textarea
              value={newTaskDesc}
              onChange={(e) => setNewTaskDesc(e.target.value)}
              placeholder="Nhập thông số kích thước dung sai, cốt gỗ công nghiệp sử dụng, yêu cầu ép lực, đinh mộng và kỹ thuật lắp ghép..."
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs h-16 outline-none text-white focus:border-slate-705"
            />
          </div>

          {/* DYNAMIC APPROVAL BUILDER */}
          <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg space-y-2">
            <span className="font-extrabold text-[10.5px] uppercase tracking-wider block text-slate-300">⚙️ Thiết kế Quy trình Phê Duyệt Nhiều Cấp mốc Nghiệm Thu (Khuyên dùng)</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end bg-slate-905 border border-slate-800 p-2 rounded-lg">
              <div>
                <label className="block text-slate-450 font-bold text-[9px] uppercase mb-0.5">Tên cấp kiểm định</label>
                <input 
                  type="text"
                  placeholder="vd: Côn thô bọc viền nẹp sắt chống lệch mốc"
                  value={tempLevelName}
                  onChange={(e) => setTempLevelName(e.target.value)}
                  className="w-full bg-slate-950 text-white border border-slate-800 rounded p-1 text-[10px] outline-none focus:border-slate-750"
                />
              </div>
              <div>
                <label className="block text-slate-450 font-bold text-[9px] uppercase mb-0.5">Người duyệt (Phụ Trách Nhiệm Vụ)</label>
                <select
                  value={tempApproverId}
                  onChange={(e) => setTempApproverId(e.target.value)}
                  className="w-full bg-slate-950 text-white border border-slate-800 rounded p-1 text-[10px] outline-none cursor-pointer focus:border-slate-755 font-semibold"
                >
                  {employees.map(e => (
                    <option key={e.id} value={e.id} className="bg-slate-900 text-white">{e.name} ({e.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    if (!tempLevelName.trim()) return;
                    setNewApprovals([...newApprovals, { levelName: tempLevelName.trim(), approverId: tempApproverId }]);
                    setTempLevelName('');
                  }}
                  className={`w-full ${accentBgClass} font-extrabold py-1 px-3 rounded text-[10px] cursor-pointer`}
                >
                  + Găm cấp duyệt
                </button>
              </div>
            </div>

            {newApprovals.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {newApprovals.map((ap, i) => {
                  const emp = employees.find(e => e.id === ap.approverId);
                  return (
                    <span key={i} className="inline-flex items-center gap-1.5 bg-slate-900 text-slate-200 text-[10px] border border-slate-800 py-0.5 px-2 rounded-md font-semibold animate-fade-in">
                      <span>Cấp {i+1}: {ap.levelName} ({emp?.name})</span>
                      <button 
                        type="button" 
                        onClick={() => setNewApprovals(newApprovals.filter((_, idx) => idx !== i))}
                        className="text-rose-500 font-black hover:text-rose-450 ml-1 cursor-pointer"
                      >
                        ✕
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-3 py-1.5 rounded-lg cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className={`${accentBgClass} font-black px-4 py-1.5 rounded-lg cursor-pointer text-center text-xs shadow`}
            >
              Phát hành nhiệm vụ
            </button>
          </div>
        </form>
      )}

      {/* COMPACT FILTER BAR */}
      <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-sm text-xs flex flex-wrap gap-3 items-center text-slate-300">
        <span className="font-extrabold text-[10.5px] uppercase text-slate-450 tracking-wide flex items-center gap-1">
          <Filter className={`w-3.5 h-3.5 ${accentTextClass}`} />
          Bộ phận Lọc nhanh
        </span>

        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 font-bold">Dự án:</span>
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded p-1 outline-none text-[11px] font-semibold text-slate-250 hover:border-slate-700 cursor-pointer text-white"
          >
            <option value="all" className="bg-slate-900">Tất cả dự án thầu</option>
            {projects.map(p => (
              <option key={p.id} value={p.id} className="bg-slate-900">{p.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 font-bold">Thành viên:</span>
          <select
            value={filterEmployee}
            onChange={(e) => setFilterEmployee(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded p-1 outline-none text-[11px] font-semibold text-slate-250 hover:border-slate-700 cursor-pointer text-white"
          >
            <option value="all" className="bg-slate-900">Tất cả thợ / thầu phụ</option>
            {employees.map(e => (
              <option key={e.id} value={e.id} className="bg-slate-900">{e.name} ({e.role?.toUpperCase() ?? ''})</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 font-bold">Trạng thái:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded p-1 outline-none text-[11px] font-semibold text-slate-250 hover:border-slate-700 cursor-pointer text-white"
          >
            <option value="all" className="bg-slate-900">Xem tất cả trạng thái</option>
            {Object.entries(taskStatusLabels).map(([val, label]) => (
              <option key={val} value={val} className="bg-slate-900">{label}</option>
            ))}
          </select>
        </div>

        <span className="text-[10px] text-slate-405 font-mono italic font-semibold">
          Tổng số: {filteredTasks.length} nhiệm vụ phù hợp
        </span>
      </div>

      {/* 3 COLUMNS APPROVAL BOARD FOR 'toreview' OR NORMAL LIST FOR OTHERS */}
      {taskScope === 'toreview' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-2">
          {/* CỘT PHÒNG DỰ ÁN */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col h-[750px] shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3.5">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4.5 h-4.5 text-amber-500" />
                <h3 className="font-extrabold text-[12.5px] text-white uppercase tracking-wider">
                  Phòng Dự án
                </h3>
              </div>
              <span className="bg-amber-955 border border-amber-500/20 text-text-amber-400 text-amber-400 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                {filteredTasks.length} chờ duyệt
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-16 text-slate-500 italic text-xs">
                  Không có công việc dự án nào chờ duyệt.
                </div>
              ) : (
                filteredTasks.map(t => {
                  const assignee = employees.find(e => e.id === t.assigneeId);
                  const project = projects.find(p => p.id === t.projectId);
                  const isOverdue = t.status === 'overdue' || (new Date(t.deadline) < new Date() && t.status !== 'completed');

                  return (
                    <div 
                      key={t.id} 
                      className="bg-slate-950/80 border border-slate-850 p-3.5 rounded-lg hover:border-slate-700 hover:bg-slate-950 transition-all duration-150 space-y-3 shadow-sm group"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <h4 
                          onClick={() => setSelectedTaskId(t.id)} 
                          className="font-extrabold text-slate-200 hover:text-amber-400 cursor-pointer text-xs leading-snug line-clamp-2 transition-colors flex-1"
                        >
                          {t.name}
                        </h4>
                        <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase text-center border shrink-0 ${priorityColors[t.priority] || ''}`}>
                          {t.priority?.toUpperCase() ?? ''}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400 space-y-1 bg-slate-900/40 p-2 rounded-md border border-slate-850/50">
                        <p className="truncate">Dự án: <strong className="text-slate-200">{project ? project.name : 'Nhiệm vụ chung'}</strong></p>
                        <p>Phụ trách: <strong className="text-slate-350">{assignee?.name || 'Thợ tự do'}</strong></p>
                        <p className="flex items-center gap-1 font-mono text-[10.5px]">
                          Thời hạn: 
                          <span className={`font-bold ${isOverdue ? 'text-rose-400' : 'text-slate-300'}`}>
                            {t.deadline}
                          </span>
                        </p>
                      </div>

                      <div className="flex gap-1.5 pt-1.5 border-t border-slate-900 justify-end">
                        <button
                          type="button"
                          onClick={() => setSelectedTaskId(t.id)}
                          className="bg-slate-900 border border-slate-800 text-slate-300 hover:text-white px-2 py-1 rounded text-[10.5px] font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Xem
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const wl = t.workLogs || [];
                            onUpdateTask(t.id, {
                              status: 'doing',
                              completionRate: 50,
                              workLogs: [...wl, {
                                id: `wl_reject_${Date.now()}`,
                                actorId: currentUser.id,
                                actorName: currentUser.name,
                                action: 'Từ Chối Phê Duyệt',
                                timestamp: new Date().toISOString(),
                                notes: `${currentUser.name} đã Từ Chối duyệt kết quả thông qua cổng duyệt nhanh.`
                              }]
                            });
                            // 🤖 Auto-post to task chat group
                            const proj = projects.find(p => p.id === t.projectId);
                            postTaskChat(
                              t.id,
                              currentUser.id,
                              currentUser.name,
                              currentUser.role || 'member',
                              `❌ ${currentUser.name} đã Từ Chối duyệt kết quả công việc "${t.name}".`,
                              [currentUser.id, t.assigneeId, t.assignerId, proj?.pmId].filter(Boolean) as string[],
                              t.name,
                              proj?.name
                            );
                          }}
                          className="bg-[#3a1c1c] hover:bg-rose-950 border border-rose-500/20 text-rose-400 hover:text-rose-300 px-2.5 py-1 rounded text-[10.5px] font-extrabold transition cursor-pointer"
                        >
                          Từ chối
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const wl = t.workLogs || [];
                            onUpdateTask(t.id, {
                              status: 'completed',
                              completionRate: 100,
                              workLogs: [...wl, {
                                id: `wl_approve_${Date.now()}`,
                                actorId: currentUser.id,
                                actorName: currentUser.name,
                                action: 'Phê Duyệt Hoàn Thành',
                                timestamp: new Date().toISOString(),
                                notes: `${currentUser.name} đã Phê Duyệt kết quả hoàn thành sản phẩm mốc nghiệm thu.`
                              }]
                            });
                            // 🤖 Auto-post to task chat group
                            const proj = projects.find(p => p.id === t.projectId);
                            postTaskChat(
                              t.id,
                              currentUser.id,
                              currentUser.name,
                              currentUser.role || 'member',
                              `✅ ${currentUser.name} đã Phê Duyệt hoàn thành công việc "${t.name}".`,
                              [currentUser.id, t.assigneeId, t.assignerId, proj?.pmId].filter(Boolean) as string[],
                              t.name,
                              proj?.name
                            );
                          }}
                          className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 px-2.5 py-1 rounded text-[10.5px] font-black transition cursor-pointer"
                        >
                          Duyệt
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
            <div className="bg-slate-955 p-2 border-t border-slate-850 mt-3 text-[10px] text-slate-500 font-mono flex justify-between items-center">
              <span>Mục công tác thầu</span>
              <span className="italic">Hoàng Long Cost</span>
            </div>
          </div>

          {/* CỘT PHÒNG NHÂN SỰ */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col h-[750px] shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3.5">
              <div className="flex items-center gap-2">
                <Users className="w-4.5 h-4.5 text-pink-500" />
                <h3 className="font-extrabold text-[12.5px] text-white uppercase tracking-wider">
                  Phòng Nhân sự
                </h3>
              </div>
              <span className="bg-pink-955 border border-pink-500/20 text-pink-400 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                {leaves.filter(l => l.status === 'pending').length} chờ duyệt
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
              {leaves.filter(l => l.status === 'pending').length === 0 ? (
                <div className="text-center py-16 text-slate-500 italic text-xs">
                  Không có đơn nghỉ phép nào chờ duyệt.
                </div>
              ) : (
                leaves.filter(l => l.status === 'pending').map(l => (
                  <div 
                    key={l.id} 
                    className="bg-slate-950/80 border border-slate-850 p-3.5 rounded-lg hover:border-slate-700 hover:bg-slate-950 transition-all duration-150 space-y-3 shadow-sm"
                  >
                    <div className="flex justify-between items-center bg-slate-900/50 px-2.5 py-1 rounded border border-slate-850">
                      <span className="text-[10px] font-mono font-extrabold text-pink-400 tracking-wider bg-pink-950/50 px-1.5 py-0.5 rounded">{l.id}</span>
                      <span className="text-[9.5px] font-bold text-slate-300">
                        {l.type}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-extrabold text-slate-200 text-xs flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span>
                        {l.empName}
                      </h4>
                      <p className="text-[10.5px] text-slate-400 font-mono">
                        Từ ngày: <strong className="text-slate-300">{l.fromDate}</strong> đến <strong className="text-slate-300">{l.toDate}</strong> ({l.daysCount} ngày phép)
                      </p>
                      <div className="text-[10.5px] text-slate-350 italic bg-slate-900/60 p-2.5 rounded border border-slate-850 font-sans mt-2">
                        "Lý do: {l.reason}"
                      </div>
                    </div>

                    <div className="flex gap-1.5 pt-1 border-t border-slate-900 justify-end">
                      <button
                        type="button"
                        onClick={() => handleApproveLeave(l.id, 'rejected')}
                        className="bg-[#3a1c1c] hover:bg-rose-950 border border-rose-500/20 text-rose-400 hover:text-rose-300 px-3.5 py-1 rounded text-[10.5px] font-extrabold transition cursor-pointer"
                      >
                        Từ chối
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApproveLeave(l.id, 'approved')}
                        className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 px-3.5 py-1 rounded text-[10.5px] font-black transition cursor-pointer"
                      >
                        Duyệt
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="bg-slate-955 p-2 border-t border-slate-850 mt-3 text-[10px] text-slate-500 font-mono flex justify-between items-center">
              <span>Đơn từ thợ nghỉ</span>
              <span className="italic">Hoàng Long HR</span>
            </div>
          </div>

          {/* CỘT PHÒNG KẾ TOÁN */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col h-[750px] shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3.5">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4.5 h-4.5 text-emerald-500" />
                <h3 className="font-extrabold text-[12.5px] text-white uppercase tracking-wider">
                  Phòng Kế toán
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {payments.filter(p => p.status === 'pending' && (p.proposer === currentUser.name || p.recipient === currentUser.name || p.approver === currentUser.name)).length > 0 && (
                  <button
                    onClick={handleClearPendingPayments}
                    title="Xóa toàn bộ các đề xuất đang chờ duyệt trong bộ nhớ tạm"
                    className="text-rose-400 hover:text-rose-300 text-[10px] bg-rose-950/30 border border-rose-500/20 px-2 py-0.5 rounded hover:bg-rose-950/60 font-sans cursor-pointer transition active:scale-95 flex items-center gap-0.5"
                  >
                    <Trash2 className="w-3 h-3" /> Xóa bộ nhớ tạm
                  </button>
                )}
                {/* Count: payments + subcontractor advances pending_approval where currentUser is approver */}
                <span className="bg-emerald-955 border border-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                  {
                    payments.filter(p => p.status === 'pending' && (p.proposer === currentUser.name || p.recipient === currentUser.name || p.approver === currentUser.name)).length
                    +
                    subcontractorAdvances.filter(a => a.status === 'pending_approval' && a.approverName === currentUser.name).length
                  } chờ duyệt
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
              {/* Combine payments and subcontractor advances */}
              {(() => {
                const pendingPayments = payments.filter(p => p.status === 'pending' && (p.proposer === currentUser.name || p.recipient === currentUser.name || p.approver === currentUser.name));
                const pendingAdvances = subcontractorAdvances.filter(a => a.status === 'pending_approval' && a.approverName === currentUser.name);
                const allPending = [
                  ...pendingPayments.map(p => ({ type: 'payment' as const, data: p })),
                  ...pendingAdvances.map(a => ({ type: 'advance' as const, data: a }))
                ];

                if (allPending.length === 0) {
                  return (
                    <div className="text-center py-16 text-slate-500 italic text-xs">
                      Không có đề xuất tài chính nào chờ duyệt.
                    </div>
                  );
                }

                // Sort by date descending
                allPending.sort((a, b) => {
                  const dateA = a.type === 'payment' ? a.data.date : a.data.date;
                  const dateB = b.type === 'payment' ? b.data.date : b.data.date;
                  return dateB.localeCompare(dateA);
                });

                return allPending.map(item => {
                  if (item.type === 'payment') {
                    const p = item.data;
                    return (
                      <div
                        key={p.id}
                        className="bg-slate-950/80 border border-slate-850 p-3.5 rounded-lg hover:border-slate-700 hover:bg-slate-950 transition-all duration-150 space-y-3 shadow-sm"
                      >
                        <div className="flex justify-between items-center bg-slate-900/50 px-2.5 py-1 rounded border border-slate-850">
                          <span className="text-[10px] font-mono font-extrabold text-emerald-400 tracking-wider bg-emerald-950/50 px-1.5 py-0.5 rounded">{p.code}</span>
                          <span className="text-[11.5px] font-mono font-black text-rose-400">
                            -{p.amount.toLocaleString('vi-VN')} đ
                          </span>
                        </div>

                        <div className="space-y-1.5 text-[10.5px] text-slate-400">
                          <div className="text-slate-200">
                            Phát cho: <strong className="text-slate-100 text-xs font-bold leading-none">{p.recipient}</strong>
                          </div>
                          <div className="font-mono text-[10px]">
                            Ngày chi: <strong className="text-slate-300">{p.date}</strong>
                          </div>
                          <p>Người trình: <strong className="text-slate-355">{p.proposer || 'Thành viên'}</strong></p>
                          <p className="text-amber-400 font-bold text-[9px] uppercase">Phiếu Chi</p>

                          <div className="text-[10.5px] text-slate-350 italic bg-slate-900/60 p-2.5 rounded border border-slate-850 font-sans mt-2">
                            "Nội dung: {p.notes}"
                          </div>
                        </div>

                        <div className="flex gap-1.5 pt-1 border-t border-slate-900 justify-end">
                          <button
                            type="button"
                            onClick={() => handleApprovePayment(p.id, 'rejected')}
                            className="bg-[#3a1c1c] hover:bg-rose-950 border border-rose-500/20 text-rose-400 hover:text-rose-300 px-3.5 py-1 rounded text-[10.5px] font-extrabold transition cursor-pointer"
                          >
                            Từ chối
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApprovePayment(p.id, 'approved')}
                            className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 px-3.5 py-1 rounded text-[10.5px] font-black transition cursor-pointer"
                          >
                            Duyệt
                          </button>
                        </div>
                      </div>
                    );
                  } else {
                    const a = item.data;
                    return (
                      <div
                        key={a.id}
                        className="bg-slate-950/80 border border-slate-850 p-3.5 rounded-lg hover:border-slate-700 hover:bg-slate-950 transition-all duration-150 space-y-3 shadow-sm"
                      >
                        <div className="flex justify-between items-center bg-slate-900/50 px-2.5 py-1 rounded border border-slate-850">
                          <span className="text-[10px] font-mono font-extrabold text-orange-400 tracking-wider bg-orange-950/50 px-1.5 py-0.5 rounded">{a.id}</span>
                          <span className="text-[11.5px] font-mono font-black text-rose-400">
                            {a.amount.toLocaleString('vi-VN')} đ
                          </span>
                        </div>

                        <div className="space-y-1.5 text-[10.5px] text-slate-400">
                          <div className="text-slate-200">
                            Dự án: <strong className="text-slate-100 text-xs font-bold leading-none">{a.projectName}</strong>
                          </div>
                          <div className="font-mono text-[10px]">
                            Công việc: <strong className="text-slate-300">{a.taskName}</strong>
                          </div>
                          <p>Thầu phụ: <strong className="text-slate-355">{a.subcontractorName}</strong></p>
                          <p>Người lập: <strong className="text-slate-355">{a.creatorName || 'Kế Toán'}</strong></p>
                          <p className="text-sky-400 font-bold text-[9px] uppercase">Đề Xuất Thu Chi / Tạm Ứng</p>

                          <div className="text-[10.5px] text-slate-350 italic bg-slate-900/60 p-2.5 rounded border border-slate-850 font-sans mt-2">
                            "Diễn giải: {a.reason}"
                          </div>
                        </div>

                        <div className="flex gap-1.5 pt-1 border-t border-slate-900 justify-end">
                          <button
                            type="button"
                            onClick={() => handleApproveAdvance(a.id, 'rejected')}
                            className="bg-[#3a1c1c] hover:bg-rose-950 border border-rose-500/20 text-rose-400 hover:text-rose-300 px-3.5 py-1 rounded text-[10.5px] font-extrabold transition cursor-pointer"
                          >
                            Từ chối
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApproveAdvance(a.id, 'approved')}
                            className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 px-3.5 py-1 rounded text-[10.5px] font-black transition cursor-pointer"
                          >
                            Duyệt
                          </button>
                        </div>
                      </div>
                    );
                  }
                });
              })()}
            </div>

            <div className="bg-slate-955 p-2 border-t border-slate-850 mt-3 text-[10px] text-slate-500 font-mono flex justify-between items-center">
              <span>Đề xuất chi xuất quỹ & Tạm ứng</span>
              <span className="italic">Hoàng Long Finance</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl bg-slate-900/50 text-slate-400 italic">
              Không tìm thấy mục công tác nào khớp với cấu hình bộ lọc của bạn.
            </div>
          ) : (
            Object.entries(groupedTasks).map(([projId, projTasks]) => {
              const project = projects.find(p => p.id === projId);
              const customer = project && customers ? customers.find(c => c.id === project.customerId) : null;
              const projTitle = project ? project.name : 'Nhiệm vụ chung nội bộ / Văn phòng';
              const projProgress = project?.progress ?? 0;
              const pmEmployee = project ? employees.find(e => e.id === project.pmId) : null;

              return (
                <div 
                  key={projId}
                  className="bg-slate-900 text-slate-100 rounded-xl border border-slate-805 overflow-hidden shadow-md group/project"
                >
                  {/* PROJECT HEADER GROUP */}
                  <div className="bg-slate-950 text-slate-300 px-4 py-2.5 flex flex-col md:flex-row justify-between items-start md:items-center text-xs font-bold gap-2 border-b border-slate-850">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded ${accentBgClass.split(' ')[0]}`}></div>
                      <span className="font-extrabold uppercase tracking-wide text-white">
                        {projTitle}
                        {customer && (
                          <span className="text-slate-405 capitalize text-[10.5px] ml-2 font-semibold font-sans normal-case">
                            - Khách hàng: {customer.name}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400 font-mono font-medium">
                      {project ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>PM: <strong className="text-slate-200">{pmEmployee?.name || 'Chưa phân'}</strong></span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>Chi viện khối Văn phòng thầu khoán</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* TASKS LIST IN ROWS */}
                  <div className="divide-y divide-slate-850 bg-slate-900/40">
                    {projTasks.map((t) => {
                      const assignee = employees.find(e => e.id === t.assigneeId);
                      const assigner = employees.find(e => e.id === t.assignerId);
                      const pmName = pmEmployee?.name || assigner?.name || 'Trương Hữu Long';
                      const pendingStepCount = t.approvals?.filter(step => step.status === 'pending').length || 0;
                      const commentsCount = t.comments?.length || 0;
                      const isOverdue = t.status === 'overdue' || (new Date(t.deadline) < new Date() && t.status !== 'completed');

                      return (
                        <div
                          key={t.id}
                          className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between p-3.5 px-4 hover:bg-slate-800/40 transition-all gap-4 text-xs group"
                        >
                          {/* Cột 1: Tên */}
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <h4 
                              className={`font-extrabold text-slate-100 group-hover:${accentTextClass} cursor-pointer text-[12.5px] transition duration-155`} 
                              onClick={() => setSelectedTaskId(t.id)}
                            >
                              {t.name}
                            </h4>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase border ${statusColors[t.status] || ''}`}>
                                {taskStatusLabels[t.status]}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase border ${priorityColors[t.priority] || ''}`}>
                                {t.priority?.toUpperCase() ?? ''}
                              </span>
                            </div>
                          </div>

                          {/* Cột 2: Phụ Trách Công Việc */}
                          <div className="w-full lg:w-48 flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-955 flex items-center justify-center font-bold text-slate-350 text-[10.5px] border border-slate-800 shadow-2xs uppercase">
                              {assignee?.name.slice(0, 2) || 'TD'}
                            </div>
                            <div className="min-w-0">
                              <span className="text-[10px] text-slate-400 block font-semibold uppercase leading-none mb-0.5">Nhân sự:</span>
                              <span className="font-bold text-slate-200 truncate block text-[11.5px]">{assignee?.name || 'Tự do xưởng'}</span>
                            </div>
                          </div>

                          {/* Cột 4: Hạn chót định biên */}
                          <div className="w-full lg:w-28 flex flex-col justify-center">
                            <span className="text-[9.5px] text-slate-400 block font-semibold uppercase leading-none mb-0.5">Thời hạn:</span>
                            <span className={`font-mono font-bold text-[11px] flex items-center gap-1 ${isOverdue ? 'text-red-400' : 'text-slate-300'}`}>
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              {t.deadline}
                            </span>
                          </div>

                          {/* Cột 5: Đếm bình luận */}
                          <div className="flex items-center gap-2.5 text-[10px] font-bold text-slate-450 min-w-[50px]">
                            {commentsCount > 0 && (
                              <span className="flex items-center gap-0.5 bg-slate-955 px-1.5 py-0.5 rounded border border-slate-800" title="Thảo luận thợ">
                                <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                                {commentsCount}
                              </span>
                            )}
                          </div>

                          {/* Cột 6: Buttons tương tác nhanh */}
                          <div className="flex items-center gap-1.5 justify-end lg:w-64 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setSelectedTaskId(t.id)}
                              className="bg-slate-950 text-slate-205 hover:bg-slate-800 hover:text-white border border-slate-800 text-[10.5px] font-black px-2.5 py-1 rounded flex items-center gap-0.5 cursor-pointer transition flex-1 sm:flex-initial justify-center"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Xem
                            </button>

                            {(() => {
                              const isAssignee = currentUser?.id === t.assigneeId || currentUser?.name === t.assigneeId;
                              const isAssigner = currentUser?.id === t.assignerId || 
                                                 currentUser?.name === t.assignerId ||
                                                 t.approvals?.some(ap => ap.approverId === currentUser?.id || ap.approverId === currentUser?.name);

                              if (t.status === 'todo') {
                                if (isAssignee) {
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const wl = t.workLogs || [];
                                        onUpdateTask(t.id, {
                                          status: 'doing',
                                          completionRate: 20,
                                          workLogs: [...wl, {
                                            id: `wl_start_${Date.now()}`,
                                            actorId: currentUser.id,
                                            actorName: currentUser.name,
                                            action: 'Nhận Việc',
                                            timestamp: new Date().toISOString(),
                                            notes: `${currentUser.name} đã Nhận Việc từ danh sách việc.`
                                          }]
                                        });
                                        // 🤖 Auto-post to task chat group
                                        const proj = projects.find(p => p.id === t.projectId);
                                        postTaskChat(
                                          t.id,
                                          currentUser.id,
                                          currentUser.name,
                                          currentUser.role || 'member',
                                          `🙋 ${currentUser.name} đã Nhận Việc "${t.name}".`,
                                          [currentUser.id, t.assignerId, proj?.pmId].filter(Boolean) as string[],
                                          t.name,
                                          proj?.name
                                        );
                                      }}
                                      className="bg-sky-600 hover:bg-sky-500 text-slate-950 text-[10.5px] font-black px-2.5 py-1 rounded cursor-pointer transition flex-1 sm:flex-initial"
                                    >
                                      Nhận Việc
                                    </button>
                                  );
                                } else {
                                  return (
                                    <span className="text-[9px] text-slate-500 font-semibold italic bg-slate-950/20 px-1.5 py-0.5 rounded border border-slate-850">
                                      Chờ nhận việc
                                    </span>
                                  );
                                }
                              }

                              if (t.status === 'doing') {
                                return (
                                  <span className="text-[9px] text-slate-500 font-semibold bg-slate-950/20 px-1.5 py-0.5 rounded border border-slate-850">
                                    Đang tiến hành
                                  </span>
                                );
                              }

                              if (t.status === 'reviewing') {
                                if (isAssigner) {
                                  return (
                                    <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const wl = t.workLogs || [];
                                          onUpdateTask(t.id, {
                                            status: 'doing',
                                            completionRate: 50,
                                            workLogs: [...wl, {
                                              id: `wl_reject_${Date.now()}`,
                                              actorId: currentUser.id,
                                              actorName: currentUser.name,
                                              action: 'Từ Chối Phê Duyệt',
                                              timestamp: new Date().toISOString(),
                                              notes: `${currentUser.name} đã Từ Chối duyệt kết quả, yêu cầu người phụ trách xem lại sản phẩm.`
                                            }]
                                          });
                                          // 🤖 Auto-post to task chat group
                                          const proj = projects.find(p => p.id === t.projectId);
                                          postTaskChat(
                                            t.id,
                                            currentUser.id,
                                            currentUser.name,
                                            currentUser.role || 'member',
                                            `❌ ${currentUser.name} đã Từ Chối duyệt kết quả công việc "${t.name}".`,
                                            [currentUser.id, t.assigneeId, t.assignerId, proj?.pmId].filter(Boolean) as string[],
                                            t.name,
                                            proj?.name
                                          );
                                        }}
                                        className="bg-rose-600 hover:bg-rose-500 text-white text-[10.5px] font-bold px-2 py-1 rounded cursor-pointer transition"
                                      >
                                        Từ Chối
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const wl = t.workLogs || [];
                                          onUpdateTask(t.id, {
                                            status: 'completed',
                                            completionRate: 100,
                                            workLogs: [...wl, {
                                              id: `wl_approve_${Date.now()}`,
                                              actorId: currentUser.id,
                                              actorName: currentUser.name,
                                              action: 'Xét Duyệt Hoàn Thành',
                                              timestamp: new Date().toISOString(),
                                              notes: `${currentUser.name} đã Xét Duyệt hoàn thành xuất sắc công việc.`
                                            }]
                                          });
                                          // 🤖 Auto-post to task chat group
                                          const proj = projects.find(p => p.id === t.projectId);
                                          postTaskChat(
                                            t.id,
                                            currentUser.id,
                                            currentUser.name,
                                            currentUser.role || 'member',
                                            `✅ ${currentUser.name} đã Xét Duyệt hoàn thành công việc "${t.name}".`,
                                            [currentUser.id, t.assigneeId, t.assignerId, proj?.pmId].filter(Boolean) as string[],
                                            t.name,
                                            proj?.name
                                          );
                                        }}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-[10.5px] font-black px-2 py-1 rounded cursor-pointer transition"
                                      >
                                        Xét Duyệt
                                      </button>
                                    </div>
                                  );
                                } else {
                                  return (
                                    <div className="bg-amber-950/40 text-amber-400 px-2 py-1 rounded border border-amber-900/40 font-bold text-[9px] uppercase tracking-wide flex items-center justify-center animate-pulse flex-1 sm:flex-initial text-center whitespace-nowrap">
                                      Đang chờ duyệt
                                    </div>
                                  );
                                }
                              }

                              if (t.status === 'completed') {
                                return (
                                  <span className="text-[9px] text-emerald-400 font-extrabold bg-emerald-950/20 px-1.5 py-0.5 rounded border border-emerald-900/30">
                                    ✓ Hoàn thành
                                  </span>
                                );
                              }

                              return null;
                            })()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* MODAL CHI TIẾT CÔNG VIỆC CHUYÊN SÂU HOÀN CHỈNH */}
      {selectedTaskId && (() => {
        const openedTaskObj = tasks.find(t => t.id === selectedTaskId);
        const isReadOnlyTask = openedTaskObj 
          ? (currentUser?.role !== 'director' && 
             openedTaskObj.assigneeId !== currentUser?.id && 
             openedTaskObj.assignerId !== currentUser?.id)
          : false;
          
        return (
          <TaskDetailModal
            taskId={selectedTaskId}
            onClose={() => setSelectedTaskId(null)}
            tasks={tasks}
            projects={projects}
            employees={employees}
            currentUser={currentUser}
            onUpdateTask={onUpdateTask}
            isReadOnly={isReadOnlyTask}
            customers={customers}
            onRedirectToSubcontractor={onRedirectToSubcontractor}
            onOpenConnectedTool={(tool) => {
              if (tool === 'quotation' && onRedirectToQuote) {
                const task = tasks.find(t => t.id === selectedTaskId);
                if (task && task.projectId) {
                  setSelectedTaskId(null); // Close the detail modal
                  onRedirectToQuote(task.projectId);
                  return;
                }
              }
              setActiveConnectedTool(tool);
              setActiveConnectedToolTaskId(selectedTaskId);
            }}
          />
        );
      })()}

      {/* HỆ THỐNG LIÊN THÔNG ĐA CHIỀU CHUYÊN SÂU */}
      {activeConnectedTool && activeConnectedToolTaskId && (
        <ConnectedToolsModal
          currentUser={currentUser}
          employees={employees}
          tasks={tasks}
          selectedProject={projects.find(p => p.id === (tasks.find(t => t.id === activeConnectedToolTaskId)?.projectId)) || null}
          activeConnectedTool={activeConnectedTool}
          setActiveConnectedTool={setActiveConnectedTool}
          connectedTaskId={activeConnectedToolTaskId}
          setConnectedTaskId={setActiveConnectedToolTaskId}
          overlayTaskId={null}
          customers={customers || []}
          updateProjectWithRule={onUpdateProject || (() => {})}
          localUpdateTask={onUpdateTask}
        />
      )}
    </div>
  );
}
