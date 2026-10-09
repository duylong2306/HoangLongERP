// ─── Tab "Phòng Nhân Sự" của Bảng điều hành Giám đốc ─────────────────────────────────────────────────────────────
// Hôm nay: bao nhiêu người đi làm / nghỉ phép / chưa chấm công, theo từng phòng ban; danh sách nhân sự (kèm số công trong tháng) và đơn nghỉ / tạm ứng lương.
// Mọi danh sách có lọc + phân trang + chọn số dòng.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, CalendarDays, RefreshCw } from 'lucide-react';
import { dbService } from '../../lib/dbService';
import type { Employee } from '../../types';
import { todayYmd, toDay, summarizeAttendance, employeeTodayStates, workedDaysByEmployee } from '../../lib/executiveDashboard';
import { matchesQuery, rangeOf, inRange, type DatePreset } from '../../lib/directorViews';
import { Card, Stat, Badge, Bar, Empty, FilterBar, SearchBox, SelectBox, DateRangeFilter, usePager, dmy, tableHead, Th, type Tone } from './kit';

interface Props { employees: Employee[]; onNavigateTab: (tabId: string) => void }

const EMP_STATUS: Record<string, string> = { working: 'Đang làm việc', leave: 'Nghỉ dài hạn', retired: 'Đã nghỉ việc', director_board: 'Ban giám đốc' };
const LEAVE_STATUS: Record<string, { label: string; tone: Tone }> = { pending: { label: 'Chờ duyệt', tone: 'amber' }, approved: { label: 'Đã duyệt', tone: 'emerald' }, rejected: { label: 'Từ chối', tone: 'rose' } };

export default function HrView({ employees, onNavigateTab }: Props) {
  const today = useMemo(() => todayYmd(), []);
  const monthStart = `${today.slice(0, 7)}-01`;
  const [logs, setLogs] = useState<any[]>([]);
  const [monthLogs, setMonthLogs] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Mỗi nguồn tải độc lập: lỗi một nguồn thì phần khác vẫn hiển thị
  const load = useCallback(async () => {
    setLoading(true);
    const [a, m, l] = await Promise.allSettled([
      dbService.attendance.listForRange(today, today),
      dbService.attendance.listForRange(monthStart, today),
      dbService.hrmLeaves.list(),
    ]);
    if (a.status === 'fulfilled') setLogs(a.value || []);
    if (m.status === 'fulfilled') setMonthLogs(m.value || []);
    if (l.status === 'fulfilled') setLeaves(l.value || []);
    setLoading(false);
  }, [today, monthStart]);
  useEffect(() => {
    load();
    window.addEventListener('hl-attendance-realtime', load);
    return () => window.removeEventListener('hl-attendance-realtime', load);
  }, [load]);

  const staff = useMemo(() => employees.filter(e => !e.status || e.status === 'working'), [employees]);
  const att = useMemo(() => summarizeAttendance(employees, logs, leaves, today), [employees, logs, leaves, today]);
  const states = useMemo(() => employeeTodayStates(employees, logs, leaves, today), [employees, logs, leaves, today]);
  const worked = useMemo(() => workedDaysByEmployee(monthLogs), [monthLogs]);

  // ─── Theo phòng ban ───
  const deptRows = useMemo(() => {
    const m = new Map<string, { dept: string; total: number; present: number; leave: number }>();
    for (const e of staff) {
      const d = e.department || 'Chưa xếp phòng';
      const r = m.get(d) || { dept: d, total: 0, present: 0, leave: 0 };
      r.total += 1;
      const st = states.get(e.id);
      if (st === 'present') r.present += 1; else if (st === 'leave') r.leave += 1;
      m.set(d, r);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [staff, states]);

  // ─── Lọc danh sách nhân sự ───
  const [q, setQ] = useState(''); const [dept, setDept] = useState('all'); const [empStatus, setEmpStatus] = useState('working'); const [today_, setTodayState] = useState('all');
  const empActive = !!q || dept !== 'all' || empStatus !== 'working' || today_ !== 'all';
  const resetEmp = () => { setQ(''); setDept('all'); setEmpStatus('working'); setTodayState('all'); };
  const filteredEmps = useMemo(() => employees.filter(e => {
    const st = e.status || 'working';
    if (empStatus !== 'all' && st !== empStatus) return false;
    if (dept !== 'all' && (e.department || 'Chưa xếp phòng') !== dept) return false;
    if (today_ !== 'all' && states.get(e.id) !== today_) return false;
    return matchesQuery(q, e.name, e.position, e.department, e.phone, e.id);
  }).sort((a, b) => a.name.localeCompare(b.name, 'vi')), [employees, empStatus, dept, today_, q, states]);
  const empPager = usePager(filteredEmps, [q, dept, empStatus, today_].join('|'));
  const deptOptions = [{ value: 'all', label: 'Tất cả' }, ...Array.from(new Set(employees.map(e => e.department || 'Chưa xếp phòng'))).sort().map(d => ({ value: d, label: d }))];

  // ─── Lọc đơn nghỉ / tạm ứng lương ───
  const [lq, setLq] = useState(''); const [lStatus, setLStatus] = useState('pending'); const [lType, setLType] = useState('all');
  const [preset, setPreset] = useState<DatePreset>('all'); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const leaveActive = !!lq || lStatus !== 'pending' || lType !== 'all' || preset !== 'all';
  const resetLeave = () => { setLq(''); setLStatus('pending'); setLType('all'); setPreset('all'); setFrom(''); setTo(''); };
  const range = useMemo(() => rangeOf(preset, today, from, to), [preset, today, from, to]);
  const leaveTypes = useMemo(() => Array.from(new Set(leaves.map(l => l.type).filter(Boolean))).sort(), [leaves]);
  const filteredLeaves = useMemo(() => leaves.filter(l => {
    if (lStatus !== 'all' && l.status !== lStatus) return false;
    if (lType !== 'all' && l.type !== lType) return false;
    if (!inRange(l.fromDate, range)) return false;
    return matchesQuery(lq, l.empName, l.type, l.reason, l.approverName, l.id);
  }).sort((a, b) => (toDay(b.fromDate) || '').localeCompare(toDay(a.fromDate) || '')), [leaves, lStatus, lType, range, lq]);
  const leavePager = usePager(filteredLeaves, [lq, lStatus, lType, preset, from, to].join('|'));

  const stateBadge = (id: string) => {
    const st = states.get(id);
    return st === 'present' ? <Badge tone="emerald">Đã chấm công</Badge> : st === 'leave' ? <Badge tone="sky">Nghỉ có phép</Badge> : <Badge tone="amber">Chưa chấm công</Badge>;
  };

  return (
    <div className="space-y-4" id="director_view_hr">
      <Card title="Tổng quan nhân sự hôm nay" icon={<Users className="w-4 h-4 text-amber-500" />}
        right={<button type="button" onClick={load} disabled={loading} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[10.5px] font-bold text-slate-700 cursor-pointer disabled:opacity-60"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />Làm mới</button>}>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
          <Stat label="Quân số đang làm" value={String(att.expected)} sub={`${employees.length} hồ sơ nhân sự`} tone="indigo" onClick={resetEmp} />
          <Stat label="Đã chấm công" value={`${att.present}/${att.expected}`} sub={`${att.presentRate}% có mặt`} tone="emerald" onClick={() => { resetEmp(); setTodayState('present'); }} active={today_ === 'present'} />
          <Stat label="Nghỉ có phép" value={String(att.onLeave)} tone="sky" onClick={() => { resetEmp(); setTodayState('leave'); }} active={today_ === 'leave'} />
          <Stat label="Chưa chấm công" value={String(att.notChecked)} tone={att.notChecked ? 'amber' : 'slate'} onClick={() => { resetEmp(); setTodayState('missing'); }} active={today_ === 'missing'} />
          <Stat label="Đơn chờ duyệt" value={String(att.pendingLeaves)} sub="Nghỉ phép / tạm ứng lương" tone={att.pendingLeaves ? 'amber' : 'slate'} onClick={() => { resetLeave(); setLStatus('pending'); }} active={lStatus === 'pending'} />
          <Stat label="Đã nghỉ việc / nghỉ dài hạn" value={String(employees.filter(e => e.status === 'retired' || e.status === 'leave').length)} tone="slate" onClick={() => { resetEmp(); setEmpStatus('retired'); }} />
        </div>
        <div className="mt-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2">Theo phòng ban (bấm để lọc danh sách)</p>
          {deptRows.length === 0 ? <Empty>Chưa có nhân sự đang làm việc.</Empty> : (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {deptRows.map(d => (
                <li key={d.dept}>
                  <button type="button" onClick={() => { resetEmp(); setDept(d.dept); }} className={`w-full text-left border rounded-xl px-3 py-2 cursor-pointer transition-colors ${dept === d.dept ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-200 hover:bg-amber-50/40'}`}>
                    <div className="flex justify-between text-[11.5px]"><b className="text-slate-800">{d.dept}</b><span className="text-slate-500">{d.present}/{d.total} có mặt{d.leave ? ` · ${d.leave} nghỉ phép` : ''}</span></div>
                    <div className="mt-1.5"><Bar pct={d.total ? Math.round((d.present / d.total) * 100) : 0} tone="emerald" h="h-2" /></div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card title="Danh sách nhân sự" icon={<Users className="w-4 h-4 text-indigo-500" />}
        right={<button type="button" onClick={() => onNavigateTab('employees')} className="text-[10.5px] font-bold text-amber-600 hover:text-amber-500 cursor-pointer">Mở Hệ thống Nhân sự</button>}>
        <FilterBar onReset={resetEmp} active={empActive}>
          <SearchBox value={q} onChange={setQ} placeholder="Tên, chức vụ, phòng ban, số điện thoại…" />
          <SelectBox label="Phòng ban" value={dept} onChange={setDept} options={deptOptions} />
          <SelectBox label="Tình trạng làm việc" value={empStatus} onChange={setEmpStatus} options={[{ value: 'all', label: 'Tất cả' }, ...Object.entries(EMP_STATUS).map(([value, label]) => ({ value, label }))]} />
          <SelectBox label="Chấm công hôm nay" value={today_} onChange={setTodayState} options={[{ value: 'all', label: 'Tất cả' }, { value: 'present', label: 'Đã chấm công' }, { value: 'leave', label: 'Nghỉ có phép' }, { value: 'missing', label: 'Chưa chấm công' }]} />
        </FilterBar>
        {filteredEmps.length === 0 ? <Empty>Không có nhân sự nào khớp bộ lọc.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11.5px]">
              <thead><tr className={tableHead}><Th>Nhân sự</Th><Th>Phòng ban</Th><Th>Chức vụ</Th><Th>Điện thoại</Th><Th>Vào làm</Th><Th right>Công tháng {today.slice(5, 7)}</Th><Th>Hôm nay</Th></tr></thead>
              <tbody>
                {empPager.rows.map(e => (
                  <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="px-3 py-2.5 font-bold text-slate-800">{e.name}{(e.status && e.status !== 'working') && <span className="ml-1.5"><Badge tone={e.status === 'retired' ? 'rose' : 'slate'}>{EMP_STATUS[e.status]}</Badge></span>}</td>
                    <td className="px-3 py-2.5 text-slate-600">{e.department || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-600">{e.position || '—'}</td>
                    <td className="px-3 py-2.5 font-mono text-slate-600">{e.phone || '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{dmy(toDay(e.startDate))}</td>
                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap font-bold">{worked.get(e.id) || 0}</td>
                    <td className="px-3 py-2.5">{(!e.status || e.status === 'working') ? stateBadge(e.id) : <span className="text-slate-400">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {empPager.bar}
      </Card>

      <Card title="Đơn nghỉ phép / tạm ứng lương" icon={<CalendarDays className="w-4 h-4 text-sky-500" />}>
        <FilterBar onReset={resetLeave} active={leaveActive}>
          <SearchBox value={lq} onChange={setLq} placeholder="Tên nhân sự, loại đơn, lý do, người duyệt…" />
          <SelectBox label="Trạng thái" value={lStatus} onChange={setLStatus} options={[{ value: 'all', label: 'Tất cả' }, ...Object.entries(LEAVE_STATUS).map(([value, v]) => ({ value, label: v.label }))]} />
          <SelectBox label="Loại đơn" value={lType} onChange={setLType} options={[{ value: 'all', label: 'Tất cả' }, ...leaveTypes.map(t => ({ value: t as string, label: t as string }))]} />
          <DateRangeFilter preset={preset} from={from} to={to} onChange={(p, f, t) => { setPreset(p); setFrom(f); setTo(t); }} />
        </FilterBar>
        {filteredLeaves.length === 0 ? <Empty>Không có đơn nào khớp bộ lọc.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11.5px]">
              <thead><tr className={tableHead}><Th>Nhân sự</Th><Th>Loại đơn</Th><Th>Từ ngày</Th><Th>Đến ngày</Th><Th right>Số ngày</Th><Th>Lý do</Th><Th>Người duyệt</Th><Th>Trạng thái</Th></tr></thead>
              <tbody>
                {leavePager.rows.map(l => (
                  <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="px-3 py-2.5 font-bold text-slate-800">{l.empName || l.empId}</td>
                    <td className="px-3 py-2.5 text-slate-600">{l.type}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{dmy(toDay(l.fromDate))}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{dmy(toDay(l.toDate || l.fromDate))}</td>
                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">{l.daysCount ?? '—'}</td>
                    <td className="px-3 py-2.5 text-slate-600 max-w-[260px] truncate" title={l.reason}>{l.reason || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-600">{l.approverName || '—'}</td>
                    <td className="px-3 py-2.5"><Badge tone={LEAVE_STATUS[l.status]?.tone || 'slate'}>{LEAVE_STATUS[l.status]?.label || l.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {leavePager.bar}
      </Card>
    </div>
  );
}
