import { describe, it, expect } from 'vitest';
import {
  base32Encode, base32Decode, generateTotpSecret, hotp, totpAt, totpStep, verifyTotp, otpauthUri,
  encryptSecret, decryptSecret, generateRecoveryCodes, hashRecovery, normalizeRecovery,
} from '../../../api/_totp';

// Khóa thử của RFC 6238 phụ lục B: ASCII "12345678901234567890" → base32 GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('base32', () => {
  it('mã hóa / giải mã khớp vector chuẩn RFC 4648 và khứ hồi', () => {
    expect(base32Encode(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
    expect(base32Decode('MZXW6YTBOI').toString()).toBe('foobar');
    expect(base32Encode(Buffer.from('12345678901234567890'))).toBe(RFC_SECRET);
    const rnd = Buffer.from(Array.from({ length: 20 }, (_, i) => (i * 37 + 11) % 256));
    expect(base32Decode(base32Encode(rnd)).equals(rnd)).toBe(true);
  });
  it('bỏ qua khoảng trắng/gạch/chữ thường; ký tự lạ → lỗi', () => {
    expect(base32Decode('mzxw 6ytb-oi').toString()).toBe('foobar');
    expect(() => base32Decode('MZXW1')).toThrow();
  });
});

describe('TOTP theo vector chuẩn RFC 6238 (SHA1, 6 số = 6 chữ số cuối của mã 8 số trong RFC)', () => {
  // Thời điểm (giây) → mã 8 số của RFC; mã 6 số là 6 chữ số cuối
  const vectors: [number, string][] = [[59, '94287082'], [1111111109, '07081804'], [1111111111, '14050471'], [1234567890, '89005924'], [2000000000, '69279037'], [20000000000, '65353130']];
  for (const [t, code8] of vectors) {
    it(`t=${t}s → ${code8.slice(2)}`, () => { expect(totpAt(RFC_SECRET, t * 1000)).toBe(code8.slice(2)); });
  }
  it('hotp theo vector RFC 4226 (counter 0..2)', () => {
    expect(['755224', '287082', '359152'].map((_, i) => hotp(RFC_SECRET, i))).toEqual(['755224', '287082', '359152']);
  });
});

describe('verifyTotp', () => {
  const now = 1_700_000_000_000;
  const code = totpAt(RFC_SECRET, now);

  it('mã đúng hiện tại → ok; cho phép lệch ±1 bước (30 giây); lệch 2 bước → không', () => {
    expect(verifyTotp(RFC_SECRET, code, 0, now).ok).toBe(true);
    expect(verifyTotp(RFC_SECRET, code, 0, now + 30_000).ok).toBe(true);
    expect(verifyTotp(RFC_SECRET, code, 0, now - 30_000).ok).toBe(true);
    expect(verifyTotp(RFC_SECRET, code, 0, now + 90_000).ok).toBe(false);
    expect(verifyTotp(RFC_SECRET, code, 0, now - 90_000).ok).toBe(false);
  });
  it('mã sai / không đủ 6 số / chữ → không; chấp nhận khoảng trắng giữa mã ("123 456")', () => {
    for (const bad of ['000000', '12345', '1234567', 'abcdef', '', '      ']) expect(verifyTotp(RFC_SECRET, bad, 0, now).ok).toBe(bad === code ? true : false);
    expect(verifyTotp(RFC_SECRET, `${code.slice(0, 3)} ${code.slice(3)}`, 0, now).ok).toBe(true);
  });
  it('CHỐNG DÙNG LẠI: sau khi dùng 1 mã (ghi lastStep) thì mã đó và mọi mã cũ hơn bị từ chối', () => {
    const r = verifyTotp(RFC_SECRET, code, 0, now);
    expect(r.ok).toBe(true); expect(r.step).toBe(totpStep(now));
    expect(verifyTotp(RFC_SECRET, code, r.step, now).ok).toBe(false);                       // dùng lại ngay
    expect(verifyTotp(RFC_SECRET, code, r.step, now + 30_000).ok).toBe(false);             // vẫn trong cửa sổ nhưng bước đã dùng
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, now + 30_000), r.step, now + 30_000).ok).toBe(true);   // mã bước kế tiếp thì được
  });
});

describe('khóa bí mật & mã hóa', () => {
  it('khóa sinh ngẫu nhiên: 32 ký tự base32, mỗi lần khác nhau', () => {
    const a = generateTotpSecret(), b = generateTotpSecret();
    expect(a).toMatch(/^[A-Z2-7]{32}$/); expect(a).not.toBe(b);
  });
  it('otpauth URI đúng định dạng cho ứng dụng Authenticator', () => {
    const u = otpauthUri(RFC_SECRET, 'admin');
    expect(u).toBe(`otpauth://totp/LoLo:admin?secret=${RFC_SECRET}&issuer=LoLo&algorithm=SHA1&digits=6&period=30`);
    expect(otpauthUri(RFC_SECRET, 'a b@c')).toContain('LoLo:a%20b%40c');
  });
  it('mã hóa AES-GCM: khứ hồi đúng; sai khóa / dữ liệu bị sửa → null; không lộ bản rõ; mỗi lần mã hóa khác nhau', () => {
    const enc = encryptSecret(RFC_SECRET, 'khoa-1');
    expect(enc).not.toContain(RFC_SECRET);
    expect(decryptSecret(enc, 'khoa-1')).toBe(RFC_SECRET);
    expect(decryptSecret(enc, 'khoa-2')).toBeNull();
    const [iv, tag, data] = enc.split('.');
    expect(decryptSecret([iv, tag, data.slice(0, -2) + 'AA'].join('.'), 'khoa-1')).toBeNull();
    expect(decryptSecret('rac', 'khoa-1')).toBeNull();
    expect(encryptSecret(RFC_SECRET, 'khoa-1')).not.toBe(enc);
  });
});

describe('mã khôi phục', () => {
  it('8 mã dạng XXXX-XXXX-XX, không trùng nhau, không có ký tự dễ nhầm', () => {
    const c = generateRecoveryCodes();
    expect(c).toHaveLength(8); expect(new Set(c).size).toBe(8);
    for (const x of c) expect(x).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{2}$/);
  });
  it('băm không phân biệt hoa/thường/gạch/khoảng trắng; khác khóa thì băm khác', () => {
    expect(hashRecovery('abcd-efgh-jk', 'k')).toBe(hashRecovery(' ABCD EFGH JK ', 'k'));
    expect(hashRecovery('ABCD-EFGH-JK', 'k')).not.toBe(hashRecovery('ABCD-EFGH-JK', 'k2'));
    expect(normalizeRecovery('ab-cd 12')).toBe('ABCD12');
  });
});
