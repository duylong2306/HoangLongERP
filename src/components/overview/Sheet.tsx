import React from 'react';
import { X } from 'lucide-react';

// KHUNG HỘP THOẠI KIỂU LoLo (thay các hộp thoại tối cũ của màn Tổng quan): trên điện thoại TRƯỢT TỪ DƯỚI LÊN, bo góc trên, tối đa 92% chiều cao;
// trên máy tính là thẻ giữa màn hình. Tiêu đề xanh LoLo dùng lớp lx-drawer-head của khung ứng dụng (tự chừa tai thỏ, và để quy tắc chung của
// hộp thoại toàn màn hình không đệm thêm lần nữa). Chân trang dính đáy, chừa vạch home. Chữ trắng trên nền xanh do lớp lx-dh-* ép màu.
// Nền mờ đặt bằng style trực tiếp vì index.css ép các lớp bg-slate-9xx thành màu sáng.
// Có onSubmit thì khung là <form> (nút "submit" ở chân trang gửi được).

export const inputCls = 'w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-[16px] sm:text-[14px] text-slate-900 outline-none focus:border-[#0d47c9] focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed';
// (chữ 16px trên điện thoại để iPhone không tự phóng to khi chạm vào ô nhập)

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-[11.5px] font-extrabold text-slate-600 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-slate-500 mt-1">{hint}</span>}
    </label>
  );
}

const NOTICE: Record<string, string> = {
  warn: 'bg-amber-50 border-amber-200 text-amber-800', bad: 'bg-rose-50 border-rose-200 text-rose-700', ok: 'bg-emerald-50 border-emerald-200 text-emerald-800', info: 'bg-blue-50 border-blue-200 text-[#0d47c9]',
};
export const Notice = ({ tone = 'info', children }: { tone?: 'warn' | 'bad' | 'ok' | 'info'; children: React.ReactNode }) => (
  <div className={`border rounded-xl px-3 py-2 text-[12px] font-semibold leading-snug ${NOTICE[tone]}`}>{children}</div>
);

interface SheetProps {
  title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode;
  onSubmit?: (e: React.FormEvent) => void; id?: string; testid?: string;
}
export default function Sheet({ title, subtitle, onClose, children, footer, onSubmit, id, testid }: SheetProps) {
  const Panel: any = onSubmit ? 'form' : 'div';
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" style={{ background: 'rgba(8,28,54,.55)' }} id={id} data-testid={testid} role="dialog" aria-modal="true" aria-label={title}>
      <Panel onSubmit={onSubmit} className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col max-h-[92dvh] shadow-2xl animate-fadeIn">
        <header className="lx-drawer-head shrink-0 flex items-center gap-3 px-4 pb-3 pt-3.5">
          <div className="min-w-0 flex-1">
            <div className="lx-dh-title text-[16px] font-extrabold leading-tight truncate">{title}</div>
            {subtitle && <div className="lx-dh-sub text-[12px] mt-0.5 truncate">{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="lx-dh-close" data-testid="sheet-close"><X size={18} /></button>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3 text-left">{children}</div>
        {footer && <footer className="shrink-0 border-t border-slate-100 bg-white px-4 pt-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>{footer}</footer>}
      </Panel>
    </div>
  );
}

/** Hai nút chân trang chuẩn: Hủy (viền) + nút chính (xanh LoLo) */
export function SheetActions({ onCancel, submitLabel, disabled, cancelLabel = 'Hủy', submitType = 'submit', onSubmit }: { onCancel: () => void; submitLabel: string; disabled?: boolean; cancelLabel?: string; submitType?: 'submit' | 'button'; onSubmit?: () => void }) {
  return (
    <div className="grid grid-cols-[1fr_2fr] gap-2">
      <button type="button" onClick={onCancel} className="py-3 rounded-xl border border-slate-300 bg-white text-slate-700 text-[14px] font-extrabold cursor-pointer" data-testid="sheet-cancel">{cancelLabel}</button>
      <button type={submitType} onClick={onSubmit} disabled={disabled} data-testid="sheet-submit"
        className="py-3 rounded-xl text-[14px] font-extrabold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: 'linear-gradient(135deg,#1f6bff,#0a4fd8)', color: '#ffffff' }}>{submitLabel}</button>
    </div>
  );
}

/** Nhóm nút chọn (thay ô chọn ngắn): giá trị hiện tại tô xanh */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex bg-slate-100 rounded-xl p-1 gap-1" role="group">
      {options.map(o => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)} data-value={o.value}
          className={`flex-1 py-2 rounded-lg text-[12.5px] font-extrabold cursor-pointer ${value === o.value ? 'bg-white text-[#0d47c9] shadow-sm' : 'text-slate-500'}`}>{o.label}</button>))}
    </div>
  );
}
