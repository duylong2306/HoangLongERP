// Chuyển đổi số tiền (VND, nguyên) thành chữ tiếng Việt.
// Dùng cho mẫu in Phiếu Thu / Phiếu Chi ("Bằng chữ: ...").

const ONES = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const TENS = [
  '',
  'mười',
  'hai mươi',
  'ba mươi',
  'bốn mươi',
  'năm mươi',
  'sáu mươi',
  'bảy mươi',
  'tám mươi',
  'chín mươi',
];

// Đọc một nhóm 3 chữ số (hàng trăm, chục, đơn).
function readThree(digits: string): string {
  const n = parseInt(digits, 10);
  if (n === 0) return '';
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const o = n % 10;

  let s = '';
  if (h > 0) s += ONES[h] + ' trăm';

  if (t > 0) {
    if (s) s += ' ';
    if (t === 1) {
      s += 'mười';
      if (o === 1) s += ' một';
      else if (o === 5) s += ' lăm';
      else if (o > 0) s += ' ' + ONES[o];
    } else {
      s += TENS[t];
      if (o === 1) s += ' mốt';
      else if (o === 5) s += ' lăm';
      else if (o > 0) s += ' ' + ONES[o];
    }
  } else if (o > 0) {
    // Hàng chục = 0, có hàng đơn
    s += (s ? ' lẻ ' : '') + ONES[o];
  }
  return s.trim();
}

export function numberToVietnameseWords(amount: number): string {
  if (!amount || amount === 0) return 'Không đồng';
  if (amount < 0) return 'Âm ' + numberToVietnameseWords(-amount);

  const scales = ['', 'nghìn', 'triệu', 'tỷ'];
  const raw = Math.floor(Math.abs(amount)).toString();
  const pad = raw.length % 3 === 0 ? 0 : 3 - (raw.length % 3);
  const padded = '0'.repeat(pad) + raw;

  const groups: string[] = [];
  for (let i = 0; i < padded.length; i += 3) groups.push(padded.substr(i, 3));

  let result = '';
  const groupCount = groups.length;
  for (let i = 0; i < groupCount; i++) {
    const g = readThree(groups[i]);
    if (g) {
      const scale = scales[groupCount - 1 - i];
      if (result) result += ' ';
      result += g;
      if (scale) result += ' ' + scale;
    }
  }

  result = result.trim() + ' đồng';
  return result.charAt(0).toUpperCase() + result.slice(1);
}
