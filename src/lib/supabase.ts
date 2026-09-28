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

