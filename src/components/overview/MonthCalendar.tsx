import React from 'react';
import type { MonthDay } from '../../lib/overviewData';
import { monthCounts, monthStartOffset } from '../../lib/overviewData';
import { Pill } from './OverviewHome';

// LỊCH THÁNG CHẤM CÔNG kiểu LoLo (thay lịch tối cũ trong "Lịch tháng & chi tiết chấm công"): mỗi ngày là 1 ô vuông có màu theo trạng thái,
// số công / ký hiệu ở dưới, chấm cam "!" khi ngày có lỗi chấm công chưa báo cáo, chấm tím khi có tăng ca. Bấm ngày đã tới → mở hộp "Chi tiết ngày".
// Thuần HIỂN THỊ: dữ liệu do buildMonth (lib/overviewData.ts) tính sẵn. Chữ trắng trên ô "hôm nay" dùng style nội tuyến (index.css ép text-white).

const DOW = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const CELL: Record<string, string> = {
  ok: 'bg-emerald-50 border-emerald-200', late: 'bg-amber-50 border-amber-200', leave: 'bg-violet-50 border-violet-200', absent: 'bg-rose-50 border-rose-200',
  rest: 'bg-slate-100 border-slate-200', holiday: 'bg-sky-50 border-sky-200', future: 'bg-white border-slate-200', today: 'bg-[#0d47c9] border-[#0d47c9]',
};
const LABEL_COLOR: Record<string, string> = { ok: '#047857', late: '#b45309', leave: '#6d28d9', absent: '#be123c', rest: '#94a3b8', holiday: '#0369a1', future: '#cbd5e1', today: 'rgba(255,255,255,.9)' };
const LEGEND: [string, string, string][] = [['ok', 'Đủ công', 'bg-emerald-400'], ['late', 'Đi muộn', 'bg-amber-400'], ['absent', 'Vắng', 'bg-rose-400'], ['leave', 'Nghỉ phép', 'bg-violet-400'], ['holiday', 'Lễ', 'bg-sky-400'], ['rest', 'Nghỉ tuần', 'bg-slate-300']];

interface Props { ym: string; days: MonthDay[]; userName: string; onOpenDay: (date: string) => void; onClose: () => void }

export default function MonthCalendar({ ym, days, userName, onOpenDay, onClose }: Props) {
  const c = monthCounts(days);
  const [y, m] = ym.split('-');
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-3" id="overview_detail" data-testid="month-calendar">
      <div className="flex items-center gap-2 mb-2">
        <div className="min-w-0"><h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Lịch chấm công tháng {m}/{y}</h3><div className="text-[12px] text-slate-500 truncate">{userName}</div></div>
        <span className="flex-1" />
        <button type="button" onClick={onClose} data-testid="close-detail" className="text-[12px] font-extrabold text-slate-500 cursor-pointer">Thu gọn ▲</button>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2.5" data-testid="month-counts">
        <Pill tone="ok">Đủ công {c.ok}</Pill>
        {c.late > 0 && <Pill tone="warn">Muộn {c.late}</Pill>}
        {c.absent > 0 && <Pill tone="bad">Vắng {c.absent}</Pill>}
        {c.leave > 0 && <Pill tone="vio">Nghỉ phép {c.leave}</Pill>}
        {c.issue > 0 && <Pill tone="warn">⚠ {c.issue} ngày cần báo cáo</Pill>}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10.5px] font-extrabold mb-1">
        {DOW.map((d, i) => <div key={d} style={{ color: i === 6 ? '#e11d48' : '#64748b' }}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: monthStartOffset(ym) }, (_, i) => <div key={`e${i}`} />)}
        {days.map(d => {
          // Ngày đã tới (hoặc có lỗi cần báo cáo) mới bấm được; ngày tương lai / nghỉ tuần không có gì để xem
          const openable = d.kind === 'ok' || d.kind === 'late' || d.kind === 'absent' || d.kind === 'leave' || d.kind === 'today' || d.issue;
          const cls = `relative rounded-xl border aspect-square flex flex-col items-center justify-center leading-none ${CELL[d.kind]}`;
          const inner = <>
            <b className="text-[13px]" style={{ color: d.kind === 'today' ? '#ffffff' : d.kind === 'rest' || d.kind === 'future' ? '#94a3b8' : '#081c36' }}>{d.day}</b>
            <span className="text-[9.5px] font-bold mt-1 h-[11px]" style={{ color: LABEL_COLOR[d.kind] }}>{d.label}</span>
            {d.issue && <i className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-amber-500 grid place-items-center not-italic text-[10px] font-black" style={{ color: '#ffffff' }} aria-label="Có lỗi chấm công chưa báo cáo">!</i>}
            {d.ot && <i className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-violet-500" aria-label="Có tăng ca" />}
          </>;
          return openable
            ? <button key={d.date} type="button" onClick={() => onOpenDay(d.date)} data-kind={d.kind} data-issue={d.issue || undefined} data-testid="month-day" title={d.holiday} aria-label={`Xem chi tiết ngày ${d.day}`} className={`${cls} cursor-pointer`}>{inner}</button>
            : <div key={d.date} data-kind={d.kind} data-testid="month-day-static" title={d.holiday} className={cls}>{inner}</div>;
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 text-[11px] text-slate-500" data-testid="month-legend">
        {LEGEND.map(([k, t, dot]) => <span key={k} className="inline-flex items-center gap-1"><i className={`w-2.5 h-2.5 rounded-full ${dot}`} />{t}</span>)}
        <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full bg-violet-500" />Tăng ca</span>
      </div>
      <div className="mt-2 text-[11.5px] text-slate-500">{c.issue > 0 ? 'Bấm vào ngày có dấu ! để xem giờ chấm và gửi báo cáo lý do.' : 'Bấm vào một ngày để xem giờ chấm từng ca.'}</div>
    </section>
  );
}
