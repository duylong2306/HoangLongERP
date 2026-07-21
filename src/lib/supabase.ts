import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;
let currentConfig = { url: '', anonKey: '' };

/**
 * Dynamically initializes or updates the Supabase client with new credentials.
 */
export function initializeSupabase(url: string, anonKey: string): SupabaseClient | null {
  if (!url || !anonKey) {
    supabaseInstance = null;
    currentConfig = { url: '', anonKey: '' };
    return null;
  }

  try {
    supabaseInstance = createClient(url, anonKey);
    currentConfig = { url, anonKey };
    console.log("Supabase dynamically initialized with URL:", url);
    return supabaseInstance;
  } catch (error) {
    console.error("Failed to dynamically initialize Supabase:", error);
    supabaseInstance = null;
    currentConfig = { url: '', anonKey: '' };
    return null;
  }
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

  // Try to load from localStorage first (set by admin in settings)
  const savedConfigStr = localStorage.getItem('hl_supabase_config');
  if (savedConfigStr) {
    try {
      const saved = JSON.parse(savedConfigStr);
      if (saved.url && saved.anonKey) {
        return initializeSupabase(saved.url, saved.anonKey);
      }
    } catch (e) {
      console.error("Failed to parse saved Supabase config from localStorage:", e);
    }
  }

  const metaEnv = (import.meta as any).env || {};
  const supabaseUrl = metaEnv.VITE_SUPABASE_URL || 'https://sujhvotnlbsgavoenuma.supabase.co';
  const supabaseAnonKey =
    metaEnv.VITE_SUPABASE_ANON_KEY || metaEnv.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseAnonKey) {
    console.warn(
      "Supabase key is missing (VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY). " +
      "The app will run using local fallback persistence."
    );
    return null;
  }

  return initializeSupabase(supabaseUrl, supabaseAnonKey);
}

