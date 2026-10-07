import React, {StrictMode, lazy, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { SettingsProvider } from './context/SettingsContext';
import ErrorBoundary from './components/ErrorBoundary';
import { getHostInfo } from './lib/tenant';
import { getStoredTokenClaims, clearStoredSession } from './lib/supabase';
import { chooseScreen } from './lib/boot';
import './index.css';

// Địa chỉ gốc (www.<tên-miền-gốc>, xem src/lib/tenant.ts) = website giới thiệu + đăng ký doanh nghiệp.
// Chỉ nạp trang này (tải trễ) — KHÔNG khởi động ứng dụng ERP/Supabase/Service Worker ở địa chỉ gốc.
// Mọi địa chỉ khác (subdomain doanh nghiệp, vercel.app, localhost...) chạy ứng dụng như cũ.
const LandingPage = lazy(() => import('./components/landing/LandingPage'));
// Trang QUẢN TRỊ NỀN TẢNG (đường dẫn /quantri): tách hẳn khỏi ERP, tài khoản riêng. Chỉ mở ở địa chỉ gốc hoặc địa chỉ
// "other" (vercel.app/localhost, để thử); TUYỆT ĐỐI không mở ở subdomain doanh nghiệp (ở đó /quantri vẫn là ERP).
const PlatformConsole = lazy(() => import('./components/platform/PlatformConsole'));
// Trang GIA HẠN: thay toàn bộ ERP khi doanh nghiệp hết hạn gói/dùng thử (đăng nhập bằng "token khóa" — xem api/login.ts).
const RenewalPage = lazy(() => import('./components/subscription/RenewalPage'));

const hostKind = getHostInfo().kind;
const boot = chooseScreen(hostKind, window.location.pathname, getStoredTokenClaims(), Date.now());

const renderRoot = (node: React.ReactNode) =>
  createRoot(document.getElementById('root')!).render(<StrictMode><Suspense fallback={null}>{node}</Suspense></StrictMode>);

if (boot.screen === 'console') {
  renderRoot(<PlatformConsole />);
} else if (boot.screen === 'landing') {
  renderRoot(<LandingPage />);
} else if (boot.screen === 'renewal') {
  // Token KHÓA còn hạn → doanh nghiệp đã hết hạn gói: chỉ hiện trang gia hạn, KHÔNG khởi động ERP/Supabase.
  renderRoot(<RenewalPage />);
} else {
  // Token đăng nhập đã HẾT HẠN (token thường chỉ sống tới lúc gói hết — xem api/login.ts) → xóa phiên để quay về màn đăng nhập
  // thay vì để ERP chạy với token chết (mọi lời gọi dữ liệu sẽ lỗi 401). Đang mở trang mà token hết hạn giữa chừng: hẹn giờ
  // tải lại đúng lúc đó → màn đăng nhập → đăng nhập lại sẽ nhận token khóa và thấy trang gia hạn.
  if (boot.clearSession) clearStoredSession();
  if (boot.reloadAtMs !== null) {
    setTimeout(() => { clearStoredSession(); window.location.reload(); }, Math.min(boot.reloadAtMs - Date.now(), 2 ** 31 - 1));
  }

  // Register PWA Service Worker (offline cache, installable app)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('[SW] Registered:', reg.scope))
        .catch((err) => console.error('[SW] Registration failed:', err));
    });
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <SettingsProvider>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </SettingsProvider>
      </BrowserRouter>
    </StrictMode>,
  );
}
