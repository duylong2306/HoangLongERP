import React, { useEffect, useState } from 'react';
import { progressTone, type ProjectProgress } from '../../lib/projectProgress';

// Màu thanh theo mức tiến độ (đỏ < 30%, vàng < 60%, xanh dương < 100%, xanh lá = 100%)
const BAR = { bad: 'bg-rose-500', warn: 'bg-amber-500', blue: 'bg-sky-500', ok: 'bg-emerald-500' } as const;

// KHỐI "TIẾN ĐỘ DỰ ÁN" trong ngăn thông tin dự án (giao diện tối như các khối bên cạnh).
// Tiến độ TỰ TÍNH = đầu khoảng của giai đoạn (cột kanban) + phần việc con đã xong trong khoảng đó (lib/projectProgress.ts).
// Người có quyền sửa thông tin dự án (PM/Giám đốc) có thể GHI ĐÈ bằng số tay; bấm "Về tự động" để bỏ ghi đè.
export default function ProjectProgressCard({ progress, canEdit, onSave }: {
  progress: ProjectProgress;
  canEdit: boolean;
  /** value = số ghi đè (0–100) hoặc null = về tự động. Trả về Promise để khóa nút khi đang lưu. */
  onSave: (value: number | null) => Promise<void> | void;
}) {
  const { value, auto, source, stage, done, total } = progress;
  const [draft, setDraft] = useState<string>(source === 'manual' ? String(value) : '');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  // Đổi dự án / dữ liệu đổi từ nơi khác → làm mới ô nhập
  useEffect(() => { setDraft(source === 'manual' ? String(value) : ''); setEditing(false); }, [source, value]);

  const run = async (v: number | null) => { setBusy(true); try { await onSave(v); setEditing(false); } finally { setBusy(false); } };
  const n = Number(draft);
  const valid = draft.trim() !== '' && Number.isFinite(n) && n >= 0 && n <= 100;

  // Giao diện LoLo: thẻ trắng bo tròn, thanh tiến độ lớn, số % nổi bật, các dòng giải thích dạng lưới 2 cột (xuống 1 cột trên điện thoại).
  const stat = (label: string, val: React.ReactNode) => (
    <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 min-w-0">
      <div className="text-[11px] text-slate-500 font-semibold">{label}</div>
      <div className="text-[13px] text-slate-900 font-extrabold mt-0.5 break-words">{val}</div>
    </div>
  );
  const tone = progressTone(value);
  const pctColor = tone === 'ok' ? '#059669' : tone === 'bad' ? '#e11d48' : tone === 'warn' ? '#d97706' : '#0d47c9';
  return (
    <div className="bg-white border border-slate-200 p-4 md:p-5 rounded-2xl shadow-sm space-y-3.5" data-testid="project-progress-card">
      <div className="flex items-center justify-between gap-3">
        <span className="font-extrabold text-[13px] text-slate-800 uppercase tracking-wide">Tiến độ dự án</span>
        <span className="text-[26px] leading-none font-black" style={{ color: pctColor }} data-testid="progress-value">{value}%</span>
      </div>
      <div className="h-3 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full rounded-full ${BAR[tone]}`} data-testid="progress-bar" data-tone={tone} style={{ width: `${value}%` }} /></div>
      <div className="space-y-3" data-testid="progress-explain">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {stat('Giai đoạn hiện tại', <>{stage.name} <span className="text-slate-500 font-semibold">(bước {stage.index + 1}/{stage.total})</span></>)}
        {stat('Khoảng tiến độ của giai đoạn', <>{stage.from}% → {stage.to}%</>)}
        {stat('Việc con đã xong', <>{done}/{total}</>)}
      </div>
      {source === 'completed' && <div className="text-emerald-600 text-[12px] font-bold">Dự án đã hoàn thành (100%).</div>}
      {source === 'manual' && <div className="text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-[12px] font-bold" data-testid="progress-manual-note">PM đang nhập tay {value}%. Số tự tính theo cột và việc con: {auto}%.</div>}
      {source === 'auto' && <div className="text-slate-500 text-[12px]">Tự tính từ giai đoạn (cột kanban) và số việc con đã xong.</div>}
      </div>
      {canEdit && source !== 'completed' && (editing || source === 'manual' ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <input type="number" min={0} max={100} inputMode="numeric" value={draft} onChange={e => setDraft(e.target.value)} aria-label="Tiến độ ghi đè (%)" data-testid="progress-input"
            className="w-24 bg-white border border-slate-300 text-slate-900 rounded-xl px-3 py-2 text-[13px] font-mono outline-none focus:border-[#0d47c9]" placeholder="0–100" />
          <button type="button" disabled={!valid || busy} onClick={() => run(Math.round(n))} data-testid="progress-save"
            className="disabled:opacity-50 text-[12px] font-bold px-4 py-2 rounded-xl cursor-pointer" style={{ background: '#0d47c9', color: '#ffffff' }}>Lưu ghi đè</button>
          {source === 'manual' && <button type="button" disabled={busy} onClick={() => run(null)} data-testid="progress-auto"
            className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-[12px] font-bold px-4 py-2 rounded-xl cursor-pointer">Về tự động</button>}
          {source !== 'manual' && <button type="button" onClick={() => setEditing(false)} className="text-slate-500 text-[12px] font-bold px-2 py-2 cursor-pointer">Hủy</button>}
        </div>
      ) : (
        <button type="button" onClick={() => setEditing(true)} data-testid="progress-edit"
          className="text-[12px] font-bold text-[#0d47c9] hover:underline cursor-pointer">Ghi đè tiến độ…</button>
      ))}
    </div>
  );
}
