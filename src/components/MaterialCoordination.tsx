import React, { useState } from 'react';
import { isUserInRoleGroup, getMaterialCoordinator, getMaterialApprover } from '../context';
import {
  Project,
  Employee,
  Customer,
  Supplier,
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
  Download,
  Copy,
  Send,
  RefreshCcw,
  Store,
  PackageCheck,
  ShieldCheck,
  Pencil,
  Eye,
} from 'lucide-react';

interface MaterialCoordinationProps {
  projects: Project[];
  employees: Employee[];
  onUpdateProject: (id: string, updates: Partial<Project>) => void;
  onUpdateMultipleProjects?: (updatedProjectsList: Project[]) => Promise<void>;
  currentUser?: Employee;
  customers?: Customer[];
}

type ProposalStatus = 'find_supplier' | 'waiting_approval' | 'waiting_order' | 'ordered' | 'received' | 'cancelled';

// Trạng thái hiển thị của 1 thẻ trên bảng điều phối
interface BoardItem {
  key: string;
  kind: 'proposal' | 'legacy';
  project: Project;
  doc: any; // material_proposals hoặc ProjectDoc cũ
}

const LEGACY_STATUS_MAP: Record<string, ProposalStatus> = {
  draft: 'waiting_order',
  active: 'ordered',
  approved: 'received',
  rejected: 'cancelled',
  archived: 'cancelled',
};

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

  // Form states for legacy docs editing/viewing details
  const [editMaterials, setEditMaterials] = useState<any[]>([]);
  const [editCoordType, setEditCoordType] = useState<'self' | 'assign'>('self');
  const [editCoordinatorId, setEditCoordinatorId] = useState('');

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
  const [orderShareModal, setOrderShareModal] = useState<{ open: boolean; order: any | null }>({ open: false, order: null });
  const [orderDetailModal, setOrderDetailModal] = useState<{ open: boolean; order: any | null }>({ open: false, order: null });
  const [orderSupplierOpen, setOrderSupplierOpen] = useState(false);
  // Thùng rác: cửa sổ đề xuất bị HỦY + cột đích khi khôi phục
  const [trashOpen, setTrashOpen] = useState(false);
  const [restoreTargets, setRestoreTargets] = useState<Record<string, ProposalStatus>>({});

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

  React.useEffect(() => {
    loadProposals();
    loadOrders();
    loadSuppliers();
  }, [loadProposals, loadOrders, loadSuppliers]);

  React.useEffect(() => {
    const reload = () => { loadProposals(); loadOrders(); };
    const reloadSuppliers = () => loadSuppliers();
    window.addEventListener('hl-material-proposals-updated', reload);
    window.addEventListener('hl-suppliers-updated', reloadSuppliers);
    window.addEventListener('hl-inventory-updated', reloadSuppliers);
    return () => {
      window.removeEventListener('hl-material-proposals-updated', reload);
      window.removeEventListener('hl-suppliers-updated', reloadSuppliers);
      window.removeEventListener('hl-inventory-updated', reloadSuppliers);
    };
  }, [loadProposals, loadOrders, loadSuppliers]);

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const isLegacyMaterialDoc = (d: any) => {
    if (!d) return false;
    const codeLower = d.code?.toLowerCase() || '';
    const idLower = d.id?.toLowerCase() || '';
    return (
      codeLower.includes('mat-') ||
      idLower.includes('doc_mat_') ||
      (d.materials && Array.isArray(d.materials)) ||
      d.templateName === 'Bản thô đặt sản xuất phôi Hoàng Long'
    );
  };

  const resolveStatus = (item: BoardItem): ProposalStatus => {
    if (item.kind === 'proposal') return item.doc.status as ProposalStatus;
    return LEGACY_STATUS_MAP[item.doc.status] || 'waiting_order';
  };

  // Lấy danh sách dòng vật tư của 1 thẻ (mới: items; cũ: materials)
  const getDocItems = (doc: any): any[] => {
    if (doc && Array.isArray(doc.items)) return doc.items;
    if (doc && Array.isArray(doc.materials)) return doc.materials;
    return [];
  };

  const proposalTotal = (doc: any): number =>
    getDocItems(doc).reduce((s, m) => s + (m.qty || 0) * (m.price || 0), 0);

  const quoteTotal = (q: any): number =>
    (q.items || []).reduce((s, m) => s + (m.totalPrice || 0), 0);

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
    if (!uid) return true;
    if (isUserInRoleGroup(uid, 'role_admin')) return true;
    if (isUserInRoleGroup(uid, 'role_accounting')) return true;
    if (isUserInRoleGroup(uid, 'role_office')) return true;
    if (isUserInRoleGroup(uid, 'role_technical')) return true;
    if (currentUser?.username === 'admin') return true;
    const coord = getMaterialCoordinator();
    return !!coord && coord.id === uid;
  }, [currentUser]);

  const canApprove = React.useCallback((uid?: string): boolean => {
    if (!uid) return true;
    if (isUserInRoleGroup(uid, 'role_admin')) return true;
    if (currentUser?.username === 'admin') return true;
    const appr = getMaterialApprover();
    return !!appr && appr.id === uid;
  }, [currentUser]);

  const isCoordinator = canCoordinate(currentUser?.id);
  const isApprover = canApprove(currentUser?.id);

  // Gửi tin nhắn nhóm chat Dự án
  const sendProjectChat = React.useCallback(async (prop: any, content: string) => {
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
    projects.forEach(p => {
      (p.documents || []).forEach(d => {
        if (isLegacyMaterialDoc(d)) {
          result.push({ key: d.id, kind: 'legacy', project: p, doc: d });
        }
      });
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

  // Khôi phục 1 đề xuất đã HỦY về cột đã chọn
  const restoreProposal = async (p: any) => {
    const target = restoreTargets[p.id] || 'waiting_order';
    await saveProposal({ ...p, status: target });
    showNotification(`Đã khôi phục đề xuất ${p.code} về cột ${STATUS_LABEL[target]}.`, 'Khôi phục thành công', 'success');
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

  // ─── Legacy handlers (giữ luồng cũ cho dữ liệu ProjectDoc cũ) ──────────
  const activeDetail = boardItems.find(item => item.key === selectedDocKey);

  const handleSelectDoc = (key: string) => {
    setSelectedDocKey(key);
    setChosenQuoteId('');
    setItemSupplierDraft({});
    const found = boardItems.find(item => item.key === key);
    if (found && found.kind === 'legacy') {
      setEditMaterials(found.doc.materials ? [...found.doc.materials] : []);
      setEditCoordType(found.doc.coordinationType || 'self');
      setEditCoordinatorId(found.doc.coordinatorId || '');
      setIsEditing(false);
    }
  };

  const handleLegacySaveDocChanges = () => {
    if (!activeDetail || activeDetail.kind !== 'legacy') return;
    const found = activeDetail;
    const coordinatorName = editCoordType === 'assign'
      ? (employees.find(e => e.id === editCoordinatorId)?.name || 'Người điều phối')
      : 'Tự điều phối';
    const updatedDocs = (found.project.documents || []).map((doc: any) => {
      if (doc.id === found.doc.id) {
        return {
          ...doc,
          materials: editMaterials,
          coordinationType: editCoordType,
          coordinatorId: editCoordinatorId,
          coordinatorName,
          name: `Đề xuất cấp vật tư thô: ${editMaterials.length} chủng loại (${coordinatorName})`,
        };
      }
      return doc;
    });
    onUpdateProject(found.project.id, { documents: updatedDocs });
    setIsEditing(false);
    showNotification('Cập nhật thông tin điều phối vật tư thành công!', 'Thành công', 'success');
  };

  // Giữ luồng cũ: Xuất kho / Đã nhận hàng cho các đề xuất cũ
  const handleLegacyStatus = async (doc: any, project: Project, newStatus: 'draft' | 'active' | 'approved' | 'archived' | 'rejected') => {
    let notificationMsg = '';
    if (newStatus === 'approved') {
      const isSupplier = doc.proposalType === 'supplier' || !!doc.supplierId || doc.templateName?.includes('nhà cung cấp') || doc.templateName?.includes('NCC');
      if (!isSupplier) {
        const currentInv: any[] = await dbService.inventory.list();
        const docMaterials = doc.materials || [];
        let stockUpdatedCount = 0;
        for (const m of docMaterials) {
          const matchedStock = currentInv.find((i: any) => i.code?.toLowerCase() === m.name?.toLowerCase() || i.name?.toLowerCase() === m.name?.toLowerCase());
          if (matchedStock) {
            matchedStock.qty = Math.max(0, matchedStock.qty - (m.qty || 0));
            stockUpdatedCount++;
            await dbService.inventory.save(matchedStock).catch(() => {});
          }
        }
        if (stockUpdatedCount > 0) window.dispatchEvent(new CustomEvent('hl-inventory-updated'));
        notificationMsg = `Đã hoàn tất nhận hàng từ Kho!\n- Đã trừ kho ${stockUpdatedCount} mặt hàng.`;
      } else {
        const supplierIdToUse = doc.supplierId || 'SUP_001';
        const currentSups: any[] = await dbService.suppliers.list();
        const matchedSup = currentSups.find((s: any) => s.id === supplierIdToUse || s.name === doc.supplierName);
        if (matchedSup) {
          let debt = 0;
          (doc.materials || []).forEach((m: any) => { debt += (m.qty || 0) * (m.price || 150000); });
          matchedSup.debt = (matchedSup.debt || 0) + debt;
          await dbService.suppliers.save(matchedSup).catch(() => {});
          // Ghi nhận công nợ vào tab Công nợ Trả (bảng accounting_liabilities)
          const liabList: any[] = await dbService.accountingLiabilities.list().catch(() => []);
          const existing = liabList.find((l: any) => l.category === 'Nhà Cung Cấp' && l.name === matchedSup.name);
          if (existing) {
            const newValue = (existing.value || 0) + debt;
            await dbService.accountingLiabilities.save({
              ...existing,
              value: newValue,
              remaining: newValue - (existing.paid || 0),
            }).catch(() => {});
          } else {
            await dbService.accountingLiabilities.save({
              id: crypto.randomUUID(),
              name: matchedSup.name,
              category: 'Nhà Cung Cấp',
              value: debt,
              paid: 0,
              remaining: debt,
              notes: `Công nợ vật tư — Đề xuất ${doc.id || ''}`,
            }).catch(() => {});
          }
          window.dispatchEvent(new CustomEvent('hl-suppliers-updated'));
          window.dispatchEvent(new CustomEvent('hl-accounting-liabilities-updated'));
          notificationMsg = `Đã hoàn tất nhận hàng từ NCC ${matchedSup.name}!\n- Công nợ tăng: +${debt.toLocaleString('vi-VN')} đ.`;
        }
      }
    }
    const updatedDocs = (project.documents || []).map((d: any) => (d.id === doc.id ? { ...d, status: newStatus } : d));
    onUpdateProject(project.id, { documents: updatedDocs });
    showNotification(notificationMsg || `Đã chuyển trạng thái đề xuất.`, 'Cập nhật trạng thái', 'success');
  };

  const handleLegacyDeleteDoc = (doc: any, project: Project) => {
    askConfirmation(
      "⚠️ Bạn có chắc chắn muốn XÓA vĩnh viễn đề xuất điều phối vật tư này không?",
      "Xác nhận xóa vĩnh viễn",
      () => {
        const updatedDocs = (project.documents || []).filter((d: any) => d.id !== doc.id);
        onUpdateProject(project.id, { documents: updatedDocs });
        setSelectedDocKey(null);
        setIsEditing(false);
        showNotification('Đã xóa đề xuất điều phối vật tư!', 'Xóa thành công', 'success');
      },
      "Xóa vĩnh viễn",
      "Hủy bỏ"
    );
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
    const supplierIds = items.map(it => quoteItemSuppliers[it.id] || '');
    if (supplierIds.some(id => !id)) { showNotification('Vui lòng chọn Nhà Cung Cấp cho TẤT CẢ sản phẩm!', 'Thiếu NCC', 'warning'); return; }
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
    const names = [...new Set(qItems.map(q => q.supplierName).filter(Boolean))];
    const supplierName = names.length === 1 ? names[0] : `${names.length} nhà cung cấp`;
    const primarySid = qItems.find(q => q.supplierId)?.supplierId || '';
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
  const buildOrderShareText = (o: any) => {
    const lines = (o.items || []).map((it: any) => `  - ${it.name} × ${it.qty} ${it.unit}: ${((it.qty || 0) * (it.price || 0)).toLocaleString('vi-VN')} đ`).join('\n');
    return `ĐƠN HÀNG MUA HÀNG\nMã: ${o.id}\nNCC: ${o.supplierName || ''}\nNgày: ${formatVietnameseDateTime(o.createdAt)}\nTổng: ${(o.tongTien || 0).toLocaleString('vi-VN')} đ\nChi tiết:\n${lines}`;
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
    const rows = (order.items || []).map((it: any, i: number) => `
      <tr>
        <td>${i + 1}</td>
        <td>${it.name || ''}</td>
        <td style="text-align:center">${it.qty || 0}</td>
        <td style="text-align:center">${it.unit || ''}</td>
        <td>${it.spec || ''}</td>
        <td style="text-align:right">${(it.price || 0).toLocaleString('vi-VN')} đ</td>
        <td style="text-align:right">${((it.qty || 0) * (it.price || 0)).toLocaleString('vi-VN')} đ</td>
      </tr>`).join('');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>DonHang_${order.id}</title>
      <style>
        body{font-family:'Times New Roman',serif;margin:28px;color:#000;font-size:13px}
        h2{text-align:center;margin:0 0 4px}
        .sub{text-align:center;margin-bottom:14px;font-size:11px}
        table{width:100%;border-collapse:collapse;margin-top:10px}
        th,td{border:1px solid #000;padding:5px 7px;font-size:12px}
        th{background:#f0f0f0}
        .info{margin:10px 0}
        .total{text-align:right;font-weight:bold;margin-top:10px;font-size:14px}
      </style></head><body>
      <h2>ĐƠN HÀNG MUA HÀNG</h2>
      <div class="sub">Mã đơn: ${order.id}</div>
      <div class="info">
        <div><strong>Nhà cung cấp:</strong> ${order.supplierName || ''}</div>
        <div><strong>Điện thoại:</strong> ${order.supplierPhone || ''} &nbsp; <strong>Địa chỉ:</strong> ${order.supplierAddress || ''}</div>
        <div><strong>Ngày tạo:</strong> ${formatVietnameseDateTime(order.createdAt)}</div>
        <div><strong>Ghi chú:</strong> ${order.notes || ''}</div>
      </div>
      <table>
        <thead><tr><th>STT</th><th>Tên sản phẩm</th><th>SL</th><th>ĐVT</th><th>Quy cách</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="total">TỔNG CỘNG: ${(order.tongTien || 0).toLocaleString('vi-VN')} đ</div>
      <div style="margin-top:40px;display:flex;justify-content:space-between"><span>Người lập</span><span>Người duyệt</span></div>
      <script>setTimeout(function(){window.print();},300);</script>
      </body></html>`);
    w.document.close();
  };

  const shareOrder = async (order: any) => {
    const text = buildOrderShareText(order);
    const url = `${window.location.origin}/?po=${encodeURIComponent(order.id)}`;
    const shareData: any = { title: `Đơn hàng ${order.id}`, text: `${text}\n${url}`, url };
    const nav: any = navigator;
    if (nav && nav.share) {
      try { await nav.share(shareData); return; } catch (e) { /* người dùng huỷ */ }
    }
    setOrderShareModal({ open: true, order: { ...order, _shareText: text, _shareUrl: url } });
  };

  const removeQuote = async (prop: any, quoteId: string) => {
    await saveProposal({ ...prop, quotes: (prop.quotes || []).filter(q => q.id !== quoteId) });
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
    const quote = (prop.quotes || []).find(q => q.id === chosenQuoteId);
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
      showNotification('Chưa gán nhà cung cấp cho sản phẩm nào.', 'Thiếu NCC', 'warning');
      return;
    }
    if ((prop.purchaseOrderIds || []).length > 0) {
      showNotification('Đề xuất này đã có đơn hàng, không thể tạo thêm.', 'Đã có đơn hàng', 'warning');
      return;
    }
    const enrichedItems = items.map((it: any) => {
      const sid = it.supplierId || itemSupplierDraft[it.id] || '';
      const sup = suppliers.find((s: any) => s.id === sid);
      return { ...it, supplierId: sid, supplierName: sup?.name || it.supplierName || '' };
    });
    // Mỗi sản phẩm thuộc đúng 1 đơn (gom theo nhà cung cấp) → tối đa 1 đơn / sản phẩm
    const groups: Record<string, any[]> = {};
    enrichedItems.forEach((it: any) => { if (it.supplierId) { (groups[it.supplierId] = groups[it.supplierId] || []).push(it); } });
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
    await saveProposal({ ...prop, items: enrichedItems, purchaseOrderIds: [...(prop.purchaseOrderIds || []), ...createdIds] });
    setItemSupplierDraft({});
    loadOrders();
    const proposer = prop.createdByName || currentUser?.name || '—';
    const coordinator = currentUser?.name || '—';
    await sendProjectChat(prop, `🛒 ĐÃ TẠO ${createdIds.length} ĐƠN HÀNG CHO ĐỀ XUẤT ${prop.code}\nDự án: ${prop.projectName}\nNgười đề xuất: ${proposer}\nNgười điều phối: ${coordinator}\n→ Chờ Đặt hàng.`);
    showNotification(`Đã tạo ${createdIds.length} đơn hàng mua (${createdIds.join(', ')}).`, 'Tạo đơn hàng', 'success');
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

  const receiveGoods = async (prop: any) => {
    const items = prop.items || [];
    const groups: Record<string, { name: string; total: number }> = {};
    items.forEach((it: any) => {
      if (it.supplierId) {
        groups[it.supplierId] = groups[it.supplierId] || { name: it.supplierName || '', total: 0 };
        groups[it.supplierId].total += (it.qty || 0) * (it.price || 0);
      }
    });
    const sups: any[] = await dbService.suppliers.list();
    const liabs: any[] = await dbService.accountingLiabilities.list().catch(() => []);
    let debtTotal = 0;
    for (const [sid, g] of Object.entries(groups)) {
      const sup = sups.find(s => s.id === sid);
      if (sup && g.total > 0) {
        sup.debt = (sup.debt || 0) + g.total;
        await dbService.suppliers.save(sup).catch(() => {});
        debtTotal += g.total;
        const existing = liabs.find(l => l.category === 'Nhà Cung Cấp' && l.name === sup.name);
        if (existing) {
          const newValue = (existing.value || 0) + g.total;
          await dbService.accountingLiabilities.save({
            ...existing,
            value: newValue,
            remaining: newValue - (existing.paid || 0),
          }).catch(() => {});
        } else {
          await dbService.accountingLiabilities.save({
            id: crypto.randomUUID(),
            name: sup.name,
            category: 'Nhà Cung Cấp',
            value: g.total,
            paid: 0,
            remaining: g.total,
            notes: `Công nợ vật tư — Đề xuất ${prop.code}`,
          }).catch(() => {});
        }
      }
    }
    window.dispatchEvent(new CustomEvent('hl-accounting-liabilities-updated'));
    // Cập nhật công nợ trên các đơn hàng liên quan
    const orders = await dbService.purchaseOrders.list();
    for (const oid of (prop.purchaseOrderIds || [])) {
      const o = orders.find((ord: any) => ord.id === oid);
      if (o) {
        const tong = o.tongTien || 0;
        const paid = o.thanhToanThucTe || 0;
        await dbService.purchaseOrders.save({ ...o, congNo: tong - paid }).catch(() => {});
      }
    }
    if (debtTotal > 0) window.dispatchEvent(new CustomEvent('hl-suppliers-updated'));
    await saveProposal({ ...prop, status: 'received', debtRecorded: true });
    await sendProjectChat(prop, `📦 ĐỀ XUẤT VẬT TƯ ${prop.code} ĐÃ NHẬN HÀNG\nDự án: ${prop.projectName}\nNgười điều phối: ${currentUser?.name || '—'}\nĐã ghi nhận công nợ nhà cung cấp.`);
    showNotification(`Đã nhận hàng và chuyển sang ĐÃ NHẬN HÀNG.${debtTotal > 0 ? ` Công nợ NCC tăng +${debtTotal.toLocaleString('vi-VN')} đ.` : ''}`, 'Nhận hàng', 'success');
    setSelectedDocKey(null);
    setIsEditing(false);
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
              <h1 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">
                Điều Phối Cung Ứng Vật Tư
              </h1>
            </div>
            <p className="text-[11px] text-slate-500">Quy trình: TÌM NCC → CHỜ DUYỆT → CHỜ ĐẶT HÀNG → ĐẶT HÀNG THÀNH CÔNG → ĐÃ NHẬN HÀNG (đề xuất HỦY vào Thùng rác — tự xóa sau 30 ngày)</p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="text-[10.5px] font-mono bg-white border border-slate-200 rounded-lg p-2.5 text-slate-600 flex flex-col items-end">
              <span>Tổng đề xuất: <strong className="text-amber-600">{stats.total}</strong></span>
              <span>Tài khoản thao tác: <strong className="text-slate-800">{currentUser?.name || 'Hệ thống'}</strong></span>
            </div>
          </div>
        </div>

        {/* FILTERS */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo mã dự án, tên công trình, vật tư..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setColPage({}); }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-slate-400 focus:bg-white transition-all font-sans"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Trạng thái:</span>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setColPage({}); }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 outline-none cursor-pointer focus:border-slate-400 font-sans"
            >
              <option value="all">Tất cả trạng thái</option>
              {(Object.keys(STATUS_LABEL) as ProposalStatus[]).filter(s => s !== 'cancelled').map(s => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => { setRestoreTargets({}); setTrashPage(1); setTrashOpen(true); }}
              className="relative flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-xl px-3 py-1.5 text-xs font-extrabold transition-all cursor-pointer"
              title="Xem đề xuất đã HỦY"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hủy</span>
              <span className="font-mono font-black text-[10px] bg-white/80 border border-rose-200 rounded-full px-1.5 py-0.5">
                {cancelledProposals.length}
              </span>
            </button>
          </div>
        </div>

        {/* KANBAN BOARD — 5 cột trên 1 hàng */}
        <div className="w-full overflow-x-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 min-w-[1080px]">
            {columns.map(col => {
              const colDocs = filteredDocs.filter(item => resolveStatus(item) === col.id);
              const colSize = getColPageSize(col.id);
              const colTotal = colTotalPages(col.id, colDocs.length);
              const colPageClamped = Math.min(getColPage(col.id), colTotal);
              const pagedDocs = colDocs.slice((colPageClamped - 1) * colSize, colPageClamped * colSize);
              return (
                <div key={col.id} className={`flex flex-col h-[680px] rounded-3xl bg-white/50 border ${col.borderColor} overflow-hidden shadow-2xl relative transition-all duration-300 hover:shadow-xl hover:shadow-slate-100`}>
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
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex justify-end z-50 animate-fade-in" onClick={() => { setSelectedDocKey(null); setIsEditing(false); }}>
          <div className="w-full max-w-[1536px] bg-white border-l border-slate-200 h-full flex flex-col text-xs text-slate-800 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Drawer Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 shrink-0 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-teal-500 rounded-lg flex items-center justify-center shadow-md shrink-0">
                  <Boxes className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-extrabold text-[10px] text-teal-600 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                      {activeDetail.doc.code || 'MAT-NEW'}
                    </span>
                    <span className={`font-bold text-[9.5px] uppercase tracking-wider px-2 py-0.5 rounded ${
                      resolveStatus(activeDetail) === 'cancelled' ? 'bg-rose-100 text-rose-700 border border-rose-200'
                      : resolveStatus(activeDetail) === 'received' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : 'bg-teal-100 text-teal-700 border border-teal-200'
                    }`}>
                      {STATUS_LABEL[resolveStatus(activeDetail)]}
                    </span>
                  </div>
                  <h4 className="font-black text-slate-900 text-base mt-0.5">{activeDetail.project.name}</h4>
                  <div className="text-slate-500 text-[10px]">
                    {activeDetail.kind === 'proposal'
                      ? `Người tạo: ${activeDetail.doc.createdByName || ''} · ${formatVietnameseDateTime(activeDetail.doc.createdAt)}`
                      : `Đề xuất cũ (luồng cũ) · ${formatVietnameseDateTime(activeDetail.doc.createdAt)}`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => { setSelectedDocKey(null); setIsEditing(false); }}
                  className="p-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-lg border border-slate-300 font-bold flex items-center gap-1 cursor-pointer transition-all"
                >
                  <X className="w-4 h-4" />
                  Đóng
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto flex bg-slate-50" id="drawer_scrollable_body">
              {/* Left pane */}
              <div className="flex-1 p-5 space-y-5 overflow-y-auto h-full border-r border-slate-200" id="drawer_left_pane">
                {/* THÔNG TIN */}
                <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4 shadow-xs">
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

                {/* BẢNG VẬT TƯ */}
                <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-3 shadow-xs">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-1">
                    <span className="font-extrabold text-[11.5px] text-teal-600 flex items-center gap-1.5 uppercase tracking-wide">
                      <Boxes className="w-4 h-4" />
                      Danh mục vật tư đề xuất
                    </span>
                    <span className="text-[10.5px] font-black text-teal-600">Tổng: {proposalTotal(activeDetail.doc).toLocaleString('vi-VN')} đ</span>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl bg-slate-50/50">
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
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {getDocItems(activeDetail.doc).length === 0 ? (
                          <tr><td colSpan={8} className="p-8 text-center text-slate-600 font-medium">Chưa có vật tư nào trong đề xuất này.</td></tr>
                        ) : (
                          getDocItems(activeDetail.doc).map((m: any, idx: number) => {
                            const price = m.price || 0;
                            const total = (m.qty || 0) * price;
                            return (
                              <tr key={m.id || idx} className="hover:bg-slate-50/40">
                                <td className="p-2.5 text-center font-mono font-bold text-slate-600">{idx + 1}</td>
                                <td className="p-2.5 font-semibold text-slate-800">
                                  {m.name}
                                  {m.maSanPham && (
                                    <span className="ml-1.5 text-[8.5px] text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1 py-0.5 font-bold">Mã: {m.maSanPham}</span>
                                  )}
                                </td>
                                <td className="p-2.5 text-center font-bold text-teal-600 font-mono">{m.qty}</td>
                                <td className="p-2.5 text-center text-slate-600 font-medium">{m.unit}</td>
                                <td className="p-2.5 text-slate-500 italic">{m.spec || '—'}</td>
                                <td className="p-2.5 font-bold">{m.supplierName || '—'}</td>
                                <td className="p-2.5 text-right font-mono text-slate-600">{price.toLocaleString('vi-VN')} đ</td>
                                <td className="p-2.5 text-right font-mono font-black text-teal-600">{total.toLocaleString('vi-VN')} đ</td>
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
                    <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-3 shadow-xs">
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
                    <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-3 shadow-xs">
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
                  return (
                    <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4 shadow-xs">
                      <span className="font-extrabold text-[11.5px] text-violet-600 flex items-center gap-1.5 uppercase tracking-wide border-b border-slate-100 pb-2">
                        <Layers className="w-4 h-4" /> Gán nhà cung cấp & Tạo đơn hàng
                      </span>
                      <div className="space-y-2">
                        {(prop.items || []).map((it: any, idx: number) => {
                          const currentSid = it.supplierId || itemSupplierDraft[it.id] || '';
                          return (
                            <div key={it.id || idx} className="border border-slate-200 rounded-xl p-2.5 bg-violet-50/30">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex-1 min-w-[150px]">
                                  <span className="text-[11px] font-bold text-slate-800">{it.name}</span>
                                  <span className="ml-1.5 text-[9px] text-slate-500">× {it.qty} {it.unit} · {((it.qty || 0) * (it.price || 0)).toLocaleString('vi-VN')} đ</span>
                                </div>
                                <select
                                  value={currentSid}
                                  onChange={(e) => setItemSupplier(prop, it.id, e.target.value)}
                                  disabled={!isCoordinator || hasOrder}
                                  className="bg-white border border-slate-300 rounded p-1 text-[10.5px] text-slate-800 outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                                >
                                  <option value="">-- Chọn NCC --</option>
                                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                              </div>
                              {currentSid && (
                                <p className="text-[9px] text-violet-600 font-bold mt-1">✔ Đã chọn: {suppliers.find(s => s.id === currentSid)?.name || ''}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {hasOrder ? (
                        <p className="text-[10px] text-slate-500 italic bg-slate-50 border border-slate-200 rounded-lg p-2.5">Đã tạo đơn hàng cho đề xuất này. Các trường đã bị khóa.</p>
                      ) : isCoordinator ? (
                        <button
                          type="button"
                          onClick={() => createOrders(prop)}
                          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-[12px] font-black py-2.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                        >
                          <FileText className="w-4 h-4" /> Tạo đơn hàng
                        </button>
                      ) : (
                        <p className="text-[10px] text-slate-500 italic">Chỉ Người điều phối mới được gán NCC &amp; tạo đơn hàng.</p>
                      )}
                    </div>
                  );
                })()}

                {/* ── ĐƠN HÀNG ĐÃ TẠO (Sửa / Xóa / In / Chia sẻ) ── */}
                {activeDetail.kind === 'proposal' && (() => {
                  const prop = activeDetail.doc;
                  const relatedOrders = purchaseOrders.filter(o => (prop.purchaseOrderIds || []).includes(o.id));
                  if (relatedOrders.length === 0) return null;
                  return (
                    <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-3 shadow-xs">
                      <span className="font-extrabold text-[11.5px] text-teal-600 flex items-center gap-1.5 uppercase tracking-wide border-b border-slate-100 pb-2">
                        <FileText className="w-4 h-4" /> Đơn hàng đã tạo ({relatedOrders.length})
                      </span>
                      <div className="space-y-2.5">
                        {relatedOrders.map(o => (
                          <div key={o.id} className="border border-slate-200 rounded-xl p-3 bg-teal-50/30">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <span className="font-mono font-black text-[11px] text-teal-700">{o.id}</span>
                                <span className="ml-1.5 text-[10px] text-slate-600">· {o.supplierName}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-black text-[11px] text-slate-800">{(o.tongTien || 0).toLocaleString('vi-VN')} đ</span>
                                <button
                                  type="button"
                                  onClick={() => setOrderDetailModal({ open: true, order: o })}
                                  className="bg-teal-600 hover:bg-teal-500 text-white text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                                >
                                  <Eye className="w-3 h-3" /> Xem chi tiết
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

              </div>

              {/* Right tools pane */}
              <div className="w-[280px] shrink-0 p-5 bg-slate-50 border-l border-slate-200 space-y-4 h-full overflow-y-auto" id="drawer_right_pane">
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
                      return (
                        <div className="space-y-3 pt-1">
                          <span className="font-extrabold text-[11px] text-teal-700 uppercase tracking-wide flex items-center gap-1.5">
                            <PackageCheck className="w-4 h-4" /> ĐẶT HÀNG THÀNH CÔNG
                          </span>
                          <p className="text-[11px] text-slate-600 bg-teal-50 border border-teal-200 rounded-xl p-3">
                            Đơn hàng đã được đặt. Nhấn <strong>Nhận hàng</strong> khi hàng về để ghi nhận công nợ nhà cung cấp và hoàn tất quy trình. Dùng <strong>Đổi NCC</strong> nếu cần quay lại chọn nhà cung cấp.
                          </p>
                          
                          {isCoordinator && (
                            <div className="flex flex-col gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => receiveGoods(prop)}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black py-2.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all"
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
                            <p className="text-[10px] text-emerald-600 mt-1">Công nợ nhà cung cấp đã được ghi nhận vào tab Công nợ Trả.</p>
                          </div>
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

                  {/* Legacy doc actions */}
                  {activeDetail.kind === 'legacy' && (
                    <div className="space-y-2 pt-1">
                      <p className="text-[10.5px] text-slate-500 italic">Đề xuất từ luồng cũ (ProjectDoc).</p>
                      {resolveStatus(activeDetail) === 'waiting_order' && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleLegacyStatus(activeDetail.doc, activeDetail.project, 'active')}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black py-2 rounded-lg cursor-pointer transition-all"
                          >
                            Xuất Kho
                          </button>
                          <button
                            type="button"
                            onClick={() => handleLegacyDeleteDoc(activeDetail.doc, activeDetail.project)}
                            className="bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black px-4 py-2 rounded-lg cursor-pointer transition-all"
                          >
                            Xóa
                          </button>
                        </div>
                      )}
                      {resolveStatus(activeDetail) === 'ordered' && (
                        <button
                          type="button"
                          onClick={() => handleLegacyStatus(activeDetail.doc, activeDetail.project, 'approved')}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black py-2 rounded-lg cursor-pointer transition-all"
                        >
                          Đã Nhận Hàng
                        </button>
                      )}
                    </div>
                  )}

                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl">
                  <p className="text-[10px] text-indigo-700 leading-relaxed font-medium">
                    💡 <strong>Quy trình:</strong> Sản phẩm có mã Danh mục MUA đi thẳng vào <strong>CHỜ ĐẶT HÀNG</strong>; sản phẩm chưa có mã vào <strong>TÌM NHÀ CUNG CẤP</strong>.
                  </p>
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
      <div className="fixed inset-0 z-[9600] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in" onClick={() => { setOrderEditModal({ open: false, order: null }); setOrderEditDraft(null); }}>
        <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <span className="font-black text-sm text-slate-900 uppercase">Sửa đơn hàng {orderEditDraft.id}</span>
            </div>
            <button type="button" onClick={() => { setOrderEditModal({ open: false, order: null }); setOrderEditDraft(null); }} className="p-1.5 hover:bg-slate-200 rounded-full text-slate-600 cursor-pointer transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
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
                <div key={it.id || idx} className="flex items-center gap-2 p-2.5">
                  <span className="flex-1 text-[11px] font-semibold text-slate-700">{it.name}</span>
                  <input type="number" value={it.qty || 0} onChange={(e) => setOrderEditDraft((p: any) => ({ ...p, items: p.items.map((x: any, i: number) => i === idx ? { ...x, qty: Number(e.target.value) } : x) }))} className="w-16 bg-white border border-slate-300 rounded-lg p-1.5 text-xs text-right text-slate-800 outline-none" />
                  <span className="text-[10px] text-slate-400">{it.unit}</span>
                  <input type="number" value={it.price || 0} onChange={(e) => setOrderEditDraft((p: any) => ({ ...p, items: p.items.map((x: any, i: number) => i === idx ? { ...x, price: Number(e.target.value) } : x) }))} className="w-24 bg-white border border-slate-300 rounded-lg p-1.5 text-xs text-right text-slate-800 outline-none" />
                  <span className="text-[10px] font-mono font-bold text-teal-600 w-24 text-right">{((it.qty || 0) * (it.price || 0)).toLocaleString('vi-VN')} đ</span>
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

    {/* ORDER SHARE MODAL */}
    {orderShareModal.open && orderShareModal.order && (() => {
      const sh: any = orderShareModal.order;
      const text = sh._shareText || '';
      const url = sh._shareUrl || window.location.href;
      const copy = async () => {
        try { await navigator.clipboard.writeText(`${text}\n${url}`); showNotification('Đã sao chép nội dung chia sẻ.', 'Sao chép', 'success'); }
        catch (e) { showNotification('Không thể sao chép nội dung.', 'Lỗi', 'warning'); }
      };
      return (
        <div className="fixed inset-0 z-[9600] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in" onClick={() => setOrderShareModal({ open: false, order: null })}>
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-violet-600" />
                <span className="font-black text-sm text-slate-900 uppercase">Chia sẻ đơn hàng {sh.id}</span>
              </div>
              <button type="button" onClick={() => setOrderShareModal({ open: false, order: null })} className="p-1.5 hover:bg-slate-200 rounded-full text-slate-600 cursor-pointer transition-all"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-[11px] text-slate-600 whitespace-pre-line bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-40 overflow-y-auto">{text}</p>
              <div className="grid grid-cols-1 gap-2">
                <button type="button" onClick={copy} className="w-full bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-black py-2.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all"><Copy className="w-4 h-4" /> Sao chép nội dung</button>
                <a href="https://zalo.me/" target="_blank" rel="noopener noreferrer" onClick={copy} className="w-full bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-black py-2.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all"><Share2 className="w-4 h-4" /> Mở Zalo &amp; dán</a>
                <a href={`mailto:?subject=${encodeURIComponent('Đơn hàng ' + sh.id)}&body=${encodeURIComponent(text + '\n' + url)}`} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black py-2.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all"><Send className="w-4 h-4" /> Gửi Email</a>
              </div>
            </div>
          </div>
        </div>
      );
    })()}

    {/* ORDER DETAIL MODAL */}
    {orderDetailModal.open && orderDetailModal.order && (() => {
      const od: any = orderDetailModal.order;
      const odItems: any[] = od.items || [];
      const odTotal = od.tongTien || odItems.reduce((s: number, it: any) => s + (it.qty || 0) * (it.price || 0), 0);
      return (
        <div className="fixed inset-0 z-[9700] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in" onClick={() => setOrderDetailModal({ open: false, order: null })}>
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-600" />
                <span className="font-black text-sm text-slate-900 uppercase">Chi tiết đơn hàng {od.id}</span>
              </div>
              <button type="button" onClick={() => setOrderDetailModal({ open: false, order: null })} className="p-1.5 hover:bg-slate-200 rounded-full text-slate-600 cursor-pointer transition-all"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-slate-500 font-bold text-[10px] uppercase">Nhà cung cấp</label>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800">{od.supplierName || '—'}</div>
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-500 font-bold text-[10px] uppercase">Tổng tiền</label>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-black text-teal-700">{odTotal.toLocaleString('vi-VN')} đ</div>
                </div>
              </div>
              {od.notes ? (
                <div className="space-y-1">
                  <label className="block text-slate-500 font-bold text-[10px] uppercase">Ghi chú</label>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-700 whitespace-pre-line">{od.notes}</div>
                </div>
              ) : null}
              <div className="space-y-1">
                <label className="block text-slate-500 font-bold text-[10px] uppercase">Danh mục vật tư</label>
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                  {odItems.length === 0 ? (
                    <div className="p-4 text-center text-[11px] text-slate-500">Đơn hàng chưa có vật tư.</div>
                  ) : odItems.map((it: any, idx: number) => (
                    <div key={it.id || idx} className="flex items-center justify-between gap-2 p-2.5">
                      <div className="flex-1">
                        <span className="text-[11px] font-semibold text-slate-700">{it.name}</span>
                        <span className="ml-1.5 text-[9px] text-slate-400">{it.qty} {it.unit}</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-teal-600">{((it.qty || 0) * (it.price || 0)).toLocaleString('vi-VN')} đ</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-2">
              {isCoordinator && !(activeDetail?.kind === 'proposal' && (activeDetail.doc.status === 'ordered' || activeDetail.doc.status === 'received')) && (
                <button type="button" onClick={() => { setOrderDetailModal({ open: false, order: null }); openOrderEdit(od); }} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold py-2.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all"><Pencil className="w-3.5 h-3.5" /> Sửa</button>
              )}
              {isCoordinator && !(activeDetail?.kind === 'proposal' && activeDetail.doc.status === 'received') && (
                <button type="button" onClick={() => { setOrderDetailModal({ open: false, order: null }); deleteOrder(od); }} className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-600 text-[11px] font-bold py-2.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all"><Trash2 className="w-3.5 h-3.5" /> Xóa</button>
              )}
              <button type="button" onClick={() => printOrder(od)} className="flex-1 bg-sky-50 hover:bg-sky-100 text-sky-700 text-[11px] font-bold py-2.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all"><Printer className="w-3.5 h-3.5" /> In</button>
              <button type="button" onClick={() => { setOrderDetailModal({ open: false, order: null }); shareOrder(od); }} className="flex-1 bg-violet-50 hover:bg-violet-100 text-violet-700 text-[11px] font-bold py-2.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all"><Share2 className="w-3.5 h-3.5" /> Chia sẻ</button>
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
                  {names.map((n: string, i: number) => (
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
                          <select
                            value={sid}
                            onChange={(e) => setQuoteItemSuppliers((prev: Record<string, string>) => ({ ...prev, [it.id]: e.target.value }))}
                            className="flex-1 bg-white border border-slate-300 rounded-lg p-1.5 text-[10.5px] text-slate-800 outline-none focus:border-teal-500"
                          >
                            <option value="">-- Chọn NCC --</option>
                            {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
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
