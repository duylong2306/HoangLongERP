import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

// HỘP XÁC NHẬN NẰM TRONG TRANG (thay window.confirm) cho các thao tác nguy hiểm ở trang quản trị.
// Lý do: trình duyệt nhúng / ứng dụng bọc web thường chặn hộp thoại gốc — có nơi tự trả "đồng ý" mà không hiện gì, khiến thao tác
// nguy hiểm (khóa doanh nghiệp...) chạy luôn không cảnh báo. Hộp này luôn hiện, mặc định focus vào nút "Hủy bỏ" (an toàn).
// ⚠️ Chữ trắng dùng `text-[#ffffff]` (không dùng `text-white`): src/index.css ghi đè mọi `.text-white` thành xám đậm.
export default function ConfirmDialog({ title, children, confirmLabel, danger = false, busy = false, error, onConfirm, onClose }: {
  title: string; children: React.ReactNode; confirmLabel: string; danger?: boolean; busy?: boolean; error?: string | null;
  onConfirm: () => void; onClose: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { cancelRef.current?.focus(); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, busy]);

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="confirm_title" id="confirm_dialog">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-3">
        <h3 id="confirm_title" className="font-black text-slate-900 inline-flex items-center gap-2">
          <AlertTriangle className={`w-5 h-5 shrink-0 ${danger ? 'text-rose-600' : 'text-amber-500'}`} aria-hidden /> {title}
        </h3>
        <div className="text-sm text-slate-600 space-y-2">{children}</div>
        {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2 text-sm" role="alert">{error}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <button ref={cancelRef} type="button" onClick={onClose} disabled={busy} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-semibold">Hủy bỏ</button>
          <button type="button" onClick={onConfirm} disabled={busy} className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[#ffffff] text-sm font-bold disabled:opacity-60 ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
