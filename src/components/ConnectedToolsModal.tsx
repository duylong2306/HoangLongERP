import React, { useEffect } from 'react';
import {
  Shield, DollarSign, Zap, FileText, Briefcase, CheckCircle2, Award, X, Trash2, Calculator, Sliders, AlertCircle, AlertTriangle
} from 'lucide-react';
import { Project, Employee, Task, Customer, ProjectDoc, SubcontractorAdvanceProposal, ApprovalStep, Supplier, InventoryItem } from '../types';
import { useNotification } from '../context';
import { dbService } from '../lib/dbService';
import { can as canProjectAction, loadProjectPermissions } from './hr/hrProjectPermissions';

export interface ConnectedToolsModalProps {
  currentUser?: Employee;
  employees: Employee[];
  tasks: Task[];
  selectedProject: Project | null;
  activeConnectedTool: 'approval' | 'cost' | 'material' | 'quotation' | 'contract' | 'acceptance' | 'liquidation' | null;
  setActiveConnectedTool: (tool: 'approval' | 'cost' | 'material' | 'quotation' | 'contract' | 'acceptance' | 'liquidation' | null) => void;
  connectedTaskId: string | null;
  setConnectedTaskId: (id: string | null) => void;
  overlayTaskId?: string | null;
  customers: Customer[];
  updateProjectWithRule: (projectId: string, updates: Partial<Project>) => void;
  localUpdateTask: (taskId: string, taskUpdates: Partial<Task>) => void;
  confirmDialog?: { title?: string; message: string; onConfirm?: () => void; confirmText?: string; cancelText?: string } | null;
  setConfirmDialog?: (dialog: { title?: string; message: string; onConfirm?: () => void; confirmText?: string; cancelText?: string } | null) => void;

  ctApprovalSubject?: string;
  setCtApprovalSubject?: (val: string) => void;
  ctApprovalType?: '1-level' | 'multi-level';
  setCtApprovalType?: (val: '1-level' | 'multi-level') => void;
  ctApprovalSteps?: ApprovalStep[];
  setCtApprovalSteps?: (val: ApprovalStep[]) => void;
  ctApprovalLogs?: string[];
  setCtApprovalLogs?: (val: string[]) => void;
  ctApprovalCurrentStepIdx?: number;
  setCtApprovalCurrentStepIdx?: (val: number) => void;

  ctCostType?: 'contractor-advance' | 'expense-advance';
  setCtCostType?: (val: 'contractor-advance' | 'expense-advance') => void;
  ctContractorName?: string;
  setCtContractorName?: (val: string) => void;
  ctAdvancePercentage?: number;
  setCtAdvancePercentage?: (val: number) => void;
  ctExpenseRows?: { id: string; item: string; amount: number; recipientId?: string; note: string }[];
  setCtExpenseRows?: (val: { id: string; item: string; amount: number; recipientId?: string; note: string }[]) => void;
  ctCostLogs?: string[];
  setCtCostLogs?: (val: string[]) => void;
  lastCostProposalId?: string | null;
  setLastCostProposalId?: (val: string | null) => void;
  ctCostProposalId?: string;
  setCtCostProposalId?: (val: string) => void;
  ctCostDescription?: string;
  setCtCostDescription?: (val: string) => void;
  ctCostApproverId?: string;
  setCtCostApproverId?: (val: string) => void;
  ctCostSettlerId?: string;
  setCtCostSettlerId?: (val: string) => void;
  ctCostProposalDate?: string;
  setCtCostProposalDate?: (val: string) => void;
  
  ctMaterialRows?: { id: string; name: string; qty: number; unit: string; spec: string; note?: string; availableQty?: number; price?: number }[];
  setCtMaterialRows?: (val: { id: string; name: string; qty: number; unit: string; spec: string; note?: string; availableQty?: number; price?: number }[]) => void;
  ctMaterialLogs?: string[];
  setCtMaterialLogs?: (val: string[]) => void;
  ctMaterialCoordinationType?: 'self' | 'assign';
  setCtMaterialCoordinationType?: (val: 'self' | 'assign') => void;
  ctMaterialCoordinatorId?: string;
  setCtMaterialCoordinatorId?: (val: string) => void;

  ctQuoteSector?: 'furniture' | 'construction' | 'mechanical';
  setCtQuoteSector?: (val: 'furniture' | 'construction' | 'mechanical') => void;
  ctQuoteTitle?: string;
  setCtQuoteTitle?: (val: string) => void;
  ctQuoteRows?: { id: string; desc: string; qty: number; unit: string; price: number; note: string }[];
  setCtQuoteRows?: (val: { id: string; desc: string; qty: number; unit: string; price: number; note: string }[]) => void;
  
  ctDocSector?: 'furniture' | 'construction' | 'mechanical';
  setCtDocSector?: (val: 'furniture' | 'construction' | 'mechanical') => void;
  ctDocRepA?: string;
  setCtDocRepA?: (val: string) => void;
  ctDocPosA?: string;
  setCtDocPosA?: (val: string) => void;
  ctDocRepB?: string;
  setCtDocRepB?: (val: string) => void;
  ctDocPosB?: string;
  setCtDocPosB?: (val: string) => void;
  ctDocWarranty?: string;
  setCtDocWarranty?: (val: string) => void;
  ctDocLocation?: string;
  setCtDocLocation?: (val: string) => void;
  ctDocAcceptRate?: number;
  setCtDocAcceptRate?: (val: number) => void;
  ctDocSelectedQuoteId?: string;
  setCtDocSelectedQuoteId?: (val: string) => void;
  ctDocTemplateId?: string;
  setCtDocTemplateId?: (val: string) => void;
  ctDocCustomText?: string;
  setCtDocCustomText?: (val: string) => void;
}

export default function ConnectedToolsModal(props: ConnectedToolsModalProps) {
  const {
    currentUser,
    employees,
    tasks,
    selectedProject,
    activeConnectedTool,
    setActiveConnectedTool,
    connectedTaskId,
    setConnectedTaskId,
    overlayTaskId = null,
    customers,
    updateProjectWithRule,
    localUpdateTask,
  } = props;
  const { addToast } = useNotification();

  // Local fallback states if not provided by props
  const [localConfirmDialog, setLocalConfirmDialog] = React.useState<{ title?: string; message: string; onConfirm?: () => void; confirmText?: string; cancelText?: string } | null>(null);
  const confirmDialog = props.confirmDialog !== undefined ? props.confirmDialog : localConfirmDialog;
  const setConfirmDialog = props.setConfirmDialog || setLocalConfirmDialog;

  const [localCtApprovalSubject, setLocalCtApprovalSubject] = React.useState('');
  const ctApprovalSubject = props.ctApprovalSubject !== undefined ? props.ctApprovalSubject : localCtApprovalSubject;
  const setCtApprovalSubject = props.setCtApprovalSubject || setLocalCtApprovalSubject;

  const [localCtApprovalType, setLocalCtApprovalType] = React.useState<'1-level' | 'multi-level'>('1-level');
  const ctApprovalType = props.ctApprovalType !== undefined ? props.ctApprovalType : localCtApprovalType;
  const setCtApprovalType = props.setCtApprovalType || setLocalCtApprovalType;

  const [localCtApprovalSteps, setLocalCtApprovalSteps] = React.useState<ApprovalStep[]>([]);
  const ctApprovalSteps = props.ctApprovalSteps !== undefined ? props.ctApprovalSteps : localCtApprovalSteps;
  const setCtApprovalSteps = props.setCtApprovalSteps || setLocalCtApprovalSteps;

  const [localCtApprovalLogs, setLocalCtApprovalLogs] = React.useState<string[]>([]);
  const ctApprovalLogs = props.ctApprovalLogs !== undefined ? props.ctApprovalLogs : localCtApprovalLogs;
  const setCtApprovalLogs = props.setCtApprovalLogs || setLocalCtApprovalLogs;

  const [localCtApprovalCurrentStepIdx, setLocalCtApprovalCurrentStepIdx] = React.useState(0);
  const ctApprovalCurrentStepIdx = props.ctApprovalCurrentStepIdx !== undefined ? props.ctApprovalCurrentStepIdx : localCtApprovalCurrentStepIdx;
  const setCtApprovalCurrentStepIdx = props.setCtApprovalCurrentStepIdx || setLocalCtApprovalCurrentStepIdx;

  const [localCtCostType, setLocalCtCostType] = React.useState<'contractor-advance' | 'expense-advance'>('expense-advance');
  const ctCostType = props.ctCostType !== undefined ? props.ctCostType : localCtCostType;
  const setCtCostType = props.setCtCostType || setLocalCtCostType;

  const [localCtContractorName, setLocalCtContractorName] = React.useState('');
  const ctContractorName = props.ctContractorName !== undefined ? props.ctContractorName : localCtContractorName;
  const setCtContractorName = props.setCtContractorName || setLocalCtContractorName;

  const [localCtAdvancePercentage, setLocalCtAdvancePercentage] = React.useState(0);
  const ctAdvancePercentage = props.ctAdvancePercentage !== undefined ? props.ctAdvancePercentage : localCtAdvancePercentage;
  const setCtAdvancePercentage = props.setCtAdvancePercentage || setLocalCtAdvancePercentage;

  const [localCtExpenseRows, setLocalCtExpenseRows] = React.useState<{ id: string; item: string; amount: number; recipientId?: string; note: string }[]>([]);
  const ctExpenseRows = props.ctExpenseRows !== undefined ? props.ctExpenseRows : localCtExpenseRows;
  const setCtExpenseRows = props.setCtExpenseRows || setLocalCtExpenseRows;

  const [localCtCostLogs, setLocalCtCostLogs] = React.useState<string[]>([]);
  const ctCostLogs = props.ctCostLogs !== undefined ? props.ctCostLogs : localCtCostLogs;
  const setCtCostLogs = props.setCtCostLogs || setLocalCtCostLogs;

  const [localLastCostProposalId, setLocalLastCostProposalId] = React.useState<string | null>(null);
  const lastCostProposalId = props.lastCostProposalId !== undefined ? props.lastCostProposalId : localLastCostProposalId;
  const setLastCostProposalId = props.setLastCostProposalId || setLocalLastCostProposalId;

  const [localCtCostProposalId, setLocalCtCostProposalId] = React.useState('');
  const ctCostProposalId = props.ctCostProposalId !== undefined ? props.ctCostProposalId : localCtCostProposalId;
  const setCtCostProposalId = props.setCtCostProposalId || setLocalCtCostProposalId;

  const [localCtCostDescription, setLocalCtCostDescription] = React.useState('');
  const ctCostDescription = props.ctCostDescription !== undefined ? props.ctCostDescription : localCtCostDescription;
  const setCtCostDescription = props.setCtCostDescription || setLocalCtCostDescription;

  const [localCtCostApproverId, setLocalCtCostApproverId] = React.useState('');
  const ctCostApproverId = props.ctCostApproverId !== undefined ? props.ctCostApproverId : localCtCostApproverId;
  const setCtCostApproverId = props.setCtCostApproverId || setLocalCtCostApproverId;

  const [localCtCostSettlerId, setLocalCtCostSettlerId] = React.useState('');
  const ctCostSettlerId = props.ctCostSettlerId !== undefined ? props.ctCostSettlerId : localCtCostSettlerId;
  const setCtCostSettlerId = props.setCtCostSettlerId || setLocalCtCostSettlerId;

  const [localCtCostProposalDate, setLocalCtCostProposalDate] = React.useState('');
  const ctCostProposalDate = props.ctCostProposalDate !== undefined ? props.ctCostProposalDate : localCtCostProposalDate;
  const setCtCostProposalDate = props.setCtCostProposalDate || setLocalCtCostProposalDate;

  const [localCtMaterialRows, setLocalCtMaterialRows] = React.useState<{ id: string; name: string; qty: number; unit: string; spec: string; note?: string; availableQty?: number; price?: number }[]>([]);
  const ctMaterialRows = props.ctMaterialRows !== undefined ? props.ctMaterialRows : localCtMaterialRows;
  const setCtMaterialRows = props.setCtMaterialRows || setLocalCtMaterialRows;

  const [localCtMaterialLogs, setLocalCtMaterialLogs] = React.useState<string[]>([]);
  const ctMaterialLogs = props.ctMaterialLogs !== undefined ? props.ctMaterialLogs : localCtMaterialLogs;
  const setCtMaterialLogs = props.setCtMaterialLogs || setLocalCtMaterialLogs;

  const [localCtMaterialCoordinationType, setLocalCtMaterialCoordinationType] = React.useState<'self' | 'assign'>('self');
  const ctMaterialCoordinationType = props.ctMaterialCoordinationType !== undefined ? props.ctMaterialCoordinationType : localCtMaterialCoordinationType;
  const setCtMaterialCoordinationType = props.setCtMaterialCoordinationType || setLocalCtMaterialCoordinationType;

  const [localCtMaterialCoordinatorId, setLocalCtMaterialCoordinatorId] = React.useState('');
  const ctMaterialCoordinatorId = props.ctMaterialCoordinatorId !== undefined ? props.ctMaterialCoordinatorId : localCtMaterialCoordinatorId;
  const setCtMaterialCoordinatorId = props.setCtMaterialCoordinatorId || setLocalCtMaterialCoordinatorId;

  // Custom states for types of material proposals
  const [ctMaterialProposalType, setCtMaterialProposalType] = React.useState<'warehouse' | 'supplier'>('warehouse');
  const [ctMaterialSupplierId, setCtMaterialSupplierId] = React.useState('');
  const [ctMaterialSupplierSearch, setCtMaterialSupplierSearch] = React.useState('');
  const [isAddingNewSupplierFast, setIsAddingNewSupplierFast] = React.useState(false);
  const [newSupplierName, setNewSupplierName] = React.useState('');
  const [newSupplierField, setNewSupplierField] = React.useState('Vật liệu xây dựng & Nội thất');
  const [newSupplierPhone, setNewSupplierPhone] = React.useState('');
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = React.useState(false);

  const [suppliers, setSuppliers] = React.useState<Supplier[]>(() => {
    const saved = localStorage.getItem('hl_acc_suppliers');
    if (saved) {
      try { return JSON.parse(saved); } catch(e) {}
    }
    return [
      { id: 'SUP_001', name: 'Công ty Gỗ An Cường Đà Lạt', representative: 'Phạm Minh Trí', phone: '0912345678', email: 'sales@ancuongdalat.vn', address: '12 Đường 3 Tháng 2, Đà Lạt', field: 'Cung cấp gỗ ván mộc mạc', bankAccount: '11200003456', bankName: 'VietinBank', note: 'Đơn vị phân phối vách MDF chính thức', debt: 15400000 },
      { id: 'SUP_002', name: 'Đại lý Sắt Thép Hoa Sen Đức Trọng', representative: 'Lê Văn Sen', phone: '0905678123', email: 'contact@hoasenductrong.com', address: 'Quốc Lộ 20, Đức Trọng', field: 'Sắt thép dầm cơ khí', bankAccount: '190300400500', bankName: 'Techcombank', note: 'Chuyên thép hộp chịu lực công trình', debt: 34200000 },
      { id: 'SUP_003', name: 'Kính Mỹ Thuật Đại Việt Lâm Đồng', representative: 'Lê Đại Việt', phone: '0933444555', email: 'daivietglass@gmail.com', address: 'Đức Trọng', field: 'Kính mài, kính thủy lực', bankAccount: '190203040506', bankName: 'Techcombank', note: 'Chuyên kính sấy nhiệt, hoa văn mài cạnh', debt: 0 }
    ];
  });

  const [inventory, setInventory] = React.useState<InventoryItem[]>(() => {
    const saved = localStorage.getItem('hl_acc_inventory');
    if (saved) {
      try { return JSON.parse(saved); } catch(e) {}
    }
    return [
      { id: 'mt_1', code: 'MDF-AC-18', name: 'Tấm Gỗ MDF chống ẩm An Cường 18mm', unit: 'Tấm', qty: 450, unitPrice: 380000, minAlert: 50, location: 'Kho lớn xưởng mộc' },
      { id: 'mt_2', code: 'STH-HS-48', name: 'Sắt hộp mạ kẽm Hoa Sen 40x80', unit: 'Cây', qty: 120, unitPrice: 210000, minAlert: 30, location: 'Xưởng cơ khí sắt' },
      { id: 'mt_3', code: 'KCL-DV-10', name: 'Kính cường lực mài cạnh bóng 10mm', unit: 'M2', qty: 85, unitPrice: 750000, minAlert: 15, location: 'Kho phụ trung chuyển' },
      { id: 'mt_4', code: 'SNT-XP-20', name: 'Sơn lót phủ Acrylic sấy nhiệt bóng', unit: 'Thùng 18L', qty: 35, unitPrice: 1200000, minAlert: 10, location: 'Kho sơn xưởng mộc' },
      { id: 'mt_5', code: 'QA-BL-90', name: 'Bản lề giảm chấn Hafele kịch tủ', unit: 'Cái', qty: 950, unitPrice: 42000, minAlert: 100, location: 'Kệ phụ kiện tổng' }
    ];
  });

  const [localCtQuoteSector, setLocalCtQuoteSector] = React.useState<'furniture' | 'construction' | 'mechanical'>('furniture');
  const ctQuoteSector = props.ctQuoteSector !== undefined ? props.ctQuoteSector : localCtQuoteSector;
  const setCtQuoteSector = props.setCtQuoteSector || setLocalCtQuoteSector;

  const [localCtQuoteTitle, setLocalCtQuoteTitle] = React.useState('');
  const ctQuoteTitle = props.ctQuoteTitle !== undefined ? props.ctQuoteTitle : localCtQuoteTitle;
  const setCtQuoteTitle = props.setCtQuoteTitle || setLocalCtQuoteTitle;

  const [localCtQuoteRows, setLocalCtQuoteRows] = React.useState<{ id: string; desc: string; qty: number; unit: string; price: number; note: string }[]>([]);
  const ctQuoteRows = props.ctQuoteRows !== undefined ? props.ctQuoteRows : localCtQuoteRows;
  const setCtQuoteRows = props.setCtQuoteRows || setLocalCtQuoteRows;

  const [localCtDocSector, setLocalCtDocSector] = React.useState<'furniture' | 'construction' | 'mechanical'>('furniture');
  const ctDocSector = props.ctDocSector !== undefined ? props.ctDocSector : localCtDocSector;
  const setCtDocSector = props.setCtDocSector || setLocalCtDocSector;

  const [localCtDocRepA, setLocalCtDocRepA] = React.useState('');
  const ctDocRepA = props.ctDocRepA !== undefined ? props.ctDocRepA : localCtDocRepA;
  const setCtDocRepA = props.setCtDocRepA || setLocalCtDocRepA;

  const [localCtDocPosA, setLocalCtDocPosA] = React.useState('');
  const ctDocPosA = props.ctDocPosA !== undefined ? props.ctDocPosA : localCtDocPosA;
  const setCtDocPosA = props.setCtDocPosA || setLocalCtDocPosA;

  const [localCtDocRepB, setLocalCtDocRepB] = React.useState('');
  const ctDocRepB = props.ctDocRepB !== undefined ? props.ctDocRepB : localCtDocRepB;
  const setCtDocRepB = props.setCtDocRepB || setLocalCtDocRepB;

  const [localCtDocPosB, setLocalCtDocPosB] = React.useState('');
  const ctDocPosB = props.ctDocPosB !== undefined ? props.ctDocPosB : localCtDocPosB;
  const setCtDocPosB = props.setCtDocPosB || setLocalCtDocPosB;

  const [localCtDocWarranty, setLocalCtDocWarranty] = React.useState('');
  const ctDocWarranty = props.ctDocWarranty !== undefined ? props.ctDocWarranty : localCtDocWarranty;
  const setCtDocWarranty = props.setCtDocWarranty || setLocalCtDocWarranty;

  const [localCtDocLocation, setLocalCtDocLocation] = React.useState('');
  const ctDocLocation = props.ctDocLocation !== undefined ? props.ctDocLocation : localCtDocLocation;
  const setCtDocLocation = props.setCtDocLocation || setLocalCtDocLocation;

  const [localCtDocAcceptRate, setLocalCtDocAcceptRate] = React.useState(0);
  const ctDocAcceptRate = props.ctDocAcceptRate !== undefined ? props.ctDocAcceptRate : localCtDocAcceptRate;
  const setCtDocAcceptRate = props.setCtDocAcceptRate || setLocalCtDocAcceptRate;

  const [localCtDocSelectedQuoteId, setLocalCtDocSelectedQuoteId] = React.useState('');
  const ctDocSelectedQuoteId = props.ctDocSelectedQuoteId !== undefined ? props.ctDocSelectedQuoteId : localCtDocSelectedQuoteId;
  const setCtDocSelectedQuoteId = props.setCtDocSelectedQuoteId || setLocalCtDocSelectedQuoteId;

  const [localCtDocTemplateId, setLocalCtDocTemplateId] = React.useState('');
  const ctDocTemplateId = props.ctDocTemplateId !== undefined ? props.ctDocTemplateId : localCtDocTemplateId;
  const setCtDocTemplateId = props.setCtDocTemplateId || setLocalCtDocTemplateId;

  const [localCtDocCustomText, setLocalCtDocCustomText] = React.useState('');
  const ctDocCustomText = props.ctDocCustomText !== undefined ? props.ctDocCustomText : localCtDocCustomText;
  const setCtDocCustomText = props.setCtDocCustomText || setLocalCtDocCustomText;

  const activeTask = tasks.find(t => t.id === connectedTaskId || t.id === overlayTaskId);
  const assigner = activeTask ? employees.find(e => e.id === activeTask.assignerId) : null;
  const [customApproverId, setCustomApproverId] = React.useState('');

  // ─── Phân quyền Connected Tools ─────────────────────────────────────
  const ctMatrix = loadProjectPermissions();
  const ctApproval = canProjectAction('openToolApproval', currentUser, selectedProject ?? undefined, activeTask, ctMatrix);
  const ctCost = canProjectAction('openToolCost', currentUser, selectedProject ?? undefined, activeTask, ctMatrix);
  const ctMaterial = canProjectAction('openToolMaterial', currentUser, selectedProject ?? undefined, activeTask, ctMatrix);
  const ctQuotation = canProjectAction('openToolQuotation', currentUser, selectedProject ?? undefined, activeTask, ctMatrix);
  const ctContract = canProjectAction('openToolContract', currentUser, selectedProject ?? undefined, activeTask, ctMatrix);
  const ctAcceptance = canProjectAction('openToolAcceptance', currentUser, selectedProject ?? undefined, activeTask, ctMatrix);
  const ctLiquidation = canProjectAction('openToolLiquidation', currentUser, selectedProject ?? undefined, activeTask, ctMatrix);
  const ctManageDocs = canProjectAction('manageDocs', currentUser, selectedProject ?? undefined, activeTask, ctMatrix);
  // ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (activeConnectedTool === 'approval' && activeTask) {
      const defaultId = activeTask.defaultApproverId || assigner?.id || activeTask.assignerId || employees.find(e => e.role === 'director')?.id || employees[0]?.id || '';
      setCustomApproverId(defaultId);
    }
  }, [activeConnectedTool, activeTask, assigner, employees]);

  const handleConfirmApprovalRequest = () => {
    if (!activeTask) return;

    // 1. Determine approver
    const approverId = customApproverId || assigner?.id || activeTask.assignerId || employees.find(e => e.role === 'director')?.id || employees[0]?.id || currentUser?.id || 'emp_1';
    const approverName = employees.find(e => e.id === approverId)?.name || 'Người quản lý / Người giao việc';

    // 2. Prepare approvals
    const updatedApprovals = [
      ...(activeTask.approvals || []),
      {
        id: `app_ct_${Date.now()}`,
        levelName: 'Ủy quyền duyệt một cấp dán chỉ mộc',
        approverId: approverId,
        status: 'pending' as const
      }
    ];

    // 3. Prepare worklogs
    const currentWorkLogs = activeTask.workLogs || [];
    const newWorkLog = {
      id: `wl_request_approval_${Date.now()}`,
      actorId: currentUser?.id || 'emp_1',
      actorName: currentUser?.name || 'Người dùng',
      action: 'Yêu Cầu Phê Duyệt',
      timestamp: new Date().toISOString(),
      notes: `${currentUser?.name || 'Người dùng'} đã gửi Yêu sầu duyệt tự động. Người duyệt chính: ${approverName}`
    };

    // 4. Prepare comments
    const timestamp = new Date().toISOString();
    const newComment = {
      id: `comment_ct_${Date.now()}`,
      senderId: currentUser?.id || 'emp_1',
      senderName: currentUser?.name || 'Người dùng',
      senderRole: currentUser?.role || 'staff',
      content: `🔔 [HỆ THỐNG LIÊN THÔNG BÁO CÁO]: Đã thiết lập yêu cầu phê duyệt liên thông tự động: "Ủy quyền duyệt một cấp dán chỉ mộc". Người duyệt: ${approverName}. Kính trình xem xét kết quả.`,
      createdAt: timestamp
    };

    localUpdateTask(activeTask.id, {
      status: 'reviewing',
      completionRate: 90,
      approvals: updatedApprovals,
      workLogs: [...currentWorkLogs, newWorkLog],
      comments: [newComment, ...(activeTask.comments || [])]
    });

    setActiveConnectedTool(null);
    setConnectedTaskId(null);
    addToast({ title: '✅ Thành công', message: 'Đã gửi yêu cầu phê duyệt liên thông tự động thành công!', type: 'success' });
  };

  // Hàm sinh nội dung văn bản thầu tự động dồi dào từ Báo giá nguồn & Mẫu văn bản
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
  }, [activeConnectedTool, selectedProject?.id]);

  useEffect(() => {
    if (activeConnectedTool === 'cost') {
      const generatedId = `DX-EXP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;
      setCtCostProposalId(generatedId);
      
      const director = employees.find(e => e.role === 'director');
      const pm = employees.find(e => e.role === 'pm');
      const accountant = employees.find(e => e.role === 'accountant');
      
      setCtCostApproverId(activeTask?.costApproverId || director?.id || pm?.id || employees[0]?.id || '');
      setCtCostSettlerId(activeTask?.costSettlerId || accountant?.id || director?.id || employees[0]?.id || '');
      setCtCostDescription('Đề xuất chi phí mua sắm lẻ phát sinh phục vụ thi công công trình');
      setCtCostProposalDate(new Date().toISOString().split('T')[0]);
      setCtExpenseRows([{ id: `row_init_${Date.now()}`, item: '', amount: 0, recipientId: employees[0]?.id || '', note: '' }]);
    }
  }, [activeConnectedTool, connectedTaskId, overlayTaskId, activeTask]);

  useEffect(() => {
    if (activeConnectedTool === 'material') {
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
      setCtMaterialRows([{ id: `mat_init_${Date.now()}`, name: '', qty: 1, unit: 'Bộ', spec: '' }]);
    }
  }, [activeConnectedTool, connectedTaskId, overlayTaskId, activeTask]);

  if (activeConnectedTool === 'approval') {
    if (!activeTask) return null;

    return (
      <div 
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999] text-slate-100 font-sans animate-fadeIn select-text"
        onClick={(e) => {
          e.stopPropagation();
          setActiveConnectedTool(null);
          setConnectedTaskId(null);
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
              #{activeTask.code} - {activeTask.name}
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
                {employees.map((emp: any) => (
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
              onClick={() => {
                setActiveConnectedTool(null);
                setConnectedTaskId(null);
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-755 text-slate-300 font-bold rounded-xl cursor-pointer transition text-xs border-none"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={() => {
                if (!ctApproval) {
                  addToast({ title: '⛔ Không có quyền', message: 'Tài khoản của bạn không có quyền GỬI DUYỆT qua Công cụ liên thông.', type: 'error' });
                  return;
                }
                handleConfirmApprovalRequest();
              }}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl cursor-pointer shadow-sm transition hover:scale-103 active:scale-97 text-xs border-none"
            >
              Xác nhận & Gửi yêu cầu
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!activeConnectedTool) return null;

  if (!selectedProject) {
    return (
      <div
        className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-[150] animate-fadeIn select-text text-slate-200"
        onClick={(e) => {
          e.stopPropagation();
          setActiveConnectedTool(null);
          setConnectedTaskId(null);
        }}
      >
        <div
          className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2.5 text-amber-500 mb-3">
            <AlertCircle className="w-5 h-5" />
            <h3 className="font-extrabold text-[14px] text-white">Không tìm thấy Dự án</h3>
          </div>
          <p className="text-[12px] text-slate-300 mb-4 leading-relaxed">
            Không thể mở Công cụ liên thông vì dự án liên kết của công việc này không tồn tại hoặc đã bị xóa khỏi hệ thống.
          </p>
          <div className="flex justify-end">
            <button
              onClick={() => {
                setActiveConnectedTool(null);
                setConnectedTaskId(null);
              }}
              className="bg-slate-800 hover:bg-slate-755 text-white px-4 py-2 rounded-xl cursor-pointer transition-colors font-bold text-[12px]"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[150] p-4 overflow-y-auto animate-fadeIn select-text text-slate-200" 
      id="connected-tools-modal"
      onClick={(e) => {
        e.stopPropagation();
        setActiveConnectedTool(null);
        setConnectedTaskId(null);
      }}
    >
      <div 
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl p-6 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-4"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Header */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${
              (activeConnectedTool as any) === 'approval' ? 'bg-sky-500/10 text-sky-400' :
              activeConnectedTool === 'cost' ? 'bg-emerald-500/10 text-emerald-400' :
              activeConnectedTool === 'material' ? 'bg-amber-500/10 text-amber-400' :
              activeConnectedTool === 'quotation' ? 'bg-indigo-500/10 text-indigo-400' :
              'bg-rose-500/10 text-rose-400'
            }`}>
              {(activeConnectedTool as any) === 'approval' && <Shield className="w-5 h-5" />}
              {activeConnectedTool === 'cost' && <DollarSign className="w-5 h-5" />}
              {activeConnectedTool === 'material' && <Zap className="w-5 h-5" />}
              {activeConnectedTool === 'quotation' && <FileText className="w-5 h-5" />}
              {activeConnectedTool === 'contract' && <Briefcase className="w-5 h-5" />}
              {activeConnectedTool === 'acceptance' && <CheckCircle2 className="w-5 h-5" />}
              {activeConnectedTool === 'liquidation' && <Award className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-extrabold text-[15px] text-white">
                {(activeConnectedTool as any) === 'approval' && 'YÊU CẦU PHÊ DUYỆT LIÊN THÔNG'}
                {activeConnectedTool === 'cost' && 'ĐỀ XUẤT TẠM ỨNG'}
                {activeConnectedTool === 'material' && 'ĐỀ XUẤT CUNG ỨNG VẬT TƯ & VÂN GỖ'}
                {activeConnectedTool === 'quotation' && 'LẬP BÁO GIÁ THẦU DỰ ÁN'}
                {activeConnectedTool === 'contract' && 'BIÊN SOẠN HỢP ĐỒNG KINH TẾ'}
                {activeConnectedTool === 'acceptance' && 'BIÊN BẢN NGHIỆM THU TIẾN ĐỘ'}
                {activeConnectedTool === 'liquidation' && 'BIÊN BẢN THANH LÝ QUYẾT TOÁN'}
              </h3>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                Mã dự án: <span className="font-bold text-indigo-400">{selectedProject.code}</span> • Tên dự án: <span className="font-bold text-white">{selectedProject.name}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={() => {
              setActiveConnectedTool(null);
              setConnectedTaskId(null);
              setCtApprovalLogs([]);
              setCtApprovalCurrentStepIdx(0);
              setCtCostLogs([]);
              setCtMaterialLogs([]);
            }}
            className="p-1.5 bg-slate-800 hover:bg-slate-755 text-slate-400 hover:text-white rounded-lg cursor-pointer transition-colors"
            title="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto py-5 pr-1 space-y-5 text-[11px] leading-relaxed">
          
          {/* 1. YÊU CẦU PHÊ DUYỆT */}
          {(activeConnectedTool as any) === 'approval' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3 bg-slate-950/40 p-4 border border-slate-800/80 rounded-xl">
                  <h4 className="font-extrabold text-white text-[12px] border-b border-slate-800 pb-1.5 flex items-center justify-between">
                    <span>Thông tin ý kiến phê duyệt</span>
                    <span className="text-[10px] text-emerald-400 font-mono">Đang soạn thảo</span>
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] text-slate-400 block font-bold mb-1">Mục đích/Nội dung trình ký:</label>
                      <input 
                        type="text" 
                        value={ctApprovalSubject} 
                        onChange={(e) => setCtApprovalSubject(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white outline-none focus:border-indigo-500 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block font-bold mb-1">Cấp bậc phê duyệt:</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setCtApprovalType('1-level');
                            setCtApprovalLogs([]);
                            setCtApprovalCurrentStepIdx(0);
                          }}
                          className={`py-1.5 rounded font-black text-center border cursor-pointer text-[10px] ${
                            ctApprovalType === '1-level' 
                              ? 'bg-sky-500/10 border-sky-400 text-sky-400' 
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          Duyệt 1 Cấp (Nhanh)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCtApprovalType('multi-level');
                            setCtApprovalLogs([]);
                            setCtApprovalCurrentStepIdx(0);
                          }}
                          className={`py-1.5 rounded font-black text-center border cursor-pointer text-[10px] ${
                            ctApprovalType === 'multi-level' 
                              ? 'bg-indigo-500/10 border-indigo-400 text-indigo-400' 
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          Duyệt Nhiều Cấp (Liên phòng)
                        </button>
                      </div>
                    </div>

                    {ctApprovalType === '1-level' ? (
                      <div>
                        {/* Chọn người duyệt */}
                        <label className="block text-slate-455 text-[10px] uppercase font-bold tracking-wider font-sans">Người phê duyệt</label>
                        <select
                          value={ctApprovalSteps[0]?.approverId || ''}
                          onChange={(e) => {
                            const empId = e.target.value;
                            const newSteps = [{ id: 'step_1', levelName: 'Ủy quyền duyệt một cấp', approverId: empId, status: 'pending' as const }];
                            setCtApprovalSteps(newSteps);
                            setCtApprovalLogs([]);
                            setCtApprovalCurrentStepIdx(0);
                          }}
                          className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 w-full text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-sans cursor-pointer"
                        >
                          <option value="">Chọn người duyệt...</option>
                          {employees.map((emp: any) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.name} ({emp.role})
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-400 block font-bold">Thứ tự các phòng ban duyệt:</label>
                        <div className="space-y-2">
                          {ctApprovalSteps.map((step, idx) => (
                            <div key={step.id} className="flex gap-2 items-center bg-slate-900 duration-150 p-2 border border-slate-800 rounded-lg">
                              <span className="font-mono text-indigo-400 font-extrabold w-4">{idx + 1}.</span>
                              <div className="flex-1 space-y-1">
                                <input 
                                  type="text" 
                                  value={step.levelName}
                                  onChange={(e) => {
                                    const next = [...ctApprovalSteps];
                                    next[idx].levelName = e.target.value;
                                    setCtApprovalSteps(next);
                                  }}
                                  className="bg-transparent text-white font-bold border-b border-transparent hover:border-slate-800 focus:border-indigo-500 text-[10px] outline-none w-full"
                                />
                                <select
                                  value={step.approverId}
                                  onChange={(e) => {
                                    const next = [...ctApprovalSteps];
                                    next[idx].approverId = e.target.value;
                                    setCtApprovalSteps(next);
                                    setCtApprovalLogs([]);
                                    setCtApprovalCurrentStepIdx(0);
                                  }}
                                  className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 w-full text-[10px] text-slate-200 focus:outline-none focus:border-emerald-500 font-sans cursor-pointer"
                                >
                                  <option value="">Chọn người duyệt...</option>
                                  {employees.map((emp: any) => (
                                    <option key={emp.id} value={emp.id}>
                                      {emp.name} ({emp.role})
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (ctApprovalSteps.length <= 1) { addToast({ title: '⚠️ Lỗi', message: 'Phê duyệt nhiều cấp cần tối thiểu 1 cấp duyệt!', type: 'warning' }); return; }
                                  setCtApprovalSteps(ctApprovalSteps.filter((s: any) => s.id !== step.id));
                                  setCtApprovalLogs([]);
                                  setCtApprovalCurrentStepIdx(0);
                                }}
                                className="p-1 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                                title="Xóa cấp"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newStepId = `step_auto_${Date.now()}`;
                            setCtApprovalSteps([...ctApprovalSteps, {
                              id: newStepId,
                              levelName: `Cấp ${ctApprovalSteps.length + 1}: Phòng rà soát mới`,
                              approverId: employees[4]?.id || 'emp_5',
                              status: 'pending'
                            }]);
                            setCtApprovalLogs([]);
                            setCtApprovalCurrentStepIdx(0);
                          }}
                          className="text-[9.5px] bg-slate-900 hover:bg-slate-800 text-indigo-400 hover:text-indigo-300 font-bold px-2 py-1 rounded border border-dashed border-slate-850 w-full transition-colors"
                        >
                          + Thêm cấp duyệt mới
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        if (!ctApprovalSubject) { addToast({ title: '⚠️ Thiếu thông tin', message: 'Nhập tiêu đề hoặc ý kiến phê duyệt!', type: 'warning' }); return; }
                        const initialLog = `[${new Date().toLocaleTimeString()}] - 🔔 Hệ thống: Đã kích hoạt Khởi tạo quy trình phê duyệt "${ctApprovalSubject}".`;
                        const targetEmpName = employees.find(e => e.id === ctApprovalSteps[0]?.approverId)?.name || 'Người kiểm định';
                        const alertLog = `[${new Date().toLocaleTimeString()}] - Zalo & SMS Notification Sent: Đã gửi thông báo rà soát trình ký tới người duyệt "${targetEmpName}". Trạng thái: Chờ duyệt cấp này...`;
                        setCtApprovalLogs([initialLog, alertLog]);
                        setCtApprovalCurrentStepIdx(0);
                        
                        // Reset statuses of steps to pending
                        setCtApprovalSteps(ctApprovalSteps.map((s: any) => ({ ...s, status: 'pending' })));

                        // Live synchronize task status to 'reviewing' (Chờ phê duyệt)
                        const taskIdToUse = connectedTaskId || overlayTaskId;
                        if (taskIdToUse) {
                          const activeTask = tasks.find(t => t.id === taskIdToUse);
                          if (activeTask) {
                            const activeUser = employees.find(e => e.id === 'emp_1') || { id: 'emp_1', name: 'Trương Hữu Long' };
                            const currentWorkLogs = activeTask.workLogs || [];
                            const newWorkLog = {
                              id: `wl_req_ct_${Date.now()}`,
                              actorId: activeUser.id,
                              actorName: activeUser.name,
                              action: 'Yêu Cầu Phê Duyệt',
                              timestamp: new Date().toISOString(),
                              notes: `Gửi hồ sơ duyệt điện tử thông qua Công cụ liên thông. Chờ ${targetEmpName} duyệt cấp đầu tiên.`
                            };
                            localUpdateTask(taskIdToUse, {
                              status: 'reviewing',
                              completionRate: 90,
                              workLogs: [...currentWorkLogs, newWorkLog]
                            });
                          }
                        }
                      }}
                      className="w-full bg-sky-600 hover:bg-sky-500 text-slate-950 font-black text-[11px] py-2.5 rounded-xl text-white transition-all hover:scale-[1.01] cursor-pointer shadow-lg outline-none flex items-center justify-center gap-1.5"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      Gửi trình duyệt liên thông & Kích hoạt SMS thông báo
                    </button>
                  </div>
                </div>

                {/* Simulation Console Screen */}
                <div className="space-y-3 bg-slate-950/80 p-4 border border-slate-800 rounded-xl relative flex flex-col justify-between">
                  <div className="space-y-3">
                    <h4 className="font-extrabold text-white text-[12px] border-b border-slate-800 pb-1.5 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                      <span>Hệ thống Kiểm thử liên thông & Giả lập duyệt số</span>
                    </h4>

                    <div className="bg-slate-900 border border-slate-800 max-h-48 overflow-y-auto p-3 rounded-lg font-mono text-[9.5px] space-y-1.5 text-slate-300 shadow-inner">
                      {ctApprovalLogs.length === 0 ? (
                        <div className="py-8 text-center text-slate-500 italic">
                          Hệ thống đang rảnh. Hãy cấu hình bên trái rồi bấm nút "Gửi trình duyệt liên thông" để kích hoạt giả lập kiểm thử.
                        </div>
                      ) : (
                        ctApprovalLogs.map((log, i) => (
                          <div key={i} className={`pb-1 ${log.includes('🔔') || log.includes('Success') ? 'text-emerald-400' : log.includes('Notification') ? 'text-cyan-400' : 'text-slate-355 bg-transparent'}`}>
                            {log}
                          </div>
                        ))
                      )}
                    </div>

                    {ctApprovalLogs.length > 0 && (
                      <div className="bg-slate-900/65 border border-slate-850 p-3 rounded-lg space-y-2.5">
                        {(() => {
                          const currentStep = ctApprovalSteps[ctApprovalCurrentStepIdx];
                          if (!currentStep) return <span className="text-emerald-400 font-extrabold block text-center py-2">🏆 QUY TRÌNH DUYỆT THÀNH CÔNG HOÀN TOÀN! Toàn bộ các cấp biên bản đã được rà soát ký số vĩnh viễn.</span>;
                          const currentEmp = employees.find(e => e.id === currentStep.approverId);
                          
                          return (
                            <>
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-slate-400">Đang chờ phê duyệt từ:</span> 
                                <strong className="text-white bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">{currentStep.levelName}</strong>
                              </div>
                              <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-md border border-slate-850">
                                <div className="text-[10px]">
                                  <span className="text-slate-400 block text-[9px]">Họ tên người duyệt:</span>
                                  <strong className="text-white text-[11px] block">{currentEmp?.name}</strong>
                                  <span className="text-slate-500 text-[8.5px] block">Vai trò: {currentEmp?.role === 'director' ? 'Giám đốc ban điều hành' : 'Điều phối viên/PM'}</span>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextSteps = [...ctApprovalSteps];
                                      nextSteps[ctApprovalCurrentStepIdx].status = 'approved';
                                      setCtApprovalSteps(nextSteps);

                                      const approveTime = new Date().toLocaleTimeString();
                                      const logLine = `[${approveTime}] - ✅ [${currentEmp?.name}] đã PHÊ DUYỆT thành công. Phản hồi mộc: "Nhất trí triển khai, tiến hành nghiệm thu liên phối mỏ mộc."`;
                                      
                                      let nextLogs = [...ctApprovalLogs, logLine];
                                      
                                      if (ctApprovalCurrentStepIdx + 1 < ctApprovalSteps.length) {
                                        const nextIdx = ctApprovalCurrentStepIdx + 1;
                                        setCtApprovalCurrentStepIdx(nextIdx);
                                        const nextStepObj = ctApprovalSteps[nextIdx];
                                        const nextEmpName = employees.find(e => e.id === nextStepObj.approverId)?.name || 'Người kiểm định cấp kế';
                                        nextLogs.push(`[${approveTime}] - 🔔 Hệ thống chuyển tiếp: Đã gửi SMS thông báo đẩy và chờ phê duyệt cấp tiếp theo: "${nextStepObj.levelName}" - ${nextEmpName}`);
                                      } else {
                                        // Final approval completed
                                        setCtApprovalCurrentStepIdx(ctApprovalSteps.length);
                                        nextLogs.push(`[${approveTime}] - 🎉 HÀNH TRÌNH PHÊ DUYỆT HOÀN TẤT! Hệ thống đã thông báo tự động kết quả "Đã mộc mành phê duyệt 100%" bằng SMS qua thiết bị của người khởi lập.`);
                                        
                                        // Document creation
                                        const newApprovedDoc: ProjectDoc = {
                                          id: `doc_approve_${Date.now()}`,
                                          type: 'quotation',
                                          name: `Biên bản phê duyệt liên thông: ${ctApprovalSubject}`,
                                          code: `APPROV-${selectedProject.code}`,
                                          createdAt: new Date().toISOString().split('T')[0],
                                          status: 'approved',
                                          templateName: ctApprovalType === '1-level' ? 'Duyệt mộc một cấp tốc hành' : 'Duyệt nhiều cấp liên phòng ban Hoàng Long'
                                        };
                                        updateProjectWithRule(selectedProject.id, {
                                          documents: [...(selectedProject.documents || []), newApprovedDoc]
                                        });
                                      }
                                      setCtApprovalLogs(nextLogs);
                                    }}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] px-3.5 py-1.5 rounded cursor-pointer transition-colors"
                                  >
                                    Đồng ý (Phê duyệt)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextSteps = [...ctApprovalSteps];
                                      nextSteps[ctApprovalCurrentStepIdx].status = 'rejected';
                                      setCtApprovalSteps(nextSteps);

                                      const rejectTime = new Date().toLocaleTimeString();
                                      const logLine = `[${rejectTime}] - ❌ [${currentEmp?.name}] đã BÁO BÁC (TỪ CHỐI). Ghi chú bác bỏ: "Cần rà soát lại kích thước ván mộc trước khi chuyển mốc thô thầu."`;
                                      const alertLine = `[${rejectTime}] - ⚠️ Trả lại hồ sơ: Đã thông báo lỗi từ chối duyệt ngay lập tức cho người khởi trình dự án để sửa đổi chi tiết bổ sung.`;
                                      
                                      setCtApprovalLogs([...ctApprovalLogs, logLine, alertLine]);
                                    }}
                                    className="bg-red-950/40 hover:bg-red-900/60 border border-red-900/40 text-red-400 font-bold text-[10px] px-3 py-1.5 rounded cursor-pointer transition-colors"
                                  >
                                    Bác bỏ / Từ chối
                                  </button>
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  <div className="text-[10px] text-slate-500 border-t border-slate-800 pt-3 flex items-center justify-between">
                    <span>Thiết bị thử nghiệm SMS Gateway:</span>
                    <span className="font-mono text-emerald-400">● Live (Đồng bộ)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. ĐỀ XUẤT TẠM ỨNG */}
          {activeConnectedTool === 'cost' && (() => {
            const activeTask = tasks.find(t => t.id === connectedTaskId || t.id === overlayTaskId);
            const managementGroup = employees.filter(e => e.role === 'director' || e.role === 'pm' || e.role === 'accountant');
            
            return (
              <div className="space-y-4">
                <div className="bg-slate-950/40 p-5 border border-slate-800 rounded-xl space-y-4">
                  
                  {/* Grid for basic info fields */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[10px] text-slate-400 block font-bold mb-1">Mã Đề Xuất (Tự Sinh):</label>
                      <input 
                        type="text" 
                        value={ctCostProposalId} 
                        disabled 
                        className="w-full bg-slate-950 border border-slate-800 text-amber-400 font-mono font-bold rounded-lg p-2 cursor-not-allowed select-none text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block font-bold mb-1">Người Đề Xuất:</label>
                      <input 
                        type="text" 
                        value={currentUser?.name || 'Trương Hữu Long'} 
                        disabled 
                        className="w-full bg-slate-950 border border-slate-800 text-slate-300 font-bold rounded-lg p-2 cursor-not-allowed select-none text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block font-bold mb-1">Ngày đề xuất:</label>
                      <input 
                        type="date" 
                        value={ctCostProposalDate} 
                        onChange={(e) => setCtCostProposalDate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-emerald-400 font-mono font-bold rounded-lg p-2 text-[11px] outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-[10px] text-slate-400 block font-bold mb-1">Tên Dự Án:</label>
                      <input 
                        type="text" 
                        value={selectedProject.name} 
                        disabled 
                        className="w-full bg-slate-950 border border-slate-800 text-slate-500 font-bold rounded-lg p-2 cursor-not-allowed select-none text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block font-bold mb-1">Tên Công Việc Con:</label>
                      <input 
                        type="text" 
                        value={activeTask?.name || 'Chi phí phát sinh công trình'} 
                        disabled 
                        className="w-full bg-slate-950 border border-slate-800 text-slate-500 font-bold rounded-lg p-2 cursor-not-allowed select-none text-[11px]"
                      />
                    </div>
                  </div>

                  {/* Bảng hạng mục chi tiêu */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                      <h4 className="font-extrabold text-white text-[11px] uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                        📊 Bảng hạng mục chi tiêu mua sắm lẻ
                      </h4>
                      <span className="text-[10px] text-slate-400">Cho phép thêm, sửa, xóa nhiều dòng</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400 text-[9.5px] uppercase font-black tracking-wider">
                            <th className="p-2 w-10 text-center">STT</th>
                            <th className="p-2">Hạng mục chi tiêu</th>
                            <th className="p-2 w-44">Số tiền đề xuất (đ)</th>
                            <th className="p-2">Ghi chú</th>
                            <th className="p-2 w-12 text-center">Xóa</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ctExpenseRows.map((row, idx) => (
                            <tr key={row.id} className="border-b border-slate-850 hover:bg-slate-900/40">
                              <td className="p-2 font-mono text-slate-400 text-center">{idx + 1}</td>
                              <td className="p-1">
                                <input 
                                  type="text" 
                                  value={row.item} 
                                  onChange={(e) => {
                                    const next = [...ctExpenseRows];
                                    next[idx].item = e.target.value;
                                    setCtExpenseRows(next);
                                  }}
                                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none text-[10.5px] focus:border-emerald-500"
                                  placeholder="Nhập hạng mục chi tiêu..."
                                />
                              </td>
                              <td className="p-1">
                                <input 
                                  type="number" 
                                  value={row.amount} 
                                  onChange={(e) => {
                                    const next = [...ctExpenseRows];
                                    next[idx].amount = Number(e.target.value);
                                    setCtExpenseRows(next);
                                  }}
                                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none text-[10.5px] text-right font-mono text-emerald-400 focus:border-emerald-500"
                                />
                              </td>
                              <td className="p-1">
                                <input 
                                  type="text" 
                                  value={row.note} 
                                  onChange={(e) => {
                                    const next = [...ctExpenseRows];
                                    next[idx].note = e.target.value;
                                    setCtExpenseRows(next);
                                  }}
                                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none text-[10.5px] focus:border-emerald-500"
                                  placeholder="Nhập ghi chú chi tiết..."
                                />
                              </td>
                              <td className="p-1 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCtExpenseRows(ctExpenseRows.filter((r: any) => r.id !== row.id));
                                  }}
                                  className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {ctExpenseRows.length === 0 && (
                            <tr>
                              <td colSpan={5} className="p-6 text-center text-slate-500 italic text-[11px]">
                                Chưa có hạng mục chi tiêu nào. Bấm nút bên dưới để thêm mới.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-between items-center pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          const newRow = { id: `row_${Date.now()}`, item: '', amount: 500000, recipientId: 'emp_3', note: '' };
                          setCtExpenseRows([...ctExpenseRows, newRow]);
                        }}
                        className="bg-slate-900 border border-dashed border-slate-750 text-indigo-400 font-extrabold hover:bg-slate-850 px-4 py-2 rounded-lg text-[10px] cursor-pointer transition-colors"
                      >
                        + Thêm dòng chi mới
                      </button>
                      
                      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 rounded-xl text-right shadow-lg shadow-emerald-950/15 border border-emerald-500/20">
                        <span className="text-[10px] text-emerald-100/90 block font-bold uppercase tracking-wider">Tổng số tiền đề xuất:</span>
                        <strong className="text-white text-base font-black font-mono tracking-wide">
                          {ctExpenseRows.reduce((sum, r) => sum + r.amount, 0).toLocaleString('vi-VN')} VNĐ
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Diễn giải field */}
                  <div>
                    <label className="text-[10px] text-slate-400 block font-bold mb-1">Diễn giải:</label>
                    <textarea 
                      value={ctCostDescription}
                      onChange={(e) => setCtCostDescription(e.target.value)}
                      rows={2}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg p-2.5 text-[11px] outline-none focus:border-emerald-500 resize-none"
                      placeholder="Nhập lý do, diễn giải mục đích đề xuất chi phí..."
                    />
                  </div>

                  {/* Người xét duyệt & Người quyết toán */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-slate-400 block font-bold mb-1">Người xét duyệt (Nhóm quản trị):</label>
                      <select 
                        value={ctCostApproverId}
                        onChange={(e) => setCtCostApproverId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-white rounded-lg p-2 text-[11px] font-bold cursor-pointer outline-none focus:border-emerald-500"
                      >
                        {managementGroup.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.name} ({emp.department} - {emp.role === 'director' ? 'Giám đốc' : emp.role === 'pm' ? 'Trưởng Dự Án' : 'Kế Toán'})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block font-bold mb-1">Người quyết toán (Nhóm quản trị):</label>
                      <select 
                        value={ctCostSettlerId}
                        onChange={(e) => setCtCostSettlerId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-white rounded-lg p-2 text-[11px] font-bold cursor-pointer outline-none focus:border-emerald-500"
                      >
                        {managementGroup.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.name} ({emp.department} - {emp.role === 'director' ? 'Giám đốc' : emp.role === 'pm' ? 'Trưởng Dự Án' : 'Kế Toán'})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Submission flow area */}
                  <div className="border-t border-slate-800 pt-4 flex justify-center">
                    <div className="max-w-md w-full space-y-2 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          if (!ctCost) {
                            addToast({ title: '⛔ Không có quyền', message: 'Tài khoản của bạn không có quyền GỬI ĐỀ XUẤT CHI PHÍ qua Công cụ liên thông.', type: 'error' });
                            return;
                          }
                          setConfirmDialog({
                            title: 'Xác nhận Gửi Đề xuất Tạm ứng 📋',
                            message: 'Bạn có chắc chắn muốn gửi Đề xuất Tạm ứng này sang phòng Tài chính Kế toán không?',
                            confirmText: 'Gửi đề xuất',
                            cancelText: 'Hủy bỏ',
                            onConfirm: async () => {
                              const totalVal = ctExpenseRows.reduce((sum, r) => sum + r.amount, 0);
                              
                              const approverEmp = employees.find(e => e.id === ctCostApproverId);
                              const settlerEmp = employees.find(e => e.id === ctCostSettlerId);

                              const proposal: SubcontractorAdvanceProposal & { proposalDate?: string } = {
                                id: ctCostProposalId,
                                subcontractorId: 'expense_recipient',
                                subcontractorName: settlerEmp?.name || 'Nhân sự quyết toán',
                                projectId: selectedProject.id,
                                projectName: selectedProject.name,
                                taskId: connectedTaskId || overlayTaskId || '',
                                taskName: activeTask?.name || 'Chi phí phát sinh công trình',
                                amount: totalVal,
                                reason: ctCostDescription,
                                approver: ctCostApproverId,
                                creator: currentUser?.id || 'emp_1',
                                creatorName: currentUser?.name || 'Trương Hữu Long',
                                approverName: approverEmp?.name || 'Ban Giám Đốc',
                                settlerId: ctCostSettlerId,
                                settlerName: settlerEmp?.name || 'Kế toán quyết toán',
                                status: 'pending_approval',
                                date: ctCostProposalDate,
                                type: 'project_expense_proposal',
                                expenseItems: ctExpenseRows.map(r => ({ id: r.id, item: r.item, amount: r.amount, note: r.note })),
                                proposalDate: ctCostProposalDate
                              };

                              // Save to database
                              setLastCostProposalId(ctCostProposalId);
                              await dbService.subcontractorAdvances.save(proposal);

                              // Add a document log to Project
                              const newCostDoc: ProjectDoc = {
                                id: `doc_cost_${Date.now()}`,
                                type: 'liquidation',
                                name: `Đề xuất tạm ứng: ${ctCostProposalId}`,
                                code: `ADV-${selectedProject.code}`,
                                createdAt: ctCostProposalDate,
                                status: 'draft',
                                value: totalVal,
                                templateName: 'Chi phí phát sinh mua sắm lẻ'
                              };
                              updateProjectWithRule(selectedProject.id, {
                                documents: [...(selectedProject.documents || []), newCostDoc]
                              });

                              // Add a worklog to the task if available
                              const taskIdToUse = connectedTaskId || overlayTaskId;
                              if (taskIdToUse && activeTask) {
                                const currentWorkLogs = activeTask.workLogs || [];
                                const newWorkLog = {
                                  id: `wl_ct_cost_${Date.now()}`,
                                  actorId: currentUser?.id || 'emp_1',
                                  actorName: currentUser?.name || 'Trương Hữu Long',
                                  action: 'Đề xuất tạm ứng liên thông',
                                  timestamp: new Date().toISOString(),
                                  notes: `Đã phát hành đề xuất tạm ứng ${totalVal.toLocaleString('vi-VN')} đ. Mã chứng từ: ${ctCostProposalId}. Ngày đề xuất: ${ctCostProposalDate}`
                                };
                                localUpdateTask(taskIdToUse, {
                                  workLogs: [...currentWorkLogs, newWorkLog]
                                });
                              }

                              // Show custom success dialog
                              setConfirmDialog({
                                title: 'Gửi Đề Xuất Thành Công! 🎉',
                                message: `Đã chuyển tiếp toàn bộ dữ liệu Đề xuất Tạm ứng sang phòng Tài chính Kế toán thành công!\nMã phiếu: ${ctCostProposalId}\nNgày đề xuất: ${ctCostProposalDate}`,
                                cancelText: 'Đóng'
                              });

                              setActiveConnectedTool(null);
                            }
                          });
                        }}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 font-extrabold py-3 rounded-xl text-white transition-all outline-none cursor-pointer text-center text-[12px] shadow-md hover:scale-[1.01]"
                      >
                        Gửi Đề Xuất
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            );
          })()}

          {/* 3. ĐỀ XUẤT VẬT TƯ */}
          {activeConnectedTool === 'material' && (
            <div className="space-y-4">
              <div className="bg-slate-950/40 p-4 border border-slate-800 rounded-xl space-y-4">
                
                {/* Header */}
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <h4 className="font-extrabold text-white text-[12px] flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-400" />
                    ĐỀ XUẤT CUNG ỨNG VẬT TƯ & VÂN GỖ
                  </h4>
                  <span className="text-[10px] text-slate-400">Kho hàng & Nhà cung ứng liên thông</span>
                </div>

                {/* Form type selection tabs */}
                <div className="flex bg-slate-900/60 p-1 rounded-xl border border-slate-800 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCtMaterialProposalType('warehouse');
                      setCtMaterialRows([]); // reset rows
                    }}
                    className={`flex-1 text-center py-2 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer ${
                      ctMaterialProposalType === 'warehouse'
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'text-slate-400 hover:text-white hover:bg-slate-850'
                    }`}
                  >
                    Đề xuất vật tư trong kho
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCtMaterialProposalType('supplier');
                      setCtMaterialRows([]); // reset rows
                    }}
                    className={`flex-1 text-center py-2 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer ${
                      ctMaterialProposalType === 'supplier'
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'text-slate-400 hover:text-white hover:bg-slate-850'
                    }`}
                  >
                    Đề xuất vật tư từ nhà cung cấp
                  </button>
                </div>

                {/* Supplier selection panel (only for supplier proposal) */}
                {ctMaterialProposalType === 'supplier' && (
                  <div className="space-y-2 bg-slate-900/40 p-3 rounded-lg border border-slate-800 relative">
                    <label className="block text-slate-400 font-bold text-[10.5px] uppercase tracking-wider">
                      Chọn Nhà Cung Cấp Vật Tư:
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          placeholder="🔍 Tìm nhanh nhà cung cấp trong danh mục..."
                          value={ctMaterialSupplierSearch}
                          onChange={(e) => {
                            setCtMaterialSupplierSearch(e.target.value);
                            setIsSupplierDropdownOpen(true);
                          }}
                          onFocus={() => setIsSupplierDropdownOpen(true)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 outline-none text-[11px] font-medium"
                        />
                        {isSupplierDropdownOpen && (
                          <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-slate-950 border border-slate-800 rounded-lg shadow-xl divide-y divide-slate-900">
                            {suppliers
                              .filter(s => s.name.toLowerCase().includes(ctMaterialSupplierSearch.toLowerCase()))
                              .map(s => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => {
                                    setCtMaterialSupplierId(s.id);
                                    setCtMaterialSupplierSearch(s.name);
                                    setIsSupplierDropdownOpen(false);
                                  }}
                                  className="w-full text-left p-2 hover:bg-slate-800/80 text-white text-[11px] font-medium transition-colors block"
                                >
                                  <div className="font-bold text-amber-400">{s.name}</div>
                                  <div className="text-slate-400 text-[9.5px]">
                                    Lĩnh vực: {s.field} - ĐT: {s.phone || 'Chưa ghi nhận'}
                                  </div>
                                </button>
                              ))
                            }
                            {suppliers.filter(s => s.name.toLowerCase().includes(ctMaterialSupplierSearch.toLowerCase())).length === 0 && (
                              <div className="p-2 text-slate-500 text-[10.5px] text-center">
                                Không tìm thấy nhà cung cấp nào
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsAddingNewSupplierFast(!isAddingNewSupplierFast)}
                        className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-slate-950 font-extrabold text-[10.5px] rounded-lg transition-all cursor-pointer whitespace-nowrap"
                      >
                        {isAddingNewSupplierFast ? 'Đóng nhanh' : '+ Thêm nhanh NCC'}
                      </button>
                    </div>

                    {/* Fast add supplier form */}
                    {isAddingNewSupplierFast && (
                      <div className="mt-2 p-3 bg-slate-950 border border-teal-500/30 rounded-lg space-y-2.5 animate-fade-in text-left">
                        <span className="text-[10px] font-black text-teal-400 block uppercase tracking-wider">
                          Thêm Nhanh Nhà Cung Cấp Mới
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] text-slate-400 block font-bold mb-0.5">Tên Nhà Cung Cấp *</label>
                            <input
                              type="text"
                              placeholder="VD: Cty Gỗ Hoàng Long"
                              value={newSupplierName}
                              onChange={(e) => setNewSupplierName(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-white text-[10.5px] outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-slate-400 block font-bold mb-0.5">Số điện thoại</label>
                            <input
                              type="text"
                              placeholder="VD: 0912..."
                              value={newSupplierPhone}
                              onChange={(e) => setNewSupplierPhone(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-white text-[10.5px] outline-none"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[9px] text-slate-400 block font-bold mb-0.5">Lĩnh vực cung cấp</label>
                          <input
                            type="text"
                            placeholder="VD: Gỗ MDF, Thép dầm..."
                            value={newSupplierField}
                            onChange={(e) => setNewSupplierField(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-white text-[10.5px] outline-none"
                          />
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              if (!newSupplierName.trim()) {
                                addToast({ title: '⚠️ Thiếu thông tin', message: 'Vui lòng điền tên Nhà Cung Cấp!', type: 'warning' }); return;
                              }
                              const newSup = {
                                id: `SUP_${Date.now()}`,
                                name: newSupplierName.trim(),
                                phone: newSupplierPhone.trim(),
                                field: newSupplierField.trim(),
                                representative: 'Người liên hệ',
                                email: '',
                                address: '',
                                bankAccount: '',
                                bankName: '',
                                note: 'Thêm nhanh từ đề xuất vật tư',
                                debt: 0
                              };
                              const updatedSups = [...suppliers, newSup];
                              setSuppliers(updatedSups);
                              localStorage.setItem('hl_acc_suppliers', JSON.stringify(updatedSups));
                              dbService.suppliers.save(newSup).catch(() => {});
                              window.dispatchEvent(new CustomEvent('hl-suppliers-updated', { detail: updatedSups }));

                              setCtMaterialSupplierId(newSup.id);
                              setCtMaterialSupplierSearch(newSup.name);
                              setIsAddingNewSupplierFast(false);
                              setNewSupplierName('');
                              setNewSupplierPhone('');
                              addToast({ title: '✅ Đã thêm', message: `Đã thêm thành công nhà cung cấp: ${newSup.name}`, type: 'success' });
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] px-3.5 py-1.5 rounded-lg transition-all cursor-pointer"
                          >
                            Lưu & Chọn NCC
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Materials List Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-[9.5px]">
                        <th className="p-2 w-10">STT</th>
                        <th className="p-2">Tên vật tư gỗ/Phụ kiện liên kết</th>
                        <th className="p-2 w-24">Số lượng</th>
                        <th className="p-2 w-24">Đơn vị</th>
                        <th className="p-2">Ghi chú</th>
                        <th className="p-2 w-12 text-center">Xóa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ctMaterialRows.map((row, idx) => (
                        <tr key={row.id} className="border-b border-slate-850 hover:bg-slate-900/40">
                          <td className="p-2 font-mono text-slate-500 text-center">{idx + 1}</td>
                          
                          {/* Item Selector (Warehouse vs Free Text Supplier) */}
                          <td className="p-1">
                            {ctMaterialProposalType === 'warehouse' ? (
                              <div>
                                <select
                                  value={row.name}
                                  onChange={(e) => {
                                    const selectedName = e.target.value;
                                    const matchedItem = inventory.find(i => i.name === selectedName);
                                    const next = [...ctMaterialRows];
                                    next[idx].name = selectedName;
                                    next[idx].unit = matchedItem ? matchedItem.unit : 'Tấm';
                                    next[idx].availableQty = matchedItem ? matchedItem.qty : 0;
                                    next[idx].price = matchedItem ? matchedItem.unitPrice : 0;
                                    setCtMaterialRows(next);
                                  }}
                                  className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white outline-none text-[10.5px] font-semibold cursor-pointer"
                                >
                                  <option value="">-- Chọn vật tư sẵn có trong kho --</option>
                                  {inventory.map(item => (
                                    <option key={item.id} value={item.name}>
                                      {item.name} (Sẵn có: {item.qty} {item.unit})
                                    </option>
                                  ))}
                                </select>
                                {row.qty > (row.availableQty || 0) && row.name && (
                                  <span className="text-[9px] text-red-400 font-bold block mt-1 animate-pulse">
                                    ⚠️ Vượt quá tồn kho khả dụng ({row.availableQty || 0})
                                  </span>
                                )}
                              </div>
                            ) : (
                              <input 
                                type="text" 
                                value={row.name} 
                                onChange={(e) => {
                                  const next = [...ctMaterialRows];
                                  next[idx].name = e.target.value;
                                  // Auto-match price & unit if exists in inventory catalog
                                  const matched = inventory.find(i => i.name.toLowerCase() === e.target.value.toLowerCase().trim());
                                  if (matched) {
                                    next[idx].unit = matched.unit;
                                    next[idx].price = matched.unitPrice;
                                  }
                                  setCtMaterialRows(next);
                                }}
                                className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white outline-none text-[10.5px] font-semibold"
                                placeholder="Nhập tên vật tư gỗ hoặc phụ kiện mới..."
                              />
                            )}
                          </td>

                          {/* Quantity */}
                          <td className="p-1">
                            <input 
                              type="number" 
                              value={row.qty} 
                              min="1"
                              onChange={(e) => {
                                const next = [...ctMaterialRows];
                                next[idx].qty = Number(e.target.value);
                                setCtMaterialRows(next);
                              }}
                              className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white outline-none text-[10.5px] text-right font-mono text-yellow-400"
                            />
                          </td>

                          {/* Unit */}
                          <td className="p-1">
                            <input 
                              type="text" 
                              value={row.unit} 
                              disabled={ctMaterialProposalType === 'warehouse'}
                              onChange={(e) => {
                                const next = [...ctMaterialRows];
                                next[idx].unit = e.target.value;
                                setCtMaterialRows(next);
                              }}
                              className={`w-full bg-slate-950 border border-slate-800 rounded p-1 text-white outline-none text-[10.5px] ${
                                ctMaterialProposalType === 'warehouse' ? 'opacity-50 cursor-not-allowed text-slate-400' : ''
                              }`}
                              placeholder="Bộ/Cái/Tấm..."
                            />
                          </td>

                          {/* Ghi chú */}
                          <td className="p-1">
                            <input 
                              type="text" 
                              value={row.spec || ''} 
                              onChange={(e) => {
                                const next = [...ctMaterialRows];
                                next[idx].spec = e.target.value;
                                setCtMaterialRows(next);
                              }}
                              className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white outline-none text-[10.5px]"
                              placeholder="Quy cách, yêu cầu sản xuất hoặc lưu ý..."
                            />
                          </td>

                          {/* Delete Action */}
                          <td className="p-1 text-center font-bold">
                            <button
                              type="button"
                              onClick={() => {
                                setCtMaterialRows(ctMaterialRows.filter((r: any) => r.id !== row.id));
                              }}
                              className="p-1 text-slate-500 hover:text-red-400 cursor-pointer transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {ctMaterialRows.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-slate-500 text-[10.5px]">
                            Chưa có vật tư nào được chọn. Bấm nút phía dưới để thêm!
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Add new line */}
                <div className="flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => {
                      const newRow = { 
                        id: `mat_${Date.now()}_${Math.random()}`, 
                        name: '', 
                        qty: 1, 
                        unit: 'Tấm', 
                        spec: '', 
                        availableQty: 9999, 
                        price: 150000 
                      };
                      setCtMaterialRows([...ctMaterialRows, newRow]);
                    }}
                    className="bg-slate-900 border border-dashed border-slate-700 text-amber-400 font-extrabold hover:bg-slate-850 px-3.5 py-1.5 rounded-lg text-[10px] cursor-pointer transition-all"
                  >
                    + Thêm dòng vật tư mới
                  </button>
                </div>

                {/* Action button: Bắt đầu điều phối */}
                <div className="border-t border-slate-800 pt-4">
                  <div className="w-full">
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          if (!selectedProject) {
                            if (setConfirmDialog) {
                              setConfirmDialog({
                                title: 'Lỗi ⚠️',
                                message: 'Chưa chọn dự án hoặc dự án không khả dụng!',
                                cancelText: 'Đóng'
                              });
                            } else {
                              addToast({ title: '❌ Lỗi', message: 'Chưa chọn dự án hoặc dự án không khả dụng!', type: 'error' });
                            }
                            return;
                          }
                          if (ctMaterialRows.length === 0) {
                            if (setConfirmDialog) {
                              setConfirmDialog({
                                title: 'Thông báo 🔔',
                                message: 'Bảng vật tư đề xuất trống!',
                                cancelText: 'Đóng'
                              });
                            } else {
                              addToast({ title: '⚠️ Trống', message: 'Bảng vật tư đề xuất trống!', type: 'warning' });
                            }
                            return;
                          }
                          if (ctMaterialRows.some(r => !r.name.trim())) {
                            if (setConfirmDialog) {
                              setConfirmDialog({
                                title: 'Thông báo 🔔',
                                message: 'Vui lòng chọn hoặc nhập đầy đủ tên vật tư cho toàn bộ các dòng!',
                                cancelText: 'Đóng'
                              });
                            } else {
                              addToast({ title: '⚠️ Thiếu thông tin', message: 'Vui lòng chọn hoặc nhập đầy đủ tên vật tư cho toàn bộ các dòng!', type: 'warning' });
                            }
                            return;
                          }

                          let finalSupplierId = ctMaterialSupplierId;
                          let finalSupplierName = '';

                          if (ctMaterialProposalType === 'supplier') {
                            if (!finalSupplierId && ctMaterialSupplierSearch.trim()) {
                              // Find matching supplier by name (case-insensitive)
                              const matched = suppliers.find(s => s.name.toLowerCase().trim() === ctMaterialSupplierSearch.toLowerCase().trim());
                              if (matched) {
                                finalSupplierId = matched.id;
                                finalSupplierName = matched.name;
                              } else {
                                // Auto-create supplier fast
                                const autoSup = {
                                  id: `SUP_${Date.now()}`,
                                  name: ctMaterialSupplierSearch.trim(),
                                  phone: '',
                                  field: 'Cung cấp vật tư thô',
                                  representative: 'Người phụ trách',
                                  email: '',
                                  address: '',
                                  bankAccount: '',
                                  bankName: '',
                                  note: 'Tự động tạo từ biểu mẫu đề xuất',
                                  debt: 0
                                };
                                const updatedSups = [...suppliers, autoSup];
                                setSuppliers(updatedSups);
                                localStorage.setItem('hl_acc_suppliers', JSON.stringify(updatedSups));
                                dbService.suppliers.save(autoSup).catch(() => {});
                                window.dispatchEvent(new CustomEvent('hl-suppliers-updated', { detail: updatedSups }));

                                finalSupplierId = autoSup.id;
                                finalSupplierName = autoSup.name;
                              }
                            } else if (finalSupplierId) {
                              const selectedSup = suppliers.find(s => s.id === finalSupplierId);
                              finalSupplierName = selectedSup?.name || '';
                            }

                            if (!finalSupplierId) {
                              if (setConfirmDialog) {
                                setConfirmDialog({
                                  title: 'Thông báo 🔔',
                                  message: 'Vui lòng tìm kiếm, chọn hoặc nhập đầy đủ một Nhà Cung Cấp trong Danh Mục!',
                                  cancelText: 'Đóng'
                                });
                              } else {
                                addToast({ title: '⚠️ Thiếu thông tin', message: 'Vui lòng tìm kiếm, chọn hoặc nhập đầy đủ một Nhà Cung Cấp trong Danh Mục!', type: 'warning' });
                              }
                              return;
                            }
                          }

                          // Warning if exceeding stock quantity in warehouse mode
                          let hasExceededStock = false;
                          if (ctMaterialProposalType === 'warehouse') {
                            hasExceededStock = ctMaterialRows.some(r => r.qty > (r.availableQty || 0));
                          }

                          const confirmMsg = hasExceededStock
                            ? '⚠️ CẢNH BÁO: Bạn đang đề xuất số lượng VƯỢT QUÁ số lượng có sẵn trong kho!\n\nBạn có chắc chắn muốn tiếp tục khởi chạy đề xuất và Bắt đầu điều phối không?'
                            : 'Bạn có chắc chắn muốn phê duyệt biểu mẫu và BẮT ĐẦU ĐIỀU PHỐI vật tư thô này không?';

                          const executeCoordination = () => {
                            try {
                              const creatorId = currentUser?.id || 'emp_1';
                              const creatorName = currentUser?.name || 'Người tạo';

                              const newMatLog = `[${new Date().toLocaleTimeString()}] - 🔔 Hệ thống Kho: Đã bắt đầu phiếu đề xuất điều phối vật tư: MAT-${selectedProject.code}. Loại hình: ${
                                ctMaterialProposalType === 'warehouse' ? 'Vật tư trong kho' : 'Từ nhà cung cấp'
                              }. Trạng thái khởi tạo: CHỜ NCC / KHO.`;

                              setCtMaterialLogs([newMatLog]);

                              // Create project document matching Kanban needs
                              const newMatDoc: ProjectDoc = {
                                id: `doc_mat_${Date.now()}`,
                                type: 'quotation', // keeps 'quotation' for compatibility with MaterialCoordination logic
                                name: ctMaterialProposalType === 'warehouse'
                                  ? `Đề xuất cấp vật tư thô từ Kho (${creatorName})`
                                  : `Đề xuất vật tư từ NCC: ${finalSupplierName || ''} (${creatorName})`,
                                code: `MAT-${selectedProject.code}`,
                                createdAt: new Date().toISOString().split('T')[0],
                                status: 'draft', // Maps directly to "CHỜ NCC / KHO"
                                templateName: ctMaterialProposalType === 'warehouse'
                                  ? 'Đề xuất vật tư trong kho'
                                  : 'Đề xuất vật tư từ nhà cung cấp',
                                materials: ctMaterialRows.map(row => ({
                                  id: row.id,
                                  name: row.name,
                                  qty: row.qty,
                                  unit: row.unit,
                                  spec: row.spec || '',
                                  note: row.spec || '',
                                  price: row.price || 150000,
                                  totalPrice: (row.qty || 0) * (row.price || 150000)
                                })),
                                coordinationType: 'self',
                                coordinatorId: creatorId,
                                coordinatorName: creatorName,
                                creatorId: creatorId,
                                creatorName: creatorName,
                                proposalType: ctMaterialProposalType,
                                supplierId: ctMaterialProposalType === 'supplier' ? finalSupplierId : undefined,
                                supplierName: ctMaterialProposalType === 'supplier' ? finalSupplierName : undefined
                              };

                              // Update current project documents
                              updateProjectWithRule(selectedProject.id, {
                                documents: [...(selectedProject.documents || []), newMatDoc]
                              });

                              // Set custom confirmation dialog showing success
                              if (setConfirmDialog) {
                                setConfirmDialog({
                                  title: 'Bắt Đầu Điều Phối Thành Công! 🚀',
                                  message: `Đề xuất vật tư thô của bạn đã được lập thành công và đẩy sang bảng điều phối với trạng thái "CHỜ NCC / KHO".`,
                                  cancelText: 'Đóng'
                                });
                              } else {
                                addToast({ title: '✅ Thành công', message: 'Khởi tạo điều phối vật tư thành công!', type: 'success' });
                              }

                              // Close modal and switch user tab to Material Coordination screen
                              setActiveConnectedTool(null);
                              window.dispatchEvent(new CustomEvent('hl-switch-tab', { detail: 'material-coordination' }));
                            } catch (err: any) {
                              console.error("Lỗi thực thi điều phối:", err);
                              addToast({ title: '❌ Lỗi', message: 'Lỗi thực thi điều phối: ' + (err?.message || err), type: 'error' });
                            }
                          };

                          if (setConfirmDialog) {
                            setConfirmDialog({
                              title: 'Xác Nhận Khởi Tạo Điều Phối 📋',
                              message: confirmMsg,
                              cancelText: 'Hủy bỏ',
                              confirmText: 'Bắt đầu',
                              onConfirm: executeCoordination
                            });
                          } else {
                            if (window.confirm(confirmMsg)) {
                              executeCoordination();
                            }
                          }
                        } catch (error: any) {
                          console.error("Lỗi khi Bắt đầu điều phối:", error);
                          if (setConfirmDialog) {
                            setConfirmDialog({
                              title: 'Lỗi Hệ Thống ⚠️',
                              message: "Đã xảy ra lỗi khi Bắt đầu điều phối: " + (error?.message || error),
                              cancelText: 'Đóng'
                            });
                          } else {
                            addToast({ title: '❌ Lỗi', message: 'Đã xảy ra lỗi khi bắt đầu điều phối: ' + (error?.message || error), type: 'error' });
                          }
                        }
                      }}
                      className="w-full bg-amber-500 hover:bg-amber-400 font-extrabold py-3 rounded-xl text-slate-950 transition-all cursor-pointer text-center text-[12px] shadow-lg hover:scale-[1.01]"
                    >
                      Bắt đầu điều phối
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* 4. LÀM BÁO GIÁ */}
          {activeConnectedTool === 'quotation' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl space-y-4">
                <div className="flex gap-4 border-b border-slate-805 pb-3">
                  <div className="w-1/3">
                    <label className="text-[10px] text-slate-400 block font-black mb-1">Chọn Lĩnh Vực / Module thầu:</label>
                    <select 
                      value={ctQuoteSector}
                      onChange={(e) => setCtQuoteSector(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-800 text-white rounded p-1.5 focus:border-indigo-500 outline-none cursor-pointer font-bold"
                    >
                      <option value="furniture">Nội thất gỗ & Tủ kệ</option>
                      <option value="construction">Nội thất gỗ & Xây dựng thô</option>
                      <option value="mechanical">Nội thất gỗ & Cơ khí Chế tạo</option>
                    </select>
                  </div>
                  <div className="w-2/3">
                    <label className="text-[10px] text-slate-400 block font-bold mb-1">Thiết lập tiêu đề báo giá kinh tế:</label>
                    <input 
                      type="text" 
                      value={ctQuoteTitle} 
                      onChange={(e) => setCtQuoteTitle(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 font-bold text-white outline-none"
                    />
                  </div>
                </div>

                {ctQuoteSector === 'furniture' && (
                  <div className="p-4 bg-indigo-950/15 border border-indigo-900/30 rounded-xl space-y-3.5" id="sector_furn_link_card">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400 shrink-0">
                        <Calculator className="w-6 h-6 animate-pulse" />
                      </div>
                      <div>
                        <strong className="text-white text-[12.5px] block">🚪 Phân hệ ước lượng định mức BÁO GIÁ NỘI THẤT GỖ</strong>
                        <span className="text-slate-400 block text-[10px] mt-0.5 font-medium">Bảng đo tính tủ bếp gỗ công nghiệp, tủ áo MDF mộc xưởng An Cường chuyên sâu.</span>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-850 space-y-2 shadow-inner leading-relaxed">
                      <p className="text-slate-300 text-[10.5px]">
                        Hệ thống đã nhận diện dự án mộc phân hệ <strong>Nội thất gỗ</strong>. Sau khi lập xong báo giá bên Bộ máy Estimator, kết quả file nghiệm thu thầu sẽ tự động kết nối lưu trữ ngược về hồ sơ tài liệu của dự án này:
                      </p>
                      <div className="pt-1.5 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const switchEvent = new CustomEvent('hl-switch-tab', { 
                              detail: { 
                                tab: 'quotes', 
                                projectId: selectedProject.id, 
                                customerId: selectedProject.customerId 
                              } 
                            });
                            window.dispatchEvent(switchEvent);
                            setActiveConnectedTool(null);
                          }}
                          className="bg-indigo-650 hover:bg-indigo-550 text-white font-extrabold text-[10.5px] px-5 py-2 rounded-xl cursor-pointer transition-all hover:scale-[1.01]"
                        >
                          🚀 Liên kết sang Model BÁO GIÁ NỘI THẤT ngay
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {ctQuoteSector === 'construction' && (
                  <div className="p-4 bg-amber-950/15 border border-amber-900/30 rounded-xl space-y-3.5" id="sector_const_link_card">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-400 shrink-0">
                        <Sliders className="w-6 h-6 animate-pulse" />
                      </div>
                      <div>
                        <strong className="text-white text-[12.5px] block">🏗️ Phân hệ dự toán định mức BÁO GIÁ XÂY DỰNG THÔ</strong>
                        <span className="text-slate-400 block text-[10px] mt-0.5 font-medium">Đo tính diện tích sàn, dầm cột móng băng và bóc xi măng cát đá thép hình sỉ lẻ.</span>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-850 space-y-2 shadow-inner leading-relaxed">
                      <p className="text-slate-300 text-[10.5px]">
                        Hệ thống đã nhận diện dự án phân hệ <strong>Xây dựng hoàn thiện</strong>. Phiếu ước lượng thầu thô xây móng sẽ được trích xuất kỹ thuật và trả về đồng bộ danh sách hợp đồng dự án của bạn ngay sau khi lưu trữ:
                      </p>
                      <div className="pt-1.5 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const switchEvent = new CustomEvent('hl-switch-tab', { 
                              detail: { 
                                tab: 'quotes-construction', 
                                projectId: selectedProject.id, 
                                customerId: selectedProject.customerId 
                              } 
                            });
                            window.dispatchEvent(switchEvent);
                            setActiveConnectedTool(null);
                          }}
                          className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-extrabold text-[10.5px] px-5 py-2 rounded-xl cursor-pointer transition-all hover:scale-[1.01]"
                        >
                          🚀 Liên kết sang Model BÁO GIÁ XÂY DỰNG ngay
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {ctQuoteSector === 'mechanical' && (
                  <div className="p-4 bg-pink-950/15 border border-pink-900/30 rounded-xl space-y-3.5" id="sector_mech_link_card">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-pink-500/10 rounded-xl text-pink-400 shrink-0">
                        <Shield className="w-6 h-6 animate-pulse" />
                      </div>
                      <div>
                        <strong className="text-white text-[12.5px] block">⚙️ Phân hệ định mức kỹ nghệ BÁO GIÁ CƠ KHÍ & CNC</strong>
                        <span className="text-slate-400 block text-[10px] mt-0.5 font-medium">Lập kế hoạch khối lượng thép hộp mạ kẽm, cổng rèm sắt mỹ rèn CNC uốn nghệ thuật.</span>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-850 space-y-2 shadow-inner leading-relaxed">
                      <p className="text-slate-300 text-[10.5px]">
                        Hệ thống đã nhận diện dự án phân hệ <strong>Cơ khí kết cấu mộc xưởng</strong>. Toàn bộ bảng bóc sắt hộp ống và tiền sơn tĩnh điện kẽm nhúng ép nóng sẽ được lưu trữ đồng bộ thẳng vào tài liệu thầu dự án:
                      </p>
                      <div className="pt-1.5 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const switchEvent = new CustomEvent('hl-switch-tab', { 
                              detail: { 
                                tab: 'quotes-mechanical', 
                                projectId: selectedProject.id, 
                                customerId: selectedProject.customerId 
                              } 
                            });
                            window.dispatchEvent(switchEvent);
                            setActiveConnectedTool(null);
                          }}
                          className="bg-pink-600 hover:bg-pink-500 text-white font-extrabold text-[10.5px] px-5 py-2 rounded-xl cursor-pointer transition-all hover:scale-[1.01]"
                        >
                          🚀 Liên kết sang Model BÁO GIÁ CƠ KHÍ ngay
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* 5, 6, 7. LÀM HỢP ĐỒNG / LÀM NGHIỆM THU / LÀM THANH LÝ */}
          {(activeConnectedTool === 'contract' || activeConnectedTool === 'acceptance' || activeConnectedTool === 'liquidation') && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Controls & Editor Area (Left 5 cols) */}
                <div className="lg:col-span-5 p-4 bg-slate-950/40 border border-slate-800 rounded-xl space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <h4 className="font-extrabold text-white text-[12px] flex items-center gap-1.5">
                      {activeConnectedTool === 'contract' && '📝 Thiết lập & Biên tập Hợp đồng'}
                      {activeConnectedTool === 'acceptance' && '✅ Nghiệm thu khối lượng'}
                      {activeConnectedTool === 'liquidation' && '🤝 Biên bản Thanh lý Quyết toán'}
                    </h4>
                    <select 
                      value={ctDocSector}
                      onChange={(e) => {
                        const newSec = e.target.value as any;
                        setCtDocSector(newSec);
                        // Đồng bộ lại nội dung với lĩnh vực mới
                        handleSyncDocumentText(
                          activeConnectedTool!,
                          ctDocTemplateId,
                          ctDocSelectedQuoteId,
                          ctDocRepA,
                          ctDocPosA,
                          ctDocRepB,
                          ctDocPosB,
                          ctDocWarranty,
                          ctDocLocation,
                          ctDocAcceptRate
                        );
                      }}
                      className="bg-slate-900 border border-slate-800 text-white rounded px-2 py-0.5 text-[9.5px] cursor-pointer outline-none"
                    >
                      <option value="furniture">Lĩnh vực: Nội thất gỗ</option>
                      <option value="construction">Lĩnh vực: Xây dựng thô</option>
                      <option value="mechanical">Lĩnh vực: Cơ khí khung mộc</option>
                    </select>
                  </div>

                  {/* Link to Quotation Source & Templates Selection */}
                  <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/60 grid grid-cols-1 gap-2.0">
                    <div className="space-y-1">
                      <label className="text-[9px] text-indigo-400 block font-bold uppercase tracking-wider">🔗 Liên kết dữ liệu Báo giá nguồn:</label>
                      <select
                        value={ctDocSelectedQuoteId}
                        onChange={(e) => {
                          const qId = e.target.value;
                          setCtDocSelectedQuoteId(qId);
                          // Đồng bộ lại nội dung với báo giá mới
                          handleSyncDocumentText(
                            activeConnectedTool!,
                            ctDocTemplateId,
                            qId,
                            ctDocRepA,
                            ctDocPosA,
                            ctDocRepB,
                            ctDocPosB,
                            ctDocWarranty,
                            ctDocLocation,
                            ctDocAcceptRate
                          );
                        }}
                        className="w-full bg-slate-950 border border-slate-800 text-white rounded p-1.5 text-[10px] cursor-pointer outline-none font-medium text-ellipsis overflow-hidden"
                      >
                        {ctQuoteRows && ctQuoteRows.length > 0 && (
                          <option value="draft">Báo giá nháp hiện thời ({ctQuoteRows.reduce((s, r) => s + r.qty * r.price, 0).toLocaleString('vi-VN')}đ)</option>
                        )}
                        {selectedProject.documents?.filter(d => d.type === 'quotation').map(doc => (
                          <option key={doc.id} value={doc.id}>{doc.name} (Báo giá: {doc.value?.toLocaleString('vi-VN')}đ)</option>
                        ))}
                        <option value="none">Không liên hợp - Nhập thô tự do</option>
                      </select>
                    </div>

                    <div className="space-y-1 mt-1">
                      <label className="text-[9px] text-indigo-400 block font-bold uppercase tracking-wider">📋 Mẫu cấu trúc văn bản thợ thầu:</label>
                      <select
                        value={ctDocTemplateId}
                        onChange={(e) => {
                          const tId = e.target.value;
                          setCtDocTemplateId(tId);
                          // Đồng bộ lại với mẫu cấu trúc mới
                          handleSyncDocumentText(
                            activeConnectedTool!,
                            tId,
                            ctDocSelectedQuoteId,
                            ctDocRepA,
                            ctDocPosA,
                            ctDocRepB,
                            ctDocPosB,
                            ctDocWarranty,
                            ctDocLocation,
                            ctDocAcceptRate
                          );
                        }}
                        className="w-full bg-slate-950 border border-slate-800 text-white rounded p-1.5 text-[10px] cursor-pointer outline-none font-medium"
                      >
                        <option value="mau_chuan">Mẫu Hoàng Long gỗ dán tiêu chuẩn (Đầy đủ)</option>
                        <option value="mau_rut_gon">Mẫu Biên nhận Tối giản rút gọn (Tiểu mục)</option>
                        <option value="mau_thuong_mai">Mẫu Thương mại thi công ván phẳng (Dãn dòng)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-slate-400 block font-bold mb-1">Đại diện Bên A (Chủ nhà):</label>
                        <input 
                          type="text" 
                          value={ctDocRepA}
                          onChange={(e) => {
                            setCtDocRepA(e.target.value);
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-white outline-none focus:border-indigo-500 text-[10.5px]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block font-bold mb-1">Chức vụ Bên A:</label>
                        <input 
                          type="text" 
                          value={ctDocPosA}
                          onChange={(e) => {
                            setCtDocPosA(e.target.value);
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-white outline-none focus:border-indigo-500 text-[10.5px]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-slate-400 block font-bold mb-1">Đại diện Bên B (Nhà thầu):</label>
                        <input 
                          type="text" 
                          value={ctDocRepB}
                          onChange={(e) => {
                            setCtDocRepB(e.target.value);
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-white outline-none focus:border-indigo-500 text-[10.5px]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block font-bold mb-1">Chức vụ Bên B:</label>
                        <input 
                          type="text" 
                          value={ctDocPosB}
                          onChange={(e) => {
                            setCtDocPosB(e.target.value);
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-white outline-none focus:border-indigo-500 text-[10.5px]"
                        />
                      </div>
                    </div>

                    {activeConnectedTool === 'contract' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-slate-400 block font-bold mb-1">Thời hạn bảo hành kỹ thuật:</label>
                          <input 
                            type="text" 
                            value={ctDocWarranty}
                            onChange={(e) => {
                              setCtDocWarranty(e.target.value);
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-white outline-none font-semibold text-[10.5px]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block font-bold mb-1 col-span-1">Hạn thi bàn giao thầu:</label>
                          <input 
                            type="text" 
                            value={selectedProject.endDate || 'Chưa cập nhật'} 
                            disabled
                            className="w-full bg-slate-950 border border-slate-800 text-slate-500 rounded p-1.5 text-[10.5px] cursor-not-allowed font-medium"
                          />
                        </div>
                      </div>
                    )}

                    {activeConnectedTool === 'acceptance' && (
                      <div className="p-2.5 bg-emerald-950/20 border border-emerald-900/30 rounded-lg space-y-2">
                        <label className="text-[10px] text-emerald-400 block font-bold">Thước đo Nghiệm thu tiến độ (%):</label>
                        <div className="flex items-center gap-3">
                          <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={ctDocAcceptRate}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setCtDocAcceptRate(val);
                              handleSyncDocumentText(
                                'acceptance',
                                ctDocTemplateId,
                                ctDocSelectedQuoteId,
                                ctDocRepA,
                                ctDocPosA,
                                ctDocRepB,
                                ctDocPosB,
                                ctDocWarranty,
                                ctDocLocation,
                                val
                              );
                            }}
                            className="flex-1 accent-emerald-500 cursor-pointer"
                          />
                          <span className="font-mono font-black text-emerald-400 text-[11px] bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-900/30">{ctDocAcceptRate}%</span>
                        </div>
                      </div>
                    )}

                    {activeConnectedTool === 'liquidation' && (
                      <div className="p-2.5 bg-amber-950/20 border border-amber-900/30 rounded-lg space-y-1">
                        <span className="text-[9px] text-amber-400 block font-bold uppercase tracking-wide">💰 Ước chi phí thanh toán dứt điểm:</span>
                        <span className="text-[11.5px] text-white block font-mono font-extrabold">{selectedProject.contractValue.toLocaleString('vi-VN')} VNĐ</span>
                      </div>
                    )}

                    <div>
                      <label className="text-[10px] text-slate-400 block font-bold mb-1">Địa điểm ký biên bản:</label>
                      <input 
                        type="text" 
                        value={ctDocLocation}
                        onChange={(e) => {
                          setCtDocLocation(e.target.value);
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-white outline-none text-[10.5px] font-semibold"
                      />
                    </div>

                    {/* Free text custom editor textbox */}
                    <div className="space-y-1 pt-1 border-t border-slate-800/80">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[9.5px] text-amber-500 block font-bold uppercase tracking-wider">✍️ Soạn thảo văn bản tự do:</label>
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmDialog({
                              title: 'Khôi phục văn bản mẫu',
                              message: '🔄 Bạn có chắc chắn muốn KHÔI PHỤC văn bản mẫu ban đầu? Mọi chỉnh sửa của bạn trong ô soạn thảo sẽ bị ghi đè và không thể khôi phục lại.',
                              confirmText: 'Khôi phục',
                              cancelText: 'Giữ lại',
                              onConfirm: () => {
                                handleSyncDocumentText(
                                  activeConnectedTool!,
                                  ctDocTemplateId,
                                  ctDocSelectedQuoteId,
                                  ctDocRepA,
                                  ctDocPosA,
                                  ctDocRepB,
                                  ctDocPosB,
                                  ctDocWarranty,
                                  ctDocLocation,
                                  ctDocAcceptRate
                                );
                              }
                            });
                          }}
                          className="text-slate-300 hover:text-white font-extrabold text-[8.5px] bg-slate-800 border border-slate-700 px-2 py-0.5 rounded cursor-pointer transition-colors"
                        >
                          Sync Lại Mẫu
                        </button>
                      </div>
                      <textarea
                        value={ctDocCustomText}
                        onChange={(e) => setCtDocCustomText(e.target.value)}
                        placeholder="Nhập hoặc tùy chỉnh nội dung văn bản thầu thợ tại đây..."
                        className="w-full h-48 bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 text-[10px] font-mono leading-relaxed outline-none focus:border-indigo-500 shadow-inner resize-y"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          const contentName = `VAN_BAN_TU_CHINH_${selectedProject.code}_${activeConnectedTool.toUpperCase()}.txt`;
                          const blob = new Blob([ctDocCustomText], { type: 'text/plain;charset=utf-8' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = contentName;
                          a.click();
                          URL.revokeObjectURL(url);
                          addToast({ title: '📄 Thành công', message: `Tải tệp tin văn bản tùy chỉnh [${activeConnectedTool === 'contract' ? 'Hợp đồng' : activeConnectedTool === 'acceptance' ? 'N nghiệm thu' : 'Thanh lý'}] hoàn tất thành công!`, type: 'success' });
                        }}
                        className="bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white font-bold py-2 rounded-xl text-center cursor-pointer transition-all hover:scale-[1.01] text-[10.5px]"
                      >
                        📥 Tải tài liệu TXT (.txt)
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          // Sign approval actions 
                          const dName = activeConnectedTool === 'contract' ? `Hợp đồng thi công ${ctDocSector === 'furniture' ? 'mọc nội thất' : ctDocSector === 'construction' ? 'xây dựng thô' : 'cơ khí'} tùy biến` :
                                        activeConnectedTool === 'acceptance' ? `Biên bản nghiệm thu khối lượng hoàn thành ${ctDocAcceptRate}%` :
                                        `Hồ sơ quyết toán thanh lý công trình bàn giao mộc`;

                          const newDocObj: ProjectDoc = {
                            id: `doc_workflow_${Date.now()}`,
                            type: activeConnectedTool as any,
                            name: dName,
                            code: `${activeConnectedTool.substring(0,3).toUpperCase()}-${selectedProject.code}`,
                            createdAt: new Date().toISOString().split('T')[0],
                            status: 'approved',
                            value: ctDocSelectedQuoteId === 'draft' && ctQuoteRows && ctQuoteRows.length > 0
                              ? ctQuoteRows.reduce((s, r) => s + r.qty * r.price, 0) * 1.1
                              : selectedProject.contractValue,
                            templateName: `${ctDocTemplateId === 'mau_rut_gon' ? 'Mẫu tối giản' : 'Mẫu chuẩn Hoàng Long'} (${ctDocSector === 'furniture' ? 'Nội thất gỗ' : 'Xây dựng/Cơ khí'})`,
                            content: ctDocCustomText // Đính kèm nội dung thô đã biên soạn dồi dào
                          };

                          let updates: Partial<Project> = {
                            documents: [...(selectedProject.documents || []), newDocObj]
                          };

                          if (activeConnectedTool === 'acceptance') {
                            updates.progress = ctDocAcceptRate;
                            if (ctDocAcceptRate === 100) {
                              updates.status = 'processing';
                            }
                          } else if (activeConnectedTool === 'liquidation') {
                            updates.progress = 100;
                            updates.status = 'completed';
                          }

                          updateProjectWithRule(selectedProject.id, updates);
                          addToast({ title: '✍️ Thành công', message: 'Đã ký số thầu & đóng dấu thợ đỏ Hoàng Long thành công! Tài liệu đã được lưu trong hồ sơ dự án.', type: 'success' });
                          setActiveConnectedTool(null);
                        }}
                        className="bg-rose-600 hover:bg-rose-500 text-white font-extrabold py-2 rounded-xl text-center cursor-pointer transition-all hover:scale-[1.01] shadow-md flex items-center justify-center gap-1.5 text-[10.5px]"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Ký số & Đóng dấu mộc đỏ
                      </button>
                    </div>
                  </div>
                </div>

                {/* Letterhead Draft Paper Preview (Aesthetic Preview) (Right 7 cols) */}
                <div className="lg:col-span-7 bg-amber-50 border border-amber-200/60 p-6 rounded-2xl relative shadow-2xl flex flex-col justify-between max-h-[66vh] overflow-y-auto" style={{ fontFamily: 'Georgia, serif' }}>
                  <div className="space-y-1 text-[10px] text-slate-800 bg-amber-50/95 leading-relaxed select-text">
                    {ctDocCustomText ? (
                      ctDocCustomText.split('\n').map((line, lIdx) => {
                        const trimmed = line.trim();
                        if (!trimmed) {
                          return <div key={lIdx} className="h-2"></div>;
                        }
                        if (trimmed.startsWith('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM') || 
                            trimmed.startsWith('HỢP ĐỒNG KINH TẾ') || 
                            trimmed.startsWith('HỢP ĐỒNG THƯƠNG MẠI') || 
                            trimmed.startsWith('BIÊN BẢN NGHIỆM THU') || 
                            trimmed.startsWith('BIÊN BẢN THANH LÝ')) {
                          return (
                            <div key={lIdx} className="text-center font-bold text-[11.5px] uppercase tracking-wide my-1.5 text-slate-950 font-sans">
                              {trimmed}
                            </div>
                          );
                        }
                        if (trimmed.startsWith('----------------') || trimmed.startsWith('================')) {
                          return <div key={lIdx} className="border-b border-dashed border-amber-300/40 my-2"></div>;
                        }
                        if (trimmed.startsWith('ĐIỀU') || 
                            trimmed.startsWith('BÊN CHỦ ĐẦU TƯ') || 
                            trimmed.startsWith('BÊN NHÀ THẦU') || 
                            trimmed.startsWith('BÊN MUA') || 
                            trimmed.startsWith('BÊN BÁN') ||
                            trimmed.startsWith('ĐẠI DIỆN BÊN') ||
                            trimmed.startsWith('ĐIỀU KHOẢN')) {
                          return (
                            <p key={lIdx} className="font-bold text-slate-950 text-[10.5px] mt-2 mb-0.5 font-sans">
                              {trimmed}
                            </p>
                          );
                        }
                        // Dòng chữ ký xếp ngang
                        if (trimmed.includes('ĐẠI DIỆN BÊN A') && trimmed.includes('ĐẠI DIỆN BÊN B')) {
                          return (
                            <div key={lIdx} className="grid grid-cols-2 text-center pt-6 font-bold text-slate-950 text-[10.5px] font-sans">
                              <div>ĐẠI DIỆN BÊN A</div>
                              <div>ĐẠI DIỆN BÊN B</div>
                            </div>
                          );
                        }
                        if (trimmed.includes('(Ký và ghi rõ họ tên)') && trimmed.includes('(Ký tên và đóng dấu)')) {
                          return (
                            <div key={lIdx} className="grid grid-cols-2 text-center text-[8.5px] text-slate-500 italic mb-2 font-sans">
                              <div>(Ký, ghi rõ họ tên)</div>
                              <div>(Ký tên và đóng dấu số đỏ)</div>
                            </div>
                          );
                        }
                        return (
                          <p key={lIdx} className="min-h-[0.95rem] text-slate-800 text-[10px] leading-relaxed whitespace-pre-wrap pl-0.5">
                            {trimmed}
                          </p>
                        );
                      })
                    ) : (
                      <div className="text-slate-400 text-center py-24 italic">Mẫu văn bản thô rỗng. Vui lòng bấm "Sync Lại Mẫu" để nạp dữ liệu.</div>
                    )}
                  </div>
                  <div className="pt-4 border-t border-amber-250/50 mt-4 text-center">
                    <span className="text-[8px] text-amber-900/60 select-none block tracking-wide font-sans font-medium">* Tài liệu pháp quy thầu thợ mộc được quản lý thời gian thực bởi ERP Hoàng Long Cloud.</span>
                  </div>
                </div>
              </div>
            </div>
          )}


        </div>

      </div>

      {/* Fallback Local Confirmation Modal */}
      {props.setConfirmDialog === undefined && localConfirmDialog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 text-slate-200 shadow-2xl overflow-hidden animate-scaleIn font-sans">
            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 shrink-0 mt-0.5">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-[14px] text-white">
                  {localConfirmDialog.title}
                </h4>
                <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">
                  {localConfirmDialog.message}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setLocalConfirmDialog(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-755 text-slate-300 font-bold text-[10px] rounded-lg cursor-pointer transition-colors"
              >
                {localConfirmDialog.cancelText || 'Hủy bỏ'}
              </button>
              {localConfirmDialog.onConfirm && (
                <button
                  type="button"
                  onClick={() => {
                    localConfirmDialog.onConfirm?.();
                    setLocalConfirmDialog(null);
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-extrabold text-[10px] rounded-lg transition-all hover:scale-[1.02] cursor-pointer"
                >
                  {localConfirmDialog.confirmText || 'Xác nhận'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
