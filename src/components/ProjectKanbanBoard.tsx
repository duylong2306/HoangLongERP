import React, { useState, useEffect } from 'react';
import { Project, Customer, Employee, Task, TaskPriority, TaskStatus, ProjectDoc, Receipt, Payment, Quote, SubcontractorAdvanceProposal, ArchivedQuote } from '../types';
import { getDefaultColumns, getColumnStyleDetails, getProjectColumnId, getAbbrev, addColumnReducer, deleteColumnReducer, updateColumnReducer, updateColumnAutomationReducer, KanbanColumn, AVAILABLE_CARD_COLORS } from '../lib/kanbanLogic';
import { useNotification } from '../context';
import {
  Plus, Search, Edit2, Check, Settings, Play, ArrowRight, CheckSquare,
  User, Calendar, DollarSign, Image as ImageIcon, MessageSquare,
  Paperclip, Tag, Trash2, X, Send, AlertCircle, FileUp, Shield,
  HelpCircle, ChevronRight, CheckCircle2, Award, Zap, Briefcase, FileText, Save, Link,
  Users, Mail, Percent, ListTodo, RotateCcw, Calculator, Sliders, Type, MoreVertical,
  ZoomIn, ZoomOut
} from 'lucide-react';
// MODULE NHẬP (Imports)
// -----------------------
// ./TaskDetailModal         → Modal chi tiết công việc (Task)
// ./QuotationTableSheet     → Sheet bảng báo giá (Quote)
// ./ConnectedToolsModal     → Modal công cụ kết nối (Duyệt, Chi phí, Vật tư, ...)
// ../lib/dbService           → Service IndexedDB (thao tác với archivedQuotes, constructionQuotes, ...)
// ./SearchableEmployeeSelect → Component chọn nhân viên có ô tìm kiếm
// ./kanban/ColumnSettingsModal → Modal cài đặt cột Kanban
// lucide-react               → Icon UI (Plus, Search, Edit2, Check, Settings, Play, ...)
// ../context                  → useNotification() hiển thị toast thông báo
// ../types                    → Các định nghĩa TypeScript: Project, Customer, Employee, Task, TaskPriority, TaskStatus, ProjectDoc, Receipt, Payment, Quote, SubcontractorAdvanceProposal, ArchivedQuote
// ../lib/kanbanLogic          → getDefaultColumns, getColumnStyleDetails, getProjectColumnId, getAbbrev, addColumnReducer, deleteColumnReducer, updateColumnReducer, updateColumnAutomationReducer, KanbanColumn, AVAILABLE_CARD_COLORS
import TaskDetailModal from './TaskDetailModal';
import { can as canProjectAction, loadProjectPermissions } from './hr/hrProjectPermissions';
import { canViewTask, loadTaskPermissionMatrix } from './hr/hrTaskPermissions';
import QuotationTableSheet from './QuotationTableSheet';
import ConnectedToolsModal from './ConnectedToolsModal';
import { dbService } from '../lib/dbService';
import SearchableEmployeeSelect from './SearchableEmployeeSelect';
import ColumnSettingsModal from './kanban/ColumnSettingsModal';
import { createGroupConversation, addMessage, getConversations } from '../lib/chatStore';

export type { KanbanColumn } from '../lib/kanbanLogic';

/**
 * Tự động gửi tin nhắn vào nhóm chat của công việc (conv_task_<taskId>).
 * Nếu nhóm chưa tồn tại thì tạo mới từ danh sách người liên quan.
 * (Dùng chung với TaskManagement để thay thế note workLogs bằng chat thật.)
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

// PROPS (Interface) - Định nghĩa các props component nhận từ parent (App.tsx / SectorKanbanWrapper)
// =================================================================================================
// sector: 'construction' | 'furniture' | 'mechanical' → Phân hệ (Xây dựng/Nội thất/Cơ khí)
// projects, customers, employees, tasks → Mảng dữ liệu chính từ App.tsx
// receipts, payments → Dữ liệu tài chính
// onAddProject, onUpdateProject, onDeleteProject → Callbacks thao tác Project
// onAddTask, onUpdateTask, onDeleteTask, onDeleteMultipleTasks → Callbacks thao tác Task
// onAddCustomer → Callback thêm khách hàng
// theme → light only (dark mode removed)
// currentUser → Employee hiện tại (dùng phân quyền)
// quotes → Danh sách báo giá
// onRedirectToQuote, onRedirectToSubcontractor → Callbacks điều hướng
interface ProjectKanbanBoardProps {
  sector: 'construction' | 'furniture' | 'mechanical';
  projects: Project[];
  customers: Customer[];
  employees: Employee[];
  tasks: Task[];
  receipts: Receipt[];
  payments: Payment[];
  onAddProject: (newProject: Project) => void;
  onUpdateProject: (id: string, updates: Partial<Project>) => void;
  onDeleteProject?: (id: string) => void;
  onAddTask: (newTask: Task) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onDeleteTask?: (id: string) => void;
  onDeleteMultipleTasks?: (ids: string[]) => void;
  onAddCustomer?: (newCust: Customer) => void;
  currentUser?: Employee;
  quotes?: Quote[];
  onRedirectToQuote?: (projectId: string) => void;
  onRedirectToSubcontractor?: (projectId: string, subcontractorId: string, workName: string) => void;
}

export default function ProjectKanbanBoard({
  sector,
  projects,
  customers,
  employees,
  tasks,
  receipts,
  payments,
  onAddProject,
  onUpdateProject,
  onDeleteProject,
  onAddTask,
  onUpdateTask,
  onAddCustomer,
  onDeleteTask,
  onDeleteMultipleTasks,
  currentUser,
  quotes,
  onRedirectToQuote,
  onRedirectToSubcontractor
}: ProjectKanbanBoardProps) {
  const { addToast } = useNotification(); // Toast thông báo từ context

  // ===========================================================================
  // SECTION: PHÂN QUYỀN NGƯỜI DÙNG (RBAC) — Quyền Dự Án
  // ===========================================================================
  // Dùng ma trận Quyền Dự Án (hrProjectPermissions) thay thế quyền module sector cũ.
  // Mọi thao tác (Cột / Thẻ / Công việc / Nhiệm vụ / Hồ sơ / Thầu phụ) đều qua can().
  // boardProject = dự án đại diện của phân hệ (dùng tính quyền cấp bảng)
  const boardProject = projects.find(p => p.type === sector || (p as any).sector === sector);
  const matrix = loadProjectPermissions();

  // ===========================================================================
  // BIẾN QUYỀN (Permission flags) - Derived từ can() / Quyền Dự Án
  // ===========================================================================
  // Cột Kanban
  const canCreateColumn = canProjectAction('createColumn', currentUser, boardProject, undefined, matrix);
  const canEditColumn = canProjectAction('editColumn', currentUser, boardProject, undefined, matrix);
  const canDeleteColumn = canProjectAction('deleteColumn', currentUser, boardProject, undefined, matrix);
  const canConfigureColumnAutomation = canProjectAction('configureColumnAutomation', currentUser, boardProject, undefined, matrix);

  // Thẻ Dự Án
  const canView = canProjectAction('viewProjectFinance', currentUser, boardProject, undefined, matrix);
  const canCreate = canProjectAction('createCard', currentUser, boardProject, undefined, matrix);
  const canEdit = canProjectAction('editCard', currentUser, boardProject, undefined, matrix);
  const canDelete = canProjectAction('deleteCard', currentUser, boardProject, undefined, matrix);
  const canMoveCard = canProjectAction('moveCard', currentUser, boardProject, undefined, matrix);
  const canAssignCardMember = canProjectAction('assignCardMember', currentUser, boardProject, undefined, matrix);

  // Công việc (Task)
  const canCreateTask = canProjectAction('createTask', currentUser, boardProject, undefined, matrix);
  const canEditTask = canProjectAction('editTask', currentUser, boardProject, undefined, matrix);
  const canDeleteTask = canProjectAction('deleteTask', currentUser, boardProject, undefined, matrix);

  // 1. Column configuration initialized in LocalStorage or defaults
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [archivedQuotesList, setArchivedQuotesList] = useState<ArchivedQuote[]>([]);
  const [subcontractorContracts, setSubcontractorContracts] = useState<ArchivedQuote[]>([]);

  // Sector-based Supabase key for Kanban columns persistence

  // ===========================================================================
  // SECTION: KHAI BÁO DỮ LIỆU CHO COLUMNS & CACHED QUOTEs
  // ===========================================================================
  // columns → Mảng các cột Kanban (tên/các automation/rules)
  // archivedQuotesList → Cached list các ArchivedQuote từ nhiều collection để tham chiếu
  // subcontractorContracts → Cached nhà thầu gốc (sub contractor quote) cho subtask
  useEffect(() => {
    let active = true; // Trang thái useEffect riêng

    // ===========================================================================
    // fetchArchivedQuotes() → Load archived quotes from IndexedDB theo sector
    // Để tham chiếu: các Quote đã có trong archivedProjects/constructionQuotes/etc.
    // Đảm bảo có dữ liệu trước khi lọc theo project, tránh lỗi khi không có
    // ===========================================================================
    const fetchArchivedQuotes = async () => {
      try {
        const [generalList, constructionList, cabinetList, mechanicalList, subList] = await Promise.all([
          dbService.archivedQuotes.list().catch(() => []),
          dbService.archivedConstructionQuotes.list().catch(() => []),
          dbService.archivedCabinetQuotes.list().catch(() => []),
          dbService.archivedMechanicalQuotes.list().catch(() => []),
          dbService.archivedSubcontractorQuotes.list().catch(() => [])
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
        }
      } catch (err) {
        console.error("Lỗi khi tải hồ sơ lưu trữ:", err);
      }
    };
    fetchArchivedQuotes();
    const handleArchivedUpdated = () => fetchArchivedQuotes();
    window.addEventListener('hl-archived-quotes-updated', handleArchivedUpdated);
    window.addEventListener('hl-archived-cabinet-quotes-updated', handleArchivedUpdated);
    window.addEventListener('hl-archived-mechanical-quotes-updated', handleArchivedUpdated);
    window.addEventListener('hl-archived-subcontractor-quotes-updated', handleArchivedUpdated);
    return () => {
      active = false;
      window.removeEventListener('hl-archived-quotes-updated', handleArchivedUpdated);
      window.removeEventListener('hl-archived-cabinet-quotes-updated', handleArchivedUpdated);
      window.removeEventListener('hl-archived-mechanical-quotes-updated', handleArchivedUpdated);
      window.removeEventListener('hl-archived-subcontractor-quotes-updated', handleArchivedUpdated);
    };
  }, [projects]);

  // Load columns từ Supabase khi sector thay đổi
  useEffect(() => {
    let active = true;
    dbService.kanbanColumns.get(sector).then(data => {
      if (!active) return;
      if (data && data.columns && data.columns.length > 0) {
        setColumns(data.columns);
        setColumnWidth(data.columnWidth);
      } else {
        setColumns(getDefaultColumns());
      }
    }).catch(() => { if (active) setColumns(getDefaultColumns()); });
    return () => { active = false; };
  }, [sector]);

  // ===========================================================================
  // saveColumns() - Lưu mảng columns vào state + Supabase
  // ===========================================================================
  const saveColumns = (newCols: KanbanColumn[]) => {
    setColumns(newCols);
    dbService.kanbanColumns.save(sector, newCols, columnWidth).catch(() => {});
  };


  // ===========================================================================
  // SECTION: STATES CÀI ĐẶT CỘT & AUTOMATION
  // ===========================================================================
  // editingColumnId/editColName/editColColor → cột đang sửa trong ColumnSettingsModal
  // editColRuleType/editColRuleParam → rule của cột (none/status/assignee/...)
  // showAutoWorkflowModal/activeWorkflowColId/selectedActionType → modal automation
  // activeSubtaskRuleIndex → chỉ số rule subtask đang chọn
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editColName, setEditColName] = useState('');
  const [editColColor, setEditColColor] = useState('');
  const [editColRuleType, setEditColRuleType] = useState<string>('none');
  const [editColRuleParam, setEditColRuleParam] = useState<string>('');
  const [showAutoWorkflowModal, setShowAutoWorkflowModal] = useState(false);
  const [activeWorkflowColId, setActiveWorkflowColId] = useState<string>('col_design');
  const [selectedActionType, setSelectedActionType] = useState<
    'assignee' | 'status' | 'approval' | 'subtask' | 'involved' | 'textStyle'
  >('assignee');
  const [activeSubtaskRuleIndex, setActiveSubtaskRuleIndex] = useState<number | null>(null);

  // ===========================================================================
  // SECTION: STATES DRAWER CHI TIẾT & CÔNG CỤ LIÊN THÔNG (Connected Tools)
  // ===========================================================================
  // selectedProjectId → dự án đang mở drawer
  // overlayTaskId → Task đang overlay (xem qua)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [overlayTaskId, setOverlayTaskId] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // Custom confirmation dialog state to replace native blocked browser confirm()
  const [confirmDialog, setConfirmDialog] = useState<{
    title?: string;
    message: string;
    onConfirm?: () => void;
    confirmText?: string;
    cancelText?: string;
  } | null>(null);

  // States cho "Công cụ liên thông" (LT=Liên thông, HS=Hồ sơ, TP=Thầu phụ) trên Task
  const [activeConnectedTool, setActiveConnectedTool] = useState<'approval' | 'cost' | 'material' | 'quotation' | 'contract' | 'acceptance' | 'liquidation' | null>(null);
  const [connectedTaskId, setConnectedTaskId] = useState<string | null>(null);

  // State cho modal xem báo giá PDF (read-only)
  const [downloadedQuoteModal, setDownloadedQuoteModal] = useState<ArchivedQuote | null>(null);
  const [downloadedQuoteActiveTab, setDownloadedQuoteActiveTab] = useState<'quote' | 'contract' | 'acceptance' | 'liquidation'>('quote');
  const [activePopover, setActivePopover] = useState<{ taskId: string, group: 'LT' | 'HS' | 'TP' } | null>(null);

  // Zoom level state for Kanban columns (loaded from Supabase in useEffect above)
  const [columnWidth, setColumnWidth] = useState<number>(280);

  useEffect(() => {
    const handleOutsideClick = () => {
      setActivePopover(null);
    };
    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, []);
  
  // ===========================================================================
  // SECTION: STATES CỦA CÁC CÔNG CỤ LIÊN THÔNG (Connected Tools modals)
  // Tiền tố "ct" = Connected Tool
  // Các nhóm: Approval (Duyệt), Cost (Chi phí), Material (Vật tư), Quote/Doc (Báo giá/Hồ sơ)
  // ===========================================================================
  const [ctApprovalSubject, setCtApprovalSubject] = useState('Phê duyệt kết quả bàn giao thiết kế sơ bộ');
  const [ctApprovalType, setCtApprovalType] = useState<'1-level' | 'multi-level'>('1-level');
  const [ctApprovalSteps, setCtApprovalSteps] = useState<{ id: string; levelName: string; approverId: string; status: 'pending' | 'approved' | 'rejected'; notes?: string }[]>([
    { id: 'step_1', levelName: 'Cấp 1: Trưởng phòng thiết kế kỹ thuật', approverId: 'emp_2', status: 'pending' },
    { id: 'step_2', levelName: 'Cấp 2: Quản lý dự án thầu thợ', approverId: 'emp_3', status: 'pending' },
    { id: 'step_3', levelName: 'Cấp 3: Giám đốc phê duyệt đóng dấu', approverId: 'emp_1', status: 'pending' }
  ]);
  const [ctApprovalLogs, setCtApprovalLogs] = useState<string[]>([]);
  const [ctApprovalCurrentStepIdx, setCtApprovalCurrentStepIdx] = useState<number>(0);

  // States cho Đề xuất chi phí (Cost Proposal)
  const [ctCostType, setCtCostType] = useState<'contractor-advance' | 'expense-advance'>('expense-advance');
  const [ctContractorName, setCtContractorName] = useState('Đội thợ thi công số 4 - Thợ mộc và liên kết vách');
  const [ctAdvancePercentage, setCtAdvancePercentage] = useState(30);
  const [ctExpenseRows, setCtExpenseRows] = useState<{ id: string; item: string; amount: number; recipientId?: string; note: string }[]>([]);
  const [ctCostLogs, setCtCostLogs] = useState<string[]>([]);
  const [lastCostProposalId, setLastCostProposalId] = useState<string | null>(null);
  const [ctCostProposalId, setCtCostProposalId] = useState('');
  const [ctCostDescription, setCtCostDescription] = useState('Đề xuất chi phí mua sắm lẻ phát sinh phục vụ thi công công trình');
  const [ctCostApproverId, setCtCostApproverId] = useState('');
  const [ctCostSettlerId, setCtCostSettlerId] = useState('');
  const [ctCostProposalDate, setCtCostProposalDate] = useState<string>(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (activeConnectedTool === 'cost') {
      const generatedId = `DX-EXP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;
      setCtCostProposalId(generatedId);
      
      const activeTask = tasks.find(t => t.id === connectedTaskId || t.id === overlayTaskId);
      
      const director = employees.find(e => e.role === 'director');
      const pm = employees.find(e => e.role === 'pm');
      const accountant = employees.find(e => e.role === 'accountant');
      
      setCtCostApproverId(activeTask?.costApproverId || director?.id || pm?.id || employees[0]?.id || '');
      setCtCostSettlerId(activeTask?.costSettlerId || accountant?.id || director?.id || employees[0]?.id || '');
      setCtCostDescription('Đề xuất chi phí mua sắm lẻ phát sinh phục vụ thi công công trình');
      setCtCostProposalDate(new Date().toISOString().split('T')[0]);
    }
  }, [activeConnectedTool, employees, connectedTaskId, overlayTaskId, tasks]);

  // States cho Đề xuất vật tư (Material Proposal)
  const [ctMaterialRows, setCtMaterialRows] = useState<{ id: string; name: string; qty: number; unit: string; spec: string }[]>([]);
  const [ctMaterialLogs, setCtMaterialLogs] = useState<string[]>([]);
  const [ctMaterialCoordinationType, setCtMaterialCoordinationType] = useState<'self' | 'assign'>('self');
  const [ctMaterialCoordinatorId, setCtMaterialCoordinatorId] = useState<string>('');

  useEffect(() => {
    if (activeConnectedTool === 'material') {
      const activeTask = tasks.find(t => t.id === connectedTaskId || t.id === overlayTaskId);
      if (activeTask) {
        if (activeTask.isMaterialSelfCoordinated === true) {
          setCtMaterialCoordinationType('self');
          setCtMaterialCoordinatorId('');
        } else if (activeTask.isMaterialSelfCoordinated === false) {
          setCtMaterialCoordinationType('assign');
          setCtMaterialCoordinatorId(activeTask.materialCoordinatorId || '');
        } else {
          setCtMaterialCoordinationType('self');
          setCtMaterialCoordinatorId('');
        }
      }
    }
  }, [activeConnectedTool, connectedTaskId, overlayTaskId, tasks]);

  // States for Quotation
  // States cho Báo giá (Quote) gán vào project
  const [ctQuoteSector, setCtQuoteSector] = useState<'furniture' | 'construction' | 'mechanical'>('furniture');
  const [ctQuoteTitle, setCtQuoteTitle] = useState('Bản chào Báo giá thi công hoàn thiện chi tiết');
  const [ctQuoteRows, setCtQuoteRows] = useState<{ id: string; desc: string; unit: string; qty: number; price: number; note: string }[]>([
    { id: 'q_row_1', desc: 'Sản xuất và lắp đặt vách ván mộc ốp tường tiêu chuẩn', unit: 'm2', qty: 35, price: 650000, note: 'Gỗ MDF phủ Melamine chống ẩm vách mộc' },
    { id: 'q_row_2', desc: 'Gia công tủ hộc kéo gỗ công nghiệp kéo giảm chấn tủ áo', unit: 'Bộ', qty: 3, price: 4200000, note: 'Mặt ngăn kéo thiết kế chìm âm kịch phẳng' }
  ]);

  // States for Document Templates (Contract, Acceptance, Liquidation)
  // States cho soạn thảo văn bản Hồ sơ (Document draft: Quote/Contract/Acceptance/Liquidation)
  const [ctDocSector, setCtDocSector] = useState<'furniture' | 'construction' | 'mechanical'>('furniture');
  const [ctDocRepA, setCtDocRepA] = useState('Phan Văn Nam');
  const [ctDocPosA, setCtDocPosA] = useState('Chủ đầu tư / Đại diện chủ nhà công trình');
  const [ctDocRepB, setCtDocRepB] = useState('Trương Hữu Long');
  const [ctDocPosB, setCtDocPosB] = useState('Trưởng Dự Án thi công đại diện nhà thầu');
  const [ctDocWarranty, setCtDocWarranty] = useState('18 tháng kể từ ngày nghiệm thu');
  const [ctDocLocation, setCtDocLocation] = useState('Văn phòng đại diện Hoàng Long, Bảo Lộc, Lâm Đồng');
  const [ctDocAcceptRate, setCtDocAcceptRate] = useState(100);

  // States for Quotation links, document templates selection, and custom editable text body
  const [ctDocSelectedQuoteId, setCtDocSelectedQuoteId] = useState<string>('draft');
  const [ctDocTemplateId, setCtDocTemplateId] = useState<string>('mau_chuan');
  const [ctDocCustomText, setCtDocCustomText] = useState<string>('');

  // Hàm sinh nội dung văn bản thầu tự động dồi dào từ Báo giá nguồn & Mẫu văn bản
  // ===========================================================================
  // generateDocumentContent() → Sinh nội dung text cho các loại Hồ sơ (Quote/Contract/Acceptance/Liquidation)
  // Dùng khi đồng bộ văn bản từ project sang Documents
  // ===========================================================================
  const generateDocumentContent = (
    toolType: 'contract' | 'acceptance' | 'liquidation',
    templateId: string,
    quoteSourceId: string,
    repA: string,
    posA: string,
    repB: string,
    posB: string,
    warranty: string,
    location: string,
    rate: number
  ) => {
    if (!selectedProject) return '';
    const customer = customers.find(c => c.id === selectedProject.customerId) || { name: 'Chưa rõ', phone: '', address: '' };
    
    // Lấy danh sách hạng mục từ báo giá nguồn
    let quoteTitle = 'Bản báo giá thầu';
    let quoteValue = selectedProject.contractValue;
    let itemsList: { desc: string; unit: string; qty: number; price: number; note: string }[] = [];

    if (quoteSourceId === 'draft') {
      quoteTitle = ctQuoteTitle;
      quoteValue = ctQuoteRows.reduce((sum, r) => sum + r.qty * r.price, 0) * 1.1; // Bao gồm VAT
      itemsList = ctQuoteRows;
    } else if (quoteSourceId !== 'none') {
      const savedDoc = selectedProject.documents?.find(d => d.id === quoteSourceId);
      if (savedDoc) {
        quoteTitle = savedDoc.name;
        quoteValue = savedDoc.value || selectedProject.contractValue;
        if (savedDoc.customFields && savedDoc.customFields.length > 0) {
          itemsList = savedDoc.customFields.map((f, i) => ({
            id: `imported_${i}`,
            desc: f.label,
            unit: 'Hạng mục',
            qty: 1,
            price: savedDoc.value ? Math.round(savedDoc.value / savedDoc.customFields!.length) : 15000000,
            note: f.value
          }));
        } else {
          itemsList = [
            { desc: savedDoc.name, unit: 'Gói thầu', qty: 1, price: Math.round(quoteValue / 1.1), note: 'Chi tiết định mức theo sơ khảo liên thông' }
          ];
        }
      } else {
        itemsList = ctQuoteRows;
      }
    } else {
      itemsList = [
        { desc: 'Hạng mục thi công khảo sát thực địa định mức', unit: 'Hệ móng/Cột phẳng', qty: 1, price: Math.round(selectedProject.contractValue / 1.1), note: 'Thiết kế theo điều động chỉ huy thợ thầu' }
      ];
    }

    // Tạo chuỗi danh mục định mức
    let tableStr = '';
    if (itemsList.length > 0) {
      tableStr = `DANH SÁCH CHI TIẾT CÁC HẠNG MỤC BÁO GIÁ ĐỊNH MỨC:\n` +
                 `(Nguồn dữ liệu: ${quoteTitle.toUpperCase()})\n` +
                 `---------------------------------------------------------------------------------\n` +
                 itemsList.map((item, idx) => 
                   `${idx + 1}. Hạng mục: ${item.desc}\n` +
                   `   - Khối lượng: ${item.qty} ${item.unit} | Đơn giá ước tính: ${item.price.toLocaleString('vi-VN')} VNĐ\n` +
                   `   - Thành tiền tạm tính: ${(item.qty * item.price).toLocaleString('vi-VN')} VNĐ\n` +
                   `   - Chi tiết: ${item.note || 'Thi công tinh vững chãi theo tiêu chuẩn mẫu thợ'}`
                 ).join('\n\n') + 
                 `\n---------------------------------------------------------------------------------\n` +
                 `CỘNG TIỀN TRƯỚC THUẾ: ${itemsList.reduce((s, r) => s + (r.qty * r.price), 0).toLocaleString('vi-VN')} VNĐ\n` +
                 `TỔNG GIÁ TRỊ PHÁP QUY SAU THUẾ VAT (10%): ${Math.round(quoteValue).toLocaleString('vi-VN')} VNĐ`;
    } else {
      tableStr = `Chưa chọn báo giá thầu liên thông dữ liệu.`;
    }

    const todayStr = new Date().toLocaleDateString('vi-VN');

    if (toolType === 'contract') {
      if (templateId === 'mau_rut_gon') {
        return `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\n\nHỢP ĐỒNG KINH TẾ (THI CÔNG TIỂU MỤC RÚT GỌN)\nMã số dự án: HL-${selectedProject.code}/CON-ST\n\n- Căn cứ nhu cầu và nguyện vọng thi công mộc xưởng/thi công thô hai bên.\nHôm nay, ngày ${todayStr}, tại ${location}, gồm các bên đại diện:\n\nĐẠI DIỆN CHỦ ĐẦU TƯ (BÊN A):\n- Đại diện: Ông/Bà ${repA}\n- Chức vụ: ${posA}\n- Địa chỉ thường trú / thi công: ${selectedProject.address}\n- Điện thoại liên hệ: ${customer.phone || 'Chưa cập nhật'}\n\nĐẠI DIỆN ĐƠN VỊ THI CÔNG (BÊN B):\n- Đại diện: Ông ${repB}\n- Chức vụ: ${posB}\n- Đơn vị đại diện: HOÀNG LONG CONSTRUCTION & FURNITURE Co.\n\nHai bên đồng ý ký kết triển khai nhanh từng phần các hạng mục sau:\n\nĐIỀU 1. DANH MỤC THI CÔNG VÀ TIẾN ĐỘ\nBên B cam kết hoàn thiện bàn giao dọn dẹp sạch theo đúng dải báo giá chi tiết:\n\n${tableStr}\n\nĐIỀU 2. TRỊ GIÁ HỢP ĐỒNG VÀ THANH TOÁN\n- Tổng chi phí trọn gói dứt điểm của cam kết này là: ${Math.round(quoteValue).toLocaleString('vi-VN')} VNĐ (Đã bao gồm VAT).\n- Tạm ứng Giai đoạn 1: 50% trị giá ngay khi bắt đầu triển khai sản xuất phôi.\n- Thanh toán Giai đoạn 2: 50% trị giá còn lại ngay khi lắp ráp nghiệm thu hoàn chỉnh.\n\nĐIỀU 3. CHẾ ĐỘ BẢO HÀNH KỸ THUẬT\n- Bên B bảo trì bền bỉ, mộc dẻo dai chống mục sủi, kết cấu móng cột vững chắc liên tục trong ${warranty}.\n\nBiên bản lập thành 02 bản gồm trị giá tương ứng gốc lưu trữ số hóa an tâm.\n\nĐẠI DIỆN BÊN A                               ĐẠI DIỆN BÊN B\n(Ký và ghi rõ họ tên)                      (Ký tên và đóng dấu số đỏ)`;
      } else if (templateId === 'mau_thuong_mai') {
        return `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\n\nHỢP ĐỒNG THƯƠNG MẠI & SẢN XUẤT NỘI THẤT HOÀNG LONG\nSố thầu trực thuộc: HL-${selectedProject.code}/HDTM\n\n- Căn cứ Luật Thương mại nước Cộng hòa Xã hội Chủ nghĩa Việt Nam.\n- Căn cứ năng lực vận hành thực phẩm và dải định mức kỹ thuật hai bên.\n\nHôm nay, ngày ${todayStr}, tại ${location}, các bên bao gồm:\n\nĐẠI DIỆN BÊN MUA (BÊN A):\n- Đại diện: Ông/Bà ${repA}\n- Chức vụ: ${posA}\n- Địa chỉ tiếp nhận sản phẩm: ${selectedProject.address}\n- Khách hàng kết nối: ${customer.name} | Điện thoại: ${customer.phone || ''}\n\nĐẠI DIỆN BÊN CUNG CẤP (BÊN B):\n- Đại diện: Ông ${repB}\n- Chức vụ: ${posB}\n- Cơ sở thầu thợ: HOÀNG LONG CONSTRUCTION & FURNITURE Co.\n\nHai bên thống nhất điều khoản cung ứng mộc dán thô chi tiết như sau:\n\nĐIỀU I: DANH MỤC KHỐI LƯỢNG VÀ THÔNG SỐ VẬT TƯ\nBên B đồng ý xuất kho gia công liên kết và giao cho Bên A đúng thông số kỹ thuật định mức:\n\n${tableStr}\n\nĐIỀU II: TIẾN ĐỘ GIAO NHẬN VÀ LẮP TOÀN KHU\n- Thời gian bàn giao công trình thực tế dự kiến kịch trần trước ngày: ${selectedProject.endDate}.\n- Cơ sở hoàn công thanh quyết toán: ${selectedProject.address}.\n\nĐIỀU III: CHẤT LƯỢNG NGUYÊN LIỆU VÀ BẢO HÀNH\n- Bên B chịu trách nhiệm sản xuất phôi vách móng dầm mộc từ dòng vật liệu gỗ công nghiệp An Cường / thép kẽm mạ kẽm chất lượng chịu dẻo dai phẳng.\n- Thời gian bảo dưỡng công trình: ${warranty}.\n- Quá trình thi công được giám sát camera hành trình, bảo đảm an toàn thợ mộc.\n\nĐẠI DIỆN BÊN A                               ĐẠI DIỆN BÊN B\n(Ký và ghi rõ họ tên)                      (Đã ký điện tử & Đóng dấu số đỏ)`;
      } else {
        // mau_chuan (Hoàng Long Tiêu chuẩn)
        return `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\n--------------------------\n\nHỢP ĐỒNG KINH TẾ (THI CÔNG MỘC & VÁN DÂN)\nSố hiệu thầu: HL-${selectedProject.code}/CON\n\n- Căn cứ Bộ luật Dân sự nước Cộng hòa Xã hội Chủ nghĩa Việt Nam.\n- Căn cứ nhu cầu kiến thiết, trang hoàng thực tế của Chủ đầu tư tại Bảo Lộc, Lâm Đồng.\nHôm nay, ngày ${todayStr} tại ${location}, chúng tôi gồm các bên:\n\nĐẠI DIỆN BÊN A (CHỦ NHÀ):\n- Ông/Bà: ${repA}\n- Chức vụ: ${posA}\n- Địa chỉ thi công thực tế: ${selectedProject.address}\n- Khách hàng liên thông: ${customer.name}\n- Điện thoại liên hệ: ${customer.phone}\n\nĐẠI DIỆN BÊN B (NHÀ THẦU):\n- Ông: ${repB}\n- Chức vụ: ${posB}\n- Đại diện pháp lý phía thợ: HOÀNG LONG CONSTRUCTION & FURNITURE Co.\n- Địa chỉ: Văn phòng đại diện Hoàng Long, Bảo Lộc, Lâm Đồng.\n\nSau khi rà sát, hai bên nhất trí đồng thuận ký kết các điều khoản kinh tế vững chãi như sau:\n\nĐIỀU 1: NỘI DUNG THỰC HẠNG & CHI TIẾT KHỐI LƯỢNG BÁO GIÁ\nBên B nhận trách nhiệm sản xuất, lắp ráp hoàn thiện phôi dán tại vị trí ${selectedProject.address} đúng định mức chi tiết từ Báo giá thầu:\n\n${tableStr}\n\nĐIỀU 2: GIÁ TRỊ HỢP ĐỒNG VÀ PHƯƠNG THỨC QUYẾT TOÁN\n- Tổng giá trị thầu cố định của Hợp đồng này là: ${Math.round(quoteValue).toLocaleString('vi-VN')} VNĐ (Đã bao gồm VAT 10%).\n- Phân bổ dòng tiền thanh toán tiến độ:\n  + Đợt 1: Tạm ứng 35% trị giá ngay khi ký kết hợp đồng thầu mộc dẻo dai.\n  + Đợt 2: Tạm ứng 35% trị giá bổ sung khi tập kết đầy đủ các tấm nguyên vật liệu / thép cát xi măng đến chân công trình.\n  + Đợt 3: Quyết toán dứt điểm 30% trị giá còn lại ngay sau khi rà soát ký Biên bản Nghiệm thu bàn giao hoàn tất.\n\nĐIỀU 3: BIÊN THỜI HẠN HOÀN THÀNH & ĐIỀU KHOẢN BẢO HÀNH\n- Cam kết hoàn tất sạch bàn giao đưa vào sử dụng trước ngày: ${selectedProject.endDate}.\n- Bảo hành gỗ / công trình: Cam kết chống mục sủi liên tục trong ${warranty}.\n- Biên bản được lập làm 02 bản có giá trị rà soát ngang nhau.\n\nĐẠI DIỆN BÊN A                               ĐẠI DIỆN BÊN B\n(Ký và ghi rõ họ tên)                      (Đã ký điện tử & Đóng mộc số đỏ)`;
      }
    } else if (toolType === 'acceptance') {
      if (templateId === 'mau_rut_gon') {
        return `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\n\nBIÊN BẢN NGHIỆM THU TIẾN TRÌNH RÚT GỌN\nMã dự án: HL-${selectedProject.code}\n\n- Căn cứ Hợp đồng kinh tế dẻo dai số HL-${selectedProject.code}/CON.\n- Căn cứ kết quả khảo sát thực tế mộc xưởng bàn bàn giao hôm nay ngày ${todayStr}.\n\nChúng tôi tiến hành đo dạc bàn giao nghiệm thu từng phần:\nBên A (Chủ nhà): Ông/Bà ${repA}\nBên B (Nhà thầu): Ông ${repB}\n\nQua kiểm tra thước máy trực địa ghi nhận khối lượng tiến trình công việc đạt tỷ lệ nghiệm thu:\nTỷ lệ nghiệm thu tiến độ đạt: ${rate}%.\n\nKẾT LUẬN CHI TIẾT:\n- Đồng ý các dòng hạng mục lắp ráp mộc/xây thô đều đạt chuẩn khít phẳng.\n- Đồng ý thanh toán đợt giải ngân giai đoạn tương ứng dâng cao dòng tiền thầu.\n\nĐẠI DIỆN BÊN A                               ĐẠI DIỆN BÊN B\n(Ký và ghi rõ họ tên)                      (Đã ký điện tử mộc thợ)`;
      } else {
        // mau_chuan (Hoàng Long Tiêu chuẩn)
        return `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\n--------------------------\n\nBIÊN BẢN NGHIỆM THU HOÀN THÀNH TIẾN ĐỘ THI CÔNG KỸ THUẬT\nSố hiệu thầu: HL-${selectedProject.code}/ACC\n\n- Căn cứ Hợp đồng thi công số HL-${selectedProject.code}/CON hai bên đã giao thi.\n- Căn cứ quá trình rà sát đo mốc định mức dốc sức tại địa chỉ: ${selectedProject.address}.\n\nHôm nay, ngày ${todayStr}, chúng tôi rà sát thực tế gồm đại diện:\nBên A (Chủ nhà): Ông/Bà ${repA} - Chức vụ: ${posA}\nBên B (Nhà thầu): Ông ${repB} - Chức vụ: ${posB}\n\nNội dung rà soát chi tiết khối lượng so với định mức hạng mục từ Báo giá nguồn kết nối:\n\n${tableStr}\n\nHai bên trực tiếp đo dạc bằng thước máy ghi nhận tỷ lệ nghiệm thu đạt: ${rate}%\nNhận xét kỹ thuật:\n- Toàn bộ vách ván mộc dán khít bám dính siêu phẳng, khung cơ cấu vững chịu lực.\n- Khối lượng gạch xi măng móng xây trát dầm mài đều phẳng dọn dẹp sạch đúng khuôn.\n- Thợ mộc dốc mồ hôi lắp ráp tận tâm. Đạt tỷ lệ kỹ nghệ rà soát nghiệm thu đợt thầu.\n\nĐẠI DIỆN BÊN A                               ĐẠI DIỆN BÊN B\n(Đã ký số điện tử)                            (Đã ký số đỏ & Đóng dấu nhà thầu)`;
      }
    } else {
      // liquidation
      if (templateId === 'mau_rut_gon') {
        return `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\n\nBIÊN BẢN THANH LÝ QUYẾT TOÁN TIỂU MỤC RÚT GỌN\nDự án: HL-${selectedProject.code} - ${selectedProject.name}\n\nHôm nay, ngày ${todayStr}, tại ${location}, các bên gồm:\n\nBên A (Chủ đầu tư): Ông/Bà ${repA}\nBên B (Nhà thầu): Ông ${repB}\n\nHai bên xác nhận hoàn tất giao nhận chìa khóa sạch sẽ và dứt điểm mọi thủ tục thầu:\n\n1. Tổng giá trị quyết toán dứt điểm dọn dẹp sạch là: ${Math.round(quoteValue).toLocaleString('vi-VN')} VNĐ.\n2. Bên B bàn giao sạch, dọn mặt bằng sạch sẽ.\n3. Bên A hoàn tất chuyển nốt số dư dòng tiền tương ứng.\n4. Kích hoạt bảo hành bền vững dẻo dai mộc gỗ.\n\nĐẠI DIỆN BÊN A                               ĐẠI DIỆN BÊN B\n(Ký và ghi rõ họ tên)                      (Đã ký & Đóng dấu mộc đỏ)`;
      } else {
        // mau_chuan (Hoàng Long Tiêu chuẩn)
        return `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\n--------------------------\n\nBIÊN BẢN THANH LÝ & QUYẾT TOÁN CÔNG TRÌNH HOÀN THÀNH BIÊN NHẬN\nSố hiệu thầu: HL-${selectedProject.code}/LIQ\n\n- Căn cứ Hợp đồng kinh tế HL-${selectedProject.code}/CON bền bỉ.\n- Căn cứ kết quả khảo sát nghiệm thu đưa vào bàn giao hoàn công hôm nay ngày ${todayStr}.\n\nChúng tôi gồm các đại diện chính thức hai bên:\nBên A (Chủ nhà): Ông/Bà ${repA} - Chức vụ: ${posA}\nBên B (Nhà thầu): Ông ${repB} - Chức vụ: ${posB}\n\nĐỒNG LÒNG KÝ BIÊN BẢN QUYẾT TOÁN SẠCH SẼ VỚI CÁC ĐIỀU KHOẢN:\n\nĐIỀU 1: XÁC NHẬN HOÀN TẤT CHUYỂN GIAO\nBên B đã chuyển giao toàn bộ 100% tài sản mộc xưởng dán/mộc nền dầm cột móng cho bên B đạt chất lượng cao dựa trên định mức báo giá nguồn:\n\n${tableStr}\n\nĐIỀU 2: GIÁ TRỊ TỔNG QUYẾT TOÁN CHUNG CUỘC\n- Tổng giá trị thanh toán quyết toán dứt điểm là: ${Math.round(quoteValue).toLocaleString('vi-VN')} VNĐ (Không phát sinh thêm bất cứ hóa đơn nào).\n- Hình thức thanh khoản: Bên A chuẩn bị tài chính chuyển khoản nốt dư nợ hợp đồng còn lại trong vòng 03 ngày làm việc.\n\nĐIỀU 3: BẢO TRÌ BỀN VỮNG VÀ PHÁP LÝ\n- Bên B kích hoạt phiếu bảo hành mộc dẻo dai theo đúng dải hợp đồng lắp ráp.\n- Hai bên cam kết thanh lý hoàn thầu dứt điểm không tranh chấp lẫn nhau.\n\nĐẠI DIỆN BÊN A                               ĐẠI DIỆN BÊN B\n(Ký tên và ghi rõ họ tên)                  (Đã ký số đỏ & Đóng dấu thợ thầu)`;
      }
    }
  };

  // ===========================================================================
  // handleSyncDocumentText() → Đồng bộ text hồ sơ dự án vào Project.documents
  // ===========================================================================
  const handleSyncDocumentText = (
    toolType: 'contract' | 'acceptance' | 'liquidation',
    tempId: string,
    quoteId: string,
    repA: string,
    posA: string,
    repB: string,
    posB: string,
    warranty: string,
    location: string,
    rate: number
  ) => {
    const text = generateDocumentContent(
      toolType,
      tempId,
      quoteId,
      repA,
      posA,
      repB,
      posB,
      warranty,
      location,
      rate
    );
    setCtDocCustomText(text);
  };

  // Khởi tạo và đồng bộ hóa văn bản thầu tự động khi mở modal ban đầu đổi dự án
  useEffect(() => {
    if (selectedProject && (activeConnectedTool === 'contract' || activeConnectedTool === 'acceptance' || activeConnectedTool === 'liquidation')) {
      const cust = customers.find(c => c.id === selectedProject.customerId);
      const tempRepA = cust ? cust.name : 'Phan Văn Nam';
      setCtDocRepA(tempRepA);

      const hasDraft = ctQuoteRows && ctQuoteRows.length > 0;
      const savedQuotes = selectedProject.documents?.filter(d => d.type === 'quotation') || [];
      const tempQuoteId = hasDraft ? 'draft' : savedQuotes.length > 0 ? savedQuotes[0].id : 'none';
      setCtDocSelectedQuoteId(tempQuoteId);

      const tempTemplateId = 'mau_chuan';
      setCtDocTemplateId(tempTemplateId);

      const rate = activeConnectedTool === 'acceptance' ? selectedProject.progress || 100 : 100;
      setCtDocAcceptRate(rate);

      const initialTxt = generateDocumentContent(
        activeConnectedTool,
        tempTemplateId,
        tempQuoteId,
        tempRepA,
        ctDocPosA,
        ctDocRepB,
        ctDocPosB,
        ctDocWarranty,
        ctDocLocation,
        rate
      );
      setCtDocCustomText(initialTxt);
    }
  }, [activeConnectedTool, selectedProjectId]);


  useEffect(() => {
    setIsConfirmingDelete(false);
  }, [selectedProjectId]);

  // Project original info editing states for drawer
  const [editImage, setEditImage] = useState<string>('');
  const [editAddress, setEditAddress] = useState<string>('');
  const [editStartDate, setEditStartDate] = useState<string>('');
  const [editDuration, setEditDuration] = useState<number | ''>('');
  const [editContractValue, setEditContractValue] = useState<number>(0);
  const [editCustomerId, setEditCustomerId] = useState<string>('');
  const [editCardColor, setEditCardColor] = useState<string>('');
  const [isEditingDetails, setIsEditingDetails] = useState<boolean>(false);

  // ===========================================================================
  // handleCreateReceipt(isFinal) → Tạo phiếu thu (Receipt) từ giá trị hợp đồng còn lại
  // isFinal=true → thu toàn bộ phần còn lại, false → thu 50% phần còn lại
  // ===========================================================================
  const handleCreateReceipt = (isFinal: boolean) => {
    if (!selectedProject) return;
    const projectReceipts = receipts.filter(r => r.projectId === selectedProject.id);
    const totalReceived = projectReceipts.reduce((sum, r) => sum + (r.amount || 0), 0);
    
    let grandTotal = 0;
    if (latestArchivedQuote) {
      const rawTotal = latestArchivedQuote.totalAmount || latestArchivedQuote.totalPrice || latestArchivedQuote.items?.reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0) || 0;
      const discountPercent = latestArchivedQuote.discountPercent || 0;
      const discountValue = rawTotal * (discountPercent / 100);
      const subtotalAfterDiscount = rawTotal - discountValue;
      const vatAmount = Math.round(subtotalAfterDiscount * 0.08);
      grandTotal = subtotalAfterDiscount + vatAmount;
    } else {
      grandTotal = selectedProject.contractValue || editContractValue || 0;
    }
    
    const remainingValue = Math.max(0, grandTotal - totalReceived);
    const amountToCollect = isFinal ? remainingValue : Math.round(remainingValue * 0.5);
    
    const notes = isFinal 
      ? `Thu tiền quyết toán công trình: ${selectedProject.name}`
      : `Thu tiền tạm ứng công trình: ${selectedProject.name}`;

    // Store pre-filled values in localStorage
    localStorage.setItem('hl_prefill_receipt_project_id', selectedProject.id);
    localStorage.setItem('hl_prefill_receipt_customer_id', selectedProject.customerId || '');
    localStorage.setItem('hl_prefill_receipt_amount', amountToCollect.toString());
    localStorage.setItem('hl_prefill_receipt_notes', notes);

    // Dispatch custom switch tab event
    window.dispatchEvent(new CustomEvent('hl-switch-tab', {
      detail: {
        tab: 'finance',
        financeSubTab: 'nhap_thu'
      }
    }));
  };

  // ===========================================================================
  // resetEditProjectDetails() → Reset các edit state về giá trị gốc của selectedProject
  // ===========================================================================
  const resetEditProjectDetails = () => {
    if (selectedProject) {
      setEditImage(selectedProject.image || '');
      setEditAddress(selectedProject.address || '');
      setEditStartDate(selectedProject.startDate || '');
      setEditCardColor(selectedProject.cardColor || '');
      
      const savedDuration = (selectedProject as any).contractDuration;
      if (typeof savedDuration === 'number') {
        setEditDuration(savedDuration);
      } else {
        if (selectedProject.startDate && selectedProject.endDate && selectedProject.endDate.includes('-') && !selectedProject.endDate.includes('ngày')) {
          const s = new Date(selectedProject.startDate);
          const e = new Date(selectedProject.endDate);
          const diff = e.getTime() - s.getTime();
          const days = Math.round(diff / (1000 * 60 * 60 * 24));
          setEditDuration(days > 0 ? days : '');
        } else {
          // If the endDate has a duration string, extract number
          const match = selectedProject.endDate ? selectedProject.endDate.match(/^(\d+)/) : null;
          if (match) {
            setEditDuration(Number(match[1]));
          } else {
            setEditDuration('');
          }
        }
      }
      let finalVal = selectedProject.contractValue || 0;
      if (latestArchivedQuote) {
        const rawTotal = latestArchivedQuote.totalAmount || latestArchivedQuote.totalPrice || latestArchivedQuote.items?.reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0) || 0;
        const discountPercent = latestArchivedQuote.discountPercent || 0;
        const discountValue = rawTotal * (discountPercent / 100);
        const subtotalAfterDiscount = rawTotal - discountValue;
        const vatAmount = Math.round(subtotalAfterDiscount * 0.08); // 8% VAT
        finalVal = subtotalAfterDiscount + vatAmount;
      }
      setEditContractValue(finalVal);
      setEditCustomerId(selectedProject.customerId || '');
    }
  };

  useEffect(() => {
    resetEditProjectDetails();
    setIsEditingDetails(false);
  }, [selectedProjectId, projects]);

  // ===========================================================================
  // handleSaveProjectDetails() → Lưu chi tiết dự án đã chỉnh sửa (callback onUpdateProject)
  // ===========================================================================
  const handleSaveProjectDetails = () => {
    if (!selectedProject) return;
    
    let calculatedEndStr = '';
    if (editStartDate && editDuration) {
      const dt = new Date(editStartDate);
      dt.setDate(dt.getDate() + Number(editDuration));
      calculatedEndStr = dt.toISOString().split('T')[0];
    } else if (editDuration) {
      calculatedEndStr = `${editDuration} ngày`;
    } else if (selectedProject.endDate) {
      calculatedEndStr = selectedProject.endDate;
    }

    updateProjectWithRule(selectedProject.id, {
      image: editImage,
      address: editAddress,
      startDate: editStartDate,
      endDate: calculatedEndStr,
      contractDuration: editDuration || undefined,
      contractValue: editContractValue,
      customerId: editCustomerId,
      cardColor: editCardColor || '',
    } as any);

    setIsEditingDetails(false);
    addToast({ title: '✅ Thành công', message: '💾 Đã cập nhật và lưu trữ thông tin công trình thành công!', type: 'success' });
  };

  // 3.5. States for project creation modal in Kanban
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [newProjCustomer, setNewProjCustomer] = useState('');
  const [newProjType, setNewProjType] = useState<'construction' | 'furniture' | 'mechanical' | 'general'>(
    sector === 'furniture' ? 'furniture' : sector === 'mechanical' ? 'mechanical' : 'construction'
  );
  const [newProjValue, setNewProjValue] = useState(0); // Ẩn và mặc định là 0
  const [newProjPm, setNewProjPm] = useState('emp_3');
  const [newProjAddress, setNewProjAddress] = useState('');
  const [newProjStart, setNewProjStart] = useState(''); // Mặc định để trống hoàn toàn
  const [newProjDuration, setNewProjDuration] = useState<number | ''>(''); // Hạn hợp đồng tính theo ngày
  const [newProjNotes, setNewProjNotes] = useState('Tạo từ bảng Kanban.');
  const [newProjColumnId, setNewProjColumnId] = useState<string>('');

  // States for Quick Add Customer modal inside Kanban Box
  const [showQuickCustModal, setShowQuickCustModal] = useState(false);
  const [quickCustName, setQuickCustName] = useState('');
  const [quickCustPhone, setQuickCustPhone] = useState('');
  const [quickCustAddress, setQuickCustAddress] = useState('');
  const [quickCustType, setQuickCustType] = useState<'individual' | 'organization'>('individual');
  const [quickCustRep, setQuickCustRep] = useState('');
  const [quickCustTax, setQuickCustTax] = useState('');
  const [quickCustNotes, setQuickCustNotes] = useState('');

  const [prevCustId, setPrevCustId] = useState('');

  // Sync address from customer automatically but allow manual overrides
  useEffect(() => {
    if (newProjCustomer && newProjCustomer !== prevCustId) {
      const selectedCust = customers.find(c => c.id === newProjCustomer);
      if (selectedCust) {
        setNewProjAddress(selectedCust.address || '');
      }
      setPrevCustId(newProjCustomer);
    }
  }, [newProjCustomer, customers, prevCustId]);

  // ===========================================================================
  // openAddProjectModal(colId?) → Mở modal thêm dự án, gán cột mặc định nếu có colId
  // ===========================================================================
  const openAddProjectModal = (colId?: string) => {
    setNewProjName('');
    const defaultCustId = customers[0]?.id || '';
    setNewProjCustomer(defaultCustId);
    setPrevCustId(defaultCustId);
    setNewProjType(
      sector === 'furniture' ? 'furniture' : sector === 'mechanical' ? 'mechanical' : 'construction'
    );
    setNewProjValue(0); // Ẩn và mặc định 0
    setNewProjPm(employees.filter(e => e.role === 'pm' || e.role === 'director')[0]?.id || 'emp_3');
    setNewProjAddress(customers[0]?.address || '');
    setNewProjStart(''); // Mặc định để trống hoàn toàn
    setNewProjDuration(''); // Mặc định để trống
    setNewProjNotes('Tạo mới từ bảng Kanban.');
    setNewProjColumnId(colId || columns[0]?.id || 'col_design');
    setShowAddProjectModal(true);
  };

  // ===========================================================================
  // handleQuickAddCustomerSubmit() → Thêm nhanh khách hàng từ modal (callback onAddCustomer)
  // ===========================================================================
  const handleQuickAddCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCustName) return;

    const abbrev = getAbbrev(quickCustName);
    const orderIndex = customers.length + 1;
    const generatedId = `KH_${abbrev}_${orderIndex}`;

    const newCust: Customer = {
      id: generatedId,
      name: quickCustName,
      type: quickCustType,
      phone: quickCustPhone,
      email: `${abbrev.toLowerCase()}@example.com`,
      address: quickCustAddress,
      representative: quickCustRep,
      taxOrIdNumber: quickCustTax,
      notes: quickCustNotes
    };

    if (onAddCustomer) {
      onAddCustomer(newCust);
    } else {
      // Fallback
      customers.push(newCust);
    }

    // Connect to newly created customer
    setNewProjCustomer(generatedId);
    setPrevCustId(generatedId);
    setNewProjAddress(quickCustAddress);

    // Reset fields
    setQuickCustName('');
    setQuickCustPhone('');
    setQuickCustAddress('');
    setQuickCustType('individual');
    setQuickCustRep('');
    setQuickCustTax('');
    setQuickCustNotes('');

    setShowQuickCustModal(false);
  };

  // 4. Searching & Filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPmId, setSelectedPmId] = useState<string>('all');

  // Find selected project
  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const latestArchivedQuote = selectedProject
    ? (archivedQuotesList.find(q => q.projectId === selectedProject.id) || null)
    : null;

  // Filter projects by this sector (construction, furniture, mechanical) and search state
  const sectorProjects = projects.filter(p => {
    // Standard types mapped: construction, furniture, mechanical
    // If not matching directly, we can try to guess or let 'general' go into Construction
    const typeMatch = p.type === sector || (sector === 'construction' && p.type === 'general');
    const textMatch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.code.toLowerCase().includes(searchTerm.toLowerCase());
    const pmMatch = selectedPmId === 'all' || p.pmId === selectedPmId;
    return typeMatch && textMatch && pmMatch;
  });

  // Get project columns configuration (Default mapping if columnId is absent in project object)

  // ===========================================================================
  // updateProjectWithRule() → Cập nhật Project kèm kích hoạt automation của cột
  // Tự động: chuyển cột, tạo subtask, gán PM, phê duyệt, log comment vào Documents
  // Đây là hàm lõi điều phối các rule của KanbanColumn.automation
  // ===========================================================================
  const updateProjectWithRule = (projectId: string, updates: Partial<Project>, updatedTasksList?: Task[]) => {
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return;

    const finalStatus = updates.status !== undefined ? updates.status : proj.status;
    const finalProgress = updates.progress !== undefined ? updates.progress : proj.progress;
    const isCompleted = (finalStatus === 'completed') || (finalProgress === 100);
    
    let targetColId = updates.kanbanColumnId || getProjectColumnId(proj, columns);

    if (isCompleted) {
      const currentColId = updates.kanbanColumnId || getProjectColumnId(proj, columns);
      const currentCol = columns.find(c => c.id === currentColId);
      if (currentCol?.automation?.statusUpdate) {
        const autoTargetId = currentCol.automation.statusUpdate;
        if (autoTargetId && autoTargetId !== currentColId) {
          targetColId = autoTargetId;
          updates.kanbanColumnId = autoTargetId;
        }
      } else {
        if (currentColId !== 'col_done') {
          targetColId = 'col_done';
          updates.kanbanColumnId = 'col_done';
        }
      }
    }

    const originalColId = getProjectColumnId(proj, columns);
    if (updates.kanbanColumnId || targetColId !== originalColId) {
      const finalTargetColId = updates.kanbanColumnId || targetColId;
      const targetCol = columns.find(c => c.id === finalTargetColId);
      if (targetCol && finalTargetColId !== originalColId) {
        // Validation check for blocking tasks: Đang làm (doing), Chờ duyệt (reviewing), Trễ hạn (overdue)
        const projTasks = (updatedTasksList || tasks).filter(t => t.projectId === projectId);
        const blockingTasks = projTasks.filter(t => 
          t.status === 'doing' || t.status === 'reviewing' || t.status === 'overdue'
        );

        if (blockingTasks.length > 0) {
          const names = blockingTasks.map(t => {
            const statusStr = t.status === 'doing' ? 'Đang làm' : t.status === 'reviewing' ? 'Chờ duyệt' : 'Trễ hạn';
            return `- ${t.name} [#${t.code}] (${statusStr})`;
          }).join('\n');
          addToast({ title: '⚠️ Thông báo', message: `⚠️ Không thể di chuyển dự án "${proj.name}" sang phân đoạn "${targetCol.name}"!\n\nLý do: Vẫn còn công việc con chưa hoàn thành hoặc đang xử lý:\n${names}\n\nVui lòng hoàn tất hoặc giải quyết các công việc này trước khi chuyển giai đoạn.`, type: 'warning' });
          return;
        }

        // Auto-delete todo tasks ("Chưa làm")
        const todoTasks = projTasks.filter(t => t.status === 'todo');
        if (todoTasks.length > 0) {
          const todoIds = todoTasks.map(t => t.id);
          if (onDeleteMultipleTasks) {
            onDeleteMultipleTasks(todoIds);
          } else if (onDeleteTask) {
            todoIds.forEach(id => onDeleteTask(id));
          }
        }

        updates.kanbanColumnId = finalTargetColId;
        
        let ruleLogs: string[] = [];
        if (targetCol.automation) {
          const rule = targetCol.automation;

          // 1. Giao cho người thực hiện (Assign operator)
          if (rule.assignId) {
            updates.pmId = rule.assignId;
            const empName = employees.find(e => e.id === rule.assignId)?.name || 'Trưởng Dự Án mới';
            ruleLogs.push(`Giao cho PM phụ trách mới: ${empName}`);
          }

          // 2. Chuyển trạng thái công việc
          if (rule.statusUpdate) {
            updates.status = rule.statusUpdate as any;
            const statusLabel = rule.statusUpdate === 'active' ? 'Đang thực hiện' : rule.statusUpdate === 'completed' ? 'Hoàn thành' : rule.statusUpdate === 'suspended' ? 'Tạm khiển' : rule.statusUpdate;
            ruleLogs.push(`Chuyển trạng thái dự án sang: ${statusLabel}`);
          }

          // 2.2 Kiểu văn bản (In đậm, in nghiêng, gạch giữa, màu chữ)
          if (rule.textStyleStyleItalic !== undefined || rule.textStyleStyleBold !== undefined || rule.textStyleStyleStrike !== undefined || rule.textStyleStyleColor !== undefined) {
            updates.styleItalic = rule.textStyleStyleItalic;
            updates.styleBold = rule.textStyleStyleBold;
            updates.styleStrike = rule.textStyleStyleStrike;
            updates.styleColor = rule.textStyleStyleColor;
            ruleLogs.push(`Tự động định dạng kiểu chữ & màu sắc cho công trình`);
          }

          // 3. Gửi yêu cầu phê duyệt
          if (rule.approvalRole && rule.approvalRole !== 'none') {
            const roleLabel = rule.approvalRole === 'director' ? 'Giám Đốc (Trương Hữu Long)' : rule.approvalRole === 'accountant' ? 'Kế Toán trưởng (Lê Thị Mai)' : 'PM chuyên trách';
            ruleLogs.push(`Yêu cầu trình duyệt cấp: ${roleLabel}`);
          }

          // 6. Thêm công việc con (Hỗ trợ tối đa 5 công việc con)
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
              
              const assigneeId = subtaskAuto.assignId || rule.assignId || proj.pmId || 'emp_3';
              const involvedEmployeeIds = Array.from(new Set([
                ...(proj.involvedEmployeeIds || []),
                ...(rule.involvedId ? [rule.involvedId] : []),
                ...(subtaskAuto.involvedId ? [subtaskAuto.involvedId] : []),
                ...(subtaskAuto.involvedEmployeeIds || [])
              ]));

              // Send approval request
              let approvals = undefined;
              if (subtaskAuto.isApprovalEnabled === true) {
                const defaultApproverEmp = subtaskAuto.defaultApproverId ? employees.find(e => e.id === subtaskAuto.defaultApproverId) : null;
                const approverId = defaultApproverEmp ? defaultApproverEmp.id : (subtaskAuto.approvalRole === 'director' ? 'emp_1' : subtaskAuto.approvalRole === 'accountant' ? 'emp_2' : (proj.pmId || 'emp_3'));
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
                projectId: projectId,
                columnId: targetCol.id,
                name: title,
                description: `Công việc con được tạo tự động bởi quy trình khi di chuyển vào phân đoạn ${targetCol.name}. ${subtaskAuto.docTitle ? 'Yêu cầu lập hồ sơ thiết kế kèm theo.' : ''}`,
                assignerId: 'system',
                assigneeId: assigneeId,
                involvedEmployeeIds: involvedEmployeeIds,
                department: 'Thi công',
                deadline: new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                priority: 'medium',
                status: 'todo',
                completionRate: 0,
                //notes: 'Nhiệm vụ tự trị Hoàng Long vách mộc',
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
                isSubcontractorEnabled: subtaskAuto.isSubcontractorEnabled === true,
                defaultApproverId: subtaskAuto.defaultApproverId,
                costApproverId: subtaskAuto.costApproverId,
                costSettlerId: subtaskAuto.costSettlerId,
                isMaterialSelfCoordinated: subtaskAuto.isMaterialSelfCoordinated,
                materialCoordinatorId: subtaskAuto.materialCoordinatorId,
                subcontractorApproverId: subtaskAuto.subcontractorApproverId,
                subcontractorSettlerId: subtaskAuto.subcontractorSettlerId
              };
              onAddTask(autoTask);

              // Thiết kế Hồ sơ
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
                if (!updates.documents) {
                  updates.documents = [...(proj.documents || [])];
                }
                updates.documents.push(subtaskDoc);
              }
            });
            ruleLogs.push(`Tự động bổ nhiệm ${tasksToAdd.length} công việc con:\n` + tasksToAdd.map(t => `- "${t}"`).join('\n'));
          }

          // 8. Thêm checklist
          if (rule.checklistTexts && rule.checklistTexts.length > 0) {
            const chkItems = rule.checklistTexts.filter(chk => chk && chk.trim());
            if (chkItems.length > 0) {
              ruleLogs.push(`Thêm các mục checklist yêu cầu:\n` + chkItems.map(chk => `- ${chk}`).join('\n'));
            }
          } else if (rule.checklistText) {
            ruleLogs.push(`Thêm mục checklist yêu cầu: ${rule.checklistText}`);
          }

          // 9. Thêm người liên quan (Cộng sự bám sát)
          const ruleInvolvedIds = rule.involvedEmployeeIds || (rule.involvedId ? [rule.involvedId] : []);
          if (ruleInvolvedIds.length > 0) {
            const currentInvolved = proj.involvedEmployeeIds || [];
            const addedIds = ruleInvolvedIds.filter(id => !currentInvolved.includes(id));
            if (addedIds.length > 0) {
              updates.involvedEmployeeIds = [...currentInvolved, ...addedIds];
              const names = addedIds.filter(Boolean).map(id => employees.find(e => e.id === id)?.name || 'Người hỗ trợ').join(', ');
              ruleLogs.push(`Thêm cộng sự hỗ trợ liên quan: ${names}`);
            }
          }

          // Fallback log
          if (ruleLogs.length === 0 && rule.type && rule.type !== 'none') {
            if (rule.type === 'auto_progress') {
              updates.progress = Number(rule.param) || 50;
              ruleLogs.push(`Cột tự động đặt tiến độ lên ${rule.param}%`);
            } else if (rule.type === 'auto_pm') {
              updates.pmId = String(rule.param) || 'emp_3';
              const empName = employees.find(e => e.id === rule.param)?.name || 'Người dùng';
              ruleLogs.push(`Cột tự động đổi PM phụ trách sang: ${empName}`);
            } else if (rule.type === 'auto_complete') {
              updates.status = 'completed';
              updates.progress = 100;
              ruleLogs.push(`Cột tự động chuyển trạng thái hoàn thành (100%)`);
            } else if (rule.type === 'auto_approval') {
              ruleLogs.push(`Yêu cầu tự động tạo quy trình phê duyệt cấp ${rule.param === 'director' ? 'Giám Đốc' : 'Trực tiếp'}`);
            } else if (rule.type === 'auto_comment') {
              ruleLogs.push(`Bộ kích hoạt ghi chú tự động chuyển mục.`);
            }
          }
        }

        const ruleLogged = ruleLogs.join('. ') || '';
        const autoComment: ProjectDoc = {
          id: `log_${Date.now()}`,
          type: 'acceptance',
          name: `Di chuyển sang cột : ${targetCol.name}`,
          code: `XN-${Math.floor(Math.random() * 900) + 100}`,
          createdAt: new Date().toISOString().split('T')[0],
          status: 'approved',
          templateName: 'Hệ thống tự động hóa',
          customFields: [
            { label: 'Hành động', value: `Di chuyển cột [${targetCol.name}]` },
            { label: 'Tự động kích hoạt', value: ruleLogged || 'Không có quy tắc áp dụng' }
          ]
        };

        const existingDocs = proj.documents || [];
        updates.documents = [...existingDocs, autoComment];

        if (ruleLogged) {
          // Tự động kích hoạt quy trình đã được ghi nhận vào tài liệu dự án (autoComment) ở trên.
        }
      }
    }
    onUpdateProject(projectId, updates);
  };

  // ===========================================================================
  // localUpdateTask() → Cập nhật Task qua callback onUpdateTask rồi đồng bộ local state tasks
  // ===========================================================================
  const localUpdateTask = (taskId: string, taskUpdates: Partial<Task>) => {
    // Call original prop - automation is now handled centrally in App.tsx
    onUpdateTask(taskId, taskUpdates);
  };

  // Drag operations
  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);

  // ===========================================================================
  // Drag & Drop handlers (Kéo thả thẻ dự án giữa các cột)
  // ===========================================================================
  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (!canMoveCard) {
      e.preventDefault();
      addToast({ title: '⛔ Không có quyền', message: 'Tài khoản của bạn không có quyền DI CHUYỂN thẻ dự án (không thể kéo thả).', type: 'error' });
      return;
    }
    setDraggedProjectId(id);
    e.dataTransfer.setData('text/plain', id);
  };

  // handleDrop() → Khi thả thẻ vào cột đích, gọi moveProjectToColumn
  const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggedProjectId;
    if (!id) return;

    // Move card
    moveProjectToColumn(id, targetColumnId);
    setDraggedProjectId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Moving logic that delegates to the centralized update function
  // moveProjectToColumn() → Di chuyển project sang column (gọi updateProjectWithRule với kanbanColumnId)
  const moveProjectToColumn = (projectId: string, columnId: string) => {
    updateProjectWithRule(projectId, { kanbanColumnId: columnId });
  };

  // Open Column Editing dialogue
  // ===========================================================================
  // CÁC HÀM QUẢN LÝ CỘT KANBAN (Column management)
  // ===========================================================================
  const openEditColumn = (col: KanbanColumn) => {
    setEditingColumnId(col.id);
    setEditColName(col.name);
    setEditColColor(col.color);
    setEditColRuleType(col.automation?.type || 'none');
    setEditColRuleParam(String(col.automation?.param || ''));
  };

  // updateColProperty() → Cập nhật thuộc tính cơ bản của cột (name/color/...)
  const updateColProperty = (colId: string, updates: Partial<KanbanColumn>) => {
    const updated = columns.map(c => {
      if (c.id === colId) {
        return { ...c, ...updates };
      }
      return c;
    });
    saveColumns(updated);
  };

  // updateColAutomation() → Cập nhật automation của cột (kết hợp với current automation)
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

  // saveColumnSettings() → Lưu cài đặt cột đang edit (dùng các reducer từ kanbanLogic)
  const saveColumnSettings = () => {
    if (!editingColumnId || !editColName.trim()) return;

    const updated = columns.map(c => {
      if (c.id === editingColumnId) {
        return {
          ...c,
          name: editColName.toUpperCase(),
          color: editColColor,
          automation: {
            type: editColRuleType as any,
            param: editColRuleType === 'auto_progress' ? Number(editColRuleParam) : editColRuleParam
          }
        };
      }
      return c;
    });

    saveColumns(updated);
    setEditingColumnId(null);
  };

  // addNewColumn() → Thêm cột mới (dùng addColumnReducer), lưu và đóng modal
  const addNewColumn = () => {
    const newId = `col_custom_${Date.now()}`;
    const newCol: KanbanColumn = {
      id: newId,
      name: 'BƯỚC CẢI TIẾN MỚI',
      color: 'bg-slate-700',
      iconColor: 'text-slate-400',
      automation: { type: 'none' }
    };
    const updated = [...columns, newCol];
    saveColumns(updated);
    openEditColumn(newCol);
  };

  // deleteColumn(id) → Xóa cột (dùng deleteColumnReducer), lưu và reset state edit
  const deleteColumn = (id: string) => {
    const colName = columns.find(c => c.id === id)?.name || '';
    setConfirmDialog({
      title: 'Xóa cột phân đoạn',
      message: `Bạn có chắc chắn muốn xóa cột phân đoạn [${colName}] này? Các công trình thuộc cột này sẽ tự động chuyển về cột mặc định đầu tiên.`,
      onConfirm: () => {
        saveColumns(columns.filter(c => c.id !== id));
      },
      confirmText: 'Xác nhận xóa'
    });
  };

  // Sub-task (Công việc con) dynamic generation
  const [subTaskName, setSubTaskName] = useState('');
  const [subTaskAssignee, setSubTaskAssignee] = useState('emp_4');
  const [subTaskDeadline, setSubTaskDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    d.setHours(12, 0, 0, 0);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });
  const [subTaskPriority, setSubTaskPriority] = useState<TaskPriority>('medium');
  const [showSubtaskForm, setShowSubtaskForm] = useState(false);
  const [subTaskInvolved, setSubTaskInvolved] = useState<string[]>([]);
  const [subTaskIsApprovalEnabled, setSubTaskIsApprovalEnabled] = useState(false);
  const [subTaskIsCostEnabled, setSubTaskIsCostEnabled] = useState(false);
  const [subTaskIsMaterialEnabled, setSubTaskIsMaterialEnabled] = useState(false);
  const [subTaskIsDocGenerationEnabled, setSubTaskIsDocGenerationEnabled] = useState(false);
  const [subTaskSubcontractorEnabled, setSubTaskSubcontractorEnabled] = useState(false);
  const [subTaskSubcontractorId, setSubTaskSubcontractorId] = useState('');
  const [subTaskSubcontractorName, setSubTaskSubcontractorName] = useState('');
  const [subTaskDefaultApproverId, setSubTaskDefaultApproverId] = useState('');
  const [subTaskCostApproverId, setSubTaskCostApproverId] = useState('');
  const [subTaskCostSettlerId, setSubTaskCostSettlerId] = useState('');
  const [subTaskMaterialSelfCoordinated, setSubTaskMaterialSelfCoordinated] = useState(false);
  const [subTaskMaterialCoordinatorId, setSubTaskMaterialCoordinatorId] = useState('');
  const [subTaskSubcontractorApproverId, setSubTaskSubcontractorApproverId] = useState('');
  const [subTaskSubcontractorSettlerId, setSubTaskSubcontractorSettlerId] = useState('');
  // Đầu mục đo kiểm / Checklist kỹ thuật (công việc con)
  const [subTaskChecklistTexts, setSubTaskChecklistTexts] = useState<string[]>([]);

  // Additional subtask form states for synchronized linkage
  const [subTaskAssignerId, setSubTaskAssignerId] = useState(currentUser?.id || '');
  const [subTaskAssigneeId, setSubTaskAssigneeId] = useState('emp_4');

  // States and variables for editing an existing sub-task
  const [editingSubTask, setEditingSubTask] = useState<Task | null>(null);
  const [editSubName, setEditSubName] = useState('');
  const [editSubDeadline, setEditSubDeadline] = useState('');
  const [editSubPriority, setEditSubPriority] = useState<TaskPriority>('medium');
  const [editSubAssignerId, setEditSubAssignerId] = useState('');
  const [editSubAssigneeId, setEditSubAssigneeId] = useState('');
  const [editSubIsApprovalEnabled, setEditSubIsApprovalEnabled] = useState(false);
  const [editSubIsCostEnabled, setEditSubIsCostEnabled] = useState(false);
  const [editSubIsMaterialEnabled, setEditSubIsMaterialEnabled] = useState(false);
  const [editSubIsDocGenerationEnabled, setEditSubIsDocGenerationEnabled] = useState(false);
  const [editSubSubcontractorEnabled, setEditSubSubcontractorEnabled] = useState(false);
  const [editSubDefaultApproverId, setEditSubDefaultApproverId] = useState('');
  const [editSubCostApproverId, setEditSubCostApproverId] = useState('');
  const [editSubCostSettlerId, setEditSubCostSettlerId] = useState('');
  const [editSubMaterialSelfCoordinated, setEditSubMaterialSelfCoordinated] = useState(false);
  const [editSubMaterialCoordinatorId, setEditSubMaterialCoordinatorId] = useState('');
  const [editSubSubcontractorApproverId, setEditSubSubcontractorApproverId] = useState('');
  const [editSubSubcontractorSettlerId, setEditSubSubcontractorSettlerId] = useState('');
  const [editSubSubcontractorId, setEditSubSubcontractorId] = useState('');
  const [editSubSubcontractorName, setEditSubSubcontractorName] = useState('');
  const [editSubInvolved, setEditSubInvolved] = useState<string[]>([]);
  // Đầu mục đo kiểm / Checklist kỹ thuật (sửa công việc con)
  const [editSubChecklistTexts, setEditSubChecklistTexts] = useState<string[]>([]);
  
  // Track open menu for subtask cards
  const [openMenuTaskId, setOpenMenuTaskId] = useState<string | null>(null);

  // ===========================================================================
  // CÁC HÀM QUẢN LÝ CÔNG VIỆC CON (Subtask)
  // ===========================================================================
  const handleStartEditSubTask = (task: Task) => {
    setEditingSubTask(task);
    setEditSubName(task.name);
    setEditSubDeadline(task.deadline || '');
    setEditSubPriority(task.priority || 'medium');
    setEditSubAssignerId(task.assignerId || '');
    setEditSubAssigneeId(task.assigneeId || '');
    setEditSubIsApprovalEnabled(task.isApprovalEnabled === true);
    setEditSubIsCostEnabled(task.isCostEnabled === true);
    setEditSubIsMaterialEnabled(task.isMaterialEnabled === true);
    setEditSubIsDocGenerationEnabled(task.isDocGenerationEnabled === true);
    setEditSubSubcontractorEnabled(!!task.isSubcontractorEnabled);
    setEditSubSubcontractorId(task.subcontractorId || '');
    setEditSubSubcontractorName(task.subcontractorName || '');
    setEditSubInvolved(task.involvedEmployeeIds || []);
    setEditSubDefaultApproverId(task.defaultApproverId || '');
    setEditSubCostApproverId(task.costApproverId || '');
    setEditSubCostSettlerId(task.costSettlerId || '');
    setEditSubMaterialSelfCoordinated(!!task.isMaterialSelfCoordinated);
    setEditSubMaterialCoordinatorId(task.materialCoordinatorId || '');
    setEditSubSubcontractorApproverId(task.subcontractorApproverId || '');
    setEditSubSubcontractorSettlerId(task.subcontractorSettlerId || '');
    setEditSubChecklistTexts(task.checklistTexts || []);
    setOpenMenuTaskId(null);
  };

  // handleSaveEditSubTask() → Lưu subtask đã chỉnh sửa (gọi localUpdateTask)
  const handleSaveEditSubTask = () => {
    if (!editingSubTask) return;
    if (!canEditTask) {
      addToast({ title: '⛔ Không có quyền', message: 'Tài khoản của bạn không có quyền SỬA công việc con.', type: 'error' });
      return;
    }

    // Validate required fields
    if (!editSubDeadline) {
      addToast({ title: '⛔ Thiếu thông tin', message: 'Vui lòng nhập Thời hạn (Deadline) cho công việc con.', type: 'error' });
      return;
    }
    if (!editSubAssignerId) {
      addToast({ title: '⛔ Thiếu thông tin', message: 'Vui lòng chọn Người giao việc.', type: 'error' });
      return;
    }
    if (!editSubAssigneeId) {
      addToast({ title: '⛔ Thiếu thông tin', message: 'Vui lòng chọn Người thi hành chính.', type: 'error' });
      return;
    }
    // Conditional validation for approval
    if (editSubIsApprovalEnabled && !editSubDefaultApproverId) {
      addToast({ title: '⛔ Thiếu thông tin', message: 'Khi bật Cấu hình Quy trình Phê duyệt, vui lòng chọn Người phê duyệt mặc định.', type: 'error' });
      return;
    }
    // Conditional validation for cost
    if (editSubIsCostEnabled) {
      if (!editSubCostApproverId) {
        addToast({ title: '⛔ Thiếu thông tin', message: 'Khi bật Cấu hình Đề xuất chi phí, vui lòng chọn Người xét duyệt mặc định.', type: 'error' });
        return;
      }
      if (!editSubCostSettlerId) {
        addToast({ title: '⛔ Thiếu thông tin', message: 'Khi bật Cấu hình Đề xuất chi phí, vui lòng chọn Người quyết toán mặc định.', type: 'error' });
        return;
      }
    }
    // Conditional validation for subcontractor
    if (editSubSubcontractorEnabled) {
      if (!editSubSubcontractorId) {
        addToast({ title: '⛔ Thiếu thông tin', message: 'Khi bật Cấu hình Liên kết Thầu phụ, vui lòng chọn Thầu Phụ từ Dữ Liệu Kế Toán.', type: 'error' });
        return;
      }
      if (!editSubSubcontractorApproverId) {
        addToast({ title: '⛔ Thiếu thông tin', message: 'Khi bật Cấu hình Liên kết Thầu phụ, vui lòng chọn Người xét duyệt mặc định.', type: 'error' });
        return;
      }
      if (!editSubSubcontractorSettlerId) {
        addToast({ title: '⛔ Thiếu thông tin', message: 'Khi bật Cấu hình Liên kết Thầu phụ, vui lòng chọn Người quyết toán mặc định.', type: 'error' });
        return;
      }
    }

    const finalInvolved = editSubInvolved.filter(id => id !== editSubAssigneeId);
    
    const updates: Partial<Task> = {
      name: editSubName,
      deadline: editSubDeadline,
      priority: 'medium', // Default priority since field was removed
      assignerId: editSubAssignerId,
      assigneeId: editSubAssigneeId,
      involvedEmployeeIds: finalInvolved,
      isApprovalEnabled: editSubIsApprovalEnabled,
      isApprovalRequired: editSubIsApprovalEnabled,
      isCostEnabled: editSubIsCostEnabled,
      isMaterialEnabled: editSubIsMaterialEnabled,
      isDocGenerationEnabled: editSubIsDocGenerationEnabled,
      isSubcontractorEnabled: editSubSubcontractorEnabled,
      subcontractorId: editSubSubcontractorEnabled ? editSubSubcontractorId : undefined,
      subcontractorName: editSubSubcontractorEnabled ? editSubSubcontractorName : undefined,
      defaultApproverId: editSubDefaultApproverId || undefined,
      costApproverId: editSubCostApproverId || undefined,
      costSettlerId: editSubCostSettlerId || undefined,
      isMaterialSelfCoordinated: editSubMaterialSelfCoordinated || undefined,
      materialCoordinatorId: editSubMaterialCoordinatorId || undefined,
      subcontractorApproverId: editSubSubcontractorApproverId || undefined,
      subcontractorSettlerId: editSubSubcontractorSettlerId || undefined,
      checklistTexts: editSubChecklistTexts.length > 0 ? [...editSubChecklistTexts] : undefined,
    };

    onUpdateTask(editingSubTask.id, updates);
    setEditingSubTask(null);
  };

  // handleAddSubTask() → Thêm subtask mới vào dự án (callback onAddTask)
  const handleAddSubTask = () => {
    if (!selectedProject || !subTaskName.trim()) return;

    // Validate required fields
    if (!subTaskDeadline) {
      addToast({ title: '⛔ Thiếu thông tin', message: 'Vui lòng nhập Thời hạn (Deadline) cho công việc con.', type: 'error' });
      return;
    }
    if (!subTaskAssignerId) {
      addToast({ title: '⛔ Thiếu thông tin', message: 'Vui lòng chọn Người giao việc.', type: 'error' });
      return;
    }
    if (!subTaskAssigneeId) {
      addToast({ title: '⛔ Thiếu thông tin', message: 'Vui lòng chọn Người thi hành chính (Phụ trách chính).', type: 'error' });
      return;
    }
    // Conditional validation for approval
    if (subTaskIsApprovalEnabled && !subTaskDefaultApproverId) {
      addToast({ title: '⛔ Thiếu thông tin', message: 'Khi bật Cấu hình Quy trình Phê duyệt, vui lòng chọn Người phê duyệt mặc định.', type: 'error' });
      return;
    }
    // Conditional validation for cost
    if (subTaskIsCostEnabled) {
      if (!subTaskCostApproverId) {
        addToast({ title: '⛔ Thiếu thông tin', message: 'Khi bật Cấu hình Đề xuất chi phí, vui lòng chọn Người xét duyệt mặc định.', type: 'error' });
        return;
      }
      if (!subTaskCostSettlerId) {
        addToast({ title: '⛔ Thiếu thông tin', message: 'Khi bật Cấu hình Đề xuất chi phí, vui lòng chọn Người quyết toán mặc định.', type: 'error' });
        return;
      }
    }
    // Conditional validation for subcontractor
    if (subTaskSubcontractorEnabled) {
      if (!subTaskSubcontractorId) {
        addToast({ title: '⛔ Thiếu thông tin', message: 'Khi bật Cấu hình Liên kết Thầu phụ, vui lòng chọn Thầu Phụ từ Dữ Liệu Kế Toán.', type: 'error' });
        return;
      }
      if (!subTaskSubcontractorApproverId) {
        addToast({ title: '⛔ Thiếu thông tin', message: 'Khi bật Cấu hình Liên kết Thầu phụ, vui lòng chọn Người xét duyệt mặc định.', type: 'error' });
        return;
      }
      if (!subTaskSubcontractorSettlerId) {
        addToast({ title: '⛔ Thiếu thông tin', message: 'Khi bật Cấu hình Liên kết Thầu phụ, vui lòng chọn Người quyết toán mặc định.', type: 'error' });
        return;
      }
    }

    // Create a real Task in global state matching the design
    const codeNum = tasks.length + 1;
    const paddingCode = codeNum < 10 ? `00${codeNum}` : codeNum < 100 ? `0${codeNum}` : `${codeNum}`;
    
    // Filter out assignee if they are somehow added in the involved list
    const finalInvolved = subTaskInvolved.filter(id => id !== subTaskAssigneeId);

    const childTask: Task = {
      id: `task_child_${Date.now()}`,
      code: `CV-${paddingCode}`,
      projectId: selectedProject.id,
      columnId: selectedProject.kanbanColumnId || getProjectColumnId(selectedProject, columns),
      name: subTaskName,
      description: `Kiểm tra, gia công và giám sát hạng mục [${subTaskName}] cho công trình ${selectedProject.name}. Đảm bảo chất lượng nghiệm thu.`,
      // Người Giao Việc = người khởi tạo (currentUser) hoặc người được chọn trong dropdown "Người giao việc" của form "Khai việc con mới".
      // KHÔNG liên kết với Trưởng Dự Án (pmId) của Chi tiết Dự Án.
      assignerId: subTaskAssignerId || currentUser?.id || 'emp_1',
      assigneeId: subTaskAssigneeId,
      department: sector === 'construction' ? 'Kỹ Thuật Xây Dựng' : sector === 'furniture' ? 'Phòng Dự Án - Nội Thất' : 'Tổ Xưởng Cơ Khí',
      deadline: subTaskDeadline,
      priority: 'medium', // Default priority since field was removed
      status: 'todo',
      completionRate: 0,
      
      // Configuration for automations
      involvedEmployeeIds: finalInvolved,
      isApprovalEnabled: subTaskIsApprovalEnabled,
      isApprovalRequired: subTaskIsApprovalEnabled,
      isCostEnabled: subTaskIsCostEnabled,
      isMaterialEnabled: subTaskIsMaterialEnabled,
      isDocGenerationEnabled: subTaskIsDocGenerationEnabled,
      isSubcontractorEnabled: subTaskSubcontractorEnabled,
      subcontractorId: subTaskSubcontractorEnabled ? subTaskSubcontractorId : undefined,
      subcontractorName: subTaskSubcontractorEnabled ? subTaskSubcontractorName : undefined,
      defaultApproverId: subTaskDefaultApproverId || undefined,
      costApproverId: subTaskCostApproverId || undefined,
      costSettlerId: subTaskCostSettlerId || undefined,
      isMaterialSelfCoordinated: subTaskMaterialSelfCoordinated || undefined,
      materialCoordinatorId: subTaskMaterialCoordinatorId || undefined,
      subcontractorApproverId: subTaskSubcontractorApproverId || undefined,
      subcontractorSettlerId: subTaskSubcontractorSettlerId || undefined,
      checklistTexts: subTaskChecklistTexts.length > 0 ? [...subTaskChecklistTexts] : undefined,

      // 1. DỮ LIỆU ĐỒNG BỘ: QUY TRÌNH DUYỆT NHIỀU CẤP ("VÕ VĂN NAM -> PHẠM ANH TUẤN -> TRƯƠNG HỮU LONG")
      approvals: [
        {
          id: `app_sub_c1_${Date.now()}`,
          levelName: "Cấp 1: Phụ Trách Công Việc cam kết chất lượng thô",
          approverId: subTaskAssigneeId, // Người làm tự nhận lỗi thô
          status: 'pending' as const
        },
        {
          id: `app_sub_c2_${Date.now()}`,
          levelName: "Cấp 2: Quản lý kỹ thuật (PM) kiểm chuẩn dung sai",
          approverId: selectedProject.pmId || 'emp_3', // PM
          status: 'pending' as const
        },
        {
          id: `app_sub_c3_${Date.now()}`,
          levelName: "Cấp 3: Giám Đốc Trương Hữu Long chốt đạt nghiệm thu gốc",
          approverId: 'emp_1', // Long (Director)
          status: 'pending' as const
        }
      ],

      // 2. DỮ LIỆU ĐỒNG BỘ: NHẬT KÝ KHAI TẠO đã được thay thế bằng chat (postTaskChat) ở dưới.

      // 3. ĐỀ XUẤT TÀI CHÍNH: để trống, người dùng tự tạo khi cần
      advanceRequests: [],

      comments: [],
      timeLogs: []
    };

    onAddTask(childTask);

    // 🤖 Auto-post to task chat group (người gửi = người thao tác)
    const members: string[] = [
      currentUser?.id,
      childTask.assignerId,
      childTask.assigneeId,
      ...(childTask.involvedEmployeeIds || []),
      selectedProject.pmId
    ].filter((v): v is string => Boolean(v));
    postTaskChat(
      childTask.id,
      currentUser?.id || 'emp_1',
      currentUser?.name || 'Người dùng',
      currentUser?.role || 'member',
      `🆕 ${currentUser?.name || 'Người dùng'} đã tạo công việc con: "${subTaskName}" cho dự án "${selectedProject.name}".`,
      members,
      subTaskName,
      selectedProject.name
    );

    // Mở ngay lập tức giao diện chi tiết công việc của công việc con vừa được tạo
    setOverlayTaskId(childTask.id);

    // Reset and close
    setSubTaskName('');
    setSubTaskAssignerId(currentUser?.id || '');
    setSubTaskAssigneeId('emp_4');
    setSubTaskInvolved([]);
    setSubTaskIsApprovalEnabled(false);
    setSubTaskIsCostEnabled(false);
    setSubTaskIsMaterialEnabled(false);
    setSubTaskIsDocGenerationEnabled(false);
    setSubTaskSubcontractorEnabled(false);
    setSubTaskSubcontractorId('');
    setSubTaskSubcontractorName('');
    setSubTaskDefaultApproverId('');
    setSubTaskCostApproverId('');
    setSubTaskCostSettlerId('');
    setSubTaskMaterialSelfCoordinated(false);
    setSubTaskMaterialCoordinatorId('');
    setSubTaskSubcontractorApproverId('');
    setSubTaskSubcontractorSettlerId('');
    setSubTaskChecklistTexts([]);
    setShowSubtaskForm(false);
  };

  // Financial statistics from receipts & payments
  // ===========================================================================
  // getProjBudget() → Tính thu (receipts) và chi (payments approved) của dự án
  // ===========================================================================
  const getProjBudget = (pId: string) => {
    const inComes = receipts.filter(r => r.projectId === pId).reduce((sum, r) => sum + r.amount, 0);
    const outComes = payments.filter(p => p.projectId === pId && p.status === 'approved').reduce((sum, p) => sum + p.amount, 0);
    return { inComes, outComes, profit: inComes - outComes };
  };

  // AI assistant simulation based on sector and project name
  // ===========================================================================
  // getAISuggestions() → Trả về gợi ý text mô phỏng AI cho dự án (hard-coded suggestions)
  // ===========================================================================
  const getAISuggestions = (pName: string) => {
    if (sector === 'construction') {
      return [
        'Khảo sát địa chất thô móng biệt thự và kiểm định độ lún ép cọc ly tâm.',
        'Ký cam kết an toàn lao động giàn giáo cao mét ngoài thực địa.',
        'Lập bảng đề xuất cấp dầm thép Mac bê tông 250 thạch cao đóng trần.'
      ];
    } else if (sector === 'furniture') {
      return [
        'Vào sổ kho cắt ván dán chỉ cạnh Acrylic không đường line tủ bếp trên.',
        'Chốt phụ kiện ray âm giảm chấn Hafele / Blum và pít-tông bật cánh cánh lật.',
        'Khảo sát thực địa khoang chứa tủ lạnh Side-by-side và hệ đèn led cảm biến nhiệt.'
      ];
    } else {
      return [
        'Hiệu chuẩn máy hàn Tic gá đỡ trục rulo băng tải khung thép chịu lực.',
        'Sơn phủ chống gỉ Alkyd 2 lớp cấu thép đầm thép bệ tỳ cẩu tháp.',
        'Lên hồ sơ kiểm định thử tải tải trọng cơ khí của khối giàn chịu rung.'
      ];
    }
  };

  // ===========================================================================
  // RENDER CHÍNH – CẤU TRÚC JSX GỒM 5 PHẦN CHÍNH:
  // 1. Header + Bộ lọc (Search, PM Filter, nút Thêm dự án)
  // 2. Drawer chi tiết dự án (Mở khi chọn project)
  //    2a. Thông tin cơ bản & chỉnh sửa
  //    2b. Quản lý Subtask (Công việc con)
  //    2c. Popover LT/HS/TP (Liên thông / Hồ sơ / Thầu phụ)
  // 3. Bảng Kanban chính (vòng lặp columns → project cards)
  // 4. Modal Workflow Automation (Cài đặt tự động hóa cho cột)
  // 5. Modal xem trước Báo giá PDF (downloadedQuoteModal)
  // ===========================================================================
  return (
    <div className="space-y-4 text-xs font-sans text-slate-300" id={`board_${sector}`}>
      {/* 1. TOP HEADER & SEARCH SEARCH BOX WITH FILTER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900 border border-slate-800 p-4 rounded-xl gap-3">
        <div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto text-[11px]">
          <button
            type="button"
            onClick={() => {
              if (!canCreate) {
                addToast({ title: '⛔ Không có quyền', message: 'Tài khoản của bạn không có quyền THÊM dự án ở phân hệ này.', type: 'error' });
                return;
              }
              openAddProjectModal();
            }}
            className={`font-extrabold text-[11px] px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-all shadow-md ${
              canCreate 
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer hover:scale-[1.02] shadow-emerald-950/30' 
                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
            }`}
            title="Tạo dự án mới đưa vào sơ đồ Kanban"
          >
            <Plus className="w-3.5 h-3.5" />
            Tạo Dự án
          </button>

          <button
            type="button"
            onClick={() => {
              if (!canConfigureColumnAutomation) {
                addToast({ title: '⛔ Không có quyền', message: 'Tài khoản của bạn không có quyền CẤU HÌNH tự động hóa cột ở phân hệ này.', type: 'error' });
                return;
              }
              setActiveWorkflowColId(columns[0]?.id || 'col_design');
              setShowAutoWorkflowModal(true);
            }}
            className={`font-extrabold text-[11px] px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-all shadow-md ${
              canConfigureColumnAutomation
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer hover:scale-[1.02] shadow-indigo-900/30'
                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
            }`}
            title="Thiết lập các quy tắc tự trị thông minh cho từng phân đoạn"
          >
            <Zap className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
            Tự động hóa
          </button>

          <button
            type="button"
            onClick={() => {
              if (!canCreateColumn) {
                addToast({ title: '⛔ Không có quyền', message: 'Tài khoản của bạn không có quyền THÊM cột/phân đoạn ở phân hệ này.', type: 'error' });
                return;
              }
              addNewColumn();
            }}
            className={`font-extrabold text-[11px] px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors ${
              canCreateColumn
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Thêm Cột
          </button>

          <button
            type="button"
            onClick={() => {
              if (!canEditColumn) {
                addToast({ title: '⛔ Không có quyền', message: 'Tài khoản của bạn không có quyền SỬA cột ở phân hệ này.', type: 'error' });
                return;
              }
              setConfirmDialog({
                title: 'Khôi phục Mặc định',
                message: 'Bạn có chắc chắn muốn khôi phục hoàn toàn cấu hình cột mặc định? Hành động này sẽ dọn sạch các cột tự tạo thêm và khôi phục cài đặt gốc.',
                onConfirm: () => {
                  saveColumns(getDefaultColumns());
                },
                confirmText: 'Khôi phục'
              });
            }}
            className={`font-extrabold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
              canEditColumn
                ? 'bg-slate-800 hover:bg-slate-705 border border-slate-700 text-slate-350 hover:text-white cursor-pointer'
                : 'bg-slate-900 text-slate-650 border border-slate-850 cursor-not-allowed'
            }`}
            title="Khôi phục dải cột Kanban về thiết lập mặc định"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Khôi phục Mặc định
          </button>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 select-none text-[11px]">
            <span className="text-slate-400 font-bold text-[10px] uppercase mr-1">Thu phóng:</span>
            <button
              type="button"
              onClick={() => {
                const newVal = Math.max(180, columnWidth - 20);
                setColumnWidth(newVal);
                dbService.kanbanColumns.save(sector, columns, newVal).catch(() => {});
              }}
              className="text-slate-400 hover:text-white px-1 py-0.5 rounded hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-center"
              title="Thu nhỏ cột"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <input
              type="range"
              min="180"
              max="400"
              value={columnWidth}
              onChange={(e) => {
                const newVal = parseInt(e.target.value, 10);
                setColumnWidth(newVal);
                dbService.kanbanColumns.save(sector, columns, newVal).catch(() => {});
              }}
              className="w-16 accent-emerald-500 h-1 cursor-pointer"
              title="Kéo để chỉnh kích thước cột"
            />
            <button
              type="button"
              onClick={() => {
                const newVal = Math.min(400, columnWidth + 20);
                setColumnWidth(newVal);
                dbService.kanbanColumns.save(sector, columns, newVal).catch(() => {});
              }}
              className="text-slate-400 hover:text-white px-1 py-0.5 rounded hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-center"
              title="Phóng to cột"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-emerald-400 font-mono font-bold w-9 text-right">{columnWidth}px</span>
          </div>
        </div>
      </div>

      {/* PROJECT CREATION MODAL */}
      {showAddProjectModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <form 
            onSubmit={(e) => {
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

                // rule 2.2: Kiểu văn bản (In đậm, in nghiêng, gạch giữa, màu chữ)
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
                      //notes: 'Nhiệm vụ tự trị Hoàng Long vách mộc',
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

                    // Thiết kế Hồ sơ
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

                // rule 9: Add involved person (Cộng sự bám sát)
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
              setSearchTerm('');
              setSelectedPmId('all');
              setShowAddProjectModal(false);
            }} 
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 text-xs shadow-2xl animate-scaleIn text-slate-200"
          >
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
                onClick={() => setShowAddProjectModal(false)} 
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
                onClick={() => setShowAddProjectModal(false)}
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
      )}

      {/* QUICK ADD CUSTOMER MODAL OVERLAY */}
      {showQuickCustModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-[60] p-4 font-sans text-slate-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-xs text-left animate-scaleIn">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-orange-500" />
                <h3 className="font-extrabold text-white text-sm">Thêm nhanh Khách hàng mới</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickCustModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickAddCustomerSubmit} className="space-y-3">
              <div>
                <label className="block text-slate-450 font-semibold mb-1">Mã khách hàng tự sinh</label>
                <input
                  type="text"
                  disabled
                  value={quickCustName ? `KH_${getAbbrev(quickCustName)}_${customers.length + 1}` : 'KH_[Tên viết tắt]_[STT]'}
                  className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-orange-400 font-mono font-bold cursor-not-allowed outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-350 font-bold mb-1">Tên khách hàng <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="Nhập tên khách hàng..."
                  value={quickCustName}
                  onChange={(e) => setQuickCustName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-white outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-350 font-bold mb-1">Loại khách hàng</label>
                  <select
                    value={quickCustType}
                    onChange={(e) => setQuickCustType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-850 rounded p-1.5 text-white outline-none cursor-pointer focus:border-orange-500 font-bold"
                  >
                    <option value="individual">👤 Cá nhân</option>
                    <option value="organization">🏢 Tổ chức</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-350 font-bold mb-1">Số điện thoại (* kiểu số)</label>
                  <input
                    type="text"
                    required
                    pattern="[0-9]*"
                    inputMode="numeric"
                    placeholder="ví dụ: 0912345678"
                    value={quickCustPhone}
                    onChange={(e) => setQuickCustPhone(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-white outline-none font-mono focus:border-orange-500"
                  />
                </div>
              </div>

              {quickCustType === 'organization' && (
                <div>
                  <label className="block text-slate-350 font-bold mb-1">Người đại diện <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    required={quickCustType === 'organization'}
                    placeholder="Nhập họ tên người đại diện pháp nhân..."
                    value={quickCustRep}
                    onChange={(e) => setQuickCustRep(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-white outline-none focus:border-orange-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-350 font-bold mb-1">Địa chỉ</label>
                <input
                  type="text"
                  placeholder="Địa chỉ liên hệ nhà thô..."
                  value={quickCustAddress}
                  onChange={(e) => setQuickCustAddress(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-855 rounded px-2.5 py-1.5 text-white outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-slate-350 font-bold mb-1">MST / CMND (* kiểu số)</label>
                <input
                  type="text"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  placeholder="Mã số thuế hoặc Mã CMND..."
                  value={quickCustTax}
                  onChange={(e) => setQuickCustTax(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-white outline-none font-mono focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-slate-350 font-bold mb-1">Ghi chú lưu ý</label>
                <textarea
                  rows={2}
                  placeholder="Nhật trình hoặc vật tư gỗ ván mong muốn..."
                  value={quickCustNotes}
                  onChange={(e) => setQuickCustNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded p-1.5 text-white outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowQuickCustModal(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-3 py-1.5 rounded cursor-pointer transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-4 py-1.5 rounded cursor-pointer transition-colors"
                >
                  Thêm & Chọn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDITING COLUMN SETTINGS MODAL */}
      {editingColumnId && (
        <ColumnSettingsModal
          column={columns.find(c => c.id === editingColumnId)!}
          onSave={(edits) => {
            setEditColName(edits.name);
            setEditColColor(edits.color);
            setEditColRuleType(edits.ruleType);
            setEditColRuleParam(edits.ruleParam);
            saveColumnSettings();
          }}
          onDelete={(id) => deleteColumn(id)}
          onClose={() => setEditingColumnId(null)}
        />
      )}
          {/* ===========================================================================
          SECTION 1: MAIN KANBAN BOARD VIEWPORT
          Vòng lặp columns.map(col) → render từng cột với:
          - colProjects: dự án thuộc cột (lọc qua getProjectColumnId)
          - styles: màu viền/tiêu đề từ getColumnStyleDetails
          - hasActiveAutomation: cờ có rule automation nào được bật
          - Mỗi project card: kéo thả (onDrop/onDragOver), badge LT/HS/TP, nút mở drawer
          =========================================================================== */}
          {/* 3. MAIN KANBAN BOARD VIEWPORT */}
      <div className="overflow-x-auto pb-4" id="kanban_board_viewport">
        <div className="flex gap-4 min-w-[1280px] h-auto items-stretch" id="kanban_columns_row">
          {columns.map((col) => {
            // Find projects mapped to this column
            const colProjects = sectorProjects.filter(p => getProjectColumnId(p, columns) === col.id);
            const styles = getColumnStyleDetails(col.color);

            // Check if column has any active automation rule
            const hasActiveAutomation = [
              col.automation?.assignId,
              col.automation?.statusUpdate,
              (col.automation?.textStyleStyleItalic || col.automation?.textStyleStyleBold || col.automation?.textStyleStyleStrike || col.automation?.textStyleStyleColor),
              col.automation?.approvalRole && col.automation.approvalRole !== 'none',
              col.automation?.subtaskTitle || (col.automation?.subtaskTitles && col.automation.subtaskTitles.some(t => !!t)),
              col.automation?.involvedId || (col.automation?.involvedEmployeeIds && col.automation.involvedEmployeeIds.length > 0)
            ].some(Boolean);

            return (
              <div
                key={col.id}
                onDrop={(e) => handleDrop(e, col.id)}
                onDragOver={handleDragOver}
                className={`kanban-column flex-1 bg-slate-900/45 border-t-4 ${styles.borderTop} border-x border-b ${styles.borderCol} rounded-2xl p-3.5 flex flex-col justify-between min-h-[75vh] h-auto space-y-3 shrink-0 transition-all duration-300 hover:bg-slate-900/60`}
                style={{ minWidth: `${columnWidth}px`, maxWidth: `${columnWidth}px` }}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between border-b border-slate-850/60 pb-3 shrink-0">
                  <div className="flex items-center gap-2 overflow-hidden">
                    {hasActiveAutomation && (
                      <span title="Đã kích hoạt quy trình tự động">
                        <Zap className="w-3.5 h-3.5 text-emerald-500 hover:text-emerald-400 animate-pulse shrink-0 select-none" />
                      </span>
                    )}
                    <h4 className={`font-black text-[11.5px] ${styles.text} tracking-wider truncate uppercase flex items-center gap-1.5`}>
                      {col.name}
                      <span className={`px-1.5 py-0.5 text-[9px] rounded-md font-extrabold ml-1 leading-none ${styles.badge}`}>
                        {colProjects.length}
                      </span>
                    </h4>
                  </div>

                  {/* Column actions group */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        if (!canEditColumn) {
                          addToast({ title: '⛔ Không có quyền', message: 'Tài khoản của bạn không có quyền SỬA cấu hình cột ở phân hệ này.', type: 'error' });
                          return;
                        }
                        openEditColumn(col);
                      }}
                      className={`p-1 rounded transition-colors ${canEditColumn ? 'hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer' : 'text-slate-600 cursor-not-allowed'}`}
                      title="Đổi tên & cấu hình cột phân đoạn này"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (!canConfigureColumnAutomation) {
                          addToast({ title: '⛔ Không có quyền', message: 'Tài khoản của bạn không có quyền CẤU HÌNH quy trình tự động ở phân hệ này.', type: 'error' });
                          return;
                        }
                        setActiveWorkflowColId(col.id);
                        setShowAutoWorkflowModal(true);
                      }}
                      className={`p-1 rounded transition-colors ${canConfigureColumnAutomation ? 'hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer' : 'text-slate-600 cursor-not-allowed'}`}
                      title="Cấu hình quy trình tự động cho phân đoạn này"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (!canDeleteColumn) {
                          addToast({ title: '⛔ Không có quyền', message: 'Tài khoản của bạn không có quyền XÓA cột phân đoạn ở phân hệ này.', type: 'error' });
                          return;
                        }
                        deleteColumn(col.id);
                      }}
                      className={`p-1 rounded transition-colors ${canDeleteColumn ? 'hover:bg-red-500/15 text-slate-400 hover:text-red-400 cursor-pointer' : 'text-slate-600 cursor-not-allowed'}`}
                      title="Xóa cột phân đoạn này"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Cards Container without scroll */}
                <div className="flex-1 space-y-3 pr-1 pt-1" id={`cards_scroller_${col.id}`}>
                  {colProjects.length === 0 ? (
                    <div className="h-28 border border-dashed border-slate-850 rounded-xl flex flex-col items-center justify-center text-slate-600 gap-1 select-none">
                      <Briefcase className="w-5 h-5 opacity-40" />
                      <span className="text-[10px]">Kéo công trình thả vào đây</span>
                    </div>
                  ) : (
                    colProjects.map((p) => {
                      const custName = customers.find(c => c.id === p.customerId)?.name || 'Vãng lai';
                      const pmName = employees.find(e => e.id === p.pmId)?.name || 'Chưa gán';
                      const directorName = employees.find(e => e.role === 'director')?.name || 'Trương Hữu Long';
                      // Count tasks (completion)
                      const projTasks = tasks.filter(t => t.projectId === p.id);
                      const doneTasks = projTasks.filter(t => t.status === 'completed');

                      return (
                        <div
                          key={p.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, p.id)}
                          onClick={() => setSelectedProjectId(p.id)}
                          className="bg-slate-950 border border-slate-850 hover:border-emerald-500/50 rounded-xl p-2.5 cursor-pointer shadow-md transition-all hover:shadow-lg relative group overflow-hidden active:scale-95"
                        >
                          {/* Accent left border based on stats or custom selected color */}
                          <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                            p.cardColor ? p.cardColor : (
                              p.status === 'completed' ? 'bg-emerald-500' :
                              p.status === 'paused' ? 'bg-amber-500' : 'bg-sky-500'
                            )
                          }`}></div>

                          {/* Giá trị số nhỏ góc trên bên phải của thẻ công việc */}
                          <div className="absolute top-2 right-2 flex items-center gap-1 bg-slate-900/80 border border-slate-800/60 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold select-none">
                            <CheckSquare className={`w-2.5 h-2.5 ${doneTasks.length === projTasks.length && projTasks.length > 0 ? 'text-emerald-500' : 'text-slate-500'}`} />
                            <span className={doneTasks.length === projTasks.length && projTasks.length > 0 ? 'text-emerald-400' : 'text-slate-300'}>
                              {doneTasks.length}/{projTasks.length}
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            {/* Tên Dự Án */}
                            <h5 
                              className={`text-[11px] line-clamp-2 leading-tight group-hover:text-emerald-350 transition-colors pr-8 ${
                                p.styleBold !== false ? 'font-bold' : 'font-normal'
                              } ${
                                p.styleItalic ? 'italic' : ''
                              } ${
                                p.styleStrike ? 'line-through' : ''
                              }   ${
                                p.styleColor || 'text-white'
                              }`}
                            >
                              {p.name}
                            </h5>

                            {/* Tên khách hàng tô màu xanh lá, không đề mục */}
                            <div className="text-emerald-400 font-bold text-[9.5px] truncate uppercase tracking-wider pr-8">
                              {custName}
                            </div>

                            {/* Thông tin dự án */}
                            <div className="space-y-1 text-[9.5px] text-slate-400 border-t border-slate-900/80 pt-1.5">
                              {/* Người chịu trách nhiệm (TRƯỞNG DỰ ÁN) */}
                              <div className="flex items-center gap-1 min-w-0">
                                <User className="w-3 h-3 text-slate-500 shrink-0 select-none" />
                                <span className="text-slate-300 font-semibold truncate flex-1">PM: {pmName}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer simple add card quick trigger */}
                <div className="shrink-0 pt-1.5 border-t border-slate-850">
                  <button
                    onClick={() => openAddProjectModal(col.id)}
                    className="w-full bg-slate-950/40 hover:bg-slate-950 border border-slate-850 text-slate-400 hover:text-white px-2 py-1.5 rounded-lg flex items-center justify-center gap-1 font-bold text-[10px] cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Thêm trực tiếp vào cột
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===========================================================================
            SECTION 2: DRAWER CHI TIẾT DỰ ÁN (Side Panel)
            Hiển thị khi selectedProjectId !== null
            Chứa: Header, Tab Basic/Subtask, 3 Popover (LT/HS/TP), Subtask Form
            =========================================================================== */}
        {/* 4. HIGHLY DETAILED DRAWER FOR CARD SELECTION (Mô phỏng 100% hình mồi) */}
      {selectedProject && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex justify-end z-50 animate-fade-in" onClick={() => setSelectedProjectId(null)}>
          <div 
            className="w-full max-w-[1536px] bg-slate-900 border-l border-slate-800 h-full flex flex-col text-xs text-slate-300 overflow-hidden" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 shrink-0 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg animate-pulse">
                  <Briefcase className="w-5 h-5 text-slate-950" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[10px] text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-900/30">
                      {selectedProject.code}
                    </span>
                    <span className="font-bold text-[9.5px] uppercase tracking-wider text-slate-400">
                       {sector === 'construction' ? 'PHÂN HỆ XÂY DỰNG' : sector === 'furniture' ? 'PHÂN HỆ NỘI THẤT' : 'PHÂN HỆ CƠ KHÍ'}
                    </span>
                  </div>
                  <h4 className="font-black text-white text-base mt-0.5">{selectedProject.name}</h4>
                  <div className="flex items-center gap-1.5 mt-0.5 text-slate-400">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Khách hàng / Chủ nhà:</span>
                    <span className="text-emerald-400 font-extrabold text-[11px]">
                      {customers.find(c => c.id === editCustomerId)?.name || 'Ẩn danh'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    try {
                      const projTasks = tasks.filter(t => t.projectId === selectedProject.id);
                      const exportObject = {
                        exportedAt: new Date().toISOString(),
                        author: 'Hoang Long Construction ERP',
                        project: {
                          id: selectedProject.id,
                          code: selectedProject.code,
                          name: selectedProject.name,
                          address: selectedProject.address,
                          type: selectedProject.type,
                          contractValue: selectedProject.contractValue,
                          startDate: selectedProject.startDate,
                          endDate: selectedProject.endDate,
                          pmId: selectedProject.pmId,
                          status: selectedProject.status,
                          progress: selectedProject.progress,
                          notes: selectedProject.notes,
                          documents: selectedProject.documents || [],
                          involvedEmployeeIds: selectedProject.involvedEmployeeIds || [],
                        },
                        tasks: projTasks.map(t => ({
                          id: t.id,
                          code: t.code,
                          name: t.name,
                          description: t.description,
                          assigneeId: t.assigneeId,
                          status: t.status,
                          completionRate: t.completionRate,
                          priority: t.priority,
                          deadline: t.deadline,
                          comments: t.comments || []
                        })),
                        systemConfig: {
                          sector
                        }
                      };

                      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
                        JSON.stringify(exportObject, null, 2)
                      )}`;
                      const downloadAnchor = document.createElement('a');
                      downloadAnchor.setAttribute('href', jsonString);
                      downloadAnchor.setAttribute(
                        'download',
                        `HO_SO_CONG_TRINH_${selectedProject.code}_${selectedProject.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`
                      );
                      document.body.appendChild(downloadAnchor);
                      downloadAnchor.click();
                      downloadAnchor.remove();

                      // Log action to project documents
                      const newExportDoc: ProjectDoc = {
                        id: `doc_export_${Date.now()}`,
                        type: 'liquidation',
                        name: `Đóng gói & Sao lưu Toàn bộ hồ sơ Dự án thành công`,
                        code: `BACKUP-${selectedProject.code}`,
                        createdAt: new Date().toISOString().split('T')[0],
                        status: 'approved',
                        templateName: 'Hệ thống Lưu kho đám mây sao lưu'
                      };
                      
                      updateProjectWithRule(selectedProject.id, {
                        documents: [...(selectedProject.documents || []), newExportDoc]
                      });

                      addToast({ title: '✅ Thành công', message: `📁 Đã nén và tải về file lưu trữ thành công!\nFile tên: HO_SO_CONG_TRINH_${selectedProject.code}.json\nBao gồm thông tin dự án, cấu trúc thẻ Kanban và các tài liệu liên thông.`, type: 'success' });
                    } catch (err) {
                      addToast({ title: '❌ Lỗi', message: 'Đã xảy ra lỗi khi đóng gói dữ liệu công trình.', type: 'error' });
                    }
                  }}
                  className="p-1 px-3 bg-teal-950/40 hover:bg-teal-900/50 text-teal-400 hover:text-teal-300 rounded-lg border border-teal-900/40 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Save className="w-4 h-4 text-teal-400" />
                  Tải Dự Án
                </button>

                {onDeleteProject && (
                  <>
                    <button
                      onClick={() => setIsConfirmingDelete(true)}
                      className="p-1 px-3 bg-red-950/40 hover:bg-red-900/50 text-red-400 hover:text-red-300 rounded-lg border border-red-900/40 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                      Xóa dự án
                    </button>

                    {isConfirmingDelete && (() => {
                      const projectTaskCount = tasks.filter(t => t.projectId === selectedProject.id).length;
                      const hasTasks = projectTaskCount > 0;
                      return (
                        <div
                          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
                          onClick={() => setIsConfirmingDelete(false)}
                        >
                          <div
                            className="bg-slate-900 border border-red-800 p-4 rounded-xl shadow-2xl w-80 max-w-[90vw] animate-scaleIn text-left"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {hasTasks ? (
                              <>
                                <p className="text-red-400 font-bold text-[10.5px] leading-relaxed font-sans">
                                  ⛔ Không thể xóa dự án "{selectedProject.name}" vì vẫn còn <strong>{projectTaskCount}</strong> công việc trong danh sách. Vui lòng xóa hết toàn bộ công việc trước khi xóa dự án.
                                </p>
                                <div className="flex justify-end mt-3">
                                  <button
                                    onClick={() => setIsConfirmingDelete(false)}
                                    className="bg-slate-800 hover:bg-slate-750 text-slate-300 font-extrabold text-[10px] py-1.5 px-4 rounded-lg cursor-pointer transition-colors text-center font-sans"
                                  >
                                    Đã hiểu
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <p className="text-red-400 font-bold text-[10.5px] leading-relaxed font-sans">
                                  ⚠️ Cảnh báo: Bạn có chắc chắn muốn xóa dự án này? Toàn bộ hồ sơ liên hợp, thẻ thông tin và các nhiệm vụ, công việc thi công trực thuộc dự án sẽ bị xóa vĩnh viễn và không thể khôi phục!
                                </p>
                                <div className="flex gap-2 mt-3">
                                  <button
                                    onClick={() => {
                                      onDeleteProject(selectedProject.id);
                                      setSelectedProjectId(null);
                                      setIsConfirmingDelete(false);
                                    }}
                                    className="flex-1 bg-red-600 hover:bg-red-500 text-white font-extrabold text-[10px] py-1.5 rounded-lg cursor-pointer transition-colors text-center font-sans"
                                  >
                                    Xóa vĩnh viễn
                                  </button>
                                  <button
                                    onClick={() => setIsConfirmingDelete(false)}
                                    className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-300 font-extrabold text-[10px] py-1.5 rounded-lg cursor-pointer transition-colors text-center font-sans"
                                  >
                                    Hủy bỏ
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}

                <button
                  onClick={() => setSelectedProjectId(null)}
                  className="p-1 px-3 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg border border-slate-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  Đóng Chi tiết
                </button>
              </div>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row" id="drawer_scrollable_body">
              {/* Left major side detail (7 columns width analog) */}
              <div className="flex-1 p-4 md:p-5 space-y-6 overflow-y-auto h-full border-b lg:border-b-0 lg:border-r border-slate-800" id="drawer_left_pane">
                
                {/* 1. Basic detail card */}
                <div className="bg-slate-950 border border-slate-850 p-5 rounded-2xl space-y-4">
                  <span className="font-extrabold text-[11px] text-emerald-400 flex items-center gap-1 uppercase tracking-wide border-b border-slate-900 pb-2">
                    <FileText className="w-4 h-4" />
                    THÔNG TIN DỰ ÁN
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Địa điểm thi công */}
                    <div className="col-span-2">
                      <span className="text-slate-500 block font-semibold mb-1">Địa điểm thi công:</span>
                      <input
                        type="text"
                        disabled={!isEditingDetails}
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        className={`outline-none border px-2.5 py-1.5 font-medium text-[11px] w-full transition-all focus:border-emerald-500 rounded ${
                          isEditingDetails
                            ? 'bg-slate-900 border-slate-800 text-slate-200'
                            : 'bg-slate-950 border-slate-900 text-slate-400 select-none cursor-not-allowed opacity-75'
                        }`}
                        placeholder="Nhập địa lý/địa điểm thi công..."
                      />
                    </div>

                    {/* Ngày khởi công */}
                    <div>
                      <span className="text-slate-500 block font-semibold mb-1">Ngày khởi công:</span>
                      <input
                        type="date"
                        disabled={!isEditingDetails}
                        value={editStartDate}
                        onChange={(e) => setEditStartDate(e.target.value)}
                        className={`outline-none border px-2.5 py-1.5 font-mono text-[11px] w-full transition-all focus:border-emerald-500 rounded ${
                          isEditingDetails
                            ? 'bg-slate-900 border-slate-800 text-slate-200'
                            : 'bg-slate-950 border-slate-900 text-slate-400 select-none cursor-not-allowed opacity-75'
                        }`}
                      />
                    </div>

                    {/* Thời hạn Hợp đồng */}
                    <div>
                      <span className="text-slate-500 block font-semibold mb-1">Thời hạn Hợp đồng (ngày):</span>
                      <input
                        type="number"
                        min="1"
                        disabled={!isEditingDetails}
                        value={editDuration}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditDuration(val ? Number(val) : '');
                        }}
                        className={`outline-none border px-2.5 py-1.5 font-mono text-[11px] w-full transition-all focus:border-emerald-500 rounded ${
                          isEditingDetails
                            ? 'bg-slate-900 border-slate-800 text-slate-200'
                            : 'bg-slate-950 border-slate-900 text-slate-400 select-none cursor-not-allowed opacity-75'
                        }`}
                        placeholder="Ví dụ: 90"
                      />
                    </div>

                    {/* Diễn giải thời hạn hợp đồng */}
                    <div className="col-span-2 p-3 bg-slate-900 border border-slate-850 rounded-xl space-y-1.5 text-[11px] text-slate-400">
                      <div className="flex justify-between items-center">
                        <span>📅 Dự kiến ngày hoàn thành:</span>
                        {(() => {
                          if (!editStartDate || !editDuration) {
                            return <span className="text-slate-650 italic">Nhập ngày khởi công & thời hạn thầu</span>;
                          }
                          const d = new Date(editStartDate);
                          if (isNaN(d.getTime())) return <span className="text-slate-650 italic">Ngày không hợp lệ</span>;
                          d.setDate(d.getDate() + Number(editDuration));
                          return <strong className="text-emerald-400 font-mono">{d.toLocaleDateString('vi-VN')}</strong>;
                        })()}
                      </div>
                      <div className="flex justify-between items-center">
                        <span>⏳ Số ngày còn lại:</span>
                        {(() => {
                          if (!editStartDate || !editDuration) {
                            return <span className="text-slate-650 italic">-</span>;
                          }
                          const d = new Date(editStartDate);
                          if (isNaN(d.getTime())) return <span className="text-slate-650 italic">-</span>;
                          d.setDate(d.getDate() + Number(editDuration));
                          
                          const today = new Date();
                          today.setHours(0,0,0,0);
                          d.setHours(0,0,0,0);
                          const diff = d.getTime() - today.getTime();
                          const diffDays = Math.ceil(diff / (1000 * 60 * 60 * 24));
                          
                          if (diffDays > 0) {
                            return <strong className="text-amber-400 font-mono">Còn {diffDays} ngày hữu hiệu</strong>;
                          } else if (diffDays === 0) {
                            return <strong className="text-rose-400 font-mono">Thời hạn hoàn công hôm nay!</strong>;
                          } else {
                            return <strong className="text-rose-500 font-mono">Đã trễ hạn {Math.abs(diffDays)} ngày</strong>;
                          }
                        })()}
                      </div>
                    </div>

                    {/* Vốn trị hợp đồng VNĐ */}
                    <div className="col-span-2">
                      <span className="text-slate-400 block font-bold text-[10.5px] uppercase tracking-wider mb-2">
                        💰 Giá trị Hợp đồng (VNĐ)
                      </span>
                      {(() => {
                        const projectReceipts = receipts.filter(r => r.projectId === selectedProject.id);
                        const totalReceived = projectReceipts.reduce((sum, r) => sum + (r.amount || 0), 0);

                        let grandTotal = 0;
                        let rawTotal = 0;
                        let discountPercent = 0;
                        let discountValue = 0;
                        let vatAmount = 0;

                        if (latestArchivedQuote) {
                          rawTotal = latestArchivedQuote.totalAmount || latestArchivedQuote.totalPrice || latestArchivedQuote.items?.reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0) || 0;
                          discountPercent = latestArchivedQuote.discountPercent || 0;
                          discountValue = rawTotal * (discountPercent / 100);
                          const subtotalAfterDiscount = rawTotal - discountValue;
                          vatAmount = Math.round(subtotalAfterDiscount * 0.08); // 8% VAT
                          grandTotal = subtotalAfterDiscount + vatAmount;
                        } else {
                          grandTotal = selectedProject.contractValue || editContractValue || 0;
                        }

                        const remainingValue = Math.max(0, grandTotal - totalReceived);

                        return (
                          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-center text-slate-800">
                            {latestArchivedQuote ? (
                              <>
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-[9.5px] text-emerald-700 bg-emerald-50 border border-emerald-200/60 font-extrabold tracking-widest uppercase px-2 py-0.5 rounded">
                                    Đồng bộ từ báo giá
                                  </span>
                                  {latestArchivedQuote.isApproved && (
                                    <span className="text-[9.5px] text-sky-700 bg-sky-50 border border-sky-200/60 font-extrabold tracking-widest uppercase px-2 py-0.5 rounded">
                                      Đã phê duyệt
                                    </span>
                                  )}
                                </div>
                                <div className="text-emerald-700 font-mono text-2xl font-black tracking-tight mt-1">
                                  {grandTotal.toLocaleString('vi-VN')} VNĐ
                                </div>
                                <div className="text-[10px] text-slate-500 mt-2 flex flex-col gap-1 border-t border-slate-100 pt-2">
                                  <div className="flex justify-between">
                                    <span>Giá gốc thầu:</span>
                                    <span className="font-mono text-slate-700 font-semibold">{rawTotal.toLocaleString('vi-VN')} đ</span>
                                  </div>
                                  {discountPercent > 0 && (
                                    <div className="flex justify-between text-amber-650 font-medium">
                                      <span>Chiết khấu ({discountPercent}%):</span>
                                      <span className="font-mono">-{discountValue.toLocaleString('vi-VN')} đ</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between">
                                    <span>Thuế VAT (8%):</span>
                                    <span className="font-mono text-slate-700 font-semibold">+{vatAmount.toLocaleString('vi-VN')} đ</span>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <>
                                {isEditingDetails ? (
                                  <div className="space-y-3">
                                    <input
                                      type="number"
                                      value={editContractValue}
                                      onChange={(e) => setEditContractValue(Number(e.target.value))}
                                      className="outline-none border px-3 py-2 font-mono text-[12px] w-full transition-all focus:border-emerald-500 rounded bg-slate-50 border-slate-200 text-slate-800"
                                      placeholder="Nhập giá trị hợp đồng VNĐ..."
                                    />
                                    {editContractValue > 0 && (
                                      <div className="text-emerald-700 font-mono text-base font-extrabold bg-emerald-50 border border-emerald-100 p-2 rounded-lg text-center shadow-sm">
                                        {editContractValue.toLocaleString('vi-VN')} VNĐ
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex flex-col justify-center">
                                    <div className="text-[9.5px] text-slate-400 uppercase font-black tracking-wider mb-1">
                                      Giá trị tạm tính (Chưa có báo giá)
                                    </div>
                                    <div className="text-slate-800 font-mono text-lg font-black tracking-tight">
                                      {grandTotal.toLocaleString('vi-VN')} VNĐ
                                    </div>
                                  </div>
                                )}
                              </>
                            )}

                            {/* Remaining status metrics */}
                            <div className="text-[10px] text-slate-500 mt-2.5 flex flex-col gap-1 border-t border-dashed border-slate-200 pt-2 bg-slate-50 p-2 rounded-lg">
                              <div className="flex justify-between">
                                <span className="text-slate-450 font-medium">Thực tế đã thu:</span>
                                <span className="font-mono text-emerald-600 font-bold">{totalReceived.toLocaleString('vi-VN')} đ</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-450 font-medium">Còn lại chưa thu:</span>
                                <span className="font-mono text-orange-600 font-black">{remainingValue.toLocaleString('vi-VN')} đ</span>
                              </div>
                            </div>

                            {/* Easy quick action receipt billing buttons */}
                            <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => handleCreateReceipt(false)}
                                className="bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-700 font-bold text-[10px] py-1.5 px-1.5 rounded-lg border border-emerald-200/60 transition-all cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                                title="Tạm ứng 50% số tiền chưa thu còn lại"
                              >
                                <Plus className="w-3 h-3 text-emerald-600 animate-pulse" />
                                Lập Phiếu Tạm Ứng
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCreateReceipt(true)}
                                className="bg-sky-50 hover:bg-sky-100 active:bg-sky-200 text-sky-700 font-bold text-[10px] py-1.5 px-1.5 rounded-lg border border-sky-200/60 transition-all cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                                title="Quyết toán toàn bộ số tiền chưa thu còn lại"
                              >
                                <Check className="w-3 h-3 text-sky-600" />
                                Lập Phiếu Quyết Toán
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Tùy chọn màu sắc thẻ Dự án */}
                    <div className="col-span-2 bg-slate-900/40 border border-slate-850/60 p-4 rounded-xl space-y-3">
                      <span className="text-slate-400 font-bold block text-[10.5px] uppercase tracking-wider">
                        🎨 Màu sắc thẻ dự án (Đường dọc bên trái)
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Option: Default (No custom override) */}
                        <button
                          type="button"
                          disabled={!isEditingDetails}
                          onClick={() => setEditCardColor('')}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                            !editCardColor
                              ? 'bg-slate-950 text-emerald-400 border-emerald-500/50 shadow-md'
                              : 'bg-slate-950 text-slate-400 border-slate-850 hover:text-white'
                          } ${!isEditingDetails ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          Mặc định (Theo Trạng thái)
                        </button>

                        {/* List of custom colors */}
                        {AVAILABLE_CARD_COLORS.map((color) => {
                          const isSelected = editCardColor === color.className;
                          return (
                            <button
                              key={color.className}
                              type="button"
                              disabled={!isEditingDetails}
                              onClick={() => setEditCardColor(color.className)}
                              className={`group relative w-7 h-7 rounded-full flex items-center justify-center transition-all ${color.className} ${
                                isSelected
                                  ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-950 scale-110 shadow-lg'
                                  : 'hover:scale-105 opacity-80 hover:opacity-100'
                              } ${!isEditingDetails ? 'opacity-95 cursor-not-allowed' : 'cursor-pointer'}`}
                              title={color.name}
                            >
                              {isSelected && (
                                <Check className="w-4 h-4 text-white drop-shadow" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-slate-500">
                        Chọn màu sắc nổi bật riêng biệt cho thẻ dự án này để dễ dàng theo dõi và nhận diện nhanh trên bảng phân đoạn Kanban.
                      </p>
                    </div>

                    {/* Button action toggles */}
                    <div className="col-span-2 pt-2 border-t border-slate-900 flex justify-end gap-3.5">
                      {!isEditingDetails ? (
                        <button
                          type="button"
                          onClick={() => setIsEditingDetails(true)}
                          className="bg-indigo-650 hover:bg-indigo-600 text-white font-extrabold px-4.5 py-2.2 rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-[0.98] cursor-pointer text-xs"
                        >
                          <Edit2 className="w-4 h-4" />
                          Chỉnh sửa thông tin
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              resetEditProjectDetails();
                              setIsEditingDetails(false);
                            }}
                            className="bg-slate-800 hover:bg-slate-750 text-slate-300 font-extrabold px-4 py-2.2 rounded-xl flex items-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer text-xs shadow-md border border-slate-700/30"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Hoàn tác
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveProjectDetails}
                            className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-extrabold px-4.5 py-2.2 rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-[0.98] cursor-pointer text-xs"
                          >
                            <Save className="w-4 h-4" />
                            Cập nhật & Lưu thông tin
                          </button>
                        </>
                      )}
                    </div>


                    {/* KHU VỰC NHÂN SỰ BẬC CAO: TRƯỞNG DỰ ÁN VÀ LIÊN QUAN */}
                    <div className="col-span-2 border-t border-slate-900 pt-3.5 space-y-3">
                      <span className="text-slate-400 block font-extrabold text-[10.5px] uppercase tracking-wider">
                        👥 NHÂN SỰ DỰ ÁN
                      </span>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {/* 1. TRƯỞNG DỰ ÁN CHUYÊN TRÁCH */}
                        <div className="bg-slate-900/50 border border-slate-850 p-3 rounded-xl flex items-center gap-3 relative group hover:border-slate-800 transition-colors">
                          {(() => {
                            const pm = employees.find(e => e.id === selectedProject.pmId);
                            const name = pm ? pm.name : 'Chưa gán';
                            const parts = name.split(' ');
                            const initials = parts.length >= 2
                              ? `${parts[parts.length - 2][0]}${parts[parts.length - 1][0]}`.toUpperCase()
                              : (parts[0] ? parts[0].substring(0, 2).toUpperCase() : '??');
                            return (
                              <>
                                {/* Interactive Avatar (Clicking triggers employee select via select overlay) */}
                                <div className="relative shrink-0 w-11 h-11">
                                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-500 to-teal-650 flex items-center justify-center font-bold text-slate-950 text-sm shadow-md border border-emerald-400/20 group-hover:scale-105 transition-all">
                                    {initials}
                                  </div>
                                  <span className="absolute -bottom-1 -right-0.5 bg-slate-950 text-emerald-400 border border-slate-800 w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] font-bold">
                                    ⚙️
                                  </span>
                                  {/* Transparent select over avatar for easy click trigger */}
                                  <select
                                    value={selectedProject.pmId || ''}
                                    onChange={(e) => updateProjectWithRule(selectedProject.id, { pmId: e.target.value })}
                                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                    title="Nhấp vào avatar để thay đổi Trưởng Dự Án chuyên trách"
                                  >
                                    <option value="" disabled className="bg-slate-950 text-slate-400">-- Thay đổi Trưởng Dự Án --</option>
                                    {employees.map(emp => (
                                      <option key={emp.id} value={emp.id} className="bg-slate-950 text-slate-200">
                                        {emp.name} ({emp.department})
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div className="flex-1 min-w-0">
                                  <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">TRƯỞNG DỰ ÁN</span>
                                  <div className="relative">
                                    <select
                                      value={selectedProject.pmId || ''}
                                      onChange={(e) => updateProjectWithRule(selectedProject.id, { pmId: e.target.value })}
                                      className="bg-transparent text-slate-200 font-bold text-xs border-none outline-none focus:ring-0 p-0 hover:text-emerald-400 transition-colors cursor-pointer w-full"
                                    >
                                      <option value="" disabled className="bg-slate-950 text-slate-400">-- Chưa gán --</option>
                                      {employees.map(emp => (
                                        <option key={emp.id} value={emp.id} className="bg-slate-950 text-slate-200">
                                          {emp.name} ({emp.department})
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <span className="block text-[9.5px] text-slate-400 font-mono truncate">
                                    {pm ? pm.department : 'Nhấp để chỉ định'}
                                  </span>
                                </div>
                              </>
                            );
                          })()}
                        </div>

                        {/* 2. NGƯỜI LIÊN QUAN / HỖ TRỢ */}
                        <div className="bg-slate-900/50 border border-slate-850 p-3 rounded-xl flex flex-col justify-between hover:border-slate-800 transition-colors">
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider mb-2">NGƯỜI LIÊN QUAN & HỖ TRỢ</span>
                            
                            <div className="flex flex-wrap items-center gap-1.5">
                              {/* List support member avatars */}
                              {(!selectedProject.involvedEmployeeIds || selectedProject.involvedEmployeeIds.length === 0) ? (
                                <span className="text-slate-600 text-[10px] italic py-1 block">Chưa có người hỗ trợ...</span>
                              ) : (
                                selectedProject.involvedEmployeeIds.map(empId => {
                                  const emp = employees.find(e => e.id === empId);
                                  if (!emp) return null;
                                  
                                  const parts = emp.name.split(' ');
                                  const initials = parts.length >= 2
                                    ? `${parts[parts.length - 2][0]}${parts[parts.length - 1][0]}`.toUpperCase()
                                    : (parts[0] ? parts[0].substring(0, 2).toUpperCase() : '??');
                                    
                                  return (
                                    <div key={empId} className="relative group/member shrink-0">
                                      {/* Interactive avatar that deletes on click */}
                                      <div 
                                        className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center font-bold text-white text-[10px] shadow border border-sky-450/10 cursor-pointer transition-transform hover:scale-105"
                                        title={`${emp.name} (${emp.department}) - Nhấp để xóa gỡ`}
                                        onClick={() => {
                                          const current = selectedProject.involvedEmployeeIds || [];
                                          updateProjectWithRule(selectedProject.id, { involvedEmployeeIds: current.filter(id => id !== empId) });
                                        }}
                                      >
                                        {initials}
                                        {/* Action indicator over face */}
                                        <div className="absolute inset-0 bg-rose-950/80 rounded-full flex items-center justify-center text-rose-400 font-extrabold text-[8px] opacity-0 group-hover/member:opacity-100 transition-opacity">
                                          ✕
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })
                              )}

                              {/* Plus visual as an interactive creator */}
                              <div className="relative shrink-0">
                                <div className="w-8 h-8 rounded-full border border-dashed border-slate-700 hover:border-emerald-500/70 bg-slate-950/50 flex items-center justify-center text-slate-500 hover:text-emerald-400 transition-colors cursor-pointer text-xs">
                                  <Plus className="w-3.5 h-3.5" />
                                </div>
                                <select
                                  value=""
                                  onChange={(e) => {
                                    const empId = e.target.value;
                                    if (empId) {
                                      const current = selectedProject.involvedEmployeeIds || [];
                                      if (!current.includes(empId)) {
                                        updateProjectWithRule(selectedProject.id, { involvedEmployeeIds: [...current, empId] });
                                      }
                                    }
                                  }}
                                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                  title="Nhấp để thêm người hỗ trợ vào danh sách liên quan"
                                >
                                  <option value="">-- Thêm người --</option>
                                  {employees
                                    .filter(emp => emp.id !== selectedProject.pmId && !(selectedProject.involvedEmployeeIds || []).includes(emp.id))
                                    .map(emp => (
                                      <option key={emp.id} value={emp.id}>
                                        {emp.name} ({emp.department})
                                      </option>
                                    ))
                                  }
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>

                </div>

              </div>

              {/* Right utility rail panels - REPLACED WITH SUBTASK LIST & CREATION */}
              <div className="w-full lg:w-[640px] bg-slate-950 p-4 md:p-5 space-y-4 flex flex-col shrink-0 h-full overflow-hidden border-t lg:border-t-0 lg:border-l border-slate-800" id="drawer_right_pane">
                <div className="flex-1 flex flex-col min-h-0">
                  
                  {/* ===========================================================================
                    2. CHƯƠNG TRÌNH KÍCH HOẠT QUY TẮC CÔNG VIỆC CON TRỰC BIÊN (Sub-tasks Section)
                    Form thêm/mở Subtask: Tên, Deadline, Ưu tiên, Người giao/Thực hiện,
                    Các công tắc (Approval/Cost/Material/Doc/Subcontractor), Checklist
                    =========================================================================== */}
                  {/* 2. CHƯƠNG TRÌNH KÍCH HOẠT QUY TẮC CÔNG VIỆC CON TRỰC BIÊN (Sub-tasks Section) */}
                  <div className="bg-slate-900 border border-slate-850 rounded-2xl p-4 md:p-4.5 space-y-4 shadow-xl text-left flex-1 flex flex-col min-h-0">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2.5 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <CheckSquare className="w-5 h-5 text-emerald-400" />
                        <span className="font-extrabold text-[11px] uppercase tracking-wider text-slate-150">
                          DANH SÁCH CÔNG VIỆC
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (!canCreateTask) {
                            addToast({ title: '⛔ Không có quyền', message: 'Tài khoản của bạn không có quyền TẠO công việc con.', type: 'error' });
                            return;
                          }
                          setShowSubtaskForm(!showSubtaskForm);
                        }}
                        className={canCreateTask ? "bg-emerald-600 hover:bg-emerald-500 text-white font-black px-3 py-1 rounded-lg text-[10px] flex items-center gap-1 cursor-pointer transition-colors" : "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed font-black px-3 py-1 rounded-lg text-[10px] flex items-center gap-1"}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Tạo Việc Con
                      </button>
                    </div>
                    {/* Form to add subtask — hiển thị dạng hộp thoại (modal) nằm trên cùng */}
                    {showSubtaskForm && (
                      <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-[300] p-4 animate-fade-in" onClick={() => setShowSubtaskForm(false)}>
                        <div className="bg-slate-950 rounded-xl border border-emerald-500/30 shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden text-left" onClick={(e) => e.stopPropagation()}>
                        <div className="font-bold text-[10.5px] text-white uppercase flex items-center gap-1 text-emerald-400 shrink-0 p-4 pb-3 border-b border-slate-800">
                          <Zap className="w-3.5 h-3.5" />
                          Tạo thẻ việc con chi tiết
                        </div>

                        {/* Vùng cuộn cho nội dung form (tránh tràn ra khỏi thẻ DANH SÁCH CÔNG VIỆC) */}
                        <div className="overflow-y-auto p-4 pr-5.5 custom-scrollbar space-y-3 min-h-0 flex-1">

                        <div className="space-y-2">
                          <div>
                            <label className="block text-slate-400 font-bold mb-0.5 text-[10px]">Tên công việc con:</label>
                            <input
                              type="text"
                              required
                              value={subTaskName}
                              onChange={(e) => setSubTaskName(e.target.value)}
                              placeholder="vd: Côn thô hàn định vị khung gầm rơ-moóc sườn"
                              className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-200 outline-none text-[11px] focus:border-emerald-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-slate-400 font-bold mb-0.5 text-[10px]">Thời hạn (Deadline) <span className="text-rose-400">*</span>:</label>
                              <input
                                type="date"
                                required
                                value={subTaskDeadline}
                                onChange={(e) => setSubTaskDeadline(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-200 outline-none text-[11px] focus:border-emerald-500 font-mono"
                              />
                            </div>
                            {/* Đã xóa trường Độ ưu tiên theo yêu cầu */}
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-slate-400 font-bold mb-0.5 text-[10px]">Người giao việc <span className="text-rose-400">*</span>:</label>
                              <SearchableEmployeeSelect
                                value={subTaskAssignerId}
                                onChange={(val) => setSubTaskAssignerId(val)}
                                employees={employees}
                                placeholder="-- Chọn người giao --"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-slate-400 font-bold mb-0.5 text-[10px]">Phụ trách chính <span className="text-rose-400">*</span>:</label>
                              <SearchableEmployeeSelect
                                value={subTaskAssigneeId}
                                onChange={(val) => setSubTaskAssigneeId(val)}
                                employees={employees}
                                placeholder="-- Chọn thợ mộc/cơ khí --"
                                required
                              />
                            </div>
                          </div>

                          {/* CẤU HÌNH TỰ ĐỘNG CHO CÔNG VIỆC CON */}
                          <div className="border border-slate-800 rounded-xl p-3 bg-slate-950/40 text-left space-y-3">                            <div className="space-y-2.5">

                              {/* 3. Các công tắc tự động (giống popup tham khảo) */}
                              <div className="space-y-3">
                                {/* Phê duyệt */}
                                <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Shield className={`w-4 h-4 ${subTaskIsApprovalEnabled ? 'text-sky-400' : 'text-slate-600'}`} />
                                      <div>
                                        <span className="font-extrabold text-slate-200 text-[11px] block">Cấu hình Quy trình Phê duyệt</span>
                                        <span className="text-[9.5px] text-slate-450 block">Mở nút "Yêu cầu phê duyệt" & Bắt buộc duyệt đối với việc con này</span>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const currentVal = subTaskIsApprovalEnabled === true;
                                        setSubTaskIsApprovalEnabled(!currentVal);
                                        if (!currentVal) {
                                          setSubTaskDefaultApproverId('');
                                        }
                                      }}
                                      className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer relative duration-150 ${
                                        subTaskIsApprovalEnabled ? 'bg-sky-500' : 'subcontractor-toggle-orange-off'
                                      }`}
                                    >
                                      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-150 ${
                                        subTaskIsApprovalEnabled ? 'translate-x-4' : 'translate-x-0'
                                      }`} />
                                    </button>
                                  </div>
                                  {subTaskIsApprovalEnabled && (
                                    <div className="mt-2.5 pt-2.5 border-t border-slate-800 space-y-1">
                                      <label className="block text-[9px] font-black text-rose-400 uppercase tracking-wider">Người phê duyệt mặc định <span className="text-rose-400">*</span>:</label>
                                      <SearchableEmployeeSelect
                                        value={subTaskDefaultApproverId || ''}
                                        onChange={(val) => setSubTaskDefaultApproverId(val || '')}
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
                                      <DollarSign className={`w-4 h-4 ${subTaskIsCostEnabled ? 'text-emerald-400' : 'text-slate-600'}`} />
                                      <div>
                                        <span className="font-extrabold text-slate-200 text-[11px] block">Cấu hình Đề xuất chi phí</span>
                                        <span className="text-[9.5px] text-slate-450 block">Mở/Đóng nút "Đề xuất chi phí" trong chi tiết công việc con</span>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const currentVal = subTaskIsCostEnabled === true;
                                        setSubTaskIsCostEnabled(!currentVal);
                                        if (!currentVal) {
                                          setSubTaskCostApproverId('');
                                          setSubTaskCostSettlerId('');
                                        }
                                      }}
                                      className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer relative duration-150 ${
                                        subTaskIsCostEnabled ? 'bg-emerald-500' : 'subcontractor-toggle-orange-off'
                                      }`}
                                    >
                                      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-150 ${
                                        subTaskIsCostEnabled ? 'translate-x-4' : 'translate-x-0'
                                      }`} />
                                    </button>
                                  </div>
                                  {subTaskIsCostEnabled && (
                                    <div className="mt-2.5 pt-2.5 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      <div className="space-y-1">
                                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Người xét duyệt mặc định <span className="text-rose-400">*</span>:</label>
                                        <SearchableEmployeeSelect
                                          value={subTaskCostApproverId || ''}
                                          onChange={(val) => setSubTaskCostApproverId(val || '')}
                                          employees={employees}
                                          placeholder="-- Mặc định (Giám đốc / PM) --"
                                          required
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Người quyết toán mặc định <span className="text-rose-400">*</span>:</label>
                                        <SearchableEmployeeSelect
                                          value={subTaskCostSettlerId || ''}
                                          onChange={(val) => setSubTaskCostSettlerId(val || '')}
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
                                      <Zap className={`w-4 h-4 ${subTaskIsMaterialEnabled ? 'text-amber-400' : 'text-slate-600'}`} />
                                      <div>
                                        <span className="font-extrabold text-slate-200 text-[11px] block">Cấu hình Đề xuất vật tư</span>
                                        <span className="text-[9.5px] text-slate-450 block">Mở/Đóng nút "Đề xuất vật tư" trong chi tiết công việc con</span>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const currentVal = subTaskIsMaterialEnabled === true;
                                        setSubTaskIsMaterialEnabled(!currentVal);
                                        if (!currentVal) {
                                          setSubTaskMaterialSelfCoordinated(false);
                                          setSubTaskMaterialCoordinatorId('');
                                        }
                                      }}
                                      className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer relative duration-150 ${
                                        subTaskIsMaterialEnabled ? 'bg-amber-500' : 'subcontractor-toggle-orange-off'
                                      }`}
                                    >
                                      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-150 ${
                                        subTaskIsMaterialEnabled ? 'translate-x-4' : 'translate-x-0'
                                      }`} />
                                    </button>
                                  </div>
                                </div>

                                {/* Hồ sơ công trình */}
                                <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <FileText className={`w-4 h-4 ${subTaskIsDocGenerationEnabled ? 'text-rose-400' : 'text-slate-600'}`} />
                                      <div>
                                        <span className="font-extrabold text-slate-200 text-[11px] block">Hồ sơ công trình</span>
                                        <span className="text-[9.5px] text-slate-450 block">Mở bộ nút lưu trữ thiết kế</span>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setSubTaskIsDocGenerationEnabled(!subTaskIsDocGenerationEnabled)}
                                      className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer relative duration-150 shrink-0 ${
                                        subTaskIsDocGenerationEnabled ? 'bg-rose-500' : 'subcontractor-toggle-orange-off'
                                      }`}
                                    >
                                      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-150 ${
                                        subTaskIsDocGenerationEnabled ? 'translate-x-4' : 'translate-x-0'
                                      }`} />
                                    </button>
                                  </div>
                                </div>

                                {/* Liên kết thầu phụ */}
                                <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Link className={`w-4 h-4 ${subTaskSubcontractorEnabled ? 'text-orange-400' : 'text-slate-600'}`} />
                                      <div>
                                        <span className="font-extrabold text-slate-200 text-[11px] block">Cấu hình Liên kết Thầu phụ</span>
                                        <span className="text-[9.5px] text-slate-450 block">Mở/Đóng nút "Liên kết Thầu phụ" trong chi tiết công việc con</span>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const currentVal = subTaskSubcontractorEnabled === true;
                                        setSubTaskSubcontractorEnabled(!currentVal);
                                        if (!currentVal) {
                                          setSubTaskSubcontractorApproverId('');
                                          setSubTaskSubcontractorSettlerId('');
                                        }
                                      }}
                                      className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer relative duration-150 ${
                                        subTaskSubcontractorEnabled ? 'bg-orange-500' : 'subcontractor-toggle-orange-off'
                                      }`}
                                    >
                                      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-150 ${
                                        subTaskSubcontractorEnabled ? 'translate-x-4' : 'translate-x-0'
                                      }`} />
                                    </button>
                                  </div>
                                  {subTaskSubcontractorEnabled && (
                                    <div className="mt-2.5 pt-2.5 border-t border-slate-800 space-y-3">
                                      {/* Dropdown chọn thầu phụ từ localStorage (giữ logic cũ) */}
                                      <div>
                                        <label className="block text-orange-400 font-bold text-[9px] uppercase tracking-wider mb-1">Chọn Thầu Phụ từ Dữ Liệu Kế Toán <span className="text-rose-400">*</span>:</label>
                                        <select
                                          value={subTaskSubcontractorId || ''}
                                          onChange={(e) => {
                                            const subId = e.target.value;
                                            setSubTaskSubcontractorId(subId);
                                            const savedSuppliers = localStorage.getItem('hl_acc_suppliers');
                                            let suppliers = [];
                                            if (savedSuppliers) {
                                              try { suppliers = JSON.parse(savedSuppliers); } catch(err) {}
                                            }
                                            const matched = suppliers.find((s: any) => s.id === subId || s.code === subId);
                                            if (matched) {
                                              setSubTaskSubcontractorName(matched.name);
                                            } else {
                                              const fallbackSuppliers = [
                                                { code: 'NTN_2', name: 'Công ty Cổ phần Thép tiền chế Nam Trung Nam' },
                                                { code: 'XD_1', name: 'Tổ thợ hồ móng cứng Bảo Lộc - Đại diện chú Ba' },
                                                { code: 'KM_3', name: 'Thợ kính cường lực Kim Minh' }
                                              ];
                                              const fbMatched = fallbackSuppliers.find(s => s.code === subId);
                                              if (fbMatched) {
                                                setSubTaskSubcontractorName(fbMatched.name);
                                              }
                                            }
                                          }}
                                          required
                                          className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 outline-none text-[10px] focus:border-orange-500 font-medium"
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
                                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Người xét duyệt mặc định <span className="text-rose-400">*</span>:</label>
                                          <SearchableEmployeeSelect
                                            value={subTaskSubcontractorApproverId || ''}
                                            onChange={(val) => setSubTaskSubcontractorApproverId(val || '')}
                                            employees={employees}
                                            placeholder="-- Mặc định (Giám đốc) --"
                                            required
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Người quyết toán mặc định <span className="text-rose-400">*</span>:</label>
                                          <SearchableEmployeeSelect
                                            value={subTaskSubcontractorSettlerId || ''}
                                            onChange={(val) => setSubTaskSubcontractorSettlerId(val || '')}
                                            employees={employees}
                                            placeholder="-- Mặc định (Kế toán) --"
                                            required
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Checklist / Đo kiểm */}
                          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                              <div className="flex items-center gap-2">
                                <CheckSquare className="w-4 h-4 text-amber-500 animate-pulse" />
                                <div>
                                  <span className="font-extrabold text-slate-200 text-[11px] block text-left">Đầu mục đo kiểm / Checklist kỹ thuật</span>
                                  <span className="text-[9.5px] text-slate-450 block text-left">Các bước thợ thi công phải đo, kiểm tra thực tế, chụp ảnh đối chứng</span>
                                </div>
                              </div>
                            </div>

                            {/* Danh sách các mục */}
                            {subTaskChecklistTexts && subTaskChecklistTexts.length > 0 ? (
                              <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                                {subTaskChecklistTexts.map((chk: string, chkIdx: number) => {
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
                                          const updated = (subTaskChecklistTexts || []).filter((_: any, i: number) => i !== chkIdx);
                                          setSubTaskChecklistTexts(updated);
                                        }}
                                        className="text-slate-500 hover:text-rose-400 p-1 hover:bg-rose-950/20 rounded cursor-pointer transition-all shrink-0"
                                        title="Xóa mục này"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-center py-4 bg-slate-950/40 rounded-xl border border-dashed border-slate-800 text-slate-500 text-[10px]">
                                Chưa có cấu hình checklist.
                              </div>
                            )}

                            {/* Thêm mới */}
                            <div className="flex gap-2">
                              <input
                                type="text"
                                id="new_checklist_input_subtask"
                                placeholder="VD: Kiểm tra kích thước phủ bì cánh tủ..."
                                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-[10.5px] text-slate-200 placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const inputEl = document.getElementById('new_checklist_input_subtask') as HTMLInputElement;
                                    if (inputEl && inputEl.value.trim()) {
                                      const currentText = inputEl.value.trim();
                                      const list = subTaskChecklistTexts || [];
                                      if (!list.includes(currentText)) {
                                        setSubTaskChecklistTexts([...list, currentText]);
                                      }
                                      inputEl.value = '';
                                    }
                                  }
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const inputEl = document.getElementById('new_checklist_input_subtask') as HTMLInputElement;
                                  if (inputEl && inputEl.value.trim()) {
                                    const currentText = inputEl.value.trim();
                                    const list = subTaskChecklistTexts || [];
                                    if (!list.includes(currentText)) {
                                      setSubTaskChecklistTexts([...list, currentText]);
                                    }
                                    inputEl.value = '';
                                  }
                                }}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <Plus className="w-3 h-3" /> Thêm
                              </button>
                            </div>
                          </div>

                          {/* End scrollable form content */}
                          </div>

                          <div className="p-4 pt-3 flex justify-end gap-2 shrink-0 border-t border-slate-800 bg-slate-950">
                            <button
                              type="button"
                              onClick={() => setShowSubtaskForm(false)}
                              className="bg-slate-850 hover:bg-slate-800 text-slate-400 px-3.5 py-1.5 rounded-lg text-[10.5px] font-bold cursor-pointer"
                            >
                              Hủy
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!canCreateTask) {
                                  addToast({ title: '⛔ Không có quyền', message: 'Tài khoản của bạn không có quyền TẠO công việc con.', type: 'error' });
                                  return;
                                }
                                handleAddSubTask();
                              }}
                              className={canCreateTask ? "bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-[10.5px] font-black cursor-pointer shadow-md" : "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed px-4 py-1.5 rounded-lg text-[10.5px] font-black"}
                            >
                              Lưu
                            </button>
                          </div>
                        </div>
                        </div>
                      </div>
                    )}

                    {/* Subtasks List */}
                    <div className="space-y-2 flex-1 overflow-y-auto pr-1 text-left min-h-0">
                      {(() => {
                        const taskMatrix = loadTaskPermissionMatrix();
                        const projectTasks = tasks.filter(t => t.projectId === selectedProject.id);
                        const visibleTasks = projectTasks.filter(t =>
                          canViewTask(currentUser, t, selectedProject, taskMatrix)
                        );
                        if (visibleTasks.length === 0) {
                          return (
                            <p className="text-[10.5px] text-slate-500 italic text-center py-6 bg-slate-950/40 rounded-xl border border-dashed border-slate-850">
                              {projectTasks.length === 0
                                ? 'Chưa lập bất kỳ công việc con nào cho dự án này. Hãy nhấn "Tạo Việc Con" bên trên.'
                                : 'Bạn không có quyền xem công việc nào trong dự án này.'}
                            </p>
                          );
                        }
                        return (
                          <>
                            {visibleTasks.map(task => {
                          const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'completed';

                          return (
                            <div
                              key={task.id}
                              onClick={() => {
                                setOverlayTaskId(task.id);
                              }}
                              className="bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 p-2.5 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition duration-150 relative group animate-fade-in"
                            >
                              {/* Left status border indicator */}
                              <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-lg ${
                                task.status === 'completed' ? 'bg-emerald-500' :
                                task.status === 'doing' ? 'bg-sky-500' :
                                task.status === 'reviewing' ? 'bg-indigo-500' :
                                isOverdue ? 'bg-rose-500' : 'bg-slate-700'
                              }`} />

                              <div className="space-y-1.5 min-w-0 pl-1.5 flex-1">
                                <span className="font-bold text-slate-200 text-[11px] block font-sans truncate">
                                  {task.name}
                                </span>
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className={`text-[10px] font-mono ${isOverdue ? 'text-rose-400 font-bold' : 'text-slate-500'}`}>
                                    {(() => {
                                      if (!task.deadline) return 'Hạn: Chưa đặt';
                                      try {
                                        const deadlineDate = new Date(task.deadline);
                                        if (isNaN(deadlineDate.getTime())) return 'Hạn: Chưa đặt';
                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);
                                        deadlineDate.setHours(0, 0, 0, 0);
                                        const diffTime = deadlineDate.getTime() - today.getTime();
                                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                        
                                        if (task.status === 'completed') {
                                          return 'Hạn: Đã hoàn thành';
                                        }
                                        if (diffDays === 0) {
                                          return 'Hạn: Hôm nay';
                                        } else if (diffDays > 0) {
                                          return `Hạn: Còn ${diffDays} ngày`;
                                        } else {
                                          return `Hạn: Quá hạn ${Math.abs(diffDays)} ngày`;
                                        }
                                      } catch (e) {
                                        return 'Hạn: Chưa đặt';
                                      }
                                    })()}
                                  </div>

                                  {/* Shortened Indicator Buttons for Groups */}
                                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                    {/* ===========================================================================
                                        POPOVER NHÓM LT (Liên Thông) — Các nút mở công cụ:
                                        Duyệt (Approval), Chi phí (Cost), Vật tư (Material)
                                        =========================================================================== */}
                                    {/* 1. LT (Liên Thông) Badge */}
                                    {(task.isApprovalEnabled === true || task.isCostEnabled === true || task.isMaterialEnabled === true) && (
                                      <div className="relative inline-block">
                                      <button
                                        type="button"
                                        disabled={task.status === 'completed'}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActivePopover(activePopover?.taskId === task.id && activePopover?.group === 'LT' ? null : { taskId: task.id, group: 'LT' });
                                        }}
                                        className="bg-sky-500/10 hover:bg-sky-500/25 border border-sky-500/25 text-sky-400 text-[8.5px] font-black px-1.5 py-0.5 rounded transition duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:border-slate-700 disabled:text-slate-500 select-none"
                                        title={task.status === 'completed' ? "Công việc đã hoàn thành" : "Công cụ liên thông"}
                                      >
                                        LIÊN THÔNG
                                      </button>
                                      
                                      {activePopover?.taskId === task.id && activePopover?.group === 'LT' && (
                                        <>
                                          <div 
                                            className="fixed inset-0 z-[90] bg-transparent cursor-default" 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActivePopover(null);
                                            }}
                                          />
                                          <div 
                                            className="absolute top-full mt-1.5 left-0 z-[100] bg-slate-900 border border-slate-800/95 rounded-xl p-2 w-52 shadow-2xl space-y-1 text-left"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                          <div className="px-1.5 py-0.5 border-b border-white/5 pb-1 mb-1 flex items-center justify-between">
                                            <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold">Công cụ liên thông</span>
                                            <span className="bg-sky-500/15 text-sky-400 text-[7.5px] px-1 rounded-sm border border-sky-500/20 font-mono">LIÊN THÔNG</span>
                                          </div>
                                          
                                          {task.status === 'todo' ? (
                                            <div className="p-2 text-center text-[9px] text-slate-400 leading-normal">
                                              Các công cụ liên thông sẽ khả dụng sau khi chuyển sang <span className="text-sky-400 font-bold">Đang làm</span>.
                                            </div>
                                          ) : (
                                            <>
                                              {/* Button: Yêu cầu phê duyệt */}
                                              {(() => {
                                                const isCompleted = task.status === 'completed';
                                                const isApprovalLocked = task.isApprovalRequired === true && task.status === 'reviewing';
                                                const isApprovalEnabled = task.isApprovalEnabled !== false && !isApprovalLocked && !isCompleted;
                                                
                                                let btnLabel = "Yêu cầu phê duyệt";
                                                let btnColor = "text-sky-400 hover:bg-sky-500/10";
                                                let btnIcon = <Shield className="w-3.5 h-3.5 text-sky-400" />;
                                                
                                                if (isCompleted) {
                                                  btnLabel = "Hoàn thành";
                                                  btnColor = "text-emerald-400 cursor-not-allowed bg-emerald-950/10";
                                                  btnIcon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
                                                } else if (isApprovalLocked) {
                                                  btnLabel = "Chờ duyệt...";
                                                  btnColor = "text-indigo-400 animate-pulse cursor-not-allowed bg-indigo-950/10";
                                                  btnIcon = <Shield className="w-3.5 h-3.5 text-indigo-400" />;
                                                } else if (!isApprovalEnabled) {
                                                  btnColor = "text-slate-600 cursor-not-allowed";
                                                }
                                                
                                                return (
                                                  <button
                                                    type="button"
                                                    disabled={isCompleted || !isApprovalEnabled || isApprovalLocked}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setActivePopover(null);
                                                      if (isApprovalEnabled && !isApprovalLocked && !isCompleted) {
                                                        const proj = projects.find(p => p.id === task.projectId);
                                                        if (proj) {
                                                          setSelectedProjectId(task.projectId!);
                                                          setConnectedTaskId(task.id);
                                                          setActiveConnectedTool('approval');
                                                          setCtApprovalSubject(`Yêu cầu phê duyệt cho công trình: ${proj.name}`);
                                                        }
                                                      }
                                                    }}
                                                    className={`w-full text-left px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-colors ${btnColor}`}
                                                  >
                                                    {btnIcon}
                                                    <span>{btnLabel}</span>
                                                  </button>
                                                );
                                              })()}

                                              {/* Button: Đề xuất chi phí */}
                                              {(() => {
                                                const isCostEnabled = task.isCostEnabled !== false && task.status !== 'completed';
                                                return (
                                                  <button
                                                    type="button"
                                                    disabled={!isCostEnabled}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setActivePopover(null);
                                                      if (isCostEnabled) {
                                                        setSelectedProjectId(task.projectId!);
                                                        setConnectedTaskId(task.id);
                                                        setActiveConnectedTool('cost');
                                                        setCtCostType('expense-advance');
                                                      }
                                                    }}
                                                    className={`w-full text-left px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-colors ${
                                                      isCostEnabled 
                                                        ? 'text-emerald-400 hover:bg-emerald-500/10 cursor-pointer' 
                                                        : 'text-slate-600 cursor-not-allowed'
                                                    }`}
                                                  >
                                                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                                                    <span>Đề xuất chi phí</span>
                                                  </button>
                                                );
                                              })()}

                                              {/* Button: Đề xuất vật tư */}
                                              {(() => {
                                                const isMaterialEnabled = task.isMaterialEnabled !== false && task.status !== 'completed';
                                                return (
                                                  <button
                                                    type="button"
                                                    disabled={!isMaterialEnabled}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setActivePopover(null);
                                                      if (isMaterialEnabled) {
                                                        setSelectedProjectId(task.projectId!);
                                                        setConnectedTaskId(task.id);
                                                        setActiveConnectedTool('material');
                                                      }
                                                    }}
                                                    className={`w-full text-left px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-colors ${
                                                      isMaterialEnabled 
                                                        ? 'text-amber-400 hover:bg-amber-500/10 cursor-pointer' 
                                                        : 'text-slate-600 cursor-not-allowed'
                                                    }`}
                                                  >
                                                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                                                    <span>Đề xuất vật tư</span>
                                                  </button>
                                                );
                                              })()}
                                            </>
                                          )}
                                        </div>
                                       </>
                                      )}
                                    </div>
                                    )}

                                    {/* ===========================================================================
                                        POPOVER NHÓM HS (Hồ Sơ Dự Án) — Các nút mở:
                                        Báo giá (Quote), Hợp đồng (Contract), Nghiệm thu (Acceptance), Thanh lý (Liquidation)
                                        =========================================================================== */}
                                    {/* 2. HS (Hồ Sơ Dự Án) Badge */}
                                    {task.isDocGenerationEnabled === true && (
                                      <div className="relative inline-block">
                                      <button
                                        type="button"
                                        disabled={task.status === 'completed'}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActivePopover(activePopover?.taskId === task.id && activePopover?.group === 'HS' ? null : { taskId: task.id, group: 'HS' });
                                        }}
                                        className="bg-indigo-500/10 hover:bg-indigo-500/25 border border-indigo-500/25 text-indigo-400 text-[8.5px] font-black px-1.5 py-0.5 rounded transition duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:border-slate-700 disabled:text-slate-500 select-none"
                                        title={task.status === 'completed' ? "Công việc đã hoàn thành" : "Hồ sơ dự án"}
                                      >
                                        HỒ SƠ
                                      </button>
                                      
                                      {activePopover?.taskId === task.id && activePopover?.group === 'HS' && (
                                        <>
                                          <div 
                                            className="fixed inset-0 z-[90] bg-transparent cursor-default" 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActivePopover(null);
                                            }}
                                          />
                                          <div 
                                            className="absolute top-full mt-1.5 left-0 z-[100] bg-slate-900 border border-slate-800/95 rounded-xl p-2 w-52 shadow-2xl space-y-1 text-left"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                          <div className="px-1.5 py-0.5 border-b border-white/5 pb-1 mb-1 flex items-center justify-between">
                                            <span className="text-[8px] uppercase tracking-wider text-indigo-400 font-bold">Hồ sơ dự án</span>
                                            <span className="bg-indigo-500/15 text-indigo-400 text-[7.5px] px-1 rounded-sm border border-indigo-500/20 font-mono">HỒ SƠ</span>
                                          </div>
                                          
                                          {(() => {
                                            const projectArchivedQuotes = archivedQuotesList.filter(q => 
                                              q.projectId === selectedProject.id && 
                                              (q._sectorType === selectedProject.type || (!q._sectorType && selectedProject.type === 'general'))
                                            );
                                            const latestArchivedQuote = projectArchivedQuotes.length > 0 ? projectArchivedQuotes[projectArchivedQuotes.length - 1] : null;
                                            const hasQuoteFile = latestArchivedQuote;

                                            if (hasQuoteFile) {
                                              let quoteStatusText = "Chưa Lập";
                                              let quoteStatusColor = "text-slate-500 bg-white/5";
                                              if (hasQuoteFile) {
                                                if (latestArchivedQuote.isApproved) {
                                                  quoteStatusText = "Đã Duyệt";
                                                  quoteStatusColor = "text-emerald-400 bg-emerald-950/20";
                                                } else {
                                                  quoteStatusText = "Chờ Duyệt";
                                                  quoteStatusColor = "text-amber-400 bg-amber-950/20";
                                                }
                                              }

                                              let contractStatusText = "Chưa Lập";
                                              let contractStatusColor = "text-slate-500 bg-white/5";
                                              if (hasQuoteFile) {
                                                if (!latestArchivedQuote.isApproved) {
                                                  contractStatusText = "Chờ Duyệt";
                                                  contractStatusColor = "text-amber-400 bg-amber-950/20";
                                                } else if (latestArchivedQuote.contractHtml) {
                                                  if (latestArchivedQuote.contractApproved) {
                                                    contractStatusText = "Đã Duyệt";
                                                    contractStatusColor = "text-emerald-400 bg-emerald-950/20";
                                                  } else {
                                                    contractStatusText = "Chờ Duyệt";
                                                    contractStatusColor = "text-amber-400 bg-amber-950/20";
                                                  }
                                                }
                                              }

                                              let acceptanceStatusText = "Chưa Lập";
                                              let acceptanceStatusColor = "text-slate-500 bg-white/5";
                                              if (hasQuoteFile) {
                                                if (!latestArchivedQuote.isApproved) {
                                                  acceptanceStatusText = "Chờ Duyệt";
                                                  acceptanceStatusColor = "text-amber-400 bg-amber-950/20";
                                                } else if (latestArchivedQuote.acceptanceHtml) {
                                                  if (latestArchivedQuote.acceptanceApproved) {
                                                    acceptanceStatusText = "Đã Duyệt";
                                                    acceptanceStatusColor = "text-emerald-400 bg-emerald-950/20";
                                                  } else {
                                                    acceptanceStatusText = "Chờ Duyệt";
                                                    acceptanceStatusColor = "text-amber-400 bg-amber-950/20";
                                                  }
                                                }
                                              }

                                              let liquidationStatusText = "Chưa Lập";
                                              let liquidationStatusColor = "text-slate-500 bg-white/5";
                                              if (hasQuoteFile) {
                                                if (!latestArchivedQuote.isApproved) {
                                                  liquidationStatusText = "Chờ Duyệt";
                                                  liquidationStatusColor = "text-amber-400 bg-amber-950/20";
                                                } else if (latestArchivedQuote.liquidationHtml) {
                                                  if (latestArchivedQuote.liquidationApproved) {
                                                    liquidationStatusText = "Đã Duyệt";
                                                    liquidationStatusColor = "text-emerald-400 bg-emerald-950/20";
                                                  } else {
                                                    liquidationStatusText = "Chờ Duyệt";
                                                    liquidationStatusColor = "text-amber-400 bg-amber-950/20";
                                                  }
                                                }
                                              }

                                              return (
                                                <>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setActivePopover(null);
                                                      setDownloadedQuoteActiveTab('quote');
                                                      setDownloadedQuoteModal(hasQuoteFile);
                                                    }}
                                                    className="w-full text-left px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-between transition-colors text-indigo-400 hover:bg-indigo-500/10 cursor-pointer"
                                                  >
                                                    <div className="flex items-center gap-1.5">
                                                      <FileText className="w-3.5 h-3.5 text-indigo-400" />
                                                      <span>Báo Giá</span>
                                                    </div>
                                                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border border-white/5 ${quoteStatusColor}`}>{quoteStatusText}</span>
                                                  </button>

                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setActivePopover(null);
                                                      setDownloadedQuoteActiveTab('contract');
                                                      setDownloadedQuoteModal(hasQuoteFile);
                                                    }}
                                                    className="w-full text-left px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-between transition-colors text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                                                  >
                                                    <div className="flex items-center gap-1.5">
                                                      <Briefcase className="w-3.5 h-3.5 text-rose-400" />
                                                      <span>Hợp Đồng</span>
                                                    </div>
                                                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border border-white/5 ${contractStatusColor}`}>{contractStatusText}</span>
                                                  </button>

                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setActivePopover(null);
                                                      setDownloadedQuoteActiveTab('acceptance');
                                                      setDownloadedQuoteModal(hasQuoteFile);
                                                    }}
                                                    className="w-full text-left px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-between transition-colors text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                                                  >
                                                    <div className="flex items-center gap-1.5">
                                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                                      <span>Nghiệm Thu</span>
                                                    </div>
                                                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border border-white/5 ${acceptanceStatusColor}`}>{acceptanceStatusText}</span>
                                                  </button>

                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setActivePopover(null);
                                                      setDownloadedQuoteActiveTab('liquidation');
                                                      setDownloadedQuoteModal(hasQuoteFile);
                                                    }}
                                                    className="w-full text-left px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-between transition-colors text-amber-400 hover:bg-amber-500/10 cursor-pointer"
                                                  >
                                                    <div className="flex items-center gap-1.5">
                                                      <Award className="w-3.5 h-3.5 text-amber-400" />
                                                      <span>Thanh Lý</span>
                                                    </div>
                                                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border border-white/5 ${liquidationStatusColor}`}>{liquidationStatusText}</span>
                                                  </button>
                                                </>
                                              );
                                            } else {
                                              const isDocGenerationEnabled = task.status !== 'completed';
                                              return (
                                                <button
                                                  type="button"
                                                  disabled={!isDocGenerationEnabled}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActivePopover(null);
                                                    if (isDocGenerationEnabled && onRedirectToQuote) {
                                                      onRedirectToQuote(task.projectId!);
                                                    }
                                                  }}
                                                  className={`w-full text-left px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-colors ${
                                                    isDocGenerationEnabled 
                                                      ? 'text-indigo-400 hover:bg-indigo-500/10 cursor-pointer' 
                                                      : 'text-slate-600 cursor-not-allowed'
                                                  }`}
                                                >
                                                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                                                  <span>Khai Báo Giá (Chưa lập)</span>
                                                </button>
                                              );
                                            }
                                          })()}
                                        </div>
                                       </>
                                      )}
                                    </div>
                                    )}

                                    {/* ===========================================================================
                                        POPOVER NHÓM TP (Thầu Phụ) — Nút điều hướng sang
                                        module Thầu phụ (onRedirectToSubcontractor) hoặc xem hợp đồng
                                        =========================================================================== */}
                                    {/* 3. TP (Thầu Phụ) Badge */}
                                    {task.isSubcontractorEnabled && task.subcontractorId && (
                                      <div className="relative inline-block">
                                        <button
                                          type="button"
                                          disabled={task.status === 'completed'}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActivePopover(activePopover?.taskId === task.id && activePopover?.group === 'TP' ? null : { taskId: task.id, group: 'TP' });
                                          }}
                                          className="bg-orange-500/10 hover:bg-orange-500/25 border border-orange-500/25 text-orange-400 text-[8.5px] font-black px-1.5 py-0.5 rounded transition duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:border-slate-700 disabled:text-slate-500 select-none"
                                          title={task.status === 'completed' ? "Công việc đã hoàn thành" : "Menu Thầu Phụ"}
                                        >
                                          THẦU PHỤ
                                        </button>
                                        
                                        {activePopover?.taskId === task.id && activePopover?.group === 'TP' && (
                                          <>
                                            <div 
                                              className="fixed inset-0 z-[90] bg-transparent cursor-default" 
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setActivePopover(null);
                                              }}
                                            />
                                            <div 
                                              className="absolute top-full mt-1.5 left-0 z-[100] bg-slate-900 border border-slate-800/95 rounded-xl p-2 w-52 shadow-2xl space-y-1 text-left"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                            <div className="px-1.5 py-0.5 border-b border-white/5 pb-1 mb-1 flex items-center justify-between">
                                              <span className="text-[8px] uppercase tracking-wider text-orange-400 font-bold">Thầu phụ</span>
                                              <span className="bg-orange-500/15 text-orange-400 text-[7.5px] px-1 rounded-sm border border-orange-500/20 font-mono">THẦU PHỤ</span>
                                            </div>
                                            
                                            {(() => {
                                              const matchedContract = subcontractorContracts.find(q => q.taskId === task.id) || 
                                                                      subcontractorContracts.find(q => q.projectId === task.projectId && q.subcontractorId === task.subcontractorId);
                                              
                                              const statusNormalized = (matchedContract?.status || "").trim().toLowerCase();
                                              const isApproved = matchedContract && (
                                                statusNormalized === 'hoàn thành' || 
                                                matchedContract.isApproved === true
                                              );

                                              let contractStateText = "Chưa Lập";
                                              let contractStateColor = "text-rose-400 bg-rose-950/20";

                                              if (matchedContract) {
                                                if (isApproved) {
                                                  contractStateText = "Đã Duyệt";
                                                  contractStateColor = "text-emerald-400 bg-emerald-950/20";
                                                } else {
                                                  contractStateText = "Chưa Duyệt";
                                                  contractStateColor = "text-amber-400 bg-amber-950/20";
                                                }
                                              }

                                              return (
                                                <>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setActivePopover(null);
                                                      
                                                      if (matchedContract) {
                                                        // Đã có HĐ → App.tsx sẽ redirect tới Lưu Trữ Hồ Sơ Thầu Phụ (Đường 2)
                                                        localStorage.setItem('hl_view_contract_id', matchedContract.id);
                                                      } else {
                                                        // Chưa có HĐ → set task ID để form Lập HĐ tự điền sẵn
                                                        localStorage.setItem('hl_preselected_task_id', task.id);
                                                      }

                                                      if (onRedirectToSubcontractor) {
                                                        onRedirectToSubcontractor(task.projectId || '', task.subcontractorId || '', task.name);
                                                      }
                                                    }}
                                                    className="w-full text-left px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-between transition-colors text-orange-400 hover:bg-orange-500/10 cursor-pointer"
                                                  >
                                                    <div className="flex items-center gap-1.5">
                                                      <Briefcase className="w-3.5 h-3.5 text-orange-400" />
                                                      <span>HĐ Giao Khoán</span>
                                                    </div>
                                                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border border-white/5 ${contractStateColor}`}>{contractStateText}</span>
                                                  </button>

                                                  {isApproved && (
                                                    <button
                                                      type="button"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActivePopover(null);
                                                        
                                                        // Open Task Detail modal AND pre-open subcontractor advance
                                                        localStorage.setItem('hl_open_subcontractor_advance', 'true');
                                                        setOverlayTaskId(task.id);
                                                      }}
                                                      className="w-full text-left px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-colors text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                                                    >
                                                      <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                                                      <span>Đề Xuất Tạm Ứng</span>
                                                    </button>
                                                  )}
                                                </>
                                              );
                                            })()}
                                          </div>
                                         </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                                <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase border ${
                                  task.status === 'todo' ? 'bg-white text-slate-500 border-slate-300 shadow-sm' :
                                  task.status === 'doing' ? 'bg-white text-sky-600 border-sky-300 shadow-sm' :
                                  task.status === 'reviewing' ? 'bg-white text-indigo-600 border-indigo-300 shadow-sm' :
                                  task.status === 'completed' ? 'bg-white text-emerald-600 border-emerald-300 shadow-sm' :
                                  task.status === 'overdue' ? 'bg-white text-rose-600 border-rose-300 shadow-sm' :
                                  'bg-white text-slate-400 border-slate-300 shadow-sm'
                                }`}>
                                  {task.status === 'todo' ? 'Chưa làm' :
                                   task.status === 'doing' ? 'Đang làm' :
                                   task.status === 'reviewing' ? 'Chờ duyệt' :
                                   task.status === 'completed' ? 'Hoàn thành' :
                                   task.status === 'overdue' ? 'Trễ hạn' :
                                   'Chưa làm'}
                                </span>

                                <div className="relative">
                                  <button
                                    type="button"
                                    disabled={task.status === 'completed'}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenMenuTaskId(openMenuTaskId === task.id ? null : task.id);
                                    }}
                                    className="p-1 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-900/40 text-slate-400 hover:text-slate-300 disabled:text-slate-600 rounded border border-slate-800 disabled:border-slate-850 transition duration-150 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center"
                                    title={task.status === 'completed' ? "Công việc đã hoàn thành (Khóa thao tác)" : "Thao tác"}
                                  >
                                    <MoreVertical className="w-3.5 h-3.5" />
                                  </button>
                                  
                                  {openMenuTaskId === task.id && (
                                    <>
                                      <div 
                                        className="fixed inset-0 z-[80] bg-transparent cursor-default" 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setOpenMenuTaskId(null);
                                        }}
                                      />
                                      <div 
                                        className="absolute right-0 top-full mt-1.5 z-[90] bg-slate-900 border border-slate-800/95 rounded-xl p-1.5 w-40 shadow-2xl space-y-1 text-left"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (!canEditTask) {
                                              addToast({ title: '⛔ Không có quyền', message: 'Tài khoản của bạn không có quyền SỬA công việc con.', type: 'error' });
                                              return;
                                            }
                                            handleStartEditSubTask(task);
                                          }}
                                          className="w-full text-left px-2.5 py-1.5 rounded-lg text-[10.5px] font-bold flex items-center gap-2 text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer transition-colors"
                                        >
                                          <Edit2 className="w-3.5 h-3.5 text-sky-400" />
                                          Sửa công việc
                                        </button>

                                        {onDeleteTask && canDeleteTask && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setOpenMenuTaskId(null);
                                              setConfirmDialog({
                                                title: 'Xác nhận xóa công việc con',
                                                message: `Bạn có chắc chắn muốn xóa công việc con "${task.name}" này không? Toàn bộ hồ sơ liên thông của công việc này sẽ bị xóa bỏ hoàn toàn và không thể hoàn tác.`,
                                                onConfirm: () => {
                                                  onDeleteTask(task.id);
                                                },
                                                confirmText: 'Xóa ngay',
                                                cancelText: 'Hủy bỏ'
                                              });
                                            }}
                                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-[10.5px] font-bold flex items-center gap-2 text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors"
                                          >
                                            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                            Xóa công việc
                                          </button>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                </div>

              </div>
            </div>

          </div>
        </div>
      )}

      {/* ===========================================================================
          SECTION 3: MODAL WORKFLOW AUTOMATION (Cài đặt tự động hóa cột Kanban)
          Mở khi showAutoWorkflowModal === true
          Chứa: Tabs (Giao việc/Chuyển cột/Duyệt/Subtask/Cộng sự/Kiểu chữ), logic updateColAutomation
          =========================================================================== */}
      {/* 2.5 WORKFLOW AUTOMATION MODAL */}
      {showAutoWorkflowModal && (() => {
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
            iconColor: 'text-sky-450 text-sky-450',
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
                    automation: { type: 'none' as const }
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
          const auto: NonNullable<KanbanColumn['automation']> = activeCol.automation || { type: 'none' };

          switch (selectedActionType) {
            case 'assignee':
              return (
                <div className="space-y-2 text-left">
                  <label className="block text-slate-350 font-bold mb-1">Trưởng Dự Án phụ trách mới</label>
                  <select
                    value={auto.assignId || ''}
                    onChange={(e) => updateColAutomation(activeWorkflowColId, { assignId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white outline-none cursor-pointer text-[11px]"
                  >
                    <option value="">-- Chọn cán bộ phụ trách --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.department} - {(emp.role || '').toUpperCase()})
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
                  <label className="block text-slate-350 font-bold mb-1">Cột phân đoạn tự chuyển dự án sang</label>
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
                  <label className="block text-slate-350 font-bold mb-1">Trình phê duyệt chỉ tiêu</label>
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
                  subtaskTitle: updated[0] || '', // keep in sync with legacy
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
                  <div className="flex justify-between items-center bg-slate-950/40 p-2 rounded-lg border border-slate-805">
                    <span className="text-slate-350 font-bold text-xs uppercase tracking-wider">
                      Danh sách công việc con ({subtasks.length} công việc)
                    </span>
                    <button
                      type="button"
                      onClick={handleAddSubtask}
                      className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] px-2 py-1 rounded cursor-pointer transition-colors"
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
                                  : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-white'
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
                                  <span className="bg-slate-800 text-slate-350 px-2 py-0.5 rounded font-extrabold">
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

                  {/* POPUP OVERLAY FOR SUBTASK AUTOMATION (Cửa sổ cài đặt đè lên trên) */}
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
                          <div className="flex justify-between items-center bg-slate-950 p-4.5 border-b border-slate-800 shrink-0">
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
                            {/* Layout 2 cột giống Nhân sự công triển */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                              {/* 1. Giao cho người thực hiện (Sử dụng cấu trúc avatar & select đè lên giống PM chính) */}
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
                                      {/* Avatar tròn tương tác */}
                                      <div className="relative shrink-0 w-11 h-11">
                                        <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${assignedEmp ? 'from-indigo-500 to-purple-600' : 'from-slate-700 to-slate-800'} flex items-center justify-center font-bold text-white text-sm shadow-md border border-white/5 group-hover:scale-105 transition-all`}>
                                          {initials}
                                        </div>
                                        <span className="absolute -bottom-1 -right-0.5 bg-slate-950 text-indigo-450 border border-slate-805 w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] font-bold">
                                          ⚙️
                                        </span>
                                        {/* Select ẩn đè lên avatar */}
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
                                                    <div className="absolute inset-0 bg-rose-950/80 rounded-full flex items-center justify-center text-rose-450 font-extrabold text-[8px] opacity-0 group-hover/member:opacity-100 transition-opacity">
                                                      ✕
                                                    </div>
                                                  </div>
                                                </div>
                                              );
                                            })
                                          )}

                                          {/* Plus visual as an interactive creator */}
                                          <div className="relative shrink-0">
                                            <div className="w-8 h-8 rounded-full border border-dashed border-slate-705 hover:border-emerald-500/70 bg-slate-950/50 flex items-center justify-center text-slate-500 hover:text-emerald-400 transition-colors cursor-pointer text-xs">
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
                                  <div>
                                    <span className="font-extrabold text-slate-200 text-[11px] block">Cấu hình Quy trình Phê duyệt</span>
                                    <span className="text-[9.5px] text-slate-450 block">Mở nút "Yêu cầu phê duyệt" & Bắt buộc duyệt đối với việc con này</span>
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
                                    subtaskAuto.isApprovalEnabled === true ? 'bg-sky-500' : 'subcontractor-toggle-orange-off'
                                  }`}
                                >
                                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-150 ${
                                    subtaskAuto.isApprovalEnabled === true ? 'translate-x-4' : 'translate-x-0'
                                  }`} />
                                </button>
                              </div>
                              {subtaskAuto.isApprovalEnabled === true && (
                                <div className="mt-2.5 pt-2.5 border-t border-slate-800 space-y-1">
                                  <label className="block text-[9px] font-black text-rose-400 uppercase tracking-wider">Người phê duyệt mặc định <span className="text-rose-400">*</span>:</label>
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
                                  <div>
                                    <span className="font-extrabold text-slate-200 text-[11px] block">Cấu hình Đề xuất chi phí</span>
                                    <span className="text-[9.5px] text-slate-450 block">Mở/Đóng nút "Đề xuất chi phí" trong chi tiết công việc con</span>
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
                                    subtaskAuto.isCostEnabled === true ? 'bg-emerald-500' : 'subcontractor-toggle-orange-off'
                                  }`}
                                >
                                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-150 ${
                                    subtaskAuto.isCostEnabled === true ? 'translate-x-4' : 'translate-x-0'
                                  }`} />
                                </button>
                              </div>
                              {subtaskAuto.isCostEnabled === true && (
                                <div className="mt-2.5 pt-2.5 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                                  <div>
                                    <span className="font-extrabold text-slate-200 text-[11px] block">Cấu hình Đề xuất vật tư</span>
                                    <span className="text-[9.5px] text-slate-450 block">Mở/Đóng nút "Đề xuất vật tư" trong chi tiết công việc con</span>
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
                                    subtaskAuto.isMaterialEnabled === true ? 'bg-amber-500' : 'subcontractor-toggle-orange-off'
                                  }`}
                                >
                                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-150 ${
                                    subtaskAuto.isMaterialEnabled === true ? 'translate-x-4' : 'translate-x-0'
                                  }`} />
                                </button>
                              </div>
                            </div>


                            {/* Hồ sơ công trình */}
                            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <FileText className={`w-4 h-4 ${subtaskAuto.isDocGenerationEnabled === true ? 'text-rose-400' : 'text-slate-600'}`} />
                                  <div>
                                    <span className="font-extrabold text-slate-200 text-[11px] block">Hồ sơ công trình</span>
                                    <span className="text-[9.5px] text-slate-450 block">Mở bộ nút lưu trữ thiết kế</span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = subtaskAuto.isDocGenerationEnabled !== true;
                                    updateSubtaskAutomation(index, { isDocGenerationEnabled: next });
                                  }}
                                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer relative duration-150 ${
                                    subtaskAuto.isDocGenerationEnabled === true ? 'bg-rose-500' : 'subcontractor-toggle-orange-off'
                                  }`}
                                >
                                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-150 ${
                                    subtaskAuto.isDocGenerationEnabled === true ? 'translate-x-4' : 'translate-x-0'
                                  }`} />
                                </button>
                              </div>
                            </div>

                            {/* Liên kết Thầu phụ */}
                            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Link className={`w-4 h-4 ${subtaskAuto.isSubcontractorEnabled === true ? 'text-orange-400' : 'text-slate-600'}`} />
                                  <div>
                                    <span className="font-extrabold text-slate-200 text-[11px] block">Cấu hình Liên kết Thầu phụ</span>
                                    <span className="text-[9.5px] text-slate-450 block">Mở/Đóng nút "Liên kết Thầu phụ" trong chi tiết công việc con</span>
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
                                      : 'subcontractor-toggle-orange-off'
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
                                      required
                                      className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 outline-none text-[10px] focus:border-orange-500 font-medium"
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
                                  <div>
                                    <span className="font-extrabold text-slate-200 text-[11px] block text-left">Đầu mục đo kiểm / Checklist kỹ thuật</span>
                                    <span className="text-[9.5px] text-slate-450 block text-left">Các bước thợ thi công phải đo, kiểm tra thực tế, chụp ảnh đối chứng</span>
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
                                          className="text-slate-500 hover:text-rose-400 p-1 hover:bg-rose-950/20 rounded cursor-pointer transition-all shrink-0"
                                          title="Xóa mục này"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="text-center py-4 bg-slate-950/40 rounded-xl border border-dashed border-slate-800 text-slate-500 text-[10px]">
                                  Chưa có cấu hình checklist.
                                </div>
                              )}

                              {/* Thêm mới */}
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  id={`new_checklist_input_${index}`}
                                  placeholder="VD: Kiểm tra kích thước phủ bì cánh tủ..."
                                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-[10.5px] text-slate-200 placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors"
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
                                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
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
                              onClick={() => {
                                // Validate required conditional fields
                                if (subtaskAuto.isApprovalEnabled === true && !subtaskAuto.defaultApproverId) {
                                  addToast({ title: '⛔ Thiếu thông tin', message: 'Khi bật Cấu hình Quy trình Phê duyệt, vui lòng chọn Người phê duyệt mặc định.', type: 'error' });
                                  return;
                                }
                                if (subtaskAuto.isCostEnabled === true) {
                                  if (!subtaskAuto.costApproverId) {
                                    addToast({ title: '⛔ Thiếu thông tin', message: 'Khi bật Cấu hình Đề xuất chi phí, vui lòng chọn Người xét duyệt mặc định.', type: 'error' });
                                    return;
                                  }
                                  if (!subtaskAuto.costSettlerId) {
                                    addToast({ title: '⛔ Thiếu thông tin', message: 'Khi bật Cấu hình Đề xuất chi phí, vui lòng chọn Người quyết toán mặc định.', type: 'error' });
                                    return;
                                  }
                                }
                                if (subtaskAuto.isSubcontractorEnabled === true) {
                                  if (!subtaskAuto.subcontractorId) {
                                    addToast({ title: '⛔ Thiếu thông tin', message: 'Khi bật Cấu hình Liên kết Thầu phụ, vui lòng chọn Thầu Phụ từ Dữ Liệu Kế Toán.', type: 'error' });
                                    return;
                                  }
                                  if (!subtaskAuto.subcontractorApproverId) {
                                    addToast({ title: '⛔ Thiếu thông tin', message: 'Khi bật Cấu hình Liên kết Thầu phụ, vui lòng chọn Người xét duyệt mặc định.', type: 'error' });
                                    return;
                                  }
                                  if (!subtaskAuto.subcontractorSettlerId) {
                                    addToast({ title: '⛔ Thiếu thông tin', message: 'Khi bật Cấu hình Liên kết Thầu phụ, vui lòng chọn Người quyết toán mặc định.', type: 'error' });
                                    return;
                                  }
                                }
                                setActiveSubtaskRuleIndex(null);
                              }}
                              className="bg-indigo-650 hover:bg-indigo-600 text-white font-bold text-xs px-5 py-2 rounded-xl cursor-pointer transition-colors"
                            >
                              Lưu & Đóng cài đặt
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  <p className="text-[10px] text-slate-500 italic mt-1">
                    * Hệ thống hỗ trợ tự động khởi tạo toàn bộ số lượng danh sách công việc con trên khi thẻ công trình di chuyển vào cột phân đoạn {activeCol?.name || ''}.
                  </p>
                </div>
              );
            }



            case 'involved': {
              const currentInvolved = auto?.involvedEmployeeIds || (auto?.involvedId ? [auto.involvedId] : []);
              return (
                <div className="space-y-4 text-left">
                  <span className="block text-slate-300 font-bold text-xs uppercase tracking-wider">Cộng sự bám sát thi công phụ</span>
                  
                  <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl flex flex-col justify-between hover:border-slate-700 transition-colors text-left min-h-[72px]">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider mb-2">DANH SÁCH CỘNG SỰ BÁM SÁT ({currentInvolved.length})</span>
                      
                      <div className="flex flex-wrap items-center gap-1.5">
                        {currentInvolved.length === 0 ? (
                          <span className="text-slate-600 text-[10px] italic py-1 block">Chưa gán người hỗ trợ...</span>
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
                                {/* Interactive avatar that deletes on click */}
                                <div 
                                  className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-[10px] shadow border border-white/10 cursor-pointer transition-transform hover:scale-105"
                                  title={`${emp.name} (${emp.department}) - Nhấp để xóa gỡ`}
                                  onClick={() => {
                                    const nextInvolved = currentInvolved.filter((id: string) => id !== empId);
                                    updateColAutomation(activeWorkflowColId, {
                                      involvedEmployeeIds: nextInvolved,
                                      involvedId: nextInvolved[0] || undefined
                                    });
                                  }}
                                >
                                  {initials}
                                  {/* Action indicator over face */}
                                  <div className="absolute inset-0 bg-rose-950/80 rounded-full flex items-center justify-center text-rose-450 font-extrabold text-[8px] opacity-0 group-hover/member:opacity-100 transition-opacity">
                                    ✕
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}

                        {/* Plus visual as an interactive creator */}
                        <div className="relative shrink-0">
                          <div className="w-8 h-8 rounded-full border border-dashed border-slate-705 hover:border-emerald-500/70 bg-slate-900/50 flex items-center justify-center text-slate-500 hover:text-emerald-400 transition-colors cursor-pointer text-xs">
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
                                  updateColAutomation(activeWorkflowColId, {
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
                              .filter(emp => emp.id !== auto?.assignId && !currentInvolved.includes(emp.id))
                              .map(emp => (
                                <option key={emp.id} value={emp.id}>
                                  {emp.name} ({emp.department})
                                </option>
                              ))
                            }
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            case 'textStyle':
              return (
                <div className="space-y-4 text-left">
                  <span className="block text-slate-350 font-bold mb-1">Cấu hình kiểu chữ & màu sắc cho công trình</span>
                  
                  <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-xl space-y-4">
                    <div className="space-y-2.5">
                      <label className="block text-xs uppercase tracking-wider font-extrabold text-slate-400">Định dạng kiểu chữ (Đa tùy chọn)</label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <label className="flex items-center gap-2.5 bg-slate-950 border border-slate-800 p-3 rounded-lg cursor-pointer hover:border-slate-700 select-none transition-colors">
                          <input
                            type="checkbox"
                            checked={!!auto.textStyleStyleBold}
                            onChange={(e) => updateColAutomation(activeWorkflowColId, { textStyleStyleBold: e.target.checked })}
                            className="w-4 h-4 text-indigo-600 border-slate-700 bg-slate-900 rounded focus:ring-indigo-500 cursor-pointer"
                          />
                          <span className="font-bold text-[11px] text-white">In Đậm (Bold)</span>
                        </label>

                        <label className="flex items-center gap-2.5 bg-slate-950 border border-slate-800 p-3 rounded-lg cursor-pointer hover:border-slate-700 select-none transition-colors">
                          <input
                            type="checkbox"
                            checked={!!auto.textStyleStyleItalic}
                            onChange={(e) => updateColAutomation(activeWorkflowColId, { textStyleStyleItalic: e.target.checked })}
                            className="w-4 h-4 text-indigo-600 border-slate-700 bg-slate-900 rounded focus:ring-indigo-500 cursor-pointer"
                          />
                          <span className="italic text-[11px] text-white">In Nghiêng (Italic)</span>
                        </label>

                        <label className="flex items-center gap-2.5 bg-slate-950 border border-slate-800 p-3 rounded-lg cursor-pointer hover:border-slate-700 select-none transition-colors">
                          <input
                            type="checkbox"
                            checked={!!auto.textStyleStyleStrike}
                            onChange={(e) => updateColAutomation(activeWorkflowColId, { textStyleStyleStrike: e.target.checked })}
                            className="w-4 h-4 text-indigo-600 border-slate-700 bg-slate-900 rounded focus:ring-indigo-500 cursor-pointer"
                          />
                          <span className="line-through text-[11px] text-white">Gạch Giữa (Strike)</span>
                        </label>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs uppercase tracking-wider font-extrabold text-slate-400">Màu sắc tiêu đề (5 màu cơ bản)</label>
                      <select
                        value={auto.textStyleStyleColor || ''}
                        onChange={(e) => updateColAutomation(activeWorkflowColId, { textStyleStyleColor: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white outline-none cursor-pointer text-[11px]"
                      >
                        <option value="">🔘 Không thay đổi màu chữ (Mặc định)</option>
                        <option value="text-red-500">🔴 Đỏ (Red - Hoạt động mạnh)</option>
                        <option value="text-orange-500">🟠 Cam (Orange - Sáng tạo)</option>
                        <option value="text-emerald-500">🟢 Xanh lá (Green - Hoàn tất / An toàn)</option>
                        <option value="text-sky-500">🔵 Xanh dương (Blue - Thiết kế / Xây lắp)</option>
                        <option value="text-pink-500">🌸 Hồng (Pink - Đang chào thầu)</option>
                      </select>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 leading-normal">
                    * Kiểu văn bản tự động: Thiết lập các quy tắc phong cách chữ trên. Khi dự án được di chuyển qua cột phân đoạn này, hệ thống sẽ tự động cấu hình hiệu ứng kiểu chữ cho thẻ tiêu đề công trình tương ứng.
                  </p>
                </div>
              );

            default:
              return null;
          }
        };

        return (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex justify-end z-50 animate-fade-in" onClick={() => setShowAutoWorkflowModal(false)}>
            <div 
              className="w-full max-w-[1536px] bg-slate-900 border-l border-slate-805 h-full flex flex-col text-slate-300 shadow-2xl overflow-hidden animate-slideLeft" 
              onClick={(e) => e.stopPropagation()}
            >
              
              {/* Modal Header */}
              <div className="flex justify-between items-center bg-slate-950 p-4 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                    <Zap className="w-5 h-5 text-indigo-400 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-[15px] text-white">
                      Chọn loại hành động
                    </h3>
                    <p className="text-[10px] text-slate-400 uppercase font-mono tracking-wider mt-0.5">
                      QUY TRÌNH TỰ ĐỘNG: PHÂN ĐOẠN <span className="text-indigo-400 font-bold">[{activeCol?.name}]</span>
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAutoWorkflowModal(false)}
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
                  <span className="font-extrabold text-[9px] text-slate-500 uppercase tracking-widest block mb-2 px-1">
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
                        <div>
                          <h4 className="font-extrabold text-[13px] text-white tracking-wide">
                            Thiết lập: {actionsConfig[selectedActionType].title}
                          </h4>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Quy tắc tự chạy cho phân đoạn <span className="font-black text-indigo-400 font-mono">[{activeCol.name}]</span>
                          </p>
                        </div>
                      </div>

                      {/* Explanation banner */}
                      <div className="bg-slate-950/60 border border-slate-850 p-3 rounded-xl text-[10.5px] leading-relaxed text-slate-350 text-slate-300">
                        <span className="text-yellow-400 mr-1 animate-pulse">💡</span>
                        <strong>Vận hành:</strong> {actionsConfig[selectedActionType].helpText}
                      </div>

                      {/* Config Area */}
                      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-4 shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-801 pb-3 border-slate-800">
                          <div>
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
                              className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white px-3_5 py-2 rounded-lg font-extrabold cursor-pointer transition-colors"
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
                      Quy trình tự trị kích hoạt tức thì khi kéo mốc
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
                <p className="text-[10px] text-slate-500 max-w-lg leading-relaxed">
                  * Quy trình tự trị Hoàng Long được lưu cục bộ và an toàn. Khi di chuyển thẻ, hệ thống sẽ tự sinh bản vẽ con, đổi quản lý, cập nhật trạng thái liên hợp ngay lập tức.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      addToast({ title: 'ℹ️ Thông báo', message: `Đã hoàn tất cấu hình tự động cho phân đoạn: ${activeCol?.name || 'mục'}!`, type: 'info' });
                      setShowAutoWorkflowModal(false);
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
      })()}

      {/* Dynamic Connected Tool Modals ("Công cụ liên thông") */}
      <ConnectedToolsModal
        currentUser={currentUser}
        employees={employees}
        tasks={tasks}
        selectedProject={selectedProject || null}
        activeConnectedTool={activeConnectedTool}
        setActiveConnectedTool={setActiveConnectedTool}
        connectedTaskId={connectedTaskId}
        setConnectedTaskId={setConnectedTaskId}
        overlayTaskId={overlayTaskId}
        customers={customers}
        updateProjectWithRule={updateProjectWithRule}
        localUpdateTask={localUpdateTask}
        confirmDialog={confirmDialog}
        setConfirmDialog={setConfirmDialog}
        
        ctApprovalSubject={ctApprovalSubject}
        setCtApprovalSubject={setCtApprovalSubject}
        ctApprovalType={ctApprovalType}
        setCtApprovalType={setCtApprovalType}
        ctApprovalSteps={ctApprovalSteps}
        setCtApprovalSteps={setCtApprovalSteps}
        ctApprovalLogs={ctApprovalLogs}
        setCtApprovalLogs={setCtApprovalLogs}
        ctApprovalCurrentStepIdx={ctApprovalCurrentStepIdx}
        setCtApprovalCurrentStepIdx={setCtApprovalCurrentStepIdx}
        
        ctCostType={ctCostType}
        setCtCostType={setCtCostType}
        ctContractorName={ctContractorName}
        setCtContractorName={setCtContractorName}
        ctAdvancePercentage={ctAdvancePercentage}
        setCtAdvancePercentage={setCtAdvancePercentage}
        ctExpenseRows={ctExpenseRows}
        setCtExpenseRows={setCtExpenseRows}
        ctCostLogs={ctCostLogs}
        setCtCostLogs={setCtCostLogs}
        lastCostProposalId={lastCostProposalId}
        setLastCostProposalId={setLastCostProposalId}
        ctCostProposalId={ctCostProposalId}
        setCtCostProposalId={setCtCostProposalId}
        ctCostDescription={ctCostDescription}
        setCtCostDescription={setCtCostDescription}
        ctCostApproverId={ctCostApproverId}
        setCtCostApproverId={setCtCostApproverId}
        ctCostSettlerId={ctCostSettlerId}
        setCtCostSettlerId={setCtCostSettlerId}
        ctCostProposalDate={ctCostProposalDate}
        setCtCostProposalDate={setCtCostProposalDate}
        
        ctMaterialRows={ctMaterialRows}
        setCtMaterialRows={setCtMaterialRows}
        ctMaterialLogs={ctMaterialLogs}
        setCtMaterialLogs={setCtMaterialLogs}
        ctMaterialCoordinationType={ctMaterialCoordinationType}
        setCtMaterialCoordinationType={setCtMaterialCoordinationType}
        ctMaterialCoordinatorId={ctMaterialCoordinatorId}
        setCtMaterialCoordinatorId={setCtMaterialCoordinatorId}
        
        ctQuoteSector={ctQuoteSector}
        setCtQuoteSector={setCtQuoteSector}
        ctQuoteTitle={ctQuoteTitle}
        setCtQuoteTitle={setCtQuoteTitle}
        ctQuoteRows={ctQuoteRows}
        setCtQuoteRows={setCtQuoteRows}
        
        ctDocSector={ctDocSector}
        setCtDocSector={setCtDocSector}
        ctDocRepA={ctDocRepA}
        setCtDocRepA={setCtDocRepA}
        ctDocPosA={ctDocPosA}
        setCtDocPosA={setCtDocPosA}
        ctDocRepB={ctDocRepB}
        setCtDocRepB={setCtDocRepB}
        ctDocPosB={ctDocPosB}
        setCtDocPosB={setCtDocPosB}
        ctDocWarranty={ctDocWarranty}
        setCtDocWarranty={setCtDocWarranty}
        ctDocLocation={ctDocLocation}
        setCtDocLocation={setCtDocLocation}
        ctDocAcceptRate={ctDocAcceptRate}
        setCtDocAcceptRate={setCtDocAcceptRate}
        ctDocSelectedQuoteId={ctDocSelectedQuoteId}
        setCtDocSelectedQuoteId={setCtDocSelectedQuoteId}
        ctDocTemplateId={ctDocTemplateId}
        setCtDocTemplateId={setCtDocTemplateId}
        ctDocCustomText={ctDocCustomText}
        setCtDocCustomText={setCtDocCustomText}
      />

      {/* Task Detail Modal overlay popup */}
      {overlayTaskId && (() => {
        const openedTaskObj = tasks.find(t => t.id === overlayTaskId);
        const activeUserObj = currentUser || employees.find(e => e.id === 'emp_1') || {
          id: 'emp_1',
          name: 'Trương Hữu Long',
          role: 'director',
          department: 'Ban Giám Đốc',
          phone: '',
          email: ''
        };
        const isReadOnlyTask = openedTaskObj
          ? (activeUserObj.role !== 'director' &&
             openedTaskObj.assigneeId !== activeUserObj.id &&
             openedTaskObj.assignerId !== activeUserObj.id &&
             (() => {
               const proj = projects.find(p => p.id === openedTaskObj?.projectId);
               return !proj || proj.pmId !== activeUserObj.id;
             })())
          : false;

        return (
          <TaskDetailModal
            taskId={overlayTaskId}
            onClose={() => setOverlayTaskId(null)}
            tasks={tasks}
            projects={projects}
            employees={employees}
            currentUser={activeUserObj}
            onUpdateTask={localUpdateTask}
            onUpdateProject={updateProjectWithRule}
            customers={customers}
            isReadOnly={isReadOnlyTask}
            onRedirectToSubcontractor={onRedirectToSubcontractor}
            onOpenConnectedTool={(tool) => {
              const task = tasks.find(t => t.id === overlayTaskId);
              if (task && task.projectId) {
                if (tool === 'quotation' && onRedirectToQuote) {
                  setOverlayTaskId(null); // Close the detail modal
                  onRedirectToQuote(task.projectId);
                  return;
                }
                
                setSelectedProjectId(task.projectId!);
                setConnectedTaskId(task.id);
                const proj = projects.find(p => p.id === task.projectId);
                if (proj) {
                  setActiveConnectedTool(tool);
                  if (tool === 'approval') {
                    setCtApprovalSubject(`Yêu cầu phê duyệt cho công trình: ${proj.name}`);
                  }
                  if (tool === 'cost') {
                    setCtCostType('expense-advance');
                  }
                  if (tool === 'quotation') {
                    setCtQuoteSector(proj.type === 'furniture' ? 'furniture' : proj.type === 'construction' ? 'construction' : 'mechanical');
                  }
                  if (tool === 'contract' || tool === 'acceptance' || tool === 'liquidation') {
                    setCtDocSector(proj.type === 'furniture' ? 'furniture' : proj.type === 'construction' ? 'construction' : 'mechanical');
                    if (tool === 'acceptance') {
                      setCtDocAcceptRate(proj.progress || 100);
                    }
                  }
                }
              }
            }}
          />
        );
      })()}

      {/* Custom Confirmation Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[300] p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 text-slate-200 shadow-2xl overflow-hidden animate-scaleIn">
            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 shrink-0 mt-0.5">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-[14px] text-white">
                  {confirmDialog.title}
                </h4>
                <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">
                  {confirmDialog.message}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-755 text-slate-300 font-bold text-[10px] rounded-lg cursor-pointer transition-colors"
              >
                {confirmDialog.cancelText || 'Hủy bỏ'}
              </button>
              {confirmDialog.onConfirm && (
                <button
                  type="button"
                  onClick={() => {
                    confirmDialog.onConfirm?.();
                    setConfirmDialog(null);
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-extrabold text-[10px] rounded-lg transition-all hover:scale-[1.02] cursor-pointer"
                >
                  {confirmDialog.confirmText || 'Xác nhận'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sub-task Edit Modal */}
      {editingSubTask && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-fadeIn overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 md:p-6 text-slate-200 shadow-2xl space-y-4 animate-scaleIn my-8">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-emerald-400" />
                <h3 className="text-[13px] uppercase font-black tracking-wider text-slate-100">
                  Sửa công việc con: {editingSubTask.code}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingSubTask(null)}
                className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-slate-400 font-bold mb-1 text-[10px] uppercase">Tên công việc con:</label>
                <input
                  type="text"
                  required
                  value={editSubName}
                  onChange={(e) => setEditSubName(e.target.value)}
                  placeholder="vd: Côn thô hàn định vị khung gầm rơ-moóc sườn"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none text-[11.5px] focus:border-emerald-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1 text-[10px] uppercase">Thời hạn (Deadline) <span className="text-rose-400">*</span>:</label>
                  <input
                    type="date"
                    required
                    value={editSubDeadline}
                    onChange={(e) => setEditSubDeadline(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none text-[11.5px] focus:border-emerald-500 font-mono font-medium"
                  />
                </div>
                {/* Đã xóa trường Độ ưu tiên theo yêu cầu */}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1 text-[10px] uppercase">Người giao việc <span className="text-rose-400">*</span>:</label>
                  <select
                    value={editSubAssignerId}
                    required
                    onChange={(e) => setEditSubAssignerId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-250 outline-none text-[11.5px] focus:border-emerald-500 font-medium"
                  >
                    <option value="">-- Chọn --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.department})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1 text-[10px] uppercase">Người thi hành chính <span className="text-rose-400">*</span>:</label>
                  <select
                    value={editSubAssigneeId}
                    required
                    onChange={(e) => setEditSubAssigneeId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-250 outline-none text-[11.5px] focus:border-emerald-500 font-medium"
                  >
                    <option value="">-- Chọn thợ mộc/cơ khí --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.department})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* CẤU HÌNH TỰ ĐỘNG CHO CÔNG VIỆC CON */}
              <div className="border border-slate-800 rounded-xl p-3 bg-slate-950/40 text-left space-y-3">
                <div className="space-y-2.5">

                  {/* 3. Các công tắc tự động (giống popup tham khảo) */}
                  <div className="space-y-3">
                    {/* Phê duyệt */}
                    <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Shield className={`w-4 h-4 ${editSubIsApprovalEnabled ? 'text-sky-400' : 'text-slate-600'}`} />
                          <div>
                            <span className="font-extrabold text-slate-200 text-[11px] block">Cấu hình Quy trình Phê duyệt</span>
                            <span className="text-[9.5px] text-slate-450 block">Mở nút "Yêu cầu phê duyệt" & Bắt buộc duyệt đối với việc con này</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const currentVal = editSubIsApprovalEnabled === true;
                            setEditSubIsApprovalEnabled(!currentVal);
                            if (!currentVal) {
                              setEditSubDefaultApproverId('');
                            }
                          }}
                          className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer relative duration-150 ${
                            editSubIsApprovalEnabled ? 'bg-sky-500' : 'subcontractor-toggle-orange-off'
                          }`}
                        >
                          <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-150 ${
                            editSubIsApprovalEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>
                      {editSubIsApprovalEnabled && (
                        <div className="mt-2.5 pt-2.5 border-t border-slate-800 space-y-1">
                          <label className="block text-[9px] font-black text-rose-400 uppercase tracking-wider">Người phê duyệt mặc định <span className="text-rose-400">*</span>:</label>
                          <SearchableEmployeeSelect
                            value={editSubDefaultApproverId || ''}
                            onChange={(val) => setEditSubDefaultApproverId(val || '')}
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
                          <DollarSign className={`w-4 h-4 ${editSubIsCostEnabled ? 'text-emerald-400' : 'text-slate-600'}`} />
                          <div>
                            <span className="font-extrabold text-slate-200 text-[11px] block">Cấu hình Đề xuất chi phí</span>
                            <span className="text-[9.5px] text-slate-450 block">Mở/Đóng nút "Đề xuất chi phí" trong chi tiết công việc con</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const currentVal = editSubIsCostEnabled === true;
                            setEditSubIsCostEnabled(!currentVal);
                            if (!currentVal) {
                              setEditSubCostApproverId('');
                              setEditSubCostSettlerId('');
                            }
                          }}
                          className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer relative duration-150 ${
                            editSubIsCostEnabled ? 'bg-emerald-500' : 'subcontractor-toggle-orange-off'
                          }`}
                        >
                          <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-150 ${
                            editSubIsCostEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>
                      {editSubIsCostEnabled && (
                        <div className="mt-2.5 pt-2.5 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="block text-[9px] font-black text-rose-400 uppercase tracking-wider">Người xét duyệt mặc định <span className="text-rose-400">*</span>:</label>
                            <SearchableEmployeeSelect
                              value={editSubCostApproverId || ''}
                              onChange={(val) => setEditSubCostApproverId(val || '')}
                              employees={employees}
                              placeholder="-- Mặc định (Giám đốc / PM) --"
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[9px] font-black text-rose-400 uppercase tracking-wider">Người quyết toán mặc định <span className="text-rose-400">*</span>:</label>
                            <SearchableEmployeeSelect
                              value={editSubCostSettlerId || ''}
                              onChange={(val) => setEditSubCostSettlerId(val || '')}
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
                          <Zap className={`w-4 h-4 ${editSubIsMaterialEnabled ? 'text-amber-400' : 'text-slate-600'}`} />
                          <div>
                            <span className="font-extrabold text-slate-200 text-[11px] block">Cấu hình Đề xuất vật tư</span>
                            <span className="text-[9.5px] text-slate-450 block">Mở/Đóng nút "Đề xuất vật tư" trong chi tiết công việc con</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const currentVal = editSubIsMaterialEnabled === true;
                            setEditSubIsMaterialEnabled(!currentVal);
                            if (!currentVal) {
                              setEditSubMaterialSelfCoordinated(false);
                              setEditSubMaterialCoordinatorId('');
                            }
                          }}
                          className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer relative duration-150 ${
                            editSubIsMaterialEnabled ? 'bg-amber-500' : 'subcontractor-toggle-orange-off'
                          }`}
                        >
                          <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-150 ${
                            editSubIsMaterialEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>
                    </div>

                    {/* Hồ sơ công trình */}
                    <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className={`w-4 h-4 ${editSubIsDocGenerationEnabled ? 'text-rose-400' : 'text-slate-600'}`} />
                          <div>
                            <span className="font-extrabold text-slate-200 text-[11px] block">Hồ sơ công trình</span>
                            <span className="text-[9.5px] text-slate-450 block">Mở bộ nút lưu trữ thiết kế</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditSubIsDocGenerationEnabled(!editSubIsDocGenerationEnabled)}
                          className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer relative duration-150 shrink-0 ${
                            editSubIsDocGenerationEnabled ? 'bg-rose-500' : 'subcontractor-toggle-orange-off'
                          }`}
                        >
                          <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-150 ${
                            editSubIsDocGenerationEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>
                    </div>

                    {/* Liên kết thầu phụ */}
                    <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Link className={`w-4 h-4 ${editSubSubcontractorEnabled ? 'text-orange-400' : 'text-slate-600'}`} />
                          <div>
                            <span className="font-extrabold text-slate-200 text-[11px] block">Cấu hình Liên kết Thầu phụ</span>
                            <span className="text-[9.5px] text-slate-450 block">Mở/Đóng nút "Liên kết Thầu phụ" trong chi tiết công việc con</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const currentVal = editSubSubcontractorEnabled === true;
                            setEditSubSubcontractorEnabled(!currentVal);
                            if (!currentVal) {
                              setEditSubSubcontractorApproverId('');
                              setEditSubSubcontractorSettlerId('');
                            }
                          }}
                          className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer relative duration-150 ${
                            editSubSubcontractorEnabled ? 'bg-orange-500' : 'subcontractor-toggle-orange-off'
                          }`}
                        >
                          <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-150 ${
                            editSubSubcontractorEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>
                      {editSubSubcontractorEnabled && (
                        <div className="mt-2.5 pt-2.5 border-t border-slate-800 space-y-3">
                          {/* Dropdown chọn thầu phụ từ localStorage (giữ logic cũ) */}
                          <div>
                            <label className="block text-orange-400 font-bold text-[9px] uppercase tracking-wider mb-1">Chọn Thầu Phụ từ Dữ Liệu Kế Toán <span className="text-rose-400">*</span>:</label>
                            <select
                              value={editSubSubcontractorId || ''}
                              onChange={(e) => {
                                const subId = e.target.value;
                                setEditSubSubcontractorId(subId);
                                const savedSuppliers = localStorage.getItem('hl_acc_suppliers');
                                let suppliers = [];
                                if (savedSuppliers) {
                                  try { suppliers = JSON.parse(savedSuppliers); } catch(err) {}
                                }
                                const matched = suppliers.find((s: any) => s.id === subId || s.code === subId);
                                if (matched) {
                                  setEditSubSubcontractorName(matched.name);
                                } else {
                                  const fallbackSuppliers = [
                                    { code: 'NTN_2', name: 'Công ty Cổ phần Thép tiền chế Nam Trung Nam' },
                                    { code: 'XD_1', name: 'Tổ thợ hồ móng cứng Bảo Lộc - Đại diện chú Ba' },
                                    { code: 'KM_3', name: 'Thợ kính cường lực Kim Minh' }
                                  ];
                                  const fbMatched = fallbackSuppliers.find(s => s.code === subId);
                                  if (fbMatched) {
                                    setEditSubSubcontractorName(fbMatched.name);
                                  }
                                }
                              }}
                              required
                              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 outline-none text-[10px] focus:border-orange-500 font-medium"
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
                                value={editSubSubcontractorApproverId || ''}
                                onChange={(val) => setEditSubSubcontractorApproverId(val || '')}
                                employees={employees}
                                placeholder="-- Mặc định (Giám đốc) --"
                                required
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-[9px] font-black text-rose-400 uppercase tracking-wider">Người quyết toán mặc định <span className="text-rose-400">*</span>:</label>
                              <SearchableEmployeeSelect
                                value={editSubSubcontractorSettlerId || ''}
                                onChange={(val) => setEditSubSubcontractorSettlerId(val || '')}
                                employees={employees}
                                placeholder="-- Mặc định (Kế toán) --"
                                required
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Checklist / Đo kiểm (sửa công việc con) */}
                  <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <CheckSquare className="w-4 h-4 text-amber-500 animate-pulse" />
                        <div>
                          <span className="font-extrabold text-slate-200 text-[11px] block text-left">Đầu mục đo kiểm / Checklist kỹ thuật</span>
                          <span className="text-[9.5px] text-slate-450 block text-left">Các bước thợ thi công phải đo, kiểm tra thực tế, chụp ảnh đối chứng</span>
                        </div>
                      </div>
                    </div>

                    {/* Danh sách các mục */}
                    {editSubChecklistTexts && editSubChecklistTexts.length > 0 ? (
                      <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                        {editSubChecklistTexts.map((chk: string, chkIdx: number) => {
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
                                  const updated = (editSubChecklistTexts || []).filter((_: any, i: number) => i !== chkIdx);
                                  setEditSubChecklistTexts(updated);
                                }}
                                className="text-slate-500 hover:text-rose-400 p-1 hover:bg-rose-950/20 rounded cursor-pointer transition-all shrink-0"
                                title="Xóa mục này"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-4 bg-slate-950/40 rounded-xl border border-dashed border-slate-800 text-slate-500 text-[10px]">
                        Chưa có cấu hình checklist.
                      </div>
                    )}

                    {/* Thêm mới */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        id="edit_checklist_input_subtask"
                        placeholder="VD: Kiểm tra kích thước phủ bì cánh tủ..."
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-[10.5px] text-slate-200 placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const inputEl = document.getElementById('edit_checklist_input_subtask') as HTMLInputElement;
                            if (inputEl && inputEl.value.trim()) {
                              const currentText = inputEl.value.trim();
                              const list = editSubChecklistTexts || [];
                              if (!list.includes(currentText)) {
                                setEditSubChecklistTexts([...list, currentText]);
                              }
                              inputEl.value = '';
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const inputEl = document.getElementById('edit_checklist_input_subtask') as HTMLInputElement;
                          if (inputEl && inputEl.value.trim()) {
                            const currentText = inputEl.value.trim();
                            const list = editSubChecklistTexts || [];
                            if (!list.includes(currentText)) {
                              setEditSubChecklistTexts([...list, currentText]);
                            }
                            inputEl.value = '';
                          }
                        }}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Thêm
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingSubTask(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-[10.5px] rounded-lg cursor-pointer transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveEditSubTask}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10.5px] rounded-lg transition-all hover:scale-[1.02] cursor-pointer shadow-md"
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===========================================================================
          SECTION 5: MODAL XEM TRƯỚC BÁO GIÁ PDF (Downloaded Quote Modal)
          Mở khi downloadedQuoteModal !== null
          Dùng QuotationTableSheet để hiển thị chi tiết báo giá (read-only)
          =========================================================================== */}
      {/* Tải Báo giá PDF Modal */}
      {downloadedQuoteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[220] p-4 animate-fadeIn select-text">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl text-slate-800 shadow-2xl overflow-hidden animate-scaleIn text-left">
            
            {/* Header of Popup */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-200">
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

    </div>
  );
}
