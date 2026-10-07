import React, { useState } from 'react';
import { BellRing, BellOff, X } from 'lucide-react';
import { subscribeToPush } from '../hooks/useWebPush';

// THANH NHẮC BẬT THÔNG BÁO TRÌNH DUYỆT (nhắc chấm công, tin nhắn, công việc...).
// Vì sao cần: trước đây ứng dụng tự gọi xin quyền ngay khi đăng nhập — nhiều trình duyệt (nhất là điện thoại/Safari) chặn lời xin quyền
// không do người dùng bấm, nên nhân viên không bao giờ thấy hộp thoại và không nhận được thông báo. Thanh này cho nút bấm rõ ràng:
// bấm nút → xin quyền (đúng thao tác của người dùng) → đăng ký nhận thông báo cho thiết bị này.
//
// Hiện khi: đăng nhập rồi + trình duyệt hỗ trợ + quyền chưa phải "granted".
//   • default  → nút "Bật thông báo".
//   • denied   → trình duyệt đã chặn, ứng dụng không xin lại được → hướng dẫn mở khóa thủ công.
//   • iPhone/iPad chưa cài ứng dụng lên Màn hình chính → iOS chỉ cho thông báo khi đã cài → hướng dẫn cài.
// Bấm X → ẩn 1 ngày (nhớ bằng localStorage; nếu localStorage không dùng được thì chỉ ẩn trong phiên này).
const SNOOZE_KEY = 'hl_push_banner_snooze_until';
const SNOOZE_MS = 24 * 60 * 60 * 1000;

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
const readSnoozed = () => { try { return Number(localStorage.getItem(SNOOZE_KEY) || 0) > Date.now(); } catch { return false; } };

export default function PushPermissionBanner({ userId }: { userId: string }) {
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>(() => ('Notification' in window ? Notification.permission : 'unsupported'));
  const [hidden, setHidden] = useState(readSnoozed);
  const [busy, setBusy] = useState(false);

  if (hidden) return null;
  // iPhone/iPad: chưa cài lên Màn hình chính thì không có API thông báo → hướng dẫn cài (ưu tiên hơn "unsupported" thường)
  const needInstall = isIos() && !isStandalone();
  if (perm === 'granted' && !needInstall) return null;
  if (perm === 'unsupported' && !needInstall) return null;   // trình duyệt không hỗ trợ: không có gì để nhắc

  const snooze = () => {
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS)); } catch { /* bỏ qua */ }
    setHidden(true);
  };

  // Phải gọi requestPermission TRỰC TIẾP trong lúc xử lý cú bấm (đúng thao tác người dùng), rồi mới đăng ký push
  const enable = async () => {
    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPerm(result);
      if (result === 'granted') await subscribeToPush(userId);
    } finally { setBusy(false); }
  };

  let icon = <BellRing className="w-3.5 h-3.5 text-amber-600" />;
  let text = 'Bạn chưa bật thông báo trên thiết bị này — sẽ không nhận được nhắc chấm công, tin nhắn và công việc mới.';
  let action: React.ReactNode = (
    <button onClick={enable} disabled={busy} className="font-bold text-blue-700 hover:underline disabled:opacity-50">{busy ? 'Đang bật...' : 'Bật thông báo'}</button>
  );
  if (needInstall) {
    text = 'Để nhận thông báo trên iPhone/iPad: bấm nút Chia sẻ của Safari → "Thêm vào Màn hình chính", rồi mở ứng dụng từ biểu tượng đó.';
    action = null;
  } else if (perm === 'denied') {
    icon = <BellOff className="w-3.5 h-3.5 text-amber-600" />;
    text = 'Trình duyệt đang chặn thông báo. Bấm biểu tượng ổ khóa cạnh thanh địa chỉ → Thông báo → Cho phép, rồi tải lại trang.';
    action = <button onClick={() => window.location.reload()} className="font-bold text-blue-700 hover:underline">Tải lại trang</button>;
  }

  return (
    <div id="push_permission_banner" className="flex flex-wrap items-center justify-between gap-2 px-4 py-1.5 text-xs border-b bg-amber-50 border-amber-200 text-amber-900">
      <span className="inline-flex items-center gap-1.5 font-semibold">{icon}{text}</span>
      <span className="inline-flex items-center gap-3">
        {action}
        <button onClick={snooze} aria-label="Ẩn 1 ngày" title="Nhắc lại sau 1 ngày" className="text-amber-700 hover:text-amber-900"><X className="w-4 h-4" /></button>
      </span>
    </div>
  );
}
