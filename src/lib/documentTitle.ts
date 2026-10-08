// TIÊU ĐỀ TAB TRÌNH DUYỆT = "<Tên doanh nghiệp> — LoLo".
// Lý do: một người có thể quản lý nhiều doanh nghiệp và mở nhiều tab cùng lúc; tab chỉ ghi "LoLo - ..." thì không phân biệt được.
// Tên doanh nghiệp đặt TRƯỚC để vẫn đọc được khi có nhiều tab (tab hẹp chỉ hiện phần đầu tiêu đề).
export const DEFAULT_DOCUMENT_TITLE = 'LoLo - Nền tảng ERP đa doanh nghiệp';
const PLACEHOLDER_NAME = 'Tên Công Ty Của Bạn';   // giá trị mặc định trong App.tsx khi doanh nghiệp chưa nhập tên

export function buildDocumentTitle(companyName?: string | null): string {
  const name = (companyName || '').trim();
  if (!name || name === PLACEHOLDER_NAME) return DEFAULT_DOCUMENT_TITLE;   // chưa có tên thật → giữ tiêu đề mặc định
  return `${name} — LoLo`;
}
