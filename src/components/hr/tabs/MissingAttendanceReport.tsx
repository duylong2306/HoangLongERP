import React, { useState, useMemo } from 'react';
import {
  AlertTriangle, CalendarX, CalendarCheck,
  UserX, Layers,
} from 'lucide-react';
import { getMissingAttendanceReport, readHrmConfigFromStorage } from '../hrCalculations';

type ToastInput = { title: string; message: string; type?: 'success' | 'info' | 'warning' | 'error'; duration?: number };

interface Props {
  employees: any[];
  attendance: any[];
  leaves: any[];
  holidays: any[];
  weekendDays: number[];
  month: string;
  year: string;
  excludedIds: string[];
  excludedRoles: string[];
  onCreateRecord: (rec: any) => void;
  addToast: (t: ToastInput) => void;
}

const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const PHEP_OPTIONS = [
  { symbol: 'PN', label: 'Phép năm (PN)' },
  { symbol: 'P', label: 'Có phép (P)' },
  { symbol: 'KP', label: 'Không phép (KP)' },
  { symbol: 'T', label: 'Tang (T)' },
  { symbol: 'C', label: 'Cưới (C)' },
  { symbol: 'OFF', label: 'Nghỉ ca (OFF)' },
];

const TYPE_META: Record<string, { label: string; cls: string }> = {
  absent: { label: 'Vắng KP', cls: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
  holiday: { label: 'Nghỉ lễ', cls: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  weekend: { label: 'Nghỉ cuối tuần', cls: 'text-slate-400 bg-slate-500/10 border-slate-600/30' },
};

const keyOf = (e: { empId: string; date: string }) => `${e.empId}|${e.date}`;

function buildId(empId: string, date: string): string {
  return `AT-MISS-${empId}-${date.replace(/-/g, '')}-${Date.now().toString().slice(-5)}-${Math.random().toString().slice(-2)}`;
}

export default function MissingAttendanceReport({
  employees, attendance, leaves, holidays, weekendDays,
  month, year, excludedIds, excludedRoles,
  onCreateRecord, addToast,
}: Props) {
  const [filterType, setFilterType] = useState<'all' | 'absent' | 'holiday' | 'weekend'>('absent');
  const [filterEmp, setFilterEmp] = useState<string>('all');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchAction, setBatchAction] = useState<string>(''); // '', 'kp', 'phep', 'worked', 'dismiss'
  const [phepSymbol, setPhepSymbol] = useState<string>('PN');

  // Bộ lọc kỳ báo cáo (tương tự Bảng chấm công): Tháng / Ngày / Năm
  const rptNow = new Date();
  const [rptMonth, setRptMonth] = useState<string>(month || String(rptNow.getMonth() + 1));
  const [rptYear, setRptYear] = useState<string>(year || String(rptNow.getFullYear()));
  const [rptDay, setRptDay] = useState<string>('today');

  const entries = useMemo(
    () => getMissingAttendanceReport({
      employees, attendance, leaves, holidays, weekendDays, month: rptMonth, year: rptYear, excludedIds, excludedRoles,
    }),
    [employees, attendance, leaves, holidays, weekendDays, rptMonth, rptYear, excludedIds, excludedRoles]
  );

  const rptTodayStr = `${rptNow.getFullYear()}-${String(rptNow.getMonth() + 1).padStart(2, '0')}-${String(rptNow.getDate()).padStart(2, '0')}`;
  const rptDaysInMonth = new Date(parseInt(rptYear, 10), parseInt(rptMonth, 10), 0).getDate();
  const rptDayOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [
      { value: 'all', label: 'Tất cả ngày' },
      { value: 'today', label: 'Hôm nay' },
    ];
    for (let d = 1; d <= rptDaysInMonth; d++) {
      opts.push({ value: String(d).padStart(2, '0'), label: `Ngày ${d}` });
    }
    return opts;
  }, [rptDaysInMonth]);
  const rptYearOptions = useMemo(() => {
    const opts: string[] = [];
    const yMax = rptNow.getFullYear() + 1;
    for (let y = yMax; y >= 2020; y--) opts.push(String(y));
    return opts;
  }, []);

  const counts = useMemo(() => {
    const c = { absent: 0, holiday: 0, weekend: 0 };
    entries.forEach((e) => { c[e.type] += 1; });
    return c;
  }, [entries]);

  const empOptions = useMemo(() => {
    const map = new Map<string, string>();
    entries.forEach((e) => { if (!map.has(e.empId)) map.set(e.empId, e.empName); });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entries]);

  const visible = useMemo(
    () => entries
      .filter((e) => !dismissed.has(keyOf(e)))
      .filter((e) => filterType === 'all' || e.type === filterType)
      .filter((e) => filterEmp === 'all' || e.empId === filterEmp)
      .filter((e) => {
        if (rptDay === 'all') return true;
        if (rptDay === 'today') return e.date === rptTodayStr;
        return e.date.slice(-2) === rptDay;
      }),
    [entries, dismissed, filterType, filterEmp, rptDay, rptTodayStr]
  );

  const baseRecord = (entry: any) => ({
    id: buildId(entry.empId, entry.date),
    empId: entry.empId,
    empName: entry.empName,
    date: entry.date,
    timeInOT: '',
    timeOutOT: '',
    otHours: 0,
    method: 'Báo cáo vắng mặt',
  });

  const createRecord = (entry: any, rec: any, silent = false) => {
    onCreateRecord(rec);
    setDismissed((prev) => new Set(prev).add(keyOf(entry)));
    setSelected((prev) => { const n = new Set(prev); n.delete(keyOf(entry)); return n; });
    if (!silent) {
      addToast({ title: '✅ Đã xử lý', message: `${entry.empName} — ${entry.date}`, type: 'success' });
    }
  };

  const doKP = (entry: any, silent = false) => {
    createRecord(entry, {
      ...baseRecord(entry),
      timeInS: '', timeOutS: '', timeInC: '', timeOutC: '',
      status: 'unexcused', statusMsg: 'Vắng không phép',
      notes: 'Vắng không phép (KP) — Báo cáo vắng mặt',
    }, silent);
  };

  const doPhep = (entry: any, symbol: string, silent = false) => {
    createRecord(entry, {
      ...baseRecord(entry),
      timeInS: symbol, timeOutS: symbol, timeInC: symbol, timeOutC: symbol,
      status: 'excused', statusMsg: 'Nghỉ phép',
      notes: `Nghỉ phép (${symbol}) — Báo cáo vắng mặt`,
    }, silent);
  };

  const doWorked = (entry: any, silent = false) => {
    const cfg = readHrmConfigFromStorage();
    const mi = cfg.morningIn || '07:30';
    const mo = cfg.morningOut || '11:30';
    const ai = cfg.afternoonIn || '13:00';
    const ao = cfg.afternoonOut || '17:00';
    createRecord(entry, {
      ...baseRecord(entry),
      timeInS: mi, timeOutS: mo, timeInC: ai, timeOutC: ao,
      status: 'valid', statusMsg: 'Hợp lệ',
      notes: 'Đi làm (HR bù công, quên chấm) — Báo cáo vắng mặt',
    }, silent);
  };

  const doDismiss = (entry: any, silent = false) => {
    setDismissed((prev) => new Set(prev).add(keyOf(entry)));
    setSelected((prev) => { const n = new Set(prev); n.delete(keyOf(entry)); return n; });
    if (!silent) {
      addToast({ title: '↪️ Đã bỏ qua', message: `${entry.empName} — ${entry.date} không tạo bản ghi.`, type: 'info' });
    }
  };

  const ACTION_LABEL: Record<string, string> = {
    kp: 'Gán KP (vắng không phép)',
    phep: `Gán phép (${phepSymbol})`,
    worked: 'Đã đi làm (quên chấm)',
    dismiss: 'Bỏ qua',
  };

  const applyBatch = () => {
    if (!batchAction) {
      addToast({ title: '⚠️ Chưa chọn hành động', message: 'Vui lòng chọn hành động trước khi áp dụng.', type: 'warning' });
      return;
    }
    const targets = visible.filter((e) => selected.has(keyOf(e)));
    if (targets.length === 0) {
      addToast({ title: '⚠️ Chưa chọn dòng', message: 'Vui lòng chọn ít nhất 1 dòng để duyệt.', type: 'warning' });
      return;
    }
    targets.forEach((entry) => {
      if (batchAction === 'kp') doKP(entry, true);
      else if (batchAction === 'phep') doPhep(entry, phepSymbol, true);
      else if (batchAction === 'worked') doWorked(entry, true);
      else if (batchAction === 'dismiss') doDismiss(entry, true);
    });
    addToast({
      title: '✅ Đã duyệt hàng loạt',
      message: `Đã áp dụng "${ACTION_LABEL[batchAction]}" cho ${targets.length} dòng.`,
      type: 'success',
    });
    setSelected(new Set());
  };

  const toggleAll = () => {
    if (selected.size >= visible.length && visible.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visible.map(keyOf)));
    }
  };

  const monthLabel = `${String(rptMonth).padStart(2, '0')}/${rptYear}`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-2 gap-2">
        <div className="flex items-center gap-2">
          <UserX className="w-4 h-4 text-rose-400" />
          <span className="text-sm font-bold text-white">Báo cáo vắng mặt</span>
          <span className="text-[11px] text-slate-500">tháng {monthLabel}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value as any); setSelected(new Set()); }}
            className="bg-slate-950 border border-slate-800 text-slate-300 px-2 py-1 rounded text-[11px] cursor-pointer outline-none"
          >
            <option value="absent">Vắng KP ({counts.absent})</option>
            <option value="holiday">Nghỉ lễ ({counts.holiday})</option>
            <option value="weekend">Nghỉ cuối tuần ({counts.weekend})</option>
            <option value="all">Tất cả ({entries.length})</option>
          </select>
          <select
            value={filterEmp}
            onChange={(e) => { setFilterEmp(e.target.value); setSelected(new Set()); }}
            className="bg-slate-950 border border-slate-800 text-slate-300 px-2 py-1 rounded text-[11px] cursor-pointer outline-none max-w-[160px]"
          >
            <option value="all">👥 Tất cả NV</option>
            {empOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <select
            value={rptMonth}
            onChange={(e) => { setRptMonth(e.target.value); setSelected(new Set()); }}
            className="bg-slate-950 border border-slate-800 text-slate-300 px-2 py-1 rounded text-[11px] cursor-pointer outline-none"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={String(m)}>{`Th${m}`}</option>
            ))}
          </select>
          <select
            value={rptDay}
            onChange={(e) => { setRptDay(e.target.value); setSelected(new Set()); }}
            className="bg-slate-950 border border-slate-800 text-slate-300 px-2 py-1 rounded text-[11px] cursor-pointer outline-none"
          >
            {rptDayOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={rptYear}
            onChange={(e) => { setRptYear(e.target.value); setSelected(new Set()); }}
            className="bg-slate-950 border border-slate-800 text-slate-300 px-2 py-1 rounded text-[11px] cursor-pointer outline-none"
          >
            {rptYearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Giải thích loại trừ */}
      <div className="text-[10px] text-slate-500 bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 flex items-start gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
        <span>
          Chỉ nhân viên <strong className="text-slate-300">Đang làm</strong>. Đã loại trừ: Admin/Giám đốc, ngày trước ngày vào làm,
          đơn nghỉ đã duyệt, và ngày tương lai. Các ngày nghỉ lễ/cuối tuần không có bản ghi mặc định = 0 công
          (không sai); chuyển sang <strong className="text-slate-300">Tất cả</strong> nếu cần bù công ngày lễ quên chấm.
        </span>
      </div>

      {/* Thanh duyệt hàng loạt */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={visible.length > 0 && selected.size >= visible.length}
            onChange={toggleAll}
            className="w-4 h-4 text-amber-500 border-slate-600 rounded cursor-pointer"
          />
          Chọn tất cả hiển thị ({visible.length})
        </label>
        <span className="text-[11px] text-slate-400">Đã chọn: <strong className="text-amber-400">{selected.size}</strong> dòng</span>
        <div className="flex items-center gap-2 ml-auto">
          <select
            value={batchAction}
            onChange={(e) => setBatchAction(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-300 px-2 py-1.5 rounded text-[11px] cursor-pointer outline-none"
          >
            <option value="">— Chọn hành động —</option>
            <option value="kp">Gán KP (vắng không phép)</option>
            <option value="phep">Gán phép (chọn loại)</option>
            <option value="worked">Đã đi làm (quên chấm)</option>
            <option value="dismiss">Bỏ qua</option>
          </select>
          {batchAction === 'phep' && (
            <select
              value={phepSymbol}
              onChange={(e) => setPhepSymbol(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-300 px-2 py-1.5 rounded text-[11px] cursor-pointer outline-none"
            >
              {PHEP_OPTIONS.map((p) => (
                <option key={p.symbol} value={p.symbol}>{p.label}</option>
              ))}
            </select>
          )}
          <button
            onClick={applyBatch}
            className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-1.5 rounded text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Layers className="w-3.5 h-3.5" /> Áp dụng cho {selected.size} dòng
          </button>
        </div>
      </div>

      {/* Bảng */}
      {visible.length === 0 ? (
        <div className="text-center py-10 text-slate-500 font-semibold bg-slate-900/40 border border-slate-800 rounded-xl">
          <CalendarCheck className="w-8 h-8 mx-auto mb-2 text-emerald-500/70" />
          Không có ngày vắng mặt nào trong bộ lọc này.
        </div>
      ) : (
        <div className="overflow-x-auto bg-slate-900/40 border border-slate-800 rounded-xl">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800">
                <th className="py-2.5 pl-2 text-left w-8"></th>
                <th className="py-2.5 pl-1 text-left">Nhân viên</th>
                <th className="py-2.5 text-left">Ngày</th>
                <th className="py-2.5 text-left">Thứ</th>
                <th className="py-2.5 text-left">Loại</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {visible.map((e) => {
                const checked = selected.has(keyOf(e));
                const meta = TYPE_META[e.type];
                return (
                  <tr key={keyOf(e)} className={`hover:bg-slate-950/40 transition-colors ${checked ? 'bg-amber-500/10' : ''}`}>
                    <td className="py-2 pl-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSelected((prev) => {
                            const n = new Set(prev);
                            if (n.has(keyOf(e))) n.delete(keyOf(e));
                            else n.add(keyOf(e));
                            return n;
                          });
                        }}
                        className="w-4 h-4 text-amber-500 border-slate-600 rounded cursor-pointer"
                      />
                    </td>
                    <td className="py-2 pl-1 font-semibold text-white leading-tight">
                      <div className="flex items-center gap-1.5">
                        <span>{e.empName}</span>
                        <span className="text-[8.5px] bg-slate-800 text-slate-400 font-mono px-1 rounded">{e.empId}</span>
                      </div>
                    </td>
                    <td className="py-2 font-mono text-slate-400">{e.date}</td>
                    <td className="py-2 text-slate-400">{WEEKDAY[e.dayOfWeek]}</td>
                    <td className="py-2">
                      <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-bold ${meta.cls}`}>
                        {meta.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
        <CalendarX className="w-3.5 h-3.5" />
        Gợi ý: chọn nhiều dòng → chọn hành động → “Áp dụng”. HR duyệt thủ công, hệ thống không tự động phạt.
      </div>
    </div>
  );
}
