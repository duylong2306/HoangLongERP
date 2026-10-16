import React, { useMemo, useState } from 'react';
import { Pin, CheckCircle2 } from 'lucide-react';
import type { Employee } from '../types';
import UserAvatar from './UserAvatar';
import {
  type MyWorkItem, type AssignedByMe, type Bucket, BUCKET_LABEL, BUCKET_ORDER,
  groupByBucket, focusItems, weekStrip, awaitingReceive, countByProject, bucketOf, readPins, writePins,
} from '../lib/myWork';
import { diffDays } from '../lib/executiveDashboard';

// Kiểu xem TỔNG QUAN của "Việc của tôi" — gom việc, nhiệm vụ và các mục chờ xử lý vào một màn hình (xem lib/myWork.ts).
// Thành phần thuần hiển thị: dữ liệu và hành động (Nhận việc, Duyệt, Mở…) do TaskManagement truyền xuống.

export interface InboxAction { label: string; tone: 'ok' | 'no' | 'main'; onClick: () => void }
export interface InboxItem {
  key: string;
  chip: string;                     // nhãn loại: "Duyệt chi", "Nghỉ phép", "Vật tư"…
  chipTone: 'amber' | 'orange' | 'violet' | 'sky' | 'rose' | 'emerald';
  title: string;
  meta: string;
  amount?: number;
  right?: string;                   // chữ nhỏ bên phải (vd "Tìm NCC")
  actions: InboxAction[];
}

interface Props {
  today: string;
  user: Employee;
  items: MyWorkItem[];
  inbox: InboxItem[];
  byMe: AssignedByMe[];
  employees: Employee[];
  pinKey: string;
  onOpenTask: (taskId: string) => void;
  onReceive: (item: MyWorkItem) => void;
}

const money = (n: number) => `${Math.round(n || 0).toLocaleString('vi-VN')} đ`;
const dm = (ymd: string) => (ymd ? `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}` : '—');
const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const CHIP: Record<InboxItem['chipTone'], string> = {
  amber: 'bg-amber-100 text-amber-700', orange: 'bg-orange-100 text-orange-700', violet: 'bg-violet-100 text-violet-700',
  sky: 'bg-sky-100 text-sky-700', rose: 'bg-rose-100 text-rose-700', emerald: 'bg-emerald-100 text-emerald-700',
};
const BUCKET_TONE: Record<Bucket, string> = { late: 'bg-rose-500', today: 'bg-amber-500', week: 'bg-sky-500', later: 'bg-slate-400', none: 'bg-slate-300' };
const BUCKET_TEXT: Record<Bucket, string> = { late: 'text-rose-700', today: 'text-amber-700', week: 'text-sky-700', later: 'text-slate-500', none: 'text-slate-500' };
// màu ổn định theo tên công trình
const PAL = ['#0ea5e9', '#6366f1', '#10b981', '#f59e0b', '#ec4899', '#14b8a6', '#8b5cf6', '#f97316'];
const colorOf = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return PAL[h % PAL.length]; };

function DueBadge({ due, today }: { due: string; today: string }) {
  if (!due) return <span className="text-[10.5px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 whitespace-nowrap">Không hạn</span>;
  const d = diffDays(today, due);
  if (d < 0) return <span className="text-[10.5px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 whitespace-nowrap">Trễ {-d} ngày</span>;
  if (d === 0) return <span className="text-[10.5px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">Hôm nay</span>;
  return <span className={`text-[10.5px] font-extrabold px-2 py-0.5 rounded-full whitespace-nowrap ${d <= 2 ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'}`}>{d === 1 ? 'Ngày mai' : `Còn ${d} ngày`} · {dm(due)}</span>;
}

function Ring({ pct }: { pct: number }) {
  const p = Math.max(0, Math.min(100, pct || 0));
  return (
    <span className="relative inline-grid place-items-center w-7 h-7 rounded-full shrink-0" style={{ background: `conic-gradient(#059669 ${p}%, #e2e8f0 0)` }} title={`${p}% hoàn thành`}>
      <span className="absolute inset-1 bg-white rounded-full" />
      <b className="relative text-[8.5px] font-extrabold text-slate-700">{p}</b>
    </span>
  );
}

export default function MyWorkOverview({ today, user, items, inbox, byMe, employees, pinKey, onOpenTask, onReceive }: Props) {
  // ─── Việc ghim "Tập trung hôm nay": lưu trình duyệt, hết ngày tự làm mới ───
  const [pins, setPins] = useState<string[]>(() => readPins(pinKey, today));
  const togglePin = (key: string) => setPins(prev => {
    const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
    writePins(pinKey, today, next);
    return next;
  });

  const groups = useMemo(() => groupByBucket(items, today), [items, today]);
  const focus = useMemo(() => focusItems(items, today, pins), [items, today, pins]);
  const strip = useMemo(() => weekStrip(items, today), [items, today]);
  const waiting = useMemo(() => awaitingReceive(items), [items]);
  const projects = useMemo(() => countByProject(items).slice(0, 6), [items]);
  const empById = useMemo(() => new Map(employees.map(e => [e.id, e])), [employees]);
  const firstName = (user.name || '').trim().split(/\s+/).pop() || user.name;
  const lateCount = groups.late.length, todayCount = groups.today.length;

  const row = (it: MyWorkItem, opts: { showReceive?: boolean } = {}) => {
    const pinned = pins.includes(it.key);
    return (
      <div key={it.key} data-testid="mywork-row" className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-center px-4 py-2.5 border-t border-slate-100 hover:bg-amber-50/40">
        <span className={`w-[18px] h-[18px] rounded-full border-2 ${opts.showReceive ? 'border-sky-500 bg-sky-100' : 'border-slate-300'}`} />
        <button type="button" onClick={() => onOpenTask(it.taskId)} className="min-w-0 text-left cursor-pointer" title="Mở chi tiết">
          <div className="font-bold text-[13px] text-slate-800 truncate">{it.title}</div>
          <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500 mt-0.5">
            <span className={`text-[9.5px] font-extrabold uppercase px-1.5 py-0.5 rounded ${it.kind === 'task' ? 'bg-sky-100 text-sky-700' : 'bg-indigo-100 text-indigo-700'}`}>{it.kind === 'task' ? 'Công việc' : 'Nhiệm vụ'}</span>
            {it.project && <span className="inline-flex items-center gap-1 font-semibold text-slate-600"><i className="w-[7px] h-[7px] rounded-sm inline-block" style={{ background: colorOf(it.project) }} />{it.project}</span>}
            {it.kind === 'mission' && <span className="truncate">· {it.taskName}</span>}
            <span className={`font-bold ${it.status === 'doing' ? 'text-sky-600' : 'text-slate-400'}`}>{it.status === 'doing' ? 'Đang làm' : it.status === 'todo' ? 'Chưa làm' : ''}</span>
          </div>
        </button>
        <div className="flex items-center gap-2">
          {it.rate !== null && <Ring pct={it.rate} />}
          <DueBadge due={it.due} today={today} />
          {it.canReceive && (opts.showReceive || it.status === 'todo') && (
            <button type="button" data-testid="mywork-receive" onClick={() => onReceive(it)} className="bg-sky-600 hover:bg-sky-500 text-white px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer">Nhận việc</button>
          )}
          <button type="button" aria-label={pinned ? 'Bỏ ghim' : 'Ghim vào Tập trung hôm nay'} title={pinned ? 'Bỏ ghim' : 'Ghim vào Tập trung hôm nay'} onClick={() => togglePin(it.key)} className={`cursor-pointer ${pinned ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}>
            <Pin className="w-3.5 h-3.5" fill={pinned ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>
    );
  };

  const stats: { label: string; n: number; cls: string }[] = [
    { label: 'Quá hạn', n: lateCount, cls: 'text-rose-600' },
    { label: 'Hôm nay', n: todayCount, cls: 'text-amber-600' },
    { label: 'Mới, chờ nhận', n: waiting.length, cls: 'text-sky-600' },
    { label: 'Chờ tôi xử lý', n: inbox.length, cls: 'text-indigo-600' },
    { label: 'Tôi giao', n: byMe.length, cls: 'text-emerald-600' },
  ];

  return (
    <div className="space-y-3 text-slate-800" data-testid="mywork-overview">
      {/* Lời chào + dải 7 ngày */}
      <div>
        <h2 className="text-[22px] font-extrabold tracking-tight">Chào {firstName} 👋</h2>
        <p className="text-[11.5px] text-slate-500">Hôm nay {dm(today)}/{today.slice(0, 4)} · {lateCount} việc quá hạn · {todayCount} việc đến hạn hôm nay · {inbox.length} mục chờ bạn xử lý</p>
      </div>
      <div className="grid grid-cols-7 gap-2" data-testid="mywork-week">
        {strip.map(d => {
          const dt = new Date(`${d.day}T00:00:00`);
          return (
            <div key={d.day} className={`rounded-2xl border px-1 pt-2 pb-2 text-center ${d.isToday ? 'bg-gradient-to-br from-orange-50 to-amber-50 border-amber-300' : 'bg-white border-slate-200'}`}>
              <small className={`block text-[10.5px] font-bold ${d.isToday ? 'text-amber-700' : 'text-slate-500'}`}>{d.isToday ? 'Hôm nay' : WD[dt.getDay()]}</small>
              <b className="block text-[19px] leading-tight">{dt.getDate()}</b>
              <div className="h-2.5 mt-1 flex items-center justify-center gap-[3px]">
                {d.count > 0 ? Array.from({ length: Math.min(d.count, 4) }).map((_, i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-sky-500" />) : <span className="text-[9.5px] text-slate-400">rảnh</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
        {stats.map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-2xl px-3.5 py-2.5 flex items-baseline gap-2">
            <b className={`text-2xl font-extrabold ${s.cls}`} data-testid={`mywork-stat-${s.label}`}>{s.n}</b>
            <span className="text-[11.5px] font-bold text-slate-500">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_350px] gap-3 items-start">
        {/* ── CỘT CHÍNH ── */}
        <div className="space-y-3">
          <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden" data-testid="mywork-focus">
            <div className="flex justify-between items-start px-4 pt-3.5 pb-2">
              <div>
                <h3 className="text-sm font-extrabold">Tập trung hôm nay</h3>
                <p className="text-[11px] text-slate-500">Tự gom việc quá hạn và đến hạn hôm nay · ghim thêm việc bạn muốn làm · làm mới mỗi sáng</p>
              </div>
              <span className="bg-slate-100 rounded-full px-2.5 py-0.5 text-xs font-extrabold text-slate-500">{focus.length}</span>
            </div>
            {focus.length === 0
              ? <div className="px-4 py-6 text-center text-slate-500 text-xs">🎉 Hôm nay chưa có việc đến hạn. Bạn có thể ghim việc từ danh sách bên dưới vào đây.</div>
              : focus.map(i => row(i))}
          </section>

          {waiting.length > 0 && (
            <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden" data-testid="mywork-waiting">
              <div className="flex justify-between items-start px-4 pt-3.5 pb-2">
                <div>
                  <h3 className="text-sm font-extrabold">Mới được giao — chờ bạn nhận</h3>
                  <p className="text-[11px] text-slate-500">Việc chưa bắt đầu: bấm "Nhận việc" để chuyển sang Đang làm</p>
                </div>
                <span className="bg-slate-100 rounded-full px-2.5 py-0.5 text-xs font-extrabold text-slate-500">{waiting.length}</span>
              </div>
              {waiting.map(i => row(i, { showReceive: true }))}
            </section>
          )}

          <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden" data-testid="mywork-all">
            <div className="flex justify-between items-start px-4 pt-3.5 pb-2">
              <div>
                <h3 className="text-sm font-extrabold">Tất cả việc của tôi</h3>
                <p className="text-[11px] text-slate-500">Gom theo mốc thời gian · bấm tiêu đề nhóm để thu gọn</p>
              </div>
              <span className="bg-slate-100 rounded-full px-2.5 py-0.5 text-xs font-extrabold text-slate-500">{items.length}</span>
            </div>
            {items.length === 0 && <div className="px-4 py-8 text-center text-slate-500 text-xs">Chưa có việc nào được giao cho bạn.</div>}
            {BUCKET_ORDER.map(b => groups[b].length === 0 ? null : (
              <details key={b} open={b === 'late' || b === 'today' || b === 'week'} className="group" data-testid={`mywork-group-${b}`}>
                <summary className="list-none cursor-pointer flex items-center gap-2 px-4 py-2 bg-slate-50 border-t border-slate-200 [&::-webkit-details-marker]:hidden">
                  <i className={`w-2 h-2 rounded-full ${BUCKET_TONE[b]}`} />
                  <h4 className={`text-[11px] font-extrabold uppercase tracking-wider ${BUCKET_TEXT[b]}`}>{BUCKET_LABEL[b]}</h4>
                  <span className="bg-slate-100 rounded-full px-2 text-[10.5px] font-extrabold text-slate-500">{groups[b].length}</span>
                  <span className="ml-auto text-slate-400 text-xs group-open:rotate-90 transition-transform">▸</span>
                </summary>
                {groups[b].map(i => row(i))}
              </details>
            ))}
          </section>
        </div>

        {/* ── CỘT PHẢI ── */}
        <div className="space-y-3">
          <section className="bg-white border border-slate-200 rounded-2xl p-3.5" data-testid="mywork-inbox">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-extrabold">Chờ tôi xử lý</h3>
              <span className="bg-slate-100 rounded-full px-2.5 py-0.5 text-xs font-extrabold text-slate-500">{inbox.length}</span>
            </div>
            {inbox.length === 0 && <p className="text-[11.5px] text-slate-500 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" />Không có mục nào đang chờ.</p>}
            {inbox.map(a => (
              <div key={a.key} data-testid="mywork-inbox-item" className="border border-slate-200 rounded-xl p-2.5 mb-2 bg-slate-50/40">
                <div className="flex justify-between items-center">
                  <span className={`text-[9.5px] font-extrabold uppercase px-1.5 py-0.5 rounded ${CHIP[a.chipTone]}`}>{a.chip}</span>
                  <b className="text-[12px]">{a.amount ? money(a.amount) : a.right || ''}</b>
                </div>
                <div className="font-bold text-[12.5px] mt-1.5 line-clamp-2">{a.title}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{a.meta}</div>
                <div className="flex gap-1.5 justify-end mt-2">
                  {a.actions.map(ac => (
                    <button key={ac.label} type="button" onClick={ac.onClick}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer ${ac.tone === 'ok' ? 'bg-emerald-600 text-white hover:bg-emerald-500' : ac.tone === 'no' ? 'bg-white text-rose-600 border border-rose-200 hover:bg-rose-50' : 'bg-blue-600 text-white hover:bg-blue-500'}`}>
                      {ac.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>

          {byMe.length > 0 && (
            <section className="bg-white border border-slate-200 rounded-2xl p-3.5" data-testid="mywork-byme">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-extrabold">Tôi giao cho người khác</h3>
                <span className="bg-slate-100 rounded-full px-2.5 py-0.5 text-xs font-extrabold text-slate-500">{byMe.length}</span>
              </div>
              {byMe.slice(0, 6).map(x => (
                <button key={x.taskId} type="button" onClick={() => onOpenTask(x.taskId)} className="w-full grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2.5 items-center py-2 border-t border-slate-100 first:border-t-0 text-left cursor-pointer hover:bg-amber-50/40">
                  <UserAvatar employee={empById.get(x.assigneeId || '') || null} name={x.assigneeName} size="sm" />
                  <div className="min-w-0">
                    <div className="font-bold text-[12.5px] truncate">{x.title}</div>
                    <div className="text-[11px] text-slate-500 truncate">{x.assigneeName}{x.project ? ` · ${x.project}` : ''} · {x.due ? dm(x.due) : 'không hạn'}</div>
                  </div>
                  <Ring pct={x.rate} />
                </button>
              ))}
              {byMe.length > 6 && <p className="text-[11px] text-slate-500 mt-1.5">+{byMe.length - 6} việc khác</p>}
            </section>
          )}

          {projects.length > 0 && (
            <section className="bg-white border border-slate-200 rounded-2xl p-3.5">
              <h3 className="text-sm font-extrabold mb-2">Việc theo công trình</h3>
              {projects.map(p => (
                <div key={p.project} className="my-2">
                  <div className="flex justify-between text-xs font-semibold"><span className="truncate max-w-[250px]">{p.project}</span><b>{p.count}</b></div>
                  <div className="h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden"><i className="block h-full rounded-full" style={{ width: `${Math.min(100, p.count * 18)}%`, background: colorOf(p.project) }} /></div>
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
