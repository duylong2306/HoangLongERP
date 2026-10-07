import {StrictMode, lazy, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { SettingsProvider } from './context/SettingsContext';
import ErrorBoundary from './components/ErrorBoundary';
import { getHostInfo } from './lib/tenant';
import './index.css';

// Địa chỉ gốc (www.<tên-miền-gốc>, xem src/lib/tenant.ts) = website giới thiệu + đăng ký doanh nghiệp.
// Chỉ nạp trang này (tải trễ) — KHÔNG khởi động ứng dụng ERP/Supabase/Service Worker ở địa chỉ gốc.
// Mọi địa chỉ khác (subdomain doanh nghiệp, vercel.app, localhost...) chạy ứng dụng như cũ.
const LandingPage = lazy(() => import('./components/landing/LandingPage'));
// Trang QUẢN TRỊ NỀN TẢNG (đường dẫn /quantri): tách hẳn khỏi ERP, tài khoản riêng. Chỉ mở ở địa chỉ gốc hoặc địa chỉ
// "other" (vercel.app/localhost, để thử); TUYỆT ĐỐI không mở ở subdomain doanh nghiệp (ở đó /quantri vẫn là ERP).
const PlatformConsole = lazy(() => import('./components/platform/PlatformConsole'));

const hostKind = getHostInfo().kind;
const laTrangQuanTri = hostKind !== 'tenant' && /^\/quantri(\/|$)/.test(window.location.pathname);

if (laTrangQuanTri) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Suspense fallback={null}>
        <PlatformConsole />
      </Suspense>
    </StrictMode>,
  );
} else if (hostKind === 'root') {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Suspense fallback={null}>
        <LandingPage />
      </Suspense>
    </StrictMode>,
  );
} else {
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
