// ─── Tab "Nhà Thầu Phụ" của Bảng điều hành Giám đốc ─────────────────────────────────────────────────────────────
// Mỗi thầu phụ: bao nhiêu hợp đồng, tổng giá trị đã duyệt, đã chi, còn phải chi, công nợ, đề xuất đang chờ; và danh sách hợp đồng thầu phụ theo công trình.
// Danh sách có lọc + phân trang + chọn số dòng.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Briefcase, RefreshCw } from 'lucide-react';
import { dbService } from '../../lib/dbService';
import type { Project, Payment } from '../../types';
import { todayYmd, toDay } from '../../lib/executiveDashboard';
import { matchesQuery, rangeOf, inRange, buildSubcontractorRows, contractAmount, type DatePreset } from '../../lib/directorViews';
import { Card, Stat, Badge, Bar, Empty, FilterBar, SearchBox, SelectBox, DateRangeFilter, usePager, fmtFull, fmtShort, dmy, tableHead, Th } from './kit';

interface Props { projects: Project[]; payments: Payment[]; onNavigateTab: (tabId: string) => void }

export default function SubcontractorView({ projects, payments, onNavigateTab }: Props) {
  const today = useMemo(() => todayYmd(), []);
  const [subs, setSubs] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    const [s, c, a] = await Promise.allSettled([dbService.accountingSubcontractors.list(), dbService.archivedQuotes.list('subcontractor'), dbService.subcontractorAdvances.list()]);
    if (s.status === 'fulfilled') setSubs(s.value || []);
    if (c.status === 'fulfilled') setContracts(c.value || []);
    if (a.status === 'fulfilled') setAdvances(a.value || []);
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
    window.addEventListener('hl-suppliers-updated', load);
    window.addEventListener('hl-archived-quotes-updated', load);
    return () => { window.removeEventListener('hl-suppliers-updated', load); window.removeEventListener('hl-archived-quotes-updated', load); };
  }, [load]);

  const projName = (id?: string, snap?: string) => snap || projects.find(p => p.id === id)?.name || '';
  const subName = (id?: string, snap?: string) => snap || subs.find(s => s.id === id)?.name || '—';
  const rows = useMemo(() => buildSubcontractorRows(subs, contracts, payments, advances), [subs, contracts, payments, advances]);

  const totalContract = rows.reduce((s, r) => s + r.contractValue, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0);
  const totalRemaining = rows.reduce((s, r) => s + r.remaining, 0);
  const totalDebt = rows.reduce((s, r) => s + r.debt, 0);
  const pendingProps = advances.filter(a => a.subcontractorId && (a.status === 'pending_approval' || a.status === 'pending_payment' || a.status === 'awaiting_voucher_update')).length;
  const working = rows.filter(r => r.approvedContracts > 0).length;

  // ─── Danh sách thầu phụ ───
  const [q, setQ] = useState(''); const [field, setField] = useState('all'); const [state, setState] = useState('all'); const [project, setProject] = useState('all');
  const subActive = !!q || field !== 'all' || state !== 'all' || project !== 'all';
  const resetSub = () => { setQ(''); setField('all'); setState('all'); setProject('all'); };
  const fields = Array.from(new Set(subs.map(s => s.field || 'Chưa phân loại'))).sort();
  const list = useMemo(() => rows.filter(r => {
    if (field !== 'all' && (r.sub.field || 'Chưa phân loại') !== field) return false;
    if (project !== 'all' && !r.projectIds.includes(project)) return false;
    if (state === 'working' && r.approvedContracts === 0) return false;
    if (state === 'noContract' && r.contracts > 0) return false;
    if (state === 'debt' && r.debt <= 0) return false;
    if (state === 'proposal' && r.pendingProposals === 0) return false;
    return matchesQuery(q, r.sub.name, r.sub.representative, r.sub.phone, r.sub.field, r.sub.region);
  }).sort((a, b) => b.contractValue - a.contractValue || String(a.sub.name).localeCompare(String(b.sub.name), 'vi')), [rows, field, project, state, q]);
  const subPager = usePager(list, [q, field, state, project].join('|'));

  // ─── Danh sách hợp đồng thầu phụ ───
  const [cq, setCq] = useState(''); const [cStatus, setCStatus] = useState('all'); const [cProject, setCProject] = useState('all');
  const [preset, setPreset] = useState<DatePreset>('all'); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const range = useMemo(() => rangeOf(preset, today, from, to), [preset, today, from, to]);
  const conActive = !!cq || cStatus !== 'all' || cProject !== 'all' || preset !== 'all';
  const resetCon = () => { setCq(''); setCStatus('all'); setCProject('all'); setPreset('all'); setFrom(''); setTo(''); };
  const conList = useMemo(() => contracts.filter(c => inRange(c.date || c.createdAt, range) && (cProject === 'all' || c.projectId === cProject)
    && (cStatus === 'all' || (cStatus === 'approved' ? c.isApproved === true : c.isApproved !== true))
    && matchesQuery(cq, c.code, c.id, subName(c.subcontractorId, c.subcontractorName), projName(c.projectId, c.projectName), c.workName, c.scopeWork)).sort((a, b) => String(b.date || b.createdAt || '').localeCompare(String(a.date || a.createdAt || ''))),
    [contracts, range, cProject, cStatus, cq, subs, projects]);
  const conPager = usePager(conList, [cq, cStatus, cProject, preset, from, to].join('|'));
  const projectOptions = [{ value: 'all', label: 'Tất cả' }, ...projects.map(p => ({ value: p.id, label: p.name }))];

  return (
    <div className="space-y-4" id="director_view_subcontractor">
      <Card title="Tổng quan nhà thầu phụ" icon={<Briefcase className="w-4 h-4 text-orange-500" />}
        right={<button type="button" onClick={load} disabled={loading} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[10.5px] font-bold text-slate-700 cursor-pointer disabled:opacity-60"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />Làm mới</button>}>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
          <Stat label="Thầu phụ hợp tác" value={String(subs.length)} sub={`${working} đang có hợp đồng`} tone="indigo" onClick={resetSub} />
          <Stat label="Giá trị hợp đồng đã duyệt" value={fmtShort(totalContract)} sub={`${contracts.filter(c => c.isApproved === true).length} hợp đồng`} tone="indigo" />
          <Stat label="Đã chi cho thầu phụ" value={fmtShort(totalPaid)} sub={totalContract ? `${Math.round((totalPaid / totalContract) * 100)}% giá trị hợp đồng` : undefined} tone="rose" />
          <Stat label="Còn phải chi theo HĐ" value={fmtShort(totalRemaining)} tone="amber" />
          <Stat label="Công nợ ghi nhận" value={fmtShort(totalDebt)} tone={totalDebt ? 'amber' : 'slate'} onClick={() => { resetSub(); setState('debt'); }} active={state === 'debt'} />
          <Stat label="Đề xuất đang chờ" value={String(pendingProps)} sub="Chờ duyệt / lập phiếu chi" tone={pendingProps ? 'amber' : 'slate'} onClick={() => { resetSub(); setState('proposal'); }} active={state === 'proposal'} />
        </div>
      </Card>

      <Card title="Danh sách thầu phụ" icon={<Briefcase className="w-4 h-4 text-indigo-500" />}
        right={<button type="button" onClick={() => onNavigateTab('subcontractor-management')} className="text-[10.5px] font-bold text-orange-600 hover:text-orange-500 cursor-pointer">Mở Quản lý thầu phụ</button>}>
        <FilterBar onReset={resetSub} active={subActive}>
          <SearchBox value={q} onChange={setQ} placeholder="Tên thầu phụ, người đại diện, điện thoại, khu vực…" />
          <SelectBox label="Lĩnh vực" value={field} onChange={setField} options={[{ value: 'all', label: 'Tất cả' }, ...fields.map(f => ({ value: f, label: f }))]} />
          <SelectBox label="Tình trạng" value={state} onChange={setState} options={[{ value: 'all', label: 'Tất cả' }, { value: 'working', label: 'Đang có hợp đồng' }, { value: 'noContract', label: 'Chưa có hợp đồng' }, { value: 'debt', label: 'Còn công nợ' }, { value: 'proposal', label: 'Có đề xuất đang chờ' }]} />
          <SelectBox label="Công trình" value={project} onChange={setProject} options={projectOptions} />
        </FilterBar>
        {list.length === 0 ? <Empty>{subs.length === 0 ? 'Chưa có thầu phụ nào.' : 'Không có thầu phụ nào khớp bộ lọc.'}</Empty> : (
          <div className="overflow-x-auto"><table className="w-full text-left text-[11.5px]">
            <thead><tr className={tableHead}><Th>Thầu phụ</Th><Th>Lĩnh vực</Th><Th right>Hợp đồng</Th><Th right>Giá trị đã duyệt</Th><Th className="min-w-[130px]">Đã chi / hợp đồng</Th><Th right>Đã chi</Th><Th right>Còn phải chi</Th><Th right>Công nợ</Th><Th right>Công trình</Th><Th right>Đề xuất chờ</Th></tr></thead>
            <tbody>{subPager.rows.map(r => {
              const pct = r.contractValue > 0 ? Math.round((r.paid / r.contractValue) * 100) : 0;
              return (
                <tr key={r.sub.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                  <td className="px-3 py-2.5 font-bold text-slate-800">{r.sub.name}<div className="text-[10px] font-normal text-slate-400">{r.sub.representative || '—'} · {r.sub.phone || '—'}</div></td>
                  <td className="px-3 py-2.5 text-slate-600">{r.sub.field || '—'}</td>
                  <td className="px-3 py-2.5 text-right">{r.approvedContracts}/{r.contracts}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{fmtFull(r.contractValue)}</td>
                  <td className="px-3 py-2.5"><div className="flex items-center gap-2"><Bar pct={pct} tone={pct > 100 ? 'rose' : pct >= 80 ? 'amber' : 'sky'} /><b className="text-[10.5px] w-9 text-right">{pct}%</b></div></td>
                  <td className="px-3 py-2.5 text-right font-mono text-rose-600">{fmtFull(r.paid)}{r.pendingPaid > 0 && <span className="block text-[10px] text-amber-600">+ {fmtShort(r.pendingPaid)} chờ duyệt</span>}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-amber-600">{fmtFull(r.remaining)}</td>
                  <td className={`px-3 py-2.5 text-right font-mono ${r.debt > 0 ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>{fmtFull(r.debt)}</td>
                  <td className="px-3 py-2.5 text-right">{r.projectIds.length}</td>
                  <td className="px-3 py-2.5 text-right">{r.pendingProposals > 0 ? <Badge tone="amber">{r.pendingProposals}</Badge> : <span className="text-slate-300">0</span>}</td>
                </tr>);
            })}</tbody>
          </table></div>
        )}
        {subPager.bar}
      </Card>

      <Card title="Hợp đồng thầu phụ theo công trình" icon={<Briefcase className="w-4 h-4 text-sky-500" />}>
        <FilterBar onReset={resetCon} active={conActive}>
          <SearchBox value={cq} onChange={setCq} placeholder="Mã hợp đồng, thầu phụ, công trình, hạng mục…" />
          <DateRangeFilter preset={preset} from={from} to={to} onChange={(p, f, t) => { setPreset(p); setFrom(f); setTo(t); }} />
          <SelectBox label="Trạng thái" value={cStatus} onChange={setCStatus} options={[{ value: 'all', label: 'Tất cả' }, { value: 'approved', label: 'Đã duyệt' }, { value: 'pending', label: 'Chờ duyệt' }]} />
          <SelectBox label="Công trình" value={cProject} onChange={setCProject} options={projectOptions} />
        </FilterBar>
        {conList.length === 0 ? <Empty>Không có hợp đồng thầu phụ nào khớp bộ lọc.</Empty> : (
          <div className="overflow-x-auto"><table className="w-full text-left text-[11.5px]">
            <thead><tr className={tableHead}><Th>Ngày</Th><Th>Mã</Th><Th>Thầu phụ</Th><Th>Công trình</Th><Th>Hạng mục</Th><Th right>Giá trị</Th><Th>Trạng thái</Th></tr></thead>
            <tbody>{conPager.rows.map(c => (
              <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                <td className="px-3 py-2.5 whitespace-nowrap">{dmy(toDay(c.date || c.createdAt))}</td>
                <td className="px-3 py-2.5 font-mono text-slate-500">{c.code || c.id}</td>
                <td className="px-3 py-2.5 font-bold text-slate-800">{subName(c.subcontractorId, c.subcontractorName)}</td>
                <td className="px-3 py-2.5 text-slate-600">{projName(c.projectId, c.projectName) || '—'}</td>
                <td className="px-3 py-2.5 text-slate-600 max-w-[220px] truncate" title={c.workName || c.scopeWork}>{c.workName || c.scopeWork || '—'}</td>
                <td className="px-3 py-2.5 text-right font-mono font-bold">{fmtFull(contractAmount(c))}</td>
                <td className="px-3 py-2.5">{c.isApproved === true ? <Badge tone="emerald">Đã duyệt</Badge> : <Badge tone="amber">Chờ duyệt</Badge>}</td>
              </tr>))}</tbody>
            <tfoot><tr className="bg-slate-50 font-black text-slate-800 border-t border-slate-200"><td className="px-3 py-2.5" colSpan={5}>TỔNG ({conList.length} hợp đồng)</td><td className="px-3 py-2.5 text-right font-mono">{fmtFull(conList.reduce((s, c) => s + contractAmount(c), 0))}</td><td /></tr></tfoot>
          </table></div>
        )}
        {conPager.bar}
      </Card>
    </div>
  );
}
