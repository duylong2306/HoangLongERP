import { describe, it, expect } from 'vitest';
import { crc16, buildVietQrPayload, sanitizeMemo } from '../vietqr';

describe('crc16 (CCITT-FALSE)', () => {
  it('đúng giá trị chuẩn của chuỗi kiểm tra "123456789" = 29B1', () => {
    expect(crc16('123456789')).toBe('29B1');
  });
});

describe('buildVietQrPayload', () => {
  const ok = { bin: '970436', account: '0123456789', amount: 300000, memo: 'LOLOAB12CD34' };

  it('đúng cấu trúc VietQR: tài khoản nhận, số tiền, nội dung, CRC cuối', () => {
    const p = buildVietQrPayload(ok)!;
    expect(p.startsWith('000201010212')).toBe(true);
    // 38: GUID Napas + (BIN, số tài khoản: 0006970436 + 01100123456789 = 24 ký tự → "0124") + dịch vụ QRIBFTTA
    expect(p).toContain('0010A0000007270' + '124' + '0006970436' + '01100123456789' + '0208QRIBFTTA');
    expect(p).toContain('5303704');            // VND
    expect(p).toContain('5406300000');         // số tiền
    expect(p).toContain('5802VN');
    expect(p).toContain('62160812LOLOAB12CD34'); // nội dung = mã đơn
    // CRC: 4 ký tự cuối khớp với CRC của phần đứng trước (kể cả "6304")
    expect(p.slice(-8, -4)).toBe('6304');
    expect(p.slice(-4)).toBe(crc16(p.slice(0, -4)));
  });

  it('trường độ dài khớp giá trị (không lệch byte nào)', () => {
    const p = buildVietQrPayload(ok)!;
    // Đọc lần lượt từng trường: độ dài khai báo phải đúng và hết chuỗi vừa khớp
    let i = 0; const ids: string[] = [];
    while (i < p.length) { ids.push(p.slice(i, i + 2)); const len = Number(p.slice(i + 2, i + 4)); expect(Number.isInteger(len)).toBe(true); i += 4 + len; }
    expect(i).toBe(p.length);
    expect(ids).toEqual(['00', '01', '38', '53', '54', '58', '62', '63']);
  });

  it('từ chối dữ liệu sai: BIN không đủ 6 số, tài khoản rỗng, số tiền 0 / lẻ / âm', () => {
    expect(buildVietQrPayload({ ...ok, bin: '' })).toBeNull();
    expect(buildVietQrPayload({ ...ok, bin: '97043' })).toBeNull();
    expect(buildVietQrPayload({ ...ok, account: '' })).toBeNull();
    expect(buildVietQrPayload({ ...ok, account: '01 23-45' })).toBeNull();
    for (const amount of [0, -5, 1.5, NaN]) expect(buildVietQrPayload({ ...ok, amount })).toBeNull();
  });

  it('bỏ khoảng trắng trong số tài khoản', () => {
    expect(buildVietQrPayload({ ...ok, account: '0123 4567 89' })).toBe(buildVietQrPayload(ok));
  });
});

describe('sanitizeMemo', () => {
  it('bỏ dấu tiếng Việt, ký tự lạ; tối đa 25 ký tự', () => {
    expect(sanitizeMemo('Thanh toán đơn Đà Nẵng!')).toBe('Thanh toan don Da Nang');
    expect(sanitizeMemo('A'.repeat(40))).toHaveLength(25);
  });
});
