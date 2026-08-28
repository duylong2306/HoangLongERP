import React, { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';

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
}

interface LeavesTabProps {
  leaves: LeaveItem[];
  selectedLeaveId: string | null;
  setSelectedLeaveId: (v: string | null) => void;
  handleApproveLeave: (id: string, decision: 'approved' | 'rejected') => void;
  onDeleteLeave: (id: string) => void;
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
  onDeleteLeave,
  globalPageSize,
  setGlobalPageSize,
  leavePage,
  setLeavePage,
}: LeavesTabProps) {
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

  const filteredLeaves = useMemo(() => {
    const kw = normalizeSearchText(filterName);
    return leaves.filter(l => {
      // Đơn nào chạm vào khoảng lọc (giao nhau với [fromDate, toDate]) đều được giữ.
      if (filterFromDate && l.toDate < filterFromDate) return false;
      if (filterToDate && l.fromDate > filterToDate) return false;
      if (filterType && l.type !== filterType) return false;
      if (filterStatus && l.status !== filterStatus) return false;
      if (kw && !normalizeSearchText(l.empName).includes(kw)) return false;
      return true;
    });
  }, [leaves, filterFromDate, filterToDate, filterType, filterStatus, filterName]);

  const resetFilters = () => {
    setFilterFromDate(getDefaultFromDate());
    setFilterToDate(getDefaultToDate());
    setFilterName('');
    setFilterType('');
    setFilterStatus('');
    setLeavePage(1);
  };

  const paginatedLeaves = (() => {
    const startIndex = (leavePage - 1) * (globalPageSize === 'all' ? filteredLeaves.length : (globalPageSize as number));
    const endIndex = globalPageSize === 'all' ? filteredLeaves.length : startIndex + (globalPageSize as number);
    return filteredLeaves.slice(startIndex, endIndex);
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
    if (!window.confirm(`⚠️ Bạn có chắc chắn muốn xóa ${leaveSelectedRows.size} đơn nghỉ phép đã chọn không?\nHành động này không thể hoàn tác.`)) return;
    leaveSelectedRows.forEach(id => onDeleteLeave(id));
    setLeaveSelectedRows(new Set());
    setLeaveSelectAll(false);
  };

  const handleDeleteSelectedLeave = (l: LeaveItem) => {
    if (!window.confirm(`⚠️ Bạn có chắc chắn muốn xóa đơn nghỉ phép "${l.id}" của ${l.empName} không?\nHành động này không thể hoàn tác.`)) return;
    onDeleteLeave(l.id);
    setSelectedLeaveId(null);
  };

  return (
    <div className="space-y-4">
      {/* Bộ lọc */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-slate-400 font-bold text-[9px] uppercase tracking-wide">Từ ngày</label>
          <input
            type="date"
            value={filterFromDate}
            onChange={(e) => { setFilterFromDate(e.target.value); setLeavePage(1); }}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] text-slate-200 outline-none focus:border-amber-500 cursor-pointer"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-slate-400 font-bold text-[9px] uppercase tracking-wide">Đến ngày</label>
          <input
            type="date"
            value={filterToDate}
            onChange={(e) => { setFilterToDate(e.target.value); setLeavePage(1); }}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] text-slate-200 outline-none focus:border-amber-500 cursor-pointer"
          />
        </div>
        <div className="flex flex-col gap-1 min-w-[160px]">
          <label className="text-slate-400 font-bold text-[9px] uppercase tracking-wide">Tìm theo tên</label>
          <input
            type="text"
            value={filterName}
            onChange={(e) => { setFilterName(e.target.value); setLeavePage(1); }}
            placeholder="Gõ tên nhân viên..."
            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] text-slate-200 outline-none focus:border-amber-500"
          />
        </div>
        <div className="flex flex-col gap-1 min-w-[150px]">
          <label className="text-slate-400 font-bold text-[9px] uppercase tracking-wide">Loại phép</label>
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setLeavePage(1); }}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] text-slate-200 outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="">Tất cả</option>
            {leaveTypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1 min-w-[130px]">
          <label className="text-slate-400 font-bold text-[9px] uppercase tracking-wide">Trạng thái</label>
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setLeavePage(1); }}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] text-slate-200 outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="">Tất cả</option>
            <option value="pending">Chờ duyệt</option>
            <option value="approved">Được duyệt</option>
            <option value="rejected">Từ chối</option>
          </select>
        </div>
        <button
          type="button"
          onClick={resetFilters}
          className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[10px] font-bold px-2.5 py-1.5 rounded-lg cursor-pointer"
        >
          Đặt lại
        </button>
      </div>

      {leaves.length === 0 ? (
        <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl space-y-2">
          <div className="text-3xl">📬</div>
          <p className="text-xs text-slate-400 font-bold">Chưa có đơn đăng ký nghỉ phép nào được ghi nhận.</p>
          <p className="text-[10px] text-slate-500">Ấn "Tạo Đơn Phép" ở dòng trên để thêm mới.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left side: basic table layout */}
          <div className={`${selectedLeaveId ? 'xl:col-span-7' : 'xl:col-span-12'} space-y-4 transition-all duration-300`}>
            <div className="flex justify-between items-center bg-slate-900 p-3 rounded-xl border border-slate-800">
              <div className="text-xs font-bold text-slate-300">📬 Danh sách đơn xin nghỉ phép ({filteredLeaves.length})</div>
              {selectedLeaveId && (
                <button
                  onClick={() => setSelectedLeaveId(null)}
                  className="text-xs text-amber-500 hover:text-amber-400 font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  Đóng chi tiết ✕
                </button>
              )}
            </div>

            {filteredLeaves.length === 0 ? (
              <div className="p-6 text-center bg-slate-900 border border-slate-800 rounded-xl">
                <p className="text-xs text-slate-500 font-bold">Không có đơn nào khớp bộ lọc hiện tại.</p>
              </div>
            ) : (
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-[11px] overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-405">
                    <th className="pb-2 font-bold font-sans w-10 text-center">
                      <input
                        type="checkbox"
                        checked={leaveSelectAll && paginatedLeaves.length > 0 && paginatedLeaves.every(l => leaveSelectedRows.has(l.id))}
                        onChange={(e) => handleLeaveSelectAll(e.target.checked)}
                        className="w-4 h-4 text-amber-500 border-slate-600 rounded cursor-pointer"
                      />
                    </th>
                    <th className="pb-2 font-bold font-sans">Mã đơn</th>
                    <th className="pb-2 font-bold font-sans">Nhân viên</th>
                    <th className="pb-2 font-bold font-sans">Loại phép</th>
                    <th className="pb-2 font-bold font-sans text-center">Thời hạn nghỉ</th>
                    <th className="pb-2 font-bold font-sans text-center">Số ngày</th>
                    <th className="pb-2 font-bold font-sans text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {paginatedLeaves.map(l => (
                    <tr
                      key={l.id}
                      onClick={() => setSelectedLeaveId(l.id)}
                      className={`hover:bg-slate-950/45 cursor-pointer transition-colors ${selectedLeaveId === l.id ? 'bg-amber-600/10' : ''} ${leaveSelectedRows.has(l.id) ? 'bg-amber-500/10' : ''}`}
                    >
                      <td className="py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={leaveSelectedRows.has(l.id)}
                          onChange={(e) => { e.stopPropagation(); handleLeaveRowSelect(l.id, e.target.checked); }}
                          className="w-4 h-4 text-amber-500 border-slate-600 rounded cursor-pointer"
                        />
                      </td>
                      <td className="py-2.5 font-mono font-bold text-pink-400">{l.id}</td>
                      <td className="py-2.5 font-bold text-white hover:text-amber-400 transition-colors leading-none">
                        {l.empName}
                        <span className="block text-[8.5px] text-slate-400 font-mono mt-0.5">{l.empId}</span>
                      </td>
                      <td className="py-2.5 text-slate-300 font-medium">{l.type}</td>
                      <td className="py-2.5 text-slate-350 text-center font-mono">
                        {l.fromDate} ➔ {l.toDate}
                      </td>
                      <td className="py-2.5 text-slate-300 text-center font-bold font-mono">{l.daysCount} ngày</td>
                      <td className="py-2.5 text-center">
                        <span className={`inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                          l.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          l.status === 'rejected' ? 'bg-red-50 text-red-700 border border-red-200' :
                          'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {l.status === 'approved' && 'Được duyệt'}
                          {l.status === 'rejected' && 'Từ chối'}
                          {l.status === 'pending' && 'Chờ duyệt'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Leave Pagination helper */}
              {(() => {
                const totalFiltered = filteredLeaves.length;
                if (globalPageSize === 'all' || totalFiltered <= (globalPageSize as number)) return null;
                const totalPages = Math.ceil(totalFiltered / (globalPageSize as number));
                return (
                  <div className="flex justify-center items-center gap-1.5 mt-4 pt-4 border-t border-slate-850">
                    <button
                      type="button"
                      disabled={leavePage === 1}
                      onClick={(e) => { e.stopPropagation(); setLeavePage(prev => Math.max(prev - 1, 1)); }}
                      className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none text-xs font-bold transition-all cursor-pointer"
                    >
                      ◀ Trước
                    </button>
                    <span className="text-[11px] font-mono text-slate-400 px-2">
                      Trang <strong>{leavePage}</strong> / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={leavePage >= totalPages}
                      onClick={(e) => { e.stopPropagation(); setLeavePage(prev => Math.min(prev + 1, totalPages)); }}
                      className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none text-xs font-bold transition-all cursor-pointer"
                    >
                      Sau ▶
                    </button>
                  </div>
                );
              })()}

              {/* Bulk Actions */}
              {leaveSelectedRows.size > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 mb-4 flex justify-between items-center">
                  <span className="text-rose-700 font-bold">Đã chọn: {leaveSelectedRows.size} đơn</span>
                  <button
                    onClick={handleBulkDeleteLeaves}
                    className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors text-[11px] flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Xóa hàng loạt
                  </button>
                </div>
              )}

              {/* Global Row Selector inside Leaves footer */}
              <div className="flex justify-between items-center mt-3 pt-2 text-[10px] text-slate-500 border-t border-slate-850/50">
                <div>Hiển thị {globalPageSize === 'all' ? 'tất cả' : `${Math.min(globalPageSize as number, filteredLeaves.length)} / ${filteredLeaves.length} đơn phép`} mỗi trang.</div>
                <div className="flex items-center gap-1.5 font-bold text-white">
                  <span>Hiển thị:</span>
                  <select
                    value={globalPageSize.toString()}
                    onChange={(e) => {
                      const val = e.target.value;
                      const newSize = val === 'all' ? 'all' : parseInt(val, 10);
                      setGlobalPageSize(newSize);
                      localStorage.setItem('hl_global_page_size', val);
                    }}
                    className="bg-slate-950 border border-slate-800 text-slate-350 px-1.5 py-0.5 rounded text-[10px] cursor-pointer outline-none font-bold"
                  >
                    <option value="5">5 dòng</option>
                    <option value="10">10 dòng</option>
                    <option value="20">20 dòng</option>
                    <option value="50">50 dòng</option>
                    <option value="all">Tất cả</option>
                  </select>
                </div>
              </div>

            </div>
            )}
          </div>

          {/* Right side: sticky details sidebar panel */}
          {selectedLeaveId && (() => {
            const l = leaves.find(x => x.id === selectedLeaveId);
            if (!l) return null;

            return (
              <div className="xl:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-slate-300 relative sticky top-6 animate-fadeIn shadow-2xl text-[11px] border-l-4 border-l-amber-500 font-sans text-left">
                <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[9px] font-mono font-bold text-pink-400">{l.id} - {l.type}</span>
                    <h4 className="font-extrabold text-sm text-slate-100 mt-0.5">{l.empName}</h4>
                    <p className="text-[10px] text-slate-400">Mã NV: {l.empId}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleDeleteSelectedLeave(l)}
                      className="p-1 text-red-400 hover:text-red-300 rounded transition cursor-pointer"
                      title="Xóa đơn nghỉ phép này"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedLeaveId(null)}
                      className="p-1 text-slate-400 hover:text-white rounded transition cursor-pointer"
                      title="Đóng chi tiết"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-2">
                    <h5 className="font-extrabold text-[10px] text-amber-500 uppercase tracking-wider">Thông Tin Nghỉ Phép</h5>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs">
                      <div>Mã nhân viên: <strong className="text-slate-200 block mt-0.5 font-mono">{l.empId}</strong></div>
                      <div>Họ và tên: <strong className="text-slate-200 block mt-0.5 font-sans">{l.empName}</strong></div>
                      <div className="col-span-2">Loại phép đăng ký: <strong className="text-amber-400 block mt-0.5 font-medium">{l.type}</strong></div>
                      <div>Thời gian nghỉ: <strong className="text-slate-200 block mt-0.5 font-mono">{l.fromDate}</strong></div>
                      <div>Đến ngày: <strong className="text-slate-200 block mt-0.5 font-mono">{l.toDate}</strong></div>
                      <div>Tổng cộng số ngày: <strong className="text-white block mt-0.5 font-mono">{l.daysCount} ngày</strong></div>
                      <div>Người xét duyệt: <strong className="text-sky-400 block mt-0.5">{l.approverName || 'Mặc định Quản lý'}{l.approverPosition ? ` (${l.approverPosition})` : ''}</strong></div>
                      <div>Trạng thái đơn:
                        <strong className={`block mt-0.5 ${
                          l.status === 'approved' ? 'text-emerald-400' :
                          l.status === 'rejected' ? 'text-red-400' : 'text-amber-400'
                        }`}>
                          {l.status === 'approved' ? 'Đã duyệt' :
                           l.status === 'rejected' ? 'Bị từ chối' : 'Đang chờ duyệt'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-1.5">
                    <h5 className="font-extrabold text-[10px] text-amber-500 uppercase tracking-wider">Lý Do Nghỉ Phép</h5>
                    <p className="text-xs text-slate-300 italic">"{l.reason}"</p>
                    {l.submittedAt && (
                      <p className="text-[9.5px] text-slate-500 font-mono pt-1">📅 Ngày tạo đơn: {l.submittedAt}</p>
                    )}
                  </div>

                  {l.status === 'pending' && (
                    <div className="flex gap-2 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleApproveLeave(l.id, 'rejected')}
                        className="flex-1 bg-rose-600 hover:bg-rose-500 text-white text-[10.5px] font-bold py-2 rounded-lg cursor-pointer transition-colors"
                      >
                        Từ chối đơn xin
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApproveLeave(l.id, 'approved')}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10.5px] font-bold py-2 rounded-lg cursor-pointer transition-colors"
                      >
                        Duyệt phép ✅
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

        </div>
      )}
    </div>
  );
}
