// QUYẾT ĐỊNH MÀN HÌNH KHỞI ĐỘNG (src/main.tsx) — hàm thuần để test được, vì đây là chỗ nhạy cảm về bảo mật:
// token KHÓA (doanh nghiệp hết hạn gói) phải LUÔN dẫn tới trang gia hạn, không bao giờ vào ERP.
import type { HostInfo } from './tenant';

export type Screen = 'console' | 'landing' | 'renewal' | 'erp';

export interface BootDecision {
  screen: Screen;
  clearSession: boolean;        // xóa JWT + phiên ERP đang lưu (token đã chết) → ERP hiện màn đăng nhập
  reloadAtMs: number | null;    // hẹn tải lại trang đúng lúc token hết hạn (ERP đang mở); null = không cần
}

export function chooseScreen(hostKind: HostInfo['kind'], pathname: string, claims: Record<string, any> | null, nowMs: number): BootDecision {
  // 1) Trang quản trị nền tảng: /quantri ở địa chỉ gốc hoặc "other" (vercel.app/localhost). KHÔNG BAO GIỜ ở subdomain doanh nghiệp.
  if (hostKind !== 'tenant' && /^\/quantri(\/|$)/.test(pathname)) return { screen: 'console', clearSession: false, reloadAtMs: null };
  // 2) Địa chỉ gốc: website giới thiệu + đăng ký.
  if (hostKind === 'root') return { screen: 'landing', clearSession: false, reloadAtMs: null };

  // 3) ERP / trang gia hạn, tùy token đang lưu.
  const expMs = typeof claims?.exp === 'number' ? claims.exp * 1000 : null;
  if (expMs !== null && expMs <= nowMs) {
    // Token đã chết (token thường chỉ sống tới lúc gói hết) → xóa phiên, ERP quay về màn đăng nhập.
    return { screen: 'erp', clearSession: true, reloadAtMs: null };
  }
  if (typeof claims?.locked_company_id === 'string') {
    return { screen: 'renewal', clearSession: false, reloadAtMs: null };
  }
  return { screen: 'erp', clearSession: false, reloadAtMs: expMs };
}
