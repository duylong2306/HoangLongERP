// Tìm kiếm ở bảng Điều phối vật tư: khớp theo tên / mã đề xuất, tên / mã dự án, và MÃ ĐƠN HÀNG (PO-…) của đề xuất.
// Tách thành hàm thuần để kiểm thử; không phân biệt hoa/thường, bỏ khoảng trắng đầu cuối. Ô tìm trống khớp tất cả.
export interface MaterialSearchFields {
  docName?: string; docCode?: string; projName?: string; projCode?: string;
  /** Mã các đơn mua hàng thuộc đề xuất (gộp từ purchaseOrderIds trên đề xuất và các đơn trỏ ngược proposalId) */
  poCodes?: string[];
}
export function matchesMaterialSearch(term: string, f: MaterialSearchFields): boolean {
  const q = (term || '').trim().toLowerCase();
  if (!q) return true;
  const has = (v?: string) => (v || '').toLowerCase().includes(q);
  return has(f.docName) || has(f.docCode) || has(f.projName) || has(f.projCode) || (f.poCodes || []).some(c => has(c));
}
