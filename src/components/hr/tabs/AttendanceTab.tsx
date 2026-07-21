import React, { useState } from 'react';
import { Lock, FileSpreadsheet, FileUp, Download, Trash2 } from 'lucide-react';
import { readHrmConfigFromStorage, getAttendanceStatusText } from '../hrCalculations';
import { EmployeeProfile, LeaveCoefficient, Holiday, AttendanceLog, LeaveRequest } from '../hrTypes';

type ToastInput = { title: string; message: string; type?: 'success' | 'info' | 'warning' | 'error'; duration?: number };

interface AttendanceTabProps {
  employees: EmployeeProfile[];
  attendanceFiltered: AttendanceLog[];
  attendanceSearchEmpId: string;
  setAttendanceSearchEmpId: (v: string) => void;
  attendanceFilterMonth: string;
  setAttendanceFilterMonth: (v: string) => void;
  attendanceFilterYear: string;
  setAttendanceFilterYear: (v: string) => void;
  attendancePage: number;
  setAttendancePage: (v: number | ((prev: number) => number)) => void;
  globalPageSize: number | 'all';
  setGlobalPageSize: (v: number | 'all') => void;
  leaveCoefficients: LeaveCoefficient[];
  holidays: Holiday[];
  weekendDays: number[];
  leaves: LeaveRequest[];
  canManageLockedAttendance: () => boolean;
  setShowBulkLockModal: (v: boolean) => void;
  handleExportAttendanceExcel: () => void;
  handleImportAttendanceExcel: (e: React.ChangeEvent<HTMLInputElement>) => void;
  attendanceFileInputRef: React.RefObject<HTMLInputElement | null>;
  setZoomedImage: (v: string | null) => void;
  setEditingAttendance: (v: any) => void;
  handleDeleteAttendance: (log: any) => void;
  addToast: (t: ToastInput) => void;
  WorkdayCell: React.ComponentType<{
    log: any;
    leaveCoefficients: any[];
    holidays: any[];
    weekendDays: number[];
    leaves: any[];
  }>;
}

export default function AttendanceTab({
  employees,
  attendanceFiltered,
  attendanceSearchEmpId,
  setAttendanceSearchEmpId,
  attendanceFilterMonth,
  setAttendanceFilterMonth,
  attendanceFilterYear,
  setAttendanceFilterYear,
  attendancePage,
  setAttendancePage,
  globalPageSize,
  setGlobalPageSize,
  leaveCoefficients,
  holidays,
  weekendDays,
  leaves,
  canManageLockedAttendance,
  setShowBulkLockModal,
  handleExportAttendanceExcel,
  handleImportAttendanceExcel,
  attendanceFileInputRef,
  setZoomedImage,
  setEditingAttendance,
  handleDeleteAttendance,
  addToast,
  WorkdayCell,
}: AttendanceTabProps) {
  // ── Multi-row selection ──
  const [attSelectedRows, setAttSelectedRows] = useState<Set<string>>(new Set());
  const [attSelectAll, setAttSelectAll] = useState(false);

  const filteredAttendance = attendanceFiltered;
  const slicedAttendance = globalPageSize === 'all'
    ? filteredAttendance
    : filteredAttendance.slice((attendancePage - 1) * (globalPageSize as number), attendancePage * (globalPageSize as number));

  const handleAttSelectAll = (checked: boolean) => {
    if (checked) {
      setAttSelectedRows(new Set(slicedAttendance.map(l => l.id)));
    } else {
      setAttSelectedRows(new Set());
    }
    setAttSelectAll(checked);
  };

  const handleAttRowSelect = (id: string, checked: boolean) => {
    setAttSelectedRows(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleBulkDeleteAttendance = () => {
    if (attSelectedRows.size === 0) return;
    if (!window.confirm(`⚠️ Bạn có chắc chắn muốn xóa ${attSelectedRows.size} bản ghi chấm công đã chọn không?\nHành động này không thể hoàn tác.`)) return;
    // Note: handleDeleteAttendance is passed as a prop, it expects a single log
    // We'll call it for each selected row
    slicedAttendance.filter(l => attSelectedRows.has(l.id)).forEach(l => handleDeleteAttendance(l));
    setAttSelectedRows(new Set());
    setAttSelectAll(false);
    addToast({ title: '✅ Đã xóa', message: `Đã xóa ${attSelectedRows.size} bản ghi chấm công.`, type: 'success' });
  };

  return (
    <div className="space-y-4">
      {/* Bulk delete button when rows are selected */}
      {attSelectedRows.size > 0 && (
        <div className="bg-red-950/20 border border-red-500/30 rounded-lg p-3 mb-4 flex justify-between items-center">
          <span className="text-red-400 font-bold">Đã chọn: {attSelectedRows.size} bản ghi</span>
          <button
            onClick={handleBulkDeleteAttendance}
            className="bg-red-650 hover:bg-red-600 text-white font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors text-[11px] flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" /> Xóa hàng loạt
          </button>
        </div>
      )}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-2 gap-2">
        <div className="flex flex-wrap items-center gap-4">
          {/* Filter 1: Employee */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-slate-400 font-bold select-none">Nhân viên:</span>
            <select
              value={attendanceSearchEmpId}
              onChange={(e) => setAttendanceSearchEmpId(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-white rounded px-2.5 py-1 text-[11px] font-bold cursor-pointer hover:border-amber-500 focus:outline-none transition-colors"
            >
              <option value="all">👥 Tất cả</option>
              {employees.filter(emp => emp.status === 'working').map(emp => (
                <option key={emp.id} value={emp.id}>{emp.id} - {emp.name}</option>
              ))}
            </select>
          </div>

          {/* Filter 2: Month */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-slate-400 font-bold select-none">Tháng:</span>
            <select
              value={attendanceFilterMonth}
              onChange={(e) => setAttendanceFilterMonth(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-white rounded px-2.5 py-1 text-[11px] font-bold cursor-pointer hover:border-amber-500 focus:outline-none transition-colors"
            >
              <option value="all">📅 Tất cả</option>
              {Array.from({ length: 12 }, (_, i) => {
                const m = String(i + 1);
                return (
                  <option key={i} value={m}>Tháng {m.padStart(2, '0')}</option>
                );
              })}
            </select>
          </div>

          {/* Filter 3: Year */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-slate-400 font-bold select-none">Năm:</span>
            <select
              value={attendanceFilterYear}
              onChange={(e) => setAttendanceFilterYear(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-white rounded px-2.5 py-1 text-[11px] font-bold cursor-pointer hover:border-amber-500 focus:outline-none transition-colors"
            >
              <option value="2024">Năm 2024</option>
              <option value="2025">Năm 2025</option>
              <option value="2026">Năm 2026</option>
              <option value="2027">Năm 2027</option>
              <option value="2028">Năm 2028</option>
            </select>
          </div>
          {canManageLockedAttendance() && (
            <button
              onClick={() => setShowBulkLockModal(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shrink-0 border border-emerald-500/30"
              title="Chốt công hàng loạt (trang hiện tại hoặc cả tháng)"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Chốt hàng loạt</span>
            </button>
          )}
          <button
            onClick={handleExportAttendanceExcel}
            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shrink-0 border border-sky-500/30"
            title="Xuất báo cáo bảng công ra Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Xuất Excel</span>
          </button>
          <button
            onClick={() => attendanceFileInputRef.current?.click()}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-[11px] font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shrink-0 border border-slate-600/30"
            title="Nhập chấm công thủ công từ Excel"
          >
            <FileUp className="w-3.5 h-3.5" />
            <span>Nhập Excel</span>
          </button>
          <input
            ref={attendanceFileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleImportAttendanceExcel}
          />
        </div>
      </div>

      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-[11px] overflow-x-auto">

        {/* Daily timesheet rows spreadsheet layout */}
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-[10.5px]">
              <th className="pb-2.5 pl-2 w-10 text-center">
                <input
                  type="checkbox"
                  checked={attSelectAll && slicedAttendance.length > 0 && slicedAttendance.every(l => attSelectedRows.has(l.id))}
                  onChange={(e) => handleAttSelectAll(e.target.checked)}
                  className="w-4 h-4 text-amber-500 border-slate-600 rounded cursor-pointer"
                />
              </th>
              <th className="pb-2.5 pl-2">Nhân viên</th>
              <th className="pb-2.5">Ngày</th>
              <th className="pb-2.5">
                Ca Sáng (Vào → Ra)
                <div className="font-normal text-[8.5px] text-slate-500 mt-0.5">Chuẩn: {readHrmConfigFromStorage().morningIn} → {readHrmConfigFromStorage().morningOut}</div>
              </th>
              <th className="pb-2.5">
                Ca Chiều (Vào → Ra)
                <div className="font-normal text-[8.5px] text-slate-500 mt-0.5">Chuẩn: {readHrmConfigFromStorage().afternoonIn} → {readHrmConfigFromStorage().afternoonOut}</div>
              </th>
              <th className="pb-2.5">Tăng Ca</th>
              <th className="pb-2.5 text-center font-bold text-amber-500">Chốt công</th>
              <th className="pb-2.5">Thông tin Sinh trắc & Vị trí</th>
              <th className="pb-2.5 text-center">Trạng thái</th>
              <th className="pb-2.5 text-center text-sky-400">Đi muộn / Về sớm</th>
              <th className="pb-2.5 pr-2">Ghi chú thực tế</th>
              <th className="pb-2.5 pr-2 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-850">
            {(() => {
              const filtered = attendanceFiltered;
              const totalFiltered = filtered.length;
              if (totalFiltered === 0) {
                return (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-slate-500 font-semibold">
                      📭 Không tìm thấy bản ghi nhật ký chấm công nào.
                    </td>
                  </tr>
                );
              }
              const sliced = globalPageSize === 'all'
                ? filtered
                : filtered.slice((attendancePage - 1) * (globalPageSize as number), attendancePage * (globalPageSize as number));
              return sliced.map(log => (
                <tr key={log.id} className={`hover:bg-slate-950/40 text-[11px] transition-colors ${attSelectedRows.has(log.id) ? 'bg-amber-500/10' : ''}`}>
                  <td className="py-2.5 pl-2 text-center">
                    <input
                      type="checkbox"
                      checked={attSelectedRows.has(log.id)}
                      onChange={(e) => { e.stopPropagation(); handleAttRowSelect(log.id, e.target.checked); }}
                      className="w-4 h-4 text-amber-500 border-slate-600 rounded cursor-pointer"
                    />
                  </td>
                  <td className="py-2.5 pl-2 font-semibold text-white leading-tight">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-slate-100">{log.empName}</span>
                      <span className="text-[8.5px] bg-slate-800 text-slate-400 font-mono px-1 rounded">{log.empId}</span>
                    </div>
                  </td>
                  <td className="py-2.5 font-mono text-slate-400 text-[10.5px] whitespace-nowrap">{log.date}</td>
                  <td className="py-2.5 font-mono text-[10.5px]">
                    <div className="flex items-center gap-1">
                      <span className={log.timeInS === '--:--' || log.timeInS === 'OFF' || log.timeInS === 'KP' ? 'text-slate-600' : 'text-slate-100 font-medium'}>
                        {log.timeInS}
                      </span>
                      <span className="text-slate-600">→</span>
                      <span className={log.timeOutS === '--:--' || log.timeOutS === 'OFF' || log.timeOutS === 'KP' ? 'text-slate-600' : 'text-slate-350'}>
                        {log.timeOutS}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 font-mono text-[10.5px]">
                    <div className="flex items-center gap-1">
                      <span className={log.timeInC === '--:--' || log.timeInC === 'OFF' || log.timeInC === 'KP' ? 'text-slate-600' : 'text-slate-100 font-medium'}>
                        {log.timeInC}
                      </span>
                      <span className="text-slate-600">→</span>
                      <span className={log.timeOutC === '--:--' || log.timeOutC === 'OFF' || log.timeOutC === 'KP' ? 'text-slate-600' : 'text-slate-350'}>
                        {log.timeOutC}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 font-mono text-amber-500 font-semibold text-[10.5px]">
                    {log.timeInOT ? (
                      <div className="bg-amber-950/30 text-amber-400 px-1.5 py-0.5 rounded border border-amber-900/30 inline-block font-bold">
                        {log.timeInOT} - {log.timeOutOT} ({log.otHours}h)
                      </div>
                    ) : <span className="text-slate-600">--</span>}
                  </td>
                  <td className="py-2.5 text-center">
                    <WorkdayCell
                      log={log}
                      leaveCoefficients={leaveCoefficients}
                      holidays={holidays}
                      weekendDays={weekendDays}
                      leaves={leaves}
                    />
                  </td>
                  <td className="py-2.5 text-[10.5px]">
                    <div className="space-y-1 text-slate-300">
                      <div className="text-[10px] text-slate-404 font-medium">
                        {log.method ? log.method.replace('Công trình ', '') : 'Chưa ghi nhận'}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Photos: luôn render 2 khung VÀO/RA để cột giữ rộng đều */}
                        <div className="flex items-center gap-1 border-r border-slate-800 pr-2 shrink-0">
                          {log.photoIn ? (
                            <button
                              type="button"
                              onClick={() => setZoomedImage(log.photoIn ?? null)}
                              className="group relative cursor-zoom-in border border-slate-700 hover:border-amber-500 rounded p-[1px] bg-slate-950 block transition-colors"
                              title="Ảnh check-in vào (Click phóng to)"
                            >
                              <img src={log.photoIn} className="w-5.5 h-5.5 rounded object-cover" alt="Vào" referrerPolicy="no-referrer" />
                            </button>
                          ) : (
                            <div className="w-5.5 h-5.5 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-[7px] text-slate-500 font-bold" title="Chưa có ảnh check-in">VÀO</div>
                          )}
                          {log.photoOut ? (
                            <button
                              type="button"
                              onClick={() => setZoomedImage(log.photoOut ?? null)}
                              className="group relative cursor-zoom-in border border-slate-700 hover:border-amber-500 rounded p-[1px] bg-slate-950 block transition-colors"
                              title="Ảnh check-out ra (Click phóng to)"
                            >
                              <img src={log.photoOut} className="w-5.5 h-5.5 rounded object-cover" alt="Ra" referrerPolicy="no-referrer" />
                            </button>
                          ) : (
                            <div className="w-5.5 h-5.5 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-[7px] text-slate-500 font-bold" title="Chưa có ảnh check-out">RA</div>
                          )}
                        </div>

                        {/* Maps Coordinates */}
                        <div className="flex flex-col gap-0.5 justify-center">
                          {log.coordsIn && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(log.coordsIn)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[9px] text-amber-550 hover:text-amber-400 hover:underline font-mono px-1 py-0.5 bg-amber-950/20 border border-amber-900/10 rounded inline-flex items-center gap-0.5"
                              title={`Mở vị trí check-in Vào: ${log.locationIn || 'Không rõ'}`}
                            >
                              📍 Vào: {log.coordsIn?.split(',')[0]}...
                            </a>
                          )}
                          {log.coordsOut && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(log.coordsOut)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[9px] text-slate-400 hover:text-white hover:underline font-mono px-1 py-0.5 bg-slate-900 border border-slate-800 rounded inline-flex items-center gap-0.5"
                              title={`Mở vị trí check-out Ra: ${log.locationOut || 'Không rõ'}`}
                            >
                              📍 Ra: {log.coordsOut?.split(',')[0]}...
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 text-center whitespace-nowrap">
                    {(() => {
                      const st = getAttendanceStatusText(log, readHrmConfigFromStorage());
                      return (
                        <span className={`px-2 py-0.5 rounded font-black text-[9px] uppercase tracking-wider select-none ${
                          st.isValid ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {st.text}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="py-2.5 text-center whitespace-nowrap">
                    {(() => {
                      const st = getAttendanceStatusText(log, readHrmConfigFromStorage());
                      const late = st.lateMinutes;
                      const early = st.earlyMinutes;
                      if (late <= 0 && early <= 0) {
                        return <span className="text-[10px] text-slate-600">—</span>;
                      }
                      return (
                        <div className="flex flex-col items-center gap-0.5 text-[10px] font-bold leading-tight">
                          {late > 0 && (
                            <span className="text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                              ⏰ {late}p
                            </span>
                          )}
                          {early > 0 && (
                            <span className="text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                              ⏱ {early}p
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="py-2.5 pr-2 text-slate-400 text-[10.5px] truncate max-w-[160px] font-medium" title={log.notes}>
                    {log.notes || <span className="text-slate-600 font-normal italic">Không có</span>}
                  </td>
                  <td className="py-2.5 pr-2 text-center whitespace-nowrap">
                    {log.isLocked ? (
                      canManageLockedAttendance() ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setEditingAttendance(log)}
                            className="text-[9px] text-amber-400 hover:text-white bg-amber-500/10 hover:bg-amber-500/25 px-1.5 py-0.5 rounded border border-amber-500/20 cursor-pointer transition-all font-bold"
                            title="Sửa bản ghi (đã chốt)"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteAttendance(log)}
                            className="text-[9px] text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500/25 px-1.5 py-0.5 rounded border border-rose-500/20 cursor-pointer transition-all font-bold"
                            title="Xóa bản ghi (đã chốt)"
                          >
                            🗑️
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-600 text-[9px] font-bold flex items-center justify-center gap-0.5" title="Đã chốt — chỉ Giám đốc/Kế toán mới được sửa">
                          🔒
                        </span>
                      )
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setEditingAttendance(log)}
                          className="text-[9px] text-amber-400 hover:text-white bg-amber-500/10 hover:bg-amber-500/25 px-1.5 py-0.5 rounded border border-amber-500/20 cursor-pointer transition-all font-bold"
                          title="Sửa bản ghi"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteAttendance(log)}
                          className="text-[9px] text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500/25 px-1.5 py-0.5 rounded border border-rose-500/20 cursor-pointer transition-all font-bold"
                          title="Xóa bản ghi"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ));
            })()}
          </tbody>
        </table>

        {/* Pagination helper for attendance log */}
        {(() => {
          const filtered = attendanceFiltered;
          const totalFiltered = filtered.length;
          if (globalPageSize === 'all' || totalFiltered <= (globalPageSize as number)) return null;
          return (
            <div className="flex justify-center items-center gap-1.5 mt-4 pt-4 border-t border-slate-850">
              <button
                type="button"
                disabled={attendancePage === 1}
                onClick={(e) => { e.stopPropagation(); setAttendancePage(prev => Math.max(prev - 1, 1)); }}
                className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none text-xs font-bold transition-all cursor-pointer"
              >
                ◀ Trước
              </button>
              <span className="text-[11px] font-mono text-slate-450 px-2">
                Trang <strong>{attendancePage}</strong> / {Math.ceil(totalFiltered / (globalPageSize as number))}
              </span>
              <button
                type="button"
                disabled={attendancePage >= Math.ceil(totalFiltered / (globalPageSize as number))}
                onClick={(e) => { e.stopPropagation(); setAttendancePage(prev => Math.min(prev + 1, Math.ceil(totalFiltered / (globalPageSize as number)))); }}
                className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none text-xs font-bold transition-all cursor-pointer"
              >
                Sau ▶
              </button>
            </div>
          );
        })()}

        {/* Global Row Selector inside attendance spreadsheet footer */}
        <div className="flex justify-between items-center mt-3 pt-2 text-[10px] text-slate-500 border-t border-slate-850/50">
          {(() => {
            const filtered = attendanceFiltered;
            return (
              <div>Hiển thị {globalPageSize === 'all' ? 'tất cả' : `${Math.min(globalPageSize as number, filtered.length)} / ${filtered.length} dòng`} mỗi trang.</div>
            );
          })()}
          <div className="flex items-center gap-1.5">
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

      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row justify-between items-center gap-2">
        <div className="text-[11px] text-slate-400">
          💡 Quy tắc thợ thô: <strong>Đủ 4 mốc chính = 1 công.</strong> Ngày thường hệ số tăng ca: <strong>1.5</strong>. Chủ nhật tính xưởng: <strong>2.0</strong> dầm sắt.
        </div>
        <button
          onClick={() => {
            addToast({ title: '✅ Thành công', message: '💾 Đang nạp cấu trúc excel và xuất biểu số công tháng 06/2026 rỗng. Mã code excel: XLSM-TIME-GRP', type: 'success' });
          }}
          className="bg-slate-850 hover:bg-slate-800 text-[10px] font-bold text-slate-300 px-3 py-1.5 rounded flex items-center gap-1 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" /> Xuất bảng công Excel
        </button>
      </div>

    </div>
  );
}
