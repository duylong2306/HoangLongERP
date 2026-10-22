import { useEffect, useState } from 'react';
import { X, Share, SquarePlus, Download } from 'lucide-react';
import { detectPlatform, isInAppBrowser, isSnoozed, snooze, markInstalled, type InstallPlatform } from '../lib/installPrompt';
import './shell/shell.css';

// THÔNG BÁO CÀI ỨNG DỤNG RA MÀN HÌNH CHÍNH.
//  • Android (Chrome): bắt sự kiện beforeinstallprompt → thẻ có nút "Cài đặt" → hiện hộp thoại cài của Chrome.
//  • iPhone/iPad (Safari): iOS không có hộp thoại cài tự động → thẻ hướng dẫn 3 bước + mũi tên chỉ xuống nút Chia sẻ.
// Chỉ hiện trên điện thoại/máy tính bảng, khi CHƯA chạy dạng ứng dụng, chưa cài, và chưa bấm "Để sau" trong 3 ngày.
const isStandalone = () => { try { return !!window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true; } catch { return false; } };

export default function InstallAppPrompt() {
  const [platform] = useState<InstallPlatform>(() => detectPlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints || 0));
  const [evt, setEvt] = useState<any>(null);          // sự kiện cài của Chrome (Android)
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (platform === 'other' || isStandalone()) return;
    const onBefore = (e: Event) => { e.preventDefault(); setEvt(e); };
    const onInstalled = () => { markInstalled(); setShow(false); setEvt(null); };
    window.addEventListener('beforeinstallprompt', onBefore);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onBefore); window.removeEventListener('appinstalled', onInstalled); };
  }, [platform]);

  // Hiện sau vài giây (để người dùng thấy giao diện trước); iOS: chỉ trong Safari/trình duyệt thật; Android: chỉ khi Chrome đã sẵn sàng cho cài.
  useEffect(() => {
    if (platform === 'other' || isStandalone() || isSnoozed()) return;
    if (platform === 'ios' && isInAppBrowser(navigator.userAgent)) return;
    if (platform === 'android' && !evt) return;
    const t = setTimeout(() => setShow(true), 3500);
    return () => clearTimeout(t);
  }, [platform, evt]);

  if (!show) return null;
  const later = () => { snooze(); setShow(false); };
  const install = async () => {
    if (!evt) return;
    setBusy(true);
    try {
      evt.prompt();
      const choice = await evt.userChoice;
      if (choice?.outcome === 'accepted') markInstalled(); else snooze();
    } catch { snooze(); }
    setBusy(false); setShow(false); setEvt(null);
  };

  return (
    <div className="lx-install" role="dialog" aria-label="Cài ứng dụng ra màn hình chính" data-testid="install-prompt" data-platform={platform}>
      <button type="button" onClick={later} aria-label="Để sau" className="lx-install-x" data-testid="install-later-x"><X size={16} /></button>
      <div className="lx-install-row">
        <img src="/lolo-icon-192.png" alt="" className="lx-install-ico" />
        <div className="lx-install-txt">
          <b>{platform === 'ios' ? 'Đưa LoLo ra màn hình chính' : 'Cài LoLo ra màn hình'}</b>
          <span>Mở nhanh như ứng dụng, toàn màn hình và nhận thông báo đầy đủ.</span>
        </div>
      </div>
      {platform === 'ios' ? (
        <>
          <ol className="lx-install-steps" data-testid="install-ios-steps">
            <li><i><Share size={16} /></i>Bấm nút <b>Chia sẻ</b> ở thanh dưới của Safari</li>
            <li><i><SquarePlus size={16} /></i>Chọn <b>“Thêm vào Màn hình chính”</b></li>
            <li><i>✓</i>Bấm <b>Thêm</b> ở góc trên bên phải</li>
          </ol>
          <div className="lx-install-actions"><button type="button" onClick={later} className="lx-install-main" data-testid="install-ios-ok">Đã hiểu</button></div>
          <div className="lx-install-arrow" aria-hidden>▼</div>
        </>
      ) : (
        <div className="lx-install-actions">
          <button type="button" onClick={later} className="lx-install-sub" data-testid="install-later">Để sau</button>
          <button type="button" onClick={install} disabled={busy} className="lx-install-main" data-testid="install-now"><Download size={16} /> Cài đặt</button>
        </div>
      )}
    </div>
  );
}
