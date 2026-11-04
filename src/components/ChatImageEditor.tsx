import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Crop, Pencil, Square, Type, Grid3x3, Undo2, X, Check } from 'lucide-react';
import { COLORS, MIN_SIZE, clampRect, cropOf, fitEdge, fontSizeFor, normRect, paintOps, screenshotName, type Op, type Pt, type Rect } from '../lib/imageMarkup';

// Trình sửa ảnh trước khi gửi trong Tin nhắn (kiểu Zalo): Cắt · Bút · Khung · Chữ · Làm mờ + chọn màu + hoàn tác.
// Bấm ✓ → trả về tệp PNG đã sửa (onDone); bấm ✕ / Esc → bỏ qua (onCancel), ảnh gốc giữ nguyên.
export type Tool = 'crop' | 'pen' | 'rect' | 'text' | 'blur';
const TOOLS: { id: Tool; label: string; icon: React.ReactNode }[] = [
  { id: 'crop', label: 'Cắt', icon: <Crop className="w-4 h-4" /> },
  { id: 'pen', label: 'Bút', icon: <Pencil className="w-4 h-4" /> },
  { id: 'rect', label: 'Khung', icon: <Square className="w-4 h-4" /> },
  { id: 'text', label: 'Chữ', icon: <Type className="w-4 h-4" /> },
  { id: 'blur', label: 'Làm mờ', icon: <Grid3x3 className="w-4 h-4" /> },
];

export default function ChatImageEditor({ file, onCancel, onDone, initialTool, variant }: { file: File; onCancel: () => void; onDone: (f: File) => void; initialTool?: Tool; variant?: 'snip' }) {
  // variant 'snip' = chế độ KHOANH VÙNG CHỤP kiểu Zalo: ảnh chụp phủ kín màn hình, mờ đi, người dùng kéo chuột khoanh vùng cần lấy rồi mới hiện công cụ vẽ.
  const snip = variant === 'snip';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);   // kích thước làm việc (px ảnh)
  const [error, setError] = useState(false);
  const [tool, setTool] = useState<Tool>(initialTool ?? 'pen');   // ảnh vừa chụp mở sẵn công cụ Cắt, như Zalo
  const [color, setColor] = useState<string>(COLORS[0]);
  const [ops, setOps] = useState<Op[]>([]);
  const [draft, setDraft] = useState<Op | null>(null);          // thao tác đang kéo dở
  const start = useRef<Pt | null>(null);
  const [textAt, setTextAt] = useState<Pt | null>(null);        // ô gõ chữ đang mở tại điểm này
  const [textVal, setTextVal] = useState('');
  const textRef = useRef<HTMLInputElement>(null);
  const textOpenedAt = useRef(0);   // lúc mở ô gõ chữ — để bỏ qua cú mất tiêu điểm ngay sau khi bấm (xem onBlur bên dưới)

  // Nạp ảnh từ tệp (blob URL cục bộ → không dính CORS, xuất lại được)
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { imgRef.current = img; setSize(fitEdge(img.naturalWidth || img.width, img.naturalHeight || img.height)); };
    img.onerror = () => setError(true);
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const crop = useMemo(() => cropOf(draft?.k === 'crop' ? [...ops, draft] : ops), [ops, draft]);

  // Vẽ lại canvas CHỈ khi nội dung ảnh đổi (nét bút/khung/chữ/làm mờ). Kéo khoanh vùng cắt KHÔNG vẽ lại canvas: lớp mờ + khung chọn là
  // phần tử HTML đặt chồng lên (bên dưới) → kéo chuột mượt kể cả ảnh chụp màn hình lớn (trước đây mỗi lần chuột nhúc nhích vẽ lại cả ảnh vài megapixel).
  const liveDraft = useMemo(() => (draft && draft.k !== 'crop' ? draft : null), [draft]);
  useEffect(() => {
    const c = canvasRef.current, img = imgRef.current;
    if (!c || !img || !size) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    paintOps(ctx, img, size.w, size.h, liveDraft ? [...ops, liveDraft] : ops);
  }, [ops, liveDraft, size]);

  // Mở ô gõ chữ thì đưa con trỏ vào ngay (autoFocus của trình duyệt bị cú bấm chuột trên canvas giành lại tiêu điểm)
  useEffect(() => { if (textAt) textRef.current?.focus(); }, [textAt]);

  // Đổi tọa độ chuột/ngón tay (theo khung hiển thị) sang pixel ảnh
  const toImg = (e: React.PointerEvent): Pt => {
    const c = canvasRef.current!; const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  };

  const commitText = () => {
    if (textAt && textVal.trim()) setOps(o => [...o, { k: 'text', color, x: textAt.x, y: textAt.y, text: textVal.trim() }]);
    setTextAt(null); setTextVal('');
  };

  const onDown = (e: React.PointerEvent) => {
    if (!size) return;
    if (textAt) commitText();   // bấm chỗ khác → chốt chữ đang gõ
    const p = toImg(e);
    if (tool === 'text') { textOpenedAt.current = Date.now(); setTextAt(p); setTextVal(''); return; }
    (e.target as Element).setPointerCapture?.(e.pointerId);
    start.current = p;
    if (tool === 'pen') setDraft({ k: 'pen', color, pts: [p] });
  };
  const onMove = (e: React.PointerEvent) => {
    const s = start.current; if (!s || !size) return;
    const p = toImg(e);
    if (tool === 'pen') setDraft(d => d && d.k === 'pen' ? { ...d, pts: [...d.pts, p] } : d);
    else if (tool === 'rect') setDraft({ k: 'rect', color, r: clampRect(normRect(s, p), size.w, size.h) });
    else if (tool === 'blur') setDraft({ k: 'blur', r: clampRect(normRect(s, p), size.w, size.h) });
    else if (tool === 'crop') setDraft({ k: 'crop', r: clampRect(normRect(s, p), size.w, size.h) });
  };
  const onUp = () => {
    start.current = null;
    const d = draft; setDraft(null);
    if (!d) return;
    // Bỏ qua kéo quá nhỏ (bấm nhầm) — riêng bút: một chấm vẫn hợp lệ
    const tiny = d.k !== 'pen' && d.k !== 'text' && (d.r.w < MIN_SIZE || d.r.h < MIN_SIZE);
    if (!tiny) setOps(o => [...o, d]);
  };

  const undo = () => { setTextAt(null); setOps(o => o.slice(0, -1)); };

  // Xuất ảnh: vẽ lại KHÔNG có lớp phủ vùng cắt, rồi cắt theo vùng cắt hiệu lực (nếu có)
  const finish = () => {
    const img = imgRef.current; if (!img || !size) return;
    const finalOps = textAt && textVal.trim() ? [...ops, { k: 'text', color, x: textAt.x, y: textAt.y, text: textVal.trim() } as Op] : ops;
    const full = document.createElement('canvas'); full.width = size.w; full.height = size.h;
    const fctx = full.getContext('2d'); if (!fctx) return;
    paintOps(fctx, img, size.w, size.h, finalOps);
    const cr: Rect | null = cropOf(finalOps);
    let out = full;
    if (cr && cr.w >= MIN_SIZE && cr.h >= MIN_SIZE) {
      out = document.createElement('canvas');
      out.width = Math.round(cr.w); out.height = Math.round(cr.h);
      out.getContext('2d')?.drawImage(full, cr.x, cr.y, cr.w, cr.h, 0, 0, out.width, out.height);
    }
    out.toBlob(b => { if (b) onDone(new File([b], screenshotName(), { type: 'image/png' })); else onCancel(); }, 'image/png');
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  const btn = 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12.5px] font-semibold cursor-pointer transition-colors';
  return createPortal(
    <div className={snip ? 'fixed inset-0 z-[80] bg-black grid place-items-center overflow-hidden' : 'fixed inset-0 z-[80] bg-black/85 flex flex-col'} role="dialog" aria-label={snip ? 'Khoanh vùng chụp' : 'Sửa ảnh'} data-testid="chat-image-editor" data-variant={snip ? 'snip' : undefined}>
      {/* Thanh công cụ (chế độ khoanh vùng: thanh nổi, tự xuống dưới nếu vùng chọn sát mép trên) */}
      <div className={snip ? `absolute left-1/2 -translate-x-1/2 z-10 flex flex-wrap items-center justify-center gap-1.5 px-2.5 py-2 bg-slate-900/95 rounded-xl shadow-2xl max-w-[96vw] ${crop && size && crop.y < size.h * 0.15 ? 'bottom-3' : 'top-3'}` : 'flex flex-wrap items-center gap-1.5 px-3 py-2 bg-slate-900'} data-testid="editor-toolbar">
        {/* Màu nền các nút đặt trực tiếp (style): index.css của giao diện sáng ghi đè các lớp bg-slate-*, nút sẽ thành nền trắng chữ trắng */}
        {TOOLS.map(t => (
          <button key={t.id} type="button" onClick={() => { setTool(t.id); if (textAt) commitText(); }} aria-label={t.label} aria-pressed={tool === t.id} title={t.label}
            className={btn} style={{ color: '#ffffff', background: tool === t.id ? '#0d47c9' : '#334155' }}>
            {t.icon}<span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
        <span className="w-px h-6 bg-slate-700 mx-1" />
        {COLORS.map(c => (
          <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Màu ${c}`} aria-pressed={color === c} data-testid="editor-color"
            className={`w-6 h-6 rounded-full cursor-pointer border-2 ${color === c ? 'border-white' : 'border-slate-500'}`} style={{ background: c }} />
        ))}
        <span className="w-px h-6 bg-slate-700 mx-1" />
        <button type="button" onClick={undo} disabled={ops.length === 0} aria-label="Hoàn tác" title="Hoàn tác (Ctrl+Z)"
          className={`${btn} disabled:opacity-40`} style={{ color: '#ffffff', background: '#334155' }}><Undo2 className="w-4 h-4" /><span className="hidden sm:inline">Hoàn tác</span></button>
        <span className="flex-1" />
        <button type="button" onClick={onCancel} aria-label="Hủy" title="Hủy (Esc)" className={btn} style={{ color: '#ffffff', background: '#334155' }}><X className="w-4 h-4" />Hủy</button>
        <button type="button" onClick={finish} disabled={!size} aria-label="Xong" title="Xong — đưa ảnh vào ô soạn tin" className={`${btn} disabled:opacity-50`} style={{ color: '#ffffff', background: '#059669' }}><Check className="w-4 h-4" />Xong</button>
      </div>
      {/* Vùng ảnh */}
      <div className={snip ? 'w-screen h-screen grid place-items-center' : 'flex-1 min-h-0 overflow-auto grid place-items-center p-3'}>
        {error ? <p className="text-white text-sm">Không mở được ảnh này để sửa.</p> : !size ? <p className="text-white text-sm">Đang mở ảnh…</p> : (
          <div className="relative inline-block max-w-full" style={{ lineHeight: 0 }}>
            <canvas ref={canvasRef} width={size.w} height={size.h} data-testid="editor-canvas"
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
              // Công cụ Chữ: chặn hành vi mặc định của mousedown, nếu không canvas (không nhận tiêu điểm) cướp focus khỏi ô gõ chữ vừa mở → ô tự đóng ngay, không gõ được
              onMouseDown={e => { if (tool === 'text') e.preventDefault(); }}
              className={snip ? 'max-w-full bg-white' : 'max-w-full bg-white rounded shadow-xl'}
              style={{ maxHeight: snip ? '100vh' : 'calc(100vh - 110px)', touchAction: 'none', cursor: tool === 'text' ? 'text' : 'crosshair' }} />
            {/* Lớp mờ ngoài vùng giữ lại + khung nét đứt (chưa khoanh ở chế độ khoanh vùng → mờ cả ảnh) */}
            {snip && !crop && <div data-testid="snip-dim" className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(0,0,0,0.45)' }} />}
            {crop && size && (() => {
              const pc = (v: number) => `${v * 100}%`;
              const dim = { position: 'absolute', background: 'rgba(0,0,0,0.55)', pointerEvents: 'none' } as const;
              const l = crop.x / size.w, t = crop.y / size.h, w = crop.w / size.w, h = crop.h / size.h;
              return (<>
                <div style={{ ...dim, left: 0, top: 0, width: '100%', height: pc(t) }} />
                <div style={{ ...dim, left: 0, top: pc(t + h), width: '100%', height: pc(1 - t - h) }} />
                <div style={{ ...dim, left: 0, top: pc(t), width: pc(l), height: pc(h) }} />
                <div style={{ ...dim, left: pc(l + w), top: pc(t), width: pc(1 - l - w), height: pc(h) }} />
                <div data-testid="crop-box" style={{ position: 'absolute', left: pc(l), top: pc(t), width: pc(w), height: pc(h), outline: '2px dashed #ffffff', pointerEvents: 'none' }} />
              </>);
            })()}
            {textAt && (
              <input ref={textRef} autoFocus value={textVal} onChange={e => setTextVal(e.target.value)} aria-label="Nhập chữ"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitText(); } e.stopPropagation(); }}
                // Mất tiêu điểm trong 300ms đầu = do cú bấm mở ô (không phải người dùng bỏ đi) → lấy lại tiêu điểm thay vì chốt/đóng
                onBlur={() => { if (Date.now() - textOpenedAt.current < 300) { textRef.current?.focus(); return; } commitText(); }}
                className="absolute bg-white/90 border border-dashed border-slate-500 outline-none px-1 rounded font-bold"
                // Cỡ chữ ô gõ = cỡ chữ sẽ in lên ảnh, quy đổi theo tỉ lệ hiển thị (gõ thấy sao in ra vậy)
                style={{ left: `${(textAt.x / size.w) * 100}%`, top: `${(textAt.y / size.h) * 100}%`, color, minWidth: 80, lineHeight: 1.25,
                  fontSize: Math.max(12, fontSizeFor(size.w) * ((canvasRef.current?.getBoundingClientRect().width || size.w) / size.w)) }} />
            )}
          </div>
        )}
      </div>
      {/* Chế độ khoanh vùng: đã khoanh rồi thì ẩn gợi ý (khỏi đè lên thanh công cụ khi nó nhảy xuống dưới) */}
      {!(snip && crop) && <p className={snip ? 'absolute bottom-3 left-1/2 -translate-x-1/2 z-10 bg-slate-900/90 rounded-full px-3 py-1 text-[11.5px] text-slate-100 text-center max-w-[94vw]' : 'text-center text-[11.5px] text-slate-300 pb-2'}>
        {snip && !crop ? 'Kéo chuột để khoanh vùng cần chụp · Esc để hủy' : tool === 'crop' ? 'Kéo để chọn vùng giữ lại. Kéo lại để chọn vùng khác.' : tool === 'text' ? 'Bấm vào ảnh rồi gõ chữ, nhấn Enter để chốt.' : tool === 'blur' ? 'Kéo qua phần cần che (số tiền, tên, mật khẩu…).' : 'Kéo trên ảnh để vẽ.'}
</p>}
    </div>,
    document.body
  );
}
