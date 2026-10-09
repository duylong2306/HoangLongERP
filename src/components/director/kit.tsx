// ─── Bộ thành phần giao diện dùng chung cho Bảng điều hành Giám đốc ────────────────────────────────────────────────
// Theo docs/design-system-dieu-phoi-vat-tu.md: thẻ trắng viền slate-200 bo 2xl, huy hiệu pastel, màu nhấn amber, chữ rõ ràng, không hiệu ứng rườm rà.
// Gồm: định dạng tiền, Card / Stat / Badge / Bar / Empty, biểu đồ cột đôi, bộ lọc (ô tìm kiếm, chọn, khoảng ngày) và thanh phân trang.
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search } from 'lucide-react';
import { DATE_PRESET_LABELS, PAGE_SIZES, pageInfo, paginate, rangeOf, type DatePreset } from '../../lib/directorViews';

// ─── Định dạng ───────────────────────────────────────────────────────────────────────────────────
export const fmtFull = (n: number) => `${Math.round(n || 0).toLocaleString('vi-VN')} đ`;
/** Số tiền rút gọn cho thẻ chỉ số: 1,25 tỷ / 480 tr / 12.000 đ */
export const fmtShort = (n: number) => {
  const v = Math.round(n || 0), a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tỷ`;
  if (a >= 1e6) return `${(v / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`;
  return `${v.toLocaleString('vi-VN')} đ`;
};
export const dm = (ymd: string) => (ymd ? `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}` : '—');
export const dmy = (ymd: string) => (ymd ? `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}` : '—');

// ─── Khối cơ bản ─────────────────────────────────────────────────────────────────────────────────
export const Card: React.FC<{ title: string; icon?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; id?: string }> = ({ title, icon, right, children, id }) => (
  <section id={id} className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
      <h3 className="flex items-center gap-2 text-[12px] font-black uppercase tracking-wide text-slate-700">{icon}{title}</h3>
      {right}
    </div>
    {children}
  </section>
);

export type Tone = 'emerald' | 'rose' | 'amber' | 'sky' | 'indigo' | 'slate' | 'teal';
const toneBadge: Record<Tone, string> = {
  emerald: 'text-emerald-600 bg-emerald-50 border-emerald-200', rose: 'text-rose-600 bg-rose-50 border-rose-200', amber: 'text-amber-600 bg-amber-50 border-amber-200',
  sky: 'text-sky-600 bg-sky-50 border-sky-200', indigo: 'text-indigo-600 bg-indigo-50 border-indigo-200', slate: 'text-slate-600 bg-slate-50 border-slate-200', teal: 'text-teal-600 bg-teal-50 border-teal-200',
};
const toneText: Record<Tone, string> = { emerald: 'text-emerald-600', rose: 'text-rose-600', amber: 'text-amber-600', sky: 'text-sky-600', indigo: 'text-indigo-600', slate: 'text-slate-800', teal: 'text-teal-600' };
const toneBar: Record<Tone, string> = { emerald: 'bg-emerald-500', rose: 'bg-rose-500', amber: 'bg-amber-500', sky: 'bg-sky-500', indigo: 'bg-indigo-500', slate: 'bg-slate-400', teal: 'bg-teal-500' };

export const Badge: React.FC<{ tone: Tone; children: React.ReactNode }> = ({ tone, children }) => (
  <span className={`inline-flex items-center border rounded-full font-bold text-[10px] px-2 py-0.5 whitespace-nowrap ${toneBadge[tone]}`}>{children}</span>
);

/** Ô số liệu lớn: nhãn nhỏ phía trên, số to, dòng phụ phía dưới. Có onClick thì bấm được. */
export const Stat: React.FC<{ label: string; value: string; sub?: string; tone?: Tone; onClick?: () => void; active?: boolean }> = ({ label, value, sub, tone = 'slate', onClick, active }) => {
  const Tag: any = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} aria-pressed={onClick ? !!active : undefined}
      className={`text-left border rounded-xl px-3 py-2.5 ${active ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'} ${onClick ? 'hover:bg-amber-50/40 cursor-pointer transition-colors' : ''}`}>
      <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <span className={`block text-xl font-black leading-tight ${toneText[tone]}`}>{value}</span>
      {sub && <span className="block text-[10.5px] text-slate-500 mt-0.5">{sub}</span>}
    </Tag>
  );
};

export const Bar: React.FC<{ pct: number; tone?: Tone; h?: string }> = ({ pct, tone = 'emerald', h = 'h-1.5' }) => (
  <div className={`w-full ${h} bg-slate-100 rounded-full overflow-hidden`}><div className={`${h} ${toneBar[tone]} rounded-full`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>
);

export const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[11px] text-slate-400 italic text-center py-4 border border-dashed border-slate-200 rounded-xl">{children}</p>
);

/** Biểu đồ cột đôi (2 chuỗi) bằng SVG */
export const PairBars: React.FC<{ data: { label: string; a: number; b: number }[]; colorA: string; colorB: string; titleA: string; titleB: string; money?: boolean }> = ({ data, colorA, colorB, titleA, titleB, money }) => {
  const max = Math.max(1, ...data.flatMap(d => [d.a, d.b]));
  const W = 560, H = 140, padB = 18, bw = Math.floor((W / Math.max(1, data.length)) * 0.32);
  return (
    <div className="overflow-x-auto">
      <p className="text-[10px] text-slate-400 mb-0.5">Cột cao nhất: {money ? fmtShort(max) : max}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[420px] max-h-44" role="img" aria-label={`${titleA} và ${titleB} theo ngày`}>
        {data.map((d, i) => {
          const x = (i + 0.5) * (W / data.length);
          const ha = Math.round(((H - padB - 6) * d.a) / max), hb = Math.round(((H - padB - 6) * d.b) / max);
          return (
            <g key={`${d.label}-${i}`}>
              <title>{`${d.label}: ${titleA} ${money ? fmtFull(d.a) : d.a} · ${titleB} ${money ? fmtFull(d.b) : d.b}`}</title>
              <rect x={x - bw - 1} y={H - padB - ha} width={bw} height={ha} rx={2} className={colorA} />
              <rect x={x + 1} y={H - padB - hb} width={bw} height={hb} rx={2} className={colorB} />
              {/* Nhiều cột (30 ngày) thì chỉ ghi nhãn cách quãng để không chồng chữ */}
              {(i % Math.max(1, Math.ceil(data.length / 12)) === 0 || i === data.length - 1) && <text x={x} y={H - 4} textAnchor="middle" className="fill-slate-400" fontSize="9">{d.label}</text>}
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

// ─── Bộ lọc ──────────────────────────────────────────────────────────────────────────────────────
export const FilterBar: React.FC<{ children: React.ReactNode; onReset?: () => void; active?: boolean }> = ({ children, onReset, active }) => (
  <div className="flex flex-wrap items-end gap-2.5 bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3" role="search">
    {children}
    {onReset && (
      <button type="button" onClick={onReset} disabled={!active}
        className="px-3 py-2 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 cursor-pointer transition">Xóa bộ lọc</button>
    )}
  </div>
);

export const Field: React.FC<{ label: string; children: React.ReactNode; grow?: boolean }> = ({ label, children, grow }) => (
  <label className={`flex flex-col gap-1 ${grow ? 'flex-1 min-w-[180px]' : ''}`}>
    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
    {children}
  </label>
);

const inputCls = 'bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500';

export const SearchBox: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string; label?: string }> = ({ value, onChange, placeholder = 'Tìm kiếm…', label = 'Tìm kiếm' }) => (
  <Field label={label} grow>
    <span className="relative block">
      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={label}
        className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-2.5 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500" />
    </span>
  </Field>
);

export const SelectBox: React.FC<{ label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }> = ({ label, value, onChange, options }) => (
  <Field label={label}>
    <select value={value} onChange={e => onChange(e.target.value)} aria-label={label} className={`${inputCls} min-w-[130px]`}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </Field>
);

/** Chọn khoảng ngày: chọn nhanh (hôm nay / 7 ngày / 30 ngày / tháng này / tất cả) hoặc tự chọn từ–đến. */
export const DateRangeFilter: React.FC<{ preset: DatePreset; from: string; to: string; onChange: (p: DatePreset, from: string, to: string) => void; presets?: DatePreset[] }> = ({ preset, from, to, onChange, presets = ['today', '7d', '30d', 'month', 'all', 'custom'] }) => (
  <>
    <SelectBox label="Thời gian" value={preset} onChange={v => onChange(v as DatePreset, from, to)} options={presets.map(p => ({ value: p, label: DATE_PRESET_LABELS[p] }))} />
    {preset === 'custom' && (
      <>
        <Field label="Từ ngày"><input type="date" value={from} onChange={e => onChange('custom', e.target.value, to)} className={inputCls} /></Field>
        <Field label="Đến ngày"><input type="date" value={to} onChange={e => onChange('custom', from, e.target.value)} className={inputCls} /></Field>
      </>
    )}
  </>
);

// ─── Phân trang ──────────────────────────────────────────────────────────────────────────────────
/**
 * Hook phân trang: trả về dòng của trang hiện tại + thanh phân trang. `resetKey` đổi (do đổi bộ lọc) → quay về trang 1.
 * Số dòng mỗi trang chọn được (10 / 20 / 50 / 100) và được giữ khi đổi bộ lọc.
 */
export function usePager<T>(items: T[], resetKey: string, initialSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialSize);
  useEffect(() => { setPage(1); }, [resetKey, pageSize]);
  const info = useMemo(() => pageInfo(items.length, page, pageSize), [items.length, page, pageSize]);
  const rows = useMemo(() => paginate(items, page, pageSize), [items, page, pageSize]);
  const bar = <Pager info={info} onPage={setPage} onSize={setPageSize} />;
  return { rows, info, bar };
}

export const Pager: React.FC<{ info: ReturnType<typeof pageInfo>; onPage: (p: number) => void; onSize: (s: number) => void }> = ({ info, onPage, onSize }) => {
  const btn = 'p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition';
  return (
    <nav className="flex flex-wrap items-center justify-between gap-2 mt-3 text-[11px] text-slate-600" aria-label="Phân trang">
      <span data-testid="pager-range">{info.total === 0 ? 'Không có dòng nào' : <>Hiển thị <b>{info.from}–{info.to}</b> / {info.total} dòng</>}</span>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5">
          <span>Số dòng / trang</span>
          <select value={info.pageSize} onChange={e => onSize(Number(e.target.value))} aria-label="Số dòng trên trang" className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-500">
            {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button type="button" className={btn} disabled={info.page <= 1} onClick={() => onPage(1)} aria-label="Trang đầu"><ChevronsLeft className="w-3.5 h-3.5" /></button>
          <button type="button" className={btn} disabled={info.page <= 1} onClick={() => onPage(info.page - 1)} aria-label="Trang trước"><ChevronLeft className="w-3.5 h-3.5" /></button>
          <span className="px-2 font-bold" aria-live="polite">Trang {info.page}/{info.totalPages}</span>
          <button type="button" className={btn} disabled={info.page >= info.totalPages} onClick={() => onPage(info.page + 1)} aria-label="Trang sau"><ChevronRight className="w-3.5 h-3.5" /></button>
          <button type="button" className={btn} disabled={info.page >= info.totalPages} onClick={() => onPage(info.totalPages)} aria-label="Trang cuối"><ChevronsRight className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </nav>
  );
};

// ─── Bảng ────────────────────────────────────────────────────────────────────────────────────────
export const tableHead = 'bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wide border-b border-slate-200';
export const Th: React.FC<{ children?: React.ReactNode; right?: boolean; className?: string }> = ({ children, right, className = '' }) => (
  <th className={`px-3 py-2 font-bold ${right ? 'text-right' : ''} ${className}`}>{children}</th>
);
export { rangeOf };
