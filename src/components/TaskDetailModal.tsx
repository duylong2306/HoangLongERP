import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Task, Project, Employee, TaskPriority, TaskStatus, TaskComment, SubTaskMission, Customer, SubcontractorAdvanceProposal, Payment, ArchivedQuote } from '../types';
import {
  X, Check, Clock, AlertCircle, FileUp, Users, Trash2,
  UserPlus, MessageSquare, Paperclip, Send, Calendar,
  DollarSign, Plus, ArrowRight, CheckCircle2,
  AlertTriangle, Briefcase, FileText, Zap, Edit2, Shield, Award, ListTodo, Search, Camera,
  Download, Upload, FileSpreadsheet, UserCheck, Image as ImageIcon
} from 'lucide-react';
import QuotationTableSheet from './QuotationTableSheet';
import ConnectedToolsModal from './ConnectedToolsModal';
import { canDoTaskAction, loadTaskPermissionMatrix, getTaskRoleScope } from './hr/hrTaskPermissions';
import * as XLSX from 'xlsx';

interface TravelAllowanceNorm {
  id: string;
  code: string;
  content: string;
  quantity: number;
  unitPrice: number;
  notes: string;
}
import { useNotification, isUserInRoleGroup } from '../context';
import { dbService } from '../lib/dbService';
import { sendGroupChatMessage } from '../lib/chatStore';

// Ánh xạ loại dự án (lĩnh vực) → tab Lưu Trữ Hồ Sơ tương ứng
const sectorArchiveTab = (type?: string): string =>
  type === 'construction' ? 'quotes-construction'
  : type === 'mechanical' ? 'quotes-mechanical'
  : 'quotes'; // furniture / general / mặc định → Hồ Sơ Nội Thất

interface TaskDetailModalProps {
  taskId: string;
  onClose: () => void;
  tasks: Task[];
  projects: Project[];
  employees: Employee[];
  currentUser: Employee;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onUpdateProject?: (projectId: string, updates: Partial<Project>) => void;
  isReadOnly?: boolean;
  onOpenConnectedTool?: (tool: 'approval' | 'cost' | 'material' | 'quotation' | 'contract' | 'acceptance' | 'liquidation') => void;
  customers?: Customer[];
  onRedirectToSubcontractor?: (projectId: string, subcontractorId: string, workName: string) => void;
}

export default function TaskDetailModal({
  taskId,
  onClose,
  tasks,
  projects,
  employees,
  currentUser,
  onUpdateTask,
  onUpdateProject,
  isReadOnly = false,
  onOpenConnectedTool,
  customers,
  onRedirectToSubcontractor
}: TaskDetailModalProps) {
  const { addToast } = useNotification();
  const selectedTask = tasks.find(t => t.id === taskId);
  if (!selectedTask) return null;

  const [advProposalApprover, setAdvProposalApprover] = useState('Ban Giám Đốc');

  const isCurrentUserAdmin = currentUser.role === 'director' || currentUser.id === 'NV_ADMIN' || currentUser.id === 'emp_admin';

  // Load Travel Allowance Norms from localStorage
  const travelNorms = React.useMemo<TravelAllowanceNorm[]>(() => {
    const saved = localStorage.getItem('hl_acc_travel_norms');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0 && 'content' in parsed[0]) {
          const needsMigration = parsed.some((item: any) => item.content !== 'Nghỉ qua đêm' && !item.content.startsWith('Đi '));
          if (!needsMigration) {
            return parsed as TravelAllowanceNorm[];
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
    return [
      { id: 'ctp_1', code: 'CTP_001', content: 'Đi Đà Lạt - Nam Ban (xe 1 người)', quantity: 1, unitPrice: 100000, notes: '' },
      { id: 'ctp_2', code: 'CTP_002', content: 'Đi Đà Lạt - Nam Ban (xe 2 người)', quantity: 2, unitPrice: 140000, notes: '' },
      { id: 'ctp_3', code: 'CTP_003', content: 'Đi Đà Lạt - Đức Trọng (xe 1 người)', quantity: 1, unitPrice: 120000, notes: '' },
      { id: 'ctp_4', code: 'CTP_004', content: 'Đi Đà Lạt - Đức Trọng (xe 2 người)', quantity: 2, unitPrice: 160000, notes: '' },
      { id: 'ctp_5', code: 'CTP_005', content: 'Đi Đà Lạt - Đam Rông (xe 1 người)', quantity: 1, unitPrice: 180000, notes: '' },
      { id: 'ctp_6', code: 'CTP_006', content: 'Đi Đà Lạt - Đam Rông (xe 2 người)', quantity: 2, unitPrice: 220000, notes: '' },
      { id: 'ctp_7', code: 'CTP_007', content: 'Đi Đà Lạt - Di Linh (xe 1 người)', quantity: 1, unitPrice: 200000, notes: '' },
      { id: 'ctp_8', code: 'CTP_008', content: 'Đi Đà Lạt - Di Linh (xe 2 người)', quantity: 2, unitPrice: 240000, notes: '' },
      { id: 'ctp_9', code: 'CTP_009', content: 'Đi Đà Lạt - Bảo Lộc (xe 1 người)', quantity: 1, unitPrice: 240000, notes: '' },
      { id: 'ctp_10', code: 'CTP_010', content: 'Đi Đà Lạt - Bảo Lộc (xe 2 người)', quantity: 2, unitPrice: 280000, notes: '' },
      { id: 'ctp_11', code: 'CTP_011', content: 'Đi Đà Lạt - Đơn Dương (xe 1 người)', quantity: 1, unitPrice: 120000, notes: '' },
      { id: 'ctp_12', code: 'CTP_012', content: 'Đi Đà Lạt - Đơn Dương (xe 2 người)', quantity: 2, unitPrice: 160000, notes: '' },
      { id: 'ctp_13', code: 'CTP_013', content: 'Đi Nam Ban - Đà Lạt (xe 1 người)', quantity: 1, unitPrice: 100000, notes: '' },
      { id: 'ctp_14', code: 'CTP_014', content: 'Đi Nam Ban - Đà Lạt (xe 2 người)', quantity: 2, unitPrice: 140000, notes: '' },
      { id: 'ctp_15', code: 'CTP_015', content: 'Đi Nam Ban - Đức Trọng (xe 1 người)', quantity: 1, unitPrice: 100000, notes: '' },
      { id: 'ctp_16', code: 'CTP_016', content: 'Đi Nam Ban - Đức Trọng (xe 2 người)', quantity: 2, unitPrice: 140000, notes: '' },
      { id: 'ctp_17', code: 'CTP_017', content: 'Đi Nam Ban - Đam Rông (xe 1 người)', quantity: 1, unitPrice: 140000, notes: '' },
      { id: 'ctp_18', code: 'CTP_018', content: 'Đi Nam Ban - Đam Rông (xe 2 người)', quantity: 2, unitPrice: 180000, notes: '' },
      { id: 'ctp_19', code: 'CTP_019', content: 'Đi Nam Ban - Di Linh (xe 1 người)', quantity: 1, unitPrice: 150000, notes: '' },
      { id: 'ctp_20', code: 'CTP_020', content: 'Đi Nam Ban - Di Linh (xe 2 người)', quantity: 2, unitPrice: 190000, notes: '' },
      { id: 'ctp_21', code: 'CTP_021', content: 'Đi Nam Ban - Bảo Lộc (xe 1 người)', quantity: 1, unitPrice: 180000, notes: '' },
      { id: 'ctp_22', code: 'CTP_022', content: 'Đi Nam Ban - Bảo Lộc (xe 2 người)', quantity: 2, unitPrice: 220000, notes: '' },
      { id: 'ctp_23', code: 'CTP_023', content: 'Đi Nam Ban - Đan Phượng (xe 1 người)', quantity: 1, unitPrice: 100000, notes: '' },
      { id: 'ctp_24', code: 'CTP_024', content: 'Đi Nam Ban - Đan Phượng (xe 2 người)', quantity: 2, unitPrice: 140000, notes: '' },
      { id: 'ctp_25', code: 'CTP_025', content: 'Đi Nam Ban - Phi Liêng (xe 1 người)', quantity: 1, unitPrice: 120000, notes: '' },
      { id: 'ctp_26', code: 'CTP_026', content: 'Đi Nam Ban - Phi Liêng (xe 2 người)', quantity: 2, unitPrice: 160000, notes: '' },
      { id: 'ctp_27', code: 'CTP_027', content: 'Đi Nam Ban - Tân Hà (xe 1 người)', quantity: 1, unitPrice: 80000, notes: '' },
      { id: 'ctp_28', code: 'CTP_028', content: 'Đi Nam Ban - Tân Hà (xe 2 người)', quantity: 2, unitPrice: 120000, notes: '' },
      { id: 'ctp_29', code: 'CTP_029', content: 'Nghỉ qua đêm', quantity: 1, unitPrice: 180000, notes: '' }
    ];
  }, []);

  const project = projects.find(p => p.id === selectedTask.projectId);

  // ─── GỬI THÔNG BÁO VÀO NHÓM CHAT DỰ ÁN ───────────────────────────────────
  // Hàm bọc quanh sendGroupChatMessage (lib/chatStore). Truyền sẵn MÃ NHÓM CHAT
  // = `conv_project_<projectId>` để tin nhắn đến ĐÚNG nhóm chat dự án (nhóm này
  // được tự động tạo khi khởi tạo dự án qua ensureProjectChatGroup).
  // CÁCH DÙNG: notifyProjectChat('📌 nội dung tùy biến') — người gửi lấy từ currentUser.
  const notifyProjectChat = (content: string) => {
    if (!selectedTask.projectId) return;
    sendGroupChatMessage({
      conversationId: `conv_project_${selectedTask.projectId}`,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      content,
    });
  };

  const assignee = employees.find(e => e.id === selectedTask.assigneeId);
  const assigner = employees.find(e => e.id === selectedTask.assignerId);

  const isAssignee = currentUser.id === selectedTask.assigneeId;
  const isAssigner = currentUser.id === selectedTask.assignerId || isUserInRoleGroup(currentUser.id, 'role_admin') || currentUser.id === project?.pmId;

  // ─── PHÂN QUYỀN CÔNG VIỆC (Task Action Matrix) ──────────────────────
  // Thay thế hardcode isAssignee/isAssigner bằng ma trận Role × Action
  const taskMatrix = loadTaskPermissionMatrix();
  const roleScope = getTaskRoleScope(currentUser, selectedTask, project);
  const canReceive = canDoTaskAction(currentUser, selectedTask, project, 'receiveTask', taskMatrix);
  const canComplete = canDoTaskAction(currentUser, selectedTask, project, 'completeTask', taskMatrix);
  const canApprove = canDoTaskAction(currentUser, selectedTask, project, 'approveResult', taskMatrix);
  const canReject = canDoTaskAction(currentUser, selectedTask, project, 'rejectResult', taskMatrix);
  const canAssignMembers = canDoTaskAction(currentUser, selectedTask, project, 'assignMembers', taskMatrix);
  const canAssignSubWorkers = canDoTaskAction(currentUser, selectedTask, project, 'assignSubWorkers', taskMatrix);
  const canRecordViolation = canDoTaskAction(currentUser, selectedTask, project, 'recordViolation', taskMatrix);
  const canIssuePenalty = canDoTaskAction(currentUser, selectedTask, project, 'issuePenalty', taskMatrix);
  const canProposeAdvance = canDoTaskAction(currentUser, selectedTask, project, 'proposeAdvance', taskMatrix);
  const canSettlePayment = canDoTaskAction(currentUser, selectedTask, project, 'settlePayment', taskMatrix);
  const canManageDocs = canDoTaskAction(currentUser, selectedTask, project, 'manageDocs', taskMatrix);
  const canEditTask = canDoTaskAction(currentUser, selectedTask, project, 'editTask', taskMatrix);
  const canDeleteTask = canDoTaskAction(currentUser, selectedTask, project, 'deleteTask', taskMatrix);
  const canManageSubTask = canDoTaskAction(currentUser, selectedTask, project, 'manageSubTask', taskMatrix);

  // States
  const [activeConnectedTool, setActiveConnectedTool] = useState<'approval' | 'cost' | 'material' | 'quotation' | 'contract' | 'acceptance' | 'liquidation' | null>(null);
  const [connectedTaskId, setConnectedTaskId] = useState<string | null>(null);
  const [ctCostType, setCtCostType] = useState<'contractor-advance' | 'expense-advance'>('expense-advance');
  const [showAdvForm, setShowAdvForm] = useState(false);
  const [showApprovalWarning, setShowApprovalWarning] = useState(false);
  const [customApproverId, setCustomApproverId] = useState<string>('');
  const [downloadedQuoteModal, setDownloadedQuoteModal] = useState<ArchivedQuote | null>(null);
  const [downloadedQuoteActiveTab, setDownloadedQuoteActiveTab] = useState<'quote' | 'contract' | 'acceptance' | 'liquidation'>('quote');
  const [archivedQuotesList, setArchivedQuotesList] = useState<ArchivedQuote[]>([]);
  const [subcontractorContracts, setSubcontractorContracts] = useState<ArchivedQuote[]>([]);
  const [subcontractorAdvances, setSubcontractorAdvances] = useState<SubcontractorAdvanceProposal[]>([]);
  const [paymentsList, setPaymentsList] = useState<Payment[]>([]);

  // Subcontractor specific states
  const [isAdvancingSubcontractor, setIsAdvancingSubcontractor] = useState(false);
  const [subcontractorAdvAmount, setSubcontractorAdvAmount] = useState<number>(0);
  const [subcontractorAdvReason, setSubcontractorAdvReason] = useState('');
  const [proposalId, setProposalId] = useState('');
  const [advProposalCreator, setAdvProposalCreator] = useState('Kế Toán');
  const [advProposalDate, setAdvProposalDate] = useState<string>(new Date().toISOString().split('T')[0]);


  const [customDialog, setCustomDialog] = useState<{
    show: boolean;
    type: 'confirm' | 'alert';
    title: string;
    message: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  } | null>(null);

  // Find current thầu phụ contract & calculate liabilities / outstanding balance
  const currentSubcontractorContract = subcontractorContracts.find(q => q.taskId === selectedTask.id) || 
                                       subcontractorContracts.find(q => q.projectId === selectedTask.projectId && q.subcontractorId === selectedTask.subcontractorId);
  
  const subContractStatusNormalized = (currentSubcontractorContract?.status || "").trim().toLowerCase();
  const isSubContractApproved = currentSubcontractorContract && (
    subContractStatusNormalized === 'hoàn thành' || 
    subContractStatusNormalized === 'đã duyệt' || 
    subContractStatusNormalized === 'approved' || 
    subContractStatusNormalized === 'đã ký' || 
    subContractStatusNormalized === 'active' || 
    subContractStatusNormalized === 'completed' || 
    currentSubcontractorContract.isApproved === true ||
    currentSubcontractorContract.contractApproved === true
  );

  const subContractValue = isSubContractApproved ? (currentSubcontractorContract.contractValue || currentSubcontractorContract.value || 0) : 0;

  // Payments made to this subcontractor on this project
  const subPaymentsMade = paymentsList.filter(p => {
    const isRecipient = p.recipient === selectedTask.subcontractorName || p.recipient === selectedTask.subcontractorId;
    const isApprovedPayment = p.status === 'approved';
    const matchesProject = !p.projectId || p.projectId === selectedTask.projectId;
    return isRecipient && isApprovedPayment && matchesProject;
  });
  const subTotalPaidAmount = subPaymentsMade.reduce((sum, p) => sum + p.amount, 0);
  const subRemainingLiability = Math.max(0, subContractValue - subTotalPaidAmount);

  // Other pending subcontractor advance proposals (pending approval or pending payment)
  const subOtherPendingAdvances = subcontractorAdvances.filter(a => 
    a.subcontractorId === selectedTask.subcontractorId && 
    a.projectId === selectedTask.projectId && 
    (a.status === 'pending_approval' || a.status === 'pending_payment') &&
    a.id !== proposalId
  );
  const subTotalPendingAdvAmount = subOtherPendingAdvances.reduce((sum, a) => sum + a.amount, 0);
  const subAvailableToPropose = Math.max(0, subRemainingLiability - subTotalPendingAdvAmount);

  useEffect(() => {
    if (isAdvancingSubcontractor) {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const rand = Math.floor(1000 + Math.random() * 9000);
      setProposalId(`DX-${dateStr}-${rand}`);
      
      const managers = employees.filter(e => e.role === 'director' || e.role === 'pm' || e.role === 'accountant');
      const list = managers.length > 0 ? managers : employees;
      
      const customApproverEmp = selectedTask.subcontractorApproverId ? employees.find(e => e.id === selectedTask.subcontractorApproverId) : null;
      const customSettlerEmp = selectedTask.subcontractorSettlerId ? employees.find(e => e.id === selectedTask.subcontractorSettlerId) : null;
      
      const defaultApprover = customApproverEmp ? customApproverEmp.name : (list.find(e => e.role === 'director')?.name || list[0]?.name || 'Ban Giám Đốc');
      const defaultCreator = customSettlerEmp ? customSettlerEmp.name : (list.find(e => e.id === currentUser.id)?.name || list.find(e => e.role === 'accountant')?.name || list[0]?.name || 'Kế Toán');
      
      setAdvProposalApprover(defaultApprover);
      setAdvProposalCreator(defaultCreator);
      setAdvProposalDate(new Date().toISOString().split('T')[0]);
    }
  }, [isAdvancingSubcontractor, employees, currentUser, selectedTask]);

  useEffect(() => {
    if (taskId) {
      const shouldOpenAdvance = localStorage.getItem('hl_open_subcontractor_advance') === 'true';
      if (shouldOpenAdvance) {
        localStorage.removeItem('hl_open_subcontractor_advance');
        setIsAdvancingSubcontractor(true);
      }
    }
  }, [taskId]);

  useEffect(() => {
    if (showApprovalWarning) {
      const defaultId = selectedTask.defaultApproverId || assigner?.id || selectedTask.assignerId || employees.find(e => e.role === 'director')?.id || employees[0]?.id || '';
      setCustomApproverId(defaultId);
    }
  }, [showApprovalWarning, assigner, selectedTask, employees]);

  useEffect(() => {
    let active = true;
    const fetchArchivedQuotes = async () => {
      try {
        const [generalList, constructionList, cabinetList, mechanicalList, subList, advancesList, pList] = await Promise.all([
          dbService.archivedQuotes.list().catch(() => []),
          dbService.archivedConstructionQuotes.list().catch(() => []),
          dbService.archivedCabinetQuotes.list().catch(() => []),
          dbService.archivedMechanicalQuotes.list().catch(() => []),
          dbService.archivedSubcontractorQuotes.list().catch(() => []),
          dbService.subcontractorAdvances.list().catch(() => []),
          dbService.payments.list().catch(() => [])
        ]);

        const combinedList = [
          ...generalList.map((item: any) => ({ ...item, _sectorType: 'general' })),
          ...constructionList.map((item: any) => ({ ...item, _sectorType: 'construction' })),
          ...cabinetList.map((item: any) => ({ ...item, _sectorType: 'furniture' })),
          ...mechanicalList.map((item: any) => ({ ...item, _sectorType: 'mechanical' }))
        ];

        // Deduplicate by ID just in case
        const uniqueList: any[] = [];
        const seenIds = new Set();
        for (const item of combinedList) {
          if (item && item.id && !seenIds.has(item.id)) {
            seenIds.add(item.id);
            uniqueList.push(item);
          }
        }

        if (active) {
          setArchivedQuotesList(uniqueList);
          setSubcontractorContracts(subList);
          setSubcontractorAdvances(advancesList);
          setPaymentsList(pList);
        }
      } catch (err) {
        console.error("Lỗi khi tải hồ sơ lưu trữ:", err);
      }
    };

    fetchArchivedQuotes();

    const handleEventUpdate = () => {
      if (active) {
        fetchArchivedQuotes();
      }
    };

    window.addEventListener('hl-projects-updated', handleEventUpdate);
    window.addEventListener('hl-archived-quotes-updated', handleEventUpdate);
    window.addEventListener('hl-archived-cabinet-quotes-updated', handleEventUpdate);
    window.addEventListener('hl-archived-subcontractor-quotes-updated', handleEventUpdate);
    window.addEventListener('hl-subcontractor-advances-updated', handleEventUpdate);

    return () => {
      active = false;
      window.removeEventListener('hl-projects-updated', handleEventUpdate);
      window.removeEventListener('hl-archived-quotes-updated', handleEventUpdate);
      window.removeEventListener('hl-archived-cabinet-quotes-updated', handleEventUpdate);
      window.removeEventListener('hl-archived-subcontractor-quotes-updated', handleEventUpdate);
      window.removeEventListener('hl-subcontractor-advances-updated', handleEventUpdate);
    };
  }, [projects, selectedTask.projectId]);
  
  // States for sub-task missions (Nhiệm vụ trong công việc con)
  // Định dạng một Date sang chuỗi input datetime-local (YYYY-MM-DDTHH:mm) theo giờ địa phương
  const toDateTimeLocalInput = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Trả về input datetime-local = (ngày của `base`) + `addDays` ngày, đặt giờ mặc định 18:00
  const dateAt18 = (base: Date, addDays: number = 0): string => {
    const d = new Date(base);
    d.setDate(d.getDate() + addDays);
    d.setHours(18, 0, 0, 0);
    return toDateTimeLocalInput(d);
  };

  // Quy tắc Hạn hoàn thành mặc định của thẻ ⚡ Tạo nhiệm vụ:
  //  - Chưa có nhiệm vụ nào: lấy ngày hiện tại, giờ mặc định 18:00.
  //  - Đã có nhiệm vụ trước đó: lấy ngày của nhiệm vụ mới nhất + 1 ngày, giờ 18:00.
  const getDefaultMissionDeadline = (): string => {
    const missions = selectedTask?.missions || [];
    if (missions.length === 0) {
      return dateAt18(new Date(), 0);
    }
    // Nhiệm vụ "trước đó" = nhiệm vụ có hạn muộn nhất trong số đã tạo
    const latest = missions.reduce((acc, m) => {
      const t = m.deadline ? new Date(m.deadline).getTime() : 0;
      return t > acc ? t : acc;
    }, 0);
    const base = latest > 0 ? new Date(latest) : new Date();
    return dateAt18(base, 1);
  };

  // ===========================================================================
  // IMPORT / EXPORT EXCEL CHO NHIỆM VỤ CHI TIẾT (missions)
  // ===========================================================================
  // Các cột Excel: STT | Tên nhiệm vụ | Hạn hoàn thành | Trạng thái | Người phụ trách chính | Thành viên | Báo cáo | Bằng chứng
  const MISSION_EXCEL_HEADERS = [
    'STT', 'Tên nhiệm vụ', 'Hạn hoàn thành', 'Trạng thái',
    'Người phụ trách chính', 'Thành viên', 'Báo cáo', 'Bằng chứng'
  ];

  // Hàm chuyển tên nhân viên (id) thành tên hiển thị
  const empNameById = (empId?: string): string => {
    if (!empId) return '';
    const emp = employees.find(e => e.id === empId);
    return emp ? emp.name : empId;
  };

  // Hàm tìm id nhân viên theo tên (dùng khi import)
  const empIdByName = (name?: string): string | undefined => {
    if (!name || !name.trim()) return undefined;
    const trimmed = name.trim();
    const emp = employees.find(e => e.name === trimmed || e.name?.includes(trimmed));
    return emp ? emp.id : undefined;
  };

  const handleExportMissionsExcel = () => {
    const missions = selectedTask.missions || [];
    if (missions.length === 0) {
      addToast({ title: '⚠️ Không có dữ liệu', message: 'Chưa có nhiệm vụ chi tiết nào để xuất Excel.', type: 'warning' });
      return;
    }
    const data = missions.map((m, idx) => ({
      'STT': idx + 1,
      'Tên nhiệm vụ': m.name || '',
      'Hạn hoàn thành': m.deadline ? formatDateTime(m.deadline) : '',
      'Trạng thái': m.status === 'completed' ? 'Hoàn thành' : m.status === 'doing' ? 'Đang làm' : 'Chưa làm',
      'Người phụ trách chính': empNameById(m.mainAssigneeId),
      'Thành viên': (m.memberIds || []).map(id => empNameById(id)).join(', '),
      'Báo cáo': m.workReports || '',
      'Bằng chứng': m.evidence || '',
    }));
    try {
      const ws = XLSX.utils.json_to_sheet(data, { header: MISSION_EXCEL_HEADERS });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'NhiemVu');
      const safeName = (selectedTask.name || 'cong_viec').replace(/[^\p{L}\p{N}_-]/gu, '_');
      XLSX.writeFile(wb, `NhiemVuChiTiet_${safeName}.xlsx`);
      addToast({ title: '✅ Xuất Excel', message: `Đã xuất ${data.length} nhiệm vụ chi tiết.`, type: 'success' });
    } catch (err) {
      addToast({ title: '⛔ Lỗi', message: 'Không thể xuất file Excel.', type: 'error' });
    }
  };

  const handleImportMissionsExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (rows.length === 0) {
          addToast({ title: '⚠️ Không có dữ liệu', message: 'File Excel không có dòng nào.', type: 'warning' });
          return;
        }
        const imported: SubTaskMission[] = rows.map((r, idx) => {
          const name = String(r['Tên nhiệm vụ'] || '').trim();
          const statusRaw = String(r['Trạng thái'] || '').trim().toLowerCase();
          const deadlineRaw = String(r['Hạn hoàn thành'] || '').trim();
          let deadline: string | undefined;
          if (deadlineRaw) {
            // Hỗ trợ cả định dạng dd/mm/yyyy HH:MM và ISO
            const isoMatch = deadlineRaw.match(/^\d{4}-\d{2}-\d{2}/);
            if (isoMatch) {
              deadline = new Date(deadlineRaw).toISOString();
            } else {
              const parts = deadlineRaw.split(/[\/\s:]/).map(Number);
              if (parts.length >= 3) {
                const [day, month, year, hh = 12, mm = 0] = parts;
                const d = new Date(year, month - 1, day, hh, mm, 0, 0);
                if (!isNaN(d.getTime())) deadline = d.toISOString();
              }
            }
          }
          const memberNames = String(r['Thành viên'] || '').split(',').map(s => s.trim()).filter(Boolean);
          const memberIds = memberNames.map(n => empIdByName(n)).filter((v): v is string => Boolean(v));
          const mainAssigneeName = String(r['Người phụ trách chính'] || '').trim();
          const mainAssigneeId = empIdByName(mainAssigneeName);
          return {
            id: `mission_${Date.now()}_${idx}`,
            name: name || `Nhiệm vụ ${idx + 1}`,
            memberIds,
            mainAssigneeId,
            status: statusRaw === 'hoàn thành' || statusRaw === 'completed' || statusRaw === 'xong'
              ? 'completed'
              : statusRaw === 'đang làm' || statusRaw === 'doing' || statusRaw === 'đang thực hiện'
                ? 'doing'
                : 'todo',
            workReports: String(r['Báo cáo'] || ''),
            evidence: String(r['Bằng chứng'] || ''),
            createdAt: new Date().toISOString(),
            deadline,
          } as SubTaskMission;
        }).filter(m => m.name && m.name.trim());

        if (imported.length === 0) {
          addToast({ title: '⚠️ Không có dữ liệu hợp lệ', message: 'Cần cột "Tên nhiệm vụ" trong file Excel.', type: 'warning' });
          return;
        }

        // Gộp với missions hiện tại (giữ nguyên các nhiệm vụ cũ, thêm mới từ Excel)
        const currentMissions = selectedTask.missions || [];
        onUpdateTask(selectedTask.id, {
          missions: [...currentMissions, ...imported]
        });
        addToast({ title: '✅ Nhập thành công', message: `Đã import ${imported.length} nhiệm vụ chi tiết từ Excel.`, type: 'success' });
      } catch (err) {
        addToast({ title: '⛔ Lỗi', message: 'Không thể đọc file Excel. Vui lòng kiểm tra định dạng.', type: 'error' });
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const [newMissionName, setNewMissionName] = useState('');
  const [selectedMissionMemberIds, setSelectedMissionMemberIds] = useState<string[]>([]);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [newMissionDeadline, setNewMissionDeadline] = useState(() => getDefaultMissionDeadline());

  // Phân trang danh sách nhiệm vụ đã khởi tạo: 5 / 10 / 20 / 50 / tất cả dòng
  // 'all' = hiển thị toàn bộ. Danh sách sắp xếp mới nhất → cũ nhất.
  const [missionPageSize, setMissionPageSize] = useState<number | 'all'>(5);
  const [missionPage, setMissionPage] = useState(1);

  // Hidden file input for importing Nhiệm vụ chi tiết (missions) from Excel
  const missionExcelInputRef = useRef<HTMLInputElement>(null);

  // States inside detail modal of a mission
  const [missionReportText, setMissionReportText] = useState('');
  const [missionEvidenceText, setMissionEvidenceText] = useState('');
  const [missionAttachedFile, setMissionAttachedFile] = useState<{ name: string; size: string } | null>(null);
  const [missionImagePreview, setMissionImagePreview] = useState<string | null>(null);

  // Hình ảnh báo cáo nhiệm vụ thi công (bắt buộc) — URL từ Supabase Storage hoặc data URL
  const [missionReportImages, setMissionReportImages] = useState<string[]>([]);
  const [missionReportCameraOpen, setMissionReportCameraOpen] = useState(false);
  const missionReportVideoRef = useRef<HTMLVideoElement>(null);
  const missionReportImageInputRef = useRef<HTMLInputElement>(null);
  const missionReportCameraStreamRef = useRef<MediaStream | null>(null);

  const stopMissionReportCamera = () => {
    if (missionReportCameraStreamRef.current) {
      missionReportCameraStreamRef.current.getTracks().forEach(t => t.stop());
      missionReportCameraStreamRef.current = null;
    }
    setMissionReportCameraOpen(false);
  };

  const openMissionReportCamera = async () => {
    try {
      stopMissionReportCamera();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      missionReportCameraStreamRef.current = stream;
      setMissionReportCameraOpen(true);
      setTimeout(() => {
        if (missionReportVideoRef.current) {
          missionReportVideoRef.current.srcObject = stream;
          missionReportVideoRef.current.play().catch(() => { /* noop */ });
        }
      }, 150);
    } catch (err) {
      addToast({ title: '⚠️ Không thể mở camera', message: 'Vui lòng cấp quyền camera hoặc tải ảnh lên từ thiết bị.', type: 'warning' });
    }
  };

  const captureMissionReportImage = () => {
    const video = missionReportVideoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `baocao_${Date.now()}.jpg`, { type: 'image/jpeg' });
      try {
        const { url, stored } = await dbService.uploadMissionReportImage(selectedTask.id, selectedMissionId || '', file);
        setMissionReportImages(prev => [...prev, url]);
        if (stored === 'supabase') {
          addToast({ title: '✅ Đã tải ảnh lên', message: 'Hình ảnh báo cáo đã được gửi lên Supabase.', type: 'success' });
        } else {
          addToast({ title: '⚠️ Lưu cục bộ', message: 'Supabase chưa có bucket "mission-report-images" (cần chạy migration). Ảnh lưu tạm dưới dạng base64.', type: 'warning' });
        }
      } catch (e) {
        addToast({ title: '⛔ Lỗi', message: 'Không thể xử lý ảnh báo cáo.', type: 'error' });
      }
      stopMissionReportCamera();
    }, 'image/jpeg');
  };

  const handleMissionReportImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    dbService.uploadMissionReportImage(selectedTask.id, selectedMissionId || '', file)
      .then(({ url, stored }) => {
        setMissionReportImages(prev => [...prev, url]);
        if (stored === 'supabase') {
          addToast({ title: '✅ Đã tải ảnh lên', message: 'Hình ảnh báo cáo đã được gửi lên Supabase.', type: 'success' });
        } else {
          addToast({ title: '⚠️ Lưu cục bộ', message: 'Supabase chưa có bucket "mission-report-images" (cần chạy migration). Ảnh lưu tạm dưới dạng base64.', type: 'warning' });
        }
      })
      .catch(() => addToast({ title: '⛔ Lỗi', message: 'Không thể xử lý ảnh báo cáo.', type: 'error' }));
    e.target.value = '';
  };

  const removeMissionReportImage = (idx: number) => {
    setMissionReportImages(prev => prev.filter((_, i) => i !== idx));
  };

  const resetMissionReportState = () => {
    setMissionReportImages([]);
    stopMissionReportCamera();
  };

  // States inside detail modal of a mission for Travel Allowance recording
  const [allowanceMemberId, setAllowanceMemberId] = useState('');
  // Bản sao cục bộ các Công Tác Phí đã ghi nhận, key theo missionId.
  // Quan trọng: selectedTask được tính lại từ props `tasks` mỗi render, và có
  // những lúc `tasks` bị thay thế bởi dữ liệu tải từ Supabase (sự kiện
  // hl-tasks-updated) làm mất travelAllowances vừa thêm. Lưu cục bộ đảm bảo
  // dữ liệu CTP không bao giờ bị mất trước khi "Xác Nhận Hoàn Thành".
  // Để chống cả trường hợp modal bị remount (state React reset), ta persist
  // xuống localStorage theo missionId — survive reload/remount/refresh.
  const [localTravelAllowances, setLocalTravelAllowances] = useState<Record<string, any[]>>(() => {
    try {
      const raw = localStorage.getItem('hl_local_travel_allowances_v1');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  // Ghi mirror xuống localStorage mỗi khi thay đổi (an toàn nếu JSON lỗi)
  useEffect(() => {
    try {
      localStorage.setItem('hl_local_travel_allowances_v1', JSON.stringify(localTravelAllowances));
    } catch {
      /* ignore quota / serialization errors */
    }
  }, [localTravelAllowances]);
  const [allowanceNormId, setAllowanceNormId] = useState('');
  const [allowanceCustomContent, setAllowanceCustomContent] = useState('');
  const [allowanceCustomQty, setAllowanceCustomQty] = useState(1);
  const [allowanceCustomUnitPrice, setAllowanceCustomUnitPrice] = useState(0);
  const [allowanceNotes, setAllowanceNotes] = useState('');

  // Expenses proposals form states
  const [advTitle, setAdvTitle] = useState('');
  const [advAmount, setAdvAmount] = useState<number>(500000);
  const [advType, setAdvType] = useState<'advance' | 'reimbursement'>('advance');
  const [advReason, setAdvReason] = useState('');

  // States for recording violations
  interface DraftViolationRow {
    id: string;
    searchQuery: string;
    selectedCriterionId: string;
    taggedEmployeeIds: string[];
    notes: string;
    images?: string[];
    isSearchOpen?: boolean;
    isTagOpen?: boolean;
  }

  const [cameraRowId, setCameraRowId] = useState<string | null>(null);
  const [detailCameraStream, setDetailCameraStream] = useState<MediaStream | null>(null);

  const removeVietnameseTones = (str: string): string => {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase();
  };

  const [violationRows, setViolationRows] = useState<DraftViolationRow[]>([
    { id: 'v_init_' + Date.now(), searchQuery: '', selectedCriterionId: '', taggedEmployeeIds: [], notes: '', images: [], isSearchOpen: false, isTagOpen: false }
  ]);

  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Click-outside handler to close violation criteria search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setViolationRows(prev => prev.map(r => r.isSearchOpen ? { ...r, isSearchOpen: false } : r));
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [submittedViolations, setSubmittedViolations] = useState<{ id: string; criterionId: string; employeeIds: string[]; notes: string; images: string[]; createdAt: string }[]>([]);
  // Toàn bộ lỗi vi phạm load trực tiếp từ Supabase (không dùng localStorage)
  const [cloudErrors, setCloudErrors] = useState<any[]>([]);

  const loadSubmittedViolations = (source?: any[]) => {
    const errors = source ?? cloudErrors;
    const matched = (errors || []).filter((item: any) =>
      item.taskId === selectedTask.id || (item.notes && item.notes.includes(selectedTask.name))
    );
    setSubmittedViolations(matched);
  };

  // Load lỗi vi phạm từ Supabase khi mở modal (nguồn dữ liệu chính)
  useEffect(() => {
    let mounted = true;
    dbService.hrmEmployeeErrors.list()
      .then((d: any[]) => {
        if (!mounted) return;
        setCloudErrors(d || []);
        loadSubmittedViolations(d || []);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  // Đồng bộ lỗi vi phạm lên Supabase để xuất hiện trong Nhật ký lỗi vi phạm (HR).
  // Lưu nguyên taskId/autoSource (cột task_id / auto_source đã có từ migration 017).
  const syncEmployeeErrorsToSupabase = (errors: any[]) => {
    errors.forEach((err) => {
      dbService.hrmEmployeeErrors.save(err)
        .catch((e) => console.warn('Sync lỗi vi phạm lên Supabase thất bại:', e?.message || e));
    });
    // Báo cho màn hình HR refresh danh sách (nếu đang mở cùng trình duyệt)
    try { window.dispatchEvent(new CustomEvent('hl-hrm-employee-errors-updated')); } catch {}
  };

  const convertToDatetimeLocal = (isoString?: string): string => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '';
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch (e) {
      return '';
    }
  };

  const getRemainingDaysText = (deadlineStr?: string) => {
    if (!deadlineStr) return '';
    try {
      const end = new Date(deadlineStr);
      if (isNaN(end.getTime())) return '';
      const now = new Date();
      const diffTime = end.getTime() - now.getTime();
      if (diffTime < 0) {
        const diffDays = Math.ceil(Math.abs(diffTime) / (1000 * 60 * 60 * 24));
        return `Trễ ${diffDays} ngày`;
      } else {
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 0) {
          return 'Hôm nay';
        }
        return `${diffDays} ngày còn lại`;
      }
    } catch (e) {
      return '';
    }
  };

  useEffect(() => {
    loadSubmittedViolations();

    setNewMissionDeadline(getDefaultMissionDeadline());

    const proj = projects.find(p => p.id === selectedTask.projectId);
    setViolationRows([
      { 
        id: 'v_init_' + Date.now(), 
        searchQuery: '', 
        selectedCriterionId: '', 
        taggedEmployeeIds: [], 
        notes: `Công việc: "${selectedTask.name}" - Dự án: "${proj?.name || 'Không rõ'}"\n`, 
        images: [], 
        isSearchOpen: false, 
        isTagOpen: false 
      }
    ]);
  }, [selectedTask.id, selectedTask.deadline]);

  // Load tiêu chí từ Supabase (nguồn chính xác) — trước đây chỉ đọc localStorage
  // 'hl_hrm_performance_criteria_v1' nhưng không có nơi nào ghi key này nên luôn rỗng.
  const [cloudCriteria, setCloudCriteria] = React.useState<{ id: string; content: string; category: 'readiness' | 'progress' | 'reporting'; deptName?: string }[]>([]);
  React.useEffect(() => {
    let mounted = true;
    dbService.hrmPerformanceCriteria.list()
      .then((d: any[]) => {
        if (!mounted) return;
        const flat: { id: string; content: string; category: 'readiness' | 'progress' | 'reporting'; deptName?: string }[] = [];
        d.forEach((dept: any) => {
          const criteriaArr = typeof dept.criteria === 'string'
            ? (() => { try { return JSON.parse(dept.criteria); } catch { return []; } })()
            : (Array.isArray(dept.criteria) ? dept.criteria : []);
          criteriaArr.forEach((crit: any) => {
            flat.push({
              id: crit.id,
              content: crit.content,
              category: (crit.category || 'readiness') as 'readiness' | 'progress' | 'reporting',
              deptName: dept.departmentName
            });
          });
        });
        setCloudCriteria(flat);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  const allCriteria = React.useMemo(() => {
    // Ưu tiên dữ liệu vừa fetch từ Supabase
    if (cloudCriteria.length > 0) return cloudCriteria;

    // Fallback sang localStorage (dữ liệu cũ trước khi có Supabase)
    const flat: { id: string; content: string; category: 'readiness' | 'progress' | 'reporting'; deptName?: string }[] = [];
    try {
      const saved = localStorage.getItem('hl_hrm_performance_criteria_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          parsed.forEach((dept: any) => {
            if (dept.criteria && Array.isArray(dept.criteria)) {
              dept.criteria.forEach((crit: any) => {
                flat.push({
                  id: crit.id,
                  content: crit.content,
                  category: (crit.category || 'readiness') as 'readiness' | 'progress' | 'reporting',
                  deptName: dept.departmentName
                });
              });
            }
          });
        }
      }
    } catch (e) {
      console.error(e);
    }

    return flat;
  }, [cloudCriteria]);

  const relatedEmployees = React.useMemo(() => {
    const relatedIds = new Set<string>();
    if (selectedTask.assigneeId) {
      relatedIds.add(selectedTask.assigneeId);
    }
    if (selectedTask.missions) {
      selectedTask.missions.forEach(mission => {
        if (mission.mainAssigneeId) {
          relatedIds.add(mission.mainAssigneeId);
        }
        if (mission.memberIds) {
          mission.memberIds.forEach(id => relatedIds.add(id));
        }
      });
    }
    return employees.filter(emp => relatedIds.has(emp.id));
  }, [selectedTask, employees]);

  useEffect(() => {
    if (selectedTask.status === 'completed') return;
    try {
      // Nguồn dữ liệu trực tiếp từ Supabase (đã load khi mở modal)
      let existingErrors: any[] = cloudErrors || [];
      // Sắp xếp để các phần tử mới (unshift vào đầu) không ghi đè lẫn nhau khi chống trùng
      existingErrors = existingErrors.slice();

      let hasChanged = false;
      // Theo dõi các log tự động mới tạo để đồng bộ lên Supabase
      const newlyCreatedLogs: any[] = [];
      const proj = projects.find(p => p.id === selectedTask.projectId);
      const projName = proj?.name || 'Không rõ';

      // 1. Check if the subtask itself is overdue
      if (selectedTask.deadline) {
        const isTaskOverdue = new Date(selectedTask.deadline).getTime() < Date.now();
        if (isTaskOverdue && selectedTask.assigneeId) {
          const autoKey = `auto_overdue_task_${selectedTask.id}_${selectedTask.assigneeId}`;
          const isAlreadyLogged = existingErrors.some((err: any) => err.autoSource === autoKey);
          
          if (!isAlreadyLogged) {
            const assignee = employees.find(e => e.id === selectedTask.assigneeId);
            if (assignee) {
              // Resolve employee ID mapped to HRM
              let resolvedEmployeeId = assignee.id;
              try {
                const hrmEmpsStr = localStorage.getItem('hl_hrm_employees_v3');
                if (hrmEmpsStr) {
                  const hrmEmps = JSON.parse(hrmEmpsStr);
                  if (Array.isArray(hrmEmps)) {
                    const matchedHrmEmp = hrmEmps.find((he: any) => he.name && assignee.name && (he.name.toLowerCase().trim() === assignee.name.toLowerCase().trim()));
                    if (matchedHrmEmp) {
                      resolvedEmployeeId = matchedHrmEmp.id;
                    }
                  }
                }
              } catch (e) {
                console.error(e);
              }

              const criterion = allCriteria.find((c: any) => c.content === 'Làm chậm công việc và ảnh hưởng đến phòng ban khác') || { id: 'crit_B_10', content: 'Làm chậm công việc và ảnh hưởng đến phòng ban khác', category: 'progress' };
              const logId = `err_log_auto_task_${selectedTask.id}_${Date.now()}`;
              
              existingErrors.unshift({
                id: logId,
                employeeId: resolvedEmployeeId,
                employeeName: assignee.name,
                departmentCode: assignee.department || 'A',
                departmentName: assignee.department || '',
                criterionId: criterion.id,
                criterionContent: criterion.content,
                category: 'progress',
                date: new Date().toISOString().split('T')[0],
                notes: `Công việc: "${selectedTask.name}" - Dự án: "${projName}"`,
                images: [],
                taskId: selectedTask.id,
                autoSource: autoKey
              });
              newlyCreatedLogs.push(existingErrors[0]);
              hasChanged = true;
            }
          }
        }
      }

      // 2. Check if any mission is overdue
      if (selectedTask.missions && Array.isArray(selectedTask.missions)) {
        selectedTask.missions.forEach((mission: any) => {
          if (mission.deadline && mission.status !== 'completed') {
            const isMissionOverdue = new Date(mission.deadline).getTime() < Date.now();
            if (isMissionOverdue) {
              // Collect all people involved: main assignee + members
              const targetEmpIds = Array.from(new Set([mission.mainAssigneeId, ...(mission.memberIds || [])].filter(Boolean) as string[]));
              
              targetEmpIds.forEach((empId) => {
                const autoKey = `auto_overdue_mission_${mission.id}_${empId}`;
                const isAlreadyLogged = existingErrors.some((err: any) => err.autoSource === autoKey);
                
                if (!isAlreadyLogged) {
                  const emp = employees.find(e => e.id === empId);
                  if (emp) {
                    // Resolve employee ID mapped to HRM
                    let resolvedEmployeeId = emp.id;
                    try {
                      const hrmEmpsStr = localStorage.getItem('hl_hrm_employees_v3');
                      if (hrmEmpsStr) {
                        const hrmEmps = JSON.parse(hrmEmpsStr);
                        if (Array.isArray(hrmEmps)) {
                          const matchedHrmEmp = hrmEmps.find((he: any) => he.name && emp.name && (he.name.toLowerCase().trim() === emp.name.toLowerCase().trim()));
                          if (matchedHrmEmp) {
                            resolvedEmployeeId = matchedHrmEmp.id;
                          }
                        }
                      }
                    } catch (e) {
                      console.error(e);
                    }

                    const criterion = allCriteria.find((c: any) => c.content === 'Làm chậm công việc và ảnh hưởng đến phòng ban khác') || { id: 'crit_B_10', content: 'Làm chậm công việc và ảnh hưởng đến phòng ban khác', category: 'progress' };
                    const logId = `err_log_auto_m_${mission.id}_${empId}_${Date.now()}`;
                    
                    existingErrors.unshift({
                      id: logId,
                      employeeId: resolvedEmployeeId,
                      employeeName: emp.name,
                      departmentCode: emp.department || 'A',
                      departmentName: emp.department || '',
                      criterionId: criterion.id,
                      criterionContent: criterion.content,
                      category: 'progress',
                      date: new Date().toISOString().split('T')[0],
                      notes: `Công việc: "${selectedTask.name}" - Dự án: "${projName}" - Công việc: "${mission.name}"`,
                      images: [],
                      taskId: selectedTask.id,
                      autoSource: autoKey
                    });
                    newlyCreatedLogs.push(existingErrors[0]);
                    hasChanged = true;
                  }
                }
              });
            }
          }
        });
      }

      if (hasChanged) {
        // Đồng bộ lên Supabase (nguồn dữ liệu chính — không ghi localStorage)
        syncEmployeeErrorsToSupabase(newlyCreatedLogs);
        // Cập nhật state cục bộ + lịch sử hiển thị
        setCloudErrors(existingErrors);
        loadSubmittedViolations(existingErrors);
      }
    } catch (err) {
      console.error("Autologging error logs failed:", err);
    }
    // cloudErrors trong deps để khi load xong từ Supabase, effect chạy lại
    // và check autoSource đúng → không tạo log trùng.
  }, [selectedTask, employees, projects, allCriteria, cloudErrors]);

  const isMissionAssignee = selectedTask.missions?.some(m => m.mainAssigneeId === currentUser.id || m.memberIds?.includes(currentUser.id)) || false;

  const handleSendViolations = () => {
    for (let i = 0; i < violationRows.length; i++) {
      const row = violationRows[i];
      if (!row.selectedCriterionId) {
        addToast({ title: '❌ Lỗi', message: `Dòng vi phạm số ${i + 1} chưa cấu hình lỗi/tiêu chí vi phạm.`, type: 'error' });
        return;
      }
      if (row.taggedEmployeeIds.length === 0) {
        addToast({ title: 'ℹ️ Thông báo', message: `Dòng vi phạm số ${i + 1} chưa gán người vi phạm.`, type: 'info' });
        return;
      }
    }

    // Nguồn dữ liệu trực tiếp từ Supabase (đã load khi mở modal)
    const existingErrors = cloudErrors || [];

    const newLogsToInsert: any[] = [];
    const loggedNames: string[] = [];

    violationRows.forEach(row => {
      const criterion = allCriteria.find(c => c.id === row.selectedCriterionId);
      if (!criterion) return;

      row.taggedEmployeeIds.forEach(empId => {
        const emp = employees.find(e => e.id === empId);
        if (!emp) return;

        let resolvedEmployeeId = emp.id;
        try {
          const hrmEmpsStr = localStorage.getItem('hl_hrm_employees_v3');
          if (hrmEmpsStr) {
            const hrmEmps = JSON.parse(hrmEmpsStr);
            if (Array.isArray(hrmEmps)) {
              const matchedHrmEmp = hrmEmps.find((he: any) => he.name && emp.name && (he.name.toLowerCase().trim() === emp.name.toLowerCase().trim()));
              if (matchedHrmEmp) {
                resolvedEmployeeId = matchedHrmEmp.id;
              }
            }
          }
        } catch (err) {
          console.error("Failed to map employee name to HRM id:", err);
        }

        const logId = `err_log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        newLogsToInsert.push({
          id: logId,
          employeeId: resolvedEmployeeId,
          employeeName: emp.name,
          departmentCode: emp.department || 'A',
          departmentName: emp.department || '',
          criterionId: criterion.id,
          criterionContent: criterion.content,
          category: criterion.category || 'readiness',
          date: new Date().toISOString().split('T')[0],
          notes: row.notes || `Ghi nhận vi phạm liên thông từ Công việc: "${selectedTask.name}"`,
          images: row.images || [],
          taskId: selectedTask.id
        });

        if (!loggedNames.includes(emp.name)) {
          loggedNames.push(emp.name);
        }
      });
    });

    const updatedErrors = [...newLogsToInsert, ...existingErrors];
    // Đồng bộ lên Supabase (nguồn dữ liệu chính — không ghi localStorage)
    syncEmployeeErrorsToSupabase(newLogsToInsert);
    // Cập nhật state cục bộ + lịch sử hiển thị
    setCloudErrors(updatedErrors);
    loadSubmittedViolations(updatedErrors);


    if (detailCameraStream) {
      detailCameraStream.getTracks().forEach(track => track.stop());
    }
    setDetailCameraStream(null);
    setCameraRowId(null);

    addToast({ title: '✅ Thành công', message: 'Đã gửi vi phạm thành công!', type: 'success' });
    // 📣 Gửi thông báo vào NHÓM CHAT DỰ ÁN (hàm sendGroupChatMessage)
    notifyProjectChat(`⚠️ ${currentUser.name} đã ghi nhận vi phạm cho: [${loggedNames.join(', ')}] trong công việc "${selectedTask.name}".`);
    const proj = projects.find(p => p.id === selectedTask.projectId);
    setViolationRows([
      { 
        id: 'v_init_' + Date.now(), 
        searchQuery: '', 
        selectedCriterionId: '', 
        taggedEmployeeIds: [], 
        notes: `Công việc: "${selectedTask.name}" - Dự án: "${proj?.name || 'Không rõ'}"\n`, 
        images: [], 
        isSearchOpen: false, 
        isTagOpen: false 
      }
    ]);
  };

  const handleConfirmApprovalRequest = () => {
    // Build approval chain (chọn tự do)
    let updatedApprovals: any[];
    let approverName: string;

    const approverId = customApproverId || assigner?.id || selectedTask.assignerId || employees.find(e => e.role === 'director')?.id || employees[0]?.id || currentUser.id;
    approverName = employees.find(e => e.id === approverId)?.name || 'Người quản lý / Người giao việc';
    updatedApprovals = [
      ...(selectedTask.approvals || []),
      {
        id: `app_ct_${Date.now()}`,
        levelName: 'Ủy quyền duyệt một cấp dán chỉ mộc',
        approverId: approverId,
        status: 'pending' as const
      }
    ];

    // 2. Prepare comments
    const timestamp = new Date().toISOString();
    const newComment = {
      id: `comment_ct_${Date.now()}`,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role || 'user',
      content: `🔔 [HỆ THỐNG LIÊN THÔNG BÁO CÁO]: Đã thiết lập yêu cầu phê duyệt liên thông tự động: "${approverName}". Người duyệt: ${approverName}. Kính trình xem xét kết quả.`,
      createdAt: timestamp
    };

    onUpdateTask(selectedTask.id, {
      status: 'reviewing',
      completionRate: 90,
      approvals: updatedApprovals,
      comments: [newComment, ...(selectedTask.comments || [])]
    });
    // 📣 Gửi thông báo vào NHÓM CHAT DỰ ÁN (hàm sendGroupChatMessage)
    notifyProjectChat(`🔔 ${currentUser.name} đã gửi Yêu cầu phê duyệt công việc "${selectedTask.name}" (Người duyệt: ${approverName}).`);

    setShowApprovalWarning(false);
    addToast({ title: '✅ Thành công', message: 'Đã gửi yêu cầu phê duyệt liên thông tự động thành công!', type: 'success' });
  };

  // Xử lý duyệt từng cấp (sequential) — chỉ bước đang chờ mới được duyệt
  const handleApproveStep = (stepId: string, decision: 'approved' | 'rejected') => {
    if (!selectedTask.approvals) return;
    const next = selectedTask.approvals.map((s: any) =>
      s.id === stepId
        ? { ...s, status: decision, updatedAt: new Date().toISOString() }
        : s
    );
    const allApproved = next.length > 0 && next.every((s: any) => s.status === 'approved');
    const updatedTask = {
      ...selectedTask,
      approvals: next,
      status: allApproved ? 'completed' as const : selectedTask.status,
      completionRate: allApproved ? 100 : selectedTask.completionRate,
    };
    onUpdateTask?.(selectedTask.id, updatedTask as any);
    // 📣 Gửi thông báo vào NHÓM CHAT DỰ ÁN (hàm sendGroupChatMessage)
    if (decision === 'approved') {
      notifyProjectChat(`✅ ${currentUser.name} đã DUYỆT bước phê duyệt công việc "${selectedTask.name}"${allApproved ? ' — Công việc đã HOÀN THÀNH.' : ''}.`);
    } else {
      notifyProjectChat(`❌ ${currentUser.name} đã TỪ CHỐI bước phê duyệt công việc "${selectedTask.name}".`);
    }
    addToast({
      title: decision === 'approved' ? '✅ Đã duyệt' : '❌ Đã từ chối',
      message: decision === 'approved' ? 'Bước duyệt đã được phê duyệt.' : 'Bước duyệt đã bị từ chối.',
      type: decision === 'approved' ? 'success' : 'warning',
    });
  };

  const taskStatusLabels: Record<TaskStatus, string> = {
    todo: 'Chưa làm',
    doing: 'Đang làm',
    reviewing: 'Chờ duyệt',
    completed: 'Hoàn thành',
    overdue: 'Trễ hạn'
  };

  const formatDateTime = (str: string) => {
    if (!str) return 'Chưa thiết lập';
    try {
      const d = new Date(str);
      if (isNaN(d.getTime())) return str;
      const date = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${date}/${month}/${year} ${hours}:${minutes}`;
    } catch (e) {
      return str;
    }
  };

  // Add Expenses request
  const handleAddAdvanceRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!advTitle.trim()) return;

    const newRequest = {
      id: `adv_${Date.now()}`,
      title: advTitle,
      amount: advAmount,
      status: 'pending' as const,
      reason: advReason || 'Phục vụ thi công lắp dựng dự án',
      proposerName: employees.find(emp => emp.id === selectedTask.assigneeId)?.name || currentUser.name,
      date: new Date().toISOString().split('T')[0],
      type: advType
    };

    const prevRequests = selectedTask.advanceRequests || [];

    onUpdateTask(selectedTask.id, {
      advanceRequests: [...prevRequests, newRequest]
    });

    setAdvTitle('');
    setAdvReason('');
    setShowAdvForm(false);
  };

  // Approve / Reject Expenses proposal
  const handleActionAdvanceRequest = (reqId: string, action: 'approved' | 'rejected') => {
    const prevRequests = selectedTask.advanceRequests || [];
    const updated = prevRequests.map(r => r.id === reqId ? { ...r, status: action } : r);
    const item = prevRequests.find(r => r.id === reqId);

    onUpdateTask(selectedTask.id, {
      advanceRequests: updated
    });
  };

  const handleAddSubcontractorAdvance = async (
    code: string,
    subcontractorId: string,
    subcontractorName: string,
    projectId: string,
    projectName: string,
    taskId: string,
    taskName: string,
    amount: number,
    reason: string,
    approver: string,
    creator: string,
    proposalDate: string
  ) => {
    if (!code || amount <= 0) {
      setCustomDialog({
        show: true,
        type: 'alert',
        title: 'Lỗi nhập liệu ⚠️',
        message: 'Vui lòng nhập số tiền đề xuất tạm ứng hợp lệ!'
      });
      return;
    }

    if (amount > subRemainingLiability) {
      setCustomDialog({
        show: true,
        type: 'alert',
        title: 'Vượt Quá Giới Hạn Công Nợ ⚠️',
        message: `Số tiền đề xuất tạm ứng (${amount.toLocaleString('vi-VN')} VNĐ) vượt quá số tiền công nợ còn lại của thầu phụ (${subRemainingLiability.toLocaleString('vi-VN')} VNĐ).\n\nVui lòng điều chỉnh lại số tiền hợp lệ!`
      });
      return;
    }

    const proposal: SubcontractorAdvanceProposal = {
      id: code,
      subcontractorId,
      subcontractorName,
      projectId,
      projectName,
      taskId,
      taskName,
      amount,
      reason: reason || `Đề xuất chi phí cho công việc: ${taskName}`,
      approver,
      creator,
      status: 'pending_approval',
      date: proposalDate,
      proposalDate: proposalDate,
      type: 'project_expense_proposal'
    };

    try {
      await dbService.subcontractorAdvances.save(proposal);

      // Show high-end custom success notification
      setCustomDialog({
        show: true,
        type: 'alert',
        title: 'Gửi Đề Xuất Thành Công! 🎉',
        message: `Hệ thống đã lưu trữ và gửi Đề xuất Tạm ứng thành công sang phòng Tài chính Kế toán!\n\n• Mã chứng từ: ${code}\n• Số tiền đề xuất: ${amount.toLocaleString('vi-VN')} VNĐ\n• Thầu phụ: ${subcontractorName}\n• Người lập phiếu: ${creator}\n• Người xét duyệt: ${approver}\n• Ngày đề xuất: ${proposalDate}`,
        onConfirm: () => {
          setSubcontractorAdvAmount(0);
          setSubcontractorAdvReason('');
          setIsAdvancingSubcontractor(false);
        }
      });
    } catch (err) {
      console.error(err);
      setCustomDialog({
        show: true,
        type: 'alert',
        title: 'Gửi đề xuất thất bại ❌',
        message: 'Có lỗi xảy ra trong quá trình truyền dữ liệu, vui lòng thử lại sau!'
      });
    }
  };

  const managementGroup = employees.filter(e => e.role === 'director' || e.role === 'pm' || e.role === 'accountant');
  const finalManagementGroup = managementGroup.length > 0 ? managementGroup : employees;

  // Auto-calculated progress rate
  const rate = selectedTask.status === 'completed' ? 100 
             : selectedTask.status === 'reviewing' ? 90 
             : selectedTask.status === 'doing' ? (selectedTask.completionRate || 50) 
             : 10;
  
  const progressColor = rate === 100 ? 'bg-emerald-500' 
                      : rate >= 70 ? 'bg-sky-500' 
                      : rate >= 30 ? 'bg-amber-500' 
                      : 'bg-rose-500';

  // Format initials for Avatars exactly like project member displays
  const renderInitialsAvatar = (emp: Employee, options?: { showNameLabel?: boolean, statusText?: string, onDelete?: () => void }) => {
    const parts = emp.name.split(' ');
    const initials = parts.length >= 2
      ? `${parts[parts.length - 2][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : (parts[0] ? parts[0].substring(0, 2).toUpperCase() : '??');
    
    return (
      <div className="flex items-center gap-2 group/avatar relative shrink-0" key={emp.id}>
        <div 
          className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center font-black text-white text-[11px] shadow-lg border border-white/10 transition-all duration-200 hover:scale-[1.07] relative cursor-pointer"
          title={`${emp.name} (${emp.role?.toUpperCase() || '—'} - ${emp.department})`}
        >
          {initials}
          {options?.onDelete && (
            <div 
              onClick={(e) => { e.stopPropagation(); options.onDelete?.(); }}
              className="absolute inset-0 bg-red-600/90 rounded-full flex items-center justify-center text-white font-extrabold text-[10px] opacity-0 group-hover/avatar:opacity-100 transition-opacity"
            >
              ✕
            </div>
          )}
        </div>
        {(options?.showNameLabel !== false) && (
          <div>
            <span className="font-bold text-slate-100 block text-[11px] leading-tight">{emp.name}</span>
            <span className="text-[9px] text-slate-400 block leading-none mt-0.5">{emp.department}</span>
            {options?.statusText && <span className="text-[8px] text-emerald-400 font-semibold block mt-0.5">{options.statusText}</span>}
          </div>
        )}
      </div>
    );
  };

  // ─── ĐỒNG BỘ CÔNG TÁC PHÍ LÊN SUPABASE (hrm_travel_expenses) ───────────────
  // GỌI NGAY KHI "Thêm công tác phí" để dữ liệu được lưu TỨC THÌ, KHÔNG phụ
  // thuộc vào bước "Xác Nhận Hoàn Thành" (vốn dễ bị mất do task reload từ
  // Supabase làm rỗng mảng missions giữa lúc ghi nhận và lúc hoàn thành).
  // `ta.rowId` (UUID) đảm bảo upsert lặp lại an toàn, không tạo dòng trùng.
  const persistTravelExpense = (ta: any, missionName: string) => {
    if (!ta) return;
    const project = projects.find(p => p.id === selectedTask.projectId);
    const customer = customers?.find(c => c.id === project?.customerId);
    const emp = employees.find(e => e.id === ta.memberId);
    let rowId: string = ta.rowId;
    if (!rowId) {
      rowId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID()
        : `te_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
    }
    const summaryItem = {
      id: ta.id || `THCTP-${Date.now()}`,
      rowId,
      code: ta.code || `THCTP-${ta.id || Date.now()}`,
      status: 'pending',
      completedDate: new Date().toLocaleDateString('vi-VN'),
      projectName: project?.name || 'Chưa rõ',
      customerName: customer?.name || 'Khách hàng lẻ',
      taskName: selectedTask.name,
      missionName,
      employeeName: emp?.name || 'Chưa gán',
      content: ta.content || 'Công tác phí',
      amount: ta.amount || 0,
      createdAt: new Date().toISOString(),
      taskId: selectedTask.id,
      missionId: selectedMissionId || undefined,
    };
    dbService.hrmTravelExpenses.save(summaryItem, { rowId })
      .catch((e) => console.warn('[TravelExpense] ⚠️ Lưu Supabase (thêm CTP) thất bại:', e?.message || e));
  };


  return (
    <div 
      className="fixed inset-0 bg-black/85 backdrop-blur-xs flex justify-end z-[110] animate-fade-in" 
      onClick={onClose}
    >
      <div 
        className="w-full max-w-[1536px] bg-slate-900 border-l border-slate-800 h-full flex flex-col text-xs text-slate-300 overflow-hidden shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 shrink-0 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
              <Zap className="w-5.5 h-5.5 text-slate-950 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-[10px] text-emerald-400 bg-emerald-950/50 px-2.5 py-0.5 rounded border border-emerald-900/30">
                  {selectedTask.code}
                </span>
              </div>
              <h4 className="font-extrabold text-white text-md mt-1">CHI TIẾT CÔNG VIỆC</h4>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 px-3 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg border border-slate-800 cursor-pointer flex items-center gap-1.5 transition text-[11px] font-bold"
          >
            <X className="w-4 h-4" />
            Đóng bảng tin
          </button>
        </div>

        {/* Dynamic Connected Layout Container */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          
          {/* Scrollable Core Elements */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/70 flex flex-col justify-between" id="modal_left_scrollable">
            
            <div className="space-y-4">
              {/* Cảnh báo và thông báo tiến trình phê duyệt */}
              {selectedTask.isApprovalRequired === true && (
                <div className="space-y-3" id="approval_status_banner">
                  {selectedTask.status === 'doing' && (
                    <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 p-4 rounded-xl flex items-start gap-3">
                      <Shield className="w-5 h-5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                      <div>
                        <span className="font-extrabold text-[12px] block text-white uppercase tracking-wider">⚠️ Quy trình phê duyệt bắt buộc</span>
                        <span className="text-[11.5px] text-amber-350 leading-relaxed block mt-1">
                          Công việc này bắt buộc phải được phê duyệt để được hoàn thành, vui lòng bấm <strong className="text-white bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">Yêu cầu phê duyệt</strong>.
                        </span>
                      </div>
                    </div>
                  )}
                  {selectedTask.status === 'reviewing' && (
                    <div className="bg-sky-500/10 border border-sky-500/30 text-sky-450 p-4 rounded-xl flex items-start gap-3">
                      <Clock className="w-5 h-5 text-sky-400 shrink-0 mt-0.5 animate-spin" />
                      <div>
                        <span className="font-extrabold text-[12px] block text-white uppercase tracking-wider">⏳ Trạng thái chờ xét duyệt</span>
                        <span className="text-[11.5px] text-sky-300 leading-relaxed block mt-1">
                          Công việc đang được chờ phê duyệt của <strong className="text-white font-extrabold underline">{assigner?.name || 'người giao việc'}</strong>.
                        </span>
                      </div>
                    </div>
                  )}

                  
                </div>
              )}

              {/* THẺ THÔNG TIN CƠ BẢN NHIỆM VỤ */}
              <div className="bg-slate-950 border border-slate-850 p-4.5 rounded-2xl space-y-4">
                <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                  <span className="font-extrabold text-[11px] text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    THÔNG TIN CÔNG VIỆC
                  </span>
                </div>

                <div className="text-[12px] space-y-2 mt-2">
                  <div className="flex items-center gap-2 py-0.5 flex-wrap">
                    <span className="text-slate-400 font-bold">Công việc:</span>
                    <strong className="text-white font-extrabold text-[12.5px]">{selectedTask.name}</strong>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold border ${
                      selectedTask.status === 'completed' ? 'bg-white text-emerald-600 border-emerald-300 shadow-sm' :
                      selectedTask.status === 'doing' ? 'bg-white text-sky-600 border-sky-300 shadow-sm' :
                      selectedTask.status === 'reviewing' ? 'bg-white text-indigo-600 border-indigo-300 shadow-sm' :
                      selectedTask.status === 'overdue' ? 'bg-white text-rose-600 border-rose-300 shadow-sm' :
                      'bg-white text-slate-500 border-slate-300 shadow-sm'
                    }`}>
                      {taskStatusLabels[selectedTask.status]}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                    {project && (
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 font-bold shrink-0">Dự án:</span>
                        <span className="text-slate-200 font-semibold truncate" title={project.name}>
                          {project.name}
                        </span>
                      </div>
                    )}

                    {project && (
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 font-bold shrink-0">Khách hàng:</span>
                        <span className="text-amber-400 font-extrabold truncate">
                          {customers?.find(c => c.id === project.customerId)?.name || 'Vãng lai'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

              {/* Thẻ Hạn bàn giao & Đầu mục kiểm soát kĩ thuật (Checklist) chung 1 thẻ */}
              <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-850/50 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="block text-slate-450 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-rose-455" />
                      HẠN BÀN GIAO:
                    </span>
                    <strong className="text-rose-400 font-mono text-sm tracking-wide block">
                      {formatDateTime(selectedTask.deadline)}
                    </strong>
                  </div>
                  {selectedTask.deadline && selectedTask.status !== 'completed' && (
                    <span className={`px-2 py-0.5 rounded text-[9.5px] font-black border uppercase select-none ${
                      new Date(selectedTask.deadline).getTime() < Date.now()
                        ? 'bg-rose-955/35 text-rose-400 border-rose-900/40 animate-pulse'
                        : 'bg-emerald-955/35 text-emerald-400 border-emerald-900/30'
                    }`}>
                      {getRemainingDaysText(selectedTask.deadline)}
                    </span>
                  )}
                </div>

                {selectedTask.checklistTexts && selectedTask.checklistTexts.length > 0 && (
                  <div className="space-y-2.5 pt-3.5 border-t border-slate-800/40">
                    <span className="block text-slate-450 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 select-none">
                      <ListTodo className="w-3.5 h-3.5 text-emerald-400" />
                      ĐẦU MỤC KIỂM SOÁT KỸ THUẬT (CHECKLIST):
                    </span>
                    <div className="space-y-2">
                      {selectedTask.checklistTexts.map((chk, idx) => {
                        const isCompleted = selectedTask.completedChecklistTexts?.includes(chk) || false;
                        return (
                          <div 
                            key={idx} 
                            onClick={() => {
                              if (selectedTask.status === 'completed') return;
                              const currentCompleted = selectedTask.completedChecklistTexts || [];
                              let updatedCompleted: string[];
                              if (currentCompleted.includes(chk)) {
                                updatedCompleted = currentCompleted.filter(t => t !== chk);
                              } else {
                                updatedCompleted = [...currentCompleted, chk];
                              }

                              onUpdateTask(selectedTask.id, {
                                completedChecklistTexts: updatedCompleted
                              });
                            }}
                            className={`flex items-center gap-2.5 text-[11px] group transition-all duration-200 select-none ${
                              selectedTask.status === 'completed' ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all duration-200 ${
                              isCompleted 
                                ? 'bg-emerald-600 border-emerald-500 text-white shadow-[0_0_8px_rgba(16,185,129,0.35)]' 
                                : 'bg-slate-950 border-slate-800 text-slate-500 group-hover:border-slate-700'
                            }`}>
                              {isCompleted ? (
                                <Check className="w-3 h-3 stroke-[3]" />
                              ) : (
                                <span className="text-[9px] font-mono font-bold">{idx + 1}</span>
                              )}
                            </div>
                            
                            <div className={`flex-1 px-3 py-2 border rounded-lg font-mono transition-all duration-200 ${
                              isCompleted 
                                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.06)] font-bold' 
                                : 'bg-slate-950/40 border-slate-850/50 text-slate-300'
                            }`}>
                              {chk}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Hệ thống Avatar Nhân Sự Công Trình */}
              <div className="pt-4 space-y-3">
                <span className="block text-slate-450 font-bold text-[10px] uppercase tracking-wider">
                  👥 NHÂN SỰ CÔNG VIỆC
                </span>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/20 p-2.5 rounded-xl border border-slate-850/40">
                  
                  {/* 1. NGƯỜI GIAO VIỆC */}
                  <div className="space-y-1.5">
                    <span className="block text-slate-500 text-[9.5px] font-bold uppercase tracking-wider">Người Giao Việc</span>
                    {assigner ? renderInitialsAvatar(assigner, { statusText: 'Chủ trì việc gốc' }) : (
                      <span className="text-slate-500 italic block text-[11px] pt-1">Chưa xác định</span>
                    )}
                  </div>

                  {/* 2. PHỤ TRÁCH CHÍNH */}
                  <div className="space-y-1.5">
                    <span className="block text-slate-500 text-[9.5px] font-bold uppercase tracking-wider flex items-center gap-1">
                      Phụ Trách Chính
                      {(selectedTask.status === 'completed' || selectedTask.status === 'doing' || (!isReadOnly && currentUser.id !== assigner?.id && currentUser.id !== selectedTask.assignerId)) && (
                        <span className="text-[9px] text-rose-450 font-normal normal-case flex items-center gap-0.5">
                          (🔒)
                        </span>
                      )}
                    </span>
                    {isReadOnly ? (
                      assignee ? renderInitialsAvatar(assignee, { statusText: 'Chịu trách nhiệm' }) : (
                        <span className="text-slate-500 italic block text-[11px] pt-1">Chưa có Phụ Trách Chính</span>
                      )
                    ) : (
                      <div className={`flex items-center gap-2 max-w-full overflow-hidden ${
                        (selectedTask.status === 'completed' || !canEditTask) ? 'opacity-65' : ''
                      }`}>
                        {assignee && renderInitialsAvatar(assignee, { showNameLabel: false })}
                        <select
                          disabled={selectedTask.status === 'completed' || !canEditTask}
                          value={selectedTask.assigneeId || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            const empName = employees.find(emp => emp.id === val)?.name || 'Chưa gán';
                            onUpdateTask(selectedTask.id, {
                              assigneeId: val
                            });
                            // 📣 Gửi thông báo vào NHÓM CHAT DỰ ÁN (hàm sendGroupChatMessage)
                            notifyProjectChat(`👤 ${currentUser.name} đã chuyển Phụ Trách Chính công việc "${selectedTask.name}" sang ${empName}.`);
                          }}
                          className={`bg-transparent text-slate-205 text-[11px] outline-none font-bold flex-1 max-w-[110px] ${
                            (selectedTask.status === 'completed' || !canEditTask) ? 'cursor-not-allowed text-slate-400' : 'cursor-pointer'
                          }`}
                        >
                          {employees.map(emp => (
                            <option key={emp.id} value={emp.id} className="bg-slate-950 text-slate-100">{emp.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>

            {/* Thẻ Thầu Phụ Liên Kết */}
            {selectedTask.isSubcontractorEnabled && (
              <div className="bg-slate-950 border border-slate-850 p-4.5 rounded-2xl space-y-4 shadow-xl">
                <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                  <span className="block text-slate-200 font-extrabold text-[11.5px] uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-orange-400" />
                    🤝 THẦU PHỤ LIÊN KẾT CHÍNH THỨC
                  </span>
                  {!canAssignMembers && (
                    <span className="text-[9.5px] bg-rose-950/40 text-rose-300 font-bold px-2.2 py-0.5 rounded border border-rose-900/30 flex items-center gap-1">
                      (🔒)
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  {/* Subcontractor selection */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-455 text-[9.5px] font-bold uppercase tracking-wider">Chọn thầu phụ</label>
                    <select
                      disabled={!canAssignMembers}
                      value={selectedTask.subcontractorId || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const suppliersList = (() => {
                          const saved = localStorage.getItem('hl_acc_suppliers');
                          if (saved) {
                            try {
                              return JSON.parse(saved);
                            } catch(e) {
                              console.error(e);
                            }
                          }
                          return [];
                        })();
                        const matchedSup = suppliersList.find((s: any) => s.id === val);
                        const matchedName = matchedSup ? matchedSup.name : '';

                        onUpdateTask(selectedTask.id, {
                          subcontractorId: val,
                          subcontractorName: matchedName
                        });
                      }}
                      className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg p-2.5 w-full focus:outline-none focus:border-orange-500 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <option value="">-- Click để chọn Thầu Phụ --</option>
                      {(() => {
                        const saved = localStorage.getItem('hl_acc_suppliers');
                        let list = [];
                        if (saved) {
                          try { list = JSON.parse(saved); } catch(e) {}
                        }
                        return list.map((s: any) => (
                          <option key={s.id} value={s.id}>
                            [{s.id}] {s.name}
                          </option>
                        ));
                      })()}
                    </select>
                  </div>

                  {/* Detailed specs */}
                  {(() => {
                    if (!selectedTask.subcontractorId) return (
                      <div className="bg-slate-900/40 p-4 rounded-xl border border-dashed border-slate-800 text-center text-slate-500 text-xs font-mono">
                        Chưa có thầu phụ liên kết cho hạng mục công việc này.
                      </div>
                    );
                    const saved = localStorage.getItem('hl_acc_suppliers');
                    let list = [];
                    if (saved) {
                      try { list = JSON.parse(saved); } catch(e) {}
                    }
                    const activeSup = list.find((s: any) => s.id === selectedTask.subcontractorId);
                    if (!activeSup) return null;

                    return (
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3.5 text-xs font-mono">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-slate-300">
                          <div>
                            <span className="text-slate-500 block text-[9px] uppercase tracking-wider">Tên Thầu Phụ</span>
                            <strong className="text-orange-400 text-[13px]">{activeSup.name}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px] uppercase tracking-wider">Mã Thầu Phụ</span>
                            <span className="bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded font-bold text-[11px] inline-block">{activeSup.id}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px] uppercase tracking-wider">Người đại diện pháp nhân</span>
                            <span className="text-slate-200 text-[11px] font-bold">{activeSup.representative}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px] uppercase tracking-wider">Số điện thoại liên hệ</span>
                            <a href={`tel:${activeSup.phone}`} className="text-teal-400 hover:underline text-[11px] font-bold">{activeSup.phone}</a>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px] uppercase tracking-wider">Lĩnh vực hoạt động </span>
                            <span className="text-slate-200 text-[11px]">{activeSup.field}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px] uppercase tracking-wider">Mã số thuế / CCCD</span>
                            <span className="text-slate-200 text-[11px]">{activeSup.taxCode || 'Chưa cung cấp'}</span>
                          </div>
                          <div className="sm:col-span-2">
                            <span className="text-slate-500 block text-[9px] uppercase tracking-wider">Địa chỉ </span>
                            <span className="text-slate-200 text-[11px]">{activeSup.address || activeSup.region}</span>
                          </div>
                          <div className="sm:col-span-2">
                            <span className="text-slate-500 block text-[9px] uppercase tracking-wider">Tài khoản ngân hàng giải ngân</span>
                            <span className="bg-teal-950/20 text-teal-400 px-2.5 py-1 rounded border border-teal-900/30 font-bold text-[12px] inline-block">{activeSup.bankAccount || 'Chưa cập nhật'}</span>
                          </div>
                          {activeSup.note && (
                            <div className="sm:col-span-2">
                              <span className="text-slate-500 block text-[9px] uppercase tracking-wider">Ghi chú nghiệp vụ thợ thầu</span>
                              <p className="text-slate-455 italic text-[11px] leading-relaxed">{activeSup.note}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* 📋 CHỨC NĂNG QUẢN LÝ NHIỆM VỤ CON TRONG CÔNG VIỆC */}
            <div className="bg-slate-950 border border-slate-850 p-4.5 rounded-2xl space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                <span className="font-extrabold text-[11px] text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-amber-400" />
                  NHIỆM VỤ CHI TIẾT ({selectedTask.missions?.length || 0})
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleExportMissionsExcel}
                    title="Xuất Excel danh sách nhiệm vụ chi tiết"
                    className="flex items-center gap-1 bg-emerald-600/90 hover:bg-emerald-500 text-white text-[9.5px] font-bold px-2 py-1 rounded-lg cursor-pointer transition-colors"
                  >
                    <Download className="w-3 h-3" /> Export
                  </button>
                  <button
                    type="button"
                    onClick={() => missionExcelInputRef.current?.click()}
                    title="Nhập Excel danh sách nhiệm vụ chi tiết"
                    className="flex items-center gap-1 bg-indigo-600/90 hover:bg-indigo-500 text-white text-[9.5px] font-bold px-2 py-1 rounded-lg cursor-pointer transition-colors"
                  >
                    <Upload className="w-3 h-3" /> Import
                  </button>
                  <input
                    ref={missionExcelInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleImportMissionsExcel}
                    className="hidden"
                  />
                </div>
              </div>

              {(canAssignMembers || canAssignSubWorkers || canManageSubTask) && selectedTask.status !== 'completed' && (
                <div className="bg-slate-900/40 border border-slate-850/50 p-3.5 rounded-xl space-y-3.5">
                  <div className="flex justify-between items-center pb-1">
                    <span className="text-[10px] font-extrabold uppercase text-amber-400 block tracking-wide">
                      ⚡ Tạo nhiệm vụ
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    {/* Tên nhiệm vụ */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Tên nhiệm vụ:</label>
                      <input 
                        type="text"
                        value={newMissionName}
                        onChange={(e) => setNewMissionName(e.target.value)}
                        placeholder="VD: Kiểm tra mộng tủ dưới bếp, Cắt CNC hồi tủ áo..."
                        className="w-full bg-slate-950 text-slate-205 border border-slate-850 focus:border-amber-400/40 rounded-xl px-3 py-2.5 text-[11.5px] font-mono outline-none mt-1 shadow-inner placeholder:text-slate-650"
                      />
                    </div>

                    {/* Hạn hoàn thành */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider flex justify-between">
                        <span>Hạn hoàn thành:</span>
                        {selectedTask.deadline && (
                          <span className="text-zinc-500 font-sans normal-case">
                            (Hạn bàn giao: {formatDateTime(selectedTask.deadline)})
                          </span>
                        )}
                      </label>
                      <input 
                        type="datetime-local"
                        value={newMissionDeadline}
                        onChange={(e) => setNewMissionDeadline(e.target.value)}
                        className="w-full bg-slate-950 text-slate-205 border border-slate-850 focus:border-amber-400/40 rounded-xl px-3 py-2.5 text-[11.5px] font-mono outline-none mt-1 shadow-inner cursor-pointer"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!newMissionName.trim()) return;

                      const finalDeadline = newMissionDeadline
                        ? new Date(newMissionDeadline).toISOString()
                        : (selectedTask.deadline || new Date().toISOString());

                      if (selectedTask.deadline) {
                        const mDeadlineDate = new Date(finalDeadline);
                        const tDeadlineDate = new Date(selectedTask.deadline);
                        // Chỉ so sánh DATE (bỏ qua giờ): task deadline được coi là 23:59:59 của ngày đó
                        const taskEndOfDay = new Date(tDeadlineDate);
                        taskEndOfDay.setHours(23, 59, 59, 999);
                        if (mDeadlineDate.getTime() > taskEndOfDay.getTime() && tDeadlineDate.getTime() > Date.now()) {
                          addToast({
                            title: '⚠️ Không thể tạo nhiệm vụ',
                            message: `Hạn hoàn thành nhiệm vụ (${formatDateTime(finalDeadline)}) không được lớn hơn Hạn bàn giao của công việc cha (${formatDateTime(selectedTask.deadline)})! Vui lòng chọn ngày sớm hơn hoặc cùng ngày.`,
                            type: 'warning'
                          });
                          return;
                        }
                      }

                      const newMission: SubTaskMission = {
                        id: `mission_${Date.now()}`,
                        name: newMissionName.trim(),
                        memberIds: [],
                        status: 'todo',
                        workReports: '',
                        evidence: '',
                        createdAt: new Date().toISOString(),
                        deadline: finalDeadline
                      };
                      const currentMissions = selectedTask.missions || [];

                      onUpdateTask(selectedTask.id, {
                        missions: [...currentMissions, newMission]
                      });
                      // 📣 Gửi thông báo vào NHÓM CHAT DỰ ÁN (hàm sendGroupChatMessage)
                      notifyProjectChat(`📝 ${currentUser.name} đã khởi tạo Nhiệm Vụ "${newMission.name}" cho công việc "${selectedTask.name}".`);

                      // Reset inputs. selectedTask.missions chưa gồm nhiệm vụ vừa tạo
                      // (cập nhật bất đồng bộ qua parent), nên tính hạn mặc định kế tiếp
                      // trực tiếp = ngày của nhiệm vụ vừa tạo + 1 ngày, giờ 18:00.
                      setNewMissionName('');
                      setSelectedMissionMemberIds([]);
                      setNewMissionDeadline(dateAt18(new Date(finalDeadline), 1));
                    }}
                    disabled={!newMissionName.trim()}
                    className={`w-full py-2.5 px-3 rounded-xl font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition ${
                      newMissionName.trim()
                        ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 cursor-pointer shadow-lg shadow-amber-500/15'
                        : 'bg-slate-850 text-slate-550 border border-slate-800 cursor-not-allowed'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    Khởi tạo Nhiệm Vụ
                  </button>
                </div>
              )}

              {/* Mission List */}
              <div className="space-y-2">
                {(!selectedTask.missions || selectedTask.missions.length === 0) ? (
                  <div className="p-5 rounded-xl border border-dashed border-slate-800 text-center text-[11px] text-slate-500 leading-relaxed bg-slate-950/20">
                    Chưa có nhiệm vụ chi tiết nào được thiết lập cho công việc này.
                  </div>
                ) : (() => {
                  // Sắp xếp mới nhất → cũ nhất theo ngày tạo (fallback timestamp trong id)
                  const missionSortKey = (m: SubTaskMission): number => {
                    if (m.createdAt) return new Date(m.createdAt).getTime();
                    const parsed = parseInt(m.id.replace('mission_', ''));
                    return isNaN(parsed) ? 0 : parsed;
                  };
                  const sortedMissions = [...selectedTask.missions].sort((a, b) => missionSortKey(b) - missionSortKey(a));
                  const total = sortedMissions.length;
                  const pageSize = missionPageSize === 'all' ? total : missionPageSize;
                  const totalPages = missionPageSize === 'all' ? 1 : Math.max(1, Math.ceil(total / pageSize));
                  const safePage = Math.min(missionPage, totalPages);
                  const startIdx = missionPageSize === 'all' ? 0 : (safePage - 1) * pageSize;
                  const pagedMissions = missionPageSize === 'all'
                    ? sortedMissions
                    : sortedMissions.slice(startIdx, startIdx + pageSize);

                  return (
                  <>
                  {/* Thanh điều khiển phân trang */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9.5px] text-slate-500 font-bold uppercase tracking-wider">Hiển thị:</span>
                      <select
                        value={String(missionPageSize)}
                        onChange={(e) => {
                          const v = e.target.value;
                          setMissionPageSize(v === 'all' ? 'all' : parseInt(v));
                          setMissionPage(1);
                        }}
                        className="bg-slate-950 text-slate-200 border border-slate-850 focus:border-emerald-500/40 rounded-lg px-2 py-1 text-[10.5px] font-bold outline-none cursor-pointer"
                      >
                        <option value="5">5 dòng</option>
                        <option value="10">10 dòng</option>
                        <option value="20">20 dòng</option>
                        <option value="50">50 dòng</option>
                        <option value="all">Tất cả</option>
                      </select>
                      <span className="text-[9.5px] text-slate-500 font-mono">Tổng {total} nhiệm vụ</span>
                    </div>
                    {missionPageSize !== 'all' && totalPages > 1 && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={safePage <= 1}
                          onClick={() => setMissionPage(p => Math.max(1, p - 1))}
                          className={`px-2 py-1 rounded-lg border text-[10.5px] font-bold transition ${
                            safePage <= 1
                              ? 'bg-slate-900 text-slate-600 border-slate-850 cursor-not-allowed'
                              : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-emerald-500/40 hover:text-emerald-400 cursor-pointer'
                          }`}
                        >
                          ‹ Trước
                        </button>
                        <span className="text-[10px] text-slate-400 font-mono px-1">
                          Trang {safePage}/{totalPages}
                        </span>
                        <button
                          type="button"
                          disabled={safePage >= totalPages}
                          onClick={() => setMissionPage(p => Math.min(totalPages, p + 1))}
                          className={`px-2 py-1 rounded-lg border text-[10.5px] font-bold transition ${
                            safePage >= totalPages
                              ? 'bg-slate-900 text-slate-600 border-slate-850 cursor-not-allowed'
                              : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-emerald-500/40 hover:text-emerald-400 cursor-pointer'
                          }`}
                        >
                          Sau ›
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2.5">
                    {pagedMissions.map((mission) => {
                      const isCompleted = mission.status === 'completed';
                      const creationTime = mission.createdAt 
                        ? formatDateTime(mission.createdAt) 
                        : formatDateTime(new Date(parseInt(mission.id.replace('mission_', '')) || Date.now()).toISOString());
                      const isMissionAssigneeInline = mission.memberIds?.includes(currentUser.id) || false;
                      const isMissionMainAssignee = mission.mainAssigneeId === currentUser.id;
                      const hasMissionPermission = canReceive || canAssignMembers || canManageSubTask || isMissionMainAssignee;

                      return (
                        <div 
                          key={mission.id}
                          onClick={() => {
                            setSelectedMissionId(mission.id);
                            setMissionReportText(mission.workReports || '');
                            setMissionEvidenceText(mission.evidence || '');
                            setMissionReportImages(mission.reportImages && mission.reportImages.length > 0 ? [...mission.reportImages] : []);
                            if (mission.evidence && (mission.evidence.startsWith('data:image/') || mission.evidence.startsWith('blob:') || mission.evidence.startsWith('http'))) {
                              setMissionImagePreview(mission.evidence);
                            } else {
                              setMissionImagePreview(null);
                            }
                            // Initialize travel allowance states
                            setAllowanceMemberId(mission.memberIds?.[0] || '');
                            setAllowanceNormId('');
                            setAllowanceCustomContent('');
                            setAllowanceCustomQty(1);
                            setAllowanceCustomUnitPrice(0);
                            setAllowanceNotes('');
                          }}
                          className={`p-3 rounded-xl border transition-all duration-150 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group ${
                            isCompleted 
                              ? 'bg-emerald-950/15 border-emerald-500/20 text-emerald-300 hover:border-emerald-500/40' 
                              : 'bg-slate-900 border-slate-850 hover:border-slate-750 text-slate-205'
                          }`}
                        >
                          {/* Info area */}
                          <div className="space-y-1 flex-1 min-w-0 pr-2">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${
                                isCompleted ? 'bg-emerald-500 animate-pulse' : mission.status === 'doing' ? 'bg-sky-500' : 'bg-amber-500'
                              }`} />
                              <h5 className={`text-[11.5px] font-bold truncate text-left ${isCompleted ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                                {mission.name}
                              </h5>
                            </div>
                            
                            <div className="flex flex-col gap-y-1">
                              <div className="flex items-center gap-1.5 text-[9.5px] text-slate-400 font-mono">
                                <Clock className="w-3 h-3 text-slate-550 shrink-0" />
                                <span>Ngày tạo: <b className="text-slate-300 font-semibold">{creationTime}</b></span>
                              </div>
                              
                              {(() => {
                                const mDeadline = mission.deadline || selectedTask.deadline;
                                if (!mDeadline) return null;
                                const isOverdue = new Date(mDeadline).getTime() < Date.now();
                                return (
                                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[9.5px] text-slate-400 font-mono">
                                    <div className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3 text-rose-500 shrink-0" />
                                      <span>Hạn hoàn thành: <b className="text-rose-400 font-semibold">{formatDateTime(mDeadline)}</b></span>
                                    </div>
                                    {!isCompleted && (
                                      <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-black border uppercase select-none ${
                                        isOverdue
                                          ? 'bg-rose-950/40 text-rose-400 border-rose-900/40 animate-pulse'
                                          : 'bg-emerald-955/35 text-emerald-400 border-emerald-900/30'
                                      }`}>
                                        {getRemainingDaysText(mDeadline)}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Quick Tagging and Members at the end */}
                          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-x-4 gap-y-2 shrink-0">
                            {/* Phụ trách chính */}
                            <div className="flex items-center gap-2">
                              <span className="text-[8.5px] text-slate-500 font-mono uppercase tracking-wider select-none font-bold">PHỤ TRÁCH CHÍNH:</span>
                              
                              {mission.mainAssigneeId ? (() => {
                                const emp = employees.find(e => e.id === mission.mainAssigneeId);
                                if (!emp) return null;
                                const parts = emp.name.split(' ');
                                const initials = parts.length >= 2
                                  ? `${parts[parts.length - 2][0]}${parts[parts.length - 1][0]}`.toUpperCase()
                                  : (parts[0] ? parts[0].substring(0, 2).toUpperCase() : '??');
                                
                                return (
                                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                    <div 
                                      className="group/avatar relative shrink-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!(canReceive || canAssignMembers) || selectedTask.status === 'completed' || isCompleted) return;
                                        const updatedMissions = (selectedTask.missions || []).map(m => {
                                          if (m.id === mission.id) {
                                            return { ...m, mainAssigneeId: undefined };
                                          }
                                          return m;
                                        });
                                        onUpdateTask(selectedTask.id, { missions: updatedMissions });
                                        // 📣 Gửi thông báo vào NHÓM CHAT DỰ ÁN (hàm sendGroupChatMessage)
                                        notifyProjectChat(`🔓 ${currentUser.name} đã bỏ Phụ Trách Chính Nhiệm Vụ "${mission.name}".`);
                                      }}
                                    >
                                      <div
                                        className={`w-6.5 h-6.5 rounded-full bg-gradient-to-br from-amber-500 via-orange-500 to-yellow-550 flex items-center justify-center font-black text-slate-950 text-[8px] shadow-sm border border-slate-905 select-none relative ${
                                          (canReceive || canAssignMembers) && selectedTask.status !== 'completed' && !isCompleted
                                            ? 'hover:scale-105 transition cursor-pointer'
                                            : 'cursor-default'
                                        }`}
                                        title={(canReceive || canAssignMembers) && selectedTask.status !== 'completed' && !isCompleted ? `Bấm để gỡ ${emp.name}` : emp.name}
                                      >
                                        {initials}
                                        {((canReceive || canAssignMembers) && selectedTask.status !== 'completed' && !isCompleted) && (
                                          <div className="absolute inset-0 bg-red-650/90 rounded-full flex items-center justify-center text-white font-extrabold text-[8px] opacity-0 hover:opacity-100 transition-opacity">
                                            ✕
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <span 
                                      className="text-[10px] text-amber-200 font-extrabold whitespace-nowrap overflow-hidden text-ellipsis max-w-[85px]" 
                                      title={emp.name}
                                    >
                                      {emp.name}
                                    </span>
                                  </div>
                                );
                              })() : (
                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                  <span className="text-[9px] text-slate-550 italic select-none">Chưa gán</span>
                                  {/* Plus button to add member inline */}
                                  {(canReceive || canAssignMembers) && selectedTask.status !== 'completed' && !isCompleted && (
                                    <div className="relative shrink-0">
                                      <button className="w-5.5 h-5.5 rounded-full bg-slate-900 border border-slate-800 hover:border-emerald-500 flex items-center justify-center text-slate-450 hover:text-emerald-400 transition cursor-pointer shadow">
                                        <Plus className="w-2.5 h-2.5" />
                                      </button>
                                      <select
                                        value=""
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          if (!val) return;
                                          const updatedMissions = (selectedTask.missions || []).map(m => {
                                            if (m.id === mission.id) {
                                              return { ...m, mainAssigneeId: val };
                                            }
                                            return m;
                                          });
                                          onUpdateTask(selectedTask.id, { missions: updatedMissions });
                                          // 📣 Gửi thông báo vào NHÓM CHAT DỰ ÁN (hàm sendGroupChatMessage)
                                          const _newAssignee = employees.find(emp => emp.id === val)?.name || 'Người dùng';
                                          notifyProjectChat(`👤 ${currentUser.name} đã gán ${_newAssignee} làm Phụ Trách Chính Nhiệm Vụ "${mission.name}".`);
                                        }}
                                        className="absolute inset-0 opacity-0 cursor-pointer w-5.5 h-5.5 rounded-full"
                                      >
                                        <option value="">Chọn phụ trách chính...</option>
                                        {employees.map(emp => (
                                          <option key={emp.id} value={emp.id} className="bg-slate-950 text-slate-100">
                                            {emp.name} ({emp.department || emp.role})
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Divider line if both are here */}
                            <div className="hidden sm:block w-px h-4 bg-slate-800 opacity-60" />

                            {/* Người thực hiện (nhân sự tham gia) */}
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <span className="text-[8.5px] text-slate-500 font-mono uppercase tracking-wider select-none font-bold">NHÂN SỰ:</span>
                              <div className="flex items-center -space-x-1.5 overflow-hidden">
                                {mission.memberIds && mission.memberIds.map(memId => {
                                  const emp = employees.find(e => e.id === memId);
                                  if (!emp) return null;
                                  const parts = emp.name.split(' ');
                                  const initials = parts.length >= 2
                                    ? `${parts[parts.length - 2][0]}${parts[parts.length - 1][0]}`.toUpperCase()
                                    : (parts[0] ? parts[0].substring(0, 2).toUpperCase() : '??');
                                  
                                  return (
                                    <div 
                                      key={memId} 
                                      className="group/mem relative shrink-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!(canReceive || canAssignMembers || isMissionMainAssignee) || selectedTask.status === 'completed' || isCompleted) return;
                                        const updatedMissions = (selectedTask.missions || []).map(m => {
                                          if (m.id === mission.id) {
                                            return { ...m, memberIds: (m.memberIds || []).filter(id => id !== memId) };
                                          }
                                          return m;
                                        });
                                        onUpdateTask(selectedTask.id, { missions: updatedMissions });
                                        // 📣 Gửi thông báo vào NHÓM CHAT DỰ ÁN (hàm sendGroupChatMessage)
                                        const _removed = employees.find(emp => emp.id === memId)?.name || 'Thành viên';
                                        notifyProjectChat(`➖ ${currentUser.name} đã xóa ${_removed} khỏi Nhiệm Vụ "${mission.name}".`);
                                      }}
                                    >
                                      <div
                                        className={`w-6 h-6 rounded-full bg-slate-850 border border-slate-900 flex items-center justify-center font-bold text-slate-300 text-[8px] select-none relative ${
                                          (canReceive || canAssignMembers || isMissionMainAssignee) && selectedTask.status !== 'completed' && !isCompleted
                                            ? 'hover:scale-105 hover:border-red-500 transition cursor-pointer'
                                            : 'cursor-default'
                                        }`}
                                        title={(canReceive || canAssignMembers || isMissionMainAssignee) && selectedTask.status !== 'completed' && !isCompleted ? `Bấm để gỡ ${emp.name}` : emp.name}
                                      >
                                        {initials}
                                        {((canReceive || canAssignMembers || isMissionMainAssignee) && selectedTask.status !== 'completed' && !isCompleted) && (
                                          <div className="absolute inset-0 bg-red-650/95 rounded-full flex items-center justify-center text-white font-extrabold text-[8px] opacity-0 hover:opacity-100 transition-opacity">
                                            ✕
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                                {(!mission.memberIds || mission.memberIds.length === 0) && (
                                  <span className="text-[9px] text-slate-550 italic pr-1 select-none">Chưa gán</span>
                                )}
                              </div>
                              
                              {/* Option to add helper inline */}
                              {(canReceive || canAssignMembers || isMissionMainAssignee) && selectedTask.status !== 'completed' && !isCompleted && (
                                <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                                  <button className="w-5.5 h-5.5 rounded-full bg-slate-900 border border-slate-800 hover:border-emerald-500 flex items-center justify-center text-slate-450 hover:text-emerald-400 transition cursor-pointer shadow">
                                    <Plus className="w-2.5 h-2.5" />
                                  </button>
                                  <select
                                    value=""
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (!val) return;
                                      const updatedMissions = (selectedTask.missions || []).map(m => {
                                        if (m.id === mission.id) {
                                          return { ...m, memberIds: [...(m.memberIds || []).filter(id => id !== val), val] };
                                        }
                                        return m;
                                      });
                                      onUpdateTask(selectedTask.id, { missions: updatedMissions });
                                      // 📣 Gửi thông báo vào NHÓM CHAT DỰ ÁN (hàm sendGroupChatMessage)
                                      const _added = employees.find(emp => emp.id === val)?.name || 'Thành viên';
                                      notifyProjectChat(`➕ ${currentUser.name} đã thêm ${_added} vào Nhiệm Vụ "${mission.name}".`);
                                    }}
                                    className="absolute inset-0 opacity-0 cursor-pointer w-5.5 h-5.5 rounded-full"
                                  >
                                    <option value="">Chọn nhân sự...</option>
                                    {employees
                                      .filter(emp => !(mission.memberIds || []).includes(emp.id))
                                      .map(emp => (
                                        <option key={emp.id} value={emp.id} className="bg-slate-950 text-slate-100">
                                          {emp.name} ({emp.department || emp.role})
                                        </option>
                                      ))}
                                  </select>
                                </div>
                              )}
                            </div>

                            {/* Status and Arrow */}
                            <div className="flex items-center gap-2">
                              {!isCompleted && hasMissionPermission && selectedTask.status !== 'completed' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm(`Bạn thật sự muốn xóa nhiệm vụ "${mission.name}" này?`)) {
                                      const updatedMissions = (selectedTask.missions || []).filter(m => m.id !== mission.id);
                                      onUpdateTask(selectedTask.id, {
                                        missions: updatedMissions
                                      });
                                      // 📣 Gửi thông báo vào NHÓM CHAT DỰ ÁN (hàm sendGroupChatMessage)
                                      notifyProjectChat(`🗑️ ${currentUser.name} đã xóa Nhiệm Vụ "${mission.name}".`);
                                    }
                                  }}
                                  className="p-1 px-1.5 bg-slate-950 hover:bg-rose-950/40 border border-slate-850 hover:border-rose-900 text-slate-500 hover:text-rose-400 rounded-lg transition cursor-pointer flex items-center justify-center shrink-0"
                                  title="Xóa nhiệm vụ này"
                                >
                                  <Trash2 className="w-3 h-3 text-rose-400" />
                                </button>
                              )}
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded border whitespace-nowrap leading-none select-none ${
                                isCompleted
                                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-900/30'
                                  : mission.status === 'doing'
                                    ? 'bg-sky-950/40 text-sky-300 border-sky-900/30'
                                    : 'bg-slate-900/40 text-slate-400 border-slate-850'
                              }`}>
                                {isCompleted ? 'Hoàn thành' : mission.status === 'doing' ? 'Đang làm' : 'Chưa làm'}
                              </span>
                              <ArrowRight className="w-3.5 h-3.5 text-slate-550 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  </>
                  );
                })()}
              </div>
            </div>

            {/* 🚨 GHI NHẬN VI PHẠM KỶ LUẬT & HIỆU SUẤT CÔNG VIỆC */}
            {canRecordViolation && (
              <div className="bg-slate-950 border border-slate-850 p-4.5 rounded-2xl space-y-4 shadow-xl mb-4" id="ghi_nhan_vi_pham_card">
                <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                  <span className="font-extrabold text-[11px] text-rose-500 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse" />
                    GHI NHẬN VI PHẠM KỶ LUẬT & HIỆU SUẤT
                  </span>
                </div>

                <div className="space-y-4 pt-1">
                  {violationRows.map((row, index) => {
                    const criterion = allCriteria.find(c => c.id === row.selectedCriterionId);
                    
                    const filteredCriteria = allCriteria.filter(crit => {
                      if (!row.searchQuery) return true;
                      const queryNorm = removeVietnameseTones(row.searchQuery);
                      const critNorm = removeVietnameseTones(crit.content);
                      return critNorm.includes(queryNorm);
                    });

                    return (
                      <div key={row.id} className="relative p-4 border border-slate-900 rounded-xl bg-slate-950/40 space-y-3">
                        {/* Header Area */}
                        <div className="flex justify-between items-center">
                          {violationRows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                setViolationRows(prev => prev.filter(r => r.id !== row.id));
                              }}
                              className="p-1 px-2 border border-slate-850 hover:border-rose-900 bg-slate-950 hover:bg-rose-955/30 text-slate-400 hover:text-rose-400 rounded-lg transition cursor-pointer text-[10px]"
                            >
                              ✕ Xóa dòng
                            </button>
                          )}
                        </div>

                        {/* Search select criterion */}
                        <div className="space-y-1.5 relative">
                          <label className="block text-[10px] text-slate-450 font-bold uppercase tracking-wider">
                            1. Tìm kiếm lỗi / tiêu chí vi phạm:
                          </label>
                          <div ref={searchContainerRef} className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-850 relative">
                            <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <input
                              type="text"
                              value={row.searchQuery}
                              placeholder="Nhập từ khóa tìm kiếm (vd: đi muộn, đồng phục, hút thuốc...)"
                              onFocus={() => {
                                setViolationRows(prev => prev.map(r => r.id === row.id ? { ...r, isSearchOpen: true } : r));
                              }}
                              onChange={(e) => {
                                const val = e.target.value;
                                setViolationRows(prev => prev.map(r => r.id === row.id ? {
                                  ...r,
                                  searchQuery: val,
                                  selectedCriterionId: '',
                                  isSearchOpen: true
                                } : r));
                              }}
                              className="w-full bg-transparent border-none text-slate-200 text-[11.5px] outline-none placeholder:text-slate-650"
                            />
                            {row.searchQuery && (
                              <button
                                type="button"
                                onClick={() => {
                                  setViolationRows(prev => prev.map(r => r.id === row.id ? { 
                                    ...r, 
                                    searchQuery: '', 
                                    selectedCriterionId: '',
                                    isSearchOpen: false 
                                  } : r));
                                }}
                                className="text-slate-500 hover:text-slate-350 text-xs px-1 select-none cursor-pointer"
                              >
                                ✕
                              </button>
                            )}
                          </div>

                          {/* Suggestions block */}
                          {row.isSearchOpen && filteredCriteria.length > 0 && (
                            <div className="absolute z-55 left-0 right-0 mt-1 max-h-60 overflow-y-auto overscroll-contain bg-slate-950 border border-slate-850 rounded-xl shadow-2xl p-1">
                              {filteredCriteria.map(crit => {
                                let catText = 'Tác phong';
                                let catColor = 'text-purple-400 bg-purple-950/40 border-purple-900/30';
                                if (crit.category === 'progress') {
                                  catText = 'Hiệu suất';
                                  catColor = 'text-amber-400 bg-amber-955/40 border-amber-900/30';
                                } else if (crit.category === 'reporting') {
                                  catText = 'Báo cáo';
                                  catColor = 'text-pink-450 bg-pink-955/40 border-pink-900/30';
                                }

                                return (
                                  <button
                                    key={crit.id}
                                    type="button"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      setViolationRows(prev => prev.map(r => r.id === row.id ? {
                                        ...r,
                                        selectedCriterionId: crit.id,
                                        searchQuery: crit.content,
                                        isSearchOpen: false
                                      } : r));
                                    }}
                                    className="w-full text-left p-2 hover:bg-slate-900 text-[11px] text-slate-250 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                                  >
                                    <span className="truncate">{crit.content}</span>
                                    <span className={`px-1.5 rounded text-[8px] border font-bold whitespace-nowrap ${catColor}`}>
                                      {catText}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {row.isSearchOpen && filteredCriteria.length === 0 && (
                            <div className="absolute z-55 left-0 right-0 mt-1 bg-slate-950 border border-slate-850 rounded-xl p-3 text-center text-[10.5px] text-slate-500 shadow-2xl">
                              Không tìm thấy lỗi vi phạm nào phù hợp.
                            </div>
                          )}

                          {criterion && (
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <span className="text-[10px] text-slate-500">Tiêu chí:</span>
                              <span className="text-[11px] text-slate-200 font-extrabold">"{criterion.content}"</span>
                              <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold border ${
                                criterion.category === 'progress' ? 'text-amber-400 bg-amber-955/40 border-amber-900/40' :
                                criterion.category === 'reporting' ? 'text-pink-400 bg-pink-955/40 border-pink-900/40' :
                                'text-purple-400 bg-purple-955/40 border-purple-900/40'
                              }`}>
                                {criterion.category === 'progress' ? 'Hiệu suất / Tiến độ' : criterion.category === 'reporting' ? 'Báo cáo / Thái độ' : 'Tác phong 5S'}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="space-y-1.5 relative">
                          <label className="block text-[10px] text-slate-450 font-bold uppercase tracking-wider">
                            2. Thêm nhân sự vi phạm (Có thể chọn nhiều):
                          </label>

                          <div className="flex items-center gap-1.5 flex-wrap bg-slate-950 p-2 rounded-xl border border-slate-850">
                            {row.taggedEmployeeIds.length === 0 ? (
                              <span className="text-slate-500 text-[10.5px] italic px-1 select-none">Chưa gán ai (Bấm [+] để chọn)</span>
                            ) : (
                              row.taggedEmployeeIds.map(empId => {
                                const emp = employees.find(e => e.id === empId);
                                if (!emp) return null;
                                return (
                                  <div 
                                    key={empId} 
                                    className="flex items-center gap-1.5 bg-slate-900/85 text-white border border-slate-800 px-2 py-1 rounded-xl text-[10px] font-bold"
                                  >
                                    <div className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center font-extrabold text-[8px] uppercase text-emerald-400 border border-emerald-900/20 select-none">
                                      {emp.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <span>{emp.name}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setViolationRows(prev => prev.map(r => r.id === row.id ? {
                                          ...r,
                                          taggedEmployeeIds: r.taggedEmployeeIds.filter(id => id !== empId)
                                        } : r));
                                      }}
                                      className="text-slate-400 hover:text-rose-450 ml-0.5 text-[9.5px] cursor-pointer font-extrabold"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                );
                              })
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setViolationRows(prev => prev.map(r => r.id === row.id ? { ...r, isTagOpen: !r.isTagOpen } : r));
                              }}
                              className="w-5.5 h-5.5 bg-indigo-950 hover:bg-indigo-900 text-indigo-400 rounded-full flex items-center justify-center border border-indigo-900/40 text-[11px] font-black transition-all shrink-0 cursor-pointer active:scale-90 align-middle"
                              title="Thêm người vi phạm"
                            >
                              +
                            </button>
                          </div>

                          {/* Tag selector popup list */}
                          {row.isTagOpen && (
                            <div className="absolute z-55 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-slate-950 border border-slate-805 rounded-xl shadow-2xl p-2.5 space-y-3">
                              {relatedEmployees.length > 0 && (
                                <div className="space-y-1 bg-slate-900/20 p-1.5 rounded-lg border border-slate-900">
                                  <span className="block text-[8.5px] text-zinc-400 font-extrabold uppercase tracking-widest mb-1.5">👥 NHÂN SỰ LIÊN QUAN TRONG CÔNG VIỆC:</span>
                                  <div className="grid grid-cols-2 gap-1.5">
                                    {relatedEmployees.map(emp => {
                                      const isSelected = row.taggedEmployeeIds.includes(emp.id);
                                      return (
                                        <button
                                          key={emp.id}
                                          type="button"
                                          onClick={() => {
                                            const updated = isSelected 
                                              ? row.taggedEmployeeIds.filter(id => id !== emp.id)
                                              : [...row.taggedEmployeeIds, emp.id];
                                            setViolationRows(prev => prev.map(r => r.id === row.id ? { ...r, taggedEmployeeIds: updated } : r));
                                          }}
                                          className={`flex items-center gap-1.5 p-1 px-2 rounded-lg border text-left text-[10.5px] font-bold transition-all truncate cursor-pointer ${
                                            isSelected 
                                              ? 'bg-indigo-955 border-indigo-600 text-indigo-350 shadow-sm' 
                                              : 'bg-slate-950 border-slate-850 text-slate-400 hover:bg-slate-900 hover:text-white'
                                          }`}
                                        >
                                          <div className="w-3.5 h-3.5 shrink-0 rounded-full bg-slate-800 flex items-center justify-center text-[7.5px] font-extrabold text-slate-350 select-none">
                                            {emp.name.substring(0, 2).toUpperCase()}
                                          </div>
                                          <span className="truncate">{emp.name}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              <div className="space-y-1">
                                <span className="block text-[8.5px] text-zinc-400 font-extrabold uppercase tracking-widest mb-1.5">LỰA CHỌN NHÂN SỰ KHÁC:</span>
                                <div className="grid grid-cols-2 gap-1.5">
                                  {employees.filter(emp => !relatedEmployees.some(r => r.id === emp.id)).map(emp => {
                                    const isSelected = row.taggedEmployeeIds.includes(emp.id);
                                    return (
                                      <button
                                        key={emp.id}
                                        type="button"
                                        onClick={() => {
                                          const updated = isSelected 
                                            ? row.taggedEmployeeIds.filter(id => id !== emp.id)
                                            : [...row.taggedEmployeeIds, emp.id];
                                          setViolationRows(prev => prev.map(r => r.id === row.id ? { ...r, taggedEmployeeIds: updated } : r));
                                        }}
                                        className={`flex items-center gap-1.5 p-1 px-2 rounded-lg border text-left text-[10.5px] font-bold transition-all truncate cursor-pointer ${
                                          isSelected 
                                            ? 'bg-indigo-955 border-indigo-600 text-indigo-350 shadow-sm' 
                                            : 'bg-slate-950 border-slate-850 text-slate-400 hover:bg-slate-900 hover:text-white'
                                        }`}
                                      >
                                        <div className="w-3.5 h-3.5 shrink-0 rounded-full bg-slate-800 flex items-center justify-center text-[7.5px] font-extrabold text-zinc-350 select-none">
                                          {emp.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <span className="truncate">{emp.name}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}

                          {row.isTagOpen && (
                            <div 
                              className="fixed inset-0 z-40 bg-transparent" 
                              onClick={() => setViolationRows(prev => prev.map(r => r.id === row.id ? { ...r, isTagOpen: false } : r))}
                            />
                          )}
                        </div>

                        {/* Violation note */}
                        <div className="space-y-1.5">
                          <label className="block text-[10px] text-slate-450 font-bold uppercase tracking-wider">
                            3. Ghi chú vi phạm cụ thể:
                          </label>
                          <textarea
                            value={row.notes}
                            onChange={(e) => {
                              const val = e.target.value;
                              setViolationRows(prev => prev.map(r => r.id === row.id ? { ...r, notes: val } : r));
                            }}
                            placeholder="Nhập ghi chú chi tiết về lỗi vi phạm..."
                            rows={2}
                            className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-slate-200 text-[11px] placeholder:text-slate-650 outline-none resize-none focus:border-slate-705 font-sans"
                          />
                        </div>

                        {/* Minh chứng bằng hình ảnh và cam chụp */}
                        <div className="space-y-1.5">
                          <label className="block text-[10px] text-slate-450 font-bold uppercase tracking-wider flex justify-between items-center">
                            <span>4. Hình ảnh vi phạm:</span>
                            <span className="text-[9px] text-slate-500 font-normal">Tối đa 5 ảnh</span>
                          </label>

                          {row.images && row.images.length > 0 && (
                            <div className="grid grid-cols-5 gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-900">
                              {row.images.map((img, idx) => (
                                <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-slate-800">
                                  <img src={img} alt="Evidence" className="w-full h-full object-cover" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setViolationRows(prev => prev.map(r => r.id === row.id ? {
                                        ...r,
                                        images: (r.images || []).filter((_, i) => i !== idx)
                                      } : r));
                                    }}
                                    className="absolute -top-1 -right-1 bg-red-650 hover:bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[9px] cursor-pointer font-bold shadow"
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
                                        setViolationRows(prev => prev.map(r => r.id === row.id ? {
                                          ...r,
                                          images: [...(r.images || []), reader.result as string].slice(0, 5)
                                        } : r));
                                      }
                                    };
                                    reader.readAsDataURL(file);
                                  });
                                };
                                input.click();
                              }}
                              className="flex-1 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 text-[10.5px] text-slate-400 font-bold p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <FileUp className="w-3.5 h-3.5 text-slate-500" />
                              Tải ảnh lên
                            </button>

                            <button
                              type="button"
                              onClick={async () => {
                                if (cameraRowId === row.id) {
                                  const video = document.getElementById(`detailVideo_${row.id}`) as HTMLVideoElement;
                                  if (video) {
                                    const canvas = document.createElement('canvas');
                                    canvas.width = video.videoWidth || 640;
                                    canvas.height = video.videoHeight || 480;
                                    const ctx = canvas.getContext('2d');
                                    if (ctx) {
                                      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                                      const dataUrl = canvas.toDataURL('image/jpeg');
                                      setViolationRows(prev => prev.map(r => r.id === row.id ? {
                                        ...r,
                                        images: [...(r.images || []), dataUrl].slice(0, 5)
                                      } : r));
                                    }
                                  }
                                  if (detailCameraStream) {
                                    detailCameraStream.getTracks().forEach(track => track.stop());
                                  }
                                  setDetailCameraStream(null);
                                  setCameraRowId(null);
                                } else {
                                  try {
                                    if (detailCameraStream) {
                                      detailCameraStream.getTracks().forEach(track => track.stop());
                                    }
                                    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                                    setDetailCameraStream(stream);
                                    setCameraRowId(row.id);
                                    setTimeout(() => {
                                      const video = document.getElementById(`detailVideo_${row.id}`) as HTMLVideoElement;
                                      if (video) {
                                        video.srcObject = stream;
                                        video.play().catch(e => console.log(e));
                                      }
                                    }, 150);
                                  } catch (err) {
                                    addToast({ title: '⚠️ Thiếu thông tin', message: 'Không thể tiếp cận camera. vui lòng cấp quyền hoặc tải ảnh lên.', type: 'warning' });
                                  }
                                }
                              }}
                              className={`flex-1 text-[10.5px] font-bold p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                cameraRowId === row.id
                                  ? 'bg-rose-650 hover:bg-rose-550 border-none text-white animate-pulse'
                                  : 'bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 text-slate-400'
                              }`}
                            >
                              <Camera className="w-3.5 h-3.5" />
                              {cameraRowId === row.id ? "Chụp hình" : "Chụp từ Camera"}
                            </button>
                          </div>

                          {cameraRowId === row.id && (
                            <div className="relative rounded-lg overflow-hidden border border-rose-900/40 bg-black mt-2 aspect-video flex flex-col items-center justify-center">
                              <video id={`detailVideo_${row.id}`} className="w-full h-full object-cover" playsInline muted />
                              <button
                                type="button"
                                onClick={() => {
                                  if (detailCameraStream) {
                                    detailCameraStream.getTracks().forEach(track => track.stop());
                                  }
                                  setDetailCameraStream(null);
                                  setCameraRowId(null);
                                }}
                                className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-black/90 text-white text-[9px] p-1 px-2 rounded border border-slate-850 cursor-pointer font-bold"
                              >
                                ✕ Tắt Camera
                              </button>
                            </div>
                          )}
                        </div>
                                          <div className="flex pt-1">
                    <button
                      type="button"
                      onClick={handleSendViolations}
                      className="w-full bg-rose-650 hover:bg-rose-550 border-none text-white font-black p-2.5 rounded-xl text-[11px] transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-rose-950/20 active:scale-95"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Gửi vi phạm
                    </button>
                  </div>
                      </div>
                    );
                  })}

                  {/* Lịch sử vi phạm liên thông đã gửi */}
                  {submittedViolations.length > 0 && (
                    <div className="mt-4 border-t border-slate-900/40 pt-4 space-y-2.5">
                      <span className="block text-[10px] text-rose-450 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                        Danh sách vi phạm đã gửi ({submittedViolations.length})
                      </span>
                      <div className="max-h-60 overflow-y-auto space-y-2 pr-1" id="submitted_violations_list">
                        {submittedViolations.map((item: any, idx: number) => {
                          let catText = 'Tác phong 5S';
                          let catColor = 'text-purple-400 bg-purple-955/30 border-purple-900/40';
                          if (item.category === 'progress') {
                            catText = 'Hiệu suất / Tiến độ';
                            catColor = 'text-amber-400 bg-amber-955/35 border-amber-900/40';
                          } else if (item.category === 'reporting') {
                            catText = 'Báo cáo / Thái độ';
                            catColor = 'text-pink-400 bg-pink-955/35 border-pink-900/40';
                          }

                          return (
                            <div key={item.id || idx} className="p-3 rounded-xl bg-slate-950 border border-slate-900/80 hover:border-slate-800 transition flex flex-col gap-2">
                              <div className="flex flex-wrap justify-between items-start gap-1.5 font-mono">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] text-slate-100 font-extrabold">{item.employeeName}</span>
                                    <span className="text-[9.5px] text-zinc-550">({item.date})</span>
                                  </div>
                                  <div className="text-[10.5px] text-rose-350 font-bold font-sans">{item.criterionContent}</div>
                                </div>
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black border uppercase shrink-0 ${catColor}`}>
                                  {catText}
                                </span>
                              </div>
                              {item.notes && (
                                <p className="text-[10.5px] text-slate-400 font-normal leading-relaxed pl-2 border-l border-slate-800">
                                  {item.notes}
                                </p>
                              )}
                              {item.images && item.images.length > 0 && (
                                <div className="grid grid-cols-5 gap-1.5 pt-1">
                                  {item.images.map((img: string, imgIdx: number) => (
                                    <div key={imgIdx} className="aspect-square rounded-lg overflow-hidden border border-slate-900 bg-black">
                                      <img src={img} alt="Evidence" className="w-full h-full object-cover cursor-pointer hover:scale-105 transition" referrerPolicy="no-referrer" onClick={() => window.open(img, '_blank')} />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>


        </div>

        {/* Right Area: Sidebar Công cụ liên thông (only if onOpenConnectedTool is passed) */}
        {onOpenConnectedTool && (() => {
          const isCompleted = selectedTask.status === 'completed';
          const isApprovalLocked = selectedTask.isApprovalRequired === true && selectedTask.status === 'reviewing';
          const isApprovalEnabled = selectedTask.isApprovalEnabled !== false && !isApprovalLocked && !isCompleted;
          const isDocGenerationEnabled = selectedTask.isDocGenerationEnabled !== false && !isCompleted;
          const isCostEnabled = selectedTask.isCostEnabled !== false && !isCompleted;
          const isMaterialEnabled = selectedTask.isMaterialEnabled !== false && !isCompleted;

          // Luôn hiển thị panel khi có callback — mỗi nút tự xử lý trạng thái enabled/disabled

          return (
            <div className="w-full lg:w-[360px] bg-slate-950 border-t lg:border-t-0 lg:border-l border-slate-800 p-4 space-y-4 shrink-0 overflow-y-auto flex flex-col justify-between" id="modal_right_pane">
              <div className="space-y-4">
                {(() => {
                  return (
                    <div className="space-y-2" id="connected_tools_menu">
                      <span className="font-black text-[10px] text-slate-450 flex items-center justify-between uppercase tracking-wider border-b border-white/5 pb-1 select-none">
                        <span>Công cụ liên thông</span>
                        <span className="bg-sky-500/10 text-sky-400 text-[8.5px] px-1.5 py-0.5 rounded-md border border-sky-500/20 font-mono tracking-normal normal-case shrink-0">LIÊN THÔNG</span>
                      </span>

                      {selectedTask.status === 'todo' ? (
                        <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-xl text-center space-y-2 py-8">
                          <span className="text-[11px] text-slate-400 font-sans block leading-relaxed">
                            Các công cụ liên thông sẽ khả dụng sau khi công việc được nhận thực hiện (chuyển sang trạng thái Đang làm).
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {selectedTask.isApprovalEnabled !== false ? (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveConnectedTool('approval');
                                setConnectedTaskId(selectedTask.id);
                              }}
                              className={`w-full border p-2.5 rounded-xl flex items-center gap-2 font-bold text-left transition-colors ${
                                isCompleted
                                  ? 'bg-emerald-950/25 border-emerald-500/30 text-emerald-400 cursor-pointer'
                                  : isApprovalLocked
                                    ? 'bg-slate-900 border-slate-800 text-indigo-400 hover:bg-slate-850 cursor-pointer'
                                    : 'bg-slate-900 border-slate-800 hover:bg-slate-850 text-slate-300 hover:text-white cursor-pointer'
                              }`}
                              title="Gửi yêu cầu phê duyệt chuẩn hóa"
                            >
                              {isCompleted ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 font-bold" />
                              ) : (
                                <Shield className={`w-4 h-4 ${isApprovalLocked ? 'text-indigo-455 animate-pulse text-indigo-400' : 'text-sky-400'}`} />
                              )}
                              {isCompleted ? 'Phê duyệt hoàn tất' : (isApprovalLocked ? 'Quản lý phê duyệt' : 'Yêu cầu phê duyệt')}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={true}
                              className="w-full border border-slate-900/50 bg-slate-950/40 text-slate-600 p-2.5 rounded-xl flex items-center gap-2 font-bold text-left opacity-40 cursor-not-allowed"
                              title="Quy trình phê duyệt chưa được bật cho việc con này"
                            >
                              <Shield className="w-4 h-4 text-slate-600" />
                              Yêu cầu phê duyệt (Chưa bật)
                            </button>
                          )}

                          {selectedTask.isCostEnabled !== false ? (
                            <button
                              type="button"
                              onClick={() => {
                                setCtCostType('expense-advance');
                                setActiveConnectedTool('cost');
                                setConnectedTaskId(selectedTask.id);
                              }}
                              className="w-full border border-slate-800 p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white cursor-pointer flex items-center gap-2 font-bold text-left transition-colors"
                              title="Đề xuất chi phí chuẩn hóa"
                            >
                              <DollarSign className="w-4 h-4 text-emerald-400" />
                              Đề xuất chi phí
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={true}
                              className="w-full border border-slate-900/50 bg-slate-950/40 text-slate-600 p-2.5 rounded-xl flex items-center gap-2 font-bold text-left opacity-40 cursor-not-allowed"
                              title="Đề xuất chi phí chưa được bật cho việc con này"
                            >
                              <DollarSign className="w-4 h-4 text-slate-600" />
                              Đề xuất chi phí (Chưa bật)
                            </button>
                          )}

                          {selectedTask.isMaterialEnabled !== false ? (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveConnectedTool('material');
                                setConnectedTaskId(selectedTask.id);
                              }}
                              className="w-full border border-slate-800 p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white cursor-pointer flex items-center gap-2 font-bold text-left transition-colors"
                              title="Đề xuất vật tư chuẩn hóa"
                            >
                              <Zap className="w-4 h-4 text-amber-400" />
                              Đề xuất vật tư
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={true}
                              className="w-full border border-slate-900/50 bg-slate-950/40 text-slate-600 p-2.5 rounded-xl flex items-center gap-2 font-bold text-left opacity-40 cursor-not-allowed"
                              title="Đề xuất vật tư chưa được bật cho việc con này"
                            >
                              <Zap className="w-4 h-4 text-slate-600" />
                              Đề xuất vật tư (Chưa bật)
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {selectedTask.status !== 'todo' && (
                  <>
                    {selectedTask.isDocGenerationEnabled === true && (() => {
                      // Khớp hồ sơ lưu trữ theo dự án: ưu tiên projectId, fallback projectName.
                      // (Không lọc theo _sectorType để tránh loại nhầm hồ sơ đã gắn đúng dự án)
                      const targetProjectId = project?.id || selectedTask?.projectId;
                      const projectArchivedQuotes = archivedQuotesList.filter(q => {
                        if (targetProjectId) return q.projectId === targetProjectId;
                        if (project?.name) return q.projectName === project.name;
                        return false;
                      });
                      const latestArchivedQuote = projectArchivedQuotes.length > 0 ? projectArchivedQuotes[projectArchivedQuotes.length - 1] : null;
                      const hasQuoteFile = latestArchivedQuote;

                      // Status configurations
                      let quoteStatusText = "Chưa Lập";
                      let quoteStatusColor = "bg-white text-slate-500 border-slate-300 shadow-sm";
                      if (hasQuoteFile) {
                        if (latestArchivedQuote.isApproved) {
                          quoteStatusText = "Đã Duyệt";
                          quoteStatusColor = "bg-white text-emerald-600 border-emerald-500/30 shadow-sm";
                        } else {
                          quoteStatusText = "Chờ Duyệt";
                          quoteStatusColor = "bg-white text-amber-600 border-amber-500/30 shadow-sm";
                        }
                      }

                      let contractStatusText = "Chưa Lập";
                      let contractStatusColor = "bg-white text-slate-500 border-slate-300 shadow-sm";
                      if (hasQuoteFile) {
                        // Hồ sơ Hợp Đồng tự sinh từ Báo Giá → mặc định Chờ Duyệt; duyệt riêng → Đã Duyệt
                        if (latestArchivedQuote.contractApproved) {
                          contractStatusText = "Đã Duyệt";
                          contractStatusColor = "bg-white text-emerald-600 border-emerald-500/30 shadow-sm";
                        } else {
                          contractStatusText = "Chờ Duyệt";
                          contractStatusColor = "bg-white text-amber-600 border-amber-500/30 shadow-sm";
                        }
                      }

                      let acceptanceStatusText = "Chưa Lập";
                      let acceptanceStatusColor = "bg-white text-slate-500 border-slate-300 shadow-sm";
                      if (hasQuoteFile) {
                        // Hồ sơ Nghiệm Thu tự sinh từ Báo Giá → mặc định Chờ Duyệt; duyệt riêng → Đã Duyệt
                        if (latestArchivedQuote.acceptanceApproved) {
                          acceptanceStatusText = "Đã Duyệt";
                          acceptanceStatusColor = "bg-white text-emerald-600 border-emerald-500/30 shadow-sm";
                        } else {
                          acceptanceStatusText = "Chờ Duyệt";
                          acceptanceStatusColor = "bg-white text-amber-600 border-amber-500/30 shadow-sm";
                        }
                      }

                      let liquidationStatusText = "Chưa Lập";
                      let liquidationStatusColor = "bg-white text-slate-500 border-slate-300 shadow-sm";
                      if (hasQuoteFile) {
                        // Hồ sơ Thanh Lý tự sinh từ Báo Giá → mặc định Chờ Duyệt; duyệt riêng → Đã Duyệt
                        if (latestArchivedQuote.liquidationApproved) {
                          liquidationStatusText = "Đã Duyệt";
                          liquidationStatusColor = "bg-white text-emerald-600 border-emerald-500/30 shadow-sm";
                        } else {
                          liquidationStatusText = "Chờ Duyệt";
                          liquidationStatusColor = "bg-white text-amber-600 border-amber-500/30 shadow-sm";
                        }
                      }

                      // Điều hướng Menu Hồ Sơ Dự Án sang Lưu Trữ Hồ Sơ theo lĩnh vực (Xây dựng / Nội thất / Cơ khí)
                      const quoteLocked = quoteStatusText === 'Chưa Lập';
                      const goArchive = (docType: 'quote' | 'contract' | 'acceptance' | 'liquidation' = 'quote') => {
                        const targetProjectId = project?.id || selectedTask?.projectId;
                        window.dispatchEvent(new CustomEvent('hl-switch-tab', {
                          detail: {
                            tab: sectorArchiveTab(project?.type),
                            projectId: targetProjectId,
                            customerId: project?.customerId,
                            quotesSubTab: 'archive',
                            docType,
                          },
                        }));
                        onClose();
                      };

                      return (
                        <div className="space-y-2 pt-4 border-t border-slate-900/60" id="project_docs_menu">
                          <span className="font-black text-[10px] text-slate-450 flex items-center justify-between uppercase tracking-wider border-b border-white/5 pb-1 select-none">
                            <span>Menu Hồ Sơ Dự Án</span>
                            <span className="bg-indigo-500/10 text-indigo-400 text-[8.5px] px-1.5 py-0.5 rounded-md border border-indigo-500/20 font-mono tracking-normal normal-case shrink-0">HỒ SƠ</span>
                          </span>

                          <button
                            type="button"
                            onClick={() => goArchive('quote')}
                            className="w-full bg-slate-900 hover:bg-slate-850 border border-slate-800 text-indigo-400 hover:text-indigo-300 p-2.5 rounded-xl flex items-center justify-between font-bold cursor-pointer transition-colors text-left font-sans"
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-indigo-400" />
                              Báo Giá
                            </div>
                            <span className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded border uppercase tracking-wider ${quoteStatusColor}`}>
                              {quoteStatusText}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => goArchive('contract')}
                            disabled={quoteLocked}
                            className={`w-full bg-slate-900 hover:bg-slate-850 border border-slate-800 text-rose-400 hover:text-rose-300 p-2.5 rounded-xl flex items-center justify-between font-bold transition-colors text-left font-sans ${quoteLocked ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}`}
                          >
                            <div className="flex items-center gap-2">
                              <Briefcase className="w-4 h-4 text-rose-400" />
                              Hợp Đồng
                            </div>
                            <span className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded border uppercase tracking-wider ${contractStatusColor}`}>
                              {contractStatusText}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => goArchive('acceptance')}
                            disabled={quoteLocked}
                            className={`w-full bg-slate-900 hover:bg-slate-850 border border-slate-800 text-emerald-400 hover:text-emerald-300 p-2.5 rounded-xl flex items-center justify-between font-bold transition-colors text-left font-sans ${quoteLocked ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}`}
                          >
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              Nghiệm Thu
                            </div>
                            <span className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded border uppercase tracking-wider ${acceptanceStatusColor}`}>
                              {acceptanceStatusText}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => goArchive('liquidation')}
                            disabled={quoteLocked}
                            className={`w-full bg-slate-900 hover:bg-slate-850 border border-slate-800 text-amber-400 hover:text-amber-300 p-2.5 rounded-xl flex items-center justify-between font-bold transition-colors text-left font-sans ${quoteLocked ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}`}
                          >
                            <div className="flex items-center gap-2">
                              <Award className="w-4 h-4 text-amber-400" />
                              Thanh Lý
                            </div>
                            <span className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded border uppercase tracking-wider ${liquidationStatusColor}`}>
                              {liquidationStatusText}
                            </span>
                          </button>
                        </div>
                      );
                    })()}

                    {/* MENU THẦU PHỤ SECTION */}
                    {selectedTask.isSubcontractorEnabled && selectedTask.subcontractorId && (() => {
                      const matchedContract = subcontractorContracts.find(q => q.taskId === selectedTask.id) || 
                                              subcontractorContracts.find(q => q.projectId === selectedTask.projectId && q.subcontractorId === selectedTask.subcontractorId);
                      
                      const statusNormalized = (matchedContract?.status || "").trim().toLowerCase();
                      const isApproved = matchedContract && (
                        statusNormalized === 'hoàn thành' || 
                        matchedContract.isApproved === true
                      );

                      let contractStateText = "Chưa Lập";
                      let contractStateColor = "bg-white text-rose-600 border border-rose-500/30 shadow-sm";

                      if (matchedContract) {
                        if (isApproved) {
                          contractStateText = "Đã Duyệt";
                          contractStateColor = "bg-white text-emerald-600 border border-emerald-500/30 shadow-sm";
                        } else {
                          // Status is "Đã Lập" or others
                          contractStateText = "Chưa Duyệt";
                          contractStateColor = "bg-white text-amber-600 border border-amber-500/30 shadow-sm";
                        }
                      }

                      return (
                        <div className="space-y-2 pt-4 border-t border-slate-900/60" id="subcontractor_tool_menu">
                          <span className="font-black text-[10px] text-slate-450 flex items-center justify-between uppercase tracking-wider border-b border-white/5 pb-1 select-none">
                            <span>🤝 Menu Thầu Phụ</span>
                            <span className="bg-orange-500/10 text-orange-400 text-[8.5px] px-1.5 py-0.5 rounded-md border border-orange-500/20 font-mono tracking-normal normal-case shrink-0">THẦU PHỤ</span>
                          </span>

                          <button
                            type="button"
                            onClick={() => {
                              if (matchedContract) {
                                // Đã có HĐ → set ID để App.tsx redirect tới Lưu Trữ Hồ Sơ Thầu Phụ (Đường 2)
                                localStorage.setItem('hl_view_contract_id', matchedContract.id);
                              } else {
                                // Chưa có HĐ → set task ID để form Lập HĐ tự điền dự án/thầu phụ/công việc
                                localStorage.setItem('hl_preselected_task_id', selectedTask.id);
                              }

                              if (onRedirectToSubcontractor) {
                                onRedirectToSubcontractor(selectedTask.projectId || '', selectedTask.subcontractorId || '', selectedTask.name);
                              }
                              onClose();
                            }}
                            className="w-full bg-orange-600/10 hover:bg-orange-600/20 border border-orange-500/30 text-orange-400 hover:text-orange-300 p-2.5 rounded-xl flex items-center justify-between gap-2 font-bold cursor-pointer transition-colors text-xs text-left"
                          >
                            <div className="flex items-center gap-2">
                              <Briefcase className="w-4 h-4 text-orange-400" />
                              <span>Hợp Đồng Giao Khoán</span>
                            </div>
                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-extrabold ${contractStateColor}`}>
                              {contractStateText}
                            </span>
                          </button>

                          {isApproved && (
                            <button
                              type="button"
                              onClick={() => {
                                setCtCostType('contractor-advance');
                                setActiveConnectedTool('cost');
                                setConnectedTaskId(selectedTask.id);
                              }}
                              className="w-full bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 p-2.5 rounded-xl flex items-center justify-start gap-2 font-bold cursor-pointer transition-colors text-xs text-left"
                            >
                              <DollarSign className="w-4 h-4 text-emerald-400" />
                              <span>Đề Xuất Tạm Ứng</span>
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            </div>
          );
        })()}
      </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-850 shrink-0 flex justify-end items-center gap-3">
          {!isReadOnly && (() => {
            const isAssignee = currentUser.id === selectedTask.assigneeId;
            const isAssigner = currentUser.id === selectedTask.assignerId || isUserInRoleGroup(currentUser.id, 'role_admin') || currentUser.id === project?.pmId;

            if (selectedTask.status === 'todo') {
              if (isAssignee) {
                return (
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateTask(selectedTask.id, {
                        status: 'doing',
                        completionRate: 20
                      });
                      // 📣 Gửi thông báo vào NHÓM CHAT DỰ ÁN (hàm sendGroupChatMessage)
                      notifyProjectChat(`🙋 ${currentUser.name} đã Nhận Việc "${selectedTask.name}".`);
                    }}
                    className="bg-sky-600 hover:bg-sky-500 text-slate-950 font-black px-5 py-2.2 rounded-xl cursor-pointer text-[11px] transition duration-150 flex items-center gap-1 border-none shadow-md"
                  >
                    <Check className="w-4 h-4" />
                    Nhận Việc
                  </button>
                );
              } else {
                return (
                  <span className="text-[10px] text-slate-500 italic bg-slate-900 border border-slate-850 px-3 py-1.5 rounded-lg select-none">
                    🔒 Khóa: Chờ [{assignee?.name || 'Người phụ trách'}] Nhận Việc
                  </span>
                );
              }
            }

            if (selectedTask.status === 'doing') {
              if (isAssignee) {
                if (selectedTask.isApprovalRequired !== true) {
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateTask(selectedTask.id, {
                          status: 'completed',
                          completionRate: 100
                        });
                        // 📣 Gửi thông báo vào NHÓM CHAT DỰ ÁN (hàm sendGroupChatMessage)
                        notifyProjectChat(`🎉 ${currentUser.name} (Phụ Trách Chính) đã HOÀN THÀNH công việc "${selectedTask.name}".`);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black px-5 py-2.2 rounded-xl cursor-pointer text-[11px] transition duration-150 flex items-center gap-1 border-none shadow-md"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Hoàn thành công việc
                    </button>
                  );
                } else {
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        setShowApprovalWarning(true);
                      }}
                      className="bg-rose-600 hover:bg-rose-500 text-white font-black px-5 py-2.2 rounded-xl cursor-pointer text-[11px] transition duration-150 flex items-center gap-1 border-none shadow-md animate-pulse"
                    >
                      <Shield className="w-4 h-4" />
                      Yêu cầu phê duyệt
                    </button>
                  );
                }
              } else {
                return (
                  <span className="text-[10px] text-slate-500 italic bg-slate-900 border border-slate-850 px-3 py-1.5 rounded-lg select-none">
                    ⚙️ Công việc đang giao cho [{assignee?.name || 'Người phụ trách'}] thực hiện
                  </span>
                );
              }
            }

            if (selectedTask.status === 'reviewing') {
              if (isAssigner) {
                return (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateTask(selectedTask.id, {
                          status: 'doing',
                          completionRate: 50
                        });
                        // 📣 Gửi thông báo vào NHÓM CHAT DỰ ÁN (hàm sendGroupChatMessage)
                        notifyProjectChat(`❌ ${currentUser.name} đã TỪ CHỐI duyệt công việc "${selectedTask.name}".`);
                      }}
                      className="bg-rose-600 hover:bg-rose-500 text-white font-black px-4 py-2.2 rounded-xl cursor-pointer text-[11px] transition duration-150 flex items-center gap-1 border-none shadow-sm"
                    >
                      <X className="w-4 h-4" />
                      Từ Chối
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateTask(selectedTask.id, {
                          status: 'completed',
                          completionRate: 100
                        });
                        // 📣 Gửi thông báo vào NHÓM CHAT DỰ ÁN (hàm sendGroupChatMessage)
                        notifyProjectChat(`✅ ${currentUser.name} đã XÉT DUYỆT hoàn thành công việc "${selectedTask.name}".`);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black px-4 py-2.2 rounded-xl cursor-pointer text-[11px] transition duration-150 flex items-center gap-1 border-none shadow-md"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Xét Duyệt
                    </button>
                  </div>
                );
              } else {
                return (
                  <span className="text-[10px] text-amber-400 bg-amber-950/40 border border-amber-900/40 px-3 py-1.5 rounded-lg select-none">
                    ⏳ Đang chờ người giao việc [{assigner?.name || 'Quản lý'}] phê duyệt nghiệm thu
                  </span>
                );
              }
            }

            return null;
          })()}
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-750 text-white font-extrabold px-6 py-2.2 rounded-xl cursor-pointer text-[11px] border border-slate-700/60 transition"
          >
            Đóng bảng tin
          </button>
        </div>

      </div>


      {showApprovalWarning && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999] text-slate-100 font-sans"
          onClick={(e) => {
            e.stopPropagation();
            setShowApprovalWarning(false);
          }}
        >
          <div 
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 text-amber-500">
              <AlertTriangle className="w-6 h-6 animate-bounce" />
              <h3 className="text-base font-extrabold uppercase tracking-wide">Xác nhận Yêu cầu phê duyệt</h3>
            </div>
            
            <div className="space-y-3 text-sm text-slate-300">
              <p className="font-medium text-slate-200">Bạn đang thực hiện gửi yêu cầu phê duyệt cho hạng mục thi công:</p>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-amber-400">
                #{selectedTask.code} - {selectedTask.name}
              </div>

              {/* Chọn người phê duyệt */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-slate-455 text-[10px] uppercase font-bold tracking-wider font-sans">Người phê duyệt</label>
                <select
                  value={customApproverId || ''}
                  onChange={(e) => setCustomApproverId(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 w-full text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-sans cursor-pointer"
                >
                  <option value="">Chọn người phê duyệt...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.role})
                    </option>
                  ))}
                </select>
              </div>

              <ul className="space-y-2 list-disc pl-4 text-xs text-slate-400">
                <li>Trạng thái công việc sẽ tự động chuyển sang <strong className="text-amber-400">Chờ duyệt</strong>.</li>
                <li>Tiến độ hoàn thành dự kiến tự động đặt là <strong className="text-indigo-400">90%</strong>.</li>
                <li>Người chịu trách nhiệm phê duyệt chính: <strong className="text-white">{employees.find(e => e.id === customApproverId)?.name || assigner?.name || 'Người giao việc'}</strong>.</li>
                <li>Nhật ký thi công và Bình luận dự án sẽ tự động thông báo khẩn đến các cấp chỉ huy.</li>
              </ul>
              
              <p className="text-[11px] text-rose-400 italic font-semibold">
                * Lưu ý: Khi đã gửi duyệt, bạn sẽ không thể chỉnh sửa thông tin cho tới khi có kết quả duyệt từ cấp trên.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-800/60">
              <button
                type="button"
                onClick={() => setShowApprovalWarning(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-755 text-slate-300 font-bold rounded-xl cursor-pointer transition text-xs border-none"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmApprovalRequest}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl cursor-pointer shadow-sm transition hover:scale-103 active:scale-97 text-xs border-none"
              >
                Xác nhận & Gửi yêu cầu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔮 CHI TIẾT NHIỆM VỤ POPUP MODAL OVERLAY */}
      {selectedMissionId && (() => {
        const mission = selectedTask.missions?.find(m => m.id === selectedMissionId);
        if (!mission) return null;
        const isMissionCompleted = mission.status === 'completed';
        const isMissionAssignee = mission.memberIds?.includes(currentUser.id) || false;
        const isMissionMainAssignee = mission.mainAssigneeId === currentUser.id;
        const hasMissionPermission = canReceive || canAssignMembers || canManageSubTask || isMissionMainAssignee;

        return (
          <div 
            className="fixed inset-0 z-[120] flex justify-end bg-black/85 backdrop-blur-xs animate-fade-in"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedMissionId(null);
              setMissionAttachedFile(null);
              resetMissionReportState();
            }}
          >
            <div
              className="bg-slate-950 border-l border-slate-850 w-full max-w-md h-full flex flex-col shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-4 border-b border-slate-900 bg-slate-900/50 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-5 h-5 ${isMissionCompleted ? 'text-emerald-400' : 'text-amber-500'}`} />
                  <div>
                    <span className="block text-[9.5px] uppercase font-mono font-extrabold text-slate-500">CHI TIẾT NHIỆM VỤ THI CÔNG</span>
                    <span className="block text-[12.5px] font-extrabold text-white mt-0.5">{mission.name}</span>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => {
                    setSelectedMissionId(null);
                    setMissionAttachedFile(null);
                    resetMissionReportState();
                  }}
                  className="p-1 px-2 rounded-lg bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white border border-slate-800 transition cursor-pointer text-[10.5px] font-bold"
                >
                  ✕ Đóng
                </button>
              </div>

              {/* Scrollable details */}
              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                {/* Phụ trách chính */}
                <div className="space-y-1.5 bg-slate-900/30 p-3 rounded-xl border border-slate-850/50">
                  <span className="block text-slate-450 font-bold text-[9px] uppercase tracking-wider">👑 Phụ trách chính nhiệm vụ:</span>
                  <div className="pt-1">
                    {mission.mainAssigneeId ? (() => {
                      const emp = employees.find(e => e.id === mission.mainAssigneeId);
                      if (!emp) return <span className="text-slate-500 italic text-[10px]">Chưa gán</span>;
                      const parts = emp.name.split(' ');
                      const initials = parts.length >= 2
                        ? `${parts[parts.length - 2][0]}${parts[parts.length - 1][0]}`.toUpperCase()
                        : (parts[0] ? parts[0].substring(0, 2).toUpperCase() : '??');
                      return (
                        <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg w-fit">
                          <div className="w-5.5 h-5.5 rounded-full bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center text-[8px] font-black text-slate-950 shrink-0">
                            {initials}
                          </div>
                          <span className="text-[10px] text-amber-200 font-extrabold">{emp.name} ({emp.role?.toUpperCase() || '—'})</span>
                        </div>
                      );
                    })() : (
                      <span className="text-slate-500 italic text-[10px]">Chưa gán người phụ trách chính</span>
                    )}
                  </div>
                </div>

                {/* Members list */}
                <div className="space-y-1.5 bg-slate-900/30 p-3 rounded-xl border border-slate-850/50">
                  <div className="flex justify-between items-center">
                    <span className="block text-slate-450 font-bold text-[9px] uppercase tracking-wider">👷 Nhân sự tham gia thực hiện:</span>
                    {/* Add member button in popup detail */}
                    {hasMissionPermission && !isMissionCompleted && selectedTask.status !== 'completed' && employees.filter(emp => !(mission.memberIds || []).includes(emp.id)).length > 0 && (
                      <div className="relative shrink-0">
                        <button className="flex items-center gap-1 text-[8.5px] font-bold text-emerald-450 hover:text-emerald-305 transition bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-500/20">
                          <Plus className="w-2 h-2" /> Thêm thợ
                        </button>
                        <select
                          value=""
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!val) return;
                            const updatedMissions = (selectedTask.missions || []).map(m => {
                              if (m.id === mission.id) {
                                return { ...m, memberIds: [...(m.memberIds || []).filter(id => id !== val), val] };
                              }
                              return m;
                            });
                            onUpdateTask(selectedTask.id, { missions: updatedMissions });
                            // 📣 Gửi thông báo vào NHÓM CHAT DỰ ÁN (hàm sendGroupChatMessage)
                            const _added = employees.find(emp => emp.id === val)?.name || 'Thành viên';
                            notifyProjectChat(`➕ ${currentUser.name} đã thêm ${_added} vào Nhiệm Vụ "${mission.name}".`);
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full rounded"
                        >
                          <option value="">Chọn thợ...</option>
                          {employees
                            .filter(emp => !(mission.memberIds || []).includes(emp.id))
                            .map(emp => (
                              <option key={emp.id} value={emp.id} className="bg-slate-950 text-slate-100">
                                {emp.name} ({emp.department || emp.role})
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {mission.memberIds.map(memId => {
                      const emp = employees.find(e => e.id === memId);
                      if (!emp) return null;
                      const parts = emp.name.split(' ');
                      const initials = parts.length >= 2
                        ? `${parts[parts.length - 2][0]}${parts[parts.length - 1][0]}`.toUpperCase()
                        : (parts[0] ? parts[0].substring(0, 2).toUpperCase() : '??');
                      return (
                        <div key={memId} className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                          <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-705 flex items-center justify-center text-[8px] font-black text-white shrink-0">
                            {initials}
                          </div>
                          <span className="text-[10px] text-slate-300 font-bold">{emp.name}</span>
                          {hasMissionPermission && !isMissionCompleted && selectedTask.status !== 'completed' && (
                            <button
                              type="button"
                              onClick={() => {
                                const updatedMissions = (selectedTask.missions || []).map(m => {
                                  if (m.id === mission.id) {
                                    return { ...m, memberIds: (m.memberIds || []).filter(id => id !== memId) };
                                  }
                                  return m;
                                });
                                onUpdateTask(selectedTask.id, { missions: updatedMissions });
                                // 📣 Gửi thông báo vào NHÓM CHAT DỰ ÁN (hàm sendGroupChatMessage)
                                const _removed = employees.find(emp => emp.id === memId)?.name || 'Thành viên';
                                notifyProjectChat(`➖ ${currentUser.name} đã xóa ${_removed} khỏi Nhiệm Vụ "${mission.name}".`);
                              }}
                              className="text-slate-500 hover:text-rose-400 font-extrabold text-[9px] pl-1 cursor-pointer border-none bg-transparent"
                              title={`Xóa ${emp.name}`}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {mission.memberIds.length === 0 && (
                      <span className="text-slate-500 italic text-[10px]">Chưa gán nhân sự cho nhiệm vụ này</span>
                    )}
                  </div>
                </div>

                {/* 🚗 BIÊN BẢN CÔNG TÁC PHÍ CHUYẾN ĐI (NẾU CÓ) */}
                <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2 mb-2">
                    <span className="block text-slate-800 font-extrabold text-[10.5px] uppercase tracking-wider flex items-center gap-1">
                      🚗 GHI NHẬN CÔNG TÁC PHÍ CHUYẾN ĐI (NẾU CÓ):
                    </span>
                  </div>

                  {/* Danh sách định mức CTP đã ghi nhận */}
                  <div className="space-y-2">
                    {(!mission.travelAllowances || mission.travelAllowances.length === 0) ? (
                      <div className="text-center py-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                        <span className="text-slate-400 italic text-[11px]">Chưa ghi nhận công tác phí nào cho nhiệm vụ này.</span>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {mission.travelAllowances.map((item) => {
                          const emp = employees.find(e => e.id === item.memberId);
                          return (
                            <div key={item.id} className="p-2 bg-slate-50 hover:bg-slate-100/70 border border-slate-150 rounded-lg flex items-center justify-between gap-2 group transition">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[10px] text-amber-800 font-extrabold bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
                                  {emp?.name || 'Thợ / Nhân viên'}
                                </span>
                                <span className="text-[11px] text-slate-700 font-medium truncate">
                                  {item.content}
                                </span>
                              </div>

                              {/* CTP cho phép chỉnh sửa ngay cả khi nhiệm vụ đã Hoàn thành (theo yêu cầu) */}
                              {hasMissionPermission && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updatedMissions = (selectedTask.missions || []).map(m => {
                                      if (m.id === mission.id) {
                                        return {
                                          ...m,
                                          travelAllowances: (m.travelAllowances || []).filter(ta => ta.id !== item.id)
                                        };
                                      }
                                      return m;
                                    });
                                    // Đồng bộ bản sao cục bộ (ghi đồng bộ xuống localStorage)
                                    setLocalTravelAllowances(prev => {
                                      const next = { ...prev, [mission.id]: (prev[mission.id] || []).filter(ta => ta.id !== item.id) };
                                      try { localStorage.setItem('hl_local_travel_allowances_v1', JSON.stringify(next)); } catch {}
                                      return next;
                                    });
                                    onUpdateTask(selectedTask.id, { missions: updatedMissions });
                                  }}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-150/80 rounded transition cursor-pointer shrink-0"
                                  title="Xóa công tác phí"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Form Ghi nhận CTP mới — cho phép cập nhật ngay cả khi nhiệm vụ đã Hoàn thành (theo yêu cầu) */}
                  {hasMissionPermission && (
                    <div className="mt-3.5 pt-3.5 border-t border-slate-150 space-y-3 bg-white p-1 rounded-xl">
                      <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-slate-600">
                        <Plus className="w-3.5 h-3.5 text-emerald-500" /> Đăng ký công tác phí chuyến đi:
                        {isMissionCompleted && (
                          <span className="ml-1 normal-case text-[9px] text-emerald-600 font-semibold">(Nhiệm vụ đã hoàn thành — vẫn có thể bổ sung)</span>
                        )}
                      </div>

                      {mission.memberIds.length === 0 ? (
                        <div className="text-center p-2.5 bg-amber-50 rounded border border-amber-200">
                          <span className="text-amber-800 text-[10px] font-bold">⚠️ Vui lòng thêm nhân sự tham gia thực hiện nhiệm vụ này trước khi ghi nhận công tác phí!</span>
                        </div>
                      ) : (
                        <div className="space-y-2 text-[11px]">
                          {/* Ghi nhận CTP nhanh gọn trên một dòng ngang linh hoạt */}
                          <div className="flex flex-col sm:flex-row items-end gap-2.5 p-0.5">
                            {/* Chọn nhân sự nhận CTP */}
                            <div className="flex-1 min-w-[130px] w-full space-y-1">
                              <label className="block text-slate-600 font-extrabold text-[9.5px]">Nhân sự nhận:</label>
                              <select
                                value={allowanceMemberId || mission.memberIds[0] || ''}
                                onChange={(e) => setAllowanceMemberId(e.target.value)}
                                className="w-full bg-white border border-slate-200 hover:border-slate-350 text-slate-800 rounded-lg px-2 py-1.5 outline-none focus:border-emerald-500/30 text-[11px]"
                              >
                                {mission.memberIds.map(memId => {
                                  const emp = employees.find(e => e.id === memId);
                                  return (
                                    <option key={memId} value={memId}>
                                      {emp?.name || 'Nhân viên'}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>

                            {/* Chọn hành trình định mức */}
                            <div className="flex-[2] min-w-0 w-full space-y-1">
                              <label className="block text-slate-600 font-extrabold text-[9.5px]">Nội dung:</label>
                              <select
                                value={allowanceNormId}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setAllowanceNormId(val);
                                  const norm = travelNorms.find(n => n.id === val);
                                  if (norm) {
                                    setAllowanceCustomContent(norm.content);
                                    setAllowanceCustomQty(1);
                                    setAllowanceCustomUnitPrice(norm.unitPrice);
                                  } else {
                                    setAllowanceCustomContent('');
                                    setAllowanceCustomQty(1);
                                    setAllowanceCustomUnitPrice(0);
                                  }
                                }}
                                className="w-full bg-white border border-slate-200 hover:border-slate-350 text-slate-800 rounded-lg px-2 py-1.5 outline-none focus:border-emerald-500/30 text-[11px]"
                              >
                                <option value="">-- Chọn chuyến đi trong định mức --</option>
                                {travelNorms.map(norm => (
                                  <option key={norm.id} value={norm.id}>
                                    {norm.content}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Nút ghi nhanh */}
                            <button
                              type="button"
                              disabled={!allowanceNormId}
                              onClick={() => {
                                const finalMemId = allowanceMemberId || mission.memberIds[0];
                                if (!finalMemId || !allowanceNormId) return;

                                const selectedNorm = travelNorms.find(n => n.id === allowanceNormId);
                                if (!selectedNorm) return;

                                const newAllowance = {
                                  id: `ta_${Date.now()}`,
                                  rowId: (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
                                    ? crypto.randomUUID()
                                    : `te_${Date.now()}_${Math.floor(Math.random() * 1e9)}`,
                                  memberId: finalMemId,
                                  normId: allowanceNormId,
                                  code: selectedNorm.code,
                                  content: selectedNorm.content,
                                  quantity: 1,
                                  unitPrice: Number(selectedNorm.unitPrice),
                                  amount: Number(selectedNorm.unitPrice),
                                  notes: allowanceNotes.trim() || undefined
                                };

                                const updatedMissions = (selectedTask.missions || []).map(m => {
                                  if (m.id === mission.id) {
                                    return {
                                      ...m,
                                      travelAllowances: [...(m.travelAllowances || []), newAllowance]
                                    };
                                  }
                                  return m;
                                });

                                onUpdateTask(selectedTask.id, { missions: updatedMissions });
                                // Lưu cục bộ để không bị mất khi `tasks` reload từ Supabase.
                                // Ghi ĐỒNG BỘ xuống localStorage ngay tại đây (không chỉ qua useEffect)
                                // để chắc chắn sống sót kể cả khi modal bị remount ngay sau đó.
                                setLocalTravelAllowances(prev => {
                                  const next = { ...prev, [mission.id]: [...(prev[mission.id] || []), newAllowance] };
                                  try { localStorage.setItem('hl_local_travel_allowances_v1', JSON.stringify(next)); } catch {}
                                  return next;
                                });
                                // ─── LƯU TỨC THÌ LÊN SUPABASE (bảng hrm_travel_expenses) ───
                                // Đảm bảo dữ liệu CTP đã nhập được lưu lên Supabase ngay lập tức,
                                // không chờ đến bước "Xác Nhận Hoàn Thành" (tránh mất do task reload).
                                persistTravelExpense(newAllowance, mission.name);

                                // Reset form states
                                setAllowanceNormId('');
                                setAllowanceCustomContent('');
                                setAllowanceCustomQty(1);
                                setAllowanceCustomUnitPrice(0);
                                setAllowanceNotes('');
                              }}
                              className="px-3 w-10 sm:w-10 font-bold uppercase rounded-lg text-white bg-emerald-500 hover:bg-emerald-600 active:scale-98 cursor-pointer shadow-sm inline-flex items-center justify-center transition disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 text-[16px] h-[32px] shrink-0"
                              title="Thêm công tác phí"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Nhập ghi chú phụ cho chuyến đi nếu cần */}
                          {allowanceNormId && (
                            <div className="flex gap-2 items-center text-[10px] mt-1.5 pl-1 animate-fade-in">
                              <span className="text-slate-500 shrink-0 font-bold">📝 Ghi chú:</span>
                              <input
                                type="text"
                                value={allowanceNotes}
                                onChange={(e) => setAllowanceNotes(e.target.value)}
                                placeholder="Ghi chú thêm chi tiết hành trình nếu cần..."
                                className="flex-1 bg-transparent border-b border-slate-200 focus:border-slate-400 text-slate-700 outline-none text-[10.5px] py-0.5 placeholder-slate-400"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Form fields */}
                <div className="space-y-4">
                  {/* 1. Work Report (Báo cáo công việc đã làm) */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-200 font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1">
                        ✍️ BÁO CÁO CÔNG VIỆC ĐÃ LÀM (BẮT BUỘC):
                      </span>
                      <span className="text-[8.5px] text-slate-450 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-850">
                        Tối thiểu 10 ký tự
                      </span>
                    </div>
                    
                    {isMissionCompleted ? (
                      <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-850/50 text-[11.5px] text-slate-300 font-sans leading-relaxed whitespace-pre-wrap">
                        {mission.workReports}
                      </div>
                    ) : (
                      <textarea
                        disabled={!hasMissionPermission}
                        rows={5}
                        value={missionReportText}
                        onChange={(e) => setMissionReportText(e.target.value)}
                        placeholder="Mô tả chi tiết những phần việc đã làm..."
                        className="w-full bg-slate-950 text-slate-200 border border-slate-850 focus:border-emerald-500/40 rounded-xl p-3 text-[11.5px] font-mono outline-none resize-none"
                      />
                    )}
                  </div>
                </div>

                {/* 2. Hình ảnh báo cáo (bắt buộc) */}
                <div className="space-y-1.5 bg-slate-900/30 p-3 rounded-xl border border-slate-850/50">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-200 font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5 text-emerald-400" /> HÌNH ẢNH BÁO CÁO (BẮT BUỘC):
                    </span>
                    <span className={`text-[8.5px] px-1.5 py-0.5 rounded border ${missionReportImages.length > 0 ? 'text-emerald-400 bg-emerald-950/30 border-emerald-900/40' : 'text-rose-400 bg-rose-950/30 border-rose-900/40'}`}>
                      {missionReportImages.length > 0 ? `Đã có ${missionReportImages.length} ảnh` : 'Cần ít nhất 1 ảnh'}
                    </span>
                  </div>

                  {isMissionCompleted ? (
                    mission.reportImages && mission.reportImages.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                        {mission.reportImages.map((src, i) => (
                          <a key={i} href={src} target="_blank" rel="noreferrer" className="block">
                            <img src={src} alt={`Hình báo cáo ${i + 1}`} referrerPolicy="no-referrer" className="w-full h-24 object-cover rounded-lg border border-slate-800 hover:border-emerald-500/40 transition cursor-pointer" />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <span className="block text-[10px] text-slate-500 italic">Nhiệm vụ này chưa có hình ảnh báo cáo.</span>
                    )
                  ) : (
                    <>
                      {/* Preview danh sách ảnh đã chụp / upload */}
                      {missionReportImages.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                          {missionReportImages.map((src, i) => (
                            <div key={i} className="relative group">
                              <img src={src} alt={`Hình báo cáo ${i + 1}`} referrerPolicy="no-referrer" className="w-full h-24 object-cover rounded-lg border border-slate-800" />
                              {hasMissionPermission && (
                                <button
                                  type="button"
                                  onClick={() => removeMissionReportImage(i)}
                                  className="absolute top-1 right-1 bg-black/60 hover:bg-rose-600 text-white text-[9px] p-1 px-1.5 rounded border border-slate-850 cursor-pointer font-bold"
                                  title="Xóa ảnh này"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Nút chụp / tải ảnh */}
                      {hasMissionPermission && (
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={openMissionReportCamera}
                            disabled={missionReportCameraOpen}
                            className="flex-1 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 text-[10.5px] text-slate-300 font-bold p-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            <Camera className="w-3.5 h-3.5 text-emerald-400" />
                            {missionReportCameraOpen ? 'Đang mở camera...' : 'Chụp từ Camera'}
                          </button>
                          <button
                            type="button"
                            onClick={() => missionReportImageInputRef.current?.click()}
                            className="flex-1 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 text-[10.5px] text-slate-300 font-bold p-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                            Tải ảnh lên
                          </button>
                          <input
                            ref={missionReportImageInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleMissionReportImageUpload}
                            className="hidden"
                          />
                        </div>
                      )}

                      {/* Khung camera live */}
                      {missionReportCameraOpen && (
                        <div className="relative rounded-lg overflow-hidden border border-emerald-900/40 bg-black mt-2 aspect-video flex flex-col items-center justify-center">
                          <video ref={missionReportVideoRef} className="w-full h-full object-cover" playsInline muted />
                          <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-2">
                            <button
                              type="button"
                              onClick={captureMissionReportImage}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow cursor-pointer flex items-center gap-1"
                            >
                              <Camera className="w-3.5 h-3.5" /> Chụp hình
                            </button>
                            <button
                              type="button"
                              onClick={stopMissionReportCamera}
                              className="bg-black/60 hover:bg-black/90 text-white text-[9px] p-1 px-2 rounded border border-slate-850 cursor-pointer font-bold"
                            >
                              ✕ Hủy
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

              </div>

              {/* Footer actions */}
              <div className="p-4 border-t border-slate-900 bg-slate-950/80 shrink-0 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMissionId(null);
                    setMissionAttachedFile(null);
                    resetMissionReportState();
                  }}
                  className="px-4 py-2 border border-slate-800 hover:border-slate-755 text-slate-400 hover:text-slate-100 rounded-xl text-[10.5px] font-bold transition cursor-pointer"
                >
                  Đóng
                </button>

                {!isMissionCompleted && (
                  <button
                    type="button"
                    disabled={
                      !hasMissionPermission ||
                      !missionReportText.trim() ||
                      missionReportText.trim().length < 10 ||
                      missionReportImages.length === 0
                    }
                    onClick={() => {
                      if (!missionReportText.trim() || missionReportImages.length === 0) return;

                      const currentMission = (selectedTask.missions || []).find(m => m.id === selectedMissionId);

                      // Gộp Công Tác Phí từ hai nguồn:
                      //  - currentMission.travelAllowances: nguồn từ selectedTask (có thể bị mất
                      //    nếu `tasks` reload từ Supabase giữa lúc ghi nhận và lúc hoàn thành).
                      //  - localTravelAllowances[selectedMissionId]: bản sao cục bộ luôn giữ nguyên.
                      // Loại trùng theo id để tránh ghi kép.
                      const dedupeById = (arr: any[]) => {
                        const seen = new Set<string>();
                        return (arr || []).filter(ta => {
                          if (!ta || !ta.id) return false;
                          if (seen.has(ta.id)) return false;
                          seen.add(ta.id);
                          return true;
                        });
                      };
                      const mergedCtp = dedupeById([
                        ...(currentMission?.travelAllowances || []),
                        ...(localTravelAllowances[selectedMissionId || ''] || [])
                      ]);

                      // Mark current mission as completed in original task list
                      const updatedMissions = (selectedTask.missions || []).map(m => {
                        if (m.id === selectedMissionId) {
                          return {
                            ...m,
                            status: 'completed' as const,
                            workReports: missionReportText.trim(),
                            evidence: missionReportImages[0] || '',
                            reportImages: [...missionReportImages],
                            travelAllowances: mergedCtp.length > 0 ? mergedCtp : m.travelAllowances,
                            completedAt: new Date().toISOString()
                          };
                        }
                        return m;
                      });

                      // Gửi toàn bộ thông tin Công Tác Phí qua Menu Công tác phí (HR System)
                      if (mergedCtp.length > 0) {
                        const project = projects.find(p => p.id === selectedTask.projectId);
                        const customer = customers?.find(c => c.id === project?.customerId);

                        const completedDate = new Date().toLocaleDateString('vi-VN');
                        const projectName = project?.name || 'Chưa rõ';
                        const customerName = customer?.name || 'Khách hàng lẻ';
                        const taskName = selectedTask.name;
                        const missionName = currentMission?.name || '';

                        const savedSummary = localStorage.getItem('hl_travel_expenses_summary_v4');
                        let summaryList = savedSummary ? JSON.parse(savedSummary) : [];

                        mergedCtp.forEach((ta, taIdx) => {
                          const emp = employees.find(e => e.id === ta.memberId);
                          const employeeName = emp?.name || 'Chưa gán';
                          const content = ta.content || 'Công tác phí';
                          const amount = ta.amount || 0;

                          // id duy nhất (mã hiển thị) + code hiển thị THCTP-XXX.
                          // `rowId` (UUID) dùng làm khóa chính Supabase — ưu tiên ta.rowId
                          // (đã sinh lúc "Thêm công tác phí") để upsert lặp lại an toàn, không
                          // tạo dòng trùng với bản ghi đã lưu tức thì ở bước thêm.
                          const uniqueId = `THCTP-${Date.now()}-${taIdx}`;
                          const code = `THCTP-${String(summaryList.length + 1).padStart(3, '0')}`;
                          let rowId: string = ta.rowId;
                          if (!rowId) {
                            rowId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
                              ? crypto.randomUUID()
                              : `te_${Date.now()}_${taIdx}_${Math.floor(Math.random() * 1e9)}`;
                          }

                          const newSummaryItem = {
                            id: uniqueId,
                            rowId,
                            code,
                            status: 'completed',
                            completedDate,
                            projectName,
                            customerName,
                            taskName,
                            missionName,
                            employeeName,
                            content,
                            amount,
                            createdAt: new Date().toISOString()
                          };

                          summaryList.push(newSummaryItem);

                          // Gửi lên Supabase (bảng hrm_travel_expenses) — best-effort, không chặn luồng.
                          // Truyền rowId để upsert cùng dòng đã lưu lúc "Thêm" (idempotent).
                          dbService.hrmTravelExpenses.save(newSummaryItem, { rowId })
                            .catch((e) => console.warn('[TravelExpense] ⚠️ Lưu Supabase thất bại (vẫn lưu localStorage):', e?.message || e));
                        });

                        localStorage.setItem('hl_travel_expenses_summary_v4', JSON.stringify(summaryList));
                        window.dispatchEvent(new CustomEvent('hl-hrm-travel-expenses-updated'));
                      }

                      // Push task update
                      onUpdateTask(selectedTask.id, {
                        missions: updatedMissions
                      });
                      // 🎉 Thông báo Toast khi Xác Nhận Hoàn Thành nhiệm vụ thành công
                      addToast({
                        title: '✅ Hoàn thành nhiệm vụ',
                        message: `Đã xác nhận hoàn thành nhiệm vụ "${mission?.name || selectedMissionId}"${mergedCtp.length > 0 ? ` và lưu ${mergedCtp.length} công tác phí.` : '.'}`,
                        type: 'success'
                      });
                      // Xoá bản sao cục bộ cho nhiệm vụ vừa hoàn thành (đã nằm trong missions của task)
                      setLocalTravelAllowances(prev => {
                        if (!prev[selectedMissionId || '']) return prev;
                        const nxt = { ...prev };
                        delete nxt[selectedMissionId || ''];
                        return nxt;
                      });
                      // 📣 Gửi thông báo vào NHÓM CHAT DỰ ÁN (hàm sendGroupChatMessage)
                      notifyProjectChat(`✅ ${currentUser.name} đã Xác Nhận Hoàn Thành Nhiệm Vụ "${mission?.name || selectedMissionId}".`);

                      // Clear states
                      setSelectedMissionId(null);
                      setMissionAttachedFile(null);
                      resetMissionReportState();
                    }}
                    className={`px-5 py-2.5 rounded-xl font-bold text-[10.5px] uppercase tracking-wider flex items-center gap-1.5 transition ${
                      hasMissionPermission && 
                      missionReportText.trim() && 
                      missionReportText.trim().length >= 10
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 cursor-pointer shadow-lg shadow-emerald-500/15'
                        : 'bg-slate-850 text-slate-550 border border-slate-800 cursor-not-allowed'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    Xác Nhận Hoàn Thành
                  </button>
                )}

                {/* Delete action for original assignee or assigner */}
                {!isMissionCompleted && hasMissionPermission && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Bạn thật sự muốn xóa nhiệm vụ "${mission.name}" này?`)) {
                        const updatedMissions = (selectedTask.missions || []).filter(m => m.id !== selectedMissionId);
                        onUpdateTask(selectedTask.id, {
                          missions: updatedMissions
                        });
                        // 📣 Gửi thông báo vào NHÓM CHAT DỰ ÁN (hàm sendGroupChatMessage)
                        notifyProjectChat(`🗑️ ${currentUser.name} đã xóa Nhiệm Vụ "${mission.name}".`);

                        setSelectedMissionId(null);
                        setMissionAttachedFile(null);
                        resetMissionReportState();
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl border border-rose-950 hover:bg-rose-950/20 text-rose-400 text-[10.5px] font-bold transition cursor-pointer ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Tải Báo giá PDF Modal */}
      {downloadedQuoteModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 animate-fadeIn select-text text-left"
          onClick={(e) => {
            e.stopPropagation();
            setDownloadedQuoteModal(null);
          }}
        >
          <div 
            className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl text-slate-800 shadow-2xl overflow-hidden animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Header of Popup */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-250">
                  <FileText className="w-4 h-4 text-[#00a651]" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
                    Bản Xem Trước Báo Giá Nội Thất
                  </h4>
                  <p className="text-[10px] text-slate-500 font-medium">Báo giá chính thức từ thương hiệu nội thất HOANG LONG</p>
                </div>
              </div>
              <button 
                onClick={() => setDownloadedQuoteModal(null)} 
                className="text-slate-500 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 p-2 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-4 md:p-6 bg-slate-100 max-h-[75vh] overflow-y-auto">
              <QuotationTableSheet quoteData={downloadedQuoteModal} initialTab={downloadedQuoteActiveTab} />
            </div>

            {/* Footer Buttons */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDownloadedQuoteModal(null)}
                className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-extrabold text-xs rounded-xl cursor-pointer transition-colors"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  const element = document.createElement("a");
                  // Fallback content or full dynamic text summary representation
                  const fileContent = downloadedQuoteModal.content || `BẢNG BÁO GIÁ SẢN PHẨM HOANG LONG\nMã: ${downloadedQuoteModal.code}\nKhách hàng: ${downloadedQuoteModal.customerName}\nTổng trị giá: ${(downloadedQuoteModal.totalAmount || 0).toLocaleString('vi-VN')} đ`;
                  const file = new Blob([fileContent], {type: 'text/plain'});
                  element.href = URL.createObjectURL(file);
                  element.download = downloadedQuoteModal.name || `Bao_gia_Noi_that_${downloadedQuoteModal.customerName || 'Khach'}.txt`;
                  document.body.appendChild(element);
                  element.click();
                  document.body.removeChild(element);
                }}
                className="px-5 py-2.5 bg-[#00a651] hover:bg-[#008f45] text-white font-extrabold text-xs rounded-xl cursor-pointer transition-all hover:scale-[1.01]"
              >
                Tải xuống file TXT bản thô
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal: Đề Xuất Tạm Ứng Thầu Phụ */}
      {isAdvancingSubcontractor && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[120] p-4 text-left animate-fadeIn"
          onClick={(e) => {
            e.stopPropagation();
            setIsAdvancingSubcontractor(false);
          }}
        >
          <div 
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg text-slate-100 shadow-2xl overflow-hidden animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <span className="font-extrabold text-xs text-slate-200 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                <DollarSign className="w-4 h-4 text-emerald-400 animate-pulse" />
                ĐỀ XUẤT TẠM ỨNG
              </span>
              <button 
                onClick={() => setIsAdvancingSubcontractor(false)} 
                className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-750 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 max-h-[70vh] overflow-y-auto">
              {/* Mã Đề Xuất (Tự sinh, không được sửa) */}
              <div className="space-y-1">
                <label className="text-slate-455 text-[10px] uppercase font-bold tracking-wider font-sans">Mã Đề Xuất (Tự sinh)</label>
                <input 
                  type="text" 
                  disabled 
                  value={proposalId}
                  className="bg-slate-950 border border-slate-850 rounded-lg p-2.5 w-full text-xs font-bold text-emerald-450 cursor-not-allowed font-mono"
                />
              </div>

              {/* Ngày Đề Xuất */}
              <div className="space-y-1">
                <label className="text-slate-455 text-[10px] uppercase font-bold tracking-wider font-sans">Ngày Đề Xuất <span className="text-rose-500">*</span></label>
                <input 
                  type="date" 
                  value={advProposalDate}
                  onChange={(e) => setAdvProposalDate(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 w-full text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-sans font-medium"
                />
              </div>

              {/* Tên Thầu Phụ (Chọn thầu phụ tương ứng đang liên kết với Công Việc con) */}
              <div className="space-y-1">
                <label className="text-slate-455 text-[10px] uppercase font-bold tracking-wider font-sans">Tên Thầu Phụ</label>
                <select 
                  disabled
                  value={selectedTask.subcontractorId || ''}
                  className="bg-slate-950 border border-slate-850 rounded-lg p-2.5 w-full text-xs font-bold text-orange-400 cursor-not-allowed font-sans"
                >
                  <option value={selectedTask.subcontractorId || ''}>
                    {selectedTask.subcontractorName || 'N/A'} {selectedTask.subcontractorId ? `(${selectedTask.subcontractorId})` : ''}
                  </option>
                </select>
              </div>

              {/* Thông tin Hợp đồng & Công nợ thầu phụ */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                  THÔNG TIN HỢP ĐỒNG & CÔNG NỢ
                </span>
                
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-slate-900/40 p-2 rounded-lg border border-slate-850">
                    <span className="text-[9px] text-slate-400 block uppercase font-medium">Giá Trị Hợp Đồng</span>
                    {isSubContractApproved ? (
                      <span className="text-xs font-bold text-emerald-400 font-mono">
                        {subContractValue.toLocaleString('vi-VN')} đ
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-rose-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Chưa duyệt/Chưa có
                      </span>
                    )}
                  </div>

                  <div className="bg-slate-900/40 p-2 rounded-lg border border-slate-850">
                    <span className="text-[9px] text-slate-400 block uppercase font-medium">Đã Thanh Toán</span>
                    <span className="text-xs font-bold text-sky-400 font-mono">
                      {subTotalPaidAmount.toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                </div>

                <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-850 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-300 block uppercase font-bold">CÔNG NỢ CÒN LẠI</span>
                    <span className="text-[9px] text-slate-500 font-mono font-medium">Hợp đồng - Thanh toán thực tế</span>
                  </div>
                  <span className="text-sm font-black text-amber-400 font-mono">
                    {subRemainingLiability.toLocaleString('vi-VN')} đ
                  </span>
                </div>

                {subTotalPendingAdvAmount > 0 && (
                  <div className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-850 flex items-center justify-between text-xs">
                    <span className="text-slate-400 text-[10px] font-medium uppercase">Đề xuất khác đang chờ duyệt:</span>
                    <span className="font-bold text-slate-300 font-mono">
                      -{subTotalPendingAdvAmount.toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                )}

                {isSubContractApproved && (
                  <div className="flex items-center justify-between text-[11px] px-1 font-medium border-t border-slate-850 pt-2">
                    <span className="text-slate-400 text-[10px] uppercase font-bold">Hạn mức khả dụng đề xuất:</span>
                    <span className="font-extrabold text-emerald-400 font-mono">
                      {subAvailableToPropose.toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                )}
              </div>

              {/* Tên Dự Án */}
              <div className="space-y-1">
                <label className="text-slate-455 text-[10px] uppercase font-bold tracking-wider font-sans">Tên Dự Án</label>
                <input 
                  type="text" 
                  disabled 
                  value={project?.name || 'Không xác định'}
                  className="bg-slate-950 border border-slate-850 rounded-lg p-2.5 w-full text-xs text-slate-400 cursor-not-allowed font-sans font-medium"
                />
              </div>

              {/* Tên Công Việc Con */}
              <div className="space-y-1">
                <label className="text-slate-455 text-[10px] uppercase font-bold tracking-wider font-sans">Tên Công Việc Con</label>
                <input 
                  type="text" 
                  disabled 
                  value={selectedTask.name}
                  className="bg-slate-950 border border-slate-850 rounded-lg p-2.5 w-full text-xs text-slate-400 cursor-not-allowed font-sans font-medium"
                />
              </div>

              {/* Số Tiền Đề Xuất Tạm Ứng (VNĐ) */}
              <div className="space-y-1">
                <label className="text-slate-455 text-[10px] uppercase font-bold tracking-wider font-sans">Số tiền đề xuất tạm ứng (VNĐ) <span className="text-rose-500">*</span></label>
                <input 
                  type="number" 
                  value={subcontractorAdvAmount || ''}
                  onChange={(e) => setSubcontractorAdvAmount(Number(e.target.value))}
                  placeholder="Nhập số tiền VNĐ..."
                  className={`bg-slate-950 border rounded-lg p-2.5 w-full text-xs font-mono font-bold focus:outline-none ${
                    subcontractorAdvAmount > subRemainingLiability 
                      ? 'border-rose-500 text-rose-200 focus:border-rose-500' 
                      : 'border-slate-800 text-slate-100 focus:border-emerald-500'
                  }`}
                />
                {subcontractorAdvAmount > 0 && subcontractorAdvAmount <= subRemainingLiability && (
                  <p className="text-[10px] text-emerald-400 font-bold font-mono pl-1">
                    Bằng chữ: {subcontractorAdvAmount.toLocaleString('vi-VN')} VNĐ
                  </p>
                )}
                {subcontractorAdvAmount > subRemainingLiability && (
                  <p className="text-[10px] text-rose-400 font-bold flex items-center gap-1 pl-1 font-sans">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Vượt quá công nợ còn lại ({subRemainingLiability.toLocaleString('vi-VN')} VNĐ)!
                  </p>
                )}
              </div>

              {/* Diễn Giải */}
              <div className="space-y-1">
                <label className="text-slate-455 text-[10px] uppercase font-bold tracking-wider font-sans">Diễn Giải <span className="text-rose-500">*</span></label>
                <textarea 
                  value={subcontractorAdvReason}
                  onChange={(e) => setSubcontractorAdvReason(e.target.value)}
                  placeholder="Nhập diễn giải chi tiết cho khoản đề xuất tạm ứng..."
                  rows={2}
                  className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 w-full text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-sans"
                />
              </div>

              {/* Người Xét Duyệt & Người Lập Phiếu (Hai cột ngang) */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-slate-455 text-[10px] uppercase font-bold tracking-wider font-sans">Người Xét Duyệt</label>
                  <select
                    value={advProposalApprover}
                    onChange={(e) => setAdvProposalApprover(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 w-full text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-sans cursor-pointer"
                  >
                    {finalManagementGroup.map((emp) => {
                      let roleLabel = '';
                      if (emp.role === 'director') roleLabel = 'Giám đốc';
                      else if (emp.role === 'pm') roleLabel = 'Trưởng Dự Án';
                      else if (emp.role === 'accountant') roleLabel = 'Kế Toán';
                      else roleLabel = emp.role || '';
                      return (
                        <option key={emp.id} value={emp.name}>
                          {emp.name} ({roleLabel})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-455 text-[10px] uppercase font-bold tracking-wider font-sans">Người Lập Phiếu</label>
                  <select
                    value={advProposalCreator}
                    onChange={(e) => setAdvProposalCreator(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 w-full text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-sans cursor-pointer"
                  >
                    {finalManagementGroup.map((emp) => {
                      let roleLabel = '';
                      if (emp.role === 'director') roleLabel = 'Giám đốc';
                      else if (emp.role === 'pm') roleLabel = 'Trưởng Dự Án';
                      else if (emp.role === 'accountant') roleLabel = 'Kế Toán';
                      else roleLabel = emp.role || '';
                      return (
                        <option key={emp.id} value={emp.name}>
                          {emp.name} ({roleLabel})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-950/60 border-t border-slate-800 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsAdvancingSubcontractor(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded-lg cursor-pointer transition-colors font-sans"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={subcontractorAdvAmount <= 0 || subcontractorAdvAmount > subRemainingLiability}
                onClick={() => {
                  // Dùng người duyệt từ state
                  const finalApprover = advProposalApprover;
                  setCustomDialog({
                    show: true,
                    type: 'confirm',
                    title: 'Xác Nhận Gửi Đề Xuất Tạm Ứng 📋',
                    message: `Bạn có chắc chắn muốn gửi Đề xuất Tạm ứng này sang phòng Tài chính Kế toán không?\n\n• Số tiền đề xuất: ${subcontractorAdvAmount.toLocaleString('vi-VN')} VNĐ\n• Thầu phụ: ${selectedTask.subcontractorName || 'N/A'}\n• Công việc: ${selectedTask.name}\n• Người lập phiếu: ${advProposalCreator}\n• Người xét duyệt: ${finalApprover}`,
                    onConfirm: () => {
                      handleAddSubcontractorAdvance(
                        proposalId,
                        selectedTask.subcontractorId || '',
                        selectedTask.subcontractorName || 'N/A',
                        selectedTask.projectId || '',
                        project?.name || 'Không xác định',
                        selectedTask.id,
                        selectedTask.name,
                        subcontractorAdvAmount,
                        subcontractorAdvReason,
                        finalApprover,
                        advProposalCreator,
                        advProposalDate
                      );
                    }
                  });
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs rounded-lg cursor-pointer transition-all hover:scale-[1.01] font-sans"
              >
                Gửi Đề Xuất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert/Confirm Dialog overlay */}
      {customDialog && customDialog.show && (
        <div 
          className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 text-left animate-fadeIn select-text"
          onClick={() => {
            if (customDialog.type === 'alert') {
              if (customDialog.onConfirm) customDialog.onConfirm();
              setCustomDialog(null);
            }
          }}
        >
          <div 
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md text-slate-100 shadow-2xl overflow-hidden animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <span className="font-extrabold text-xs text-slate-200 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                {customDialog.type === 'confirm' ? (
                  <AlertCircle className="w-4 h-4 text-emerald-450 animate-pulse" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-450 animate-bounce" />
                )}
                {customDialog.title}
              </span>
              <button 
                onClick={() => {
                  if (customDialog.type === 'alert' && customDialog.onConfirm) {
                    customDialog.onConfirm();
                  }
                  setCustomDialog(null);
                }} 
                className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-750 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-300 font-sans leading-relaxed whitespace-pre-line font-semibold">
                {customDialog.message}
              </p>
            </div>

            <div className="px-5 py-3.5 bg-slate-950/60 border-t border-slate-800 flex justify-end gap-2.5">
              {customDialog.type === 'confirm' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (customDialog.onCancel) customDialog.onCancel();
                      setCustomDialog(null);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded-lg cursor-pointer transition-colors font-sans"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (customDialog.onConfirm) customDialog.onConfirm();
                      setCustomDialog(null);
                    }}
                    className="px-4 py-2 bg-[#00a651] hover:bg-[#008f45] text-white font-bold text-xs rounded-lg cursor-pointer transition-all hover:scale-[1.01] font-sans"
                  >
                    Xác nhận
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (customDialog.onConfirm) customDialog.onConfirm();
                    setCustomDialog(null);
                  }}
                  className="px-5 py-2.5 bg-[#00a651] hover:bg-[#008f45] text-white font-extrabold text-xs rounded-xl cursor-pointer transition-all hover:scale-[1.01] font-sans"
                >
                  Xác nhận
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {activeConnectedTool && (
        <ConnectedToolsModal
          currentUser={currentUser}
          employees={employees}
          tasks={tasks}
          selectedProject={project || projects.find(p => p.id === selectedTask.projectId) || null}
          activeConnectedTool={activeConnectedTool}
          setActiveConnectedTool={setActiveConnectedTool}
          connectedTaskId={connectedTaskId}
          setConnectedTaskId={setConnectedTaskId}
          overlayTaskId={null}
          customers={customers || []}
          updateProjectWithRule={onUpdateProject || (() => {})}
          localUpdateTask={onUpdateTask}
          ctCostType={ctCostType}
          setCtCostType={setCtCostType}
        />
      )}

    </div>
  );
}
