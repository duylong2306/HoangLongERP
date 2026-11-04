// CHỤP MÀN HÌNH TRONG TRÌNH DUYỆT cho Tin nhắn (kiểu nút "Chụp màn hình" của Zalo). Hai nguồn:
//   • capturePage():    chụp CHÍNH trang LoLo đang mở (html2canvas-pro) — không hỏi quyền, chạy cả trên điện thoại,
//                       nhưng chỉ thấy được trang LoLo, không thấy cửa sổ/ứng dụng khác.
//   • captureDisplay(): chụp cửa sổ/màn hình/tab khác qua getDisplayMedia — trình duyệt tự hiện hộp chọn nguồn mỗi lần chụp;
//                       chỉ có trên máy tính (iOS và Android Chrome không hỗ trợ).
import { screenshotName } from './imageMarkup';

/** Máy này có chụp được cửa sổ/màn hình khác không? (có getDisplayMedia và không phải điện thoại/máy tính bảng) */
export function canCaptureDisplay(nav: Navigator | undefined = typeof navigator !== 'undefined' ? navigator : undefined): boolean {
  if (!nav || typeof nav.mediaDevices?.getDisplayMedia !== 'function') return false;
  return !/Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent || '');
}

// Ảnh chụp trung gian lưu JPEG (mã hóa nhanh hơn PNG nhiều lần với ảnh màn hình lớn → bớt trễ sau khi bấm chụp);
// ảnh người dùng gửi đi là PNG xuất ra từ trình sửa sau khi đã cắt nhỏ.
const toFile = (c: HTMLCanvasElement): Promise<File | null> =>
  new Promise(res => c.toBlob(b => res(b ? new File([b], screenshotName(new Date(), 'jpg'), { type: 'image/jpeg' }) : null), 'image/jpeg', 0.92));

/**
 * Chụp phần đang NHÌN THẤY của trang LoLo (không phải cả trang cuộn dài). Trả null nếu không tạo được ảnh.
 * Phần tử gắn data-no-capture bị bỏ qua (VD hộp thoại đang mở che nội dung).
 */
export async function capturePage(): Promise<File | null> {
  const mod: any = await import('html2canvas-pro');
  const html2canvas = mod.default || mod;
  const canvas: HTMLCanvasElement = await html2canvas(document.documentElement, {   // gốc <html> (không phải <body>): body có thể cao 0px khi giao diện dùng bố cục cố định, html2canvas sẽ báo lỗi kích thước
    x: window.scrollX, y: window.scrollY, width: window.innerWidth, height: window.innerHeight,
    windowWidth: window.innerWidth, windowHeight: window.innerHeight,
    scale: Math.min(1.5, window.devicePixelRatio || 1),   // tối đa 1,5x: chữ vẫn đọc rõ sau khi cắt, nhưng chụp nhanh hơn hẳn 2x trên màn hình Retina
    useCORS: true, backgroundColor: '#ffffff', logging: false,
    ignoreElements: (el: Element) => el.hasAttribute?.('data-no-capture'),
    // html2canvas vẽ SAI bóng đổ của Tailwind (shadow-sm có spread âm): bong bóng tin nhắn ra khung xám dày + ô trắng trong, rất xấu.
    // Chỉ sửa trên BẢN SAO trang dùng để chụp (trang thật không đổi): tắt bóng đổ/mờ nền → ảnh sạch, chỉ mất hiệu ứng bóng nhẹ.
    onclone: (doc: Document) => {
      const st = doc.createElement('style');
      st.textContent = '*,*::before,*::after{box-shadow:none!important;text-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}';
      doc.head.appendChild(st);
    },
  });
  return toFile(canvas);
}

/**
 * Chụp một khung hình của cửa sổ/màn hình/tab do người dùng chọn. Người dùng bấm Hủy ở hộp chọn của trình duyệt → trả null (không phải lỗi).
 * Luồng quay được tắt ngay sau khi lấy khung hình để biểu tượng "đang chia sẻ màn hình" của trình duyệt biến mất.
 */
export async function captureDisplay(): Promise<File | null> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  } catch (e: any) {
    if (e?.name === 'NotAllowedError' || e?.name === 'AbortError') return null;
    throw e;
  }
  try {
    const video = document.createElement('video');
    video.muted = true; video.playsInline = true; video.srcObject = stream;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Không đọc được hình từ màn hình đã chọn'));
    });
    await video.play();
    // Chờ khung hình đầu tiên thật sự được vẽ (lấy ngay có thể ra ảnh đen)
    await new Promise<void>(resolve => {
      const v: any = video;
      if (typeof v.requestVideoFrameCallback === 'function') v.requestVideoFrameCallback(() => resolve());
      else setTimeout(resolve, 250);
    });
    const c = document.createElement('canvas');
    c.width = video.videoWidth; c.height = video.videoHeight;
    c.getContext('2d')?.drawImage(video, 0, 0, c.width, c.height);
    return await toFile(c);
  } finally {
    stream.getTracks().forEach(t => t.stop());
  }
}
