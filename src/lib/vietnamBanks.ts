// Danh sách ngân hàng phổ biến + mã BIN 6 số (chuẩn Napas/VietQR) — dùng để tạo mã QR chuyển khoản.
// ⚠️ Sau khi chọn ngân hàng nhận tiền, hãy quét thử mã QR bằng app ngân hàng một lần để chắc chắn đúng tài khoản.
// Ngân hàng không có trong danh sách: chọn "Khác" và nhập tay mã BIN (tra trên trang chủ Napas/VietQR).
export const VIETNAM_BANKS: { name: string; bin: string }[] = [
  { name: 'Vietcombank', bin: '970436' }, { name: 'VietinBank', bin: '970415' }, { name: 'BIDV', bin: '970418' },
  { name: 'Agribank', bin: '970405' }, { name: 'Techcombank', bin: '970407' }, { name: 'MB Bank', bin: '970422' },
  { name: 'ACB', bin: '970416' }, { name: 'VPBank', bin: '970432' }, { name: 'TPBank', bin: '970423' },
  { name: 'Sacombank', bin: '970403' }, { name: 'HDBank', bin: '970437' }, { name: 'VIB', bin: '970441' },
  { name: 'SHB', bin: '970443' }, { name: 'MSB', bin: '970426' }, { name: 'OCB', bin: '970448' },
  { name: 'SeABank', bin: '970440' }, { name: 'LPBank (LienVietPostBank)', bin: '970449' }, { name: 'Eximbank', bin: '970431' },
  { name: 'Nam A Bank', bin: '970428' }, { name: 'Bac A Bank', bin: '970409' }, { name: 'ABBank', bin: '970425' },
  { name: 'PVcomBank', bin: '970412' }, { name: 'Bao Viet Bank', bin: '970438' }, { name: 'Viet Capital Bank', bin: '970454' },
  { name: 'SCB', bin: '970429' }, { name: 'NCB', bin: '970419' }, { name: 'Kienlongbank', bin: '970452' },
  { name: 'VietBank', bin: '970433' }, { name: 'DongA Bank', bin: '970406' }, { name: 'Saigonbank', bin: '970400' },
];
