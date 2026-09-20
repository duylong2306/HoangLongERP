/**
 * Danh mục tham số (placeholder) dùng cho mẫu Hồ sơ pháp lý dự án.
 *
 * Tên tham số GIỮ ĐÚNG như bản đồ `replacements` đang dùng ở ContractDocument /
 * AcceptanceDocument / LiquidationDocument để người dùng quen tay, và để cùng một
 * bộ dữ liệu (công ty, khách hàng, công trình, ngày, tiền) điền được vào mọi loại hồ sơ.
 * Việc thay thế thực tế nằm ở LegalDocument.tsx (cần dữ liệu báo giá + thông tin doanh nghiệp).
 */

export interface PlaceholderItem {
  token: string; // Không kèm {{ }}
  label: string; // Mô tả tiếng Việt hiển thị trên nút chèn
}

export interface PlaceholderGroup {
  title: string;
  items: PlaceholderItem[];
}

export const LEGAL_PLACEHOLDER_GROUPS: PlaceholderGroup[] = [
  {
    title: 'Hồ sơ & công trình',
    items: [
      { token: 'SO_HO_SO_PHAP_LY', label: 'Số hồ sơ pháp lý' },
      { token: 'CONG_TRINH', label: 'Tên công trình' },
      { token: 'HANG_MUC', label: 'Hạng mục' },
      { token: 'DIA_DIEM', label: 'Địa điểm' },
      { token: 'SO_HOP_DONG', label: 'Số hợp đồng' },
      { token: 'NGAY_KY_HĐ', label: 'Ngày ký hợp đồng' },
    ],
  },
  {
    title: 'Bên A — Chủ đầu tư / Khách hàng',
    items: [
      { token: 'TEN_KHACH_HANG', label: 'Tên khách hàng' },
      { token: 'DIA_CHI_KHACH_HANG', label: 'Địa chỉ' },
      { token: 'DIEN_THOAI_KHACH_HANG', label: 'Điện thoại' },
      { token: 'MST_KHACH_HANG', label: 'Mã số thuế' },
      { token: 'STK_KHACH_HANG', label: 'Số tài khoản' },
      { token: 'DAI_DIEN_KHACH_HANG', label: 'Người đại diện' },
      { token: 'CHUC_VU_KHACH_HANG', label: 'Chức vụ' },
    ],
  },
  {
    title: 'Bên B — Công ty (lấy từ Cài đặt hệ thống)',
    items: [
      { token: 'TEN_CONG_TY', label: 'Tên công ty' },
      { token: 'DIA_CHI_CONG_TY', label: 'Địa chỉ' },
      { token: 'DIEN_THOAI_CONG_TY', label: 'Điện thoại' },
      { token: 'MST_CONG_TY', label: 'Mã số thuế' },
      { token: 'STK_CONG_TY', label: 'Số tài khoản' },
      { token: 'DAI_DIEN_CONG_TY', label: 'Người đại diện' },
      { token: 'CHUC_VU_CONG_TY', label: 'Chức vụ' },
    ],
  },
  {
    title: 'Ngày tháng',
    items: [
      { token: 'NGAY', label: 'Ngày (hôm nay)' },
      { token: 'THANG', label: 'Tháng (hôm nay)' },
      { token: 'NAM', label: 'Năm (hôm nay)' },
    ],
  },
  {
    title: 'Giá trị',
    items: [
      { token: 'TONG_CONG', label: 'Tổng giá trị (số)' },
      { token: 'TONG_CONG_CHU', label: 'Tổng giá trị (bằng chữ)' },
    ],
  },
];

/** Thay mọi `{{TOKEN}}` có trong bản đồ; token không có trong bản đồ được giữ nguyên. */
export function replacePlaceholders(template: string, replacements: Record<string, string>): string {
  let html = template;
  Object.entries(replacements).forEach(([placeholder, value]) => {
    const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Dùng hàm thay thế để ký tự "$" trong giá trị (vd "$1") không bị hiểu là nhóm regex
    html = html.replace(new RegExp(escaped, 'g'), () => value);
  });
  return html;
}
