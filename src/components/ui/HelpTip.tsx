// ─── HelpTip — dấu "?" giải thích ngắn cho một dòng phân quyền ───────────────────────────────────────
// Rê chuột (máy tính) hoặc chạm (điện thoại) vào dấu ? để hiện lời giải thích; bấm ra ngoài / nhấn Esc / chạm lại để đóng.
// Khung giải thích được vẽ ra NGOÀI cây giao diện (portal vào <body>, vị trí fixed) vì bảng phân quyền nằm trong vùng cuộn ngang
// (overflow) — nếu vẽ tại chỗ sẽ bị cắt mất. Vị trí được tính theo dấu ? và kẹp trong màn hình.
import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface HelpTipProps {
  /** Nội dung giải thích (tiếng Việt, 1–3 câu) */
  text: string;
  /** Tên dòng — đọc cho trình đọc màn hình ("Giải thích: …") */
  label?: string;
}

const WIDTH = 280; // bề rộng tối đa của khung giải thích (px)

export default function HelpTip({ text, label }: HelpTipProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const id = useId();

  // Tính vị trí khi mở: ngay dưới dấu ?, kẹp trong chiều ngang màn hình; nếu sát đáy thì hiện phía trên
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const w = Math.min(WIDTH, window.innerWidth - 16);
    const left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 8));
    const duoi = r.bottom + 6;
    const top = duoi + 120 > window.innerHeight ? Math.max(8, r.top - 6 - 110) : duoi;
    setPos({ left, top });
  }, [open]);

  // Đóng khi chạm ra ngoài / nhấn Esc / cuộn (vị trí đã tính sẽ lệch)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => { if (!btnRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={`Giải thích${label ? `: ${label}` : ''}`}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        data-testid="help-tip"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        // Chạm trên điện thoại: bật/tắt (rê chuột không có trên cảm ứng)
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full border border-slate-500 text-[9px] font-black leading-none text-slate-400 hover:text-sky-400 hover:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400 cursor-help align-middle shrink-0"
      >
        ?
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          id={id}
          role="tooltip"
          data-testid="help-tip-popup"
          style={{ position: 'fixed', left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: Math.min(WIDTH, (typeof window !== 'undefined' ? window.innerWidth : WIDTH) - 16) }}
          className="z-[500] pointer-events-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-[11px] font-medium leading-snug text-slate-700 shadow-xl normal-case tracking-normal text-left"
        >
          {text}
        </div>,
        document.body
      )}
    </>
  );
}
