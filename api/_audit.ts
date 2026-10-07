// NHẬT KÝ THAO TÁC của trang quản trị nền tảng — lưu ai đã đổi gì, lúc nào (giữ 30 ngày rồi tự xóa).
// File bắt đầu bằng "_" nên Vercel không coi là endpoint. KHÔNG import từ src/ (xem api/login.ts).
//
// Nguyên tắc:
//   • Ghi SAU khi thao tác thành công, không bao giờ làm hỏng thao tác chính (lỗi ghi nhật ký chỉ console.error);
//   • TUYỆT ĐỐI không lưu mật khẩu / hash / token: mọi khóa có chữ password|hash|token|secret bị loại ở sanitizeDetail;
//   • Không có API sửa/xóa nhật ký — chỉ có xóa tự động bản ghi quá 30 ngày.
import type { SupabaseClient } from '@supabase/supabase-js';

export const AUDIT_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const SENSITIVE_KEY = /password|hash|token|secret/i;

export interface AuditCtx { adminId: string | null; username: string; ipHash: string }

// Loại khóa nhạy cảm, cắt chuỗi dài, giới hạn độ sâu — để chi tiết lưu vào nhật ký luôn gọn và an toàn.
export function sanitizeDetail(v: unknown, depth = 0): unknown {
  if (v === null || v === undefined) return v ?? null;
  if (typeof v === 'string') return v.length > 300 ? `${v.slice(0, 300)}…` : v;
  if (typeof v !== 'object') return v;
  if (depth >= 4) return '[…]';
  if (Array.isArray(v)) return v.slice(0, 50).map(x => sanitizeDetail(x, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(k)) continue;
    out[k] = sanitizeDetail(val, depth + 1);
  }
  return out;
}

// So sánh trước/sau theo danh sách trường → { trường: { from, to } } chỉ gồm trường THỰC SỰ đổi. Rỗng = không đổi gì.
export function diffFields(before: Record<string, any> | null | undefined, after: Record<string, any>, keys: string[]): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of keys) {
    if (!(k in after)) continue;
    const a = before?.[k] ?? null, b = after[k] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) out[k] = { from: a, to: b };
  }
  return out;
}

export async function writeAudit(
  db: SupabaseClient, ctx: AuditCtx,
  e: { action: string; targetType?: string; targetId?: string; summary: string; detail?: unknown },
): Promise<void> {
  try {
    const { error } = await db.from('platform_audit_logs').insert({
      admin_id: ctx.adminId, admin_username: ctx.username, action: e.action,
      target_type: e.targetType ?? null, target_id: e.targetId ?? null,
      summary: e.summary.slice(0, 300), detail: sanitizeDetail(e.detail ?? null), ip_hash: ctx.ipHash,
    });
    if (error) console.error('[api/platform] Không ghi được nhật ký:', error.message);
  } catch (err: any) {
    console.error('[api/platform] Không ghi được nhật ký:', err?.message);
  }
}

// Xóa nhật ký cũ hơn 30 ngày (gọi mỗi lần đăng nhập thành công và khi mở trang nhật ký — đủ thường xuyên, khỏi cần cron).
export async function purgeOldAudit(db: SupabaseClient, now: Date = new Date()): Promise<void> {
  try {
    const before = new Date(now.getTime() - AUDIT_RETENTION_DAYS * DAY_MS).toISOString();
    const { error } = await db.from('platform_audit_logs').delete().lt('created_at', before);
    if (error) console.error('[api/platform] Không dọn được nhật ký cũ:', error.message);
  } catch (err: any) {
    console.error('[api/platform] Không dọn được nhật ký cũ:', err?.message);
  }
}
