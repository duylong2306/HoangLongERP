// ─── SaveActionBar ───────────────────────────────────────────────────────
// Component dùng chung cho cơ chế Chỉnh Sửa / Lưu / Đặt mặc định / Khôi phục
// Sử dụng với draft state pattern: người dùng sửa trên bản nháp (draft),
// chỉ ghi config thật khi bấm "Lưu thay đổi".
//
// Cách dùng:
//   const [draft, setDraft] = useState(loadConfig());
//   const [saved] = useState(loadConfig()); // config gốc
//   const changed = JSON.stringify(draft) !== JSON.stringify(saved);
//
//   <SaveActionBar
//     changed={changed}
//     onSave={() => { saveConfig(draft); }}
//     onCancel={() => setDraft(saved)}
//     onSetDefault={() => saveDefaultSnapshot('my_key', draft)}
//     onRestoreDefault={() => setDraft(loadDefaultSnapshot('my_key') || loadConfig())}
//     hasDefault={!!loadDefaultSnapshot('my_key')}
//     accent="amber"
//   />
//
// Accent: 'amber' (mặc định, cho group), 'emerald' (project), 'sky' (approval)

import React from 'react';

interface SaveActionBarProps {
  /** Có thay đổi chưa lưu không */
  changed: boolean;
  /** Hàm lưu xuống persistent storage */
  onSave: () => void;
  /** Hàm huỷ, reset draft về config gốc */
  onCancel: () => void;
  /** Lưu draft hiện tại thành mặc định */
  onSetDefault: () => void;
  /** Khôi phục draft từ mặc định đã lưu */
  onRestoreDefault: () => void;
  /** Đã có mặc định để khôi phục chưa (disable nút nếu chưa) */
  hasDefault?: boolean;
  /** Màu nhấn: 'amber' | 'emerald' | 'sky' */
  accent?: 'amber' | 'emerald' | 'sky';
}

export default function SaveActionBar({
  changed,
  onSave,
  onCancel,
  onSetDefault,
  onRestoreDefault,
  hasDefault,
  accent = 'amber',
}: SaveActionBarProps) {
  const accentSave =
    accent === 'emerald'
      ? 'bg-emerald-600 hover:bg-emerald-500'
      : accent === 'sky'
      ? 'bg-sky-600 hover:bg-sky-500'
      : 'bg-amber-600 hover:bg-amber-500';

  return (
    <div className="flex flex-wrap items-center gap-2 justify-end bg-slate-950 border border-slate-800 rounded-xl p-3 sticky bottom-0 z-10">
      {changed && (
        <span className="text-[10px] text-rose-400 font-bold flex items-center gap-1 mr-2">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" /> Chưa lưu
        </span>
      )}

      {/* Huỷ */}
      <button
        type="button"
        onClick={onCancel}
        disabled={!changed}
        className="px-3 py-1.5 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Hủy bỏ
      </button>

      {/* Đặt làm mặc định */}
      <button
        type="button"
        onClick={onSetDefault}
        className="px-3 py-1.5 text-[11px] bg-slate-800 hover:bg-slate-700 text-sky-400 font-bold rounded-lg cursor-pointer transition-all"
      >
        Đặt làm mặc định
      </button>

      {/* Khôi phục mặc định */}
      <button
        type="button"
        onClick={onRestoreDefault}
        disabled={!hasDefault}
        className="px-3 py-1.5 text-[11px] bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold rounded-lg cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Khôi phục mặc định
      </button>

      {/* Lưu thay đổi */}
      <button
        type="button"
        onClick={onSave}
        disabled={!changed}
        className={`px-4 py-1.5 text-[11px] text-white font-extrabold rounded-lg cursor-pointer transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed ${accentSave}`}
      >
        Lưu thay đổi
      </button>
    </div>
  );
}
