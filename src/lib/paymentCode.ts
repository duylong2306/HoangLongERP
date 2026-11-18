// Mã phiếu chi dạng "PC-2026-<số>".
// Trước đây sinh bằng số NGẪU NHIÊN 100–999 → chỉ 900 giá trị, khi số phiếu tăng thì trùng mã là tất yếu
// (thực tế đã có 2 phiếu cùng PC-2026-127). Nay lấy số lớn nhất đang có + 1 nên không bao giờ trùng
// với phiếu đã có (hai người lập cùng lúc vẫn có thể trùng nhưng hiếm hơn rất nhiều so với ngẫu nhiên).
const RE = /^PC-2026-(\d+)$/;

export function nextPaymentCode(existing: { code?: string }[]): string {
  let max = 0;
  for (const p of existing) {
    const m = RE.exec(p.code || '');
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `PC-2026-${String(max + 1).padStart(3, '0')}`;
}
