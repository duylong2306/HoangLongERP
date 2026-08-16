import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { dbService } from '../lib/dbService';
import { sendApprovalDirectMessage, findEmployeeByName, ensureProjectChatGroup, sendGroupChatMessage } from '../lib/chatStore';
import { Receipt, Payment, Project, Customer, Employee, SupplierPartner, SubcontractorAdvanceProposal, Supplier, InventoryItem, ArchivedQuote, Liability, AccountingProductItem, SalesOrder, SalesOrderItem, PurchaseOrder, PurchaseOrderItem } from '../types';
import { useNotification, isUserInRoleGroup, loadHrmRoleGroups, getConfiguredApprover } from '../context';
import * as XLSX from 'xlsx';
import { exportToExcel, importFromExcel, formatDateForFile, EXCEL_HEADERS } from '../lib/excelUtils';

import SearchableCustomerSelect from './SearchableCustomerSelect';
import SearchableSupplierSelect from './SearchableSupplierSelect';
import ProductSearchDropdown from './ProductSearchDropdown';
import SubcontractorDirectory from './SubcontractorDirectory';
import WarehouseSuppliers from './WarehouseSuppliers';

import {
  Plus,
  Search,
  DollarSign,
  ShoppingCart,
  Wallet,
  Check,
  X,
  FileCheck,
  ArrowUpRight,
  ArrowDownRight,
  LayoutDashboard,
  Briefcase,
  Users,
  Handshake,
  FileSignature,
  Package,
  Heart,
  Circle,
  TrendingUp,
  TrendingDown,
  Printer,
  Calendar,
  Layers,
  MapPin,
  Building,
  Info,
  CheckCircle2,
  Lock,
  Phone,
  Trash2,
  Eye,
  Database,
  Edit,
  Download,
  FileUp,
  DollarSign as MoneyIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';


const getAbbreviation = (name: string): string => {
  if (!name) return '';
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
  const words = normalized.trim().split(/\s+/).filter(Boolean);
  const initials = words.map(w => w[0].toUpperCase()).join('');
  return initials;
};

/**
 * Sinh mã đơn dạng <prefix>-YYYYMMDD-XXXX chống trùng.
 *
 * Trước đây hàm này đếm số đơn trong ngày (`length + 1`) — sai 2 trường hợp:
 *  1. Danh sách chưa load xong / load lỗi → đếm 0 → mã trùng → upsert GHI ĐÈ
 *     hàng cũ thay vì thêm hàng mới.
 *  2. Đã xóa đơn giữa ngày → số đếm tụt xuống → trùng mã đơn còn lại.
 * Nay lấy số thứ tự LỚN NHẤT đang tồn tại rồi +1, nên không bao giờ lùi lại.
 */
const generateOrderCode = (prefix: string, existingIds: string[]): string => {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const head = `${prefix}-${datePart}-`;
  const maxSeq = existingIds.reduce((max, id) => {
    if (!id || !id.startsWith(head)) return max;
    const seq = parseInt(id.slice(head.length), 10);
    return Number.isFinite(seq) && seq > max ? seq : max;
  }, 0);
  return `${head}${String(maxSeq + 1).padStart(4, '0')}`;
};

interface FinanceProps {
  receipts: Receipt[];
  payments: Payment[];
  projects: Project[];
  customers: Customer[];
  currentUser: any;
  employees?: Employee[];
  salesOrders?: SalesOrder[];
  onAddReceipt: (newRec: Receipt) => void;
  onAddPayment: (newPay: Payment) => void;
  onApprovePayment: (id: string, status: 'approved' | 'rejected') => void;
  onAddCustomer?: (newCust: Customer) => void;
  onDeleteCustomer?: (id: string) => void;
  onDeleteReceipt?: (id: string) => void;
  onDeletePayment?: (id: string) => void;
  onDeleteMaterial?: (id: string) => void;
  /** Trả về đơn đã lưu — id có thể khác nếu mã bị trùng và được cấp lại. */
  onAddSalesOrder?: (order: SalesOrder) => Promise<SalesOrder | null> | void;
  onDeleteSalesOrder?: (id: string) => void;
  purchaseOrders?: PurchaseOrder[];
  suppliers?: SupplierPartner[];
  /** Trả về đơn đã lưu — id có thể khác nếu mã bị trùng và được cấp lại. */
  onAddPurchaseOrder?: (order: PurchaseOrder) => Promise<PurchaseOrder | null> | void;
  onDeletePurchaseOrder?: (id: string) => void;
  initialSubTab?: string;
  initialDuLieuTab?: string;
  /** Mã đề xuất thu chi cần tự động mở form lập phiếu khi vào module Tài Chính (deep link từ Công việc). */
  initialProposalId?: string | null;
  /** Gọi lại sau khi đã mở form lập phiếu cho initialProposalId, để App reset state deep link. */
  onInitialProposalConsumed?: () => void;
}

// Subcontractor Contract interface for accounting
interface SubContract {
  id: string;
  code: string;
  projectId: string;
  subcontractorId: string;
  scope: string;
  value: number;
  signedDate: string;
  status: 'active' | 'completed' | 'draft';
}

// Material Stock interface
interface MaterialStock {
  id: string;
  code: string;
  name: string;
  unit: string;
  qty: number;
  unitPrice: number;
  minAlert: number;
  location: string;
}

// Định mức tính tiền công tác phí (Travel Allowance Norm)
interface TravelAllowanceNorm {
  id: string;
  code: string; // MÃ CTP
  content: string; // Nội dung
  quantity: number; // Số lượng
  unitPrice: number; // Đơn giá
  notes: string; // Ghi chú
}

export default function FinanceManagement({
  receipts,
  payments,
  projects,
  customers,
  currentUser,
  employees: employeesProp,
  salesOrders: salesOrdersProp = [],
  onAddReceipt,
  onAddPayment,
  onApprovePayment,
  onAddCustomer,
  onDeleteCustomer,
  onDeleteReceipt,
  onDeletePayment,
  onDeleteMaterial,
  onAddSalesOrder,
  onDeleteSalesOrder,
  purchaseOrders: purchaseOrdersProp = [],
  suppliers: suppliersExternalProp,
  onAddPurchaseOrder,
  onDeletePurchaseOrder,
  initialSubTab,
  initialDuLieuTab,
  initialProposalId,
  onInitialProposalConsumed
}: FinanceProps) {
  const { addToast } = useNotification();
  // ── Multi-row selection ──
  const [finSelectedRows, setFinSelectedRows] = useState<Set<string>>(new Set());
  const [finSelectAll, setFinSelectAll] = useState(false);
  // Separate selection state for duLieuTab subtabs
  const [custSelectedRows, setCustSelectedRows] = useState<Set<string>>(new Set());
  const [matSelectedRows, setMatSelectedRows] = useState<Set<string>>(new Set());
  // Selection state for receipts (nhap_thu) and payments (nhap_chi)
  const [recSelectedRows, setRecSelectedRows] = useState<Set<string>>(new Set());
  const [paySelectedRows, setPaySelectedRows] = useState<Set<string>>(new Set());
  const handleFinSelectAll = (checked: boolean, items: { id: string }[]) => {
    if (checked) setFinSelectedRows(new Set(items.map(i => i.id)));
    else setFinSelectedRows(new Set());
    setFinSelectAll(checked);
  };
  const handleFinRowSelect = (id: string, checked: boolean) => {
    setFinSelectedRows(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const handleCustSelectAll = (checked: boolean, items: { id: string }[]) => {
    if (checked) setCustSelectedRows(new Set(items.map(i => i.id)));
    else setCustSelectedRows(new Set());
  };
  const handleCustRowSelect = (id: string, checked: boolean) => {
    setCustSelectedRows(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const handleMatSelectAll = (checked: boolean, items: { id: string }[]) => {
    if (checked) setMatSelectedRows(new Set(items.map(i => i.id)));
    else setMatSelectedRows(new Set());
  };
  const handleMatRowSelect = (id: string, checked: boolean) => {
    setMatSelectedRows(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const handleRecSelectAll = (checked: boolean, items: { id: string }[]) => {
    if (checked) setRecSelectedRows(new Set(items.map(i => i.id)));
    else setRecSelectedRows(new Set());
  };
  const handleRecRowSelect = (id: string, checked: boolean) => {
    setRecSelectedRows(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const handlePaySelectAll = (checked: boolean, items: { id: string }[]) => {
    if (checked) setPaySelectedRows(new Set(items.map(i => i.id)));
    else setPaySelectedRows(new Set());
  };
  const handlePayRowSelect = (id: string, checked: boolean) => {
    setPaySelectedRows(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  // Cấu hình Phân quyền người dùng dựa trên nhóm vai trò từ HRM
  const getPermission = (moduleKey: string, actionKey: 'view' | 'create' | 'edit' | 'delete'): boolean => {
    // Đọc từ in-memory cache (đã load từ Supabase)
    let rolesList: any[] = loadHrmRoleGroups();
    if (rolesList.length === 0) return true; // Mặc định có quyền nếu chưa cấu hình
    try {
      
      // Khớp mã NV (emp_1 -> NV001, etc.)
      const nvId = currentUser?.id?.replace('emp_', 'NV').replace('NV', () => {
        const num = currentUser.id.split('_')[1];
        if (!num) return 'NV';
        return 'NV' + num.padStart(3, '0');
      });

      // Tìm nhóm vai trò chứa nhân sự này
      const role = rolesList.find((r: any) => 
        r.memberIds?.includes(currentUser?.id) || 
        r.memberIds?.includes(nvId)
      );

      if (role) {
        const modulePerms = role.permissions[moduleKey];
        if (modulePerms) {
          return !!modulePerms[actionKey];
        }
      } else {
        // Fallback theo vai trò mặc định dựa trên Role Group
        let defaultRoleId = 'role_office';
        if (currentUser && isUserInRoleGroup(currentUser.id, 'role_admin')) defaultRoleId = 'role_admin';
        else if (currentUser && isUserInRoleGroup(currentUser.id, 'role_accounting')) defaultRoleId = 'role_accounting';
        else if (currentUser?.role === 'director') defaultRoleId = 'role_admin';
        else if (currentUser?.role === 'accountant') defaultRoleId = 'role_accounting';

        const defRole = rolesList.find((r: any) => r.id === defaultRoleId);
        if (defRole && defRole.permissions[moduleKey]) {
          return !!defRole.permissions[moduleKey][actionKey];
        }
      }
    } catch (e) {
      console.error(e);
    }
    return true;
  };

  const canView = getPermission('finance', 'view');
  const canCreate = getPermission('finance', 'create');
  const canEdit = getPermission('finance', 'edit');
  const canDelete = getPermission('finance', 'delete');

  // Current active child segment among 12 tabs
  const [activeSubTab, setActiveSubTab] = useState<string>(
    initialSubTab === 'hd_thau_phu' ? 'nhap_thu' : (initialSubTab || 'du_lieu_ke_toan')
  );

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab === 'hd_thau_phu' ? 'nhap_thu' : initialSubTab);
    }
  }, [initialSubTab]);

  useEffect(() => {
    if (initialDuLieuTab) {
      setDuLieuTab(initialDuLieuTab as any);
    }
  }, [initialDuLieuTab]);

  const [menuDisplayMode, setMenuDisplayMode] = useState<'sidebar' | 'tabs'>('tabs');

  const toggleMenuDisplayMode = (mode: 'sidebar' | 'tabs') => {
    setMenuDisplayMode('tabs');
    localStorage.setItem('hl_fin_menu_mode', 'tabs');
  };

  // States cho Quản lý khách hàng chi tiết & thêm mới
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [selectedCustDetail, setSelectedCustDetail] = useState<Customer | null>(null);

  // Form Inputs - Khách hàng mới
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custType, setCustType] = useState<'individual' | 'organization'>('individual');
  const [custRep, setCustRep] = useState('');
  const [custTaxId, setCustTaxId] = useState('');
  const [custNotes, setCustNotes] = useState('');
  const [custOpeningDebt, setCustOpeningDebt] = useState<number>(0);
  const [isCustRepManuallyEdited, setIsCustRepManuallyEdited] = useState(false);
  const [editingCustId, setEditingCustId] = useState<string | null>(null);
  const [customerTypeFilter, setCustomerTypeFilter] = useState<'all' | 'individual' | 'organization'>('all');

  // Search filters
  const [searchTerm, setSearchTerm] = useState('');
  const [projectFilter, setProjectFilter] = useState('');

  // Local persistent states for accounting-specific lists
  const [subContracts, setSubContracts] = useState<SubContract[]>([]);

  // Approved Subcontractor Contracts loaded from Firestore database
  const [approvedSubContracts, setApprovedSubContracts] = useState<ArchivedQuote[]>([]);

  // Load approved subcontractor contracts from Firebase
  useEffect(() => {
    const loadApprovedSubs = async () => {
      try {
        const list = await dbService.archivedQuotes.list('subcontractor');
        setApprovedSubContracts(list.filter((q: any) => q.isApproved === true));
      } catch (error) {
        console.error("Lỗi khi tải hợp đồng thầu phụ đã duyệt:", error);
      }
    };
    loadApprovedSubs();
    window.addEventListener('hl-archived-subcontractor-quotes-updated', loadApprovedSubs);
    return () => {
      window.removeEventListener('hl-archived-subcontractor-quotes-updated', loadApprovedSubs);
    };
  }, []);

  // Subcontractor Advance Proposals (Đề Xuất Thu Chi) states and load effect
  const [subcontractorAdvances, setSubcontractorAdvances] = useState<SubcontractorAdvanceProposal[]>([]);
  const [activeProposalForPayment, setActiveProposalForPayment] = useState<SubcontractorAdvanceProposal | null>(null);
  const [rejectProposalModal, setRejectProposalModal] = useState<SubcontractorAdvanceProposal | null>(null);
  const [revertProposalModal, setRevertProposalModal] = useState<SubcontractorAdvanceProposal | null>(null);
  const [editingAmountProposal, setEditingAmountProposal] = useState<SubcontractorAdvanceProposal | null>(null);
  const [editAmountValue, setEditAmountValue] = useState<string>('');
  const [proposalTypeFilter, setProposalTypeFilter] = useState<'all' | 'subcontractor' | 'expense'>('all');
  const [viewingProposalDetail, setViewingProposalDetail] = useState<SubcontractorAdvanceProposal | null>(null);

  // ── Quick "Tạo Đề Xuất" modal (tạo nhanh đề xuất cho dự án cụ thể) ──
  const [showQuickProposalModal, setShowQuickProposalModal] = useState(false);
  const [quickProposalType, setQuickProposalType] = useState<'subcontractor_advance' | 'project_expense_proposal'>('project_expense_proposal');
  const [quickProposalSubId, setQuickProposalSubId] = useState('');
  const [quickProposalProjId, setQuickProposalProjId] = useState('');
  const [quickProposalAmount, setQuickProposalAmount] = useState<number | string>('');
  const [quickProposalReason, setQuickProposalReason] = useState('');

  useEffect(() => {
    let active = true;
    const fetchAdvances = async () => {
      try {
        const list = await dbService.subcontractorAdvances.list();
        if (active) {
          setSubcontractorAdvances(list);
        }
      } catch (err) {
        console.error("Lỗi khi tải đề xuất tạm ứng thầu phụ:", err);
      }
    };
    fetchAdvances();

    const handleUpdate = () => {
      fetchAdvances();
    };
    window.addEventListener('hl-subcontractor-advances-updated', handleUpdate);
    return () => {
      active = false;
      window.removeEventListener('hl-subcontractor-advances-updated', handleUpdate);
    };
  }, []);

  // Deep link từ Công việc: tự động mở form lập phiếu cho đề xuất có id tương ứng
  // (chỉ mở 1 lần, kể cả khi danh sách đề xuất được làm mới lại).
  const consumedVoucherRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialProposalId) return;
    if (consumedVoucherRef.current === initialProposalId) return;
    const proposal = subcontractorAdvances.find(p => p.id === initialProposalId);
    if (!proposal) return; // chưa tải xong → đợi effect chạy lại khi danh sách cập nhật
    consumedVoucherRef.current = initialProposalId;
    handleCreateVoucherFromProposal(proposal);
    onInitialProposalConsumed?.();
  }, [initialProposalId, subcontractorAdvances]);

  // Helper: Kiểm tra user có quyền duyệt/từ chối đề xuất này không
  const canApproveProposal = useCallback((proposal: SubcontractorAdvanceProposal) => {
    if (!currentUser) return false;

    // 1. Là người được gán duyệt trong đề xuất (so sánh theo ID hoặc tên)
    if (proposal.approver === currentUser.id) return true;
    if (proposal.approverName && proposal.approverName.toLowerCase() === currentUser.name.toLowerCase()) return true;

    // 2. Thuộc nhóm Kế toán (role_accounting)
    if (isUserInRoleGroup(currentUser.id, 'role_accounting')) return true;
    // 3. Là Giám đốc (role_admin) - có quyền duyệt tất cả
    if (isUserInRoleGroup(currentUser.id, 'role_admin')) return true;
    return false;
  }, [currentUser]);

  // Gửi tin nhắn NHÓM CHAT DỰ ÁN cho các hành động Đề Xuất Tạm Ứng thầu phụ
  const notifyAdvanceProjectChat = async (proposal: SubcontractorAdvanceProposal, content: string) => {
    if (!proposal.projectId) return;
    const convId = `conv_project_${proposal.projectId}`;
    try {
      const conv = await ensureProjectChatGroup({ id: proposal.projectId, name: proposal.projectName || '', pmId: undefined });
      if (!conv) return;
      await sendGroupChatMessage({
        conversationId: convId,
        senderId: currentUser?.id || '',
        senderName: currentUser?.name || 'Hệ thống',
        senderRole: currentUser?.role,
        content,
        relatedEntity: { type: 'advance', id: proposal.id },
      });
    } catch (e) { /* bỏ qua nếu không gửi được */ }
  };

  // Handle approver "Duyệt" action -> wait_payment
  const handleApprove = async (proposal: SubcontractorAdvanceProposal) => {
    // Kiểm tra quyền duyệt
    if (!canApproveProposal(proposal)) {
      addToast({ title: '⛔ Không có quyền', message: '❌ Bạn không phải người xét duyệt cho đề xuất này!', type: 'error' });
      return;
    }
    try {
      const updated: SubcontractorAdvanceProposal = {
        ...proposal,
        status: 'pending_payment'
      };
      await dbService.subcontractorAdvances.save(updated);
      setSubcontractorAdvances(prev => prev.map(p => p.id === updated.id ? updated : p));

      window.dispatchEvent(new CustomEvent('hl-subcontractor-advances-updated', { detail: updated }));
      // 📩 Gửi tin nhắn xét duyệt vào HỘI THOẠI CÁ NHÂN (người duyệt → người lập đề xuất)
      const creatorEmp = proposal.creator ? (employeesProp || []).find(e => e.id === proposal.creator) : findEmployeeByName(employeesProp || [], proposal.creatorName);
      if (currentUser?.id && creatorEmp?.id && currentUser.id !== creatorEmp.id) {
        sendApprovalDirectMessage({
          senderId: currentUser.id,
          senderName: currentUser.name,
          senderRole: currentUser.role,
          recipientId: creatorEmp.id,
          recipientName: creatorEmp.name || proposal.creatorName || 'Người lập đề xuất',
          content: `✅ Đã duyệt đề xuất tạm ứng ${proposal.id} (${proposal.taskName || proposal.subcontractorName}) ${proposal.amount.toLocaleString('vi-VN')}đ.`,
          relatedEntity: { type: 'advance', id: proposal.id },
        });
      }
      // Tin nhắn NHÓM CHAT dự án: người xét duyệt đã duyệt đề xuất
      await notifyAdvanceProjectChat(
        proposal,
        `✅ ĐÃ DUYỆT ĐỀ XUẤT TẠM ỨNG THẦU PHỤ\n` +
        `Mã đề xuất: ${proposal.id}\n` +
        `Thầu phụ: ${proposal.subcontractorName}\n` +
        `Công việc: ${proposal.taskName || proposal.projectName || '—'}\n` +
        `Số tiền: ${proposal.amount.toLocaleString('vi-VN')}đ\n` +
        `Người lập đề xuất: ${proposal.creatorName || '—'}\n` +
        `Người xét duyệt: ${currentUser.name}\n` +
        `→ Công nợ Trả (${proposal.subcontractorName}) chuyển sang Chờ thanh toán.`
      );
      try {
        addToast({ title: '✅ Đã phê duyệt', message: `✅ Đã phê duyệt Đề xuất ${proposal.id}! Trạng thái chuyển thành: Chờ Lập Phiếu.`, type: 'success' });
      } catch (e) {}
    } catch (err) {
      try {
        addToast({ title: '❌ Lỗi', message: `❌ Thất bại: ${err instanceof Error ? err.message : String(err)}`, type: 'error' });
      } catch (e) {}
    }
  };

  // Handle approver "Từ Chối" action -> rejected
  const canRejectProposal = useCallback((proposal: SubcontractorAdvanceProposal) => {
    if (!currentUser) return false;
    // 1. Là người được gán duyệt trong đề xuất (so sánh theo ID hoặc tên)
    if (proposal.approver === currentUser.id) return true;
    if (proposal.approverName && proposal.approverName.toLowerCase() === currentUser.name.toLowerCase()) return true;
    // 2. Thuộc nhóm Kế toán (role_accounting)
    if (isUserInRoleGroup(currentUser.id, 'role_accounting')) return true;
    // 3. Là Giám đốc (role_admin) - có quyền từ chối tất cả
    if (isUserInRoleGroup(currentUser.id, 'role_admin')) return true;
    return false;
  }, [currentUser]);

  // Handle approver "Từ Chối" action -> rejected
  const handleRejectByApprover = async (proposal: SubcontractorAdvanceProposal) => {
    // Kiểm tra quyền từ chối
    if (!canRejectProposal(proposal)) {
      addToast({ title: '⛔ Không có quyền', message: '❌ Bạn không phải người xét duyệt cho đề xuất này!', type: 'error' });
      return;
    }
    try {
      const updated: SubcontractorAdvanceProposal = {
        ...proposal,
        status: 'rejected'
      };
      await dbService.subcontractorAdvances.save(updated);
      setSubcontractorAdvances(prev => prev.map(p => p.id === updated.id ? updated : p));

      window.dispatchEvent(new CustomEvent('hl-subcontractor-advances-updated', { detail: updated }));
      // 📩 Gửi tin nhắn xét duyệt vào HỘI THOẠI CÁ NHÂN (người duyệt → người lập đề xuất)
      const creatorEmp = proposal.creator ? (employeesProp || []).find(e => e.id === proposal.creator) : findEmployeeByName(employeesProp || [], proposal.creatorName);
      if (currentUser?.id && creatorEmp?.id && currentUser.id !== creatorEmp.id) {
        sendApprovalDirectMessage({
          senderId: currentUser.id,
          senderName: currentUser.name,
          senderRole: currentUser.role,
          recipientId: creatorEmp.id,
          recipientName: creatorEmp.name || proposal.creatorName || 'Người lập đề xuất',
          content: `❌ Đã từ chối đề xuất tạm ứng ${proposal.id} (${proposal.taskName || proposal.subcontractorName}) ${proposal.amount.toLocaleString('vi-VN')}đ.`,
          relatedEntity: { type: 'advance', id: proposal.id },
        });
      }
      try {
        addToast({ title: 'ℹ️ Thông báo', message: `❌ Đã từ chối Đề xuất ${proposal.id}. Trạng thái chuyển thành: Từ Chối.`, type: 'info' });
      } catch (e) {}
    } catch (err) {
      try {
        addToast({ title: '❌ Lỗi', message: `❌ Thất bại: ${err instanceof Error ? err.message : String(err)}`, type: 'error' });
      } catch (e) {}
    }
  };

  // Handle accountant "Từ Chối" action -> rejected
  const handleRevertByAccountant = async (proposal: SubcontractorAdvanceProposal) => {
    try {
      const updated: SubcontractorAdvanceProposal = {
        ...proposal,
        status: 'rejected'
      };
      await dbService.subcontractorAdvances.save(updated);
      setSubcontractorAdvances(prev => prev.map(p => p.id === updated.id ? updated : p));

      window.dispatchEvent(new CustomEvent('hl-subcontractor-advances-updated', { detail: updated }));
      try {
        addToast({ title: 'ℹ️ Thông báo', message: `❌ Đã từ chối đề xuất ${proposal.id} bởi Kế toán. Trạng thái chuyển thành: Từ Chối.`, type: 'info' });
      } catch (e) {}
    } catch (err) {
      try {
        addToast({ title: '❌ Lỗi', message: `❌ Thất bại: ${err instanceof Error ? err.message : String(err)}`, type: 'error' });
      } catch (e) {}
    }
  };

  // Handle Board of Directors updating proposal amount before approving
  const handleUpdateAmount = async (proposal: SubcontractorAdvanceProposal, newAmountRaw: string) => {
    try {
      const parsedAmount = parseFloat(newAmountRaw.replace(/\D/g, ''));
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        addToast({ title: '⚠️ Thiếu thông tin', message: '❌ vui lòng nhập số tiền hợp lệ lớn hơn 0.', type: 'warning' });
        return;
      }

      const updated: SubcontractorAdvanceProposal = {
        ...proposal,
        amount: parsedAmount
      };

      await dbService.subcontractorAdvances.save(updated);
      setSubcontractorAdvances(prev => prev.map(p => p.id === updated.id ? updated : p));

      window.dispatchEvent(new CustomEvent('hl-subcontractor-advances-updated', { detail: updated }));
      setEditingAmountProposal(null);
      try {
        addToast({ title: '✅ Thành công', message: `✅ Đã cập nhật số tiền đề xuất thành công!`, type: 'success' });
      } catch (e) {}
    } catch (err) {
      try {
        addToast({ title: '❌ Lỗi', message: `❌ Thất bại: ${err instanceof Error ? err.message : String(err)}`, type: 'error' });
      } catch (e) {}
    }
  };

  // Custom persistent states for other accounts payable (Nhà Cung Cấp, Khác)
  const [customLiabilities, setCustomLiabilities] = useState<Liability[]>([]);

  // Load data từ Supabase khi mount + lắng nghe realtime
  useEffect(() => {
    let active = true;
    const fetchLiabilities = async () => {
      try {
        const list = await dbService.accountingLiabilities.list();
        if (active) setCustomLiabilities(list);
      } catch (err) {
        console.error("Lỗi khi tải công nợ phải trả:", err);
      }
    };
    fetchLiabilities();

    // Lắng nghe realtime khi có thay đổi từ trình duyệt khác
    const handleLiabilitiesRealtime = () => fetchLiabilities();
    window.addEventListener('hl-accounting-liabilities-updated', handleLiabilitiesRealtime);
    return () => {
      active = false;
      window.removeEventListener('hl-accounting-liabilities-updated', handleLiabilitiesRealtime);
    };
  }, []);

  // Sync lên Supabase khi data thay đổi (skip lần đầu mount)
  const isFirstRenderLiabilities = useRef(true);
  useEffect(() => {
    if (isFirstRenderLiabilities.current) {
      isFirstRenderLiabilities.current = false;
      return;
    }
    customLiabilities.forEach(l => {
      dbService.accountingLiabilities.save(l).catch(() => {});
    });
  }, [customLiabilities]);

  // ── All Receivables (Công nợ phải thu: auto từ duyệt BG + thủ công / import Excel) ────────
  const [customReceivables, setCustomReceivables] = useState<any[]>([]);

  // Load data từ Supabase khi mount + lắng nghe realtime event
  useEffect(() => {
    let active = true;
    const fetchReceivables = async () => {
      try {
        const list = await dbService.accountingReceivables.list();
        if (active) {
          console.log(`[Công Nợ Thu] 📥 Đã tải ${list.length} khoản thu từ accounting_receivables (${list.filter((r: any) => r.isAuto).length} auto, ${list.filter((r: any) => !r.isAuto).length} thủ công)`);
          setCustomReceivables(list);
        }
      } catch (err) {
        console.error("Lỗi khi tải công nợ phải thu:", err);
      }
    };
    fetchReceivables();

    // Lắng nghe realtime khi có thay đổi từ trình duyệt khác
    const handleRealtime = () => fetchReceivables();
    window.addEventListener('hl-accounting-receivables-updated', handleRealtime);
    return () => {
      active = false;
      window.removeEventListener('hl-accounting-receivables-updated', handleRealtime);
    };
  }, []);

  // Sync lên Supabase khi data thay đổi (skip lần đầu mount) — chỉ sync items thủ công
  const isFirstRenderReceivables = useRef(true);
  useEffect(() => {
    if (isFirstRenderReceivables.current) {
      isFirstRenderReceivables.current = false;
      return;
    }
    customReceivables.filter(r => !r.isAuto).forEach(r => {
      dbService.accountingReceivables.save(r).catch(() => {});
    });
  }, [customReceivables]);

  // Form states for manual receivables
  const [showReceivableModal, setShowReceivableModal] = useState(false);
  const [editingReceivableId, setEditingReceivableId] = useState<string | null>(null);
  const [recvProjectName, setRecvProjectName] = useState('');
  const [recvInvestor, setRecvInvestor] = useState('');
  const [recvField, setRecvField] = useState('Xây dựng');
  const [recvContractValue, setRecvContractValue] = useState<number>(0);
  const [recvCollected, setRecvCollected] = useState<number>(0);
  const [recvNotes, setRecvNotes] = useState('');
  const [receivableToDelete, setReceivableToDelete] = useState<any | null>(null);

  // Combined receivables list (auto từ accounting_receivables + thủ công)
  const mergedReceivables = useMemo(() => {
    // Tách auto và manual từ dữ liệu DB
    const dbAuto = customReceivables.filter(r => r.isAuto === true);
    const dbCustoms = customReceivables.filter(r => !r.isAuto);

    console.log(`[Công Nợ Thu] 🔍 mergedReceivables: ${dbAuto.length} auto (DB), ${dbCustoms.length} thủ công`);

    // Auto items: re-compute collected từ receipts (real-time)
    const auto = dbAuto.map(r => {
      const projRecs = receipts.filter(rec => rec.projectId === r.projectId);
      const collected = projRecs.reduce((s, rec) => s + rec.amount, 0);
      const remaining = (r.contractValue || 0) - collected;
      return { ...r, collected, remaining };
    });

    // Manual items: re-compute collected từ sales order receipts
    const customs = dbCustoms.map(r => {
      const soMatch = r.projectName.match(/ĐH\s+(\S+)/);
      const salesOrderId = soMatch ? soMatch[1] : null;
      const salesRecs = salesOrderId ? receipts.filter(rec => rec.salesOrderId === salesOrderId) : [];
      const collected = salesRecs.reduce((s, rec) => s + rec.amount, 0);
      return {
        ...r,
        collected: collected || (r.collected || 0),
        remaining: (r.contractValue || 0) - (collected || (r.collected || 0)),
        isAuto: false,
      };
    });

    return [...auto, ...customs];
  }, [customReceivables, receipts]);

  // Form states for manual liabilities
  const [showLiabModal, setShowLiabModal] = useState(false);
  const [editingLiabId, setEditingLiabId] = useState<string | null>(null);
  const [liabName, setLiabName] = useState('');
  const [liabCategory, setLiabCategory] = useState<'Thầu Phụ' | 'Nhà Cung Cấp' | 'Khác'>('Nhà Cung Cấp');
  const [liabValue, setLiabValue] = useState<number>(0);
  const [liabPaid, setLiabPaid] = useState<number>(0);
  const [liabNotes, setLiabNotes] = useState('');
  const [liabToDelete, setLiabToDelete] = useState<Liability | null>(null);

  // Combined liabilities list
  const mergedLiabilities = useMemo(() => {
    const subs = approvedSubContracts.map(sub => {
      const paymentsMade = payments.filter(p =>
        (p.subcontractorId && sub.subcontractorId && p.subcontractorId === sub.subcontractorId) ||
        (p.recipient && sub.subcontractorName && p.recipient === sub.subcontractorName)
      );
      const totalPaidAmount = paymentsMade.filter(p => p.status === 'approved').reduce((sum, p) => sum + p.amount, 0);
      const value = sub.contractValue || 0;
      const remaining = value - totalPaidAmount;
      return {
        id: sub.id,
        subcontractorId: sub.subcontractorId,
        name: sub.subcontractorName || sub.subcontractorId || 'Vãng lai',
        category: 'Thầu Phụ',
        value,
        paid: totalPaidAmount,
        remaining,
        notes: sub.notes || sub.workName || 'Hợp đồng thầu phụ thi công',
        isAuto: true
      };
    });

    const customs = customLiabilities.map(liab => {
      // Nợ tạm ứng thầu phụ: khớp chính xác theo relatedAdvanceId của phiếu chi.
      // Nợ thủ công: khớp theo tên người nhận (fallback về số tiền đã thanh toán lưu sẵn).
      const paymentsMade = liab.relatedAdvanceId
        ? payments.filter(p => p.relatedAdvanceId === liab.relatedAdvanceId && p.status === 'approved')
        : payments.filter(p => p.recipient === liab.name && p.status === 'approved');
      const totalPaidAmount = paymentsMade.length > 0
        ? paymentsMade.reduce((sum, p) => sum + p.amount, 0)
        : (liab.relatedAdvanceId ? 0 : (liab.paid || 0));
      const remaining = liab.value - totalPaidAmount;
      return {
        ...liab,
        paid: totalPaidAmount,
        remaining,
        isAuto: !!liab.relatedAdvanceId
      };
    });

    return [...subs, ...customs];
  }, [approvedSubContracts, customLiabilities, payments]);

  const [suppliers, setSuppliers] = useState<SupplierPartner[]>([]);

  const [inventory, setInventory] = useState<MaterialStock[]>([]);

  // Dữ liệu kế toán - Định mức công tác phí (nguồn: Supabase)
  const [travelNorms, setTravelNorms] = useState<TravelAllowanceNorm[]>([]);

  const generateNextTravelNormCode = (currentNorms: TravelAllowanceNorm[]): string => {
    let maxNum = 0;
    currentNorms.forEach(norm => {
      if (norm.code && norm.code.startsWith('CTP_')) {
        const numStr = norm.code.substring(4);
        const num = parseInt(numStr, 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });
    return `CTP_${String(maxNum + 1).padStart(3, '0')}`;
  };

  type DuLieuTab = 'khach_hang' | 'ncc_thau_phu' | 'vat_tu' | 'danh_muc_san_pham' | 'nha_cung_cap_vat_tu';
  const [duLieuTab, setDuLieuTab] = useState<DuLieuTab>(
    (initialDuLieuTab as DuLieuTab) || 'khach_hang'
  );

  useEffect(() => {
    if (initialDuLieuTab) {
      setDuLieuTab(initialDuLieuTab as DuLieuTab);
    }
  }, [initialDuLieuTab]);

  // Pagination & selection states for "Dữ liệu kế toán" tabs
  const [pageCust, setPageCust] = useState(1);
  const [pageSizeCust, setPageSizeCust] = useState(5);

  const [pageMat, setPageMat] = useState(1);
  const [pageSizeMat, setPageSizeMat] = useState(5);
  const [selectedMatDetail, setSelectedMatDetail] = useState<InventoryItem | null>(null);
  const [showTravelNormModal, setShowTravelNormModal] = useState(false);
  const [editingTravelNorm, setEditingTravelNorm] = useState<TravelAllowanceNorm | null>(null);

  // ── Danh mục sản phẩm kế toán (Accounting Product Catalog) ──
  const [accProducts, setAccProducts] = useState<AccountingProductItem[]>([]);
  const [pageAccProd, setPageAccProd] = useState(1);
  const [pageSizeAccProd, setPageSizeAccProd] = useState(10);
  const [showAccProdForm, setShowAccProdForm] = useState(false);
  const [accProdFormMode, setAccProdFormMode] = useState<'add' | 'edit'>('add');
  const [accProdEditId, setAccProdEditId] = useState<string | null>(null);
  const [accProdTenSP, setAccProdTenSP] = useState('');
  const [accProdDonGia, setAccProdDonGia] = useState<string>('');
  const [accProdDonViTinh, setAccProdDonViTinh] = useState('');
  const [accProdDeleteId, setAccProdDeleteId] = useState<string | null>(null);
  const accProdFileInputRef = useRef<HTMLInputElement>(null);
  const [accProdLoaded, setAccProdLoaded] = useState(false);

  // ── Đơn hàng bán (Sales Orders) ──
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>(salesOrdersProp);
  const [showSalesOrderForm, setShowSalesOrderForm] = useState(false);
  const [soCustomerId, setSoCustomerId] = useState('');
  const [soItems, setSoItems] = useState<SalesOrderItem[]>([]);
  const [soItemSearch, setSoItemSearch] = useState<string[]>([]); // Search term for each item row
  const [soItemDropdown, setSoItemDropdown] = useState<boolean[]>([]); // Show/hide dropdown for each row
  const [soItemDropdownIdx, setSoItemDropdownIdx] = useState<number | null>(null); // Which dropdown is open
  const soItemInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [soThanhToan, setSoThanhToan] = useState<string>('0');
  const [soReceiptAt, setSoReceiptAt] = useState<string>(() => new Date().toISOString().slice(0, 16));
  const [soNotes, setSoNotes] = useState('');
  const [soDeleteId, setSoDeleteId] = useState<string | null>(null);
  const [soViewOrder, setSoViewOrder] = useState<SalesOrder | null>(null);
  const [pageSO, setPageSO] = useState(1);
  const [pageSizeSO, setPageSizeSO] = useState(10);
  const soFileInputRef = useRef<HTMLInputElement>(null);
  const [isSavingSO, setIsSavingSO] = useState(false);

  // ── Đơn mua hàng (Purchase Orders) ──
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(purchaseOrdersProp);
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [poSupplierId, setPoSupplierId] = useState('');
  const [poItems, setPoItems] = useState<PurchaseOrderItem[]>([]);
  const [poItemSearch, setPoItemSearch] = useState<string[]>([]);
  const [poItemDropdown, setPoItemDropdown] = useState<boolean[]>([]);
  const poItemInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [poItemDropdownIdx, setPoItemDropdownIdx] = useState<number | null>(null);
  const [poThanhToan, setPoThanhToan] = useState<string>('0');
  const [poReceiptAt, setPoReceiptAt] = useState<string>(() => new Date().toISOString().slice(0, 16));
  const [poNotes, setPoNotes] = useState('');
  const [poDeleteId, setPoDeleteId] = useState<string | null>(null);
  const [poViewOrder, setPoViewOrder] = useState<PurchaseOrder | null>(null);
  // Modal chi tiết & tạo phiếu chi cho tab "Đơn hàng" (đề xuất vật tư)
  const [poDetailModal, setPoDetailModal] = useState<{ open: boolean; order: PurchaseOrder | null }>({ open: false, order: null });
  const [poPaymentModal, setPoPaymentModal] = useState<{ open: boolean; order: PurchaseOrder | null }>({ open: false, order: null });
  const [poPaymentAmount, setPoPaymentAmount] = useState<string>('0');
  const [poPaymentMethod, setPoPaymentMethod] = useState<'cash' | 'transfer'>('transfer');
  const [poPaymentDate, setPoPaymentDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [poPaymentNote, setPoPaymentNote] = useState('');
  // Hàm helper đọc trường vật tư đơn hàng bất kể shape (Finance: tenSanPham/soLuong/donGia | Điều phối: name/qty/price)
  const poItemName = (i: any): string => i?.tenSanPham || i?.name || '—';
  const poItemQty = (i: any): number => (i?.soLuong ?? i?.qty ?? 0);
  const poItemUnit = (i: any): string => i?.donViTinh || i?.unit || '';
  const poItemPrice = (i: any): number => (i?.donGia ?? i?.price ?? 0);
  const poItemTotal = (i: any): number => i?.thanhTien ?? i?.totalPrice ?? ((poItemQty(i) || 0) * (poItemPrice(i) || 0));
  const poStatusLabel = (st: string): string => {
    switch (st) {
      case 'draft': return 'Nháp';
      case 'confirmed': return 'Đã xác nhận';
      case 'completed': return 'Hoàn tất';
      case 'cancelled': return 'Đã hủy';
      default: return st || '—';
    }
  };

  // Tạo phiếu chi thanh toán công nợ cho 1 đơn hàng (liên kết qua purchaseOrderId).
  // Công nợ đơn hàng & Công nợ Trả được giảm khi phiếu chi được duyệt (xử lý tại App.tsx handleApprovePayment).
  const handleCreatePoPayment = (order: PurchaseOrder) => {
    const amount = Number(poPaymentAmount) || 0;
    const congNo = order.congNo || 0;
    if (amount <= 0) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'Vui lòng nhập số tiền thanh toán.', type: 'warning' });
      return;
    }
    if (amount > congNo + 1) {
      addToast({ title: '⚠️ Vượt quá công nợ', message: `Số tiền không được lớn hơn công nợ còn lại (${congNo.toLocaleString('vi-VN')} đ).`, type: 'warning' });
      return;
    }
    const payId = `pay_${Date.now()}`;
    const newPayment: Payment = {
      id: payId,
      code: `PC-DH-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${String(Math.floor(Math.random() * 900 + 100))}`,
      date: poPaymentDate,
      paymentAt: new Date().toISOString(),
      recipient: order.supplierName,
      category: 'supplier_payment',
      amount,
      paymentMethod: poPaymentMethod,
      notes: poPaymentNote.trim() || `Thanh toán đơn hàng ${order.id} - ${order.supplierName}`,
      proposer: currentUser?.name || 'Kế toán',
      approver: 'Trương Hữu Long (Giám đốc)',
      status: 'pending',
      purchaseOrderId: order.id,
    };
    onAddPayment(newPayment);
    setPoPaymentModal({ open: false, order: null });
    setPoPaymentAmount('0');
    setPoPaymentNote('');
    addToast({ title: '✅ Đã lập phiếu chi', message: `Phiếu chi ${newPayment.code} cho đơn ${order.id} đã tạo. Chờ duyệt để ghi nhận thanh toán.`, type: 'success' });
  };
  const [pagePO, setPagePO] = useState(1);
  const [pageSizePO, setPageSizePO] = useState(10);
  const poFileInputRef = useRef<HTMLInputElement>(null);
  const [isSavingPO, setIsSavingPO] = useState(false);

  // Reset receipt/payment selections when switching between nhap_thu and nhap_chi
  useEffect(() => {
    setRecSelectedRows(new Set());
    setPaySelectedRows(new Set());
  }, [activeSubTab]);

  // ── Danh mục sản phẩm kế toán: Load from Supabase on mount ──
  useEffect(() => {
    dbService.accountingProductCatalog.list().then((cloudData) => {
      if (cloudData && cloudData.length > 0) {
        setAccProducts(cloudData);
      }
      setAccProdLoaded(true);
    }).catch(() => setAccProdLoaded(true));
  }, []);

  // ── Danh mục sản phẩm kế toán: Sync to Supabase on change ──
  useEffect(() => {
    if (!accProdLoaded) return;
    accProducts.forEach(p => dbService.accountingProductCatalog.save(p).catch(() => {}));
  }, [accProducts, accProdLoaded]);

  // ── Đơn hàng bán: Sync salesOrders when prop changes ──
  useEffect(() => {
    setSalesOrders(salesOrdersProp);
  }, [salesOrdersProp]);

  // ── Mặc định Thanh toán thực tế = Tổng tiền khi items thay đổi ──
  useEffect(() => {
    const tong = calcTongTien(soItems);
    if (tong > 0 && (Number(soThanhToan) === 0 || soThanhToan === '0')) {
      setSoThanhToan(String(tong));
    }
  }, [soItems]);

  // ── Đơn mua hàng: Sync purchaseOrders when prop changes ──
  useEffect(() => {
    setPurchaseOrders(purchaseOrdersProp);
  }, [purchaseOrdersProp]);

  // ── Mặc định Thanh toán thực tế = Tổng tiền khi items thay đổi (Mua hàng) ──
  useEffect(() => {
    const tong = calcPOTongTien(poItems);
    if (tong > 0 && (Number(poThanhToan) === 0 || poThanhToan === '0')) {
      setPoThanhToan(String(tong));
    }
  }, [poItems]);

  const poSupplierData = useMemo(() => {
    const allSuppliers = (suppliersExternalProp && suppliersExternalProp.length > 0)
      ? suppliersExternalProp
      : (suppliers && suppliers.length > 0) ? suppliers : [];
    const selSup = allSuppliers.find(s => s.id === poSupplierId);
    return { allSuppliers, selSup };
  }, [suppliersExternalProp, suppliers, poSupplierId]);

  // ── Đơn hàng bán: Handlers ──
  const generateSOCode = (): string => {
    return generateOrderCode('DH', salesOrders.map(o => o.id));
  };

  const calcTongTien = (items: SalesOrderItem[]): number => {
    return items.reduce((sum, i) => sum + i.thanhTien, 0);
  };

  const handleSOAddItem = () => {
    setSoItems(prev => [...prev, {
      stt: prev.length + 1,
      productId: '',
      tenSanPham: '',
      donViTinh: '',
      soLuong: 1,
      donGia: 0,
      thanhTien: 0,
    }]);
    setSoItemSearch(prev => [...prev, '']);
    setSoItemDropdown(prev => [...prev, false]);
  };

  const handleSORemoveItem = (index: number) => {
    setSoItems(prev => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.map((item, i) => ({ ...item, stt: i + 1 }));
    });
    setSoItemSearch(prev => prev.filter((_, i) => i !== index));
    setSoItemDropdown(prev => prev.filter((_, i) => i !== index));
  };

  // Handle product search/select for each row
  // Fuzzy search helper - checks if search term is contained in product name (case insensitive, with Vietnamese normalization)
  const fuzzyMatch = (text: string, searchTerm: string): boolean => {
    if (!searchTerm.trim()) return true;
    const normalizedText = text.toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
    const normalizedSearch = searchTerm.toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
    return normalizedText.includes(normalizedSearch);
  };

  const handleSOItemSearchChange = (idx: number, value: string) => {
    setSoItemSearch(prev => {
      const updated = [...prev];
      updated[idx] = value;
      return updated;
    });

    // Show dropdown when typing or when focused with value
    setSoItemDropdown(prev => {
      const updated = [...prev];
      updated[idx] = true; // Always show dropdown when user interacts
      return updated;
    });

    // Try to match exact from product catalog
    const matchedProduct = accProducts.find(
      p => `${p.id} - ${p.tenSanPham}`.toLowerCase() === value.toLowerCase()
    );
    if (matchedProduct) {
      setSoItems(prev => {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          productId: matchedProduct.id,
          tenSanPham: matchedProduct.tenSanPham,
          donGia: matchedProduct.donGia || 0,
          donViTinh: matchedProduct.donViTinh || 'Cái',
          thanhTien: (updated[idx].soLuong || 1) * (matchedProduct.donGia || 0),
        };
        return updated;
      });
      setSoItemDropdown(prev => {
        const updated = [...prev];
        updated[idx] = false;
        return updated;
      });
    } else {
      // Free text - just update tenSanPham directly
      setSoItems(prev => {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          productId: '',
          tenSanPham: value,
        };
        return updated;
      });
    }
  };

  const handleSOItemChange = (index: number, field: keyof SalesOrderItem, value: any) => {
    setSoItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index] };
      if (field === 'productId') {
        // Auto-fill from product catalog
        const product = accProducts.find(p => p.id === value);
        if (product) {
          item.productId = product.id;
          item.tenSanPham = product.tenSanPham;
          item.donGia = product.donGia;
          item.donViTinh = product.donViTinh || 'Cái';
          item.thanhTien = item.soLuong * product.donGia;
        }
      } else if (field === 'soLuong' || field === 'donGia') {
        (item as any)[field] = Number(value) || 0;
        item.thanhTien = item.soLuong * item.donGia;
      } else {
        (item as any)[field] = value;
      }
      updated[index] = item;
      return updated;
    });
  };

  const resetSOForm = () => {
    setSoCustomerId('');
    setSoItems([]);
    setSoThanhToan('0');
    setSoReceiptAt(new Date().toISOString().slice(0, 16));
    setSoNotes('');
    setShowSalesOrderForm(false);
  };

  const handleSOCreate = async () => {
    if (isSavingSO) return;   // chặn double-click tạo 2 đơn trùng
    if (!soCustomerId) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'Vui lòng chọn khách hàng.', type: 'warning' });
      return;
    }
    if (soItems.length === 0 || soItems.every(i => !i.tenSanPham)) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'Vui lòng thêm ít nhất một sản phẩm.', type: 'warning' });
      return;
    }
    const customer = customers.find(c => c.id === soCustomerId);
    if (!customer) {
      addToast({ title: '❌ Lỗi', message: 'Không tìm thấy thông tin khách hàng.', type: 'error' });
      return;
    }
    const tongTien = calcTongTien(soItems);
    const thanhToan = Number(soThanhToan) || 0;
    const congNo = tongTien - thanhToan;
    const newOrder: SalesOrder = {
      id: generateSOCode(),
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone || '',
      customerAddress: customer.address || '',
      items: soItems.filter(i => i.tenSanPham),
      tongTien,
      thanhToanThucTe: thanhToan,
      congNo,
      status: 'confirmed',
      notes: soNotes || undefined,
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.name || 'Kế toán',
    };

    const receiptId = `rec_${Date.now()}`;
    const receiptAtISO = soReceiptAt ? new Date(soReceiptAt).toISOString() : new Date().toISOString();
    newOrder.receiptId = receiptId;

    // Lưu đơn TRƯỚC để biết mã cuối cùng: nếu mã bị trùng, tầng DB sẽ cấp lại
    // mã mới → phiếu thu & công nợ phải trỏ theo mã đó, không phải mã dự kiến.
    setIsSavingSO(true);
    let savedOrder: SalesOrder;
    try {
      const result = await onAddSalesOrder?.(newOrder);
      if (result === null) {
        // Lưu thất bại — không tạo phiếu thu/công nợ mồ côi
        addToast({ title: '❌ Lỗi lưu', message: 'Không thể lưu đơn hàng lên server. Chưa tạo phiếu thu.', type: 'error' });
        return;
      }
      // Prop có thể là handler đồng bộ (trả void) → fallback về đơn dự kiến
      savedOrder = (result as SalesOrder | null | undefined) ?? newOrder;
    } finally {
      setIsSavingSO(false);
    }

    // Tạo phiếu thu tự động (dùng mã đơn thực tế đã lưu)
    const newReceipt: Receipt = {
      id: receiptId,
      code: `PT-BH-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${String(Math.floor(Math.random() * 900 + 100))}`,
      date: new Date(receiptAtISO).toISOString().split('T')[0],
      customerId: customer.id,
      amount: thanhToan,
      paymentMethod: 'transfer',
      notes: `Thanh toán đơn hàng ${savedOrder.id} - ${customer.name}`,
      collector: currentUser?.name || 'Kế toán',
      salesOrderId: savedOrder.id,
      loaiThu: 'ban_hang',
      receiptAt: receiptAtISO,
    };
    onAddReceipt(newReceipt);

    // Tự động cập nhật Công nợ Phải Thu
    const newReceivable = {
      id: crypto.randomUUID(),
      projectName: `ĐH ${savedOrder.id}`,
      investor: customer.name,
      field: 'Bán hàng',
      contractValue: tongTien,
      collected: 0,
      remaining: tongTien,
      notes: `Từ đơn hàng ${savedOrder.id}`,
      isAuto: false,
    };
    setCustomReceivables(prev => [...prev, newReceivable]);
    resetSOForm();
    addToast({ title: '✅ Thành công', message: `Đã tạo đơn hàng ${savedOrder.id} và phiếu thu ${newReceipt.code}.`, type: 'success' });
  };

  const handleSODelete = (id: string) => {
    setSalesOrders(prev => prev.filter(o => o.id !== id));
    setSoDeleteId(null);
    onDeleteSalesOrder?.(id);  // App.tsx xử lý dbService.salesOrders.delete
    addToast({ title: '🗑️ Đã xóa', message: `Đã xóa đơn hàng ${id}.`, type: 'info' });
  };

  // Export Excel đơn hàng
  const handleSOExportExcel = () => {
    if (salesOrders.length === 0) {
      addToast({ title: '⚠️ Không có dữ liệu', message: 'Không có đơn hàng để xuất.', type: 'warning' });
      return;
    }
    const data = salesOrders.map((o, idx) => ({
      'STT': idx + 1,
      'Mã ĐH': o.id,
      'Khách hàng': o.customerName,
      'SĐT': o.customerPhone,
      'Tổng tiền': o.tongTien.toLocaleString('vi-VN'),
      'Đã thanh toán': o.thanhToanThucTe.toLocaleString('vi-VN'),
      'Công nợ': o.congNo.toLocaleString('vi-VN'),
      'Trạng thái': o.status,
      'Ngày tạo': o.createdAt ? o.createdAt.split('T')[0] : '',
    }));
    exportToExcel(data, 'DonHang', `Don_Hang_${formatDateForFile()}.xlsx`, undefined, ['STT', 'Mã ĐH', 'Khách hàng', 'SĐT', 'Tổng tiền', 'Đã thanh toán', 'Công nợ', 'Trạng thái', 'Ngày tạo']);
  };

  // Import Excel đơn hàng
  const handleSOImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    try {
      const rows = await importFromExcel<Record<string, any>>(file, (row) => row);
      if (rows.length === 0) { addToast({ title: '⚠️ File rỗng', message: 'File Excel không có dữ liệu.', type: 'warning' }); return; }
      addToast({ title: 'ℹ️', message: 'Import Excel cho đơn hàng hiện chưa hỗ trợ tạo phiếu thu tự động.', type: 'info' });
    } catch {
      addToast({ title: '❌ Lỗi', message: 'Không thể đọc file Excel.', type: 'error' });
    }
  };

  // ── Đơn mua hàng: Handlers ──
  const generatePOCode = (): string => {
    return generateOrderCode('PO', purchaseOrders.map(o => o.id));
  };

  const calcPOTongTien = (items: PurchaseOrderItem[]): number => {
    return items.reduce((sum, i) => sum + i.thanhTien, 0);
  };

  const handlePOAddItem = () => {
    setPoItems(prev => [...prev, {
      stt: prev.length + 1,
      productId: '',
      tenSanPham: '',
      donViTinh: '',
      soLuong: 1,
      donGia: 0,
      thanhTien: 0,
    }]);
    setPoItemSearch(prev => [...prev, '']);
    setPoItemDropdown(prev => [...prev, false]);
  };

  const handlePORemoveItem = (index: number) => {
    setPoItems(prev => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.map((item, i) => ({ ...item, stt: i + 1 }));
    });
    setPoItemSearch(prev => prev.filter((_, i) => i !== index));
    setPoItemDropdown(prev => prev.filter((_, i) => i !== index));
  };

  const handlePOItemSearchChange = (idx: number, value: string) => {
    setPoItemSearch(prev => { const u = [...prev]; u[idx] = value; return u; });
    setPoItemDropdown(prev => { const u = [...prev]; u[idx] = true; return u; }); // Always show dropdown when user interacts
    const matchedProduct = accProducts.find(
      p => `${p.id} - ${p.tenSanPham}`.toLowerCase() === value.toLowerCase()
    );
    if (matchedProduct) {
      setPoItems(prev => {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          productId: matchedProduct.id,
          tenSanPham: matchedProduct.tenSanPham,
          donGia: matchedProduct.donGia || 0,
          donViTinh: matchedProduct.donViTinh || 'Cái',
          thanhTien: (updated[idx].soLuong || 1) * (matchedProduct.donGia || 0),
        };
        return updated;
      });
      setPoItemDropdown(prev => { const u = [...prev]; u[idx] = false; return u; });
    } else {
      setPoItems(prev => {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], productId: '', tenSanPham: value };
        return updated;
      });
    }
  };

  const handlePOItemChange = (index: number, field: keyof PurchaseOrderItem, value: any) => {
    setPoItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index] };
      if (field === 'productId') {
        const product = accProducts.find(p => p.id === value);
        if (product) {
          item.productId = product.id;
          item.tenSanPham = product.tenSanPham;
          item.donGia = product.donGia;
          item.donViTinh = product.donViTinh || 'Cái';
          item.thanhTien = item.soLuong * product.donGia;
        }
      } else if (field === 'soLuong' || field === 'donGia') {
        (item as any)[field] = Number(value) || 0;
        item.thanhTien = item.soLuong * item.donGia;
      } else {
        (item as any)[field] = value;
      }
      updated[index] = item;
      return updated;
    });
  };

  const resetPOForm = () => {
    setPoSupplierId('');
    setPoItems([{ stt: 1, productId: '', tenSanPham: '', donViTinh: '', soLuong: 1, donGia: 0, thanhTien: 0 }]);
    setPoItemSearch(['']);
    setPoItemDropdown([false]);
    setPoThanhToan('0');
    setPoReceiptAt(new Date().toISOString().slice(0, 16));
    setPoNotes('');
    setShowPurchaseForm(false);
  };

  const handlePOCreate = async () => {
    if (isSavingPO) return;   // chặn double-click tạo 2 đơn trùng
    const { selSup } = poSupplierData;
    if (!selSup) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'Vui lòng chọn nhà cung cấp.', type: 'warning' });
      return;
    }
    if (poItems.length === 0 || poItems.every(i => !i.tenSanPham)) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'Vui lòng thêm ít nhất một sản phẩm.', type: 'warning' });
      return;
    }
    const tongTien = calcPOTongTien(poItems);
    const thanhToan = Number(poThanhToan) || 0;
    const congNo = tongTien - thanhToan;
    const newOrder: PurchaseOrder = {
      id: generatePOCode(),
      supplierId: selSup.id,
      supplierName: selSup.name,
      supplierPhone: selSup.phone || '',
      supplierAddress: selSup.address || '',
      items: poItems.filter(i => i.tenSanPham),
      tongTien,
      thanhToanThucTe: thanhToan,
      congNo,
      status: 'confirmed',
      notes: poNotes || undefined,
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.name || 'Kế toán',
    };

    const paymentId = thanhToan > 0 ? `pay_${Date.now()}` : undefined;
    if (paymentId) newOrder.paymentId = paymentId;

    // Lưu đơn TRƯỚC để biết mã cuối cùng: nếu mã bị trùng, tầng DB sẽ cấp lại
    // mã mới → phiếu chi & công nợ phải trỏ theo mã đó, không phải mã dự kiến.
    setIsSavingPO(true);
    let savedOrder: PurchaseOrder;
    try {
      const result = await onAddPurchaseOrder?.(newOrder);
      if (result === null) {
        // Lưu thất bại — không tạo phiếu chi/công nợ mồ côi
        addToast({ title: '❌ Lỗi lưu', message: 'Không thể lưu đơn mua lên server. Chưa tạo phiếu chi.', type: 'error' });
        return;
      }
      // Prop có thể là handler đồng bộ (trả void) → fallback về đơn dự kiến
      savedOrder = (result as PurchaseOrder | null | undefined) ?? newOrder;
    } finally {
      setIsSavingPO(false);
    }

    // Tạo phiếu chi tự động nếu thanh toán > 0
    if (paymentId) {
      const paymentAtISO = poReceiptAt ? new Date(poReceiptAt).toISOString() : new Date().toISOString();
      const newPayment: Payment = {
        id: paymentId,
        code: `PC-MH-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${String(Math.floor(Math.random() * 900 + 100))}`,
        date: new Date().toISOString().split('T')[0],
        paymentAt: paymentAtISO,
        recipient: selSup.name,
        amount: thanhToan,
        paymentMethod: 'transfer',
        category: 'supplier_payment',
        notes: `Thanh toán đơn mua ${savedOrder.id} - ${selSup.name}`,
        proposer: currentUser?.name || 'Kế toán',
        approver: 'Trương Hữu Long (Giám đốc)',
        status: (currentUser && isUserInRoleGroup(currentUser.id, 'role_admin')) ? 'approved' : 'pending',
      };
      onAddPayment(newPayment);
    }

    // Cập nhật công nợ nhà cung cấp
    const paidAtISO = poReceiptAt ? new Date(poReceiptAt).toISOString() : new Date().toISOString();
    const existingLiab = customLiabilities.find(l => l.name === selSup.name && l.category === 'Nhà Cung Cấp');
    if (existingLiab) {
      const updatedLiab: Liability = {
        ...existingLiab,
        value: existingLiab.value + tongTien,
        paid: existingLiab.paid,
        paidAt: paidAtISO,
        remaining: (existingLiab.value + tongTien) - existingLiab.paid,
        notes: existingLiab.notes ? `${existingLiab.notes}; Đơn mua ${savedOrder.id}` : `Từ đơn mua ${savedOrder.id}`,
      };
      setCustomLiabilities(prev => prev.map(l => l.id === existingLiab.id ? updatedLiab : l));
    } else {
      const newLiab: Liability = {
        id: crypto.randomUUID(),
        name: selSup.name,
        category: 'Nhà Cung Cấp',
        value: tongTien,
        paid: 0,
        paidAt: paidAtISO,
        remaining: tongTien,
        notes: `Từ đơn mua ${savedOrder.id}`,
        salesOrderId: undefined,
      };
      setCustomLiabilities(prev => [...prev, newLiab]);
    }

    resetPOForm();
    addToast({ title: '✅ Thành công', message: `Đã tạo đơn mua ${savedOrder.id}${thanhToan > 0 ? ` và phiếu chi ${paymentId}` : ''}.`, type: 'success' });
  };

  const handlePODelete = (id: string) => {
    setPurchaseOrders(prev => prev.filter(o => o.id !== id));
    setPoDeleteId(null);
    onDeletePurchaseOrder?.(id);  // App.tsx xử lý dbService.purchaseOrders.delete
    addToast({ title: '🗑️ Đã xóa', message: `Đã xóa đơn mua ${id}.`, type: 'info' });
  };

  // Export Excel đơn mua hàng
  const handlePOExportExcel = () => {
    if (purchaseOrders.length === 0) {
      addToast({ title: '⚠️ Không có dữ liệu', message: 'Không có đơn mua để xuất.', type: 'warning' });
      return;
    }
    const data = purchaseOrders.map((o, idx) => ({
      'STT': idx + 1,
      'Mã ĐM': o.id,
      'Nhà cung cấp': o.supplierName,
      'SĐT': o.supplierPhone,
      'Tổng tiền': o.tongTien.toLocaleString('vi-VN'),
      'Đã thanh toán': o.thanhToanThucTe.toLocaleString('vi-VN'),
      'Công nợ': o.congNo.toLocaleString('vi-VN'),
      'Trạng thái': o.status,
      'Ngày tạo': o.createdAt ? o.createdAt.split('T')[0] : '',
    }));
    exportToExcel(data, 'DonMuaHang', `Don_Mua_Hang_${formatDateForFile()}.xlsx`, undefined, ['STT', 'Mã ĐM', 'Nhà cung cấp', 'SĐT', 'Tổng tiền', 'Đã thanh toán', 'Công nợ', 'Trạng thái', 'Ngày tạo']);
  };

  // ── Danh mục sản phẩm kế toán: Helpers & CRUD handlers ──
  const generateAccProdCode = (): string => {
    let maxNum = 0;
    accProducts.forEach(p => {
      if (p.id && p.id.startsWith('SP')) {
        const num = parseInt(p.id.substring(2), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    return `SP${String(maxNum + 1).padStart(3, '0')}`;
  };

  const resetAccProdForm = () => {
    setAccProdTenSP('');
    setAccProdDonGia('');
    setAccProdDonViTinh('');
    setAccProdEditId(null);
    setAccProdFormMode('add');
  };

  const handleAccProdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accProdTenSP.trim()) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'Vui lòng nhập tên sản phẩm.', type: 'warning' });
      return;
    }
    const donGia = accProdDonGia.trim() !== '' ? Number(accProdDonGia) : 0;
    if (accProdFormMode === 'edit' && accProdEditId) {
      setAccProducts(prev => prev.map(p => p.id === accProdEditId ? { ...p, tenSanPham: accProdTenSP.trim(), donGia, donViTinh: accProdDonViTinh.trim() || undefined } : p));
      addToast({ title: '✅ Thành công', message: 'Đã cập nhật sản phẩm.', type: 'success' });
    } else {
      const newId = generateAccProdCode();
      const newItem: AccountingProductItem = { id: newId, tenSanPham: accProdTenSP.trim(), donGia, donViTinh: accProdDonViTinh.trim() || undefined };
      setAccProducts(prev => [...prev, newItem]);
      addToast({ title: '✅ Thành công', message: `Đã thêm sản phẩm ${newId}.`, type: 'success' });
    }
    resetAccProdForm();
    setShowAccProdForm(false);
  };

  const handleAccProdEdit = (item: AccountingProductItem) => {
    setAccProdFormMode('edit');
    setAccProdEditId(item.id);
    setAccProdTenSP(item.tenSanPham);
    setAccProdDonGia(String(item.donGia));
    setAccProdDonViTinh(item.donViTinh || '');
    setShowAccProdForm(true);
  };

  const handleAccProdDelete = (id: string) => {
    setAccProducts(prev => prev.filter(p => p.id !== id));
    setAccProdDeleteId(null);
    dbService.accountingProductCatalog.delete(id).catch(() => {});
    addToast({ title: '🗑️ Đã xóa', message: `Đã xóa sản phẩm ${id}.`, type: 'info' });
  };

  // Export Excel
  const handleAccProdExportExcel = () => {
    if (accProducts.length === 0) {
      addToast({ title: '⚠️ Không có dữ liệu', message: 'Không có sản phẩm để xuất.', type: 'warning' });
      return;
    }
    const data = accProducts.map((p, idx) => ({
      'STT': idx + 1,
      'Mã Sản Phẩm': p.id,
      'Tên Sản Phẩm': p.tenSanPham,
      'Đơn Giá (đ)': p.donGia.toLocaleString('vi-VN'),
      'Đơn Vị Tính': p.donViTinh || '',
    }));
    exportToExcel(data, 'DanhMucSanPham', `Danh_Muc_San_Pham_${formatDateForFile()}.xlsx`, undefined, ['STT', 'Mã Sản Phẩm', 'Tên Sản Phẩm', 'Đơn Giá (đ)', 'Đơn Vị Tính']);
  };

  // Import Excel
  const handleAccProdImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const rows = await importFromExcel<Record<string, any>>(file, (row) => row);
      if (rows.length === 0) {
        addToast({ title: '⚠️ File rỗng', message: 'File Excel không có dữ liệu.', type: 'warning' });
        return;
      }
      let maxNum = 0;
      accProducts.forEach(p => {
        if (p.id && p.id.startsWith('SP')) {
          const num = parseInt(p.id.substring(2), 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      });
      const newProducts: AccountingProductItem[] = rows.map((row, idx) => {
        maxNum++;
        const tenSP = row['Tên Sản Phẩm'] || row['tenSanPham'] || row['Tên SP'] || '';
        const donGiaRaw = row['Đơn Giá'] || row['donGia'] || row['Don gia'] || '0';
        const donGia = typeof donGiaRaw === 'string' ? Number(donGiaRaw.replace(/[^0-9.-]/g, '')) : Number(donGiaRaw) || 0;
        const donViTinh = row['Đơn Vị Tính'] || row['donViTinh'] || row['DVT'] || '';
        return {
          id: row['Mã Sản Phẩm'] || row['id'] || `SP${String(maxNum).padStart(3, '0')}`,
          tenSanPham: tenSP,
          donGia,
          donViTinh: donViTinh || undefined,
        };
      }).filter(p => p.tenSanPham);
      setAccProducts(prev => [...prev, ...newProducts]);
      addToast({ title: '✅ Nhập thành công', message: `Đã nhập ${newProducts.length} sản phẩm từ Excel.`, type: 'success' });
    } catch {
      addToast({ title: '❌ Lỗi', message: 'Không thể đọc file Excel.', type: 'error' });
    }
  };

  // Form states for Travel Allowance
  const [normCode, setNormCode] = useState('');
  const [normContent, setNormContent] = useState('');
  const [normQuantity, setNormQuantity] = useState<number>(1);
  const [normUnitPrice, setNormUnitPrice] = useState<number>(0);
  const [normNotes, setNormNotes] = useState('');

  // Local state for letter proposal popup/letterheads
  const [selectedReceivableProjId, setSelectedReceivableProjId] = useState<string | null>(null);
  const [selectedPayableSupplierId, setSelectedPayableSupplierId] = useState<string | null>(null);

  // Quick insertion Forms Status
  const [showRecForm, setShowRecForm] = useState(false);
  const [showPayForm, setShowPayForm] = useState(false);
  const [showSubContractForm, setShowSubContractForm] = useState(false);
  const [showMaterialForm, setShowMaterialForm] = useState(false);

  // Form Inputs - Thu
  const [recCust, setRecCust] = useState(customers[0]?.id || '');
  const [recProj, setRecProj] = useState(projects[0]?.id || '');
  const [recAmount, setRecAmount] = useState<number>(0);
  const [recMethod, setRecMethod] = useState<'cash' | 'transfer'>('transfer');
  const [recNotes, setRecNotes] = useState('');

  useEffect(() => {
    if (activeSubTab === 'nhap_thu') {
      const storedProj = localStorage.getItem('hl_prefill_receipt_project_id');
      const storedCust = localStorage.getItem('hl_prefill_receipt_customer_id');
      const storedAmount = localStorage.getItem('hl_prefill_receipt_amount');
      const storedNotes = localStorage.getItem('hl_prefill_receipt_notes');

      if (storedProj || storedCust || storedAmount || storedNotes) {
        if (storedProj) setRecProj(storedProj);
        if (storedCust) setRecCust(storedCust);
        if (storedAmount) setRecAmount(Number(storedAmount));
        if (storedNotes) setRecNotes(storedNotes);
        
        setShowRecForm(true);

        // Clear them so they don't fire again
        localStorage.removeItem('hl_prefill_receipt_project_id');
        localStorage.removeItem('hl_prefill_receipt_customer_id');
        localStorage.removeItem('hl_prefill_receipt_amount');
        localStorage.removeItem('hl_prefill_receipt_notes');
      }
    }
  }, [activeSubTab]);

  // Form Inputs - Chi: dùng employees prop từ App (cloud data từ Supabase)
  const employees = useMemo(() => {
    if (employeesProp && employeesProp.length > 0) {
      return employeesProp.map(emp => ({
        id: emp.id,
        name: emp.name || '',
        position: (emp as any).position || '',
        department: emp.department || ''
      }));
    }
    return [];
  }, [employeesProp]);

  const [payRecipient, setPayRecipient] = useState('');
  const [payProj, setPayProj] = useState(projects[0]?.id || '');
  const [payCategory, setPayCategory] = useState<'material' | 'labor' | 'shipping' | 'machinery' | 'general' | 'other' | 'subcontractor_advance' | 'site_expense' | 'salary' | 'supplier_payment' | 'salary_advance'>('supplier_payment');
  const [payAmount, setPayAmount] = useState<number | string>('');
  const [payMethod, setPayMethod] = useState<'cash' | 'transfer'>('cash');
  const [payNotes, setPayNotes] = useState('');

  const [recipientSearch, setRecipientSearch] = useState('');
  const [showRecipientDropdown, setShowRecipientDropdown] = useState(false);

  // Form Inputs - HĐ Thầu phụ
  const [formSubProj, setFormSubProj] = useState(activeSubTab || projects[0]?.id || '');
  const [formSubPartner, setFormSubPartner] = useState('');
  const [formSubScope, setFormSubScope] = useState('');
  const [formSubValue, setFormSubValue] = useState<number>(0);

  // Form Inputs - Thêm vật tư
  const [formMatCode, setFormMatCode] = useState('');
  const [formMatName, setFormMatName] = useState('');
  const [formMatUnit, setFormMatUnit] = useState('Tấm');
  const [formMatQty, setFormMatQty] = useState<number>(50);
  const [formMatPrice, setFormMatPrice] = useState<number>(350000);
  const [formMatLocation, setFormMatLocation] = useState('Kho lớn xưởng mộc');

  // Load hợp đồng thầu phụ từ Supabase + lắng nghe realtime
  useEffect(() => {
    let active = true;
    const fetchSubContracts = () => {
      dbService.accountingSubContracts.list()
        .then(list => { if (active && Array.isArray(list) && list.length > 0) setSubContracts(list); })
        .catch(err => console.warn('Lỗi tải hợp đồng thầu phụ từ Supabase:', err));
    };
    fetchSubContracts();

    // Lắng nghe realtime khi có thay đổi từ trình duyệt khác
    const handleSubContractsRealtime = () => fetchSubContracts();
    window.addEventListener('hl-accounting-sub-contracts-updated', handleSubContractsRealtime);
    return () => {
      active = false;
      window.removeEventListener('hl-accounting-sub-contracts-updated', handleSubContractsRealtime);
    };
  }, []);

  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        const list = await dbService.suppliers.list();
        if (list && list.length > 0) setSuppliers(list);
      } catch (e) {
        console.warn('Load suppliers from Supabase failed:', e);
      }
    };
    loadSuppliers();
  }, []);

  useEffect(() => {
    const handleSuppliersUpdated = async () => {
      try {
        const list = await dbService.suppliers.list();
        if (list && list.length > 0) setSuppliers(list);
      } catch (e) {
        console.warn('Load suppliers from Supabase failed:', e);
      }
    };
    window.addEventListener('hl-suppliers-updated', handleSuppliersUpdated);
    return () => {
      window.removeEventListener('hl-suppliers-updated', handleSuppliersUpdated);
    };
  }, []);

  useEffect(() => {
    const handleInventoryUpdated = async () => {
      try {
        const list = await dbService.inventory.list();
        if (list && list.length > 0) setInventory(list);
      } catch (e) {
        console.warn('Load inventory from Supabase failed:', e);
      }
    };
    window.addEventListener('hl-inventory-updated', handleInventoryUpdated);
    return () => {
      window.removeEventListener('hl-inventory-updated', handleInventoryUpdated);
    };
  }, []);

  useEffect(() => {
    setPageCust(1);
    setPageMat(1);
    setSelectedCustDetail(null);
    setSelectedMatDetail(null);
  }, [duLieuTab, searchTerm]);

  useEffect(() => {
    // Đồng bộ Supabase
    travelNorms.forEach(n => {
      dbService.travelNorms.save(n).catch(() => {});
    });
  }, [travelNorms]);

  // Overall statistics computation
  const activeProjectsCount = projects.filter(p => p.status === 'processing' || p.status === 'new').length;
  const totalRevenueSum = receipts.reduce((sum, r) => sum + r.amount, 0);
  const totalExpenseSum = payments.filter(p => p.status === 'approved').reduce((sum, p) => sum + p.amount, 0);
  
  // Custom project categories
  const ctCategoriesList = [];


  // Forms submission handlers
  const handleAddReceiptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newRec: Receipt = {
      id: `rec_${Date.now()}`,
      code: `PT-2026-${Math.floor(Math.random() * 900 + 100)}`,
      date: new Date().toISOString().split('T')[0],
      customerId: recCust,
      projectId: recProj || undefined,
      amount: Number(recAmount),
      paymentMethod: recMethod,
      notes: recNotes,
      collector: currentUser.name,
      attachmentName: 'minh_chung_giao_dich_vcb.pdf'
    };
    onAddReceipt(newRec);
    setShowRecForm(false);
    addToast({ title: '✅ Thành công', message: `✍️ Lập thành công phiếu thu tài chính ${newRec.code}. Dòng tiền thực nhận đã được ghi nhận vào kế toán sổ cái.`, type: 'success' });
  };

  const getRecipientChoices = () => {
    let rawList: { id: string; name: string; subText?: string }[] = [];
    
    if (payCategory === 'subcontractor_advance') {
      rawList = suppliers.map(s => ({
        id: s.id,
        name: s.name,
        subText: s.field || 'Thầu phụ thi công'
      }));
    } else if (payCategory === 'site_expense' || payCategory === 'salary') {
      rawList = employees.map(emp => ({
        id: emp.id,
        name: emp.name,
        subText: `${emp.position} - ${emp.department}`
      }));
    } else if (payCategory === 'supplier_payment') {
      rawList = suppliers.map(s => ({
        id: s.id,
        name: s.name,
        subText: s.field || 'Nhà cung cấp'
      }));
    } else {
      rawList = [
        ...employees.map(emp => ({ id: emp.id, name: emp.name, subText: emp.position })),
        ...suppliers.map(s => ({ id: s.id, name: s.name, subText: s.field }))
      ];
    }

    if (!recipientSearch) return rawList;
    return rawList.filter(item =>
      item.name.toLowerCase().includes(recipientSearch.toLowerCase()) ||
      item.id.toLowerCase().includes(recipientSearch.toLowerCase()) ||
      (item.subText && item.subText.toLowerCase().includes(recipientSearch.toLowerCase()))
    );
  };

  // ── Xử lý tạo Đề Xuất nhanh (Tạo Đề Xuất) ──
  const handleQuickProposalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(quickProposalAmount);
    if (!amount || amount <= 0) {
      addToast({ title: '⚠️ Lỗi nhập liệu', message: 'Vui lòng nhập số tiền đề xuất hợp lệ!', type: 'error' });
      return;
    }

    // Xác định dự án được chọn
    const selProject = projects.find(p => p.id === quickProposalProjId);
    if (!selProject) {
      addToast({ title: '⚠️ Lỗi nhập liệu', message: 'Vui lòng chọn Dự án / Công trình!', type: 'error' });
      return;
    }

    // Xác định thầu phụ (nếu loại tạm ứng thầu phụ)
    let subId = '';
    let subName = '';
    if (quickProposalType === 'subcontractor_advance') {
      const selSub = suppliers.find(s => s.id === quickProposalSubId);
      if (!selSub) {
        addToast({ title: '⚠️ Lỗi nhập liệu', message: 'Vui lòng chọn Thầu phụ!', type: 'error' });
        return;
      }
      subId = selSub.id;
      subName = selSub.name;
    } else {
      // Đề xuất chi phí dự án — đối tượng là dự án/công trình
      subId = selProject.id;
      subName = selProject.name;
    }

    // Sinh mã đề xuất chống trùng
    const proposalCode = generateOrderCode('DX', subcontractorAdvances.map(a => a.id));
    const todayVal = new Date().toISOString().split('T')[0];

    // Người xét duyệt mặc định: cấu hình (salary_advance / kế toán) hoặc Giám đốc
    let approverName = '';
    let approverId = '';
    const configured = getConfiguredApprover('salary_advance');
    if (configured && configured.name) {
      approverName = configured.name;
      approverId = configured.id;
    } else {
      const directorEmp = (employeesProp || []).find(e => e.role === 'director');
      approverName = directorEmp?.name || (currentUser as any)?.name || 'Ban Giám Đốc';
      approverId = directorEmp?.id || (currentUser as any)?.id || '';
    }

    const newProposal: SubcontractorAdvanceProposal = {
      id: proposalCode,
      subcontractorId: subId,
      subcontractorName: subName,
      projectId: selProject.id,
      projectName: selProject.name,
      taskId: '',
      taskName: selProject.name,
      amount,
      reason: quickProposalReason || `Đề xuất chi phí cho dự án: ${selProject.name}`,
      approver: approverId,
      approverName,
      creator: (currentUser as any)?.id || '',
      creatorName: (currentUser as any)?.name || 'Kế Toán',
      status: 'pending_approval',
      date: todayVal,
      proposalDate: todayVal,
      type: quickProposalType,
    };

    try {
      await dbService.subcontractorAdvances.save(newProposal);
      setSubcontractorAdvances(prev => [newProposal, ...prev]);
      window.dispatchEvent(new CustomEvent('hl-subcontractor-advances-updated', { detail: newProposal }));

      // 📩 Gửi tin nhắn xét duyệt vào HỘI THOẠI CÁ NHÂN (người lập → người duyệt)
      const approverEmp = (employeesProp || []).find(e => e.id === approverId) || findEmployeeByName(employeesProp || [], approverName);
      const creatorEmpId = (currentUser as any)?.id;
      if (creatorEmpId && approverEmp?.id && creatorEmpId !== approverEmp.id) {
        sendApprovalDirectMessage({
          senderId: creatorEmpId,
          senderName: (currentUser as any)?.name || 'Kế Toán',
          senderRole: (currentUser as any)?.role,
          recipientId: approverEmp.id,
          recipientName: approverEmp.name || approverName,
          content: `🔔 Đề xuất ${quickProposalType === 'subcontractor_advance' ? 'TẠM ỨNG THẦU PHỤ' : 'CHI PHÍ DỰ ÁN'} ${proposalCode} (${selProject.name}) ${amount.toLocaleString('vi-VN')}đ. Lý do: ${newProposal.reason}. Vui lòng xem xét.`,
          relatedEntity: { type: 'advance', id: proposalCode },
        });
      }

      addToast({
        title: '✅ Đã gửi Đề Xuất',
        message: `Mã đề xuất ${proposalCode} · ${amount.toLocaleString('vi-VN')}đ · ${selProject.name} · Người duyệt: ${approverName}`,
        type: 'success'
      });
    } catch (err) {
      console.error('Lỗi khi tạo đề xuất nhanh:', err);
      addToast({ title: '❌ Lỗi', message: 'Có lỗi xảy ra khi gửi đề xuất. Vui lòng thử lại!', type: 'error' });
      return;
    }

    // Đóng modal & reset form
    setShowQuickProposalModal(false);
    setQuickProposalSubId('');
    setQuickProposalProjId('');
    setQuickProposalAmount('');
    setQuickProposalReason('');
  };

  const handleAddPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newPay: Payment = {
      id: `pay_${Date.now()}`,
      code: `PC-2026-${Math.floor(Math.random() * 900 + 100)}`,
      date: new Date().toISOString().split('T')[0],
      // Khi lập phiếu chi tất toán Đề Xuất Tạm Ứng thầu phụ, gắn nhận diện thầu phụ
      // để thanh toán tự động khớp & cập nhật Công nợ Trả (không phụ thuộc tên gõ tay)
      recipient: activeProposalForPayment?.subcontractorName || payRecipient,
      projectId: activeProposalForPayment?.projectId || ((payProj === 'none' || !payProj) ? undefined : payProj),
      category: activeProposalForPayment ? 'subcontractor_advance' : payCategory,
      amount: Number(payAmount),
      paymentMethod: payMethod,
      notes: payNotes,
      proposer: currentUser.name,
      approver: 'Trương Hữu Long (Giám đốc)',
      status: (currentUser && isUserInRoleGroup(currentUser.id, 'role_admin')) ? 'approved' : 'pending',
      attachmentName: 'bien_nhan_giao_hang.pdf',
      subcontractorId: activeProposalForPayment?.subcontractorId,
      relatedAdvanceId: activeProposalForPayment?.id,
    };
    onAddPayment(newPay);

    // Check if we are finalizing a subcontractor advance proposal
    if (activeProposalForPayment) {
      try {
        const updatedProposal: SubcontractorAdvanceProposal = {
          ...activeProposalForPayment,
          status: 'completed'
        };
        await dbService.subcontractorAdvances.save(updatedProposal);

        // Update local state list
        setSubcontractorAdvances(prev => prev.map(p => p.id === updatedProposal.id ? updatedProposal : p));

        // Cập nhật Công nợ Trả: nếu thầu phụ ĐÃ có dòng (hợp đồng hoặc nợ thủ công)
        // thì phiếu chi tạm ứng sẽ tự động cộng vào dòng đó (khớp theo tên /
        // subcontractorId trong mergedLiabilities). Chỉ tạo dòng MỚI khi thầu phụ
        // chưa có bất kỳ khoản nợ nào.
        const advSubId = activeProposalForPayment.subcontractorId;
        const advName = activeProposalForPayment.subcontractorName || 'Thầu phụ';
        const hasExistingRow = customLiabilities.some(l =>
          (advSubId && l.subcontractorId && l.subcontractorId === advSubId) ||
          (l.name && l.name === advName)
        ) || approvedSubContracts.some(s =>
          (advSubId && s.subcontractorId && s.subcontractorId === advSubId) ||
          (s.subcontractorName && s.subcontractorName === advName)
        );
        if (!hasExistingRow) {
          const newLiab: Liability = {
            id: crypto.randomUUID(),
            name: advName,
            category: 'Thầu Phụ',
            value: Number(payAmount),
            paid: 0,
            remaining: 0, // mergedLiabilities tính lại dựa trên phiếu chi đã duyệt
            notes: `Tạm ứng thầu phụ ${activeProposalForPayment.id}`,
            relatedAdvanceId: activeProposalForPayment.id,
            subcontractorId: advSubId,
          };
          setCustomLiabilities(prev => [...prev, newLiab]);
          try {
            await dbService.accountingLiabilities.save(newLiab);
          } catch (liabErr) {
            console.error('Lỗi lưu Công nợ Trả tạm ứng:', liabErr);
          }
        }
        window.dispatchEvent(new CustomEvent('hl-accounting-liabilities-updated'));

        // Nếu là đề xuất ứng lương -> cập nhật bảng lương của người đề xuất
        if (payCategory === 'salary_advance' && activeProposalForPayment.subcontractorName) {
          updatePayrollWithAdvance(
            activeProposalForPayment.subcontractorName,
            Number(payAmount),
            activeProposalForPayment.taskName || ''
          );
        }

        // Trigger custom event to keep TaskDetailModal or others up to date
        window.dispatchEvent(new CustomEvent('hl-subcontractor-advances-updated', { detail: updatedProposal }));

        // Tin nhắn NHÓM CHAT dự án: người lập phiếu chi đã tất toán đề xuất
        await notifyAdvanceProjectChat(
          activeProposalForPayment,
          `💰 ĐÃ LẬP PHIẾU CHI TẤT TOÁN ĐỀ XUẤT TẠM ỨNG\n` +
          `Mã đề xuất: ${activeProposalForPayment.id}\n` +
          `Thầu phụ: ${activeProposalForPayment.subcontractorName}\n` +
          `Công việc: ${activeProposalForPayment.taskName || activeProposalForPayment.projectName || '—'}\n` +
          `Số tiền thanh toán: ${Number(payAmount).toLocaleString('vi-VN')}đ\n` +
          `Người lập phiếu: ${currentUser.name}\n` +
          `→ Đã cập nhật Công nợ Trả (${activeProposalForPayment.subcontractorName}).`
        );
        setActiveProposalForPayment(null);
      } catch (err) {
        console.error("Lỗi khi cập nhật trạng thái đề xuất:", err);
      }
    }

    setShowPayForm(false);
    addToast({ title: '✅ Thành công', message: (currentUser && isUserInRoleGroup(currentUser.id, 'role_admin'))
      ? `✅ Giám đốc tự động thông duyệt Phiếu chi ${newPay.code}!`
      : `✍️ Đã gửi trình lên Đề xuất chi ${newPay.code} thành công.`, type: 'success' });
  };

  const handleCreateVoucherFromProposal = (proposal: SubcontractorAdvanceProposal) => {
    setActiveProposalForPayment(proposal);
    setPayRecipient(proposal.subcontractorName);
    // Find matched project matching the proposal's projectName or fallback to first
    const matchedProj = projects.find(p => p.name === proposal.projectName) || projects[0];

    // Kiểm tra nếu là đề xuất ứng lương nhân sự (có taskName bắt đầu bằng "Ứng lương" hoặc type = 'salary_advance')
    const isSalaryAdvance = proposal.taskName?.startsWith('Ứng lương');

    if (isSalaryAdvance) {
      // Ứng lương nhân sự: không gán dự án, category = 'salary_advance'
      setPayProj(''); // Bỏ trống dự án
      setPayCategory('salary_advance');
      setPayNotes(`[${proposal.id}] Ứng lương cho ${proposal.subcontractorName}. ${proposal.reason || 'Trống'}`);
    } else if (proposal.type === 'project_expense_proposal') {
      setPayProj(proposal.projectId || matchedProj?.id || '');
      setPayCategory('site_expense');
      setPayNotes(`[${proposal.id}] Đề xuất tạm ứng cho công việc: ${proposal.taskName}. Diễn giải: ${proposal.reason || 'Trống'}`);
    } else {
      setPayProj(proposal.projectId || matchedProj?.id || '');
      setPayCategory('labor');
      setPayNotes(`[${proposal.id}] Chi tạm ứng thầu phụ cho công việc: ${proposal.taskName}. Diễn giải: ${proposal.reason || 'Trống'}`);
    }

    setPayAmount(proposal.amount);
    setPayMethod('transfer');

    // Switch to Nhập Chi tab
    setActiveSubTab('nhap_chi');
    // Open the payment form modal
    setShowPayForm(true);
    addToast({ title: 'ℹ️ Thông báo', message: `👉 Form "Tạo đề xuất chi mới" đã được điền tự động dựa trên Đề xuất Tạm ứng ${proposal.id} cho ${proposal.subcontractorName}.`, type: 'info' });
  };

  // Cập nhật bảng lương khi duyệt đề xuất ứng lương nhân sự
  const updatePayrollWithAdvance = async (empName: string, amount: number, taskName: string) => {
    try {
      // Trích xuất kỳ lương từ taskName (định dạng: "Ứng lương kỳ MM/YYYY")
      const periodMatch = taskName.match(/Ứng lương kỳ\s*([\d]{2}\/[\d]{4})/);
      const period = periodMatch ? periodMatch[1] : new Date().toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' });

      let currentPayroll: any[] = [];
      try {
        currentPayroll = await dbService.hrmPayrollRecords.list();
      } catch (err) {
        console.warn('Lỗi tải bảng lương từ Supabase:', err);
      }

      // Tìm bản ghi bảng lương của nhân sự trong kỳ lương tương ứng
      let payrollItem = currentPayroll.find((p: any) => p.empName === empName && p.month === period);
      if (payrollItem) {
        payrollItem.advances = (payrollItem.advances || 0) + amount;
        payrollItem.netSalary = (payrollItem.netSalary || 0) - amount;
      } else {
        // Nếu chưa có bản ghi, tạo mới
        payrollItem = {
          id: `PL-${Date.now().toString().slice(-4)}`,
          empId: '',
          empName: empName,
          month: period,
          baseSalary: 0,
          workedDays: 0,
          otHours: 0,
          allowance: 0,
          kpiBonus: 0,
          advances: amount,
          tax: 0,
          insurance: 0,
          expenses: 0,
          netSalary: -amount,
          status: 'unpaid'
        };
        currentPayroll.push(payrollItem);
      }

      // Lưu bảng lương lên Supabase
      dbService.hrmPayrollRecords.save(payrollItem).catch(err =>
        console.warn('Lỗi lưu bảng lương lên Supabase:', err));

      // Trigger event để đồng bộ với DashboardOverview và HumanResourcesManagement
      window.dispatchEvent(new CustomEvent('hl_hrm_payroll_updated', { detail: { empName, amount, period } }));

      addToast({ title: '✅ Cập nhật bảng lương', message: `💰 Đã ghi nhận tạm ứng ${amount.toLocaleString('vi-VN')} đ vào bảng lương kỳ ${period} của ${empName}.`, type: 'success' });
    } catch (err) {
      console.error('Lỗi khi cập nhật bảng lương:', err);
    }
  };

  const handleAddSubContractSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newSub: SubContract = {
      id: `sub_${Date.now()}`,
      code: `HĐTP-2026-${Math.floor(Math.random() * 90 + 10)}`,
      projectId: formSubProj,
      subcontractorId: formSubPartner,
      scope: formSubScope,
      value: Number(formSubValue),
      signedDate: new Date().toISOString().split('T')[0],
      status: 'active'
    };
    setSubContracts([newSub, ...subContracts]);
    dbService.accountingSubContracts.save(newSub).catch(err =>
      console.warn('Lỗi lưu hợp đồng thầu phụ lên Supabase:', err));
    setShowSubContractForm(false);
    addToast({ title: '✅ Thành công', message: `✍️ Ký số điện tử Hợp đồng thầu phụ mã ${newSub.code} thành công.`, type: 'success' });
  };

  const handleCloseCustomerModal = () => {
    setCustName('');
    setCustPhone('');
    setCustAddress('');
    setCustType('individual');
    setCustRep('');
    setCustTaxId('');
    setCustNotes('');
    setCustOpeningDebt(0);
    setEditingCustId(null);
    setIsCustRepManuallyEdited(false);
    setShowAddCustomerModal(false);
  };

  const handleCreateCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName) return;

    let targetId = editingCustId;
    if (!targetId) {
      // Mã KH tự sinh: KH_chữ cái đầu họ tên KH_số thứ tự hàng nhập
      const abbrev = getAbbreviation(custName);
      const orderIndex = customers.length + 1;
      targetId = `KH_${abbrev}_${orderIndex}`;
    }

    const newCust: Customer = {
      id: targetId,
      name: custName,
      phone: custPhone,
      email: selectedCustDetail?.id === targetId ? selectedCustDetail.email : '',
      address: custAddress,
      type: 'individual',
      representative: custRep || custName,
      taxOrIdNumber: custTaxId,
      notes: custNotes,
      openingDebt: Number(custOpeningDebt) || 0
    };

    if (onAddCustomer) {
      onAddCustomer(newCust);
    } else {
      const idx = customers.findIndex(c => c.id === targetId);
      if (idx !== -1) {
        customers[idx] = newCust;
      } else {
        customers.push(newCust);
      }
    }

    if (selectedCustDetail?.id === targetId) {
      setSelectedCustDetail(newCust);
    }

    // Reset Form
    handleCloseCustomerModal();
  };

  // ===================== BLOCK EXCEL (DANH BẠ KHÁCH HÀNG & SỐ DƯ TÀI SẢN) =====================
  const customerFileInputRef = useRef<HTMLInputElement>(null);

  const handleExportCustomerExcel = () => {
    const data = customers.map(c => ({
      'Mã KH': c.id,
      'Tên khách hàng': c.name,
      'Loại khách hàng': c.type === 'organization' ? 'Tổ chức' : 'Cá nhân',
      'Người đại diện': c.representative || c.name,
      'Mã số thuế': c.taxOrIdNumber || '',
      'Số điện thoại': c.phone || '',
      'Email': c.email || '',
      'Địa chỉ': c.address || '',
      'Công nợ đầu kỳ': c.openingDebt || 0,
      'Ghi chú': c.notes || '',
    }));
    exportToExcel(data, 'DanhBaKhachHang', `DanhBaKhachHang_${formatDateForFile()}.xlsx`, undefined, [...EXCEL_HEADERS.customer]);
    addToast({ title: '✅ Xuất Excel', message: `Đã xuất ${data.length} khách hàng`, type: 'success' });
  };

  const handleImportCustomerExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '', blankrows: false });
        const imported: Customer[] = rows.map((r, idx) => ({
          id: String(r['Mã KH'] || `KH_IMP_${Date.now()}_${idx}`),
          name: String(r['Tên khách hàng'] || '').trim(),
          type: (String(r['Loại khách hàng'] || 'Cá nhân') === 'Tổ chức' ? 'organization' : 'individual') as 'individual' | 'organization',
          representative: String(r['Người đại diện'] || r['Tên khách hàng'] || ''),
          taxOrIdNumber: String(r['Mã số thuế'] || ''),
          phone: String(r['Số điện thoại'] || ''),
          email: String(r['Email'] || ''),
          address: String(r['Địa chỉ'] || ''),
          openingDebt: Number(r['Công nợ đầu kỳ'] || 0) || 0,
          notes: String(r['Ghi chú'] || ''),
        })).filter(r => r.name);
        if (imported.length === 0) {
          addToast({ title: '⚠️ Không có dữ liệu', message: 'File không có dòng hợp lệ (cần cột Tên khách hàng).', type: 'warning' });
          return;
        }
        // Loại bỏ trùng Mã trong chính file import (giữ dòng đầu)
        const seenIds = new Set<string>();
        const deduped = imported.filter(c => {
          if (seenIds.has(c.id)) return false;
          seenIds.add(c.id);
          return true;
        });
        if (onAddCustomer) {
          deduped.forEach(c => onAddCustomer(c));
        } else {
          const merged = [...customers];
          deduped.forEach(imp => {
            const dupIdx = merged.findIndex(c => c.id === imp.id || c.name.toLowerCase() === imp.name.toLowerCase());
            if (dupIdx > -1) merged[dupIdx] = { ...merged[dupIdx], ...imp };
            else merged.push(imp);
          });
          customers.length = 0;
          customers.push(...merged);
        }
        addToast({ title: '✅ Nhập thành công', message: `Đã import ${deduped.length} khách hàng`, type: 'success' });
      } catch (err) {
        addToast({ title: '⛔ Lỗi', message: 'Không thể đọc file Excel', type: 'error' });
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleAddMaterialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMatName) return;
    const newMat: MaterialStock = {
      id: `mt_${Date.now()}`,
      code: formMatCode || `VT-${Math.floor(Math.random() * 900 + 100)}`,
      name: formMatName,
      unit: formMatUnit,
      qty: Number(formMatQty),
      unitPrice: Number(formMatPrice),
      minAlert: 10,
      location: formMatLocation
    };
    setInventory([...inventory, newMat]);
    setShowMaterialForm(false);
    setFormMatName('');
    setFormMatCode('');
    addToast({ title: '✅ Thành công', message: `📦 Đăng ký nạp kho dẻo dai thành công vật tư ${newMat.name}.`, type: 'success' });
  };

  const handleAddTravelNormClick = () => {
    setEditingTravelNorm(null);
    const nextCode = generateNextTravelNormCode(travelNorms);
    setNormCode(nextCode);
    setNormContent('');
    setNormQuantity(1);
    setNormUnitPrice(100000);
    setNormNotes('');
    setShowTravelNormModal(true);
  };

  const handleEditTravelNormClick = (norm: TravelAllowanceNorm) => {
    setEditingTravelNorm(norm);
    setNormCode(norm.code || '');
    setNormContent(norm.content);
    setNormQuantity(norm.quantity);
    setNormUnitPrice(norm.unitPrice);
    setNormNotes(norm.notes || '');
    setShowTravelNormModal(true);
  };

  const handleTravelNormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!normContent) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'vui lòng nhập Nội dung Công tác phí!', type: 'warning' });
      return;
    }

    if (editingTravelNorm) {
      setTravelNorms(prev => prev.map(item => 
        item.id === editingTravelNorm.id 
          ? { 
              ...item, 
              code: normCode, 
              content: normContent, 
              quantity: Number(normQuantity), 
              unitPrice: Number(normUnitPrice), 
              notes: normNotes 
            }
          : item
      ));
      addToast({ title: '✅ Thành công', message: '✅ Cập nhật định mức công tác phí thành công!', type: 'success' });
    } else {
      const finalCode = generateNextTravelNormCode(travelNorms);
      const newNorm: TravelAllowanceNorm = {
        id: `ctp_${Date.now()}`,
        code: finalCode,
        content: normContent,
        quantity: Number(normQuantity),
        unitPrice: Number(normUnitPrice),
        notes: normNotes
      };
      setTravelNorms(prev => [...prev, newNorm]);
      addToast({ title: '✅ Thành công', message: '✅ Thêm định mức công tác phí mới thành công!', type: 'success' });
    }
    setShowTravelNormModal(false);
  };

  const handleDeleteTravelNorm = (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa định mức công tác phí này?')) {
      setTravelNorms(prev => prev.filter(item => item.id !== id));
      addToast({ title: '🗑️ Đã xóa', message: '🗑️ Đã xóa định mức công tác phí.', type: 'info' });
    }
  };

  // Pre-fill a payment proposal when clicking "Lập ủy nhiệm chi"
  const handleQuickPayProposal = (supplier: SupplierPartner, moneyDue: number) => {
    setPayRecipient(supplier.name);
    setPayAmount(moneyDue);
    setPayNotes(`Ủy nhiệm chi trả tiền mua nguyên liệu / thầu thợ cho ${supplier.name}`);
    setActiveSubTab('nhap_chi');
    setShowPayForm(true);
  };

  const handleQuickPayProposalGeneric = (recipientName: string, moneyDue: number) => {
    setPayRecipient(recipientName);
    setPayAmount(moneyDue);
    setPayNotes(`Ủy nhiệm chi trả tiền thầu thợ / nhà cung cấp cho ${recipientName}`);
    setActiveSubTab('nhap_chi');
    setShowPayForm(true);
  };

  const handleSaveLiability = (e: React.FormEvent) => {
    e.preventDefault();
    if (!liabName) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'vui lòng nhập Tên Đơn vị', type: 'warning' });
      return;
    }
    if (editingLiabId) {
      setCustomLiabilities(prev => prev.map(item => item.id === editingLiabId ? {
        ...item,
        name: liabName,
        category: liabCategory,
        value: liabValue,
        paid: liabPaid,
        notes: liabNotes
      } : item));
      addToast({ title: 'ℹ️ Thông báo', message: '💾 Đã cập nhật công nợ phải trả.', type: 'warning' });
    } else {
      const newLiab = {
        id: crypto.randomUUID(),
        name: liabName,
        category: liabCategory,
        value: liabValue,
        paid: liabPaid,
        notes: liabNotes
      };
      setCustomLiabilities(prev => [...prev, newLiab]);
      addToast({ title: 'ℹ️ Thông báo', message: '🎉 Đã thêm công nợ phải trả mới.', type: 'warning' });
    }
    setShowLiabModal(false);
    setEditingLiabId(null);
    setLiabName('');
    setLiabValue(0);
    setLiabPaid(0);
    setLiabNotes('');
  };

  const handleEditLiability = (item: any) => {
    setEditingLiabId(item.id);
    setLiabName(item.name);
    setLiabCategory(item.category);
    setLiabValue(item.value);
    setLiabPaid(item.paid);
    setLiabNotes(item.notes || '');
    setShowLiabModal(true);
  };

  const handleDeleteLiability = (item: any) => {
    setLiabToDelete(item);
  };

  const confirmDeleteLiability = async () => {
    if (liabToDelete) {
      try {
        // Xóa trên Supabase
        await dbService.accountingLiabilities.delete(liabToDelete.id);
        // Cập nhật local state
        setCustomLiabilities(prev => prev.filter(x => x.id !== liabToDelete.id));
        addToast({ title: '🗑️ Đã xóa', message: `🗑️ Đã xóa công nợ phải trả của đơn vị "${liabToDelete.name}".`, type: 'info' });
      } catch (err) {
        console.error('Lỗi xóa công nợ phải trả:', err);
        addToast({ title: '❌ Lỗi', message: `Không thể xóa: ${err instanceof Error ? err.message : String(err)}`, type: 'error' });
      }
      setLiabToDelete(null);
    }
  };

  // ── Receivable CRUD handlers (Công nợ phải thu) ────────────────────────────
  const handleSaveReceivable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recvProjectName) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'Vui lòng nhập Tên dự án / công trình', type: 'warning' });
      return;
    }
    if (editingReceivableId) {
      setCustomReceivables(prev => prev.map(item => item.id === editingReceivableId ? {
        ...item,
        projectName: recvProjectName,
        investor: recvInvestor,
        field: recvField,
        contractValue: recvContractValue,
        collected: recvCollected,
        notes: recvNotes,
      } : item));
      addToast({ title: '✅ Cập nhật', message: 'Đã cập nhật công nợ phải thu.', type: 'success' });
    } else {
      const newRecv = {
        id: crypto.randomUUID(),
        projectName: recvProjectName,
        investor: recvInvestor,
        field: recvField,
        contractValue: recvContractValue,
        collected: recvCollected,
        notes: recvNotes,
      };
      setCustomReceivables(prev => [...prev, newRecv]);
      addToast({ title: '✅ Thêm mới', message: 'Đã thêm công nợ phải thu mới.', type: 'success' });
    }
    setShowReceivableModal(false);
    setEditingReceivableId(null);
    setRecvProjectName('');
    setRecvInvestor('');
    setRecvField('Xây dựng');
    setRecvContractValue(0);
    setRecvCollected(0);
    setRecvNotes('');
  };

  const handleEditReceivable = (item: any) => {
    setEditingReceivableId(item.id);
    setRecvProjectName(item.projectName);
    setRecvInvestor(item.investor || '');
    setRecvField(item.field || 'Xây dựng');
    setRecvContractValue(item.contractValue);
    setRecvCollected(item.collected);
    setRecvNotes(item.notes || '');
    setShowReceivableModal(true);
  };

  const handleDeleteReceivable = (item: any) => {
    setReceivableToDelete(item);
  };

  const confirmDeleteReceivable = async () => {
    if (receivableToDelete) {
      try {
        // Xóa trên Supabase
        await dbService.accountingReceivables.delete(receivableToDelete.id);
        // Cập nhật local state
        setCustomReceivables(prev => prev.filter(x => x.id !== receivableToDelete.id));
        addToast({ title: '🗑️ Đã xóa', message: `Đã xóa công nợ phải thu "${receivableToDelete.projectName}".`, type: 'info' });
      } catch (err) {
        console.error('Lỗi xóa công nợ phải thu:', err);
        addToast({ title: '❌ Lỗi', message: `Không thể xóa: ${err instanceof Error ? err.message : String(err)}`, type: 'error' });
      }
      setReceivableToDelete(null);
    }
  };

  // General export mock printout for the transaction vouchers
  const triggerDownloadTxt = (title: string, contentText: string, code: string) => {
    const textBlob = new Blob([contentText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(textBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/\s+/g, '_')}_${code}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Nếu không có quyền xem → trả về null (menu đã bị ẩn ở App.tsx)
  if (!canView) return null;

  return (
    <div className="bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden" id="erp_finance_accounting_master">
      
      {/* 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[75vh]">
        
        {/* LEFT COLUMN: THE IMAGE-MATCHING ACCOUNTING SIDEBAR (3 cols) */}
        {menuDisplayMode === 'sidebar' && activeSubTab !== 'du_lieu_ke_toan' && (
          <div className="lg:col-span-3 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 font-sans" id="accounting_sidebar_control">
            
            <div className="p-4 space-y-4">
              
              {/* Top rounded orange icon labeled KẾ TOÁN */}
              <div className="flex items-center gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg">
                  <Wallet className="w-5 h-5" />
                </div>
                <div className="text-left leading-none">
                  <h4 className="font-extrabold text-white text-[13px] tracking-wide uppercase">KẾ TOÁN</h4>
                  <p className="text-[9.5px] text-slate-400 mt-1 font-medium">Quản lý Thu–Chi</p>
                </div>
              </div>

              {/* Menu display style selector */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850 space-y-1.5">
                <div className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 text-center">Giao Diện Menu</div>
                <div className="grid grid-cols-2 gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => toggleMenuDisplayMode('sidebar')}
                    className={`py-1 text-[9.5px] font-black rounded uppercase text-center cursor-pointer transition-all ${menuDisplayMode === 'sidebar' ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-455 hover:text-slate-300 bg-transparent'}`}
                  >
                    Menu Dọc
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleMenuDisplayMode('tabs')}
                    className={`py-1 text-[9.5px] font-black rounded uppercase text-center cursor-pointer transition-all ${(menuDisplayMode as string) === 'tabs' ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-455 hover:text-slate-300 bg-transparent'}`}
                  >
                    Menu Ngang
                  </button>
                </div>
              </div>

              {/* Sub summary metrics: HD, Thu, Chi */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 space-y-1.5 text-[10px] font-mono">
                <div className="flex justify-between items-center text-slate-400">
                  <span>HĐ</span>
                  <span className="text-slate-100 font-bold">{activeProjectsCount} CT</span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Thu</span>
                  <span className="text-emerald-400 font-bold font-sans">
                    {(totalRevenueSum / 1000000).toLocaleString('vi-VN')} tr
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Chi</span>
                  <span className="text-rose-500 font-bold font-sans">
                    {(totalExpenseSum / 1000000).toLocaleString('vi-VN')} tr
                  </span>
                </div>
              </div>

              {/* Left interactive tab list with custom icons and labels */}
              <div className="flex flex-col gap-1 text-[10.5px]">

                <button
                  type="button"
                  onClick={() => { setActiveSubTab('de_xuat_thu_chi'); setSearchTerm(''); }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left font-bold transition-all ${activeSubTab === 'de_xuat_thu_chi' ? 'bg-slate-800/90 text-white border-l-4 border-orange-500' : 'text-slate-400 hover:text-white hover:bg-slate-850/50'}`}
                >
                  <span className="flex items-center gap-2">
                    <FileCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>Đề Xuất Thu Chi</span>
                  </span>
                  <span className="bg-amber-500/10 text-amber-400 text-[8.5px] px-1 rounded font-mono">
                    {subcontractorAdvances.filter(a => a.status === 'pending_approval' || a.status === 'pending_payment').length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { setActiveSubTab('don_hang'); setSearchTerm(''); }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left font-bold transition-all ${activeSubTab === 'don_hang' ? 'bg-slate-800/90 text-white border-l-4 border-orange-500' : 'text-slate-400 hover:text-white hover:bg-slate-850/50'}`}
                >
                  <span className="flex items-center gap-2">
                    <ShoppingCart className="w-3.5 h-3.5 text-violet-400" />
                    <span>Đơn Hàng</span>
                  </span>
                  <span className="bg-violet-500/10 text-violet-400 text-[8.5px] px-1 rounded font-mono">{purchaseOrders.length}</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setActiveSubTab('nhap_thu'); setSearchTerm(''); }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left font-bold transition-all ${activeSubTab === 'nhap_thu' ? 'bg-slate-800/90 text-white border-l-4 border-orange-500' : 'text-slate-400 hover:text-white hover:bg-slate-850/50'}`}
                >
                  <span className="flex items-center gap-2">
                    <Heart className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400/25" />
                    <span>Nhập Thu</span>
                  </span>
                  <span className="text-emerald-400 text-[9px] font-mono">{receipts.length}</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setActiveSubTab('nhap_chi'); setSearchTerm(''); }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left font-bold transition-all ${activeSubTab === 'nhap_chi' ? 'bg-slate-800/90 text-white border-l-4 border-orange-500' : 'text-slate-400 hover:text-white hover:bg-slate-850/50'}`}
                >
                  <span className="flex items-center gap-2">
                    <Circle className="w-3.5 h-3.5 text-red-500 fill-red-500" />
                    <span>Nhập Chi</span>
                  </span>
                  <span className="text-rose-500 text-[9px] font-mono">{payments.length}</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setActiveSubTab('cong_no_phai_thu'); setSearchTerm(''); }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left font-bold transition-all ${activeSubTab === 'cong_no_phai_thu' ? 'bg-slate-800/90 text-white border-l-4 border-orange-500' : 'text-slate-400 hover:text-white hover:bg-slate-850/50'}`}
                >
                  <span className="flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Công nợ Phải Thu</span>
                  </span>
                  <span className="bg-cyan-500/10 text-cyan-400 text-[8.5px] px-1 rounded">CĐT</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setActiveSubTab('cong_no_phai_tra'); setSearchTerm(''); }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left font-bold transition-all ${activeSubTab === 'cong_no_phai_tra' ? 'bg-slate-800/90 text-white border-l-4 border-orange-500' : 'text-slate-400 hover:text-white hover:bg-slate-850/50'}`}
                >
                  <span className="flex items-center gap-2">
                    <TrendingDown className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Công nợ Phải Trả</span>
                  </span>
                  <span className="bg-indigo-505/10 text-indigo-400 text-[8.5px] px-1 rounded">NCC</span>
                </button>

              </div>

            </div>

            {/* Bottom Footer Credit */}
            <div className="p-3 border-t border-slate-850/70 text-[9px] text-slate-500 text-center uppercase tracking-wide">
              HL Kế toán 2026 • ERP Cloud
            </div>

          </div>
        )}

        {/* RIGHT COLUMN: MAIN INTERACTIVE WORKSPACE (9 or 12 cols depending on display mode) */}
        <div className={`${(menuDisplayMode === 'tabs' || activeSubTab === 'du_lieu_ke_toan') ? 'lg:col-span-12' : 'lg:col-span-9'} p-6 bg-slate-950 flex flex-col justify-between`} id="accounting_workspace_panel">
          <div>
            
            {/* Top Navigation Bar: Tab layout active only when menuDisplayMode is 'tabs' */}
            {menuDisplayMode === 'tabs' && activeSubTab !== 'du_lieu_ke_toan' && (
              <div className="flex flex-col bg-slate-900 border border-slate-800 p-3 rounded-2xl mb-6 gap-3 shadow-md border-t-4 border-t-orange-500 animate-slideDown" id="accounting_tabs_navigation">
                
                {/* Horizontal header holding tab buttons on the left and Layout selector on the right */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
                  
                  {/* Horizontal list of subtabs — underline-tab style */}
                  <div className="w-full bg-white border-b border-slate-200 rounded-t-lg">
                    <ul className="flex flex-nowrap md:flex-wrap items-center gap-1 -mb-px text-sm font-medium overflow-x-auto scrollbar-thin" style={{ WebkitOverflowScrolling: 'touch' }}>

                      <li>
                        <button
                          type="button"
                          onClick={() => { setActiveSubTab('de_xuat_thu_chi'); setSearchTerm(''); }}
                          aria-current={activeSubTab === 'de_xuat_thu_chi' ? 'page' : undefined}
                          className={`group inline-flex items-center justify-center px-4 py-3 border-b border-transparent rounded-t-lg transition-all whitespace-nowrap cursor-pointer text-xs font-bold ${activeSubTab === 'de_xuat_thu_chi' ? 'text-orange-600 border-orange-500' : 'text-slate-600 hover:text-orange-600 hover:border-slate-300'}`}
                        >
                          <FileCheck className={`w-4 h-4 me-2 ${activeSubTab === 'de_xuat_thu_chi' ? 'text-orange-600' : 'text-slate-400 group-hover:text-orange-600'}`} />
                          <span>Đề Xuất Thu Chi</span>
                        </button>
                      </li>

                      <li>
                        <button
                          type="button"
                          onClick={() => { setActiveSubTab('don_hang'); setSearchTerm(''); }}
                          aria-current={activeSubTab === 'don_hang' ? 'page' : undefined}
                          className={`group inline-flex items-center justify-center px-4 py-3 border-b border-transparent rounded-t-lg transition-all whitespace-nowrap cursor-pointer text-xs font-bold ${activeSubTab === 'don_hang' ? 'text-orange-600 border-orange-500' : 'text-slate-600 hover:text-orange-600 hover:border-slate-300'}`}
                        >
                          <ShoppingCart className={`w-4 h-4 me-2 ${activeSubTab === 'don_hang' ? 'text-orange-600' : 'text-slate-400 group-hover:text-orange-600'}`} />
                          <span>Đơn Hàng</span>
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          onClick={() => { setActiveSubTab('nhap_thu'); setSearchTerm(''); }}
                          aria-current={activeSubTab === 'nhap_thu' ? 'page' : undefined}
                          className={`group inline-flex items-center justify-center px-4 py-3 border-b border-transparent rounded-t-lg transition-all whitespace-nowrap cursor-pointer text-xs font-bold ${activeSubTab === 'nhap_thu' ? 'text-orange-600 border-orange-500' : 'text-slate-600 hover:text-orange-600 hover:border-slate-300'}`}
                        >
                          <Heart className={`w-4 h-4 me-2 ${activeSubTab === 'nhap_thu' ? 'text-orange-600' : 'text-slate-400 group-hover:text-orange-600'}`} />
                          <span>Nhập Thu</span>
                        </button>
                      </li>

                      <li>
                        <button
                          type="button"
                          onClick={() => { setActiveSubTab('nhap_chi'); setSearchTerm(''); }}
                          aria-current={activeSubTab === 'nhap_chi' ? 'page' : undefined}
                          className={`group inline-flex items-center justify-center px-4 py-3 border-b border-transparent rounded-t-lg transition-all whitespace-nowrap cursor-pointer text-xs font-bold ${activeSubTab === 'nhap_chi' ? 'text-orange-600 border-orange-500' : 'text-slate-600 hover:text-orange-600 hover:border-slate-300'}`}
                        >
                          <Circle className={`w-4 h-4 me-2 ${activeSubTab === 'nhap_chi' ? 'text-orange-600' : 'text-slate-400 group-hover:text-orange-600'}`} />
                          <span>Nhập Chi</span>
                        </button>
                      </li>

                      <li>
                        <button
                          type="button"
                          onClick={() => { setActiveSubTab('cong_no_phai_thu'); setSearchTerm(''); }}
                          aria-current={activeSubTab === 'cong_no_phai_thu' ? 'page' : undefined}
                          className={`group inline-flex items-center justify-center px-4 py-3 border-b border-transparent rounded-t-lg transition-all whitespace-nowrap cursor-pointer text-xs font-bold ${activeSubTab === 'cong_no_phai_thu' ? 'text-orange-600 border-orange-500' : 'text-slate-600 hover:text-orange-600 hover:border-slate-300'}`}
                        >
                          <TrendingUp className={`w-4 h-4 me-2 ${activeSubTab === 'cong_no_phai_thu' ? 'text-orange-600' : 'text-slate-400 group-hover:text-orange-600'}`} />
                          <span>Công nợ Thu</span>
                        </button>
                      </li>

                      <li>
                        <button
                          type="button"
                          onClick={() => { setActiveSubTab('cong_no_phai_tra'); setSearchTerm(''); }}
                          aria-current={activeSubTab === 'cong_no_phai_tra' ? 'page' : undefined}
                          className={`group inline-flex items-center justify-center px-4 py-3 border-b border-transparent rounded-t-lg transition-all whitespace-nowrap cursor-pointer text-xs font-bold ${activeSubTab === 'cong_no_phai_tra' ? 'text-orange-600 border-orange-500' : 'text-slate-600 hover:text-orange-600 hover:border-slate-300'}`}
                        >
                          <TrendingDown className={`w-4 h-4 me-2 ${activeSubTab === 'cong_no_phai_tra' ? 'text-orange-600' : 'text-slate-400 group-hover:text-orange-600'}`} />
                          <span>Công nợ Trả</span>
                        </button>
                      </li>

                    </ul>
                  </div>

                </div>

              </div>
            )}
            
            {/* Header / Sub-tab Title */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-850 pb-4 mb-5 gap-3 shrink-0">
              <div>
                <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                  {activeSubTab === 'de_xuat_thu_chi' && '📋 Phê duyệt Đề xuất Thu Chi Tạm Ứng'}
                  {activeSubTab === 'don_hang' && '🛒 Quản lý Đơn Hàng Mua'}
                  {activeSubTab === 'dashboard' && '📊 Dashboard Thống kê Kế toán Tổng lực'}
                  {activeSubTab === 'khach_hang' && '👥 Danh mục Khách hàng'}
                  {activeSubTab === 'vat_tu' && '📦 Quản Lý kho'}
                  {activeSubTab === 'nhap_thu' && '💚 Quản lý THU'}
                  {activeSubTab === 'nhap_chi' && '🔴 Quản lý CHI'}
                  {activeSubTab === 'cong_no_phai_thu' && '📈 Chi tiết nợ Phải Thu '}
                  {activeSubTab === 'cong_no_phai_tra' && '📉 Chi tiết nợ Phải Trả '}
                  {activeSubTab === 'du_lieu_ke_toan' && (
                    duLieuTab === 'khach_hang' ? '👥 Danh mục Khách hàng' :
                    duLieuTab === 'ncc_thau_phu' ? '📋 DANH SÁCH THẦU PHỤ' :
                    duLieuTab === 'nha_cung_cap_vat_tu' ? '🚚 Nhà cung cấp vật tư' :
                    duLieuTab === 'vat_tu' ? '📦 Quản Lý kho' :
                    '📁 Cấu hình Dữ liệu Kế toán'
                  )}
                </h2>
              </div>

              {/* SEARCH BOX & ACTION (Common in right area) */}
              <div className="flex gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-60">
                  <input
                    type="text"
                    placeholder="Tìm kiếm nhanh..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-[11px] outline-none text-slate-100 placeholder-slate-500 focus:border-orange-500 transition-colors"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                </div>
              </div>
            </div>

            {/* MAIN PORT FOR ACTIVE SUBTAB */}

            {/* SUB-TABS NAVIGATION FOR DỮ LIỆU KẾ TOÁN (ALWAYS AT THE TOP IF ACTIVE) */}
            {activeSubTab === 'du_lieu_ke_toan' && (
              <div className="flex border-b border-slate-200 bg-white rounded-t-lg px-4 pb-0 shrink-0 gap-6 mb-4 overflow-x-auto scrollbar-none" id="accounting_data_tabs">
                <button
                  type="button"
                  onClick={() => setDuLieuTab('khach_hang')}
                  className={`pb-3 text-xs font-extrabold uppercase tracking-widest relative transition-all outline-none whitespace-nowrap cursor-pointer ${
                    duLieuTab === 'khach_hang'
                      ? 'text-orange-600 font-black'
                      : 'text-slate-500 hover:text-orange-600'
                  }`}
                >
                  👥 Khách hàng
                  {duLieuTab === 'khach_hang' && (
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-orange-500 rounded-full" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setDuLieuTab('danh_muc_san_pham')}
                  className={`pb-3 text-xs font-extrabold uppercase tracking-widest relative transition-all outline-none whitespace-nowrap cursor-pointer ${
                    duLieuTab === 'danh_muc_san_pham'
                      ? 'text-orange-600 font-black'
                      : 'text-slate-500 hover:text-orange-600'
                  }`}
                >
                  📦 Danh mục sản phẩm
                  {duLieuTab === 'danh_muc_san_pham' && (
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-orange-500 rounded-full" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setDuLieuTab('ncc_thau_phu')}
                  className={`pb-3 text-xs font-extrabold uppercase tracking-widest relative transition-all outline-none whitespace-nowrap cursor-pointer ${
                    duLieuTab === 'ncc_thau_phu'
                      ? 'text-orange-600 font-black'
                      : 'text-slate-500 hover:text-orange-600'
                  }`}
                >
                  📋 DANH SÁCH THẦU PHỤ
                  {duLieuTab === 'ncc_thau_phu' && (
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-orange-500 rounded-full" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setDuLieuTab('nha_cung_cap_vat_tu')}
                  className={`pb-3 text-xs font-extrabold uppercase tracking-widest relative transition-all outline-none whitespace-nowrap cursor-pointer ${
                    duLieuTab === 'nha_cung_cap_vat_tu'
                      ? 'text-orange-600 font-black'
                      : 'text-slate-500 hover:text-orange-600'
                  }`}
                >
                  🚚 Nhà cung cấp vật tư
                  {duLieuTab === 'nha_cung_cap_vat_tu' && (
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-orange-500 rounded-full" />
                  )}
                </button>


              </div>
            )}

            {/* TAB: ĐƠN HÀNG MUA (từ Đề xuất vật tư qua ĐÃ NHẬN HÀNG) */}
            {activeSubTab === 'don_hang' && (() => {
              const keyword = (searchTerm || '').trim().toLowerCase();
              const filteredPOs = purchaseOrders
                .filter((o: PurchaseOrder) => {
                  if (!keyword) return true;
                  return (
                    (o.id || '').toLowerCase().includes(keyword) ||
                    (o.supplierName || '').toLowerCase().includes(keyword)
                  );
                })
                .slice()
                .sort((a: PurchaseOrder, b: PurchaseOrder) => (b.createdAt || '').localeCompare(a.createdAt || ''));

              return (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-850 pb-3">
                    <div>
                      <span className="font-bold text-slate-300 uppercase tracking-widest text-[11px] block">
                        Danh sách Đơn Hàng Mua
                      </span>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Quản lý các đơn hàng đã tạo với nhà cung cấp khi đề xuất vật tư chuyển qua cột <span className="text-emerald-400 font-bold">ĐÃ NHẬN HÀNG</span>. Xem chi tiết hoặc lập phiếu chi thanh toán công nợ.
                      </p>
                    </div>
                    <span className="bg-violet-600/20 text-violet-300 border border-violet-500/30 text-[10px] font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap">
                      {filteredPOs.length} / {purchaseOrders.length} đơn
                    </span>
                  </div>

                  <div className="overflow-x-auto text-[10.5px]">
                    <table className="w-full text-left text-slate-300">
                      <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                        <tr>
                          <th className="px-3 py-2.5 w-10 text-center">#</th>
                          <th className="px-3 py-2.5">Mã đơn</th>
                          <th className="px-3 py-2.5">Nhà cung cấp</th>
                          <th className="px-3 py-2.5">Ngày</th>
                          <th className="px-3 py-2.5 text-right">Tổng tiền</th>
                          <th className="px-3 py-2.5 text-right">Đã TT</th>
                          <th className="px-3 py-2.5 text-right text-rose-400 font-bold">Công nợ</th>
                          <th className="px-3 py-2.5">Trạng thái</th>
                          <th className="px-3 py-2.5 text-center">Hành động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPOs.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="px-3 py-8 text-center text-slate-500 italic">
                              {purchaseOrders.length === 0 ? 'Chưa có đơn hàng nào. Đơn hàng xuất hiện ở đây khi đề xuất vật tư được nhận hàng.' : 'Không tìm thấy đơn hàng phù hợp.'}
                            </td>
                          </tr>
                        ) : (
                          filteredPOs.map((o: PurchaseOrder, idx: number) => {
                            const congNo = o.congNo || 0;
                            const paid = o.thanhToanThucTe || 0;
                            return (
                              <tr key={o.id} className="border-b border-slate-850/80 hover:bg-slate-900/40 font-sans">
                                <td className="px-3 py-3 text-center font-mono text-slate-500">{idx + 1}</td>
                                <td className="px-3 py-3 font-mono font-bold text-slate-100 whitespace-nowrap">{o.id}</td>
                                <td className="px-3 py-3 font-semibold text-slate-200">{o.supplierName || '—'}</td>
                                <td className="px-3 py-3 font-mono text-slate-400 whitespace-nowrap">{(o.createdAt || '').slice(0, 10) || '—'}</td>
                                <td className="px-3 py-3 text-right font-mono font-bold text-slate-100">{(o.tongTien || 0).toLocaleString('vi-VN')} đ</td>
                                <td className="px-3 py-3 text-right font-mono text-emerald-400">{(paid).toLocaleString('vi-VN')} đ</td>
                                <td className="px-3 py-3 text-right font-mono font-extrabold text-rose-450 bg-rose-500/5">
                                  {congNo > 0 ? `${congNo.toLocaleString('vi-VN')} đ` : '0 đ'}
                                </td>
                                <td className="px-3 py-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                                    o.status === 'completed' ? 'bg-emerald-600/15 text-emerald-300 border-emerald-500/30' :
                                    o.status === 'cancelled' ? 'bg-rose-600/15 text-rose-300 border-rose-500/30' :
                                    o.status === 'confirmed' ? 'bg-violet-600/15 text-violet-300 border-violet-500/30' :
                                    'bg-slate-700/40 text-slate-300 border-slate-600/40'
                                  }`}>
                                    {poStatusLabel(o.status)}
                                  </span>
                                </td>
                                <td className="px-3 py-3">
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setPoDetailModal({ open: true, order: o })}
                                      className="bg-sky-600 hover:bg-sky-500 text-white text-[9.5px] font-extrabold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap"
                                      title="Xem chi tiết đơn hàng"
                                    >
                                      <Eye className="w-3 h-3" /> Chi tiết
                                    </button>
                                    {congNo > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => { setPoPaymentAmount(String(congNo)); setPoPaymentNote(''); setPoPaymentModal({ open: true, order: o }); }}
                                        className="bg-rose-600 hover:bg-rose-700 text-white text-[9.5px] font-extrabold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap"
                                        title="Tạo phiếu chi thanh toán công nợ"
                                      >
                                        <Circle className="w-3 h-3" /> Tạo phiếu chi
                                      </button>
                                    ) : (
                                      <span className="text-emerald-500 text-[9px] italic font-bold">Đã thanh toán</span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* TAB 0: ĐỀ XUẤT THU CHI */}
            {activeSubTab === 'de_xuat_thu_chi' && (() => {
              const filteredAdvances = subcontractorAdvances.filter(a => {
                if (proposalTypeFilter === 'subcontractor') {
                  if (a.type === 'project_expense_proposal') return false;
                } else if (proposalTypeFilter === 'expense') {
                  if (a.type !== 'project_expense_proposal') return false;
                }
                if (!searchTerm) return true;
                return (
                  a.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  a.subcontractorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  a.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  a.taskName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  (a.reason && a.reason.toLowerCase().includes(searchTerm.toLowerCase()))
                );
              });

              // Quick metric counts
              const totalCount = subcontractorAdvances.length;
              const pendingApprovalCount = subcontractorAdvances.filter(a => a.status === 'pending_approval').length;
              const waitingPaymentCount = subcontractorAdvances.filter(a => a.status === 'pending_payment').length;
              const completedCount = subcontractorAdvances.filter(a => a.status === 'completed').length;
              const rejectedCount = subcontractorAdvances.filter(a => a.status === 'rejected').length;

              const getStatusBadge = (status: SubcontractorAdvanceProposal['status']) => {
                switch (status) {
                  case 'pending_approval':
                    return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] px-2.5 py-1 rounded-full font-bold">Chờ Duyệt</span>;
                  case 'pending_payment':
                    return <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[10px] px-2.5 py-1 rounded-full font-bold">Chờ Lập Phiếu (KT)</span>;
                  case 'rejected':
                    return <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] px-2.5 py-1 rounded-full font-bold">Từ Chối</span>;
                  case 'completed':
                    return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] px-2.5 py-1 rounded-full font-bold font-sans">Hoàn Thành</span>;
                  default:
                    return <span className="bg-slate-800 text-slate-400 text-[10px] px-2.5 py-1 rounded-full font-bold">Không rõ</span>;
                }
              };

              return (
                <div className="space-y-6">
                  {/* Overview Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-left">
                    <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl relative overflow-hidden">
                      <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block font-sans">Tổng số đề xuất</span>
                      <span className="text-xl font-black text-white font-mono block mt-1">{totalCount}</span>
                    </div>
                    <div className="p-4 bg-amber-950/20 border border-amber-900/40 rounded-xl relative overflow-hidden">
                      <span className="text-amber-400 text-[10px] font-bold uppercase tracking-wider block font-sans">Chờ Duyệt</span>
                      <span className="text-xl font-black text-amber-400 font-mono block mt-1">{pendingApprovalCount}</span>
                    </div>
                    <div className="p-4 bg-orange-950/20 border border-orange-900/40 rounded-xl relative overflow-hidden">
                      <span className="text-orange-400 text-[10px] font-bold uppercase tracking-wider block font-sans">Chờ Lập Phiếu (KT)</span>
                      <span className="text-xl font-black text-orange-400 font-mono block mt-1">{waitingPaymentCount}</span>
                    </div>
                    <div className="p-4 bg-emerald-950/20 border border-emerald-900/40 rounded-xl relative overflow-hidden">
                      <span className="text-emerald-400/90 text-[10px] font-bold uppercase tracking-wider block font-sans">Hoàn Thành (Đã chi)</span>
                      <span className="text-xl font-black text-emerald-400 font-mono block mt-1">{completedCount}</span>
                    </div>
                    <div className="p-4 bg-rose-950/10 border border-rose-900/30 rounded-xl relative overflow-hidden">
                      <span className="text-red-400 text-[10px] font-bold uppercase tracking-wider block font-sans">Bị Từ Chối</span>
                      <span className="text-xl font-black text-red-400 font-mono block mt-1">{rejectedCount}</span>
                    </div>
                  </div>

                  {/* Main List */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                    <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <h3 className="font-extrabold text-white text-xs uppercase tracking-wider">
                          {proposalTypeFilter === 'all' && "Danh sách Đề xuất Thu Chi & Tạm ứng "}
                          {proposalTypeFilter === 'subcontractor' && "Danh sách Đề xuất Tạm ứng Thầu phụ"}
                          {proposalTypeFilter === 'expense' && "Danh sách Đề xuất Chi phí phát sinh công trình"}
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">Xử lý phê duyệt tạm ứng thầu phụ, chi phí phát sinh công trình và kết nối sổ quỹ kế toán chi tiền.</p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Nút Tạo Đề Xuất nhanh */}
                        <button
                          type="button"
                          onClick={() => {
                            setQuickProposalProjId(projects[0]?.id || '');
                            setQuickProposalSubId('');
                            setQuickProposalAmount('');
                            setQuickProposalReason('');
                            setShowQuickProposalModal(true);
                          }}
                          className="bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-extrabold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-lg transition-all cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Tạo Đề Xuất
                        </button>

                        {/* Filter tabs */}
                        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                        <button
                          type="button"
                          onClick={() => setProposalTypeFilter('all')}
                          className={`text-[10px] font-extrabold px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                            proposalTypeFilter === 'all'
                              ? 'bg-amber-500/10 text-amber-400 font-black'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Tất cả ({subcontractorAdvances.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setProposalTypeFilter('subcontractor')}
                          className={`text-[10px] font-extrabold px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                            proposalTypeFilter === 'subcontractor'
                              ? 'bg-sky-500/10 text-sky-400 font-black'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Tạm ứng thầu phụ ({subcontractorAdvances.filter(a => a.type !== 'project_expense_proposal').length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setProposalTypeFilter('expense')}
                          className={`text-[10px] font-extrabold px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                            proposalTypeFilter === 'expense'
                              ? 'bg-emerald-500/10 text-emerald-400 font-black'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Đề xuất tạm ứng ({subcontractorAdvances.filter(a => a.type === 'project_expense_proposal').length})
                        </button>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-950/50 border-b border-slate-800 text-slate-400 font-extrabold uppercase text-[10px] tracking-wider">
                            <th className="p-3 pl-2 w-10 text-center">
                              <input
                                type="checkbox"
                                checked={finSelectAll && filteredAdvances.length > 0 && filteredAdvances.every(a => finSelectedRows.has(a.id))}
                                onChange={(e) => handleFinSelectAll(e.target.checked, filteredAdvances)}
                                className="w-4 h-4 text-amber-500 border-slate-600 rounded cursor-pointer"
                              />
                            </th>
                            <th className="p-3 pl-4">Mã đề xuất</th>
                            <th className="p-3">Đối tượng / Thầu phụ</th>
                            <th className="p-3">Dự án & Công việc con</th>
                            <th className="p-3 text-right">Số tiền đề xuất</th>
                            <th className="p-3">Diễn giải</th>
                            <th className="p-3">Nhân sự liên quan</th>
                            <th className="p-3">Trạng thái</th>
                            <th className="p-3 text-center">Hành động</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {filteredAdvances.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="p-10 text-center text-slate-500 italic">
                                Không có yêu cầu đề xuất nào phù hợp.
                              </td>
                            </tr>
                          ) : (
                            filteredAdvances.map(adv => (
                              <tr key={adv.id} className={`hover:bg-slate-850/20 transition-colors ${finSelectedRows.has(adv.id) ? 'bg-amber-500/10' : ''}`}>
                                {/* Checkbox */}
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={finSelectedRows.has(adv.id)}
                                    onChange={(e) => { e.stopPropagation(); handleFinRowSelect(adv.id, e.target.checked); }}
                                    className="w-4 h-4 text-amber-500 border-slate-600 rounded cursor-pointer"
                                  />
                                </td>
                                {/* Mã Đề Xuất */}
                                <td className="p-3 pl-4 font-mono font-bold text-amber-500 text-[11px]">
                                  <div>{adv.id}</div>
                                  {(adv.date || (adv as any).proposalDate) && (
                                    <div className="text-[9px] text-slate-400 font-sans mt-0.5 font-normal">
                                      Ngày ĐX: {adv.date || (adv as any).proposalDate}
                                    </div>
                                  )}
                                </td>
                                
                                {/* Tên Thầu Phụ / Đối tượng */}
                                <td className="p-3">
                                  {adv.type === 'project_expense_proposal' ? (
                                    <div className="space-y-1">
                                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] px-1.5 py-0.5 rounded font-black tracking-wide uppercase font-sans">Đề xuất tạm ứng</span>
                                      <div className="font-extrabold text-white mt-1">{adv.subcontractorName}</div>
                                    </div>
                                  ) : (
                                    <div className="space-y-1">
                                      <span className="bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[9px] px-1.5 py-0.5 rounded font-black tracking-wide uppercase font-sans">Tạm ứng Thầu phụ</span>
                                      <div className="font-extrabold text-white mt-1">{adv.subcontractorName}</div>
                                    </div>
                                  )}
                                </td>

                                {/* Dự án & Công việc */}
                                <td className="p-3">
                                  <div className="text-slate-200 font-bold text-[12px]">{adv.projectName}</div>
                                  <div className="text-slate-400 text-[10px] mt-0.5">{adv.taskName}</div>
                                </td>

                                {/* Số Tiền */}
                                <td className="p-3 text-right font-mono font-black text-orange-400 text-[13px]">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <span>{adv.amount.toLocaleString('vi-VN')} đ</span>
                                    {adv.status === 'pending_approval' && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingAmountProposal(adv);
                                          setEditAmountValue(adv.amount.toString());
                                        }}
                                        className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                                        title="Chỉnh sửa số tiền"
                                      >
                                        <Edit className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </td>

                                {/* Diễn giải */}
                                <td className="p-3 text-slate-300 max-w-xs truncate font-medium" title={adv.reason}>
                                  {adv.reason || '—'}
                                </td>

                                {/* Người Lập & Người Duyệt */}
                                <td className="p-3 text-slate-400 text-[10.5px] leading-relaxed">
                                  <div>Lập: <span className="text-slate-200 font-bold">{adv.creatorName}</span></div>
                                  <div>Duyệt: <span className="text-slate-200 font-bold">{adv.approverName}</span></div>
                                </td>

                                {/* Trạng thái */}
                                <td className="p-3">
                                  {getStatusBadge(adv.status)}
                                </td>

                                {/* Hành động */}
                                <td className="p-3 text-center">
                                  <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                    <button
                                      type="button"
                                      onClick={() => setViewingProposalDetail(adv)}
                                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-extrabold text-[10px] px-2.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                                      title="Xem chi tiết đề xuất"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-sky-400" />
                                      <span>Chi Tiết</span>
                                    </button>
                                    
                                    {/* Action for Chờ Duyệt (pending_approval) */}
                                    {adv.status === 'pending_approval' && canApproveProposal(adv) && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => handleApprove(adv)}
                                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                                          title="Phê duyệt đề xuất"
                                        >
                                          <Check className="w-3 h-3" />
                                          <span>Duyệt ({adv.approverName || 'Kế toán'})</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setRejectProposalModal(adv)}
                                          className="bg-red-600 hover:bg-red-500 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                                          title="Từ chối đề xuất"
                                        >
                                          <X className="w-3 h-3" />
                                          <span>Từ Chối</span>
                                        </button>
                                      </>
                                    )}

                                    {/* Action for Chờ Lập Phiếu (waiting_payment) */}
                                    {adv.status === 'pending_payment' && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => handleCreateVoucherFromProposal(adv)}
                                          className="bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                                          title="Lập phiếu ủy nhiệm chi"
                                        >
                                          <Plus className="w-3 h-3" />
                                          <span>Lập Phiếu (KT)</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setRevertProposalModal(adv)}
                                          className="bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                                          title="Trả về Chờ Duyệt"
                                        >
                                          <X className="w-3 h-3" />
                                          <span>Từ Chối</span>
                                        </button>
                                      </>
                                    )}

                                    {adv.status === 'completed' && (
                                      <span className="text-emerald-500 font-bold text-[10px] flex items-center gap-1">
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Hoàn Tất</span>
                                      </span>
                                    )}

                                    {adv.status === 'rejected' && (
                                      <span className="text-red-400 font-bold text-[10px] flex items-center gap-1">
                                        <X className="w-3.5 h-3.5" />
                                        <span>Bị Từ Chối</span>
                                      </span>
                                    )}

                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Modal: Tạo Đề Xuất nhanh (Tạm ứng Thầu Phụ / Chi phí Dự Án) */}
            {showQuickProposalModal && (
              <div className="fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowQuickProposalModal(false)}>
                <form
                  onSubmit={handleQuickProposalSubmit}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 space-y-3 text-[10.5px] shadow-2xl max-h-[90vh] overflow-y-auto"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-1">
                    <h3 className="font-extrabold text-sm uppercase tracking-wide text-amber-400 flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Tạo Đề Xuất Nhanh
                    </h3>
                    <button type="button" onClick={() => setShowQuickProposalModal(false)} className="text-slate-400 hover:text-white cursor-pointer bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Chọn loại đề xuất */}
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Loại đề xuất:</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setQuickProposalType('project_expense_proposal')}
                        className={`text-[10px] font-extrabold px-3 py-2 rounded-xl border transition-all cursor-pointer ${
                          quickProposalType === 'project_expense_proposal'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40'
                            : 'text-slate-400 border-slate-800 hover:border-slate-600'
                        }`}
                      >
                        💰 Đề xuất Chi phí Dự Án
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickProposalType('subcontractor_advance')}
                        className={`text-[10px] font-extrabold px-3 py-2 rounded-xl border transition-all cursor-pointer ${
                          quickProposalType === 'subcontractor_advance'
                            ? 'bg-sky-500/10 text-sky-400 border-sky-500/40'
                            : 'text-slate-400 border-slate-800 hover:border-slate-600'
                        }`}
                      >
                        🤝 Tạm ứng Thầu Phụ
                      </button>
                    </div>
                  </div>

                  {/* Chọn dự án */}
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Dự án / Công trình <span className="text-rose-500">*</span>:</label>
                    <select
                      value={quickProposalProjId}
                      onChange={(e) => setQuickProposalProjId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white cursor-pointer font-bold"
                    >
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Chọn thầu phụ (chỉ với loại tạm ứng thầu phụ) */}
                  {quickProposalType === 'subcontractor_advance' && (
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Thầu phụ <span className="text-rose-500">*</span>:</label>
                      <select
                        value={quickProposalSubId}
                        onChange={(e) => setQuickProposalSubId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white cursor-pointer font-bold"
                      >
                        <option value="">— Chọn thầu phụ —</option>
                        {suppliers.map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({s.field || 'Thầu phụ'})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Số tiền đề xuất (VND) <span className="text-rose-500">*</span>:</label>
                      <input
                        type="number"
                        required
                        value={quickProposalAmount}
                        onChange={(e) => setQuickProposalAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Diễn giải:</label>
                    <textarea
                      value={quickProposalReason}
                      onChange={(e) => setQuickProposalReason(e.target.value)}
                      rows={2}
                      placeholder="Nhập lý do / diễn giải cho đề xuất..."
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white font-medium"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                    <button type="button" onClick={() => setShowQuickProposalModal(false)} className="bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded text-slate-300 cursor-pointer">Bỏ qua</button>
                    <button type="submit" className="bg-amber-600 hover:bg-amber-555 text-white px-3 py-1.5 rounded font-bold cursor-pointer">Gửi Đề Xuất</button>
                  </div>
                </form>
              </div>
            )}


            {/* TAB 1: DASHBOARD */}
            {activeSubTab === 'dashboard' && (
              <div className="space-y-6">
                
                {/* 3 Quick Overview Blocks */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                  
                  <div className="p-4 bg-emerald-950/20 rounded-xl border border-emerald-900/40 relative overflow-hidden">
                    <div className="absolute right-3 top-3 w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                      <ArrowDownRight className="w-5 h-5" />
                    </div>
                    <span className="text-emerald-400/90 text-[10px] font-bold uppercase tracking-wider block">THỰC THU DOANH THU</span>
                    <span className="text-xl font-black text-emerald-400 font-mono block mt-1.5">+{totalRevenueSum.toLocaleString('vi-VN')} đ</span>
                    <span className="text-[9.5px] text-slate-400 block mt-1">Từ {receipts.length} Biên nhận tạm ứng thợ mộc CĐT</span>
                  </div>

                  <div className="p-4 bg-rose-950/20 rounded-xl border border-rose-900/40 relative overflow-hidden">
                    <div className="absolute right-3 top-3 w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-450">
                      <ArrowUpRight className="w-5 h-5" />
                    </div>
                    <span className="text-rose-450/90 text-[10px] font-bold uppercase tracking-wider block">THỰC CHI CHI PHÍ</span>
                    <span className="text-xl font-black text-rose-500 font-mono block mt-1.5">-{totalExpenseSum.toLocaleString('vi-VN')} đ</span>
                    <span className="text-[9.5px] text-slate-400 block mt-1">Đã duyệt {payments.filter(p => p.status === 'approved').length} phiếu mua ván An Cường</span>
                  </div>

                  <div className="p-4 bg-sky-950/20 rounded-xl border border-sky-900/40 relative overflow-hidden">
                    <div className="absolute right-3 top-3 w-10 h-10 rounded-full bg-sky-500/10 flex items-center justify-center text-sky-400">
                      <Layers className="w-5 h-5" />
                    </div>
                    <span className="text-sky-400/90 text-[10px] font-bold uppercase tracking-wider block">SỐ NGÂN QUỸ THUẦN</span>
                    <span className={`text-xl font-black font-mono block mt-1.5 ${(totalRevenueSum - totalExpenseSum) >= 0 ? 'text-sky-400' : 'text-red-400'}`}>
                      {(totalRevenueSum - totalExpenseSum).toLocaleString('vi-VN')} đ
                    </span>
                    <span className="text-[9.5px] text-slate-400 block mt-1">Biên sạch: {totalRevenueSum > 0 ? Math.round(((totalRevenueSum - totalExpenseSum) / totalRevenueSum) * 100) : 0}%</span>
                  </div>

                </div>

                {/* Sub accounting stats */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  
                  {/* Plywood and Steel Stock Summary */}
                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                    <h3 className="font-extrabold text-white text-[11px] mb-3 uppercase tracking-wider text-orange-400">🚨 CẢNH BÁO TỒN KHO VẬT TƯ:</h3>
                    <div className="space-y-3.5">
                      {inventory.map(mat => {
                        const percentOfMax = Math.min((mat.qty / 500) * 100, 100);
                        const isLow = mat.qty <= mat.minAlert;
                        return (
                          <div key={mat.id} className="space-y-1">
                            <div className="flex justify-between text-[10px] font-medium text-slate-300">
                              <span className="truncate max-w-[180px]">{mat.name}</span>
                              <span className={`font-mono font-bold ${isLow ? 'text-rose-500 animate-pulse' : 'text-slate-400'}`}>
                                {mat.qty} {mat.unit} {isLow && '⚠️ TRÌNH THU MUA'}
                              </span>
                            </div>
                            <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                              <div className={`h-full ${isLow ? 'bg-rose-600' : 'bg-orange-500'}`} style={{ width: `${percentOfMax}%` }}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Profitability indicators */}
                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                    <h3 className="font-extrabold text-white text-[11px] uppercase tracking-wider text-teal-400">🔔 HOẠT ĐỘNG THU CHI MỚI NHẤT</h3>
                    <div className="space-y-2 text-[10px] max-h-[140px] overflow-y-auto">
                      {receipts.slice(0, 3).map(rec => (
                        <div key={rec.id} className="flex justify-between items-center p-1.5 border-b border-slate-850/50">
                          <span className="text-emerald-400 font-bold">{rec.code} (Thu)</span>
                          <span className="text-slate-400 truncate max-w-[150px]">{rec.notes}</span>
                          <span className="font-mono font-black text-emerald-400">+{rec.amount.toLocaleString('vi-VN')} đ</span>
                        </div>
                      ))}
                      {payments.slice(0, 3).map(pay => (
                        <div key={pay.id} className="flex justify-between items-center p-1.5 border-b border-slate-850/50">
                          <span className="text-rose-400 font-bold">{pay.code} (Chi)</span>
                          <span className="text-slate-400 truncate max-w-[150px]">{pay.notes}</span>
                          <span className="font-mono font-black text-rose-500">-{pay.amount.toLocaleString('vi-VN')} đ</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

              </div>
            )}


            {/* TAB 3: KHÁCH HÀNG */}
            {activeSubTab === 'du_lieu_ke_toan' && duLieuTab === 'khach_hang' && (() => {
              const filteredCustomers = customers.filter(c => {
                const matchSearch =
                  c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  (c.phone && c.phone.includes(searchTerm)) ||
                  c.id.toLowerCase().includes(searchTerm.toLowerCase());
                const matchType = customerTypeFilter === 'all' || (c.type || 'individual') === customerTypeFilter;
                return matchSearch && matchType;
              });

              const limitCust = pageSizeCust === -1 ? filteredCustomers.length : pageSizeCust;
              const startIndexCust = (pageCust - 1) * limitCust;
              const endIndexCust = startIndexCust + limitCust;
              const paginatedCustomers = filteredCustomers.slice(startIndexCust, endIndexCust);
              const totalPagesCust = Math.ceil(filteredCustomers.length / limitCust) || 1;

              return (
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                    <span className="font-bold text-slate-300 uppercase tracking-wide text-[11px]">
                      Sổ khách hàng ({filteredCustomers.length})
                    </span>

                    <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddCustomerModal(true)}
                      className="bg-orange-600 hover:bg-orange-550 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shadow-md"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Thêm KH Mới
                    </button>
                      <button
                        type="button"
                        onClick={handleExportCustomerExcel}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shadow-md"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Xuất Excel
                      </button>
                      <button
                        type="button"
                        onClick={() => customerFileInputRef.current?.click()}
                        className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shadow-md"
                      >
                        <FileUp className="w-3.5 h-3.5" />
                        Nhập Excel
                      </button>
                      <input
                        ref={customerFileInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={handleImportCustomerExcel}
                      />
                    </div>
                  </div>

                  {/* Filter: Loại khách hàng */}
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-slate-400 font-bold uppercase tracking-wide">Lọc theo loại:</span>
                    <select
                      value={customerTypeFilter}
                      onChange={(e) => setCustomerTypeFilter(e.target.value as 'all' | 'individual' | 'organization')}
                      className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none cursor-pointer focus:border-orange-500 font-bold"
                    >
                      <option value="all">Tất cả</option>
                      <option value="individual">Cá nhân</option>
                      <option value="organization">Tổ chức</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">

                    {/* Left Table Panel */}
                    <div className={`${selectedCustDetail ? 'xl:col-span-7' : 'xl:col-span-12'} space-y-4 transition-all duration-300`}>
                      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto shadow-xl">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-extrabold uppercase text-[10px] tracking-wider">
                              <th className="p-3 w-10 text-center">
                                <input
                                  type="checkbox"
                                  checked={custSelectedRows.size > 0 && paginatedCustomers.length > 0 && paginatedCustomers.every(c => custSelectedRows.has(c.id))}
                                  onChange={(e) => handleCustSelectAll(e.target.checked, paginatedCustomers)}
                                  className="w-4 h-4 text-amber-500 border-slate-600 rounded cursor-pointer accent-amber-500"
                                />
                              </th>
                              <th className="p-3 pl-4">Mã KH</th>
                              <th className="p-3">Tên Khách Hàng</th>
                              <th className="p-3">Địa Chỉ</th>
                              <th className="p-3">SĐT</th>
                              <th className="p-3 text-right">Công Nợ đầu kỳ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {paginatedCustomers.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="p-8 text-center text-slate-500 italic">
                                  Không tìm thấy khách hàng nào phù hợp.
                                </td>
                              </tr>
                            ) : (
                              paginatedCustomers.map(c => (
                                <tr
                                  key={c.id}
                                  onClick={() => setSelectedCustDetail(c)}
                                  className={`hover:bg-slate-800/40 cursor-pointer transition-colors ${
                                    custSelectedRows.has(c.id) ? 'bg-amber-500/10' : ''
                                  } ${
                                    selectedCustDetail?.id === c.id ? 'bg-orange-600/10 border-l-2 border-orange-500' : ''
                                  }`}
                                >
                                  {/* Select */}
                                  <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="checkbox"
                                      checked={custSelectedRows.has(c.id)}
                                      onChange={(e) => handleCustRowSelect(c.id, e.target.checked)}
                                      className="w-4 h-4 text-amber-500 border-slate-600 rounded cursor-pointer accent-amber-500"
                                    />
                                  </td>

                                  {/* Customer ID */}
                                  <td className="p-3 pl-4 font-mono font-bold text-orange-400 text-[10px] uppercase">
                                    {c.id}
                                  </td>

                                  {/* Customer Name */}
                                  <td className="p-3">
                                    <div className="font-extrabold text-white text-[12.5px]">
                                      {c.name}
                                    </div>
                                  </td>

                                  {/* Address */}
                                  <td className="p-3 text-slate-300">
                                    {c.address || '—'}
                                  </td>

                                  {/* Phone */}
                                  <td className="p-3 whitespace-nowrap font-mono text-slate-300">
                                    {c.phone || '—'}
                                  </td>

                                  {/* Opening Debt */}
                                  <td className="p-3 text-right font-mono font-bold text-amber-400">
                                    {(c.openingDebt || 0).toLocaleString('vi-VN')} đ
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      {custSelectedRows.size > 0 && (
                        <div className="bg-slate-950 px-4 py-2 border-t border-slate-850 flex items-center gap-2 text-[10px]">
                          <span className="text-amber-500 font-bold">Đã chọn: {custSelectedRows.size}</span>
                          <button
                            onClick={() => {
                              if (!window.confirm(`⚠️ Bạn có chắc chắn muốn xóa ${custSelectedRows.size} khách hàng đã chọn không?\nHành động này không thể hoàn tác.`)) return;
                              custSelectedRows.forEach(id => { if (onDeleteCustomer) onDeleteCustomer(id); });
                              addToast({ title: '✅ Đã xóa', message: `Đã xóa ${custSelectedRows.size} khách hàng.`, type: 'success' });
                              setCustSelectedRows(new Set());
                            }}
                            className="bg-rose-650 hover:bg-rose-600 text-white font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" /> Xóa
                          </button>
                          <button
                            onClick={() => setCustSelectedRows(new Set())}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
                          >
                            Hủy chọn
                          </button>
                        </div>
                      )}

                      {/* Pagination block */}
                      <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-900/60 p-3 rounded-xl border border-slate-800 gap-3 text-[11px] text-slate-400">
                        <div className="flex items-center gap-2">
                          <span>Số dòng hiển thị:</span>
                          <select
                            value={pageSizeCust}
                            onChange={(e) => {
                              setPageSizeCust(Number(e.target.value));
                              setPageCust(1);
                            }}
                            className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none cursor-pointer focus:border-orange-500 font-bold"
                          >
                            <option value={5}>5 dòng</option>
                            <option value={10}>10 dòng</option>
                            <option value={20}>20 dòng</option>
                            <option value={-1}>Tất cả</option>
                          </select>
                          <span>trong tổng số {filteredCustomers.length} dòng</span>
                        </div>

                        {pageSizeCust !== -1 && totalPagesCust > 1 && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={pageCust === 1}
                              onClick={() => setPageCust(prev => Math.max(prev - 1, 1))}
                              className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-slate-300 hover:text-white disabled:opacity-35 disabled:pointer-events-none font-bold transition-all cursor-pointer"
                            >
                              ◀ Trước
                            </button>
                            <span className="font-mono text-slate-300 px-1">
                              Trang {pageCust} / {totalPagesCust}
                            </span>
                            <button
                              type="button"
                              disabled={pageCust === totalPagesCust}
                              onClick={() => setPageCust(prev => Math.min(prev + 1, totalPagesCust))}
                              className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-slate-300 hover:text-white disabled:opacity-35 disabled:pointer-events-none font-bold transition-all cursor-pointer"
                            >
                              Sau ▶
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Detail Panel */}
                    {selectedCustDetail && (() => {
                      const linkedProjs = projects.filter(p => p.customerId === selectedCustDetail.id);
                      const totalVal = linkedProjs.reduce((s, p) => s + p.contractValue, 0);
                      return (
                        <div className="xl:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 sticky top-4 animate-scaleIn space-y-4">
                          <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                            <div>
                              <span className="font-mono text-[9px] text-orange-400 font-black uppercase tracking-wider">
                                {selectedCustDetail.id}
                              </span>
                              <h3 className="font-extrabold text-white text-sm mt-0.5 animate-pulse-once">
                                Chi tiết Hồ sơ khách hàng
                              </h3>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedCustDetail(null)}
                              className="text-slate-400 hover:text-white bg-slate-850 p-1.5 rounded-lg transition-colors cursor-pointer"
                              title="Đóng xem chi tiết"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="space-y-3.5 text-xs text-left">
                            <div className="p-3.5 bg-slate-950 rounded-xl space-y-2.5">
                              <div>
                                <span className="text-slate-500 block text-[9.5px] uppercase font-bold">Tên khách hàng</span>
                                <strong className="text-white text-md block font-extrabold">{selectedCustDetail.name}</strong>
                              </div>
                              <div>
                                <span className="text-slate-500 block text-[9.5px] uppercase font-bold">Người đại diện</span>
                                <span className="text-slate-350 font-bold block mt-0.5">{selectedCustDetail.representative || selectedCustDetail.name}</span>
                              </div>
                            </div>

                            <div className="p-3.5 bg-slate-950/45 border border-slate-850 rounded-xl space-y-2.5">
                              <div>
                                <span className="text-slate-500 block text-[9.5px] uppercase font-bold">📞 Số điện thoại</span>
                                <span className="text-slate-205 font-mono font-bold block mt-0.5">{selectedCustDetail.phone || 'Chưa cập nhật'}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block text-[9.5px] uppercase font-bold">📍 Địa chỉ bàn mộc</span>
                                <span className="text-slate-300 block mt-0.5 font-medium leading-relaxed">{selectedCustDetail.address || 'Trống'}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block text-[9.5px] uppercase font-bold">📄 Mã số thuế / CMND</span>
                                <span className="text-white font-mono font-bold block mt-0.5">{selectedCustDetail.taxOrIdNumber || 'Trống'}</span>
                              </div>
                            </div>

                            <div className="p-3.5 bg-orange-600/5 border border-orange-500/10 rounded-xl space-y-2">
                              <div className="flex justify-between text-[11px]">
                                <span className="text-slate-400">Số dự án thầu phí:</span>
                                <span className="font-mono font-extrabold text-white">{linkedProjs.length} dự án</span>
                              </div>
                              <div className="flex justify-between text-[11px]">
                                <span className="text-slate-400">Tổng giá trị hợp đồng:</span>
                                <span className="font-mono font-extrabold text-orange-400">{totalVal.toLocaleString('vi-VN')} đ</span>
                              </div>
                              <div className="flex justify-between text-[11px]">
                                <span className="text-slate-400">Công nợ đầu kỳ:</span>
                                <span className="font-mono font-extrabold text-amber-400">{(selectedCustDetail.openingDebt || 0).toLocaleString('vi-VN')} đ</span>
                              </div>
                            </div>

                            {selectedCustDetail.notes && (
                              <div className="p-3 bg-slate-950/20 border border-slate-800 rounded-xl italic text-slate-400 leading-normal">
                                {selectedCustDetail.notes}
                              </div>
                            )}
                          </div>

                          <div className="pt-3.5 border-t border-slate-800 flex justify-between items-center gap-2">
                            <div className="flex gap-1.5">
                              {selectedCustDetail.phone && (
                                <a
                                  href={`tel:${selectedCustDetail.phone}`}
                                  className="bg-emerald-600 hover:bg-emerald-550 text-white font-bold p-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow"
                                  title="Gọi điện liên hệ"
                                >
                                  <Phone className="w-3.5 h-3.5" />
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  if (!canEdit) {
                                    addToast({ title: '⛔ Không có quyền', message: 'Tài khoản của bạn không có quyền CHỈNH SỬA khách hàng.', type: 'error' });
                                    return;
                                  }
                                  setEditingCustId(selectedCustDetail.id);
                                  setCustName(selectedCustDetail.name);
                                  setCustPhone(selectedCustDetail.phone || '');
                                  setCustAddress(selectedCustDetail.address || '');
                                  setCustRep(selectedCustDetail.representative || selectedCustDetail.name);
                                  setCustTaxId(selectedCustDetail.taxOrIdNumber || '');
                                  setCustNotes(selectedCustDetail.notes || '');
                                  setCustOpeningDebt(selectedCustDetail.openingDebt || 0);
                                  setIsCustRepManuallyEdited(true);
                                  setShowAddCustomerModal(true);
                                }}
                                className={`p-2 rounded-lg transition-all ${canEdit ? 'bg-amber-950/40 hover:bg-amber-900/60 text-amber-400 border border-amber-900/30 cursor-pointer' : 'text-slate-600 border border-slate-850 cursor-not-allowed opacity-50'}`}
                                title="Sửa thông tin khách hàng"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!canDelete) {
                                    addToast({ title: '⛔ Không có quyền', message: 'Tài khoản của bạn không có quyền XÓA khách hàng.', type: 'error' });
                                    return;
                                  }
                                  const confirmDelete = window.confirm(
                                    `⚠️ CẢNH BÁO XÓA KHÁCH HÀNG!\n\nBạn có chắc chắn muốn xóa vĩnh viễn khách hàng:\n"${selectedCustDetail.name}" (Mã: ${selectedCustDetail.id})?\n\nThao tác này sẽ xóa sạch dữ liệu khách hàng này khỏi hệ thống quản lý tài chính và các thầu mộc liên kết.`
                                  );
                                  if (confirmDelete) {
                                    if (onDeleteCustomer) {
                                      onDeleteCustomer(selectedCustDetail.id);
                                      setSelectedCustDetail(null);
                                      addToast({ title: '✅ Thành công', message: `🗑️ Đã xóa thành công khách hàng.`, type: 'success' });
                                    } else {
                                      const index = customers.findIndex(item => item.id === selectedCustDetail.id);
                                      if (index !== -1) {
                                        customers.splice(index, 1);
                                        setSelectedCustDetail(null);
                                        addToast({ title: '✅ Thành công', message: '🗑️ Đã xóa thành công khách hàng (Local).', type: 'success' });
                                      }
                                    }
                                  }
                                }}
                                className={`p-2 rounded-lg transition-all ${canDelete ? 'bg-rose-900/30 hover:bg-rose-600 text-rose-450 hover:text-white cursor-pointer' : 'text-slate-600 border border-slate-850 cursor-not-allowed opacity-50'}`}
                                title="Xóa khách hàng này"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => setSelectedCustDetail(null)}
                              className="bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer"
                            >
                              Đóng chi tiết
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })()}

            {/* MODAL: THÊM / SỬA KHÁCH HÀNG */}
            {showAddCustomerModal && (
              <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-[9999] p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-slate-200 text-xs text-left animate-scaleIn">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-orange-500" />
                      <h3 className="font-extrabold text-white text-sm">
                        {editingCustId ? 'Cập nhật thông tin khách hàng' : 'Thêm Khách hàng mới'}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={handleCloseCustomerModal}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleCreateCustomerSubmit} className="space-y-3">
                    {/* Auto Generated Locked Code */}
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Mã khách hàng tự sinh (Khóa nhập liệu)</label>
                      <input
                        type="text"
                        disabled
                        value={editingCustId ? editingCustId : (custName ? `KH_${getAbbreviation(custName)}_${customers.length + 1}` : 'KH_[Initials]_[Index]')}
                        className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-orange-400 font-mono font-bold cursor-not-allowed outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-355 font-bold mb-1">Tên khách hàng <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        required
                        placeholder="Nhập họ tên đầy đủ..."
                        value={custName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustName(val);
                          if (!isCustRepManuallyEdited) {
                            setCustRep(val);
                          }
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white outline-none focus:border-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-355 font-bold mb-1">Người đại diện (Mặc định là Tên Khách hàng)</label>
                      <input
                        type="text"
                        placeholder="Nhập tên người đại diện..."
                        value={custRep}
                        onChange={(e) => {
                          setCustRep(e.target.value);
                          setIsCustRepManuallyEdited(true);
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white outline-none focus:border-orange-500 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-355 font-bold mb-1">Số điện thoại (* kiểu số)</label>
                      <input
                        type="text"
                        required
                        pattern="[0-9]*"
                        inputMode="numeric"
                        placeholder="ví dụ: 0912345678"
                        value={custPhone}
                        onChange={(e) => setCustPhone(e.target.value.replace(/[^0-9]/g, ''))}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white outline-none font-mono focus:border-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-355 font-bold mb-1">Địa chỉ</label>
                      <input
                        type="text"
                        placeholder="Địa chỉ liên hệ / Nhà thô thầu..."
                        value={custAddress}
                        onChange={(e) => setCustAddress(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white outline-none focus:border-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-355 font-bold mb-1">MST / CMND/CCCD (* kiểu số)</label>
                      <input
                        type="text"
                        pattern="[0-9]*"
                        inputMode="numeric"
                        placeholder="ví dụ: 0314456789"
                        value={custTaxId}
                        onChange={(e) => setCustTaxId(e.target.value.replace(/[^0-9]/g, ''))}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white outline-none font-mono focus:border-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-355 font-bold mb-1">Ghi chú lưu ý</label>
                      <textarea
                        rows={2}
                        placeholder="Thông tin ghi chú..."
                        value={custNotes}
                        onChange={(e) => setCustNotes(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none focus:border-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-355 font-bold mb-1">Công nợ đầu kỳ (VNĐ)</label>
                      <input
                        type="number"
                        min={0}
                        value={custOpeningDebt || ''}
                        onChange={(e) => setCustOpeningDebt(Number(e.target.value))}
                        placeholder="Công nợ đầu kỳ (nếu có)..."
                        className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none font-mono focus:border-orange-500"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={handleCloseCustomerModal}
                        className="bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold px-3 py-1.5 rounded cursor-pointer"
                      >
                        Hủy bỏ
                      </button>
                      <button
                        type="submit"
                        className="bg-orange-600 hover:bg-orange-550 text-white font-bold px-4 py-1.5 rounded cursor-pointer shadow-md"
                      >
                        Lưu thông tin
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* TAB: DANH MỤC SẢN PHẨM KẾ TOÁN */}
            {activeSubTab === 'du_lieu_ke_toan' && duLieuTab === 'danh_muc_san_pham' && (() => {
              const filteredAccProds = accProducts.filter(p => {
                const s = searchTerm.toLowerCase().trim();
                return s === '' || p.id.toLowerCase().includes(s) || p.tenSanPham.toLowerCase().includes(s);
              });
              const limitAP = pageSizeAccProd === -1 ? filteredAccProds.length : pageSizeAccProd;
              const startAP = (pageAccProd - 1) * limitAP;
              const paginatedAccProds = filteredAccProds.slice(startAP, startAP + limitAP);
              const totalPagesAP = Math.ceil(filteredAccProds.length / limitAP) || 1;

              return (
                <div className="space-y-4">
                  {/* Header + Action buttons */}
                  <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                    <span className="font-bold text-slate-300 uppercase tracking-wide text-[11px]">
                      Danh mục sản phẩm ({filteredAccProds.length})
                    </span>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { resetAccProdForm(); setAccProdFormMode('add'); setShowAccProdForm(true); }}
                        className="bg-orange-600 hover:bg-orange-550 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shadow-md">
                        <Plus className="w-3.5 h-3.5" /> Thêm SP
                      </button>
                      <button type="button" onClick={handleAccProdExportExcel}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shadow-md">
                        <Download className="w-3.5 h-3.5" /> Xuất Excel
                      </button>
                      <button type="button" onClick={() => accProdFileInputRef.current?.click()}
                        className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shadow-md">
                        <FileUp className="w-3.5 h-3.5" /> Nhập Excel
                      </button>
                      <input ref={accProdFileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleAccProdImportExcel} />
                    </div>
                  </div>

                  {/* Add / Edit Form Modal */}
                  {showAccProdForm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAccProdForm(false)}>
                      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-white font-extrabold text-sm uppercase tracking-wide">
                            {accProdFormMode === 'edit' ? `Sửa sản phẩm ${accProdEditId}` : 'Thêm sản phẩm mới'}
                          </h3>
                          <button onClick={() => { setShowAccProdForm(false); resetAccProdForm(); }}
                            className="text-slate-400 hover:text-white transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleAccProdSubmit} className="space-y-4">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 mb-1">Mã sản phẩm</label>
                            <input type="text" disabled value={accProdFormMode === 'edit' ? (accProdEditId || '') : '(Tự sinh)'}
                              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs cursor-not-allowed opacity-60" />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 mb-1">Tên sản phẩm <span className="text-red-400">*</span></label>
                            <input type="text" value={accProdTenSP} onChange={e => setAccProdTenSP(e.target.value)}
                              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:border-orange-500 focus:outline-none"
                              placeholder="Nhập tên sản phẩm..." autoFocus />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 mb-1">Đơn giá (đ)</label>
                            <input type="number" value={accProdDonGia} onChange={e => setAccProdDonGia(e.target.value)}
                              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:border-orange-500 focus:outline-none"
                              placeholder="0" min="0" />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 mb-1">Đơn vị tính</label>
                            <input type="text" value={accProdDonViTinh} onChange={e => setAccProdDonViTinh(e.target.value)}
                              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:border-orange-500 focus:outline-none"
                              placeholder="Cái, Mét, KG..." />
                          </div>
                          <div className="flex gap-2 justify-end pt-2">
                            <button type="button" onClick={() => { setShowAccProdForm(false); resetAccProdForm(); }}
                              className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition-colors">Hủy</button>
                            <button type="submit"
                              className="bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition-colors shadow-md">
                              {accProdFormMode === 'edit' ? 'Cập nhật' : 'Thêm mới'}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}

                  {/* Table */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-extrabold uppercase text-[10px] tracking-wider">
                            <th className="p-3 w-10 text-center">STT</th>
                            <th className="p-3 w-[120px]">Mã SP</th>
                            <th className="p-3">Tên sản phẩm</th>
                            <th className="p-3 w-[140px] text-right">Đơn giá (đ)</th>
                            <th className="p-3 w-[100px] text-center sticky right-0 bg-slate-950 z-10 shadow-[-3px_0_6px_rgba(0,0,0,0.3)] border-l border-slate-800">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedAccProds.length > 0 ? paginatedAccProds.map((p, idx) => (
                            <tr key={p.id} className={`border-b border-slate-800 hover:bg-slate-800/50 transition-colors ${idx % 2 === 1 ? 'bg-slate-900/50' : ''}`}>
                              <td className="p-3 text-center text-slate-500 text-[10px] font-mono">{startAP + idx + 1}</td>
                              <td className="p-3 font-mono font-bold text-orange-400 text-[11px]">{p.id}</td>
                              <td className="p-3 font-extrabold text-white text-[11px]">{p.tenSanPham}</td>
                              <td className="p-3 text-right font-mono text-emerald-400 text-[11px]">{p.donGia.toLocaleString('vi-VN')}</td>
                              <td className="p-3 text-center sticky right-0 bg-slate-900/95 z-10 shadow-[-3px_0_6px_rgba(0,0,0,0.3)] border-l border-slate-800">
                                <div className="flex items-center justify-center gap-1">
                                  <button onClick={() => handleAccProdEdit(p)} title="Sửa"
                                    className="p-1.5 text-sky-400 hover:text-sky-300 hover:bg-sky-950 rounded-lg transition-colors cursor-pointer"><Edit className="w-3.5 h-3.5" /></button>
                                  {accProdDeleteId === p.id ? (
                                    <div className="flex items-center gap-1">
                                      <button onClick={() => handleAccProdDelete(p.id)} title="Xác nhận xóa"
                                        className="p-1.5 text-red-400 hover:text-red-300 bg-red-950 rounded-lg transition-colors cursor-pointer"><Check className="w-3.5 h-3.5" /></button>
                                      <button onClick={() => setAccProdDeleteId(null)} title="Hủy"
                                        className="p-1.5 text-slate-400 hover:text-slate-300 rounded-lg transition-colors cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                                    </div>
                                  ) : (
                                    <button onClick={() => setAccProdDeleteId(p.id)} title="Xóa"
                                      className="p-1.5 text-red-500/60 hover:text-red-400 hover:bg-red-950 rounded-lg transition-colors cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )) : (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-500 text-xs">Chưa có sản phẩm nào. Nhấn "Thêm SP" hoặc "Nhập Excel" để bắt đầu.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    {/* Pagination */}
                    {filteredAccProds.length > 0 && (
                      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-950">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-500 font-bold">Hiển thị:</span>
                          <select value={pageSizeAccProd} onChange={e => { setPageSizeAccProd(Number(e.target.value)); setPageAccProd(1); }}
                            className="bg-slate-800 text-[10px] font-bold text-orange-400 border border-slate-700 rounded px-2 py-1 cursor-pointer outline-none">
                            <option value={5} className="bg-slate-900">5</option>
                            <option value={10} className="bg-slate-900">10</option>
                            <option value={20} className="bg-slate-900">20</option>
                            <option value={50} className="bg-slate-900">50</option>
                            <option value={-1} className="bg-slate-900">Tất cả</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <button disabled={pageAccProd <= 1} onClick={() => setPageAccProd(p => p - 1)}
                            className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                          <span className="text-[10px] text-slate-400 font-bold">{pageAccProd}/{totalPagesAP}</span>
                          <button disabled={pageAccProd >= totalPagesAP} onClick={() => setPageAccProd(p => p + 1)}
                            className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"><ChevronRight className="w-4 h-4" /></button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* TAB 4: DANH SÁCH THẦU PHỤ (bảng riêng accounting_subcontractors) */}
            {activeSubTab === 'du_lieu_ke_toan' && duLieuTab === 'ncc_thau_phu' && (
              <SubcontractorDirectory
                currentUser={currentUser}
                canEdit={canEdit}
                canDelete={canDelete}
              />
            )}

            {/* TAB 4.5: NHÀ CUNG CẤP VẬT TƯ (bảng suppliers) */}
            {activeSubTab === 'du_lieu_ke_toan' && duLieuTab === 'nha_cung_cap_vat_tu' && (
              <WarehouseSuppliers />
            )}

            {/* TAB 6: VẬT TƯ */}
            {(activeSubTab === 'vat_tu' || (activeSubTab === 'du_lieu_ke_toan' && duLieuTab === 'vat_tu')) && (
              <div className="space-y-4">
                
                <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                  <span className="font-bold text-slate-300 uppercase tracking-wide text-[11px]">Sổ Kho Phân Bổ Nguyên Nguyên Vật tư gỗ MDF An Cường</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!canCreate) {
                        addToast({ title: '⛔ Không có quyền', message: 'Tài khoản của bạn không có quyền KHỞI TẠO nguyên vật tư mới.', type: 'error' });
                        return;
                      }
                      setShowMaterialForm(!showMaterialForm);
                    }}
                    className={`font-bold text-[10px] px-2.5 py-1 rounded transition-colors ${canCreate ? 'bg-orange-600 hover:bg-orange-550 text-white cursor-pointer' : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'}`}
                  >
                    + Nạp thêm vào kho
                  </button>
                </div>

                {showMaterialForm && (
                  <form onSubmit={handleAddMaterialSubmit} className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3 text-[10.5px]">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Mã vật tư:</label>
                        <input
                          type="text"
                          required
                          value={formMatCode}
                          onChange={(e) => setFormMatCode(e.target.value)}
                          placeholder="MDF-AC-24"
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Tên nguyên vật tư:</label>
                        <input
                          type="text"
                          required
                          value={formMatName}
                          onChange={(e) => setFormMatName(e.target.value)}
                          placeholder="Ván mộc Melamine chống sặc 24mm"
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Đơn vị đo:</label>
                        <input
                          type="text"
                          value={formMatUnit}
                          onChange={(e) => setFormMatUnit(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Số lượng nhập:</label>
                        <input
                          type="number"
                          required
                          value={formMatQty}
                          onChange={(e) => setFormMatQty(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Đơn giá thô (VND):</label>
                        <input
                          type="number"
                          required
                          value={formMatPrice}
                          onChange={(e) => setFormMatPrice(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Địa điểm Kho lưu trữ trữ:</label>
                        <input
                          type="text"
                          value={formMatLocation}
                          onChange={(e) => setFormMatLocation(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button type="button" onClick={() => setShowMaterialForm(false)} className="bg-slate-850 px-2.5 py-1 rounded text-slate-300">Hủy</button>
                      <button type="submit" className="bg-orange-600 hover:bg-orange-550 text-white px-3 py-1 rounded font-bold">Nạp thêm</button>
                    </div>
                  </form>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-slate-300 text-[10.5px]">
                    <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                      <tr>
                        <th className="w-10 px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={matSelectedRows.size > 0 && inventory.length > 0 && inventory.every(m => matSelectedRows.has(m.id))}
                            onChange={(e) => handleMatSelectAll(e.target.checked, inventory)}
                            className="w-4 h-4 text-amber-500 border-slate-600 rounded cursor-pointer accent-amber-500"
                          />
                        </th>
                        <th className="px-3 py-2">Mã VT</th>
                        <th className="px-3 py-2">Tên vật liệu gỗ dán thùng vách</th>
                        <th className="px-3 py-2">Địa điểm lưu xưởng</th>
                        <th className="px-3 py-2 text-right">Số lượng tồn</th>
                        <th className="px-3 py-2 text-right">Giá trị thô ước tính</th>
                        <th className="px-3 py-2 text-center">Trạng thái kho</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventory.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-8 text-center text-slate-500 italic">Chưa có vật tư nào trong kho.</td>
                        </tr>
                      ) : inventory.map((mat) => {
                        const isLow = mat.qty <= mat.minAlert;
                        return (
                          <tr key={mat.id} className={`border-b border-slate-850/80 hover:bg-slate-900/40 ${matSelectedRows.has(mat.id) ? 'bg-amber-500/10' : ''}`}>
                            <td className="px-3 py-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={matSelectedRows.has(mat.id)}
                                onChange={(e) => handleMatRowSelect(mat.id, e.target.checked)}
                                className="w-4 h-4 text-amber-500 border-slate-600 rounded cursor-pointer accent-amber-500"
                              />
                            </td>
                            <td className="px-3 py-2.5 font-mono font-bold text-orange-400">{mat.code}</td>
                            <td className="px-3 py-2.5 font-semibold text-slate-100">{mat.name}</td>
                            <td className="px-3 py-2.5 italic text-slate-450">{mat.location}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-extrabold text-slate-100">{mat.qty} {mat.unit}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-slate-400">{(mat.qty * mat.unitPrice).toLocaleString('vi-VN')} đ</td>
                            <td className="px-3 py-2.5 text-center">
                              {isLow ? (
                                <span className="bg-rose-500/15 text-rose-450 text-[8.5px] px-1 py-0.5 rounded border border-rose-500/20 font-bold uppercase animate-pulse">Sắp hết hàng</span>
                              ) : (
                                <span className="bg-emerald-500/10 text-emerald-400 text-[8.5px] px-1 py-0.5 rounded font-mono uppercase">Lượng an toàn</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {matSelectedRows.size > 0 && (
                  <div className="bg-slate-950 px-4 py-2 border-t border-slate-850 flex items-center gap-2 text-[10px]">
                    <span className="text-amber-500 font-bold">Đã chọn: {matSelectedRows.size}</span>
                    <button
                      onClick={() => {
                        if (!window.confirm(`⚠️ Bạn có chắc chắn muốn xóa ${matSelectedRows.size} vật tư đã chọn không?\nHành động này không thể hoàn tác.`)) return;
                        const idsToDelete = matSelectedRows;
                        setInventory(inventory.filter(m => !idsToDelete.has(m.id)));
                        if (onDeleteMaterial) idsToDelete.forEach(id => onDeleteMaterial(id));
                        addToast({ title: '✅ Đã xóa', message: `Đã xóa ${matSelectedRows.size} vật tư.`, type: 'success' });
                        setMatSelectedRows(new Set());
                      }}
                      className="bg-rose-650 hover:bg-rose-600 text-white font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Xóa
                    </button>
                    <button
                      onClick={() => setMatSelectedRows(new Set())}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
                    >
                      Hủy chọn
                    </button>
                  </div>
                )}
              </div>
            )}

                  {/* View Order Detail Modal */}
                  {soViewOrder && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setSoViewOrder(null)}>
                      <div className="bg-white border border-slate-300 rounded-xl shadow-2xl w-full max-w-3xl p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-slate-900 font-extrabold text-sm uppercase tracking-wide">Chi tiết đơn hàng {soViewOrder.id === 'PREVIEW' ? '(Xem trước)' : soViewOrder.id}</h3>
                          <button onClick={() => setSoViewOrder(null)} className="text-slate-500 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-3 text-[11px]">
                          <div className="grid grid-cols-2 gap-3 bg-slate-100 rounded-lg p-3">
                            <div><span className="text-slate-600 font-bold">Mã ĐH:</span> <span className="text-slate-900 font-mono">{soViewOrder.id}</span></div>
                            <div><span className="text-slate-600 font-bold">Ngày tạo:</span> <span className="text-slate-900">{soViewOrder.createdAt?.split('T')[0]}</span></div>
                            <div><span className="text-slate-600 font-bold">Khách hàng:</span> <span className="text-slate-900">{soViewOrder.customerName}</span></div>
                            <div><span className="text-slate-600 font-bold">SĐT:</span> <span className="text-slate-900">{soViewOrder.customerPhone}</span></div>
                            <div className="col-span-2"><span className="text-slate-600 font-bold">Địa chỉ:</span> <span className="text-slate-900">{soViewOrder.customerAddress}</span></div>
                          </div>
                          <table className="w-full text-[10px] border-collapse bg-white rounded-lg overflow-hidden border border-slate-200">
                            <thead>
                              <tr className="bg-slate-100 text-slate-600 font-extrabold uppercase text-[9px]">
                                <th className="px-3 py-2 text-center">STT</th>
                                <th className="px-3 py-2 text-left">Sản phẩm</th>
                                <th className="px-3 py-2 text-center">ĐV</th>
                                <th className="px-3 py-2 text-right">SL</th>
                                <th className="px-3 py-2 text-right">Đơn giá</th>
                                <th className="px-3 py-2 text-right">Thành tiền</th>
                              </tr>
                            </thead>
                            <tbody>
                              {soViewOrder.items.map((item, idx) => (
                                <tr key={idx} className="border-t border-slate-200">
                                  <td className="px-3 py-2 text-center text-slate-500">{item.stt}</td>
                                  <td className="px-3 py-2 text-slate-900">{item.tenSanPham}</td>
                                  <td className="px-3 py-2 text-center text-slate-600">{item.donViTinh}</td>
                                  <td className="px-3 py-2 text-right text-slate-600">{item.soLuong}</td>
                                  <td className="px-3 py-2 text-right text-slate-600">{item.donGia.toLocaleString('vi-VN')}</td>
                                  <td className="px-3 py-2 text-right font-mono text-emerald-600">{item.thanhTien.toLocaleString('vi-VN')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="bg-slate-100 rounded-lg p-3 space-y-1">
                            <div className="flex justify-between"><span className="text-slate-600 font-bold">Tổng tiền:</span><span className="text-slate-900 font-extrabold font-mono">{soViewOrder.tongTien.toLocaleString('vi-VN')} ₫</span></div>
                            <div className="flex justify-between"><span className="text-slate-600 font-bold">Đã thanh toán:</span><span className="text-emerald-600 font-mono">{soViewOrder.thanhToanThucTe.toLocaleString('vi-VN')} ₫</span></div>
                            <div className="flex justify-between"><span className="text-red-600 font-bold">Công nợ:</span><span className="text-red-600 font-extrabold font-mono">{soViewOrder.congNo.toLocaleString('vi-VN')} ₫</span></div>
                          </div>
                          {soViewOrder.notes && <div className="bg-slate-100 rounded-lg p-3"><span className="text-slate-600 font-bold">Ghi chú:</span> <span className="text-slate-900">{soViewOrder.notes}</span></div>}
                        </div>
                        <div className="pt-4 flex gap-2 justify-end">
                          <button onClick={() => window.print()} className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer flex items-center gap-2">
                            <Printer className="w-4 h-4" /> In đơn hàng
                          </button>
                          <button onClick={() => setSoViewOrder(null)} className="bg-slate-600 hover:bg-slate-500 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer">Đóng</button>
                        </div>
                      </div>
                    </div>
                  )}
            {/* TAB 7: NHẬP THU */}
            {activeSubTab === 'nhap_thu' && (
              <div className="space-y-4">
                
                <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                  <span className="font-bold text-slate-300 uppercase tracking-widest text-[11px]">Danh sách các khoản thu</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const data = receipts.map(rec => ({
                          'Mã Phiếu Thu': rec.code,
                          'Ngày lập sổ': rec.date,
                          'Công trình': projects.find(p => p.id === rec.projectId)?.name || 'Văn phòng',
                          'Chú giải': rec.notes,
                          'Tổng thực thu': rec.amount,
                          'Hình thức': rec.paymentMethod === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt',
                          'Người thu': rec.collector || '',
                        }));
                        exportToExcel(data, 'NhapThu', `Nhap_Thu_${formatDateForFile()}.xlsx`, undefined, [...EXCEL_HEADERS.receipt]);
                        addToast({ title: '✅ Xuất Excel', message: `Đã xuất ${data.length} phiếu thu`, type: 'success' });
                      }}
                      className="bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-[10px] px-2.5 py-1.5 rounded flex items-center gap-1 cursor-pointer border border-slate-700"
                      title="Xuất Excel phiếu thu"
                    >
                      <Download className="w-3 h-3 text-blue-400" />
                      Xuất Excel
                    </button>
                    <label
                      className="bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-[10px] px-2.5 py-1.5 rounded flex items-center gap-1 cursor-pointer border border-slate-700"
                      title="Nhập Excel phiếu thu"
                    >
                      <FileUp className="w-3 h-3 text-emerald-400" />
                      Nhập Excel
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (!canCreate) {
                            addToast({ title: '⛔ Không có quyền', message: 'Tài khoản của bạn không có quyền NHẬP phiếu thu.', type: 'error' });
                            return;
                          }
                          try {
                            addToast({ title: '⏳ Đang xử lý...', message: 'Đang đọc file Excel...', type: 'info' });
                            const rows = await importFromExcel(file, (row, idx) => {
                              const code = String(row['Mã Phiếu Thu'] || row['Code'] || '').trim();
                              const date = String(row['Ngày lập sổ'] || row['Date'] || '').trim();
                              const customerName = String(row['Chủ đầu tư chi trả'] || row['Customer'] || '').trim();
                              const projectName = String(row['Công trình thầu liên kế'] || row['Project'] || '').trim();
                              const notes = String(row['Giải nghĩa chi tiết phiếu thu'] || row['Notes'] || row['Chú giải'] || '').trim();
                              const amount = Number(String(row['Tổng thực thu'] || row['Amount'] || '0').replace(/[^\d.-]/g, '')) || 0;
                              const paymentMethod = String(row['Hình thức thanh toán thầu'] || row['Payment Method'] || 'cash').trim().toLowerCase();
                              const collector = String(row['Người thu'] || row['Collector'] || currentUser?.name || '').trim();
                              const customerId = customers.find(c => c.name === customerName)?.id || `customer_${Date.now()}_${idx}`;
                              const projectId = projects.find(p => p.name === projectName)?.id || (projectName && projectName !== 'Văn phòng' ? `project_${Date.now()}_${idx}` : undefined);

                              return {
                                id: `rec_import_${Date.now()}_${idx}`,
                                code,
                                date,
                                customerId,
                                projectId,
                                amount,
                                paymentMethod: paymentMethod === 'chuyển khoản' || paymentMethod === 'transfer' || paymentMethod === 'bank' ? 'transfer' : 'cash',
                                notes,
                                collector,
                                attachmentName: '',
                              } as Receipt;
                            });
                            const validRows = rows.filter(r => r.code && r.date && r.customerId && r.amount > 0);
                            if (validRows.length === 0) {
                              addToast({ title: '⚠️ Không hợp lệ', message: 'Không tìm thấy cột mã, ngày, khách hàng hoặc số tiền hợp lệ. Dữ liệu bị bỏ qua.', type: 'warning' });
                              return;
                            }
                            // Kiểm tra và tạo khách hàng thiếu
                            const missingCustomers = validRows.filter(r => !customers.find(c => c.id === r.customerId));
                            if (missingCustomers.length > 0) {
                              // Map lại customerId nếu找不到对应的客户
                              validRows.forEach(row => {
                                const matched = customers.find(c => c.name === (row.customerId.includes('customer_') ? `Khách hàng ${row.customerId.split('_').pop()}` : row.customerId));
                                if (matched) row.customerId = matched.id;
                              });
                            }
                            validRows.forEach(r => onAddReceipt(r));
                            addToast({ title: '✅ Nhập thành công', message: `Đã import ${validRows.length} phiếu thu từ Excel`, type: 'success' });
                          } catch (err) {
                            addToast({ title: '❌ Lỗi', message: 'Không thể đọc hoặc xử lý file Excel.', type: 'error' });
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (!canCreate) {
                          addToast({ title: '⛔ Không có quyền', message: 'Tài khoản của bạn không có quyền KHỞI TẠO phiếu thu.', type: 'error' });
                          return;
                        }
                        setShowRecForm(!showRecForm);
                      }}
                      className={`font-bold text-[10px] px-2.5 py-1.5 rounded flex items-center gap-1 transition-colors ${canCreate ? 'bg-emerald-600 hover:bg-emerald-555 text-white cursor-pointer' : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Lập phiếu thu mới
                    </button>
                  </div>
                </div>

                {showRecForm && (
                  <div className="fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowRecForm(false)}>
                    <form
                      onSubmit={handleAddReceiptSubmit}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 space-y-3 text-[10.5px] shadow-2xl max-h-[90vh] overflow-y-auto"
                    >
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-1">
                        <h3 className="font-extrabold text-sm uppercase tracking-wide text-emerald-400 flex items-center gap-2">
                          <Plus className="w-4 h-4" />
                          Lập Phiếu Thu Mới
                        </h3>
                        <button type="button" onClick={() => setShowRecForm(false)} className="text-slate-400 hover:text-white cursor-pointer bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">Số tiền thực tế thu (VND):</label>
                          <input
                            type="number"
                            required
                            value={recAmount}
                            onChange={(e) => setRecAmount(Number(e.target.value))}
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">Chủ đầu tư chi trả:</label>
                          <select
                            value={recCust}
                            onChange={(e) => setRecCust(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white cursor-pointer font-bold"
                          >
                            {customers.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">Dự án thầu liên kế:</label>
                          <select
                            value={recProj}
                            onChange={(e) => setRecProj(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white cursor-pointer font-medium"
                          >
                            {projects.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">Hình thức thanh toán thầu:</label>
                          <select
                            value={recMethod}
                            onChange={(e) => setRecMethod(e.target.value as 'cash' | 'transfer')}
                            className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white cursor-pointer font-bold"
                          >
                            <option value="transfer">Chuyển khoản Ngân hàng (MBBank/VCB)</option>
                            <option value="cash">Tiền mặt thủ quỹ xưởng mộc</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Giải nghĩa chi tiết phiếu thu:</label>
                        <input
                          type="text"
                          required
                          value={recNotes}
                          onChange={(e) => setRecNotes(e.target.value)}
                          placeholder="Khách tạm ứng 30% tiền gỗ ván..."
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                        <button type="button" onClick={() => setShowRecForm(false)} className="bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded text-slate-300 cursor-pointer">Bỏ qua</button>
                        <button type="submit" className="bg-emerald-600 hover:bg-emerald-555 text-white px-3 py-1.5 rounded font-bold cursor-pointer">In & Lưu Phiếu Thu</button>
                      </div>
                    </form>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-slate-300 text-[10.5px]">
                    <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                      <tr>
                        <th className="w-10 px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={recSelectedRows.size > 0 && receipts.length > 0 && receipts.every(r => recSelectedRows.has(r.id))}
                            onChange={(e) => handleRecSelectAll(e.target.checked, receipts)}
                            className="w-4 h-4 text-emerald-500 border-slate-600 rounded cursor-pointer accent-emerald-500"
                          />
                        </th>
                        <th className="px-3 py-2">Mã Phiếu Thu</th>
                        <th className="px-3 py-2">Ngày lập sổ</th>
                        <th className="px-3 py-2">Công trình liên đới</th>
                        <th className="px-3 py-2">Chú giải</th>
                        <th className="px-3 py-2 text-right">Tổng thực thu</th>
                        <th className="px-3 py-2 text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receipts.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-8 text-center text-slate-500 italic">Chưa có phiếu thu nào.</td>
                        </tr>
                      ) : receipts.map((rec) => {
                        const projName = projects.find(p => p.id === rec.projectId)?.name || 'Văn phòng';
                        return (
                          <tr key={rec.id} className={`border-b border-slate-850/80 hover:bg-slate-900/40 ${recSelectedRows.has(rec.id) ? 'bg-emerald-500/10' : ''}`}>
                            <td className="px-3 py-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={recSelectedRows.has(rec.id)}
                                onChange={(e) => handleRecRowSelect(rec.id, e.target.checked)}
                                className="w-4 h-4 text-emerald-500 border-slate-600 rounded cursor-pointer accent-emerald-500"
                              />
                            </td>
                            <td className="px-3 py-2.5 font-mono font-bold text-emerald-400">{rec.code}</td>
                            <td className="px-3 py-2.5">{rec.date}</td>
                            <td className="px-3 py-2.5 font-bold text-slate-100 truncate max-w-[200px]">{projName}</td>
                            <td className="px-3 py-2.5 text-slate-450 truncate max-w-[220px]">{rec.notes}</td>
                            <td className="px-3 py-2.5 text-right font-bold text-emerald-400 font-mono">+{rec.amount.toLocaleString('vi-VN')} đ</td>
                            <td className="px-3 py-2.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => {
                                    // Open receipt detail/print modal
                                    const so = receipts.find(r => r.id === rec.id)?.salesOrderId;
                                    if (so) {
                                      const order = salesOrders.find(o => o.id === so);
                                      if (order) setSoViewOrder(order);
                                    }
                                  }}
                                  title="Xem đơn hàng"
                                  className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-950 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    // Print receipt PDF
                                    window.open(`/receipt-print/${rec.code}`, '_blank');
                                  }}
                                  title="In phiếu thu PDF"
                                  className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {recSelectedRows.size > 0 && (
                  <div className="bg-slate-950 px-4 py-2 border-t border-slate-850 flex items-center gap-2 text-[10px]">
                    <span className="text-emerald-500 font-bold">Đã chọn: {recSelectedRows.size}</span>
                    <button
                      onClick={() => {
                        if (!window.confirm(`⚠️ Bạn có chắc chắn muốn xóa ${recSelectedRows.size} phiếu thu đã chọn không?\nHành động này không thể hoàn tác.`)) return;
                        const idsToDelete = recSelectedRows;
                        idsToDelete.forEach(id => { if (onDeleteReceipt) onDeleteReceipt(id); });
                        addToast({ title: '✅ Đã xóa', message: `Đã xóa ${recSelectedRows.size} phiếu thu.`, type: 'success' });
                        setRecSelectedRows(new Set());
                      }}
                      className="bg-rose-650 hover:bg-rose-600 text-white font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Xóa
                    </button>
                    <button
                      onClick={() => setRecSelectedRows(new Set())}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
                    >
                      Hủy chọn
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 8: NHẬP CHI */}
            {activeSubTab === 'nhap_chi' && (
              <div className="space-y-4">
                
                <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                  <span className="font-bold text-slate-300 uppercase tracking-widest text-[11px]">Danh sách các khoản chi</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const data = payments.map(pay => ({
                          'Mã Phiếu Chi': pay.code,
                          'Nhóm gốc chi': pay.category,
                          'Nạn thầu nhận': pay.recipient,
                          'Tổng thực chi': pay.amount,
                          'Trạng thái duyệt': pay.status === 'approved' ? 'Đã duyệt' : pay.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt',
                          'Ghi chú': pay.notes,
                        }));
                        exportToExcel(data, 'NhapChi', `Nhap_Chi_${formatDateForFile()}.xlsx`, undefined, [...EXCEL_HEADERS.payment]);
                        addToast({ title: '✅ Xuất Excel', message: `Đã xuất ${data.length} phiếu chi`, type: 'success' });
                      }}
                      className="bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-[10px] px-2.5 py-1.5 rounded flex items-center gap-1 cursor-pointer border border-slate-700"
                      title="Xuất Excel phiếu chi"
                    >
                      <Download className="w-3 h-3 text-blue-400" />
                      Xuất Excel
                    </button>
                    <label
                      className="bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-[10px] px-2.5 py-1.5 rounded flex items-center gap-1 cursor-pointer border border-slate-700"
                      title="Nhập Excel phiếu chi"
                    >
                      <FileUp className="w-3 h-3 text-emerald-400" />
                      Nhập Excel
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (!canCreate) {
                            addToast({ title: '⛔ Không có quyền', message: 'Tài khoản của bạn không có quyền NHẬP phiếu chi.', type: 'error' });
                            return;
                          }
                          try {
                            addToast({ title: '⏳ Đang xử lý...', message: 'Đang đọc file Excel...', type: 'info' });
                            const rows = await importFromExcel(file, (row, idx) => {
                              const code = String(row['Mã Phiếu Chi'] || row['Code'] || '').trim();
                              const category = String(row['Nhóm gốc chi'] || row['Category'] || 'other').trim();
                              const recipient = String(row['Nạn thầu nhận'] || row['Người nhận tiền'] || row['Recipient'] || '').trim();
                              const amount = Number(String(row['Tổng thực chi'] || row['Số tiền'] || row['Amount'] || '0').replace(/[^\d.-]/g, '')) || 0;
                              const status = String(row['Trạng thái duyệt'] || row['Status'] || 'pending').trim();
                              const notes = String(row['Ghi chú'] || row['Notes'] || '').trim();
                              const paymentMethod = String(row['Hình thức thanh toán'] || row['Payment Method'] || 'transfer').trim().toLowerCase();
                              const projectName = String(row['Dự án'] || row['Project'] || '').trim();
                              const projectId = projects.find(p => p.name === projectName)?.id || (projectName ? `project_${Date.now()}_${idx}` : undefined);

                              // Map Vietnamese status to English
                              let mappedStatus: 'pending' | 'approved' | 'rejected' = 'pending';
                              if (status === 'Đã duyệt' || status === 'approved') mappedStatus = 'approved';
                              else if (status === 'Từ chối' || status === 'rejected') mappedStatus = 'rejected';

                              return {
                                id: `pay_import_${Date.now()}_${idx}`,
                                code,
                                date: row['Ngày lập sổ'] ? String(row['Ngày lập sổ']).trim() : new Date().toISOString().split('T')[0],
                                recipient,
                                projectId,
                                category,
                                amount,
                                paymentMethod: paymentMethod === 'tiền mặt' || paymentMethod === 'cash' ? 'cash' : 'transfer',
                                notes,
                                proposer: currentUser?.name || '',
                                approver: 'Trương Hữu Long (Giám đốc)',
                                status: mappedStatus,
                                attachmentName: '',
                              } as Payment;
                            });
                            const validRows = rows.filter(r => r.code && r.recipient && r.amount > 0);
                            if (validRows.length === 0) {
                              addToast({ title: '⚠️ Không hợp lệ', message: 'Không tìm thấy cột mã, người nhận tiền hoặc số tiền hợp lệ. Dữ liệu bị bỏ qua.', type: 'warning' });
                              return;
                            }
                            validRows.forEach(r => onAddPayment(r));
                            addToast({ title: '✅ Nhập thành công', message: `Đã import ${validRows.length} phiếu chi từ Excel`, type: 'success' });
                          } catch (err) {
                            addToast({ title: '❌ Lỗi', message: 'Không thể đọc hoặc xử lý file Excel.', type: 'error' });
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (!canCreate) {
                          addToast({ title: '⛔ Không có quyền', message: 'Tài khoản của bạn không có quyền KHỞI TẠO đề xuất chi.', type: 'error' });
                          return;
                        }
                        setShowPayForm(!showPayForm);
                      }}
                      className={`font-bold text-[10px] px-2.5 py-1.5 rounded flex items-center gap-1 transition-colors ${canCreate ? 'bg-rose-600 hover:bg-rose-555 text-white cursor-pointer' : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Tạo đề xuất chi mới
                    </button>
                  </div>
                </div>

                {showPayForm && (
                  <div className="fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowPayForm(false)}>
                    <form
                      onSubmit={handleAddPaymentSubmit}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 space-y-3 text-[10.5px] shadow-2xl max-h-[90vh] overflow-y-auto"
                    >
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-1">
                        <h3 className="font-extrabold text-sm uppercase tracking-wide text-rose-400 flex items-center gap-2">
                          <Plus className="w-4 h-4" />
                          Tạo Đề Xuất Chi Mới
                        </h3>
                        <button type="button" onClick={() => setShowPayForm(false)} className="text-slate-400 hover:text-white cursor-pointer bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Hạng mục chi phí:</label>
                        <select
                          value={payCategory}
                          onChange={(e) => {
                            const val = e.target.value as any;
                            setPayCategory(val);
                            setPayRecipient('');
                            setRecipientSearch('');
                          }}
                          className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white cursor-pointer font-bold"
                        >
                          <option value="salary_advance">Ứng Lương Nhân Sự</option>
                          <option value="subcontractor_advance">Tạm ứng Thầu Phụ</option>
                          <option value="site_expense">Chi tiêu công trình</option>
                          <option value="salary">Lương Thưởng</option>
                          <option value="supplier_payment">Thanh Toán Nhà Cung Cấp</option>
                          <option value="other">Chi tiêu khác</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">Số tiền thanh toán (VND):</label>
                          <input
                            type="number"
                            required
                            value={payAmount}
                            onChange={(e) => setPayAmount(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white font-mono font-bold"
                          />
                        </div>
                        <div className="relative">
                          <label className="block text-slate-400 font-semibold mb-1">Người nhận tiền:</label>
                          <div className="relative">
                            <input
                              type="text"
                              required
                              placeholder={
                                payCategory === 'subcontractor_advance' ? "Chọn thầu phụ..." :
                                payCategory === 'supplier_payment' ? "Chọn nhà cung cấp..." :
                                (payCategory === 'site_expense' || payCategory === 'salary') ? "Chọn nhân viên..." :
                                "Nhập người nhận..."
                              }
                              value={payRecipient}
                              onChange={(e) => {
                                setPayRecipient(e.target.value);
                                setRecipientSearch(e.target.value);
                                setShowRecipientDropdown(true);
                              }}
                              onFocus={() => {
                                setRecipientSearch(payRecipient);
                                setShowRecipientDropdown(true);
                              }}
                              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white pr-8"
                            />
                            <button
                              type="button"
                              onClick={() => setShowRecipientDropdown(!showRecipientDropdown)}
                              className="absolute right-2 top-1.5 text-slate-400 hover:text-white"
                            >
                              <Search className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Back drop to close dropdown */}
                          {showRecipientDropdown && (
                            <div
                              className="fixed inset-0 z-[190] bg-transparent cursor-default"
                              onClick={() => setShowRecipientDropdown(false)}
                            />
                          )}

                          {/* Dropdown list of choices */}
                          {showRecipientDropdown && (
                            <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-slate-950 border border-slate-800 rounded-lg shadow-2xl z-[200] divide-y divide-slate-900">
                              {getRecipientChoices().map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => {
                                    setPayRecipient(item.name);
                                    setRecipientSearch(item.name);
                                    setShowRecipientDropdown(false);
                                  }}
                                  className="w-full text-left px-3 py-2 hover:bg-slate-900 transition-colors text-slate-200 text-[10.5px] flex justify-between items-center"
                                >
                                  <div>
                                    <span className="font-semibold text-slate-100">{item.name}</span>
                                    {item.subText && (
                                      <span className="text-[9px] text-slate-500 block">{item.subText}</span>
                                    )}
                                  </div>
                                  <span className="text-[9px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded">
                                    {item.id}
                                  </span>
                                </button>
                              ))}
                              {getRecipientChoices().length === 0 && (
                                <div className="p-3 text-slate-500 text-center">
                                  Không tìm thấy kết quả. Bạn có thể tự nhập tên tự do.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">Dự án gán chi:</label>
                          <select
                            value={payProj}
                            onChange={(e) => setPayProj(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white cursor-pointer"
                          >
                            {projects.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                            <option value="none">Ngoài dự án (Không gán chi)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">Hình thức thanh toán:</label>
                          <select
                            value={payMethod}
                            onChange={(e) => setPayMethod(e.target.value as 'cash' | 'transfer')}
                            className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white cursor-pointer font-bold"
                          >
                            <option value="cash">Tiền mặt</option>
                            <option value="transfer">Chuyển khoản</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Ghi chú giải nghĩa:</label>
                        <input
                          type="text"
                          required
                          value={payNotes}
                          onChange={(e) => setPayNotes(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white font-medium"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                        <button type="button" onClick={() => setShowPayForm(false)} className="bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded text-slate-300 cursor-pointer">Bỏ qua</button>
                        <button type="submit" className="bg-rose-600 hover:bg-rose-555 text-white px-3 py-1.5 rounded font-bold cursor-pointer">Nộp đề xuất chi</button>
                      </div>
                    </form>
                  </div>
                )}

                <div className="overflow-x-auto animate-fadeIn">
                  <table className="w-full text-left text-slate-300 text-[10.5px]">
                    <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                      <tr>
                        <th className="w-10 px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={paySelectedRows.size > 0 && payments.length > 0 && payments.every(p => paySelectedRows.has(p.id))}
                            onChange={(e) => handlePaySelectAll(e.target.checked, payments)}
                            className="w-4 h-4 text-rose-500 border-slate-600 rounded cursor-pointer accent-rose-500"
                          />
                        </th>
                        <th className="px-3 py-2">Mã Phiếu Chi</th>
                        <th className="px-3 py-2">Nhóm gốc chi</th>
                        <th className="px-3 py-2">Nạn thầu nhận / Ghi chú</th>
                        <th className="px-3 py-2 text-right">Tổng thực chi</th>
                        <th className="px-3 py-2 text-center">Trạng thái duyệt</th>
                        <th className="px-3 py-2 text-center w-12">Quy trình</th>
                        <th className="px-3 py-2 text-center">Đơn hàng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-3 py-8 text-center text-slate-500 italic">Chưa có phiếu chi nào.</td>
                        </tr>
                      ) : payments.map((p) => {
                        return (
                          <tr key={p.id} className={`border-b border-slate-850/80 hover:bg-slate-900/40 font-sans ${paySelectedRows.has(p.id) ? 'bg-rose-500/10' : ''}`}>
                            <td className="px-3 py-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={paySelectedRows.has(p.id)}
                                onChange={(e) => handlePayRowSelect(p.id, e.target.checked)}
                                className="w-4 h-4 text-rose-500 border-slate-600 rounded cursor-pointer accent-rose-500"
                              />
                            </td>
                            <td className="px-3 py-2.5 font-mono font-bold text-rose-450">{p.code}</td>
                            <td className="px-3 py-2.5">
                              <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[9.5px] uppercase font-mono">{p.category}</span>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="font-extrabold text-slate-100">{p.recipient}</div>
                              <div className="text-[9.5px] text-slate-500 italic mt-0.5">{p.notes}</div>
                            </td>
                            <td className="px-3 py-2.5 text-right font-bold text-rose-450 font-mono">-{p.amount.toLocaleString('vi-VN')} đ</td>
                            <td className="px-3 py-2.5 text-center">
                              {p.status === 'approved' ? (
                                <span className="bg-emerald-500/10 text-emerald-400 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border border-emerald-500/20">Đã thông duyệt</span>
                              ) : p.status === 'rejected' ? (
                                <span className="bg-rose-500/10 text-rose-450 text-[9px] px-1.5 py-0.5 rounded uppercase border border-rose-500/20">Bác thầu</span>
                              ) : (
                                canEdit ? (
                                  <div className="flex gap-1 justify-center">
                                    <button
                                      onClick={() => onApprovePayment(p.id, 'approved')}
                                      className="bg-emerald-600 hover:bg-emerald-555 hover:scale-105 text-white font-black text-[9px] px-2 py-0.5 rounded cursor-pointer transition-transform"
                                    >
                                      Duyệt chi
                                    </button>
                                    <button
                                      onClick={() => onApprovePayment(p.id, 'rejected')}
                                      className="bg-red-650 hover:bg-rose-600 hover:scale-105 text-white text-[9px] px-2 py-0.5 rounded cursor-pointer transition-transform"
                                    >
                                      Từ chối
                                    </button>
                                  </div>
                                ) : (
                                  <span className="bg-yellow-500/10 text-yellow-450 text-[9px] px-1.5 py-0.5 rounded uppercase list-none animate-pulse">Đang rà duyệt</span>
                                )
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <button
                                onClick={() => triggerDownloadTxt(
                                  `Phieu_Chi_${p.code}`,
                                  `===========================================\nPHIẾU CHI NGÂN SÁCH THẦU PHỤ DỰ ÁN\nMã phiếu chi: ${p.code}\nNgày nộp: ${p.date}\nNơi thụ hưởng: ${p.recipient}\nNgạch chi: ${p.category}\nCách thức: ${p.paymentMethod === 'transfer' ? 'Chuyển khoản (MBBank)' : 'Tiền mặt thủ quỹ'}\nSố tiền xuất ngân: ${p.amount.toLocaleString('vi-VN')} VND\nNội dung chi: ${p.notes}\nNgười duyệt phê chuẩn: Giám đốc kịch khung`,
                                  p.code
                                )}
                                className="bg-slate-850 text-[9.5px] hover:bg-slate-800 text-slate-300 px-1 py-0.5 rounded"
                                disabled={p.status !== 'approved'}
                              >
                                Tải
                              </button>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {p.purchaseOrderId ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const linkedOrder = purchaseOrders.find((o: PurchaseOrder) => o.id === p.purchaseOrderId);
                                    if (linkedOrder) setPoDetailModal({ open: true, order: linkedOrder });
                                    else addToast({ title: '⚠️ Không tìm thấy', message: `Đơn hàng ${p.purchaseOrderId} không còn tồn tại.`, type: 'warning' });
                                  }}
                                  className="bg-violet-600 hover:bg-violet-500 text-white text-[9.5px] font-extrabold px-2 py-1 rounded-lg flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap"
                                  title="Xem đơn hàng được thanh toán"
                                >
                                  <ShoppingCart className="w-3 h-3" /> Xem đơn hàng
                                </button>
                              ) : (
                                <span className="text-slate-600 text-[9px] italic">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {paySelectedRows.size > 0 && (
                  <div className="bg-slate-950 px-4 py-2 border-t border-slate-850 flex items-center gap-2 text-[10px]">
                    <span className="text-rose-500 font-bold">Đã chọn: {paySelectedRows.size}</span>
                    <button
                      onClick={() => {
                        if (!window.confirm(`⚠️ Bạn có chắc chắn muốn xóa ${paySelectedRows.size} phiếu chi đã chọn không?\nHành động này không thể hoàn tác.`)) return;
                        const idsToDelete = paySelectedRows;
                        idsToDelete.forEach(id => { if (onDeletePayment) onDeletePayment(id); });
                        addToast({ title: '✅ Đã xóa', message: `Đã xóa ${paySelectedRows.size} phiếu chi.`, type: 'success' });
                        setPaySelectedRows(new Set());
                      }}
                      className="bg-rose-650 hover:bg-rose-600 text-white font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Xóa
                    </button>
                    <button
                      onClick={() => setPaySelectedRows(new Set())}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
                    >
                      Hủy chọn
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 9: CÔNG NỢ PHẢI THU */}
            {activeSubTab === 'cong_no_phai_thu' && (
              <div className="space-y-4">

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-850 pb-3">
                  <div>
                    <span className="font-bold text-slate-300 uppercase tracking-widest text-[11px] block">
                      Danh sách công nợ phải thu
                    </span>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Tự động tính từ <span className="text-emerald-400 font-bold">Dự án có báo giá phê duyệt</span> &amp; phiếu thu. Hỗ trợ import thêm dữ liệu công nợ cũ từ Excel.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const data = mergedReceivables.map(item => ({
                          'Dự án công trình': item.projectName,
                          'Chủ đầu tư': item.investor,
                          'Lĩnh vực': item.field,
                          'Giá trị HĐ': item.contractValue,
                          'Đã Thu': item.collected,
                          'Còn phải thu': item.remaining,
                          'Ghi chú': item.notes || '',
                        }));
                        exportToExcel(data, 'CongNoPhaiThu', `Cong_No_Phai_Thu_${formatDateForFile()}.xlsx`, undefined, [...EXCEL_HEADERS.receivable]);
                        addToast({ title: '✅ Xuất Excel', message: `Đã xuất ${data.length} công nợ phải thu`, type: 'success' });
                      }}
                      className="bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-[10px] px-2.5 py-1.5 rounded flex items-center gap-1 cursor-pointer border border-slate-700"
                      title="Xuất Excel công nợ phải thu"
                    >
                      <Download className="w-3 h-3 text-blue-400" />
                      Xuất Excel
                    </button>
                    <label
                      className="bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-[10px] px-2.5 py-1.5 rounded flex items-center gap-1 cursor-pointer border border-slate-700"
                      title="Nhập Excel công nợ phải thu"
                    >
                      <FileUp className="w-3 h-3 text-emerald-400" />
                      Nhập Excel
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            try {
                              const wb = XLSX.read(ev.target?.result, { type: 'binary' });
                              const ws = wb.Sheets[wb.SheetNames[0]];
                              const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '', blankrows: false });
                              if (rows.length === 0) {
                                addToast({ title: '⚠️ Không có dữ liệu', message: 'File Excel không có dữ liệu.', type: 'warning' });
                                return;
                              }
                              const imported = rows.map((r, idx) => {
                                const cv = Number(String(r['Giá trị HĐ'] || r['Giá trị'] || '0').replace(/[^\d.-]/g, '')) || 0;
                                const cl = Number(String(r['Đã Thu'] || r['Đã thu'] || '0').replace(/[^\d.-]/g, '')) || 0;
                                return {
                                  id: crypto.randomUUID(),
                                  projectName: String(r['Dự án công trình'] || r['Tên dự án'] || r['Dự án'] || '').trim(),
                                  investor: String(r['Chủ đầu tư'] || r['Khách hàng'] || '').trim(),
                                  field: String(r['Lĩnh vực'] || 'Xây dựng').trim(),
                                  contractValue: cv,
                                  collected: cl,
                                  remaining: cv - cl,
                                  notes: String(r['Ghi chú'] || '').trim(),
                                };
                              }).filter(r => r.projectName && r.contractValue > 0);
                              if (imported.length === 0) {
                                addToast({ title: '⚠️ Không hợp lệ', message: 'Không tìm thấy cột "Dự án công trình" hoặc dữ liệu không hợp lệ.', type: 'warning' });
                                return;
                              }
                              setCustomReceivables(prev => [...prev, ...imported]);
                              addToast({ title: '✅ Nhập thành công', message: `Đã import ${imported.length} công nợ phải thu từ Excel`, type: 'success' });
                            } catch {
                              addToast({ title: '❌ Lỗi', message: 'Không thể đọc file Excel.', type: 'error' });
                            }
                          };
                          reader.readAsBinaryString(file);
                        }}
                      />
                    </label>
                    <button
                      onClick={() => {
                        setEditingReceivableId(null);
                        setRecvProjectName('');
                        setRecvInvestor('');
                        setRecvField('Xây dựng');
                        setRecvContractValue(0);
                        setRecvCollected(0);
                        setRecvNotes('');
                        setShowReceivableModal(true);
                      }}
                      className={`font-bold text-[10px] px-2.5 py-1.5 rounded flex items-center gap-1 transition-colors ${canCreate ? 'bg-emerald-600 hover:bg-emerald-555 text-white cursor-pointer' : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'}`}
                    >
                      <Plus className="w-4 h-4" />
                      Thêm Công Nợ
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto text-[10.5px]">
                  <table className="w-full text-left text-slate-300">
                    <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                      <tr>
                        <th className="px-3 py-2">Chủ đầu tư / Dự án công trình</th>
                        <th className="px-3 py-2">Lĩnh vực</th>
                        <th className="px-3 py-2 text-right">Giá trị HĐ</th>
                        <th className="px-3 py-2 text-right">Đã Thu/ Tạm Ứng</th>
                        <th className="px-3 py-2 text-right text-orange-400 font-black">Còn phải thu</th>
                        <th className="px-3 py-2">Ghi chú</th>
                        <th className="px-3 py-2 text-center w-20">Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mergedReceivables.length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center py-10 text-slate-500 font-bold font-sans">
                            📭 Chưa có dữ liệu công nợ phải thu. Hãy import từ Excel hoặc thêm mới.
                          </td>
                        </tr>
                      )}
                      {mergedReceivables.map((item) => {
                        return (
                          <tr key={item.id} className="border-b border-slate-850/80 hover:bg-slate-900/40 font-sans">
                            <td className="px-3 py-3">
                              <div className="font-extrabold text-slate-100 flex items-center gap-1.5 text-[12px]">
                                <span className="text-white">{item.investor || '—'}</span>
                                {item.isAuto ? (
                                  <span className="bg-emerald-600/20 text-emerald-300 text-[8px] font-bold px-2 py-0.5 rounded-full border border-emerald-400/40 shadow-sm" title="Tự động từ dự án đã phê duyệt">
                                    Hệ thống
                                  </span>
                                ) : (
                                  <span className="bg-sky-600/20 text-sky-300 text-[8px] font-bold px-2 py-0.5 rounded-full border border-sky-400/40 shadow-sm" title="Import / thêm thủ công">
                                    Thủ công
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 font-medium mt-0.5 truncate max-w-[260px]">{item.projectName}</div>
                            </td>
                            <td className="px-3 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                item.field === 'Xây dựng' ? 'bg-emerald-600/15 text-emerald-300 border border-emerald-500/30' :
                                item.field === 'Nội thất' ? 'bg-sky-600/15 text-sky-300 border border-sky-500/30' :
                                item.field === 'Cơ khí' ? 'bg-amber-600/15 text-amber-300 border border-amber-500/30' :
                                'bg-slate-700/40 text-slate-300 border border-slate-600/40'
                              }`}>
                                {item.field}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-right font-mono font-bold text-slate-100">
                              {item.contractValue.toLocaleString('vi-VN')} đ
                            </td>
                            <td className="px-3 py-3 text-right font-mono text-emerald-400 font-bold">+{item.collected.toLocaleString('vi-VN')} đ</td>
                            <td className="px-3 py-3 text-right font-mono font-black text-orange-500 bg-orange-500/5">
                              {item.remaining > 0 ? `${item.remaining.toLocaleString('vi-VN')} đ` : '0 đ'}
                            </td>
                            <td className="px-3 py-3 text-slate-400 italic max-w-xs truncate" title={item.notes}>
                              {item.notes || '-'}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center justify-center gap-2">
                                {!item.isAuto && (
                                  <>
                                    <button
                                      onClick={() => handleEditReceivable(item)}
                                      className="text-blue-400 hover:text-blue-300 p-1"
                                      title="Chỉnh sửa công nợ"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteReceivable(item)}
                                      className="text-rose-400 hover:text-rose-300 p-1"
                                      title="Xóa công nợ"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pop up Lightbox Letterhead "Giấy đề nghị thanh lý thanh toán kì hạn" */}
                {selectedReceivableProjId && (
                  <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
                    <div className="bg-amber-50 border border-amber-200 text-slate-900 p-8 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl relative" style={{ fontFamily: 'Georgia, serif' }}>

                      <button
                        type="button"
                        onClick={() => setSelectedReceivableProjId(null)}
                        className="absolute right-4 top-4 hover:scale-105 bg-slate-800 text-white rounded-full p-1 leading-none text-xs font-bold"
                      >
                        ✕ Đóng
                      </button>

                      <div className="space-y-4 text-xs leading-relaxed">
                        
                        <div className="text-center font-bold font-mono">
                          CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                          <span className="block text-[10px] font-sans font-normal italic">Độc lập - Tự do - Hạnh phúc</span>
                          <span className="block border-b border-slate-300 w-24 mx-auto my-1"></span>
                        </div>

                        <div className="text-center pt-2">
                          <h3 className="font-black text-sm uppercase">GIẤY ĐỀ NGHỊ THANH TOÁN KHỐI LƯỢNG KÝ HẠN</h3>
                          <span className="block text-[10px] font-mono text-slate-500">Căn cứ Hợp đồng xây thô &amp; lắp dán vách Hoàng Long ERP 2026</span>
                        </div>

                        <div className="space-y-1.5 pt-2">
                          <p>Kính gửi quý khách hàng: <strong>{customers.find(c => c.id === projects.find(p => p.id === selectedReceivableProjId)?.customerId)?.name}</strong></p>
                          <p>Chúng tôi, đại diện <strong>CÔNG TY TNHH HOÀNG LONG CONSTRUCTION &amp; FURNITURE</strong>, trân trọng thông báo:</p>
                          <p>Căn cứ mốc thực thi công mộc ráp ván vách biệt thự: <strong>{projects.find(p => p.id === selectedReceivableProjId)?.name}</strong></p>
                          <p>Địa điểm lắp ráp: {projects.find(p => p.id === selectedReceivableProjId)?.address}</p>
                          
                          {(() => {
                            const foundProj = projects.find(p => p.id === selectedReceivableProjId);
                            if (!foundProj) return null;
                            const rawTotal = foundProj.baoGiaFile?.totalAmount || foundProj.contractValue || 0;
                            const discountPercent = foundProj.baoGiaFile?.discountPercent || 0;
                            const discountValue = rawTotal * (discountPercent / 100);
                            const grandTotal = rawTotal - discountValue;
                            const colVal = receipts.filter(r => r.projectId === selectedReceivableProjId).reduce((s, r) => s + r.amount, 0);
                            const remainingVal = grandTotal - colVal;

                            return (
                              <div className="p-3 bg-white border border-dashed border-amber-200 rounded space-y-1 my-3 font-sans text-[11px]">
                                <div className="flex justify-between">
                                  <span>Giá trị HĐ (đã trừ CK):</span>
                                  <strong className="font-mono">{grandTotal.toLocaleString('vi-VN')} VND</strong>
                                </div>
                                <div className="flex justify-between text-emerald-700">
                                  <span>Lũy kế quý khách đã tạm ứng:</span>
                                  <strong className="font-mono">+{colVal.toLocaleString('vi-VN')} VND</strong>
                                </div>
                                <div className="flex justify-between text-rose-700 border-t pt-1 font-bold">
                                  <span>Số dư đề nghị thanh toán giải ngân đợt này:</span>
                                  <strong className="font-mono">{remainingVal.toLocaleString('vi-VN')} VND</strong>
                                </div>
                              </div>
                            );
                          })()}

                          <p><strong>Thông tin thụ hưởng giao khoản:</strong></p>
                          <div className="pl-4 font-mono text-[10.5px] border-l-2 border-amber-300">
                            <p>Tên tài khoản: HOANG LONG CONSTRUCTION Co.LTD</p>
                            <p>Mã số MBBank: 2026888888</p>
                            <p>Nội dung chuyển khoản: HOANG LONG THANH TOAN {projects.find(p => p.id === selectedReceivableProjId)?.code}</p>
                          </div>
                        </div>

                        <p className="pt-3">Rất trân trọng sự phối hợp tin cậy, dẻo dai từ Quý Khách Hàng!</p>

                        <div className="grid grid-cols-2 text-center pt-6 font-sans">
                          <div>
                            <span className="block font-bold">ĐẠI DIỆN KHÁCH HÀNG</span>
                            <span className="block text-[8.5px] text-slate-400 italic">(Ký, đóng dấu số đỏ)</span>
                          </div>
                          <div>
                            <span className="block font-bold text-orange-900">KẾ TOÁN TRƯỞNG HOÀNG LONG</span>
                            <span className="block text-[8.5px] text-slate-400 italic">(Đã đóng mộc đỏ số)</span>
                            <span className="block text-rose-800 font-extrabold pt-2 text-[10.5px]">ĐÃ DUYỆT PHÁP LÝ ERP</span>
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* TAB 10: CÔNG NỢ PHẢI TRẢ */}
            {activeSubTab === 'cong_no_phai_tra' && (
              <div className="space-y-4">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-850 pb-3">
                  <div>
                    <span className="font-bold text-slate-300 uppercase tracking-widest text-[11px] block">
                      Danh sách công nợ phải trả
                    </span>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Hệ thống tự động đồng bộ công nợ từ các <span className="text-emerald-400 font-bold">Hợp Đồng Thầu Phụ đã Phê Duyệt</span> và hỗ trợ thêm thủ công các Nhà Cung Cấp khác.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      const data = mergedLiabilities.map(item => ({
                        'Tên Đơn Vị': item.name,
                        'Phân Loại': item.category,
                        'Giá Trị': item.value,
                        'Đã Trả': item.paid,
                        'Còn lại': item.remaining,
                        'Ghi chú': item.notes || '',
                      }));
                      exportToExcel(data, 'CongNoPhaiTra', `Cong_No_Phai_Tra_${formatDateForFile()}.xlsx`, undefined, [...EXCEL_HEADERS.liability]);
                      addToast({ title: '✅ Xuất Excel', message: `Đã xuất ${data.length} công nợ phải trả`, type: 'success' });
                    }}
                    className="bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-[10px] px-2.5 py-1.5 rounded flex items-center gap-1 cursor-pointer border border-slate-700"
                    title="Xuất Excel công nợ phải trả"
                  >
                    <Download className="w-3 h-3 text-blue-400" />
                    Xuất Excel
                  </button>
                  <label
                    className="bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-[10px] px-2.5 py-1.5 rounded flex items-center gap-1 cursor-pointer border border-slate-700"
                    title="Nhập Excel công nợ phải trả"
                  >
                    <FileUp className="w-3 h-3 text-emerald-400" />
                    Nhập Excel
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          try {
                            const wb = XLSX.read(ev.target?.result, { type: 'binary' });
                            const ws = wb.Sheets[wb.SheetNames[0]];
                            const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '', blankrows: false });
                            if (rows.length === 0) {
                              addToast({ title: '⚠️ Không có dữ liệu', message: 'File Excel không có dữ liệu.', type: 'warning' });
                              return;
                            }
                            const imported = rows.map((r, idx) => ({
                              id: crypto.randomUUID(),
                              name: String(r['Tên Đơn Vị'] || '').trim(),
                              category: String(r['Phân Loại'] || 'Nhà Cung Cấp').trim() as 'Nhà Cung Cấp' | 'Thầu Phụ' | 'Khác',
                              value: Number(String(r['Giá Trị'] || '0').replace(/[^\d.-]/g, '')) || 0,
                              paid: Number(String(r['Đã Trả'] || '0').replace(/[^\d.-]/g, '')) || 0,
                              remaining: 0,
                              notes: String(r['Ghi chú'] || '').trim(),
                            })).filter(l => l.name && l.value > 0);
                            if (imported.length === 0) {
                              addToast({ title: '⚠️ Không hợp lệ', message: 'Không tìm thấy cột "Tên Đơn Vị" hoặc dữ liệu không hợp lệ.', type: 'warning' });
                              return;
                            }
                            imported.forEach(l => { l.remaining = l.value - l.paid; });
                            setCustomLiabilities(prev => [...prev, ...imported]);
                            addToast({ title: '✅ Nhập thành công', message: `Đã import ${imported.length} công nợ phải trả`, type: 'success' });
                          } catch {
                            addToast({ title: '❌ Lỗi', message: 'Không thể đọc file Excel.', type: 'error' });
                          }
                        };
                        reader.readAsBinaryString(file);
                      }}
                    />
                  </label>
                  <button
                    onClick={() => {
                      setEditingLiabId(null);
                      setLiabName('');
                      setLiabCategory('Nhà Cung Cấp');
                      setLiabValue(0);
                      setLiabPaid(0);
                      setLiabNotes('');
                      setShowLiabModal(true);
                    }}
                    className={`font-bold text-[10px] px-2.5 py-1.5 rounded flex items-center gap-1 transition-colors ${canCreate ? 'bg-rose-600 hover:bg-rose-555 text-white cursor-pointer' : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'}`}
                  >
                    <Plus className="w-4 h-4" />
                    Thêm Công Nợ
                  </button>
                  </div>
                </div>

                <div className="overflow-x-auto text-[10.5px]">
                  <table className="w-full text-left text-slate-300">
                    <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                      <tr>
                        <th className="px-3 py-2.5 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={finSelectAll && mergedLiabilities.length > 0 && mergedLiabilities.every(l => finSelectedRows.has(l.id))}
                            onChange={(e) => handleFinSelectAll(e.target.checked, mergedLiabilities)}
                            className="w-4 h-4 text-amber-500 border-slate-600 rounded cursor-pointer"
                          />
                        </th>
                        <th className="px-3 py-2.5">Tên Đơn Vị</th>
                        <th className="px-3 py-2.5">Phân Loại</th>
                        <th className="px-3 py-2.5 text-right">Giá Trị (VNĐ)</th>
                        <th className="px-3 py-2.5 text-right">Đã Trả</th>
                        <th className="px-3 py-2.5 text-right text-rose-400 font-bold">Còn lại</th>
                        <th className="px-3 py-2.5">Ghi chú</th>
                        <th className="px-3 py-2.5 text-center">Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mergedLiabilities.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-3 py-8 text-center text-slate-500 italic">
                            Chưa có dữ liệu công nợ phải trả. Hãy duyệt hợp đồng thầu phụ hoặc thêm mới.
                          </td>
                        </tr>
                      ) : (
                        mergedLiabilities.map((item) => {
                          return (
                            <tr key={item.id} className={`border-b border-slate-850/80 hover:bg-slate-900/40 font-sans ${finSelectedRows.has(item.id) ? 'bg-amber-500/10' : ''}`}>
                              {/* Checkbox */}
                              <td className="px-3 py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={finSelectedRows.has(item.id)}
                                  onChange={(e) => { e.stopPropagation(); handleFinRowSelect(item.id, e.target.checked); }}
                                  className="w-4 h-4 text-amber-500 border-slate-600 rounded cursor-pointer"
                                />
                              </td>
                              <td className="px-3 py-3">
                                <div className="font-extrabold text-slate-100 flex items-center gap-1.5">
                                  <span>{item.name}</span>
                                  {item.isAuto ? (
                                    <span className="bg-emerald-600/20 text-emerald-300 text-[8px] font-bold px-2 py-0.5 rounded-full border border-emerald-400/40 shadow-sm" title="Tự động đồng bộ từ Hợp đồng Thầu phụ đã phê duyệt">
                                      HĐ Đã Duyệt
                                    </span>
                                  ) : (
                                    <span className="bg-sky-600/20 text-sky-300 text-[8px] font-bold px-2 py-0.5 rounded-full border border-sky-400/40 shadow-sm" title="Thêm thủ công">
                                      Thủ công
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                  item.category === 'Thầu Phụ' ? 'bg-amber-600/15 text-amber-300 border border-amber-500/30' :
                                  item.category === 'Nhà Cung Cấp' ? 'bg-purple-600/15 text-purple-300 border border-purple-500/30' :
                                  'bg-slate-700/40 text-slate-300 border border-slate-600/40'
                                }`}>
                                  {item.category}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-right font-mono font-bold text-slate-100">
                                {item.value.toLocaleString('vi-VN')} đ
                              </td>
                              <td className="px-3 py-3 text-right font-mono text-emerald-400">
                                -{item.paid.toLocaleString('vi-VN')} đ
                              </td>
                              <td className="px-3 py-3 text-right font-mono font-extrabold text-rose-450 bg-rose-500/5">
                                {item.remaining > 0 ? `${item.remaining.toLocaleString('vi-VN')} đ` : '0 đ'}
                              </td>
                              <td className="px-3 py-3 text-slate-400 max-w-xs truncate" title={item.notes}>
                                {item.notes}
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex items-center justify-center gap-2">
                                  {item.remaining > 0 ? (
                                    <button
                                      onClick={() => handleQuickPayProposalGeneric(item.name || '', item.remaining)}
                                      className="bg-rose-600 hover:bg-rose-700 text-white text-[9.5px] font-extrabold px-2.5 py-1 rounded-lg transition-transform hover:scale-105 cursor-pointer whitespace-nowrap"
                                    >
                                      Lập Ủy nhiệm chi
                                    </button>
                                  ) : (
                                    <span className="text-emerald-500 text-[9px] italic font-bold">Hoàn tất nợ</span>
                                  )}

                                  {!item.isAuto && (
                                    <>
                                      <button
                                        onClick={() => handleEditLiability(item)}
                                        className="text-blue-400 hover:text-blue-300 p-1"
                                        title="Chỉnh sửa công nợ"
                                      >
                                        <Edit className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteLiability(item)}
                                        className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                                        title="Xóa công nợ"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                {finSelectedRows.size > 0 && (
                  <div className="bg-slate-950 px-4 py-2 border-t border-slate-850 flex items-center gap-2 text-[10px]">
                    <span className="text-amber-500 font-bold">Đã chọn: {finSelectedRows.size}</span>
                    <button
                      onClick={() => {
                        if (!window.confirm(`⚠️ Bạn có chắc chắn muốn xóa ${finSelectedRows.size} công nợ đã chọn không?\nHành động này không thể hoàn tác.`)) return;
                        // Note: Need to identify which data array to update - this is complex with merged data
                        // For now, show toast that it's not implemented for merged data
                        addToast({ title: '⚠️ Chức năng', message: 'Xóa hàng loạt cho dữ liệu gộp chưa được hỗ trợ đầy đủ', type: 'warning' });
                      }}
                      className="bg-rose-650 hover:bg-rose-600 text-white font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Xóa
                    </button>
                  </div>
                )}

                {/* MODAL THÊM / SỬA CÔNG NỢ */}
                {showLiabModal && (
                  <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 text-slate-100 shadow-2xl relative">
                      <button
                        onClick={() => setShowLiabModal(false)}
                        className="absolute right-4 top-4 text-slate-400 hover:text-white cursor-pointer bg-slate-800 hover:bg-slate-700 w-7 h-7 rounded-full flex items-center justify-center"
                      >
                        ✕
                      </button>
                      <h3 className="font-extrabold text-sm uppercase tracking-wide border-b border-slate-850 pb-3 flex items-center gap-2">
                        <Database className="w-4 h-4 text-blue-500" />
                        {editingLiabId ? "Chỉnh Sửa Công Nợ Phải Trả" : "Thêm Công Nợ Phải Trả Mới"}
                      </h3>

                      <form onSubmit={handleSaveLiability} className="space-y-4 pt-4 text-xs">
                        <div className="space-y-1">
                          <label className="block text-slate-400 font-bold">Tên Đơn Vị (Thầu phụ / Nhà cung cấp / Khác):</label>
                          <input
                            type="text"
                            required
                            value={liabName}
                            onChange={(e) => setLiabName(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 outline-none focus:border-blue-500"
                            placeholder="Nhập tên đối tác hoặc đơn vị thợ..."
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="block text-slate-400 font-bold">Phân Loại:</label>
                            <select
                              value={liabCategory}
                              onChange={(e: any) => setLiabCategory(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 outline-none focus:border-blue-500"
                            >
                              <option value="Thầu Phụ">Thầu Phụ</option>
                              <option value="Nhà Cung Cấp">Nhà Cung Cấp</option>
                              <option value="Khác">Khác</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="block text-slate-400 font-bold">Giá Trị (VNĐ):</label>
                            <input
                              type="number"
                              required
                              value={liabValue || ''}
                              onChange={(e) => setLiabValue(Number(e.target.value))}
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 outline-none focus:border-blue-500 font-mono font-bold"
                              placeholder="0"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-slate-400 font-bold">Số Tiền Đã Trả Ban Đầu (VNĐ):</label>
                          <input
                            type="number"
                            value={liabPaid || ''}
                            onChange={(e) => setLiabPaid(Number(e.target.value))}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 outline-none focus:border-blue-500 font-mono"
                            placeholder="0"
                          />
                          <p className="text-[9px] text-slate-500 italic mt-0.5">
                            (Hệ thống sẽ tự động cộng thêm lũy kế từ các phiếu chi đã duyệt cho đơn vị này)
                          </p>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-slate-400 font-bold">Ghi chú:</label>
                          <textarea
                            value={liabNotes}
                            onChange={(e) => setLiabNotes(e.target.value)}
                            rows={3}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 outline-none focus:border-blue-500"
                            placeholder="Chi tiết công nợ hoặc vật tư tương ứng..."
                          />
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-850">
                          <button
                            type="button"
                            onClick={() => setShowLiabModal(false)}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl cursor-pointer"
                          >
                            Hủy
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl cursor-pointer"
                          >
                            {editingLiabId ? "Cập Nhật" : "Lưu Công Nợ"}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* MODAL CẢNH BÁO XÓA CÔNG NỢ */}
                {liabToDelete && (
                  <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-red-900/40 rounded-3xl w-full max-w-md p-6 text-slate-100 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
                      <button
                        onClick={() => setLiabToDelete(null)}
                        className="absolute right-4 top-4 text-slate-400 hover:text-white cursor-pointer bg-slate-800 hover:bg-slate-700 w-7 h-7 rounded-full flex items-center justify-center"
                      >
                        ✕
                      </button>
                      
                      <div className="flex items-center gap-3 border-b border-slate-850 pb-3 text-red-400">
                        <div className="w-9 h-9 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center">
                          <Trash2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-extrabold text-sm uppercase tracking-wide">
                            Cảnh Báo Xóa Công Nợ
                          </h3>
                          <p className="text-[9px] text-slate-400 uppercase tracking-widest font-mono mt-0.5">Xác nhận xóa vĩnh viễn</p>
                        </div>
                      </div>

                      <div className="space-y-4 pt-4 text-xs">
                        <div className="bg-red-950/20 border border-red-900/30 rounded-2xl p-4 text-red-200/90 leading-relaxed font-sans font-medium">
                          ⚠️ <strong className="text-red-400 uppercase text-[10.5px]">CẢNH BÁO NGUY HIỂM CAO ĐỘ:</strong>
                          <p className="mt-1">
                            Bạn đang yêu cầu xóa vĩnh viễn ghi nhận công nợ phải trả của đơn vị dưới đây. Hành động này <strong className="text-white underline">không thể hoàn tác</strong> và sẽ xóa sạch mọi thông số liên quan trong danh mục công nợ thủ công!
                          </p>
                        </div>

                        <div className="bg-slate-950/80 border border-slate-850 rounded-2xl p-4 space-y-2 font-sans">
                          <div className="flex justify-between items-center border-b border-slate-900 pb-1.5">
                            <span className="text-slate-450 font-semibold">Tên đơn vị:</span>
                            <span className="font-extrabold text-slate-100 max-w-[200px] truncate text-right" title={liabToDelete.name}>
                              {liabToDelete.name}
                            </span>
                          </div>
                          <div className="flex justify-between items-center border-b border-slate-900 pb-1.5">
                            <span className="text-slate-450 font-semibold">Phân loại:</span>
                            <span className="font-bold text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-900/30 text-[9.5px]">
                              {liabToDelete.category}
                            </span>
                          </div>
                          <div className="flex justify-between items-center border-b border-slate-900 pb-1.5">
                            <span className="text-slate-450 font-semibold">Tổng giá trị nợ:</span>
                            <span className="font-bold text-slate-100 font-mono">
                              {liabToDelete.value?.toLocaleString('vi-VN')} đ
                            </span>
                          </div>
                          <div className="flex justify-between items-center border-b border-slate-900 pb-1.5">
                            <span className="text-slate-450 font-semibold">Đã thanh toán:</span>
                            <span className="font-bold text-emerald-400 font-mono">
                              {liabToDelete.paid?.toLocaleString('vi-VN')} đ
                            </span>
                          </div>
                          <div className="flex justify-between items-center font-bold">
                            <span className="text-slate-450">Dư nợ còn lại:</span>
                            <span className="font-extrabold text-rose-450 font-mono text-[13px]">
                              {liabToDelete.remaining?.toLocaleString('vi-VN')} đ
                            </span>
                          </div>
                        </div>

                        <p className="text-[10px] text-slate-500 italic text-center">
                          Vui lòng kiểm tra kỹ lưỡng trước khi bấm nút "Thực Sự Xóa".
                        </p>

                        <div className="flex justify-end gap-2 pt-3 border-t border-slate-850">
                          <button
                            type="button"
                            onClick={() => setLiabToDelete(null)}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl cursor-pointer transition-colors"
                          >
                            Hủy bỏ
                          </button>
                          <button
                            type="button"
                            onClick={confirmDeleteLiability}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-xl cursor-pointer transition-all active:scale-95 shadow-md flex items-center gap-1.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Thực Sự Xóa
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* ── Modal: Thêm / Chỉnh sửa Công Nợ Phải Thu ──────────────── */}
            {showReceivableModal && (
              <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-extrabold text-sm">
                      {editingReceivableId ? 'Chỉnh Sửa Công Nợ Phải Thu' : 'Thêm Công Nợ Phải Thu Mới'}
                    </h3>
                    <button onClick={() => { setShowReceivableModal(false); setEditingReceivableId(null); }} className="text-slate-400 hover:text-white">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <form onSubmit={handleSaveReceivable} className="space-y-4 text-xs">
                    <div>
                      <label className="block text-slate-400 font-bold mb-1">Dự án / Công trình <span className="text-red-400">*</span></label>
                      <input value={recvProjectName} onChange={e => setRecvProjectName(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold focus:border-blue-500 outline-none" placeholder="Tên dự án công trình..." />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold mb-1">Chủ đầu tư / Khách hàng</label>
                      <input value={recvInvestor} onChange={e => setRecvInvestor(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none" placeholder="Tên chủ đầu tư..." />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold mb-1">Lĩnh vực</label>
                      <select value={recvField} onChange={e => setRecvField(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none">
                        <option value="Xây dựng">Xây dựng</option>
                        <option value="Nội thất">Nội thất</option>
                        <option value="Cơ khí">Cơ khí</option>
                        <option value="Tổng hợp">Tổng hợp</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 font-bold mb-1">Giá trị HĐ (VNĐ)</label>
                        <input type="number" value={recvContractValue || ''} onChange={e => setRecvContractValue(Number(e.target.value) || 0)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-blue-500 outline-none" placeholder="0" />
                      </div>
                      <div>
                        <label className="block text-slate-400 font-bold mb-1">Đã thu (VNĐ)</label>
                        <input type="number" value={recvCollected || ''} onChange={e => setRecvCollected(Number(e.target.value) || 0)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-blue-500 outline-none" placeholder="0" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold mb-1">Ghi chú</label>
                      <textarea value={recvNotes} onChange={e => setRecvNotes(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none resize-none" rows={2} placeholder="Ghi chú..." />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button type="button" onClick={() => { setShowReceivableModal(false); setEditingReceivableId(null); }} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl cursor-pointer">Hủy</button>
                      <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl cursor-pointer shadow-md">
                        {editingReceivableId ? 'Cập Nhật' : 'Lưu Công Nợ'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* ── Modal: Xác nhận xóa Công Nợ Phải Thu ──────────────────── */}
            {receivableToDelete && (
              <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-red-900/40 rounded-2xl max-w-md w-full p-6 shadow-2xl">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-red-950/60 rounded-xl p-2.5 border border-red-900/40">
                      <Trash2 className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-extrabold text-sm">Xóa Công Nợ Phải Thu</h3>
                      <p className="text-[9px] text-slate-500 uppercase tracking-widest font-mono mt-0.5">Không thể hoàn tác</p>
                    </div>
                  </div>
                  <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-3 text-red-200/90 text-xs mb-4">
                    ⚠️ Bạn đang xóa vĩnh viễn công nợ <strong className="text-red-400">"{receivableToDelete.projectName}"</strong>. Hành động này không thể hoàn tác!
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setReceivableToDelete(null)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl cursor-pointer">Hủy</button>
                    <button type="button" onClick={confirmDeleteReceivable} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-xl cursor-pointer shadow-md flex items-center gap-1.5">
                      <Trash2 className="w-3.5 h-3.5" />
                      Xóa Vĩnh Viễn
                    </button>
                  </div>
                </div>
              </div>
            )}




          </div>

          {/* Sổ cái footer / Close section */}
          <div className="border-t border-slate-850 pt-4 mt-6 flex justify-between items-center shrink-0 text-[10px] text-slate-500 font-medium">
            <span>Báo cáo thời gian thực dẻo dai bởi ERP Hoàng Long Lâm Đồng Cloud 2026.</span>
            <span>Trực đới: Kế Toán {currentUser.name} ({currentUser.role})</span>
          </div>

        </div>

      </div>

      {/* Custom Modal: Xem chi tiết Đề xuất Tạm ứng / Tạm ứng Thầu phụ */}
      {viewingProposalDetail && (
        <div 
          className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-[999] p-4 text-left animate-fadeIn select-text"
          onClick={() => setViewingProposalDetail(null)}
        >
          <div 
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl text-slate-100 shadow-2xl overflow-hidden animate-scaleIn font-sans flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40 shrink-0">
              <span className="font-extrabold text-sm text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="w-5 h-5 text-amber-500" />
                CHI TIẾT ĐỀ XUẤT THU CHI
              </span>
              <button 
                type="button"
                onClick={() => setViewingProposalDetail(null)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer bg-slate-805 hover:bg-slate-700 p-1.5 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="bg-slate-950/60 border border-slate-800 p-5 rounded-2xl space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-4 pb-3 border-b border-slate-800/60">
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Loại Đề Xuất</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-extrabold uppercase ${
                      viewingProposalDetail.type === 'project_expense_proposal' 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                    }`}>
                      {viewingProposalDetail.type === 'project_expense_proposal' ? 'Đề xuất tạm ứng' : 'Tạm ứng thầu phụ'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Trạng thái</span>
                    <span>{(() => {
                      switch (viewingProposalDetail.status) {
                        case 'pending_approval':
                          return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] px-2 py-0.5 rounded-full font-bold">Chờ Duyệt</span>;
                        case 'pending_payment':
                          return <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[10px] px-2 py-0.5 rounded-full font-bold font-sans">Chờ Lập Phiếu (KT)</span>;
                        case 'rejected':
                          return <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] px-2 py-0.5 rounded-full font-bold font-sans">Từ Chối</span>;
                        case 'completed':
                          return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] px-2 py-0.5 rounded-full font-bold font-sans">Hoàn Thành</span>;
                        default:
                          return <span className="bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded-full font-bold">Không rõ</span>;
                      }
                    })()}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Mã đề xuất</span>
                    <strong className="text-amber-500 font-mono text-sm">{viewingProposalDetail.id}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Ngày đề xuất</span>
                    <strong className="text-slate-200 font-mono text-sm">{viewingProposalDetail.date || viewingProposalDetail.proposalDate || '—'}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Thầu phụ / Đối tượng chi</span>
                    <strong className="text-slate-200 text-sm">{viewingProposalDetail.subcontractorName}</strong>
                    {viewingProposalDetail.subcontractorId && viewingProposalDetail.subcontractorId !== 'expense_recipient' && (
                      <span className="text-slate-500 font-mono text-[10px] ml-1">({viewingProposalDetail.subcontractorId})</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Số tiền đề xuất</span>
                    <strong className="text-orange-400 font-mono text-base">{viewingProposalDetail.amount.toLocaleString('vi-VN')} đ</strong>
                  </div>
                </div>

                <div className="pt-1">
                  <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Dự án / Công trình</span>
                  <strong className="text-slate-200 text-sm">{viewingProposalDetail.projectName}</strong>
                </div>

                <div className="pt-1">
                  <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Nội dung công việc con</span>
                  <strong className="text-slate-300">{viewingProposalDetail.taskName || '—'}</strong>
                </div>

                <div className="pt-1">
                  <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Diễn giải / Lý do chi tiết</span>
                  <p className="text-slate-300 italic whitespace-pre-wrap bg-slate-900/60 p-3 rounded-lg border border-slate-800/40">
                    "{viewingProposalDetail.reason || 'Không có diễn giải.'}"
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Nhân sự lập đề xuất</span>
                    <strong className="text-slate-300">{viewingProposalDetail.creatorName || viewingProposalDetail.creator || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Nhân sự phê duyệt</span>
                    <strong className="text-slate-300">{viewingProposalDetail.approverName || viewingProposalDetail.approver || 'Ban Giám Đốc'}</strong>
                  </div>
                </div>

                {/* Nếu có các dòng chi tiết chi phí phát sinh */}
                {viewingProposalDetail.expenseItems && viewingProposalDetail.expenseItems.length > 0 && (
                  <div className="pt-3 border-t border-slate-800/60">
                    <span className="text-slate-400 block text-[10px] uppercase font-black tracking-wider mb-2">Bảng phân rã chi phí chi tiết</span>
                    <div className="border border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-900 text-slate-400 uppercase text-[9px] font-bold">
                          <tr>
                            <th className="p-2 pl-3">Mục chi tiêu</th>
                            <th className="p-2 text-right">Số tiền</th>
                            <th className="p-2 pr-3">Ghi chú</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {viewingProposalDetail.expenseItems.map((item, idx) => (
                            <tr key={item.id || idx} className="hover:bg-slate-900/40">
                              <td className="p-2 pl-3 font-bold text-slate-200">{item.item}</td>
                              <td className="p-2 text-right font-mono font-bold text-orange-400">{item.amount.toLocaleString('vi-VN')} đ</td>
                              <td className="p-2 pr-3 text-slate-400 italic text-[10px]">{item.note || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-950/40 border-t border-slate-800 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setViewingProposalDetail(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-sm hover:scale-[1.01]"
              >
                Đóng lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Modal: Reject Subcontractor Advance Proposal (Approver) */}
      {rejectProposalModal && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[999] p-4 text-left animate-fadeIn select-text"
          onClick={() => setRejectProposalModal(null)}
        >
          <div 
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg text-slate-100 shadow-2xl overflow-hidden animate-scaleIn font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <span className="font-extrabold text-sm text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                <X className="w-5 h-5 text-red-500" />
                Xác nhận từ chối đề xuất
              </span>
              <button 
                type="button"
                onClick={() => setRejectProposalModal(null)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-300 leading-relaxed">
                Bạn có chắc chắn muốn <strong className="text-red-400">TỪ CHỐI</strong> yêu cầu đề xuất tạm ứng thầu phụ này không?
              </p>
              
              <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl space-y-2 text-xs">
                <div>
                  <span className="text-slate-500">Mã đề xuất:</span>{" "}
                  <strong className="text-amber-500 font-mono">{rejectProposalModal.id}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Thầu phụ:</span>{" "}
                  <strong className="text-slate-200">{rejectProposalModal.subcontractorName}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Dự án:</span>{" "}
                  <strong className="text-slate-200">{rejectProposalModal.projectName}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Nội dung công việc:</span>{" "}
                  <strong className="text-slate-200">{rejectProposalModal.taskName}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Số tiền đề xuất:</span>{" "}
                  <strong className="text-orange-400 font-mono text-[13px]">{rejectProposalModal.amount.toLocaleString('vi-VN')} đ</strong>
                </div>
                {rejectProposalModal.reason && (
                  <div>
                    <span className="text-slate-500">Lý do:</span>{" "}
                    <span className="text-slate-300 italic">"{rejectProposalModal.reason}"</span>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-950/40 border-t border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRejectProposalModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={async () => {
                  const proposal = rejectProposalModal;
                  setRejectProposalModal(null);
                  await handleRejectByApprover(proposal);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-md"
              >
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Modal: Revert/Reject Subcontractor Advance Proposal (Accountant) */}
      {revertProposalModal && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[999] p-4 text-left animate-fadeIn select-text"
          onClick={() => setRevertProposalModal(null)}
        >
          <div 
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg text-slate-100 shadow-2xl overflow-hidden animate-scaleIn font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <span className="font-extrabold text-sm text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                <X className="w-5 h-5 text-red-500" />
                Xác nhận từ chối đề xuất (Kế toán)
              </span>
              <button 
                type="button"
                onClick={() => setRevertProposalModal(null)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-300 leading-relaxed">
                Bạn có chắc chắn muốn <strong className="text-red-400">TỪ CHỐI</strong> yêu cầu đề xuất tạm ứng thầu phụ này không? Trạng thái đề xuất sẽ chuyển thành <strong className="text-red-400">Từ Chối</strong>.
              </p>
              
              <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl space-y-2 text-xs">
                <div>
                  <span className="text-slate-500">Mã đề xuất:</span>{" "}
                  <strong className="text-amber-500 font-mono">{revertProposalModal.id}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Thầu phụ:</span>{" "}
                  <strong className="text-slate-200">{revertProposalModal.subcontractorName}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Dự án:</span>{" "}
                  <strong className="text-slate-200">{revertProposalModal.projectName}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Nội dung công việc:</span>{" "}
                  <strong className="text-slate-200">{revertProposalModal.taskName}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Số tiền đề xuất:</span>{" "}
                  <strong className="text-orange-400 font-mono text-[13px]">{revertProposalModal.amount.toLocaleString('vi-VN')} đ</strong>
                </div>
                {revertProposalModal.reason && (
                  <div>
                    <span className="text-slate-500">Lý do:</span>{" "}
                    <span className="text-slate-300 italic">"{revertProposalModal.reason}"</span>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-950/40 border-t border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRevertProposalModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={async () => {
                  const proposal = revertProposalModal;
                  setRevertProposalModal(null);
                  await handleRevertByAccountant(proposal);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-md"
              >
                Từ Chối Đề Xuất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Modal: Edit Proposal Amount (Board of Directors) */}
      {editingAmountProposal && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[999] p-4 text-left animate-fadeIn select-text"
          onClick={() => setEditingAmountProposal(null)}
        >
          <div 
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg text-slate-100 shadow-2xl overflow-hidden animate-scaleIn font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <span className="font-extrabold text-sm text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                <Edit className="w-5 h-5 text-amber-500" />
                Chỉnh sửa số tiền đề xuất (BGĐ)
              </span>
              <button 
                type="button"
                onClick={() => setEditingAmountProposal(null)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-300 leading-relaxed">
                Ban Giám Đốc điều chỉnh lại số tiền đề xuất thầu phụ trước khi phê duyệt:
              </p>
              
              <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl space-y-2 text-xs">
                <div>
                  <span className="text-slate-500">Mã đề xuất:</span>{" "}
                  <strong className="text-amber-500 font-mono">{editingAmountProposal.id}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Thầu phụ:</span>{" "}
                  <strong className="text-slate-200">{editingAmountProposal.subcontractorName}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Công việc:</span>{" "}
                  <strong className="text-slate-200">{editingAmountProposal.taskName}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Số tiền hiện tại:</span>{" "}
                  <strong className="text-slate-300 font-mono">{editingAmountProposal.amount.toLocaleString('vi-VN')} đ</strong>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-450 uppercase tracking-wider">Số tiền đề xuất mới (VNĐ)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={editAmountValue ? parseInt(editAmountValue.replace(/\D/g, '') || '0').toLocaleString('vi-VN') : ''}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '');
                      setEditAmountValue(raw);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-orange-400 font-mono font-black text-sm focus:outline-none focus:border-amber-500/50"
                    placeholder="Nhập số tiền..."
                    autoFocus
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 font-mono">đ</span>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-950/40 border-t border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingAmountProposal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => handleUpdateAmount(editingAmountProposal, editAmountValue)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-md"
              >
                Cập nhật số tiền
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CHI TIẾT ĐƠN HÀNG (tab Đơn Hàng) */}
      {poDetailModal.open && poDetailModal.order && (() => {
        const o = poDetailModal.order;
        const congNo = o.congNo || 0;
        const paid = o.thanhToanThucTe || 0;
        return (
          <div
            className="fixed inset-0 z-[9600] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
            onClick={() => setPoDetailModal({ open: false, order: null })}
          >
            <div
              className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 bg-slate-800/60 border-b border-slate-700 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-violet-400" />
                  <span className="font-black text-sm text-white uppercase">Chi tiết đơn hàng {o.id}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPoDetailModal({ open: false, order: null })}
                  className="p-1.5 hover:bg-slate-700 rounded-full text-slate-300 cursor-pointer transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="block text-slate-400 font-bold text-[10px] uppercase">Nhà cung cấp</label>
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs font-bold text-slate-100">{o.supplierName || '—'}</div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-slate-400 font-bold text-[10px] uppercase">Tổng tiền</label>
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs font-black text-violet-300">{(o.tongTien || 0).toLocaleString('vi-VN')} đ</div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-slate-400 font-bold text-[10px] uppercase">Công nợ</label>
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs font-black text-rose-400">{congNo > 0 ? `${congNo.toLocaleString('vi-VN')} đ` : '0 đ'}</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-slate-400 font-bold text-[10px] uppercase">Đã thanh toán</label>
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs font-bold text-emerald-400">{(paid).toLocaleString('vi-VN')} đ</div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-slate-400 font-bold text-[10px] uppercase">Trạng thái</label>
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs font-bold text-slate-200">{poStatusLabel(o.status)}</div>
                  </div>
                </div>
                {o.notes ? (
                  <div className="space-y-1">
                    <label className="block text-slate-400 font-bold text-[10px] uppercase">Ghi chú</label>
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-slate-300 whitespace-pre-line">{o.notes}</div>
                  </div>
                ) : null}
                <div className="space-y-1">
                  <label className="block text-slate-400 font-bold text-[10px] uppercase">Danh mục vật tư</label>
                  <div className="border border-slate-700 rounded-xl divide-y divide-slate-800">
                    {(o.items || []).length === 0 ? (
                      <div className="p-4 text-center text-[11px] text-slate-500">Đơn hàng chưa có vật tư.</div>
                    ) : (o.items || []).map((it: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between gap-2 p-2.5">
                        <div className="flex-1">
                          <span className="text-[11px] font-semibold text-slate-200">{poItemName(it)}</span>
                          <span className="ml-1.5 text-[9px] text-slate-400">{poItemQty(it)} {poItemUnit(it)}</span>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-violet-300">{poItemTotal(it).toLocaleString('vi-VN')} đ</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-4 bg-slate-800/60 border-t border-slate-700 flex gap-2">
                {congNo > 0 && (
                  <button
                    type="button"
                    onClick={() => { setPoPaymentAmount(String(congNo)); setPoPaymentNote(''); setPoPaymentModal({ open: true, order: o }); setPoDetailModal({ open: false, order: null }); }}
                    className="flex-1 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black py-2.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all"
                  >
                    <Circle className="w-3.5 h-3.5" /> Tạo phiếu chi
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPoDetailModal({ open: false, order: null })}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-[11px] font-bold py-2.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: TẠO PHIẾU CHI CHO ĐƠN HÀNG */}
      {poPaymentModal.open && poPaymentModal.order && (() => {
        const o = poPaymentModal.order;
        const congNo = o.congNo || 0;
        return (
          <div
            className="fixed inset-0 z-[9600] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
            onClick={() => setPoPaymentModal({ open: false, order: null })}
          >
            <div
              className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 bg-slate-800/60 border-b border-slate-700 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Circle className="w-5 h-5 text-rose-400" />
                  <span className="font-black text-sm text-white uppercase">Tạo phiếu chi — {o.id}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPoPaymentModal({ open: false, order: null })}
                  className="p-1.5 hover:bg-slate-700 rounded-full text-slate-300 cursor-pointer transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="space-y-1">
                  <label className="block text-slate-400 font-bold text-[10px] uppercase">Nhà cung cấp (thụ hưởng)</label>
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs font-bold text-slate-100">{o.supplierName || '—'}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-slate-400 font-bold text-[10px] uppercase">Công nợ còn lại</label>
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs font-black text-rose-400">{congNo.toLocaleString('vi-VN')} đ</div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-slate-400 font-bold text-[10px] uppercase">Ngày lập</label>
                    <input
                      type="date"
                      value={poPaymentDate}
                      onChange={(e) => setPoPaymentDate(e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 outline-none focus:border-rose-500 w-full"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-400 font-bold text-[10px] uppercase">Số tiền thanh toán (đ) *</label>
                  <input
                    type="number"
                    value={poPaymentAmount}
                    onChange={(e) => setPoPaymentAmount(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-slate-100 outline-none focus:border-rose-500 w-full font-mono font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-400 font-bold text-[10px] uppercase">Hình thức thanh toán</label>
                  <select
                    value={poPaymentMethod}
                    onChange={(e) => setPoPaymentMethod(e.target.value as 'cash' | 'transfer')}
                    className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 outline-none focus:border-rose-500 w-full"
                  >
                    <option value="transfer">Chuyển khoản</option>
                    <option value="cash">Tiền mặt</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-400 font-bold text-[10px] uppercase">Ghi chú</label>
                  <textarea
                    value={poPaymentNote}
                    onChange={(e) => setPoPaymentNote(e.target.value)}
                    rows={2}
                    placeholder={`Thanh toán đơn hàng ${o.id}`}
                    className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 outline-none focus:border-rose-500 w-full resize-none"
                  />
                </div>
              </div>
              <div className="p-4 bg-slate-800/60 border-t border-slate-700 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPoPaymentModal({ open: false, order: null })}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-[11px] font-bold py-2.5 rounded-lg cursor-pointer transition-all"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => handleCreatePoPayment(o)}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black py-2.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all"
                >
                  <Circle className="w-3.5 h-3.5" /> Tạo phiếu chi
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
