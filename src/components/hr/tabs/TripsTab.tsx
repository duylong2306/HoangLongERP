import React, { useState, useRef, useEffect } from 'react';
import { FileSpreadsheet, Trash2, Check, X, Search, ChevronDown, Pencil } from 'lucide-react';
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
        className="bg-slate-900 border border-slate-800 text-white rounded px-2.5 py-1 text-[11px] outline-none font-medium focus:border-amber-500 transition-colors cursor-pointer flex items-center gap-1 max-w-[180px]"
      >
        <span className="truncate max-w-[150px] text-left">
          {value === 'all' ? placeholder : selectedLabel}
        </span>
        <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-slate-950 border border-slate-800 rounded-lg shadow-xl overflow-hidden flex flex-col min-w-[220px]">
          <div className="p-2 border-b border-slate-800 flex items-center gap-1.5 bg-slate-900">
            <Search className="w-3 h-3 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              autoFocus
              className="w-full bg-transparent text-[10px] text-slate-200 outline-none placeholder-slate-550 border-none p-0 focus:ring-0"
            />
          </div>
          <div className="overflow-y-auto max-h-44 custom-scrollbar">
            <button
              type="button"
              onClick={() => { onChange('all'); setIsOpen(false); }}
              className={`w-full text-left px-2.5 py-1.5 text-[10px] font-medium hover:bg-slate-900 transition-colors ${
                value === 'all' ? 'bg-slate-900 text-sky-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {placeholder}
            </button>
            {filtered.length > 0 ? (
              filtered.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setIsOpen(false); }}
                  className={`w-full text-left px-2.5 py-1.5 text-[10px] font-medium hover:bg-slate-900 transition-colors ${
                    value === opt.value ? 'bg-slate-900 text-sky-400' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <span className="truncate block">{opt.label}</span>
                </button>
              ))
            ) : (
              <div className="p-3 text-[10px] text-slate-500 text-center">Không tìm thấy</div>
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
}: TripsTabProps) {
  // Phân trang: số dòng/trang + trang hiện tại
  const [pageSize, setPageSize] = useState(10);
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
  useEffect(() => { setCurrentPage(1); }, [selectedEmpFilter, selectedMonthFilter, selectedYearFilter, selectedProjectFilter, pageSize]);

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

  const visibleItems = travelExpensesSummary.filter(applyAllFilters);

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

  return (
    <div className="space-y-4">
      {/* BẢNG TỔNG HỢP CÔNG TÁC PHÍ */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
        {travelExpensesSummary.length === 0 ? (
          <div className="py-6 text-center text-slate-500 italic text-[11px]">
            Chưa có phát sinh khoản Công Tác Phí nào được ghi nhận.
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="py-6 text-center text-slate-500 italic text-[11px]">
            Không có phát sinh khoản Công Tác Phí nào phù hợp với bộ lọc đã chọn.
          </div>
        ) : (
          <>
            {/* THANH CÔNG CỤ TRÊN BẢNG: phân trang + chọn hàng loạt */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {/* Số dòng mỗi trang */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 text-[10px] font-bold uppercase">Hiển thị</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-800 text-white rounded px-1.5 py-0.5 text-[10px] outline-none font-medium focus:border-amber-500 cursor-pointer"
                  >
                    {[5, 10, 20, 50, 100].map(n => <option key={n} value={n}>{n} dòng</option>)}
                  </select>
                </div>
                {/* Chọn tất cả / bỏ chọn */}
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-slate-400 hover:text-white text-[10px] font-bold border border-slate-800 hover:border-slate-700 px-2 py-1 rounded cursor-pointer transition flex items-center gap-1"
                  title={allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả các dòng đang hiển thị'}
                >
                  <Check className="w-3 h-3" /> {allSelected ? 'Bỏ chọn' : 'Chọn tất cả'}
                </button>
                {/* Xóa hàng loạt */}
                {selectedRows.size > 0 && (
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    className="text-rose-400 hover:text-rose-300 text-[10px] font-bold bg-rose-950/30 border border-rose-500/20 px-2 py-1 rounded cursor-pointer transition flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Xóa {selectedRows.size} dòng đã chọn
                  </button>
                )}
                <span className="text-slate-500 text-[10px] font-mono italic">
                  Trang {currentPage}/{totalPages} • {visibleItems.length} dòng
                </span>
              </div>

              {/* Phân trang nút */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-2 py-1 rounded text-[10px] font-bold border border-slate-800 hover:border-slate-700 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  ← Trước
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                  .reduce<React.ReactNode[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - arr[idx - 1] > 1) acc.push(<span key={`ell-${p}`} className="px-1 text-slate-600 text-[10px]">…</span>);
                    acc.push(
                      <button
                        key={p}
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        className={`px-2 py-1 rounded text-[10px] font-bold border cursor-pointer transition ${
                          currentPage === p
                            ? 'bg-amber-500 text-slate-950 border-amber-500'
                            : 'border-slate-800 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        {p}
                      </button>
                    );
                    return acc;
                  }, [])}
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="px-2 py-1 rounded text-[10px] font-bold border border-slate-800 hover:border-slate-700 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  Sau →
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] border-collapse min-w-[1100px]">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">
                    <th className="py-2.5 px-2 w-8">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                        onChange={toggleSelectAll}
                        className="accent-amber-500 w-3.5 h-3.5 cursor-pointer"
                        title="Chọn tất cả các dòng đang hiển thị"
                      />
                    </th>
                    <th className="py-2.5 px-3">Mã THCTP</th>
                    <th className="py-2.5 px-3">Ngày Hoàn Thành</th>
                    <th className="py-2.5 px-3">Tên Dự Án</th>
                    <th className="py-2.5 px-3">Khách hàng</th>
                    <th className="py-2.5 px-3">Công Việc</th>
                    <th className="py-2.5 px-3">Nhiệm Vụ</th>
                    <th className="py-2.5 px-3">Nhân Viên</th>
                    <th className="py-2.5 px-3">Nội Dung</th>
                    <th className="py-2.5 px-3">Trạng Thái</th>
                    <th className="py-2.5 px-3">Xét Duyệt</th>
                    <th className="py-2.5 px-3 text-right">Số Tiền</th>
                    <th className="py-2.5 px-3 text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60">
                  {pageItems.map((item, idx) => {
                    const rowId = item.rowId || item.id;
                    const isSelected = selectedRows.has(rowId);
                    return (
                      <tr key={rowId || idx} className={`hover:bg-slate-850/40 transition ${isSelected ? 'bg-amber-500/5' : ''}`}>
                        <td className="py-2.5 px-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRow(rowId)}
                            className="accent-amber-500 w-3.5 h-3.5 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-amber-400">{item.code || item.id}</td>
                        <td className="py-2.5 px-3 text-slate-350">{item.completedDate}</td>
                        <td className="py-2.5 px-3 font-medium text-white max-w-[150px] truncate" title={item.projectName}>{item.projectName}</td>
                        <td className="py-2.5 px-3 text-slate-400 max-w-[120px] truncate" title={item.customerName}>{item.customerName}</td>
                        <td className="py-2.5 px-3 text-slate-330 max-w-[140px] truncate" title={item.taskName}>{item.taskName}</td>
                        <td className="py-2.5 px-3 text-emerald-400 font-medium max-w-[140px] truncate" title={item.missionName}>{item.missionName}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-200">{item.employeeName}</td>
                        <td className="py-2.5 px-3 text-slate-400 max-w-[150px] truncate" title={item.content}>{item.content}</td>
                        <td className="py-2.5 px-3">
                          {/* Badge nền trắng + viền/chữ theo màu trạng thái — dễ đọc hơn nền tối trước đây */}
                          {item.status === 'approved' || item.status === 'completed' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-white text-emerald-700 border border-emerald-500">
                              {ctpStatusLabel(item.status)}
                            </span>
                          ) : item.status === 'pending' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-white text-amber-700 border border-amber-500">
                              {ctpStatusLabel(item.status)}
                            </span>
                          ) : item.status === 'rejected' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-white text-red-700 border border-red-500">
                              {ctpStatusLabel(item.status)}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {item.status === 'pending' && canApprove && onApproveTravelExpense && (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onApproveTravelExpense(item.rowId || item.id, 'approved')}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9.5px] font-bold bg-white text-emerald-700 border border-emerald-500 hover:bg-emerald-50 cursor-pointer transition"
                                title="Duyệt công tác phí"
                              >
                                <Check className="w-3 h-3" /> Duyệt
                              </button>
                              <button
                                type="button"
                                onClick={() => onApproveTravelExpense(item.rowId || item.id, 'rejected')}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9.5px] font-bold bg-white text-red-700 border border-red-500 hover:bg-red-50 cursor-pointer transition"
                                title="Từ chối công tác phí"
                              >
                                <X className="w-3 h-3" /> Từ chối
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-extrabold text-amber-500">
                          {Number(item.amount).toLocaleString('vi-VN')} đ
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              className="p-1 text-sky-400 hover:text-sky-300 rounded transition cursor-pointer"
                              title="Sửa công tác phí này"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSingle(item)}
                              className="p-1 text-red-400 hover:text-red-300 rounded transition cursor-pointer"
                              title="Xóa công tác phí này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-950/40 border-t border-slate-800 font-bold">
                    <td colSpan={11} className="py-3 px-3 text-right text-slate-400 uppercase tracking-lighter font-extrabold">Tổng cộng:</td>
                    <td className="py-3 px-3 text-right text-amber-500 font-mono font-extrabold text-xs">
                      {visibleItems.reduce((sum, item) => sum + Number(item.amount || 0), 0).toLocaleString('vi-VN')} đ
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>

      {/* MODAL SỬA CÔNG TÁC PHÍ: chỉ cho sửa Nội dung + Số tiền */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-[120]" onClick={closeEditModal}>
          <div
            className="bg-slate-900 border border-slate-800 rounded-xl p-5 w-full max-w-sm space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Sửa Công Tác Phí</h3>
              <button type="button" onClick={closeEditModal} className="text-slate-500 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-[11px] text-slate-400">
              {editingItem.employeeName} • {editingItem.code || editingItem.id}
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Nội dung</label>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded px-2.5 py-1.5 text-[11px] outline-none focus:border-amber-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Số tiền (đ)</label>
              <input
                type="number"
                value={editAmount}
                onChange={(e) => setEditAmount(Number(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded px-2.5 py-1.5 text-[11px] outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={closeEditModal}
                className="px-3 py-1.5 rounded text-[11px] font-bold text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700 cursor-pointer transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-3 py-1.5 rounded text-[11px] font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer transition"
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
