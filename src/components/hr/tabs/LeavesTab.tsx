import React, { useMemo, useState } from 'react';
import TablePagination, { hrGlobalSize } from '../../TablePagination';
import { Trash2, CalendarClock, Search, RotateCcw, X } from 'lucide-react';
import { findPairedAbsenceReport, groupPendingAbsencePairs } from '../../../lib/leaveRequests';
import { parseLateNotice } from '../../../lib/leaveNotice';
import { isShiftLeave, shiftLabel } from '../../../lib/leaveShift';

interface LeaveItem {
  id: string;
  empId: string;
  empName: string;
  type: string;
  fromDate: string;
  toDate: string;
  daysCount: number;
  status: 'approved' | 'rejected' | 'pending';
  reason?: string;
  approverName?: string;
  approverPosition?: string;
  submittedAt?: string;
  shift?: string;   // 'morning' | 'afternoon' — chỉ có ở đơn báo cáo chấm công theo ca
}

interface LeavesTabProps {
  leaves: LeaveItem[];
  selectedLeaveId: string | null;
  setSelectedLeaveId: (v: string | null) => void;
  handleApproveLeave: (id: string, decision: 'approved' | 'rejected') => void;
  /** Người đang đăng nhập có được duyệt/từ chối đơn này không (theo Quyền Phê Duyệt). Không truyền → như cũ (hiện cho mọi người). */
  canApproveLeave?: (leave: any) => boolean;
  onDeleteLeave: (id: string) => void;
  /** Đổi ngày đơn ĐÃ DUYỆT (hoán ngày nghỉ). Trả true nếu lưu được → đóng hộp sửa. Không truyền → ẩn nút Sửa ngày. */
  onRescheduleLeave?: (id: string, newFrom: string, newTo: string) => boolean;
  globalPageSize: number | 'all';
  setGlobalPageSize: (v: number | 'all') => void;
  leavePage: number;
  setLeavePage: (v: number | ((prev: number) => number)) => void;
}

// Khoảng ngày mặc định của bộ lọc: đầu năm nay đến hôm nay.
const getDefaultFromDate = () => `${new Date().getFullYear()}-01-01`;
const getDefaultToDate = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Bỏ dấu tiếng Việt để so khớp tìm kiếm "gần đúng" (không phân biệt hoa/thường, có dấu/không dấu).
const normalizeSearchText = (s: string): string =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();

export default function LeavesTab({
  leaves,
  selectedLeaveId,
  setSelectedLeaveId,
  handleApproveLeave,
  canApproveLeave,
  onDeleteLeave,
  onRescheduleLeave,
  globalPageSize,
  setGlobalPageSize,
  leavePage,
  setLeavePage,
}: LeavesTabProps) {
  // Hộp "Sửa ngày" của đơn đã duyệt: id đơn đang sửa + ngày nhập
  const [editDates, setEditDates] = useState<{ id: string; from: string; to: string } | null>(null);

  // ── Multi-row selection ──
  const [leaveSelectedRows, setLeaveSelectedRows] = useState<Set<string>>(new Set());
  const [leaveSelectAll, setLeaveSelectAll] = useState(false);

  // ── Bộ lọc: Từ ngày - Đến ngày, tìm theo tên (gần đúng), loại phép, trạng thái ──
  const [filterFromDate, setFilterFromDate] = useState(getDefaultFromDate);
  const [filterToDate, setFilterToDate] = useState(getDefaultToDate);
  const [filterName, setFilterName] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Danh sách "Loại phép" lấy trực tiếp từ dữ liệu đang có (không phụ thuộc cấu
  // hình hệ số nghỉ phép — tránh thiếu loại nếu cấu hình chưa cập nhật đủ).
  const leaveTypeOptions = useMemo(() => {
    const set = new Set<string>();
    leaves.forEach(l => { if (l.type) set.add(l.type); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [leaves]);

  // Lọc theo mọi điều kiện TRỪ trạng thái → dùng để đếm số đơn trên từng chip trạng thái
  const baseLeaves = useMemo(() => {
    const kw = normalizeSearchText(filterName);
    return leaves.filter(l => {
      // Đơn nào chạm vào khoảng lọc (giao nhau với [fromDate, toDate]) đều được giữ.
      if (filterFromDate && l.toDate < filterFromDate) return false;
      if (filterToDate && l.fromDate > filterToDate) return false;
      if (filterType && l.type !== filterType) return false;
      if (kw && !normalizeSearchText(l.empName).includes(kw)) return false;
      return true;
    });
  }, [leaves, filterFromDate, filterToDate, filterType, filterName]);

  // Số đơn theo trạng thái (cặp "Cả ngày" đang chờ duyệt tính là 1 đơn, giống số dòng hiển thị)
  const statusCounts = useMemo(() => {
    const vis = groupPendingAbsencePairs(baseLeaves).visible;
    return {
      all: vis.length,
      pending: vis.filter(l => l.status === 'pending').length,
      approved: vis.filter(l => l.status === 'approved').length,
      rejected: vis.filter(l => l.status === 'rejected').length,
    };
  }, [baseLeaves]);

  const filteredLeaves = useMemo(
    () => (filterStatus ? baseLeaves.filter(l => l.status === filterStatus) : baseLeaves),
    [baseLeaves, filterStatus]
  );

  // "Báo cáo nghỉ ca" sáng + chiều cùng ngày (cùng nhân viên) đang chờ duyệt → gộp thành 1 dòng "Cả ngày" (ẩn dòng ca chiều);
  // Duyệt/Từ chối/Xóa ở dòng này áp dụng cho cả hai đơn. `pairOf`: mã đơn ca sáng → mã đơn ca chiều.
  const { visible: visibleLeaves, pairOf } = useMemo(() => groupPendingAbsencePairs(filteredLeaves), [filteredLeaves]);

  const resetFilters = () => {
    setFilterFromDate(getDefaultFromDate());
    setFilterToDate(getDefaultToDate());
    setFilterName('');
    setFilterType('');
    setFilterStatus('');
    setLeavePage(1);
  };

  const paginatedLeaves = (() => {
    const startIndex = (leavePage - 1) * (globalPageSize === 'all' ? visibleLeaves.length : (globalPageSize as number));
    const endIndex = globalPageSize === 'all' ? visibleLeaves.length : startIndex + (globalPageSize as number);
    return visibleLeaves.slice(startIndex, endIndex);
  })();

  const handleLeaveSelectAll = (checked: boolean) => {
    if (checked) setLeaveSelectedRows(new Set(paginatedLeaves.map(l => l.id)));
    else setLeaveSelectedRows(new Set());
    setLeaveSelectAll(checked);
  };

  const handleLeaveRowSelect = (id: string, checked: boolean) => {
    setLeaveSelectedRows(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleBulkDeleteLeaves = () => {
    if (leaveSelectedRows.size === 0) return;
    // Dòng "Cả ngày" đại diện cho 2 đơn → xóa kèm đơn ca chiều của cặp
    const idsToDelete = new Set<string>(leaveSelectedRows);
    leaveSelectedRows.forEach(id => { const sib = pairOf.get(id); if (sib) idsToDelete.add(sib); });
    if (!window.confirm(`⚠️ Bạn có chắc chắn muốn xóa ${idsToDelete.size} đơn nghỉ phép đã chọn không?\nHành động này không thể hoàn tác.`)) return;
    idsToDelete.forEach(id => onDeleteLeave(id));
    setLeaveSelectedRows(new Set());
    setLeaveSelectAll(false);
  };

  const handleDeleteSelectedLeave = (l: LeaveItem) => {
    const sibling = findPairedAbsenceReport(l, leaves);   // đơn đi cùng (ca sáng/chiều) nếu là cặp "Cả ngày" đang chờ duyệt
    if (!window.confirm(`⚠️ Bạn có chắc chắn muốn xóa đơn nghỉ phép "${l.id}"${sibling ? ` và đơn đi cùng "${sibling.id}" (báo cáo cả ngày)` : ''} của ${l.empName} không?\nHành động này không thể hoàn tác.`)) return;
    onDeleteLeave(l.id);
    if (sibling) onDeleteLeave(sibling.id);
    setSelectedLeaveId(null);
  };

  // ── Hiển thị dùng chung cho bảng (máy tính), thẻ (điện thoại) và thẻ chi tiết ──
  const fmtDate = (d?: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); return m ? `${m[3]}/${m[2]}/${m[1]}` : (d || '—'); };
  const range = (l: LeaveItem) => (l.fromDate === l.toDate ? fmtDate(l.fromDate) : `${fmtDate(l.fromDate)} → ${fmtDate(l.toDate)}`);
  const initials = (name: string) => (name || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();
  // Huy hiệu dùng chung (cùng kiểu với tab Chấm công): bo tròn hẳn, chữ 11px đậm, viền nhạt
  const PILL = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-bold whitespace-nowrap';
  const STATUS_META: Record<string, { label: string; cls: string }> = {
    approved: { label: 'Được duyệt', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    rejected: { label: 'Từ chối', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
    pending: { label: 'Chờ duyệt', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  };
  const StatusPill = ({ l }: { l: LeaveItem }) => { const m = STATUS_META[l.status] || STATUS_META.pending; return <span className={`${PILL} ${m.cls}`}>{m.label}</span>; };
  // Các nhãn phụ của đơn: Cả ngày / nghỉ 1 ca / ca của báo cáo / xin muộn
  const TypeTags = ({ l }: { l: LeaveItem }) => {
    const ln = parseLateNotice(l.reason);
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {pairOf.has(l.id)
          ? <span className={`${PILL} bg-sky-50 text-sky-700 border-sky-200`}>Cả ngày (sáng + chiều)</span>
          : isShiftLeave(l)
            // Nghỉ phép THẬT chỉ 1 ca: nhãn nổi bật để nhận ra ngay lịch nghỉ nửa ngày
            ? <span className={`${PILL} bg-sky-50 text-sky-700 border-sky-200`}>Nghỉ 1 {shiftLabel(l.shift)}</span>
            : ((l.type === 'Báo cáo nghỉ ca' || l.type === 'Báo cáo quên chấm công') && l.shift
              ? <span className={`${PILL} bg-slate-100 text-slate-600 border-slate-200`}>{l.shift === 'morning' ? 'Ca sáng' : 'Ca chiều'}</span> : null)}
        {ln.late && <span className={`${PILL} bg-amber-50 text-amber-700 border-amber-200`} title={ln.detail}>⚠ Xin muộn</span>}
      </div>
    );
  };
  const openRow = (id: string) => {
    setSelectedLeaveId(id);
    // Điện thoại: thẻ chi tiết nằm dưới danh sách → cuộn xuống cho người dùng thấy ngay
    if (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 1279px)').matches) {
      setTimeout(() => document.getElementById('hr-leave-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    }
  };
  const inputCls = 'h-9 bg-white border border-slate-200 text-slate-800 rounded-xl px-2.5 text-[13px] font-bold outline-none focus:border-blue-400';
  const pageSizeNum = globalPageSize === 'all' ? 0 : (globalPageSize as number);
  const totalPages = pageSizeNum ? Math.ceil(visibleLeaves.length / pageSizeNum) : 1;
  const InfoField = ({ label, value, mono, wide }: { label: string; value: React.ReactNode; mono?: boolean; wide?: boolean }) => (
    <div className={wide ? 'col-span-2' : ''}>
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`text-[13px] font-bold text-slate-900 mt-0.5 ${mono ? 'font-mono' : ''}`}>{value || '—'}</div>
    </div>
  );

  return (
    <div className="space-y-3" data-testid="leaves-root">
      {/* ── THANH CÔNG CỤ: tìm tên + loại phép + khoảng ngày; chip trạng thái bên dưới ── */}
      <div className="flex flex-wrap items-center gap-2" data-testid="leaves-toolbar">
        <div className="flex items-center gap-2 h-9 px-3 flex-1 min-w-[150px] bg-white border border-slate-200 rounded-xl">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input type="text" value={filterName} onChange={(e) => { setFilterName(e.target.value); setLeavePage(1); }}
            placeholder="Tìm tên nhân viên" data-testid="leaves-search"
            className="flex-1 min-w-0 bg-transparent text-[13px] border-none outline-none text-slate-800 placeholder-slate-400" />
        </div>
        <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setLeavePage(1); }} aria-label="Loại phép" data-testid="leaves-filter-type" className={`${inputCls} cursor-pointer`}>
          <option value="">Mọi loại phép</option>
          {leaveTypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="date" value={filterFromDate} onChange={(e) => { setFilterFromDate(e.target.value); setLeavePage(1); }} aria-label="Từ ngày" data-testid="leaves-from" className={`${inputCls} cursor-pointer`} />
        <input type="date" value={filterToDate} onChange={(e) => { setFilterToDate(e.target.value); setLeavePage(1); }} aria-label="Đến ngày" data-testid="leaves-to" className={`${inputCls} cursor-pointer`} />
        <button type="button" onClick={resetFilters} title="Đặt lại bộ lọc" aria-label="Đặt lại bộ lọc" data-testid="leaves-reset"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"><RotateCcw className="w-4 h-4" /></button>
        {selectedLeaveId && (
          <button type="button" onClick={() => setSelectedLeaveId(null)}
            className="h-9 px-3 rounded-xl flex items-center gap-1 text-[13px] font-bold cursor-pointer bg-white border border-slate-200 text-slate-600">
            <X className="w-4 h-4" /> Đóng chi tiết
          </button>
        )}
      </div>

      {/* Chip trạng thái kèm huy hiệu số lượng; "Chờ duyệt" có đơn thì huy hiệu đỏ để người duyệt thấy ngay */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5" data-testid="leaves-chips">
        {([['', 'Tất cả', statusCounts.all], ['pending', 'Chờ duyệt', statusCounts.pending], ['approved', 'Được duyệt', statusCounts.approved], ['rejected', 'Từ chối', statusCounts.rejected]] as const).map(([k, label, n]) => {
          const on = filterStatus === k;
          const alert = k === 'pending' && n > 0;
          return (
            <button key={k || 'all'} type="button" data-testid={`leaves-chip-${k || 'all'}`} onClick={() => { setFilterStatus(k); setLeavePage(1); }}
              style={on ? { background: '#e8efff', color: '#0d47c9', borderColor: '#bcd0ff' } : undefined}
              className={`h-9 pl-3.5 pr-2 rounded-full text-[13px] font-bold whitespace-nowrap border cursor-pointer inline-flex items-center gap-2 ${on ? '' : 'bg-white text-slate-600 border-slate-200'}`}>
              {label}
              <span className="min-w-[24px] h-[22px] px-1.5 rounded-full text-xs leading-[22px] text-center font-black"
                style={alert ? { background: '#ef4444', color: '#ffffff' } : on ? { background: '#0d47c9', color: '#ffffff' } : { background: '#e2e8f0', color: '#475569' }}>{n}</span>
            </button>
          );
        })}
      </div>

      {/* Thanh thao tác hàng loạt — chỉ hiện khi đã tick chọn */}
      {leaveSelectedRows.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl border border-blue-200 bg-blue-50" data-testid="leaves-bulkbar">
          <span className="text-[13px] font-bold" style={{ color: '#0d47c9' }}>Đã chọn {leaveSelectedRows.size}</span>
          <span className="flex-1" />
          <button type="button" onClick={handleBulkDeleteLeaves} className="h-8 px-3 rounded-lg bg-white border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /> Xóa</button>
        </div>
      )}

      {leaves.length === 0 ? (
        <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl text-sm text-slate-500" data-testid="leaves-empty">Chưa có đơn nghỉ phép nào.</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className={`${selectedLeaveId ? 'xl:col-span-7' : 'xl:col-span-12'} transition-all duration-300`}>
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              {/* MÁY TÍNH: bảng */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px]" data-testid="leaves-table">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs">
                      <th className="px-3 py-2.5 w-10 text-center">
                        <input type="checkbox" aria-label="Chọn tất cả" className="w-4 h-4 rounded cursor-pointer"
                          checked={leaveSelectAll && paginatedLeaves.length > 0 && paginatedLeaves.every(l => leaveSelectedRows.has(l.id))}
                          onChange={(e) => handleLeaveSelectAll(e.target.checked)} />
                      </th>
                      <th className="px-3 py-2.5 font-bold">Mã đơn</th>
                      <th className="px-3 py-2.5 font-bold">Nhân viên</th>
                      <th className="px-3 py-2.5 font-bold">Loại phép</th>
                      <th className="px-3 py-2.5 font-bold">Thời hạn nghỉ</th>
                      <th className="px-3 py-2.5 font-bold text-center">Số ngày</th>
                      <th className="px-3 py-2.5 font-bold text-center">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedLeaves.length === 0 ? (
                      <tr><td colSpan={7} className="py-10 text-center text-slate-500 text-sm">Không có đơn nào khớp bộ lọc.</td></tr>
                    ) : paginatedLeaves.map(l => (
                      <tr key={l.id} onClick={() => openRow(l.id)} data-testid={`leave-row-${l.id}`}
                        className={`border-b border-slate-100 cursor-pointer transition-colors hover:bg-blue-50/50 ${selectedLeaveId === l.id || leaveSelectedRows.has(l.id) ? 'bg-blue-50' : ''}`}>
                        <td className="px-3 py-2.5 text-center">
                          <input type="checkbox" aria-label={`Chọn đơn ${l.id}`} className="w-4 h-4 rounded cursor-pointer"
                            checked={leaveSelectedRows.has(l.id)} onClick={(e) => e.stopPropagation()}
                            onChange={(e) => handleLeaveRowSelect(l.id, e.target.checked)} />
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs font-bold text-slate-600">
                          {l.id}
                          {pairOf.has(l.id) && <span className="block text-[11px] font-normal text-slate-400">+ {pairOf.get(l.id)}</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-bold text-slate-900">{l.empName}</div>
                          <div className="font-mono text-[11px] text-slate-500">{l.empId}</div>
                        </td>
                        <td className="px-3 py-2.5 text-slate-700"><div className="font-medium">{l.type}</div><TypeTags l={l} /></td>
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-600 whitespace-nowrap">{range(l)}</td>
                        <td className="px-3 py-2.5 text-center font-mono text-xs font-bold text-slate-700 whitespace-nowrap">{l.daysCount} ngày</td>
                        <td className="px-3 py-2.5 text-center"><StatusPill l={l} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ĐIỆN THOẠI: thẻ — không phải kéo ngang */}
              <div className="md:hidden" data-testid="leaves-cards">
                {paginatedLeaves.length === 0 ? (
                  <div className="py-10 text-center text-slate-500 text-sm">Không có đơn nào khớp bộ lọc.</div>
                ) : paginatedLeaves.map(l => (
                  <div key={l.id} onClick={() => openRow(l.id)} data-testid={`leave-card-${l.id}`}
                    className={`flex items-start gap-2.5 px-3 py-3 border-b border-slate-100 last:border-b-0 cursor-pointer ${selectedLeaveId === l.id || leaveSelectedRows.has(l.id) ? 'bg-blue-50' : ''}`}>
                    <input type="checkbox" aria-label={`Chọn đơn ${l.id}`} className="w-4 h-4 rounded cursor-pointer mt-1"
                      checked={leaveSelectedRows.has(l.id)} onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleLeaveRowSelect(l.id, e.target.checked)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-slate-900 text-sm leading-snug">{l.empName}</div>
                        <StatusPill l={l} />
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">{l.type} · {l.daysCount} ngày</div>
                      <TypeTags l={l} />
                      <div className="flex flex-wrap items-center gap-x-2 mt-1 text-[11px] text-slate-500 font-mono">
                        <span>{range(l)}</span><span>{l.id}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Chân bảng: thanh phân trang chung */}
              <TablePagination total={visibleLeaves.length} page={leavePage} onPage={setLeavePage}
                {...hrGlobalSize(globalPageSize, setGlobalPageSize)} unit="đơn" testId="leaves-pager" />
            </div>
          </div>

          {/* ── THẺ CHI TIẾT (bên phải trên máy tính, dưới danh sách trên điện thoại) ── */}
          {selectedLeaveId && (() => {
            const l = leaves.find(x => x.id === selectedLeaveId);
            if (!l) return null;
            const canAct = !canApproveLeave || canApproveLeave(l);   // có quyền duyệt đơn này không
            const sibling = findPairedAbsenceReport(l, leaves);
            return (
              <div id="hr-leave-detail" data-testid="leave-detail" className="xl:col-span-5 bg-white border border-slate-200 rounded-2xl p-4 space-y-4 relative xl:sticky xl:top-6 animate-fade-in shadow-sm text-[11px]">
                {/* ĐẦU THẺ: ảnh chữ cái + tên + mã/loại + trạng thái; nút đóng bên phải */}
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: '#e8efff', color: '#0d47c9' }}>{initials(l.empName)}</div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black text-base text-slate-900 leading-snug">{l.empName}</h4>
                    <p className="text-xs text-slate-600">{l.empId} · {l.type}</p>
                    <div className="flex items-center gap-2 mt-1.5"><StatusPill l={l} /><span className="font-mono text-[11px] text-slate-500">{l.id}</span></div>
                  </div>
                  <button type="button" onClick={() => setSelectedLeaveId(null)} aria-label="Đóng chi tiết" title="Đóng chi tiết" data-testid="leave-detail-close"
                    className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 cursor-pointer"><X className="w-4 h-4" /></button>
                </div>

                {/* Nút thao tác: Sửa ngày (chỉ đơn đã duyệt + có quyền) và Xóa */}
                <div className="flex items-center gap-2">
                  {l.status === 'approved' && onRescheduleLeave && canAct && (
                    <button type="button" onClick={() => setEditDates({ id: l.id, from: l.fromDate, to: l.toDate })} title="Sửa ngày nghỉ (hoán ngày)" data-testid="leave-reschedule"
                      className="h-9 px-3.5 rounded-xl text-[13px] font-bold flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"><CalendarClock className="w-4 h-4" /> Sửa ngày</button>
                  )}
                  <span className="flex-1" />
                  <button type="button" onClick={() => handleDeleteSelectedLeave(l)} title="Xóa đơn nghỉ phép này" aria-label="Xóa đơn nghỉ phép này" data-testid="leave-delete"
                    className="w-9 h-9 rounded-xl flex items-center justify-center bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                </div>

                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="text-[11px] font-black uppercase tracking-wide text-slate-400 mb-2">Thông tin nghỉ phép</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                    <InfoField wide label="Loại phép" value={`${l.type}${isShiftLeave(l) ? ` — chỉ nghỉ ${shiftLabel(l.shift)} (0,5 ngày)` : ''}`} />
                    <InfoField label="Từ ngày" value={fmtDate(l.fromDate)} mono />
                    <InfoField label="Đến ngày" value={fmtDate(l.toDate)} mono />
                    <InfoField label="Tổng số ngày" value={`${l.daysCount} ngày`} mono />
                    <InfoField label="Người xét duyệt" value={`${l.approverName || 'Mặc định Quản lý'}${l.approverPosition ? ` (${l.approverPosition})` : ''}`} />
                    {l.submittedAt && <InfoField wide label="Ngày tạo đơn" value={l.submittedAt} mono />}
                  </div>
                </div>

                {editDates && editDates.id === l.id && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2" data-testid="leave-edit-dates">
                    <div className="text-[11px] font-black uppercase tracking-wide text-amber-700">Sửa ngày nghỉ (hoán ngày)</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <label className="block text-slate-600 font-bold">Từ ngày
                        <input type="date" aria-label="Từ ngày mới" value={editDates.from}
                          onChange={e => setEditDates({ ...editDates, from: e.target.value, to: isShiftLeave(l) ? e.target.value : editDates.to })}
                          className={`${inputCls} mt-0.5 w-full font-mono`} />
                      </label>
                      {/* Đơn nghỉ 1 ca chỉ có 1 ngày → không cho chọn "Đến ngày" */}
                      {!isShiftLeave(l) && (
                        <label className="block text-slate-600 font-bold">Đến ngày
                          <input type="date" aria-label="Đến ngày mới" value={editDates.to}
                            onChange={e => setEditDates({ ...editDates, to: e.target.value })}
                            className={`${inputCls} mt-0.5 w-full font-mono`} />
                        </label>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">Ngày cũ được trả về chưa nghỉ, ngày mới ghi nghỉ. Số ngày và phép năm tự tính lại.</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setEditDates(null)}
                        className="flex-1 h-9 rounded-xl bg-white border border-slate-200 text-slate-700 text-[13px] font-bold cursor-pointer">Hủy</button>
                      <button type="button" onClick={() => { if (onRescheduleLeave?.(l.id, editDates.from, editDates.to)) setEditDates(null); }}
                        style={{ background: '#0d47c9', color: '#ffffff' }} className="flex-1 h-9 rounded-xl text-[13px] font-bold cursor-pointer">Lưu ngày mới</button>
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 p-3 space-y-2">
                  <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">Lý do nghỉ phép</div>
                  {(() => {
                    // Đơn xin nghỉ nộp thiếu thời gian báo trước (theo Cấu Hình Ca) được đánh dấu trong lý do → hiện cảnh báo + lý do gốc
                    const ln = parseLateNotice(l.reason);
                    return (
                      <>
                        {ln.late && <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">⚠ XIN MUỘN — {ln.detail}. Người duyệt cân nhắc khi quyết định.</p>}
                        <p className="text-[13px] text-slate-700 italic">"{ln.reason}"</p>
                      </>
                    );
                  })()}
                </div>

                {l.status === 'pending' && !canAct && (
                  <p className="text-xs text-slate-500 pt-2 border-t border-slate-200" data-testid="leave-not-approver">
                    ⏳ Chờ {l.approverName || 'người xét duyệt'} xét duyệt — tài khoản của bạn không phải người xét duyệt đơn này.
                  </p>
                )}
                {l.status === 'pending' && canAct && (
                  <div className="space-y-2 pt-3 border-t border-slate-200">
                    {sibling && (
                      <p className="text-xs text-sky-700 bg-sky-50 border border-sky-200 rounded-lg p-2">
                        Đây là báo cáo <strong>CẢ NGÀY</strong>: đi cùng đơn <span className="font-mono">{sibling.id}</span> ({sibling.shift === 'morning' ? 'ca sáng' : 'ca chiều'}).
                        Duyệt hoặc Từ chối sẽ áp dụng cho cả hai đơn.
                      </p>
                    )}
                    {/* Duyệt là nút chính (xanh LoLo), Từ chối là nút viền đỏ */}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => handleApproveLeave(l.id, 'rejected')} data-testid="leave-reject"
                        className="flex-1 h-10 rounded-xl bg-white border border-rose-200 text-rose-700 text-[13px] font-bold cursor-pointer hover:bg-rose-50">
                        {sibling ? 'Từ chối cả ngày' : 'Từ chối đơn xin'}
                      </button>
                      <button type="button" onClick={() => handleApproveLeave(l.id, 'approved')} data-testid="leave-approve"
                        style={{ background: '#0d47c9', color: '#ffffff' }} className="flex-1 h-10 rounded-xl text-[13px] font-bold cursor-pointer">
                        {sibling ? 'Duyệt cả ngày ✅' : 'Duyệt phép ✅'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
