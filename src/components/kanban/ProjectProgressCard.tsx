import React, { useEffect, useState } from 'react';
import type { ProjectProgress } from '../../lib/projectProgress';

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

  return (
    <div className="bg-slate-950 border border-slate-850 p-5 rounded-2xl space-y-3" data-testid="project-progress-card">
      <span className="font-extrabold text-[11px] text-emerald-400 flex items-center justify-between uppercase tracking-wide border-b border-slate-900 pb-2">
        <span>TIẾN ĐỘ DỰ ÁN</span>
        <span className="text-slate-100 text-[15px] font-black" data-testid="progress-value">{value}%</span>
      </span>
      <div className="h-2 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${value}%` }} /></div>
      <div className="text-[11px] text-slate-400 space-y-1" data-testid="progress-explain">
        <div className="flex justify-between gap-3"><span>Giai đoạn hiện tại</span><b className="text-slate-200 text-right">{stage.name} (bước {stage.index + 1}/{stage.total})</b></div>
        <div className="flex justify-between gap-3"><span>Khoảng tiến độ của giai đoạn</span><b className="text-slate-200">{stage.from}% → {stage.to}%</b></div>
        <div className="flex justify-between gap-3"><span>Việc con đã xong</span><b className="text-slate-200">{done}/{total}</b></div>
        {source === 'completed' && <div className="text-emerald-400 font-bold">Dự án đã hoàn thành (100%).</div>}
        {source === 'manual' && <div className="text-amber-400 font-bold" data-testid="progress-manual-note">PM đang nhập tay {value}%. Số tự tính theo cột và việc con: {auto}%.</div>}
        {source === 'auto' && <div className="text-slate-500">Tự tính từ giai đoạn (cột kanban) và số việc con đã xong.</div>}
      </div>
      {canEdit && source !== 'completed' && (editing || source === 'manual' ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <input type="number" min={0} max={100} inputMode="numeric" value={draft} onChange={e => setDraft(e.target.value)} aria-label="Tiến độ ghi đè (%)" data-testid="progress-input"
            className="w-20 bg-slate-900 border border-slate-800 text-slate-200 rounded px-2 py-1.5 text-[11px] font-mono outline-none focus:border-emerald-500" placeholder="0–100" />
          <button type="button" disabled={!valid || busy} onClick={() => run(Math.round(n))} data-testid="progress-save"
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-[10.5px] font-black px-3 py-1.5 rounded-lg cursor-pointer" style={{ color: '#ffffff' }}>Lưu ghi đè</button>
          {source === 'manual' && <button type="button" disabled={busy} onClick={() => run(null)} data-testid="progress-auto"
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10.5px] font-bold px-3 py-1.5 rounded-lg cursor-pointer">Về tự động</button>}
          {source !== 'manual' && <button type="button" onClick={() => setEditing(false)} className="text-slate-400 text-[10.5px] font-bold px-2 py-1.5 cursor-pointer">Hủy</button>}
        </div>
      ) : (
        <button type="button" onClick={() => setEditing(true)} data-testid="progress-edit"
          className="text-[10.5px] font-bold text-sky-400 hover:text-sky-300 cursor-pointer">Ghi đè tiến độ…</button>
      ))}
    </div>
  );
}
