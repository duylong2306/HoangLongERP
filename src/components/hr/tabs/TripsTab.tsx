import React, { useState, useRef, useEffect } from 'react';
import { Download, Trash2, Check, X, Search, ChevronDown, Pencil, Plus, RotateCcw } from 'lucide-react';
import { CTPStatus, ctpStatusLabel } from '../../../lib/travelExpenseStatus';

interface TripItem {
  id: string;
  rowId?: string;
  code?: string;
  employeeId?: string;
  empId?: string;
  employeeName: string;
  amount: number;
  period: string;
  completedDate?: string;
  projectName?: string;
  customerName?: string;
  taskName?: string;
  missionName?: string;
  content?: string;
  month?: string;
  fuelFee?: number;
  mealFee?: number;
  lodgeFee?: number;
  otherFee?: number;
  status?: CTPStatus;
}

interface TripsTabProps {
  travelExpensesSummary: TripItem[];
  selectedEmpFilter: string;
  setSelectedEmpFilter: (v: string) => void;
  selectedMonthFilter: string;
  setSelectedMonthFilter: (v: string) => void;
  selectedYearFilter: string;
  setSelectedYearFilter: (v: string) => void;
  selectedProjectFilter: string;
  setSelectedProjectFilter: (v: string) => void;
  handleExportExcel: () => void;
  setClearingState: (s: { isOpen: boolean; tableName: string; targetTab: string }) => void;
  onApproveTravelExpense?: (rowId: string, decision: 'approved' | 'rejected') => void;
  canApprove?: boolean;
  onDeleteTravelExpenses?: (rowIds: string[]) => void;
  onEditTravelExpense?: (rowId: string, updates: { content?: string; amount?: number }) => void;
  /** Danh sách tên dự án cho bộ lọc (kể cả dự án chưa có công tác phí). Không truyền → lấy từ chính danh sách công tác phí. */
  projectNames?: string[];
  /** Mở hộp "Thêm công tác phí". Không truyền → ẩn nút Thêm. */
  onAddTravelExpense?: () => void;
}

// ─── Bộ lọc tìm kiếm nhanh dạng combobox (gõ gần đúng → chọn) ───────────────
export function QuickSearchFilter({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) setQuery('');
  }, [isOpen]);

  const selectedLabel = options.find(o => o.value === value)?.label || '';

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-9 bg-white border border-slate-200 text-slate-800 rounded-xl px-3 text-[13px] font-bold outline-none focus:border-blue-400 cursor-pointer flex items-center gap-1.5 max-w-[200px]"
      >
        <span className="truncate max-w-[160px] text-left">
          {value === 'all' ? placeholder : selectedLabel}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-50 left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden flex flex-col min-w-[240px]">
          <div className="px-3 py-2 border-b border-slate-200 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              autoFocus
              className="w-full bg-transparent text-[13px] text-slate-800 outline-none placeholder-slate-400 border-none p-0 focus:ring-0"
            />
          </div>
          <div className="overflow-y-auto max-h-56">
            <button
              type="button"
              onClick={() => { onChange('all'); setIsOpen(false); }}
              className={`w-full text-left px-3 py-2 text-[13px] font-medium hover:bg-blue-50 transition-colors ${value === 'all' ? 'text-blue-700 bg-blue-50' : 'text-slate-500'}`}
            >
              {placeholder}
            </button>
            {filtered.length > 0 ? (
              filtered.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setIsOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-[13px] font-medium hover:bg-blue-50 transition-colors ${value === opt.value ? 'text-blue-700 bg-blue-50' : 'text-slate-700'}`}
                >
                  <span className="truncate block">{opt.label}</span>
                </button>
              ))
            ) : (
              <div className="p-3 text-xs text-slate-500 text-center">Không tìm thấy</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TripsTab({
  travelExpensesSummary,
  selectedEmpFilter,
  setSelectedEmpFilter,
  selectedMonthFilter,
  setSelectedMonthFilter,
  selectedYearFilter,
  setSelectedYearFilter,
  selectedProjectFilter,
  setSelectedProjectFilter,
  handleExportExcel,
  setClearingState,
  onApproveTravelExpense,
  canApprove = false,
  onDeleteTravelExpenses,
  onEditTravelExpense,
  projectNames,
  onAddTravelExpense,
}: TripsTabProps) {
  // Phân trang: số dòng/trang + trang hiện tại
  const [pageSize, setPageSize] = useState(10);
  // Chip lọc theo trạng thái xét duyệt ('' = tất cả)
  const [statusFilter, setStatusFilter] = useState<'' | 'pending' | 'approved' | 'rejected'>('');
  const [currentPage, setCurrentPage] = useState(1);

  // Chọn nhiều dòng để xóa hàng loạt
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Dòng đang được sửa (Nội dung + Số tiền) qua modal nhỏ
  const [editingItem, setEditingItem] = useState<TripItem | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editAmount, setEditAmount] = useState(0);

  const openEditModal = (item: TripItem) => {
    setEditingItem(item);
    setEditContent(item.content || '');
    setEditAmount(Number(item.amount) || 0);
  };

  const closeEditModal = () => setEditingItem(null);

  const handleSaveEdit = () => {
    if (!editingItem) return;
    const rowId = editingItem.rowId || editingItem.id;
    onEditTravelExpense?.(rowId, { content: editContent, amount: editAmount });
    closeEditModal();
  };

  const handleDeleteSingle = (item: TripItem) => {
    const rowId = item.rowId || item.id;
    if (window.confirm(`Bạn có chắc chắn muốn xóa công tác phí "${item.content || item.code || rowId}" của ${item.employeeName}?`)) {
      onDeleteTravelExpenses?.([rowId]);
    }
  };

  // Reset trang về 1 khi bộ lọc thay đổi
  useEffect(() => { setCurrentPage(1); }, [selectedEmpFilter, selectedMonthFilter, selectedYearFilter, selectedProjectFilter, statusFilter, pageSize]);

  // Lọc theo tất cả các bộ lọc đang chọn (nhân viên / dự án / tháng / năm)
  const applyAllFilters = (item: TripItem) => {
    if (selectedEmpFilter !== 'all' && item.employeeName !== selectedEmpFilter) return false;
    if (selectedProjectFilter !== 'all' && item.projectName !== selectedProjectFilter) return false;
    if (item.completedDate) {
      const parts = item.completedDate.split('/');
      if (parts.length === 3) {
        const itemMonth = String(parseInt(parts[1], 10));
        const itemYear = parts[2];
        if (selectedMonthFilter !== 'all' && itemMonth !== selectedMonthFilter) return false;
        if (selectedYearFilter !== 'all' && itemYear !== selectedYearFilter) return false;
      } else {
        const dateObj = new Date(item.completedDate);
        if (!isNaN(dateObj.getTime())) {
          const itemMonth = String(dateObj.getMonth() + 1);
          const itemYear = String(dateObj.getFullYear());
          if (selectedMonthFilter !== 'all' && itemMonth !== selectedMonthFilter) return false;
          if (selectedYearFilter !== 'all' && itemYear !== selectedYearFilter) return false;
        }
      }
    }
    return true;
  };

  // Lọc theo các bộ lọc chung (nhân viên/dự án/tháng/năm) → dùng để đếm số khoản theo từng trạng thái cho chip
  const baseItems = travelExpensesSummary.filter(applyAllFilters);
  // "Đã duyệt" gồm cả dữ liệu cũ trạng thái 'completed' (hiển thị như Đã duyệt)
  const statusGroup = (st?: string) => (st === 'completed' ? 'approved' : (st || ''));
  const statusCounts = {
    all: baseItems.length,
    pending: baseItems.filter(i => statusGroup(i.status) === 'pending').length,
    approved: baseItems.filter(i => statusGroup(i.status) === 'approved').length,
    rejected: baseItems.filter(i => statusGroup(i.status) === 'rejected').length,
  };
  const visibleItems = statusFilter ? baseItems.filter(i => statusGroup(i.status) === statusFilter) : baseItems;

  // Phân trang
  const totalPages = Math.max(1, Math.ceil(visibleItems.length / pageSize));
  const pageItems = visibleItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Kẹp trang hiện tại trong giới hạn (sau khi xóa hàng / đổi bộ lọc)
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const allRowIds = visibleItems.map(item => item.rowId || item.id).filter(Boolean) as string[];
  const allSelected = allRowIds.length > 0 && allRowIds.every(id => selectedRows.has(id));
  const someSelected = allRowIds.some(id => selectedRows.has(id));

  const toggleRow = (rowId: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (allSelected) {
        allRowIds.forEach(id => next.delete(id));
      } else {
        allRowIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedRows(new Set());

  const handleBulkDelete = () => {
    const toDelete = Array.from(selectedRows);
    if (toDelete.length === 0) return;
    if (window.confirm(`Bạn có chắc chắn muốn xóa ${toDelete.length} công tác phí đã chọn?`)) {
      onDeleteTravelExpenses?.(toDelete);
      clearSelection();
    }
  };

  // ── Hiển thị dùng chung ──
  const money = (n?: number) => `${Number(n || 0).toLocaleString('vi-VN')} đ`;
  const PILL = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-bold whitespace-nowrap';
  const inputCls = 'h-9 bg-white border border-slate-200 text-slate-800 rounded-xl px-2.5 text-[13px] font-bold outline-none focus:border-blue-400 cursor-pointer';
  const iconBtn = 'w-8 h-8 inline-flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer';
  const empNames = Array.from(new Set(travelExpensesSummary.map(i => i.employeeName).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'vi'));
  const projNames = Array.from(new Set([...(projectNames || []), ...travelExpensesSummary.map(i => i.projectName).filter(Boolean) as string[]])).sort((a, b) => a.localeCompare(b, 'vi'));
  const resetFilters = () => { setSelectedEmpFilter('all'); setSelectedProjectFilter('all'); setSelectedMonthFilter('all'); setSelectedYearFilter('all'); setStatusFilter(''); };
  const pendingAmount = baseItems.filter(i => statusGroup(i.status) === 'pending').reduce((sum, i) => sum + Number(i.amount || 0), 0);

  const StatusPill = ({ item }: { item: TripItem }) => {
    const g = statusGroup(item.status);
    if (!g || !ctpStatusLabel(item.status)) return <span className="text-slate-300">—</span>;
    const cls = g === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : g === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200';
    return <span className={`${PILL} ${cls}`}>{ctpStatusLabel(item.status)}</span>;
  };
  // Nút Duyệt (chính, xanh LoLo) / Từ chối (viền đỏ) — chỉ khi khoản đang chờ duyệt và người dùng có quyền xét duyệt
  const ApproveButtons = ({ item }: { item: TripItem }) => {
    if (!(item.status === 'pending' && canApprove && onApproveTravelExpense)) return null;
    const rowId = item.rowId || item.id;
    return (
      <div className="flex items-center gap-1.5 mt-1.5">
        <button type="button" title="Duyệt công tác phí" data-testid={`trip-approve-${rowId}`}
          onClick={(e) => { e.stopPropagation(); onApproveTravelExpense(rowId, 'approved'); }}
          style={{ background: '#0d47c9', color: '#ffffff' }} className="h-7 px-2.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer"><Check className="w-3 h-3" /> Duyệt</button>
        <button type="button" title="Từ chối công tác phí" data-testid={`trip-reject-${rowId}`}
          onClick={(e) => { e.stopPropagation(); onApproveTravelExpense(rowId, 'rejected'); }}
          className="h-7 px-2.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 cursor-pointer"><X className="w-3 h-3" /> Từ chối</button>
      </div>
    );
  };
  const RowActions = ({ item }: { item: TripItem }) => {
    const rowId = item.rowId || item.id;
    return (
      <div className="inline-flex items-center gap-1.5">
        <button type="button" className={iconBtn} title="Sửa công tác phí này" aria-label="Sửa công tác phí" data-testid={`trip-edit-${rowId}`}
          onClick={(e) => { e.stopPropagation(); openEditModal(item); }}><Pencil className="w-3.5 h-3.5" /></button>
        <button type="button" title="Xóa công tác phí này" aria-label="Xóa công tác phí" data-testid={`trip-delete-${rowId}`}
          className="w-8 h-8 inline-flex items-center justify-center rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
          onClick={(e) => { e.stopPropagation(); handleDeleteSingle(item); }}><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    );
  };

  const tiles: Array<[string, string, string, string]> = [
    ['Số khoản', String(visibleItems.length), '#334155', 'Số khoản công tác phí đang hiển thị'],
    ['Tổng số tiền', money(visibleItems.reduce((sum, i) => sum + Number(i.amount || 0), 0)), '#0d47c9', 'Tổng tiền các khoản đang hiển thị'],
    ['Chờ duyệt', money(pendingAmount), '#b45309', 'Tổng tiền các khoản đang chờ duyệt (theo bộ lọc nhân viên/dự án/kỳ)'],
  ];

  return (
    <div className="space-y-3" data-testid="trips-root">
      {/* ── THANH CÔNG CỤ: lọc nhân viên / dự án / tháng / năm; nút chính (xanh LoLo) là "Thêm công tác phí" ── */}
      <div className="flex flex-wrap items-center gap-2" data-testid="trips-toolbar">
        <QuickSearchFilter value={selectedEmpFilter} onChange={setSelectedEmpFilter} placeholder="Tất cả nhân viên"
          options={empNames.map(n => ({ value: n, label: n }))} />
        <QuickSearchFilter value={selectedProjectFilter} onChange={setSelectedProjectFilter} placeholder="Tất cả dự án"
          options={projNames.map(n => ({ value: n, label: n }))} />
        <select value={selectedMonthFilter} onChange={(e) => setSelectedMonthFilter(e.target.value)} aria-label="Tháng" data-testid="trips-month" className={inputCls}>
          <option value="all">Mọi tháng</option>
          {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(m => <option key={m} value={m}>Tháng {m}</option>)}
        </select>
        <select value={selectedYearFilter} onChange={(e) => setSelectedYearFilter(e.target.value)} aria-label="Năm" data-testid="trips-year" className={inputCls}>
          <option value="all">Mọi năm</option>
          {['2024', '2025', '2026', '2027'].map(y => <option key={y} value={y}>Năm {y}</option>)}
        </select>
        <button type="button" onClick={resetFilters} title="Đặt lại bộ lọc" aria-label="Đặt lại bộ lọc" data-testid="trips-reset"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"><RotateCcw className="w-4 h-4" /></button>
        <span className="flex-1" />
        <button type="button" onClick={handleExportExcel} title="Xuất file báo cáo Excel" aria-label="Xuất Excel" data-testid="trips-export"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"><Download className="w-4 h-4" /></button>
        {onAddTravelExpense && (
          <button type="button" onClick={onAddTravelExpense} title="Thêm công tác phí mới" data-testid="trips-add"
            // Nền xanh đặt inline vì index.css ép màu cho bg-* / text-white
            style={{ background: '#0d47c9', color: '#ffffff' }}
            className="h-9 px-3.5 rounded-xl flex items-center gap-1.5 text-[13px] font-bold cursor-pointer">
            <Plus className="w-4 h-4" /><span className="hidden sm:inline">Thêm công tác phí</span><span className="sm:hidden">Thêm</span>
          </button>
        )}
      </div>

      {/* Chip trạng thái xét duyệt kèm huy hiệu số lượng; "Chờ duyệt" có khoản thì huy hiệu đỏ */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5" data-testid="trips-chips">
        {([['', 'Tất cả', statusCounts.all], ['pending', 'Chờ duyệt', statusCounts.pending], ['approved', 'Đã duyệt', statusCounts.approved], ['rejected', 'Từ chối', statusCounts.rejected]] as const).map(([k, label, n]) => {
          const on = statusFilter === k;
          const alert = k === 'pending' && n > 0;
          return (
            <button key={k || 'all'} type="button" data-testid={`trips-chip-${k || 'all'}`} onClick={() => setStatusFilter(k)}
              style={on ? { background: '#e8efff', color: '#0d47c9', borderColor: '#bcd0ff' } : undefined}
              className={`h-9 pl-3.5 pr-2 rounded-full text-[13px] font-bold whitespace-nowrap border cursor-pointer inline-flex items-center gap-2 ${on ? '' : 'bg-white text-slate-600 border-slate-200'}`}>
              {label}
              <span className="min-w-[24px] h-[22px] px-1.5 rounded-full text-xs leading-[22px] text-center font-black"
                style={alert ? { background: '#ef4444', color: '#ffffff' } : on ? { background: '#0d47c9', color: '#ffffff' } : { background: '#e2e8f0', color: '#475569' }}>{n}</span>
            </button>
          );
        })}
      </div>

      {travelExpensesSummary.length > 0 && (
        <div className="grid grid-cols-3 gap-2" data-testid="trips-summary">
          {tiles.map(([label, val, color, tip]) => (
            <div key={label} title={tip} className="bg-white border border-slate-200 rounded-xl px-3 py-2.5">
              <div className="text-[11px] text-slate-500 font-bold">{label}</div>
              <div className="text-base font-black mt-0.5 truncate" style={{ color }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Thanh thao tác hàng loạt — chỉ hiện khi đã tick chọn */}
      {selectedRows.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl border border-blue-200 bg-blue-50" data-testid="trips-bulkbar">
          <span className="text-[13px] font-bold" style={{ color: '#0d47c9' }}>Đã chọn {selectedRows.size}</span>
          <button type="button" onClick={clearSelection} className="text-xs font-bold text-slate-500 cursor-pointer">Bỏ chọn</button>
          <span className="flex-1" />
          <button type="button" onClick={handleBulkDelete} className="h-8 px-3 rounded-lg bg-white border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /> Xóa</button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {travelExpensesSummary.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-sm" data-testid="trips-empty">Chưa có khoản công tác phí nào được ghi nhận.</div>
        ) : visibleItems.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-sm" data-testid="trips-empty-filter">Không có khoản công tác phí nào khớp bộ lọc.</div>
        ) : (
          <>
            {/* MÁY TÍNH: bảng gọn — gộp Mã+Ngày, Dự án+Khách hàng, Công việc+Nhiệm vụ để khỏi kéo ngang */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]" data-testid="trips-table">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs">
                    <th className="px-3 py-2.5 w-10 text-center">
                      <input type="checkbox" checked={allSelected} aria-label="Chọn tất cả" className="w-4 h-4 rounded cursor-pointer"
                        ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }} onChange={toggleSelectAll}
                        title="Chọn tất cả các dòng đang hiển thị" />
                    </th>
                    <th className="px-3 py-2.5 font-bold">Mã / Ngày</th>
                    <th className="px-3 py-2.5 font-bold">Dự án</th>
                    <th className="px-3 py-2.5 font-bold">Công việc</th>
                    <th className="px-3 py-2.5 font-bold">Nhân viên</th>
                    <th className="px-3 py-2.5 font-bold">Nội dung</th>
                    <th className="px-3 py-2.5 font-bold">Trạng thái</th>
                    <th className="px-3 py-2.5 font-bold text-right">Số tiền</th>
                    <th className="px-3 py-2.5 font-bold text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((item, idx) => {
                    const rowId = item.rowId || item.id;
                    const isSelected = selectedRows.has(rowId);
                    return (
                      <tr key={rowId || idx} data-testid={`trip-row-${rowId}`} className={`border-b border-slate-100 align-top transition-colors hover:bg-blue-50/50 ${isSelected ? 'bg-blue-50' : ''}`}>
                        <td className="px-3 py-2.5 text-center">
                          <input type="checkbox" checked={isSelected} aria-label={`Chọn ${item.code || rowId}`} onChange={() => toggleRow(rowId)} className="w-4 h-4 rounded cursor-pointer" />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-mono text-xs font-bold text-slate-700">{item.code || item.id}</div>
                          <div className="font-mono text-[11px] text-slate-400">{item.completedDate}</div>
                        </td>
                        <td className="px-3 py-2.5 max-w-[200px]">
                          <div className="font-bold text-slate-900 truncate" title={item.projectName}>{item.projectName}</div>
                          <div className="text-[11px] text-slate-500 truncate" title={item.customerName}>{item.customerName}</div>
                        </td>
                        <td className="px-3 py-2.5 max-w-[200px]">
                          <div className="text-slate-800 truncate" title={item.taskName}>{item.taskName}</div>
                          <div className="text-[11px] text-slate-500 truncate" title={item.missionName}>{item.missionName}</div>
                        </td>
                        <td className="px-3 py-2.5 font-bold text-slate-900 whitespace-nowrap">{item.employeeName}</td>
                        <td className="px-3 py-2.5 text-slate-600 max-w-[180px] truncate" title={item.content}>{item.content}</td>
                        <td className="px-3 py-2.5"><StatusPill item={item} /><ApproveButtons item={item} /></td>
                        <td className="px-3 py-2.5 text-right font-mono text-sm font-black whitespace-nowrap" style={{ color: '#0d47c9' }}>{money(item.amount)}</td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap"><RowActions item={item} /></td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold text-xs">
                    <td colSpan={7} className="px-3 py-3 text-right text-slate-500">Tổng cộng ({visibleItems.length} khoản)</td>
                    <td className="px-3 py-3 text-right font-mono text-sm font-black" style={{ color: '#0d47c9' }}>
                      {money(visibleItems.reduce((sum, item) => sum + Number(item.amount || 0), 0))}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* ĐIỆN THOẠI: thẻ — không phải kéo ngang */}
            <div className="md:hidden" data-testid="trips-cards">
              <label className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 text-xs text-slate-600 font-bold cursor-pointer">
                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="w-4 h-4 rounded cursor-pointer" /> Chọn tất cả ({visibleItems.length})
              </label>
              {pageItems.map((item, idx) => {
                const rowId = item.rowId || item.id;
                const isSelected = selectedRows.has(rowId);
                return (
                  <div key={rowId || idx} data-testid={`trip-card-${rowId}`} className={`flex items-start gap-2.5 px-3 py-3 border-b border-slate-100 last:border-b-0 ${isSelected ? 'bg-blue-50' : ''}`}>
                    <input type="checkbox" checked={isSelected} aria-label={`Chọn ${item.code || rowId}`} onChange={() => toggleRow(rowId)} className="w-4 h-4 rounded cursor-pointer mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-slate-900 text-sm leading-snug">{item.employeeName}</div>
                        <div className="font-mono text-sm font-black whitespace-nowrap" style={{ color: '#0d47c9' }}>{money(item.amount)}</div>
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">{item.projectName}{item.taskName ? ` · ${item.taskName}` : ''}</div>
                      {item.content && <div className="text-xs text-slate-500 mt-0.5">{item.content}</div>}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
                        <StatusPill item={item} />
                        <span className="font-mono text-[11px] text-slate-400">{item.code || item.id} · {item.completedDate}</span>
                      </div>
                      <ApproveButtons item={item} />
                      <div className="flex justify-end mt-1.5"><RowActions item={item} /></div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Chân bảng: số lượng + phân trang + số dòng mỗi trang */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-t border-slate-200 text-xs text-slate-500">
              <span>{visibleItems.length} khoản</span>
              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button type="button" disabled={currentPage <= 1} aria-label="Trang trước" onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="h-8 px-2.5 rounded-lg bg-white border border-slate-200 text-slate-600 font-bold disabled:opacity-30 disabled:pointer-events-none cursor-pointer">Trước</button>
                  <span className="px-1">Trang <strong>{currentPage}</strong> / {totalPages}</span>
                  <button type="button" disabled={currentPage >= totalPages} aria-label="Trang sau" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="h-8 px-2.5 rounded-lg bg-white border border-slate-200 text-slate-600 font-bold disabled:opacity-30 disabled:pointer-events-none cursor-pointer">Sau</button>
                </div>
              )}
              <label className="flex items-center gap-1.5">
                <span>Hiển thị</span>
                <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}
                  className="h-8 bg-white border border-slate-200 text-slate-700 px-2 rounded-lg text-xs cursor-pointer outline-none font-bold">
                  {[5, 10, 20, 50, 100].map(n => <option key={n} value={n}>{n} dòng</option>)}
                </select>
              </label>
            </div>
          </>
        )}
      </div>

      {/* HỘP SỬA CÔNG TÁC PHÍ: chỉ cho sửa Nội dung + Số tiền */}
      {editingItem && (
        <div className="fixed inset-0 flex items-center justify-center z-[120] p-4" style={{ background: 'rgba(15,23,42,.5)' }} onClick={closeEditModal} data-testid="trips-edit-modal">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 w-full max-w-sm space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">Sửa công tác phí</h3>
              <button type="button" onClick={closeEditModal} aria-label="Đóng" className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="text-xs text-slate-500">{editingItem.employeeName} · <span className="font-mono">{editingItem.code || editingItem.id}</span></div>
            <label className="block text-xs font-bold text-slate-600">Nội dung
              <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={2} data-testid="trips-edit-content"
                className="mt-1 w-full bg-white border border-slate-200 text-slate-800 rounded-xl px-3 py-2 text-[13px] outline-none focus:border-blue-400" />
            </label>
            <label className="block text-xs font-bold text-slate-600">Số tiền (đ)
              <input type="number" value={editAmount} onChange={(e) => setEditAmount(Number(e.target.value) || 0)} data-testid="trips-edit-amount"
                className="mt-1 w-full h-10 bg-white border border-slate-200 text-slate-800 rounded-xl px-3 text-[13px] font-mono outline-none focus:border-blue-400" />
            </label>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={closeEditModal} className="flex-1 h-10 rounded-xl bg-white border border-slate-200 text-slate-700 text-[13px] font-bold cursor-pointer">Hủy</button>
              <button type="button" onClick={handleSaveEdit} data-testid="trips-edit-save" style={{ background: '#0d47c9', color: '#ffffff' }} className="flex-1 h-10 rounded-xl text-[13px] font-bold cursor-pointer">Lưu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
