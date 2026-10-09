// ─── Tab "Phòng Dự Án" của Bảng điều hành Giám đốc ─────────────────────────────────────────────────────────────
// Một cái nhìn đủ để điều hành: bao nhiêu công trình đang chạy / trễ / vượt chi, từng công trình tiến độ - tiền - việc ra sao, và danh sách công việc
// (đang làm, quá hạn, chưa làm, chờ duyệt) có lọc theo công trình / người phụ trách. Danh sách dài đều có phân trang + chọn số dòng.
import React, { useMemo, useState } from 'react';
import { HardHat, ListChecks, FileDown } from 'lucide-react';
import type { Project, Task, Receipt, Payment, Employee, Customer } from '../../types';
import { todayYmd, toDay, bucketTasks, buildProjectFinance, type ProjectFinanceRow } from '../../lib/executiveDashboard';
import { matchesQuery } from '../../lib/directorViews';
import { Card, Stat, Badge, Bar, Empty, FilterBar, SearchBox, SelectBox, usePager, fmtFull, fmtShort, dmy, tableHead, Th, type Tone } from './kit';

interface Props {
  projects: Project[]; tasks: Task[]; receipts: Receipt[]; payments: Payment[]; employees: Employee[]; customers: Customer[];
  onNavigateTab: (tabId: string) => void;
}

const TYPE_LABEL: Record<string, string> = { construction: 'Xây dựng', furniture: 'Nội thất', mechanical: 'Cơ khí', general: 'Khác' };
const STATUS_LABEL: Record<string, string> = { new: 'Mới', processing: 'Đang thi công', paused: 'Tạm dừng', maintenance: 'Bảo hành', completed: 'Hoàn thành', cancelled: 'Đã hủy' };
const STATUS_TONE: Record<string, Tone> = { new: 'sky', processing: 'emerald', paused: 'amber', maintenance: 'indigo', completed: 'slate', cancelled: 'rose' };
const projectTab = (p: Project) => p.type === 'furniture' ? 'projects-furniture' : p.type === 'mechanical' ? 'projects-mechanical' : 'projects-construction';

type TaskView = 'all' | 'doing' | 'overdue' | 'todo' | 'reviewing' | 'completed';
const TASK_VIEW_LABEL: Record<TaskView, string> = { all: 'Tất cả', doing: 'Đang làm', overdue: 'Quá hạn', todo: 'Chưa làm', reviewing: 'Chờ duyệt', completed: 'Đã hoàn thành' };

export default function ProjectsView({ projects, tasks, receipts, payments, employees, customers, onNavigateTab }: Props) {
  const today = useMemo(() => todayYmd(), []);
  const empName = (id?: string) => employees.find(e => e.id === id)?.name || '—';
  const custName = (id?: string) => customers.find(c => c.id === id)?.name || '—';

  // ─── Số liệu từng công trình ───
  const fin = useMemo(() => new Map(buildProjectFinance(projects, receipts, payments, today).map(r => [r.project.id, r] as const)), [projects, receipts, payments, today]);
  const taskStats = useMemo(() => {
    const m = new Map<string, { open: number; overdue: number; todo: number; doing: number }>();
    for (const p of projects) {
      const mine = tasks.filter(t => t.projectId === p.id);
      const b = bucketTasks(mine, today);
      m.set(p.id, { open: mine.filter(t => t.status !== 'completed').length, overdue: b.overdue.length, todo: b.todo.length, doing: b.doing.length });
    }
    return m;
  }, [projects, tasks, today]);

  // ─── Bộ lọc công trình ───
  const [q, setQ] = useState(''); const [type, setType] = useState('all'); const [status, setStatus] = useState('all'); const [pm, setPm] = useState('all'); const [health, setHealth] = useState('all');
  const projectFilterActive = !!q || type !== 'all' || status !== 'all' || pm !== 'all' || health !== 'all';
  const resetProjects = () => { setQ(''); setType('all'); setStatus('all'); setPm('all'); setHealth('all'); };

  const filteredProjects = useMemo(() => projects.filter(p => {
    const f = fin.get(p.id), ts = taskStats.get(p.id);
    if (!matchesQuery(q, p.name, p.code, empName(p.pmId), custName(p.customerId), p.address)) return false;
    if (type !== 'all' && (p.type || 'general') !== type) return false;
    if (status !== 'all' && p.status !== status) return false;
    if (pm !== 'all' && p.pmId !== pm) return false;
    if (health === 'late' && !f?.flags.includes('late')) return false;
    if (health === 'overdueTasks' && !(ts && ts.overdue > 0)) return false;
    if (health === 'budget' && !(f && (f.flags.includes('overBudget') || f.flags.includes('nearBudget') || f.flags.includes('loss')))) return false;
    return true;
  }).sort((a, b) => (fin.get(b.id)?.spent || 0) - (fin.get(a.id)?.spent || 0)), [projects, fin, taskStats, q, type, status, pm, health, employees, customers]);

  const projectPager = usePager(filteredProjects, [q, type, status, pm, health].join('|'));

  // ─── Tổng quan (trên TOÀN BỘ công trình, không phụ thuộc bộ lọc) ───
  const active = projects.filter(p => p.status === 'processing' || p.status === 'new');
  const lateProjects = [...fin.values()].filter(r => r.flags.includes('late')).length;
  const budgetRisk = [...fin.values()].filter(r => r.flags.includes('overBudget') || r.flags.includes('loss')).length;
  const avgProgress = active.length ? Math.round(active.reduce((s, p) => s + (p.progress || 0), 0) / active.length) : 0;
  const byType = (['construction', 'furniture', 'mechanical', 'general'] as const).map(t => {
    const list = projects.filter(p => (p.type || 'general') === t && p.status !== 'cancelled');
    return { t, count: list.length, running: list.filter(p => p.status === 'processing' || p.status === 'new').length, value: list.reduce((s, p) => s + (p.contractValue || 0), 0) };
  });

  // ─── Danh sách công việc ───
  const [tq, setTq] = useState(''); const [tProject, setTProject] = useState('all'); const [tView, setTView] = useState<TaskView>('all'); const [tAssignee, setTAssignee] = useState('all');
  const taskFilterActive = !!tq || tProject !== 'all' || tView !== 'all' || tAssignee !== 'all';
  const resetTasks = () => { setTq(''); setTProject('all'); setTView('all'); setTAssignee('all'); };
  const buckets = useMemo(() => bucketTasks(tasks, today), [tasks, today]);
  const overdueMap = useMemo(() => new Map(buckets.overdue.map(t => [t.id, t.daysLate] as const)), [buckets]);

  const filteredTasks = useMemo(() => tasks.filter(t => {
    const late = overdueMap.has(t.id);
    if (tView === 'doing' && t.status !== 'doing') return false;
    if (tView === 'overdue' && !late) return false;
    if (tView === 'todo' && !(t.status === 'todo' && !late)) return false;
    if (tView === 'reviewing' && t.status !== 'reviewing') return false;
    if (tView === 'completed' && t.status !== 'completed') return false;
    if (tProject !== 'all' && t.projectId !== tProject) return false;
    if (tAssignee !== 'all' && t.assigneeId !== tAssignee) return false;
    return matchesQuery(tq, t.name, t.code, empName(t.assigneeId), projects.find(p => p.id === t.projectId)?.name);
  }).sort((a, b) => (overdueMap.get(b.id) || 0) - (overdueMap.get(a.id) || 0) || (toDay(a.deadline) || '9999').localeCompare(toDay(b.deadline) || '9999')),
  [tasks, tView, tProject, tAssignee, tq, overdueMap, employees, projects]);
  const taskPager = usePager(filteredTasks, [tq, tProject, tView, tAssignee].join('|'));

  const exportCsv = () => {
    const head = ['Mã', 'Công trình', 'Loại', 'Trạng thái', 'Trưởng dự án', 'Khách hàng', 'Tiến độ (%)', 'Kết thúc dự kiến', 'Giá trị hợp đồng', 'Đã thu', 'Đã chi', 'Việc đang mở', 'Việc quá hạn'];
    const body = filteredProjects.map(p => { const f = fin.get(p.id); const ts = taskStats.get(p.id); return [p.code, p.name, TYPE_LABEL[p.type || 'general'], STATUS_LABEL[p.status] || p.status, empName(p.pmId), custName(p.customerId), p.progress || 0, toDay(p.endDate), f?.contractValue || 0, f?.collected || 0, f?.spent || 0, ts?.open || 0, ts?.overdue || 0]; });
    const csv = [head, ...body].map(l => l.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `cong-trinh-${today}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const pmOptions = [{ value: 'all', label: 'Tất cả' }, ...Array.from(new Set(projects.map(p => p.pmId).filter(Boolean))).map(id => ({ value: id as string, label: empName(id as string) }))];
  const assigneeOptions = [{ value: 'all', label: 'Tất cả' }, ...Array.from(new Set(tasks.map(t => t.assigneeId).filter(Boolean))).map(id => ({ value: id as string, label: empName(id as string) }))];

  return (
    <div className="space-y-4" id="director_view_projects">
      {/* Chỉ số tổng quan — bấm vào ô để lọc nhanh danh sách bên dưới */}
      <Card title="Tổng quan Phòng Dự Án" icon={<HardHat className="w-4 h-4 text-sky-500" />}>
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2.5">
          <Stat label="Tổng công trình" value={String(projects.filter(p => p.status !== 'cancelled').length)} sub={`${projects.filter(p => p.status === 'completed').length} đã hoàn thành`} tone="indigo" onClick={resetProjects} />
          <Stat label="Đang chạy" value={String(active.length)} sub={`Tiến độ TB ${avgProgress}%`} tone="emerald" onClick={() => { resetProjects(); setStatus('processing'); }} active={status === 'processing'} />
          <Stat label="Trễ tiến độ" value={String(lateProjects)} sub="Quá ngày kết thúc" tone={lateProjects ? 'rose' : 'slate'} onClick={() => { resetProjects(); setHealth('late'); }} active={health === 'late'} />
          <Stat label="Chi vượt / chi > thu" value={String(budgetRisk)} sub="Cần xem lại ngân sách" tone={budgetRisk ? 'rose' : 'slate'} onClick={() => { resetProjects(); setHealth('budget'); }} active={health === 'budget'} />
          <Stat label="Việc đang làm" value={String(buckets.doing.length)} tone="sky" onClick={() => { resetTasks(); setTView('doing'); }} active={tView === 'doing'} />
          <Stat label="Việc quá hạn" value={String(buckets.overdue.length)} tone={buckets.overdue.length ? 'rose' : 'slate'} onClick={() => { resetTasks(); setTView('overdue'); }} active={tView === 'overdue'} />
          <Stat label="Việc chưa làm" value={String(buckets.todo.length)} tone="amber" onClick={() => { resetTasks(); setTView('todo'); }} active={tView === 'todo'} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mt-3">
          {byType.map(x => (
            <button key={x.t} type="button" onClick={() => { resetProjects(); setType(x.t); }} aria-pressed={type === x.t}
              className={`text-left border rounded-xl px-3 py-2 cursor-pointer transition-colors ${type === x.t ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-200 hover:bg-amber-50/40'}`}>
              <span className="block text-[11px] font-black text-slate-700">{TYPE_LABEL[x.t]}</span>
              <span className="block text-[11px] text-slate-500">{x.count} công trình · {x.running} đang chạy</span>
              <span className="block text-[11px] font-mono font-bold text-indigo-600">{fmtShort(x.value)}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Danh sách công trình */}
      <Card title="Danh sách công trình" icon={<HardHat className="w-4 h-4 text-indigo-500" />}
        right={<button type="button" onClick={exportCsv} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[10.5px] font-bold text-slate-700 cursor-pointer"><FileDown className="w-3.5 h-3.5" />Xuất Excel (CSV)</button>}>
        <FilterBar onReset={resetProjects} active={projectFilterActive}>
          <SearchBox value={q} onChange={setQ} placeholder="Tên, mã, trưởng dự án, khách hàng, địa chỉ…" />
          <SelectBox label="Loại" value={type} onChange={setType} options={[{ value: 'all', label: 'Tất cả' }, ...Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))]} />
          <SelectBox label="Trạng thái" value={status} onChange={setStatus} options={[{ value: 'all', label: 'Tất cả' }, ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))]} />
          <SelectBox label="Trưởng dự án" value={pm} onChange={setPm} options={pmOptions} />
          <SelectBox label="Tình trạng" value={health} onChange={setHealth} options={[{ value: 'all', label: 'Tất cả' }, { value: 'late', label: 'Trễ tiến độ' }, { value: 'overdueTasks', label: 'Có việc quá hạn' }, { value: 'budget', label: 'Chi vượt / sắp hết ngân sách' }]} />
        </FilterBar>
        {filteredProjects.length === 0 ? <Empty>Không có công trình nào khớp bộ lọc.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11.5px]">
              <thead><tr className={tableHead}>
                <Th>Công trình</Th><Th>Trưởng dự án</Th><Th className="min-w-[120px]">Tiến độ</Th><Th>Kết thúc dự kiến</Th><Th right>Giá trị HĐ</Th><Th right>Đã thu</Th><Th right>Đã chi</Th><Th right>Việc mở / quá hạn</Th><Th>Trạng thái</Th>
              </tr></thead>
              <tbody>
                {projectPager.rows.map(p => {
                  const f = fin.get(p.id) as ProjectFinanceRow | undefined; const ts = taskStats.get(p.id);
                  return (
                    <tr key={p.id} onClick={() => onNavigateTab(projectTab(p))} className="border-b border-slate-100 hover:bg-amber-50/40 cursor-pointer transition-colors">
                      <td className="px-3 py-2.5"><div className="font-bold text-slate-800">{p.name}</div><div className="text-[10px] text-slate-400 font-mono">{p.code} · {TYPE_LABEL[p.type || 'general']} · {custName(p.customerId)}</div></td>
                      <td className="px-3 py-2.5 text-slate-700">{empName(p.pmId)}</td>
                      <td className="px-3 py-2.5"><div className="flex items-center gap-2"><Bar pct={p.progress || 0} tone={f?.flags.includes('late') ? 'amber' : 'emerald'} /><b className="text-[10.5px] w-9 text-right">{p.progress || 0}%</b></div></td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{dmy(toDay(p.endDate))}{f?.flags.includes('late') && <span className="block"><Badge tone="rose">Trễ tiến độ</Badge></span>}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{fmtFull(f?.contractValue || 0)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-emerald-600">{fmtFull(f?.collected || 0)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-rose-600">{fmtFull(f?.spent || 0)}{f && (f.flags.includes('overBudget') || f.flags.includes('loss')) && <span className="block"><Badge tone="rose">Cần xem ngân sách</Badge></span>}</td>
                      <td className="px-3 py-2.5 text-right">{ts?.open || 0}{(ts?.overdue || 0) > 0 && <span className="text-rose-600 font-bold"> / {ts?.overdue}</span>}</td>
                      <td className="px-3 py-2.5"><Badge tone={STATUS_TONE[p.status] || 'slate'}>{STATUS_LABEL[p.status] || p.status}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {projectPager.bar}
      </Card>

      {/* Danh sách công việc */}
      <Card title="Công việc toàn doanh nghiệp" icon={<ListChecks className="w-4 h-4 text-amber-500" />}
        right={<button type="button" onClick={() => onNavigateTab('tasks')} className="text-[10.5px] font-bold text-sky-600 hover:text-sky-500 cursor-pointer">Mở "Việc của tôi"</button>}>
        <FilterBar onReset={resetTasks} active={taskFilterActive}>
          <SearchBox value={tq} onChange={setTq} placeholder="Tên việc, mã, người phụ trách, công trình…" />
          <SelectBox label="Tình trạng" value={tView} onChange={v => setTView(v as TaskView)} options={(Object.keys(TASK_VIEW_LABEL) as TaskView[]).map(v => ({ value: v, label: TASK_VIEW_LABEL[v] }))} />
          <SelectBox label="Công trình" value={tProject} onChange={setTProject} options={[{ value: 'all', label: 'Tất cả' }, ...projects.map(p => ({ value: p.id, label: p.name }))]} />
          <SelectBox label="Người phụ trách" value={tAssignee} onChange={setTAssignee} options={assigneeOptions} />
        </FilterBar>
        {filteredTasks.length === 0 ? <Empty>Không có công việc nào khớp bộ lọc.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11.5px]">
              <thead><tr className={tableHead}><Th>Công việc</Th><Th>Công trình</Th><Th>Người phụ trách</Th><Th>Hạn</Th><Th className="min-w-[110px]">Hoàn thành</Th><Th>Tình trạng</Th></tr></thead>
              <tbody>
                {taskPager.rows.map(t => {
                  const late = overdueMap.get(t.id);
                  return (
                    <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                      <td className="px-3 py-2.5 font-bold text-slate-800">{t.name}<div className="text-[10px] text-slate-400 font-mono font-normal">{t.code}</div></td>
                      <td className="px-3 py-2.5 text-slate-600">{projects.find(p => p.id === t.projectId)?.name || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-700">{empName(t.assigneeId)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{dmy(toDay(t.deadline))}</td>
                      <td className="px-3 py-2.5"><div className="flex items-center gap-2"><Bar pct={t.completionRate || 0} tone="sky" /><b className="text-[10.5px] w-9 text-right">{t.completionRate || 0}%</b></div></td>
                      <td className="px-3 py-2.5">
                        {late ? <Badge tone="rose">Trễ {late} ngày</Badge> : t.status === 'doing' ? <Badge tone="sky">Đang làm</Badge> : t.status === 'reviewing' ? <Badge tone="amber">Chờ duyệt</Badge> : t.status === 'completed' ? <Badge tone="emerald">Hoàn thành</Badge> : <Badge tone="slate">Chưa làm</Badge>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {taskPager.bar}
      </Card>
    </div>
  );
}
