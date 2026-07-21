import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { dbService } from '../lib/dbService';
import { Receipt, Payment, Project, Customer, Employee, SupplierPartner, SubcontractorAdvanceProposal, Supplier, InventoryItem, ArchivedQuote, Liability } from '../types';
import { useNotification, isUserInRoleGroup } from '../context';
import * as XLSX from 'xlsx';

import {
  Plus,
  Search,
  DollarSign,
  Wallet,
  FileDown,
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
  ClipboardList,
  BarChart3,
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
  DollarSign as MoneyIcon
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

interface FinanceProps {
  receipts: Receipt[];
  payments: Payment[];
  projects: Project[];
  customers: Customer[];
  currentUser: any;
  employees?: Employee[];
  onAddReceipt: (newRec: Receipt) => void;
  onAddPayment: (newPay: Payment) => void;
  onApprovePayment: (id: string, status: 'approved' | 'rejected') => void;
  onAddCustomer?: (newCust: Customer) => void;
  onDeleteCustomer?: (id: string) => void;
  onDeleteReceipt?: (id: string) => void;
  onDeletePayment?: (id: string) => void;
  onDeleteMaterial?: (id: string) => void;
  initialSubTab?: string;
  initialDuLieuTab?: string;
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
  onAddReceipt,
  onAddPayment,
  onApprovePayment,
  onAddCustomer,
  onDeleteCustomer,
  onDeleteReceipt,
  onDeletePayment,
  onDeleteMaterial,
  initialSubTab,
  initialDuLieuTab
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
    // Ưu tiên cache từ Supabase
    let rolesList: any[] = [];
    const supCached = localStorage.getItem('hl_cached_hrm_role_groups');
    if (supCached) {
      try { rolesList = JSON.parse(supCached); } catch {}
    }
    if (rolesList.length === 0) {
      const savedRoles = localStorage.getItem('hl_hrm_roles_v2');
      if (!savedRoles) return true;
      try { rolesList = JSON.parse(savedRoles); } catch {}
    }
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
  const [isCustRepManuallyEdited, setIsCustRepManuallyEdited] = useState(false);
  const [editingCustId, setEditingCustId] = useState<string | null>(null);

  // Search filters
  const [searchTerm, setSearchTerm] = useState('');
  const [projectFilter, setProjectFilter] = useState('');

  // Local persistent states for accounting-specific lists
  const [subContracts, setSubContracts] = useState<SubContract[]>(() => {
    const saved = localStorage.getItem('hl_acc_subcontracts');
    return saved ? JSON.parse(saved) : [];
  });

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

  useEffect(() => {
    let active = true;
    const fetchAdvances = async () => {
      try {
        const list = await dbService.subcontractorAdvances.list();
        if (active) {
          setSubcontractorAdvances(list);
          // Đồng bộ sang localStorage để tab Công việc (Việc của tôi) có thể đọc
          localStorage.setItem('hl_subcontractor_advances', JSON.stringify(list));
        }
      } catch (err) {
        console.error("Lỗi khi tải đề xuất tạm ứng thầu phụ:", err);
        // Fallback to localStorage
        const saved = localStorage.getItem('hl_subcontractor_advances');
        if (saved && active) {
          try { setSubcontractorAdvances(JSON.parse(saved)); } catch (e) {}
        }
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
      
      // Update localStorage
      let existing: SubcontractorAdvanceProposal[] = [];
      const saved = localStorage.getItem('hl_subcontractor_advances');
      if (saved) {
        try { existing = JSON.parse(saved); } catch (e) {}
      }
      existing = existing.map(p => p.id === updated.id ? updated : p);
      localStorage.setItem('hl_subcontractor_advances', JSON.stringify(existing));

      window.dispatchEvent(new CustomEvent('hl-subcontractor-advances-updated', { detail: updated }));
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
      
      // Update localStorage
      let existing: SubcontractorAdvanceProposal[] = [];
      const saved = localStorage.getItem('hl_subcontractor_advances');
      if (saved) {
        try { existing = JSON.parse(saved); } catch (e) {}
      }
      existing = existing.map(p => p.id === updated.id ? updated : p);
      localStorage.setItem('hl_subcontractor_advances', JSON.stringify(existing));

      window.dispatchEvent(new CustomEvent('hl-subcontractor-advances-updated', { detail: updated }));
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
      
      // Update localStorage
      let existing: SubcontractorAdvanceProposal[] = [];
      const saved = localStorage.getItem('hl_subcontractor_advances');
      if (saved) {
        try { existing = JSON.parse(saved); } catch (e) {}
      }
      existing = existing.map(p => p.id === updated.id ? updated : p);
      localStorage.setItem('hl_subcontractor_advances', JSON.stringify(existing));

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

      // Update localStorage
      let existing: SubcontractorAdvanceProposal[] = [];
      const saved = localStorage.getItem('hl_subcontractor_advances');
      if (saved) {
        try { existing = JSON.parse(saved); } catch (e) {}
      }
      existing = existing.map(p => p.id === updated.id ? updated : p);
      localStorage.setItem('hl_subcontractor_advances', JSON.stringify(existing));

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
  const [customLiabilities, setCustomLiabilities] = useState<Liability[]>(() => {
    const saved = localStorage.getItem('hl_acc_custom_liabilities');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('hl_acc_custom_liabilities', JSON.stringify(customLiabilities));
    // Đồng bộ Supabase
    customLiabilities.forEach(l => {
      dbService.accountingLiabilities.save(l).catch(() => {});
    });
  }, [customLiabilities]);

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
      const paymentsMade = payments.filter(p => p.recipient === sub.subcontractorName && p.status === 'approved');
      const totalPaidAmount = paymentsMade.reduce((sum, p) => sum + p.amount, 0);
      const value = sub.contractValue || 0;
      const remaining = value - totalPaidAmount;
      return {
        id: sub.id,
        name: sub.subcontractorName,
        category: 'Thầu Phụ',
        value,
        paid: totalPaidAmount,
        remaining,
        notes: sub.notes || sub.workName || 'Hợp đồng thầu phụ thi công',
        isAuto: true
      };
    });

    const customs = customLiabilities.map(liab => {
      const paymentsMade = payments.filter(p => p.recipient === liab.name && p.status === 'approved');
      const totalPaidAmount = paymentsMade.length > 0 ? paymentsMade.reduce((sum, p) => sum + p.amount, 0) : (liab.paid || 0);
      const remaining = liab.value - totalPaidAmount;
      return {
        ...liab,
        paid: totalPaidAmount,
        remaining,
        isAuto: false
      };
    });

    return [...subs, ...customs];
  }, [approvedSubContracts, customLiabilities, payments]);

  const [suppliers, setSuppliers] = useState<SupplierPartner[]>(() => {
    const saved = localStorage.getItem('hl_acc_suppliers');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((s: any) => ({
          id: s.id,
          name: s.name,
          representative: s.representative || s.name,
          gender: s.gender || 'Nam',
          birthDate: s.birthDate || '',
          cccd: s.cccd || s.taxCode || '',
          cccdDate: s.cccdDate || '',
          cccdPlace: s.cccdPlace || '',
          address: s.address || s.region || 'Đà Lạt',
          phone: s.phone || '',
          email: s.email || '',
          taxCode: s.taxCode || '',
          bankAccount: s.bankAccount || s.bankNo || '',
          bankName: s.bankName || '',
          field: s.field || 'Thợ thầu thi công',
          note: s.note || '',
          region: s.region || s.address || 'Đà Lạt',
          bankNo: s.bankNo || s.bankAccount || ''
        }));
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });

  const [inventory, setInventory] = useState<MaterialStock[]>(() => {
    const saved = localStorage.getItem('hl_acc_inventory');
    if (saved) return JSON.parse(saved);
    return [];
  });

  // Dữ liệu kế toán - Định mức công tác phí
  const [travelNorms, setTravelNorms] = useState<TravelAllowanceNorm[]>(() => {
    const saved = localStorage.getItem('hl_acc_travel_norms');
    let normsList: TravelAllowanceNorm[] = [];
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0 && 'content' in parsed[0]) {
          // Migration: if any item has old-style content (doesn't start with 'Đi ' and is not 'Nghỉ qua đêm'), trigger fresh defaults
          const needsMigration = parsed.some((item: any) => item.content !== 'Nghỉ qua đêm' && !item.content.startsWith('Đi '));
          if (!needsMigration) {
            normsList = parsed;
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
    if (normsList.length === 0) {
      normsList = [];
    }
    // Auto-repair missing or blank codes dynamically
    return normsList.map((norm, idx) => {
      if (!norm.code) {
        return {
          ...norm,
          code: `CTP_${String(idx + 1).padStart(3, '0')}`
        };
      }
      return norm;
    });
  });

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

  const [duLieuTab, setDuLieuTab] = useState<'khach_hang' | 'ncc_thau_phu' | 'vat_tu'>(
    (initialDuLieuTab as 'khach_hang' | 'ncc_thau_phu' | 'vat_tu') || 'khach_hang'
  );

  useEffect(() => {
    if (initialDuLieuTab) {
      setDuLieuTab(initialDuLieuTab as 'khach_hang' | 'ncc_thau_phu' | 'vat_tu');
    }
  }, [initialDuLieuTab]);

  // Reset receipt/payment selections when switching between nhap_thu and nhap_chi
  useEffect(() => {
    setRecSelectedRows(new Set());
    setPaySelectedRows(new Set());
  }, [activeSubTab]);

  // Pagination & selection states for "Dữ liệu kế toán" tabs
  const [pageCust, setPageCust] = useState(1);
  const [pageSizeCust, setPageSizeCust] = useState(5);

  const [pageSup, setPageSup] = useState(1);
  const [pageSizeSup, setPageSizeSup] = useState(5);
  const [selectedSupDetail, setSelectedSupDetail] = useState<SupplierPartner | null>(null);

  const [pageMat, setPageMat] = useState(1);
  const [pageSizeMat, setPageSizeMat] = useState(5);
  const [selectedMatDetail, setSelectedMatDetail] = useState<InventoryItem | null>(null);
  const [showTravelNormModal, setShowTravelNormModal] = useState(false);
  const [editingTravelNorm, setEditingTravelNorm] = useState<TravelAllowanceNorm | null>(null);

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
  const [showSupplierForm, setShowSupplierForm] = useState(false);
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

  // Form Inputs - Chi: Ưu tiên dùng employees prop từ App (cloud data), fallback localStorage
  const employees = useMemo(() => {
    // Dùng prop employees từ App.tsx (đã load từ Supabase)
    if (employeesProp && employeesProp.length > 0) {
      return employeesProp.map(emp => ({
        id: emp.id,
        name: emp.name || '',
        position: (emp as any).position || '',
        department: emp.department || ''
      }));
    }
    // Fallback: đọc từ localStorage nếu prop chưa sẵn sàng
    const saved = localStorage.getItem('hl_hrm_employees_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((emp: any) => ({
            id: emp.id || `emp_${Math.random()}`,
            name: emp.name || '',
            position: emp.position || '',
            department: emp.department || ''
          }));
        }
      } catch (e) {
        console.error("Lỗi khi parse nhân viên từ HRM:", e);
      }
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
  const [formSubPartner, setFormSubPartner] = useState(suppliers[0]?.id || '');
  const [formSubScope, setFormSubScope] = useState('');
  const [formSubValue, setFormSubValue] = useState<number>(0);

  // Form Inputs - Thêm đối tác / Thầu phụ
  const [editingSupId, setEditingSupId] = useState<string | null>(null);
  const [formSupName, setFormSupName] = useState('');
  const [formSupRep, setFormSupRep] = useState('');
  const [formSupGender, setFormSupGender] = useState('Nam');
  const [formSupBirthDate, setFormSupBirthDate] = useState('');
  const [formSupCccd, setFormSupCccd] = useState('');
  const [formSupCccdDate, setFormSupCccdDate] = useState('');
  const [formSupCccdPlace, setFormSupCccdPlace] = useState('');
  const [formSupEmail, setFormSupEmail] = useState('');
  const [formSupBankAccount, setFormSupBankAccount] = useState('');
  const [formSupBankName, setFormSupBankName] = useState('');
  const [formSupPhone, setFormSupPhone] = useState('');
  const [formSupField, setFormSupField] = useState('Thợ thầu thi công');
  const [formSupAddress, setFormSupAddress] = useState('');
  const [formSupTaxCode, setFormSupTaxCode] = useState('');
  const [formSupNote, setFormSupNote] = useState('');
  const [isRepManuallyEdited, setIsRepManuallyEdited] = useState(false);

  // Form Inputs - Thêm vật tư
  const [formMatCode, setFormMatCode] = useState('');
  const [formMatName, setFormMatName] = useState('');
  const [formMatUnit, setFormMatUnit] = useState('Tấm');
  const [formMatQty, setFormMatQty] = useState<number>(50);
  const [formMatPrice, setFormMatPrice] = useState<number>(350000);
  const [formMatLocation, setFormMatLocation] = useState('Kho lớn xưởng mộc');

  // Trigger local storage updates
  useEffect(() => {
    localStorage.setItem('hl_acc_subcontracts', JSON.stringify(subContracts));
  }, [subContracts]);

  useEffect(() => {
    localStorage.setItem('hl_acc_suppliers', JSON.stringify(suppliers));
    // Đồng bộ Supabase
    suppliers.forEach(s => {
      dbService.suppliers.save(s).catch(() => {});
    });
  }, [suppliers]);

  useEffect(() => {
    const handleSuppliersUpdated = async () => {
      try {
        const list = await dbService.suppliers.list();
        if (list && list.length > 0) setSuppliers(list);
      } catch (e) {
        // Fallback localStorage
        const saved = localStorage.getItem('hl_acc_suppliers');
        if (saved) {
          try { setSuppliers(JSON.parse(saved)); } catch (err) { console.error(err); }
        }
      }
    };
    window.addEventListener('hl-suppliers-updated', handleSuppliersUpdated);
    return () => {
      window.removeEventListener('hl-suppliers-updated', handleSuppliersUpdated);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('hl_acc_inventory', JSON.stringify(inventory));
    // Đồng bộ Supabase
    inventory.forEach(i => {
      dbService.inventory.save(i).catch(() => {});
    });
  }, [inventory]);

  useEffect(() => {
    const handleInventoryUpdated = async () => {
      try {
        const list = await dbService.inventory.list();
        if (list && list.length > 0) setInventory(list);
      } catch (e) {
        // Fallback localStorage
        const saved = localStorage.getItem('hl_acc_inventory');
        if (saved) {
          try { setInventory(JSON.parse(saved)); } catch (err) { console.error(err); }
        }
      }
    };
    window.addEventListener('hl-inventory-updated', handleInventoryUpdated);
    return () => {
      window.removeEventListener('hl-inventory-updated', handleInventoryUpdated);
    };
  }, []);

  useEffect(() => {
    setPageCust(1);
    setPageSup(1);
    setPageMat(1);
    setSelectedCustDetail(null);
    setSelectedSupDetail(null);
    setSelectedMatDetail(null);
  }, [duLieuTab, searchTerm]);

  useEffect(() => {
    localStorage.setItem('hl_acc_travel_norms', JSON.stringify(travelNorms));
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

  const handleAddPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newPay: Payment = {
      id: `pay_${Date.now()}`,
      code: `PC-2026-${Math.floor(Math.random() * 900 + 100)}`,
      date: new Date().toISOString().split('T')[0],
      recipient: payRecipient,
      projectId: (payProj === 'none' || !payProj) ? undefined : payProj,
      category: payCategory,
      amount: Number(payAmount),
      paymentMethod: payMethod,
      notes: payNotes,
      proposer: currentUser.name,
      approver: 'Trương Hữu Long (Giám đốc)',
      status: (currentUser && isUserInRoleGroup(currentUser.id, 'role_admin')) ? 'approved' : 'pending',
      attachmentName: 'bien_nhan_giao_hang.pdf'
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

        // Update localStorage
        let existing: SubcontractorAdvanceProposal[] = [];
        const saved = localStorage.getItem('hl_subcontractor_advances');
        if (saved) {
          try { existing = JSON.parse(saved); } catch (e) {}
        }
        existing = existing.map(p => p.id === updatedProposal.id ? updatedProposal : p);
        localStorage.setItem('hl_subcontractor_advances', JSON.stringify(existing));

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
  const updatePayrollWithAdvance = (empName: string, amount: number, taskName: string) => {
    try {
      // Trích xuất kỳ lương từ taskName (định dạng: "Ứng lương kỳ MM/YYYY")
      const periodMatch = taskName.match(/Ứng lương kỳ\s*([\d]{2}\/[\d]{4})/);
      const period = periodMatch ? periodMatch[1] : new Date().toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' });

      let currentPayroll: any[] = [];
      const savedPayroll = localStorage.getItem('hl_hrm_payroll_v3');
      if (savedPayroll) {
        try { currentPayroll = JSON.parse(savedPayroll); } catch (err) {}
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

      localStorage.setItem('hl_hrm_payroll_v3', JSON.stringify(currentPayroll));

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
    setShowSubContractForm(false);
    addToast({ title: '✅ Thành công', message: `✍️ Ký số điện tử Hợp đồng thầu phụ mã ${newSub.code} thành công.`, type: 'success' });
  };

  const handleAddSupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSupName || !formSupPhone || !formSupAddress || !formSupRep) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'vui lòng điền đầy đủ các thông tin bắt buộc (Tên thầu phụ, Người đại diện, Điện thoại, Địa chỉ)!', type: 'warning' });
      return;
    }

    if (editingSupId) {
      const updated = suppliers.map(s => {
        if (s.id === editingSupId) {
          return {
            ...s,
            name: formSupName,
            representative: formSupRep,
            gender: formSupGender,
            birthDate: formSupBirthDate,
            cccd: formSupCccd,
            cccdDate: formSupCccdDate,
            cccdPlace: formSupCccdPlace,
            address: formSupAddress,
            phone: formSupPhone,
            email: formSupEmail,
            taxCode: formSupTaxCode,
            bankAccount: formSupBankAccount,
            bankName: formSupBankName,
            field: formSupField,
            note: formSupNote,
            region: formSupAddress, // sync legacy field
            bankNo: formSupBankAccount
          };
        }
        return s;
      });
      setSuppliers(updated);

      if (selectedSupDetail && selectedSupDetail.id === editingSupId) {
        setSelectedSupDetail({
          id: editingSupId,
          name: formSupName,
          representative: formSupRep,
          gender: formSupGender,
          birthDate: formSupBirthDate,
          cccd: formSupCccd,
          cccdDate: formSupCccdDate,
          cccdPlace: formSupCccdPlace,
          address: formSupAddress,
          phone: formSupPhone,
          email: formSupEmail,
          taxCode: formSupTaxCode,
          bankAccount: formSupBankAccount,
          bankName: formSupBankName,
          field: formSupField,
          note: formSupNote,
          region: formSupAddress,
          bankNo: formSupBankAccount
        });
      }

      setEditingSupId(null);
      setShowSupplierForm(false);
      resetSupForm();
      addToast({ title: '✅ Thành công', message: `✅ Đã cập nhật thông tin thầu phụ ${formSupName} thành công.`, type: 'success' });
    } else {
      const abbrev = getAbbreviation(formSupName) || 'TP';
      const orderIndex = suppliers.length + 1;
      const generatedId = `${abbrev}_${orderIndex}`;

      const newSup: SupplierPartner = {
        id: generatedId,
        name: formSupName,
        representative: formSupRep || formSupName,
        gender: formSupGender,
        birthDate: formSupBirthDate,
        cccd: formSupCccd,
        cccdDate: formSupCccdDate,
        cccdPlace: formSupCccdPlace,
        address: formSupAddress,
        phone: formSupPhone,
        email: formSupEmail,
        taxCode: formSupTaxCode,
        bankAccount: formSupBankAccount,
        bankName: formSupBankName,
        field: formSupField,
        note: formSupNote,
        region: formSupAddress,
        bankNo: formSupBankAccount
      };

      setSuppliers([...suppliers, newSup]);
      setShowSupplierForm(false);
      resetSupForm();
      addToast({ title: '✅ Thành công', message: `🤝 Đã thêm thầu phụ mới ${newSup.name} với Mã: ${newSup.id} thành công.`, type: 'success' });
    }
  };

  const resetSupForm = () => {
    setFormSupName('');
    setFormSupRep('');
    setFormSupGender('Nam');
    setFormSupBirthDate('');
    setFormSupCccd('');
    setFormSupCccdDate('');
    setFormSupCccdPlace('');
    setFormSupEmail('');
    setFormSupBankAccount('');
    setFormSupBankName('');
    setFormSupPhone('');
    setFormSupField('Thợ thầu thi công');
    setFormSupAddress('');
    setFormSupTaxCode('');
    setFormSupNote('');
    setEditingSupId(null);
    setIsRepManuallyEdited(false);
  };

  const handleCloseCustomerModal = () => {
    setCustName('');
    setCustPhone('');
    setCustAddress('');
    setCustType('individual');
    setCustRep('');
    setCustTaxId('');
    setCustNotes('');
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
      notes: custNotes
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
    if (customers.length === 0) {
      addToast({ title: '⚠️ Không có dữ liệu', message: 'Chưa có khách hàng nào để xuất.', type: 'warning' });
      return;
    }
    const data = customers.map(c => ({
      'Mã KH': c.id,
      'Tên khách hàng': c.name,
      'Loại khách hàng': c.type === 'organization' ? 'Tổ chức' : 'Cá nhân',
      'Người đại diện': c.representative || c.name,
      'Mã số thuế': c.taxOrIdNumber || '',
      'Số điện thoại': c.phone || '',
      'Email': c.email || '',
      'Địa chỉ': c.address || '',
      'Ghi chú': c.notes || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DanhBaKhachHang');
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    XLSX.writeFile(wb, `DanhBaKhachHang_${ymd}.xlsx`);
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
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        const imported: Customer[] = rows.map((r, idx) => ({
          id: String(r['Mã KH'] || `KH_IMP_${Date.now()}_${idx}`),
          name: String(r['Tên khách hàng'] || '').trim(),
          type: (String(r['Loại khách hàng'] || 'Cá nhân') === 'Tổ chức' ? 'organization' : 'individual') as 'individual' | 'organization',
          representative: String(r['Người đại diện'] || r['Tên khách hàng'] || ''),
          taxOrIdNumber: String(r['Mã số thuế'] || ''),
          phone: String(r['Số điện thoại'] || ''),
          email: String(r['Email'] || ''),
          address: String(r['Địa chỉ'] || ''),
          notes: String(r['Ghi chú'] || ''),
        })).filter(r => r.name);
        if (imported.length === 0) {
          addToast({ title: '⚠️ Không có dữ liệu', message: 'File không có dòng hợp lệ (cần cột Tên khách hàng).', type: 'warning' });
          return;
        }
        if (onAddCustomer) {
          imported.forEach(c => onAddCustomer(c));
        } else {
          const merged = [...customers];
          imported.forEach(imp => {
            const dupIdx = merged.findIndex(c => c.id === imp.id || c.name.toLowerCase() === imp.name.toLowerCase());
            if (dupIdx > -1) merged[dupIdx] = { ...merged[dupIdx], ...imp };
            else merged.push(imp);
          });
          customers.length = 0;
          customers.push(...merged);
        }
        addToast({ title: '✅ Nhập thành công', message: `Đã import ${imported.length} khách hàng`, type: 'success' });
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
        id: 'liab_' + Date.now(),
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

  const confirmDeleteLiability = () => {
    if (liabToDelete) {
      setCustomLiabilities(prev => prev.filter(x => x.id !== liabToDelete.id));
      addToast({ title: '🗑️ Đã xóa', message: `🗑️ Đã xóa công nợ phải trả của đơn vị "${liabToDelete.name}".`, type: 'info' });
      setLiabToDelete(null);
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

                <button
                  type="button"
                  onClick={() => { setActiveSubTab('tong_hop_ct'); setSearchTerm(''); }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left font-bold transition-all ${activeSubTab === 'tong_hop_ct' ? 'bg-slate-800/90 text-white border-l-4 border-orange-500' : 'text-slate-400 hover:text-white hover:bg-slate-850/50'}`}
                >
                  <span className="flex items-center gap-2">
                    <ClipboardList className="w-3.5 h-3.5 text-teal-400" />
                    <span>Tổng hợp CT</span>
                  </span>
                  <span className="text-teal-400 font-mono text-[9px]">%</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setActiveSubTab('tong_hop_mang'); setSearchTerm(''); }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left font-bold transition-all ${activeSubTab === 'tong_hop_mang' ? 'bg-slate-800/90 text-white border-l-4 border-orange-500' : 'text-slate-400 hover:text-white hover:bg-slate-850/50'}`}
                >
                  <span className="flex items-center gap-2">
                    <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Tổng hợp Mảng</span>
                  </span>
                  <span className="bg-emerald-500/10 text-emerald-400 text-[8.5px] px-1 rounded">Biểu</span>
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

                      <li>
                        <button
                          type="button"
                          onClick={() => { setActiveSubTab('tong_hop_ct'); setSearchTerm(''); }}
                          aria-current={activeSubTab === 'tong_hop_ct' ? 'page' : undefined}
                          className={`group inline-flex items-center justify-center px-4 py-3 border-b border-transparent rounded-t-lg transition-all whitespace-nowrap cursor-pointer text-xs font-bold ${activeSubTab === 'tong_hop_ct' ? 'text-orange-600 border-orange-500' : 'text-slate-600 hover:text-orange-600 hover:border-slate-300'}`}
                        >
                          <ClipboardList className={`w-4 h-4 me-2 ${activeSubTab === 'tong_hop_ct' ? 'text-orange-600' : 'text-slate-400 group-hover:text-orange-600'}`} />
                          <span>Tổng hợp CT</span>
                        </button>
                      </li>

                      <li>
                        <button
                          type="button"
                          onClick={() => { setActiveSubTab('tong_hop_mang'); setSearchTerm(''); }}
                          aria-current={activeSubTab === 'tong_hop_mang' ? 'page' : undefined}
                          className={`group inline-flex items-center justify-center px-4 py-3 border-b border-transparent rounded-t-lg transition-all whitespace-nowrap cursor-pointer text-xs font-bold ${activeSubTab === 'tong_hop_mang' ? 'text-orange-600 border-orange-500' : 'text-slate-600 hover:text-orange-600 hover:border-slate-300'}`}
                        >
                          <BarChart3 className={`w-4 h-4 me-2 ${activeSubTab === 'tong_hop_mang' ? 'text-orange-600' : 'text-slate-400 group-hover:text-orange-600'}`} />
                          <span>Tổng hợp Mảng</span>
                        </button>
                      </li>

                    </ul>
                  </div>

                </div>

                {/* Sub summary metrics shown horizontally in tab mode for high density data visualization */}
                <div className="flex flex-wrap items-center gap-4 text-[10px] font-mono border-t border-slate-800 pt-2 px-1 text-slate-400 justify-between">
                  <div className="flex items-center gap-1">
                    <span className="text-orange-500 font-extrabold uppercase text-[9px] tracking-wide">KẾ TOÁN:</span>
                    <span className="text-slate-300 font-bold font-sans">Quản lý Thu–Chi</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <span>HĐ:</span>
                      <span className="text-slate-100 font-bold">{activeProjectsCount} CT</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-emerald-400">Thu:</span>
                      <span className="text-emerald-400 font-bold font-sans">
                        {(totalRevenueSum / 1000000).toLocaleString('vi-VN')} tr
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-rose-500">Chi:</span>
                      <span className="text-rose-500 font-bold font-sans">
                        {(totalExpenseSum / 1000000).toLocaleString('vi-VN')} tr
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            )}
            
            {/* Header / Sub-tab Title */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-850 pb-4 mb-5 gap-3 shrink-0">
              <div>
                <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                  {activeSubTab === 'de_xuat_thu_chi' && '📋 Phê duyệt Đề xuất Thu Chi Tạm Ứng'}
                  {activeSubTab === 'dashboard' && '📊 Dashboard Thống kê Kế toán Tổng lực'}
                  {activeSubTab === 'khach_hang' && '👥 Danh bạ Khách hàng & Số dư tài sản'}
                  {activeSubTab === 'vat_tu' && '📦 Sổ kho & Nguyên vật liệu gỗ ván MDF An Cường'}
                  {activeSubTab === 'nhap_thu' && '💚 Sổ phiếu thu tiền tạm ứng Chủ Đầu Tư'}
                  {activeSubTab === 'nhap_chi' && '🔴 Phê duyệt Đề xuất Chi phí xưởng & vật tư'}
                  {activeSubTab === 'cong_no_phai_thu' && '📈 Chi tiết nợ Phải Thu Chủ Nhà (Bên A)'}
                  {activeSubTab === 'cong_no_phai_tra' && '📉 Chi tiết nợ Phải Trả Thầu Thợ & Đại lý'}
                  {activeSubTab === 'tong_hop_ct' && '📋 Sổ kế toán tổng hợp công trình (Tống lãi thuần)'}
                  {activeSubTab === 'tong_hop_mang' && '📈 Tổng quan Cân đối mảng kinh doanh liên phân mảng'}
                  {activeSubTab === 'du_lieu_ke_toan' && (
                    duLieuTab === 'khach_hang' ? '👥 Danh bạ Khách hàng & Số dư tài sản' :
                    duLieuTab === 'vat_tu' ? '📦 Sổ kho & Nguyên vật liệu gỗ ván MDF An Cường' :
                    '📁 Cấu hình Dữ liệu Kế toán'
                  )}
                </h2>
                <p className="text-[11px] text-slate-400 mt-1">
                  {activeSubTab === 'de_xuat_thu_chi' && 'Quản lý, xét duyệt các yêu cầu đề xuất tạm ứng thầu phụ và lập phiếu ủy nhiệm chi.'}
                  {activeSubTab === 'dashboard' && 'Biểu đồ cán cân, liệt kê giao dịch tức thời dòng tiền mộc mộc dẻo dai.'}
                  {activeSubTab === 'khach_hang' && 'Danh sách khách hàng, cập nhật dư nợ và liên kết các dự án.'}
                  {activeSubTab === 'vat_tu' && 'Theo dõi tồn kho tấm gỗ, thanh sắt hộp, sơn lót phục chống mục.'}
                  {activeSubTab === 'nhap_thu' && 'Thu tiền mặt kịch khung mâm thợ hoặc chuyển khoản MBBank.'}
                  {activeSubTab === 'nhap_chi' && 'Quản lý đề xuất chi tiêu, ủy nhiệm chi gỗ ván, nhân công sản xuất.'}
                  {activeSubTab === 'cong_no_phai_thu' && 'Phát hành nhanh văn bản Giấy đề nghị thanh toán mốc thợ.'}
                  {activeSubTab === 'cong_no_phai_tra' && 'Ủy ban lập nhanh đề xuất chi trả đại đơn hàng.'}
                  {activeSubTab === 'tong_hop_ct' && 'Dự án cốt móng, vách mộc, biên lợi nhuận ròng sạch.'}
                  {activeSubTab === 'tong_hop_mang' && 'So sánh kết quả giữa Gỗ Nội Thất, Xây Thô Thầu, Cơ Khí Sắt dầm.'}
                  {activeSubTab === 'du_lieu_ke_toan' && (
                    duLieuTab === 'khach_hang' ? 'Danh sách khách hàng, cập nhật dư nợ và liên kết các dự án.' :
                    duLieuTab === 'vat_tu' ? 'Theo dõi tồn kho tấm gỗ, thanh sắt hộp, sơn lót phục chống mục.' :
                    'Quản lý dữ liệu kế toán tổng hợp cho hoạt động doanh nghiệp.'
                  )}
                </p>
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





              </div>
            )}

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
                    return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] px-2.5 py-1 rounded-full font-bold">Chờ Duyệt (Kế toán)</span>;
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
                      <span className="text-amber-400 text-[10px] font-bold uppercase tracking-wider block font-sans">Chờ Duyệt (Kế toán)</span>
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
                          {proposalTypeFilter === 'all' && "Danh sách Đề xuất Thu Chi & Tạm ứng thầu phụ"}
                          {proposalTypeFilter === 'subcontractor' && "Danh sách Đề xuất Tạm ứng Thầu phụ"}
                          {proposalTypeFilter === 'expense' && "Danh sách Đề xuất Chi phí phát sinh công trình"}
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">Xử lý phê duyệt tạm ứng thầu phụ, chi phí phát sinh công trình và kết nối sổ quỹ kế toán chi tiền.</p>
                      </div>

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
              const filteredCustomers = customers.filter(c => 
                c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                (c.phone && c.phone.includes(searchTerm)) || 
                c.id.toLowerCase().includes(searchTerm.toLowerCase())
              );

              const limitCust = pageSizeCust === -1 ? filteredCustomers.length : pageSizeCust;
              const startIndexCust = (pageCust - 1) * limitCust;
              const endIndexCust = startIndexCust + limitCust;
              const paginatedCustomers = filteredCustomers.slice(startIndexCust, endIndexCust);
              const totalPagesCust = Math.ceil(filteredCustomers.length / limitCust) || 1;

              return (
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                    <span className="font-bold text-slate-300 uppercase tracking-wide text-[11px]">
                      Sổ Danh sách khách hàng mộc thợ ({filteredCustomers.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddCustomerModal(true)}
                      className="bg-orange-600 hover:bg-orange-550 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shadow-md"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Thêm KH Mới
                    </button>
                    <div className="flex gap-2">
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
                              <th className="p-3">Người đại điện</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {paginatedCustomers.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="p-8 text-center text-slate-500 italic">
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

                                  {/* Representative Column */}
                                  <td className="p-3 whitespace-nowrap text-slate-300 font-bold">
                                    {c.representative || c.name}
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
              <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
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

            {/* TAB 4: DANH MỤC THẦU PHỤ */}
            {activeSubTab === 'du_lieu_ke_toan' && duLieuTab === 'ncc_thau_phu' && (() => {
              return null;
              const filteredSuppliers = suppliers.filter(s => 
                s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                s.field.toLowerCase().includes(searchTerm.toLowerCase()) || 
                (s.phone && s.phone.includes(searchTerm)) || 
                (s.representative && s.representative.toLowerCase().includes(searchTerm.toLowerCase())) ||
                s.id.toLowerCase().includes(searchTerm.toLowerCase())
              );

              const limitSup = pageSizeSup === -1 ? filteredSuppliers.length : pageSizeSup;
              const totalPagesSup = Math.ceil(filteredSuppliers.length / limitSup) || 1;
              const adjustedPageSup = Math.min(pageSup, totalPagesSup);
              const startIndexSup = (adjustedPageSup - 1) * limitSup;
              const endIndexSup = startIndexSup + limitSup;
              const paginatedSuppliers = filteredSuppliers.slice(startIndexSup, endIndexSup);

              const handleNameChange = (val: string) => {
                setFormSupName(val);
                if (!isRepManuallyEdited) {
                  setFormSupRep(val);
                }
              };

              const handleRepChange = (val: string) => {
                setFormSupRep(val);
                setIsRepManuallyEdited(true);
              };

              return (
                <div className="space-y-4">
                  
                  <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                    <span className="font-bold text-slate-300 uppercase tracking-wide text-[11px]">Danh Mục Thầu Phụ ({filteredSuppliers.length})</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (!canCreate) {
                          addToast({ title: '⛔ Không có quyền', message: 'Tài khoản của bạn không có quyền KHỞI TẠO thầu phụ mới.', type: 'error' });
                          return;
                        }
                        if (showSupplierForm && editingSupId) {
                          // If editing, clear edit and show add
                          resetSupForm();
                        } else {
                          setShowSupplierForm(!showSupplierForm);
                        }
                      }}
                      className={`font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 ${canCreate ? 'bg-orange-600 hover:bg-orange-553 text-white cursor-pointer' : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'}`}
                    >
                      {editingSupId ? '✏️ Đang sửa thầu phụ' : '+ Thêm thầu phụ mới'}
                    </button>
                  </div>

                  <div id="subcontractor_form_anchor" />

                  {showSupplierForm && (
                    <form onSubmit={handleAddSupplierSubmit} className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3 animate-scaleIn">
                      <h4 className="text-white font-bold text-xs uppercase tracking-wide border-b border-slate-800 pb-1 text-left">
                        {editingSupId ? `✏️ Cập nhật thông tin Thầu phụ: ${editingSupId}` : '🤝 Đăng ký Thầu phụ mới'}
                      </h4>

                      {/* Row 1: Tên thầu phụ, Họ tên Bên B, Giới tính */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[10.5px] text-left">
                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">Tên Thầu Phụ <span className="text-red-400">*</span>:</label>
                          <input
                            type="text"
                            required
                            value={formSupName}
                            onChange={(e) => handleNameChange(e.target.value)}
                            placeholder="Nhập tên tổ đội / thầu phụ khoán..."
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none focus:border-orange-500"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">Người Đại Diện / Bên B <span className="text-red-400">*</span>:</label>
                          <input
                            type="text"
                            required
                            value={formSupRep}
                            onChange={(e) => handleRepChange(e.target.value)}
                            placeholder="Họ tên người nhận khoán..."
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none focus:border-orange-500"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">Giới tính Bên B:</label>
                          <select
                            value={formSupGender}
                            onChange={(e) => setFormSupGender(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none focus:border-orange-500"
                          >
                            <option value="Nam">Nam</option>
                            <option value="Nữ">Nữ</option>
                          </select>
                        </div>
                      </div>

                      {/* Row 2: Ngày sinh, Điện thoại, Email */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[10.5px] text-left">
                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">Ngày sinh Bên B:</label>
                          <input
                            type="date"
                            value={formSupBirthDate}
                            onChange={(e) => setFormSupBirthDate(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none focus:border-orange-500 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">Số Điện Thoại <span className="text-red-400">*</span>:</label>
                          <input
                            type="text"
                            required
                            value={formSupPhone}
                            onChange={(e) => setFormSupPhone(e.target.value)}
                            placeholder="Nhập số điện thoại..."
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none focus:border-orange-500"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">Email Bên B:</label>
                          <input
                            type="email"
                            value={formSupEmail}
                            onChange={(e) => setFormSupEmail(e.target.value)}
                            placeholder="Email liên hệ..."
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none focus:border-orange-500 font-mono"
                          />
                        </div>
                      </div>

                      {/* Row 3: CCCD, Ngày cấp, Nơi cấp */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[10.5px] text-left">
                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">Số CCCD Bên B:</label>
                          <input
                            type="text"
                            value={formSupCccd}
                            onChange={(e) => setFormSupCccd(e.target.value)}
                            placeholder="Nhập số CCCD..."
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none focus:border-orange-500 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">Ngày cấp CCCD:</label>
                          <input
                            type="date"
                            value={formSupCccdDate}
                            onChange={(e) => setFormSupCccdDate(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none focus:border-orange-500 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">Nơi cấp CCCD:</label>
                          <input
                            type="text"
                            value={formSupCccdPlace}
                            onChange={(e) => setFormSupCccdPlace(e.target.value)}
                            placeholder="Ví dụ: Cục Cảnh sát QLHC về TTXH..."
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none focus:border-orange-500"
                          />
                        </div>
                      </div>

                      {/* Row 4: Địa chỉ thường trú, Lĩnh vực */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[10.5px] text-left">
                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">Địa chỉ thường trú <span className="text-red-400">*</span>:</label>
                          <input
                            type="text"
                            required
                            value={formSupAddress}
                            onChange={(e) => setFormSupAddress(e.target.value)}
                            placeholder="Nhập địa chỉ đăng ký thường trú..."
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none focus:border-orange-500"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">Lĩnh vực hoạt động:</label>
                          <input
                            type="text"
                            value={formSupField}
                            onChange={(e) => setFormSupField(e.target.value)}
                            placeholder="Ví dụ: Thợ dán mâm Acrylic, sắt móng thô..."
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none focus:border-orange-500"
                          />
                        </div>
                      </div>

                      {/* Row 5: MST cá nhân, Số tài khoản, Ngân hàng */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[10.5px] text-left">
                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">MST cá nhân Bên B:</label>
                          <input
                            type="text"
                            value={formSupTaxCode}
                            onChange={(e) => setFormSupTaxCode(e.target.value)}
                            placeholder="Nhập mã số thuế cá nhân..."
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none focus:border-orange-500 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">Số tài khoản Bên B:</label>
                          <input
                            type="text"
                            value={formSupBankAccount}
                            onChange={(e) => setFormSupBankAccount(e.target.value)}
                            placeholder="Nhập số tài khoản ngân hàng..."
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none focus:border-orange-500 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">Mở tại ngân hàng:</label>
                          <input
                            type="text"
                            value={formSupBankName}
                            onChange={(e) => setFormSupBankName(e.target.value)}
                            placeholder="Ví dụ: Vietcombank - CN Lâm Đồng..."
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none focus:border-orange-500"
                          />
                        </div>
                      </div>

                      {/* Row 6: Ghi chú */}
                      <div className="text-[10.5px] text-left">
                        <label className="block text-slate-400 font-semibold mb-1">Ghi chú:</label>
                        <input
                          type="text"
                          value={formSupNote}
                          onChange={(e) => setFormSupNote(e.target.value)}
                          placeholder="Ghi chú về kinh nghiệm, năng lực hoặc đội thợ..."
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none focus:border-orange-500"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button 
                          type="button" 
                          onClick={() => {
                            setShowSupplierForm(false);
                            resetSupForm();
                          }} 
                          className="bg-slate-850 hover:bg-slate-800 px-3 py-1 rounded text-slate-300 font-bold cursor-pointer text-[10.5px]"
                        >
                          Hủy
                        </button>
                        <button type="submit" className="bg-orange-600 hover:bg-orange-550 text-white px-3.5 py-1 rounded font-bold text-[10.5px] cursor-pointer">
                          {editingSupId ? 'Lưu cập nhật' : 'Thêm Thầu phụ'}
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                    
                    {/* Left Table Panel */}
                    <div className={`${selectedSupDetail ? 'xl:col-span-7' : 'xl:col-span-12'} space-y-4 transition-all duration-300`}>
                      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto shadow-xl">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-extrabold uppercase text-[10px] tracking-wider font-sans">
                              <th className="p-3 pl-4">Mã Thầu Phụ</th>
                              <th className="p-3">Tên Thầu Phụ</th>
                              <th className="p-3">Người Đại Diện</th>
                              <th className="p-3">Lĩnh vực hoạt động</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {paginatedSuppliers.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="p-8 text-center text-slate-500 italic">
                                  Không tìm thấy thầu phụ nào phù hợp.
                                </td>
                              </tr>
                            ) : (
                              paginatedSuppliers.map(s => (
                                <tr 
                                  key={s.id} 
                                  onClick={() => setSelectedSupDetail(s)}
                                  className={`hover:bg-slate-800/40 cursor-pointer transition-colors ${
                                    selectedSupDetail?.id === s.id ? 'bg-orange-600/10 border-l-2 border-orange-500' : ''
                                  }`}
                                >
                                  {/* Subcontractor ID */}
                                  <td className="p-3 pl-4 font-mono font-bold text-yellow-500 text-[10px] uppercase">
                                    {s.id}
                                  </td>

                                  {/* Subcontractor Name */}
                                  <td className="p-3">
                                    <div className="font-extrabold text-white text-[12.5px]">
                                      {s.name}
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-0.5">
                                      Địa chỉ: <span className="text-slate-350">{s.address || s.region || 'Không có'}</span>
                                    </div>
                                  </td>

                                  {/* Representative */}
                                  <td className="p-3 text-slate-300 font-medium">
                                    {s.representative || s.name}
                                  </td>

                                  {/* Field / Contact */}
                                  <td className="p-3">
                                    <span className="text-orange-400 font-extrabold text-[11px] block">{s.field || 'Chưa phân loại'}</span>
                                    {s.phone && (
                                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                        ĐT: {s.phone}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination block */}
                      <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-900/60 p-3 rounded-xl border border-slate-800 gap-3 text-[11px] text-slate-400">
                        <div className="flex items-center gap-2">
                          <span>Số dòng hiển thị:</span>
                          <select
                            value={pageSizeSup}
                            onChange={(e) => {
                              setPageSizeSup(Number(e.target.value));
                              setPageSup(1);
                            }}
                            className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none cursor-pointer focus:border-orange-500 font-bold"
                          >
                            <option value={5}>5 dòng</option>
                            <option value={10}>10 dòng</option>
                            <option value={20}>20 dòng</option>
                            <option value={-1}>Tất cả</option>
                          </select>
                          <span>trong tổng số {filteredSuppliers.length} dòng</span>
                        </div>

                        {pageSizeSup !== -1 && totalPagesSup > 1 && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={adjustedPageSup === 1}
                              onClick={() => setPageSup(prev => Math.max(prev - 1, 1))}
                              className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-slate-300 hover:text-white disabled:opacity-35 disabled:pointer-events-none font-bold transition-all cursor-pointer"
                            >
                              ◀ Trước
                            </button>
                            <span className="font-mono text-slate-300 px-1">
                              Trang {adjustedPageSup} / {totalPagesSup}
                            </span>
                            <button
                              type="button"
                              disabled={adjustedPageSup === totalPagesSup}
                              onClick={() => setPageSup(prev => Math.min(prev + 1, totalPagesSup))}
                              className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-slate-300 hover:text-white disabled:opacity-35 disabled:pointer-events-none font-bold transition-all cursor-pointer"
                            >
                              Sau ▶
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Detail Panel */}
                    {selectedSupDetail && (() => {
                      const linkedSubs = subContracts.filter(sub => sub.subcontractorId === selectedSupDetail!.id);
                      return (
                        <div className="xl:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 sticky top-4 animate-scaleIn space-y-4 text-left text-xs">
                          <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                            <div className="flex items-center gap-2">
                              <span className="p-2 rounded bg-yellow-500/10 text-yellow-500">
                                <Briefcase className="w-4 h-4" />
                              </span>
                              <div>
                                <span className="font-mono text-[9px] text-yellow-500 font-extrabold uppercase tracking-wider">
                                  {selectedSupDetail!.id.toUpperCase()}
                                </span>
                                <h3 className="font-extrabold text-white text-sm mt-0.5">
                                  Hồ sơ Thầu phụ khoán
                                </h3>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedSupDetail(null)}
                              className="text-slate-400 hover:text-white bg-slate-850 p-1.5 rounded-lg transition-colors cursor-pointer"
                              title="Đóng xem chi tiết"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="space-y-4">
                            <div className="p-4 bg-slate-950/60 rounded-xl space-y-3 border border-slate-850">
                              <div>
                                <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Tên thầu phụ</span>
                                <strong className="text-white text-sm block font-extrabold mt-1">{selectedSupDetail!.name}</strong>
                              </div>

                              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-850/50">
                                <div>
                                  <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Người đại diện (Bên B)</span>
                                  <span className="text-white mt-1 block font-bold text-[11px]">{selectedSupDetail!.representative || selectedSupDetail!.name}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Giới tính</span>
                                  <span className="text-white mt-1 block font-medium text-[11px]">{selectedSupDetail!.gender || 'Nam'}</span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-850/50">
                                <div>
                                  <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Ngày sinh</span>
                                  <span className="text-white mt-1 block font-mono text-[11px]">{selectedSupDetail!.birthDate ? new Date(selectedSupDetail!.birthDate).toLocaleDateString('vi-VN') : 'Chưa cập nhật'}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Số điện thoại</span>
                                  <span className="text-slate-205 mt-1 block font-mono font-bold text-[11px]">{selectedSupDetail!.phone || 'Chưa cập nhật'}</span>
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-850/50">
                                <div>
                                  <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Số CCCD</span>
                                  <span className="text-slate-300 mt-1 block font-mono text-[11px]">{selectedSupDetail!.cccd || 'Chưa cập nhật'}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Ngày cấp</span>
                                  <span className="text-slate-300 mt-1 block font-mono text-[11.5px]">{selectedSupDetail!.cccdDate ? new Date(selectedSupDetail!.cccdDate).toLocaleDateString('vi-VN') : 'Chưa cập nhật'}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Nơi cấp</span>
                                  <span className="text-slate-300 mt-1 block text-[11.5px] truncate" title={selectedSupDetail!.cccdPlace}>{selectedSupDetail!.cccdPlace || 'Chưa cập nhật'}</span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-850/50">
                                <div>
                                  <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Địa chỉ thường trú</span>
                                  <span className="text-slate-300 mt-1 block font-medium flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-slate-400 inline shrink-0" /> <span className="truncate">{selectedSupDetail!.address || 'Trống'}</span>
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Email Bên B</span>
                                  <span className="text-slate-300 mt-1 block font-mono text-[11px] truncate" title={selectedSupDetail!.email}>{selectedSupDetail!.email || 'Chưa cập nhật'}</span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-850/50">
                                <div>
                                  <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">MST cá nhân</span>
                                  <span className="text-slate-300 mt-1 block font-mono text-[11px]">{selectedSupDetail!.taxCode || 'Chưa cập nhật'}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Lĩnh vực</span>
                                  <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/20 text-yellow-500">
                                    {selectedSupDetail!.field || 'Chưa phân loại'}
                                  </span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-850/50">
                                <div>
                                  <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Số tài khoản</span>
                                  <span className="text-slate-300 mt-1 block font-mono text-[11px]">{selectedSupDetail!.bankAccount || 'Chưa cập nhật'}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Tại ngân hàng</span>
                                  <span className="text-slate-300 mt-1 block text-[11px] truncate" title={selectedSupDetail!.bankName}>{selectedSupDetail!.bankName || 'Chưa cập nhật'}</span>
                                </div>
                              </div>

                              <div className="pt-2 border-t border-slate-850/50">
                                <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Ghi chú</span>
                                <span className="text-slate-300 mt-1 block text-[10.5px] max-h-12 overflow-y-auto" title={selectedSupDetail!.note}>
                                  {selectedSupDetail!.note || 'Không có ghi chú'}
                                </span>
                              </div>
                            </div>

                            {/* Linked Contracts section */}
                            <div className="space-y-2">
                              <div className="flex justify-between items-center px-1">
                                <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Hợp đồng thầu phụ liên quan ({linkedSubs.length})</span>
                              </div>
                              
                              {linkedSubs.length === 0 ? (
                                <div className="p-3 bg-slate-950/30 rounded-xl text-center text-slate-500 italic">
                                  Chưa có hợp đồng giao khoán nào.
                                </div>
                              ) : (
                                <div className="max-h-[160px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                  {linkedSubs.map(sub => {
                                    const projName = projects.find(p => p.id === sub.projectId)?.name || 'Dự án khác';
                                    return (
                                      <div key={sub.id} className="p-2.5 bg-slate-950/40 border border-slate-850 rounded-xl text-[11px] hover:bg-slate-950/80 transition-colors">
                                        <div className="flex justify-between font-mono font-bold text-[10px] text-orange-400">
                                          <span>{sub.code}</span>
                                          <span className={`text-[8.5px] px-1.5 rounded uppercase ${
                                            sub.status === 'completed' 
                                              ? 'bg-emerald-500/10 text-emerald-400' 
                                              : sub.status === 'active' 
                                                ? 'bg-sky-500/10 text-sky-400' 
                                                : 'bg-slate-800 text-slate-400'
                                          }`}>
                                            {sub.status === 'completed' ? 'Xong' : sub.status === 'active' ? 'Chạy' : 'Nháp'}
                                          </span>
                                        </div>
                                        <p className="text-white font-medium mt-1 line-clamp-1">{sub.scope}</p>
                                        <div className="flex justify-between text-[9.5px] text-slate-500 mt-1">
                                          <span className="truncate max-w-[120px]">DA: <strong className="text-slate-400">{projName}</strong></span>
                                          <strong className="text-slate-205 font-mono">{sub.value.toLocaleString('vi-VN')} đ</strong>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="pt-3 border-t border-slate-800 grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (!canCreate) {
                                    addToast({ title: '⛔ Không có quyền', message: 'Tài khoản của bạn không có quyền SỬA thông tin thầu phụ.', type: 'error' });
                                    return;
                                  }
                                  setEditingSupId(selectedSupDetail!.id);
                                  setFormSupName(selectedSupDetail!.name);
                                  setFormSupRep(selectedSupDetail!.representative || selectedSupDetail!.name);
                                  setFormSupGender(selectedSupDetail!.gender || 'Nam');
                                  setFormSupBirthDate(selectedSupDetail!.birthDate || '');
                                  setFormSupCccd(selectedSupDetail!.cccd || selectedSupDetail!.taxCode || '');
                                  setFormSupCccdDate(selectedSupDetail!.cccdDate || '');
                                  setFormSupCccdPlace(selectedSupDetail!.cccdPlace || '');
                                  setFormSupEmail(selectedSupDetail!.email || '');
                                  setFormSupBankAccount(selectedSupDetail!.bankAccount || selectedSupDetail!.bankNo || '');
                                  setFormSupBankName(selectedSupDetail!.bankName || '');
                                  setFormSupPhone(selectedSupDetail!.phone);
                                  setFormSupField(selectedSupDetail!.field || '');
                                  setFormSupAddress(selectedSupDetail!.address || selectedSupDetail!.region || '');
                                  setFormSupTaxCode(selectedSupDetail!.taxCode || '');
                                  setFormSupNote(selectedSupDetail!.note || '');
                                  setIsRepManuallyEdited(true);
                                  setShowSupplierForm(true);
                                  document.getElementById('subcontractor_form_anchor')?.scrollIntoView({ behavior: 'smooth' });
                                }}
                                className="bg-amber-600 hover:bg-amber-550 text-white font-bold py-2 rounded-xl text-center flex items-center justify-center gap-1 cursor-pointer transition-colors"
                              >
                                <Edit className="w-3.5 h-3.5" /> Sửa thầu phụ
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!canCreate) {
                                    addToast({ title: '⛔ Không có quyền', message: 'Tài khoản của bạn không có quyền XÓA thầu phụ.', type: 'error' });
                                    return;
                                  }
                                  
                                  const hasLinkedContracts = linkedSubs.length > 0;
                                  let confirmMessage = `⚠️ CẢNH BÁO QUAN TRỌNG:\n\nHành động xóa này không thể hoàn tác!\nBạn có thực sự chắc chắn muốn xóa Thầu phụ "${selectedSupDetail!.name}" (Mã: ${selectedSupDetail!.id}) ra khỏi hệ thống danh mục không?`;
                                  
                                  if (hasLinkedContracts) {
                                    confirmMessage = `🚨 CẢNH BÁO NGUY HIỂM CAO ĐỘ:\n\nThầu phụ "${selectedSupDetail!.name}" đang liên kết với ${linkedSubs.length} Hợp đồng thầu phụ đang lưu vết trong sổ sách kế toán!\n\nNếu xóa thầu phụ này, các hợp đồng liên quan sẽ bị lỗi hiển thị thầu phụ.\nBạn có THỰC SỰ CHẮC CHẮN MUỐN TIẾP TỤC XÓA và tự chịu trách nhiệm về tính toàn vẹn dữ liệu không?`;
                                  }

                                  if (confirm(confirmMessage)) {
                                    if (hasLinkedContracts) {
                                      // Secondary confirm for high-risk operations with linked contracts
                                      const secondConfirm = confirm(`XÁC NHẬN LẦN CUỐI:\n\nNhấn OK để thực sự xóa sạch thông tin của thầu phụ "${selectedSupDetail!.name}".\nNhấn Cancel để hủy bỏ.`);
                                      if (!secondConfirm) return;
                                    }
                                    
                                    setSuppliers(suppliers.filter(s => s.id !== selectedSupDetail!.id));
                                    setSelectedSupDetail(null);
                                    addToast({ title: '✅ Thành công', message: `✅ Đã xóa thầu phụ "${selectedSupDetail!.name}" thành công.`, type: 'success' });
                                  }
                                }}
                                className="bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/30 font-bold py-2 rounded-xl text-center flex items-center justify-center gap-1 cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Xóa thầu phụ
                              </button>
                            </div>

                            <div className="pt-1 flex justify-end">
                              <button
                                type="button"
                                onClick={() => setSelectedSupDetail(null)}
                                className="bg-slate-800 hover:bg-slate-755 text-slate-205 font-bold px-4 py-1.5 rounded-xl transition-colors cursor-pointer w-full text-center"
                              >
                                Đóng chi tiết
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })()}

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

            {/* TAB 7: NHẬP THU */}
            {activeSubTab === 'nhap_thu' && (
              <div className="space-y-4">
                
                <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                  <span className="font-bold text-slate-300 uppercase tracking-widest text-[11px]">Sổ Biên Nhận Chứng Từ Phiếu Thu tiền tạm ứng</span>
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

                {showRecForm && (
                  <form onSubmit={handleAddReceiptSubmit} className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3 text-[10.5px]">
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

                    <div className="flex justify-end gap-2 pt-1">
                      <button type="button" onClick={() => setShowRecForm(false)} className="bg-slate-850 px-2.5 py-1 rounded text-slate-300">Bỏ qua</button>
                      <button type="submit" className="bg-emerald-600 hover:bg-emerald-555 text-white px-3 py-1 rounded font-bold">In & Lưu Phiếu Thu</button>
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
                        <th className="px-3 py-2 text-center w-12">In</th>
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
                              <button
                                onClick={() => triggerDownloadTxt(
                                  `Phieu_Thu_${rec.code}`,
                                  `===========================================\nPHIẾU THU TIỀN TẠM ỨNG CHỦ ĐẦU TƯ\nMã phiếu: ${rec.code}\nNgày giao dịch: ${rec.date}\nC CDT: ${customers.find(c => c.id === rec.customerId)?.name || 'Không rõ'}\nDự án: ${projName}\nSố tiền: ${rec.amount.toLocaleString('vi-VN')} VND\nNội dung: ${rec.notes}\nNgười lập: ${rec.collector}`,
                                  rec.code
                                )}
                                className="bg-slate-850 hover:bg-slate-800 text-[9.5px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded cursor-pointer"
                              >
                                Tải
                              </button>
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
                  <span className="font-bold text-slate-300 uppercase tracking-widest text-[11px]">Sổ phê duyệt Đề xuất chi & ủy nhiệm thầu</span>
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

                {showPayForm && (
                  <form onSubmit={handleAddPaymentSubmit} className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3 text-[10.5px]">
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

                    <div className="flex justify-end gap-2 pt-1">
                      <button type="button" onClick={() => setShowPayForm(false)} className="bg-slate-850 px-2.5 py-1 rounded text-slate-300">Bỏ qua</button>
                      <button type="submit" className="bg-rose-600 hover:bg-rose-555 text-white px-3 py-1 rounded font-bold">Nộp đề xuất chi</button>
                    </div>
                  </form>
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
                      </tr>
                    </thead>
                    <tbody>
                      {payments.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-8 text-center text-slate-500 italic">Chưa có phiếu chi nào.</td>
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
                                      Bác chi
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
                
                <span className="font-bold text-slate-300 uppercase tracking-widest text-[11px] block border-b border-slate-850 pb-2">Biểu tổng hợp dối soát công nợ Phải Thu bên A (Chủ nhà)</span>

                <div className="overflow-x-auto text-[10.5px]">
                  <table className="w-full text-left text-slate-300">
                    <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                      <tr>
                        <th className="px-3 py-2">Dự án công trình / Chủ đầu tư</th>
                        <th className="px-3 py-2">Lĩnh vực</th>
                        <th className="px-3 py-2 text-right">Giá trị HĐ</th>
                        <th className="px-3 py-2 text-right">Đã Thu/ Tạm Ứng</th>
                        <th className="px-3 py-2 text-right text-orange-400 font-black">Còn phải thu</th>
                        <th className="px-3 py-2">Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projects.filter(p => p.baoGiaFile?.isApproved === true).length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-10 text-slate-500 font-bold font-sans">
                            📭 Chưa có dự án nào có báo giá được phê duyệt để liên kết công nợ.
                          </td>
                        </tr>
                      )}
                      {projects.filter(p => p.baoGiaFile?.isApproved === true).map((p) => {
                        const custName = customers.find(c => c.id === p.customerId)?.name || 'Vãng lai';
                        const projRecs = receipts.filter(r => r.projectId === p.id);
                        const collected = projRecs.reduce((s, r) => s + r.amount, 0);
                        
                        // Lĩnh vực (ProjectType translation)
                        let typeLabel = 'Tổng hợp';
                        if (p.type === 'construction') typeLabel = 'Xây dựng';
                        else if (p.type === 'furniture') typeLabel = 'Nội thất';
                        else if (p.type === 'mechanical') typeLabel = 'Cơ khí';

                        // Giá trị HĐ: Là giá cuối cùng đã trừ chiết khấu và cộng thuế VAT
                        const rawTotal = p.baoGiaFile?.totalAmount || p.contractValue || 0;
                        const discountPercent = p.baoGiaFile?.discountPercent || 0;
                        const discountValue = rawTotal * (discountPercent / 100);
                        const subtotalAfterDiscount = rawTotal - discountValue;
                        const vatAmount = Math.round(subtotalAfterDiscount * 0.08); // 8% VAT
                        const grandTotal = subtotalAfterDiscount + vatAmount;

                        const remaining = grandTotal - collected;
                        return (
                          <tr key={p.id} className="border-b border-slate-850/80 hover:bg-slate-900/40 font-sans">
                            <td className="px-3 py-3">
                              <div className="font-extrabold text-slate-100">{p.name}</div>
                              <div className="text-[9.5px] text-slate-500 font-mono mt-0.5">{p.code} • CĐT: {custName}</div>
                            </td>
                            <td className="px-3 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                p.type === 'construction' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/40' :
                                p.type === 'furniture' ? 'bg-sky-950/40 text-sky-400 border border-sky-900/40' :
                                p.type === 'mechanical' ? 'bg-amber-950/40 text-amber-450 border border-amber-900/40' :
                                'bg-slate-800 text-slate-300'
                              }`}>
                                {typeLabel}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-right font-mono font-bold text-slate-100">
                              {grandTotal.toLocaleString('vi-VN')} đ
                              {discountPercent > 0 && (
                                <div className="text-[9px] text-slate-500 font-normal">
                                  (Gốc: {rawTotal.toLocaleString('vi-VN')} -{discountPercent}%)
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-3 text-right font-mono text-emerald-400 font-bold">+{collected.toLocaleString('vi-VN')} đ</td>
                            <td className="px-3 py-3 text-right font-mono font-black text-orange-500 bg-orange-500/5">{remaining.toLocaleString('vi-VN')} đ</td>
                            <td className="px-3 py-3 text-slate-400 italic">
                              {p.notes || '-'}
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
                            const subtotalAfterDiscount = rawTotal - discountValue;
                            const vatAmount = Math.round(subtotalAfterDiscount * 0.08); // 8% VAT
                            const grandTotal = subtotalAfterDiscount + vatAmount;
                            const colVal = receipts.filter(r => r.projectId === selectedReceivableProjId).reduce((s, r) => s + r.amount, 0);
                            const remainingVal = grandTotal - colVal;

                            return (
                              <div className="p-3 bg-white border border-dashed border-amber-200 rounded space-y-1 my-3 font-sans text-[11px]">
                                <div className="flex justify-between">
                                  <span>Giá trị HĐ (đã trừ CK &amp; cộng VAT):</span>
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
                      Biểu đối soát công nợ Phải Trả (Thầu Phụ, Nhà Cung Cấp &amp; Khác)
                    </span>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Hệ thống tự động đồng bộ công nợ từ các <span className="text-emerald-400 font-bold">Hợp Đồng Thầu Phụ đã Phê Duyệt</span> và hỗ trợ thêm thủ công các Nhà Cung Cấp khác.
                    </p>
                  </div>
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
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md self-start shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    Thêm Công Nợ
                  </button>
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
                                    <span className="bg-emerald-950/80 text-emerald-400 text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-emerald-800/60" title="Tự động đồng bộ từ Hợp đồng Thầu phụ đã phê duyệt">
                                      HĐ Đã Duyệt
                                    </span>
                                  ) : (
                                    <span className="bg-blue-950/80 text-blue-400 text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-blue-900/60" title="Thêm thủ công">
                                      Thủ công
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                  item.category === 'Thầu Phụ' ? 'bg-amber-950 text-amber-300 border border-amber-800/40' :
                                  item.category === 'Nhà Cung Cấp' ? 'bg-purple-950 text-purple-300 border border-purple-800/40' :
                                  'bg-slate-800 text-slate-300 border border-slate-700'
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

            {/* TAB 11: TỔNG HỢP CT */}
            {activeSubTab === 'tong_hop_ct' && (
              <div className="space-y-4">
                
                <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                  <span className="font-bold text-slate-300 uppercase tracking-widest text-[11px]">Bảng sổ tổng hợp lãi gộp phân mục theo công trình</span>
                  <button
                    type="button"
                    onClick={() => {
                      // Generate plain text report in tabular format for all projects
                      let textReport = `============================================================\n`;
                      textReport += `           ERP HOÀNG LONG LÂM ĐỒNG - BÁO CÁO CÔNG TRÌNH\n`;
                      textReport += `============================================================\n`;
                      textReport += `Mã Công trình | Thực thu (Doanh thu) | Thực chi (Mua vật tư/Thầu thợ) | Lãi gộp thô\n`;
                      textReport += `------------------------------------------------------------\n`;
                      
                      projects.forEach(p => {
                        const recsSum = receipts.filter(r => r.projectId === p.id).reduce((s, r) => s + r.amount, 0);
                        const paysSum = payments.filter(pay => pay.projectId === p.id && pay.status === 'approved').reduce((s, pay) => s + pay.amount, 0);
                        const margin = recsSum - paysSum;
                        textReport += `${p.code} | ${recsSum.toLocaleString('vi-VN')} đ | ${paysSum.toLocaleString('vi-VN')} đ | ${margin.toLocaleString('vi-VN')} đ\n`;
                      });

                      triggerDownloadTxt('Bao_Cao_Tong_Hop_Cong_Trinh', textReport, '2026');
                    }}
                    className="bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 text-[10px] font-bold px-3 py-1.5 rounded flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    Báo cáo tổng hợp (TXT)
                  </button>
                </div>

                <div className="overflow-x-auto text-[10.5px]">
                  <table className="w-full text-left text-slate-300">
                    <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                      <tr>
                        <th className="px-3 py-2">Dự án thầu gốc / Phân hệ</th>
                        <th className="px-3 py-2 text-right">Giá gốc hợp đồng</th>
                        <th className="px-3 py-2 text-right">Lũy kế dã thu</th>
                        <th className="px-3 py-2 text-right">Lũy kế thợ thầm + mua ván chi</th>
                        <th className="px-3 py-2 text-right text-emerald-400 font-bold">LỢI NHUẬN GỘP DƯỚI</th>
                        <th className="px-3 py-2 text-center">Đánh giá hành vi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projects.map((p) => {
                        const recsSum = receipts.filter(r => r.projectId === p.id).reduce((s, r) => s + r.amount, 0);
                        const paysSum = payments.filter(pay => pay.projectId === p.id && pay.status === 'approved').reduce((s, pay) => s + pay.amount, 0);
                        const marginValue = recsSum - paysSum;
                        const marginPercent = recsSum > 0 ? Math.round((marginValue / recsSum) * 100) : 0;
                        return (
                          <tr key={p.id} className="border-b border-slate-850/80 hover:bg-slate-900/40 font-sans">
                            <td className="px-3 py-3">
                              <div className="font-extrabold text-slate-100">{p.name}</div>
                              <span className="text-[9.5px] text-slate-500 font-mono">{p.code} • {p.type === 'furniture' ? 'Nội thất gỗ An Cường' : 'Xây dựng thô/Cơ khí sắt'}</span>
                            </td>
                            <td className="px-3 py-3 text-right font-mono font-bold text-slate-300">{p.contractValue.toLocaleString('vi-VN')} đ</td>
                            <td className="px-3 py-3 text-right font-mono text-emerald-400">+{recsSum.toLocaleString('vi-VN')} đ</td>
                            <td className="px-3 py-3 text-right font-mono text-rose-500">-{paysSum.toLocaleString('vi-VN')} đ</td>
                            <td className={`px-3 py-3 text-right font-mono font-black ${marginValue >= 0 ? 'text-sky-450 bg-sky-500/5' : 'text-red-500 bg-red-500/5'}`}>
                              {marginValue.toLocaleString('vi-VN')} đ
                              <span className="block text-[8.5px] font-normal text-slate-400 mt-0.5">Biên: {marginPercent}%</span>
                            </td>
                            <td className="px-3 py-3 text-center">
                              {marginPercent > 35 ? (
                                <span className="bg-emerald-550/10 text-emerald-400 text-[8.5px] px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase font-sans font-bold">Lợi nhuận Kịch Khung</span>
                              ) : marginPercent >= 0 ? (
                                <span className="bg-slate-800 text-slate-400 text-[8.5px] px-1.5 py-0.5 rounded uppercase font-sans">Bảo toàn vốn mộc</span>
                              ) : (
                                <span className="bg-rose-500/10 text-rose-450 text-[8.5px] px-1.5 py-0.5 rounded border border-rose-500/20 uppercase font-sans font-extrabold animate-pulse">Cảnh báo Vượt chi</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 12: TỔNG HỢP MẢNG */}
            {activeSubTab === 'tong_hop_mang' && (
              <div className="space-y-6">
                
                <span className="font-bold text-slate-300 uppercase tracking-widest text-[11px] block border-b border-slate-850 pb-2">Báo cáo cân đối hiệu số theo Mảng phân mảng kinh doanh ERP</span>

                {/* Calculation of revenue & expense by project type */}
                {(() => {
                  const mFurniture = projects.filter(p => p.type === 'furniture');
                  const mConstruction = projects.filter(p => p.type === 'construction');
                  const mMechanical = projects.filter(p => p.type === 'mechanical');

                  const getSectorStats = (projs: Project[]) => {
                    const ids = projs.map(p => p.id);
                    const recSum = receipts.filter(r => r.projectId && ids.includes(r.projectId)).reduce((s, r) => s + r.amount, 0);
                    const paySum = payments.filter(pay => pay.projectId && ids.includes(pay.projectId) && pay.status === 'approved').reduce((s, pay) => s + pay.amount, 0);
                    return { recSum, paySum, profit: recSum - paySum };
                  };

                  const statsFurniture = getSectorStats(mFurniture);
                  const statsConstruction = getSectorStats(mConstruction);
                  const statsMechanical = getSectorStats(mMechanical);

                  const totalSectorProfits = Math.max(statsFurniture.profit + statsConstruction.profit + statsMechanical.profit, 1);

                  const percFurn = Math.max(Math.round((statsFurniture.profit / totalSectorProfits) * 100), 0);
                  const percConst = Math.max(Math.round((statsConstruction.profit / totalSectorProfits) * 100), 0);
                  const percMech = Math.max(Math.round((statsMechanical.profit / totalSectorProfits) * 100), 0);

                  return (
                    <div className="space-y-6">
                      
                      {/* Grid representation */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        
                        <div className="p-4 bg-amber-950/10 border border-amber-900/30 rounded-xl space-y-1.5">
                          <span className="text-amber-400 text-[10px] font-bold uppercase block tracking-wider">📦 THỢ MỘC & GỖ NỘI THẤT (MDF AN CƯỜNG)</span>
                          <p className="text-[11px] text-slate-400">Doanh thu: <strong className="text-slate-200">{statsFurniture.recSum.toLocaleString('vi-VN')} đ</strong></p>
                          <p className="text-[11px] text-slate-400">Đã chi mâm thợ: <strong className="text-slate-200">{statsFurniture.paySum.toLocaleString('vi-VN')} đ</strong></p>
                          <div className="pt-2 border-t border-slate-800 flex justify-between text-xs font-bold text-amber-400">
                            <span>Lợi nhuận mảng gỗ:</span>
                            <span>{statsFurniture.profit.toLocaleString('vi-VN')} đ ({percFurn}%)</span>
                          </div>
                        </div>

                        <div className="p-4 bg-indigo-950/10 border border-indigo-900/30 rounded-xl space-y-1.5">
                          <span className="text-indigo-400 text-[10px] font-bold uppercase block tracking-wider">🏗️ KIẾN TRÚC & XÂY DỰNG THÔ BIỆT THỰ</span>
                          <p className="text-[11px] text-slate-400">Doanh thu: <strong className="text-slate-200">{statsConstruction.recSum.toLocaleString('vi-VN')} đ</strong></p>
                          <p className="text-[11px] text-slate-400">Đã chi thầu nề: <strong className="text-slate-200">{statsConstruction.paySum.toLocaleString('vi-VN')} đ</strong></p>
                          <div className="pt-2 border-t border-slate-800 flex justify-between text-xs font-bold text-indigo-400">
                            <span>Lợi nhuận mảng thô:</span>
                            <span>{statsConstruction.profit.toLocaleString('vi-VN')} đ ({percConst}%)</span>
                          </div>
                        </div>

                        <div className="p-4 bg-pink-955/10 border border-pink-905/30 rounded-xl space-y-1.5">
                          <span className="text-pink-450 text-[10px] font-bold uppercase block tracking-wider">⚙️ KHUNG SẮT TIỀN CHẾ & GIA CÔNG CƠ KHÍ</span>
                          <p className="text-[11px] text-slate-400">Doanh thu: <strong className="text-slate-200">{statsMechanical.recSum.toLocaleString('vi-VN')} đ</strong></p>
                          <p className="text-[11px] text-slate-400">Đã chi thép hộp: <strong className="text-slate-200">{statsMechanical.paySum.toLocaleString('vi-VN')} đ</strong></p>
                          <div className="pt-2 border-t border-slate-800 flex justify-between text-xs font-bold text-pink-400">
                            <span>Lợi nhuận cơ khí:</span>
                            <span>{statsMechanical.profit.toLocaleString('vi-VN')} đ ({percMech}%)</span>
                          </div>
                        </div>

                      </div>

                      {/* Visual gauge bar matching percentages */}
                      <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
                        <span className="font-bold text-white text-[11px] block uppercase tracking-wide text-orange-400">📊 Tỷ lệ đóng góp lợi nhuận sạch của 3 mảng kinh doanh:</span>
                        
                        <div className="w-full bg-slate-950 rounded-full h-5 overflow-hidden flex font-mono text-[9px] font-bold text-white leading-5 text-center">
                          {percFurn > 0 && <div className="bg-amber-600 h-full" style={{ width: `${percFurn}%` }}>Gỗ: {percFurn}%</div>}
                          {percConst > 0 && <div className="bg-indigo-600 h-full" style={{ width: `${percConst}%` }}>Xây dựng: {percConst}%</div>}
                          {percMech > 0 && <div className="bg-pink-600 h-full" style={{ width: `${percMech}%` }}>Cơ khí: {percMech}%</div>}
                        </div>

                        <div className="grid grid-cols-3 text-center text-[10px] text-slate-400 pt-2 selection:bg-slate-800">
                          <div className="flex items-center justify-center gap-1.5"><div className="w-2.5 h-2.5 bg-amber-600 rounded"></div> Cốt gỗ MDF và tủ mâm thợ</div>
                          <div className="flex items-center justify-center gap-1.5"><div className="w-2.5 h-2.5 bg-indigo-600 rounded"></div> Xây thô móng gạch cốp pha</div>
                          <div className="flex items-center justify-center gap-1.5"><div className="w-2.5 h-2.5 bg-pink-600 rounded"></div> Hàn sườn kẽm sườn hộp</div>
                        </div>
                      </div>

                    </div>
                  );
                })()}

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
                          return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] px-2 py-0.5 rounded-full font-bold">Chờ Duyệt (Kế toán)</span>;
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

    </div>
  );
}
