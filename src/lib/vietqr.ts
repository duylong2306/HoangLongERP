// TẠO NỘI DUNG MÃ QR CHUYỂN KHOẢN VIETQR (chuẩn EMVCo + Napas 247) — chạy hoàn toàn tại trình duyệt, không gọi dịch vụ ngoài.
// Quét bằng app ngân hàng sẽ tự điền: ngân hàng nhận + số tài khoản + số tiền + nội dung chuyển khoản.
//
// Cấu trúc chuỗi (mỗi trường = mã 2 số + độ dài 2 số + giá trị):
//   00 phiên bản "01" · 01 kiểu QR "12" (động: có số tiền) · 38 thông tin tài khoản nhận (GUID Napas A000000727,
//   BIN ngân hàng + số tài khoản, dịch vụ QRIBFTTA = chuyển nhanh đến tài khoản) · 53 tiền tệ "704" (VND) · 54 số tiền ·
//   58 quốc gia "VN" · 62 → 08 nội dung chuyển khoản · 63 mã kiểm tra CRC16 (tính trên toàn bộ chuỗi đứng trước nó).

const tlv = (id: string, value: string): string => `${id}${String(value.length).padStart(2, '0')}${value}`;

// CRC-16/CCITT-FALSE (poly 0x1021, khởi tạo 0xFFFF) — đúng yêu cầu của EMVCo cho trường 63.
export function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Nội dung chuyển khoản chỉ nhận ASCII không dấu, tối đa 25 ký tự (giới hạn của nhiều ngân hàng) — mã đơn LOLOxxxxxxxx (12 ký tự) luôn hợp lệ.
export function sanitizeMemo(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^A-Za-z0-9 ]/g, '').slice(0, 25);
}

export interface VietQrInput { bin: string; account: string; amount: number; memo: string }

// Trả null nếu thiếu/sai dữ liệu (BIN phải 6 số, số tài khoản 1–19 chữ số/ký tự chữ-số, số tiền nguyên dương).
export function buildVietQrPayload({ bin, account, amount, memo }: VietQrInput): string | null {
  const acc = account.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(bin) || !/^[A-Za-z0-9]{1,19}$/.test(acc)) return null;
  if (!Number.isInteger(amount) || amount <= 0 || amount > 9_999_999_999) return null;
  const cleanMemo = sanitizeMemo(memo);

  const consumer = tlv('00', 'A000000727') + tlv('01', tlv('00', bin) + tlv('01', acc)) + tlv('02', 'QRIBFTTA');
  const body =
    tlv('00', '01') + tlv('01', '12') + tlv('38', consumer) + tlv('53', '704') + tlv('54', String(amount)) + tlv('58', 'VN') +
    (cleanMemo ? tlv('62', tlv('08', cleanMemo)) : '') + '6304';
  return body + crc16(body);
}
