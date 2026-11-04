import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Crop, Pencil, Square, Type, Grid3x3, Undo2, X, Check } from 'lucide-react';
import { COLORS, MIN_SIZE, clampRect, cropOf, fitEdge, normRect, paintOps, screenshotName, type Op, type Pt, type Rect } from '../lib/imageMarkup';

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

export default function ChatImageEditor({ file, onCancel, onDone, initialTool }: { file: File; onCancel: () => void; onDone: (f: File) => void; initialTool?: Tool }) {
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

  // Vẽ lại canvas mỗi khi đổi thao tác; vùng cắt hiện bằng lớp phủ tối + viền nét đứt bên ngoài vùng giữ lại
  useEffect(() => {
    const c = canvasRef.current, img = imgRef.current;
    if (!c || !img || !size) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const live = ops.concat(draft && draft.k !== 'crop' ? [draft] : []);
    paintOps(ctx, img, size.w, size.h, live);
    if (crop) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, size.w, crop.y);
      ctx.fillRect(0, crop.y + crop.h, size.w, size.h - crop.y - crop.h);
      ctx.fillRect(0, crop.y, crop.x, crop.h);
      ctx.fillRect(crop.x + crop.w, crop.y, size.w - crop.x - crop.w, crop.h);
      ctx.strokeStyle = '#ffffff'; ctx.setLineDash([12, 8]); ctx.lineWidth = Math.max(2, size.w / 600);
      ctx.strokeRect(crop.x, crop.y, crop.w, crop.h);
      ctx.restore();
    }
  }, [ops, draft, crop, size]);

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
    if (tool === 'text') { setTextAt(p); setTextVal(''); return; }
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
    <div className="fixed inset-0 z-[80] bg-black/85 flex flex-col" role="dialog" aria-label="Sửa ảnh" data-testid="chat-image-editor">
      {/* Thanh công cụ */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 bg-slate-900">
        {TOOLS.map(t => (
          <button key={t.id} type="button" onClick={() => { setTool(t.id); if (textAt) commitText(); }} aria-label={t.label} aria-pressed={tool === t.id} title={t.label}
            className={`${btn} ${tool === t.id ? 'bg-[#0d47c9]' : 'bg-slate-800 hover:bg-slate-700'}`} style={{ color: '#ffffff' }}>
            {t.icon}<span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
        <span className="w-px h-6 bg-slate-700 mx-1" />
        {COLORS.map(c => (
          <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Màu ${c}`} aria-pressed={color === c} data-testid="editor-color"
            className={`w-6 h-6 rounded-full cursor-pointer border-2 ${color === c ? 'border-white' : 'border-transparent'}`} style={{ background: c }} />
        ))}
        <span className="w-px h-6 bg-slate-700 mx-1" />
        <button type="button" onClick={undo} disabled={ops.length === 0} aria-label="Hoàn tác" title="Hoàn tác (Ctrl+Z)"
          className={`${btn} bg-slate-800 hover:bg-slate-700 disabled:opacity-40`} style={{ color: '#ffffff' }}><Undo2 className="w-4 h-4" /><span className="hidden sm:inline">Hoàn tác</span></button>
        <span className="flex-1" />
        <button type="button" onClick={onCancel} aria-label="Hủy" title="Hủy (Esc)" className={`${btn} bg-slate-800 hover:bg-slate-700`} style={{ color: '#ffffff' }}><X className="w-4 h-4" />Hủy</button>
        <button type="button" onClick={finish} disabled={!size} aria-label="Xong" title="Xong — đưa ảnh vào ô soạn tin" className={`${btn} bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50`} style={{ color: '#ffffff' }}><Check className="w-4 h-4" />Xong</button>
      </div>
      {/* Vùng ảnh */}
      <div className="flex-1 min-h-0 overflow-auto grid place-items-center p-3">
        {error ? <p className="text-white text-sm">Không mở được ảnh này để sửa.</p> : !size ? <p className="text-white text-sm">Đang mở ảnh…</p> : (
          <div className="relative inline-block max-w-full" style={{ lineHeight: 0 }}>
            <canvas ref={canvasRef} width={size.w} height={size.h} data-testid="editor-canvas"
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
              className="max-w-full bg-white rounded shadow-xl"
              style={{ maxHeight: 'calc(100vh - 110px)', touchAction: 'none', cursor: tool === 'text' ? 'text' : 'crosshair' }} />
            {textAt && (
              <input autoFocus value={textVal} onChange={e => setTextVal(e.target.value)} aria-label="Nhập chữ"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitText(); } e.stopPropagation(); }}
                onBlur={commitText}
                className="absolute bg-white/90 border border-dashed border-slate-500 outline-none px-1 rounded font-bold"
                style={{ left: `${(textAt.x / size.w) * 100}%`, top: `${(textAt.y / size.h) * 100}%`, color, minWidth: 80, fontSize: 16, lineHeight: 1.3 }} />
            )}
          </div>
        )}
      </div>
      <p className="text-center text-[11.5px] text-slate-300 pb-2">
        {tool === 'crop' ? 'Kéo để chọn vùng giữ lại. Kéo lại để chọn vùng khác.' : tool === 'text' ? 'Bấm vào ảnh rồi gõ chữ, nhấn Enter để chốt.' : tool === 'blur' ? 'Kéo qua phần cần che (số tiền, tên, mật khẩu…).' : 'Kéo trên ảnh để vẽ.'}
      </p>
    </div>,
    document.body
  );
}
