// ============================================================================
// Outbox lưu tạm các lần chấm công khi KHÔNG đẩy được lên Supabase
// (mất mạng / RLS / lỗi mạng), sau đó tự động đồng bộ lại khi có kết nối.
//
// Kết hợp với ảnh "đốt giờ" (burnTimestampToPhoto) để tạo dấu vết audit:
// nếu người dùng sửa giờ trong localStorage, ảnh selfie vẫn giữ giờ gốc
// → HR đối chiếu là phát hiện được gian lận.
//
// LƯU Ý: Outbox chỉ đảm bảo TÍNH SẴN SÀNG (không mất ca do mạng), KHÔNG phải
// lớp xác thực chống gian lận. Tính toàn vẹn thời gian phải do máy chủ đảm bảo
// (giờ máy chủ / chữ ký Edge Function). Ảnh đốt giờ là lớp audit bổ trợ.
// ============================================================================

const OUTBOX_KEY = 'hl_attendance_outbox';
export const OUTBOX_MAX_ATTEMPTS = 8;

export type PunchSlot =
  | 'timeInS' | 'timeOutS' | 'timeInC' | 'timeOutC' | 'timeInOT' | 'timeOutOT';

export interface OutboxOp {
  id: string;
  record: any;
  punchSlot: PunchSlot;
  serverTs: any;
  attempts: number;
  queuedAt: number;
  lastError?: string;
}

function safeRead(): OutboxOp[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as OutboxOp[]) : [];
  } catch {
    return [];
  }
}

function safeWrite(ops: OutboxOp[]): void {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(ops));
  } catch {
    /* localStorage không khả dụng (private mode / quota) → bỏ qua, chỉ đẩy trực tiếp */
  }
}

/** Thêm 1 lượt chấm vào hàng đợi (ghi đè theo id để không nhân đôi). */
export function enqueuePunch(op: Omit<OutboxOp, 'attempts'>): OutboxOp {
  const full: OutboxOp = { ...op, attempts: 0 };
  const ops = safeRead().filter((o) => o.id !== full.id);
  ops.push(full);
  safeWrite(ops);
  return full;
}

export function removePunch(id: string): void {
  safeWrite(safeRead().filter((o) => o.id !== id));
}

function bumpAttempt(id: string, lastError: string): void {
  const ops = safeRead().map((o) =>
    o.id === id ? { ...o, attempts: o.attempts + 1, lastError } : o
  );
  safeWrite(ops);
}

export function getPendingPunches(): OutboxOp[] {
  return safeRead();
}

export function pendingCount(): number {
  return safeRead().length;
}

export interface SyncSummary {
  synced: number;
  failed: number; // còn lại trong hàng đợi (sẽ thử lại)
  dropped: number; // bỏ hẳn do vượt quá số lần thử
  remaining: number;
}

/**
 * Đồng bộ toàn bộ hàng đợi. Gọi saveFn (thường là dbService.attendance.save).
 * Thành công → xóa khỏi hàng đợi. Thất bại → tăng attempts; vượt OUTBOX_MAX_ATTEMPTS
 * thì bỏ hẳn (tránh retry vô tận với lỗi quyền RLS).
 */
export async function syncAttendanceOutbox(
  saveFn: (record: any, slot: PunchSlot) => Promise<void>
): Promise<SyncSummary> {
  const ops = safeRead();
  const summary: SyncSummary = { synced: 0, failed: 0, dropped: 0, remaining: 0 };
  if (ops.length === 0) return summary;

  for (const op of ops) {
    try {
      await saveFn(op.record, op.punchSlot);
      removePunch(op.id);
      summary.synced++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      if (op.attempts + 1 >= OUTBOX_MAX_ATTEMPTS) {
        removePunch(op.id);
        summary.dropped++;
      } else {
        bumpAttempt(op.id, msg);
        summary.failed++;
      }
    }
  }
  summary.remaining = safeRead().length;
  return summary;
}

/**
 * Đốt giờ chấm + công trình + GPS + tên NV vào góc ảnh selfie để tạo dấu vết audit.
 * Ảnh selfie là data URL local nên vẽ canvas KHÔNG bị taint (CORS ok).
 * Đây KHÔNG phải bảo đảm mật mã: kẻ tinh vi chạy code trên client vẫn composite được
 * ảnh giả, nhưng khó hơn rất nhiều so với sửa chuỗi JSON, và quan trọng là tạo ra
 * SỰ MÂU THUẪN có thể audit (ảnh ghi 17:08 nhưng record ghi 13:00 → HR phát hiện).
 */
export function burnTimestampToPhoto(
  photo: string,
  opts: { time: string; site?: string; gps?: string; empName?: string }
): Promise<string> {
  return new Promise((resolve) => {
    if (!photo || !photo.startsWith('data:image')) {
      resolve(photo);
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(photo);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const lines = [opts.time, opts.site, opts.gps, opts.empName].filter(
          Boolean
        ) as string[];
        if (lines.length > 0) {
          const fs = Math.max(14, Math.round(canvas.width / 26));
          ctx.font = `bold ${fs}px sans-serif`;
          ctx.textBaseline = 'top';
          let maxW = 0;
          for (const l of lines) maxW = Math.max(maxW, ctx.measureText(l).width);
          const pad = Math.round(fs * 0.4);
          const lh = Math.round(fs * 1.25);
          const boxH = lh * lines.length + pad * 2;
          const boxW = maxW + pad * 2;
          const x = 8;
          const y = canvas.height - boxH - 8;
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.fillRect(x, y, boxW, boxH);
          ctx.fillStyle = '#ffd54a';
          lines.forEach((l, i) => ctx.fillText(l, x + pad, y + pad + i * lh));
        }
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      } catch {
        resolve(photo);
      }
    };
    img.onerror = () => resolve(photo);
    img.src = photo;
  });
}
