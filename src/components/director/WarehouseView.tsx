// ─── Tab "Kho & Vật Tư" của Bảng điều hành Giám đốc ────────────────────────────────────────────────────────────────
// Tồn kho (hàng sắp hết / hết), đơn mua hàng theo ngày và công nợ nhà cung cấp, đề xuất vật tư đang kẹt ở bước nào. 3 danh sách có lọc + phân trang.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PackageOpen, RefreshCw } from 'lucide-react';
import { dbService } from '../../lib/dbService';
import type { Project } from '../../types';
import { todayYmd, toDay, materialByDay, proposalStatusCounts, supplierPayable, PROPOSAL_STATUS_LABELS } from '../../lib/executiveDashboard';
import { matchesQuery, rangeOf, inRange, type DatePreset } from '../../lib/directorViews';
import { Card, Stat, Badge, Empty, PairBars, FilterBar, SearchBox, SelectBox, DateRangeFilter, usePager, fmtFull, fmtShort, dm, dmy, tableHead, Th, type Tone } from './kit';

interface Props { projects: Project[]; onNavigateTab: (tabId: string) => void }

type Tab = 'stock' | 'order' | 'prop';
const ORDER_STATUS: Record<string, { label: string; tone: Tone }> = { draft: { label: 'Nháp', tone: 'slate' }, confirmed: { label: 'Đã xác nhận', tone: 'sky' }, completed: { label: 'Hoàn thành', tone: 'emerald' }, cancelled: { label: 'Đã hủy', tone: 'rose' } };
const PROP_TONE: Record<string, Tone> = { find_supplier: 'rose', waiting_approval: 'amber', waiting_order: 'indigo', ordered: 'sky', received: 'emerald', cancelled: 'slate' };

/** Tình trạng tồn của một mặt hàng: hết hàng / sắp hết (≤ mức cảnh báo) / bình thường */
const stockState = (it: any): 'out' | 'low' | 'ok' => ((it.qty || 0) <= 0 ? 'out' : (it.minAlert || 0) > 0 && (it.qty || 0) <= (it.minAlert || 0) ? 'low' : 'ok');

export default function WarehouseView({ projects, onNavigateTab }: Props) {
  const today = useMemo(() => todayYmd(), []);
  const [inventory, setInventory] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    const [i, o, p] = await Promise.allSettled([dbService.inventory.list(), dbService.purchaseOrders.list(), dbService.materialProposals.list()]);
    if (i.status === 'fulfilled') setInventory(i.value || []);
    if (o.status === 'fulfilled') setOrders(o.value || []);
    if (p.status === 'fulfilled') setProposals(p.value || []);
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
    window.addEventListener('hl-material-proposals-updated', load);
    window.addEventListener('hl-inventory-updated', load);
    return () => { window.removeEventListener('hl-material-proposals-updated', load); window.removeEventListener('hl-inventory-updated', load); };
  }, [load]);

  const projName = (id?: string, snap?: string) => snap || projects.find(p => p.id === id)?.name || '';
  const [tab, setTab] = useState<Tab>('stock');

  // ─── Chỉ số tổng quan ───
  const stockValue = inventory.reduce((s, it) => s + (it.qty || 0) * (it.unitPrice || 0), 0);
  const lowCount = inventory.filter(it => stockState(it) === 'low').length;
  const outCount = inventory.filter(it => stockState(it) === 'out').length;
  const live = orders.filter(o => o.status !== 'draft' && o.status !== 'cancelled');
  const days = useMemo(() => materialByDay(orders, proposals, today, 14), [orders, proposals, today]);
  const todayRow = days[days.length - 1];
  const payable = supplierPayable(orders);
  const statusCounts = useMemo(() => proposalStatusCounts(proposals), [proposals]);

  // ─── Tồn kho ───
  const [sq, setSq] = useState(''); const [sState, setSState] = useState('all'); const [sLoc, setSLoc] = useState('all');
  const stockActive = !!sq || sState !== 'all' || sLoc !== 'all';
  const resetStock = () => { setSq(''); setSState('all'); setSLoc('all'); };
  const stockList = useMemo(() => inventory.filter(it => (sState === 'all' || stockState(it) === sState) && (sLoc === 'all' || (it.location || 'Chưa xếp vị trí') === sLoc)
    && matchesQuery(sq, it.name, it.code, it.location)).sort((a, b) => ({ out: 0, low: 1, ok: 2 }[stockState(a)] - { out: 0, low: 1, ok: 2 }[stockState(b)]) || String(a.name).localeCompare(String(b.name), 'vi')),
    [inventory, sState, sLoc, sq]);
  const stockPager = usePager(stockList, [sq, sState, sLoc].join('|'));
  const locations = Array.from(new Set(inventory.map(it => it.location || 'Chưa xếp vị trí'))).sort();

  // ─── Đơn mua ───
  const [oq, setOq] = useState(''); const [oStatus, setOStatus] = useState('all'); const [oProject, setOProject] = useState('all'); const [oDebt, setODebt] = useState('all');
  const [preset, setPreset] = useState<DatePreset>('30d'); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const range = useMemo(() => rangeOf(preset, today, from, to), [preset, today, from, to]);
  const orderActive = !!oq || oStatus !== 'all' || oProject !== 'all' || oDebt !== 'all' || preset !== '30d';
  const resetOrder = () => { setOq(''); setOStatus('all'); setOProject('all'); setODebt('all'); setPreset('30d'); setFrom(''); setTo(''); };
  const orderList = useMemo(() => orders.filter(o => inRange(o.createdAt, range) && (oStatus === 'all' || o.status === oStatus) && (oProject === 'all' || o.projectId === oProject)
    && (oDebt === 'all' || (oDebt === 'debt' ? (o.congNo || 0) > 0 : (o.congNo || 0) <= 0))
    && matchesQuery(oq, o.id, o.supplierName, o.projectName, o.proposalCode, o.notes)).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))),
    [orders, range, oStatus, oProject, oDebt, oq]);
  const orderPager = usePager(orderList, [oq, oStatus, oProject, oDebt, preset, from, to].join('|'));

  // ─── Đề xuất vật tư ───
  const [pq, setPq] = useState(''); const [pStatus, setPStatus] = useState('all'); const [pProject, setPProject] = useState('all');
  const [pPreset, setPPreset] = useState<DatePreset>('all'); const [pFrom, setPFrom] = useState(''); const [pTo, setPTo] = useState('');
  const pRange = useMemo(() => rangeOf(pPreset, today, pFrom, pTo), [pPreset, today, pFrom, pTo]);
  const propActive = !!pq || pStatus !== 'all' || pProject !== 'all' || pPreset !== 'all';
  const resetProp = () => { setPq(''); setPStatus('all'); setPProject('all'); setPPreset('all'); setPFrom(''); setPTo(''); };
  const propList = useMemo(() => proposals.filter(p => inRange(p.createdAt, pRange) && (pStatus === 'all' || p.status === pStatus) && (pProject === 'all' || p.projectId === pProject)
    && matchesQuery(pq, p.code, p.projectName, p.taskName, p.createdByName, p.supplierName)).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))),
    [proposals, pRange, pStatus, pProject, pq]);
  const propPager = usePager(propList, [pq, pStatus, pProject, pPreset, pFrom, pTo].join('|'));

  const projectOptions = [{ value: 'all', label: 'Tất cả' }, ...projects.map(p => ({ value: p.id, label: p.name }))];
  const tabBtn = (k: Tab, label: string, n: number) => (
    <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
      className={`px-3.5 py-2 rounded-lg text-[11.5px] font-bold border cursor-pointer transition-colors ${tab === k ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>{label} ({n})</button>
  );

  return (
    <div className="space-y-4" id="director_view_warehouse">
      <Card title="Tổng quan kho & vật tư" icon={<PackageOpen className="w-4 h-4 text-teal-500" />}
        right={<button type="button" onClick={load} disabled={loading} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[10.5px] font-bold text-slate-700 cursor-pointer disabled:opacity-60"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />Làm mới</button>}>
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-2.5">
          <Stat label="Mặt hàng trong kho" value={String(inventory.length)} sub={`Giá trị tồn ${fmtShort(stockValue)}`} tone="indigo" onClick={() => { setTab('stock'); resetStock(); }} />
          <Stat label="Sắp hết hàng" value={String(lowCount)} tone={lowCount ? 'amber' : 'slate'} onClick={() => { setTab('stock'); resetStock(); setSState('low'); }} active={tab === 'stock' && sState === 'low'} />
          <Stat label="Hết hàng" value={String(outCount)} tone={outCount ? 'rose' : 'slate'} onClick={() => { setTab('stock'); resetStock(); setSState('out'); }} active={tab === 'stock' && sState === 'out'} />
          <Stat label="Đơn mua hôm nay" value={String(todayRow?.orders || 0)} tone="teal" onClick={() => { setTab('order'); resetOrder(); setPreset('today'); }} />
          <Stat label="Đơn mua 14 ngày" value={String(days.reduce((s, d) => s + d.orders, 0))} sub={`${live.length} đơn hiệu lực`} tone="teal" />
          <Stat label="Nợ nhà cung cấp" value={fmtShort(payable)} tone={payable ? 'amber' : 'slate'} onClick={() => { setTab('order'); resetOrder(); setPreset('all'); setODebt('debt'); }} active={tab === 'order' && oDebt === 'debt'} />
          <Stat label="Đề xuất hôm nay" value={String(todayRow?.proposals || 0)} tone="indigo" onClick={() => { setTab('prop'); resetProp(); setPPreset('today'); }} />
          <Stat label="Đề xuất chờ duyệt" value={String(statusCounts.find(s => s.key === 'waiting_approval')?.count || 0)} tone={(statusCounts.find(s => s.key === 'waiting_approval')?.count || 0) ? 'amber' : 'slate'} onClick={() => { setTab('prop'); resetProp(); setPStatus('waiting_approval'); }} active={tab === 'prop' && pStatus === 'waiting_approval'} />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-4">
          <div className="xl:col-span-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Số đơn mua và đề xuất theo ngày (14 ngày)</p>
            <PairBars data={days.map(d => ({ label: dm(d.day), a: d.orders, b: d.proposals }))} colorA="fill-teal-500" colorB="fill-indigo-400" titleA="Đơn mua" titleB="Đề xuất" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Đề xuất đang ở bước nào (bấm để lọc)</p>
            <ul className="space-y-1.5">
              {statusCounts.map(s => (
                <li key={s.key}><button type="button" onClick={() => { setTab('prop'); resetProp(); setPStatus(s.key); }} className="w-full flex items-center justify-between border border-slate-200 bg-white hover:bg-amber-50/40 rounded-lg px-3 py-1.5 text-[11.5px] cursor-pointer transition-colors">
                  <span className="font-bold text-slate-700">{s.label}</span><Badge tone={PROP_TONE[s.key] || 'slate'}>{s.count}</Badge></button></li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <Card title="Chi tiết" icon={<PackageOpen className="w-4 h-4 text-indigo-500" />}
        right={<button type="button" onClick={() => onNavigateTab(tab === 'stock' ? 'warehouse-management' : 'material-coordination')} className="text-[10.5px] font-bold text-teal-600 hover:text-teal-500 cursor-pointer">{tab === 'stock' ? 'Mở Quản lý tồn kho' : 'Mở Điều phối vật tư'}</button>}>
        <div className="flex flex-wrap gap-1.5 mb-3" role="tablist" aria-label="Chi tiết kho và vật tư">
          {tabBtn('stock', 'Tồn kho', stockList.length)}{tabBtn('order', 'Đơn mua hàng', orderList.length)}{tabBtn('prop', 'Đề xuất vật tư', propList.length)}
        </div>

        {tab === 'stock' && (<>
          <FilterBar onReset={resetStock} active={stockActive}>
            <SearchBox value={sq} onChange={setSq} placeholder="Tên vật tư, mã, vị trí…" />
            <SelectBox label="Tình trạng tồn" value={sState} onChange={setSState} options={[{ value: 'all', label: 'Tất cả' }, { value: 'low', label: 'Sắp hết' }, { value: 'out', label: 'Hết hàng' }, { value: 'ok', label: 'Bình thường' }]} />
            <SelectBox label="Vị trí kho" value={sLoc} onChange={setSLoc} options={[{ value: 'all', label: 'Tất cả' }, ...locations.map(l => ({ value: l, label: l }))]} />
          </FilterBar>
          {stockList.length === 0 ? <Empty>{inventory.length === 0 ? 'Kho chưa có mặt hàng nào.' : 'Không có mặt hàng nào khớp bộ lọc.'}</Empty> : (
            <div className="overflow-x-auto"><table className="w-full text-left text-[11.5px]">
              <thead><tr className={tableHead}><Th>Vật tư</Th><Th>Đơn vị</Th><Th right>Tồn</Th><Th right>Mức cảnh báo</Th><Th right>Đơn giá</Th><Th right>Giá trị tồn</Th><Th>Vị trí</Th><Th>Tình trạng</Th></tr></thead>
              <tbody>{stockPager.rows.map(it => {
                const st = stockState(it);
                return (
                  <tr key={it.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="px-3 py-2.5 font-bold text-slate-800">{it.name}<div className="text-[10px] font-mono font-normal text-slate-400">{it.code}</div></td>
                    <td className="px-3 py-2.5 text-slate-600">{it.unit}</td>
                    <td className={`px-3 py-2.5 text-right font-mono font-bold ${st === 'ok' ? 'text-slate-800' : st === 'low' ? 'text-amber-600' : 'text-rose-600'}`}>{(it.qty || 0).toLocaleString('vi-VN')}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-500">{(it.minAlert || 0).toLocaleString('vi-VN')}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{fmtFull(it.unitPrice || 0)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{fmtFull((it.qty || 0) * (it.unitPrice || 0))}</td>
                    <td className="px-3 py-2.5 text-slate-600">{it.location || '—'}</td>
                    <td className="px-3 py-2.5">{st === 'out' ? <Badge tone="rose">Hết hàng</Badge> : st === 'low' ? <Badge tone="amber">Sắp hết</Badge> : <Badge tone="emerald">Bình thường</Badge>}</td>
                  </tr>);
              })}</tbody>
            </table></div>
          )}
          {stockPager.bar}
        </>)}

        {tab === 'order' && (<>
          <FilterBar onReset={resetOrder} active={orderActive}>
            <SearchBox value={oq} onChange={setOq} placeholder="Mã đơn, nhà cung cấp, công trình, mã đề xuất…" />
            <DateRangeFilter preset={preset} from={from} to={to} onChange={(p, f, t) => { setPreset(p); setFrom(f); setTo(t); }} />
            <SelectBox label="Trạng thái" value={oStatus} onChange={setOStatus} options={[{ value: 'all', label: 'Tất cả' }, ...Object.entries(ORDER_STATUS).map(([value, v]) => ({ value, label: v.label }))]} />
            <SelectBox label="Công nợ" value={oDebt} onChange={setODebt} options={[{ value: 'all', label: 'Tất cả' }, { value: 'debt', label: 'Còn nợ nhà cung cấp' }, { value: 'paid', label: 'Đã thanh toán đủ' }]} />
            <SelectBox label="Công trình" value={oProject} onChange={setOProject} options={projectOptions} />
          </FilterBar>
          {orderList.length === 0 ? <Empty>Không có đơn mua nào khớp bộ lọc.</Empty> : (
            <div className="overflow-x-auto"><table className="w-full text-left text-[11.5px]">
              <thead><tr className={tableHead}><Th>Ngày</Th><Th>Mã đơn</Th><Th>Nhà cung cấp</Th><Th>Công trình</Th><Th right>Tổng tiền</Th><Th right>Đã thanh toán</Th><Th right>Còn nợ</Th><Th>Trạng thái</Th></tr></thead>
              <tbody>{orderPager.rows.map(o => (
                <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                  <td className="px-3 py-2.5 whitespace-nowrap">{dmy(toDay(o.createdAt))}</td>
                  <td className="px-3 py-2.5 font-mono text-slate-500">{o.id}{o.proposalCode && <div className="text-[10px]">từ {o.proposalCode}</div>}</td>
                  <td className="px-3 py-2.5 font-bold text-slate-800">{o.fromWarehouse ? 'Xuất từ kho' : (o.supplierName || '—')}</td>
                  <td className="px-3 py-2.5 text-slate-600">{projName(o.projectId, o.projectName) || '—'}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{fmtFull(o.tongTien || 0)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-emerald-600">{fmtFull(o.thanhToanThucTe || 0)}</td>
                  <td className={`px-3 py-2.5 text-right font-mono font-bold ${(o.congNo || 0) > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{fmtFull(o.congNo || 0)}</td>
                  <td className="px-3 py-2.5"><Badge tone={ORDER_STATUS[o.status]?.tone || 'slate'}>{ORDER_STATUS[o.status]?.label || o.status}</Badge></td>
                </tr>))}</tbody>
              <tfoot><tr className="bg-slate-50 font-black text-slate-800 border-t border-slate-200"><td className="px-3 py-2.5" colSpan={4}>TỔNG ({orderList.length} đơn)</td>
                <td className="px-3 py-2.5 text-right font-mono">{fmtFull(orderList.reduce((s, o) => s + (o.tongTien || 0), 0))}</td>
                <td className="px-3 py-2.5 text-right font-mono text-emerald-600">{fmtFull(orderList.reduce((s, o) => s + (o.thanhToanThucTe || 0), 0))}</td>
                <td className="px-3 py-2.5 text-right font-mono text-amber-600">{fmtFull(orderList.reduce((s, o) => s + (o.congNo || 0), 0))}</td><td /></tr></tfoot>
            </table></div>
          )}
          {orderPager.bar}
        </>)}

        {tab === 'prop' && (<>
          <FilterBar onReset={resetProp} active={propActive}>
            <SearchBox value={pq} onChange={setPq} placeholder="Mã đề xuất, công trình, công việc, người tạo…" />
            <DateRangeFilter preset={pPreset} from={pFrom} to={pTo} onChange={(p, f, t) => { setPPreset(p); setPFrom(f); setPTo(t); }} />
            <SelectBox label="Bước xử lý" value={pStatus} onChange={setPStatus} options={[{ value: 'all', label: 'Tất cả' }, ...Object.entries(PROPOSAL_STATUS_LABELS).map(([value, label]) => ({ value, label }))]} />
            <SelectBox label="Công trình" value={pProject} onChange={setPProject} options={projectOptions} />
          </FilterBar>
          {propList.length === 0 ? <Empty>Không có đề xuất nào khớp bộ lọc.</Empty> : (
            <div className="overflow-x-auto"><table className="w-full text-left text-[11.5px]">
              <thead><tr className={tableHead}><Th>Ngày</Th><Th>Mã đề xuất</Th><Th>Công trình</Th><Th>Công việc</Th><Th right>Số dòng</Th><Th right>Dự toán</Th><Th>Người tạo</Th><Th>Bước xử lý</Th></tr></thead>
              <tbody>{propPager.rows.map(p => (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                  <td className="px-3 py-2.5 whitespace-nowrap">{dmy(toDay(p.createdAt))}</td>
                  <td className="px-3 py-2.5 font-mono font-bold text-slate-700">{p.code}</td>
                  <td className="px-3 py-2.5 text-slate-600">{projName(p.projectId, p.projectName) || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{p.taskName || '—'}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{(p.items || []).length}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{fmtFull((p.items || []).reduce((s: number, it: any) => s + (it.totalPrice || (it.price || 0) * (it.qty || 0)), 0))}</td>
                  <td className="px-3 py-2.5 text-slate-600">{p.createdByName || '—'}</td>
                  <td className="px-3 py-2.5"><Badge tone={PROP_TONE[p.status] || 'slate'}>{PROPOSAL_STATUS_LABELS[p.status] || (p.status === 'cancelled' ? 'Đã hủy' : p.status)}</Badge></td>
                </tr>))}</tbody>
            </table></div>
          )}
          {propPager.bar}
        </>)}
      </Card>
    </div>
  );
}
