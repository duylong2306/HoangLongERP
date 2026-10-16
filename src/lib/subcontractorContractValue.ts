// Đồng bộ GIÁ TRỊ hợp đồng thầu phụ vào NỘI DUNG bản in đã lưu (contractHtml).
// Khi tạo hợp đồng, mẫu điền số tiền ở 2 chỗ (xem SubcontractorArchive.generateSubcontractorContractHtml):
//   {{GIA_TRI_HOP_DONG}} → "420.000.000 VND"   và   {{GIA_TRI_BANG_CHU}} → số tiền bằng chữ.
// Bản in sau đó được lưu nguyên văn, nên đổi ô "Giá trị hợp đồng khoán" không làm đổi số trong văn bản.
// Hàm này thay đúng 2 dạng chuỗi đó (giá trị cũ → giá trị mới); không đụng đoạn nào khác của văn bản.

export const formatContractMoney = (v: number) => `${(v || 0).toLocaleString('vi-VN')} VND`;

export interface ReplaceContractValueResult {
  html: string;
  /** Số lần thay (cả dạng số lẫn dạng chữ). 0 = không tìm thấy giá trị cũ trong văn bản (người dùng đã sửa tay) → cần kiểm tra thủ công. */
  replaced: number;
}

/**
 * @param toWords hàm đọc số thành chữ (docSoTiengViet) — truyền vào để file này thuần, dễ test.
 */
export function replaceContractValueInHtml(
  html: string,
  oldValue: number,
  newValue: number,
  toWords: (n: number) => string,
): ReplaceContractValueResult {
  if (!html || oldValue === newValue) return { html: html || '', replaced: 0 };
  let out = html;
  let replaced = 0;
  const swap = (from: string, to: string) => {
    if (!from || from === to) return;
    const parts = out.split(from);
    if (parts.length > 1) { replaced += parts.length - 1; out = parts.join(to); }
  };
  // Dạng số: "420.000.000 VND". Giá trị cũ 0 mẫu ghi "0 VND" — bỏ qua để không thay nhầm các số 0 khác.
  if (oldValue) swap(formatContractMoney(oldValue), formatContractMoney(newValue));
  // Dạng chữ: chỉ thay khi giá trị cũ khác 0 (mẫu ghi "Chưa cập nhật" cho 0 — không thể thay an toàn).
  if (oldValue) swap(toWords(oldValue), newValue ? toWords(newValue) : 'Chưa cập nhật');
  return { html: out, replaced };
}
