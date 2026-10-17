// Công nợ thu: 1 khách có NHIỀU dòng công nợ nhập tay → tiền đã thu của khách chỉ được chia MỘT lần giữa các dòng
// (trước đây mỗi dòng nhận TOÀN BỘ phiếu thu của khách nên cộng đôi). Chia lần lượt theo thứ tự dòng, mỗi dòng nhận tối đa phần còn lại của nó,
// phần dư dồn vào dòng cuối. Khách chỉ có 1 dòng thì nhận đủ như cũ.
export function allocateReceipts(rows: { id: string; capacity: number }[], total: number): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(rows.map(r => [r.id, 0]));
  let left = total;
  for (const r of rows) {
    const take = Math.min(left, Math.max(0, r.capacity));
    out[r.id] += take; left -= take;
    if (left <= 0) break;
  }
  if (left > 0 && rows.length) out[rows[rows.length - 1].id] += left;
  return out;
}
