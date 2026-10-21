import { useEffect, useState } from 'react';
import { companyScopedKey } from './supabase';
import { prefsKey, readPrefs, type ChatPrefs } from './chatPrefs';

/** Tùy chọn Tin nhắn của người dùng (tắt thông báo/ghim), tự cập nhật khi đổi trong giao diện Tin nhắn (sự kiện hl-chat-prefs-updated). */
export function useChatPrefs(userId?: string): ChatPrefs {
  const [prefs, setPrefs] = useState<ChatPrefs>(() => readPrefs(companyScopedKey(prefsKey(userId))));
  useEffect(() => {
    const reload = () => setPrefs(readPrefs(companyScopedKey(prefsKey(userId))));
    reload();
    window.addEventListener('hl-chat-prefs-updated', reload);
    window.addEventListener('storage', reload);
    return () => { window.removeEventListener('hl-chat-prefs-updated', reload); window.removeEventListener('storage', reload); };
  }, [userId]);
  return prefs;
}
