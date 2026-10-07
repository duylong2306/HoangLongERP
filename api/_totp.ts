// XÁC THỰC HAI LỚP (TOTP — mã 6 số đổi mỗi 30 giây, dùng với Google Authenticator / Microsoft Authenticator / Authy...) cho trang quản trị.
// Chuẩn RFC 6238 (TOTP) trên RFC 4226 (HOTP): HMAC-SHA1, 6 chữ số, bước 30 giây. Không dùng thư viện ngoài — chỉ module `crypto` của Node.
// File bắt đầu bằng "_" nên Vercel không coi là endpoint. KHÔNG import từ src/ (xem api/login.ts).
//
// An toàn:
//   • Khóa bí mật (secret) lưu trong DB ở dạng MÃ HÓA AES-256-GCM (khóa mã hóa suy ra từ SUPABASE_JWT_SECRET) → lộ riêng bảng DB
//     vẫn chưa lộ được khóa 2FA;
//   • chống dùng lại mã: mỗi mã đúng chỉ được dùng 1 lần (lưu bước thời gian đã dùng — xem verifyTotp + totp_last_step);
//   • mã khôi phục (khi mất điện thoại) lưu dạng BĂM, mỗi mã chỉ dùng 1 lần.
import { createHmac, createHash, createCipheriv, createDecipheriv, randomBytes, randomInt, timingSafeEqual } from 'crypto';

export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
const TOTP_WINDOW = 1;               // chấp nhận lệch ±1 bước (±30 giây) do đồng hồ điện thoại/máy chủ không khớp hoàn toàn
export const RECOVERY_CODE_COUNT = 8;

// ─── Base32 (RFC 4648) — định dạng khóa mà ứng dụng Authenticator đọc ────────────────────────────
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0, value = 0; const out: number[] = [];
  for (const ch of clean) {
    const i = B32.indexOf(ch);
    if (i < 0) throw new Error('Khóa base32 không hợp lệ');
    value = (value << 5) | i; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

// Khóa bí mật mới: 20 byte ngẫu nhiên (160 bit, đúng khuyến nghị của RFC 4226) → chuỗi base32 32 ký tự.
export const generateTotpSecret = (): string => base32Encode(randomBytes(20));

// ─── Tính mã ─────────────────────────────────────────────────────────────────────────────────────
export function hotp(secretB32: string, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', base32Decode(secretB32)).update(msg).digest();
  const off = h[h.length - 1] & 0x0f;
  const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(bin % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}
export const totpStep = (nowMs: number = Date.now()): number => Math.floor(nowMs / 1000 / TOTP_STEP_SECONDS);
export const totpAt = (secretB32: string, nowMs: number = Date.now()): string => hotp(secretB32, totpStep(nowMs));

// So khớp trong cửa sổ ±1 bước. Trả { ok, step }; chỉ nhận bước LỚN HƠN lastStep (đã dùng) → một mã không dùng lại được kể cả khi
// kẻ gian nhìn trộm mã vừa nhập. So sánh thời gian không đổi để không lộ chữ số nào đúng.
export function verifyTotp(secretB32: string, code: string, lastStep = 0, nowMs: number = Date.now()): { ok: boolean; step: number } {
  const c = String(code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(c)) return { ok: false, step: 0 };
  const cur = totpStep(nowMs);
  let hit = 0;
  for (let d = -TOTP_WINDOW; d <= TOTP_WINDOW; d++) {
    const step = cur + d;
    const expect = hotp(secretB32, step);
    if (timingSafeEqual(Buffer.from(expect), Buffer.from(c)) && step > lastStep && step > hit) hit = step;
  }
  return hit > 0 ? { ok: true, step: hit } : { ok: false, step: 0 };
}

// Địa chỉ otpauth:// mà ứng dụng Authenticator đọc từ mã QR (nhãn "LoLo:tên-đăng-nhập").
export function otpauthUri(secretB32: string, username: string, issuer = 'LoLo'): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(username)}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`;
}

// ─── Mã hóa khóa bí mật khi lưu DB (AES-256-GCM, định dạng "iv.tag.dữ-liệu" base64url) ─────────────
const encKey = (jwtSecret: string): Buffer => createHash('sha256').update(`${jwtSecret}|totp-encrypt`).digest();
export function encryptSecret(plain: string, jwtSecret: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', encKey(jwtSecret), iv);
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), data].map(b => b.toString('base64url')).join('.');
}
// Trả null nếu dữ liệu hỏng / sai khóa (không ném lỗi).
export function decryptSecret(stored: string, jwtSecret: string): string | null {
  try {
    const [iv, tag, data] = stored.split('.').map(p => Buffer.from(p, 'base64url'));
    const d = createDecipheriv('aes-256-gcm', encKey(jwtSecret), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(data), d.final()]).toString('utf8');
  } catch { return null; }
}

// ─── Mã khôi phục ────────────────────────────────────────────────────────────────────────────────
// Dạng "ABCD-EFGH-JK" (bỏ ký tự dễ nhầm 0/O/1/I), mỗi mã dùng 1 lần; DB chỉ lưu BĂM (sha256 kèm khóa riêng).
const RC_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function generateRecoveryCodes(n = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: n }, () => {
    let s = '';
    for (let i = 0; i < 10; i++) s += RC_ALPHABET[randomInt(RC_ALPHABET.length)];
    return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
  });
}
export const normalizeRecovery = (s: string): string => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
export const hashRecovery = (code: string, jwtSecret: string): string =>
  createHash('sha256').update(`${jwtSecret}|totp-recovery|${normalizeRecovery(code)}`).digest('hex');
