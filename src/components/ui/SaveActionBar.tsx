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

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface SaveActionBarProps {
  /** Có thay đổi chưa lưu không */
  changed: boolean;
  /** Hàm lưu xuống persistent storage */
  onSave: () => void;
  /** Hàm huỷ, reset draft về config gốc */
  onCancel: () => void;
  /** Lưu draft hiện tại thành mặc định (không truyền → ẩn nút "Đặt làm mặc định") */
  onSetDefault?: () => void;
  /** Khôi phục draft từ mặc định đã lưu */
  onRestoreDefault: () => void;
  /** Đã có mặc định để khôi phục chưa (disable nút nếu chưa) */
  hasDefault?: boolean;
  /** Màu nhấn: 'amber' | 'emerald' | 'sky' */
  accent?: 'amber' | 'emerald' | 'sky';
  /** Số thay đổi chưa lưu (nếu biết) — hiện "Có N thay đổi CHƯA LƯU" thay vì chỉ "Có thay đổi CHƯA LƯU" */
  changeCount?: number;
}

// THANH LƯU GHIM CỐ ĐỊNH Ở ĐÁY (kiểu thanh trạng thái / panel dưới của VS Code): các bảng phân quyền rất dài, trước đây thanh nằm cuối bảng (sticky
// không hoạt động vì nằm trong vùng cuộn) nên người dùng phải cuộn xuống tận cùng mới thấy nút Lưu → tích xong bỏ đi mà chưa lưu. Nay thanh được vẽ
// ra NGOÀI cây giao diện (portal vào <body>) với vị trí fixed, trải suốt bề rộng VÙNG NỘI DUNG (không đè lên menu bên trái): trạng thái ở bên trái,
// các nút ở bên phải. Một khoảng đệm cùng chiều cao được để lại ở vị trí cũ để hàng cuối của bảng không bị thanh che mất.
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
  const btn = 'px-3 py-1.5 text-[11px] font-bold rounded-md cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed border';

  // Căn thanh theo vùng nội dung (<main>) để không che menu bên trái; không có <main> (VD đang ở trong hộp thoại) thì trải hết bề rộng màn hình.
  const spacerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const host = spacerRef.current?.closest('main') as HTMLElement | null;
    if (!host) { setBox(null); return; }
    const update = () => { const r = host.getBoundingClientRect(); setBox({ left: r.left, width: r.width }); };
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(host);
    window.addEventListener('resize', update);
    return () => { ro?.disconnect(); window.removeEventListener('resize', update); };
  }, []);

  const bar = (
    <div
      className={`fixed bottom-0 z-[200] flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 border-t-2 shadow-[0_-4px_14px_rgba(0,0,0,0.10)] ${
        changed ? 'border-amber-400 bg-amber-50' : 'border-slate-300 bg-slate-50'
      } ${box ? '' : 'left-0 right-0'}`}
      style={box ? { left: box.left, width: box.width } : undefined}
      data-testid="save-action-bar"
    >
      {/* Trái: trạng thái */}
      {changed ? (
        <div role="status" aria-live="polite" className="flex flex-col min-w-0">
          <span className="text-xs font-extrabold text-rose-600 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" /> ⚠️ {label}
          </span>
          <span className="text-[10px] text-amber-800">Chỉ có hiệu lực sau khi bấm Lưu. Các ô đã đổi được tô nổi trong bảng.</span>
        </div>
      ) : (
        <span className="text-[11px] text-slate-500 font-semibold">✓ Chưa có thay đổi nào cần lưu</span>
      )}

      {/* Phải: nút phụ (mặc định) | Hủy bỏ | Lưu (nút chính ở ngoài cùng bên phải) */}
      <div className="flex flex-wrap items-center gap-2 ml-auto">
        {onSetDefault && (
          <button type="button" onClick={onSetDefault} className={`${btn} bg-white hover:bg-slate-100 text-sky-700 border-slate-300`}>
            Đặt làm mặc định
          </button>
        )}
        <button type="button" onClick={onRestoreDefault} disabled={!hasDefault} className={`${btn} bg-white hover:bg-slate-100 text-amber-700 border-slate-300`}>
          Khôi phục mặc định
        </button>
        <span className="hidden sm:block w-px h-6 bg-slate-300 mx-1" aria-hidden />
        <button type="button" onClick={onCancel} disabled={!changed} className={`${btn} bg-white hover:bg-slate-100 text-slate-700 border-slate-300`}>
          Hủy bỏ
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!changed}
          className={`px-5 py-1.5 text-[11px] text-white font-extrabold rounded-md cursor-pointer transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${accentSave}`}
        >
          Lưu thay đổi
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Khoảng đệm: giữ chỗ để hàng cuối của bảng không bị thanh cố định che */}
      <div ref={spacerRef} aria-hidden className="h-20" />
      {typeof document !== 'undefined' ? createPortal(bar, document.body) : bar}
    </>
  );
}
