import React from 'react';
import { CalendarCheck, DollarSign, ChevronRight } from 'lucide-react';
import type { ShiftView, WeekDay, LeaveLike, CtpSummary, AdvanceSummary, CompanyToday } from '../../lib/overviewData';
import { fmtLeaveRange, fmtMoney, fmtMoneyShort } from '../../lib/overviewData';

// MÀN TỔNG QUAN KIỂU MỚI (thứ tự khối theo mẫu A + D, đã được duyệt): chào + điểm danh gọn → dải tuần → 4 chỉ số → số liệu tháng → hiệu suất →
// cần làm ngay → đơn nghỉ phép → công tác phí → tạm ứng lương → dự án của tôi. Giám đốc có thêm "Toàn công ty hôm nay" ngay dưới điểm danh.
// Thuần HIỂN THỊ: mọi số liệu do DashboardOverview tính sẵn (lib/overviewData.ts); điểm danh gọi lại đúng hàm chấm công cũ qua onPunch.
// Mọi khối ẩn khi không có dữ liệu. Chữ trắng trên nền màu dùng style nội tuyến vì index.css ép lớp text-white thành chữ tối.

export type Tone = 'ok' | 'warn' | 'bad' | 'vio' | 'blue' | 'gray';
const TONE: Record<Tone, string> = {
  ok: 'bg-emerald-50 border-emerald-200 text-emerald-700', warn: 'bg-amber-50 border-amber-200 text-amber-700', bad: 'bg-rose-50 border-rose-200 text-rose-700',
  vio: 'bg-violet-50 border-violet-200 text-violet-700', blue: 'bg-blue-50 border-blue-200 text-[#0d47c9]', gray: 'bg-slate-100 border-slate-200 text-slate-600',
};
export const Pill = ({ tone = 'gray', children, className = '' }: { tone?: Tone; children: React.ReactNode; className?: string }) => (
  <span className={`inline-flex items-center gap-1 text-[11px] font-bold border rounded-full px-2.5 py-0.5 whitespace-nowrap ${TONE[tone]} ${className}`}>{children}</span>
);
const Card = ({ children, className = '', testid }: { children: React.ReactNode; className?: string; testid?: string }) => (
  <section className={`bg-white border border-slate-200 rounded-2xl p-3 ${className}`} data-testid={testid}>{children}</section>
);
const Title = ({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) => (
  <div className="flex items-center gap-2 mb-2"><h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">{children}</h3><span className="flex-1" />{right}</div>
);
const Link = ({ children, onClick, testid }: { children: React.ReactNode; onClick?: () => void; testid?: string }) => (
  <button type="button" onClick={onClick} data-testid={testid} className="text-[12px] font-extrabold text-[#0d47c9] cursor-pointer inline-flex items-center gap-0.5">{children}<ChevronRight className="w-3.5 h-3.5" /></button>
);
const Bar = ({ pct, tone = 'blue' }: { pct: number; tone?: 'blue' | 'ok' | 'warn' | 'bad' }) => (
  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1.5"><i className={`block h-full rounded-full ${tone === 'ok' ? 'bg-emerald-500' : tone === 'warn' ? 'bg-amber-500' : tone === 'bad' ? 'bg-rose-500' : 'bg-[#0d47c9]'}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>
);

export interface TodoItem { id: string; icon: string; title: string; sub: string; pill: string; tone: Tone; taskId?: string; goTab?: string; /** mở chi tiết ngày này (báo cáo lỗi chấm công) */ dayDate?: string }
/** Ngày có lỗi chấm công cần báo cáo (thiếu chấm vào/ra ca) */
export interface ReportDay { date: string; label: string }
export interface ProjectItem { id: string; name: string; progress: number; newCount: number }
export interface OverviewHomeData {
  user: { name: string; roleLabel: string };
  todayLabel: string;                // "Thứ Tư, 28/10"
  nowStr: string;                    // "08:11"
  focus: ShiftView | null;
  focusRange: string;                // "07:30–11:30"
  allDoneTimes: string;              // "Sáng 07:24→11:31 · Chiều 13:00→17:02"
  punches: { inS: string; outS: string; inC: string; outC: string };   // giờ đã chấm (rỗng = chưa)
  pendingSync: number;
  week: WeekDay[];
  reportDays: ReportDay[];            // ngày thiếu / lỗi chấm công chưa báo cáo (đã loại ngày nghỉ, ca chưa kết thúc, đã gửi báo cáo)
  kpi: { dueToday: number; overdue: number; toApprove: number; unread: number };
  month: { days: number; standard: number; phep: string | null; phepReserved: number; lateDays: number; earlies: number; allowedLate: number; otHours: number };
  perf: { rate: number | null; done: number; total: number; violations: number; lastViolation?: string };
  todo: TodoItem[];
  leaves: { pending: LeaveLike[]; recent: LeaveLike[] };
  ctp: CtpSummary;
  advance: AdvanceSummary;
  projects: ProjectItem[];
  company: CompanyToday | null;
}
export interface OverviewHomeActions {
  onPunch: (slot: string) => void; onGo: (tab: string) => void; onOpenTask: (taskId: string) => void;
  onRequestLeave: () => void; onRequestAdvance: () => void; onOpenDetail: () => void;
  /** Mở chi tiết 1 ngày (xem giờ chấm, gửi báo cáo lỗi / thiếu chấm ca) */
  onOpenDay: (date: string) => void;
}

const WEEK_CELL: Record<string, string> = {
  ok: 'bg-emerald-50 border-emerald-200', late: 'bg-amber-50 border-amber-200', leave: 'bg-violet-50 border-violet-200', absent: 'bg-rose-50 border-rose-200',
  rest: 'bg-slate-100 border-slate-200 opacity-70', future: 'bg-white border-slate-200', today: 'bg-[#0d47c9] border-[#0d47c9]',
};

function Attendance({ d, a }: { d: OverviewHomeData; a: OverviewHomeActions }) {
  const f = d.focus;
  const steps = [['Vào sáng', d.punches.inS], ['Ra sáng', d.punches.outS], ['Vào chiều', d.punches.inC], ['Ra chiều', d.punches.outC]];
  const cur = steps.findIndex(s => !s[1]);   // mốc kế tiếp chưa chấm
  const sync = d.pendingSync > 0 && <Pill tone="warn">⏳ {d.pendingSync} lượt chờ đồng bộ</Pill>;
  let head: React.ReactNode, btn: React.ReactNode;
  if (!f) {
    head = <div className="flex items-center gap-2"><b className="text-[13px]">✅ Đã hoàn thành các ca hôm nay</b><span className="flex-1" />{sync}</div>;
    btn = d.allDoneTimes ? <div className="text-[12px] text-slate-500 font-mono mt-1">{d.allDoneTimes}</div> : null;
  } else {
    const title = f.state === 'ready' ? `${f.label.replace(/^(Vào|Ra) /, '').replace(/^./, c => c.toUpperCase())} đang mở`
      : f.state === 'working' ? (f.action ? 'Sẵn sàng ra ca' : 'Đang làm việc') : f.state === 'waiting' ? 'Sắp tới giờ vào ca' : 'Đã quá giờ chấm';
    const pill = f.state === 'ready' ? <Pill tone="ok">Trong giờ</Pill> : f.state === 'working' ? <Pill tone="ok">{f.action ? 'Trong giờ' : 'Đúng giờ'}</Pill> : f.state === 'waiting' ? <Pill tone="gray">Chưa mở</Pill> : <Pill tone="bad">Hết giờ</Pill>;
    const enabled = !!f.action;
    head = (
      <div className="flex items-center gap-2 whitespace-nowrap">
        {(f.state === 'ready' || f.state === 'working') && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />}
        <b className="text-[13px]">{title}</b><span className="text-[12px] text-slate-500">{d.focusRange}</span><span className="flex-1" />{pill}
      </div>);
    btn = (
      <>
        {f.inTime && f.state === 'working' && <div className="flex items-center mt-2"><div><div className="text-[11px] text-slate-500">Đã vào ca lúc</div><b className="font-mono text-xl">{f.inTime}</b></div></div>}
        <button type="button" disabled={!enabled} aria-disabled={!enabled} onClick={() => enabled && a.onPunch(f.action)} data-testid="punch-main"
          className={`w-full mt-2.5 py-3 rounded-xl font-extrabold text-[14px] flex flex-col items-center gap-0.5 ${enabled ? 'cursor-pointer shadow-lg shadow-emerald-500/25' : 'bg-slate-100 border border-slate-200 cursor-not-allowed text-slate-400'}`}
          style={enabled ? { background: f.key === 'overtime' || /^Ra|Kết thúc/.test(f.label) ? 'linear-gradient(135deg,#f43f5e,#e11d48)' : 'linear-gradient(135deg,#10b981,#059669)', color: '#ffffff' } : undefined}>
          <span>{enabled ? (/^Ra|Kết thúc/.test(f.label) ? '🔴 ' : '🟢 ') : ''}{f.label}{enabled ? ` · ${d.nowStr}` : ''}</span>
          {!enabled && <span className="text-[11px] font-bold">{f.sub}</span>}
        </button>
      </>);
  }
  return (
    <Card testid="ov-attendance">
      {head}{btn}
      {f && sync && <div className="mt-2">{sync}</div>}
      <div className="relative flex justify-between mt-3" data-testid="ov-steps">
        <span className="absolute left-[12%] right-[12%] top-[9px] h-0.5 bg-slate-200" />
        {steps.map(([label, time], i) => (
          <div key={label} className="relative w-1/4 text-center text-[10.5px] font-bold text-slate-500" data-state={time ? 'done' : i === cur ? 'current' : 'todo'}>
            <i className={`block w-5 h-5 rounded-full mx-auto mb-1 border-2 relative ${time ? 'bg-emerald-500 border-emerald-500' : i === cur ? 'bg-white border-[#0d47c9] ring-4 ring-blue-200' : 'bg-white border-slate-200'}`}>
              {time && <span className="absolute inset-0 grid place-items-center text-[11px] font-black not-italic" style={{ color: '#ffffff' }}>✓</span>}
            </i>
            <span className={i === cur ? 'text-[#0d47c9]' : ''}>{label}</span>
            <em className="block not-italic font-mono text-[11px] text-slate-900">{time || '—'}</em>
          </div>))}
      </div>
    </Card>);
}

export default function OverviewHome({ d, a }: { d: OverviewHomeData; a: OverviewHomeActions }) {
  const wc = { ok: d.week.filter(w => w.kind === 'ok').length, late: d.week.filter(w => w.kind === 'late').length, absent: d.week.filter(w => w.kind === 'absent').length };
  const kpis: [number, string, string, string, string][] = [
    [d.kpi.dueToday, 'Việc hôm nay', 'text-[#0d47c9]', 'tasks', 'kpi-today'], [d.kpi.overdue, 'Quá hạn', d.kpi.overdue > 0 ? 'text-rose-600' : 'text-slate-400', 'tasks', 'kpi-overdue'],
    [d.kpi.toApprove, 'Chờ tôi duyệt', d.kpi.toApprove > 0 ? 'text-violet-600' : 'text-slate-400', 'tasks', 'kpi-approve'], [d.kpi.unread, 'Tin nhắn', d.kpi.unread > 0 ? 'text-emerald-600' : 'text-slate-400', 'messages', 'kpi-unread'],
  ];
  const lateTone = d.month.lateDays > d.month.allowedLate ? 'text-rose-600' : d.month.lateDays > 0 ? 'text-amber-600' : 'text-emerald-600';
  const leaveShown = d.leaves.pending.length + d.leaves.recent.length > 0;
  const ctpShown = d.ctp.pendingCount + d.ctp.approvedCount + d.ctp.rejectedCount > 0;
  const advShown = d.advance.pendingCount + d.advance.approvedCount > 0;
  return (
    <div className="space-y-2.5" id="overview_home" data-testid="overview-home">
      <Card className="!p-3">
        <div className="flex items-center gap-2"><div><div className="text-[12px] text-slate-500">{d.todayLabel} · Xin chào</div><b className="text-base">{d.user.name}</b></div><span className="flex-1" /><Pill tone="blue">{d.user.roleLabel}</Pill></div>
      </Card>

      <div className="space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0 lg:items-start">
        <div className="space-y-2.5">
          <Attendance d={d} a={a} />

          {d.company && (
            <Card testid="ov-company">
              <Title right={<Link onClick={() => a.onGo('employees')}>Chi tiết</Link>}>Toàn công ty hôm nay</Title>
              <div className="flex items-center gap-2"><b className="text-2xl text-[#0d47c9] leading-none">{d.company.present}<small className="text-[13px] text-slate-500 font-semibold"> / {d.company.total}</small></b><span className="text-[12px] text-slate-500">đã điểm danh</span><span className="flex-1" />
                <div className="w-32"><Bar pct={d.company.total ? (d.company.present / d.company.total) * 100 : 0} /></div></div>
              <div className="grid grid-cols-3 gap-2 mt-2.5 text-center">
                {([['warn', d.company.late, 'Đi muộn'], ['vio', d.company.onLeave, 'Nghỉ phép'], ['bad', d.company.absent, 'Chưa điểm danh']] as [Tone, number, string][]).map(([t, n, l]) => (
                  <div key={l} className={`rounded-xl border py-2 ${TONE[t]}`}><b className="block text-base leading-tight">{n}</b><span className="text-[10.5px] font-bold">{l}</span></div>))}
              </div>
              {d.company.missing.length > 0 && <div className="mt-2 text-[12px] text-slate-500">Chưa điểm danh: <b className="text-slate-800">{d.company.missing.slice(0, 3).join(', ')}{d.company.missing.length > 3 ? ` +${d.company.missing.length - 3}` : ''}</b></div>}
            </Card>)}

          <Card testid="ov-week" className="!p-2.5">
            <Title right={<span className="flex gap-1.5"><Pill tone="ok">Đủ công {wc.ok}</Pill>{wc.late > 0 && <Pill tone="warn">Muộn {wc.late}</Pill>}{wc.absent > 0 && <Pill tone="bad">Vắng {wc.absent}</Pill>}</span>}>Tuần này</Title>
            <div className="grid grid-cols-7 gap-1 text-center">
              {d.week.map(w => {
                const openable = w.kind === 'ok' || w.kind === 'late' || w.kind === 'absent' || w.kind === 'leave' || w.kind === 'today';   // ngày đã tới: bấm xem chi tiết / báo cáo
                const cls = `rounded-xl border py-1 text-[10.5px] font-bold ${WEEK_CELL[w.kind]}`;
                const st = w.kind === 'today' ? { color: 'rgba(255,255,255,.85)' } : { color: '#64748b' };
                const inner = <>{w.label}<b className="block text-sm" style={{ color: w.kind === 'today' ? '#ffffff' : '#081c36' }}>{w.day}</b>{w.note || '\u00a0'}</>;
                return openable
                  ? <button key={w.date} type="button" onClick={() => a.onOpenDay(w.date)} data-kind={w.kind} data-testid="week-day" aria-label={`Xem chi tiết ngày ${w.day}`} className={`${cls} cursor-pointer`} style={st}>{inner}</button>
                  : <div key={w.date} data-kind={w.kind} data-testid="week-day-static" className={cls} style={st}>{inner}</div>;
              })}
            </div>
            {d.reportDays.length > 0 && (
              <button type="button" onClick={() => a.onOpenDay(d.reportDays[0].date)} data-testid="report-banner"
                className="w-full mt-2 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-left cursor-pointer">
                <span>📝</span><span className="flex-1 text-[12px] font-bold text-amber-800">Có {d.reportDays.length} ngày thiếu / lỗi chấm công cần báo cáo</span><ChevronRight className="w-4 h-4 text-amber-700" />
              </button>)}
          </Card>

          <div className="grid grid-cols-4 gap-2" data-testid="ov-kpi">
            {kpis.map(([n, label, cls, tab, id]) => (
              <button key={id} type="button" onClick={() => a.onGo(tab)} data-testid={id} className="bg-white border border-slate-200 rounded-2xl py-2 px-1 text-center cursor-pointer">
                <b className={`block text-xl leading-tight ${cls}`}>{n}</b><span className="text-[10.5px] font-bold text-slate-500 leading-tight block">{label}</span>
              </button>))}
          </div>

          <div className="grid grid-cols-2 gap-2" data-testid="ov-month">
            <div className="bg-white border border-slate-200 rounded-2xl p-2.5"><span className="text-[11px] font-bold text-slate-500">Công tháng {d.week[0]?.date.slice(5, 7)}</span>
              <b className="block text-xl text-[#0d47c9] leading-tight">{Number(d.month.days.toFixed(1)).toLocaleString('vi-VN')}<small className="text-[13px] text-slate-500 font-semibold"> / {d.month.standard}</small></b><Bar pct={d.month.standard ? (d.month.days / d.month.standard) * 100 : 0} /></div>
            <div className="bg-white border border-slate-200 rounded-2xl p-2.5"><span className="text-[11px] font-bold text-slate-500">Phép năm còn</span>
              <b className="block text-xl text-emerald-600 leading-tight">{d.month.phep ?? '—'}<small className="text-[13px] text-slate-500 font-semibold"> ngày</small></b>
              <small className="text-[11px] text-slate-500">{d.month.phepReserved > 0 ? `Đang chờ duyệt: ${d.month.phepReserved} ngày` : 'Không có đơn chờ'}</small></div>
            <div className="bg-white border border-slate-200 rounded-2xl p-2.5"><span className="text-[11px] font-bold text-slate-500">Đi muộn / về sớm</span>
              <b className={`block text-xl leading-tight ${lateTone}`}>{d.month.lateDays}<small className="text-[13px] text-slate-500 font-semibold"> / {d.month.earlies}</small></b><small className="text-[11px] text-slate-500">Tối đa {d.month.allowedLate} ngày muộn/tháng</small></div>
            <div className="bg-white border border-slate-200 rounded-2xl p-2.5"><span className="text-[11px] font-bold text-slate-500">Tăng ca</span>
              <b className="block text-xl text-violet-600 leading-tight">{Number(d.month.otHours.toFixed(1)).toLocaleString('vi-VN')}<small className="text-[13px] text-slate-500 font-semibold"> giờ</small></b><small className="text-[11px] text-slate-500">Tháng này</small></div>
          </div>

          <Card testid="ov-perf">
            <Title>Hiệu suất tháng {d.week[0]?.date.slice(5, 7)}</Title>
            <div className="flex items-center gap-3.5">
              <div className="w-[76px] h-[76px] rounded-full grid place-items-center shrink-0" style={{ background: `conic-gradient(#0a4fd8 0 ${(d.perf.rate ?? 0) * 3.6}deg, #e8eef9 ${(d.perf.rate ?? 0) * 3.6}deg)` }} data-testid="perf-ring">
                <div className="w-[58px] h-[58px] rounded-full bg-white grid place-items-center text-center leading-none"><b className="text-xl">{d.perf.rate === null ? '—' : `${d.perf.rate}%`}</b><small className="text-[9.5px] font-bold text-slate-500 -mt-1">hoàn thành</small></div>
              </div>
              <div className="flex-1 space-y-2 text-[12px]">
                <div><div className="flex justify-between"><span className="text-slate-500 font-bold">Việc trong tháng</span><b>{d.perf.done}/{d.perf.total}</b></div><Bar pct={d.perf.total ? (d.perf.done / d.perf.total) * 100 : 0} tone="ok" /></div>
                <div><div className="flex justify-between"><span className="text-slate-500 font-bold">Giờ giấc (ngày muộn)</span><b>{d.month.lateDays}/{d.month.allowedLate}</b></div><Bar pct={d.month.allowedLate ? (d.month.lateDays / d.month.allowedLate) * 100 : 0} tone={d.month.lateDays > d.month.allowedLate ? 'bad' : 'warn'} /></div>
                <div className="flex justify-between"><span className="text-slate-500 font-bold">Vi phạm trong tháng</span><b className={d.perf.violations > 0 ? 'text-rose-600' : 'text-emerald-600'}>{d.perf.violations}</b></div>
              </div>
            </div>
            {d.perf.lastViolation && <div className="mt-2 text-[11.5px] text-slate-500">Gần nhất: <span className="font-semibold text-slate-700">{d.perf.lastViolation}</span></div>}
          </Card>
        </div>

        <div className="space-y-2.5">
          <Card testid="ov-todo" className="!py-2">
            <Title right={<Link onClick={() => a.onGo('tasks')}>Xem tất cả</Link>}>Cần làm ngay</Title>
            {d.todo.length === 0 ? <div className="text-[12.5px] text-slate-500 py-2">Không có việc cần xử lý gấp. 👍</div> : d.todo.map(t => (
              <button key={t.id} type="button" onClick={() => (t.dayDate ? a.onOpenDay(t.dayDate) : t.taskId ? a.onOpenTask(t.taskId) : a.onGo(t.goTab || 'tasks'))} className="w-full flex items-center gap-2.5 py-2 border-t first:border-t-0 border-slate-100 text-left cursor-pointer" data-testid="todo-item">
                <span className="w-9 h-9 rounded-xl bg-slate-50 grid place-items-center text-base shrink-0">{t.icon}</span>
                <span className="flex-1 min-w-0"><b className="block text-[13px] leading-tight truncate">{t.title}</b><small className="text-[11.5px] text-slate-500 block truncate">{t.sub}</small></span><Pill tone={t.tone}>{t.pill}</Pill>
              </button>))}
          </Card>

          {leaveShown && (
            <Card testid="ov-leave">
              <Title right={d.leaves.pending.length > 0 ? <Pill tone="warn">{d.leaves.pending.length} đang chờ</Pill> : undefined}>Đơn nghỉ phép của tôi</Title>
              {[...d.leaves.pending, ...d.leaves.recent].map(l => (
                <div key={l.id} className="flex items-start gap-2.5 py-2 border-t first:border-t-0 border-slate-100" data-testid="leave-item" data-status={l.status}>
                  <span className="w-9 h-9 rounded-xl bg-slate-50 grid place-items-center text-base shrink-0">🌴</span>
                  <span className="flex-1 min-w-0"><b className="block text-[13px] leading-tight">{l.type} · {fmtLeaveRange(l)}{l.daysCount ? ` (${l.daysCount} ngày)` : ''}</b>
                    <small className="text-[11.5px] text-slate-500 block">{l.status === 'pending' ? `Người duyệt: ${l.approverName || '—'}` : l.status === 'approved' ? 'Đã được duyệt' : 'Đã bị từ chối'}</small>
                    {l.status === 'pending' && <span className="flex items-center gap-1.5 mt-1.5 text-[10.5px] font-bold text-slate-500"><span className="text-emerald-600">✓ Đã gửi</span><i className="flex-1 h-0.5 bg-slate-200" /><span className="text-[#0d47c9]">● Chờ duyệt</span><i className="flex-1 h-0.5 bg-slate-200" /><span>Hoàn tất</span></span>}
                  </span>
                  {l.status !== 'pending' && <Pill tone={l.status === 'approved' ? 'ok' : 'bad'}>{l.status === 'approved' ? 'Đã duyệt' : 'Từ chối'}</Pill>}
                </div>))}
            </Card>)}

          {ctpShown && (
            <Card testid="ov-ctp">
              <Title right={<Link onClick={a.onOpenDetail}>Chi tiết</Link>}>Công tác phí của tôi</Title>
              <div className="grid grid-cols-3 gap-2 text-center mb-1.5">
                <div className={`rounded-xl border py-1.5 ${TONE.warn}`}><b className="block text-sm">{fmtMoneyShort(d.ctp.pendingSum)}</b><span className="text-[10.5px] font-bold">Chờ duyệt ({d.ctp.pendingCount})</span></div>
                <div className={`rounded-xl border py-1.5 ${TONE.ok}`}><b className="block text-sm">{fmtMoneyShort(d.ctp.approvedSum)}</b><span className="text-[10.5px] font-bold">Đã duyệt ({d.ctp.approvedCount})</span></div>
                <div className={`rounded-xl border py-1.5 ${TONE.gray}`}><b className="block text-sm">{d.ctp.rejectedCount}</b><span className="text-[10.5px] font-bold">Từ chối</span></div>
              </div>
              {d.ctp.latest.map((c, i) => (
                <div key={c.id || c.code || i} className="flex items-center gap-2.5 py-2 border-t border-slate-100" data-testid="ctp-item">
                  <span className="w-9 h-9 rounded-xl bg-slate-50 grid place-items-center text-base shrink-0">🧾</span>
                  <span className="flex-1 min-w-0"><b className="block text-[13px] leading-tight truncate">{c.content || 'Công tác phí'}</b><small className="text-[11.5px] text-slate-500 block truncate">{[c.code || c.id, c.missionName].filter(Boolean).join(' · ')}</small></span>
                  <span className="text-right shrink-0"><b className="block text-[12.5px]">{fmtMoney(Number(c.amount || 0))}</b><Pill tone={c.status === 'pending' ? 'warn' : c.status === 'rejected' ? 'bad' : 'ok'}>{c.status === 'pending' ? 'Chờ duyệt' : c.status === 'rejected' ? 'Từ chối' : 'Đã duyệt'}</Pill></span>
                </div>))}
            </Card>)}

          {advShown && (
            <Card testid="ov-advance">
              <Title right={<Link onClick={a.onRequestAdvance}>Đề xuất</Link>}>Tạm ứng lương tháng này</Title>
              <div className="flex items-center gap-2"><div><div className="text-[11px] text-slate-500">{d.advance.approvedCount > 0 ? 'Đã được duyệt' : 'Đang chờ duyệt'}</div><b className="text-lg">{fmtMoney(d.advance.approvedCount > 0 ? d.advance.approvedSum : d.advance.pendingSum)}</b></div><span className="flex-1" />
                <div className="text-right">{d.advance.pendingCount > 0 && <Pill tone="warn">{d.advance.pendingCount} chờ · {fmtMoneyShort(d.advance.pendingSum)}</Pill>}{d.advance.approvedCount > 0 && <div className="mt-1"><Pill tone="ok">{d.advance.approvedCount} đã duyệt</Pill></div>}</div></div>
            </Card>)}

          {d.projects.length > 0 && (
            <Card testid="ov-projects" className="!py-2">
              <Title right={<Link onClick={() => a.onGo('projects-construction')}>Tất cả</Link>}>Dự án của tôi</Title>
              {d.projects.map(p => (
                <div key={p.id} className="flex items-center gap-2.5 py-2 border-t first:border-t-0 border-slate-100" data-testid="project-item">
                  <span className="w-9 h-9 rounded-xl bg-blue-50 grid place-items-center text-base shrink-0">🏗️</span>
                  <span className="flex-1 min-w-0"><b className="block text-[13px] leading-tight truncate">{p.name}</b><small className="text-[11.5px] text-slate-500">Tiến độ {Math.round(p.progress)}%</small><Bar pct={p.progress} /></span>
                  {p.newCount > 0 && <Pill tone="ok">{p.newCount} mới</Pill>}
                </div>))}
            </Card>)}

          <div className="grid grid-cols-2 gap-2" data-testid="ov-quick">
            <button type="button" onClick={a.onRequestLeave} data-testid="quick-leave" className="bg-white border border-slate-200 rounded-2xl py-2.5 text-[12.5px] font-extrabold text-slate-700 inline-flex items-center justify-center gap-1.5 cursor-pointer"><CalendarCheck className="w-4 h-4 text-[#0d47c9]" />Xin nghỉ phép</button>
            <button type="button" onClick={a.onRequestAdvance} data-testid="quick-advance" className="bg-white border border-slate-200 rounded-2xl py-2.5 text-[12.5px] font-extrabold text-slate-700 inline-flex items-center justify-center gap-1.5 cursor-pointer"><DollarSign className="w-4 h-4 text-emerald-600" />Đề xuất ứng lương</button>
          </div>
          <button type="button" onClick={a.onOpenDetail} data-testid="open-detail" className="w-full bg-[#0d47c9]/5 border border-[#0d47c9]/20 rounded-2xl py-2.5 text-[12.5px] font-extrabold text-[#0d47c9] cursor-pointer">Lịch tháng &amp; chi tiết chấm công ›</button>
        </div>
      </div>
    </div>
  );
}
