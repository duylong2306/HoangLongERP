// TRÌNH SỬA ẢNH TRONG TIN NHẮN (kiểu Zalo): cắt, bút, khung, chữ, làm mờ. File này chỉ chứa phần LOGIC + VẼ, không có giao diện,
// để component ChatImageEditor gọn và để kiểm thử được. Mọi tọa độ tính theo PIXEL CỦA ẢNH GỐC (không phải theo khung hiển thị).

export interface Pt { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }

export type Op =
  | { k: 'pen'; color: string; pts: Pt[] }
  | { k: 'rect'; color: string; r: Rect }
  | { k: 'text'; color: string; x: number; y: number; text: string }
  | { k: 'blur'; r: Rect }
  | { k: 'crop'; r: Rect };

/** Vùng nhỏ hơn mức này coi như bấm nhầm (không tạo nét/khung/vùng mờ/vùng cắt). */
export const MIN_SIZE = 6;
/** Ảnh quá lớn được thu nhỏ khi mở sửa để canvas không ngốn bộ nhớ (ảnh chụp Retina rộng ~3000px vẫn giữ nguyên). */
export const MAX_EDGE = 3200;
export const COLORS = ['#ef4444', '#f59e0b', '#0d47c9', '#16a34a', '#111827'] as const;

/** Hình chữ nhật từ hai điểm kéo (kéo theo hướng nào cũng ra w,h dương). */
export function normRect(a: Pt, b: Pt): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

/** Cắt hình chữ nhật cho nằm trong ảnh W×H. */
export function clampRect(r: Rect, W: number, H: number): Rect {
  const x = Math.max(0, Math.min(W, r.x)), y = Math.max(0, Math.min(H, r.y));
  return { x, y, w: Math.max(0, Math.min(W - x, r.w - (x - r.x))), h: Math.max(0, Math.min(H - y, r.h - (y - r.y))) };
}

/** Vùng cắt đang có hiệu lực = thao tác cắt GẦN NHẤT (cắt lại thì thay vùng cũ, không chồng). */
export function cropOf(ops: Op[]): Rect | null {
  for (let i = ops.length - 1; i >= 0; i--) { const o = ops[i]; if (o.k === 'crop') return o.r; }
  return null;
}

/** Tỉ lệ đi theo bề rộng ảnh để nét vẽ/chữ nhìn vừa mắt cả ảnh nhỏ lẫn ảnh Retina. */
export const strokeWidthFor = (W: number) => Math.max(3, Math.round(W / 280));
export const fontSizeFor = (W: number) => Math.max(18, Math.round(W / 38));

/** Kích thước ảnh sau khi thu nhỏ về MAX_EDGE (không phóng to). */
export function fitEdge(w: number, h: number, max = MAX_EDGE): { w: number; h: number } {
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/** Làm mờ kiểu mosaic: thu vùng xuống ô nhỏ rồi phóng lại không làm mịn → che chữ/số nhạy cảm mà không đọc lại được. */
function pixelate(ctx: CanvasRenderingContext2D, r: Rect) {
  const block = Math.max(8, Math.round(Math.min(r.w, r.h) / 6));
  const tw = Math.max(1, Math.ceil(r.w / block)), th = Math.max(1, Math.ceil(r.h / block));
  const tmp = document.createElement('canvas'); tmp.width = tw; tmp.height = th;
  const t = tmp.getContext('2d'); if (!t) return;
  t.drawImage(ctx.canvas, r.x, r.y, r.w, r.h, 0, 0, tw, th);
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, tw, th, r.x, r.y, r.w, r.h);
  ctx.imageSmoothingEnabled = prev;
}

/** Vẽ ảnh nền rồi lần lượt các thao tác (trừ 'crop' — vùng cắt chỉ áp khi xuất ảnh / phủ mờ khi xem). */
export function paintOps(ctx: CanvasRenderingContext2D, img: CanvasImageSource, W: number, H: number, ops: Op[]) {
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0, W, H);
  const lw = strokeWidthFor(W);
  for (const o of ops) {
    if (o.k === 'pen') {
      if (o.pts.length < 1) continue;
      ctx.strokeStyle = o.color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(o.pts[0].x, o.pts[0].y);
      // Một chấm (bấm không kéo) vẫn hiện: vẽ đoạn dài 0 với đầu tròn
      if (o.pts.length === 1) ctx.lineTo(o.pts[0].x + 0.01, o.pts[0].y);
      for (const p of o.pts.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    } else if (o.k === 'rect') {
      ctx.strokeStyle = o.color; ctx.lineWidth = lw; ctx.lineJoin = 'round';
      ctx.strokeRect(o.r.x, o.r.y, o.r.w, o.r.h);
    } else if (o.k === 'text') {
      const fs = fontSizeFor(W);
      ctx.fillStyle = o.color; ctx.font = `700 ${fs}px Inter, system-ui, sans-serif`; ctx.textBaseline = 'top';
      o.text.split('\n').forEach((line, i) => ctx.fillText(line, o.x, o.y + i * fs * 1.25));
    } else if (o.k === 'blur') {
      pixelate(ctx, o.r);
    }
  }
}

/** Tên tệp cho ảnh chụp/ảnh dán: man-hinh-20261104-093015.png */
export function screenshotName(d = new Date(), ext = 'png'): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `man-hinh-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.${ext}`;
}
