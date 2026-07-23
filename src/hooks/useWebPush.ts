import { useState, useEffect, useCallback } from 'react';
import { getSupabase } from '../lib/supabase';

// VAPID public key - should be set in environment variables
// Tạo bằng: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = import.meta.env.VITE_WEBPUSH_VAPID_PUBLIC_KEY || '';

// sessionStorage key to track this device's subscription endpoint
const PUSH_ENDPOINT_KEY = 'hl_push_endpoint';

// Convert base64 URL-safe string to ArrayBuffer
function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}

// ─── Core subscribe/unsubscribe ─────────────────────────────────────────────

async function subscribeToPush(userId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Web Push: Trình duyệt không hỗ trợ Push API');
      return false;
    }

    const registration = await navigator.serviceWorker.register('/web-push-sw.js');

    if (!VAPID_PUBLIC_KEY) {
      console.warn('Web Push: VAPID public key chưa được thiết lập (VITE_WEBPUSH_VAPID_PUBLIC_KEY)');
      return false;
    }

    // Request notification permission first
    if ('Notification' in window && Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('Web Push: Người dùng từ chối cấp quyền thông báo');
        return false;
      }
    }

    // Check existing subscription — reuse if valid
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(VAPID_PUBLIC_KEY),
      });
    }

    const keys = subscription.toJSON().keys;
    const endpoint = subscription.endpoint;
    const p256dh = keys?.p256dh;
    const auth = keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      console.error('Web Push: Thiếu keys trong subscription');
      return false;
    }

    // Upsert based on endpoint — cùng thiết bị update, thiết bị khác insert mới
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      platform: 'web',
    }, { onConflict: 'endpoint' });

    if (error) {
      console.error('Web Push: Lỗi lưu subscription:', error);
      return false;
    }

    sessionStorage.setItem(PUSH_ENDPOINT_KEY, endpoint);
    console.log('Web Push: Đăng ký thành công cho user', userId);
    return true;
  } catch (err) {
    console.error('Web Push: Lỗi đăng ký:', err);
    return false;
  }
}

async function unsubscribeFromPush(): Promise<boolean> {
  const supabase = getSupabase();
  let success = true;

  try {
    const currentEndpoint = sessionStorage.getItem(PUSH_ENDPOINT_KEY);

    if (supabase && currentEndpoint) {
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', currentEndpoint);

      if (error) {
        console.error('Web Push: Lỗi xóa subscription:', error);
        success = false;
      } else {
        console.log('Web Push: Đã xóa subscription thiết bị hiện tại');
      }
      sessionStorage.removeItem(PUSH_ENDPOINT_KEY);
    }

    // Unsubscribe from browser push
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }
    }
  } catch (err) {
    console.error('Web Push: Lỗi hủy đăng ký:', err);
    success = false;
  }
  return success;
}

// Check if current device has an active subscription
async function checkSubscriptionStatus(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    const endpoint = sessionStorage.getItem(PUSH_ENDPOINT_KEY);

    return !!subscription && !!endpoint;
  } catch {
    return false;
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export interface UseWebPushReturn {
  isPushEnabled: boolean;
  togglePush: () => Promise<void>;
}

export function useWebPush(userId: string | null): UseWebPushReturn {
  const [isPushEnabled, setIsPushEnabled] = useState(false);

  // Only check status on mount — do NOT auto-subscribe
  useEffect(() => {
    if (!userId) {
      setIsPushEnabled(false);
      return;
    }
    checkSubscriptionStatus().then(setIsPushEnabled);
  }, [userId]);

  // Cleanup on logout — xóa subscription thiết bị hiện tại
  useEffect(() => {
    if (!userId) return;

    return () => {
      unsubscribeFromPush().then(() => setIsPushEnabled(false));
    };
  }, [userId]);

  // Toggle function — gọi từ UI (UserProfileModal)
  const togglePush = useCallback(async () => {
    if (!userId) return;

    if (isPushEnabled) {
      const ok = await unsubscribeFromPush();
      if (ok) setIsPushEnabled(false);
    } else {
      const result = await subscribeToPush(userId);
      setIsPushEnabled(result);
    }
  }, [userId, isPushEnabled]);

  return { isPushEnabled, togglePush };
}
