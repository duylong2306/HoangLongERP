import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;
let currentConfig = { url: '', anonKey: '', accessToken: null as string | null };

// JWT ký ở /api/login (chứa company_id) — lưu riêng khỏi hl_erp_active_session
// (session đó chỉ lưu thông tin nhân viên, KHÔNG lưu token). sessionStorage
// luôn được set khi đăng nhập; localStorage chỉ set thêm khi "Tự động đăng
// nhập" được tick — cùng đúng quy ước persist đã dùng cho hl_erp_active_session
// ở AuthContext.tsx, để hành vi nhất quán giữa 2 loại dữ liệu của cùng 1 phiên.
const JWT_STORAGE_KEY = 'hl_erp_jwt';

function readStoredAccessToken(): string | null {
  try {
    return sessionStorage.getItem(JWT_STORAGE_KEY) || localStorage.getItem(JWT_STORAGE_KEY);
  } catch {
    return null;
  }
}

// Giải mã phần payload của JWT (KHÔNG xác minh chữ ký — chỉ đọc claim để dùng
// phía client, việc xác minh thật đã do PostgREST/RLS làm ở server khi request
// thật sự gửi lên). Trả null nếu token rỗng/hỏng thay vì ném lỗi, để không làm
// vỡ luồng gọi (component gọi getCurrentCompanyId() không cần try/catch riêng).
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const base64 = token.split('.')[1];
    const json = decodeURIComponent(
      atob(base64.replace(/-/g, '+').replace(/_/g, '/'))
        .split('')
        .map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * company_id của phiên đang đăng nhập — đọc trực tiếp từ claim trong JWT (xem
 * setAuthToken/api/login.ts, Giai đoạn 2), KHÔNG lưu thành 1 state riêng để
 * tránh 2 nguồn có thể lệch nhau. dbService.ts (Giai đoạn 4) dùng hàm này để
 * tự gắn company_id vào mọi lượt đọc/ghi. Trả null khi chưa đăng nhập (JWT
 * chưa có) — các hàm gọi phải tự xử lý graceful cho trường hợp này (xem
 * comment tại querySupabase/saveSupabase).
 */
export function getCurrentCompanyId(): string | null {
  const token = currentConfig.accessToken || readStoredAccessToken();
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  return (payload && typeof payload.company_id === 'string') ? payload.company_id : null;
}

/**
 * JWT thô của phiên đang đăng nhập — dùng khi cần tự gọi 1 API server riêng
 * (không qua supabase-js client), ví dụ api/admin-companies.ts (Giai đoạn 7)
 * cần Authorization: Bearer <token> để server tự xác minh quyền quản trị.
 */
export function getCurrentAccessToken(): string | null {
  return currentConfig.accessToken || readStoredAccessToken();
}

/**
 * Giai đoạn 6 (multi-tenant): gắn thêm company_id vào tên key localStorage
 * cho các key LƯU DỮ LIỆU NGHIỆP VỤ (khách hàng, dự án, hoá đơn, cấu hình
 * công ty...). Trước Phase 7 (routing theo subdomain), nhiều công ty vẫn có
 * thể đăng nhập qua CÙNG 1 domain (api/login.ts nhận `subdomain` tuỳ chọn) —
 * nếu không tách theo company_id, cache của công ty A sẽ "loé" ra ở màn hình
 * công ty B trong khoảnh khắc load từ localStorage trước khi Supabase đồng
 * bộ đè lên. Chưa đăng nhập (companyId null) → giữ nguyên key gốc (không đổi
 * hành vi trước khi có JWT). Không dùng cho key thuần UI/preference (sidebar
 * collapsed, page size...) — những key đó không phải dữ liệu nghiệp vụ nên
 * dùng chung giữa các công ty không sao.
 */
export function companyScopedKey(baseKey: string): string {
  const companyId = getCurrentCompanyId();
  return companyId ? `${baseKey}__${companyId}` : baseKey;
}

/**
 * Dynamically initializes or updates the Supabase client with new credentials.
 * accessToken (tuỳ chọn): JWT từ /api/login chứa company_id — khi có, mọi
 * request REST/Realtime sau đó gửi kèm Authorization: Bearer <token> thay vì
 * chỉ dùng anonKey, để RLS (Giai đoạn 3) đọc được company_id mà lọc đúng.
 */
export function initializeSupabase(url: string, anonKey: string, accessToken?: string | null): SupabaseClient | null {
  if (!url || !anonKey) {
    supabaseInstance = null;
    currentConfig = { url: '', anonKey: '', accessToken: null };
    console.warn('[Supabase] initializeSupabase called with empty credentials');
    return null;
  }

  try {
    supabaseInstance = createClient(url, anonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
      global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
    });
    currentConfig = { url, anonKey, accessToken: accessToken || null };
    console.log("[Supabase] Successfully initialized with URL:", url, accessToken ? '(kèm JWT company_id)' : '(chỉ anon key)');
    // Báo cho App re-subscribe realtime khi client chưa sẵn sàng lúc mount (G2).
    // App lắng nghe event này để gọi lại setupRealtimeChannel(getSupabase()).
    try { window.dispatchEvent(new CustomEvent('hl-supabase-client-ready')); } catch {}
    return supabaseInstance;
  } catch (error) {
    console.error("[Supabase] Failed to initialize:", error);
    supabaseInstance = null;
    currentConfig = { url: '', anonKey: '', accessToken: null };
    return null;
  }
}

/**
 * Gọi sau khi /api/login trả JWT mới (đăng nhập thành công) hoặc khi đăng
 * xuất (token = null) — lưu token đúng quy ước persist rồi khởi tạo lại
 * client với Authorization header tương ứng. KHÔNG tự suy ra url/anonKey khi
 * client chưa từng khởi tạo lần nào — gọi getSupabase() trước đó ít nhất 1
 * lần (Login.tsx/AuthContext.tsx đều đã tải dữ liệu trước khi tới bước này).
 */
export function setAuthToken(token: string | null, persist: boolean): SupabaseClient | null {
  try {
    if (token) {
      sessionStorage.setItem(JWT_STORAGE_KEY, token);
      if (persist) {
        localStorage.setItem(JWT_STORAGE_KEY, token);
      } else {
        localStorage.removeItem(JWT_STORAGE_KEY);
      }
    } else {
      sessionStorage.removeItem(JWT_STORAGE_KEY);
      localStorage.removeItem(JWT_STORAGE_KEY);
    }
  } catch (e) {
    console.warn('[Supabase] Không lưu được JWT vào storage:', e);
  }

  if (!currentConfig.url || !currentConfig.anonKey) {
    console.warn('[Supabase] setAuthToken gọi trước khi có url/anonKey — bỏ qua khởi tạo lại client.');
    return supabaseInstance;
  }
  return initializeSupabase(currentConfig.url, currentConfig.anonKey, token);
}

/**
 * Lazily retrieves the Supabase client instance.
 * Returns null if credentials are not configured, which allows the application
 * to run gracefully without crashing if Supabase isn't connected yet.
 */
export function getSupabase(): SupabaseClient | null {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  // JWT từ lần đăng nhập trước (nếu còn — xem setAuthToken) — nạp NGAY ở lần
  // khởi tạo đầu tiên, để mọi request kể từ đầu (kể cả trước khi AuthContext
  // kịp render) đã gửi kèm company_id, tránh 1 nhịp gọi bằng anon key trần.
  const storedAccessToken = readStoredAccessToken();

  // Try to load from localStorage first (set by admin in settings)
  const savedConfigStr = localStorage.getItem('hl_supabase_config');
  if (savedConfigStr) {
    try {
      const saved = JSON.parse(savedConfigStr);
      if (saved.url && saved.anonKey) {
        return initializeSupabase(saved.url, saved.anonKey, storedAccessToken);
      }
    } catch (e) {
      console.error("Failed to parse saved Supabase config from localStorage:", e);
    }
  }

  const metaEnv = (import.meta as any).env || {};
  const supabaseUrl = metaEnv.VITE_SUPABASE_URL;
  const supabaseAnonKey =
    metaEnv.VITE_SUPABASE_ANON_KEY || metaEnv.VITE_SUPABASE_PUBLISHABLE_KEY;

  console.log('[Supabase] env check:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    urlPreview: supabaseUrl ? supabaseUrl.slice(0, 30) + '...' : 'MISSING',
  });

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "Supabase credentials missing (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). " +
      "The app will run using local fallback persistence."
    );
    return null;
  }

  return initializeSupabase(supabaseUrl, supabaseAnonKey, storedAccessToken);
}

