import React, { useState, useMemo } from 'react';
import { AlertTriangle, CalendarCheck, Layers } from 'lucide-react';
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
  absent: { label: 'Vắng KP', cls: 'text-rose-700 bg-rose-50 border-rose-200' },
  holiday: { label: 'Nghỉ lễ', cls: 'text-violet-700 bg-violet-50 border-violet-200' },
  weekend: { label: 'Nghỉ cuối tuần', cls: 'text-slate-600 bg-slate-100 border-slate-200' },
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
  const fmtDate = (d: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : d; };
  const allChecked = visible.length > 0 && selected.size >= visible.length;
  const toggleOne = (k: string) => setSelected((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const inputCls = 'h-9 bg-white border border-slate-200 text-slate-800 rounded-xl px-2.5 text-[13px] font-bold cursor-pointer outline-none focus:border-blue-400';
  const resetSel = () => setSelected(new Set());

  return (
    <div className="space-y-3" data-testid="miss-root">
      {/* Chip chọn loại (kèm số lượng) — thay cho ô chọn loại cũ */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5" data-testid="miss-chips">
        {([['absent', 'Vắng KP', counts.absent], ['holiday', 'Nghỉ lễ', counts.holiday], ['weekend', 'Nghỉ cuối tuần', counts.weekend], ['all', 'Tất cả', entries.length]] as const).map(([k, label, n]) => {
          const on = filterType === k;
          return (
            <button key={k} type="button" data-testid={`miss-chip-${k}`} onClick={() => { setFilterType(k); resetSel(); }}
              style={on ? { background: '#e8efff', color: '#0d47c9', borderColor: '#bcd0ff' } : undefined}
              className={`h-8 px-3 rounded-full text-xs font-bold whitespace-nowrap border cursor-pointer ${on ? '' : 'bg-white text-slate-600 border-slate-200'}`}>{label} {n}</button>
          );
        })}
      </div>

      {/* Bộ lọc riêng của báo cáo: nhân viên / tháng / ngày / năm */}
      <div className="flex flex-wrap items-center gap-2" data-testid="miss-filters">
        <select value={filterEmp} onChange={(e) => { setFilterEmp(e.target.value); resetSel(); }} aria-label="Nhân viên" className={`${inputCls} flex-1 min-w-[150px]`}>
          <option value="all">Tất cả nhân viên</option>
          {empOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <select value={rptMonth} onChange={(e) => { setRptMonth(e.target.value); resetSel(); }} aria-label="Tháng" className={inputCls}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={String(m)}>Tháng {m}</option>)}
        </select>
        <select value={rptDay} onChange={(e) => { setRptDay(e.target.value); resetSel(); }} aria-label="Ngày" className={inputCls}>
          {rptDayOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={rptYear} onChange={(e) => { setRptYear(e.target.value); resetSel(); }} aria-label="Năm" className={inputCls}>
          {rptYearOptions.map((y) => <option key={y} value={y}>Năm {y}</option>)}
        </select>
      </div>

      {/* Ghi chú ngắn về cách tính (đã lược bớt) */}
      <div className="text-xs text-slate-500 flex items-start gap-2 px-1" data-testid="miss-note">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
        <span>Chỉ tính nhân viên đang làm; đã loại Admin/Giám đốc, đơn nghỉ đã duyệt và ngày tương lai. Ngày lễ/cuối tuần không có bản ghi = 0 công — chọn "Tất cả" nếu cần bù công.</span>
      </div>

      {/* Thanh duyệt hàng loạt — chỉ hiện khi đã tick chọn */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl border border-blue-200 bg-blue-50" data-testid="miss-bulkbar">
          <span className="text-[13px] font-bold" style={{ color: '#0d47c9' }}>Đã chọn {selected.size}</span>
          <span className="flex-1" />
          <select value={batchAction} onChange={(e) => setBatchAction(e.target.value)} aria-label="Hành động" data-testid="miss-action" className={`${inputCls} h-8 text-xs`}>
            <option value="">Chọn hành động</option>
            <option value="kp">Gán KP (vắng không phép)</option>
            <option value="phep">Gán phép (chọn loại)</option>
            <option value="worked">Đã đi làm (quên chấm)</option>
            <option value="dismiss">Bỏ qua</option>
          </select>
          {batchAction === 'phep' && (
            <select value={phepSymbol} onChange={(e) => setPhepSymbol(e.target.value)} aria-label="Loại phép" className={`${inputCls} h-8 text-xs`}>
              {PHEP_OPTIONS.map((p) => <option key={p.symbol} value={p.symbol}>{p.label}</option>)}
            </select>
          )}
          <button type="button" onClick={applyBatch} data-testid="miss-apply"
            style={{ background: '#0d47c9', color: '#ffffff' }}
            className="h-8 px-3.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"><Layers className="w-3.5 h-3.5" /> Áp dụng</button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {visible.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-sm" data-testid="miss-empty">
            <CalendarCheck className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
            Không có ngày vắng mặt nào trong bộ lọc này.
          </div>
        ) : (
          <>
            {/* MÁY TÍNH: bảng */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]" data-testid="miss-table">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs">
                    <th className="px-3 py-2.5 w-10 text-center">
                      <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Chọn tất cả" className="w-4 h-4 rounded cursor-pointer" />
                    </th>
                    <th className="px-3 py-2.5 font-bold">Nhân viên</th>
                    <th className="px-3 py-2.5 font-bold">Ngày</th>
                    <th className="px-3 py-2.5 font-bold">Thứ</th>
                    <th className="px-3 py-2.5 font-bold">Loại</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((e) => {
                    const k = keyOf(e);
                    const checked = selected.has(k);
                    return (
                      <tr key={k} data-testid={`miss-row-${k}`} onClick={() => toggleOne(k)}
                        className={`border-b border-slate-100 cursor-pointer transition-colors hover:bg-blue-50/50 ${checked ? 'bg-blue-50' : ''}`}>
                        <td className="px-3 py-2.5 text-center">
                          <input type="checkbox" checked={checked} aria-label={`Chọn ${e.empName}`} onClick={(ev) => ev.stopPropagation()} onChange={() => toggleOne(k)} className="w-4 h-4 rounded cursor-pointer" />
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="font-bold text-slate-900">{e.empName}</span>
                          <span className="ml-2 font-mono text-[11px] text-slate-500">{e.empId}</span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-600">{fmtDate(e.date)}</td>
                        <td className="px-3 py-2.5 text-slate-600">{WEEKDAY[e.dayOfWeek]}</td>
                        <td className="px-3 py-2.5"><span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${TYPE_META[e.type].cls}`}>{TYPE_META[e.type].label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ĐIỆN THOẠI: thẻ */}
            <div className="md:hidden" data-testid="miss-cards">
              <label className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 text-xs text-slate-600 font-bold cursor-pointer">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} className="w-4 h-4 rounded cursor-pointer" /> Chọn tất cả ({visible.length})
              </label>
              {visible.map((e) => {
                const k = keyOf(e);
                const checked = selected.has(k);
                return (
                  <div key={k} data-testid={`miss-card-${k}`} onClick={() => toggleOne(k)}
                    className={`flex items-start gap-2.5 px-3 py-3 border-b border-slate-100 last:border-b-0 cursor-pointer ${checked ? 'bg-blue-50' : ''}`}>
                    <input type="checkbox" checked={checked} aria-label={`Chọn ${e.empName}`} onClick={(ev) => ev.stopPropagation()} onChange={() => toggleOne(k)} className="w-4 h-4 rounded cursor-pointer mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-slate-900 text-sm leading-snug">{e.empName}</div>
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${TYPE_META[e.type].cls}`}>{TYPE_META[e.type].label}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5"><span className="font-mono">{e.empId}</span> · {WEEKDAY[e.dayOfWeek]} · <span className="font-mono">{fmtDate(e.date)}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        <div className="px-3 py-2.5 border-t border-slate-200 text-xs text-slate-500">{visible.length} dòng · tháng {monthLabel}</div>
      </div>
    </div>
  );
}
