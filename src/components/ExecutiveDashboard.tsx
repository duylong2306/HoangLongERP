// ─── BẢNG ĐIỀU HÀNH GIÁM ĐỐC (Dashboard Tổng Hợp — Phòng Giám Đốc) ───────────────────────────────────────
// Thiết kế đặt mình vào vị trí Giám đốc: mở lên là biết ngay (1) hôm nay có gì cần xử lý, (2) tiền đang ở đâu — từng công trình thu/chi bao nhiêu,
// (3) 4 phòng ban hôm nay làm gì: Dự án (việc hôm nay / quá hạn / chưa làm), Nhân sự (chấm công), Kế toán (thu chi), Vật tư (số đơn theo ngày).
// Mọi con số được tính ở src/lib/executiveDashboard.ts (hàm thuần, có test). Giao diện theo docs/design-system-dieu-phoi-vat-tu.md:
// thẻ trắng viền slate-200 bo 2xl, huy hiệu pastel, màu nhấn amber — đơn giản, dễ đọc, không hiệu ứng rườm rà.
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  AlertTriangle, ArrowRight, BadgeDollarSign, CheckCircle2, HardHat, PackageOpen,
  RefreshCw, TrendingDown, TrendingUp, Users, Wallet, Building2, FileDown,
} from 'lucide-react';
import { dbService } from '../lib/dbService';
import type { Project, Task, Receipt, Payment, Employee } from '../types';
import {
  todayYmd, toDay, bucketTasks, buildProjectFinance, sumFinance, cashflowByDay, spendByCategory, paymentsOfDay, receiptsOfDay,
  materialByDay, proposalStatusCounts, supplierPayable, summarizeAttendance, buildAlerts, type ProjectFinanceRow,
} from '../lib/executiveDashboard';

interface ExecutiveDashboardProps {
  projects: Project[];
  tasks: Task[];
  receipts: Receipt[];
  payments: Payment[];
  employees: Employee[];
  onNavigateTab: (tabId: string) => void;
}

// ─── Định dạng ───────────────────────────────────────────────────────────────────────────────────
const fmtFull = (n: number) => `${Math.round(n || 0).toLocaleString('vi-VN')} đ`;
/** Số tiền rút gọn cho thẻ chỉ số: 1,25 tỷ / 480 tr / 12.000 đ */
const fmtShort = (n: number) => {
  const v = Math.round(n || 0), a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tỷ`;
  if (a >= 1e6) return `${(v / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`;
  return `${v.toLocaleString('vi-VN')} đ`;
};
const weekday = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
const dm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
/** Công trình thuộc phân hệ nào → tab Kanban để bấm vào xem chi tiết */
const projectTab = (p: Project) => p.type === 'furniture' ? 'projects-furniture' : p.type === 'mechanical' ? 'projects-mechanical' : 'projects-construction';

// ─── Thành phần giao diện nhỏ dùng chung ───────────────────────────────────────────────────────────
const Card: React.FC<{ title: string; icon?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; id?: string }> = ({ title, icon, right, children, id }) => (
  <section id={id} className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
    <div className="flex items-center justify-between gap-2 mb-3">
      <h3 className="flex items-center gap-2 text-[12px] font-black uppercase tracking-wide text-slate-700">{icon}{title}</h3>
      {right}
    </div>
    {children}
  </section>
);

type Tone = 'emerald' | 'rose' | 'amber' | 'sky' | 'indigo' | 'slate' | 'teal';
const toneBadge: Record<Tone, string> = {
  emerald: 'text-emerald-600 bg-emerald-50 border-emerald-200', rose: 'text-rose-600 bg-rose-50 border-rose-200', amber: 'text-amber-600 bg-amber-50 border-amber-200',
  sky: 'text-sky-600 bg-sky-50 border-sky-200', indigo: 'text-indigo-600 bg-indigo-50 border-indigo-200', slate: 'text-slate-600 bg-slate-50 border-slate-200', teal: 'text-teal-600 bg-teal-50 border-teal-200',
};
const Badge: React.FC<{ tone: Tone; children: React.ReactNode }> = ({ tone, children }) => (
  <span className={`inline-flex items-center border rounded-full font-bold text-[10px] px-2 py-0.5 whitespace-nowrap ${toneBadge[tone]}`}>{children}</span>
);

/** Ô số liệu lớn: nhãn nhỏ phía trên, số to, dòng phụ phía dưới */
const Stat: React.FC<{ label: string; value: string; sub?: string; tone?: Tone; onClick?: () => void }> = ({ label, value, sub, tone = 'slate', onClick }) => {
  const color = { emerald: 'text-emerald-600', rose: 'text-rose-600', amber: 'text-amber-600', sky: 'text-sky-600', indigo: 'text-indigo-600', slate: 'text-slate-800', teal: 'text-teal-600' }[tone];
  const Tag: any = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className={`text-left bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 ${onClick ? 'hover:bg-amber-50/40 cursor-pointer transition-colors' : ''}`}>
      <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <span className={`block text-xl font-black leading-tight ${color}`}>{value}</span>
      {sub && <span className="block text-[10.5px] text-slate-500 mt-0.5">{sub}</span>}
    </Tag>
  );
};

/** Thanh tiến độ đơn giản */
const Bar: React.FC<{ pct: number; tone?: Tone; h?: string }> = ({ pct, tone = 'emerald', h = 'h-1.5' }) => {
  const bg = { emerald: 'bg-emerald-500', rose: 'bg-rose-500', amber: 'bg-amber-500', sky: 'bg-sky-500', indigo: 'bg-indigo-500', slate: 'bg-slate-400', teal: 'bg-teal-500' }[tone];
  return <div className={`w-full ${h} bg-slate-100 rounded-full overflow-hidden`}><div className={`${h} ${bg} rounded-full`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>;
};

const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[11px] text-slate-400 italic text-center py-4 border border-dashed border-slate-200 rounded-xl">{children}</p>
);

/** Biểu đồ cột đôi (2 chuỗi) bằng SVG — dùng cho dòng tiền thu/chi và đơn vật tư */
const PairBars: React.FC<{ data: { label: string; a: number; b: number }[]; colorA: string; colorB: string; titleA: string; titleB: string; money?: boolean }> = ({ data, colorA, colorB, titleA, titleB, money }) => {
  const max = Math.max(1, ...data.flatMap(d => [d.a, d.b]));
  const W = 560, H = 140, padB = 18, bw = Math.floor((W / data.length) * 0.32);
  return (
    <div className="overflow-x-auto">
      <p className="text-[10px] text-slate-400 mb-0.5">Cột cao nhất: {money ? fmtShort(max) : max}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[420px] max-h-44" role="img" aria-label={`${titleA} và ${titleB} theo ngày`}>
        {data.map((d, i) => {
          const x = (i + 0.5) * (W / data.length);
          const ha = Math.round(((H - padB - 6) * d.a) / max), hb = Math.round(((H - padB - 6) * d.b) / max);
          return (
            <g key={d.label}>
              <title>{`${d.label}: ${titleA} ${money ? fmtFull(d.a) : d.a} · ${titleB} ${money ? fmtFull(d.b) : d.b}`}</title>
              <rect x={x - bw - 1} y={H - padB - ha} width={bw} height={ha} rx={2} className={colorA} />
              <rect x={x + 1} y={H - padB - hb} width={bw} height={hb} rx={2} className={colorB} />
              <text x={x} y={H - 4} textAnchor="middle" className="fill-slate-400" fontSize="9">{d.label}</text>
            </g>
          );
        })}
      </svg>
      <div className="flex items-center gap-4 text-[10.5px] text-slate-600 mt-1">
        <span className="flex items-center gap-1"><i className={`inline-block w-2.5 h-2.5 rounded-sm ${colorA.replace('fill-', 'bg-')}`} />{titleA}</span>
        <span className="flex items-center gap-1"><i className={`inline-block w-2.5 h-2.5 rounded-sm ${colorB.replace('fill-', 'bg-')}`} />{titleB}</span>
      </div>
    </div>
  );
};

// ─── Màn hình chính ───────────────────────────────────────────────────────────────────────────────
export default function ExecutiveDashboard({ projects, tasks, receipts, payments, employees, onNavigateTab }: ExecutiveDashboardProps) {
  const [now, setNow] = useState(() => new Date());
  const today = useMemo(() => todayYmd(now), [now]);

  // Dữ liệu bổ sung tải riêng (không nằm trong props): chấm công hôm nay, đơn nghỉ, đơn mua hàng, đề xuất vật tư, đề xuất chi
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [matProposals, setMatProposals] = useState<any[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [taskTab, setTaskTab] = useState<'today' | 'overdue' | 'todo'>('today');
  const [showAllProjects, setShowAllProjects] = useState(false);

  // Mỗi nguồn tải độc lập: một nguồn lỗi/chưa có quyền thì phần còn lại vẫn hiển thị (chỉ phần đó để trống)
  const loadExtras = useCallback(async () => {
    setRefreshing(true);
    const d = todayYmd();
    const [a, l, o, m, s] = await Promise.allSettled([
      dbService.attendance.listForRange(d, d),
      dbService.hrmLeaves.list(),
      dbService.purchaseOrders.list(),
      dbService.materialProposals.list(),
      dbService.subcontractorAdvances.list(),
    ]);
    if (a.status === 'fulfilled') setAttendanceLogs(a.value || []);
    if (l.status === 'fulfilled') setLeaves(l.value || []);
    if (o.status === 'fulfilled') setOrders(o.value || []);
    if (m.status === 'fulfilled') setMatProposals(m.value || []);
    if (s.status === 'fulfilled') setAdvances(s.value || []);
    setNow(new Date());
    setLoadedAt(new Date());
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadExtras();
    // Tự làm mới khi có chấm công / đề xuất vật tư mới, và mỗi 5 phút
    const onChange = () => loadExtras();
    window.addEventListener('hl-attendance-realtime', onChange);
    window.addEventListener('hl-material-proposals-updated', onChange);
    const timer = window.setInterval(loadExtras, 5 * 60 * 1000);
    return () => {
      window.removeEventListener('hl-attendance-realtime', onChange);
      window.removeEventListener('hl-material-proposals-updated', onChange);
      window.clearInterval(timer);
    };
  }, [loadExtras]);

  // ─── Tính số liệu ───
  const empName = useCallback((id?: string) => employees.find(e => e.id === id)?.name || '—', [employees]);
  const projName = useCallback((id?: string) => projects.find(p => p.id === id)?.name || '', [projects]);
  const buckets = useMemo(() => bucketTasks(tasks, today), [tasks, today]);
  const rows = useMemo(() => buildProjectFinance(projects, receipts, payments, today), [projects, receipts, payments, today]);
  const totals = useMemo(() => sumFinance(rows), [rows]);
  const flow = useMemo(() => cashflowByDay(receipts, payments, today, 14), [receipts, payments, today]);
  const categories = useMemo(() => spendByCategory(payments), [payments]);
  const todayPays = useMemo(() => paymentsOfDay(payments, today), [payments, today]);
  const todayRecs = useMemo(() => receiptsOfDay(receipts, today), [receipts, today]);
  const att = useMemo(() => summarizeAttendance(employees, attendanceLogs, leaves, today), [employees, attendanceLogs, leaves, today]);
  const matDays = useMemo(() => materialByDay(orders, matProposals, today, 14), [orders, matProposals, today]);
  const matStatus = useMemo(() => proposalStatusCounts(matProposals), [matProposals]);
  const payable = useMemo(() => supplierPayable(orders), [orders]);

  const pendingPays = payments.filter(p => p.status === 'pending' && (p.category as string) !== 'cash_fund');
  const pendingPayAmount = pendingPays.reduce((s, p) => s + (p.amount || 0), 0);
  const pendingAdvances = advances.filter(a => a.status === 'pending_approval');
  const awaitingVoucher = advances.filter(a => a.status === 'pending_payment' || a.status === 'awaiting_voucher_update');
  const todayRecTotal = todayRecs.reduce((s, r) => s + (r.amount || 0), 0);
  const todayPayTotal = todayPays.reduce((s, p) => s + (p.amount || 0), 0);
  const todayOrders = matDays[matDays.length - 1];
  const alerts = useMemo(() => buildAlerts({ rows, buckets, attendance: att, pendingPayments: pendingPays.length, pendingPaymentAmount: pendingPayAmount, hour: now.getHours() }),
    [rows, buckets, att, pendingPays.length, pendingPayAmount, now]);

  // Danh sách việc theo tab đang chọn (tối đa 8 dòng cho gọn, có nút xem tất cả)
  // Việc đang làm nhưng đã quá hạn vẫn nằm ở tab "Hôm nay" (đang được làm) NHƯNG gắn nhãn "Trễ n ngày" để Giám đốc không bỏ sót
  const lateById = new Map(buckets.overdue.map(t => [t.id, t.daysLate] as const));
  const taskList: (Task & { daysLate?: number })[] = (taskTab === 'overdue' ? buckets.overdue : taskTab === 'todo' ? buckets.todo
    : [...buckets.dueToday, ...buckets.doing.filter(t => !buckets.dueToday.some(x => x.id === t.id))]
  ).map(t => (typeof (t as any).daysLate === 'number' || !lateById.has(t.id)) ? t : { ...t, daysLate: lateById.get(t.id) });
  const visibleRows = showAllProjects ? rows : rows.slice(0, 8);

  const exportReport = () => {
    // Xuất bảng chi phí từng công trình ra CSV (mở được bằng Excel) — có BOM để giữ tiếng Việt
    const head = ['Mã', 'Công trình', 'Giá trị hợp đồng', 'Đã thu', 'Đã chi', 'Chi chờ duyệt', 'Chi/HĐ (%)', 'Còn phải thu', 'Thu - Chi'];
    const body = rows.map(r => [r.project.code, r.project.name, r.contractValue, r.collected, r.spent, r.pendingSpent, r.spentPct, r.receivable, r.cashMargin]);
    const csv = [head, ...body].map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `chi-phi-cong-trinh-${today}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const dayLabel = (ymd: string) => dm(ymd);
  const hello = now.getHours() < 11 ? 'Chào buổi sáng' : now.getHours() < 14 ? 'Chào buổi trưa' : now.getHours() < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';

  return (
    <div className="space-y-4" id="executive_dashboard">
      {/* ── 1. Đầu trang: ngày giờ + làm mới ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-600">{weekday[now.getDay()]}, {now.getDate()}/{now.getMonth() + 1}/{now.getFullYear()}</p>
          <h2 className="text-lg sm:text-xl font-black text-slate-800">{hello}, đây là tình hình doanh nghiệp hôm nay</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {projects.filter(p => p.status !== 'completed' && p.status !== 'cancelled').length} công trình đang chạy · {att.present}/{att.expected} nhân sự có mặt · {buckets.overdue.length} việc quá hạn · {pendingPays.length} phiếu chi chờ duyệt
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {loadedAt && <span className="text-[10.5px] text-slate-400">Cập nhật {loadedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>}
          <button type="button" onClick={loadExtras} disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 cursor-pointer disabled:opacity-60 transition">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Làm mới
          </button>
        </div>
      </div>

      {/* ── 2. Việc cần Giám đốc xử lý ── */}
      <Card title="Việc cần bạn xử lý hôm nay" icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
          <Stat label="Phiếu chi chờ duyệt" value={String(pendingPays.length)} sub={pendingPays.length ? fmtFull(pendingPayAmount) : 'Không có'} tone={pendingPays.length ? 'amber' : 'slate'} onClick={() => onNavigateTab('finance')} />
          <Stat label="Đề xuất chi chờ duyệt" value={String(pendingAdvances.length)} sub={awaitingVoucher.length ? `${awaitingVoucher.length} đề xuất chờ lập phiếu` : 'Không có'} tone={pendingAdvances.length ? 'amber' : 'slate'} onClick={() => onNavigateTab('finance')} />
          <Stat label="Công việc chờ duyệt" value={String(buckets.reviewing.length)} sub="Đang chờ duyệt kết quả" tone={buckets.reviewing.length ? 'amber' : 'slate'} onClick={() => onNavigateTab('tasks')} />
          <Stat label="Đơn nghỉ / tạm ứng lương" value={String(att.pendingLeaves)} sub="Chờ xét duyệt" tone={att.pendingLeaves ? 'amber' : 'slate'} onClick={() => onNavigateTab('employees')} />
          <Stat label="Đề xuất vật tư chờ duyệt" value={String(matStatus.find(s => s.key === 'waiting_approval')?.count || 0)} sub="Trên bảng điều phối" tone={(matStatus.find(s => s.key === 'waiting_approval')?.count || 0) ? 'amber' : 'slate'} onClick={() => onNavigateTab('material-coordination')} />
        </div>
        {alerts.length > 0 && (
          <ul className="mt-3 space-y-1.5" aria-label="Cảnh báo">
            {alerts.slice(0, 7).map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-[11.5px]">
                <Badge tone={a.level === 'danger' ? 'rose' : a.level === 'warn' ? 'amber' : 'sky'}>{a.level === 'danger' ? 'Nghiêm trọng' : a.level === 'warn' ? 'Lưu ý' : 'Thông tin'}</Badge>
                <span className="text-slate-700">{a.text}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ── 3. Tổng hợp tiền: hợp đồng / đã thu / đã chi ── */}
      <Card title="Tổng hợp tài chính toàn doanh nghiệp" icon={<BadgeDollarSign className="w-4 h-4 text-emerald-500" />}
        right={<Badge tone="slate">{rows.length} công trình</Badge>}>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
          <Stat label="Tổng giá trị hợp đồng" value={fmtShort(totals.contractValue)} sub={fmtFull(totals.contractValue)} tone="indigo" />
          <Stat label="Đã thu" value={fmtShort(totals.collected)} sub={`${totals.collectedPct}% giá trị hợp đồng`} tone="emerald" />
          <Stat label="Đã chi (đã duyệt)" value={fmtShort(totals.spent)} sub={`${totals.spentPct}% giá trị hợp đồng`} tone="rose" />
          <Stat label="Còn phải thu" value={fmtShort(totals.receivable)} sub="Hợp đồng − đã thu" tone="amber" />
          <Stat label="Thu − Chi (dòng tiền)" value={fmtShort(totals.cashMargin)} sub={totals.cashMargin >= 0 ? 'Đang dương' : 'Đang âm'} tone={totals.cashMargin >= 0 ? 'sky' : 'rose'} />
          <Stat label="Nợ nhà cung cấp" value={fmtShort(payable)} sub="Đơn mua chưa thanh toán hết" tone={payable > 0 ? 'amber' : 'slate'} onClick={() => onNavigateTab('finance')} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <div><div className="flex justify-between text-[10.5px] text-slate-600 mb-1"><span>Đã thu / hợp đồng</span><b>{totals.collectedPct}%</b></div><Bar pct={totals.collectedPct} tone="emerald" h="h-2" /></div>
          <div><div className="flex justify-between text-[10.5px] text-slate-600 mb-1"><span>Đã chi / hợp đồng</span><b>{totals.spentPct}%</b></div><Bar pct={totals.spentPct} tone={totals.spentPct > 100 ? 'rose' : totals.spentPct >= 80 ? 'amber' : 'sky'} h="h-2" /></div>
        </div>
      </Card>

      {/* ── 4. Chi phí từng công trình ── */}
      <Card title="Chi phí từng công trình" icon={<Building2 className="w-4 h-4 text-indigo-500" />}
        right={<button type="button" onClick={exportReport} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[10.5px] font-bold text-slate-700 cursor-pointer"><FileDown className="w-3.5 h-3.5" />Xuất Excel (CSV)</button>}>
        {rows.length === 0 ? <Empty>Chưa có công trình nào.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11.5px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wide border-b border-slate-200">
                  <th className="px-3 py-2">Công trình</th>
                  <th className="px-3 py-2 text-right">Giá trị hợp đồng</th>
                  <th className="px-3 py-2 text-right">Đã thu</th>
                  <th className="px-3 py-2 text-right">Đã chi</th>
                  <th className="px-3 py-2 min-w-[130px]">Chi / hợp đồng</th>
                  <th className="px-3 py-2 text-right">Thu − Chi</th>
                  <th className="px-3 py-2">Tình trạng</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r: ProjectFinanceRow) => (
                  <tr key={r.project.id} onClick={() => onNavigateTab(projectTab(r.project))} className="border-b border-slate-100 hover:bg-amber-50/40 cursor-pointer transition-colors">
                    <td className="px-3 py-2.5">
                      <div className="font-bold text-slate-800">{r.project.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{r.project.code} · tiến độ {r.project.progress || 0}%</div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-700">{fmtFull(r.contractValue)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-emerald-600">{fmtFull(r.collected)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-rose-600">
                      {fmtFull(r.spent)}
                      {r.pendingSpent > 0 && <span className="block text-[10px] text-amber-600">+ {fmtShort(r.pendingSpent)} chờ duyệt</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2"><Bar pct={r.spentPct} tone={r.spentPct > 100 ? 'rose' : r.spentPct >= 80 ? 'amber' : 'sky'} /><b className="text-[10.5px] text-slate-700 w-9 text-right">{r.spentPct}%</b></div>
                    </td>
                    <td className={`px-3 py-2.5 text-right font-mono font-bold ${r.cashMargin >= 0 ? 'text-sky-600' : 'text-rose-600'}`}>{fmtFull(r.cashMargin)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {r.flags.includes('overBudget') && <Badge tone="rose">Chi vượt hợp đồng</Badge>}
                        {r.flags.includes('loss') && <Badge tone="rose">Chi &gt; thu</Badge>}
                        {r.flags.includes('nearBudget') && <Badge tone="amber">Sắp hết ngân sách</Badge>}
                        {r.flags.includes('late') && <Badge tone="amber">Trễ tiến độ</Badge>}
                        {r.flags.includes('noContract') && <Badge tone="slate">Chưa nhập giá trị HĐ</Badge>}
                        {r.flags.length === 0 && <Badge tone="emerald">Bình thường</Badge>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-black text-slate-800 text-[11.5px] border-t border-slate-200">
                  <td className="px-3 py-2.5">TỔNG CỘNG</td>
                  <td className="px-3 py-2.5 text-right font-mono">{fmtFull(totals.contractValue)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-emerald-600">{fmtFull(totals.collected)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-rose-600">{fmtFull(totals.spent)}</td>
                  <td className="px-3 py-2.5">{totals.spentPct}%</td>
                  <td className={`px-3 py-2.5 text-right font-mono ${totals.cashMargin >= 0 ? 'text-sky-600' : 'text-rose-600'}`}>{fmtFull(totals.cashMargin)}</td>
                  <td className="px-3 py-2.5" />
                </tr>
              </tfoot>
            </table>
            {rows.length > 8 && (
              <button type="button" onClick={() => setShowAllProjects(v => !v)} className="mt-2 text-[11px] font-bold text-indigo-600 hover:text-indigo-500 cursor-pointer">
                {showAllProjects ? 'Thu gọn bảng' : `Xem tất cả ${rows.length} công trình`}
              </button>
            )}
          </div>
        )}
        <p className="text-[10px] text-slate-400 mt-2">“Đã chi” chỉ tính phiếu chi đã duyệt gắn với công trình (không tính nạp quỹ tiền mặt). Bấm vào một dòng để mở bảng công trình.</p>
      </Card>

      {/* ── 5. Bốn phòng ban hôm nay ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* 5a. Phòng dự án */}
        <Card title="Phòng Dự Án — hôm nay" icon={<HardHat className="w-4 h-4 text-sky-500" />} right={<button type="button" onClick={() => onNavigateTab('projects-construction')} className="text-[10.5px] font-bold text-sky-600 hover:text-sky-500 cursor-pointer flex items-center gap-1">Mở bảng dự án <ArrowRight className="w-3 h-3" /></button>}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Đang làm" value={String(buckets.doing.length)} tone="sky" />
            <Stat label="Đến hạn hôm nay" value={String(buckets.dueToday.length)} tone="amber" />
            <Stat label="Quá hạn" value={String(buckets.overdue.length)} tone={buckets.overdue.length ? 'rose' : 'slate'} />
            <Stat label="Chưa làm" value={String(buckets.todo.length)} tone="slate" />
          </div>
          <div className="flex gap-1.5 mt-3" role="tablist" aria-label="Danh sách công việc">
            {([['today', `Hôm nay (${buckets.doing.length + buckets.dueToday.filter(t => t.status !== 'doing').length})`], ['overdue', `Quá hạn (${buckets.overdue.length})`], ['todo', `Chưa làm (${buckets.todo.length})`]] as const).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={taskTab === k} onClick={() => setTaskTab(k)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors ${taskTab === k ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>{label}</button>
            ))}
          </div>
          <ul className="mt-2 divide-y divide-slate-100">
            {taskList.length === 0 && <li><Empty>{taskTab === 'overdue' ? 'Không có công việc nào quá hạn 🎉' : taskTab === 'todo' ? 'Không có công việc nào đang chờ làm.' : 'Hôm nay chưa có công việc đang làm hoặc đến hạn.'}</Empty></li>}
            {taskList.slice(0, 8).map(t => (
              <li key={t.id} className="py-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-slate-800 truncate">{t.name}</p>
                  <p className="text-[10.5px] text-slate-500 truncate">{projName(t.projectId) || 'Không gắn dự án'} · {empName(t.assigneeId)}{t.deadline ? ` · hạn ${dm(toDay(t.deadline) || '0000-00-00')}` : ''}</p>
                </div>
                {typeof t.daysLate === 'number' ? <Badge tone="rose">Trễ {t.daysLate} ngày</Badge> : t.status === 'doing' ? <Badge tone="sky">Đang làm</Badge> : t.status === 'reviewing' ? <Badge tone="amber">Chờ duyệt</Badge> : <Badge tone="slate">{t.status === 'todo' ? 'Chưa làm' : 'Đến hạn'}</Badge>}
              </li>
            ))}
          </ul>
          {taskList.length > 8 && <p className="text-[10.5px] text-slate-400 mt-1">… và {taskList.length - 8} việc khác. <button type="button" onClick={() => onNavigateTab('tasks')} className="font-bold text-sky-600 cursor-pointer">Xem tất cả</button></p>}
        </Card>

        {/* 5b. Nhân sự */}
        <Card title="Nhân sự — chấm công hôm nay" icon={<Users className="w-4 h-4 text-amber-500" />} right={<button type="button" onClick={() => onNavigateTab('employees')} className="text-[10.5px] font-bold text-amber-600 hover:text-amber-500 cursor-pointer flex items-center gap-1">Mở chấm công <ArrowRight className="w-3 h-3" /></button>}>
          <div className="flex items-center gap-4">
            <div className="relative w-24 h-24 shrink-0" role="img" aria-label={`Tỷ lệ có mặt ${att.presentRate}%`}>
              <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-slate-100" strokeWidth="3.5" />
                <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-emerald-500" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${att.presentRate} ${100 - att.presentRate}`} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center"><b className="text-xl text-slate-800 leading-none">{att.presentRate}%</b><span className="text-[9px] text-slate-500">có mặt</span></div>
            </div>
            <div className="grid grid-cols-3 gap-2 flex-1">
              <Stat label="Đã chấm công" value={`${att.present}/${att.expected}`} tone="emerald" />
              <Stat label="Nghỉ có phép" value={String(att.onLeave)} tone="sky" />
              <Stat label="Chưa chấm công" value={String(att.notChecked)} tone={att.notChecked ? 'amber' : 'slate'} />
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {att.notCheckedNames.length > 0 && (
              <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Chưa chấm công ({att.notChecked})</p>
                <div className="flex flex-wrap gap-1">{att.notCheckedNames.slice(0, 12).map(n => <Badge key={n} tone="amber">{n}</Badge>)}{att.notCheckedNames.length > 12 && <Badge tone="slate">+{att.notCheckedNames.length - 12}</Badge>}</div></div>
            )}
            {att.onLeaveNames.length > 0 && (
              <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Nghỉ có phép hôm nay</p>
                <div className="flex flex-wrap gap-1">{att.onLeaveNames.slice(0, 12).map(n => <Badge key={n} tone="sky">{n}</Badge>)}</div></div>
            )}
            {att.expected === 0 && <Empty>Chưa có nhân sự đang làm việc trong danh sách.</Empty>}
          </div>
        </Card>

        {/* 5c. Kế toán */}
        <Card title="Kế toán — thu chi hôm nay" icon={<Wallet className="w-4 h-4 text-emerald-500" />} right={<button type="button" onClick={() => onNavigateTab('finance')} className="text-[10.5px] font-bold text-emerald-600 hover:text-emerald-500 cursor-pointer flex items-center gap-1">Mở tài chính <ArrowRight className="w-3 h-3" /></button>}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Chi hôm nay" value={fmtShort(todayPayTotal)} sub={`${todayPays.length} phiếu`} tone="rose" />
            <Stat label="Thu hôm nay" value={fmtShort(todayRecTotal)} sub={`${todayRecs.length} phiếu`} tone="emerald" />
            <Stat label="Phiếu chi chờ duyệt" value={String(pendingPays.length)} sub={fmtShort(pendingPayAmount)} tone={pendingPays.length ? 'amber' : 'slate'} />
            <Stat label="Chờ lập phiếu chi" value={String(awaitingVoucher.length)} sub="Đề xuất đã duyệt" tone={awaitingVoucher.length ? 'amber' : 'slate'} />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mt-3 mb-1">Hôm nay chi những khoản nào</p>
          <ul className="divide-y divide-slate-100">
            {todayPays.length === 0 && <li><Empty>Hôm nay chưa có phiếu chi nào.</Empty></li>}
            {todayPays.slice(0, 6).map(p => (
              <li key={p.id} className="py-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-slate-800 truncate">{p.recipient || p.notes || p.code}</p>
                  <p className="text-[10.5px] text-slate-500 truncate">{p.code} · {projName(p.projectId) || 'Chi chung'} · {({ material: 'Vật tư', labor: 'Nhân công', shipping: 'Vận chuyển', machinery: 'Máy móc', general: 'Quản lý chung' } as Record<string, string>)[p.category as string] || 'Khác'}</p>
                </div>
                <div className="text-right shrink-0"><b className="block text-[12px] font-mono text-rose-600">{fmtFull(p.amount)}</b><Badge tone={p.status === 'approved' ? 'emerald' : 'amber'}>{p.status === 'approved' ? 'Đã duyệt' : 'Chờ duyệt'}</Badge></div>
              </li>
            ))}
          </ul>
          {todayPays.length > 6 && <p className="text-[10.5px] text-slate-400 mt-1">… và {todayPays.length - 6} phiếu khác.</p>}
        </Card>

        {/* 5d. Vật tư */}
        <Card title="Vật tư — số đơn theo ngày" icon={<PackageOpen className="w-4 h-4 text-teal-500" />} right={<button type="button" onClick={() => onNavigateTab('material-coordination')} className="text-[10.5px] font-bold text-teal-600 hover:text-teal-500 cursor-pointer flex items-center gap-1">Mở điều phối vật tư <ArrowRight className="w-3 h-3" /></button>}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Đơn mua hôm nay" value={String(todayOrders?.orders || 0)} tone="teal" />
            <Stat label="Đề xuất hôm nay" value={String(todayOrders?.proposals || 0)} tone="indigo" />
            <Stat label="Đơn mua 14 ngày" value={String(matDays.reduce((s, d) => s + d.orders, 0))} />
            <Stat label="Đề xuất 14 ngày" value={String(matDays.reduce((s, d) => s + d.proposals, 0))} />
          </div>
          <div className="mt-3">
            <PairBars data={matDays.map(d => ({ label: dayLabel(d.day), a: d.orders, b: d.proposals }))} colorA="fill-teal-500" colorB="fill-indigo-400" titleA="Đơn mua" titleB="Đề xuất" />
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {matStatus.map(s => <Badge key={s.key} tone={s.key === 'received' ? 'emerald' : s.key === 'waiting_approval' ? 'amber' : s.key === 'find_supplier' ? 'rose' : 'sky'}>{s.label}: {s.count}</Badge>)}
          </div>
        </Card>
      </div>

      {/* ── 6. Dòng tiền & cơ cấu chi ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <Card title="Thu — chi 14 ngày gần nhất" icon={<TrendingUp className="w-4 h-4 text-sky-500" />}>
            <PairBars money data={flow.map(d => ({ label: dayLabel(d.day), a: d.income, b: d.expense }))} colorA="fill-emerald-500" colorB="fill-rose-400" titleA="Thu" titleB="Chi" />
            <p className="text-[11px] text-slate-600 mt-2">14 ngày qua: thu <b className="text-emerald-600">{fmtShort(flow.reduce((s, d) => s + d.income, 0))}</b> · chi <b className="text-rose-600">{fmtShort(flow.reduce((s, d) => s + d.expense, 0))}</b></p>
          </Card>
        </div>
        <Card title="Cơ cấu chi theo hạng mục" icon={<TrendingDown className="w-4 h-4 text-rose-500" />}>
          {categories.length === 0 ? <Empty>Chưa có khoản chi nào được duyệt.</Empty> : (
            <ul className="space-y-2.5">
              {categories.slice(0, 7).map(c => (
                <li key={c.key}>
                  <div className="flex justify-between text-[11px] text-slate-700 mb-1"><span className="font-bold">{c.label}</span><span className="font-mono">{fmtShort(c.amount)} · {c.pct}%</span></div>
                  <Bar pct={c.pct} tone="amber" h="h-2" />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <p className="text-[10px] text-slate-400 text-center pb-2 flex items-center justify-center gap-1.5"><CheckCircle2 className="w-3 h-3" />Số liệu tổng hợp trực tiếp từ Dự án, Công việc, Nhân sự, Kế toán và Vật tư. Tự làm mới mỗi 5 phút.</p>
    </div>
  );
}
