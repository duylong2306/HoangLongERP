import React, { useState } from 'react';
import { isUserInRoleGroup, getMaterialCoordinator, getMaterialApprover } from '../context';
import { useSettings } from '../context/SettingsContext';
import {
  Project,
  Employee,
  Customer,
  Supplier,
  WAREHOUSE_SOURCE_ID,
  WAREHOUSE_PROJECT_ID,
} from '../types';
import { dbService } from '../lib/dbService';
import { ensureProjectChatGroup, sendGroupChatMessage } from '../lib/chatStore';
import {
  Boxes,
  Search,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Layers,
  Plus,
  Trash2,
  FileText,
  Printer,
  TrendingUp,
  AlertTriangle,
  Info,
  Share2,
  Send,
  RefreshCcw,
  Store,
  PackageCheck,
  ShieldCheck,
  Truck,
  MapPin,
  Pencil,
  Eye,
  PanelRightOpen,
  PanelRightClose,
  Zap,
  Download,
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';

interface MaterialCoordinationProps {
  projects: Project[];
  employees: Employee[];
  onUpdateProject: (id: string, updates: Partial<Project>) => void;
  onUpdateMultipleProjects?: (updatedProjectsList: Project[]) => Promise<void>;
  currentUser?: Employee;
  customers?: Customer[];
  /** Deep-link: mở chi tiết 1 đề xuất từ module khác (vd: từ tab Đơn Hàng) */
  initialProposalId?: string | null;
  onInitialProposalConsumed?: () => void;
}

type ProposalStatus = 'find_supplier' | 'waiting_approval' | 'waiting_order' | 'ordered' | 'received' | 'cancelled';

// Trạng thái hiển thị của 1 thẻ trên bảng điều phối
interface BoardItem {
  key: string;
  kind: 'proposal';
  project: Project;
  doc: any; // material_proposals
}

// Sentinel "projectId" đại diện cho đề xuất "Đề Xuất Kho" — mua hàng từ NCC để NHẬP
// KHO (không thuộc công trình nào). Board coi đây như 1 "dự án ảo" (boardItems đã có
// sẵn cơ chế fallback dựng project giả từ projectId/projectName khi không khớp project
// thật nào trong `projects`) nên tái dùng được toàn bộ luồng board hiện có.
// (WAREHOUSE_PROJECT_ID định nghĩa dùng chung trong types.ts để FinanceManagement
// cũng nhận diện được đơn hàng thuộc luồng nhập kho.)
const WAREHOUSE_PROJECT_NAME = '📦 Kho Tổng (Nhập hàng)';

const STATUS_LABEL: Record<ProposalStatus, string> = {
  find_supplier: 'TÌM NHÀ CUNG CẤP',
  waiting_approval: 'CHỜ DUYỆT',
  waiting_order: 'CHỜ ĐẶT HÀNG',
  ordered: 'ĐẶT HÀNG THÀNH CÔNG',
  received: 'ĐÃ NHẬN HÀNG',
  cancelled: 'HỦY',
};

export default function MaterialCoordination({
  projects,
  employees,
  onUpdateProject,
  onUpdateMultipleProjects,
  currentUser,
  customers,
  initialProposalId,
  onInitialProposalConsumed,
}: MaterialCoordinationProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [selectedDocKey, setSelectedDocKey] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Custom dialog states to replace window.confirm and window.alert
  const [customConfirm, setCustomConfirm] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
  } | null>(null);

  const [customAlert, setCustomAlert] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'success' | 'warning' | 'info';
  } | null>(null);

  // Print & share preview state
  const [isCopied, setIsCopied] = useState(false);

  // Dữ liệu mới: đề xuất vật tư + đơn mua hàng
  const [proposals, setProposals] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Quote modal state
  const [quoteModal, setQuoteModal] = useState<{ open: boolean; proposalId: string }>({ open: false, proposalId: '' });
  const [quoteSupplierId, setQuoteSupplierId] = useState('');
  const [quotePrices, setQuotePrices] = useState<Record<string, number>>({});
  const [quoteItemSuppliers, setQuoteItemSuppliers] = useState<Record<string, string>>({});
  const [showQuickSupplier, setShowQuickSupplier] = useState(false);
  const [quickSupplierName, setQuickSupplierName] = useState('');
  // Chosen quote for approval
  const [chosenQuoteId, setChosenQuoteId] = useState('');
  // Edit existing quote
  const [editingQuoteId, setEditingQuoteId] = useState('');
  // Quote detail (view-only) modal
  const [quoteDetailModal, setQuoteDetailModal] = useState<{ open: boolean; quote: any | null; proposalCode: string }>({ open: false, quote: null, proposalCode: '' });
  // Per-item supplier assignment (waiting_order)
  const [itemSupplierDraft, setItemSupplierDraft] = useState<Record<string, string>>({});
  // Order edit & share modal state
  const [orderEditModal, setOrderEditModal] = useState<{ open: boolean; order: any | null }>({ open: false, order: null });
  const [orderEditDraft, setOrderEditDraft] = useState<any>(null);
  const [orderDetailModal, setOrderDetailModal] = useState<{ open: boolean; order: any | null; proposal?: any; project?: any }>({ open: false, order: null });
  const [orderSupplierOpen, setOrderSupplierOpen] = useState(false);
  // Thùng rác: cửa sổ đề xuất bị HỦY + cột đích khi khôi phục
  const [trashOpen, setTrashOpen] = useState(false);
  const [restoreTargets, setRestoreTargets] = useState<Record<string, ProposalStatus>>({});
  // Nhận hàng từng phần: chọn đơn hàng + modal nhận hàng
  const [selectedOrderForReceive, setSelectedOrderForReceive] = useState<string | null>(null);
  const [receiveModal, setReceiveModal] = useState<{ open: boolean; order: any | null; proposal: any | null }>({ open: false, order: null, proposal: null });
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, number>>({});
  // Hồ sơ Thông tin doanh nghiệp (header Đơn Mua Hàng)
  // Hồ sơ doanh nghiệp lấy trực tiếp từ SettingsContext (nguồn thật duy nhất,
  // nơi màn hình "Thông Tin Doanh Nghiệp" lưu vào bảng business_profile) —
  // KHÔNG tự fetch riêng từ shift_config nữa (đó là 1 bảng khác, không liên
  // quan, khiến header Đơn Mua Hàng trước đây luôn hiện placeholder trống).
  const { businessInfo } = useSettings();
  // Mobile: toggle right tools pane trong detail drawer
  const [showRightPane, setShowRightPane] = useState(false);
  // Quick proposal modal state
  const [quickPropModal, setQuickPropModal] = useState(false);
  const [quickPropProject, setQuickPropProject] = useState('');
  const [quickPropTask, setQuickPropTask] = useState('');
  const [quickPropItems, setQuickPropItems] = useState<any[]>([]);
  const [quickPropNotes, setQuickPropNotes] = useState('');
  // true = modal đang tạo "Đề Xuất Kho" (mua hàng nhập kho, không thuộc công trình)
  const [quickPropIsWarehouse, setQuickPropIsWarehouse] = useState(false);
  // Tồn kho hiện tại — dùng để tự điền đơn giá & chặn vượt tồn khi chọn "Xuất từ Kho có sẵn"
  const [inventory, setInventory] = useState<any[]>([]);

  // ─── Phân trang: số trang + số dòng/trang cho từng cột ──────────────────
  const COL_PAGE_SIZES = [5, 10, 15, 20] as const;
  const [colPage, setColPage] = useState<Record<string, number>>({});
  const [colPageSize, setColPageSize] = useState<Record<string, number>>({});
  const getColPage = (id: string) => colPage[id] || 1;
  const getColPageSize = (id: string) => colPageSize[id] || 5;
  const colTotalPages = (id: string, count: number) => Math.max(1, Math.ceil(count / getColPageSize(id)));
  const setColPageSafe = (id: string, p: number) => setColPage(prev => ({ ...prev, [id]: Math.max(1, p) }));
  // Thùng rác
  const [trashPage, setTrashPage] = useState(1);
  const [trashPageSize, setTrashPageSize] = useState(5);
  const getTrashTotalPages = () => Math.max(1, Math.ceil(cancelledProposals.length / trashPageSize));


  const showNotification = (message: string, title: string = 'Thông báo', type: 'success' | 'warning' | 'info' = 'success') => {
    setCustomAlert({ isOpen: true, title, message, type });
  };

  const askConfirmation = (message: string, title: string, onConfirm: () => void, confirmText: string = 'Xác nhận', cancelText: string = 'Hủy bỏ') => {
    setCustomConfirm({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setCustomConfirm(null);
      },
      confirmText,
      cancelText,
    });
  };

  // ─── Load data ─────────────────────────────────────────────────────────
  const loadProposals = React.useCallback(() => {
    dbService.materialProposals.list().then(setProposals).catch(() => {});
  }, []);
  const loadOrders = React.useCallback(() => {
    dbService.purchaseOrders.list().then(setPurchaseOrders).catch(() => {});
  }, []);
  const loadSuppliers = React.useCallback(() => {
    dbService.suppliers.list().then(list => setSuppliers(list)).catch(() => {});
  }, []);
  const loadInventory = React.useCallback(() => {
    dbService.inventory.list().then(list => setInventory(list)).catch(() => {});
  }, []);

  React.useEffect(() => {
    loadProposals();
    loadOrders();
    loadSuppliers();
    loadInventory();
  }, [loadProposals, loadOrders, loadSuppliers, loadInventory]);

  React.useEffect(() => {
    const reload = () => { loadProposals(); loadOrders(); };
    const reloadOrdersOnly = () => { loadOrders(); };
    const reloadSuppliers = () => loadSuppliers();
    const reloadInventory = () => loadInventory();
    window.addEventListener('hl-material-proposals-updated', reload);
    window.addEventListener('hl-purchase-orders-updated', reloadOrdersOnly);
    window.addEventListener('hl-suppliers-updated', reloadSuppliers);
    window.addEventListener('hl-inventory-updated', reloadSuppliers);
    window.addEventListener('hl-inventory-updated', reloadInventory);
    return () => {
      window.removeEventListener('hl-material-proposals-updated', reload);
      window.removeEventListener('hl-purchase-orders-updated', reloadOrdersOnly);
      window.removeEventListener('hl-suppliers-updated', reloadSuppliers);
      window.removeEventListener('hl-inventory-updated', reloadSuppliers);
      window.removeEventListener('hl-inventory-updated', reloadInventory);
    };
  }, [loadProposals, loadOrders, loadSuppliers, loadInventory]);

  // Deep-link: mở chi tiết đề xuất khi được gọi từ module khác (tab Đơn Hàng)
  React.useEffect(() => {
    if (!initialProposalId) return;
    setSelectedDocKey(initialProposalId);
    onInitialProposalConsumed?.();
  }, [initialProposalId, onInitialProposalConsumed]);

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const resolveStatus = (item: BoardItem): ProposalStatus => item.doc.status as ProposalStatus;

  // Lấy danh sách dòng vật tư của 1 thẻ (mới: items; cũ: materials)
  const getDocItems = (doc: any): any[] => {
    if (doc && Array.isArray(doc.items)) return doc.items;
    if (doc && Array.isArray(doc.materials)) return doc.materials;
    return [];
  };

  // Tra cứu tình trạng nhận hàng thực tế của 1 dòng vật tư trong đề xuất, dựa
  // theo Đơn Mua Hàng (PO) đã tạo cho dòng đó (khớp theo id). poQty là SL hiện
  // tại trên PO (có thể đã bị hạ sau khi "Chốt số lượng thực nhận").
  const getReceivedInfo = (doc: any, itemId: string): { received: number; poQty: number | null } => {
    for (const oid of doc.purchaseOrderIds || []) {
      const po = purchaseOrders.find((o: any) => o.id === oid);
      const it = po?.items?.find((i: any) => i.id === itemId);
      if (it) return { received: it.receivedQty || 0, poQty: it.qty };
    }
    return { received: 0, poQty: null };
  };

  const proposalTotal = (doc: any): number =>
    getDocItems(doc).reduce((s, m) => s + (m.qty || 0) * (m.price || 0), 0);

  const quoteTotal = (q: any): number =>
    (q.items || []).reduce((s: number, m: any) => s + (m.totalPrice || 0), 0);

  // Label trạng thái hiển thị cho bất kỳ doc nào (proposal, ProjectDoc cũ, đơn mua PO)
  const statusText = (doc: any): string => {
    const s = doc?.status;
    if (s && STATUS_LABEL[s as ProposalStatus]) return STATUS_LABEL[s as ProposalStatus];
    if (s === 'confirmed') return 'ĐẶT HÀNG THÀNH CÔNG';
    if (s === 'draft') return 'CHỜ ĐẶT HÀNG';
    if (s === 'active') return 'ĐẶT HÀNG THÀNH CÔNG';
    if (s === 'approved') return 'ĐÃ NHẬN HÀNG';
    if (s === 'rejected' || s === 'archived') return 'HỦY';
    return s || 'ĐỀ XUẤT';
  };

  // Quyền thao tác
  const canCoordinate = React.useCallback((uid?: string): boolean => {
    if (!uid) return false;
    if (isUserInRoleGroup(uid, 'role_admin')) return true;
    if (isUserInRoleGroup(uid, 'role_accounting')) return true;
    if (isUserInRoleGroup(uid, 'role_office')) return true;
    if (isUserInRoleGroup(uid, 'role_technical')) return true;
    if (currentUser?.username === 'admin') return true;
    const coord = getMaterialCoordinator();
    return !!coord && coord.id === uid;
  }, [currentUser]);

  const canApprove = React.useCallback((uid?: string): boolean => {
    if (!uid) return false;
    if (isUserInRoleGroup(uid, 'role_admin')) return true;
    if (currentUser?.username === 'admin') return true;
    const appr = getMaterialApprover();
    return !!appr && appr.id === uid;
  }, [currentUser]);

  const isCoordinator = canCoordinate(currentUser?.id);
  const isApprover = canApprove(currentUser?.id);
  // Người khởi tạo đề xuất cũng được thao tác nhận hàng
  const canActOnOrder = (prop: any) => {
    if (!currentUser?.id) return false;
    if (isCoordinator) return true;
    if (prop.createdBy === currentUser.id) return true;
    return false;
  };

  // Gửi tin nhắn nhóm chat Dự án
  const sendProjectChat = React.useCallback(async (prop: any, content: string) => {
    // "Đề Xuất Kho" không gắn với dự án thật nào (projectId là sentinel ảo) → bảng
    // conversations có FK ràng buộc project_id phải tồn tại thật, luôn lỗi nếu gọi.
    if (prop.projectId === WAREHOUSE_PROJECT_ID) return;
    try {
      const project = projects.find(pr => pr.id === prop.projectId);
      await ensureProjectChatGroup(project || { id: prop.projectId, name: prop.projectName });
      await sendGroupChatMessage({
        conversationId: `conv_project_${prop.projectId}`,
        senderId: currentUser?.id || 'system',
        senderName: currentUser?.name || 'Hệ thống',
        senderRole: 'pm' as any,
        content,
        relatedEntity: { type: 'project', id: prop.projectId } as any,
      });
    } catch (e) {
      console.error('Không gửi được tin nhắn nhóm dự án:', e);
    }
  }, [projects, currentUser]);

  // ─── Unified board ───────────────────────────────────────────────────────
  const boardItems: BoardItem[] = React.useMemo(() => {
    const result: BoardItem[] = [];
    proposals.forEach(p => {
      const project = projects.find(pr => pr.id === p.projectId);
      const fallback: Project = {
        id: p.projectId || '',
        code: p.projectName || 'DA',
        name: p.projectName || 'Dự án',
        customerId: '',
        address: '',
        type: 'furniture' as any,
        contractValue: 0,
        startDate: '',
        endDate: '',
        pmId: '',
        status: 'active' as any,
        progress: 0,
      };
      result.push({ key: p.id, kind: 'proposal', project: project || fallback, doc: p });
    });
    return result;
  }, [proposals, projects]);

  const filteredDocs = boardItems.filter(item => {
    const docName = item.doc.name?.toLowerCase() || '';
    const docCode = item.doc.code?.toLowerCase() || '';
    const projName = item.project.name?.toLowerCase() || '';
    const projCode = item.project.code?.toLowerCase() || '';
    const search = searchTerm.toLowerCase();
    const matchesSearch = docName.includes(search) || docCode.includes(search) || projName.includes(search) || projCode.includes(search);
    const st = resolveStatus(item);
    const matchesStatus = statusFilter === 'all' || st === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: boardItems.length,
    find_supplier: boardItems.filter(i => resolveStatus(i) === 'find_supplier').length,
    waiting_approval: boardItems.filter(i => resolveStatus(i) === 'waiting_approval').length,
    waiting_order: boardItems.filter(i => resolveStatus(i) === 'waiting_order').length,
    ordered: boardItems.filter(i => resolveStatus(i) === 'ordered').length,
    received: boardItems.filter(i => resolveStatus(i) === 'received').length,
    cancelled: boardItems.filter(i => resolveStatus(i) === 'cancelled').length,
  };

  // ─── Proposal persistence ────────────────────────────────────────────────
  const saveProposal = React.useCallback(async (p: any) => {
    await dbService.materialProposals.save({ ...p, updatedAt: new Date().toISOString() });
    window.dispatchEvent(new CustomEvent('hl-material-proposals-updated'));
  }, []);

  // Cho phép sửa SL/Đơn giá của từng dòng vật tư trong bảng "Danh mục vật tư"
  // khi đề xuất còn ở giai đoạn TÌM NHÀ CUNG CẤP / CHỜ DUYỆT (chưa lên đơn
  // hàng) — đúng lúc dữ liệu (đặc biệt là đơn giá 0đ do NCC chưa báo giá dòng
  // đó) cần được người có trách nhiệm điều chỉnh trước khi đề xuất được DUYỆT.
  // Sau khi đã "Chờ đặt hàng" trở đi, số liệu phải khớp với báo giá đã chọn
  // nên KHÔNG cho sửa tay ở đây nữa (tránh lệch với báo giá NCC đã duyệt).
  const canEditProposalItems = (prop: any): boolean => {
    if (!prop) return false;
    if (prop.status === 'find_supplier') return isCoordinator;
    if (prop.status === 'waiting_approval') return isApprover;
    return false;
  };

  const updateProposalItemField = async (prop: any, itemId: string, field: 'qty' | 'price', rawValue: string) => {
    const value = Math.max(0, Number(rawValue) || 0);
    const items = (prop.items || []).map((it: any) =>
      it.id === itemId ? { ...it, [field]: value, totalPrice: field === 'qty' ? value * (it.price || 0) : (it.qty || 0) * value } : it
    );
    await saveProposal({ ...prop, items });
  };

  // ─── Thùng rác: đề xuất bị HỦY (tự xóa sau 30 ngày + khôi phục) ─────────
  const DAYS_TO_AUTO_DELETE = 30;
  const DAY_MS = 24 * 60 * 60 * 1000;

  const cancelledProposals = React.useMemo(() =>
    boardItems.filter(i => i.kind === 'proposal' && resolveStatus(i) === 'cancelled'),
  [boardItems]);

  // Ngày bị HỦY = lần cập nhật cuối khi chuyển sang cancelled
  const cancelledAtMs = (p: any): number => {
    const t = new Date(p.updatedAt || p.createdAt || 0).getTime();
    return isNaN(t) ? 0 : t;
  };
  // Số ngày còn lại trước khi tự xóa (0 = sẽ xóa hôm nay)
  const daysUntilDeletion = (p: any): number => {
    const base = cancelledAtMs(p);
    if (!base) return DAYS_TO_AUTO_DELETE;
    const remain = DAYS_TO_AUTO_DELETE - Math.floor((Date.now() - base) / DAY_MS);
    return Math.max(0, Math.min(DAYS_TO_AUTO_DELETE, remain));
  };

  // Tự động xóa các đề xuất HỦY quá 30 ngày (chạy mỗi khi proposals thay đổi)
  const cleanupCancelledProposals = React.useCallback(async () => {
    try {
      const cancelled = proposals.filter(p => p.status === 'cancelled');
      let deleted = 0;
      for (const p of cancelled) {
        const base = cancelledAtMs(p);
        if (base && Date.now() - base > DAYS_TO_AUTO_DELETE * DAY_MS) {
          await dbService.materialProposals.delete(p.id).catch(() => {});
          deleted++;
        }
      }
      if (deleted > 0) {
        window.dispatchEvent(new CustomEvent('hl-material-proposals-updated'));
      }
    } catch (e) {
      console.error('Lỗi dọn đề xuất HỦY quá 30 ngày:', e);
    }
  }, [proposals]);

  React.useEffect(() => { cleanupCancelledProposals(); }, [cleanupCancelledProposals]);

  // Tự dọn định kỳ mỗi giờ để các đề xuất HỦY quá 30 ngày bị xóa dù app mở lâu
  React.useEffect(() => {
    const timer = setInterval(() => { cleanupCancelledProposals(); }, 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, [cleanupCancelledProposals]);

  // ─── Quick Proposal: tạo đề xuất vật tư nhanh ─────────────────────────────
  const addQuickPropItem = () => {
    setQuickPropItems(prev => [...prev, {
      id: `item_${Date.now()}_${prev.length}`,
      name: '', qty: 1, unit: 'cái', spec: '', price: 0, note: '',
    }]);
  };
  const updateQuickPropItem = (idx: number, field: string, value: any) => {
    setQuickPropItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };
  const removeQuickPropItem = (idx: number) => {
    setQuickPropItems(prev => prev.filter((_, i) => i !== idx));
  };
  const submitQuickProposal = async () => {
    // "Đề Xuất Kho": không thuộc dự án thật nào — dùng "dự án ảo" Kho Tổng
    // (board đã có sẵn cơ chế fallback dựng project giả từ projectId/projectName).
    const proj: any = quickPropIsWarehouse
      ? { id: WAREHOUSE_PROJECT_ID, name: WAREHOUSE_PROJECT_NAME, code: 'KHO' }
      : projects.find(p => p.id === quickPropProject);
    if (!proj) { showNotification('Vui lòng chọn dự án.', 'Thiếu dự án', 'warning'); return; }
    const validItems = quickPropItems.filter(it => it.name.trim());
    if (validItems.length === 0) { showNotification('Cần ít nhất 1 vật tư có tên.', 'Thiếu vật tư', 'warning'); return; }
    // Tách nhóm: có mã MUA → waiting_order, chưa có mã → find_supplier
    const withCode = validItems.filter(it => it.maSanPham);
    const withoutCode = validItems.filter(it => !it.maSanPham);
    const now = new Date();
    const code = `VATTU-${proj.code || proj.name?.slice(0, 6).toUpperCase() || 'DA'}-${now.getFullYear()}`;
    const creatorId = currentUser?.id || '';
    const creatorName = currentUser?.name || '—';
    const buildProposal = (items: any[], status: ProposalStatus, suffix: string) => ({
      id: `material_prop_${Date.now()}_${suffix || '0'}`,
      code: `${code}${suffix}`,
      projectId: proj.id,
      projectName: proj.name,
      taskId: quickPropTask || undefined,
      taskName: quickPropTask ? (proj as any).tasks?.find((t: any) => t.id === quickPropTask)?.name || '' : '',
      proposalType: 'material',
      createdBy: creatorId,
      createdByName: creatorName,
      status,
      items: items.map(it => ({
        id: it.id, name: it.name, qty: it.qty, unit: it.unit, spec: it.spec,
        price: it.price || 0, totalPrice: (it.price || 0) * (it.qty || 0),
        note: it.note || '', maSanPham: it.maSanPham || '',
      })),
      supplierId: null, supplierName: null, quotes: [], chosenQuoteId: null,
      purchaseOrderIds: [], notes: quickPropNotes,
      createdAt: now.toISOString(), updatedAt: now.toISOString(),
    });
    try {
      const created: any[] = [];
      if (withCode.length) {
        const p = buildProposal(withCode, 'waiting_order', withCode.length < validItems.length ? '-MUA' : '');
        await dbService.materialProposals.create(p);
        created.push(p);
      }
      if (withoutCode.length) {
        const p = buildProposal(withoutCode, 'find_supplier', withoutCode.length < validItems.length ? '-TNCC' : '');
        await dbService.materialProposals.create(p);
        created.push(p);
      }
      if (created.length === 0) {
        // fallback: nếu không có item nào pass filter, tạo 1 proposal chung
        const p = buildProposal(validItems, 'find_supplier', '');
        await dbService.materialProposals.create(p);
        created.push(p);
      }
      window.dispatchEvent(new CustomEvent('hl-material-proposals-updated'));
      // Gửi chat nhóm dự án — "Đề Xuất Kho" không có dự án thật (FK conversations.project_id sẽ lỗi) nên bỏ qua
      if (!quickPropIsWarehouse) {
        try {
          await ensureProjectChatGroup(proj);
          await sendGroupChatMessage({
            conversationId: `conv_project_${proj.id}`,
            senderId: creatorId,
            senderName: creatorName,
            senderRole: 'pm' as any,
            content: `📦 ĐỀ XUẤT VẬT TƯ MỚI ${code}\nDự án: ${proj.name}\n— ${validItems.map(i => `• ${i.name} × ${i.qty} ${i.unit}`).join('\n')}\n→ Đã gửi tới bảng Điều phối vật tư.`,
            relatedEntity: { type: 'project', id: proj.id } as any,
          });
        } catch (e) { /* ignore */ }
      }
      showNotification(`Đã tạo ${created.length} đề xuất vật tư.`, 'Tạo đề xuất thành công', 'success');
      setQuickPropModal(false);
      setQuickPropProject(''); setQuickPropTask(''); setQuickPropItems([]); setQuickPropNotes(''); setQuickPropIsWarehouse(false);
    } catch (e) {
      showNotification('Lỗi khi tạo đề xuất. Vui lòng thử lại.', 'Lỗi', 'warning');
    }
  };

  // Tính toán bản đề xuất "vừa bước vào" cột `target` — chỉ giữ dữ liệu hợp lệ
  // cho bước đó, xóa sạch dữ liệu của các bước sau (tránh trạng thái lệch).
  const buildResetProposalForColumn = (p: any, target: ProposalStatus): any => {
    // Chỉ giữ thông tin cơ bản của vật tư (tên, sl, đvt, quy cách, mã)
    const baseItems = (p.items || []).map((it: any) => ({
      id: it.id,
      name: it.name,
      qty: it.qty,
      unit: it.unit,
      spec: it.spec,
      note: it.note,
      maSanPham: it.maSanPham,
    }));
    // Vật tư chưa gán NCC/giá (sẽ được báo giá/thiết lập ở các bước sau)
    const blankItems = baseItems.map((it: any) => ({
      ...it, price: 0, totalPrice: 0, supplierId: undefined, supplierName: undefined,
    }));

    const base: any = {
      ...p,
      status: target,
      quotes: [],
      chosenQuoteId: null,
      supplierId: null,
      supplierName: null,
      purchaseOrderIds: [],
      items: blankItems,
    };

    // TÌM NHÀ CUNG CẤP: khởi đầu hoàn toàn trắng — chỉ có danh sách vật tư
    if (target === 'find_supplier') return base;

    // CHỜ DUYỆT: cần giữ báo giá (để gửi xét duyệt), xóa quote được chọn & NCC
    if (target === 'waiting_approval') {
      return { ...base, quotes: p.quotes || [] };
    }

    // CHỜ ĐẶT HÀNG: sau duyệt → áp dụng NCC + giá từ báo giá được chọn vào vật tư
    if (target === 'waiting_order') {
      const quotes = p.quotes || [];
      const chosen = quotes.find((q: any) => q.id === p.chosenQuoteId)
        || (quotes.length ? quotes[0] : null);
      const items = (p.items || []).map((it: any) => {
        const qi = chosen ? (chosen.items || []).find((x: any) => x.id === it.id) : null;
        const price = qi ? qi.price : 0;
        return {
          ...it,
          supplierId: qi?.supplierId || '',
          supplierName: qi?.supplierName || '',
          price,
          totalPrice: price * (it.qty || 0),
        };
      });
      return {
        ...base,
        quotes,
        chosenQuoteId: chosen ? chosen.id : null,
        supplierId: chosen?.supplierId || null,
        supplierName: chosen?.supplierName || null,
        items,
      };
    }

    // ĐẶT HÀNG THÀNH CÔNG / ĐÃ NHẬN HÀNG: giữ nguyên báo giá, NCC, đơn hàng đã có
    return {
      ...base,
      quotes: p.quotes || [],
      chosenQuoteId: p.chosenQuoteId || null,
      supplierId: p.supplierId || null,
      supplierName: p.supplierName || null,
      purchaseOrderIds: p.purchaseOrderIds || [],
      items: (p.items || []).map((it: any) => ({ ...it })),
    };
  };

  // Khôi phục 1 đề xuất đã HỦY về cột đã chọn. CHỦ Ý KHÔNG đụng vào receivedQty
  // của các đơn hàng liên kết — trước đây ép receivedQty về 0 (cột ĐẶT HÀNG
  // THÀNH CÔNG) hoặc về đủ số lượng (cột ĐÃ NHẬN HÀNG), có nguy cơ ghi đè mất
  // dữ liệu nhận hàng từng phần thực tế đã ghi nhận trước khi đề xuất bị hủy.
  const restoreProposal = async (p: any) => {
    const target = restoreTargets[p.id] || 'waiting_order';
    const patched = buildResetProposalForColumn(p, target);
    await saveProposal(patched);
    showNotification(
      `Đã khôi phục đề xuất ${p.code} về cột ${STATUS_LABEL[target]} (đã reset dữ liệu cho bước này).`,
      'Khôi phục thành công',
      'success'
    );
  };

  // Xóa vĩnh viễn 1 đề xuất đã HỦY (không chờ 30 ngày)
  const deleteCancelledNow = (p: any) => {
    askConfirmation(
      `⚠️ Xóa VĨNH VIỄN đề xuất ${p.code} (dự án ${p.projectName}) khỏi hệ thống?\nThao tác này không thể hoàn tác.`,
      "Xác nhận xóa vĩnh viễn",
      async () => {
        await dbService.materialProposals.delete(p.id).catch(() => {});
        window.dispatchEvent(new CustomEvent('hl-material-proposals-updated'));
        showNotification(`Đã xóa vĩnh viễn đề xuất ${p.code}.`, 'Đã xóa', 'info');
      },
      "Xóa vĩnh viễn",
      "Trở lại"
    );
  };

  const activeDetail = boardItems.find(item => item.key === selectedDocKey);

  const handleSelectDoc = (key: string) => {
    setSelectedDocKey(key);
    setChosenQuoteId('');
    setItemSupplierDraft({});
  };

  // ─── Quote (TÌM NHÀ CUNG CẤP) ───────────────────────────────────────────
  const openQuoteModal = (prop: any) => {
    const prices: Record<string, number> = {};
    (prop.items || []).forEach((it: any) => { prices[it.id] = it.price || 0; });
    setQuotePrices(prices);
    setQuoteItemSuppliers({});
    setQuoteSupplierId('');
    setEditingQuoteId('');
    setQuoteModal({ open: true, proposalId: prop.id });
  };

  const openEditQuote = (prop: any, quote: any) => {
    const prices: Record<string, number> = {};
    const itemSups: Record<string, string> = {};
    (prop.items || []).forEach((it: any) => {
      const qi = (quote.items || []).find((x: any) => x.id === it.id);
      prices[it.id] = qi ? qi.price : it.price || 0;
      itemSups[it.id] = qi?.supplierId || it.supplierId || '';
    });
    setQuotePrices(prices);
    setQuoteItemSuppliers(itemSups);
    setQuoteSupplierId('');
    setEditingQuoteId(quote.id);
    setQuoteModal({ open: true, proposalId: prop.id });
  };

  const addQuote = async () => {
    const prop = proposals.find(p => p.id === quoteModal.proposalId);
    if (!prop) return;
    const items = prop.items || [];
    const supplierIds = items.map((it: any) => quoteItemSuppliers[it.id] || '');
    if (supplierIds.some((id: any) => !id)) { showNotification('Vui lòng chọn Nhà Cung Cấp cho TẤT CẢ sản phẩm!', 'Thiếu NCC', 'warning'); return; }
    // Tránh trùng bộ nhà cung cấp đã có báo giá (bỏ qua chính báo giá đang sửa)
    const key = [...new Set(supplierIds)].sort().join(',');
    const dup = (prop.quotes || []).some((q: any) => {
      if (q.id === editingQuoteId) return false;
      const qIds = [...new Set((q.items || []).map((x: any) => x.supplierId).filter(Boolean))].sort().join(',');
      return qIds === key;
    });
    if (dup) { showNotification('Bộ nhà cung cấp này đã có báo giá cho đề xuất.', 'Trùng NCC', 'warning'); return; }
    if (!editingQuoteId && (prop.quotes || []).length >= 3) { showNotification('Tối đa 3 báo giá.', 'Giới hạn', 'warning'); return; }
    const qItems = items.map((it: any) => {
      const sid = quoteItemSuppliers[it.id] || '';
      const sup = suppliers.find((s: any) => s.id === sid);
      const price = quotePrices[it.id] ?? it.price ?? 0;
      return { id: it.id, name: it.name, qty: it.qty, unit: it.unit, spec: it.spec, supplierId: sid, supplierName: sup?.name || '', price, totalPrice: price * (it.qty || 0) };
    });
    const names = [...new Set(qItems.map((q: any) => q.supplierName).filter(Boolean))];
    const supplierName = names.length === 1 ? names[0] : `${names.length} nhà cung cấp`;
    const primarySid = qItems.find((q: any) => q.supplierId)?.supplierId || '';
    const quotes = editingQuoteId
      ? (prop.quotes || []).map((q: any) => q.id === editingQuoteId
          ? { ...q, supplierId: primarySid, supplierName, items: qItems, updatedAt: new Date().toISOString() }
          : q)
      : [...(prop.quotes || []), {
          id: `quote_${Date.now()}`,
          supplierId: primarySid,
          supplierName,
          items: qItems,
          createdAt: new Date().toISOString(),
          createdBy: currentUser?.id || '',
          createdByName: currentUser?.name || '',
        }];
    await saveProposal({ ...prop, quotes });
    setQuoteItemSuppliers({});
    setQuotePrices({});
    setQuoteSupplierId('');
    setEditingQuoteId('');
    showNotification(editingQuoteId ? `Đã cập nhật báo giá (${supplierName}).` : `Đã thêm báo giá (${supplierName}).`, 'Thành công', 'success');
  };

  const addQuickSupplier = async () => {
    const name = quickSupplierName.trim();
    if (!name) { showNotification('Vui lòng nhập tên nhà cung cấp.', 'Thiếu tên', 'warning'); return; }
    const dup = suppliers.find(s => s.name.trim().toLowerCase() === name.toLowerCase());
    const newId = dup ? dup.id : `SUP_${Date.now()}`;
    if (!dup) {
      const newSup: any = {
        id: newId,
        name,
        representative: '',
        phone: '',
        email: '',
        address: '',
        field: 'vật tư',
        bankAccount: '',
        bankName: '',
        note: '',
        debt: 0,
      };
      try { await dbService.suppliers.save(newSup); } catch (e) { /* ignore */ }
      window.dispatchEvent(new CustomEvent('hl-suppliers-updated'));
    }
    setQuoteSupplierId(newId);
    setQuickSupplierName('');
    setShowQuickSupplier(false);
    showNotification(`Đã ${dup ? 'chọn' : 'thêm'} NCC "${name}".`, 'Thành công', 'success');
  };

  // ─── ORDER: edit / delete / print / share ────────────────────────────────
  // html2pdf.js (dynamic import) — chỉ load khi cần chia sẻ/in PDF
  const loadHtml2Pdf = async () => {
    const mod = await import('html2pdf.js');
    return (mod as any).default || mod;
  };

  // Escape HTML để tránh lỗi khi tên/vị trí chứa ký tự đặc biệt
  const esc = (s: any): string => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // Tính toán context (bên mua/nhận/điều phối) cho Đơn Mua Hàng
  const resolveOrderCtx = (order: any) => {
    const prop = proposals.find((p: any) => (p.purchaseOrderIds || []).includes(order.id))
      || orderDetailModal.proposal;
    const proj = projects.find((pr: any) => pr.id === (prop?.projectId))
      || orderDetailModal.project;
    const proposerEmp = employees.find((e: any) => e.id === prop?.createdBy);
    const coordinatorEmp = employees.find((e: any) => e.id === prop?.coordinatorId);
    return {
      companyProfile: businessInfo || {},
      projectName: proj?.name || prop?.projectName || '',
      receiverName: prop?.createdByName || '—',
      receiverPhone: proposerEmp?.phone || '—',
      deliveryAddress: proj?.address || '—',
      coordinatorName: prop?.coordinatorName || '—',
      coordinatorPhone: coordinatorEmp?.phone || '—',
    };
  };

  // Sinh HTML tài liệu Đơn Mua Hàng (dùng chung cho preview / in / chia sẻ PDF)
  const buildPurchaseOrderHtml = (order: any, ctx: any) => {
    const cp = ctx.companyProfile || {};
    const rows = (order.items || []).map((it: any, i: number) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${esc(it.name)}</td>
        <td style="text-align:center">${it.qty || 0}</td>
        <td style="text-align:center">${esc(it.unit)}</td>
        <td>${esc(it.spec || '—')}</td>
        <td style="text-align:right;white-space:nowrap">${((it.price || 0).toLocaleString('vi-VN'))} ₫</td>
        <td style="text-align:right;white-space:nowrap">${((it.qty || 0) * (it.price || 0)).toLocaleString('vi-VN')} ₫</td>
      </tr>`).join('');
    const total = order.tongTien || (order.items || []).reduce((s: number, it: any) => s + (it.qty || 0) * (it.price || 0), 0);
    return `<!doctype html><html><head><meta charset="utf-8"><title>Đơn Mua Hàng ${esc(order.id)}</title>
      <style>
        @page { size: A4; margin: 15mm 18mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Times New Roman', serif; color: #1a1a1a; font-size: 12px; line-height: 1.5; }
        .page { padding: 0; }
        /* Header dùng table thay vì flex: flex render không ổn định trong
           html2canvas (PDF chia sẻ) khiến 2 cột lệch/đè nhau — table thì luôn
           khớp giữa bản in trình duyệt và PDF xuất ra. */
        table.header { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
        table.header td { vertical-align: top; padding: 0; }
        .company-info { width: 58%; }
        .company-info .name { font-size: 14px; font-weight: bold; margin-bottom: 2px; }
        .company-info .detail { font-size: 10.5px; color: #333; margin: 1px 0; }
        .center-title { text-align: center; width: 42%; }
        .center-title .country { font-size: 12px; font-weight: bold; letter-spacing: 0.5px; }
        .center-title .motto { font-size: 10px; font-style: italic; color: #444; }
        .center-title .divider { width: 60px; height: 1px; background: #111; margin: 4px auto; }
        .center-title .doc-title { font-size: 18px; font-weight: bold; letter-spacing: 1px; margin-top: 8px; text-transform: uppercase; }
        .center-title .doc-code { font-size: 11px; font-weight: bold; margin-top: 3px; }
        .center-title .doc-date { font-size: 10px; color: #555; margin-top: 2px; }
        hr { border: none; border-top: 1.5px solid #222; margin: 10px 0; }
        /* table-layout: fixed để trình duyệt chốt độ rộng cột theo dòng đầu
           tiên, không tính lại theo nội dung — tránh html2canvas (PDF chia
           sẻ) tính sai độ rộng cột khi có dòng dùng colspan (VD: "Dự án"),
           gây đè chữ lên bảng vật tư bên dưới. */
        table.info { width: 100%; border-collapse: collapse; margin: 6px 0; table-layout: fixed; }
        table.info td { vertical-align: top; padding: 3px 8px; font-size: 11px; overflow-wrap: break-word; }
        table.info .lbl { font-weight: bold; white-space: nowrap; width: 130px; color: #222; }
        table.info .val { color: #1a1a1a; }
        table.items { width: 100%; border-collapse: collapse; margin-top: 10px; }
        table.items th, table.items td { border: 1px solid #222; padding: 5px 7px; font-size: 11px; }
        table.items th { background: #e8e8e8; font-weight: bold; text-align: center; }
        table.items td { vertical-align: middle; }
        .total-row { text-align: right; font-weight: bold; font-size: 13px; margin-top: 8px; padding: 6px 0; }
        .total-words { font-size: 11px; color: #333; margin: 4px 0 16px; }
        table.signatures { width: 100%; border-collapse: collapse; margin-top: 40px; text-align: center; font-size: 11px; }
        table.signatures td { vertical-align: top; width: 33.33%; padding: 0; }
        .signatures .sig-title { font-weight: bold; font-size: 11px; }
        .signatures .sig-note { font-size: 9.5px; color: #666; font-style: italic; margin-top: 4px; }
        .signatures .sig-name { font-weight: bold; margin-top: 40px; font-size: 11px; }
      </style></head><body>
      <div class="page">
        <table class="header"><tr>
          <td class="company-info">
            <div class="name">${esc(cp.companyName || 'TÊN DOANH NGHIỆP')}</div>
            ${cp.taxCode ? `<div class="detail">MST: ${esc(cp.taxCode)}</div>` : ''}
            ${cp.address ? `<div class="detail">Địa chỉ: ${esc(cp.address)}</div>` : ''}
            ${cp.phone ? `<div class="detail">Điện thoại: ${esc(cp.phone)}</div>` : ''}
            ${cp.email ? `<div class="detail">Email: ${esc(cp.email)}</div>` : ''}
            ${cp.representative ? `<div class="detail">Người đại diện: ${esc(cp.representative)}</div>` : ''}
          </td>
          <td class="center-title">
            <div class="country">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
            <div class="motto">Độc lập – Tự do – Hạnh phúc</div>
            <div class="divider"></div>
            <div class="doc-title">ĐƠN MUA HÀNG</div>
            <div class="doc-code">Mã: ${esc(order.id)}</div>
            <div class="doc-date">Ngày: ${esc(formatVietnameseDateTime(order.createdAt))}</div>
          </td>
        </tr></table>
        <hr/>
        <table class="info">
          <tr>
            <td class="lbl">Bên bán:</td><td class="val">${esc(order.supplierName || '—')}</td>
          </tr>
          ${order.supplierPhone ? `<tr><td class="lbl">Điện thoại NCC:</td><td class="val">${esc(order.supplierPhone)}</td></tr>` : ''}
          ${order.supplierAddress ? `<tr><td class="lbl">Địa chỉ NCC:</td><td class="val">${esc(order.supplierAddress)}</td></tr>` : ''}
        </table>
        <table class="info">
          <tr><td class="lbl">Người nhận hàng:</td><td class="val">${esc(ctx.receiverName)}</td>
              <td class="lbl">SĐT người đặt:</td><td class="val">${esc(ctx.receiverPhone)}</td></tr>
          <tr><td class="lbl">Địa chỉ nhận hàng:</td><td class="val" colspan="3">${esc(ctx.deliveryAddress)}</td></tr>
          <tr><td class="lbl">Người điều phối:</td><td class="val">${esc(ctx.coordinatorName)}</td>
              <td class="lbl">SĐT điều phối:</td><td class="val">${esc(ctx.coordinatorPhone)}</td></tr>
          <tr><td class="lbl">Dự án:</td><td class="val" colspan="3">${esc(ctx.projectName)}</td></tr>
        </table>
        <table class="items">
          <thead><tr>
            <th style="width:32px">STT</th>
            <th>Tên sản phẩm</th>
            <th style="width:42px">SL</th>
            <th style="width:42px">ĐVT</th>
            <th>Quy cách</th>
            <th style="width:90px;text-align:right">Đơn giá</th>
            <th style="width:100px;text-align:right">Thành tiền</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="total-row">TỔNG CỘNG: ${total.toLocaleString('vi-VN')} ₫</div>
        <div class="total-words">Bằng chữ: ${esc(numberToVietnameseWords(total))}</div>
        <table class="signatures"><tr>
          <td>
            <div class="sig-title">NGƯỜI LẬP PHIẾU</div>
            <div class="sig-note">(Ký, ghi rõ họ tên)</div>
            <div class="sig-name">${esc(order.createdByName || order.createdBy || '')}</div>
          </td>
          <td>
            <div class="sig-title">NGƯỜI ĐIỀU PHỐI</div>
            <div class="sig-note">(Ký, ghi rõ họ tên)</div>
            <div class="sig-name">${esc(ctx.coordinatorName)}</div>
          </td>
          <td>
            <div class="sig-title">ĐẠI DIỆN BÊN BÁN</div>
            <div class="sig-note">(Ký, đóng dấu)</div>
            <div class="sig-name">${esc(order.supplierName || '')}</div>
          </td>
        </tr></table>
      </div>
      </body></html>`;
  };

  const openOrderEdit = (order: any) => {
    setOrderEditDraft(JSON.parse(JSON.stringify(order || {})));
    setOrderSupplierOpen(false);
    setOrderEditModal({ open: true, order });
  };

  const saveOrderEdit = async () => {
    if (!orderEditDraft) return;
    const items = (orderEditDraft.items || []).map((it: any) => ({ ...it, totalPrice: (it.qty || 0) * (it.price || 0) }));
    const tongTien = items.reduce((s: number, it: any) => s + (it.qty || 0) * (it.price || 0), 0);
    const updated = { ...orderEditDraft, items, tongTien, congNo: tongTien - (orderEditDraft.thanhToanThucTe || 0) };
    await dbService.purchaseOrders.save(updated).catch(() => {});
    loadOrders();
    setOrderEditModal({ open: false, order: null });
    setOrderEditDraft(null);
    setOrderSupplierOpen(false);
    showNotification(`Đã cập nhật đơn hàng ${updated.id}.`, 'Sửa đơn hàng', 'success');
  };

  const deleteOrder = (order: any) => {
    askConfirmation(
      `Bạn có chắc chắn muốn XÓA đơn hàng ${order.id} không? Hành động này không thể hoàn tác và sẽ gỡ liên kết khỏi đề xuất.`,
      'Xác nhận xóa',
      async () => {
        await dbService.purchaseOrders.delete(order.id).catch(() => {});
        const affected = proposals.filter(p => (p.purchaseOrderIds || []).includes(order.id));
        for (const p of affected) {
          await saveProposal({ ...p, purchaseOrderIds: (p.purchaseOrderIds || []).filter((id: string) => id !== order.id) });
        }
        loadOrders();
        showNotification(`Đã xóa đơn hàng ${order.id}.`, 'Xóa đơn hàng', 'info');
      },
      'Xóa đơn hàng',
      'Trở lại'
    );
  };

  const printOrder = (order: any) => {
    const w = window.open('', '_blank');
    if (!w) { showNotification('Vui lòng cho phép mở popup để in đơn hàng.', 'Không thể in', 'warning'); return; }
    const ctx = resolveOrderCtx(order);
    w.document.write(buildPurchaseOrderHtml(order, ctx));
    w.document.close();
    // Chờ tài liệu render xong rồi mở hộp thoại in
    w.focus();
    setTimeout(() => { try { w.print(); } catch (e) { /* ignore */ } }, 400);
  };

  // Dựng PDF Đơn Mua Hàng thành Blob — dùng chung cho cả "Chia sẻ" và "Tải PDF".
  // Render trong 1 iframe ẩn thật (cùng cơ chế với "Xem trước"/"In" đang đúng)
  // rồi mới chụp bằng html2canvas — truyền thẳng chuỗi HTML cho
  // html2pdf().from(string) trước đây khiến nó không tính đúng layout bảng/CSS
  // (không nằm trong 1 document/khung hình thật), gây vỡ layout trong PDF.
  const generateOrderPdfBlob = async (order: any): Promise<Blob> => {
    const ctx = resolveOrderCtx(order);
    const html = buildPurchaseOrderHtml(order, ctx);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-99999px';
    iframe.style.top = '0';
    iframe.style.width = '794px'; // ~ khổ A4 210mm ở 96dpi
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    try {
      await new Promise<void>((resolve, reject) => {
        iframe.onload = () => resolve();
        iframe.onerror = () => reject(new Error('Không dựng được nội dung để xuất PDF.'));
        iframe.srcdoc = html;
      });
      // Đợi 1 nhịp để trình duyệt layout xong hẳn trước khi chụp
      await new Promise((r) => setTimeout(r, 80));
      const targetEl = iframe.contentDocument?.body;
      if (!targetEl) throw new Error('Không dựng được nội dung để xuất PDF.');

      const opt = {
        // Khớp đúng lề với @page trong buildPurchaseOrderHtml (15mm trên/dưới,
        // 18mm trái/phải) để PDF chia sẻ giống hệt bản in, không lệch lề.
        margin: [15, 18, 15, 18],
        filename: `DonMuaHang_${order.id}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', windowWidth: 794 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      };
      const html2pdf = (await loadHtml2Pdf()) as any;
      return await html2pdf().from(targetEl).set(opt).outputPdf('blob');
    } finally {
      document.body.removeChild(iframe);
    }
  };

  // Tải PDF Đơn Mua Hàng thẳng về máy — KHÔNG qua hộp thoại Share của hệ điều
  // hành (Windows Share không có lựa chọn "Lưu về máy" trực tiếp).
  const downloadOrderPdf = async (order: any) => {
    try {
      const blob = await generateOrderPdfBlob(order);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `DonMuaHang_${order.id}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      showNotification('Đã tải file PDF Đơn Mua Hàng về máy.', 'Đã tải PDF', 'success');
    } catch (e) {
      showNotification('Không thể tạo file PDF.', 'Lỗi', 'warning');
    }
  };

  // Chia sẻ trực tiếp file PDF Đơn Mua Hàng (thay vì chỉ chia sẻ link)
  const shareOrder = async (order: any) => {
    try {
      const blob = await generateOrderPdfBlob(order);
      const file = new File([blob], `DonMuaHang_${order.id}.pdf`, { type: 'application/pdf' });
      const navAny: any = navigator;
      if (navAny.canShare && navAny.canShare({ files: [file] })) {
        try {
          await navAny.share({ files: [file], title: `Đơn mua hàng ${order.id}`, text: `Đơn mua hàng ${order.id}` });
          return;
        } catch (e) { /* người dùng huỷ → fallback tải về */ }
      }
      // Thiết bị không hỗ trợ chia sẻ file → tải PDF về máy để gửi thủ công
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = file.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      showNotification('Đã tải file PDF Đơn Mua Hàng về máy để gửi thủ công.', 'Đã tải PDF', 'info');
    } catch (e) {
      showNotification('Không thể tạo file PDF để chia sẻ.', 'Lỗi', 'warning');
    }
  };

  const removeQuote = async (prop: any, quoteId: string) => {
    await saveProposal({ ...prop, quotes: (prop.quotes || []).filter((q: any) => q.id !== quoteId) });
  };

  const submitForApproval = async (prop: any) => {
    if (!(prop.quotes || []).length) { showNotification('Cần ít nhất 1 báo giá để gửi xét duyệt.', 'Thiếu báo giá', 'warning'); return; }
    const proposer = prop.createdByName || currentUser?.name || '—';
    await saveProposal({ ...prop, status: 'waiting_approval' });
    await sendProjectChat(prop, `📝 ĐỀ XUẤT VẬT TƯ ${prop.code} GỬI XÉT DUYỆT\nDự án: ${prop.projectName}\nNgười đề xuất: ${proposer}\n→ Chờ Người xét duyệt duyệt.`);
    showNotification(`Đã gửi đề xuất sang bước CHỜ DUYỆT (${(prop.quotes || []).length} báo giá).`, 'Gửi xét duyệt', 'success');
    setSelectedDocKey(null);
    setIsEditing(false);
  };

  // ─── CHỜ DUYỆT ───────────────────────────────────────────────────────────
  const handleApprove = async (prop: any) => {
    const quote = (prop.quotes || []).find((q: any) => q.id === chosenQuoteId);
    if (!quote) { showNotification('Vui lòng chọn 1 báo giá để duyệt.', 'Chưa chọn báo giá', 'warning'); return; }
    const items = (prop.items || []).map((it: any) => {
      const qi = (quote.items || []).find((x: any) => x.id === it.id);
      const price = qi ? qi.price : it.price;
      return { ...it, supplierId: qi?.supplierId || it.supplierId || '', supplierName: qi?.supplierName || it.supplierName || '', price, totalPrice: price * (it.qty || 0) };
    });
    const proposer = prop.createdByName || currentUser?.name || '—';
    const approver = currentUser?.name || '—';
    await saveProposal({
      ...prop,
      status: 'waiting_order',
      chosenQuoteId: quote.id,
      items,
      supplierId: quote.supplierId,
      supplierName: quote.supplierName,
    });
    await sendProjectChat(prop, `✅ ĐỀ XUẤT VẬT TƯ ${prop.code} ĐÃ ĐƯỢC DUYỆT\nDự án: ${prop.projectName}\nNgười đề xuất: ${proposer}\nNgười xét duyệt: ${approver}\nBáo giá được chọn: ${quote.supplierName}\n→ Chuyển sang bước CHỜ ĐẶT HÀNG.`);
    showNotification(`Đã duyệt và chuyển sang CHỜ ĐẶT HÀNG với báo giá của ${quote.supplierName}.`, 'Duyệt thành công', 'success');
    setSelectedDocKey(null);
    setIsEditing(false);
  };

  const handleReject = async (prop: any) => {
    const proposer = prop.createdByName || currentUser?.name || '—';
    const approver = currentUser?.name || '—';
    await saveProposal({ ...prop, status: 'find_supplier' });
    await sendProjectChat(prop, `❌ ĐỀ XUẤT VẬT TƯ ${prop.code} BỊ TỪ CHỐI\nDự án: ${prop.projectName}\nNgười đề xuất: ${proposer}\nNgười xét duyệt: ${approver}\n→ Quay lại bước TÌM NHÀ CUNG CẤP.`);
    showNotification('Đã từ chối đề xuất, quay lại TÌM NHÀ CUNG CẤP.', 'Từ chối', 'info');
    setSelectedDocKey(null);
    setIsEditing(false);
  };

  const handleCancel = async (prop: any) => {
    askConfirmation(
      `Bạn có chắc chắn muốn HỦY đề xuất ${prop.code} không?`,
      "Xác nhận hủy",
      async () => {
        const proposer = prop.createdByName || currentUser?.name || '—';
        await saveProposal({ ...prop, status: 'cancelled' });
        await sendProjectChat(prop, `🗑 ĐỀ XUẤT VẬT TƯ ${prop.code} ĐÃ BỊ HỦY\nDự án: ${prop.projectName}\nNgười đề xuất: ${proposer}`);
        showNotification(`Đã chuyển đề xuất ${prop.code} vào Thùng rác (tự xóa sau 30 ngày).`, 'Đã hủy', 'info');
        setSelectedDocKey(null);
        setIsEditing(false);
      },
      "Hủy đề xuất",
      "Trở lại"
    );
  };

  // ─── CHỜ ĐẶT HÀNG ────────────────────────────────────────────────────────
  const setItemSupplier = (prop: any, itemId: string, supplierId: string) => {
    setItemSupplierDraft(prev => ({ ...prev, [itemId]: supplierId }));
  };

  const createOrders = async (prop: any) => {
    const items = prop.items || [];
    if (!items.some((it: any) => it.supplierId || itemSupplierDraft[it.id])) {
      showNotification('Chưa gán nhà cung cấp hoặc chọn "Xuất từ Kho có sẵn" cho sản phẩm nào.', 'Thiếu nguồn vật tư', 'warning');
      return;
    }
    if ((prop.purchaseOrderIds || []).length > 0) {
      showNotification('Đề xuất này đã có đơn hàng, không thể tạo thêm.', 'Đã có đơn hàng', 'warning');
      return;
    }
    const rawEnrichedItems = items.map((it: any) => {
      const sid = it.supplierId || itemSupplierDraft[it.id] || '';
      if (sid === WAREHOUSE_SOURCE_ID) {
        return { ...it, supplierId: WAREHOUSE_SOURCE_ID, supplierName: 'Kho có sẵn', fromWarehouse: true };
      }
      const sup = suppliers.find((s: any) => s.id === sid);
      return { ...it, supplierId: sid, supplierName: sup?.name || it.supplierName || '' };
    });

    // ── Vật tư chọn "Xuất từ Kho có sẵn": kiểm tra tồn kho TRƯỚC (chặn vượt tồn),
    // tự lấy đơn giá nhập từ kho (KHÔNG dùng giá gõ tay), rồi mới trừ tồn kho —
    // KHÔNG tạo Đơn Mua Hàng / không phát sinh công nợ NCC.
    const warehouseItemsRaw = rawEnrichedItems.filter((it: any) => it.supplierId === WAREHOUSE_SOURCE_ID);
    const currentInv: any[] = warehouseItemsRaw.length > 0 ? await dbService.inventory.list() : [];
    const matchInv = (name: string) => currentInv.find((i: any) =>
      i.code?.toLowerCase() === name?.toLowerCase() || i.name?.toLowerCase() === name?.toLowerCase());

    if (warehouseItemsRaw.length > 0) {
      const violations: string[] = [];
      for (const it of warehouseItemsRaw) {
        const matched = matchInv(it.name);
        if (!matched) { violations.push(`${it.name}: không tìm thấy trong kho`); continue; }
        if ((it.qty || 0) > (matched.qty || 0)) {
          violations.push(`${it.name}: đề xuất ${it.qty} ${it.unit}, kho chỉ còn ${matched.qty}`);
        }
      }
      if (violations.length > 0) {
        showNotification(`Vượt tồn kho hoặc không có trong kho:\n${violations.join('\n')}`, 'Không thể xuất kho', 'warning');
        return;
      }
    }

    // Đơn giá của dòng "Xuất từ Kho có sẵn" LUÔN lấy theo đơn giá nhập hiện tại của kho
    // (không dùng giá gõ tay trong đề xuất) — đúng đơn giá thực tế xuất kho.
    const enrichedItems = rawEnrichedItems.map((it: any) => {
      if (it.supplierId !== WAREHOUSE_SOURCE_ID) return it;
      const matched = matchInv(it.name);
      return matched ? { ...it, price: matched.unitPrice || 0 } : it;
    });
    const warehouseItems = enrichedItems.filter((it: any) => it.supplierId === WAREHOUSE_SOURCE_ID);

    let stockDeductedCount = 0;
    if (warehouseItems.length > 0) {
      for (const it of warehouseItems) {
        const matched = matchInv(it.name);
        if (matched) {
          matched.qty = Math.max(0, matched.qty - (it.qty || 0));
          stockDeductedCount++;
          await dbService.inventory.save(matched).catch(() => {});
        }
      }
      if (stockDeductedCount > 0) window.dispatchEvent(new CustomEvent('hl-inventory-updated'));
    }

    // Mỗi sản phẩm còn lại (gán NCC thật) thuộc đúng 1 đơn (gom theo nhà cung cấp) → tối đa 1 đơn / sản phẩm
    const groups: Record<string, any[]> = {};
    enrichedItems.forEach((it: any) => { if (it.supplierId && it.supplierId !== WAREHOUSE_SOURCE_ID) { (groups[it.supplierId] = groups[it.supplierId] || []).push(it); } });
    const createdIds: string[] = [];
    let orderIdx = 0;
    for (const [sid, groupItems] of Object.entries(groups)) {
      const sup = suppliers.find((s: any) => s.id === sid);
      const tongTien = groupItems.reduce((s: number, it: any) => s + (it.qty || 0) * (it.price || 0), 0);
      const order = {
        id: `PO-${Date.now()}-${orderIdx++}`,
        supplierId: sid,
        supplierName: sup?.name || '',
        supplierPhone: sup?.phone || '',
        supplierAddress: sup?.address || '',
        projectId: prop.projectId || '',
        projectName: prop.projectName || '',
        proposalId: prop.id,
        proposalCode: prop.code,
        items: groupItems.map((it: any) => ({
          id: it.id,
          name: it.name,
          qty: it.qty,
          unit: it.unit,
          spec: it.spec || '',
          note: it.note || '',
          price: it.price || 0,
          totalPrice: (it.qty || 0) * (it.price || 0),
        })),
        tongTien,
        thanhToanThucTe: 0,
        congNo: tongTien,
        status: 'confirmed',
        notes: `Từ đề xuất ${prop.code}`,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.id || '',
      };
      const saved = await dbService.purchaseOrders.create(order);
      createdIds.push(saved.id);
    }

    // Vật tư "Xuất từ Kho có sẵn" cho CÔNG TRÌNH (không phải Đề Xuất Kho): tạo thêm 1
    // "đơn hàng nội bộ" (fromWarehouse=true, congNo=0, đã coi như thanh toán xong) để
    // tổng hợp vào chi phí công trình (tab Đơn Hàng lọc theo dự án) — không phát sinh
    // công nợ NCC vì đây không phải mua hàng từ bên ngoài.
    if (warehouseItems.length > 0 && prop.projectId !== WAREHOUSE_PROJECT_ID) {
      const tongTien = warehouseItems.reduce((s: number, it: any) => s + (it.qty || 0) * (it.price || 0), 0);
      const order = {
        id: `PO-${Date.now()}-${orderIdx++}`,
        supplierId: WAREHOUSE_SOURCE_ID,
        supplierName: 'Kho có sẵn',
        supplierPhone: '',
        supplierAddress: '',
        projectId: prop.projectId || '',
        projectName: prop.projectName || '',
        proposalId: prop.id,
        proposalCode: prop.code,
        fromWarehouse: true,
        items: warehouseItems.map((it: any) => ({
          id: it.id,
          name: it.name,
          qty: it.qty,
          unit: it.unit,
          spec: it.spec || '',
          note: it.note || '',
          price: it.price || 0,
          totalPrice: (it.qty || 0) * (it.price || 0),
          receivedQty: it.qty, // xuất kho = nhận hàng ngay, không có bước chờ giao
        })),
        tongTien,
        thanhToanThucTe: tongTien, // coi như đã "thanh toán" xong — không công nợ
        congNo: 0,
        status: 'completed',
        notes: `Xuất kho cho đề xuất ${prop.code}`,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.id || '',
      };
      const saved = await dbService.purchaseOrders.create(order);
      createdIds.push(saved.id);
    }

    // Nếu TOÀN BỘ vật tư đều xuất từ kho (không gán NCC thật nào) → coi như đã nhận
    // hàng xong ngay, không cần qua bước "Đặt hàng thành công" (vốn dành cho việc
    // theo dõi PO chờ giao từ NCC thật).
    const allWarehouseOnly = Object.keys(groups).length === 0 && warehouseItems.length > 0;
    await saveProposal({
      ...prop,
      items: enrichedItems,
      purchaseOrderIds: [...(prop.purchaseOrderIds || []), ...createdIds],
      status: allWarehouseOnly ? 'received' : prop.status,
    });
    setItemSupplierDraft({});
    loadOrders();
    const proposer = prop.createdByName || currentUser?.name || '—';
    const coordinator = currentUser?.name || '—';
    const summaryParts: string[] = [];
    if (createdIds.length > 0) summaryParts.push(`${createdIds.length} đơn hàng mua (${createdIds.join(', ')})`);
    if (stockDeductedCount > 0) summaryParts.push(`trừ kho ${stockDeductedCount} mặt hàng`);
    const summary = summaryParts.join(', ') || 'không có thay đổi';
    await sendProjectChat(prop, `🛒 ĐÃ XỬ LÝ ĐỀ XUẤT ${prop.code}: ${summary}\nDự án: ${prop.projectName}\nNgười đề xuất: ${proposer}\nNgười điều phối: ${coordinator}\n→ ${allWarehouseOnly ? 'Đã nhận hàng (xuất kho).' : 'Chờ Đặt hàng.'}`);
    showNotification(`Đã xử lý đề xuất: ${summary}.`, 'Xử lý đề xuất vật tư', 'success');
  };

  const markOrdered = async (prop: any) => {
    const coordinator = currentUser?.name || '—';
    await saveProposal({ ...prop, status: 'ordered' });
    await sendProjectChat(prop, `🚚 ĐỀ XUẤT VẬT TƯ ${prop.code} ĐÃ ĐẶT HÀNG THÀNH CÔNG\nDự án: ${prop.projectName}\nNgười điều phối: ${coordinator}\n→ Chờ nhận hàng và ghi nhận công nợ.`);
    showNotification(`Đã chuyển ${prop.code} sang ĐẶT HÀNG THÀNH CÔNG.`, 'Đặt hàng', 'success');
    setSelectedDocKey(null);
    setIsEditing(false);
  };

  // ─── ĐẶT HÀNG THÀNH CÔNG ─────────────────────────────────────────────────
  const changeSupplier = async (prop: any) => {
    await saveProposal({
      ...prop,
      status: 'waiting_order',
      chosenQuoteId: null,
      supplierId: null,
      supplierName: null,
      items: (prop.items || []).map((it: any) => ({ ...it, supplierId: undefined, supplierName: undefined })),
    });
    showNotification('Đã đưa đề xuất về CHỜ ĐẶT HÀNG để chọn lại NCC.', 'Đổi NCC', 'info');
    setSelectedDocKey(null);
    setIsEditing(false);
  };

  // ─── NHẬN HÀNG TỪNG PHẦN (ĐẶT HÀNG THÀNH CÔNG) ──────────────────────
  const openReceiveModal = (prop: any, orderId: string) => {
    const order = purchaseOrders.find((o: any) => o.id === orderId);
    if (!order) return;
    const defaults: Record<string, number> = {};
    (order.items || []).forEach((it: any) => {
      const remain = it.qty - (it.receivedQty || 0);
      if (remain > 0) defaults[it.id] = remain;
    });
    setReceiveQuantities(defaults);
    setReceiveModal({ open: true, order, proposal: prop });
  };

  const handleReceiveOrder = async () => {
    const { order, proposal } = receiveModal;
    if (!order || !proposal) return;
    const updatedItems = (order.items || []).map((item: any) => {
      const actualReceive = receiveQuantities[item.id] ?? 0;
      return {
        ...item,
        receivedQty: (item.receivedQty || 0) + actualReceive,
      };
    });
    const allReceived = updatedItems.every((i: any) => (i.receivedQty || 0) >= i.qty);

    // Đơn thuộc "Đề Xuất Kho" (mua hàng nhập kho, không thuộc công trình): nhận
    // hàng = CỘNG vào tồn kho (ngược với luồng xuất kho cho công trình), tự cập
    // nhật đơn giá nhập theo giá của lần nhập mới nhất.
    if (proposal.projectId === WAREHOUSE_PROJECT_ID) {
      const currentInv: any[] = await dbService.inventory.list();
      let addedCount = 0;
      for (const item of order.items || []) {
        const actualReceive = receiveQuantities[item.id] ?? 0;
        if (actualReceive <= 0) continue;
        const matched = currentInv.find((i: any) =>
          i.code?.toLowerCase() === item.name?.toLowerCase() || i.name?.toLowerCase() === item.name?.toLowerCase());
        if (matched) {
          await dbService.inventory.save({ ...matched, qty: (matched.qty || 0) + actualReceive, unitPrice: item.price || matched.unitPrice || 0 }).catch(() => {});
        } else {
          await dbService.inventory.save({
            id: `inv_${Date.now()}_${addedCount}`,
            code: item.name,
            name: item.name,
            unit: item.unit || '',
            qty: actualReceive,
            unitPrice: item.price || 0,
            minAlert: 0,
            location: '',
          }).catch(() => {});
        }
        addedCount++;
      }
      if (addedCount > 0) window.dispatchEvent(new CustomEvent('hl-inventory-updated'));
    }

    await dbService.purchaseOrders.save({
      ...order,
      items: updatedItems,
    });
    loadOrders();
    const allPOsReceived = (proposal.purchaseOrderIds || []).every((oid: string) => {
      if (oid === order.id) return allReceived;
      const otherPO = purchaseOrders.find((o: any) => o.id === oid);
      return otherPO?.items?.every((i: any) => (i.receivedQty || 0) >= i.qty);
    });
    if (allPOsReceived) {
      await saveProposal({ ...proposal, status: 'received' });
    } else {
      await saveProposal({ ...proposal });
    }
    await sendProjectChat(proposal, `📦 ĐỀ XUẤT VẬT TƯ ${proposal.code} ĐÃ NHẬN HÀNG${allReceived ? '' : ' MỘT PHẦN'}\nĐơn hàng: ${order.id}\nNhà cung cấp: ${order.supplierName}\nNgười nhận: ${currentUser?.name || '—'}${allReceived ? '\n→ Đã nhận đủ đơn hàng này.' : '\n→ Còn lại hàng chờ nhận tiếp.'}`);
    showNotification(
      allReceived ? `Đã nhận đủ đơn hàng ${order.id}.` : `Đã nhận một phần đơn hàng ${order.id}. Số lượng còn lại được giữ lại.`,
      'Nhận hàng', 'success'
    );
    setSelectedOrderForReceive(null);
    setReceiveModal({ open: false, order: null, proposal: null });
    setReceiveQuantities({});
    window.dispatchEvent(new CustomEvent('hl-purchase-orders-updated'));
    window.dispatchEvent(new CustomEvent('hl-material-proposals-updated'));
  };

  // Chốt số lượng thực nhận cho 1 đơn giao thiếu: hạ vĩnh viễn SL đặt + giá trị
  // đơn về đúng bằng SL đã thực nhận (không chờ giao phần còn thiếu nữa), giúp
  // đơn được coi là "đã nhận đủ" để chuyển đề xuất sang ĐÃ NHẬN HÀNG và đưa đúng
  // giá trị (đã giảm) qua tab Đơn Hàng của Tài Chính - Kế Toán.
  const handleFinalizeShortDelivery = (prop: any, order: any) => {
    const shortItems = (order.items || []).filter((it: any) => (it.receivedQty || 0) < (it.qty || 0));
    if (shortItems.length === 0) return;
    const shortSummary = shortItems.map((it: any) => `${it.name} thiếu ${(it.qty || 0) - (it.receivedQty || 0)}${it.unit ? ' ' + it.unit : ''}`).join(', ');
    askConfirmation(
      `⚠️ Chốt số lượng thực nhận cho đơn ${order.id}?\nCác dòng sau sẽ bị hạ SL đặt về đúng SL đã nhận (không chờ giao thêm):\n${shortSummary}\n\nGiá trị đơn & công nợ sẽ giảm tương ứng. Không thể hoàn tác.`,
      'Xác nhận chốt số lượng',
      async () => {
        const adjustedItems = (order.items || []).map((it: any) => {
          const receivedQty = it.receivedQty || 0;
          return { ...it, qty: receivedQty, receivedQty, totalPrice: receivedQty * (it.price || 0) };
        });
        const newTongTien = adjustedItems.reduce((s: number, it: any) => s + (it.qty || 0) * (it.price || 0), 0);
        const updatedOrder = {
          ...order,
          items: adjustedItems,
          tongTien: newTongTien,
          congNo: Math.max(0, newTongTien - (order.thanhToanThucTe || 0)),
          notes: `${order.notes || ''}${order.notes ? ' | ' : ''}Đã chốt thiếu hàng (${new Date().toLocaleDateString('vi-VN')}): ${shortSummary}`.trim(),
        };
        await dbService.purchaseOrders.save(updatedOrder);
        loadOrders();
        const allPOsReceived = (prop.purchaseOrderIds || []).every((oid: string) => {
          if (oid === order.id) return true;
          const otherPO = purchaseOrders.find((o: any) => o.id === oid);
          return otherPO?.items?.every((i: any) => (i.receivedQty || 0) >= i.qty);
        });
        if (allPOsReceived) {
          await saveProposal({ ...prop, status: 'received' });
        }
        await sendProjectChat(prop, `⚠️ ĐÃ CHỐT THIẾU HÀNG cho đơn ${order.id}\nNhà cung cấp: ${order.supplierName}\nThiếu: ${shortSummary}\nNgười chốt: ${currentUser?.name || '—'}\n→ Giá trị đơn đã giảm về đúng phần đã nhận, không chờ giao thêm.`);
        showNotification(`Đã chốt số lượng thực nhận cho đơn ${order.id}. Giá trị đơn giảm còn ${newTongTien.toLocaleString('vi-VN')} đ.`, 'Chốt số lượng', 'success');
        window.dispatchEvent(new CustomEvent('hl-purchase-orders-updated'));
        window.dispatchEvent(new CustomEvent('hl-material-proposals-updated'));
      },
      'Chốt số lượng',
      'Hủy bỏ'
    );
  };

  // ─── Columns config (5 cột chính — HỦY nằm ở thùng rác) ─────────────────
  const columns: { id: ProposalStatus; title: string; color: string; borderColor: string; bgColor: string; textColor: string; icon: any }[] = [
    { id: 'find_supplier', title: 'TÌM NHÀ CUNG CẤP', color: 'amber', borderColor: 'border-amber-200/80', bgColor: 'bg-amber-50', textColor: 'text-amber-700', icon: AlertCircle },
    { id: 'waiting_approval', title: 'CHỜ DUYỆT', color: 'sky', borderColor: 'border-sky-200/80', bgColor: 'bg-sky-50', textColor: 'text-sky-700', icon: Clock },
    { id: 'waiting_order', title: 'CHỜ ĐẶT HÀNG', color: 'violet', borderColor: 'border-violet-200/80', bgColor: 'bg-violet-50', textColor: 'text-violet-700', icon: Layers },
    { id: 'ordered', title: 'ĐẶT HÀNG THÀNH CÔNG', color: 'teal', borderColor: 'border-teal-200/80', bgColor: 'bg-teal-50', textColor: 'text-teal-700', icon: TrendingUp },
    { id: 'received', title: 'ĐÃ NHẬN HÀNG', color: 'emerald', borderColor: 'border-emerald-200/80', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700', icon: CheckCircle },
  ];

  // ─── Thanh phân trang dùng chung (cột kanban + thùng rác) ────────────────
  const PaginationBar = ({ page, totalPages, pageSize, onPage, onPageSize, total }: {
    page: number; totalPages: number; pageSize: number;
    onPage: (p: number) => void; onPageSize: (s: number) => void; total: number;
  }) => (
    <div className="flex items-center justify-between gap-1 px-2.5 py-2 border-t border-slate-200/80 bg-white/60 shrink-0">
      <div className="flex items-center gap-1">
        <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wide">Dòng/trang</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
          className="bg-white border border-slate-200 rounded px-1 py-0.5 text-[9px] font-bold text-slate-600 outline-none cursor-pointer"
        >
          {COL_PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="p-1 rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
        >
          <ChevronLeft className="w-3 h-3" />
        </button>
        <span className="text-[9.5px] font-mono font-bold text-slate-600 whitespace-nowrap">
          {total > 0 ? `Trang ${page}/${totalPages}` : '0 dòng'}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className="p-1 rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
        >
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="space-y-6 animate-fadeIn font-sans pb-12 text-slate-700 print:hidden">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                <Boxes className="w-5 h-5 animate-pulse" />
              </span>
              <h1 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">
                Điều Phối Cung Ứng Vật Tư
              </h1>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 hidden sm:block">Quy trình: TÌM NCC → CHỜ DUYỆT → CHỜ ĐẶT HÀNG → ĐẶT HÀNG THÀNH CÔNG → ĐÃ NHẬN HÀNG (đề xuất HỦY vào Thùng rác — tự xóa sau 30 ngày)</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => { setQuickPropIsWarehouse(false); setQuickPropProject(''); setQuickPropItems([{ id: `item_${Date.now()}_0`, name: '', qty: 1, unit: 'cái', spec: '', price: 0, note: '' }]); setQuickPropModal(true); }}
              className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl px-3 py-2 text-[11px] font-black shadow-md shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Zap className="w-4 h-4" /> Tạo Đề Xuất Nhanh
            </button>
            <button
              type="button"
              title="Đề xuất mua hàng từ NCC để nhập vào Kho (không thuộc công trình nào)"
              onClick={() => { setQuickPropIsWarehouse(true); setQuickPropProject(WAREHOUSE_PROJECT_ID); setQuickPropItems([{ id: `item_${Date.now()}_0`, name: '', qty: 1, unit: 'cái', spec: '', price: 0, note: '' }]); setQuickPropModal(true); }}
              className="flex items-center gap-1.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl px-3 py-2 text-[11px] font-black shadow-md shadow-teal-500/20 transition-all cursor-pointer"
            >
              📦 Đề Xuất Kho
            </button>
            <div className="text-[10px] font-mono bg-white border border-slate-200 rounded-lg p-2 text-slate-600 flex flex-col items-end">
              <span>Tổng: <strong className="text-amber-600">{stats.total}</strong></span>
              <span className="hidden sm:inline">Tài khoản: <strong className="text-slate-800">{currentUser?.name || 'Hệ thống'}</strong></span>
            </div>
          </div>
        </div>

        {/* FILTERS */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm mã dự án, tên, vật tư..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setColPage({}); }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-slate-400 focus:bg-white transition-all font-sans"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setColPage({}); }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-[11px] text-slate-700 outline-none cursor-pointer focus:border-slate-400 font-sans font-bold"
            >
              <option value="all">Tất cả</option>
              {(Object.keys(STATUS_LABEL) as ProposalStatus[]).filter(s => s !== 'cancelled').map(s => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => { setRestoreTargets({}); setTrashPage(1); setTrashOpen(true); }}
              className="relative flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-xl px-2.5 py-1.5 text-[11px] font-extrabold transition-all cursor-pointer"
              title="Xem đề xuất đã HỦY"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Hủy</span>
              <span className="font-mono font-black text-[10px] bg-white/80 border border-rose-200 rounded-full px-1.5 py-0.5">
                {cancelledProposals.length}
              </span>
            </button>
          </div>
        </div>

        {/* KANBAN BOARD — 5 cột trên 1 hàng */}
        <div className="w-full overflow-x-auto -mx-2 px-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3" style={{ minWidth: '100%' }}>
            {columns.map(col => {
              const colDocs = filteredDocs.filter(item => resolveStatus(item) === col.id);
              const colSize = getColPageSize(col.id);
              const colTotal = colTotalPages(col.id, colDocs.length);
              const colPageClamped = Math.min(getColPage(col.id), colTotal);
              const pagedDocs = colDocs.slice((colPageClamped - 1) * colSize, colPageClamped * colSize);
              return (
                <div key={col.id} className={`flex flex-col h-[400px] sm:h-[540px] lg:h-[680px] rounded-2xl sm:rounded-3xl bg-white/50 border ${col.borderColor} overflow-hidden shadow-lg sm:shadow-2xl relative transition-all duration-300 hover:shadow-xl hover:shadow-slate-100`}>
                  <div className={`p-4 border-b border-slate-200/80 flex items-center justify-between ${col.bgColor}`}>
                    <div className="flex items-center gap-2">
                      <col.icon className={`w-4.5 h-4.5 ${col.textColor}`} />
                      <h3 className="font-extrabold text-[12.5px] uppercase tracking-wider text-slate-900">{col.title}</h3>
                    </div>
                    <span className={`text-[11px] font-mono font-black px-2.5 py-0.5 rounded-full ${col.textColor} bg-white/80 border border-slate-200/80`}>
                      {colDocs.length}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 custom-scrollbar">
                    {pagedDocs.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                        <Boxes className="w-10 h-10 opacity-15 mb-3 text-slate-600" />
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Trống</p>
                        <p className="text-[10px] text-slate-600 mt-1 max-w-[150px]">Không có đề xuất nào ở trạng thái này</p>
                      </div>
                    ) : (
                      pagedDocs.map(item => {
                        const items = getDocItems(item.doc);
                        const materialsCount = items.length;
                        const isSelected = selectedDocKey === item.key;
                        const isProposal = item.kind === 'proposal';
                        const maCount = isProposal ? items.filter((i: any) => i.maSanPham).length : -1;

                        return (
                          <div
                            key={item.key}
                            onClick={() => handleSelectDoc(item.key)}
                            className={`border rounded-xl p-2 cursor-pointer transition-all duration-200 space-y-1.5 relative group overflow-hidden ${
                              isSelected ? 'bg-white border-amber-500/60 shadow-md ring-1 ring-amber-500/20' : 'bg-white border-slate-200 hover:border-amber-300 hover:bg-amber-50/40'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[9px]">
                              <span className={`font-mono font-extrabold px-1.5 py-0.5 rounded border ${
                                col.id === 'received'
                                  ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                                  : col.id === 'ordered'
                                  ? 'text-teal-600 bg-teal-50 border-teal-200'
                                  : col.id === 'find_supplier'
                                  ? 'text-amber-600 bg-amber-50 border-amber-200'
                                  : 'text-slate-600 bg-slate-50 border-slate-200'
                              } truncate max-w-[130px]`} title={item.doc.code || item.project.name}>
                                {item.doc.code || item.project.code}
                              </span>
                              <span className="font-mono font-black text-slate-500 text-[9px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                📦 {materialsCount} VT
                              </span>
                            </div>

                            <div>
                              <h4 className={`font-extrabold text-[11.5px] leading-snug transition-colors line-clamp-2 ${isSelected ? 'text-amber-600' : 'text-slate-800 group-hover:text-amber-600'}`}>
                                {item.project.name}
                              </h4>
                              {isProposal && maCount >= 0 && (
                                <p className="text-[8.5px] text-slate-400 mt-0.5">
                                  {maCount}/{items.length} dòng có mã MUA · {item.doc.createdByName || ''}
                                </p>
                              )}
                              {isProposal && (() => {
                                const relatedPOs = purchaseOrders.filter((o: any) => (item.doc.purchaseOrderIds || []).includes(o.id));
                                const hasShortage = relatedPOs.some((o: any) => (o.items || []).some((it: any) => (it.receivedQty || 0) > 0 && (it.receivedQty || 0) < (it.qty || 0)));
                                if (!hasShortage) return null;
                                return (
                                  <p className="text-[8.5px] text-amber-600 font-black mt-0.5 flex items-center gap-1">
                                    ⚠️ Giao thiếu hàng
                                  </p>
                                );
                              })()}
                            </div>

                            <div className="flex items-center justify-end text-[9px] text-slate-500 pt-0.5">
                              <span className="font-mono text-slate-400">{formatVietnameseDateTime(item.doc.createdAt)}</span>
                            </div>

                            </div>
                        );
                      })
                    )}
                  </div>

                  <PaginationBar
                    page={colPageClamped}
                    totalPages={colTotal}
                    pageSize={colSize}
                    total={colDocs.length}
                    onPage={(p) => setColPageSafe(col.id, p)}
                    onPageSize={(s) => { setColPageSize(prev => ({ ...prev, [col.id]: s })); setColPageSafe(col.id, 1); }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* THÙNG RÁC — ĐỀ XUẤT ĐÃ HỦY */}
      {trashOpen && (
        <div className="fixed inset-0 z-[9500] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in" onClick={() => setTrashOpen(false)}>
          <div className="w-full max-w-4xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 bg-rose-50 border-b border-rose-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-600" />
                <span className="font-black text-sm text-slate-900 uppercase">Đề xuất đã HỦY</span>
                <span className="text-[10.5px] font-mono font-black text-rose-600 bg-white border border-rose-200 rounded-full px-2 py-0.5">{cancelledProposals.length}</span>
              </div>
              <button type="button" onClick={() => setTrashOpen(false)} className="p-1.5 hover:bg-rose-100 rounded-full text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 flex items-start gap-2 text-[11px] text-slate-600">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p>
                  Các đề xuất bị HỦY sẽ <strong>tự động xóa vĩnh viễn sau 30 ngày</strong> kể từ lúc hủy. Bạn có thể khôi phục về một cột trong quy trình hoặc xóa ngay bây giờ.
                </p>
              </div>

              {cancelledProposals.length === 0 ? (
                <div className="h-56 flex flex-col items-center justify-center text-center text-slate-500">
                  <Trash2 className="w-12 h-12 opacity-15 mb-3 text-rose-500" />
                  <p className="text-[12px] font-bold text-slate-600 uppercase tracking-wide">Thùng rác trống</p>
                  <p className="text-[10.5px] text-slate-500 mt-1">Chưa có đề xuất nào bị hủy</p>
                </div>
              ) : (
                <>
                <div className="space-y-2.5 max-h-[46vh] overflow-y-auto custom-scrollbar pr-1">
                  {cancelledProposals.slice((Math.min(trashPage, getTrashTotalPages()) - 1) * trashPageSize, Math.min(trashPage, getTrashTotalPages()) * trashPageSize).map(item => {
                    const p = item.doc;
                    const days = daysUntilDeletion(p);
                    const itemsCount = (p.items || []).length;
                    const deletedAt = cancelledAtMs(p);
                    const progressPct = deletedAt ? Math.round(((Date.now() - deletedAt) / DAY_MS) * 100) : 0;
                    return (
                      <div key={item.key} className="border border-rose-200 bg-rose-50/40 rounded-xl p-3 space-y-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-extrabold text-[10px] text-rose-600 bg-white border border-rose-200 px-1.5 py-0.5 rounded">{p.code || '—'}</span>
                              <span className="font-black text-[12px] text-slate-800 truncate">{item.project.name}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {itemsCount} vật tư · Hủy lúc {formatVietnameseDateTime(p.updatedAt || p.createdAt)}
                            </div>
                          </div>
                          {/* Đếm ngược tự xóa */}
                          <div className="shrink-0 text-right">
                            <div className="flex items-center gap-1 text-[10px] font-black text-rose-600">
                              <Clock className="w-3 h-3" />
                              <span>{days} ngày trước khi tự xóa</span>
                            </div>
                            <div className="w-28 h-1.5 bg-rose-100 rounded-full mt-1 overflow-hidden">
                              <div className="h-full bg-rose-500 rounded-full" style={{ width: `${Math.max(0, Math.min(100, progressPct))}%` }} />
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                            <span className="font-black uppercase text-[9px] text-slate-400 tracking-wider">Khôi phục về:</span>
                            <select
                              value={restoreTargets[p.id] || 'waiting_order'}
                              onChange={(e) => setRestoreTargets(prev => ({ ...prev, [p.id]: e.target.value as ProposalStatus }))}
                              className="bg-white border border-slate-300 rounded p-1 text-[10.5px] text-slate-800 outline-none"
                            >
                              <option value="find_supplier">TÌM NHÀ CUNG CẤP</option>
                              <option value="waiting_approval">CHỜ DUYỆT</option>
                              <option value="waiting_order">CHỜ ĐẶT HÀNG</option>
                              <option value="ordered">ĐẶT HÀNG THÀNH CÔNG</option>
                              <option value="received">ĐÃ NHẬN HÀNG</option>
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={() => restoreProposal(p)}
                            className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-[10px] font-extrabold flex items-center gap-1 cursor-pointer transition-all"
                          >
                            <RefreshCcw className="w-3 h-3" /> Khôi phục
                          </button>
                          <div className="flex-1" />
                          <button
                            type="button"
                            onClick={() => deleteCancelledNow(p)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg text-[10px] font-extrabold flex items-center gap-1 cursor-pointer transition-all"
                          >
                            <Trash2 className="w-3 h-3" /> Xóa vĩnh viễn
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <PaginationBar
                  page={Math.min(trashPage, getTrashTotalPages())}
                  totalPages={getTrashTotalPages()}
                  pageSize={trashPageSize}
                  total={cancelledProposals.length}
                  onPage={(p) => setTrashPage(p)}
                  onPageSize={(s) => { setTrashPageSize(s); setTrashPage(1); }}
                />
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DETAIL DRAWER */}
      {selectedDocKey && activeDetail && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex justify-end z-50 animate-fade-in" onClick={() => { setSelectedDocKey(null); setIsEditing(false); setSelectedOrderForReceive(null); setShowRightPane(false); }}>
          <div className="w-full max-w-[1536px] bg-white border-l border-slate-200 h-full flex flex-col text-xs text-slate-800 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Drawer Header */}
            <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 shrink-0 flex justify-between items-center gap-2">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-8 h-8 sm:w-9 sm:h-9 bg-teal-500 rounded-lg flex items-center justify-center shadow-md shrink-0">
                  <Boxes className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <span className="font-mono font-extrabold text-[10px] text-teal-600 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                      {activeDetail.doc.code || 'MAT-NEW'}
                    </span>
                    <span className={`font-bold text-[9px] sm:text-[9.5px] uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded ${
                      resolveStatus(activeDetail) === 'cancelled' ? 'bg-rose-100 text-rose-700 border border-rose-200'
                      : resolveStatus(activeDetail) === 'received' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : 'bg-teal-100 text-teal-700 border border-teal-200'
                    }`}>
                      {STATUS_LABEL[resolveStatus(activeDetail)]}
                    </span>
                  </div>
                  <h4 className="font-black text-slate-900 text-sm sm:text-base mt-0.5 truncate">{activeDetail.project.name}</h4>
                  <div className="text-slate-500 text-[10px] hidden sm:block">
                    Người tạo: {activeDetail.doc.createdByName || ''} · {formatVietnameseDateTime(activeDetail.doc.createdAt)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {/* Toggle right tools pane — mobile */}
                <button
                  type="button"
                  onClick={() => setShowRightPane(v => !v)}
                  className="lg:hidden p-1.5 bg-teal-50 hover:bg-teal-100 text-teal-600 rounded-lg border border-teal-200 cursor-pointer transition-all"
                  title={showRightPane ? 'Ẩn công cụ' : 'Hiện công cụ'}
                >
                  {showRightPane ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedDocKey(null); setIsEditing(false); setSelectedOrderForReceive(null); setShowRightPane(false); }}
                  className="p-1.5 px-2 sm:px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-lg border border-slate-300 font-bold flex items-center gap-1 cursor-pointer transition-all"
                >
                  <X className="w-4 h-4" />
                  <span className="hidden sm:inline">Đóng</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row bg-slate-50" id="drawer_scrollable_body">
              {/* Left pane */}
              <div className="flex-1 p-3 sm:p-5 space-y-4 sm:space-y-5 overflow-y-auto h-full border-b lg:border-b-0 lg:border-r border-slate-200" id="drawer_left_pane">
                {/* THÔNG TIN */}
                <div className="bg-white border border-slate-200 p-3 sm:p-5 rounded-2xl space-y-3 sm:space-y-4 shadow-xs">
                  <span className="font-extrabold text-[11.5px] text-teal-600 flex items-center gap-1.5 uppercase tracking-wide border-b border-slate-100 pb-2">
                    <FileText className="w-4 h-4" />
                    Thông tin đề xuất
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-slate-700">
                    <div>
                      <span className="text-slate-500 block font-semibold mb-1">Dự án:</span>
                      <div className="bg-slate-50 border border-slate-200 rounded p-1.5 text-[11px] font-semibold">{activeDetail.project.name}</div>
                    </div>
                    <div>
                      <span className="text-slate-500 block font-semibold mb-1">Mã dự án:</span>
                      <div className="bg-slate-50 border border-slate-200 rounded p-1.5 font-mono text-[11px]">{activeDetail.project.code}</div>
                    </div>
                    {activeDetail.kind === 'proposal' && (
                      <>
                        <div>
                          <span className="text-slate-500 block font-semibold mb-1">Công việc liên quan:</span>
                          <div className="bg-slate-50 border border-slate-200 rounded p-1.5 text-[11px]">{activeDetail.doc.taskName || 'Liên quan toàn dự án'}</div>
                        </div>
                        <div>
                          <span className="text-slate-500 block font-semibold mb-1">Người tạo đề xuất:</span>
                          <div className="bg-slate-50 border border-slate-200 rounded p-1.5 text-[11px]">{activeDetail.doc.createdByName || ''}</div>
                        </div>
                        <div>
                          <span className="text-slate-500 block font-semibold mb-1">Nhà cung cấp đã chọn:</span>
                          <div className="bg-slate-50 border border-slate-200 rounded p-1.5 text-[11px] font-bold">{activeDetail.doc.supplierName || '—'}</div>
                        </div>
                        <div>
                          <span className="text-slate-500 block font-semibold mb-1">Ghi chú:</span>
                          <div className="bg-slate-50 border border-slate-200 rounded p-1.5 text-[11px]">{activeDetail.doc.notes || '—'}</div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* THÔNG TIN GIAO NHẬN & ĐIỀU PHỐI */}
                {activeDetail.kind === 'proposal' && (() => {
                  const pd = activeDetail.doc;
                  const pdProject = activeDetail.project;
                  const proposerEmp = employees.find((e: any) => e.id === pd.createdBy);
                  const coordinatorEmp = employees.find((e: any) => e.id === pd.coordinatorId);
                  const fieldBlock = (label: string, value: any, icon?: any) => (
                    <div>
                      <span className="text-slate-500 block font-semibold mb-1">{label}</span>
                      <div className="bg-slate-50 border border-slate-200 rounded p-1.5 text-[11px] font-semibold flex items-center gap-1.5">
                        {icon ? <span className="text-teal-600 shrink-0">{icon}</span> : null}
                        <span className="break-words">{value || '—'}</span>
                      </div>
                    </div>
                  );
                  return (
                    <div className="bg-white border border-slate-200 p-3 sm:p-5 rounded-2xl space-y-3 sm:space-y-4 shadow-xs">
                      <span className="font-extrabold text-[11px] sm:text-[11.5px] text-teal-600 flex items-center gap-1.5 uppercase tracking-wide border-b border-slate-100 pb-2">
                        <Truck className="w-4 h-4" />
                        Thông tin giao nhận &amp; điều phối
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-slate-700">
                        {fieldBlock('Tên người nhận hàng (người đề xuất)', pd.createdByName)}
                        {fieldBlock('SĐT người đặt hàng', proposerEmp?.phone)}
                        {fieldBlock('Địa chỉ nhận hàng', pdProject?.address, <MapPin className="w-3.5 h-3.5" />)}
                        {fieldBlock('Thông tin người điều phối', pd.coordinatorName)}
                        {fieldBlock('SĐT người điều phối', coordinatorEmp?.phone)}
                      </div>
                    </div>
                  );
                })()}

                {/* BẢNG VẬT TƯ */}
                <div className="bg-white border border-slate-200 p-3 sm:p-5 rounded-2xl space-y-3 shadow-xs">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-1">
                    <span className="font-extrabold text-[11px] sm:text-[11.5px] text-teal-600 flex items-center gap-1.5 uppercase tracking-wide">
                      <Boxes className="w-4 h-4" />
                      Danh mục vật tư
                    </span>
                    <span className="text-[10px] sm:text-[10.5px] font-black text-teal-600">Tổng: {proposalTotal(activeDetail.doc).toLocaleString('vi-VN')} ₫</span>
                  </div>

                  {/* Mobile: card layout */}
                  <div className="block lg:hidden space-y-2">
                    {getDocItems(activeDetail.doc).length === 0 ? (
                      <p className="p-4 text-center text-slate-500 text-[11px] font-medium">Chưa có vật tư.</p>
                    ) : (
                      getDocItems(activeDetail.doc).map((m: any, idx: number) => {
                        const price = m.price || 0;
                        const total = (m.qty || 0) * price;
                        const { received, poQty } = activeDetail.kind === 'proposal' ? getReceivedInfo(activeDetail.doc, m.id) : { received: 0, poQty: null };
                        const shortage = poQty !== null ? Math.max(0, poQty - received) : null;
                        const canEditRow = activeDetail.kind === 'proposal' && canEditProposalItems(activeDetail.doc);
                        return (
                          <div key={m.id || idx} className="border border-slate-200 rounded-xl p-2.5 bg-slate-50/50">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] font-mono font-bold text-slate-400">{idx + 1}.</span>
                                  <span className="font-semibold text-[11px] text-slate-800 truncate">{m.name}</span>
                                </div>
                                {m.maSanPham && (
                                  <span className="ml-4 text-[8px] text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1 py-0.5 font-bold">Mã: {m.maSanPham}</span>
                                )}
                                <div className="flex items-center gap-2 mt-1 ml-4 text-[9px] text-slate-500">
                                  {canEditRow ? (
                                    <span className="flex items-center gap-1">
                                      SL:
                                      <input
                                        type="number"
                                        min={0}
                                        defaultValue={m.qty}
                                        onBlur={(e) => {
                                          if (Number(e.target.value) !== m.qty) updateProposalItemField(activeDetail.doc, m.id, 'qty', e.target.value);
                                        }}
                                        className="w-12 text-center bg-white border border-teal-300 rounded px-1 py-0.5 font-mono font-bold text-teal-700 outline-none focus:border-teal-500"
                                      />
                                    </span>
                                  ) : (
                                    <span>SL: <strong className="text-teal-600 font-mono">{m.qty}</strong></span>
                                  )}
                                  {m.unit}
                                  {m.spec && <span className="italic">· {m.spec}</span>}
                                </div>
                                {poQty !== null && (
                                  <div className="ml-4 text-[9px] mt-0.5">
                                    <span className="text-slate-500">Đã nhận: <strong className="font-mono text-slate-700">{received}</strong></span>
                                    {!!shortage && <span className="ml-2 text-amber-600 font-bold">Còn thiếu: {shortage}</span>}
                                  </div>
                                )}
                                {m.supplierName && <div className="ml-4 text-[9px] text-slate-600 font-bold mt-0.5">NCC: {m.supplierName}</div>}
                              </div>
                              <div className="text-right shrink-0">
                                {canEditRow ? (
                                  <input
                                    type="number"
                                    min={0}
                                    defaultValue={price}
                                    onBlur={(e) => {
                                      if (Number(e.target.value) !== price) updateProposalItemField(activeDetail.doc, m.id, 'price', e.target.value);
                                    }}
                                    className="w-20 text-right bg-white border border-teal-300 rounded px-1 py-0.5 font-mono text-[10px] text-slate-700 outline-none focus:border-teal-500"
                                  />
                                ) : (
                                  <div className="text-[10px] font-mono text-slate-500">{price.toLocaleString('vi-VN')} ₫</div>
                                )}
                                <div className="text-[11px] font-mono font-black text-teal-600 mt-0.5">{total.toLocaleString('vi-VN')} ₫</div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Desktop: table layout */}
                  <div className="hidden lg:block overflow-x-auto border border-slate-200 rounded-xl bg-slate-50/50">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 uppercase text-[9px] font-black border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="p-2.5 text-center w-10">STT</th>
                          <th className="p-2.5 min-w-[160px]">Tên sản phẩm</th>
                          <th className="p-2.5 w-14 text-center">SL</th>
                          <th className="p-2.5 w-14 text-center">ĐVT</th>
                          <th className="p-2.5 min-w-[120px]">Quy cách</th>
                          <th className="p-2.5 min-w-[130px]">Nhà Cung Cấp</th>
                          <th className="p-2.5 text-right w-20">Đơn giá</th>
                          <th className="p-2.5 text-right w-24">Thành tiền</th>
                          <th className="p-2.5 text-center w-16">Đã nhận</th>
                          <th className="p-2.5 text-center w-16">Còn thiếu</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {getDocItems(activeDetail.doc).length === 0 ? (
                          <tr><td colSpan={10} className="p-8 text-center text-slate-600 font-medium">Chưa có vật tư nào trong đề xuất này.</td></tr>
                        ) : (
                          getDocItems(activeDetail.doc).map((m: any, idx: number) => {
                            const price = m.price || 0;
                            const total = (m.qty || 0) * price;
                            const { received, poQty } = activeDetail.kind === 'proposal' ? getReceivedInfo(activeDetail.doc, m.id) : { received: 0, poQty: null };
                            const shortage = poQty !== null ? Math.max(0, poQty - received) : null;
                            const canEditRow = activeDetail.kind === 'proposal' && canEditProposalItems(activeDetail.doc);
                            return (
                              <tr key={m.id || idx} className="hover:bg-slate-50/40">
                                <td className="p-2.5 text-center font-mono font-bold text-slate-600">{idx + 1}</td>
                                <td className="p-2.5 font-semibold text-slate-800">
                                  {m.name}
                                  {m.maSanPham && (
                                    <span className="ml-1.5 text-[8.5px] text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1 py-0.5 font-bold">Mã: {m.maSanPham}</span>
                                  )}
                                </td>
                                <td className="p-2.5 text-center font-bold text-teal-600 font-mono">
                                  {canEditRow ? (
                                    <input
                                      type="number"
                                      min={0}
                                      defaultValue={m.qty}
                                      onBlur={(e) => {
                                        if (Number(e.target.value) !== m.qty) updateProposalItemField(activeDetail.doc, m.id, 'qty', e.target.value);
                                      }}
                                      className="w-14 text-center bg-white border border-teal-300 rounded px-1 py-0.5 font-mono font-bold text-teal-700 outline-none focus:border-teal-500"
                                    />
                                  ) : m.qty}
                                </td>
                                <td className="p-2.5 text-center text-slate-600 font-medium">{m.unit}</td>
                                <td className="p-2.5 text-slate-500 italic">{m.spec || '—'}</td>
                                <td className="p-2.5 font-bold">{m.supplierName || '—'}</td>
                                <td className="p-2.5 text-right font-mono text-slate-600">
                                  {canEditRow ? (
                                    <input
                                      type="number"
                                      min={0}
                                      defaultValue={price}
                                      onBlur={(e) => {
                                        if (Number(e.target.value) !== price) updateProposalItemField(activeDetail.doc, m.id, 'price', e.target.value);
                                      }}
                                      className="w-20 text-right bg-white border border-teal-300 rounded px-1 py-0.5 font-mono text-slate-700 outline-none focus:border-teal-500"
                                    />
                                  ) : `${price.toLocaleString('vi-VN')} ₫`}
                                </td>
                                <td className="p-2.5 text-right font-mono font-black text-teal-600">{total.toLocaleString('vi-VN')} ₫</td>
                                <td className="p-2.5 text-center font-mono font-bold text-slate-600">{poQty !== null ? received : '—'}</td>
                                <td className={`p-2.5 text-center font-mono font-bold ${shortage ? 'text-amber-600' : 'text-slate-400'}`}>{shortage !== null ? shortage : '—'}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>


                </div>

                {/* ── BÁO GIÁ NHÀ CUNG CẤP ── */}
                {activeDetail.kind === 'proposal' && (() => {
                  const prop = activeDetail.doc;
                  if (prop.status !== 'find_supplier') return null;
                  return (
                    <div className="bg-white border border-slate-200 p-3 sm:p-5 rounded-2xl space-y-3 shadow-xs">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                        <span className="font-extrabold text-[11.5px] text-amber-600 flex items-center gap-1.5 uppercase tracking-wide">
                          <Store className="w-4 h-4" /> Báo giá nhà cung cấp ({prop.quotes?.length || 0}/3)
                        </span>
                        {isCoordinator && (
                          <button
                            type="button"
                            onClick={() => openQuoteModal(prop)}
                            className="bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black px-3 py-1.5 rounded-lg cursor-pointer transition-all"
                          >
                            <Plus className="w-3 h-3 inline mr-1" />Thêm báo giá
                          </button>
                        )}
                      </div>
                      {(!prop.quotes || prop.quotes.length === 0) ? (
                        <p className="text-[11px] text-slate-500 italic bg-slate-50 border border-dashed border-slate-300 rounded-lg p-3">
                          Chưa có báo giá. Nhấn "Thêm báo giá" để tạo tối đa 3 báo giá từ 3 nhà cung cấp khác nhau.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {prop.quotes.map((q: any) => (
                            <div key={q.id} className="border border-slate-200 rounded-xl p-3 bg-amber-50/40">
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="font-black text-[11px] text-slate-800">🏢 {q.supplierName}</span>
                                  <span className="ml-2 text-[9px] text-slate-500 font-mono">{formatVietnameseDateTime(q.createdAt)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-black text-teal-600">{quoteTotal(q).toLocaleString('vi-VN')} đ</span>
                                  <button type="button" onClick={() => setQuoteDetailModal({ open: true, quote: q, proposalCode: prop.code })} className="p-1 text-sky-600 hover:bg-sky-50 rounded cursor-pointer" title="Xem chi tiết báo giá">
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  {isCoordinator && (
                                    <>
                                      <button type="button" onClick={() => openEditQuote(prop, q)} className="p-1 text-amber-600 hover:bg-amber-50 rounded cursor-pointer" title="Sửa báo giá">
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button type="button" onClick={() => removeQuote(prop, q.id)} className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer" title="Xóa báo giá">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="mt-1.5 text-[9.5px] text-slate-600">
                                {(q.items || []).map((it: any, i: number) => (
                                  <div key={i} className="flex justify-between gap-2">
                                    <span>{it.name} × {it.qty} {it.unit}</span>
                                    <span className="font-mono font-bold">{it.price?.toLocaleString('vi-VN')} đ → {it.totalPrice?.toLocaleString('vi-VN')} đ</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── XÉT DUYỆT: CHỌN 1 BÁO GIÁ ── */}
                {activeDetail.kind === 'proposal' && (() => {
                  const prop = activeDetail.doc;
                  if (prop.status !== 'waiting_approval') return null;
                  return (
                    <div className="bg-white border border-slate-200 p-3 sm:p-5 rounded-2xl space-y-3 shadow-xs">
                      <span className="font-extrabold text-[11.5px] text-sky-700 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-100 pb-2">
                        <ShieldCheck className="w-4 h-4" /> Xét duyệt — chọn 1 báo giá
                      </span>
                      {(prop.quotes || []).map((q: any) => (
                        <div key={q.id} className="relative">
                          <label
                            className={`flex items-start gap-3 border rounded-xl p-3 cursor-pointer transition-all ${
                              chosenQuoteId === q.id ? 'border-sky-500 bg-sky-50 ring-1 ring-sky-500/30' : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`quote-${prop.id}`}
                              checked={chosenQuoteId === q.id}
                              onChange={() => setChosenQuoteId(q.id)}
                              className="mt-0.5 accent-sky-600"
                            />
                            <div className="flex-1">
                              <div className="flex justify-between">
                                <span className="font-black text-[11px] text-slate-800">🏢 {q.supplierName}</span>
                                <span className="text-[11px] font-black text-teal-600">{quoteTotal(q).toLocaleString('vi-VN')} đ</span>
                              </div>
                              <div className="mt-1 text-[9.5px] text-slate-600">
                                {(q.items || []).map((it: any, i: number) => (
                                  <div key={i} className="flex justify-between gap-2">
                                    <span>{it.name} × {it.qty} {it.unit}</span>
                                    <span className="font-mono font-bold">{it.price?.toLocaleString('vi-VN')} đ → {it.totalPrice?.toLocaleString('vi-VN')} đ</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </label>
                          <button
                            type="button"
                            onClick={() => setQuoteDetailModal({ open: true, quote: q, proposalCode: prop.code })}
                            className="absolute top-2 right-2 p-1 text-sky-600 hover:bg-sky-50 rounded cursor-pointer"
                            title="Xem chi tiết báo giá"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      {(!prop.quotes || prop.quotes.length === 0) && (
                        <p className="text-[11px] text-slate-500 italic bg-slate-50 border border-dashed border-slate-300 rounded-lg p-3">Đề xuất chưa có báo giá nào.</p>
                      )}
                    </div>
                  );
                })()}

                {/* ── GÁN NCC & TẠO ĐƠN HÀNG (chỉ CHỜ ĐẶT HÀNG) ── */}
                {activeDetail.kind === 'proposal' && (() => {
                  const prop = activeDetail.doc;
                  if (prop.status !== 'waiting_order') return null;
                  const hasOrder = (prop.purchaseOrderIds || []).length > 0;

                  // Áp dụng nhanh 1 NCC cho TOÀN BỘ danh mục vật tư
                  const applySupplierToAll = (sid: string) => {
                    setItemSupplierDraft(prev => {
                      const next = { ...prev };
                      (prop.items || []).forEach((it: any) => { next[it.id] = sid; });
                      return next;
                    });
                  };
                  const clearAllSuppliers = () => {
                    setItemSupplierDraft(prev => {
                      const next = { ...prev };
                      (prop.items || []).forEach((it: any) => { delete next[it.id]; });
                      return next;
                    });
                  };
                  // NCC đang được áp dụng đồng nhất cho mọi dòng (nếu có)
                  const allSids = (prop.items || []).map((it: any) => it.supplierId || itemSupplierDraft[it.id] || '');
                  const uniformSid = allSids.length > 0 && allSids.every((s: string) => s === allSids[0]) ? allSids[0] : '';

                  // "Đề Xuất Kho" (mua hàng nhập kho) không được phép tự chọn "Xuất từ
                  // Kho có sẵn" làm nguồn — kho không thể tự cấp cho chính nó.
                  const isWarehouseDest = prop.projectId === WAREHOUSE_PROJECT_ID;
                  const sourceOptions = [
                    ...(isWarehouseDest ? [] : [{ id: WAREHOUSE_SOURCE_ID, label: '📦 Xuất từ Kho có sẵn' }]),
                    ...suppliers.map((s: any) => ({ id: s.id, label: s.name })),
                  ];
                  const findInvMatch = (name: string) => inventory.find((i: any) =>
                    i.code?.toLowerCase() === name?.toLowerCase() || i.name?.toLowerCase() === name?.toLowerCase());
                  // Chặn tạo đơn nếu có dòng "Xuất từ Kho có sẵn" vượt tồn kho hiện tại
                  const hasStockViolation = (prop.items || []).some((it: any) => {
                    const sid = it.supplierId || itemSupplierDraft[it.id] || '';
                    if (sid !== WAREHOUSE_SOURCE_ID) return false;
                    const matched = findInvMatch(it.name);
                    return !matched || (it.qty || 0) > (matched.qty || 0);
                  });

                  return (
                    <div className="bg-white border border-slate-200 p-3 sm:p-5 rounded-2xl space-y-3 sm:space-y-4 shadow-xs">
                      <span className="font-extrabold text-[11px] sm:text-[11.5px] text-violet-600 flex items-center gap-1.5 uppercase tracking-wide border-b border-slate-100 pb-2">
                        <Layers className="w-4 h-4" /> Gán nguồn vật tư & Tạo đơn hàng
                      </span>

                      {/* Áp dụng nhanh 1 nguồn (NCC hoặc Kho có sẵn) cho toàn bộ danh mục */}
                      <div className="border border-violet-200 bg-violet-50 rounded-xl p-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-violet-700">Áp dụng 1 nguồn cho toàn bộ danh mục</span>
                          {uniformSid && (
                            <button
                              type="button"
                              onClick={clearAllSuppliers}
                              className="text-[9px] font-bold text-slate-500 hover:text-rose-500 underline cursor-pointer"
                            >Xóa tất cả</button>
                          )}
                        </div>
                        <SearchableSelect
                          options={sourceOptions}
                          value={uniformSid}
                          onChange={applySupplierToAll}
                          placeholder="-- Chọn NCC hoặc Kho có sẵn --"
                          searchPlaceholder="🔍 Tìm nhà cung cấp..."
                          disabled={!isCoordinator || hasOrder}
                          className="w-full"
                        />
                      </div>

                      <div className="space-y-2">
                        {(prop.items || []).map((it: any, idx: number) => {
                          const currentSid = it.supplierId || itemSupplierDraft[it.id] || '';
                          const isFromKho = currentSid === WAREHOUSE_SOURCE_ID;
                          const invMatch = isFromKho ? findInvMatch(it.name) : null;
                          const overStock = isFromKho && (!invMatch || (it.qty || 0) > (invMatch.qty || 0));
                          return (
                            <div key={it.id || idx} className={`border rounded-xl p-2.5 ${overStock ? 'border-rose-300 bg-rose-50/60' : 'border-slate-200 bg-violet-50/30'}`}>
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex-1 min-w-[150px]">
                                  <span className="text-[11px] font-bold text-slate-800">{it.name}</span>
                                  <span className="ml-1.5 text-[9px] text-slate-500">× {it.qty} {it.unit} · {((it.qty || 0) * (it.price || 0)).toLocaleString('vi-VN')} đ</span>
                                </div>
                                <SearchableSelect
                                  options={sourceOptions}
                                  value={currentSid}
                                  onChange={(sid) => setItemSupplier(prop, it.id, sid)}
                                  placeholder="-- Chọn NCC hoặc Kho có sẵn --"
                                  searchPlaceholder="🔍 Tìm nhà cung cấp..."
                                  disabled={!isCoordinator || hasOrder}
                                  className="min-w-[180px]"
                                />
                              </div>
                              {currentSid && !isFromKho && (
                                <p className="text-[9px] text-violet-600 font-bold mt-1">✔ Đã chọn: {suppliers.find(s => s.id === currentSid)?.name || ''}</p>
                              )}
                              {isFromKho && invMatch && (
                                <p className={`text-[9px] font-bold mt-1 ${overStock ? 'text-rose-600' : 'text-violet-600'}`}>
                                  ✔ Kho có sẵn — đơn giá nhập: {(invMatch.unitPrice || 0).toLocaleString('vi-VN')}đ · tồn: {invMatch.qty} {invMatch.unit}
                                  {overStock && ` — VƯỢT TỒN KHO (đề xuất ${it.qty}, còn ${invMatch.qty})`}
                                </p>
                              )}
                              {isFromKho && !invMatch && (
                                <p className="text-[9px] text-rose-600 font-bold mt-1">✘ Không tìm thấy "{it.name}" trong kho — không thể xuất.</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {hasOrder ? (
                        <p className="text-[10px] text-slate-500 italic bg-slate-50 border border-slate-200 rounded-lg p-2.5">Đã tạo đơn hàng cho đề xuất này. Các trường đã bị khóa.</p>
                      ) : isCoordinator ? (
                        <>
                          {hasStockViolation && (
                            <p className="text-[10px] text-rose-600 font-bold bg-rose-50 border border-rose-200 rounded-lg p-2.5">⚠ Có dòng vượt tồn kho hoặc không có trong kho — sửa lại nguồn/số lượng trước khi tạo đơn.</p>
                          )}
                          <button
                            type="button"
                            onClick={() => createOrders(prop)}
                            disabled={hasStockViolation}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-[12px] font-black py-2.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                          >
                            <FileText className="w-4 h-4" /> Tạo đơn hàng / Xuất kho
                          </button>
                        </>
                      ) : (
                        <p className="text-[10px] text-slate-500 italic">Chỉ Người điều phối mới được gán nguồn vật tư &amp; tạo đơn hàng.</p>
                      )}
                    </div>
                  );
                })()}

                {/* ── ĐƠN HÀNG ĐÃ TẠO (chọn để nhận hàng) ── */}
                {activeDetail.kind === 'proposal' && (() => {
                  const prop = activeDetail.doc;
                  const relatedOrders = purchaseOrders.filter((o: any) => (prop.purchaseOrderIds || []).includes(o.id));
                  if (relatedOrders.length === 0) return null;
                  const showRadio = prop.status === 'ordered';
                  return (
                    <div className="bg-white border border-slate-200 p-3 sm:p-5 rounded-2xl space-y-3 shadow-xs">
                      <span className="font-extrabold text-[11px] sm:text-[11.5px] text-teal-600 flex items-center gap-1.5 uppercase tracking-wide border-b border-slate-100 pb-2">
                        <FileText className="w-4 h-4" /> Đơn hàng đã tạo ({relatedOrders.length})
                      </span>
                      <div className="space-y-2.5">
                        {relatedOrders.map((o: any) => {
                          const totalItems = (o.items || []).length;
                          const receivedItems = (o.items || []).filter((i: any) => (i.receivedQty || 0) > 0).length;
                          const someReceived = (o.items || []).some((i: any) => (i.receivedQty || 0) > 0);
                          const allReceived = (o.items || []).every((i: any) => (i.receivedQty || 0) >= i.qty);
                          return (
                            <div
                              key={o.id}
                              className={`border rounded-xl transition-all ${
                                allReceived
                                  ? 'border-emerald-200 bg-emerald-50/40'
                                  : someReceived
                                  ? 'border-amber-200 bg-amber-50/40'
                                  : showRadio && selectedOrderForReceive === o.id
                                  ? 'border-teal-300 bg-teal-50/60 ring-1 ring-teal-300/50'
                                  : 'border-slate-200 bg-teal-50/30'
                              }`}
                            >
                              {/* Header row */}
                              <div className={`flex items-center justify-between gap-2 p-3 ${showRadio ? 'pb-2' : ''}`}>
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  {showRadio && (
                                    <div
                                      className="shrink-0 cursor-pointer"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedOrderForReceive(selectedOrderForReceive === o.id ? null : o.id);
                                      }}
                                    >
                                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                                        selectedOrderForReceive === o.id ? 'border-teal-600 bg-teal-600' : 'border-slate-300 bg-white'
                                      }`}>
                                        {selectedOrderForReceive === o.id && (
                                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <span className="font-mono font-black text-[11px] text-teal-700">{o.id}</span>
                                    <span className="ml-1.5 text-[10px] text-slate-600">· {o.supplierName}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {allReceived ? (
                                    <span className="text-[10px] text-emerald-600 font-bold">Đã nhận đủ ({totalItems} mục)</span>
                                  ) : (
                                    <span className="font-mono font-black text-[11px] text-slate-800">
                                      {(o.tongTien || 0).toLocaleString('vi-VN')} đ
                                      {someReceived && (
                                        <span className="text-amber-600 font-bold ml-1">· Đã nhận {receivedItems}/{totalItems}</span>
                                      )}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setOrderDetailModal({ open: true, order: o, proposal: prop, project: activeDetail.project })}
                                    className="bg-teal-600 hover:bg-teal-500 text-white text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                                  >
                                    <Eye className="w-3 h-3" /> Xem chi tiết
                                  </button>
                                </div>
                              </div>
                              {/* Cảnh báo giao thiếu hàng + nút Chốt số lượng thực nhận */}
                              {someReceived && !allReceived && isCoordinator && (
                                <div className="px-3 pb-2 flex items-center justify-between gap-2 bg-amber-50/80 border-t border-amber-200/60 py-1.5">
                                  <span className="text-[9.5px] text-amber-700 font-bold flex items-center gap-1">
                                    ⚠️ Đơn giao thiếu hàng — còn thiếu {(o.items || []).reduce((s: number, it: any) => s + Math.max(0, (it.qty || 0) - (it.receivedQty || 0)), 0)} món chưa về
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleFinalizeShortDelivery(prop, o)}
                                    className="bg-amber-600 hover:bg-amber-500 text-white text-[9.5px] font-black px-2 py-1 rounded-lg cursor-pointer transition-all whitespace-nowrap shrink-0"
                                    title="Chốt số lượng thực nhận — không chờ giao phần còn thiếu nữa"
                                  >
                                    Chốt số lượng thực nhận
                                  </button>
                                </div>
                              )}
                              {/* Item summary tags (only for not fully received) */}
                              {!allReceived && (
                                <div className="px-3 pb-3 flex flex-wrap gap-1">
                                  {(o.items || []).map((it: any, idx: number) => {
                                    const remain = it.qty - (it.receivedQty || 0);
                                    return (
                                      <span
                                        key={it.id || idx}
                                        className={`inline-block text-[9px] px-1.5 py-0.5 rounded font-medium border ${
                                          remain <= 0
                                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200 line-through'
                                            : (it.receivedQty || 0) > 0
                                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                                            : 'bg-slate-50 text-slate-600 border-slate-200'
                                        }`}
                                      >
                                        {it.name} ({it.qty}{it.unit ? ' ' + it.unit : ''}
                                        {(it.receivedQty || 0) > 0 && ` còn ${remain}`})
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

              </div>

              {/* Right tools pane — hidden on mobile unless toggled */}
              <div
                className={`${showRightPane ? 'fixed inset-0 z-[56] bg-black/40 lg:bg-transparent lg:relative lg:inset-auto lg:z-auto' : 'hidden'} lg:block lg:w-[280px] shrink-0`}
                onClick={(e) => { if (showRightPane && e.target === e.currentTarget) setShowRightPane(false); }}
              >
                <div className={`${showRightPane ? 'absolute right-0 top-0 h-full w-[85vw] max-w-[320px] shadow-2xl' : ''} lg:relative lg:w-full lg:max-w-none lg:shadow-none p-4 sm:p-5 bg-white lg:bg-slate-50 border-l border-slate-200 space-y-4 h-full overflow-y-auto`} id="drawer_right_pane">
                <span className="font-extrabold text-[10px] text-slate-600 block uppercase tracking-wider mb-1">
                  CÔNG CỤ ĐIỀU PHỐI
                </span>
{/* ── Status-specific workflow panels ── */}
                  {activeDetail.kind === 'proposal' && (() => {
                    const prop = activeDetail.doc;
                    const st = prop.status as ProposalStatus;

                    if (st === 'find_supplier') {
                      return (
                        <div className="space-y-3 pt-1">
                          <p className="text-[11px] text-slate-500 italic leading-relaxed">Xem &amp; thêm báo giá nhà cung cấp tại nội dung chi tiết bên trái.</p>
                          {isCoordinator && (
                            <div className="flex flex-col gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => submitForApproval(prop)}
                                className="w-full bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-black py-2.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                              >
                                <Send className="w-4 h-4" /> Gửi xét duyệt
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancel(prop)}
                                className="w-full bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black py-2.5 rounded-lg cursor-pointer transition-all"
                              >
                                Hủy bỏ
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    }

                    if (st === 'waiting_approval') {
                      return (
                        <div className="space-y-3 pt-1">
                          <p className="text-[11px] text-slate-500 italic leading-relaxed">Chọn 1 báo giá để duyệt tại nội dung chi tiết bên trái.</p>
                          {isApprover && (
                            <div className="flex flex-col gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => handleApprove(prop)}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black py-2.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                              >
                                <Check className="w-4 h-4" /> Duyệt
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReject(prop)}
                                className="w-full bg-orange-500 hover:bg-orange-400 text-white text-[11px] font-black py-2.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                              >
                                <RefreshCcw className="w-4 h-4" /> Từ chối
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancel(prop)}
                                className="w-full bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black py-2.5 rounded-lg cursor-pointer transition-all"
                              >
                                Hủy bỏ
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    }

                    if (st === 'waiting_order') {
                      return (
                        <div className="space-y-3 pt-1">
                          <span className="font-extrabold text-[11px] text-violet-700 uppercase tracking-wide flex items-center gap-1.5">
                            <Layers className="w-4 h-4" /> CHỜ ĐẶT HÀNG — tạo đơn hàng tại chi tiết đề xuất
                          </span>
                          <p className="text-[11px] text-slate-600 bg-violet-50 border border-violet-200 rounded-xl p-3 leading-relaxed">
                            Gán nhà cung cấp &amp; <strong>Tạo đơn hàng</strong> nằm ở phần chi tiết đề xuất (bên trái). Sau khi có đơn hàng, nhấn <strong>Đặt Hàng</strong> bên dưới để chuyển cột.
                          </p>
                          
                          {isCoordinator && (
                            <div className="flex flex-col gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => markOrdered(prop)}
                                disabled={(prop.purchaseOrderIds || []).length === 0}
                                title={(prop.purchaseOrderIds || []).length === 0 ? 'Cần Tạo đơn hàng trước khi Đặt Hàng' : ''}
                                className={`flex-1 ${(prop.purchaseOrderIds || []).length === 0 ? 'opacity-50 cursor-not-allowed bg-teal-600' : 'bg-teal-600 hover:bg-teal-500 cursor-pointer'} text-white text-[11px] font-black py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all`}
                              >
                                <Check className="w-4 h-4" /> Đặt Hàng
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancel(prop)}
                                className="bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black px-4 py-2.5 rounded-lg cursor-pointer transition-all"
                              >
                                Hủy bỏ
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    }

                    if (st === 'ordered') {
                      const hasSelectedOrder = selectedOrderForReceive && (prop.purchaseOrderIds || []).includes(selectedOrderForReceive);
                      return (
                        <div className="space-y-3 pt-1">
                          <span className="font-extrabold text-[11px] text-teal-700 uppercase tracking-wide flex items-center gap-1.5">
                            <PackageCheck className="w-4 h-4" /> ĐẶT HÀNG THÀNH CÔNG
                          </span>
                          <p className="text-[11px] text-slate-600 bg-teal-50 border border-teal-200 rounded-xl p-3">
                            Đơn hàng đã được đặt. Chọn một đơn hàng trong mục <strong>Đơn hàng đã tạo</strong> bên trái, nhấn <strong>Nhận hàng</strong> khi hàng về và nhập số lượng thực nhận. Dùng <strong>Đổi NCC</strong> nếu cần quay lại chọn nhà cung cấp.
                          </p>

                          {canActOnOrder(prop) && (
                            <div className="flex flex-col gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  if (hasSelectedOrder) openReceiveModal(prop, selectedOrderForReceive);
                                }}
                                disabled={!hasSelectedOrder}
                                title={!hasSelectedOrder ? 'Chọn một đơn hàng trong mục Đơn hàng đã tạo bên trái' : ''}
                                className={`flex-1 ${!hasSelectedOrder ? 'opacity-50 cursor-not-allowed bg-emerald-600' : 'bg-emerald-600 hover:bg-emerald-500 cursor-pointer'} text-white text-[11px] font-black py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all`}
                              >
                                <PackageCheck className="w-4 h-4" /> Nhận hàng
                              </button>
                              <button
                                type="button"
                                onClick={() => changeSupplier(prop)}
                                className="flex-1 bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-black py-2.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                              >
                                <RefreshCcw className="w-4 h-4" /> Đổi NCC
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancel(prop)}
                                className="bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black px-4 py-2.5 rounded-lg cursor-pointer transition-all"
                              >
                                Hủy bỏ
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    }

                    if (st === 'received') {
                      return (
                        <div className="space-y-3 pt-1">
                          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                            <span className="text-[11.5px] font-black text-emerald-700 uppercase tracking-wide">🎉 ĐÃ NHẬN HÀNG HOÀN TẤT</span>
                            <p className="text-[10px] text-emerald-600 mt-1">Tất cả đơn hàng trong đề xuất đã được nhận đủ.</p>
                          </div>
                          {(isCoordinator || isApprover) && (
                            <button
                              type="button"
                              onClick={() => handleCancel(prop)}
                              className="w-full bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black py-2.5 rounded-lg cursor-pointer transition-all"
                            >
                              Hủy bỏ
                            </button>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3 pt-1">
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center">
                          <span className="text-[11.5px] font-black text-rose-700 uppercase tracking-wide">ĐÃ HỦY</span>
                        </div>
                      </div>
                    );
                  })()}

                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl">
                  <p className="text-[10px] text-indigo-700 leading-relaxed font-medium">
                    💡 <strong>Quy trình:</strong> Sản phẩm có mã Danh mục MUA đi thẳng vào <strong>CHỜ ĐẶT HÀNG</strong>; sản phẩm chưa có mã vào <strong>TÌM NHÀ CUNG CẤP</strong>.
                  </p>
                </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINT-ONLY VOUCHER */}
      {activeDetail && (
        <div className="hidden print:block bg-white text-black p-8 text-xs font-serif leading-relaxed max-w-2xl mx-auto" id="corporate_material_proposal_printout">
          <div className="flex justify-between items-start border-b-2 border-black pb-4">
            <div className="text-left font-sans">
              <h3 className="font-bold text-[11px] tracking-wider uppercase">CÔNG TY CỔ PHẦN NỘI THẤT HOÀNG LONG</h3>
              <p className="text-[9px] text-gray-650">Địa chỉ: Số 12 Ba Tháng Hai, Đà Lạt, Lâm Đồng</p>
              <p className="text-[9px] text-gray-650">SĐT: 091.234.5678 | MST: 5801234567</p>
            </div>
            <div className="text-center font-sans">
              <h4 className="font-extrabold text-[10px] tracking-widest uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</h4>
              <p className="font-bold text-[9px]">Độc lập - Tự do - Hạnh phúc</p>
              <div className="w-24 h-0.5 bg-black mx-auto mt-1"></div>
            </div>
          </div>

          <div className="text-center my-8">
            <h2 className="text-lg font-black tracking-wider uppercase">PHIẾU ĐỀ XUẤT CUNG CẤP VẬT TƯ</h2>
            <p className="font-mono text-[10px] text-gray-500 mt-1">Mã: {activeDetail.doc.code || activeDetail.doc.id}</p>
            <p className="italic text-[10px] text-gray-650">Ngày giờ đề xuất: {formatVietnameseDateTime(activeDetail.doc.createdAt)}</p>
          </div>

          <div className="grid grid-cols-2 gap-y-2 mb-6 text-[11px] font-sans">
            <div><strong>Dự Án:</strong> {activeDetail.project.name} ({activeDetail.project.code})</div>
            <div><strong>Trạng thái:</strong> {STATUS_LABEL[resolveStatus(activeDetail)]}</div>
            <div><strong>Người yêu cầu:</strong> {activeDetail.doc.createdByName || activeDetail.doc.creatorName || 'Bộ phận Kỹ thuật'}</div>
            <div><strong>NCC đã chọn:</strong> {activeDetail.doc.supplierName || activeDetail.doc.supplierName || 'Vãng lai'}</div>
          </div>

          <table className="w-full text-left border-collapse border border-black my-6 font-sans">
            <thead>
              <tr className="bg-gray-100 text-[9px] font-bold border-b border-black">
                <th className="border border-black p-2 text-center w-10">STT</th>
                <th className="border border-black p-2">Tên Vật Tư</th>
                <th className="border border-black p-2 text-center w-16">SL</th>
                <th className="border border-black p-2 text-center w-12">ĐVT</th>
                <th className="border border-black p-2">Nhà Cung Cấp</th>
                <th className="border border-black p-2 text-right w-20">Đơn giá</th>
                <th className="border border-black p-2 text-right w-24">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {getDocItems(activeDetail.doc).length === 0 ? (
                <tr><td colSpan={7} className="border border-black p-4 text-center">Chưa khai báo vật tư</td></tr>
              ) : (
                getDocItems(activeDetail.doc).map((m: any, idx: number) => {
                  const price = m.price || 0;
                  const total = m.qty * price;
                  return (
                    <tr key={m.id || idx}>
                      <td className="border border-black p-2 text-center font-mono">{idx + 1}</td>
                      <td className="border border-black p-2">
                        <div className="font-bold">{m.name}</div>
                        {m.spec && <div className="text-[9px] text-gray-500 italic">Quy cách: {m.spec}</div>}
                      </td>
                      <td className="border border-black p-2 text-center font-mono font-bold">{m.qty}</td>
                      <td className="border border-black p-2 text-center">{m.unit}</td>
                      <td className="border border-black p-2 font-bold">{m.supplierName || 'Vãng lai'}</td>
                      <td className="border border-black p-2 text-right font-mono">{price.toLocaleString('vi-VN')} đ</td>
                      <td className="border border-black p-2 text-right font-mono font-bold">{total.toLocaleString('vi-VN')} đ</td>
                    </tr>
                  );
                })
              )}
              <tr className="font-bold bg-gray-50">
                <td colSpan={6} className="border border-black p-2 text-right text-[10px]">TỔNG CỘNG GIÁ TRỊ VẬT TƯ:</td>
                <td className="border border-black p-2 text-right font-mono text-xs">{proposalTotal(activeDetail.doc).toLocaleString('vi-VN')} đ</td>
              </tr>
            </tbody>
          </table>

          <div className="grid grid-cols-3 gap-4 text-center mt-12 mb-16 font-sans">
            <div className="space-y-12">
              <strong>NGƯỜI LẬP PHIẾU</strong>
              <p className="italic text-gray-400 text-[9px]">(Ký, ghi rõ họ tên)</p>
              <div className="mt-8 font-bold text-[11px]">{activeDetail.doc.createdByName || activeDetail.doc.creatorName || 'Nhân viên đề xuất'}</div>
            </div>
            <div className="space-y-12">
              <strong>NGƯỜI XÉT DUYỆT</strong>
              <p className="italic text-gray-400 text-[9px]">(Ký, ghi rõ họ tên)</p>
              <div className="mt-8 font-bold text-[11px]">{getMaterialApprover()?.name || 'Người xét duyệt'}</div>
            </div>
            <div className="space-y-12">
              <strong>GIÁM ĐỐC PHÊ DUYỆT</strong>
              <p className="italic text-gray-400 text-[9px]">(Ký, đóng dấu)</p>
              <div className="mt-8 font-bold text-[11px]">Ban Giám Đốc</div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Dialog */}
      {customConfirm && customConfirm.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-100/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-amber-100 text-amber-500 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="text-base font-bold text-slate-900">{customConfirm.title}</h3>
                <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{customConfirm.message}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCustomConfirm(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                {customConfirm.cancelText || 'Hủy bỏ'}
              </button>
              <button
                type="button"
                onClick={customConfirm.onConfirm}
                className="px-4 py-2 text-xs font-bold text-white bg-red-650 hover:bg-red-700 rounded-xl shadow-md transition cursor-pointer"
              >
                {customConfirm.confirmText || 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Dialog */}
      {customAlert && customAlert.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-100/70 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className={`p-3 rounded-full shrink-0 ${
                customAlert.type === 'warning' ? 'bg-amber-100 text-amber-500'
                : customAlert.type === 'info' ? 'bg-sky-100 text-sky-500'
                : 'bg-emerald-100 text-emerald-500'
              }`}>
                {customAlert.type === 'warning' ? (
                  <AlertTriangle className="w-8 h-8" />
                ) : customAlert.type === 'info' ? (
                  <Info className="w-8 h-8" />
                ) : (
                  <CheckCircle className="w-8 h-8" />
                )}
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-bold text-slate-900">{customAlert.title}</h3>
                <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{customAlert.message}</p>
              </div>
              <button
                type="button"
                onClick={() => setCustomAlert(null)}
                className="w-full mt-4 py-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl font-bold text-xs transition shadow-md cursor-pointer"
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

    {/* ORDER EDIT MODAL */}
    {orderEditModal.open && orderEditDraft && (
      <div className="fixed inset-0 z-[9600] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-fade-in" onClick={() => { setOrderEditModal({ open: false, order: null }); setOrderEditDraft(null); }}>
        <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
              <span className="font-black text-xs sm:text-sm text-slate-900 uppercase truncate">Sửa đơn hàng {orderEditDraft.id}</span>
            </div>
            <button type="button" onClick={() => { setOrderEditModal({ open: false, order: null }); setOrderEditDraft(null); }} className="p-1.5 hover:bg-slate-200 rounded-full text-slate-600 cursor-pointer transition-all shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 relative">
                <label className="block text-slate-500 font-bold text-[10px] uppercase">Nhà cung cấp</label>
                <input
                  value={orderEditDraft.supplierName || ''}
                  onChange={(e) => { setOrderEditDraft((p: any) => ({ ...p, supplierName: e.target.value })); setOrderSupplierOpen(true); }}
                  onFocus={() => setOrderSupplierOpen(true)}
                  onBlur={() => setTimeout(() => setOrderSupplierOpen(false), 150)}
                  placeholder="Tìm kiếm nhà cung cấp..."
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                />
                {orderSupplierOpen && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-52 overflow-y-auto">
                    {suppliers
                      .filter((s: any) => (s.name || '').toLowerCase().includes((orderEditDraft.supplierName || '').toLowerCase()))
                      .map((s: any) => (
                        <button
                          type="button"
                          key={s.id}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setOrderEditDraft((p: any) => ({ ...p, supplierName: s.name, supplierId: s.id }));
                            setOrderSupplierOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 text-[11px] hover:bg-indigo-50 text-slate-700 flex items-center gap-2 transition-all"
                        >
                          <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {s.name}
                        </button>
                      ))}
                    {suppliers.filter((s: any) => (s.name || '').toLowerCase().includes((orderEditDraft.supplierName || '').toLowerCase())).length === 0 && (
                      <div className="px-3 py-2 text-[10px] text-slate-400 italic">Không tìm thấy — nhấn Enter để dùng tên tự nhập.</div>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <label className="block text-slate-500 font-bold text-[10px] uppercase">Ghi chú</label>
                <input value={orderEditDraft.notes || ''} onChange={(e) => setOrderEditDraft((p: any) => ({ ...p, notes: e.target.value }))} className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 outline-none focus:border-indigo-500" />
              </div>
            </div>
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
              {(orderEditDraft.items || []).map((it: any, idx: number) => (
                <div key={it.id || idx} className="p-2.5 space-y-1.5 sm:space-y-0 sm:flex sm:items-center sm:gap-2">
                  <span className="flex-1 text-[11px] font-semibold text-slate-700 block sm:inline">{it.name}</span>
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
                    <div className="flex items-center gap-1">
                      <input type="number" value={it.qty || 0} onChange={(e) => setOrderEditDraft((p: any) => ({ ...p, items: p.items.map((x: any, i: number) => i === idx ? { ...x, qty: Number(e.target.value) } : x) }))} className="w-14 bg-white border border-slate-300 rounded-lg p-1.5 text-[11px] text-right text-slate-800 outline-none" />
                      <span className="text-[9px] text-slate-400">{it.unit}</span>
                    </div>
                    <input type="number" value={it.price || 0} onChange={(e) => setOrderEditDraft((p: any) => ({ ...p, items: p.items.map((x: any, i: number) => i === idx ? { ...x, price: Number(e.target.value) } : x) }))} className="w-20 sm:w-24 bg-white border border-slate-300 rounded-lg p-1.5 text-[11px] text-right text-slate-800 outline-none" />
                    <span className="text-[10px] font-mono font-bold text-teal-600 min-w-[80px] text-right">{((it.qty || 0) * (it.price || 0)).toLocaleString('vi-VN')} ₫</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-[11px] text-slate-500">Tổng cộng</span>
              <span className="font-black text-base text-teal-700">{((orderEditDraft.items || []).reduce((s: number, it: any) => s + (it.qty || 0) * (it.price || 0), 0)).toLocaleString('vi-VN')} đ</span>
            </div>
          </div>
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-2">
            <button type="button" onClick={() => { setOrderEditModal({ open: false, order: null }); setOrderEditDraft(null); }} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 rounded-lg cursor-pointer transition-all">Hủy</button>
            <button type="button" onClick={saveOrderEdit} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-2.5 rounded-lg cursor-pointer transition-all">Lưu thay đổi</button>
          </div>
        </div>
      </div>
    )}

    {/* ORDER DETAIL MODAL */}
    {orderDetailModal.open && orderDetailModal.order && (() => {
      const od: any = orderDetailModal.order;
      const odCtx = resolveOrderCtx(od);
      const odHtml = buildPurchaseOrderHtml(od, odCtx);
      const canDelete = isCoordinator && !(orderDetailModal.proposal?.status === 'received');
      return (
        <div className="fixed inset-0 z-[9700] flex items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs animate-fade-in" onClick={() => setOrderDetailModal({ open: false, order: null })}>
          <div className="w-full max-w-3xl bg-white sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col h-full sm:h-auto sm:max-h-[94vh]" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-5 h-5 text-teal-600 shrink-0" />
                <span className="font-black text-xs sm:text-sm text-slate-900 uppercase truncate">Đơn Hàng {od.id}</span>
              </div>
              <button type="button" onClick={() => setOrderDetailModal({ open: false, order: null })} className="p-1.5 hover:bg-slate-200 rounded-full text-slate-600 cursor-pointer transition-all shrink-0"><X className="w-5 h-5" /></button>
            </div>
            {/* Xem trước PDF Đơn Mua Hàng */}
            <div className="flex-1 overflow-auto bg-slate-300 p-2 sm:p-4" style={{ maxHeight: 'calc(100vh - 140px)' }}>
              <iframe
                title={`DonMuaHang_${od.id}`}
                srcDoc={odHtml}
                className="w-full bg-white shadow-xl mx-auto block"
                style={{ height: '100%', minHeight: '50vh', border: 'none' }}
              />
            </div>
            <div className="p-2 sm:p-4 bg-slate-50 border-t border-slate-200 grid grid-cols-4 gap-1.5 sm:gap-2">
              {canDelete ? (
                <button type="button" onClick={() => { setOrderDetailModal({ open: false, order: null }); deleteOrder(od); }} className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-600 text-[10px] sm:text-xs font-bold py-2 sm:py-2.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all"><Trash2 className="w-3.5 h-4" /> <span className="hidden xs:inline">Xóa</span></button>
              ) : (
                <button type="button" disabled className="flex-1 bg-slate-100 text-slate-400 text-[10px] sm:text-xs font-bold py-2 sm:py-2.5 rounded-lg flex items-center justify-center gap-1 cursor-not-allowed"><Trash2 className="w-3.5 h-4" /> <span className="hidden xs:inline">Xóa</span></button>
              )}
              <button type="button" onClick={() => printOrder(od)} className="flex-1 bg-sky-50 hover:bg-sky-100 text-sky-700 text-[10px] sm:text-xs font-bold py-2 sm:py-2.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all"><Printer className="w-3.5 h-4" /> In</button>
              <button type="button" onClick={() => downloadOrderPdf(od)} className="flex-1 bg-teal-50 hover:bg-teal-100 text-teal-700 text-[10px] sm:text-xs font-bold py-2 sm:py-2.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all" title="Tải PDF thẳng về máy, không qua hộp thoại Share"><Download className="w-3.5 h-4" /> <span className="hidden xs:inline">Tải PDF</span></button>
              <button type="button" onClick={() => { setOrderDetailModal({ open: false, order: null }); shareOrder(od); }} className="flex-1 bg-violet-50 hover:bg-violet-100 text-violet-700 text-[10px] sm:text-xs font-bold py-2 sm:py-2.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all"><Share2 className="w-3.5 h-4" /> Chia sẻ</button>
            </div>
          </div>
        </div>
      );
    })()}

    {/* QUOTE DETAIL MODAL — Xem chi tiết báo giá */}
    {quoteDetailModal.open && quoteDetailModal.quote && (() => {
      const q = quoteDetailModal.quote;
      const names = [...new Set((q.items || []).map((x: any) => x.supplierName).filter(Boolean))];
      return (
        <div
          className="fixed inset-0 z-[9500] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in"
          onClick={() => setQuoteDetailModal({ open: false, quote: null, proposalCode: '' })}
        >
          <div
            className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-sky-600" />
                <span className="font-black text-sm text-slate-900 uppercase">Chi tiết báo giá</span>
                <span className="text-[10px] text-slate-400 font-mono ml-1">{quoteDetailModal.proposalCode}</span>
              </div>
              <button
                type="button"
                onClick={() => setQuoteDetailModal({ open: false, quote: null, proposalCode: '' })}
                className="p-1.5 hover:bg-slate-200 rounded-full text-slate-600 cursor-pointer transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[10.5px]">
                <span className="font-black text-slate-800">🏢 {q.supplierName}</span>
                <span className="text-slate-500 font-mono">{formatVietnameseDateTime(q.createdAt)}</span>
              </div>
              {names.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {names.map((n: any, i: number) => (
                    <span key={i} className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">{n}</span>
                  ))}
                </div>
              )}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-[10.5px]">
                  <thead className="bg-slate-100 text-slate-600 font-bold">
                    <tr>
                      <th className="p-2 text-left">Sản phẩm</th>
                      <th className="p-2 text-center w-16">SL</th>
                      <th className="p-2 text-right w-24">Đơn giá</th>
                      <th className="p-2 text-right w-24">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(q.items || []).map((it: any, i: number) => (
                      <tr key={i} className="bg-white">
                        <td className="p-2">
                          <div className="font-semibold text-slate-800">{it.name}</div>
                          <div className="text-[8.5px] text-amber-600 font-bold">{it.supplierName || '—'}</div>
                          {it.spec && <div className="text-[8.5px] text-slate-400 italic">{it.spec}</div>}
                        </td>
                        <td className="p-2 text-center font-mono text-slate-700">{it.qty} {it.unit}</td>
                        <td className="p-2 text-right font-mono text-slate-700">{it.price?.toLocaleString('vi-VN')} đ</td>
                        <td className="p-2 text-right font-mono font-black text-teal-600">{it.totalPrice?.toLocaleString('vi-VN')} đ</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center bg-teal-50 border border-teal-100 rounded-lg px-3 py-2">
                <span className="text-[10.5px] font-bold text-slate-600 uppercase">Tổng cộng</span>
                <span className="font-black text-teal-600">{quoteTotal(q).toLocaleString('vi-VN')} đ</span>
              </div>
            </div>
          </div>
        </div>
      );
    })()}

    {/* RECEIVE ORDER MODAL — Nhận hàng từng phần */}
    {receiveModal.open && receiveModal.order && (() => {
      const order = receiveModal.order;
      const prop = receiveModal.proposal;
      const totalRemain = (order.items || []).reduce((s: number, it: any) => s + Math.max(0, it.qty - (it.receivedQty || 0)), 0);
      return (
        <div
          className="fixed inset-0 z-[9500] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-fade-in"
          onClick={() => { setReceiveModal({ open: false, order: null, proposal: null }); setReceiveQuantities({}); }}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 bg-teal-50 border-b border-teal-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-teal-600" />
                <span className="font-black text-sm text-slate-900 uppercase">Nhận hàng</span>
                <span className="font-mono font-extrabold text-[10px] text-teal-600 bg-white border border-teal-200 px-2 py-0.5 rounded ml-1">{order.id}</span>
              </div>
              <button
                type="button"
                onClick={() => { setReceiveModal({ open: false, order: null, proposal: null }); setReceiveQuantities({}); }}
                className="p-1.5 hover:bg-teal-100 rounded-full text-slate-600 cursor-pointer transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Body */}
            <div className="p-3 sm:p-5 space-y-3 sm:space-y-4 overflow-y-auto flex-1">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-800">🏢 {order.supplierName}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-500">{(order.tongTien || 0).toLocaleString('vi-VN')} đ</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">{formatVietnameseDateTime(order.createdAt)}</span>
              </div>
              {order.supplierPhone && (
                <div className="text-[10px] text-slate-500">📞 {order.supplierPhone}{order.supplierAddress ? ` · ${order.supplierAddress}` : ''}</div>
              )}
              {/* Items table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-[10.5px]">
                  <thead className="bg-slate-100 text-slate-600 font-bold">
                    <tr>
                      <th className="p-2 text-center w-10">STT</th>
                      <th className="p-2 text-left">Tên vật tư</th>
                      <th className="p-2 text-center w-16">SL đặt</th>
                      <th className="p-2 text-center w-16">Đã nhận</th>
                      <th className="p-2 text-center w-24">Nhận lần này</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(order.items || []).length === 0 ? (
                      <tr><td colSpan={5} className="p-6 text-center text-slate-500 text-[11px]">Đơn hàng không có vật tư.</td></tr>
                    ) : (
                      (order.items || []).map((it: any, idx: number) => {
                        const alreadyReceived = it.receivedQty || 0;
                        const remain = it.qty - alreadyReceived;
                        const isDone = remain <= 0;
                        return (
                          <tr key={it.id || idx} className={`bg-white ${isDone ? 'opacity-50' : ''}`}>
                            <td className="p-2 text-center font-mono text-slate-500">{idx + 1}</td>
                            <td className="p-2">
                              <div className="font-semibold text-slate-800">{it.name}</div>
                              {it.spec && <div className="text-[8.5px] text-slate-400 italic">{it.spec}</div>}
                              {it.unit && <span className="text-[8.5px] text-slate-400">ĐVT: {it.unit}</span>}
                            </td>
                            <td className="p-2 text-center font-mono font-bold text-slate-700">{it.qty}</td>
                            <td className="p-2 text-center font-mono text-emerald-600 font-bold">{alreadyReceived > 0 ? alreadyReceived : '—'}</td>
                            <td className="p-2 text-center">
                              {isDone ? (
                                <span className="text-[9px] text-emerald-600 font-bold">✅ Đã đủ</span>
                              ) : (
                                <input
                                  type="number"
                                  min={0}
                                  max={remain}
                                  value={receiveQuantities[it.id] ?? remain}
                                  onChange={(e) => {
                                    const val = Math.max(0, Math.min(remain, Number(e.target.value) || 0));
                                    setReceiveQuantities(prev => ({ ...prev, [it.id]: val }));
                                  }}
                                  className="w-20 text-center border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-mono font-bold outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30"
                                />
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {/* Summary */}
              <div className="flex justify-between items-center bg-teal-50 border border-teal-100 rounded-lg px-3 py-2 text-[11px]">
                <span className="font-bold text-slate-600">Còn {totalRemain} vật tư chờ nhận</span>
                <span className="text-slate-400">
                  Số lượng nhận lần này: {
                    Object.values(receiveQuantities).reduce((s: number, v) => s + (v as number), 0)
                  } / {totalRemain}
                </span>
              </div>
              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setReceiveModal({ open: false, order: null, proposal: null }); setReceiveQuantities({}); }}
                  className="px-5 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold rounded-lg cursor-pointer transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleReceiveOrder}
                  disabled={Object.values(receiveQuantities).every((v) => (v as number) === 0)}
                  className={`px-5 py-2 ${Object.values(receiveQuantities).every((v) => (v as number) === 0) ? 'opacity-50 cursor-not-allowed bg-emerald-600' : 'bg-emerald-600 hover:bg-emerald-500 cursor-pointer'} text-white text-[11px] font-black rounded-lg flex items-center gap-1.5 transition-all`}
                >
                  <PackageCheck className="w-4 h-4" /> Nhận hàng
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    })()}

    {/* QUICK PROPOSAL MODAL — Tạo đề xuất vật tư nhanh */}
    {quickPropModal && (
      <div
        className="fixed inset-0 z-[9800] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-fade-in"
        onClick={() => setQuickPropModal(false)}
      >
        <div
          className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`p-4 flex justify-between items-center shrink-0 bg-gradient-to-r ${quickPropIsWarehouse ? 'from-teal-600 to-emerald-600' : 'from-amber-500 to-orange-500'}`}>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-white" />
              <span className="font-black text-sm text-white uppercase">{quickPropIsWarehouse ? '📦 Tạo Đề Xuất Kho (Nhập hàng)' : 'Tạo Đề Xuất Vật Tư Nhanh'}</span>
            </div>
            <button type="button" onClick={() => setQuickPropModal(false)} className="p-1.5 hover:bg-white/20 rounded-full text-white cursor-pointer transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
            {/* Dự án + Công việc */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-slate-500 font-bold text-[10px] uppercase">Dự án *</label>
                {quickPropIsWarehouse ? (
                  <div className="w-full bg-teal-50 border border-teal-200 rounded-lg p-2 text-xs text-teal-700 font-bold">
                    📦 Kho Tổng (Nhập hàng) — không thuộc công trình
                  </div>
                ) : (
                  <SearchableSelect
                    options={projects.map(p => ({ id: p.id, label: `${p.code ? p.code + ' — ' : ''}${p.name}` }))}
                    value={quickPropProject}
                    onChange={setQuickPropProject}
                    placeholder="-- Chọn dự án --"
                    searchPlaceholder="🔍 Tìm dự án..."
                    className="w-full"
                  />
                )}
              </div>
              <div className="space-y-1">
                <label className="block text-slate-500 font-bold text-[10px] uppercase">Ghi chú</label>
                <input
                  value={quickPropNotes}
                  onChange={(e) => setQuickPropNotes(e.target.value)}
                  placeholder="Ghi chú cho đề xuất..."
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Danh mục vật tư */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[11px] text-slate-700">Danh mục vật tư ({quickPropItems.length})</span>
                <button
                  type="button"
                  onClick={addQuickPropItem}
                  className="flex items-center gap-1 text-[10px] font-bold text-amber-600 hover:text-amber-700 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Thêm vật tư
                </button>
              </div>
              {quickPropItems.length === 0 && (
                <p className="text-[11px] text-slate-400 italic bg-slate-50 border border-dashed border-slate-300 rounded-lg p-3 text-center">
                  Nhấn "Thêm vật tư" để bắt đầu.
                </p>
              )}
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-[34vh] overflow-y-auto">
                {quickPropItems.map((it, idx) => (
                  <div key={it.id} className="p-2.5 space-y-2 bg-white">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-slate-400 w-5 text-center shrink-0">{idx + 1}</span>
                      <input
                        value={it.name}
                        onChange={(e) => updateQuickPropItem(idx, 'name', e.target.value)}
                        placeholder="Tên vật tư *"
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800 outline-none focus:border-amber-400"
                      />
                      <button type="button" onClick={() => removeQuickPropItem(idx)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 pl-7">
                      <div className="flex items-center gap-1">
                        <input
                          type="number" min={1}
                          value={it.qty}
                          onChange={(e) => updateQuickPropItem(idx, 'qty', Math.max(1, Number(e.target.value) || 1))}
                          className="w-14 bg-white border border-slate-200 rounded p-1 text-[11px] text-center text-slate-800 outline-none focus:border-amber-400"
                        />
                        <input
                          value={it.unit}
                          onChange={(e) => updateQuickPropItem(idx, 'unit', e.target.value)}
                          className="w-12 bg-white border border-slate-200 rounded p-1 text-[11px] text-center text-slate-800 outline-none focus:border-amber-400"
                          placeholder="ĐVT"
                        />
                      </div>
                      <input
                        value={it.spec || ''}
                        onChange={(e) => updateQuickPropItem(idx, 'spec', e.target.value)}
                        placeholder="Quy cách"
                        className="flex-1 bg-white border border-slate-200 rounded p-1 text-[11px] text-slate-800 outline-none focus:border-amber-400"
                      />
                      <input
                        value={(it as any).maSanPham || ''}
                        onChange={(e) => updateQuickPropItem(idx, 'maSanPham', e.target.value)}
                        placeholder="Mã MUA"
                        className="w-20 bg-white border border-slate-200 rounded p-1 text-[11px] text-slate-800 outline-none focus:border-amber-400 font-mono"
                      />
                      {quickPropIsWarehouse && (
                        <input
                          type="number" min={0}
                          value={it.price || 0}
                          onChange={(e) => updateQuickPropItem(idx, 'price', Math.max(0, Number(e.target.value) || 0))}
                          placeholder="Đơn giá"
                          title="Đơn giá nhập kho dự kiến (đ)"
                          className="w-24 bg-white border border-teal-200 rounded p-1 text-[11px] text-right text-teal-700 font-bold outline-none focus:border-teal-400"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setQuickPropModal(false)}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 rounded-lg cursor-pointer transition-all text-xs"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={submitQuickProposal}
              className={`flex-1 text-white font-black py-2.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all text-xs shadow-md bg-gradient-to-r ${quickPropIsWarehouse ? 'from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 shadow-teal-500/20' : 'from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/20'}`}
            >
              <Zap className="w-4 h-4" /> Tạo đề xuất
            </button>
          </div>
        </div>
      </div>
    )}

    {/* QUOTE MODAL — Thêm báo giá nhà cung cấp */}
    {quoteModal.open && (
      <div
        className="fixed inset-0 z-[9500] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in"
        onClick={() => { setQuoteModal({ open: false, proposalId: '' }); setEditingQuoteId(''); }}
      >
        <div
          className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-amber-600" />
              <span className="font-black text-sm text-slate-900 uppercase">{editingQuoteId ? 'Sửa báo giá nhà cung cấp' : 'Thêm báo giá nhà cung cấp'}</span>
            </div>
            <button
              type="button"
              onClick={() => { setQuoteModal({ open: false, proposalId: '' }); setEditingQuoteId(''); }}
              className="p-1.5 hover:bg-slate-200 rounded-full text-slate-600 cursor-pointer transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {(() => {
            const prop = proposals.find((p: any) => p.id === quoteModal.proposalId);
            if (!prop) return null;
            return (
              <div className="p-5 space-y-4">
                {/* Quick add supplier */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold text-[10.5px] uppercase tracking-wider">Chọn NCC cho từng sản phẩm *</span>
                  <button
                    type="button"
                    onClick={() => setShowQuickSupplier((v) => !v)}
                    className="text-[10px] text-sky-600 hover:text-sky-800 hover:underline font-semibold cursor-pointer"
                  >
                    + Thêm NCC nhanh
                  </button>
                </div>
                {showQuickSupplier && (
                  <div className="flex gap-2">
                    <input
                      value={quickSupplierName}
                      onChange={(e) => setQuickSupplierName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') addQuickSupplier(); }}
                      placeholder="Tên nhà cung cấp mới..."
                      className="flex-1 bg-white border border-slate-300 rounded-lg p-1.5 text-xs text-slate-800 outline-none focus:border-sky-500"
                    />
                    <button
                      type="button"
                      onClick={addQuickSupplier}
                      className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-[11px] font-black cursor-pointer transition-all"
                    >
                      Lưu
                    </button>
                  </div>
                )}

                {/* Per-item: supplier + price */}
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-[320px] overflow-y-auto">
                  {(prop.items || []).map((it: any, idx: number) => {
                    const sid = quoteItemSuppliers[it.id] || '';
                    return (
                      <div key={it.id || idx} className="p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex-1 text-[11px] font-semibold text-slate-700">{it.name}</span>
                          <span className="text-[10px] text-slate-400 w-16 text-right">{it.qty} {it.unit}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <SearchableSelect
                            options={suppliers.map((s: any) => ({ id: s.id, label: s.name }))}
                            value={sid}
                            onChange={(selId) => setQuoteItemSuppliers((prev: Record<string, string>) => ({ ...prev, [it.id]: selId }))}
                            placeholder="-- Chọn NCC --"
                            searchPlaceholder="🔍 Tìm nhà cung cấp..."
                            className="flex-1"
                          />
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={quotePrices[it.id] ?? it.price ?? 0}
                              onChange={(e) => setQuotePrices((prev: Record<string, number>) => ({ ...prev, [it.id]: Number(e.target.value) }))}
                              className="w-24 bg-white border border-slate-300 rounded-lg p-1.5 text-xs text-right text-slate-800 outline-none focus:border-teal-500"
                            />
                            <span className="text-[10px] text-slate-400">đ</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => { setQuoteModal({ open: false, proposalId: '' }); setEditingQuoteId(''); }}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 rounded-lg cursor-pointer transition-all"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={addQuote}
                    className="flex-1 bg-teal-600 hover:bg-teal-500 text-white font-black py-2.5 rounded-lg cursor-pointer transition-all"
                  >
                    {editingQuoteId ? 'Cập nhật báo giá' : 'Thêm báo giá'}
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    )}

    </>
  );
}

// Helper to convert number to Vietnamese text
function numberToVietnameseWords(num: number): string {
  if (num === 0) return 'Không đồng';
  const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
  const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

  function readGroup(group: number): string {
    let result = '';
    const hundreds = Math.floor(group / 100);
    const tens = Math.floor((group % 100) / 10);
    const ones = group % 10;
    if (hundreds > 0) result += digits[hundreds] + ' trăm ';
    else if (tens > 0 || ones > 0) result += 'không trăm ';
    if (tens > 1) {
      result += digits[tens] + ' mươi ';
      if (ones === 1) result += 'mốt';
      else if (ones === 5) result += 'lăm';
      else if (ones > 0) result += digits[ones];
    } else if (tens === 1) {
      result += 'mười ';
      if (ones === 5) result += 'lăm';
      else if (ones > 0) result += digits[ones];
    } else if (ones > 0) {
      result += 'lẻ ' + digits[ones];
    }
    return result.trim();
  }

  let str = '';
  let groupIdx = 0;
  let remaining = num;
  while (remaining > 0) {
    const group = remaining % 1000;
    if (group > 0) str = readGroup(group) + ' ' + units[groupIdx] + ' ' + str;
    remaining = Math.floor(remaining / 1000);
    groupIdx++;
  }
  str = str.trim().replace(/\s+/g, ' ');
  if (str.toLowerCase().startsWith('không trăm lẻ')) str = str.substring(13).trim();
  else if (str.toLowerCase().startsWith('không trăm')) str = str.substring(10).trim();
  return str.charAt(0).toUpperCase() + str.slice(1) + ' đồng';
}

// Helper to format Date with time nicely
function formatVietnameseDateTime(dateStr: string | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const pad = (n: number) => n.toString().padStart(2, '0');
    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const hasTime = dateStr.includes('T') || dateStr.includes(':');
    return hasTime ? `${hours}:${minutes} - ${day}/${month}/${year}` : `${day}/${month}/${year}`;
  } catch (e) {
    return dateStr;
  }
}
