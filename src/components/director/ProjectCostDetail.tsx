import { useMemo } from 'react';
import { X, ChevronDown } from 'lucide-react';
import type { Project } from '../../types';
import { COST_GROUPS, type ProjectCost, type CostItem } from '../../lib/projectCost';
import { fmtFull, dmy } from './kit';

// MÀN HÌNH "CHI TIẾT TỔNG CHI PHÍ" của 1 công trình (Bảng điều hành Giám đốc → Phòng Dự Án).
// Máy tính: ngăn kéo bên phải (560px). Điện thoại: toàn màn hình, tiêu đề dưới tai thỏ (safe-area).
// Trình bày: tổng + đã chi/còn phải chi → thanh tỷ trọng 6 nhóm → từng nhóm bấm mở ra danh sách khoản (số tiền, ngày, người nhận, trạng thái).
interface Props { project: Project; cost: ProjectCost; items: CostItem[]; onClose: () => void; }
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

export default function ProjectCostDetail({ project, cost, items, onClose }: Props) {
  const groups = useMemo(() => COST_GROUPS.map(g => {
    const list = items.filter(i => i.group === g.key).sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.amount - a.amount);
    return { ...g, list, sum: list.reduce((s, i) => s + i.amount, 0) };
  }).filter(g => g.list.length > 0), [items]);
  const biggest = groups.reduce((m, g) => (g.sum > (m?.sum ?? -1) ? g : m), null as (typeof groups)[number] | null);

  return (
    <div className="fixed inset-0 z-[70] flex justify-end" role="dialog" aria-label="Chi tiết tổng chi phí" data-testid="cost-detail">
      <div className="absolute inset-0 bg-slate-900/45" onClick={onClose} />
      <aside className="relative bg-white w-full md:w-[560px] h-full flex flex-col shadow-2xl">
        {/* Tiêu đề: xanh LoLo, chừa vùng tai thỏ ở điện thoại */}
        <header className="flex items-start gap-3 px-4 pb-3 md:pt-4" style={{ paddingTop: 'max(env(safe-area-inset-top), 14px)', background: 'linear-gradient(135deg,#0a4fd8,#1f6bff)', color: '#ffffff' }}>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wide opacity-80">Chi tiết tổng chi phí</div>
            <h2 className="text-[16px] font-extrabold leading-snug break-words">{project.name}</h2>
            <div className="text-[11px] opacity-80 font-mono">{project.code}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="shrink-0 w-9 h-9 rounded-xl grid place-items-center cursor-pointer" style={{ background: 'rgba(255,255,255,.18)', color: '#ffffff' }} data-testid="cost-detail-close"><X className="w-5 h-5" /></button>
        </header>

        <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}>
          {/* Tổng + đã chi / còn phải chi */}
          <section className="px-4 py-4 border-b border-slate-100">
            <div className="text-[11px] text-slate-500 font-semibold">Tổng chi phí</div>
            <div className="text-[26px] font-extrabold text-slate-900 font-mono leading-tight" data-testid="cost-detail-total">{fmtFull(cost.total)}</div>
            <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden"><i className="block h-full rounded-full bg-rose-500" style={{ width: `${pct(cost.paid, cost.total)}%` }} /></div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
              <div><span className="block text-slate-500">Đã chi</span><b className="text-rose-600 font-mono">{fmtFull(cost.paid)}</b></div>
              <div><span className="block text-slate-500">Còn phải chi</span><b className="text-slate-800 font-mono">{fmtFull(cost.remaining)}</b></div>
              <div><span className="block text-slate-500">Trong đó tiền mặt</span><b className="text-slate-700 font-mono">{fmtFull(cost.cash)}</b></div>
            </div>
          </section>

          {/* Tỷ trọng các nhóm */}
          {cost.total > 0 && (
            <section className="px-4 py-4 border-b border-slate-100">
              <div className="flex h-3 rounded-full overflow-hidden bg-slate-100" aria-hidden>
                {groups.map(g => <i key={g.key} style={{ width: `${(g.sum / cost.total) * 100}%`, background: g.color }} title={`${g.label}: ${fmtFull(g.sum)}`} />)}
              </div>
              <ul className="mt-3 space-y-1.5">
                {groups.map(g => (
                  <li key={g.key} className="flex items-center gap-2 text-[12px]" data-testid={`cost-legend-${g.key}`}>
                    <i className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: g.color }} />
                    <span className="flex-1 min-w-0 truncate text-slate-700">{g.label}</span>
                    <b className="font-mono text-slate-800">{fmtFull(g.sum)}</b>
                    <span className="w-9 text-right text-slate-400">{pct(g.sum, cost.total)}%</span>
                  </li>))}
              </ul>
            </section>)}

          {/* Từng khoản theo nhóm */}
          <section className="px-3 py-3 space-y-2">
            {groups.length === 0 && <p className="text-center text-[13px] text-slate-500 py-10">Công trình này chưa có khoản chi nào.</p>}
            {groups.map(g => (
              <details key={g.key} open={g.key === biggest?.key} className="group border border-slate-200 rounded-2xl overflow-hidden bg-white" data-testid={`cost-group-${g.key}`}>
                <summary className="list-none cursor-pointer flex items-center gap-2.5 px-3.5 py-3 [&::-webkit-details-marker]:hidden hover:bg-slate-50">
                  <i className="w-3 h-3 rounded-sm shrink-0" style={{ background: g.color }} />
                  <div className="min-w-0 flex-1"><b className="block text-[13px] text-slate-800">{g.label} <span className="text-slate-400 font-medium">· {g.list.length} khoản</span></b><span className="block text-[10.5px] text-slate-400 truncate">{g.hint}</span></div>
                  <b className="font-mono text-[13px] text-slate-900 whitespace-nowrap">{fmtFull(g.sum)}</b>
                  <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180 shrink-0" />
                </summary>
                <ul className="border-t border-slate-100 divide-y divide-slate-100">
                  {g.list.map(it => (
                    <li key={it.id} className="px-3.5 py-2.5 flex items-start gap-3" data-testid="cost-item">
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] font-semibold text-slate-800 break-words">{it.title}</div>
                        {it.sub && <div className="text-[11px] text-slate-500 break-words">{it.sub}</div>}
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-slate-400">
                          {it.date && <span>{dmy(it.date)}</span>}
                          {it.tag && <span className="px-1.5 py-px rounded bg-slate-100 text-slate-600 font-semibold">{it.tag}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <b className="block font-mono text-[12.5px] text-slate-900">{fmtFull(it.amount)}</b>
                        {g.key !== 'pending' && it.amount > 0 && it.paid < it.amount && <span className="block text-[10.5px] text-slate-400">Đã chi {fmtFull(it.paid)}</span>}
                      </div>
                    </li>))}
                </ul>
              </details>))}
          </section>
        </div>
      </aside>
    </div>
  );
}
