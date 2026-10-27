import { useEffect, useState } from 'react';

/** Câu trạng thái lần lượt hiện trên màn chờ (chỉ minh họa — ứng dụng không biết tiến độ thật) */
export const SPLASH_MESSAGES = ['Đang kết nối máy chủ…', 'Đang tải dữ liệu công ty…', 'Sắp xong, vui lòng chờ…'];
export const SPLASH_STEP_MS = 3000;

/**
 * MÀN CHỜ khi mở ứng dụng (phương án C): nền xanh LoLo, logo "thở", thanh mảnh có vệt sáng chạy và câu trạng thái đổi dần.
 * Giữ nguyên ở câu cuối nếu tải lâu (không quay vòng lại câu đầu). Kiểu dáng ở src/index.css (.lolo-splash*).
 * Màn chờ SỚM (trước khi JavaScript chạy) nằm trong index.html cùng kiểu dáng — chuyển sang màn này không bị chớp.
 */
export default function LoadingScreen({ messages = SPLASH_MESSAGES, footer = 'Nền tảng ERP đa doanh nghiệp' }: { messages?: string[]; footer?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (messages.length < 2) return;
    const t = setInterval(() => setI(n => Math.min(n + 1, messages.length - 1)), SPLASH_STEP_MS);
    return () => clearInterval(t);
  }, [messages.length]);
  return (
    <div className="lolo-splash" role="status" aria-live="polite" aria-label="Đang tải" data-testid="loading-screen">
      <div className="lolo-splash-box">
        <img className="lolo-splash-logo" src="/lolo-icon-192.png" alt="LoLo" width={96} height={96} />
        <div className="lolo-splash-bar" />
        <div className="lolo-splash-msg" style={{ color: '#ffffff' }}><span key={i} data-testid="loading-message">{messages[Math.min(i, messages.length - 1)]}</span></div>
      </div>
      {footer && <div className="lolo-splash-foot">{footer}</div>}
    </div>
  );
}
