// Gợi ý ĐỊA CHỈ (subdomain) doanh nghiệp từ tên — dùng ở form đăng ký (Giai đoạn 2).
// "Công ty TNHH Đại Phát" → "cong-ty-tnhh-dai-phat". Chỉ là GỢI Ý: người dùng sửa được, và máy chủ
// vẫn kiểm tra lại (api/_signup.ts) nên không tin kết quả hàm này.
export function slugify(name: string): string {
  return (name || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // bỏ dấu tiếng Việt (tách dấu rồi xóa)
    .replace(/đ/g, 'd').replace(/Đ/g, 'd')               // đ/Đ không tách được bằng NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')                         // mọi ký tự lạ/khoảng trắng → '-'
    .replace(/^-+|-+$/g, '')                             // không bắt đầu/kết thúc bằng '-'
    .slice(0, 40)
    .replace(/-+$/g, '');                                // cắt ở 40 ký tự có thể để lại '-' cuối
}
