// Gọi API trang quản trị nền tảng (api/platform.ts) — token RIÊNG, lưu ở sessionStorage (đóng tab là mất phiên).
// Tách hoàn toàn khỏi token ERP (src/lib/supabase.ts): đăng nhập ERP không cho vào đây và ngược lại.
const TOKEN_KEY = 'lolo_platform_token';

export const getPlatformToken = (): string | null => {
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setPlatformToken = (t: string | null) => {
  try { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY); } catch { /* bỏ qua */ }
};

export class ApiError extends Error {
  constructor(message: string, public status: number, public errors?: Record<string, string>) { super(message); }
}

// Hết phiên/token sai (401) → xóa token và báo cho màn hình quay về trang đăng nhập.
export const UNAUTHORIZED_EVENT = 'lolo-platform-unauthorized';

export async function platformCall<T = any>(action: string, data: Record<string, unknown> = {}): Promise<T> {
  const token = getPlatformToken();
  let res: Response;
  try {
    res = await fetch('/api/platform', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ action, ...data }),
    });
  } catch {
    throw new ApiError('Không kết nối được tới máy chủ. Vui lòng thử lại.', 0);
  }
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    // 401 trên các action cần đăng nhập = hết phiên; riêng `login` sai mật khẩu cũng 401 nhưng KHÔNG phải hết phiên.
    if (res.status === 401 && action !== 'login') {
      setPlatformToken(null);
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(json?.error || 'Có lỗi xảy ra, vui lòng thử lại.', res.status, json?.errors);
  }
  return json as T;
}
