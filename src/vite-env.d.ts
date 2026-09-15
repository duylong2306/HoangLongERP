/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_WEBPUSH_VAPID_PUBLIC_KEY: string;
  readonly GEMINI_API_KEY: string;
  readonly APP_URL: string;
  // Inject bởi vite.config.ts (define) — mã commit ngắn + ngày build, hiển thị
  // góc sidebar để dễ theo dõi bản đang chạy sau mỗi lần deploy.
  readonly VITE_BUILD_COMMIT: string;
  readonly VITE_BUILD_DATE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}