// NÉN ẢNH TRƯỚC KHI TẢI LÊN Storage — tiết kiệm dung lượng (ảnh điện thoại 4–13 MB → thường còn 200–500 KB).
// Số liệu thực tế (Hoàng Long): ảnh báo cáo nhiệm vụ chiếm ~1,26 GB / 836 tệp (trung bình 1,5 MB, lớn nhất 13 MB) — nơi tốn nhất.
//
// Quy tắc:
//   • Chỉ nén JPEG/PNG/WebP. GIF (có thể là ảnh động), SVG, PDF, Word, video... → GIỮ NGUYÊN.
//   • Thu nhỏ nếu cạnh dài hơn `maxEdge` (không bao giờ phóng to), vẽ lại lên canvas rồi xuất JPEG (hoặc PNG nếu ảnh có vùng trong suốt —
//     JPEG sẽ làm nền trong suốt thành đen, VD logo).
//   • Ảnh vốn đã nhỏ (≤ SKIP_BELOW byte và không quá cỡ) → giữ nguyên, khỏi nén thêm làm mờ ảnh.
//   • Chỉ dùng bản nén NẾU NHỎ HƠN bản gốc. Mọi lỗi (trình duyệt không hỗ trợ, ảnh hỏng...) → trả về tệp gốc, tuyệt đối không làm hỏng việc tải lên.
//   • Ảnh được xoay đúng chiều theo EXIF khi vẽ lại (createImageBitmap 'from-image'); thông tin EXIF (GPS...) bị loại bỏ là hệ quả tự nhiên.
export interface CompressOptions { maxEdge?: number; quality?: number }

export const DEFAULT_MAX_EDGE = 1920;     // đủ nét cho xem trên màn hình và in A4
export const DEFAULT_QUALITY = 0.8;
export const SKIP_BELOW = 200 * 1024;     // ≤ 200 KB và không quá cỡ → không nén

const COMPRESSIBLE = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Kích thước sau khi thu nhỏ (giữ tỉ lệ, không phóng to)
export function planSize(w: number, h: number, maxEdge: number): { w: number; h: number; scaled: boolean } {
  const longest = Math.max(w, h);
  if (longest <= maxEdge) return { w, h, scaled: false };
  const k = maxEdge / longest;
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)), scaled: true };
}

// Ảnh có điểm trong suốt không? (lấy mẫu để nhanh; chỉ cần PNG/WebP mới kiểm tra)
function hasTransparency(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  try {
    const { data } = ctx.getImageData(0, 0, w, h);
    const step = Math.max(1, Math.floor(data.length / 4 / 20000)) * 4;   // ~20.000 điểm mẫu
    for (let i = 3; i < data.length; i += step) if (data[i] < 250) return true;
  } catch { /* không đọc được điểm ảnh → coi như có trong suốt để an toàn (xuất PNG) */ return true; }
  return false;
}

const canvasToBlob = (c: HTMLCanvasElement, type: string, q: number) => new Promise<Blob | null>(res => c.toBlob(res, type, q));

export async function compressImageFile(file: File, opts: CompressOptions = {}): Promise<File> {
  const maxEdge = opts.maxEdge ?? DEFAULT_MAX_EDGE;
  const quality = opts.quality ?? DEFAULT_QUALITY;
  try {
    if (!COMPRESSIBLE.has(file.type)) return file;
    if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;   // môi trường không hỗ trợ

    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as any);
    try {
      const { w, h, scaled } = planSize(bmp.width, bmp.height, maxEdge);
      if (!scaled && file.size <= SKIP_BELOW) return file;   // đã nhỏ sẵn

      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.drawImage(bmp, 0, 0, w, h);

      // PNG/WebP có trong suốt → giữ PNG; còn lại → JPEG (nhỏ nhất cho ảnh chụp)
      const keepAlpha = file.type !== 'image/jpeg' && hasTransparency(ctx, w, h);
      const outType = keepAlpha ? 'image/png' : 'image/jpeg';
      const blob = await canvasToBlob(canvas, outType, quality);
      if (!blob || blob.size >= file.size) return file;       // không lợi → giữ gốc

      // Đổi đuôi tên file cho khớp định dạng mới (đường dẫn Storage lấy đuôi từ tên file)
      const base = file.name.replace(/\.[^.]+$/, '') || 'image';
      return new File([blob], `${base}.${keepAlpha ? 'png' : 'jpg'}`, { type: outType, lastModified: file.lastModified });
    } finally { bmp.close?.(); }
  } catch (err) {
    console.warn('[imageCompress] Không nén được, dùng ảnh gốc:', (err as any)?.message || err);
    return file;
  }
}
