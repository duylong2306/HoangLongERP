/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_WEBPUSH_VAPID_PUBLIC_KEY: string;
  // Tên miền gốc cho subdomain doanh nghiệp, nhiều giá trị cách nhau dấu phẩy (xem src/lib/tenant.ts). Trống = dùng ô "Mã công ty".
  readonly VITE_BASE_DOMAIN?: string;
  // Khóa công khai Cloudflare Turnstile cho form đăng ký (không đặt = không hiện CAPTCHA).
  readonly VITE_TURNSTILE_SITE_KEY?: string;
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