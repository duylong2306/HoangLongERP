// ─── Tab "Phòng Kế Toán" của Bảng điều hành Giám đốc ──────────────────────────────────────────────────────────────
// Giám đốc chọn KHOẢNG THỜI GIAN + công trình ở trên cùng; các chỉ số, biểu đồ và 3 danh sách (phiếu chi / phiếu thu / đề xuất chi) đều theo bộ lọc đó.
// Phiếu chi chờ duyệt và đề xuất chờ xử lý luôn được nhắc riêng để không bị bỏ sót.
import React, { useEffect, useMemo, useState } from 'react';
import { Wallet, FileDown } from 'lucide-react';
import { dbService } from '../../lib/dbService';
import type { Project, Receipt, Payment, Customer } from '../../types';
import { todayYmd, toDay, cashflowByDay, spendByCategory, supplierPayable, CATEGORY_LABELS } from '../../lib/executiveDashboard';
import { matchesQuery, rangeOf, inRange, type DatePreset } from '../../lib/directorViews';
import { Card, Stat, Badge, Bar, Empty, PairBars, FilterBar, SearchBox, SelectBox, DateRangeFilter, usePager, fmtFull, fmtShort, dm, dmy, tableHead, Th, type Tone } from './kit';

interface Props { projects: Project[]; receipts: Receipt[]; payments: Payment[]; customers: Customer[]; onNavigateTab: (tabId: string) => void }

type ListTab = 'pay' | 'rec' | 'prop';
const PAY_STATUS: Record<string, { label: string; tone: Tone }> = { approved: { label: 'Đã duyệt', tone: 'emerald' }, pending: { label: 'Chờ duyệt', tone: 'amber' }, rejected: { label: 'Từ chối', tone: 'rose' } };
const PROP_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending_approval: { label: 'Chờ duyệt', tone: 'amber' }, pending_payment: { label: 'Chờ lập phiếu chi', tone: 'sky' },
  awaiting_voucher_update: { label: 'Chờ cập nhật phiếu', tone: 'indigo' }, rejected: { label: 'Từ chối', tone: 'rose' }, completed: { label: 'Hoàn tất', tone: 'emerald' },
};
const PROP_TYPE: Record<string, string> = {
  subcontractor_advance: 'Tạm ứng thầu phụ', project_expense_proposal: 'Chi phí công trình', salary_advance: 'Ứng lương', supplier_payment_proposal: 'Thanh toán NCC',
  cash_fund_deposit: 'Nạp quỹ', other_expense_proposal: 'Chi khác',
};
const METHOD: Record<string, string> = { cash: 'Tiền mặt', transfer: 'Chuyển khoản', cash_fund: 'Quỹ tiền mặt' };

export default function AccountingView({ projects, receipts, payments, customers, onNavigateTab }: Props) {
  const today = useMemo(() => todayYmd(), []);
  const [advances, setAdvances] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  useEffect(() => {
    let alive = true;
    Promise.allSettled([dbService.subcontractorAdvances.list(), dbService.purchaseOrders.list()]).then(([a, o]) => {
      if (!alive) return;
      if (a.status === 'fulfilled') setAdvances(a.value || []);
      if (o.status === 'fulfilled') setOrders(o.value || []);
    });
    return () => { alive = false; };
  }, []);

  const projName = (id?: string) => projects.find(p => p.id === id)?.name || '';
  const custName = (id?: string) => customers.find(c => c.id === id)?.name || '—';

  // ─── Bộ lọc chung (thời gian + công trình) ───
  const [preset, setPreset] = useState<DatePreset>('30d'); const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [project, setProject] = useState('all');
  const range = useMemo(() => rangeOf(preset, today, from, to), [preset, today, from, to]);
  const commonActive = preset !== '30d' || project !== 'all';
  const resetCommon = () => { setPreset('30d'); setFrom(''); setTo(''); setProject('all'); };
  const projOk = (pid?: string) => project === 'all' || (project === 'none' ? !pid : pid === project);

  const realPays = useMemo(() => payments.filter(p => (p.category as string) !== 'cash_fund'), [payments]);
  const periodPays = useMemo(() => realPays.filter(p => inRange(p.paymentAt || p.date, range) && projOk(p.projectId)), [realPays, range, project]);
  const periodRecs = useMemo(() => receipts.filter(r => inRange(r.receiptAt || r.date, range) && projOk(r.projectId)), [receipts, range, project]);
  const approvedSum = periodPays.filter(p => p.status === 'approved').reduce((s, p) => s + (p.amount || 0), 0);
  const pendingSum = periodPays.filter(p => p.status === 'pending').reduce((s, p) => s + (p.amount || 0), 0);
  const recSum = periodRecs.reduce((s, r) => s + (r.amount || 0), 0);

  // Nhắc việc không phụ thuộc bộ lọc thời gian: LUÔN hiện đủ để không sót
  const allPending = realPays.filter(p => p.status === 'pending');
  const propPending = advances.filter(a => a.status === 'pending_approval');
  const propVoucher = advances.filter(a => a.status === 'pending_payment' || a.status === 'awaiting_voucher_update');
  const payable = useMemo(() => supplierPayable(orders), [orders]);
  const contractTotal = projects.filter(p => p.status !== 'cancelled').reduce((s, p) => s + (p.contractValue || 0), 0);
  const collectedAll = receipts.reduce((s, r) => s + (r.amount || 0), 0);

  const flow = useMemo(() => cashflowByDay(receipts.filter(r => projOk(r.projectId)), realPays.filter(p => projOk(p.projectId)), today, 30), [receipts, realPays, today, project]);
  const cats = useMemo(() => spendByCategory(periodPays), [periodPays]);

  const [tab, setTab] = useState<ListTab>('pay');

  // ─── Phiếu chi ───
  const [pq, setPq] = useState(''); const [pCat, setPCat] = useState('all'); const [pStatus, setPStatus] = useState('all'); const [pMethod, setPMethod] = useState('all');
  const payActive = !!pq || pCat !== 'all' || pStatus !== 'all' || pMethod !== 'all';
  const resetPay = () => { setPq(''); setPCat('all'); setPStatus('all'); setPMethod('all'); };
  const payList = useMemo(() => periodPays.filter(p => (pCat === 'all' || p.category === pCat) && (pStatus === 'all' || p.status === pStatus) && (pMethod === 'all' || p.paymentMethod === pMethod)
    && matchesQuery(pq, p.recipient, p.code, p.notes, p.proposer, projName(p.projectId))).sort((a, b) => (toDay(b.paymentAt || b.date) || '').localeCompare(toDay(a.paymentAt || a.date) || '')),
    [periodPays, pCat, pStatus, pMethod, pq, projects]);
  const payPager = usePager(payList, [preset, from, to, project, pq, pCat, pStatus, pMethod].join('|'));
  const payListSum = payList.filter(p => p.status !== 'rejected').reduce((s, p) => s + (p.amount || 0), 0);

  // ─── Phiếu thu ───
  const [rq, setRq] = useState(''); const [rMethod, setRMethod] = useState('all'); const [rType, setRType] = useState('all');
  const recActive = !!rq || rMethod !== 'all' || rType !== 'all';
  const resetRec = () => { setRq(''); setRMethod('all'); setRType('all'); };
  const recList = useMemo(() => periodRecs.filter(r => (rMethod === 'all' || r.paymentMethod === rMethod) && (rType === 'all' || r.loaiThu === rType)
    && matchesQuery(rq, r.code, r.notes, r.collector, custName(r.customerId), projName(r.projectId))).sort((a, b) => (toDay(b.receiptAt || b.date) || '').localeCompare(toDay(a.receiptAt || a.date) || '')),
    [periodRecs, rMethod, rType, rq, projects, customers]);
  const recPager = usePager(recList, [preset, from, to, project, rq, rMethod, rType].join('|'));

  // ─── Đề xuất chi ───
  const [aq, setAq] = useState(''); const [aStatus, setAStatus] = useState('all'); const [aType, setAType] = useState('all');
  const propActive = !!aq || aStatus !== 'all' || aType !== 'all';
  const resetProp = () => { setAq(''); setAStatus('all'); setAType('all'); };
  const propList = useMemo(() => advances.filter(a => inRange(a.proposalDate || a.date, range) && projOk(a.projectId) && (aStatus === 'all' || a.status === aStatus) && (aType === 'all' || (a.type || 'subcontractor_advance') === aType)
    && matchesQuery(aq, a.id, a.subcontractorName, a.projectName, a.taskName, a.reason, a.creatorName || a.creator, a.approverName || a.approver)).sort((a, b) => (toDay(b.proposalDate || b.date) || '').localeCompare(toDay(a.proposalDate || a.date) || '')),
    [advances, range, project, aStatus, aType, aq]);
  const propPager = usePager(propList, [preset, from, to, project, aq, aStatus, aType].join('|'));

  const exportPays = () => {
    const head = ['Ngày', 'Mã phiếu', 'Người nhận', 'Công trình', 'Hạng mục', 'Hình thức', 'Số tiền', 'Trạng thái'];
    const body = payList.map(p => [toDay(p.paymentAt || p.date), p.code, p.recipient, projName(p.projectId), CATEGORY_LABELS[p.category as string] || 'Khác', METHOD[p.paymentMethod] || p.paymentMethod, p.amount, PAY_STATUS[p.status]?.label || p.status]);
    const csv = [head, ...body].map(l => l.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `phieu-chi-${today}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const projectOptions = [{ value: 'all', label: 'Tất cả' }, { value: 'none', label: 'Chi chung (không gắn công trình)' }, ...projects.map(p => ({ value: p.id, label: p.name }))];
  const tabBtn = (k: ListTab, label: string, n: number) => (
    <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
      className={`px-3.5 py-2 rounded-lg text-[11.5px] font-bold border cursor-pointer transition-colors ${tab === k ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>{label} ({n})</button>
  );

  return (
    <div className="space-y-4" id="director_view_accounting">
      <Card title="Bộ lọc thời gian & công trình" icon={<Wallet className="w-4 h-4 text-emerald-500" />}>
        <FilterBar onReset={resetCommon} active={commonActive}>
          <DateRangeFilter preset={preset} from={from} to={to} onChange={(p, f, t) => { setPreset(p); setFrom(f); setTo(t); }} />
          <SelectBox label="Công trình" value={project} onChange={setProject} options={projectOptions} />
        </FilterBar>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <Stat label="Chi trong kỳ (đã duyệt)" value={fmtShort(approvedSum)} sub={`${periodPays.filter(p => p.status === 'approved').length} phiếu`} tone="rose" />
          <Stat label="Thu trong kỳ" value={fmtShort(recSum)} sub={`${periodRecs.length} phiếu`} tone="emerald" />
          <Stat label="Thu − Chi trong kỳ" value={fmtShort(recSum - approvedSum)} sub={recSum - approvedSum >= 0 ? 'Đang dương' : 'Đang âm'} tone={recSum - approvedSum >= 0 ? 'sky' : 'rose'} />
          <Stat label="Chi chờ duyệt trong kỳ" value={fmtShort(pendingSum)} sub={`${periodPays.filter(p => p.status === 'pending').length} phiếu`} tone={pendingSum ? 'amber' : 'slate'} />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mt-4 mb-2">Cần xử lý & công nợ (không phụ thuộc bộ lọc)</p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
          <Stat label="Phiếu chi chờ duyệt" value={String(allPending.length)} sub={fmtShort(allPending.reduce((s, p) => s + (p.amount || 0), 0))} tone={allPending.length ? 'amber' : 'slate'} onClick={() => { setTab('pay'); resetPay(); setPStatus('pending'); setPreset('all'); }} active={tab === 'pay' && pStatus === 'pending'} />
          <Stat label="Đề xuất chờ duyệt" value={String(propPending.length)} tone={propPending.length ? 'amber' : 'slate'} onClick={() => { setTab('prop'); resetProp(); setAStatus('pending_approval'); setPreset('all'); }} active={tab === 'prop' && aStatus === 'pending_approval'} />
          <Stat label="Đề xuất chờ lập phiếu chi" value={String(propVoucher.length)} tone={propVoucher.length ? 'sky' : 'slate'} onClick={() => { setTab('prop'); resetProp(); setAStatus('pending_payment'); setPreset('all'); }} active={tab === 'prop' && aStatus === 'pending_payment'} />
          <Stat label="Còn phải thu (toàn DN)" value={fmtShort(Math.max(0, contractTotal - collectedAll))} sub="Hợp đồng − đã thu" tone="amber" />
          <Stat label="Nợ nhà cung cấp" value={fmtShort(payable)} sub="Đơn mua chưa thanh toán hết" tone={payable ? 'amber' : 'slate'} onClick={() => onNavigateTab('finance')} />
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <Card title="Thu — chi 30 ngày gần nhất" icon={<Wallet className="w-4 h-4 text-sky-500" />}>
            <PairBars money data={flow.map(d => ({ label: dm(d.day), a: d.income, b: d.expense }))} colorA="fill-emerald-500" colorB="fill-rose-400" titleA="Thu" titleB="Chi (đã duyệt)" />
          </Card>
        </div>
        <Card title="Chi theo hạng mục (trong kỳ)" icon={<Wallet className="w-4 h-4 text-rose-500" />}>
          {cats.length === 0 ? <Empty>Không có khoản chi nào được duyệt trong kỳ.</Empty> : (
            <ul className="space-y-2.5">{cats.slice(0, 7).map(c => (
              <li key={c.key}><div className="flex justify-between text-[11px] text-slate-700 mb-1"><span className="font-bold">{c.label}</span><span className="font-mono">{fmtShort(c.amount)} · {c.pct}%</span></div><Bar pct={c.pct} tone="amber" h="h-2" /></li>
            ))}</ul>
          )}
        </Card>
      </div>

      <Card title="Chứng từ" icon={<Wallet className="w-4 h-4 text-indigo-500" />}
        right={<button type="button" onClick={() => onNavigateTab('finance')} className="text-[10.5px] font-bold text-emerald-600 hover:text-emerald-500 cursor-pointer">Mở Tài chính – Kế toán</button>}>
        <div className="flex flex-wrap gap-1.5 mb-3" role="tablist" aria-label="Loại chứng từ">
          {tabBtn('pay', 'Phiếu chi', periodPays.length)}{tabBtn('rec', 'Phiếu thu', periodRecs.length)}{tabBtn('prop', 'Đề xuất chi', propList.length)}
        </div>

        {tab === 'pay' && (<>
          <FilterBar onReset={resetPay} active={payActive}>
            <SearchBox value={pq} onChange={setPq} placeholder="Người nhận, mã phiếu, ghi chú, công trình…" />
            <SelectBox label="Hạng mục" value={pCat} onChange={setPCat} options={[{ value: 'all', label: 'Tất cả' }, ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))]} />
            <SelectBox label="Trạng thái" value={pStatus} onChange={setPStatus} options={[{ value: 'all', label: 'Tất cả' }, ...Object.entries(PAY_STATUS).map(([value, v]) => ({ value, label: v.label }))]} />
            <SelectBox label="Hình thức" value={pMethod} onChange={setPMethod} options={[{ value: 'all', label: 'Tất cả' }, ...Object.entries(METHOD).map(([value, label]) => ({ value, label }))]} />
            <button type="button" onClick={exportPays} className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 cursor-pointer"><FileDown className="w-3.5 h-3.5" />Xuất CSV</button>
          </FilterBar>
          {payList.length === 0 ? <Empty>Không có phiếu chi nào khớp bộ lọc.</Empty> : (
            <div className="overflow-x-auto"><table className="w-full text-left text-[11.5px]">
              <thead><tr className={tableHead}><Th>Ngày</Th><Th>Mã phiếu</Th><Th>Người nhận</Th><Th>Công trình</Th><Th>Hạng mục</Th><Th>Hình thức</Th><Th right>Số tiền</Th><Th>Trạng thái</Th></tr></thead>
              <tbody>{payPager.rows.map(p => (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                  <td className="px-3 py-2.5 whitespace-nowrap">{dmy(toDay(p.paymentAt || p.date))}</td>
                  <td className="px-3 py-2.5 font-mono text-slate-500">{p.code}</td>
                  <td className="px-3 py-2.5 font-bold text-slate-800">{p.recipient || '—'}{p.notes && <div className="text-[10px] font-normal text-slate-400 truncate max-w-[220px]" title={p.notes}>{p.notes}</div>}</td>
                  <td className="px-3 py-2.5 text-slate-600">{projName(p.projectId) || 'Chi chung'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{CATEGORY_LABELS[p.category as string] || 'Khác'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{METHOD[p.paymentMethod] || p.paymentMethod}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-rose-600">{fmtFull(p.amount)}</td>
                  <td className="px-3 py-2.5"><Badge tone={PAY_STATUS[p.status]?.tone || 'slate'}>{PAY_STATUS[p.status]?.label || p.status}</Badge></td>
                </tr>))}</tbody>
              <tfoot><tr className="bg-slate-50 font-black text-slate-800 border-t border-slate-200"><td className="px-3 py-2.5" colSpan={6}>TỔNG ({payList.length} phiếu, không tính phiếu từ chối)</td><td className="px-3 py-2.5 text-right font-mono text-rose-600">{fmtFull(payListSum)}</td><td /></tr></tfoot>
            </table></div>
          )}
          {payPager.bar}
        </>)}

        {tab === 'rec' && (<>
          <FilterBar onReset={resetRec} active={recActive}>
            <SearchBox value={rq} onChange={setRq} placeholder="Mã phiếu, khách hàng, công trình, người thu…" />
            <SelectBox label="Hình thức" value={rMethod} onChange={setRMethod} options={[{ value: 'all', label: 'Tất cả' }, { value: 'cash', label: 'Tiền mặt' }, { value: 'transfer', label: 'Chuyển khoản' }]} />
            <SelectBox label="Loại thu" value={rType} onChange={setRType} options={[{ value: 'all', label: 'Tất cả' }, { value: 'du_an', label: 'Thu theo dự án' }, { value: 'ban_hang', label: 'Bán hàng' }, { value: 'de_xuat', label: 'Từ đề xuất' }]} />
          </FilterBar>
          {recList.length === 0 ? <Empty>Không có phiếu thu nào khớp bộ lọc.</Empty> : (
            <div className="overflow-x-auto"><table className="w-full text-left text-[11.5px]">
              <thead><tr className={tableHead}><Th>Ngày</Th><Th>Mã phiếu</Th><Th>Khách hàng</Th><Th>Công trình</Th><Th>Hình thức</Th><Th>Người thu</Th><Th right>Số tiền</Th></tr></thead>
              <tbody>{recPager.rows.map(r => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                  <td className="px-3 py-2.5 whitespace-nowrap">{dmy(toDay(r.receiptAt || r.date))}</td>
                  <td className="px-3 py-2.5 font-mono text-slate-500">{r.code}</td>
                  <td className="px-3 py-2.5 font-bold text-slate-800">{custName(r.customerId)}</td>
                  <td className="px-3 py-2.5 text-slate-600">{projName(r.projectId) || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.collector || '—'}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-600">{fmtFull(r.amount)}</td>
                </tr>))}</tbody>
              <tfoot><tr className="bg-slate-50 font-black text-slate-800 border-t border-slate-200"><td className="px-3 py-2.5" colSpan={6}>TỔNG ({recList.length} phiếu)</td><td className="px-3 py-2.5 text-right font-mono text-emerald-600">{fmtFull(recList.reduce((s, r) => s + (r.amount || 0), 0))}</td></tr></tfoot>
            </table></div>
          )}
          {recPager.bar}
        </>)}

        {tab === 'prop' && (<>
          <FilterBar onReset={resetProp} active={propActive}>
            <SearchBox value={aq} onChange={setAq} placeholder="Mã đề xuất, thầu phụ, công trình, lý do, người lập…" />
            <SelectBox label="Trạng thái" value={aStatus} onChange={setAStatus} options={[{ value: 'all', label: 'Tất cả' }, ...Object.entries(PROP_STATUS).map(([value, v]) => ({ value, label: v.label }))]} />
            <SelectBox label="Loại đề xuất" value={aType} onChange={setAType} options={[{ value: 'all', label: 'Tất cả' }, ...Object.entries(PROP_TYPE).map(([value, label]) => ({ value, label }))]} />
          </FilterBar>
          {propList.length === 0 ? <Empty>Không có đề xuất nào khớp bộ lọc.</Empty> : (
            <div className="overflow-x-auto"><table className="w-full text-left text-[11.5px]">
              <thead><tr className={tableHead}><Th>Ngày</Th><Th>Mã</Th><Th>Loại</Th><Th>Đối tượng</Th><Th>Công trình</Th><Th>Lý do</Th><Th>Người lập → duyệt</Th><Th right>Số tiền</Th><Th>Trạng thái</Th></tr></thead>
              <tbody>{propPager.rows.map(a => (
                <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                  <td className="px-3 py-2.5 whitespace-nowrap">{dmy(toDay(a.proposalDate || a.date))}</td>
                  <td className="px-3 py-2.5 font-mono text-slate-500">{a.id}</td>
                  <td className="px-3 py-2.5 text-slate-600">{PROP_TYPE[a.type || 'subcontractor_advance'] || 'Khác'}</td>
                  <td className="px-3 py-2.5 font-bold text-slate-800">{a.subcontractorName || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{a.projectName || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600 max-w-[220px] truncate" title={a.reason}>{a.reason || a.taskName || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{a.creatorName || a.creator || '—'} → {a.approverName || a.approver || '—'}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-800">{fmtFull(a.approvedAmount ?? a.amount)}</td>
                  <td className="px-3 py-2.5"><Badge tone={PROP_STATUS[a.status]?.tone || 'slate'}>{PROP_STATUS[a.status]?.label || a.status}</Badge></td>
                </tr>))}</tbody>
            </table></div>
          )}
          {propPager.bar}
        </>)}
      </Card>
    </div>
  );
}
