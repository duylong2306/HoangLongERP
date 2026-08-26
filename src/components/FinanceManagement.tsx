import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { dbService, stableStr } from '../lib/dbService';
import { sendApprovalDirectMessage, findEmployeeByName, ensureProjectChatGroup, sendGroupChatMessage } from '../lib/chatStore';
import { Receipt, Payment, Project, Customer, Employee, SupplierPartner, SubcontractorAdvanceProposal, Supplier, InventoryItem, ArchivedQuote, Liability, AccountingProductItem, SalesOrder, SalesOrderItem, PurchaseOrder, PurchaseOrderItem, Task, WAREHOUSE_SOURCE_ID, WAREHOUSE_PROJECT_ID, CashFundConfig } from '../types';
import { useNotification, isUserInRoleGroup, loadHrmRoleGroups, getConfiguredApprover, getConfiguredSettler } from '../context';
import SearchableSelect from './SearchableSelect';
import { useSettings } from '../context/SettingsContext';
import VoucherPrintModal from './VoucherPrintModal';
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
  FileText,
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
  ExternalLink,
  Database,
  Edit,
  Download,
  FileUp,
  AlertTriangle,
  DollarSign as MoneyIcon,
  ChevronLeft,
  ChevronRight,
  Zap,
  Upload,
  RefreshCcw,
  Image as ImageIcon,
} from 'lucide-react';

// Trạng thái hiển thị của phiếu chi xoay quanh chứng từ (thay cho 'approved'/'pending').
//  - rejected        → Bác thầu (giữ nguyên ý nghĩa từ chối)
//  - có images       → Hoàn Thành (đã đẩy đủ chứng từ)
//  - chưa có images  → Thiếu chứng từ
export type PaymentDocStatus = 'rejected' | 'completed' | 'missing_docs';
export const getPaymentDocStatus = (p: Payment): PaymentDocStatus => {
  if (p.status === 'rejected') return 'rejected';
  const hasImages = Array.isArray(p.images) && p.images.length > 0;
  return hasImages ? 'completed' : 'missing_docs';
};

// Nhãn & badge "Nhóm gốc chi" (category của phiếu chi) — Việt hóa, nền trắng, chữ màu viền.
export const PAYMENT_CAT_LABEL: Record<string, string> = {
  material: 'Vật tư',
  labor: 'Nhân công',
  shipping: 'Vận chuyển',
  machinery: 'Máy móc',
  general: 'Chi chung',
  other: 'Khác',
  subcontractor_advance: 'Tạm ứng thầu phụ',
  site_expense: 'Chi phí công trình',
  salary: 'Lương',
  supplier_payment: 'Nhà cung cấp',
  salary_advance: 'Ứng lương',
  cash_fund: 'Nạp Quỹ tiền mặt',
};
export const PAYMENT_CAT_BADGE: Record<string, string> = {
  material: 'bg-white text-sky-600 border-sky-500',
  labor: 'bg-white text-emerald-600 border-emerald-500',
  shipping: 'bg-white text-indigo-600 border-indigo-500',
  machinery: 'bg-white text-cyan-600 border-cyan-500',
  general: 'bg-white text-slate-600 border-slate-500',
  other: 'bg-white text-slate-600 border-slate-400',
  subcontractor_advance: 'bg-white text-blue-600 border-blue-500',
  site_expense: 'bg-white text-orange-600 border-orange-500',
  salary: 'bg-white text-rose-600 border-rose-500',
  supplier_payment: 'bg-white text-purple-600 border-purple-500',
  salary_advance: 'bg-white text-pink-600 border-pink-500',
  cash_fund: 'bg-white text-teal-600 border-teal-500',
};

// Nhãn "Loại Đề Xuất" theo type của đề xuất chi.
export const proposalTypeLabel = (type?: string): string => {
  switch (type) {
    case 'subcontractor_advance': return 'Chi Thầu Phụ';
    case 'project_expense_proposal': return 'Chi phí Công trình';
    case 'supplier_payment_proposal': return 'Chi Nhà Cung Cấp';
    case 'salary_advance': return 'Ứng Lương Nhân Sự';
    case 'cash_fund_deposit': return 'Quỹ Tiền Mặt (Nạp Quỹ)';
    default: return 'Khác';
  }
};
// Badge màu theo type (nền trắng, chữ = màu viền) — đồng bộ Nhóm gốc chi.
export const PROPOSAL_TYPE_BADGE: Record<string, string> = {
  subcontractor_advance: 'bg-white text-blue-700 border-blue-400',
  project_expense_proposal: 'bg-white text-emerald-700 border-emerald-400',
  supplier_payment_proposal: 'bg-white text-purple-700 border-purple-400',
  salary_advance: 'bg-white text-pink-700 border-pink-400',
  cash_fund_deposit: 'bg-white text-teal-700 border-teal-400',
};

const getAbbreviation = (name: string): string => {
  if (!name) return '';
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
  // Bỏ các "từ" chỉ toàn ký tự đặc biệt (vd: "-") và bỏ dấu ngoặc/ký tự đặc biệt
  // đứng đầu mỗi từ (vd: "(Minh" → lấy "M" thay vì "("), tránh mã sinh ra dính
  // dấu ngoặc/gạch ngang xấu như "AH-PHT(H".
  const words = normalized.trim().split(/\s+/).filter(w => /[a-zA-Z0-9]/.test(w));
  const initials = words.map(w => (w.match(/[a-zA-Z0-9]/) as RegExpMatchArray)[0].toUpperCase()).join('');
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

// ── Launcher: Trung tâm Lập chi & Đề xuất (phục vụ TẤT CẢ khoản chi & tạm ứng trong phiếu chi) ──
type QuickLaunchGroup = 'proposal' | 'direct';
type QuickRecipientKind = 'supplier' | 'employee' | 'project';
interface QuickLaunchItem {
  key: string;
  group: QuickLaunchGroup;
  label: string;
  emoji: string;
  desc: string;
  paymentCategory: 'subcontractor_advance' | 'site_expense' | 'salary' | 'supplier_payment' | 'other' | 'salary_advance' | 'cash_fund';
  recipientKind: QuickRecipientKind;
}
const QUICK_LAUNCH_ITEMS: QuickLaunchItem[] = [
  // Nhóm A — ĐỀ XUẤT (tạo proposal, qua xét duyệt rồi "Lập phiếu")
  { key: 'adv_supplier', group: 'proposal', label: 'Chi Nhà Cung Cấp', emoji: '🏪', desc: 'Đối tượng: Nhà cung cấp', paymentCategory: 'supplier_payment', recipientKind: 'supplier' },
  { key: 'adv_site', group: 'proposal', label: 'Chi phí Công trình', emoji: '🏗️', desc: 'Đối tượng: Công trình / Dự án', paymentCategory: 'site_expense', recipientKind: 'project' },
  { key: 'adv_sub', group: 'proposal', label: 'Chi Thầu Phụ', emoji: '🤝', desc: 'Tạm ứng / Thanh toán công nợ thầu phụ', paymentCategory: 'subcontractor_advance', recipientKind: 'supplier' },
  { key: 'adv_cash_fund', group: 'proposal', label: 'Quỹ Tiền Mặt (Nạp Quỹ)', emoji: '💰', desc: 'Nạp tiền vào Quỹ tiền mặt công ty', paymentCategory: 'cash_fund', recipientKind: 'employee' },
  // Nhóm B — LẬP PHIẾU CHI TRỰC TIẾP (mở form Payment, pre-select category)
  { key: 'pay_site', group: 'direct', label: 'Chi tiêu Công trình', emoji: '🏗️', desc: 'Chi thực tế công trình', paymentCategory: 'site_expense', recipientKind: 'project' },
  { key: 'pay_salary', group: 'direct', label: 'Lương Thưởng', emoji: '💵', desc: 'Trả lương / thưởng nhân viên', paymentCategory: 'salary', recipientKind: 'employee' },
  { key: 'pay_supplier', group: 'direct', label: 'Thanh toán Nhà cung cấp', emoji: '🏪', desc: 'Trả tiền NCC / mua vật tư', paymentCategory: 'supplier_payment', recipientKind: 'supplier' },
  { key: 'pay_other', group: 'direct', label: 'Chi tiêu Khác', emoji: '📦', desc: 'Chi phí không phân loại', paymentCategory: 'other', recipientKind: 'project' },
];

// Nhãn nhóm phiếu chi đích của 1 đề xuất (để hiển thị minh bạch trong list/chi tiết)
const proposalTargetCatLabel = (p: { type?: string; taskName?: string }): string => {
  if (p.type === 'supplier_payment_proposal') return 'Chi Nhà Cung Cấp';
  if (p.type === 'subcontractor_advance') return 'Chi Thầu Phụ';
  if (p.type === 'cash_fund_deposit') return 'Quỹ Tiền Mặt (Nạp Quỹ)';
  if ((p.taskName || '').startsWith('Ứng lương')) return 'Ứng Lương Nhân Sự';
  return 'Chi phí Công trình';
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
  onUpdateReceipt?: (rec: Receipt) => void;
  onUpdatePayment?: (pay: Payment) => void;
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
  /** Danh sách công việc — dùng cho lối tắt tạo đề xuất liên kết công việc từ tab Đề Xuất Thu Chi. */
  tasks?: Task[];
  /** Cấu hình hệ thống (shiftConfig) — chứa companyProfile dùng cho xuất PDF đề xuất. */
  systemConfig?: any;
  /** Deep-link: mở chi tiết Đề Xuất Vật Tư tương ứng từ tab Đơn Hàng. */
  onOpenMaterialProposal?: (proposalId: string) => void;
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

// ── Form content tách riêng, tự quản lý state → nhập liệu không gây re-render FinanceManagement ──
interface ReceiptFormPrefill {
  custId?: string;
  projId?: string;
  amount?: number;
  notes?: string;
}
interface ReceiptFormContentProps {
  customers: any[];
  projects: any[];
  autoSelectCustId?: string | null;
  prefill?: ReceiptFormPrefill | null;
  onClose: () => void;
  onAddCustomer: () => void;
  onSubmit: (data: { custId: string; projId: string | undefined; amount: number; method: 'cash' | 'transfer'; notes: string }) => void;
}
const ReceiptFormContent = React.memo(({
  customers, projects, autoSelectCustId, prefill, onClose, onAddCustomer, onSubmit,
}: ReceiptFormContentProps) => {
  const [custId, setCustId] = React.useState(prefill?.custId || '');
  const [projId, setProjId] = React.useState(prefill?.projId || '');
  const [amount, setAmount] = React.useState<number>(prefill?.amount || 0);
  const [method, setMethod] = React.useState<'cash' | 'transfer'>('transfer');
  const [notes, setNotes] = React.useState(prefill?.notes || '');

  // Auto-select customer when "Thêm khách hàng nhanh" creates one
  React.useEffect(() => {
    if (autoSelectCustId && customers.some(c => c.id === autoSelectCustId)) {
      setCustId(autoSelectCustId);
      setProjId('');
    }
  }, [autoSelectCustId, customers]);

  const handleSubmit = () => {
    if (!custId || Number(amount) <= 0) return;
    onSubmit({
      custId,
      projId: projId && projId !== '__none__' ? projId : undefined,
      amount: Number(amount),
      method,
      notes,
    });
  };

  return (
    <div className="fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <form
        onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 space-y-3 text-[10.5px] shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-1">
          <h3 className="font-extrabold text-sm uppercase tracking-wide text-emerald-400 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Lập Phiếu Thu Mới
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-1">
          <label className="block text-slate-400 font-semibold mb-1">Khách hàng <span className="text-rose-400">*</span>:</label>
          <SearchableSelect
            options={customers.map(c => ({ id: c.id, label: c.name }))}
            value={custId}
            onChange={(id) => { setCustId(id); setProjId(''); }}
            placeholder="— Chọn khách hàng —"
            searchPlaceholder="🔍 Gõ tên khách hàng..."
            required
          />
          <button type="button" onClick={onAddCustomer} className="text-[10px] text-sky-400 hover:text-sky-300 underline cursor-pointer">+ Thêm khách hàng nhanh</button>
        </div>

        <div className="space-y-1">
          <label className="block text-slate-400 font-semibold mb-1">Số tiền thực tế thu (VNĐ) <span className="text-rose-400">*</span>:</label>
          <input
            type="number"
            required
            min={1}
            value={amount || ''}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white font-mono font-bold"
            placeholder="0"
          />
          <p className="text-[10px] text-slate-500 font-mono">{amount > 0 ? `${amount.toLocaleString('vi-VN')} đồng` : 'Nhập số tiền, ví dụ: 1500000 = 1.500.000đ'}</p>
        </div>

        <div className="space-y-1">
          <label className="block text-slate-400 font-semibold mb-1">Dự án liên kết <span className="text-rose-400">*</span>:</label>
          <select
            required
            value={projId}
            onChange={(e) => setProjId(e.target.value)}
            disabled={!custId}
            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white cursor-pointer font-medium disabled:opacity-40"
          >
            <option value="" disabled>{custId ? '— Chọn dự án —' : '— Chọn khách hàng trước —'}</option>
            <option value="__none__">📭 Thu ngoài dự án (không gắn công trình)</option>
            {projects.filter(p => p.customerId === custId).map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-slate-400 font-semibold mb-1">Hình thức thanh toán:</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as 'cash' | 'transfer')}
            className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white cursor-pointer font-bold"
          >
            <option value="transfer">Chuyển khoản</option>
            <option value="cash">Tiền mặt</option>
          </select>
        </div>

        <div>
          <label className="block text-slate-400 font-semibold mb-1">Giải nghĩa chi tiết phiếu thu:</label>
          <input
            type="text"
            required
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Khách tạm ứng 30% tiền gỗ ván..."
            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button type="button" onClick={onClose} className="bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded text-slate-300 cursor-pointer">Bỏ qua</button>
          <button type="submit" className="bg-emerald-600 hover:bg-emerald-555 text-white px-3 py-1.5 rounded font-bold cursor-pointer">Lập Phiếu Thu</button>
        </div>
      </form>
    </div>
  );
});
ReceiptFormContent.displayName = 'ReceiptFormContent';

// Input sửa Đơn giá: giữ state cục bộ, chỉ commit (gọi onCommit) khi blur.
// Tránh re-render toàn bộ FinanceManagement trên mỗi phím gõ → khắc phục lag.
const PoPriceEditInput = React.memo(({ value, onCommit }: { value: number; onCommit: (v: number) => void }) => {
  const [local, setLocal] = useState<string>(String(value ?? 0));
  React.useEffect(() => { setLocal(String(value ?? 0)); }, [value]);
  return (
    <input
      type="number"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => onCommit(Number(local) || 0)}
      className="w-24 bg-slate-800 border border-slate-700 rounded-lg p-1.5 text-[11px] text-slate-100 outline-none focus:border-amber-500 font-mono text-right"
    />
  );
});

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
  onUpdateReceipt,
  onUpdatePayment,
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
  onInitialProposalConsumed,
  tasks: tasksProp = [],
  systemConfig,
  onOpenMaterialProposal,
}: FinanceProps) {
  const companyProfile = systemConfig?.companyProfile || {};
  const { addToast } = useNotification();
  const { businessInfo } = useSettings();
  // ── Multi-row selection ──
  const [finSelectedRows, setFinSelectedRows] = useState<Set<string>>(new Set());
  const [finSelectAll, setFinSelectAll] = useState(false);
  // Separate selection state for duLieuTab subtabs
  const [custSelectedRows, setCustSelectedRows] = useState<Set<string>>(new Set());
  const [matSelectedRows, setMatSelectedRows] = useState<Set<string>>(new Set());
  // Selection state for receipts (nhap_thu)
  const [recSelectedRows, setRecSelectedRows] = useState<Set<string>>(new Set());
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
  // TẤT CẢ Hợp Đồng Thầu Phụ (không lọc theo isApproved) — dùng để xác định
  // "dự án nào có thầu phụ liên kết" và "thầu phụ nào thuộc dự án nào" ở màn
  // Trung tâm Lập chi & Đề xuất (Chi Thầu Phụ), vì thầu phụ có thể đã được ký
  // hợp đồng nhưng CHƯA được duyệt (isApproved=false) vẫn cần hiện ra để chọn.
  const [allSubcontractorQuotes, setAllSubcontractorQuotes] = useState<ArchivedQuote[]>([]);

  // Load approved subcontractor contracts from Firebase
  useEffect(() => {
    const loadApprovedSubs = async () => {
      try {
        const list = await dbService.archivedQuotes.list('subcontractor');
        setApprovedSubContracts(list.filter((q: any) => q.isApproved === true));
        setAllSubcontractorQuotes(list);
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
  // Modal upload sao kê (bước "Cập nhật chứng từ")
  const [voucherUploadProposal, setVoucherUploadProposal] = useState<SubcontractorAdvanceProposal | null>(null);
  const [voucherUploadPay, setVoucherUploadPay] = useState<Payment | null>(null);
  const [voucherUploadImages, setVoucherUploadImages] = useState<string[]>([]);
  // Lightbox ảnh chứng từ (dùng chung Nhập Chi & modal Đề Xuất)
  const [lightboxImages, setLightboxImages] = useState<string[] | null>(null);
  // Phân trang từng cột Kanban Đề Xuất Chi (giống Điều phối vật tư)
  const PROPOSAL_COL_PAGE_SIZES = [5, 10, 15, 20] as const;
  const [proposalColPage, setProposalColPage] = useState<Record<string, number>>({});
  const [proposalColPageSize, setProposalColPageSize] = useState<Record<string, number>>({});
  const getProposalColPage = (id: string) => proposalColPage[id] || 1;
  const getProposalColPageSize = (id: string) => proposalColPageSize[id] || 5;
  const proposalColTotalPages = (id: string, count: number) => Math.max(1, Math.ceil(count / getProposalColPageSize(id)));
  const setProposalColPageSafe = (id: string, p: number) => setProposalColPage(prev => ({ ...prev, [id]: Math.max(1, p) }));
  const [rejectProposalModal, setRejectProposalModal] = useState<SubcontractorAdvanceProposal | null>(null);
  const [revertProposalModal, setRevertProposalModal] = useState<SubcontractorAdvanceProposal | null>(null);
  const [editingAmountProposal, setEditingAmountProposal] = useState<SubcontractorAdvanceProposal | null>(null);
  const [editAmountValue, setEditAmountValue] = useState<string>('');
  const [proposalTypeFilter, setProposalTypeFilter] = useState<'all' | 'subcontractor' | 'expense' | 'salary' | 'supplier' | 'cash_fund'>('all');
  const [viewingProposalDetail, setViewingProposalDetail] = useState<SubcontractorAdvanceProposal | null>(null);
  // Input "Số tiền duyệt chi" trong cửa sổ chi tiết (người xét duyệt nhập)
  const [approveAmountInput, setApproveAmountInput] = useState<string>('');
  // Thùng rác Đề Xuất bị Từ Chối + mục tiêu khôi phục
  const [trashOpen, setTrashOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<Record<string, SubcontractorAdvanceProposal['status']>>({});

  // Khi mở cửa sổ chi tiết, khởi tạo input Số tiền duyệt chi = approvedAmount (hoặc amount)
  useEffect(() => {
    if (viewingProposalDetail) {
      setApproveAmountInput(String(viewingProposalDetail.approvedAmount ?? viewingProposalDetail.amount ?? ''));
    }
  }, [viewingProposalDetail]);

  // ── Thùng rác: Đề Xuất bị Từ Chối (tự xóa sau 30 ngày + khôi phục) — giống Đề xuất vật tư ──
  const DAYS_TO_AUTO_DELETE = 30;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const rejectedProposals = (subcontractorAdvances || []).filter(a => a.status === 'rejected');
  const rejectedAtMs = (p: SubcontractorAdvanceProposal): number => {
    const t = new Date(p.rejectedAt || 0).getTime();
    return isNaN(t) ? 0 : t;
  };
  const daysUntilDeletion = (p: SubcontractorAdvanceProposal): number => {
    const base = rejectedAtMs(p);
    if (!base) return DAYS_TO_AUTO_DELETE;
    const remain = DAYS_TO_AUTO_DELETE - Math.floor((Date.now() - base) / DAY_MS);
    return Math.max(0, Math.min(DAYS_TO_AUTO_DELETE, remain));
  };

  const cleanupRejectedProposals = useCallback(async () => {
    try {
      const rejected = (subcontractorAdvances || []).filter(p => p.status === 'rejected');
      const toDelete = rejected.filter(p => {
        const base = rejectedAtMs(p);
        return base && Date.now() - base > DAYS_TO_AUTO_DELETE * DAY_MS;
      });
      for (const p of toDelete) {
        await dbService.subcontractorAdvances.delete(p.id).catch(() => {});
      }
      if (toDelete.length > 0) {
        setSubcontractorAdvances(prev => prev.filter(p => !toDelete.some(d => d.id === p.id)));
        window.dispatchEvent(new CustomEvent('hl-subcontractor-advances-updated'));
      }
    } catch (e) {
      console.error('Lỗi dọn Đề Xuất bị Từ Chối quá 30 ngày:', e);
    }
  }, [subcontractorAdvances]);

  // Tự động xóa khi mount và định kỳ mỗi giờ
  useEffect(() => { cleanupRejectedProposals(); }, [cleanupRejectedProposals]);
  useEffect(() => {
    const timer = setInterval(() => { cleanupRejectedProposals(); }, 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, [cleanupRejectedProposals]);

  // Khôi phục 1 đề xuất từ Thùng rác về cột được chỉ định
  const restoreRejectedProposal = async (p: SubcontractorAdvanceProposal) => {
    const target = restoreTarget[p.id] || 'pending_approval';
    const updated: SubcontractorAdvanceProposal = { ...p, status: target, rejectedAt: '' };
    await dbService.subcontractorAdvances.save(updated);
    setSubcontractorAdvances(prev => prev.map(x => x.id === updated.id ? updated : x));
    window.dispatchEvent(new CustomEvent('hl-subcontractor-advances-updated', { detail: updated }));
    addToast({
      title: '♻️ Đã khôi phục',
      message: `Đã khôi phục Đề xuất ${p.id} về cột ${target === 'pending_approval' ? 'Chờ Duyệt' : target === 'pending_payment' ? 'Chờ Lập Phiếu' : 'Cập Nhật Chứng Từ'}.`,
      type: 'success',
    });
  };

  const deleteRejectedNow = async (p: SubcontractorAdvanceProposal) => {
    if (!window.confirm(`⚠️ Xóa VĨNH VIỄN Đề xuất ${p.id}?\nThao tác này không thể hoàn tác.`)) return;
    await dbService.subcontractorAdvances.delete(p.id).catch(() => {});
    setSubcontractorAdvances(prev => prev.filter(x => x.id !== p.id));
    window.dispatchEvent(new CustomEvent('hl-subcontractor-advances-updated'));
    addToast({ title: '🗑️ Đã xóa', message: `Đã xóa vĩnh viễn Đề xuất ${p.id}.`, type: 'info' });
  };

  // ── Bộ lọc & phân trang Tab Đề Xuất Thu Chi ──
  const PROPOSAL_FILTER_KEY = 'hl_fin_proposal_filters';
  const loadProposalFilters = (): { fromDate: string; toDate: string; projectId: string; status: string } => {
    try {
      const raw = localStorage.getItem(PROPOSAL_FILTER_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        return { fromDate: p.fromDate || '', toDate: p.toDate || '', projectId: p.projectId || '', status: p.status || '' };
      }
    } catch {}
    const y = new Date().getFullYear();
    return { fromDate: `${y}-01-01`, toDate: `${y}-12-31`, projectId: '', status: '' };
  };
  const [proposalFilters, setProposalFilters] = useState(loadProposalFilters);
  const [proposalPage, setProposalPage] = useState(1);
  const [proposalPageSize, setProposalPageSize] = useState(10);

  useEffect(() => {
    try { localStorage.setItem(PROPOSAL_FILTER_KEY, JSON.stringify(proposalFilters)); } catch {}
  }, [proposalFilters]);

  const updateProposalFilter = (patch: Partial<{ fromDate: string; toDate: string; projectId: string; status: string }>) => {
    setProposalFilters(prev => ({ ...prev, ...patch }));
    setProposalPage(1);
  };

  // Xóa Đề xuất bị TỪ CHỐI (từng dòng hoặc hàng loạt, có xác nhận)
  const handleDeleteProposal = async (id: string) => {
    const target = subcontractorAdvances.find(p => p.id === id);
    if (!target) return;
    if (target.status !== 'rejected') {
      addToast({ title: '⚠️ Không thể xóa', message: 'Chỉ được xóa các Đề xuất đã bị Từ chối.', type: 'warning' });
      return;
    }
    if (!window.confirm(`⚠️ Xóa Đề xuất "${id}"?\nHành động này không thể hoàn tác.`)) return;
    try {
      await dbService.subcontractorAdvances.delete(id);
      setSubcontractorAdvances(prev => prev.filter(p => p.id !== id));
      setFinSelectedRows(prev => { const n = new Set(prev); n.delete(id); return n; });
      addToast({ title: '🗑️ Đã xóa', message: `Đã xóa đề xuất ${id}.`, type: 'info' });
    } catch (err) {
      console.error('Lỗi xóa đề xuất:', err);
      addToast({ title: '❌ Lỗi', message: 'Không thể xóa đề xuất.', type: 'error' });
    }
  };

  const handleBulkDeleteProposals = async () => {
    const rejectedIds = subcontractorAdvances.filter(p => finSelectedRows.has(p.id) && p.status === 'rejected').map(p => p.id);
    if (rejectedIds.length === 0) {
      addToast({ title: '⚠️ Không có mục hợp lệ', message: 'Chỉ các Đề xuất bị Từ chối mới được xóa.', type: 'warning' });
      return;
    }
    if (!window.confirm(`⚠️ Xóa ${rejectedIds.length} Đề xuất bị Từ chối đã chọn?\nHành động này không thể hoàn tác.`)) return;
    try {
      await Promise.all(rejectedIds.map(id => dbService.subcontractorAdvances.delete(id)));
      setSubcontractorAdvances(prev => prev.filter(p => !rejectedIds.includes(p.id)));
      setFinSelectedRows(new Set());
      setFinSelectAll(false);
      addToast({ title: '🗑️ Đã xóa', message: `Đã xóa ${rejectedIds.length} đề xuất.`, type: 'info' });
    } catch (err) {
      console.error('Lỗi xóa hàng loạt đề xuất:', err);
      addToast({ title: '❌ Lỗi', message: 'Xóa hàng loạt thất bại.', type: 'error' });
    }
  };

  // ── Quick "Tạo Đề Xuất" modal (tạo nhanh đề xuất cho dự án cụ thể) ──
  const [showQuickProposalModal, setShowQuickProposalModal] = useState(false);
  // Tín hiệu mở nhanh form "Thêm Nhà Cung Cấp" ở tab Nhà cung cấp vật tư (tăng để trigger).
  const [addSupplierSignal, setAddSupplierSignal] = useState(0);
  const [quickProposalType, setQuickProposalType] = useState<'subcontractor_advance' | 'project_expense_proposal' | 'salary_advance' | 'supplier_payment_proposal' | 'cash_fund_deposit'>('project_expense_proposal');
  const [quickLaunchItem, setQuickLaunchItem] = useState<QuickLaunchItem | null>(null);
  // Hình thức Chi Thầu Phụ: 'advance' = Tạm ứng Thầu Phụ | 'debt' = Thanh Toán Công Nợ Thầu Phụ
  const [quickProposalSubMode, setQuickProposalSubMode] = useState<'advance' | 'debt'>('advance');
  const [quickProposalRecipientKind, setQuickProposalRecipientKind] = useState<QuickRecipientKind>('project');
  const [quickProposalSubId, setQuickProposalSubId] = useState('');
  const [quickProposalProjId, setQuickProposalProjId] = useState('');
  const [quickProposalAmount, setQuickProposalAmount] = useState<number | string>('');
  const [quickProposalReason, setQuickProposalReason] = useState('');
  // Liên kết công việc (lối tắt từ tab Đề Xuất Thu Chi, tương thích với nút Công Việc)
  const [quickProposalTaskId, setQuickProposalTaskId] = useState('');
  const [quickProposalTaskName, setQuickProposalTaskName] = useState('');
  // Bảng hạng mục chi tiêu (danh sách chi phí cần đề xuất) — chỉ dùng cho Đề Xuất Chi Phí (project_expense_proposal)
  // projectId/projectName: công trình của TỪNG dòng chi tiêu (xem giải thích ở types.ts).
  const [quickProposalExpenseItems, setQuickProposalExpenseItems] = useState<{ id: string; item: string; amount: number; note: string; projectId?: string; projectName?: string }[]>([]);
  const [quickProposalSettlerId, setQuickProposalSettlerId] = useState('');

  // Helper: Mở thẳng form tạo đề xuất (bỏ qua bước chọn trong launcher) theo loại đã định.
  // Dùng cho lối tắt nhanh "Đề Xuất Chi Phí" / "Tạm Ứng Thầu Phụ" — tương thích với nút trong Công Việc.
  // Mở thẳng form tạo Đề Xuất theo loại (bỏ qua launcher chọn loại).
  const openProposalForm = useCallback((
    itemKey: QuickLaunchItem['key'],
    initial?: { subMode?: 'advance' | 'debt'; subId?: string; amount?: number | string; projId?: string; reason?: string }
  ) => {
    const item = QUICK_LAUNCH_ITEMS.find(i => i.key === itemKey);
    if (!item || item.group !== 'proposal') return;
    setQuickProposalType(
      item.key === 'adv_sub' ? 'subcontractor_advance' :
      item.key === 'adv_site' ? 'project_expense_proposal' :
      item.key === 'adv_salary' ? 'salary_advance' :
      item.key === 'adv_cash_fund' ? 'cash_fund_deposit' :
      'supplier_payment_proposal'
    );
    // Chi phí Công trình (adv_site) LUÔN chọn nhân viên làm đối tượng nhận —
    // ghi đè config gốc của nút (item.recipientKind = 'project') vì công trình
    // không thể "nhận tiền" (xem giải thích ở handleQuickProposalSubmit).
    setQuickProposalRecipientKind(item.key === 'adv_site' ? 'employee' : item.recipientKind);
    setQuickProposalSubMode(initial?.subMode ?? 'advance');
    // Chi Nhà Cung Cấp / Nạp Quỹ Tiền Mặt không gắn dự án (trường Dự án/Công
    // trình đã ẩn) → để trống.
    setQuickProposalProjId((item.key === 'adv_supplier' || item.key === 'adv_cash_fund') ? '' : (initial?.projId ?? projects[0]?.id ?? ''));
    setQuickProposalSubId(initial?.subId ?? '');
    setQuickProposalAmount(initial?.amount != null ? String(initial.amount) : '');
    setQuickProposalReason(initial?.reason ?? '');
    setQuickProposalTaskId('');
    setQuickProposalTaskName('');
    setQuickProposalExpenseItems([]);
    setQuickProposalSettlerId('');
    setQuickLaunchItem(item);
    setShowQuickProposalModal(true);
  }, [projects]);

  // Mở form Đề Xuất Chi từ một dòng Công nợ Trả (đồng thời điều hướng sang tab Đề Xuất Chi):
  //  - Phân loại "Nhà Cung Cấp" → đề xuất Chi Nhà Cung Cấp (supplier_payment_proposal)
  //  - Phân loại "Thầu Phụ"     → đề xuất Chi Thầu Phụ + hình thức "Thanh Toán Công Nợ" (debt)
  const handleOpenProposalFromLiability = (item: any) => {
    const isSub = item.category === 'Thầu Phụ';
    const subId = suppliers.find((s: any) => s.name === item.name)?.id || '';
    const amount = Math.round(item.remaining || 0);
    setActiveSubTab('de_xuat_thu_chi');
    setSearchTerm('');
    if (isSub) {
      openProposalForm('adv_sub', { subMode: 'debt', subId, amount, projId: '' });
    } else {
      openProposalForm('adv_supplier', { subId, amount, projId: '' });
    }
  };

  // Mở trực tiếp form Lập phiếu chi (Nhóm B) theo loại.
  const openDirectPay = useCallback((
    itemKey: QuickLaunchItem['key']
  ) => {
    const item = QUICK_LAUNCH_ITEMS.find(i => i.key === itemKey);
    if (!item || item.group !== 'direct') return;
    setPayCategory(item.paymentCategory);
    setPayRecipient('');
    setPayRecipientId('');
    setPayRecipientKind('');
    setRecipientSearch('');
    setShowQuickProposalModal(false);
    setShowPayForm(true);
  }, []);

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

  // Có ai KHÁC (ngoài chính người tạo đề xuất) đủ điều kiện duyệt/từ chối không?
  // Chỉ tính nhân sự còn hoạt động (status='working') và có tài khoản đăng nhập
  // (hasSystemAccount) — nhân viên đã nghỉ hoặc chưa cấp tài khoản thì không thể
  // vào hệ thống để duyệt, tính vào sẽ khiến fallback không bao giờ kích hoạt dù
  // thực tế không ai duyệt được.
  const hasOtherEligibleApprover = useCallback((proposal: SubcontractorAdvanceProposal): boolean => {
    return (employeesProp || []).some(emp => {
      if (emp.id === proposal.creator) return false;
      if (emp.status === 'retired' || emp.hasSystemAccount === false) return false;
      if (emp.id === proposal.approver) return true;
      if (proposal.approverName && emp.name?.toLowerCase() === proposal.approverName.toLowerCase()) return true;
      if (isUserInRoleGroup(emp.id, 'role_accounting')) return true;
      if (isUserInRoleGroup(emp.id, 'role_admin')) return true;
      return false;
    });
  }, [employeesProp]);

  // Helper: Kiểm tra user có quyền duyệt/từ chối đề xuất này không
  // NGUYÊN TẮC: người TẠO đề xuất KHÔNG được tự duyệt đề xuất của chính mình — kể
  // cả khi họ là admin/Giám đốc. Trước đây admin tự tạo rồi tự duyệt được (vì
  // role_admin luôn pass ở nhánh dưới), khiến "Đề Xuất Chi" do admin lập mất hẳn ý
  // nghĩa xét duyệt độc lập.
  // FALLBACK: nếu KHÔNG CÒN AI KHÁC đủ điều kiện duyệt (vd công ty chỉ có 1 admin,
  // chưa có ai thuộc role_accounting/được gán duyệt riêng) thì cho phép người tạo
  // tự duyệt để tránh đề xuất bị kẹt vĩnh viễn — chỉ áp dụng khi thực sự bế tắc.
  const canApproveProposal = useCallback((proposal: SubcontractorAdvanceProposal) => {
    if (!currentUser) return false;
    const isCreator = !!proposal.creator && proposal.creator === currentUser.id;
    if (isCreator && hasOtherEligibleApprover(proposal)) return false;

    // 1. Là người được gán duyệt trong đề xuất (so sánh theo ID hoặc tên)
    if (proposal.approver === currentUser.id) return true;
    if (proposal.approverName && proposal.approverName.toLowerCase() === currentUser.name.toLowerCase()) return true;

    // 2. Thuộc nhóm Kế toán (role_accounting)
    if (isUserInRoleGroup(currentUser.id, 'role_accounting')) return true;
    // 3. Là Giám đốc (role_admin) - có quyền duyệt tất cả
    if (isUserInRoleGroup(currentUser.id, 'role_admin')) return true;
    // 4. Fallback tự duyệt: chỉ khi là người tạo VÀ không còn ai khác đủ điều kiện
    if (isCreator) return true;
    return false;
  }, [currentUser, hasOtherEligibleApprover]);

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
  // approvedAmount: Số tiền duyệt chi do người xét duyệt nhập (mặc định = số tiền đề xuất)
  const handleApprove = async (proposal: SubcontractorAdvanceProposal, approvedAmount?: number) => {
    // Kiểm tra quyền duyệt
    if (!canApproveProposal(proposal)) {
      addToast({ title: '⛔ Không có quyền', message: '❌ Bạn không phải người xét duyệt cho đề xuất này!', type: 'error' });
      return;
    }
    // Tự duyệt qua fallback (không còn ai khác đủ điều kiện) — cảnh báo rõ để minh bạch,
    // không âm thầm coi như duyệt bình thường.
    const isSelfApprovalFallback = proposal.creator === currentUser?.id;
    if (isSelfApprovalFallback) {
      addToast({ title: '⚠️ Tự duyệt (fallback)', message: 'Không có người khác đủ điều kiện duyệt — hệ thống cho phép bạn tự duyệt đề xuất của chính mình.', type: 'warning' });
    }
    try {
      const finalApproved = (approvedAmount != null && !isNaN(approvedAmount)) ? approvedAmount : proposal.amount;
      const updated: SubcontractorAdvanceProposal = {
        ...proposal,
        status: 'pending_payment',
        approvedAmount: finalApproved,
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
        `Số tiền duyệt chi: ${finalApproved.toLocaleString('vi-VN')}đ${finalApproved !== proposal.amount ? ` (đề xuất ${proposal.amount.toLocaleString('vi-VN')}đ)` : ''}\n` +
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
  // Cùng nguyên tắc với canApproveProposal: người tạo không được tự xử lý (duyệt/từ
  // chối) đề xuất của chính mình, kể cả admin — tránh vừa đá bóng vừa thổi còi.
  // Cũng có cùng fallback: nếu không còn ai khác đủ điều kiện, người tạo được tự xử lý.
  const canRejectProposal = useCallback((proposal: SubcontractorAdvanceProposal) => {
    if (!currentUser) return false;
    const isCreator = !!proposal.creator && proposal.creator === currentUser.id;
    if (isCreator && hasOtherEligibleApprover(proposal)) return false;
    // 1. Là người được gán duyệt trong đề xuất (so sánh theo ID hoặc tên)
    if (proposal.approver === currentUser.id) return true;
    if (proposal.approverName && proposal.approverName.toLowerCase() === currentUser.name.toLowerCase()) return true;
    // 2. Thuộc nhóm Kế toán (role_accounting)
    if (isUserInRoleGroup(currentUser.id, 'role_accounting')) return true;
    // 3. Là Giám đốc (role_admin) - có quyền từ chối tất cả
    if (isUserInRoleGroup(currentUser.id, 'role_admin')) return true;
    // 4. Fallback tự xử lý: chỉ khi là người tạo VÀ không còn ai khác đủ điều kiện
    if (isCreator) return true;
    return false;
  }, [currentUser, hasOtherEligibleApprover]);

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
        status: 'rejected',
        rejectedAt: new Date().toISOString(),
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
        status: 'rejected',
        rejectedAt: new Date().toISOString(),
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

  // ─── Quỹ Tiền Mặt: số dư đầu kỳ (bản ghi đơn/singleton) ───────────────────
  const [cashFundConfig, setCashFundConfig] = useState<CashFundConfig | null>(null);
  useEffect(() => {
    let active = true;
    const fetchCashFundConfig = async () => {
      try {
        const cfg = await dbService.cashFundConfig.get();
        if (active) setCashFundConfig(cfg);
      } catch (err) {
        console.error('Lỗi khi tải cấu hình Quỹ tiền mặt:', err);
      }
    };
    fetchCashFundConfig();
    const handleRealtime = () => fetchCashFundConfig();
    window.addEventListener('hl-cash-fund-config-updated', handleRealtime);
    return () => {
      active = false;
      window.removeEventListener('hl-cash-fund-config-updated', handleRealtime);
    };
  }, []);

  // Số dư Quỹ tiền mặt = số dư đầu kỳ + tổng phiếu chi NẠP quỹ (category='cash_fund')
  // đã duyệt − tổng phiếu chi RÚT từ quỹ (paymentMethod='cash_fund', mọi hạng mục) đã duyệt.
  // Không lưu số dư trực tiếp — luôn tính lại từ Payment để tránh lệch dữ liệu.
  const cashFundDeposited = useMemo(() =>
    payments.filter(p => p.category === 'cash_fund' && p.status === 'approved').reduce((s, p) => s + (p.amount || 0), 0),
    [payments]);
  const cashFundSpent = useMemo(() =>
    payments.filter(p => p.paymentMethod === 'cash_fund' && p.status === 'approved').reduce((s, p) => s + (p.amount || 0), 0),
    [payments]);
  const cashFundBalance = (cashFundConfig?.openingBalance || 0) + cashFundDeposited - cashFundSpent;
  const [editingOpeningBalance, setEditingOpeningBalance] = useState(false);
  const [openingBalanceInput, setOpeningBalanceInput] = useState('0');
  const canEditCashFundOpening = !!currentUser && (isUserInRoleGroup(currentUser.id, 'role_admin') || isUserInRoleGroup(currentUser.id, 'role_accounting'));
  const handleSaveCashFundOpening = async () => {
    const cfg: CashFundConfig = {
      id: cashFundConfig?.id || 'cash_fund_main',
      openingBalance: Number(openingBalanceInput) || 0,
      openingDate: cashFundConfig?.openingDate || new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.name || '',
    };
    try {
      await dbService.cashFundConfig.save(cfg);
      setCashFundConfig(cfg);
      setEditingOpeningBalance(false);
      addToast({ title: '✅ Đã lưu', message: 'Đã cập nhật số dư đầu kỳ Quỹ tiền mặt.', type: 'success' });
    } catch (err) {
      addToast({ title: '❌ Lỗi', message: 'Không thể lưu số dư đầu kỳ. Vui lòng thử lại.', type: 'error' });
    }
  };

  /**
   * Chữ ký nội dung 1 dòng để phát hiện THAY ĐỔI THẬT.
   * - Loại bỏ cột hệ thống DB tự sinh (created_at / updated_at): chúng thay đổi
   *   sau mỗi lần save/refetch dù dữ liệu người dùng không đổi.
   * - Bỏ qua key có giá trị null/undefined: Supabase không lưu trường undefined,
   *   nên sau khi lưu rồi refetch, key biến mất — nếu tính vào chữ ký thì dòng
   *   nào cũng bị coi là "đã sửa" → save lại → realtime event → vòng lặp vô hạn.
   * Kết quả: chỉ khi người dùng thật sự sửa dữ liệu thì dòng mới được ghi lên DB.
   */
  const liabRowSig = (l: any): string => {
    const canon = (v: any): any => {
      if (v === null || v === undefined) return undefined;
      if (Array.isArray(v)) return v.map(canon);
      if (typeof v === 'object') {
        const out: any = {};
        Object.keys(v).forEach(k => {
          if (k === 'createdAt' || k === 'updatedAt') return;
          const cv = canon((v as any)[k]);
          if (cv !== undefined) out[k] = cv;
        });
        return out;
      }
      return v;
    };
    return stableStr(canon(l));
  };

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
  // CHẶN VÒNG LẶP REALTIME: chỉ save những dòng NỘI DUNG thật sự khác DB.
  // Trước đây effect này save TOÀN BỘ array sau MỌI setState (kể cả setState do
  // realtime refetch) → N request POST → invalidateCache → event → refetch →
  // setState mới → save lại... lặp vô hạn khiến bảng Công nợ Trả nhảy số liệu
  // và position liên tục, đồng thời đốt tài nguyên Supabase.
  const isFirstRenderLiabilities = useRef(true);
  const prevLiabilitiesRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    if (isFirstRenderLiabilities.current) {
      isFirstRenderLiabilities.current = false;
      customLiabilities.forEach(l => prevLiabilitiesRef.current.set(l.id, liabRowSig(l)));
      return;
    }
    const prevMap = prevLiabilitiesRef.current;
    const nextSigs = new Map(customLiabilities.map(l => [l.id, liabRowSig(l)]));
    // Dòng bị XÓA khỏi state → bỏ khỏi bản đồ so sánh
    prevMap.forEach((_, id) => { if (!nextSigs.has(id)) prevMap.delete(id); });
    customLiabilities.forEach(l => {
      if (prevMap.get(l.id) !== nextSigs.get(l.id)) {
        // Chỉ cập nhật "đã sync" KHI save thành công — save lỗi thì giữ chữ ký cũ,
        // lần render sau vẫn được nhận diện là cần retry.
        dbService.accountingLiabilities.save(l).then(() => {
          prevMap.set(l.id, nextSigs.get(l.id)!);
        }).catch(() => {});
      }
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

  // Khi phiếu thu bị xóa → dọn dẹp auto-created Công Nợ Thu mồ côi
  useEffect(() => {
    const handleReceiptDeleted = () => {
      setCustomReceivables(prev => {
        const toRemove = prev.filter(r => {
          if (!r.id?.startsWith('autorec_')) return false;
          // Kiểm tra còn phiếu thu nào khớp customerId không
          const hasReceipt = receipts.some(rec => rec.customerId === r.customerId);
          return !hasReceipt;
        });
        if (toRemove.length === 0) return prev;
        const removeIds = new Set(toRemove.map(r => r.id));
        return prev.filter(r => !removeIds.has(r.id));
      });
    };
    window.addEventListener('hl-receipt-deleted', handleReceiptDeleted);
    return () => window.removeEventListener('hl-receipt-deleted', handleReceiptDeleted);
  }, [receipts]);

  // Sync lên Supabase khi data thay đổi (skip lần đầu mount) — chỉ sync items thủ công.
  // CHẶN VÒNG LẶP REALTIME: như effect liabilities ở trên — chỉ save dòng thật sự
  // khác DB (bỏ qua cột hệ thống created_at/updated_at), tránh realtime refetch →
  // setState → bulk-save → event → lặp vô hạn làm Công nợ Thu nhảy liên tục.
  const isFirstRenderReceivables = useRef(true);
  const prevReceivablesRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const manual = customReceivables.filter(r => !r.isAuto);
    if (isFirstRenderReceivables.current) {
      isFirstRenderReceivables.current = false;
      manual.forEach(r => prevReceivablesRef.current.set(r.id, liabRowSig(r)));
      return;
    }
    const prevMap = prevReceivablesRef.current;
    const nextSigs = new Map(manual.map(r => [r.id, liabRowSig(r)]));
    prevMap.forEach((_, id) => { if (!nextSigs.has(id)) prevMap.delete(id); });
    manual.forEach(r => {
      if (prevMap.get(r.id) !== nextSigs.get(r.id)) {
        dbService.accountingReceivables.save(r).then(() => {
          prevMap.set(r.id, nextSigs.get(r.id)!);
        }).catch(() => {});
      }
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

  
  // Mở rộng chi tiết công trình theo Chủ đầu tư & modal phiếu thu.
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [receiptDetail, setReceiptDetail] = useState<{ receipts: Receipt[]; title: string } | null>(null);
  // Mở rộng chi tiết khoản nợ theo Nhà Cung Cấp / Thầu Phụ (Công nợ Trả) — tương tự expandedCustomers.
  const [expandedLiabilities, setExpandedLiabilities] = useState<Set<string>>(new Set());

  // ── Tab Công nợ Phải Thu: bộ lọc (lưu localStorage cho lần sau) ──
  const RECEIVABLE_FILTER_KEY = 'hl_fin_receivable_filters';
  const loadReceivableFilters = (): { investor: string; status: string; field: string; fromDate: string; toDate: string } => {
    const y = new Date().getFullYear();
    try {
      const raw = localStorage.getItem(RECEIVABLE_FILTER_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        return { investor: p.investor || '', status: p.status || '', field: p.field || '', fromDate: p.fromDate || `${y}-01-01`, toDate: p.toDate || `${y}-12-31` };
      }
    } catch {}
    return { investor: '', status: '', field: '', fromDate: `${y}-01-01`, toDate: `${y}-12-31` };
  };
  const [receivableFilters, setReceivableFilters] = useState(loadReceivableFilters);
  useEffect(() => { try { localStorage.setItem(RECEIVABLE_FILTER_KEY, JSON.stringify(receivableFilters)); } catch {} }, [receivableFilters]);
  const updateReceivableFilter = (patch: Partial<{ investor: string; status: string; field: string; fromDate: string; toDate: string }>) => {
    setReceivableFilters(prev => ({ ...prev, ...patch }));
  };

  // Phân trang riêng cho tab Công nợ Thu (tránh trùng với recPage/recPageSize của Nhập Thu)
  const [receivablePage, setReceivablePage] = useState(1);
  const [receivablePageSize, setReceivablePageSize] = useState(10);
  useEffect(() => { setReceivablePage(1); }, [receivableFilters.investor, receivableFilters.status, receivableFilters.field, receivableFilters.fromDate, receivableFilters.toDate, searchTerm]);

  // Combined receivables list (auto từ accounting_receivables + thủ công)
  const mergedReceivables = useMemo(() => {
    // Tách auto và manual từ dữ liệu DB
    const dbAuto = customReceivables.filter(r => r.isAuto === true);
    const dbCustoms = customReceivables.filter(r => !r.isAuto);

    // Auto items (SubContract): re-compute collected từ receipts theo projectId
    const auto = dbAuto.map(r => {
      const projRecs = receipts.filter(rec => rec.projectId === r.projectId);
      const collected = projRecs.reduce((s, rec) => s + rec.amount, 0);
      const openingDebt = r.openingDebt ?? (r.isOpeningDebt ? (r.contractValue || 0) : 0);
      const contractValue = r.contractValue || 0;
      const remaining = (openingDebt + contractValue) - collected;
      return { ...r, collected, remaining, openingDebt };
    });

    // Manual items: re-compute collected theo customerId hoặc salesOrderId
    const customs = dbCustoms.map(r => {
      let collected = 0;
      if (r.customerId) {
        collected = receipts.filter(rec => rec.customerId === r.customerId).reduce((s, rec) => s + rec.amount, 0);
      } else {
        const soMatch = r.projectName.match(/ĐH\s+(\S+)/);
        const salesOrderId = soMatch ? soMatch[1] : null;
        const salesRecs = salesOrderId ? receipts.filter(rec => rec.salesOrderId === salesOrderId) : [];
        collected = salesRecs.reduce((s, rec) => s + rec.amount, 0);
      }
      const collectedFinal = collected || (r.collected || 0);
      const openingDebt = r.openingDebt ?? (r.isOpeningDebt ? (r.contractValue || 0) : 0);
      const isAutoCreated = r.id?.startsWith('autorec_');
      const contractValue = isAutoCreated ? collectedFinal : (r.contractValue || 0);
      const remaining = (openingDebt + contractValue) - collectedFinal;
      return { ...r, contractValue, collected: collectedFinal, remaining, openingDebt, isAuto: false };
    }).filter(r => {
      // Lọc bỏ autorec_ mồ côi không còn phiếu thu
      if (r.id?.startsWith('autorec_') && (r.collected || 0) <= 0 && !r.isOpeningDebt) return false;
      return true;
    });

    // Sắp xếp cố định theo Chủ đầu tư: tránh thứ tự dòng thay đổi sau mỗi lần
    // realtime refetch (SELECT không ORDER BY) làm bảng công nợ thu nhảy vị trí.
    return [...auto, ...customs].sort((a, b) =>
      (a.investor || '').localeCompare(b.investor || '', 'vi') ||
      (a.projectName || '').localeCompare(b.projectName || '', 'vi'));
  }, [customReceivables, receipts, customers]);

  // Gom nhóm Công nợ Thu theo Chủ đầu tư (Khách Hàng): mỗi khách = 1 dòng tổng hợp,
  // mở rộng để xem chi tiết từng công trình. CĐK chỉ ở mức Chủ đầu tư.
  const groupedReceivables = useMemo(() => {
    const fieldFilter = receivableFilters.field;
    const from = receivableFilters.fromDate;
    const to = receivableFilters.toDate;
    const src = mergedReceivables.filter((r: any) => {
      if (fieldFilter && (r.field || '') !== fieldFilter) return false;
      // Lọc theo ngày: công nợ không có ngày vẫn được giữ (tránh ẩn dữ liệu cũ chưa có ngày)
      const d = (r.date || '').slice(0, 10);
      if (from && d && d < from) return false;
      if (to && d && d > to) return false;
      return true;
    });
    const groups = new Map<string, any>();
    src.forEach(r => {
      const key = r.customerId ? `cust:${r.customerId}` : `name:${r.investor || 'Không xác định'}`;
      if (!groups.has(key)) {
        groups.set(key, { key, customerId: r.customerId || null, investor: r.investor || 'Không xác định', projects: [], cdkRows: [] });
      }
      const g = groups.get(key)!;
      if (r.isOpeningDebt) g.cdkRows.push(r);
      else g.projects.push(r);
    });

    return Array.from(groups.values()).map(g => {
      // Thêm dòng "Thu ngoài dự án" (tổng hợp các phiếu thu KHÔNG gắn công trình)
      // vào chi tiết nhóm, để khách hàng dễ thấy khoản thu ngoài dự án.
      const custIdRow = g.customerId ?? (g.investor ? (customers || []).find((c: any) => c.name === g.investor)?.id : undefined);
      if (custIdRow) {
        const outRecs = (receipts || []).filter((rec: any) => rec.customerId === custIdRow && (!rec.projectId || rec.projectId === '__none__'));
        const outTotal = outRecs.reduce((s: number, rec: any) => s + (rec.amount || 0), 0);
        if (outTotal > 0) {
          g.projects.push({
            id: `outofproject_${g.key}`,
            _isOutOfProject: true,
            customerId: custIdRow,
            projectName: '📭 Thu ngoài dự án (không gắn công trình)',
            field: '',
            contractValue: 0,
            collected: outTotal,
            notes: `${outRecs.length} phiếu thu ngoài dự án`,
            isAuto: false,
          });
        }
      }
      const tongHopDong = g.projects.reduce((s: number, p: any) => s + (p.contractValue || 0), 0);
      // "Đã Thu" của khách = tổng MỌI phiếu thu mang customerId của khách đó,
      // bao gồm cả phiếu thu trong dự án và "Thu ngoài dự án" (không phụ thuộc projectId).
      const custId = g.customerId ?? (g.investor ? (customers || []).find((c: any) => c.name === g.investor)?.id : undefined);
      const daThu = custId
        ? (receipts || []).filter((rec: any) => rec.customerId === custId).reduce((s: number, rec: any) => s + (rec.amount || 0), 0)
        : g.projects.reduce((s: number, p: any) => s + (p.collected || 0), 0);
      const cdk = g.cdkRows.reduce((s: number, p: any) => s + (p.contractValue || 0), 0);
      const customer = (customers || []).find((c: any) => c.id === g.customerId) as any;
      const cdkValue = cdk > 0 ? cdk : (customer?.openingDebt || 0);
      // Cập nhật: Tổng giá trị = Công nợ đầu kỳ + Giá trị HĐ (cột ảo, không lưu DB)
      const tongGiaTri = cdkValue + tongHopDong;
      // Cập nhật: Còn phải thu = Tổng giá trị - Đã Thu (bỏ logic căn cứ CĐK/HĐ)
      const conLai = tongGiaTri - daThu;
      return { ...g, customer, tongHopDong, daThu, cdkValue, tongGiaTri, conLai };
    });
  }, [mergedReceivables, customers, receipts, receivableFilters.field, receivableFilters.fromDate, receivableFilters.toDate]);

  // Lọc phiếu thu liên quan đến một dòng công trình (theo projectId / customerId / salesOrderId).
  const getReceiptsForRow = (r: any): Receipt[] => {
    // Dòng "Thu ngoài dự án" → chỉ lấy các phiếu thu không gắn công trình của khách đó.
    if (r._isOutOfProject) {
      return (receipts || []).filter((rec: any) => rec.customerId === r.customerId && (!rec.projectId || rec.projectId === '__none__'));
    }
    if (r.projectId) return receipts.filter(rec => rec.projectId === r.projectId);
    if (r.customerId) return receipts.filter(rec => rec.customerId === r.customerId);
    const soMatch = (r.projectName || '').match(/ĐH\s+(\S+)/);
    const soId = soMatch ? soMatch[1] : null;
    if (soId) return receipts.filter(rec => rec.salesOrderId === soId);
    return [];
  };

  // ── Cập nhật Công Nợ Đầu Kỳ (từ 3 bảng master) ──────────────────────────
  const [allSubcontractors, setAllSubcontractors] = useState<any[]>([]);
  useEffect(() => {
    const loadSubs = async () => {
      try {
        const list = await dbService.accountingSubcontractors.list();
        if (list && list.length > 0) setAllSubcontractors(list);
      } catch (e) {
        console.warn('Load subcontractors from Supabase failed:', e);
      }
    };
    loadSubs();
  }, []);

  // Công nợ Thu: đẩy Công Nợ đầu kỳ > 0 của Khách Hàng vào cột Giá Trị (và lưu lên Supabase để không bị mất khi reload).
  const handleUpdateOpeningReceivables = async () => {
    const opening = (customers || []).filter(c => (c.openingDebt || 0) > 0);
    if (opening.length === 0) {
      addToast({ title: 'ℹ️ Thông báo', message: 'Không có Khách Hàng nào có Công Nợ đầu kỳ > 0.', type: 'info' });
      return;
    }
    const entries = opening.map(c => ({
      id: `opbal_cust_${c.id}`,
      customerId: c.id,
      projectName: `Số dư đầu kỳ - ${c.name}`,
      investor: c.name,
      field: 'Công nợ đầu kỳ',
      contractValue: c.openingDebt || 0,
      openingDebt: c.openingDebt || 0,
      collected: 0,
      remaining: c.openingDebt || 0,
      notes: 'Cập nhật từ Công Nợ đầu kỳ (Khách Hàng)',
      isAuto: false,
      isOpeningDebt: true,
    }));
    setCustomReceivables(prev => {
      const map = new Map(prev.map(r => [r.id, r]));
      entries.forEach(e => map.set(e.id, e));
      return Array.from(map.values());
    });
    let saved = 0;
    await Promise.all(entries.map(async (e: any) => {
      try {
        await dbService.accountingReceivables.save(e);
        saved++;
      } catch (err) {
        try {
          const { isOpeningDebt, openingDebt, balanceBasis, ...rest } = e;
          void isOpeningDebt; void openingDebt; void balanceBasis;
          await dbService.accountingReceivables.save(rest);
          saved++;
        } catch (err2) {
          console.error('[DB] Lưu Công nợ đầu kỳ Thu thất bại:', err2);
        }
      }
    }));
    addToast({
      title: saved === opening.length ? '✅ Cập nhật Công Nợ Đầu Kỳ' : '⚠️ Cập nhật Công Nợ Đầu Kỳ',
      message: `Đã đưa ${opening.length} khách hàng (có công nợ đầu kỳ) vào Công nợ Thu${saved < opening.length ? ` — ${opening.length - saved} bản ghi lưu thất bại` : ''}.`,
      type: saved === opening.length ? 'success' : 'warning',
    });
  };

  // Công nợ Trả: đẩy Công Nợ đầu kỳ > 0 của Thầu Phụ (subcontractorId) và NCC (name) vào cột Số Dư Đầu Kỳ (và lưu lên Supabase).
  const handleUpdateOpeningLiabilities = async () => {
    const subOpening = (allSubcontractors || []).filter(s => (s.openingDebt || 0) > 0);
    const supOpening = (suppliers || []).filter(s => (s.openingDebt || 0) > 0);
    if (subOpening.length === 0 && supOpening.length === 0) {
      addToast({ title: 'ℹ️ Thông báo', message: 'Không có Thầu Phụ / NCC nào có Công Nợ đầu kỳ > 0.', type: 'info' });
      return;
    }
    const entries: any[] = [];
    subOpening.forEach(s => entries.push({
      id: `opbal_sub_${s.id}`,
      subcontractorId: s.id,
      name: s.name,
      category: 'Thầu Phụ',
      value: s.openingDebt || 0,
      openingDebt: s.openingDebt || 0,
      paid: 0,
      remaining: s.openingDebt || 0,
      notes: 'Cập nhật từ Công Nợ đầu kỳ (Thầu Phụ)',
      isOpeningDebt: true,
    }));
    supOpening.forEach(s => entries.push({
      id: `opbal_sup_${s.id}`,
      name: s.name,
      category: 'Nhà Cung Cấp',
      value: 0,  // Phát Sinh NCC tự tính từ PO, không nhập thủ công
      openingDebt: s.openingDebt || 0,
      paid: 0,
      remaining: s.openingDebt || 0,
      notes: 'Cập nhật từ Công Nợ đầu kỳ (NCC Vật tư)',
      isOpeningDebt: true,
    }));
    setCustomLiabilities(prev => {
      const map = new Map(prev.map(l => [l.id, l]));
      entries.forEach(e => map.set(e.id, e));
      return Array.from(map.values());
    });
    let saved = 0;
    await Promise.all(entries.map(async (e: any) => {
      try {
        // Lưu đầy đủ (giữ is_opening_debt) khi bảng đã có cột (đã chạy migration).
        await dbService.accountingLiabilities.save(e);
        saved++;
      } catch (err) {
        // Bảng chưa có cột is_opening_debt (chưa chạy migration) -> lưu bản rút gọn,
        // dữ liệu vẫn được lưu vào cột value để không bị mất khi reload.
        try {
          const { isOpeningDebt, openingDebt, balanceBasis, ...rest } = e;
          void isOpeningDebt; void openingDebt; void balanceBasis;
          await dbService.accountingLiabilities.save(rest);
          saved++;
        } catch (err2) {
          console.error('[DB] Lưu Công nợ đầu kỳ Trả thất bại:', err2);
        }
      }
    }));
    const total = subOpening.length + supOpening.length;
    addToast({
      title: saved === total ? '✅ Cập nhật Công Nợ Đầu Kỳ' : '⚠️ Cập nhật Công Nợ Đầu Kỳ',
      message: `Đã đưa ${total} đối tượng (Thầu Phụ/NCC) vào Công nợ Trả${saved < total ? ` — ${total - saved} bản ghi lưu thất bại` : ''}.`,
      type: saved === total ? 'success' : 'warning',
    });
  };

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
  // Xác nhận trước khi "Ghi nhận công nợ" — cảnh báo nếu đơn chưa hoạt động.
  const [poRecordConfirm, setPoRecordConfirm] = useState<PurchaseOrder | null>(null);
  const [poUndoConfirm, setPoUndoConfirm] = useState<PurchaseOrder | null>(null);
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
  const poItemTotal = (i: any): number => (poItemQty(i) || 0) * (poItemPrice(i) || 0);
  const poStatusLabel = (st: string): string => {
    switch (st) {
      case 'draft': return 'Nháp';
      case 'confirmed': return 'Đã xác nhận';
      case 'completed': return 'Hoàn tất';
      case 'cancelled': return 'Đã hủy';
      default: return st || '—';
    }
  };

  // Tổng tongTien từ các PO đã ghi nhận vào 1 liability NCC (Phát Sinh tự động).
  const getRecordedPOSum = (liab: Liability): number => {
    if (!liab.recordedPurchaseOrderIds?.length) return liab.value || 0;
    const ids = new Set(liab.recordedPurchaseOrderIds);
    const total = purchaseOrders
      .filter(po => ids.has(po.id))
      .reduce((s, po) => s + (po.tongTien || 0), 0);
    // Fallback: nếu PO đã xóa hoặc không tìm thấy, giữ lại value gốc
    return total > 0 ? total : (liab.value || 0);
  };

  // Combined liabilities list
  const mergedLiabilities = useMemo(() => {
    const subs = approvedSubContracts.map(sub => {
      const paymentsMade = payments.filter(p =>
        (p.subcontractorId && sub.subcontractorId && p.subcontractorId === sub.subcontractorId) ||
        (p.recipient && sub.subcontractorName && p.recipient === sub.subcontractorName)
      );
      const totalPaidAmount = paymentsMade.filter(p => p.status === 'approved').reduce((sum, p) => sum + p.amount, 0);
      const value = sub.contractValue || 0;
      const openingDebt = (sub as any).openingDebt ?? 0;
      // Cập nhật: Tổng giá trị = Công nợ đầu kỳ + Phát Sinh (cột ảo, không lưu DB)
      const tongGiaTri = openingDebt + value;
      // Cập nhật: Còn lại = Tổng giá trị - Đã Trả (bỏ logic căn cứ CĐK/HĐ)
      const remaining = tongGiaTri - totalPaidAmount;
      return {
        id: sub.id,
        subcontractorId: sub.subcontractorId,
        name: sub.subcontractorName || sub.subcontractorId || 'Vãng lai',
        category: 'Thầu Phụ',
        value,
        openingDebt,
        paid: totalPaidAmount,
        remaining,
        tongGiaTri,
        notes: sub.notes || sub.workName || 'Hợp đồng thầu phụ thi công',
        date: (sub as any).date || '',
        isAuto: true,
        isOpeningDebt: false
      };
    });

    const customs = customLiabilities.map(liab => {
      // Công nợ đầu kỳ Thầu Phụ: khớp chính xác theo subcontractorId của phiếu chi.
      // Nợ tạm ứng: khớp theo relatedAdvanceId.
      // Nợ thủ công NCC / khác: khớp theo tên người nhận (recipient).
      const paymentsMade = liab.subcontractorId
        ? payments.filter(p => p.subcontractorId === liab.subcontractorId && p.status === 'approved')
        : liab.relatedAdvanceId
          ? payments.filter(p => p.relatedAdvanceId === liab.relatedAdvanceId && p.status === 'approved')
          : payments.filter(p => p.recipient === liab.name && p.status === 'approved');
      const totalPaidAmount = paymentsMade.length > 0
        ? paymentsMade.reduce((sum, p) => sum + p.amount, 0)
        : (liab.relatedAdvanceId ? 0 : (liab.paid || 0));
      const openingDebt = liab.openingDebt ?? (liab.isOpeningDebt ? liab.value : 0);
      // NCC: Phát Sinh = tổng tongTien PO đã ghi nhận; Thầu Phụ/Khác: giữ nguyên value
      const value = liab.category === 'Nhà Cung Cấp' ? getRecordedPOSum(liab) : (liab.value || 0);
      // Cập nhật: Tổng giá trị = Công nợ đầu kỳ + Phát Sinh
      const tongGiaTri = openingDebt + value;
      // Cập nhật: Còn lại = Tổng giá trị - Đã Trả
      const remaining = tongGiaTri - totalPaidAmount;
      return {
        ...liab,
        value,
        paid: totalPaidAmount,
        remaining,
        openingDebt,
        tongGiaTri,
        date: liab.date || '',
        isAuto: !!liab.relatedAdvanceId
      };
    });

    // Sắp xếp cố định theo tên đơn vị: SELECT '*' không có ORDER BY nên mỗi lần
    // realtime refetch thứ tự dòng trả về có thể khác → bảng nhảy vị trí liên tục.
    return [...subs, ...customs].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
  }, [approvedSubContracts, customLiabilities, payments, purchaseOrders]);

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

  // ── Tab Đơn Hàng: gom theo NCC, ghi nhận công nợ per-order, sửa đơn giá ──
  const [poExpandedSuppliers, setPoExpandedSuppliers] = useState<Set<string>>(new Set());
  const [poPage, setPoPage] = useState(1);
  const [poPageSize, setPoPageSize] = useState(10);
  const [poEditId, setPoEditId] = useState<string | null>(null);
  const [poEditItems, setPoEditItems] = useState<any[]>([]);
  const [poNotesEditing, setPoNotesEditing] = useState(false);
  const [poNotesEdit, setPoNotesEdit] = useState('');

  // Tổng đã thanh toán thực tế của 1 NCC (từ phiếu chi đã duyệt, category supplier_payment)
  const getSupplierPaid = (supplierName: string): number =>
    payments.filter(p => p.category === 'supplier_payment' && p.recipient === supplierName && p.status === 'approved')
      .reduce((s, p) => s + (p.amount || 0), 0);

  // Đơn hàng đã ghi nhận vào Công nợ Trả?
  const isPoRecorded = (poId: string): boolean =>
    customLiabilities.some(l => l.category === 'Nhà Cung Cấp' && Array.isArray(l.recordedPurchaseOrderIds) && (l.recordedPurchaseOrderIds as string[]).includes(poId));

  // Trạng thái dòng đơn hàng: Công Nợ (đã ghi nhận) / Chưa ghi nhận
  const getPoRowStatus = (order: PurchaseOrder): { label: string; tone: string } => {
    if (isPoRecorded(order.id)) return { label: 'Công Nợ', tone: 'amber' };
    return { label: 'Chưa ghi nhận', tone: 'rose' };
  };
  // Đơn hàng "đã hoạt động" = đã xác nhận / hoàn tất. Nháp hoặc đã hủy là chưa hoạt động.
  const isOrderActive = (order: PurchaseOrder): boolean =>
    order.status === 'confirmed' || order.status === 'completed';

  // Đơn hàng chỉ nên xuất hiện ở tab Đơn Hàng (Tài Chính) sau khi Điều Phối Vật Tư
  // đã xác nhận NHẬN ĐƯỢC ít nhất 1 phần hàng — tránh kế toán thấy/ghi nhận công nợ
  // cho đơn còn đang chờ giao. Dùng proposalId (chỉ PO sinh từ Điều Phối Vật Tư mới
  // có) để nhận diện, KHÔNG dùng sự có/không của field receivedQty — vì PO mới tạo,
  // chưa từng nhận hàng lần nào, hoàn toàn chưa có field này trên các dòng (chứ
  // không phải = 0), nên không thể dùng làm dấu hiệu "không theo dõi nhận hàng".
  // Đơn tạo ngoài Điều Phối Vật Tư (không có proposalId) vẫn hiện ngay như trước.
  const poHasAnyReceived = (order: PurchaseOrder): boolean => {
    if (!(order as any).proposalId) return true;
    const items = (order as any).items || [];
    return items.some((it: any) => (Number(it.receivedQty) || 0) > 0);
  };
  // Badge: chữ + viền + nền trắng (đồng bộ)
  const poStatusToneClass = (tone: string): string => {
    switch (tone) {
      case 'amber': return 'bg-white text-amber-600 border border-amber-500';
      case 'emerald': return 'bg-white text-emerald-600 border border-emerald-500';
      default: return 'bg-white text-rose-600 border border-rose-500';
    }
  };

  // Trạng thái đơn hàng phục vụ lọc: kết hợp 2 trục ghi nhận & thanh toán
  // recorded = Công Nợ, unrecorded = Chưa ghi nhận, settled = Đã tất toán, unsettled = Chưa tất toán
  const poOrderStatuses = (order: PurchaseOrder): string[] => {
    const keys: string[] = [];
    if (isPoRecorded(order.id)) keys.push('recorded');
    else keys.push('unrecorded');
    if ((order.congNo || 0) <= 0) keys.push('settled');
    else keys.push('unsettled');
    return keys;
  };

  // ── Tab Đơn Hàng: bộ lọc (lưu localStorage cho lần sau) ──
  const PO_FILTER_KEY = 'hl_fin_po_filters';
  const loadPoFilters = (): { fromDate: string; toDate: string; supplier: string; status: string; project: string } => {
    try {
      const raw = localStorage.getItem(PO_FILTER_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        return { fromDate: p.fromDate || '', toDate: p.toDate || '', supplier: p.supplier || '', status: p.status || '', project: p.project || '' };
      }
    } catch {}
    const y = new Date().getFullYear();
    return { fromDate: `${y}-01-01`, toDate: `${y}-12-31`, supplier: '', status: '', project: '' };
  };
  const [poFilters, setPoFilters] = useState(loadPoFilters);
  const [poSupplierOpen, setPoSupplierOpen] = useState(false);
  useEffect(() => {
    try { localStorage.setItem(PO_FILTER_KEY, JSON.stringify(poFilters)); } catch {}
  }, [poFilters]);
  const updatePoFilter = (patch: Partial<{ fromDate: string; toDate: string; supplier: string; status: string; project: string }>) => {
    setPoFilters(prev => ({ ...prev, ...patch }));
    setPoPage(1);
  };

  // ── Tab Nhập Thu: bộ lọc (lưu localStorage cho lần sau) ──
  const RECEIPT_FILTER_KEY = 'hl_fin_receipt_filters';
  const loadReceiptFilters = (): { fromDate: string; toDate: string; customer: string; form: string } => {
    try {
      const raw = localStorage.getItem(RECEIPT_FILTER_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        return { fromDate: p.fromDate || '', toDate: p.toDate || '', customer: p.customer || '', form: p.form || '' };
      }
    } catch {}
    const yr = new Date().getFullYear();
    return { fromDate: `${yr}-01-01`, toDate: `${yr}-12-31`, customer: '', form: '' };
  };
  const [receiptFilters, setReceiptFilters] = useState(loadReceiptFilters);
  useEffect(() => { try { localStorage.setItem(RECEIPT_FILTER_KEY, JSON.stringify(receiptFilters)); } catch {} }, [receiptFilters]);
  const updateReceiptFilter = (patch: Partial<{ fromDate: string; toDate: string; customer: string; form: string }>) => {
    setReceiptFilters(prev => ({ ...prev, ...patch }));
  };

  // ── Tab Nhập Chi: bộ lọc (lưu localStorage cho lần sau) ──
  const PAYMENT_FILTER_KEY = 'hl_fin_payment_filters';
  const loadPaymentFilters = (): { fromDate: string; toDate: string; category: string; status: string } => {
    try {
      const raw = localStorage.getItem(PAYMENT_FILTER_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        return { fromDate: p.fromDate || '', toDate: p.toDate || '', category: p.category || '', status: p.status || '' };
      }
    } catch {}
    const yr = new Date().getFullYear();
    // Mặc định HIỆN TẤT CẢ phiếu chi (Nhập Chi nay là view tổng hợp/chỉ đọc theo Đối tượng chi).
    return { fromDate: `${yr}-01-01`, toDate: `${yr}-12-31`, category: '', status: '' };
  };
  const [paymentFilters, setPaymentFilters] = useState(loadPaymentFilters);
  useEffect(() => { try { localStorage.setItem(PAYMENT_FILTER_KEY, JSON.stringify(paymentFilters)); } catch {} }, [paymentFilters]);
  const updatePaymentFilter = (patch: Partial<{ fromDate: string; toDate: string; category: string; status: string }>) => {
    setPaymentFilters(prev => ({ ...prev, ...patch }));
  };

  // ── Tab Công nợ Phải Trả: bộ lọc (lưu localStorage cho lần sau) ──
  const LIABILITY_FILTER_KEY = 'hl_fin_liability_filters';
  const loadLiabilityFilters = (): { category: string; status: string; fromDate: string; toDate: string } => {
    const nowYear = new Date().getFullYear();
    const defFrom = `${nowYear}-01-01`;
    const defTo = `${nowYear}-12-31`;
    try {
      const raw = localStorage.getItem(LIABILITY_FILTER_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        return {
          category: p.category || '',
          status: p.status || '',
          fromDate: p.fromDate || defFrom,
          toDate: p.toDate || defTo,
        };
      }
    } catch {}
    return { category: '', status: '', fromDate: defFrom, toDate: defTo };
  };
  const [liabilityFilters, setLiabilityFilters] = useState(loadLiabilityFilters);
  useEffect(() => { try { localStorage.setItem(LIABILITY_FILTER_KEY, JSON.stringify(liabilityFilters)); } catch {} }, [liabilityFilters]);
  const updateLiabilityFilter = (patch: Partial<{ category: string; status: string; fromDate: string; toDate: string }>) => {
    setLiabilityFilters(prev => ({ ...prev, ...patch }));
  };

  // Phân trang riêng cho tab Công nợ Trả
  const [liabilityPage, setLiabilityPage] = useState(1);
  const [liabilityPageSize, setLiabilityPageSize] = useState(10);
  useEffect(() => { setLiabilityPage(1); }, [liabilityFilters.category, liabilityFilters.status, liabilityFilters.fromDate, liabilityFilters.toDate, searchTerm]);

  // ── Mảng đã lọc cho 4 tab Nhập Thu / Nhập Chi / Công nợ Thu / Công nợ Trả ──
  const filteredReceipts = useMemo(() => {
    const kw = (searchTerm || '').toLowerCase().trim();
    return receipts.filter((r: Receipt) => {
      if (receiptFilters.fromDate && (r.date || '').slice(0, 10) < receiptFilters.fromDate) return false;
      if (receiptFilters.toDate && (r.date || '').slice(0, 10) > receiptFilters.toDate) return false;
      if (receiptFilters.customer && r.customerId !== receiptFilters.customer) return false;
      if (receiptFilters.form && r.paymentMethod !== receiptFilters.form) return false;
      if (kw) {
        const custName = (customers.find(c => c.id === r.customerId)?.name || '').toLowerCase();
        const projName = (projects.find(p => p.id === r.projectId)?.name || '').toLowerCase();
        const hay = `${r.code || ''} ${custName} ${projName} ${r.notes || ''}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [receipts, receiptFilters, searchTerm, customers, projects]);

  // Nhập Thu: phân trang + nhóm theo Chủ đầu tư
  const [recPage, setRecPage] = useState(1);
  const [recPageSize, setRecPageSize] = useState(10);
  const [recExpanded, setRecExpanded] = useState<Set<string>>(new Set());
  const [recCustFilterSearch, setRecCustFilterSearch] = useState('');
  const [recCustFilterOpen, setRecCustFilterOpen] = useState(false);
  const receiptGroups = useMemo(() => {
    const map = new Map<string, { customerId: string; customerName: string; receipts: Receipt[] }>();
    for (const r of filteredReceipts) {
      const cid = r.customerId || '__other__';
      const cname = customers.find(c => c.id === cid)?.name || 'Khách hàng khác';
      if (!map.has(cid)) map.set(cid, { customerId: cid, customerName: cname, receipts: [] });
      map.get(cid)!.receipts.push(r);
    }
    return Array.from(map.values()).sort((a, b) => a.customerName.localeCompare(b.customerName));
  }, [filteredReceipts, customers]);
  const recPageInfo = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(receiptGroups.length / recPageSize));
    const safePage = Math.min(recPage, totalPages);
    const pageGroups = receiptGroups.slice((safePage - 1) * recPageSize, safePage * recPageSize);
    return { totalPages, safePage, pageGroups };
  }, [receiptGroups, recPage, recPageSize]);

  const filteredPayments = useMemo(() => {
    const kw = (searchTerm || '').toLowerCase().trim();
    return payments.filter((p: Payment) => {
      if (paymentFilters.fromDate && (p.date || '').slice(0, 10) < paymentFilters.fromDate) return false;
      if (paymentFilters.toDate && (p.date || '').slice(0, 10) > paymentFilters.toDate) return false;
      if (paymentFilters.category && p.category !== paymentFilters.category) return false;
      if (paymentFilters.status && getPaymentDocStatus(p) !== paymentFilters.status) return false;
      if (kw) {
        const projName = (projects.find(pr => pr.id === p.projectId)?.name || '').toLowerCase();
        const hay = `${p.code || ''} ${p.recipient || ''} ${p.notes || ''} ${p.category || ''} ${projName}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [payments, paymentFilters, searchTerm, projects]);

  // Nhập Chi: phân trang + nhóm theo Đối tượng chi (recipient) — bắt chước Nhập Thu
  const [payPage, setPayPage] = useState(1);
  const [payPageSize, setPayPageSize] = useState(10);
  const [payExpanded, setPayExpanded] = useState<Set<string>>(new Set());
  const paymentGroups = useMemo(() => {
    const map = new Map<string, { recipient: string; payments: Payment[] }>();
    for (const p of filteredPayments) {
      const key = (p.recipient || '').trim() || '__khac__';
      if (!map.has(key)) map.set(key, { recipient: p.recipient || 'Đối tượng khác', payments: [] });
      map.get(key)!.payments.push(p);
    }
    return Array.from(map.values()).sort((a, b) => a.recipient.localeCompare(b.recipient, 'vi'));
  }, [filteredPayments]);
  const payPageInfo = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(paymentGroups.length / payPageSize));
    const safePage = Math.min(payPage, totalPages);
    const pageGroups = paymentGroups.slice((safePage - 1) * payPageSize, safePage * payPageSize);
    return { totalPages, safePage, pageGroups };
  }, [paymentGroups, payPage, payPageSize]);
  // Tổng cộng (theo bộ lọc, không chỉ trang hiện tại)
  const payTotalAmount = useMemo(
    () => filteredPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0),
    [filteredPayments]
  );

  const filteredReceivables = useMemo(() => {
    const kw = (searchTerm || '').toLowerCase().trim();
    return groupedReceivables.filter((g: any) => {
      if (receivableFilters.investor && g.investor !== receivableFilters.investor) return false;
      if (receivableFilters.status === 'con_no' && (g.conLai || 0) <= 0) return false;
      if (receivableFilters.status === 'da_thu' && (g.conLai || 0) > 0) return false;
      if (kw) {
        const hay = `${g.investor || ''} ${g.customer?.notes || ''} ${g.projects.map((r: any) => `${r.projectName || ''} ${r.notes || ''}`).join(' ')}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [groupedReceivables, receivableFilters, searchTerm]);

  // Phân trang + tổng hợp Tổng cộng cho tab Công nợ Thu (tính trên toàn bộ filteredReceivables, không chỉ trang hiện tại)
  const receivablePageInfo = useMemo(() => {
    const total = filteredReceivables.length;
    const totalPages = Math.max(1, Math.ceil(total / receivablePageSize));
    const safePage = Math.min(Math.max(1, receivablePage), totalPages);
    const start = (safePage - 1) * receivablePageSize;
    const pageGroups = filteredReceivables.slice(start, start + receivablePageSize);
    const totals = filteredReceivables.reduce((acc: any, g: any) => {
      acc.cdkValue += g.cdkValue || 0;
      acc.tongHopDong += g.tongHopDong || 0;
      acc.tongGiaTri += g.tongGiaTri || 0;
      acc.daThu += g.daThu || 0;
      acc.conLai += g.conLai || 0;
      return acc;
    }, { cdkValue: 0, tongHopDong: 0, tongGiaTri: 0, daThu: 0, conLai: 0 });
    return { total, totalPages, safePage, pageGroups, totals };
  }, [filteredReceivables, receivablePage, receivablePageSize]);

  // Gom nhóm Công nợ Trả theo Nhà Cung Cấp / Thầu Phụ: mỗi đơn vị = 1 dòng tổng
  // hợp, mở rộng để xem chi tiết từng khoản nợ (giống groupedReceivables ở Công
  // nợ Thu). Gom theo subcontractorId khi có, nếu không thì theo tên + phân loại
  // (NCC hiện chưa có ID ổn định để gom theo ID).
  const groupedLiabilities = useMemo(() => {
    const catFilter = liabilityFilters.category;
    const from = liabilityFilters.fromDate;
    const to = liabilityFilters.toDate;
    const src = mergedLiabilities.filter((l: any) => {
      if (catFilter && l.category !== catFilter) return false;
      // Lọc theo ngày: công nợ không có ngày vẫn được giữ (tránh ẩn dữ liệu cũ chưa có ngày)
      const d = (l.date || '').slice(0, 10);
      if (from && d && d < from) return false;
      if (to && d && d > to) return false;
      return true;
    });
    // Tách 1 khoản nợ NCC có nhiều Đơn Mua Hàng (PO) đã ghi nhận thành nhiều dòng
    // chi tiết riêng — mỗi PO 1 dòng (số liệu lấy trực tiếp từ chính PO đó: tongTien/
    // thanhToanThucTe/congNo), thay vì gộp chung 1 dòng "Phát Sinh" duy nhất như trước.
    // Giúp dễ nhận biết & xóa đúng PO khi cần (tránh nhầm lẫn như vụ Tinh Tú Cát).
    const expandToDetailRows = (l: any): any[] => {
      const poIds: string[] = Array.isArray(l.recordedPurchaseOrderIds) ? l.recordedPurchaseOrderIds : [];
      if (l.category !== 'Nhà Cung Cấp' || poIds.length === 0) return [l];
      const rows: any[] = [];
      const openingDebt = (l.openingDebt ?? (l.isOpeningDebt ? l.value : 0)) || 0;
      if (openingDebt > 0) {
        rows.push({
          ...l,
          id: `${l.id}_cdk`,
          notes: 'Công nợ đầu kỳ',
          value: 0,
          openingDebt,
          tongGiaTri: openingDebt,
          paid: 0,
          remaining: openingDebt,
        });
      }
      poIds.forEach(poId => {
        const po = purchaseOrders.find(p => p.id === poId);
        if (!po) return; // PO đã bị xóa — bỏ qua, không hiện dòng "ma"
        const items = po.items || [];
        // Chỉ tính công nợ theo PHẦN ĐÃ NHẬN nếu PO có dữ liệu receivedQty (tức đã
        // đi qua bước "Nhận hàng" ở Điều Phối Vật Tư). Với PO cũ/tạo tay chưa từng
        // theo dõi receivedQty theo dòng, coi như đã nhận đủ (giữ hành vi cũ) —
        // tránh làm "biến mất" công nợ thật của các đơn hàng không dùng luồng này.
        const hasReceiveTracking = items.some((it: any) => it.receivedQty !== undefined && it.receivedQty !== null);
        const isFullyReceived = !hasReceiveTracking || items.every((it: any) => (Number(it.receivedQty) || 0) >= (Number(it.qty) || 0));
        const tongTien = po.tongTien || 0;
        // Đã nhận đủ → dùng thẳng tongTien gốc (tránh lệch vài đồng do cộng dồn
        // qty × đơn giá qua nhiều dòng số lẻ, ví dụ vật tư tính theo m²).
        const receivedValue = isFullyReceived
          ? tongTien
          : items.reduce((s: number, it: any) => s + (Number(it.receivedQty) || 0) * (Number(it.price) || 0), 0);
        const isPartial = !isFullyReceived;
        rows.push({
          ...l,
          id: `po:${po.id}`,
          notes: `Đơn hàng ${po.id}${po.projectName ? ` — ${po.projectName}` : ''}` +
            (isPartial ? ` (đã nhận ${receivedValue.toLocaleString('vi-VN')}/${tongTien.toLocaleString('vi-VN')}đ hàng)` : ''),
          value: receivedValue,
          openingDebt: 0,
          tongGiaTri: receivedValue,
          paid: po.thanhToanThucTe || 0,
          remaining: receivedValue - (po.thanhToanThucTe || 0),
          purchaseOrderId: po.id,
        });
      });
      return rows.length > 0 ? rows : [l];
    };

    // rawItems: bản ghi Liability gốc (chưa tách PO) — dùng để tính "Đã Trả" thật,
    // đối chiếu theo tên/subcontractorId với phiếu chi đã duyệt (nguồn tin cậy nhất
    // cho số tiền thực đã chi, không phụ thuộc phiếu chi có gắn đúng 1 PO cụ thể hay
    // không). items: bản ghi đã tách theo PO — dùng để tính "Phát Sinh/Tổng giá trị/
    // Còn lại" (chỉ ghi nhận theo phần đã nhận hàng thật) VÀ để hiển thị chi tiết khi
    // xổ xuống — 2 số này phải khớp nhau giữa dòng tổng hợp và dòng chi tiết.
    const groups = new Map<string, any>();
    src.forEach(l => {
      const key = l.subcontractorId ? `sub:${l.subcontractorId}` : `name:${l.category || ''}:${l.name || 'Không xác định'}`;
      if (!groups.has(key)) {
        groups.set(key, { key, name: l.name || 'Không xác định', category: l.category, rawItems: [], items: [] });
      }
      const g = groups.get(key)!;
      g.rawItems.push(l);
      g.items.push(...expandToDetailRows(l));
    });
    return Array.from(groups.values()).map(g => {
      const openingDebt = g.items.reduce((s: number, l: any) => s + ((l.openingDebt ?? (l.isOpeningDebt ? l.value : 0)) || 0), 0);
      const value = g.items.reduce((s: number, l: any) => s + (l.value || 0), 0);
      const tongGiaTri = g.items.reduce((s: number, l: any) => s + (l.tongGiaTri || 0), 0);
      const paid = g.rawItems.reduce((s: number, l: any) => s + (l.paid || 0), 0);
      const remaining = tongGiaTri - paid;
      const notes = g.items.length === 1 ? g.items[0].notes : `${g.items.length} khoản nợ`;
      return { ...g, openingDebt, value, tongGiaTri, paid, remaining, notes };
    }).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
  }, [mergedLiabilities, purchaseOrders, liabilityFilters.category, liabilityFilters.fromDate, liabilityFilters.toDate]);

  const filteredLiabilities = useMemo(() => {
    const kw = (searchTerm || '').toLowerCase().trim();
    return groupedLiabilities.filter((g: any) => {
      if (liabilityFilters.status === 'con_no' && (g.remaining || 0) <= 0) return false;
      if (liabilityFilters.status === 'da_thu' && (g.remaining || 0) > 0) return false;
      if (kw) {
        const hay = `${g.name || ''} ${g.category || ''} ${g.items.map((l: any) => l.notes || '').join(' ')}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [groupedLiabilities, liabilityFilters.status, searchTerm]);

  // Phân trang + tổng hợp Tổng cộng cho tab Công nợ Trả (tính trên toàn bộ filteredLiabilities)
  const liabilityPageInfo = useMemo(() => {
    const total = filteredLiabilities.length;
    const totalPages = Math.max(1, Math.ceil(total / liabilityPageSize));
    const safePage = Math.min(Math.max(1, liabilityPage), totalPages);
    const start = (safePage - 1) * liabilityPageSize;
    const pageItems = filteredLiabilities.slice(start, start + liabilityPageSize);
    const totals = filteredLiabilities.reduce((acc: any, l: any) => {
      const od = (l.openingDebt ?? (l.isOpeningDebt ? l.value : 0)) || 0;
      acc.openingDebt += od;
      acc.value += l.value || 0;
      acc.tongGiaTri += l.tongGiaTri || 0;
      acc.paid += l.paid || 0;
      acc.remaining += l.remaining || 0;
      return acc;
    }, { openingDebt: 0, value: 0, tongGiaTri: 0, paid: 0, remaining: 0 });
    return { total, totalPages, safePage, pageItems, totals };
  }, [filteredLiabilities, liabilityPage, liabilityPageSize]);

  // Tạo phiếu chi cho toàn bộ NCC (từ dòng nhà cung cấp) — khóa khi đã tất toán
  const [poSupplierPay, setPoSupplierPay] = useState<{ open: boolean; supplierName: string; max: number }>({ open: false, supplierName: '', max: 0 });
  const handleOpenSupplierPayment = (supplierName: string, max: number) => {
    if (max <= 0) return;
    setPoPaymentAmount(String(max)); setPoPaymentNote(''); setPoPaymentMethod('transfer');
    setPoPaymentDate(new Date().toISOString().slice(0, 10));
    setPoSupplierPay({ open: true, supplierName, max });
  };
  const handleCreateSupplierPayment = () => {
    const amount = Number(poPaymentAmount) || 0;
    if (amount <= 0) { addToast({ title: '⚠️ Thiếu thông tin', message: 'Vui lòng nhập số tiền thanh toán.', type: 'warning' }); return; }
    if (amount > poSupplierPay.max + 1) { addToast({ title: '⚠️ Vượt quá', message: 'Số tiền không được lớn hơn còn lại.', type: 'warning' }); return; }
    const payId = `pay_${Date.now()}`;
    const newPayment: Payment = {
      id: payId,
      code: `PC-NCC-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${String(Math.floor(Math.random() * 900 + 100))}`,
      date: poPaymentDate,
      paymentAt: new Date().toISOString(),
      recipient: poSupplierPay.supplierName,
      category: 'supplier_payment',
      amount,
      paymentMethod: poPaymentMethod,
      notes: poPaymentNote.trim() || `Thanh toán nhà cung cấp ${poSupplierPay.supplierName}`,
      proposer: currentUser?.name || 'Kế toán',
      approver: 'Trương Hữu Long (Giám đốc)',
      status: 'pending',
    };
    onAddPayment(newPayment);
    setPoSupplierPay({ open: false, supplierName: '', max: 0 });
    setPoPaymentAmount('0'); setPoPaymentNote('');
    addToast({ title: '✅ Đã lập phiếu chi', message: `Phiếu chi ${newPayment.code} cho ${poSupplierPay.supplierName} đã tạo. Chờ duyệt.`, type: 'success' });
  };

  // Sửa đơn giá các vật tư của 1 đơn hàng (chưa ghi nhận Công nợ)
  const openPoPriceEdit = (order: PurchaseOrder) => {
    if (isPoRecorded(order.id)) { addToast({ title: '⚠️ Đã ghi nhận', message: 'Đơn hàng đã ghi nhận Công nợ, không thể sửa đơn giá.', type: 'warning' }); return; }
    setPoEditId(order.id);
    setPoEditItems((order.items || []).map((it: any) => ({ ...it })));
  };
  // Sửa đơn giá / số lượng 1 dòng vật tư. Ghi đồng bộ CẢ 2 shape
  // (Điều phối: price/qty/totalPrice  +  Tài Chính: donGia/soLuong/thanhTien)
  // để dữ liệu không bị mất khi PO đến từ nguồn nào (đề xuất vật tư hay nhập tay).
  const handlePoItemPriceChange = (idx: number, field: 'donGia' | 'soLuong', value: any) => {
    setPoEditItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const num = Number(value) || 0;
      const next = { ...it };
      if (field === 'donGia') {
        const qty = poItemQty(it);            // đọc đúng shape
        const tt = qty * num;
        next.donGia = num; next.price = num;
        next.thanhTien = tt; next.totalPrice = tt;
      } else {
        const price = poItemPrice(it);          // đọc đúng shape
        const tt = num * price;
        next.soLuong = num; next.qty = num;
        next.thanhTien = tt; next.totalPrice = tt;
      }
      return next;
    }));
  };
  const handleSavePoPrices = async () => {
    const order = purchaseOrders.find(o => o.id === poEditId);
    if (!order) { setPoEditId(null); return; }
    const newTong = poEditItems.reduce((s, it) => s + (poItemTotal(it) || 0), 0);
    const updated: PurchaseOrder = { ...order, items: poEditItems as any, tongTien: newTong, congNo: Math.max(0, newTong - (order.thanhToanThucTe || 0)) };
    try {
      await dbService.purchaseOrders.save(updated);
      setPurchaseOrders(prev => prev.map(o => o.id === poEditId ? updated : o));
      setPoDetailModal(prev => prev.order ? { ...prev, order: updated } : prev);

      // Đơn thuộc "Đề Xuất Kho" (mua hàng nhập kho): hàng đã được cộng vào tồn kho
      // lúc "Nhận hàng" theo đơn giá tại thời điểm đó. Nếu kế toán sửa lại đơn giá
      // ở đây SAU KHI hàng đã về kho, phải đồng bộ luôn đơn giá mới vào Kho — nếu
      // không, giá trị tồn kho sẽ vĩnh viễn lệch với giá đã thực trả cho NCC.
      if (order.projectId === WAREHOUSE_PROJECT_ID) {
        try {
          const currentInv: any[] = await dbService.inventory.list();
          let syncedCount = 0;
          for (const it of poEditItems as any[]) {
            const name = poItemName(it);
            const newPrice = poItemPrice(it);
            const matched = currentInv.find((i: any) =>
              i.code?.toLowerCase() === name?.toLowerCase() || i.name?.toLowerCase() === name?.toLowerCase());
            if (matched && matched.unitPrice !== newPrice) {
              await dbService.inventory.save({ ...matched, unitPrice: newPrice }).catch(() => {});
              syncedCount++;
            }
          }
          if (syncedCount > 0) window.dispatchEvent(new CustomEvent('hl-inventory-updated'));
        } catch (invErr) {
          console.error('Lỗi đồng bộ đơn giá vào Kho:', invErr);
        }
      }

      addToast({ title: '✅ Đã cập nhật', message: `Đã cập nhật đơn giá đơn ${order.id}.`, type: 'success' });
    } catch (err) {
      console.error('Lỗi cập nhật đơn giá:', err);
      addToast({ title: '❌ Lỗi', message: 'Không thể lưu đơn giá.', type: 'error' });
    }
    setPoEditId(null); setPoEditItems([]);
  };
  const handleSavePoProject = async (orderId: string, projectId: string, projectName: string) => {
    const order = purchaseOrders.find(o => o.id === orderId);
    if (!order) return;
    const updated: PurchaseOrder = { ...order, projectId, projectName };
    try {
      await dbService.purchaseOrders.save(updated);
      setPurchaseOrders(prev => prev.map(o => o.id === orderId ? updated : o));
      setPoDetailModal(prev => prev.order ? { ...prev, order: updated } : prev);
      addToast({ title: '✅ Đã cập nhật', message: `Đã gán dự án cho đơn ${orderId}.`, type: 'success' });
    } catch (err) {
      console.error('Lỗi cập nhật dự án đơn hàng:', err);
      addToast({ title: '❌ Lỗi', message: 'Không thể lưu dự án đơn hàng.', type: 'error' });
    }
  };
  const handleSavePoNotes = async () => {
    const order = purchaseOrders.find(o => o.id === poDetailModal.order?.id);
    if (!order) { setPoNotesEditing(false); return; }
    const updated: PurchaseOrder = { ...order, notes: poNotesEdit };
    try {
      await dbService.purchaseOrders.save(updated);
      setPurchaseOrders(prev => prev.map(o => o.id === order.id ? updated : o));
      setPoDetailModal(prev => prev.order ? { ...prev, order: updated } : prev);
      setPoNotesEditing(false);
      addToast({ title: '✅ Đã lưu', message: `Đã cập nhật ghi chú đơn ${order.id}.`, type: 'success' });
    } catch (err) {
      console.error('Lỗi lưu ghi chú đơn hàng:', err);
      addToast({ title: '❌ Lỗi', message: 'Không thể lưu ghi chú.', type: 'error' });
    }
  };
  const handleDeletePoUnrecorded = async (id: string) => {
    if (isPoRecorded(id)) { addToast({ title: '⚠️ Đã ghi nhận', message: 'Đơn hàng đã ghi nhận Công nợ, không thể xóa.', type: 'warning' }); setPoDeleteId(null); return; }
    if (!window.confirm(`⚠️ Xóa đơn mua ${id}?\nHành động này không thể hoàn tác.`)) { setPoDeleteId(null); return; }
    try {
      await dbService.purchaseOrders.delete(id);
      setPurchaseOrders(prev => prev.filter(o => o.id !== id));
      onDeletePurchaseOrder?.(id);
      addToast({ title: '🗑️ Đã xóa', message: `Đã xóa đơn mua ${id}.`, type: 'info' });
    } catch (err) {
      console.error('Lỗi xóa đơn mua:', err);
      addToast({ title: '❌ Lỗi', message: 'Không thể xóa đơn mua.', type: 'error' });
    }
    setPoDeleteId(null);
  };

  // Reset receipt selection when switching between nhap_thu and nhap_chi
  useEffect(() => {
    setRecSelectedRows(new Set());
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

  const pendingNewCustIdRef = useRef<string | null>(null); // Track new customer ID for auto-select
  const [receiptPrefill, setReceiptPrefill] = useState<ReceiptFormPrefill | null>(null);

  useEffect(() => {
    if (activeSubTab === 'nhap_thu') {
      const storedProj = localStorage.getItem('hl_prefill_receipt_project_id');
      const storedCust = localStorage.getItem('hl_prefill_receipt_customer_id');
      const storedAmount = localStorage.getItem('hl_prefill_receipt_amount');
      const storedNotes = localStorage.getItem('hl_prefill_receipt_notes');

      if (storedProj || storedCust || storedAmount || storedNotes) {
        setReceiptPrefill({
          custId: storedCust || undefined,
          projId: storedProj || undefined,
          amount: storedAmount ? Number(storedAmount) : undefined,
          notes: storedNotes || undefined,
        });
        setShowRecForm(true);

        // Clear them so they don't fire again
        localStorage.removeItem('hl_prefill_receipt_project_id');
        localStorage.removeItem('hl_prefill_receipt_customer_id');
        localStorage.removeItem('hl_prefill_receipt_amount');
        localStorage.removeItem('hl_prefill_receipt_notes');
      }
    }
  }, [activeSubTab]);

  // Auto-select newly created customer from "Thêm khách hàng nhanh" + reopen receipt form
  const [autoSelectCustId, setAutoSelectCustId] = useState<string | null>(null);
  useEffect(() => {
    if (!showAddCustomerModal && pendingNewCustIdRef.current) {
      const newId = pendingNewCustIdRef.current;
      pendingNewCustIdRef.current = null;
      const exists = customers.some(c => c.id === newId);
      if (exists) {
        setAutoSelectCustId(newId);
        setActiveSubTab('nhap_thu');
        setShowRecForm(true);
      }
    }
  }, [showAddCustomerModal, customers]);

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
  const [payRecipientId, setPayRecipientId] = useState('');   // Mã đối tượng nhận (chuẩn hóa, thay cho recipient tên)
  const [payRecipientKind, setPayRecipientKind] = useState<'supplier' | 'employee' | 'subcontractor' | ''>('');
  const [payProj, setPayProj] = useState(projects[0]?.id || '');
  const [payPurchaseOrder, setPayPurchaseOrder] = useState('');
  const [payCategory, setPayCategory] = useState<'material' | 'labor' | 'shipping' | 'machinery' | 'general' | 'other' | 'subcontractor_advance' | 'site_expense' | 'salary' | 'supplier_payment' | 'salary_advance' | 'cash_fund'>('supplier_payment');
  const [payAmount, setPayAmount] = useState<number | string>('');
  const [payMethod, setPayMethod] = useState<'cash' | 'transfer' | 'cash_fund'>('cash');
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
  const getRecipientChoices = () => {
    let rawList: { id: string; name: string; subText?: string; kind: 'supplier' | 'employee' }[] = [];

    if (payCategory === 'subcontractor_advance') {
      rawList = suppliers.map(s => ({
        id: s.id,
        name: s.name,
        subText: s.field || 'Thầu phụ thi công',
        kind: 'supplier' as const
      }));
    } else if (payCategory === 'site_expense' || payCategory === 'salary' || payCategory === 'salary_advance') {
      rawList = employees.map(emp => ({
        id: emp.id,
        name: emp.name,
        subText: `${emp.position} - ${emp.department}`,
        kind: 'employee' as const
      }));
    } else if (payCategory === 'supplier_payment') {
      rawList = suppliers.map(s => ({
        id: s.id,
        name: s.name,
        subText: s.field || 'Nhà cung cấp',
        kind: 'supplier' as const
      }));
    } else {
      rawList = [
        ...employees.map(emp => ({ id: emp.id, name: emp.name, subText: emp.position, kind: 'employee' as const })),
        ...suppliers.map(s => ({ id: s.id, name: s.name, subText: s.field, kind: 'supplier' as const }))
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
    let amount = Number(quickProposalAmount);
    let expenseItems: { id: string; item: string; amount: number; note: string; projectId?: string; projectName?: string }[] | undefined;
    let settlerId = '';
    let settlerName = '';
    if (quickProposalType === 'project_expense_proposal') {
      const validRows = quickProposalExpenseItems.filter(r => (Number(r.amount) || 0) > 0 || r.item.trim());
      if (validRows.length === 0) {
        addToast({ title: '⚠️ Lỗi nhập liệu', message: 'Vui lòng thêm ít nhất một hạng mục chi tiêu hợp lệ!', type: 'error' });
        return;
      }
      // Mỗi dòng chi tiêu PHẢI gắn đúng công trình của nó — đây là điều kiện để
      // "Công Nợ Trả" nhóm đúng theo NGƯỜI nhận tiền mà vẫn tra được khoản chi
      // nào thuộc công trình nào (thay vì gán cứng đối tượng nhận = tên công trình).
      const rowMissingProject = validRows.find(r => !r.projectId);
      if (rowMissingProject) {
        addToast({ title: '⚠️ Lỗi nhập liệu', message: 'Vui lòng chọn Công trình cho từng dòng chi tiêu!', type: 'error' });
        return;
      }
      amount = validRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      expenseItems = validRows.map(r => ({ id: r.id, item: r.item, amount: Number(r.amount) || 0, note: r.note, projectId: r.projectId, projectName: r.projectName }));
    }
    if (!amount || amount <= 0) {
      addToast({ title: '⚠️ Lỗi nhập liệu', message: 'Vui lòng nhập số tiền đề xuất hợp lệ!', type: 'error' });
      return;
    }

    // Xác định dự án & hình thức (Chi Thầu Phụ: Tạm ứng / Thanh toán công nợ)
    const isDebtMode = quickProposalType === 'subcontractor_advance' && quickProposalSubMode === 'debt';
    const selProject = projects.find(p => p.id === quickProposalProjId);
    const projectRequired = quickProposalType === 'subcontractor_advance' && quickProposalSubMode === 'advance';
    if (projectRequired && !selProject) {
      addToast({ title: '⚠️ Lỗi nhập liệu', message: 'Vui lòng chọn Dự án / Công trình!', type: 'error' });
      return;
    }
    // Tên dự án cấp đề xuất: với Chi phí Công trình, mỗi DÒNG đã tự mang công
    // trình riêng (xem expenseItems) — trường này chỉ để hiển thị tóm tắt: nếu
    // mọi dòng cùng 1 công trình thì lấy đúng tên đó, khác nhau thì ghi số lượng.
    let projectNameForSave: string;
    let projectIdForSave: string;
    if (quickProposalType === 'project_expense_proposal') {
      const distinctProjIds = [...new Set((expenseItems || []).map(r => r.projectId).filter(Boolean))] as string[];
      if (distinctProjIds.length === 1) {
        projectIdForSave = distinctProjIds[0];
        projectNameForSave = expenseItems?.find(r => r.projectId === distinctProjIds[0])?.projectName || '';
      } else {
        projectIdForSave = '';
        projectNameForSave = `${distinctProjIds.length} công trình`;
      }
    } else {
      // Tên dự án: Thanh Toán Công Nợ (cố định, không gắn dự án) | theo dự án chọn | rỗng
      projectNameForSave = isDebtMode ? 'Thanh Toán Công Nợ' : (selProject?.name || '');
      projectIdForSave = isDebtMode ? '' : (selProject?.id || '');
    }

    // Xác định đối tượng nhận: Đề Xuất Chi Phí (project_expense_proposal) LUÔN
    // gán NGƯỜI LẬP ĐỀ XUẤT (currentUser) làm Đối tượng chi — không dùng tên
    // công trình (công trình không "nhận tiền"), không cho chọn tay người khác
    // (mỗi đề xuất do 1 người chịu trách nhiệm lập, xem "Nhập Chi"/"Công Nợ Trả"
    // muốn nhóm đúng theo người này). Công trình cụ thể của từng khoản chi vẫn
    // được lưu riêng trong expenseItems[].projectId/projectName ở trên.
    const effectiveRecipientKind: QuickRecipientKind = quickProposalType === 'project_expense_proposal' ? 'employee' : quickProposalRecipientKind;
    let subId = '';
    let subName = '';
    if (quickProposalType === 'project_expense_proposal' || quickProposalType === 'cash_fund_deposit') {
      // Nạp Quỹ Tiền Mặt: cũng KHÔNG cho chọn tay đối tượng nhận — người chịu
      // trách nhiệm nạp quỹ luôn là người lập đề xuất (giống Chi phí Công trình).
      subId = (currentUser as any)?.id || '';
      subName = (currentUser as any)?.name || 'Nhân sự lập đề xuất';
    } else if (effectiveRecipientKind === 'supplier') {
      const selSub = suppliers.find(s => s.id === quickProposalSubId);
      if (!selSub) {
        addToast({ title: '⚠️ Lỗi nhập liệu', message: 'Vui lòng chọn Thầu phụ / Nhà thầu!', type: 'error' });
        return;
      }
      subId = selSub.id;
      subName = selSub.name;
    } else if (effectiveRecipientKind === 'employee') {
      const selEmp = employees.find(e => e.id === quickProposalSubId);
      if (!selEmp) {
        addToast({ title: '⚠️ Lỗi nhập liệu', message: 'Vui lòng chọn Nhân viên!', type: 'error' });
        return;
      }
      subId = selEmp.id;
      subName = selEmp.name;
    } else {
      // Đối tượng là công trình / dự án
      subId = selProject?.id || '';
      subName = selProject?.name || '';
    }

    // taskName minh bạch: Ứng lương nhân sự phải bắt đầu bằng "Ứng lương" để map đúng phiếu chi.
    // Kiểm tra theo quickProposalType (KHÔNG phải effectiveRecipientKind) — vì Chi phí Công
    // trình giờ cũng dùng recipientKind 'employee' nhưng KHÔNG phải là ứng lương.
    let taskName = isDebtMode ? 'Thanh Toán Công Nợ Thầu Phụ'
      : quickProposalType === 'project_expense_proposal' ? projectNameForSave
      : quickProposalType === 'cash_fund_deposit' ? 'Nạp Quỹ Tiền Mặt'
      : (selProject?.name || '');
    if (quickProposalType === 'salary_advance') {
      const period = new Date().toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' });
      taskName = `Ứng lương kỳ ${period}`;
    }

    // Sinh mã đề xuất chống trùng
    const proposalCode = generateOrderCode('DX', subcontractorAdvances.map(a => a.id));
    const todayVal = new Date().toISOString().split('T')[0];

    // Người xét duyệt & Người quyết toán: lấy từ cấu hình Quyền Phê Duyệt (Tài Chính - Kế Toán)
    let approverName = '';
    let approverId = '';
    const cfgDocType: 'finance_expense_proposal' | 'finance_advance_proposal' | 'salary_advance' =
      quickProposalType === 'subcontractor_advance' ? 'finance_advance_proposal'
      : (quickProposalType === 'project_expense_proposal' || quickProposalType === 'supplier_payment_proposal' || quickProposalType === 'cash_fund_deposit') ? 'finance_expense_proposal'
      : 'salary_advance';
    const configuredApprover = getConfiguredApprover(cfgDocType);
    if (configuredApprover?.name) {
      approverName = configuredApprover.name;
      approverId = configuredApprover.id;
    } else {
      const directorEmp = (employeesProp || []).find(e => e.role === 'director');
      approverName = directorEmp?.name || (currentUser as any)?.name || 'Ban Giám Đốc';
      approverId = directorEmp?.id || (currentUser as any)?.id || '';
    }
    const configuredSettler = getConfiguredSettler(cfgDocType);
    if (configuredSettler?.name) {
      settlerId = configuredSettler.id;
      settlerName = configuredSettler.name;
    }

    const newProposal: SubcontractorAdvanceProposal = {
      id: proposalCode,
      subcontractorId: subId,
      subcontractorName: subName,
      // '' (chuỗi rỗng) KHÔNG hợp lệ cho cột project_id có khóa ngoại tới projects(id) —
      // cùng lý do như taskId phía dưới. Chi Nhà Cung Cấp / Thanh Toán Công Nợ không gắn
      // dự án cụ thể → phải để undefined (NULL), không phải ''.
      projectId: projectIdForSave || undefined,
      projectName: projectNameForSave,
      // '' (chuỗi rỗng) KHÔNG hợp lệ cho cột task_id có khóa ngoại tới tasks(id) —
      // insert sẽ báo lỗi "violates foreign key constraint" vì '' không khớp bất
      // kỳ task nào (khác NULL, vốn được FK bỏ qua). Đề Xuất Nhanh thường KHÔNG
      // gắn với 1 công việc cụ thể nào → phải để undefined (NULL), không phải ''.
      taskId: quickProposalTaskId || undefined,
      taskName: quickProposalTaskName || taskName,
      amount,
      reason: quickProposalReason || `Đề xuất chi${projectNameForSave ? ` cho: ${projectNameForSave}` : ''}`,
      approver: approverId,
      approverName,
      creator: (currentUser as any)?.id || '',
      creatorName: (currentUser as any)?.name || 'Kế Toán',
      status: 'pending_approval',
      date: todayVal,
      proposalDate: todayVal,
      type: quickProposalType,
      expenseItems: expenseItems,
      settlerId: settlerId || undefined,
      settlerName: settlerName || undefined,
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
          content: `🔔 Đề xuất ${quickProposalType === 'subcontractor_advance' ? (isDebtMode ? 'THANH TOÁN CÔNG NỢ THẦU PHỤ' : 'TẠM ỨNG THẦU PHỤ') : quickProposalType === 'supplier_payment_proposal' ? 'CHI NHÀ CUNG CẤP' : quickProposalType === 'cash_fund_deposit' ? 'NẠP QUỸ TIỀN MẶT' : 'CHI PHÍ DỰ ÁN'} ${proposalCode} (${projectNameForSave}) ${amount.toLocaleString('vi-VN')}đ. Lý do: ${newProposal.reason}. Vui lòng xem xét.`,
          relatedEntity: { type: 'advance', id: proposalCode },
        });
      }

      addToast({
        title: '✅ Đã gửi Đề Xuất',
        message: `Mã đề xuất ${proposalCode} · ${amount.toLocaleString('vi-VN')}đ · ${projectNameForSave} · Người duyệt: ${approverName}`,
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
    setQuickProposalSubMode('advance');
  };

  const handleAddPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Chặn CỨNG: không cho lập phiếu chi nếu số tiền vượt số dư Quỹ tiền mặt hiện có
    // (trước đây chỉ cảnh báo mềm — quỹ thực tế không thể chi âm nên phải chặn hẳn).
    if (payMethod === 'cash_fund' && Number(payAmount) > cashFundBalance) {
      addToast({
        title: '⛔ Vượt số dư Quỹ',
        message: `Số tiền ${Number(payAmount).toLocaleString('vi-VN')}đ vượt số dư Quỹ tiền mặt hiện có (${cashFundBalance.toLocaleString('vi-VN')}đ). Không thể lập phiếu.`,
        type: 'error'
      });
      return;
    }

    // ─── Chuẩn hóa liên kết theo MÃ (id) thay vì tên ──────────────────────
    // Ứng lương từ đề xuất: empId nằm trong proposal.subcontractorId.
    // Thủ công: lấy id từ form chọn (payRecipientId + payRecipientKind) — CHÍNH XÁC 100%.
    let resolvedEmployeeId: string | undefined;
    let resolvedSupplierId: string | undefined;
    let resolvedSubcontractorId: string | undefined;

    // Loại đề xuất — dùng chung để chuẩn hóa FK người nhận, category, dự án bên dưới
    // (KHỚP với logic phân loại trong handleCreateVoucherFromProposal).
    const proposalIsSalaryAdvance = activeProposalForPayment
      ? (activeProposalForPayment.type === 'salary_advance' || !!activeProposalForPayment.taskName?.startsWith('Ứng lương'))
      : false;
    const proposalIsProjectExpense = activeProposalForPayment?.type === 'project_expense_proposal';
    const proposalIsSupplierPayment = activeProposalForPayment?.type === 'supplier_payment_proposal';
    const proposalIsCashFundDeposit = activeProposalForPayment?.type === 'cash_fund_deposit';

    if (activeProposalForPayment) {
      // `subcontractorId` trên SubcontractorAdvanceProposal là trường ID người nhận
      // DÙNG CHUNG cho mọi loại đề xuất (đặt tên theo lịch sử) — thực chất có thể là
      // nhân viên (ứng lương/chi phí công trình/nạp quỹ), nhà cung cấp, hoặc thầu phụ tùy `type`.
      if (proposalIsSalaryAdvance || proposalIsProjectExpense || proposalIsCashFundDeposit) {
        resolvedEmployeeId = activeProposalForPayment.subcontractorId;
      } else if (proposalIsSupplierPayment) {
        resolvedSupplierId = activeProposalForPayment.subcontractorId;
      } else {
        resolvedSubcontractorId = activeProposalForPayment.subcontractorId;
      }
    } else {
      if (payRecipientKind === 'employee' && payRecipientId) resolvedEmployeeId = payRecipientId;
      else if (payRecipientKind === 'supplier' && payRecipientId) resolvedSupplierId = payRecipientId;
      else if (payRecipientKind === 'subcontractor' && payRecipientId) resolvedSubcontractorId = payRecipientId;
    }

    // Giải mã người duyệt (approver) thành id nhân viên (dự phòng theo tên tiền tố).
    const approverName = 'Trương Hữu Long (Giám đốc)';
    const resolvedApproverId = (employeesProp || []).find((e: any) =>
      e.name && approverName.startsWith(e.name)
    )?.id;

    const newPay: Payment = {
      id: `pay_${Date.now()}`,
      code: `PC-2026-${Math.floor(Math.random() * 900 + 100)}`,
      date: new Date().toISOString().split('T')[0],
      employeeId: resolvedEmployeeId,
      supplierId: resolvedSupplierId,
      subcontractorId: resolvedSubcontractorId,
      // Khi lập phiếu chi tất toán Đề Xuất Tạm Ứng thầu phụ, gắn nhận diện thầu phụ
      // để thanh toán tự động khớp & cập nhật Công nợ Trả (không phụ thuộc tên gõ tay)
      recipient: activeProposalForPayment?.subcontractorName || payRecipient,
      // Dự án gán chi: khi lập phiếu từ đề xuất, CHỈ lấy đúng projectId thật của đề
      // xuất — KHÔNG fallback sang payProj (trước đây fallback này có thể lấy nhầm
      // dự án đầu tiên trong danh sách khi đề xuất Chi Nhà Cung Cấp/Thanh Toán Công
      // Nợ Thầu Phụ/Ứng Lương vốn không gắn dự án). Thủ công (không qua đề xuất) vẫn
      // lấy từ payProj như cũ.
      projectId: activeProposalForPayment
        ? (activeProposalForPayment.projectId || undefined)
        : ((payProj === 'none' || !payProj) ? undefined : payProj),
      purchaseOrderId: (!activeProposalForPayment && payPurchaseOrder) ? payPurchaseOrder : undefined,
      // Xác định category theo ĐÚNG loại đề xuất (`type`), không hardcode
      // 'subcontractor_advance' cho mọi đề xuất — trước đây làm Đề Xuất Chi Phí Công
      // Trình / Ứng Lương / Chi Nhà Cung Cấp đều bị gắn nhầm vào category Thầu Phụ.
      category: activeProposalForPayment
        ? (proposalIsSalaryAdvance ? 'salary_advance'
          : proposalIsProjectExpense ? 'site_expense'
          : proposalIsSupplierPayment ? 'supplier_payment'
          : proposalIsCashFundDeposit ? 'cash_fund'
          : 'subcontractor_advance')
        : payCategory,
      amount: Number(payAmount),
      paymentMethod: payMethod,
      notes: payNotes,
      proposer: currentUser.name,
      proposerId: (currentUser as any)?.id,
      approver: approverName,
      approverId: resolvedApproverId,
      attachmentName: 'bien_nhan_giao_hang.pdf',
      // Lập phiếu từ Đề Xuất (activeProposalForPayment) = phiếu tất toán Đề Xuất đã duyệt → tự động duyệt.
      // Thủ công: admin duyệt luôn, còn lại chờ duyệt.
      status: activeProposalForPayment ? 'approved' : ((currentUser && isUserInRoleGroup(currentUser.id, 'role_admin')) ? 'approved' : 'pending'),
      relatedAdvanceId: activeProposalForPayment?.id,
      source: activeProposalForPayment ? 'auto' : 'manual'
    };
    onAddPayment(newPay);

    // Check if we are finalizing a subcontractor advance proposal
    if (activeProposalForPayment) {
      try {
        const updatedProposal: SubcontractorAdvanceProposal = {
          ...activeProposalForPayment,
          status: 'awaiting_voucher_update',
          paymentId: newPay.id,
          payCreatorId: (currentUser as any)?.id || activeProposalForPayment.payCreatorId,
          payCreatorName: currentUser.name || activeProposalForPayment.payCreatorName
        };
        await dbService.subcontractorAdvances.save(updatedProposal);

        // Update local state list
        setSubcontractorAdvances(prev => prev.map(p => p.id === updatedProposal.id ? updatedProposal : p));

        // Cập nhật Công nợ Trả: CHỈ áp dụng cho đề xuất Tạm ứng Thầu Phụ thật sự
        // (type === 'subcontractor_advance') — đây mới là khoản nợ còn phải trả
        // cho bên thứ ba. "Đề xuất Chi phí Công trình" / "Ứng lương" được thanh
        // toán dứt điểm ngay khi lập phiếu chi nên KHÔNG tạo dòng Công nợ Trả
        // (trước đây tạo nhầm dòng "Thầu Phụ" mang tên người quyết toán/nhân viên).
        // Nếu thầu phụ ĐÃ có dòng (hợp đồng hoặc nợ thủ công) thì phiếu chi tạm ứng
        // sẽ tự động cộng vào dòng đó (khớp theo tên / subcontractorId trong
        // mergedLiabilities). Chỉ tạo dòng MỚI khi thầu phụ chưa có bất kỳ khoản nợ nào.
        const advSubId = activeProposalForPayment.subcontractorId;
        const advName = activeProposalForPayment.subcontractorName || 'Thầu phụ';
        const isRealSubcontractorAdvance = activeProposalForPayment.type === 'subcontractor_advance';
        const hasExistingRow = customLiabilities.some(l =>
          (advSubId && l.subcontractorId && l.subcontractorId === advSubId) ||
          (l.name && l.name === advName) ||
          (l.relatedAdvanceId && l.relatedAdvanceId === activeProposalForPayment.id)
        ) || approvedSubContracts.some(s =>
          (advSubId && s.subcontractorId && s.subcontractorId === advSubId) ||
          (s.subcontractorName && s.subcontractorName === advName)
        );
        if (isRealSubcontractorAdvance && !hasExistingRow) {
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

  // ── Sửa phiếu Thu / Chi thủ công (từ "Lập phiếu thu mới" / "Tạo đề xuất chi mới") ──
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null);
  const [editRecDate, setEditRecDate] = useState('');
  const [editRecAmount, setEditRecAmount] = useState<number>(0);
  const [editRecMethod, setEditRecMethod] = useState<'cash' | 'transfer'>('cash');
  const [editRecNotes, setEditRecNotes] = useState('');

  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editPayDate, setEditPayDate] = useState('');
  const [editPayAmount, setEditPayAmount] = useState<number>(0);
  const [editPayMethod, setEditPayMethod] = useState<'cash' | 'transfer' | 'cash_fund'>('cash');
  const [editPayCategory, setEditPayCategory] = useState<Payment['category']>('supplier_payment');
  const [editPayNotes, setEditPayNotes] = useState('');

  const openEditReceipt = (rec: Receipt) => {
    setEditingReceipt(rec);
    setEditRecDate(rec.date || new Date().toISOString().split('T')[0]);
    setEditRecAmount(rec.amount || 0);
    setEditRecMethod(rec.paymentMethod || 'cash');
    setEditRecNotes(rec.notes || '');
  };

  const handleSaveEditReceipt = () => {
    if (!editingReceipt) return;
    const updated: Receipt = {
      ...editingReceipt,
      date: editRecDate,
      amount: Number(editRecAmount) || 0,
      paymentMethod: editRecMethod,
      notes: editRecNotes,
    };
    onUpdateReceipt?.(updated);
    setEditingReceipt(null);
    addToast({ title: '✅ Đã cập nhật', message: `Đã lưu phiếu thu ${updated.code}.`, type: 'success' });
  };

  const openEditPayment = (pay: Payment) => {
    setEditingPayment(pay);
    setEditPayDate(pay.date || new Date().toISOString().split('T')[0]);
    setEditPayAmount(pay.amount || 0);
    setEditPayMethod(pay.paymentMethod || 'cash');
    setEditPayCategory(pay.category || 'supplier_payment');
    setEditPayNotes(pay.notes || '');
  };

  // Xem trước / in phiếu thu - phiếu chi (mẫu in đẹp, có thông tin doanh nghiệp)
  const [previewVoucher, setPreviewVoucher] = useState<{
    type: 'receipt' | 'payment';
    data: Receipt | Payment;
    meta: {
      payer?: string;
      project?: string;
      collector?: string;
      proposer?: string;
      approver?: string;
      order?: string;
    };
  } | null>(null);

  const handleSaveEditPayment = () => {
    if (!editingPayment) return;
    const updated: Payment = {
      ...editingPayment,
      date: editPayDate,
      amount: Number(editPayAmount) || 0,
      paymentMethod: editPayMethod,
      category: editPayCategory,
      notes: editPayNotes,
    };
    onUpdatePayment?.(updated);
    setEditingPayment(null);
    addToast({ title: '✅ Đã cập nhật', message: `Đã lưu phiếu chi ${updated.code}.`, type: 'success' });
  };

  const handleCreateVoucherFromProposal = (proposal: SubcontractorAdvanceProposal) => {
    // Chặn lập phiếu chi nếu Đề Xuất Chi Phí Công Trình gộp nhiều công trình khác
    // nhau (mỗi dòng expenseItems tự gắn 1 công trình riêng — xem handleQuickProposalSubmit).
    // Payment (phiếu chi) chỉ có 1 trường projectId duy nhất nên không thể "lấy đúng
    // Dự Án" khi đề xuất trải trên nhiều công trình — theo yêu cầu chủ dự án, phải
    // tách thành đề xuất riêng theo từng công trình trước khi lập phiếu.
    if (proposal.type === 'project_expense_proposal') {
      const distinctProjIds = [...new Set((proposal.expenseItems || []).map(i => i.projectId).filter(Boolean))];
      if (distinctProjIds.length > 1) {
        addToast({
          title: '⚠️ Không thể lập phiếu chi',
          message: `Đề xuất ${proposal.id} gồm chi phí của ${distinctProjIds.length} công trình khác nhau. Vui lòng tách thành các đề xuất riêng theo từng công trình (mỗi phiếu chi chỉ gán được 1 Dự án) trước khi lập phiếu.`,
          type: 'error'
        });
        return;
      }
    }

    setActiveProposalForPayment(proposal);
    setPayRecipient(proposal.subcontractorName);
    setPayRecipientId(proposal.subcontractorId || '');

    // Phân loại đề xuất theo đúng trường `type` (KHÔNG chỉ dựa vào tiền tố taskName)
    // để tránh gán nhầm Chi Nhà Cung Cấp / Thanh Toán Công Nợ Thầu Phụ vào nhánh
    // "Tạm ứng Thầu Phụ" như bug trước đây.
    const isSalaryAdvance = proposal.type === 'salary_advance' || !!proposal.taskName?.startsWith('Ứng lương');
    const isProjectExpense = proposal.type === 'project_expense_proposal';
    const isSupplierPayment = proposal.type === 'supplier_payment_proposal';
    const isCashFundDeposit = proposal.type === 'cash_fund_deposit';

    setPayRecipientKind(
      isSalaryAdvance || isProjectExpense || isCashFundDeposit ? 'employee'
        : isSupplierPayment ? 'supplier'
        : 'subcontractor'
    );

    // Dự án gán chi: CHỈ lấy đúng projectId thật của đề xuất — không tự chọn dự án
    // thay thế khi đề xuất không có project. Trước đây fallback về "dự án đầu tiên
    // trong danh sách" (projects[0]) khiến Ứng Lương / Chi Nhà Cung Cấp / Thanh Toán
    // Công Nợ Thầu Phụ (vốn không gắn dự án khi tạo đề xuất) bị gán NHẦM vào 1 dự án
    // cố định, làm sai dữ liệu tổng hợp báo cáo theo dự án khi Nộp đề xuất chi.
    // Dùng 'none' (không phải '') khi để trống: dropdown <select> "Dự án gán chi"
    // KHÔNG có <option value=""> — chỉ có danh sách dự án thật + <option value="none">
    // "Ngoài dự án". Set '' sẽ không khớp option nào, khiến trình duyệt tự hiển thị
    // MẶC ĐỊNH option đầu tiên (1 dự án thật bất kỳ) trông như đã gán nhầm dự án.
    setPayProj(proposal.projectId || 'none');

    if (isSalaryAdvance) {
      setPayCategory('salary_advance');
      setPayNotes(`[${proposal.id}] Ứng lương cho ${proposal.subcontractorName}. ${proposal.reason || 'Trống'}`);
    } else if (isProjectExpense) {
      setPayCategory('site_expense');
      setPayNotes(`[${proposal.id}] Đề xuất chi phí cho công việc: ${proposal.taskName}. Diễn giải: ${proposal.reason || 'Trống'}`);
    } else if (isSupplierPayment) {
      setPayCategory('supplier_payment');
      setPayNotes(`[${proposal.id}] Thanh toán Nhà Cung Cấp: ${proposal.subcontractorName}. Diễn giải: ${proposal.reason || 'Trống'}`);
    } else if (isCashFundDeposit) {
      setPayCategory('cash_fund');
      setPayNotes(`[${proposal.id}] Nạp Quỹ Tiền Mặt. Diễn giải: ${proposal.reason || 'Trống'}`);
    } else {
      // subcontractor_advance: Tạm ứng Thầu Phụ (có dự án, bắt buộc khi tạo đề xuất)
      // hoặc Thanh Toán Công Nợ Thầu Phụ (không gắn dự án) — payProj đã lấy đúng ở trên.
      setPayCategory('subcontractor_advance');
      setPayNotes(`[${proposal.id}] Chi tạm ứng thầu phụ cho công việc: ${proposal.taskName}. Diễn giải: ${proposal.reason || 'Trống'}`);
    }

    // Ưu tiên Số tiền duyệt chi (approvedAmount) do người xét duyệt nhập;
    // nếu chưa có thì dùng Số tiền đề xuất (amount) để tham chiếu lịch sử.
    setPayAmount(proposal.approvedAmount != null ? proposal.approvedAmount : proposal.amount);
    setPayMethod('transfer');

    // Tạm đóng cửa sổ chi tiết đề xuất, sau đó điều hướng sang tab Nhập Chi
    // (modal form lập phiếu chỉ render khi ở tab Nhập Chi) và mở form.
    setViewingProposalDetail(null);
    // Switch to Nhập Chi tab
    setActiveSubTab('nhap_chi');
    // Open the payment form modal
    setShowPayForm(true);
    addToast({ title: 'ℹ️ Thông báo', message: `👉 Form "Tạo đề xuất chi mới" đã được điền tự động dựa trên Đề xuất Tạm ứng ${proposal.id} cho ${proposal.subcontractorName}.`, type: 'info' });
  };

  // Mở modal upload sao kê cho bước "Cập nhật chứng từ"
  const openVoucherUpload = (proposal: SubcontractorAdvanceProposal) => {
    setVoucherUploadProposal(proposal);
    setVoucherUploadPay(null);
    setVoucherUploadImages([]);
  };

  // Mở modal Cập nhật chứng từ trực tiếp cho một phiếu chi (không qua đề xuất)
  const openVoucherUploadForPayment = (pay: Payment) => {
    setVoucherUploadPay(pay);
    setVoucherUploadProposal(null);
    setVoucherUploadImages([]);
  };

  // Xuất PDF phiếu đề xuất (header "Hồ Sơ Thông Tin Doanh Nghiệp" từ Cài đặt hệ thống)
  const exportProposalPdf = async (adv: SubcontractorAdvanceProposal) => {
    const cp: any = companyProfile || {};
    const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const fmt = (v: any) => (v != null && !isNaN(Number(v))) ? `${Number(v).toLocaleString('vi-VN')} đ` : '—';
    const statusLabel: Record<string, string> = {
      pending_approval: 'Chờ Duyệt', pending_payment: 'Chờ Lập Phiếu',
      awaiting_voucher_update: 'Cập Nhật Chứng Từ', completed: 'Hoàn Thành', rejected: 'Từ Chối',
    };
    const expenseRows = (adv.expenseItems && adv.expenseItems.length > 0)
      ? `<table class="items"><thead><tr><th>Mục chi tiêu</th><th>Công trình</th><th class="r">Số tiền</th><th>Ghi chú</th></tr></thead><tbody>
          ${adv.expenseItems.map((it: any) => `<tr><td>${esc(it.item)}</td><td>${esc(it.projectName || '—')}</td><td class="r">${fmt(it.amount)}</td><td>${esc(it.note || '—')}</td></tr>`).join('')}
        </tbody></table>`
      : '';
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>DeXuat_${esc(adv.id)}</title>
      <style>
        @page { size: A4; margin: 12mm; }
        * { box-sizing: border-box; }
        body { font-family: 'Times New Roman', serif; color:#1a1a1a; font-size: 12px; margin:0; padding:0; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        .wrap { padding: 3mm 4mm 2mm; }
        .nat { text-align:center; margin-bottom:8px; }
        .nat .r1 { font-weight:bold; font-size:13px; letter-spacing:0.5px; }
        .nat .r2 { font-size:11px; margin-top:1px; }
        .nat .ul { border-top:1px solid #1a1a1a; width:210px; margin:4px auto 0; }
        .band { display:flex; justify-content:space-between; gap:20px; align-items:center; background:#0f172a; color:#fff; padding:12px 16px; border-radius:8px; }
        .band .co { font-size:16px; font-weight:bold; letter-spacing:0.5px; }
        .band .ci { font-size:10.5px; margin-top:3px; }
        .band .ri { text-align:right; border-left:1px solid rgba(255,255,255,0.35); padding-left:16px; white-space:nowrap; }
        .band .ri .k { font-size:9px; opacity:0.8; }
        .band .ri .v { font-size:14px; font-weight:bold; font-family:monospace; }
        .band .ri .v2 { font-size:12px; font-weight:bold; }
        .doctitle { text-align:center; margin:16px 0 6px; }
        .doctitle h1 { font-size:21px; font-weight:bold; text-transform:uppercase; margin:0; letter-spacing:1px; }
        .doctitle .sub { font-size:11px; color:#555; margin-top:2px; }
        .info { width:100%; border-collapse:collapse; margin-top:10px; font-size:11.5px; }
        .info td { border:1px solid #1a1a1a; padding:6px 8px; vertical-align:top; }
        .info .lbl { font-weight:bold; white-space:nowrap; width:20%; background:#eef2f7; }
        .info .amt { font-family:monospace; font-weight:bold; color:#b42318; }
        .sect { font-weight:bold; text-transform:uppercase; font-size:10.5px; margin:14px 0 5px; color:#0f172a; border-bottom:2px solid #0f172a; padding-bottom:3px; }
        .reason { border:1px solid #1a1a1a; padding:8px 10px; font-style:italic; min-height:42px; }
        .items { width:100%; border-collapse:collapse; margin-top:6px; }
        .items th, .items td { border:1px solid #1a1a1a; padding:5px 7px; font-size:11px; }
        .items th { background:#eef2f7; }
        .items .r { text-align:right; }
        .sign { display:flex; justify-content:space-between; margin-top:42px; text-align:center; font-size:11px; }
        .sign div { width:30%; }
        .sign .t { font-weight:bold; margin-bottom:34px; }
        .sign .ln { border-top:1px solid #1a1a1a; padding-top:4px; }
        .foot { text-align:center; font-size:9px; color:#888; margin-top:18px; }
      </style></head><body>
      <div class="wrap">
        <div class="nat">
          <div class="r1">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
          <div class="r2">Độc lập – Tự do – Hạnh phúc</div>
          <div class="ul"></div>
        </div>
        <div class="band">
          <div>
            <div class="co">${esc(cp.companyName || 'TÊN DOANH NGHIỆP')}</div>
            <div class="ci">MST: ${esc(cp.taxCode || '—')}</div>
            <div class="ci">Địa chỉ: ${esc(cp.address || '—')}</div>
            <div class="ci">ĐT: ${esc(cp.phone || '—')} &nbsp; Email: ${esc(cp.email || '—')}</div>
            <div class="ci">Người đại diện: ${esc(cp.representative || '—')}</div>
          </div>
          <div class="ri">
            <div class="k">MÃ ĐỀ XUẤT</div>
            <div class="v">${esc(adv.id)}</div>
            <div class="k" style="margin-top:8px;">NGÀY LẬP</div>
            <div class="v2">${esc(adv.date || adv.proposalDate || '—')}</div>
          </div>
        </div>
        <div class="doctitle">
          <h1>Phiếu Đề Xuất Chi</h1>
          <div class="sub">${esc(proposalTypeLabel(adv.type))}</div>
        </div>
        <table class="info">
          <tr><td class="lbl">Đối tượng chi</td><td>${esc(adv.subcontractorName || '—')}</td>
              <td class="lbl">Trạng thái</td><td>${esc(statusLabel[adv.status] || adv.status || '—')}</td></tr>
          <tr><td class="lbl">Dự án / Công trình</td><td>${esc(adv.projectName || '—')}</td>
              <td class="lbl">Công việc con</td><td>${esc(adv.taskName || '—')}</td></tr>
          <tr><td class="lbl">Số tiền đề xuất</td><td class="amt">${esc(fmt(adv.amount))}</td>
              <td class="lbl">Số tiền duyệt chi</td><td class="amt">${esc(fmt(adv.approvedAmount))}</td></tr>
          <tr><td class="lbl">Nhân sự lập</td><td>${esc(adv.creatorName || adv.creator || '—')}</td>
              <td class="lbl">Người phê duyệt</td><td>${esc(adv.approverName || adv.approver || '—')}</td></tr>
          ${adv.payCreatorName ? `<tr><td class="lbl">Người lập phiếu</td><td>${esc(adv.payCreatorName)}</td><td class="lbl">Người quyết toán</td><td>${esc(adv.settlerName || '—')}</td></tr>` : ''}
        </table>
        <div class="sect">Nội dung / Diễn giải chi tiết</div>
        <div class="reason">${esc(adv.reason || 'Không có diễn giải.')}</div>
        ${expenseRows ? `<div class="sect">Bảng phân rã chi phí chi tiết</div>${expenseRows}` : ''}
        <div class="sign">
          <div><div class="t">Người lập</div><div class="ln">${esc(adv.creatorName || adv.creator || '')}</div></div>
          <div><div class="t">Người duyệt</div><div class="ln">${esc(adv.approverName || adv.approver || '')}</div></div>
          <div><div class="t">Thủ quỹ / Kế toán</div><div class="ln">&nbsp;</div></div>
        </div>
        <div class="foot">${esc(cp.companyName || '')} — Phiếu Đề Xuất Chi · ${esc(adv.id)}</div>
      </div>
      </body></html>`;
    try {
      const mod = await import('html2pdf.js');
      const html2pdf: any = (mod as any).default || mod;
      await html2pdf().from(html).set({
        filename: `DeXuat_${adv.id}.pdf`,
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      }).save();
      addToast({ title: '✅ Xuất PDF', message: `Đã tải Phiếu Đề Xuất ${adv.id}`, type: 'success' });
    } catch (err) {
      console.error('Lỗi xuất PDF đề xuất:', err);
      addToast({ title: '❌ Lỗi xuất PDF', message: 'Không thể tạo file PDF.', type: 'error' });
    }
  };

  // Đọc file ảnh thành base64 (theo quy ước lưu trữ offline của ứng dụng)
  const readImagesAsDataUrls = (files: FileList | null): Promise<string[]> => {
    return new Promise((resolve) => {
      if (!files || files.length === 0) return resolve([]);
      const out: string[] = [];
      let pending = files.length;
      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') out.push(reader.result);
          if (--pending === 0) resolve(out);
        };
        reader.onerror = () => { if (--pending === 0) resolve(out); };
        reader.readAsDataURL(file);
      });
    });
  };

  // Lưu sao kê vào phiếu chi. Hoạt động 2 mode:
  //  - qua Đề Xuất (voucherUploadProposal): tìm phiếu chi rồi cập nhật cả đề xuất → completed
  //  - trực tiếp phiếu chi (voucherUploadPay): chỉ cập nhật ảnh cho phiếu đó
  const handleSaveVoucherImages = async () => {
    if (!voucherUploadProposal && !voucherUploadPay) return;

    // Xác định phiếu chi đích
    let voucher: Payment | undefined;
    let proposal: SubcontractorAdvanceProposal | null = null;
    if (voucherUploadPay) {
      voucher = voucherUploadPay;
    } else {
      proposal = voucherUploadProposal;
      voucher = payments.find(p => p.id === proposal!.paymentId)
        || payments.find(p => p.relatedAdvanceId === proposal!.id);
    }
    if (!voucher) {
      addToast({ title: '❌ Chưa có phiếu chi', message: 'Đề xuất này chưa có phiếu chi được lập. Vui lòng "Lập phiếu" trước.', type: 'error' });
      return;
    }
    try {
      const merged = [...(voucher.images || []), ...voucherUploadImages];
      const updatedPay: Payment = { ...voucher, images: merged };
      await dbService.payments.save(updatedPay);
      onUpdatePayment?.(updatedPay);

      if (proposal) {
        const updatedProposal: SubcontractorAdvanceProposal = {
          ...proposal,
          status: 'completed'
        };
        await dbService.subcontractorAdvances.save(updatedProposal);
        setSubcontractorAdvances(prev => prev.map(p => p.id === updatedProposal.id ? updatedProposal : p));
        window.dispatchEvent(new CustomEvent('hl-subcontractor-advances-updated', { detail: updatedProposal }));
      }

      addToast({
        title: '✅ Đã cập nhật chứng từ',
        message: proposal
          ? `Đã lưu ${voucherUploadImages.length} sao kê vào ${voucher.code}. Đề xuất ${proposal.id} chuyển sang Hoàn thành.`
          : `Đã lưu ${voucherUploadImages.length} sao kê vào phiếu chi ${voucher.code}.`,
        type: 'success'
      });
      setVoucherUploadProposal(null);
      setVoucherUploadPay(null);
      setVoucherUploadImages([]);
    } catch (err) {
      addToast({ title: '❌ Lỗi', message: `❌ Lưu sao kê thất bại: ${err instanceof Error ? err.message : String(err)}`, type: 'error' });
    }
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
      // Dùng Date.now() thay vì customers.length + 1: mã theo độ dài mảng dễ bị
      // trùng khi 2 người tạo khách gần như đồng thời, hoặc khi khách cũ đã bị
      // xóa làm độ dài mảng tụt xuống rồi tái sử dụng lại đúng số thứ tự cũ.
      targetId = `KH_${abbrev}_${Date.now()}`;
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
    pendingNewCustIdRef.current = targetId;
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
    setPayRecipientId(supplier.id);
    setPayRecipientKind('supplier');
    setPayAmount(moneyDue);
    setPayNotes(`Ủy nhiệm chi trả tiền mua nguyên liệu / thầu thợ cho ${supplier.name}`);
    setActiveSubTab('nhap_chi');
    setShowPayForm(true);
  };

  const handleQuickPayProposalGeneric = (recipientName: string, moneyDue: number) => {
    const sup = suppliers.find(s => s.name === recipientName);
    const emp = !sup ? (employeesProp || []).find((e: any) => e.name === recipientName) : undefined;
    setPayRecipient(recipientName);
    setPayRecipientId(sup?.id || emp?.id || '');
    setPayRecipientKind(sup ? 'supplier' : emp ? 'employee' : '');
    setPayAmount(moneyDue);
    setPayNotes(`Ủy nhiệm chi trả tiền thầu thợ / nhà cung cấp cho ${recipientName}`);
    setActiveSubTab('nhap_chi');
    setShowPayForm(true);
  };

  // Ghi nhận công nợ nhà cung cấp từ 1 đơn hàng mua vào Công Nợ Trả (thủ công).
  // Ghi nhận công nợ nhà cung cấp từ 1 đơn hàng mua vào Công Nợ Trả.
  // Nếu NCC đã có công nợ → tự động merge PO (không mở modal).
  // Nếu NCC chưa có → mở modal để user nhập thông tin.
  // Ghi nhận công nợ nhà cung cấp từ 1 đơn hàng mua vào Công Nợ Trả.
  // ĐẢM BẢO: chỉ đổi trạng thái đơn hàng (→ 'completed') SAU KHI việc ghi nhận
  // đã được lưu thành công lên Supabase (await, kiểm tra lỗi). Nếu lưu thất bại,
  // không đổi trạng thái và báo lỗi.
  // Trả về true nếu đã ghi nhận xong (hoặc đang mở modal để ghi nhận), false nếu lỗi.
  const handleRecordSupplierDebt = async (order: PurchaseOrder): Promise<boolean> => {
    // Đơn nội bộ xuất từ Kho có sẵn cho công trình: không phải mua hàng từ NCC
    // thật → không có công nợ để ghi nhận.
    if ((order as any).fromWarehouse || order.supplierId === WAREHOUSE_SOURCE_ID) {
      addToast({ title: 'ℹ️ Đơn nội bộ', message: 'Đơn xuất từ Kho có sẵn không phát sinh công nợ NCC.', type: 'info' });
      return false;
    }
    if (!order.supplierName) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'Đơn hàng không có tên nhà cung cấp để ghi nhận.', type: 'warning' });
      return false;
    }
    if (isPoRecorded(order.id)) {
      addToast({ title: 'ℹ️ Đã ghi nhận', message: `Đơn ${order.id} đã được ghi nhận vào Công nợ Trả.`, type: 'info' });
      return false;
    }
    const existing = customLiabilities.find(l => l.name === order.supplierName && l.category === 'Nhà Cung Cấp');
    if (existing) {
      // NCC đã có liability → gắn PO id vào recordedPurchaseOrderIds
      const newIds = Array.from(new Set([...(existing.recordedPurchaseOrderIds || []), order.id]));
      const updatedLiab = { ...existing, recordedPurchaseOrderIds: newIds };
      // 1) Lưu công nợ lên Supabase — verify trước
      try {
        await dbService.accountingLiabilities.save(updatedLiab);
      } catch (err) {
        console.error('[DB] Lưu recordedPurchaseOrderIds thất bại:', err);
        addToast({ title: '❌ Lỗi', message: 'Không thể ghi nhận lên server. Vui lòng thử lại.', type: 'error' });
        return false;
      }
      // 2) Chỉ cập nhật local SAU KHI lưu thành công
      setCustomLiabilities(prev => prev.map(l => l.id === existing.id ? updatedLiab : l));
      // 3) Đổi trạng thái đơn SAU KHI công nợ đã lưu xong
      const updatedPo = { ...order, status: 'completed' as const };
      try {
        await dbService.purchaseOrders.save(updatedPo);
        setPurchaseOrders(prev => prev.map(o => o.id === order.id ? updatedPo : o));
      } catch (err) {
        console.error('[DB] Cập nhật trạng thái đơn thất bại:', err);
        addToast({ title: '⚠️ Lưu ý', message: `Đã ghi nhận công nợ nhưng chưa cập nhật được trạng thái đơn ${order.id}.`, type: 'warning' });
        return true;
      }
      addToast({
        title: '✅ Đã ghi nhận',
        message: `Đơn ${order.id} đã được ghi nhận vào Công nợ Trả của ${order.supplierName}.`,
        type: 'success'
      });
      return true;
    }
    // NCC chưa có công nợ nào → tạo mới TRỰC TIẾP (không mở modal thủ công nhập
    // liệu nữa — mọi thông tin cần thiết (tên NCC, số tiền, dự án) đã có sẵn từ
    // đơn hàng và người dùng vừa xác nhận ở hộp thoại trước đó rồi, bắt nhập lại
    // là thừa). Công Nợ Trả hiện chỉ liên kết từ Hợp Đồng Thầu Phụ và Đơn Hàng,
    // không còn đường nhập thủ công nữa.
    const newLiab = {
      id: crypto.randomUUID(),
      name: order.supplierName,
      category: 'Nhà Cung Cấp' as const,
      value: order.congNo || order.tongTien || 0,
      paid: order.thanhToanThucTe || 0,
      date: new Date().toISOString().slice(0, 10),
      notes: `Ghi nhận từ đơn mua ${order.id} - ${order.supplierName}`,
      recordedPurchaseOrderIds: [order.id],
    };
    try {
      await dbService.accountingLiabilities.save(newLiab);
    } catch (err) {
      console.error('[DB] Lưu công nợ mới thất bại:', err);
      addToast({ title: '❌ Lỗi', message: 'Không thể lưu công nợ lên server. Vui lòng thử lại.', type: 'error' });
      return false;
    }
    setCustomLiabilities(prev => [...prev, newLiab]);
    const updatedPo = { ...order, status: 'completed' as const };
    try {
      await dbService.purchaseOrders.save(updatedPo);
      setPurchaseOrders(prev => prev.map(o => o.id === order.id ? updatedPo : o));
    } catch (err) {
      console.error('[DB] Cập nhật trạng thái đơn thất bại:', err);
      addToast({ title: '⚠️ Lưu ý', message: `Đã ghi nhận công nợ nhưng chưa cập nhật được trạng thái đơn ${order.id}.`, type: 'warning' });
      return true;
    }
    addToast({
      title: '✅ Đã ghi nhận',
      message: `Đơn ${order.id} đã được ghi nhận vào Công nợ Trả của ${order.supplierName}.`,
      type: 'success'
    });
    return true;
  };

  // Hoàn tác ghi nhận công nợ của 1 đơn hàng — dùng khi lỡ ghi nhận nhầm (vd
  // nhập sai thông tin đơn hàng). Gỡ đơn khỏi công nợ NCC liên quan và đưa đơn
  // về trạng thái "Chưa ghi nhận" (status 'confirmed') để có thể sửa rồi ghi
  // nhận lại. Ngược lại chính xác với handleRecordSupplierDebt ở trên.
  const handleUndoSupplierDebt = async (order: PurchaseOrder): Promise<boolean> => {
    const liab = customLiabilities.find(l =>
      l.category === 'Nhà Cung Cấp' && Array.isArray(l.recordedPurchaseOrderIds) && l.recordedPurchaseOrderIds.includes(order.id)
    );
    if (liab) {
      const remainingIds = liab.recordedPurchaseOrderIds!.filter((id: string) => id !== order.id);
      // Công nợ được TẠO MỚI THUẦN TUÝ cho đúng 1 đơn hàng này (ghi chú đúng định
      // dạng tự sinh ở nhánh "NCC chưa có" của handleRecordSupplierDebt) và giờ
      // không còn đơn nào gắn vào → xóa hẳn để hoàn tác trọn vẹn, không để lại
      // công nợ 0đ mồ côi. Công nợ có nguồn gốc khác (công nợ đầu kỳ / đang gắn
      // nhiều đơn khác) chỉ gỡ liên kết đơn này, GIỮ NGUYÊN bản ghi.
      const isSoleAutoCreated = remainingIds.length === 0 && liab.notes === `Ghi nhận từ đơn mua ${order.id} - ${order.supplierName}`;
      try {
        if (isSoleAutoCreated) {
          await dbService.accountingLiabilities.delete(liab.id);
        } else {
          await dbService.accountingLiabilities.save({ ...liab, recordedPurchaseOrderIds: remainingIds });
        }
      } catch (err) {
        console.error('[DB] Hoàn tác công nợ thất bại:', err);
        addToast({ title: '❌ Lỗi', message: 'Không thể hoàn tác công nợ. Vui lòng thử lại.', type: 'error' });
        return false;
      }
      if (isSoleAutoCreated) {
        setCustomLiabilities(prev => prev.filter(l => l.id !== liab.id));
      } else {
        setCustomLiabilities(prev => prev.map(l => l.id === liab.id ? { ...l, recordedPurchaseOrderIds: remainingIds } : l));
      }
    }
    const updatedPo = { ...order, status: 'confirmed' as const };
    try {
      await dbService.purchaseOrders.save(updatedPo);
      setPurchaseOrders(prev => prev.map(o => o.id === order.id ? updatedPo : o));
    } catch (err) {
      console.error('[DB] Cập nhật trạng thái đơn thất bại:', err);
      addToast({ title: '⚠️ Lưu ý', message: `Đã gỡ công nợ nhưng chưa cập nhật được trạng thái đơn ${order.id}.`, type: 'warning' });
      return true;
    }
    addToast({
      title: '✅ Đã hoàn tác',
      message: `Đơn ${order.id} đã được đưa về "Chưa ghi nhận" và gỡ khỏi Công nợ Trả của ${order.supplierName}.`,
      type: 'success'
    });
    return true;
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
                    <span>Đề Xuất Chi</span>
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
                  onClick={() => { setActiveSubTab('quy_tien_mat'); setSearchTerm(''); }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left font-bold transition-all ${activeSubTab === 'quy_tien_mat' ? 'bg-slate-800/90 text-white border-l-4 border-orange-500' : 'text-slate-400 hover:text-white hover:bg-slate-850/50'}`}
                >
                  <span className="flex items-center gap-2">
                    <Wallet className="w-3.5 h-3.5 text-teal-400" />
                    <span>Quỹ Tiền Mặt</span>
                  </span>
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
                          <span>Đề Xuất Chi</span>
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
                          onClick={() => { setActiveSubTab('quy_tien_mat'); setSearchTerm(''); }}
                          aria-current={activeSubTab === 'quy_tien_mat' ? 'page' : undefined}
                          className={`group inline-flex items-center justify-center px-4 py-3 border-b border-transparent rounded-t-lg transition-all whitespace-nowrap cursor-pointer text-xs font-bold ${activeSubTab === 'quy_tien_mat' ? 'text-orange-600 border-orange-500' : 'text-slate-600 hover:text-orange-600 hover:border-slate-300'}`}
                        >
                          <Wallet className={`w-4 h-4 me-2 ${activeSubTab === 'quy_tien_mat' ? 'text-orange-600' : 'text-slate-400 group-hover:text-orange-600'}`} />
                          <span>Quỹ Tiền Mặt</span>
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
                  {activeSubTab === 'de_xuat_thu_chi' && '📋 Phê duyệt Đề Xuất Chi Tạm Ứng'}
                  {activeSubTab === 'don_hang' && '🛒 Quản lý Đơn Hàng Mua'}
                  {activeSubTab === 'dashboard' && '📊 Dashboard Thống kê Kế toán Tổng lực'}
                  {activeSubTab === 'khach_hang' && '👥 Danh mục Khách hàng'}
                  {activeSubTab === 'vat_tu' && '📦 Quản Lý kho'}
                  {activeSubTab === 'nhap_thu' && '💚 Quản lý THU'}
                  {activeSubTab === 'nhap_chi' && '🔴 Quản lý CHI'}
                  {activeSubTab === 'quy_tien_mat' && '💵 Quỹ Tiền Mặt'}
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

            {/* TAB: ĐƠN HÀNG MUA — gom theo Nhà cung cấp */}
            {activeSubTab === 'don_hang' && (() => {
              const keyword = (searchTerm || '').trim().toLowerCase();
              const poSupplierOptions = Array.from(new Set(purchaseOrders.map((o: PurchaseOrder) => o.supplierName).filter(Boolean))).sort() as string[];

              // Gom đơn hàng theo Nhà cung cấp + áp dụng bộ lọc
              const matchedPOs = purchaseOrders.filter((o: PurchaseOrder) => {
                // Chỉ hiện đơn đã được xác nhận nhận ít nhất 1 phần hàng — đơn còn
                // chờ giao chưa xuất hiện ở đây, tránh ghi nhận công nợ quá sớm.
                if (!poHasAnyReceived(o)) return false;
                if (keyword && !((o.id || '').toLowerCase().includes(keyword) || (o.supplierName || '').toLowerCase().includes(keyword))) return false;
                const od = (o.createdAt || '').slice(0, 10);
                if (poFilters.fromDate && od && od < poFilters.fromDate) return false;
                if (poFilters.toDate && od && od > poFilters.toDate) return false;
                if (poFilters.supplier && !(o.supplierName || '').toLowerCase().includes(poFilters.supplier.toLowerCase())) return false;
                if (poFilters.project && (o.projectId || '') !== poFilters.project) return false;
                if (poFilters.status && !poOrderStatuses(o).includes(poFilters.status)) return false;
                return true;
              });
              const groupsMap = new Map<string, PurchaseOrder[]>();
              matchedPOs.forEach(o => {
                const key = o.supplierName || '—';
                if (!groupsMap.has(key)) groupsMap.set(key, []);
                groupsMap.get(key)!.push(o);
              });
              const supplierGroups = Array.from(groupsMap.entries()).map(([supplierName, orders]) => {
                const total = orders.reduce((s, o) => s + (o.tongTien || 0), 0);
                const paid = getSupplierPaid(supplierName);
                const remaining = Math.max(0, total - paid);
                const settled = remaining <= 0;
                return { supplierName, orders, total, paid, remaining, settled };
              }).sort((a, b) => b.total - a.total);

              const totalPages = poPageSize === -1 ? 1 : Math.max(1, Math.ceil(supplierGroups.length / poPageSize));
              const pageGroups = poPageSize === -1 ? supplierGroups : supplierGroups.slice((poPage - 1) * poPageSize, poPage * poPageSize);
              // Tổng cộng: tổng Tổng số tiền của mọi đơn hàng khớp bộ lọc (không chỉ trang hiện tại)
              const poGrandTotal = matchedPOs.reduce((s, o) => s + (o.tongTien || 0), 0);
              const poGrandCount = matchedPOs.length;

              const toggleSupplier = (name: string) => {
                setPoExpandedSuppliers(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
              };

              return (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-850 pb-3">
                    <div>
                      <span className="font-bold text-slate-300 uppercase tracking-widest text-[11px] block">
                        Danh sách Đơn Hàng Mua
                      </span>
                    </div>
                  </div>

                  {/* Bộ lọc: Từ ngày – Đến ngày, Nhà Cung Cấp (tìm kiếm nhanh), Trạng thái (lưu localStorage) */}
                  <div className="flex flex-wrap items-end gap-3 p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-400 font-bold text-[9px] uppercase tracking-wide">Từ ngày</label>
                      <input
                        type="date"
                        value={poFilters.fromDate}
                        onChange={(e) => updatePoFilter({ fromDate: e.target.value })}
                        className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-slate-100 outline-none focus:border-violet-500 cursor-pointer"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-400 font-bold text-[9px] uppercase tracking-wide">Đến ngày</label>
                      <input
                        type="date"
                        value={poFilters.toDate}
                        onChange={(e) => updatePoFilter({ toDate: e.target.value })}
                        className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-slate-100 outline-none focus:border-violet-500 cursor-pointer"
                      />
                    </div>
                    <div className="flex flex-col gap-1 relative">
                      <label className="text-slate-400 font-bold text-[9px] uppercase tracking-wide">Nhà Cung Cấp</label>
                      <input
                        type="text"
                        value={poFilters.supplier}
                        onChange={(e) => { updatePoFilter({ supplier: e.target.value }); setPoSupplierOpen(true); }}
                        onFocus={() => setPoSupplierOpen(true)}
                        onBlur={() => setTimeout(() => setPoSupplierOpen(false), 150)}
                        placeholder="Gõ để tìm NCC..."
                        className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-slate-100 outline-none focus:border-violet-500 cursor-pointer w-48"
                      />
                      {poSupplierOpen && (
                        <div className="absolute top-full left-0 z-30 mt-1 w-64 max-h-52 overflow-y-auto bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1">
                          <button type="button" onClick={() => { updatePoFilter({ supplier: '' }); setPoSupplierOpen(false); }} className="w-full text-left px-3 py-1.5 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-white">Tất cả nhà cung cấp</button>
                          {poSupplierOptions.filter(s => s.toLowerCase().includes(poFilters.supplier.toLowerCase())).map(s => (
                            <button key={s} type="button" onClick={() => { updatePoFilter({ supplier: s }); setPoSupplierOpen(false); }} className="w-full text-left px-3 py-1.5 text-[11px] text-slate-200 hover:bg-slate-800">{s}</button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-400 font-bold text-[9px] uppercase tracking-wide">Dự án</label>
                      <select
                        value={poFilters.project}
                        onChange={(e) => updatePoFilter({ project: e.target.value })}
                        className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-slate-100 outline-none focus:border-violet-500 cursor-pointer min-w-[160px]"
                      >
                        <option value="">Tất cả dự án</option>
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-400 font-bold text-[9px] uppercase tracking-wide">Trạng thái</label>
                      <select
                        value={poFilters.status}
                        onChange={(e) => updatePoFilter({ status: e.target.value })}
                        className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-slate-100 outline-none focus:border-violet-500 cursor-pointer"
                      >
                        <option value="">Tất cả</option>
                        <option value="recorded">Đã ghi nhận công nợ</option>
                        <option value="unrecorded">Chưa ghi nhận</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => { const y = new Date().getFullYear(); updatePoFilter({ fromDate: `${y}-01-01`, toDate: `${y}-12-31`, supplier: '', status: '', project: '' }); }}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
                      title="Xóa bộ lọc"
                    >
                      <X className="w-3.5 h-3.5" /> Reset
                    </button>
                  </div>

                  <div className="overflow-x-auto text-[10.5px]">
                    <table className="w-full text-left text-slate-300">
                      <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                        <tr>
                          <th className="px-3 py-2.5 w-10 text-center">#</th>
                          <th className="px-3 py-2.5">Tên nhà cung cấp</th>
                          <th className="px-3 py-2.5">Dự án</th>
                          <th className="px-3 py-2.5 text-right">Tổng số tiền</th>
                          <th className="px-3 py-2.5">Trạng thái</th>
                          <th className="px-3 py-2.5 text-center">Hành động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {supplierGroups.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-3 py-8 text-center text-slate-500 italic">
                              {purchaseOrders.length === 0 ? 'Chưa có đơn hàng nào. Đơn hàng xuất hiện ở đây khi đề xuất vật tư được nhận hàng.' : 'Không tìm thấy đơn hàng phù hợp với bộ lọc.'}
                            </td>
                          </tr>
                        ) : pageGroups.map((g, gi) => {
                          const expanded = poExpandedSuppliers.has(g.supplierName);
                          return (
                            <React.Fragment key={g.supplierName}>
                              <tr className="border-b border-slate-800 bg-slate-800/40 hover:bg-slate-800/70 font-sans">
                                <td className="px-3 py-3 text-center font-mono text-slate-500">{gi + 1}</td>
                                <td className="px-3 py-3">
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => toggleSupplier(g.supplierName)}
                                      className="text-slate-400 hover:text-white text-[10px] w-4 cursor-pointer"
                                      title={expanded ? 'Thu gọn' : 'Xem chi tiết'}
                                    >
                                      {expanded ? '▼' : '▶'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => toggleSupplier(g.supplierName)}
                                      className="font-extrabold text-white text-[13px] text-left hover:underline cursor-pointer"
                                      title="Click để xem chi tiết các đơn hàng"
                                    >
                                      {g.supplierName}
                                    </button>
                                    <span className="text-[9px] text-slate-400">({g.orders.length} đơn)</span>
                                  </div>
                                </td>
                                <td className="px-3 py-3">
                                  {(() => {
                                    const projs = Array.from(new Set((g.orders || []).map((o: any) => o.projectName).filter(Boolean)));
                                    if (projs.length === 0) return <span className="text-slate-600 text-[9px] italic">—</span>;
                                    return <span className="text-[10px] text-sky-400">🏗️ {projs.length} Dự Án</span>;
                                  })()}
                                </td>
                                <td className="px-3 py-3 text-right font-mono font-bold text-fuchsia-400">{(g.total).toLocaleString('vi-VN')} đ</td>
                                <td className="px-3 py-3">
                                  {(() => {
                                    const total = g.orders.length;
                                    const recorded = g.orders.filter(o => isPoRecorded(o.id)).length;
                                    const all = total > 0 && recorded === total;
                                    return (
                                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold border ${all ? 'bg-white text-emerald-700 border-emerald-600' : 'bg-white text-orange-600 border-orange-500'}`}>
                                        Ghi nhận công nợ: {recorded}/{total}
                                      </span>
                                    );
                                  })()}
                                </td>
                                <td className="px-3 py-3">
                                  <div className="flex items-center justify-center">
                                    {g.settled ? (
                                      <span className="text-emerald-500 text-[9px] italic font-bold">Đã khóa</span>
                                    ) : (
                                      <span className="text-slate-600 text-[9px] italic">—</span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                              {expanded && g.orders.map((o: PurchaseOrder) => {
                                const st = getPoRowStatus(o);
                                const recorded = isPoRecorded(o.id);
                                const isFromWarehouse = (o as any).fromWarehouse || o.supplierId === WAREHOUSE_SOURCE_ID;
                                return (
                                  <tr key={o.id} className="border-b border-slate-850/60 bg-slate-900/30 hover:bg-slate-900/60 font-sans">
                                    <td className="px-3 py-2.5 text-center text-slate-600">—</td>
                                    <td className="px-3 py-2.5 pl-9">
                                      <div className="font-semibold text-slate-200 text-[11px]">{o.id}</div>
                                      <div className="text-[9px] text-slate-400 mt-0.5">Ngày: {(o.createdAt || '').slice(0, 10) || '—'}</div>
                                      {(() => {
                                        const items = (o.items || (o as any).vatTuList || []) as any[];
                                        const first5 = items.slice(0, 5);
                                        if (first5.length === 0) return null;
                                        const more = items.length - first5.length;
                                        const full = items.map((i: any) => `${poItemName(i)} × ${poItemQty(i)}`).join(', ');
                                        return (
                                          <div className="text-[9px] text-slate-500 mt-1 leading-snug max-w-[16rem] truncate" title={full}>
                                            VT: {first5.map((i: any, k: number) => `${poItemName(i)} × ${poItemQty(i)}`).join(', ')}{more > 0 ? ` … (+${more})` : ''}
                                          </div>
                                        );
                                      })()}
                                    </td>
                                    <td className="px-3 py-2.5">
                                      {o.projectName ? <span className="text-[10px] text-sky-400">🏗️ {o.projectName}</span> : <span className="text-slate-600 text-[9px] italic">—</span>}
                                    </td>
                                    <td className="px-3 py-2.5 text-right font-mono font-bold text-fuchsia-400 text-[11px]">{(o.tongTien || 0).toLocaleString('vi-VN')} đ</td>
                                    <td className="px-3 py-2.5">
                                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${poStatusToneClass(st.tone)}`}>{st.label}</span>
                                    </td>
                                    <td className="px-3 py-2.5">
                                      <div className="flex items-center justify-center gap-1.5">
                                        <button type="button" onClick={() => setPoDetailModal({ open: true, order: o })} className="text-cyan-400 hover:text-cyan-300 p-1 border border-cyan-500/30 rounded cursor-pointer" title="Xem chi tiết"><Eye className="w-3.5 h-3.5" /></button>
                                        {isFromWarehouse ? (
                                          <span className="text-[9px] font-bold text-teal-600 border border-teal-500 bg-white px-2 py-1 rounded-lg" title="Đơn nội bộ xuất từ Kho có sẵn — không phát sinh công nợ">📦 Nội bộ (Kho)</span>
                                        ) : recorded ? (
                                          <>
                                            <span className="text-[9px] font-bold text-amber-600 border border-amber-500 bg-white px-2 py-1 rounded-lg">Đã ghi nhận</span>
                                            <button type="button" onClick={() => setPoUndoConfirm(o)} className="text-slate-400 hover:text-rose-400 p-1 border border-slate-700 hover:border-rose-500/50 rounded cursor-pointer transition-all" title="Hoàn tác ghi nhận công nợ (dùng khi nhập sai thông tin đơn hàng)">
                                              <RefreshCcw className="w-3.5 h-3.5" />
                                            </button>
                                          </>
                                        ) : (
                                          <button type="button" onClick={() => setPoRecordConfirm(o)} className="bg-white border border-orange-500 text-orange-500 hover:bg-orange-50 p-1.5 rounded-lg flex items-center justify-center cursor-pointer transition-all" title="Ghi nhận công nợ nhà cung cấp">
                                            <Plus className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                        {!recorded && !isFromWarehouse && (
                                          <button type="button" onClick={() => handleDeletePoUnrecorded(o.id)} className="text-rose-400 hover:text-rose-300 p-1 border border-rose-500/30 rounded cursor-pointer" title="Xóa đơn hàng"><Trash2 className="w-3.5 h-3.5" /></button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-700 bg-slate-900/80">
                          <td className="px-3 py-3"></td>
                          <td className="px-3 py-3 text-[11px] font-bold text-slate-300 uppercase tracking-wider">Tổng cộng ({poGrandCount} đơn hàng)</td>
                          <td className="px-3 py-3"></td>
                          <td className="px-3 py-3 text-right font-mono font-black text-violet-400 text-base">{poGrandTotal.toLocaleString('vi-VN')} đ</td>
                          <td className="px-3 py-3"></td>
                          <td className="px-3 py-3"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Phân trang & Tổng cộng */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mt-3 text-[10px] text-slate-400">
                    <div className="flex items-center gap-2">
                      <span>
                        Tổng: <span className="text-violet-400 font-black font-mono">{poGrandCount}</span> đơn ·{' '}
                        <span className="text-violet-400 font-black font-mono">{totalPages}</span> trang
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>Dòng / trang:</span>
                      <select value={poPageSize} onChange={(e) => { setPoPageSize(Number(e.target.value)); setPoPage(1); }} className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 outline-none cursor-pointer">
                        {[5, 10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                        <option value={-1}>Tất cả</option>
                      </select>
                      <button type="button" disabled={poPage <= 1} onClick={() => setPoPage(p => Math.max(1, p - 1))} className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 cursor-pointer">‹ Trước</button>
                      <span>Trang {poPage} / {totalPages}</span>
                      <button type="button" disabled={poPage >= totalPages} onClick={() => setPoPage(p => Math.min(totalPages, p + 1))} className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 cursor-pointer">Sau ›</button>
                    </div>
                  </div>

                </div>
              );
            })()}

            {/* TAB 0: ĐỀ XUẤT THU CHI */}
            {activeSubTab === 'de_xuat_thu_chi' && (() => {
              const filteredAdvances = subcontractorAdvances.filter(a => {
                if (proposalTypeFilter === 'subcontractor') {
                  if (a.type !== 'subcontractor_advance') return false;
                } else if (proposalTypeFilter === 'expense') {
                  if (a.type !== 'project_expense_proposal') return false;
                } else if (proposalTypeFilter === 'salary') {
                  if (a.type !== 'salary_advance') return false;
                } else if (proposalTypeFilter === 'supplier') {
                  if (a.type !== 'supplier_payment_proposal') return false;
                } else if (proposalTypeFilter === 'cash_fund') {
                  if (a.type !== 'cash_fund_deposit') return false;
                }
                if (!searchTerm) return true;
                return (
                  a.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  a.subcontractorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  a.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  a.taskName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  (a.reason && a.reason.toLowerCase().includes(searchTerm.toLowerCase()))
                );
              }).filter(a => {
                const d = a.date || a.proposalDate || '';
                if (proposalFilters.fromDate && d && d < proposalFilters.fromDate) return false;
                if (proposalFilters.toDate && d && d > proposalFilters.toDate) return false;
                if (proposalFilters.projectId && a.projectId !== proposalFilters.projectId) return false;
                if (proposalFilters.status && a.status !== proposalFilters.status) return false;
                return true;
              });

              // Phân trang
              const proposalTotal = filteredAdvances.length;
              const proposalPageCount = proposalPageSize === -1 ? 1 : Math.max(1, Math.ceil(proposalTotal / proposalPageSize));
              const proposalSafePage = Math.min(Math.max(1, proposalPage), proposalPageCount);
              const proposalPaged = proposalPageSize === -1
                ? filteredAdvances
                : filteredAdvances.slice((proposalSafePage - 1) * proposalPageSize, proposalSafePage * proposalPageSize);
              const proposalStartIdx = (proposalSafePage - 1) * proposalPageSize;

              // Quick metric counts
              const totalCount = subcontractorAdvances.length;
              const pendingApprovalCount = subcontractorAdvances.filter(a => a.status === 'pending_approval').length;
              const waitingPaymentCount = subcontractorAdvances.filter(a => a.status === 'pending_payment').length;
              const completedCount = subcontractorAdvances.filter(a => a.status === 'completed').length;
              const rejectedCount = subcontractorAdvances.filter(a => a.status === 'rejected').length;
              // Các tab lọc KHÔNG tính thẻ đề xuất nằm trong thùng rác (đã Từ Chối)
              const activeProposalList = subcontractorAdvances.filter(a => a.status !== 'rejected');
              const countAll = activeProposalList.length;
              const countSub = activeProposalList.filter(a => a.type === 'subcontractor_advance').length;
              const countExp = activeProposalList.filter(a => a.type === 'project_expense_proposal').length;
              const countSup = activeProposalList.filter(a => a.type === 'supplier_payment_proposal').length;
              const countSal = activeProposalList.filter(a => a.type === 'salary_advance').length;
              const countCashFund = activeProposalList.filter(a => a.type === 'cash_fund_deposit').length;

              const getStatusBadge = (status: SubcontractorAdvanceProposal['status']) => {
                switch (status) {
                  case 'pending_approval':
                    return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] px-2.5 py-1 rounded-full font-bold">Chờ Duyệt</span>;
                  case 'pending_payment':
                    return <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[10px] px-2.5 py-1 rounded-full font-bold">Chờ Lập Phiếu</span>;
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
                  {/* ⚡ Trung tâm Lập chi & Đề xuất — thanh công cụ tạo nhanh (mở thẳng form, bỏ qua launcher chọn loại) */}
                  <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/5 border border-amber-500/30 rounded-2xl p-4 space-y-3 shadow-lg">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-400">
                        <Zap className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-extrabold text-white uppercase tracking-wide">Trung tâm Lập chi &amp; Đề xuất</div>
                      </div>
                    </div>

                    {/* Nhóm ĐỀ XUẤT (qua xét duyệt) */}
                    <div className="flex items-center gap-2 flex-wrap">
                    
                      {QUICK_LAUNCH_ITEMS.filter(i => i.group === 'proposal').map(item => {
                        const tone =
                          item.key === 'adv_supplier' ? 'bg-purple-600 hover:bg-purple-500' :
                          item.key === 'adv_site' ? 'bg-emerald-600 hover:bg-emerald-500' :
                          item.key === 'adv_sub' ? 'bg-sky-600 hover:bg-sky-500' :
                          item.key === 'adv_cash_fund' ? 'bg-teal-600 hover:bg-teal-500' :
                          'bg-pink-600 hover:bg-pink-500';
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => openProposalForm(item.key)}
                            className={`${tone} text-white text-[11px] font-extrabold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow transition-all cursor-pointer`}
                            title={item.desc}
                          >
                            <span>{item.emoji}</span>
                            {item.label}
                          </button>
                        );
                      })}
                    </div>

                  </div>

                  {/* Main List */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                    <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <h3 className="font-extrabold text-white text-xs uppercase tracking-wider">
                          {proposalTypeFilter === 'all' && "Danh sách Đề Xuất Chi & Tạm ứng"}
                          {proposalTypeFilter === 'subcontractor' && "Danh sách Đề xuất Chi Thầu Phụ"}
                          {proposalTypeFilter === 'expense' && "Danh sách Đề xuất Chi phí Công trình"}
                          {proposalTypeFilter === 'supplier' && "Danh sách Đề xuất Chi Nhà Cung Cấp"}
                          {proposalTypeFilter === 'salary' && "Danh sách Đề xuất Ứng Lương Nhân sự"}
                          {proposalTypeFilter === 'cash_fund' && "Danh sách Đề xuất Quỹ Tiền Mặt (Nạp Quỹ)"}
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">Xử lý phê duyệt tạm ứng thầu phụ, chi phí phát sinh công trình và kết nối sổ quỹ kế toán chi tiền.</p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 bg-slate-900/50 p-1 rounded-xl border border-slate-800">
                          {/* Thùng rác: Đề Xuất bị Từ Chối (tự xóa sau 30 ngày + khôi phục) */}
                          <button
                            type="button"
                            onClick={() => setTrashOpen(true)}
                            className="relative bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-extrabold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow transition-all cursor-pointer"
                            title="Thùng rác: Đề Xuất bị Từ Chối (tự động xóa sau 30 ngày)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Thùng rác</span>
                            {rejectedProposals.length > 0 && (
                              <span className="ml-0.5 bg-white text-rose-600 text-[9px] font-black px-1.5 rounded-full leading-none">{rejectedProposals.length}</span>
                            )}
                          </button>
                        </div>

                        {/* Filter tabs */}
                        <div className="flex flex-wrap bg-slate-900 p-1 rounded-xl border border-slate-800">
                        <button
                          type="button"
                          onClick={() => setProposalTypeFilter('all')}
                          className={`text-[10px] font-extrabold px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                            proposalTypeFilter === 'all'
                              ? 'bg-amber-500/10 text-amber-400 font-black'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Tất cả ({countAll})
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
                          Chi Thầu Phụ ({countSub})
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
                          Chi phí Công trình ({countExp})
                        </button>
                        <button
                          type="button"
                          onClick={() => setProposalTypeFilter('supplier')}
                          className={`text-[10px] font-extrabold px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                            proposalTypeFilter === 'supplier'
                              ? 'bg-purple-500/10 text-purple-400 font-black'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Chi Nhà Cung Cấp ({countSup})
                        </button>
                        <button
                          type="button"
                          onClick={() => setProposalTypeFilter('salary')}
                          className={`text-[10px] font-extrabold px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                            proposalTypeFilter === 'salary'
                              ? 'bg-pink-500/10 text-pink-400 font-black'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Ứng lương ({countSal})
                        </button>
                        <button
                          type="button"
                          onClick={() => setProposalTypeFilter('cash_fund')}
                          className={`text-[10px] font-extrabold px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                            proposalTypeFilter === 'cash_fund'
                              ? 'bg-teal-500/10 text-teal-400 font-black'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Nạp Quỹ ({countCashFund})
                        </button>
                        </div>
                      </div>
                    </div>

                    {/* Bộ lọc: Từ ngày – Đến ngày, Dự án, Trạng thái (lưu localStorage) */}
                    <div className="p-3 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-end gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-slate-400 font-bold text-[9px] uppercase tracking-wide">Từ ngày</label>
                        <input
                          type="date"
                          value={proposalFilters.fromDate}
                          onChange={(e) => updateProposalFilter({ fromDate: e.target.value })}
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-slate-100 outline-none focus:border-orange-500 cursor-pointer"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-slate-400 font-bold text-[9px] uppercase tracking-wide">Đến ngày</label>
                        <input
                          type="date"
                          value={proposalFilters.toDate}
                          onChange={(e) => updateProposalFilter({ toDate: e.target.value })}
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-slate-100 outline-none focus:border-orange-500 cursor-pointer"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-slate-400 font-bold text-[9px] uppercase tracking-wide">Dự án</label>
                        <select
                          value={proposalFilters.projectId}
                          onChange={(e) => updateProposalFilter({ projectId: e.target.value })}
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-slate-100 outline-none focus:border-orange-500 cursor-pointer min-w-[160px]"
                        >
                          <option value="">Tất cả dự án</option>
                          {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-slate-400 font-bold text-[9px] uppercase tracking-wide">Trạng thái</label>
                        <select
                          value={proposalFilters.status}
                          onChange={(e) => updateProposalFilter({ status: e.target.value })}
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-slate-100 outline-none focus:border-orange-500 cursor-pointer min-w-[150px]"
                        >
                          <option value="">Tất cả trạng thái</option>
                          <option value="pending_approval">Chờ Duyệt</option>
                          <option value="pending_payment">Chờ Lập Phiếu</option>
                          <option value="awaiting_voucher_update">Cập Nhật Chứng Từ</option>
                          <option value="rejected">Từ Chối</option>
                          <option value="completed">Hoàn Thành</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const y = new Date().getFullYear();
                          updateProposalFilter({ fromDate: `${y}-01-01`, toDate: `${y}-12-31`, projectId: '', status: '' });
                        }}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
                        title="Xóa bộ lọc"
                      >
                        <X className="w-3.5 h-3.5" /> Reset
                      </button>
                      <div className="ml-auto flex items-center gap-3 self-center">
                        {(() => {
                          const selRej = subcontractorAdvances.filter(p => finSelectedRows.has(p.id) && p.status === 'rejected').length;
                          return (
                            <>
                              {selRej > 0 && (
                                <button
                                  type="button"
                                  onClick={handleBulkDeleteProposals}
                                  className="bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-extrabold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all shadow"
                                  title="Xóa các đề xuất được chọn (chỉ Từ Chối)"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Xóa {selRej} đã chọn
                                </button>
                              )}
                              <div className="text-[10px] text-slate-400 font-semibold">
                                Kết quả: <span className="text-orange-400 font-black font-mono">{proposalTotal}</span> đề xuất
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    {/* KANBAN BOARD: Đề Xuất Chi */}
                    <div className="p-1">
                      {(() => {
                        // Trạng thái hiệu lực: nếu đề xuất đang "Chờ Lập Phiếu" nhưng đã có phiếu chi
                        // (relatedAdvanceId) được lập thành công → coi như đang ở bước "Cập Nhật Chứng Từ".
                        const effectiveStatus = (a: SubcontractorAdvanceProposal): SubcontractorAdvanceProposal['status'] =>
                          (a.status === 'pending_payment' && payments.some(p => p.relatedAdvanceId === a.id))
                            ? 'awaiting_voucher_update'
                            : a.status;

                        const columns: { key: SubcontractorAdvanceProposal['status']; title: string; accent: string; bar: string }[] = [
                          { key: 'pending_approval', title: 'Đề Xuất Chờ Duyệt', accent: 'border-amber-500/40', bar: 'bg-amber-500' },
                          { key: 'pending_payment', title: 'Chờ Lập Phiếu', accent: 'border-orange-500/40', bar: 'bg-orange-500' },
                          { key: 'awaiting_voucher_update', title: 'Cập Nhật Chứng Từ', accent: 'border-violet-500/40', bar: 'bg-violet-500' },
                          { key: 'completed', title: 'Hoàn Thành', accent: 'border-emerald-500/40', bar: 'bg-emerald-500' },
                        ];

                        // Màu badge mã theo trạng thái (nền trắng → chữ đậm, đồng bộ Điều phối vật tư)
                        const statusCardClass = (st: SubcontractorAdvanceProposal['status']): string => {
                          switch (st) {
                            case 'pending_approval': return 'text-amber-700 bg-amber-100 border-amber-300';
                            case 'pending_payment': return 'text-sky-700 bg-sky-100 border-sky-300';
                            case 'awaiting_voucher_update': return 'text-violet-700 bg-violet-100 border-violet-300';
                            case 'completed': return 'text-emerald-700 bg-emerald-100 border-emerald-300';
                            case 'rejected': return 'text-rose-700 bg-rose-100 border-rose-300';
                            default: return 'text-slate-700 bg-slate-100 border-slate-300';
                          }
                        };

                        const proposalCard = (adv: SubcontractorAdvanceProposal) => {
                          const eff = effectiveStatus(adv);
                          const voucher = payments.find(p => p.id === adv.paymentId)
                            || payments.find(p => p.relatedAdvanceId === adv.id);
                          const isExpense = adv.type === 'project_expense_proposal';
                          return (
                            <div key={adv.id} onClick={() => setViewingProposalDetail(adv)} className="bg-white border border-slate-200 rounded-xl p-2.5 space-y-1.5 relative group hover:border-amber-400/60 hover:bg-amber-50/40 transition-all duration-200 cursor-pointer">
                              {/* Hàng 1: Loại Đề Xuất (màu theo type) + Số tiền */}
                              <div className="flex items-center justify-between gap-2 text-[9px]">
                                <span className={`font-extrabold px-1.5 py-0.5 rounded border truncate max-w-[150px] ${PROPOSAL_TYPE_BADGE[adv.type || ''] || 'bg-white text-slate-600 border-slate-400'}`} title={`${adv.id} · ${proposalTypeLabel(adv.type)}`}>
                                  {proposalTypeLabel(adv.type)}
                                </span>
                                <span className="font-mono font-black text-orange-600 text-[10px] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded whitespace-nowrap">
                                  {adv.amount.toLocaleString('vi-VN')} đ
                                </span>
                              </div>

                              {/* Tiêu đề + meta */}
                              <div>
                                <h4 className={`font-extrabold text-[12px] leading-snug transition-colors ${
                                  adv.type === 'supplier_payment_proposal' ? 'text-purple-700 group-hover:text-purple-800'
                                  : adv.type === 'salary_advance' ? 'text-pink-700 group-hover:text-pink-800'
                                  : adv.type === 'cash_fund_deposit' ? 'text-teal-700 group-hover:text-teal-800'
                                  : isExpense ? 'text-emerald-700 group-hover:text-emerald-800'
                                  : 'text-sky-700 group-hover:text-sky-800'
                                }`}>
                                  {adv.subcontractorName}
                                </h4>
                                <p className="text-[8.5px] text-slate-500 mt-0.5 truncate">
                                  {adv.type === 'supplier_payment_proposal' ? 'Chi Nhà Cung Cấp' : adv.type === 'salary_advance' ? 'Ứng Lương' : adv.type === 'cash_fund_deposit' ? 'Nạp Quỹ Tiền Mặt' : isExpense ? 'Đề Xuất Chi' : 'Chi Thầu Phụ'} · {adv.creatorName || '—'}
                                </p>
                              </div>

                              {/* Dự án · Công việc */}
                              <div className="text-[10px] text-slate-600">
                                <span className="text-slate-700 font-semibold">{adv.projectName}</span>
                                {adv.taskName ? <span className="text-slate-500"> · {adv.taskName}</span> : null}
                              </div>

                              {/* Sao kê đã upload lên phiếu chi */}
                              {voucher && voucher.images && voucher.images.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {voucher.images.slice(0, 4).map((img, idx) => (
                                    <img key={idx} src={img} alt="sao ke" className="w-8 h-8 rounded object-cover border border-slate-300" />
                                  ))}
                                  {voucher.images.length > 4 ? <span className="text-[9px] text-slate-500 self-center">+{voucher.images.length - 4}</span> : null}
                                </div>
                              ) : null}

                              {/* Chân: ngày + số sao kê */}
                              <div className="flex items-center justify-between text-[9px] text-slate-500 pt-0.5">
                                <span className="font-mono text-slate-500">{adv.date || adv.proposalDate || ''}</span>
                                {voucher && voucher.images && voucher.images.length > 0 ? (
                                  <span className="text-violet-600 font-semibold">📎 {voucher.images.length} sao kê</span>
                                ) : null}
                              </div>

                              {/* Gợi ý: nhấn vào thẻ để mở cửa sổ chi tiết & thao tác */}
                              <div className="flex items-center justify-end pt-1.5 border-t border-slate-200">
                                <span className="text-[8.5px] text-slate-400 font-medium group-hover:text-amber-600 transition-colors flex items-center gap-0.5">
                                  <Eye className="w-3 h-3" /> Nhấn để xem chi tiết
                                </span>
                              </div>
                            </div>
                          );
                        };

                        // Thanh phân trang từng cột (giống Điều phối vật tư)
                        const ProposalPaginationBar = ({ page, totalPages, pageSize, onPage, onPageSize, total }: {
                          page: number; totalPages: number; pageSize: number;
                          onPage: (p: number) => void; onPageSize: (s: number) => void; total: number;
                        }) => (
                          <div className="flex items-center justify-between gap-1 px-2.5 py-2 border-t border-slate-700/70 bg-slate-900/70 shrink-0">
                            <div className="flex items-center gap-1">
                              <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wide">Dòng/trang</span>
                              <select
                                value={pageSize}
                                onChange={(e) => onPageSize(Number(e.target.value))}
                                className="bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-[9px] font-bold text-slate-200 outline-none cursor-pointer"
                              >
                                {PROPOSAL_COL_PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={page <= 1}
                                onClick={() => onPage(page - 1)}
                                className="p-1 rounded border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                              >
                                <ChevronLeft className="w-3 h-3" />
                              </button>
                              <span className="text-[9.5px] font-mono font-bold text-slate-300 whitespace-nowrap">
                                {total > 0 ? `Trang ${page}/${totalPages}` : '0 dòng'}
                              </span>
                              <button
                                type="button"
                                disabled={page >= totalPages}
                                onClick={() => onPage(page + 1)}
                                className="p-1 rounded border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                              >
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );

                        return (
                          <div className="w-full">
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                              {columns.map(col => {
                                const colItems = filteredAdvances.filter(a => effectiveStatus(a) === col.key);
                                const colSize = getProposalColPageSize(col.key);
                                const colTotal = proposalColTotalPages(col.key, colItems.length);
                                const colPageClamped = Math.min(getProposalColPage(col.key), colTotal);
                                const paged = colItems.slice((colPageClamped - 1) * colSize, colPageClamped * colSize);
                                const colTotalAmount = colItems.reduce((s, a) => s + (a.amount || 0), 0);
                                return (
                                  <div key={col.key} className={`flex flex-col h-[60vh] sm:h-[680px] rounded-2xl bg-slate-900/50 border ${col.accent} overflow-hidden shadow-xl transition-all duration-300`}>
                                    <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
                                      <div className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${col.bar}`}></span>
                                        <span className="text-[11px] font-extrabold text-white uppercase tracking-wide">{col.title}</span>
                                      </div>
                                      <span className="text-[10px] font-black text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full font-mono">{colItems.length}</span>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                                      {colItems.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-center text-slate-600">
                                          <span className="text-[10px] font-bold uppercase tracking-wide">Trống</span>
                                          <span className="text-[9px] text-slate-500 mt-1">Không có đề xuất ở trạng thái này</span>
                                        </div>
                                      ) : paged.map(adv => proposalCard(adv))}
                                    </div>
                                    <ProposalPaginationBar
                                      page={colPageClamped}
                                      totalPages={colTotal}
                                      pageSize={colSize}
                                      total={colItems.length}
                                      onPage={(p) => setProposalColPageSafe(col.key, p)}
                                      onPageSize={(s) => { setProposalColPageSize(prev => ({ ...prev, [col.key]: s })); setProposalColPageSafe(col.key, 1); }}
                                    />
                                    <div className="px-3 py-2 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between shrink-0">
                                      <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Tổng đề xuất</span>
                                      <span className="text-[11px] font-black text-orange-400 font-mono">{colTotalAmount.toLocaleString('vi-VN')} đ</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
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
                  className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-5 space-y-3 text-[10.5px] shadow-2xl max-h-[92vh] overflow-y-auto"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-1">
                    <h3 className="font-extrabold text-sm uppercase tracking-wide text-amber-400 flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Trung tâm Lập chi &amp; Đề xuất
                    </h3>
                    <button type="button" onClick={() => setShowQuickProposalModal(false)} className="text-slate-400 hover:text-white cursor-pointer bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Form Đề xuất — luôn hiển thị (đã bỏ giao diện chọn loại / launcher) */}
                  <div className="space-y-3">
                      <div className="text-[12px] font-extrabold text-white flex items-center gap-1.5">
                        <span>{quickLaunchItem?.emoji}</span> {quickLaunchItem?.label}
                        <span className="text-[9px] font-bold text-amber-400/90">(Đề xuất → Phiếu chi: {proposalTargetCatLabel({ type: quickProposalType, taskName: quickLaunchItem?.key === 'adv_salary' ? 'Ứng lương' : '' })})</span>
                      </div>

                      {/* Toggle 2 hình thức cho "Chi Thầu Phụ" (Tạm ứng / Thanh toán công nợ) */}
                      {quickProposalType === 'subcontractor_advance' && (
                        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2">
                          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Hình thức</div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => { setQuickProposalSubMode('advance'); setQuickProposalProjId(projects[0]?.id || ''); setQuickProposalSubId(''); }}
                              className={`text-[11px] font-extrabold px-3 py-2 rounded-lg border transition-all cursor-pointer ${quickProposalSubMode === 'advance' ? 'bg-sky-600 text-white border-sky-500' : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-sky-500/50'}`}
                            >
                              💰 Tạm ứng Thầu Phụ
                            </button>
                            <button
                              type="button"
                              onClick={() => { setQuickProposalSubMode('debt'); setQuickProposalProjId(''); setQuickProposalSubId(''); }}
                              className={`text-[11px] font-extrabold px-3 py-2 rounded-lg border transition-all cursor-pointer ${quickProposalSubMode === 'debt' ? 'bg-orange-600 text-white border-orange-500' : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-orange-500/50'}`}
                            >
                              🧾 Thanh Toán Công Nợ
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Chọn dự án / công trình — ẩn với Ứng Lương, Chi Nhà Cung Cấp, Nạp Quỹ Tiền Mặt */}
                      {quickProposalType === 'salary_advance' || quickProposalType === 'supplier_payment_proposal' || quickProposalType === 'cash_fund_deposit' ? null : (
                        quickProposalType === 'subcontractor_advance' && quickProposalSubMode === 'debt' ? (
                          <div>
                            <label className="block text-slate-400 font-semibold mb-1">Dự án / Công trình:</label>
                            <input
                              type="text"
                              value="Thanh Toán Công Nợ"
                              disabled
                              className="w-full bg-slate-950/60 border border-slate-800 rounded p-1 text-slate-400 font-bold cursor-not-allowed"
                            />
                            <div className="text-[9px] text-orange-300/80 flex items-center gap-1 mt-1">
                              <CheckCircle2 className="w-3 h-3" /> Hình thức thanh toán công nợ thầu phụ — không gắn dự án cụ thể.
                            </div>
                          </div>
                        ) : (
                          <div>
                            <label className="block text-slate-400 font-semibold mb-1">
                              Dự án / Công trình {quickProposalType === 'subcontractor_advance' ? <span className="text-rose-500">*</span> : null}:
                            </label>
                            <SearchableSelect
                              options={
                                (quickProposalType === 'subcontractor_advance' && quickProposalSubMode === 'advance')
                                  // Tạm ứng Thầu Phụ: CHỈ cho chọn dự án đã có ít nhất 1 Hợp Đồng
                                  // Thầu Phụ liên kết — dự án chưa ký hợp đồng thầu phụ nào thì
                                  // chưa có đối tượng để chi, không cho chọn nhầm.
                                  ? projects
                                      .filter(p => allSubcontractorQuotes.some(q => q.projectId === p.id))
                                      .map(p => ({ id: p.id, label: p.name }))
                                  : projects.map(p => ({ id: p.id, label: p.name }))
                              }
                              value={quickProposalProjId}
                              onChange={(id) => {
                                setQuickProposalProjId(id);
                                setQuickProposalSubId(''); // reset thầu phụ khi đổi dự án
                              }}
                              placeholder="— Chọn dự án / công trình —"
                              searchPlaceholder="🔍 Gõ tên dự án..."
                              required={quickProposalType === 'subcontractor_advance'}
                            />
                            {quickProposalType === 'subcontractor_advance' && quickProposalSubMode === 'advance' && (
                              <div className="text-[9px] text-sky-300/80 flex items-center gap-1 mt-1">
                                <CheckCircle2 className="w-3 h-3" /> Bắt buộc chọn dự án — thầu phụ được tự động lọc theo danh sách đã liên kết trong dự án này.
                              </div>
                            )}
                            {quickProposalType === 'project_expense_proposal' && (
                              <div className="text-[9px] text-slate-500 flex items-center gap-1 mt-1">
                                <CheckCircle2 className="w-3 h-3" /> Không bắt buộc — chỉ dùng để điền sẵn công trình khi bấm "+ Thêm dòng chi mới" bên dưới. Mỗi dòng chi tiêu chọn công trình riêng.
                              </div>
                            )}
                          </div>
                        )
                      )}

                      {/* Chọn thầu phụ / nhà cung cấp (nhóm supplier) — ẩn với Đề Xuất Chi Phí */}
                      {quickProposalRecipientKind === 'supplier' && quickProposalType !== 'project_expense_proposal' && (() => {
                        // Thầu Phụ (bảng accounting_subcontractors) là danh mục RIÊNG, khác với
                        // Nhà Cung Cấp (bảng suppliers) — ID của 2 bảng không trùng nhau (thầu
                        // phụ import có id dạng "TP_IMP_..."). Chọn đúng danh mục theo loại đề
                        // xuất, nếu không thì tìm nhầm bảng sẽ luôn ra "không tìm thấy".
                        const subDataSource = quickProposalType === 'subcontractor_advance' ? allSubcontractors : suppliers;
                        const selSub = subDataSource.find((s: any) => s.id === quickProposalSubId);
                        const subLiab = selSub ? mergedLiabilities.find(l => l.name === selSub.name) : undefined;
                        // Tạm ứng Thầu Phụ: lấy thầu phụ theo Hợp Đồng Thầu Phụ đã ký với DỰ ÁN
                        // đang chọn (không lọc theo trạng thái duyệt — hợp đồng "Đã Lập" (chờ
                        // duyệt) hay "Hoàn thành" (đã duyệt) đều cho chọn, để không chặn nhầm
                        // thầu phụ vừa ký hợp đồng nhưng chưa kịp duyệt). Mỗi thầu phụ giữ lại
                        // hợp đồng MỚI NHẤT của mình trong dự án để hiển thị trạng thái kèm theo.
                        const subContractByProject = (quickProposalType === 'subcontractor_advance' && quickProposalSubMode === 'advance')
                          ? allSubcontractorQuotes.filter(q => q.projectId === quickProposalProjId && q.subcontractorId)
                          : [];
                        const subList = (quickProposalType === 'subcontractor_advance' && quickProposalSubMode === 'advance')
                          ? [...new Map(
                              subContractByProject.map(q => [q.subcontractorId, {
                                ...(subDataSource.find((s: any) => s.id === q.subcontractorId) || {}),
                                id: q.subcontractorId,
                                contractStatusLabel: (q.isApproved || (q.status || '').trim().toLowerCase() === 'hoàn thành') ? 'Duyệt' : 'Chờ duyệt',
                              }] as [string, any])
                            ).values()].filter((s: any) => !!s.name)
                          : subDataSource;
                        return (
                          <div className="space-y-2">
                            <div>
                              <label className="block text-slate-400 font-semibold mb-1">
                                {quickProposalType === 'supplier_payment_proposal' ? 'Nhà cung cấp' : 'Thầu phụ / Nhà thầu'} <span className="text-rose-500">*</span>:
                              </label>
                              {quickProposalType === 'supplier_payment_proposal' ? (
                                <SearchableSelect
                                  options={suppliers.map((s: any) => ({ id: s.id, label: `${s.name} (${s.field || 'NCC'})` }))}
                                  value={quickProposalSubId}
                                  onChange={(id) => setQuickProposalSubId(id)}
                                  placeholder="— Chọn nhà cung cấp —"
                                  searchPlaceholder="🔍 Gõ tên / lĩnh vực NCC..."
                                  required
                                />
                              ) : (
                                <select
                                  value={quickProposalSubId}
                                  onChange={(e) => setQuickProposalSubId(e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white cursor-pointer font-bold"
                                >
                                  <option value="">— Chọn thầu phụ —</option>
                                  {subList.map((s: any) => (
                                    <option key={s.id} value={s.id}>
                                      {s.name} ({s.field || 'Thầu phụ'}){s.contractStatusLabel ? ` · HĐ: ${s.contractStatusLabel}` : ''}
                                    </option>
                                  ))}
                                </select>
                              )}
                              {quickProposalType === 'subcontractor_advance' && quickProposalSubMode === 'advance' && quickProposalProjId && subList.length === 0 && (
                                <div className="text-[9px] text-amber-400/90 flex items-center gap-1 mt-1">
                                  <CheckCircle2 className="w-3 h-3" /> Dự án này chưa có Hợp Đồng Thầu Phụ nào — vào "Hồ Sơ Thầu Phụ" để lập hợp đồng trước.
                                </div>
                              )}
                              {quickProposalType === 'supplier_payment_proposal' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowQuickProposalModal(false);
                                    setActiveSubTab('du_lieu_ke_toan');
                                    setDuLieuTab('nha_cung_cap_vat_tu');
                                    setAddSupplierSignal((n) => n + 1);
                                  }}
                                  className="text-[10px] text-sky-400 hover:text-sky-300 underline cursor-pointer mt-1"
                                >
                                  + Thêm Nhà Cung Cấp nhanh
                                </button>
                              )}
                            </div>

                            {/* Thông tin công nợ / hợp đồng của đối tượng được chọn */}
                            {quickProposalType === 'subcontractor_advance' && quickProposalSubMode === 'advance' && selSub && subLiab && (
                              <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl p-2.5 text-[10px]">
                                <div className="text-sky-300 font-bold uppercase tracking-wide mb-0.5">Giá trị Hợp Đồng thầu phụ</div>
                                <div className="text-white font-mono font-black text-sm">{(subLiab.tongGiaTri ?? 0).toLocaleString('vi-VN')} đ</div>
                                <div className="text-slate-400 mt-0.5">Còn lại công nợ: <b className="text-sky-200">{(subLiab.remaining ?? 0).toLocaleString('vi-VN')} đ</b></div>
                              </div>
                            )}
                            {quickProposalType === 'subcontractor_advance' && quickProposalSubMode === 'debt' && selSub && subLiab && (
                              <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-2.5 text-[10px]">
                                <div className="text-orange-300 font-bold uppercase tracking-wide mb-0.5">Còn lại Công Nợ Thầu Phụ (Công nợ Trả)</div>
                                <div className="text-white font-mono font-black text-sm">{(subLiab.remaining ?? 0).toLocaleString('vi-VN')} đ</div>
                                <div className="text-slate-400 mt-0.5">Tổng giá trị hợp đồng: <b className="text-orange-200">{(subLiab.tongGiaTri ?? 0).toLocaleString('vi-VN')} đ</b></div>
                              </div>
                            )}
                            {quickProposalType === 'supplier_payment_proposal' && selSub && subLiab && (
                              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 text-[10px]">
                                <div className="text-amber-400 font-bold uppercase tracking-wide mb-0.5">Tổng giá trị Công Nợ hiện tại (NCC)</div>
                                <div className="text-white font-mono font-black text-sm">{(subLiab.tongGiaTri ?? 0).toLocaleString('vi-VN')} đ</div>
                                <div className="text-slate-400 mt-0.5">Còn lại phải trả: <b className="text-amber-400">{(subLiab.remaining ?? 0).toLocaleString('vi-VN')} đ</b></div>
                              </div>
                            )}
                            {selSub && !subLiab && (
                              <div className="text-[9px] text-slate-500 italic">Chưa có thông tin công nợ của đối tượng này trong Công nợ Trả.</div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Chọn nhân viên: chỉ dùng cho Ứng Lương (project_expense_proposal / cash_fund_deposit
                          có đối tượng chi cố định = người lập đề xuất, xem info box bên dưới) */}
                      {quickProposalRecipientKind === 'employee' && quickProposalType !== 'project_expense_proposal' && quickProposalType !== 'cash_fund_deposit' && (
                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">Nhân viên <span className="text-rose-500">*</span>:</label>
                          <select
                            value={quickProposalSubId}
                            onChange={(e) => setQuickProposalSubId(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white cursor-pointer font-bold"
                          >
                            <option value="">— Chọn nhân viên —</option>
                            {employees.map(emp => (
                              <option key={emp.id} value={emp.id}>{emp.name} ({emp.position || emp.department || 'NV'})</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Đối tượng = Công trình (không cần chọn thêm) */}
                      {quickProposalRecipientKind === 'project' && (
                        <div className="text-[10px] text-slate-400 bg-slate-900/60 border border-slate-800 rounded p-2">
                          Đối tượng nhận: <b className="text-slate-200">Công trình / Dự án</b> (lấy từ dự án đã chọn ở trên).
                        </div>
                      )}

                      {/* Chi phí Công trình: đối tượng chi LUÔN là người đang lập đề xuất này —
                          không cho chọn tay, để "Nhập Chi"/"Công Nợ Trả" nhóm đúng theo người
                          chịu trách nhiệm. Công trình cụ thể xem ở cột "Công trình" từng dòng bên dưới. */}
                      {quickProposalType === 'project_expense_proposal' && (
                        <div className="text-[10px] text-slate-400 bg-slate-900/60 border border-slate-800 rounded p-2">
                          Đối tượng nhận: <b className="text-slate-200">{(currentUser as any)?.name || 'Bạn'}</b> (người lập đề xuất này).
                        </div>
                      )}

                      {/* Nạp Quỹ Tiền Mặt: cũng không cho chọn tay đối tượng nhận — người chịu
                          trách nhiệm nạp quỹ luôn là người lập đề xuất, không gắn dự án. */}
                      {quickProposalType === 'cash_fund_deposit' && (
                        <div className="text-[10px] text-slate-400 bg-slate-900/60 border border-slate-800 rounded p-2">
                          Đối tượng: <b className="text-slate-200">Quỹ Tiền Mặt công ty</b> · Người chịu trách nhiệm nạp quỹ: <b className="text-slate-200">{(currentUser as any)?.name || 'Bạn'}</b> (người lập đề xuất này).
                        </div>
                      )}

                      {quickProposalType === 'project_expense_proposal' ? (
                        /* Bảng hạng mục chi tiêu — danh sách chi phí cần đề xuất (tương thích nút Công Việc) */
                        <div className="space-y-3">
                          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-2">
                            <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                              <h4 className="font-extrabold text-white text-[11px] uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5" /> Bảng hạng mục chi tiêu mua sắm lẻ
                              </h4>
                              <span className="text-[10px] text-slate-400">Thêm, sửa, xóa nhiều dòng</span>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="border-b border-slate-800 text-slate-400 text-[9.5px] uppercase font-black tracking-wider">
                                    <th className="p-1.5 w-8 text-center">STT</th>
                                    <th className="p-1.5">Hạng mục chi tiêu</th>
                                    <th className="p-1.5 w-40">Công trình</th>
                                    <th className="p-1.5 w-36">Số tiền (đ)</th>
                                    <th className="p-1.5">Ghi chú</th>
                                    <th className="p-1.5 w-10 text-center">Xóa</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {quickProposalExpenseItems.map((row, idx) => (
                                    <tr key={row.id} className="border-b border-slate-850 hover:bg-slate-900/40">
                                      <td className="p-1 text-center font-mono text-slate-400">{idx + 1}</td>
                                      <td className="p-1">
                                        <input
                                          type="text"
                                          value={row.item}
                                          onChange={(e) => {
                                            const next = [...quickProposalExpenseItems];
                                            next[idx].item = e.target.value;
                                            setQuickProposalExpenseItems(next);
                                          }}
                                          className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none text-[10.5px] focus:border-emerald-500"
                                          placeholder="Nhập hạng mục..."
                                        />
                                      </td>
                                      <td className="p-1">
                                        <select
                                          value={row.projectId || ''}
                                          onChange={(e) => {
                                            const next = [...quickProposalExpenseItems];
                                            const p = projects.find(pr => pr.id === e.target.value);
                                            next[idx].projectId = e.target.value || undefined;
                                            next[idx].projectName = p?.name;
                                            setQuickProposalExpenseItems(next);
                                          }}
                                          className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none text-[10.5px] cursor-pointer focus:border-emerald-500"
                                        >
                                          <option value="">— Chọn công trình —</option>
                                          {projects.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                          ))}
                                        </select>
                                      </td>
                                      <td className="p-1">
                                        <input
                                          type="number"
                                          value={row.amount}
                                          onChange={(e) => {
                                            const next = [...quickProposalExpenseItems];
                                            next[idx].amount = Number(e.target.value) || 0;
                                            setQuickProposalExpenseItems(next);
                                          }}
                                          className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none text-[10.5px] text-right font-mono text-emerald-400 focus:border-emerald-500"
                                        />
                                      </td>
                                      <td className="p-1">
                                        <input
                                          type="text"
                                          value={row.note}
                                          onChange={(e) => {
                                            const next = [...quickProposalExpenseItems];
                                            next[idx].note = e.target.value;
                                            setQuickProposalExpenseItems(next);
                                          }}
                                          className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white outline-none text-[10.5px] focus:border-emerald-500"
                                          placeholder="Ghi chú..."
                                        />
                                      </td>
                                      <td className="p-1 text-center">
                                        <button
                                          type="button"
                                          onClick={() => setQuickProposalExpenseItems(quickProposalExpenseItems.filter(r => r.id !== row.id))}
                                          className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded cursor-pointer"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                  {quickProposalExpenseItems.length === 0 && (
                                    <tr>
                                      <td colSpan={6} className="p-5 text-center text-slate-500 italic text-[11px]">
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
                                  // Điền sẵn công trình từ dự án đã chọn ở trên (nếu có) — người dùng vẫn có
                                  // thể đổi lại riêng cho từng dòng, vì mỗi khoản chi có thể thuộc công trình khác nhau.
                                  const defaultProj = projects.find(p => p.id === quickProposalProjId);
                                  setQuickProposalExpenseItems([...quickProposalExpenseItems, { id: `row_${Date.now()}`, item: '', amount: 0, note: '', projectId: defaultProj?.id, projectName: defaultProj?.name }]);
                                }}
                                className="bg-slate-900 border border-dashed border-slate-750 text-indigo-400 font-extrabold hover:bg-slate-850 px-3 py-1.5 rounded-lg text-[10px] cursor-pointer"
                              >
                                + Thêm dòng chi mới
                              </button>
                              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 rounded-xl text-right shadow border border-emerald-500/20">
                                <span className="text-[9px] text-emerald-100/90 block font-bold uppercase tracking-wider">Tổng số tiền:</span>
                                <strong className="text-white text-sm font-black font-mono">
                                  {quickProposalExpenseItems.reduce((s, r) => s + (Number(r.amount) || 0), 0).toLocaleString('vi-VN')} đ
                                </strong>
                              </div>
                            </div>
                          </div>

                        </div>
                      ) : (
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
                            <p className="text-[10px] text-slate-400 font-mono mt-1">
                              {quickProposalAmount !== '' && Number(quickProposalAmount) > 0
                                ? `${Number(quickProposalAmount).toLocaleString('vi-VN')} đồng`
                                : 'Nhập số tiền, ví dụ: 1500000 = 1.500.000 đ'}
                            </p>
                          </div>
                        </div>
                      )}

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

                      {/* Người xét duyệt & Người quyết toán — chỉ đọc, được cấu hình trong Quyền Phê Duyệt (đưa xuống dưới Diễn giải) */}
                      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-2">
                        <div className="text-[10px] font-black uppercase tracking-wider text-sky-400 bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 rounded w-fit">Phê Duyệt &amp; Quyết Toán (được cấu hình)</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <span className="text-[9px] text-slate-400 block mb-0.5">Người xét duyệt</span>
                            <div className="text-[11px] font-bold text-white">
                              {getConfiguredApprover(quickProposalType === 'subcontractor_advance' ? 'finance_advance_proposal' : (quickProposalType === 'project_expense_proposal' || quickProposalType === 'supplier_payment_proposal' || quickProposalType === 'cash_fund_deposit') ? 'finance_expense_proposal' : 'salary_advance')?.name || <span className="text-amber-400">Chưa cấu hình</span>}
                            </div>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 block mb-0.5">Người quyết toán</span>
                            <div className="text-[11px] font-bold text-white">
                              {getConfiguredSettler(quickProposalType === 'subcontractor_advance' ? 'finance_advance_proposal' : (quickProposalType === 'project_expense_proposal' || quickProposalType === 'supplier_payment_proposal' || quickProposalType === 'cash_fund_deposit') ? 'finance_expense_proposal' : 'salary_advance')?.name || <span className="text-amber-400">Chưa cấu hình</span>}
                            </div>
                          </div>
                        </div>
                        <p className="text-[9px] text-slate-500 italic">Hai trường trên được cấu hình trong <b>Phân Quyền &amp; Vai Trò → Quyền Phê Duyệt</b> (nhóm Tài Chính - Kế Toán) và không thể thay đổi tại đây.</p>
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                        <button type="button" onClick={() => setShowQuickProposalModal(false)} className="bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded text-slate-300 cursor-pointer">Bỏ qua</button>
                        <button type="submit" className="bg-amber-600 hover:bg-amber-555 text-white px-3 py-1.5 rounded font-bold cursor-pointer">Gửi Đề Xuất</button>
                      </div>
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
                        value={editingCustId ? editingCustId : (custName ? `KH_${getAbbreviation(custName)}_...` : 'KH_[Chữ viết tắt]_[Mã duy nhất]')}
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
              <WarehouseSuppliers autoOpenAddSignal={addSupplierSignal} />
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
                                source: 'import' as const,
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
                  <ReceiptFormContent
                    key={receiptPrefill ? `prefill-${receiptPrefill.custId}-${receiptPrefill.projId}` : 'fresh'}
                    customers={customers}
                    projects={projects}
                    autoSelectCustId={autoSelectCustId}
                    prefill={receiptPrefill}
                    onClose={() => { setShowRecForm(false); setAutoSelectCustId(null); setReceiptPrefill(null); }}
                    onAddCustomer={() => { setShowRecForm(false); setActiveSubTab('du_lieu_ke_toan'); setDuLieuTab('khach_hang'); setShowAddCustomerModal(true); }}
                    onSubmit={(data) => {
                      onAddReceipt({
                        id: `rec_${Date.now()}`,
                        code: `PT-2026-${Math.floor(Math.random() * 900 + 100)}`,
                        date: new Date().toISOString().split('T')[0],
                        customerId: data.custId,
                        projectId: data.projId,
                        amount: data.amount,
                        paymentMethod: data.method,
                        notes: data.notes,
                        collector: currentUser.name,
                        collectorId: (currentUser as any)?.id,
                        attachmentName: 'minh_chung_giao_dich_vcb.pdf',
                        source: 'manual',
                      });
                      setShowRecForm(false);
                      setAutoSelectCustId(null);
                      addToast({ title: '✅ Thành công', message: `✍️ Lập thành công phiếu thu tài chính. Dòng tiền thực nhận đã được ghi nhận vào kế toán sổ cái.`, type: 'success' });
                    }}
                  />
                )}

                <div className="flex flex-wrap items-end gap-2 bg-slate-900/50 border border-slate-850 rounded-xl px-3 py-2.5">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Từ ngày</label>
                    <input type="date" value={receiptFilters.fromDate} onChange={(e) => updateReceiptFilter({ fromDate: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-[11px] outline-none focus:border-orange-500 cursor-pointer" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Đến ngày</label>
                    <input type="date" value={receiptFilters.toDate} onChange={(e) => updateReceiptFilter({ toDate: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-[11px] outline-none focus:border-orange-500 cursor-pointer" />
                  </div>
                  <div className="flex flex-col gap-1 relative">
                    <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Chủ đầu tư</label>
                    <input
                      type="text"
                      value={receiptFilters.customer ? (customers.find(c => c.id === receiptFilters.customer)?.name || recCustFilterSearch) : recCustFilterSearch}
                      onChange={(e) => { setRecCustFilterSearch(e.target.value); setRecCustFilterOpen(true); if (receiptFilters.customer) updateReceiptFilter({ customer: '' }); }}
                      onFocus={() => { setRecCustFilterSearch(receiptFilters.customer ? (customers.find(c => c.id === receiptFilters.customer)?.name || '') : ''); setRecCustFilterOpen(true); }}
                      placeholder="Tìm kiếm chủ đầu tư..."
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-[11px] outline-none focus:border-orange-500 cursor-pointer w-full"
                    />
                    {recCustFilterOpen && (
                      <>
                        <div className="fixed inset-0 z-[190] bg-transparent cursor-default" onClick={() => setRecCustFilterOpen(false)} />
                        <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-slate-950 border border-slate-800 rounded-lg shadow-2xl z-[200] divide-y divide-slate-900">
                          <button type="button" onClick={() => { updateReceiptFilter({ customer: '' }); setRecCustFilterSearch(''); setRecCustFilterOpen(false); }} className="w-full text-left px-3 py-2 hover:bg-slate-900 transition-colors text-slate-400 text-[10.5px]">Tất cả</button>
                          {customers.filter(c => !recCustFilterSearch || c.name.toLowerCase().includes(recCustFilterSearch.toLowerCase())).map(c => (
                            <button key={c.id} type="button" onClick={() => { updateReceiptFilter({ customer: c.id }); setRecCustFilterSearch(c.name); setRecCustFilterOpen(false); }} className="w-full text-left px-3 py-2 hover:bg-slate-900 transition-colors text-slate-200 text-[10.5px]">
                              <span className="font-semibold text-slate-100">{c.name}</span>
                            </button>
                          ))}
                          {customers.filter(c => !recCustFilterSearch || c.name.toLowerCase().includes(recCustFilterSearch.toLowerCase())).length === 0 && (
                            <div className="p-3 text-slate-500 text-center">Không tìm thấy chủ đầu tư.</div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Hình thức</label>
                    <select value={receiptFilters.form} onChange={(e) => updateReceiptFilter({ form: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-[11px] outline-none focus:border-orange-500 cursor-pointer">
                      <option value="">Tất cả</option>
                      <option value="cash">Tiền mặt</option>
                      <option value="transfer">Chuyển khoản</option>
                    </select>
                  </div>
                  <button type="button" onClick={() => updateReceiptFilter({ fromDate: '', toDate: '', customer: '', form: '' })} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[10px] font-bold px-2.5 py-1.5 rounded-lg cursor-pointer">Đặt lại</button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-slate-300 text-[10.5px]">
                    <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                      <tr>
                        <th className="px-3 py-2 w-12 text-center">#</th>
                        <th className="px-3 py-2">Mã Phiếu Thu</th>
                        <th className="px-3 py-2">Ngày lập sổ</th>
                        <th className="px-3 py-2">Công trình liên đới</th>
                        <th className="px-3 py-2">Chú giải</th>
                        <th className="px-3 py-2 text-right">Tổng thực thu</th>
                        <th className="px-3 py-2 text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recPageInfo.pageGroups.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-8 text-center text-slate-500 italic">{receipts.length === 0 ? 'Chưa có phiếu thu nào.' : 'Không tìm thấy phiếu thu khớp bộ lọc.'}</td>
                        </tr>
                      ) : recPageInfo.pageGroups.map((g, gi) => {
                        const groupNo = (recPageInfo.safePage - 1) * recPageSize + gi + 1;
                        const expanded = recExpanded.has(g.customerId);
                        const sum = g.receipts.reduce((s, r) => s + r.amount, 0);
                        const toggle = () => setRecExpanded(prev => { const n = new Set(prev); n.has(g.customerId) ? n.delete(g.customerId) : n.add(g.customerId); return n; });
                        return (
                          <React.Fragment key={g.customerId}>
                            <tr className="border-b border-slate-800 bg-slate-800/40 hover:bg-slate-800/70 font-sans">
                              <td className="px-3 py-3 text-center font-bold text-slate-300">{groupNo}</td>
                              <td className="px-3 py-3" colSpan={4}>
                                <div className="flex items-center gap-2">
                                  <button onClick={toggle} className="text-slate-400 hover:text-white text-[10px] w-4 cursor-pointer" title={expanded ? 'Thu gọn' : 'Xem chi tiết'}>
                                    {expanded ? '▼' : '▶'}
                                  </button>
                                  <div>
                                    <button onClick={toggle} className="font-extrabold text-white text-[13px] text-left hover:underline cursor-pointer">
                                      {g.customerName}
                                    </button>
                                    <div className="text-[9px] text-slate-400 mt-0.5">{g.receipts.length} phiếu thu · Nhóm theo Chủ đầu tư</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-right font-mono font-bold text-emerald-400">+{sum.toLocaleString('vi-VN')} đ</td>
                              <td className="px-3 py-3 text-center text-slate-600 text-[9px] italic">—</td>
                            </tr>
                            {expanded && g.receipts.map((rec) => {
                              const projName = projects.find(p => p.id === rec.projectId)?.name || 'Văn phòng';
                              return (
                                <tr key={rec.id} className="border-b border-slate-850/60 bg-slate-900/30 hover:bg-slate-900/60 font-sans">
                                  <td className="px-3 py-2.5 pl-9 text-slate-500 text-center">—</td>
                                  <td className="px-3 py-2.5 font-mono font-bold text-emerald-400">{rec.code}</td>
                                  <td className="px-3 py-2.5">{rec.date}</td>
                                  <td className="px-3 py-2.5 font-bold text-slate-100 truncate max-w-[200px]">{projName}</td>
                                  <td className="px-3 py-2.5 text-slate-450 truncate max-w-[220px]">{rec.notes}</td>
                                  <td className="px-3 py-2.5 text-right font-bold text-emerald-400 font-mono">+{rec.amount.toLocaleString('vi-VN')} đ</td>
                                  <td className="px-3 py-2.5 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        onClick={() => {
                                          const cust = (customers || []).find(c => c.id === rec.customerId);
                                          const payerName = cust?.name || 'Khách hàng';
                                          const collectorName = rec.collectorId
                                            ? ((employeesProp || []).find(e => e.id === rec.collectorId)?.name || rec.collector)
                                            : rec.collector;
                                          setPreviewVoucher({
                                            type: 'receipt',
                                            data: rec,
                                            meta: {
                                              payer: payerName,
                                              project: projName !== 'Văn phòng' ? projName : undefined,
                                              collector: collectorName,
                                              order: rec.salesOrderId,
                                            },
                                          });
                                        }}
                                        title="Xem chi tiết / In phiếu thu"
                                        className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-950 rounded-lg transition-colors cursor-pointer"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                      {(rec.source === 'manual' || rec.source === 'import') && (
                                        <button
                                          onClick={() => openEditReceipt(rec)}
                                          title="Sửa phiếu thu"
                                          className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-950 rounded-lg transition-colors cursor-pointer"
                                        >
                                          <Edit className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                      {(rec.source === 'manual' || rec.source === 'import') && (
                                        <button
                                          onClick={() => {
                                            if (window.confirm(`⚠️ Xóa phiếu thu ${rec.code}?\nHành động không thể hoàn tác.`)) {
                                              if (onDeleteReceipt) onDeleteReceipt(rec.id);
                                              addToast({ title: '✅ Đã xóa', message: `Đã xóa phiếu thu ${rec.code}.`, type: 'success' });
                                            }
                                          }}
                                          title="Xóa phiếu thu"
                                          className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950 rounded-lg transition-colors cursor-pointer"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-700 bg-slate-900/80">
                        <td className="px-3 py-3"></td>
                        <td className="px-3 py-3 text-[11px] font-bold text-slate-300 uppercase tracking-wider" colSpan={4}>Tổng cộng ({filteredReceipts.length} khoản thu)</td>
                        <td className="px-3 py-3 text-right font-mono font-black text-emerald-300 text-base">+{filteredReceipts.reduce((s, r) => s + (Number(r.amount) || 0), 0).toLocaleString('vi-VN')} đ</td>
                        <td className="px-3 py-3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 mt-3 text-[10px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <span>Hiển thị</span>
                    <select value={recPageSize} onChange={(e) => setRecPageSize(Number(e.target.value))} className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 outline-none cursor-pointer">
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                    <span>chủ đầu tư/trang</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Trang {recPageInfo.safePage}/{recPageInfo.totalPages} · {receiptGroups.length} chủ đầu tư</span>
                    <button type="button" disabled={recPageInfo.safePage <= 1} onClick={() => setRecPage(p => Math.max(1, p - 1))} className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 cursor-pointer">‹ Trước</button>
                    <button type="button" disabled={recPageInfo.safePage >= recPageInfo.totalPages} onClick={() => setRecPage(p => Math.min(recPageInfo.totalPages, p + 1))} className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 cursor-pointer">Sau ›</button>
                  </div>
                </div>
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
                          'Nhóm gốc chi': PAYMENT_CAT_LABEL[pay.category] || pay.category,
                          'Nạn thầu nhận': pay.recipient,
                          'Tổng thực chi': pay.amount,
                          'Trạng thái duyệt': getPaymentDocStatus(pay) === 'completed' ? 'Hoàn Thành' : getPaymentDocStatus(pay) === 'rejected' ? 'Bác thầu' : 'Thiếu chứng từ',
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
                    {/* Nhập Excel & "Tạo đề xuất chi mới" đã được chuyển sang Đề Xuất Chi (nút Lập phiếu gọi modal showPayForm). Chỉ giữ Xuất Excel. */}

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
                            setPayRecipientId('');
                            setPayRecipientKind('');
                            setRecipientSearch('');
                            // Nạp quỹ không thể lấy tiền từ chính quỹ đó
                            if (val === 'cash_fund' && payMethod === 'cash_fund') setPayMethod('cash');
                          }}
                          // Lập phiếu từ một Đề Xuất đã duyệt: khóa Hạng mục chi phí,
                          // giữ nguyên đúng mục đích chi đã ghi trong đề xuất gốc.
                          disabled={!!activeProposalForPayment}
                          className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white cursor-pointer font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <option value="salary_advance">Ứng Lương Nhân Sự</option>
                          <option value="subcontractor_advance">Tạm ứng Thầu Phụ</option>
                          <option value="site_expense">Chi tiêu công trình</option>
                          <option value="salary">Lương Thưởng</option>
                          <option value="supplier_payment">Thanh Toán Nhà Cung Cấp</option>
                          {/* Nạp Quỹ Tiền Mặt không còn tạo trực tiếp ở đây nữa — phải qua "Trung
                              tâm Lập chi & Đề xuất" (Đề Xuất Chi) rồi mới Lập phiếu, để được Xét
                              duyệt như mọi đề xuất chi khác. Option chỉ hiện khi form đang khóa
                              (mở từ 1 đề xuất Nạp Quỹ đã duyệt) để dropdown hiển thị đúng nhãn —
                              không hiện khi lập phiếu thủ công, tránh chọn tay bỏ qua xét duyệt. */}
                          {activeProposalForPayment?.type === 'cash_fund_deposit' && (
                            <option value="cash_fund">Nạp Quỹ Tiền Mặt</option>
                          )}
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
                            // Lập phiếu từ một Đề Xuất đã duyệt: khóa số tiền, không cho sửa lệch
                            // so với số tiền đã duyệt trong đề xuất gốc.
                            disabled={!!activeProposalForPayment}
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white font-mono font-bold disabled:opacity-40 disabled:cursor-not-allowed"
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
                                setPayRecipientId('');
                                setPayRecipientKind('');
                                setRecipientSearch(e.target.value);
                                setShowRecipientDropdown(true);
                              }}
                              onFocus={() => {
                                setRecipientSearch(payRecipient);
                                setShowRecipientDropdown(true);
                              }}
                              // Lập phiếu từ một Đề Xuất đã duyệt: khóa Người nhận tiền,
                              // giữ đúng người/đơn vị đã ghi trong đề xuất gốc.
                              disabled={!!activeProposalForPayment}
                              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white pr-8 disabled:opacity-40 disabled:cursor-not-allowed"
                            />
                            <button
                              type="button"
                              onClick={() => setShowRecipientDropdown(!showRecipientDropdown)}
                              disabled={!!activeProposalForPayment}
                              className="absolute right-2 top-1.5 text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
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
                                    setPayRecipientId(item.id);
                                    setPayRecipientKind(item.kind);
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
                            // Lập phiếu từ một Đề Xuất đã duyệt: khóa Dự án gán chi, giữ đúng
                            // dự án của đề xuất gốc (để trống nếu là ứng lương/nhà cung cấp/
                            // công nợ thầu phụ/quỹ tiền mặt).
                            disabled={!!activeProposalForPayment}
                            className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {projects.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                            <option value="none">Ngoài dự án (Không gán chi)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">Đơn hàng mua (tùy chọn):</label>
                          <select
                            value={payPurchaseOrder}
                            onChange={(e) => setPayPurchaseOrder(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white cursor-pointer font-medium"
                          >
                            <option value="">— Không gắn đơn hàng —</option>
                            {purchaseOrders.map(o => (
                              <option key={o.id} value={o.id}>{o.id} · {o.supplierName || o.supplierId || ''}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">Hình thức thanh toán:</label>
                          <select
                            value={payMethod}
                            onChange={(e) => setPayMethod(e.target.value as 'cash' | 'transfer' | 'cash_fund')}
                            className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white cursor-pointer font-bold"
                          >
                            <option value="cash">Tiền mặt</option>
                            <option value="transfer">Chuyển khoản</option>
                            {/* Nạp quỹ phải lấy tiền từ Tiền mặt/Chuyển khoản công ty, không thể "rút từ chính quỹ" để nạp quỹ */}
                            {payCategory !== 'cash_fund' && <option value="cash_fund">Quỹ tiền mặt</option>}
                          </select>
                          {payMethod === 'cash_fund' && Number(payAmount) > cashFundBalance && (
                            <p className="text-[9px] text-rose-400 font-bold mt-1">⛔ Vượt số dư Quỹ hiện tại ({cashFundBalance.toLocaleString('vi-VN')}đ) — không thể lập phiếu.</p>
                          )}
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
                        <button
                          type="submit"
                          disabled={payMethod === 'cash_fund' && Number(payAmount) > cashFundBalance}
                          className="bg-rose-600 hover:bg-rose-555 disabled:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 text-white px-3 py-1.5 rounded font-bold cursor-pointer"
                        >
                          Nộp đề xuất chi
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                <div className="flex flex-wrap items-end gap-2 bg-slate-900/50 border border-slate-850 rounded-xl px-3 py-2.5">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Từ ngày</label>
                    <input type="date" value={paymentFilters.fromDate} onChange={(e) => updatePaymentFilter({ fromDate: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-[11px] outline-none focus:border-orange-500 cursor-pointer" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Đến ngày</label>
                    <input type="date" value={paymentFilters.toDate} onChange={(e) => updatePaymentFilter({ toDate: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-[11px] outline-none focus:border-orange-500 cursor-pointer" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Nhóm gốc chi</label>
                    <select value={paymentFilters.category} onChange={(e) => updatePaymentFilter({ category: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-[11px] outline-none focus:border-orange-500 cursor-pointer">
                      <option value="">Tất cả</option>
                      <option value="salary_advance">Ứng Lương Nhân Sự</option>
                      <option value="subcontractor_advance">Tạm ứng Thầu Phụ</option>
                      <option value="site_expense">Chi tiêu công trình</option>
                      <option value="salary">Lương Thưởng</option>
                      <option value="supplier_payment">Thanh Toán Nhà Cung Cấp</option>
                      <option value="cash_fund">Nạp Quỹ Tiền Mặt</option>
                      <option value="other">Chi tiêu khác</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Trạng thái</label>
                    <select value={paymentFilters.status} onChange={(e) => updatePaymentFilter({ status: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-[11px] outline-none focus:border-orange-500 cursor-pointer">
                      <option value="">Tất cả</option>
                      <option value="missing_docs">Thiếu chứng từ</option>
                      <option value="completed">Hoàn Thành</option>
                      <option value="rejected">Bác thầu</option>
                    </select>
                  </div>
                  <button type="button" onClick={() => updatePaymentFilter({ fromDate: '', toDate: '', category: '', status: '' })} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[10px] font-bold px-2.5 py-1.5 rounded-lg cursor-pointer">Đặt lại</button>
                </div>

                <div className="overflow-x-auto animate-fadeIn">
                  <table className="w-full text-left text-slate-300 text-[10.5px]">
                    <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                      <tr>
                        <th className="px-3 py-2 w-10 text-center">#</th>
                        <th className="px-3 py-2">Mã Phiếu Chi</th>
                        <th className="px-3 py-2">Nhóm gốc chi</th>
                        <th className="px-3 py-2">Đối tượng chi / Ghi chú</th>
                        <th className="px-3 py-2 text-right">Tổng thực chi</th>
                        <th className="px-3 py-2 text-center">Trạng thái duyệt</th>
                        <th className="px-3 py-2 text-center">Thao tác</th>
                        <th className="px-3 py-2 text-center">Đề xuất</th>
                        <th className="px-3 py-2 text-center">Chứng từ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payPageInfo.pageGroups.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-3 py-8 text-center text-slate-500 italic">{payments.length === 0 ? 'Chưa có phiếu chi nào.' : 'Không tìm thấy phiếu chi khớp bộ lọc.'}</td>
                        </tr>
                      ) : payPageInfo.pageGroups.map((g, gi) => {
                        const groupNo = (payPageInfo.safePage - 1) * payPageSize + gi + 1;
                        const expanded = payExpanded.has(g.recipient);
                        const sum = g.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
                        const toggle = () => setPayExpanded(prev => { const n = new Set(prev); n.has(g.recipient) ? n.delete(g.recipient) : n.add(g.recipient); return n; });
                        return (
                          <React.Fragment key={g.recipient}>
                            <tr className="border-b border-slate-800 bg-slate-800/40 hover:bg-slate-800/70 font-sans cursor-pointer" onClick={toggle}>
                              <td className="px-3 py-3 text-center font-bold text-slate-300">{groupNo}</td>
                              <td className="px-3 py-3" colSpan={3}>
                                <div className="flex items-center gap-2">
                                  <button onClick={(e) => { e.stopPropagation(); toggle(); }} className="text-slate-400 hover:text-white text-[10px] w-4 cursor-pointer" title={expanded ? 'Thu gọn' : 'Xem chi tiết'}>
                                    {expanded ? '▼' : '▶'}
                                  </button>
                                  <div>
                                    <div className="font-extrabold text-white text-[13px] text-left">{g.recipient}</div>
                                    <div className="text-[9px] text-slate-400 mt-0.5">{g.payments.length} phiếu chi · Quản lý theo Đối tượng chi</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-right font-mono font-bold text-rose-400">-{sum.toLocaleString('vi-VN')} đ</td>
                              <td className="px-3 py-3">
                                {(() => {
                                  const total = g.payments.length;
                                  const withDocs = g.payments.filter(p => Array.isArray(p.images) && p.images.length > 0).length;
                                  const all = total > 0 && withDocs === total;
                                  return (
                                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold border ${all ? 'bg-white text-emerald-700 border-emerald-600' : 'bg-white text-orange-600 border-orange-500'}`}>
                                      Chứng từ: {withDocs}/{total}
                                    </span>
                                  );
                                })()}
                              </td>
                              <td className="px-3 py-3"></td>
                              <td className="px-3 py-3"></td>
                              <td className="px-3 py-3"></td>
                            </tr>
                            {expanded && g.payments.map((p) => {
                              const payProj = (projects || []).find(pr => pr.id === p.projectId)?.name;
                              const proposerName = p.proposerId
                                ? ((employeesProp || []).find(e => e.id === p.proposerId)?.name || p.proposer)
                                : p.proposer;
                              const docStatus = getPaymentDocStatus(p);
                              return (
                                <tr key={p.id} className="border-b border-slate-850/60 bg-slate-900/30 hover:bg-slate-900/60 font-sans">
                                  <td className="px-3 py-2.5 pl-9 text-slate-500 text-center">—</td>
                                  <td className="px-3 py-2.5 font-mono font-bold text-rose-450">{p.code}</td>
                                  <td className="px-3 py-2.5">
                                    <span className={`text-[9.5px] uppercase font-extrabold px-1.5 py-0.5 rounded border ${PAYMENT_CAT_BADGE[p.category] || 'bg-white text-slate-600 border-slate-400'}`}>{PAYMENT_CAT_LABEL[p.category] || p.category}</span>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    {/* Chi phí Công trình: nhóm cha đã hiện tên người lập đề xuất rồi
                                        (đối tượng chi = người lập), lặp lại ở đây thừa — hiện tên
                                        Dự án/Công trình của khoản chi này thay thế, đúng yêu cầu
                                        "tổng hợp theo người lập, xổ chi tiết theo công trình". */}
                                    {p.category === 'site_expense' ? (
                                      <div className="font-extrabold text-slate-100">🏗️ {payProj || 'Không rõ công trình'}</div>
                                    ) : (
                                      <div className="font-extrabold text-slate-100">{p.recipient}</div>
                                    )}
                                    <div className="text-[9.5px] text-slate-500 italic mt-0.5">{p.notes}</div>
                                  </td>
                                  <td className="px-3 py-2.5 text-right font-bold text-rose-450 font-mono">-{p.amount.toLocaleString('vi-VN')} đ</td>
                                  <td className="px-3 py-2.5 text-center">
                                    {docStatus === 'rejected' ? (
                                      <span className="bg-rose-500/10 text-rose-450 text-[9px] px-1.5 py-0.5 rounded uppercase border border-rose-500/20">Bác thầu</span>
                                    ) : docStatus === 'completed' ? (
                                      <span className="bg-emerald-500/10 text-emerald-400 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border border-emerald-500/20">Hoàn Thành</span>
                                    ) : (
                                      <span className="bg-white text-orange-600 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border border-orange-500">Thiếu chứng từ</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        onClick={() => {
                                          setPreviewVoucher({
                                            type: 'payment',
                                            data: p,
                                            meta: { project: payProj, proposer: proposerName, approver: p.approver, order: p.purchaseOrderId },
                                          });
                                        }}
                                        title="Xem chi tiết / In phiếu chi"
                                        className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-950 rounded-lg transition-colors cursor-pointer"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => openVoucherUploadForPayment(p)}
                                        title="Cập nhật chứng từ (sao kê / biên lai)"
                                        className="p-1.5 text-violet-400 hover:text-violet-300 hover:bg-violet-950 rounded-lg transition-colors cursor-pointer"
                                      >
                                        <Upload className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    {p.relatedAdvanceId ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const prop = (subcontractorAdvances || []).find(a => a.id === p.relatedAdvanceId);
                                          if (prop) setViewingProposalDetail(prop);
                                          else addToast({ title: '⚠️ Không tìm thấy', message: `Đề xuất ${p.relatedAdvanceId} không còn tồn tại.`, type: 'warning' });
                                        }}
                                        className="bg-violet-600 hover:bg-violet-500 text-white text-[9.5px] font-extrabold px-2 py-1 rounded-lg flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap"
                                        title="Xem chi tiết Đề Xuất Chi liên kết"
                                      >
                                        <FileText className="w-3 h-3" /> Xem đề xuất
                                      </button>
                                    ) : p.purchaseOrderId ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const linkedOrder = purchaseOrders.find((o: PurchaseOrder) => o.id === p.purchaseOrderId);
                                          if (linkedOrder) setPoDetailModal({ open: true, order: linkedOrder });
                                          else addToast({ title: '⚠️ Không tìm thấy', message: `Đơn hàng ${p.purchaseOrderId} không còn tồn tại.`, type: 'warning' });
                                        }}
                                        className="bg-slate-700 hover:bg-slate-600 text-white text-[9.5px] font-extrabold px-2 py-1 rounded-lg flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap"
                                        title="Xem đơn hàng được thanh toán"
                                      >
                                        <ShoppingCart className="w-3 h-3" /> Xem đơn
                                      </button>
                                    ) : (
                                      <span className="text-slate-600 text-[9px] italic">—</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    {Array.isArray(p.images) && p.images.length > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => setLightboxImages(p.images!)}
                                        title={`Xem ${p.images.length} ảnh chứng từ`}
                                        className="bg-slate-700 hover:bg-slate-600 text-white text-[9.5px] font-extrabold px-2 py-1 rounded-lg flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap"
                                      >
                                        <ImageIcon className="w-3 h-3" /> {p.images.length}
                                      </button>
                                    ) : (
                                      <span className="text-slate-600 text-[9px] italic">Chưa có</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-700 bg-slate-900/80">
                        <td className="px-3 py-3"></td>
                        <td className="px-3 py-3 text-[11px] font-bold text-slate-300 uppercase tracking-wider" colSpan={3}>Tổng cộng ({filteredPayments.length} phiếu chi)</td>
                        <td className="px-3 py-3 text-right font-mono font-black text-rose-400 text-base">-{payTotalAmount.toLocaleString('vi-VN')} đ</td>
                        <td className="px-3 py-3"></td>
                        <td className="px-3 py-3"></td>
                        <td className="px-3 py-3"></td>
                        <td className="px-3 py-3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 mt-3 text-[10px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <span>Hiển thị</span>
                    <select value={payPageSize} onChange={(e) => setPayPageSize(Number(e.target.value))} className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 outline-none cursor-pointer">
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                    <span>đối tượng chi/trang</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Trang {payPageInfo.safePage}/{payPageInfo.totalPages} · {paymentGroups.length} đối tượng chi</span>
                    <button type="button" disabled={payPageInfo.safePage <= 1} onClick={() => setPayPage(p => Math.max(1, p - 1))} className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 cursor-pointer">‹ Trước</button>
                    <button type="button" disabled={payPageInfo.safePage >= payPageInfo.totalPages} onClick={() => setPayPage(p => Math.min(payPageInfo.totalPages, p + 1))} className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 cursor-pointer">Sau ›</button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: QUỸ TIỀN MẶT */}
            {activeSubTab === 'quy_tien_mat' && (() => {
              // Các khoản CHI RA từ Quỹ (mọi hạng mục, paymentMethod='cash_fund'), nhóm theo người tạo đề xuất
              const cashFundPayments = payments.filter(p => p.paymentMethod === 'cash_fund');
              const spentGroups = new Map<string, { proposer: string; items: Payment[] }>();
              cashFundPayments.forEach(p => {
                const key = p.proposerId || p.proposer || '—';
                if (!spentGroups.has(key)) spentGroups.set(key, { proposer: p.proposer || '—', items: [] });
                spentGroups.get(key)!.items.push(p);
              });
              const spentGroupList = Array.from(spentGroups.values()).sort((a, b) =>
                b.items.reduce((s, p) => s + (p.amount || 0), 0) - a.items.reduce((s, p) => s + (p.amount || 0), 0));
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Số dư hiện tại</span>
                      <span className={`text-xl font-black font-mono ${cashFundBalance < 0 ? 'text-rose-400' : 'text-teal-400'}`}>{cashFundBalance.toLocaleString('vi-VN')}đ</span>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Số dư đầu kỳ</span>
                      {editingOpeningBalance ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            value={openingBalanceInput}
                            onChange={(e) => setOpeningBalanceInput(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono text-sm outline-none focus:border-teal-500"
                          />
                          <button type="button" onClick={handleSaveCashFundOpening} className="p-1.5 bg-teal-600 hover:bg-teal-500 rounded text-white cursor-pointer"><Check className="w-3.5 h-3.5" /></button>
                          <button type="button" onClick={() => setEditingOpeningBalance(false)} className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded text-white cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xl font-black text-white font-mono">{(cashFundConfig?.openingBalance || 0).toLocaleString('vi-VN')}đ</span>
                          {canEditCashFundOpening && (
                            <button type="button" onClick={() => { setOpeningBalanceInput(String(cashFundConfig?.openingBalance || 0)); setEditingOpeningBalance(true); }} className="p-1 text-slate-400 hover:text-teal-400 cursor-pointer" title="Sửa số dư đầu kỳ">
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Tổng đã nạp</span>
                      <span className="text-xl font-black text-emerald-400 font-mono">+{cashFundDeposited.toLocaleString('vi-VN')}đ</span>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Tổng đã chi từ Quỹ</span>
                      <span className="text-xl font-black text-rose-400 font-mono">-{cashFundSpent.toLocaleString('vi-VN')}đ</span>
                    </div>
                  </div>

                  {/* Đề xuất Nạp Quỹ nay đi qua "Trung tâm Lập chi & Đề xuất" ở tab Đề Xuất
                      Chi (thẻ "Quỹ Tiền Mặt (Nạp Quỹ)" trong QUICK_LAUNCH_ITEMS) — được
                      Xét duyệt và Lập phiếu như mọi đề xuất chi khác, không còn nút tắt mở
                      thẳng form "Tạo Đề Xuất Chi Mới" tại đây nữa. */}

                  <div className="space-y-2">
                    <span className="font-bold text-slate-300 uppercase tracking-widest text-[11px] block border-b border-slate-850 pb-2">Chi tiêu từ Quỹ theo người tạo đề xuất</span>
                    {spentGroupList.length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic bg-slate-900 border border-dashed border-slate-800 rounded-xl p-4 text-center">Chưa có khoản chi nào lấy từ Quỹ tiền mặt.</p>
                    ) : spentGroupList.map((g, gi) => {
                      const groupTotal = g.items.reduce((s, p) => s + (p.amount || 0), 0);
                      return (
                        <div key={gi} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-2 bg-slate-850/60">
                            <span className="font-bold text-slate-200 text-[11px]">{g.proposer}</span>
                            <span className="text-rose-400 font-mono font-bold text-[11px]">-{groupTotal.toLocaleString('vi-VN')}đ ({g.items.length} khoản)</span>
                          </div>
                          <table className="w-full text-[10.5px]">
                            <tbody className="divide-y divide-slate-850">
                              {g.items.map(p => (
                                <tr key={p.id}>
                                  <td className="px-3 py-1.5 font-mono text-slate-400">{p.code}</td>
                                  <td className="px-3 py-1.5 text-slate-300">{PAYMENT_CAT_LABEL[p.category] || p.category}</td>
                                  <td className="px-3 py-1.5 text-slate-500">{p.date}</td>
                                  <td className="px-3 py-1.5 text-slate-400 italic truncate max-w-[240px]">{p.notes}</td>
                                  <td className="px-3 py-1.5 text-right">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border ${p.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : p.status === 'rejected' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                                      {p.status === 'approved' ? 'Đã duyệt' : p.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt'}
                                    </span>
                                  </td>
                                  <td className="px-3 py-1.5 text-right font-mono font-bold text-rose-400">-{p.amount.toLocaleString('vi-VN')}đ</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* TAB 9: CÔNG NỢ PHẢI THU */}
            {activeSubTab === 'cong_no_phai_thu' && (
              <div className="space-y-4">

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-850 pb-3">
                  <div>
                    <span className="font-bold text-slate-300 uppercase tracking-widest text-[11px] block">
                      Danh sách công nợ phải thu
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleUpdateOpeningReceivables}
                      className="bg-amber-600 hover:bg-amber-555 text-white font-bold text-[10px] px-2.5 py-1.5 rounded flex items-center gap-1 cursor-pointer border border-amber-500 transition-colors"
                      title="Lấy Công Nợ đầu kỳ > 0 từ Khách Hàng đưa vào cột Giá Trị"
                    >
                      <Database className="w-3 h-3" />
                      Cập nhật Công Nợ Đầu Kỳ
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-2 bg-slate-900/50 border border-slate-850 rounded-xl px-3 py-2.5">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Từ ngày</label>
                    <input type="date" value={receivableFilters.fromDate} onChange={(e) => updateReceivableFilter({ fromDate: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-[11px] outline-none focus:border-orange-500 cursor-pointer" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Đến ngày</label>
                    <input type="date" value={receivableFilters.toDate} onChange={(e) => updateReceivableFilter({ toDate: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-[11px] outline-none focus:border-orange-500 cursor-pointer" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Chủ đầu tư</label>
                    <select value={receivableFilters.investor} onChange={(e) => updateReceivableFilter({ investor: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-[11px] outline-none focus:border-orange-500 cursor-pointer">
                      <option value="">Tất cả</option>
                      {Array.from(new Set(groupedReceivables.map(g => g.investor))).map(inv => (<option key={inv} value={inv}>{inv}</option>))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Trạng thái</label>
                    <select value={receivableFilters.status} onChange={(e) => updateReceivableFilter({ status: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-[11px] outline-none focus:border-orange-500 cursor-pointer">
                      <option value="">Tất cả</option>
                      <option value="con_no">Còn phải thu</option>
                      <option value="da_thu">Đã thu hết</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Lĩnh vực</label>
                    <select value={receivableFilters.field} onChange={(e) => updateReceivableFilter({ field: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-[11px] outline-none focus:border-orange-500 cursor-pointer">
                      <option value="">Tất cả</option>
                      <option value="Xây dựng">Xây Dựng</option>
                      <option value="Nội thất">Nội Thất</option>
                      <option value="Cơ khí">Cơ Khí</option>
                    </select>
                  </div>
                  <button type="button" onClick={() => { const y = new Date().getFullYear(); updateReceivableFilter({ investor: '', status: '', field: '', fromDate: `${y}-01-01`, toDate: `${y}-12-31` }); }} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[10px] font-bold px-2.5 py-1.5 rounded-lg cursor-pointer">Đặt lại</button>
                </div>

                <div className="overflow-x-auto text-[10.5px]">
                  <table className="w-full text-left text-slate-300">
                    <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                      <tr>
                        <th className="px-3 py-2">Chủ đầu tư / Dự án công trình</th>
                        <th className="px-3 py-2">Lĩnh vực</th>
                        <th className="px-3 py-2 text-right">Công Nợ Đầu Kỳ</th>
                        <th className="px-3 py-2 text-right">Giá trị HĐ</th>
                        <th className="px-3 py-2 text-right">Tổng giá trị</th>
                        <th className="px-3 py-2 text-right">Đã Thu/ Tạm Ứng</th>
                        <th className="px-3 py-2 text-right text-orange-400 font-black">Còn phải thu</th>
                        <th className="px-3 py-2">Ghi chú</th>
                        <th className="px-3 py-2 text-center w-20">Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReceivables.length === 0 && (
                        <tr>
                          <td colSpan={9} className="text-center py-10 text-slate-500 font-bold font-sans">
                            {groupedReceivables.length === 0 ? '📭 Chưa có dữ liệu công nợ phải thu. Hãy import từ Excel hoặc thêm mới.' : 'Không tìm thấy công nợ phải thu khớp bộ lọc.'}
                          </td>
                        </tr>
                      )}
                      {receivablePageInfo.pageGroups.map((g) => {
                        const expanded = expandedCustomers.has(g.key);
                        return (
                          <React.Fragment key={g.key}>
                            {/* Dòng Chủ đầu tư (tổng hợp) */}
                            <tr className="border-b border-slate-800 bg-slate-800/40 hover:bg-slate-800/70 font-sans">
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setExpandedCustomers(prev => { const n = new Set(prev); n.has(g.key) ? n.delete(g.key) : n.add(g.key); return n; })}
                                    className="text-slate-400 hover:text-white text-[10px] w-4 cursor-pointer"
                                    title={expanded ? 'Thu gọn' : 'Xem chi tiết công trình'}
                                  >
                                    {expanded ? '▼' : '▶'}
                                  </button>
                                  <div>
                                    <button
                                      onClick={() => setExpandedCustomers(prev => { const n = new Set(prev); n.has(g.key) ? n.delete(g.key) : n.add(g.key); return n; })}
                                      className="font-extrabold text-white text-[13px] text-left hover:underline cursor-pointer"
                                      title="Click để xem chi tiết các công trình"
                                    >
                                      {g.investor}
                                    </button>
                                    <div className="text-[9px] text-slate-400 mt-0.5">{g.projects.filter((p: any) => !p._isOutOfProject).length} công trình · Quản lý theo Chủ đầu tư</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-[10px] text-slate-400 italic">Tổng hợp</td>
                              <td className="px-3 py-3 text-right font-mono font-bold text-amber-400">
                                {g.cdkValue > 0 ? `${g.cdkValue.toLocaleString('vi-VN')} đ` : '—'}
                              </td>
                              <td className="px-3 py-3 text-right font-mono font-bold text-slate-100">
                                {g.tongHopDong.toLocaleString('vi-VN')} đ
                              </td>
                              <td className="px-3 py-3 text-right font-mono font-bold text-violet-400">
                                {g.tongGiaTri.toLocaleString('vi-VN')} đ
                              </td>
                              <td className="px-3 py-3 text-right font-mono text-emerald-400 font-bold">+{g.daThu.toLocaleString('vi-VN')} đ</td>
                              <td className={`px-3 py-3 text-right font-mono font-black ${g.conLai < 0 ? 'text-emerald-400 bg-emerald-500/5' : 'text-orange-500 bg-orange-500/5'}`}>
                                {g.conLai >= 0 ? `${g.conLai.toLocaleString('vi-VN')} đ` : `-${Math.abs(g.conLai).toLocaleString('vi-VN')} đ`}
                              </td>
                              <td className="px-3 py-3 text-slate-400 italic max-w-xs truncate" title={g.customer?.notes}>
                                {g.customer?.notes || '-'}
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex items-center justify-center gap-2">
                                  {/* Dòng tổng hợp không có nút thao tác */}
                                </div>
                              </td>
                            </tr>

                            {/* Chi tiết từng công trình khi mở rộng */}
                            {expanded && g.projects.map((r: any) => {
                              const isOutOfProjectRow = !!r._isOutOfProject;
                              const conLaiCT = (r.contractValue || 0) - (r.collected || 0);
                              return (
                                <tr key={`child:${r.id}`} className="border-b border-slate-850/60 bg-slate-900/30 hover:bg-slate-900/60 font-sans">
                                  <td className="px-3 py-2.5 pl-9">
                                    <div className="font-semibold text-slate-200 text-[11px]">{r.projectName}</div>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                      r.field === 'Xây dựng' ? 'bg-emerald-600/15 text-emerald-300 border border-emerald-500/30' :
                                      r.field === 'Nội thất' ? 'bg-sky-600/15 text-sky-300 border border-sky-500/30' :
                                      r.field === 'Cơ khí' ? 'bg-amber-600/15 text-amber-300 border border-amber-500/30' :
                                      'bg-slate-700/40 text-slate-300 border border-slate-600/40'
                                    }`}>
                                      {r.field || '—'}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5 text-right text-slate-500 text-[10px] italic">—</td>
                                  <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-200">
                                    {isOutOfProjectRow ? '—' : `${(r.contractValue || 0).toLocaleString('vi-VN')} đ`}
                                  </td>
                                  <td className="px-3 py-2.5 text-right font-mono text-slate-500 text-[10px] italic">—</td>
                                  <td className="px-3 py-2.5 text-right font-mono text-emerald-400">+{(r.collected || 0).toLocaleString('vi-VN')} đ</td>
                                  <td className="px-3 py-2.5 text-right font-mono font-black text-slate-400">
                                    {isOutOfProjectRow ? '—' : (conLaiCT >= 0 ? `${conLaiCT.toLocaleString('vi-VN')} đ` : `-${Math.abs(conLaiCT).toLocaleString('vi-VN')} đ`)}
                                  </td>
                                  <td className="px-3 py-2.5 text-slate-400 text-[10px] max-w-xs truncate" title={r.notes}>{r.notes || '-'}</td>
                                  <td className="px-3 py-2.5">
                                    <div className="flex items-center justify-center gap-2">
                                      <button
                                        onClick={() => setReceiptDetail({ receipts: getReceiptsForRow(r), title: `Phiếu thu — ${r.projectName}` })}
                                        className="text-cyan-400 hover:text-cyan-300 p-1 border border-cyan-500/30 rounded cursor-pointer"
                                        title="Xem phiếu thu của công trình"
                                      >
                                        🧾
                                      </button>
                                      {!r.isAuto && !isOutOfProjectRow && (
                                        <>
                                          <button onClick={() => handleEditReceivable(r)} className="text-blue-400 hover:text-blue-300 p-1" title="Chỉnh sửa công nợ"><Edit className="w-3.5 h-3.5" /></button>
                                          <button onClick={() => handleDeleteReceivable(r)} className="text-rose-400 hover:text-rose-300 p-1" title="Xóa công nợ"><Trash2 className="w-3.5 h-3.5" /></button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-700 bg-slate-900/80 font-sans">
                        <td className="px-3 py-3 font-extrabold text-white text-[11px] uppercase tracking-wider" colSpan={2}>
                          Tổng cộng ({receivablePageInfo.total} chủ đầu tư)
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-black text-amber-400">
                          {receivablePageInfo.totals.cdkValue > 0 ? `${receivablePageInfo.totals.cdkValue.toLocaleString('vi-VN')} đ` : '—'}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-black text-slate-100">
                          {receivablePageInfo.totals.tongHopDong.toLocaleString('vi-VN')} đ
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-black text-violet-400">
                          {receivablePageInfo.totals.tongGiaTri.toLocaleString('vi-VN')} đ
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-black text-emerald-400">
                          +{receivablePageInfo.totals.daThu.toLocaleString('vi-VN')} đ
                        </td>
                        <td className={`px-3 py-3 text-right font-mono font-black ${receivablePageInfo.totals.conLai < 0 ? 'text-emerald-400 bg-emerald-500/5' : 'text-orange-400 bg-orange-500/5'}`}>
                          {receivablePageInfo.totals.conLai >= 0 ? `${receivablePageInfo.totals.conLai.toLocaleString('vi-VN')} đ` : `-${Math.abs(receivablePageInfo.totals.conLai).toLocaleString('vi-VN')} đ`}
                        </td>
                        <td className="px-3 py-3"></td>
                        <td className="px-3 py-3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Phân trang + Tổng cộng (tính trên toàn bộ danh sách lọc, không chỉ trang hiện tại) */}
                <div className="flex flex-wrap items-center justify-between gap-3 mt-3 text-[10px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <span>Hiển thị</span>
                    <select value={receivablePageSize} onChange={(e) => setReceivablePageSize(Number(e.target.value))} className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 outline-none cursor-pointer">
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                    <span>chủ đầu tư/trang</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Trang {receivablePageInfo.safePage}/{receivablePageInfo.totalPages} · {receivablePageInfo.total} chủ đầu tư</span>
                    <button type="button" disabled={receivablePageInfo.safePage <= 1} onClick={() => setReceivablePage(p => Math.max(1, p - 1))} className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 cursor-pointer">‹ Trước</button>
                    <button type="button" disabled={receivablePageInfo.safePage >= receivablePageInfo.totalPages} onClick={() => setReceivablePage(p => Math.min(receivablePageInfo.totalPages, p + 1))} className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 cursor-pointer">Sau ›</button>
                  </div>
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
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleUpdateOpeningLiabilities}
                    className="bg-amber-600 hover:bg-amber-555 text-white font-bold text-[10px] px-2.5 py-1.5 rounded flex items-center gap-1 cursor-pointer border border-amber-500 transition-colors"
                    title="Lấy Công Nợ đầu kỳ > 0 từ Thầu Phụ & NCC Vật tư đưa vào cột Số Dư Đầu Kỳ"
                  >
                    <Database className="w-3 h-3" />
                    Cập nhật Công Nợ Đầu Kỳ
                  </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-2 bg-slate-900/50 border border-slate-850 rounded-xl px-3 py-2.5">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Từ ngày</label>
                    <input type="date" value={liabilityFilters.fromDate} onChange={(e) => updateLiabilityFilter({ fromDate: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-[11px] outline-none focus:border-orange-500 cursor-pointer" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Đến ngày</label>
                    <input type="date" value={liabilityFilters.toDate} onChange={(e) => updateLiabilityFilter({ toDate: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-[11px] outline-none focus:border-orange-500 cursor-pointer" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Phân Loại</label>
                    <select value={liabilityFilters.category} onChange={(e) => updateLiabilityFilter({ category: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-[11px] outline-none focus:border-orange-500 cursor-pointer">
                      <option value="">Tất cả</option>
                      <option value="Thầu Phụ">Thầu Phụ</option>
                      <option value="Nhà Cung Cấp">Nhà Cung Cấp</option>
                      <option value="Khác">Khác</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Trạng thái</label>
                    <select value={liabilityFilters.status} onChange={(e) => updateLiabilityFilter({ status: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-[11px] outline-none focus:border-orange-500 cursor-pointer">
                      <option value="">Tất cả</option>
                      <option value="con_no">Còn nợ</option>
                      <option value="da_thu">Đã tất toán</option>
                    </select>
                  </div>
                  <button type="button" onClick={() => { const y = new Date().getFullYear(); updateLiabilityFilter({ category: '', status: '', fromDate: `${y}-01-01`, toDate: `${y}-12-31` }); }} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[10px] font-bold px-2.5 py-1.5 rounded-lg cursor-pointer">Đặt lại</button>
                </div>

                <div className="overflow-x-auto text-[10.5px]">
                  <table className="w-full text-left text-slate-300">
                    <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                      <tr>
                        <th className="px-3 py-2.5">Tên Đơn Vị</th>
                        <th className="px-3 py-2.5">Phân Loại</th>
                        <th className="px-3 py-2.5 text-right">Công Nợ Đầu Kỳ</th>
                        <th className="px-3 py-2.5 text-right">Phát Sinh</th>
                        <th className="px-3 py-2.5 text-right">Tổng giá trị</th>
                        <th className="px-3 py-2.5 text-right">Đã Trả</th>
                        <th className="px-3 py-2.5 text-right text-rose-400 font-bold">Còn lại</th>
                        <th className="px-3 py-2.5">Ghi chú</th>
                        <th className="px-3 py-2.5 text-center">Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLiabilities.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-3 py-8 text-center text-slate-500 italic">
                            {mergedLiabilities.length === 0 ? 'Chưa có dữ liệu công nợ phải trả. Hãy duyệt hợp đồng thầu phụ hoặc thêm mới.' : 'Không tìm thấy công nợ phải trả khớp bộ lọc.'}
                          </td>
                        </tr>
                      ) : (
                        liabilityPageInfo.pageItems.map((g: any) => {
                          const expanded = expandedLiabilities.has(g.key);
                          const toggle = () => setExpandedLiabilities(prev => { const n = new Set(prev); n.has(g.key) ? n.delete(g.key) : n.add(g.key); return n; });
                          return (
                            <React.Fragment key={g.key}>
                              {/* Dòng Đơn vị (tổng hợp) */}
                              <tr className="border-b border-slate-800 bg-slate-800/40 hover:bg-slate-800/70 font-sans">
                                <td className="px-3 py-3">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={toggle}
                                      className="text-slate-400 hover:text-white text-[10px] w-4 cursor-pointer"
                                      title={expanded ? 'Thu gọn' : 'Xem chi tiết khoản nợ'}
                                    >
                                      {expanded ? '▼' : '▶'}
                                    </button>
                                    <div>
                                      <button
                                        onClick={toggle}
                                        className="font-extrabold text-slate-100 text-left hover:underline cursor-pointer"
                                        title="Click để xem chi tiết các khoản nợ"
                                      >
                                        {g.name}
                                      </button>
                                      <div className="text-[9px] text-slate-400 mt-0.5">{g.items.length} khoản nợ</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-3 py-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                    g.category === 'Thầu Phụ' ? 'bg-white text-emerald-700 border border-emerald-600' :
                                    g.category === 'Nhà Cung Cấp' ? 'bg-white text-purple-700 border border-purple-600' :
                                    'bg-slate-700/40 text-slate-300 border border-slate-600/40'
                                  }`}>
                                    {g.category}
                                  </span>
                                </td>
                                <td className="px-3 py-3 text-right font-mono font-bold text-amber-400">
                                  {g.openingDebt > 0 ? `${g.openingDebt.toLocaleString('vi-VN')} đ` : '—'}
                                </td>
                                <td className="px-3 py-3 text-right font-mono font-bold text-slate-100">
                                  {g.value.toLocaleString('vi-VN')} đ
                                </td>
                                <td className="px-3 py-3 text-right font-mono font-bold text-violet-400">
                                  {g.tongGiaTri.toLocaleString('vi-VN')} đ
                                </td>
                                <td className="px-3 py-3 text-right font-mono text-emerald-400">
                                  -{g.paid.toLocaleString('vi-VN')} đ
                                </td>
                                <td className={`px-3 py-3 text-right font-mono font-extrabold ${g.remaining < 0 ? 'text-emerald-400 bg-emerald-500/5' : 'text-rose-450 bg-rose-500/5'}`}>
                                  {g.remaining >= 0 ? `${g.remaining.toLocaleString('vi-VN')} đ` : `-${Math.abs(g.remaining).toLocaleString('vi-VN')} đ`}
                                </td>
                                <td className="px-3 py-3 text-slate-400 italic max-w-xs truncate" title={g.notes}>
                                  {g.notes}
                                </td>
                                <td className="px-3 py-3">
                                  <div className="flex items-center justify-center gap-2">
                                    {/* Dòng tổng hợp không có nút thao tác — thao tác ở dòng chi tiết */}
                                  </div>
                                </td>
                              </tr>

                              {/* Chi tiết từng khoản nợ khi mở rộng */}
                              {expanded && g.items.map((item: any) => (
                                <tr key={item.id} className="border-b border-slate-850/60 bg-slate-900/30 hover:bg-slate-900/60 font-sans">
                                  <td className="px-3 py-2.5 pl-9">
                                    <div className="font-semibold text-slate-200 text-[11px]">{item.notes || item.name}</div>
                                  </td>
                                  <td className="px-3 py-2.5 text-[10px] text-slate-400 italic">—</td>
                                  <td className="px-3 py-2.5 text-right font-mono font-bold text-amber-400">
                                    {(() => {
                                      const od = (item.openingDebt ?? (item.isOpeningDebt ? item.value : 0)) || 0;
                                      return od > 0 ? `${od.toLocaleString('vi-VN')} đ` : '—';
                                    })()}
                                  </td>
                                  <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-200">
                                    {item.value.toLocaleString('vi-VN')} đ
                                  </td>
                                  <td className="px-3 py-2.5 text-right font-mono text-slate-500 text-[10px] italic">—</td>
                                  <td className="px-3 py-2.5 text-right font-mono text-emerald-400">
                                    -{item.paid.toLocaleString('vi-VN')} đ
                                  </td>
                                  <td className="px-3 py-2.5 text-right font-mono font-black text-slate-400">
                                    {item.remaining >= 0 ? `${item.remaining.toLocaleString('vi-VN')} đ` : `-${Math.abs(item.remaining).toLocaleString('vi-VN')} đ`}
                                  </td>
                                  <td className="px-3 py-2.5 text-slate-400 text-[10px] max-w-xs truncate" title={item.notes}>
                                    {item.notes || '-'}
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenProposalFromLiability(item)}
                                      className="bg-violet-600 hover:bg-violet-500 text-white text-[9.5px] font-extrabold px-2 py-1 rounded-lg flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap mx-auto"
                                      title="Tạo Đề Xuất Chi từ công nợ này"
                                    >
                                      <FileText className="w-3 h-3" /> Đề Xuất Chi
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-700 bg-slate-900/80 font-sans">
                        <td className="px-3 py-3 font-extrabold text-white text-[11px] uppercase tracking-wider" colSpan={2}>
                          Tổng cộng ({liabilityPageInfo.total} đơn vị)
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-black text-amber-400">
                          {liabilityPageInfo.totals.openingDebt > 0 ? `${liabilityPageInfo.totals.openingDebt.toLocaleString('vi-VN')} đ` : '—'}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-black text-slate-100">
                          {liabilityPageInfo.totals.value.toLocaleString('vi-VN')} đ
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-black text-violet-400">
                          {liabilityPageInfo.totals.tongGiaTri.toLocaleString('vi-VN')} đ
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-black text-emerald-400">
                          -{liabilityPageInfo.totals.paid.toLocaleString('vi-VN')} đ
                        </td>
                        <td className={`px-3 py-3 text-right font-mono font-black ${liabilityPageInfo.totals.remaining < 0 ? 'text-emerald-400 bg-emerald-500/5' : 'text-rose-400 bg-rose-500/5'}`}>
                          {liabilityPageInfo.totals.remaining >= 0 ? `${liabilityPageInfo.totals.remaining.toLocaleString('vi-VN')} đ` : `-${Math.abs(liabilityPageInfo.totals.remaining).toLocaleString('vi-VN')} đ`}
                        </td>
                        <td className="px-3 py-3"></td>
                        <td className="px-3 py-3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Phân trang + Tổng cộng (tính trên toàn bộ danh sách lọc, không chỉ trang hiện tại) */}
                <div className="flex flex-wrap items-center justify-between gap-3 mt-3 text-[10px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <span>Hiển thị</span>
                    <select value={liabilityPageSize} onChange={(e) => setLiabilityPageSize(Number(e.target.value))} className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 outline-none cursor-pointer">
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                    <span>khoản nợ/trang</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Trang {liabilityPageInfo.safePage}/{liabilityPageInfo.totalPages} · {liabilityPageInfo.total} đơn vị</span>
                    <button type="button" disabled={liabilityPageInfo.safePage <= 1} onClick={() => setLiabilityPage(p => Math.max(1, p - 1))} className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 cursor-pointer">‹ Trước</button>
                    <button type="button" disabled={liabilityPageInfo.safePage >= liabilityPageInfo.totalPages} onClick={() => setLiabilityPage(p => Math.min(liabilityPageInfo.totalPages, p + 1))} className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 cursor-pointer">Sau ›</button>
                  </div>
                </div>

              </div>
            )}

            {/* ── Modal: Sửa phiếu thu (Nhập Thu thủ công) ──────────────── */}
            {editingReceipt && (
              <div className="fixed inset-0 z-[60] bg-slate-950/80 flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-extrabold text-sm">
                      Sửa Phiếu Thu {editingReceipt.code}
                    </h3>
                    <button onClick={() => setEditingReceipt(null)} className="text-slate-400 hover:text-white">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="space-y-4 text-xs">
                    <div>
                      <label className="block text-slate-400 font-bold mb-1">Ngày lập phiếu</label>
                      <input type="date" value={editRecDate} onChange={e => setEditRecDate(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold focus:border-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold mb-1">Số tiền (đ) <span className="text-red-400">*</span></label>
                      <input type="number" value={editRecAmount} onChange={e => setEditRecAmount(Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold focus:border-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold mb-1">Hình thức</label>
                      <select value={editRecMethod} onChange={e => setEditRecMethod(e.target.value as 'cash' | 'transfer')} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold focus:border-blue-500 outline-none">
                        <option value="cash">Tiền mặt</option>
                        <option value="transfer">Chuyển khoản</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold mb-1">Ghi chú</label>
                      <textarea value={editRecNotes} onChange={e => setEditRecNotes(e.target.value)} rows={3} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold focus:border-blue-500 outline-none resize-none" />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button onClick={() => setEditingReceipt(null)} className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-4 py-2 rounded-lg cursor-pointer">
                        Hủy
                      </button>
                      <button onClick={handleSaveEditReceipt} className="bg-amber-600 hover:bg-amber-555 text-white font-bold px-4 py-2 rounded-lg cursor-pointer">
                        Lưu thay đổi
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Modal: Sửa phiếu chi (Nhập Chi thủ công) ──────────────── */}
            {editingPayment && (
              <div className="fixed inset-0 z-[60] bg-slate-950/80 flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-extrabold text-sm">
                      Sửa Phiếu Chi {editingPayment.code}
                    </h3>
                    <button onClick={() => setEditingPayment(null)} className="text-slate-400 hover:text-white">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="space-y-4 text-xs">
                    <div>
                      <label className="block text-slate-400 font-bold mb-1">Ngày lập phiếu</label>
                      <input type="date" value={editPayDate} onChange={e => setEditPayDate(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold focus:border-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold mb-1">Số tiền (đ) <span className="text-red-400">*</span></label>
                      <input type="number" value={editPayAmount} onChange={e => setEditPayAmount(Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold focus:border-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold mb-1">Hình thức</label>
                      <select value={editPayMethod} onChange={e => setEditPayMethod(e.target.value as 'cash' | 'transfer' | 'cash_fund')} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold focus:border-blue-500 outline-none">
                        <option value="cash">Tiền mặt</option>
                        <option value="transfer">Chuyển khoản</option>
                        <option value="cash_fund">Quỹ tiền mặt</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold mb-1">Nhóm chi</label>
                      <select value={editPayCategory} onChange={e => setEditPayCategory(e.target.value as Payment['category'])} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold focus:border-blue-500 outline-none">
                        <option value="supplier_payment">Thanh toán NCC</option>
                        <option value="subcontractor_payment">Thanh toán Thầu Phụ</option>
                        <option value="advance_payment">Tạm ứng</option>
                        <option value="expense">Chi phí khác</option>
                        <option value="salary">Lương</option>
                        <option value="travel_expense">Công tác phí</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold mb-1">Ghi chú</label>
                      <textarea value={editPayNotes} onChange={e => setEditPayNotes(e.target.value)} rows={3} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold focus:border-blue-500 outline-none resize-none" />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button onClick={() => setEditingPayment(null)} className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-4 py-2 rounded-lg cursor-pointer">
                        Hủy
                      </button>
                      <button onClick={handleSaveEditPayment} className="bg-amber-600 hover:bg-amber-555 text-white font-bold px-4 py-2 rounded-lg cursor-pointer">
                        Lưu thay đổi
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Modal: Xem trước / In Phiếu Thu - Phiếu Chi ───────────── */}
            {previewVoucher && (
              <VoucherPrintModal
                open={!!previewVoucher}
                onClose={() => setPreviewVoucher(null)}
                type={previewVoucher.type}
                data={previewVoucher.data}
                businessInfo={businessInfo}
                meta={previewVoucher.meta}
              />
            )}

            {/* ── Modal: Danh sách phiếu thu theo công trình ── */}
            {receiptDetail && (
              <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-5 shadow-2xl relative text-slate-200">
                  <button
                    onClick={() => setReceiptDetail(null)}
                    className="absolute right-4 top-4 text-slate-400 hover:text-white cursor-pointer bg-slate-800 hover:bg-slate-700 w-7 h-7 rounded-full flex items-center justify-center"
                  >
                    ✕
                  </button>
                  <h3 className="font-extrabold text-white text-sm mb-3 pr-8">{receiptDetail.title}</h3>
                  {receiptDetail.receipts.length === 0 ? (
                    <div className="text-center text-slate-400 py-10 text-[12px]">Chưa có phiếu thu nào cho công trình này.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-800 text-slate-400 font-bold">
                          <tr>
                            <th className="px-2 py-2">Mã PT</th>
                            <th className="px-2 py-2">Ngày</th>
                            <th className="px-2 py-2 text-right">Số tiền</th>
                            <th className="px-2 py-2">Người thu</th>
                            <th className="px-2 py-2">Ghi chú</th>
                            <th className="px-2 py-2 text-center">Xem</th>
                          </tr>
                        </thead>
                        <tbody>
                          {receiptDetail.receipts.map(rec => (
                            <tr key={rec.id} className="border-b border-slate-800 hover:bg-slate-800/40">
                              <td className="px-2 py-2 font-mono">{rec.code}</td>
                              <td className="px-2 py-2 whitespace-nowrap">{rec.date}</td>
                              <td className="px-2 py-2 text-right font-mono text-emerald-400">+{rec.amount?.toLocaleString('vi-VN')} đ</td>
                              <td className="px-2 py-2 whitespace-nowrap">{rec.collector || '—'}</td>
                              <td className="px-2 py-2 truncate max-w-[180px]" title={rec.notes}>{rec.notes || '-'}</td>
                              <td className="px-2 py-2 text-center">
                                <button
                                  onClick={() => setPreviewVoucher({ type: 'receipt', data: rec, meta: { payer: undefined, project: rec.projectId, collector: rec.collector } })}
                                  className="text-cyan-400 hover:text-cyan-300 p-1 cursor-pointer"
                                  title="Xem / in phiếu thu"
                                >
                                  👁️
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="font-bold text-emerald-400 border-t border-slate-700">
                            <td colSpan={2} className="px-2 py-2">TỔNG THU</td>
                            <td className="px-2 py-2 text-right font-mono">
                              {receiptDetail.receipts.reduce((s: number, r: any) => s + (r.amount || 0), 0).toLocaleString('vi-VN')} đ
                            </td>
                            <td colSpan={3}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
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
        </div>

      </div>

      {/* Custom Modal: Upload sao kê (bước Cập nhật chứng từ) */}
      {((voucherUploadProposal || voucherUploadPay) && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-[1000] p-4 text-left animate-fadeIn select-text"
          onClick={() => { setVoucherUploadProposal(null); setVoucherUploadPay(null); setVoucherUploadImages([]); }}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg text-slate-100 shadow-2xl overflow-hidden animate-scaleIn font-sans flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40 shrink-0">
              <span className="font-extrabold text-sm text-violet-400 uppercase tracking-wider flex items-center gap-1.5">
                <Upload className="w-5 h-5 text-violet-400" />
                CẬP NHẬT CHỨNG TỪ — UPLOAD SAO KÊ
              </span>
              <button type="button" onClick={() => { setVoucherUploadProposal(null); setVoucherUploadPay(null); setVoucherUploadImages([]); }} className="text-slate-400 hover:text-white cursor-pointer bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="text-[11px] text-slate-400 bg-slate-950/50 border border-slate-800 rounded-lg p-3">
                <div className="font-bold text-slate-200">
                  {voucherUploadPay ? 'Phiếu chi' : 'Đề xuất'}:{' '}
                  <span className="text-amber-400 font-mono">{voucherUploadPay?.code || voucherUploadProposal?.id}</span>
                </div>
                <div className="mt-1">Đối tượng: <span className="text-white font-semibold">{voucherUploadPay?.recipient || voucherUploadProposal?.subcontractorName}</span> · {(voucherUploadPay?.amount ?? voucherUploadProposal?.amount ?? 0).toLocaleString('vi-VN')} đ</div>
                <div className="mt-1 text-slate-500">Tải ảnh sao kê / biên lai ngân hàng đính kèm vào phiếu chi. Sau khi lưu, phiếu chi chuyển sang <b className="text-emerald-400">Hoàn Thành</b>.</div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-2">Hình ảnh sao kê (PNG/JPG/WEBP)</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={async (e) => {
                    const urls = await readImagesAsDataUrls(e.target.files);
                    setVoucherUploadImages(prev => [...prev, ...urls]);
                    e.target.value = '';
                  }}
                  className="block w-full text-[11px] text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-violet-600 file:text-white file:cursor-pointer hover:file:bg-violet-500 cursor-pointer"
                />
                <p className="text-[9px] text-slate-500 mt-1">Ảnh tự động chuyển thành Base64 lưu trữ offline (tương tự các module khác).</p>
              </div>

              {voucherUploadImages.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {voucherUploadImages.map((img, idx) => (
                    <div key={idx} className="relative group">
                      <img src={img} alt={`sao ke ${idx + 1}`} className="w-full h-20 object-cover rounded-lg border border-slate-700" />
                      <button
                        type="button"
                        onClick={() => setVoucherUploadImages(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute -top-2 -right-2 bg-rose-600 hover:bg-rose-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[11px] cursor-pointer shadow"
                        title="Xóa ảnh"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-800 flex items-center justify-end gap-2 bg-slate-950/40 shrink-0">
              <button type="button" onClick={() => { setVoucherUploadProposal(null); setVoucherUploadPay(null); setVoucherUploadImages([]); }} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold px-4 py-2 rounded-xl cursor-pointer transition-all">
                Hủy
              </button>
              <button
                type="button"
                disabled={voucherUploadImages.length === 0}
                onClick={handleSaveVoucherImages}
                className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-extrabold px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer transition-all shadow"
              >
                <Upload className="w-4 h-4" />
                Lưu & Hoàn Thành ({voucherUploadImages.length})
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Lightbox ảnh chứng từ (dùng chung Nhập Chi & modal Đề Xuất) */}
      {lightboxImages && lightboxImages.length > 0 && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[1000] p-4 text-left animate-fadeIn"
          onClick={() => setLightboxImages(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxImages(null)}
            className="absolute top-4 right-4 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-lg cursor-pointer z-10"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
          <div
            className="max-w-5xl max-h-[90vh] overflow-auto grid gap-3 sm:grid-cols-2"
            onClick={(e) => e.stopPropagation()}
          >
            {lightboxImages.map((img, idx) => (
              <img
                key={idx}
                src={img}
                alt={`chứng từ ${idx + 1}`}
                className="w-full h-auto max-h-[80vh] object-contain rounded-lg border border-slate-700 bg-black"
              />
            ))}
          </div>
        </div>
      )}

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
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-extrabold uppercase border ${PROPOSAL_TYPE_BADGE[viewingProposalDetail.type || ''] || 'bg-white text-slate-600 border-slate-400'}`}>
                      {proposalTypeLabel(viewingProposalDetail.type)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Trạng thái</span>
                    <span>{(() => {
                      switch (viewingProposalDetail.status) {
                        case 'pending_approval':
                          return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] px-2 py-0.5 rounded-full font-bold">Chờ Duyệt</span>;
                        case 'pending_payment':
                          return <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[10px] px-2 py-0.5 rounded-full font-bold font-sans">Chờ Lập Phiếu</span>;
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
                    <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Đối tượng chi</span>
                    <strong className="text-slate-200 text-sm">{viewingProposalDetail.subcontractorName}</strong>
                    {viewingProposalDetail.subcontractorId && viewingProposalDetail.subcontractorId !== 'expense_recipient' && (
                      <span className="text-slate-500 font-mono text-[10px] ml-1">({viewingProposalDetail.subcontractorId})</span>
                    )}
                    <div className="text-[9px] text-amber-400/90 font-semibold mt-1">→ Khi lập phiếu: {proposalTargetCatLabel(viewingProposalDetail)}</div>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Số tiền đề xuất</span>
                    <strong className="text-orange-400 font-mono text-base">{viewingProposalDetail.amount.toLocaleString('vi-VN')} đ</strong>
                  </div>
                </div>

                {/* Số tiền duyệt chi — người xét duyệt nhập; Người lập phiếu lập phiếu dựa vào đây.
                    Giữ "Số tiền đề xuất" bên trên làm tham chiếu lịch sử. */}
                <div className="pt-3 border-t border-slate-800/60">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Số tiền duyệt chi</span>
                    {viewingProposalDetail.status === 'pending_approval' && canApproveProposal(viewingProposalDetail) ? (
                      <span className="text-[9px] text-emerald-400 font-semibold">✍️ Nhập số tiền được duyệt</span>
                    ) : viewingProposalDetail.approvedAmount != null ? (
                      <span className="text-[9px] text-emerald-400 font-semibold">✅ Đã duyệt: {viewingProposalDetail.approvedAmount.toLocaleString('vi-VN')} đ</span>
                    ) : null}
                  </div>
                  {viewingProposalDetail.status === 'pending_approval' && canApproveProposal(viewingProposalDetail) ? (
                    <input
                      type="number"
                      min={0}
                      value={approveAmountInput}
                      onChange={(e) => setApproveAmountInput(e.target.value)}
                      className="w-full bg-slate-900 border border-emerald-600/50 rounded-lg px-3 py-2 text-emerald-300 font-mono font-bold text-sm outline-none focus:border-emerald-400 transition-colors"
                      placeholder="Nhập Số tiền duyệt chi"
                    />
                  ) : (
                    <strong className={`font-mono text-base ${viewingProposalDetail.approvedAmount != null ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {viewingProposalDetail.approvedAmount != null ? `${viewingProposalDetail.approvedAmount.toLocaleString('vi-VN')} đ` : 'Chưa duyệt (dùng Số tiền đề xuất)'}
                    </strong>
                  )}
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

                {/* Người lập phiếu & Người quyết toán (ghi nhận riêng, chỉ hiện khi có) */}
                {(viewingProposalDetail.payCreatorName || viewingProposalDetail.settlerName) && (
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                      <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Người lập phiếu</span>
                      <strong className="text-slate-300">{viewingProposalDetail.payCreatorName || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Người quyết toán</span>
                      <strong className="text-slate-300">{viewingProposalDetail.settlerName || '—'}</strong>
                    </div>
                  </div>
                )}

                {/* Nếu có các dòng chi tiết chi phí phát sinh */}
                {viewingProposalDetail.expenseItems && viewingProposalDetail.expenseItems.length > 0 && (
                  <div className="pt-3 border-t border-slate-800/60">
                    <span className="text-slate-400 block text-[10px] uppercase font-black tracking-wider mb-2">Bảng phân rã chi phí chi tiết</span>
                    <div className="border border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-900 text-slate-400 uppercase text-[9px] font-bold">
                          <tr>
                            <th className="p-2 pl-3">Mục chi tiêu</th>
                            <th className="p-2">Công trình</th>
                            <th className="p-2 text-right">Số tiền</th>
                            <th className="p-2 pr-3">Ghi chú</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {viewingProposalDetail.expenseItems.map((item, idx) => (
                            <tr key={item.id || idx} className="hover:bg-slate-900/40">
                              <td className="p-2 pl-3 font-bold text-slate-200">{item.item}</td>
                              <td className="p-2 text-slate-300">{item.projectName || '—'}</td>
                              <td className="p-2 text-right font-mono font-bold text-orange-400">{item.amount.toLocaleString('vi-VN')} đ</td>
                              <td className="p-2 pr-3 text-slate-400 italic text-[10px]">{item.note || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Sao kê / chứng từ đính kèm phiếu chi */}
                {(() => {
                  const linkedVoucher = payments.find(p => p.id === viewingProposalDetail.paymentId)
                    || payments.find(p => p.relatedAdvanceId === viewingProposalDetail.id);
                  if (!linkedVoucher || !linkedVoucher.images || linkedVoucher.images.length === 0) {
                    return viewingProposalDetail.status === 'awaiting_voucher_update' ? (
                      <div className="pt-3 border-t border-slate-800/60">
                        <span className="text-violet-400 block text-[10px] uppercase font-black tracking-wider mb-2">Sao kê / Chứng từ</span>
                        <button
                          type="button"
                          onClick={() => openVoucherUpload(viewingProposalDetail)}
                          className="bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-extrabold px-3 py-2 rounded-xl flex items-center gap-2 cursor-pointer transition-all shadow"
                        >
                          <Upload className="w-4 h-4" /> Upload Sao Kê (chưa có)
                        </button>
                      </div>
                    ) : null;
                  }
                  return (
                    <div className="pt-3 border-t border-slate-800/60">
                      <span className="text-violet-400 block text-[10px] uppercase font-black tracking-wider mb-2">Sao kê / Chứng từ ({linkedVoucher.images.length})</span>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {linkedVoucher.images.map((img, idx) => (
                          <img key={idx} src={img} alt={`sao ke ${idx + 1}`} onClick={() => setLightboxImages(linkedVoucher.images ?? [])} className="w-full h-24 object-cover rounded-lg border border-slate-700 cursor-pointer hover:opacity-80 transition-opacity" title="Click để phóng to" />
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-950/40 border-t border-slate-800 flex items-center justify-between gap-2 shrink-0 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => exportProposalPdf(viewingProposalDetail)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow transition-all"
                  title="Xuất Phiếu Đề Xuất dạng PDF (có header doanh nghiệp)"
                >
                  <Download className="w-4 h-4" /> Xuất PDF
                </button>
                {(() => {
                  const eff = (viewingProposalDetail.status === 'pending_payment' && payments.some(p => p.relatedAdvanceId === viewingProposalDetail.id))
                    ? 'awaiting_voucher_update'
                    : viewingProposalDetail.status;
                  if (eff === 'pending_approval' && canApproveProposal(viewingProposalDetail)) {
                    return (
                      <>
                        <button
                          type="button"
                          onClick={async () => {
                            const amt = (approveAmountInput !== '' && !isNaN(Number(approveAmountInput))) ? Number(approveAmountInput) : viewingProposalDetail.amount;
                            if (!window.confirm(`✅ Xác nhận duyệt Đề xuất ${viewingProposalDetail.id}?\nSố tiền duyệt chi: ${amt.toLocaleString('vi-VN')}đ`)) return;
                            await handleApprove(viewingProposalDetail, amt);
                            setViewingProposalDetail(null);
                          }}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow transition-all"
                        >
                          <Check className="w-4 h-4" /> Duyệt
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectProposalModal(viewingProposalDetail)}
                          className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow transition-all"
                        >
                          <X className="w-4 h-4" /> Từ Chối
                        </button>
                      </>
                    );
                  }
                  if (eff === 'pending_approval') {
                    return <span className="text-[10px] text-slate-500 italic">Đề xuất đang chờ người xét duyệt phê duyệt.</span>;
                  }
                  if (eff === 'pending_payment') {
                    return (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            const amt = (viewingProposalDetail.approvedAmount != null ? viewingProposalDetail.approvedAmount : viewingProposalDetail.amount);
                            if (!window.confirm(`🧾 Xác nhận lập phiếu chi cho Đề xuất ${viewingProposalDetail.id}?\nSố tiền: ${amt.toLocaleString('vi-VN')}đ`)) return;
                            handleCreateVoucherFromProposal(viewingProposalDetail);
                          }}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow transition-all"
                        >
                          <Plus className="w-4 h-4" /> Lập Phiếu
                        </button>
                        <button
                          type="button"
                          onClick={() => setRevertProposalModal(viewingProposalDetail)}
                          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow transition-all"
                        >
                          <X className="w-4 h-4" /> Từ Chối
                        </button>
                      </>
                    );
                  }
                  if (eff === 'awaiting_voucher_update') {
                    return (
                      <button
                        type="button"
                        onClick={() => openVoucherUpload(viewingProposalDetail)}
                        className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow transition-all"
                      >
                        <Upload className="w-4 h-4" /> Upload Sao Kê
                      </button>
                    );
                  }
                  if (eff === 'rejected') {
                    return (
                      <button
                        type="button"
                        onClick={() => handleDeleteProposal(viewingProposalDetail.id)}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow transition-all"
                      >
                        <Trash2 className="w-4 h-4" /> Xóa
                      </button>
                    );
                  }
                  if (eff === 'completed') {
                    return <span className="text-emerald-400 font-bold text-xs flex items-center gap-1.5"><Check className="w-4 h-4" /> Hoàn Tất</span>;
                  }
                  return null;
                })()}
              </div>
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

      {/* Custom Modal: Thùng rác Đề Xuất bị Từ Chối (tự xóa sau 30 ngày + khôi phục) */}
      {trashOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[999] p-4 text-left animate-fadeIn select-text"
          onClick={() => setTrashOpen(false)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl text-slate-100 shadow-2xl overflow-hidden animate-scaleIn font-sans max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <span className="font-extrabold text-sm text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <Trash2 className="w-5 h-5 text-rose-500" />
                Thùng rác — Đề Xuất bị Từ Chối ({rejectedProposals.length})
              </span>
              <button type="button" onClick={() => setTrashOpen(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3 overflow-y-auto">
              <p className="text-[11px] text-slate-300 leading-relaxed bg-rose-500/10 border border-rose-500/20 rounded-lg p-3">
                Các Đề Xuất bị Từ Chối sẽ <strong className="text-rose-300">tự động xóa vĩnh viễn sau 30 ngày</strong> kể từ lúc bị từ chối.
                Bạn có thể <strong className="text-emerald-300">khôi phục</strong> về một cột trong quy trình hoặc <strong className="text-rose-300">xóa ngay</strong>.
              </p>

              {rejectedProposals.length === 0 ? (
                <div className="text-center text-slate-500 text-[11px] py-8">Thùng rác trống.</div>
              ) : (
                <div className="space-y-2">
                  {rejectedProposals.map(p => (
                    <div key={p.id} className="bg-slate-950/50 border border-slate-800 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-mono font-bold text-amber-500 text-[11px] truncate">{p.id}</div>
                          <div className="text-slate-200 text-[12px] truncate">{p.subcontractorName}</div>
                          <div className="text-slate-500 text-[10px]">{p.projectName} · {p.amount.toLocaleString('vi-VN')} đ</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[9px] text-slate-500 uppercase">Tự xóa sau</div>
                          <div className={`text-[12px] font-black ${daysUntilDeletion(p) <= 7 ? 'text-rose-400' : 'text-amber-400'}`}>{daysUntilDeletion(p)} ngày</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <select
                          value={restoreTarget[p.id] || 'pending_approval'}
                          onChange={(e) => setRestoreTarget(prev => ({ ...prev, [p.id]: e.target.value as SubcontractorAdvanceProposal['status'] }))}
                          className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-200 outline-none cursor-pointer"
                        >
                          <option value="pending_approval">Chờ Duyệt</option>
                          <option value="pending_payment">Chờ Lập Phiếu</option>
                          <option value="awaiting_voucher_update">Cập Nhật Chứng Từ</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => restoreRejectedProposal(p)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCcw className="w-3.5 h-3.5" /> Khôi phục
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteRejectedNow(p)}
                          className="bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Xóa ngay
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                  setViewingProposalDetail(null);
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
                  setViewingProposalDetail(null);
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

      {/* MODAL: CHI TIẾT ĐƠN HÀNG (tab Đơn Hàng) — đồng bộ, cho sửa đơn giá */}
      {poDetailModal.open && poDetailModal.order && (() => {
        const o = poDetailModal.order;
        const recorded = isPoRecorded(o.id);
        const isFromWarehouse = (o as any).fromWarehouse || o.supplierId === WAREHOUSE_SOURCE_ID;
        const st = getPoRowStatus(o);
        const editing = poEditId === o.id;
        const displayItems = editing ? poEditItems : (o.items || []);
        const displayTong = editing ? (poEditItems || []).reduce((s: number, it: any) => s + (poItemTotal(it) || 0), 0) : (o.tongTien || 0);
        return (
          <div
            className="fixed inset-0 z-[9600] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setPoDetailModal({ open: false, order: null })}
          >
            <div
              className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 bg-slate-800/60 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-violet-400" />
                  <span className="font-black text-sm text-white uppercase">Chi tiết đơn hàng {o.id}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPoDetailModal({ open: false, order: null })}
                  className="text-slate-400 hover:text-white cursor-pointer bg-slate-800 hover:bg-slate-700 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                >
                  ✕
                </button>
              </div>
              <div className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-slate-400 font-bold text-[10px] uppercase">Mã Đề Xuất</label>
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs font-bold text-slate-100">{o.proposalCode || '—'}</div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-slate-400 font-bold text-[10px] uppercase">Nhà cung cấp</label>
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs font-bold text-slate-100">{o.supplierName || '—'}</div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-400 font-bold text-[10px] uppercase">Dự án / Công trình</label>
                  <div className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs font-bold text-sky-300 cursor-default">{o.projectName || '— Chưa gắn dự án —'}</div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold border ${poStatusToneClass(st.tone)}`}>{st.label}</span>
                  <span className="text-[10px] text-slate-500">Ngày tạo: {(o.createdAt || '').slice(0, 10) || '—'}</span>
                </div>
                {recorded && (
                  <div className="bg-amber-950/20 border border-amber-900/40 rounded-xl p-2.5 text-amber-300 text-[10px] font-semibold">
                    Đơn hàng đã ghi nhận vào Công nợ Trả — không thể sửa đơn giá hay xóa.
                  </div>
                )}
                <div className="space-y-1">
                  <label className="block text-slate-400 font-bold text-[10px] uppercase">
                    Danh mục vật tư {editing && <span className="text-amber-400 ml-1">(đang sửa đơn giá)</span>}
                  </label>
                  <div className="border border-slate-700 rounded-xl overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-slate-800/80 text-slate-400 font-bold text-[9px] uppercase">
                        <tr>
                          <th className="px-2 py-1.5 w-7 text-center">#</th>
                          <th className="px-2 py-1.5">Tên mặt hàng</th>
                          <th className="px-2 py-1.5 text-right w-14">Số lượng</th>
                          <th className="px-2 py-1.5 text-right w-24">Đơn giá</th>
                          <th className="px-2 py-1.5 text-right w-24">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(displayItems || []).length === 0 ? (
                          <tr><td colSpan={5} className="px-2 py-4 text-center text-[11px] text-slate-500">Đơn hàng chưa có vật tư.</td></tr>
                        ) : (displayItems || []).map((it: any, idx: number) => (
                          <tr key={idx} className="border-t border-slate-800">
                            <td className="px-2 py-2 text-center text-[10px] text-slate-500 font-mono">{idx + 1}</td>
                            <td className="px-2 py-2 text-[11px] font-semibold text-slate-200">{poItemName(it)} <span className="text-[9px] text-slate-500">{poItemUnit(it)}</span></td>
                            <td className="px-2 py-2 text-right text-[10px] font-mono text-slate-300">{poItemQty(it)}</td>
                            <td className="px-2 py-2 text-right">
                              {editing ? (
                                <PoPriceEditInput value={poItemPrice(it)} onCommit={(v) => handlePoItemPriceChange(idx, 'donGia', v)} />
                              ) : (
                                <span className="text-[10px] font-mono font-bold text-fuchsia-400">{poItemPrice(it).toLocaleString('vi-VN')} đ</span>
                              )}
                            </td>
                            <td className="px-2 py-2 text-right text-[10px] font-mono font-bold text-fuchsia-400">{(poItemTotal(it) || 0).toLocaleString('vi-VN')} đ</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-400 font-bold text-[10px] uppercase">Tổng tiền</label>
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm font-extrabold text-fuchsia-400">{displayTong.toLocaleString('vi-VN')} đ</div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-slate-400 font-bold text-[10px] uppercase">Ghi chú</label>
                    {!recorded && !poNotesEditing && (
                      <button type="button" onClick={() => { setPoNotesEdit(o.notes || ''); setPoNotesEditing(true); }} className="text-[10px] text-sky-400 hover:text-sky-300 cursor-pointer">Sửa</button>
                    )}
                  </div>
                  {poNotesEditing ? (
                    <div className="space-y-2">
                      <textarea
                        value={poNotesEdit}
                        onChange={(e) => setPoNotesEdit(e.target.value)}
                        rows={3}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 outline-none focus:border-sky-500 resize-none"
                        placeholder="Nhập ghi chú đơn hàng..."
                      />
                      <div className="flex gap-2">
                        <button type="button" onClick={handleSavePoNotes} className="flex-1 bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-black py-2 rounded-lg cursor-pointer transition-all">Lưu ghi chú</button>
                        <button type="button" onClick={() => { setPoNotesEditing(false); setPoNotesEdit(''); }} className="bg-slate-700 hover:bg-slate-600 text-white text-[11px] font-bold px-3 py-2 rounded-lg cursor-pointer transition-all">Hủy</button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-slate-300 whitespace-pre-line min-h-[2.5rem]">{o.notes || <span className="text-slate-600 italic">Chưa có ghi chú</span>}</div>
                  )}
                </div>
              </div>
              <div className="p-4 bg-slate-800/60 border-t border-slate-800 flex flex-wrap items-center gap-2">
                {!recorded && (
                  editing ? (
                    <div className="flex flex-1 gap-2">
                      <button
                        type="button"
                        onClick={handleSavePoPrices}
                        className="flex-1 bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-black py-2.5 rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-all"
                      >
                        <Check className="w-3.5 h-3.5" /> Lưu đơn giá
                      </button>
                      <button
                        type="button"
                        onClick={() => { setPoEditId(null); setPoEditItems([]); }}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-[11px] font-bold py-2.5 rounded-xl cursor-pointer transition-all"
                      >
                        Hủy sửa
                      </button>
                    </div>
                  ) : (
                    <>
                      {!isFromWarehouse && (
                        <button
                          type="button"
                          onClick={() => openPoPriceEdit(o)}
                          className="bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black py-2.5 px-3 rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-all"
                        >
                          <Edit className="w-3.5 h-3.5" /> Sửa đơn giá
                        </button>
                      )}
                      {!isFromWarehouse && (
                        <button
                          type="button"
                          onClick={() => { setPoDetailModal({ open: false, order: null }); handleDeletePoUnrecorded(o.id); }}
                          className="bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-extrabold px-3 py-2.5 rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Xóa
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => { if (onOpenMaterialProposal && o.proposalId) onOpenMaterialProposal(o.proposalId); }}
                        disabled={!o.proposalId}
                        className="bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-black px-3 py-2.5 rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        title={o.proposalId ? 'Mở chi tiết Đề Xuất Vật Tư' : 'Đơn này không liên kết Đề Xuất'}
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Chi tiết đơn hàng
                      </button>
                      {isFromWarehouse ? (
                        <span className="bg-teal-950/40 border border-teal-800/60 text-teal-300 text-[10px] font-bold px-3 py-2.5 rounded-xl flex items-center gap-1" title="Đơn nội bộ xuất từ Kho có sẵn — không phát sinh công nợ">
                          📦 Đơn nội bộ (Kho) — không công nợ
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setPoDetailModal({ open: false, order: null }); setPoRecordConfirm(o); }}
                          className="bg-orange-500 hover:bg-orange-400 text-white text-[11px] font-black px-3 py-2.5 rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-all"
                          title="Ghi nhận công nợ nhà cung cấp"
                        >
                          <Plus className="w-3.5 h-3.5" /> Ghi nhận Công nợ
                        </button>
                      )}
                    </>
                  )
                )}
                {recorded && (
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-[10px] font-semibold text-amber-300 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Đã ghi nhận Công nợ Trả
                    </span>
                    <button
                      type="button"
                      onClick={() => { setPoDetailModal({ open: false, order: null }); setPoUndoConfirm(o); }}
                      className="ml-auto bg-slate-700 hover:bg-rose-600 text-white text-[11px] font-bold px-3 py-2.5 rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-all"
                      title="Hoàn tác ghi nhận công nợ (dùng khi nhập sai thông tin đơn hàng)"
                    >
                      <RefreshCcw className="w-3.5 h-3.5" /> Hoàn tác
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setPoDetailModal({ open: false, order: null })}
                  className="ml-auto bg-slate-700 hover:bg-slate-600 text-white text-[11px] font-bold px-4 py-2.5 rounded-xl cursor-pointer transition-all"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: XÁC NHẬN GHI NHẬN CÔNG NỢ (cảnh báo nếu đơn chưa hoạt động) */}
      {poRecordConfirm && (() => {
        const ro = poRecordConfirm;
        const active = isOrderActive(ro);
        const amount = ro.congNo || ro.tongTien || 0;
        return (
          <div
            className="fixed inset-0 z-[9700] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setPoRecordConfirm(null)}
          >
            <div
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 bg-slate-800/60 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-400" />
                  <span className="font-black text-sm text-white uppercase">Xác nhận ghi nhận công nợ</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPoRecordConfirm(null)}
                  className="text-slate-400 hover:text-white cursor-pointer bg-slate-800 hover:bg-slate-700 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                >
                  ✕
                </button>
              </div>
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-slate-400 font-bold text-[10px] uppercase">Mã đơn hàng</label>
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs font-bold text-slate-100">{ro.id}</div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-slate-400 font-bold text-[10px] uppercase">Số tiền ghi nhận</label>
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs font-black text-orange-600">{amount.toLocaleString('vi-VN')} đ</div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-400 font-bold text-[10px] uppercase">Nhà cung cấp</label>
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs font-bold text-slate-100">{ro.supplierName || '—'}</div>
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-400 font-bold text-[10px] uppercase">Dự án</label>
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs font-bold text-sky-600">{ro.projectName || '— Chưa gắn dự án —'}</div>
                </div>
                <div className="bg-amber-950/30 border border-amber-800/60 rounded-xl p-2.5 text-amber-300 text-[10px] font-semibold">
                  ⚠️ Hãy kiểm tra lại số tiền trước khi ghi nhận vào Công nợ Trả.
                </div>
                {!active && (
                  <div className="bg-rose-950/30 border border-rose-900/50 rounded-xl p-2.5 text-rose-300 text-[10px] font-semibold">
                    ⚠️ Đơn hàng <b>{ro.status === 'cancelled' ? 'đã bị hủy' : 'chưa hoạt động (Nháp)'}</b>. Ghi nhận công nợ cho đơn chưa xác nhận có thể dẫn tới sai lệch sổ sách.
                  </div>
                )}
              </div>
              <div className="p-4 bg-slate-800/60 border-t border-slate-800 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setPoRecordConfirm(null); }}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold py-2.5 rounded-xl cursor-pointer transition-all"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={async () => { setPoRecordConfirm(null); await handleRecordSupplierDebt(ro); }}
                  className={`flex-1 text-[11px] font-black py-2.5 rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-all ${active ? 'bg-orange-500 hover:bg-orange-400 text-white' : 'bg-amber-500 hover:bg-amber-400 text-black'}`}
                >
                  <Check className="w-3.5 h-3.5" /> {active ? 'Xác nhận ghi nhận' : 'Vẫn ghi nhận'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: XÁC NHẬN HOÀN TÁC GHI NHẬN CÔNG NỢ (dùng khi nhập sai thông tin đơn hàng) */}
      {poUndoConfirm && (() => {
        const ro = poUndoConfirm;
        const amount = ro.congNo || ro.tongTien || 0;
        return (
          <div
            className="fixed inset-0 z-[9700] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setPoUndoConfirm(null)}
          >
            <div
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 bg-slate-800/60 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                  <span className="font-black text-sm text-white uppercase">Xác nhận hoàn tác ghi nhận công nợ</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPoUndoConfirm(null)}
                  className="text-slate-400 hover:text-white cursor-pointer bg-slate-800 hover:bg-slate-700 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                >
                  ✕
                </button>
              </div>
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-slate-400 font-bold text-[10px] uppercase">Mã đơn hàng</label>
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs font-bold text-slate-100">{ro.id}</div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-slate-400 font-bold text-[10px] uppercase">Số tiền đã ghi nhận</label>
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs font-black text-rose-600">{amount.toLocaleString('vi-VN')} đ</div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-400 font-bold text-[10px] uppercase">Nhà cung cấp</label>
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs font-bold text-slate-100">{ro.supplierName || '—'}</div>
                </div>
                <div className="bg-rose-950/30 border border-rose-900/50 rounded-xl p-2.5 text-rose-300 text-[10px] font-semibold">
                  ⚠️ Đơn hàng sẽ gỡ khỏi Công nợ Trả của {ro.supplierName || 'NCC'} và quay về trạng thái "Chưa ghi nhận". Dùng khi lỡ ghi nhận nhầm (vd nhập sai thông tin đơn hàng).
                </div>
              </div>
              <div className="p-4 bg-slate-800/60 border-t border-slate-800 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setPoUndoConfirm(null); }}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold py-2.5 rounded-xl cursor-pointer transition-all"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={async () => { setPoUndoConfirm(null); await handleUndoSupplierDebt(ro); }}
                  className="flex-1 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black py-2.5 rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-all"
                >
                  <RefreshCcw className="w-3.5 h-3.5" /> Xác nhận hoàn tác
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: TẠO PHIẾU CHI CHO NHÀ CUNG CẤP (từ dòng NCC) */}
      {poSupplierPay.open && (() => {
        const remaining = poSupplierPay.max;
        return (
          <div
            className="fixed inset-0 z-[9600] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setPoSupplierPay({ open: false, supplierName: '', max: 0 })}
          >
            <div
              className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 bg-slate-800/60 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Circle className="w-5 h-5 text-rose-400" />
                  <span className="font-black text-sm text-white uppercase">Tạo phiếu chi — {poSupplierPay.supplierName}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPoSupplierPay({ open: false, supplierName: '', max: 0 })}
                  className="text-slate-400 hover:text-white cursor-pointer bg-slate-800 hover:bg-slate-700 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                >
                  ✕
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="space-y-1">
                  <label className="block text-slate-400 font-bold text-[10px] uppercase">Nhà cung cấp (thụ hưởng)</label>
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs font-bold text-slate-100">{poSupplierPay.supplierName || '—'}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-slate-400 font-bold text-[10px] uppercase">Còn lại phải trả</label>
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs font-black text-rose-400">{remaining.toLocaleString('vi-VN')} đ</div>
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
                    className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 outline-none focus:border-rose-500 w-full cursor-pointer"
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
                    placeholder={`Thanh toán nhà cung cấp ${poSupplierPay.supplierName}`}
                    className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 outline-none focus:border-rose-500 w-full resize-none"
                  />
                </div>
              </div>
              <div className="p-4 bg-slate-800/60 border-t border-slate-800 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPoSupplierPay({ open: false, supplierName: '', max: 0 })}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-[11px] font-bold py-2.5 rounded-xl cursor-pointer transition-all"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleCreateSupplierPayment}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black py-2.5 rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-all"
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
