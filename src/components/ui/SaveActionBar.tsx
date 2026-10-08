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

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

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
  /** Số thay đổi chưa lưu (nếu biết) — hiện "Có N thay đổi CHƯA LƯU" thay vì chỉ "Có thay đổi CHƯA LƯU" */
  changeCount?: number;
}

// THANH LƯU GHIM CỐ ĐỊNH Ở ĐÁY MÀN HÌNH: các bảng phân quyền rất dài, trước đây thanh nằm cuối bảng (sticky không hoạt động vì nằm trong vùng
// cuộn) nên người dùng phải cuộn xuống tận cùng mới thấy nút Lưu → tích xong bỏ đi mà chưa lưu. Nay thanh được vẽ ra NGOÀI cây giao diện (portal vào
// <body>) với vị trí fixed → luôn thấy dù cuộn ở đâu, không bị cắt bởi vùng cuộn hay hiệu ứng của thẻ cha. Một khoảng đệm cùng chiều cao được để lại ở
// vị trí cũ để hàng cuối của bảng không bị thanh che mất.
export default function SaveActionBar({
  changed,
  onSave,
  onCancel,
  onSetDefault,
  onRestoreDefault,
  hasDefault,
  accent = 'amber',
  changeCount,
}: SaveActionBarProps) {
  const accentSave =
    accent === 'emerald'
      ? 'bg-emerald-600 hover:bg-emerald-500'
      : accent === 'sky'
      ? 'bg-sky-600 hover:bg-sky-500'
      : 'bg-amber-600 hover:bg-amber-500';

  // Có thay đổi chưa lưu mà đóng/tải lại trang → trình duyệt hỏi lại, tránh mất thay đổi (và tránh tưởng đã áp dụng)
  useEffect(() => {
    if (!changed) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [changed]);

  const label = changeCount && changeCount > 0 ? `Có ${changeCount} thay đổi CHƯA LƯU` : 'Có thay đổi CHƯA LƯU';
  // Màu viết thẳng (không phụ thuộc lớp tối/sáng của trang) vì thanh được vẽ ngoài cây giao diện chính
  const btn = 'px-3 py-1.5 text-[11px] font-bold rounded-lg cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed border';

  const bar = (
    <div
      className={`fixed bottom-3 left-1/2 -translate-x-1/2 z-[200] w-max max-w-[calc(100vw-1.5rem)] flex flex-wrap items-center justify-center gap-2 rounded-2xl border-2 p-2.5 shadow-2xl bg-white ${
        changed ? 'border-amber-400' : 'border-slate-300'
      }`}
      data-testid="save-action-bar"
    >
      {changed && (
        <div role="status" aria-live="polite" className="flex flex-col items-start px-1">
          <span className="text-xs font-extrabold text-rose-600 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" /> ⚠️ {label}
          </span>
          <span className="text-[10px] text-amber-800">Chỉ có hiệu lực sau khi bấm Lưu. Các ô đã đổi được tô nổi trong bảng.</span>
        </div>
      )}

      {/* Huỷ */}
      <button type="button" onClick={onCancel} disabled={!changed} className={`${btn} bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300`}>
        Hủy bỏ
      </button>

      {/* Đặt làm mặc định */}
      <button type="button" onClick={onSetDefault} className={`${btn} bg-slate-100 hover:bg-slate-200 text-sky-700 border-slate-300`}>
        Đặt làm mặc định
      </button>

      {/* Khôi phục mặc định */}
      <button type="button" onClick={onRestoreDefault} disabled={!hasDefault} className={`${btn} bg-slate-100 hover:bg-slate-200 text-amber-700 border-slate-300`}>
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

  return (
    <>
      {/* Khoảng đệm: giữ chỗ để hàng cuối của bảng không bị thanh cố định che */}
      <div aria-hidden className={changed ? 'h-28' : 'h-20'} />
      {typeof document !== 'undefined' ? createPortal(bar, document.body) : bar}
    </>
  );
}
