import React, { useState, useMemo } from 'react';
import { Lock, Unlock, Pencil, FileUp, Download, Trash2, AlertTriangle, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { readHrmConfigFromStorage, getAttendanceStatusText, getMissingAttendanceReport } from '../hrCalculations';
import MissingAttendanceReport from './MissingAttendanceReport';
import { EmployeeProfile, LeaveCoefficient, Holiday, AttendanceLog, LeaveRequest } from '../hrTypes';
import PunchMediaList from '../PunchMediaList';

type ToastInput = { title: string; message: string; type?: 'success' | 'info' | 'warning' | 'error'; duration?: number };

interface AttendanceTabProps {
  employees: EmployeeProfile[];
  attendanceFiltered: AttendanceLog[];
  attendanceSearchEmpId: string;
  setAttendanceSearchEmpId: (v: string) => void;
  attendanceFilterMonth: string;
  setAttendanceFilterMonth: (v: string) => void;
  attendanceFilterDay: string;
  setAttendanceFilterDay: (v: string) => void;
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
  isLoadingAttendance?: boolean;
  // Thêm hàm update attendance để chốt công thủ công
  onUpdateAttendance?: (id: string, updates: Partial<AttendanceLog>) => void;
  // Báo cáo vắng mặt: dữ liệu & callback tạo bản ghi
  attendance: AttendanceLog[];
  excludedIds: string[];
  excludedRoles: string[];
  onCreateMissingRecord: (rec: any) => void;
}

export default function AttendanceTab({
  employees,
  attendanceFiltered,
  attendanceSearchEmpId,
  setAttendanceSearchEmpId,
  attendanceFilterMonth,
  setAttendanceFilterMonth,
  attendanceFilterDay,
  setAttendanceFilterDay,
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
  attendance,
  excludedIds,
  excludedRoles,
  onCreateMissingRecord,
  addToast,
  WorkdayCell,
  isLoadingAttendance = false,
  onUpdateAttendance,
}: AttendanceTabProps) {
  const [attView, setAttView] = useState<'table' | 'missing'>('table');

  // Badge: số bản ghi đã chấm hôm nay & số ngày vắng mặt chưa tạo hôm nay
  const attNow = new Date();
  const attTodayStr = `${attNow.getFullYear()}-${String(attNow.getMonth() + 1).padStart(2, '0')}-${String(attNow.getDate()).padStart(2, '0')}`;
  const attTodayRecordCount = useMemo(
    () => (attendance || []).filter((a: any) => a.date === attTodayStr).length,
    [attendance, attTodayStr]
  );
  const attTodayMissingCount = useMemo(
    () => getMissingAttendanceReport({
      employees, attendance, leaves, holidays, weekendDays,
      month: String(attNow.getMonth() + 1), year: String(attNow.getFullYear()),
      excludedIds, excludedRoles,
    }).filter((e) => e.date === attTodayStr && e.type === 'absent').length,
    [employees, attendance, leaves, holidays, weekendDays, excludedIds, excludedRoles, attTodayStr]
  );
  // ── Multi-row selection ──
  const [attSelectedRows, setAttSelectedRows] = useState<Set<string>>(new Set());
  const [attSelectAll, setAttSelectAll] = useState(false);
  // Dòng đang mở phần chi tiết (ảnh FaceID/vị trí/ghi chú)
  const [expandedId, setExpandedId] = useState<string | null>(null);


  // --- Start: Helper functions from DashboardOverview ---
  const timeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length < 2) return 0;
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  };

  const getCurrentMinute = (): number => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  };
  // --- End: Helper functions ---

  // --- Start: Anomaly Detection & Daily Summary ---

  // Helper: Determine anomaly tags for a single log
  const getAttendanceAnomalies = useMemo(() => {
    return (log: AttendanceLog) => {
      const anomalies: Array<{ type: string; label: string; icon: React.ReactNode; color: string; title: string }> = [];
      const config = readHrmConfigFromStorage();
      const st = getAttendanceStatusText(log, config);

      // 1. Đi muộn
      if (st.lateMinutes > 0) {
        anomalies.push({
          type: 'late',
          label: `Muộn ${st.lateMinutes}'`,
          icon: <AlertTriangle className="w-3 h-3" />,
          color: 'text-rose-700 bg-rose-50 border-rose-200',
          title: `Đi muộn ${st.lateMinutes} phút so với quy định`
        });
      }

      // 2. Về sớm
      if (st.earlyMinutes > 0) {
        anomalies.push({
          type: 'early',
          label: `Sớm ${st.earlyMinutes}'`,
          icon: <Clock className="w-3 h-3" />,
          color: 'text-amber-700 bg-amber-50 border-amber-200',
          title: `Về sớm ${st.earlyMinutes} phút so với quy định`
        });
      }

      // 3. Thiếu chấm ra ca sáng (có vào không ra)
      if (log.timeInS && log.timeInS !== '--:--' && (!log.timeOutS || log.timeOutS === '--:--')) {
        anomalies.push({
          type: 'missingOutS',
          label: 'Thiếu Ra Sáng',
          icon: <XCircle className="w-3 h-3" />,
          color: 'text-orange-700 bg-orange-50 border-orange-200',
          title: 'Đã chấm vào ca sáng nhưng chưa chấm ra'
        });
      }

      // 4. Thiếu chấm ra ca chiều (có vào không ra)
      if (log.timeInC && log.timeInC !== '--:--' && (!log.timeOutC || log.timeOutC === '--:--')) {
        anomalies.push({
          type: 'missingOutC',
          label: 'Thiếu Ra Chiều',
          icon: <XCircle className="w-3 h-3" />,
          color: 'text-orange-700 bg-orange-50 border-orange-200',
          title: 'Đã chấm vào ca chiều nhưng chưa chấm ra'
        });
      }

      // 5. Chỉ chấm ra không chấm vào (ca sáng)
      if ((!log.timeInS || log.timeInS === '--:--') && log.timeOutS && log.timeOutS !== '--:--') {
        anomalies.push({
          type: 'missingInS',
          label: 'Thiếu Vào Sáng',
          icon: <AlertCircle className="w-3 h-3" />,
          color: 'text-red-700 bg-red-50 border-red-200',
          title: 'Chấm ra ca sáng nhưng không có giờ vào'
        });
      }

      // 6. Chỉ chấm ra không chấm vào (ca chiều)
      if ((!log.timeInC || log.timeInC === '--:--') && log.timeOutC && log.timeOutC !== '--:--') {
        anomalies.push({
          type: 'missingInC',
          label: 'Thiếu Vào Chiều',
          icon: <AlertCircle className="w-3 h-3" />,
          color: 'text-red-700 bg-red-50 border-red-200',
          title: 'Chấm ra ca chiều nhưng không có giờ vào'
        });
      }

      // 7. Chấm công ngoài khu vực cho phép (nếu có coords và config gpsRadiusAllowed)
      // Logic này phức tạp hơn, tạm bỏ qua hoặc kiểm tra sơ bộ nếu cần

      // 8. Trạng thái đặc biệt: Nghỉ phép, nghỉ không phép
      if (log.status === 'excused') {
        anomalies.push({
          type: 'leave',
          label: 'Nghỉ phép',
          icon: <CheckCircle className="w-3 h-3" />,
          color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
          title: 'Ngày nghỉ được phê duyệt'
        });
      } else if (log.status === 'unexcused') {
        anomalies.push({
          type: 'absent',
          label: 'Nghỉ ko phép',
          icon: <XCircle className="w-3 h-3" />,
          color: 'text-rose-700 bg-rose-50 border-rose-200',
          title: 'Ngày nghỉ không phép / Vắng mặt'
        });
      }

      return anomalies;
    };
  }, []);

  // Daily Summary Strip Calculation
  const dailySummary = useMemo(() => {
    // Chỉ tính cho ngày đang được lọc (attendanceFilterDay) hoặc toàn bộ filteredAttendance nếu là 'all'
    // Để đơn giản, ta tính trên toàn bộ filteredAttendance (đã lọc theo tháng/năm/ngày bởi component cha)
    const logs = attendanceFiltered;

    const total = logs.length;
    const onTime = logs.filter(l => getAttendanceStatusText(l, readHrmConfigFromStorage()).isValid && !getAttendanceStatusText(l, readHrmConfigFromStorage()).lateMinutes).length;
    const late = logs.filter(l => getAttendanceStatusText(l, readHrmConfigFromStorage()).lateMinutes > 0).length;
    const early = logs.filter(l => getAttendanceStatusText(l, readHrmConfigFromStorage()).earlyMinutes > 0).length;
    const missingPunch = logs.filter(l => {
      const st = getAttendanceStatusText(l, readHrmConfigFromStorage());
      // Coi là thiếu chấm nếu có vào không ra hoặc có ra không vào
      const hasInS = l.timeInS && l.timeInS !== '--:--';
      const hasOutS = l.timeOutS && l.timeOutS !== '--:--';
      const hasInC = l.timeInC && l.timeInC !== '--:--';
      const hasOutC = l.timeOutC && l.timeOutC !== '--:--';
      return (hasInS && !hasOutS) || (!hasInS && hasOutS) || (hasInC && !hasOutC) || (!hasInC && hasOutC);
    }).length;
    const absentByStatus = logs.filter(l => l.status === 'unexcused' || l.status === 'missing' || l.status === 'invalid').length;
    const locked = logs.filter(l => l.isLocked).length;

    // Chỉ tính nhân viên "Đang làm" — trước đây dùng employees.length nguyên xi,
    // tính cả nhân viên nghỉ phép/nghỉ hẳn/Ban giám đốc vào "Tổng nhân viên", khiến
    // số "Vắng" bị thổi phồng sai (nhân viên nghỉ hẳn không đi làm nhưng vẫn bị tính vắng).
    const totalEmployees = employees.filter(e => e.status === 'working').length;
    const totalPresent = new Set(logs.map(l => l.empId)).size;
    const absent = totalEmployees - totalPresent;

    return { total, onTime, late, early, missingPunch, absent, locked, totalEmployees };
  }, [attendanceFiltered]);

  // --- End: Anomaly Detection & Daily Summary ---


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

  // ── Hiển thị dùng chung cho bảng (máy tính) và thẻ (điện thoại) ──
  // Ngày lưu dạng YYYY-MM-DD → hiển thị dd/mm/yyyy
  const fmtDate = (d?: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
    return m ? `${m[3]}/${m[2]}/${m[1]}` : (d || '—');
  };
  // Giá trị "không có giờ": '--:--', 'OFF' (nghỉ), 'KP' (không phép) hiển thị mờ
  const isBlankTime = (v?: string) => !v || v === '--:--' || v === 'OFF' || v === 'KP';
  const Shift = ({ a, b }: { a?: string; b?: string }) => (
    <span className="font-mono text-xs whitespace-nowrap">
      <span className={isBlankTime(a) ? 'text-slate-300' : 'text-slate-900 font-bold'}>{a || '--:--'}</span>
      <span className="text-slate-300 mx-1">→</span>
      <span className={isBlankTime(b) ? 'text-slate-300' : 'text-slate-700'}>{b || '--:--'}</span>
    </span>
  );
  const OtText = ({ log }: { log: AttendanceLog }) => log.timeInOT
    ? <span className="inline-block px-1.5 py-0.5 rounded-md border border-amber-200 bg-amber-50 text-amber-700 font-mono text-[11px] font-bold">{log.timeInOT}–{log.timeOutOT} ({log.otHours}h)</span>
    : <span className="text-slate-300">—</span>;
  // Tình trạng: nhãn đúng/sai + các chip bất thường (đã gồm đi muộn / về sớm nên không cần cột riêng)
  const StatusCell = ({ log }: { log: AttendanceLog }) => {
    const st = getAttendanceStatusText(log, readHrmConfigFromStorage());
    return (
      <div className="flex flex-wrap items-center gap-1">
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${st.isValid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>{st.text}</span>
        {getAttendanceAnomalies(log).map((an, i) => (
          <span key={i} title={an.title} className={`px-1.5 py-0.5 rounded-full border ${an.color} text-[10px] font-bold inline-flex items-center gap-1`}>{an.icon}{an.label}</span>
        ))}
      </div>
    );
  };
  // Nút thao tác theo từng bản ghi: Sửa / Chốt-Mở khóa / Xóa. Giữ nguyên quy tắc quyền cũ:
  //  - đã chốt + không có quyền chốt → chỉ hiện ổ khóa;  - Chốt/Mở khóa chỉ cho người có quyền chốt công.
  const iconBtn = 'w-8 h-8 inline-flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer';
  const RowActions = ({ log }: { log: AttendanceLog }) => {
    const canManage = canManageLockedAttendance();
    if (log.isLocked && !canManage) {
      return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400" title="Đã chốt — chỉ Giám đốc/Kế toán mới được sửa"><Lock className="w-3.5 h-3.5" />Đã chốt</span>;
    }
    return (
      <div className="inline-flex items-center gap-1.5">
        <button type="button" className={iconBtn} title="Sửa bản ghi" aria-label="Sửa bản ghi" data-testid={`att-edit-${log.id}`}
          onClick={(e) => { e.stopPropagation(); setEditingAttendance(log); }}><Pencil className="w-3.5 h-3.5" /></button>
        {canManage && onUpdateAttendance && (
          <button type="button" className={iconBtn} data-testid={`att-lock-${log.id}`}
            title={log.isLocked ? 'Mở khóa bản ghi này' : 'Chốt & khóa bản ghi này'} aria-label={log.isLocked ? 'Mở khóa' : 'Chốt công'}
            onClick={(e) => { e.stopPropagation(); onUpdateAttendance(log.id, { isLocked: !log.isLocked }); }}>
            {log.isLocked ? <Unlock className="w-3.5 h-3.5 text-amber-600" /> : <Lock className="w-3.5 h-3.5 text-emerald-600" />}
          </button>
        )}
        <button type="button" title="Xóa bản ghi" aria-label="Xóa bản ghi" data-testid={`att-delete-${log.id}`}
          className="w-8 h-8 inline-flex items-center justify-center rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
          onClick={(e) => { e.stopPropagation(); handleDeleteAttendance(log); }}><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    );
  };
  // Khối "Sinh trắc & vị trí" + ghi chú — chỉ mở khi bấm vào dòng (đỡ chật bảng)
  const DetailBox = ({ log }: { log: AttendanceLog }) => (
    <div className="space-y-2 text-xs" data-testid={`att-detail-${log.id}`}>
      <div className="text-slate-500">Cách chấm: <strong className="text-slate-700">{log.method ? log.method.replace('Công trình ', '') : 'Chưa ghi nhận'}</strong></div>
      <PunchMediaList log={log} onZoomImage={setZoomedImage} variant="compact" />
      <div className="text-slate-500">Ghi chú: <span className="text-slate-700">{log.notes || 'Không có'}</span></div>
    </div>
  );

  const hrm = readHrmConfigFromStorage();
  const inputCls = 'h-9 bg-white border border-slate-200 text-slate-800 rounded-xl px-2.5 text-[13px] font-bold cursor-pointer outline-none focus:border-blue-400';
  const pageSizeNum = globalPageSize === 'all' ? 0 : (globalPageSize as number);
  const totalPages = pageSizeNum ? Math.ceil(filteredAttendance.length / pageSizeNum) : 1;

  // Loading skeleton
  if (isLoadingAttendance) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3" data-testid="att-loading">
        {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-9 bg-slate-100 rounded-lg animate-pulse" />)}
        <p className="text-center text-xs text-slate-500">Đang tải dữ liệu chấm công...</p>
      </div>
    );
  }

  const tiles: Array<[string, number, string, string]> = [
    ['Tổng NV', dailySummary.totalEmployees, '#334155', 'Số nhân viên đang làm'],
    ['Đúng giờ', dailySummary.onTime, '#047857', 'Có mặt và chấm công đúng giờ'],
    ['Đi muộn', dailySummary.late, '#be123c', 'Số bản ghi đi muộn'],
    ['Về sớm', dailySummary.early, '#b45309', 'Số bản ghi về sớm'],
    ['Thiếu chấm', dailySummary.missingPunch, '#c2410c', 'Thiếu một lượt chấm (vào hoặc ra)'],
    ['Vắng mặt', dailySummary.absent, '#b91c1c', 'Nhân viên vắng hoặc nghỉ không phép'],
    ['Đã chốt', dailySummary.locked, '#475569', 'Bản ghi đã chốt, không sửa được'],
  ];

  return (
    <div className="space-y-3" data-testid="att-root">
      {/* ── THANH CÔNG CỤ: bộ lọc + nút. Xuất/Nhập chỉ biểu tượng; "Chốt hàng loạt" là nút phụ có chữ ── */}
      <div className="flex flex-wrap items-center gap-2" data-testid="att-toolbar">
        <select value={attendanceSearchEmpId} onChange={(e) => setAttendanceSearchEmpId(e.target.value)} aria-label="Nhân viên" data-testid="att-filter-emp"
          className={`${inputCls} flex-1 min-w-[150px]`}>
          <option value="all">Tất cả nhân viên</option>
          {employees.filter(emp => emp.status === 'working').map(emp => (
            <option key={emp.id} value={emp.id}>{emp.id} - {emp.name}</option>
          ))}
        </select>
        <select value={attendanceFilterMonth} onChange={(e) => setAttendanceFilterMonth(e.target.value)} aria-label="Tháng" data-testid="att-filter-month" className={inputCls}>
          <option value="all">Mọi tháng</option>
          {Array.from({ length: 12 }, (_, i) => <option key={i} value={String(i + 1)}>Tháng {String(i + 1).padStart(2, '0')}</option>)}
        </select>
        <select value={attendanceFilterDay} onChange={(e) => setAttendanceFilterDay(e.target.value)} aria-label="Ngày" data-testid="att-filter-day" className={inputCls}>
          <option value="all">Mọi ngày</option>
          <option value="today">Hôm nay</option>
          {Array.from({ length: 31 }, (_, i) => <option key={i} value={String(i + 1)}>Ngày {String(i + 1).padStart(2, '0')}</option>)}
        </select>
        <select value={attendanceFilterYear} onChange={(e) => setAttendanceFilterYear(e.target.value)} aria-label="Năm" data-testid="att-filter-year" className={inputCls}>
          {Array.from({ length: 5 }, (_, i) => { const y = new Date().getFullYear() - 2 + i; return <option key={y} value={String(y)}>Năm {y}</option>; })}
        </select>
        {canManageLockedAttendance() && (
          <button type="button" onClick={() => setShowBulkLockModal(true)} title="Chốt công hàng loạt (trang hiện tại hoặc cả tháng)" data-testid="att-bulk-lock"
            className="h-9 px-3 rounded-xl flex items-center gap-1.5 text-[13px] font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer">
            <Lock className="w-4 h-4" /><span className="hidden sm:inline">Chốt hàng loạt</span>
          </button>
        )}
        <button type="button" onClick={handleExportAttendanceExcel} title="Xuất Excel" aria-label="Xuất Excel" data-testid="att-export"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"><Download className="w-4 h-4" /></button>
        <button type="button" onClick={() => attendanceFileInputRef.current?.click()} title="Nhập Excel" aria-label="Nhập Excel" data-testid="att-import"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"><FileUp className="w-4 h-4" /></button>
        <input ref={attendanceFileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportAttendanceExcel} />
      </div>

      {/* Chuyển giữa Bảng chấm công / Báo cáo vắng mặt (chip, kèm số của hôm nay) */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5" data-testid="att-views">
        <button type="button" onClick={() => setAttView('table')} data-testid="att-view-table"
          style={attView === 'table' ? { background: '#e8efff', color: '#0d47c9', borderColor: '#bcd0ff' } : undefined}
          className={`h-8 px-3 rounded-full text-xs font-bold whitespace-nowrap border cursor-pointer ${attView === 'table' ? '' : 'bg-white text-slate-600 border-slate-200'}`}
          title="Số bản ghi đã chấm hôm nay">Bảng chấm công {attTodayRecordCount}</button>
        <button type="button" onClick={() => setAttView('missing')} data-testid="att-view-missing"
          style={attView === 'missing' ? { background: '#fee2e2', color: '#b91c1c', borderColor: '#fecaca' } : undefined}
          className={`h-8 px-3 rounded-full text-xs font-bold whitespace-nowrap border cursor-pointer ${attView === 'missing' ? '' : 'bg-white text-slate-600 border-slate-200'}`}
          title="Số nhân viên vắng chưa có bản ghi hôm nay">Báo cáo vắng mặt {attTodayMissingCount}</button>
      </div>

      {attView === 'missing' ? (
        <MissingAttendanceReport
          employees={employees}
          attendance={attendance}
          leaves={leaves}
          holidays={holidays}
          weekendDays={weekendDays}
          month={attendanceFilterMonth}
          year={attendanceFilterYear}
          excludedIds={excludedIds}
          excludedRoles={excludedRoles}
          onCreateRecord={onCreateMissingRecord}
          addToast={addToast}
        />
      ) : (
        <>
          {/* Thẻ số liệu tổng hợp của danh sách đang lọc */}
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2" data-testid="att-summary">
            {tiles.map(([label, n, color, tip]) => (
              <div key={label} title={tip} className="bg-white border border-slate-200 rounded-xl px-2 py-2 text-center">
                <div className="text-lg font-black leading-none" style={{ color }}>{n}</div>
                <div className="text-[10px] text-slate-500 font-bold mt-1 truncate">{label}</div>
              </div>
            ))}
          </div>

          {/* Thanh thao tác hàng loạt — chỉ hiện khi đã tick chọn */}
          {attSelectedRows.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl border border-blue-200 bg-blue-50" data-testid="att-bulkbar">
              <span className="text-[13px] font-bold" style={{ color: '#0d47c9' }}>Đã chọn {attSelectedRows.size}</span>
              <span className="flex-1" />
              <button type="button" onClick={handleBulkDeleteAttendance} className="h-8 px-3 rounded-lg bg-white border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /> Xóa</button>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            {/* MÁY TÍNH: bảng gọn — ảnh/vị trí/ghi chú nằm trong phần mở rộng của dòng */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]" data-testid="att-table">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs">
                    <th className="px-3 py-2.5 w-10 text-center">
                      <input type="checkbox" aria-label="Chọn tất cả" className="w-4 h-4 rounded cursor-pointer"
                        checked={attSelectAll && slicedAttendance.length > 0 && slicedAttendance.every(l => attSelectedRows.has(l.id))}
                        onChange={(e) => handleAttSelectAll(e.target.checked)} />
                    </th>
                    <th className="px-3 py-2.5 font-bold">Nhân viên</th>
                    <th className="px-3 py-2.5 font-bold">Ngày</th>
                    <th className="px-3 py-2.5 font-bold">Ca sáng<div className="font-normal text-[10px] text-slate-400 font-mono">{hrm.morningIn} → {hrm.morningOut}</div></th>
                    <th className="px-3 py-2.5 font-bold">Ca chiều<div className="font-normal text-[10px] text-slate-400 font-mono">{hrm.afternoonIn} → {hrm.afternoonOut}</div></th>
                    <th className="px-3 py-2.5 font-bold">Tăng ca</th>
                    <th className="px-3 py-2.5 font-bold text-center" title="Đủ 4 mốc chính = 1 công. Ngày thường tăng ca hệ số 1.5; Chủ nhật 2.0">Công</th>
                    <th className="px-3 py-2.5 font-bold">Tình trạng</th>
                    <th className="px-3 py-2.5 font-bold text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {slicedAttendance.length === 0 ? (
                    <tr><td colSpan={9} className="py-10 text-center text-slate-500 text-sm">Không có bản ghi chấm công nào.</td></tr>
                  ) : slicedAttendance.map(log => (
                    <React.Fragment key={log.id}>
                      <tr data-testid={`att-row-${log.id}`} onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                        className={`border-b border-slate-100 cursor-pointer transition-colors hover:bg-blue-50/50 ${attSelectedRows.has(log.id) || expandedId === log.id ? 'bg-blue-50' : ''}`}>
                        <td className="px-3 py-2.5 text-center">
                          <input type="checkbox" aria-label={`Chọn ${log.empName}`} className="w-4 h-4 rounded cursor-pointer"
                            checked={attSelectedRows.has(log.id)} onClick={(e) => e.stopPropagation()}
                            onChange={(e) => handleAttRowSelect(log.id, e.target.checked)} />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-bold text-slate-900">{log.empName}</div>
                          <div className="font-mono text-[11px] text-slate-500">{log.empId}</div>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-600 whitespace-nowrap">{fmtDate(log.date)}</td>
                        <td className="px-3 py-2.5"><Shift a={log.timeInS} b={log.timeOutS} /></td>
                        <td className="px-3 py-2.5"><Shift a={log.timeInC} b={log.timeOutC} /></td>
                        <td className="px-3 py-2.5"><OtText log={log} /></td>
                        <td className="px-3 py-2.5 text-center">
                          <WorkdayCell log={log} leaveCoefficients={leaveCoefficients} holidays={holidays} weekendDays={weekendDays} leaves={leaves} />
                        </td>
                        <td className="px-3 py-2.5"><StatusCell log={log} /></td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap"><RowActions log={log} /></td>
                      </tr>
                      {expandedId === log.id && (
                        <tr className="bg-slate-50 border-b border-slate-100"><td colSpan={9} className="px-4 py-3"><DetailBox log={log} /></td></tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ĐIỆN THOẠI: thẻ — không phải kéo ngang */}
            <div className="md:hidden" data-testid="att-cards">
              {slicedAttendance.length === 0 ? (
                <div className="py-10 text-center text-slate-500 text-sm">Không có bản ghi chấm công nào.</div>
              ) : slicedAttendance.map(log => (
                <div key={log.id} data-testid={`att-card-${log.id}`} onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  className={`px-3 py-3 border-b border-slate-100 last:border-b-0 ${attSelectedRows.has(log.id) || expandedId === log.id ? 'bg-blue-50' : ''}`}>
                  <div className="flex items-start gap-2.5">
                    <input type="checkbox" aria-label={`Chọn ${log.empName}`} className="w-4 h-4 rounded cursor-pointer mt-1"
                      checked={attSelectedRows.has(log.id)} onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleAttRowSelect(log.id, e.target.checked)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-slate-900 text-sm leading-snug">{log.empName}</div>
                        <div className="font-mono text-xs text-slate-500 whitespace-nowrap">{fmtDate(log.date)}</div>
                      </div>
                      <div className="font-mono text-[11px] text-slate-500">{log.empId}</div>
                      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 mt-2 items-center text-xs">
                        <span className="text-slate-500">Sáng</span><Shift a={log.timeInS} b={log.timeOutS} />
                        <span className="text-slate-500">Chiều</span><Shift a={log.timeInC} b={log.timeOutC} />
                        {log.timeInOT && <><span className="text-slate-500">Tăng ca</span><OtText log={log} /></>}
                      </div>
                      <div className="mt-2"><StatusCell log={log} /></div>
                      <div className="flex items-center justify-between gap-2 mt-2">
                        <WorkdayCell log={log} leaveCoefficients={leaveCoefficients} holidays={holidays} weekendDays={weekendDays} leaves={leaves} />
                        <RowActions log={log} />
                      </div>
                      {expandedId === log.id && <div className="mt-2 pt-2 border-t border-slate-200"><DetailBox log={log} /></div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Chân bảng: số lượng + phân trang + số dòng mỗi trang */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-t border-slate-200 text-xs text-slate-500">
              <span>{filteredAttendance.length} bản ghi</span>
              {pageSizeNum > 0 && filteredAttendance.length > pageSizeNum && (
                <div className="flex items-center gap-1.5">
                  <button type="button" disabled={attendancePage === 1} aria-label="Trang trước"
                    onClick={() => setAttendancePage(prev => Math.max(prev - 1, 1))}
                    className="h-8 px-2.5 rounded-lg bg-white border border-slate-200 text-slate-600 font-bold disabled:opacity-30 disabled:pointer-events-none cursor-pointer">Trước</button>
                  <span className="px-1">Trang <strong>{attendancePage}</strong> / {totalPages}</span>
                  <button type="button" disabled={attendancePage >= totalPages} aria-label="Trang sau"
                    onClick={() => setAttendancePage(prev => Math.min(prev + 1, totalPages))}
                    className="h-8 px-2.5 rounded-lg bg-white border border-slate-200 text-slate-600 font-bold disabled:opacity-30 disabled:pointer-events-none cursor-pointer">Sau</button>
                </div>
              )}
              <label className="flex items-center gap-1.5">
                <span>Hiển thị</span>
                <select value={globalPageSize.toString()}
                  onChange={(e) => {
                    const val = e.target.value;
                    setGlobalPageSize(val === 'all' ? 'all' : parseInt(val, 10));
                    localStorage.setItem('hl_global_page_size', val);
                  }}
                  className="h-8 bg-white border border-slate-200 text-slate-700 px-2 rounded-lg text-xs cursor-pointer outline-none font-bold">
                  <option value="5">5 dòng</option>
                  <option value="10">10 dòng</option>
                  <option value="20">20 dòng</option>
                  <option value="50">50 dòng</option>
                  <option value="all">Tất cả</option>
                </select>
              </label>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
